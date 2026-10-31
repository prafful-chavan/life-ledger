// The salary ledger's rules: earning and deduction columns, whether a row adds up, statutory totals per year,
// reading the standard ledger workbook, and what an import would add or change. Tests sit on both sides of every limit.
const assert = require("assert");
const L = require("../salary-ledger-core.js");

// ── the columns ──
assert.strictEqual(L.EARNINGS.length, 20); assert.strictEqual(L.DEDUCTIONS.length, 7);
assert.strictEqual(new Set([...L.EARNING_KEYS, ...L.DEDUCTION_KEYS]).size, 27, "no stored field is used twice");
assert.deepStrictEqual(L.STATUTORY_KEYS, ["pf", "professionalTax", "taxTds", "labourWelfare"], "statutory = PF, professional tax, income tax, labour welfare");
for (const k of ["basicSalary", "hra", "lta", "specialAllowance", "personalAllowance", "cityAllowance", "conveyanceAllowance", "foodAllowance", "medicalAllowance", "shiftAllowance", "phoneAllowance", "professionalDevelopment", "performancePay", "miscellaneous", "pda"])
  assert.ok(L.EARNING_KEYS.includes(k), "the field the app already used is kept: " + k);
const headings = [...L.EARNINGS, ...L.DEDUCTIONS].map((c) => c[1].toLowerCase());
assert.strictEqual(new Set(headings).size, 27, "no heading is used twice");

// ── numbers, months, years ──
assert.strictEqual(L.num("₹1,99,884.50"), 199884.5); assert.strictEqual(L.num("abc"), 0); assert.strictEqual(L.num(null), 0); assert.strictEqual(L.num(undefined), 0); assert.strictEqual(L.num(NaN), 0); assert.strictEqual(L.num(-5), -5);
assert.strictEqual(L.monthKey("2024-03-01"), "2024-03"); assert.strictEqual(L.monthKey("2024-03-31T10:00:00Z"), "2024-03"); assert.strictEqual(L.monthKey("2024-13-01"), "", "month 13 is no month"); assert.strictEqual(L.monthKey("2024-00-01"), "");
assert.strictEqual(L.monthKey(""), ""); assert.strictEqual(L.monthKey(undefined), ""); assert.strictEqual(L.monthKey("March 2024"), "");
assert.strictEqual(L.fyOf("2024-03-31"), "FY2023-24", "March belongs to the year that began the April before");
assert.strictEqual(L.fyOf("2024-04-01"), "FY2024-25", "April starts the new year");
assert.strictEqual(L.fyOf("2025-12-15"), "FY2025-26"); assert.strictEqual(L.fyOf("2026-01-01"), "FY2025-26"); assert.strictEqual(L.fyOf("nonsense"), "");
assert.strictEqual(L.fyOf("2099-03-01"), "FY2098-99"); assert.strictEqual(L.fyOf("2000-04-01"), "FY2000-01", "century-safe two-digit end year");

// ── one row's figures ──
const slip = { grossEarnings: 100000, netSalary: 80000, basicSalary: 50000, hra: 25000, specialAllowance: 25000, pf: 6000, professionalTax: 200, taxTds: 13800 };
let t = L.totals(slip);
assert.deepStrictEqual([t.earnings, t.deductions, t.gross, t.net, t.itemised, t.balanced, t.coverage, t.gap], [100000, 20000, 100000, 80000, true, true, 1, 0]);
assert.strictEqual(L.totals({ ...slip, specialAllowance: 24998 }).itemised, true, "off by exactly 2 rupees: still itemised");
assert.strictEqual(L.totals({ ...slip, specialAllowance: 24997 }).itemised, false, "off by 3 rupees: not itemised");
assert.strictEqual(L.totals({ ...slip, specialAllowance: 25002 }).itemised, true, "over by 2: still itemised"); assert.strictEqual(L.totals({ ...slip, specialAllowance: 25003 }).itemised, false, "over by 3: not");
assert.strictEqual(L.totals({ ...slip, netSalary: 80002 }).balanced, true, "net off by 2: balanced"); assert.strictEqual(L.totals({ ...slip, netSalary: 80003 }).balanced, false, "net off by 3: not");
assert.strictEqual(L.totals({ ...slip, netSalary: 79998 }).balanced, true); assert.strictEqual(L.totals({ ...slip, netSalary: 79997 }).balanced, false);
t = L.totals({ grossEarnings: 100000, netSalary: 78000, basicSalary: 78000 });
assert.strictEqual(t.itemised, false); assert.strictEqual(t.coverage, 0.78); assert.strictEqual(t.gap, 22000, "gap = gross not explained by earning columns");
assert.strictEqual(L.totals({ basicSalary: 100, hra: 50, amount: 120, pf: 30 }).gross, 150, "no gross stated: the earning columns are the gross");
assert.strictEqual(L.totals({ grossEarnings: 100, amount: 90, netSalary: 0 }).net, 90, "net falls back to amount"); assert.strictEqual(L.totals({ grossEarnings: 100, netSalary: 70, amount: 90 }).net, 70, "net salary wins over amount");
assert.strictEqual(L.totals({ grossEarnings: 100, netSalary: 90, grossDeductions: 10, basicSalary: 100 }).deductions, 0, "the older 'gross deductions' total is not added on top of the columns");
assert.strictEqual(L.totals({}).coverage, 1, "empty row: no division by zero");
assert.strictEqual(L.totals({ grossEarnings: 1, basicSalary: 0.5 }).coverage, 0.5, "a gross of ₹1 still gets a share");
assert.strictEqual(L.totals({ grossEarnings: 100, basicSalary: 120 }).coverage, 1, "coverage never exceeds 1"); assert.strictEqual(L.totals(null).gross, 0);
assert.deepStrictEqual(L.earningsOf({ basicSalary: 5, hra: 0, arrears: -3, pf: 9 }), { basicSalary: 5, arrears: -3 }, "zero left out, negative kept (a bonus reversal), deductions not mixed in");
assert.deepStrictEqual(L.deductionsOf({ pf: 5, taxTds: 0, otherDeductions: -2, basicSalary: 9 }), { pf: 5, otherDeductions: -2 });

