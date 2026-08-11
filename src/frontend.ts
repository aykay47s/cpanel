import { ADMIN_JS } from './adminJs';
import { STAFF_JS } from './staffJs';

export const ICONS_SVG: Record<string, string> = {
  dashboard: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  list: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
  upload: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  warn: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
  flag: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 21V4M5 5h13l-3 4 3 4H5"/></svg>',
  users: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.7.3 4.7 2.3 5.5 4.8"/></svg>',
  chat: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5z"/></svg>',
  megaphone: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 10v4h3l6 4V6L6 10H3z"/><path d="M15 9a3 3 0 010 6M18 6a7 7 0 010 12"/></svg>',
  target: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  doc: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
  exit: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 3H5a1 1 0 00-1 1v16a1 1 0 001 1h4M16 17l5-5-5-5M21 12H9"/></svg>',
  bell: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
};

export const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>Frap Ties</title>
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Frap Ties">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" href="/icon.png">
<meta name="theme-color" content="#08080b">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#08080a; --bg-2:#0f0f13; --s1:#18181f; --s2:#212129; --s3:#2b2b35;
  --border:rgba(255,255,255,0.08); --border-2:rgba(255,255,255,0.14);
  --gold:#4f8cff; --gold-bright:#7aabff; --gold-glow:rgba(79,140,255,.2);
  --teal:#2dd4bf; --teal-glow:rgba(45,212,191,.2);
  --crimson:#ef4444; --crimson-glow:rgba(239,68,68,.2);
  --violet:#a78bfa;
  --text:#e8e8ea; --text-dim:#8b8b93; --text-faint:#55555c;
  --success:#22c55e; --danger:#ef4444; --warn:#eab308;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
html,body{height:100%;overscroll-behavior-y:contain;}
body{
  font-family:'Inter',-apple-system,sans-serif;color:var(--text);min-height:100vh;min-height:100dvh;overflow-x:hidden;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  background:
    radial-gradient(ellipse 90% 60% at 15% -10%, rgba(124,92,255,.35), transparent 55%),
    radial-gradient(ellipse 80% 60% at 100% 0%, rgba(79,140,255,.3), transparent 55%),
    radial-gradient(ellipse 70% 50% at 50% 110%, rgba(45,212,191,.18), transparent 60%),
    #0e0a1a;
  font-size:14px;line-height:1.5;letter-spacing:-.006em;
}
.app-shell{
  margin:18px; border-radius:26px; overflow:hidden;
  background:
    radial-gradient(ellipse 70% 50% at 10% 0%, rgba(124,92,255,.16), transparent 55%),
    radial-gradient(ellipse 60% 45% at 100% 15%, rgba(79,140,255,.13), transparent 55%),
    radial-gradient(ellipse 55% 50% at 30% 100%, rgba(45,212,191,.09), transparent 60%),
    var(--bg);
  box-shadow:0 2px 8px rgba(0,0,0,.3), 0 24px 64px rgba(0,0,0,.5);
  min-height:calc(100vh - 36px); min-height:calc(100dvh - 36px);
}
@media (max-width:640px){ .app-shell{margin:0;border-radius:0;min-height:100vh;min-height:100dvh;} }
h1,h2,h3,.disp{font-family:'Space Grotesk',-apple-system,sans-serif;font-weight:700;letter-spacing:-.02em;}
.mono{font-family:'JetBrains Mono',monospace;letter-spacing:0;}
.hidden{display:none !important;}
a{color:inherit;text-decoration:none;}
::-webkit-scrollbar{width:6px;height:6px;}
::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:3px;}

@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
.fade-up{animation:fadeUp .3s ease both;}
.stagger > *{animation:fadeUp .25s ease both;}
.stagger > *:nth-child(1){animation-delay:.01s;} .stagger > *:nth-child(2){animation-delay:.03s;}
.stagger > *:nth-child(3){animation-delay:.05s;} .stagger > *:nth-child(4){animation-delay:.07s;}
.stagger > *:nth-child(5){animation-delay:.09s;} .stagger > *:nth-child(n+6){animation-delay:.1s;}

