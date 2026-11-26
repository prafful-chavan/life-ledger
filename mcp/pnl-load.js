/**
 * Loads what the brokers' own reports say (profit, charges, dividends for each year) into state.brokerStatements, which the share
 * profit and loss panel shows next to the app's figures. Pure: takes the vault data, returns the new data. Nothing is guessed and
 * nothing is dropped quietly: a line that cannot be placed stops the load.
 */
const P = require("../pnl-core.js");

/** list = [{ owner, broker, fy, realised, options, charges, dividends, to, note, source }] → { ok:true, after, report } | { ok:false, error } */
function build(before, list) {
  if (!Array.isArray(list) || !list.length) return { ok: false, error: "There are no broker lines to load." };
  for (let i = 0; i < list.length; i++) {
    const s = P.statement(list[i]);
    if (!s) return { ok: false, error: `Line ${i + 1} cannot be placed (owner, broker, year and at least one figure are needed).` };
    if (!s.to) return { ok: false, error: `Line ${i + 1} (${s.broker} ${s.fy}) does not say how far its report reaches.` };
    if (!s.source) return { ok: false, error: `Line ${i + 1} (${s.broker} ${s.fy}) does not name its report.` };
  }
  const lines = P.clean(list);
  if (lines.length !== list.length) return { ok: false, error: "Two lines are for the same owner, broker and year." };
  // each kind beside its own app figures: shares from the recorded sales, funds from the tax engine, US from the report alone
  const realised = require("../tax-core.js").gains.buildLots({ mutualFunds: before.mutualFunds || [] }, 1).realised; // funds only
  const all = P.buildAll({ sales: before.sales || [], fundRealised: realised, statements: lines }), view = all.shares;
  const rows = P.KINDS.flatMap((kind) => all[kind].people.flatMap((p) => p.brokers.flatMap((b) => b.years.map((r) => ({ kind, owner: p.owner, broker: b.broker, fy: r.fy, status: r.status, app: r.app, reported: r.reported, diff: r.diff })))));
  return { ok: true, after: { ...before, brokerStatements: lines }, report: { lines: lines.length, previous: (before.brokerStatements || []).length, rows, totals: view.totals } };
}

/** The change may touch only brokerStatements, and every line in it must be a clean one. */
function guard(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) if (k !== "brokerStatements" && JSON.stringify(before[k]) !== JSON.stringify(after[k])) return false;
  const list = after.brokerStatements;
  return Array.isArray(list) && list.length > 0 && JSON.stringify(P.clean(list)) === JSON.stringify(list);
}

module.exports = { build, guard };
