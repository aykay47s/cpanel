// Master panel: ClearPanel operator's cross-tenant view. Behind a password gate
// (with brute-force lockout) that only the operator knows. Once inside they
// see every tenant, every caller, Telegram verification status, and can DM
// via the master bot to any audience.
export const MASTER_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClearPanel · Master</title>
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Bricolage+Grotesque:wght@700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#07070a; --bg-2:#0d0d12; --s1:#12121a; --s2:#1a1a24; --s3:#232330;
    --text:#f2f2f4; --text-dim:#a0a0aa; --text-faint:#66666e;
    --violet:#7c5cff; --violet-bright:#a78bfa; --gold:#4f8cff; --gold-bright:#7aabff;
    --success:#22c55e; --danger:#ef4444; --amber:#f5c744;
    --border:rgba(255,255,255,.08); --border-2:rgba(255,255,255,.14);
    --ease-smooth:cubic-bezier(.16,1,.3,1);
  }
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Geist',-apple-system,sans-serif;background:
    radial-gradient(ellipse 80% 50% at 15% -10%,rgba(124,92,255,.15),transparent 55%),
    radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.12),transparent 55%),
    var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;}
  .mono{font-family:'Geist Mono',monospace;}
  h1,h2,h3{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.02em;margin:0;}
  button{font-family:inherit;cursor:pointer;border:none;outline:none;}
  input,textarea,select{font-family:inherit;background:var(--s2);border:1px solid var(--border-2);color:var(--text);border-radius:10px;padding:11px 14px;font-size:13.5px;width:100%;}
  input:focus,textarea:focus,select:focus{border-color:var(--violet-bright);}
  .btn{padding:11px 22px;border-radius:100px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;font-weight:700;font-size:13.5px;transition:transform .15s ease;}
  .btn:hover{transform:translateY(-1px);}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
  .btn-ghost{background:rgba(255,255,255,.06);border:1px solid var(--border-2);color:var(--text);}
  .btn-danger{background:var(--danger);}
  .panel{background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:20px;padding:24px;margin-bottom:18px;backdrop-filter:blur(14px);}

  /* Login gate */
  .gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
  .gate-card{max-width:400px;width:100%;padding:40px 36px;text-align:center;}
  .gate-logo{width:min(320px,72vw);margin:0 auto 20px;display:block;filter:drop-shadow(0 8px 40px rgba(124,92,255,.35));}
  .gate-title{font-size:14px;letter-spacing:.24em;text-transform:uppercase;color:var(--text-faint);margin-bottom:18px;}
  .gate-err{color:var(--danger);font-size:12.5px;min-height:18px;margin-top:10px;}

  /* Main app */
  .topbar{display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.02);backdrop-filter:blur(12px);}
  .topbar .brand{display:flex;align-items:center;gap:10px;font-weight:700;}
  .topbar .brand img{width:28px;height:28px;border-radius:6px;}
  .badge-god{padding:4px 12px;border-radius:100px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;}
  .container{max-width:1400px;margin:0 auto;padding:24px 28px 80px;}

  .tabs{display:flex;gap:4px;padding:4px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);width:fit-content;margin-bottom:20px;}
  .tab{padding:8px 20px;border-radius:100px;font-size:12.5px;font-weight:700;color:var(--text-dim);background:transparent;transition:all .18s var(--ease-smooth);}
  .tab.on{background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;}

  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:24px;}
  .stat{background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:16px;padding:18px 20px;}
  .stat .n{font-size:32px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;}
  .stat .l{font-size:11px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;font-weight:700;margin-top:4px;}

  table{width:100%;border-collapse:collapse;margin-top:14px;}
  th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--text-dim);padding:10px 12px;border-bottom:1px solid var(--border);}
  td{padding:12px;border-bottom:1px solid var(--border);font-size:13px;}
  tr:hover td{background:rgba(255,255,255,.02);}
  .chip{display:inline-block;padding:3px 10px;border-radius:100px;background:rgba(255,255,255,.06);border:1px solid var(--border-2);font-size:10.5px;font-weight:600;}
  .chip.ok{color:var(--success);border-color:rgba(34,197,94,.35);background:rgba(34,197,94,.08);}
  .chip.no{color:var(--text-faint);}
  .chip.warn{color:var(--amber);border-color:rgba(245,199,68,.35);background:rgba(245,199,68,.08);}

  .filters{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;}
  .filters input, .filters select{max-width:220px;}

  textarea.msg{min-height:120px;resize:vertical;}
  .broadcast-result{margin-top:14px;padding:14px 16px;border-radius:12px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);font-size:13px;}
  .broadcast-result.err{background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.3);}
