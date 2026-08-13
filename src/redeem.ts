export const REDEEM_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Activate Your Panel</title>
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#07070a;--text:#eaeaec;--text-dim:#8f8f98;--text-faint:#57575f;--gold:#4f8cff;--success:#22c55e;--danger:#ef4444;--border:rgba(255,255,255,.06);--border-2:rgba(255,255,255,.11);}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Geist',-apple-system,sans-serif;background:radial-gradient(ellipse 90% 60% at 15% -10%,rgba(124,92,255,.07),transparent 55%),radial-gradient(ellipse 80% 60% at 100% 0%,rgba(79,140,255,.06),transparent 55%),var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-font-smoothing:antialiased;}
  h1{font-family:'Bricolage Grotesque',sans-serif;font-size:22px;letter-spacing:-.02em;margin-bottom:4px;}
  .sub{font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:28px;}
  .card{width:100%;max-width:440px;background:rgba(255,255,255,.04);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border:1px solid var(--border-2);border-radius:20px;padding:36px 32px;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 8px rgba(0,0,0,.3),0 24px 64px rgba(0,0,0,.4);}
  label{font-size:10px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:7px;font-weight:700;}
  .field{margin-bottom:18px;}
  input{width:100%;padding:12px 14px;border-radius:10px;border:1px solid var(--border-2);background:rgba(255,255,255,.03);color:var(--text);font-size:15px;outline:none;font-family:'Geist',sans-serif;transition:border-color .15s ease;}
  input:focus{border-color:rgba(79,140,255,.5);background:rgba(79,140,255,.04);}
  input#keyInput{font-family:'Geist Mono',monospace;letter-spacing:1px;text-transform:uppercase;}
  .btn{width:100%;font-family:'Geist',sans-serif;cursor:pointer;border:none;border-radius:100px;padding:14px 20px;font-weight:700;font-size:14px;background:var(--gold);color:#fff;transition:opacity .15s ease,transform .15s ease;}
  .btn:hover{opacity:.9;transform:translateY(-1px);}
  .btn:active{transform:scale(.98);}
  .btn:disabled{opacity:.4;cursor:default;transform:none;}
  .err{color:var(--danger);font-size:12.5px;margin-top:8px;min-height:16px;}
  .plan-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:100px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.2);color:var(--success);font-size:12px;font-weight:700;margin-bottom:18px;}
  .plan-chip.err-chip{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.2);color:var(--danger);}
  .hidden{display:none!important;}

  /* Success card */
  .success-header{text-align:center;padding-bottom:24px;border-bottom:1px solid var(--border);margin-bottom:20px;}
  .success-icon{width:52px;height:52px;border-radius:50%;background:rgba(34,197,94,.12);border:2px solid rgba(34,197,94,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:22px;}
  .info-grid{display:flex;flex-direction:column;gap:0;}
  .info-row{display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);}
  .info-row:last-child{border-bottom:none;}
  .info-row .k{font-size:12px;color:var(--text-dim);}
  .info-row .v{font-family:'Geist Mono',monospace;font-size:13px;font-weight:600;letter-spacing:0;}
  .panel-link{display:flex;align-items:center;gap:8px;padding:14px;border-radius:12px;background:rgba(79,140,255,.08);border:1px solid rgba(79,140,255,.2);color:var(--gold);font-size:13px;font-weight:600;word-break:break-all;margin:16px 0 4px;cursor:pointer;transition:background .15s ease;}
  .panel-link:hover{background:rgba(79,140,255,.14);}
  .copy-row{display:flex;gap:8px;align-items:stretch;}
  .copy-row input{flex:1;font-family:'Geist Mono',monospace;font-size:12px;padding:10px 12px;}
  .copy-btn{padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--border-2);color:var(--text-dim);font-size:12px;font-weight:700;cursor:pointer;font-family:'Geist',sans-serif;white-space:nowrap;transition:all .15s ease;}
  .copy-btn:hover{background:rgba(255,255,255,.1);color:var(--text);}
  .pin-box{background:rgba(34,197,94,.06);border:1px solid rgba(34,197,94,.2);border-radius:12px;padding:16px;text-align:center;}
  .pin-label{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px;}
  .pin-value{font-family:'Bricolage Grotesque',sans-serif;font-size:36px;font-weight:800;letter-spacing:.05em;color:var(--success);}
  .warn-box{background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.2);border-radius:12px;padding:12px 14px;font-size:12px;color:#f59e0b;margin-top:16px;line-height:1.6;}
  .open-btn{width:100%;margin-top:20px;padding:15px;border-radius:100px;background:linear-gradient(180deg,#5a96ff,var(--gold));color:#fff;font-weight:800;font-size:15px;font-family:'Bricolage Grotesque',sans-serif;cursor:pointer;border:none;box-shadow:0 4px 18px rgba(79,140,255,.35);transition:transform .2s ease,box-shadow .2s ease;}
  .open-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(79,140,255,.45);}
  .step-indicator{display:flex;gap:6px;margin-bottom:24px;}
  .step{flex:1;height:3px;border-radius:2px;background:var(--border);}
  .step.done{background:var(--gold);}
</style>
</head>
<body>

<div class="card" id="formCard">
  <div style="display:flex;align-items:center;justify-content:center;margin-bottom:18px;">
    <img src="/clearpanel-icon.png" alt="ClearPanel" style="width:48px;height:48px;border-radius:50%;box-shadow:0 4px 20px rgba(124,92,255,.35);" />
  </div>
  <div class="step-indicator" id="steps">
    <div class="step done" id="s1"></div>
    <div class="step" id="s2"></div>
    <div class="step" id="s3"></div>
  </div>
  <h1>Activate Your Panel</h1>
  <p class="sub">Enter your license key and we'll set up your own private call center panel — takes about 10 seconds.</p>

  <div class="field">
    <label>License Key</label>
    <input id="keyInput" placeholder="XXXX-XXXX-XXXX-XXXX" oninput="onKeyInput()" />
    <div id="planPreview" style="margin-top:8px;min-height:24px;"></div>
  </div>
  <div class="field">
    <label>Your Call Center Name</label>
    <input id="nameInput" placeholder="e.g. Acme Recovery Ltd" />
  </div>
  <div class="field">
    <label>Your Name</label>
    <input id="adminNameInput" placeholder="e.g. John Smith" />
  </div>
  <button class="btn" id="redeemBtn" onclick="redeem()">Create My Panel →</button>
  <div class="err" id="err"></div>
</div>

<div class="card hidden" id="successCard">
  <div class="success-header">
    <div class="success-icon">✓</div>
    <h1 id="successTitle">Panel Created</h1>
    <p class="sub" style="margin-bottom:0;">Your call center is live. Bookmark your link and save your PIN — you'll need both to log in.</p>
  </div>

  <p style="font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:8px;">Your Panel Link</p>
  <div class="copy-row" style="margin-bottom:20px;">
    <input id="rUrlInput" readonly />
    <button class="copy-btn" onclick="copyUrl()">Copy</button>
  </div>

  <div class="pin-box" style="margin-bottom:20px;">
    <div class="pin-label">Admin PIN — shown once, save it now</div>
    <div class="pin-value" id="rPin"></div>
  </div>

  <div class="info-grid">
    <div class="info-row"><span class="k">Call center name</span><span class="v" id="rName"></span></div>
    <div class="info-row"><span class="k">Plan</span><span class="v" id="rPlan"></span></div>
    <div class="info-row"><span class="k">Access until</span><span class="v" id="rExpires"></span></div>
  </div>

  <div class="warn-box">⚠ This PIN is shown once and cannot be recovered. Write it down or save it somewhere secure before leaving this page.</div>

  <button class="open-btn" onclick="goToPanel()">Open My Panel Now</button>
</div>

<script>
let panelUrl = '';
let keyCheckTimeout;

// If arriving fresh from a successful Stripe payment, the key is already generated
// and passed via ?key= - pre-fill it and validate immediately so the customer just
// has to type their call center name and their own name, nothing else.
(function prefillFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  if (key) {
    document.getElementById('keyInput').value = key.toUpperCase();
    checkKey(key);
  }
})();

