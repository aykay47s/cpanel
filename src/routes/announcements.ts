import { Hono } from 'hono';
import { sql } from '../db';
import { authenticate, requireRole } from '../auth';
import { broadcast, notifyRole } from '../realtime';

export const announcements = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

announcements.get('/api/announcements', async (c) => {
  const user = await authenticate(c);
  const role = user?.role || 'all';
  const rows = await sql`SELECT announcements.*, users.name as author_name FROM announcements LEFT JOIN users ON users.id = announcements.created_by
    WHERE target_role = 'all' OR target_role = ${role} ORDER BY important DESC, created_at DESC LIMIT 15`;
  return c.json({ data: rows });
});

announcements.get('/api/admin/announcements', requireRole('admin'), async (c) => {
  const rows = await sql`SELECT announcements.*, users.name as author_name FROM announcements LEFT JOIN users ON users.id = announcements.created_by ORDER BY created_at DESC LIMIT 50`;
  return c.json({ data: rows });
});

announcements.post('/api/admin/announcements', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { content, important, target_role } = await c.req.json().catch(() => ({}));
  if (!content) return bad(c, 'Content required');
  const [row] = await sql`INSERT INTO announcements (content, important, target_role, created_by) VALUES (${content}, ${!!important}, ${target_role || 'all'}, ${user.id}) RETURNING *`;
  broadcast('announcement', row);
  await notifyRole(target_role || 'all', 'announcement', content.slice(0, 100), undefined, user.id);
  return c.json({ data: row });
});

announcements.patch('/api/admin/announcements/:id', requireRole('admin'), async (c) => {
  const { content, important, target_role } = await c.req.json().catch(() => ({}));
  const [row] = await sql`UPDATE announcements SET content = COALESCE(${content || null}, content), important = COALESCE(${important ?? null}, important), target_role = COALESCE(${target_role || null}, target_role) WHERE id = ${c.req.param('id')} RETURNING *`;
  broadcast('announcement', row);
  return c.json({ data: row });
});

announcements.delete('/api/admin/announcements/:id', requireRole('admin'), async (c) => {
  await sql`DELETE FROM announcements WHERE id = ${c.req.param('id')}`;
  return c.json({ ok: true });
});
