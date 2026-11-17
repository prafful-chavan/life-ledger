/**
 * Life Ledger — daily balance sync from INDmoney, pure.
 *
 * ref = { fetchedAt, members: { Me|Wife: { savings_account, digital_assets, bond, silver } } } (current values, as INDmoney
 * reports them; written by the nightly task from get_family_portfolio). plan() says which app records to change, which
 * to leave alone and why. Only these record fields are ever touched, and only `value` and `date` on them:
 *   banksaving <- savings_account, crypto <- digital_assets, bonds <- bond, silver <- silver
 * Not synced on purpose: gold (the app prices it itself), PPF/EPF/FD/others (INDmoney only repeats what was typed in).
 */
const MAP = { banksaving: "savings_account", crypto: "digital_assets", bonds: "bond", silver: "silver" };
const FIELDS = Object.keys(MAP);
const OWNERS = ["Me", "Wife"];
const NAME = { Me: "Prafful", Wife: "Archana" };
const MAX_FALL = 0.4; // a FALL bigger than this is shown for the household to confirm, not applied (a linked account can drop off); rises are applied
const validISO = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !Number.isNaN(Date.parse(s));
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

function plan(data, ref, { today, maxFall = MAX_FALL } = {}) {
  const changes = [], skipped = [], same = [], problems = [];
  if (!validISO(today)) throw new Error("today must be YYYY-MM-DD");
  if (!ref || !ref.members || typeof ref.members !== "object") { problems.push("The INDmoney copy is missing"); return { changes, skipped, same, problems, status: "bad-reference" }; }
  if (ref.fetchedAt !== today) { problems.push(`The INDmoney copy is from ${ref.fetchedAt || "an unknown day"}, not today`); return { changes, skipped, same, problems, status: "bad-reference" }; }
  for (const field of FIELDS) {
    for (const owner of OWNERS) {
      const rows = ((data && data[field]) || []).filter((r) => r && r.owner === owner);
      const m = ref.members[owner];
      const raw = m ? m[MAP[field]] : undefined;
      const to = num(raw);
      const who = `${NAME[owner]} ${field}`;
      if (!rows.length) { if (Number.isFinite(to) && to > 0) skipped.push({ field, owner, reason: "no-record", to, text: `${who}: INDmoney has ₹${Math.round(to)} but the app has no record to update` }); continue; }
      if (rows.length > 1) { skipped.push({ field, owner, reason: "many-records", text: `${who}: ${rows.length} records, cannot tell which one INDmoney means` }); continue; }
      const row = rows[0], from = num(row.value);
      if (!Number.isFinite(to) || to < 0) { skipped.push({ field, owner, reason: "no-value", text: `${who}: INDmoney gave no usable value` }); continue; }
      if (to === 0 && from > 0) { skipped.push({ field, owner, reason: "zero", from, text: `${who}: INDmoney shows 0 but the app has ₹${Math.round(from)}; left alone (a linked account may have dropped off)` }); continue; }
      const next = Math.round(to);
      if (Number.isFinite(from) && Math.round(from) === next) { same.push({ field, owner, id: row.id, value: next }); continue; }
      if (Number.isFinite(from) && from > 0 && (from - next) / from > maxFall) { skipped.push({ field, owner, reason: "big-fall", from, to: next, text: `${who}: ₹${Math.round(from)} to ₹${next} is a fall of more than ${Math.round(maxFall * 100)}%; not applied, please confirm` }); continue; }
      changes.push({ field, owner, id: row.id, from: Math.round(from) || 0, to: next, date: today });
    }
  }
  return { changes, skipped, same, problems, status: "ok" };
}

/** Returns a copy of data with only value and date changed on the planned records. */
function apply(data, changes) {
  const out = { ...data };
  for (const c of changes) {
    if (!FIELDS.includes(c.field)) throw new Error(`Not allowed: ${c.field}`);
    out[c.field] = (out[c.field] || []).map((r) => (r.id === c.id ? { ...r, value: c.to, date: c.date } : r));
  }
  return out;
}

/** True only when after differs from before by value/date on records of the synced fields, nothing else. */
function onlyValuesChanged(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const k of keys) {
    if (JSON.stringify(before[k]) === JSON.stringify(after[k])) continue;
    if (k === "balanceSync") { if (!after[k] || typeof after[k] !== "object" || Array.isArray(after[k])) return false; continue; }
    if (!FIELDS.includes(k)) return false;
    const a = before[k] || [], b = after[k] || [];
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id) return false;
      const x = { ...a[i], value: 0, date: "" }, y = { ...b[i], value: 0, date: "" };
      if (JSON.stringify(x) !== JSON.stringify(y)) return false;
    }
  }
  return true;
}

const LABEL = { banksaving: "Bank savings", crypto: "Crypto", bonds: "Gold bond (SGB)", silver: "Silver" };

/**
 * What the morning email, the health watch and the app show about a run: saved with the values in the same push as the
 * vault field `balanceSync`. status: ok (nothing held back), held (something needs the household to confirm), failed.
 */
function report(p, today) {
  const failed = p.status !== "ok";
  return {
    checkedOn: today, source: "INDmoney",
    status: failed ? "failed" : p.skipped.length ? "held" : "ok",
    updated: p.changes.map((c) => ({ owner: c.owner, field: c.field, label: LABEL[c.field], from: c.from, to: c.to })),
    same: p.same.length,
    held: p.skipped.map((x) => ({ owner: x.owner, field: x.field, label: LABEL[x.field], reason: x.reason, text: x.text })),
    problems: p.problems.slice(0, 3),
  };
}

function summary(p) {
  const bits = [];
  if (p.status === "bad-reference") return `not saved: ${p.problems.join("; ")}`;
  bits.push(`${p.changes.length} updated, ${p.same.length} already right, ${p.skipped.length} left alone`);
  return bits.join(", ");
}

module.exports = { MAP, FIELDS, MAX_FALL, LABEL, plan, apply, onlyValuesChanged, report, summary };
