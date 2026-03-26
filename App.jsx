import { useState, useEffect, useRef, useCallback } from "react";

// ── Backend API calls (keys are on server, never in browser) ──────────────
const API = {
  config:      ()          => fetch("/api/config").then(r => r.json()),
  questions:   (cat, lang, n) => fetch("/api/questions", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: cat, lang, count: n }),
  }).then(r => r.json()),
  createOrder: (plan)      => fetch("/api/payment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "create-order", plan }),
  }).then(r => r.json()),
  verifyPay:   (data)      => fetch("/api/payment", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "verify", ...data }),
  }).then(r => r.json()),
};

const FREE_PER_DAY = 10;
const PLANS = {
  monthly: { price: 99,  label: "Monthly Pro" },
  yearly:  { price: 699, label: "Yearly Pro"  },
};
const CATS = [
  { id:"ssc",       e:"📋", en:"SSC",          hi:"एसएससी",       d:"CGL, CHSL, MTS",    c:"#f97316" },
  { id:"banking",   e:"🏦", en:"Banking",       hi:"बैंकिंग",       d:"IBPS, SBI, RBI",    c:"#3b82f6" },
  { id:"railway",   e:"🚂", en:"Railway",       hi:"रेलवे",         d:"RRB NTPC, Group D", c:"#22c55e" },
  { id:"upsc",      e:"🏛️", en:"UPSC",          hi:"यूपीएससी",     d:"IAS, IPS, IFS",     c:"#a855f7" },
  { id:"gk",        e:"🌍", en:"General GK",   hi:"सामान्य ज्ञान", d:"Current Affairs",   c:"#ec4899" },
  { id:"math",      e:"🔢", en:"Maths",         hi:"गणित",          d:"Arithmetic, Algebra",c:"#14b8a6"},
  { id:"english",   e:"📝", en:"English",       hi:"अंग्रेज़ी",     d:"Grammar, Vocab",    c:"#f59e0b" },
  { id:"reasoning", e:"🧩", en:"Reasoning",     hi:"रीज़निंग",      d:"Verbal, Non-verbal", c:"#6366f1" },
];

// ── Firebase dynamic loader ───────────────────────────────────────────────
async function loadFirebase(cfg) {
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js");
  const {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, signInWithPhoneNumber,
    RecaptchaVerifier, signOut, onAuthStateChanged,
  } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
  const app  = getApps().length ? getApps()[0] : initializeApp(cfg);
  const auth = getAuth(app);
  return {
    loginEmail:  (e,p) => signInWithEmailAndPassword(auth, e, p),
    signupEmail: (e,p) => createUserWithEmailAndPassword(auth, e, p),
    loginGoogle: ()    => signInWithPopup(auth, new GoogleAuthProvider()),
    loginPhone:  async (ph, el) => {
      const v = new RecaptchaVerifier(auth, el, { size: "invisible" });
      return signInWithPhoneNumber(auth, ph, v);
    },
    logout:      ()    => signOut(auth),
    onAuth:      cb    => onAuthStateChanged(auth, cb),
  };
}

// ── Razorpay payment ──────────────────────────────────────────────────────
async function startPayment(plan, onSuccess) {
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  document.body.appendChild(s);
  await new Promise(r => { s.onload = r; });
  const ord = await API.createOrder(plan);
  if (ord.error) throw new Error(ord.error);
  return new Promise((resolve, reject) => {
    new window.Razorpay({
      key: ord.keyId, amount: ord.amount, currency: "INR",
      name: "ExamAI Pro", order_id: ord.orderId, theme: { color: "#ff9500" },
      handler: async resp => {
        const v = await API.verifyPay(resp);
        if (v.verified) { onSuccess(); resolve(); }
        else reject(new Error("Payment verify failed"));
      },
    }).open();
  });
}

// ── LocalStorage helper ───────────────────────────────────────────────────
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const MOCK_LB = [
  { name:"Rahul S.",  score:9840, city:"Delhi"   },
  { name:"Priya M.",  score:9210, city:"Mumbai"  },
  { name:"Amit K.",   score:8950, city:"Patna"   },
  { name:"Sunita R.", score:8700, city:"Jaipur"  },
  { name:"Vikash T.", score:8400, city:"Lucknow" },
];

// ════════════════════════════════════════════════════════════
//  STYLES
// ════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:wght@400;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#060b14;--bg2:#0c1220;--bg3:#111827;--bg4:#1c2535;
  --b:rgba(255,255,255,.07);--b2:rgba(255,255,255,.13);
  --or:#ff9500;--or2:#ff6200;--gr:#22c55e;--bl:#3b82f6;
  --tx:#eef2ff;--mu:#8892a4;--mu2:#4e5a6e;
  --re:#ef4444;--wa:#f59e0b;
  --fh:'Baloo 2',cursive;--fb:'Nunito',sans-serif;
  --rad:14px;
}
body{background:var(--bg);color:var(--tx);font-family:var(--fb);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(255,149,0,.3);border-radius:9px}

/* NAV */
.nav{display:flex;align-items:center;justify-content:space-between;padding:13px 26px;
  border-bottom:1px solid var(--b);background:rgba(6,11,20,.93);backdrop-filter:blur(22px);
  position:sticky;top:0;z-index:200}
.logo{font-family:var(--fh);font-size:22px;font-weight:800;cursor:pointer;display:flex;align-items:center;gap:8px}
.logo-box{width:32px;height:32px;background:linear-gradient(135deg,var(--or),var(--or2));border-radius:9px;
  display:flex;align-items:center;justify-content:center;font-size:17px}
