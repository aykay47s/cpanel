import { Hono } from 'hono';
import { sql, ensureDb } from './src/db';
import { leads } from './src/routes/leads';
import { users } from './src/routes/users';
import { chat } from './src/routes/chat';
import { notifications } from './src/routes/notifications';
import { announcements } from './src/routes/announcements';
import { scripts } from './src/routes/scripts';
import { misc } from './src/routes/misc';
import { page } from './src/frontend';

const app = new Hono();
const ADMIN_PIN = process.env.ADMIN_PIN || '9247';

// Every uncaught error becomes a proper JSON response with the real error message
// logged server-side — never Bun's default plain-text crash page, which is what was
// breaking the frontend's res.json() calls with "Unexpected token 'I'" errors.
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}] Unhandled error:`, err);
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

app.use('*', async (c, next) => {
  await ensureDb();
  // Bootstrap: ensure at least one admin exists, seeded from ADMIN_PIN.
  const [existingAdmin] = await sql`SELECT id FROM users WHERE role = 'admin' LIMIT 1`;
  if (!existingAdmin) {
    await sql`INSERT INTO users (name, pin, role) VALUES ('Admin', ${ADMIN_PIN}, 'admin') ON CONFLICT (pin) DO NOTHING`;
  }
  await next();
});

app.route('/', leads);
app.route('/', users);
app.route('/', chat);
app.route('/', notifications);
app.route('/', announcements);
app.route('/', scripts);
app.route('/', misc);

app.get('/sw.js', async (c) => {
  const file = Bun.file('./public/sw.js');
  c.header('Content-Type', 'application/javascript');
  c.header('Service-Worker-Allowed', '/');
  return c.body(await file.text());
});

app.get('/manifest.json', (c) => {
  return c.json({
    name: 'Frap Ties',
    short_name: 'Frap Ties',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080b',
    theme_color: '#08080b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  });
});

app.get('/icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon.png').arrayBuffer()); });
app.get('/icon-192.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-192.png').arrayBuffer()); });
app.get('/icon-512.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/icon-512.png').arrayBuffer()); });
app.get('/apple-touch-icon.png', async (c) => { c.header('Content-Type', 'image/png'); return c.body(await Bun.file('./public/apple-touch-icon.png').arrayBuffer()); });

app.get('/', (c) => {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  return c.html(page);
});

export default {
  port: Number(process.env.PORT) || 8080,
  fetch: app.fetch,
};
