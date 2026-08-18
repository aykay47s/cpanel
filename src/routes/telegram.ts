import { Hono } from 'hono';
import { createHash, timingSafeEqual as nodeTimingSafeEqual } from 'crypto';
import { rateLimit } from '../ratelimit';
import type { Context, Next } from 'hono';
import { sql } from '../db';
import { authenticate, requireAdmin, requireAnyStaff } from '../auth';
import {
  MASTER_BOT_USERNAME,
  isMasterBotConfigured,
  getMasterToken,
  sendTelegramDM,
  sendTelegramPhoto,
  sendMasterDM,
  normalizeTelegramUsername,
  createVerification,
  consumeVerificationCode,
  tgApi,
  isGatewayBotConfigured,
  getGatewayToken,
  GATEWAY_BOT_USERNAME,
  sendGatewayGroupMessage,
  isSameBotAsGateway,
} from '../telegram';

export const telegram = new Hono();

// This repo is public. A literal password here is readable by anyone on earth,
// and it gates /master — which sees every tenant. Must come from the environment.
// Startup refuses to serve the master route at all if it's unset, rather than
// silently falling back to a default that would be just as public as the old one.

// Constant-time string compare. Hashes both sides first so differing lengths
// don't short-circuit and reveal the real length.
function timingSafeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return nodeTimingSafeEqual(ha, hb);
}

const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '';
// Master session tokens live in memory. Short-lived; a restart signs you out
// and that's fine — the /master panel is a low-frequency operator tool.
const masterSessions = new Map<string, { createdAt: number }>();
const MASTER_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function makeSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
function isMasterSessionValid(token: string | undefined | null): boolean {
  if (!token) return false;
  const s = masterSessions.get(token);
  if (!s) return false;
  if (Date.now() - s.createdAt > MASTER_SESSION_TTL_MS) {
    masterSessions.delete(token);
    return false;
  }
  return true;
}
export async function requireMaster(c: Context, next: Next) {
  const token = c.req.header('x-master-token') || c.req.query('mt');
  if (!isMasterSessionValid(token)) return c.json({ error: 'Unauthorized' }, 401);
  await next();
}

// ============ VERIFICATION (called from within the app, by a logged-in user) ============
// User picks a scope: 'master' (link to ClearPanel's master bot) or 'tenant'
// (link to their tenant's own bot, if configured). Returns the code + the bot
// deep-link URL. The client shows both, plus a Copy button and an Open Telegram
// button, and polls /status until the webhook confirms.

// Step 1: user enters @username. We check if the bot already knows their chat_id
// (they've messaged the bot before). If yes, we DM them the code immediately.
// If no, we tell them to open the bot first (/start) and poll until they do.
telegram.post('/api/telegram/start-verification', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const { username, scope } = await c.req.json().catch(() => ({}));
  const cleanUsername = normalizeTelegramUsername(username || '');
  if (!cleanUsername || cleanUsername.length < 3) return c.json({ error: 'Enter a valid Telegram username' }, 400);
  const s = scope === 'tenant' ? 'tenant' : 'master';
  if (s === 'master' && !isMasterBotConfigured()) return c.json({ error: 'ClearPanel master bot not configured yet. Contact support.' }, 400);
  let botToken = getMasterToken();
  let botUsername = MASTER_BOT_USERNAME;
  let tenantId: number | null = null;
  if (s === 'tenant') {
    const [t] = await sql`SELECT telegram_bot_token, telegram_bot_username, id FROM tenants WHERE id = ${user.tenant_id}`;
    if (!t?.telegram_bot_token) return c.json({ error: "Your admin hasn't set up a Telegram bot yet." }, 400);
    botToken = t.telegram_bot_token;
    botUsername = t.telegram_bot_username || 'bot';
    tenantId = t.id;
  }
  // Save the username against this user so we can look it up when the code lands.
  await sql`UPDATE users SET telegram_username = ${cleanUsername} WHERE id = ${user.id}`;
  // Check if this username has already started a chat with the bot.
  const [reg] = await sql`SELECT chat_id FROM telegram_chat_registry WHERE telegram_username = ${cleanUsername} AND scope = ${s} LIMIT 1`;
  if (!reg) {
    // Bot doesn't know them yet — tell them to open it first.
    return c.json({ data: { needs_start: true, bot_username: botUsername, deep_link: `https://t.me/${botUsername}` } });
  }
  // We have their chat_id — generate a code and DM it to them.
  const { code, expiresAt } = await createVerification(user.id, cleanUsername, s, tenantId);
  const codeFormatted = `${code.slice(0,3)} ${code.slice(3)}`;
  const dmText = `🔐 <b>Your ClearPanel code</b>\n\n<code>${codeFormatted}</code>\n\nType this back in the app to finish linking your account. It expires in <b>5 minutes</b> and only works once.\n\n🔒 ClearPanel will never ask for this code anywhere else. If you didn't request it, just ignore this message — nothing will happen.`;
  const bannerUrl = `${new URL(c.req.url).origin}/clearpanel-logo.png`;
  const dmResult = await sendTelegramPhoto(botToken, reg.chat_id, bannerUrl, dmText);
  if (dmResult.status !== 'sent') return c.json({ error: 'Could not send your code. Make sure you have started the bot first.' }, 400);
  return c.json({ data: { needs_start: false, expires_at: expiresAt.toISOString(), scope: s } });
});

