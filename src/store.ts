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
  const TICK = '<span class="plan-tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2"><path d="M20 6L9 17l-5-5"/></svg></span>';
  // Per-day framing, computed from whatever the operator actually set — shown
  // only when the price parses as a number, silently omitted otherwise.
  const perDay = (price: string, days: number): string => {
    const n = parseFloat(String(price).replace(/[^0-9.]/g, ''));
    if (!isFinite(n) || n <= 0) return '';
    return '<span class="per-day">\u2248 \u00a3' + (n / days).toFixed(2) + ' / day</span>';
  };
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
<title>ClearPanel — Get Your Own Call Center</title>
<meta name="description" content="ClearPanel is a complete call-centre operations panel: smart lead queues, one-tap outcomes, scheduled callbacks, XP ranks, encrypted team messaging and AI script writing. Redeem a key, get your own panel in under a minute.">
<link rel="icon" href="/clearpanel-icon.png">
${redirectScript}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
/* Design tokens copied 1:1 from the actual panel (src/frontend.ts :root) so
   the store, the showcase, and the real product are visually one thing. */
:root{
  --bg:#050507;--bg-2:#0b0b0f;--s1:#141419;--s2:#1c1c23;--s3:#26262f;
  --border:rgba(255,255,255,.065);--border-2:rgba(255,255,255,.12);
  --gold:#4f8cff;--gold-bright:#7aabff;--gold-glow:rgba(79,140,255,.20);
  --teal:#2dd4bf;--teal-glow:rgba(45,212,191,.16);
  --crimson:#ef4444;--violet:#a78bfa;--violet-bright:#c4b0ff;--violet-glow:rgba(167,139,250,.24);
  --text:#f0f0f3;--text-dim:#a2a2ae;--text-faint:#84848f;
  --success:#22c55e;--danger:#ef4444;--warn:#eab308;
  --r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:20px;--r-full:100px;
  --grad:linear-gradient(135deg,var(--violet-bright),var(--gold-bright) 55%,var(--gold));
  --ease-spring:cubic-bezier(.34,1.56,.64,1);--ease-smooth:cubic-bezier(.16,1,.3,1);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{font-family:'Geist',-apple-system,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden;-webkit-font-smoothing:antialiased;}
h1,h2,h3,.wordmark{font-family:'Bricolage Grotesque',-apple-system,sans-serif;font-weight:700;letter-spacing:-.02em;}
.mono{font-family:'Geist Mono',monospace;}
a{color:inherit;text-decoration:none;}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px;}
::selection{background:var(--violet-glow);}

/* ---------- ambient background ---------- */
.orbs{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;}
.orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.28;animation:drift 22s ease-in-out infinite alternate;}
.orb.a{width:520px;height:520px;background:radial-gradient(circle,#7c5cff,transparent 65%);top:-160px;left:-120px;}
.orb.b{width:460px;height:460px;background:radial-gradient(circle,#4f8cff,transparent 65%);top:22%;right:-180px;animation-delay:-8s;}
.orb.c{width:600px;height:600px;background:radial-gradient(circle,#3d2b8f,transparent 65%);bottom:-240px;left:28%;animation-delay:-15s;}
@keyframes drift{from{transform:translate(0,0) scale(1);}to{transform:translate(60px,40px) scale(1.12);}}
.grain{position:fixed;inset:0;z-index:-1;opacity:.5;background-image:radial-gradient(rgba(255,255,255,.014) 1px,transparent 1px);background-size:3px 3px;pointer-events:none;}

/* ---------- nav ---------- */
nav{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .3s,border-color .3s,backdrop-filter .3s;background:transparent;border-bottom:1px solid transparent;}
nav.scrolled{backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);background:rgba(5,5,7,.82);border-bottom-color:var(--border);}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:64px;}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:17px;}
.brand img{height:26px;width:auto;object-fit:contain;display:block;}
.nav-links{display:flex;gap:26px;font-size:13.5px;font-weight:500;color:var(--text-dim);margin:0 auto 0 40px;}
.nav-cta{display:flex;gap:10px;align-items:center;}
.nav-links a{transition:color .15s;}
.nav-links a:hover{color:var(--text);}
.nav-cta{display:flex;gap:10px;align-items:center;}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:var(--r-full);font-size:13.5px;font-weight:600;letter-spacing:-.005em;border:1px solid var(--border-2);cursor:pointer;background:var(--s3);color:var(--text);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 1px 2px rgba(0,0,0,.3),0 4px 10px rgba(0,0,0,.24);transition:transform .28s var(--ease-spring),background .12s ease,box-shadow .15s ease;white-space:nowrap;}
.btn:hover{background:#323240;border-color:rgba(255,255,255,.26);transform:translateY(-1px);}
.btn:active{transform:translateY(1px) scale(.98);}
.btn-grad{position:relative;overflow:hidden;background:var(--grad);color:#fff;border:none;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 4px rgba(0,0,0,.25),0 8px 22px rgba(124,92,255,.38);}
.btn-grad::after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.35) 48%,transparent 66%);transform:translateX(-120%);transition:transform .55s var(--ease-smooth);}
.btn-grad:hover::after{transform:translateX(120%);}
.btn-grad:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 3px 6px rgba(0,0,0,.28),0 12px 30px rgba(124,92,255,.48);}
.btn-ghost{background:rgba(255,255,255,.045);}
.btn-lg{padding:16px 30px;font-size:15px;}
@media(max-width:760px){.nav-links{display:none;}}

/* ---------- hero ---------- */
.hero{padding:92px 0 60px;text-align:center;position:relative;}
.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:var(--r-full);background:rgba(255,255,255,.055);border:1px solid var(--border-2);font-size:12.5px;font-weight:600;color:var(--gold-bright);margin-bottom:26px;}
.pill .dot{width:6px;height:6px;border-radius:50%;background:var(--success);box-shadow:0 0 7px var(--success),0 0 1px var(--success);animation:pulse 2s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.hero h1{font-size:clamp(38px,6.4vw,68px);font-weight:700;line-height:1.06;margin-bottom:22px;}
.hero h1 .grad-text{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.hero p{font-size:clamp(15px,2vw,18px);color:var(--text-dim);max-width:600px;margin:0 auto 36px;}
.hero-ctas{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:56px;}
.hero-stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}
.hstat{padding:14px 22px;border-radius:var(--r-xl);background:linear-gradient(155deg,rgba(30,27,45,.7),rgba(20,19,30,.75) 62%);border:1px solid var(--border-2);}
.hstat b{display:block;font-size:20px;font-family:'Bricolage Grotesque';background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1.2;}
.hstat span{font-size:11.5px;color:var(--text-faint);font-weight:500;}


/* ============================================================
   Structure pass — asymmetry, density, hierarchy.
   The page was centred end to end, which is what made it read
   as templated regardless of how many effects sat on top.
   ============================================================ */

/* keyboard focus was invisible everywhere */
:focus-visible{outline:2px solid var(--gold-bright);outline-offset:3px;border-radius:var(--r-sm);}

/* asymmetric section heads: title left, supporting line right */
.sec-head{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:10px 56px;align-items:end;margin-bottom:clamp(30px,3.6vw,52px);}
.sec-head .sec-title{margin-bottom:0;text-wrap:balance;}
.sec-head .sec-sub{margin:0;color:var(--text-dim);font-size:15px;max-width:46ch;}
.sec-head.solo{grid-template-columns:1fr;}
@media(max-width:860px){.sec-head{grid-template-columns:1fr;gap:12px;}}

/* tighter vertical rhythm */
section{padding:clamp(56px,6.4vw,86px) 0;}

/* ---------- hero: split, product on the fold ---------- */
.hero{padding:clamp(52px,6vw,76px) 0 clamp(44px,5vw,64px);text-align:left;}
.hero-grid{display:grid;grid-template-columns:minmax(0,1.02fr) minmax(0,.98fr);gap:clamp(30px,4.4vw,64px);align-items:center;}
.hero h1{margin-bottom:20px;text-wrap:balance;}
.hero p{margin:0 0 30px;max-width:52ch;}
.hero-ctas{justify-content:flex-start;margin-bottom:30px;}
.hero .trust-strip{justify-content:flex-start;}
.hero-stats{justify-content:flex-start;gap:10px;margin-top:18px;}
.hstat{padding:12px 16px;flex:1;min-width:0;}

/* the live panel that now sits on the fold */
.hd{position:relative;}
.hd-frame{border-radius:18px;overflow:hidden;background:#0b0b0f;border:1px solid var(--border-2);
  box-shadow:0 34px 80px rgba(0,0,0,.6),0 0 0 1px rgba(124,92,255,.10),0 10px 30px rgba(124,92,255,.14);}
.hd-bar{display:flex;align-items:center;gap:7px;padding:10px 13px;background:#15151b;border-bottom:1px solid var(--border);}
.hd-url{margin:0 auto;font-size:10.5px;color:var(--text-faint);font-family:'Geist Mono',monospace;}
.hd-screen{padding:14px 13px 15px;background:var(--bg);}
.hd-head{display:flex;align-items:center;gap:9px;margin-bottom:11px;}
.hd-live{width:6px;height:6px;border-radius:50%;background:var(--success);box-shadow:0 0 8px var(--success);animation:pulse 2s infinite;flex-shrink:0;}
.hd-label{font-size:10px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--text-faint);}
.hd-clock{margin-left:auto;font-family:'Geist Mono',monospace;font-size:11px;color:var(--text-dim);font-variant-numeric:tabular-nums;}
.hd-note{margin-top:9px;font-size:10.5px;color:var(--text-faint);text-align:center;}
.hd .offer-card{margin-bottom:9px;}
.hd-swap{transition:opacity .3s ease,transform .3s var(--ease-smooth);}
.hd-swap.out{opacity:0;transform:translateY(-6px);}
.hd-picked{background:rgba(94,234,160,.16)!important;border-color:rgba(94,234,160,.5)!important;color:#8ff0bd!important;}

@media(max-width:960px){
  .hero-grid{grid-template-columns:1fr;gap:34px;}
  .hero{text-align:center;}
  .hero p{margin-left:auto;margin-right:auto;}
  .hero-ctas,.hero .trust-strip,.hero-stats{justify-content:center;}
}

/* ---------- pricing: one recommendation, not five columns ---------- */
.pk{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.08fr);gap:clamp(16px,2vw,26px);align-items:start;}
.pk-rail{display:flex;flex-direction:column;gap:10px;}
.pk-row{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;
  padding:16px 18px;border-radius:var(--r-lg);background:linear-gradient(155deg,rgba(30,27,45,.5),rgba(20,19,30,.6) 62%);
  border:1px solid var(--border);transition:border-color .25s,background .25s,transform .3s var(--ease-spring);}
.pk-row:hover{border-color:var(--border-2);background:linear-gradient(155deg,rgba(38,34,58,.6),rgba(24,23,34,.7) 62%);transform:translateX(3px);}
.pk-row.life{border-color:rgba(196,176,255,.4);background:linear-gradient(155deg,rgba(45,32,74,.7),rgba(20,19,30,.8) 62%);}
.pk-dur{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);width:66px;}
.pk-row.life .pk-dur{color:var(--violet-bright);}
.pk-price{font-family:'Bricolage Grotesque';font-size:23px;font-weight:700;line-height:1.05;letter-spacing:-.01em;}
.pk-price small{font-size:12px;color:var(--text-dim);margin-right:1px;}
.pk-adds{font-size:12px;color:var(--text-dim);margin-top:3px;line-height:1.35;}
.pk-adds b{color:var(--text);font-weight:600;}
.pk-cta{white-space:nowrap;}
.pk-main{position:relative;padding:0;overflow:hidden;}
.pk-main .plan-in{padding:34px 26px 26px;}
.pk-main .price{font-size:44px;}
.pk-main ul{margin-bottom:20px;}
.pk-main li{font-size:12.5px;padding:7px 0;}
.pk-base{margin-top:22px;padding:18px 20px;border-radius:var(--r-lg);border:1px dashed var(--border-2);background:rgba(255,255,255,.02);}
.pk-base h4{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);margin-bottom:12px;font-family:'Geist',sans-serif;}
.pk-base-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px 22px;}
.pk-base-grid span{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text-dim);}
@media(max-width:900px){
  .pk{grid-template-columns:1fr;}
  .pk-row{grid-template-columns:auto 1fr;gap:12px;}
  .pk-cta{grid-column:1/-1;width:100%;}
}


.pk-main .per-day{align-self:flex-start;}
.pk-main .price small{font-size:24px;vertical-align:baseline;}
.pk-price small{font-size:15px;vertical-align:baseline;}
.pk-main .per{margin-bottom:14px;}

/* the demo panel mirrors the real product, which is left-aligned */
.hd{text-align:left;}
.hero .trust-strip{gap:14px 26px;padding-top:0;}

