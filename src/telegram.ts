// Telegram wiring for ClearPanel.
//
// Two layers coexist:
//   - The MASTER bot (@clearpanelotpbot) is configured via env vars and reaches
//     every user on every tenant. It's how ClearPanel-the-product talks to its
//     entire customer base's staff — verification codes, announcements,
//     account matters. Only reachable from the /master panel.
//   - Each TENANT can optionally configure its OWN bot in Branding. That bot
//     only ever sees and messages users of that one tenant. Verification for
//     the tenant bot is separate from the master bot; a user may be verified
//     for one, both, or neither.
//
// Codes are 6 random digits, single-use, 5-minute expiry, stored in
// telegram_verifications. Nothing sensitive lives there beyond the code
// itself; on match the row is marked consumed and the chat_id lands on the
// users row.

import { sql } from './db';

const MASTER_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const MASTER_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'clearpanelotpbot';

export function isMasterBotConfigured(): boolean {
  return MASTER_BOT_TOKEN.length > 20 && MASTER_BOT_TOKEN.includes(':');
}

// A 6-digit numeric code, easy to read and copy on any device.
export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Normalise a user-typed @handle: strip @, strip t.me/ if pasted whole,
// lowercase, keep only letters/digits/underscore.
export function normalizeTelegramUsername(raw: string): string {
  let u = String(raw || '').trim();
  if (u.startsWith('https://')) u = u.slice(8);
  if (u.startsWith('http://')) u = u.slice(7);
  if (u.startsWith('t.me/')) u = u.slice(5);
  if (u.startsWith('@')) u = u.slice(1);
  return u.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// Minimal Telegram Bot API wrapper. Retries once on transient failure; anything
// else is surfaced so callers can log why a DM didn't land.
export async function tgApi(token: string, method: string, payload: Record<string, unknown>): Promise<{ ok: boolean; result?: any; error?: string; error_code?: number }> {
  if (!token) return { ok: false, error: 'no_token' };
  const url = `https://api.telegram.org/bot${token}/${method}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { ok: boolean; result?: unknown; description?: string; error_code?: number };
      if (data.ok) return { ok: true, result: data.result };
      // 4xx from Telegram (blocked, deactivated, bad chat_id) — no point retrying.
      if (data.error_code && data.error_code < 500) return { ok: false, error: data.description || 'telegram_error', error_code: data.error_code };
      if (attempt === 1) return { ok: false, error: data.description || 'telegram_error', error_code: data.error_code };
    } catch (e: any) {
      if (attempt === 1) return { ok: false, error: e?.message || 'network_error' };
    }
  }
  return { ok: false, error: 'unreachable' };
}

// Send a DM. Returns a status suited for the deliveries log: sent / blocked /
// failed. "blocked" means the user has blocked the bot or deleted the chat —
// their choice, don't retry, don't hound them.
export async function sendTelegramDM(token: string, chatId: number | string, text: string): Promise<{ status: 'sent' | 'blocked' | 'failed'; error?: string }> {
  const r = await tgApi(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
  if (r.ok) return { status: 'sent' };
  const err = (r.error || '').toLowerCase();
  if (err.includes('blocked') || err.includes('deactivated') || err.includes('user is deactivated') || err.includes('chat not found')) {
    return { status: 'blocked', error: r.error };
  }
  return { status: 'failed', error: r.error };
}

// Install our webhook so Telegram pushes updates to us. Called once at boot
// and whenever the token or webhook URL changes.
export async function setMasterWebhook(publicBase: string): Promise<{ ok: boolean; error?: string }> {
  if (!isMasterBotConfigured()) return { ok: false, error: 'not_configured' };
  const url = `${publicBase.replace(/\/$/, '')}/api/telegram/webhook/master`;
  const r = await tgApi(MASTER_BOT_TOKEN, 'setWebhook', { url, allowed_updates: ['message'] });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function sendMasterDM(chatId: number | string, text: string) {
  return sendTelegramDM(MASTER_BOT_TOKEN, chatId, text);
}

export function getMasterToken(): string {
  return MASTER_BOT_TOKEN;
}

// Look up a pending code that a user just messaged to a bot, and if it matches
// (right code, right scope, not expired, not already consumed) mark it consumed
// and return the (user_id, tenant_id) it belongs to so the webhook handler can
// stamp the chat_id on that user.
export async function consumeVerificationCode(
  code: string,
  scope: 'master' | 'tenant',
  tenantId: number | null,
): Promise<{ userId: number; tenantId: number | null } | null> {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return null;
  const rows = tenantId
    ? await sql`SELECT id, user_id, tenant_id FROM telegram_verifications
        WHERE code = ${clean} AND scope = ${scope} AND tenant_id = ${tenantId}
          AND consumed_at IS NULL AND expires_at > now() LIMIT 1`
    : await sql`SELECT id, user_id, tenant_id FROM telegram_verifications
        WHERE code = ${clean} AND scope = ${scope} AND consumed_at IS NULL AND expires_at > now() LIMIT 1`;
  const row = rows[0];
  if (!row) return null;
  await sql`UPDATE telegram_verifications SET consumed_at = now() WHERE id = ${row.id}`;
  return { userId: row.user_id, tenantId: row.tenant_id };
}

// Create a pending verification row. Kills any earlier unused row for the same
// (user, scope) so the user only ever sees one active code.
export async function createVerification(
  userId: number,
  telegramUsername: string,
  scope: 'master' | 'tenant',
  tenantId: number | null,
): Promise<{ code: string; expiresAt: Date }> {
  await sql`UPDATE telegram_verifications SET consumed_at = now()
    WHERE user_id = ${userId} AND scope = ${scope} AND consumed_at IS NULL`;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await sql`INSERT INTO telegram_verifications (user_id, telegram_username, code, scope, tenant_id, expires_at)
    VALUES (${userId}, ${telegramUsername}, ${code}, ${scope}, ${tenantId}, ${expiresAt.toISOString()})`;
  return { code, expiresAt };
}