// Step 1b: after being told to /start the bot, the frontend polls this until
// the webhook has registered their chat_id.
telegram.get('/api/telegram/check-started', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const scope = c.req.query('scope') || 'master';
  const [u] = await sql`SELECT telegram_username FROM users WHERE id = ${user.id}`;
  if (!u?.telegram_username) return c.json({ data: { started: false } });
  const [reg] = await sql`SELECT chat_id FROM telegram_chat_registry WHERE telegram_username = ${u.telegram_username} AND scope = ${scope} LIMIT 1`;
  return c.json({ data: { started: !!reg } });
});

// Step 2: user enters the code they received via Telegram DM.
telegram.post('/api/telegram/confirm-code', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const { code, scope } = await c.req.json().catch(() => ({}));
  const s = scope === 'tenant' ? 'tenant' : 'master';
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return c.json({ error: 'Enter the 6-digit code from Telegram' }, 400);
  // Throttle code guesses per user (6-digit codes are 1M combos; a short expiry
  // plus this makes brute-forcing infeasible). 10 tries/min, then a 10-min block.
  const rl = rateLimit('otp:' + user.id, { windowMs: 60_000, max: 10, blockMs: 600_000 });
  if (rl.limited) return c.json({ error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
  const consumed = await consumeVerificationCode(clean, s, s === 'tenant' ? user.tenant_id : null);
  if (!consumed) return c.json({ error: 'Code is wrong or expired. Get a new one.' }, 400);
  // Look up their chat_id from the registry to stamp it.
  const [u] = await sql`SELECT telegram_username FROM users WHERE id = ${user.id}`;
  const [reg] = await sql`SELECT chat_id FROM telegram_chat_registry WHERE telegram_username = ${u?.telegram_username} AND scope = ${s} LIMIT 1`;
  const chatId = reg?.chat_id || null;
  if (s === 'master') {
    await sql`UPDATE users SET telegram_chat_id_master = ${chatId}, telegram_verified_master_at = now() WHERE id = ${user.id}`;
  } else {
    await sql`UPDATE users SET telegram_chat_id_tenant = ${chatId}, telegram_verified_tenant_at = now() WHERE id = ${user.id}`;
  }
  // Welcome DM
  const [fresh] = await sql`SELECT name FROM users WHERE id = ${user.id}`;
  let botToken = getMasterToken();
  let botUsername = MASTER_BOT_USERNAME;
  if (s === 'tenant') {
    const [t] = await sql`SELECT telegram_bot_token, telegram_bot_username FROM tenants WHERE id = ${user.tenant_id}`;
    botToken = t?.telegram_bot_token || botToken;
    botUsername = t?.telegram_bot_username || botUsername;
  }
  if (chatId) {
    const welcome = `👋 Welcome to ClearPanel, <b>${fresh?.name || 'there'}</b>!\n\nYour Telegram is now linked. You'll receive shift alerts, announcements, and account updates right here.\n\n📣 <b>Join the ClearPanel updates channel</b> to stay in the loop on new features and platform news:\nhttps://t.me/+M-aK0jz4wDI5Nzdh\n\nHead back to the app — you're all set.`;
    const bannerUrl = `${new URL(c.req.url).origin}/clearpanel-logo.png`;
    sendTelegramPhoto(botToken, chatId, bannerUrl, welcome).catch(() => {});
  }
  return c.json({ data: { verified: true, name: fresh?.name || '' } });
});

// Polled by the verification screen every ~2s to auto-advance the moment the
// bot's webhook has stamped the chat_id on this user.
telegram.get('/api/telegram/status', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const [row] = await sql`SELECT telegram_username, telegram_chat_id_master, telegram_chat_id_tenant,
    telegram_verified_master_at, telegram_verified_tenant_at FROM users WHERE id = ${user.id}`;
  return c.json({ data: row || {} });
});

