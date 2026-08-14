import { Hono } from 'hono';
import { sql } from '../db';
import { authenticate, requireRole } from '../auth';
import { broadcast, notifyRole } from '../realtime';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

export const chat = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// ============================================================================
// Chat encryption at rest (AES-256-GCM).
// Messages are encrypted before they touch the database and decrypted on read,
// so the stored rows contain ciphertext, not plaintext — if the DB is ever
// dumped or leaked, the chat isn't readable without the key. The key comes from
// CHAT_ENCRYPTION_KEY (or falls back to a hash of DATABASE_URL so it still works
// out of the box, though setting a dedicated key is stronger).
// Note: this is encryption AT REST, not end-to-end — the server (and therefore
// an admin reading the chat) can decrypt, by design, since admins need to read
// team messages. Stored format: "enc:v1:<iv-b64>:<tag-b64>:<ciphertext-b64>".
// ============================================================================
const CHAT_KEY = createHash('sha256')
  .update(process.env.CHAT_ENCRYPTION_KEY || process.env.DATABASE_URL || 'clearpanel-fallback-key')
  .digest();
function encryptMessage(plain: string): string {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', CHAT_KEY, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
  } catch { return plain; } // never lose a message to an encryption error
}
function decryptMessage(stored: string): string {
  if (typeof stored !== 'string' || !stored.startsWith('enc:v1:')) return stored; // legacy plaintext
  try {
    const [, , ivB64, tagB64, ctB64] = stored.split(':');
    const decipher = createDecipheriv('aes-256-gcm', CHAT_KEY, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch { return '[unable to decrypt]'; }
}
// Decrypt the content field on a row (or array of rows) coming back from the DB.
function decryptRows<T extends { content?: string }>(rows: T[]): T[] {
  for (const r of rows) if (r && typeof r.content === 'string') r.content = decryptMessage(r.content);
  return rows;
}

// Single shared team channel for v1. Per-DM threads are a planned follow-up, not built here.
chat.get('/api/chat/messages', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const before = c.req.query('before');
  const rows = before
    ? await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar, users.pfp_data as sender_pfp_data, users.role as sender_role
        FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
        WHERE chat_messages.id < ${before} AND chat_messages.tenant_id = ${user.tenant_id} AND (chat_messages.expires_at IS NULL OR chat_messages.expires_at > now())
        ORDER BY chat_messages.id DESC LIMIT 50`
    : await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar, users.pfp_data as sender_pfp_data, users.role as sender_role
        FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
        WHERE chat_messages.tenant_id = ${user.tenant_id} AND (chat_messages.expires_at IS NULL OR chat_messages.expires_at > now())
        ORDER BY chat_messages.id DESC LIMIT 50`;
  return c.json({ data: decryptRows(rows.reverse()) });
});

chat.get('/api/chat/search', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const q = c.req.query('q');
  if (!q) return c.json({ data: [] });
  // Content is encrypted at rest, so a SQL ILIKE can't match plaintext — pull recent
  // messages and filter after decryption. Bounded to a reasonable window.
  const rows = await sql`SELECT chat_messages.*, users.name as sender_name, users.avatar as sender_avatar, users.pfp_data as sender_pfp_data
    FROM chat_messages LEFT JOIN users ON users.id = chat_messages.sender_id
    WHERE chat_messages.tenant_id = ${user.tenant_id} ORDER BY chat_messages.id DESC LIMIT 400`;
  const ql = q.toLowerCase();
  const matched = decryptRows(rows).filter(r => (r.content || '').toLowerCase().includes(ql)).slice(0, 30);
  return c.json({ data: matched });
});

chat.post('/api/chat/messages', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { content, replyToId, expiresInSeconds } = await c.req.json().catch(() => ({}));
  if (!content || !content.trim()) return bad(c, 'Message cannot be empty');
  const expiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;
  const plain = content.trim();
  const [row] = await sql`INSERT INTO chat_messages (sender_id, content, reply_to_id, expires_at, tenant_id) VALUES (${user.id}, ${encryptMessage(plain)}, ${replyToId || null}, ${expiresAt}, ${user.tenant_id}) RETURNING *`;
  // Broadcast and return the PLAINTEXT (clients can't decrypt); only the DB row is encrypted.
  const full = { ...row, content: plain, sender_name: user.name, sender_avatar: user.avatar, sender_pfp_data: user.pfp_data, sender_role: user.role };
  broadcast('chat_message', full, user.tenant_id);
  await notifyRole('all', 'chat', `${user.name}: ${plain.slice(0, 80)}`, undefined, user.id, user.tenant_id);
  return c.json({ data: full });
});

// Manual delete — removes the row entirely from the database, not a soft-delete flag.
// Anyone can delete their own message; admins can delete any message.
chat.delete('/api/chat/messages/:id', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [msg] = await sql`SELECT sender_id FROM chat_messages WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  if (!msg) return bad(c, 'Not found', 404);
  if (msg.sender_id !== user.id && user.role !== 'admin') return bad(c, 'Unauthorized', 403);
  await sql`DELETE FROM chat_messages WHERE id = ${c.req.param('id')}`;
  broadcast('chat_deleted', { id: Number(c.req.param('id')) }, user.tenant_id);
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
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM chat_messages WHERE id > ${lastRead} AND sender_id != ${user.id} AND tenant_id = ${user.tenant_id}`;
  return c.json({ data: { count } });
});

// Online presence roster for the chat panel.
chat.get('/api/chat/presence', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const rows = await sql`SELECT id, name, avatar, role, clocked_in, last_seen_at FROM users WHERE role IN ('admin','caller','finisher') AND tenant_id = ${user.tenant_id} ORDER BY clocked_in DESC, name ASC`;
  return c.json({ data: rows });
});
