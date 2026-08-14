// Lightweight in-memory rate limiter for brute-force protection on sensitive
// endpoints (login, OTP, PIN change). Keyed by IP + action. Not distributed —
// fine for a single-instance deploy; if this ever scales horizontally it should
// move to a shared store, but it's far better than the nothing that was here.
//
// Strategy: a sliding window of attempt timestamps per key. Once the count in
// the window exceeds the limit, further attempts are blocked until the window
// clears. Successful actions can reset the counter via clearAttempts().

type Bucket = { hits: number[]; blockedUntil?: number };
const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map can't grow unbounded from one-off IPs.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if ((!b.blockedUntil || b.blockedUntil < now) && (b.hits.length === 0 || b.hits[b.hits.length - 1] < now - 3600_000)) {
      buckets.delete(k);
    }
  }
}, 600_000).unref?.();

export function clientIp(c: any): string {
  // Railway/most proxies set x-forwarded-for; take the first hop.
  const fwd = c.req.header('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return c.req.header('x-real-ip') || c.req.header('cf-connecting-ip') || 'unknown';
}

// Returns { limited: true, retryAfter } if the caller should be blocked.
export function rateLimit(
  key: string,
  opts: { windowMs: number; max: number; blockMs?: number } = { windowMs: 60_000, max: 8 }
): { limited: boolean; retryAfter?: number; remaining?: number } {
  const now = Date.now();
  const blockMs = opts.blockMs ?? opts.windowMs;
  let b = buckets.get(key);
  if (!b) { b = { hits: [] }; buckets.set(key, b); }

  if (b.blockedUntil && b.blockedUntil > now) {
    return { limited: true, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  // Drop hits outside the window.
  b.hits = b.hits.filter(t => t > now - opts.windowMs);
  b.hits.push(now);
  if (b.hits.length > opts.max) {
    b.blockedUntil = now + blockMs;
    return { limited: true, retryAfter: Math.ceil(blockMs / 1000) };
  }
  return { limited: false, remaining: Math.max(0, opts.max - b.hits.length) };
}

// Call on success to wipe the failure counter for a key.
export function clearAttempts(key: string) {
  buckets.delete(key);
}

// ============================================================================
// DB-backed rate limiter — survives across multiple app instances (the
// in-memory one above is per-process, so it under-counts when replicas exist).
// Use this for the security-critical paths (login). Records a failure count in
// a fixed window; once the count exceeds max within the window, the key is
// locked for blockMs. Call dbClearAttempts() on success.
// ============================================================================
import { sql } from './db';

export async function dbRateLimit(
  key: string,
  opts: { windowMs: number; max: number; blockMs: number }
): Promise<{ limited: boolean; retryAfter?: number }> {
  const now = Date.now();
  try {
    const [row] = await sql`SELECT fail_count, window_start, locked_until FROM rate_limits WHERE rl_key = ${key}`;
    if (row?.locked_until && new Date(row.locked_until).getTime() > now) {
      return { limited: true, retryAfter: Math.ceil((new Date(row.locked_until).getTime() - now) / 1000) };
    }
    const windowStart = row?.window_start ? new Date(row.window_start).getTime() : now;
    const inWindow = now - windowStart < opts.windowMs;
    const newCount = inWindow ? (row?.fail_count || 0) + 1 : 1;
    const newWindowStart = inWindow ? new Date(windowStart) : new Date(now);
    if (newCount > opts.max) {
      const lockedUntil = new Date(now + opts.blockMs);
      await sql`INSERT INTO rate_limits (rl_key, fail_count, window_start, locked_until)
        VALUES (${key}, ${newCount}, ${newWindowStart}, ${lockedUntil})
        ON CONFLICT (rl_key) DO UPDATE SET fail_count = ${newCount}, locked_until = ${lockedUntil}`;
      return { limited: true, retryAfter: Math.ceil(opts.blockMs / 1000) };
    }
    await sql`INSERT INTO rate_limits (rl_key, fail_count, window_start, locked_until)
      VALUES (${key}, ${newCount}, ${newWindowStart}, NULL)
      ON CONFLICT (rl_key) DO UPDATE SET fail_count = ${newCount}, window_start = ${newWindowStart}, locked_until = NULL`;
    return { limited: false };
  } catch {
    // If the limiter itself errors, fail open (don't lock users out on a DB hiccup).
    return { limited: false };
  }
}

export async function dbClearAttempts(key: string) {
  try { await sql`DELETE FROM rate_limits WHERE rl_key = ${key}`; } catch {}
}
