import webpush from 'web-push';
import { sql } from './db';

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BPQeO_LNY7qhuIGGW2nsoL5ay_hxBwQBSnA4wtRBELZd1YSLaWR5RKiQ1slb0Gyou_wUyfuMV7eOkADeBS5Rrd4';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'Cxl8A3yElKHqSH_j8_87q4P9Ydfru_5jxF2EfRYcAD4';

webpush.setVapidDetails('mailto:admin@example.com', VAPID_PUBLIC, VAPID_PRIVATE);

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

export async function sendPushToRole(role: 'caller' | 'finisher' | 'admin' | 'all', title: string, body: string, url = '/') {
  const users = role === 'all' ? await sql`SELECT id FROM users` : await sql`SELECT id FROM users WHERE role = ${role} AND clocked_in = true`;
  for (const u of users) await sendPush(u.id, title, body, url);
}
