#!/usr/bin/env node
/**
 * iPhone-engine check:   node tests/e2e/webkit.js
 * Runs the app in WebKit (the engine inside iPhone Safari) with an iPhone 15 Pro Max profile and real touch taps,
 * because several phone-only bugs (menu clipped / drawn under the page, tab bar covering dialog buttons) never showed in Chrome.
 * Needs Playwright + its WebKit once:  npm install playwright && npx playwright install webkit   (set PW_DIR to that folder).
 * Uses a throwaway vault with made-up data; never touches your real vault.
 */
const path = require("path"), fs = require("fs"), http = require("http");
const ROOT = path.join(__dirname, "..", "..");
const PW_DIR = process.env.PW_DIR || "/private/tmp/claude-501/-Users-praffulchavan-Documents-Life-Ledger/c645ff55-790e-4f56-8396-90a5bbe211cb/scratchpad/pw";
let pw; try { pw = require(require.resolve("playwright", { paths: [PW_DIR, process.cwd()] })); } catch { console.log("Playwright is not installed (see the header of this file). Skipped."); process.exit(0); }
const { build } = require("./fixture");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };
const results = []; const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "  ✓" : "  ✗"} ${name}${!ok && detail ? "\n      " + String(detail).slice(0, 300) : ""}`); };
const VIEWS = ["dashboard", "finance", "advisor", "goals", "exercise", "habits", "career", "todo"];

(async () => {
  const server = http.createServer((req, res) => { const u = new URL(req.url, "http://x"); const f = path.join(ROOT, decodeURIComponent(u.pathname === "/" ? "/index.html" : u.pathname)); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" }); fs.createReadStream(f).pipe(res); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const browser = await pw.webkit.launch(); const ctx = await browser.newContext({ ...pw.devices["iPhone 15 Pro Max"] }); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  try {
    console.log("\niPhone (WebKit) check\n");
    await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2000);
    await page.evaluate(() => { document.getElementById("setupPassword").value = "e2e-throwaway-pass-1"; document.getElementById("setupPasswordConfirm").value = "e2e-throwaway-pass-1"; document.getElementById("createVaultButton").click(); });
    await page.waitForFunction(() => window.LifeLedgerApp && !document.getElementById("appShell").classList.contains("hidden"), null, { timeout: 30000 });
    await page.evaluate((s) => LifeLedgerApp.applyRemoteData(s), build(new Date()).state); await page.waitForTimeout(2500);
    await page.addStyleTag({ content: "*{animation-duration:0s!important;transition:none!important}" });
    const go = async (v) => { await page.evaluate((v) => LifeLedgerNav.goToView(v), v); await page.waitForTimeout(500); await page.evaluate(() => window.scrollTo(0, 0)); };

    await go("dashboard");
    await page.tap("#topbarMore > summary"); await page.waitForTimeout(400);
    const menu = await page.evaluate(() => { const m = document.querySelector(".topbar-menu"); const items = [...m.querySelectorAll(".menu-item")].filter((b) => b.getBoundingClientRect().width).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b === t || b.contains(t); }); return { top: m.parentElement === document.body, n: items.length, all: items.every(Boolean) }; });
    check("the ⋯ menu is drawn above the page and every item can be tapped", menu.top && menu.n >= 4 && menu.all, JSON.stringify(menu));
    await page.tap("body", { position: { x: 15, y: 700 } }); await page.waitForTimeout(300);

    const tab = await page.evaluate(() => { const c = getComputedStyle(document.querySelector(".mobile-tabs")).backgroundColor.match(/[\d.]+/g).map(Number); return { alpha: c.length > 3 ? c[3] : 1 }; });
    check("the bottom tab bar is solid (page content cannot ghost through it)", tab.alpha === 1, JSON.stringify(tab));

    const hero = await page.evaluate(() => { const r = document.getElementById("heroCard").getBoundingClientRect(); return { top: Math.round(r.top), vh: innerHeight }; });
    check("the net worth card starts in the top half of the first screen", hero.top < hero.vh * 0.5, JSON.stringify(hero));

    for (const [name, opener] of [["Settings", () => document.getElementById("settingsButton").click()], ["Add expense", () => document.querySelector('[data-open-modal="quickAddModal"]').click()]]) {
      await page.evaluate(opener); await page.waitForTimeout(700);
      const last = await page.evaluate(async () => { const m = [...document.querySelectorAll(".modal")].find((x) => !x.hidden); const card = m.querySelector(".modal-card") || m; card.scrollTop = card.scrollHeight; await new Promise((r) => setTimeout(r, 300)); const bs = [...card.querySelectorAll("button")].filter((b) => b.offsetParent && !b.hasAttribute("data-close-modal")); const b = bs[bs.length - 1]; const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, Math.min(r.top + r.height / 2, innerHeight - 1)); const ok = b === t || b.contains(t); m.querySelector("[data-close-modal]").click(); return { text: b.textContent.trim().slice(0, 16), ok }; });
      check(`the last button in the ${name} dialog can be tapped`, last.ok, JSON.stringify(last));
    }

    const wide = [];
    for (const v of VIEWS) { await go(v); const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth, txt: document.querySelector(".view.active").innerText.length })); if (m.sw > m.w + 1 || m.txt < 40) wide.push(v + ":" + JSON.stringify(m)); }
    check("every page renders and fits the width", wide.length === 0, wide.join(" ; "));
    check("no JavaScript errors (other than blocked third-party price relays)", errs.filter((e) => !/allorigins|codetabs|access control/i.test(e)).length === 0, errs.join(" ; "));
  } catch (e) { check("the check ran to the end", false, e.stack || e.message); }
  await browser.close(); server.close();
  const failed = results.filter((x) => !x).length; console.log(`\n${results.length - failed}/${results.length} iPhone checks passed${failed ? ` — ${failed} FAILED` : ""}\n`); process.exit(failed ? 1 : 0);
})();
