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
<meta name="theme-color" content="#0B1F26">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{
  /* ================================================================
     SWITCHBOARD CONSOLE
     Two surfaces, not one. A petrol-dark chassis holds warm bone
     working panels. Amber means exactly one thing: a live line.
     Old variable names are kept as aliases so every inline style in
     the app inherits the new palette without being touched.
     ================================================================ */
  --board:#0B1F26; --board-2:#102b34; --board-3:#173a45;
  --paper:#EDE7DB; --paper-2:#F7F3EA; --paper-3:#E3DCCD;
  --ink:#14191B; --ink-2:#3A4548; --ink-soft:#5C6A6E; --bone:#CFC7B7;
  --lamp:#FFB020; --lamp-deep:#C97C05; --lamp-wash:rgba(255,176,32,.12);
  --green:#3F7A5F; --red:#B23A26; --blue:#3E6B8A;

  /* --- aliases: old names, new values --- */
  --bg:var(--board); --bg-2:var(--board-2); --s1:var(--board-2); --s2:var(--board-3); --s3:#1e4753;
  --border:rgba(255,255,255,.07); --border-2:rgba(255,255,255,.13);
  --gold:var(--lamp); --gold-bright:#FFC658; --gold-glow:rgba(255,176,32,.22);
  --teal:var(--green); --teal-glow:rgba(63,122,95,.16);
  --crimson:var(--red); --crimson-glow:rgba(178,58,38,.16); --violet:#8FA6B8;
  --text:#EDE7DB; --text-dim:rgba(237,231,219,.6); --text-faint:rgba(237,231,219,.36);
  --success:var(--green); --danger:var(--red); --warn:var(--lamp);

  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:32px; --sp-8:40px;
  --r-sm:6px; --r-md:8px; --r-lg:10px; --r-xl:12px; --r-full:100px;

  --e-out:cubic-bezier(.2,.8,.2,1);
  --e-soft:cubic-bezier(.16,1,.3,1);
  --f-display:'Archivo',system-ui,sans-serif;
  --f-body:'Instrument Sans',system-ui,sans-serif;
  --f-mono:'IBM Plex Mono',ui-monospace,monospace;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
html,body{height:100%;overscroll-behavior-y:contain;}
body{
  font-family:var(--f-body);color:var(--text);background:var(--board);
  min-height:100vh;min-height:100dvh;overflow-x:hidden;font-size:14px;line-height:1.5;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
}
/* Chassis grain. One material, no glow, no gradient wash. */
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:repeating-linear-gradient(0deg,rgba(255,255,255,.014) 0 1px,transparent 1px 3px);
}
h1,h2,h3{font-family:var(--f-display);font-weight:700;letter-spacing:-.02em;}
a{color:var(--lamp);text-decoration:none;}
button{font-family:inherit;border:none;background:none;color:inherit;cursor:pointer;}
.mono{font-family:var(--f-mono);font-variant-numeric:tabular-nums;}
.hidden{display:none !important;}
.app-shell{position:relative;z-index:1;min-height:100dvh;display:flex;flex-direction:column;}
.disp{font-family:var(--f-display);}

/* ---------------------------------------------------------- motion --- */
/* One curve, short travel, tight stagger. Scattered easings and long
   fly-ins are the tell; restraint reads as considered. */
@keyframes fadeUp{from{opacity:0;transform:translateY(9px);}to{opacity:1;transform:none;}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes pageIn{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}
@keyframes shimmer{0%{background-position:-380px 0;}100%{background-position:380px 0;}}
@keyframes spin{to{transform:rotate(360deg);}}
@keyframes shake{0%,100%{transform:translateX(0);}22%{transform:translateX(-6px);}44%{transform:translateX(6px);}66%{transform:translateX(-3px);}}
@keyframes lampPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.45;transform:scale(.84);}}
@keyframes pulseRing{0%{transform:scale(1);opacity:.5;}100%{transform:scale(2.6);opacity:0;}}
@keyframes liveDotPulse{0%{box-shadow:0 0 0 0 rgba(255,176,32,.5);}100%{box-shadow:0 0 0 9px rgba(255,176,32,0);}}
@keyframes iconPop{0%{transform:scale(1);}50%{transform:scale(1.12);}100%{transform:scale(1);}}
@keyframes bellPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,176,32,0);}50%{box-shadow:0 0 0 5px rgba(255,176,32,.16);}}
.fade-up{animation:fadeUp .5s var(--e-soft) both;}
.page-transition{animation:pageIn .34s var(--e-soft) both;}
.stagger > *{animation:fadeUp .5s var(--e-soft) both;}
.stagger > *:nth-child(1){animation-delay:0ms;}
.stagger > *:nth-child(3){animation-delay:55ms;}
.stagger > *:nth-child(5){animation-delay:110ms;}
.loading-shimmer{background:linear-gradient(90deg,var(--board-2) 25%,var(--board-3) 50%,var(--board-2) 75%);background-size:760px 100%;animation:shimmer 1.5s infinite linear;border-radius:var(--r-md);}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms !important;animation-iteration-count:1 !important;transition-duration:.01ms !important;}
}