.logo span{background:linear-gradient(135deg,var(--or),#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav-r{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.ltog{display:flex;background:var(--bg3);border-radius:8px;overflow:hidden;border:1px solid var(--b)}
.lb{padding:5px 11px;font-size:12px;font-weight:700;cursor:pointer;border:none;background:none;color:var(--mu);font-family:var(--fb);transition:.15s}
.lb.on{background:var(--or);color:#000}

/* BUTTONS */
.btn{font-family:var(--fb);border:none;cursor:pointer;font-size:14px;font-weight:700;
  transition:.2s;border-radius:10px;padding:9px 17px;display:inline-flex;align-items:center;gap:7px}
.bp{background:linear-gradient(135deg,var(--or),var(--or2));color:#000}
.bp:hover{transform:translateY(-1px);box-shadow:0 7px 20px rgba(255,149,0,.35)}
.bg{background:transparent;color:var(--tx);border:1px solid var(--b)}
.bg:hover{border-color:var(--b2);background:var(--bg3)}
.blg{padding:12px 24px;font-size:16px;border-radius:12px}
.bsm{padding:6px 12px;font-size:12px;border-radius:8px}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none!important;box-shadow:none!important}
.wf{width:100%}

/* INPUTS */
.fi{display:flex;flex-direction:column;gap:5px}
.fl{font-size:11px;font-weight:700;color:var(--mu);text-transform:uppercase;letter-spacing:.07em}
.inp{background:var(--bg3);border:1px solid var(--b);color:var(--tx);padding:11px 13px;
  border-radius:10px;font-family:var(--fb);font-size:14px;width:100%;outline:none;transition:.2s}
.inp:focus{border-color:rgba(255,149,0,.5);box-shadow:0 0 0 3px rgba(255,149,0,.08)}
.inp::placeholder{color:var(--mu2)}

/* HERO */
.hero{position:relative;overflow:hidden;padding:70px 24px 50px;text-align:center}
.hbg{position:absolute;inset:0;pointer-events:none}
.hglow{position:absolute;width:700px;height:500px;border-radius:50%;
  background:radial-gradient(ellipse,rgba(255,149,0,.1),transparent 65%);
  top:-80px;left:50%;transform:translateX(-50%)}
.hgrid{position:absolute;inset:0;
  background-image:linear-gradient(rgba(255,149,0,.03) 1px,transparent 1px),
  linear-gradient(90deg,rgba(255,149,0,.03) 1px,transparent 1px);background-size:40px 40px}
.hc{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:20px;max-width:860px;margin:0 auto}
.hbadge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,149,0,.1);
  border:1px solid rgba(255,149,0,.25);color:var(--or);padding:6px 16px;border-radius:999px;font-size:13px;font-weight:700}
.hero h1{font-family:var(--fh);font-size:clamp(30px,6vw,66px);font-weight:800;line-height:1.1}
.hero h1 em{font-style:normal;background:linear-gradient(135deg,var(--or),#ff3d00);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hsub{font-size:17px;color:var(--mu);max-width:560px;line-height:1.7}
.hcta{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}
.hstats{display:flex;gap:30px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.hstat strong{display:block;font-family:var(--fh);font-size:28px;font-weight:800;color:var(--or)}
.hstat span{font-size:12px;color:var(--mu)}

/* CATEGORY GRID */
.cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));
  gap:13px;padding:18px 26px 48px;max-width:1100px;margin:0 auto}
.cc{background:var(--bg2);border:1px solid var(--b);border-radius:var(--rad);
  padding:19px;cursor:pointer;transition:.2s;position:relative;overflow:hidden}
.cc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--c,var(--or));transition:.2s}
.cc:hover{border-color:rgba(255,255,255,.14);transform:translateY(-2px)}
.cc:hover::before{height:5px}
.cc-icon{font-size:28px;margin-bottom:9px}
.cc-name{font-family:var(--fh);font-size:15px;font-weight:700;margin-bottom:2px}
.cc-desc{font-size:12px;color:var(--mu)}

/* PRICING */
.psec{padding:48px 24px;max-width:860px;margin:0 auto}
.sec-t{font-family:var(--fh);font-size:32px;font-weight:800;text-align:center;margin-bottom:5px}
.sec-s{text-align:center;color:var(--mu);margin-bottom:32px}
.pgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(225px,1fr));gap:16px}
.pc{background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:26px;position:relative;transition:.2s}
.pc.hot{border-color:rgba(255,149,0,.4);box-shadow:0 0 40px rgba(255,149,0,.1)}
.htag{position:absolute;top:-11px;left:50%;transform:translateX(-50%);
  background:var(--or);color:#000;font-size:10px;font-weight:800;padding:3px 13px;border-radius:99px;white-space:nowrap}
.pn{font-family:var(--fh);font-size:16px;font-weight:700;margin-bottom:4px}
.pa{font-size:42px;font-weight:800;font-family:var(--fh);line-height:1;margin:10px 0 2px}
.pa sup{font-size:19px;vertical-align:top;margin-top:9px}
.pa small{font-size:13px;font-weight:400;color:var(--mu)}
.pf{list-style:none;margin:16px 0;display:flex;flex-direction:column;gap:8px}
.pf li{font-size:13px;color:var(--mu);display:flex;gap:7px}
.pf li::before{content:'✓';color:var(--or);font-weight:800;flex-shrink:0}

/* AUTH */
.aw{display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 65px);padding:24px}
.ab{background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:36px;width:100%;max-width:415px}
.at{font-family:var(--fh);font-size:25px;font-weight:800;margin-bottom:3px}
.as{color:var(--mu);font-size:13px;margin-bottom:24px}
.af{display:flex;flex-direction:column;gap:13px}
.div{display:flex;align-items:center;gap:11px;color:var(--mu);font-size:11px}
.div::before,.div::after{content:'';flex:1;height:1px;background:var(--b)}
.sbtn{display:flex;align-items:center;justify-content:center;gap:9px;padding:10px;
  border-radius:10px;border:1px solid var(--b);background:var(--bg3);cursor:pointer;
  font-family:var(--fb);font-size:13px;font-weight:600;color:var(--tx);transition:.2s;width:100%}