// ============ WEBHOOKS ============
// Telegram POSTs updates here. We only care about text messages; if the text
// matches an unconsumed 6-digit code we stamp the user, DM back a success
// message, and (if start-payload was used) return early. Everything else the
// bot receives gets a polite "hi, you'll only hear from us for account matters"
// so nobody wonders why they DMed a bot into the void.
async function handleTelegramUpdate(
  update: any,
  scope: 'master' | 'tenant',
  tenantId: number | null,
  botToken: string,
): Promise<void> {
  const msg = update?.message;
  if (!msg || !msg.text) return;
  const chatId: number = msg.chat?.id;
  const fromUsername = (msg.from?.username || '').toLowerCase();
  const text = String(msg.text).trim();
  // Every message registers the sender's username->chat_id so start-verification
  // can DM them the code without needing them to paste it back here.
  if (fromUsername && chatId) {
    await sql`INSERT INTO telegram_chat_registry (telegram_username, chat_id, scope, updated_at)
      VALUES (${fromUsername}, ${chatId}, ${scope}, now())
      ON CONFLICT (telegram_username) DO UPDATE SET chat_id = ${chatId}, updated_at = now()`;
  }
  const isStart = text.startsWith('/start');
  if (isStart) {
    // /start: just greet them and tell them to head back to the app.
    await sendTelegramDM(botToken, chatId,
      "👋 Hi! I'm the ClearPanel verification bot.\n\nHead back to the app — it will send your verification code here once you enter your Telegram username.\n\n📣 Stay updated: https://t.me/+M-aK0jz4wDI5Nzdh");
    return;
  }
  // Any non-/start message that has no 6-digit code gets a hint.
  const codeMatch = text.match(/\d{6}/);
  if (!codeMatch) {
    await sendTelegramDM(botToken, chatId,
      "Head back to ClearPanel and enter your @username — I'll DM you a code here to verify.");
    return;
  }
  // If they somehow paste a code directly into the bot (old habit, copy-paste),
  // handle it gracefully by consuming it and stamping their chat_id.
  const consumed = await consumeVerificationCode(codeMatch[0], scope, tenantId);
  if (!consumed) {
    await sendTelegramDM(botToken, chatId,
      "That code isn't valid or has expired. Go back to ClearPanel and request a new one.");
    return;
  }
  if (scope === 'master') {
    await sql`UPDATE users SET telegram_chat_id_master = ${chatId}, telegram_verified_master_at = now(),
      telegram_username = COALESCE(NULLIF(telegram_username,''), ${fromUsername || null}) WHERE id = ${consumed.userId}`;
  } else {
    await sql`UPDATE users SET telegram_chat_id_tenant = ${chatId}, telegram_verified_tenant_at = now(),
      telegram_username = COALESCE(NULLIF(telegram_username,''), ${fromUsername || null}) WHERE id = ${consumed.userId}`;
  }
  const [fresh] = await sql`SELECT name FROM users WHERE id = ${consumed.userId}`;
  const name = fresh?.name || 'there';
  const welcome = scope === 'master'
    ? `👋 Welcome to ClearPanel, <b>${name}</b>!\n\nYour Telegram is linked. You'll get updates, alerts, and announcements right here.\n\n📣 Join the updates channel: https://t.me/+M-aK0jz4wDI5Nzdh`
    : `👋 Verified, <b>${name}</b>! Your admin can now reach you here. Head back to the app.`;
  await sendTelegramDM(botToken, chatId, welcome);
}

