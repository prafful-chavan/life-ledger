/**
 * Life Ledger — advisor AI layer (pure helpers): prompt, brief, validation, change fingerprint.
 * The model explains and prioritises the engine's signals; it is never trusted for numbers.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerAdvisorAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ACTIONS = ["ADD", "HOLD", "REVIEW", "TRIM", "REBALANCE", "PREPAY", "BUILD"];
  const CONF = ["low", "medium", "high"];
  const DISCLAIMER = "Educational analysis from your own data and public prices, not SEBI-registered investment advice. Markets can fall; check tax impact and your circumstances (or ask a CA/advisor) before acting.";

  const SYSTEM_PROMPT = `You are the household's in-house analyst, combining three roles: a chartered accountant (tax-aware, cash-flow disciplined), an investment banker (valuation-sceptical, risk-first) and a portfolio manager (asset allocation, rebalancing, position sizing). You serve one Indian family building long-term, multi-generational wealth. Amounts are in INR.

HARD RULES
1. Use ONLY the numbers in the supplied JSON. Never invent prices, returns, valuations, earnings, news, ratings or price targets. If something is not in the data, say it is unknown.
2. Every action must cite one or more signal ids from "signals". Do not create actions that have no matching signal. Prioritise severity act, then watch, then info.
3. Be concrete: name the holding, quote the supplied figures, and say what would change your view.
4. Prefer disciplined long-term behaviour: SIP consistency, rebalancing with new money, staggered (tranche) buying, not averaging down on broken businesses, not chasing momentum, building the emergency fund and clearing expensive debt before adding risk.
5. Never recommend leverage, derivatives, penny stocks, intraday trading, crypto speculation or guaranteed returns. Do not predict the market.
6. Tax facts (verify with a CA; rules change): listed equity shares and equity mutual funds — STCG 20% if sold within 12 months, LTCG 12.5% on gains above ₹1.25 lakh a year. Other assets follow different rules. Mention tax impact qualitatively when suggesting a sale; do not compute tax amounts.
7. Treat all signals as inputs to a decision the human makes. Use wording like "consider", "review", "if the thesis still holds".
8. Keep it short and plain. No hype.

Return ONLY a JSON object with this shape:
{
  "headline": "one sentence on the overall position",
  "healthComment": "two sentences interpreting healthScore",
  "actions": [
    { "priority": 1, "signalIds": ["id from signals"], "action": "ADD|HOLD|REVIEW|TRIM|REBALANCE|PREPAY|BUILD", "asset": "holding or class", "summary": "one-line instruction", "rationale": "2-3 sentences using the supplied numbers", "risk": "one sentence", "confidence": "low|medium|high" }
  ],
  "watchlist": ["short things to monitor"],
  "nextMonthPlan": ["3-5 concrete steps for the next month, e.g. SIP amounts, where new money should go"],
  "taxNote": "one sentence of tax-aware caution relevant to the actions"
}
Give at most 8 actions, ordered by priority.`;

  const trunc = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

  /** Compact, privacy-minimal description of everything the model may use. */
  function buildBrief(result, input) {
    const top = (result.holdings || []).slice().sort((a, b) => b.value - a.value).slice(0, 30);
    return {
      asOf: result.asOf,
      healthScore: result.score,
      portfolio: result.metrics,
      holdings: top,
      moreHoldings: Math.max(0, (result.holdings || []).length - top.length),
      cashFlow: input.cash,
      liabilities: input.liabilities,
      goals: input.goals,
      profile: input.profile,
      mfInvestedThisMonth: Math.round(input.mfThisMonth || 0),
      signals: (result.signals || []).map((s) => ({ id: s.id, severity: s.severity, action: s.action, title: s.title, evidence: s.why, confidence: s.confidence })),
    };
  }

  /**
   * Accepts the model's JSON, keeps only what is well-formed and grounded in real signals.
   * Returns { ok, review, dropped } — or throws if nothing usable came back.
   */
  function validateReview(raw, result) {
    if (!raw || typeof raw !== "object") throw new Error("The AI answer was not a JSON object.");
    const byId = new Map((result.signals || []).map((s) => [s.id, s]));
    const dropped = [];
    const actions = [];
    (Array.isArray(raw.actions) ? raw.actions : []).forEach((a, i) => {
      const ids = (Array.isArray(a && a.signalIds) ? a.signalIds : []).filter((id) => byId.has(id));
      const action = String((a && a.action) || "").toUpperCase();
      if (!ids.length) { dropped.push({ index: i, reason: "no valid signal id" }); return; }
      if (!ACTIONS.includes(action)) { dropped.push({ index: i, reason: "unknown action" }); return; }
      const primary = byId.get(ids[0]);
      actions.push({
        priority: Number.isFinite(Number(a.priority)) ? Math.max(1, Math.min(9, Math.round(Number(a.priority)))) : actions.length + 1,
        signalIds: ids.slice(0, 4),
        action,
        asset: trunc(a.asset || primary.assetKey || primary.title, 80),
        summary: trunc(a.summary || primary.title, 200),
        rationale: trunc(a.rationale, 600),
        risk: trunc(a.risk, 240),
        confidence: CONF.includes(String(a.confidence).toLowerCase()) ? String(a.confidence).toLowerCase() : primary.confidence || "medium",
        severity: primary.severity,
        evidence: ids.slice(0, 4).flatMap((id) => byId.get(id).why || []).slice(0, 6), // numbers come from the engine, not the model
      });
    });
    actions.sort((x, y) => x.priority - y.priority);
    if (!actions.length && !(raw.headline || raw.nextMonthPlan)) throw new Error("The AI answer had nothing usable.");
    const list = (v, n, len) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => trunc(x, len)).filter(Boolean);
    return {
      ok: true,
      dropped,
      review: {
        headline: trunc(raw.headline, 240),
        healthComment: trunc(raw.healthComment, 360),
        actions: actions.slice(0, 8),
        watchlist: list(raw.watchlist, 6, 200),
        nextMonthPlan: list(raw.nextMonthPlan, 6, 240),
        taxNote: trunc(raw.taxNote, 300),
        disclaimer: DISCLAIMER,
      },
    };
  }

  /** Changes only when something worth re-reviewing changed (≥0.5% value move or a different signal set). */
  function fingerprint(result) {
    const total = result.metrics ? result.metrics.total : 0;
    const bucket = Math.round(Math.log(Math.max(total, 1)) / Math.log(1.005));
    const sig = (result.signals || []).map((s) => `${s.id}:${s.severity}`).sort().join("|");
    return `${result.asOf}#${bucket}#${sig}`;
  }

  return { SYSTEM_PROMPT, DISCLAIMER, buildBrief, validateReview, fingerprint, ACTIONS };
});