/* ---------------------------------------------------------- panels --- */
/* Work happens on paper. The frame is the machine. */
.panel{
  background:var(--paper);color:var(--ink);border-radius:var(--r-lg);
  box-shadow:0 1px 0 rgba(255,255,255,.05),0 14px 30px -18px rgba(0,0,0,.75);
  overflow:hidden;
}
.panel h1,.panel h2,.panel h3{color:var(--ink);}
.p{padding:16px;}
.panel-inset{background:var(--paper-2);border:1px solid var(--bone);border-radius:var(--r-md);padding:12px 14px;color:var(--ink);}
.panel-inset.clickable{cursor:pointer;transition:background .18s var(--e-out),border-color .18s var(--e-out);}
.panel-inset.clickable:hover{background:#fff;border-color:var(--ink-soft);}
.section-title{
  font-family:var(--f-mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-soft);margin:18px 0 10px;font-weight:600;
}
.panel .section-title{color:var(--ink-soft);}
.app-shell > .section-title,.staff-body > .section-title,.admin-content > .section-title{color:var(--text-faint);}
.empty-state{padding:44px 20px;text-align:center;color:var(--ink-soft);}
.empty-state .ic{width:22px;height:22px;opacity:.4;margin-bottom:10px;}
.empty-state .empty-title{font-family:var(--f-display);font-size:15px;color:var(--ink);margin-bottom:4px;}
.empty-state .empty-sub{font-size:12.5px;color:var(--ink-soft);}

/* --------------------------------------------------------- buttons --- */
/* Flat, one weight of shadow, no gradients. Press is a real 1px drop. */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  padding:10px 15px;border-radius:var(--r-md);font-family:var(--f-display);
  font-size:13px;font-weight:600;letter-spacing:.005em;
  transition:background .16s var(--e-out),color .16s var(--e-out),transform .12s var(--e-out),border-color .16s var(--e-out);
}
.btn:hover{filter:none;}
.btn:active{transform:translateY(1px) scale(.99);}
.btn-gold{background:var(--lamp);color:#241500;box-shadow:0 1px 0 var(--lamp-deep);}
.btn-gold:hover{background:var(--gold-bright);}
.btn-gold:active{box-shadow:none;}
.btn-teal{background:var(--green);color:#EAF3EE;}
.btn-danger{background:transparent;color:var(--red);border:1px solid rgba(178,58,38,.45);}
.btn-danger:hover{background:var(--red);color:var(--paper);}
.btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--bone);}
.btn-ghost:hover{background:var(--ink);color:var(--paper);border-color:var(--ink);}
.app-shell > .btn-ghost,.staff-body .btn-ghost{color:var(--text);border-color:var(--border-2);}
.btn-block{width:100%;}
.btn-sm{padding:7px 11px;font-size:11.5px;}

