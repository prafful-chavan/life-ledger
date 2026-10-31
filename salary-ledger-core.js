/**
 * Life Ledger — the salary ledger's rules (pure: rows in, numbers and rows out; no DOM, no network, no clock).
 *
 * One salary row = one payslip. It is described by named EARNING columns and named DEDUCTION columns, so every rupee of gross
 * and of net can be traced to a payslip line. The statutory deductions (PF, professional tax, income tax, labour welfare) have
 * their own columns, so a year's PF / PT / TDS can be added up without reading the pay slips again.
 *
 * What this file does:
 *   • totals(row)       — earnings, deductions, gross and net of one row, and whether they add up (within TOLERANCE rupees)
 *   • statutoryByYear() — PF, professional tax, TDS … per person, employer and financial year
 *   • fromLedgerRows()  — reads the standard ledger workbook (one object per sheet row) into salary rows; rows that do not add
 *                         up are rejected, never guessed at; rows marked "Sheet only" are left alone
 *   • planImport()      — compares those rows with the rows already in the app (same person, employer, month) and says what
 *                         would be added or changed; applyPlan() carries it out. Nothing changes until applyPlan() is called.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSalaryLedger = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** Rupees of rounding the payslips themselves allow (they print whole rupees). */
  const TOLERANCE = 2;

  /** [stored field, column heading]. The stored names for the first 13 rows are the ones the app has always used. */
  const EARNINGS = [
    ["basicSalary", "Basic"],
    ["hra", "HRA"],
    ["lta", "LTA"],
    ["specialAllowance", "Special allowance"],
    ["personalAllowance", "Personal allowance"],
    ["pda", "Personality development (PDA)"],
    ["cityAllowance", "City compensatory"],
    ["conveyanceAllowance", "Conveyance"],
    ["foodAllowance", "Food"],
    ["medicalAllowance", "Medical / hospital reimbursement"],
    ["shiftAllowance", "Shift allowance"],
    ["phoneAllowance", "Phone & internet"],
    ["professionalDevelopment", "Professional development"],
    ["fuelVehicle", "Fuel / vehicle / driver"],
    ["performancePay", "Performance pay / bonus"],
    ["miscellaneous", "Miscellaneous / variable"],
    ["leaveEncashment", "Leave encashment"],
    ["arrears", "Arrears"],
    ["employerPfEarning", "Employer PF shown as earning"],
    ["otherEarnings", "Other earnings"],
  ];
  /** [stored field, column heading, statutory]. */
  const DEDUCTIONS = [
    ["pf", "PF (employee)", true],
    ["professionalTax", "Professional tax", true],
    ["taxTds", "Income tax (TDS)", true],
    ["labourWelfare", "Labour welfare fund", true],
    ["healthInsurance", "Health / medical insurance", false],
    ["employerPfDeducted", "Employer PF / pension deducted", false],
    ["otherDeductions", "Other deductions", false],
  ];
  const EARNING_KEYS = EARNINGS.map((c) => c[0]);
  const DEDUCTION_KEYS = DEDUCTIONS.map((c) => c[0]);
  const STATUTORY_KEYS = DEDUCTIONS.filter((c) => c[2]).map((c) => c[0]);
  /** The headings the ledger workbook uses besides the columns above. */
  const HEADINGS = { person: "Person", employer: "Employer", month: "Month", gross: "GROSS EARNINGS", totalDeductions: "TOTAL DEDUCTIONS", net: "NET PAY", basis: "Basis", note: "Note" };

  const num = (v) => {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const n = parseFloat(String(v == null ? "" : v).replace(/[₹,\s]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const round2 = (n) => Math.round(n * 100) / 100;
  const sum = (row, keys) => round2(keys.reduce((t, k) => t + num(row && row[k]), 0));

  /** "2024-03-01" or "2024-03-31T…" → "2024-03"; anything else → "". */
  function monthKey(date) {
    const m = /^(\d{4})-(\d{2})/.exec(String(date || ""));
    return m && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2]}` : "";
  }
  /** "2024-03" → "FY2023-24" (the year runs April to March). */
  function fyOf(date) {
    const k = monthKey(date);
    if (!k) return "";
    const y = +k.slice(0, 4), mo = +k.slice(5, 7);
    const start = mo >= 4 ? y : y - 1;
    return `FY${start}-${String(start + 1).slice(2)}`;
  }

  /** Earnings and deductions of a row as {field: amount}, listing only the non-zero ones. */
  function earningsOf(row) {
    const out = {};
    for (const k of EARNING_KEYS) if (num(row && row[k]) !== 0) out[k] = num(row[k]);
    return out;
  }
  function deductionsOf(row) {
    const out = {};
    for (const k of DEDUCTION_KEYS) if (num(row && row[k]) !== 0) out[k] = num(row[k]);
    return out;
  }

  /**
   * The figures of one row and whether they add up.
   *   itemised — the earning columns add up to the gross (± TOLERANCE)
   *   balanced — gross − the deduction columns equals the net (± TOLERANCE)
   *   coverage — share of the gross that the earning columns explain (0 to 1; 1 when the gross is 0)
   */
  function totals(row) {
    const earnings = sum(row, EARNING_KEYS);
    const deductions = sum(row, DEDUCTION_KEYS);
    const gross = num(row && row.grossEarnings) || earnings;
    const net = num(row && (row.netSalary || row.amount));
    return {
      earnings,
      deductions,
      gross,
      net,
      itemised: Math.abs(earnings - gross) <= TOLERANCE,
      balanced: Math.abs(gross - deductions - net) <= TOLERANCE,
      coverage: gross > 0 ? Math.min(1, earnings / gross) : 1,
      gap: round2(gross - earnings),
    };
  }

  const isRowSalary = (row) => /salary/i.test((row && row.type) || "salary") || Boolean(row && (row.grossEarnings || row.netSalary || row.basicSalary));

  /** PF, professional tax, TDS … per person, employer and financial year. rows = the app's income rows. */
  function statutoryByYear(rows) {
    const by = new Map();
    for (const row of rows || []) {
      if (!isRowSalary(row)) continue;
      const fy = fyOf(row.date);
      if (!fy) continue;
      const person = row.person || "Me", source = row.source || row.organization || "Other";
      const key = `${person}|${source}|${fy}`;
      let a = by.get(key);
      if (!a) { a = { person, source, fy, months: 0, gross: 0, net: 0, totalDeductions: 0 }; for (const k of STATUTORY_KEYS) a[k] = 0; a.healthInsurance = 0; by.set(key, a); }
      const t = totals(row);
      a.months += 1; a.gross += t.gross; a.net += t.net; a.totalDeductions += t.deductions;
      for (const k of STATUTORY_KEYS) a[k] += num(row[k]);
      a.healthInsurance += num(row.healthInsurance);
    }
    return [...by.values()]
      .map((a) => ({ ...a, gross: round2(a.gross), net: round2(a.net), totalDeductions: round2(a.totalDeductions) }))
      .sort((x, y) => (x.person === y.person ? (x.fy === y.fy ? x.source.localeCompare(y.source) : y.fy.localeCompare(x.fy)) : x.person.localeCompare(y.person)));
  }

  /** The grand totals the Salary tab shows above the table. */
  function summary(rows) {
    const out = { rows: 0, gross: 0, net: 0, deductions: 0, pf: 0, professionalTax: 0, taxTds: 0 };
    for (const row of rows || []) {
      if (!isRowSalary(row)) continue;
      const t = totals(row);
      out.rows += 1; out.gross += t.gross; out.net += t.net; out.deductions += t.deductions;
      out.pf += num(row.pf); out.professionalTax += num(row.professionalTax); out.taxTds += num(row.taxTds);
    }
    for (const k of Object.keys(out)) out[k] = round2(out[k]);
    return out;
  }

  /** Reads "2024-03", a Date, an Excel serial or "Mar-2024" as "YYYY-MM-01"; "" when it cannot. */
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  function ledgerMonth(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-01`;
    if (typeof value === "number" && value > 20000 && value < 80000) {
      const d = new Date(Math.round((value - 25569) * 864e5));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
    }
    const s = String(value || "").trim();
    const iso = monthKey(s);
    if (iso) return `${iso}-01`;
    const m = /^([A-Za-z]{3})[a-z]*[\s-]+(\d{4})$/.exec(s);
    return m && MONTHS[m[1].toLowerCase()] ? `${m[2]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, "0")}-01` : "";
  }

  const normalizeHeading = (h) => String(h || "").replace(/\s+/g, " ").trim().toLowerCase();

  /**
   * The standard ledger workbook → salary rows.
   * rows = one object per sheet row, keyed by the column headings (as read from the "Ledger" sheet).
   * Returns { records, skipped, rejected }: skipped = rows marked "Sheet only" (no payslip behind them) or without a
   * person/employer/month; rejected = rows whose figures do not add up, with the reason. Neither is ever imported.
   */
  function fromLedgerRows(rows) {
    const byHeading = new Map();
    for (const [key, label] of EARNINGS) byHeading.set(normalizeHeading(label), key);
    for (const [key, label] of DEDUCTIONS) byHeading.set(normalizeHeading(label), key);
    const records = [], skipped = [], rejected = [];
    for (const raw of rows || []) {
      const cells = {};
      for (const [h, v] of Object.entries(raw || {})) cells[normalizeHeading(h)] = v;
      const get = (h) => cells[normalizeHeading(h)];
      const person = String(get(HEADINGS.person) || "").trim(), source = String(get(HEADINGS.employer) || "").trim();
      const date = ledgerMonth(get(HEADINGS.month));
      const basis = String(get(HEADINGS.basis) || "").trim();
      if (!person || !source || !date) { if (person || source || date) skipped.push({ reason: "missing person, employer or month", person, source }); continue; }
      if (/sheet only/i.test(basis)) { skipped.push({ reason: "sheet only (no payslip)", person, source, date }); continue; }
      const rec = {};
      for (const [heading, key] of byHeading) rec[key] = round2(num(cells[heading]));
      const gross = round2(num(get(HEADINGS.gross))), net = round2(num(get(HEADINGS.net)));
      const stated = round2(num(get(HEADINGS.totalDeductions)));
      const t = totals({ ...rec, grossEarnings: gross, netSalary: net });
      const why = [];
      if (!(gross > 0)) why.push("gross is missing");
      if (!t.itemised) why.push(`earning columns add to ${t.earnings}, gross is ${gross}`);
      if (!t.balanced) why.push(`gross ${gross} − deductions ${t.deductions} is not net ${net}`);
      if (stated && Math.abs(stated - t.deductions) > TOLERANCE) why.push(`total deductions says ${stated}, columns add to ${t.deductions}`);
      if (why.length) { rejected.push({ person, source, date, reasons: why }); continue; }
      records.push({
        person: person === "Wife" ? "Wife" : "Me",
        source, organization: source, date, type: "Salary",
        grossEarnings: gross, netSalary: net, amount: net,
        ...rec,
        grossDeductions: t.deductions,
        note: String(get(HEADINGS.note) || "").trim(),
        components: earningsOf(rec), deductions: deductionsOf(rec),
      });
    }
    return { records, skipped, rejected };
  }

  /** The fields an import is allowed to set on an existing row. */
  const IMPORT_FIELDS = ["grossEarnings", "netSalary", "amount", ...EARNING_KEYS, ...DEDUCTION_KEYS, "grossDeductions"];

  /**
   * What importing `incoming` into `existing` would do. Match = same person, employer and month.
   *   adds      — rows with no match (they get a new id when applied)
   *   updates   — matched rows whose figures differ: { id, key, changes: { field: [was, now] } }
   *   same      — number of matched rows that already agree
   *   conflicts — incoming rows that match more than one existing row (left alone)
   *   untouched — existing salary rows nothing in the ledger refers to (left alone)
   */
  function planImport(existing, incoming) {
    const index = new Map();
    const keyOf = (r) => `${r.person || "Me"}|${r.source || r.organization || ""}|${monthKey(r.date)}`;
    for (const row of existing || []) {
      if (!isRowSalary(row) || !monthKey(row.date)) continue;
      const k = keyOf(row);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(row);
    }
    const adds = [], updates = [], conflicts = [], seen = new Set();
    let same = 0;
    for (const rec of incoming || []) {
      const k = keyOf(rec);
      const hits = index.get(k) || [];
      if (hits.length > 1) { conflicts.push({ key: k, ids: hits.map((h) => h.id) }); continue; }
      if (!hits.length) { adds.push(rec); continue; }
      const row = hits[0];
      seen.add(row.id);
      const changes = {};
      for (const f of IMPORT_FIELDS) {
        const was = round2(num(row[f])), now = round2(num(rec[f]));
        if (was !== now) changes[f] = [was, now];
      }
      if (Object.keys(changes).length) updates.push({ id: row.id, key: k, changes, after: rec });
      else same += 1;
    }
    const untouched = [];
    for (const rows of index.values()) for (const row of rows) if (!seen.has(row.id)) untouched.push(row.id);
    return { adds, updates, same, conflicts, untouched };
  }

  /** The new list of rows after the plan: matched rows get the new figures (their id, date and other fields stay), new rows are appended. */
  function applyPlan(existing, plan, newId) {
    const byId = new Map(plan.updates.map((u) => [u.id, u]));
    const out = (existing || []).map((row) => {
      const u = byId.get(row.id);
      if (!u) return row;
      const next = { ...row };
      for (const f of IMPORT_FIELDS) next[f] = u.after[f];
      next.components = earningsOf(next);
      next.deductions = deductionsOf(next);
      if (u.after.note) next.note = u.after.note;
      return next;
    });
    for (const rec of plan.adds) out.push({ ...rec, id: newId() });
    return out;
  }

  return { TOLERANCE, EARNINGS, DEDUCTIONS, EARNING_KEYS, DEDUCTION_KEYS, STATUTORY_KEYS, HEADINGS, IMPORT_FIELDS, num, monthKey, fyOf, earningsOf, deductionsOf, totals, summary, statutoryByYear, ledgerMonth, fromLedgerRows, planImport, applyPlan, isRowSalary };
});
