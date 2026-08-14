import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate, requireAnyStaff } from '../auth';
import { broadcast } from '../realtime';
import { logEvent } from '../audit';
import { rateLimit, clearAttempts, clientIp } from '../ratelimit';

export const users = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }
function genPin() { return String(Math.floor(1000 + Math.random() * 9000)); }

// ================= AUTH =================
users.post('/api/auth/login', async (c) => {
  const { pin, slug } = await c.req.json().catch(() => ({}));
  if (!pin) return bad(c, 'PIN required');
  // Brute-force protection: PINs are short (4-8 digits), so throttle failed login
  // attempts per IP+panel. Without this, all 10k 4-digit PINs are guessable in
  // minutes. 8 tries/minute, then a 5-minute block. Successful login clears it.
  const rlKey = 'login:' + clientIp(c) + ':' + (slug || 'self');
  const rl = rateLimit(rlKey, { windowMs: 60_000, max: 8, blockMs: 300_000 });
  if (rl.limited) return c.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
  // PINs are only unique per-tenant now, not globally - resolve which tenant this
  // login belongs to first. No slug (or an unrecognized one) means the operator's
  // own instance, exactly like before multi-tenancy existed.
  let tenantId: number | null = null;
  if (slug) {
    const [tenant] = await sql`SELECT id, expires_at, name, status, termination_reason FROM tenants WHERE slug = ${slug}`;
    if (!tenant) return bad(c, 'This call center panel could not be found', 404);
    if (tenant.status === 'terminated') {
      return bad(c, tenant.termination_reason ? `This panel has been terminated: ${tenant.termination_reason}` : 'This panel has been terminated. Contact whoever set this up.', 403);
    }
    if (tenant.status !== 'active') return bad(c, 'This call center panel could not be found', 404);
    // This is what actually enforces "access for X days" from a redeemed key -
    // once expires_at has passed, the panel stops being reachable at all, not just
    // visually marked as expired somewhere in Master Control.
    if (tenant.expires_at && new Date(tenant.expires_at) < new Date()) {
      await sql`UPDATE tenants SET status = 'expired' WHERE id = ${tenant.id}`;
      return bad(c, 'Access to this panel has expired. Contact whoever set this up to renew it.', 403);
    }
    tenantId = tenant.id;
  } else {
    const [selfTenant] = await sql`SELECT id FROM tenants WHERE is_self = true`;
    tenantId = selfTenant?.id ?? null;
  }
  const [user] = await sql`SELECT id, name, pin, role, avatar, pfp_data, xp, clocked_in, is_super_admin, tenant_id, suspended_at, suspended_reason, username, telegram_username FROM users WHERE pin = ${pin} AND tenant_id = ${tenantId}`;
  if (!user) return bad(c, 'Invalid PIN', 401);
  if (user.suspended_at) {
    return bad(c, user.suspended_reason ? `Your access has been suspended: ${user.suspended_reason}` : 'Your access has been suspended. Contact your admin.', 403);
  }
  delete (user as any).suspended_at;
  delete (user as any).suspended_reason;
  
  // Check if onboarding is required (missing username or telegram_username)
  const onboarding_required = !user.username || !user.telegram_username;
  // Successful auth — clear the failed-attempt counter for this IP+panel.
  clearAttempts(rlKey);

  return c.json({ data: user, onboarding_required });
});

