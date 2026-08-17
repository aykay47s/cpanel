// ClearPanel store — the public marketing/pricing page, served at the domain
// root. Prices and per-tier buy links come from operator-configured DB settings
// (price_3day/7day/14day/30day, buy_url_*); the operator never edits this file.
// Design: matches the panel's own dark violet/gold aesthetic. No emojis —
// every icon is an inline SVG. The showcase section is a pure-CSS mockup of
// the caller panel so buyers see what they're getting.

export interface StoreConfig {
  checkoutUrl: string;
  prices: { d3: string; d7: string; d14: string; d30: string };
  buyUrls: { d3: string; d7: string; d14: string; d30: string };
}

export function STORE_PAGE(cfg: StoreConfig | string, opts: { autoRedirect?: boolean } = {}): string {
  const config: StoreConfig = typeof cfg === 'string'
    ? { checkoutUrl: cfg, prices: { d3: '130', d7: '300', d14: '600', d30: '1250' }, buyUrls: { d3: cfg, d7: cfg, d14: cfg, d30: cfg } }
    : cfg;
  const cta = config.checkoutUrl || 'https://t.me/clearpanelotpbot';
  const P = config.prices;
  const B = config.buyUrls;
  // If a logged-in panel user lands on the store (their PWA start_url or an old
  // bookmark), bounce them straight to the panel — they came here to work.
  const redirectScript = opts.autoRedirect
    ? `<script>try{if(localStorage.getItem('dispatch_me')){location.replace('/app');}}catch(e){}</script>`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClearPanel — Run Your Call Floor Like a Machine</title>
<meta name="description" content="ClearPanel is a complete call-centre operations panel: smart lead queues, one-tap outcomes, scheduled callbacks, XP ranks, encrypted team messaging and AI script writing. Redeem a key, get your own panel in under a minute.">
<link rel="icon" href="/clearpanel-icon.png">
${redirectScript}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#07070a;--bg-2:#0d0d13;--panel:rgba(255,255,255,.032);--panel-2:rgba(255,255,255,.055);
  --border:rgba(255,255,255,.08);--border-2:rgba(255,255,255,.13);
  --text:#f2f1f7;--dim:#9b99a8;--faint:#67656f;
  --violet:#7c5cff;--violet-soft:#a18aff;--gold:#f5b942;--gold-soft:#ffd684;
  --success:#34d399;--r:18px;--r-lg:26px;
  --grad:linear-gradient(135deg,var(--violet),var(--gold));
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Inter',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
h1,h2,h3,.wordmark{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;}
a{color:inherit;text-decoration:none;}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px;}
::selection{background:rgba(124,92,255,.35);}

