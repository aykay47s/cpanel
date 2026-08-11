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
  const [user] = await sql`SELECT id, name, pin, role, avatar, pfp_data, xp, clocked_in FROM users WHERE pin = ${pin}`;
  if (!user) return bad(c, 'Invalid PIN', 401);
  return c.json({ data: user });
});

users.get('/api/me', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [fresh] = await sql`SELECT id, name, pin, role, avatar, pfp_data, xp, clocked_in, notif_prefs FROM users WHERE id = ${user.id}`;
  return c.json({ data: fresh });
});

users.patch('/api/me/profile', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { name, avatar, call_phone, pfp_data } = await c.req.json().catch(() => ({}));
  // Guard against oversized payloads — client resizes to a small square before sending,
  // but enforce a hard cap server-side too (roughly 400KB of base64).
  if (pfp_data && pfp_data.length > 550000) return bad(c, 'Image too large');
  const [row] = await sql`UPDATE users SET
    name = COALESCE(${name || null}, name),
    avatar = COALESCE(${avatar || null}, avatar),
    call_phone = COALESCE(${call_phone !== undefined ? call_phone : null}, call_phone),
    pfp_data = COALESCE(${pfp_data !== undefined ? pfp_data : null}, pfp_data)
    WHERE id = ${user.id} RETURNING id, name, pin, role, avatar, pfp_data, xp, clocked_in, call_phone`;
  return c.json({ data: row });
});

users.post('/api/me/remove-pfp', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [row] = await sql`UPDATE users SET pfp_data = NULL WHERE id = ${user.id} RETURNING id, name, pin, role, avatar, pfp_data, xp, clocked_in, call_phone`;
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
  const [current] = await sql`SELECT clocked_in FROM users WHERE id = ${user.id}`;

  if (clockedIn && !current.clocked_in) {
    // Starting a new session — prevent duplicate active sessions.
    const [openSession] = await sql`SELECT id FROM clock_sessions WHERE user_id = ${user.id} AND clocked_out_at IS NULL`;
    if (!openSession) await sql`INSERT INTO clock_sessions (user_id) VALUES (${user.id})`;
  } else if (!clockedIn && current.clocked_in) {
    // Ending the session — close whichever one is still open (handles refresh/reconnect drift).
    await sql`UPDATE clock_sessions SET clocked_out_at = now(), duration_seconds = EXTRACT(EPOCH FROM (now() - clocked_in_at))::int
      WHERE user_id = ${user.id} AND clocked_out_at IS NULL`;
  }
  await sql`UPDATE users SET clocked_in = ${!!clockedIn}, status = ${clockedIn ? 'online' : 'offline'}, last_seen_at = now() WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

users.get('/api/clock/status', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [session] = await sql`SELECT clocked_in_at FROM clock_sessions WHERE user_id = ${user.id} AND clocked_out_at IS NULL`;
  return c.json({ data: { clockedInAt: session?.clocked_in_at || null } });
});

users.get('/api/admin/clock-sessions', requireRole('admin'), async (c) => {
  const userId = c.req.query('userId');
  const rows = userId
    ? await sql`SELECT clock_sessions.*, users.name FROM clock_sessions LEFT JOIN users ON users.id = clock_sessions.user_id WHERE clock_sessions.user_id = ${userId} ORDER BY clocked_in_at DESC LIMIT 100`
    : await sql`SELECT clock_sessions.*, users.name FROM clock_sessions LEFT JOIN users ON users.id = clock_sessions.user_id ORDER BY clocked_in_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

users.get('/api/lead-categories', async (c) => {
  const rows = await sql`SELECT * FROM lead_categories ORDER BY name ASC`;
  return c.json({ data: rows });
});
users.post('/api/admin/lead-categories', requireRole('admin'), async (c) => {
  const { name, color } = await c.req.json().catch(() => ({}));
  if (!name) return bad(c, 'Name required');
  const [row] = await sql`INSERT INTO lead_categories (name, color) VALUES (${name}, ${color || '#4f8cff'}) RETURNING *`;
  return c.json({ data: row });
});
users.delete('/api/admin/lead-categories/:id', requireRole('admin'), async (c) => {
  await sql`DELETE FROM lead_categories WHERE id = ${c.req.param('id')}`;
  return c.json({ ok: true });
});

// ================= ADMIN: ROSTER =================
users.get('/api/admin/users', requireRole('admin'), async (c) => {
  const rows = await sql`
    SELECT users.id, users.name, users.pin, users.role, users.avatar, users.pfp_data, users.xp, users.clocked_in, users.status,
      users.call_phone, users.inbound_eligible, users.inbound_priority, users.created_at, users.last_seen_at,
      active_lead.first_name as active_lead_first_name, active_lead.last_name as active_lead_last_name, active_lead.status as active_lead_status
    FROM users
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, status FROM leads
      WHERE assigned_caller_id = users.id AND status IN ('calling','active_call') LIMIT 1
    ) active_lead ON true
    ORDER BY users.created_at DESC`;
  return c.json({ data: rows });
});

users.patch('/api/admin/users/:id/inbound-settings', requireRole('admin'), async (c) => {
  const { inbound_eligible, inbound_priority } = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');
  if (inbound_eligible !== undefined) await sql`UPDATE users SET inbound_eligible = ${inbound_eligible} WHERE id = ${id}`;
  if (inbound_priority !== undefined) await sql`UPDATE users SET inbound_priority = ${inbound_priority} WHERE id = ${id}`;
  const [row] = await sql`SELECT id, name, inbound_eligible, inbound_priority FROM users WHERE id = ${id}`;
  return c.json({ data: row });
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
  await sql`UPDATE leads SET uploaded_by = NULL WHERE uploaded_by = ${id}`;
  await sql`DELETE FROM clock_sessions WHERE user_id = ${id}`;
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${id}`;
  await sql`DELETE FROM chat_reads WHERE user_id = ${id}`;
  await sql`UPDATE chat_messages SET sender_id = NULL WHERE sender_id = ${id}`;
  await sql`UPDATE lead_events SET actor_id = NULL WHERE actor_id = ${id}`;
  await sql`UPDATE scripts SET submitted_by = NULL WHERE submitted_by = ${id}`;
  await sql`UPDATE announcements SET created_by = NULL WHERE created_by = ${id}`;
  await sql`UPDATE duplicate_flags SET reviewed_by = NULL WHERE reviewed_by = ${id}`;
  await sql`DELETE FROM notifications WHERE user_id = ${id}`;
  await sql`DELETE FROM users WHERE id = ${id}`;
  return c.json({ ok: true });
});

users.get('/api/leaderboard', async (c) => {
  const rows = await sql`
    SELECT users.id, users.name, users.avatar, users.pfp_data, users.role, users.xp,
      COUNT(*) FILTER (WHERE lead_events.event_type = 'outcome_recorded' AND lead_events.to_status = 'successful_call' AND lead_events.actor_id = users.id) as successful_calls
    FROM users
    LEFT JOIN lead_events ON lead_events.actor_id = users.id
    WHERE users.role IN ('caller','finisher')
    GROUP BY users.id, users.name, users.avatar, users.pfp_data, users.role, users.xp
    ORDER BY users.xp DESC
  `;
  return c.json({ data: rows });
});
