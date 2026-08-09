import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate } from '../auth';
import { logEvent } from '../audit';
import { broadcast, notify, notifyRole } from '../realtime';
import { smartParse, compareForDuplicate, type ParsedLead } from '../parser';

export const leads = new Hono();

function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// ================= IMPORT =================
leads.post('/api/admin/leads/import/preview', requireRole('admin'), async (c) => {
  const { text } = await c.req.json().catch(() => ({ text: '' }));
  if (!text) return bad(c, 'Text required');
  const { leads: parsed, redacted } = smartParse(text);
  if (!parsed.length) return c.json({ data: { leads: [], redacted } });

  // Check each parsed lead against EXISTING db leads for potential duplicates.
  const existing = await sql`SELECT id, first_name, last_name, phone, email FROM leads WHERE merged_into_id IS NULL`;
  const annotated = parsed.map((p) => {
    let bestMatch: { leadId: number; confidence: number; reasons: string[] } | null = null;
    for (const e of existing) {
      const cmp = compareForDuplicate(p, e);
      if (cmp && (!bestMatch || cmp.confidence > bestMatch.confidence)) {
        bestMatch = { leadId: e.id, confidence: cmp.confidence, reasons: cmp.reasons };
      }
    }
    return { ...p, potentialDuplicate: bestMatch };
  });
  return c.json({ data: { leads: annotated, redacted } });
});

leads.post('/api/admin/leads/import/confirm', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { leads: rows, source, lead_type } = await c.req.json().catch(() => ({ leads: [] }));
  if (!Array.isArray(rows) || !rows.length) return bad(c, 'No leads to import');

  const existing = await sql`SELECT id, first_name, last_name, phone, email FROM leads WHERE merged_into_id IS NULL`;
  let inserted = 0, flagged = 0;
  for (const r of rows as ParsedLead[]) {
    if (!r.phone) continue;
    const [lead] = await sql`
      INSERT INTO leads (first_name, last_name, phone, email, address, notes, source, lead_type, uploaded_by)
      VALUES (${r.first_name || null}, ${r.last_name || null}, ${r.phone}, ${r.email || null}, ${r.address || null}, ${r.notes || null}, ${source || 'import'}, ${lead_type || 'general'}, ${user.id})
      RETURNING *
    `;
    inserted++;
    await logEvent(lead.id, 'uploaded', user, null, 'not_called', { source: source || 'import' });

    let bestMatch: { leadId: number; confidence: number; reasons: string[] } | null = null;
    for (const e of existing) {
      const cmp = compareForDuplicate(r, e);
      if (cmp && (!bestMatch || cmp.confidence > bestMatch.confidence)) bestMatch = { leadId: e.id, confidence: cmp.confidence, reasons: cmp.reasons };
    }
    if (bestMatch) {
      await sql`UPDATE leads SET dedup_status = 'flagged' WHERE id = ${lead.id}`;
      await sql`INSERT INTO duplicate_flags (lead_id_a, lead_id_b, confidence, reasons) VALUES (${lead.id}, ${bestMatch.leadId}, ${bestMatch.confidence}, ${sql.json(bestMatch.reasons)})`;
      flagged++;
    }
    existing.push({ id: lead.id, first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email });
    broadcast('new_lead', lead);
  }
  return c.json({ inserted, flagged });
});

// ================= DUPLICATE REVIEW =================
leads.get('/api/admin/duplicates', requireRole('admin'), async (c) => {
  const rows = await sql`
    SELECT df.*, 
      json_build_object('id', la.id, 'first_name', la.first_name, 'last_name', la.last_name, 'phone', la.phone, 'email', la.email, 'created_at', la.created_at) as lead_a,
      json_build_object('id', lb.id, 'first_name', lb.first_name, 'last_name', lb.last_name, 'phone', lb.phone, 'email', lb.email, 'created_at', lb.created_at) as lead_b
    FROM duplicate_flags df
    JOIN leads la ON la.id = df.lead_id_a
    JOIN leads lb ON lb.id = df.lead_id_b
    WHERE df.status = 'pending'
    ORDER BY df.confidence DESC, df.created_at DESC
  `;
  return c.json({ data: rows });
});

