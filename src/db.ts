import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL!, { ssl: false });

let ready = false;

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

  // ---- Idempotent migrations for tables carried over from earlier deploys ----
  const alters = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS notif_prefs JSONB DEFAULT '{"lead_assigned":true,"chat":true,"announcements":true}'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS dedup_status TEXT DEFAULT 'clear'`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`,
    `ALTER TABLE leads ADD COLUMN IF NOT EXISTS merged_into_id INTEGER`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS important BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_role TEXT NOT NULL DEFAULT 'all'`,
  ];
  for (const stmt of alters) {
    await sql.unsafe(`DO $$ BEGIN ${stmt}; EXCEPTION WHEN OTHERS THEN NULL; END $$;`);
  }

  const [goalRow] = await sql`SELECT 1 FROM settings WHERE key = 'goal_target'`;
  if (!goalRow) {
    await sql`INSERT INTO settings (key, value) VALUES ('goal_target', '50'), ('goal_label', 'Successful calls this week') ON CONFLICT (key) DO NOTHING`;
  }

  ready = true;
}

export const LEAD_STATUSES = [
  'not_called', 'calling', 'active_call', 'call_ended', 'successful_call',
  'assigned_to_finisher', 'ready_for_finishing', 'completed', 'failed', 'requires_review',
] as const;
