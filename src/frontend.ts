import { ADMIN_JS } from './adminJs';
import { STAFF_JS } from './staffJs';

export const MAIN_JS = `const CP_CHANNEL = 'https://t.me/+M-aK0jz4wDI5Nzdh';
const CP_BOT = 'https://t.me/clearpanelotpbot';
let me = JSON.parse(localStorage.getItem('dispatch_me') || 'null');
let brandingData = null;
async function applyBranding() {
  try {
    // If we're on a resold panel (/:slug), pass it to /api/branding so it returns
    // that tenant's name instead of falling back to the global "Frap Ties".
    // The slug is set in the server HTML as <meta id="cp-slug" content="...">
    const slugMeta = document.querySelector('meta#cp-slug');
    const slug = slugMeta?.getAttribute('content') || '';
    const url = slug ? `/api/branding?slug=${encodeURIComponent(slug)}` : '/api/branding';
    const res = await fetch(url);
    const { data } = await res.json();
    if (data && data.name) {
      brandingData = data;
      // Update login screen title
      const loginTitle = document.querySelector('.login-title');
      if (loginTitle) loginTitle.textContent = data.name;
      // Update topbar brand
      const topbarBrand = document.querySelector('.topbar .brand');
      if (topbarBrand) topbarBrand.innerHTML = '<div class="brand-mark"></div>' + esc(data.name) + ' <span class="mono" style="color:var(--text-faint);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin-left:6px;display:inline-flex;align-items:center;gap:5px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 2.2s ease-out infinite;"></span>Control Room</span>';
      // Update sidebar brand
      const sidebarBrand = document.querySelector('.sidebar .brand');
      if (sidebarBrand) sidebarBrand.textContent = data.name.split(' ')[0];
      // Update document title
      document.title = data.name;
    }
  } catch (e) {}
}
applyBranding();
let pinBuffer = '';
let es = null;
let recentlyClaimedIds = new Set();
let callTimerInterval = null, callStart = null;
let staffTab = 'home';

function authHeaders(extra) { return Object.assign({ 'x-user-id': me.id, 'x-user-pin': me.pin, 'Content-Type': 'application/json' }, extra || {}); }
async function api(url, opts = {}) {
  opts.headers = authHeaders(opts.headers);
  let res;
  try {
    res = await fetch(url, opts);
  } catch (netErr) {
    return { ok: false, status: 0, json: async () => ({ error: 'Network error — check your connection' }) };
  }
  // A session that authenticate() now rejects (suspended mid-session, or a
  // deleted account) shouldn't leave the caller staring at broken screens
  // one at a time as each API call quietly 401s - log them out cleanly the
  // first time it happens, with whatever reason the server gave.
  if ((res.status === 401 || res.status === 403) && url !== '/api/auth/login' && me) {
    const clone401 = res.clone();
    clone401.json().then(d => {
      const msg = d && d.error;
      // A bare "Unauthorized" on a 403 usually just means this specific action
      // isn't allowed for the current role - not that the session itself is
      // invalid, so don't log someone out over it. 401, or any more specific
      // message (suspended, tenant expired), does mean the session is dead.
      if (res.status === 403 && msg === 'Unauthorized') return;
      const reason = msg || 'Your session is no longer valid. Please log in again.';
      logout();
      const errEl = document.getElementById('loginError');
      if (errEl) errEl.textContent = reason;
    }).catch(() => {});
  }
  const clone = res.clone();
  const originalJson = res.json.bind(res);
  res.json = async () => {
    try {
      return await originalJson();
    } catch (parseErr) {
      let text = '';
      try { text = await clone.text(); } catch {}
      const friendly = res.status >= 500 ? 'Server error — please try again' : (text ? text.slice(0, 200) : ('Request failed (' + res.status + ')'));
      return { error: friendly };
    }
  };
  return res;
}

// ---------- Login ----------
document.getElementById('keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('.key'); if (!btn) return;
  const k = btn.dataset.k;
  if (k === 'clear') pinBuffer = ''; else if (k === 'back') pinBuffer = pinBuffer.slice(0, -1);
  else if (pinBuffer.length < 4) pinBuffer += k;
  renderPinDots();
  if (pinBuffer.length === 4) attemptLogin();
});
function renderPinDots() { document.querySelectorAll('.pin-dot').forEach((d, i) => { d.classList.remove('error'); d.classList.toggle('filled', i < pinBuffer.length); }); }
async function attemptLogin() {
  const errEl = document.getElementById('loginError');
  const _cpSlug = document.getElementById('cp-slug')?.content || null;
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pinBuffer, slug: _cpSlug }) });
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error || 'Invalid PIN';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
    setTimeout(() => { pinBuffer = ''; renderPinDots(); errEl.textContent = ''; }, 500);
    return;
  }
  me = data.data;
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  enterApp();
}
function showFindPanel() {
  document.getElementById('findPanelGate').classList.remove('hidden');
  document.getElementById('findPanelResult').textContent = '';
  document.getElementById('findPanelInput').value = '';
}
async function findMyPanel() {
  const val = document.getElementById('findPanelInput').value.trim();
  const resultEl = document.getElementById('findPanelResult');
  if (!val) { resultEl.textContent = 'Enter a username.'; resultEl.style.color = 'var(--danger)'; return; }
  resultEl.textContent = 'Looking…'; resultEl.style.color = 'var(--text-dim)';
  try {
    const res = await fetch('/api/find-panel/' + encodeURIComponent(val));
    const data = await res.json();
    if (!res.ok) { resultEl.textContent = data.error || 'No panel found for that username.'; resultEl.style.color = 'var(--danger)'; return; }
    resultEl.innerHTML = 'Found it — <b>' + esc(data.data.panel_name) + '</b>. <a href="' + data.data.url + '" style="color:var(--gold-bright);">Go to your panel →</a>';
    resultEl.style.color = 'var(--success)';
  } catch {
    resultEl.textContent = 'Network error — try again.'; resultEl.style.color = 'var(--danger)';
  }
}
function logout() {
  if (me) api('/api/clock', { method: 'POST', body: JSON.stringify({ clockedIn: false }) });
  if (es) { es.close(); es = null; }
  if (typeof stopQueuePolling === 'function') stopQueuePolling();
  localStorage.removeItem('dispatch_me'); me = null; pinBuffer = ''; renderPinDots();
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('staffApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}
async function enterApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  const res = await api('/api/me'); const fresh = (await res.json()).data;
  if (fresh) { me = { ...me, ...fresh }; localStorage.setItem('dispatch_me', JSON.stringify(me)); }
  connectEvents();
  refreshNotifBadge();
  registerServiceWorker();
  // Role picker: server-side flag, not localStorage — survives a cleared cache,
  // a new device, or reinstalling the PWA. Once confirmed, it never asks again.
  if (!me.role_confirmed_at) {
    showRoleQuiz();
    return;
  }
  // Telegram gate
  const gated = await maybeShowTelegramGate();
  if (gated) return;
  launchApp();
}
function launchApp() {
  if (me.role === 'admin') {
    document.getElementById('adminApp').classList.remove('hidden');
    switchAdminTab('dashboard');
  } else {
    document.getElementById('staffApp').classList.remove('hidden');
    updateClockBtn();
    renderStaffNav();
    switchStaffTab('home');
    // Show active in-app updates banner
    loadActivePanelUpdate();
  }
  checkFirstLoginTutorial();
}
function showRoleQuiz() {
  const gate = document.createElement('div');
  gate.id = 'roleQuiz';
  gate.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse 80% 50% at 15% -10%,rgba(124,92,255,.15),transparent 55%),radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.12),transparent 55%),var(--bg);';
  gate.innerHTML = '<div class="panel p" style="max-width:480px;width:100%;padding:40px 36px;text-align:center;">'
    + '<img src="/clearpanel-icon.png" style="width:64px;height:64px;border-radius:50%;margin:0 auto 20px;display:block;" />'
    + '<div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--violet-bright);font-weight:700;margin-bottom:8px;">Welcome to ClearPanel</div>'
    + '<h2 style="font-size:22px;margin-bottom:10px;">What best describes you?</h2>'
    + '<p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:28px;">Just so we point you to the right place. Your admin sets your actual access level.</p>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'
    +   '<div data-role-pick="caller" class="role-card" onclick="confirmRole(this)">'
    +     '<div style="font-size:32px;margin-bottom:10px;">📞</div>'
    +     '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">Caller</div>'
    +     '<div style="font-size:12px;color:var(--text-dim);line-height:1.5;">Dial leads, log outcomes, track your XP and rank on the floor.</div>'
    +   '</div>'
    +   '<div data-role-pick="admin" class="role-card" onclick="confirmRole(this)">'
    +     '<div style="font-size:32px;margin-bottom:10px;">🗂</div>'
    +     '<div style="font-weight:700;font-size:15px;margin-bottom:6px;">Manager / Admin</div>'
    +     '<div style="font-size:12px;color:var(--text-dim);line-height:1.5;">Upload leads, manage the team, view dashboards and run the floor.</div>'
    +   '</div>'
    + '</div>'
    + '<div style="font-size:11px;color:var(--text-faint);">Not sure? Pick Caller — your admin can adjust this anytime.</div>'
    + '</div>';
  document.body.appendChild(gate);
}
async function confirmRole(el) {
  const quiz = document.getElementById('roleQuiz');
  if (quiz) quiz.remove();
  // Persist server-side so this genuinely never asks again, on any device.
  await api('/api/me/confirm-role', { method: 'POST' });
  me.role_confirmed_at = new Date().toISOString();
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  const gated = await maybeShowTelegramGate();
  if (gated) return;
  launchApp();
}
async function loadActivePanelUpdate() {
  try {
    const r = await api('/api/updates/active');
    const data = (await r.json()).data;
    if (!data || data.length === 0) return;
    const latest = data[0];
    // Check if dismissed (non-live only)
    if (!latest.is_live && localStorage.getItem('cp_update_dismissed_' + latest.id)) return;
    showUpdateBanner(latest);
  } catch {}
}
function showUpdateBanner(update) {
  const existing = document.getElementById('cpUpdateBanner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'cpUpdateBanner';
  const isLive = update.is_live;
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:250;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;'
    + (isLive ? 'background:linear-gradient(135deg,rgba(239,68,68,.95),rgba(220,38,38,.95));animation:liveGlow 2s ease-in-out infinite;' : 'background:linear-gradient(135deg,rgba(124,92,255,.9),rgba(79,140,255,.85));')
    + 'backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.15);';
  if (isLive) {
    const style = document.createElement('style');
    style.textContent = '@keyframes liveGlow{0%,100%{box-shadow:0 4px 20px rgba(239,68,68,.4);}50%{box-shadow:0 4px 30px rgba(239,68,68,.7);}}';
    document.head.appendChild(style);
  }
  banner.innerHTML = '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">'
    + (isLive ? '<span style="background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800;letter-spacing:.1em;flex-shrink:0;">LIVE</span>' : '<span style="font-size:16px;flex-shrink:0;">📣</span>')
    + '<span style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(update.title) + '</span>'
    + '<span style="font-size:12.5px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:1;">' + esc(update.body) + '</span>'
    + '</div>'
    + (!isLive ? '<button onclick="dismissPanelUpdate(' + update.id + ')" style="background:rgba(255,255,255,.15);border:none;color:#fff;font-size:18px;width:28px;height:28px;border-radius:50%;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;line-height:1;">×</button>' : '');
  document.body.appendChild(banner);
}
function dismissPanelUpdate(id) {
  localStorage.setItem('cp_update_dismissed_' + id, '1');
  const banner = document.getElementById('cpUpdateBanner');
  if (banner) banner.remove();
}
// Returns true if the gate took over the screen (so caller stops).
async function maybeShowTelegramGate() {
  try {
    const r = await api('/api/telegram/my-status');
    const s = (await r.json()).data;
    if (!s || !s.master_configured) return false;
    if (s.verified_master) return false;
    showTelegramGate(s);
    return true;
  } catch { return false; }
}
// ---- Telegram verification gate ----
// Step A: user enters @username → we call start-verification
//   → if needs_start: show "open Telegram, send /start" + poll /check-started
//   → if code sent: advance to Step B
// Step B: "Check your Telegram" + 6-digit OTP input → POST /confirm-code
// Step C: welcome screen → enterApp()
function showTelegramGate(status) {
  const gate = document.createElement('div');
  gate.id = 'tgGate';
  gate.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse 80% 50% at 15% -10%,rgba(124,92,255,.15),transparent 55%),radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.12),transparent 55%),var(--bg);';
  gate.innerHTML = '<div class="panel p" style="max-width:420px;width:100%;padding:36px 32px;text-align:center;">'
    + '<div style="font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--violet-bright);font-weight:700;margin-bottom:8px;">Quick verification</div>'
    + '<h2 style="font-size:22px;margin-bottom:10px;">Link your Telegram</h2>'
    + '<p style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:22px;">We will send a code to your Telegram — enter it here to verify. Takes 30 seconds.</p>'
    + '<div id="tgStepA">'
    +   '<div class="field" style="text-align:left;"><label style="font-size:11px;color:var(--text-dim);font-weight:600;display:block;margin-bottom:6px;">Your Telegram username</label><input id="tgUname" placeholder="@yourname" value="' + esc(status.telegram_username ? '@' + status.telegram_username : '') + '" /></div>'
    +   '<button class="btn btn-gold btn-block" onclick="tgStep1()" style="margin-top:14px;">Send me a code</button>'
    +   '<div id="tgErrA" style="color:var(--danger);font-size:12px;min-height:16px;margin-top:8px;"></div>'
    + '</div>'
    + '<div id="tgStepOpen" style="display:none;">'
    +   '<div style="font-size:48px;margin-bottom:10px;">✈️</div>'
    +   '<p style="font-size:13.5px;font-weight:600;margin-bottom:6px;">Open Telegram first</p>'
    +   '<p style="font-size:12.5px;color:var(--text-dim);line-height:1.55;margin-bottom:18px;">Message <b>/start</b> to the bot below — just once, to let it reach you. Then come straight back here.</p>'
    +   '<a id="tgStartLink" class="btn btn-gold btn-block" target="_blank" rel="noopener" style="text-decoration:none;display:block;margin-bottom:14px;">Open @clearpanelotpbot</a>'
    +   '<div style="font-size:11.5px;color:var(--violet-bright);" id="tgWaiting">Waiting for you to start the bot…</div>'
    + '</div>'
    + '<div id="tgStepB" style="display:none;">'
    +   '<div style="font-size:48px;margin-bottom:10px;">📨</div>'
    +   '<p style="font-size:13.5px;font-weight:600;margin-bottom:6px;">Check your Telegram</p>'
    +   '<p style="font-size:12.5px;color:var(--text-dim);line-height:1.55;margin-bottom:16px;">Check your Telegram — a 6-digit code has been sent. Enter it below. Expires in <span id="tgCd">5:00</span>.</p>'
    +   '<input id="tgOtp" placeholder="Enter OTP" class="mono" maxlength="7" data-otp-input="1" style="text-align:center;font-size:22px;font-weight:700;letter-spacing:.2em;" />'
    +   '<button class="btn btn-gold btn-block" onclick="tgSubmitCode()" style="margin-top:12px;">Verify</button>'
    +   '<button class="btn btn-ghost btn-block" onclick="tgStep1()" style="margin-top:8px;font-size:12px;">Resend code</button>'
    +   '<div id="tgErrB" style="color:var(--danger);font-size:12px;min-height:16px;margin-top:8px;"></div>'
    + '</div>'
    + '<div id="tgStepC" style="display:none;">'
    +   '<div style="font-size:56px;margin-bottom:14px;">🎉</div>'
    +   '<h3 style="font-size:20px;margin-bottom:8px;" id="tgWelcomeName"></h3>'
    +   '<p style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:20px;">Your Telegram is now linked. A welcome message has been sent. Loading ClearPanel now.</p>'
    +   '<a href="https://t.me/+M-aK0jz4wDI5Nzdh" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:100px;background:rgba(124,92,255,.15);border:1px solid rgba(167,139,250,.35);color:var(--violet-bright);font-size:13px;font-weight:600;text-decoration:none;margin-bottom:18px;">📣 Join the ClearPanel updates channel</a>'
    +   '<div class="xp-bar"><i id="tgWelcomeBar" style="width:0%;transition:width 1.2s var(--ease-smooth);"></i></div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(gate);
}
async function tgStep1() {
  const uname = document.getElementById('tgUname') ? document.getElementById('tgUname').value.trim() : window._tgUname;
  const errA = document.getElementById('tgErrA');
  if (errA) errA.textContent = '';
  if (!uname || uname.length < 3) { if (errA) errA.textContent = 'Enter your @username'; return; }
  window._tgUname = uname;
  const r = await api('/api/telegram/start-verification', { method:'POST', body: JSON.stringify({ username: uname, scope: 'master' })});
  const data = await r.json();
  if (!r.ok) { if (errA) errA.textContent = data.error || 'Failed'; return; }
  if (data.data.needs_start) {
    // Bot doesn't know them yet — show the "open bot" step and poll
    tgShowOnly('tgStepOpen');
    const link = document.getElementById('tgStartLink');
    if (link) link.href = data.data.deep_link || ('https://t.me/' + (data.data.bot_username || 'clearpanelotpbot'));
    tgPollStarted();
  } else {
    // Code was DM'd — show the OTP input
    window._tgExpires = new Date(data.data.expires_at).getTime();
    tgShowOnly('tgStepB');
    startTgCd();
  }
}
function tgShowOnly(id) {
  ['tgStepA','tgStepOpen','tgStepB','tgStepC'].forEach(i => {
    const el = document.getElementById(i);
    if (el) el.style.display = i === id ? 'block' : 'none';
  });
}
function tgPollStarted() {
  clearInterval(window._tgPollI);
  window._tgPollI = setInterval(async () => {
    const r = await api('/api/telegram/check-started?scope=master');
    const d = await r.json();
    if (d.data && d.data.started) {
      clearInterval(window._tgPollI);
      const w = document.getElementById('tgWaiting');
      if (w) { w.textContent = 'Got it! Sending your code…'; w.style.color = 'var(--success)'; }
      setTimeout(() => tgStep1(), 600);
    }
  }, 2000);
}
async function tgSubmitCode() {
  const raw = (document.getElementById('tgOtp').value || '').replace(/\D/g, '');
  const errB = document.getElementById('tgErrB');
  errB.textContent = '';
  if (raw.length !== 6) { errB.textContent = 'Enter the 6-digit code from Telegram'; return; }
  const r = await api('/api/telegram/confirm-code', { method:'POST', body: JSON.stringify({ code: raw, scope: 'master' })});
  const data = await r.json();
  if (!r.ok) { errB.textContent = data.error || 'Wrong code — try again'; return; }
  clearInterval(window._tgCdI);
  tgShowOnly('tgStepC');
  const nameEl = document.getElementById('tgWelcomeName');
  if (nameEl) nameEl.textContent = 'Welcome, ' + esc(data.data.name || 'there') + '!';
  requestAnimationFrame(() => {
    setTimeout(() => { const bar = document.getElementById('tgWelcomeBar'); if (bar) bar.style.width = '100%'; }, 80);
  });
  setTimeout(() => {
    const gate = document.getElementById('tgGate');
    if (gate) gate.remove();
    enterApp();
  }, 1800);
}
function startTgCd() {
  clearInterval(window._tgCdI);
  const tick = () => {
    const left = Math.max(0, Math.floor((window._tgExpires - Date.now()) / 1000));
    const m = Math.floor(left/60), sec = left%60;
    const el = document.getElementById('tgCd');
    if (el) el.textContent = m + ':' + String(sec).padStart(2,'0');
    if (left <= 0) { clearInterval(window._tgCdI); if (el) el.style.color = 'var(--danger)'; }
  };
  tick();
  window._tgCdI = setInterval(tick, 1000);
}
// Keep old names so nothing else breaks
function tgStartVerify() { tgStep1(); }
function tgCopyCode() {}
function startTgCountdown() {}
function startTgPoll() {}
// Registered unconditionally on every login, not just when someone opts into push -
// an active service worker is also what makes Chrome/Android treat this as a real
// installable app in the first place, not just a bookmark.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('/sw.js'); } catch {}
}
function renderStaffNav() {
  const nav = document.getElementById('staffNav');
  const queueLabel = me.role === 'finisher' ? 'Queue' : 'Leads';
  nav.innerHTML = \`
    <button class="nav-btn active" data-tab="home" onclick="switchStaffTab('home')">\${ICONS.home}Home</button>
    <button class="nav-btn" data-tab="queue" onclick="switchStaffTab('queue')" style="position:relative;">\${ICONS.radar}\${queueLabel}</button>
    <button class="nav-btn" data-tab="chat" onclick="switchStaffTab('chat')" style="position:relative;">\${ICONS.chat}Chat</button>
    <button class="nav-btn" data-tab="scripts" onclick="switchStaffTab('scripts')">\${ICONS.doc || ICONS.chat}Scripts</button>
    <button class="nav-btn" data-tab="board" onclick="switchStaffTab('board')">\${ICONS.trophy}Board</button>
    <button class="nav-btn" data-tab="profile" onclick="switchStaffTab('profile')">\${ICONS.gear}Profile</button>
  \`;
}

// ---------- Realtime ----------
function connectEvents() {
  if (es) es.close();
  es = new EventSource('/api/events?uid=' + me.id + '&pin=' + me.pin);
  es.addEventListener('new_lead', () => { if (staffTab === 'queue' && !onActiveCallScreen) smoothRerender(renderStaffQueue); pingNav('queue'); if (me.role==='admin') maybeRefreshAdmin('leads'); });
  es.addEventListener('center_closed', (e) => {
    if (me.role === 'admin') return; // admins are exempt from the gate, nothing changes for them
    const d = JSON.parse(e.data);
    me.clocked_in = false;
    localStorage.setItem('dispatch_me', JSON.stringify(me));
    window._centerClosed = true;
    window._centerClosedReason = d.reason || 'The call center is closed right now.';
    updateClockBtn();
    if (staffTab === 'queue') renderStaffQueue();
  });
  es.addEventListener('caller_identified', (e) => {
    if (me.role !== 'admin') return;
    const zone = document.getElementById('callerIdPopZone');
    if (!zone) return; // not currently on the dashboard, no pop to show
    const d = JSON.parse(e.data);
    const lead = d.lead;
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
    const card = document.createElement('div');
    card.className = 'caller-id-pop fade-up';
    card.innerHTML = '<div class="pop-badge">' + (d.provider || '').toUpperCase() + ' · Inbound Now</div>' +
      '<div class="pop-name">' + esc(name) + '</div>' +
      '<div class="pop-meta mono">' + esc(d.from || lead.phone || '') + (lead.lead_type ? ' · ' + esc(lead.lead_type) : '') + '</div>' +
      (lead.notes ? '<div class="pop-notes">' + esc(lead.notes) + '</div>' : '') +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\\'.caller-id-pop\\').remove()">Dismiss</button>';
    zone.prepend(card);
    setTimeout(() => { if (card.parentNode) card.style.opacity = '0.001'; }, 45000);
  });
  es.addEventListener('lead_claimed', (e) => {
    const d = JSON.parse(e.data);
    const card = document.querySelector('[data-lead-id="' + d.id + '"]');
    if (card) card.remove();
    // A poll request that was already in flight when this claim happened can still
    // land afterward with a stale response that includes this lead - remembering it
    // was just claimed stops it from being silently re-added for a few seconds.
    recentlyClaimedIds.add(d.id);
    setTimeout(() => recentlyClaimedIds.delete(d.id), 15000);
  });
  es.addEventListener('lead_updated', () => { if (me.role === 'admin') maybeRefreshAdmin(['dashboard','leads','finishing']); });
  es.addEventListener('announcement', () => { if (staffTab === 'home') renderStaffHome(); if (me.role==='admin') maybeRefreshAdmin('announcements'); });
  es.addEventListener('chat_message', (e) => { const d = JSON.parse(e.data); if (staffTab === 'chat' || (me.role==='admin' && currentAdminTab==='chat')) appendChatMessage(d); else pingNav('chat'); });
  es.addEventListener('notification', () => refreshNotifBadge());
  es.addEventListener('lead_note', (e) => {
    const d = JSON.parse(e.data);
    if (me.role !== 'admin' && me.role !== 'manager') return;
    showNoteToast(d);
  });
  es.onerror = () => setTimeout(() => { if (me) connectEvents(); }, 3000);
}
function pingNav(tab) {
  const btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]');
  if (btn && !btn.querySelector('.nav-badge')) { const b = document.createElement('span'); b.className = 'nav-badge'; b.style.position='absolute'; b.style.top='2px'; b.style.right='22%'; btn.appendChild(b); }
}
function clearNavBadge(tab) { const btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]'); const b = btn && btn.querySelector('.nav-badge'); if (b) b.remove(); }
let currentAdminTab = 'dashboard';
function maybeRefreshAdmin(tabs) { const arr = Array.isArray(tabs) ? tabs : [tabs]; if (arr.includes(currentAdminTab)) smoothRerender(() => renderAdminTab(currentAdminTab)); }
// Background updates (triggered by other people's actions via SSE) shouldn't look
// like the page reloading. Briefly dims the content, swaps it while invisible, then
// fades back in — same content update, no jarring flash or re-triggered pop-in
// animations on every background change.
async function smoothRerender(renderFn) {
  const el = document.getElementById(me.role === 'admin' ? 'adminContent' : 'staffBody');
  if (!el) { await renderFn(); return; }
  el.style.transition = 'opacity .15s ease';
  el.style.opacity = '0.4';
  await new Promise(r => setTimeout(r, 120));
  await renderFn();
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

async function refreshNotifBadge() {
  const res = await api('/api/notifications/unread-count'); const { count } = (await res.json()).data;
  ['notifBtn','notifBtnStaff'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    let dot = el.querySelector('.dot');
    if (count > 0 && !dot) { dot = document.createElement('span'); dot.className = 'dot'; el.appendChild(dot); }
    if (count === 0 && dot) dot.remove();
  });
}
async function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  if (!panel.classList.contains('hidden')) { closeNotifPanel(); return; }
  await renderNotifList();
  panel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}
function closeNotifPanel() {
  document.getElementById('notifPanel').classList.add('hidden');
  document.getElementById('notifBackdrop').classList.add('hidden');
}
async function renderNotifList() {
  const panel = document.getElementById('notifPanel');
  const res = await api('/api/notifications');
  const rows = (await res.json()).data;
  panel.innerHTML = \`<div class="panel p fade-up">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div class="section-title" style="margin:0;">Notifications</div>
      <button class="icon-btn" style="width:28px;height:28px;" onclick="closeNotifPanel()">✕</button>
    </div>
    \${rows.length ? rows.map(n => \`<div class="clickable" style="padding:11px 0;border-bottom:1px solid var(--border);font-size:12.5px;\${n.read ? 'opacity:.5;' : ''}" onclick="markOneRead(\${n.id}, this)">
      <div>\${esc(n.content)}</div><div style="font-size:10px;color:var(--text-faint);margin-top:3px;">\${timeAgo(n.created_at)}\${!n.read ? ' · <span style="color:var(--gold-bright);">tap to mark read</span>' : ''}</div>
    </div>\`).join('') : '<div style="color:var(--text-dim);font-size:12.5px;padding:10px 0;">Nothing yet.</div>'}
    \${rows.length ? '<button class="btn btn-sm btn-block" style="margin-top:12px;" onclick="markAllRead()">Mark all read</button>' : ''}
  </div>\`;
}
async function markOneRead(id, el) {
  await api('/api/notifications/' + id + '/read', { method: 'POST' });
  el.style.opacity = '.5';
  refreshNotifBadge();
}
async function markAllRead() {
  await api('/api/notifications/read-all', { method: 'POST' });
  refreshNotifBadge();
  await renderNotifList();
}

// ---------- Clock ----------
let clockDurationInterval;
async function updateClockBtn() {
  const btn = document.getElementById('clockBtn');
  const label = document.getElementById('clockLabel');
  clearInterval(clockDurationInterval);
  if (me.clocked_in) {
    btn.classList.add('on');
    let clockedInAt;
    try {
      const res = await api('/api/clock/status');
      const data = (await res.json()).data;
      clockedInAt = data.clockedInAt ? new Date(data.clockedInAt).getTime() : Date.now();
    } catch { clockedInAt = Date.now(); }
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - clockedInAt) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      label.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    };
    tick();
    clockDurationInterval = setInterval(tick, 1000);
  } else {
    label.textContent = 'Clock In';
    btn.classList.remove('on');
  }
}
async function toggleClock() {
  const wantClockedIn = !me.clocked_in;
  const res = await api('/api/clock', { method: 'POST', body: JSON.stringify({ clockedIn: wantClockedIn }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (wantClockedIn) {
      window._centerClosed = true;
      window._centerClosedReason = data.error || 'The call center is closed right now.';
    }
    if (staffTab === 'queue') renderStaffQueue();
    return;
  }
  me.clocked_in = wantClockedIn;
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  updateClockBtn();
  if (staffTab === 'queue') renderStaffQueue();
}

// Real motion on stat numbers instead of just appearing — counts up from 0 over
// ~600ms with an eased curve, applied automatically to any element with data-count.
function animateCountUps(container) {
  const els = (container || document).querySelectorAll('[data-count]');
  els.forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const duration = 650;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  });
}

// ---- Ranks: caller-based progression. XP flows naturally from dialling work.
// Rank up reflects how experienced and consistent a caller is — not gaming tiers.
// Each rank has a colour, an icon, and a min level to reach it.
const RANK_TIERS = [
  // [name, colour, darker shade, min level, icon emoji]
  ['New Dialer',     '#94a3b8', '#64748b',  1, '📞'],
  ['Dialer',         '#60a5fa', '#2563eb',  3, '📲'],
  ['Active Dialer',  '#34d399', '#059669',  6, '⚡'],
  ['Consistent',     '#fbbf24', '#d97706',  10, '🔥'],
  ['Senior Dialer',  '#f97316', '#c2410c',  15, '💼'],
  ['Top Dialer',     '#e879f9', '#a21caf',  20, '🎯'],
  ['Elite Caller',   '#818cf8', '#4f46e5',  27, '💎'],
  ['Legend',         '#fcd34d', '#b45309',  35, '👑'],
];
function rankInfo(xp) {
  const li = levelInfo(xp);
  let tier = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (li.level >= t[3]) tier = t;
  const isTop = tier[0] === 'Legend';
  return { tier: tier[0], div: '', c1: tier[1], c2: tier[2], icon: tier[4], label: tier[0], level: li.level, li, isTop };
}
function rankEmblemHtml(rk, size) {
  const fs = Math.round(size * 0.46);
  return '<div class="rank-emblem" style="--rc1:' + rk.c1 + ';--rc2:' + rk.c2 + ';width:' + size + 'px;height:' + size + 'px;border-radius:50%;"><span class="div" style="font-size:' + fs + 'px;">' + (rk.icon || '📞') + '</span></div>';
}
function rankChipHtml(rk) {
  return '<span class="rank-chip" style="color:' + rk.c1 + ';border-color:' + rk.c1 + '55;">' + rankEmblemHtml(rk, 16) + rk.label + '</span>';
}
function showRankUp(rk) {
  const el = document.createElement('div');
  el.className = 'rankup-overlay';
  el.style.setProperty('--rc1', rk.c1);
  el.innerHTML = '<div class="big">' + rankEmblemHtml(rk, 110) + '</div><div class="t1">Rank Up</div><div class="t2" style="color:' + rk.c1 + ';">' + rk.label + '</div><div class="t3">Level ' + rk.level + ' — keep dialling</div>';
  el.onclick = () => el.remove();
  document.body.appendChild(el);
}
// ---- Bank directory: UK + international, name -> official domain. The favicon
// service resolves a mark for any domain, so custom banks work the same way. ----
const BANK_DIR = {
  uk: [["Lloyds","lloydsbank.com"],["Barclays","barclays.co.uk"],["HSBC UK","hsbc.co.uk"],["NatWest","natwest.com"],["Santander UK","santander.co.uk"],["Halifax","halifax.co.uk"],["TSB","tsb.co.uk"],["Nationwide","nationwide.co.uk"],["RBS","rbs.co.uk"],["Metro Bank","metrobankonline.co.uk"],["Monzo","monzo.com"],["Starling","starlingbank.com"],["Revolut","revolut.com"],["First Direct","firstdirect.com"],["Co-operative Bank","co-operativebank.co.uk"],["Virgin Money","virginmoney.com"],["Bank of Scotland","bankofscotland.co.uk"],["Ulster Bank","ulsterbank.co.uk"],["Chase UK","chase.co.uk"],["Tesco Bank","tescobank.com"],["Sainsbury's Bank","sainsburysbank.co.uk"],["Danske Bank UK","danskebank.co.uk"],["Atom Bank","atombank.co.uk"],["Zopa","zopa.com"],["Shawbrook","shawbrook.co.uk"],["Aldermore","aldermore.co.uk"],["Paragon Bank","paragonbank.co.uk"],["Marcus","marcus.co.uk"],["Yorkshire BS","ybs.co.uk"],["Skipton BS","skipton.co.uk"],["Coventry BS","coventrybuildingsociety.co.uk"]],
  intl: [["Chase","chase.com"],["Bank of America","bankofamerica.com"],["Wells Fargo","wellsfargo.com"],["Citibank","citi.com"],["Capital One","capitalone.com"],["US Bank","usbank.com"],["PNC","pnc.com"],["Goldman Sachs","goldmansachs.com"],["Morgan Stanley","morganstanley.com"],["TD Bank","td.com"],["RBC","rbc.com"],["Scotiabank","scotiabank.com"],["BMO","bmo.com"],["CIBC","cibc.com"],["Deutsche Bank","db.com"],["Commerzbank","commerzbank.com"],["BNP Paribas","bnpparibas.com"],["Societe Generale","societegenerale.com"],["Credit Agricole","credit-agricole.com"],["ING","ing.com"],["ABN AMRO","abnamro.com"],["Rabobank","rabobank.com"],["UBS","ubs.com"],["Santander","santander.com"],["BBVA","bbva.com"],["CaixaBank","caixabank.com"],["Intesa Sanpaolo","intesasanpaolo.com"],["UniCredit","unicredit.it"],["Nordea","nordea.com"],["Danske Bank","danskebank.com"],["SEB","seb.se"],["Swedbank","swedbank.com"],["HSBC","hsbc.com"],["Standard Chartered","sc.com"],["DBS","dbs.com"],["OCBC","ocbc.com"],["UOB","uob.com.sg"],["ANZ","anz.com"],["Commonwealth Bank","commbank.com.au"],["Westpac","westpac.com.au"],["NAB","nab.com.au"],["ICICI","icicibank.com"],["HDFC","hdfcbank.com"],["Axis Bank","axisbank.com"],["Emirates NBD","emiratesnbd.com"],["FAB","bankfab.com"],["QNB","qnb.com"],["N26","n26.com"],["Wise","wise.com"],["Bunq","bunq.com"]],
};
function bankLogoUrl(domain) { return 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64'; }
// ---- Levels ----
// Cost to clear level n grows by 60 XP per level: 100, 160, 220, ... so early
// levels come fast (day one feels rewarding) and later ones are a real season.
function levelInfo(xp) {
  let lvl = 1, rem = Math.max(0, xp || 0), cost = 100;
  while (rem >= cost) { rem -= cost; lvl++; cost = 100 + (lvl - 1) * 60; }
  const bands = [[35,'Legend'],[27,'Elite Caller'],[20,'Top Dialer'],[15,'Senior Dialer'],[10,'Consistent'],[6,'Active Dialer'],[3,'Dialer'],[1,'New Dialer']];
  const title = bands.find(b => lvl >= b[0])[1];
  return { level: lvl, into: rem, need: cost, pct: Math.min(100, Math.round(rem / cost * 100)), title };
}
// Floating "+N XP" chip — fired whenever the server reports xp_awarded, so the
// grind is visibly paying out in the moment, not just on the leaderboard later.
function xpToast(amount, label) {
  if (!amount) return;
  const el = document.createElement('div');
  el.className = 'xp-toast';
  el.innerHTML = '⚡ +' + amount + ' XP' + (label ? ' <span style="font-weight:500;color:var(--text-dim);font-size:12px;">· ' + esc(label) + '</span>' : '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1950);
}
// A brief green checkmark burst for landing a successful call — separate from
// the XP toast (which is about the number) and the rank-up overlay (which is
// about a level milestone). This one is purely "that call went well."
function celebrateSuccessfulCall() {
  const el = document.createElement('div');
  el.className = 'success-burst';
  el.innerHTML = '<div class="ring"></div><div class="check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>';
  document.body.appendChild(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 320); }, 650);
}
function showNoteToast(d) {
  // Live note toast shown to admins/managers when a caller submits a note
  const existing = document.getElementById('noteToastEl');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'noteToastEl';
  el.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:300;max-width:320px;padding:14px 16px;border-radius:16px;background:rgba(18,18,26,.95);border:1px solid rgba(167,139,250,.4);backdrop-filter:blur(20px);box-shadow:0 8px 32px rgba(0,0,0,.4);animation:xpRise .6s cubic-bezier(.16,1,.3,1) both;cursor:pointer;';
  const callerName = d.note && d.note.author_name ? esc(d.note.author_name) : 'A caller';
  const noteText = d.note && d.note.content ? esc(d.note.content) : '';
  const leadName = d.leadName ? esc(d.leadName) : 'a lead';
  el.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px;">'
    + '<span style="font-size:18px;flex-shrink:0;">📝</span>'
    + '<div style="flex:1;min-width:0;">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--violet-bright);margin-bottom:3px;">Live Note · ' + callerName + '</div>'
    + '<div style="font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:3px);">' + leadName + '</div>'
    + '<div style="font-size:12px;color:var(--text-dim);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">' + noteText + '</div>'
    + '</div>'
    + '<button onclick="this.parentElement.parentElement.remove()" style="background:none;border:none;color:var(--text-faint);font-size:16px;cursor:pointer;flex-shrink:0;padding:0;line-height:1;">×</button>'
    + '</div>';
  el.onclick = (e) => { if (e.target.tagName === 'BUTTON') return; el.remove(); if (typeof switchAdminTab === 'function') switchAdminTab('leads'); };
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 8000);
}
// ---- Leaderboard builders (shared by staff board and admin board) ----
function lbSortKey(mode) { return mode === 'week' ? 'weekly_xp' : 'xp'; }
function lbPodiumSlot(r, place, height, mode) {
  if (!r) return '<div style="flex:1;"></div>';
  const xpVal = mode === 'week' ? (r.weekly_xp || 0) : r.xp;
  const li = levelInfo(r.xp);
  const barColor = place === 1 ? 'linear-gradient(180deg,#fbbf24,#b8860b)' : place === 2 ? 'linear-gradient(180deg,#d1d5db,#9ca3af)' : 'linear-gradient(180deg,#d97706,#92400e)';
  return '<div class="podium-slot">'
    + (place === 1 ? '<div class="podium-crown">👑</div>' : '<div style="height:16px;"></div>')
    + '<div class="podium-av' + (place === 1 ? ' first' : '') + '">' + avatarHtml(r, place === 1 ? 54 : 44) + '</div>'
    + '<div style="font-size:11.5px;font-weight:700;text-align:center;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(r.name) + (typeof me !== 'undefined' && me && r.id === me.id ? ' <span style="color:var(--gold-bright);">(you)</span>' : '') + '</div>'
    + '<span class="lvl-chip">Lv ' + li.level + ' · ' + li.title + '</span>'
    + '<div class="mono" style="font-size:11px;color:var(--violet-bright);font-weight:700;" data-count="' + xpVal + '">0</div>'
    + '<div class="podium-bar" style="height:' + height + 'px;background:' + barColor + ';">#' + place + '</div>'
    + '</div>';
}
function lbRowHtml(r, rank, mode, delay) {
  const xpVal = mode === 'week' ? (r.weekly_xp || 0) : r.xp;
  const li = levelInfo(r.xp);
  const isMe = typeof me !== 'undefined' && me && r.id === me.id;
  return '<div class="lb-row' + (isMe ? ' me' : '') + '" style="animation-delay:' + (delay * 45) + 'ms;padding:11px 12px;">'
    + '<div class="rank r' + rank + '">' + rank + '</div>' + avatarHtml(r, 32)
    + '<div style="flex:1;min-width:0;margin-left:8px;">'
    +   '<div class="lb-name">' + esc(r.name) + (isMe ? ' <span style="color:var(--gold-bright);">(you)</span>' : '') + ' <span class="lvl-chip" style="padding:2px 8px;font-size:9px;">Lv ' + li.level + '</span></div>'
    +   '<div class="xp-bar" style="margin-top:6px;max-width:190px;"><i style="width:' + li.pct + '%;"></i></div>'
    + '</div>'
    + '<div class="lb-stats"><span><b>' + (r.successful_calls || 0) + '</b> wins</span><span style="color:var(--violet-bright);"><b class="mono" data-count="' + xpVal + '">0</b> xp</span></div>'
    + '</div>';
}
function lbBoardHtml(rows, mode) {
  const sorted = [...rows].sort((a, b) => (mode === 'week' ? (b.weekly_xp||0) - (a.weekly_xp||0) : b.xp - a.xp));
  const [first, second, third] = sorted;
  const rest = sorted.slice(3);
  return (sorted.length ? '<div class="panel p fade-up" style="padding:24px 16px 0;">'
      + '<div style="display:flex;align-items:flex-end;justify-content:center;gap:12px;max-width:420px;margin:0 auto;">'
      + lbPodiumSlot(second, 2, 74, mode) + lbPodiumSlot(first, 1, 96, mode) + lbPodiumSlot(third, 3, 60, mode)
      + '</div></div>' : '<div class="panel p" style="color:var(--text-dim);">No one on the board yet — XP starts counting from the first claimed lead.</div>')
    + (rest.length ? '<div class="panel p fade-up">' + rest.map((r, i) => lbRowHtml(r, i + 4, mode, i)).join('') + '</div>' : '');
}
// How the whole economy works, in the app itself — no tribal knowledge needed.
function xpGuideHtml() {
  const rowsData = [['Claim a lead','+5'],['Mark on call','+10'],['Live note for admin','+3'],['Voicemail / no answer','+5'],['Callback booked','+15'],['Successful call','+100'],['Finisher: completed','+75']];
  return "<div class='panel p fade-up'><div class='scripts-toggle' data-toggle-next='1' style='margin-bottom:0;'><span>⚡ How XP works</span><span>▾</span></div>"
    + '<div class="scripts-panel"><div style="padding-top:12px;">'
    + "<p style='font-size:12px;color:var(--text-dim);line-height:1.6;margin-bottom:10px;'>Every action pays XP the moment it lands — you will see it pop on screen. Levels cost more as you climb (100 XP for level 2, +60 more each level after). This Week is a rolling 7-day race; All Time keeps everything.</p>"
    + rowsData.map(x => '<div style="display:flex;justify-content:space-between;padding:7px 2px;border-bottom:1px solid var(--border);font-size:12.5px;"><span>' + x[0] + '</span><b class="mono" style="color:var(--violet-bright);">' + x[1] + '</b></div>').join('')
    + '</div></div></div>';
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-toggle-next]');
  if (t && t.nextElementSibling) t.nextElementSibling.classList.toggle('open');
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t && t.dataset && t.dataset.otpInput) t.value = t.value.replace(/[^0-9]/g, '');
});
function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function esc(s) { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fullName(l) { return [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Unknown'; }
function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()); }
const STATUS_ICONS = {
  successful_call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L19 7"/></svg>',
  completed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L19 7"/></svg>',
  failed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cancelled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chopped_previously: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  not_called: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="8"/></svg>',
  calling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>',
  active_call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>',
  call_ended: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  ready_for_finishing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
  assigned_to_finisher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
  requires_review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
  voicemail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  no_answer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  hung_up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  busy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  callback_requested: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/></svg>',
  caller: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/></svg>',
  finisher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
};
function statusBadge(status, extraClass) {
  return '<span class="badge ' + status + (extraClass ? ' ' + extraClass : '') + '">' + titleCase(status) + '</span>';
}
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const AVATAR_PALETTE = ['#4f8cff','#2dd4bf','#a78bfa','#f59e0b','#ef4444','#10b981','#6366f1','#ec4899','#14b8a6','#f97316'];
function avatarColor(seed) {
  let hash = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
// Single shared avatar renderer used everywhere a person needs a picture: a real
// uploaded photo when set, otherwise a colored initials circle — no emoji.
function avatarHtml(person, size) {
  if (person && person.pfp_data) return '<img src="' + person.pfp_data + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 2px rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.3);" />';
  const name = person ? (person.name || fullName(person)) : '';
  const color = avatarColor((person && person.id) || name);
  const fontSize = Math.round(size * 0.4);
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:' + fontSize + 'px;font-weight:700;color:#fff;flex-shrink:0;letter-spacing:-.02em;box-shadow:0 0 0 2px rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.3);">' + initials(name) + '</div>';
}
// The person's real photo (or initials) is always the primary image — a rank
// never replaces it. The rank shows as a small badge overlapping the bottom
// right corner instead, same pattern as a platform status indicator.
function avatarWithRankHtml(person, size, rk) {
  const badgeSize = Math.round(size * 0.46);
  const badgeFont = Math.round(badgeSize * 0.52);
  return '<div style="position:relative;width:' + size + 'px;height:' + size + 'px;flex-shrink:0;">'
    + avatarHtml(person, size)
    + '<div style="position:absolute;right:-3px;bottom:-3px;width:' + badgeSize + 'px;height:' + badgeSize + 'px;border-radius:50%;background:linear-gradient(160deg,' + rk.c2 + ',' + rk.c1 + ' 60%);display:flex;align-items:center;justify-content:center;font-size:' + badgeFont + 'px;box-shadow:0 0 0 3px var(--bg-2),0 2px 6px rgba(0,0,0,.4);line-height:1;">' + (rk.icon || '📞') + '</div>'
    + '</div>';
}

// Shared lead-category badge (used on both the admin leads table and caller-facing
// lead cards). Bank categories render their real, publicly-hosted brand mark —
// fetched by domain from a logo lookup service, never bytes we store or copy
// ourselves — with the existing brand-color initial badge as an automatic
// fallback if the image 404s or the category isn't a bank at all.
const BANK_DOMAINS = {
  'lloyds': 'lloydsbank.com', 'barclays': 'barclays.co.uk', 'hsbc': 'hsbc.co.uk',
  'natwest': 'natwest.com', 'santander': 'santander.co.uk', 'halifax': 'halifax.co.uk',
  'tsb': 'tsb.co.uk', 'nationwide': 'nationwide.co.uk', 'rbs': 'rbs.co.uk',
  'metro bank': 'metrobankonline.co.uk', 'monzo': 'monzo.com', 'starling': 'starlingbank.com',
};
let sharedCategoryCache = null;
async function loadCategoryCache() {
  if (sharedCategoryCache) return sharedCategoryCache;
  try {
    const res = await api('/api/lead-categories');
    sharedCategoryCache = (await res.json()).data;
  } catch { sharedCategoryCache = []; }
  return sharedCategoryCache;
}
function categoryBadgeHtml(leadType) {
  if (!leadType || !sharedCategoryCache) return '';
  const cat = sharedCategoryCache.find(c => c.name.toLowerCase() === String(leadType).toLowerCase());
  const color = cat ? cat.color : '#8b8b93';
  const domain = (cat && cat.domain) || BANK_DOMAINS[String(leadType).toLowerCase()];
  const logoImg = domain
    ? '<img src="https://www.google.com/s2/favicons?domain=' + domain + '&sz=64" alt="" style="width:15px;height:15px;border-radius:4px;object-fit:contain;flex-shrink:0;" onerror="this.remove()" />'
    : '';
  return '<span class="badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;gap:5px;">' + logoImg + esc(leadType) + '</span>';
}

// ---------- Shared chat panel (used by both admin and staff shells) ----------
async function renderChatInto(containerEl) {
  const [msgsRes, presenceRes] = await Promise.all([api('/api/chat/messages'), api('/api/chat/presence')]);
  const msgs = (await msgsRes.json()).data;
  const presence = (await presenceRes.json()).data;
  containerEl.innerHTML = \`
    <div class="presence-strip">\${presence.map(p => '<div class="presence-chip ' + (p.clocked_in ? 'online' : '') + '"><span class="dot"></span>' + avatarHtml(p, 16) + ' ' + esc(p.name) + '</div>').join('')}</div>
    <div class="chat-shell panel" style="padding:14px;">
      <div class="chat-messages" id="chatMessages">\${msgs.map(chatMsgHtml).join('')}</div>
      <div class="chat-input-row" style="flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;">
          <input id="chatInput" placeholder="Message the team…" onkeydown="if(event.key==='Enter') sendChatMessage()" />
          <button class="btn btn-gold" onclick="sendChatMessage()">Send</button>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-dim);text-transform:none;letter-spacing:0;font-weight:500;">
          <input type="checkbox" id="disappearToggle" style="width:auto;" /> Disappearing message
          <select id="disappearDuration" style="width:auto;padding:4px 8px;font-size:11px;display:none;">
            <option value="60">1 minute</option><option value="3600">1 hour</option><option value="86400" selected>24 hours</option><option value="604800">7 days</option>
          </select>
        </label>
      </div>
    </div>\`;
  document.getElementById('disappearToggle').addEventListener('change', (e) => {
    document.getElementById('disappearDuration').style.display = e.target.checked ? 'inline-block' : 'none';
  });
  const box = document.getElementById('chatMessages');
  box.scrollTop = box.scrollHeight;
  api('/api/chat/read', { method: 'POST', body: JSON.stringify({ lastReadMessageId: msgs.length ? msgs[msgs.length - 1].id : 0 }) });
  clearNavBadge('chat');
}
function chatMsgHtml(m) {
  const own = m.sender_id === me.id;
  return \`<div class="chat-msg \${own ? 'own' : ''}" data-msg-id="\${m.id}">\${avatarHtml({ name: m.sender_name, pfp_data: m.sender_pfp_data }, 32)}
    <div class="chat-bubble"><div class="chat-sender">\${esc(m.sender_name || 'Unknown')}\${m.sender_role === 'admin' ? ' <span class="badge admin" style="margin-left:4px;">admin</span>' : ''}\${m.expires_at ? ' <span title="Disappears ' + timeAgo(m.expires_at) + '" style="opacity:.6;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;">· expires \${timeAgo(m.expires_at)}</span>' : ''}</div>
    <div class="chat-text">\${esc(m.content)}</div><div class="chat-time">\${timeAgo(m.created_at)}\${(own || me.role === 'admin') ? ' · <span style="cursor:pointer;text-decoration:underline;" onclick="deleteChatMessage(' + m.id + ')">delete</span>' : ''}</div></div></div>\`;
}
function appendChatMessage(m) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', chatMsgHtml(m));
  box.scrollTop = box.scrollHeight;
}
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  const disappear = document.getElementById('disappearToggle');
  const expiresInSeconds = disappear && disappear.checked ? Number(document.getElementById('disappearDuration').value) : undefined;
  input.value = '';
  await api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ content, expiresInSeconds }) });
}
async function deleteChatMessage(id) {
  await api('/api/chat/messages/' + id, { method: 'DELETE' });
  const el = document.querySelector('[data-msg-id="' + id + '"]');
  if (el) el.remove();
}`;