telegram.post('/api/telegram/webhook/master', async (c) => {
  const token = getMasterToken();
  if (!token) return c.json({ ok: true }); // silently drop — not configured
  const update = await c.req.json().catch(() => null);
  if (!update) return c.json({ ok: true });
  // Fire-and-forget so we return 200 fast — Telegram retries on non-200.
  handleTelegramUpdate(update, 'master', null, token).catch(() => {});
  return c.json({ ok: true });
});

telegram.post('/api/telegram/webhook/tenant/:secret', async (c) => {
  const secret = c.req.param('secret');
  const [t] = await sql`SELECT id, telegram_bot_token FROM tenants WHERE telegram_webhook_secret = ${secret} LIMIT 1`;
  if (!t?.telegram_bot_token) return c.json({ ok: true });
  const update = await c.req.json().catch(() => null);
  if (!update) return c.json({ ok: true });
  handleTelegramUpdate(update, 'tenant', t.id, t.telegram_bot_token).catch(() => {});
  return c.json({ ok: true });
});

// The gateway bot always captures group chat_ids (for the announcements group).
// When there's no separate master bot configured, this bot IS also the OTP/
// verification bot — so its webhook also runs private DM messages through the
// same verification flow the dedicated master webhook would normally handle.
telegram.post('/api/telegram/webhook/gateway', async (c) => {
  if (!isGatewayBotConfigured()) return c.json({ ok: true });
  const update = await c.req.json().catch(() => null);
  if (!update) return c.json({ ok: true });
  const chat = update.message?.chat || update.my_chat_member?.chat;
  if (chat?.id && (chat.type === 'group' || chat.type === 'supergroup')) {
    await sql`INSERT INTO gateway_chats (chat_id, title, chat_type, last_seen_at)
      VALUES (${chat.id}, ${chat.title || null}, ${chat.type}, now())
      ON CONFLICT (chat_id) DO UPDATE SET title = ${chat.title || null}, last_seen_at = now()`.catch(() => {});
  }
  // Private DM to this bot — if it's standing in as the OTP bot, run the same
  // verification handling a dedicated master webhook would.
  if (chat?.type === 'private' && isSameBotAsGateway()) {
    handleTelegramUpdate(update, 'master', null, getGatewayToken()).catch(() => {});
  }
  return c.json({ ok: true });
});

// List groups the gateway bot has been seen in — lets an admin pick the real
// announcements group instead of needing to know its chat_id.
telegram.get('/api/admin/telegram/gateway/chats', requireAdmin, async (c) => {
  const rows = await sql`SELECT * FROM gateway_chats ORDER BY last_seen_at DESC LIMIT 25`;
  return c.json({ data: rows, configured: isGatewayBotConfigured(), bot_username: GATEWAY_BOT_USERNAME || null });
});

// Set which discovered chat is "the" announcements group. Stored in settings
// so it survives restarts and is a single well-known key the announcement
// route below can read without another table join.
telegram.post('/api/admin/telegram/gateway/set-announcement-chat', requireAdmin, async (c) => {
  const { chat_id } = await c.req.json().catch(() => ({}));
  if (!chat_id) return c.json({ error: 'chat_id required' }, 400);
  await sql`INSERT INTO settings (key, value) VALUES ('gateway_announcement_chat_id', ${String(chat_id)}) ON CONFLICT (key) DO UPDATE SET value = ${String(chat_id)}`;
  return c.json({ ok: true });
});

