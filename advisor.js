/**
 * Life Ledger — Wealth Advisor: live controller + the "Wealth Advisor" page + dashboard summary card.
 *
 * Signals and per-holding verdicts (free, instant) come from LifeLedgerAdvisor. The AI (Gemini/OpenRouter)
 * only explains them in plain words and is validated by LifeLedgerAdvisorAI. Everything re-runs when prices
 * refresh or your data changes; the AI re-runs only when something material changed.
 */
(function () {
  "use strict";

  const AI_MIN_GAP_MS = 30 * 60 * 1000;
  const AI_ERROR_BACKOFF_MS = 15 * 60 * 1000;
  const BENCH = { nifty: "^NSEI", sp500: "^GSPC", gold: "GOLDBEES.NS" };
  const PRESETS = {
    conservative: { equity: 25, gold: 10, debt: 55, cash: 10 },
    moderate: { equity: 45, gold: 10, debt: 40, cash: 5 },
    "moderate-aggressive": { equity: 65, gold: 10, debt: 20, cash: 5 },
    aggressive: { equity: 80, gold: 10, debt: 5, cash: 5 },
  };
  const ASK = [
    "Which of my mutual funds are doing well and which are not?",
    "Which of my stocks should I worry about?",
    "Where should my next ₹50,000 go?",
    "How can I get out of debt faster?",
    "Is my money safe if there is an emergency?",
    "Am I on track for my goals?",
  ];

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
  let activeTab = "mf";
  let sortMode = "attention";
  let shownSignalIds = [];

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (v) => "₹" + Math.round(Number(v) || 0).toLocaleString("en-IN");
  const signedPct = (v) => (v == null ? "—" : (v >= 0 ? "+" : "−") + Math.abs(Math.round(v * 10) / 10) + "%");
  const cls = (v) => (v == null ? "" : v >= 0 ? "pos" : "neg");

  // ── price history: shared loader (cached on this device) ─────────────────
  const PH = () => window.LifeLedgerPriceHistory;
  const toSeries = (s) => PH().toSeries(s);
  async function loadHistory(keys, network = true) {
    const series = await PH().load(keys, { network });
    histStatus = PH().status();
    return series;
  }

  // ── analysis ──────────────────────────────────────────────────────────────
  async function analyse(opts = {}) {
    if (!window.LifeLedgerApp || !window.LifeLedgerAuth?.isUnlocked?.()) return;
    if (running) { rerun = true; return; }
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
      input = withSeries(await loadHistory(keys, false));
      result = Engine().analyze(input);
      render();
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

  function schedule(opts) { clearTimeout(timer); timer = setTimeout(() => analyse(opts), 1500); }

  // ── AI advice ─────────────────────────────────────────────────────────────
  const stored = () => (window.LifeLedgerApp?.getAdvisorState?.() || {}).review || null;
  const aiAvailable = () => Boolean(window.LifeLedgerAI?.isAiAvailable?.());

  function maybeAutoReview() {
    const profile = window.LifeLedgerApp.getAdvisorState().profile || {};
    if (profile.autoReview === false || !aiAvailable() || !result || aiRunning) return;
    if (Date.now() < aiBackoffUntil) return;
    const rev = stored();
    if (rev && rev.fingerprint === AI().fingerprint(result)) return;
    if (rev && Date.now() - new Date(rev.at).getTime() < AI_MIN_GAP_MS) return;
    generateReview();
  }

  async function generateReview() {
    if (aiRunning || !result) return;
    if (!aiAvailable()) { lastError = "Add a Gemini (free) key in Settings → AI Agent to get the written advice."; render(); return; }
    aiRunning = true;
    render();
    try {
      const raw = await window.LifeLedgerAI.generateStructured({
        system: AI().SYSTEM_PROMPT,
        user: "PORTFOLIO DATA (JSON):\n" + JSON.stringify(AI().buildBrief(result, input)),
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
  const scoreWord = (s) => (s >= 80 ? ["Strong", "strong"] : s >= 65 ? ["Good", "good"] : s >= 50 ? ["Fair", "fair"] : ["Needs work", "low"]);

  function ring(score, small) {
    const [word, c] = scoreWord(score);
    return `<div class="adv-ring ${c}${small ? " sm" : ""}" style="--p:${score}" title="Overall health: ${word}"><div><strong>${score}</strong><small>${small ? "" : "out of 100"}</small></div></div>`;
  }

  /** Plain one-paragraph summary when there is no AI text. */
  function ruleSummary() {
    const m = result.metrics;
    const urgent = result.signals.filter((s) => s.severity === "act").length;
    const watch = result.signals.filter((s) => s.severity === "watch").length;
    const parts = [`Your savings and investments add up to ${inr(m.total)}${m.returnPct != null ? `, about ${Math.abs(m.returnPct)}% ${m.returnPct >= 0 ? "more" : "less"} than you put in` : ""}.`];
    if (urgent) parts.push(`${urgent} thing${urgent > 1 ? "s need" : " needs"} your attention first.`);
    else if (watch) parts.push(`Nothing is urgent, but ${watch} thing${watch > 1 ? "s are" : " is"} worth watching.`);
    else parts.push("Nothing needs your attention right now.");
    if (result.strengths[0]) parts.push(result.strengths[0]);
    return parts.join(" ");
  }

  function currentReview() {
    const rev = stored();
    if (!rev || !rev.review || !rev.review.moves) return { review: null, stale: false, at: null };
    return { review: rev.review, stale: rev.fingerprint !== AI().fingerprint(result), at: rev.at };
  }

  function moveCard(n, m) {
    const evidence = (m.evidence || []).map((w) => `<li>${esc(w)}</li>`).join("");
    return `<article class="adv-move ${esc(m.severity || "")}">
      <div class="adv-num">${n}</div>
      <div>
        <h4>${esc(m.title)}</h4>
        ${m.whatToDo ? `<p class="adv-do">👉 ${esc(m.whatToDo)}</p>` : ""}
        ${m.why ? `<p>${esc(m.why)}</p>` : ""}
        ${evidence ? `<details class="adv-more"><summary>See the numbers</summary><ul class="adv-h-why">${evidence}</ul></details>` : ""}
        ${m.risk ? `<p class="adv-small">Keep in mind: ${esc(m.risk)}</p>` : ""}
        <span class="adv-chip">${esc(m.actionLabel || m.action)}</span>
      </div>
    </article>`;
  }

  function signalAsMove(s) {
    return { severity: s.severity, title: s.title, whatToDo: "", why: (s.why || [])[0] || "", evidence: (s.why || []).slice(1), actionLabel: s.actionLabel, action: s.action };
  }

  function renderPillars() {
    $("advPillars").innerHTML = result.pillars.map((p) => `<div class="adv-pillar ${p.level}">
        <div class="adv-pillar-name">${p.emoji} ${esc(p.label)}</div>
        <div class="adv-bar"><i style="width:${p.score}%"></i></div>
        <div class="adv-pillar-line">${esc(p.line)}</div>
      </div>`).join("") || `<p class="adv-empty">Add some holdings and expenses to see your financial health.</p>`;
  }

  function renderMoves(rv) {
    let html = "";
    let shown = [];
    if (rv.review && rv.review.moves.length) {
      html += rv.review.moves.map((m, i) => moveCard(i + 1, m)).join("");
      shown = rv.review.moves.flatMap((m) => m.signalIds);
      if (rv.review.nextMonthPlan && rv.review.nextMonthPlan.length) html += `<details class="adv-more"><summary>Plan for next month</summary><ul class="adv-list">${rv.review.nextMonthPlan.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>`;
      if (rv.review.taxNote) html += `<p class="adv-small">🧾 ${esc(rv.review.taxNote)}</p>`;
      if (rv.stale) html += `<p class="adv-small">These notes were written a little earlier and your numbers have moved since. ${aiRunning ? "Updating…" : "Tap “Get AI advice” to refresh."}</p>`;
    } else {
      const top = result.signals.filter((s) => s.severity !== "info").slice(0, 4);
      const list = top.length ? top : result.signals.slice(0, 3);
      shown = list.map((s) => s.id);
      html += list.length ? list.map((s, i) => moveCard(i + 1, signalAsMove(s))).join("") : `<p class="adv-empty">Nothing needs doing right now. Keep investing regularly.</p>`;
      if (aiAvailable()) html += `<p class="adv-small">Tap “Get AI advice” for a written plan in plain words.</p>`;
    }
    shownSignalIds = shown;
    const rest = result.signals.filter((s) => !shown.includes(s.id));
    if (rest.length) html += `<details class="adv-more"><summary>Everything else I noticed (${rest.length})</summary>${rest.map((s, i) => moveCard(i + 1, signalAsMove(s))).join("")}</details>`;
    $("advMoves").innerHTML = html;
  }

  function renderGoodWatch(rv) {
    const good = rv.review && rv.review.good && rv.review.good.length ? rv.review.good : result.strengths;
    $("advGood").innerHTML = good.length ? good.map((t) => `<li>${esc(t)}</li>`).join("") : `<li class="adv-empty">Nothing stands out yet — add more data and this will fill in.</li>`;
    // "watch" = the other things worth keeping an eye on, not a repeat of the steps above
    const others = result.signals.filter((s) => s.severity !== "info" && !shownSignalIds.includes(s.id)).slice(0, 4).map((s) => s.title);
    const watch = rv.review && rv.review.watchOut && rv.review.watchOut.length ? rv.review.watchOut : others;
    $("advWatch").innerHTML = watch.length ? watch.map((t) => `<li>${esc(t)}</li>`).join("") : `<li class="adv-empty">Nothing else beyond the steps above.</li>`;
  }

  // ── per-investment scorecards ────────────────────────────────────────────
  const ORDER_ATTENTION = { poor: 0, weak: 1, nodata: 2, ok: 3, good: 4, great: 5, safe: 6 };
  const ORDER_BEST = { great: 0, good: 1, ok: 2, nodata: 3, weak: 4, poor: 5, safe: 6 };

  function vsBars(h) {
    if (h.r1y == null || h.vs1yBenchmark == null) return "";
    const mkt = Math.round((h.r1y - h.vs1yBenchmark) * 10) / 10;
    const max = Math.max(10, Math.abs(h.r1y), Math.abs(mkt));
    const bar = (v, c) => { const w = Math.round((Math.abs(v) / max) * 50); const left = v >= 0 ? 50 : 50 - w; return `<i class="${c}" style="left:${left}%;width:${w}%"></i>`; };
    const label = h.cls === "us" ? "US market" : h.cls === "gold" ? "Gold" : "Nifty 50";
    return `<div class="adv-vs">
      <div class="adv-vs-row"><span>This one</span><div class="adv-vs-track">${bar(h.r1y, "me")}</div><b class="${cls(h.r1y)}">${signedPct(h.r1y)}</b></div>
      <div class="adv-vs-row"><span>${label}</span><div class="adv-vs-track">${bar(mkt, "mkt")}</div><b>${signedPct(mkt)}</b></div>
      <div>Return over the last year</div></div>`;
  }

  function holdingCard(h, notes) {
    const v = h.verdict;
    const note = notes && notes[h.key];
    const money = h.groupKey === "safe"
      ? `<div><b>${inr(h.value)}</b><span>Worth now</span></div><div><b>${h.weight}%</b><span>Of your money</span></div>`
      : `<div><b>${inr(h.value)}</b><span>Worth now</span></div><div><b>${inr(h.invested)}</b><span>You put in</span></div><div><b class="${cls(h.returnPct)}">${signedPct(h.returnPct)}</b><span>Gain so far</span></div>`;
    return `<article class="adv-h ${v.status}">
      <div class="adv-h-top"><strong>${esc(h.name)}</strong><span class="adv-chip">${esc(v.label)}</span></div>
      <div class="adv-h-nums">${money}</div>
      ${vsBars(h)}
      <p class="adv-h-head">${esc(v.headline)}</p>
      ${v.reasons.length ? `<ul class="adv-h-why">${v.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
      ${note ? `<p class="adv-h-note">💬 ${esc(note)}</p>` : ""}
      <div class="adv-h-move">What to do: ${esc(v.moveLabel)}</div>
    </article>`;
  }

  function loansHtml() {
    const debts = result.liabilities;
    if (!debts.length) return `<p class="adv-empty">You have no loans on record. 🎉</p>`;
    const totalDebt = debts.reduce((s, d) => s + d.value, 0);
    const emi = debts.reduce((s, d) => s + d.emi, 0);
    const income = input.cash && input.cash.monthlyIncome;
    const strip = `<div class="adv-strip"><div><b>${inr(totalDebt)}</b><span>You owe</span></div><div><b>${inr(emi)}</b><span>EMIs per month</span></div>${income ? `<div><b>${Math.round((emi / income) * 100)}%</b><span>Of your income</span></div>` : ""}</div>`;
    const cards = debts.slice().sort((a, b) => (b.rate || 0) - (a.rate || 0)).map((d) => {
      const high = d.rate >= Engine().CFG.debtActRate;
      const mid = d.rate >= Engine().CFG.debtWatchRate && !high;
      const status = !d.rate ? "nodata" : high ? "poor" : mid ? "weak" : "good";
      const label = !d.rate ? "Rate not set" : high ? "Expensive loan" : mid ? "Fairly costly" : "Reasonable rate";
      const advice = !d.rate ? "Add the interest rate in Finance → Liabilities so I can judge it." : high ? "Pay this off faster than your other goals; it costs more than most investments earn." : mid ? "Consider paying a little extra when you can." : "Fine to keep paying on schedule.";
      return `<article class="adv-h ${status}">
        <div class="adv-h-top"><strong>${esc(d.name)}</strong><span class="adv-chip">${label}</span></div>
        <div class="adv-h-nums"><div><b>${inr(d.value)}</b><span>You owe</span></div><div><b>${d.emi ? inr(d.emi) : "—"}</b><span>EMI per month</span></div><div><b>${d.rate ? d.rate + "%" : "—"}</b><span>Interest a year</span></div></div>
        ${d.yearlyInterest ? `<p class="adv-h-head">About ${inr(d.yearlyInterest)} a year goes to interest.</p>` : ""}
        <div class="adv-h-move">What to do: ${esc(advice)}</div></article>`;
    }).join("");
    return strip + `<div class="adv-holdings">${cards}</div>`;
  }

  function renderTabs(rv) {
    const tabs = result.groups.map((g) => ({ key: g.key, label: g.label, count: g.count }));
    tabs.push({ key: "loans", label: "Loans", count: result.liabilities.length });
    if (!tabs.some((t) => t.key === activeTab)) activeTab = tabs[0].key;
    $("advTabs").innerHTML = tabs.map((t) => `<button type="button" class="adv-tab${t.key === activeTab ? " active" : ""}" data-tab="${t.key}">${esc(t.label)}<small>${t.count}</small></button>`).join("");
    const box = $("advGroup");
    if (activeTab === "loans") { box.innerHTML = loansHtml(); return; }
    const g = result.groups.find((x) => x.key === activeTab);
    if (!g) { box.innerHTML = `<p class="adv-empty">No investments of this kind yet.</p>`; return; }
    const list = g.keys.map((k) => result.holdings.find((h) => h.key === k)).filter(Boolean);
    const order = sortMode === "best" ? ORDER_BEST : ORDER_ATTENTION;
    list.sort((a, b) => (order[a.verdict.status] - order[b.verdict.status]) || b.value - a.value);
    const good = (g.counts.great || 0) + (g.counts.good || 0);
    const bad = (g.counts.weak || 0) + (g.counts.poor || 0);
    const strip = `<div class="adv-strip">
      <div><b>${inr(g.value)}</b><span>Worth now</span></div>
      ${g.returnPct != null ? `<div><b class="${cls(g.returnPct)}">${signedPct(g.returnPct)}</b><span>Gain vs what you put in</span></div>` : ""}
      <div><b>${g.weight}%</b><span>Of all your money</span></div>
      ${g.key !== "safe" && g.key !== "other" ? `<div><b>${good} doing well · ${bad} falling behind</b><span>Out of ${g.count}</span></div>` : ""}
    </div>`;
    const sorter = g.key === "safe" ? "" : `<div class="adv-sort">Show: <button type="button" data-sort="attention" class="${sortMode === "attention" ? "active" : ""}">Needs a look first</button><button type="button" data-sort="best" class="${sortMode === "best" ? "active" : ""}">Best first</button></div>`;
    box.innerHTML = strip + sorter + `<div class="adv-holdings">${list.map((h) => holdingCard(h, rv.review && rv.review.holdingNotes)).join("")}</div>`;
  }

  function renderCard(rv) {
    const card = $("advisorCard");
    if (!card) return;
    card.hidden = false;
    $("advCardScore").innerHTML = ring(result.score, true);
    $("advCardSummary").textContent = rv.review && rv.review.summary ? rv.review.summary : ruleSummary();
    const moves = rv.review && rv.review.moves.length ? rv.review.moves.slice(0, 3).map((m) => m.title) : result.signals.filter((s) => s.severity !== "info").slice(0, 3).map((s) => s.title);
    $("advCardMoves").innerHTML = moves.map((t) => `<li>${esc(t)}</li>`).join("");
  }

  function render() {
    if (!result) return;
    const rv = currentReview();
    renderCard(rv);
    if (!$("advisor")) return;
    $("advScore").innerHTML = ring(result.score);
    $("advSummary").textContent = rv.review && rv.review.summary ? rv.review.summary : ruleSummary();
    const when = new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
    $("advMeta").textContent = `Live · ${result.holdings.length} investments · ${inr(result.metrics.total)} · updated ${when}` + (result.profileSet ? "" : " · Tell me about your goals (⚙) so I can judge against your plan");
    renderPillars();
    renderMoves(rv);
    renderGoodWatch(rv);
    renderTabs(rv);

    const bits = [];
    if (histStatus) bits.push(histStatus);
    if (aiRunning) bits.push("The AI advisor is writing your advice…");
    else if (rv.at) bits.push(`AI advice written ${new Date(rv.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`);
    else if (!aiAvailable()) bits.push("Add a Gemini key in Settings to get written advice");
    if (lastError) bits.push("⚠ " + lastError);
    $("advisorStatus").textContent = bits.join(" · ");
    $("advisorDisclaimer").textContent = (rv.review && rv.review.disclaimer) || AI().DISCLAIMER;
    const btn = $("advisorReviewBtn");
    if (btn) { btn.disabled = aiRunning; btn.textContent = aiRunning ? "Writing advice…" : "✨ Get AI advice"; }
  }

  // ── "about you" form ─────────────────────────────────────────────────────
  function fillProfile() {
    const saved = window.LifeLedgerApp.getAdvisorState().profile || {};
    const prof = { ...Engine().DEFAULT_PROFILE, ...saved };
    const t = { ...Engine().DEFAULT_PROFILE.target, ...(saved.target || {}) };
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    document.querySelectorAll('input[name="advRisk"]').forEach((r) => { r.checked = r.value === prof.risk; });
    set("advHorizon", prof.horizonYears); set("advTEquity", t.equity); set("advTGold", t.gold); set("advTDebt", t.debt); set("advTCash", t.cash);
    set("advInvestable", prof.monthlyInvestable || ""); set("advSip", prof.sipTarget || ""); set("advEmergency", prof.emergencyMonths);
    const auto = $("advAutoReview"); if (auto) auto.checked = prof.autoReview !== false;
    $("advProfileMsg").textContent = "";
  }

  async function saveProfile(ev) {
    ev.preventDefault();
    const n = (id) => Number($(id).value) || 0;
    const msg = $("advProfileMsg");
    const risk = (document.querySelector('input[name="advRisk"]:checked') || {}).value || "moderate-aggressive";
    const target = { equity: n("advTEquity"), gold: n("advTGold"), debt: n("advTDebt"), cash: n("advTCash") };
    const total = target.equity + target.gold + target.debt + target.cash;
    if (Math.abs(total - 100) > 0.01) { msg.textContent = `Your ideal mix adds up to ${total}% — it needs to total 100%.`; return; }
    await window.LifeLedgerApp.setAdvisorState({ profile: {
      risk, horizonYears: n("advHorizon") || 15, target,
      monthlyInvestable: n("advInvestable"), sipTarget: n("advSip"), emergencyMonths: n("advEmergency") || 6,
      autoReview: $("advAutoReview").checked,
    } });
    $("advisorProfile").hidden = true;
    analyse({ history: false });
  }

  function askHeyPrafful(question) {
    document.querySelector('.nav-item[data-view="assistant"]')?.click();
    setTimeout(() => {
      const box = $("chatInput");
      if (!box) return;
      box.value = question;
      $("chatForm")?.requestSubmit();
    }, 150);
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  window.addEventListener("load", () => {
    $("advisorRefreshBtn")?.addEventListener("click", () => analyse());
    $("advisorReviewBtn")?.addEventListener("click", () => generateReview());
    $("advisorProfileBtn")?.addEventListener("click", () => { const p = $("advisorProfile"); fillProfile(); p.hidden = !p.hidden; if (!p.hidden) p.scrollIntoView({ behavior: "smooth", block: "start" }); });
    $("advisorProfile")?.addEventListener("submit", saveProfile);
    $("advisorProfileCancel")?.addEventListener("click", () => { $("advisorProfile").hidden = true; });
    document.querySelectorAll('input[name="advRisk"]').forEach((r) => r.addEventListener("change", () => {
      const t = PRESETS[r.value]; if (!t) return;
      $("advTEquity").value = t.equity; $("advTGold").value = t.gold; $("advTDebt").value = t.debt; $("advTCash").value = t.cash;
    }));
    $("advOpenBtn")?.addEventListener("click", () => document.querySelector('.nav-item[data-view="advisor"]')?.click());
    $("advTabs")?.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { activeTab = b.dataset.tab; render(); } });
    $("advGroup")?.addEventListener("click", (e) => { const b = e.target.closest("[data-sort]"); if (b) { sortMode = b.dataset.sort; render(); } });
    const ask = $("advAsk");
    if (ask) { ask.innerHTML = ASK.map((q) => `<button type="button">${esc(q)}</button>`).join(""); ask.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) askHeyPrafful(b.textContent); }); }

    window.addEventListener("ll:prices-updated", () => schedule());
    window.addEventListener("ll:data-changed", () => schedule({ history: false }));
    document.addEventListener("visibilitychange", () => { if (!document.hidden) schedule(); });
    window.LifeLedgerSync?.onStatus((st) => { if (st.state === "synced") schedule({ history: false }); });
    setTimeout(() => schedule(), 3000);
    setInterval(() => { if (!document.hidden) schedule({ history: false }); }, 10 * 60 * 1000);
  });

  // ── Hey Prafful gets the full briefing + tools that read any list in the app ──
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
