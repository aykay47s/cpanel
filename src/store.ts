// ClearPanel store — marketing/pricing page. No checkout, no payment.
// The "Get in touch" CTA opens a Telegram contact handle that the operator
// configures in their admin panel (Settings → Store Contact URL).
// Operator never changes this file; they change the DB setting.

export function STORE_PAGE(contactUrl: string): string {
  const cta = contactUrl || 'https://t.me/clearpanelotpbot';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClearPanel — Call Centre Management Platform</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Bricolage+Grotesque:wght@700;800;900&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#07070a;--bg2:#0c0c10;--s1:#12121a;--s2:#1a1a24;--s3:#222230;
  --text:#f0f0f4;--dim:#9090a0;--faint:#55555f;
  --violet:#7c5cff;--violet-b:#a78bfa;--pink:#f472b6;--gold:#4f8cff;
  --success:#22c55e;--border:rgba(255,255,255,.07);--border2:rgba(255,255,255,.12);
  --ease:cubic-bezier(.16,1,.3,1);
}
html{scroll-behavior:smooth;}
body{font-family:'Geist',-apple-system,sans-serif;background:var(--bg);color:var(--text);-webkit-font-smoothing:antialiased;overflow-x:hidden;}
h1,h2,h3,h4{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.03em;line-height:1.1;}
a{color:inherit;text-decoration:none;}
button{font-family:inherit;cursor:pointer;border:none;outline:none;}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:100;padding:0 clamp(20px,5vw,80px);height:66px;display:flex;align-items:center;justify-content:space-between;background:rgba(7,7,10,.7);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
.nav-brand{display:flex;align-items:center;gap:12px;}
.nav-brand img{width:36px;height:36px;border-radius:50%;}
.nav-brand span{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:20px;background:linear-gradient(135deg,#fff,var(--violet-b));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.nav-links{display:flex;align-items:center;gap:28px;}
.nav-links a{font-size:13.5px;font-weight:500;color:var(--dim);transition:color .15s;}
.nav-links a:hover{color:var(--text);}
.nav-cta{padding:9px 22px;border-radius:100px;background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;font-weight:700;font-size:13px;transition:transform .15s,box-shadow .15s;}
.nav-cta:hover{transform:translateY(-1px);box-shadow:0 8px 30px rgba(124,92,255,.4);}

/* HERO */
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:120px clamp(20px,5vw,80px) 80px;position:relative;overflow:hidden;}
.hero-bg{position:absolute;inset:0;pointer-events:none;}
.hero-bg::before{content:'';position:absolute;width:900px;height:900px;border-radius:50%;background:radial-gradient(ellipse,rgba(124,92,255,.18) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-55%);}
.hero-bg::after{content:'';position:absolute;width:700px;height:500px;border-radius:50%;background:radial-gradient(ellipse,rgba(244,114,182,.1) 0%,transparent 65%);bottom:0;right:-10%;}
.hero-content{position:relative;max-width:860px;}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;border-radius:100px;background:rgba(124,92,255,.12);border:1px solid rgba(124,92,255,.3);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--violet-b);margin-bottom:28px;}
.hero-badge::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 8px var(--success);}
.hero h1{font-size:clamp(44px,8vw,88px);margin-bottom:24px;background:linear-gradient(160deg,#fff 30%,rgba(167,139,250,.7));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-sub{font-size:clamp(16px,2.5vw,20px);color:var(--dim);line-height:1.65;max-width:620px;margin:0 auto 42px;}
.hero-actions{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;}
.btn-primary{padding:16px 36px;border-radius:100px;background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;font-weight:700;font-size:15px;box-shadow:0 8px 40px rgba(124,92,255,.45);transition:transform .15s,box-shadow .15s;}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 14px 50px rgba(124,92,255,.55);}
.btn-ghost{padding:16px 36px;border-radius:100px;background:rgba(255,255,255,.06);border:1px solid var(--border2);color:var(--text);font-weight:600;font-size:15px;transition:background .15s,transform .15s;}
.btn-ghost:hover{background:rgba(255,255,255,.1);transform:translateY(-2px);}
.hero-stats{display:flex;align-items:center;justify-content:center;gap:40px;margin-top:60px;flex-wrap:wrap;}
.hero-stat{text-align:center;}
.hero-stat .n{font-family:'Bricolage Grotesque',sans-serif;font-size:36px;font-weight:900;background:linear-gradient(135deg,#fff,var(--violet-b));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-stat .l{font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.1em;font-weight:600;margin-top:4px;}
.stat-divider{width:1px;height:40px;background:var(--border2);}

/* SECTIONS */
section{padding:100px clamp(20px,5vw,80px);max-width:1300px;margin:0 auto;}
.section-tag{font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--violet-b);margin-bottom:14px;}
.section-title{font-size:clamp(32px,5vw,52px);margin-bottom:16px;}
.section-sub{font-size:16px;color:var(--dim);line-height:1.65;max-width:540px;}

/* FEATURES GRID */
.features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px;margin-top:56px;}
.feat{padding:28px;border-radius:20px;background:var(--s1);border:1px solid var(--border);transition:border-color .2s,transform .2s var(--ease);}
.feat:hover{border-color:rgba(124,92,255,.35);transform:translateY(-3px);}
.feat-icon{width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px;}
.feat h4{font-size:17px;margin-bottom:8px;}
.feat p{font-size:13.5px;color:var(--dim);line-height:1.6;}

/* HOW IT WORKS */
.how-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:24px;margin-top:56px;}
.how-step{text-align:center;padding:32px 24px;}
.how-num{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--pink));display:flex;align-items:center;justify-content:center;font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 auto 20px;box-shadow:0 8px 24px rgba(124,92,255,.4);}
.how-step h4{font-size:18px;margin-bottom:10px;}
.how-step p{font-size:13.5px;color:var(--dim);line-height:1.6;}

