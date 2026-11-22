// The Excel reader and the broker-file reader that sits on it.
const assert = require("assert"), fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const X = require("../mcp/xlsx-read.js"), F = require("../mcp/broker-files.js"), B = require("../broker-trades-core.js");

const crc = (() => { const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
/** A small zip: entries [{ name, data, deflate }]. */
function zip(entries, opts = {}) {
  const parts = [], cd = []; let off = 0;
  for (const e of entries) {
    const raw = Buffer.from(e.data), body = e.deflate ? zlib.deflateRawSync(raw) : raw, name = Buffer.from(e.name);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(e.deflate ? 8 : 0, 8); lh.writeUInt32LE(crc(raw), 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26); const ex = Buffer.alloc(opts.extra || 0, 7); lh.writeUInt16LE(ex.length, 28);
    parts.push(lh, name, ex, body);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(e.deflate ? 8 : 0, 10); ch.writeUInt32LE(crc(raw), 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt16LE(ex.length, 30); const cm = Buffer.alloc(opts.entryComment || 0, 9); ch.writeUInt16LE(cm.length, 32); ch.writeUInt32LE(off, 42);
    cd.push(ch, name, ex, cm); off += 30 + name.length + ex.length + body.length;
  }
  const cdBuf = Buffer.concat(cd), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(off, 16);
  const tail = Buffer.alloc(opts.comment || 0, 65); end.writeUInt16LE(tail.length, 20);
  return Buffer.concat([...parts, cdBuf, end, tail]);
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
/** An .xlsx from rows of text-or-number cells (null = empty cell). Strings go through the shared table, numbers are stored as numbers. */
function xlsx(rows, opts = {}) {
  const strings = []; const si = (s) => { let i = strings.indexOf(s); if (i < 0) i = strings.push(s) - 1; return i; };
  const L = (n) => { let s = ""; n++; while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); } return s; };
  const xmlRows = rows.map((r, i) => (r.length === 0 ? "" : `<row r="${i + 1}">${r.map((c, j) => (c == null ? "" : typeof c === "number" ? `<c r="${L(j)}${i + 1}"><v>${c}</v></c>` : `<c r="${L(j)}${i + 1}" t="s"><v>${si(c)}</v></c>`)).join("")}</row>`)).join("");
  const sheet = `<?xml version="1.0"?><worksheet><sheetData>${xmlRows}</sheetData></worksheet>`;
  const sst = `<?xml version="1.0"?><sst>${strings.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`;
  return zip([{ name: "[Content_Types].xml", data: "<x/>" }, { name: "xl/sharedStrings.xml", data: sst, deflate: opts.deflate !== false }, { name: "xl/worksheets/sheet1.xml", data: sheet, deflate: opts.deflate !== false }]);
}

// Reading values, gaps, blank rows, escapes
for (const deflate of [true, false]) {
  const rows = X.readXlsx(xlsx([["Name", "A & B <x>"], [], ["Qty", 12.5, null, "after gap"], [null, "lead"]], { deflate }));
  assert.deepStrictEqual(rows, [["Name", "A & B <x>"], [], ["Qty", "12.5", "", "after gap"], ["", "lead"]], deflate ? "deflated entries" : "stored entries");
}
// More than 26 columns and a cell with no value
assert.strictEqual(X.readXlsx(xlsx([Array.from({ length: 30 }, (_, i) => "c" + i)]))[0][29], "c29");
// Inline strings and escaped entities in the shared table
{
  const raw = zip([{ name: "xl/worksheets/sheet1.xml", data: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>inline &amp; ok</t></is></c><c r="B1"><v>3</v></c></row></sheetData></worksheet>' }]);
  assert.deepStrictEqual(X.readXlsx(raw), [["inline & ok", "3"]]);
}
// A real-world zip: extra fields in the headers, a comment on the entries and on the whole file, and several sheets (the lowest-numbered one is read, not the first listed)
{
  const sheet = (v) => `<worksheet><sheetData><row r="1"><c r="A1"><v>${v}</v></c></row></sheetData></worksheet>`;
  const buf = zip([{ name: "xl/worksheets/sheet10.xml", data: sheet(10) }, { name: "xl/worksheets/sheet2.xml", data: sheet(2), deflate: true }, { name: "xl/worksheets/sheet3.xml", data: sheet(3) }], { extra: 6, entryComment: 4, comment: 9 });
  assert.deepStrictEqual(X.readXlsx(buf), [["2"]]);
  assert.deepStrictEqual(Object.keys(X.unzip(buf)).sort(), ["xl/worksheets/sheet10.xml", "xl/worksheets/sheet2.xml", "xl/worksheets/sheet3.xml"]);
  const small = zip([{ name: "xl/worksheets/sheet1.xml", data: sheet(1) }]); assert.deepStrictEqual(X.readXlsx(small), [["1"]], "a zip with only the end record after the data");
  assert.throws(() => X.unzip(Buffer.concat([Buffer.alloc(80000, 1), small.subarray(small.length - 22)])), /damaged|not an/, "an end record whose directory is missing is refused");
  const huge = Buffer.concat([small, Buffer.alloc(80000, 0)]); assert.throws(() => X.readXlsx(huge), /not an \.xlsx/, "an end record further than a zip comment can reach is not found");
}
// Not an Excel file, and an Excel file with no sheet
assert.throws(() => X.readXlsx(Buffer.from("plain text, not a zip")), /not an \.xlsx/);
assert.throws(() => X.readXlsx(zip([{ name: "other.txt", data: "x" }])), /no sheet/);
assert.throws(() => X.readXlsx(Buffer.alloc(0)), /not an \.xlsx/);

// Dates
assert.strictEqual(X.excelDate(46003), "2025-12-12"); assert.strictEqual(X.excelDate("46000.0"), "2025-12-09"); assert.strictEqual(X.excelDate(46003.75), "2025-12-12", "the time of day is dropped");
assert.strictEqual(X.excelDate(20000), "1954-10-03", "the lowest day accepted");
assert.strictEqual(X.excelDate(19999), null); assert.strictEqual(X.excelDate(80001), null); assert.strictEqual(X.excelDate(80000), "2119-01-11", "the highest day accepted"); assert.strictEqual(X.excelDate("x"), null); assert.strictEqual(X.excelDate(""), null);
assert.strictEqual(X.excelDateTime(46346.63155092593), "2026-11-20T15:09:26"); assert.strictEqual(X.excelDateTime(46346), "2026-11-20T00:00:00"); assert.strictEqual(X.excelDateTime("46108.46386574074"), "2026-03-27T11:07:58"); assert.strictEqual(X.excelDateTime(19999), null); assert.strictEqual(X.excelDateTime(80001), null); assert.strictEqual(X.excelDateTime("x"), null); assert.strictEqual(X.excelDateTime(""), null); assert.strictEqual(X.excelDateTime(20000), "1954-10-03T00:00:00"); assert.strictEqual(X.excelDateTime(80000), "2119-01-11T00:00:00");
// CSV text
assert.strictEqual(X.toCSV([["a", "b,c", 'd"e'], ["x\ny", "", "z"]]), 'a,"b,c","d""e"\n"x\ny",,z');
assert.deepStrictEqual(B.parseCSV(X.toCSV([["a", "b,c", 'd"e'], ["1", "2", "3"]])), [["a", "b,c", 'd"e'], ["1", "2", "3"]], "round trip");

// Broker files: Groww (account lines above the table) and Upstox (Excel day numbers), and a plain CSV
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "xl-")), put = (n, b) => { const p = path.join(dir, n); fs.writeFileSync(p, b); return p; };
const gh = ["Stock name", "Symbol", "ISIN", "Type", "Quantity", "Value", "Exchange", "Exchange Order Id", "Execution date and time", "Order status"];
const groww = put("g.xlsx", xlsx([["Name", "Someone"], ["Unique Client Code", "123"], ["Order history for stocks from 01-04-2022 to 17-11-2026"], [], gh, [], ["TRENT LTD", "TRENT", "INE849A01020", "BUY", "1.0", "7588.0", "NSE", "1200", "23-09-2024 11:06 AM", "Executed"]]));
let t = B.parseFile(F.tradeFileText(groww), { owner: "Wife" }); assert.deepStrictEqual([t.format, t.errors.length, t.trades.length, t.trades[0].symbol, t.trades[0].date, t.trades[0].price], ["groww-history", 0, 1, "TRENT", "2024-09-23", 7588]);
const uh = ["Date", "Company", "Amount", "Exchange", "Segment", "Scrip Code", "Instrument Type", "Strike Price", "Expiry", "Trade Num", "Trade Time", "Side", "Quantity", "Price"];
const upstox = put("u.xlsx", xlsx([["UPSTOX SECURITIES"], ["UCC", "X1"], ["Report Time Period", "01-01-2025 To 01-01-2026"], [], uh, [46003, "BANK BEES", "612.42", "NSE", "EQ", "590106", "Equity", "0.0", null, "1997606", "11:43:16", "Sell", "1.0", "612.42"], ["From 19-Jul-2025, our Broking operations were transitioned"]]));
t = B.parseFile(F.tradeFileText(upstox), { owner: "Me" }); assert.deepStrictEqual([t.format, t.errors.length, t.trades.length, t.trades[0].symbol, t.trades[0].date, t.trades[0].side], ["upstox-tradebook", 0, 1, "BANKBEES", "2025-12-12", "sell"]);
// A table that starts on the first line, with several rows: every date is converted, and one that is already text is left as it is
{
  const two = put("u2.xlsx", xlsx([uh, [46003, "BANK BEES", "612.42", "NSE", "EQ", "590106", "Equity", "0.0", null, "1", "11:43:16", "Sell", "1.0", "612.42"], [46000, "NIFTY BEES", "292.21", "NSE", "EQ", "590103", "Equity", "0.0", null, "2", "10:41:48", "Buy", "1.0", "292.21"], ["2025-01-06", "N100", "235.68", "NSE", "EQ", "533385", "Equity", "0.0", null, "3", "10:42:48", "Buy", "1.0", "235.68"]]));
  const r = B.parseFile(F.tradeFileText(two), { owner: "Me" }); assert.deepStrictEqual([r.errors.length, r.trades.map((x) => x.date)], [0, ["2025-12-12", "2025-12-09", "2025-01-06"]]);
  const g1 = put("g1.xlsx", xlsx([gh, ["TRENT LTD", "TRENT", "INE849A01020", "BUY", "1.0", "7588.0", "NSE", "1200", "23-09-2024 11:06 AM", "Executed"]])); assert.strictEqual(B.parseFile(F.tradeFileText(g1), { owner: "Wife" }).trades.length, 1, "Groww table on line 1");
}
// INDmoney report: the day-number-with-time becomes a date-time and the empty "no transactions" workbook reads as no trades
{
  const ih = ["Execution Date", "Scrip Name", "Scrip Symbol", "ISIN", "Type", "Quantity", "Price", "Exchange", "Exchange Order Id", "Order Status"];
  const f = put("i.xlsx", xlsx([["Equity transactions report"], [], ["Name", "Someone"], ["Unique client code", "X1"], [], [], ih, [46346.63155092593, "Bharat 22 ETF", "ICICIB22", "INF109KB15Y7", "SELL", "311", "118.98", "NSE", "1100000107309617", "Executed"], ["2025-01-09", "Bharat 22 ETF", "ICICIB22", "INF109KB15Y7", "BUY", "49", "102.61", "NSE", "5", "Executed"]]));
  const r = B.parseFile(F.tradeFileText(f), { owner: "Wife" }); assert.deepStrictEqual([r.format, r.errors.length, r.trades.map((t) => [t.time, t.symbol, t.side])], ["indmoney-transactions", 0, [["2026-11-20T15:09:26", "BHARAT22", "sell"], ["2025-01-09T00:00:00", "BHARAT22", "buy"]]]);
  const empty = put("ie.xlsx", xlsx([["Equity transactions report"], [], ih, ["No transactions done in this period"]])); const e = B.parseFile(F.tradeFileText(empty), { owner: "Wife" }); assert.deepStrictEqual([e.format, e.trades.length, e.errors.length], ["indmoney-transactions", 0, 0]);
}
assert.strictEqual(F.tradeFileText(put("p.csv", "a,b\n1,2\n")), "a,b\n1,2\n", "a CSV is read as it is");
assert.throws(() => F.tradeFileText(put("o.xlsx", xlsx([["just", "some"], ["other", "sheet"]]))), /no Groww, Upstox or INDmoney trade table/);
fs.rmSync(dir, { recursive: true });
console.log("mcp-xlsx-read tests passed");
