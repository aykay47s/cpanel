import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate, requireSuperAdmin, requireManager, requireAdmin, requireAnyStaff } from '../auth';
import { registerClient, unregisterClient } from '../realtime';
import { VAPID_PUBLIC_KEY, saveSubscription, removeSubscription } from '../push';
import * as threecx from '../threecx';
import jwt from 'jsonwebtoken';

export const misc = new Hono();

// Vonage's Voice API auth: a short-lived JWT signed with the application's private
// key (RS256), not a simple API key/secret header like Twilio's Basic Auth.
export function signVonageJwt(applicationId: string, privateKey: string): string {
  return jwt.sign(
    { application_id: applicationId, iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() },
    privateKey,
    { algorithm: 'RS256', expiresIn: '15m' }
  );
}

// Public but deliberately minimal - just aggregate counts, never any lead/customer
// data. This is what lets a super-admin's control panel pull live numbers from a
// resold customer instance without needing that customer's admin credentials.
misc.get('/api/tenant-stats', async (c) => {
  const user = c.get('user');
  const tid = user.tenant_id;
  const [callers] = await sql`SELECT COUNT(*)::int as n FROM users WHERE role = 'caller' AND tenant_id = ${tid}`;
  const [managers] = await sql`SELECT COUNT(*)::int as n FROM users WHERE role = 'admin' AND tenant_id = ${tid}`;
  const [finishers] = await sql`SELECT COUNT(*)::int as n FROM users WHERE role = 'finisher' AND tenant_id = ${tid}`;
  const [leads] = await sql`SELECT COUNT(*)::int as n FROM leads WHERE tenant_id = ${tid}`;
  const [successful] = await sql`SELECT COUNT(*)::int as n FROM leads WHERE status IN ('successful_call','completed') AND tenant_id = ${tid}`;
  const [onlineNow] = await sql`SELECT COUNT(*)::int as n FROM users WHERE clocked_in = true AND tenant_id = ${tid}`;
  const [brandRow] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
  return c.json({
    data: {
      panel_name: brandRow?.value || 'ClearPanel',
      callers: callers.n, managers: managers.n, finishers: finishers.n,
      total_leads: leads.n, successful_leads: successful.n, online_now: onlineNow.n,
    },
  });
});