/* TIERS */
.tiers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:56px;}
.tier{border-radius:24px;border:1px solid var(--border);overflow:hidden;position:relative;transition:transform .2s var(--ease),border-color .2s;}
.tier:hover{transform:translateY(-4px);}
.tier.featured{border-color:rgba(124,92,255,.5);box-shadow:0 0 0 1px rgba(124,92,255,.2),0 24px 60px rgba(124,92,255,.2);}
.tier-badge{position:absolute;top:16px;right:16px;padding:4px 12px;border-radius:100px;background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;}
.tier-head{padding:32px 28px 24px;background:var(--s1);}
.tier-name{font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--violet-b);margin-bottom:10px;}
.tier-price{font-family:'Bricolage Grotesque',sans-serif;font-size:42px;font-weight:900;letter-spacing:-.03em;margin-bottom:6px;}
.tier-price span{font-size:16px;font-weight:500;color:var(--dim);}
.tier-desc{font-size:13.5px;color:var(--dim);line-height:1.5;}
.tier-body{padding:28px;background:var(--bg2);}
.tier-features{list-style:none;display:flex;flex-direction:column;gap:12px;margin-bottom:28px;}
.tier-features li{display:flex;align-items:flex-start;gap:10px;font-size:13.5px;line-height:1.4;}
.tier-features li::before{content:'✓';color:var(--success);font-weight:700;flex-shrink:0;margin-top:1px;}
.tier-features li.no::before{content:'–';color:var(--faint);}
.tier-cta{width:100%;padding:14px;border-radius:12px;font-weight:700;font-size:14px;text-align:center;display:block;transition:transform .15s,opacity .15s;}
.tier-cta:hover{transform:translateY(-1px);opacity:.9;}
.tier-cta.primary{background:linear-gradient(135deg,var(--violet),var(--pink));color:#fff;box-shadow:0 6px 24px rgba(124,92,255,.4);}
.tier-cta.ghost{background:rgba(255,255,255,.07);border:1px solid var(--border2);color:var(--text);}

/* SOCIAL PROOF */
.proof-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;margin-top:56px;}
.proof-card{padding:28px;border-radius:20px;background:var(--s1);border:1px solid var(--border);}
.proof-stars{color:#fbbf24;font-size:14px;margin-bottom:14px;letter-spacing:2px;}
.proof-text{font-size:14px;color:var(--dim);line-height:1.7;margin-bottom:18px;font-style:italic;}
.proof-author{display:flex;align-items:center;gap:10px;}
.proof-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--violet),var(--pink));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;}
.proof-name{font-size:13px;font-weight:600;}
.proof-role{font-size:11.5px;color:var(--faint);}