/* ----------------------------------------------------------- forms --- */
.field{margin-bottom:12px;}
label{display:block;font-family:var(--f-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:5px;}
input,select,textarea{
  width:100%;padding:9px 11px;border-radius:var(--r-sm);border:1px solid var(--bone);
  background:var(--paper-2);color:var(--ink);font-family:var(--f-body);font-size:13.5px;
  transition:border-color .16s var(--e-out),background .16s var(--e-out);
}
input:focus,select:focus,textarea:focus{outline:none;border-color:var(--ink);background:#fff;}
textarea{min-height:86px;resize:vertical;line-height:1.55;}
:focus-visible{outline:2px solid var(--lamp);outline-offset:2px;}
input.toggle-switch{
  appearance:none;width:38px;height:21px;border-radius:99px;background:var(--paper-3);
  border:1px solid var(--bone);position:relative;cursor:pointer;padding:0;flex:none;
  transition:background .2s var(--e-out),border-color .2s var(--e-out);
}
input.toggle-switch::after{
  content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;
  background:var(--ink-soft);transition:transform .22s var(--e-out),background .22s var(--e-out);
}
input.toggle-switch:checked{background:var(--lamp);border-color:var(--lamp-deep);}
input.toggle-switch:checked::after{transform:translateX(17px);background:#241500;}

/* ---------------------------------------------------------- status --- */
/* No pills. A status is a mono label with a lamp beside it — the same
   language as the board, and it never competes with real content. */
.badge{
  display:inline-flex;align-items:center;gap:6px;background:none;border:none;padding:0;
  font-family:var(--f-mono);font-size:10.5px;font-weight:500;letter-spacing:.06em;
  text-transform:uppercase;color:var(--ink-soft);white-space:nowrap;
}
.badge::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;flex:none;opacity:.85;}
.badge-ic{display:none;}
.badge.not_called{color:var(--ink-soft);}
.badge.calling,.badge.active_call,.badge.ringing,.badge.in-progress{color:var(--lamp-deep);}
.badge.calling::before,.badge.active_call::before,.badge.ringing::before,.badge.in-progress::before{animation:lampPulse 1.7s ease-in-out infinite;}
.badge.call_ended{color:var(--ink-soft);}
.badge.successful_call,.badge.completed{color:var(--green);}
.badge.ready_for_finishing,.badge.assigned_to_finisher{color:var(--blue);}
.badge.failed,.badge.missed,.badge.no-answer{color:var(--red);}
.badge.cancelled,.badge.chopped_previously{color:var(--ink-soft);}
.badge.requires_review,.badge.important{color:var(--lamp-deep);}
.badge.admin{color:var(--red);}
.badge.caller{color:var(--ink-2);}
.badge.finisher{color:var(--blue);}
.badge.voicemail,.badge.no_answer,.badge.hung_up,.badge.busy{color:var(--ink-soft);}
.badge.callback_requested{color:var(--lamp-deep);}
/* On the dark chassis the same label needs the light end of the ramp. */
.topbar .badge,.bottom-nav .badge,.admin-sidebar .badge{color:var(--text-dim);}

.ic{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex:none;}

/* ----------------------------------------------------------- login --- */
#loginScreen{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:22px;}
.login-card{width:100%;max-width:330px;text-align:center;}
.crest{width:52px;height:52px;border-radius:var(--r-md);background:var(--board-2);border:1px solid var(--border-2);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;overflow:hidden;}
.crest svg{width:24px;height:24px;stroke:var(--lamp);fill:none;stroke-width:1.5;}
.login-title{font-family:var(--f-display);font-size:23px;font-weight:800;letter-spacing:-.03em;margin-bottom:5px;}
.login-sub{font-size:12.5px;color:var(--text-dim);margin-bottom:26px;}
.pin-dots{display:flex;gap:11px;justify-content:center;margin-bottom:26px;}
.pin-dot{width:11px;height:11px;border-radius:50%;border:1px solid var(--border-2);transition:background .18s var(--e-out),border-color .18s var(--e-out),transform .18s var(--e-out);}
.pin-dot.filled{background:var(--lamp);border-color:var(--lamp);transform:scale(1.1);}
.pin-dot.error{border-color:var(--red);background:var(--red);}
.pin-dots.error,.login-card.error{animation:shake .4s var(--e-out);}
.keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;}
.key{
  aspect-ratio:1.5;display:flex;align-items:center;justify-content:center;
  font-family:var(--f-display);font-size:20px;font-weight:600;border-radius:var(--r-md);
  background:var(--board-2);border:1px solid var(--border);color:var(--text);
  transition:background .14s var(--e-out),transform .1s var(--e-out);
}
.key:hover{background:var(--board-3);}
.key:active{transform:scale(.96);background:var(--board-3);}
.key.wide{font-size:12px;font-family:var(--f-mono);letter-spacing:.05em;color:var(--text-dim);}
.login-error{color:var(--red);font-size:12.5px;margin-top:14px;min-height:18px;}
.pin-display{font-family:var(--f-mono);font-size:26px;letter-spacing:.24em;font-variant-numeric:tabular-nums;}

/* ---------------------------------------------------------- topbar --- */
.topbar{
  position:sticky;top:0;z-index:40;display:flex;align-items:center;gap:12px;
  padding:13px 18px;padding-top:calc(13px + env(safe-area-inset-top));
  background:var(--board);border-bottom:1px solid var(--border);
}
.brand{font-family:var(--f-display);font-size:15.5px;font-weight:800;letter-spacing:-.03em;display:flex;align-items:center;gap:9px;}
.brand-mark{width:26px;height:26px;border-radius:6px;background:var(--board-2);border:1px solid var(--border-2);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.brand-mark svg{width:14px;height:14px;stroke:var(--lamp);fill:none;}
.topbar-actions{margin-left:auto;display:flex;align-items:center;gap:7px;}
.icon-btn{
  width:34px;height:34px;border-radius:var(--r-sm);display:flex;align-items:center;justify-content:center;
  color:var(--text-dim);position:relative;transition:background .16s var(--e-out),color .16s var(--e-out);
}
.icon-btn:hover{background:rgba(255,255,255,.06);color:var(--text);}
.icon-btn:active{transform:scale(.94);}
.icon-btn .dot{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:var(--lamp);animation:bellPulse 2.4s ease-in-out infinite;}
.clock-toggle{
  display:flex;align-items:center;gap:7px;padding:6px 11px;border-radius:99px;
  border:1px solid var(--border-2);font-family:var(--f-mono);font-size:10.5px;
  letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);
  transition:background .18s var(--e-out),color .18s var(--e-out),border-color .18s var(--e-out);
}
.clock-toggle:active{transform:scale(.97);}
.clock-toggle .clock-dot{width:6px;height:6px;border-radius:50%;background:var(--text-faint);transition:background .2s var(--e-out);}
.clock-toggle.on{background:var(--lamp-wash);border-color:rgba(255,176,32,.4);color:var(--lamp);}
.clock-toggle.on .clock-dot{background:var(--lamp);animation:lampPulse 2s ease-in-out infinite;}
.notif-panel{position:absolute;top:52px;right:14px;width:min(340px,calc(100vw - 28px));max-height:66vh;overflow-y:auto;z-index:60;}

/* ----------------------------------------------------------- admin --- */
.admin-shell{display:flex;min-height:calc(100dvh - 56px);}
.admin-sidebar{width:212px;flex:none;border-right:1px solid var(--border);padding:16px 12px;}
.side-sec{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-faint);padding:16px 10px 7px;}
.side-link{
  display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:var(--r-sm);
  color:var(--text-dim);font-size:13.5px;font-weight:500;cursor:pointer;
  transition:background .16s var(--e-out),color .16s var(--e-out),transform .16s var(--e-out);
}
.side-link .ic{flex-shrink:0;transition:color .16s var(--e-out);}
.side-link:hover{background:rgba(255,255,255,.05);color:var(--text);}
.side-link:hover .ic{color:var(--text);}
.side-link:active{transform:translateX(1px);}
.side-link.active{background:var(--paper);color:var(--board);font-weight:600;}
.side-link.active .ic{color:var(--board);animation:iconPop .3s var(--e-out);}
.admin-main{flex:1;min-width:0;}
.admin-content{max-width:1120px;margin:0 auto;padding:20px 22px 70px;}

