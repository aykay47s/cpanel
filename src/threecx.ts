// ============================================================================
// 3CX Call Control API integration — the real one.
//
// The old 3CX support was passive: 3CX pushed a webhook, we logged the call and
// sent a "heads up, a lead is calling" notification. Nothing actually routed the
// call — a human still had to grab it inside 3CX.
//
// This module drives the call. It holds an authenticated WebSocket to the PBX's
// Call Control API, watches a Route Point DN for inbound legs, matches the caller
// ID against the lead database, then routes the ringing participant to the right
// caller's extension (or external number) using the same eligibility/priority
// rules the Twilio path uses — falling through the list one by one until someone
// answers, and diverting to a fallback destination if nobody does.
//
// API surface used (3CX V20 Call Control API):
//   POST /connect/token                                   OAuth2 client_credentials
//   GET  /callcontrol                                     all DNs + participants
//   GET  /callcontrol/{dn}                                one DN's state
//   GET  /callcontrol/ws                                  event stream (WebSocket)
//   POST /callcontrol/{dn}/participants/{id}/routeto      add a route for a leg
//   POST /callcontrol/{dn}/participants/{id}/divert       replace a ringing leg
//   POST /callcontrol/{dn}/participants/{id}/drop         hang up a leg
//   POST /callcontrol/{dn}/devices/{deviceid}/makecall    outbound click-to-call
//
// IMPORTANT 3CX-side requirement: full control over an inbound call is only
// available on a **Route Point** DN. Inbound rules in 3CX must point the DID at a
// Route Point, and the API client must have that Route Point selected in
// Admin Console > Integrations > API. Extensions and queues only emit events —
// they can't be routed by an external app.
// ============================================================================

import { sql } from './db';
import { broadcast, notify } from './realtime';

// ---------------------------------------------------------------- config ----

export interface ThreecxConfig {
  fqdn: string;
  clientId: string;
  clientSecret: string;
  routePoint: string | null;   // DN the inbound calls land on
  ringSeconds: number;         // how long each caller rings before moving on
  fallback: string | null;     // DN/number to divert to when nobody takes it
  inboundMode: 'everyone' | 'selected';
  enabled: boolean;
}

