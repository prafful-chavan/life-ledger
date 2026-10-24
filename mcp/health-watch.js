/**
 * Life Ledger MCP — "is everything still working?" (pure).
 *
 * check(input) → { items, problems, status }   render(result, { today }) → { subject, html, text, send, kind }
 *
 * Looks at the things that fail quietly: the cloud copy, the price sources, holdings without a price, days missing from
 * the net-worth history, repeated rows, the weekly INDmoney check, the monthly tax-law check and the tax engine's
 * reference cases. Each finding says what it is, why it matters and what to do. A scheduled task emails the result only
 * when something needs attention, plus a short "all healthy" note on Sundays.
 */
const { kit } = require("./brief-render.js");
const { card, chip, h2, small, wrap, sealed, esc, dateLong, daysBetween } = kit;

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const dayOfWeek = (iso) => new Date(iso + "T00:00:00Z").getUTCDay();   // 0 Sunday … 6 Saturday
const isoOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const hrs = (n) => (n >= 48 ? `${Math.round(n / 24)} days` : Math.round(n) === 1 ? "1 hour" : `${Math.round(n)} hours`);

/** Prices are expected to be fresh on a working day; over a weekend or on Monday morning they can be ~3 days old. */
function priceLimitHours(today) { const d = dayOfWeek(today); return d === 0 || d === 6 || d === 1 ? 84 : 40; }