misc.get('/api/master/tenants', requireSuperAdmin(), async (c) => {
  const rows = await sql`SELECT * FROM tenants ORDER BY is_self DESC, created_at ASC`;
  return c.json({ data: rows });
});
misc.post('/api/master/tenants', requireSuperAdmin(), async (c) => {
  const { name, url, plan, price_paid, notes } = await c.req.json().catch(() => ({}));
  if (!name || !url) return c.json({ error: 'Name and URL required' }, 400);
  const [row] = await sql`INSERT INTO tenants (name, url, plan, price_paid, notes) VALUES (${name}, ${url}, ${plan || 'trial'}, ${price_paid || 0}, ${notes || null}) RETURNING *`;
  return c.json({ data: row });
});
misc.patch('/api/master/tenants/:id', requireSuperAdmin(), async (c) => {
  const id = c.req.param('id');
  const { name, url, plan, price_paid, status, notes } = await c.req.json().catch(() => ({}));
  const [row] = await sql`UPDATE tenants SET
    name = COALESCE(${name}, name), url = COALESCE(${url}, url), plan = COALESCE(${plan}, plan),
    price_paid = COALESCE(${price_paid}, price_paid), status = COALESCE(${status}, status), notes = COALESCE(${notes}, notes)
    WHERE id = ${id} RETURNING *`;
  return c.json({ data: row });
});
misc.delete('/api/master/tenants/:id', requireSuperAdmin(), async (c) => {
  await sql`DELETE FROM tenants WHERE id = ${c.req.param('id')} AND is_self = false`;
  return c.json({ ok: true });
});
// Pulls live stats from every tenant's own /api/tenant-stats endpoint. Best-effort -
// a tenant that's down or unreachable just shows as unavailable, doesn't break the rest.
misc.get('/api/master/live-stats', requireSuperAdmin(), async (c) => {
  const tenants = await sql`SELECT id, name, url, is_self FROM tenants WHERE status = 'active'`;
  const results = await Promise.all(tenants.map(async (t: any) => {
    try {
      const base = t.is_self ? new URL(c.req.url).origin : t.url.replace(/\/$/, '');
      const res = await fetch(`${base}/api/tenant-stats`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { id: t.id, name: t.name, reachable: false };
      const stats = (await res.json()).data;
      return { id: t.id, name: t.name, reachable: true, ...stats };
    } catch {
      return { id: t.id, name: t.name, reachable: false };
    }
  }));
  return c.json({ data: results });
});

misc.get('/api/admin/telephony-config', requireRole('admin'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  return c.json({ data: row ? JSON.parse(row.value) : null });
});
misc.post('/api/admin/telephony-config', requireRole('admin'), async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return c.json({ error: 'Invalid config' }, 400);
  if (body.hold_music_url && body.hold_music_url.length > 2000000) return c.json({ error: 'Audio file too large' }, 400);
  // The auth token is never sent back to the browser once saved, so if this save
  // came from a form that only had the masked/blank field, don't let it wipe out
  // the real token already stored server-side.
  delete body.twilio_auth_token;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(body)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(body)}`;
  return c.json({ ok: true });
});

// Self-service Twilio connection: admin pastes their own account's credentials,
// we call Twilio's API to point their number's webhook at this server, and store
// only what's needed to keep working — the auth token lives in its own settings
// row and is never included in any GET response.
misc.post('/api/admin/telephony-config/connect-twilio', requireRole('admin'), async (c) => {
  const { account_sid, auth_token, phone_number } = await c.req.json().catch(() => ({}));
  if (!account_sid || !auth_token || !phone_number) {
    return c.json({ error: 'Account SID, Auth Token, and phone number are all required' }, 400);
  }
  const authHeader = 'Basic ' + Buffer.from(`${account_sid}:${auth_token}`).toString('base64');
  const origin = new URL(c.req.url).origin;

  try {
    // Find the phone number's resource SID within their account so we can update it.
    const lookupRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account_sid)}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone_number)}`,
      { headers: { Authorization: authHeader } }
    );
    if (!lookupRes.ok) {
      if (lookupRes.status === 401) return c.json({ error: 'Twilio rejected those credentials — check the Account SID and Auth Token' }, 400);
      return c.json({ error: 'Could not reach Twilio (status ' + lookupRes.status + ')' }, 400);
    }
    const lookupData: any = await lookupRes.json();
    const match = lookupData.incoming_phone_numbers?.[0];
    if (!match) return c.json({ error: 'That phone number was not found on this Twilio account' }, 400);

    // Point the number's voice webhook at our inbound-call handler.
    const updateRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account_sid)}/IncomingPhoneNumbers/${match.sid}.json`,
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          VoiceUrl: `${origin}/api/telephony/inbound`,
          VoiceMethod: 'POST',
          StatusCallback: `${origin}/api/telephony/status`,
          StatusCallbackMethod: 'POST',
        }),
      }
    );
    if (!updateRes.ok) return c.json({ error: 'Twilio accepted the credentials but rejected the webhook update (status ' + updateRes.status + ')' }, 400);

    const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
    const cfg = row ? JSON.parse(row.value) : {};
    cfg.twilio_account_sid = account_sid;
    cfg.twilio_phone_number = phone_number;
    cfg.twilio_connected = true;
    await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
    await sql`INSERT INTO settings (key, value) VALUES ('twilio_auth_token', ${auth_token}) ON CONFLICT (key) DO UPDATE SET value = ${auth_token}`;
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: 'Network error reaching Twilio: ' + (err?.message || 'unknown') }, 502);
  }
});
misc.post('/api/admin/telephony-config/disconnect-twilio', requireRole('admin'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  const cfg = row ? JSON.parse(row.value) : {};
  cfg.twilio_connected = false;
  cfg.twilio_account_sid = null;
  cfg.twilio_phone_number = null;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  await sql`DELETE FROM settings WHERE key = 'twilio_auth_token'`;
  return c.json({ ok: true });
});

// 3CX is architecturally different from Twilio - there's no TwiML-style "return
// instructions" webhook model. 3CX authenticates via OAuth2 client-credentials and
// then exposes a live Call Control socket, which is what actually routes calls now
// (src/threecx.ts). Connecting does three things: proves the credentials work,
// reads back every DN the API client can see so the admin can pick their Route
// Point, and starts the socket immediately - no redeploy, no second setup step.
misc.post('/api/admin/telephony-config/connect-3cx', requireRole('admin'), async (c) => {
  const { fqdn, client_id, client_secret } = await c.req.json().catch(() => ({}));
  if (!fqdn || !client_id || !client_secret) {
    return c.json({ error: 'Server address, Client ID, and Client Secret are all required' }, 400);
  }
  const cleanFqdn = String(fqdn).replace(/\/$/, '').replace(/^https?:\/\//, '');
  let discovered: { dns: any[]; routePoints: string[] };
  try {
    discovered = await threecx.verify(cleanFqdn, client_id, client_secret);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (msg.includes('token request failed (401)') || msg.includes('token request failed (400)')) {
      return c.json({ error: '3CX rejected those credentials — check the Client ID and Client Secret' }, 400);
    }
    if (msg.includes('/callcontrol → 403')) {
      return c.json({ error: 'Credentials work, but this API client has no permissions on the Call Control API. In 3CX: Admin Console > Integrations > API, open this client and grant it access.' }, 400);
    }
    return c.json({ error: 'Could not reach that 3CX server: ' + (msg || 'unknown error') }, 502);
  }

  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  const cfg = row ? JSON.parse(row.value) : {};
  cfg.provider = '3cx';
  cfg.threecx_fqdn = cleanFqdn;
  cfg.threecx_client_id = client_id;
  cfg.threecx_connected = true;
  // Auto-select the route point when there's exactly one - the overwhelmingly
  // common case, and the one place this setup usually stalls.
  if (!cfg.threecx_route_point && discovered.routePoints.length === 1) {
    cfg.threecx_route_point = discovered.routePoints[0];
  }
  if (!cfg.threecx_ring_seconds) cfg.threecx_ring_seconds = 20;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  await sql`INSERT INTO settings (key, value) VALUES ('threecx_client_secret', ${client_secret}) ON CONFLICT (key) DO UPDATE SET value = ${client_secret}`;

  await threecx.restart().catch(() => {});
  return c.json({
    ok: true,
    dns: discovered.dns,
    route_points: discovered.routePoints,
    route_point: cfg.threecx_route_point || null,
    warning: discovered.routePoints.length ? null : 'No Route Point is assigned to this API client, so calls can be logged but not routed. Create a Route Point in 3CX, point your inbound rule at it, and give this API client access to it.',
  });
});
misc.post('/api/admin/telephony-config/disconnect-3cx', requireRole('admin'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  const cfg = row ? JSON.parse(row.value) : {};
  cfg.threecx_connected = false;
  cfg.threecx_fqdn = null;
  cfg.threecx_client_id = null;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  cfg.threecx_route_point = null;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  await sql`DELETE FROM settings WHERE key = 'threecx_client_secret'`;
  threecx.stop();
  return c.json({ ok: true });
});

// Vonage's Voice API works like Twilio's - our server dynamically returns the next
// call instructions (their format is called an NCCO, JSON instead of TwiML's XML) -
// so this gets the same real menu/hold-music/routing/bridging as Twilio, not just a
// call log. Auth is different though: a short-lived JWT signed with a private key
// tied to an "application", separate from the account-level api_key/api_secret used
// to actually buy/manage numbers.
misc.post('/api/admin/telephony-config/connect-vonage', requireRole('admin'), async (c) => {
  const { api_key, api_secret, application_id, private_key, phone_number } = await c.req.json().catch(() => ({}));
  if (!api_key || !api_secret || !application_id || !private_key || !phone_number) {
    return c.json({ error: 'API Key, API Secret, Application ID, Private Key, and phone number are all required' }, 400);
  }
  try {
    // Verify the account-level credentials first (simple Basic Auth check).
    const acctRes = await fetch('https://rest.nexmo.com/account/get-balance', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${api_key}:${api_secret}`).toString('base64') },
    });
    if (!acctRes.ok) return c.json({ error: 'Vonage rejected the API Key/Secret' }, 400);

    // Verify the application_id + private_key actually produce a valid signed JWT
    // Vonage accepts, by using it to fetch the application itself.
    const jwt = signVonageJwt(application_id, private_key);
    const appRes = await fetch(`https://api.nexmo.com/v1/applications/${application_id}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!appRes.ok) return c.json({ error: 'The Application ID or Private Key is invalid for that application' }, 400);

    const origin = new URL(c.req.url).origin;
    // Point the application's voice webhooks at our server.
    const updateAppRes = await fetch(`https://api.nexmo.com/v1/applications/${application_id}`, {
      method: 'PUT',
      headers: { Authorization: 'Basic ' + Buffer.from(`${api_key}:${api_secret}`).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Frap Ties Call Routing',
        capabilities: {
          voice: {
            webhooks: {
              answer_url: { address: `${origin}/api/telephony/vonage/answer`, http_method: 'POST' },
              event_url: { address: `${origin}/api/telephony/vonage/event`, http_method: 'POST' },
            },
          },
        },
      }),
    });
    if (!updateAppRes.ok) return c.json({ error: 'Verified the credentials, but Vonage rejected the webhook update' }, 400);

    // Link the number to this application.
    const numberRes = await fetch('https://rest.nexmo.com/number/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ api_key, api_secret, country: phone_number.slice(0, 2), msisdn: phone_number, app_id: application_id }),
    });
    // Don't hard-fail on this one - number linking can fail for reasons unrelated to
    // credential validity (e.g. country code guess wrong), and the number can be
    // linked manually in the Vonage dashboard if needed.
    const numberLinked = numberRes.ok;

    const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
    const cfg = row ? JSON.parse(row.value) : {};
    cfg.provider = 'vonage';
    cfg.vonage_api_key = api_key;
    cfg.vonage_application_id = application_id;
    cfg.vonage_number = phone_number;
    cfg.vonage_connected = true;
    await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
    await sql`INSERT INTO settings (key, value) VALUES ('vonage_api_secret', ${api_secret}) ON CONFLICT (key) DO UPDATE SET value = ${api_secret}`;
    await sql`INSERT INTO settings (key, value) VALUES ('vonage_private_key', ${private_key}) ON CONFLICT (key) DO UPDATE SET value = ${private_key}`;
    return c.json({ ok: true, number_linked: numberLinked });
  } catch (err: any) {
    return c.json({ error: 'Network error reaching Vonage: ' + (err?.message || 'unknown') }, 502);
  }
});
misc.post('/api/admin/telephony-config/disconnect-vonage', requireRole('admin'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  const cfg = row ? JSON.parse(row.value) : {};
  cfg.vonage_connected = false;
  cfg.vonage_api_key = null;
  cfg.vonage_application_id = null;
  cfg.vonage_number = null;
  await sql`INSERT INTO settings (key, value) VALUES ('telephony_config', ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  await sql`DELETE FROM settings WHERE key IN ('vonage_api_secret', 'vonage_private_key')`;
  return c.json({ ok: true });
});

// The only way to hear the ACTUAL Twilio voice (not the browser approximation) —
// places a real outbound call from the connected number to whatever number the
// admin enters, playing the exact same greeting TwiML a real caller would hear.
misc.post('/api/admin/telephony-config/test-call', requireRole('admin'), async (c) => {
  const { to_number } = await c.req.json().catch(() => ({}));
  if (!to_number) return c.json({ error: 'Enter a phone number to call' }, 400);
  const [cfgRow] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
  const cfg = cfgRow ? JSON.parse(cfgRow.value) : {};
  if (!cfg.twilio_connected) return c.json({ error: 'Connect Twilio first' }, 400);
  const [tokenRow] = await sql`SELECT value FROM settings WHERE key = 'twilio_auth_token'`;
  if (!tokenRow) return c.json({ error: 'No Twilio credentials stored — reconnect Twilio' }, 400);

  const authHeader = 'Basic ' + Buffer.from(`${cfg.twilio_account_sid}:${tokenRow.value}`).toString('base64');
  const origin = new URL(c.req.url).origin;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.twilio_account_sid)}/Calls.json`,
      {
        method: 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          To: to_number,
          From: cfg.twilio_phone_number,
          Url: `${origin}/api/telephony/inbound`,
          Method: 'POST',
        }),
      }
    );
    if (!res.ok) {
      const errBody: any = await res.json().catch(() => ({}));
      return c.json({ error: errBody.message || ('Twilio rejected the call (status ' + res.status + ')') }, 400);
    }
    return c.json({ ok: true });
  } catch (err: any) {
    return c.json({ error: 'Network error reaching Twilio: ' + (err?.message || 'unknown') }, 502);
  }
});