users.post('/api/onboarding/complete', async (c) => {
  // Save username and telegram_username, only if user is authenticated
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  
  const { username, telegram_username } = await c.req.json().catch(() => ({}));
  
  if (!username || !telegram_username) {
    return bad(c, 'Username and telegram username are required');
  }
  
  // Validate username: alphanumeric, underscore, dash, 2-32 chars
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(username)) {
    return bad(c, 'Username must be 2-32 characters, alphanumeric, underscore, or dash only');
  }
  
  // Validate telegram: starts with @, alphanumeric and underscore, 5-32 chars
  let tgHandle = telegram_username.trim();
  if (tgHandle.startsWith('@')) tgHandle = tgHandle.slice(1);
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(tgHandle)) {
    return bad(c, 'Telegram username must be 5-32 characters, alphanumeric or underscore only (no @)');
  }
  
  try {
    // Check for duplicate username in same tenant
    const [existing] = await sql`SELECT id FROM users WHERE username = ${username} AND tenant_id = ${user.tenant_id} AND id != ${user.id}`;
    if (existing) {
      return bad(c, 'This username is already taken in your panel');
    }
    
    // Update user
    await sql`UPDATE users SET username = ${username}, telegram_username = ${'@' + tgHandle} WHERE id = ${user.id}`;
    console.log(`[onboarding] user ${user.id} set username=${username}, telegram=${tgHandle}`);
    
    return c.json({ ok: true });
  } catch (err) {
    console.error('[onboarding] error:', err);
    return bad(c, 'Failed to save onboarding data');
  }
});

users.get('/api/me', async (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const [fresh] = await sql`SELECT id, name, pin, role, avatar, pfp_data, xp, clocked_in, notif_prefs, is_super_admin, role_confirmed_at, tenant_id, username FROM users WHERE id = ${user.id}`;
  return c.json({ data: fresh });
});

// One-time role confirmation, stored server-side so it genuinely never re-asks —
// unlike localStorage, this survives a cleared cache, a new device, or reinstalling
// the PWA. Once set, it's permanent; nothing in the app ever clears it again.
users.post('/api/me/confirm-role', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  await sql`UPDATE users SET role_confirmed_at = now() WHERE id = ${user.id} AND role_confirmed_at IS NULL`;
  return c.json({ ok: true });
});

function normalizeUsername(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// A username exists for one reason: finding your way back to the right panel.
// PINs are only unique WITHIN a tenant, so "1234" alone can't tell you which
// call center you belong to if you've lost the URL - a username can, since
// it's looked up independently of any particular tenant's login page.
users.post('/api/me/set-username', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { username } = await c.req.json().catch(() => ({}));
  const clean = normalizeUsername(username);
  if (clean.length < 3 || clean.length > 20) return bad(c, 'Username must be 3-20 characters (letters, numbers, underscore)');
  const [collision] = await sql`SELECT id FROM users WHERE tenant_id = ${user.tenant_id} AND lower(username) = ${clean} AND id != ${user.id}`;
  if (collision) return bad(c, 'That username is already taken on this panel');
  await sql`UPDATE users SET username = ${clean} WHERE id = ${user.id}`;
  return c.json({ data: { username: clean } });
});

// Public, deliberately minimal - just enough to point someone back to the
// right door. Never reveals a PIN, XP, phone number, or anything else about
// the account; only which panel (name + link) the username belongs to.
users.get('/api/find-panel/:username', async (c) => {
  const clean = normalizeUsername(c.req.param('username'));
  if (clean.length < 3) return bad(c, 'Enter a valid username');
  const [row] = await sql`
    SELECT tenants.slug, tenants.name, tenants.is_self, tenants.status
    FROM users JOIN tenants ON tenants.id = users.tenant_id
    WHERE lower(users.username) = ${clean} LIMIT 1`;
  if (!row || row.status !== 'active') return bad(c, 'No panel found for that username', 404);
  return c.json({ data: { panel_name: row.name, url: row.is_self ? '/' : `/${row.slug}` } });
});

// Look up a panel by its code (the tenant slug) so a caller can jump to another
// company's panel login without knowing the full URL. Only returns active panels.
users.get('/api/panel-by-code/:code', async (c) => {
  const code = String(c.req.param('code') || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!code) return bad(c, 'Enter a panel code');
  const [row] = await sql`SELECT slug, name, is_self, status FROM tenants WHERE lower(slug) = ${code} LIMIT 1`;
  if (!row || row.status !== 'active') return bad(c, 'No active panel found with that code', 404);
  return c.json({ data: { panel_name: row.name, url: row.is_self ? '/' : `/${row.slug}` } });
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
  return c.json({ data: row });});

