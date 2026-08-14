import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, requireAnyStaff } from '../auth';

export const scripts = new Hono();
function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// ============================================================================
// AI SCRIPT WRITER — calls any OpenAI-compatible endpoint(s), configured via env.
// No artificial limits or content filters are imposed here; whatever the
// configured backend allows is what the operator gets.
//
// MULTI-PROVIDER FAILOVER: free-tier providers (Gemini, Groq, etc.) intermittently
// return 503 "high demand" or 429 rate-limit errors, especially once many panels
// share one key. So this supports a CHAIN of providers, tried in order — if one
// is overloaded or rate-limited, it automatically falls through to the next
// instead of failing the request. Configure providers as a numbered list:
//   LLM_API_BASE / LLM_API_KEY / LLM_MODEL             — provider 1 (primary)
//   LLM_API_BASE_2 / LLM_API_KEY_2 / LLM_MODEL_2        — provider 2 (fallback)
//   LLM_API_BASE_3 / LLM_API_KEY_3 / LLM_MODEL_3        — provider 3 (fallback)
// Only LLM_API_KEY is required; missing LLM_API_BASE_N defaults to Groq's API,
// and any provider whose key isn't set is simply skipped in the chain.
// ============================================================================
type LlmProvider = { base: string; key: string; model: string };
function llmProviders(): LlmProvider[] {
  const providers: LlmProvider[] = [];
  const suffixes = ['', '_2', '_3'];
  for (const suf of suffixes) {
    const key = process.env['LLM_API_KEY' + suf];
    if (!key) continue;
    const base = (process.env['LLM_API_BASE' + suf] || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
    const model = process.env['LLM_MODEL' + suf] || 'llama-3.3-70b-versatile';
    providers.push({ base, key, model });
  }
  return providers;
}
// Errors worth retrying / falling through to the next provider for — transient
// capacity issues, not "your request was malformed" (those won't fix themselves).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
async function callLlmWithFailover(sys: string, prompt: string): Promise<{ text: string } | { error: string; status: number }> {
  const providers = llmProviders();
  if (!providers.length) return { error: 'AI script writer is not configured. Set LLM_API_KEY (and optionally LLM_API_BASE / LLM_MODEL) in the environment.', status: 503 };
  let lastError = '';
  let lastStatus = 502;
  for (const p of providers) {
    // One retry per provider (short backoff) before moving to the next provider —
    // handles a genuinely momentary blip without burning through the whole chain.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`${p.base}/chat/completions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: p.model,
            messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 1600,
          }),
        });
        if (res.ok) {
          const data: any = await res.json();
          const text: string = data?.choices?.[0]?.message?.content || '';
          if (text) return { text };
          lastError = 'Empty response from provider'; lastStatus = 502;
          break; // don't retry an empty-but-200 response on the same provider
        }
        const errText = await res.text().catch(() => '');
        lastError = errText.slice(0, 300); lastStatus = res.status;
        if (!RETRYABLE_STATUS.has(res.status)) break; // real error (bad key, bad request) — skip to next provider, don't retry
        if (attempt === 0) await new Promise(r => setTimeout(r, 600)); // brief backoff before the retry
      } catch (netErr: any) {
        lastError = netErr?.message || 'Network error'; lastStatus = 502;
      }
    }
    // Fell through this provider's attempts — try the next one in the chain.
  }
  return { error: lastError || 'All configured AI providers failed.', status: lastStatus };
}

scripts.post('/api/admin/scripts/generate', requireRole('admin'), async (c) => {
  if (!llmProviders().length) return c.json({ error: 'AI script writer is not configured. Set LLM_API_KEY (and optionally LLM_API_BASE / LLM_MODEL) in the environment.' }, 503);

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
    const result = await callLlmWithFailover(sys, prompt);
    if ('error' in result) {
      return c.json({ error: 'The AI provider returned an error (' + result.status + '). ' + result.error }, 502);
    }
    let text = result.text;
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
