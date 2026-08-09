import { sql } from './db';

interface Client { userId: number; write: (msg: string) => void; }
const clients = new Set<Client>();

export function registerClient(userId: number, write: (msg: string) => void): Client {
  const client = { userId, write };
  clients.add(client);
  return client;
}
export function unregisterClient(client: Client) { clients.delete(client); }

// Broadcast to everyone, or a filtered subset via userIds.
export function broadcast(event: string, data: unknown, userIds?: number[]) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    if (userIds && !userIds.includes(c.userId)) continue;
    try { c.write(msg); } catch {}
  }
}

// Creates a persistent notification row AND pushes it live over SSE in one call.
export async function notify(userId: number, type: string, content: string, relatedLeadId?: number) {
  const [row] = await sql`INSERT INTO notifications (user_id, type, content, related_lead_id) VALUES (${userId}, ${type}, ${content}, ${relatedLeadId || null}) RETURNING *`;
  broadcast('notification', row, [userId]);
  return row;
}

export async function notifyRole(role: 'admin' | 'caller' | 'finisher' | 'all', type: string, content: string, relatedLeadId?: number, excludeUserId?: number) {
  const users = role === 'all'
    ? await sql`SELECT id FROM users`
    : await sql`SELECT id FROM users WHERE role = ${role}`;
  for (const u of users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    await notify(u.id, type, content, relatedLeadId);
  }
}
