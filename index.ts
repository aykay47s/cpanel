import { Hono } from 'hono';
import { sql, ensureDb } from './src/db';
import { leads } from './src/routes/leads';
import { users } from './src/routes/users';
import { chat } from './src/routes/chat';
import { notifications } from './src/routes/notifications';
import { announcements } from './src/routes/announcements';
import { scripts } from './src/routes/scripts';
import { misc } from './src/routes/misc';
import { CONTROL_PAGE } from './src/control';
import { telephony } from './src/routes/telephony';
import { tenancy } from './src/routes/tenancy';
import { STORE_PAGE } from './src/store';
import { REDEEM_PAGE } from './src/redeem';
import { page } from './src/frontend';
import * as threecx from './src/threecx';

const app = new Hono();
const ADMIN_PIN = process.env.ADMIN_PIN || '9247';

// Every uncaught error becomes a proper JSON response with the real error message
// logged server-side — never Bun's default plain-text crash page, which is what was
// breaking the frontend's res.json() calls with "Unexpected token 'I'" errors.
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}] Unhandled error:`, err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

app.use('*', async (c, next) => {
  await ensureDb();
  // Bootstrap: ensure at least one admin exists, seeded from ADMIN_PIN.
  const [existingAdmin] = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (!existingAdmin) {
    await sql`INSERT INTO users (name, pin, role) VALUES ('Admin', ${ADMIN_PIN}, 'admin') ON CONFLICT (pin) DO NOTHING`;
  }
  await next();
});

app.route('/', leads);
app.route('/', users);
app.route('/', chat);
app.route('/', notifications);
app.route('/', announcements);
app.route('/', scripts);
app.route('/', misc);
app.route('/', telephony);
app.route('/', tenancy);

app.get('/sw.js', async (c) => {
  const file = Bun.file('./public/sw.js');
  c.header('Content-Type', 'application/javascript');
  c.header('Service-Worker-Allowed', '/');
  return c.body(await file.text());
});

app.get('/control', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(CONTROL_PAGE);
});

app.get('/store', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  const [row] = await sql`SELECT value FROM settings WHERE key = 'store_checkout_url'`;
  const checkoutUrl = row?.value || 'mailto:sales@example.com';
  return c.html(STORE_PAGE(checkoutUrl));
});

app.get('/redeem', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(REDEEM_PAGE);
});

app.get('/manifest.json', async (c) => {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('panel_name', 'panel_logo')`;
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  const name = map.panel_name || 'ClearPanel';
  return c.json({
    name,
    short_name: name,
    start_url: '/',
    display: 'standalone',
    background_color: '#08080b',
    theme_color: '#08080b',
    icons: map.panel_logo
      ? [{ src: map.panel_logo, sizes: '512x512', type: 'image/png' }]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
  });
});

app.get('/clearpanel-logo.png', async (c) => { c.header('Content-Type', 'image/png'); c.header('Cache-Control', 'public, max-age=86400'); return c.body(await Bun.file('./public/clearpanel-logo.png').arrayBuffer()); });
app.get('/icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon.png').arrayBuffer()); });
app.get('/icon-192.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-192.png').arrayBuffer()); });
app.get('/icon-512.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-512.png').arrayBuffer()); });
app.get('/apple-touch-icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/apple-touch-icon.png').arrayBuffer()); });

app.get('/', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('panel_name', 'panel_logo')`;
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  const name = map.panel_name || 'ClearPanel';
  const logoTag = map.panel_logo ? `<img src="${map.panel_logo}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;" />` : '';
  let html = page
    .split('Frap Ties').join(name)
    .split('<div class="brand-mark"></div>').join(`<div class="brand-mark">${logoTag}</div>`)
    .replace('<script>', '<script>const TENANT_SLUG = null;');
  if (map.panel_logo) {
    html = html.replace('<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg>', logoTag);
  }
  return c.html(html);
});

// Every resold call center gets its own path here - same shared deployment and
// database as the operator's own instance, but with real data isolation (every
// query is scoped by the authenticated user's own tenant_id). Branding here is
// deliberately just their own call center name, not the operator's logo/settings -
// those are global settings that belong to the self tenant, not shared out.
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const [tenant] = await sql`SELECT * FROM tenants WHERE slug = ${slug} AND status = 'active' AND is_self = false`;
  if (!tenant) return c.notFound();
  // Also check expiry — expired tenants get a clean, clear page rather than a panel that
  // partially loads then fails every API call with 401
  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
    await sql`UPDATE tenants SET status = 'expired' WHERE id = ${tenant.id}`;
    return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel Expired</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,sans-serif;background:#07070a;color:#eaeaec;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}div{text-align:center;max-width:360px;}h1{font-size:20px;margin-bottom:8px;}p{font-size:13px;color:#8f8f98;line-height:1.6;}</style></head><body><div><h1>Access Expired</h1><p>The access period for <strong>${String(tenant.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</strong> has ended. Contact whoever set this up to renew your access.</p></div></body></html>`);
  }
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  const html = page
    .split('Frap Ties').join(tenant.name)
    .replace('<script>', `<script>const TENANT_SLUG = ${JSON.stringify(slug)};`);
  return c.html(html);
});

// The 3CX Call Control connection is a long-lived socket, not a request handler,
// so it starts with the process rather than lazily on first request — otherwise
// nothing would route inbound calls until an admin happened to open the panel.
// Failure here is deliberately non-fatal: a PBX being unreachable must never stop
// the panel itself from serving.
ensureDb()
  .then(() => threecx.start())
  .catch((err) => console.error('[3cx] startup skipped:', err?.message));

export default {
  port: Number(process.env.PORT) || 8080,
  fetch: app.fetch,
};
