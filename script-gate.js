/**
 * Life Ledger — Apps Script request governor.
 *
 * Your Apps Script serves sync, prices, price history and Dropbox checks. When the app and its background
 * tasks hit it all at once it slows to 15–60 s per call and sometimes answers with an error page. This wraps
 * fetch for script.google.com calls so that:
 *   • at most maxParallel requests are in flight,
 *   • urgent calls (sync, ping, prices) go first; bulk history/ledger lookups run one at a time,
 *   • every request has a timeout (callers that bring their own abort signal keep it).
 * Everything else (Yahoo, Gemini, Dropbox, same-origin files) passes straight through.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else {
    const gate = factory(root, {});
    root.LifeLedgerScriptGate = gate;
    // Never run inside someone else's frame (a hidden frame could trick a tap on your own screen). GitHub Pages cannot send
    // X-Frame-Options, so the page checks for itself.
    if (root.top !== root.self) {
      try { root.document.documentElement.innerHTML = ""; } catch { /* nothing to clear */ }
      throw new Error("Life Ledger does not run inside a frame.");
    }
    // Install: route every fetch through the governor (script.google.com calls are queued; the rest pass through).
    if (root.fetch && !root.__scriptGateInstalled) {
      root.__scriptGateInstalled = true;
      root.fetch = gate;
    }
  }
})(typeof self !== "undefined" ? self : this, function (root, overrides) {
  const cfg = Object.assign({ maxParallel: 3, maxBulk: 1, timeouts: [30000, 45000, 60000] }, overrides || {});
  const nativeFetch = cfg.fetch || (root.fetch ? root.fetch.bind(root) : null);
  const isScript = (url) => /^https:\/\/script\.google(?:usercontent)?\.com\/(?:macros|a\/macros)\//.test(url);

  /** 0 = urgent (sync/ping), 1 = prices, 2 = bulk background (history, ledger, watchlist, name resolving). */
  function priorityOf(url, init) {
    if (init && String(init.method || "").toUpperCase() === "POST") return 0;
    if (/[?&](syncMeta|ping|test)=/.test(url)) return 0;
    if (/[?&](history|ledger|registerWatch|resolveMf|resolveMfMany|resolveIsin|collect)=/.test(url)) return 2;
    return 1;
  }

  const queue = [];
  let active = 0;
  let activeBulk = 0;
  let seq = 0;
  const stats = { sent: 0, timedOut: 0, maxQueued: 0 };

  function start(job) {
    active++;
    if (job.prio === 2) activeBulk++;
    stats.sent++;
    const ctl = new AbortController();
    let timer = null;
    const init = Object.assign({}, job.init);
    if (!init.signal) {
      init.signal = ctl.signal;
      timer = setTimeout(() => { stats.timedOut++; ctl.abort(); }, cfg.timeouts[job.prio]);
    }
    let p;
    try { p = nativeFetch(job.input, init); } catch (e) { p = Promise.reject(e); }
    p.then(job.resolve, job.reject).finally(() => {
      if (timer) clearTimeout(timer);
      active--;
      if (job.prio === 2) activeBulk--;
      pump();
    });
  }

  function pump() {
    while (active < cfg.maxParallel && queue.length) {
      const i = queue.findIndex((j) => j.prio !== 2 || activeBulk < cfg.maxBulk);
      if (i === -1) return;
      start(queue.splice(i, 1)[0]);
    }
  }

  function gatedFetch(input, init) {
    const url = typeof input === "string" ? input : (input && input.url) || "";
    if (!isScript(url)) return nativeFetch(input, init);
    return new Promise((resolve, reject) => {
      const sig = init && init.signal;
      if (sig && sig.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      const job = { input, init, resolve, reject, prio: priorityOf(url, init), seq: seq++ };
      if (sig) sig.addEventListener("abort", () => {
        const i = queue.indexOf(job);
        if (i !== -1) { queue.splice(i, 1); reject(new DOMException("Aborted", "AbortError")); }
      }, { once: true });
      queue.push(job);
      queue.sort((a, b) => a.prio - b.prio || a.seq - b.seq);
      stats.maxQueued = Math.max(stats.maxQueued, queue.length);
      pump();
    });
  }

  gatedFetch.stats = () => ({ ...stats, active, queued: queue.length });
  gatedFetch.priorityOf = priorityOf;
  gatedFetch.isScript = isScript;
  return gatedFetch;
});