export const ICONS_SVG: Record<string, string> = {
  dashboard: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  list: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
  upload: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  warn: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
  flag: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 21V4M5 5h13l-3 4 3 4H5"/></svg>',
  users: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.7.3 4.7 2.3 5.5 4.8"/></svg>',
  chat: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5z"/></svg>',
  megaphone: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 10v4h3l6 4V6L6 10H3z"/><path d="M15 9a3 3 0 010 6M18 6a7 7 0 010 12"/></svg>',
  target: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  doc: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
  exit: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 3H5a1 1 0 00-1 1v16a1 1 0 001 1h4M16 17l5-5-5-5M21 12H9"/></svg>',
  bell: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
};

const _rawPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Frap Ties</title>
<link rel="manifest" href="/manifest.json">
<script src="/icons.js"></script>
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Frap Ties">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" href="/icon.png">
<meta name="theme-color" content="#08080b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  /* ---- Surfaces: near-black base, restrained separation between layers ---- */
  --bg:#07070a; --bg-2:#0c0c10; --s1:#151519; --s2:#1c1c22; --s3:#25252c;
  --border:rgba(255,255,255,0.06); --border-2:rgba(255,255,255,0.11);
  /* ---- Accent (single primary accent, used sparingly) ---- */
  --gold:#4f8cff; --gold-bright:#7aabff; --gold-glow:rgba(79,140,255,.18);
  --teal:#2dd4bf; --teal-glow:rgba(45,212,191,.16);
  --crimson:#ef4444; --crimson-glow:rgba(239,68,68,.16);
  --violet:#a78bfa; --violet-bright:#c4b0ff; --violet-glow:rgba(167,139,250,.22);
  --text:#eaeaec; --text-dim:#8f8f98; --text-faint:#57575f;
  --success:#22c55e; --danger:#ef4444; --warn:#eab308;
  /* ---- Spacing scale ---- */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:32px; --sp-8:40px;
  /* ---- Radius scale ---- */
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-xl:20px; --r-full:100px;
  /* ---- Glass recipe (one shared definition, not per-component tuning) ---- */
  --glass-bg:rgba(255,255,255,.045); --glass-bg-elevated:rgba(255,255,255,.065);
  --glass-blur:14px; --glass-sat:1.35;
  --ease-spring:cubic-bezier(.34,1.56,.64,1); --ease-smooth:cubic-bezier(.16,1,.3,1);
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
html,body{height:100%;overscroll-behavior-y:contain;}
body{
  font-family:'Geist',-apple-system,sans-serif;color:var(--text);min-height:100vh;min-height:100dvh;overflow-x:hidden;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  /* Deep purple-violet wash — near-black still dominates, but the colour now has
     real presence at the edges instead of being a faint hint. */
  background:
    radial-gradient(ellipse 100% 65% at 12% -12%, rgba(147,112,255,.16), transparent 58%),
    radial-gradient(ellipse 85% 60% at 105% -5%, rgba(79,140,255,.11), transparent 55%),
    radial-gradient(ellipse 75% 55% at 50% 115%, rgba(45,212,191,.06), transparent 62%),
    radial-gradient(ellipse 60% 40% at 90% 90%, rgba(167,139,250,.06), transparent 60%),
    var(--bg);
  font-size:14px;line-height:1.5;letter-spacing:-.006em;
}
.app-shell{
  position:relative; margin:18px; border-radius:var(--r-xl); overflow:hidden;
  background:
    radial-gradient(ellipse 80% 55% at 8% -5%, rgba(147,112,255,.09), transparent 58%),
    radial-gradient(ellipse 65% 48% at 102% 18%, rgba(79,140,255,.06), transparent 55%),
    radial-gradient(ellipse 55% 40% at 30% 105%, rgba(45,212,191,.035), transparent 60%),
    var(--bg);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04), 0 2px 8px rgba(0,0,0,.3), 0 24px 64px rgba(0,0,0,.5), 0 0 120px rgba(124,92,255,.05);
  min-height:calc(100vh - 36px); min-height:calc(100dvh - 36px);
}
/* Faint animated aurora drifting behind the whole shell — the one place motion
   is ambient rather than reactive, so the app never sits perfectly still. */
