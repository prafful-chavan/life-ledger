/**
 * Life Ledger MCP — daily price history (public market data only) through the same Apps Script proxy the app uses.
 * Keys are Yahoo tickers ("TCS.NS", "AAPL", "^NSEI") and "mf:<AMFI code>". Nothing about holdings or amounts is sent.
 */
async function fetchHistory(gatewayUrl, keys, { days = 400, fetchImpl = fetch, chunk = 40 } = {}) {
  const series = {};
  const failures = [];
  for (let i = 0; i < keys.length; i += chunk) {
    const part = keys.slice(i, i + chunk);
    try {
      const res = await fetchImpl(`${gatewayUrl}?history=${encodeURIComponent(part.join(","))}&days=${days}`, { redirect: "follow" });
      const json = JSON.parse(await res.text());
      if (json && json.series) Object.assign(series, json.series); else failures.push(...part);
    } catch { failures.push(...part); }
  }
  return { series, failedKeys: failures };
}
module.exports = { fetchHistory };