.sbtn:hover{border-color:var(--b2);background:var(--bg4)}
.asw{text-align:center;font-size:12px;color:var(--mu);margin-top:5px}
.asw button{background:none;border:none;color:var(--or);cursor:pointer;font-weight:700}

/* DASHBOARD */
.dash{display:flex;min-height:calc(100vh - 65px)}
.sid{width:205px;border-right:1px solid var(--b);padding:18px 11px;
  display:flex;flex-direction:column;gap:3px;flex-shrink:0}
.si{display:flex;align-items:center;gap:9px;padding:9px 12px;border-radius:10px;
  cursor:pointer;font-size:13px;font-weight:600;color:var(--mu);transition:.15s;border:none;background:none;width:100%;text-align:left}
.si:hover{background:var(--bg3);color:var(--tx)}
.si.on{background:rgba(255,149,0,.12);color:var(--or)}
.ssep{flex:1}
.qbox{background:rgba(255,149,0,.06);border:1px solid rgba(255,149,0,.15);border-radius:12px;padding:13px;margin-bottom:7px}
.ql{font-size:11px;color:var(--mu);margin-bottom:3px}
.qn{font-family:var(--fh);font-size:21px;font-weight:800;color:var(--or)}
.qbar{background:var(--bg3);border-radius:99px;height:5px;margin-top:7px;overflow:hidden}
.qfill{background:linear-gradient(90deg,var(--or),var(--or2));height:100%;border-radius:99px;transition:width .5s}
.main{flex:1;padding:26px;overflow-y:auto;max-width:950px}
.pt{font-family:var(--fh);font-size:23px;font-weight:800;margin-bottom:2px}
.ps{color:var(--mu);font-size:13px;margin-bottom:22px}

/* AD BANNER */
.adban{background:var(--bg3);border:1px dashed var(--b2);border-radius:11px;
  padding:14px;text-align:center;color:var(--mu2);font-size:12px;margin-bottom:16px}
.adban b{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px;color:var(--mu)}

/* CATEGORY PICKER */
.cpick{display:grid;grid-template-columns:repeat(auto-fill,minmax(145px,1fr));gap:9px;margin-bottom:18px}
.cpi{background:var(--bg3);border:1px solid var(--b);border-radius:11px;
  padding:13px;cursor:pointer;transition:.15s;text-align:center}
.cpi:hover{border-color:var(--b2)}
.cpie{font-size:22px;margin-bottom:5px}
.cpin{font-size:12px;font-weight:700}

/* QUIZ CARD */
.qc{background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:26px}
.qmeta{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.qnum{font-size:12px;color:var(--mu);font-weight:700}
.qtimer{background:var(--bg3);border-radius:8px;padding:4px 11px;font-family:var(--fh);font-size:14px;font-weight:700;color:var(--wa)}
.qprog{background:var(--bg3);border-radius:99px;height:4px;margin-bottom:18px;overflow:hidden}
.qpf{background:linear-gradient(90deg,var(--or),var(--or2));height:100%;border-radius:99px;transition:width .4s}
.qtxt{font-size:16px;font-weight:700;line-height:1.55;margin-bottom:20px;font-family:var(--fh)}
.qopts{display:flex;flex-direction:column;gap:9px}
.qo{background:var(--bg3);border:1.5px solid var(--b);border-radius:12px;
  padding:12px 15px;cursor:pointer;font-size:14px;font-weight:600;transition:.18s;
  text-align:left;color:var(--tx);width:100%;font-family:var(--fb);display:flex;align-items:center;gap:9px}
.qol{width:25px;height:25px;border-radius:7px;background:var(--bg4);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0}
.qo:hover:not(:disabled){border-color:rgba(255,149,0,.5);background:rgba(255,149,0,.06)}
.qo.correct{border-color:var(--gr)!important;background:rgba(34,197,94,.1)!important;color:var(--gr)}
.qo.wrong{border-color:var(--re)!important;background:rgba(239,68,68,.08)!important;color:var(--re)}
.qo:disabled{cursor:not-allowed}
.qexp{background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);
  border-radius:12px;padding:13px;margin-top:14px;font-size:13px;color:#93c5fd;line-height:1.6}
.qexp b{display:block;margin-bottom:4px;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.qact{display:flex;justify-content:space-between;align-items:center;margin-top:16px}

/* RESULT */
.rc{background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:34px;text-align:center}
.sring{width:115px;height:115px;margin:0 auto 18px}
.sring svg{width:100%;height:100%}
.rtit{font-family:var(--fh);font-size:26px;font-weight:800;margin-bottom:5px}
.rsub{color:var(--mu);margin-bottom:22px}
.rstats{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-bottom:22px}
.rs{background:var(--bg3);border-radius:12px;padding:14px;text-align:center}
.rs strong{display:block;font-family:var(--fh);font-size:21px;font-weight:800}
.rs span{font-size:11px;color:var(--mu)}

/* LEADERBOARD */
.lbl{display:flex;flex-direction:column;gap:7px}
.lbi{background:var(--bg2);border:1px solid var(--b);border-radius:12px;
  padding:13px 17px;display:flex;align-items:center;gap:13px}
.lbr{width:27px;font-family:var(--fh);font-size:16px;font-weight:800;text-align:center}
.lbav{width:36px;height:36px;border-radius:50%;
  background:linear-gradient(135deg,var(--or),var(--or2));
  display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#000;flex-shrink:0}
.lbn{flex:1;font-weight:700;font-size:14px}
.lbs{font-family:var(--fh);font-size:18px;font-weight:800;color:var(--or)}

/* PROGRESS */
.pgd{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:13px;margin-bottom:22px}
.pi{background:var(--bg2);border:1px solid var(--b);border-radius:var(--rad);padding:17px}
.pit{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
.pin{font-weight:700;font-size:13px}
.pip{font-family:var(--fh);font-size:17px;font-weight:800;color:var(--or)}
.pibar{background:var(--bg3);border-radius:99px;height:5px;overflow:hidden}
.pifill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--or),var(--or2));transition:width .6s}
.streak{background:linear-gradient(135deg,rgba(255,149,0,.14),rgba(255,102,0,.04));
  border:1px solid rgba(255,149,0,.23);border-radius:var(--rad);
  padding:18px;display:flex;align-items:center;gap:14px;margin-bottom:18px}
.stfire{font-size:40px}
.stnum{font-family:var(--fh);font-size:34px;font-weight:800;color:var(--or);line-height:1}
.stlbl{font-size:12px;color:var(--mu)}

/* MODAL */
.mbg{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(10px);
  z-index:300;display:flex;align-items:center;justify-content:center;padding:20px}
.mo{background:var(--bg2);border:1px solid var(--b);border-radius:20px;padding:30px;width:100%;max-width:450px}
.mt{font-family:var(--fh);font-size:21px;font-weight:800;margin-bottom:4px}
.ms{color:var(--mu);font-size:13px;margin-bottom:20px}
.pills{display:flex;gap:9px;margin-bottom:18px}
.pill{flex:1;padding:13px;border:1.5px solid var(--b);border-radius:12px;
  cursor:pointer;text-align:center;transition:.15s;background:var(--bg3)}
.pill.on{border-color:var(--or);background:rgba(255,149,0,.08)}
.pill strong{display:block;font-family:var(--fh);font-size:20px;font-weight:800}
.pill span{font-size:11px;color:var(--mu)}
.stag{background:rgba(34,197,94,.13);color:var(--gr);font-size:10px;font-weight:800;
  padding:2px 7px;border-radius:5px;display:inline-block;margin-top:3px}

/* ALERTS */
.al{padding:10px 13px;border-radius:10px;font-size:13px;margin-bottom:11px}
.al-e{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#fca5a5}
.al-w{background:rgba(255,149,0,.08);border:1px solid rgba(255,149,0,.2);color:var(--or)}
.al-i{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);color:#93c5fd}
.al-s{background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2);color:#86efac}

/* UTILS */
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:currentColor;
  border-radius:50%;animation:sp .65s linear infinite;flex-shrink:0}
@keyframes sp{to{transform:rotate(360deg)}}
.toast{position:fixed;bottom:20px;right:20px;background:var(--bg2);border:1px solid rgba(34,197,94,.3);
  color:var(--gr);padding:11px 17px;border-radius:12px;font-size:13px;font-weight:600;
  box-shadow:0 8px 30px rgba(0,0,0,.4);z-index:999;animation:su .3s ease}
@keyframes su{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
.tag{background:rgba(255,149,0,.12);color:var(--or);border:1px solid rgba(255,149,0,.2);
  padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700}
.chip{padding:3px 9px;border-radius:6px;font-size:11px;font-weight:700}
.cg{background:rgba(34,197,94,.1);color:var(--gr)}
.loading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:14px}
.loading .spin{width:34px;height:34px;border-width:3px;color:var(--or)}

@media(max-width:700px){
  .sid{display:none}
  .main{padding:15px}
  .hero h1{font-size:26px}
  .mob{display:flex!important}
  .dash{padding-bottom:68px}
}
.mob{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--bg2);
  border-top:1px solid var(--b);z-index:150;padding:7px 0}
