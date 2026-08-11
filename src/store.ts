// Public marketing/pricing page - shown to anyone considering buying access. No
// login required. Each tier links to wherever the actual checkout happens; since
// there's no payment processor wired up yet, this points at an external store URL
// configured by the operator (falls back to a mailto if nothing's set).
export const STORE_PAGE = (checkoutUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>Get Access</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  :root{--bg:#08080a;--text:#f2f2f4;--text-dim:#9c9ca6;--text-faint:#68686f;--gold:#4f8cff;--gold-bright:#7aabff;--success:#22c55e;--border:rgba(255,255,255,.08);--border-2:rgba(255,255,255,.14);}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Inter',-apple-system,sans-serif;background:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(124,92,255,.18),transparent 55%),radial-gradient(ellipse 70% 50% at 100% 10%,rgba(79,140,255,.14),transparent 55%),var(--bg);color:var(--text);min-height:100vh;-webkit-font-smoothing:antialiased;}
  h1,h2{font-family:'Space Grotesk',sans-serif;}
  .wrap{max-width:1000px;margin:0 auto;padding:60px 20px 80px;text-align:center;}
  .hero h1{font-size:36px;font-weight:800;letter-spacing:-.02em;margin:0 0 12px;}
  .hero p{font-size:15px;color:var(--text-dim);max-width:520px;margin:0 auto 48px;line-height:1.6;}
  .tiers{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px;text-align:left;}
  .tier{background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);border-radius:20px;padding:28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 12px 28px rgba(0,0,0,.3);display:flex;flex-direction:column;}
  .tier.featured{border-color:var(--gold);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 0 0 1px var(--gold),0 12px 32px rgba(79,140,255,.25);}
  .tier .badge{display:inline-block;background:var(--gold);color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:4px 10px;border-radius:100px;margin-bottom:14px;align-self:flex-start;}
  .tier h2{font-size:18px;margin:0 0 4px;}
  .tier .price{font-size:34px;font-weight:800;font-family:'Space Grotesk',sans-serif;margin:10px 0 20px;}
  .tier .price span{font-size:13px;color:var(--text-dim);font-weight:500;font-family:'Inter',sans-serif;}
  .tier ul{list-style:none;padding:0;margin:0 0 24px;flex:1;}
  .tier li{font-size:13px;color:var(--text-dim);padding:8px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;}
  .tier li:last-child{border-bottom:none;}
  .tier li::before{content:'✓';color:var(--success);font-weight:700;flex-shrink:0;}
  .tier a{display:block;text-align:center;padding:13px;border-radius:100px;background:rgba(255,255,255,.06);color:var(--text);text-decoration:none;font-weight:700;font-size:13.5px;border:1px solid var(--border-2);transition:all .15s ease;}
  .tier.featured a{background:var(--gold);color:#fff;border:none;}
  .tier a:hover{transform:translateY(-1px);}
  .redeem-note{margin-top:40px;font-size:13px;color:var(--text-faint);}
  .redeem-note a{color:var(--gold-bright);}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <h1>Get Your Own Call Center Panel</h1>
    <p>Full lead management, live call routing, team leaderboard, and your own admin panel - completely separate from anyone else's data.</p>
  </div>
  <div class="tiers">
    <div class="tier">
      <h2>3 Day Access</h2>
      <div class="price">£99</div>
      <ul>
        <li>Full admin + caller panels</li>
        <li>Unlimited callers</li>
        <li>Lead import & management</li>
        <li>Team chat & leaderboard</li>
      </ul>
      <a href="${checkoutUrl}?plan=3day" target="_blank" rel="noopener">Get Started</a>
    </div>
    <div class="tier featured">
      <span class="badge">Most Popular</span>
      <h2>7 Day Access</h2>
      <div class="price">£180</div>
      <ul>
        <li>Everything in 3 Day</li>
        <li>Inbound call routing (Twilio)</li>
        <li>Priority support</li>
        <li>Full audit trail</li>
      </ul>
      <a href="${checkoutUrl}?plan=7day" target="_blank" rel="noopener">Get Started</a>
    </div>
    <div class="tier">
      <h2>1 Month Access</h2>
      <div class="price">£750</div>
      <ul>
        <li>Everything in 7 Day</li>
        <li>Custom branding & logo</li>
        <li>Extended call history</li>
        <li>Best value per day</li>
      </ul>
      <a href="${checkoutUrl}?plan=monthly" target="_blank" rel="noopener">Get Started</a>
    </div>
  </div>
  <div class="redeem-note">Already paid and got a key? <a href="/redeem">Redeem it here</a></div>
</div>
</body>
</html>`;
