import type { Context, Next } from 'hono';
import { sql } from './db';

export interface AuthUser {
  id: number;
  name: string;
  pin: string;
  role: 'admin' | 'caller' | 'finisher';
  avatar: string;
  xp: number;
  clocked_in: boolean;
}

// Verifies the caller is who they claim to be by checking id+pin against the DB on
// every request — never trusts a client-supplied role string. Falls back to query
// params for the SSE endpoint, since browsers' native EventSource cannot set headers.
export async function authenticate(c: Context): Promise<AuthUser | null> {
  const uid = c.req.header('x-user-id') || c.req.query('uid');
  const pin = c.req.header('x-user-pin') || c.req.query('pin');
  if (!uid || !pin) return null;
  const [user] = await sql`SELECT id, name, pin, role, avatar, xp, clocked_in FROM users WHERE id = ${uid} AND pin = ${pin}`;
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