.app-shell::before{
  content:''; position:absolute; inset:-20%; z-index:0; pointer-events:none; opacity:.55;
  background:radial-gradient(circle at 30% 20%, rgba(147,112,255,.10), transparent 42%),
             radial-gradient(circle at 78% 68%, rgba(79,140,255,.08), transparent 45%);
  animation:aurora 30s ease-in-out infinite alternate;will-change:transform;
}
@keyframes aurora{
  0%{transform:translate(0,0) scale(1);}
  50%{transform:translate(2%,-3%) scale(1.06);}
  100%{transform:translate(-2%,2%) scale(1);}
}
.app-shell > *{position:relative; z-index:1;}
@media (max-width:640px){ .app-shell{margin:0;border-radius:0;min-height:100vh;min-height:100dvh;} }
h1,h2,h3,.disp{font-family:'Bricolage Grotesque',-apple-system,sans-serif;font-weight:700;letter-spacing:-.02em;}
.mono{font-family:'Geist Mono',monospace;letter-spacing:0;}
.hidden{display:none !important;}
a{color:inherit;text-decoration:none;}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:3px;}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
}

@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes pageIn{from{opacity:0;transform:translateY(14px) scale(.98);}to{opacity:1;transform:translateY(0) scale(1);}}
.page-transition{animation:pageIn .32s cubic-bezier(.16,1,.3,1) both;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
.fade-up{animation:fadeUp .3s ease both;}
.stagger > *{animation:fadeUp .25s ease both;}
.stagger > *:nth-child(1){animation-delay:.01s;} .stagger > *:nth-child(2){animation-delay:.03s;}
.stagger > *:nth-child(3){animation-delay:.05s;} .stagger > *:nth-child(4){animation-delay:.07s;}
.stagger > *:nth-child(5){animation-delay:.09s;} .stagger > *:nth-child(n+6){animation-delay:.1s;}

button{font-family:'Geist',sans-serif;cursor:pointer;border:none;outline:none;transition:transform .12s ease, background .12s ease, color .12s ease, border-color .12s ease, box-shadow .15s ease;}
.panel{
  position:relative; transform:translateZ(0);
  background:linear-gradient(155deg, var(--glass-bg-elevated), var(--glass-bg) 60%);
  backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-sat));
  -webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-sat));
  border:1px solid var(--border-2); border-radius:var(--r-xl);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07), inset 0 0 40px rgba(147,112,255,.025), 0 2px 4px rgba(0,0,0,.3), 0 14px 32px rgba(0,0,0,.35);
  transition:border-color .2s var(--ease-smooth), box-shadow .2s var(--ease-smooth), transform .2s var(--ease-smooth);
}
.panel:hover{border-color:rgba(255,255,255,.16);}
.panel-inset{background:var(--bg-2);border:1px solid var(--border);border-radius:14px;transition:border-color .18s var(--ease-smooth), background .18s var(--ease-smooth);}
.panel-inset.clickable:hover{border-color:var(--border-2);background:var(--s1);}
.script-manager-item{background:var(--bg-2);border:1px solid var(--border);border-radius:14px;transition:border-color .15s ease, background .15s ease;}
.script-manager-item:active{transform:scale(.99);background:var(--s2);}
.btn{padding:12px 22px;border-radius:100px;font-weight:600;font-size:13.5px;background:var(--s3);border:1px solid var(--border-2);color:var(--text);letter-spacing:-.005em;box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.3), 0 4px 10px rgba(0,0,0,.24);transition:transform .28s var(--ease-spring), background .12s ease, box-shadow .15s ease;}
.btn:hover{background:#323240;border-color:rgba(255,255,255,.26);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 2px 4px rgba(0,0,0,.32), 0 8px 18px rgba(0,0,0,.3);}
.btn:active{transform:translateY(1px) scale(.98);box-shadow:inset 0 1px 3px rgba(0,0,0,.3);}
.btn-gold{position:relative;overflow:hidden;background:linear-gradient(135deg,var(--violet-bright),var(--gold-bright) 55%,var(--gold));color:#fff;border:none;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.3), 0 2px 4px rgba(0,0,0,.25), 0 8px 22px rgba(124,92,255,.38);}
.btn-gold::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 48%,transparent 66%);transform:translateX(-120%);transition:transform .55s var(--ease-smooth);}
.btn-gold:hover::after{transform:translateX(120%);}
.btn-gold:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.35), 0 3px 6px rgba(0,0,0,.28), 0 12px 30px rgba(124,92,255,.48);}
.btn-gold:active{box-shadow:inset 0 2px 4px rgba(0,0,0,.25);}
.btn-teal{background:linear-gradient(180deg,#3ee0cf,var(--teal));color:#04211c;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(45,212,191,.25);}
.btn-danger{background:transparent;border:1px solid rgba(239,68,68,.35);color:var(--danger);}
.btn-danger:hover{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.5);}
.btn-ghost{background:transparent;border:1px solid var(--border-2);color:var(--text-dim);box-shadow:none;}
.btn-ghost:hover{color:var(--text);border-color:rgba(255,255,255,.26);}
.btn-block{width:100%;}
.btn-sm{padding:8px 14px;font-size:12px;border-radius:8px;}
input,select,textarea{width:100%;padding:12px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:16px;outline:none;font-family:inherit;-webkit-appearance:none;appearance:none;transition:border-color .12s ease, box-shadow .12s ease;}
/* A real on/off switch, not a native checkbox — native checkboxes render as an
   ambiguous unstyled ring on dark backgrounds with no clear on/off signal. Applied
   via the .toggle-switch class on any checkbox used as a toggle. */
input.toggle-switch{width:44px;height:26px;padding:0;border-radius:100px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.14);position:relative;cursor:pointer;flex-shrink:0;transition:background .2s ease, border-color .2s ease;}
input.toggle-switch::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:transform .2s cubic-bezier(.34,1.56,.64,1);}
input.toggle-switch:checked{background:var(--success);border-color:transparent;}
input.toggle-switch:checked::after{transform:translateX(18px);}
input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-glow);}
label{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:7px;font-weight:600;}
.field{margin-bottom:15px;}
.badge{position:relative;padding:5px 11px 5px 9px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;border-radius:100px;line-height:1.3;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(6px);transition:transform .18s var(--ease-spring), box-shadow .18s ease;}
.badge:hover{transform:translateY(-1px);}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;box-shadow:0 0 7px currentColor, 0 0 1px currentColor;}
.badge-ic{display:none;}
/* One recipe, applied consistently: translucent tint + full-saturation dot/text, not a
   solid alert-colored slab. "Live" states get a genuine pulsing dot — the only ones
   that move, so motion still means something when you see it. */