function check(input) {
  const { state = {}, today, nowMs = Date.now(), fresh = {}, integrity = { alerts: [] }, lawWatch = {}, holdingsCheck = null, taxCases = null, source = {} } = input;
  const items = [];
  const add = (id, level, title, detail, action) => items.push({ id, level, title, detail, action: action || "" });

  // 1. The cloud copy: did this run read the live vault, and when did any device last save?
  if (source.fromCache) {
    add("cloud", "fail", "The cloud copy could not be reached", `This check used the saved copy from ${source.cachedAt ? dateLong(String(source.cachedAt).slice(0, 10)) : "an earlier day"}${source.reason ? ` (${String(source.reason).slice(0, 80)})` : ""}.`, "Open the app once and use Settings → Sync now. If it says offline, the Apps Script web app may need to be redeployed.");
  } else {
    add("cloud", "ok", "Cloud copy reachable", "The latest vault was read from the cloud.");
    if (source.updatedAt) {
      const age = (nowMs - Date.parse(source.updatedAt)) / 3600000;
      if (age > 24 * 7) add("last-save", "warn", "No device has saved for a week", `The newest save was ${hrs(age)} ago. Prices only refresh when the app is opened.`, "Open the app on any device so prices and the daily record update.");
      else add("last-save", "ok", "A device saved recently", `The newest save was ${hrs(age)} ago.`);
    }
  }

  // 2. Price sources
  const limit = priceLimitHours(today);
  for (const [key, label, be] of [["mutualFundsHoursOld", "Mutual fund NAVs", "are"], ["stocksHoursOld", "Indian share prices", "are"], ["usStocksHoursOld", "US share prices", "are"], ["goldHoursOld", "The gold rate", "is"]]) {
    const h = fresh[key];
    if (h == null) { if (key !== "goldHoursOld") add("price-" + key, "warn", `${label} ${be === "is" ? "has" : "have"} no date`, "No price time is recorded, so their age cannot be judged.", "Open the app and press Refresh prices."); continue; }
    if (h > limit * (key === "goldHoursOld" ? 1.5 : 1)) add("price-" + key, "warn", `${label} ${be} ${hrs(h)} old`, `They normally refresh whenever the app is open. Older than ${hrs(limit)} on ${dayOfWeek(today) === 1 || dayOfWeek(today) === 0 || dayOfWeek(today) === 6 ? "a weekend" : "a working day"} means a source failed or the app was not opened.`, "Open the app and press Refresh prices. If one source stays old, tell me which.");
    else add("price-" + key, "ok", `${label} ${be} fresh`, `${hrs(h)} old.`);
  }

  // 3. Holdings without a price (a purchase that never got priced is silently valued at cost or zero)
  const noPriceStocks = (state.stocks || []).filter((s) => num(s.quantity) > 0 && !(num(s.currentPrice) > 0));
  const noPriceUs = (state.usstocks || []).filter((s) => num(s.quantity) > 0 && !(num(s.currentPrice) > 0));
  const funds = new Map();
  for (const t of state.mutualFunds || []) { const k = (t.fundName || "?") + "|" + (t.owner || "Me"); const f = funds.get(k) || { units: 0, nav: 0 }; f.units += (/^red/i.test(String(t.transactionType || "")) ? -1 : 1) * num(t.units); if (num(t.latestNav) > 0) f.nav = num(t.latestNav); funds.set(k, f); }
  const noNav = [...funds.entries()].filter(([, f]) => f.units > 0.001 && !(f.nav > 0)).map(([k]) => k.split("|")[0]);
  const missing = [...noPriceStocks.map((s) => s.symbol || s.company), ...noPriceUs.map((s) => s.symbol), ...noNav];
  if (missing.length) add("no-price", "warn", `${missing.length} holding${missing.length === 1 ? " has" : "s have"} no price`, `${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}. Net worth counts them wrongly until they are priced.`, "Check the symbol or scheme code in the app (edit the holding), then Refresh prices.");
  else add("no-price", "ok", "Every holding has a price", "No share, US share or fund is missing a price.");

  // 4. Net worth history: a working day with no record is a hole in every chart
  const hist = new Set((state.netWorthHistory || []).map((h) => h.date));
  const holes = [];
  for (let i = 1; i <= 7; i++) { const d = isoOf(Date.parse(today + "T00:00:00Z") - i * 864e5), w = dayOfWeek(d); if (w !== 0 && w !== 6 && !hist.has(d)) holes.push(d); }
  if (holes.length) add("history", "warn", `${holes.length} working day${holes.length === 1 ? "" : "s"} missing from the net worth history`, `${holes.slice(0, 4).map(dateLong).join(", ")}. The app records a day only when it is opened.`, "Nothing to fix for past days; the app fills some from price records. Open it daily to avoid new gaps.");
  else add("history", "ok", "Net worth history has no gaps", "Every working day in the last week has a record.");

  // 5. Data integrity (repeated rows, unexplained jumps)
  for (const a of integrity.alerts || []) add("integrity-" + a.topic, a.level === "critical" ? "fail" : "warn", a.topic || "Data check", a.text, a.level === "critical" ? "Do not trust any figure until this is fixed." : "");
  if (!(integrity.alerts || []).length) add("integrity", "ok", "No repeated rows or unexplained jumps", "Holdings and net worth passed the duplicate and jump checks.");

  // 6. INDmoney holdings check (weekly) and tax-law check (monthly)
  if (holdingsCheck && holdingsCheck.checkedOn) {
    const age = daysBetween(holdingsCheck.checkedOn, today);
    if (holdingsCheck.status === "gaps") add("holdings-check", "warn", "Holdings differ from INDmoney", ((holdingsCheck.gaps || []).filter((g) => g.confirmed).slice(0, 4).map((g) => `${g.name} (${g.who === "Me" ? "Prafful" : g.who === "Wife" ? "Archana" : g.who})`).join(", ")) || "See the app's Data health.", "Check those holdings in the broker's own app, then run Sync Holdings.");
    else if (age > 10) add("holdings-check", "warn", "The weekly INDmoney check is overdue", `It last ran on ${dateLong(holdingsCheck.checkedOn)}.`, "Run the scheduled task “life-ledger-holdings-check” from the Scheduled tab.");
    else add("holdings-check", "ok", "Holdings match INDmoney", `Last checked ${dateLong(holdingsCheck.checkedOn)}.`);
  } else add("holdings-check", "warn", "The INDmoney check has no result yet", "It runs every Sunday morning.", "Run the scheduled task “life-ledger-holdings-check”.");
  if (lawWatch.stale) add("law", "warn", "The monthly tax-law check is overdue", lawWatch.checkedOn ? `It last ran on ${dateLong(lawWatch.checkedOn)}.` : "It has not run yet.", "Run the scheduled task for the law watch.");
  else add("law", "ok", "Tax-law check is up to date", lawWatch.checkedOn ? `Last checked ${dateLong(lawWatch.checkedOn)}.` : "The first check is not due yet.");

  // 7. The tax engine against its official reference cases
  if (taxCases) {
    if (taxCases.passed < taxCases.total) add("tax-engine", "fail", "The tax engine disagrees with an official example", `${taxCases.passed} of ${taxCases.total} reference cases agree.`, "Do not rely on tax figures until this is fixed.");
    else add("tax-engine", "ok", "Tax engine agrees with every reference case", `${taxCases.passed} of ${taxCases.total}.`);
  }

  const problems = items.filter((i) => i.level !== "ok");
  const status = problems.some((i) => i.level === "fail") ? "fail" : problems.length ? "warn" : "ok";
  return { items, problems, status, today };
}