// Scoped to the self tenant's keys - was a single global, unscoped key until
// it was found that every tenant could see and overwrite every other
// tenant's 3CX credentials through the shared settings table. The live
// socket itself only ever connects for the self tenant (this codebase
// doesn't yet run one socket per resold tenant), so this is the correct
// scope for what's actually live right now, not a narrowing of behavior.
async function loadConfig(): Promise<ThreecxConfig | null> {
  const selfId = await getSelfTenantId();
  const [cfgRow] = await sql`SELECT value FROM settings WHERE key = ${'telephony_config:' + selfId}`;
  const [secretRow] = await sql`SELECT value FROM settings WHERE key = ${'threecx_client_secret:' + selfId}`;
  if (!cfgRow || !secretRow) return null;
  const cfg = JSON.parse(cfgRow.value);
  if (!cfg.threecx_connected || !cfg.threecx_fqdn || !cfg.threecx_client_id) return null;
  return {
    fqdn: String(cfg.threecx_fqdn).replace(/^https?:\/\//, '').replace(/\/$/, ''),
    clientId: cfg.threecx_client_id,
    clientSecret: secretRow.value,
    routePoint: cfg.threecx_route_point || null,
    ringSeconds: Number(cfg.threecx_ring_seconds) > 0 ? Number(cfg.threecx_ring_seconds) : 20,
    fallback: cfg.threecx_fallback || null,
    inboundMode: cfg.inbound_mode === 'selected' ? 'selected' : 'everyone',
    enabled: cfg.provider === '3cx',
  };
}

// ------------------------------------------------------------ live status ---
// Surfaced to the admin panel so the connection isn't a black box — if the PBX
// drops the socket or the credentials stop working, that shows up in the UI
// instead of calls silently going unrouted.

export const status = {
  connected: false,
  connecting: false,
  lastConnectedAt: null as string | null,
  lastEventAt: null as string | null,
  lastError: null as string | null,
  routePoint: null as string | null,
  reconnectAttempts: 0,
  callsRouted: 0,
  callsMissed: 0,
};

// ------------------------------------------------------------------ auth ----

let token: { value: string; expiresAt: number } | null = null;

async function getToken(cfg: ThreecxConfig, force = false): Promise<string> {
  if (!force && token && token.expiresAt > Date.now() + 30_000) return token.value;
  const res = await fetch(`https://${cfg.fqdn}/connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`3CX token request failed (${res.status})`);
  const data: any = await res.json();
  if (!data.access_token) throw new Error('3CX returned no access_token');
  // expires_in is seconds; 3CX defaults to 3600. Refresh a minute early.
  token = { value: data.access_token, expiresAt: Date.now() + ((data.expires_in || 3600) - 60) * 1000 };
  return token.value;
}

// Authenticated REST call against the PBX. Retries once on 401 with a fresh
// token, because the PBX invalidates tokens on restart and a silent 401 loop is
// the single most likely way this integration dies unnoticed.
async function pbx(cfg: ThreecxConfig, path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<any> {
  const attempt = async (bearer: string) =>
    fetch(`https://${cfg.fqdn}${path}`, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${bearer}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

  let res = await attempt(await getToken(cfg));
  if (res.status === 401) res = await attempt(await getToken(cfg, true));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`3CX ${init.method || 'GET'} ${path} → ${res.status}${text ? ': ' + text.slice(0, 200) : ''}`);
  }
  const body = await res.text();
  return body ? JSON.parse(body) : null;
}

// --------------------------------------------------------- lead matching ----

async function getSelfTenantId(): Promise<number | null> {
  const [row] = await sql`SELECT id FROM tenants WHERE is_self = true`;
  return row?.id ?? null;
}

// Matches on the last 9 digits so +44 / 0044 / 0-prefixed variants of the same
// number all resolve to the same lead — the exact same rule the Twilio path uses.
async function findLeadByNumber(from: string, tenantId: number) {
  const digits = String(from || '').replace(/[^\d]/g, '');
  if (digits.length < 7) return null;
  const [lead] = await sql`
    SELECT * FROM leads
    WHERE tenant_id = ${tenantId}
      AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${'%' + digits.slice(-9)}
    ORDER BY updated_at DESC LIMIT 1`;
  return lead || null;
}

// Who can take this call, in the admin's configured order. A caller needs
// somewhere for 3CX to actually ring: their 3CX extension if mapped, otherwise
// their call-from number (which 3CX dials as an external destination — that
// requires an outbound rule on the PBX that permits it).
async function getEligibleCallers(cfg: ThreecxConfig, tenantId: number) {
  const rows = cfg.inboundMode === 'selected'
    ? await sql`SELECT id, name, threecx_extension, call_phone FROM users
        WHERE tenant_id = ${tenantId} AND role IN ('caller','finisher') AND clocked_in = true AND inbound_eligible = true
          AND (COALESCE(threecx_extension,'') != '' OR COALESCE(call_phone,'') != '')
          AND id NOT IN (SELECT assigned_caller_id FROM leads WHERE status IN ('calling','active_call') AND assigned_caller_id IS NOT NULL)
        ORDER BY inbound_priority ASC, id ASC`
    : await sql`SELECT id, name, threecx_extension, call_phone FROM users
        WHERE tenant_id = ${tenantId} AND role IN ('caller','finisher') AND clocked_in = true
          AND (COALESCE(threecx_extension,'') != '' OR COALESCE(call_phone,'') != '')
          AND id NOT IN (SELECT assigned_caller_id FROM leads WHERE status IN ('calling','active_call') AND assigned_caller_id IS NOT NULL)
        ORDER BY inbound_priority ASC, id ASC`;
  return rows.map((u: any) => ({ ...u, destination: u.threecx_extension || u.call_phone }));
}