function onKeyInput() {
  clearTimeout(keyCheckTimeout);
  const key = document.getElementById('keyInput').value.trim();
  if (key.length < 4) { document.getElementById('planPreview').innerHTML = ''; return; }
  keyCheckTimeout = setTimeout(() => checkKey(key), 500);
}

async function checkKey(key) {
  const preview = document.getElementById('planPreview');
  try {
    const res = await fetch('/api/redeem/' + encodeURIComponent(key));
    const data = await res.json();
    if (!res.ok) {
      preview.innerHTML = '<span style="color:var(--danger);font-size:12px;">' + (data.error || 'Key not found') + '</span>';
      return;
    }
    const d = data.data;
    preview.innerHTML = '<span class="plan-chip">✓ ' + d.label + ' — £' + d.price + '</span>';
    document.getElementById('s2').classList.add('done');
  } catch {
    preview.innerHTML = '';
  }
}

async function redeem() {
  const key = document.getElementById('keyInput').value.trim().toUpperCase();
  const call_center_name = document.getElementById('nameInput').value.trim();
  const admin_name = document.getElementById('adminNameInput').value.trim();
  const err = document.getElementById('err');
  const btn = document.getElementById('redeemBtn');
  if (!key || !call_center_name || !admin_name) { err.textContent = 'All three fields are required.'; return; }
  btn.disabled = true; btn.textContent = 'Creating your panel…';
  err.textContent = '';
  document.getElementById('s3').classList.add('done');
  try {
    const res = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, call_center_name, admin_name }) });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error || 'Redemption failed.'; btn.disabled = false; btn.textContent = 'Create My Panel →'; document.getElementById('s3').classList.remove('done'); return; }
    panelUrl = window.location.origin + '/' + data.data.slug;
    document.getElementById('rUrlInput').value = panelUrl;
    document.getElementById('rPin').textContent = data.data.admin_pin;
    document.getElementById('rName').textContent = data.data.tenant_name;
    document.getElementById('rPlan').textContent = data.data.plan_label || '';
    document.getElementById('rExpires').textContent = data.data.expires_at ? new Date(data.data.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    document.getElementById('successTitle').textContent = data.data.tenant_name + ' is live';
    document.getElementById('formCard').classList.add('hidden');
    document.getElementById('successCard').classList.remove('hidden');
  } catch {
    err.textContent = 'Network error — try again.'; btn.disabled = false; btn.textContent = 'Create My Panel →';
  }
}
function copyUrl() {
  navigator.clipboard.writeText(panelUrl).catch(() => {});
  const btn = document.querySelector('.copy-btn');
  btn.textContent = 'Copied!'; setTimeout(() => btn.textContent = 'Copy', 2000);
}
function goToPanel() { window.location.href = panelUrl; }
</script>
</body>
</html>`;
