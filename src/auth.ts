import type { Context, Next } from 'hono';
import { sql } from './db';

export interface AuthUser {
  id: number;
  name: string;
  pin: string;
  role: 'admin' | 'manager' | 'caller' | 'finisher';
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
  // Joined in one query rather than a second round-trip per request - this is what
  // actually cuts off an already-logged-in session the moment their tenant's access
  // window expires, not just new logins going forward.
  const [row] = await sql`
    SELECT users.id, users.name, users.pin, users.role, users.avatar, users.pfp_data, users.xp, users.clocked_in, users.is_super_admin, users.tenant_id,
      tenants.expires_at as tenant_expires_at
    FROM users LEFT JOIN tenants ON tenants.id = users.tenant_id
    WHERE users.id = ${uid} AND users.pin = ${pin}`;
  if (!row) return null;
  if (row.tenant_expires_at && new Date(row.tenant_expires_at) < new Date()) return null;
  sql`UPDATE users SET last_seen_at = now() WHERE id = ${row.id} AND (last_seen_at IS NULL OR last_seen_at < now() - INTERVAL '20 seconds')`.catch(() => {});
  const { tenant_expires_at, ...user } = row;
  return user as AuthUser;
}

export function requireRole(...roles: Array<'admin' | 'manager' | 'caller' | 'finisher'>) {
  return async (c: Context, next: Next) => {
    const user = await authenticate(c);
    if (!user || !roles.includes(user.role)) return c.json({ error: 'Unauthorized' }, 403);
    c.set('user', user);
    await next();
  };
}

export const requireAdmin = requireRole('admin');
export const requireManager = requireRole('admin', 'manager');
export const requireAnyStaff = requireRole('admin', 'manager', 'caller', 'finisher');

export function requireSuperAdmin() {
  return async (c: Context, next: Next) => {
    const user = await authenticate(c);
    if (!user || user.role !== 'admin' || !user.is_super_admin) return c.json({ error: 'Unauthorized' }, 403);
    c.set('user', user);
    await next();
  };
}
