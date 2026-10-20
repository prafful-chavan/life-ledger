/**
 * Life Ledger — Data health (pure; no DOM).
 * run(ctx) re-derives the key numbers from the raw records and flags anything that does not add up,
 * so a mismatch shows up as a plain message instead of needing someone to audit by hand.
 *
 * ctx = { state, dismissed?: { [checkId]: signature }, now: "YYYY-MM-DD", reported: { netWorth, totalAssets, usStocksInr, advisorTotal }, categoryCanon?, categoryKey? }
 * → { checks: [{ id, status: "ok"|"info"|"warn", title, detail, items? }], counts: { ok, info, warn } }
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerDataHealth = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const sum = (list, f) => (list || []).reduce((t, x) => t + f(x), 0);
  const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
  const DAY = 86400000;
  const owner = (x) => (x && x.owner) || "Me";

  const ok = (id, title, detail) => ({ id, status: "ok", title, detail });
  const info = (id, title, detail, items) => ({ id, status: "info", title, detail, items });
  const warn = (id, title, detail, items) => ({ id, status: "warn", title, detail, items });

  /** Net units × latest NAV per fund (redemptions subtract). */
  function mfValue(list) {
    const byFund = {};
    (list || []).forEach((t) => {
      const k = (t.fundName || "?") + "|" + owner(t);
      const f = (byFund[k] = byFund[k] || { units: 0, nav: n(t.latestNav) || n(t.nav) });
      if (n(t.latestNav)) f.nav = n(t.latestNav);
      f.units += (String(t.transactionType || "").toUpperCase() === "REDEMPTION" ? -1 : 1) * n(t.units);
    });
    return Object.values(byFund).reduce((t, f) => t + Math.max(0, f.units) * f.nav, 0);
  }

  function priceTime(text) {
    const t = Date.parse(String(text || "").replace(",", ""));
    if (Number.isFinite(t)) return t;
    const m = String(text || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);   // 16-10-2026
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : NaN;
  }

  function run(input) {
    const ctx = input || {};
    const s = ctx.state || {};
    const now = Date.parse(ctx.now || new Date().toISOString().slice(0, 10)) || Date.now();
    const rep = ctx.reported || {};
    const checks = [];

    // 1) Net worth rebuilt from the raw records
    {
      const usInr = rep.usStocksInr != null ? n(rep.usStocksInr) : 0;   // the exchange rate is an outside number, so take it as given
      const flat = ["silver", "crypto", "fd", "epf", "ppf", "bonds", "banksaving", "others", "vehicles"].reduce((t, k) => t + sum(s[k], (x) => n(x.value)), 0);
      const gold = sum(s.gold, (x) => n(x.value));
      const stocks = sum(s.stocks, (x) => n(x.quantity) * n(x.currentPrice));
      const assets = mfValue(s.mutualFunds) + stocks + usInr + gold + flat;
      const liab = sum(s.liabilities, (x) => n(x.value));
      const nw = assets - liab;
      if (rep.netWorth == null) checks.push(info("networth", "Net worth", "No reported figure to compare."));
      else {
        const diff = Math.abs(nw - n(rep.netWorth));
        const tol = Math.max(100, Math.abs(nw) * 0.0002);
        checks.push(diff <= tol
          ? ok("networth", "Net worth adds up", `Rebuilt from your records: ${inr(nw)}; the app shows ${inr(rep.netWorth)}.`)
          : warn("networth", "Net worth does not match your records", `Your records add up to ${inr(nw)} but the app shows ${inr(rep.netWorth)} (difference ${inr(diff)}). Refresh prices; if it stays, a saved day-end value is out of date.`));
      }
    }

    // 2) Advisor and Finance agree on total assets
    if (rep.advisorTotal != null && rep.totalAssets != null) {
      const diff = Math.abs(n(rep.advisorTotal) - n(rep.totalAssets));
      checks.push(diff <= 150
        ? ok("advisor-total", "Advisor and Finance agree", `Both show about ${inr(rep.totalAssets)} of assets.`)
        : warn("advisor-total", "Advisor and Finance disagree", `Finance shows ${inr(rep.totalAssets)} of assets, the Advisor ${inr(rep.advisorTotal)} (difference ${inr(diff)}).`));
    }

    // 3) Prices present and recent
    {
      const missing = [];
      (s.stocks || []).forEach((x) => { if (!(n(x.currentPrice) > 0)) missing.push(x.symbol || x.company); });
      (s.usstocks || []).forEach((x) => { if (!(n(x.currentPrice) > 0)) missing.push(x.symbol || x.company); });
      const mfMissing = [...new Set((s.mutualFunds || []).filter((x) => !(n(x.latestNav) > 0)).map((x) => x.fundName))];
      const old = [];
      (s.stocks || []).concat(s.usstocks || []).forEach((x) => {
        const t = priceTime(x.priceDate);
        if (Number.isFinite(t) && now - t > 5 * DAY) old.push(`${x.symbol} (${x.priceDate})`);
      });
      [...new Set((s.mutualFunds || []).map((x) => x.navDate))].forEach((d) => {
        const t = priceTime(d);
        if (Number.isFinite(t) && now - t > 6 * DAY) old.push(`NAV dated ${d}`);
      });
      const all = [...new Set(missing)].concat(mfMissing);
      if (all.length) checks.push(warn("prices-missing", `${all.length} holding${all.length > 1 ? "s have" : " has"} no price`, "These are counted at zero until a price arrives. Use Refresh prices; if one stays empty its ticker may need fixing.", all.slice(0, 8)));
      else checks.push(ok("prices-missing", "Every holding has a price", `${(s.stocks || []).length + (s.usstocks || []).length} stock rows and every mutual fund are priced.`));
      if (old.length) checks.push(warn("prices-old", "Some prices are out of date", "Last updated more than a few days ago.", [...new Set(old)].slice(0, 8)));
      else checks.push(ok("prices-old", "Prices are recent", "Nothing older than a few days."));
    }

    // 4) Net worth history rows add up
    {
      const bad = (s.netWorthHistory || []).filter((h) => {
        const comps = ["mutualFunds", "stocks", "usStocks", "gold", "silver", "crypto", "fd", "epf", "ppf", "bonds", "bankSaving", "others"].reduce((t, k) => t + n(h[k]), 0);
        return Math.abs(comps - n(h.totalAssets)) > 1 || Math.abs(n(h.totalAssets) - n(h.liabilities) - n(h.netWorth)) > 1;
      }).map((h) => h.date);
      checks.push(bad.length
        ? warn("history", "Some net worth history rows do not add up", "Their parts do not match their total.", bad.slice(0, 8))
        : ok("history", "Net worth history is consistent", `${(s.netWorthHistory || []).length} saved days add up.`));
    }

    // 5) Expenses: bad rows, duplicates, spelling variants
    {
      const ex = s.expenses || [];
      const bad = ex.filter((e) => !/^\d{4}-\d{2}-\d{2}/.test(String(e.date || "")) || !(n(e.amount) > 0));
      checks.push(bad.length
        ? warn("expense-rows", `${bad.length} expense${bad.length > 1 ? "s have" : " has"} a missing date or a zero/negative amount`, "These can skew monthly totals.", bad.slice(0, 5).map((e) => `${e.date || "no date"} · ${e.amount} · ${e.note || e.category || ""}`))
        : ok("expense-rows", "Every expense has a date and an amount", `${ex.length.toLocaleString("en-IN")} expenses checked.`));

      const seen = {};
      ex.forEach((e) => { const k = [e.date, n(e.amount), e.note || "", e.paidBy || "", e.category || ""].join("|"); seen[k] = (seen[k] || 0) + 1; });
      const dups = Object.entries(seen).filter(([, c]) => c > 1);
      checks.push(dups.length
        ? info("expense-dups", `${dups.length} expense${dups.length > 1 ? "s appear" : " appears"} more than once`, "Same date, amount, note, person and category. This can be genuine (two identical purchases) or a double import.", dups.slice(0, 5).map(([k, c]) => `${k.split("|").slice(0, 3).join(" · ")} ×${c}`))
        : ok("expense-dups", "No repeated expenses", "No two expenses are identical in every field."));

      if (ctx.categoryKey) {
        const groups = {};
        [...new Set(ex.map((e) => String(e.category || "").trim()).filter(Boolean))].forEach((c) => { (groups[ctx.categoryKey(c)] = groups[ctx.categoryKey(c)] || []).push(c); });
        const variants = Object.values(groups).filter((g) => g.length > 1);
        checks.push(variants.length
          ? info("categories", "Some categories are spelled two ways", "The app already merges them in totals and charts; your stored entries still use both spellings.", variants.map((g) => g.join("  ≈  ")))
          : ok("categories", "Category names are consistent", "No spelling variants."));
      }
    }

    // 6) Income: gaps and doubles
    {
      const items = [];
      const people = [...new Set((s.income || []).map((i) => i.person || "Me"))];
      people.forEach((p) => {
        const months = [...new Set((s.income || []).filter((i) => (i.person || "Me") === p).map((i) => String(i.date).slice(0, 7)))].sort();
        if (months.length < 2) return;
        const set = new Set(months);
        let [y, m] = months[0].split("-").map(Number);
        const [ey, em] = months[months.length - 1].split("-").map(Number);
        const gaps = [];
        while (y < ey || (y === ey && m <= em)) { const k = `${y}-${String(m).padStart(2, "0")}`; if (!set.has(k)) gaps.push(k); m++; if (m > 12) { m = 1; y++; } }
        if (gaps.length) items.push(`${p}: no salary recorded for ${gaps.slice(0, 6).join(", ")}${gaps.length > 6 ? "…" : ""}`);
      });
      checks.push(items.length
        ? info("income-gaps", "Salary gaps", "Months between your first and latest salary with nothing recorded.", items)
        : ok("income-gaps", "Salary has no gaps", `${(s.income || []).length} salary records across ${people.length} people.`));
    }

    // 6b) Salary rows the tax estimate cannot use (pay recorded without the gross / TDS breakdown)
    {
      const since = new Date(now - 400 * DAY).toISOString().slice(0, 10);
      const who = { Me: "Prafful", Wife: "Archana" };
      const items = (s.income || []).filter((x) => (!x.type || /salary/i.test(x.type)) && String(x.date || "") >= since && n(x.amount || x.netSalary) > 0 && !(n(x.grossEarnings) > 0))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((x) => `${who[x.person] || x.person || "?"} · ${String(x.date).slice(0, 7)}: ${inr(n(x.amount || x.netSalary))} received, no gross salary`);
      checks.push(items.length
        ? info("salary-breakdown", "Salary records without the gross amount", "The Tax page estimates these months from a typical month. Add the gross salary (and TDS) from the payslip to make this year's tax exact.", items)
        : ok("salary-breakdown", "Salary records have their gross amounts", "Every salary in the last 13 months carries the payslip breakdown the tax estimate needs."));
    }

    // 6c) Professional tax typed into the TDS field (₹200 a month, ₹300 in February, is Maharashtra's professional tax)
    {
      const since = new Date(now - 400 * DAY).toISOString().slice(0, 10);
      const who = { Me: "Prafful", Wife: "Archana" };
      const rows = (s.income || []).filter((x) => (!x.type || /salary/i.test(x.type)) && String(x.date || "") >= since);
      const byPerson = {};
      rows.forEach((x) => { const p = x.person || "Me"; (byPerson[p] = byPerson[p] || []).push(x); });
      const items = [];
      Object.entries(byPerson).forEach(([p, list]) => {
        const looks = list.filter((x) => [200, 300].includes(Math.round(n(x.taxTds))) && !(n(x.professionalTax) > 0));
        if (looks.length >= 2) items.push(`${who[p] || p}: ${looks.length} months show TDS of ₹${Math.round(n(looks[0].taxTds))} and no professional tax`);
      });
      checks.push(items.length
        ? info("tds-field", "Professional tax may be recorded as TDS", "₹200 a month is professional tax, not income-tax TDS. Move it to the professional-tax field so the Tax page's TDS figures are right.", items)
        : ok("tds-field", "TDS and professional tax look right", "No salary shows professional tax in the TDS field."));
    }

    // 7) Goals: stale hand-typed progress, placeholders, overdue
    {
      const goals = s.goals || [];
      const items = [];
      const mfNow = mfValue(s.mutualFunds);
      goals.forEach((g) => {
        const nm = String(g.name || "").toLowerCase();
        if (!g.track || g.track === "Entered by me") {
          if (/mutual fund|\bmf\b|sip/.test(nm) && mfNow > n(g.saved) * 1.1) items.push(`“${g.name}”: saved says ${inr(g.saved)} but your mutual funds are ${inr(mfNow)}. Set “Progress comes from” to Mutual funds.`);
        }
        if (g.dueDate && !g.track && n(g.saved) < n(g.target) && Date.parse(g.dueDate) < now) items.push(`“${g.name}” is past its due date.`);
      });
      const typed = goals.filter((g) => !g.track || g.track === "Entered by me");
      const dupSaved = {};
      typed.forEach((g) => { dupSaved[n(g.saved)] = (dupSaved[n(g.saved)] || []).concat(g.name); });
      Object.entries(dupSaved).forEach(([v, names]) => { if (names.length > 1 && n(v) > 0) items.push(`${names.map((x) => `“${x}”`).join(" and ")} have exactly the same saved amount (${inr(v)}). Is that a placeholder?`); });
      checks.push(items.length
        ? warn("goals", "Check your goals", "Progress that may not reflect reality.", items)
        : ok("goals", "Goal progress looks right", `${goals.length} goals checked.`));
    }

    // 8) Liabilities know their cost
    {
      const unknown = (s.liabilities || []).filter((l) => !(n(l.rate) > 0));
      checks.push(unknown.length
        ? info("liabilities", "A loan has no interest rate", "The Advisor cannot judge how expensive it is.", unknown.map((l) => `${l.name} (${inr(l.value)})`))
        : ok("liabilities", "Every loan has an interest rate", `${(s.liabilities || []).length} loans checked.`));
    }

    // Notes (not problems) can be dismissed. A dismissal is tied to what the note said, so it comes back if the note changes.
    const dismissed = ctx.dismissed || {};
    const counts = { ok: 0, info: 0, warn: 0, snoozed: 0 };
    // Doubled holdings (e.g. an older copy of the app bringing back rows that an import replaced)
    {
      const HI = typeof module === "object" && module.exports ? require("./holdings-integrity.js") : (typeof self !== "undefined" ? self.LifeLedgerHoldingsIntegrity : null);
      if (HI) {
        const names = { mutualFunds: "mutual fund", stocks: "stock", usstocks: "US stock" };
        const bad = HI.duplicateReport(s).filter(HI.looksDuplicated);
        if (bad.length) {
          const c = warn("duplicate-holdings", "Some holdings appear twice",
            "Rows with identical content, differing only by id — usually an older copy of the app syncing back in. Net worth and every total are inflated until they are removed.",
            bad.map((r) => `${names[r.coll]} rows: ${r.rows}, of which ${r.rowsInDuplicateGroups} are copies of each other`));
          c.action = "remove-duplicate-holdings";
          checks.push(c);
        } else checks.push(ok("duplicate-holdings", "No doubled holdings", "No fund, stock or US stock rows are repeated in bulk."));
      }
    }

    checks.forEach((c) => {
      c.signature = (c.items || []).join("|") || c.detail || "";
      c.snoozed = c.status === "info" && dismissed[c.id] === c.signature;
      if (c.snoozed) counts.snoozed++; else counts[c.status]++;
    });
    return { checks, counts };
  }

  return { run, mfValue };
});