telegram.post('/api/admin/telegram/gateway/test', requireAdmin, async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'gateway_announcement_chat_id'`;
  if (!row?.value) return c.json({ error: 'No announcements group selected yet' }, 400);
  const result = await sendGatewayGroupMessage(row.value, '✅ ClearPanel gateway bot test message — if you can see this, announcements are wired up correctly.');
  if (result.status !== 'sent') return c.json({ error: result.error || 'Send failed' }, 400);
  return c.json({ ok: true });
});

// ============ TENANT-LEVEL BOT CONFIG (admin only) ============
// A tenant admin sets a token + username to enable their own bot. We install
// the webhook against a random secret so tenants can't collide or forge each
// other. Storing the raw token is unavoidable (we need it to call the API);
// the master password + admin PIN are the only ways to reach it.

telegram.get('/api/admin/telegram-bot', requireAdmin, async (c) => {
  const user = c.get('user');
  const [t] = await sql`SELECT telegram_bot_username, telegram_require_verification,
    (telegram_bot_token IS NOT NULL) as configured, telegram_webhook_secret
    FROM tenants WHERE id = ${user.tenant_id}`;
  return c.json({ data: {
    configured: !!t?.configured,
    bot_username: t?.telegram_bot_username || null,
    require_verification: t?.telegram_require_verification !== false,
    webhook_url: t?.telegram_webhook_secret ? `${new URL(c.req.url).origin}/api/telegram/webhook/tenant/${t.telegram_webhook_secret}` : null,
  }});
});

telegram.post('/api/admin/telegram-bot', requireAdmin, async (c) => {
  { // Tier gate: a tenant's own Telegram bot is a 7-day+ plan feature.
    const u = c.get('user');
    const [t] = await sql`SELECT plan_days FROM tenants WHERE id = ${u.tenant_id}`;
    if (t && t.plan_days != null && t.plan_days < 7) return c.json({ error: 'Your own Telegram bot is included on 7-day plans and up. Upgrade your access key to unlock it.' }, 403);
  }
  const user = c.get('user');
  const { bot_token, bot_username, require_verification } = await c.req.json().catch(() => ({}));
  if (bot_token !== undefined) {
    if (!bot_token) {
      await sql`UPDATE tenants SET telegram_bot_token = NULL, telegram_bot_username = NULL, telegram_webhook_secret = NULL WHERE id = ${user.tenant_id}`;
      return c.json({ ok: true, cleared: true });
    }
    if (!String(bot_token).includes(':')) return c.json({ error: 'That does not look like a bot token' }, 400);
    // Validate by calling getMe against Telegram — no point saving a dead token.
    const me = await tgApi(bot_token, 'getMe', {});
    if (!me.ok) return c.json({ error: 'Telegram rejected that token: ' + (me.error || 'unknown') }, 400);
    const resolvedUsername = (me.result?.username || bot_username || '').replace(/^@/, '');
    // Random webhook secret so tenants can't guess each other's URLs.
    const secretBytes = new Uint8Array(24);
    crypto.getRandomValues(secretBytes);
    const secret = Array.from(secretBytes, b => b.toString(16).padStart(2, '0')).join('');
    const webhookUrl = `${new URL(c.req.url).origin}/api/telegram/webhook/tenant/${secret}`;
    const install = await tgApi(bot_token, 'setWebhook', { url: webhookUrl, allowed_updates: ['message'] });
    if (!install.ok) return c.json({ error: 'Could not install webhook: ' + (install.error || 'unknown') }, 400);
    await sql`UPDATE tenants SET telegram_bot_token = ${bot_token}, telegram_bot_username = ${resolvedUsername},
      telegram_webhook_secret = ${secret} WHERE id = ${user.tenant_id}`;
  }
  if (require_verification !== undefined) {
    await sql`UPDATE tenants SET telegram_require_verification = ${!!require_verification} WHERE id = ${user.tenant_id}`;
  }
  return c.json({ ok: true });
});

// ============ TENANT-LEVEL BROADCAST (admin only, tenant's own bot, tenant's own users) ============

telegram.post('/api/admin/telegram-broadcast', requireAdmin, async (c) => {
  const user = c.get('user');
  const { message, audience } = await c.req.json().catch(() => ({}));
  if (!message || !String(message).trim()) return c.json({ error: 'Message is empty' }, 400);
  const [t] = await sql`SELECT telegram_bot_token FROM tenants WHERE id = ${user.tenant_id}`;
  if (!t?.telegram_bot_token) return c.json({ error: 'Set up your tenant bot first.' }, 400);
  const targets = await resolveTenantAudience(user.tenant_id, audience);
  return runBroadcast('tenant', user.tenant_id, audience || 'tenant_all', String(message), targets, t.telegram_bot_token, 'tenant', c);
});

async function resolveTenantAudience(tenantId: number, audience: string): Promise<Array<{ id: number; name: string; chat_id: number }>> {
  const rows = await sql`SELECT id, name, telegram_chat_id_tenant as chat_id, role FROM users
    WHERE tenant_id = ${tenantId} AND telegram_chat_id_tenant IS NOT NULL`;
  return rows.filter((r: any) => {
    if (audience === 'admins') return r.role === 'admin';
    if (audience === 'callers') return r.role === 'caller' || r.role === 'finisher';
    return true;
  });
}

// ============ MASTER PANEL (cross-tenant) ============

// The master password lives in the DATABASE as an argon2id hash (Bun.password),
// so it can be changed from the master UI at any time without a redeploy, and a
// database leak exposes only the hash, never the password itself. The
// MASTER_PASSWORD env var acts purely as the first-boot seed: the first
// successful env-password login writes the hash, and from then on the DB hash
// is the single source of truth (the env var is ignored once a hash exists).
async function verifyMasterPassword(password: string): Promise<boolean> {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'master_password_hash'`;
  if (row?.value) {
    try { return await Bun.password.verify(password || '', row.value); } catch { return false; }
  }
  if (!MASTER_PASSWORD) return false;
  if (!timingSafeEqual(password || '', MASTER_PASSWORD)) return false;
  const hash = await Bun.password.hash(password);
  await sql`INSERT INTO settings (key, value) VALUES ('master_password_hash', ${hash})
    ON CONFLICT (key) DO UPDATE SET value = ${hash}`;
  return true;
}
async function masterIsConfigured(): Promise<boolean> {
  const [row] = await sql`SELECT 1 FROM settings WHERE key = 'master_password_hash'`;
  return !!row || !!MASTER_PASSWORD;
}

