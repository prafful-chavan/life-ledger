/**
 * Life Ledger — gifts and family money (pure). Classifies a transfer between family members for the receiver's tax (56(2)(x)),
 * the giver's clubbing exposure (64) and the paperwork to keep, taking the marriage date into account: before the wedding a
 * future spouse and her family are not "relatives", after it they are.
 *
 * t = { amount, date: "YYYY-MM-DD", from, to, relation: "spouse"|"parent"|"child"|"sibling"|"spouse-sibling"|"spouse-parent"|"other",
 *       viaOther?: true (paid into a third party's account on behalf of `to`), purpose?, repaymentExpected? }
 * ctx = { marriageDate }
 */
const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const THRESHOLD = 50000;

/** Is `relation` a "relative" under 56(2)(x) on the given date? Spouse-side relations only exist from the marriage. */
function isRelative(relation, date, marriageDate) {
  const spouseSide = ["spouse", "spouse-sibling", "spouse-parent"].includes(relation);
  if (spouseSide) return !!marriageDate && date >= marriageDate;
  return ["parent", "child", "sibling", "grandparent", "grandchild"].includes(relation);
}

function classifyGift(t, ctx = {}) {
  const out = { amount: num(t.amount), date: t.date, flags: [], keep: [], taxableToReceiver: 0, clubbedToGiver: false, confidence: "high", summary: "" };
  const before = ctx.marriageDate && t.date < ctx.marriageDate;
  const relative = isRelative(t.relation, t.date, ctx.marriageDate);
  const toSpouse = t.relation === "spouse";

  if (t.repaymentExpected) {
    out.summary = "A loan, not a gift: no tax on the principal; interest received is the lender's income. Keep a written acknowledgement and take repayments by bank.";
    out.keep.push("one-line loan acknowledgement signed by the borrower", "bank trail of repayments");
    return out;
  }

  if (out.amount <= THRESHOLD) { out.summary = "At or below ₹50,000 in the year from any person: not taxable to the receiver."; return out; }

  if (relative) {
    out.summary = "From a relative: tax-free to the receiver.";
    if (toSpouse) { out.clubbedToGiver = true; out.flags.push("Income earned on this money (interest, dividends, capital gains/losses) is added to the giver's income (sec 64) while you are spouses."); }
    out.keep.push("bank transfer record", "short gift letter (who, how much, date, 'out of love and affection')");
    return out;
  }

  // Not a relative at that date.
  if (before && ["spouse", "spouse-sibling", "spouse-parent"].includes(t.relation)) {
    out.summary = "Given before the wedding, so the receiver was not yet a relative. A gift received on the occasion of the receiver's own marriage is exempt from anyone; the tribunals have generally accepted gifts made around the wedding, not only on the day.";
    out.flags.push(`Paid ${Math.round((new Date(ctx.marriageDate) - new Date(t.date)) / 864e5)} days before the wedding${t.viaOther ? " and into a third party's account" : ""}: tax-free only if it really was a gift to the bride in connection with the marriage; if the receiver was the third party (not the bride), the marriage exemption does not cover them.`);
    out.flags.push("Clubbing: whether income from a pre-wedding gift is added to the giver once they marry is argued both ways. Ask the CA; the amounts here are small.");
    out.confidence = "medium";
    out.keep.push("bank transfer record", "a dated note of purpose (gift for the bride / wedding)", "wedding date proof");
    return out;
  }

  out.taxableToReceiver = out.amount;
  out.summary = "From a non-relative above ₹50,000: taxable to the receiver as income from other sources unless an exemption applies (marriage occasion, will/inheritance).";
  out.keep.push("bank transfer record");
  return out;
}

/**
 * When a spouse's investments were paid for partly with money given by the other spouse and partly with her own or her parents'
 * money, only the share traceable to the giver's money is clubbed (sec 64). Returns the fraction to club, 0..1.
 * contributions: { fromSpouse, fromOthers } in ₹ (own earnings, gifts from parents, etc. are "fromOthers").
 */
function clubbingShare({ fromSpouse = 0, fromOthers = 0 } = {}) {
  const a = Math.max(0, num(fromSpouse)), b = Math.max(0, num(fromOthers));
  return a + b > 0 ? a / (a + b) : 0;
}

module.exports = { classifyGift, isRelative, clubbingShare, THRESHOLD };
