// Public - where a customer who's paid actually turns their key into a real,
// working, isolated call center panel. Success screen hands them their panel URL
// and their first admin PIN directly - nothing else needed to start using it.
export const REDEEM_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Redeem Your Key</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700;800&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#08080a;--text:#f2f2f4;--text-dim:#9c9ca6;--text-faint:#68686f;--gold:#4f8cff;--gold-bright:#7aabff;--success:#22c55e;--danger:#ef4444;--border-2:rgba(255,255,255,.14);}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Inter',-apple-system,sans-serif;background:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(124,92,255,.18),transparent 55%),radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.14),transparent 55%),var(--bg);color:var(--text);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;-webkit-font-smoothing:antialiased;}
  h1,h2{font-family:'Space Grotesk',sans-serif;}
  .card{width:100%;max-width:420px;background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:36px 32px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 16px 40px rgba(0,0,0,.35);}
  h1{font-size:20px;margin:0 0 6px;}
  p.sub{font-size:13px;color:var(--text-dim);margin:0 0 26px;line-height:1.5;}
  label{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:6px;font-weight:600;}
  .field{margin-bottom:16px;}
  input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:16px;outline:none;font-family:inherit;}
  input#keyInput{font-family:'JetBrains Mono',monospace;letter-spacing:1px;text-transform:uppercase;}
  button{width:100%;font-family:inherit;cursor:pointer;border:none;border-radius:100px;padding:13px 20px;font-weight:700;font-size:13.5px;background:var(--gold);color:#fff;}
  button:hover{background:var(--gold-bright);}
  button:disabled{opacity:.5;cursor:default;}
  .err{color:var(--danger);font-size:12.5px;margin-top:10px;min-height:16px;}
  .plan-preview{font-size:12.5px;color:var(--success);margin-bottom:16px;min-height:16px;}
  .hidden{display:none!important;}
  .success-row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border-2);font-size:13px;}
  .success-row:last-child{border-bottom:none;}
  .success-row .k{color:var(--text-dim);}
  .success-row .v{font-weight:700;font-family:'JetBrains Mono',monospace;}
  .warn{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:12px;padding:12px 14px;font-size:12px;color:#f0958a;margin-top:16px;line-height:1.5;}
</style>
</head>
<body>

<div class="card" id="formCard">
  <h1>Redeem Your Key</h1>
  <p class="sub">Turns your key into a working, fully separate call center panel - nobody else can see your data.</p>
  <div class="field">
    <label>License Key</label>
    <input id="keyInput" placeholder="XXXX-XXXX-XXXX-XXXX" onblur="checkKey()" />
  </div>
  <div class="plan-preview" id="planPreview"></div>
  <div class="field">
    <label>Your Call Center Name</label>
    <input id="nameInput" placeholder="e.g. Acme Recovery Ltd" />
  </div>
  <div class="field">
    <label>Your Name (first admin account)</label>
    <input id="adminNameInput" placeholder="e.g. John Smith" />
  </div>
  <button id="redeemBtn" onclick="redeem()">Redeem &amp; Create My Panel</button>
  <div class="err" id="err"></div>
</div>

<div class="card hidden" id="successCard">
  <h1>You're All Set</h1>
  <p class="sub">Your panel is live right now. Save this - the PIN is shown once.</p>
  <div class="success-row"><span class="k">Panel URL</span><span class="v" id="rUrl"></span></div>
  <div class="success-row"><span class="k">Your PIN</span><span class="v" id="rPin"></span></div>
  <div class="success-row"><span class="k">Plan</span><span class="v" id="rPlan"></span></div>
  <div class="success-row"><span class="k">Expires</span><span class="v" id="rExpires"></span></div>
  <button style="margin-top:20px;" onclick="goToPanel()">Open My Panel</button>
  <div class="warn">Write this PIN down now - it will not be shown again. Anyone with your panel URL and PIN can log in as your admin.</div>
</div>

<script>
let panelUrl = '';
async function checkKey() {
  const key = document.getElementById('keyInput').value.trim();
  const preview = document.getElementById('planPreview');
  if (!key) { preview.textContent = ''; return; }
  const res = await fetch('/api/redeem/' + encodeURIComponent(key));
  const data = await res.json();
  if (!res.ok) { preview.textContent = data.error || 'Key not found'; preview.style.color = 'var(--danger)'; return; }
  preview.textContent = 'Valid key - ' + data.data.label + ' (£' + data.data.price + ')';
  preview.style.color = 'var(--success)';
}
async function redeem() {
  const key = document.getElementById('keyInput').value.trim();
  const call_center_name = document.getElementById('nameInput').value.trim();
  const admin_name = document.getElementById('adminNameInput').value.trim();
  const err = document.getElementById('err');
  const btn = document.getElementById('redeemBtn');
  if (!key || !call_center_name || !admin_name) { err.textContent = 'All fields are required.'; return; }
  btn.disabled = true; btn.textContent = 'Creating your panel...';
  const res = await fetch('/api/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, call_center_name, admin_name }) });
  const data = await res.json();
  if (!res.ok) { err.textContent = data.error || 'Redemption failed.'; btn.disabled = false; btn.textContent = 'Redeem & Create My Panel'; return; }
  panelUrl = window.location.origin + '/' + data.data.slug;
  document.getElementById('rUrl').textContent = panelUrl;
  document.getElementById('rPin').textContent = data.data.admin_pin;
  document.getElementById('rPlan').textContent = data.data.plan_label || '';
  document.getElementById('rExpires').textContent = data.data.expires_at ? new Date(data.data.expires_at).toLocaleDateString() : '—';
  document.getElementById('formCard').classList.add('hidden');
  document.getElementById('successCard').classList.remove('hidden');
}
function goToPanel() { window.location.href = panelUrl; }
</script>
</body>
</html>`;
