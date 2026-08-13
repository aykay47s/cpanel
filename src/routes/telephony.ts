import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate } from '../auth';
import { broadcast, notify } from '../realtime';
import * as threecx from '../threecx';

export const telephony = new Hono();

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getSelfTenantId(): Promise<number | null> {
  const [row] = await sql`SELECT id FROM tenants WHERE is_self = true`;
  return row?.id ?? null;
}
// Twilio/Vonage inbound routing is currently only ever wired to the self
// tenant's origin (see the note on /api/telephony/inbound below) - so the
// config it reads is scoped to the self tenant's key specifically, matching
// the tenant-scoped storage every admin-facing telephony route now uses.
// This was a single global, unscoped key until it was found that every
// tenant could see and overwrite every other tenant's Twilio/3CX/Vonage
// credentials through it.
async function getTelephonyConfig() {
  const selfId = await getSelfTenantId();
  const [row] = await sql`SELECT value FROM settings WHERE key = ${'telephony_config:' + selfId}`;
  return row ? JSON.parse(row.value) : { menu_options: [], hold_music_url: null, ring_behavior: 'keep_ringing', greeting_name: null };
}
async function getPanelName() {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'panel_name'`;
  return row?.value || 'us';
}
// Ordered list of who's actually eligible to receive an inbound call right now —
// respects the admin's "everyone" vs "selected callers only" setting, calls
// higher-priority (lower number) callers first, and never bridges an inbound call
// to someone already mid-outbound-call — max one call per caller at a time.
async function getEligibleCallers(cfg: any, tenantId?: number | null) {
  const mode = cfg.inbound_mode || 'everyone';
  const tid = tenantId ?? await getSelfTenantId();
  const base = mode === 'selected'
    ? sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != '' AND inbound_eligible = true AND tenant_id = ${tid}
        AND id NOT IN (SELECT assigned_caller_id FROM leads WHERE status IN ('calling','active_call') AND assigned_caller_id IS NOT NULL)
        ORDER BY inbound_priority ASC, id ASC`
    : sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != '' AND tenant_id = ${tid}
        AND id NOT IN (SELECT assigned_caller_id FROM leads WHERE status IN ('calling','active_call') AND assigned_caller_id IS NOT NULL)
        ORDER BY inbound_priority ASC, id ASC`;
  return await base;
}
// How many other calls are currently mid-routing (ringing) ahead of this one —
// used to tell the caller their real position, not a fake number.
async function getQueuePosition(excludeCallSid: string) {
  const [row] = await sql`SELECT COUNT(*)::int as n FROM inbound_calls WHERE status = 'ringing' AND twilio_call_sid != ${excludeCallSid}`;
  return (row?.n || 0) + 1;
}

// The first thing Twilio hits when someone calls the connected number. Reads the
// configured menu options and builds the <Gather> prompt dynamically.
telephony.post('/api/telephony/inbound', async (c) => {
  const cfg = await getTelephonyConfig();
  const body = await c.req.parseBody().catch(() => ({}));
  const callSid = String((body as any).CallSid || '');
  const from = String((body as any).From || '');
  // Twilio's connect flow currently always configures the webhook against the
  // self tenant's origin - full per-tenant Twilio routing (a distinct webhook per
  // resold tenant, same pattern as the 3CX slug route) is a separate, larger task
  // since it'd need every function in this file parameterized by tenant, not just
  // the inbound_calls insert.
  const tenantId = await getSelfTenantId();

  if (callSid && tenantId) {
    const [existingCall] = await sql`SELECT 1 FROM inbound_calls WHERE twilio_call_sid = ${callSid}`;
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, tenant_id) VALUES (${callSid}, ${from}, 'ringing', ${tenantId}) ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid, from }, tenantId);
    if (!existingCall) await identifyAndAlertForInboundCall(from, tenantId, 'twilio').catch(() => {});
  }

  // Says whatever name is configured in Call Routing (falls back to the panel
  // branding name if nothing's set specifically for the phone greeting).
  const greetingName = cfg.greeting_name || await getPanelName();
  const options = cfg.menu_options || [];
  const promptParts = options.map((o: any) => `Press ${o.digit} for ${o.label}.`).join(' ');
  const prompt = options.length
    ? `Thanks for calling ${greetingName}. ${promptParts}`
    : `Thanks for calling ${greetingName}. Please hold while we connect you.`;

  if (!options.length) {
    // No menu configured — skip straight to finding an available caller.
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${esc(prompt)}</Say>
  <Redirect method="POST">/api/telephony/gather</Redirect>
</Response>`;
    return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
  }

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" action="/api/telephony/gather" method="POST" timeout="8">
    <Say voice="Polly.Amy">${esc(prompt)}</Say>
  </Gather>
  <Say voice="Polly.Amy">Sorry, I didn't get that.</Say>
  <Redirect method="POST">/api/telephony/inbound</Redirect>