/* ------------------------------------------------------ staff shell --- */
.staff-body{max-width:640px;margin:0 auto;padding:16px 16px 104px;}
.bottom-nav{
  position:fixed;left:0;right:0;bottom:0;z-index:50;display:flex;gap:3px;
  padding:7px 10px;padding-bottom:calc(7px + env(safe-area-inset-bottom));
  background:var(--board);border-top:1px solid var(--border);
}
.nav-btn{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;
  border-radius:var(--r-sm);color:var(--text-faint);font-family:var(--f-mono);
  font-size:9px;letter-spacing:.06em;text-transform:uppercase;position:relative;
  transition:background .16s var(--e-out),color .16s var(--e-out);
}
.nav-btn.active{color:var(--board);background:var(--paper);}
.nav-btn:active{transform:scale(.95);}
.nav-badge{position:absolute;top:4px;right:24%;width:6px;height:6px;border-radius:50%;background:var(--lamp);}

/* ----------------------------------------------------------- stats --- */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:1px;background:var(--bone);border-radius:var(--r-lg);overflow:hidden;}
.stat-box{padding:14px 15px 13px;background:var(--paper-2);transition:background .18s var(--e-out);}
.stat-box:hover{background:#fff;}
.stat-box .num{font-family:var(--f-display);font-size:27px;font-weight:800;letter-spacing:-.035em;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.05;}
.stat-box .lbl{font-size:11px;color:var(--ink-soft);margin-top:3px;}
.stat-box.accent .num{color:var(--lamp-deep);}

/* ---------------------------------------------------------- tables --- */
.table-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;}
.table-scroll table{min-width:640px;}
table{width:100%;border-collapse:collapse;color:var(--ink);}
th{
  text-align:left;font-family:var(--f-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--ink-soft);font-weight:600;padding:10px 14px;border-bottom:1px solid var(--bone);
}
td{padding:11px 14px;font-size:13px;border-bottom:1px solid rgba(0,0,0,.055);vertical-align:middle;}
tr:hover td{background:var(--lamp-wash);}
tr.clickable{cursor:pointer;}
tr.clickable:hover{background:var(--lamp-wash);}
tr.clickable:active{transform:scale(.998);}

