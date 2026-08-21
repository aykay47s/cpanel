export const STAFF_JS = `
async function switchStaffTab(tab) {
  // A caller holding a claimed lead must log an outcome before navigating away —
  // otherwise the lead sits assigned to them with no record of what happened, and
  // the next person can't tell it was ever worked. The lead screen itself is the
  // only place an outcome can be given, so leaving it is what we block.
  if (onActiveCallScreen && staffTab === 'queue' && tab !== 'queue') {
    if (typeof toast === 'function') toast('Log an outcome for this lead before moving on');
    else alert('Log an outcome for this lead before moving on.');
    // Re-assert the active tab in the nav so the UI doesn't look half-switched.
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === staffTab));
    return;
  }
  staffTab = tab;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'queue' || tab === 'chat') clearNavBadge(tab);
  const body = document.getElementById('staffBody');
  stopQueuePolling();
  try {
    if (tab === 'home') await renderStaffHome();
    else if (tab === 'queue') { await renderStaffQueue(); startQueuePolling(); }
    else if (tab === 'chat') { body.innerHTML = '<div class="fade-up"><div class="chat-mode-toggle"><button class="cmt-btn active" id="cmtTeam" data-mode="team" onclick="switchChatModeEv(this)">Team</button><button class="cmt-btn" id="cmtDM" data-mode="dm" onclick="switchChatModeEv(this)">Direct</button></div><div id="staffChatWrap"></div><div id="staffDMWrap" class="hidden"></div></div>'; await renderChatInto(document.getElementById('staffChatWrap')); }
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
  // SSE (new_lead / lead_claimed) is the real-time path for the queue; this
  // interval is only a safety net for when the stream is briefly down. It used
  // to fire every 4s, re-fetching and rebuilding the whole queue on top of the
  // live events — pure redundant work. 15s keeps the fallback without the churn.
  queuePollInterval = setInterval(() => { if (staffTab === 'queue' && !onActiveCallScreen) smoothRerender(renderStaffQueue); }, 15000);
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
    <span style="flex-shrink:0;width:18px;height:18px;color:\${activeUpdate.is_live ? 'var(--danger)' : 'var(--violet-bright)'};display:inline-flex;">\${activeUpdate.is_live ? (ICONS.dot || '') : (ICONS.megaphone || '')}</span>
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
            \${rankChipHtml(rk)}
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
        <div class="icon-chip" style="background:rgba(34,197,94,.14);color:var(--success);">\${ICONS.check || ''}</div>
        <div class="num" data-count="\${myStat.successful_calls || 0}" style="color:var(--success);">0</div>
        <div class="lbl">Successful</div>
      </div>
      <div class="stat-tile panel">
        <div class="icon-chip" style="background:rgba(124,92,255,.14);color:var(--violet-bright);">\${ICONS.phone}</div>
        <div class="num" data-count="\${callLog.length}">0</div>
        <div class="lbl">Calls Today</div>
      </div>
      <div class="stat-tile panel">
        <div class="icon-chip" style="background:\${me.clocked_in ? 'rgba(34,197,94,.14)' : 'rgba(255,255,255,.06)'};color:\${me.clocked_in ? 'var(--success)' : 'var(--text-faint)'};">\${ICONS.dot || ''}</div>
        <div class="num" style="color:\${me.clocked_in ? 'var(--success)' : 'var(--text-faint)'};font-size:19px;">\${me.clocked_in ? 'On' : 'Off'}</div>
        <div class="lbl">Shift</div>
      </div>
    </div>

    <div class="panel p fade-up" style="padding:16px 18px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px;">
        <span style="font-size:11px;color:var(--text-dim);font-weight:700;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;gap:6px;"><span style="width:14px;height:14px;display:inline-flex;color:var(--gold-bright);">\${ICONS.target || ''}</span> \${esc(goal.label)}</span>
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
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
        <div class="section-title" style="margin:0;">Script Library</div>
        <span style="font-size:11px;color:var(--text-faint);font-weight:600;">\${scripts.length} approved</span>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;" id="staffScriptFilters">
        <button class="chip-filter active" data-aud="all" onclick="filterStaffScripts('all', this)">All</button>
        <button class="chip-filter" data-aud="opener" onclick="filterStaffScripts('opener', this)">Openers</button>
        <button class="chip-filter" data-aud="closer" onclick="filterStaffScripts('closer', this)">Finishers</button>
      </div>
      <input id="scriptSearchInput" placeholder="Search scripts…" oninput="filterScriptManager()" style="margin-bottom:12px;" />
      <div id="scriptManagerList"></div>
    </div>
    <div class="section-title">Suggest a Script</div>
    <div class="panel p fade-up">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div class="icon-chip" style="background:rgba(251,191,36,.14);color:#fbbf24;flex-shrink:0;">\${ICONS.doc || ''}</div>
        <p style="font-size:11.5px;color:var(--text-dim);line-height:1.4;margin:0;">Admin reviews it and can approve it for the whole team to see during calls.</p>
      </div>
      <div class="field"><input id="scriptSuggestTitle" placeholder="Give it a short title" /></div>
      <div class="field"><textarea id="scriptSuggestContent" rows="3" placeholder="What do you actually say?"></textarea></div>
      <button class="btn btn-gold btn-block" onclick="suggestScript()">Send for Review</button>
      <div id="scriptSuggestStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>\`;
  renderScriptManagerList(scripts);
}
let _staffScriptFilter = 'all';
function filterStaffScripts(aud, btn) {
  _staffScriptFilter = aud;
  document.querySelectorAll('#staffScriptFilters .chip-filter').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  filterScriptManager();
}
const SCRIPT_ICONS = ['💬','🎯','💡','🔑','📋','✨'];
function scriptIconFor(idx) { return SCRIPT_ICONS[idx % SCRIPT_ICONS.length]; }
function renderScriptManagerList(scripts) {
  const list = document.getElementById('scriptManagerList');
  if (!list) return;
  const audBadge = (aud) => aud === 'opener' ? '<span class="badge in-progress" style="font-size:9px;">Opener</span>' : aud === 'closer' ? '<span class="badge successful_call" style="font-size:9px;">Closer</span>' : '';
  list.innerHTML = scripts.length ? scripts.map((s, i) => \`<div class="script-manager-item" data-script-idx="\${i}" onclick="toggleScriptManagerItem(\${i})" style="padding:13px 14px;margin-bottom:8px;cursor:pointer;">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <div class="icon-chip" style="width:26px;height:26px;background:rgba(124,92,255,.12);color:var(--violet-bright);flex-shrink:0;">\${ICONS.doc || ''}</div>
        <div style="display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;flex-wrap:wrap;"><b style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">\${esc(s.title)}</b>\${audBadge(s.audience)}\${s.lead_type && s.lead_type !== 'general' ? categoryBadgeHtml(s.lead_type) : ''}</div>
      </div>
      <span class="script-chevron" style="color:var(--text-faint);flex-shrink:0;transition:transform .2s ease;">▾</span>
    </div>
    \${s.description ? '<div style="font-size:11px;color:var(--text-faint);margin-top:5px;padding-left:36px;line-height:1.4;">' + esc(s.description) + '</div>' : ''}
    <div class="script-manager-content" style="font-size:12.5px;color:var(--text-dim);white-space:pre-wrap;line-height:1.5;max-height:0;overflow:hidden;transition:max-height .25s ease, margin-top .25s ease;margin-top:0;padding-left:36px;">\${esc(s.content)}</div>
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
  let filtered = window._allScripts || [];
  if (_staffScriptFilter !== 'all') filtered = filtered.filter(s => (s.audience || 'all') === _staffScriptFilter || (s.audience || 'all') === 'all');
  if (q) filtered = filtered.filter(s => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q));
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
    const cbRes = await api('/api/caller/callbacks');
    let rows = (await qRes.json()).data;
    const callbacks = (await cbRes.json()).data || [];
    rows = rows.filter(o => !skippedLeadIds.has(o.id) && !recentlyClaimedIds.has(o.id));
    if (!rows.length && !callbacks.length) { body.innerHTML = skippedLeadIds.size ? skippedOnlyHtml() : radarHtml(); return; }
    const freshCount = rows.filter(o => !(o.call_attempts || 0)).length;
    const retryCount = rows.length - freshCount;
    const cbStrip = callbacks.length ? \`<div style="margin-bottom:14px;padding:12px 14px;border-radius:14px;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.3);">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fbbf24;margin-bottom:10px;">\${iconInline(ICONS.calendar)} Due Callbacks (\${callbacks.length})</div>
      \${callbacks.map(l => \`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);">
        <div style="min-width:0;"><div style="font-weight:600;font-size:13.5px;">\${esc(fullName(l))}</div><div class="mono" style="font-size:11.5px;color:var(--text-dim);">\${l.phone} · \${new Date(l.callback_at).toLocaleString('en-GB',{dateStyle:'short',timeStyle:'short'})}</div></div>
        <button class="btn btn-gold btn-sm" onclick="claimLead(\${l.id})" style="flex-shrink:0;margin-left:10px;">Call Now</button>
      </div>\`).join('')}
    </div>\` : '';
    body.innerHTML = \`<div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;padding:0 2px;">
      <div style="font-size:15px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;">\${rows.length} Waiting</div>
      <div style="font-size:11.5px;color:var(--text-dim);">\${freshCount} new\${retryCount ? ' · ' + retryCount + ' retry' : ''}</div>
    </div>\` + cbStrip + rows.map(o => offerCardHtml(o)).join('');
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
  const attempts = o.call_attempts || 0;
  const isRetry = attempts > 0;
  // call_attempts is now the real completed-outcome count (no longer double-counted
  // from the claim step too). MAX_ATTEMPTS is 3 — cap is server-enforced so if this
  // card is showing, it has fewer than 3 genuine attempts behind it.
  const labelText = isRetry ? 'Called ' + attempts + ' time' + (attempts === 1 ? '' : 's') + ' — no success yet' : 'New Lead';
  const labelColor = isRetry ? 'var(--gold-bright)' : 'var(--success)';
  return \`<div class="offer-card fade-up" data-lead-id="\${o.id}">
    <div class="pulse-dot" style="background:\${labelColor};"></div>
    <div class="offer-label" style="color:\${labelColor};">\${labelText} <span style="color:var(--text-faint);font-weight:600;">· \${timeAgo(o.created_at)}</span></div>
    <div class="offer-name" style="font-size:23px;">\${fullName(o)}</div>
    <div class="call-lead-sub" style="margin:4px 0 16px;"><span class="mono">\${o.phone}</span>\${categoryBadgeHtml(o.lead_type)}\${o.source ? '<span class="badge not_called">' + esc(o.source) + '</span>' : ''}</div>
    \${isRetry ? '<div style="font-size:11.5px;color:var(--text-faint);margin:-8px 0 14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' + (o.outcome ? '<span>Last attempt:</span>' + statusBadge(o.outcome) : '<span>Has been attempted but no outcome logged.</span>') + '</div>' : ''}
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
            \${isOnCall ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 6px var(--success);display:inline-block;"></span> On Call' : iconInline(ICONS.phone) + ' Calling'}
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
        \${lead.email ? '<div style="font-size:12.5px;color:var(--text-dim);margin-top:6px;">' + iconInline(ICONS.mail) + ' ' + esc(lead.email) + '</div>' : ''}
        \${lead.address ? '<div style="font-size:12.5px;color:var(--text-dim);margin-top:3px;">' + iconInline(ICONS.pin) + ' ' + esc(lead.address) + '</div>' : ''}
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
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'voicemail')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.mailbox)} Voicemail</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'no_answer')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.mute)} No Answer</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'busy')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.phoneOff)} Unavailable</button>
        <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'cancelled')" style="padding:12px;border-radius:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;">✕ Cancel</button>
      </div>
      <button class="outcome-btn" onclick="recordOutcome(\${lead.id},'number_not_recognised')" style="width:100%;padding:11px;border-radius:12px;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);color:#f5b942;font-size:12.5px;font-weight:600;cursor:pointer;margin-bottom:8px;">\${iconInline(ICONS.warn)} Number Not Recognised</button>
      \` : \`
      <!-- On call: outcome buttons -->
      <div style="margin-bottom:14px;">
        <button onclick="recordOutcome(\${lead.id},'successful_call')" style="width:100%;padding:16px;border-radius:14px;background:linear-gradient(135deg,rgba(34,197,94,.2),rgba(34,197,94,.12));border:1px solid rgba(34,197,94,.4);color:var(--success);font-size:16px;font-weight:800;cursor:pointer;margin-bottom:10px;display:flex;align-items:center;justify-content:center;gap:8px;">
          ✓ Successful Call
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
          <button onclick="recordOutcome(\${lead.id},'callback_requested')" style="padding:12px;border-radius:12px;background:rgba(250,204,21,.08);border:1px solid rgba(250,204,21,.3);color:#fbbf24;font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.calendar)} Callback</button>
          <button onclick="recordOutcome(\${lead.id},'hung_up')" style="padding:12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid var(--border);color:var(--text-dim);font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.phoneOff)} Hung Up</button>
          <button onclick="recordOutcome(\${lead.id},'requires_review')" style="padding:12px;border-radius:12px;background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.25);color:var(--gold-bright);font-size:13px;font-weight:600;cursor:pointer;">\${iconInline(ICONS.search)} Review</button>
          <button onclick="recordOutcome(\${lead.id},'failed')" style="padding:12px;border-radius:12px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:var(--danger);font-size:13px;font-weight:600;cursor:pointer;">✕ Unsuccessful</button>
        </div>
        <button onclick="recordOutcome(\${lead.id},'chopped_previously')" style="width:100%;padding:10px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid var(--border);color:var(--text-faint);font-size:12.5px;font-weight:600;cursor:pointer;">Already worked</button>
      </div>
      <!-- Callback scheduler: lets caller record a specific date/time instead of
           just hitting "callback" and losing when they promised to ring back. -->
      <div style="padding:12px 14px;border-radius:14px;background:rgba(250,204,21,.05);border:1px solid rgba(250,204,21,.18);margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#fbbf24;margin-bottom:8px;">\${iconInline(ICONS.calendar)} Schedule Callback</div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input type="datetime-local" id="cbDate_\${lead.id}" style="flex:1;min-width:0;font-size:13px;" />
          <button onclick="scheduleCallback(\${lead.id})" class="btn btn-ghost btn-sm" style="flex-shrink:0;color:#fbbf24;border-color:rgba(250,204,21,.3);">Book it</button>
        </div>
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
      <!-- Everything the starter logged on the first call, so the finisher walks
           in knowing the story instead of cold. Loaded after render. -->
      <div style="padding:14px;border-radius:14px;background:rgba(63,168,154,.06);border:1px solid rgba(63,168,154,.25);margin-bottom:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#5fd3c0;margin-bottom:4px;">Notes from the starter</div>
        <div id="finisherNotes_\${lead.id}"><div style="font-size:12px;color:var(--text-faint);padding:4px 0;">Loading notes…</div></div>
      </div>
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
  // Populate the starter's note history on the finisher screen (fire-and-forget).
  if (isFinisher) loadLeadNotesInto('finisherNotes_' + lead.id, lead.id);
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
// Loads the full attributed note history for a lead into a container. Used on
// the finisher's active-call screen so whoever closes the deal can read exactly
// what the starter learned on the first call — the notes follow the lead through
// the hand-off instead of dying with the starter.
async function loadLeadNotesInto(containerId, leadId) {
  const box = document.getElementById(containerId);
  if (!box) return;
  try {
    const res = await api('/api/leads/' + leadId + '/notes');
    const notes = (await res.json()).data || [];
    if (!notes.length) { box.innerHTML = '<div style="font-size:12px;color:var(--text-faint);padding:2px 0;">No call notes from the starter yet.</div>'; return; }
    box.innerHTML = notes.map(function(n) {
      const when = n.created_at ? new Date(n.created_at).toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : '';
      const av = avatarHtml({ name: n.author_name, pfp_data: n.author_pfp_data, avatar: n.author_avatar }, 26);
      return '<div style="display:flex;gap:9px;padding:9px 0;border-top:1px solid var(--border);">'
        + '<div style="flex-shrink:0;">' + av + '</div>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div style="display:flex;align-items:baseline;gap:8px;"><span style="font-size:12px;font-weight:600;">' + esc(n.author_name || 'Unknown') + '</span><span style="font-size:10.5px;color:var(--text-faint);">' + when + '</span></div>'
        +   '<div style="font-size:12.5px;color:var(--text-dim);line-height:1.5;white-space:pre-wrap;word-break:break-word;margin-top:2px;">' + esc(n.content) + '</div>'
        + '</div></div>';
    }).join('');
  } catch (e) {
    box.innerHTML = '<div style="font-size:12px;color:var(--danger);">Could not load notes.</div>';
  }
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
async function scheduleCallback(leadId) {
  const input = document.getElementById('cbDate_' + leadId);
  if (!input || !input.value) { if (typeof toast === 'function') toast('Pick a date and time first'); return; }
  const callback_at = new Date(input.value).toISOString();
  const res = await api('/api/caller/leads/' + leadId + '/callback', { method: 'POST', body: JSON.stringify({ callback_at }) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not schedule callback'); return; }
  onActiveCallScreen = false;
  if (typeof toast === 'function') toast('Callback booked — Telegram reminder sent');
  renderStaffQueue();
}
async function recordOutcome(id, outcome) {
  // 'cancelled' is the one outcome that records no real result — make it a
  // deliberate choice rather than an accidental tap that drops the lead.
  if (outcome === 'cancelled' && !confirm('Release this lead without logging a result?')) return;
  const res = await api('/api/caller/leads/' + id + '/outcome', { method: 'POST', body: JSON.stringify({ outcome, duration: callStart ? Math.floor((Date.now()-callStart)/1000) : 0 }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { alert((data && data.error) || 'Could not save that outcome — try again.'); return; }
  callStart = null; clearInterval(callTimerInterval);
  onActiveCallScreen = false; // outcome logged — navigation is unblocked again
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
        <button class="seg-tab \${lbMode==='calls'?'on':''}" onclick="lbMode='calls';renderStaffBoard()">Top Finishers</button>
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
    \${profileCardHtml(me, { self: true })}
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Your @handle</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;line-height:1.5;">Your public identity across ClearPanel — claimed once, yours everywhere. 3–20 characters: letters, numbers, underscore. \${me.handle ? 'Claimed handles are permanent.' : 'Pick a good one.'}</p>
      \${me.handle
        ? '<div style="display:flex;align-items:center;gap:8px;font-family:\\'Geist Mono\\',monospace;font-size:15px;font-weight:600;color:var(--gold-bright);"><span>@' + esc(me.handle) + '</span><span class="mono" style="font-size:10px;color:var(--success);border:1px solid var(--success);border-radius:20px;padding:2px 8px;">CLAIMED</span></div>'
        : '<div style="display:flex;gap:8px;align-items:center;"><span style="color:var(--text-faint);font-size:15px;">@</span><input id="pfHandle" placeholder="yourhandle" maxlength="20" oninput="checkHandleLive()" style="flex:1;" /><button class="btn btn-gold" style="flex-shrink:0;" id="claimHandleBtn" onclick="claimHandle()">Claim</button></div>'}
      <div id="handleStatus" style="font-size:12px;margin-top:8px;min-height:16px;"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Bio</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;line-height:1.5;">A line or two about you — shows on your profile and when teammates tap your name.</p>
      <textarea id="pfBio" maxlength="280" rows="3" placeholder="e.g. Finisher by day. Ask me about the HSBC script." oninput="document.getElementById('bioCount').textContent = (280 - this.value.length) + ' left';" style="width:100%;resize:vertical;font-family:inherit;font-size:13px;padding:10px 12px;background:rgba(255,255,255,.03);border:1px solid var(--border-2);border-radius:10px;color:var(--text);line-height:1.5;">\${esc(me.bio || '')}</textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <span id="bioCount" style="font-size:11px;color:var(--text-faint);">\${280 - (me.bio || '').length} left</span>
        <button class="btn btn-ghost btn-sm" onclick="saveBio()">Save Bio</button>
      </div>
      <div id="bioStatus" style="font-size:12px;margin-top:6px;"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Profile Colors</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:12px;line-height:1.5;">Personalize your card. Leave unset to use your rank colour.</p>
      <div style="display:flex;gap:20px;align-items:center;">
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);text-transform:none;letter-spacing:0;font-weight:500;">Banner<input type="color" id="pfBanner" value="\${/^#[0-9a-fA-F]{6}$/.test(me.banner_color||'')?me.banner_color:'#7aabff'}" style="width:34px;height:28px;border:none;background:none;cursor:pointer;" /></label>
        <label style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--text);text-transform:none;letter-spacing:0;font-weight:500;">Accent<input type="color" id="pfAccent" value="\${/^#[0-9a-fA-F]{6}$/.test(me.accent_color||'')?me.accent_color:'#c4b0ff'}" style="width:34px;height:28px;border:none;background:none;cursor:pointer;" /></label>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto;" onclick="saveColors()">Apply</button>
      </div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Profile Picture</div>
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:4px;">
        <div id="pfpPreview">\${avatarHtml(me, 64)}</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <label class="btn btn-ghost btn-sm" style="text-align:center;cursor:pointer;">Upload Photo<input type="file" accept="image/*" id="pfpFile" style="display:none;" onchange="handlePfpUpload(event)" /></label>
          \${me.pfp_data ? '<button class="btn btn-danger btn-sm" onclick="removePfp()">Remove Photo</button>' : ''}
        </div>
      </div>
      <div class="section-title">Your Call-From Number</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;">The number you're actually dialing from. Only admins can see this, and it's blurred by default.</p>
      <div class="field"><input id="pfPhone" value="\${esc(me.call_phone || '')}" placeholder="e.g. +44 7911 123456" /></div>
      <div class="section-title">Panel Login Name</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:8px;line-height:1.5;">How you're listed on <b style="color:var(--text);">this</b> panel, and how you find your way back if you lose the link. \${me.username ? '' : 'Pick one to claim it.'}</p>
      <div style="display:flex;gap:8px;">
        <input id="pfUsername" value="\${esc(me.username || '')}" placeholder="e.g. sarah_m" maxlength="20" />
        <button class="btn btn-ghost" style="flex-shrink:0;" onclick="saveUsername()">\${me.username ? 'Update' : 'Claim'}</button>
      </div>
      <div id="usernameStatus" style="font-size:12px;margin:8px 0 12px;"></div>
      <button class="btn btn-gold btn-block" onclick="saveProfile()">Save Changes</button>
      <div id="profileStatus" style="font-size:12px;margin-top:10px;"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Change Your PIN</div>
      <p style="font-size:11.5px;color:var(--text-dim);margin-bottom:10px;line-height:1.5;">This changes the PIN you use to log into <b style="color:var(--text);">this panel</b>. Pick something only you know — 4 to 8 digits.</p>
      <div class="field"><label>Current PIN</label><input id="pinCurrent" type="password" inputmode="numeric" maxlength="8" placeholder="••••" /></div>
      <div class="field"><label>New PIN</label><input id="pinNew" type="password" inputmode="numeric" maxlength="8" placeholder="4–8 digits" /></div>
      <div class="field"><label>Confirm New PIN</label><input id="pinConfirm" type="password" inputmode="numeric" maxlength="8" placeholder="repeat it" /></div>
      <button class="btn btn-gold btn-block" onclick="changePin()">Update PIN</button>
      <div id="pinStatus" style="font-size:12px;margin-top:8px;"></div>
    </div>
    <div class="panel p fade-up">
      <div class="section-title" style="margin-top:0;">Notification Preferences</div>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Lead assignments</span><input type="checkbox" class="toggle-switch" id="prefLead" checked /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Chat messages</span><input type="checkbox" class="toggle-switch" id="prefChat" checked /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Announcements</span><input type="checkbox" class="toggle-switch" id="prefAnn" checked /></label>
      <label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;text-transform:none;letter-spacing:0;font-weight:500;color:var(--text);font-size:13px;"><span>Alert sound (new leads &amp; calls)</span><input type="checkbox" class="toggle-switch" id="prefSound" \${localStorage.getItem('cp_sound_off')==='1'?'':'checked'} onchange="localStorage.setItem('cp_sound_off', this.checked?'0':'1'); if(this.checked) playPing('lead');" /></label>
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
  const preview = document.getElementById('pfpPreview');
  if (preview) preview.innerHTML = '<div style="width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--text-faint);">…</div>';
  const img = new Image();
  const reader = new FileReader();
  reader.onload = (e) => {
    img.onload = () => {
      const size = 240;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      // Compress progressively until the base64 is comfortably under the server cap,
      // so a large photo can never silently fail the size check.
      let quality = 0.82;
      let out = canvas.toDataURL('image/jpeg', quality);
      while (out.length > 180000 && quality > 0.4) { quality -= 0.12; out = canvas.toDataURL('image/jpeg', quality); }
      pendingPfpData = out;
      pendingRemovePfp = false;
      if (preview) preview.innerHTML = '<img src="' + pendingPfpData + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover;" />';
    };
    img.onerror = () => { if (preview) preview.innerHTML = '<div style="width:64px;height:64px;border-radius:50%;background:rgba(239,68,68,.12);display:flex;align-items:center;justify-content:center;font-size:9px;color:#ff8f8a;text-align:center;">bad<br>image</div>'; };
    img.src = e.target.result;
  };
  reader.onerror = () => { if (preview) preview.innerHTML = avatarHtml(me, 64); };
  reader.readAsDataURL(file);
}
async function removePfp() {
  await api('/api/me/remove-pfp', { method: 'POST' });
  me.pfp_data = null; localStorage.setItem('dispatch_me', JSON.stringify(me));
  renderStaffProfile();
}
async function saveProfile() {
  const call_phone = document.getElementById('pfPhone').value.trim();
  const body = { call_phone };
  if (pendingPfpData) body.pfp_data = pendingPfpData;
  const statusEl = document.getElementById('profileStatus');
  statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--text-dim)';
  const res = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify(body) });
  const data = await res.json();
  // The save can genuinely fail (image too large, network hiccup, expired
  // session) - previously this was never checked, so a failed save still
  // showed "Saved" and threw away the pending photo, leaving the person
  // with no idea anything was wrong until they refreshed and it was gone.
  if (!res.ok || !data.data) {
    statusEl.textContent = data.error || 'Could not save — try again.';
    statusEl.style.color = 'var(--danger)';
    return; // keep pendingPfpData so Save Changes can be retried without re-uploading
  }
  me = { ...me, ...data.data }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  pendingPfpData = null;
  statusEl.textContent = 'Saved ✓'; statusEl.style.color = 'var(--success)';
}
async function saveUsername() {
  const val = document.getElementById('pfUsername').value.trim();
  const statusEl = document.getElementById('usernameStatus');
  if (!val) { statusEl.textContent = 'Enter a username first.'; statusEl.style.color = 'var(--danger)'; return; }
  statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--text-dim)';
  const res = await api('/api/me/set-username', { method: 'POST', body: JSON.stringify({ username: val }) });
  const data = await res.json();
  if (!res.ok) { statusEl.textContent = data.error || 'Could not save that username.'; statusEl.style.color = 'var(--danger)'; return; }
  me.username = data.data.username; localStorage.setItem('dispatch_me', JSON.stringify(me));
  statusEl.textContent = 'Username set ✓'; statusEl.style.color = 'var(--success)';
  renderStaffProfile();
}
let _handleCheckTimer = null;
function checkHandleLive() {
  const input = document.getElementById('pfHandle');
  const statusEl = document.getElementById('handleStatus');
  const btn = document.getElementById('claimHandleBtn');
  if (!input || !statusEl) return;
  const val = input.value.trim().replace(/^@+/, '');
  if (_handleCheckTimer) clearTimeout(_handleCheckTimer);
  if (val.length < 3) { statusEl.textContent = ''; if (btn) btn.disabled = true; return; }
  statusEl.textContent = 'Checking…'; statusEl.style.color = 'var(--text-dim)';
  // Debounce so we're not hitting the endpoint on every keystroke.
  _handleCheckTimer = setTimeout(async () => {
    const res = await api('/api/handle/check?handle=' + encodeURIComponent(val));
    const d = (await res.json()).data || {};
    if (d.available) { statusEl.textContent = '@' + (d.handle || val) + ' is available ✓'; statusEl.style.color = 'var(--success)'; if (btn) btn.disabled = false; }
    else { statusEl.textContent = d.reason || 'Not available'; statusEl.style.color = 'var(--danger)'; if (btn) btn.disabled = true; }
  }, 350);
}
async function claimHandle() {
  const input = document.getElementById('pfHandle');
  const statusEl = document.getElementById('handleStatus');
  if (!input) return;
  const val = input.value.trim().replace(/^@+/, '');
  if (val.length < 3) { statusEl.textContent = 'Enter a handle first.'; statusEl.style.color = 'var(--danger)'; return; }
  statusEl.textContent = 'Claiming…'; statusEl.style.color = 'var(--text-dim)';
  const res = await api('/api/me/claim-handle', { method: 'POST', body: JSON.stringify({ handle: val }) });
  const data = await res.json();
  if (!res.ok) { statusEl.textContent = data.error || 'Could not claim that handle.'; statusEl.style.color = 'var(--danger)'; return; }
  me.handle = data.data.handle; localStorage.setItem('dispatch_me', JSON.stringify(me));
  renderStaffProfile();
}
async function saveBio() {
  const bio = document.getElementById('pfBio').value;
  const statusEl = document.getElementById('bioStatus');
  statusEl.textContent = 'Saving…'; statusEl.style.color = 'var(--text-dim)';
  const res = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify({ bio }) });
  const data = await res.json();
  if (!res.ok || !data.data) { statusEl.textContent = data.error || 'Could not save.'; statusEl.style.color = 'var(--danger)'; return; }
  me = { ...me, ...data.data }; localStorage.setItem('dispatch_me', JSON.stringify(me));
  statusEl.textContent = 'Saved ✓'; statusEl.style.color = 'var(--success)';
  renderStaffProfile();
}
async function saveColors() {
  const banner_color = document.getElementById('pfBanner').value;
  const accent_color = document.getElementById('pfAccent').value;
  const res = await api('/api/me/profile', { method: 'PATCH', body: JSON.stringify({ banner_color, accent_color }) });
  const data = await res.json();
  if (res.ok && data.data) { me = { ...me, ...data.data }; localStorage.setItem('dispatch_me', JSON.stringify(me)); renderStaffProfile(); }
}
async function saveNotifPrefs() {
  await api('/api/me/notif-prefs', { method: 'PATCH', body: JSON.stringify({ lead_assigned: document.getElementById('prefLead').checked, chat: document.getElementById('prefChat').checked, announcements: document.getElementById('prefAnn').checked }) });
  alert('Preferences saved');
}
async function changePin() {
  const current = document.getElementById('pinCurrent').value.trim();
  const next = document.getElementById('pinNew').value.trim();
  const confirm = document.getElementById('pinConfirm').value.trim();
  const s = document.getElementById('pinStatus');
  if (!current || !next || !confirm) { s.textContent = 'Fill in all three fields.'; s.style.color = 'var(--danger)'; return; }
  if (!/^[0-9]{4,8}$/.test(next)) { s.textContent = 'New PIN must be 4–8 digits.'; s.style.color = 'var(--danger)'; return; }
  if (next !== confirm) { s.textContent = 'The new PINs don\\'t match.'; s.style.color = 'var(--danger)'; return; }
  s.textContent = 'Updating…'; s.style.color = 'var(--text-dim)';
  const res = await api('/api/me/change-pin', { method: 'POST', body: JSON.stringify({ current_pin: current, new_pin: next }) });
  const data = await res.json();
  if (!res.ok) { s.textContent = data.error || 'Could not update PIN.'; s.style.color = 'var(--danger)'; return; }
  // The PIN is the login credential — update the stored session so the user
  // isn't logged out on their next request.
  me.pin = next; localStorage.setItem('dispatch_me', JSON.stringify(me));
  document.getElementById('pinCurrent').value = ''; document.getElementById('pinNew').value = ''; document.getElementById('pinConfirm').value = '';
  s.textContent = 'PIN updated ✓'; s.style.color = 'var(--success)';
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