</Response>`;

  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
});

// Twilio hits this after the caller presses a digit (the Gather's action URL).
telephony.post('/api/telephony/gather', async (c) => {
  const body = await c.req.parseBody().catch(() => ({}));
  const digit = String((body as any).Digits || '');
  const callSid = String((body as any).CallSid || '');
  return routeCall(c, digit, callSid);
});

async function routeCall(c: any, digit: string, callSid: string) {
  const cfg = await getTelephonyConfig();
  const option = (cfg.menu_options || []).find((o: any) => o.digit === digit);
  const label = option ? option.label : 'General';

  if (callSid) {
    await sql`UPDATE inbound_calls SET menu_selection = ${label} WHERE twilio_call_sid = ${callSid}`;
  }

  // Who's actually eligible to take this call, in priority order — respects the
  // admin's everyone/selected-callers setting.
  const callers = await getEligibleCallers(cfg);

  if (!callers.length) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Sorry, nobody is available to take your call right now. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
    return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
  }

  // Real queue position — how many other calls are currently being routed —
  // announced only when there's genuinely someone ahead, not a fake reassurance.
  const position = callSid ? await getQueuePosition(callSid) : 1;
  const queueSay = position > 1
    ? `<Say voice="Polly.Amy">You are number ${position} in the queue.</Say>`
    : '';

  const holdSay = cfg.hold_music_url
    ? `<Play>${esc(cfg.hold_music_url)}</Play>`
    : `<Say voice="Polly.Amy">Please hold while we connect you.</Say>`;

  // Twilio evaluates one <Dial> per response — for true "try the next person if
  // this one doesn't answer" behavior, each attempt's action webhook re-enters
  // this flow with the next caller in the list (see /dial-result below).
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${queueSay}
  ${holdSay}
  <Dial timeout="20" action="/api/telephony/dial-result?next=1&amp;digit=${encodeURIComponent(digit)}" method="POST">
    <Number>${esc(callers[0].call_phone)}</Number>
  </Dial>
</Response>`;

  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
}