/* ----------------------------------------------------------- vault --- */
.vault-workspace{display:flex;gap:14px;align-items:flex-start;}
.vault-rail{width:216px;flex:none;padding:14px;}
.vault-rail-title{font-family:var(--f-display);font-size:15px;font-weight:700;color:var(--ink);}
.vault-rail-sub{font-size:11.5px;color:var(--ink-soft);margin-top:2px;}
.vault-nav{display:flex;flex-direction:column;gap:2px;margin-top:14px;}
.vault-nav-item{
  display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--r-sm);
  font-size:13px;color:var(--ink-2);cursor:pointer;transition:background .16s var(--e-out),color .16s var(--e-out);
}
.vault-nav-item:hover{background:var(--paper-3);}
.vault-nav-item.active{background:var(--ink);color:var(--paper);}
.vault-nav-count{margin-left:auto;font-family:var(--f-mono);font-size:11px;opacity:.62;font-variant-numeric:tabular-nums;}
.vault-rail-actions{padding-top:14px;margin-top:14px;border-top:1px solid var(--bone);display:flex;flex-direction:column;gap:8px;}
.vault-field-label{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);}
.vault-main{flex:1;min-width:0;}
.vault-main-head{display:flex;align-items:baseline;gap:10px;padding:14px 16px;border-bottom:1px solid var(--bone);}
.vault-main-title{font-family:var(--f-display);font-size:15px;font-weight:700;color:var(--ink);}
.vault-main-count{font-family:var(--f-mono);font-size:11.5px;color:var(--ink-soft);margin-left:auto;}
.vault-empty{padding:52px 20px;text-align:center;color:var(--ink-soft);font-size:13px;}

/* ------------------------------------------------------- staff work --- */
.radar-zone{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 20px;text-align:center;}
.radar{position:relative;width:118px;height:118px;margin-bottom:20px;}
.radar-ring{position:absolute;inset:0;border-radius:50%;border:1px solid var(--border-2);}
.radar-ring:nth-child(2){inset:16px;}
.radar-ring:nth-child(3){inset:32px;}
.radar-sweep{position:absolute;inset:0;border-radius:50%;overflow:hidden;animation:spin 3.6s linear infinite;}
.radar-sweep::before{content:'';position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent 0deg,transparent 322deg,var(--lamp) 356deg,transparent 360deg);opacity:.55;}
.radar-core{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background:var(--lamp);}
.waiting-title{font-family:var(--f-display);font-size:17px;margin-bottom:5px;}
.waiting-sub{color:var(--text-dim);font-size:12.5px;}

.offer-card{position:relative;padding:20px;border-radius:var(--r-lg);margin-bottom:12px;background:var(--paper);color:var(--ink);box-shadow:0 14px 30px -18px rgba(0,0,0,.75);transition:transform .16s var(--e-out);}
.offer-card:active{transform:scale(.995);}
.offer-label{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);margin-bottom:9px;}
.offer-name{font-family:var(--f-display);font-size:19px;font-weight:700;letter-spacing:-.02em;margin-bottom:3px;color:var(--ink);}
.offer-meta{color:var(--ink-soft);font-size:12.5px;margin-bottom:16px;}
.offer-actions{display:flex;gap:9px;}
.offer-actions .btn{flex:1;padding:13px;font-size:13.5px;}
.offer-actions .btn-gold{flex:2;}
.offer-actions .btn-ghost{color:var(--ink);border-color:var(--bone);}
.pulse-dot{position:absolute;top:18px;right:18px;width:8px;height:8px;border-radius:50%;background:var(--lamp);}
.pulse-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:inherit;animation:pulseRing 1.9s cubic-bezier(0,0,.2,1) infinite;}
.live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--lamp);margin-left:6px;position:relative;top:-1px;animation:liveDotPulse 2s ease-out infinite;}