// ── statutory totals per year ──
const rows = [
  { date: "2024-03-01", person: "Me", source: "JLR", type: "Salary", grossEarnings: 100, netSalary: 60, basicSalary: 100, pf: 10, professionalTax: 200, taxTds: 30 },
  { date: "2024-04-01", person: "Me", source: "JLR", type: "Salary", grossEarnings: 200, netSalary: 150, basicSalary: 200, pf: 20, professionalTax: 200, taxTds: 30, labourWelfare: 25, healthInsurance: 5 },
  { date: "2024-05-01", person: "Me", source: "JLR", type: "Salary", grossEarnings: 200, netSalary: 150, basicSalary: 200, pf: 20, professionalTax: 200, taxTds: 30 },
  { date: "2024-05-01", person: "Wife", source: "Ascent", type: "Salary", grossEarnings: 50, netSalary: 45, basicSalary: 50, pf: 5 },
  { date: "2024-05-01", person: "Me", source: "Bank", type: "Interest", amount: 999 },
  { date: "", person: "Me", source: "JLR", type: "Salary", grossEarnings: 5, netSalary: 5 },
];
const st = L.statutoryByYear(rows);
assert.strictEqual(st.length, 3, "March and April of the same employer fall in two years; interest and undated rows are left out");
const fy2324 = st.find((x) => x.fy === "FY2023-24"), fy2425 = st.find((x) => x.fy === "FY2024-25" && x.source === "JLR");
assert.deepStrictEqual([fy2324.months, fy2324.gross, fy2324.pf, fy2324.professionalTax, fy2324.taxTds], [1, 100, 10, 200, 30], "March is the last month of FY2023-24");
assert.deepStrictEqual([fy2425.months, fy2425.gross, fy2425.net, fy2425.pf, fy2425.professionalTax, fy2425.taxTds, fy2425.labourWelfare, fy2425.healthInsurance], [2, 400, 300, 40, 400, 60, 25, 5], "April starts FY2024-25");
assert.strictEqual(fy2425.totalDeductions, 40 + 400 + 60 + 25 + 5, "total deductions add the columns");
assert.deepStrictEqual(st.map((x) => x.person + x.fy), ["MeFY2024-25", "MeFY2023-24", "WifeFY2024-25"], "by person, newest year first");
assert.deepStrictEqual(L.statutoryByYear([]), []); assert.deepStrictEqual(L.statutoryByYear(null), []);
const sm = L.summary(rows);
assert.deepStrictEqual([sm.rows, sm.gross, sm.net, sm.pf, sm.professionalTax, sm.taxTds], [5, 555, 410, 55, 600, 90], "interest is not salary");
assert.deepStrictEqual(L.summary([]), { rows: 0, gross: 0, net: 0, deductions: 0, pf: 0, professionalTax: 0, taxTds: 0 });

