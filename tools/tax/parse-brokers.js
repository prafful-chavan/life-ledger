/** Parsers for the broker statements the household downloads (Zerodha tax P&L, Groww capital gains, Upstox tax report). Pure given a workbook. */
const X = require("../../vendor/xlsx-0.20.3.full.min.js");
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const rowsOf = (wb, sheet) => X.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "" });
const labelValue = (rows, re) => { const r = rows.find((r) => typeof r[0] === "string" && re.test(r[0].replace(/\s+/g, " ")) && r[1] !== "" && !isNaN(Number(r[1]))); return r ? n(r[1]) : 0; };

function zerodhaTaxPnl(wb) {
  const eq = rowsOf(wb, "Equity and Non Equity"), tw = rowsOf(wb, wb.SheetNames[0]);
  const dv = wb.SheetNames.includes("Dividends & Interest") ? rowsOf(wb, "Dividends & Interest") : [];
  const mf = wb.SheetNames.includes("Mutual Funds") ? rowsOf(wb, "Mutual Funds") : [];
  const fo = ["F&O", "Currency", "Commodity"].filter((s) => wb.SheetNames.includes(s)).map((s) => rowsOf(wb, s));
  return {
    broker: "Zerodha", intraday: labelValue(eq, /^Equity Intraday\/Spec/), stcg: labelValue(eq, /^Equity Short Term pro/), ltcg: labelValue(eq, /^Equity Long Term pro/),
    stcgBeforeJul23: labelValue(tw, /^STCG before July 23/), stcgAfterJul23: labelValue(tw, /^STCG after July 23/), ltcgBeforeJul23: labelValue(tw, /^LTCG before July 23/), ltcgAfterJul23: labelValue(tw, /^LTCG after July 23/),
    dividends: labelValue(dv, /^Total Dividend/), interest: labelValue(dv, /^Total Interest/),
    mfShort: labelValue(mf, /Short Term/i), mfLong: labelValue(mf, /Long Term/i),
    foPnl: fo.reduce((t, r) => t + labelValue(r, /Options Realized Profit/) + labelValue(r, /Futures Realized Profit/), 0),
  };
}

function growwStocks(wb) {
  const r = rowsOf(wb, wb.SheetNames[0]);
  return { broker: "Groww", intraday: labelValue(r, /^Intraday P&L/), stcg: labelValue(r, /^Short Term P&L/), ltcg: labelValue(r, /^Long Term P&L/), dividends: labelValue(r, /^Dividends/), buyback: labelValue(r, /^Buyback P&L/) };
}

function growwMf(wb) {
  const r = rowsOf(wb, wb.SheetNames[0]);
  const row = (re) => r.find((x) => typeof x[2] === "string" && re.test(x[2]));
  const eq = row(/^Equity$/), d1 = row(/^Debt \(Specified/), d2 = row(/^Debt \(Unspecified/);
  const st = (x) => (x ? n(x[3]) : 0), lt = (x) => (x ? n(x[4]) : 0);
  return { broker: "MF (Groww/CAMS)", equityShort: st(eq), equityLong: lt(eq), debtShort: st(d1) + st(d2), debtLong: lt(d1) + lt(d2) };
}

function upstox(wb) {
  const sum = rowsOf(wb, wb.SheetNames[0]);
  const head = sum.findIndex((x) => String(x[3]).trim() === "Short Term" && String(x[4]).trim() === "Long Term");
  const t = head >= 0 ? sum.slice(head).find((x) => String(x[0]).trim() === "TOTAL") : null;
  const fyRaw = (sum.find((x) => /Financial Year/.test(x[0])) || [])[1];
  const fy = fyRaw ? `20${String(fyRaw).slice(0, 2)}-${String(fyRaw).slice(2)}` : null;
  const g = (label) => n((sum.find((x) => String(x[0]).trim() === label) || [])[1]);
  return { broker: "Upstox", fy, stcg: t ? n(t[3]) : 0, ltcg: t ? n(t[4]) : 0, intraday: t ? n(t[5]) : 0, grossPnl: g("Gross P&L"), netPnl: g("Net P&L") };
}

module.exports = { zerodhaTaxPnl, growwStocks, growwMf, upstox };