.badge.not_called{background:rgba(190,190,200,.09);color:#c6c6d2;border-color:rgba(190,190,200,.16);}
.badge.calling,.badge.active_call,.badge.ringing,.badge.in-progress{background:rgba(79,140,255,.14);color:var(--gold-bright);border-color:rgba(79,140,255,.3);}
.badge.calling::before,.badge.active_call::before,.badge.ringing::before,.badge.in-progress::before{animation:badgeDotPulse 1.6s ease-in-out infinite;}
@keyframes badgeDotPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.72);}}
.badge.call_ended{background:rgba(167,139,250,.13);color:var(--violet-bright);border-color:rgba(167,139,250,.28);}
.badge.successful_call,.badge.completed{background:rgba(34,197,94,.14);color:#5eeaa0;border-color:rgba(34,197,94,.3);}
.badge.ready_for_finishing,.badge.assigned_to_finisher{background:rgba(45,212,191,.14);color:#5eeadb;border-color:rgba(45,212,191,.3);}
.badge.failed,.badge.missed,.badge.no-answer{background:rgba(239,68,68,.14);color:#ff8f8a;border-color:rgba(239,68,68,.3);}
.badge.cancelled,.badge.chopped_previously{background:rgba(160,160,168,.09);color:#a6a6b0;border-color:rgba(160,160,168,.16);}
.badge.requires_review{background:rgba(245,158,11,.15);color:#ffc266;border-color:rgba(245,158,11,.32);}
.badge.admin{background:rgba(239,68,68,.14);color:#ff8f8a;border-color:rgba(239,68,68,.3);}
.badge.caller{background:rgba(79,140,255,.14);color:var(--gold-bright);border-color:rgba(79,140,255,.3);}
.badge.finisher{background:rgba(45,212,191,.14);color:#5eeadb;border-color:rgba(45,212,191,.3);}
.badge.important{background:rgba(79,140,255,.14);color:var(--gold-bright);border-color:rgba(79,140,255,.3);}
.badge.voicemail,.badge.no_answer,.badge.hung_up,.badge.busy{background:rgba(190,190,200,.09);color:#c6c6d2;border-color:rgba(190,190,200,.16);}
.badge.callback_requested{background:rgba(167,139,250,.13);color:var(--violet-bright);border-color:rgba(167,139,250,.28);}

/* icons (inline SVG line-icon set) */
.ic{width:17px;height:17px;display:inline-block;vertical-align:-3px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;}

/* ---------- Login ---------- */
#loginScreen{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;}
.login-card{width:100%;max-width:380px;padding:48px 36px;text-align:center;position:relative;box-shadow:0 2px 4px rgba(0,0,0,.3), 0 16px 48px rgba(0,0,0,.4);}
.crest{width:52px;height:52px;margin:0 auto 22px;border-radius:16px;background:var(--gold);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(79,140,255,.3);overflow:hidden;}
.crest svg{width:22px;height:22px;stroke:#fff;}
.login-title{font-size:27px;color:var(--text);margin-bottom:6px;font-weight:800;letter-spacing:-.025em;font-family:'Bricolage Grotesque',sans-serif;}
.login-sub{font-size:14px;margin-bottom:32px;color:var(--text-dim);}
.pin-dots{display:flex;justify-content:center;gap:16px;margin-bottom:32px;}
.pin-dot{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--border-2);transition:all .15s;}
.pin-dot.filled{background:var(--gold);border-color:var(--gold);transform:scale(1.15);}
.pin-dot.error{border-color:var(--danger);animation:shake .4s;}
@keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
.keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.key{aspect-ratio:1;border-radius:18px;font-size:21px;font-weight:600;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'Geist Mono',monospace;transition:all .1s ease;}
.key:hover{background:var(--s3);border-color:var(--border-2);}
.key:active{transform:scale(.93);background:var(--gold);color:#fff;}
.key.wide{font-size:12px;color:var(--text-dim);}
.login-error{color:var(--danger);font-size:12.5px;margin-top:12px;min-height:16px;}

/* ---------- Shell layout ---------- */
.topbar{position:sticky;top:0;z-index:60;display:flex;justify-content:space-between;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 22px 16px;background:linear-gradient(180deg, rgba(147,112,255,.05), rgba(255,255,255,.025));backdrop-filter:blur(12px) saturate(1.4);-webkit-backdrop-filter:blur(12px) saturate(1.4);border-bottom:1px solid rgba(255,255,255,.09);}
.brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15.5px;display:flex;align-items:center;gap:10px;letter-spacing:-.02em;}
.brand-mark{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));position:relative;flex-shrink:0;overflow:hidden;box-shadow:0 2px 10px rgba(124,92,255,.4);}
.topbar-actions{display:flex;gap:8px;align-items:center;}
.icon-btn{width:38px;height:38px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;position:relative;color:var(--text-dim);transition:transform .18s var(--ease-spring), color .15s ease, border-color .15s ease, background .15s ease;}
.icon-btn:hover{transform:scale(1.08) rotate(-6deg);color:var(--text);border-color:var(--violet-glow);box-shadow:0 0 0 3px rgba(167,139,250,.08);}
.icon-btn:active{transform:scale(.92);}
.clock-toggle{display:flex;align-items:center;gap:8px;padding:9px 16px 9px 12px;border-radius:100px;font-size:12.5px;font-weight:700;font-family:'Geist Mono',monospace;letter-spacing:-.01em;background:rgba(255,255,255,.05);border:1px solid var(--border-2);color:var(--text-dim);transition:background .15s ease, color .15s ease, border-color .15s ease, transform .12s ease;}
.clock-toggle:active{transform:scale(.96);}
.clock-toggle .clock-dot{width:8px;height:8px;border-radius:50%;background:var(--text-faint);flex-shrink:0;transition:background .15s ease, box-shadow .15s ease;}
.clock-toggle.on{background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.35);color:var(--success);}
.clock-toggle.on .clock-dot{background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 1.8s ease-out infinite;}
.icon-btn:hover{color:var(--text);border-color:var(--border-2);background:var(--s3);}
.icon-btn .dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--crimson);animation:bellPulse 1.6s ease-in-out infinite;}
@keyframes bellPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.6);}50%{box-shadow:0 0 0 5px rgba(239,68,68,0);}}