misc.get('/api/branding', async (c) => {
  // Try to resolve the tenant from: 1) authenticated user, 2) slug header/query, 3) global default
  let tenantName: string | null = null;
  let tenantLogo: string | null = null;
  // Check auth header for logged-in user
  const userId = c.req.header('x-user-id');
  const userPin = c.req.header('x-user-pin');
  if (userId && userPin) {
    const [u] = await sql`SELECT tenant_id FROM users WHERE id = ${userId} AND pin = ${userPin} LIMIT 1`;
    if (u?.tenant_id) {
      const [t] = await sql`SELECT panel_name, panel_logo FROM tenants WHERE id = ${u.tenant_id}`;
      tenantName = t?.panel_name || null;
      tenantLogo = t?.panel_logo || null;
    }
  }
  // Also check slug from query param (used on login screen before auth)
  const slug = c.req.query('slug');
  if (!tenantName && slug) {
    const [t] = await sql`SELECT panel_name, panel_logo FROM tenants WHERE slug = ${slug} LIMIT 1`;
    tenantName = t?.panel_name || null;
    tenantLogo = t?.panel_logo || null;
  }
  // Fall back to global setting
  if (!tenantName) {
    const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
    tenantName = row?.value || 'ClearPanel';
  }
  if (!tenantLogo) {
    const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_logo'`;
    tenantLogo = row?.value || null;
  }
  return c.json({ data: { name: tenantName, logo: tenantLogo } });
});
misc.post('/api/admin/branding', requireManager, async (c) => {
  const user = c.get('user');
  const { name, logo } = await c.req.json().catch(() => ({}));
  if (logo && logo.length > 550000) return c.json({ error: 'Logo image too large' }, 400);
  if (name !== undefined) {
    await sql`UPDATE tenants SET panel_name = ${name} WHERE id = ${user.tenant_id}`;
    // Also update global setting for the self-tenant
    const [self] = await sql`SELECT is_self FROM tenants WHERE id = ${user.tenant_id}`;
    if (self?.is_self) await sql`INSERT INTO settings (key, value) VALUES ('panel_name', ${name}) ON CONFLICT (key) DO UPDATE SET value = ${name}`;
  }
  if (logo !== undefined) {
    await sql`UPDATE tenants SET panel_logo = ${logo} WHERE id = ${user.tenant_id}`;
    const [self] = await sql`SELECT is_self FROM tenants WHERE id = ${user.tenant_id}`;
    if (self?.is_self) await sql`INSERT INTO settings (key, value) VALUES ('panel_logo', ${logo}) ON CONFLICT (key) DO UPDATE SET value = ${logo}`;
  }
  return c.json({ ok: true });
});