.call-card{padding:20px;background:var(--paper);color:var(--ink);}
.call-status-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.call-timer{font-family:var(--f-mono);font-size:13px;color:var(--ink-soft);font-variant-numeric:tabular-nums;}
.info-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06);}
.info-row .k{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-soft);}
.info-row .v{font-size:14px;font-weight:600;text-align:right;color:var(--ink);}
.call-action-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:16px 0;}
.dial-btn,.oncall-btn,.endcall-btn{
  display:flex;align-items:center;justify-content:center;gap:7px;padding:15px;border-radius:var(--r-md);
  font-family:var(--f-display);font-size:13.5px;font-weight:700;
  transition:transform .12s var(--e-out),background .16s var(--e-out);
}
.dial-btn:active,.oncall-btn:active,.endcall-btn:active{transform:translateY(1px) scale(.99);}
.dial-btn{background:var(--paper-2);border:1px solid var(--bone);color:var(--ink);}
.oncall-btn{background:var(--green);color:#EAF3EE;}
.endcall-btn{background:var(--red);color:var(--paper);grid-column:1/-1;}
.outcome-section{margin-top:14px;display:flex;flex-direction:column;gap:9px;}
.outcome-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;}
.outcome-grid button{padding:12px 6px;font-size:12px;font-weight:600;border-radius:var(--r-sm);transition:transform .12s var(--e-out),background .16s var(--e-out);}
.outcome-grid button:active{transform:scale(.97);}
.outcome-grid button:not(.win-btn):not(.review-btn):not(.fail-btn){background:var(--paper-2);border:1px solid var(--bone);color:var(--ink-2);}
.win-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:15px;font-family:var(--f-display);font-size:14px;font-weight:700;border-radius:var(--r-md);background:var(--green);color:#EAF3EE;transition:transform .12s var(--e-out);}
.win-btn:active{transform:translateY(1px) scale(.99);}
.win-btn .ic{width:16px;height:16px;}
.review-btn{width:100%;padding:12px;font-size:12.5px;font-weight:600;border-radius:var(--r-sm);background:var(--lamp-wash);color:var(--lamp-deep);border:1px solid rgba(255,176,32,.4);}
.review-btn:active{transform:scale(.98);}
.fail-btn{width:100%;padding:12px;font-size:12.5px;font-weight:600;border-radius:var(--r-sm);background:transparent;color:var(--red);border:1px solid rgba(178,58,38,.35);}
.fail-btn:active{transform:scale(.98);}
.scripts-toggle{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;border-radius:var(--r-sm);background:var(--paper-2);border:1px solid var(--bone);margin-bottom:10px;cursor:pointer;font-size:12.5px;font-weight:600;color:var(--ink-2);transition:background .16s var(--e-out);}
.scripts-toggle:active{transform:scale(.99);}
.scripts-panel{max-height:0;overflow:hidden;transition:max-height .34s var(--e-out);}
.scripts-panel.open{max-height:400px;overflow-y:auto;margin-bottom:10px;-webkit-overflow-scrolling:touch;}
.script-item{padding:11px 13px;border-radius:var(--r-sm);background:var(--paper-2);border:1px solid var(--bone);margin-bottom:7px;}
.script-item .title{font-size:12.5px;font-weight:600;color:var(--ink);margin-bottom:3px;}
.script-item .content{font-size:12.5px;color:var(--ink-soft);line-height:1.6;white-space:pre-wrap;}
.script-manager-item{background:var(--paper-2);border:1px solid var(--bone);border-radius:var(--r-sm);padding:11px 13px;margin-bottom:7px;transition:background .16s var(--e-out);}
.script-manager-item:active{transform:scale(.99);}

/* -------------------------------------------------------- caller ID --- */
.caller-id-pop{
  background:var(--paper);color:var(--ink);border-left:3px solid var(--lamp);
  border-radius:var(--r-md);padding:16px 18px;margin-bottom:12px;
  box-shadow:0 14px 30px -18px rgba(0,0,0,.75);
  transition:opacity .4s var(--e-out),max-height .4s var(--e-out),margin .4s var(--e-out),padding .4s var(--e-out);overflow:hidden;
}
.caller-id-pop .pop-badge{display:inline-block;font-family:var(--f-mono);font-size:9.5px;font-weight:600;letter-spacing:.12em;color:var(--lamp-deep);text-transform:uppercase;margin-bottom:7px;}
.caller-id-pop .pop-name{font-family:var(--f-display);font-size:18px;font-weight:700;margin-bottom:3px;color:var(--ink);}
.caller-id-pop .pop-meta{font-size:12.5px;color:var(--ink-soft);margin-bottom:9px;}
.caller-id-pop .pop-notes{font-size:12.5px;color:var(--ink-2);background:var(--paper-2);border-radius:var(--r-sm);padding:8px 10px;margin-bottom:11px;line-height:1.55;}

