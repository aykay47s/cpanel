import { Hono } from 'hono';
import { sql } from '../db';
import { requireRole, authenticate, requireAnyStaff } from '../auth';
import { logEvent } from '../audit';
import { broadcast, notify, notifyRole } from '../realtime';
import { smartParse, compareForDuplicate, normalizePhone, type ParsedLead } from '../parser';
import { sendPushToRole, sendPush } from '../push';

export const leads = new Hono();

function bad(c: any, msg: string, code = 400) { return c.json({ error: msg }, code); }

// ================= IMPORT =================
leads.post('/api/admin/leads/import/preview', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { text } = await c.req.json().catch(() => ({ text: '' }));
  if (!text) return bad(c, 'Text required');
  const { leads: parsed, redacted } = smartParse(text);
  if (!parsed.length) return c.json({ data: { leads: [], redacted } });

  // Any masked sensitive-data summary (e.g. "Card mentioned, masked: •••• 1111")
  // travels with the lead so it survives into the confirm step and gets stored
  // behind a blur toggle — never the raw card number itself.
  const extraInfoJoined = redacted.extraInfo.length ? redacted.extraInfo.join('; ') : null;

  // Check each parsed lead against EXISTING db leads for potential duplicates.
  const existing = await sql`SELECT id, first_name, last_name, phone, email FROM leads WHERE merged_into_id IS NULL AND tenant_id = ${user.tenant_id}`;
  const annotated = parsed.map((p) => {
    let bestMatch: { leadId: number; confidence: number; reasons: string[] } | null = null;
    for (const e of existing) {
      const cmp = compareForDuplicate(p, e);
      if (cmp && (!bestMatch || cmp.confidence > bestMatch.confidence)) {
        bestMatch = { leadId: e.id, confidence: cmp.confidence, reasons: cmp.reasons };
      }
    }
    return { ...p, extra_info: extraInfoJoined, potentialDuplicate: bestMatch };
  });
  return c.json({ data: { leads: annotated, redacted } });
});

