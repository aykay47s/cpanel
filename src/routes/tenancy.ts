import { Hono } from 'hono';
import { sql } from '../db';
import { requireMaster } from './telegram';
import { dbRateLimit } from '../ratelimit';

export const tenancy = new Hono();

function generateKeyCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let group = '';
    for (let i = 0; i < 4; i++) group += chars[Math.floor(Math.random() * chars.length)];
    groups.push(group);
  }
  return groups.join('-');
}

// Slugs that are real routes on this server — a tenant slug matching one of
// these would be shadowed by the route (or worse, shadow it), so redemption
// must never produce them.
const RESERVED_SLUGS = new Set(['app', 'store', 'login', 'master', 'control', 'redeem', 'affiliate', 'api', 'js', 'icons', 'manifest', 'sw', 'admin']);
function slugify(name: string): string {
  const s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'tenant';
  return RESERVED_SLUGS.has(s) ? s + '-panel' : s;
}

// The operator generates a key themselves for any number of days they want (they
// sell keys their own way, outside this system entirely), and can label it however
// they like for their own tracking - the label is display-only, "days" is what
// actually determines the access window when it's redeemed. count generates several
// identical keys (same days/price/label) in one call, for batch-selling ahead of time.
tenancy.post('/api/master/license-keys', requireMaster, async (c) => {
  const { label, days, price, count } = await c.req.json().catch(() => ({}));
  const numDays = parseInt(days, 10);
  if (!numDays || numDays < 1 || numDays > 3650) return c.json({ error: 'Enter a valid number of days (1-3650)' }, 400);
  const numCount = Math.max(1, Math.min(500, parseInt(count, 10) || 1));
  const planLabel = String(label || '').trim() || `${numDays} Day Access`;
  const numPrice = parseFloat(price) || 0;
  const created: any[] = [];
  for (let n = 0; n < numCount; n++) {
    let key_code = generateKeyCode();
    // Extremely unlikely to collide, but check anyway rather than trust chance.
    for (let attempt = 0; attempt < 5; attempt++) {
      const [existing] = await sql`SELECT 1 FROM license_keys WHERE key_code = ${key_code}`;
      if (!existing) break;
      key_code = generateKeyCode();
    }
    const [row] = await sql`INSERT INTO license_keys (key_code, plan, days, price_paid) VALUES (${key_code}, ${planLabel}, ${numDays}, ${numPrice}) RETURNING *`;
    created.push(row);
  }
  return c.json({ data: numCount === 1 ? created[0] : created, keys: created });
});