.mob button{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  font-size:10px;font-weight:700;color:var(--mu);background:none;border:none;cursor:pointer;padding:3px}
.mob button.on{color:var(--or)}
`;

// ════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════
export default function App() {
  const [appCfg, setAppCfg] = useState(null);
  const [booting, setBooting] = useState(true);
  const [user,    setUser]    = useState(null);
  const [screen,  setScreen]  = useState("landing");
  const [tab,     setTab]     = useState("quiz");
  const [lang,    setLang]    = useState(() => LS.get("lang","en"));
  const [plan,    setPlan]    = useState(() => LS.get("plan","free"));
  const [used,    setUsed]    = useState(() => {
    const d = LS.get("today",{date:"",c:0});
    return new Date().toDateString() === d.date ? d.c : 0;
  });
  const [score,    setScore]    = useState(() => LS.get("score", 0));
  const [streak,   setStreak]   = useState(() => LS.get("streak", 0));
  const [progress, setProgress] = useState(() => LS.get("progress", {}));
  const [upgrade,  setUpgrade]  = useState(false);
  const [toast,    setToast]    = useState("");
  const fb = useRef(null);

  const T = (en, hi) => lang === "hi" ? hi : en;

  useEffect(() => {
    API.config()
      .then(cfg => {
        setAppCfg(cfg);
        return loadFirebase(cfg.firebase);
      })
      .then(f => {
        fb.current = f;
        f.onAuth(u => { setUser(u); if (u && screen === "auth") setScreen("dashboard"); });
      })
      .catch(e => console.error("Boot error:", e))
      .finally(() => setBooting(false));
  }, []);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const tick = () => {
    const today = new Date().toDateString();
    const n = used + 1; setUsed(n); LS.set("today", { date: today, c: n });
  };

  const addScore = (pts, cat) => {
    const ns = score + pts; setScore(ns); LS.set("score", ns);
    const np = { ...progress, [cat]: Math.min(100, (progress[cat]||0) + Math.round(pts/10)) };
    setProgress(np); LS.set("progress", np);
    if (pts > 0) { const s = streak+1; setStreak(s); LS.set("streak", s); }
  };

  const doUpgrade = async sel => {
    try {
      await startPayment(sel, () => {
        setPlan(sel); LS.set("plan", sel);
        setUpgrade(false); showToast("🎉 Pro ho gaye! Unlimited questions!");
      });
    } catch (e) { showToast("❌ " + e.message); }
  };

  const logout = async () => {
    if (fb.current) await fb.current.logout();
    setUser(null); setScreen("landing");
  };

  const canQ    = plan !== "free" || used < FREE_PER_DAY;
  const freeLeft = FREE_PER_DAY - used;

  if (booting) return (
    <>
      <style>{CSS}</style>
      <div className="loading">
        <div style={{fontSize:50}}>📚</div>
        <div className="spin"/>
        <div style={{color:"var(--mu)",fontSize:14}}>ExamAI load ho raha hai...</div>
      </div>
    </>
  );

  return (
    <>
      <style>{CSS}</style>
      <div>
        {/* NAV */}
        <nav className="nav">
          <div className="logo" onClick={() => setScreen(user ? "dashboard" : "landing")}>
            <div className="logo-box">📚</div>
            <span>{T("ExamAI","परीक्षा AI")}</span>
          </div>
          <div className="nav-r">
            <div className="ltog">
              <button className={`lb ${lang==="en"?"on":""}`} onClick={()=>{setLang("en");LS.set("lang","en");}}>EN</button>
              <button className={`lb ${lang==="hi"?"on":""}`} onClick={()=>{setLang("hi");LS.set("lang","hi");}}>हिं</button>
            </div>
            {user && plan==="free" && <span className="tag">⚡ {freeLeft>0?`${freeLeft} free`:T("Limit!","सीमा!")}</span>}
            {user && plan!=="free" && <span className="tag">✨ Pro</span>}
            {!user && screen!=="auth" && <button className="btn bg bsm" onClick={()=>setScreen("auth")}>{T("Login","लॉगिन")}</button>}
            {!user && <button className="btn bp bsm" onClick={()=>setScreen("auth")}>{T("Start Free","फ्री शुरू")}</button>}
            {user && plan==="free" && <button className="btn bp bsm" onClick={()=>setUpgrade(true)}>{T("Upgrade ₹99","अपग्रेड ₹99")}</button>}
            {user && <button className="btn bg bsm" onClick={logout}>{T("Logout","लॉगआउट")}</button>}
          </div>
        </nav>

        {screen==="landing"   && <Landing T={T} lang={lang} onStart={()=>setScreen(user?"dashboard":"auth")}/>}
        {screen==="auth"      && <Auth fbRef={fb} T={T} onOk={u=>{setUser(u);setScreen("dashboard");}}/>}
        {screen==="dashboard" && (
          <Dashboard tab={tab} setTab={setTab} T={T} lang={lang}
            canQ={canQ} freeLeft={freeLeft} tick={tick} plan={plan}
            score={score} streak={streak} progress={progress}
            addScore={addScore} onUpgrade={()=>setUpgrade(true)} logout={logout}
          />
        )}
        {upgrade && <UpgradeModal T={T} onClose={()=>setUpgrade(false)} onUpgrade={doUpgrade}/>}
        {toast   && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

// ── LANDING ───────────────────────────────────────────────────────────────
function Landing({ T, lang, onStart }) {
  return (
    <div>
      <div className="hero">
        <div className="hbg"><div className="hglow"/><div className="hgrid"/></div>
        <div className="hc">
          <div className="hbadge">🇮🇳 {T("India's #1 AI Exam Prep","भारत का #1 AI परीक्षा तैयारी")}</div>
          <h1>{T(<>AI se Karo <em>Govt Exam</em> Crack!</>,<>AI से करो <em>Govt Exam</em> Crack!</>)}</h1>
          <p className="hsub">{T("SSC, Banking, Railway, UPSC — AI se unlimited practice. Bilkul free shuru karo!","SSC, बैंकिंग, रेलवे, UPSC — AI से unlimited प्रैक्टिस। बिल्कुल फ्री!")}</p>
          <div className="hcta">
            <button className="btn bp blg" onClick={onStart}>🚀 {T("Free Mein Try Karo","फ्री में ट्राई करो")}</button>
            <button className="btn bg blg" onClick={onStart}>💰 {T("Pricing","प्राइसिंग")}</button>
          </div>
          <div className="hstats">
            {[["3Cr+","Students"],["8","Exam Cats"],["10","Free/Day"],["₹0","To Start"]].map(([n,l])=>(
              <div className="hstat" key={l}><strong>{n}</strong><span>{l}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className="cgrid">
        {CATS.map(c => (
          <div key={c.id} className="cc" style={{"--c":c.c}} onClick={onStart}>
            <div className="cc-icon">{c.e}</div>
            <div className="cc-name">{lang==="hi"?c.hi:c.en}</div>
            <div className="cc-desc">{c.d}</div>
          </div>
        ))}
      </div>

      <div className="psec">
        <h2 className="sec-t">{T("Simple Pricing","सरल मूल्य")}</h2>
        <p className="sec-s">{T("10 questions roz free, phir upgrade karo","10 सवाल रोज़ फ्री, फिर अपग्रेड करो")}</p>
        <div className="pgrid">
          {[
            { name:"Free",     price:"0",   feats:["10 Qs/day","8 categories","Hindi+English","Progress"] },
            { name:"Monthly",  price:"99",  per:T("/mo","/माह"), feats:["Unlimited Qs","No ads","Mock tests","Explanations"], hot:true },
            { name:"Yearly",   price:"699", per:T("/yr","/वर्ष"), feats:["All Monthly","Save ₹489","PDF notes","Priority support"], save:"Save ₹489" },
          ].map(p => (
            <div key={p.name} className={`pc ${p.hot?"hot":""}`}>
              {p.hot && <div className="htag">MOST POPULAR</div>}
              <div className="pn">{p.name}</div>
              <div className="pa"><sup>₹</sup>{p.price}<small>{p.per||""}</small></div>
              {p.save && <span className="stag">{p.save}</span>}
              <ul className="pf">{p.feats.map(f=><li key={f}>{f}</li>)}</ul>
              <button className="btn bp wf" onClick={onStart}>{T("Get Started","शुरू करो")}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── AUTH ──────────────────────────────────────────────────────────────────
function Auth({ fbRef, T, onOk }) {
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [phone,setPhone]=useState(""); const [otp,setOtp]=useState("");
  const [conf,setConf]=useState(null); const [loading,setLoading]=useState(false); const [err,setErr]=useState("");

  const emailAuth = async () => {
    setLoading(true); setErr("");
    try {
      const fn = mode==="login" ? fbRef.current.loginEmail : fbRef.current.signupEmail;
      const c = await fn(email, pass); onOk(c.user);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };
  const gAuth = async () => {
    setLoading(true); setErr("");
    try { const c = await fbRef.current.loginGoogle(); onOk(c.user); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };
  const phoneSend = async () => {
    setLoading(true); setErr("");
    try { setConf(await fbRef.current.loginPhone(phone,"rc")); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };
  const otpVerify = async () => {
    setLoading(true); setErr("");
    try { const c = await conf.confirm(otp); onOk(c.user); }
    catch(e) { setErr(e.message); }
    setLoading(false);
  };

  return (
    <div className="aw"><div className="ab">
      <div className="at">{mode==="login"?T("Welcome Back 👋","वापसी पर स्वागत 👋"):mode==="signup"?T("Join Free 🚀","जॉइन करो 🚀"):T("Phone Login 📱","फोन लॉगिन 📱")}</div>
      <div className="as">{T("India's smartest exam prep","India का smartest exam prep")}</div>
      {err && <div className="al al-e">{err}</div>}
      {mode !== "phone" ? (
        <div className="af">
          <div className="fi"><label className="fl">Email</label><input className="inp" type="email" placeholder="you@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div className="fi"><label className="fl">{T("Password","पासवर्ड")}</label><input className="inp" type="password" placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}/></div>
          <button className="btn bp blg wf" onClick={emailAuth} disabled={loading}>{loading?<><div className="spin"/>...</>:mode==="login"?T("Login","लॉगिन"):T("Create Account","अकाउंट बनाओ")}</button>
          <div className="div">{T("or","या")}</div>
          <button className="sbtn" onClick={gAuth} disabled={loading}>
            <svg width="17" height="17" viewBox="0 0 18 18"><path fill="#EA4335" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#4285F4" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/><path fill="#34A853" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
            {T("Google se Login","Google से Login")}
          </button>
          <button className="sbtn" onClick={()=>setMode("phone")}>📱 {T("Phone Number se","Phone Number से")}</button>
          <div className="asw">{mode==="login"?<>{T("Account nahi?","अकाउंट नहीं?")} <button onClick={()=>setMode("signup")}>Sign Up</button></>:<>{T("Already account hai?","पहले से है?")} <button onClick={()=>setMode("login")}>Login</button></>}</div>
        </div>
      ) : (
        <div className="af">
          {!conf ? (
            <><div className="fi"><label className="fl">{T("Phone","फोन")}</label><input className="inp" type="tel" placeholder="+91 98765 43210" value={phone} onChange={e=>setPhone(e.target.value)}/></div><div id="rc"/><button className="btn bp blg wf" onClick={phoneSend} disabled={loading}>{loading?<div className="spin"/>:T("OTP Bhejo","OTP भेजो")}</button></>
          ) : (
            <><div className="al al-i">{T("OTP sent to "+phone,"OTP भेजा "+phone)}</div><div className="fi"><label className="fl">OTP</label><input className="inp" type="text" placeholder="123456" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value)}/></div><button className="btn bp blg wf" onClick={otpVerify} disabled={loading}>{loading?<div className="spin"/>:T("Verify","वेरीफाई करो")}</button></>
          )}
          <button className="sbtn" onClick={()=>{setMode("login");setConf(null);}}>← {T("Back","वापस")}</button>
        </div>
      )}
    </div></div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function Dashboard({ tab,setTab,T,lang,canQ,freeLeft,tick,plan,score,streak,progress,addScore,onUpgrade,logout }) {
  const tabs = [
    {id:"quiz",      icon:"📝", label:T("Quiz","क्विज़")},
    {id:"progress",  icon:"📈", label:T("Progress","प्रगति")},
    {id:"leaderboard",icon:"🏆",label:T("Ranks","रैंक")},
  ];
  return (
    <div className="dash">
      <aside className="sid">
        {tabs.map(t=><button key={t.id} className={`si ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}><span>{t.icon}</span>{t.label}</button>)}
        <div className="ssep"/>
        {plan==="free" && (
          <div className="qbox">
            <div className="ql">{T("Today's Free Qs","आज के Free Qs")}</div>
            <div className="qn">{freeLeft}<span style={{fontSize:14,color:"var(--mu)"}}>/{FREE_PER_DAY}</span></div>
            <div className="qbar"><div className="qfill" style={{width:`${(freeLeft/FREE_PER_DAY)*100}%`}}/></div>
            <button className="btn bp wf" style={{marginTop:9,fontSize:12,padding:"7px 10px"}} onClick={onUpgrade}>{T("Upgrade ₹99/mo","Upgrade ₹99/mo")}</button>
          </div>
        )}
        <button className="si" onClick={logout} style={{color:"var(--re)"}}>🚪 {T("Logout","लॉगआउट")}</button>
      </aside>

      <main className="main">
        {tab==="quiz"        && <QuizTab T={T} lang={lang} canQ={canQ} freeLeft={freeLeft} tick={tick} plan={plan} addScore={addScore} onUpgrade={onUpgrade}/>}
        {tab==="progress"    && <ProgressTab T={T} lang={lang} score={score} streak={streak} progress={progress}/>}
        {tab==="leaderboard" && <LeaderboardTab T={T} score={score}/>}
      </main>

      <nav className="mob">
        {tabs.map(t=><button key={t.id} className={tab===t.id?"on":""} onClick={()=>setTab(t.id)}><span style={{fontSize:18}}>{t.icon}</span>{t.label}</button>)}
      </nav>
    </div>
  );
}

