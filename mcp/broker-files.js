/** Reads a broker file from disk as CSV text: .csv as it is; .xlsx through the Excel reader, from the table's own header row down (the lines above it, which hold a name and an account code, are dropped). */
const fs = require("fs");
const { readXlsx, excelDate, excelDateTime, toCSV } = require("./xlsx-read.js");

const lower = (r) => r.map((c) => String(c).trim().toLowerCase());
const isGrowwHead = (h) => h.includes("stock name") && h.includes("symbol") && h.includes("execution date and time");
const isIndmoneyHead = (h) => h.includes("execution date") && h.includes("scrip symbol") && h.includes("exchange order id");
const isUpstoxHead = (h) => h.includes("date") && h.includes("company") && h.includes("trade num") && h.includes("scrip code");

function tradeFileText(path) {
  if (!/\.xlsx$/i.test(path)) return fs.readFileSync(path, "utf8");
  const rows = readXlsx(fs.readFileSync(path));
  const at = rows.findIndex((r) => isGrowwHead(lower(r)) || isUpstoxHead(lower(r)) || isIndmoneyHead(lower(r)));
  if (at < 0) throw new Error("This workbook has no Groww, Upstox or INDmoney trade table in it.");
  const body = rows.slice(at).filter((r) => r.some((c) => String(c).trim() !== ""));
  if (isUpstoxHead(lower(body[0]))) { const d = lower(body[0]).indexOf("date"); for (const r of body.slice(1)) { const iso = excelDate(r[d]); if (iso) r[d] = iso; } }
  if (isIndmoneyHead(lower(body[0]))) { const d = lower(body[0]).indexOf("execution date"); for (const r of body.slice(1)) { const t = excelDateTime(r[d]); if (t) r[d] = t; } }
  return toCSV(body);
}
module.exports = { tradeFileText };