leads.post('/api/admin/duplicates/:id/resolve', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { decision } = await c.req.json().catch(() => ({}));
  if (!['confirmed_duplicate', 'not_duplicate'].includes(decision)) return bad(c, 'Invalid decision');
  const [flag] = await sql`UPDATE duplicate_flags SET status = ${decision}, reviewed_by = ${user.id}, reviewed_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  if (!flag) return bad(c, 'Not found', 404);
  if (decision === 'confirmed_duplicate') {
    await sql`UPDATE leads SET merged_into_id = ${flag.lead_id_b}, dedup_status = 'confirmed_duplicate' WHERE id = ${flag.lead_id_a}`;
    await logEvent(flag.lead_id_a, 'merged', user, null, null, { merged_into: flag.lead_id_b });
  } else {
    await sql`UPDATE leads SET dedup_status = 'clear' WHERE id = ${flag.lead_id_a}`;
    await logEvent(flag.lead_id_a, 'duplicate_dismissed', user, null, null, { compared_to: flag.lead_id_b });
  }
  return c.json({ ok: true });
});

// ================= ADMIN: LIST / DETAIL =================
leads.get('/api/admin/leads', requireRole('admin'), async (c) => {
  const { status, assigned_caller_id, assigned_finisher_id, search } = c.req.query();
  let rows;
  if (search) {
    const s = `%${search}%`;
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name
      FROM leads
      LEFT JOIN users uc ON uc.id = leads.assigned_caller_id
      LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id
      LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL AND (leads.phone ILIKE ${s} OR leads.first_name ILIKE ${s} OR leads.last_name ILIKE ${s} OR leads.email ILIKE ${s})
      ORDER BY leads.created_at DESC LIMIT 300`;
  } else if (status) {
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name
      FROM leads LEFT JOIN users uc ON uc.id = leads.assigned_caller_id LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL AND leads.status = ${status} ORDER BY leads.created_at DESC LIMIT 300`;
  } else {
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name
      FROM leads LEFT JOIN users uc ON uc.id = leads.assigned_caller_id LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL ORDER BY leads.created_at DESC LIMIT 300`;
  }
  return c.json({ data: rows });
});

leads.get('/api/admin/leads/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  const [lead] = await sql`
    SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name
    FROM leads LEFT JOIN users uc ON uc.id = leads.assigned_caller_id LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id LEFT JOIN users uu ON uu.id = leads.uploaded_by
    WHERE leads.id = ${id}`;
  if (!lead) return bad(c, 'Not found', 404);
  const events = await sql`SELECT lead_events.*, users.name as actor_name FROM lead_events LEFT JOIN users ON users.id = lead_events.actor_id WHERE lead_id = ${id} ORDER BY created_at ASC`;
  const dupes = await sql`SELECT * FROM duplicate_flags WHERE lead_id_a = ${id} OR lead_id_b = ${id}`;
  return c.json({ data: { ...lead, events, duplicates: dupes } });
});

leads.get('/api/admin/dashboard', requireRole('admin'), async (c) => {
  const [counts] = await sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(*) FILTER (WHERE status = 'not_called')::int as uncalled,
      COUNT(*) FILTER (WHERE status IN ('calling','active_call'))::int as active_calls,
      COUNT(*) FILTER (WHERE status IN ('completed'))::int as completed,
      COUNT(*) FILTER (WHERE status = 'successful_call')::int as successful,
      COUNT(*) FILTER (WHERE status = 'ready_for_finishing')::int as awaiting_finishing,
      COUNT(*) FILTER (WHERE status = 'assigned_to_finisher')::int as assigned_finishing,
      COUNT(*) FILTER (WHERE status = 'requires_review')::int as requires_review
    FROM leads WHERE merged_into_id IS NULL`;
  const [staff] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE role = 'caller' AND clocked_in)::int as callers_online,
      COUNT(*) FILTER (WHERE role = 'finisher' AND clocked_in)::int as finishers_online
    FROM users`;
  const recentEvents = await sql`
    SELECT lead_events.*, users.name as actor_name, leads.first_name, leads.last_name, leads.phone
    FROM lead_events LEFT JOIN users ON users.id = lead_events.actor_id LEFT JOIN leads ON leads.id = lead_events.lead_id
    ORDER BY lead_events.created_at DESC LIMIT 25`;
  return c.json({ data: { ...counts, ...staff, recentEvents } });
});

// ================= FINISHING QUEUE (ADMIN) =================
leads.get('/api/admin/finishing-queue', requireRole('admin'), async (c) => {
  const rows = await sql`
    SELECT leads.*, uf.name as finisher_name FROM leads LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id
    WHERE leads.status IN ('ready_for_finishing','assigned_to_finisher') AND leads.merged_into_id IS NULL
    ORDER BY leads.updated_at ASC`;
  return c.json({ data: rows });
});

leads.post('/api/admin/leads/:id/assign-finisher', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { finisherId } = await c.req.json().catch(() => ({}));
  if (!finisherId) return bad(c, 'finisherId required');
  const [finisher] = await sql`SELECT id, name, role FROM users WHERE id = ${finisherId}`;
  if (!finisher || finisher.role !== 'finisher') return bad(c, 'Target user is not a finisher');
  const [lead] = await sql`SELECT status, assigned_finisher_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead) return bad(c, 'Not found', 404);
  const [updated] = await sql`UPDATE leads SET status = 'assigned_to_finisher', assigned_finisher_id = ${finisherId}, updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, lead.assigned_finisher_id ? 'reassigned_finisher' : 'assigned_finisher', user, lead.status, 'assigned_to_finisher', { finisher_id: finisherId, finisher_name: finisher.name });
  await notify(finisherId, 'lead_assigned', `You've been assigned a lead: ${updated.first_name || 'Unknown'} ${updated.last_name || ''}`.trim(), updated.id);
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});

