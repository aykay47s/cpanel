import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate } from '../auth';

export const users = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }
function genPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

// ================= AUTH =================
users.post('/api/auth/login', async (c) => {
  const { pin } = await c.req.json().catch(() => ({}));
  if (!pin) return bad(c, 'PIN required');
  const [user] = await sql`SELECT id, name, pin, role, avatar, xp, clocked_in FROM users WHERE pin = ${pin}`;
  if (!user) return bad(c, 'Invalid PIN', 401);
  return c.json({ data: user });
});

users.get('/api/me', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [fresh] = await sql`SELECT id, name, pin, role, avatar, xp, clocked_in, notif_prefs FROM users WHERE id = ${user.id}`;
  return c.json({ data: fresh });
});

users.patch('/api/me/profile', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { name, avatar } = await c.req.json().catch(() => ({}));
  const [row] = await sql`UPDATE users SET name = COALESCE(${name || null}, name), avatar = COALESCE(${avatar || null}, avatar) WHERE id = ${user.id} RETURNING id, name, pin, role, avatar, xp, clocked_in`;
  return c.json({ data: row });
});

users.patch('/api/me/notif-prefs', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const prefs = await c.req.json().catch(() => ({}));
  await sql`UPDATE users SET notif_prefs = ${sql.json(prefs)} WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

users.post('/api/clock', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { clockedIn } = await c.req.json().catch(() => ({}));
  await sql`UPDATE users SET clocked_in = ${!!clockedIn}, status = ${clockedIn ? 'online' : 'offline'}, last_seen_at = now() WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

// ================= ADMIN: ROSTER =================
users.get('/api/admin/users', requireRole('admin'), async (c) => {
  const rows = await sql`SELECT id, name, pin, role, avatar, xp, clocked_in, status, created_at FROM users ORDER BY created_at DESC`;
  return c.json({ data: rows });
});

users.post('/api/admin/users', requireRole('admin'), async (c) => {
  const { name, role } = await c.req.json().catch(() => ({}));
  if (!name) return bad(c, 'Name is required');
  if (!['caller', 'finisher', 'admin'].includes(role)) return bad(c, 'Invalid role');
  let pin: string, row: any;
  for (let i = 0; i < 8; i++) {
    pin = genPin();
    try { [row] = await sql`INSERT INTO users (name, pin, role) VALUES (${name}, ${pin}, ${role}) RETURNING id, name, pin, role`; break; } catch {}
  }
  if (!row) return bad(c, 'Could not generate a unique PIN, try again', 500);
  return c.json({ data: row });
});

users.post('/api/admin/users/:id/role', requireRole('admin'), async (c) => {
  const { role } = await c.req.json().catch(() => ({}));
  if (!['caller', 'finisher', 'admin'].includes(role)) return bad(c, 'Invalid role');
  await sql`UPDATE users SET role = ${role} WHERE id = ${c.req.param('id')}`;
  return c.json({ ok: true });
});

users.delete('/api/admin/users/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  await sql`UPDATE leads SET assigned_caller_id = NULL WHERE assigned_caller_id = ${id}`;
  await sql`UPDATE leads SET assigned_finisher_id = NULL WHERE assigned_finisher_id = ${id}`;
  await sql`DELETE FROM users WHERE id = ${id}`;
  return c.json({ ok: true });
});

users.get('/api/leaderboard', async (c) => {
  const rows = await sql`
    SELECT users.id, users.name, users.avatar, users.role, users.xp,
      COUNT(*) FILTER (WHERE lead_events.event_type = 'outcome_recorded' AND lead_events.to_status = 'successful_call' AND lead_events.actor_id = users.id) as successful_calls
    FROM users
    LEFT JOIN lead_events ON lead_events.actor_id = users.id
    WHERE users.role IN ('caller','finisher')
    GROUP BY users.id, users.name, users.avatar, users.role, users.xp
    ORDER BY users.xp DESC
  `;
  return c.json({ data: rows });
});