telegram.post('/api/master/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({}));
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown';
  const [lock] = await sql`SELECT fail_count, locked_until FROM master_login_attempts WHERE ip = ${ip}`;
  if (lock?.locked_until && new Date(lock.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(lock.locked_until).getTime() - Date.now()) / 60000);
    return c.json({ error: `Locked out. Try again in ${mins} minutes.` }, 429);
  }
  if (!(await masterIsConfigured())) {
    console.error('[master] no master password configured (no DB hash, no MASTER_PASSWORD env) — refusing all master logins');
    return c.json({ error: 'Master panel is not configured' }, 503);
  }
  if (!(await verifyMasterPassword(password || ''))) {
    const newCount = (lock?.fail_count || 0) + 1;
    const lockedUntil = newCount >= 3 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null;
    await sql`INSERT INTO master_login_attempts (ip, fail_count, locked_until) VALUES (${ip}, ${newCount}, ${lockedUntil})
      ON CONFLICT (ip) DO UPDATE SET fail_count = ${newCount}, locked_until = ${lockedUntil}`;
    if (lockedUntil) return c.json({ error: 'Too many wrong attempts. Locked for 15 minutes.' }, 429);
    return c.json({ error: 'Wrong password' }, 401);
  }
  // Success — clear the counter for this IP and mint a session token.
  await sql`DELETE FROM master_login_attempts WHERE ip = ${ip}`;
  const token = makeSessionToken();
  masterSessions.set(token, { createdAt: Date.now() });
  return c.json({ data: { token, expires_in_ms: MASTER_SESSION_TTL_MS } });
});