/* ------------------------------------------------------------ chat --- */
.chat-shell{display:flex;flex-direction:column;height:calc(100dvh - 190px);}
.chat-messages{flex:1;overflow-y:auto;padding:14px 2px;display:flex;flex-direction:column;gap:11px;}
.chat-msg{display:flex;gap:9px;align-items:flex-end;}
.chat-msg.own{flex-direction:row-reverse;}
.chat-av{width:27px;height:27px;border-radius:50%;flex:none;display:flex;align-items:center;justify-content:center;background:var(--board-2);border:1px solid var(--border-2);font-size:13px;}
.chat-bubble{max-width:76%;padding:9px 12px;border-radius:var(--r-md);background:var(--paper);color:var(--ink);}
.chat-msg.own .chat-bubble{background:var(--lamp);color:#241500;}
.chat-sender{font-family:var(--f-mono);font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin-bottom:3px;}
.chat-text{font-size:13.5px;line-height:1.5;}
.chat-time{font-family:var(--f-mono);font-size:9.5px;opacity:.5;margin-top:3px;}
.chat-input-row{display:flex;gap:8px;padding:10px 0 4px;}
.chat-input-row input{flex:1;}
.presence-strip{display:flex;gap:6px;flex-wrap:wrap;padding-bottom:8px;}
.presence-chip{display:flex;align-items:center;gap:6px;padding:4px 9px;border-radius:99px;border:1px solid var(--border);font-size:11.5px;color:var(--text-dim);}
.presence-chip .dot{width:5px;height:5px;border-radius:50%;background:var(--text-faint);}
.presence-chip.online .dot{background:var(--green);}

/* --------------------------------------------------- announcements --- */
.announcement{padding:13px 15px;border-radius:var(--r-md);margin-bottom:8px;display:flex;gap:11px;align-items:flex-start;background:var(--paper);color:var(--ink);}
.announcement.important{border-left:3px solid var(--lamp);}
.announcement .txt{font-size:13px;line-height:1.55;color:var(--ink);}
.announcement .meta{font-family:var(--f-mono);font-size:10px;color:var(--ink-soft);margin-top:5px;}
.new-pin-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-radius:var(--r-md);background:var(--lamp-wash);border:1px solid rgba(255,176,32,.35);margin-top:12px;}

/* ------------------------------------------------------ leaderboard --- */
.lb-row{display:flex;align-items:center;gap:11px;padding:11px 14px;border-bottom:1px solid rgba(0,0,0,.055);}
.lb-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--paper-3);font-size:14px;flex:none;}
.lb-name{font-size:13.5px;font-weight:600;color:var(--ink);}
.lb-stats{font-family:var(--f-mono);font-size:11.5px;color:var(--ink-soft);margin-left:auto;text-align:right;}
.lb-stats b{color:var(--ink);font-weight:600;}
.rank{font-family:var(--f-display);font-size:13px;font-weight:800;width:20px;text-align:center;color:var(--ink-soft);font-variant-numeric:tabular-nums;}
.rank.r1{color:var(--lamp-deep);}
.rank.r2,.rank.r3{color:var(--ink-2);}

/* -------------------------------------------------------- timeline --- */
.timeline{position:relative;padding-left:18px;}
.timeline::before{content:'';position:absolute;left:4px;top:4px;bottom:4px;width:1px;background:var(--bone);}
.timeline-item{position:relative;padding-bottom:14px;}
.timeline-item::before{content:'';position:absolute;left:-18px;top:5px;width:7px;height:7px;border-radius:50%;background:var(--paper);border:1.5px solid var(--ink-soft);}
.timeline-item .ev{font-size:13px;color:var(--ink);}
.timeline-item .meta{font-family:var(--f-mono);font-size:10.5px;color:var(--ink-soft);margin-top:2px;}

/* ----------------------------------------------------------- misc --- */
.row-flex{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}
.row-flex .field{flex:1;min-width:130px;margin-bottom:0;}
.avatar-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(42px,1fr));gap:7px;}
.avatar-opt{aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:19px;border-radius:var(--r-sm);background:var(--paper-2);border:1px solid var(--bone);cursor:pointer;transition:border-color .16s var(--e-out),transform .16s var(--e-out);}
.avatar-opt.sel{border-color:var(--ink);transform:scale(1.04);}
.blur-phone{cursor:pointer;filter:blur(4.5px);transition:filter .22s var(--e-out);position:relative;}
.blur-phone.revealed{filter:none;}
.blur-phone::after{content:'';}
.parse-row{display:flex;gap:10px;align-items:center;padding:7px 0;font-size:12.5px;color:var(--ink-2);}
.parse-row .miss{color:var(--red);}
.dup-warn{padding:11px 13px;border-radius:var(--r-sm);background:rgba(178,58,38,.08);border-left:3px solid var(--red);font-size:12.5px;color:var(--ink);margin-bottom:9px;}