/* small screens: the nav CTAs were overlapping the wordmark */
@media(max-width:620px){
  .nav-in{gap:10px;height:58px;}
  .brand{font-size:15px;}
  .brand img{height:22px;}
  .nav-cta{gap:8px;}
  .nav-cta .btn{padding:10px 15px;font-size:12.5px;}
  .nav-cta .btn-ghost{display:none;}
  .hero-stats{flex-wrap:wrap;}
  .hstat{flex:1 1 44%;}
}
/* ---------- reveal ---------- */
.rv{opacity:0;transform:translateY(14px);transition:opacity .5s ease,transform .55s var(--ease-smooth);}
.rv.in{opacity:1;transform:none;}

/* ---------- section scaffolding ---------- */
section{padding:76px 0;}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--violet-bright);margin-bottom:12px;}
.sec-title{font-size:clamp(26px,4vw,40px);font-weight:700;margin-bottom:14px;}
.sec-sub{color:var(--text-dim);font-size:15px;max-width:560px;margin-bottom:44px;}
.center{text-align:center;}
.center .sec-sub{margin-left:auto;margin-right:auto;}

/* ---------- the panel-recipe card, used everywhere (features, steps, plans) ---------- */
.panel-card{
  position:relative;background:linear-gradient(155deg,rgba(30,27,45,.92),rgba(20,19,30,.94) 62%);
  border:1px solid var(--border-2);border-radius:var(--r-xl);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 2px 4px rgba(0,0,0,.3),0 16px 40px rgba(0,0,0,.4);
  transition:border-color .2s var(--ease-smooth),box-shadow .2s var(--ease-smooth),transform .2s var(--ease-smooth);
}