/* TELEGRAM CHANNEL BANNER */
.tg-banner{margin:80px clamp(20px,5vw,80px);border-radius:24px;background:linear-gradient(135deg,rgba(124,92,255,.15),rgba(244,114,182,.1));border:1px solid rgba(124,92,255,.25);padding:48px clamp(24px,5vw,64px);display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap;}
.tg-banner-left h3{font-size:clamp(24px,4vw,36px);margin-bottom:10px;}
.tg-banner-left p{font-size:15px;color:var(--dim);max-width:480px;line-height:1.6;}
.tg-icon{font-size:48px;flex-shrink:0;}

/* FAQ */
.faq{display:flex;flex-direction:column;gap:12px;margin-top:48px;}
.faq-item{border-radius:16px;background:var(--s1);border:1px solid var(--border);overflow:hidden;}
.faq-q{padding:20px 24px;font-weight:600;font-size:14.5px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;user-select:none;}
.faq-q::after{content:'+';font-size:20px;color:var(--violet-b);flex-shrink:0;transition:transform .2s;}
.faq-item.open .faq-q::after{transform:rotate(45deg);}
.faq-a{padding:0 24px;max-height:0;overflow:hidden;font-size:14px;color:var(--dim);line-height:1.7;transition:max-height .3s ease,padding .3s ease;}
.faq-item.open .faq-a{max-height:300px;padding:0 24px 20px;}

/* CTA SECTION */
.cta-section{text-align:center;padding:120px clamp(20px,5vw,80px);position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;width:800px;height:800px;border-radius:50%;background:radial-gradient(ellipse,rgba(124,92,255,.15) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;}
.cta-section h2{font-size:clamp(36px,6vw,64px);margin-bottom:18px;}
.cta-section p{font-size:17px;color:var(--dim);margin-bottom:40px;max-width:520px;margin-left:auto;margin-right:auto;line-height:1.6;}

/* FOOTER */
footer{border-top:1px solid var(--border);padding:40px clamp(20px,5vw,80px);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;}
.footer-brand{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--faint);}
.footer-brand img{width:24px;height:24px;border-radius:50%;}
.footer-links{display:flex;gap:20px;}
.footer-links a{font-size:12.5px;color:var(--faint);transition:color .15s;}
.footer-links a:hover{color:var(--text);}

@media(max-width:640px){.nav-links{display:none;}.hero-stats{gap:24px;}.stat-divider{display:none;}.tg-banner{flex-direction:column;text-align:center;}.tg-banner-left p{margin:0 auto;}}
</style>
</head>
<body>

<nav>
  <a href="/" class="nav-brand">
    <img src="/clearpanel-icon.png" alt="ClearPanel">
    <span>ClearPanel</span>
  </a>
  <div class="nav-links">
    <a href="#features">Features</a>
    <a href="#how">How it works</a>
    <a href="#pricing">Pricing</a>
    <a href="#faq">FAQ</a>
  </div>
  <a href="${cta}" target="_blank" class="nav-cta">Get Access</a>
</nav>

