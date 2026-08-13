// ClearPanel affiliate self-service panel, served at /affiliate.
// An affiliate logs in with their referral code + access PIN (issued by the
// operator in Master → Affiliates), sees how many panels they've opened,
// their commission earned/owed, and sets their own crypto payout wallet.
// All money figures are tracking only — commissions never reduce buyer prices.

export const AFFILIATE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClearPanel · Affiliates</title>
<link rel="icon" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600&family=Bricolage+Grotesque:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#07070a; --bg-2:#0d0d12; --s1:#12121a; --s2:#1a1a24; --s3:#232330;
    --text:#f2f2f4; --text-dim:#a0a0aa; --text-faint:#66666e;
    --violet:#7c5cff; --violet-bright:#a78bfa; --gold:#4f8cff; --gold-bright:#7aabff;
    --teal:#2dd4bf; --success:#22c55e; --danger:#ef4444; --amber:#f5c744;
    --border:rgba(255,255,255,.08); --border-2:rgba(255,255,255,.14);
    --glass:rgba(255,255,255,.05); --glass-2:rgba(255,255,255,.08);
    --ease-smooth:cubic-bezier(.16,1,.3,1); --ease-spring:cubic-bezier(.34,1.56,.64,1);
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  body{font-family:'Geist',-apple-system,sans-serif;color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;
    background:
      radial-gradient(ellipse 90% 55% at 12% -12%,rgba(147,112,255,.16),transparent 58%),
      radial-gradient(ellipse 80% 55% at 105% 0%,rgba(79,140,255,.12),transparent 55%),
      radial-gradient(ellipse 70% 50% at 50% 115%,rgba(45,212,191,.06),transparent 62%),
      var(--bg);
    font-size:14px;line-height:1.5;letter-spacing:-.006em;}
  .mono{font-family:'Geist Mono',monospace;letter-spacing:0;}
  h1,h2,h3{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.02em;}
  button{font-family:inherit;cursor:pointer;border:none;outline:none;}
  input,select{font-family:inherit;background:var(--s2);border:1px solid var(--border-2);color:var(--text);border-radius:12px;padding:12px 15px;font-size:14px;width:100%;transition:border-color .18s var(--ease-smooth),box-shadow .18s ease;}
  input:focus,select:focus{border-color:var(--violet-bright);box-shadow:0 0 0 3px rgba(167,139,250,.15);}
  a{color:inherit;text-decoration:none;}
  .hidden{display:none !important;}

  /* Glass panel */
  .glass{
    position:relative;background:linear-gradient(155deg,var(--glass-2),var(--glass) 62%);
    backdrop-filter:blur(22px) saturate(1.6);-webkit-backdrop-filter:blur(22px) saturate(1.6);
    border:1px solid var(--border-2);border-radius:22px;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.10),inset 0 0 48px rgba(147,112,255,.035),0 16px 40px rgba(0,0,0,.4);
  }
  .glass::after{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;border-radius:inherit;
    background:linear-gradient(135deg,rgba(255,255,255,.09) 0%,rgba(255,255,255,.015) 20%,transparent 42%);
    mix-blend-mode:screen;opacity:.75;}
  .glass > *{position:relative;z-index:1;}

  .btn{padding:13px 26px;border-radius:100px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));color:#fff;font-weight:700;font-size:14px;transition:transform .28s var(--ease-spring),box-shadow .15s ease;box-shadow:0 6px 20px rgba(124,92,255,.3);}
  .btn:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(124,92,255,.42);}
  .btn:active{transform:scale(.98);}
  .btn:disabled{opacity:.5;cursor:not-allowed;transform:none;}
  .btn-block{width:100%;display:block;text-align:center;}
  .btn-ghost{background:rgba(255,255,255,.06);border:1px solid var(--border-2);color:var(--text);box-shadow:none;}

  /* Login gate */
  .gate{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
  .gate-card{max-width:400px;width:100%;padding:44px 36px;text-align:center;animation:rise .5s var(--ease-smooth) both;}
  .crest{width:56px;height:56px;margin:0 auto 18px;color:var(--violet-bright);}
  .crest svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.5;}
  .eyebrow{font-size:11px;letter-spacing:.28em;text-transform:uppercase;color:var(--violet-bright);font-weight:700;margin-bottom:10px;}
  .field{text-align:left;margin-bottom:14px;}
  .field label{font-size:11px;color:var(--text-dim);font-weight:600;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
  .err{color:var(--danger);font-size:12.5px;min-height:18px;margin-top:10px;}

  /* App */
  .topbar{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;position:sticky;top:0;z-index:10;
    background:rgba(10,10,16,.7);backdrop-filter:blur(18px);border-bottom:1px solid var(--border);}
  .topbar .brand{display:flex;align-items:center;gap:10px;font-weight:800;font-family:'Bricolage Grotesque',sans-serif;}
  .topbar .brand .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,var(--violet-bright),var(--gold));display:flex;align-items:center;justify-content:center;color:#fff;}
  .container{max-width:1100px;margin:0 auto;padding:24px 20px 80px;}
  .stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:20px;}
  .stat{padding:22px;animation:rise .5s var(--ease-smooth) both;}
  .stat .k{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:7px;}
  .stat .v{font-family:'Bricolage Grotesque',sans-serif;font-size:34px;font-weight:900;letter-spacing:-.03em;line-height:1;}
  .stat .sub{font-size:12px;color:var(--text-dim);margin-top:8px;}
  .stat .ic{width:15px;height:15px;}
  .accent-v{color:var(--violet-bright);} .accent-g{color:var(--success);} .accent-t{color:var(--teal);} .accent-a{color:var(--amber);}
  table{width:100%;border-collapse:collapse;margin-top:6px;}
  th{text-align:left;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);font-weight:700;padding:10px 12px;border-bottom:1px solid var(--border);}
  td{padding:13px 12px;border-bottom:1px solid var(--border);font-size:13.5px;}
  tr:last-child td{border-bottom:none;}
  .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:100px;font-size:11px;font-weight:700;}
  .pill.paid{background:rgba(34,197,94,.15);color:#4ade80;}
  .pill.owed{background:rgba(245,199,68,.14);color:var(--amber);}
  .code-chip{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:12px;background:var(--s2);border:1px solid var(--border-2);font-family:'Geist Mono',monospace;font-weight:600;font-size:15px;letter-spacing:.05em;}
  .copy-btn{padding:5px 12px;border-radius:8px;background:rgba(255,255,255,.08);font-size:11px;font-weight:600;color:var(--text-dim);}
  .section-h{font-size:13px;font-weight:700;letter-spacing:.02em;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .empty{text-align:center;padding:32px;color:var(--text-faint);font-size:13px;}
  @keyframes rise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
  .stat:nth-child(1){animation-delay:.02s;} .stat:nth-child(2){animation-delay:.06s;}
  .stat:nth-child(3){animation-delay:.10s;} .stat:nth-child(4){animation-delay:.14s;}
  @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;}}