function render(result, opts = {}) {
  const today = opts.today || result.today, sunday = dayOfWeek(today) === 0;
  const { items, problems, status } = result;
  const fails = problems.filter((p) => p.level === "fail").length;
  const send = problems.length > 0 || sunday || opts.force === true;
  const subject = problems.length ? `Life Ledger — needs attention (${problems.length}${fails ? `, ${fails} serious` : ""})` : `Life Ledger — weekly health: all good`;
  const tone = (l) => (l === "fail" ? "bad" : l === "warn" ? "warn" : "good");
  const label = (l) => (l === "fail" ? "Fix now" : l === "warn" ? "Look at this" : "OK");
  const headline = problems.length ? `${problems.length} thing${problems.length === 1 ? "" : "s"} need${problems.length === 1 ? "s" : ""} a look` : "Everything is working";
  const sub = problems.length ? "These fail quietly, which is why they are listed here." : `${items.length} checks passed. Sent on Sundays so you know the watch itself is alive.`;
  const block = (i) => `<div style="margin:0 0 12px">${chip(label(i.level), tone(i.level))} <b>${esc(i.title)}</b><div style="color:#5b6573;font-size:13px;line-height:19px">${esc(i.detail)}</div>${i.action ? `<div style="font-size:13px;line-height:19px;margin-top:2px"><b>What to do:</b> ${esc(i.action)}</div>` : ""}</div>`;
  const oks = items.filter((i) => i.level === "ok");
  const html = sealed(wrap(
    card(`<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b6573">Health watch</div><div style="font-size:24px;line-height:30px;font-weight:800;margin:2px 0 4px">${esc(headline)}</div><div style="color:#5b6573;font-size:13px">${esc(sub)}</div>`) +
    (problems.length ? h2("Needs attention") + card(problems.map(block).join("")) : "") +
    h2(problems.length ? "Working fine" : "All checks") + card(oks.map((i) => `<div style="margin:0 0 6px;font-size:13px">${chip("OK", "good")} <b>${esc(i.title)}</b> <span style="color:#5b6573">· ${esc(i.detail)}</span></div>`).join("") || "None.") +
    small("An automatic check of the app's own data and sources. It does not look at your accounts."), today, "Health watch"));
  const text = [`LIFE LEDGER — HEALTH WATCH, ${dateLong(today)}`, headline.toUpperCase(), "",
    ...(problems.length ? ["NEEDS ATTENTION", ...problems.map((i) => `- [${label(i.level)}] ${i.title}: ${i.detail}${i.action ? ` What to do: ${i.action}` : ""}`), ""] : []),
    "WORKING FINE", ...oks.map((i) => `- ${i.title} (${i.detail})`)].join("\n");
  return { subject, html, text, send, kind: status === "ok" ? "healthy" : "attention", problems: problems.length, serious: fails };
}

module.exports = { check, render, priceLimitHours };
