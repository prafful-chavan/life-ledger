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
const VIEWS = ["dashboard", "finance", "advisor", "goals", "exercise", "habits", "career", "todo"];
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
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--no-first-run", "--no-default-browser-check", "--disable-gpu", "--hide-scrollbars", "about:blank"], { stdio: "ignore" });
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
    const saved = cards.find((c) => /SAVED/i.test(c)) || "";
    check("savings use last month's income AND last month's spending", near(parseINR(saved.split("|")[1]), expected.savedLastMonth, 1) && saved.includes(expected.savingsRatePct + "%"), saved);
    const advTotal = await cdp.eval(`LifeLedgerAdvisor.analyze(LifeLedgerApp.getAdvisorInput()).metrics.total`);
    check("advisor total equals finance total assets", near(advTotal, snap.totalAssets, 150), `advisor ${advTotal} vs ${snap.totalAssets}`);
    await view("dashboard");
    const mix = await cdp.eval(`(Array.from(document.querySelectorAll('#dashboard .panel')).find(p=>/Expense mix/.test(p.innerText))||{innerText:''}).innerText`);
    check("spelling variants of a category are merged (EMI = 25,000 in one row)", /25,000\.00/.test(mix) && !/EMI-\s/.test(mix.replace(/EMI - /g, "")), mix.replace(/\n+/g, " | ").slice(0, 200));
    await view("goals");
    const goalsText = await cdp.eval(`document.getElementById('goals').innerText`);
    check("a goal that follows mutual funds shows the live value and says so", /Follows your mutual funds automatically/i.test(goalsText) && goalsText.includes(String(expected.mfNet).replace(/(\d)(?=(\d\d)+\d$)/g, "$1,").replace(/^(\d+),(\d{3})$/, "$1,$2")), goalsText.slice(0, 200));

    // 4. Data health
    console.log("\nData health");
    const health = await cdp.eval(`(()=>{document.querySelector('#topbarMore summary').click();document.querySelector('[data-open-modal="dataHealthModal"]').click();return new Promise(r=>setTimeout(()=>r({warn:document.querySelectorAll('.dh-row.warn').length,rows:document.querySelectorAll('.dh-row').length,summary:document.querySelector('.dh-summary')&&document.querySelector('.dh-summary').innerText.replace(/\\n+/g,' | ')}),900))})()`);
    check("clean data passes every health check", health.warn === 0, JSON.stringify(health));
    await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click()`);
    await cdp.eval(`(()=>{const s=LifeLedgerApp.getState(); s.stocks[0].currentPrice=0; s.stocks[0].currentValue=0; LifeLedgerApp.renderAll(); document.querySelector('#topbarMore summary').click(); document.querySelector('[data-open-modal="dataHealthModal"]').click(); return 0})()`);
    await sleep(900);
    const broken = await cdp.eval(`Array.from(document.querySelectorAll('.dh-row.warn h3')).map(h=>h.textContent)`);
    check("a holding with no price is caught", broken.some((t) => /no price/i.test(t)) || broken.length > 0, JSON.stringify(broken));
    await cdp.eval(`document.querySelector('#dataHealthModal [data-close-modal]').click(); LifeLedgerApp.applyRemoteData(${JSON.stringify(state)}); 0`);
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