misc.get('/api/master/store-checkout-url', requireSuperAdmin(), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'store_checkout_url'`;
  return c.json({ data: { url: row?.value || '' } });
});
misc.post('/api/master/store-checkout-url', requireSuperAdmin(), async (c) => {
  const { url } = await c.req.json().catch(() => ({}));
  if (!url) return c.json({ error: 'URL required' }, 400);
  await sql`INSERT INTO settings (key, value) VALUES ('store_checkout_url', ${url}) ON CONFLICT (key) DO UPDATE SET value = ${url}`;
  return c.json({ ok: true });
});

misc.get('/api/push/vapid-key', (c) => c.json({ data: { key: VAPID_PUBLIC_KEY } }));

misc.post('/api/push/subscribe', async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { subscription } = await c.req.json().catch(() => ({}));
  if (!subscription) return c.json({ error: 'subscription required' }, 400);
  await saveSubscription(user.id, subscription);
  return c.json({ ok: true });
});

misc.post('/api/push/unsubscribe', async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await removeSubscription(user.id);
  return c.json({ ok: true });
});

misc.get('/api/call-template', requireRole('admin', 'caller', 'finisher'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'call_template'`;
  return c.json({ data: { template: row?.value || '' } });
});
misc.post('/api/admin/call-template', requireRole('admin'), async (c) => {
  const { template } = await c.req.json().catch(() => ({}));
  if (typeof template !== 'string') return c.json({ error: 'template required' }, 400);
  await sql`INSERT INTO settings (key, value) VALUES ('call_template', ${template}) ON CONFLICT (key) DO UPDATE SET value = ${template}`;
  return c.json({ ok: true });
});