@media (max-width:860px){
  .admin-sidebar{display:none;}
  .vault-workspace{flex-direction:column;}
  .vault-rail{width:100%;}
  .admin-content{padding:16px 14px 80px;}
}
@media (max-width:640px){
  .stat-grid{grid-template-columns:repeat(2,1fr);}
  .outcome-grid{grid-template-columns:1fr 1fr;}
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
      <div class="side-link" data-tab="vault" onclick="switchAdminTab('vault')">${ICONS_SVG.flag} Lead Vault</div>
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
      <button class="clock-toggle" id="clockBtn" onclick="toggleClock()"><span class="clock-dot"></span><span id="clockLabel">Clock In</span></button>
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
  check: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12l5 5L19 7"/></svg>',
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
let recentlyClaimedIds = new Set();
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
  const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pinBuffer, slug: typeof TENANT_SLUG !== 'undefined' ? TENANT_SLUG : null }) });
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
  es.addEventListener('new_lead', () => { if (staffTab === 'queue' && !onActiveCallScreen) smoothRerender(renderStaffQueue); pingNav('queue'); if (me.role==='admin') maybeRefreshAdmin('leads'); });
  es.addEventListener('center_closed', (e) => {
    if (me.role === 'admin') return; // admins are exempt from the gate, nothing changes for them
    const d = JSON.parse(e.data);
    me.clocked_in = false;
    localStorage.setItem('dispatch_me', JSON.stringify(me));
    window._centerClosed = true;
    window._centerClosedReason = d.reason || 'The call center is closed right now.';
    updateClockBtn();
    if (staffTab === 'queue') renderStaffQueue();
  });
  es.addEventListener('caller_identified', (e) => {
    if (me.role !== 'admin') return;
    const zone = document.getElementById('callerIdPopZone');
    if (!zone) return; // not currently on the dashboard, no pop to show
    const d = JSON.parse(e.data);
    const lead = d.lead;
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
    const card = document.createElement('div');
    card.className = 'caller-id-pop fade-up';
    card.innerHTML = '<div class="pop-badge">' + (d.provider || '').toUpperCase() + ' · Inbound Now</div>' +
      '<div class="pop-name">' + esc(name) + '</div>' +
      '<div class="pop-meta mono">' + esc(d.from || lead.phone || '') + (lead.lead_type ? ' · ' + esc(lead.lead_type) : '') + '</div>' +
      (lead.notes ? '<div class="pop-notes">' + esc(lead.notes) + '</div>' : '') +
      '<button class="btn btn-ghost btn-sm" onclick="this.closest(\\'.caller-id-pop\\').remove()">Dismiss</button>';
    zone.prepend(card);
    setTimeout(() => { if (card.parentNode) card.style.opacity = '0.001'; }, 45000);
  });
  es.addEventListener('lead_claimed', (e) => {
    const d = JSON.parse(e.data);
    const card = document.querySelector('[data-lead-id="' + d.id + '"]');
    if (card) card.remove();
    // A poll request that was already in flight when this claim happened can still
    // land afterward with a stale response that includes this lead - remembering it
    // was just claimed stops it from being silently re-added for a few seconds.
    recentlyClaimedIds.add(d.id);
    setTimeout(() => recentlyClaimedIds.delete(d.id), 15000);
  });
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
  const label = document.getElementById('clockLabel');
  clearInterval(clockDurationInterval);
  if (me.clocked_in) {
    btn.classList.add('on');
    let clockedInAt;
    try {
      const res = await api('/api/clock/status');
      const data = (await res.json()).data;
      clockedInAt = data.clockedInAt ? new Date(data.clockedInAt).getTime() : Date.now();
    } catch { clockedInAt = Date.now(); }
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - clockedInAt) / 1000));
      const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      label.textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    };
    tick();
    clockDurationInterval = setInterval(tick, 1000);
  } else {
    label.textContent = 'Clock In';
    btn.classList.remove('on');
  }
}
async function toggleClock() {
  const wantClockedIn = !me.clocked_in;
  const res = await api('/api/clock', { method: 'POST', body: JSON.stringify({ clockedIn: wantClockedIn }) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (wantClockedIn) {
      window._centerClosed = true;
      window._centerClosedReason = data.error || 'The call center is closed right now.';
    }
    if (staffTab === 'queue') renderStaffQueue();
    return;
  }
  me.clocked_in = wantClockedIn;
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
const AVATAR_PALETTE = ['#3E6B8A','#3F7A5F','#8FA6B8','#C97C05','#B23A26','#5C6A6E','#2F5A66','#8A6A3F','#4A7A78','#A0522D'];
function avatarColor(seed) {
  let hash = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
// Single shared avatar renderer used everywhere a person needs a picture: a real
// uploaded photo when set, otherwise a colored initials circle — no emoji.
function avatarHtml(person, size) {
  if (person && person.pfp_data) return '<img src="' + person.pfp_data + '" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 2px rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.3);" />';
  const name = person ? (person.name || fullName(person)) : '';
  const color = avatarColor((person && person.id) || name);
  const fontSize = Math.round(size * 0.4);
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:' + fontSize + 'px;font-weight:700;color:#fff;flex-shrink:0;letter-spacing:-.02em;box-shadow:0 0 0 2px rgba(255,255,255,.08), 0 2px 6px rgba(0,0,0,.3);">' + initials(name) + '</div>';
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
