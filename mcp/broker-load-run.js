#!/usr/bin/env node
/**
 * Loads Zerodha tradebook / Groww order-history CSV files into the vault (see broker-load.js).
 *   node mcp/broker-load-run.js --owner Me --demat Zerodha FILE... [--sale SYMBOL:YYYY-MM-DD[:charges[:Company name]]] [--write]
 * Without --write it only shows what would happen. The vault password comes from the macOS keychain (or the cloud secrets).
 */
const fs = require("fs");
const BTC = require("../broker-trades-core.js"), L = require("./broker-load.js"), V = require("./vault-client.js"), Common = require("./cloud-common.js");

(async () => {
  const argv = process.argv.slice(2), files = [], sales = []; let owner = "Me", demat = "Zerodha", write = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--owner") owner = argv[++i]; else if (a === "--demat") demat = argv[++i]; else if (a === "--write") write = true;
    else if (a === "--sale") { const [symbol, date, charges, ...name] = String(argv[++i] || "").split(":"); sales.push({ owner, demat, symbol, date, charges: Number(charges || 0), name: name.join(":") || symbol }); }
    else files.push(a);
  }
  if (!files.length) { console.error("Give at least one tradebook CSV file."); process.exit(1); }
  const trades = [];
  for (const f of files) {
    const r = BTC.parseFile(fs.readFileSync(f, "utf8"), { owner, demat, source: f.split("/").pop() });
    console.log(`${f.split("/").pop()}: ${r.format || "NOT RECOGNISED"}, ${r.trades.length} trades${r.skipped ? `, ${r.skipped} skipped` : ""}${r.errors.length ? ", " + r.errors.join("; ") : ""}`);
    if (!r.format || r.errors.length) { console.error("Stopped: a file could not be read."); process.exit(2); }
    trades.push(...r.trades);
  }
  const login = Common.login(process.env);
  const { data } = await V.fetchState({ gatewayUrl: login.gatewayUrl, password: login.password });
  const today = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const out = L.build(data, trades, { today, sales });
  if (!out.ok) { console.error("Stopped: " + out.error); process.exit(2); }
  const r = out.report;
  console.log(`Trades kept: ${r.trades} (${r.added} new, ${r.duplicates} already kept). Holdings by status: ${JSON.stringify(r.status)}`);
  for (const a of r.applied) console.log(`  dated ${a.symbol}: ${a.lots} lots${a.unknownQty ? `, ${a.unknownQty} shares undated` : ""}`);
  for (const s of r.skipped) console.log(`  skipped ${s.key}: ${s.why}`);
  for (const s of r.sales) console.log(s.skipped ? `  sale ${s.symbol} ${s.date}: ${s.skipped}` : `  sale ${s.symbol} ${s.date}: ${s.qty} shares at ${s.price}, gross ${s.gross}, charges ${s.charges}, cost ${s.cost}, ${s.gain < 0 ? "loss" : "gain"} ${Math.abs(s.gain)} (${s.lots} lots)`);
  for (const o of r.oversold) console.log(`  note: ${o.symbol} sells ${o.oversold} shares more than the files show bought (a split or bonus not in the table, or an earlier file)`);
  if (!write) { console.log("Dry run: nothing written. Add --write to save."); return; }
  const res = await V.updateWith({ gatewayUrl: login.gatewayUrl, password: login.password, make: (b) => L.build(b, trades, { today, sales }).after, guard: L.guard, expectCount: L.expectCount(V) });
  console.log(`Saved to the vault (rev ${res.rev}).`);
})().catch((e) => { console.error(e.message); process.exit(1); });