leads.post('/api/admin/leads/import/confirm', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { leads: rows, source, lead_type, to_vault } = await c.req.json().catch(() => ({ leads: [] }));
  if (!Array.isArray(rows) || !rows.length) return bad(c, 'No leads to import');
  const initialStatus = to_vault ? 'vaulted' : 'not_called';

  const existing = await sql`SELECT id, first_name, last_name, phone, phone_e164, email FROM leads WHERE merged_into_id IS NULL AND tenant_id = ${user.tenant_id}`;
  let inserted = 0, flagged = 0;
  for (const r of rows as ParsedLead[]) {
    if (!r.phone) continue;
    const norm = normalizePhone(r.phone);
    const displayPhone = norm.valid ? norm.display : r.phone;
    const [lead] = await sql`
      INSERT INTO leads (first_name, last_name, phone, phone_e164, email, address, notes, extra_info, date_of_birth, source, lead_type, uploaded_by, tenant_id, status)
      VALUES (${r.first_name || null}, ${r.last_name || null}, ${displayPhone}, ${norm.e164}, ${r.email || null}, ${r.address || null}, ${r.notes || null}, ${(r as any).extra_info || null}, ${(r as any).date_of_birth || null}, ${source || 'import'}, ${lead_type || 'general'}, ${user.id}, ${user.tenant_id}, ${initialStatus})
      RETURNING *
    `;
    inserted++;
    await logEvent(lead.id, 'uploaded', user, null, initialStatus, { source: source || 'import', vaulted: !!to_vault });

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
    existing.push({ id: lead.id, first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, phone_e164: lead.phone_e164, email: lead.email });
    // A vaulted lead isn't actually available to anyone yet - no point alerting
    // callers to a lead they can't take until an admin releases it.
    if (!to_vault) broadcast('new_lead', lead);
  }
  if (inserted > 0 && !to_vault) {
    const name = inserted === 1 ? (rows[0] as ParsedLead).first_name || 'A lead' : `${inserted} leads`;
    await sendPushToRole('caller', 'New lead available', `${name} just came in — first to claim it wins.`, '/', user.tenant_id);
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
// ================= LEAD VAULT =================
// Imported leads can go here instead of straight to the live queue - admin controls
// exactly when (and how many at a time) become callable, useful when leads need
// reviewing first or should be drip-fed rather than all hitting the queue at once.
leads.get('/api/admin/vault', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const ageGroup = c.req.query('age_group');
  let ageFilter = sql``;
  if (ageGroup && ageGroup !== 'all') {
    const ranges: Record<string, [number, number]> = {
      '18-25': [18, 25], '26-35': [26, 35], '36-45': [36, 45],
      '46-55': [46, 55], '56-65': [56, 65], '65+': [65, 150],
    };
    const range = ranges[ageGroup];
    if (range) ageFilter = sql`AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN ${range[0]} AND ${range[1]}`;
  }
  const rows = await sql`SELECT *, CASE WHEN date_of_birth IS NOT NULL THEN date_part('year', age(date_of_birth))::int ELSE NULL END as age
    FROM leads WHERE status = 'vaulted' AND tenant_id = ${user.tenant_id} ${ageFilter} ORDER BY created_at ASC`;
  const [ageStats] = await sql`SELECT
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 18 AND 25)::int as "18-25",
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 26 AND 35)::int as "26-35",
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 36 AND 45)::int as "36-45",
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 46 AND 55)::int as "46-55",
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN 56 AND 65)::int as "56-65",
      COUNT(*) FILTER (WHERE date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) > 65)::int as "65+",
      COUNT(*) FILTER (WHERE date_of_birth IS NULL)::int as unknown
    FROM leads WHERE status = 'vaulted' AND tenant_id = ${user.tenant_id}`;
  return c.json({ data: rows, ageStats });
});

leads.post('/api/admin/vault/release', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { ids, count, age_group } = await c.req.json().catch(() => ({}));
  const admin = c.get('user');
  let targetIds: number[] = [];
  if (Array.isArray(ids) && ids.length) {
    targetIds = ids;
  } else if (count) {
    // "Release N at a time" - oldest-vaulted-first, optionally within one age group.
    const ranges: Record<string, [number, number]> = {
      '18-25': [18, 25], '26-35': [26, 35], '36-45': [36, 45],
      '46-55': [46, 55], '56-65': [56, 65], '65+': [65, 150],
    };
    const range = age_group && ranges[age_group];
    const rows = range
      ? await sql`SELECT id FROM leads WHERE status = 'vaulted' AND tenant_id = ${user.tenant_id} AND date_of_birth IS NOT NULL AND date_part('year', age(date_of_birth)) BETWEEN ${range[0]} AND ${range[1]} ORDER BY created_at ASC LIMIT ${count}`
      : await sql`SELECT id FROM leads WHERE status = 'vaulted' AND tenant_id = ${user.tenant_id} ORDER BY created_at ASC LIMIT ${count}`;
    targetIds = rows.map((r: any) => r.id);
  }
  if (!targetIds.length) return c.json({ released: 0 });

  const released = await sql`UPDATE leads SET status = 'not_called', updated_at = now() WHERE id = ANY(${targetIds}) AND tenant_id = ${user.tenant_id} AND status = 'vaulted' RETURNING *`;
  for (const lead of released) {
    await logEvent(lead.id, 'released_from_vault', admin, 'vaulted', 'not_called', {});
    broadcast('new_lead', lead);
  }
  if (released.length) {
    const name = released.length === 1 ? (released[0].first_name || 'A lead') : `${released.length} leads`;
    await sendPushToRole('caller', 'New lead available', `${name} just came in — first to claim it wins.`, '/', user.tenant_id);
  }
  return c.json({ released: released.length });
});

leads.get('/api/admin/leads', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { status, assigned_caller_id, assigned_finisher_id, search } = c.req.query();
  let rows;
  if (search) {
    const s = `%${search}%`;
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name,
        (SELECT COUNT(*) FROM lead_notes WHERE lead_notes.lead_id = leads.id)::int as note_count
      FROM leads
      LEFT JOIN users uc ON uc.id = leads.assigned_caller_id
      LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id
      LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL AND leads.tenant_id = ${user.tenant_id} AND (leads.phone ILIKE ${s} OR leads.first_name ILIKE ${s} OR leads.last_name ILIKE ${s} OR leads.email ILIKE ${s})
      ORDER BY leads.created_at DESC LIMIT 300`;
  } else if (status) {
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name,
        (SELECT COUNT(*) FROM lead_notes WHERE lead_notes.lead_id = leads.id)::int as note_count
      FROM leads LEFT JOIN users uc ON uc.id = leads.assigned_caller_id LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL AND leads.tenant_id = ${user.tenant_id} AND leads.status = ${status} ORDER BY leads.created_at DESC LIMIT 300`;
  } else {
    rows = await sql`
      SELECT leads.*, uc.name as caller_name, uf.name as finisher_name, uu.name as uploaded_by_name,
        (SELECT COUNT(*) FROM lead_notes WHERE lead_notes.lead_id = leads.id)::int as note_count
      FROM leads LEFT JOIN users uc ON uc.id = leads.assigned_caller_id LEFT JOIN users uf ON uf.id = leads.assigned_finisher_id LEFT JOIN users uu ON uu.id = leads.uploaded_by
      WHERE leads.merged_into_id IS NULL AND leads.tenant_id = ${user.tenant_id} ORDER BY leads.created_at DESC LIMIT 300`;
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
  const callerNotes = await sql`SELECT lead_notes.*, users.name as author_name, users.avatar as author_avatar, users.pfp_data as author_pfp_data FROM lead_notes LEFT JOIN users ON users.id = lead_notes.author_id WHERE lead_id = ${id} ORDER BY created_at ASC`;
  const dupes = await sql`SELECT * FROM duplicate_flags WHERE lead_id_a = ${id} OR lead_id_b = ${id}`;
  return c.json({ data: { ...lead, events, callerNotes, duplicates: dupes } });
});