</style>
</head>
<body>
<div id="app"></div>
<script>
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

let masterToken = sessionStorage.getItem('cp_master_token') || null;
let currentTab = 'overview';
let overviewData = null;
let callersData = [];
let filters = { q:'', tenant_id:'', role:'', verified:'' };

async function api(path, opts = {}) {
  const headers = { 'Content-Type':'application/json', ...(opts.headers||{}) };
  if (masterToken) headers['x-master-token'] = masterToken;
  const res = await fetch(path, { ...opts, headers });
  return res;
}

function renderGate(err) {
  $('#app').innerHTML = \`
    <div class="gate">
      <div class="gate-card panel">
        <img src="/clearpanel-logo.png" class="gate-logo" />
        <div class="gate-title">Master Access</div>
        <input id="mp" type="password" placeholder="Password" autofocus onkeydown="if(event.key==='Enter')doLogin()" />
        <button class="btn" style="width:100%;margin-top:12px;" onclick="doLogin()">Unlock</button>
        <div class="gate-err" id="err">\${esc(err||'')}</div>
      </div>
    </div>\`;
}

async function doLogin() {
  const pw = $('#mp').value;
  const res = await fetch('/api/master/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ password: pw })});
  const data = await res.json();
  if (!res.ok) { renderGate(data.error || 'Wrong password'); return; }
  masterToken = data.data.token;
  sessionStorage.setItem('cp_master_token', masterToken);
  renderApp();
}

async function doLogout() {
  await api('/api/master/logout', { method:'POST' });
  masterToken = null;
  sessionStorage.removeItem('cp_master_token');
  renderGate();
}

async function renderApp() {
  $('#app').innerHTML = \`
    <div class="topbar">
      <div class="brand"><img src="/clearpanel-logo.png" alt="" />ClearPanel <span class="badge-god">MASTER</span></div>
      <button class="btn btn-ghost" onclick="doLogout()">Lock</button>
    </div>
    <div class="container">
      <div class="tabs">
        <button class="tab \${currentTab==='overview'?'on':''}" onclick="switchTab('overview')">Overview</button>
        <button class="tab \${currentTab==='callers'?'on':''}" onclick="switchTab('callers')">Callers</button>
        <button class="tab \${currentTab==='broadcast'?'on':''}" onclick="switchTab('broadcast')">Broadcast</button>
        <button class="tab \${currentTab==='history'?'on':''}" onclick="switchTab('history')">History</button>
      </div>
      <div id="body"></div>
    </div>\`;
  loadTab();
}

async function switchTab(t) { currentTab = t; renderApp(); }

async function loadTab() {
  const body = $('#body');
  body.innerHTML = '<div class="panel" style="color:var(--text-dim);">Loading…</div>';
  if (currentTab === 'overview') await renderOverview();
  else if (currentTab === 'callers') await renderCallers();
  else if (currentTab === 'broadcast') await renderBroadcast();
  else if (currentTab === 'history') await renderHistory();
}

async function renderOverview() {
  const res = await api('/api/master/overview');
  if (res.status === 401) { renderGate('Session expired'); return; }
  overviewData = (await res.json()).data;
  const t = overviewData.totals;
  const botLine = overviewData.bot_configured
    ? '<span class="chip ok">Master bot active: @' + esc(overviewData.bot_username) + '</span>'
    : '<span class="chip warn">Master bot NOT configured — set TELEGRAM_BOT_TOKEN in Railway env</span>';
  $('#body').innerHTML = \`
    <div style="margin-bottom:16px;">\${botLine}</div>
    <div class="stat-grid">
      <div class="stat"><div class="n">\${t.tenants}</div><div class="l">Tenants</div></div>
      <div class="stat"><div class="n">\${t.users}</div><div class="l">Total users</div></div>
      <div class="stat"><div class="n">\${t.callers}</div><div class="l">Callers</div></div>
      <div class="stat"><div class="n">\${t.verified}</div><div class="l">Verified on master bot</div></div>
    </div>
    <div class="panel">
      <h3 style="margin-bottom:14px;">Tenants</h3>
      <table>
        <thead><tr><th>Name</th><th>Slug</th><th>Plan</th><th>Users</th><th>Verified</th><th>Own bot</th><th>Expires</th></tr></thead>
        <tbody>
          \${overviewData.tenants.map(tt => \`<tr>
            <td><b>\${esc(tt.name)}</b>\${tt.is_self?' <span class="chip">self</span>':''}</td>
            <td class="mono" style="color:var(--text-dim);">\${esc(tt.slug||'—')}</td>
            <td>\${esc(tt.plan||'—')}</td>
            <td>\${tt.user_count}</td>
            <td>\${tt.verified_master_count} / \${tt.user_count}</td>
            <td>\${tt.has_own_bot?'<span class="chip ok">@'+esc(tt.own_bot_username||'')+'</span>':'<span class="chip no">none</span>'}</td>
            <td class="mono" style="color:var(--text-dim);font-size:11.5px;">\${tt.expires_at?new Date(tt.expires_at).toLocaleDateString():'—'}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>\`;
}

async function renderCallers() {
  const qs = new URLSearchParams();
  if (filters.q) qs.set('q', filters.q);
  if (filters.tenant_id) qs.set('tenant_id', filters.tenant_id);
  if (filters.role) qs.set('role', filters.role);
  if (filters.verified) qs.set('verified', filters.verified);
  const [overviewRes, callersRes] = await Promise.all([
    overviewData ? Promise.resolve(null) : api('/api/master/overview'),
    api('/api/master/callers?' + qs.toString()),
  ]);
  if (callersRes.status === 401) { renderGate('Session expired'); return; }
  if (overviewRes) overviewData = (await overviewRes.json()).data;
  callersData = (await callersRes.json()).data;
  const tenantOptions = (overviewData?.tenants || []).map(t => \`<option value="\${t.id}" \${filters.tenant_id==t.id?'selected':''}>\${esc(t.name)}</option>\`).join('');
  $('#body').innerHTML = \`
    <div class="panel">
      <div class="filters">
        <input placeholder="Search name / @handle / tenant…" value="\${esc(filters.q)}" oninput="filters.q=this.value;debouncedReload()" />
        <select onchange="filters.tenant_id=this.value;renderCallers()"><option value="">All tenants</option>\${tenantOptions}</select>
        <select onchange="filters.role=this.value;renderCallers()">
          <option value="">All roles</option>
          <option value="admin" \${filters.role==='admin'?'selected':''}>Admin</option>
          <option value="caller" \${filters.role==='caller'?'selected':''}>Caller</option>
          <option value="finisher" \${filters.role==='finisher'?'selected':''}>Finisher</option>
        </select>
        <select onchange="filters.verified=this.value;renderCallers()">
          <option value="">All verified status</option>
          <option value="yes" \${filters.verified==='yes'?'selected':''}>Verified on master</option>
          <option value="no" \${filters.verified==='no'?'selected':''}>Not verified</option>
        </select>
      </div>
      <div style="font-size:12px;color:var(--text-dim);margin-bottom:8px;">\${callersData.length} match</div>
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Tenant</th><th>Telegram</th><th>Master</th><th>Own bot</th></tr></thead>
        <tbody>
          \${callersData.map(c => \`<tr>
            <td><b>\${esc(c.name)}</b></td>
            <td><span class="chip">\${esc(c.role)}</span></td>
            <td>\${esc(c.tenant_name||'—')}</td>
            <td class="mono">\${c.telegram_username?'@'+esc(c.telegram_username):'<span style="color:var(--text-faint);">—</span>'}</td>
            <td>\${c.verified_master?'<span class="chip ok">yes</span>':'<span class="chip no">no</span>'}</td>
            <td>\${c.verified_tenant?'<span class="chip ok">yes</span>':'<span class="chip no">no</span>'}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>\`;
}

let debounceT = null;
function debouncedReload() { clearTimeout(debounceT); debounceT = setTimeout(renderCallers, 300); }

async function renderBroadcast() {
  if (!overviewData) {
    const r = await api('/api/master/overview');
    if (r.status === 401) { renderGate('Session expired'); return; }
    overviewData = (await r.json()).data;
  }
  const tenantOpts = overviewData.tenants.map(t => \`<option value="\${t.id}">\${esc(t.name)} (\${t.verified_master_count} verified)</option>\`).join('');
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:14px;">Send a broadcast via the master bot</h3>
      <p style="font-size:12.5px;color:var(--text-dim);line-height:1.6;margin-bottom:16px;">This sends a Telegram DM from @\${esc(overviewData.bot_username)} to every user in the audience you pick. HTML formatting supported: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;a href="..."&gt;link&lt;/a&gt;.</p>
      <div style="display:grid;grid-template-columns:1fr 200px;gap:12px;margin-bottom:12px;">
        <select id="audience" onchange="onAudienceChange()">
          <option value="all">Everyone verified (across all tenants)</option>
          <option value="admins">All admins (across all tenants)</option>
          <option value="callers">All callers/finishers (across all tenants)</option>
          <option value="tenant">One specific tenant…</option>
        </select>
        <select id="tenantPick" style="display:none;">\${tenantOpts}</select>
      </div>
      <textarea id="msg" class="msg" placeholder="Type your message…"></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;">
        <div style="font-size:12px;color:var(--text-dim);" id="reach">Reach: calculating…</div>
        <button class="btn" onclick="doBroadcast()">Send Broadcast</button>
      </div>
      <div id="bResult"></div>
    </div>\`;
  updateReach();
}

function onAudienceChange() {
  $('#tenantPick').style.display = $('#audience').value === 'tenant' ? '' : 'none';
  updateReach();
}

function updateReach() {
  const a = $('#audience').value;
  let n = 0;
  if (a === 'all') n = overviewData.totals.verified;
  else if (a === 'tenant') {
    const tid = $('#tenantPick').value;
    const t = overviewData.tenants.find(x => String(x.id) === String(tid));
    n = t ? Number(t.verified_master_count) : 0;
  } else {
    // Admins / callers reach requires the callers list; approximate from overview.
    n = a === 'admins' ? overviewData.tenants.length : overviewData.totals.verified;
  }
  $('#reach').textContent = 'Reach: ' + n + ' verified recipient' + (n===1?'':'s');
}

async function doBroadcast() {
  const message = $('#msg').value.trim();
  if (!message) { alert('Write a message first.'); return; }
  const audience = $('#audience').value;
  const tenant_id = audience === 'tenant' ? Number($('#tenantPick').value) : null;
  if (!confirm('Send this to every user in the selected audience?')) return;
  const btn = document.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Sending…';
  const res = await api('/api/master/broadcast', { method:'POST', body: JSON.stringify({ message, audience, tenant_id })});
  const data = await res.json();
  const el = $('#bResult');
  if (!res.ok) {
    el.innerHTML = '<div class="broadcast-result err">' + esc(data.error || 'Failed') + '</div>';
  } else {
    const d = data.data;
    el.innerHTML = '<div class="broadcast-result">Broadcast #'+d.broadcast_id+' finished. Sent: '+d.sent+' · Blocked: '+d.blocked+' · Failed: '+d.failed+' out of '+d.total+'.</div>';
    $('#msg').value = '';
  }
  btn.disabled = false; btn.textContent = 'Send Broadcast';
}

async function renderHistory() {
  const res = await api('/api/master/broadcasts');
  if (res.status === 401) { renderGate('Session expired'); return; }
  const rows = (await res.json()).data;
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:14px;">Broadcast history</h3>
      \${rows.length === 0 ? '<div style="color:var(--text-dim);">No broadcasts sent yet.</div>' :
      '<table><thead><tr><th>When</th><th>From</th><th>Audience</th><th>Message</th><th>Sent</th><th>Blocked</th><th>Failed</th></tr></thead><tbody>'
      + rows.map(r => '<tr><td class="mono" style="font-size:11.5px;">'+new Date(r.created_at).toLocaleString()+'</td><td><span class="chip">'+esc(r.sender_scope)+'</span></td><td>'+esc(r.audience_label)+'</td><td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(r.message)+'</td><td>'+r.sent_count+'</td><td>'+r.blocked_count+'</td><td>'+r.failed_count+'</td></tr>').join('')
      + '</tbody></table>'}
    </div>\`;
}

// Boot
if (masterToken) renderApp(); else renderGate();
</script>
</body>
</html>`;
