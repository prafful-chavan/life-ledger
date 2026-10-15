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

  const SYSTEM_PROMPT = `You are the household's personal wealth advisor, combining a chartered accountant (tax-aware, cash-flow disciplined), an investment banker (sceptical, risk-first) and a portfolio manager (spread, balance, position size). You advise one Indian family building long-term wealth. Amounts are in INR.

WRITE FOR A BUSY NON-EXPERT
- Short sentences, everyday words. If you must use a finance term, explain it in a few words.
- Say "the market" instead of "benchmark", "yearly growth" instead of XIRR, "fall from its high" instead of drawdown, "balance" instead of rebalance, "very small investments" instead of dust.
- Do not quote the health score number; the app already shows it. Do not repeat the same point in several places.

HARD RULES
1. Use ONLY the numbers in the supplied JSON. Never invent prices, returns, valuations, earnings, news, ratings or price targets. If something is not in the data, say it is unknown.
2. Every move must cite one or more signal ids from "signals". Do not create moves without a matching signal. Order by importance: urgent first.
3. Be concrete: name the holding, use the supplied figures, say what would change your view.
4. Prefer calm, long-term habits: regular SIPs, balancing with new money, buying a little at a time, not adding to a broken business just because it is cheaper, not chasing what is hot, building the emergency fund and clearing expensive loans before adding risk.
5. Never recommend leverage, derivatives, penny stocks, intraday trading, crypto speculation or guaranteed returns. Do not predict the market.
6. Tax (verify with a CA; rules change): listed shares and equity funds — 20% tax on gains if sold within 12 months, 12.5% on gains above ₹1.25 lakh a year after that. Mention tax in words when suggesting a sale; do not compute tax amounts.
7. These are suggestions for a human to decide: use "consider", "look at", "if the reason you bought it still holds".

Return ONLY a JSON object:
{
  "summary": "2-3 simple sentences on where the family stands",
  "good": ["up to 4 short things that are going well"],
  "watchOut": ["up to 4 short things to watch"],
  "moves": [
    { "priority": 1, "signalIds": ["id from signals"], "action": "ADD|HOLD|REVIEW|TRIM|REBALANCE|PREPAY|BUILD", "title": "plain headline", "whatToDo": "one clear step", "why": "2 simple sentences using the supplied numbers", "risk": "one sentence", "confidence": "low|medium|high" }
  ],
  "perHolding": [ { "key": "holding key exactly as given", "comment": "one friendly sentence on how it is doing and what to do" } ],
  "nextMonthPlan": ["3-5 concrete steps for next month"],
  "taxNote": "one sentence of tax-aware caution relevant to the moves"
}
Give at most 6 moves. Give perHolding notes for the 10 largest holdings and for any that are falling behind or need attention.`;

  const trunc = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

  /** Compact, privacy-minimal description of everything the model may use. */
  function buildBrief(result, input) {
    const top = (result.holdings || []).slice().sort((a, b) => b.value - a.value).slice(0, 30);
    return {
      asOf: result.asOf,
      healthScore: result.score,
      portfolio: result.metrics,
      pillars: (result.pillars || []).map((p) => ({ id: p.id, label: p.label, score: p.score, note: p.line })),
      strengths: result.strengths || [],
      holdings: top.map((h) => ({ ...h, verdict: h.verdict ? { status: h.verdict.label, headline: h.verdict.headline, suggestedMove: h.verdict.moveLabel } : undefined })),
      moreHoldings: Math.max(0, (result.holdings || []).length - top.length),
      planSetByUser: Boolean(result.profileSet),
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
    const byKey = new Map((result.holdings || []).map((h) => [h.key, h]));
    const dropped = [];
    const moves = [];
    const rawMoves = Array.isArray(raw.moves) ? raw.moves : Array.isArray(raw.actions) ? raw.actions : [];
    rawMoves.forEach((a, i) => {
      const ids = (Array.isArray(a && a.signalIds) ? a.signalIds : []).filter((id) => byId.has(id));
      const action = String((a && a.action) || "").toUpperCase();
      if (!ids.length) { dropped.push({ index: i, reason: "no valid signal id" }); return; }
      if (!ACTIONS.includes(action)) { dropped.push({ index: i, reason: "unknown action" }); return; }
      const primary = byId.get(ids[0]);
      moves.push({
        priority: Number.isFinite(Number(a.priority)) ? Math.max(1, Math.min(9, Math.round(Number(a.priority)))) : moves.length + 1,
        signalIds: ids.slice(0, 4),
        action,
        actionLabel: primary.actionLabel || action,
        title: trunc(a.title || a.summary || primary.title, 160),
        whatToDo: trunc(a.whatToDo || a.summary, 260),
        why: trunc(a.why || a.rationale, 480),
        risk: trunc(a.risk, 240),
        confidence: CONF.includes(String(a.confidence).toLowerCase()) ? String(a.confidence).toLowerCase() : primary.confidence || "medium",
        severity: primary.severity,
        evidence: ids.slice(0, 4).flatMap((id) => byId.get(id).why || []).slice(0, 6), // numbers come from the engine, not the model
      });
    });
    moves.sort((x, y) => x.priority - y.priority);
    const holdingNotes = {};
    (Array.isArray(raw.perHolding) ? raw.perHolding : []).forEach((n) => {
      if (n && byKey.has(n.key) && n.comment) holdingNotes[n.key] = trunc(n.comment, 280);
    });
    if (!moves.length && !(raw.summary || raw.headline || raw.nextMonthPlan)) throw new Error("The AI answer had nothing usable.");
    const list = (v, n, len) => (Array.isArray(v) ? v : []).slice(0, n).map((x) => trunc(x, len)).filter(Boolean);
    return {
      ok: true,
      dropped,
      review: {
        summary: trunc(raw.summary || raw.headline, 520),
        good: list(raw.good, 4, 200),
        watchOut: list(raw.watchOut, 4, 200),
        moves: moves.slice(0, 6),
        holdingNotes,
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