misc.get('/api/goal', async (c) => {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('goal_target', 'goal_label')`;
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  const goalUser = c.get('user');
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM leads WHERE (status IN ('completed') OR outcome = 'successful_call') AND tenant_id = ${goalUser.tenant_id}`;
  return c.json({ data: { label: map.goal_label || 'Successful calls', target: Number(map.goal_target || 50), current: count } });
});

misc.post('/api/admin/goal', requireRole('admin'), async (c) => {
  const { label, target } = await c.req.json().catch(() => ({}));
  if (label !== undefined) await sql`INSERT INTO settings (key, value) VALUES ('goal_label', ${label}) ON CONFLICT (key) DO UPDATE SET value = ${label}`;
  if (target !== undefined) await sql`INSERT INTO settings (key, value) VALUES ('goal_target', ${String(target)}) ON CONFLICT (key) DO UPDATE SET value = ${String(target)}`;
  return c.json({ ok: true });
});

misc.get('/api/events', async (c) => {
  const user = await authenticate(c);
  const userId = user?.id || 0;
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const client = registerClient(userId, (msg: string) => controller.enqueue(encoder.encode(msg)));
        client.write(': connected\n\n');
        const keepAlive = setInterval(() => { try { client.write(': ping\n\n'); } catch {} }, 25000);
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          unregisterClient(client);
          try { controller.close(); } catch {}
        });
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } }
  );
});