leads.post('/api/admin/leads/:id/override-status', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { status, note } = await c.req.json().catch(() => ({}));
  const [lead] = await sql`SELECT status FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead) return bad(c, 'Not found', 404);
  const [updated] = await sql`UPDATE leads SET status = ${status}, updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'admin_override', user, lead.status, status, { note: note || null });
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});

// ================= CALLER LIFECYCLE =================
leads.get('/api/caller/queue', requireRole('caller'), async (c) => {
  const rows = await sql`SELECT * FROM leads WHERE status = 'not_called' AND assigned_caller_id IS NULL AND merged_into_id IS NULL ORDER BY created_at ASC LIMIT 20`;
  return c.json({ data: rows });
});

leads.get('/api/caller/mine', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const [row] = await sql`SELECT * FROM leads WHERE assigned_caller_id = ${user.id} AND status IN ('calling','active_call','call_ended') ORDER BY updated_at DESC LIMIT 1`;
  return c.json({ data: row || null });
});

leads.post('/api/caller/leads/:id/claim', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const [updated] = await sql`UPDATE leads SET status = 'calling', assigned_caller_id = ${user.id}, call_started_at = now(), updated_at = now() WHERE id = ${id} AND status = 'not_called' AND assigned_caller_id IS NULL RETURNING *`;
  if (!updated) return c.json({ claimed: false, reason: 'Already taken' }, 409);
  await logEvent(updated.id, 'claimed', user, 'not_called', 'calling', {});
  broadcast('lead_claimed', { id: Number(id) });
  return c.json({ claimed: true, data: updated });
});

leads.post('/api/caller/leads/:id/connect', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);
  const [updated] = await sql`UPDATE leads SET status = 'active_call', updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'call_connected', user, 'calling', 'active_call', {});
  return c.json({ data: updated });
});

leads.post('/api/caller/leads/:id/end-call', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);
  const [updated] = await sql`UPDATE leads SET status = 'call_ended', call_ended_at = now(), updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'call_ended', user, lead.status, 'call_ended', {});
  return c.json({ data: updated });
});

// Live note: callers can push notes WHILE still on the call, so admins see them
// immediately rather than waiting for the final disposition.
leads.post('/api/caller/leads/:id/note', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const { note } = await c.req.json().catch(() => ({}));
  if (!note || !note.trim()) return bad(c, 'Note cannot be empty');
  const [lead] = await sql`SELECT status, assigned_caller_id, notes FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);
  const combined = lead.notes ? lead.notes + '\n' + note.trim() : note.trim();
  const [updated] = await sql`UPDATE leads SET notes = ${combined}, updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'note_added', user, null, null, { note: note.trim() });
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});

const XP_MAP: Record<string, number> = { successful_call: 30, failed: 5, requires_review: 5 };

leads.post('/api/caller/leads/:id/outcome', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const { outcome, notes } = await c.req.json().catch(() => ({}));
  if (!['successful_call', 'failed', 'requires_review'].includes(outcome)) return bad(c, 'Invalid outcome');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);

  const finalStatus = outcome === 'successful_call' ? 'ready_for_finishing' : outcome;
  const [updated] = await sql`UPDATE leads SET status = ${finalStatus}, outcome = ${outcome}, notes = COALESCE(${notes || null}, notes), updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'outcome_recorded', user, lead.status, outcome, { notes: notes || null });
  if (outcome === 'successful_call') {
    await logEvent(updated.id, 'queued_for_finishing', user, outcome, 'ready_for_finishing', {});
    await notifyRole('admin', 'successful_call', `${user.name} logged a successful call: ${updated.first_name || 'Unknown'} ${updated.last_name || ''}`.trim(), updated.id);
  }
  await sql`UPDATE users SET xp = xp + ${XP_MAP[outcome] || 0} WHERE id = ${user.id}`;
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});

// ================= FINISHER LIFECYCLE =================
leads.get('/api/finisher/queue', requireRole('finisher'), async (c) => {
  const user = c.get('user');
  const rows = await sql`SELECT * FROM leads WHERE assigned_finisher_id = ${user.id} AND status = 'assigned_to_finisher' ORDER BY updated_at ASC`;
  return c.json({ data: rows });
});

leads.post('/api/finisher/leads/:id/outcome', requireRole('finisher'), async (c) => {
  const user = c.get('user');
  const { outcome, notes } = await c.req.json().catch(() => ({}));
  if (!['completed', 'failed', 'requires_review'].includes(outcome)) return bad(c, 'Invalid outcome');
  const [lead] = await sql`SELECT status, assigned_finisher_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_finisher_id !== user.id) return bad(c, 'Not your lead', 403);
  const [updated] = await sql`UPDATE leads SET status = ${outcome}, notes = COALESCE(${notes || null}, notes), updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'finisher_outcome', user, lead.status, outcome, { notes: notes || null });
  await sql`UPDATE users SET xp = xp + ${outcome === 'completed' ? 50 : 10} WHERE id = ${user.id}`;
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});
