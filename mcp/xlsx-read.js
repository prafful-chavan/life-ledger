/**
 * Reads the first sheet of an .xlsx file into rows of text (pure Node: zip directory + inflate; no dependencies).
 * Broker exports are plain tables, so values are read as stored: numbers as their text, strings from the shared table.
 * Dates in these files are Excel day numbers; use excelDate() to turn one into YYYY-MM-DD.
 */
const zlib = require("node:zlib");

const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, "&");

/** { name → Buffer } for every file in a zip held in memory (stored and deflated entries). */
function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("This is not an .xlsx file (no zip directory).");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const out = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("The zip directory is damaged.");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nlen);
    const lh = off, lnl = buf.readUInt16LE(lh + 26), lxl = buf.readUInt16LE(lh + 28), start = lh + 30 + lnl + lxl;
    const raw = buf.subarray(start, start + csize);
    out[name] = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

const colIndex = (letters) => letters.split("").reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Rows of cell text from the first sheet. Empty rows come back as []. */
function readXlsx(buf) {
  const files = unzip(buf);
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]))[0];
  if (!sheetName || !files[sheetName]) throw new Error("The workbook has no sheet to read.");
  const strings = [];
  if (files["xl/sharedStrings.xml"]) for (const m of files["xl/sharedStrings.xml"].toString("utf8").matchAll(/<si>([\s\S]*?)<\/si>/g)) strings.push(unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join("")));
  const xml = files[sheetName].toString("utf8"), rows = [];
  for (const r of xml.matchAll(/<row\b[^>]*?\br="(\d+)"[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = [];
    for (const c of (r[2] || "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (c[1].match(/\br="([A-Z]+)\d+"/) || [])[1]; if (!ref) continue;
      const type = (c[1].match(/\bt="(\w+)"/) || [])[1], body = c[2] || "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/), inl = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
      row[colIndex(ref)] = type === "s" && v ? (strings[+v[1]] ?? "") : inl ? unesc(inl[1]) : v ? unesc(v[1]) : "";
    }
    rows[+r[1] - 1] = Array.from(row, (x) => (x == null ? "" : x));
  }
  return Array.from(rows, (r) => r || []);
}

/** An Excel day number (days since 1899-12-30) as YYYY-MM-DD; null when it is not a whole plausible date. */
function excelDate(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 20000 || x > 80000) return null;
  return new Date(Math.round((Math.floor(x) - 25569) * 86400000)).toISOString().slice(0, 10);
}

/** Rows as CSV text (cells with a comma, quote or line break are quoted). */
const toCSV = (rows) => rows.map((r) => r.map((c) => (/[",\n\r]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c))).join(",")).join("\n");

module.exports = { unzip, readXlsx, excelDate, toCSV };