/* ---------- ambient background ---------- */
.orbs{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;}
.orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.32;animation:drift 22s ease-in-out infinite alternate;}
.orb.a{width:520px;height:520px;background:radial-gradient(circle,#5b3df0,transparent 65%);top:-160px;left:-120px;}
.orb.b{width:460px;height:460px;background:radial-gradient(circle,#b8862a,transparent 65%);top:22%;right:-180px;animation-delay:-8s;}
.orb.c{width:600px;height:600px;background:radial-gradient(circle,#3d2b8f,transparent 65%);bottom:-240px;left:28%;animation-delay:-15s;}
@keyframes drift{from{transform:translate(0,0) scale(1);}to{transform:translate(60px,40px) scale(1.12);}}
.grain{position:fixed;inset:0;z-index:-1;opacity:.5;background-image:radial-gradient(rgba(255,255,255,.014) 1px,transparent 1px);background-size:3px 3px;pointer-events:none;}

/* ---------- nav ---------- */
nav{position:sticky;top:0;z-index:50;backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);background:rgba(7,7,10,.72);border-bottom:1px solid var(--border);}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:64px;}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:17px;}
.brand img{width:30px;height:30px;border-radius:8px;}
.nav-links{display:flex;gap:26px;font-size:13.5px;font-weight:500;color:var(--dim);}
.nav-links a{transition:color .15s;}
.nav-links a:hover{color:var(--text);}
.nav-cta{display:flex;gap:10px;align-items:center;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border-radius:100px;font-size:13.5px;font-weight:600;border:none;cursor:pointer;transition:transform .16s cubic-bezier(.34,1.56,.64,1),box-shadow .16s,background .16s;white-space:nowrap;}
.btn:active{transform:scale(.96);}
.btn-grad{background:var(--grad);color:#fff;box-shadow:0 4px 18px rgba(124,92,255,.35);}
.btn-grad:hover{transform:translateY(-1px);box-shadow:0 8px 26px rgba(124,92,255,.5);}
.btn-ghost{background:var(--panel);border:1px solid var(--border-2);color:var(--text);}
.btn-ghost:hover{background:var(--panel-2);}
.btn-lg{padding:15px 28px;font-size:15px;}
@media(max-width:760px){.nav-links{display:none;}}

/* ---------- hero ---------- */
.hero{padding:92px 0 60px;text-align:center;position:relative;}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:100px;background:var(--panel);border:1px solid var(--border-2);font-size:12.5px;font-weight:600;color:var(--gold-soft);margin-bottom:26px;}
.pill .dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.hero h1{font-size:clamp(38px,6.4vw,68px);font-weight:800;line-height:1.06;margin-bottom:22px;}
.hero h1 .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.hero p{font-size:clamp(15px,2vw,18px);color:var(--dim);max-width:600px;margin:0 auto 36px;}
.hero-ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:56px;}
.hero-stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.hstat{padding:14px 22px;border-radius:var(--r);background:var(--panel);border:1px solid var(--border);backdrop-filter:blur(8px);}
.hstat b{display:block;font-size:20px;font-family:'Bricolage Grotesque';background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.hstat span{font-size:11.5px;color:var(--faint);font-weight:500;}

/* ---------- reveal ---------- */
.rv{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s cubic-bezier(.22,1,.36,1);}
.rv.in{opacity:1;transform:none;}

/* ---------- section scaffolding ---------- */
section{padding:76px 0;}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--violet-soft);margin-bottom:12px;}
.sec-title{font-size:clamp(26px,4vw,40px);font-weight:800;margin-bottom:14px;}
.sec-sub{color:var(--dim);font-size:15px;max-width:560px;margin-bottom:44px;}
.center{text-align:center;}
.center .sec-sub{margin-left:auto;margin-right:auto;}

/* ---------- showcase mockups ---------- */
.showcase{display:flex;gap:34px;align-items:center;justify-content:center;flex-wrap:wrap;perspective:1400px;}
.phone{width:300px;border-radius:38px;background:linear-gradient(180deg,#17161f,#0c0b12);border:1px solid var(--border-2);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 8px rgba(255,255,255,.03);padding:14px;transform:rotateY(-8deg) rotateX(3deg);animation:float 7s ease-in-out infinite;}
.phone.p2{transform:rotateY(8deg) rotateX(2deg);animation-delay:-3.5s;}
@keyframes float{0%,100%{translate:0 0;}50%{translate:0 -14px;}}
.screen{border-radius:26px;background:#0a0a0f;border:1px solid var(--border);overflow:hidden;}
.mock-top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);}
.mock-brand{font-size:13px;font-weight:700;font-family:'Bricolage Grotesque';}
.mock-clock{font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:100px;background:rgba(52,211,153,.14);color:var(--success);border:1px solid rgba(52,211,153,.3);}
.mock-body{padding:14px;display:flex;flex-direction:column;gap:11px;}
.mlead{border-radius:16px;background:var(--panel-2);border:1px solid var(--border-2);padding:13px;}
.mlead .tag{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.1em;color:var(--success);text-transform:uppercase;margin-bottom:6px;}
.mlead .tag.retry{color:var(--gold);}
.mlead b{font-size:14px;display:block;}
.mlead span{font-size:11px;color:var(--faint);font-family:ui-monospace,monospace;}
.mbtn{margin-top:10px;text-align:center;padding:10px;border-radius:12px;background:var(--grad);font-size:12px;font-weight:700;color:#fff;}
.mbtn.dark{background:var(--panel);border:1px solid var(--border-2);color:var(--dim);font-weight:600;}
.mxp{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:14px;background:var(--panel);border:1px solid var(--border);}
.mxp .medal{width:34px;height:34px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mxp .medal svg{width:17px;height:17px;color:#fff;}
.mxp .bar{flex:1;height:7px;border-radius:100px;background:rgba(255,255,255,.08);overflow:hidden;}
.mxp .bar i{display:block;height:100%;width:68%;border-radius:100px;background:var(--grad);animation:fillxp 2.4s cubic-bezier(.22,1,.36,1) both;}
@keyframes fillxp{from{width:8%;}}
.mxp small{font-size:10px;color:var(--faint);font-weight:700;white-space:nowrap;}
.mcall{text-align:center;padding:18px 13px;}
.mcall .avatar{width:56px;height:56px;border-radius:50%;background:var(--grad);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;}
.mcall .avatar svg{width:26px;height:26px;color:#fff;}
.mcall b{font-size:15px;display:block;}
.mcall .timer{font-size:24px;font-weight:800;font-family:'Bricolage Grotesque';background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0 12px;}
.mgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mout{padding:9px 6px;border-radius:11px;font-size:10.5px;font-weight:700;text-align:center;border:1px solid;}
.mout.good{background:rgba(52,211,153,.1);border-color:rgba(52,211,153,.3);color:var(--success);}
.mout.mid{background:rgba(245,185,66,.08);border-color:rgba(245,185,66,.28);color:var(--gold);}
.mout.dim2{background:var(--panel);border-color:var(--border-2);color:var(--dim);}
@media(max-width:720px){.phone{transform:none;} .phone.p2{transform:none;}}

/* ---------- features ---------- */
.feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;}
.feat{padding:26px;border-radius:var(--r-lg);background:var(--panel);border:1px solid var(--border);transition:transform .25s cubic-bezier(.22,1,.36,1),border-color .25s,background .25s;position:relative;overflow:hidden;}
.feat:hover{transform:translateY(-4px);border-color:rgba(124,92,255,.4);background:var(--panel-2);}
.feat::after{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:var(--grad);opacity:0;transition:opacity .25s;}
.feat:hover::after{opacity:.8;}
.fic{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,rgba(124,92,255,.18),rgba(245,185,66,.12));border:1px solid rgba(124,92,255,.3);display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
.fic svg{width:21px;height:21px;color:var(--violet-soft);}
.feat h3{font-size:16.5px;margin-bottom:8px;}
.feat p{font-size:13.5px;color:var(--dim);}

/* ---------- how ---------- */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;counter-reset:step;}
.step{padding:28px 24px;border-radius:var(--r-lg);background:var(--panel);border:1px solid var(--border);position:relative;}
.step::before{counter-increment:step;content:counter(step,decimal-leading-zero);font-family:'Bricolage Grotesque';font-size:38px;font-weight:800;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:.9;display:block;margin-bottom:12px;}
.step h3{font-size:16px;margin-bottom:8px;}
.step p{font-size:13.5px;color:var(--dim);}

/* ---------- pricing ---------- */
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;align-items:stretch;}
.plan{padding:28px 24px;border-radius:var(--r-lg);background:var(--panel);border:1px solid var(--border);display:flex;flex-direction:column;transition:transform .25s cubic-bezier(.22,1,.36,1),border-color .25s;}
.plan:hover{transform:translateY(-4px);}
.plan.hot{background:linear-gradient(180deg,rgba(124,92,255,.14),var(--panel));border-color:rgba(124,92,255,.5);position:relative;}
.plan.hot .hot-tag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);padding:4px 14px;border-radius:100px;background:var(--grad);font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#fff;white-space:nowrap;}
.plan .dur{font-size:13px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;}
.plan .price{font-family:'Bricolage Grotesque';font-size:40px;font-weight:800;line-height:1;margin-bottom:4px;}
.plan .price small{font-size:16px;font-weight:700;color:var(--dim);}
.plan .per{font-size:11.5px;color:var(--faint);margin-bottom:20px;}
.plan ul{list-style:none;margin-bottom:24px;flex:1;}
.plan li{font-size:12.5px;color:var(--dim);padding:5px 0;display:flex;align-items:center;gap:8px;}
.plan li svg{width:14px;height:14px;color:var(--success);flex-shrink:0;}
.plan .btn{width:100%;}

/* ---------- faq ---------- */
.faq{max-width:680px;margin:0 auto;}
.faq details{border:1px solid var(--border);border-radius:var(--r);background:var(--panel);margin-bottom:10px;overflow:hidden;}
.faq summary{padding:18px 22px;font-size:14.5px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;}
.faq summary::-webkit-details-marker{display:none;}
.faq summary::after{content:'+';font-size:20px;color:var(--dim);transition:transform .2s;flex-shrink:0;}
.faq details[open] summary::after{transform:rotate(45deg);}
.faq .a{padding:0 22px 18px;font-size:13.5px;color:var(--dim);}

/* ---------- final cta + footer ---------- */
.final{border-radius:var(--r-lg);background:linear-gradient(135deg,rgba(124,92,255,.16),rgba(245,185,66,.08));border:1px solid rgba(124,92,255,.35);padding:56px 28px;text-align:center;}
footer{border-top:1px solid var(--border);padding:34px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--faint);}
footer .flinks{display:flex;gap:20px;}
footer a:hover{color:var(--text);}
</style>
</head>
<body>
<div class="orbs"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="grain"></div>

<nav><div class="wrap nav-in">
  <a class="brand" href="/"><img src="/clearpanel-logo.png" alt=""><span class="wordmark">ClearPanel</span></a>
  <div class="nav-links">
    <a href="#showcase">Showcase</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
  </div>
  <div class="nav-cta">
    <a class="btn btn-ghost" href="/app">Panel Login</a>
    <a class="btn btn-grad" href="/redeem">Redeem Key</a>
  </div>
</div></nav>

<header class="hero wrap">
  <div class="pill"><span class="dot"></span>Panels activate instantly — no setup calls, no waiting</div>
  <h1>Run your call floor<br><span class="grad-text">like a machine.</span></h1>
  <p>ClearPanel hands your callers a queue, a script and a one-tap outcome flow — and hands you the numbers. Your own private panel, live in under a minute.</p>
  <div class="hero-ctas">
    <a class="btn btn-grad btn-lg" href="#pricing">See Pricing</a>
    <a class="btn btn-ghost btn-lg" href="/redeem">I Have a Key</a>
  </div>
  <div class="hero-stats">
    <div class="hstat"><b>&lt; 60s</b><span>from key to live panel</span></div>
    <div class="hstat"><b>1-tap</b><span>call outcomes &amp; callbacks</span></div>
    <div class="hstat"><b>E2E</b><span>encrypted direct messages</span></div>
  </div>
</header>

<section id="showcase"><div class="wrap">
  <div class="center rv"><div class="eyebrow">Showcase</div>
  <h2 class="sec-title">This is what your callers open every morning</h2>
  <p class="sec-sub">A live queue that feeds them leads, a call screen that logs everything in one tap, and ranks that keep them competing.</p></div>
  <div class="showcase rv">
    <div class="phone"><div class="screen">
      <div class="mock-top"><span class="mock-brand">Your Panel</span><span class="mock-clock">CLOCKED IN 03:41:22</span></div>
      <div class="mock-body">
        <div class="mxp"><div class="medal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 15.4l-5.3 2.9 1.2-5.9L3.4 8.3l6-.7z"/></svg></div><div style="flex:1;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Closer II</div><div class="bar"><i></i></div></div><small>2,140 XP</small></div>
        <div class="mlead"><span class="tag">New Lead</span><b>Margaret W.</b><span>+44 7911 ••• •38</span><div class="mbtn">Claim &amp; Call</div></div>
        <div class="mlead"><span class="tag retry">Called 1 time</span><b>Derek H.</b><span>+44 7700 ••• •92</span><div class="mbtn dark">Voicemail last time</div></div>
      </div>
    </div></div>
    <div class="phone p2"><div class="screen">
      <div class="mock-top"><span class="mock-brand">On Call</span><span class="mock-clock" style="background:rgba(245,185,66,.12);color:var(--gold);border-color:rgba(245,185,66,.3);">LIVE</span></div>
      <div class="mock-body">
        <div class="mcall">
          <div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
          <b>Margaret W.</b>
          <div class="timer">04:52</div>
          <div class="mgrid">
            <div class="mout good">Successful</div>
            <div class="mout mid">Callback</div>
            <div class="mout dim2">No Answer</div>
            <div class="mout dim2">Voicemail</div>
          </div>
        </div>
        <div class="mxp" style="border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.06);"><div class="medal" style="background:var(--success);"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg></div><div style="flex:1;font-size:11.5px;font-weight:700;">+100 XP — outcome logged</div></div>
      </div>
    </div></div>
  </div>
</div></section>

<section id="features"><div class="wrap">
  <div class="center rv"><div class="eyebrow">Everything included</div>
  <h2 class="sec-title">Built for floors that actually dial</h2>
  <p class="sec-sub">Every panel ships with the full toolkit. No add-ons, no per-seat pricing, no feature gates.</p></div>
  <div class="feat-grid">
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><h3>Smart lead queue</h3><p>Leads flow to callers automatically. Attempt caps stop dead numbers circulating, callbacks resurface at exactly the right time, and nothing gets called twice by accident.</p></div>
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><h3>One-tap outcomes</h3><p>Successful, callback, voicemail, no answer — one tap logs it, awards XP and pulls the next lead. Outcomes are mandatory, so your data is never full of holes.</p></div>
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 15.4l-5.3 2.9 1.2-5.9L3.4 8.3l6-.7z"/></svg></div><h3>Ranks &amp; leaderboards</h3><p>Eleven rank tiers from Seed to Legend. XP for every logged call, live leaderboards, celebration animations on closes — your floor competes with itself.</p></div>
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><h3>Encrypted messaging</h3><p>Team chat with disappearing messages, plus true end-to-end encrypted DMs — sealed on the device, unreadable by the server. Your floor talk stays yours.</p></div>
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2.5L2.8 9.7c-.9.35-.85 1.65.08 1.92l4.62 1.34 1.7 5.5c.27.87 1.4.98 1.85.18l2.3-4.1 4.9 3.6c.75.55 1.8.13 1.97-.78l3.1-13.3c.2-.9-.68-1.65-1.52-1.32z"/></svg></div><h3>Telegram-verified staff</h3><p>Every caller verifies through Telegram before they can dial. Clock-in tracking, clock-out reminders, and broadcast announcements straight to their phones.</p></div>
    <div class="feat rv"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg></div><h3>AI script writer</h3><p>Describe the pitch, pick the audience, get a full call script — opener, qualifying questions, objection handling and close — in seconds. Multi-provider failover keeps it up.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="center rv"><div class="eyebrow">How it works</div>
  <h2 class="sec-title">Key to live panel in three steps</h2></div>
  <div class="steps">
    <div class="step rv"><h3>Buy an access key</h3><p>Pick a duration below. You get a one-time license key — yours to redeem whenever you're ready.</p></div>
    <div class="step rv"><h3>Redeem it</h3><p>Enter the key, name your call centre, done. Your own panel spins up instantly with a fresh admin PIN.</p></div>
    <div class="step rv"><h3>Add your floor</h3><p>Create callers, drop in leads, set your scripts. Your team logs in from any phone or laptop — nothing to install.</p></div>
  </div>
</div></section>

<section id="pricing"><div class="wrap">
  <div class="center rv"><div class="eyebrow">Pricing</div>
  <h2 class="sec-title">Pay for the days, own everything in them</h2>
  <p class="sec-sub">Every tier is the full product — every feature, unlimited callers and leads. The only difference is how long the panel stays live.</p></div>
  <div class="plans">
    <div class="plan rv"><div class="dur">3 days</div><div class="price"><small>£</small>${P.d3}</div><div class="per">Perfect for a trial run</div><ul><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Full feature set</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Unlimited callers</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Instant activation</li></ul><a class="btn btn-ghost" href="${B.d3}" target="_blank" rel="noopener">Get 3 Days</a></div>
    <div class="plan rv"><div class="dur">7 days</div><div class="price"><small>£</small>${P.d7}</div><div class="per">A full working week</div><ul><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Full feature set</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Unlimited callers</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Instant activation</li></ul><a class="btn btn-ghost" href="${B.d7}" target="_blank" rel="noopener">Get 7 Days</a></div>
    <div class="plan hot rv"><span class="hot-tag">Most popular</span><div class="dur">14 days</div><div class="price"><small>£</small>${P.d14}</div><div class="per">Two weeks of full throughput</div><ul><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Full feature set</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Unlimited callers</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Instant activation</li></ul><a class="btn btn-grad" href="${B.d14}" target="_blank" rel="noopener">Get 14 Days</a></div>
    <div class="plan rv"><div class="dur">30 days</div><div class="price"><small>£</small>${P.d30}</div><div class="per">Best value per day</div><ul><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Full feature set</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Unlimited callers</li><li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>Instant activation</li></ul><a class="btn btn-ghost" href="${B.d30}" target="_blank" rel="noopener">Get 30 Days</a></div>
  </div>
</div></section>

<section id="faq"><div class="wrap">
  <div class="center rv"><div class="eyebrow">FAQ</div><h2 class="sec-title">Quick answers</h2></div>
  <div class="faq rv">
    <details><summary>How fast is my panel live after I redeem a key?</summary><div class="a">Immediately. Redemption creates your panel, your URL and your admin PIN in one step — most people are inviting callers within the first minute.</div></details>
    <details><summary>Do my callers need to install anything?</summary><div class="a">No. The panel runs in any browser and installs to a phone home screen like a native app. Callers just need the link and their PIN.</div></details>
    <details><summary>What happens when my access period ends?</summary><div class="a">The panel pauses — data stays intact. Redeem another key or renew to pick up exactly where you left off.</div></details>
    <details><summary>Is there a limit on callers or leads?</summary><div class="a">No. Every tier includes unlimited callers, unlimited leads and every feature. Tiers only differ in duration.</div></details>
  </div>
</div></section>

<section><div class="wrap"><div class="final rv">
  <h2 class="sec-title">Ready when you are</h2>
  <p class="sec-sub" style="margin:0 auto 28px;">Grab a key, redeem it, and your floor is dialing today.</p>
  <div class="hero-ctas" style="margin:0;">
    <a class="btn btn-grad btn-lg" href="${cta}" target="_blank" rel="noopener">Get a Key</a>
    <a class="btn btn-ghost btn-lg" href="/redeem">Redeem a Key</a>
  </div>
</div></div></section>

<footer><div class="wrap" style="display:contents;">
  <span>ClearPanel</span>
  <div class="flinks"><a href="/app">Panel Login</a><a href="/redeem">Redeem</a><a href="/affiliate">Affiliates</a></div>
</div></footer>

<script>
(function(){
  var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });
})();
</script>
</body>
</html>`;
}