// ------------------------------------------------------- routing engine -----

// callid → in-flight marker. 3CX re-emits events for the same call constantly
// (every participant state change), so without this the same inbound leg would
// get routed a dozen times over.
const inFlight = new Set<string>();

interface Participant {
  id: number;
  status: string;
  dn: string;
  party_caller_id?: string;
  party_caller_name?: string;
  party_dn?: string;
  party_dn_type?: string;
  party_did?: string;
  callid?: number;
  legid?: number;
  device_id?: string;
}

function isRinging(p: Participant) {
  const s = String(p.status || '').toLowerCase();
  return s === 'ringing' || s === 'dialing' || s === 'connecting';
}

async function handleInboundLeg(cfg: ThreecxConfig, dn: string, p: Participant) {
  const key = `3cx:${p.callid ?? p.id}`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  const tenantId = await getSelfTenantId();
  if (!tenantId) { inFlight.delete(key); return; }

  const from = p.party_caller_id || p.party_dn || '';
  const lead = await findLeadByNumber(from, tenantId);

  await sql`
    INSERT INTO inbound_calls (twilio_call_sid, from_number, status, provider, tenant_id, lead_id, menu_selection)
    VALUES (${key}, ${from}, 'ringing', '3cx', ${tenantId}, ${lead?.id ?? null}, ${p.party_did || null})
    ON CONFLICT (twilio_call_sid) DO NOTHING`;

  broadcast('inbound_call', { callSid: key, from, provider: '3cx', did: p.party_did || null }, tenantId);
  if (lead) broadcast('caller_identified', { lead, from, provider: '3cx' }, tenantId);

  const callers = await getEligibleCallers(cfg, tenantId);

  if (!callers.length) {
    status.callsMissed++;
    await sql`UPDATE inbound_calls SET status = 'no_agents', ended_at = now() WHERE twilio_call_sid = ${key}`;
    broadcast('inbound_call_update', { callSid: key, status: 'no_agents' }, tenantId);
    if (cfg.fallback) {
      await pbx(cfg, `/callcontrol/${encodeURIComponent(dn)}/participants/${p.id}/divert`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'NoDestinations', destination: cfg.fallback, timeout: cfg.ringSeconds }),
      }).catch((e) => console.error('[3cx] fallback divert failed:', e.message));
    }
    // Leave the leg alone if there's no fallback — 3CX's own Route Point failover
    // (voicemail, queue, whatever the PBX is configured to do) still applies.
    inFlight.delete(key);
    return;
  }

  // Sequential hunt. `routeto` resolves when the destination is actually reached,
  // so awaiting it per caller gives real "ring the next person if this one doesn't
  // pick up" behaviour without polling — and the participant stays alive in the
  // meantime, so the person calling in never gets dropped between attempts.
  let attempts = 0;
  for (const caller of callers) {
    attempts++;
    const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(' ') || from || 'Unknown caller';
    try {
      await notify(caller.id, 'inbound_call', `Inbound: ${name} — your phone is ringing now.`, lead?.id);
      broadcast('inbound_ringing', { callSid: key, userId: caller.id, lead: lead || null, from }, tenantId, [caller.id]);

      const result = await pbx(
        cfg,
        `/callcontrol/${encodeURIComponent(dn)}/participants/${p.id}/routeto`,
        {
          method: 'POST',
          body: JSON.stringify({
            reason: lead ? 'BasedOnCallerID' : 'None',
            destination: caller.destination,
            timeout: cfg.ringSeconds,
            attacheddata: {
              panel_lead_id: lead ? String(lead.id) : '',
              panel_user_id: String(caller.id),
              panel_call_key: key,
            },
          }),
        },
        (cfg.ringSeconds + 15) * 1000,
      );

      const final = String(result?.finalstatus || '').toLowerCase();
      const answered = final === 'success' || final === 'connected' || final === 'ok' || final === '';

      if (answered) {
        status.callsRouted++;
        await sql`UPDATE inbound_calls SET status = 'answered', routed_to_user_id = ${caller.id}, answered_at = now(), route_attempts = ${attempts} WHERE twilio_call_sid = ${key}`;
        broadcast('inbound_call_update', { callSid: key, status: 'answered', userId: caller.id }, tenantId);

        // Hand the lead to whoever picked up, so the panel opens on the right
        // record instead of the caller hunting for it mid-conversation.
        if (lead) {
          await sql`UPDATE leads SET assigned_caller_id = ${caller.id}, status = 'active_call', call_started_at = now(), updated_at = now()
                    WHERE id = ${lead.id} AND (assigned_caller_id IS NULL OR status NOT IN ('calling','active_call'))`;
          broadcast('lead_updated', { id: lead.id }, tenantId);
        }
        inFlight.delete(key);
        return;
      }
      console.log(`[3cx] ${caller.name} did not take call ${key} (${final || 'no status'}), trying next`);
    } catch (err: any) {
      console.error(`[3cx] routeto ${caller.destination} failed:`, err.message);
    }
  }

  // Nobody took it.
  status.callsMissed++;
  await sql`UPDATE inbound_calls SET status = 'missed', route_attempts = ${attempts}, ended_at = now() WHERE twilio_call_sid = ${key}`;
  broadcast('inbound_call_update', { callSid: key, status: 'missed' }, tenantId);
  if (cfg.fallback) {
    await pbx(cfg, `/callcontrol/${encodeURIComponent(dn)}/participants/${p.id}/divert`, {
      method: 'POST',
      body: JSON.stringify({ reason: 'NoAnswer', destination: cfg.fallback, timeout: cfg.ringSeconds }),
    }).catch((e) => console.error('[3cx] fallback divert failed:', e.message));
  }
  inFlight.delete(key);
}