// Change the master password from the UI — requires a valid session AND the
// current password again (so a stolen unattended session can't silently take
// over). Stores a fresh argon2id hash; effective immediately, no redeploy.
// Every other active session is revoked on change.
telegram.post('/api/master/change-password', requireMaster, async (c) => {
  const { current_password, new_password } = await c.req.json().catch(() => ({}));
  if (!(await verifyMasterPassword(current_password || ''))) {
    return c.json({ error: 'Current password is wrong' }, 403);
  }
  const np = String(new_password || '');
  if (np.length < 4 || np.length > 200) return c.json({ error: 'New password must be 4-200 characters' }, 400);
  const hash = await Bun.password.hash(np);
  await sql`INSERT INTO settings (key, value) VALUES ('master_password_hash', ${hash})
    ON CONFLICT (key) DO UPDATE SET value = ${hash}`;
  const keep = c.req.header('x-master-token') || '';
  for (const [tok] of masterSessions) { if (tok !== keep) masterSessions.delete(tok); }
  return c.json({ ok: true });
});

telegram.post('/api/master/logout', requireMaster, async (c) => {
  const token = c.req.header('x-master-token') || '';
  masterSessions.delete(token);
  return c.json({ ok: true });
});

// Overview of every tenant + user counts + verified counts.
telegram.get('/api/master/overview', requireMaster, async (c) => {
  const tenants = await sql`
    SELECT t.id, t.name, t.slug, t.plan, t.status, t.expires_at, t.is_self,
      (t.telegram_bot_username IS NOT NULL) as has_own_bot,
      t.telegram_bot_username as own_bot_username,
      COUNT(u.id) FILTER (WHERE u.id IS NOT NULL) as user_count,
      COUNT(u.id) FILTER (WHERE u.telegram_chat_id_master IS NOT NULL) as verified_master_count,
      COUNT(u.id) FILTER (WHERE u.role = 'caller' OR u.role = 'finisher') as caller_count
    FROM tenants t
    LEFT JOIN users u ON u.tenant_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at ASC`;
  const totals = {
    tenants: tenants.length,
    users: tenants.reduce((a: number, t: any) => a + Number(t.user_count || 0), 0),
    verified: tenants.reduce((a: number, t: any) => a + Number(t.verified_master_count || 0), 0),
    callers: tenants.reduce((a: number, t: any) => a + Number(t.caller_count || 0), 0),
  };
  return c.json({ data: { tenants, totals, bot_configured: isMasterBotConfigured(), bot_username: MASTER_BOT_USERNAME } });
});

