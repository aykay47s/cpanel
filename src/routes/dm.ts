import { Hono } from 'hono';
import { sql } from '../db';
import { authenticate } from '../auth';
import { broadcast } from '../realtime';

// ============================================================================
// End-to-end encrypted direct messages.
//
// The server is a blind relay here: it stores and forwards ciphertext but never
// holds any private key, so it (and anyone with database access, including an
// admin) cannot read DM contents. Encryption happens entirely in the browser
// with libsodium crypto_box (X25519 key exchange + XSalsa20-Poly1305 AEAD).
//
// Each user publishes a PUBLIC key (dm_public_key); the matching private key
// never leaves their device. A sent message is sealed twice — once to the
// recipient, once back to the sender — so both sides can read the thread, and
// the server still can't read either copy.
// ============================================================================

export const dm = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// Publish (or rotate) my public key so others can encrypt to me.
dm.post('/api/dm/public-key', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { public_key } = await c.req.json().catch(() => ({}));
  if (!public_key || typeof public_key !== 'string' || public_key.length > 200) return bad(c, 'Invalid public key');
  await sql`UPDATE users SET dm_public_key = ${public_key} WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

// Get my own key status (does the server have a public key for me?).
dm.get('/api/dm/my-key', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [row] = await sql`SELECT dm_public_key FROM users WHERE id = ${user.id}`;
  return c.json({ data: { has_key: !!row?.dm_public_key, public_key: row?.dm_public_key || null } });
});

// List people I can DM in my tenant, with their public keys and whether we have
// an existing thread / unread count.
dm.get('/api/dm/contacts', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const rows = await sql`
    SELECT u.id, u.name, u.username, u.avatar, u.pfp_data, u.role, u.dm_public_key,
      (SELECT COUNT(*) FROM direct_messages dmx
        WHERE dmx.recipient_id = ${user.id} AND dmx.sender_id = u.id AND dmx.read_at IS NULL) as unread,
      (SELECT MAX(id) FROM direct_messages dmx
        WHERE (dmx.sender_id = ${user.id} AND dmx.recipient_id = u.id)
           OR (dmx.sender_id = u.id AND dmx.recipient_id = ${user.id})) as last_msg_id
    FROM users u
    WHERE u.tenant_id = ${user.tenant_id} AND u.id != ${user.id} AND u.suspended_at IS NULL
    ORDER BY last_msg_id DESC NULLS LAST, u.name ASC`;
  return c.json({ data: rows });
});

// Fetch a thread with one person. Returns ciphertext only — the client decrypts.
dm.get('/api/dm/thread/:otherId', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const otherId = parseInt(c.req.param('otherId'), 10);
  if (!otherId) return bad(c, 'Bad user');
  // Confirm the other user is in the same tenant (no cross-tenant DM access).
  const [other] = await sql`SELECT id, name, username, avatar, pfp_data, role, dm_public_key FROM users WHERE id = ${otherId} AND tenant_id = ${user.tenant_id}`;
  if (!other) return bad(c, 'User not found', 404);
  const rows = await sql`
    SELECT id, sender_id, recipient_id,
      ciphertext_for_recipient, nonce_for_recipient,
      ciphertext_for_sender, nonce_for_sender,
      sender_ephemeral_pub, read_at, created_at
    FROM direct_messages
    WHERE tenant_id = ${user.tenant_id}
      AND ((sender_id = ${user.id} AND recipient_id = ${otherId})
        OR (sender_id = ${otherId} AND recipient_id = ${user.id}))
    ORDER BY id ASC LIMIT 300`;
  // Mark their messages to me as read.
  await sql`UPDATE direct_messages SET read_at = now() WHERE recipient_id = ${user.id} AND sender_id = ${otherId} AND read_at IS NULL`;
  return c.json({ data: { other, messages: rows } });
});

// Send an encrypted DM. Body carries the two sealed copies; server stores as-is.
dm.post('/api/dm/send', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const b = await c.req.json().catch(() => ({}));
  const recipientId = parseInt(b.recipient_id, 10);
  if (!recipientId) return bad(c, 'Missing recipient');
  const req = ['ciphertext_for_recipient', 'nonce_for_recipient', 'ciphertext_for_sender', 'nonce_for_sender'];
  for (const k of req) if (!b[k] || typeof b[k] !== 'string' || b[k].length > 20000) return bad(c, 'Invalid payload');
  const [recipient] = await sql`SELECT id FROM users WHERE id = ${recipientId} AND tenant_id = ${user.tenant_id}`;
  if (!recipient) return bad(c, 'Recipient not found', 404);
  const [row] = await sql`INSERT INTO direct_messages
    (tenant_id, sender_id, recipient_id, ciphertext_for_recipient, nonce_for_recipient, ciphertext_for_sender, nonce_for_sender, sender_ephemeral_pub)
    VALUES (${user.tenant_id}, ${user.id}, ${recipientId},
      ${b.ciphertext_for_recipient}, ${b.nonce_for_recipient},
      ${b.ciphertext_for_sender}, ${b.nonce_for_sender}, ${b.sender_ephemeral_pub || null})
    RETURNING id, sender_id, recipient_id, ciphertext_for_recipient, nonce_for_recipient, ciphertext_for_sender, nonce_for_sender, sender_ephemeral_pub, created_at`;
  // Notify the recipient in realtime (no content — just that a DM arrived).
  broadcast('dm_message', { id: row.id, sender_id: user.id, recipient_id: recipientId }, user.tenant_id);
  return c.json({ data: row });
});

// Delete a DM I sent (removes both copies — it's one row).
dm.delete('/api/dm/:id', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [msg] = await sql`SELECT sender_id FROM direct_messages WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  if (!msg) return bad(c, 'Not found', 404);
  if (msg.sender_id !== user.id) return bad(c, 'Can only delete your own messages', 403);
  await sql`DELETE FROM direct_messages WHERE id = ${c.req.param('id')}`;
  broadcast('dm_deleted', { id: Number(c.req.param('id')) }, user.tenant_id);
  return c.json({ ok: true });
});
