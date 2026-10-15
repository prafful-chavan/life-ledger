/**
 * Life Ledger — Wealth Advisor controller + dashboard panel.
 *
 * Live signals (free, instant) come from LifeLedgerAdvisor; the AI review (Gemini/OpenRouter) only
 * explains them and is validated by LifeLedgerAdvisorAI. Everything is re-run when prices refresh
 * or your data changes; the AI is re-run only when something material changed (and not too often).
 */
(function () {
  "use strict";

  const HIST_KEY = "lifeLedgerAdvisorHistory:v1";
  const HIST_TTL_MS = 12 * 60 * 60 * 1000;
  const AI_MIN_GAP_MS = 30 * 60 * 1000;      // at most one automatic AI review per 30 minutes
  const AI_ERROR_BACKOFF_MS = 15 * 60 * 1000;
  const BENCH = { nifty: "^NSEI", sp500: "^GSPC", gold: "GOLDBEES.NS" };

  const Engine = () => window.LifeLedgerAdvisor;
  const AI = () => window.LifeLedgerAdvisorAI;
  const $ = (id) => document.getElementById(id);

  let result = null;
  let input = null;
  let running = false;
  let rerun = false;
  let aiRunning = false;
  let aiBackoffUntil = 0;
  let lastError = "";
  let histStatus = "";
  let timer = null;

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (v) => "₹" + Math.round(Number(v) || 0).toLocaleString("en-IN");

  // ── price history (cached on this device) ─────────────────────────────────
  function readHistCache() {
    try { return JSON.parse(localStorage.getItem(HIST_KEY) || "null") || { at: 0, series: {} }; } catch { return { at: 0, series: {} }; }
  }
  function writeHistCache(c) {
    try { localStorage.setItem(HIST_KEY, JSON.stringify(c)); } catch { /* quota: fine, refetch next time */ }
  }

  function proxyUrl() {
    try { return (localStorage.getItem("lifeLedgerStockProxyUrl") || "").trim().replace(/^["']|["']$/g, "").replace(/\?+$/, ""); } catch { return ""; }
  }

  // network=false: use whatever is cached on this device (instant, no requests)
  async function loadHistory(keys, network = true) {
    const cache = readHistCache();
    const fresh = Date.now() - cache.at < HIST_TTL_MS;
    const need = keys.filter((k) => !cache.series[k] || !fresh);
    const url = proxyUrl();
    if (!network) return cache.series;
    if (need.length && url) {
      histStatus = "Loading price history…";
      for (let i = 0; i < need.length; i += 40) {
        const chunk = need.slice(i, i + 40);
        try {
          const res = await fetch(`${url}?history=${encodeURIComponent(chunk.join(","))}&days=400`, { redirect: "follow" });
          const json = await res.json();
          if (json && json.series) Object.assign(cache.series, json.series);
        } catch (err) {
          histStatus = "Price history unavailable — signals that need it are paused.";
        }
      }
      cache.at = Date.now();
      writeHistCache(cache);
      if (histStatus.startsWith("Loading")) histStatus = "";
    } else if (!url) {
      histStatus = "Add your Apps Script URL in Settings to unlock trend signals.";
    }
    return cache.series;
  }

  const toSeries = (s) => (s && s.d && s.c ? { dates: s.d, closes: s.c } : null);

  // ── analysis ──────────────────────────────────────────────────────────────
  async function analyse(opts = {}) {
    if (!window.LifeLedgerApp || !window.LifeLedgerAuth?.isUnlocked?.()) return;
    if (running) { rerun = true; return; }   // data changed mid-run: go again once this finishes
    running = true;
    try {
      input = window.LifeLedgerApp.getAdvisorInput();
      const keys = [...new Set([...input.holdings.map((h) => h.histKey).filter(Boolean), ...Object.values(BENCH)])];
      const withSeries = (hist) => {
        const series = {};
        input.holdings.forEach((h) => { const s = toSeries(hist[h.histKey]); if (s) series[h.key] = s; });
        const benchmarks = {};
        Object.entries(BENCH).forEach(([name, key]) => { const s = toSeries(hist[key]); if (s) benchmarks[name] = s; });
        return { ...input, series, benchmarks };
      };
      // 1) instant pass from cached history so the panel is never empty or flickering
      input = withSeries(await loadHistory(keys, false));
      result = Engine().analyze(input);
      render();
      // 2) refresh history from the network when stale or missing (cached 12h), then re-analyse
      if (opts.history !== false) {
        input = withSeries(await loadHistory(keys, true));
        result = Engine().analyze(input);
      }
      lastError = "";
      render();
      maybeAutoReview();
    } catch (err) {
      console.warn("[Advisor] analysis failed:", err);
      lastError = err.message;
      render();
    } finally {
      running = false;
      if (rerun) { rerun = false; schedule({ history: false }); }
    }
  }

  function schedule(opts) {
    clearTimeout(timer);
    timer = setTimeout(() => analyse(opts), 1500);
  }

  // ── AI review ─────────────────────────────────────────────────────────────
  const stored = () => (window.LifeLedgerApp?.getAdvisorState?.() || {}).review || null;

  function aiAvailable() {
    return Boolean(window.LifeLedgerAI?.isAiAvailable?.());
  }

  function maybeAutoReview() {
    const profile = (window.LifeLedgerApp.getAdvisorState().profile) || {};
    if (profile.autoReview === false || !aiAvailable() || !result || aiRunning) return;
    if (Date.now() < aiBackoffUntil) return;
    const rev = stored();
    const fp = AI().fingerprint(result);
    if (rev && rev.fingerprint === fp) return;
    if (rev && Date.now() - new Date(rev.at).getTime() < AI_MIN_GAP_MS) return;
    generateReview({ auto: true });
  }

  async function generateReview() {
    if (aiRunning || !result) return;
    if (!aiAvailable()) { lastError = "Add a Gemini (free) key in Settings → AI Agent to enable the AI review."; render(); return; }
    aiRunning = true;
    render();
    try {
      const brief = AI().buildBrief(result, input);
      const raw = await window.LifeLedgerAI.generateStructured({
        system: AI().SYSTEM_PROMPT,
        user: "PORTFOLIO DATA (JSON):\n" + JSON.stringify(brief),
        temperature: 0.3,
      });
      const v = AI().validateReview(raw, result);
      await window.LifeLedgerApp.setAdvisorState({
        review: { at: new Date().toISOString(), fingerprint: AI().fingerprint(result), review: v.review, dropped: v.dropped.length, provider: window.LifeLedgerAI.getActiveProvider() },
      });
      lastError = "";
    } catch (err) {
      lastError = err.message;
      aiBackoffUntil = Date.now() + AI_ERROR_BACKOFF_MS;
    } finally {
      aiRunning = false;
      render();
    }
  }

  // ── rendering ─────────────────────────────────────────────────────────────
  const SEV = { act: ["Act now", "advisor-sev-act"], watch: ["Watch", "advisor-sev-watch"], info: ["Opportunity / note", "advisor-sev-info"] };
  const ACT_ICON = { ADD: "＋", HOLD: "●", REVIEW: "🔍", TRIM: "✂", REBALANCE: "⚖", PREPAY: "💳", BUILD: "🛡" };

  function chip(text, cls) { return `<span class="advisor-chip ${cls || ""}">${esc(text)}</span>`; }

  function signalCard(s) {
    return `<article class="advisor-card ${SEV[s.severity] ? SEV[s.severity][1] : ""}">
      <div class="advisor-card-head"><span class="advisor-act">${ACT_ICON[s.action] || "•"} ${esc(s.action)}</span><strong>${esc(s.title)}</strong></div>
      <ul>${(s.why || []).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      <div class="advisor-card-foot">${chip("confidence: " + s.confidence)}</div>
    </article>`;
  }

  function reviewCard(a) {
    return `<article class="advisor-card ${SEV[a.severity] ? SEV[a.severity][1] : ""}">
      <div class="advisor-card-head"><span class="advisor-act">${ACT_ICON[a.action] || "•"} ${esc(a.action)}</span><strong>${esc(a.asset)}</strong></div>
      <p class="advisor-summary">${esc(a.summary)}</p>
      ${a.rationale ? `<p>${esc(a.rationale)}</p>` : ""}
      <ul class="advisor-evidence">${(a.evidence || []).map((w) => `<li>${esc(w)}</li>`).join("")}</ul>
      ${a.risk ? `<p class="advisor-risk">Risk: ${esc(a.risk)}</p>` : ""}
      <div class="advisor-card-foot">${chip("confidence: " + a.confidence)}</div>
    </article>`;
  }

  function scoreBadge(score) {
    const cls = score >= 80 ? "good" : score >= 60 ? "ok" : "low";
    return `<div class="advisor-score ${cls}" title="Portfolio health score (0–100)"><span>${score}</span><small>health</small></div>`;
  }

  function render() {
    const panel = $("advisorPanel");
    if (!panel) return;
    const profileSet = window.LifeLedgerApp?.getAdvisorState?.();
    if (!result) { panel.hidden = true; return; }
    panel.hidden = false;

    const rev = stored();
    const review = rev && rev.review;
    const m = result.metrics;
    const live = $("advisorMeta");
    if (live) {
      live.textContent = `Live · ${result.holdings.length} positions · ${inr(m.total)} · updated ${new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` +
        (m.returnPct != null ? ` · ${m.returnPct >= 0 ? "+" : ""}${m.returnPct}% vs cost` : "");
    }
    const scoreEl = $("advisorScoreWrap");
    if (scoreEl) scoreEl.innerHTML = scoreBadge(result.score);

    const head = $("advisorHeadline");
    if (head) {
      head.innerHTML = review && review.headline
        ? `<strong>${esc(review.headline)}</strong>${review.healthComment ? `<br><span>${esc(review.healthComment)}</span>` : ""}`
        : `<strong>${result.signals.filter((s) => s.severity === "act").length} urgent · ${result.signals.filter((s) => s.severity === "watch").length} to watch · ${result.signals.filter((s) => s.severity === "info").length} opportunities</strong>`;
    }

    const body = $("advisorBody");
    if (body) {
      let html = "";
      if (review && review.actions && review.actions.length) {
        html += `<h4 class="advisor-h">Analyst priorities</h4><div class="advisor-grid">${review.actions.map(reviewCard).join("")}</div>`;
        if (review.nextMonthPlan && review.nextMonthPlan.length) html += `<h4 class="advisor-h">Next month</h4><ul class="advisor-plan">${review.nextMonthPlan.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
        if (review.watchlist && review.watchlist.length) html += `<h4 class="advisor-h">Keep an eye on</h4><ul class="advisor-plan">${review.watchlist.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`;
        if (review.taxNote) html += `<p class="advisor-tax">🧾 ${esc(review.taxNote)}</p>`;
        html += `<details class="advisor-more"><summary>All live signals (${result.signals.length})</summary><div class="advisor-grid">${result.signals.map(signalCard).join("")}</div></details>`;
      } else {
        ["act", "watch", "info"].forEach((sev) => {
          const list = result.signals.filter((s) => s.severity === sev);
          if (list.length) html += `<h4 class="advisor-h">${SEV[sev][0]}</h4><div class="advisor-grid">${list.map(signalCard).join("")}</div>`;
        });
        if (!result.signals.length) html = `<p class="advisor-empty">No signals right now — allocation, cash-flow and holdings are within your guard-rails.</p>`;
      }
      body.innerHTML = html;
    }

    const status = $("advisorStatus");
    if (status) {
      const bits = [];
      if (histStatus) bits.push(histStatus);
      if (aiRunning) bits.push("AI analyst is reviewing…");
      else if (rev) bits.push(`AI review ${new Date(rev.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`);
      else if (!aiAvailable()) bits.push("Add a Gemini key in Settings for the AI analyst's written review");
      if (lastError) bits.push("⚠ " + lastError);
      status.textContent = bits.join(" · ");
    }
    const disc = $("advisorDisclaimer");
    if (disc) disc.textContent = (review && review.disclaimer) || AI().DISCLAIMER;
    const reviewBtn = $("advisorReviewBtn");
    if (reviewBtn) { reviewBtn.disabled = aiRunning; reviewBtn.textContent = aiRunning ? "Reviewing…" : "✨ AI review"; }
    void profileSet;
  }

  // ── profile form ──────────────────────────────────────────────────────────
  function fillProfile() {
    const prof = { ...Engine().DEFAULT_PROFILE, ...(window.LifeLedgerApp.getAdvisorState().profile || {}) };
    const t = { ...Engine().DEFAULT_PROFILE.target, ...(prof.target || {}) };
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    set("advRisk", prof.risk); set("advHorizon", prof.horizonYears);
    set("advTEquity", t.equity); set("advTGold", t.gold); set("advTDebt", t.debt); set("advTCash", t.cash);
    set("advInvestable", prof.monthlyInvestable || ""); set("advSip", prof.sipTarget || ""); set("advEmergency", prof.emergencyMonths);
    const auto = $("advAutoReview"); if (auto) auto.checked = prof.autoReview !== false;
    const msg = $("advProfileMsg"); if (msg) msg.textContent = "";
  }

  async function saveProfile(ev) {
    ev.preventDefault();
    const n = (id) => Number($(id).value) || 0;
    const target = { equity: n("advTEquity"), gold: n("advTGold"), debt: n("advTDebt"), cash: n("advTCash") };
    const total = target.equity + target.gold + target.debt + target.cash;
    const msg = $("advProfileMsg");
    if (Math.abs(total - 100) > 0.01) { msg.textContent = `Targets add up to ${total}% — they must total 100%.`; return; }
    const profile = {
      risk: $("advRisk").value, horizonYears: n("advHorizon") || 15, target,
      monthlyInvestable: n("advInvestable"), sipTarget: n("advSip"), emergencyMonths: n("advEmergency") || 6,
      autoReview: $("advAutoReview").checked,
    };
    await window.LifeLedgerApp.setAdvisorState({ profile });
    msg.textContent = "Saved.";
    $("advisorProfile").hidden = true;
    analyse({ history: false });
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  window.addEventListener("load", () => {
    $("advisorRefreshBtn")?.addEventListener("click", () => analyse());
    $("advisorReviewBtn")?.addEventListener("click", () => generateReview());
    $("advisorProfileBtn")?.addEventListener("click", () => { const p = $("advisorProfile"); fillProfile(); p.hidden = !p.hidden; });
    $("advisorProfile")?.addEventListener("submit", saveProfile);
    $("advisorProfileCancel")?.addEventListener("click", () => { $("advisorProfile").hidden = true; });

    // live mode: run whenever prices refresh, data changes, or you come back to the app
    window.addEventListener("ll:prices-updated", () => schedule());
    window.addEventListener("ll:data-changed", () => schedule({ history: false }));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
    window.LifeLedgerSync?.onStatus((st) => { if (st.state === "synced") schedule({ history: false }); });
    setTimeout(() => schedule(), 3000);
    setInterval(() => { if (!document.hidden) schedule({ history: false }); }, 10 * 60 * 1000);
  });

  // Give Hey Prafful the full picture: portfolio briefing in every context, plus tools that query ANY
  // list in the app (see knowledge.js). New features are discovered automatically.
  function portfolioText() {
    const Ctx = window.LifeLedgerAdvisorContext;
    const app = window.LifeLedgerApp;
    if (!app || !Engine() || !Ctx) return "";
    const inp = input || app.getAdvisorInput();
    const res = result || Engine().analyze(inp);
    const rev = stored();
    return Ctx.build({ result: res, input: inp, extras: app.getAdvisorExtras(), review: rev && rev.review });
  }

  function registerChatContext() {
    const AIm = window.LifeLedgerAI;
    if (!AIm) return;
    if (AIm.setContextProvider && window.LifeLedgerAdvisorContext) AIm.setContextProvider(() => portfolioText());
    const K = window.LifeLedgerKnowledge;
    const KM = window.LifeLedgerKnowledgeModules;
    if (K && KM && AIm.attachKnowledge) {
      AIm.attachKnowledge(K, () => window.LifeLedgerApp.getState());
      KM.register(K, () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10), () => portfolioText());
    }
  }
  window.addEventListener("load", registerChatContext);

  window.LifeLedgerAdvisorUI = { analyse, generateReview, getResult: () => result };
})();