<div class="hero">
  <div class="hero-bg"></div>
  <div class="hero-content">
    <div class="hero-badge">CCMP — Call Centre Management Platform · <a href="https://t.me/clearpanelotpbot" target="_blank" style="color:inherit;text-decoration:underline;opacity:.8;">@clearpanelotpbot</a></div>
    <h1>Run your sales floor.<br>Without the chaos.</h1>
    <p class="hero-sub">ClearPanel gives your calling team a live lead pipeline, real-time scripts, call tracking, and a leaderboard that actually motivates. Purpose-built for outbound sales teams.</p>
    <div class="hero-actions">
      <a href="${cta}" target="_blank" class="btn-primary">Get in touch</a>
      <a href="#features" class="btn-ghost">See what's included</a>
    </div>
    <div class="hero-stats">
      <div class="hero-stat"><div class="n">3CX</div><div class="l">Inbound ready</div></div>
      <div class="stat-divider"></div>
      <div class="hero-stat"><div class="n">Live</div><div class="l">Real-time board</div></div>
      <div class="stat-divider"></div>
      <div class="hero-stat"><div class="n">IVR</div><div class="l">Twilio routing</div></div>
      <div class="stat-divider"></div>
      <div class="hero-stat"><div class="n">XP</div><div class="l">Caller progression</div></div>
    </div>
  </div>
</div>

<section id="features">
  <div class="section-tag">Built for performance</div>
  <h2 class="section-title">Everything your team needs.<br>Nothing they don't.</h2>
  <p class="section-sub">No bloat. No generic CRM. ClearPanel is built from the ground up for outbound calling teams who need speed, visibility, and motivation built in.</p>
  <div class="features-grid">
    <div class="feat">
      <div class="feat-icon" style="background:rgba(124,92,255,.15);">📋</div>
      <h4>Live Lead Pipeline</h4>
      <p>Every lead tracked from first dial to completion. Callers see exactly what to work, admins see exactly what's happening — in real time, no refresh needed.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(79,140,255,.15);">📞</div>
      <h4>3CX Inbound Integration</h4>
      <p>Connect your 3CX PBX and route inbound calls directly to available agents. Call control, hold, transfer — managed from inside the panel.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(244,114,182,.15);">🔀</div>
      <h4>Twilio IVR Routing</h4>
      <p>Build intelligent IVR menus that route callers to the right agent or queue. Configure digits, hold music, and ring behaviour from the admin panel.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(34,197,94,.15);">📝</div>
      <h4>Script Library</h4>
      <p>Admins write scripts, callers follow them live. No switching tabs, no looking away from the lead. Script suggestions update based on call stage.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(251,191,36,.15);">🏆</div>
      <h4>XP and Caller Ranks</h4>
      <p>Every dial, callback booked, and successful call earns XP. Callers progress from New Dialer to Legend. Real rank-up moments keep the floor competitive.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(239,68,68,.15);">⚡</div>
      <h4>Live Leaderboard</h4>
      <p>Floor-wide leaderboard with weekly and all-time views. Team goals, top performer spotlight, and XP history — motivation baked into the product.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(124,92,255,.15);">💬</div>
      <h4>Team Chat</h4>
      <p>Built-in floor chat with admin announcements, disappearing messages, and push notifications. No Slack tab required.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(79,140,255,.15);">📱</div>
      <h4>Your Brand, Your App</h4>
      <p>Upload your logo, set your panel name — the whole interface becomes your product. Tenants get a fully branded call centre, not a white-label with seams showing.</p>
    </div>
    <div class="feat">
      <div class="feat-icon" style="background:rgba(34,197,94,.15);">🔔</div>
      <h4>Telegram Announcements</h4>
      <p>Push updates to every verified caller individually via Telegram. Admin posts once, every team member gets a personal DM — even if they're off the panel.</p>
    </div>
  </div>
</section>

<section id="how">
  <div class="section-tag">Simple by design</div>
  <h2 class="section-title">Up and running<br>same day.</h2>
  <p class="section-sub">No engineers needed. No week-long onboarding. You get access, you set up your team, and your callers are working leads within the hour.</p>
  <div class="how-grid">
    <div class="how-step">
      <div class="how-num">1</div>
      <h4>Get access</h4>
      <p>Message us and we'll set up your tenant. You get an admin login, your subdomain, and your team PIN list — nothing to install.</p>
    </div>
    <div class="how-step">
      <div class="how-num">2</div>
      <h4>Upload your leads</h4>
      <p>Paste a list, pick the bank or category, and your pipeline is live. Callers see leads the moment they clock in.</p>
    </div>
    <div class="how-step">
      <div class="how-num">3</div>
      <h4>Add your scripts</h4>
      <p>Write your call scripts in the admin panel. They appear live on the caller's screen, matched to the current lead.</p>
    </div>
    <div class="how-step">
      <div class="how-num">4</div>
      <h4>Watch the floor work</h4>
      <p>Real-time dashboard shows who's on a call, who's idle, what's in the finishing queue, and how the team is tracking against the daily goal.</p>
    </div>
  </div>
