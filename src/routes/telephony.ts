import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole } from '../auth';
import { broadcast } from '../realtime';

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

  // Available callers to try, in order — everyone clocked in with a call-from
  // number set. "Keep ringing until answered" means we try them one after another
  // rather than giving up after one.
  const callers = await sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != ''`;

  if (!callers.length) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Sorry, nobody is available to take your call right now. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
    return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
  }

  const holdSay = cfg.hold_music_url
    ? `<Play>${esc(cfg.hold_music_url)}</Play>`
    : `<Say voice="Polly.Amy">Please hold while we connect you.</Say>`;

  // Twilio evaluates one <Dial> per response — for true "try the next person if
  // this one doesn't answer" behavior, each attempt's action webhook re-enters
  // this flow with the next caller in the list (see /dial-result below).
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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

  const callers = await sql`SELECT id, call_phone FROM users WHERE role = 'caller' AND clocked_in = true AND call_phone IS NOT NULL AND call_phone != ''`;
  if (nextIndex >= callers.length) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">Sorry, nobody was able to take your call. Please try again shortly.</Say>
  <Hangup/>
</Response>`;
    if (callSid) await sql`UPDATE inbound_calls SET status = 'missed' WHERE twilio_call_sid = ${callSid}`;
    return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
  }

  const cfg = await getTelephonyConfig();
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