async function markLegEnded(key: string) {
  inFlight.delete(key);
  const [row] = await sql`SELECT status, tenant_id FROM inbound_calls WHERE twilio_call_sid = ${key}`;
  if (!row) return;
  const stillOpen = ['ringing'].includes(row.status);
  await sql`UPDATE inbound_calls
            SET status = ${stillOpen ? 'abandoned' : row.status},
                ended_at = COALESCE(ended_at, now()),
                duration_seconds = COALESCE(duration_seconds, EXTRACT(EPOCH FROM (now() - created_at))::int)
            WHERE twilio_call_sid = ${key}`;
  broadcast('inbound_call_update', { callSid: key, status: stillOpen ? 'abandoned' : row.status }, row.tenant_id);
}

// ----------------------------------------------------------- event stream ---

// Entity paths look like: /callcontrol/{dn}/participants/{id}
function parseEntity(entity: string): { dn: string; participantId: string | null } | null {
  const m = /^\/callcontrol\/([^/]+)(?:\/participants\/([^/]+))?/.exec(entity || '');
  if (!m) return null;
  return { dn: decodeURIComponent(m[1]), participantId: m[2] ? decodeURIComponent(m[2]) : null };
}

async function handleEvent(cfg: ThreecxConfig, raw: string) {
  status.lastEventAt = new Date().toISOString();
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return; }

  const evt = msg?.event;
  if (!evt?.entity) return;

  const parsed = parseEntity(evt.entity);
  if (!parsed || !parsed.participantId) return;

  // Only act on the configured Route Point. Without one set we'd be reacting to
  // every extension's every call on the whole PBX.
  if (cfg.routePoint && parsed.dn !== cfg.routePoint) return;

  // event_type 1 = the entity was removed (leg gone). Anything else is an
  // insert/update, and 3CX's own guidance is to re-fetch rather than trust the
  // event payload, which is frequently just a pointer with null attached_data.
  if (Number(evt.event_type) === 1) {
    // We don't get the callid on a remove, so resolve it from the leg id we tracked.
    for (const key of Array.from(inFlight)) {
      if (key.endsWith(`:${parsed.participantId}`)) await markLegEnded(key);
    }
    return;
  }

  let participant: Participant | null = null;
  try {
    participant = await pbx(cfg, `/callcontrol/${encodeURIComponent(parsed.dn)}/participants/${parsed.participantId}`);
  } catch {
    return; // leg vanished between the event and the fetch — normal, ignore
  }
  if (!participant) return;

  // An inbound leg is one that's ringing on the route point and came from
  // outside — an internal extension calling the route point isn't a lead.
  const external = String(participant.party_dn_type || '').toLowerCase().includes('external')
    || !participant.party_dn
    || /^\+?\d{7,}$/.test(String(participant.party_caller_id || '').replace(/[^\d+]/g, ''));

  if (isRinging(participant) && external) {
    await handleInboundLeg(cfg, parsed.dn, participant).catch((e) =>
      console.error('[3cx] inbound handling failed:', e.message));
  }
}