// ── QUIZ ──────────────────────────────────────────────────────────────────
function QuizTab({ T, lang, canQ, freeLeft, tick, plan, addScore, onUpgrade }) {
  const [phase,setPhase]   = useState("pick");
  const [cat,setCat]       = useState(null);
  const [qs,setQs]         = useState([]);
  const [idx,setIdx]       = useState(0);
  const [sel,setSel]       = useState(null);
  const [shown,setShown]   = useState(false);
  const [score,setScore]   = useState(0);
  const [ok,setOk]         = useState(0);
  const [timer,setTimer]   = useState(30);
  const [err,setErr]       = useState("");
  const tmr = useRef(null);

  const start = async catId => {
    if (!canQ) { onUpgrade(); return; }
    setCat(catId); setPhase("loading"); setErr("");
    try {
      const res = await API.questions(catId, lang, Math.min(5, plan==="free" ? freeLeft : 5));
      if (res.error) throw new Error(res.error);
      const list = res.questions || [];
      if (!list.length) throw new Error(T("Questions nahi mile. Dobara try karo.","Questions नहीं मिले।"));
      setQs(list); setIdx(0); setScore(0); setOk(0);
      setSel(null); setShown(false); setTimer(30); setPhase("playing");
      list.forEach(() => tick());
    } catch(e) { setErr(e.message); setPhase("pick"); }
  };

  useEffect(() => {
    if (phase !== "playing") return;
    clearInterval(tmr.current); setTimer(30);
    tmr.current = setInterval(() => setTimer(p => {
      if (p <= 1) { clearInterval(tmr.current); setShown(true); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(tmr.current);
  }, [idx, phase]);

  const pick = opt => {
    if (shown) return;
    clearInterval(tmr.current); setSel(opt); setShown(true);
    const q = qs[idx]; const isOk = opt.startsWith(q.ans);
    const pts = isOk ? (timer*10)+50 : 0;
    if (isOk) { setScore(s=>s+pts); setOk(c=>c+1); }
  };

  const next = () => {
    if (idx+1 >= qs.length) { addScore(score, cat); setPhase("result"); }
    else { setIdx(i=>i+1); setSel(null); setShown(false); }
  };

  // PICK
  if (phase === "pick") return (
    <div>
      <div className="pt">📝 {T("Quiz Shuru Karo","क्विज़ शुरू करो")}</div>
      <div className="ps">{T("Category choose karo — AI questions banayega!","Category चुनो — AI questions बनाएगा!")}</div>
      {!canQ && <div className="al al-w" style={{marginBottom:14}}>{T("⚡ Free limit khatam!","⚡ Free limit खत्म!")} <button className="btn bp bsm" style={{marginLeft:8}} onClick={onUpgrade}>Upgrade ₹99</button></div>}
      {err && <div className="al al-e" style={{marginBottom:14}}>{err}</div>}
      <div className="cpick">
        {CATS.map(c => <div key={c.id} className="cpi" onClick={()=>start(c.id)}><div className="cpie">{c.e}</div><div className="cpin">{lang==="hi"?c.hi:c.en}</div></div>)}
      </div>
      <div className="adban"><b>Advertisement</b>Google AdSense (pub-8615221630713415) banner will appear here</div>
    </div>
  );

  // LOADING
  if (phase === "loading") return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:300,gap:14}}>
      <div style={{fontSize:46}}>{CATS.find(c=>c.id===cat)?.e}</div>
      <div style={{display:"flex",alignItems:"center",gap:9,fontWeight:700}}><div className="spin" style={{width:20,height:20,borderWidth:3}}/>{T("AI questions bana raha hai...","AI questions बना रहा है...")}</div>
      <div style={{fontSize:12,color:"var(--mu)"}}>{T("5-10 seconds...","5-10 seconds...")}</div>
    </div>
  );

  // RESULT
  if (phase === "result") {
    const pct = Math.round((ok/qs.length)*100);
    const d   = 283-(283*(pct/100));
    const em  = pct>=80?"🏆":pct>=60?"🎯":"💪";
    return (
      <div className="rc">
        <div className="sring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="var(--bg3)" strokeWidth="8"/><circle cx="50" cy="50" r="45" fill="none" stroke="var(--or)" strokeWidth="8" strokeLinecap="round" strokeDasharray="283" strokeDashoffset={d} transform="rotate(-90 50 50)"/><text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fill="var(--or)" fontSize="20" fontWeight="800" fontFamily="Baloo 2">{pct}%</text></svg></div>
        <div className="rtit">{em} {T(pct>=80?"Excellent!":pct>=60?"Good Job!":"Keep Practicing!",pct>=80?"शानदार!":pct>=60?"अच्छा!":"और प्रैक्टिस करो!")}</div>
        <div className="rsub">{CATS.find(c=>c.id===cat)?.en} • {qs.length} {T("questions","सवाल")}</div>
        <div className="rstats">
          <div className="rs"><strong style={{color:"var(--gr)"}}>{ok}</strong><span>{T("Correct","सही")}</span></div>
          <div className="rs"><strong style={{color:"var(--or)"}}>{score}</strong><span>{T("Points","पॉइंट")}</span></div>
          <div className="rs"><strong style={{color:"var(--re)"}}>{qs.length-ok}</strong><span>{T("Wrong","गलत")}</span></div>
        </div>
        <div style={{display:"flex",gap:9,justifyContent:"center"}}>
          <button className="btn bp blg" onClick={()=>setPhase("pick")}>🔄 {T("Phir Khelein","फिर खेलें")}</button>
          <button className="btn bg blg" onClick={()=>start(cat)}>⚡ Same</button>
        </div>
      </div>
    );
  }

  // PLAYING
  const q = qs[idx];
  if (!q) return null;
  return (
    <div className="qc">
      <div className="qmeta"><span className="qnum">Q {idx+1}/{qs.length}</span><div className="qtimer">⏱ {timer}s</div></div>
      <div className="qprog"><div className="qpf" style={{width:`${(idx/qs.length)*100}%`}}/></div>
      <div className="qtxt">{q.q}</div>
      <div className="qopts">
        {q.opts.map((opt,i) => {
          const lt  = opt[0]; const isOk = lt===q.ans; const isSel = sel===opt;
          let cls = "qo";
          if (shown) { if (isOk) cls+=" correct"; else if (isSel) cls+=" wrong"; }
          return (
            <button key={i} className={cls} onClick={()=>pick(opt)} disabled={shown}>
              <span className="qol">{lt}</span>
              {opt.substring(2).trim()}
            </button>
          );
        })}
      </div>
      {shown && q.exp && <div className="qexp"><b>💡 {T("Explanation","व्याख्या")}</b>{q.exp}</div>}
      <div className="qact">
        <span>{shown?(sel?.startsWith(q.ans)?<span className="chip cg">+{timer*10+50} pts</span>:<span style={{color:"var(--re)"}}>✗ {T("Wrong","गलत")}</span>):""}</span>
        {shown && <button className="btn bp" onClick={next}>{idx+1>=qs.length?T("Result →","रिजल्ट →"):T("Agla →","अगला →")}</button>}
      </div>
    </div>
  );
}

// ── PROGRESS ──────────────────────────────────────────────────────────────
function ProgressTab({ T, lang, score, streak, progress }) {
  return (
    <div>
      <div className="pt">📈 {T("Meri Progress","मेरी प्रगति")}</div>
      <div className="ps">{T("Dekho kitna seekha!","देखो कितना सीखा!")}</div>
      <div className="streak">
        <div className="stfire">🔥</div>
        <div><div className="stnum">{streak}</div><div className="stlbl">Streak</div></div>
        <div style={{marginLeft:"auto",textAlign:"right"}}>
          <div style={{fontFamily:"var(--fh)",fontSize:27,fontWeight:800,color:"var(--or)"}}>{score.toLocaleString("en-IN")}</div>
          <div style={{fontSize:12,color:"var(--mu)"}}>Total Points</div>
        </div>
      </div>
      <div className="pgd">
        {CATS.map(c => {
          const pct = progress[c.id] || 0;
          return (
            <div key={c.id} className="pi">
              <div className="pit"><span className="pin">{c.e} {lang==="hi"?c.hi:c.en}</span><span className="pip">{pct}%</span></div>
              <div className="pibar"><div className="pifill" style={{width:`${pct}%`}}/></div>
            </div>
          );
        })}
      </div>
      <div style={{background:"var(--bg2)",border:"1px solid var(--b)",borderRadius:"var(--rad)",padding:18}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:13}}>📅 {T("Weekly Activity","साप्ताहिक Activity")}</div>
        <div style={{display:"flex",gap:5,alignItems:"flex-end",height:60}}>
          {["M","T","W","T","F","S","S"].map((d,i) => {
            const h = [40,75,30,90,60,85,50][i];
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{width:"100%",height:h*0.5,background:`rgba(255,149,0,${0.25+h/250})`,borderRadius:4,minHeight:3}}/>
                <div style={{fontSize:10,color:"var(--mu)"}}>{d}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── LEADERBOARD ───────────────────────────────────────────────────────────
function LeaderboardTab({ T, score }) {
  const list = [...MOCK_LB, { name:T("You 🌟","आप 🌟"), score, city:"India" }]
    .sort((a,b) => b.score-a.score);
  return (
    <div>
      <div className="pt">🏆 {T("Leaderboard","लीडरबोर्ड")}</div>
      <div className="ps">{T("Top rankers — kya tum bhi aoge?","Top rankers — क्या तुम भी आओगे?")}</div>
      <div className="lbl">
        {list.map((item,i) => (
          <div key={i} className="lbi" style={item.name.includes("🌟")?{border:"1px solid rgba(255,149,0,.3)",background:"rgba(255,149,0,.04)"}:{}}>
            <div className="lbr">{i<3?["🥇","🥈","🥉"][i]:i+1}</div>
            <div className="lbav">{item.name[0]}</div>
            <div><div className="lbn">{item.name}</div><div style={{fontSize:11,color:"var(--mu)"}}>{item.city}</div></div>
            <div className="lbs">{item.score.toLocaleString("en-IN")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── UPGRADE MODAL ─────────────────────────────────────────────────────────
function UpgradeModal({ T, onClose, onUpgrade }) {
  const [sel,setSel]         = useState("monthly");
  const [loading,setLoading] = useState(false);
  const pay = async () => {
    setLoading(true);
    try { await onUpgrade(sel); } catch {}
    setLoading(false);
  };
  return (
    <div className="mbg" onClick={onClose}>
      <div className="mo" onClick={e=>e.stopPropagation()}>
        <div className="mt">🚀 {T("Pro Ban Jao!","Pro बन जाओ!")}</div>
        <div className="ms">{T("Unlimited questions, no ads, full mock tests!","Unlimited questions, no ads, full mock tests!")}</div>
        <div className="pills">
          <div className={`pill ${sel==="monthly"?"on":""}`} onClick={()=>setSel("monthly")}><strong>₹99</strong><span>{T("/month","/महीना")}</span></div>
          <div className={`pill ${sel==="yearly"?"on":""}`} onClick={()=>setSel("yearly")}><strong>₹699</strong><span>{T("/year","/साल")}</span><div className="stag">SAVE ₹489</div></div>
        </div>
        <ul className="pf" style={{marginBottom:20}}>
          {["Unlimited daily questions","Ad-free experience","Full mock tests","Leaderboard badge"].map(f=><li key={f}>{f}</li>)}
        </ul>
        <div style={{display:"flex",gap:9,justifyContent:"flex-end"}}>
          <button className="btn bg" onClick={onClose}>{T("Baad Mein","बाद में")}</button>
          <button className="btn bp blg" onClick={pay} disabled={loading}>
            {loading ? <><div className="spin"/>Processing...</> : `💳 ₹${PLANS[sel].price} ${T("Pay Karo","भुगतान करो")} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
