// Standalone master control panel — deliberately NOT part of the regular tenant
// admin app (no shared sidebar, no shared JS bundle). Lives at its own route so a
// customer using their own Frap Ties-based panel never sees or reaches this, and
// it works the same way regardless of which tenant instance you're actually
// looking at it from.
export const CONTROL_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Master Control</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#08080a;--s1:#18181f;--s2:#212129;--border:rgba(255,255,255,.08);--border-2:rgba(255,255,255,.14);--text:#f2f2f4;--text-dim:#9c9ca6;--text-faint:#68686f;--gold:#4f8cff;--gold-bright:#7aabff;--success:#22c55e;--danger:#ef4444;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Inter',-apple-system,sans-serif;background:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(124,92,255,.18),transparent 55%),radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.14),transparent 55%),var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;}
  h1,h2,.disp{font-family:'Space Grotesk',sans-serif;}
  .wrap{max-width:960px;margin:0 auto;padding:32px 20px 80px;}
  .panel{background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:24px;margin-bottom:18px;box-shadow:0 2px 4px rgba(0,0,0,.3),0 12px 28px rgba(0,0,0,.3);}
  #loginScreen{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
  .login-card{width:100%;max-width:340px;text-align:center;padding:40px 32px;}
  .login-card h1{font-size:20px;margin:0 0 6px;}
  .login-card p{font-size:12.5px;color:var(--text-dim);margin:0 0 24px;}
  input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:16px;outline:none;font-family:inherit;margin-bottom:12px;}
  button{font-family:inherit;cursor:pointer;border:none;border-radius:100px;padding:12px 20px;font-weight:700;font-size:13.5px;background:var(--gold);color:#fff;width:100%;}
  button:hover{background:var(--gold-bright);}
  button.ghost{background:transparent;border:1px solid var(--border-2);color:var(--text-dim);}
  button.danger{background:transparent;border:1px solid rgba(239,68,68,.35);color:var(--danger);width:auto;padding:6px 12px;font-size:11px;}
  .err{color:var(--danger);font-size:12px;margin-top:8px;min-height:16px;}
  .hidden{display:none!important;}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px;}
  .stat-box{padding:18px 20px;}
  .stat-box .num{font-size:26px;font-weight:800;font-family:'Space Grotesk',sans-serif;letter-spacing:-.02em;}
  .stat-box .lbl{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;margin-top:4px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{text-align:left;padding:10px 12px;color:var(--text-faint);font-weight:600;font-size:10px;text-transform:uppercase;border-bottom:1px solid var(--border);}
  td{padding:12px;border-bottom:1px solid var(--border);}
  .field{margin-bottom:10px;}
  label{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;font-weight:600;}
  .row{display:flex;gap:10px;}
  .row .field{flex:1;}
  .badge{padding:4px 10px;border-radius:100px;font-size:10.5px;font-weight:700;}
  .badge.on{background:var(--success);color:#04250f;}
  .badge.off{background:var(--danger);color:#fff;}
  .badge.you{background:var(--gold);color:#fff;}
  .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
  .top h1{font-size:18px;margin:0;}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:var(--text-dim);margin:0 0 14px;}
</style>
</head>
<body>

<div id="loginScreen">
  <div class="panel login-card">
    <h1>Master Control</h1>
    <p>Not part of any tenant panel. This is your own separate login.</p>
    <input id="pinInput" type="password" placeholder="PIN" inputmode="numeric" onkeydown="if(event.key==='Enter') doLogin()" />
    <button onclick="doLogin()">Enter</button>
    <div class="err" id="loginErr"></div>
  </div>
</div>

<div id="mainScreen" class="hidden">
  <div class="wrap">
    <div class="top">
      <h1>Master Control</h1>
      <button class="ghost" style="width:auto;" onclick="logout()">Log Out</button>
    </div>
    <div id="content"><div class="panel">Loading…</div></div>
  </div>
</div>

<script>
let creds = JSON.parse(localStorage.getItem('mc_creds') || 'null');

function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function api(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ 'Content-Type': 'application/json', 'x-user-id': creds.id, 'x-user-pin': creds.pin }, opts.headers || {});
  return fetch(url, opts);
}

async function doLogin() {
  const pin = document.getElementById('pinInput').value.trim();
  const err = document.getElementById('loginErr');
  if (!pin) return;
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
  const data = await res.json();
  if (!res.ok || !data.data) { err.textContent = 'Invalid PIN.'; return; }
  if (!data.data.is_super_admin) { err.textContent = 'This PIN is not authorized for master control.'; return; }
  creds = { id: data.data.id, pin: data.data.pin };
  localStorage.setItem('mc_creds', JSON.stringify(creds));
  enter();
}
function logout() {
  localStorage.removeItem('mc_creds');
  creds = null;
  document.getElementById('mainScreen').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}
async function enter() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('mainScreen').classList.remove('hidden');
  await loadTenants();
}
async function loadTenants() {
  const content = document.getElementById('content');
  const [tenantsRes, liveRes, checkoutRes, keysRes] = await Promise.all([
    api('/api/master/tenants'), api('/api/master/live-stats'), api('/api/master/store-checkout-url'), api('/api/master/license-keys'),
  ]);
  if (tenantsRes.status === 403) { logout(); return; }
  const tenants = (await tenantsRes.json()).data;
  const live = (await liveRes.json()).data;
  const checkoutUrl = (await checkoutRes.json()).data.url;
  const keys = (await keysRes.json()).data;
  const liveById = {};
  live.forEach(l => liveById[l.id] = l);

  const totalRevenue = tenants.reduce((s, t) => s + parseFloat(t.price_paid || 0), 0);
  const totalCallers = live.reduce((s, l) => s + (l.callers || 0), 0);
  const totalManagers = live.reduce((s, l) => s + (l.managers || 0), 0);
  const totalLeads = live.reduce((s, l) => s + (l.total_leads || 0), 0);

  content.innerHTML = \`
    <div class="stat-grid">
      <div class="panel stat-box"><div class="num">£\${totalRevenue.toFixed(0)}</div><div class="lbl">Total Revenue</div></div>
      <div class="panel stat-box"><div class="num">\${tenants.length}</div><div class="lbl">Tenants</div></div>
      <div class="panel stat-box"><div class="num">\${totalCallers}</div><div class="lbl">Total Callers</div></div>
      <div class="panel stat-box"><div class="num">\${totalManagers}</div><div class="lbl">Total Managers</div></div>
      <div class="panel stat-box"><div class="num">\${totalLeads}</div><div class="lbl">Total Leads</div></div>
    </div>
    <div class="panel">
      <h2>Store Checkout Link</h2>
      <p style="font-size:12px;color:var(--text-dim);margin:0 0 12px;">Where the "Get Started" buttons on /store actually send people to pay — a Stripe Payment Link, Gumroad, Whop, whatever you're using.</p>
      <div class="field"><input id="checkoutUrl" placeholder="https://buy.stripe.com/..." value="\${esc(checkoutUrl || '')}" /></div>
      <button onclick="saveCheckoutUrl()">Save</button>
      <div class="err" id="checkoutErr"></div>
    </div>
    <div class="panel">
      <h2>Generate License Key</h2>
      <p style="font-size:12px;color:var(--text-dim);margin:0 0 12px;">Make one after someone's actually paid - send them the code plus the link to /redeem.</p>
      <div class="field"><label>Plan</label>
        <select id="keyPlan" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:14px;">
          <option value="3day">3 Day - £99</option><option value="7day">7 Day - £180</option><option value="monthly">1 Month - £750</option>
        </select>
      </div>
      <button onclick="generateKey()">Generate Key</button>
      <div class="err" id="keyErr"></div>
      <div id="newKeyBanner"></div>
    </div>
    <div class="panel">
      <h2>License Keys</h2>
      <table><thead><tr><th>Code</th><th>Plan</th><th>Status</th><th>Redeemed By</th><th></th></tr></thead>
      <tbody>\${keys.map(k => \`<tr>
        <td class="mono" style="font-size:11px;">\${esc(k.key_code)}</td>
        <td>\${esc(k.plan)}</td>
        <td>\${k.redeemed ? '<span class="badge on">Redeemed</span>' : '<span class="badge off">Unused</span>'}</td>
        <td>\${esc(k.tenant_name || '—')}</td>
        <td>\${!k.redeemed ? '<button class="danger" onclick="deleteKey(' + k.id + ')">Delete</button>' : ''}</td>
      </tr>\`).join('') || '<tr><td colspan="5" style="color:var(--text-faint);">No keys generated yet.</td></tr>'}</tbody></table>
    </div>
    <div class="panel">
      <h2>Add Tenant</h2>
      <p style="font-size:12px;color:var(--text-dim);margin:0 0 12px;">For manually tracking a separately-hosted deployment. Most of the time you want Generate License Key above instead - that's what actually provisions someone their own panel on this same deployment.</p>
      <div class="row">
        <div class="field"><label>Customer Name</label><input id="tName" placeholder="e.g. Acme Recovery Ltd" /></div>
        <div class="field"><label>Instance URL</label><input id="tUrl" placeholder="https://acme.up.railway.app" /></div>
      </div>
      <div class="row">
        <div class="field"><label>Plan</label>
          <select id="tPlan" style="width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:14px;">
            <option value="trial">Trial</option><option value="3day">3 Day - £99</option><option value="7day">7 Day - £180</option><option value="monthly">1 Month - £750</option>
          </select>
        </div>
        <div class="field"><label>Price Paid (£)</label><input id="tPrice" type="number" value="0" /></div>
      </div>
      <div class="field"><label>Notes</label><input id="tNotes" placeholder="Optional" /></div>
      <button onclick="addTenant()">Add Tenant</button>
      <div class="err" id="addErr"></div>
    </div>
    <div class="panel">
      <h2>All Tenants</h2>
      <table><thead><tr><th>Name</th><th>Plan</th><th>Paid</th><th>Callers</th><th>Managers</th><th>Leads</th><th>Status</th><th></th></tr></thead>
      <tbody>\${tenants.map(t => {
        const l = liveById[t.id] || {};
        return \`<tr>
          <td>\${esc(t.name)}\${t.is_self ? ' <span class="badge you">You</span>' : ''}</td>
          <td>\${esc(t.plan)}</td>
          <td>£\${parseFloat(t.price_paid || 0).toFixed(2)}</td>
          <td>\${l.callers != null ? l.callers : '—'}</td>
          <td>\${l.managers != null ? l.managers : '—'}</td>
          <td>\${l.total_leads != null ? l.total_leads : '—'}</td>
          <td>\${l.reachable ? '<span class="badge on">Online</span>' : '<span class="badge off">Unreachable</span>'}</td>
          <td>\${t.is_self ? '' : '<button class="danger" onclick="deleteTenant(' + t.id + ')">Remove</button>'}</td>
        </tr>\`;
      }).join('')}</tbody></table>
    </div>\`;
  if (lastGeneratedKey) {
    const banner = document.getElementById('newKeyBanner');
    if (banner) banner.innerHTML = '<p style="margin-top:12px;font-size:13px;color:#22c55e;">Key generated: <span class="mono" style="font-weight:700;">' + esc(lastGeneratedKey) + '</span> — send this plus the /redeem link to the customer.</p>';
  }
}
async function saveCheckoutUrl() {
  const url = document.getElementById('checkoutUrl').value.trim();
  const err = document.getElementById('checkoutErr');
  if (!url) { err.textContent = 'Enter a URL first.'; return; }
  const res = await api('/api/master/store-checkout-url', { method: 'POST', body: JSON.stringify({ url }) });
  if (!res.ok) { err.textContent = 'Failed to save.'; return; }
  err.textContent = 'Saved.'; err.style.color = '#22c55e';
  setTimeout(() => loadTenants(), 800);
}
let lastGeneratedKey = null;
async function generateKey() {
  const plan = document.getElementById('keyPlan').value;
  const err = document.getElementById('keyErr');
  const res = await api('/api/master/license-keys', { method: 'POST', body: JSON.stringify({ plan }) });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Failed to generate.'; return; }
  err.textContent = '';
  // loadTenants() re-renders the whole page including this banner's container, so
  // the message has to survive that refresh rather than being set on the
  // about-to-be-destroyed element directly.
  lastGeneratedKey = data.data.key_code;
  await loadTenants();
}
async function deleteKey(id) {
  if (!confirm('Delete this unused key?')) return;
  await api('/api/master/license-keys/' + id, { method: 'DELETE' });
  loadTenants();
}
async function addTenant() {
  const name = document.getElementById('tName').value.trim();
  const url = document.getElementById('tUrl').value.trim();
  const plan = document.getElementById('tPlan').value;
  const price_paid = parseFloat(document.getElementById('tPrice').value) || 0;
  const notes = document.getElementById('tNotes').value.trim();
  const err = document.getElementById('addErr');
  if (!name || !url) { err.textContent = 'Name and URL are required.'; return; }
  const res = await api('/api/master/tenants', { method: 'POST', body: JSON.stringify({ name, url, plan, price_paid, notes }) });
  if (!res.ok) { err.textContent = 'Failed to add tenant.'; return; }
  loadTenants();
}
async function deleteTenant(id) {
  if (!confirm('Remove this tenant from tracking? This does not affect their actual instance.')) return;
  await api('/api/master/tenants/' + id, { method: 'DELETE' });
  loadTenants();
}

if (creds) enter();
</script>
</body>
</html>`;
