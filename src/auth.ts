import type { Context, Next } from 'hono';
import { sql } from './db';

export interface AuthUser {
  id: number;
  name: string;
  pin: string;
  role: 'admin' | 'caller' | 'finisher';
  avatar: string;
  pfp_data: string | null;
  is_super_admin: boolean;
  xp: number;
  clocked_in: boolean;
  tenant_id: number;
}

// Verifies the caller is who they claim to be by checking id+pin against the DB on
// every request — never trusts a client-supplied role string. Falls back to query
// params for the SSE endpoint, since browsers' native EventSource cannot set headers.
// Because this looks up by the globally-unique numeric id (not pin alone), it's safe
// regardless of tenant — every authenticated request naturally carries its own
// correct tenant_id via the returned user row, without needing separate tenant
// resolution middleware on every route.
export async function authenticate(c: Context): Promise<AuthUser | null> {
  const uid = c.req.header('x-user-id') || c.req.query('uid');
  const pin = c.req.header('x-user-pin') || c.req.query('pin');
  if (!uid || !pin) return null;
  const [user] = await sql`SELECT id, name, pin, role, avatar, pfp_data, xp, clocked_in, is_super_admin, tenant_id FROM users WHERE id = ${uid} AND pin = ${pin}`;
  if (user) {
    sql`UPDATE users SET last_seen_at = now() WHERE id = ${user.id} AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '20 seconds')`.catch(() => {});
  }
  return (user as AuthUser) || null;
}

export function requireRole(...roles: Array<'admin' | 'caller' | 'finisher'>) {
  return async (c: Context, next: Next) => {
    const user = await authenticate(c);
    if (!user || !roles.includes(user.role)) return c.json({ error: 'Unauthorized' }, 403);
    c.set('user', user);
    await next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireAnyStaff = requireRole('admin', 'caller', 'finisher');

export function requireSuperAdmin() {
  return async (c: Context, next: Next) => {
    const user = await authenticate(c);
    if (!user || user.role !== 'admin' || !user.is_super_admin) return c.json({ error: 'Unauthorized' }, 403);
    c.set('user', user);
    await next();
  };
}