// --------------------------------------------------------- supervisor -------

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let stopped = true;

function scheduleReconnect(delayMs?: number) {
  if (stopped) return;
  if (reconnectTimer) return;
  status.reconnectAttempts++;
  const wait = delayMs ?? Math.min(30_000, 2_000 * Math.pow(2, Math.min(4, status.reconnectAttempts)));
  reconnectTimer = setTimeout(() => { reconnectTimer = null; connect().catch(() => {}); }, wait);
}

async function connect() {
  if (stopped || status.connecting || status.connected) return;
  const cfg = await loadConfig();
  if (!cfg || !cfg.enabled) { status.lastError = 'Not configured'; return; }

  status.connecting = true;
  status.routePoint = cfg.routePoint;

  try {
    const bearer = await getToken(cfg);
    // Bun's WebSocket client accepts custom headers — required here, since the
    // Call Control socket authenticates with the same bearer token as REST and
    // has no query-string auth alternative.
    ws = new WebSocket(`wss://${cfg.fqdn}/callcontrol/ws`, {
      headers: { Authorization: `Bearer ${bearer}` },
    } as any);

    ws.onopen = () => {
      status.connected = true;
      status.connecting = false;
      status.lastError = null;
      status.lastConnectedAt = new Date().toISOString();
      status.reconnectAttempts = 0;
      // Subscribe to the whole call-control tree; the PBX only sends events for
      // the DNs this API client was granted in the 3CX admin console anyway.
      ws?.send(JSON.stringify({ RequestID: 'panel-init', Path: '/callcontrol' }));
      console.log('[3cx] call control socket connected');
      // Pick up anything already ringing when we (re)connect — a restart mid-call
      // shouldn't leave a live caller stranded.
      sweep(cfg).catch(() => {});
    };

    ws.onmessage = (e: MessageEvent) => {
      const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data as any);
      handleEvent(cfg, data).catch((err) => console.error('[3cx] event error:', err?.message));
    };

    ws.onerror = (e: any) => {
      status.lastError = e?.message || 'WebSocket error';
    };

    ws.onclose = () => {
      status.connected = false;
      status.connecting = false;
      ws = null;
      console.log('[3cx] socket closed, reconnecting');
      scheduleReconnect();
    };
  } catch (err: any) {
    status.connecting = false;
    status.connected = false;
    status.lastError = err?.message || 'Connection failed';
    console.error('[3cx] connect failed:', status.lastError);
    scheduleReconnect();
  }
}

// Catch-up pass: reads current state straight from the PBX instead of waiting for
// the next event. Used on connect, and by the heartbeat as a liveness probe.
async function sweep(cfg: ThreecxConfig) {
  const dns: any[] = cfg.routePoint
    ? [await pbx(cfg, `/callcontrol/${encodeURIComponent(cfg.routePoint)}`)]
    : await pbx(cfg, '/callcontrol');
  for (const dn of dns.filter(Boolean)) {
    for (const p of dn.participants || []) {
      if (isRinging(p)) await handleInboundLeg(cfg, dn.dn, p).catch(() => {});
    }
  }
}

