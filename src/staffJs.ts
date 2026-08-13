export const STAFF_JS = `
async function switchStaffTab(tab) {
  staffTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'queue' || tab === 'chat') clearNavBadge(tab);
  const body = document.getElementById('staffBody');
  stopQueuePolling();
  try {
    if (tab === 'home') await renderStaffHome();
    else if (tab === 'queue') { await renderStaffQueue(); startQueuePolling(); }
    else if (tab === 'chat') { body.innerHTML = '<div class="fade-up" id="staffChatWrap"></div>'; await renderChatInto(document.getElementById('staffChatWrap')); }
    else if (tab === 'board') await renderStaffBoard();
    else if (tab === 'scripts') await renderStaffScripts();
    else if (tab === 'profile') await renderStaffProfile();
    body.classList.remove('page-transition'); void body.offsetWidth; body.classList.add('page-transition');
  } catch (err) {
    console.error('Staff tab render failed:', tab, err);
    body.innerHTML = '<div class="panel p fade-up" style="text-align:center;"><div style="font-size:14px;margin-bottom:10px;">Something went wrong loading this.</div><div style="font-size:12px;color:var(--text-dim);margin-bottom:14px;">' + esc(String(err && err.message || err)) + '</div><button class="btn btn-gold" onclick="switchStaffTab(\\'' + tab + '\\')">Retry</button></div>';
  }
}
// Belt-and-suspenders alongside SSE: mobile browsers frequently suspend an
// EventSource connection silently (no error event fires) when backgrounded, which
// left callers staring at a stale queue - leads already taken by someone else never
// disappeared, and genuinely new leads never appeared. This polls independently of
// whatever state the SSE connection is actually in, so the queue self-heals within
// seconds regardless. Only runs while actually on the queue tab.
let queuePollInterval = null;
function startQueuePolling() {
  stopQueuePolling();
  // Never refresh while actively on a call - this exact bug used to tear down and
  // rebuild the whole active-call screen every 4 seconds, wiping typed notes and
  // losing focus. The poll is only for the "browsing available leads" view.
  queuePollInterval = setInterval(() => { if (staffTab === 'queue' && !onActiveCallScreen) smoothRerender(renderStaffQueue); }, 4000);
}
function stopQueuePolling() {
  if (queuePollInterval) { clearInterval(queuePollInterval); queuePollInterval = null; }
}
let onActiveCallScreen = false;

async function renderStaffHome() {
  const body = document.getElementById('staffBody');
  await loadCategoryCache();
  const [meRes, goalRes, annRes, lbRes, callLogRes, updateRes] = await Promise.all([
    api('/api/me'), api('/api/goal'), api('/api/announcements'),
    api('/api/leaderboard'), api('/api/caller/call-log'),
    api('/api/updates/active').catch(() => ({ json: async () => ({ data: [] }) })),
  ]);
  const fresh = (await meRes.json()).data; me = { ...me, ...fresh }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  const goal = (await goalRes.json()).data;
  const anns = (await annRes.json()).data;
  const lb = (await lbRes.json()).data;
  const callLog = (await callLogRes.json()).data;
  const updates = (await updateRes.json()).data || [];
  const myRank = (lb.findIndex(r => r.id === me.id) + 1) || '—';
  const myStat = lb.find(r => r.id === me.id) || { successful_calls: 0 };
  const li = levelInfo(me.xp);
  const rk = rankInfo(me.xp);
  const goalPct = Math.min(100, Math.round((goal.current / goal.target) * 100));
  const nextRankTier = RANK_TIERS.find(t => t[3] > li.level);
  const xpToNextRank = nextRankTier ? (() => {
    let x = 0, cost = 100;
    for (let l = 1; l < nextRankTier[3]; l++) { x += cost; cost = 100 + l * 60; }
    return Math.max(0, x - me.xp);
  })() : 0;

  // Active in-app updates (non-Telegram)
  const activeUpdate = updates.find(u => u.is_live) || updates[0] || null;
  const updateBanner = activeUpdate ? \`<div style="margin-bottom:14px;padding:12px 16px;border-radius:14px;background:\${activeUpdate.is_live ? 'linear-gradient(135deg,rgba(239,68,68,.15),rgba(220,38,38,.1))' : 'linear-gradient(135deg,rgba(124,92,255,.12),rgba(79,140,255,.08))'};border:1px solid \${activeUpdate.is_live ? 'rgba(239,68,68,.4)' : 'rgba(124,92,255,.3)'};display:flex;gap:10px;align-items:flex-start;">
    <span style="flex-shrink:0;font-size:16px;">\${activeUpdate.is_live ? '🔴' : '📣'}</span>
    <div style="flex:1;min-width:0;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:\${activeUpdate.is_live ? 'var(--danger)' : 'var(--violet-bright)'};margin-bottom:2px;">\${activeUpdate.is_live ? 'Live Update' : 'Update'}</div><div style="font-size:13px;font-weight:600;margin-bottom:2px;">\${esc(activeUpdate.title)}</div><div style="font-size:12px;color:var(--text-dim);line-height:1.4;">\${esc(activeUpdate.body)}</div></div>
  </div>\` : '';

  body.innerHTML = \`
    \${updateBanner}
    <div class="panel p fade-up" style="background:linear-gradient(135deg,rgba(124,92,255,.1),rgba(79,140,255,.04));border-color:rgba(124,92,255,.22);position:relative;overflow:hidden;">
      <div style="position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,\${rk.c1}22,transparent 70%);pointer-events:none;"></div>
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;position:relative;">
        \${avatarWithRankHtml(me, 58, rk)}
        <div style="flex:1;min-width:0;">
          <div class="disp" style="font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${esc(me.name)}</div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center;">
            \${statusBadge(me.role === 'manager' ? 'Manager' : me.role)}
            <span class="rank-chip" style="color:\${rk.c1};border-color:\${rk.c1}44;background:\${rk.c1}14;">\${rk.icon} \${rk.label}</span>
            <span class="lvl-chip">Lv \${li.level}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="disp" style="font-size:23px;font-weight:900;color:var(--violet-bright);line-height:1;">\${me.xp.toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-faint);font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-top:3px;">XP · #\${myRank}</div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px;display:flex;justify-content:space-between;position:relative;">
        <span>Level \${li.level} → \${li.level + 1}</span>
        <span class="mono">\${li.into} / \${li.need} XP\${nextRankTier ? ' · ' + xpToNextRank + ' to ' + nextRankTier[0] : ''}</span>
      </div>
      <div class="xp-bar" style="position:relative;"><i style="width:\${li.pct}%;"></i></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:4px;">
      <div class="stat-tile panel">
        <div class="icon-chip" style="background:rgba(34,197,94,.14);color:var(--success);">✓</div>
        <div class="num" data-count="\${myStat.successful_calls || 0}" style="color:var(--success);">0</div>
        <div class="lbl">Successful</div>
      </div>
      <div class="stat-tile panel">
        <div class="icon-chip" style="background:rgba(124,92,255,.14);color:var(--violet-bright);">\${ICONS.phone}</div>
        <div class="num" data-count="\${callLog.length}">0</div>
        <div class="lbl">Calls Today</div>
      </div>
      <div class="stat-tile panel">
        <div class="icon-chip" style="background:\${me.clocked_in ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.06)'};color:\${me.clocked_in ? 'var(--success)' : 'var(--text-faint)'};">\${me.clocked_in ? '●' : '○'}</div>
        <div class="num" style="color:\${me.clocked_in ? 'var(--success)' : 'var(--text-faint)'};font-size:19px;">\${me.clocked_in ? 'On' : 'Off'}</div>
        <div class="lbl">Shift</div>
      </div>
    </div>

    <div class="panel p fade-up" style="padding:16px 18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">
        <span style="font-size:11px;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;">🎯 \${esc(goal.label)}</span>
        <span class="mono" style="font-size:13px;font-weight:700;color:var(--gold-bright);">\${goal.current} / \${goal.target}</span>
      </div>
      <div class="xp-bar" style="height:8px;">
        <i style="width:\${goalPct}%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));"></i>
      </div>
      <div style="font-size:10.5px;color:var(--text-faint);margin-top:6px;text-align:right;">\${goalPct}% of team goal</div>
    </div>

    \${anns.length ? \`<div class="section-title">Announcements</div>\${anns.slice(0,3).map(a => \`<div class="announcement panel \${a.important ? 'important' : ''} fade-up" style="padding:14px 16px;margin-bottom:8px;"><div class="txt" style="font-size:13.5px;">\${esc(a.content)}</div><div class="meta" style="font-size:11px;margin-top:6px;">\${a.author_name || 'Admin'} · \${timeAgo(a.created_at)}</div></div>\`).join('')}\` : ''}

    <div class="section-title" style="display:flex;justify-content:space-between;align-items:baseline;">Recent Calls \${callLog.length > 5 ? '<span style="text-transform:none;letter-spacing:0;font-weight:600;font-size:12px;color:var(--gold-bright);cursor:pointer;" onclick="toggleCallLogExpanded()">Show all ' + callLog.length + '</span>' : ''}</div>
    <div class="panel p fade-up" style="padding:8px 16px;">
      <div id="callLogRows">\${callLog.length ? callLog.slice(0, 5).map(callLogRowHtml).join('') : '<div style="color:var(--text-dim);font-size:12.5px;padding:8px 0;">No calls logged yet today.</div>'}</div>
    </div>
  \`;
  animateCountUps(body);
  window._allCallLog = callLog;
  callLogExpanded = false;
}
function callLogRowHtml(e) {
  return \`<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
    \${avatarHtml({ name: e.caller_name, pfp_data: e.caller_pfp_data }, 28)}
    <div style="flex:1;min-width:0;font-size:12.5px;line-height:1.5;">
      <span style="font-weight:700;">\${esc(fullName({ first_name: e.first_name, last_name: e.last_name }))}</span>
      <span style="color:var(--text-dim);"> — called by </span>
      <span style="font-weight:600;">\${esc(e.caller_name || 'Unknown')}</span>
      <span style="color:var(--text-dim);"> at \${new Date(e.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
    </div>
    \${statusBadge(e.outcome)}
  </div>\`;
}
let callLogExpanded = false;
function toggleCallLogExpanded() {
  callLogExpanded = !callLogExpanded;
  const rows = document.getElementById('callLogRows');
  const toggle = document.getElementById('callLogToggle');
  if (!rows || !window._allCallLog) return;
  rows.innerHTML = (callLogExpanded ? window._allCallLog : window._allCallLog.slice(0, 6)).map(callLogRowHtml).join('');
  if (toggle) toggle.textContent = callLogExpanded ? 'Show less' : 'Show all ' + window._allCallLog.length;
}
async function renderStaffScripts() {
  const body = document.getElementById('staffBody');
  await loadCategoryCache();
  const scripts = (await api('/api/scripts').then(r => r.json())).data;
  window._allScripts = scripts;
  body.innerHTML = \`
    <div class="tab-hint"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg><span>Every script admin has approved, searchable anytime — not just mid-call. Got a line that lands? Send it in at the bottom and admin can approve it for the whole floor.</span></div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Script Library</div>
      <input id="scriptSearchInput" placeholder="Search scripts…" oninput="filterScriptManager()" style="margin-bottom:12px;" />
      <div id="scriptManagerList"></div>
    </div>
    <div class="section-title">Suggest a Script</div>
    <div class="panel p fade-up">
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;line-height:1.4;">Admin reviews it and can approve it for the whole team to see during calls.</p>
      <div class="field"><input id="scriptSuggestTitle" placeholder="Give it a short title" /></div>
      <div class="field"><textarea id="scriptSuggestContent" rows="3" placeholder="What do you actually say?"></textarea></div>
      <button class="btn btn-gold btn-block" onclick="suggestScript()">Send for Review</button>
      <div id="scriptSuggestStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>\`;
  renderScriptManagerList(scripts);
}
function renderScriptManagerList(scripts) {
  const list = document.getElementById('scriptManagerList');
  if (!list) return;
  list.innerHTML = scripts.length ? scripts.map((s, i) => \`<div class="script-manager-item" data-script-idx="\${i}" onclick="toggleScriptManagerItem(\${i})" style="padding:13px 14px;margin-bottom:8px;cursor:pointer;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
      <div style="display:flex;align-items:baseline;gap:8px;min-width:0;"><b style="font-size:13px;">\${esc(s.title)}</b>\${s.lead_type && s.lead_type !== 'general' ? categoryBadgeHtml(s.lead_type) : ''}</div>
      <span class="script-chevron" style="color:var(--text-faint);flex-shrink:0;transition:transform .2s ease;">▾</span>
    </div>
    <div class="script-manager-content" style="font-size:12.5px;color:var(--text-dim);white-space:pre-wrap;line-height:1.5;max-height:0;overflow:hidden;transition:max-height .25s ease, margin-top .25s ease;margin-top:0;">\${esc(s.content)}</div>
  </div>\`).join('') : '<div style="color:var(--text-dim);font-size:12.5px;">No approved scripts yet.</div>';
}
function toggleScriptManagerItem(i) {
  const item = document.querySelector('[data-script-idx="' + i + '"]');
  if (!item) return;
  const content = item.querySelector('.script-manager-content');
  const chevron = item.querySelector('.script-chevron');
  const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';
  if (isOpen) {
    content.style.maxHeight = '0px';
    content.style.marginTop = '0';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.marginTop = '10px';
    chevron.style.transform = 'rotate(180deg)';
  }
}
function filterScriptManager() {
  const q = document.getElementById('scriptSearchInput').value.trim().toLowerCase();
  const filtered = !q ? window._allScripts : window._allScripts.filter(s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
  renderScriptManagerList(filtered);
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
  await loadCategoryCache();
  if (me.role === 'caller') {
    const mineRes = await api('/api/caller/mine');
    const mine = (await mineRes.json()).data;
    if (mine) { onActiveCallScreen = true; return renderActiveCall(body, mine, 'caller'); }
    onActiveCallScreen = false;
    if (!me.clocked_in) {
      const centerRes = await api('/api/center-status');
      const center = (await centerRes.json()).data;
      window._centerClosed = !center.open;
      window._centerClosedReason = center.reason;
      body.innerHTML = offlineHtml();
      return;
    }
    const qRes = await api('/api/caller/queue');
    let rows = (await qRes.json()).data;
    rows = rows.filter(o => !skippedLeadIds.has(o.id) && !recentlyClaimedIds.has(o.id));
    if (!rows.length) { body.innerHTML = skippedLeadIds.size ? skippedOnlyHtml() : radarHtml(); return; }
    const freshCount = rows.filter(o => !(o.call_attempts || 0)).length;
    const retryCount = rows.length - freshCount;
    body.innerHTML = \`<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding:0 2px;">
      <div style="font-size:15px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;">\${rows.length} Waiting</div>
      <div style="font-size:11.5px;color:var(--text-dim);">\${freshCount} new\${retryCount ? ' · ' + retryCount + ' retry' : ''}</div>
    </div>\` + rows.map(o => offerCardHtml(o)).join('');
  } else if (me.role === 'finisher') {
    const qRes = await api('/api/finisher/queue');
    const rows = (await qRes.json()).data;
    const workingLead = workingFinisherLeadId ? rows.find(r => r.id === workingFinisherLeadId) : null;
    if (workingLead) return renderActiveCall(body, workingLead, 'finisher');
    body.innerHTML = rows.length ? \`<div class="section-title" style="margin-top:0;">Assigned to You (\${rows.length})</div>\` + rows.map(o => finisherCardHtml(o)).join('') : \`<div class="empty-state panel fade-up">\${ICONS.flag}<div style="font-weight:700;margin:8px 0 4px;">No leads waiting</div><div style="font-size:12.5px;">Admin will assign leads here when ready.</div></div>\`;
  }
}
function offlineHtml() {
  if (window._centerClosed) {
    return \`<div class="empty-state panel fade-up"><div class="ic" style="width:32px;height:32px;margin:0 auto 14px;color:var(--danger);"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg></div><div style="font-weight:700;margin-bottom:4px;">Call Center Closed</div><div style="font-size:13px;">\${esc(window._centerClosedReason || 'Check back soon.')}</div></div>\`;
  }
  return \`<div class="empty-state panel fade-up"><div class="ic" style="width:32px;height:32px;margin:0 auto 14px;color:var(--text-faint);"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></div><div style="font-weight:700;margin-bottom:4px;">You're offline</div><div style="font-size:13px;">Clock in from the top bar to start receiving leads</div></div>\`;
}
function skippedOnlyHtml() { return \`<div class="empty-state panel fade-up"><div class="ic" style="width:32px;height:32px;margin:0 auto 14px;color:var(--text-faint);"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke="currentColor"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></div><div style="font-weight:700;margin-bottom:4px;">Nothing left to show</div><div style="font-size:13px;margin-bottom:14px;">Every waiting lead is skipped for this session.</div><button class="btn btn-gold btn-sm" onclick="unskipAll()">Show skipped leads again</button></div>\`; }
let skippedLeadIds = new Set();
function skipLead(id) { skippedLeadIds.add(id); renderStaffQueue(); }
function unskipAll() { skippedLeadIds.clear(); renderStaffQueue(); }
function radarHtml() { return \`<div class="radar-zone panel fade-up"><div class="radar"><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-ring"></div><div class="radar-sweep"></div><div class="radar-core"></div></div><div class="waiting-title">Listening for leads</div><div class="waiting-sub">You'll be notified the instant one comes in</div></div>\`; }
function offerCardHtml(o) {
  const isRetry = (o.call_attempts || 0) > 0;
  const labelText = isRetry ? 'Retry — Attempt #' + (o.call_attempts + 1) : 'New Lead';
  const labelColor = isRetry ? 'var(--gold-bright)' : 'var(--success)';
  return \`<div class="offer-card fade-up" data-lead-id="\${o.id}">
    <div class="pulse-dot" style="background:\${labelColor};"></div>
    <div class="offer-label" style="color:\${labelColor};">\${labelText} <span style="color:var(--text-faint);font-weight:600;">· \${timeAgo(o.created_at)}</span></div>
    <div class="offer-name" style="font-size:23px;">\${fullName(o)}</div>
    <div class="call-lead-sub" style="margin:4px 0 16px;"><span class="mono">\${o.phone}</span>\${categoryBadgeHtml(o.lead_type)}\${o.source ? '<span class="badge not_called">' + esc(o.source) + '</span>' : ''}</div>
    \${isRetry ? '<div style="font-size:11.5px;color:var(--text-faint);margin:-8px 0 14px;">Nobody\\'s reached them yet — no answer/voicemail last time, not a mistake.</div>' : ''}
    <div class="offer-actions"><button class="btn btn-gold" onclick="claimLead(\${o.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:15px;height:15px;vertical-align:-2px;margin-right:5px;"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>Take Call</button><button class="btn btn-ghost" onclick="skipLead(\${o.id})">Skip</button></div>
  </div>\`;
}
function finisherCardHtml(o) {
  return \`<div class="offer-card fade-up" style="border-color:rgba(63,168,154,.4);"><div class="offer-label" style="color:var(--teal);">Ready to Finish</div><div class="offer-name">\${fullName(o)} \${categoryBadgeHtml(o.lead_type)}</div><div class="offer-meta mono">\${o.phone}</div>\${o.notes ? '<div style="font-size:12.5px;color:var(--text-dim);margin-bottom:12px;">' + esc(o.notes) + '</div>' : ''}
    <button class="btn btn-teal btn-block" onclick="startFinishingCall(\${o.id})">Begin Working This Lead</button></div>\`;
}
let workingFinisherLeadId = null;
function startFinishingCall(id) { workingFinisherLeadId = id; renderStaffQueue(); }

async function claimLead(id) {
  const card = document.querySelector('[data-lead-id="' + id + '"]');
  if (card) card.style.opacity = '.5'; // instant feedback before the network even responds
  recentlyClaimedIds.add(id);
  setTimeout(() => recentlyClaimedIds.delete(id), 15000);
  const res = await api('/api/caller/leads/' + id + '/claim', { method: 'POST' });
  const data = await res.json();
  if (res.status === 409) { recentlyClaimedIds.delete(id); if (card) card.style.opacity = '.4'; renderStaffQueue(); return; }
  if (data.claimed && data.data) {
    // Already have the claimed lead's data from the claim response itself — jump
    // straight to the active call screen instead of a redundant re-fetch.
    onActiveCallScreen = true;
    renderActiveCall(document.getElementById('staffBody'), data.data, me.role);
  } else {
    renderStaffQueue();
  }
}

async function renderActiveCall(body, lead, role) {
  let scripts = [];
  let template = '';
  // Show the call screen immediately with what we already have (name/phone/status),
  // then fill in scripts/template as soon as they land — no need to block the whole
  // screen on two more round trips the caller doesn't need to see instantly.
  renderActiveCallShell(body, lead, role, scripts, template);
  const [scriptsResult, templateResult] = await Promise.allSettled([
    api('/api/scripts?type=' + encodeURIComponent(lead.lead_type || 'general')).then(r => r.json()),
    api('/api/call-template').then(r => r.json()),
  ]);
  if (scriptsResult.status === 'fulfilled') scripts = scriptsResult.value.data || [];
  if (templateResult.status === 'fulfilled') template = templateResult.value.data?.template || '';
  if (scripts.length || template) renderActiveCallShell(body, lead, role, scripts, template);
}

function renderActiveCallShell(body, lead, role, scripts, template) {
  const isFinisher = role === 'finisher';
  const statusColor = lead.status === 'active_call' ? 'var(--success)' : 'var(--violet-bright)';
  const isOnCall = lead.status === 'active_call';

  body.innerHTML = \`
    \${template && !isFinisher ? \`<div class="panel p fade-up" style="border-color:rgba(79,140,255,.25);background:rgba(79,140,255,.05);padding:16px 18px;margin-bottom:12px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:8px;">Call Guide</div>
      <div style="font-size:13px;line-height:1.75;white-space:pre-wrap;color:var(--text);">\${esc(template)}</div>
    </div>\` : ''}

    <div class="panel call-card fade-up" style="padding:20px;border-color:\${statusColor}33;background:linear-gradient(160deg,rgba(18,18,26,.9),rgba(12,12,18,.95));position:relative;overflow:hidden;">
      <div style="position:absolute;top:-50px;left:-30px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,\${statusColor}18,transparent 70%);pointer-events:none;"></div>

      <!-- Status bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;background:\${statusColor}18;border:1px solid \${statusColor}44;font-size:11px;font-weight:700;color:\${statusColor};">
            \${isOnCall ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 6px var(--success);display:inline-block;"></span> On Call' : '📞 Calling'}
          </span>
          \${(lead.call_attempts||0) > 1 ? '<span style="font-size:10px;color:var(--text-faint);background:rgba(255,255,255,.06);padding:3px 8px;border-radius:100px;">Attempt ' + lead.call_attempts + '</span>' : ''}
        </div>
        <span class="call-timer-chip mono" style="font-size:13px;font-weight:700;"><span class="tdot"></span><span id="callTimer">00:00</span></span>
      </div>

      <!-- Lead info -->
      <div style="margin-bottom:20px;">
        <div class="call-lead-name" style="font-size:26px;margin-bottom:4px;">\${fullName(lead)}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span class="mono" style="font-size:13px;color:var(--text-dim);">\${lead.phone}</span>
          \${categoryBadgeHtml(lead.lead_type)}
        </div>
        \${lead.email ? '<div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;">✉ ' + esc(lead.email) + '</div>' : ''}
        \${lead.address ? '<div style="font-size:12.5px;color:var(--text-dim);margin-top:3px;">📍 ' + esc(lead.address) + '</div>' : ''}
        \${lead.notes ? '<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);font-size:12.5px;color:var(--text-dim);line-height:1.5;white-space:pre-wrap;">' + esc(lead.notes) + '</div>' : ''}
      </div>

      \${!isFinisher ? \`
      <!-- Action buttons -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
        <a class="dial-btn" href="tel:\${lead.phone}" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border-radius:14px;background:linear-gradient(135deg,var(--violet),rgba(124,92,255,.7));color:#fff;font-weight:700;font-size:15px;text-decoration:none;">
          \${ICONS.phone} Dial
        </a>
        \${!isOnCall
          ? '<button class="oncall-btn" onclick="connectCall(' + lead.id + ')" style="padding:16px;border-radius:14px;background:linear-gradient(135deg,var(--success),rgba(34,197,94,.7));color:#fff;font-weight:700;font-size:15px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;"><span style=\\"font-size:18px;\\">✓</span>Mark On Call</button>'
          : '<button class="endcall-btn" onclick="endCall(' + lead.id + ')" style="padding:16px;border-radius:14px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:var(--danger);font-weight:700;font-size:14px;cursor:pointer;">End Call</button>'
        }
      </div>

      \${!isOnCall ? \`
      <!-- Pre-call: muted soft-connect hint + no-connect outcomes -->
      <div style="padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border);margin-bottom:14px;text-align:center;">
        <div style="font-size:11.5px;color:var(--text-faint);line-height:1.5;">Dial, then tap <b style="color:var(--text);">Mark On Call</b> the moment they answer — that unlocks outcome buttons below.</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'voicemail')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">📬 Voicemail</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'no_answer')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">🔇 No Answer</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'busy')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">📵 Unavailable</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'cancelled')" style="padding:12px;border-radius:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;">✕ Cancel</button>
      </div>
      \` : \`
      <!-- On call: outcome buttons -->
      <div style="margin-bottom:14px;">
        <button onclick="recordOutcome(\${lead.id},'successful_call')" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,197,94,.12));border:1px solid rgba(34,197,94,.4);color:var(--success);font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;">
          ✓ Successful Call
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <button onclick="recordOutcome(\${lead.id},'callback_requested')" style="padding:12px;border-radius:12px;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.3);color:#fbbf24;font-size:13px;font-weight:600;cursor:pointer;">📅 Callback</button>
          <button onclick="recordOutcome(\${lead.id},'hung_up')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">📵 Hung Up</button>
          <button onclick="recordOutcome(\${lead.id},'requires_review')" style="padding:12px;border-radius:12px;background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.25);color:var(--gold-bright);font-size:13px;font-weight:600;cursor:pointer;">🔍 Review</button>
          <button onclick="recordOutcome(\${lead.id},'failed')" style="padding:12px;border-radius:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;">✕ Unsuccessful</button>
        </div>
        <button onclick="recordOutcome(\${lead.id},'chopped_previously')" style="width:100%;padding:10px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--text-faint);font-size:12.5px;font-weight:600;cursor:pointer;">Already worked</button>
      </div>

      <!-- Live note -->
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.03);border:1px solid var(--border);">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-dim);margin-bottom:8px;">Quick Note for Admin</div>
        <div style="display:flex;gap:8px;align-items:flex-end;">
          <textarea id="liveNoteInput" placeholder="Callback Fri 2pm · keen but needs spouse · any flag worth mentioning…" style="flex:1;min-height:56px;max-height:120px;resize:vertical;font-size:12.5px;line-height:1.5;background:var(--s2);border:1px solid var(--border-2);border-radius:10px;padding:9px 11px;color:var(--text);font-family:inherit;" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();pushLiveNote(\${lead.id});}"></textarea>
          <button onclick="pushLiveNote(\${lead.id})" style="padding:10px 14px;border-radius:10px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;font-weight:700;font-size:13px;border:none;cursor:pointer;flex-shrink:0;">Send</button>
        </div>
        <div id="noteConfirm" style="font-size:11px;color:var(--success);margin-top:5px;height:14px;"></div>
      </div>
      \`}
      \` : \`
      <!-- Finisher actions -->
      <div style="display:grid;gap:10px;margin-bottom:14px;">
        <a class="dial-btn" href="tel:\${lead.phone}" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border-radius:14px;background:linear-gradient(135deg,var(--violet),rgba(124,92,255,.7));color:#fff;font-weight:700;font-size:15px;text-decoration:none;">\${ICONS.phone} Dial \${lead.phone}</a>
        <button onclick="finisherOutcome(\${lead.id},'completed')" style="padding:16px;border-radius:14px;background:linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,197,94,.12));border:1px solid rgba(34,197,94,.4);color:var(--success);font-size:16px;font-weight:800;cursor:pointer;">✓ Mark Completed</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <button onclick="finisherOutcome(\${lead.id},'requires_review')" style="padding:12px;border-radius:12px;background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.25);color:var(--gold-bright);font-size:13px;font-weight:600;cursor:pointer;">Review</button>
          <button onclick="finisherOutcome(\${lead.id},'failed')" style="padding:12px;border-radius:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;">Unsuccessful</button>
        </div>
      </div>
      \`}

      \${scripts.length ? \`<div class="scripts-toggle" data-toggle-next="1" style="cursor:pointer;padding:10px 0;display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);margin-top:6px;"><span style="font-size:12px;font-weight:700;color:var(--text-dim);">Scripts (\${scripts.length})</span><span style="color:var(--text-faint);">▾</span></div><div class="scripts-panel" style="margin-top:0;">\${scripts.map(s => '<div class="script-item"><div class="title">' + esc(s.title) + '</div><div class="content">' + esc(s.content) + '</div></div>').join('')}</div>\` : ''}
    </div>
  \`;
  if (!callStart) callStart = Date.now();
  startCallTimer();
}
// The browser has no way to actually detect a real phone call connecting - there's
// no web API for that. So this stays a manual "Mark On Call" tap, but the flow
// enforces it properly: before that tap, only outcomes consistent with "the call
// never actually connected" are available. Nobody can accidentally log a lead as a
// successful call (or any other post-conversation outcome) before they've genuinely
// marked themselves as picked-up and connected.
function renderOutcomeSection(lead) {
  if (lead.status === 'calling') {
    return \`<div class="outcome-section">
      <p style="font-size:11.5px;color:var(--text-faint);text-align:center;margin:2px 0 2px;">Tap "Mark On Call" above the moment they pick up — that unlocks the rest.</p>
      <div class="outcome-grid" style="grid-template-columns:1fr 1fr;">
        <button onclick="recordOutcome(\${lead.id},'voicemail')">Voicemail</button>
        <button onclick="recordOutcome(\${lead.id},'no_answer')">No Answer</button>
        <button onclick="recordOutcome(\${lead.id},'busy')">Number Unavailable</button>
        <button onclick="recordOutcome(\${lead.id},'cancelled')">Cancel</button>
      </div>
    </div>\`;
  }
  return \`<div class="outcome-section">
    <button class="win-btn" onclick="recordOutcome(\${lead.id},'successful_call')">\${ICONS.check || ''} Successful Call</button>
    <div class="outcome-grid">
      <button onclick="recordOutcome(\${lead.id},'hung_up')">Hung Up</button>
      <button onclick="recordOutcome(\${lead.id},'chopped_previously')">Chopped Previously</button>
      <button onclick="recordOutcome(\${lead.id},'cancelled')">Cancel</button>
    </div>
    <button class="review-btn" onclick="recordOutcome(\${lead.id},'callback_requested')">Callback Requested</button>
    <div class="outcome-grid" style="grid-template-columns:1fr 1fr;">
      <button class="fail-btn" onclick="recordOutcome(\${lead.id},'failed')">Unsuccessful</button>
      <button class="review-btn" onclick="recordOutcome(\${lead.id},'requires_review')">Requires Review</button>
    </div>
  </div>\`;
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
  const tick = () => {
    const el = document.getElementById('callTimer'); if (!el) return;
    const s = Math.floor((Date.now() - callStart) / 1000);
    el.textContent = String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
  };
  tick();
  callTimerInterval = setInterval(tick, 1000);
}
async function connectCall(id) { await api('/api/caller/leads/' + id + '/connect', { method: 'POST' }); renderStaffQueue(); }
async function endCall(id) { await api('/api/caller/leads/' + id + '/end-call', { method: 'POST' }); renderStaffQueue(); }
// After XP lands, roll me.xp forward locally and fire the rank-up moment if the
// tier changed — the emblem animation only shows on a genuine promotion.
function applyXpEarned(amount, label) {
  if (!amount) return;
  const before = rankInfo(me.xp);
  me.xp = (me.xp || 0) + amount;
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  const after = rankInfo(me.xp);
  xpToast(amount, label);
  if (after.tier !== before.tier || after.div !== before.div) setTimeout(() => showRankUp(after), 700);
}
async function recordOutcome(id, outcome) {
  const res = await api('/api/caller/leads/' + id + '/outcome', { method: 'POST', body: JSON.stringify({ outcome, duration: callStart ? Math.floor((Date.now()-callStart)/1000) : 0 }) });
  const data = await res.json().catch(() => ({}));
  callStart = null; clearInterval(callTimerInterval);
  if (outcome === 'successful_call') celebrateSuccessfulCall();
  renderStaffQueue();
  applyXpEarned(data.xp_awarded, titleCase(outcome));
}
async function finisherOutcome(id, outcome) {
  const res = await api('/api/finisher/leads/' + id + '/outcome', { method: 'POST', body: JSON.stringify({ outcome }) });
  const data = await res.json().catch(() => ({}));
  callStart = null; clearInterval(callTimerInterval); workingFinisherLeadId = null;
  if (outcome === 'completed') celebrateSuccessfulCall();
  renderStaffQueue();
  applyXpEarned(data.xp_awarded, titleCase(outcome));
}

let lbMode = 'week';
async function renderStaffBoard() {
  const body = document.getElementById('staffBody');
  const res = await api('/api/leaderboard');
  const rows = (await res.json()).data;
  body.innerHTML = \`
    <div style="display:flex;justify-content:center;margin-bottom:14px;">
      <div class="seg-tabs">
        <button class="seg-tab \${lbMode==='week'?'on':''}" onclick="lbMode='week';renderStaffBoard()">This Week</button>
        <button class="seg-tab \${lbMode==='all'?'on':''}" onclick="lbMode='all';renderStaffBoard()">All Time</button>
      </div>
    </div>
    \${lbBoardHtml(rows, lbMode)}
    \${xpGuideHtml()}\`;
  animateCountUps(body);
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
        <div id="pfpPreview">\${avatarHtml(me, 64)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="btn btn-ghost btn-sm" style="text-align:center;cursor:pointer;">Upload Photo<input type="file" accept="image/*" id="pfpFile" style="display:none;" onchange="handlePfpUpload(event)" /></label>
          \${me.pfp_data ? '<button class="btn btn-danger btn-sm" onclick="removePfp()">Remove Photo</button>' : ''}
        </div>
      </div>
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
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Lead assignments</span><input type="checkbox" class="toggle-switch" id="prefLead" checked /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Chat messages</span><input type="checkbox" class="toggle-switch" id="prefChat" checked /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Announcements</span><input type="checkbox" class="toggle-switch" id="prefAnn" checked /></label>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="saveNotifPrefs()">Save Preferences</button>
    </div>
    <div class="panel p fade-up" id="pushSection"></div>
    <div class="panel p fade-up"><button class="btn btn-danger btn-block" onclick="logout()">Log Out</button></div>
  \`;
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
      document.getElementById('pfpPreview').innerHTML = '<img src="' + pendingPfpData + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" />';
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
  const body = { name, call_phone };
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