tenancy.get('/api/master/license-keys', requireMaster, async (c) => {
  const rows = await sql`SELECT license_keys.*, tenants.name as tenant_name FROM license_keys LEFT JOIN tenants ON tenants.id = license_keys.redeemed_by_tenant_id ORDER BY created_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

tenancy.delete('/api/master/license-keys/:id', requireMaster, async (c) => {
  await sql`DELETE FROM license_keys WHERE id = ${c.req.param('id')} AND redeemed = false`;
  return c.json({ ok: true });
});

// A buyer who only has their key (lost the panel URL) can find their panel with
// it. The key is a secret only the buyer holds, so returning the slug is safe —
// it's their own purchase receipt.
tenancy.get('/api/access/key/:key', async (c) => {
  const [row] = await sql`SELECT lk.redeemed, t.slug, t.name, t.status FROM license_keys lk
    LEFT JOIN tenants t ON t.id = lk.redeemed_by_tenant_id
    WHERE lk.key_code = ${String(c.req.param('key')).toUpperCase().trim()}`;
  if (!row) return c.json({ error: 'Key not found' }, 404);
  if (!row.redeemed) return c.json({ data: { redeemed: false } });
  if (!row.slug || row.status !== 'active') return c.json({ error: 'This key was redeemed but its panel is no longer active' }, 410);
  return c.json({ data: { redeemed: true, panel_name: row.name, url: '/' + row.slug } });
});

// Public - anyone with a valid, unredeemed key can look up what it's for before
// committing to a call center name (doesn't reveal anything sensitive, just plan info).
tenancy.get('/api/redeem/:key', async (c) => {
  const [row] = await sql`SELECT plan, days, price_paid, redeemed FROM license_keys WHERE key_code = ${c.req.param('key').toUpperCase()}`;
  if (!row) return c.json({ error: 'Key not found' }, 404);
  if (row.redeemed) return c.json({ error: 'This key has already been redeemed' }, 400);
  return c.json({ data: { plan: row.plan, label: row.plan, days: row.days, price: row.price_paid } });
});

// The actual redemption - one-time, atomic. Creates a brand new tenant (their own
// row, own slug, own admin account) and burns the key so it can never be used again.
// Everything created here gets stamped with the new tenant's id - nothing shared.
tenancy.post('/api/redeem', async (c) => {
  const { key, call_center_name, admin_name, referral_code } = await c.req.json().catch(() => ({}));
  if (!key || !call_center_name || !admin_name) {
    return c.json({ error: 'Key, call center name, and your name are all required' }, 400);
  }
  const keyCode = String(key).toUpperCase().trim();

  // Atomically claim the key first - if this UPDATE affects 0 rows, someone else
  // (or a retried request) already redeemed it, and we stop before creating anything.
  const [claimedKey] = await sql`UPDATE license_keys SET redeemed = true, redeemed_at = now() WHERE key_code = ${keyCode} AND redeemed = false RETURNING *`;
  if (!claimedKey) return c.json({ error: 'Invalid or already-redeemed key' }, 400);

  const baseSlug = slugify(call_center_name);
  let slug = baseSlug;
  for (let i = 2; i < 100; i++) {
    const [existing] = await sql`SELECT 1 FROM tenants WHERE slug = ${slug}`;
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }

  // Lifetime keys (>= 3650 days) never expire; everything else gets a hard end date.
  const isLifetime = claimedKey.days >= 3650;
  const expiresAt = isLifetime ? null : new Date(Date.now() + claimedKey.days * 24 * 60 * 60 * 1000);
  const [tenant] = await sql`
    INSERT INTO tenants (name, slug, url, plan, price_paid, status, expires_at, plan_days)
    VALUES (${call_center_name}, ${slug}, '', ${claimedKey.plan}, ${claimedKey.price_paid}, 'active', ${expiresAt}, ${claimedKey.days})
    RETURNING *`;
  await sql`UPDATE license_keys SET redeemed_by_tenant_id = ${tenant.id} WHERE id = ${claimedKey.id}`;

  // A fresh, random admin PIN for this new tenant - never reused, never guessable.
  let pin: string;
  for (;;) {
    pin = String(Math.floor(1000 + Math.random() * 9000));
    const [collision] = await sql`SELECT 1 FROM users WHERE tenant_id = ${tenant.id} AND pin = ${pin}`;
    if (!collision) break;
  }
  const [admin] = await sql`INSERT INTO users (name, pin, role, tenant_id, is_super_admin) VALUES (${admin_name}, ${pin}, 'admin', ${tenant.id}, false) RETURNING id, name, pin`;

  // === Affiliate referral credit (tracking only — never reduces buyer's price) ===
  let referralCredited = false;
  if (referral_code && String(referral_code).trim()) {
    const code = String(referral_code).trim();
    const [aff] = await sql`SELECT * FROM affiliates WHERE lower(code) = lower(${code}) LIMIT 1`;
    if (aff) {
      const saleAmount = Number(claimedKey.price_paid) || 0;
      const pct = Number(aff.commission_pct) || 10;
      const commission = Math.round((saleAmount * pct / 100) * 100) / 100;
      await sql`INSERT INTO affiliate_referrals
        (affiliate_id, license_key_id, tenant_id, tenant_name, sale_amount, commission_amount, commission_pct)
        VALUES (${aff.id}, ${claimedKey.id}, ${tenant.id}, ${tenant.name}, ${saleAmount}, ${commission}, ${pct})`;
      await sql`UPDATE license_keys SET referral_code = ${code} WHERE id = ${claimedKey.id}`;
      referralCredited = true;
    } else {
      // Not a registered affiliate — may be a tenant's own referral code. Stamp it
      // for tracking so the referring panel can count the signup. No commission.
      await sql`UPDATE license_keys SET referral_code = ${code} WHERE id = ${claimedKey.id}`;
    }
  }

  return c.json({
    data: {
      tenant_name: tenant.name,
      slug: tenant.slug,
      admin_pin: admin.pin,
      admin_name: admin.name,
      plan_label: claimedKey.plan,
      expires_at: tenant.expires_at,
      referral_credited: referralCredited,
    },
  });
});

// Renew an EXISTING panel with a freshly-bought key, instead of spinning up a
// new tenant. This is the recovery path when access has run out — same panel,
// same leads, same callers, same URL, just more time. Identity is proved by
// the tenant's own admin PIN (not a login session), because a session may
// already be dead by the time someone's key has expired — this has to work
// precisely when normal auth doesn't.
tenancy.post('/api/tenant/renew', async (c) => {
  const { slug, admin_pin, key } = await c.req.json().catch(() => ({} as any));
  if (!slug || !admin_pin || !key) return c.json({ error: 'Panel, admin PIN, and key are all required' }, 400);

  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
  const rl = await dbRateLimit(`renew:${ip}:${slug}`, { windowMs: 60_000, max: 8, blockMs: 300_000 });
  if (rl.limited) return c.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);

  const [tenant] = await sql`SELECT * FROM tenants WHERE slug = ${String(slug).toLowerCase().trim()}`;
  if (!tenant) return c.json({ error: 'Panel not found' }, 404);
  if (tenant.is_self) return c.json({ error: 'This panel cannot be renewed this way' }, 403);
  if (tenant.status === 'terminated') return c.json({ error: tenant.termination_reason ? `This panel has been terminated: ${tenant.termination_reason}` : 'This panel has been terminated. Contact whoever set this up.' }, 403);

  const [admin] = await sql`SELECT id, name FROM users WHERE tenant_id = ${tenant.id} AND role = 'admin' AND pin = ${String(admin_pin).trim()}`;
  if (!admin) return c.json({ error: 'Incorrect admin PIN for this panel' }, 401);

  const keyCode = String(key).toUpperCase().trim();
  const [claimedKey] = await sql`UPDATE license_keys SET redeemed = true, redeemed_at = now() WHERE key_code = ${keyCode} AND redeemed = false RETURNING *`;
  if (!claimedKey) return c.json({ error: 'Invalid or already-redeemed key' }, 400);

  const isLifetime = claimedKey.days >= 3650;
  // Extend from whichever is later: the current expiry (still-active top-up
  // stacks on top of remaining time) or now (a lapsed panel starts counting
  // fresh from the moment of renewal). A lifetime key wins outright.
  const base = (!isLifetime && tenant.expires_at && new Date(tenant.expires_at) > new Date()) ? new Date(tenant.expires_at) : new Date();
  const newExpiry = isLifetime ? null : new Date(base.getTime() + claimedKey.days * 24 * 60 * 60 * 1000);
  // Tier-gated features (own bot, AI writer, telephony) are keyed off plan_days —
  // a renewal should never take features away, only add. NULL stays NULL
  // (unrestricted, e.g. a panel that started on an old ungated key).
  const newPlanDays = tenant.plan_days == null ? null : Math.max(tenant.plan_days, claimedKey.days);

  const [updated] = await sql`UPDATE tenants SET status = 'active', expires_at = ${newExpiry}, plan_days = ${newPlanDays}, terminated_at = NULL, termination_reason = NULL WHERE id = ${tenant.id} RETURNING *`;
  await sql`UPDATE license_keys SET redeemed_by_tenant_id = ${tenant.id} WHERE id = ${claimedKey.id}`;

  return c.json({ data: { slug: updated.slug, tenant_name: updated.name, expires_at: updated.expires_at, plan_label: claimedKey.plan } });
});


// ============================================================================
// MASTER: Panel termination
// ============================================================================
// Kill a tenant's access immediately and record why. Sets status='terminated'
// so every login and /:slug load is refused (the auth + slug routes check status).
tenancy.post('/api/master/tenants/:id/terminate', requireMaster, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const { reason } = await c.req.json().catch(() => ({}));
  const [t] = await sql`SELECT id, is_self FROM tenants WHERE id = ${id}`;
  if (!t) return c.json({ error: 'Tenant not found' }, 404);
  if (t.is_self) return c.json({ error: 'Cannot terminate the operator tenant' }, 400);
  await sql`UPDATE tenants SET status = 'terminated', terminated_at = now(), termination_reason = ${String(reason || '').trim() || null} WHERE id = ${id}`;
  return c.json({ ok: true });
});

// Reactivate a terminated (or expired) tenant. Optionally extend the window.
tenancy.post('/api/master/tenants/:id/reactivate', requireMaster, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const { extend_days } = await c.req.json().catch(() => ({}));
  const days = parseInt(extend_days, 10);
  if (days && days > 0) {
    const newExpiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await sql`UPDATE tenants SET status = 'active', terminated_at = NULL, termination_reason = NULL, expires_at = ${newExpiry} WHERE id = ${id}`;
  } else {
    await sql`UPDATE tenants SET status = 'active', terminated_at = NULL, termination_reason = NULL WHERE id = ${id}`;
  }
  return c.json({ ok: true });
});

// Operator "add days" — comp time onto a tenant directly, no key burned.
// Stacks on top of the current expiry when still in the future, or starts
// counting fresh from now when already lapsed (same math as renewal), and
// revives an 'expired' panel in the process. Lifetime panels (expires_at
// NULL) have nothing to extend.
tenancy.post('/api/master/tenants/:id/extend', requireMaster, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const { days } = await c.req.json().catch(() => ({}));
  const d = parseInt(days, 10);
  if (!d || d < 1 || d > 3650) return c.json({ error: 'Enter days between 1 and 3650' }, 400);
  const [tenant] = await sql`SELECT * FROM tenants WHERE id = ${id}`;
  if (!tenant) return c.json({ error: 'Tenant not found' }, 404);
  if (tenant.status === 'terminated') return c.json({ error: 'Reactivate this panel first, then add days' }, 400);
  if (!tenant.expires_at) return c.json({ error: 'This panel never expires — nothing to extend' }, 400);
  const base = new Date(tenant.expires_at) > new Date() ? new Date(tenant.expires_at) : new Date();
  const newExpiry = new Date(base.getTime() + d * 24 * 60 * 60 * 1000);
  const [updated] = await sql`UPDATE tenants SET expires_at = ${newExpiry}, status = 'active' WHERE id = ${id} RETURNING expires_at`;
  return c.json({ data: { expires_at: updated.expires_at } });
});

// ============================================================================
// MASTER: Full platform stats
// ============================================================================
tenancy.get('/api/master/stats', requireMaster, async (c) => {
  const [tenantCounts] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE is_self = false) AS total_tenants,
      COUNT(*) FILTER (WHERE is_self = false AND status = 'active') AS active_tenants,
      COUNT(*) FILTER (WHERE status = 'terminated') AS terminated_tenants,
      COUNT(*) FILTER (WHERE status = 'expired') AS expired_tenants
    FROM tenants`;
  const [keyCounts] = await sql`
    SELECT
      COUNT(*) AS total_keys,
      COUNT(*) FILTER (WHERE redeemed = true) AS redeemed_keys,
      COUNT(*) FILTER (WHERE redeemed = false) AS unredeemed_keys,
      COALESCE(SUM(price_paid) FILTER (WHERE redeemed = true), 0) AS revenue_redeemed,
      COALESCE(SUM(price_paid), 0) AS revenue_potential
    FROM license_keys`;
  const [userCounts] = await sql`
    SELECT
      COUNT(*) AS total_users,
      COUNT(*) FILTER (WHERE role = 'admin') AS total_admins,
      COUNT(*) FILTER (WHERE clocked_in = true) AS clocked_in_now
    FROM users`;
  const [leadCounts] = await sql`SELECT COUNT(*) AS total_leads FROM leads`;
  const [affCounts] = await sql`
    SELECT
      (SELECT COUNT(*) FROM affiliates) AS total_affiliates,
      (SELECT COUNT(*) FROM affiliate_referrals) AS total_referrals,
      (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals) AS total_commission,
      (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_referrals WHERE paid_out = false) AS commission_owed`;
  // Revenue over last 30 days by redeemed key
  const revenueByDay = await sql`
    SELECT to_char(date_trunc('day', redeemed_at), 'YYYY-MM-DD') AS day, COALESCE(SUM(price_paid),0) AS amount, COUNT(*) AS sales
    FROM license_keys WHERE redeemed = true AND redeemed_at > now() - interval '30 days'
    GROUP BY 1 ORDER BY 1`;
  return c.json({ data: {
    tenants: tenantCounts, keys: keyCounts, users: userCounts,
    leads: leadCounts, affiliates: affCounts, revenue_by_day: revenueByDay,
  }});
});

