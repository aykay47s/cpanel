import { Hono } from 'hono';
import { sql } from '../db';
import { requireSuperAdmin } from '../auth';

export const tenancy = new Hono();

const PLAN_LABELS: Record<string, { label: string; price: number; days: number }> = {
  '3day': { label: '3 Day Access', price: 99, days: 3 },
  '7day': { label: '7 Day Access', price: 180, days: 7 },
  monthly: { label: '1 Month Access', price: 750, days: 30 },
};

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

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'tenant';
}

// Operator generates a key after taking payment through the store (manually, since
// there's no payment processor wired up yet) - the key itself is what the customer
// actually redeems, completely separate from any specific tenant until redemption.
tenancy.post('/api/master/license-keys', requireSuperAdmin(), async (c) => {
  const { plan } = await c.req.json().catch(() => ({}));
  const planInfo = PLAN_LABELS[plan];
  if (!planInfo) return c.json({ error: 'Invalid plan' }, 400);
  let key_code = generateKeyCode();
  // Extremely unlikely to collide, but check anyway rather than trust chance.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await sql`SELECT 1 FROM license_keys WHERE key_code = ${key_code}`;
    if (!existing) break;
    key_code = generateKeyCode();
  }
  const [row] = await sql`INSERT INTO license_keys (key_code, plan, price_paid) VALUES (${key_code}, ${plan}, ${planInfo.price}) RETURNING *`;
  return c.json({ data: row });
});

tenancy.get('/api/master/license-keys', requireSuperAdmin(), async (c) => {
  const rows = await sql`SELECT license_keys.*, tenants.name as tenant_name FROM license_keys LEFT JOIN tenants ON tenants.id = license_keys.redeemed_by_tenant_id ORDER BY created_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

tenancy.delete('/api/master/license-keys/:id', requireSuperAdmin(), async (c) => {
  await sql`DELETE FROM license_keys WHERE id = ${c.req.param('id')} AND redeemed = false`;
  return c.json({ ok: true });
});

// Public - anyone with a valid, unredeemed key can look up what it's for before
// committing to a call center name (doesn't reveal anything sensitive, just plan info).
tenancy.get('/api/redeem/:key', async (c) => {
  const [row] = await sql`SELECT plan, price_paid, redeemed FROM license_keys WHERE key_code = ${c.req.param('key').toUpperCase()}`;
  if (!row) return c.json({ error: 'Key not found' }, 404);
  if (row.redeemed) return c.json({ error: 'This key has already been redeemed' }, 400);
  const planInfo = PLAN_LABELS[row.plan];
  return c.json({ data: { plan: row.plan, label: planInfo?.label, price: row.price_paid } });
});

// The actual redemption - one-time, atomic. Creates a brand new tenant (their own
// row, own slug, own admin account) and burns the key so it can never be used again.
// Everything created here gets stamped with the new tenant's id - nothing shared.
tenancy.post('/api/redeem', async (c) => {
  const { key, call_center_name, admin_name } = await c.req.json().catch(() => ({}));
  if (!key || !call_center_name || !admin_name) {
    return c.json({ error: 'Key, call center name, and your name are all required' }, 400);
  }
  const keyCode = String(key).toUpperCase().trim();

  // Atomically claim the key first - if this UPDATE affects 0 rows, someone else
  // (or a retried request) already redeemed it, and we stop before creating anything.
  const [claimedKey] = await sql`UPDATE license_keys SET redeemed = true, redeemed_at = now() WHERE key_code = ${keyCode} AND redeemed = false RETURNING *`;
  if (!claimedKey) return c.json({ error: 'Invalid or already-redeemed key' }, 400);

  const planInfo = PLAN_LABELS[claimedKey.plan];
  const baseSlug = slugify(call_center_name);
  let slug = baseSlug;
  for (let i = 2; i < 100; i++) {
    const [existing] = await sql`SELECT 1 FROM tenants WHERE slug = ${slug}`;
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }

  const expiresAt = planInfo ? new Date(Date.now() + planInfo.days * 24 * 60 * 60 * 1000) : null;
  const [tenant] = await sql`
    INSERT INTO tenants (name, slug, url, plan, price_paid, status, expires_at)
    VALUES (${call_center_name}, ${slug}, '', ${claimedKey.plan}, ${claimedKey.price_paid}, 'active', ${expiresAt})
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

  return c.json({
    data: {
      tenant_name: tenant.name,
      slug: tenant.slug,
      admin_pin: admin.pin,
      admin_name: admin.name,
      plan_label: planInfo?.label,
      expires_at: tenant.expires_at,
    },
  });
});