// ── months in the ledger workbook ──
assert.strictEqual(L.ledgerMonth(new Date(2024, 5, 15)), "2024-06-01"); assert.strictEqual(L.ledgerMonth(45444), "2024-06-01", "Excel serial of 1 Jun 2024");
assert.strictEqual(L.ledgerMonth("2024-06"), "2024-06-01"); assert.strictEqual(L.ledgerMonth("Jun-2024"), "2024-06-01"); assert.strictEqual(L.ledgerMonth("June 2024"), "2024-06-01");
assert.strictEqual(L.ledgerMonth(20000), "", "20000 is below any real payslip date"); assert.notStrictEqual(L.ledgerMonth(20001), ""); assert.notStrictEqual(L.ledgerMonth(79999), ""); assert.strictEqual(L.ledgerMonth(80000), "", "80000 is past the range");
assert.strictEqual(L.ledgerMonth("garbage"), ""); assert.strictEqual(L.ledgerMonth(""), ""); assert.strictEqual(L.ledgerMonth(5), "", "small numbers are not dates"); assert.strictEqual(L.ledgerMonth(new Date("x")), "");

// ── reading the standard ledger workbook ──
const H = L.HEADINGS, label = (key) => [...L.EARNINGS, ...L.DEDUCTIONS].find((c) => c[0] === key)[1];
const sheetRow = (o = {}) => ({ [H.person]: "Me", [H.employer]: "TCS", [H.month]: "2026-07", [label("basicSalary")]: 80600, [label("hra")]: 64556, [label("specialAllowance")]: 31152, [label("conveyanceAllowance")]: 64556, [label("cityAllowance")]: 1800, [label("performancePay")]: 18900, [label("miscellaneous")]: 78600,
  [H.gross]: 340164, [label("pf")]: 9672, [label("professionalTax")]: 200, [label("taxTds")]: 47961, [label("healthInsurance")]: 3847, [H.totalDeductions]: 61680, [H.net]: 278484, [H.basis]: "Payslip", [H.note]: "", ...o });
let r = L.fromLedgerRows([sheetRow()]);
assert.strictEqual(r.records.length, 1); assert.deepStrictEqual([r.skipped.length, r.rejected.length], [0, 0]);
const rec = r.records[0];
assert.deepStrictEqual([rec.person, rec.source, rec.organization, rec.date, rec.type, rec.grossEarnings, rec.netSalary, rec.amount, rec.grossDeductions], ["Me", "TCS", "TCS", "2026-07-01", "Salary", 340164, 278484, 278484, 61680]);
for (const k of [...L.EARNING_KEYS, ...L.DEDUCTION_KEYS]) if (!["basicSalary","hra","specialAllowance","conveyanceAllowance","cityAllowance","performancePay","miscellaneous","pf","professionalTax","taxTds","healthInsurance"].includes(k)) assert.strictEqual(rec[k], 0, "empty column is 0: " + k);
assert.strictEqual(rec.conveyanceAllowance, 64556); assert.strictEqual(rec.leaveEncashment, 0, "every column is present, zero when empty (so old values can be cleared)"); assert.strictEqual(rec.otherDeductions, 0);
assert.deepStrictEqual(rec.components.hra, 64556); assert.strictEqual(rec.deductions.pf, 9672); assert.strictEqual(rec.components.leaveEncashment, undefined, "components list only non-zero columns");
assert.strictEqual(L.fromLedgerRows([sheetRow({ [H.person]: "Wife" })]).records[0].person, "Wife"); assert.strictEqual(L.fromLedgerRows([sheetRow({ [H.person]: "Archana" })]).records[0].person, "Me", "only 'Wife' means the wife");
// headings are matched ignoring case and spacing
const loose = {}; for (const [k, v] of Object.entries(sheetRow())) loose["  " + k.toUpperCase() + " "] = v;
assert.strictEqual(L.fromLedgerRows([loose]).records.length, 1, "heading case and spacing do not matter");
// rows that do not add up are rejected, with the reason; the limit is ₹2
r = L.fromLedgerRows([sheetRow({ [label("hra")]: 64554 })]); assert.strictEqual(r.records.length, 1, "earning columns 2 rupees short: accepted"); assert.strictEqual(r.records[0].hra, 64554);
r = L.fromLedgerRows([sheetRow({ [label("hra")]: 64553 })]); assert.strictEqual(r.records.length, 0, "3 rupees short: rejected"); assert.ok(/earning columns add to/.test(r.rejected[0].reasons.join()));
r = L.fromLedgerRows([sheetRow({ [H.net]: 278482 })]); assert.strictEqual(r.records.length, 1, "net 2 off: accepted");
r = L.fromLedgerRows([sheetRow({ [H.net]: 278481 })]); assert.strictEqual(r.records.length, 0, "net 3 off: rejected"); assert.ok(/is not net/.test(r.rejected[0].reasons.join()));
r = L.fromLedgerRows([sheetRow({ [H.totalDeductions]: 61683 })]); assert.strictEqual(r.records.length, 0, "stated total deductions 3 off: rejected"); assert.ok(/total deductions says/.test(r.rejected[0].reasons.join()));
r = L.fromLedgerRows([sheetRow({ [H.totalDeductions]: 61682 })]); assert.strictEqual(r.records.length, 1, "2 off: accepted");
r = L.fromLedgerRows([sheetRow({ [H.totalDeductions]: "" })]); assert.strictEqual(r.records.length, 1, "no stated total: the columns decide");
r = L.fromLedgerRows([{ [H.person]: "Me", [H.employer]: "X", [H.month]: "2024-01", [label("basicSalary")]: 1, [H.gross]: 1, [H.net]: 1 }]); assert.strictEqual(r.records.length, 1, "a gross of ₹1 is a gross");
r = L.fromLedgerRows([sheetRow({ [H.gross]: 0, [H.net]: 0 })]); assert.strictEqual(r.records.length, 0); assert.ok(/gross is missing/.test(r.rejected[0].reasons.join()));
// rows with no payslip behind them, and rows missing their key, are left alone
r = L.fromLedgerRows([sheetRow({ [H.basis]: "Sheet only (no payslip)" })]); assert.deepStrictEqual([r.records.length, r.skipped.length], [0, 1]);
r = L.fromLedgerRows([sheetRow({ [H.month]: "" })]); assert.deepStrictEqual([r.records.length, r.skipped.length], [0, 1]);
r = L.fromLedgerRows([sheetRow({ [H.employer]: "" })]); assert.deepStrictEqual([r.records.length, r.skipped.length], [0, 1]);
r = L.fromLedgerRows([{}, null]); assert.deepStrictEqual([r.records.length, r.skipped.length, r.rejected.length], [0, 0, 0], "blank lines are ignored");
assert.deepStrictEqual(L.fromLedgerRows(null), { records: [], skipped: [], rejected: [] });
// a deduction that is a credit (negative) and an earning that is a reversal both reconcile
r = L.fromLedgerRows([{ [H.person]: "Me", [H.employer]: "JLR", [H.month]: "2024-03", [label("leaveEncashment")]: 68333, [label("lta")]: -6226, [H.gross]: 62107, [label("taxTds")]: 49927, [label("healthInsurance")]: -3181, [H.totalDeductions]: 46746, [H.net]: 15361 }]);
assert.strictEqual(r.records.length, 1, JSON.stringify(r.rejected)); assert.strictEqual(r.records[0].healthInsurance, -3181);