// Every tenant with full detail for the master roster
tenancy.get('/api/master/tenants-full', requireMaster, async (c) => {
  const rows = await sql`
    SELECT t.*,
      (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
      (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.clocked_in = true) AS online_count,
      (SELECT COUNT(*) FROM leads l WHERE l.tenant_id = t.id) AS lead_count
    FROM tenants t WHERE t.is_self = false ORDER BY t.created_at DESC NULLS LAST`;
  return c.json({ data: rows });
});

// ============================================================================
// MASTER: Affiliate management
// ============================================================================
function genAffCode(name: string): string {
  const base = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AFF';
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

tenancy.get('/api/master/affiliates', requireMaster, async (c) => {
  const rows = await sql`
    SELECT a.*,
      (SELECT COUNT(*) FROM affiliate_referrals r WHERE r.affiliate_id = a.id) AS referral_count,
      (SELECT COALESCE(SUM(commission_amount),0) FROM affiliate_referrals r WHERE r.affiliate_id = a.id) AS total_earned,
      (SELECT COALESCE(SUM(commission_amount),0) FROM affiliate_referrals r WHERE r.affiliate_id = a.id AND r.paid_out = false) AS owed
    FROM affiliates a ORDER BY a.created_at DESC`;
  return c.json({ data: rows });
});

tenancy.post('/api/master/affiliates', requireMaster, async (c) => {
  const { name, telegram_username, commission_pct, code } = await c.req.json().catch(() => ({}));
  if (!name || !String(name).trim()) return c.json({ error: 'Affiliate name is required' }, 400);
  let affCode = String(code || '').trim().toUpperCase() || genAffCode(name);
  for (let attempt = 0; attempt < 6; attempt++) {
    const [exists] = await sql`SELECT 1 FROM affiliates WHERE lower(code) = lower(${affCode})`;
    if (!exists) break;
    affCode = genAffCode(name);
  }
  const pct = Math.max(0, Math.min(100, Number(commission_pct) || 10));
  // A random access PIN so the affiliate can view their own panel at /affiliate
  const accessPin = String(Math.floor(100000 + Math.random() * 900000));
  const [row] = await sql`INSERT INTO affiliates (code, name, telegram_username, commission_pct, access_pin)
    VALUES (${affCode}, ${String(name).trim()}, ${String(telegram_username || '').trim() || null}, ${pct}, ${accessPin}) RETURNING *`;
  return c.json({ data: row });
});

tenancy.delete('/api/master/affiliates/:id', requireMaster, async (c) => {
  await sql`DELETE FROM affiliates WHERE id = ${parseInt(c.req.param('id'), 10)}`;
  return c.json({ ok: true });
});

// Mark an affiliate's outstanding commission as paid out
tenancy.post('/api/master/affiliates/:id/mark-paid', requireMaster, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  await sql`UPDATE affiliate_referrals SET paid_out = true, paid_out_at = now() WHERE affiliate_id = ${id} AND paid_out = false`;
  return c.json({ ok: true });
});

