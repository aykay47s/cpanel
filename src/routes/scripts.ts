import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, requireAnyStaff } from '../auth';

export const scripts = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// Read-only: callers/finishers can VIEW approved scripts during a call. They cannot
// create, edit, or manage them — that surface only exists under /api/admin/*.
scripts.get('/api/scripts', requireAnyStaff, async (c) => {
  const type = c.req.query('type');
  const rows = type
    ? await sql`SELECT id, title, content, lead_type FROM scripts WHERE status = 'approved' AND (lead_type = ${type} OR lead_type = 'general') ORDER BY created_at DESC`
    : await sql`SELECT id, title, content, lead_type FROM scripts WHERE status = 'approved' ORDER BY created_at DESC`;
  return c.json({ data: rows });
});

scripts.get('/api/admin/scripts', requireRole('admin'), async (c) => {
  const rows = await sql`SELECT scripts.*, users.name as submitted_by_name FROM scripts LEFT JOIN users ON users.id = scripts.submitted_by ORDER BY scripts.created_at DESC`;
  return c.json({ data: rows });
});
scripts.post('/api/admin/scripts', requireRole('admin'), async (c) => {
  const { title, content, lead_type } = await c.req.json().catch(() => ({}));
  if (!title || !content) return bad(c, 'Title and content required');
  const [row] = await sql`INSERT INTO scripts (title, content, lead_type, status) VALUES (${title}, ${content}, ${lead_type || 'general'}, 'approved') RETURNING *`;
  return c.json({ data: row });
});
scripts.delete('/api/admin/scripts/:id', requireRole('admin'), async (c) => {
  await sql`DELETE FROM scripts WHERE id = ${c.req.param('id')}`;
  return c.json({ ok: true });
});
