import webpush from 'web-push';
import { sql } from './db';

// These were hardcoded fallbacks in a PUBLIC repo — the private key was readable
// by anyone, letting them send push notifications to every device subscribed
// under it. No fallback now: if the env vars are missing, push is disabled
// rather than running on a publicly-known keypair.
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const PUSH_ENABLED = Boolean(VAPID_PUBLIC && VAPID_PRIVATE);

if (PUSH_ENABLED) {
  webpush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC, VAPID_PRIVATE);
} else {
  console.warn('[push] VAPID keys not set — web push disabled for this boot');
}

export const VAPID_PUBLIC_KEY = VAPID_PUBLIC;

export async function saveSubscription(userId: number, subscription: unknown) {
  await sql`
    INSERT INTO push_subscriptions (user_id, subscription)
    VALUES (${userId}, ${JSON.stringify(subscription)})
    ON CONFLICT (user_id) DO UPDATE SET subscription = ${JSON.stringify(subscription)}
  `;
}

export async function removeSubscription(userId: number) {
  await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
}

// Sends a real OS-level push notification to a user's device(s), even if the app/tab
// isn't open. Silently drops dead subscriptions (410/404 from the push service).
export async function sendPush(userId: number, title: string, body: string, url = '/') {
  if (!PUSH_ENABLED) return;
  const rows = await sql`SELECT subscription FROM push_subscriptions WHERE user_id = ${userId}`;
  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({ title, body, url }));
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await sql`DELETE FROM push_subscriptions WHERE user_id = ${userId}`;
      }
    }
  }
}

// tenantId required — see the note on notifyRole. An unscoped fallback here
// would push another tenant's lead names to your callers' lock screens.
export async function sendPushToRole(role: 'caller' | 'finisher' | 'admin' | 'all', title: string, body: string, url = '/', tenantId: number) {
  if (tenantId == null) throw new Error('sendPushToRole requires a tenantId');
  const users = role === 'all'
    ? await sql`SELECT id FROM users WHERE tenant_id = ${tenantId}`
    : await sql`SELECT id FROM users WHERE role = ${role} AND clocked_in = true AND tenant_id = ${tenantId}`;
  for (const u of users) await sendPush(u.id, title, body, url);
}