// Referrals for one affiliate (master view)
tenancy.get('/api/master/affiliates/:id/referrals', requireMaster, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  const rows = await sql`SELECT * FROM affiliate_referrals WHERE affiliate_id = ${id} ORDER BY created_at DESC`;
  return c.json({ data: rows });
});

// ============================================================================
// AFFILIATE SELF-SERVICE PANEL (public, PIN-gated by the affiliate's access_pin)
// ============================================================================
tenancy.post('/api/affiliate/login', async (c) => {
  const { code, pin } = await c.req.json().catch(() => ({}));
  if (!code || !pin) return c.json({ error: 'Code and PIN required' }, 400);
  const [aff] = await sql`SELECT * FROM affiliates WHERE lower(code) = lower(${String(code).trim()}) AND access_pin = ${String(pin).trim()} LIMIT 1`;
  if (!aff) return c.json({ error: 'Invalid code or PIN' }, 401);
  const [totals] = await sql`
    SELECT COUNT(*) AS referral_count,
      COALESCE(SUM(commission_amount),0) AS total_earned,
      COALESCE(SUM(commission_amount) FILTER (WHERE paid_out = false),0) AS owed,
      COALESCE(SUM(commission_amount) FILTER (WHERE paid_out = true),0) AS paid,
      COALESCE(SUM(sale_amount),0) AS total_sales_value
    FROM affiliate_referrals WHERE affiliate_id = ${aff.id}`;
  const referrals = await sql`SELECT tenant_name, sale_amount, commission_amount, commission_pct, paid_out, created_at
    FROM affiliate_referrals WHERE affiliate_id = ${aff.id} ORDER BY created_at DESC`;
  return c.json({ data: {
    code: aff.code, name: aff.name, commission_pct: aff.commission_pct,
    payout_wallet: aff.payout_wallet, payout_currency: aff.payout_currency,
    totals, referrals,
  }});
});