// Change your own login PIN, scoped to your own tenant. Verifies the current PIN,
// enforces 4-8 digits, and guarantees the new PIN stays unique within the panel
// (PINs are the per-tenant login credential, so a duplicate would break login).
users.post('/api/me/change-pin', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { current_pin, new_pin } = await c.req.json().catch(() => ({}));
  if (!current_pin || !new_pin) return bad(c, 'Current and new PIN required');
  if (String(current_pin) !== String(user.pin)) return bad(c, 'Your current PIN is incorrect');
  if (!/^[0-9]{4,8}$/.test(String(new_pin))) return bad(c, 'New PIN must be 4-8 digits');
  const [clash] = await sql`SELECT id FROM users WHERE tenant_id = ${user.tenant_id} AND pin = ${String(new_pin)} AND id != ${user.id}`;
  if (clash) return bad(c, 'That PIN is already used by someone on this panel — pick another');
  await sql`UPDATE users SET pin = ${String(new_pin)} WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

users.patch('/api/me/notif-prefs', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const prefs = await c.req.json().catch(() => ({}));
  await sql`UPDATE users SET notif_prefs = ${sql.json(prefs)} WHERE id = ${user.id}`;
  return c.json({ ok: true });
});

// "End Day" - shows anyone still marked clocked_in whose last real activity was a
// while ago (forgot to clock out, closed the tab, phone died, etc), so admin can
// force-close those sessions in one action instead of hunting them down individually.
users.get('/api/admin/stale-clockins', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const rows = await sql`SELECT id, name, avatar, pfp_data, role, last_seen_at,
      EXTRACT(EPOCH FROM (now() - COALESCE(last_seen_at, now() - INTERVAL '1 day'))) / 60 as minutes_since_seen
    FROM users WHERE clocked_in = true AND tenant_id = ${user.tenant_id}
    AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '15 minutes')
    ORDER BY last_seen_at ASC NULLS FIRST`;
  return c.json({ data: rows });
});

users.post('/api/admin/end-day', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { ids } = await c.req.json().catch(() => ({}));
  const targetIds = Array.isArray(ids) && ids.length ? ids : null;
  const rows = targetIds
    ? await sql`SELECT id FROM users WHERE clocked_in = true AND tenant_id = ${user.tenant_id} AND id = ANY(${targetIds})`
    : await sql`SELECT id FROM users WHERE clocked_in = true AND tenant_id = ${user.tenant_id} AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '15 minutes')`;
  const clockedIds = rows.map((r: any) => r.id);
  if (!clockedIds.length) return c.json({ ended: 0 });
  await sql`UPDATE users SET clocked_in = false, status = 'offline' WHERE id = ANY(${clockedIds})`;
  await sql`UPDATE clock_sessions SET clocked_out_at = now(), duration_seconds = EXTRACT(EPOCH FROM (now() - clocked_in_at))::int
    WHERE user_id = ANY(${clockedIds}) AND clocked_out_at IS NULL`;
  return c.json({ ended: clockedIds.length });
});

users.get('/api/center-status', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const rows = await sql`SELECT key, value FROM settings WHERE key IN (${'center_open:' + user.tenant_id}, ${'center_offline_reason:' + user.tenant_id})`;
  const map = Object.fromEntries(rows.map((r: any) => [r.key.split(':')[0], r.value]));
  return c.json({ data: { open: map.center_open !== 'false', reason: map.center_offline_reason || 'The call center is closed right now. Check back soon.' } });
});
users.post('/api/admin/center-status', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { open, reason } = await c.req.json().catch(() => ({}));
  if (open !== undefined) await sql`INSERT INTO settings (key, value) VALUES (${'center_open:' + user.tenant_id}, ${String(!!open)}) ON CONFLICT (key) DO UPDATE SET value = ${String(!!open)}`;
  if (reason !== undefined) await sql`INSERT INTO settings (key, value) VALUES (${'center_offline_reason:' + user.tenant_id}, ${reason}) ON CONFLICT (key) DO UPDATE SET value = ${reason}`;

  let autoEnded = 0;
  let interruptedCalls = 0;
  if (open === false) {
    // Closing the day should actually end everyone's shift, not just block new
    // clock-ins - nobody should stay clocked in against a center that's now closed.
    const clockedRows = await sql`SELECT id FROM users WHERE clocked_in = true AND tenant_id = ${user.tenant_id} AND role != 'admin'`;
    const ids = clockedRows.map((r: any) => r.id);
    if (ids.length) {
      // Clocking someone out does NOT automatically end whatever lead they're mid-call
      // on - that lead just sits at status 'calling'/'active_call' forever, which is
      // exactly why the dashboard kept showing "on call" after the day was closed.
      // Route any of those into requires_review instead of silently losing the fact
      // a call was genuinely in progress when the day ended.
      const interrupted = await sql`SELECT id, assigned_caller_id FROM leads WHERE tenant_id = ${user.tenant_id} AND assigned_caller_id = ANY(${ids}) AND status IN ('calling','active_call')`;
      for (const lead of interrupted) {
        await sql`UPDATE leads SET status = 'requires_review', updated_at = now() WHERE id = ${lead.id}`;
        await logEvent(lead.id, 'day_ended_mid_call', user, 'calling', 'requires_review', { note: 'Call was in progress when the day was closed' });
      }
      interruptedCalls = interrupted.length;

      await sql`UPDATE users SET clocked_in = false, status = 'offline' WHERE id = ANY(${ids})`;
      await sql`UPDATE clock_sessions SET clocked_out_at = now(), duration_seconds = EXTRACT(EPOCH FROM (now() - clocked_in_at))::int
        WHERE user_id = ANY(${ids}) AND clocked_out_at IS NULL`;
      autoEnded = ids.length;
      broadcast('center_closed', { reason: reason || null }, user.tenant_id, ids);
    }
  }
  return c.json({ ok: true, autoEnded, interruptedCalls });
});

users.post('/api/clock', async (c) => {
  const user = await authenticate(c);
  if (!user) return bad(c, 'Unauthorized', 401);
  const { clockedIn } = await c.req.json().catch(() => ({}));

  // Admins can always clock in - they're the ones who control open/closed. Callers
  // and finishers can't start a shift while the center is marked closed.
  if (clockedIn && user.role !== 'admin') {
    const [openSetting] = await sql`SELECT value FROM settings WHERE key = ${'center_open:' + user.tenant_id}`;
    if (openSetting && openSetting.value === 'false') {
      const [reasonSetting] = await sql`SELECT value FROM settings WHERE key = ${'center_offline_reason:' + user.tenant_id}`;
      return bad(c, reasonSetting?.value || 'The call center is closed right now.', 403);
    }
  }

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
  const user = c.get('user');
  const userId = c.req.query('userId');
  // Scoped on the JOINed users row rather than clock_sessions.tenant_id alone:
  // that column is backfilled, but joining through the user makes the scope
  // correct even for a session row written before the backfill lands.
  const rows = userId
    ? await sql`SELECT clock_sessions.*, users.name FROM clock_sessions
        JOIN users ON users.id = clock_sessions.user_id
        WHERE clock_sessions.user_id = ${userId} AND users.tenant_id = ${user.tenant_id}
        ORDER BY clocked_in_at DESC LIMIT 100`
    : await sql`SELECT clock_sessions.*, users.name FROM clock_sessions
        JOIN users ON users.id = clock_sessions.user_id
        WHERE users.tenant_id = ${user.tenant_id}
        ORDER BY clocked_in_at DESC LIMIT 100`;
  return c.json({ data: rows });
});

users.get('/api/lead-categories', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const rows = await sql`SELECT * FROM lead_categories WHERE tenant_id = ${user.tenant_id} ORDER BY name ASC`;
  return c.json({ data: rows });
});
users.post('/api/admin/lead-categories', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { name, color, domain } = await c.req.json().catch(() => ({}));
  if (!name) return bad(c, 'Name required');
  // ON CONFLICT: re-adding a bank from the picker updates its domain/colour
  // instead of erroring on the unique name.
  const [row] = await sql`INSERT INTO lead_categories (name, color, domain, tenant_id)
    VALUES (${name}, ${color || '#4f8cff'}, ${domain || null}, ${user.tenant_id})
    ON CONFLICT (tenant_id, name) DO UPDATE SET color = EXCLUDED.color, domain = EXCLUDED.domain RETURNING *`;
  return c.json({ data: row });
});
users.delete('/api/admin/lead-categories/:id', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const rows = await sql`DELETE FROM lead_categories
    WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id} RETURNING id`;
  if (!rows.length) return bad(c, 'Not found', 404);
  return c.json({ ok: true });
});

// ================= ADMIN: ROSTER =================
users.get('/api/admin/users', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const rows = await sql`
    SELECT users.id, users.name, users.pin, users.role, users.avatar, users.pfp_data, users.xp, users.clocked_in, users.status,
      users.call_phone, users.inbound_eligible, users.inbound_priority, users.threecx_extension, users.created_at, users.last_seen_at,
      users.suspended_at, users.suspended_reason, users.username, users.telegram_username,
      users.telegram_chat_id_master IS NOT NULL as telegram_verified,
      active_lead.first_name as active_lead_first_name, active_lead.last_name as active_lead_last_name, active_lead.status as active_lead_status
    FROM users
    LEFT JOIN LATERAL (
      SELECT first_name, last_name, status FROM leads
      WHERE assigned_caller_id = users.id AND status IN ('calling','active_call') LIMIT 1
    ) active_lead ON true
    WHERE users.tenant_id = ${user.tenant_id}
    ORDER BY users.created_at DESC`;
  return c.json({ data: rows });
});

users.patch('/api/admin/users/:id/inbound-settings', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { inbound_eligible, inbound_priority, threecx_extension } = await c.req.json().catch(() => ({}));
  const id = c.req.param('id');
  if (inbound_eligible !== undefined) await sql`UPDATE users SET inbound_eligible = ${inbound_eligible} WHERE id = ${id} AND tenant_id = ${user.tenant_id}`;
  if (inbound_priority !== undefined) await sql`UPDATE users SET inbound_priority = ${inbound_priority} WHERE id = ${id} AND tenant_id = ${user.tenant_id}`;
  // Blank clears the mapping, so 3CX falls back to ringing their external
  // call-from number instead of a stale extension nobody sits at anymore.
  if (threecx_extension !== undefined) {
    const ext = String(threecx_extension || '').trim() || null;
    await sql`UPDATE users SET threecx_extension = ${ext} WHERE id = ${id} AND tenant_id = ${user.tenant_id}`;
  }
  const [row] = await sql`SELECT id, name, inbound_eligible, inbound_priority, threecx_extension FROM users WHERE id = ${id} AND tenant_id = ${user.tenant_id}`;
  return c.json({ data: row });
});

users.post('/api/admin/users', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { name, role } = await c.req.json().catch(() => ({}));
  if (!name) return bad(c, 'Name is required');
  if (!['caller', 'finisher', 'admin', 'manager'].includes(role)) return bad(c, 'Invalid role');
  let pin: string, row: any;
  for (let i = 0; i < 8; i++) {
    pin = genPin();
    const [collision] = await sql`SELECT 1 FROM users WHERE tenant_id = ${user.tenant_id} AND pin = ${pin}`;
    if (collision) continue;
    [row] = await sql`INSERT INTO users (name, pin, role, tenant_id) VALUES (${name}, ${pin}, ${role}, ${user.tenant_id}) RETURNING id, name, pin, role`;
    break;
  }
  if (!row) return bad(c, 'Could not generate a unique PIN, try again', 500);
  return c.json({ data: row });
});

users.post('/api/admin/users/:id/role', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { role } = await c.req.json().catch(() => ({}));
  if (!['caller', 'finisher', 'admin', 'manager'].includes(role)) return bad(c, 'Invalid role');
  await sql`UPDATE users SET role = ${role} WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  return c.json({ ok: true });
});