</section>

<!-- Telegram channel banner -->
<div class="tg-banner">
  <div class="tg-icon">📣</div>
  <div class="tg-banner-left">
    <h3>Stay in the loop.</h3>
    <p>Product updates, new features, and platform announcements go to our Telegram channel. Every ClearPanel operator gets individual DMs for critical updates — the channel is for everything else.</p>
  </div>
  <div style="display:flex;flex-direction:column;gap:10px;align-items:flex-start;"><a href="https://t.me/+M-aK0jz4wDI5Nzdh" target="_blank" class="btn-primary" style="white-space:nowrap;">Join the updates channel</a><a href="https://t.me/clearpanelotpbot" target="_blank" class="btn-ghost" style="white-space:nowrap;font-size:13px;">@clearpanelotpbot</a></div>
</div>

<section id="pricing">
  <div class="section-tag">Pricing</div>
  <h2 class="section-title">Straightforward.<br>No hidden fees.</h2>
  <p class="section-sub">Every tier includes the full platform. Higher tiers add more callers, more features, and priority support. Get in touch to discuss what fits.</p>
  <div class="tiers-grid">
    <div class="tier">
      <div class="tier-head">
        <div class="tier-name">Starter</div>
        <div class="tier-price">Talk to us<span></span></div>
        <div class="tier-desc">For small teams getting started with structured outbound calling.</div>
      </div>
      <div class="tier-body">
        <ul class="tier-features">
          <li>Up to 10 callers</li>
          <li>Live lead pipeline</li>
          <li>Script library</li>
          <li>XP and leaderboard</li>
          <li>Team chat</li>
          <li>Telegram verification</li>
          <li class="no">3CX inbound integration</li>
          <li class="no">Twilio IVR</li>
          <li class="no">Custom branding</li>
        </ul>
        <a href="${cta}" target="_blank" class="tier-cta ghost">Get in touch</a>
      </div>
    </div>
    <div class="tier featured">
      <div class="tier-badge">Most popular</div>
      <div class="tier-head">
        <div class="tier-name">Professional</div>
        <div class="tier-price">Talk to us<span></span></div>
        <div class="tier-desc">For established teams that need inbound routing and full custom branding.</div>
      </div>
      <div class="tier-body">
        <ul class="tier-features">
          <li>Up to 40 callers</li>
          <li>Live lead pipeline</li>
          <li>Script library</li>
          <li>XP, ranks and leaderboard</li>
          <li>Team chat with announcements</li>
          <li>Telegram DM broadcasts</li>
          <li>3CX inbound integration</li>
          <li>Twilio IVR routing</li>
          <li>Full custom branding</li>
          <li>Finishing queue</li>
          <li class="no">Dedicated support</li>
        </ul>
        <a href="${cta}" target="_blank" class="tier-cta primary">Get in touch</a>
      </div>
    </div>
    <div class="tier">
      <div class="tier-head">
        <div class="tier-name">Enterprise</div>
        <div class="tier-price">Talk to us<span></span></div>
        <div class="tier-desc">For large floors, multiple teams, or custom integration requirements.</div>
      </div>
      <div class="tier-body">
        <ul class="tier-features">
          <li>Unlimited callers</li>
          <li>Everything in Professional</li>
          <li>Multiple tenant panels</li>
          <li>Priority onboarding</li>
          <li>Dedicated support channel</li>
          <li>Custom feature requests</li>
          <li>SLA guarantees</li>
          <li>Admin analytics dashboard</li>
        </ul>
        <a href="${cta}" target="_blank" class="tier-cta ghost">Get in touch</a>
      </div>
    </div>
  </div>
</section>