/* Admin: sidebar */
.admin-shell{display:flex;min-height:100vh;min-height:100dvh;}
.admin-sidebar{width:236px;flex-shrink:0;background:linear-gradient(180deg, rgba(147,112,255,.035), rgba(255,255,255,.015));backdrop-filter:blur(12px) saturate(1.35);-webkit-backdrop-filter:blur(12px) saturate(1.35);border-right:1px solid rgba(255,255,255,.09);padding:20px 14px;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.side-link{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:var(--r-sm);font-size:13px;font-weight:500;color:var(--text-dim);cursor:pointer;margin-bottom:1px;position:relative;transition:background .15s ease, color .15s ease, padding-left .2s cubic-bezier(.34,1.56,.64,1);}
.side-link:hover{padding-left:16px;color:var(--text);background:rgba(255,255,255,.03);}
.side-link .ic{transition:transform .25s cubic-bezier(.34,1.56,.64,1);}
.side-link:hover .ic{transform:scale(1.15) rotate(-4deg);}
.side-link.active .ic{animation:iconPop .4s cubic-bezier(.34,1.56,.64,1);}
@keyframes iconPop{0%{transform:scale(.7);}60%{transform:scale(1.25);}100%{transform:scale(1);}}
.side-link:hover{background:var(--s2);color:var(--text);}
.side-link.active{background:linear-gradient(135deg,#fff,#f1ecff);color:#0a0a0c;font-weight:600;box-shadow:0 2px 12px rgba(124,92,255,.22);}
.side-link.active .ic{color:#0a0a0c;}
.side-link .ic{flex-shrink:0;color:var(--text-faint);}
.side-sec{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:600;margin:18px 10px 8px;}
.admin-main{flex:1;min-width:0;}
.admin-content{max-width:1180px;margin:0 auto;padding:32px 32px 72px;}

/* Caller/Finisher: bottom nav */
.staff-body{max-width:600px;margin:0 auto;padding:20px 16px 108px;}
.bottom-nav{position:fixed;bottom:14px;left:14px;right:14px;z-index:70;display:flex;gap:2px;background:rgba(255,255,255,.055);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:6px;box-shadow:0 2px 4px rgba(0,0,0,.3), 0 16px 36px rgba(0,0,0,.4);padding-bottom:calc(6px + env(safe-area-inset-bottom));}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px;border-radius:16px;background:transparent;color:var(--text-faint);font-size:9.5px;font-weight:600;position:relative;transition:background .15s ease, color .15s ease;}
.nav-btn.active{color:#fff;background:var(--gold);box-shadow:0 4px 12px rgba(79,140,255,.35);}
.nav-btn:active{transform:scale(.94);}
.nav-badge{position:absolute;top:2px;right:24%;width:7px;height:7px;border-radius:50%;background:var(--crimson);}

.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;}
.stat-box{padding:18px 20px;border-radius:var(--r-lg);transition:transform .3s var(--ease-spring), border-color .2s ease, box-shadow .3s var(--ease-smooth);}
.stat-box:hover{transform:translateY(-3px);border-color:var(--violet-glow);}
.stat-box .num{font-size:29px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.03em;line-height:1.1;}
.stat-box .lbl{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;margin-top:5px;font-weight:600;}
.stat-box.accent{border-color:var(--gold-glow);}
/* ---- Stat tile v2: icon chip + number, used on the caller home screen ---- */
.stat-tile{padding:16px 14px;border-radius:16px;position:relative;overflow:hidden;transition:transform .25s var(--ease-spring);}
.stat-tile:active{transform:scale(.97);}
.icon-chip{width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
.stat-tile .icon-chip{margin-bottom:10px;}
.stat-tile .num{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:800;letter-spacing:-.03em;line-height:1;}
.stat-tile .lbl{font-size:10px;color:var(--text-faint);font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin-top:4px;}
.section-title{font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;margin:28px 0 14px;font-weight:600;}
.p{padding:24px;margin-bottom:18px;}

table{width:100%;border-collapse:collapse;font-size:13px;}
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
/* ---- Lead Vault: a genuine two-pane workspace, not a stack of generic panels ---- */
.vault-workspace{display:flex;gap:0;align-items:flex-start;background:linear-gradient(155deg, var(--glass-bg-elevated), var(--glass-bg) 60%);backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-sat));-webkit-backdrop-filter:blur(var(--glass-blur)) saturate(var(--glass-sat));border:1px solid var(--border-2);border-radius:var(--r-xl);box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 2px 4px rgba(0,0,0,.3), 0 14px 32px rgba(0,0,0,.35);overflow:hidden;min-height:520px;}
.vault-rail{width:240px;flex-shrink:0;border-right:1px solid var(--border);padding:var(--sp-5);display:flex;flex-direction:column;gap:var(--sp-5);background:rgba(0,0,0,.14);}
.vault-rail-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;letter-spacing:-.01em;}
.vault-rail-sub{font-size:11.5px;color:var(--text-dim);line-height:1.6;margin-top:6px;}
.vault-nav{display:flex;flex-direction:column;gap:2px;}
.vault-nav-item{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;padding:9px 10px;border-radius:var(--r-md);background:transparent;color:var(--text-dim);font-size:12.5px;font-weight:600;transition:background .12s ease, color .12s ease;}
.vault-nav-item:hover{background:rgba(255,255,255,.04);color:var(--text);}
.vault-nav-item.active{background:var(--gold);color:#fff;box-shadow:0 2px 8px rgba(79,140,255,.3);}
.vault-nav-count{font-family:'Geist Mono',monospace;font-size:11px;opacity:.85;}
.vault-rail-actions{padding-top:var(--sp-4);border-top:1px solid var(--border);}
.vault-field-label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;font-weight:700;display:block;margin-bottom:8px;}
.vault-main{flex:1;min-width:0;padding:var(--sp-5) var(--sp-6);}
.vault-main-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--sp-4);}
.vault-main-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:17px;letter-spacing:-.01em;}
.vault-main-count{font-size:11.5px;color:var(--text-dim);margin-top:2px;}
.vault-empty{padding:40px 20px;text-align:center;color:var(--text-dim);font-size:13px;}
@media (max-width:860px){
  .vault-workspace{flex-direction:column;}
  .vault-rail{width:100%;border-right:none;border-bottom:1px solid var(--border);}
  .vault-nav{flex-direction:row;flex-wrap:wrap;}
  .vault-nav-item{width:auto;}
}
.table-scroll table{min-width:640px;}
@media (max-width:640px){
  .table-scroll::after{content:'← swipe to see more →';display:block;text-align:center;font-size:10px;color:var(--text-faint);padding:6px 0 0;}
}
th{text-align:left;padding:11px 14px;color:var(--text-faint);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);}
td{padding:13px 14px;border-bottom:1px solid var(--border);}
tr:hover td{background:rgba(255,255,255,.012);}
tr.clickable{cursor:pointer;transition:background .12s ease;}
tr.clickable:hover{background:rgba(255,255,255,.03);}
tr.clickable:active{background:rgba(255,255,255,.05);}
.offer-card,.panel-inset.clickable{transition:transform .12s ease, box-shadow .12s ease;}
.offer-card:active{transform:scale(.985);}
.pin-display{font-family:'Geist Mono',monospace;font-size:14px;font-weight:700;color:var(--gold-bright);letter-spacing:1.5px;}
.blur-phone{cursor:pointer;filter:blur(5px);transition:filter .2s;user-select:none;}
.blur-phone.revealed{filter:blur(0);}
.blur-phone::after{content:' (tap to reveal)';font-size:9px;filter:none;opacity:.5;text-transform:uppercase;letter-spacing:.4px;}
.row-flex{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;}
.row-flex .field{flex:1;min-width:130px;margin-bottom:0;}
.new-pin-banner{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-radius:12px;background:rgba(201,161,94,.07);border:1px solid var(--gold-glow);margin-top:14px;}

