import { sql } from './db';
import { sendPush } from './push';

interface Client { userId: number; tenantId: number | null; write: (msg: string) => void; }
const clients = new Set<Client>();

export function registerClient(userId: number, tenantId: number | null, write: (msg: string) => void): Client {
  const client = { userId, tenantId, write };
  clients.add(client);
  return client;
}
export function unregisterClient(client: Client) { clients.delete(client); }

// Broadcast to a tenant's connected clients only, or a filtered subset within
// that tenant via userIds. tenantId is required, not optional — every event
// carries a full data payload (lead details, chat content, phone numbers),
// and this used to have no tenant scoping at all: any connected client on
// the entire platform received every event, from every tenant, regardless
// of which panel they were logged into. A caller claiming a lead on one
// tenant's floor would silently push that lead's full details to every
// other tenant's open browser tabs.
export function broadcast(event: string, data: unknown, tenantId: number | null, userIds?: number[]) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (c.tenantId !== tenantId) continue;
    if (userIds && !userIds.includes(c.userId)) continue;
    try { c.write(msg); } catch {}
  }
}

function pushTitleFor(type: string): string {
  if (type === 'chat') return 'New message';
  if (type === 'announcement') return 'Announcement';
  if (type === 'successful_call') return 'Successful call logged';
  return 'Frap Ties';
}
function prefKeyFor(type: string): 'lead_assigned' | 'chat' | 'announcements' {
  if (type === 'chat') return 'chat';
  if (type === 'announcement') return 'announcements';
  return 'lead_assigned';
}

// Creates a persistent notification row, pushes it live over SSE for anyone with the
// app open, AND sends a real OS-level push notification for when it's not - the SSE
// broadcast alone only reaches an open tab, which is exactly why announcements and
// chat weren't actually notifying anyone with the app closed or backgrounded.
export async function notify(userId: number, type: string, content: string, relatedLeadId?: number) {
  const [row] = await sql`INSERT INTO notifications (user_id, type, content, related_lead_id) VALUES (${userId}, ${type}, ${content}, ${relatedLeadId || null}) RETURNING *`;
  const [user] = await sql`SELECT notif_prefs, tenant_id FROM users WHERE id = ${userId}`;
  broadcast('notification', row, user?.tenant_id ?? null, [userId]);
  const prefs = user?.notif_prefs || {};
  const key = prefKeyFor(type);
  if (prefs[key] !== false) {
    await sendPush(userId, pushTitleFor(type), content, relatedLeadId ? '/' : '/');
  }
  return row;
}

export async function notifyRole(role: 'admin' | 'caller' | 'finisher' | 'all', type: string, content: string, relatedLeadId?: number, excludeUserId?: number, tenantId?: number) {
  const users = role === 'all'
    ? (tenantId ? await sql`SELECT id FROM users WHERE tenant_id = ${tenantId}` : await sql`SELECT id FROM users`)
    : (tenantId ? await sql`SELECT id FROM users WHERE role = ${role} AND tenant_id = ${tenantId}` : await sql`SELECT id FROM users WHERE role = ${role}`);
  for (const u of users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    await notify(u.id, type, content, relatedLeadId);
  }
}
