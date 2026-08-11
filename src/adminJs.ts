export const ADMIN_JS = `
function switchAdminTab(tab) {
  if (typeof onCallTimerInterval !== 'undefined') clearInterval(onCallTimerInterval);
  currentAdminTab = tab;
  document.querySelectorAll('.side-link[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderAdminTab(tab);
}

async function renderAdminTab(tab) {
  const el = document.getElementById('adminContent');
  if (tab !== 'chat') el.innerHTML = '<div class="loading-shimmer"></div><div class="loading-shimmer" style="width:70%;"></div>';
  try {
    if (tab === 'dashboard') return await renderAdminDashboard(el);
    if (tab === 'leads') return await renderAdminLeads(el);
    if (tab === 'import') return await renderAdminImport(el);
    if (tab === 'duplicates') return await renderAdminDuplicates(el);
    if (tab === 'finishing') return await renderAdminFinishing(el);
    if (tab === 'roster') return await renderAdminRoster(el);
    if (tab === 'chat') { el.innerHTML = '<div class="fade-up" id="adminChatWrap"></div>'; return await renderChatInto(document.getElementById('adminChatWrap')); }
    if (tab === 'announcements') return await renderAdminAnnouncements(el);
    if (tab === 'goal') return await renderAdminGoal(el);
    if (tab === 'scripts') return await renderAdminScripts(el);
    if (tab === 'template') return await renderAdminTemplate(el);
    if (tab === 'categories') return await renderAdminCategories(el);
    if (tab === 'leaderboard') return await renderAdminLeaderboard(el);
    if (tab === 'branding') return await renderAdminBranding(el);
    if (tab === 'telephony') return await renderAdminTelephony(el);
  } catch (err) {
    console.error('Tab render failed:', tab, err);
    el.innerHTML = '<div class="panel p fade-up" style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">Something went wrong loading this.</div><div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">' + esc(String(err && err.message || err)) + '</div><button class="btn btn-gold" onclick="renderAdminTab(\\'' + tab + '\\')">Retry</button></div>';
  }
}

async function renderAdminDashboard(el) {
  const res = await api('/api/admin/dashboard');
  const d = (await res.json()).data;
  el.innerHTML = \`
    <div class="stat-grid stagger">
      <div class="stat-box panel accent"><div class="num" data-count="\${d.total}">0</div><div class="lbl">Total Leads</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.uncalled}">0</div><div class="lbl">Not Called</div></div>
      <div class="stat-box panel" style="border-color:\${d.active_calls > 0 ? 'var(--gold-glow)' : ''};"><div class="num" data-count="\${d.active_calls}" style="display:inline-block;">0</div>\${d.active_calls > 0 ? '<span class="live-dot"></span>' : ''}<div class="lbl">On Call Now</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.successful}">0</div><div class="lbl">Successful</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.awaiting_finishing}">0</div><div class="lbl">Awaiting Finishing</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.assigned_finishing}">0</div><div class="lbl">With Finishers</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.completed}">0</div><div class="lbl">Completed</div></div>
      <div class="stat-box panel" style="\${d.requires_review > 0 ? 'border-color:var(--gold-glow);' : ''}"><div class="num" data-count="\${d.requires_review}">0</div><div class="lbl">Needs Review</div></div>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="stat-box panel"><div class="num" data-count="\${d.callers_online}">0</div><div class="lbl">Callers Online</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${d.finishers_online}">0</div><div class="lbl">Finishers Online</div></div>
    </div>
    <div class="section-title">On Call — Live</div>
    <div class="panel p" id="onCallPanel">\${onCallHtml(d.onCall)}</div>
    <div class="section-title">Recent Activity</div>
    <div class="panel p">
      <div class="timeline">\${d.recentEvents.map(e => \`<div class="timeline-item"><div class="ev">\${eventLabel(e)}</div><div class="meta">\${e.actor_name || 'System'} · \${fullName(e)} · \${timeAgo(e.created_at)}</div></div>\`).join('') || '<div style="color:var(--text-dim);">No activity yet.</div>'}</div>
    </div>\`;
  animateCountUps(el);
  startOnCallTimers();
}
function onCallHtml(rows) {
  if (!rows.length) return '<div style="color:var(--text-dim);font-size:13px;">Nobody is on a call right now.</div>';
  return rows.map(r => \`
    <div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);">
      \${avatarHtml({ id: r.caller_id, name: r.caller_name, pfp_data: r.caller_pfp_data }, 34)}
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;">\${esc(r.caller_name)} <span style="color:var(--text-dim);font-weight:500;">→ \${fullName(r)}</span></div>
        <div style="font-size:11px;color:var(--text-dim);" class="mono">\${r.phone} · started \${new Date(r.call_started_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
      </div>
      \${statusBadge(r.status)}
      <span class="mono on-call-timer" data-started="\${r.call_started_at}" style="font-size:13px;color:var(--gold-bright);min-width:48px;text-align:right;">00:00</span>
    </div>\`).join('');
}
let onCallTimerInterval;
function startOnCallTimers() {
  clearInterval(onCallTimerInterval);
  const tick = () => {
    document.querySelectorAll('.on-call-timer').forEach(el => {
      const started = new Date(el.dataset.started).getTime();
      const s = Math.max(0, Math.floor((Date.now() - started) / 1000));
      el.textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    });
  };
  tick();
  onCallTimerInterval = setInterval(tick, 1000);
}
function eventLabel(e) {
  const map = { uploaded: 'Lead uploaded', claimed: 'Lead claimed', call_connected: 'Call connected', call_ended: 'Call ended', outcome_recorded: 'Outcome: ' + (e.to_status || ''), queued_for_finishing: 'Queued for finishing', assigned_finisher: 'Assigned to finisher', reassigned_finisher: 'Reassigned finisher', finisher_outcome: 'Finisher outcome: ' + (e.to_status || ''), admin_override: 'Admin override', merged: 'Marked duplicate', duplicate_dismissed: 'Duplicate dismissed' };
  return map[e.event_type] || e.event_type;
}

async function renderAdminLeads(el) {
  const [res, callersRes, catsRes] = await Promise.all([api('/api/admin/leads'), api('/api/admin/users'), api('/api/lead-categories')]);
  const rows = (await res.json()).data;
  callerListCache = (await callersRes.json()).data.filter(u => u.role === 'caller');
  categoryCache = (await catsRes.json()).data;
  window._allLeadsCache = rows;
  const PASSED = ['successful_call', 'completed'];
  const FAILED = ['failed', 'cancelled', 'chopped_previously'];
  const passedCount = rows.filter(l => PASSED.includes(l.status) || PASSED.includes(l.outcome)).length;
  const failedCount = rows.filter(l => FAILED.includes(l.status) || FAILED.includes(l.outcome)).length;
  const OUTCOMES = ['voicemail','no_answer','hung_up','busy','callback_requested','successful_call','failed','requires_review','cancelled','chopped_previously'];
  el.innerHTML = \`
    <div class="row-flex" style="margin-bottom:14px;gap:10px;">
      <div class="stat-box panel" style="flex:1;padding:14px 18px;"><div class="num" style="font-size:20px;color:var(--success);" data-count="\${passedCount}">0</div><div class="lbl">Total Passed</div></div>
      <div class="stat-box panel" style="flex:1;padding:14px 18px;"><div class="num" style="font-size:20px;color:var(--danger);" data-count="\${failedCount}">0</div><div class="lbl">Total Failed</div></div>
    </div>
    <div class="row-flex fade-up" style="margin-bottom:16px;">
      <div class="field"><input id="leadSearch" placeholder="Search name, phone, email…" oninput="debouncedLeadSearch()" /></div>
      <select id="leadStatusFilter" style="max-width:200px;" onchange="filterLeadsByStatus()"><option value="">All statuses</option>\${LEAD_STATUSES.map(s => '<option value="' + s + '">' + titleCase(s) + '</option>').join('')}</select>
      <select id="leadOutcomeFilter" style="max-width:200px;" onchange="filterLeadsByOutcome()"><option value="">All outcomes</option>\${OUTCOMES.map(s => '<option value="' + s + '">' + titleCase(s) + '</option>').join('')}</select>
    </div>
    <div class="panel p fade-up"><table><thead><tr><th>Lead</th><th>Category</th><th>Phone</th><th>Status</th><th>Caller</th><th>Finisher</th><th>Uploaded</th><th>Send To</th><th></th></tr></thead>
    <tbody id="leadsTbody">\${rows.map(leadRowHtml).join('')}</tbody></table></div>\`;
  animateCountUps(el);
}
function filterLeadsByOutcome() {
  const outcome = document.getElementById('leadOutcomeFilter').value;
  const rows = outcome ? window._allLeadsCache.filter(l => l.outcome === outcome) : window._allLeadsCache;
  document.getElementById('leadsTbody').innerHTML = rows.map(leadRowHtml).join('');
}
let callerListCache = [];
let categoryCache = [];
function categoryBadge(leadType) {
  if (!leadType) return '<span style="color:var(--text-faint);">—</span>';
  const cat = categoryCache.find(c => c.name.toLowerCase() === String(leadType).toLowerCase());
  const color = cat ? cat.color : 'var(--text-dim)';
  return '<span class="badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;">' + esc(leadType) + '</span>';
}
function leadRowHtml(l) {
  const sendCell = l.status === 'not_called'
    ? \`<select onclick="event.stopPropagation()" onchange="event.stopPropagation(); sendLeadToCaller(\${l.id}, this.value)"><option value="">Send to…</option>\${callerListCache.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('')}</select>\`
    : '<span style="color:var(--text-faint);">—</span>';
  return \`<tr class="clickable" data-lead-row="\${l.id}"><td onclick="openLeadDetail(\${l.id})">\${esc(fullName(l))} \${l.dedup_status === 'flagged' ? '<span class="dup-warn">possible dup</span>' : ''}\${l.note_count > 0 ? ' <span class="badge" style="background:rgba(79,140,255,.15);color:var(--gold-bright);" title="' + l.note_count + ' caller note(s)">' + l.note_count + ' note' + (l.note_count === 1 ? '' : 's') + '</span>' : ''}</td><td onclick="openLeadDetail(\${l.id})">\${categoryBadge(l.lead_type)}</td><td class="mono" onclick="openLeadDetail(\${l.id})">\${l.phone}</td><td onclick="openLeadDetail(\${l.id})">\${statusBadge(l.status)}</td><td onclick="openLeadDetail(\${l.id})">\${l.caller_name || '—'}</td><td onclick="openLeadDetail(\${l.id})">\${l.finisher_name || '—'}</td><td onclick="openLeadDetail(\${l.id})">\${timeAgo(l.created_at)}</td><td>\${sendCell}</td><td><button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteLead(\${l.id})">Delete</button></td></tr>\`;
}
async function sendLeadToCaller(leadId, callerId) {
  if (!callerId) return;
  await api('/api/admin/leads/' + leadId + '/assign-caller', { method: 'POST', body: JSON.stringify({ callerId: Number(callerId) }) });
  renderAdminTab('leads');
}
async function deleteLead(leadId) {
  if (!confirm('Permanently delete this lead? This cannot be undone.')) return;
  await api('/api/admin/leads/' + leadId, { method: 'DELETE' });
  renderAdminTab('leads');
}
let leadSearchTimeout;
function debouncedLeadSearch() { clearTimeout(leadSearchTimeout); leadSearchTimeout = setTimeout(runLeadSearch, 300); }
async function runLeadSearch() {
  const q = document.getElementById('leadSearch').value.trim();
  const res = await api('/api/admin/leads' + (q ? '?search=' + encodeURIComponent(q) : ''));
  document.getElementById('leadsTbody').innerHTML = (await res.json()).data.map(leadRowHtml).join('');
}
async function filterLeadsByStatus() {
  const status = document.getElementById('leadStatusFilter').value;
  const res = await api('/api/admin/leads' + (status ? '?status=' + status : ''));
  document.getElementById('leadsTbody').innerHTML = (await res.json()).data.map(leadRowHtml).join('');
}
const LEAD_STATUSES = ['not_called','calling','active_call','call_ended','successful_call','ready_for_finishing','assigned_to_finisher','completed','failed','requires_review'];

async function openLeadDetail(id) {
  const res = await api('/api/admin/leads/' + id);
  const l = (await res.json()).data;
  const el = document.getElementById('adminContent');
  el.innerHTML = \`
    <button class="btn btn-ghost btn-sm fade-up" onclick="switchAdminTab('leads')">← Back to Leads</button>
    <div class="panel p fade-up" style="margin-top:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div><h2 style="font-size:24px;">\${esc(fullName(l))}</h2><div style="color:var(--text-dim);font-size:13px;margin-top:4px;" class="mono">\${l.phone}\${l.email ? ' · ' + l.email : ''}</div></div>
        \${statusBadge(l.status)}
      </div>
      \${l.address ? '<div class="info-row"><span class="k">Address</span><span class="v">' + esc(l.address) + '</span></div>' : ''}
      <div class="info-row"><span class="k">Uploaded by</span><span class="v">\${l.uploaded_by_name || '—'} · \${timeAgo(l.created_at)}</span></div>
      <div class="info-row"><span class="k">Caller</span><span class="v">\${l.caller_name || '—'}</span></div>
      <div class="info-row"><span class="k">Finisher</span><span class="v">\${l.finisher_name || '—'}</span></div>
      \${l.notes ? '<div class="info-row"><span class="k">Notes</span><span class="v">' + esc(l.notes) + '</span></div>' : ''}
      \${l.extra_info ? '<div class="info-row"><span class="k">Card on File</span><span class="v">' + esc(l.extra_info) + '</span></div>' : ''}
      \${l.status === 'requires_review' ? \`<div style="margin-top:16px;display:flex;gap:8px;"><button class="btn btn-teal btn-sm" onclick="overrideStatus(\${l.id},'ready_for_finishing')">Send to Finishing</button><button class="btn btn-ghost btn-sm" onclick="overrideStatus(\${l.id},'not_called')">Reset to Not Called</button><button class="btn btn-danger btn-sm" onclick="overrideStatus(\${l.id},'failed')">Mark Failed</button></div>\` : ''}
    </div>
    <div class="section-title">Caller Notes \${l.callerNotes.length ? '(' + l.callerNotes.length + ')' : ''}</div>
    <div class="panel p fade-up" style="border-color:var(--gold-glow);">
      \${l.callerNotes.length ? l.callerNotes.map(n => \`
        <div style="display:flex;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);">
          \${avatarHtml({ name: n.author_name, pfp_data: n.author_pfp_data }, 30)}
          <div style="flex:1;">
            <div style="font-size:13px;line-height:1.5;">\${esc(n.content)}</div>
            <div style="font-size:10.5px;color:var(--text-faint);margin-top:3px;">\${esc(n.author_name || 'Unknown')} · \${new Date(n.created_at).toLocaleString()}</div>
          </div>
        </div>\`).join('') : '<div style="color:var(--text-dim);font-size:13px;">No notes from callers on this lead yet — these show up here the moment a caller adds one, even mid-call.</div>'}
    </div>
    <div class="section-title">Timeline</div>
    <div class="panel p fade-up">
      <div class="timeline">\${l.events.map(e => \`<div class="timeline-item"><div class="ev">\${eventLabel(e)}</div><div class="meta">\${e.actor_name || 'System'} · \${new Date(e.created_at).toLocaleString()}\${e.meta && e.meta.notes ? ' — "' + esc(e.meta.notes) + '"' : ''}</div></div>\`).join('') || '<div style="color:var(--text-dim);">No events recorded.</div>'}</div>
    </div>
    \${l.duplicates.length ? '<div class="section-title">Duplicate Flags</div><div class="panel p fade-up">' + l.duplicates.map(d => '<div style="padding:8px 0;font-size:12.5px;">Confidence ' + d.confidence + '% · status: ' + d.status + '</div>').join('') + '</div>' : ''}
  \`;
}
async function overrideStatus(id, status) {
  const note = prompt('Optional note for this override:');
  await api('/api/admin/leads/' + id + '/override-status', { method: 'POST', body: JSON.stringify({ status, note }) });
  openLeadDetail(id);
}

async function renderAdminImport(el) {
  const cats = await api('/api/lead-categories').then(r => r.json()).then(d => d.data);
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Smart Import</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">Paste leads in any format — CSV, pipe-separated, freeform text, phone numbers with or without separators, local or international. Sensitive data (card numbers, CVVs, passwords) is automatically stripped before anything is stored.</p>
      <textarea id="importText" rows="9" placeholder="John Smith, 555-123-4567, john@email.com, 42 Oak St&#10;or paste freeform data, CSV, or pipe-separated rows"></textarea>
      <div class="row-flex" style="margin-top:12px;">
        <div class="field"><label>Assign Category</label><select id="importLeadType">\${cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('') || '<option value="general">General</option>'}</select></div>
        <div class="field"><label>Source Label</label><input id="importSource" placeholder="e.g. Facebook Ad" /></div>
      </div>
      <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="runImportPreview()">Analyze</button>
    </div>
    <div id="importPreview"></div>\`;
}
let lastImportPreview = [];
async function runImportPreview() {
  const text = document.getElementById('importText').value.trim();
  if (!text) return;
  const preview = document.getElementById('importPreview');
  preview.innerHTML = '<div class="loading-shimmer"></div>';
  const res = await api('/api/admin/leads/import/preview', { method: 'POST', body: JSON.stringify({ text }) });
  if (!res.ok) { const e = await res.json().catch(() => ({})); preview.innerHTML = '<div class="panel p" style="color:var(--danger);">' + (e.error || 'Import failed') + '</div>'; return; }
  const data = (await res.json()).data;
  lastImportPreview = data.leads;
  let html = '';
  if (data.redacted.redactedCount > 0) {
    html += \`<div class="panel p fade-up" style="border-color:var(--gold-glow);"><b style="color:var(--gold-bright);">\${data.redacted.redactedCount} sensitive field(s) removed</b> before parsing (\${data.redacted.redactedTypes.join(', ')}). These are never stored.</div>\`;
  }
  if (!lastImportPreview.length) {
    html += '<div class="panel p" style="color:var(--text-dim);">No phone numbers detected anywhere in that text. Double check the paste — every lead needs at least a phone number (7-15 digits) to be importable.</div>';
    preview.innerHTML = html;
    return;
  }
  html += \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Found \${lastImportPreview.length} lead\${lastImportPreview.length === 1 ? '' : 's'} — review and edit before importing</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:8px;padding-bottom:8px;margin-bottom:6px;border-bottom:1px solid var(--border);font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;font-weight:700;">
        <span>First Name</span><span>Last Name</span><span>Phone</span><span>Email / Notes</span><span></span>
      </div>
      <div id="importRows">\${lastImportPreview.map((r, i) => importRowHtml(r, i)).join('')}</div>
      <button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="addBlankImportRow()">+ Add row manually</button>
      <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="confirmImport()">Import <span id="importCount">\${lastImportPreview.length}</span> Leads</button>
    </div>\`;
  preview.innerHTML = html;
}
function importRowHtml(r, i) {
  return \`<div class="row-flex" style="margin-bottom:8px;" data-row="\${i}">
    <input style="flex:1;min-width:0;" value="\${esc(r.first_name || '')}" oninput="lastImportPreview[\${i}].first_name = this.value || null" placeholder="First name" />
    <input style="flex:1;min-width:0;" value="\${esc(r.last_name || '')}" oninput="lastImportPreview[\${i}].last_name = this.value || null" placeholder="Last name" />
    <input style="flex:1;min-width:0;" value="\${esc(r.phone || '')}" oninput="lastImportPreview[\${i}].phone = this.value" placeholder="Phone" class="mono" />
    <input style="flex:1;min-width:0;" value="\${esc(r.email || r.notes || '')}" oninput="lastImportPreview[\${i}].notes = this.value" placeholder="Email / notes" />
    <button class="btn btn-danger btn-sm" onclick="removeImportRow(\${i})">✕</button>
    \${r.potentialDuplicate ? '<div class="dup-warn" style="grid-column:1/-1;">' + r.potentialDuplicate.confidence + '% possible match with existing lead #' + r.potentialDuplicate.leadId + '</div>' : ''}
  </div>\`;
}
function removeImportRow(i) {
  lastImportPreview.splice(i, 1);
  document.getElementById('importRows').innerHTML = lastImportPreview.map((r, j) => importRowHtml(r, j)).join('');
  document.getElementById('importCount').textContent = lastImportPreview.length;
}
function addBlankImportRow() {
  lastImportPreview.push({ first_name: null, last_name: null, phone: '', email: null, address: null, notes: null });
  document.getElementById('importRows').innerHTML = lastImportPreview.map((r, j) => importRowHtml(r, j)).join('');
  document.getElementById('importCount').textContent = lastImportPreview.length;
}
async function confirmImport() {
  const lead_type = document.getElementById('importLeadType').value.trim() || 'general';
  const source = document.getElementById('importSource').value.trim() || 'import';
  const validLeads = lastImportPreview.filter(r => r.phone && r.phone.replace(/[^\\d]/g, '').length >= 7);
  const invalidCount = lastImportPreview.length - validLeads.length;
  if (!validLeads.length) {
    return alert('None of the ' + lastImportPreview.length + ' row(s) have a phone number with at least 7 digits. Edit the Phone field directly in the row(s) above, then hit Import again.');
  }
  if (invalidCount > 0 && !confirm(invalidCount + ' row(s) are missing a valid phone and will be skipped. Import the remaining ' + validLeads.length + '?')) return;
  const res = await api('/api/admin/leads/import/confirm', { method: 'POST', body: JSON.stringify({ leads: validLeads, lead_type, source }) });
  const data = await res.json();
  alert('Imported ' + data.inserted + ' leads' + (data.flagged ? ' (' + data.flagged + ' flagged as possible duplicates for review)' : ''));
  switchAdminTab('leads');
}

async function renderAdminDuplicates(el) {
  const res = await api('/api/admin/duplicates');
  const rows = (await res.json()).data;
  el.innerHTML = \`<div class="section-title" style="margin-top:0;">Pending Review (\${rows.length})</div>\` + (rows.length ? rows.map(d => \`
    <div class="panel p fade-up">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span class="badge requires_review">\${d.confidence}% match</span><span style="font-size:11px;color:var(--text-dim);">\${d.reasons.join(', ')}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div class="panel-inset" style="padding:12px;"><b>\${[d.lead_a.first_name,d.lead_a.last_name].filter(Boolean).join(' ') || 'Unknown'}</b><div class="mono" style="font-size:12px;color:var(--text-dim);">\${d.lead_a.phone}</div></div>
        <div class="panel-inset" style="padding:12px;"><b>\${[d.lead_b.first_name,d.lead_b.last_name].filter(Boolean).join(' ') || 'Unknown'}</b><div class="mono" style="font-size:12px;color:var(--text-dim);">\${d.lead_b.phone}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-teal btn-sm" onclick="resolveDuplicate(\${d.id},'confirmed_duplicate')">Confirm Duplicate — Merge</button>
        <button class="btn btn-ghost btn-sm" onclick="resolveDuplicate(\${d.id},'not_duplicate')">Not a Duplicate</button>
      </div>
    </div>\`).join('') : '<div class="panel p" style="color:var(--text-dim);">Nothing pending review.</div>');
}
async function resolveDuplicate(id, decision) { await api('/api/admin/duplicates/' + id + '/resolve', { method: 'POST', body: JSON.stringify({ decision }) }); renderAdminTab('duplicates'); }

async function renderAdminFinishing(el) {
  const [queueRes, usersRes] = await Promise.all([api('/api/admin/finishing-queue'), api('/api/admin/users')]);
  const rows = (await queueRes.json()).data;
  const finishers = (await usersRes.json()).data.filter(u => u.role === 'finisher');
  el.innerHTML = \`<div class="panel p fade-up"><table><thead><tr><th>Lead</th><th>Phone</th><th>Status</th><th>Finisher</th><th>Assign</th></tr></thead>
    <tbody>\${rows.map(l => \`<tr><td>\${esc(fullName(l))}</td><td class="mono">\${l.phone}</td><td>\${statusBadge(l.status)}</td><td>\${l.finisher_name || '—'}</td>
      <td><select onchange="assignFinisher(\${l.id}, this.value)"><option value="">Choose…</option>\${finishers.map(f => '<option value="' + f.id + '">' + f.name + '</option>').join('')}</select></td></tr>\`).join('') || '<tr><td colspan="5" style="color:var(--text-dim);">Nothing waiting.</td></tr>'}</tbody></table></div>\`;
}
async function assignFinisher(leadId, finisherId) { if (!finisherId) return; await api('/api/admin/leads/' + leadId + '/assign-finisher', { method: 'POST', body: JSON.stringify({ finisherId: Number(finisherId) }) }); renderAdminTab('finishing'); }

async function renderAdminRoster(el) {
  const res = await api('/api/admin/users');
  const rows = (await res.json()).data;
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add Team Member</div>
      <div class="row-flex">
        <div class="field"><label>Name</label><input id="ncName" /></div>
        <div class="field"><label>Role</label><select id="ncRole"><option value="caller">Caller</option><option value="finisher">Finisher</option><option value="admin">Admin</option></select></div>
        <button class="btn btn-gold" onclick="addUser()">Generate PIN</button>
      </div>
      <div id="newPinBanner"></div>
    </div>
    <div class="panel p fade-up"><table><thead><tr><th></th><th>Name</th><th>PIN</th><th>Role</th><th>Call Number</th><th>XP</th><th>Status</th><th></th></tr></thead>
    <tbody>\${rows.map(u => \`<tr><td>\${avatarHtml(u, 24)}</td><td>\${esc(u.name)}</td><td class="pin-display">\${u.pin}</td><td>\${statusBadge(u.role)}</td>
      <td>\${u.call_phone ? '<span class="blur-phone mono" onclick="this.classList.toggle(\\'revealed\\')">' + esc(u.call_phone) + '</span>' : '<span style="color:var(--text-faint);">—</span>'}</td>
      <td>\${u.xp}</td><td>\${statusBadge(u.status)}\${u.clocked_in ? ' <span class="mono roster-clock-timer" data-uid="' + u.id + '" style="font-size:10.5px;color:var(--gold-bright);"></span>' : ''}</td>
      <td style="display:flex;gap:6px;"><select onchange="changeRole(\${u.id}, this.value)" style="width:auto;padding:6px 8px;font-size:11px;"><option value="">Change role…</option><option value="caller">Caller</option><option value="finisher">Finisher</option><option value="admin">Admin</option></select><button class="btn btn-ghost btn-sm" onclick="viewClockHistory(\${u.id},'\${esc(u.name)}')">History</button><button class="btn btn-danger btn-sm" onclick="removeUser(\${u.id})">Remove</button></td></tr>\`).join('')}</tbody></table></div>
    <div id="clockHistoryPanel"></div>\`;
  loadRosterClockTimers(rows);
}
let rosterClockInterval;
async function loadRosterClockTimers(rows) {
  clearInterval(rosterClockInterval);
  const clockedInUsers = rows.filter(u => u.clocked_in);
  if (!clockedInUsers.length) return;
  const sessions = await api('/api/admin/clock-sessions').then(r => r.json()).then(d => d.data);
  const openByUser = {};
  for (const s of sessions) if (!s.clocked_out_at) openByUser[s.user_id] = s.clocked_in_at;
  const tick = () => {
    document.querySelectorAll('.roster-clock-timer').forEach(el => {
      const startedAt = openByUser[el.dataset.uid];
      if (!startedAt) return;
      const secs = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
      el.textContent = String(Math.floor(secs / 3600)).padStart(2, '0') + ':' + String(Math.floor(secs % 3600 / 60)).padStart(2, '0') + ':' + String(secs % 60).padStart(2, '0');
    });
  };
  tick();
  rosterClockInterval = setInterval(tick, 1000);
}
async function viewClockHistory(userId, name) {
  const res = await api('/api/admin/clock-sessions?userId=' + userId);
  const rows = (await res.json()).data;
  const panel = document.getElementById('clockHistoryPanel');
  panel.innerHTML = \`<div class="panel p fade-up"><div class="section-title" style="margin-top:0;">Clock History — \${esc(name)}</div>
    <table><thead><tr><th>Clocked In</th><th>Clocked Out</th><th>Duration</th></tr></thead>
    <tbody>\${rows.map(s => \`<tr><td>\${new Date(s.clocked_in_at).toLocaleString()}</td><td>\${s.clocked_out_at ? new Date(s.clocked_out_at).toLocaleString() : '<span style="color:var(--gold-bright);">still active</span>'}</td><td class="mono">\${s.duration_seconds ? Math.floor(s.duration_seconds/3600)+'h '+Math.floor(s.duration_seconds%3600/60)+'m' : '—'}</td></tr>\`).join('') || '<tr><td colspan="3" style="color:var(--text-dim);">No sessions yet.</td></tr>'}</tbody></table></div>\`;
  panel.scrollIntoView({ behavior: 'smooth' });
}
async function addUser() {
  const name = document.getElementById('ncName').value.trim();
  const role = document.getElementById('ncRole').value;
  if (!name) return alert('Enter a name');
  const res = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ name, role }) });
  const data = await res.json();
  document.getElementById('newPinBanner').innerHTML = '<div class="new-pin-banner"><span>' + name + ' (' + role + ') can log in with PIN</span><span class="pin-display">' + data.data.pin + '</span></div>';
  renderAdminTab('roster');
}
async function changeRole(id, role) { if (!role) return; await api('/api/admin/users/' + id + '/role', { method: 'POST', body: JSON.stringify({ role }) }); renderAdminTab('roster'); }
async function removeUser(id) { if (!confirm('Remove this team member?')) return; await api('/api/admin/users/' + id, { method: 'DELETE' }); renderAdminTab('roster'); }

async function renderAdminAnnouncements(el) {
  const res = await api('/api/admin/announcements');
  const rows = (await res.json()).data;
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Post Announcement</div>
      <textarea id="annText" rows="3" placeholder="Write something for the team…"></textarea>
      <div class="row-flex" style="margin-top:10px;">
        <div class="field"><label>Audience</label><select id="annTarget"><option value="all">Everyone</option><option value="caller">Callers only</option><option value="finisher">Finishers only</option></select></div>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);text-transform:none;letter-spacing:0;font-weight:500;"><input type="checkbox" id="annImportant" style="width:auto;" /> Mark important</label>
      </div>
      <button class="btn btn-gold btn-block" style="margin-top:10px;" onclick="postAnnouncement()">Publish</button>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">History</div>
      \${rows.map(a => \`<div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:10px;"><div><div style="font-size:13px;">\${a.important ? '<span class="badge important" style="margin-right:6px;">important</span>' : ''}\${esc(a.content)}</div><div style="font-size:10.5px;color:var(--text-faint);margin-top:4px;">→ \${a.target_role} · \${timeAgo(a.created_at)}</div></div><button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(\${a.id})">Delete</button></div>\`).join('') || '<div style="color:var(--text-dim);">No announcements yet.</div>'}
    </div>\`;
}
async function postAnnouncement() {
  const content = document.getElementById('annText').value.trim();
  if (!content) return;
  const important = document.getElementById('annImportant').checked;
  const target_role = document.getElementById('annTarget').value;
  await api('/api/admin/announcements', { method: 'POST', body: JSON.stringify({ content, important, target_role }) });
  renderAdminTab('announcements');
}
async function deleteAnnouncement(id) { await api('/api/admin/announcements/' + id, { method: 'DELETE' }); renderAdminTab('announcements'); }

async function renderAdminGoal(el) {
  const res = await api('/api/goal');
  const goal = (await res.json()).data;
  el.innerHTML = \`<div class="panel p fade-up">
    <div class="section-title" style="margin-top:0;">Team Goal</div>
    <div class="row-flex"><div class="field"><label>Label</label><input id="goalLabel" value="\${esc(goal.label)}" /></div><div class="field"><label>Target</label><input id="goalTarget" type="number" value="\${goal.target}" /></div></div>
    <p style="font-size:12px;color:var(--text-dim);margin:10px 0;">Currently at <b style="color:var(--text);">\${goal.current}</b> of \${goal.target}.</p>
    <button class="btn btn-gold btn-block" onclick="saveGoal()">Update Goal</button>
  </div>\`;
}
async function saveGoal() {
  const label = document.getElementById('goalLabel').value.trim();
  const target = Number(document.getElementById('goalTarget').value);
  await api('/api/admin/goal', { method: 'POST', body: JSON.stringify({ label, target }) });
  renderAdminTab('goal');
}

async function renderAdminScripts(el) {
  const res = await api('/api/admin/scripts');
  const rows = (await res.json()).data;
  const pending = rows.filter(s => s.status === 'pending');
  const approved = rows.filter(s => s.status === 'approved');
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add Script</div>
      <div class="row-flex"><div class="field"><label>Title</label><input id="scTitle" /></div><div class="field"><label>Lead Type</label><input id="scType" placeholder="general" /></div></div>
      <div class="field"><label>Content</label><textarea id="scContent" rows="4"></textarea></div>
      <button class="btn btn-gold btn-block" onclick="addScript()">Publish</button>
    </div>
    \${pending.length ? \`<div class="panel p fade-up" style="border-color:var(--gold-glow);">
      <div class="section-title" style="margin-top:0;">Pending Review (\${pending.length})</div>
      \${pending.map(s => \`<div style="padding:12px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;"><b style="font-size:13px;">\${esc(s.title)}</b><span class="badge pending">pending</span></div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px;">Suggested by \${esc(s.submitted_by_name || 'a caller')} · \${s.lead_type}</div>
        <div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;white-space:pre-wrap;">\${esc(s.content)}</div>
        <div style="display:flex;gap:8px;margin-top:8px;"><button class="btn btn-teal btn-sm" onclick="approveScript(\${s.id})">Approve</button><button class="btn btn-danger btn-sm" onclick="deleteScript(\${s.id})">Reject</button></div>
      </div>\`).join('')}
    </div>\` : ''}
    <div class="panel p fade-up"><div class="section-title" style="margin-top:0;">Approved Scripts (\${approved.length})</div>
      \${approved.map(s => \`<div style="padding:12px 0;border-bottom:1px solid var(--border);"><b style="color:var(--gold-bright);font-size:13px;">\${esc(s.title)}</b> <span style="font-size:11px;color:var(--text-dim);">· \${s.lead_type}</span><div style="font-size:12.5px;color:var(--text-dim);margin-top:4px;white-space:pre-wrap;">\${esc(s.content)}</div><button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="deleteScript(\${s.id})">Delete</button></div>\`).join('') || '<div style="color:var(--text-dim);">No approved scripts yet.</div>'}
    </div>\`;
}
async function approveScript(id) { await api('/api/admin/scripts/' + id + '/approve', { method: 'POST' }); renderAdminTab('scripts'); }
async function addScript() {
  const title = document.getElementById('scTitle').value.trim();
  const content = document.getElementById('scContent').value.trim();
  const lead_type = document.getElementById('scType').value.trim();
  if (!title || !content) return alert('Title and content required');
  await api('/api/admin/scripts', { method: 'POST', body: JSON.stringify({ title, content, lead_type }) });
  renderAdminTab('scripts');
}
async function deleteScript(id) { await api('/api/admin/scripts/' + id, { method: 'DELETE' }); renderAdminTab('scripts'); }

async function renderAdminTemplate(el) {
  const res = await api('/api/call-template');
  const data = (await res.json()).data;
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Call Template</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">This is what every caller sees on screen the moment they connect a call. Structure it however works for your team — greeting, qualifying questions, next steps.</p>
      <textarea id="templateText" rows="10">\${esc(data.template)}</textarea>
      <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="saveTemplate()">Save Template</button>
      <div id="templateStatus" style="font-size:12px;margin-top:10px;"></div>
    </div>\`;
}
async function saveTemplate() {
  const template = document.getElementById('templateText').value;
  await api('/api/admin/call-template', { method: 'POST', body: JSON.stringify({ template }) });
  document.getElementById('templateStatus').textContent = 'Saved ✓';
  document.getElementById('templateStatus').style.color = 'var(--success)';
}

async function renderAdminCategories(el) {
  const res = await api('/api/lead-categories');
  const cats = (await res.json()).data;
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add Category</div>
      <div class="row-flex">
        <div class="field"><label>Name</label><input id="catName" placeholder="e.g. Priority" /></div>
        <div class="field"><label>Color</label><input id="catColor" type="color" value="#4f8cff" style="height:44px;padding:4px;" /></div>
        <button class="btn btn-gold" onclick="addCategory()">Add</button>
      </div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Categories (\${cats.length})</div>
      \${cats.map(cat => \`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
        <span style="width:14px;height:14px;border-radius:4px;background:\${cat.color};"></span>
        <span style="flex:1;font-size:13px;">\${esc(cat.name)}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(\${cat.id})">Delete</button>
      </div>\`).join('') || '<div style="color:var(--text-dim);">No categories yet.</div>'}
    </div>\`;
}
async function addCategory() {
  const name = document.getElementById('catName').value.trim();
  const color = document.getElementById('catColor').value;
  if (!name) return alert('Enter a name');
  await api('/api/admin/lead-categories', { method: 'POST', body: JSON.stringify({ name, color }) });
  renderAdminTab('categories');
}
async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  await api('/api/admin/lead-categories/' + id, { method: 'DELETE' });
  renderAdminTab('categories');
}


async function renderAdminLeaderboard(el) {
  const res = await api('/api/leaderboard');
  const rows = (await res.json()).data;
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const [first, second, third] = podium;
  el.innerHTML = \`
    \${podium.length ? \`<div class="panel p fade-up" style="padding:32px 20px 16px;">
      <div class="section-title" style="margin-top:0;">Top Performers</div>
      <div style="display:flex;align-items:flex-end;justify-content:center;gap:14px;max-width:420px;margin:0 auto;">
        \${second ? adminPodiumSlot(second, 2, 84) : '<div style="flex:1;"></div>'}
        \${first ? adminPodiumSlot(first, 1, 104) : '<div style="flex:1;"></div>'}
        \${third ? adminPodiumSlot(third, 3, 70) : '<div style="flex:1;"></div>'}
      </div>
    </div>\` : '<div class="panel p" style="color:var(--text-dim);">No activity yet.</div>'}
    \${rest.length ? \`<div class="panel p fade-up"><div class="section-title" style="margin-top:0;">Full Board</div>
      \${rest.map((r, i) => \`<div class="lb-row"><div class="rank">\${i+4}</div>\${avatarHtml(r, 30)}
        <div class="lb-name" style="margin-left:6px;">\${esc(r.name)} \${statusBadge(r.role)}</div>
        <div class="lb-stats"><span><b>\${r.successful_calls||0}</b> success</span><span style="color:var(--violet);"><b>\${r.xp}</b> xp</span></div></div>\`).join('')}
    </div>\` : ''}\`;
}
function adminPodiumSlot(r, place, height) {
  const medalLabel = place === 1 ? 'GOLD' : place === 2 ? 'SILVER' : 'BRONZE';
  const barColor = place === 1 ? 'linear-gradient(180deg,#fbbf24,#b8860b)' : place === 2 ? 'linear-gradient(180deg,#d1d5db,#9ca3af)' : 'linear-gradient(180deg,#d97706,#92400e)';
  return \`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;">
    <div style="font-size:9.5px;font-weight:800;letter-spacing:.6px;color:var(--text-faint);">\${medalLabel}</div>
    \${avatarHtml(r, place === 1 ? 56 : 46)}
    <div style="font-size:12px;font-weight:700;text-align:center;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${esc(r.name)}</div>
    <div style="font-size:10.5px;color:var(--violet);font-weight:600;">\${r.xp} xp · \${r.successful_calls||0} wins</div>
    <div style="width:100%;height:\${height}px;border-radius:10px 10px 0 0;background:\${barColor};display:flex;align-items:flex-start;justify-content:center;padding-top:6px;font-size:16px;font-weight:800;color:rgba(0,0,0,.55);">#\${place}</div>
  </div>\`;
}

async function renderAdminBranding(el) {
  const res = await api('/api/branding');
  const b = (await res.json()).data;
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Panel Branding</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:16px;">Sets the name and logo shown across the whole app - title bar, login screen, topbar, and home screen icon on mobile.</p>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <div id="brandLogoPreview" style="width:56px;height:56px;border-radius:16px;overflow:hidden;background:var(--s3);display:flex;align-items:center;justify-content:center;">\${b.logo ? '<img src="' + b.logo + '" style="width:100%;height:100%;object-fit:cover;" />' : '<span style="font-size:11px;color:var(--text-faint);">No logo</span>'}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="btn btn-ghost btn-sm" style="text-align:center;cursor:pointer;">Upload Logo<input type="file" accept="image/*" id="brandLogoFile" style="display:none;" onchange="handleBrandLogoUpload(event)" /></label>
          \${b.logo ? '<button class="btn btn-danger btn-sm" onclick="clearBrandLogo()">Remove Logo</button>' : ''}
        </div>
      </div>
      <div class="field"><label>Panel Name</label><input id="brandName" value="\${esc(b.name)}" placeholder="FRPTS" /></div>
      <button class="btn btn-gold btn-block" onclick="saveBranding()">Save Branding</button>
      <div id="brandStatus" style="font-size:12px;margin-top:10px;"></div>
    </div>\`;
}
let pendingBrandLogo = null;
function handleBrandLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = (e) => {
    img.onload = () => {
      // Step 1: draw at natural size and strip the background to transparency.
      const work = document.createElement('canvas');
      work.width = img.width; work.height = img.height;
      const wctx = work.getContext('2d');
      wctx.drawImage(img, 0, 0);
      const imgData = wctx.getImageData(0, 0, work.width, work.height);
      const d = imgData.data;
      // Sample the four corners and average them as the background reference color —
      // handles the common case of a solid (often white) background behind a logo.
      const corners = [
        [0, 0], [work.width - 1, 0], [0, work.height - 1], [work.width - 1, work.height - 1]
      ].map(([x, y]) => {
        const i = (y * work.width + x) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      });
      const bg = [0, 1, 2].map(c => Math.round(corners.reduce((s, p) => s + p[c], 0) / corners.length));
      const threshold = 38, softEdge = 26;
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.sqrt((d[i] - bg[0]) ** 2 + (d[i + 1] - bg[1]) ** 2 + (d[i + 2] - bg[2]) ** 2);
        if (dist < threshold) d[i + 3] = 0;
        else if (dist < threshold + softEdge) d[i + 3] = Math.round(d[i + 3] * (dist - threshold) / softEdge);
      }
      wctx.putImageData(imgData, 0, 0);

      // Step 2: fit (not crop) the now-transparent logo into the square, centered.
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(size / work.width, size / work.height);
      const w = work.width * scale, h = work.height * scale;
      ctx.drawImage(work, (size - w) / 2, (size - h) / 2, w, h);
      pendingBrandLogo = canvas.toDataURL('image/png');
      document.getElementById('brandLogoPreview').innerHTML = '<img src="' + pendingBrandLogo + '" style="width:100%;height:100%;object-fit:contain;" />';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
async function clearBrandLogo() {
  await api('/api/admin/branding', { method: 'POST', body: JSON.stringify({ logo: null }) });
  renderAdminTab('branding');
}
async function saveBranding() {
  const name = document.getElementById('brandName').value.trim();
  const body = { name };
  if (pendingBrandLogo) body.logo = pendingBrandLogo;
  await api('/api/admin/branding', { method: 'POST', body: JSON.stringify(body) });
  pendingBrandLogo = null;
  const status = document.getElementById('brandStatus');
  status.textContent = 'Saved - reload to see it everywhere ✓';
  status.style.color = 'var(--success)';
}

async function renderAdminTelephony(el) {
  const res = await api('/api/admin/telephony-config');
  const cfg = (await res.json()).data || { menu_options: [], hold_music_url: null, ring_behavior: 'keep_ringing' };
  window._telephonyConfig = cfg;
  window._telephonyEl = el;
  renderTelephonyLocal();
}
function renderTelephonyLocal() {
  const el = window._telephonyEl;
  const cfg = window._telephonyConfig;
  const connected = cfg.twilio_connected;
  el.innerHTML = \`
    <div class="panel p fade-up" style="border-color:var(--gold-glow);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <span class="badge important">Coming Soon</span>
        <div class="section-title" style="margin:0;">Inbound Call Routing</div>
      </div>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;">
        This configures how inbound calls to your business number get handled. It needs a connected Twilio number to actually receive calls — everything below can be set up now so it's ready the moment that's connected.
      </p>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-top:10px;">
        <b style="color:var(--text);">How it'll work:</b> a caller dials your number → hears your menu and picks an option → hears your hold music while the system finds an available caller → the call gets bridged straight to that caller's phone, ringing them until they pick up.
      </p>
    </div>

    <div class="panel p fade-up">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div class="section-title" style="margin:0;">Twilio Connection</div>
        \${connected ? '<span class="badge successful_call">Connected</span>' : '<span class="badge not_called">Not Connected</span>'}
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.6;">Connect your own Twilio account. This automatically points your number's webhook at this server — no manual setup on Twilio's side needed. Requires: a Twilio account, a phone number purchased on it, the Account SID and Auth Token from your Twilio console.</p>
      \${connected ? \`
        <div class="info-row"><span class="k">Account SID</span><span class="v mono">\${esc(cfg.twilio_account_sid || '')}</span></div>
        <div class="info-row"><span class="k">Number</span><span class="v mono">\${esc(cfg.twilio_phone_number || '')}</span></div>
        <button class="btn btn-danger btn-sm" style="margin-top:10px;" onclick="disconnectTwilio()">Disconnect</button>
      \` : \`
        <div class="field"><label>Account SID</label><input id="twilioSid" placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" /></div>
        <div class="field"><label>Auth Token</label><input id="twilioToken" type="password" placeholder="Your Twilio Auth Token" /></div>
        <div class="field"><label>Phone Number</label><input id="twilioPhone" placeholder="+441234567890" /></div>
        <button class="btn btn-gold btn-block" onclick="connectTwilio()">Connect &amp; Auto-Configure</button>
        <div id="twilioConnectStatus" style="font-size:12px;margin-top:8px;"></div>
      \`}
    </div>

    \${connected ? \`<div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Recent Inbound Calls</div>
      <div id="inboundCallsList">Loading…</div>
    </div>\` : ''}

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">3CX</div>
      <p style="font-size:12px;color:var(--text-dim);line-height:1.6;">3CX is a different kind of system (a PBX you self-host or run through their cloud, not a simple API like Twilio) — connecting it needs a separate integration built specifically for it. Not available yet. If you want this instead of or alongside Twilio, flag it and it can be scoped properly.</p>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Greeting</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">What the caller hears named at the start. Leave blank to use your panel name automatically.</p>
      <div class="field"><label>Say this name</label><input id="greetingName" value="\${esc(cfg.greeting_name || '')}" placeholder="e.g. FRPTS Support" onchange="updateGreetingName(this.value)" /></div>
      <p style="font-size:11.5px;color:var(--text-faint);margin-top:8px;">Preview: "Thanks for calling \${esc(cfg.greeting_name || '[your panel name]')}\${cfg.menu_options.length ? '. ' + cfg.menu_options.map(o => 'Press ' + esc(o.digit) + ' for ' + esc(o.label) + '.').join(' ') : '. Please hold while we connect you.'}"</p>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Menu Options</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">What callers hear and can press. Each option routes to a different team or queue once this is live.</p>
      <div id="menuOptionsList">\${cfg.menu_options.map((o, i) => \`<div class="row-flex" style="margin-bottom:8px;" data-menu-row="\${i}">
        <div class="field" style="max-width:70px;"><label>Press</label><input value="\${esc(o.digit)}" maxlength="1" onchange="updateMenuOption(\${i}, 'digit', this.value)" /></div>
        <div class="field"><label>Routes To</label><input value="\${esc(o.label)}" placeholder="e.g. New Enquiry" onchange="updateMenuOption(\${i}, 'label', this.value)" /></div>
        <button class="btn btn-danger btn-sm" style="align-self:flex-end;margin-bottom:13px;" onclick="removeMenuOption(\${i})">Remove</button>
      </div>\`).join('')}</div>
      <button class="btn btn-ghost btn-sm" onclick="addMenuOption()">+ Add Option</button>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Hold Music</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">Plays to the caller while the system looks for an available caller to bridge them to.</p>
      <div style="display:flex;align-items:center;gap:12px;">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer;">Upload Audio<input type="file" accept="audio/*" id="holdMusicFile" style="display:none;" onchange="handleHoldMusicUpload(event)" /></label>
        <span id="holdMusicStatus" style="font-size:12px;color:var(--text-dim);">\${cfg.hold_music_url ? 'Audio uploaded' : 'No audio uploaded yet'}</span>
      </div>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">When No One's Available</div>
      <p style="font-size:12px;color:var(--text-dim);">Set to keep ringing/holding until a caller picks up - no voicemail fallback for now.</p>
      <div class="badge not_called" style="margin-top:6px;">Keep Ringing Until Answered</div>
    </div>

    <button class="btn btn-gold btn-block" onclick="saveTelephonyConfig()">Save Configuration</button>
    <div id="telephonyStatus" style="font-size:12px;margin-top:10px;text-align:center;"></div>
  \`;
  if (connected) loadInboundCalls();
}
async function loadInboundCalls() {
  const res = await api('/api/admin/inbound-calls');
  const rows = (await res.json()).data;
  const list = document.getElementById('inboundCallsList');
  if (!list) return;
  list.innerHTML = rows.length ? rows.map(r => \`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
    <div><div style="font-size:13px;font-weight:600;" class="mono">\${esc(r.from_number || 'Unknown')}</div><div style="font-size:11px;color:var(--text-dim);">\${r.menu_selection ? esc(r.menu_selection) + ' · ' : ''}\${timeAgo(r.created_at)}</div></div>
    \${statusBadge(r.status)}
  </div>\`).join('') : '<div style="color:var(--text-dim);font-size:12.5px;">No calls yet.</div>';
}
async function connectTwilio() {
  const account_sid = document.getElementById('twilioSid').value.trim();
  const auth_token = document.getElementById('twilioToken').value.trim();
  const phone_number = document.getElementById('twilioPhone').value.trim();
  const status = document.getElementById('twilioConnectStatus');
  if (!account_sid || !auth_token || !phone_number) { status.textContent = 'All three fields are required.'; status.style.color = 'var(--danger)'; return; }
  status.textContent = 'Connecting…'; status.style.color = 'var(--text-dim);';
  const res = await api('/api/admin/telephony-config/connect-twilio', { method: 'POST', body: JSON.stringify({ account_sid, auth_token, phone_number }) });
  const data = await res.json();
  if (!res.ok) { status.textContent = data.error || 'Connection failed.'; status.style.color = 'var(--danger)'; return; }
  renderAdminTab('telephony');
}
async function disconnectTwilio() {
  if (!confirm('Disconnect this Twilio number? Inbound calls will stop routing here.')) return;
  await api('/api/admin/telephony-config/disconnect-twilio', { method: 'POST' });
  renderAdminTab('telephony');
}
function addMenuOption() {
  window._telephonyConfig.menu_options.push({ digit: String(window._telephonyConfig.menu_options.length + 1), label: '' });
  renderTelephonyLocal();
}
function removeMenuOption(i) {
  window._telephonyConfig.menu_options.splice(i, 1);
  renderTelephonyLocal();
}
function updateMenuOption(i, field, value) {
  window._telephonyConfig.menu_options[i][field] = value;
}
function updateGreetingName(value) {
  window._telephonyConfig.greeting_name = value;
}
function handleHoldMusicUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    window._telephonyConfig.hold_music_url = e.target.result;
    document.getElementById('holdMusicStatus').textContent = 'Audio uploaded (' + file.name + ')';
  };
  reader.readAsDataURL(file);
}
async function saveTelephonyConfig() {
  await api('/api/admin/telephony-config', { method: 'POST', body: JSON.stringify(window._telephonyConfig) });
  const status = document.getElementById('telephonyStatus');
  status.textContent = 'Saved - ready for when a number is connected';
  status.style.color = 'var(--success)';
}
`;
