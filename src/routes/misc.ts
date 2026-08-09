import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate } from '../auth';
import { registerClient, unregisterClient } from '../realtime';
import { VAPID_PUBLIC_KEY, saveSubscription, removeSubscription } from '../push';

export const misc = new Hono();

misc.get('/api/push/vapid-key', (c) => c.json({ data: { key: VAPID_PUBLIC_KEY } }));

misc.post('/api/push/subscribe', async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  const { subscription } = await c.req.json().catch(() => ({}));
  if (!subscription) return c.json({ error: 'subscription required' }, 400);
  await saveSubscription(user.id, subscription);
  return c.json({ ok: true });
});

misc.post('/api/push/unsubscribe', async (c) => {
  const user = await authenticate(c);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  await removeSubscription(user.id);
  return c.json({ ok: true });
});

misc.get('/api/call-template', requireRole('admin', 'caller', 'finisher'), async (c) => {
  const [row] = await sql`SELECT value FROM settings WHERE key = 'call_template'`;
  return c.json({ data: { template: row?.value || '' } });
});
misc.post('/api/admin/call-template', requireRole('admin'), async (c) => {
  const { template } = await c.req.json().catch(() => ({}));
  if (typeof template !== 'string') return c.json({ error: 'template required' }, 400);
  await sql`INSERT INTO settings (key, value) VALUES ('call_template', ${template}) ON CONFLICT (key) DO UPDATE SET value = ${template}`;
  return c.json({ ok: true });
});

misc.get('/api/goal', async (c) => {
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('goal_target', 'goal_label')`;
  const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
  const [{ count }] = await sql`SELECT COUNT(*)::int as count FROM leads WHERE status IN ('completed') OR outcome = 'successful_call'`;
  return c.json({ data: { label: map.goal_label || 'Successful calls', target: Number(map.goal_target || 50), current: count } });
});

misc.post('/api/admin/goal', requireRole('admin'), async (c) => {
  const { label, target } = await c.req.json().catch(() => ({}));
  if (label !== undefined) await sql`INSERT INTO settings (key, value) VALUES ('goal_label', ${label}) ON CONFLICT (key) DO UPDATE SET value = ${label}`;
  if (target !== undefined) await sql`INSERT INTO settings (key, value) VALUES ('goal_target', ${String(target)}) ON CONFLICT (key) DO UPDATE SET value = ${String(target)}`;
  return c.json({ ok: true });
});

misc.get('/api/events', async (c) => {
  const user = await authenticate(c);
  const userId = user?.id || 0;
  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const client = registerClient(userId, (msg: string) => controller.enqueue(encoder.encode(msg)));
        client.write(': connected\n\n');
        const keepAlive = setInterval(() => { try { client.write(': ping\n\n'); } catch {} }, 25000);
        c.req.raw.signal.addEventListener('abort', () => {
          clearInterval(keepAlive);
          unregisterClient(client);
          try { controller.close(); } catch {}
        });
      },
    }),
    { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } }
  );
});