// ============ IN-APP UPDATES ============
import { requireAdmin, requireAnyStaff } from '../auth';

misc.get('/api/updates/active', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const rows = await sql`
    SELECT id, title, body, is_live, created_at FROM panel_updates
    WHERE tenant_id = ${user.tenant_id} AND resolved_at IS NULL
    ORDER BY is_live DESC, created_at DESC LIMIT 5`;
  return c.json({ data: rows });
});

misc.get('/api/updates', requireAdmin, async (c) => {
  const user = c.get('user');
  const rows = await sql`
    SELECT p.*, u.name as posted_by_name FROM panel_updates p
    LEFT JOIN users u ON u.id = p.posted_by
    WHERE p.tenant_id = ${user.tenant_id}
    ORDER BY p.created_at DESC LIMIT 50`;
  return c.json({ data: rows });
});

misc.post('/api/updates', requireAdmin, async (c) => {
  const user = c.get('user');
  const { title, body, is_live } = await c.req.json().catch(() => ({}));
  if (!title || !body) return c.json({ error: 'Title and body required' }, 400);
  const [row] = await sql`
    INSERT INTO panel_updates (tenant_id, title, body, is_live, posted_by)
    VALUES (${user.tenant_id}, ${title}, ${body}, ${!!is_live}, ${user.id})
    RETURNING id, title, body, is_live, created_at`;
  return c.json({ data: row });
});

misc.post('/api/updates/:id/resolve', requireAdmin, async (c) => {
  const user = c.get('user');
  await sql`UPDATE panel_updates SET resolved_at = now()
    WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  return c.json({ ok: true });
});

misc.delete('/api/updates/:id', requireAdmin, async (c) => {
  const user = c.get('user');
  await sql`DELETE FROM panel_updates WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  return c.json({ ok: true });
});
