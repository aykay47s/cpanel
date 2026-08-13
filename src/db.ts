import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL!, { ssl: false });

let ready = false;
let cleanupStarted = false;

const DEFAULT_CALL_TEMPLATE = 'Greeting: Introduce yourself and confirm you\'re speaking with the right person.\nPurpose: Explain why you\'re calling in one clear sentence.\nQualify: Ask about their current situation and needs.\nNext step: Confirm interest and agree on what happens next.';

export async function ensureDb() {
  if (ready) return;

  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    pin TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'caller' CHECK (role IN ('admin','caller','finisher')),
    avatar TEXT DEFAULT '🧑',
    xp INTEGER DEFAULT 0,
    clocked_in BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'offline',
    notif_prefs JSONB DEFAULT '{"lead_assigned":true,"chat":true,"announcements":true}',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    source TEXT,
    lead_type TEXT DEFAULT 'general',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'not_called',
    assigned_caller_id INTEGER REFERENCES users(id),
    assigned_finisher_id INTEGER REFERENCES users(id),
    uploaded_by INTEGER REFERENCES users(id),
    call_started_at TIMESTAMPTZ,
    call_ended_at TIMESTAMPTZ,
    outcome TEXT,
    dedup_status TEXT DEFAULT 'clear' CHECK (dedup_status IN ('clear','flagged','confirmed_duplicate')),
    merged_into_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS lead_events (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id INTEGER REFERENCES users(id),
    actor_role TEXT,
    from_status TEXT,
    to_status TEXT,
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // Structured caller notes — kept entirely separate from leads.notes (which holds
  // import-time data like address fragments) so admins see a clean, attributed
  // timeline of what callers actually said, not one blob of mixed text.
  await sql`CREATE TABLE IF NOT EXISTS lead_notes (
    id SERIAL PRIMARY KEY,
    lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    author_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // Every XP grant as its own row, not just a running total on users — this is
  // what makes a weekly leaderboard possible (sum the last 7 days) and lets the
  // board show WHY someone is ahead instead of one opaque number.
  await sql`CREATE TABLE IF NOT EXISTS xp_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    lead_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS xp_events_user_time ON xp_events (user_id, created_at)`;

  // ============ TELEGRAM ============
  // Every caller and admin can (and by default must) link a Telegram account so
  // ClearPanel (via the master bot) — and optionally their own tenant's bot —
  // can reach them for account matters and broadcasts. Verification uses a
  // short-lived 6-digit code the user pastes into the bot chat; the bot's
  // webhook matches the code and stores the chat_id. No OTPs from other
  // services ever touch this system; codes are single-use and expire in 5 min.
  // Per-tenant branding — each tenant can have its own panel name and logo.
  // Falls back to the global 'panel_name' setting if not set.
  const brandAlters = [
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS panel_name TEXT',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS panel_logo TEXT',
  ];
  for (const stmt of brandAlters) {
    await sql.unsafe(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  }

    const telegramAlters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id_master BIGINT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id_tenant BIGINT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verified_master_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_verified_tenant_at TIMESTAMPTZ`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_bot_username TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_webhook_secret TEXT`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS telegram_require_verification BOOLEAN DEFAULT true`,
  ];
  for (const stmt of telegramAlters) {
    await sql.unsafe(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  }
  // Before a user's chat_id is linked to a ClearPanel account we need somewhere
  // to park it. When someone messages /start (or any message) to the bot we
  // store username -> chat_id here. When they enter their @username in the app
  // we look it up and DM the code directly — so the OTP is *received* in
  // Telegram, not copied from the app.
  await sql`CREATE TABLE IF NOT EXISTS telegram_chat_registry (
    telegram_username TEXT PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'master',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS tcr_chat ON telegram_chat_registry (chat_id)`;

  // Pending verification codes — memory would work, but a table survives restarts
  // and lets multiple server instances agree. Rows self-clean via expires_at.
  await sql`CREATE TABLE IF NOT EXISTS telegram_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    telegram_username TEXT NOT NULL,
    code TEXT NOT NULL,
    scope TEXT NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
  )`;
  await sql`CREATE INDEX IF NOT EXISTS tgv_code ON telegram_verifications (code) WHERE consumed_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS tgv_user ON telegram_verifications (user_id, scope)`;
  // Log of every DM we send, so operator can see what landed and what bounced.
  await sql`CREATE TABLE IF NOT EXISTS telegram_broadcasts (
    id SERIAL PRIMARY KEY,
    sender_scope TEXT NOT NULL,
    sender_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
    audience_label TEXT NOT NULL,
    message TEXT NOT NULL,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    blocked_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS telegram_deliveries (
    id SERIAL PRIMARY KEY,
    broadcast_id INTEGER REFERENCES telegram_broadcasts(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // Rate limit for /master login attempts. Wipes on server restart which is
  // fine — a real attacker sees a fresh 3-strikes window at worst.
  await sql`CREATE TABLE IF NOT EXISTS master_login_attempts (
    ip TEXT PRIMARY KEY,
    fail_count INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ
  )`;


  // Inbound calls received through a connected Twilio number — logged whether
  // answered, missed, or abandoned in the menu, so admins have visibility even
  // before this becomes a full call center feature.
  await sql`CREATE TABLE IF NOT EXISTS inbound_calls (
    id SERIAL PRIMARY KEY,
    twilio_call_sid TEXT UNIQUE,
    from_number TEXT,
    menu_selection TEXT,
    routed_to_user_id INTEGER REFERENCES users(id),
    status TEXT DEFAULT 'ringing',
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ
  )`;

  // The control plane for reselling this panel: every separately-deployed customer
  // instance (each on its own Railway project/database for real data isolation)
  // gets a row here. Stats are pulled live from each tenant's own /api/tenant-stats
  // endpoint, not stored/duplicated - this table just tracks who exists and what
  // they're paying, revenue is entered manually since there's no payment processor
  // wired up yet.
  await sql`CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    url TEXT NOT NULL,
    plan TEXT DEFAULT 'trial',
    price_paid NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'active',
    is_self BOOLEAN DEFAULT false,
    notes TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  // Generated by the operator after a customer pays through the store; the customer
  // redeems it once to provision their own isolated call center - own tenant row,
  // own admin account, own slug/URL. A key can only ever be redeemed once.
  await sql`CREATE TABLE IF NOT EXISTS license_keys (
    id SERIAL PRIMARY KEY,
    key_code TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL,
    days INTEGER NOT NULL DEFAULT 7,
    price_paid NUMERIC DEFAULT 0,
    redeemed BOOLEAN NOT NULL DEFAULT false,
    redeemed_by_tenant_id INTEGER REFERENCES tenants(id),
    redeemed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;


  await sql`CREATE TABLE IF NOT EXISTS duplicate_flags (
    id SERIAL PRIMARY KEY,
    lead_id_a INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    lead_id_b INTEGER REFERENCES leads(id) ON DELETE CASCADE,
    confidence INTEGER NOT NULL,
    reasons JSONB DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed_duplicate','not_duplicate')),
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS scripts (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, lead_type TEXT DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'approved', submitted_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    important BOOLEAN NOT NULL DEFAULT false,
    target_role TEXT NOT NULL DEFAULT 'all' CHECK (target_role IN ('all','caller','finisher','admin')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`;

  await sql`CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    reply_to_id INTEGER REFERENCES chat_messages(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS chat_reads (
    user_id INTEGER REFERENCES users(id) PRIMARY KEY,
    last_read_message_id INTEGER DEFAULT 0
  )`;

  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    related_lead_id INTEGER REFERENCES leads(id),
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS push_subscriptions (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  await sql`CREATE TABLE IF NOT EXISTS clock_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    clocked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    clocked_out_at TIMESTAMPTZ,
    duration_seconds INTEGER
  )`;

  await sql`CREATE TABLE IF NOT EXISTS lead_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#4f8cff',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  // Bank categories carry the bank's real domain so badges can show the actual
  // brand mark — works for any bank on earth, not just a hardcoded UK list.
  await sql`ALTER TABLE lead_categories ADD COLUMN IF NOT EXISTS domain TEXT`;

  // ---- Idempotent migrations for tables carried over from earlier deploys ----
  const alters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_prefs JSONB DEFAULT '{"lead_assigned":true,"chat":true,"announcements":true}'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_caller_id INTEGER REFERENCES users(id)`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_finisher_id INTEGER REFERENCES users(id)`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS uploaded_by INTEGER REFERENCES users(id)`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMPTZ`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMPTZ`,
    `ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'not_called'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedup_status TEXT DEFAULT 'clear'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS merged_into_id INTEGER`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_e164 TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS extra_info TEXT`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS date_of_birth DATE`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_attempts INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'all'`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)`,
    // scripts.submitted_by can be left over from an older schema pointing at a
    // different table — clean up orphaned references, then fix the constraint.
    `UPDATE scripts SET submitted_by = NULL WHERE submitted_by IS NOT NULL AND submitted_by NOT IN (SELECT id FROM users)`,
    `ALTER TABLE scripts DROP CONSTRAINT IF EXISTS scripts_submitted_by_fkey`,
    `ALTER TABLE scripts ADD CONSTRAINT scripts_submitted_by_fkey FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS call_phone TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS pfp_data TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS inbound_eligible BOOLEAN DEFAULT true`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS inbound_priority INTEGER DEFAULT 100`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS slug TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    `ALTER TABLE scripts ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`,
    `ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'twilio'`,
    `ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id)`,
    // --- 3CX Call Control API ---
    // Where 3CX should actually ring this person. Preferred over call_phone for
    // 3CX routing: routing to an internal extension stays on the PBX, while an
    // external number needs an outbound rule and burns a trunk channel.
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS threecx_extension TEXT`,
    // Which lead the inbound number matched, so the call log links to the record
    // instead of re-running the phone match every time the log is opened.
    `ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES leads(id)`,
    `ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS answered_at TIMESTAMPTZ`,
    // How many callers were rung before someone took it — the number that tells
    // an admin whether their call order is actually working.
    `ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS route_attempts INTEGER DEFAULT 0`,
    `ALTER TABLE license_keys ADD COLUMN IF NOT EXISTS days INTEGER NOT NULL DEFAULT 7`,
  ];
  for (const stmt of alters) {
    await sql.unsafe(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  }

  const [goalRow] = await sql`SELECT 1 FROM settings WHERE key = 'goal_target'`;
  if (!goalRow) {
    await sql`INSERT INTO settings (key, value) VALUES ('goal_target', '50'), ('goal_label', 'Successful calls this week') ON CONFLICT (key) DO NOTHING`;
  }
  const [templateRow] = await sql`SELECT 1 FROM settings WHERE key = 'call_template'`;
  if (!templateRow) {
    await sql`INSERT INTO settings (key, value) VALUES ('call_template', ${DEFAULT_CALL_TEMPLATE}) ON CONFLICT (key) DO NOTHING`;
  }
  const [brandRow] = await sql`SELECT 1 FROM settings WHERE key = 'panel_name'`;
  if (!brandRow) {
    await sql`INSERT INTO settings (key, value) VALUES ('panel_name', 'ClearPanel') ON CONFLICT (key) DO NOTHING`;
  }
  const [telRow] = await sql`SELECT 1 FROM settings WHERE key = 'telephony_config'`;
  if (!telRow) {
    const defaultTelephony = JSON.stringify({
      menu_options: [
        { digit: '1', label: 'New Enquiry' },
        { digit: '2', label: 'Existing Claim' },
      ],
      hold_music_url: null,
      ring_behavior: 'keep_ringing',
      inbound_mode: 'everyone',
      provider: 'twilio',
      twilio_account_sid: null,
      twilio_phone_number: null,
      twilio_connected: false,
      threecx_fqdn: null,
      threecx_client_id: null,
      threecx_connected: false,
      vonage_api_key: null,
      vonage_application_id: null,
      vonage_number: null,
      vonage_connected: false,
    });
    await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${defaultTelephony}) ON CONFLICT (key) DO NOTHING`;
  }
  const [catRow] = await sql`SELECT 1 FROM lead_categories LIMIT 1`;
  if (!catRow) {
    await sql`INSERT INTO lead_categories (name, color) VALUES
      ('General', '#9c9184'), ('Priority', '#4f8cff'), ('UK', '#3fa89a'), ('International', '#8b6fc9'), ('Callback', '#c04b3f'),
      ('Lloyds', '#026a37'), ('Barclays', '#00aeef'), ('HSBC', '#db0011'), ('NatWest', '#5a287d'),
      ('Santander', '#ec0000'), ('Halifax', '#0e5aa7'), ('TSB', '#0091d4'), ('Nationwide', '#1b3a6b'),
      ('RBS', '#003087'), ('Metro Bank', '#e2231a'), ('Monzo', '#f15a5a'), ('Starling', '#7433ff')
      ON CONFLICT (name) DO NOTHING`;
  } else {
    // Add the bank categories even if General/Priority/etc already existed from an
    // earlier deploy — don't skip them just because the table wasn't empty.
    await sql`INSERT INTO lead_categories (name, color) VALUES
      ('Lloyds', '#026a37'), ('Barclays', '#00aeef'), ('HSBC', '#db0011'), ('NatWest', '#5a287d'),
      ('Santander', '#ec0000'), ('Halifax', '#0e5aa7'), ('TSB', '#0091d4'), ('Nationwide', '#1b3a6b'),
      ('RBS', '#003087'), ('Metro Bank', '#e2231a'), ('Monzo', '#f15a5a'), ('Starling', '#7433ff')
      ON CONFLICT (name) DO NOTHING`;
  }

  // First admin account ever created on an instance gets super-admin - the person
  // who set this instance up, able to see the multi-tenant control panel.
  const [superAdminRow] = await sql`SELECT 1 FROM users WHERE is_super_admin = true LIMIT 1`;
  if (!superAdminRow) {
    const [firstAdmin] = await sql`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1`;
    if (firstAdmin) await sql`UPDATE users SET is_super_admin = true WHERE id = ${firstAdmin.id}`;
  }

  // Every instance registers itself as a tenant of its own control plane. This
  // one (the operator's own instance) is marked is_self and gets an empty slug -
  // it's served at the root URL with no prefix, exactly like before multi-tenancy
  // existed. Named customer tenants get a real slug and are served under
  // /:slug/... within this same shared deployment.
  const [selfTenantRow] = await sql`SELECT id FROM tenants WHERE is_self = true LIMIT 1`;
  let selfTenantId: number;
  if (!selfTenantRow) {
    const [inserted] = await sql`INSERT INTO tenants (name, slug, url, plan, price_paid, status, is_self, notes) VALUES ('Frap Ties (self)', '', '', 'owner', 0, 'active', true, 'This instance - not a resold customer') RETURNING id`;
    selfTenantId = inserted.id;
  } else {
    selfTenantId = selfTenantRow.id;
  }

  // Backfill: every user/lead created before tenant_id existed belongs to this
  // operator's own usage, not a customer's - never silently orphaned or mixed up.
  await sql`UPDATE users SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  // Ensure the self-tenant has a real slug so /fraptise routes to the operator panel
  await sql`UPDATE tenants SET slug = 'fraptise' WHERE is_self = true AND (slug IS NULL OR slug = '')`;

  // CRITICAL FIX: the self-tenant's panel_name/panel_logo columns were added
  // after 'Frap Ties' was already configured via the old global settings table.
  // Backfill from settings so the operator's existing branding is preserved —
  // never silently replaced by the 'ClearPanel' fallback.
  const [selfBrand] = await sql`SELECT id, panel_name, panel_logo FROM tenants WHERE is_self = true`;
  // URGENT DATA FIX: settings.panel_name / tenants.panel_name were found to
  // contain offensive/corrupted content on the live instance (not something
  // this app ever wrote — the value was already in the database and the
  // backfill migration below faithfully copied whatever was there). Purge any
  // known-bad value outright rather than silently propagating it forward.
  const BLOCKED_PANEL_NAMES = ['niggers', 'nigger', 'nigga', 'niggas'];
  const isBlockedName = (v: string | null | undefined) => !!v && BLOCKED_PANEL_NAMES.includes(v.trim().toLowerCase());
  const [badSetting] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
  if (isBlockedName(badSetting?.value)) {
    await sql`DELETE FROM settings WHERE key = 'panel_name'`;
  }
  await sql`UPDATE tenants SET panel_name = NULL WHERE panel_name IS NOT NULL AND lower(trim(panel_name)) = ANY(${BLOCKED_PANEL_NAMES})`;

  if (selfBrand && !selfBrand.panel_name) {
    const [nameRow] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
    if (nameRow?.value) await sql`UPDATE tenants SET panel_name = ${nameRow.value} WHERE id = ${selfBrand.id}`;
  }
  if (selfBrand && !selfBrand.panel_logo) {
    const [logoRow] = await sql`SELECT value FROM settings WHERE key = 'panel_logo'`;
    if (logoRow?.value) await sql`UPDATE tenants SET panel_logo = ${logoRow.value} WHERE id = ${selfBrand.id}`;
  }

  await sql`UPDATE leads SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  await sql`UPDATE chat_messages SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  await sql`UPDATE announcements SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  await sql`UPDATE scripts SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  await sql`UPDATE inbound_calls SET tenant_id = ${selfTenantId} WHERE tenant_id IS NULL`;
  // Backfill real durations for keys generated before "days" existed as its own
  // column - correcting the blanket default of 7 the ALTER TABLE gave every
  // pre-existing row, based on what their old fixed plan name actually meant.
  await sql`UPDATE license_keys SET days = 3 WHERE plan = '3day' AND days = 7`;
  await sql`UPDATE license_keys SET days = 30 WHERE plan = 'monthly' AND days = 7`;
  await sql`UPDATE tenants SET slug = '' WHERE is_self = true AND slug IS NULL`;

  // PINs only need to be unique WITHIN a tenant now, not globally - two different
  // customers' call centers can both hand out PIN 1234 without colliding.
  await sql.unsafe(`DO $$ BEGIN ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pin_key; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  await sql.unsafe(`DO $$ BEGIN ALTER TABLE users ADD CONSTRAINT users_tenant_pin_unique UNIQUE (tenant_id, pin); EXCEPTION WHEN OTHERS THEN NULL; END $$;`);

  // In-app update system: admin can push text updates to all callers in their
  // tenant. A LIVE update shows a persistent banner across all screens until
  // resolved. Callers with no Telegram linked always see in-app updates;
  // callers with Telegram also get a DM from the gateway bot.
  await sql`CREATE TABLE IF NOT EXISTS panel_updates (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    is_live BOOLEAN DEFAULT false,
    posted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS panel_updates_tenant ON panel_updates (tenant_id, created_at DESC)`;
  // Per-user dismissals for non-live updates
  await sql`CREATE TABLE IF NOT EXISTS panel_update_dismissals (
    update_id INTEGER REFERENCES panel_updates(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (update_id, user_id)
  )`;
  // Username: unique within a tenant, used for display + Telegram linkage
  const usernameAlters = [
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT',
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS role_confirmed_at TIMESTAMPTZ',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gateway_bot_token TEXT',
    'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS gateway_bot_username TEXT',
    'ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE',
  ];
  for (const stmt of usernameAlters) {
    await sql.unsafe(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  }
  // CRITICAL FIX: telephony_config, twilio_auth_token, threecx_client_secret,
  // vonage_api_secret, vonage_private_key, and call_template were all stored as
  // single GLOBAL settings rows shared by every tenant on the platform — any
  // tenant's admin could view (and overwrite) any other tenant's Twilio/3CX/
  // Vonage credentials and IVR/script config. Migrate the existing global value
  // for each key to a tenant-scoped key (key:tenantId) for the self-tenant
  // specifically, since live call routing has only ever been wired to the self
  // tenant's origin — this preserves the current live setup exactly as it
  // already behaves. The old global row is left in place (unused after this)
  // rather than deleted, so nothing is destroyed if something needs checking.
  const [selfForTelephony] = await sql`SELECT id FROM tenants WHERE is_self = true`;
  if (selfForTelephony) {
    const sid = selfForTelephony.id;
    const legacyKeys = ['telephony_config', 'twilio_auth_token', 'threecx_client_secret', 'vonage_api_secret', 'vonage_private_key', 'call_template', 'center_open', 'center_offline_reason'];
    for (const key of legacyKeys) {
      const scopedKey = `${key}:${sid}`;
      const [already] = await sql`SELECT 1 FROM settings WHERE key = ${scopedKey}`;
      if (already) continue;
      const [legacy] = await sql`SELECT value FROM settings WHERE key = ${key}`;
      if (legacy?.value !== undefined) {
        await sql`INSERT INTO settings (key, value) VALUES (${scopedKey}, ${legacy.value}) ON CONFLICT (key) DO NOTHING`;
      }
    }
  }

  // Groups/chats the gateway bot has seen a message in — captured automatically
  // via its webhook so an admin can pick "the announcements group" from a real
  // list instead of needing to know its numeric chat_id.
  await sql`CREATE TABLE IF NOT EXISTS gateway_chats (
    chat_id BIGINT PRIMARY KEY,
    title TEXT,
    chat_type TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

    // Hard-delete expired disappearing messages every 30s. This actually removes the
  // rows from Postgres — not a soft-delete/hidden flag.
  if (!cleanupStarted) {
    cleanupStarted = true;
    setInterval(async () => {
      try { await sql`DELETE FROM chat_messages WHERE expires_at IS NOT NULL AND expires_at < now()`; } catch {}
    }, 30000);
  }

  ready = true;
}

export const LEAD_STATUSES = [
  'vaulted', 'not_called', 'calling', 'active_call', 'call_ended', 'successful_call',
  'assigned_to_finisher', 'ready_for_finishing', 'completed', 'failed', 'requires_review',
] as const;