users.delete('/api/admin/users/:id', requireRole('admin'), async (c) => {
  const admin = c.get('user');
  const id = c.req.param('id');
  const [target] = await sql`SELECT id FROM users WHERE id = ${id} AND tenant_id = ${admin.tenant_id}`;
  if (!target) return bad(c, 'Not found', 404);
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

// Suspending is deliberately not deletion: the account, their XP/history, and
// every record they're attached to all stay exactly as they are - this just
// cuts off access. Blocked at authenticate() itself (the one chokepoint every
// route already goes through), so a suspended caller can never see a lead, a
// queue, chat, anything - not a per-route check that could be missed
// somewhere, and it takes effect immediately even on a session that was
// already open when the suspension happened.
users.post('/api/admin/users/:id/suspend', requireRole('admin'), async (c) => {
  const admin = c.get('user');
  const id = c.req.param('id');
  const { reason } = await c.req.json().catch(() => ({}));
  const [target] = await sql`SELECT id, role, clocked_in FROM users WHERE id = ${id} AND tenant_id = ${admin.tenant_id}`;
  if (!target) return bad(c, 'Not found', 404);
  await sql`UPDATE users SET suspended_at = now(), suspended_reason = ${reason || null}, suspended_by = ${admin.id}, clocked_in = false WHERE id = ${id}`;
  // If they're mid-call, put the lead back rather than leaving it silently
  // stuck assigned to someone who can no longer touch it.
  await sql`UPDATE leads SET status = 'not_called', assigned_caller_id = NULL, updated_at = now() WHERE assigned_caller_id = ${id} AND status IN ('calling','active_call')`;
  if (target.clocked_in) {
    await sql`UPDATE clock_sessions SET clocked_out_at = now(), duration_seconds = EXTRACT(EPOCH FROM (now() - clocked_in_at))::int WHERE user_id = ${id} AND clocked_out_at IS NULL`;
  }
  return c.json({ ok: true });
});

users.post('/api/admin/users/:id/unsuspend', requireRole('admin'), async (c) => {
  const admin = c.get('user');
  const id = c.req.param('id');
  const [target] = await sql`SELECT id FROM users WHERE id = ${id} AND tenant_id = ${admin.tenant_id}`;
  if (!target) return bad(c, 'Not found', 404);
  await sql`UPDATE users SET suspended_at = NULL, suspended_reason = NULL, suspended_by = NULL WHERE id = ${id}`;
  return c.json({ ok: true });
});

users.get('/api/leaderboard', requireAnyStaff, async (c) => {
  const user = c.get('user');
  // weekly_xp comes from xp_events (last 7 days) so "This Week" is a real
  // rolling race, not the same all-time order relabelled.
  const rows = await sql`
    SELECT users.id, users.name, users.avatar, users.pfp_data, users.role, users.xp,
      COUNT(*) FILTER (WHERE lead_events.event_type = 'outcome_recorded' AND lead_events.to_status = 'successful_call' AND lead_events.actor_id = users.id) as successful_calls,
      COALESCE(week.wxp, 0) as weekly_xp
    FROM users
    LEFT JOIN lead_events ON lead_events.actor_id = users.id
    LEFT JOIN LATERAL (
      SELECT SUM(amount)::int as wxp FROM xp_events
      WHERE xp_events.user_id = users.id AND xp_events.created_at > now() - interval '7 days'
    ) week ON true
    WHERE users.role IN ('caller','finisher') AND users.tenant_id = ${user.tenant_id}
    GROUP BY users.id, users.name, users.avatar, users.pfp_data, users.role, users.xp, week.wxp
    ORDER BY users.xp DESC
  `;
  return c.json({ data: rows });
});