<section>
  <div class="section-tag">What teams say</div>
  <h2 class="section-title">Built around<br>how floors actually work.</h2>
  <div class="proof-grid">
    <div class="proof-card">
      <div class="proof-stars">★★★★★</div>
      <p class="proof-text">"The leaderboard alone changed the energy on the floor. Callers are competing for top spot every week — that drive used to take constant management."</p>
      <div class="proof-author">
        <div class="proof-avatar">S</div>
        <div>
          <div class="proof-name">Sales Manager</div>
          <div class="proof-role">Financial services team, UK</div>
        </div>
      </div>
    </div>
    <div class="proof-card">
      <div class="proof-stars">★★★★★</div>
      <p class="proof-text">"Having scripts live on the same screen as the lead changed everything. No more switching tabs mid-call, no more callers going off-script."</p>
      <div class="proof-author">
        <div class="proof-avatar">T</div>
        <div>
          <div class="proof-name">Team Lead</div>
          <div class="proof-role">Outbound calling team, EU</div>
        </div>
      </div>
    </div>
    <div class="proof-card">
      <div class="proof-stars">★★★★★</div>
      <p class="proof-text">"The Telegram integration is the thing that surprised me most. I push an update from the panel and every single caller gets a personal DM within seconds."</p>
      <div class="proof-author">
        <div class="proof-avatar">M</div>
        <div>
          <div class="proof-name">Operations Director</div>
          <div class="proof-role">Multi-team setup</div>
        </div>
      </div>
    </div>
  </div>
</section>

<section id="faq">
  <div class="section-tag">Questions</div>
  <h2 class="section-title">Straight answers.</h2>
  <div class="faq">
    <div class="faq-item">
      <div class="faq-q">How do my callers access the panel?</div>
      <div class="faq-a">They go to your panel URL and enter their PIN. No account creation, no email needed. You create PINs from the admin panel and hand them out. Callers link their Telegram account on first login — takes 30 seconds.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">Does it work on mobile?</div>
      <div class="faq-a">Yes — ClearPanel is a fully responsive web app. Callers can add it to their home screen (Android or iOS) and it runs like a native app, with push notifications for announcements.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">How does 3CX integration work?</div>
      <div class="faq-a">You connect your 3CX instance from the Telephony settings in the admin panel. Once connected, inbound calls route to available agents directly through the panel. No separate app, no softphone required.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">Can I have multiple teams on separate panels?</div>
      <div class="faq-a">Yes — Enterprise tier supports multiple tenants, each with their own branding, lead pipeline, callers, and settings. Completely isolated from each other.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">How do I get support?</div>
      <div class="faq-a">All plans include Telegram support. Professional and Enterprise get a dedicated support channel with priority response. Enterprise gets an SLA with defined response times.</div>
    </div>
    <div class="faq-item">
      <div class="faq-q">Is my data stored securely?</div>
      <div class="faq-a">Yes — your tenant's data is completely isolated from other tenants at the database level. All traffic is encrypted in transit. We do not share or sell any data.</div>
    </div>
  </div>
</section>

<div class="cta-section">
  <h2>Ready to run a tighter floor?</h2>
  <p>Message us on Telegram and we'll have your team set up and dialling the same day.</p>
  <a href="${cta}" target="_blank" class="btn-primary" style="font-size:16px;padding:18px 44px;">Get in touch</a>
</div>

<footer>
  <div class="footer-brand">
    <img src="/clearpanel-icon.png" alt="">
    <span>ClearPanel · CCMP · Call Centre Management Platform</span>
  </div>
  <div class="footer-links">
    <a href="#features">Features</a>
    <a href="#pricing">Pricing</a>
    <a href="https://t.me/+M-aK0jz4wDI5Nzdh" target="_blank">Updates Channel</a><a href="https://t.me/clearpanelotpbot" target="_blank">Get Access</a>
  </div>
</footer>

<script>
// FAQ accordion
document.querySelectorAll('.faq-q').forEach(q => {
  q.addEventListener('click', () => {
    const item = q.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});
// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
</script>
</body>
</html>`;
}