/* announcement banner */
.announcement{padding:15px 17px;border-radius:12px;margin-bottom:9px;display:flex;gap:11px;align-items:flex-start;}
.announcement.important{background:rgba(79,140,255,.08);border:1px solid var(--gold-glow);position:relative;overflow:hidden;}
.announcement.important::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold);}
.announcement .txt{font-size:13px;line-height:1.55;color:var(--text);}
.announcement .meta{font-size:10.5px;color:var(--text-faint);margin-top:5px;}

/* radar / waiting */
.radar-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 20px;text-align:center;}
.radar{position:relative;width:130px;height:130px;margin-bottom:22px;}
.radar-ring{position:absolute;inset:0;border-radius:50%;border:1px solid var(--border-2);}
.radar-ring:nth-child(2){inset:17px;} .radar-ring:nth-child(3){inset:34px;}
.radar-sweep{position:absolute;inset:0;border-radius:50%;overflow:hidden;animation:spin 3.2s linear infinite;}
.radar-sweep::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg, transparent 0deg, transparent 320deg, var(--gold) 355deg, transparent 360deg);border-radius:50%;opacity:.7;}
@keyframes spin{to{transform:rotate(360deg);}}
.radar-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:var(--gold);}
.waiting-title{font-size:18px;margin-bottom:5px;}
.waiting-sub{color:var(--text-dim);font-size:12.5px;}

/* offer / call cards */
.offer-card{position:relative;padding:24px;border-radius:20px;margin-bottom:14px;overflow:hidden;background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 2px 4px rgba(0,0,0,.3), 0 12px 28px rgba(0,0,0,.3);}
.pulse-dot{position:absolute;top:20px;right:20px;width:9px;height:9px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 1.8s ease-out infinite;}
.offer-label{font-size:10.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px;}
.offer-name{font-size:20px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;margin-bottom:4px;}
.offer-meta{color:var(--text-dim);font-size:12.5px;margin-bottom:18px;}
.offer-actions{display:flex;gap:10px;}
.live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-left:6px;position:relative;top:-2px;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:liveDotPulse 1.8s ease-out infinite;}
.caller-id-pop{background:linear-gradient(180deg,rgba(79,140,255,.16),rgba(79,140,255,.06));border:1px solid var(--gold-glow);border-radius:20px;padding:20px 22px;margin-bottom:14px;box-shadow:0 0 0 1px var(--gold-glow), 0 12px 32px rgba(79,140,255,.25);transition:opacity .4s ease, max-height .4s ease, margin .4s ease, padding .4s ease;overflow:hidden;}
.caller-id-pop .pop-badge{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.6px;color:var(--gold-bright);text-transform:uppercase;margin-bottom:8px;}
.caller-id-pop .pop-name{font-size:19px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;margin-bottom:4px;}
.caller-id-pop .pop-meta{font-size:13px;color:var(--text-dim);margin-bottom:10px;}
.caller-id-pop .pop-notes{font-size:12.5px;color:var(--text-dim);background:rgba(255,255,255,.04);border-radius:10px;padding:8px 10px;margin-bottom:12px;}
@keyframes liveDotPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%{box-shadow:0 0 0 8px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}
.pulse-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;animation:pulseRing 1.6s cubic-bezier(0,0,.2,1) infinite;}
@keyframes pulseRing{0%{transform:scale(1);opacity:.7;}100%{transform:scale(3);opacity:0;}}
.offer-actions .btn{flex:1;padding:14px;font-size:14px;}
.offer-actions .btn-gold{flex:2;font-weight:700;}
.offer-actions .btn-ghost{background:rgba(255,255,255,.03);}

