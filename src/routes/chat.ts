import { Hono } from 'hono';
import { sql } from '../db';
import { authenticate, requireRole } from '../auth';
import { broadcast, notifyRole } from '../realtime';

export const chat = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// Single shared team channel for v1. Per-DM threads are a planned follow-up, not built here.
chat.get('/api/chat/messages', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const before = c.req.query('before');
  const rows = before
    ? await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar, users.role as sender_role
        FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
        WHERE chat_messages.id < ${before} AND (chat_messages.expires_at IS NULL OR chat_messages.expires_at > now())
        ORDER BY chat_messages.id DESC LIMIT 50`
    : await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar, users.role as sender_role
        FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
        WHERE chat_messages.expires_at IS NULL OR chat_messages.expires_at > now()
        ORDER BY chat_messages.id DESC LIMIT 50`;
  return c.json({ data: rows.reverse() });
});

chat.get('/api/chat/search', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const q = c.req.query('q');
  if (!q) return c.json({ data: [] });
  const rows = await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar
    FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
    WHERE chat_messages.content ILIKE ${'%' + q + '%'} ORDER BY chat_messages.id DESC LIMIT 30`;
  return c.json({ data: rows });
});

chat.post('/api/chat/messages', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { content, replyToId, expiresInSeconds } = await c.req.json().catch(() => ({}));
  if (!content || !content.trim()) return bad(c, 'Message cannot be empty');
  const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
  const [row] = await sql`INSERT INTO chat_messages (sender_id, content, reply_to_id, expires_at) VALUES (${user.id}, ${content.trim()}, ${replyToId || null}, ${expiresAt}) RETURNING *`;
  const full = { ...row, sender_name: user.name, sender_avatar: user.avatar, sender_role: user.role };
  broadcast('chat_message', full);
  await notifyRole('all', 'chat', `${user.name}: ${content.trim().slice(0, 80)}`, undefined, user.id);
  return c.json({ data: full });
});

// Manual delete — removes the row entirely from the database, not a soft-delete flag.
// Anyone can delete their own message; admins can delete any message.
chat.delete('/api/chat/messages/:id', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [msg] = await sql`SELECT sender_id FROM chat_messages WHERE id = ${c.req.param('id')}`;
  if (!msg) return bad(c, 'Not found', 404);
  if (msg.sender_id !== user.id && user.role !== 'admin') return bad(c, 'Unauthorized', 403);
  await sql`DELETE FROM chat_messages WHERE id = ${c.req.param('id')}`;
  broadcast('chat_deleted', { id: Number(c.req.param('id')) });
  return c.json({ ok: true });
});

chat.post('/api/chat/read', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { lastReadMessageId } = await c.req.json().catch(() => ({}));
  await sql`INSERT INTO chat_reads (user_id, last_read_message_id) VALUES (${user.id}, ${lastReadMessageId || 0})
    ON CONFLICT (user_id) DO UPDATE SET last_read_message_id = GREATEST(chat_reads.last_read_message_id, ${lastReadMessageId || 0})`;
  return c.json({ ok: true });
});

chat.get('/api/chat/unread-count', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [read] = await sql`SELECT last_read_message_id FROM chat_reads WHERE user_id = ${user.id}`;
  const lastRead = read?.last_read_message_id || 0;
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM chat_messages WHERE id > ${lastRead} AND sender_id != ${user.id}`;
  return c.json({ data: { count } });
});

// Online presence roster for the chat panel.
chat.get('/api/chat/presence', async (c) => {
  const rows = await sql`SELECT id, name, avatar, role, clocked_in, last_seen_at FROM users WHERE role IN ('admin','caller','finisher') ORDER BY clocked_in DESC, name ASC`;
  return c.json({ data: rows });
});
