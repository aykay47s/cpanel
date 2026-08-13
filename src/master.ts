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
  .btn-primary{background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;}
  .btn-ok{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;}
  .btn-sm{padding:7px 14px;font-size:12px;}
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
        <button class="tab \${currentTab==='panels'?'on':''}" onclick="switchTab('panels')">Panels</button>
        <button class="tab \${currentTab==='callers'?'on':''}" onclick="switchTab('callers')">Callers</button>
        <button class="tab \${currentTab==='keys'?'on':''}" onclick="switchTab('keys')">License Keys</button>
        <button class="tab \${currentTab==='affiliates'?'on':''}" onclick="switchTab('affiliates')">Affiliates</button>
        <button class="tab \${currentTab==='store'?'on':''}" onclick="switchTab('store')">Store</button>
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
  else if (currentTab === 'panels') await renderPanels();
  else if (currentTab === 'callers') await renderCallers();
  else if (currentTab === 'keys') await renderKeys();
  else if (currentTab === 'affiliates') await renderAffiliates();
  else if (currentTab === 'store') await renderStore();
  else if (currentTab === 'broadcast') await renderBroadcast();
  else if (currentTab === 'history') await renderHistory();
}

async function renderOverview() {
  const [res, statsRes] = await Promise.all([api('/api/master/overview'), api('/api/master/stats')]);
  if (res.status === 401) { renderGate('Session expired'); return; }
  overviewData = (await res.json()).data;
  const stats = statsRes.ok ? (await statsRes.json()).data : null;
  const t = overviewData.totals;
  const botLine = overviewData.bot_configured
    ? '<span class="chip ok">Master bot active: @' + esc(overviewData.bot_username) + '</span>'
    : '<span class="chip warn">Master bot NOT configured — set TELEGRAM_BOT_TOKEN in Railway env</span>';
  const money = (n) => '£' + Number(n || 0).toLocaleString();
  const revenueBlock = stats ? \`
    <h3 style="margin:22px 0 14px;">Revenue & Growth</h3>
    <div class="stat-grid">
      <div class="stat"><div class="n" style="color:#5eeaa0;">\${money(stats.keys.revenue_redeemed)}</div><div class="l">Revenue (redeemed keys)</div></div>
      <div class="stat"><div class="n">\${money(stats.keys.revenue_potential)}</div><div class="l">Potential (all keys)</div></div>
      <div class="stat"><div class="n">\${stats.keys.redeemed_keys} / \${stats.keys.total_keys}</div><div class="l">Keys redeemed</div></div>
      <div class="stat"><div class="n">\${stats.leads.total_leads}</div><div class="l">Total leads (all panels)</div></div>
    </div>
    <h3 style="margin:22px 0 14px;">Panels & Affiliates</h3>
    <div class="stat-grid">
      <div class="stat"><div class="n">\${stats.tenants.active_tenants}</div><div class="l">Active panels</div></div>
      <div class="stat"><div class="n" style="color:#ff8f8a;">\${stats.tenants.terminated_tenants}</div><div class="l">Terminated</div></div>
      <div class="stat"><div class="n">\${stats.tenants.expired_tenants}</div><div class="l">Expired</div></div>
      <div class="stat"><div class="n">\${stats.users.clocked_in_now}</div><div class="l">Callers online now</div></div>
      <div class="stat"><div class="n">\${stats.affiliates.total_affiliates}</div><div class="l">Affiliates</div></div>
      <div class="stat"><div class="n">\${stats.affiliates.total_referrals}</div><div class="l">Referral sales</div></div>
      <div class="stat"><div class="n" style="color:#fbbf24;">\${money(stats.affiliates.commission_owed)}</div><div class="l">Commission owed</div></div>
      <div class="stat"><div class="n">\${money(stats.affiliates.total_commission)}</div><div class="l">Commission earned</div></div>
    </div>\` : '';
  $('#body').innerHTML = \`
    <div style="margin-bottom:16px;">\${botLine}</div>
    <div class="stat-grid">
      <div class="stat"><div class="n">\${t.tenants}</div><div class="l">Tenants</div></div>
      <div class="stat"><div class="n">\${t.users}</div><div class="l">Total users</div></div>
      <div class="stat"><div class="n">\${t.callers}</div><div class="l">Callers</div></div>
      <div class="stat"><div class="n">\${t.verified}</div><div class="l">Verified on master bot</div></div>
    </div>
    \${revenueBlock}
    <div class="panel" style="margin-top:22px;">
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

// ===== PANELS: full roster with terminate / reactivate =====
async function renderPanels() {
  const res = await api('/api/master/tenants-full');
  if (res.status === 401) { renderGate('Session expired'); return; }
  const rows = (await res.json()).data;
  const money = (n) => '£' + Number(n || 0).toLocaleString();
  const statusChip = (s) => s === 'active' ? '<span class="chip ok">active</span>' : s === 'terminated' ? '<span class="chip no">terminated</span>' : s === 'expired' ? '<span class="chip warn">expired</span>' : '<span class="chip">' + esc(s) + '</span>';
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:6px;">All Panels (\${rows.length})</h3>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;">Every resold panel. Terminate to instantly block access (callers see the reason at login); reactivate to restore, optionally extending the window.</p>
      \${rows.length ? rows.map(r => \`<div class="panel" style="margin-bottom:12px;background:var(--s1);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="min-width:0;">
            <div style="font-size:15px;font-weight:700;">\${esc(r.panel_name || r.name)} \${statusChip(r.status)}</div>
            <div class="mono" style="font-size:11.5px;color:var(--text-dim);margin-top:4px;">code: \${esc(r.slug||'—')} · \${r.user_count} users · \${r.online_count} online · \${r.lead_count} leads</div>
            \${r.termination_reason ? '<div style="font-size:12px;color:#ff8f8a;margin-top:6px;">Reason: ' + esc(r.termination_reason) + '</div>' : ''}
            <div style="font-size:11.5px;color:var(--text-dim);margin-top:4px;">\${r.plan?esc(r.plan)+' · ':''}\${r.price_paid?money(r.price_paid)+' · ':''}\${r.expires_at?'expires '+new Date(r.expires_at).toLocaleDateString():'no expiry'}</div>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            \${r.status === 'active'
              ? '<button class="btn btn-danger btn-sm" onclick="terminatePanel(' + r.id + ', \\'' + esc(r.panel_name||r.name).replace(/'/g,"") + '\\')">Terminate</button>'
              : '<button class="btn btn-ok btn-sm" onclick="reactivatePanel(' + r.id + ')">Reactivate</button>'}
          </div>
        </div>
      </div>\`).join('') : '<div style="color:var(--text-dim);">No resold panels yet.</div>'}
    </div>\`;
}
async function terminatePanel(id, name) {
  const reason = prompt('Terminate "' + name + '"? Callers will be blocked and shown this reason:', '');
  if (reason === null) return;
  await api('/api/master/tenants/' + id + '/terminate', { method: 'POST', body: JSON.stringify({ reason }) });
  renderPanels();
}
async function reactivatePanel(id) {
  const ext = prompt('Reactivate this panel. Extend access by how many days? (leave blank for no change)', '');
  if (ext === null) return;
  const extend_days = parseInt(ext, 10);
  await api('/api/master/tenants/' + id + '/reactivate', { method: 'POST', body: JSON.stringify({ extend_days: extend_days > 0 ? extend_days : undefined }) });
  renderPanels();
}

// ===== AFFILIATES =====
async function renderAffiliates() {
  const res = await api('/api/master/affiliates');
  if (res.status === 401) { renderGate('Session expired'); return; }
  const rows = (await res.json()).data;
  const money = (n) => '£' + Number(n || 0).toLocaleString();
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:14px;">New Affiliate</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;">
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Name</label><input id="affName" placeholder="e.g. John's Leads" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Telegram (optional)</label><input id="affTg" placeholder="@handle" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Commission %</label><input id="affPct" type="number" value="10" style="width:90px;" /></div>
      </div>
      <button class="btn btn-primary" style="margin-top:12px;" onclick="createAffiliate()">Create Affiliate</button>
      <div id="affStatus" style="font-size:12.5px;margin-top:10px;"></div>
    </div>
    <div class="panel">
      <h3 style="margin-bottom:14px;">Affiliates (\${rows.length})</h3>
      \${rows.length ? \`<table>
        <thead><tr><th>Name</th><th>Code</th><th>PIN</th><th>Rate</th><th>Sales</th><th>Earned</th><th>Owed</th><th></th></tr></thead>
        <tbody>\${rows.map(a => \`<tr>
          <td><b>\${esc(a.name)}</b>\${a.telegram_username?'<div class="mono" style="font-size:11px;color:var(--text-dim);">'+esc(a.telegram_username)+'</div>':''}</td>
          <td class="mono" style="color:var(--gold-bright);">\${esc(a.code)}</td>
          <td class="mono" style="color:var(--text-dim);">\${esc(a.access_pin||'—')}</td>
          <td>\${a.commission_pct}%</td>
          <td>\${a.referral_count}</td>
          <td>\${money(a.total_earned)}</td>
          <td style="color:\${Number(a.owed)>0?'#fbbf24':'var(--text-dim)'};">\${money(a.owed)}</td>
          <td style="white-space:nowrap;">\${Number(a.owed)>0?'<button class="btn btn-ok btn-sm" onclick="markAffPaid('+a.id+')">Mark paid</button> ':''}<button class="btn btn-danger btn-sm" onclick="deleteAffiliate('+a.id+')">×</button></td>
        </tr>\`).join('')}</tbody>
      </table>\` : '<div style="color:var(--text-dim);">No affiliates yet.</div>'}
    </div>\`;
}
async function createAffiliate() {
  const name = $('#affName').value.trim();
  const telegram_username = $('#affTg').value.trim();
  const commission_pct = parseFloat($('#affPct').value) || 10;
  const s = $('#affStatus');
  if (!name) { s.textContent = 'Name required.'; s.style.color = 'var(--danger)'; return; }
  const res = await api('/api/master/affiliates', { method: 'POST', body: JSON.stringify({ name, telegram_username, commission_pct }) });
  const data = await res.json();
  if (!res.ok) { s.textContent = data.error || 'Failed.'; s.style.color = 'var(--danger)'; return; }
  renderAffiliates();
}
async function markAffPaid(id) {
  if (!confirm('Mark all outstanding commission as paid for this affiliate?')) return;
  await api('/api/master/affiliates/' + id + '/mark-paid', { method: 'POST' });
  renderAffiliates();
}
async function deleteAffiliate(id) {
  if (!confirm('Delete this affiliate? Their referral history is removed too.')) return;
  await api('/api/master/affiliates/' + id, { method: 'DELETE' });
  renderAffiliates();
}

// ===== STORE CONFIG =====
async function renderStore() {
  const res = await api('/api/master/store-config');
  if (res.status === 401) { renderGate('Session expired'); return; }
  const cfg = (await res.json()).data || {};
  const tiers = [['3day','3 days'],['7day','7 days'],['14day','14 days'],['30day','30 days']];
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:6px;">Store & Pricing</h3>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;">These drive the public store page — the price and buy link shown for each panel tier.</p>
      <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Fallback checkout URL (used if a tier has no buy link)</label><input id="st_checkout" value="\${esc(cfg.store_checkout_url||'')}" placeholder="https://…" /></div>
      \${tiers.map(([k,label]) => \`<div style="display:grid;grid-template-columns:120px 120px 1fr;gap:10px;align-items:end;margin-top:12px;">
        <div style="font-weight:600;font-size:13px;padding-bottom:10px;">\${label}</div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Price (£)</label><input id="st_price_\${k}" type="number" value="\${esc(cfg['price_'+k]||'')}" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;">Buy link</label><input id="st_buy_\${k}" value="\${esc(cfg['buy_url_'+k]||'')}" placeholder="https://…" /></div>
      </div>\`).join('')}
      <button class="btn btn-primary" style="margin-top:16px;" onclick="saveStore()">Save Store Config</button>
      <div id="stStatus" style="font-size:12.5px;margin-top:10px;"></div>
    </div>\`;
}
async function saveStore() {
  const body = {
    store_checkout_url: $('#st_checkout').value.trim(),
    price_3day: $('#st_price_3day').value.trim(), price_7day: $('#st_price_7day').value.trim(),
    price_14day: $('#st_price_14day').value.trim(), price_30day: $('#st_price_30day').value.trim(),
    buy_url_3day: $('#st_buy_3day').value.trim(), buy_url_7day: $('#st_buy_7day').value.trim(),
    buy_url_14day: $('#st_buy_14day').value.trim(), buy_url_30day: $('#st_buy_30day').value.trim(),
  };
  const s = $('#stStatus');
  s.textContent = 'Saving…'; s.style.color = 'var(--text-dim)';
  const res = await api('/api/master/store-config', { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) { s.textContent = 'Save failed.'; s.style.color = 'var(--danger)'; return; }
  s.textContent = 'Saved ✓'; s.style.color = '#5eeaa0';
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

let lastGeneratedKeys = [];
async function renderKeys() {
  const res = await api('/api/master/license-keys');
  if (res.status === 401) { renderGate('Session expired'); return; }
  const keys = (await res.json()).data || [];
  const unredeemed = keys.filter(k => !k.redeemed);
  const redeemed = keys.filter(k => k.redeemed);
  $('#body').innerHTML = \`
    <div class="panel">
      <h3 style="margin-bottom:14px;">Generate License Keys</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;">Label (optional)</label><input id="keyLabel" placeholder="e.g. Starter Plan" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;">Days of access</label><input id="keyDays" type="number" value="30" min="1" max="3650" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;">Price paid (optional, your records only)</label><input id="keyPrice" type="number" step="0.01" placeholder="0.00" /></div>
        <div><label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:6px;">How many keys</label><input id="keyCount" type="number" value="1" min="1" max="500" /></div>
      </div>
      <button class="btn btn-gold" onclick="generateKeys()">Generate</button>
      <div id="genStatus" style="font-size:12px;margin-top:10px;color:var(--text-dim);"></div>
      \${lastGeneratedKeys.length ? \`
        <div style="margin-top:16px;padding:14px;border-radius:12px;background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.25);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <b style="font-size:13px;color:var(--success);">\${lastGeneratedKeys.length} key\${lastGeneratedKeys.length > 1 ? 's' : ''} just generated</b>
            <button class="btn btn-ghost" style="padding:6px 14px;font-size:12px;" onclick="copyAllKeys()">Copy All</button>
          </div>
          <div class="mono" style="font-size:12.5px;line-height:1.9;max-height:220px;overflow-y:auto;white-space:pre-wrap;word-break:break-all;">\${lastGeneratedKeys.join('\\n')}</div>
        </div>
      \` : ''}
    </div>
    <div class="panel">
      <h3 style="margin-bottom:14px;">Unredeemed (\${unredeemed.length})</h3>
      \${unredeemed.length ? \`<table>
        <thead><tr><th>Key</th><th>Label</th><th>Days</th><th>Price</th><th>Created</th><th></th></tr></thead>
        <tbody>\${unredeemed.map(k => \`<tr>
          <td class="mono">\${esc(k.key_code)}</td>
          <td>\${esc(k.plan)}</td>
          <td>\${k.days}</td>
          <td>\${k.price_paid ? '$' + Number(k.price_paid).toFixed(2) : '—'}</td>
          <td class="mono" style="color:var(--text-dim);font-size:11.5px;">\${new Date(k.created_at).toLocaleDateString()}</td>
          <td><button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;" onclick="copyOneKey('\${esc(k.key_code)}')">Copy</button> <button class="btn btn-ghost" style="padding:5px 10px;font-size:11px;color:var(--danger);" onclick="deleteKey(\${k.id})">Delete</button></td>
        </tr>\`).join('')}</tbody>
      </table>\` : '<div style="color:var(--text-dim);font-size:13px;">None waiting to be redeemed.</div>'}
    </div>
    <div class="panel">
      <h3 style="margin-bottom:14px;">Redeemed (\${redeemed.length})</h3>
      \${redeemed.length ? \`<table>
        <thead><tr><th>Key</th><th>Label</th><th>Redeemed By</th><th>Redeemed</th></tr></thead>
        <tbody>\${redeemed.map(k => \`<tr>
          <td class="mono" style="color:var(--text-dim);">\${esc(k.key_code)}</td>
          <td>\${esc(k.plan)}</td>
          <td><b>\${esc(k.tenant_name || '—')}</b></td>
          <td class="mono" style="color:var(--text-dim);font-size:11.5px;">\${k.redeemed_at ? new Date(k.redeemed_at).toLocaleDateString() : '—'}</td>
        </tr>\`).join('')}</tbody>
      </table>\` : '<div style="color:var(--text-dim);font-size:13px;">None redeemed yet.</div>'}
    </div>\`;
}
async function generateKeys() {
  const label = $('#keyLabel').value.trim();
  const days = $('#keyDays').value;
  const price = $('#keyPrice').value;
  const count = $('#keyCount').value;
  const statusEl = $('#genStatus');
  statusEl.textContent = 'Generating…';
  const res = await api('/api/master/license-keys', { method: 'POST', body: JSON.stringify({ label, days, price, count }) });
  const data = await res.json();
  if (!res.ok) { statusEl.textContent = data.error || 'Failed to generate'; statusEl.style.color = 'var(--danger)'; return; }
  lastGeneratedKeys = (data.keys || [data.data]).map(k => k.key_code);
  await renderKeys();
}
function copyAllKeys() {
  navigator.clipboard.writeText(lastGeneratedKeys.join('\\n'));
  const btn = event.target;
  const original = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => { btn.textContent = original; }, 1500);
}
function copyOneKey(code) {
  navigator.clipboard.writeText(code);
}
async function deleteKey(id) {
  if (!confirm('Delete this unredeemed key? It will no longer work.')) return;
  await api('/api/master/license-keys/' + id, { method: 'DELETE' });
  renderKeys();
}

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