// ── what an import would do ──
const app = (o) => ({ id: "x", person: "Me", source: "TCS", date: "2026-07-01", type: "Salary", grossEarnings: 340164, netSalary: 278484, amount: 278484, ...o });
const inc = (o = {}) => L.fromLedgerRows([sheetRow(o)]).records[0];
// nothing to change
let p = L.planImport([app({ ...inc(), id: "a" })], [inc()]);
assert.deepStrictEqual([p.adds.length, p.updates.length, p.same, p.conflicts.length, p.untouched.length], [0, 0, 1, 0, 0], "an identical row is 'same'");
// the same month on another day still matches (the app has month-end and first-of-month dates)
p = L.planImport([{ ...inc(), id: "a", date: "2026-07-31" }], [inc()]); assert.deepStrictEqual([p.adds.length, p.same], [0, 1], "day of month is ignored");
// a figure differs → one update listing what changes
p = L.planImport([{ ...inc(), id: "a", taxTds: 40000 }], [inc()]);
assert.strictEqual(p.updates.length, 1); assert.deepStrictEqual(p.updates[0].changes, { taxTds: [40000, 47961] }); assert.strictEqual(p.updates[0].id, "a");
// a rupee of difference counts (the plan reports it); a few paise do not
p = L.planImport([{ ...inc(), id: "a", pf: 9671 }], [inc()]); assert.strictEqual(p.updates.length, 1);
p = L.planImport([{ ...inc(), id: "a", pf: 9672.004 }], [inc()]); assert.strictEqual(p.updates.length, 0, "rounded to paise before comparing");
// no match → add; other person / other employer / other month do not match
p = L.planImport([{ ...inc(), id: "a", person: "Wife" }], [inc()]); assert.strictEqual(p.adds.length, 1, "other person");
p = L.planImport([{ ...inc(), id: "a", source: "JLR" }], [inc()]); assert.strictEqual(p.adds.length, 1, "other employer");
p = L.planImport([{ ...inc(), id: "a", date: "2026-08-01" }], [inc()]); assert.strictEqual(p.adds.length, 1, "other month"); assert.deepStrictEqual(p.untouched, ["a"], "the unmatched app row is reported and left alone");
// two app rows for one month: never guess
p = L.planImport([{ ...inc(), id: "a" }, { ...inc(), id: "b" }], [inc()]); assert.deepStrictEqual([p.conflicts.length, p.updates.length, p.adds.length], [1, 0, 0]); assert.deepStrictEqual(p.conflicts[0].ids, ["a", "b"]);
// rows that are not salary, or have no date, are never matched
p = L.planImport([{ id: "i", person: "Me", source: "TCS", date: "2026-07-01", type: "Interest", amount: 5 }, { id: "n", person: "Me", source: "TCS", date: "", type: "Salary", netSalary: 1 }], [inc()]); assert.strictEqual(p.adds.length, 1); assert.deepStrictEqual(p.untouched, []);
p = L.planImport(null, null); assert.deepStrictEqual([p.adds, p.updates, p.same, p.conflicts, p.untouched], [[], [], 0, [], []]);