/* ---------- badge, exact recipe from the panel ---------- */
.badge{position:relative;padding:5px 11px 5px 9px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;border-radius:var(--r-full);line-height:1.3;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;box-shadow:0 0 7px currentColor,0 0 1px currentColor;}
.badge.ok{background:rgba(34,197,94,.14);color:#5eeaa0;border-color:rgba(34,197,94,.3);}
.badge.warn{background:rgba(129,140,248,.12);color:#a5b4fc;border-color:rgba(129,140,248,.28);}
.badge.gold{background:rgba(79,140,255,.14);color:var(--gold-bright);border-color:rgba(79,140,255,.3);}
.badge.dim{background:rgba(190,190,200,.09);color:#c6c6d2;border-color:rgba(190,190,200,.16);}

/* ---------- interactive demo ---------- */
.demo-wrap{display:flex;gap:36px;align-items:flex-start;justify-content:center;flex-wrap:wrap;}
.phone{width:320px;flex-shrink:0;border-radius:38px;background:linear-gradient(180deg,#141419,#0b0b0f);border:1px solid var(--border-2);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 8px rgba(255,255,255,.03);padding:14px;}
.screen{border-radius:26px;background:var(--bg);border:1px solid var(--border);overflow:hidden;display:flex;flex-direction:column;min-height:520px;}
.mock-top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);}
.mock-brand{font-size:13px;font-weight:700;font-family:'Bricolage Grotesque';}
.mock-chip{font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:var(--r-full);background:rgba(34,197,94,.14);color:#5eeaa0;border:1px solid rgba(34,197,94,.3);}
.mock-body{padding:14px;display:flex;flex-direction:column;gap:11px;flex:1;overflow:hidden;}
.mlead{border-radius:var(--r-lg);background:var(--s2);border:1px solid var(--border-2);padding:13px;}
.mlead .tag{display:inline-block;font-size:9px;font-weight:800;letter-spacing:.1em;color:#5eeaa0;text-transform:uppercase;margin-bottom:6px;}
.mlead .tag.retry{color:var(--gold-bright);}
.mlead b{font-size:14px;display:block;}
.mlead span{font-size:11px;color:var(--text-faint);font-family:'Geist Mono',monospace;}
.mbtn{margin-top:10px;text-align:center;padding:11px;border-radius:var(--r-full);background:var(--grad);font-size:12px;font-weight:700;color:#fff;}
.mbtn.dark{background:var(--s3);border:1px solid var(--border-2);color:var(--text-dim);font-weight:600;}
.mxp{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:var(--r-lg);background:var(--s2);border:1px solid var(--border);}
.mxp .medal{width:34px;height:34px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mxp .medal svg{width:17px;height:17px;color:#fff;}
.mxp .bar{flex:1;height:7px;border-radius:var(--r-full);background:rgba(255,255,255,.08);overflow:hidden;}
.mxp .bar i{display:block;height:100%;width:68%;border-radius:var(--r-full);background:var(--grad);animation:fillxp 2.4s var(--ease-smooth) both;}
@keyframes fillxp{from{width:8%;}}
.mxp small{font-size:10px;color:var(--text-faint);font-weight:700;white-space:nowrap;}
.mcall{text-align:center;padding:18px 13px;}
.mcall .avatar{width:56px;height:56px;border-radius:50%;background:var(--grad);margin:0 auto 10px;display:flex;align-items:center;justify-content:center;}
.mcall .avatar svg{width:26px;height:26px;color:#fff;}
.mcall b{font-size:15px;display:block;}
.mcall .timer{font-size:24px;font-weight:700;font-family:'Bricolage Grotesque';background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0 12px;}
.mgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mout{padding:9px 6px;border-radius:var(--r-md);font-size:10.5px;font-weight:700;text-align:center;border:1px solid;}
.mout.good{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.3);color:#5eeaa0;}
.mout.mid{background:rgba(129,140,248,.12);border-color:rgba(129,140,248,.28);color:#a5b4fc;}
.mout.dim2{background:var(--s3);border-color:var(--border-2);color:var(--text-dim);}
.mock-nav{display:flex;border-top:1px solid var(--border);background:rgba(255,255,255,.02);}
.mnav{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 4px;background:transparent;border:none;color:var(--text-faint);font-size:9.5px;font-weight:700;font-family:inherit;cursor:pointer;transition:color .15s;}
.mnav svg{width:18px;height:18px;}
.mnav.on{color:var(--gold-bright);}
.demo-notes{max-width:380px;display:flex;flex-direction:column;gap:12px;}
.dn{padding:18px 20px;border-radius:var(--r-xl);background:var(--s1);border:1px solid var(--border-2);font-size:13.5px;color:var(--text-dim);transition:border-color .25s,background .25s;}
.dn b{color:var(--text);display:block;margin-bottom:4px;font-size:14px;}
.dn.on{border-color:rgba(79,140,255,.4);background:var(--s2);}
.mrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 2px;font-size:12px;color:var(--text-dim);border-bottom:1px solid var(--border);}
.mrow:last-child{border-bottom:none;}
.mcb{padding:10px 12px;border-radius:var(--r-lg);background:rgba(129,140,248,.08);border:1px solid rgba(129,140,248,.25);font-size:11px;}
.mcb b{color:#a5b4fc;font-size:10px;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:5px;}
.mchat-toggle{display:flex;gap:4px;padding:4px;border-radius:var(--r-full);background:rgba(255,255,255,.05);border:1px solid var(--border);margin-bottom:4px;}
.mchat-toggle span{flex:1;text-align:center;padding:7px;border-radius:var(--r-full);font-size:11px;font-weight:700;color:var(--text-dim);}
.mchat-toggle span.on{background:var(--grad);color:#fff;}
.mbub{max-width:82%;padding:9px 12px;border-radius:15px;background:var(--s2);border:1px solid var(--border);font-size:11.5px;}
.mbub.own{margin-left:auto;background:linear-gradient(135deg,rgba(79,140,255,.28),rgba(79,140,255,.14));border-color:rgba(79,140,255,.3);}
.mbub small{display:block;font-size:9px;color:var(--text-faint);margin-top:3px;}
.mlock{display:flex;align-items:center;gap:6px;font-size:9.5px;color:#5eeaa0;font-weight:700;justify-content:center;padding:4px 0;}
.mlock svg{width:11px;height:11px;}
.mstat2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.mstat2 .ms{padding:11px;border-radius:var(--r-lg);background:var(--s2);border:1px solid var(--border);}
.mstat2 .ms b{font-family:'Bricolage Grotesque';font-size:18px;display:block;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;}
.mstat2 .ms span{font-size:9.5px;color:var(--text-faint);font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
.mbulk{display:flex;gap:6px;align-items:center;padding:9px 11px;border-radius:var(--r-md);background:rgba(79,140,255,.1);border:1px solid rgba(79,140,255,.3);font-size:10px;font-weight:700;}
.mbulk i{font-style:normal;color:var(--gold-bright);}

/* ---------- guide ---------- */
.guide-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:18px;}
.gcol{padding:26px 24px;}
.gtag{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:18px;}
.gstep{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--border);}
.gstep:last-child{border-bottom:none;}
.gstep i{font-style:normal;width:26px;height:26px;border-radius:var(--r-sm);background:rgba(79,140,255,.14);border:1px solid rgba(79,140,255,.3);color:var(--gold-bright);font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.gstep b{font-size:13.5px;display:block;margin-bottom:3px;}
.gstep p{font-size:12.5px;color:var(--text-dim);margin:0;}

/* ---------- features ---------- */
.feat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;}
.feat{padding:26px;transition:transform .2s var(--ease-smooth);}
.feat:hover{transform:translateY(-4px);border-color:rgba(79,140,255,.35);}
.fic{width:44px;height:44px;border-radius:13px;background:rgba(79,140,255,.14);border:1px solid rgba(79,140,255,.3);display:flex;align-items:center;justify-content:center;margin-bottom:16px;}
.fic svg{width:21px;height:21px;color:var(--gold-bright);}
.feat h3{font-size:16.5px;margin-bottom:8px;font-weight:600;}
.feat p{font-size:13.5px;color:var(--text-dim);}

/* ---------- how ---------- */
.steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;counter-reset:step;}
.step{padding:28px 24px;position:relative;}
.step::before{counter-increment:step;content:counter(step,decimal-leading-zero);font-family:'Bricolage Grotesque';font-size:38px;font-weight:700;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;opacity:.9;display:block;margin-bottom:12px;}
.step h3{font-size:16px;margin-bottom:8px;font-weight:600;}
.step p{font-size:13.5px;color:var(--text-dim);}

/* ---------- pricing ---------- */
.plans{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;align-items:stretch;}
@media(max-width:1180px){.plans{grid-template-columns:repeat(3,1fr);}}
@media(max-width:720px){.plans{grid-template-columns:repeat(2,1fr);}}
@media(max-width:460px){.plans{grid-template-columns:1fr;}}
.plan{padding:0;display:flex;flex-direction:column;position:relative;overflow:hidden;transition:transform .3s var(--ease-spring),border-color .3s var(--ease-smooth),box-shadow .3s var(--ease-smooth);}
.plan-top{height:3px;background:linear-gradient(90deg,transparent,var(--border-2),transparent);}
.plan-in{padding:24px 20px 22px;display:flex;flex-direction:column;flex:1;}
.plan:hover{transform:translateY(-6px);border-color:rgba(255,255,255,.22);box-shadow:0 20px 50px rgba(0,0,0,.5);}
.plan.hot{border-color:rgba(79,140,255,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(79,140,255,.18),0 20px 50px rgba(79,140,255,.12);}
.plan.hot .plan-top{background:linear-gradient(90deg,transparent,var(--gold-bright),transparent);}
.plan.hot:hover{transform:translateY(-6px) scale(1.015);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 0 1px rgba(79,140,255,.3),0 28px 64px rgba(79,140,255,.22);}
.plan.life{border-color:rgba(196,176,255,.55);background:linear-gradient(155deg,rgba(45,32,74,.94),rgba(20,19,30,.94) 62%);box-shadow:inset 0 1px 0 rgba(255,255,255,.1),0 0 0 1px rgba(196,176,255,.16),0 20px 50px rgba(124,92,255,.14);}
.plan.life .plan-top{background:linear-gradient(90deg,transparent,var(--violet-bright),var(--gold-bright),transparent);}
.plan.life:hover{transform:translateY(-6px) scale(1.015);box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 0 0 1px rgba(196,176,255,.3),0 28px 64px rgba(124,92,255,.24);}
.plan-tag{position:absolute;top:14px;left:50%;transform:translateX(-50%);padding:5px 13px;border-radius:var(--r-full);font-size:9.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#fff;white-space:nowrap;background:var(--grad);box-shadow:0 4px 14px rgba(124,92,255,.45);z-index:2;}
.plan.hot .plan-in,.plan.life .plan-in{padding-top:38px;}
.plan .dur{font-size:11.5px;font-weight:700;color:var(--text-faint);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;}
.plan .price{font-family:'Bricolage Grotesque';font-size:32px;font-weight:700;line-height:1;margin-bottom:3px;letter-spacing:-.01em;}
.plan .price small{font-size:14px;font-weight:700;color:var(--text-dim);margin-right:1px;}
.plan .per{font-size:11px;color:var(--text-faint);margin-bottom:20px;min-height:14px;}
.plan ul{list-style:none;margin-bottom:22px;flex:1;}
.plan li{font-size:12px;color:var(--text-dim);padding:6px 0;display:flex;align-items:flex-start;gap:9px;line-height:1.4;}
.plan li .plan-tick{margin-top:1px;}
.plan-tick{width:16px;height:16px;border-radius:50%;background:rgba(94,234,160,.14);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.plan-tick svg{width:9px;height:9px;color:#5eeaa0;}
.plan .btn{width:100%;margin-top:auto;}
.plan .btn-ghost{background:rgba(255,255,255,.06);}
.plan .btn:hover{transform:translateY(-1px);}

/* ---------- faq ---------- */
.faq{max-width:680px;margin:0 auto;}
.faq details{border:1px solid var(--border-2);border-radius:var(--r-lg);background:var(--s1);margin-bottom:10px;overflow:hidden;}
.faq summary{padding:18px 22px;font-size:14.5px;font-weight:600;cursor:pointer;list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px;}
.faq summary::-webkit-details-marker{display:none;}
.faq summary::after{content:'+';font-size:20px;color:var(--text-dim);transition:transform .2s;flex-shrink:0;}
.faq details[open] summary::after{transform:rotate(45deg);}
.faq .a{padding:0 22px 18px;font-size:13.5px;color:var(--text-dim);}

/* ---------- final cta + footer ---------- */
.final{border-radius:var(--r-xl);background:linear-gradient(155deg,rgba(30,27,45,.92),rgba(20,19,30,.94) 62%);border:1px solid rgba(79,140,255,.3);padding:56px 28px;text-align:center;}
footer{border-top:1px solid var(--border);padding:34px 0;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--text-faint);}
footer .flinks{display:flex;gap:20px;}
footer a:hover{color:var(--text);}

/* ================================================================
   IMMERSION WAVE — aurora, particles, marquee, magnetics, physics
   ================================================================ */
/* aurora behind hero */
.aurora{position:absolute;inset:-20% -10% auto;height:130%;z-index:-1;overflow:hidden;pointer-events:none;filter:blur(60px) saturate(1.3);opacity:.5;}
.aurora i{position:absolute;border-radius:50%;mix-blend-mode:screen;}
.aurora i:nth-child(1){width:52vw;height:46vh;left:-6%;top:8%;background:radial-gradient(ellipse,rgba(124,92,255,.55),transparent 65%);animation:aur1 16s ease-in-out infinite alternate;}
.aurora i:nth-child(2){width:44vw;height:42vh;right:-4%;top:2%;background:radial-gradient(ellipse,rgba(79,140,255,.45),transparent 65%);animation:aur2 19s ease-in-out infinite alternate;}
.aurora i:nth-child(3){width:36vw;height:34vh;left:28%;top:34%;background:radial-gradient(ellipse,rgba(45,212,191,.22),transparent 65%);animation:aur3 22s ease-in-out infinite alternate;}
@keyframes aur1{from{transform:translate(0,0) scale(1);}to{transform:translate(9vw,6vh) scale(1.18);}}
@keyframes aur2{from{transform:translate(0,0) scale(1.1);}to{transform:translate(-7vw,8vh) scale(.95);}}
@keyframes aur3{from{transform:translate(0,0) scale(1);}to{transform:translate(6vw,-5vh) scale(1.22);}}
.hero{position:relative;}
#heroParticles{position:absolute;inset:0;z-index:-1;pointer-events:none;}


/* ============================================================
   Wave 4 — cinematic hero
   ============================================================ */
.hero{position:relative;min-height:100vh;min-height:100svh;display:flex;flex-direction:column;overflow:hidden;isolation:isolate;}
.hero-deep{position:absolute;inset:0;z-index:-4;pointer-events:none;
  background:
    radial-gradient(120% 80% at 50% -10%, rgba(122,171,255,.16), transparent 55%),
    radial-gradient(90% 60% at 85% 18%, rgba(167,139,250,.14), transparent 50%),
    radial-gradient(70% 60% at 8% 82%, rgba(79,140,255,.10), transparent 55%);}
#dispatchGrid{position:absolute;inset:0;z-index:-3;pointer-events:none;}
.hero-spot{position:absolute;inset:0;z-index:-2;pointer-events:none;
  background:radial-gradient(340px circle at var(--mx,50%) var(--my,35%), rgba(122,171,255,.10), transparent 70%);}
.hero-veil{position:absolute;inset:0;z-index:6;pointer-events:none;mix-blend-mode:multiply;opacity:.5;
  background:linear-gradient(180deg, rgba(5,5,7,.45) 0%, transparent 16%, transparent 80%, rgba(5,5,7,.85) 100%),
  repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,.13) 2px 3px);}

.hero-stage{position:relative;z-index:8;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px 32px 46px;max-width:1000px;margin:0 auto;width:100%;}
.hero .badge-live{display:inline-flex;align-items:center;gap:9px;padding:8px 18px;border-radius:var(--r-full);background:rgba(122,171,255,.08);border:1px solid rgba(122,171,255,.25);font-size:13px;font-weight:600;color:var(--gold-bright);margin-bottom:28px;backdrop-filter:blur(8px);transform:translateY(12px);animation:hRise .7s var(--ease-out) .1s forwards;}
.hero .badge-live .rec{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 10px var(--success);animation:hBeat 1.6s infinite;}
@keyframes hBeat{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}

.hero h1{font-size:clamp(46px,8.2vw,108px);line-height:.96;letter-spacing:-.045em;margin:0 0 24px;}
.hero h1 .line{display:block;overflow:hidden;padding-bottom:.04em;}
.hero h1 .line > span{display:inline-block;animation:hSlide .95s var(--ease-out) both;}
.hero h1 .line:nth-child(1) > span{animation-delay:.18s;}
.hero h1 .line:nth-child(2) > span{animation-delay:.32s;}
@keyframes hSlide{from{transform:translateY(110%);}to{transform:translateY(0);}}
.hero h1 .gt{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;position:relative;}
.hero h1 .gt::after{content:'';position:absolute;left:0;right:0;bottom:-.02em;height:3px;border-radius:3px;background:var(--grad);transform:scaleX(0);transform-origin:left;animation:hUL 1s var(--ease-out) 1.05s forwards;box-shadow:0 0 18px rgba(122,171,255,.7);}
@keyframes hUL{to{transform:scaleX(1);}}

.hero .hero-sub{font-size:clamp(16px,2vw,21px);color:var(--text-dim);max-width:640px;line-height:1.55;margin:0 0 36px;animation:hRise .8s var(--ease-out) .7s forwards;}
.hero .hero-sub b{color:var(--text);font-weight:600;}
.hero .hero-ctas{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-bottom:42px;animation:hRise .8s var(--ease-out) .85s forwards;}
.hero .btn-xl{padding:18px 38px;font-size:17px;}

.hero-counters{display:flex;border:1px solid var(--border);border-radius:16px;overflow:hidden;background:rgba(12,12,18,.5);backdrop-filter:blur(12px);animation:hRise .8s var(--ease-out) 1s forwards;}
.hero-counters .c{padding:15px 28px;border-right:1px solid var(--border);text-align:center;}
.hero-counters .c:last-child{border-right:none;}
.hero-counters .c b{display:block;font-family:'Bricolage Grotesque';font-size:25px;font-weight:800;font-variant-numeric:tabular-nums;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent;line-height:1;}
.hero-counters .c span{font-size:10.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;margin-top:6px;display:block;}
@keyframes hRise{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}

.hero-cue{position:absolute;bottom:22px;left:50%;transform:translateX(-50%);z-index:8;display:flex;flex-direction:column;align-items:center;gap:7px;animation:hRise 1s ease 1.7s forwards;}
.hero-cue span{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--text-faint);}
.hero-cue .m{width:23px;height:36px;border:2px solid var(--border-2);border-radius:13px;display:flex;justify-content:center;padding-top:6px;}
.hero-cue .m i{width:3px;height:7px;border-radius:2px;background:var(--gold-bright);animation:hDrop 1.6s infinite;}
@keyframes hDrop{0%{transform:translateY(0);opacity:1}70%{transform:translateY(11px);opacity:0}100%{opacity:0}}

@media(max-width:820px){
  .hero-counters{flex-wrap:wrap;}
  .hero-counters .c{flex:1 1 42%;border-bottom:1px solid var(--border);}
}
@media(prefers-reduced-motion:reduce){
  #dispatchGrid{display:none;}
  .hero h1 .line > span{transform:none;animation:none;}
  .hero .badge-live,.hero .hero-sub,.hero .hero-ctas,.hero-counters,.hero-cue{opacity:1;transform:none;animation:none;}
}

/* hero headline word cascade (legacy — kept for any other .hw users) */
.hw{display:inline-block;opacity:0;transform:translateY(26px) rotate(2deg);animation:hwIn .8s var(--ease-spring) forwards;}
@keyframes hwIn{to{opacity:1;transform:none;}}

/* infinite marquee */
.marquee{overflow:hidden;border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:15px 0;background:rgba(255,255,255,.015);position:relative;margin-top:30px;}
.marquee::before,.marquee::after{content:'';position:absolute;top:0;bottom:0;width:120px;z-index:2;pointer-events:none;}
.marquee::before{left:0;background:linear-gradient(90deg,var(--bg),transparent);}
.marquee::after{right:0;background:linear-gradient(-90deg,var(--bg),transparent);}
.marquee-track{display:flex;gap:44px;width:max-content;animation:marq 34s linear infinite;}
.marquee-track span{display:flex;align-items:center;gap:10px;font-size:12.5px;font-weight:600;color:var(--text-faint);white-space:nowrap;letter-spacing:.02em;text-transform:uppercase;}
.marquee-track span i{width:5px;height:5px;border-radius:50%;background:var(--grad);font-style:normal;flex-shrink:0;}
@keyframes marq{to{transform:translateX(-50%);}}
.marquee:hover .marquee-track{animation-play-state:paused;}

/* shimmering animated border on premium plan cards */
.plan.hot::after,.plan.life::after{content:'';position:absolute;inset:-1px;border-radius:inherit;padding:1px;background:conic-gradient(from var(--shim,0deg),transparent 8%,rgba(196,176,255,.9) 14%,rgba(122,171,255,.9) 20%,transparent 28%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;animation:shimSpin 4.5s linear infinite;}
@property --shim{syntax:'<angle>';initial-value:0deg;inherits:false;}
@keyframes shimSpin{to{--shim:360deg;}}

/* smooth FAQ open */
.faq details .a{display:grid;grid-template-rows:0fr;transition:grid-template-rows .4s var(--ease-smooth);padding-top:0;padding-bottom:0;}
.faq details .a > div{overflow:hidden;}
.faq details[open] .a{grid-template-rows:1fr;padding-bottom:18px;}
.faq summary{transition:color .2s ease;}
.faq details[open] summary{color:var(--gold-bright);}

/* scrollspy underline */
.nav-links a{position:relative;padding-bottom:3px;}
.nav-links a::after{content:'';position:absolute;left:0;bottom:-2px;height:2px;width:0;background:var(--grad);border-radius:2px;transition:width .3s var(--ease-smooth);}
.nav-links a.now::after{width:100%;}
.nav-links a.now{color:var(--text);}

/* magnetic buttons get GPU transforms */
.btn-grad,.btn-lg{will-change:transform;}

/* parallax layers */
.plx{will-change:transform;}

/* softer, longer reveal ease for the oiled feel */
.rv{transition:opacity 1s cubic-bezier(.22,1,.36,1),transform 1s cubic-bezier(.22,1,.36,1);}

@media(prefers-reduced-motion:reduce){
  .aurora i{animation:none;}
  .hw{animation:none;opacity:1;transform:none;}
  .marquee-track{animation:none;}
  .plan.hot::after,.plan.life::after{animation:none;display:none;}
}


/* ================================================================
   PHENOMENAL WAVE — motion, interactivity, persuasion sections
   ================================================================ */
/* scroll progress bar */
.scroll-progress{position:fixed;top:0;left:0;height:2px;background:var(--grad);z-index:100;width:0;box-shadow:0 0 12px rgba(124,92,255,.6);transition:width .1s linear;}

/* staggered reveals */
.rv{opacity:0;transform:translateY(28px);transition:opacity .8s var(--ease-smooth),transform .8s var(--ease-smooth);}
.rv.in{opacity:1;transform:none;}
.stagger > .rv:nth-child(2){transition-delay:.08s;}
.stagger > .rv:nth-child(3){transition-delay:.16s;}
.stagger > .rv:nth-child(4){transition-delay:.24s;}
.stagger > .rv:nth-child(5){transition-delay:.32s;}

/* animated gradient headline */
.grad-text{background:linear-gradient(120deg,var(--violet-bright),var(--gold-bright),var(--violet-bright));background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:gradSweep 5.5s ease-in-out infinite;}
@keyframes gradSweep{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}
/* The span carries BOTH .hw and .grad-text. .grad-text is declared later at equal
   specificity and the animation shorthand wins, so it wiped hwIn - leaving the second
   half of the h1 stuck at opacity:0. Run both, sweep starts after the word lands. */
.hw.grad-text{animation:hwIn .8s var(--ease-spring) forwards,gradSweep 5.5s ease-in-out .8s infinite;}

/* hero live ticker (clearly a demo simulation) */
.ticker-wrap{max-width:520px;margin:34px auto 0;border-radius:var(--r-full);background:rgba(255,255,255,.035);border:1px solid var(--border-2);padding:9px 18px;display:flex;align-items:center;gap:11px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.05);}
.ticker-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 8px var(--success);animation:pulse 2s infinite;flex-shrink:0;}
.ticker-label{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--text-faint);flex-shrink:0;}
.ticker-msg{font-size:12.5px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;opacity:1;transition:opacity .35s ease,transform .35s ease;}
.ticker-msg.swap{opacity:0;transform:translateY(8px);}
.ticker-msg b{color:var(--text);font-weight:600;}

/* trust strip */
.trust-strip{display:flex;justify-content:center;gap:34px;flex-wrap:wrap;padding:22px 0 0;}
.trust-item{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--text-dim);font-weight:500;}
.trust-item svg{width:15px;height:15px;color:#5eeaa0;flex-shrink:0;}

/* cursor spotlight on cards */
.spot{position:relative;overflow:hidden;}
.spot::after{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;transition:opacity .3s ease;background:radial-gradient(340px circle at var(--mx,50%) var(--my,50%),rgba(124,92,255,.12),transparent 65%);pointer-events:none;}
.spot:hover::after{opacity:1;}

/* device tilt */
.tilt{transform-style:preserve-3d;will-change:transform;}

/* comparison: old way vs clearpanel */
.vs-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:840px;margin:0 auto;}
@media(max-width:700px){.vs-grid{grid-template-columns:1fr;}}
.vs-col{padding:28px 26px;}
.vs-col.bad{border-color:rgba(239,68,68,.22);background:linear-gradient(155deg,rgba(45,25,28,.5),rgba(20,19,30,.9) 62%);}
.vs-col.good{border-color:rgba(79,140,255,.4);}
.vs-head{display:flex;align-items:center;gap:10px;font-family:'Bricolage Grotesque';font-size:16px;font-weight:700;margin-bottom:18px;}
.vs-head .vsic{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.vs-col.bad .vsic{background:rgba(239,68,68,.14);color:#ff8f8a;}
.vs-col.good .vsic{background:rgba(79,140,255,.14);color:var(--gold-bright);}
.vs-head .vsic svg{width:15px;height:15px;}
.vs-row{display:flex;gap:10px;padding:9px 0;font-size:13px;color:var(--text-dim);line-height:1.5;border-bottom:1px solid var(--border);}
.vs-row:last-child{border-bottom:none;}
.vs-row svg{width:14px;height:14px;flex-shrink:0;margin-top:3px;}
.vs-col.bad .vs-row svg{color:#ff8f8a;}
.vs-col.good .vs-row svg{color:#5eeaa0;}
.vs-col.good .vs-row{color:var(--text);}

/* 60-second timeline */
.tl{max-width:760px;margin:0 auto;position:relative;padding-left:34px;}
.tl::before{content:'';position:absolute;left:11px;top:8px;bottom:8px;width:2px;background:linear-gradient(180deg,var(--violet-bright),var(--gold));border-radius:2px;opacity:.5;}
.tl-item{position:relative;padding:0 0 26px;}
.tl-item:last-child{padding-bottom:0;}
.tl-item::before{content:'';position:absolute;left:-30px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--grad);box-shadow:0 0 0 4px rgba(124,92,255,.15),0 0 12px rgba(124,92,255,.5);}
.tl-time{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-bright);margin-bottom:4px;}
.tl-item b{font-size:15px;display:block;margin-bottom:4px;}
.tl-item p{font-size:13px;color:var(--text-dim);margin:0;max-width:520px;}

/* per-day pricing hint */
.per-day{display:inline-block;font-size:10px;font-weight:700;color:var(--gold-bright);background:rgba(79,140,255,.1);border:1px solid rgba(79,140,255,.25);padding:3px 9px;border-radius:var(--r-full);margin-top:6px;}

/* count-up targets */
.cnt{font-variant-numeric:tabular-nums;}

/* sticky mini CTA after pricing scroll-past */
.mini-cta{position:fixed;bottom:18px;left:50%;transform:translateX(-50%) translateY(90px);z-index:90;display:flex;align-items:center;gap:14px;padding:10px 12px 10px 20px;border-radius:var(--r-full);background:rgba(12,12,18,.88);backdrop-filter:blur(14px) saturate(1.4);-webkit-backdrop-filter:blur(14px) saturate(1.4);border:1px solid var(--border-2);box-shadow:0 16px 50px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);transition:transform .45s var(--ease-spring);white-space:nowrap;}
.mini-cta.on{transform:translateX(-50%) translateY(0);}
.mini-cta span{font-size:12.5px;color:var(--text-dim);font-weight:500;}
.mini-cta span b{color:var(--text);}
@media(max-width:520px){.mini-cta span{display:none;}.mini-cta{padding:8px;}}

@media(prefers-reduced-motion:reduce){
  .grad-text{animation:none;}
  .hw.grad-text{animation:none;opacity:1;transform:none;}
  .rv{transition-duration:.01s;}
  .ticker-msg{transition:none;}
  .mini-cta{transition:none;}
}


/* ================================================================
   REAL PANEL CSS — copied verbatim from src/frontend.ts so the
   showcase below is not a recreation but the actual component code
   the live app ships. Class names are intentionally identical.
   ================================================================ */
.panel{position:relative;background:linear-gradient(155deg, rgba(30,27,45,.92), rgba(20,19,30,.94) 62%);border:1px solid var(--border-2);border-radius:var(--r-xl);box-shadow:inset 0 1px 0 rgba(255,255,255,.10), 0 2px 4px rgba(0,0,0,.3), 0 16px 40px rgba(0,0,0,.4);}
.p{padding:24px;}
.admin-shell{display:flex;}
.admin-sidebar{width:220px;flex-shrink:0;background:linear-gradient(180deg, rgba(147,112,255,.035), rgba(255,255,255,.015));border-right:1px solid rgba(255,255,255,.09);padding:20px 14px;overflow-y:auto;}
.side-link{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:var(--r-sm);font-size:13px;font-weight:500;color:var(--text-dim);cursor:default;margin-bottom:1px;position:relative;}
.side-link.active{background:linear-gradient(135deg,rgba(124,92,255,.2),rgba(79,140,255,.1));color:#fff;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 2px 12px rgba(124,92,255,.18);border:1px solid rgba(167,139,250,.28);}
.side-sec{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:600;margin:18px 10px 8px;}
.admin-main{flex:1;min-width:0;}
.admin-content{padding:24px 26px;}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-bottom:22px;}
.stat-box{padding:16px 18px;border-radius:var(--r-lg);}
.stat-box .num{font-family:'Bricolage Grotesque';font-size:22px;font-weight:800;line-height:1.2;}
.stat-box .lbl{font-size:10.5px;color:var(--text-faint);font-weight:600;margin-top:3px;letter-spacing:.02em;}
.stat-box.accent{border-color:rgba(79,140,255,.3);}
.section-title{font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;margin:24px 0 12px;font-weight:600;}
.live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-left:6px;position:relative;top:-2px;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:liveDotPulse 1.8s ease-out infinite;}
@keyframes liveDotPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%{box-shadow:0 0 0 8px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}
.rp-brand{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15.5px;display:flex;align-items:center;gap:10px;letter-spacing:-.02em;color:var(--text);line-height:1;}
.rp-brand-mark{width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,.06);position:relative;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(124,92,255,.25), inset 0 1px 0 rgba(255,255,255,.15);}
.rp-brand-mark img{width:100%;height:100%;object-fit:contain;display:block;}
.topbar{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:linear-gradient(180deg, rgba(147,112,255,.09), rgba(255,255,255,.02) 70%, transparent);border-bottom:1px solid rgba(255,255,255,.08);}
.icon-btn{width:38px;height:38px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-dim);flex-shrink:0;}
.clock-toggle{display:flex;align-items:center;gap:8px;padding:9px 16px 9px 13px;border-radius:100px;font-size:12.5px;font-weight:600;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));border:1px solid var(--border-2);color:var(--text-dim);}
.clock-dot{width:8px;height:8px;border-radius:50%;background:#34d399;flex-shrink:0;box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 1.8s ease-out infinite;}
.staff-body{max-width:600px;margin:0 auto;}
.bottom-nav{display:flex;align-items:stretch;background-color:#0c0c12;background-image:linear-gradient(180deg, rgba(20,18,30,.72), rgba(12,12,18,.86));border-top:1px solid rgba(255,255,255,.10);padding:8px 8px 10px;left:0;right:0;bottom:0;}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:6px 2px;border-radius:14px;background:transparent;color:var(--text-faint);font-size:9.5px;font-weight:600;position:relative;border:none;}
.nav-btn .ic{width:20px;height:20px;}
.nav-btn.active{color:var(--gold-bright);}
.nav-btn.active .ic{filter:drop-shadow(0 3px 8px var(--gold-glow));}
.nav-btn.active::after{content:'';position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:5px;height:5px;border-radius:50%;background:var(--gold-bright);box-shadow:0 0 8px var(--gold-glow);}
.ic{width:17px;height:17px;display:inline-block;vertical-align:-3px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;}
.badge{position:relative;padding:5px 11px 5px 9px;font-size:10px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px;border-radius:var(--r-full);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex-shrink:0;box-shadow:0 0 7px currentColor,0 0 1px currentColor;}
.badge.ok{background:rgba(34,197,94,.14);color:#5eeaa0;border-color:rgba(34,197,94,.3);}
.badge.warn{background:rgba(129,140,248,.12);color:#a5b4fc;border-color:rgba(129,140,248,.28);}
.badge.gold{background:rgba(79,140,255,.14);color:var(--gold-bright);border-color:rgba(79,140,255,.3);}
.badge.dim{background:rgba(190,190,200,.09);color:#c6c6d2;border-color:rgba(190,190,200,.16);}
.btn-gold{position:relative;background:var(--grad);color:#fff;border:none;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 2px 4px rgba(0,0,0,.25),0 8px 22px rgba(124,92,255,.38);}
.offer-card{position:relative;padding:18px;border-radius:20px;margin-bottom:12px;overflow:hidden;background:rgba(28,26,40,.9);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 2px 4px rgba(0,0,0,.3), 0 12px 28px rgba(0,0,0,.3);}
.pulse-dot{position:absolute;top:16px;right:16px;width:9px;height:9px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 1.8s ease-out infinite;}
.offer-label{font-size:9.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:8px;}
.offer-name{font-size:19px;font-weight:700;font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.01em;margin-bottom:4px;}
.offer-actions{display:flex;gap:8px;}
.win-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:13px;font-size:13px;font-weight:700;border-radius:16px;background:linear-gradient(180deg,#3ee87f,var(--success));color:#04170a;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 6px 18px rgba(34,197,94,.32);}
.review-btn{width:100%;padding:11px;font-size:11px;font-weight:700;border-radius:14px;background:rgba(79,140,255,.12);color:var(--gold-bright);border:1px solid rgba(79,140,255,.3);}
.fail-btn{width:100%;padding:11px;font-size:11px;font-weight:700;border-radius:14px;background:rgba(239,68,68,.1);color:var(--danger);border:1px solid rgba(239,68,68,.28);}
.outcome-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;}
.outcome-grid button{padding:11px 4px;font-size:10.5px;font-weight:700;border-radius:14px;letter-spacing:-.005em;background:var(--s3);border:1px solid var(--border-2);color:var(--text-dim);font-family:inherit;box-shadow:0 2px 4px rgba(0,0,0,.2), 0 6px 14px rgba(0,0,0,.18);}
.btn-block{width:100%;}

/* ---------- device chrome (ours — the frame around the real UI, not part of the app) ---------- */
.showcase-glow{position:relative;}
.showcase-glow::before{content:'';position:absolute;top:10%;left:50%;transform:translateX(-50%);width:900px;height:500px;background:radial-gradient(ellipse,rgba(124,92,255,.16),rgba(79,140,255,.06) 45%,transparent 70%);filter:blur(40px);pointer-events:none;z-index:-1;}
.rp-devices{display:flex;gap:44px;align-items:center;justify-content:center;flex-wrap:wrap;padding:20px 0;}
.rp-mac{width:min(680px,100%);border-radius:14px;overflow:hidden;background:#0b0b0f;border:1px solid var(--border-2);box-shadow:0 30px 70px rgba(0,0,0,.55),0 8px 20px rgba(124,92,255,.1);animation:floatMac 7s ease-in-out infinite;}
.rp-mac-bar{display:flex;align-items:center;gap:7px;padding:11px 14px;background:#15151b;border-bottom:1px solid var(--border);}
.rp-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.rp-dot.r{background:#ff5f57;} .rp-dot.y{background:#febc2e;} .rp-dot.g{background:#28c840;}
.rp-mac-url{margin:0 auto;font-size:11px;color:var(--text-faint);font-family:'Geist Mono',monospace;}
.rp-mac-screen{background:var(--bg);}
.rp-phone{width:290px;flex-shrink:0;border-radius:44px;background:linear-gradient(180deg,#1c1c23,#0b0b0f);border:1px solid var(--border-2);box-shadow:0 26px 60px rgba(0,0,0,.5),0 6px 20px rgba(79,140,255,.1),0 0 0 8px rgba(255,255,255,.03);padding:14px 10px;position:relative;animation:floatPhone 8s ease-in-out infinite;animation-delay:-2.6s;}
.rp-phone-notch{position:absolute;top:14px;left:50%;transform:translateX(-50%);width:90px;height:22px;background:#0b0b0f;border-radius:0 0 16px 16px;z-index:2;}
.rp-phone-screen{border-radius:32px;background:var(--bg);border:1px solid var(--border);overflow:hidden;position:relative;height:600px;display:flex;flex-direction:column;}
.rp-caption{text-align:center;font-size:12.5px;color:var(--text-faint);margin-top:28px;max-width:560px;margin-left:auto;margin-right:auto;}
@keyframes floatMac{0%,100%{transform:translateY(0) rotate(0deg);}50%{transform:translateY(-12px) rotate(-.15deg);}}
@keyframes floatPhone{0%,100%{transform:translateY(0);}50%{transform:translateY(-16px);}}
@media(max-width:760px){.rp-mac{display:none;}.showcase-glow::before{width:400px;height:400px;}}
@media(prefers-reduced-motion:reduce){.rp-mac,.rp-phone{animation:none;}}

</style>
</head>
<body>
<div class="orbs"><div class="orb a"></div><div class="orb b"></div><div class="orb c"></div></div>
<div class="grain"></div>



<div class="scroll-progress" id="scrollProgress"></div>
<header class="hero">
  <div class="hero-deep"></div>
  <canvas id="dispatchGrid"></canvas>
  <div class="hero-spot" id="heroSpot"></div>
  <div class="hero-veil"></div>

  <nav><div class="wrap nav-in">
    <a class="brand" href="/"><img src="/clearpanel-logo.png" alt=""><span class="wordmark">ClearPanel</span></a>
    <div class="nav-links">
      <a href="#showcase">Showcase</a><a href="#guide">Guide</a><a href="#vs">Why Switch</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
    </div>
    <div class="nav-cta">
      <a class="btn btn-ghost" href="/login">Panel Login</a>
      <a class="btn btn-grad" href="/redeem">Redeem Key</a>
    </div>
  </div></nav>

  <div class="hero-stage">
    <div class="badge-live"><span class="rec"></span>A live call center is running below &mdash; watch it dispatch</div>
    <h1>
      <span class="line"><span>Get your own</span></span>
      <span class="line"><span class="gt">call center.</span></span>
    </h1>
    <p class="hero-sub">Redeem a key and a complete call center spins up under your name in under a minute &mdash; <b>lead dispatch, one-tap outcomes, ranks, encrypted chat</b>, the works. No setup call. No demo. Just a key.</p>
    <div class="hero-ctas">
      <a class="btn btn-grad btn-xl" href="#pricing">Spin up my call center</a>
      <a class="btn btn-ghost btn-lg" href="#showcase">Watch it work</a>
    </div>
    <div class="hero-counters">
      <div class="c"><b class="cu" data-to="1842">0</b><span>leads dispatched today</span></div>
      <div class="c"><b class="cu" data-to="214">0</b><span>callers on the clock</span></div>
      <div class="c"><b>&lt; 60s</b><span>key to live panel</span></div>
      <div class="c"><b class="cu" data-to="11">0</b><span>ranks to climb</span></div>
    </div>
  </div>

  <div class="hero-cue"><span>Scroll</span><div class="m"><i></i></div></div>
</header>

<div class="marquee"><div class="marquee-track" id="marqueeTrack">
  <span><i></i>Smart lead queue</span><span><i></i>Mandatory outcomes</span><span><i></i>Scheduled callbacks</span><span><i></i>E2E encrypted DMs</span><span><i></i>XP ranks</span><span><i></i>Live dashboard</span><span><i></i>Bulk lead tools</span><span><i></i>AI script writer</span><span><i></i>Telephony &amp; IVR</span><span><i></i>Your branding</span><span><i></i>Unlimited callers</span><span><i></i>Instant key delivery</span>
</div></div>

<section id="showcase"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">This is the actual product</div><h2 class="sec-title">Not a mockup. The real interface.</h2></div><p class="sec-sub">Every class, colour and pixel below is lifted straight from the live app — the admin dashboard as it looks on a laptop, the caller queue as it looks on a phone.</p></div>
  <div class="rp-devices rv showcase-glow">
    <div class="rp-mac tilt">
      <div class="rp-mac-bar"><span class="rp-dot r"></span><span class="rp-dot y"></span><span class="rp-dot g"></span><span class="rp-mac-url">clearpanel.up.railway.app/app</span></div>
      <div class="rp-mac-screen">
        <div class="admin-shell">
          <div class="admin-sidebar">
            <div class="side-link active" data-rpm="dash" style="cursor:pointer;"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg> Dashboard</div>
            <div class="side-sec">Leads</div>
            <div class="side-link" data-rpm="leads" style="cursor:pointer;"><svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg> All Leads</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg> Import</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><path d="M5 21V4M5 5h13l-3 4 3 4H5"/></svg> Lead Vault</div>
            <div class="side-sec">Team</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.7.3 4.7 2.3 5.5 4.8"/></svg> Roster</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg> Leaderboard</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5z"/></svg> Team Chat</div>
            <div class="side-sec">Configuration</div>
            <div class="side-link" data-rpm="scripts" style="cursor:pointer;"><svg class="ic" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg> Scripts</div>
            <div class="side-link"><svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg> Branding</div>
          </div>
          <div class="admin-main">
            <div class="topbar">
              <div class="rp-brand"><div class="rp-brand-mark"><img src="/clearpanel-logo.png" alt="" /></div>ClearPanel <span class="mono" style="color:var(--text-faint);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;margin-left:6px;display:inline-flex;align-items:center;gap:5px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 2.2s ease-out infinite;"></span>Control Room</span></div>
              <div class="topbar-actions"><div class="icon-btn"><svg class="ic" viewBox="0 0 24 24"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg></div></div>
            </div>
            <div class="admin-content" id="rpMacContent">
              <div class="stat-grid">
                <div class="stat-box panel accent"><div class="num">1,842</div><div class="lbl">Total Leads</div></div>
                <div class="stat-box panel"><div class="num">214</div><div class="lbl">Not Called</div></div>
                <div class="stat-box panel"><div class="num" style="display:inline-block;">6</div><span class="live-dot"></span><div class="lbl">On Call Now</div></div>
                <div class="stat-box panel"><div class="num">37</div><div class="lbl">Successful</div></div>
              </div>
              <div class="section-title">Recent Leads</div>
              <div class="panel p" style="padding:0;overflow:hidden;">
                <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                  <tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Margaret W.</td><td style="padding:11px 0;"><span class="badge ok">Successful</span></td></tr>
                  <tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Derek H.</td><td style="padding:11px 0;"><span class="badge warn">Attempted · 2</span></td></tr>
                  <tr><td style="padding:11px 16px;">Sandra P.</td><td style="padding:11px 0;"><span class="badge gold">Callback 2PM</span></td></tr>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="rp-phone tilt">
      <div class="rp-phone-notch"></div>
      <div class="rp-phone-screen">
        <div class="topbar" style="padding:20px 16px 12px;">
          <div class="rp-brand"><div class="rp-brand-mark"><img src="/clearpanel-logo.png" alt="" /></div>ClearPanel</div>
          <div class="topbar-actions">
            <div class="icon-btn" style="width:32px;height:32px;"><svg class="ic" viewBox="0 0 24 24"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg></div>
            <button class="clock-toggle"><span class="clock-dot"></span>04:12:08</button>
          </div>
        </div>
        <div class="staff-body" style="padding:14px 12px 90px;flex:1;overflow:hidden;" id="rpPhoneBody">
          <div id="rpScreenQueue">
          <div class="panel p" style="padding:12px 13px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" style="width:15px;height:15px;"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 15.4l-5.3 2.9 1.2-5.9L3.4 8.3l6-.7z"/></svg></div>
            <div style="flex:1;min-width:0;">
              <div style="font-size:11px;font-weight:700;margin-bottom:4px;">Finisher II</div>
              <div style="height:6px;border-radius:100px;background:rgba(255,255,255,.08);overflow:hidden;"><div style="height:100%;width:68%;border-radius:100px;background:var(--grad);"></div></div>
            </div>
            <span style="font-size:9.5px;color:var(--text-faint);font-weight:700;white-space:nowrap;">2,140 XP</span>
          </div>
          <div class="panel p" style="padding:11px 13px;margin-bottom:10px;background:rgba(129,140,248,.07);border-color:rgba(129,140,248,.25);">
            <span style="font-size:9px;font-weight:800;letter-spacing:.1em;color:#a5b4fc;text-transform:uppercase;display:block;margin-bottom:6px;">Due Callback</span>
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:600;">Sandra P. \u2014 2:00 PM</span>
              <span class="badge warn" style="font-size:9px;">Call Now</span>
            </div>
          </div>
          <div class="offer-card">
            <div class="pulse-dot"></div>
            <div class="offer-label" style="color:var(--success);">New Lead <span style="color:var(--text-faint);font-weight:600;">\u00b7 2m ago</span></div>
            <div class="offer-name">Margaret Whitfield</div>
            <div style="margin:2px 0 12px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;"><span class="mono" style="font-size:11px;color:var(--text-dim);">+44 7911 042 738</span><span class="badge gold" style="font-size:8.5px;">Barclays</span></div>
            <div class="offer-actions"><button class="btn btn-gold" style="flex:1;padding:11px;font-size:12px;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" style="width:13px;height:13px;vertical-align:-2px;margin-right:5px;"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>Take Call</button><button class="btn btn-ghost" style="padding:11px 14px;font-size:12px;">Skip</button></div>
          </div>
          <div class="offer-card">
            <div class="pulse-dot" style="background:var(--gold-bright);"></div>
            <div class="offer-label" style="color:var(--gold-bright);">Called 1 time \u2014 no success yet <span style="color:var(--text-faint);font-weight:600;">\u00b7 3h ago</span></div>
            <div class="offer-name">Derek Hughes</div>
            <div style="margin:2px 0 8px;"><span class="mono" style="font-size:11px;color:var(--text-dim);">+44 7700 900 192</span></div>
            <div style="font-size:10.5px;color:var(--text-faint);display:flex;align-items:center;gap:6px;">Last attempt: <span class="badge dim" style="font-size:8.5px;">Voicemail</span></div>
          </div>
          </div>          </div>
        </div>
        <div class="bottom-nav" style="position:absolute;">
          <button class="nav-btn active" data-rp="queue"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>Queue</button>
          <button class="nav-btn" data-rp="call"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.7A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 2 .7 2.8a2 2 0 01-.4 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.9.5 2.8.7a2 2 0 011.7 2z"/></svg>Call</button>
          <button class="nav-btn" data-rp="chat"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H8l-4 4V5z"/></svg>Chat</button>
          <button class="nav-btn" data-rp="board"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>Board</button>
        </div>
      </div>
    </div>
  </div>
  <div class="rp-caption rv">Left: the admin dashboard, widescreen, exactly as it renders on a laptop. Right: the caller queue on a phone. Same CSS, same components — no separate design was made for this page.</div>
</div></section>

<section id="guide"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">The full guide</div><h2 class="sec-title">Exactly how your team runs on it</h2></div><p class="sec-sub">From key to first dial, this is the complete workflow — the same steps your admin and callers follow in the real panel.</p></div>
  <div class="guide-cols stagger">
    <div class="gcol rv spot">
      <div class="gtag">Day zero — you</div>
      <div class="gstep"><i>1</i><div><b>Redeem your key</b><p>Enter it at the redeem page, name your call centre. Your panel spins up instantly at its own private URL with a fresh admin PIN — save both.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Open your admin panel</b><p>Log in with the PIN. Brand it — your name and logo replace ours everywhere, including the app icon your callers install.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Load your leads</b><p>Paste or import leads in bulk. The importer parses names and numbers, flags possible duplicates, and files everything under bank categories you pick.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Create your callers</b><p>Add each caller — every one gets their own PIN. Send them your panel link; they install it to their home screen like a native app.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Drop in scripts</b><p>Write scripts per audience (opener / finisher) — or on 14-day+ plans, describe the pitch and let the AI writer draft the full script with objection handling.</p></div></div>
    </div>
    <div class="gcol rv spot">
      <div class="gtag">Every day — your callers</div>
      <div class="gstep"><i>1</i><div><b>Log in &amp; verify</b><p>PIN in, Telegram-verified once via a 6-digit code — no anonymous accounts on your call center. Then clock in; the timer runs on screen.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Claim from the queue</b><p>Due callbacks sit on top. Fresh leads first, retries labelled with their last outcome. One tap claims the lead and opens the call screen.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Call and log — no skipping</b><p>Script on screen, timer running. When the call ends they must pick an outcome — successful, callback (with a date), voicemail, no answer, busy, wrong number. XP lands on the spot.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Pass closes to a finisher</b><p>Successful calls flow to your finishing queue automatically, with every note attached — nothing lost in the handoff.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Climb the ranks</b><p>Eleven tiers from Seed to Legend, a live leaderboard, celebration animations on closes. At day's end they clock out — and get reminded if they forget.</p></div></div>
    </div>
    <div class="gcol rv spot">
      <div class="gtag">All week — running the call center</div>
      <div class="gstep"><i>1</i><div><b>Watch it live</b><p>The dashboard counts everything in real time — uncalled, attempted, exhausted, successful, awaiting finishing — with call durations per lead.</p></div></div>
      <div class="gstep"><i>2</i><div><b>Work leads in bulk</b><p>Select any set of leads and assign, vault, reset or delete them together. The stale view surfaces anything untouched for N days.</p></div></div>
      <div class="gstep"><i>3</i><div><b>Recirculate on your terms</b><p>Leads that hit the 3-attempt cap collect under a Max Attempts tile — one tap shows them, and only you decide if they go back out.</p></div></div>
      <div class="gstep"><i>4</i><div><b>Broadcast &amp; maintain</b><p>Push a pulsing update banner to every caller instantly when you're changing things, and message the whole floor over Telegram.</p></div></div>
      <div class="gstep"><i>5</i><div><b>Renew without drama</b><p>When your period ends the panel pauses with data intact — redeem the next key and everything resumes exactly where it stopped.</p></div></div>
    </div>
  </div>
</div></section>

<section id="features"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Everything included</div><h2 class="sec-title">Built for call centers that actually dial</h2></div><p class="sec-sub">Every panel ships with the full toolkit. No add-ons, no per-seat pricing, no feature gates.</p></div>
  <div class="feat-grid stagger">
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div><h3>Smart lead queue</h3><p>Leads flow to callers automatically. Attempt caps stop dead numbers circulating, callbacks resurface at exactly the right time, and nothing gets called twice by accident.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg></div><h3>One-tap outcomes</h3><p>Successful, callback, voicemail, no answer — one tap logs it, awards XP and pulls the next lead. Outcomes are mandatory, so your data is never full of holes.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.6 5.6 6 .7-4.5 4.1 1.2 5.9L12 15.4l-5.3 2.9 1.2-5.9L3.4 8.3l6-.7z"/></svg></div><h3>Ranks &amp; leaderboards</h3><p>Eleven rank tiers from Seed to Legend. XP for every logged call, live leaderboards, celebration animations on closes — your call center competes with itself.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div><h3>Encrypted messaging</h3><p>Team chat with disappearing messages, plus true end-to-end encrypted DMs — sealed on the device, unreadable by the server. Your floor talk stays yours.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2.5L2.8 9.7c-.9.35-.85 1.65.08 1.92l4.62 1.34 1.7 5.5c.27.87 1.4.98 1.85.18l2.3-4.1 4.9 3.6c.75.55 1.8.13 1.97-.78l3.1-13.3c.2-.9-.68-1.65-1.52-1.32z"/></svg></div><h3>Telegram-verified staff</h3><p>Every caller verifies through Telegram before they can dial. Clock-in tracking, clock-out reminders, and broadcast announcements straight to their phones.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg></div><h3>AI script writer</h3><p>Describe the pitch, pick the audience, get a full call script — opener, qualifying questions, objection handling and close — in seconds. Multi-provider failover keeps it up.</p></div>
    <div class="feat rv panel-card spot"><div class="fic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div><h3>Every bank &amp; every coin, built in</h3><p>Tag leads by institution from a directory of banks worldwide — UK high street, digital &amp; challengers, building societies and specialist lenders, plus the US, Canada, Europe, Asia-Pacific, the Middle East, Africa and Latin America. Full crypto coverage too: every major exchange and wallet, each as its own category. Real brand logos load automatically on every lead.</p></div>
  </div>
</div></section>

<section><div class="wrap">
  <div class="sec-head solo rv"><div><div class="eyebrow">How it works</div><h2 class="sec-title">Key to live panel in three steps</h2></div></div>
  <div class="steps stagger">
    <div class="step rv panel-card spot"><h3>Buy an access key</h3><p>Pick a duration below. You get a one-time license key — yours to redeem whenever you're ready.</p></div>
    <div class="step rv panel-card spot"><h3>Redeem it</h3><p>Enter the key, name your call centre, done. Your own panel spins up instantly with a fresh admin PIN.</p></div>
    <div class="step rv panel-card spot"><h3>Add your call center</h3><p>Create callers, drop in leads, set your scripts. Your team logs in from any phone or laptop — nothing to install.</p></div>
  </div>
</div></section>

<section id="vs"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Why call centers switch</div><h2 class="sec-title">Spreadsheets were never built for this</h2></div><p class="sec-sub">Most floors run on a group chat, a shared sheet, and hope. Here is what that actually costs you.</p></div>
  <div class="vs-grid stagger">
    <div class="vs-col panel-card spot rv bad">
      <div class="vs-head"><span class="vsic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg></span>The old way</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>Leads live in a sheet — two callers dial the same number, nobody notices</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>Outcomes logged "later" — which means never</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>Callbacks promised on calls, remembered by no one</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>You find out how the day went at the end of the day</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M18 6L6 18M6 6l12 12"/></svg>New caller? An hour of walkthroughs and screenshots</div>
    </div>
    <div class="vs-col panel-card spot rv good">
      <div class="vs-head"><span class="vsic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg></span>On ClearPanel</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>One queue, one claim — a lead can only ever be in one caller's hands</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>Outcomes are mandatory — the call literally cannot end without one</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>Callbacks resurface themselves at the right moment, pinned on top</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>Live dashboard — you watch the call center as it happens, not after</div>
      <div class="vs-row"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M20 6L9 17l-5-5"/></svg>New caller gets a PIN and a link — dialing in two minutes</div>
    </div>
  </div>
</div></section>

<section id="sixty"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">From checkout to first dial</div><h2 class="sec-title">Live in sixty seconds</h2></div><p class="sec-sub">No onboarding call. No sales demo. No waiting for access. The clock starts when you pay.</p></div>
  <div class="tl">
    <div class="tl-item rv"><div class="tl-time">0:00</div><b>Buy a key</b><p>Checkout takes card, PayPal or crypto. Your key is on screen the second payment clears — delivered automatically, no human in the loop.</p></div>
    <div class="tl-item rv"><div class="tl-time">0:15</div><b>Redeem it</b><p>Paste the key, name your call centre. Your private panel spins up instantly at its own URL with a fresh admin PIN.</p></div>
    <div class="tl-item rv"><div class="tl-time">0:35</div><b>Make it yours</b><p>Your name and logo replace ours everywhere — the login screen, the topbar, even the app icon your callers install.</p></div>
    <div class="tl-item rv"><div class="tl-time">0:60</div><b>Load leads. Dial.</b><p>Paste your first batch, add a caller, send them the link. That's a working floor — inside a minute.</p></div>
  </div>
</div></section>

<section id="pricing"><div class="wrap">
  <div class="sec-head rv"><div><div class="eyebrow">Pricing</div><h2 class="sec-title">Pick your runway</h2></div><p class="sec-sub">Unlimited callers and leads on every tier. Longer keys unlock more of the platform — and Lifetime unlocks all of it, forever.</p></div>
  <div class="pk">

    <div class="pk-main plan hot rv panel-card spot"><div class="plan-top"></div><span class="plan-tag">Most popular</span><div class="plan-in">
      <div class="dur">14 days</div>
      <div class="price"><small>&pound;</small>${P.d14}</div>
      <div class="per">Two weeks &mdash; long enough to train the call center on it</div>${perDay(P.d14, 14)}
      <ul>
        <li>${TICK}Everything in the 7-day key</li>
        <li>${TICK}<span><b>AI script writer</b> &mdash; openers, qualifying questions and objection handling, drafted from your pitch</span></li>
        <li>${TICK}Your own dedicated Telegram bot</li>
        <li>${TICK}Renew early and the days stack &mdash; nothing is wasted</li>
      </ul>
      <a class="btn btn-grad" href="${B.d14}" target="_blank" rel="noopener">Get 14 Days</a>
    </div></div>

    <div class="pk-rail">
      <div class="pk-row rv">
        <div class="pk-dur">3 days</div>
        <div><div class="pk-price"><small>&pound;</small>${P.d3}</div><div class="pk-adds">The trial run. The full panel, nothing gated except the three add-ons.</div></div>
        <a class="btn btn-ghost pk-cta" href="${B.d3}" target="_blank" rel="noopener">Get it</a>
      </div>
      <div class="pk-row rv">
        <div class="pk-dur">7 days</div>
        <div><div class="pk-price"><small>&pound;</small>${P.d7}</div><div class="pk-adds">Adds <b>your own Telegram bot</b> &mdash; sign-in codes and broadcasts under your name.</div></div>
        <a class="btn btn-ghost pk-cta" href="${B.d7}" target="_blank" rel="noopener">Get it</a>
      </div>
      <div class="pk-row rv">
        <div class="pk-dur">30 days</div>
        <div><div class="pk-price"><small>&pound;</small>${P.d30}</div><div class="pk-adds">Adds <b>telephony &amp; IVR</b> &mdash; inbound routing, callbacks landing on the lead owner.</div></div>
        <a class="btn btn-ghost pk-cta" href="${B.d30}" target="_blank" rel="noopener">Get it</a>
      </div>
      <div class="pk-row life rv">
        <div class="pk-dur">Lifetime</div>
        <div><div class="pk-price"><small>&pound;</small>${P.life}</div><div class="pk-adds">Everything unlocked, <b>no expiry, no renewals</b>, and every future feature included.</div></div>
        <a class="btn btn-grad pk-cta" href="${B.life}" target="_blank" rel="noopener">Own it</a>
      </div>
    </div>
  </div>

  <div class="pk-base rv">
    <h4>On every tier, including the 3-day</h4>
    <div class="pk-base-grid">
      <span>${TICK}Smart lead queue + attempt caps</span>
      <span>${TICK}One-tap mandatory outcomes</span>
      <span>${TICK}Scheduled callbacks</span>
      <span>${TICK}Team chat + E2E encrypted DMs</span>
      <span>${TICK}XP ranks &amp; leaderboard</span>
      <span>${TICK}Bulk import + bank categories</span>
      <span>${TICK}Telegram-verified staff &amp; clock-in</span>
      <span>${TICK}Unlimited callers &amp; leads</span>
      <span>${TICK}Your own branding and panel URL</span>
    </div>
</div></section>

<section id="faq"><div class="wrap">
  <div class="sec-head solo rv"><div><div class="eyebrow">FAQ</div><h2 class="sec-title">Quick answers</h2></div></div>
  <div class="faq rv">
    <details><summary>How fast is my panel live after I redeem a key?</summary><div class="a"><div>Immediately. Redemption creates your panel, your URL and your admin PIN in one step — most people are inviting callers within the first minute.</div></div></details>
    <details><summary>Do my callers need to install anything?</summary><div class="a"><div>No. The panel runs in any browser and installs to a phone home screen like a native app. Callers just need the link and their PIN.</div></div></details>
    <details><summary>What happens when my access period ends?</summary><div class="a"><div>The panel pauses — data stays intact. Redeem another key or renew to pick up exactly where you left off.</div></div></details>
    <details><summary>Is there a limit on callers or leads?</summary><div class="a"><div>No. Every tier includes unlimited callers and unlimited leads. Longer tiers additionally unlock premium features — your own Telegram bot from 7 days, the AI script writer from 14, telephony &amp; IVR from 30.</div></div></details>
  </div>
</div></section>

<section><div class="wrap"><div class="final rv">
  <h2 class="sec-title">Ready when you are</h2>
  <p class="sec-sub" style="margin:0 auto 28px;">Grab a key, redeem it, and your call center is dialing today.</p>
  <div class="hero-ctas" style="margin:0;">
    <a class="btn btn-grad btn-lg" href="${cta}" target="_blank" rel="noopener">Get a Key</a>
    <a class="btn btn-ghost btn-lg" href="/redeem">Redeem a Key</a>
  </div>
</div></div></section>

<footer><div class="wrap" style="display:contents;">
  <span>ClearPanel</span>
  <div class="flinks"><a href="/login">Panel Login</a><a href="/redeem">Redeem</a><a href="/affiliate">Affiliates</a></div>
</div></footer>

<div class="mini-cta" id="miniCta">
  <span>Your panel is <b>one key</b> away</span>
  <a class="btn btn-grad" href="#pricing" style="padding:10px 20px;">Get Access</a>
</div>

<script>

  // ===== Wave 4: cinematic hero =====
  (function(){
    var RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var hero = document.querySelector('.hero');

    // count-up
    document.querySelectorAll('.hero-counters .cu').forEach(function(el){
      var to=+el.dataset.to, t0=null, dur=1600;
      function f(t){ if(!t0)t0=t; var p=Math.min(1,(t-t0)/dur); var e=1-Math.pow(1-p,3);
        el.textContent=Math.round(to*e).toLocaleString(); if(p<1)requestAnimationFrame(f); }
      setTimeout(function(){ requestAnimationFrame(f); }, 1100);
    });

    // sticky nav solidify
    var nav=document.querySelector('nav');
    if(nav){ var onScroll=function(){ nav.classList.toggle('scrolled', scrollY>40); }; addEventListener('scroll',onScroll,{passive:true}); onScroll(); }

    // spotlight
    var spot=document.getElementById('heroSpot');
    if(spot && !RM && matchMedia('(hover:hover)').matches){
      hero.addEventListener('pointermove',function(e){
        var r=hero.getBoundingClientRect();
        spot.style.setProperty('--mx',((e.clientX-r.left)/r.width*100)+'%');
        spot.style.setProperty('--my',((e.clientY-r.top)/r.height*100)+'%');
      });
    }

    // dispatch grid
    var cv=document.getElementById('dispatchGrid');
    if(cv && !RM){
      var ctx=cv.getContext('2d'), W,H,DPR=Math.min(devicePixelRatio||1,2), nodes=[], beams=[], t=0, GAP=64, mx=-999,my=-999;
      function build(){
        var r=hero.getBoundingClientRect(); W=r.width; H=r.height;
        cv.width=W*DPR; cv.height=H*DPR; cv.style.width=W+'px'; cv.style.height=H+'px';
        ctx.setTransform(DPR,0,0,DPR,0,0); nodes=[];
        var COLS=Math.ceil(W/GAP)+1, ROWS=Math.ceil(H/GAP)+1;
        for(var y=0;y<ROWS;y++)for(var x=0;x<COLS;x++)
          nodes.push({bx:x*GAP,by:y*GAP,x:x*GAP,y:y*GAP,hot:Math.random()<0.08,ph:Math.random()*6.28,pulse:0});
      }
      build();
      var rt; addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(build,200);});
      hero.addEventListener('pointermove',function(e){var r=hero.getBoundingClientRect();mx=e.clientX-r.left;my=e.clientY-r.top;});
      hero.addEventListener('pointerleave',function(){mx=-999;my=-999;});
      function fire(){
        var hots=nodes.filter(function(n){return n.hot;}); if(!hots.length)return;
        var a=hots[(Math.random()*hots.length)|0], b=nodes[(Math.random()*nodes.length)|0];
        var d=Math.hypot(a.x-b.x,a.y-b.y); if(d<40||d>320)return;
        beams.push({a:a,b:b,p:0}); a.pulse=1;
      }
      var last=0, running=true;
      function frame(ts){
        if(!running)return;
        if(ts-last<28){requestAnimationFrame(frame);return;} last=ts; t+=0.016;
        ctx.clearRect(0,0,W,H);
        for(var i=0;i<nodes.length;i++){
          var n=nodes[i], drift=Math.sin(t*0.6+n.ph)*2; n.x=n.bx; n.y=n.by+drift;
          var dx=n.x-mx,dy=n.y-my,dd=Math.hypot(dx,dy);
          if(dd<120){var f=(120-dd)/120*14;n.x+=dx/dd*f;n.y+=dy/dd*f;}
          if(n.pulse>0)n.pulse-=0.02;
          var base=n.hot?2.2:1.1, glow=n.hot?(0.65+Math.sin(t*2+n.ph)*0.35):0.22;
          if(n.pulse>0){base+=n.pulse*3;glow+=n.pulse*0.6;}
          ctx.beginPath(); ctx.arc(n.x,n.y,base,0,6.28);
          if(n.hot){ctx.fillStyle='rgba(122,171,255,'+glow+')';ctx.shadowColor='rgba(122,171,255,.8)';ctx.shadowBlur=n.pulse>0?18:8;}
          else{ctx.fillStyle='rgba(180,190,220,'+glow+')';ctx.shadowBlur=0;}
          ctx.fill(); ctx.shadowBlur=0;
        }
        for(var j=beams.length-1;j>=0;j--){
          var bm=beams[j]; bm.p+=0.022;
          if(bm.p>=1){bm.b.pulse=1;beams.splice(j,1);continue;}
          var cx=bm.a.x+(bm.b.x-bm.a.x)*bm.p, cy=bm.a.y+(bm.b.y-bm.a.y)*bm.p;
          var g=ctx.createLinearGradient(bm.a.x,bm.a.y,cx,cy);
          g.addColorStop(0,'rgba(122,171,255,0)'); g.addColorStop(1,'rgba(122,171,255,.55)');
          ctx.strokeStyle=g; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(bm.a.x,bm.a.y); ctx.lineTo(cx,cy); ctx.stroke();
          ctx.beginPath(); ctx.arc(cx,cy,2.4,0,6.28); ctx.fillStyle='rgba(196,176,255,.95)';
          ctx.shadowColor='rgba(122,171,255,1)'; ctx.shadowBlur=14; ctx.fill(); ctx.shadowBlur=0;
        }
        if(Math.random()<0.3) fire();
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
      document.addEventListener('visibilitychange',function(){ running=!document.hidden; if(running){last=0;requestAnimationFrame(frame);} });
    }
  })();
(function(){
  var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.12 });
  document.querySelectorAll('.rv').forEach(function(el){ io.observe(el); });

  // ---- interactive phone demo: real bottom-nav switches real screens ----
  var RP_SCREENS = {
    call: '<div class="offer-card" style="text-align:center;padding:16px 14px;">'
      + '<div class="offer-label" style="color:var(--success);">On Call \u00b7 04:52</div>'
      + '<div class="offer-name" style="font-size:20px;">Margaret Whitfield</div>'
      + '<div class="mono" style="font-size:11px;color:var(--text-dim);margin-bottom:12px;">+44 7911 042 738</div>'
      + '<button class="win-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" style="width:15px;height:15px;"><path d="M20 6L9 17l-5-5"/></svg>Successful Call</button>'
      + '<div class="outcome-grid" style="margin-top:8px;">'
      + '<button>Hung Up</button><button>Chopped Previously</button><button>Cancel</button>'
      + '</div>'
      + '<button class="review-btn" style="margin-top:8px;">Callback Requested</button>'
      + '<div class="outcome-grid" style="grid-template-columns:1fr 1fr;margin-top:8px;">'
      + '<button class="fail-btn">Unsuccessful</button><button class="review-btn" style="margin:0;">Requires Review</button>'
      + '</div></div>'
      + '<div style="font-size:10px;color:var(--text-faint);text-align:center;padding:0 8px;">An outcome is required before the next lead \u2014 no skipped logs, ever.</div>',
    chat: '<div style="display:flex;gap:4px;padding:4px;border-radius:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);margin-bottom:12px;">'
      + '<span style="flex:1;text-align:center;padding:7px;border-radius:100px;font-size:11px;font-weight:700;background:var(--grad);color:#fff;">Team</span>'
      + '<span style="flex:1;text-align:center;padding:7px;border-radius:100px;font-size:11px;font-weight:700;color:var(--text-dim);">Direct</span></div>'
      + '<div class="panel p" style="padding:9px 12px;margin-bottom:8px;max-width:82%;font-size:11.5px;">Anyone got the finisher script for the HSBC batch?<small style="display:block;font-size:9px;color:var(--text-faint);margin-top:3px;">Jamie &middot; 2:14 PM</small></div>'
      + '<div class="panel p" style="padding:9px 12px;margin-bottom:8px;max-width:82%;margin-left:auto;font-size:11.5px;background:rgba(79,140,255,.1);border-color:rgba(79,140,255,.28);">Scripts tab, second one down.<small style="display:block;font-size:9px;color:var(--text-faint);margin-top:3px;">You &middot; 2:15 PM</small></div>'
      + '<div style="display:flex;align-items:center;gap:6px;font-size:9.5px;color:var(--success);font-weight:700;justify-content:center;padding:10px 0;"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" style="width:11px;height:11px;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Direct messages are end-to-end encrypted</div>',
    board: '<div class="panel p" style="padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;">'
      + '<b style="font-size:15px;color:var(--gold-bright);width:16px;">1</b><div style="width:30px;height:30px;border-radius:50%;background:var(--grad);"></div><div style="flex:1;"><b style="font-size:12.5px;display:block;">Jamie R.</b><span style="font-size:10px;color:var(--text-faint);">Grandmaster</span></div><span class="mono" style="font-size:12px;font-weight:700;">4,820</span></div>'
      + '<div class="panel p" style="padding:14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;background:rgba(79,140,255,.06);border-color:rgba(79,140,255,.25);">'
      + '<b style="font-size:15px;color:var(--text-dim);width:16px;">2</b><div style="width:30px;height:30px;border-radius:50%;background:var(--grad);"></div><div style="flex:1;"><b style="font-size:12.5px;display:block;">You</b><span style="font-size:10px;color:var(--text-faint);">Finisher II</span></div><span class="mono" style="font-size:12px;font-weight:700;">2,140</span></div>'
      + '<div class="panel p" style="padding:14px;display:flex;align-items:center;gap:12px;">'
      + '<b style="font-size:15px;color:var(--text-dim);width:16px;">3</b><div style="width:30px;height:30px;border-radius:50%;background:var(--grad);"></div><div style="flex:1;"><b style="font-size:12.5px;display:block;">Priya S.</b><span style="font-size:10px;color:var(--text-faint);">Finisher I</span></div><span class="mono" style="font-size:12px;font-weight:700;">1,905</span></div>'
  };
  var _rpQueueHtml = null;
  function showRpScreen(key){
    var body = document.getElementById('rpPhoneBody');
    if (!body) return;
    if (_rpQueueHtml === null) {
      var q = document.getElementById('rpScreenQueue');
      if (q) _rpQueueHtml = q.outerHTML;
    }
    body.innerHTML = key === 'queue' ? _rpQueueHtml : (RP_SCREENS[key] || _rpQueueHtml);
    document.querySelectorAll('.rp-phone .nav-btn').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-rp') === key); });
  }
  document.querySelectorAll('.rp-phone .nav-btn').forEach(function(b){
    b.addEventListener('click', function(){ showRpScreen(b.getAttribute('data-rp')); _rpUserTouched = true; });
  });

  // ---- mac window: sidebar tabs swap the admin content ----
  var RPM_SCREENS = {
    leads: '<div style="display:flex;gap:8px;margin-bottom:14px;align-items:center;">'
      + '<span class="badge gold">4 selected</span>'
      + '<span style="font-size:11px;color:var(--text-faint);font-weight:600;">Assign \u00b7 Vault \u00b7 Reset \u00b7 Delete</span></div>'
      + '<div class="panel p" style="padding:0;overflow:hidden;">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12.5px;">'
      + '<tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Margaret W.</td><td>Barclays</td><td style="padding:11px 0;"><span class="badge ok">Successful</span></td></tr>'
      + '<tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Derek H.</td><td>HSBC</td><td style="padding:11px 0;"><span class="badge warn">Attempted \u00b7 2</span></td></tr>'
      + '<tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Sandra P.</td><td>Lloyds</td><td style="padding:11px 0;"><span class="badge gold">Callback 2PM</span></td></tr>'
      + '<tr style="border-bottom:1px solid var(--border);"><td style="padding:11px 16px;">Alan T.</td><td>Nationwide</td><td style="padding:11px 0;"><span class="badge dim">Not Called</span></td></tr>'
      + '<tr><td style="padding:11px 16px;">Grace M.</td><td>Santander</td><td style="padding:11px 0;"><span class="badge dim">Max Attempts</span></td></tr>'
      + '</table></div>',
    scripts: '<div class="section-title" style="margin-top:0;">Script Library</div>'
      + '<div class="panel p" style="padding:16px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><b style="font-size:13.5px;">Barclays Opener v3</b><span class="badge ok" style="font-size:9px;">Active</span></div>'
      + '<p style="font-size:12px;color:var(--text-dim);margin:0;">Good afternoon, am I speaking with [name]? This is [caller] calling about your recent...</p></div>'
      + '<div class="panel p" style="padding:16px;margin-bottom:10px;">'
      + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><b style="font-size:13.5px;">HSBC Finisher</b><span class="badge dim" style="font-size:9px;">Draft</span></div>'
      + '<p style="font-size:12px;color:var(--text-dim);margin:0;">Perfect \u2014 so just to confirm what we have covered today...</p></div>'
      + '<div style="display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--gold-bright);font-weight:600;padding:4px 2px;">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/></svg>'
      + 'AI writer drafts full scripts with objection handling \u2014 14-day plans and up</div>'
  };
  var _rpmDashHtml = null;
  function showRpmScreen(key){
    var body = document.getElementById('rpMacContent');
    if (!body) return;
    if (_rpmDashHtml === null) _rpmDashHtml = body.innerHTML;
    body.innerHTML = key === 'dash' ? _rpmDashHtml : (RPM_SCREENS[key] || _rpmDashHtml);
    document.querySelectorAll('.rp-mac .side-link[data-rpm]').forEach(function(l){ l.classList.toggle('active', l.getAttribute('data-rpm') === key); });
  }
  document.querySelectorAll('.rp-mac .side-link[data-rpm]').forEach(function(l){
    l.addEventListener('click', function(){ showRpmScreen(l.getAttribute('data-rpm')); });
  });

  // ---- auto-cycle the phone demo until the visitor interacts ----
  var _rpUserTouched = false;
  var _rpCycle = ['queue','call','chat','board'];
  var _rpIdx = 0;
  var _rpTimer = setInterval(function(){
    if (_rpUserTouched) { clearInterval(_rpTimer); return; }
    if (!document.getElementById('rpPhoneBody')) return;
    _rpIdx = (_rpIdx + 1) % _rpCycle.length;
    showRpScreen(_rpCycle[_rpIdx]);
  }, 4200);

  // ---- scroll progress bar ----
  var prog = document.getElementById('scrollProgress');
  if (prog) {
    var onScroll = function(){
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      prog.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---- count-up numbers when they enter the viewport ----
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cntIo = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      cntIo.unobserve(e.target);
      var el = e.target;
      var to = parseInt(el.getAttribute('data-to'), 10);
      if (!to || reduced) return;
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var start = null;
      function step(ts){
        if (start === null) start = ts;
        var t = Math.min((ts - start) / 1100, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.innerHTML = prefix + Math.round(to * eased) + suffix;
        if (t < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.cnt[data-to]').forEach(function(el){ cntIo.observe(el); });

  // ---- demo-floor ticker rotation ----
  var tickerMsgs = [
    '<b>Jamie</b> claimed a fresh lead from the queue',
    '<b>Priya</b> logged an outcome \u2014 Successful',
    'Callback with <b>Sandra P.</b> due in 15 minutes',
    '<b>Marcus</b> clocked in \u2014 6 callers in the call center',
    '<b>Jamie</b> booked a callback for tomorrow 2 PM',
    'A lead hit its attempt cap \u2014 parked for admin review',
    '<b>Priya</b> ranked up to Finisher I'
  ];
  var tickerEl = document.getElementById('tickerMsg');
  var tIdx = 0;
  if (tickerEl && !reduced) {
    setInterval(function(){
      tickerEl.classList.add('swap');
      setTimeout(function(){
        tIdx = (tIdx + 1) % tickerMsgs.length;
        tickerEl.innerHTML = tickerMsgs[tIdx];
        tickerEl.classList.remove('swap');
      }, 350);
    }, 3400);
  }


  // ---- hero: the real queue component, running ----
  (function(){
    var host = document.getElementById('hdCard');
    if (!host) return;
    var leads = [
      { n:'Margaret Whitfield', p:'+44 7911 042 738', b:'Barclays', t:'NEW LEAD', s:'2m ago' },
      { n:'Derek Hughes',       p:'+44 7700 900 183', b:'Monzo',    t:'CALLED 1 TIME', s:'3h ago' },
      { n:'Sandra Pryce',       p:'+44 7488 118 204', b:'Lloyds',   t:'DUE CALLBACK', s:'2:00 PM' },
      { n:'Ade Fashola',        p:'+44 7551 067 912', b:'NatWest',  t:'NEW LEAD', s:'just now' }
    ];
    var outcomes = ['Successful','Callback','Hung Up','No Answer','Wrong Number','Not Interested'];
    var i = 0, t0 = Date.now(), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function paint(pickIdx){
      var L = leads[i % leads.length];
      host.innerHTML =
        '<div class="offer-card hd-swap">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">'
        +   '<span style="font-size:9.5px;font-weight:800;letter-spacing:.09em;color:var(--gold-bright);">' + L.t + '</span>'
        +   '<span style="font-size:9.5px;color:var(--text-faint);">' + L.s + '</span>'
        + '</div>'
        + '<div style="font-family:Bricolage Grotesque,sans-serif;font-weight:700;font-size:17px;letter-spacing:-.02em;margin-bottom:5px;">' + L.n + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">'
        +   '<span style="font-family:Geist Mono,monospace;font-size:11.5px;color:var(--text-dim);">' + L.p + '</span>'
        +   '<span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:100px;background:rgba(79,140,255,.13);border:1px solid rgba(79,140,255,.3);color:var(--gold-bright);">' + L.b + '</span>'
        + '</div>'
        + '<div class="outcome-grid">'
        +   outcomes.map(function(o,k){
              return '<button' + (k === pickIdx ? ' class="hd-picked"' : '') + '>' + o + '</button>';
            }).join('')
        + '</div>'
        + '</div>';
    }

    paint(-1);
    if (!reduced) {
      setInterval(function(){
        var pick = Math.floor(Math.random() * outcomes.length);
        paint(pick);
        setTimeout(function(){
          var card = host.querySelector('.hd-swap');
          if (card) card.classList.add('out');
          setTimeout(function(){ i++; paint(-1); }, 300);
        }, 1150);
      }, 4200);
    }

    var clock = document.getElementById('hdClock');
    if (clock) setInterval(function(){
      var e = Math.floor((Date.now() - t0) / 1000);
      clock.textContent = String(Math.floor(e/60)).padStart(2,'0') + ':' + String(e%60).padStart(2,'0');
    }, 1000);
  })();

  // ---- cursor spotlight tracking on cards ----
  document.querySelectorAll('.spot').forEach(function(card){
    card.addEventListener('pointermove', function(ev){
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
      card.style.setProperty('--my', (ev.clientY - r.top) + 'px');
    });
  });

  // ---- gentle 3D tilt on the device frames (desktop pointers only) ----
  if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced) {
    document.querySelectorAll('.tilt').forEach(function(el){
      el.addEventListener('pointermove', function(ev){
        var r = el.getBoundingClientRect();
        var rx = ((ev.clientY - r.top) / r.height - 0.5) * -5;
        var ry = ((ev.clientX - r.left) / r.width - 0.5) * 7;
        el.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
      });
      el.addEventListener('pointerleave', function(){ el.style.transform = ''; });
    });
  }

  // ---- marquee: duplicate the track so the -50% loop is seamless ----
  var mtrack = document.getElementById('marqueeTrack');
  if (mtrack) mtrack.innerHTML += mtrack.innerHTML;

  // ---- hero particle field (canvas, GPU-cheap, skipped for reduced motion) ----
  var pc = document.getElementById('heroParticles');
  if (pc && !reduced) {
    var ctx = pc.getContext('2d');
    var pts = [];
    function pcSize(){
      var r = pc.parentElement.getBoundingClientRect();
      pc.width = r.width; pc.height = r.height;
    }
    pcSize();
    window.addEventListener('resize', pcSize, { passive: true });
    var N = Math.min(46, Math.floor(window.innerWidth / 30));
    for (var i = 0; i < N; i++) {
      pts.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - .5) * .0004, vy: (Math.random() - .5) * .0004, r: Math.random() * 1.6 + .4 });
    }
    (function pcTick(){
      ctx.clearRect(0, 0, pc.width, pc.height);
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > 1) a.vx *= -1;
        if (a.y < 0 || a.y > 1) a.vy *= -1;
        ctx.beginPath();
        ctx.arc(a.x * pc.width, a.y * pc.height, a.r, 0, 6.283);
        ctx.fillStyle = 'rgba(164,142,255,.35)';
        ctx.fill();
        for (var j = i + 1; j < pts.length; j++) {
          var b = pts[j];
          var dx = (a.x - b.x) * pc.width, dy = (a.y - b.y) * pc.height;
          var d2 = dx * dx + dy * dy;
          if (d2 < 12000) {
            ctx.beginPath();
            ctx.moveTo(a.x * pc.width, a.y * pc.height);
            ctx.lineTo(b.x * pc.width, b.y * pc.height);
            ctx.strokeStyle = 'rgba(124,92,255,' + (0.10 * (1 - d2 / 12000)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(pcTick);
    })();
  }

  // ---- scroll-linked parallax: orbs + hero drift at different rates (the oil) ----
  if (!reduced) {
    var orbEls = document.querySelectorAll('.orb');
    var heroEl = document.querySelector('.hero');
    var lastY = -1;
    (function plxTick(){
      var y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        for (var i = 0; i < orbEls.length; i++) {
          orbEls[i].style.transform = 'translateY(' + (y * (0.06 + i * 0.05)).toFixed(1) + 'px)';
        }
        if (heroEl && y < window.innerHeight) {
          heroEl.style.transform = 'translateY(' + (y * 0.18).toFixed(1) + 'px)';
          heroEl.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.85)));
        }
      }
      requestAnimationFrame(plxTick);
    })();
  }

  // ---- magnetic pull on primary buttons (fine pointers only) ----
  if (window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches && !reduced) {
    document.querySelectorAll('.btn-grad').forEach(function(btn){
      btn.addEventListener('pointermove', function(ev){
        var r = btn.getBoundingClientRect();
        var dx = ev.clientX - (r.left + r.width / 2);
        var dy = ev.clientY - (r.top + r.height / 2);
        btn.style.transform = 'translate(' + (dx * 0.14).toFixed(1) + 'px,' + (dy * 0.3).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function(){ btn.style.transform = ''; });
    });
  }

  // ---- scrollspy: highlight the nav link for the section in view ----
  var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav-links a[href^="#"]'));
  var spyIo = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      var id = '#' + e.target.id;
      spyLinks.forEach(function(l){ l.classList.toggle('now', l.getAttribute('href') === id); });
    });
  }, { rootMargin: '-30% 0px -55% 0px' });
  spyLinks.forEach(function(l){
    var sec = document.querySelector(l.getAttribute('href'));
    if (sec) spyIo.observe(sec);
  });

  // ---- sticky mini CTA appears after scrolling past the showcase ----
  var miniCta = document.getElementById('miniCta');
  var pricingSec = document.getElementById('pricing');
  var showcaseSec = document.getElementById('showcase');
  if (miniCta && pricingSec && showcaseSec) {
    var updateMini = function(){
      var past = window.scrollY > (showcaseSec.offsetTop + showcaseSec.offsetHeight - 200);
      var pr = pricingSec.getBoundingClientRect();
      var pricingVisible = pr.top < window.innerHeight && pr.bottom > 0;
      miniCta.classList.toggle('on', past && !pricingVisible);
    };
    window.addEventListener('scroll', updateMini, { passive: true });
    updateMini();
  }
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
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Geist+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#050507;--panel:rgba(255,255,255,.045);--border:rgba(255,255,255,.09);--border-2:rgba(255,255,255,.15);--text:#f0f0f3;--dim:#9494a0;--faint:#5c5c66;--violet:#a78bfa;--violet-soft:#c4b0ff;--gold:#4f8cff;--gold-bright:#7aabff;--success:#22c55e;--danger:#ef4444;--grad:linear-gradient(135deg,var(--violet-soft),var(--gold-bright) 55%,var(--gold));}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'Geist',-apple-system,sans-serif;background:radial-gradient(ellipse 70% 45% at 20% -5%,rgba(167,139,250,.16),transparent 60%),radial-gradient(ellipse 60% 45% at 100% 10%,rgba(79,140,255,.1),transparent 60%),var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:26px 18px;-webkit-font-smoothing:antialiased;}
h1,.brand{font-family:'Bricolage Grotesque',sans-serif;letter-spacing:-.02em;}
a{color:inherit;text-decoration:none;}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px;margin-bottom:40px;}
.brand img{height:24px;width:auto;object-fit:contain;display:block;}
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