leads.delete('/api/admin/leads/:id', requireRole('admin'), async (c) => {
  const id = c.req.param('id');
  await sql`DELETE FROM duplicate_flags WHERE lead_id_a = ${id} OR lead_id_b = ${id}`;
  await sql`DELETE FROM lead_events WHERE lead_id = ${id}`;
  await sql`DELETE FROM notifications WHERE related_lead_id = ${id}`;
  // Older deployments left a 'calls' table behind with a lead_id FK — clean it up if
  // present, but don't fail on environments where it never existed.
  try { await sql`DELETE FROM calls WHERE lead_id = ${id}`; } catch {}
  await sql`UPDATE leads SET merged_into_id = NULL WHERE merged_into_id = ${id}`;
  await sql`DELETE FROM leads WHERE id = ${id}`;
  return c.json({ ok: true });
});

leads.get('/api/admin/dashboard', requireRole('admin'), async (c) => {
  const user = c.get('user');
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
    FROM leads WHERE merged_into_id IS NULL AND tenant_id = ${user.tenant_id}`;
  const [staff] = await sql`
    SELECT
      COUNT(*) FILTER (WHERE role = 'caller' AND clocked_in)::int as callers_online,
      COUNT(*) FILTER (WHERE role = 'finisher' AND clocked_in)::int as finishers_online
    FROM users WHERE tenant_id = ${user.tenant_id}`;
  const recentEvents = await sql`
    SELECT lead_events.*, users.name as actor_name, leads.first_name, leads.last_name, leads.phone
    FROM lead_events LEFT JOIN users ON users.id = lead_events.actor_id LEFT JOIN leads ON leads.id = lead_events.lead_id
    WHERE leads.tenant_id = ${user.tenant_id}
    ORDER BY lead_events.created_at DESC LIMIT 25`;
  const onCall = await sql`
    SELECT leads.id as lead_id, leads.first_name, leads.last_name, leads.phone, leads.status, leads.call_started_at,
      users.id as caller_id, users.name as caller_name, users.avatar as caller_avatar, users.pfp_data as caller_pfp_data
    FROM leads JOIN users ON users.id = leads.assigned_caller_id
    WHERE leads.status IN ('calling', 'active_call') AND leads.tenant_id = ${user.tenant_id}
    ORDER BY leads.call_started_at ASC`;
  return c.json({ data: { ...counts, ...staff, recentEvents, onCall } });
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
  await sendPush(finisherId, 'Lead assigned to you', `${updated.first_name || 'Unknown'} ${updated.last_name || ''} is ready for you to close.`.trim(), '/');
  broadcast('lead_updated', updated);
  return c.json({ data: updated });
});

// Send a still-open lead directly to a specific caller instead of leaving it in the
// race-to-claim pool. It stays 'not_called' (so the normal call flow still applies)
// but is reserved — only that caller (or admin) can claim it.
leads.post('/api/admin/leads/:id/assign-caller', requireRole('admin'), async (c) => {
  const user = c.get('user');
  const { callerId } = await c.req.json().catch(() => ({}));
  if (!callerId) return bad(c, 'callerId required');
  const [caller] = await sql`SELECT id, name, role FROM users WHERE id = ${callerId}`;
  if (!caller || caller.role !== 'caller') return bad(c, 'Target user is not a caller');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead) return bad(c, 'Not found', 404);
  if (lead.status !== 'not_called') return bad(c, 'Only unclaimed leads can be sent to a caller');
  const [updated] = await sql`UPDATE leads SET assigned_caller_id = ${callerId}, updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, lead.assigned_caller_id ? 'reassigned_caller' : 'sent_to_caller', user, lead.status, lead.status, { caller_id: callerId, caller_name: caller.name });
  await notify(callerId, 'lead_assigned', `A lead was sent to you: ${updated.first_name || 'Unknown'} ${updated.last_name || ''}`.trim(), updated.id);
  await sendPush(callerId, 'Lead sent to you', `${updated.first_name || 'Unknown'} ${updated.last_name || ''} is waiting in your queue.`.trim(), '/');
  broadcast('new_lead', updated);
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
  const user = c.get('user');
  const rows = await sql`SELECT * FROM leads WHERE status = 'not_called' AND tenant_id = ${user.tenant_id} AND (assigned_caller_id IS NULL OR assigned_caller_id = ${user.id}) AND merged_into_id IS NULL ORDER BY (assigned_caller_id = ${user.id}) DESC, created_at ASC LIMIT 20`;
  return c.json({ data: rows });
});

