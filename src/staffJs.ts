export const STAFF_JS = `
async function switchStaffTab(tab) {
  staffTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'queue' || tab === 'chat') clearNavBadge(tab);
  const body = document.getElementById('staffBody');
  try {
    if (tab === 'home') await renderStaffHome();
    else if (tab === 'queue') await renderStaffQueue();
    else if (tab === 'chat') { body.innerHTML = '<div class="fade-up" id="staffChatWrap"></div>'; await renderChatInto(document.getElementById('staffChatWrap')); }
    else if (tab === 'board') await renderStaffBoard();
    else if (tab === 'profile') await renderStaffProfile();
  } catch (err) {
    console.error('Staff tab render failed:', tab, err);
    body.innerHTML = '<div class="panel p fade-up" style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">Something went wrong loading this.</div><div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">' + esc(String(err && err.message || err)) + '</div><button class="btn btn-gold" onclick="switchStaffTab(\\'' + tab + '\\')">Retry</button></div>';
  }
}

async function renderStaffHome() {
  const body = document.getElementById('staffBody');
  const [meRes, goalRes, annRes, lbRes] = await Promise.all([
    api('/api/me'), api('/api/goal'), api('/api/announcements'), api('/api/leaderboard'),
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
    <div class="section-title">Suggest a Script</div>
    <div class="panel p fade-up">
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;line-height:1.4;">Got a line that's working well for you? Send it in — admin reviews it and can approve it for the whole team to see during calls.</p>
      <div class="field"><input id="scriptSuggestTitle" placeholder="Give it a short title" /></div>
      <div class="field"><textarea id="scriptSuggestContent" rows="3" placeholder="What do you actually say?"></textarea></div>
      <button class="btn btn-gold btn-block" onclick="suggestScript()">Send for Review</button>
      <div id="scriptSuggestStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>
  \`;
}
async function suggestScript() {
  const title = document.getElementById('scriptSuggestTitle').value.trim();
  const content = document.getElementById('scriptSuggestContent').value.trim();
  const status = document.getElementById('scriptSuggestStatus');
  if (!title || !content) { status.textContent = 'Add a title and the script text first.'; status.style.color = 'var(--danger)'; return; }
  await api('/api/scripts/submit', { method: 'POST', body: JSON.stringify({ title, content, callerId: me.id }) });
  document.getElementById('scriptSuggestTitle').value = '';
  document.getElementById('scriptSuggestContent').value = '';
  status.textContent = 'Sent to admin for review ✓';
  status.style.color = 'var(--success)';
}

async function renderStaffQueue() {
  const body = document.getElementById('staffBody');
  if (me.role === 'caller') {
    const mineRes = await api('/api/caller/mine');
    const mine = (await mineRes.json()).data;
    if (mine) return renderActiveCall(body, mine, 'caller');
    if (!me.clocked_in) { body.innerHTML = offlineHtml(); return; }
    const qRes = await api('/api/caller/queue');
    let rows = (await qRes.json()).data;
    rows = rows.filter(o => !skippedLeadIds.has(o.id));
    body.innerHTML = rows.length ? rows.map(o => offerCardHtml(o)).join('') : (skippedLeadIds.size ? skippedOnlyHtml() : radarHtml());
  } else if (me.role === 'finisher') {
    const qRes = await api('/api/finisher/queue');
    const rows = (await qRes.json()).data;
    const workingLead = workingFinisherLeadId ? rows.find(r => r.id === workingFinisherLeadId) : null;
    if (workingLead) return renderActiveCall(body, workingLead, 'finisher');
    body.innerHTML = rows.length ? \`<div class="section-title" style="margin-top:0;">Assigned to You (\${rows.length})</div>\` + rows.map(o => finisherCardHtml(o)).join('') : \`<div class="empty-state panel fade-up">\${ICONS.flag}<div style="font-weight:700;margin:8px 0 4px;">No leads waiting</div><div style="font-size:12.5px;">Admin will assign leads here when ready.</div></div>\`;
  }
}
function offlineHtml() { return \`<div class="empty-state panel fade-up"><div style="font-size:34px;margin-bottom:14px;opacity:.5;">\u{1F4A4}</div><div style="font-weight:700;margin-bottom:4px;">You're offline</div><div style="font-size:13px;">Clock in from the top bar to start receiving leads</div></div>\`; }
function skippedOnlyHtml() { return \`<div class="empty-state panel fade-up"><div style="font-size:34px;margin-bottom:14px;opacity:.5;">\u{1F440}</div><div style="font-weight:700;margin-bottom:4px;">Nothing left to show</div><div style="font-size:13px;margin-bottom:14px;">Every waiting lead is skipped for this session.</div><button class="btn btn-gold btn-sm" onclick="unskipAll()">Show skipped leads again</button></div>\`; }
let skippedLeadIds = new Set();
function skipLead(id) { skippedLeadIds.add(id); renderStaffQueue(); }
function unskipAll() { skippedLeadIds.clear(); renderStaffQueue(); }
function radarHtml() { return \`<div class="radar-zone panel fade-up"><div class="radar"><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-sweep"></div><div class="radar-core"></div></div><div class="waiting-title">Listening for leads</div><div class="waiting-sub">You'll be notified the instant one comes in</div></div>\`; }
function offerCardHtml(o) {
  return \`<div class="offer-card fade-up" data-lead-id="\${o.id}"><div class="pulse-dot"></div><div class="offer-label">New Lead</div><div class="offer-name">\${fullName(o)}</div><div class="offer-meta mono">\${o.phone}\${o.source ? ' · ' + o.source : ''}</div>
    <div class="offer-actions"><button class="btn btn-gold" onclick="claimLead(\${o.id})">Take Call</button><button class="btn btn-ghost" onclick="skipLead(\${o.id})">Skip</button></div></div>\`;
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
  let template = '';
  try { const sRes = await api('/api/scripts?type=' + encodeURIComponent(lead.lead_type || 'general')); scripts = (await sRes.json()).data; } catch {}
  try { const tRes = await api('/api/call-template'); template = (await tRes.json()).data.template; } catch {}
  const isFinisher = role === 'finisher';
  body.innerHTML = \`
    \${template && !isFinisher ? \`<div class="panel p fade-up" style="border-color:var(--gold-glow);"><div class="section-title" style="margin-top:0;">Call Guide</div><div style="font-size:13px;line-height:1.7;white-space:pre-wrap;color:var(--text);">\${esc(template)}</div></div>\` : ''}
    <div class="panel call-card fade-up">
      <div class="call-status-row"><span class="badge \${lead.status}">\${lead.status.replace(/_/g,' ')}</span><span class="call-timer mono" id="callTimer">00:00</span></div>
      <div class="info-row"><span class="k">Name</span><span class="v">\${fullName(lead)}</span></div>
      <div class="info-row"><span class="k">Phone</span><span class="v mono">\${lead.phone}</span></div>
      \${lead.email ? '<div class="info-row"><span class="k">Email</span><span class="v">' + lead.email + '</span></div>' : ''}
      \${lead.address ? '<div class="info-row"><span class="k">Address</span><span class="v">' + esc(lead.address) + '</span></div>' : ''}
      \${lead.notes ? '<div class="info-row"><span class="k">Notes</span><span class="v" style="white-space:pre-wrap;text-align:left;">' + esc(lead.notes) + '</span></div>' : ''}
      \${!isFinisher ? \`<div class="call-action-row">
        <a class="dial-btn" href="tel:\${lead.phone}">\${ICONS.phone} Dial</a>
        \${lead.status === 'calling' ? '<button class="oncall-btn" onclick="connectCall(' + lead.id + ')">Mark On Call</button>' : '<button class="endcall-btn" style="grid-column:auto;" onclick="endCall(' + lead.id + ')">End Call</button>'}
      </div>\` : \`<div class="call-action-row"><a class="dial-btn" href="tel:\${lead.phone}" style="grid-column:1/-1;">\${ICONS.phone} Dial \${lead.phone}</a></div>\`}
      \${!isFinisher ? \`<div class="field" style="margin-top:4px;">
        <label>Note for admin</label>
        <p style="font-size:11px;color:var(--text-faint);margin:-4px 0 8px;line-height:1.4;">Anything worth flagging while it's fresh — what they said, a callback time, a concern. It shows up for admin instantly, separate from the lead's own details.</p>
        <div style="display:flex;gap:8px;">
          <input id="liveNoteInput" placeholder="e.g. asked for a callback tomorrow 3pm" onkeydown="if(event.key==='Enter') pushLiveNote(\${lead.id})" />
          <button class="btn btn-ghost btn-sm" onclick="pushLiveNote(\${lead.id})">Add</button>
        </div>
        <div id="noteConfirm" style="font-size:11px;color:var(--success);margin-top:6px;height:14px;"></div>
      </div>\` : ''}
      \${scripts.length ? \`<div class="scripts-toggle" onclick="this.nextElementSibling.classList.toggle('open')"><span>\${ICONS.doc || ''} Scripts (\${scripts.length})</span><span>▾</span></div><div class="scripts-panel">\${scripts.map(s => '<div class="script-item"><div class="title">' + esc(s.title) + '</div><div class="content">' + esc(s.content) + '</div></div>').join('')}</div>\` : ''}
      \${!isFinisher ? \`<div class="outcome-grid" style="grid-template-columns:1fr 1fr;">
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'voicemail')">Voicemail</button>
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'no_answer')">No Answer</button>
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'hung_up')">Hung Up</button>
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'busy')">Busy</button>
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'cancelled')">Cancel</button>
        <button class="btn btn-ghost" onclick="recordOutcome(\${lead.id},'chopped_previously')">Chopped Previously</button>
        <button class="review-btn" style="grid-column:1/-1;" onclick="recordOutcome(\${lead.id},'callback_requested')">Callback Requested</button>
        <button class="win-btn" style="grid-column:1/-1;" onclick="recordOutcome(\${lead.id},'successful_call')">Successful Call</button>
        <button class="fail-btn" onclick="recordOutcome(\${lead.id},'failed')">Unsuccessful</button>
        <button class="review-btn" onclick="recordOutcome(\${lead.id},'requires_review')">Requires Review</button>
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
async function pushLiveNote(leadId) {
  const input = document.getElementById('liveNoteInput');
  const note = input.value.trim();
  if (!note) return;
  input.value = '';
  await api('/api/caller/leads/' + leadId + '/note', { method: 'POST', body: JSON.stringify({ note }) });
  const confirm = document.getElementById('noteConfirm');
  if (confirm) { confirm.textContent = 'Sent ✓'; setTimeout(() => { if (confirm) confirm.textContent = ''; }, 2000); }
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
  const meRes = await api('/api/me');
  const fresh = (await meRes.json()).data;
  me = { ...me, ...fresh }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  body.innerHTML = \`
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Profile Picture</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;">
        <div id="pfpPreview" style="width:64px;height:64px;border-radius:16px;background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:30px;border:1px solid var(--border-2);overflow:hidden;">\${me.pfp_data ? '<img src="' + me.pfp_data + '" style="width:100%;height:100%;object-fit:cover;" />' : (me.avatar || '🧑')}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="btn btn-ghost btn-sm" style="text-align:center;cursor:pointer;">Upload Photo<input type="file" accept="image/*" id="pfpFile" style="display:none;" onchange="handlePfpUpload(event)" /></label>
          \${me.pfp_data ? '<button class="btn btn-danger btn-sm" onclick="removePfp()">Remove Photo</button>' : ''}
        </div>
      </div>
      <div class="section-title">Or Pick an Avatar</div>
      <div class="avatar-grid" id="avatarGrid"></div>
      <div class="section-title">Display Name</div>
      <div class="field"><input id="pfName" value="\${esc(me.name)}" /></div>
      <div class="section-title">Your Call-From Number</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">The number you're actually dialing from. Only admins can see this, and it's blurred by default.</p>
      <div class="field"><input id="pfPhone" value="\${esc(me.call_phone || '')}" placeholder="e.g. +44 7911 123456" /></div>
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
    <div class="panel p fade-up" id="pushSection"></div>
    <div class="panel p fade-up"><button class="btn btn-danger btn-block" onclick="logout()">Log Out</button></div>
  \`;
  const grid = document.getElementById('avatarGrid');
  grid.innerHTML = AVATARS.map(a => '<div class="avatar-opt ' + (a === me.avatar && !me.pfp_data ? 'sel' : '') + '" data-av="' + a + '">' + a + '</div>').join('');
  grid.addEventListener('click', (e) => {
    const opt = e.target.closest('.avatar-opt'); if (!opt) return;
    grid.querySelectorAll('.avatar-opt').forEach(o => o.classList.remove('sel'));
    opt.classList.add('sel');
    document.getElementById('pfpPreview').innerHTML = opt.dataset.av;
    pendingRemovePfp = true;
  });
  renderPushSection();
}
let pendingRemovePfp = false;
let pendingPfpData = null;
function handlePfpUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const img = new Image();
  const reader = new FileReader();
  reader.onload = (e) => {
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      pendingPfpData = canvas.toDataURL('image/jpeg', 0.82);
      pendingRemovePfp = false;
      document.getElementById('pfpPreview').innerHTML = '<img src="' + pendingPfpData + '" style="width:100%;height:100%;object-fit:cover;" />';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
async function removePfp() {
  await api('/api/me/remove-pfp', { method: 'POST' });
  me.pfp_data = null; localStorage.setItem('dispatch_me', JSON.stringify(me));
  renderStaffProfile();
}
async function saveProfile() {
  const name = document.getElementById('pfName').value.trim();
  const call_phone = document.getElementById('pfPhone').value.trim();
  const avatarOpt = document.querySelector('.avatar-opt.sel');
  const body = { name, call_phone, avatar: avatarOpt ? avatarOpt.dataset.av : undefined };
  if (pendingPfpData) body.pfp_data = pendingPfpData;
  const res = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  me = { ...me, ...data.data }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  pendingPfpData = null;
  document.getElementById('profileStatus').textContent = 'Saved ✓'; document.getElementById('profileStatus').style.color = 'var(--success)';
}
async function saveNotifPrefs() {
  await api('/api/me/notif-prefs', { method: 'PATCH', body: JSON.stringify({ lead_assigned: document.getElementById('prefLead').checked, chat: document.getElementById('prefChat').checked, announcements: document.getElementById('prefAnn').checked }) });
  alert('Preferences saved');
}

// ---------- Real push notifications (arrive even with the app closed) ----------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
async function renderPushSection() {
  const section = document.getElementById('pushSection');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    section.innerHTML = '<div class="section-title" style="margin-top:0;">Push Notifications</div><p style="font-size:12.5px;color:var(--text-dim);">Not supported in this browser.</p>';
    return;
  }
  let isSubscribed = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    isSubscribed = !!sub;
  } catch {}
  section.innerHTML = \`
    <div class="section-title" style="margin-top:0;">Push Notifications</div>
    <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">Get a real notification on your phone the instant a lead drops — even with the app closed. On iPhone, add this to your Home Screen first (Share → Add to Home Screen) for it to work.</p>
    <button class="btn \${isSubscribed ? 'btn-danger' : 'btn-gold'} btn-block" id="pushToggleBtn" onclick="togglePush()">\${isSubscribed ? 'Turn Off Push Notifications' : 'Enable Push Notifications'}</button>
    <div id="pushStatus" style="font-size:12px;margin-top:10px;"></div>
  \`;
}
async function togglePush() {
  const status = document.getElementById('pushStatus');
  const btn = document.getElementById('pushToggleBtn');
  const reg = await navigator.serviceWorker.getRegistration() || await navigator.serviceWorker.register('/sw.js');
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    await existing.unsubscribe();
    await api('/api/push/unsubscribe', { method: 'POST' });
    renderPushSection();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    status.textContent = 'Notification permission was denied in your browser settings.';
    status.style.color = 'var(--danger)';
    return;
  }
  const keyRes = await api('/api/push/vapid-key');
  const { key } = (await keyRes.json()).data;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await api('/api/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription: sub.toJSON() }) });
  renderPushSection();
}
`;
