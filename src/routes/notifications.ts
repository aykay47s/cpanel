import { Hono } from 'hono';
import { sql } from '../db';
import { authenticate } from '../auth';

export const notifications = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

notifications.get('/api/notifications', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const rows = await sql`SELECT * FROM notifications WHERE user_id = ${user.id} ORDER BY created_at DESC LIMIT 40`;
  return c.json({ data: rows });
});

notifications.get('/api/notifications/unread-count', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM notifications WHERE user_id = ${user.id} AND read = false`;
  return c.json({ data: { count } });
});

notifications.post('/api/notifications/read-all', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  await sql`UPDATE notifications SET read = true WHERE user_id = ${user.id} AND read = false`;
  return c.json({ ok: true });
});

notifications.post('/api/notifications/:id/read', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  await sql`UPDATE notifications SET read = true WHERE id = ${c.req.param('id')} AND user_id = ${user.id}`;
  return c.json({ ok: true });
});