.call-card{padding:24px;background:rgba(255,255,255,.055);}
.call-status-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;}
.call-timer{font-family:'Geist Mono',monospace;font-size:13px;color:var(--text-dim);font-weight:600;}
.info-row{display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-bottom:1px solid var(--border);}
.info-row .k{font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;font-weight:600;}
.info-row .v{font-size:14.5px;font-weight:700;text-align:right;}
.call-action-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0;}
.dial-btn,.oncall-btn,.endcall-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:16px;border-radius:16px;font-size:14px;font-weight:700;letter-spacing:-.005em;transition:transform .28s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 2px 4px rgba(0,0,0,.25), 0 8px 18px rgba(0,0,0,.22);}
.dial-btn:active,.oncall-btn:active,.endcall-btn:active{transform:scale(.96);}
.dial-btn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);color:var(--text);}
.oncall-btn{background:linear-gradient(180deg,#3ee0cf,var(--teal));color:#04211c;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 4px 14px rgba(45,212,191,.3);}
.endcall-btn{background:linear-gradient(180deg,#f97066,var(--danger));color:#fff;border:none;grid-column:1/-1;box-shadow:inset 0 1px 0 rgba(255,255,255,.2), 0 4px 14px rgba(239,68,68,.3);}
.outcome-section{margin-top:16px;display:flex;flex-direction:column;gap:10px;}
.outcome-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
.outcome-grid button{padding:14px 6px;font-size:12.5px;font-weight:700;border-radius:14px;letter-spacing:-.005em;transition:transform .28s cubic-bezier(.34,1.56,.64,1), box-shadow .15s ease;box-shadow:0 2px 4px rgba(0,0,0,.2), 0 6px 14px rgba(0,0,0,.18);}
.outcome-grid button:active{transform:scale(.95);}
.outcome-grid button:not(.win-btn):not(.review-btn):not(.fail-btn){background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:var(--text-dim);box-shadow:none;}
.win-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;font-size:14.5px;font-weight:700;border-radius:16px;background:linear-gradient(180deg,#3ee87f,var(--success));color:#04170a;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 6px 18px rgba(34,197,94,.32);transition:transform .28s cubic-bezier(.34,1.56,.64,1);}
.win-btn:active{transform:scale(.97);}
.win-btn .ic{width:17px;height:17px;}
.review-btn{width:100%;padding:13px;font-size:12.5px;font-weight:700;border-radius:14px;background:rgba(79,140,255,.12);color:var(--gold-bright);border:1px solid rgba(79,140,255,.3);box-shadow:none;transition:transform .2s ease;}
.review-btn:active{transform:scale(.97);}
.fail-btn{width:100%;padding:13px;font-size:12.5px;font-weight:700;border-radius:14px;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.28);box-shadow:none;transition:transform .2s ease;}
.fail-btn:active{transform:scale(.97);}
.scripts-toggle{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);margin-bottom:12px;cursor:pointer;font-size:12.5px;font-weight:700;color:var(--text-dim);transition:background .15s ease;}
.scripts-toggle:active{transform:scale(.98);}
.scripts-panel{max-height:0;overflow:hidden;transition:max-height .3s ease;}
.scripts-panel.open{max-height:400px;overflow-y:auto;margin-bottom:12px;-webkit-overflow-scrolling:touch;}
.script-item{padding:12px 15px;border-radius:10px;background:var(--s2);margin-bottom:7px;}
.script-item .title{font-weight:700;font-size:12.5px;margin-bottom:4px;color:var(--gold-bright);}
.script-item .content{font-size:12.5px;color:var(--text-dim);line-height:1.5;white-space:pre-wrap;}

/* ---- Caller rank emblems — circular badges ---- */
.rank-emblem{position:relative;display:flex;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(160deg,var(--rc2),var(--rc1) 60%);flex-shrink:0;box-shadow:0 0 12px var(--rc1)55;overflow:hidden;}
.rank-emblem::after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 68%);transform:translateX(-120%);animation:emblemSheen 4.5s ease-in-out infinite;}
@keyframes emblemSheen{0%,60%{transform:translateX(-120%);}85%,100%{transform:translateX(120%);}}
.rank-emblem .div{position:relative;z-index:1;line-height:1;}
.rank-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 11px 4px 5px;border-radius:100px;background:rgba(255,255,255,.06);border:1px solid var(--border-2);font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;}
/* ---- Rank-up moment ---- */
.rankup-overlay{position:fixed;inset:0;z-index:300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(5,5,9,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);animation:fadeIn .3s ease both;cursor:pointer;}
.rankup-overlay .big{animation:rankPop .9s var(--ease-spring) both .15s;filter:drop-shadow(0 0 34px var(--rc1));}
@keyframes rankPop{0%{opacity:0;transform:scale(.3) rotate(-14deg);}70%{transform:scale(1.12) rotate(2deg);}100%{opacity:1;transform:scale(1);}}
.rankup-overlay .t1{font-family:'Geist Mono',monospace;font-size:11px;letter-spacing:.5em;text-transform:uppercase;color:var(--violet-bright);animation:fadeUp .5s ease both .4s;}
.rankup-overlay .t2{font-family:'Bricolage Grotesque',sans-serif;font-size:34px;font-weight:800;letter-spacing:-.02em;animation:fadeUp .5s ease both .55s;}
.rankup-overlay .t3{font-size:12.5px;color:var(--text-dim);animation:fadeUp .5s ease both .7s;}
/* ---- Successful call celebration: a brief, satisfying burst — not a full
   rank-up-scale interruption, just enough visual reward to make landing a
   sale feel good, then it gets out of the way in under a second. ---- */
.success-burst{position:fixed;inset:0;z-index:280;display:flex;align-items:center;justify-content:center;pointer-events:none;}
.success-burst .ring{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,rgba(34,197,94,.35) 0%,rgba(34,197,94,0) 70%);animation:successRing .7s cubic-bezier(.16,1,.3,1) both;}
.success-burst .check{position:absolute;width:88px;height:88px;border-radius:50%;background:linear-gradient(160deg,#4ade80,#16a34a);display:flex;align-items:center;justify-content:center;box-shadow:0 0 40px rgba(34,197,94,.5),0 8px 30px rgba(0,0,0,.4);animation:successPop .55s cubic-bezier(.16,1,.3,1) both;overflow:hidden;}
.success-burst .check::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 50%,transparent 68%);transform:translateX(-140%);animation:successSheen .7s ease-out .25s both;}
.success-burst .check svg{width:40px;height:40px;stroke:#fff;stroke-width:3;fill:none;position:relative;z-index:1;}
.success-burst .check svg path{stroke-dasharray:28;stroke-dashoffset:28;animation:successDraw .35s ease-out .2s both;}
@keyframes successRing{0%{transform:scale(.3);opacity:0;}40%{opacity:1;}100%{transform:scale(2.4);opacity:0;}}
@keyframes successPop{0%{transform:scale(.2);opacity:0;}55%{transform:scale(1.08);opacity:1;}100%{transform:scale(1);opacity:1;}}
@keyframes successSheen{0%{transform:translateX(-140%);}100%{transform:translateX(140%);}}
@keyframes successDraw{to{stroke-dashoffset:0;}}
.success-burst.leaving{animation:successFade .3s ease both;}
@keyframes successFade{to{opacity:0;}}
/* ---- Bank picker (admin categories) ---- */
.bank-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:10px;margin-top:14px;}
.bank-card{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--bg-2);border:1px solid var(--border);cursor:pointer;transition:border-color .15s ease, background .15s ease, transform .18s var(--ease-spring);}
.bank-card:hover{border-color:var(--violet-glow);background:var(--s1);transform:translateY(-2px);}
.bank-card img{width:26px;height:26px;border-radius:7px;object-fit:contain;flex-shrink:0;}
.bank-card .bn{font-size:12px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.bank-card.added{border-color:rgba(34,197,94,.4);background:rgba(34,197,94,.07);cursor:default;}
.bank-card.added .bn::after{content:' ✓';color:var(--success);}
/* ---- Import stepper ---- */
.import-steps{display:flex;align-items:center;gap:10px;margin-bottom:18px;}
.import-step{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--text-faint);}
.import-step .n{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border:1px solid var(--border-2);font-size:11px;}
.import-step.on{color:var(--text);}
.import-step.on .n{background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;border:none;box-shadow:0 2px 10px rgba(124,92,255,.35);}
.import-step .bar{width:34px;height:1px;background:var(--border-2);}
/* ---- XP toast: floats up from the bottom the moment XP lands ---- */
.xp-toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%);z-index:200;display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:100px;background:linear-gradient(135deg,rgba(167,139,250,.25),rgba(79,140,255,.2));border:1px solid rgba(167,139,250,.45);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);font-family:'Geist Mono',monospace;font-weight:700;font-size:14px;color:var(--violet-bright);box-shadow:0 8px 30px rgba(124,92,255,.35);animation:xpRise 1.9s cubic-bezier(.16,1,.3,1) both;pointer-events:none;}
@keyframes xpRise{0%{opacity:0;transform:translateX(-50%) translateY(24px) scale(.85);}12%{opacity:1;transform:translateX(-50%) translateY(0) scale(1.04);}20%{transform:translateX(-50%) translateY(0) scale(1);}78%{opacity:1;}100%{opacity:0;transform:translateX(-50%) translateY(-34px) scale(.94);}}
/* ---- Level chip + progress bar, shared by home header and leaderboards ---- */
.lvl-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:100px;background:linear-gradient(135deg,rgba(167,139,250,.2),rgba(79,140,255,.14));border:1px solid rgba(167,139,250,.4);font-size:10px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--violet-bright);}
.xp-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.06);overflow:hidden;position:relative;}
.xp-bar > i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--violet),var(--gold-bright));position:relative;transition:width .8s cubic-bezier(.16,1,.3,1);}
.xp-bar > i::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);animation:xpBarSheen 2.6s ease-in-out infinite;}
@keyframes xpBarSheen{0%{transform:translateX(-100%);}55%,100%{transform:translateX(100%);}}
/* Role picker cards */
.role-card{padding:24px 16px;border-radius:16px;background:rgba(255,255,255,.04);border:2px solid var(--border);cursor:pointer;transition:border-color .18s ease,background .18s ease,transform .18s ease;}
.role-card:hover{border-color:var(--violet-bright);background:rgba(124,92,255,.08);transform:translateY(-2px);}
/* ---- Segmented tabs (This Week / All Time) ---- */
.seg-tabs{display:flex;gap:4px;padding:4px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);width:fit-content;}
.seg-tab{padding:7px 16px;border-radius:100px;font-size:11.5px;font-weight:700;color:var(--text-dim);background:transparent;transition:all .22s var(--ease-smooth);}
.seg-tab.on{background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;box-shadow:0 2px 10px rgba(124,92,255,.35);}
/* ---- Podium: rise-in, glow ring on #1, floating crown ---- */
.podium-slot{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;animation:podiumRise .7s var(--ease-spring) both;}
.podium-slot:nth-child(1){animation-delay:.12s;} .podium-slot:nth-child(3){animation-delay:.2s;}
@keyframes podiumRise{from{opacity:0;transform:translateY(26px);}to{opacity:1;transform:none;}}
.podium-av{position:relative;border-radius:50%;}
.podium-av.first::before{content:'';position:absolute;inset:-5px;border-radius:50%;background:conic-gradient(from 0deg,#fbbf24,#a78bfa,#4f8cff,#fbbf24);animation:ringSpin 3.2s linear infinite;z-index:-1;}
@keyframes ringSpin{to{transform:rotate(360deg);}}
.podium-crown{font-size:16px;animation:crownFloat 2.6s ease-in-out infinite;line-height:1;}
@keyframes crownFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-4px);}}
.podium-bar{width:100%;border-radius:12px 12px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:7px;font-size:15px;font-weight:800;color:rgba(0,0,0,.55);position:relative;overflow:hidden;}
.podium-bar::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.3) 50%,transparent 65%);transform:translateX(-100%);animation:xpBarSheen 3.4s ease-in-out infinite;}
/* ---- Board rows: hover slide, entry stagger, inline progress ---- */
.lb-row{transition:background .18s ease, transform .18s var(--ease-smooth);border-radius:12px;animation:fadeUp .4s var(--ease-smooth) both;}
.lb-row:hover{background:rgba(255,255,255,.035);transform:translateX(3px);}
.lb-row.me{background:linear-gradient(90deg,rgba(167,139,250,.1),transparent 70%);border:1px solid rgba(167,139,250,.2);}
/* ---- Tab hints: one consistent explainer style everywhere ---- */
.tab-hint{display:flex;gap:9px;align-items:flex-start;font-size:12px;color:var(--text-dim);line-height:1.55;padding:11px 14px;border-radius:14px;background:rgba(167,139,250,.06);border:1px solid rgba(167,139,250,.14);margin-bottom:16px;animation:fadeUp .4s var(--ease-smooth) both;}
.tab-hint .ic{width:14px;height:14px;flex-shrink:0;margin-top:2px;color:var(--violet);}
/* ---- Call screen ---- */
.call-lead-name{font-size:24px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;line-height:1.15;}
.call-lead-sub{display:flex;align-items:center;gap:8px;color:var(--text-dim);font-size:13px;margin-top:5px;flex-wrap:wrap;}
.call-timer-chip{display:inline-flex;align-items:center;gap:7px;padding:7px 13px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border-2);font-size:13.5px;font-weight:700;}
.call-timer-chip .tdot{width:7px;height:7px;border-radius:50%;background:var(--success);animation:badgeDotPulse 1.4s ease-in-out infinite;}
.oncall-btn,.win-btn{position:relative;overflow:hidden;}
.oncall-btn::after,.win-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.3) 48%,transparent 66%);transform:translateX(-120%);transition:transform .5s var(--ease-smooth);}
.oncall-btn:hover::after,.win-btn:hover::after{transform:translateX(120%);}
.lb-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border);}
.rank{width:29px;height:29px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12.5px;background:var(--s2);flex-shrink:0;}
.rank.r1{background:#eab308;color:#1c1408;}
.rank.r2{background:#a8a8b0;color:#0a0a0a;}
.rank.r3{background:#b8763f;color:#fff;}
.lb-av{font-size:17px;}
.lb-name{flex:1;font-weight:700;font-size:13px;}
.lb-stats{display:flex;gap:15px;font-size:10.5px;color:var(--text-dim);}
.lb-stats b{color:var(--text);font-size:12.5px;}

/* chat */
.chat-shell{display:flex;flex-direction:column;height:calc(100dvh - 190px);}
.chat-messages{flex:1;overflow-y:auto;padding:6px 2px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}
.chat-msg{display:flex;gap:10px;max-width:85%;}
.chat-msg.own{align-self:flex-end;flex-direction:row-reverse;}
.chat-av{width:32px;height:32px;border-radius:9px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;border:1px solid var(--border);}
.chat-bubble{background:var(--s2);border:1px solid var(--border);border-radius:13px;padding:10px 13px;}
.chat-msg.own .chat-bubble{background:rgba(79,140,255,.1);border-color:var(--gold-glow);}
.chat-sender{font-size:11px;font-weight:700;color:var(--gold-bright);margin-bottom:2px;}
.chat-text{font-size:13.5px;line-height:1.5;}
.chat-time{font-size:9.5px;color:var(--text-faint);margin-top:4px;}
.chat-input-row{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);}
.chat-input-row input{flex:1;}
.presence-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 12px;}
.presence-chip{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:20px;background:var(--s2);border:1px solid var(--border);font-size:11px;white-space:nowrap;flex-shrink:0;}
.presence-chip .dot{width:6px;height:6px;border-radius:50%;background:var(--text-faint);}
.presence-chip.online .dot{background:var(--success);}

/* import preview */
.parse-row{display:grid;grid-template-columns:1.2fr 1fr 1.2fr auto;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);font-size:12.5px;align-items:center;}
.parse-row .miss{color:var(--text-faint);font-style:italic;}
.dup-warn{font-size:10px;color:var(--gold-bright);background:rgba(201,161,94,.12);padding:3px 8px;border-radius:6px;white-space:nowrap;}