// Affiliate sets their own crypto payout wallet
tenancy.post('/api/affiliate/wallet', async (c) => {
  const { code, pin, wallet, currency } = await c.req.json().catch(() => ({}));
  const [aff] = await sql`SELECT id FROM affiliates WHERE lower(code) = lower(${String(code || '').trim()}) AND access_pin = ${String(pin || '').trim()} LIMIT 1`;
  if (!aff) return c.json({ error: 'Invalid code or PIN' }, 401);
  await sql`UPDATE affiliates SET payout_wallet = ${String(wallet || '').trim() || null}, payout_currency = ${String(currency || 'USDT').trim()} WHERE id = ${aff.id}`;
  return c.json({ ok: true });
});

// ============================================================================
// MASTER: Store pricing + per-tier buy links
// ============================================================================
const STORE_SETTING_KEYS = [
  'store_checkout_url',
  'price_3day', 'price_7day', 'price_14day', 'price_30day', 'price_life',
  'buy_url_3day', 'buy_url_7day', 'buy_url_14day', 'buy_url_30day', 'buy_url_life',
];

tenancy.get('/api/master/store-config', requireMaster, async (c) => {
  const rows = await sql`SELECT key, value FROM settings WHERE key = ANY(${STORE_SETTING_KEYS})`;
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return c.json({ data: out });
});

tenancy.post('/api/master/store-config', requireMaster, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  for (const key of STORE_SETTING_KEYS) {
    if (body[key] === undefined) continue;
    const val = String(body[key]).trim();
    await sql`INSERT INTO settings (key, value) VALUES (${key}, ${val})
      ON CONFLICT (key) DO UPDATE SET value = ${val}`;
  }
  return c.json({ ok: true });
});
