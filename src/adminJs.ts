export const ADMIN_JS = `
function switchAdminTab(tab) {
  if (typeof onCallTimerInterval !== 'undefined') clearInterval(onCallTimerInterval);
  currentAdminTab = tab;
  document.querySelectorAll('.side-link[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  renderAdminTab(tab);
}

// Every screen explains itself in one sentence — same place, same style, so
// nobody needs a walkthrough to know what a tab is for or what acting on it does.
const TAB_HINTS = {
  dashboard: 'Live overview of the whole floor — lead totals, who is on a call right now, and everything that just happened.',
  leads: 'Every lead in the system. Click a row for its full history, send one to a specific caller, or search and filter across all of them.',
  import: 'Paste or upload raw lead data — it gets parsed, previewed, and de-duplicated before anything touches the live queue.',
  vault: 'Held-back leads that callers cannot see yet. Release them into the live queue in batches whenever you want the floor to have them.',
  duplicates: 'Leads flagged as possible duplicates of each other — confirm the match to merge them, or clear the flag.',
  finishing: 'Successful calls waiting for a finisher — assign each one to whoever should close it out.',
  roster: 'Everyone on the team: their PINs, roles, call-from numbers, and profile. Add people or change roles here.',
  leaderboard: 'XP-ranked board across the team. This Week is a rolling 7-day race; All Time never resets. Expand "How XP works" below for the exact payouts.',
  announcements: 'Broadcast to the whole team — important ones are highlighted and push-notified to everyone.',
  goal: "One shared team target shown on every caller home screen, with live progress.",
  scripts: 'Approved call scripts, organised by lead category — callers see the matching ones automatically during a call. Caller suggestions land here for review.',
  template: "The call guide shown at the top of every caller active-call screen.",
  categories: 'Lead types with their colours (and bank marks where they match a real bank) — used for badges and script matching everywhere.',
  branding: "Your panel name and logo, applied across login, title bar, and the mobile home-screen icon.",
  telephony: 'Inbound call routing. Connect Twilio (or 3CX) and calls to your number get menued, held, and bridged to your callers automatically.',
};
async function renderAdminTab(tab) {
  const el = document.getElementById('adminContent');
  if (tab !== 'chat') el.innerHTML = '<div class="loading-shimmer"></div><div class="loading-shimmer" style="width:70%;"></div>';
  try {
    if (tab === 'dashboard') await renderAdminDashboard(el);
    else if (tab === 'leads') await renderAdminLeads(el);
    else if (tab === 'import') await renderAdminImport(el);
    else if (tab === 'vault') await renderAdminVault(el);
    else if (tab === 'duplicates') await renderAdminDuplicates(el);
    else if (tab === 'finishing') await renderAdminFinishing(el);
    else if (tab === 'roster') await renderAdminRoster(el);
    else if (tab === 'chat') { el.innerHTML = '<div class="fade-up" id="adminChatWrap"></div>'; await renderChatInto(document.getElementById('adminChatWrap')); }
    else if (tab === 'announcements') await renderAdminAnnouncements(el);
    else if (tab === 'goal') await renderAdminGoal(el);
    else if (tab === 'scripts') await renderAdminScripts(el);
    else if (tab === 'template') await renderAdminTemplate(el);
    else if (tab === 'categories') await renderAdminCategories(el);
    else if (tab === 'leaderboard') await renderAdminLeaderboard(el);
    else if (tab === 'branding') await renderAdminBranding(el);
    else if (tab === 'telephony') await renderAdminTelephony(el);
    el.classList.remove('page-transition'); void el.offsetWidth; el.classList.add('page-transition');
      if (TAB_HINTS[tab] && !el.querySelector('.tab-hint')) {
      const hint = document.createElement('div');
      hint.className = 'tab-hint';
      hint.innerHTML = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg><span>' + TAB_HINTS[tab] + '</span>';
      el.prepend(hint);
    }
  } catch (err) {
    console.error('Tab render failed:', tab, err);
    el.innerHTML = '<div class="panel p fade-up" style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">Something went wrong loading this.</div><div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">' + esc(String(err && err.message || err)) + '</div><button class="btn btn-gold" onclick="renderAdminTab(\\'' + tab + '\\')">Retry</button></div>';
  }
}

async function renderAdminDashboard(el) {
  const [res, statusRes] = await Promise.all([api('/api/admin/dashboard'), api('/api/center-status')]);
  const d = (await res.json()).data;
  const center = (await statusRes.json()).data;
  el.innerHTML = \`
    <div id="callerIdPopZone"></div>
    <div class="panel p fade-up" style="display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;\${center.open ? '' : 'border-color:var(--gold-glow);'}">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span class="badge \${center.open ? 'successful_call' : 'failed'}">\${center.open ? 'Open' : 'Closed'}</span>
          <b style="font-size:14px;">Call Center Status</b>
        </div>
        <p style="font-size:12px;color:var(--text-dim);margin:0;">\${center.open ? 'Callers and finishers can clock in normally.' : 'Callers cannot clock in until you reopen — they see: "' + esc(center.reason) + '"'}</p>
      </div>
      <button class="btn \${center.open ? 'btn-danger' : 'btn-gold'}" onclick="toggleCenterStatus(\${center.open})">\${center.open ? 'Close for the Day' : 'Start the Day'}</button>
    </div>
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
async function toggleCenterStatus(currentlyOpen) {
  if (currentlyOpen) {
    const reason = prompt('Message callers will see when they try to clock in (e.g. "Back at 9am tomorrow"):', 'The call center is closed right now. Check back soon.');
    if (reason === null) return;
    const res = await api('/api/admin/center-status', { method: 'POST', body: JSON.stringify({ open: false, reason }) });
    const data = await res.json();
    if (data.autoEnded > 0) {
      let msg = 'Closed for the day. Automatically clocked out ' + data.autoEnded + ' still-active session(s).';
      if (data.interruptedCalls > 0) msg += ' ' + data.interruptedCalls + ' call(s) still in progress were moved to Requires Review.';
      alert(msg);
    }
  } else {
    await api('/api/admin/center-status', { method: 'POST', body: JSON.stringify({ open: true }) });
  }
  renderAdminTab('dashboard');
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
    <div class="panel p fade-up"><div class="table-scroll"><table><thead><tr><th>Lead</th><th>Category</th><th>Phone</th><th>Status</th><th>Caller</th><th>Finisher</th><th>Uploaded</th><th>Send To</th><th></th></tr></thead>
    <tbody id="leadsTbody">\${rows.map(leadRowHtml).join('')}</tbody></table></div></div>\`;
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
  const domain = BANK_DOMAINS[String(leadType).toLowerCase()];
  const logoImg = domain
    ? '<img src="https://www.google.com/s2/favicons?domain=' + domain + '&sz=64" alt="" style="width:15px;height:15px;border-radius:4px;object-fit:contain;flex-shrink:0;" onerror="this.remove()" />'
    : '';
  return '<span class="badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;gap:5px;">' + logoImg + esc(leadType) + '</span>';
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
    <div class="import-steps">
      <div class="import-step on"><span class="n">1</span>Paste</div><div class="bar"></div>
      <div class="import-step" id="istep2"><span class="n">2</span>Category</div><div class="bar"></div>
      <div class="import-step" id="istep3"><span class="n">3</span>Review</div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Paste your leads</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;line-height:1.5;">Any format works — CSV, pipe-separated, or freeform text, local or international numbers. Card numbers, CVVs and passwords are stripped automatically before anything is stored.</p>
      <textarea id="importText" rows="8" placeholder="John Smith, 07515 944454, john@email.com, 42 Oak St&#10;paste one lead per line — thousands at once is fine" oninput="importStepActive(this.value.trim()?2:1)"></textarea>
      <div style="display:flex;align-items:center;gap:10px;margin-top:10px;">
        <label class="btn btn-ghost btn-sm" style="cursor:pointer;">Upload a file<input type="file" id="importFile" accept=".txt,.csv,.tsv" style="display:none;" onchange="handleImportFile(event)" /></label>
        <span id="importFileName" style="font-size:11.5px;color:var(--text-dim);"></span>
      </div>
      <div class="field" style="margin-top:16px;">
        <label>Which bank are these for?</label>
        <p style="font-size:11px;color:var(--text-faint);margin:-2px 0 8px;line-height:1.4;">This tags every lead in the batch. Manage the list under Lead Categories.</p>
        <select id="importLeadType">\${cats.map(c => '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>').join('') || '<option value="general">General</option>'}</select>
      </div>
      <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="runImportPreview()">Analyze \u2192</button>
    </div>
    <div id="importPreview"></div>\`;
}
function importStepActive(n) {
  const s2 = document.getElementById('istep2'), s3 = document.getElementById('istep3');
  if (s2) s2.classList.toggle('on', n >= 2);
  if (s3) s3.classList.toggle('on', n >= 3);
}
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  document.getElementById('importFileName').textContent = file.name + ' (' + Math.round(file.size / 1024) + 'KB)';
  const reader = new FileReader();
  reader.onload = (e) => { document.getElementById('importText').value = e.target.result; };
  reader.readAsText(file);
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
  importStepActive(3);
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
      <label style="display:flex;align-items:center;gap:8px;margin-top:14px;font-size:12.5px;color:var(--text-dim);cursor:pointer;"><input type="checkbox" class="toggle-switch" id="importToVault" /> Send to Vault instead of the live queue (release manually later)</label>
      <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="confirmImport()">Import <span id="importCount">\${lastImportPreview.length}</span> Leads</button>
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
  const to_vault = document.getElementById('importToVault')?.checked || false;
  const validLeads = lastImportPreview.filter(r => r.phone && r.phone.replace(/[^\\d]/g, '').length >= 7);
  const invalidCount = lastImportPreview.length - validLeads.length;
  if (!validLeads.length) {
    return alert('None of the ' + lastImportPreview.length + ' row(s) have a phone number with at least 7 digits. Edit the Phone field directly in the row(s) above, then hit Import again.');
  }
  if (invalidCount > 0 && !confirm(invalidCount + ' row(s) are missing a valid phone and will be skipped. Import the remaining ' + validLeads.length + '?')) return;
  const res = await api('/api/admin/leads/import/confirm', { method: 'POST', body: JSON.stringify({ leads: validLeads, lead_type, source: 'import', to_vault }) });
  const data = await res.json();
  alert((to_vault ? 'Sent ' : 'Imported ') + data.inserted + (to_vault ? ' lead(s) to the vault' : ' leads') + (data.flagged ? ' (' + data.flagged + ' flagged as possible duplicates for review)' : ''));
  switchAdminTab(to_vault ? 'vault' : 'leads');
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
  el.innerHTML = \`<div class="panel p fade-up"><div class="table-scroll"><table><thead><tr><th>Lead</th><th>Phone</th><th>Status</th><th>Finisher</th><th>Assign</th></tr></thead>
    <tbody>\${rows.map(l => \`<tr><td>\${esc(fullName(l))}</td><td class="mono">\${l.phone}</td><td>\${statusBadge(l.status)}</td><td>\${l.finisher_name || '—'}</td>
      <td><select onchange="assignFinisher(\${l.id}, this.value)"><option value="">Choose…</option>\${finishers.map(f => '<option value="' + f.id + '">' + f.name + '</option>').join('')}</select></td></tr>\`).join('') || '<tr><td colspan="5" style="color:var(--text-dim);">Nothing waiting.</td></tr>'}</tbody></table></div></div>\`;
}
async function assignFinisher(leadId, finisherId) { if (!finisherId) return; await api('/api/admin/leads/' + leadId + '/assign-finisher', { method: 'POST', body: JSON.stringify({ finisherId: Number(finisherId) }) }); renderAdminTab('finishing'); }

async function renderAdminRoster(el) {
  const [res, staleRes] = await Promise.all([api('/api/admin/users'), api('/api/admin/stale-clockins')]);
  const rows = (await res.json()).data;
  const stale = (await staleRes.json()).data;
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
    \${stale.length ? \`<div class="panel p fade-up" style="border-color:var(--gold-glow);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><span class="badge important">\${stale.length} Forgot to Clock Out</span><div class="section-title" style="margin:0;">End Day</div></div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">Still shown as clocked in but hasn't done anything in the app for over 15 minutes - likely just forgot to clock out at the end of their shift.</p>
      \${stale.map(u => \`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
        \${avatarHtml(u, 26)}
        <span style="flex:1;font-size:13px;">\${esc(u.name)}</span>
        <span style="font-size:11px;color:var(--text-faint);">\${u.minutes_since_seen ? Math.round(u.minutes_since_seen) + 'm ago' : 'never seen'}</span>
        <button class="btn btn-ghost btn-sm" onclick="endDayFor(\${u.id})">Clock Out</button>
      </div>\`).join('')}
      <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="endDayAll()">Clock Out All \${stale.length}</button>
    </div>\` : ''}
    <div class="panel p fade-up"><div class="table-scroll"><table><thead><tr><th></th><th>Name</th><th>PIN</th><th>Role</th><th>Call Number</th><th>XP</th><th>Clocked</th><th>Right Now</th><th></th></tr></thead>
    <tbody>\${rows.map(u => \`<tr><td>\${avatarHtml(u, 24)}</td><td>\${esc(u.name)}</td><td class="pin-display">\${u.pin}</td><td>\${statusBadge(u.role)}</td>
      <td>\${u.call_phone ? '<span class="blur-phone mono" onclick="this.classList.toggle(\\'revealed\\')">' + esc(u.call_phone) + '</span>' : '<span style="color:var(--text-faint);">—</span>'}</td>
      <td>\${u.xp}</td><td>\${statusBadge(u.status)}\${u.clocked_in ? ' <span class="mono roster-clock-timer" data-uid="' + u.id + '" style="font-size:10.5px;color:var(--gold-bright);"></span>' : ''}</td>
      <td>\${rightNowBadge(u)}</td>
      <td style="display:flex;gap:6px;"><select onchange="changeRole(\${u.id}, this.value)" style="width:auto;padding:6px 8px;font-size:11px;"><option value="">Change role…</option><option value="caller">Caller</option><option value="finisher">Finisher</option><option value="admin">Admin</option></select><button class="btn btn-ghost btn-sm" onclick="viewClockHistory(\${u.id},'\${esc(u.name)}')">History</button><button class="btn btn-danger btn-sm" onclick="removeUser(\${u.id})">Remove</button></td></tr>\`).join('')}</tbody></table></div></div>
    <div id="clockHistoryPanel"></div>\`;
  loadRosterClockTimers(rows);
}
async function endDayFor(id) {
  await api('/api/admin/end-day', { method: 'POST', body: JSON.stringify({ ids: [id] }) });
  renderAdminTab('roster');
}
async function endDayAll() {
  if (!confirm('Clock out everyone shown as forgotten? This ends their shift immediately.')) return;
  const res = await api('/api/admin/end-day', { method: 'POST', body: JSON.stringify({}) });
  const data = await res.json();
  alert('Clocked out ' + data.ended + ' forgotten session(s).');
  renderAdminTab('roster');
}
// What a clocked-in caller is genuinely doing right now, not just "online" - on a
// call (with who), actively using the app (recent heartbeat), or clocked in but the
// app hasn't checked in recently (backgrounded, or just sitting idle on a screen
// that isn't making any requests).
function rightNowBadge(u) {
  if (!u.clocked_in) return '<span style="color:var(--text-faint);font-size:12px;">—</span>';
  if (u.active_lead_status) {
    const leadName = [u.active_lead_first_name, u.active_lead_last_name].filter(Boolean).join(' ') || 'Unknown';
    return '<span class="badge calling">On Call</span> <span style="font-size:11px;color:var(--text-dim);">' + esc(leadName) + '</span>';
  }
  if (!u.last_seen_at) return '<span class="badge not_called">Away</span>';
  const secondsAgo = (Date.now() - new Date(u.last_seen_at).getTime()) / 1000;
  if (secondsAgo < 60) return '<span class="badge successful_call">Active</span>';
  if (secondsAgo < 300) return '<span class="badge important">Idle</span> <span style="font-size:11px;color:var(--text-dim);">' + Math.round(secondsAgo/60) + 'm</span>';
  return '<span class="badge not_called">Away</span> <span style="font-size:11px;color:var(--text-dim);">' + Math.round(secondsAgo/60) + 'm</span>';
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
    <div class="table-scroll"><table><thead><tr><th>Clocked In</th><th>Clocked Out</th><th>Duration</th></tr></thead>
    <tbody>\${rows.map(s => \`<tr><td>\${new Date(s.clocked_in_at).toLocaleString()}</td><td>\${s.clocked_out_at ? new Date(s.clocked_out_at).toLocaleString() : '<span style="color:var(--gold-bright);">still active</span>'}</td><td class="mono">\${s.duration_seconds ? Math.floor(s.duration_seconds/3600)+'h '+Math.floor(s.duration_seconds%3600/60)+'m' : '—'}</td></tr>\`).join('') || '<tr><td colspan="3" style="color:var(--text-dim);">No sessions yet.</td></tr>'}</tbody></table></div></div>\`;
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
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);text-transform:none;letter-spacing:0;font-weight:500;"><input type="checkbox" class="toggle-switch" id="annImportant" /> Mark important</label>
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

let bankPickerTab = 'uk';
let bankPickerQuery = '';
async function renderAdminCategories(el) {
  const res = await api('/api/lead-categories');
  const cats = (await res.json()).data;
  window._catNames = new Set(cats.map(c => c.name.toLowerCase()));
  el.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add a Bank</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:14px;line-height:1.5;">Search UK or international banks and tap to add — the real logo comes with it and shows on every lead. Not listed? Type any bank name under Custom and it still gets a logo.</p>
      <div class="seg-tabs" style="margin-bottom:12px;">
        <button class="seg-tab \${bankPickerTab==='uk'?'on':''}" onclick="setBankTab('uk')">UK Banks</button>
        <button class="seg-tab \${bankPickerTab==='intl'?'on':''}" onclick="setBankTab('intl')">International</button>
        <button class="seg-tab \${bankPickerTab==='custom'?'on':''}" onclick="setBankTab('custom')">Custom</button>
      </div>
      <div id="bankPickerBody"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Your Categories (\${cats.length})</div>
      \${cats.length ? cats.map(cat => \`<div style="display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid var(--border);">
        \${cat.domain ? '<img src="' + bankLogoUrl(cat.domain) + '" style="width:24px;height:24px;border-radius:6px;object-fit:contain;flex-shrink:0;" onerror="this.remove()" />' : '<span style="width:14px;height:14px;border-radius:4px;background:' + cat.color + ';flex-shrink:0;"></span>'}
        <span style="flex:1;font-size:13px;">\${esc(cat.name)}</span>
        <button class="btn btn-danger btn-sm" onclick="deleteCategory(\${cat.id})">Delete</button>
      </div>\`).join('') : '<div style="color:var(--text-dim);">No categories yet — add your first bank above.</div>'}
    </div>\`;
  renderBankPicker();
}
function setBankTab(t) { bankPickerTab = t; bankPickerQuery = ''; renderAdminTab('categories'); }
function renderBankPicker() {
  const wrap = document.getElementById('bankPickerBody');
  if (!wrap) return;
  if (bankPickerTab === 'custom') {
    wrap.innerHTML = '<div class="row-flex">'
      + '<div class="field" style="flex:2;"><label>Bank name</label><input id="customBankName" placeholder="e.g. First National Bank" oninput="previewCustomBank()" /></div>'
      + '<div class="field" style="flex:2;"><label>Website (for the logo)</label><input id="customBankDomain" placeholder="e.g. fnb.co.za" oninput="previewCustomBank()" /></div>'
      + '</div>'
      + '<div id="customBankPreview" style="display:flex;align-items:center;gap:10px;margin:4px 0 14px;min-height:26px;"></div>'
      + '<button class="btn btn-gold" onclick="addCustomBank()">Add Category</button>'
      + '<p style="font-size:11px;color:var(--text-faint);margin-top:10px;line-height:1.5;">The website is only used to fetch the logo — enter the bank main domain, no https. Leave it blank for a plain coloured tag.</p>';
    return;
  }
  const list = BANK_DIR[bankPickerTab] || [];
  const q = bankPickerQuery.toLowerCase();
  const filtered = q ? list.filter(b => b[0].toLowerCase().includes(q)) : list;
  // Cards carry the name/domain as data-* and are handled by one delegated
  // listener (installed once, below) — no inline-onclick quote escaping, which is
  // exactly the thing that keeps breaking inside the page's outer template string.
  let cards = '';
  for (const b of filtered) {
    const added = window._catNames && window._catNames.has(b[0].toLowerCase());
    cards += '<div class="bank-card' + (added ? ' added' : '') + '"'
      + (added ? '' : ' data-bank-name="' + esc(b[0]) + '" data-bank-domain="' + esc(b[1]) + '"')
      + '><img src="' + bankLogoUrl(b[1]) + '" onerror="this.remove()" /><span class="bn">' + esc(b[0]) + '</span></div>';
  }
  wrap.innerHTML = '<input placeholder="Search ' + filtered.length + ' banks…" value="' + esc(bankPickerQuery) + '" oninput="bankPickerQuery=this.value;renderBankPicker()" style="margin-bottom:6px;" autofocus />'
    + '<div class="bank-grid">' + cards + '</div>'
    + (filtered.length === 0 ? '<div style="color:var(--text-dim);font-size:12.5px;padding:8px 2px;">No match. Try the Custom tab to add it by hand.</div>' : '');
}
// One delegated handler for every bank card, present or future.
document.addEventListener('click', (e) => {
  const card = e.target.closest && e.target.closest('.bank-card[data-bank-name]');
  if (card) addBankFromDir(card, card.dataset.bankName, card.dataset.bankDomain);
});
// No regex literals here on purpose: inside the page's big template string, the
// escaping for /^https?:\/\// collapses and produces a broken pattern. Plain
// string ops are unambiguous and do the same job.
function normalizeDomain(v) {
  let d = String(v || '').trim();
  if (d.startsWith('http://')) d = d.slice(7);
  if (d.startsWith('https://')) d = d.slice(8);
  const slash = d.indexOf('/');
  if (slash !== -1) d = d.slice(0, slash);
  return d.trim();
}
function previewCustomBank() {
  const name = document.getElementById('customBankName').value.trim();
  const domain = normalizeDomain(document.getElementById('customBankDomain').value);
  const prev = document.getElementById('customBankPreview');
  if (!name) { prev.innerHTML = ''; return; }
  prev.innerHTML = (domain ? '<img src="' + bankLogoUrl(domain) + '" style="width:24px;height:24px;border-radius:6px;object-fit:contain;" onerror="this.remove()" />' : '') + '<span style="font-size:13px;font-weight:600;">' + esc(name) + '</span>';
}
async function addCustomBank() {
  const name = document.getElementById('customBankName').value.trim();
  const domain = normalizeDomain(document.getElementById('customBankDomain').value);
  if (!name) return alert('Enter a bank name');
  await api('/api/admin/lead-categories', { method: 'POST', body: JSON.stringify({ name, color: '#4f8cff', domain: domain || null }) });
  renderAdminTab('categories');
}
async function addBankFromDir(elm, name, domain) {
  elm.classList.add('added'); elm.onclick = null;
  await api('/api/admin/lead-categories', { method: 'POST', body: JSON.stringify({ name, color: '#4f8cff', domain }) });
  sharedCategoryCache = null;
  if (window._catNames) window._catNames.add(name.toLowerCase());
  renderAdminTab('categories');
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
  sharedCategoryCache = null;
  renderAdminTab('categories');
}

let adminLbMode = 'week';
async function renderAdminLeaderboard(el) {
  const res = await api('/api/leaderboard');
  const rows = (await res.json()).data;
  el.innerHTML = \`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
      <div class="seg-tabs">
        <button class="seg-tab \${adminLbMode==='week'?'on':''}" onclick="adminLbMode='week';renderAdminTab('leaderboard')">This Week</button>
        <button class="seg-tab \${adminLbMode==='all'?'on':''}" onclick="adminLbMode='all';renderAdminTab('leaderboard')">All Time</button>
      </div>
    </div>
    \${lbBoardHtml(rows, adminLbMode)}
    \${xpGuideHtml()}\`;
  animateCountUps(el);
}


async function renderAdminBranding(el) {
  const [bRes, tbRes] = await Promise.all([api('/api/branding'), api('/api/admin/telegram-bot')]);
  const b = (await bRes.json()).data;
  const tb = (await tbRes.json()).data;
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
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Your Telegram Bot (optional)</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.55;">Connect your own bot to DM your team announcements, shift reminders, or urgent alerts. Create a bot via <a href="https://t.me/BotFather" target="_blank" style="color:var(--gold-bright);">@BotFather</a> on Telegram, then paste the token below. This is entirely separate from ClearPanel's master bot — your callers will still verify with ClearPanel first regardless.</p>
      \${tb.configured ? '<div style="padding:12px 14px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);margin-bottom:14px;font-size:12.5px;"><b style="color:var(--success);">Connected</b> — @'+esc(tb.bot_username||'bot')+' · <button class="btn btn-danger btn-sm" onclick="clearTenantBot()" style="margin-left:10px;">Disconnect</button></div>' : ''}
      <div class="field"><label>Bot token from @BotFather</label><input id="tgBotToken" type="password" placeholder="\${tb.configured ? '••••••••••••  (replace to change)' : '123456789:AA...'}" /></div>
      <button class="btn btn-gold" onclick="saveTenantBot()">\${tb.configured ? 'Update Token' : 'Connect Bot'}</button>
      <div id="tgBotStatus" style="font-size:12px;margin-top:10px;"></div>
    </div>\`;
}
async function saveTenantBot() {
  const token = document.getElementById('tgBotToken').value.trim();
  const s = document.getElementById('tgBotStatus');
  if (!token) { s.textContent = 'Paste the token first.'; s.style.color = 'var(--danger)'; return; }
  s.textContent = 'Validating…'; s.style.color = 'var(--text-dim)';
  const r = await api('/api/admin/telegram-bot', { method:'POST', body: JSON.stringify({ bot_token: token })});
  const data = await r.json();
  if (!r.ok) { s.textContent = data.error || 'Failed'; s.style.color = 'var(--danger)'; return; }
  s.textContent = 'Connected ✓'; s.style.color = 'var(--success)';
  setTimeout(() => renderAdminTab('branding'), 800);
}
async function clearTenantBot() {
  if (!confirm('Disconnect your bot? Callers linked to it will no longer receive DMs from you.')) return;
  await api('/api/admin/telegram-bot', { method:'POST', body: JSON.stringify({ bot_token: '' })});
  renderAdminTab('branding');
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
  const [res, callersRes] = await Promise.all([api('/api/admin/telephony-config'), api('/api/admin/users')]);
  const cfg = (await res.json()).data || { menu_options: [], hold_music_url: null, ring_behavior: 'keep_ringing' };
  window._telephonyConfig = cfg;
  window._telephonyEl = el;
  window._telephonyCallers = (await callersRes.json()).data.filter(u => u.role === 'caller');
  renderTelephonyLocal();
  // 3CX health and DN list load after the first paint - they hit the PBX over the
  // network and shouldn't hold the whole tab hostage if the server is slow or down.
  if (cfg.provider === '3cx' && cfg.threecx_connected) refresh3cxStatus();
}
async function refresh3cxStatus() {
  try {
    const [statusRes, dnsRes] = await Promise.all([
      api('/api/admin/telephony/3cx/status'),
      api('/api/admin/telephony/3cx/dns'),
    ]);
    window._threecxStatus = (await statusRes.json()).data || null;
    const dnsBody = await dnsRes.json();
    window._threecxDns = dnsRes.ok ? (dnsBody.data || []) : [];
    window._threecxDnsError = dnsRes.ok ? null : (dnsBody.error || 'Could not read DNs');
  } catch (err) {
    window._threecxStatus = null;
    window._threecxDnsError = 'Could not reach the panel server';
  }
  if (window._telephonyEl && currentAdminTab === 'telephony') renderTelephonyLocal();
}
function renderTelephonyLocal() {
  const el = window._telephonyEl;
  const cfg = window._telephonyConfig;
  const connected = cfg.twilio_connected;
  el.innerHTML = \`
    <div class="panel p fade-up" style="border-color:var(--gold-glow);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        \${connected ? '<span class="badge successful_call">Live</span>' : '<span class="badge important">Ready to Connect</span>'}
        <div class="section-title" style="margin:0;">Inbound Call Routing</div>
      </div>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;">
        This is fully built and tested. \${connected ? 'Your number is connected and live - test it below with a real call.' : 'Connect your Twilio number below and it starts working immediately - no other setup needed.'}
      </p>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-top:10px;">
        <b style="color:var(--text);">How it works:</b> a caller dials your number → hears your menu and picks an option → hears your hold music while the system finds an available caller → the call gets bridged straight to that caller's phone, ringing them until they pick up.
      </p>
    </div>

    <div class="panel p fade-up" style="padding:6px;display:flex;gap:4px;">
      <button class="btn \${(cfg.provider || 'twilio') === 'twilio' ? 'btn-gold' : 'btn-ghost'}" style="flex:1;" onclick="switchTelephonyProvider('twilio')">Twilio</button>
      <button class="btn \${cfg.provider === '3cx' ? 'btn-gold' : 'btn-ghost'}" style="flex:1;" onclick="switchTelephonyProvider('3cx')">3CX</button>
    </div>

    \${(cfg.provider || 'twilio') === 'twilio' ? \`
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
    </div>\` : \`
    <div class="panel p fade-up">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div class="section-title" style="margin:0;">3CX Connection</div>
        \${cfg.threecx_connected ? '<span class="badge successful_call">Connected</span>' : '<span class="badge not_called">Not Connected</span>'}
      </div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:14px;line-height:1.6;">Connects to your PBX's Call Control API and routes inbound calls itself: the caller ID is matched against your leads, then the call is offered to your clocked-in callers in priority order until one answers. Requires a <b style="color:var(--text);">Route Point</b> in 3CX with your inbound rule pointed at it, and this API client granted access to it (Admin Console &gt; Integrations &gt; API).</p>
      \${cfg.threecx_connected ? \`
        <div class="info-row"><span class="k">Server</span><span class="v mono">\${esc(cfg.threecx_fqdn || '')}</span></div>
        <div class="info-row"><span class="k">Client ID</span><span class="v mono">\${esc(cfg.threecx_client_id || '')}</span></div>
        <div class="info-row"><span class="k">Call control link</span><span class="v">\${threecxLinkBadge()}</span></div>
        \${window._threecxStatus && window._threecxStatus.lastError ? '<div style="font-size:11.5px;color:var(--danger);margin:6px 0 0;">' + esc(window._threecxStatus.lastError) + '</div>' : ''}
        \${window._threecxDnsError ? '<div style="font-size:11.5px;color:var(--danger);margin:6px 0 0;">' + esc(window._threecxDnsError) + '</div>' : ''}

        <div class="field" style="margin-top:14px;"><label>Route Point (where your inbound rule sends calls)</label>
          <select id="threecxRoutePoint">
            <option value="">— select —</option>
            \${(window._threecxDns || []).map(d => '<option value="' + esc(d.dn) + '"' + (cfg.threecx_route_point === d.dn ? ' selected' : '') + '>' + esc(d.dn) + ' · ' + esc(d.type || '') + '</option>').join('')}
            \${cfg.threecx_route_point && !(window._threecxDns || []).some(d => d.dn === cfg.threecx_route_point) ? '<option value="' + esc(cfg.threecx_route_point) + '" selected>' + esc(cfg.threecx_route_point) + ' (saved)</option>' : ''}
          </select>
        </div>
        <div class="row-flex" style="gap:8px;">
          <div class="field" style="flex:1;"><label>Ring each caller for</label><input id="threecxRingSeconds" type="number" min="5" max="120" value="\${cfg.threecx_ring_seconds || 20}" /></div>
          <div class="field" style="flex:1;"><label>If nobody answers, send to</label><input id="threecxFallback" placeholder="e.g. 800 (voicemail/queue)" value="\${esc(cfg.threecx_fallback || '')}" /></div>
        </div>
        <div class="row-flex" style="gap:8px;">
          <button class="btn btn-gold" style="flex:1;" onclick="save3cxRouting()">Save Routing</button>
          <button class="btn btn-ghost" onclick="reconnect3cx()">Reconnect</button>
        </div>
        <div id="threecxRoutingStatus" style="font-size:12px;margin-top:8px;"></div>

        <details style="margin-top:14px;">
          <summary style="font-size:12px;color:var(--text-dim);cursor:pointer;">Webhook fallback (only if your PBX can't give this client a Route Point)</summary>
          <div class="field" style="margin-top:10px;"><label>Webhook URL (paste into 3CX)</label><input readonly value="\${window.location.origin}/api/telephony/3cx-webhook" onclick="this.select()" /></div>
          <p style="font-size:11.5px;color:var(--text-dim);line-height:1.6;">With the webhook alone, calls are logged and the lead pops up, but nothing is routed - the PBX decides where the call goes.</p>
        </details>
        <button class="btn btn-danger btn-sm" style="margin-top:12px;" onclick="disconnect3cx()">Disconnect</button>
      \` : \`
        <div class="field"><label>Server Address</label><input id="threecxFqdn" placeholder="yourcompany.3cx.eu or your own domain" /></div>
        <div class="field"><label>Client ID</label><input id="threecxClientId" placeholder="From 3CX Admin Console > Integrations > API" /></div>
        <div class="field"><label>Client Secret</label><input id="threecxClientSecret" type="password" placeholder="Your 3CX API Client Secret" /></div>
        <button class="btn btn-gold btn-block" onclick="connect3cx()">Verify &amp; Connect</button>
        <div id="threecxConnectStatus" style="font-size:12px;margin-top:8px;"></div>
      \`}
    </div>\`}

    \${connected ? \`<div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Send Test Call</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">The only way to hear the exact real voice - Twilio will actually call the number you enter and play your live greeting.</p>
      <div style="display:flex;gap:8px;">
        <input id="testCallNumber" placeholder="+441234567890" style="flex:1;" />
        <button class="btn btn-gold" onclick="sendTestCall()">Call Me</button>
      </div>
      <div id="testCallStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>\` : ''}

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Who Takes Inbound Calls</div>
      <div class="field"><label>Mode</label>
        <select id="inboundMode" onchange="updateInboundMode(this.value)">
          <option value="everyone" \${cfg.inbound_mode !== 'selected' ? 'selected' : ''}>Everyone clocked in</option>
          <option value="selected" \${cfg.inbound_mode === 'selected' ? 'selected' : ''}>Only selected callers below</option>
        </select>
      </div>
      <p style="font-size:11.5px;color:var(--text-dim);margin:6px 0 14px;line-height:1.5;">\${cfg.inbound_mode === 'selected' ? 'Only callers checked below (and clocked in) will ever receive an inbound call.' : 'Any clocked-in caller with a call-from number set can receive an inbound call - the toggles below are ignored in this mode.'}</p>
      <div class="section-title" style="font-size:10.5px;">Call Order (lower number = called first)</div>
      \${window._telephonyCallers.map(u => \`<div class="row-flex" style="align-items:center;margin-bottom:8px;">
        \${cfg.inbound_mode === 'selected' ? '<input type="checkbox" class="toggle-switch" ' + (u.inbound_eligible !== false ? 'checked' : '') + ' onchange="updateCallerInbound(' + u.id + ', this.checked, null)" style="margin-right:8px;" />' : ''}
        \${avatarHtml(u, 26)}
        <span style="flex:1;margin-left:8px;font-size:13px;">\${esc(u.name)}\${!u.call_phone && !u.threecx_extension ? ' <span style="color:var(--danger);font-size:11px;">(nowhere to ring)</span>' : ''}</span>
        \${cfg.provider === '3cx' ? '<input placeholder="ext" value="' + esc(u.threecx_extension || '') + '" style="width:70px;margin-right:6px;" onchange="updateCallerExtension(' + u.id + ', this.value)" />' : ''}
        <input type="number" value="\${u.inbound_priority ?? 100}" style="width:70px;" onchange="updateCallerInbound(\${u.id}, null, this.value)" />
      </div>\`).join('') || '<div style="color:var(--text-dim);font-size:12.5px;">No callers yet.</div>'}
    </div>

    \${connected ? \`<div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Recent Inbound Calls</div>
      <div id="inboundCallsList">Loading…</div>
    </div>\` : ''}

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">3CX</div>
      <p style=\"font-size:12px;color:var(--text-dim);line-height:1.6;\">Live. Switch the provider to 3CX above to connect your PBX and route inbound calls through the panel. Needs a Route Point in 3CX with your inbound rule pointed at it.</p>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Greeting</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">What the caller hears named at the start. Leave blank to use your panel name automatically.</p>
      <div class="field"><label>Say this name</label><input id="greetingName" value="\${esc(cfg.greeting_name || '')}" placeholder="e.g. FRPTS Support" onchange="updateGreetingName(this.value)" /></div>
      <p style="font-size:11.5px;color:var(--text-faint);margin-top:8px;" id="greetingPreviewText">Preview: "Thanks for calling \${esc(cfg.greeting_name || '[your panel name]')}\${cfg.menu_options.length ? '. ' + cfg.menu_options.map(o => 'Press ' + esc(o.digit) + ' for ' + esc(o.label) + '.').join(' ') : '. Please hold while we connect you.'}"</p>
      <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="playGreetingPreview()">\${ICONS.phone} Play Preview (approximate voice)</button>
      <p style="font-size:10.5px;color:var(--text-faint);margin-top:6px;">This uses your browser's voice, not Twilio's actual voice (Polly.Amy) - close, not identical. \${connected ? 'For the exact real voice, use Send Test Call below once connected.' : 'Connect Twilio below to send a real test call with the exact voice.'}</p>
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
function updateInboundMode(value) {
  window._telephonyConfig.inbound_mode = value;
  renderTelephonyLocal();
}
async function updateCallerInbound(userId, eligible, priority) {
  const body = {};
  if (eligible !== null) body.inbound_eligible = eligible;
  if (priority !== null) body.inbound_priority = parseInt(priority, 10) || 100;
  await api('/api/admin/users/' + userId + '/inbound-settings', { method: 'PATCH', body: JSON.stringify(body) });
  const u = window._telephonyCallers.find(c => c.id === userId);
  if (u) { if (eligible !== null) u.inbound_eligible = eligible; if (priority !== null) u.inbound_priority = body.inbound_priority; }
}
async function sendTestCall() {
  const to_number = document.getElementById('testCallNumber').value.trim();
  const status = document.getElementById('testCallStatus');
  if (!to_number) { status.textContent = 'Enter a number first.'; status.style.color = 'var(--danger)'; return; }
  status.textContent = 'Calling…'; status.style.color = 'var(--text-dim)';
  const res = await api('/api/admin/telephony-config/test-call', { method: 'POST', body: JSON.stringify({ to_number }) });
  const data = await res.json();
  if (!res.ok) { status.textContent = data.error || 'Call failed.'; status.style.color = 'var(--danger)'; return; }
  status.textContent = 'Calling you now - answer to hear the real greeting.'; status.style.color = 'var(--success)';
}
async function disconnectTwilio() {
  if (!confirm('Disconnect this Twilio number? Inbound calls will stop routing here.')) return;
  await api('/api/admin/telephony-config/disconnect-twilio', { method: 'POST' });
  renderAdminTab('telephony');
}
function switchTelephonyProvider(provider) {
  window._telephonyConfig.provider = provider;
  renderTelephonyLocal();
}
async function connect3cx() {
  const fqdn = document.getElementById('threecxFqdn').value.trim();
  const client_id = document.getElementById('threecxClientId').value.trim();
  const client_secret = document.getElementById('threecxClientSecret').value.trim();
  const status = document.getElementById('threecxConnectStatus');
  if (!fqdn || !client_id || !client_secret) { status.textContent = 'All three fields are required.'; status.style.color = 'var(--danger)'; return; }
  status.textContent = 'Verifying…'; status.style.color = 'var(--text-dim)';
  const res = await api('/api/admin/telephony-config/connect-3cx', { method: 'POST', body: JSON.stringify({ fqdn, client_id, client_secret }) });
  const data = await res.json();
  if (!res.ok) { status.textContent = data.error || 'Connection failed.'; status.style.color = 'var(--danger)'; return; }
  if (data.warning) alert(data.warning);
  renderAdminTab('telephony');
}
async function disconnect3cx() {
  if (!confirm('Disconnect this 3CX server? Inbound calls will stop being routed by the panel.')) return;
  await api('/api/admin/telephony-config/disconnect-3cx', { method: 'POST' });
  window._threecxStatus = null; window._threecxDns = [];
  renderAdminTab('telephony');
}
// Colour-coded so a dead socket is obvious at a glance - "connected" in the config
// only means credentials were accepted once, which is not the same as calls
// actually being routed right now.
function threecxLinkBadge() {
  const st = window._threecxStatus;
  if (!st) return '<span class="badge not_called">Checking…</span>';
  if (st.connected) return '<span class="badge successful_call">Live</span>' + (st.routePoint ? '' : ' <span style="font-size:11px;color:var(--danger);">no route point set</span>');
  return '<span class="badge important">Reconnecting…</span>';
}
async function save3cxRouting() {
  const status = document.getElementById('threecxRoutingStatus');
  const body = {
    route_point: document.getElementById('threecxRoutePoint').value,
    ring_seconds: document.getElementById('threecxRingSeconds').value,
    fallback: document.getElementById('threecxFallback').value.trim(),
  };
  status.textContent = 'Saving…'; status.style.color = 'var(--text-dim)';
  const res = await api('/api/admin/telephony/3cx/routing', { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) { status.textContent = data.error || 'Could not save.'; status.style.color = 'var(--danger)'; return; }
  window._telephonyConfig = Object.assign(window._telephonyConfig, data.data || {});
  status.textContent = 'Saved - live now ✓'; status.style.color = 'var(--success)';
  refresh3cxStatus();
}
async function reconnect3cx() {
  const status = document.getElementById('threecxRoutingStatus');
  status.textContent = 'Reconnecting…'; status.style.color = 'var(--text-dim)';
  await api('/api/admin/telephony/3cx/reconnect', { method: 'POST' });
  await refresh3cxStatus();
}
async function updateCallerExtension(userId, ext) {
  await api('/api/admin/users/' + userId + '/inbound-settings', { method: 'PATCH', body: JSON.stringify({ threecx_extension: ext }) });
  const u = window._telephonyCallers.find(c => c.id === userId);
  if (u) u.threecx_extension = ext.trim();
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
  updateGreetingPreviewText();
}
function updateGreetingName(value) {
  window._telephonyConfig.greeting_name = value;
  updateGreetingPreviewText();
}
function updateGreetingPreviewText() {
  const cfg = window._telephonyConfig;
  const el = document.getElementById('greetingPreviewText');
  if (!el) return;
  const name = cfg.greeting_name || '[your panel name]';
  const menuText = cfg.menu_options.length
    ? '. ' + cfg.menu_options.map(o => 'Press ' + o.digit + ' for ' + o.label + '.').join(' ')
    : '. Please hold while we connect you.';
  el.textContent = 'Preview: "Thanks for calling ' + name + menuText + '"';
}
function playGreetingPreview() {
  if (!('speechSynthesis' in window)) { alert('Your browser does not support speech preview.'); return; }
  const cfg = window._telephonyConfig;
  const name = cfg.greeting_name || 'us';
  const menuText = cfg.menu_options.length
    ? '. ' + cfg.menu_options.map(o => 'Press ' + o.digit + ' for ' + o.label + '.').join(' ')
    : '. Please hold while we connect you.';
  const text = 'Thanks for calling ' + name + menuText;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  window.speechSynthesis.speak(utter);
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

async function renderMasterControl(el) {
  el.innerHTML = '<div class="panel p">Loading tenants...</div>';
  const [tenantsRes, liveRes] = await Promise.all([
    api('/api/master/tenants'),
    api('/api/master/live-stats'),
  ]);
  const tenants = (await tenantsRes.json()).data;
  const live = (await liveRes.json()).data;
  const liveById = Object.fromEntries(live.map(l => [l.id, l]));

  const totalRevenue = tenants.reduce((sum, t) => sum + parseFloat(t.price_paid || 0), 0);
  const totalCallers = live.reduce((sum, l) => sum + (l.callers || 0), 0);
  const totalManagers = live.reduce((sum, l) => sum + (l.managers || 0), 0);
  const totalLeads = live.reduce((sum, l) => sum + (l.total_leads || 0), 0);

  el.innerHTML = \`
    <div class="stat-grid stagger" style="margin-bottom:20px;">
      <div class="stat-box panel accent"><div class="num" data-count="\${Math.round(totalRevenue)}">0</div><div class="lbl">Total Revenue (£)</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${tenants.length}">0</div><div class="lbl">Tenants</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${totalCallers}">0</div><div class="lbl">Total Callers</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${totalManagers}">0</div><div class="lbl">Total Managers</div></div>
      <div class="stat-box panel"><div class="num" data-count="\${totalLeads}">0</div><div class="lbl">Total Leads Across All</div></div>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Add Tenant</div>
      <p style="font-size:12px;color:var(--text-dim);margin-bottom:12px;">Register a customer instance you've provisioned - a separate deployment with its own database, not shared data.</p>
      <div class="row-flex">
        <div class="field"><label>Customer Name</label><input id="tName" placeholder="e.g. Acme Recovery Ltd" /></div>
        <div class="field"><label>Instance URL</label><input id="tUrl" placeholder="https://acme.up.railway.app" /></div>
      </div>
      <div class="row-flex">
        <div class="field"><label>Plan</label><select id="tPlan"><option value="trial">Trial</option><option value="3day">3 Day - £99</option><option value="7day">7 Day - £180</option><option value="monthly">1 Month - £750</option></select></div>
        <div class="field"><label>Price Paid (£)</label><input id="tPrice" type="number" value="0" /></div>
      </div>
      <div class="field"><label>Notes</label><input id="tNotes" placeholder="Optional" /></div>
      <button class="btn btn-gold btn-block" onclick="addTenant()">Add Tenant</button>
      <div id="addTenantStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>

    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">All Tenants</div>
      <div class="table-scroll"><table><thead><tr><th>Name</th><th>Plan</th><th>Paid</th><th>Status</th><th>Callers</th><th>Managers</th><th>Leads</th><th>Reachable</th><th></th></tr></thead>
      <tbody>\${tenants.map(t => {
        const l = liveById[t.id] || {};
        return \`<tr>
          <td>\${esc(t.name)}\${t.is_self ? ' <span class="badge important">You</span>' : ''}</td>
          <td>\${esc(t.plan)}</td>
          <td>£\${parseFloat(t.price_paid || 0).toFixed(2)}</td>
          <td>\${statusBadge(t.status)}</td>
          <td>\${l.callers ?? '—'}</td>
          <td>\${l.managers ?? '—'}</td>
          <td>\${l.total_leads ?? '—'}</td>
          <td>\${l.reachable ? '<span class="badge successful_call">Online</span>' : '<span class="badge failed">Unreachable</span>'}</td>
          <td>\${t.is_self ? '' : '<button class="btn btn-danger btn-sm" onclick="deleteTenant(' + t.id + ')">Remove</button>'}</td>
        </tr>\`;
      }).join('')}</tbody></table></div>
    </div>\`;
  animateCountUps(el);
}
async function addTenant() {
  const name = document.getElementById('tName').value.trim();
  const url = document.getElementById('tUrl').value.trim();
  const plan = document.getElementById('tPlan').value;
  const price_paid = parseFloat(document.getElementById('tPrice').value) || 0;
  const notes = document.getElementById('tNotes').value.trim();
  const status = document.getElementById('addTenantStatus');
  if (!name || !url) { status.textContent = 'Name and URL are required.'; status.style.color = 'var(--danger)'; return; }
  const res = await api('/api/master/tenants', { method: 'POST', body: JSON.stringify({ name, url, plan, price_paid, notes }) });
  if (!res.ok) { status.textContent = 'Failed to add tenant.'; status.style.color = 'var(--danger)'; return; }
  renderAdminTab('master');
}
async function deleteTenant(id) {
  if (!confirm('Remove this tenant from tracking? This does not delete or affect their actual instance.')) return;
  await api('/api/master/tenants/' + id, { method: 'DELETE' });
  renderAdminTab('master');
}

async function renderAdminVault(el) {
  window._vaultAgeGroup = window._vaultAgeGroup || 'all';
  const res = await api('/api/admin/vault?age_group=' + window._vaultAgeGroup);
  const data = await res.json();
  const rows = data.data;
  const stats = data.ageStats || {};
  const groups = ['18-25', '26-35', '36-45', '46-55', '56-65', '65+'];
  const totalCount = (stats['18-25']||0)+(stats['26-35']||0)+(stats['36-45']||0)+(stats['46-55']||0)+(stats['56-65']||0)+(stats['65+']||0)+(stats.unknown||0);
  const groupLabel = window._vaultAgeGroup === 'all' ? 'All Leads' : window._vaultAgeGroup === 'unknown' ? 'No DOB on File' : window._vaultAgeGroup + ' years';
  el.innerHTML = \`
    <div class="vault-workspace fade-up">
      <aside class="vault-rail">
        <div class="vault-rail-head">
          <div class="vault-rail-title">Lead Vault</div>
          <p class="vault-rail-sub">Held back from the live queue until released — one at a time, in batches, or filtered by age.</p>
        </div>
        <nav class="vault-nav">
          <button class="vault-nav-item \${window._vaultAgeGroup === 'all' ? 'active' : ''}" onclick="setVaultAgeGroup('all')"><span>All Leads</span><span class="vault-nav-count">\${totalCount}</span></button>
          \${groups.map(g => \`<button class="vault-nav-item \${window._vaultAgeGroup === g ? 'active' : ''}" onclick="setVaultAgeGroup('\${g}')"><span>\${g}</span><span class="vault-nav-count">\${stats[g] || 0}</span></button>\`).join('')}
          <button class="vault-nav-item \${window._vaultAgeGroup === 'unknown' ? 'active' : ''}" onclick="setVaultAgeGroup('unknown')" style="opacity:.75;"><span>No DOB</span><span class="vault-nav-count">\${stats.unknown || 0}</span></button>
        </nav>
        <div class="vault-rail-actions">
          <label class="vault-field-label">Release Oldest N</label>
          <div class="row-flex" style="gap:8px;">
            <input id="releaseCount" type="number" placeholder="e.g. 10" />
            <button class="btn btn-teal btn-sm" onclick="releaseFromVault()">Go</button>
          </div>
          <button class="btn btn-gold btn-block" style="margin-top:12px;" onclick="releaseAllShown()">Release All Shown (\${rows.length})</button>
        </div>
      </aside>
      <div class="vault-main">
        <div class="vault-main-head">
          <div>
            <div class="vault-main-title">\${groupLabel}</div>
            <div class="vault-main-count">\${rows.length} lead\${rows.length === 1 ? '' : 's'} waiting</div>
          </div>
        </div>
        <div class="table-scroll"><table><thead><tr><th>Lead</th><th>Phone</th><th>Age</th><th>Category</th><th>Imported</th><th></th></tr></thead>
        <tbody>\${rows.map(r => \`<tr><td>\${esc(fullName(r))}</td><td class="mono">\${r.phone}</td><td>\${r.age != null ? r.age : '—'}</td><td>\${categoryBadge(r.lead_type)}</td><td>\${timeAgo(r.created_at)}</td><td><button class="btn btn-teal btn-sm" onclick="releaseOne(\${r.id})">Release</button></td></tr>\`).join('') || '<tr><td colspan="6"><div class="vault-empty">Nothing here right now. Import leads with "Send to Vault" checked to hold them back from the live queue.</div></td></tr>'}</tbody></table></div>
      </div>
    </div>\`;
}
function setVaultAgeGroup(g) { window._vaultAgeGroup = g; renderAdminTab('vault'); }
async function releaseOne(id) {
  await api('/api/admin/vault/release', { method: 'POST', body: JSON.stringify({ ids: [id] }) });
  renderAdminTab('vault');
}
async function releaseFromVault() {
  const count = parseInt(document.getElementById('releaseCount').value, 10);
  if (!count || count < 1) { alert('Enter how many to release.'); return; }
  const ageGroup = window._vaultAgeGroup !== 'all' && window._vaultAgeGroup !== 'unknown' ? window._vaultAgeGroup : undefined;
  const res = await api('/api/admin/vault/release', { method: 'POST', body: JSON.stringify({ count, age_group: ageGroup }) });
  const data = await res.json();
  alert('Released ' + data.released + ' lead(s).');
  renderAdminTab('vault');
}
async function releaseAllShown() {
  const rows = document.querySelectorAll('[onclick^="releaseOne("]');
  const ids = Array.from(rows).map(b => parseInt(b.getAttribute('onclick').match(/\d+/)[0], 10));
  if (!ids.length) return;
  if (!confirm('Release all ' + ids.length + ' shown lead(s) into the live queue?')) return;
  await api('/api/admin/vault/release', { method: 'POST', body: JSON.stringify({ ids }) });
  renderAdminTab('vault');
}
`;
