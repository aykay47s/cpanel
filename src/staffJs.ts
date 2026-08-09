export const STAFF_JS = `
function switchStaffTab(tab) {
  staffTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'queue' || tab === 'chat') clearNavBadge(tab);
  if (tab === 'home') renderStaffHome();
  else if (tab === 'queue') renderStaffQueue();
  else if (tab === 'chat') { const body = document.getElementById('staffBody'); body.innerHTML = '<div class="fade-up" id="staffChatWrap"></div>'; renderChatInto(document.getElementById('staffChatWrap')); }
  else if (tab === 'board') renderStaffBoard();
  else if (tab === 'profile') renderStaffProfile();
}

async function renderStaffHome() {
  const body = document.getElementById('staffBody');
  const [meRes, goalRes, annRes, lbRes] = await Promise.all([
    api('/api/me'), fetch('/api/goal'), api('/api/announcements'), api('/api/leaderboard'),
  ]);
  const fresh = (await meRes.json()).data; me = { ...me, ...fresh }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  const goal = (await goalRes.json()).data;
  const anns = (await annRes.json()).data;
  const lb = (await lbRes.json()).data;
  const myRank = (lb.findIndex(r => r.id === me.id) + 1) || '—';
  const myStat = lb.find(r => r.id === me.id) || { successful_calls: 0 };
  const level = Math.floor(me.xp / 150) + 1;
  const xpInLevel = me.xp % 150;
  const goalPct = Math.min(100, Math.round((goal.current / goal.target) * 100));

  body.innerHTML = \`
    <div class="panel p fade-up" style="position:relative;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div style="width:52px;height:52px;border-radius:14px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:26px;border:1px solid var(--border-2);">\${me.avatar || '🧑'}</div>
        <div style="flex:1;">
          <div style="font-size:19px;">\${esc(me.name)}</div>
          <div style="display:flex;gap:6px;margin-top:5px;">
            <span class="badge \${me.role}">\${me.role}</span>
            <span class="badge" style="background:rgba(139,111,201,.14);color:var(--violet);">Lvl \${level}</span>
            <span class="badge" style="background:rgba(255,255,255,.06);color:var(--text-dim);">Rank #\${myRank}</span>
          </div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;display:flex;justify-content:space-between;"><span>\${xpInLevel} / 150 XP</span><span>\${me.xp} total</span></div>
      <div style="height:7px;border-radius:5px;background:var(--s3);overflow:hidden;"><div style="height:100%;width:\${Math.round(xpInLevel/150*100)}%;background:linear-gradient(90deg,var(--violet),#a78bfa);border-radius:5px;"></div></div>
    </div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-box panel"><div class="num">\${myStat.successful_calls || 0}</div><div class="lbl">Successful</div></div>
      <div class="stat-box panel"><div class="num">\${me.xp}</div><div class="lbl">XP</div></div>
      <div class="stat-box panel"><div class="num">\${me.clocked_in ? 'On' : 'Off'}</div><div class="lbl">Shift</div></div>
    </div>
    <div class="panel p fade-up">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;"><span style="font-size:12px;color:var(--text-dim);font-weight:600;">${'\uD83C\uDFAF'} \${esc(goal.label)}</span><span class="mono" style="font-size:14px;font-weight:700;color:var(--gold-bright);">\${goal.current}/\${goal.target}</span></div>
      <div style="height:9px;border-radius:5px;background:var(--s3);overflow:hidden;"><div style="height:100%;width:\${goalPct}%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));border-radius:5px;"></div></div>
    </div>
    <div class="section-title">Announcements</div>
    \${anns.length ? anns.map(a => \`<div class="announcement panel \${a.important ? 'important' : ''} fade-up"><div><div class="txt">\${esc(a.content)}</div><div class="meta">\${a.author_name || 'Admin'} · \${timeAgo(a.created_at)}</div></div></div>\`).join('') : '<div style="color:var(--text-faint);font-size:13px;padding:10px 2px;">Nothing from admin yet.</div>'}
  \`;
}

async function renderStaffQueue() {
  const body = document.getElementById('staffBody');
  const mineRes = await api('/api/caller/mine');
  if (me.role === 'caller') {
    const mine = (await mineRes.json()).data;
    if (mine) return renderActiveCall(body, mine, 'caller');
    if (!me.clocked_in) { body.innerHTML = offlineHtml(); return; }
    const qRes = await api('/api/caller/queue');
    const rows = (await qRes.json()).data;
    body.innerHTML = rows.length ? rows.map(o => offerCardHtml(o)).join('') : radarHtml();
  } else if (me.role === 'finisher') {
    const qRes = await api('/api/finisher/queue');
    const rows = (await qRes.json()).data;
    const active = rows.find(r => r.status === 'assigned_to_finisher');
    if (active && active._working) return renderActiveCall(body, active, 'finisher');
    body.innerHTML = rows.length ? \`<div class="section-title" style="margin-top:0;">Assigned to You (\${rows.length})</div>\` + rows.map(o => finisherCardHtml(o)).join('') : \`<div class="empty-state panel fade-up">\${ICONS.flag}<div style="font-weight:700;margin:8px 0 4px;">No leads waiting</div><div style="font-size:12.5px;">Admin will assign leads here when ready.</div></div>\`;
  }
}
function offlineHtml() { return \`<div class="empty-state panel fade-up"><div style="font-size:34px;margin-bottom:14px;opacity:.5;">\u{1F4A4}</div><div style="font-weight:700;margin-bottom:4px;">You're offline</div><div style="font-size:13px;">Clock in from the top bar to start receiving leads</div></div>\`; }
function radarHtml() { return \`<div class="radar-zone panel fade-up"><div class="radar"><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-sweep"></div><div class="radar-core"></div></div><div class="waiting-title">Listening for leads</div><div class="waiting-sub">You'll be notified the instant one comes in</div></div>\`; }
function offerCardHtml(o) {
  return \`<div class="offer-card fade-up" data-lead-id="\${o.id}"><div class="pulse-dot"></div><div class="offer-label">New Lead</div><div class="offer-name">\${fullName(o)}</div><div class="offer-meta mono">\${o.phone}\${o.source ? ' · ' + o.source : ''}</div>
    <div class="offer-actions"><button class="btn btn-gold" onclick="claimLead(\${o.id})">Take Call</button><button class="btn btn-ghost" onclick="renderStaffQueue()">Skip</button></div></div>\`;
}
function finisherCardHtml(o) {
  return \`<div class="offer-card fade-up" style="border-color:rgba(63,168,154,.4);"><div class="offer-label" style="color:var(--teal);">Ready to Finish</div><div class="offer-name">\${fullName(o)}</div><div class="offer-meta mono">\${o.phone}</div>\${o.notes ? '<div style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">' + esc(o.notes) + '</div>' : ''}
    <button class="btn btn-teal btn-block" onclick="startFinishingCall(\${o.id})">Begin Working This Lead</button></div>\`;
}
let workingFinisherLeadId = null;
function startFinishingCall(id) { workingFinisherLeadId = id; renderStaffQueue(); }

async function claimLead(id) {
  const res = await api('/api/caller/leads/' + id + '/claim', { method: 'POST' });
  if (res.status === 409) { const card = document.querySelector('[data-lead-id="' + id + '"]'); if (card) card.style.opacity = '.4'; }
  renderStaffQueue();
}

async function renderActiveCall(body, lead, role) {
  let scripts = [];
  try { const sRes = await api('/api/scripts?type=' + encodeURIComponent(lead.lead_type || 'general')); scripts = (await sRes.json()).data; } catch {}
  const isFinisher = role === 'finisher';
  body.innerHTML = \`
    <div class="panel call-card fade-up">
      <div class="call-status-row"><span class="badge \${lead.status}">\${lead.status.replace(/_/g,' ')}</span><span class="call-timer mono" id="callTimer">00:00</span></div>
      <div class="info-row"><span class="k">Name</span><span class="v">\${fullName(lead)}</span></div>
      <div class="info-row"><span class="k">Phone</span><span class="v mono">\${lead.phone}</span></div>
      \${lead.email ? '<div class="info-row"><span class="k">Email</span><span class="v">' + lead.email + '</span></div>' : ''}
      \${lead.notes ? '<div class="info-row"><span class="k">Notes</span><span class="v">' + esc(lead.notes) + '</span></div>' : ''}
      \${!isFinisher ? \`<div class="call-action-row">
        <a class="dial-btn" href="tel:\${lead.phone}">\${ICONS.phone} Dial</a>
        \${lead.status === 'calling' ? '<button class="oncall-btn" onclick="connectCall(' + lead.id + ')">Mark On Call</button>' : '<button class="endcall-btn" style="grid-column:auto;" onclick="endCall(' + lead.id + ')">End Call</button>'}
      </div>\` : \`<div class="call-action-row"><a class="dial-btn" href="tel:\${lead.phone}" style="grid-column:1/-1;">\${ICONS.phone} Dial \${lead.phone}</a></div>\`}
      \${scripts.length ? \`<div class="scripts-toggle" onclick="this.nextElementSibling.classList.toggle('open')"><span>\${ICONS.doc || ''} Scripts (\${scripts.length})</span><span>▾</span></div><div class="scripts-panel">\${scripts.map(s => '<div class="script-item"><div class="title">' + esc(s.title) + '</div><div class="content">' + esc(s.content) + '</div></div>').join('')}</div>\` : ''}
      \${!isFinisher && lead.status === 'call_ended' ? \`<div class="outcome-grid">
        <button class="win-btn" style="grid-column:1/-1;" onclick="recordOutcome(\${lead.id},'successful_call')">Successful Call</button>
        <button class="review-btn" onclick="recordOutcome(\${lead.id},'requires_review')">Requires Review</button>
        <button class="fail-btn" style="grid-column:2/4;" onclick="recordOutcome(\${lead.id},'failed')">Unsuccessful</button>
      </div>\` : ''}
      \${isFinisher ? \`<div class="outcome-grid">
        <button class="win-btn" style="grid-column:1/-1;" onclick="finisherOutcome(\${lead.id},'completed')">Mark Completed</button>
        <button class="review-btn" onclick="finisherOutcome(\${lead.id},'requires_review')">Requires Review</button>
        <button class="fail-btn" style="grid-column:2/4;" onclick="finisherOutcome(\${lead.id},'failed')">Unsuccessful</button>
      </div>\` : ''}
    </div>\`;
  if (!callStart) callStart = Date.now();
  startCallTimer();
}
function startCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const el = document.getElementById('callTimer'); if (!el) return;
    const s = Math.floor((Date.now() - callStart) / 1000);
    el.textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  }, 1000);
}
async function connectCall(id) { await api('/api/caller/leads/' + id + '/connect', { method: 'POST' }); renderStaffQueue(); }
async function endCall(id) { await api('/api/caller/leads/' + id + '/end-call', { method: 'POST' }); renderStaffQueue(); }
async function recordOutcome(id, outcome) {
  await api('/api/caller/leads/' + id + '/outcome', { method: 'POST', body: JSON.stringify({ outcome, duration: callStart ? Math.floor((Date.now()-callStart)/1000) : 0 }) });
  callStart = null; clearInterval(callTimerInterval);
  renderStaffQueue();
}
async function finisherOutcome(id, outcome) {
  await api('/api/finisher/leads/' + id + '/outcome', { method: 'POST', body: JSON.stringify({ outcome }) });
  callStart = null; clearInterval(callTimerInterval); workingFinisherLeadId = null;
  renderStaffQueue();
}

async function renderStaffBoard() {
  const body = document.getElementById('staffBody');
  const res = await api('/api/leaderboard');
  const rows = (await res.json()).data;
  body.innerHTML = '<div class="panel p fade-up">' + rows.map((r, i) => \`
    <div class="lb-row"><div class="rank \${i===0?'r1':i===1?'r2':i===2?'r3':''}">\${i+1}</div><div class="lb-av">\${r.avatar||'🧑'}</div>
      <div class="lb-name">\${esc(r.name)}\${r.id===me.id?' <span style="color:var(--gold-bright);">(you)</span>':''} <span class="badge \${r.role}" style="margin-left:4px;">\${r.role}</span></div>
      <div class="lb-stats"><span><b>\${r.successful_calls||0}</b> success</span><span style="color:var(--violet);"><b>\${r.xp}</b> xp</span></div></div>\`).join('') + '</div>';
}

async function renderStaffProfile() {
  const body = document.getElementById('staffBody');
  body.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Display Name</div>
      <div class="field"><input id="pfName" value="\${esc(me.name)}" /></div>
      <div class="section-title">Avatar</div>
      <div class="avatar-grid" id="avatarGrid"></div>
      <button class="btn btn-gold btn-block" onclick="saveProfile()">Save Changes</button>
      <div id="profileStatus" style="font-size:12px;margin-top:10px;"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Notification Preferences</div>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Lead assignments</span><input type="checkbox" id="prefLead" checked style="width:auto;" /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Chat messages</span><input type="checkbox" id="prefChat" checked style="width:auto;" /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Announcements</span><input type="checkbox" id="prefAnn" checked style="width:auto;" /></label>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="saveNotifPrefs()">Save Preferences</button>
    </div>
    <div class="panel p fade-up"><button class="btn btn-danger btn-block" onclick="logout()">Log Out</button></div>
  \`;
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = AVATARS.map(a => '<div class="avatar-opt ' + (a === me.avatar ? 'sel' : '') + '" data-av="' + a + '">' + a + '</div>').join('');
  grid.addEventListener('click', (e) => { const opt = e.target.closest('.avatar-opt'); if (!opt) return; grid.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('sel')); opt.classList.add('sel'); });
}
async function saveProfile() {
  const name = document.getElementById('pfName').value.trim();
  const avatar = document.querySelector('.avatar-opt.sel');
  const res = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify({ name, avatar: avatar ? avatar.dataset.av : undefined }) });
  const data = await res.json();
  me = { ...me, ...data.data }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  document.getElementById('profileStatus').textContent = 'Saved ✓'; document.getElementById('profileStatus').style.color = 'var(--success)';
}
async function saveNotifPrefs() {
  await api('/api/me/notif-prefs', { method: 'PATCH', body: JSON.stringify({ lead_assigned: document.getElementById('prefLead').checked, chat: document.getElementById('prefChat').checked, announcements: document.getElementById('prefAnn').checked }) });
  alert('Preferences saved');
}
`;
