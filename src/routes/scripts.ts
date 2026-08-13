import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, requireAnyStaff } from '../auth';

export const scripts = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// ============================================================================
// AI SCRIPT WRITER — calls any OpenAI-compatible endpoint (configured via env).
// No artificial limits or content filters are imposed here; whatever the
// configured backend allows is what the operator gets. Point LLM_API_BASE at a
// self-hosted FreeLLMAPI aggregator, Groq's free API, or any paid provider.
//   LLM_API_BASE  e.g. https://your-freellmapi-host/v1  (default: Groq)
//   LLM_API_KEY   the bearer token for that endpoint
//   LLM_MODEL     model id (default: llama-3.3-70b-versatile)
// ============================================================================
function llmConfig() {
  const base = (process.env.LLM_API_BASE || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const key = process.env.LLM_API_KEY || '';
  const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
  return { base, key, model };
}

scripts.post('/api/admin/scripts/generate', requireRole('admin'), async (c) => {
  const { base, key, model } = llmConfig();
  if (!key) return c.json({ error: 'AI script writer is not configured. Set LLM_API_KEY (and optionally LLM_API_BASE / LLM_MODEL) in the environment.' }, 503);

  const body = await c.req.json().catch(() => ({} as any));
  const brief: string = (body.brief || '').toString().slice(0, 4000);
  const audience: string = (body.audience || 'all').toString();
  const leadType: string = (body.lead_type || 'general').toString();
  const tone: string = (body.tone || '').toString().slice(0, 200);
  if (!brief.trim()) return c.json({ error: 'Describe the script you want in the brief.' }, 400);

  const audienceDesc = audience === 'opener' ? 'the OPENER / STARTER (the first caller who makes initial contact and qualifies the lead)'
    : audience === 'closer' ? 'the CLOSER / FINISHER (the caller who takes a qualified lead and closes)'
    : 'any caller on the call';

  const sys = `You are an expert cold-calling and telesales script writer for a call centre. You write natural, high-converting phone scripts that sound human, handle objections, and drive to a clear next step. You write scripts meant to be READ ALOUD on a live call. Return ONLY valid JSON, no markdown fences, no commentary.`;
  const prompt = `Write a call script for ${audienceDesc}.
Lead type / product: ${leadType}.
${tone ? 'Tone: ' + tone + '.' : ''}
Brief from the manager: ${brief}

Return a JSON object with exactly these keys:
{
  "title": "a short, punchy script name",
  "description": "one sentence on what this script is for and who should use it",
  "content": "the full script, written to be read aloud, with clear sections (opening, qualifying questions, objection handling, close). Use line breaks between sections."
}`;

  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1600,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return c.json({ error: 'The AI provider returned an error (' + res.status + '). ' + errText.slice(0, 300) }, 502);
    }
    const data: any = await res.json();
    let text: string = data?.choices?.[0]?.message?.content || '';
    // Strip accidental markdown fences, then parse.
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    let parsed: any;
    try { parsed = JSON.parse(text); }
    catch {
      // Fallback: if the model didn't return clean JSON, use the raw text as content.
      parsed = { title: brief.slice(0, 50), description: '', content: text };
    }
    return c.json({ data: {
      title: (parsed.title || 'Untitled script').toString().slice(0, 200),
      description: (parsed.description || '').toString().slice(0, 400),
      content: (parsed.content || '').toString(),
      audience, lead_type: leadType,
    }});
  } catch (err: any) {
    return c.json({ error: 'Could not reach the AI provider: ' + (err?.message || 'unknown') }, 502);
  }
});

// Read-only: callers/finishers can VIEW approved scripts during a call. They cannot
// create, edit, or manage them — that surface only exists under /api/admin/*.
scripts.get('/api/scripts', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const type = c.req.query('type');
  const rows = type
    ? await sql`SELECT id, title, content, lead_type, audience, description FROM scripts WHERE status = 'approved' AND tenant_id = ${user.tenant_id} AND (lead_type = ${type} OR lead_type = 'general') ORDER BY created_at DESC`
    : await sql`SELECT id, title, content, lead_type, audience, description FROM scripts WHERE status = 'approved' AND tenant_id = ${user.tenant_id} ORDER BY created_at DESC`;
  return c.json({ data: rows });
});

// Any caller/finisher can suggest a script — it enters as 'pending' until an admin
// approves it. This is intentionally separate from the admin-only management routes
// below: submitting a suggestion is not the same privilege as publishing one.
scripts.post('/api/scripts/submit', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const { title, content, lead_type } = await c.req.json().catch(() => ({}));
  if (!title || !content) return bad(c, 'Title and content required');
  const [row] = await sql`INSERT INTO scripts (title, content, lead_type, status, submitted_by, tenant_id) VALUES (${title}, ${content}, ${lead_type || 'general'}, 'pending', ${user.id}, ${user.tenant_id}) RETURNING *`;
  return c.json({ data: row });
});

scripts.get('/api/admin/scripts', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const rows = await sql`SELECT scripts.*, users.name as submitted_by_name FROM scripts LEFT JOIN users ON users.id = scripts.submitted_by WHERE scripts.tenant_id = ${user.tenant_id} ORDER BY scripts.created_at DESC`;
  return c.json({ data: rows });
});
scripts.post('/api/admin/scripts', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { title, content, lead_type, audience, description, ai_generated } = await c.req.json().catch(() => ({}));
  if (!title || !content) return bad(c, 'Title and content required');
  const [row] = await sql`INSERT INTO scripts (title, content, lead_type, audience, description, ai_generated, status, tenant_id) VALUES (${title}, ${content}, ${lead_type || 'general'}, ${audience || 'all'}, ${description || null}, ${ai_generated || false}, 'approved', ${user.tenant_id}) RETURNING *`;
  return c.json({ data: row });
});
scripts.delete('/api/admin/scripts/:id', requireRole('admin'), async (c) => {
  const user = c.get('user');
  await sql`DELETE FROM scripts WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id}`;
  return c.json({ ok: true });
});
scripts.post('/api/admin/scripts/:id/approve', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const [row] = await sql`UPDATE scripts SET status = 'approved' WHERE id = ${c.req.param('id')} AND tenant_id = ${user.tenant_id} RETURNING *`;
  if (!row) return bad(c, 'Not found', 404);
  return c.json({ data: row });
});
