export const ADMIN_JS = `
function switchAdminTab(tab) {
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
      <div class="stat-box panel accent"><div class="num">\${d.total}</div><div class="lbl">Total Leads</div></div>
      <div class="stat-box panel"><div class="num">\${d.uncalled}</div><div class="lbl">Not Called</div></div>
      <div class="stat-box panel"><div class="num">\${d.active_calls}</div><div class="lbl">Active Calls</div></div>
      <div class="stat-box panel"><div class="num">\${d.successful}</div><div class="lbl">Successful</div></div>
      <div class="stat-box panel"><div class="num">\${d.awaiting_finishing}</div><div class="lbl">Awaiting Finishing</div></div>
      <div class="stat-box panel"><div class="num">\${d.assigned_finishing}</div><div class="lbl">With Finishers</div></div>
      <div class="stat-box panel"><div class="num">\${d.completed}</div><div class="lbl">Completed</div></div>
      <div class="stat-box panel" style="\${d.requires_review > 0 ? 'border-color:var(--gold-glow);' : ''}"><div class="num">\${d.requires_review}</div><div class="lbl">Needs Review</div></div>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);">
      <div class="stat-box panel"><div class="num">\${d.callers_online}</div><div class="lbl">Callers Online</div></div>
      <div class="stat-box panel"><div class="num">\${d.finishers_online}</div><div class="lbl">Finishers Online</div></div>
    </div>
    <div class="section-title">Recent Activity</div>
    <div class="panel p">
      <div class="timeline">\${d.recentEvents.map(e => \`<div class="timeline-item"><div class="ev">\${eventLabel(e)}</div><div class="meta">\${e.actor_name || 'System'} · \${fullName(e)} · \${timeAgo(e.created_at)}</div></div>\`).join('') || '<div style="color:var(--text-dim);">No activity yet.</div>'}</div>
    </div>\`;
}
function eventLabel(e) {
  const map = { uploaded: 'Lead uploaded', claimed: 'Lead claimed', call_connected: 'Call connected', call_ended: 'Call ended', outcome_recorded: 'Outcome: ' + (e.to_status || ''), queued_for_finishing: 'Queued for finishing', assigned_finisher: 'Assigned to finisher', reassigned_finisher: 'Reassigned finisher', finisher_outcome: 'Finisher outcome: ' + (e.to_status || ''), admin_override: 'Admin override', merged: 'Marked duplicate', duplicate_dismissed: 'Duplicate dismissed' };
  return map[e.event_type] || e.event_type;
}

async function renderAdminLeads(el) {
  const res = await api('/api/admin/leads');
  const rows = (await res.json()).data;
  el.innerHTML = \`
    <div class="row-flex fade-up" style="margin-bottom:16px;">
      <div class="field"><input id="leadSearch" placeholder="Search name, phone, email…" oninput="debouncedLeadSearch()" /></div>
      <select id="leadStatusFilter" style="max-width:220px;" onchange="filterLeadsByStatus()"><option value="">All statuses</option>\${LEAD_STATUSES.map(s => '<option value="' + s + '">' + s.replace(/_/g,' ') + '</option>').join('')}</select>
    </div>
    <div class="panel p fade-up"><table><thead><tr><th>Lead</th><th>Phone</th><th>Status</th><th>Caller</th><th>Finisher</th><th>Uploaded</th></tr></thead>
    <tbody id="leadsTbody">\${rows.map(leadRowHtml).join('')}</tbody></table></div>\`;
}
function leadRowHtml(l) {
  return \`<tr class="clickable" onclick="openLeadDetail(\${l.id})"><td>\${esc(fullName(l))} \${l.dedup_status === 'flagged' ? '<span class="dup-warn">possible dup</span>' : ''}</td><td class="mono">\${l.phone}</td><td><span class="badge \${l.status}">\${l.status.replace(/_/g,' ')}</span></td><td>\${l.caller_name || '—'}</td><td>\${l.finisher_name || '—'}</td><td>\${timeAgo(l.created_at)}</td></tr>\`;
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
        <span class="badge \${l.status}">\${l.status.replace(/_/g,' ')}</span>
      </div>
      \${l.address ? '<div class="info-row"><span class="k">Address</span><span class="v">' + esc(l.address) + '</span></div>' : ''}
      <div class="info-row"><span class="k">Uploaded by</span><span class="v">\${l.uploaded_by_name || '—'} · \${timeAgo(l.created_at)}</span></div>
      <div class="info-row"><span class="k">Caller</span><span class="v">\${l.caller_name || '—'}</span></div>
      <div class="info-row"><span class="k">Finisher</span><span class="v">\${l.finisher_name || '—'}</span></div>
      \${l.notes ? '<div class="info-row"><span class="k">Notes</span><span class="v">' + esc(l.notes) + '</span></div>' : ''}
      \${l.status === 'requires_review' ? \`<div style="margin-top:16px;display:flex;gap:8px;"><button class="btn btn-teal btn-sm" onclick="overrideStatus(\${l.id},'ready_for_finishing')">Send to Finishing</button><button class="btn btn-ghost btn-sm" onclick="overrideStatus(\${l.id},'not_called')">Reset to Not Called</button><button class="btn btn-danger btn-sm" onclick="overrideStatus(\${l.id},'failed')">Mark Failed</button></div>\` : ''}
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
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Smart Import</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">Paste leads in any format — CSV, pipe-separated, freeform text, phone numbers with or without separators, local or international. Sensitive data (card numbers, CVVs, passwords) is automatically stripped before anything is stored.</p>
      <textarea id="importText" rows="9" placeholder="John Smith, 555-123-4567, john@email.com, 42 Oak St&#10;or paste freeform data, CSV, or pipe-separated rows"></textarea>
      <div class="row-flex" style="margin-top:12px;">
        <div class="field"><label>Assign Lead Type</label><input id="importLeadType" placeholder="general" /></div>
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
  const validLeads = lastImportPreview.filter(r => r.phone && r.phone.replace(/[^\d]/g, '').length >= 7);
  if (!validLeads.length) return alert('No rows have a valid phone number');
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
    <tbody>\${rows.map(l => \`<tr><td>\${esc(fullName(l))}</td><td class="mono">\${l.phone}</td><td><span class="badge \${l.status}">\${l.status.replace(/_/g,' ')}</span></td><td>\${l.finisher_name || '—'}</td>
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
    <tbody>\${rows.map(u => \`<tr><td style="font-size:17px;">\${u.avatar||'🧑'}</td><td>\${esc(u.name)}</td><td class="pin-display">\${u.pin}</td><td><span class="badge \${u.role}">\${u.role}</span></td>
      <td>\${u.call_phone ? '<span class="blur-phone mono" onclick="this.classList.toggle(\\'revealed\\')">' + esc(u.call_phone) + '</span>' : '<span style="color:var(--text-faint);">—</span>'}</td>
      <td>\${u.xp}</td><td><span class="badge \${u.status}">\${u.status}</span></td>
      <td style="display:flex;gap:6px;"><select onchange="changeRole(\${u.id}, this.value)" style="width:auto;padding:6px 8px;font-size:11px;"><option value="">Change role…</option><option value="caller">Caller</option><option value="finisher">Finisher</option><option value="admin">Admin</option></select><button class="btn btn-danger btn-sm" onclick="removeUser(\${u.id})">Remove</button></td></tr>\`).join('')}</tbody></table></div>\`;
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
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add Script</div>
      <div class="row-flex"><div class="field"><label>Title</label><input id="scTitle" /></div><div class="field"><label>Lead Type</label><input id="scType" placeholder="general" /></div></div>
      <div class="field"><label>Content</label><textarea id="scContent" rows="4"></textarea></div>
      <button class="btn btn-gold btn-block" onclick="addScript()">Publish</button>
    </div>
    <div class="panel p fade-up"><div class="section-title" style="margin-top:0;">Scripts (\${rows.length})</div>
      \${rows.map(s => \`<div style="padding:12px 0;border-bottom:1px solid var(--border);"><b style="color:var(--gold-bright);font-size:13px;">\${esc(s.title)}</b> <span style="font-size:11px;color:var(--text-dim);">· \${s.lead_type}</span><div style="font-size:12.5px;color:var(--text-dim);margin-top:4px;white-space:pre-wrap;">\${esc(s.content)}</div><button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="deleteScript(\${s.id})">Delete</button></div>\`).join('') || '<div style="color:var(--text-dim);">No scripts yet.</div>'}
    </div>\`;
}
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
`;