// Team-wide call activity - every caller can see who called who, when, and what
// happened. Every outcome is already logged via logEvent(), this just reads it back
// in the shape callers actually want: name, who called, when, what happened.
leads.get('/api/caller/call-log', requireAnyStaff, async (c) => {
  const user = c.get('user');
  const rows = await sql`
    SELECT lead_events.id, lead_events.created_at, lead_events.to_status as outcome,
      lead_events.actor_id, users.name as caller_name, users.avatar as caller_avatar, users.pfp_data as caller_pfp_data,
      leads.id as lead_id, leads.first_name, leads.last_name, leads.phone
    FROM lead_events
    LEFT JOIN users ON users.id = lead_events.actor_id
    LEFT JOIN leads ON leads.id = lead_events.lead_id
    WHERE lead_events.event_type = 'outcome_recorded' AND leads.tenant_id = ${user.tenant_id}
    ORDER BY lead_events.created_at DESC
    LIMIT 50`;
  return c.json({ data: rows });
});

leads.get('/api/caller/mine', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const [row] = await sql`SELECT * FROM leads WHERE assigned_caller_id = ${user.id} AND tenant_id = ${user.tenant_id} AND status IN ('calling','active_call','call_ended') ORDER BY updated_at DESC LIMIT 1`;
  return c.json({ data: row || null });
});

leads.post('/api/caller/leads/:id/claim', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  // Claimable if genuinely open, OR if an admin specifically sent it to this caller -
  // and never across a tenant boundary, regardless of what id is guessed/passed in.
  const [updated] = await sql`UPDATE leads SET status = 'calling', assigned_caller_id = ${user.id}, call_started_at = now(), updated_at = now(), call_attempts = call_attempts + 1
    WHERE id = ${id} AND tenant_id = ${user.tenant_id} AND status = 'not_called' AND (assigned_caller_id IS NULL OR assigned_caller_id = ${user.id}) RETURNING *`;
  if (!updated) return c.json({ claimed: false, reason: 'Already taken' }, 409);
  await logEvent(updated.id, 'claimed', user, 'not_called', 'calling', {});
  await awardXp(user.id, 5, 'claimed', updated.id);
  broadcast('lead_claimed', { id: Number(id) });
  return c.json({ claimed: true, data: updated });
});

