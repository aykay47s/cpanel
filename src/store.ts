// ClearPanel store — the public marketing/pricing page, served at the domain
// root. Prices and per-tier buy links come from operator-configured DB settings
// (price_3day/7day/14day/30day, buy_url_*); the operator never edits this file.
// Design: matches the panel's own dark violet/gold aesthetic. No emojis —
// every icon is an inline SVG. The showcase section is a pure-CSS mockup of
// the caller panel so buyers see what they're getting.

export interface StoreConfig {
  checkoutUrl: string;
  prices: { d3: string; d7: string; d14: string; d30: string; life: string };
  buyUrls: { d3: string; d7: string; d14: string; d30: string; life: string };
}

export function STORE_PAGE(cfg: StoreConfig | string, opts: { autoRedirect?: boolean } = {}): string {
  const config: StoreConfig = typeof cfg === 'string'
    ? { checkoutUrl: cfg, prices: { d3: '130', d7: '300', d14: '600', d30: '1250', life: '5000' }, buyUrls: { d3: cfg, d7: cfg, d14: cfg, d30: cfg, life: cfg } }
    : cfg;
  const cta = config.checkoutUrl || 'https://t.me/clearpanelotpbot';
  const P = config.prices;
  const B = config.buyUrls;
  const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6L9 17l-5-5"/></svg>';
  // If a logged-in panel user lands on the store (their PWA start_url or an old
  // bookmark), bounce them straight to the panel — they came here to work.
  const redirectScript = opts.autoRedirect
    ? `<script>try{if(localStorage.getItem('dispatch_me')){location.replace(localStorage.getItem('dispatch_home')||'/app');}}catch(e){}</script>`
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
/* ---------- interactive demo ---------- */
.demo-wrap{display:flex;gap:36px;align-items:flex-start;justify-content:center;flex-wrap:wrap;}
.phone.demo{transform:none;animation:none;width:320px;flex-shrink:0;}
.phone.demo .screen{display:flex;flex-direction:column;min-height:520px;}
.phone.demo .mock-body{flex:1;overflow:hidden;}
.mock-nav{display:flex;border-top:1px solid var(--border);background:rgba(255,255,255,.02);}
.mnav{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;background:transparent;border:none;color:var(--faint);font-size:9.5px;font-weight:700;font-family:inherit;cursor:pointer;transition:color .15s;}
.mnav svg{width:18px;height:18px;}
.mnav.on{color:var(--violet-soft);}
.demo-notes{max-width:380px;display:flex;flex-direction:column;gap:12px;}
.dn{padding:18px 20px;border-radius:var(--r);background:var(--panel);border:1px solid var(--border);font-size:13.5px;color:var(--dim);transition:border-color .25s,background .25s;}
.dn b{color:var(--text);display:block;margin-bottom:4px;font-size:14px;}
.dn.on{border-color:rgba(124,92,255,.5);background:var(--panel-2);}
.mrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;font-size:12px;color:var(--dim);border-bottom:1px solid var(--border);}
.mrow:last-child{border-bottom:none;}
.mbadge{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:100px;}
.mbadge.ok{background:rgba(52,211,153,.13);color:var(--success);}
.mbadge.warn{background:rgba(245,185,66,.12);color:var(--gold);}
.mbadge.dim{background:rgba(255,255,255,.06);color:var(--dim);}
.mcb{padding:10px 12px;border-radius:13px;background:rgba(245,185,66,.07);border:1px solid rgba(245,185,66,.25);font-size:11px;}
.mcb b{color:var(--gold-soft);font-size:10px;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:5px;}
.mchat-toggle{display:flex;gap:4px;padding:4px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);margin-bottom:4px;}
.mchat-toggle span{flex:1;text-align:center;padding:7px;border-radius:100px;font-size:11px;font-weight:700;color:var(--dim);}
.mchat-toggle span.on{background:var(--grad);color:#fff;}
.mbub{max-width:82%;padding:9px 12px;border-radius:15px;background:rgba(255,255,255,.06);border:1px solid var(--border);font-size:11.5px;}
.mbub.own{margin-left:auto;background:linear-gradient(135deg,rgba(124,92,255,.3),rgba(124,92,255,.16));border-color:rgba(124,92,255,.35);}
.mbub small{display:block;font-size:9px;color:var(--faint);margin-top:3px;}
.mlock{display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--success);font-weight:700;justify-content:center;padding:4px 0;}
.mlock svg{width:11px;height:11px;}
.mstat2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mstat2 .ms{padding:11px;border-radius:13px;background:var(--panel-2);border:1px solid var(--border);}
.mstat2 .ms b{font-family:'Bricolage Grotesque';font-size:18px;display:block;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.mstat2 .ms span{font-size:9.5px;color:var(--faint);font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
.mbulk{display:flex;gap:6px;align-items:center;padding:9px 11px;border-radius:12px;background:rgba(124,92,255,.1);border:1px solid rgba(124,92,255,.3);font-size:10px;font-weight:700;}
.mbulk i{font-style:normal;color:var(--violet-soft);}
/* ---------- guide ---------- */
.guide-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;}
.gcol{padding:26px 24px;border-radius:var(--r-lg);background:var(--panel);border:1px solid var(--border);}
.gtag{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:18px;}
.gstep{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);}
.gstep:last-child{border-bottom:none;}
.gstep i{font-style:normal;width:26px;height:26px;border-radius:9px;background:linear-gradient(135deg,rgba(124,92,255,.2),rgba(245,185,66,.12));border:1px solid rgba(124,92,255,.35);color:var(--violet-soft);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.gstep b{font-size:13.5px;display:block;margin-bottom:3px;}
.gstep p{font-size:12.5px;color:var(--dim);margin:0;}
/* ---------- 5-tier pricing ---------- */
.plans-5{grid-template-columns:repeat(auto-fit,minmax(210px,1fr));}
.plan li.inherit{color:var(--violet-soft);font-weight:700;padding-left:0;}
.plan.life{background:linear-gradient(180deg,rgba(245,185,66,.13),var(--panel));border-color:rgba(245,185,66,.5);}
.gold-tag{background:linear-gradient(135deg,var(--gold),#ff9d42);}

</style>
</head>
<body>
<div class="orbs"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="grain"></div>

<nav><div class="wrap nav-in">
  <a class="brand" href="/"><img src="/clearpanel-logo.png" alt=""><span class="wordmark">ClearPanel</span></a>
  <div class="nav-links">
    <a href="#showcase">Showcase</a><a href="#guide">Guide</a><a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
  </div>
  <div class="nav-cta">
    <a class="btn btn-ghost" href="/login">Panel Login</a>
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
  <div class="center rv"><div class="eyebrow">Live showcase</div>
  <h2 class="sec-title">Tap through the actual panel</h2>
  <p class="sec-sub">This is a working replica of the caller app — same screens, same buttons, same flow your team gets. Use the bottom navigation to move around.</p></div>
  <div class="demo-wrap rv">
    <div class="phone demo"><div class="screen">
      <div class="mock-top"><span class="mock-brand" id="dTitle">Your Panel</span><span class="mock-clock" id="dChip">CLOCKED IN 03:41:22</span></div>
      <div class="mock-body" id="dBody"></div>
      <div class="mock-nav">
        <button class="mnav on" data-s="queue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg><span>Queue</span></button>
        <button class="mnav" data-s="call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.8a2 2 0 01-.4 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.5 2.8.7a2 2 0 011.7 2z"/></svg><span>On Call</span></button>
        <button class="mnav" data-s="chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg><span>Chat</span></button>
        <button class="mnav" data-s="admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg><span>Admin</span></button>
      </div>
    </div></div>
    <div class="demo-notes">
      <div class="dn rv" data-for="queue"><b>The queue feeds itself.</b> Leads arrive as claim cards — bank category, masked number, attempt history. Retried leads show exactly what happened last time; after 3 failed attempts a lead leaves the floor entirely until an admin recirculates it. Due callbacks pin to the top at the right moment.</div>
      <div class="dn rv" data-for="call"><b>One tap ends every call.</b> The outcome grid is mandatory — a caller physically cannot move on without logging a result, so your data has no holes. Callbacks get a date picker; XP lands instantly.</div>
      <div class="dn rv" data-for="chat"><b>Floor talk, two channels.</b> Team chat for the room (with disappearing messages), and Direct — true end-to-end encrypted DMs sealed on the device. The server only ever relays ciphertext.</div>
      <div class="dn rv" data-for="admin"><b>The admin sees everything.</b> Live dashboard, bulk lead actions, callback + stale-lead views, one-tap maintenance banner to every caller, Telegram broadcasts, and the AI script writer on higher tiers.</div>
    </div>
  </div>
</div></section>

<section id="guide"><div class="wrap">
  <div class="center rv"><div class="eyebrow">The full guide</div>
  <h2 class="sec-title">Exactly how your team runs on it</h2>
  <p class="sec-sub">From key to first dial, this is the complete workflow — the same steps your admin and callers follow in the real panel.</p></div>
  <div class="guide-cols">
    <div class="gcol rv">
      <div class="gtag">Day zero — you</div>
      <div class="gstep"><i>1</i><div><b>Redeem your key</b><p>Enter it at the redeem page, name your call centre. Your panel spins up instantly at its own private URL with a fresh admin PIN — save both.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Open your admin panel</b><p>Log in with the PIN. Brand it — your name and logo replace ours everywhere, including the app icon your callers install.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Load your leads</b><p>Paste or import leads in bulk. The importer parses names and numbers, flags possible duplicates, and files everything under bank categories you pick.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Create your callers</b><p>Add each caller — every one gets their own PIN. Send them your panel link; they install it to their home screen like a native app.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Drop in scripts</b><p>Write scripts per audience (opener / closer) — or on 14-day+ plans, describe the pitch and let the AI writer draft the full script with objection handling.</p></div></div>
    </div>
    <div class="gcol rv">
      <div class="gtag">Every day — your callers</div>
      <div class="gstep"><i>1</i><div><b>Log in &amp; verify</b><p>PIN in, Telegram-verified once via a 6-digit code — no anonymous accounts on your floor. Then clock in; the timer runs on screen.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Claim from the queue</b><p>Due callbacks sit on top. Fresh leads first, retries labelled with their last outcome. One tap claims the lead and opens the call screen.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Call and log — no skipping</b><p>Script on screen, timer running. When the call ends they must pick an outcome — successful, callback (with a date), voicemail, no answer, busy, wrong number. XP lands on the spot.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Pass closes to a finisher</b><p>Successful calls flow to your finishing queue automatically, with every note attached — nothing lost in the handoff.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Climb the ranks</b><p>Eleven tiers from Seed to Legend, a live leaderboard, celebration animations on closes. At day's end they clock out — and get reminded if they forget.</p></div></div>
    </div>
    <div class="gcol rv">
      <div class="gtag">All week — running the floor</div>
      <div class="gstep"><i>1</i><div><b>Watch it live</b><p>The dashboard counts everything in real time — uncalled, attempted, exhausted, successful, awaiting finishing — with call durations per lead.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Work leads in bulk</b><p>Select any set of leads and assign, vault, reset or delete them together. The stale view surfaces anything untouched for N days.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Recirculate on your terms</b><p>Leads that hit the 3-attempt cap collect under a Max Attempts tile — one tap shows them, and only you decide if they go back out.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Broadcast &amp; maintain</b><p>Push a pulsing update banner to every caller instantly when you're changing things, and message the whole floor over Telegram.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Renew without drama</b><p>When your period ends the panel pauses with data intact — redeem the next key and everything resumes exactly where it stopped.</p></div></div>
    </div>
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
  <h2 class="sec-title">Pick your runway</h2>
  <p class="sec-sub">Unlimited callers and leads on every tier. Longer keys unlock more of the platform — and Lifetime unlocks all of it, forever.</p></div>
  <div class="plans plans-5">
    <div class="plan rv"><div class="dur">3 days</div><div class="price"><small>£</small>${P.d3}</div><div class="per">The trial run</div><ul>
      <li>${TICK}Smart lead queue + attempt caps</li>
      <li>${TICK}One-tap outcomes &amp; callbacks</li>
      <li>${TICK}Team chat + E2E encrypted DMs</li>
      <li>${TICK}XP ranks &amp; leaderboard</li>
      <li>${TICK}Bulk import + bank categories</li>
      <li>${TICK}Telegram-verified staff &amp; clock-in</li>
    </ul><a class="btn btn-ghost" href="${B.d3}" target="_blank" rel="noopener">Get 3 Days</a></div>
    <div class="plan rv"><div class="dur">7 days</div><div class="price"><small>£</small>${P.d7}</div><div class="per">A full working week</div><ul>
      <li class="inherit">Everything in 3 Day</li>
      <li>${TICK}Your own Telegram bot for your floor</li>
      <li>${TICK}Better per-day rate</li>
    </ul><a class="btn btn-ghost" href="${B.d7}" target="_blank" rel="noopener">Get 7 Days</a></div>
    <div class="plan hot rv"><span class="hot-tag">Most popular</span><div class="dur">14 days</div><div class="price"><small>£</small>${P.d14}</div><div class="per">Two weeks, AI included</div><ul>
      <li class="inherit">Everything in 7 Day</li>
      <li>${TICK}AI script writer — full scripts with objection handling in seconds</li>
    </ul><a class="btn btn-grad" href="${B.d14}" target="_blank" rel="noopener">Get 14 Days</a></div>
    <div class="plan rv"><div class="dur">30 days</div><div class="price"><small>£</small>${P.d30}</div><div class="per">The serious floor</div><ul>
      <li class="inherit">Everything in 14 Day</li>
      <li>${TICK}Telephony &amp; IVR — inbound routing, Twilio / Telnyx</li>
      <li>${TICK}Best per-day rate of the timed tiers</li>
    </ul><a class="btn btn-ghost" href="${B.d30}" target="_blank" rel="noopener">Get 30 Days</a></div>
    <div class="plan life rv"><span class="hot-tag gold-tag">Own it</span><div class="dur">Lifetime</div><div class="price"><small>£</small>${P.life}</div><div class="per">One key. Never expires.</div><ul>
      <li class="inherit">Everything in 30 Day</li>
      <li>${TICK}Panel never expires — no renewals, ever</li>
      <li>${TICK}Every future feature included</li>
    </ul><a class="btn btn-grad" href="${B.life}" target="_blank" rel="noopener">Get Lifetime</a></div>
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
  <div class="flinks"><a href="/login">Panel Login</a><a href="/redeem">Redeem</a><a href="/affiliate">Affiliates</a></div>
</div></footer>

<script>
(function(){
  var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });

  // ---- interactive panel demo ----
  var SCREENS = {
    queue: { title: 'Your Panel', chip: 'CLOCKED IN 03:41:22', chipStyle: '', html: ''
      + '<div class="mxp"><div class="medal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 15.4l-5.3 2.9 1.2-5.9L3.4 8.3l6-.7z"/></svg></div><div style="flex:1;"><div style="font-size:11px;font-weight:700;margin-bottom:4px;">Closer II</div><div class="bar"><i></i></div></div><small>2,140 XP</small></div>'
      + '<div class="mcb"><b>Due Callbacks (1)</b><div style="display:flex;justify-content:space-between;align-items:center;"><span>Sandra P. — 2:00 PM today</span><span class="mbadge warn">CALL NOW</span></div></div>'
      + '<div class="mlead"><span class="tag">New Lead</span><b>Margaret W.</b><span>+44 7911 ... .38 &middot; Barclays</span><div class="mbtn">Claim &amp; Call</div></div>'
      + '<div class="mlead"><span class="tag retry">Called 1 time &mdash; no success yet</span><b>Derek H.</b><span>+44 7700 ... .92 &middot; HSBC</span><div style="display:flex;gap:6px;align-items:center;margin-top:6px;"><span class="mbadge dim">Last: Voicemail</span></div><div class="mbtn dark">Claim &amp; Retry</div></div>' },
    call: { title: 'On Call', chip: 'LIVE 04:52', chipStyle: 'background:rgba(245,185,66,.12);color:#f5b942;border-color:rgba(245,185,66,.3);', html: ''
      + '<div class="mcall"><div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div><b>Margaret W.</b><div class="timer">04:52</div>'
      + '<div class="mgrid"><div class="mout good">Successful</div><div class="mout mid">Callback</div><div class="mout dim2">No Answer</div><div class="mout dim2">Voicemail</div><div class="mout dim2">Busy</div><div class="mout dim2">Hung Up</div></div>'
      + '<div class="mout mid" style="margin-top:8px;">Number Not Recognised</div></div>'
      + '<div class="mcb"><b>Schedule Callback</b><div style="display:flex;justify-content:space-between;align-items:center;"><span>Tomorrow 2:00 PM</span><span class="mbadge warn">BOOK IT</span></div></div>'
      + '<div style="font-size:10px;color:var(--faint);text-align:center;">An outcome is required before moving on &mdash; no skipped logs.</div>' },
    chat: { title: 'Messages', chip: '4 ONLINE', chipStyle: '', html: ''
      + '<div class="mchat-toggle"><span class="on">Team</span><span>Direct</span></div>'
      + '<div class="mbub">Anyone got the closer script for the HSBC batch?<small>Jamie &middot; 2:14 PM</small></div>'
      + '<div class="mbub own">Scripts tab, second one down. Updated today.<small>You &middot; 2:15 PM</small></div>'
      + '<div class="mbub">Margaret W. closed. 4th today.<small>Jamie &middot; 2:31 PM</small></div>'
      + '<div class="mlock"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Direct messages are end-to-end encrypted</div>' },
    admin: { title: 'Admin', chip: 'FLOOR OPEN', chipStyle: 'background:rgba(52,211,153,.14);color:#34d399;border-color:rgba(52,211,153,.3);', html: ''
      + '<div class="mstat2"><div class="ms"><b>214</b><span>Uncalled</span></div><div class="ms"><b>38</b><span>Attempted</span></div><div class="ms"><b>12</b><span>Successful</span></div><div class="ms"><b>3</b><span>Max Attempts</span></div></div>'
      + '<div class="mbulk"><i>4 leads selected</i><span style="margin-left:auto;">Assign</span><span>Vault</span><span>Reset</span></div>'
      + '<div class="mrow"><span>Margaret W.</span><span class="mbadge ok">Successful</span></div>'
      + '<div class="mrow"><span>Derek H.</span><span class="mbadge warn">Attempted &middot; 2</span></div>'
      + '<div class="mrow"><span>Sandra P.</span><span class="mbadge warn">Callback 2PM</span></div>'
      + '<div class="mrow"><span>Alan T.</span><span class="mbadge dim">Not Called</span></div>' }
  };
  var body = document.getElementById('dBody'), title = document.getElementById('dTitle'), chip = document.getElementById('dChip');
  function show(k){
    var sc = SCREENS[k]; if (!sc || !body) return;
    body.innerHTML = sc.html; title.textContent = sc.title;
    chip.textContent = sc.chip; chip.setAttribute('style', sc.chipStyle);
    document.querySelectorAll('.mnav').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-s') === k); });
    document.querySelectorAll('.dn').forEach(function(n){ n.classList.toggle('on', n.getAttribute('data-for') === k); });
  }
  document.querySelectorAll('.mnav').forEach(function(b){ b.addEventListener('click', function(){ show(b.getAttribute('data-s')); }); });
  show('queue');
})();
</script>
</body>
</html>`;
}

// The /login access hub — the answer to "I bought a panel, where do I log in?".
// Three ways in: panel code (slug), username, or the license key itself (which
// doubles as a receipt — redeemed keys route to their panel, fresh ones to /redeem).
export function ACCESS_PAGE(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClearPanel — Find Your Panel</title>
<link rel="icon" href="/clearpanel-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#07070a;--panel:rgba(255,255,255,.035);--border:rgba(255,255,255,.09);--border-2:rgba(255,255,255,.15);--text:#f2f1f7;--dim:#9b99a8;--faint:#67656f;--violet:#7c5cff;--violet-soft:#a18aff;--gold:#f5b942;--success:#34d399;--danger:#f87171;--grad:linear-gradient(135deg,var(--violet),var(--gold));}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Inter',-apple-system,sans-serif;background:radial-gradient(ellipse 70% 45% at 20% -5%,rgba(124,92,255,.16),transparent 60%),radial-gradient(ellipse 60% 45% at 100% 10%,rgba(245,185,66,.08),transparent 60%),var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:26px 18px;-webkit-font-smoothing:antialiased;}
h1,.brand{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;}
a{color:inherit;text-decoration:none;}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;margin-bottom:40px;}
.brand img{width:28px;height:28px;border-radius:8px;}
.card{width:100%;max-width:420px;background:var(--panel);border:1px solid var(--border-2);border-radius:26px;padding:34px 28px;backdrop-filter:blur(12px);box-shadow:0 24px 70px rgba(0,0,0,.5);}
h1{font-size:22px;font-weight:800;margin-bottom:6px;}
.sub{font-size:13px;color:var(--dim);margin-bottom:26px;}
.seg{display:flex;gap:4px;padding:4px;border-radius:100px;background:rgba(255,255,255,.045);border:1px solid var(--border);margin-bottom:22px;}
.seg button{flex:1;padding:9px 6px;border-radius:100px;border:none;background:transparent;color:var(--dim);font-size:12px;font-weight:700;font-family:inherit;cursor:pointer;transition:color .15s;}
.seg button.on{background:var(--grad);color:#fff;}
label{display:block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:7px;}
input{width:100%;padding:14px 16px;border-radius:14px;border:1px solid var(--border-2);background:rgba(255,255,255,.05);color:var(--text);font-size:14.5px;font-family:inherit;outline:none;transition:border-color .15s,box-shadow .15s;}
input:focus{border-color:var(--violet);box-shadow:0 0 0 3px rgba(124,92,255,.18);}
input::placeholder{color:var(--faint);}
.go{width:100%;margin-top:16px;padding:14px;border-radius:100px;border:none;background:var(--grad);color:#fff;font-size:14.5px;font-weight:700;font-family:inherit;cursor:pointer;box-shadow:0 4px 18px rgba(124,92,255,.35);transition:transform .15s,box-shadow .15s;}
.go:active{transform:scale(.97);}
.status{min-height:20px;margin-top:14px;font-size:12.5px;text-align:center;}
.status.err{color:var(--danger);}
.status.ok{color:var(--success);}
.hint{font-size:11.5px;color:var(--faint);margin-top:8px;line-height:1.5;}
.links{margin-top:26px;display:flex;gap:18px;font-size:12.5px;color:var(--faint);justify-content:center;}
.links a:hover{color:var(--text);}
.pane{display:none;}
.pane.on{display:block;}
</style>
</head>
<body>
<a class="brand" href="/"><img src="/clearpanel-logo.png" alt=""><span>ClearPanel</span></a>
<div class="card">
  <h1>Find your panel</h1>
  <div class="sub">Every call centre has its own private panel. Tell us which one is yours.</div>
  <div class="seg">
    <button class="on" data-p="code">Panel code</button>
    <button data-p="user">Username</button>
    <button data-p="key">License key</button>
  </div>
  <div class="pane on" data-pane="code">
    <label>Your panel code</label>
    <input id="inCode" placeholder="e.g. northline-calls" autocapitalize="none" autocomplete="off" />
    <div class="hint">It is the last part of your panel link — yourpanel.com/<b>this-part</b>. Your admin has it.</div>
  </div>
  <div class="pane" data-pane="user">
    <label>Your username</label>
    <input id="inUser" placeholder="e.g. jamie_w" autocapitalize="none" autocomplete="off" />
    <div class="hint">The username on your caller account. We will route you to the right panel.</div>
  </div>
  <div class="pane" data-pane="key">
    <label>Your license key</label>
    <input id="inKey" placeholder="XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" autocomplete="off" />
    <div class="hint">The key you bought. Unredeemed keys go to setup; redeemed keys go straight to their panel.</div>
  </div>
  <button class="go" id="goBtn">Continue</button>
  <div class="status" id="status"></div>
</div>
<div class="links"><a href="/">Store</a><a href="/redeem">Redeem a key</a><a href="/app">Frap Ties staff</a></div>
<script>
(function(){
  var mode = 'code';
  var st = document.getElementById('status');
  document.querySelectorAll('.seg button').forEach(function(b){
    b.addEventListener('click', function(){
      mode = b.getAttribute('data-p');
      document.querySelectorAll('.seg button').forEach(function(x){ x.classList.toggle('on', x === b); });
      document.querySelectorAll('.pane').forEach(function(pn){ pn.classList.toggle('on', pn.getAttribute('data-pane') === mode); });
      st.textContent = ''; st.className = 'status';
    });
  });
  function say(msg, cls){ st.textContent = msg; st.className = 'status ' + (cls || ''); }
  async function go(){
    say('Looking...', '');
    try {
      if (mode === 'code') {
        var code = document.getElementById('inCode').value.trim().toLowerCase();
        if (!code) return say('Enter your panel code.', 'err');
        var r = await fetch('/api/panel-by-code/' + encodeURIComponent(code));
        var d = await r.json();
        if (!r.ok) return say(d.error || 'No panel found with that code.', 'err');
        say('Found ' + d.data.panel_name + ' — taking you there', 'ok');
        location.href = d.data.url;
      } else if (mode === 'user') {
        var u = document.getElementById('inUser').value.trim();
        if (!u) return say('Enter your username.', 'err');
        var r2 = await fetch('/api/panel-by-username/' + encodeURIComponent(u));
        var d2 = await r2.json();
        if (!r2.ok) return say(d2.error || 'No panel found for that username.', 'err');
        say('Found ' + d2.data.panel_name + ' — taking you there', 'ok');
        location.href = d2.data.url;
      } else {
        var k = document.getElementById('inKey').value.trim().toUpperCase();
        if (!k) return say('Enter your license key.', 'err');
        var r3 = await fetch('/api/access/key/' + encodeURIComponent(k));
        var d3 = await r3.json();
        if (!r3.ok) return say(d3.error || 'Key not found.', 'err');
        if (d3.data.redeemed) { say('Found ' + d3.data.panel_name + ' — taking you there', 'ok'); location.href = d3.data.url; }
        else { say('Fresh key — taking you to setup', 'ok'); location.href = '/redeem?key=' + encodeURIComponent(k); }
      }
    } catch (e) { say('Something went wrong — try again.', 'err'); }
  }
  document.getElementById('goBtn').addEventListener('click', go);
  document.querySelectorAll('input').forEach(function(i){ i.addEventListener('keydown', function(e){ if (e.key === 'Enter') go(); }); });
})();
</script>
</body>
</html>`;
}