/* timeline */
.timeline{position:relative;padding-left:22px;}
.timeline::before{content:'';position:absolute;left:5px;top:4px;bottom:4px;width:1px;background:var(--border-2);}
.timeline-item{position:relative;padding-bottom:18px;}
.timeline-item::before{content:'';position:absolute;left:-22px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--gold);}
.timeline-item .ev{font-size:13px;font-weight:600;}
.timeline-item .meta{font-size:11px;color:var(--text-dim);margin-top:2px;}

/* avatar grid */
.avatar-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0 20px;}
.avatar-opt{aspect-ratio:1;border-radius:10px;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:19px;}
.avatar-opt.sel{border-color:var(--gold);background:rgba(201,161,94,.1);}

.empty-state{padding:60px 20px;text-align:center;color:var(--text-dim);}
.empty-state .ic{width:32px;height:32px;opacity:.4;margin-bottom:14px;}
.loading-shimmer{height:60px;border-radius:var(--r-lg);background:linear-gradient(90deg, var(--s1) 25%, var(--s2) 50%, var(--s1) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:var(--sp-3);}
.empty-state{text-align:center;padding:var(--sp-8) var(--sp-5);color:var(--text-dim);}
.empty-state .ic{color:var(--text-faint);}
.empty-state .empty-title{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:15px;color:var(--text);margin-bottom:6px;}
.empty-state .empty-sub{font-size:12.5px;color:var(--text-dim);line-height:1.6;max-width:340px;margin:0 auto;}
.notif-panel{top:64px;right:16px;width:340px;max-height:70vh;}
@media (max-width:640px){
  .notif-panel{top:auto !important;right:0 !important;left:0;bottom:0;width:100%;max-height:75vh;border-radius:20px 20px 0 0;padding-bottom:env(safe-area-inset-bottom);}
}

@media (max-width:860px){
  .admin-shell{flex-direction:column;}
  .admin-sidebar{width:100%;height:auto;position:sticky;top:0;display:flex;overflow-x:auto;padding:10px;gap:4px;border-right:none;border-bottom:1px solid var(--border);}
  .side-link{white-space:nowrap;margin-bottom:0;}
  .side-sec{display:none;}
  .admin-content{padding:16px 12px 60px;}
}
</style>
</head>
<body>
<div class="app-shell">
<!-- ===== LOGIN ===== -->
<div id="loginScreen">
  <div class="login-card panel fade-up">
    <div class="crest" id="loginCrest"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div>
    <div class="login-title" id="loginTitle">ClearPanel</div>
    <div class="login-sub" id="loginSub">Enter your PIN</div>
    <div class="pin-dots" id="pinDots"><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>
    <div class="keypad" id="keypad">
      <button class="key" data-k="1">1</button><button class="key" data-k="2">2</button><button class="key" data-k="3">3</button>
      <button class="key" data-k="4">4</button><button class="key" data-k="5">5</button><button class="key" data-k="6">6</button>
      <button class="key" data-k="7">7</button><button class="key" data-k="8">8</button><button class="key" data-k="9">9</button>
      <button class="key wide" data-k="clear">Clear</button><button class="key" data-k="0">0</button><button class="key wide" data-k="back">⌫</button>
    </div>
    <div class="login-error" id="loginError"></div>
    <div style="margin-top:14px;">
      <a href="javascript:void(0)" onclick="showFindPanel()" style="font-size:11.5px;color:var(--text-faint);text-decoration:underline;">Forgot which panel you're on?</a>
    </div>
    <div style="margin-top:18px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;">
      <a href="https://t.me/+M-aK0jz4wDI5Nzdh" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-faint);text-decoration:none;padding:5px 12px;border-radius:100px;background:rgba(255,255,255,.04);border:1px solid var(--border);transition:color .15s;"><span>📣</span>Updates channel</a>
      <a href="https://t.me/clearpanelotpbot" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--text-faint);text-decoration:none;padding:5px 12px;border-radius:100px;background:rgba(255,255,255,.04);border:1px solid var(--border);transition:color .15s;"><span>🤖</span>@clearpanelotpbot</a>
    </div>
  </div>
</div>
<div id="findPanelGate" class="hidden" style="position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,5,9,.85);backdrop-filter:blur(10px);">
  <div class="panel p" style="max-width:380px;width:100%;text-align:center;">
    <h2 style="font-size:18px;margin-bottom:8px;">Find Your Panel</h2>
    <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-bottom:18px;">Enter your username and we'll point you to the right panel — no PIN needed for this part.</p>
    <input id="findPanelInput" placeholder="your username" maxlength="20" style="text-align:center;margin-bottom:10px;" onkeydown="if(event.key==='Enter') findMyPanel()" />
    <button class="btn btn-gold btn-block" onclick="findMyPanel()">Find My Panel</button>
    <div id="findPanelResult" style="font-size:13px;margin-top:14px;"></div>
    <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="document.getElementById('findPanelGate').classList.add('hidden')">Close</button>
  </div>
</div>

<!-- ===== ADMIN SHELL ===== -->
<div id="adminApp" class="hidden">
  <div class="admin-shell">
    <div class="admin-sidebar">
      <div class="side-link active" data-tab="dashboard" onclick="switchAdminTab('dashboard')">${ICONS_SVG.dashboard} Dashboard</div>
      <div class="side-sec">Leads</div>
      <div class="side-link" data-tab="leads" onclick="switchAdminTab('leads')">${ICONS_SVG.list} All Leads</div>
      <div class="side-link" data-tab="import" onclick="switchAdminTab('import')">${ICONS_SVG.upload} Import</div>
      <div class="side-link" data-tab="vault" onclick="switchAdminTab('vault')">${ICONS_SVG.flag} Lead Vault</div>
      <div class="side-link" data-tab="duplicates" onclick="switchAdminTab('duplicates')">${ICONS_SVG.warn} Duplicates</div>
      <div class="side-link" data-tab="finishing" onclick="switchAdminTab('finishing')">${ICONS_SVG.flag} Finishing Queue</div>
      <div class="side-sec">Team</div>
      <div class="side-link" data-tab="roster" onclick="switchAdminTab('roster')">${ICONS_SVG.users} Roster</div>
      <div class="side-link" data-tab="leaderboard" onclick="switchAdminTab('leaderboard')">${ICONS_SVG.target} Leaderboard</div>
      <div class="side-link" data-tab="chat" onclick="switchAdminTab('chat')">${ICONS_SVG.chat} Team Chat</div>
      <div class="side-sec">Broadcast</div>
      <div class="side-link" data-tab="announcements" onclick="switchAdminTab('announcements')">${ICONS_SVG.megaphone} Announcements</div>
      <div class="side-link" data-tab="goal" onclick="switchAdminTab('goal')">${ICONS_SVG.target} Team Goal</div>
      <div class="side-sec">Configuration</div>
      <div class="side-link" data-tab="scripts" onclick="switchAdminTab('scripts')">${ICONS_SVG.doc} Scripts</div>
      <div class="side-link" data-tab="template" onclick="switchAdminTab('template')">${ICONS_SVG.doc} Call Template</div>
      <div class="side-link" data-tab="categories" onclick="switchAdminTab('categories')">${ICONS_SVG.flag} Lead Categories</div>
      <div class="side-link" data-tab="branding" onclick="switchAdminTab('branding')">${ICONS_SVG.gear} Branding</div>
      <div class="side-link" data-tab="telephony" onclick="switchAdminTab('telephony')">${ICONS_SVG.bell} Call Routing</div>
      <div class="side-link" onclick="logout()" style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">${ICONS_SVG.exit} Exit</div>
    </div>
    <div class="admin-main">
      <div class="topbar">
        <div class="brand"><div class="brand-mark"></div>ClearPanel <span class="mono" style="color:var(--text-faint);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin-left:6px;display:inline-flex;align-items:center;gap:5px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 2.2s ease-out infinite;"></span>Control Room</span></div>
        <div class="topbar-actions">
          <div class="icon-btn" onclick="toggleNotifPanel()" id="notifBtn">${ICONS_SVG.bell}</div>
        </div>
      </div>
      <div class="admin-content" id="adminContent"></div>
    </div>
  </div>
</div>

<!-- ===== STAFF SHELL (caller / finisher) ===== -->
<div id="staffApp" class="hidden">
  <div class="topbar">
    <div class="brand"><div class="brand-mark"></div>ClearPanel</div>
    <div class="topbar-actions">
      <div class="icon-btn" onclick="toggleNotifPanel()" id="notifBtnStaff">${ICONS_SVG.bell}</div>
      <button class="clock-toggle" id="clockBtn" onclick="toggleClock()"><span class="clock-dot"></span><span id="clockLabel">Clock In</span></button>
    </div>
  </div>
  <div class="staff-body" id="staffBody"></div>
  <div class="bottom-nav" id="staffNav"></div>
</div>
</div>

<div id="notifBackdrop" class="hidden" onclick="closeNotifPanel()" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:199;"></div>
<div id="notifPanel" class="hidden notif-panel" style="position:fixed;z-index:200;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>

<script src="/js/main.js"></script>
<script src="/js/admin.js"></script>
<script src="/js/staff.js"></script>
<script>
// Shown once per device, the first time a caller/finisher logs in — walks them
// through adding the app to their home screen so push notifications actually work.
// Platform-specific since the steps genuinely differ (iOS Safari has no install
// prompt API at all, unlike Android/desktop Chrome).
function checkFirstLoginTutorial() {
  if (!me || me.role === 'admin') return;
  const seenKey = 'tutorial_seen_' + me.id;
  if (localStorage.getItem(seenKey)) return;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) { localStorage.setItem(seenKey, '1'); return; }

  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  let steps;
  if (isIos) {
    steps = ['Tap the Share icon at the bottom of Safari (the square with an arrow)', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" in the top right'];
  } else if (isAndroid) {
    steps = ['Tap the ⋮ menu in the top right of Chrome', 'Tap "Add to Home screen" or "Install app"', 'Confirm — it now works like a real app'];
  } else {
    steps = ['Look for an install icon in your browser\\'s address bar', 'Click it and confirm the install', 'The app opens in its own window from now on'];
  }
  const modal = document.createElement('div');
  modal.id = 'firstLoginTutorial';
  modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = \`<div class="panel p" style="max-width:380px;text-align:center;">
    <div style="font-size:15px;font-weight:700;margin-bottom:6px;">One quick thing before you start</div>
    <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;line-height:1.6;">Add this to your home screen so it works like a real app and you get proper notifications for new leads.</p>
    <div style="text-align:left;margin-bottom:18px;">\${steps.map((s, i) => '<div style="display:flex;gap:10px;margin-bottom:10px;"><div style="width:22px;height:22px;border-radius:50%;background:var(--gold);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.4;padding-top:2px;">' + s + '</div></div>').join('')}</div>
    <button class="btn btn-gold btn-block" onclick="dismissFirstLoginTutorial()">Got It</button>
    <button class="btn btn-ghost btn-sm btn-block" style="margin-top:8px;" onclick="dismissFirstLoginTutorial()">Skip for now</button>
  </div>\`;
  document.body.appendChild(modal);
}
function dismissFirstLoginTutorial() {
  if (me) localStorage.setItem('tutorial_seen_' + me.id, '1');
  const modal = document.getElementById('firstLoginTutorial');
  if (modal) modal.remove();
  if (me && me.role !== 'admin') promptForPushAfterTutorial();
}
// Right after the home-screen tutorial, while they're already paying attention -
// asking cold from a random Profile tab gets ignored, asking right here gets seen.
async function promptForPushAfterTutorial() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const existing = reg && await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed, nothing to do
    if (typeof togglePush === 'function') await togglePush();
  } catch {}
}

// Mobile fix: tapping the Dial button backgrounds the app (native phone UI takes
// over), which suspends JS timers and SSE. Force a fresh state pull the instant the
// page becomes visible again, so a stale "still on this call" card never lingers.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !me) return;
  if (me.role === 'admin') {
    if (typeof currentAdminTab !== 'undefined') renderAdminTab(currentAdminTab);
  } else if (typeof staffTab !== 'undefined') {
    if (staffTab === 'queue') renderStaffQueue();
    else if (staffTab === 'home') renderStaffHome();
  }
  // Always force a fresh SSE connection on returning to the foreground - mobile
  // Safari in particular can leave a connection in a state that still LOOKS open
  // (readyState never flips to CLOSED) while it's actually dead, so checking
  // readyState alone isn't reliable enough to catch every case.
  if (typeof connectEvents === 'function') connectEvents();
});

// A stored session from one tenant's URL must never silently carry over to a
// different tenant's URL on the same domain — localStorage is scoped by
// origin only, not by path, so /goclearpanel and / (or any other tenant's
// slug) all share the exact same storage. Without this check, a browser
// that had previously logged into one panel would stay authenticated as
// that SAME user (and see that user's real, correct data) even while
// displaying a completely different tenant's URL - not a server-side leak,
// since every API call really was for the stored session's genuine tenant,
// but indistinguishable from one at a glance.
const _cpPageTenantId = document.getElementById('cp-tenant-id')?.content || '';
if (me && String(me.tenant_id ?? '') !== String(_cpPageTenantId)) {
  localStorage.removeItem('dispatch_me');
  me = null;
}

if (me) enterApp();

// Branding is now handled by applyBranding() + server-side name injection.
// The slug is read from the cp-slug meta tag.
</script>
</body>
</html>`;
// Harden the page HTML: every </ inside a <script> block (other than the
// closing </script> tag itself) is replaced with <\/ which the JS engine
// treats as </  at runtime, while the HTML parser never sees a closing tag.
// Simple global approach: replace all </ then restore </script>.
// All JS is now served as external files (/js/main.js, /js/admin.js, /js/staff.js)
// so there are no inline script blocks that could conflict with HTML parsing.
// The _safeScripts post-processor is no longer needed.
export const page = _rawPage;

