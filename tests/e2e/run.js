#!/usr/bin/env node
/**
 * End-to-end regression check. Run it before every push:   node tests/e2e/run.js
 *
 * Starts a local copy of the app, opens it in headless Chrome (no npm packages needed), creates a THROWAWAY vault with
 * made-up data (tests/e2e/fixture.js) and checks the things that have gone wrong before:
 *   • no JavaScript errors, every page renders, nothing overflows sideways on a phone
 *   • the same net worth everywhere, rebuilt independently from the raw records
 *   • savings compare income and spending from the same month; spelling variants of a category merge
 *   • goals that follow holdings, Data health (clean data passes, deliberately broken data is caught)
 *   • heavy files load only when needed
 *   • text contrast in light and dark mode, on desktop and phone
 * It never touches your real vault: it uses its own temporary Chrome profile.
 */
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { build } = require("./fixture");

const ROOT = path.join(__dirname, "..", "..");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };
const VIEWS = ["dashboard", "finance", "advisor", "goals", "protection", "tax", "exercise", "habits", "career", "todo"];
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? "\n      " + String(detail).slice(0, 400) : ""}`); };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── tiny static server ────────────────────────────────────────────────────
function serve() {
  const requested = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    requested.push(url.pathname);
    let file = path.join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, requested })));
}

// ── minimal Chrome DevTools client ────────────────────────────────────────
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener("message", (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.pending.has(msg.id)) { const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result); }
      else if (msg.method) this.handlers.forEach((h) => h(msg));
    });
  }
  send(method, params = {}) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
  on(fn) { this.handlers.push(fn); }
  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
    return r.result.value;
  }
}

async function launchChrome() {
  const port = 9300 + Math.floor(Math.random() * 500);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ll-e2e-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", ...(process.env.CI ? ["--no-sandbox", "--disable-dev-shm-usage"] : []), "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 60; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); const page = list.find((t) => t.type === "page"); if (page) return { proc, dir, wsUrl: page.webSocketDebuggerUrl }; } catch { /* not up yet */ }
    await sleep(250);
  }
  proc.kill(); throw new Error("Chrome did not start");
}

// ── contrast scanner that runs inside the page ────────────────────────────
const SCANNER = `(${function scan() {
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const over = (t, b) => ({ r: t.r * t.a + b.r * (1 - t.a), g: t.g * t.a + b.g * (1 - t.a), b: t.b * t.a + b.b * (1 - t.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const bgOf = (el) => { const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0) { chain.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; if (!chain.length || chain[chain.length - 1].a < 1) { const bb = parse(getComputedStyle(document.body).backgroundColor); base = bb && bb.a > 0 ? bb : base; } for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base); return base; };
  const roots = [document.querySelector(".view.active"), document.querySelector(".topbar"), document.querySelector(".mobile-tabs, .tabbar")].filter(Boolean);
  const out = []; const seen = new Set();
  for (const root of roots) for (const el of root.querySelectorAll("*")) {
    if (seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (/activity-type-icon-pill|quick-act-icon/.test(String(el.className))) continue;   // emoji glyphs, not text
    let fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el);
    let op = 1; for (let n = el; n && n !== document.body; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
    fg = { ...fg, a: fg.a * op }; const f = over(fg, bg);
    const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700; const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const cr = ratio(f, bg); if (cr < need && !el.disabled) out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]} "${el.textContent.trim().slice(0, 24)}" ${cr.toFixed(2)}<${need}`);
  }
  return out;
}})()`;

(async () => {
  const { server, port, requested } = await serve();
  const base = `http://127.0.0.1:${port}/`;
  const { proc, wsUrl } = await launchChrome();
  const ws = new WebSocket(wsUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  const cdp = new CDP(ws);

  const errors = [];
  cdp.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + ((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text));
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      const t = m.params.args.map((a) => a.value || a.description || "").join(" ");
      if (!/Failed to load resource|net::ERR|ERR_INTERNET|gsi|fonts\.g/i.test(t)) errors.push("console.error: " + t);
    }
  });
  await Promise.all([cdp.send("Page.enable"), cdp.send("Runtime.enable"), cdp.send("Network.enable")]);
  const viewport = (width, height) => cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: width < 700 });
  const goto = async (url) => { await cdp.send("Page.navigate", { url }); await sleep(2500); };
  const noAnim = () => cdp.eval(`(()=>{let s=document.getElementById('__noanim');if(!s){s=document.createElement('style');s.id='__noanim';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(s)}})()`);
  const view = async (v) => { await cdp.eval(`LifeLedgerNav.goToView(${JSON.stringify(v)})`); await sleep(700); };
  const theme = async (t) => { await cdp.eval(`document.body.dataset.theme=${JSON.stringify(t)};document.documentElement.dataset.theme=${JSON.stringify(t)};0`); await sleep(250); };

  try {
    console.log("\nLife Ledger end-to-end check\n");
    await viewport(1280, 900);
    await goto(base);

    // 1. create a throwaway vault through the real screen
    console.log("Start-up");
    await cdp.eval(`(()=>{document.getElementById('setupPassword').value='e2e-throwaway-pass-1';document.getElementById('setupPasswordConfirm').value='e2e-throwaway-pass-1';document.getElementById('createVaultButton').click()})()`);
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) { await sleep(500); ready = await cdp.eval(`Boolean(window.LifeLedgerApp && document.getElementById('appShell') && !document.getElementById('appShell').classList.contains('hidden'))`); }
    check("a new vault is created and the app opens", ready);
    check("the heavy files are not loaded at start-up", !requested.some((p) => /interview-db|xlsx/.test(p)), requested.filter((p) => /interview-db|xlsx/.test(p)).join(", "));

    // 1b. Protection on a brand-new vault: the empty ₹0 rows are put in place once
    console.log("\nProtection");
    await view("protection");
    await sleep(800);
    const seeded = await cdp.eval(`({cards:document.querySelectorAll('#protectionBody .prot-card').length, empty:document.querySelectorAll('#protectionBody .prot-card.is-empty').length, state:{v:LifeLedgerApp.getState().vehicles.length,i:LifeLedgerApp.getState().insurance.length,s:LifeLedgerApp.getState().protectionSeeded}})`);
    check("first visit puts in 1 vehicle and 4 policies, all at ₹0 for you to fill", seeded.state.v === 1 && seeded.state.i === 4 && seeded.state.s && seeded.empty === 5, JSON.stringify(seeded));
    const people = await cdp.eval(`document.querySelector('#protectionBody .prot-people').innerText.split(String.fromCharCode(10)).join(' | ')`);
    check("both birth dates show an age and a birthday countdown", /Prafful[\s\S]*years old[\s\S]*turns/.test(people) && /Archana[\s\S]*years old[\s\S]*turns/.test(people) && (await cdp.eval(`[...document.querySelectorAll('[data-dob]')].map(i=>i.value).join(',')`)) === "1995-10-22,1997-05-22", people);

    // 2. load the made-up household
    const { state, expected } = build(new Date());
    // keep the day's first snapshot (made at start-up, when no gold existed) so the "first holding added later the same day" case is exercised
    state.netWorthHistory = await cdp.eval(`JSON.parse(JSON.stringify(LifeLedgerApp.getState().netWorthHistory || []))`);
    await cdp.eval(`LifeLedgerApp.applyRemoteData(${JSON.stringify(state)}); 0`);
    await sleep(1500);
    await noAnim();

    // 3. numbers
    console.log("\nNumbers");
    const snap = await cdp.eval(`LifeLedgerApp.getNetWorthSnapshot()`);
    check("gold added after the day's first snapshot is counted at weight × rate", near(snap.gold, expected.goldLive, 1), `gold: ${snap.gold} vs ${expected.goldLive}`);
    const expectedAssets = expected.assetsWithoutUs - expected.goldTyped + snap.gold + snap.usStocks;
    const expectedNW = expectedAssets - expected.liabilities;
    check("net worth equals an independent sum of the raw records", near(snap.netWorth, expectedNW), `app ${snap.netWorth} vs expected ${expectedNW}`);
    check("mutual funds count redemptions (net units × NAV)", near(snap.mutualFunds, expected.mfNet), `app ${snap.mutualFunds} vs ${expected.mfNet}`);
    // A doubled value that was locked into today's record must be recomputed once the rows are corrected (19 Oct incident)
    const relock = await cdp.eval(`(()=>{const s=LifeLedgerApp.getState(); const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}); const live=LifeLedgerApp.getNetWorthSnapshot().mutualFunds;
      let rec=(s.netWorthHistory||[]).find(e=>e.date===today); const orig=rec?JSON.stringify(rec):null; if(!rec){rec={id:'nwh-e2e',date:today}; s.netWorthHistory=[...(s.netWorthHistory||[]),rec]}
      rec.mutualFunds=live*2; rec.settled={...(rec.settled||{}),mutualFunds:true}; rec.asOf={...(rec.asOf||{}),mutualFunds:new Date(Date.now()+3600000).toISOString()}; delete rec.holdSig;
      const after=LifeLedgerApp.getNetWorthSnapshot().mutualFunds; if(orig){const i=s.netWorthHistory.findIndex(e=>e.date===today); s.netWorthHistory[i]=JSON.parse(orig)} else {s.netWorthHistory=s.netWorthHistory.filter(e=>e.id!=='nwh-e2e')}; return JSON.stringify({live,locked:live*2,after})})()`);
    const rl = JSON.parse(relock);
    check("a doubled value locked into today's record is recomputed from the current rows", near(rl.after, rl.live, 1), JSON.stringify(rl));
    if (process.env.DEBUG) { const s2 = await cdp.eval(`(()=>{const s=LifeLedgerApp.getNetWorthSnapshot(); return JSON.stringify({nw:s.netWorth,mf:s.mutualFunds,st:s.stocks,us:s.usStocks,gold:s.gold,settled:s.settled,asOf:s.asOf, rec:(LifeLedgerApp.getState().netWorthHistory||[]).map(h=>({d:h.date,nw:h.netWorth,mf:h.mutualFunds,gold:h.gold,settled:h.settled}))})})()`); console.log('SNAP-BEFORE-VIEW', s2); }
    await view("dashboard");
    const hero = await cdp.eval(`document.getElementById('heroValue').textContent`);
    if (process.env.DEBUG) console.log('HERO', hero, await cdp.eval(`JSON.stringify(LifeLedgerApp.getNetWorthSnapshot().netWorth)`));
    const parseINR = (s) => Number(String(s).replace(/[^\d.]/g, ""));
    check("dashboard net worth matches", near(parseINR(hero), snap.netWorth, 1), `${hero} vs snapshot ${snap.netWorth} (us ${snap.usStocks})`);
    await view("finance");
    const cards = await cdp.eval(`Array.from(document.querySelectorAll('#financeSummary .metric-card')).map(c=>c.innerText.replace(/\\n+/g,' | '))`);
    const fNW = cards.find((c) => /NET WORTH/i.test(c)) || "";
    check("finance net worth matches the dashboard", near(parseINR(fNW.split("|")[1]), snap.netWorth, 1), fNW);
    const saved = cards.find((c) => /SAVED|LEFT FROM/i.test(c)) || "";
    check("savings = latest salary minus this month's spending (salary lands at month end, pays next month)", near(parseINR(saved.split("|")[1]), expected.savedCycle, 1) && saved.includes(expected.savingsRatePct + "%"), saved);
    const advTotal = await cdp.eval(`LifeLedgerAdvisor.analyze(LifeLedgerApp.getAdvisorInput()).metrics.total`);
    check("advisor total equals finance total assets", near(advTotal, snap.totalAssets, 150), `advisor ${advTotal} vs ${snap.totalAssets}`);
    await view("dashboard");
    const mix = await cdp.eval(`(Array.from(document.querySelectorAll('#dashboard .panel')).find(p=>/Expense mix/.test(p.innerText))||{innerText:''}).innerText`);
    check("spelling variants of a category are merged (EMI = 25,000 in one row)", /25,000\.00/.test(mix) && !/EMI-\s/.test(mix.replace(/EMI - /g, "")), mix.replace(/\n+/g, " | ").slice(0, 200));
    await view("goals");
    const goalsText = await cdp.eval(`document.getElementById('goals').innerText`);
    check("a goal that follows mutual funds shows the live value and says so", /Follows your mutual funds automatically/i.test(goalsText) && goalsText.includes(String(expected.mfNet).replace(/(\d)(?=(\d\d)+\d$)/g, "$1,").replace(/^(\d+),(\d{3})$/, "$1,$2")), goalsText.slice(0, 200));

    // 3b. Protection with data: totals, renewals, adding a policy, marking one paid
    await view("protection");
    await sleep(800);
    const prot = JSON.parse(await cdp.eval(`(()=>{const stats=[...document.querySelectorAll('#protectionBody .prot-stat')].map(s=>s.innerText.split(String.fromCharCode(10)).join(' | ')); return JSON.stringify({stats:stats, hasAlert:!!document.querySelector('#protectionBody .prot-alert'), text:document.getElementById('protectionBody').innerText})})()`));
    check("vehicle value, yearly premiums and renewals-soon add up", /Vehicles worth \| ₹1,00,000/i.test(prot.stats[0]) && /₹42,000/.test(prot.stats[1]) && /Renewals soon \| 1/i.test(prot.stats[2]) && prot.hasAlert, JSON.stringify(prot.stats));
    check("term cover below/above the 10–15× guide is judged (₹3 crore is in the guide)", /Term life · Prafful[\s\S]*In the guide/.test(prot.text), prot.text.slice(0, 200));
    const before = await cdp.eval(`LifeLedgerApp.getState().insurance.length`);
    await cdp.eval(`(()=>{document.querySelector('#protectionBody [data-act="add"][data-kind="insurance"]').click(); const f=document.getElementById('protectionForm'); f.querySelector('[name=type]').value='Accident'; f.querySelector('[name=insurer]').value='Test Insurer'; f.querySelector('[name=cover]').value='500000'; f.querySelector('[name=premium]').value='1000'; f.querySelector('[name=frequency]').value='Monthly'; f.querySelector('[name=nextDue]').value='2030-01-31'; f.requestSubmit(); return 0})()`);
    await sleep(700);
    const added = await cdp.eval(`({n:LifeLedgerApp.getState().insurance.length, shown:document.getElementById('protectionBody').innerText.includes('Test Insurer'), closed:document.getElementById('protectionModal').hidden})`);
    check("adding a policy saves it, shows it and closes the dialog", added.n === before + 1 && added.shown && added.closed, JSON.stringify(added));
    await cdp.eval(`(()=>{const id=LifeLedgerApp.getState().insurance.find(p=>p.insurer==='Test Insurer').id; document.querySelector('[data-act="paid"][data-id="'+id+'"]').click(); return 0})()`);
    await sleep(500);

    // 3c. Tax page: tabs, plan numbers, audit of a filed return, family money, data round-trip
    await view("tax");
    await sleep(900);
    const tax = JSON.parse(await cdp.eval(`(()=>{const b=document.getElementById('taxBody'); return JSON.stringify({tabs:[...b.querySelectorAll('.tax-tab')].map(t=>t.innerText), text:b.innerText, stats:b.querySelectorAll('.prot-stat').length})})()`));
    check("tax page shows its six tabs and the two people", tax.tabs.join(",") === "Today,Plan,Returns,Family money,Rules,Data" && tax.stats >= 2 && /Prafful/.test(tax.text) && /Archana/.test(tax.text), JSON.stringify(tax.tabs));
    check("tax page lists what to do next, including a user checklist item", /What to do next/.test(tax.text) && /Make a will/.test(tax.text), tax.text.slice(0, 300));
    await cdp.eval(`document.querySelector('[data-tax-tab="plan"]').click()`); await sleep(300);
    const plan = await cdp.eval(`document.getElementById('taxBody').innerText`);
    check("plan compares both regimes with rupee amounts", /new regime/i.test(plan) && /old regime/i.test(plan) && /ways to pay less/i.test(plan) && /₹[\d,]+/.test(plan), plan.slice(0, 300));
    await cdp.eval(`(()=>{const i=document.querySelector('[data-tax-field="employerNps"][data-who="Me"]'); i.value='120000'; i.dispatchEvent(new Event('change',{bubbles:true})); return 0})()`); await sleep(400);
    check("changing an input saves it to the vault state", (await cdp.eval(`LifeLedgerApp.getState().taxProfile.employerNps.Me`)) === 120000);
    await cdp.eval(`document.querySelector('[data-tax-tab="returns"]').click()`); await sleep(300);
    const rets = await cdp.eval(`document.getElementById('taxBody').innerText`);
    check("returns tab flags the unsupported claims and the unfiled year", /Exempt allowances above Form 16/i.test(rets) && /Employer NPS \(80CCD\(2\)\) without an NPS contribution/i.test(rets) && /No return filed/.test(rets), rets.slice(0, 400));
    await cdp.eval(`(()=>{const c=document.querySelector('[data-tax-file="form16"]'); c.click(); return 0})()`); await sleep(400);
    check("ticking a filing-checklist item saves it", Boolean((await cdp.eval(`(LifeLedgerApp.getState().taxProfile.filingDone||{})[Object.keys(LifeLedgerApp.getState().taxProfile.filingDone||{})[0]]`)||{}).form16));
    await cdp.eval(`document.querySelector('[data-tax-tab="family"]').click()`); await sleep(300);
    const fam = await cdp.eval(`document.getElementById('taxBody').innerText`);
    check("family money explains the pre-wedding transfer", /before the wedding/i.test(fam), fam.slice(0, 300));
    await cdp.eval(`(()=>{const f=document.getElementById('taxFamilyForm'); f.querySelector('[name=date]').value='2025-01-10'; f.querySelector('[name=amount]').value='200000'; f.querySelector('[name=relation]').value='parent'; f.requestSubmit(); return 0})()`); await sleep(500);
    check("adding a transfer saves it", (await cdp.eval(`LifeLedgerApp.getState().taxFamily.length`)) === 2 && /parent/i.test(await cdp.eval(`document.getElementById('taxBody').innerText`)));
    await cdp.eval(`document.querySelector('[data-tax-tab="rules"]').click()`); await sleep(300);
    check("rules tab shows sources and flags rules that rest on commentary", /Commentary: confirm/.test(await cdp.eval(`document.getElementById('taxBody').innerText`)));
    await cdp.eval(`document.querySelector('[data-tax-tab="data"]').click()`); await sleep(300);
    check("data tab shows counts and import/export", /Import tax data/.test(await cdp.eval(`document.getElementById('taxBody').innerText`)) && (await cdp.eval(`!!document.getElementById('taxExport')`)));
    if (process.env.TAX_SHOTS) {   // optional: save pictures of the tax page (made-up data) for a visual check
      for (const [w, h, label] of [[1280, 1000, "desktop"], [430, 932, "phone"]]) {
        await viewport(w, h); await sleep(500);
        for (const t of ["today", "plan", "returns", "family"]) {
          await cdp.eval(`document.querySelector('[data-tax-tab="${t}"]').click()`); await sleep(400);
          const shot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
          fs.writeFileSync(path.join(process.env.TAX_SHOTS, `tax-${t}-${label}.png`), Buffer.from(shot.data, "base64"));
        }
      }
      await viewport(1280, 900); await sleep(300);
    }
    await cdp.eval(`document.querySelector('[data-tax-tab="today"]').click()`); await sleep(200);
    const paid = await cdp.eval(`LifeLedgerApp.getState().insurance.find(p=>p.insurer==='Test Insurer').nextDue`);
    check("“Mark paid” moves a monthly premium on by a month (31 Jan → 28 Feb)", paid === "2030-02-28", paid);
    await cdp.eval(`(()=>{const id=LifeLedgerApp.getState().insurance.find(p=>p.insurer==='Test Insurer').id; window.confirm=()=>true; document.querySelector('[data-act="delete"][data-id="'+id+'"]').click(); return 0})()`);
    await sleep(400);
    check("deleting it removes it again", (await cdp.eval(`LifeLedgerApp.getState().insurance.length`)) === before);

    // 4. Data health
    console.log("\nData health");
    const health = await cdp.eval(`(()=>{document.querySelector('#topbarMore summary').click();document.querySelector('[data-open-modal="dataHealthModal"]').click();return new Promise(r=>setTimeout(()=>r({warn:document.querySelectorAll('.dh-row.warn').length,rows:document.querySelectorAll('.dh-row').length,summary:document.querySelector('.dh-summary')&&document.querySelector('.dh-summary').innerText.replace(/\\n+/g,' | ')}),900))})()`);
    check("clean data passes every health check", health.warn === 0, JSON.stringify(health));
    // dismissing a note hides it, keeps it out of the counts, and can be undone
    const dis = await cdp.eval(`(async()=>{const q=()=>[...document.querySelectorAll('.dh-row h3')].map(h=>h.textContent); const before=q().length; const btn=document.querySelector('.dh-dismiss'); if(!btn) return {noNote:true}; const title=btn.closest('.dh-row').querySelector('h3').textContent; btn.click(); await new Promise(r=>setTimeout(r,500)); const after=q(); const hidden=!after.includes(title)&&after.length===before-1; const toggle=document.getElementById('dhToggleDismissed'); toggle&&toggle.click(); await new Promise(r=>setTimeout(r,300)); const shown=q().includes(title); const undo=document.querySelector('.dh-row.snoozed .dh-dismiss'); undo&&undo.click(); await new Promise(r=>setTimeout(r,400)); const back=q().includes(title)&&!document.getElementById('dhToggleDismissed'); return {hidden,shown,back,title}})()`);
    check("a note can be dismissed, shown again, and restored", dis.hidden && dis.shown && dis.back, JSON.stringify(dis));
    await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click()`);
    await cdp.eval(`(()=>{const s=LifeLedgerApp.getState(); s.stocks[0].currentPrice=0; s.stocks[0].currentValue=0; LifeLedgerApp.renderAll(); document.querySelector('#topbarMore summary').click(); document.querySelector('[data-open-modal="dataHealthModal"]').click(); return 0})()`);
    await sleep(900);
    const broken = await cdp.eval(`Array.from(document.querySelectorAll('.dh-row.warn h3')).map(h=>h.textContent)`);
    check("a holding with no price is caught", broken.some((t) => /no price/i.test(t)) || broken.length > 0, JSON.stringify(broken));
    await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click(); LifeLedgerApp.applyRemoteData(${JSON.stringify(state)}); 0`);
    await sleep(800);

    // 4b. Doubled holdings (the 19 Oct incident): flagged with a one-tap fix that keeps one copy of each lot
    await cdp.eval(`(()=>{const s=LifeLedgerApp.getState(); window.__mfBefore=s.mutualFunds.length; const lots=Array.from({length:12},(_,i)=>({id:'mf-e2e-'+i,fundName:'E2E Fund '+i,owner:'Me',demat:'G',transactionType:'PURCHASE',units:10+i,nav:10,invested:100+i,purchaseDate:'2025-01-01',date:'2025-01-01',latestNav:10,currentValue:100+i})); s.mutualFunds.push(...lots, ...lots.map(l=>({...l,id:l.id+'-copy'}))); LifeLedgerApp.renderAll(); document.querySelector('#topbarMore summary').click(); document.querySelector('[data-open-modal="dataHealthModal"]').click(); return 0})()`);
    await sleep(1200);
    const dup = JSON.parse(await cdp.eval(`JSON.stringify({warn:[...document.querySelectorAll('.dh-row.warn h3')].map(h=>h.textContent), btn:!!document.querySelector('.dh-action[data-dh-action="remove-duplicate-holdings"]')})`));
    check("doubled holdings are flagged as something to fix, with a one-tap button", dup.warn.some((t) => /appear twice/i.test(t)) && dup.btn, JSON.stringify(dup));
    await cdp.eval(`(()=>{window.confirm=()=>true; document.querySelector('.dh-action[data-dh-action="remove-duplicate-holdings"]').click(); return 0})()`);
    await sleep(2000);
    const fixedDup = JSON.parse(await cdp.eval(`JSON.stringify({n:LifeLedgerApp.getState().mutualFunds.length, before:window.__mfBefore, stillWarn:[...document.querySelectorAll('.dh-row.warn h3')].map(h=>h.textContent)})`));
    check("one tap keeps one copy of each lot and clears the warning", fixedDup.n === fixedDup.before + 12 && !fixedDup.stillWarn.some((t) => /appear twice/i.test(t)), JSON.stringify(fixedDup));
    await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click(); LifeLedgerApp.applyRemoteData(${JSON.stringify(state)}); 0`);
    await sleep(800);

    // 4c. Sync Holdings preview: a sheet that would wipe the stocks and most funds asks first; "No" changes nothing
    console.log("\nSync Holdings preview");
    await cdp.eval(fs.readFileSync(path.join(ROOT, "node_modules", "xlsx", "dist", "xlsx.full.min.js"), "utf8") + "; 0");   // the page's spreadsheet reader
    const sh = JSON.parse(await cdp.eval(`(async()=>{
      const sleep=(ms)=>new Promise((r)=>setTimeout(r,ms));
      const s0=LifeLedgerApp.getState(); const before={mf:s0.mutualFunds.length, st:s0.stocks.length};
      const rows=s0.mutualFunds.slice(0,3).map((m)=>({'Scheme Name':m.fundName,'Transaction Type':m.transactionType==='REDEMPTION'?'REDEEM':'PURCHASE','Units':m.units,'NAV':m.nav,'Amount':m.invested,'Date':m.purchaseDate||m.date,'Owner (Me / Wife)':m.owner==='Wife'?'Wife':'Me'}));
      const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '6. Mutual fund of my');
      const buffer=XLSX.write(wb,{type:'array',bookType:'xlsx'});
      window.LifeLedgerDrive={...(window.LifeLedgerDrive||{}), isConnected:()=>true, downloadMasterHoldingsFile: async()=>({buffer, filename:'test.xlsx', modifiedTime:'now'})};
      const asked=[]; window.confirm=(m)=>{asked.push(m); return false};
      document.querySelector('.sync-holdings-btn').click(); await sleep(2500);
      const afterNo={mf:LifeLedgerApp.getState().mutualFunds.length, st:LifeLedgerApp.getState().stocks.length};
      window.confirm=(m)=>{asked.push(m); return true};
      document.querySelector('.sync-holdings-btn').click(); await sleep(5000);
      const afterYes={mf:LifeLedgerApp.getState().mutualFunds.length, st:LifeLedgerApp.getState().stocks.length};
      return JSON.stringify({before, afterNo, afterYes, asked:asked.map((a)=>a.slice(0,400))});
    })()`));
    check("a sheet that would empty the stocks asks first, and says why", sh.asked.length >= 2 && /bigger change than usual/i.test(sh.asked[0]) && /the sheet has none, but you hold/i.test(sh.asked[0]), JSON.stringify(sh.asked[0]));
    check("answering No changes nothing", sh.afterNo.mf === sh.before.mf && sh.afterNo.st === sh.before.st && sh.before.st > 0, JSON.stringify(sh));
    check("answering Yes applies the sheet", sh.afterYes.st === 0 && sh.afterYes.mf === 3, JSON.stringify(sh.afterYes));
    await cdp.eval(`LifeLedgerApp.applyRemoteData(${JSON.stringify(state)}); 0`);
    await sleep(800);

    // 5. lazy loading
    console.log("\nLoading");
    await view("career");
    await cdp.eval(`Array.from(document.querySelectorAll('#career > .tabs button')).find(b=>/Interview Prep/.test(b.textContent)).click()`);
    await sleep(2500);
    const q = await cdp.eval(`window.LifeLedgerInterviewQuestions ? window.LifeLedgerInterviewQuestions.length : 0`);
    check("the interview question bank loads when Career opens", q > 100, "questions: " + q);
    const x = await cdp.eval(`(()=>{document.querySelector('#topbarMore summary').click(); document.querySelector('[data-open-modal="importModal"]').click(); return new Promise(r=>{let n=0;const t=setInterval(()=>{n++;if(typeof window.XLSX!=='undefined'&&typeof window.XLSX.read==='function'){clearInterval(t);r(true)}else if(n>40){clearInterval(t);r(false)}},500)})})()`).catch(() => false);
    check("the spreadsheet reader loads when the import dialog opens (needs internet)", x || process.env.OFFLINE === "1", "skipped if offline: OFFLINE=1");
    await cdp.eval(`document.querySelector('#importModal [data-close-modal]') && document.querySelector('#importModal [data-close-modal]').click(); 0`);

    // 6. every page, both widths: renders, no sideways overflow, readable
    // A real finger tap on ⋯ (a scripted .click() hid this bug before): the menu must be visible and its items tappable
    await viewport(440, 956); await sleep(500); await view("dashboard");
    await cdp.eval(`window.scrollTo(0,0)`);
    const pt = await cdp.eval(`(()=>{const r=document.querySelector('#topbarMore > summary').getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}})()`);
    const tap = async (x, y) => { for (const type of ["mousePressed", "mouseReleased"]) await cdp.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); await sleep(500); };
    await tap(pt.x, pt.y);
    const menu = await cdp.eval(`(()=>{const d=document.getElementById('topbarMore');const items=[...document.querySelectorAll('.topbar-menu .menu-item')].filter(b=>b.offsetParent!==null||getComputedStyle(b).display!=='none').map(b=>{const r=b.getBoundingClientRect();if(!r.width)return null;const t=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {t:b.textContent.trim().slice(0,18),ok:t===b||b.contains(t),x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}}).filter(Boolean);return {open:d.open,items}})()`);
    const onTop = await cdp.eval(`(()=>{const m=document.querySelector('.topbar-menu');return m.parentElement===document.body&&Number(getComputedStyle(m).zIndex)>=1000})()`);
    check("phone: the ⋯ menu is drawn above the whole page (iPhone Safari painted the page over it)", onTop);
    check("phone: tapping ⋯ opens a menu you can see and tap", menu.open && menu.items.length >= 4 && menu.items.every((i) => i.ok), JSON.stringify(menu));
    const dh = menu.items.find((i) => /Data health/.test(i.t));
    if (dh) { await tap(dh.x, dh.y); const opened = await cdp.eval(`!document.getElementById('dataHealthModal').hidden`); check("phone: tapping 'Data health' in that menu opens it", opened); await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click()`); }
    // dialogs on a phone: the last button must be tappable (the bottom tab bar used to cover it)
    for (const [name, opener] of [["Settings", `document.getElementById('settingsButton').click()`], ["Add expense", `document.querySelector('[data-open-modal="quickAddModal"]').click()`]]) {
      const lastBtn = await cdp.eval(`(async()=>{${opener}; await new Promise(r=>setTimeout(r,700)); const m=[...document.querySelectorAll('.modal')].find(x=>!x.hidden); if(!m) return {noModal:true}; const card=m.querySelector('.modal-card')||m; card.scrollTop=card.scrollHeight; await new Promise(r=>setTimeout(r,400)); const bs=[...card.querySelectorAll('button')].filter(b=>b.offsetParent&&!b.hasAttribute('data-close-modal')); const b=bs[bs.length-1]; const r=b.getBoundingClientRect(); const t=document.elementFromPoint(r.left+r.width/2,Math.min(r.top+r.height/2,innerHeight-1)); const res={last:b.textContent.trim().slice(0,20),hit:t===b||b.contains(t),by:(t&&(t.className||t.tagName)+'').slice(0,30)}; const c=m.querySelector('[data-close-modal]'); c&&c.click(); return res})()`);
      check(`phone: the last button in the ${name} dialog can be tapped`, lastBtn.hit, JSON.stringify(lastBtn));
    }
    await viewport(1280, 900); await sleep(400);

    for (const [w, h, label] of [[1280, 900, "desktop"], [440, 956, "phone"]]) {
      console.log(`\nPages at ${label} width (${w}px)`);
      await viewport(w, h); await sleep(600);
      for (const v of VIEWS) {
        await view(v);
        const m = await cdp.eval(`({sw:document.documentElement.scrollWidth,w:innerWidth,text:(document.querySelector('.view.active')||{innerText:''}).innerText.length})`);
        check(`${v}: renders and fits the screen`, m.text > 40 && m.sw <= m.w + 1, JSON.stringify(m));
      }
      for (const t of ["light", "dark"]) {
        await theme(t);
        let bad = [];
        for (const v of VIEWS) { await view(v); bad = bad.concat((await cdp.eval(SCANNER)).map((s) => `${v}: ${s}`)); }
        check(`text is readable in ${t} mode (${label})`, bad.length === 0, bad.slice(0, 5).join(" ; "));
      }
      await theme("light");
    }

    check("no JavaScript errors during the whole run", errors.length === 0, errors.slice(0, 4).join(" ; "));
  } catch (e) {
    check("the check itself ran to the end", false, e.stack || e.message);
  } finally {
    try { ws.close(); } catch { /* closed */ }
    proc.kill(); server.close();
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? ` — ${failed.length} FAILED` : ""}\n`);
  process.exit(failed.length ? 1 : 0);
})();