// Every caller-role user across every tenant, with their Telegram status.
// Supports filtering and search.
telegram.get('/api/master/callers', requireMaster, async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const tenantId = c.req.query('tenant_id');
  const role = c.req.query('role') || '';
  const verified = c.req.query('verified'); // 'yes' | 'no' | ''
  let rows = await sql`
    SELECT u.id, u.name, u.role, u.tenant_id, u.telegram_username,
      (u.telegram_chat_id_master IS NOT NULL) as verified_master,
      (u.telegram_chat_id_tenant IS NOT NULL) as verified_tenant,
      u.clocked_in, u.last_seen_at, u.xp,
      t.name as tenant_name, t.slug as tenant_slug
    FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
    ORDER BY t.name ASC, u.name ASC`;
  rows = rows.filter((r: any) => {
    if (tenantId && String(r.tenant_id) !== String(tenantId)) return false;
    if (role && r.role !== role) return false;
    if (verified === 'yes' && !r.verified_master) return false;
    if (verified === 'no' && r.verified_master) return false;
    if (q) {
      const hay = `${r.name || ''} ${r.telegram_username || ''} ${r.tenant_name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return c.json({ data: rows });
});

telegram.get('/api/master/broadcasts', requireMaster, async (c) => {
  const rows = await sql`SELECT * FROM telegram_broadcasts ORDER BY created_at DESC LIMIT 50`;
  return c.json({ data: rows });
});

telegram.get('/api/master/broadcast/:id/deliveries', requireMaster, async (c) => {
  const rows = await sql`SELECT d.*, u.name as user_name, t.name as tenant_name
    FROM telegram_deliveries d
    LEFT JOIN users u ON u.id = d.user_id
    LEFT JOIN tenants t ON t.id = u.tenant_id
    WHERE d.broadcast_id = ${c.req.param('id')}
    ORDER BY d.created_at ASC`;
  return c.json({ data: rows });
});

// Send a broadcast via the master bot to a chosen audience.
telegram.post('/api/master/broadcast', requireMaster, async (c) => {
  const { message, audience, tenant_id } = await c.req.json().catch(() => ({}));
  if (!message || !String(message).trim()) return c.json({ error: 'Message is empty' }, 400);
  if (!isMasterBotConfigured()) return c.json({ error: 'Master bot not configured' }, 400);
  const targets = await resolveMasterAudience(audience, tenant_id);
  const label = audienceLabel(audience, tenant_id);
  return runBroadcast('master', null, label, String(message), targets, getMasterToken(), 'master', c);
});

async function resolveMasterAudience(audience: string, tenantId?: number): Promise<Array<{ id: number; name: string; chat_id: number }>> {
  const rows = await sql`SELECT id, name, telegram_chat_id_master as chat_id, role, tenant_id FROM users
    WHERE telegram_chat_id_master IS NOT NULL`;
  return rows.filter((r: any) => {
    if (audience === 'admins') return r.role === 'admin';
    if (audience === 'callers') return r.role === 'caller' || r.role === 'finisher';
    if (audience === 'tenant' && tenantId) return String(r.tenant_id) === String(tenantId);
    return true; // 'all'
  });
}

function audienceLabel(audience: string, tenantId?: number): string {
  if (audience === 'admins') return 'All admins (every tenant)';
  if (audience === 'callers') return 'All callers/finishers (every tenant)';
  if (audience === 'tenant') return `Tenant #${tenantId}`;
  return 'Everyone verified';
}

// Common broadcast runner: sends sequentially with a small delay to stay under
// Telegram's 30/sec limit, logs each attempt.
async function runBroadcast(
  scope: 'master' | 'tenant',
  tenantId: number | null,
  label: string,
  message: string,
  targets: Array<{ id: number; name: string; chat_id: number }>,
  botToken: string,
  _senderScope: 'master' | 'tenant',
  c: Context,
) {
  const [b] = await sql`INSERT INTO telegram_broadcasts (sender_scope, sender_tenant_id, audience_label, message, total_recipients)
    VALUES (${scope}, ${tenantId}, ${label}, ${message}, ${targets.length}) RETURNING id`;
  const broadcastId = b.id;
  let sent = 0, blocked = 0, failed = 0;
  for (const t of targets) {
    const r = await sendTelegramDM(botToken, t.chat_id, message);
    await sql`INSERT INTO telegram_deliveries (broadcast_id, user_id, status, error)
      VALUES (${broadcastId}, ${t.id}, ${r.status}, ${r.error || null})`;
    if (r.status === 'sent') sent++;
    else if (r.status === 'blocked') blocked++;
    else failed++;
    // 40ms between sends keeps us well under Telegram's 30 msg/sec cap.
    await new Promise(res => setTimeout(res, 40));
  }
  await sql`UPDATE telegram_broadcasts SET sent_count = ${sent}, blocked_count = ${blocked}, failed_count = ${failed}
    WHERE id = ${broadcastId}`;
  return c.json({ data: { broadcast_id: broadcastId, total: targets.length, sent, blocked, failed } });
}

// Small utility: whether the current logged-in user has verified the master bot.
// The staff app calls this to decide whether to show the verification screen.
telegram.get('/api/telegram/my-status', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const [row] = await sql`SELECT u.telegram_username, u.telegram_chat_id_master IS NOT NULL as verified_master,
    u.telegram_chat_id_tenant IS NOT NULL as verified_tenant,
    t.telegram_bot_username as tenant_bot_username,
    t.telegram_require_verification as tenant_requires
    FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ${user.id}`;
  return c.json({ data: {
    ...row,
    master_bot_username: MASTER_BOT_USERNAME,
    master_configured: isMasterBotConfigured(),
  }});
});