export async function start() {
  stopped = false;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  // If the socket goes quiet for two minutes, prove the connection is real with a
  // cheap REST call and reconnect if it isn't. Silent half-open sockets are the
  // classic failure mode here and they look identical to "a quiet phone day".
  heartbeatTimer = setInterval(async () => {
    if (stopped) return;
    if (!status.connected) { scheduleReconnect(0); return; }
    const quietFor = Date.now() - new Date(status.lastEventAt || status.lastConnectedAt || 0).getTime();
    if (quietFor < 120_000) return;
    const cfg = await loadConfig();
    if (!cfg) return;
    try { await sweep(cfg); status.lastEventAt = new Date().toISOString(); }
    catch (e: any) {
      status.lastError = e?.message || 'Heartbeat failed';
      try { ws?.close(); } catch {}
      status.connected = false;
      scheduleReconnect(0);
    }
  }, 60_000);
  await connect();
}

export function stop() {
  stopped = true;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  try { ws?.close(); } catch {}
  ws = null;
  token = null;
  inFlight.clear();
  status.connected = false;
  status.connecting = false;
  status.routePoint = null;
}

// Called after the admin saves new credentials or changes the route point, so
// changes take effect without a redeploy.
export async function restart() {
  stop();
  status.reconnectAttempts = 0;
  await start();
}

// ------------------------------------------------------- admin helpers ------

// Every DN the API client can see, so the admin picks their Route Point from a
// list instead of typing an extension number and hoping.
export async function listDns() {
  const cfg = await loadConfig();
  if (!cfg) throw new Error('3CX is not connected');
  const dns: any[] = await pbx(cfg, '/callcontrol');
  return (dns || []).map((d: any) => ({
    dn: d.dn,
    type: d.type,
    devices: (d.devices || []).length,
    activeParticipants: (d.participants || []).length,
  }));
}

// Outbound click-to-call: rings the caller's own 3CX extension first, then dials
// the lead when they pick up — the standard V20 flow (the internal party always
// has to be called first).
export async function makeCall(extension: string, destination: string, timeoutSec = 30) {
  const cfg = await loadConfig();
  if (!cfg) throw new Error('3CX is not connected');
  const devices: any[] = await pbx(cfg, `/callcontrol/${encodeURIComponent(extension)}/devices`);
  const deviceId = devices?.[0]?.device_id;
  const path = deviceId
    ? `/callcontrol/${encodeURIComponent(extension)}/devices/${encodeURIComponent(deviceId)}/makecall`
    : `/callcontrol/${encodeURIComponent(extension)}/makecall`;
  return pbx(cfg, path, { method: 'POST', body: JSON.stringify({ destination, timeout: timeoutSec }) });
}

// Verifies credentials AND that the Call Control API is actually reachable —
// a token alone doesn't prove the API client has any DNs assigned to it, which
// is the most common reason a "connected" 3CX integration does nothing.
export async function verify(fqdn: string, clientId: string, clientSecret: string) {
  const cfg: ThreecxConfig = {
    fqdn: fqdn.replace(/^https?:\/\//, '').replace(/\/$/, ''),
    clientId, clientSecret, routePoint: null, ringSeconds: 20,
    fallback: null, inboundMode: 'everyone', enabled: true,
  };
  await getToken(cfg, true);
  const dns: any[] = await pbx(cfg, '/callcontrol');
  return {
    dns: (dns || []).map((d: any) => ({ dn: d.dn, type: d.type })),
    routePoints: (dns || []).filter((d: any) => String(d.type || '').toLowerCase().includes('routepoint')).map((d: any) => d.dn),
  };
}