// Called after each individual dial attempt. If unanswered, tries the next
// available caller; Twilio's DialCallStatus tells us what happened.
telephony.post('/api/telephony/dial-result', async (c) => {
  const body = await c.req.parseBody().catch(() => ({}));
  const dialStatus = String((body as any).DialCallStatus || '');
  const callSid = String((body as any).CallSid || '');
  const digit = c.req.query('digit') || '';
  const nextIndex = parseInt(c.req.query('next') || '1', 10);

  if (dialStatus === 'completed') {
    // Someone answered and the call has already happened — nothing more to do.
    return c.text(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`, 200, { 'Content-Type': 'text/xml' });
  }

  const cfg = await getTelephonyConfig();
  const callers = await getEligibleCallers(cfg);
  if (nextIndex >= callers.length) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Sorry, nobody was able to take your call. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
    if (callSid) await sql`UPDATE inbound_calls SET status = 'missed' WHERE twilio_call_sid = ${callSid}`;
    return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
  }

  const holdSay = cfg.hold_music_url ? `<Play>${esc(cfg.hold_music_url)}</Play>` : '';
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${holdSay}
  <Dial timeout="20" action="/api/telephony/dial-result?next=${nextIndex + 1}&amp;digit=${encodeURIComponent(digit)}" method="POST">
    <Number>${esc(callers[nextIndex].call_phone)}</Number>
  </Dial>
</Response>`;
  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
});

// Overall call status (answered, completed, no-answer, busy, failed) for logging.
telephony.post('/api/telephony/status', async (c) => {
  const body = await c.req.parseBody().catch(() => ({}));
  const callSid = String((body as any).CallSid || '');
  const status = String((body as any).CallStatus || '');
  const duration = (body as any).CallDuration ? parseInt(String((body as any).CallDuration), 10) : null;
  if (callSid) {
    const [updated] = await sql`UPDATE inbound_calls SET status = ${status}, duration_seconds = ${duration}, ended_at = now() WHERE twilio_call_sid = ${callSid} RETURNING tenant_id`;
    if (updated) broadcast('inbound_call_update', { callSid, status }, updated.tenant_id);
  }
  return c.text('', 200);
});

// ================= TELNYX CALL CONTROL (webhook-driven IVR) =================
// Telnyx doesn't return TwiML; it sends events and we drive the call with API
// commands. This mirrors the Twilio IVR exactly: greet -> gather menu digit ->
// dial eligible callers in priority order, trying the next on no-answer -> log.
// State between webhooks travels in base64 client_state (dial index + digit).

async function getTelnyxKey(tenantId: number | null): Promise<string | null> {
  const [row] = await sql`SELECT value FROM settings WHERE key = ${'telnyx_api_key:' + tenantId}`;
  // Fall back to a server-level key (env) when the tenant hasn't stored one — lets
  // the self-tenant's telephony work from config alone, no in-panel connect step.
  return row?.value || process.env.TELNYX_API_KEY || null;
}

// Issue a single Call Control command. action is e.g. 'answer', 'gather_using_speak',
// 'transfer', 'hangup', 'speak'. Non-fatal on failure — Telnyx will hang up itself.
async function telnyxCommand(apiKey: string, callControlId: string, action: string, body: any = {}) {
  try {
    const res = await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callControlId)}/actions/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

function encodeState(obj: any): string { return Buffer.from(JSON.stringify(obj)).toString('base64'); }
function decodeState(s: string | undefined | null): any {
  if (!s) return {};
  try { return JSON.parse(Buffer.from(s, 'base64').toString('utf-8')); } catch { return {}; }
}

telephony.post('/api/telephony/telnyx/webhook', async (c) => {
  // Always 200 fast — Telnyx retries any non-200 webhook, which would replay the IVR.
  const body = await c.req.json().catch(() => ({} as any));
  const data = body?.data || {};
  const eventType: string = data.event_type || '';
  const payload = data.payload || {};
  const callControlId: string = payload.call_control_id || '';
  const from: string = payload.from || '';
  const state = decodeState(payload.client_state);

  const tenantId = await getSelfTenantId();
  const apiKey = await getTelnyxKey(tenantId);
  // Without a key we can't send commands; ack so Telnyx stops retrying.
  if (!apiKey || !callControlId) return c.json({ ok: true });

  const cfg = await getTelephonyConfig();

  // --- New inbound call: log it, alert, and answer ---
  if (eventType === 'call.initiated') {
    if (tenantId) {
      const [existing] = await sql`SELECT 1 FROM inbound_calls WHERE twilio_call_sid = ${callControlId}`;
      await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider, tenant_id) VALUES (${callControlId}, ${from}, 'ringing', 'telnyx', ${tenantId}) ON CONFLICT (twilio_call_sid) DO NOTHING`;
      broadcast('inbound_call', { callSid: callControlId, from }, tenantId);
      if (!existing) await identifyAndAlertForInboundCall(from, tenantId, 'telnyx').catch(() => {});
    }
    await telnyxCommand(apiKey, callControlId, 'answer', { client_state: encodeState({ stage: 'greet' }) });
    return c.json({ ok: true });
  }

  // --- Call answered: present the menu (or go straight to routing if no menu) ---
  if (eventType === 'call.answered') {
    const greetingName = cfg.greeting_name || await getPanelName();
    const options = cfg.menu_options || [];
    if (options.length) {
      const promptParts = options.map((o: any) => `Press ${o.digit} for ${o.label}.`).join(' ');
      await telnyxCommand(apiKey, callControlId, 'gather_using_speak', {
        payload: `Thanks for calling ${greetingName}. ${promptParts}`,
        voice: 'female', language: 'en-US',
        valid_digits: options.map((o: any) => o.digit).join(''),
        max_digits: 1, timeout_millis: 8000,
        client_state: encodeState({ stage: 'menu' }),
      });
    } else {
      // No menu — greet then route to first available caller.
      await telnyxCommand(apiKey, callControlId, 'speak', {
        payload: `Thanks for calling ${greetingName}. Please hold while we connect you.`,
        voice: 'female', language: 'en-US',
      });
      await telnyxDialNext(apiKey, callControlId, cfg, '', 0, tenantId);
    }
    return c.json({ ok: true });
  }

  // --- Caller pressed a menu digit ---
  if (eventType === 'call.gather.ended') {
    const digit = payload.digits || '';
    const option = (cfg.menu_options || []).find((o: any) => o.digit === digit);
    const label = option ? option.label : 'General';
    await sql`UPDATE inbound_calls SET menu_selection = ${label} WHERE twilio_call_sid = ${callControlId}`;
    await telnyxDialNext(apiKey, callControlId, cfg, digit, 0, tenantId);
    return c.json({ ok: true });
  }

  // --- A dial attempt (transfer) finished. If the agent didn't pick up, try next. ---
  if (eventType === 'call.hangup') {
    // hangup_cause 'normal_clearing' after a bridged call = completed; otherwise
    // if we were mid-dial, advance to the next caller.
    if (state.stage === 'dialing' && typeof state.dialIndex === 'number') {
      const wasBridged = payload.hangup_source === 'callee' && state.bridged;
      if (!wasBridged) {
        // The call itself may already be gone; only advance while the inbound leg lives.
        const [live] = await sql`SELECT status FROM inbound_calls WHERE twilio_call_sid = ${callControlId}`;
        if (live && live.status === 'ringing') {
          await telnyxDialNext(apiKey, callControlId, cfg, state.digit || '', (state.dialIndex || 0) + 1, tenantId);
          return c.json({ ok: true });
        }
      }
    }
    const dur = payload.call_duration_secs ? parseInt(String(payload.call_duration_secs), 10) : null;
    const [updated] = await sql`UPDATE inbound_calls SET status = 'completed', duration_seconds = ${dur}, ended_at = now() WHERE twilio_call_sid = ${callControlId} AND status != 'completed' RETURNING tenant_id`;
    if (updated) broadcast('inbound_call_update', { callSid: callControlId, status: 'completed' }, updated.tenant_id);
    return c.json({ ok: true });
  }

  // Any other event (call.bridged, speak.ended, etc.) — just acknowledge.
  return c.json({ ok: true });
});

// Transfer the inbound call to the Nth eligible caller. On no-answer, the
// resulting call.hangup re-enters the webhook and advances the index.
async function telnyxDialNext(apiKey: string, callControlId: string, cfg: any, digit: string, index: number, tenantId: number | null) {
  const callers = await getEligibleCallers(cfg, tenantId);
  if (!callers.length || index >= callers.length) {
    await telnyxCommand(apiKey, callControlId, 'speak', {
      payload: index >= callers.length && callers.length
        ? 'Sorry, nobody was able to take your call. Please try again shortly.'
        : 'Sorry, nobody is available to take your call right now. Please try again shortly.',
      voice: 'female', language: 'en-US',
    });
    await sql`UPDATE inbound_calls SET status = 'missed' WHERE twilio_call_sid = ${callControlId} AND status = 'ringing'`;
    await telnyxCommand(apiKey, callControlId, 'hangup', {});
    return;
  }
  const target = callers[index].call_phone;
  const fromNumber = cfg.telnyx_phone_number || process.env.TELNYX_PHONE_NUMBER || undefined;
  await telnyxCommand(apiKey, callControlId, 'transfer', {
    to: target,
    from: fromNumber,
    timeout_secs: 20,
    client_state: encodeState({ stage: 'dialing', dialIndex: index, digit }),
  });
}

// ================= 3CX CALL CONTROL (live socket) =================
// Live health of the PBX connection. The panel polls this on the telephony tab so
// a dead socket or expired API client is visible immediately rather than being
// discovered from a week of missed calls.
telephony.get('/api/admin/telephony/3cx/status', requireRole('admin'), async (c) => {
  return c.json({ data: threecx.status });
});

// Every DN the API client is allowed to see — the admin picks their Route Point
// from this rather than typing a number blind.
telephony.get('/api/admin/telephony/3cx/dns', requireRole('admin'), async (c) => {
  try {
    return c.json({ data: await threecx.listDns() });
  } catch (err: any) {
    return c.json({ error: err?.message || 'Could not read DNs from 3CX' }, 502);
  }
});

telephony.post('/api/admin/telephony/3cx/reconnect', requireRole('admin'), async (c) => {
  await threecx.restart();
  return c.json({ data: threecx.status });
});

// Routing settings that only apply to the call control engine.
telephony.post('/api/admin/telephony/3cx/routing', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { route_point, ring_seconds, fallback } = await c.req.json().catch(() => ({} as any));
  const cfgKey = 'telephony_config:' + user.tenant_id;
  const [row] = await sql`SELECT value FROM settings WHERE key = ${cfgKey}`;
  const cfg = row ? JSON.parse(row.value) : {};
  if (route_point !== undefined) cfg.threecx_route_point = route_point || null;
  if (ring_seconds !== undefined) cfg.threecx_ring_seconds = Math.max(5, Math.min(120, parseInt(ring_seconds, 10) || 20));
  if (fallback !== undefined) cfg.threecx_fallback = fallback || null;
  await sql`INSERT INTO settings (key, value) VALUES (${cfgKey}, ${JSON.stringify(cfg)}) ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(cfg)}`;
  await threecx.restart(); // route point changes decide what the socket listens to
  return c.json({ data: cfg });
});

// Click-to-call through the PBX: rings the logged-in user's own extension first,
// then dials the lead — the only order V20 allows.
telephony.post('/api/telephony/3cx/call', async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ error: 'Not authenticated' }, 401);
  const { destination } = await c.req.json().catch(() => ({} as any));
  const [row] = await sql`SELECT threecx_extension FROM users WHERE id = ${user.id}`;
  if (!row?.threecx_extension) return c.json({ error: 'No 3CX extension is mapped to your account' }, 400);
  if (!destination) return c.json({ error: 'No destination number' }, 400);
  try {
    return c.json({ data: await threecx.makeCall(row.threecx_extension, destination) });
  } catch (err: any) {
    return c.json({ error: err?.message || '3CX rejected the call' }, 502);
  }
});

telephony.get('/api/admin/inbound-calls', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const rows = await sql`SELECT * FROM inbound_calls WHERE tenant_id = ${user.tenant_id} ORDER BY created_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

// FALLBACK PATH ONLY. Live routing now runs over the Call Control API socket in
// src/threecx.ts — this webhook remains for PBXs where the API client can't be
// given a Route Point (Basic/Free editions, or a locked-down hosted instance), in
// which case it still logs the call and pops the lead, it just can't route.
// Configured inside 3CX's own admin console (Integrations > Webhooks, or via the
// Call Flow Designer's HTTP action) to point at this URL — 3CX pushes call events
// here rather than us polling or receiving TwiML-style instructions back. Payload
// shape is based on 3CX's documented webhook format; field names can vary slightly
// by 3CX version, so this reads defensively rather than assuming one exact schema.
// Matches an inbound caller's number against existing leads so admins get a live
// "screen pop" of who's calling, and alerts whichever callers are actually set up
// to handle inbound calls (same inbound_eligible/priority list used for Twilio/
// Vonage routing) that a known lead is calling in right now - since 3CX itself has
// no way to know who's free in our system, this is what "someone intercept" means
// in practice for 3CX specifically: a heads-up, not an automatic transfer.
async function identifyAndAlertForInboundCall(from: string, tenantId: number, provider: string) {
  if (!from) return;
  const digitsOnly = from.replace(/[^\d]/g, '');
  if (digitsOnly.length < 7) return;
  const [lead] = await sql`SELECT * FROM leads WHERE tenant_id = ${tenantId} AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + digitsOnly.slice(-9)} ORDER BY updated_at DESC LIMIT 1`;
  if (!lead) return;

  broadcast('caller_identified', { lead, from, provider }, tenantId);

  const cfg = await getTelephonyConfig();
  const eligible = cfg.inbound_mode === 'selected'
    ? await sql`SELECT id FROM users WHERE tenant_id = ${tenantId} AND role = 'caller' AND clocked_in = true AND inbound_eligible = true ORDER BY inbound_priority ASC`
    : await sql`SELECT id FROM users WHERE tenant_id = ${tenantId} AND role = 'caller' AND clocked_in = true ORDER BY inbound_priority ASC`;
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'A known lead';
  for (const u of eligible) {
    await notify(u.id, 'inbound_call', `${name} is calling in now (${from}) — heads up.`, lead.id);
  }
}

async function handle3cxWebhook(c: any, tenantId: number) {
  const body = await c.req.json().catch(() => ({} as any));
  const callId = String(body.call_id || body.callid || body.id || '');
  const eventType = String(body.event_type || body.event || body.status || '').toLowerCase();
  const from = String(body.from || body.caller_id || body.caller || '');

  if (!callId) return c.json({ ok: true }); // nothing usable to log, don't error out 3CX's webhook

  if (['ringing', 'incoming', 'new', 'start'].some(k => eventType.includes(k))) {
    const [existingConfig] = await sql`SELECT 1 FROM inbound_calls WHERE twilio_call_sid = ${callId}`;
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider, tenant_id) VALUES (${callId}, ${from}, 'ringing', '3cx', ${tenantId}) ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid: callId, from }, tenantId);
    if (!existingConfig) {
      // Only look up + alert once per call, not on every duplicate ringing event
      // some 3CX configurations send.
      await identifyAndAlertForInboundCall(from, tenantId, '3cx').catch(() => {});
    }
  } else {
    await sql`UPDATE inbound_calls SET status = ${eventType || 'unknown'}, ended_at = CASE WHEN ${eventType} IN ('ended','completed','hangup','missed') THEN now() ELSE ended_at END WHERE twilio_call_sid = ${callId} AND provider = '3cx'`;
    broadcast('inbound_call_update', { callSid: callId, status: eventType }, tenantId);
  }
  return c.json({ ok: true });
}

// Backward-compatible path with no slug - resolves to the operator's own (self)
// tenant, since that's what was already configured in any existing 3CX connection
// before per-tenant routing existed.
telephony.post('/api/telephony/3cx-webhook', async (c) => {
  const [tenantRow] = await sql`SELECT id FROM tenants WHERE is_self = true`;
  if (!tenantRow) return c.json({ ok: true });
  return handle3cxWebhook(c, tenantRow.id);
});
// Per-tenant path - this is what each resold tenant's own 3CX connection actually
// gets shown and should configure, so their inbound calls resolve to THEIR data,
// not the operator's.
telephony.post('/api/telephony/3cx-webhook/:slug', async (c) => {
  const [tenantRow] = await sql`SELECT id FROM tenants WHERE slug = ${c.req.param('slug')} AND status = 'active'`;
  if (!tenantRow) return c.json({ ok: true });
  return handle3cxWebhook(c, tenantRow.id);
});

// ================= VONAGE (full parity with Twilio — real menu, hold music,
// routing, and bridging, all controlled dynamically from this server) =================
// Vonage's answer_url can be called as GET or POST depending on how the application
// is configured — read from both query and body to handle either.
async function vonageParams(c: any) {
  const query = c.req.query();
  const body = await c.req.json().catch(() => ({}));
  return { ...query, ...body };
}

telephony.all('/api/telephony/vonage/answer', async (c) => {
  const params = await vonageParams(c);
  const callUuid = String(params.conversation_uuid || params.uuid || '');
  const from = String(params.from || '');
  const tenantId = await getSelfTenantId(); // same self-tenant scoping note as the Twilio handler above

  if (callUuid && tenantId) {
    const [existingCall] = await sql`SELECT 1 FROM inbound_calls WHERE twilio_call_sid = ${callUuid}`;
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider, tenant_id) VALUES (${callUuid}, ${from}, 'ringing', 'vonage', ${tenantId}) ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid: callUuid, from }, tenantId);
    if (!existingCall) await identifyAndAlertForInboundCall(from, tenantId, 'vonage').catch(() => {});
  }

  const cfg = await getTelephonyConfig();
  const greetingName = cfg.greeting_name || await getPanelName();
  const options = cfg.menu_options || [];
  const promptParts = options.map((o: any) => `Press ${o.digit} for ${o.label}.`).join(' ');
  const text = options.length
    ? `Thanks for calling ${greetingName}. ${promptParts}`
    : `Thanks for calling ${greetingName}. Please hold while we connect you.`;

  const ncco = options.length
    ? [
        { action: 'talk', text, voiceName: 'Amy' },
        { action: 'input', type: ['dtmf'], dtmf: { maxDigits: 1, timeOut: 8 }, eventUrl: [`${new URL(c.req.url).origin}/api/telephony/vonage/dtmf`] },
      ]
    : [{ action: 'talk', text, voiceName: 'Amy' }, ...(await vonageRouteNcco(c, '', callUuid))];

  return c.json(ncco);
});