// ── carrying the plan out ──
const old = Object.freeze({ id: "keep-me", person: "Me", source: "Quantiphi", organization: "Quantiphi", date: "2022-04-01", type: "Salary", sheetName: "Quantiphi-Salary", grossEarnings: 120194, netSalary: 98867, amount: 98867, basicSalary: 62500, hra: 31250, lta: 9375, specialAllowance: 15269, conveyanceAllowance: 1800, taxTds: 19327, pf: 1800 });
const q = L.fromLedgerRows([{ [H.person]: "Me", [H.employer]: "Quantiphi", [H.month]: "2022-04", [label("basicSalary")]: 62500, [label("hra")]: 31250, [label("lta")]: 9375, [label("specialAllowance")]: 15269, [label("fuelVehicle")]: 1800, [H.gross]: 120194, [label("pf")]: 1800, [label("professionalTax")]: 200, [label("taxTds")]: 19327, [H.net]: 98867, [H.note]: "", [H.basis]: "Payslip" }]).records;
const plan = L.planImport([old], q);
assert.deepStrictEqual(Object.keys(plan.updates[0].changes).sort(), ["conveyanceAllowance", "fuelVehicle", "grossDeductions", "professionalTax"], "vehicle fuel moves out of 'conveyance', professional tax appears");
let n = 0;
const out = L.applyPlan([old], plan, () => "new-" + ++n);
assert.strictEqual(out.length, 1); assert.strictEqual(out[0].id, "keep-me", "the row keeps its id"); assert.strictEqual(out[0].sheetName, "Quantiphi-Salary", "and its other fields"); assert.strictEqual(out[0].date, "2022-04-01", "and its date");
assert.strictEqual(out[0].conveyanceAllowance, 0, "the stale value is cleared"); assert.strictEqual(out[0].fuelVehicle, 1800); assert.strictEqual(out[0].professionalTax, 200); assert.strictEqual(out[0].grossDeductions, 21327);
assert.deepStrictEqual(out[0].components, { basicSalary: 62500, hra: 31250, lta: 9375, specialAllowance: 15269, fuelVehicle: 1800 }); assert.deepStrictEqual(out[0].deductions, { pf: 1800, professionalTax: 200, taxTds: 19327 });
assert.strictEqual(old.professionalTax, undefined, "the input list was not changed");
assert.ok(L.totals(out[0]).itemised && L.totals(out[0]).balanced, "after the import the row adds up");
// adds get a fresh id, existing rows not in the plan are left exactly as they were
const other = Object.freeze({ id: "o", person: "Me", source: "TCS", date: "2020-01-01", type: "Salary", netSalary: 1 });
const p2 = L.planImport([other], [inc()]); const out2 = L.applyPlan([other], p2, () => "new-1");
assert.strictEqual(out2.length, 2); assert.strictEqual(out2[0], other, "untouched row is the very same object"); assert.strictEqual(out2[1].id, "new-1"); assert.strictEqual(out2[1].date, "2026-07-01"); assert.ok(L.totals(out2[1]).balanced);
assert.deepStrictEqual(L.applyPlan([], { adds: [], updates: [] }, () => "z"), []);
// applying the same plan twice changes nothing the second time
const again = L.planImport(out, q); assert.deepStrictEqual([again.adds.length, again.updates.length, again.same], [0, 0, 1], "importing the same ledger again is a no-op");

console.log("salary-ledger-core tests passed");
