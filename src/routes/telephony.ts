import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole } from '../auth';
import { broadcast, notify } from '../realtime';

export const telephony = new Hono();

function esc(s: string) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function getTelephonyConfig() {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'telephony_config'`;
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
async function getEligibleCallers(cfg: any) {
  const mode = cfg.inbound_mode || 'everyone';
  const base = mode === 'selected'
    ? sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != '' AND inbound_eligible = true
        AND id NOT IN (SELECT assigned_caller_id FROM leads WHERE status IN ('calling','active_call') AND assigned_caller_id IS NOT NULL)
        ORDER BY inbound_priority ASC, id ASC`
    : sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != ''
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

  if (callSid) {
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status) VALUES (${callSid}, ${from}, 'ringing') ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid, from });
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
    await sql`UPDATE inbound_calls SET status = ${status}, duration_seconds = ${duration}, ended_at = now() WHERE twilio_call_sid = ${callSid}`;
    broadcast('inbound_call_update', { callSid, status });
  }
  return c.text('', 200);
});

telephony.get('/api/admin/inbound-calls', requireRole('admin'), async (c) => {
  const rows = await sql`SELECT * FROM inbound_calls ORDER BY created_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

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

  broadcast('caller_identified', { lead, from, provider });

  const cfg = await getTelephonyConfig();
  const eligible = cfg.inbound_mode === 'selected'
    ? await sql`SELECT id FROM users WHERE tenant_id = ${tenantId} AND role = 'caller' AND clocked_in = true AND inbound_eligible = true ORDER BY inbound_priority ASC`
    : await sql`SELECT id FROM users WHERE tenant_id = ${tenantId} AND role = 'caller' AND clocked_in = true ORDER BY inbound_priority ASC`;
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'A known lead';
  for (const u of eligible) {
    await notify(u.id, 'inbound_call', `${name} is calling in now (${from}) — heads up.`, lead.id);
  }
}

telephony.post('/api/telephony/3cx-webhook', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const callId = String(body.call_id || body.callid || body.id || '');
  const eventType = String(body.event_type || body.event || body.status || '').toLowerCase();
  const from = String(body.from || body.caller_id || body.caller || '');

  if (!callId) return c.json({ ok: true }); // nothing usable to log, don't error out 3CX's webhook

  if (['ringing', 'incoming', 'new', 'start'].some(k => eventType.includes(k))) {
    const [existingConfig] = await sql`SELECT 1 FROM inbound_calls WHERE twilio_call_sid = ${callId}`;
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider) VALUES (${callId}, ${from}, 'ringing', '3cx') ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid: callId, from });
    if (!existingConfig) {
      // Only look up + alert once per call, not on every duplicate ringing event
      // some 3CX configurations send.
      // NOTE: 3CX webhook payloads carry no tenant identifier, and this single URL
      // would be shared across any resold tenant's 3CX connection - this currently
      // only correctly resolves the operator's own (self) tenant. Properly
      // supporting multiple tenants each connecting their own 3CX server would need
      // a per-tenant webhook path (e.g. /api/telephony/3cx-webhook/:tenantSlug).
      const [tenantRow] = await sql`SELECT id FROM tenants WHERE is_self = true`;
      if (tenantRow) await identifyAndAlertForInboundCall(from, tenantRow.id, '3cx').catch(() => {});
    }
  } else {
    await sql`UPDATE inbound_calls SET status = ${eventType || 'unknown'}, ended_at = CASE WHEN ${eventType} IN ('ended','completed','hangup','missed') THEN now() ELSE ended_at END WHERE twilio_call_sid = ${callId} AND provider = '3cx'`;
    broadcast('inbound_call_update', { callSid: callId, status: eventType });
  }
  return c.json({ ok: true });
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

  if (callUuid) {
    await sql`INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider) VALUES (${callUuid}, ${from}, 'ringing', 'vonage') ON CONFLICT (twilio_call_sid) DO NOTHING`;
    broadcast('inbound_call', { callSid: callUuid, from });
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
    await sql`UPDATE inbound_calls SET status = ${status || 'unknown'}, duration_seconds = ${body.duration ? parseInt(body.duration, 10) : null}, ended_at = CASE WHEN ${isEnded} THEN now() ELSE ended_at END WHERE twilio_call_sid = ${callUuid}`.catch(() => {});
    broadcast('inbound_call_update', { callSid: callUuid, status });
  }
  return c.text('', 200);
});