telephony.all('/api/telephony/vonage/dtmf', async (c) => {
  const params = await vonageParams(c);
  const callUuid = String(params.conversation_uuid || params.uuid || '');
  const digit = String(params.dtmf || (params.digits && params.digits[0]) || '');
  const ncco = await vonageRouteNcco(c, digit, callUuid);
  return c.json(ncco);
});

async function vonageRouteNcco(c: any, digit: string, callUuid: string) {
  const cfg = await getTelephonyConfig();
  const option = (cfg.menu_options || []).find((o: any) => o.digit === digit);
  const label = option ? option.label : 'General';
  if (callUuid) await sql`UPDATE inbound_calls SET menu_selection = ${label} WHERE twilio_call_sid = ${callUuid}`;

  const callers = await getEligibleCallers(cfg);
  if (!callers.length) {
    return [{ action: 'talk', text: 'Sorry, nobody is available to take your call right now. Please try again shortly.', voiceName: 'Amy' }];
  }

  const position = callUuid ? await getQueuePosition(callUuid) : 1;
  const ncco: any[] = [];
  if (position > 1) ncco.push({ action: 'talk', text: `You are number ${position} in the queue.`, voiceName: 'Amy' });
  ncco.push(
    cfg.hold_music_url
      ? { action: 'stream', streamUrl: [cfg.hold_music_url] }
      : { action: 'talk', text: 'Please hold while we connect you.', voiceName: 'Amy' }
  );
  // Vonage's "connect" action rings a list of endpoints - unlike Twilio's sequential
  // dial-result retry chain, multiple endpoints here ring simultaneously by default,
  // which actually gets closer to genuine "keep ringing until someone picks up"
  // across the whole team at once, not one at a time.
  ncco.push({
    action: 'connect',
    from: cfg.vonage_number || undefined,
    endpoint: callers.map((cl: any) => ({ type: 'phone', number: cl.call_phone })),
    eventUrl: [`${new URL(c.req.url).origin}/api/telephony/vonage/event`],
  });
  return ncco;
}

telephony.post('/api/telephony/vonage/event', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const callUuid = String(body.conversation_uuid || body.uuid || '');
  const status = String(body.status || '');
  if (callUuid) {
    const isEnded = ['completed', 'failed', 'busy', 'timeout', 'cancelled', 'rejected'].includes(status);
    const [updated] = await sql`UPDATE inbound_calls SET status = ${status || 'unknown'}, duration_seconds = ${body.duration ? parseInt(body.duration, 10) : null}, ended_at = CASE WHEN ${isEnded} THEN now() ELSE ended_at END WHERE twilio_call_sid = ${callUuid} RETURNING tenant_id`.catch(() => [] as any);
    if (updated) broadcast('inbound_call_update', { callSid: callUuid, status }, updated.tenant_id);
  }
  return c.text('', 200);
});