</style>
</head>
<body>
  <div id="gate" class="gate">
    <div class="gate-card glass">
      <div class="crest"><svg viewBox="0 0 24 24"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/><path d="M9 12l2 2 4-4"/></svg></div>
      <div class="eyebrow">ClearPanel Affiliates</div>
      <h2 style="font-size:22px;margin-bottom:8px;">Partner Portal</h2>
      <p style="font-size:13px;color:var(--text-dim);line-height:1.6;margin-bottom:24px;">Sign in with your referral code and access PIN to track the panels you've opened and your commission.</p>
      <div class="field"><label>Referral code</label><input id="loginCode" placeholder="YOURCODE" autocomplete="off" style="text-transform:uppercase;" /></div>
      <div class="field"><label>Access PIN</label><input id="loginPin" placeholder="••••••" inputmode="numeric" autocomplete="off" /></div>
      <button class="btn btn-block" onclick="doLogin()" style="margin-top:6px;">Sign in</button>
      <div id="loginErr" class="err"></div>
    </div>
  </div>

  <div id="app" class="hidden">
    <div class="topbar">
      <div class="brand"><div class="mark"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div> ClearPanel <span style="font-weight:500;color:var(--text-faint);font-size:12px;">Affiliates</span></div>
      <button class="btn-ghost" style="padding:8px 18px;border-radius:100px;font-size:12.5px;font-weight:600;" onclick="doLogout()">Sign out</button>
    </div>
    <div class="container" id="body"></div>
  </div>

<script>
const IC = {
  users:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.7.3 4.7 2.3 5.5 4.8"/></svg>',
  coins:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
  wallet:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
  clock:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12l5 5L20 6"/></svg>',
};
let SESSION = null; // {code, pin}
const $ = s => document.querySelector(s);
const esc = t => String(t==null?'':t).replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
const money = (n, cur) => (cur||'USDT') + ' ' + Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