button{font-family:'Inter',sans-serif;cursor:pointer;border:none;outline:none;transition:all .12s ease;}
.panel{
  background:rgba(255,255,255,.045);
  backdrop-filter:blur(24px) saturate(1.4);
  -webkit-backdrop-filter:blur(24px) saturate(1.4);
  border:1px solid rgba(255,255,255,.09); border-radius:20px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 2px 4px rgba(0,0,0,.3), 0 12px 28px rgba(0,0,0,.34), 0 24px 56px rgba(0,0,0,.22);
  transition:border-color .15s ease, box-shadow .15s ease, transform .15s ease;
}
.panel-inset{background:var(--bg-2);border:1px solid var(--border);border-radius:14px;}
.btn{padding:12px 22px;border-radius:100px;font-weight:600;font-size:13.5px;background:var(--s3);border:1px solid var(--border-2);color:var(--text);letter-spacing:-.005em;box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 1px 2px rgba(0,0,0,.3), 0 4px 10px rgba(0,0,0,.24);}
.btn:hover{background:#323240;border-color:rgba(255,255,255,.26);transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.08), 0 2px 4px rgba(0,0,0,.32), 0 8px 18px rgba(0,0,0,.3);}
.btn:active{transform:translateY(1px) scale(.98);box-shadow:inset 0 1px 3px rgba(0,0,0,.3);}
.btn-gold{background:linear-gradient(180deg,var(--gold-bright),var(--gold));color:#fff;border:none;font-weight:700;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 2px 4px rgba(0,0,0,.25), 0 8px 20px rgba(79,140,255,.35);}
.btn-gold:hover{box-shadow:inset 0 1px 0 rgba(255,255,255,.3), 0 3px 6px rgba(0,0,0,.28), 0 10px 26px rgba(79,140,255,.42);}
.btn-gold:active{box-shadow:inset 0 2px 4px rgba(0,0,0,.25);}
.btn-teal{background:linear-gradient(180deg,#3ee0cf,var(--teal));color:#04211c;border:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(45,212,191,.25);}
.btn-danger{background:transparent;border:1px solid rgba(239,68,68,.35);color:var(--danger);}
.btn-danger:hover{background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.5);}
.btn-ghost{background:transparent;border:1px solid var(--border-2);color:var(--text-dim);box-shadow:none;}
.btn-ghost:hover{color:var(--text);border-color:rgba(255,255,255,.26);}
.btn-block{width:100%;}
.btn-sm{padding:8px 14px;font-size:12px;border-radius:8px;}
input,select,textarea{width:100%;padding:12px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:var(--text);font-size:16px;outline:none;font-family:inherit;-webkit-appearance:none;appearance:none;transition:border-color .12s ease, box-shadow .12s ease;}
input:focus,select:focus,textarea:focus{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-glow);}
label{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.7px;display:block;margin-bottom:7px;font-weight:600;}
.field{margin-bottom:15px;}
.badge{padding:5px 11px;font-size:11px;font-weight:700;letter-spacing:-.005em;display:inline-flex;align-items:center;border-radius:100px;line-height:1.4;}
.badge-ic{display:none;}
.badge.not_called{background:#3a3a44;color:#d4d4dc;}
.badge.calling,.badge.active_call{background:#4f8cff;color:#fff;}
.badge.call_ended{background:#a78bfa;color:#1a1025;}
.badge.successful_call,.badge.completed{background:#22c55e;color:#062611;}
.badge.ready_for_finishing,.badge.assigned_to_finisher{background:#2dd4bf;color:#042e29;}
.badge.failed{background:#ef4444;color:#2b0605;}
.badge.cancelled,.badge.chopped_previously{background:#71717a;color:#fff;}
.badge.requires_review{background:#f59e0b;color:#2e1a02;}
.badge.admin{background:#ef4444;color:#fff;}
.badge.caller{background:#4f8cff;color:#fff;}
.badge.finisher{background:#2dd4bf;color:#042e29;}
.badge.important{background:#4f8cff;color:#fff;}
.badge.voicemail,.badge.no_answer,.badge.hung_up,.badge.busy{background:#3a3a44;color:#d4d4dc;}
.badge.callback_requested{background:#a78bfa;color:#1a1025;}
.badge.ringing,.badge.in-progress{background:#4f8cff;color:#fff;}
.badge.missed,.badge.no-answer{background:#ef4444;color:#fff;}

/* icons (inline SVG line-icon set) */
.ic{width:17px;height:17px;display:inline-block;vertical-align:-3px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round;}

/* ---------- Login ---------- */
#loginScreen{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden;}
.login-card{width:100%;max-width:380px;padding:48px 36px;text-align:center;position:relative;box-shadow:0 2px 4px rgba(0,0,0,.3), 0 16px 48px rgba(0,0,0,.4);}
.crest{width:52px;height:52px;margin:0 auto 22px;border-radius:16px;background:var(--gold);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(79,140,255,.3);overflow:hidden;}
.crest svg{width:22px;height:22px;stroke:#fff;}
.login-title{font-size:27px;color:var(--text);margin-bottom:6px;font-weight:800;letter-spacing:-.025em;font-family:'Space Grotesk',sans-serif;}
.login-sub{font-size:14px;margin-bottom:32px;color:var(--text-dim);}
.pin-dots{display:flex;justify-content:center;gap:16px;margin-bottom:32px;}
.pin-dot{width:12px;height:12px;border-radius:50%;border:1.5px solid var(--border-2);transition:all .15s;}
.pin-dot.filled{background:var(--gold);border-color:var(--gold);transform:scale(1.15);}
.pin-dot.error{border-color:var(--danger);animation:shake .4s;}
@keyframes shake{0%,100%{transform:translateX(0);}25%{transform:translateX(-6px);}75%{transform:translateX(6px);}}
.keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
.key{aspect-ratio:1;border-radius:18px;font-size:21px;font-weight:600;background:var(--s2);border:1px solid var(--border);color:var(--text);font-family:'JetBrains Mono',monospace;transition:all .1s ease;}
.key:hover{background:var(--s3);border-color:var(--border-2);}
.key:active{transform:scale(.93);background:var(--gold);color:#fff;}
.key.wide{font-size:12px;color:var(--text-dim);}
.login-error{color:var(--danger);font-size:12.5px;margin-top:12px;min-height:16px;}

/* ---------- Shell layout ---------- */
.topbar{position:sticky;top:0;z-index:60;display:flex;justify-content:space-between;align-items:center;padding:calc(16px + env(safe-area-inset-top)) 22px 16px;background:rgba(255,255,255,.03);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border-bottom:1px solid rgba(255,255,255,.08);}
.brand{font-family:'Space Grotesk',sans-serif;font-weight:800;font-size:15.5px;display:flex;align-items:center;gap:10px;letter-spacing:-.02em;}
.brand-mark{width:22px;height:22px;border-radius:7px;background:var(--gold);position:relative;flex-shrink:0;overflow:hidden;}
.topbar-actions{display:flex;gap:8px;align-items:center;}
.icon-btn{width:38px;height:38px;border-radius:50%;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;position:relative;color:var(--text-dim);transition:all .12s ease;}
.icon-btn:hover{color:var(--text);border-color:var(--border-2);background:var(--s3);}
.icon-btn .dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--crimson);}

/* Admin: sidebar */
.admin-shell{display:flex;min-height:100vh;min-height:100dvh;}
.admin-sidebar{width:236px;flex-shrink:0;background:rgba(255,255,255,.02);backdrop-filter:blur(24px) saturate(1.3);-webkit-backdrop-filter:blur(24px) saturate(1.3);border-right:1px solid rgba(255,255,255,.08);padding:20px 14px;position:sticky;top:0;height:100vh;height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.side-link{display:flex;align-items:center;gap:11px;padding:9px 12px;border-radius:8px;font-size:13px;font-weight:500;color:var(--text-dim);cursor:pointer;margin-bottom:1px;transition:background .1s ease, color .1s ease;}
.side-link:hover{background:var(--s2);color:var(--text);}
.side-link.active{background:#fff;color:#0a0a0c;font-weight:600;}
.side-link.active .ic{color:#0a0a0c;}
.side-link .ic{flex-shrink:0;color:var(--text-faint);}
.side-sec{font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--text-faint);font-weight:600;margin:18px 10px 8px;}
.admin-main{flex:1;min-width:0;}
.admin-content{max-width:1180px;margin:0 auto;padding:32px 32px 72px;}

/* Caller/Finisher: bottom nav */
.staff-body{max-width:600px;margin:0 auto;padding:20px 16px 108px;}
.bottom-nav{position:fixed;bottom:14px;left:14px;right:14px;z-index:70;display:flex;gap:2px;background:rgba(255,255,255,.055);backdrop-filter:blur(28px) saturate(1.5);-webkit-backdrop-filter:blur(28px) saturate(1.5);border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:6px;box-shadow:0 2px 4px rgba(0,0,0,.3), 0 16px 36px rgba(0,0,0,.4);padding-bottom:calc(6px + env(safe-area-inset-bottom));}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:9px 4px;border-radius:16px;background:transparent;color:var(--text-faint);font-size:9.5px;font-weight:600;position:relative;transition:background .15s ease, color .15s ease;}
.nav-btn.active{color:#fff;background:var(--gold);box-shadow:0 4px 12px rgba(79,140,255,.35);}
.nav-btn:active{transform:scale(.94);}
.nav-badge{position:absolute;top:2px;right:24%;width:7px;height:7px;border-radius:50%;background:var(--crimson);}

.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;}
.stat-box{padding:22px 24px;border-radius:20px;}
.stat-box .num{font-size:29px;font-weight:800;font-family:'Space Grotesk',sans-serif;letter-spacing:-.03em;line-height:1.1;}
.stat-box .lbl{font-size:10.5px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;margin-top:5px;font-weight:600;}
.stat-box.accent{border-color:var(--gold-glow);}
.section-title{font-size:12px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.8px;margin:28px 0 14px;font-weight:600;}
.p{padding:24px;margin-bottom:18px;}

table{width:100%;border-collapse:collapse;font-size:13px;}
th{text-align:left;padding:11px 14px;color:var(--text-faint);font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);}
td{padding:13px 14px;border-bottom:1px solid var(--border);}
tr:hover td{background:rgba(255,255,255,.012);}
tr.clickable{cursor:pointer;transition:background .12s ease;}
tr.clickable:hover{background:rgba(255,255,255,.03);}
tr.clickable:active{background:rgba(255,255,255,.05);}
.offer-card,.panel-inset.clickable{transition:transform .12s ease, box-shadow .12s ease;}
.offer-card:active{transform:scale(.985);}
.pin-display{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:var(--gold-bright);letter-spacing:1.5px;}
.blur-phone{cursor:pointer;filter:blur(5px);transition:filter .2s;user-select:none;}
.blur-phone.revealed{filter:blur(0);}
.blur-phone::after{content:' (tap to reveal)';font-size:9px;filter:none;opacity:.5;text-transform:uppercase;letter-spacing:.4px;}
.row-flex{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;}
.row-flex .field{flex:1;min-width:130px;margin-bottom:0;}
.new-pin-banner{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-radius:12px;background:rgba(201,161,94,.07);border:1px solid var(--gold-glow);margin-top:14px;}

/* announcement banner */
.announcement{padding:15px 17px;border-radius:12px;margin-bottom:9px;display:flex;gap:11px;align-items:flex-start;}
.announcement.important{background:rgba(79,140,255,.08);border:1px solid var(--gold-glow);position:relative;overflow:hidden;}
.announcement.important::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold);}
.announcement .txt{font-size:13px;line-height:1.55;color:var(--text);}
.announcement .meta{font-size:10.5px;color:var(--text-faint);margin-top:5px;}

/* radar / waiting */
.radar-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:56px 20px;text-align:center;}
.radar{position:relative;width:130px;height:130px;margin-bottom:22px;}
.radar-ring{position:absolute;inset:0;border-radius:50%;border:1px solid var(--border-2);}
.radar-ring:nth-child(2){inset:17px;} .radar-ring:nth-child(3){inset:34px;}
.radar-sweep{position:absolute;inset:0;border-radius:50%;overflow:hidden;animation:spin 3.2s linear infinite;}
.radar-sweep::before{content:'';position:absolute;inset:0;background:conic-gradient(from 0deg, transparent 0deg, transparent 320deg, var(--gold) 355deg, transparent 360deg);border-radius:50%;opacity:.7;}
@keyframes spin{to{transform:rotate(360deg);}}
.radar-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:9px;height:9px;border-radius:50%;background:var(--gold);}
.waiting-title{font-size:18px;margin-bottom:5px;}
.waiting-sub{color:var(--text-dim);font-size:12.5px;}

/* offer / call cards */
.offer-card{position:relative;padding:24px;border-radius:20px;margin-bottom:14px;overflow:hidden;background:rgba(255,255,255,.045);backdrop-filter:blur(24px) saturate(1.4);-webkit-backdrop-filter:blur(24px) saturate(1.4);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 2px 4px rgba(0,0,0,.3), 0 12px 28px rgba(0,0,0,.3);}
.pulse-dot{position:absolute;top:20px;right:20px;width:9px;height:9px;border-radius:50%;background:var(--success);box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:liveDotPulse 1.8s ease-out infinite;}
.offer-label{font-size:10.5px;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px;}
.offer-name{font-size:20px;font-weight:700;font-family:'Space Grotesk',sans-serif;letter-spacing:-.01em;margin-bottom:4px;}
.offer-meta{color:var(--text-dim);font-size:12.5px;margin-bottom:18px;}
.offer-actions{display:flex;gap:9px;}
.live-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-left:6px;position:relative;top:-2px;box-shadow:0 0 0 0 rgba(34,197,94,.6);animation:liveDotPulse 1.8s ease-out infinite;}
@keyframes liveDotPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55);}70%{box-shadow:0 0 0 8px rgba(34,197,94,0);}100%{box-shadow:0 0 0 0 rgba(34,197,94,0);}}
.pulse-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;animation:pulseRing 1.6s cubic-bezier(0,0,.2,1) infinite;}
@keyframes pulseRing{0%{transform:scale(1);opacity:.7;}100%{transform:scale(3);opacity:0;}}
.offer-actions .btn{flex:1;padding:13px;font-size:13.5px;}

.call-card{padding:22px;}
.call-status-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.call-timer{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--text-dim);}
.info-row{display:flex;justify-content:space-between;align-items:baseline;padding:10px 0;border-bottom:1px solid var(--border);}
.info-row .k{font-size:10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.5px;}
.info-row .v{font-size:14px;font-weight:600;text-align:right;}
.call-action-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0;}
.dial-btn,.oncall-btn,.endcall-btn{display:flex;align-items:center;justify-content:center;gap:7px;padding:15px;border-radius:12px;font-size:13.5px;font-weight:700;}
.dial-btn{background:var(--s2);border:1px solid var(--border-2);color:var(--text);}
.oncall-btn{background:var(--teal);color:#04211c;}
.endcall-btn{background:var(--crimson);color:#fff;grid-column:1/-1;}
.outcome-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;}
.outcome-grid button{padding:14px 6px;font-size:12px;font-weight:700;border-radius:11px;}
.win-btn{background:var(--success);color:#04170a;}
.review-btn{background:rgba(201,161,94,.14);color:var(--gold-bright);border:1px solid var(--gold-glow);}
.fail-btn{background:rgba(192,85,74,.12);color:var(--danger);border:1px solid rgba(192,85,74,.3);}
.scripts-toggle{display:flex;justify-content:space-between;align-items:center;padding:12px 15px;border-radius:10px;background:var(--s2);margin-bottom:12px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--text-dim);}
.scripts-panel{max-height:0;overflow:hidden;transition:max-height .3s ease;}
.scripts-panel.open{max-height:400px;overflow-y:auto;margin-bottom:12px;-webkit-overflow-scrolling:touch;}
.script-item{padding:12px 15px;border-radius:10px;background:var(--s2);margin-bottom:7px;}
.script-item .title{font-weight:700;font-size:12.5px;margin-bottom:4px;color:var(--gold-bright);}
.script-item .content{font-size:12.5px;color:var(--text-dim);line-height:1.5;white-space:pre-wrap;}

/* leaderboard */
.lb-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid var(--border);}
.rank{width:29px;height:29px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12.5px;background:var(--s2);flex-shrink:0;}
.rank.r1{background:#eab308;color:#1c1408;}
.rank.r2{background:#a8a8b0;color:#0a0a0a;}
.rank.r3{background:#b8763f;color:#fff;}
.lb-av{font-size:17px;}
.lb-name{flex:1;font-weight:700;font-size:13px;}
.lb-stats{display:flex;gap:15px;font-size:10.5px;color:var(--text-dim);}
.lb-stats b{color:var(--text);font-size:12.5px;}

/* chat */
.chat-shell{display:flex;flex-direction:column;height:calc(100dvh - 190px);}
.chat-messages{flex:1;overflow-y:auto;padding:6px 2px;display:flex;flex-direction:column;gap:12px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;}
.chat-msg{display:flex;gap:10px;max-width:85%;}
.chat-msg.own{align-self:flex-end;flex-direction:row-reverse;}
.chat-av{width:32px;height:32px;border-radius:9px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;border:1px solid var(--border);}
.chat-bubble{background:var(--s2);border:1px solid var(--border);border-radius:13px;padding:10px 13px;}
.chat-msg.own .chat-bubble{background:rgba(79,140,255,.1);border-color:var(--gold-glow);}
.chat-sender{font-size:11px;font-weight:700;color:var(--gold-bright);margin-bottom:2px;}
.chat-text{font-size:13.5px;line-height:1.5;}
.chat-time{font-size:9.5px;color:var(--text-faint);margin-top:4px;}
.chat-input-row{display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);}
.chat-input-row input{flex:1;}
.presence-strip{display:flex;gap:8px;overflow-x:auto;padding:4px 2px 12px;}
.presence-chip{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:20px;background:var(--s2);border:1px solid var(--border);font-size:11px;white-space:nowrap;flex-shrink:0;}
.presence-chip .dot{width:6px;height:6px;border-radius:50%;background:var(--text-faint);}
.presence-chip.online .dot{background:var(--success);}

/* import preview */
.parse-row{display:grid;grid-template-columns:1.2fr 1fr 1.2fr auto;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);font-size:12.5px;align-items:center;}
.parse-row .miss{color:var(--text-faint);font-style:italic;}
.dup-warn{font-size:10px;color:var(--gold-bright);background:rgba(201,161,94,.12);padding:3px 8px;border-radius:6px;white-space:nowrap;}

/* timeline */
.timeline{position:relative;padding-left:22px;}
.timeline::before{content:'';position:absolute;left:5px;top:4px;bottom:4px;width:1px;background:var(--border-2);}
.timeline-item{position:relative;padding-bottom:18px;}
.timeline-item::before{content:'';position:absolute;left:-22px;top:3px;width:8px;height:8px;border-radius:50%;background:var(--gold);}
.timeline-item .ev{font-size:13px;font-weight:600;}
.timeline-item .meta{font-size:11px;color:var(--text-dim);margin-top:2px;}

/* avatar grid */
.avatar-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:12px 0 20px;}
.avatar-opt{aspect-ratio:1;border-radius:10px;background:var(--s2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:19px;}
.avatar-opt.sel{border-color:var(--gold);background:rgba(201,161,94,.1);}

.empty-state{padding:60px 20px;text-align:center;color:var(--text-dim);}
.empty-state .ic{width:32px;height:32px;opacity:.4;margin-bottom:14px;}
.loading-shimmer{height:60px;border-radius:12px;background:linear-gradient(90deg, var(--s1) 25%, var(--s2) 50%, var(--s1) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;margin-bottom:10px;}
.notif-panel{top:64px;right:16px;width:340px;max-height:70vh;}
@media (max-width:640px){
  .notif-panel{top:auto !important;right:0 !important;left:0;bottom:0;width:100%;max-height:75vh;border-radius:20px 20px 0 0;padding-bottom:env(safe-area-inset-bottom);}
}

@media (max-width:860px){
  .admin-shell{flex-direction:column;}
  .admin-sidebar{width:100%;height:auto;position:sticky;top:0;display:flex;overflow-x:auto;padding:10px;gap:4px;border-right:none;border-bottom:1px solid var(--border);}
  .side-link{white-space:nowrap;margin-bottom:0;}
  .side-sec{display:none;}
  .admin-content{padding:16px 12px 60px;}
}
</style>
</head>
<body>
<div class="app-shell">
<!-- ===== LOGIN ===== -->
<div id="loginScreen">
  <div class="login-card panel fade-up">
    <div class="crest"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.5"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div>
    <div class="login-title">Frap Ties</div>
    <div class="login-sub" style="font-size:13px;color:var(--text-faint);letter-spacing:1px;text-transform:uppercase;margin-bottom:22px;">Est. Nowhere · Untraceable Since Day One</div>
    <div class="login-sub">Enter your PIN</div>
    <div class="pin-dots" id="pinDots"><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div><div class="pin-dot"></div></div>
    <div class="keypad" id="keypad">
      <button class="key" data-k="1">1</button><button class="key" data-k="2">2</button><button class="key" data-k="3">3</button>
      <button class="key" data-k="4">4</button><button class="key" data-k="5">5</button><button class="key" data-k="6">6</button>
      <button class="key" data-k="7">7</button><button class="key" data-k="8">8</button><button class="key" data-k="9">9</button>
      <button class="key wide" data-k="clear">Clear</button><button class="key" data-k="0">0</button><button class="key wide" data-k="back">⌫</button>
    </div>
    <div class="login-error" id="loginError"></div>
  </div>
</div>

<!-- ===== ADMIN SHELL ===== -->
<div id="adminApp" class="hidden">
  <div class="admin-shell">
    <div class="admin-sidebar">
      <div class="side-link active" data-tab="dashboard" onclick="switchAdminTab('dashboard')">${ICONS_SVG.dashboard} Dashboard</div>
      <div class="side-sec">Leads</div>
      <div class="side-link" data-tab="leads" onclick="switchAdminTab('leads')">${ICONS_SVG.list} All Leads</div>
      <div class="side-link" data-tab="import" onclick="switchAdminTab('import')">${ICONS_SVG.upload} Import</div>
      <div class="side-link" data-tab="duplicates" onclick="switchAdminTab('duplicates')">${ICONS_SVG.warn} Duplicates</div>
      <div class="side-link" data-tab="finishing" onclick="switchAdminTab('finishing')">${ICONS_SVG.flag} Finishing Queue</div>
      <div class="side-sec">Team</div>
      <div class="side-link" data-tab="roster" onclick="switchAdminTab('roster')">${ICONS_SVG.users} Roster</div>
      <div class="side-link" data-tab="leaderboard" onclick="switchAdminTab('leaderboard')">${ICONS_SVG.target} Leaderboard</div>
      <div class="side-link" data-tab="chat" onclick="switchAdminTab('chat')">${ICONS_SVG.chat} Team Chat</div>
      <div class="side-sec">Broadcast</div>
      <div class="side-link" data-tab="announcements" onclick="switchAdminTab('announcements')">${ICONS_SVG.megaphone} Announcements</div>
      <div class="side-link" data-tab="goal" onclick="switchAdminTab('goal')">${ICONS_SVG.target} Team Goal</div>
      <div class="side-sec">Configuration</div>
      <div class="side-link" data-tab="scripts" onclick="switchAdminTab('scripts')">${ICONS_SVG.doc} Scripts</div>
      <div class="side-link" data-tab="template" onclick="switchAdminTab('template')">${ICONS_SVG.doc} Call Template</div>
      <div class="side-link" data-tab="categories" onclick="switchAdminTab('categories')">${ICONS_SVG.flag} Lead Categories</div>
      <div class="side-link" data-tab="branding" onclick="switchAdminTab('branding')">${ICONS_SVG.gear} Branding</div>
      <div class="side-link" data-tab="telephony" onclick="switchAdminTab('telephony')">${ICONS_SVG.bell} Call Routing</div>
      <div class="side-link" onclick="logout()" style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px;">${ICONS_SVG.exit} Exit</div>
    </div>
    <div class="admin-main">
      <div class="topbar">
        <div class="brand"><div class="brand-mark"></div>Frap Ties <span style="color:var(--text-faint);font-size:12px;font-family:Inter;font-weight:600;margin-left:4px;">Control Room</span></div>
        <div class="topbar-actions">
          <div class="icon-btn" onclick="toggleNotifPanel()" id="notifBtn">${ICONS_SVG.bell}</div>
        </div>
      </div>
      <div class="admin-content" id="adminContent"></div>
    </div>
  </div>
</div>

<!-- ===== STAFF SHELL (caller / finisher) ===== -->
<div id="staffApp" class="hidden">
  <div class="topbar">
    <div class="brand"><div class="brand-mark"></div>Frap Ties</div>
    <div class="topbar-actions">
      <div class="icon-btn" onclick="toggleNotifPanel()" id="notifBtnStaff">${ICONS_SVG.bell}</div>
      <button class="btn btn-sm btn-ghost" id="clockBtn" onclick="toggleClock()">Clock In</button>
    </div>
  </div>
  <div class="staff-body" id="staffBody"></div>
  <div class="bottom-nav" id="staffNav"></div>
</div>
</div>

<div id="notifBackdrop" class="hidden" onclick="closeNotifPanel()" style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:199;"></div>
<div id="notifPanel" class="hidden notif-panel" style="position:fixed;z-index:200;overflow-y:auto;-webkit-overflow-scrolling:touch;"></div>

<script>
const ICONS = {
  dashboard: '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  list: '<svg class="ic" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
  upload: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  warn: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
  flag: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 21V4M5 5h13l-3 4 3 4H5"/></svg>',
  users: '<svg class="ic" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 14.2c2.7.3 4.7 2.3 5.5 4.8"/></svg>',
  chat: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4V5z"/></svg>',
  megaphone: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 10v4h3l6 4V6L6 10H3z"/><path d="M15 9a3 3 0 010 6M18 6a7 7 0 010 12"/></svg>',
  target: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/></svg>',
  doc: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7V3z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
  exit: '<svg class="ic" viewBox="0 0 24 24"><path d="M9 3H5a1 1 0 00-1 1v16a1 1 0 001 1h4M16 17l5-5-5-5M21 12H9"/></svg>',
  bell: '<svg class="ic" viewBox="0 0 24 24"><path d="M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6z"/><path d="M10 20a2 2 0 004 0"/></svg>',
  home: '<svg class="ic" viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>',
  radar: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12L18 7"/></svg>',
  trophy: '<svg class="ic" viewBox="0 0 24 24"><path d="M7 4h10v5a5 5 0 01-10 0V4z"/><path d="M7 5H4a3 3 0 003 5M17 5h3a3 3 0 01-3 5M9 19h6M12 14v5"/></svg>',
  gear: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  phone: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 4h4l2 6-3 2a13 13 0 006 6l2-3 6 2v4a2 2 0 01-2 2A17 17 0 012 6a2 2 0 012-2z"/></svg>',
};

let me = JSON.parse(localStorage.getItem('dispatch_me') || 'null');
let pinBuffer = '';
let es = null;
let callTimerInterval = null, callStart = null;
let staffTab = 'home';

function authHeaders(extra) { return Object.assign({ 'x-user-id': me.id, 'x-user-pin': me.pin, 'Content-Type': 'application/json' }, extra || {}); }
async function api(url, opts = {}) {
  opts.headers = authHeaders(opts.headers);
  let res;
  try {
    res = await fetch(url, opts);
  } catch (netErr) {
    return { ok: false, status: 0, json: async () => ({ error: 'Network error — check your connection' }) };
  }
  const clone = res.clone();
  const originalJson = res.json.bind(res);
  res.json = async () => {
    try {
      return await originalJson();
    } catch (parseErr) {
      let text = '';
      try { text = await clone.text(); } catch {}
      const friendly = res.status >= 500 ? 'Server error — please try again' : (text ? text.slice(0, 200) : ('Request failed (' + res.status + ')'));
      return { error: friendly };
    }
  };
  return res;
}

// ---------- Login ----------
document.getElementById('keypad').addEventListener('click', (e) => {
  const btn = e.target.closest('.key'); if (!btn) return;
  const k = btn.dataset.k;
  if (k === 'clear') pinBuffer = ''; else if (k === 'back') pinBuffer = pinBuffer.slice(0, -1);
  else if (pinBuffer.length < 4) pinBuffer += k;
  renderPinDots();
  if (pinBuffer.length === 4) attemptLogin();
});
function renderPinDots() { document.querySelectorAll('.pin-dot').forEach((d, i) => { d.classList.remove('error'); d.classList.toggle('filled', i < pinBuffer.length); }); }
async function attemptLogin() {
  const errEl = document.getElementById('loginError');
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pinBuffer }) });
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error || 'Invalid PIN';
    document.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
    setTimeout(() => { pinBuffer = ''; renderPinDots(); errEl.textContent = ''; }, 500);
    return;
  }
  me = data.data;
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  enterApp();
}
function logout() {
  if (me) api('/api/clock', { method: 'POST', body: JSON.stringify({ clockedIn: false }) });
  if (es) { es.close(); es = null; }
  if (typeof stopQueuePolling === 'function') stopQueuePolling();
  localStorage.removeItem('dispatch_me'); me = null; pinBuffer = ''; renderPinDots();
  document.getElementById('adminApp').classList.add('hidden');
  document.getElementById('staffApp').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
}
async function enterApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  const res = await api('/api/me'); const fresh = (await res.json()).data;
  if (fresh) { me = { ...me, ...fresh }; localStorage.setItem('dispatch_me', JSON.stringify(me)); }
  connectEvents();
  refreshNotifBadge();
  registerServiceWorker();
  if (me.role === 'admin') {
    document.getElementById('adminApp').classList.remove('hidden');
    switchAdminTab('dashboard');
  } else {
    document.getElementById('staffApp').classList.remove('hidden');
    updateClockBtn();
    renderStaffNav();
    switchStaffTab('home');
  }
  checkFirstLoginTutorial();
}
// Registered unconditionally on every login, not just when someone opts into push -
// an active service worker is also what makes Chrome/Android treat this as a real
// installable app in the first place, not just a bookmark.
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { await navigator.serviceWorker.register('/sw.js'); } catch {}
}
function renderStaffNav() {
  const nav = document.getElementById('staffNav');
  const queueLabel = me.role === 'finisher' ? 'Queue' : 'Leads';
  nav.innerHTML = \`
    <button class="nav-btn active" data-tab="home" onclick="switchStaffTab('home')">\${ICONS.home}Home</button>
    <button class="nav-btn" data-tab="queue" onclick="switchStaffTab('queue')" style="position:relative;">\${ICONS.radar}\${queueLabel}</button>
    <button class="nav-btn" data-tab="chat" onclick="switchStaffTab('chat')" style="position:relative;">\${ICONS.chat}Chat</button>
    <button class="nav-btn" data-tab="board" onclick="switchStaffTab('board')">\${ICONS.trophy}Board</button>
    <button class="nav-btn" data-tab="profile" onclick="switchStaffTab('profile')">\${ICONS.gear}Profile</button>
  \`;
}

// ---------- Realtime ----------
function connectEvents() {
  if (es) es.close();
  es = new EventSource('/api/events?uid=' + me.id + '&pin=' + me.pin);
  es.addEventListener('new_lead', () => { if (staffTab === 'queue') renderStaffQueue(); pingNav('queue'); if (me.role==='admin') maybeRefreshAdmin('leads'); });
  es.addEventListener('lead_claimed', (e) => { const d = JSON.parse(e.data); const card = document.querySelector('[data-lead-id="' + d.id + '"]'); if (card) card.remove(); });
  es.addEventListener('lead_updated', () => { if (me.role === 'admin') maybeRefreshAdmin(['dashboard','leads','finishing']); });
  es.addEventListener('announcement', () => { if (staffTab === 'home') renderStaffHome(); if (me.role==='admin') maybeRefreshAdmin('announcements'); });
  es.addEventListener('chat_message', (e) => { const d = JSON.parse(e.data); if (staffTab === 'chat' || (me.role==='admin' && currentAdminTab==='chat')) appendChatMessage(d); else pingNav('chat'); });
  es.addEventListener('notification', () => refreshNotifBadge());
  es.onerror = () => setTimeout(() => { if (me) connectEvents(); }, 3000);
}
function pingNav(tab) {
  const btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]');
  if (btn && !btn.querySelector('.nav-badge')) { const b = document.createElement('span'); b.className = 'nav-badge'; b.style.position='absolute'; b.style.top='2px'; b.style.right='22%'; btn.appendChild(b); }
}
function clearNavBadge(tab) { const btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]'); const b = btn && btn.querySelector('.nav-badge'); if (b) b.remove(); }
let currentAdminTab = 'dashboard';
function maybeRefreshAdmin(tabs) { const arr = Array.isArray(tabs) ? tabs : [tabs]; if (arr.includes(currentAdminTab)) smoothRerender(() => renderAdminTab(currentAdminTab)); }
// Background updates (triggered by other people's actions via SSE) shouldn't look
// like the page reloading. Briefly dims the content, swaps it while invisible, then
// fades back in — same content update, no jarring flash or re-triggered pop-in
// animations on every background change.
async function smoothRerender(renderFn) {
  const el = document.getElementById(me.role === 'admin' ? 'adminContent' : 'staffBody');
  if (!el) { await renderFn(); return; }
  el.style.transition = 'opacity .15s ease';
  el.style.opacity = '0.4';
  await new Promise(r => setTimeout(r, 120));
  await renderFn();
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

async function refreshNotifBadge() {
  const res = await api('/api/notifications/unread-count'); const { count } = (await res.json()).data;
  ['notifBtn','notifBtnStaff'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    let dot = el.querySelector('.dot');
    if (count > 0 && !dot) { dot = document.createElement('span'); dot.className = 'dot'; el.appendChild(dot); }
    if (count === 0 && dot) dot.remove();
  });
}
async function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  const backdrop = document.getElementById('notifBackdrop');
  if (!panel.classList.contains('hidden')) { closeNotifPanel(); return; }
  await renderNotifList();
  panel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}
function closeNotifPanel() {
  document.getElementById('notifPanel').classList.add('hidden');
  document.getElementById('notifBackdrop').classList.add('hidden');
}
async function renderNotifList() {
  const panel = document.getElementById('notifPanel');
  const res = await api('/api/notifications');
  const rows = (await res.json()).data;
  panel.innerHTML = \`<div class="panel p fade-up">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <div class="section-title" style="margin:0;">Notifications</div>
      <button class="icon-btn" style="width:28px;height:28px;" onclick="closeNotifPanel()">✕</button>
    </div>
    \${rows.length ? rows.map(n => \`<div class="clickable" style="padding:11px 0;border-bottom:1px solid var(--border);font-size:12.5px;\${n.read ? 'opacity:.5;' : ''}" onclick="markOneRead(\${n.id}, this)">
      <div>\${esc(n.content)}</div><div style="font-size:10px;color:var(--text-faint);margin-top:3px;">\${timeAgo(n.created_at)}\${!n.read ? ' · <span style="color:var(--gold-bright);">tap to mark read</span>' : ''}</div>
    </div>\`).join('') : '<div style="color:var(--text-dim);font-size:12.5px;padding:10px 0;">Nothing yet.</div>'}
    \${rows.length ? '<button class="btn btn-sm btn-block" style="margin-top:12px;" onclick="markAllRead()">Mark all read</button>' : ''}
  </div>\`;
}
async function markOneRead(id, el) {
  await api('/api/notifications/' + id + '/read', { method: 'POST' });
  el.style.opacity = '.5';
  refreshNotifBadge();
}
async function markAllRead() {
  await api('/api/notifications/read-all', { method: 'POST' });
  refreshNotifBadge();
  await renderNotifList();
}

// ---------- Clock ----------
let clockDurationInterval;
async function updateClockBtn() {
  const btn = document.getElementById('clockBtn');
  clearInterval(clockDurationInterval);
  if (me.clocked_in) {
    btn.className = 'btn btn-sm btn-teal';
    let clockedInAt;
    try {
      const res = await api('/api/clock/status');
      const data = (await res.json()).data;
      clockedInAt = data.clockedInAt ? new Date(data.clockedInAt).getTime() : Date.now();
    } catch { clockedInAt = Date.now(); }
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - clockedInAt) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      btn.textContent = 'Clocked In — ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    };
    tick();
    clockDurationInterval = setInterval(tick, 1000);
  } else {
    btn.textContent = 'Clock In';
    btn.className = 'btn btn-sm btn-ghost';
  }
}
async function toggleClock() {
  me.clocked_in = !me.clocked_in;
  await api('/api/clock', { method: 'POST', body: JSON.stringify({ clockedIn: me.clocked_in }) });
  localStorage.setItem('dispatch_me', JSON.stringify(me));
  updateClockBtn();
  if (staffTab === 'queue') renderStaffQueue();
}

// Real motion on stat numbers instead of just appearing — counts up from 0 over
// ~600ms with an eased curve, applied automatically to any element with data-count.
function animateCountUps(container) {
  const els = (container || document).querySelectorAll('[data-count]');
  els.forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const duration = 650;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target;
    };
    requestAnimationFrame(tick);
  });
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}
function esc(s) { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fullName(l) { return [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Unknown'; }
function titleCase(s) { return String(s || '').replace(/_/g, ' ').replace(/\\b\\w/g, c => c.toUpperCase()); }
const STATUS_ICONS = {
  successful_call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L19 7"/></svg>',
  completed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12l5 5L19 7"/></svg>',
  failed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cancelled: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chopped_previously: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  not_called: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="8"/></svg>',
  calling: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>',
  active_call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M6.6 10.8a15 15 0 006.6 6.6l2.2-2.2a1 1 0 011.1-.2 11 11 0 003.4.6 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11 11 0 00.6 3.4 1 1 0 01-.2 1.1z"/></svg>',
  call_ended: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  ready_for_finishing: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
  assigned_to_finisher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
  requires_review: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17a2 2 0 001.7 3h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
  voicemail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  no_answer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  hung_up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  busy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>',
  callback_requested: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/></svg>',
  caller: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/></svg>',
  finisher: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M9 11l3 3L22 4"/><path d="M21 12v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h11"/></svg>',
};
function statusBadge(status, extraClass) {
  return '<span class="badge ' + status + (extraClass ? ' ' + extraClass : '') + '">' + titleCase(status) + '</span>';
}
function initials(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
const AVATAR_PALETTE = ['#4f8cff','#2dd4bf','#a78bfa','#f59e0b','#ef4444','#10b981','#6366f1','#ec4899','#14b8a6','#f97316'];
function avatarColor(seed) {
  let hash = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
// Single shared avatar renderer used everywhere a person needs a picture: a real
// uploaded photo when set, otherwise a colored initials circle — no emoji.
function avatarHtml(person, size) {
  if (person && person.pfp_data) return '<img src="' + person.pfp_data + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;" />';
  const name = person ? (person.name || fullName(person)) : '';
  const color = avatarColor((person && person.id) || name);
  const fontSize = Math.round(size * 0.4);
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:' + fontSize + 'px;font-weight:700;color:#fff;flex-shrink:0;letter-spacing:-.02em;">' + initials(name) + '</div>';
}

// Shared lead-category badge (used on both the admin leads table and caller-facing
// lead cards): real bank brand color as an accent, plain text name — never the
// bank's actual logo artwork.
let sharedCategoryCache = null;
async function loadCategoryCache() {
  if (sharedCategoryCache) return sharedCategoryCache;
  try {
    const res = await api('/api/lead-categories');
    sharedCategoryCache = (await res.json()).data;
  } catch { sharedCategoryCache = []; }
  return sharedCategoryCache;
}
function categoryBadgeHtml(leadType) {
  if (!leadType || !sharedCategoryCache) return '';
  const cat = sharedCategoryCache.find(c => c.name.toLowerCase() === String(leadType).toLowerCase());
  const color = cat ? cat.color : '#8b8b93';
  return '<span class="badge" style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;">' + esc(leadType) + '</span>';
}

// ---------- Shared chat panel (used by both admin and staff shells) ----------
async function renderChatInto(containerEl) {
  const [msgsRes, presenceRes] = await Promise.all([api('/api/chat/messages'), api('/api/chat/presence')]);
  const msgs = (await msgsRes.json()).data;
  const presence = (await presenceRes.json()).data;
  containerEl.innerHTML = \`
    <div class="presence-strip">\${presence.map(p => '<div class="presence-chip ' + (p.clocked_in ? 'online' : '') + '"><span class="dot"></span>' + avatarHtml(p, 16) + ' ' + esc(p.name) + '</div>').join('')}</div>
    <div class="chat-shell panel" style="padding:14px;">
      <div class="chat-messages" id="chatMessages">\${msgs.map(chatMsgHtml).join('')}</div>
      <div class="chat-input-row" style="flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;">
          <input id="chatInput" placeholder="Message the team…" onkeydown="if(event.key==='Enter') sendChatMessage()" />
          <button class="btn btn-gold" onclick="sendChatMessage()">Send</button>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-dim);text-transform:none;letter-spacing:0;font-weight:500;">
          <input type="checkbox" id="disappearToggle" style="width:auto;" /> Disappearing message
          <select id="disappearDuration" style="width:auto;padding:4px 8px;font-size:11px;display:none;">
            <option value="60">1 minute</option><option value="3600">1 hour</option><option value="86400" selected>24 hours</option><option value="604800">7 days</option>
          </select>
        </label>
      </div>
    </div>\`;
  document.getElementById('disappearToggle').addEventListener('change', (e) => {
    document.getElementById('disappearDuration').style.display = e.target.checked ? 'inline-block' : 'none';
  });
  const box = document.getElementById('chatMessages');
  box.scrollTop = box.scrollHeight;
  api('/api/chat/read', { method: 'POST', body: JSON.stringify({ lastReadMessageId: msgs.length ? msgs[msgs.length - 1].id : 0 }) });
  clearNavBadge('chat');
}
function chatMsgHtml(m) {
  const own = m.sender_id === me.id;
  return \`<div class="chat-msg \${own ? 'own' : ''}" data-msg-id="\${m.id}">\${avatarHtml({ name: m.sender_name, pfp_data: m.sender_pfp_data }, 32)}
    <div class="chat-bubble"><div class="chat-sender">\${esc(m.sender_name || 'Unknown')}\${m.sender_role === 'admin' ? ' <span class="badge admin" style="margin-left:4px;">admin</span>' : ''}\${m.expires_at ? ' <span title="Disappears ' + timeAgo(m.expires_at) + '" style="opacity:.6;font-size:9.5px;text-transform:uppercase;letter-spacing:.4px;">· expires \${timeAgo(m.expires_at)}</span>' : ''}</div>
    <div class="chat-text">\${esc(m.content)}</div><div class="chat-time">\${timeAgo(m.created_at)}\${(own || me.role === 'admin') ? ' · <span style="cursor:pointer;text-decoration:underline;" onclick="deleteChatMessage(' + m.id + ')">delete</span>' : ''}</div></div></div>\`;
}
function appendChatMessage(m) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', chatMsgHtml(m));
  box.scrollTop = box.scrollHeight;
}
async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  const disappear = document.getElementById('disappearToggle');
  const expiresInSeconds = disappear && disappear.checked ? Number(document.getElementById('disappearDuration').value) : undefined;
  input.value = '';
  await api('/api/chat/messages', { method: 'POST', body: JSON.stringify({ content, expiresInSeconds }) });
}
async function deleteChatMessage(id) {
  await api('/api/chat/messages/' + id, { method: 'DELETE' });
  const el = document.querySelector('[data-msg-id="' + id + '"]');
  if (el) el.remove();
}
</script>
<script>
${ADMIN_JS}
</script>
<script>
${STAFF_JS}
</script>
<script>
// Shown once per device, the first time a caller/finisher logs in — walks them
// through adding the app to their home screen so push notifications actually work.
// Platform-specific since the steps genuinely differ (iOS Safari has no install
// prompt API at all, unlike Android/desktop Chrome).
function checkFirstLoginTutorial() {
  if (!me || me.role === 'admin') return;
  const seenKey = 'tutorial_seen_' + me.id;
  if (localStorage.getItem(seenKey)) return;
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  if (isStandalone) { localStorage.setItem(seenKey, '1'); return; }

  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isAndroid = /android/i.test(ua);
  let steps;
  if (isIos) {
    steps = ['Tap the Share icon at the bottom of Safari (the square with an arrow)', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" in the top right'];
  } else if (isAndroid) {
    steps = ['Tap the ⋮ menu in the top right of Chrome', 'Tap "Add to Home screen" or "Install app"', 'Confirm — it now works like a real app'];
  } else {
    steps = ['Look for an install icon in your browser\\'s address bar', 'Click it and confirm the install', 'The app opens in its own window from now on'];
  }
  const modal = document.createElement('div');
  modal.id = 'firstLoginTutorial';
  modal.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = \`<div class="panel p" style="max-width:380px;text-align:center;">
    <div style="font-size:15px;font-weight:700;margin-bottom:6px;">One quick thing before you start</div>
    <p style="font-size:12.5px;color:var(--text-dim);margin-bottom:16px;line-height:1.6;">Add this to your home screen so it works like a real app and you get proper notifications for new leads.</p>
    <div style="text-align:left;margin-bottom:18px;">\${steps.map((s, i) => '<div style="display:flex;gap:10px;margin-bottom:10px;"><div style="width:22px;height:22px;border-radius:50%;background:var(--gold);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + (i + 1) + '</div><div style="font-size:13px;line-height:1.4;padding-top:2px;">' + s + '</div></div>').join('')}</div>
    <button class="btn btn-gold btn-block" onclick="dismissFirstLoginTutorial()">Got It</button>
    <button class="btn btn-ghost btn-sm btn-block" style="margin-top:8px;" onclick="dismissFirstLoginTutorial()">Skip for now</button>
  </div>\`;
  document.body.appendChild(modal);
}
function dismissFirstLoginTutorial() {
  if (me) localStorage.setItem('tutorial_seen_' + me.id, '1');
  const modal = document.getElementById('firstLoginTutorial');
  if (modal) modal.remove();
  if (me && me.role !== 'admin') promptForPushAfterTutorial();
}
// Right after the home-screen tutorial, while they're already paying attention -
// asking cold from a random Profile tab gets ignored, asking right here gets seen.
async function promptForPushAfterTutorial() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const existing = reg && await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed, nothing to do
    if (typeof togglePush === 'function') await togglePush();
  } catch {}
}

// Mobile fix: tapping the Dial button backgrounds the app (native phone UI takes
// over), which suspends JS timers and SSE. Force a fresh state pull the instant the
// page becomes visible again, so a stale "still on this call" card never lingers.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !me) return;
  if (me.role === 'admin') {
    if (typeof currentAdminTab !== 'undefined') renderAdminTab(currentAdminTab);
  } else if (typeof staffTab !== 'undefined') {
    if (staffTab === 'queue') renderStaffQueue();
    else if (staffTab === 'home') renderStaffHome();
  }
  // Always force a fresh SSE connection on returning to the foreground - mobile
  // Safari in particular can leave a connection in a state that still LOOKS open
  // (readyState never flips to CLOSED) while it's actually dead, so checking
  // readyState alone isn't reliable enough to catch every case.
  if (typeof connectEvents === 'function') connectEvents();
});

if (me) enterApp();
</script>
</body>
</html>`;
