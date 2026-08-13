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

const MASTER_BOT_TOKEN_ENV = process.env.TELEGRAM_BOT_TOKEN || '';
const MASTER_BOT_USERNAME_ENV = process.env.TELEGRAM_BOT_USERNAME || '';

// The GATEWAY bot is separate from the master OTP bot — it's the one added to
// the announcements group (https://t.me/+M-aK0jz4wDI5Nzdh) and used to post
// broadcast messages into that group, not for per-user verification DMs.
const GATEWAY_BOT_TOKEN = process.env.TELEGRAM_GATEWAY_BOT_TOKEN || '';
export const GATEWAY_BOT_USERNAME = process.env.TELEGRAM_GATEWAY_USERNAME || '';

export function isGatewayBotConfigured(): boolean {
  return GATEWAY_BOT_TOKEN.length > 20 && GATEWAY_BOT_TOKEN.includes(':');
}
export function getGatewayToken(): string {
  return GATEWAY_BOT_TOKEN;
}

// Consolidated: if a separate master/OTP bot token was never set up, run
// verification through the gateway bot instead of requiring a second bot.
// Explicit master config always wins when both are present.
const MASTER_BOT_TOKEN = MASTER_BOT_TOKEN_ENV || GATEWAY_BOT_TOKEN;
export const MASTER_BOT_USERNAME = MASTER_BOT_USERNAME_ENV || GATEWAY_BOT_USERNAME || 'clearpanelotpbot';
// True when master and gateway resolve to the literal same bot — Telegram only
// allows one active webhook per bot token, so boot only installs one in that case.
export function isSameBotAsGateway(): boolean {
  return !!MASTER_BOT_TOKEN_ENV === false && isGatewayBotConfigured();
}

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

// Send a photo with an HTML-formatted caption underneath — used for the OTP
// code and welcome messages so they look like a real product notification
// instead of a bare line of text. Falls back to a plain text DM if the photo
// send fails for any reason (bad URL, Telegram rejecting the image, etc.) so
// a broken banner never blocks the actual code from reaching someone.
export async function sendTelegramPhoto(token: string, chatId: number | string, photoUrl: string, caption: string): Promise<{ status: 'sent' | 'blocked' | 'failed'; error?: string }> {
  const r = await tgApi(token, 'sendPhoto', { chat_id: chatId, photo: photoUrl, caption, parse_mode: 'HTML' });
  if (r.ok) return { status: 'sent' };
  const err = (r.error || '').toLowerCase();
  if (err.includes('blocked') || err.includes('deactivated') || err.includes('chat not found')) {
    return { status: 'blocked', error: r.error };
  }
  // Photo failed for some other reason (bad URL, file too big, etc.) — still
  // get the message through as plain text rather than losing it entirely.
  return sendTelegramDM(token, chatId, caption);
}

// Post a message into the gateway bot's group chat (the announcements channel/
// group it's been added to). Requires the group's numeric chat_id, which is
// captured automatically the first time the bot sees any message in that
// group via the gateway webhook below — an invite link alone isn't enough,
// Telegram's API only accepts the real chat_id.
export async function sendGatewayGroupMessage(chatId: number | string, text: string): Promise<{ status: 'sent' | 'failed'; error?: string }> {
  if (!isGatewayBotConfigured()) return { status: 'failed', error: 'gateway_not_configured' };
  const r = await tgApi(GATEWAY_BOT_TOKEN, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true });
  return r.ok ? { status: 'sent' } : { status: 'failed', error: r.error };
}

export async function setGatewayWebhook(publicBase: string): Promise<{ ok: boolean; error?: string }> {
  if (!isGatewayBotConfigured()) return { ok: false, error: 'not_configured' };
  const url = `${publicBase.replace(/\/$/, '')}/api/telegram/webhook/gateway`;
  const r = await tgApi(GATEWAY_BOT_TOKEN, 'setWebhook', { url, allowed_updates: ['message', 'my_chat_member'] });
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function setMasterWebhook(publicBase: string): Promise<{ ok: boolean; error?: string }> {
  if (!isMasterBotConfigured()) return { ok: false, error: 'not_configured' };
  // If there's no separate master token, the "master" bot IS the gateway bot —
  // Telegram only allows one webhook per bot, and the gateway webhook already
  // processes verification messages (see the gateway route), so installing a
  // second webhook here would just silently overwrite it.
  if (isSameBotAsGateway()) return { ok: true };
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