async function doLogin(){
  const code = $('#loginCode').value.trim();
  const pin = $('#loginPin').value.trim();
  const err = $('#loginErr'); err.textContent='';
  if(!code||!pin){ err.textContent='Enter your code and PIN'; return; }
  try{
    const r = await fetch('/api/affiliate/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,pin})});
    const d = await r.json();
    if(!r.ok){ err.textContent = d.error||'Invalid code or PIN'; return; }
    SESSION = {code, pin};
    sessionStorage.setItem('aff_session', JSON.stringify(SESSION));
    render(d.data);
  }catch{ err.textContent='Network error — try again'; }
}
function doLogout(){ SESSION=null; sessionStorage.removeItem('aff_session'); $('#app').classList.add('hidden'); $('#gate').classList.remove('hidden'); }

async function refresh(){
  if(!SESSION) return;
  const r = await fetch('/api/affiliate/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(SESSION)});
  if(!r.ok){ doLogout(); return; }
  render((await r.json()).data);
}

function render(d){
  $('#gate').classList.add('hidden');
  $('#app').classList.remove('hidden');
  const t = d.totals || {};
  const walletSet = !!d.payout_wallet;
  $('#body').innerHTML = \`
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:22px;">
      <div>
        <h1 style="font-size:26px;margin-bottom:4px;">Welcome back, \${esc(d.name||'Partner')}</h1>
        <p style="color:var(--text-dim);font-size:13.5px;">Here's how your referrals are performing.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <div class="code-chip">\${esc(d.code)}</div>
        <button class="copy-btn" onclick="navigator.clipboard.writeText('\${esc(d.code)}');this.textContent='Copied'">Copy code</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat glass"><div class="k accent-v">\${IC.users} Panels opened</div><div class="v">\${t.referral_count||0}</div><div class="sub">Call centres started with your code</div></div>
      <div class="stat glass"><div class="k accent-g">\${IC.coins} Total earned</div><div class="v">\${money(t.total_earned,d.payout_currency)}</div><div class="sub">\${d.commission_pct}% of every sale</div></div>
      <div class="stat glass"><div class="k accent-a">\${IC.clock} Owed to you</div><div class="v">\${money(t.owed,d.payout_currency)}</div><div class="sub">Pending next payout</div></div>
      <div class="stat glass"><div class="k accent-t">\${IC.check} Paid out</div><div class="v">\${money(t.paid,d.payout_currency)}</div><div class="sub">Already settled</div></div>
    </div>

    <div class="glass" style="padding:24px;margin-bottom:20px;">
      <div class="section-h accent-v">\${IC.wallet} Your crypto payout wallet</div>
      <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;line-height:1.5;">This is where your commission gets sent. Make sure it's correct — payouts go here.</p>
      <div style="display:grid;grid-template-columns:140px 1fr;gap:12px;align-items:end;">
        <div class="field" style="margin:0;"><label>Currency</label>
          <select id="walletCur">
            \${['USDT','USDC','BTC','ETH','SOL','LTC','XMR'].map(cc=>'<option '+(d.payout_currency===cc?'selected':'')+'>'+cc+'</option>').join('')}
          </select>
        </div>
        <div class="field" style="margin:0;"><label>Wallet address</label><input id="walletAddr" placeholder="Paste your wallet address" value="\${esc(d.payout_wallet||'')}" /></div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;margin-top:14px;">
        <button class="btn" onclick="saveWallet()" style="padding:11px 24px;">Save wallet</button>
        <span id="walletMsg" style="font-size:12.5px;color:var(--text-dim);">\${walletSet?'':'No wallet set yet — add one to get paid.'}</span>
      </div>
    </div>

    <div class="glass" style="padding:24px;">
      <div class="section-h">Your referrals</div>
      \${(d.referrals&&d.referrals.length) ? \`
        <div style="overflow-x:auto;"><table>
          <thead><tr><th>Panel</th><th>Sale</th><th>Your cut</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>\${d.referrals.map(r=>\`<tr>
            <td style="font-weight:600;">\${esc(r.tenant_name||'—')}</td>
            <td class="mono">\${money(r.sale_amount,d.payout_currency)}</td>
            <td class="mono" style="color:var(--success);font-weight:600;">\${money(r.commission_amount,d.payout_currency)}</td>
            <td>\${r.paid_out?'<span class="pill paid">'+IC.check+' Paid</span>':'<span class="pill owed">Owed</span>'}</td>
            <td class="mono" style="color:var(--text-dim);font-size:12px;">\${new Date(r.created_at).toLocaleDateString()}</td>
          </tr>\`).join('')}</tbody>
        </table></div>
      \` : '<div class="empty">No referrals yet. Share your code — when someone opens a panel with it, it shows up here.</div>'}
    </div>
  \`;
}

async function saveWallet(){
  const wallet = $('#walletAddr').value.trim();
  const currency = $('#walletCur').value;
  const msg = $('#walletMsg'); msg.textContent='Saving…'; msg.style.color='var(--text-dim)';
  try{
    const r = await fetch('/api/affiliate/wallet',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...SESSION,wallet,currency})});
    const d = await r.json();
    if(!r.ok){ msg.textContent=d.error||'Failed to save'; msg.style.color='var(--danger)'; return; }
    msg.textContent='Saved ✓'; msg.style.color='var(--success)';
  }catch{ msg.textContent='Network error'; msg.style.color='var(--danger)'; }
}

// Restore session
(function(){
  const saved = sessionStorage.getItem('aff_session');
  if(saved){ try{ SESSION = JSON.parse(saved); refresh(); }catch{} }
})();
</script>
</body>
</html>`;