leads.post('/api/caller/leads/:id/connect', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);
  const [updated] = await sql`UPDATE leads SET status = 'active_call', updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'call_connected', user, 'calling', 'active_call', {});
  await awardXp(user.id, 10, 'connected', updated.id);
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
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);
  const [noteRow] = await sql`INSERT INTO lead_notes (lead_id, author_id, content) VALUES (${c.req.param('id')}, ${user.id}, ${note.trim()}) RETURNING *`;
  await logEvent(c.req.param('id'), 'note_added', user, null, null, { note: note.trim() });
  broadcast('lead_note', { leadId: Number(c.req.param('id')), note: { ...noteRow, author_name: user.name } });
  await awardXp(user.id, 3, 'note_added', Number(c.req.param('id')));
  return c.json({ data: noteRow });
});

leads.get('/api/leads/:id/notes', requireAnyStaff, async (c) => {
  const rows = await sql`SELECT lead_notes.*, users.name as author_name, users.avatar as author_avatar, users.pfp_data as author_pfp_data FROM lead_notes LEFT JOIN users ON users.id = lead_notes.author_id WHERE lead_id = ${c.req.param('id')} ORDER BY created_at ASC`;
  return c.json({ data: rows });
});

// XP is earned for effort, not only wins — every dial that reaches an outcome
// pays something, so the leaderboard rewards the person grinding through 60
// voicemails as well as the person who lands the close. A successful call is
// still worth an order of magnitude more, because that's the job.
const XP_MAP: Record<string, number> = {
  successful_call: 100, callback_requested: 15, requires_review: 10, failed: 10,
  voicemail: 5, no_answer: 5, hung_up: 5, busy: 3,
  cancelled: 0, chopped_previously: 2,
};
// Single choke point for all XP: bumps the running total AND records the event
// row that weekly leaderboards are computed from. Returns the amount so route
// handlers can tell the client what was just earned (for the +XP toast).
async function awardXp(userId: number, amount: number, reason: string, leadId?: number): Promise<number> {
  if (!amount) return 0;
  await sql`UPDATE users SET xp = xp + ${amount} WHERE id = ${userId}`;
  await sql`INSERT INTO xp_events (user_id, amount, reason, lead_id) VALUES (${userId}, ${amount}, ${reason}, ${leadId || null})`.catch(() => {});
  return amount;
}
// Outcomes where nothing meaningful happened yet — the lead goes back to the open
// pool for someone else (or the same caller later) to try again.
const REQUEUE_OUTCOMES = ['voicemail', 'hung_up', 'no_answer', 'busy', 'callback_requested', 'cancelled'];
// chopped_previously: someone else already worked this lead — terminal, not retried.
const OUTCOME_STATUS_MAP: Record<string, string> = {
  successful_call: 'ready_for_finishing',
  chopped_previously: 'failed',
};

leads.post('/api/caller/leads/:id/outcome', requireRole('caller'), async (c) => {
  const user = c.get('user');
  const { outcome, notes } = await c.req.json().catch(() => ({}));
  const validOutcomes = ['successful_call', 'failed', 'requires_review', 'chopped_previously', ...REQUEUE_OUTCOMES];
  if (!validOutcomes.includes(outcome)) return bad(c, 'Invalid outcome');
  const [lead] = await sql`SELECT status, assigned_caller_id FROM leads WHERE id = ${c.req.param('id')}`;
  if (!lead || lead.assigned_caller_id !== user.id) return bad(c, 'Not your lead', 403);

  let finalStatus: string;
  if (REQUEUE_OUTCOMES.includes(outcome)) finalStatus = 'not_called';
  else finalStatus = OUTCOME_STATUS_MAP[outcome] || outcome; // 'failed' | 'requires_review' | mapped

  const [updated] = REQUEUE_OUTCOMES.includes(outcome)
    ? await sql`UPDATE leads SET status = ${finalStatus}, outcome = ${outcome}, notes = COALESCE(${notes || null}, notes), assigned_caller_id = NULL, updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`
    : await sql`UPDATE leads SET status = ${finalStatus}, outcome = ${outcome}, notes = COALESCE(${notes || null}, notes), updated_at = now() WHERE id = ${c.req.param('id')} RETURNING *`;
  await logEvent(updated.id, 'outcome_recorded', user, lead.status, outcome, { notes: notes || null });
  if (outcome === 'successful_call') {
    await logEvent(updated.id, 'queued_for_finishing', user, outcome, 'ready_for_finishing', {});
    await notifyRole('admin', 'successful_call', `${user.name} logged a successful call: ${updated.first_name || 'Unknown'} ${updated.last_name || ''}`.trim(), updated.id, undefined, user.tenant_id);
  }
  if (REQUEUE_OUTCOMES.includes(outcome)) {
    broadcast('new_lead', updated);
    // A requeued lead is genuinely available to claim again - same real push as a
    // fresh import, since from a caller's perspective it's the same "something to
    // claim right now" moment, whatever put it back in the pool.
    await sendPushToRole('caller', 'Lead available', `${updated.first_name || 'A lead'} is back in the queue.`, '/', user.tenant_id);
  }
  const xpAwarded = await awardXp(user.id, XP_MAP[outcome] || 0, 'outcome:' + outcome, updated.id);
  broadcast('lead_updated', updated);
  return c.json({ data: updated, xp_awarded: xpAwarded });
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
  const xpAwarded = await awardXp(user.id, outcome === 'completed' ? 75 : 15, 'finisher:' + outcome, updated.id);
  broadcast('lead_updated', updated);
  return c.json({ data: updated, xp_awarded: xpAwarded });
});
