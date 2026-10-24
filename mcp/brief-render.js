/**
 * Life Ledger MCP — the daily email, built from the data pack (pure).
 *
 * renderBrief(pack, { notes, now }) → { subject, html, text, kind }
 *
 * Every figure comes straight from the pack (or from one named formula below), never from a model typing numbers.
 * The words are plain: no RSI, XIRR or "pp". The HTML is email-safe: tables, inline styles only (Gmail drops <style>),
 * 600px wide, readable on a phone. notes = { coach?: string, idea?: { title, text }, win?: string } are the only
 * model-written parts, and they are escaped like everything else.
 */
const NAME = { Me: "Prafful", Wife: "Archana", Both: "Both", Prafful: "Prafful", Archana: "Archana" };
const C = {
  ink: "#1d2330", muted: "#5b6573", line: "#e3e7ec", page: "#f4f6f8", card: "#ffffff", head: "#1d2330",
  green: "#0a7350", greenBg: "#e6f4ee", red: "#bf342e", redBg: "#fbeaea", amber: "#8a5a00", amberBg: "#fff4d6", blue: "#2457d6", blueBg: "#e8efff", grey: "#5b6573", greyBg: "#eef1f5",
};
const TONE = { good: [C.green, C.greenBg], bad: [C.red, C.redBg], warn: [C.amber, C.amberBg], info: [C.blue, C.blueBg], mute: [C.grey, C.greyBg] };
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (v) => (num(v) < 0 ? "−" : "") + "₹" + Math.round(Math.abs(num(v))).toLocaleString("en-IN");
const signedInr = (v) => (num(v) > 0 ? "+" : num(v) < 0 ? "−" : "") + "₹" + Math.round(Math.abs(num(v))).toLocaleString("en-IN");
const trim = (x, d) => String(Number(x.toFixed(d)));   // 12.0 → "12", 1.32 → "1.32"
const compact = (v) => { const a = Math.abs(num(v)), s = num(v) < 0 ? "−" : ""; return a >= 1e7 ? `${s}₹${trim(a / 1e7, 2)} Cr` : a >= 1e5 ? `${s}₹${trim(a / 1e5, a >= 1e6 ? 1 : 2)} L` : inr(v); };
const pct1 = (v) => `${num(v) > 0 ? "+" : num(v) < 0 ? "−" : ""}${Math.abs(num(v)).toFixed(1)}%`;
const who = (o) => NAME[o] || o || "";
// The vault names US shares by ticker only; these are the common ones (unknown tickers are shown as they are)
const TICKERS = { AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Google", AMZN: "Amazon", META: "Meta", NVDA: "Nvidia", TSLA: "Tesla", T: "AT&T", VOO: "Vanguard S&P 500", VTI: "Vanguard Total Market", QQQ: "Nasdaq 100 (QQQ)", QQQM: "Invesco Nasdaq 100", SPY: "S&P 500 (SPY)" };
const nameOf = (r) => (/^[A-Z.]{1,5}$/.test(r.name || "") && TICKERS[r.name] ? `${TICKERS[r.name]} (${r.name})` : r.name);
const first = (s) => String(s || "").split(/(?<=[.!?])\s+/)[0];
// A very short first sentence ("4 high-severity items.") carries little: add the next one
const lead = (s) => { const parts = String(s || "").split(/(?<=[.!?])\s+/); return parts[0].length < 45 && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0] || ""; };
const dayName = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "long", timeZone: "UTC" });
const dateLong = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateShort = (iso) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
// A date in a later year keeps its year ("22 Oct 2027"), so "by 22 Oct" is never mistaken for this October
const dateWhen = (iso, today) => (String(iso).slice(0, 4) === String(today).slice(0, 4) ? dateShort(iso) : dateLong(iso));
const monthName = (ym) => new Date(ym + "-01T00:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);

const shortTitle = (t) => { const s = String(t || "").split(";")[0].replace(/^Last (fee-free )?day (to|of) /i, "").replace(/^the /i, ""); const r = s.charAt(0).toUpperCase() + s.slice(1); return r.length > 44 ? r.slice(0, 42).replace(/\s+\S*$/, "") + "…" : r; };

// ── building blocks (inline styles only) ──
const chip = (text, tone = "mute") => `<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:700;line-height:16px;background-color:${TONE[tone][1]};color:${TONE[tone][0]}">${esc(text)}</span>`;
const card = (inner, pad = "16px 18px") => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background-color:${C.card};border:1px solid ${C.line};border-radius:12px;margin:0 0 12px"><tr><td style="padding:${pad};font-size:14px;line-height:21px;color:${C.ink}">${inner}</td></tr></table>`;
const h2 = (t, sub) => `<div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};margin:22px 0 8px">${esc(t)}${sub ? ` <span style="font-weight:500;letter-spacing:0;text-transform:none">· ${esc(sub)}</span>` : ""}</div>`;
const small = (t) => `<div style="font-size:12px;line-height:18px;color:${C.muted};margin-top:4px">${t}</div>`;
const bar = (pct, tone = "info", height = 8) => { const p = Math.max(0, Math.min(100, num(pct))); if (p < 0.5) return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:6px;background-color:${C.greyBg};margin:6px 0 2px"><tr><td style="font-size:1px;height:${height}px;line-height:${height}px">&nbsp;</td></tr></table>`; return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-radius:6px;background-color:${C.greyBg};margin:6px 0 2px"><tr><td width="${p.toFixed(0)}%" style="background-color:${TONE[tone][0]};height:${height}px;line-height:${height}px;font-size:1px;border-radius:6px">&nbsp;</td><td style="font-size:1px;line-height:${height}px">&nbsp;</td></tr></table>`; };
const gainSpan = (v, text) => `<span style="color:${num(v) >= 0 ? C.green : C.red};font-weight:700">${esc(text)}</span>`;
const tile = (label, big, sub, tone) => `<td width="50%" valign="top" style="padding:0 6px 12px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;background-color:${C.card};border:1px solid ${C.line};border-radius:12px"><tr><td style="padding:12px 14px"><div style="font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${esc(label)}</div><div style="font-size:22px;line-height:28px;font-weight:800;color:${tone ? TONE[tone][0] : C.ink};margin:2px 0">${esc(big)}</div><div style="font-size:12px;line-height:17px;color:${C.muted}">${sub}</div></td></tr></table></td>`;
const tileRow = (a, b) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${a}${b || '<td width="50%"></td>'}</tr></table>`;
const row3 = (cells, bold) => `<tr>${cells.map((c, i) => `<td valign="top" style="padding:7px 6px;border-bottom:1px solid ${C.line};font-size:13px;line-height:18px;${i === 0 ? "" : "text-align:right;white-space:nowrap;"}${bold ? "font-weight:700;" : ""}">${c}</td>`).join("")}</tr>`;

// ── plain words for the app's verdicts ──
function status(row) {
  const call = String(row.call || "").toLowerCase();
  if (/^(review|consider)/.test(call)) return { label: "Look closely", tone: "bad", rank: 3 };
  if (/don't add/.test(call)) return { label: "Don't add more now", tone: "warn", rank: 2 };
  if (/^watch/.test(call)) return { label: "Keep an eye", tone: "warn", rank: 2 };
  const v = String(row.verdict || "").toLowerCase();
  if (/great|well|good/.test(v)) return { label: "Doing well", tone: "good", rank: 0 };
  if (/not enough|too early|no data/.test(v)) return { label: "Too early to tell", tone: "mute", rank: 1 };
  return { label: "On track", tone: "mute", rank: 1 };
}
const plainWhy = (row) => first((row.why || [])[0] || "").replace(/about ([\d.]+)% (better|worse) than/, (m, n, w) => `${n} points ${w} than`).replace(/\bthe Indian market \(Nifty 50\)/, "the Nifty 50").replace(/\bthe US market \(S&P 500\)/, "the S&P 500");
const taxText = (t) => (t == null ? "" : typeof t === "number" ? (t > 0 ? `Tax if sold: ${inr(t)}` : "No tax if sold") : t.ifAllLongTerm === t.ifAllShortTerm ? (t.ifAllShortTerm > 0 ? `Tax if sold: ${inr(t.ifAllShortTerm)}` : "No tax if sold") : `Tax if sold: ${inr(t.ifAllLongTerm)}–${inr(t.ifAllShortTerm)}`);

// ── goals: what each needs a month (same formula as the app's Goals page) ──
function goalNeed(g, today) {
  const remaining = Math.max(0, num(g.target) - num(g.saved));
  if (!(num(g.target) > 0) || remaining === 0) return { remaining: 0, months: 0, perMonth: 0, done: true };
  if (!g.dueDate) return { remaining, months: null, perMonth: null };
  const monthsExact = (Date.parse(g.dueDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / (30.4375 * 864e5);
  if (monthsExact <= 0) return { remaining, months: 0, perMonth: remaining, overdue: true };
  const months = Math.max(1, Math.ceil(monthsExact));
  return { remaining, months, perMonth: Math.ceil(remaining / months) };
}

// ── what to do today (max 3), in this order ──
function todayActions(pack, today) {
  const out = [], add = (a) => { if (out.length < 3) out.push(a); };
  const plan = pack.taxPlan || {}, actions = plan.actions || [];
  const soon = actions.filter((a) => a.severity === "high" && a.due && daysBetween(today, a.due) <= 75).sort((a, b) => (a.due < b.due ? -1 : 1));
  for (const a of soon) add({ title: a.title + (a.who ? ` (${who(a.who)})` : ""), why: lead(a.why), tag: `by ${dateShort(a.due)} · ${daysBetween(today, a.due)} days`, tone: "bad" });
  const sip = pack.sipThisMonth;
  if (sip && sip.monthElapsedPct >= 50 && (num(sip.targetMe) > 0 || num(sip.targetWife) > 0) && num(sip.investedMe) + num(sip.investedWife) === 0)
    add({ title: "Make this month's SIPs", why: `${sip.monthElapsedPct}% of the month has gone and nothing is recorded against the targets (${inr(sip.targetMe)} for Prafful, ${inr(sip.targetWife)} for Archana).`, tag: "invest it or log it", tone: "warn" });
  for (const a of actions.filter((x) => x.severity === "high" && !x.due)) add({ title: a.title, why: lead(a.why), tag: "no deadline, but a big gap", tone: "warn" });
  const ren = (pack.calendar || []).find((c) => c.kind === "renewal" && c.inDays <= 14);
  if (ren) add({ title: `Renew: ${ren.what.replace(/ renewal.*$/, "")}`, why: `Due ${dateShort(ren.date)}${ren.note ? `, ${ren.note}` : ""}.`, tag: `in ${ren.inDays} days`, tone: "warn" });
  const adv = (plan.people || []).map((p) => p.advanceTaxNext && { p, a: p.advanceTaxNext }).find(Boolean);
  if (adv && daysBetween(today, adv.a.date) <= 21) add({ title: `Advance tax for ${adv.p.name}`, why: `Pay ${inr(adv.a.cumulative)} in total by ${dateShort(adv.a.date)} to avoid interest.`, tag: `by ${dateShort(adv.a.date)}`, tone: "warn" });
  return out;
}

// ── notices that need attention (shown only when something is off) ──
function notices(pack, today) {
  const out = [], b = pack.brief || {};
  const fresh = b.dataFreshness || {};
  const oldest = Math.max(num(fresh.mutualFundsHoursOld), num(fresh.stocksHoursOld), num(fresh.usStocksHoursOld));
  if (oldest > 30) out.push({ tone: "warn", text: `Prices are about ${Math.round(oldest)} hours old, so values may be a little behind. They refresh whenever the app is opened on any device.` });
  if (pack.dataSource && pack.dataSource.fromCache) out.push({ tone: "warn", text: `The cloud copy could not be reached this morning, so this email uses the saved copy from ${pack.dataSource.cachedAt ? dateLong(pack.dataSource.cachedAt.slice(0, 10)) : "an earlier day"}. Anything you changed since then is missing.` });
  for (const a of (b.integrity && b.integrity.alerts) || []) if (a.level === "watch") out.push({ tone: "warn", text: a.text });
  const law = pack.lawWatch || {};
  for (const c of (law.changes || []).slice(0, 2)) out.push({ tone: "info", text: `Tax law update: ${c.headline}${c.effect ? `, ${c.effect}` : ""}. Ask your CA to confirm, then enter the new rates in the app under Tax → Rules.` });
  if (law.stale && law.checkedOn) out.push({ tone: "mute", text: `The monthly tax-law check last ran on ${dateLong(law.checkedOn)}.` });
  else if (law.stale) out.push({ tone: "mute", text: "The monthly tax-law check has not run yet." });
  const hc = pack.holdingsCheck;
  if (hc && hc.status === "gaps") out.push({ tone: "warn", text: `Your holdings differ from INDmoney: ${hc.gaps.filter((g) => g.confirmed).slice(0, 2).map((g) => `${g.name} (${who(g.who)})`).join(", ")}. Please check these in the broker's own app.` });
  else if (!hc || !hc.checkedOn) out.push({ tone: "mute", text: "The weekly check of your holdings against INDmoney has no result yet." });
  else if (daysBetween(hc.checkedOn, today) > 10) out.push({ tone: "mute", text: `The weekly holdings check last ran on ${dateLong(hc.checkedOn)}.` });
  return out;
}

// ── holdings ──
// An invisible last line saying how long the email is, so a copy that was cut short is noticed before it is sent
const END_MARK = /<!-- LL-END (\d+) -->\s*$/;
const sealed = (html) => `${html}<!-- LL-END ${html.length} -->`;
const intact = (html) => { const m = END_MARK.exec(String(html)); return !!m && Number(m[1]) === String(html).length - m[0].length; };
function sleeveTable(rows, label, opts = {}) {
  const list = (rows || []).slice().sort((a, b) => num(b.value) - num(a.value));
  if (!list.length) return { html: "", text: "" };
  const shown = list.slice(0, opts.max || 6), rest = list.slice(shown.length);
  const html = `<div style="font-size:13px;font-weight:700;margin:14px 0 2px">${esc(label)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${shown.map((r) => { const s = status(r); return row3([`<b>${esc(nameOf(r))}</b> <span style="color:${C.muted}">${esc(who(r.owner))}</span><br>${chip(s.label, s.tone)}`, `${inr(r.value)}<br>${gainSpan(r.gainPct, pct1(r.gainPct))}`]); }).join("")}</table>${rest.length ? small(`+ ${rest.length} smaller holding${rest.length === 1 ? "" : "s"} worth ${inr(rest.reduce((t, r) => t + num(r.value), 0))}`) : ""}`;
  const text = `${label}\n${shown.map((r) => `  ${nameOf(r)} (${who(r.owner)}): ${inr(r.value)}, ${pct1(r.gainPct)}, ${status(r).label}`).join("\n")}${rest.length ? `\n  + ${rest.length} smaller, ${inr(rest.reduce((t, r) => t + num(r.value), 0))}` : ""}`;
  return { html, text };
}

function render(pack, opts = {}) {
  const b = pack.brief || {}, nw = b.netWorth || {}, today = (opts.now || b.asOf || new Date().toISOString().slice(0, 10));
  const notes = opts.notes || {};
  const H = [], T = [];
  const add = (h, t) => { if (h) H.push(h); if (t) T.push(t); };

  // headline
  const ch = nw.changeVsPrevious || {}, delta = num(ch.delta), flat = Math.abs(delta) < Math.max(1000, num(nw.netWorth) * 0.0005);
  const move = flat ? "flat today" : `${delta > 0 ? "up" : "down"} ${compact(Math.abs(delta))} today`;
  const subject = `Life Ledger — ${dayName(today).slice(0, 3)} ${dateShort(today)}: ${inr(nw.netWorth)} (${move})`;
  const classNames = { mutualFunds: "mutual funds", stocks: "Indian shares and ETFs", usStocks: "US shares", gold: "gold", silver: "silver", crypto: "crypto", fd: "fixed deposits", epf: "EPF", ppf: "PPF", bonds: "bonds", bankSaving: "bank savings", others: "other assets", liabilities: "loans" };
  const market = ["mutualFunds", "stocks", "usStocks", "gold", "silver", "crypto"];
  const parts = Object.entries(ch.byClass || {}).sort((a, b2) => Math.abs(b2[1]) - Math.abs(a[1])).slice(0, 3).map(([k, v]) => `${classNames[k] || k} ${signedInr(k === "liabilities" ? -v : v)}${market.includes(k) ? " (market)" : " (you changed this)"}`);
  // Money you added is not a market gain: when it moved the total, say so (the app's dashboard shows the same split)
  const sp = ch.split, about = sp && !sp.exact ? "about " : "";
  const into = sp ? Object.entries(sp.newMoneyByClass || {}).sort((a, b2) => Math.abs(b2[1]) - Math.abs(a[1])).map(([k]) => classNames[k] || k).join(" and ") : "";
  const why = sp && (Math.abs(sp.newMoney) >= 500 || Math.abs(sp.edits) >= 500)
    ? `Because of: markets ${signedInr(sp.market)}${Math.abs(sp.newMoney) >= 500 ? `; ${sp.newMoney > 0 ? `you invested ${about}${inr(sp.newMoney)} new` : `you took out ${about}${inr(-sp.newMoney)}`}${into ? ` (${into})` : ""}` : ""}${Math.abs(sp.edits) >= 500 ? `; your own edits ${signedInr(sp.edits)} (FD, bank, loans and other values you type in)` : ""}.`
    : parts.length ? `Because of: ${parts.join("; ")}.` : "Nothing moved by more than ₹500 in any group.";

  // integrity: a critical problem replaces the whole brief
  const crit = ((b.integrity && b.integrity.alerts) || []).filter((a) => a.level === "critical");
  if (crit.length) {
    const body = `<div style="font-size:18px;font-weight:800;color:${C.red};margin-bottom:8px">Please check your data before trusting any number today</div>${crit.map((a) => `<p style="margin:0 0 8px">${esc(a.text)}</p>`).join("")}<p style="margin:0 0 8px">Every figure may be too high or too low until this is fixed. I have made no investment or tax suggestions today.</p><p style="margin:0"><b>What to do:</b> open the app → Data health → "Remove the extra copies", or Settings → History → restore the last good snapshot.</p>`;
    const html = sealed(wrap(card(body), today, "Data alert"));
    return { subject: `Life Ledger — DATA ALERT: ${crit[0].topic || "numbers look wrong"}`, html, text: `LIFE LEDGER — DATA ALERT\n\n${crit.map((a) => a.text).join("\n")}\n\nEvery figure may be wrong until this is fixed. No investment or tax suggestions were made today.\nWhat to do: open the app → Data health → "Remove the extra copies", or Settings → History → restore the last good snapshot.`, kind: "alert" };
  }

  // 1. hero
  const dTone = flat ? "mute" : delta > 0 ? "good" : "bad";
  add(card(`<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.muted}">Net worth</div><div style="font-size:34px;line-height:40px;font-weight:800;color:${C.ink};margin:2px 0 6px">${inr(nw.netWorth)}</div><div>${chip(flat ? `Flat today (${signedInr(delta)})` : `${delta > 0 ? "▲" : "▼"} ${inr(Math.abs(delta))} today`, dTone)}</div>${small(esc(why))}${notes.coach ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid ${C.line}">${esc(notes.coach)}</div>` : ""}${small(`Assets ${inr(nw.assets)} · loans ${inr(nw.liabilities)}`)}`, "18px 20px"),
    `NET WORTH: ${inr(nw.netWorth)} (${move}).\n${why}\n${notes.coach ? notes.coach + "\n" : ""}Assets ${inr(nw.assets)}, loans ${inr(nw.liabilities)}.`);

  // 2. notices
  const nts = notices(pack, today);
  if (nts.length) add(nts.map((n) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;margin:0 0 8px"><tr><td style="background-color:${TONE[n.tone][1]};color:${TONE[n.tone][0]};border-radius:10px;padding:9px 12px;font-size:13px;line-height:19px">${esc(n.text)}</td></tr></table>`).join(""), `NOTES\n${nts.map((n) => "- " + n.text).join("\n")}`);

  // 3. four tiles
  const exp = b.expenses || {}, sal = exp.salaryThatPaysIt || {}, left = num(exp.leftFromSalary), rate = exp.savingsRatePct;
  const monthly = num(b.healthCheck && b.healthCheck.monthlySpend6mo), liquid = num(b.healthCheck && b.healthCheck.liquid);
  const months = monthly > 0 ? liquid / monthly : null;
  const targetMatch = (((b.healthCheck || {}).flags || []).find((f) => f.topic === "Emergency fund") || { text: "" }).text.match(/target is (\d+)/), target = targetMatch ? Number(targetMatch[1]) : 6;
  const me = ((pack.taxPlan || {}).people || []).find((p) => p.name === "Prafful") || (pack.taxPlan.people || [])[0] || {};
  const short = me.tdsMinusTax < 0 ? `${inr(-me.tdsMinusTax)} still to pay` : me.tdsMinusTax > 0 ? `${inr(me.tdsMinusTax)} comes back` : "TDS covers it";
  const nextTax = ((pack.taxPlan || {}).deadlines || [])[0];
  add(tileRow(tile("Saved this month", rate != null ? `${Math.round(rate)}%` : "—", `${inr(left)} left of ${inr(sal.net)} salary so far`, rate >= 30 ? "good" : rate >= 15 ? null : "bad"), tile("Income tax this year", me.taxNewRegime != null ? inr(me.regime === "old" ? me.taxOldRegime : me.taxNewRegime) : "—", `Prafful · ${esc(short)}`)) +
    tileRow(tile("Emergency cover", months != null ? `${months.toFixed(0)} months` : "—", `Target ${target} months (bank + FDs)`, months >= target ? "good" : months >= target / 2 ? null : "bad"), nextTax ? tile("Next deadline", `${nextTax.inDays} days`, esc(`${dateShort(nextTax.date)}: ${shortTitle(nextTax.title)}`), nextTax.inDays <= 30 ? "bad" : null) : ""),
    `THIS MONTH\n- Saved: ${rate != null ? Math.round(rate) + "%" : "—"} (${inr(left)} left of ${inr(sal.net)} salary)\n- Income tax (Prafful): ${me.taxNewRegime != null ? inr(me.regime === "old" ? me.taxOldRegime : me.taxNewRegime) : "—"}, ${short}\n- Emergency cover: ${months != null ? months.toFixed(0) : "—"} months (target ${target})${nextTax ? `\n- Next deadline: ${dateShort(nextTax.date)} (${nextTax.inDays} days): ${nextTax.title.split(";")[0]}` : ""}`);

  // 4. do this today
  const acts = todayActions(pack, today);
  add(h2("Do this today") + (acts.length ? acts.map((a, i) => card(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td valign="top" width="30" style="padding-right:10px"><div style="width:26px;height:26px;line-height:26px;border-radius:13px;background-color:${TONE[a.tone][1]};color:${TONE[a.tone][0]};text-align:center;font-weight:800;font-size:13px">${i + 1}</div></td><td valign="top"><div style="font-weight:700">${esc(a.title)}</div><div style="color:${C.muted};font-size:13px;line-height:19px;margin:2px 0 6px">${esc(a.why)}</div>${chip(a.tag, a.tone)}</td></tr></table>`, "12px 14px")).join("") : card(`${chip("All clear", "good")} <span style="margin-left:6px">Nothing urgent today.</span>`, "12px 14px")),
    `DO THIS TODAY\n${acts.length ? acts.map((a, i) => `${i + 1}. ${a.title}: ${a.why} (${a.tag})`).join("\n") : "Nothing urgent today."}`);

  // 5. investments
  const sleeves = [["Mutual funds", b.mutualFunds], ["Indian shares & ETFs", b.stocks], ["US shares", b.usStocks]];
  const goldV = num(nw.classes && nw.classes.gold && nw.classes.gold.value), accounted = num(b.mutualFunds && b.mutualFunds.totalValue) + num(b.stocks && b.stocks.totalValue) + num(b.usStocks && b.usStocks.totalValue) + goldV;
  const other = num(nw.assets) - accounted;
  const sumRows = sleeves.map(([l, s]) => row3([esc(l), `${inr(s.totalValue)}<br>${gainSpan(s.gainPct, `${pct1(s.gainPct)} overall`)}`, `${gainSpan(s.dayChange, signedInr(s.dayChange))}<br><span style="font-size:11px;color:${C.muted}">today</span>`])).join("") + row3(["Gold", inr(goldV), ""]) + row3(["FDs, EPF, PPF, bank, other", inr(other), ""]);
  const everyRow = [...(pack.funds || {}).rows || [], ...(pack.stocks || {}).rows || [], ...(pack.usStocks || {}).rows || []];
  const look = everyRow.map((r) => ({ r, s: status(r) })).filter((x) => x.s.rank >= 2).sort((a, b2) => b2.s.rank - a.s.rank || num(b2.r.value) - num(a.r.value)).slice(0, 4);
  const well = (pack.funds || {}).rows ? (pack.funds.rows.filter((r) => num(r.vsMarket1yPp) > 5 && num(r.value) >= 50000).sort((a, b2) => num(b2.vsMarket1yPp) - num(a.vsMarket1yPp)).slice(0, 3)) : [];
  const tables = [sleeveTable((pack.funds || {}).rows, "Mutual funds"), sleeveTable((pack.stocks || {}).rows, "Indian shares & ETFs"), sleeveTable((pack.usStocks || {}).rows, "US shares", { max: 5 })];
  const noHist = [...((pack.stocks || {}).withoutHistory || []), ...((pack.funds || {}).withoutHistory || []), ...((pack.usStocks || {}).withoutHistory || [])];
  add(h2("Your investments") + card(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${sumRows}</table>${small("US shares: the gain is in dollars, shown at today's rupee rate.")}`) +
    (look.length ? card(`<div style="font-weight:700;margin-bottom:6px">Worth a look</div>${look.map(({ r, s }) => `<div style="margin:0 0 10px"><b>${esc(nameOf(r))}</b> <span style="color:${C.muted}">${esc(who(r.owner))}</span> ${chip(s.label, s.tone)}<div style="color:${C.muted};font-size:13px;line-height:19px">${esc(`${pct1(r.gainPct)} overall. ${plainWhy(r)}`)}${taxText(r.taxIfSoldTodayApprox) ? ` ${esc(taxText(r.taxIfSoldTodayApprox))}.` : ""}</div></div>`).join("")}${small("Based on price trends only. It ignores company news and results. These are things to think about, never instructions.")}`) : "") +
    (well.length ? card(`<div style="font-weight:700;margin-bottom:4px">Doing well</div><div style="font-size:13px;line-height:19px">${well.map((r) => `<b>${esc(nameOf(r))}</b> (${esc(who(r.owner))}) beat the Nifty 50 by ${num(r.vsMarket1yPp).toFixed(1)} points over a year`).join("; ")}.</div>`) : "") +
    card(`<div style="font-weight:700">All holdings</div>${tables.map((t) => t.html).join("")}${noHist.length ? small(`Not enough price history to judge: ${esc(noHist.join(", "))}.`) : ""}${small("Calls use price patterns (trends and recent highs and lows). They are not company research.")}`),
    `YOUR INVESTMENTS\n${sleeves.map(([l, s]) => `- ${l}: ${inr(s.totalValue)}, ${pct1(s.gainPct)} overall, today ${signedInr(s.dayChange)}`).join("\n")}\n- Gold: ${inr(goldV)}\n- FDs, EPF, PPF, bank, other: ${inr(other)}\n(US shares: gain in dollars at today's rupee rate.)${look.length ? `\n\nWorth a look:\n${look.map(({ r, s }) => `- ${nameOf(r)} (${who(r.owner)}), ${s.label}: ${pct1(r.gainPct)} overall. ${plainWhy(r)}`).join("\n")}` : ""}${well.length ? `\n\nDoing well: ${well.map((r) => `${nameOf(r)} (${who(r.owner)}) +${num(r.vsMarket1yPp).toFixed(1)} points vs Nifty 50`).join("; ")}.` : ""}\n\n${tables.map((t) => t.text).filter(Boolean).join("\n\n")}`);

  // 6. money this month
  const trend = (exp.trend || []).filter((t) => t.month < today.slice(0, 7)), lastDone = trend[trend.length - 1];
  const above = (exp.categories || []).filter((c) => num(c.vsAvgPct) >= 40 && num(c.thisMonth) >= 2000).slice(0, 3);
  const big = (exp.biggestExpenses || []).slice(0, 3);
  add(h2("Money this month") + card(`${lastDone ? `<div><b>${esc(monthName(lastDone.month))}</b> (complete): spent ${inr(lastDone.spent)} of the ${inr(lastDone.salary)} salary that paid for it, so you saved <b>${lastDone.savedPct != null ? lastDone.savedPct.toFixed(1) : "—"}%</b>.</div>` : ""}<div style="margin-top:6px"><b>${esc(monthName(exp.month || today.slice(0, 7)))}</b> so far: spent ${inr(exp.spent)}${exp.monthIsComplete ? "" : " (month not over yet)"}.</div>${big.length ? small(`Biggest: ${big.map((e) => `${inr(e.amount)} ${esc(e.note || e.category)}`).join(" · ")}`) : ""}${above.length ? `<div style="margin-top:8px;font-size:13px">Higher than your usual: ${above.map((c) => `${esc(c.category)} <b>${inr(c.thisMonth)}</b> (usually ${inr(c.avg6mo)})`).join("; ")}.</div>` : ""}${small(`Cash you can reach quickly: ${inr(liquid)}, about ${months != null ? months.toFixed(0) : "—"} months of spending.`)}`),
    `MONEY THIS MONTH\n${lastDone ? `${monthName(lastDone.month)}: spent ${inr(lastDone.spent)} of ${inr(lastDone.salary)} salary, saved ${lastDone.savedPct != null ? lastDone.savedPct.toFixed(1) : "—"}%.\n` : ""}${monthName(exp.month || today.slice(0, 7))} so far: ${inr(exp.spent)}.${big.length ? `\nBiggest: ${big.map((e) => `${inr(e.amount)} ${e.note || e.category}`).join(", ")}.` : ""}${above.length ? `\nHigher than usual: ${above.map((c) => `${c.category} ${inr(c.thisMonth)} (usually ${inr(c.avg6mo)})`).join("; ")}.` : ""}\nCash you can reach quickly: ${inr(liquid)} (about ${months != null ? months.toFixed(0) : "—"} months).`);

  // 7. income tax
  const people = (pack.taxPlan || {}).people || [], sv = (pack.taxPlan || {}).savings || {}, perP = (pack.tax || {}).perPerson || {};
  const personLine = (p) => p.taxNewRegime == null ? `${esc(p.name)}: no salary record yet.` : `<b>${esc(p.name)}</b>: ${inr(p.regime === "old" ? p.taxOldRegime : p.taxNewRegime)} for the year (${p.regime} regime${p.cheaperBy > 0 ? `, ${inr(p.cheaperBy)} cheaper than the other` : ""}). ${p.tdsMinusTax < 0 ? `TDS covers all but ${inr(-p.tdsMinusTax)}.` : p.tdsMinusTax > 0 ? `TDS is ${inr(p.tdsMinusTax)} more than the tax, so that comes back.` : "TDS covers it exactly."}${(p.regime === "old" ? p.taxOldRegime : p.taxNewRegime) === 0 ? " No tax is due." : ""}`;
  const moves = (sv.topMoves || []).filter((m2) => m2.thisYear > 0 || m2.everyYear > 0).slice(0, 3);
  const book = people.map((p) => ({ name: p.name, v: num((perP[p.name] || {}).canBookTaxFreeToday) })).filter((x) => x.v > 0);
  const fixes = ((pack.taxPlan || {}).returns || []).filter((r) => r.filed && (r.highItems > 0 || r.extraTaxOnDocuments > 0)).slice(0, 3);
  const sb = sv.sideBusinessTaxSavedIfInLowerTaxedName;
  const fyEnd = (pack.taxPlan || {}).fy ? `31 March ${+pack.taxPlan.fy.slice(0, 4) + 1}` : "31 March";
  add(h2("Income tax", (pack.taxPlan || {}).fy ? `FY ${pack.taxPlan.fy}` : "") + card(`${people.map((p) => `<div style="margin:0 0 6px">${personLine(p)}</div>`).join("")}${sv.couldSaveThisYear != null ? `<div style="margin-top:10px;padding:10px 12px;background-color:${C.greenBg};border-radius:10px"><b style="color:${C.green}">You could save ${inr(sv.couldSaveThisYear)} this year and ${inr(sv.couldSaveEveryYear)} every year after.</b>${moves.map((m2) => `<div style="font-size:13px;margin-top:4px">• ${esc(m2.move)}: ${m2.thisYear > 0 ? `${inr(m2.thisYear)} this year, ` : ""}${inr(m2.everyYear)} a year${m2.by ? ` (by ${dateWhen(m2.by, today)})` : ""}</div>`).join("")}</div>` : ""}${book.length ? `<div style="margin-top:10px;font-size:13px"><b>Tax-free profit you can book before ${esc(fyEnd)}:</b> ${book.map((x) => `${esc(x.name)} up to ${inr(x.v)}`).join(" · ")}. Sell, then buy back the same day; it lowers future tax. Check exit loads first.</div>` : ""}${sb ? `<div style="margin-top:8px;font-size:13px">A side business earning ${inr(sb.profit)} a year (the figure you entered) would pay ${inr(sb.saved)} less tax if it ran in ${esc(who(sb.bestOwner))}'s name.</div>` : ""}${fixes.length ? `<div style="margin-top:10px;font-size:13px"><b>Filed returns to correct:</b> ${fixes.map((r) => `FY ${esc(r.fy)} (${esc(r.person)})${r.correction ? `, ${r.correction.route === "revised return" ? "revise free until 31 Dec" : `updated return about ${inr(r.correction.approxTotal)}, last day ${dateWhen(r.correction.lastDate, today)}`}` : ""}`).join("; ")}.</div>` : ""}${small("A planning estimate. A CA should confirm before anything is filed or paid.")}`),
    `INCOME TAX${(pack.taxPlan || {}).fy ? " FY " + pack.taxPlan.fy : ""}\n${people.map((p) => personLine(p).replace(/<[^>]+>/g, "")).join("\n")}${sv.couldSaveThisYear != null ? `\nYou could save ${inr(sv.couldSaveThisYear)} this year and ${inr(sv.couldSaveEveryYear)} every year.\n${moves.map((m2) => `- ${m2.move}: ${inr(m2.everyYear)} a year${m2.by ? ` (by ${dateWhen(m2.by, today)})` : ""}`).join("\n")}` : ""}${book.length ? `\nTax-free profit to book before ${fyEnd}: ${book.map((x) => `${x.name} up to ${inr(x.v)}`).join(", ")}.` : ""}${sb ? `\nSide business (${inr(sb.profit)} a year, as you entered): ${inr(sb.saved)} less tax in ${who(sb.bestOwner)}'s name.` : ""}${fixes.length ? `\nFiled returns to correct: ${fixes.map((r) => `FY ${r.fy} (${r.person})`).join(", ")}.` : ""}`);

  // 8. safety net and goals
  const covers = ((b.protection || {}).covers) || {}, term = covers.term || [], health = covers.health;
  const coverChips = [...term.map((t) => `${esc(who(t.who))} term life ${t.status === "ok" ? chip("In the guide", "good") : t.status === "employer" ? chip("Only through your employer", "warn") : t.status === "low" ? chip("Below the guide", "warn") : chip("Not set up", "bad")}`), health ? `Family health ${health.status === "ok" ? chip(`${compact(health.cover)}, your own`, "good") : health.status === "employer" ? chip(`${compact(health.cover)}, only through your employer`, "warn") : health.status === "low" ? chip("Below the guide", "warn") : chip("Not set up", "bad")}` : ""].filter(Boolean);
  const goals = (b.goals || []).map((g) => ({ g, n: goalNeed(g, today) }));
  const sip = pack.sipThisMonth;
  add(h2("Safety net & goals") + card(`<div style="font-weight:700;margin-bottom:6px">Insurance</div>${coverChips.map((c) => `<div style="margin:0 0 6px;font-size:13px">${c}</div>`).join("")}${(pack.calendar || []).filter((c) => c.kind === "renewal" && c.inDays <= 60).map((c) => small(`Renewal: ${esc(c.what.replace(/ renewal.*$/, ""))} on ${dateShort(c.date)}${c.note ? ` (${esc(c.note)})` : ""}`)).join("")}`) +
    card(`<div style="font-weight:700;margin-bottom:4px">Goals</div>${goals.map(({ g, n }) => `<div style="margin:0 0 12px"><div><b>${esc(g.name)}</b> <span style="color:${C.muted};font-size:13px">${compact(g.saved)} of ${compact(g.target)}</span></div>${bar(g.progressPct, g.progressPct >= 60 ? "good" : g.progressPct >= 30 ? "info" : "warn")}${small(n.done ? "Reached." : n.perMonth != null ? `${num(g.progressPct).toFixed(0)}% there · needs ${inr(n.perMonth)} a month for ${n.months} month${n.months === 1 ? "" : "s"} (by ${dateWhen(g.dueDate, today)})` : `${num(g.progressPct).toFixed(0)}% there`)}${/emergency/i.test(g.name) && liquid >= 3 * num(g.target) && num(g.target) > 0 ? small(`Your bank savings and FDs already hold ${compact(liquid)}, far more than this ${compact(g.target)} goal. It may be worth raising the target to match your real cover.`) : ""}</div>`).join("")}${sip && (num(sip.targetMe) > 0 || num(sip.targetWife) > 0) ? `<div style="font-weight:700;margin:4px 0">SIPs this month</div>${[["Prafful", sip.investedMe, sip.targetMe], ["Archana", sip.investedWife, sip.targetWife]].map(([n, i, t]) => `<div style="font-size:13px">${n}: ${inr(i)} of ${inr(t)}</div>${bar(t > 0 ? (i / t) * 100 : 0, i >= t ? "good" : "warn", 6)}`).join("")}${small(`${sip.monthElapsedPct}% of the month has gone.`)}` : ""}`),
    `SAFETY NET & GOALS\n${coverChips.map((c) => "- " + c.replace(/<[^>]+>/g, "")).join("\n")}\n\n${goals.map(({ g, n }) => `- ${g.name}: ${compact(g.saved)} of ${compact(g.target)} (${num(g.progressPct).toFixed(0)}%)${n.perMonth != null && !n.done ? `, needs ${inr(n.perMonth)} a month by ${dateWhen(g.dueDate, today)}` : ""}`).join("\n")}${sip && (num(sip.targetMe) > 0 || num(sip.targetWife) > 0) ? `\n\nSIPs this month: Prafful ${inr(sip.investedMe)} of ${inr(sip.targetMe)}; Archana ${inr(sip.investedWife)} of ${inr(sip.targetWife)} (${sip.monthElapsedPct}% of the month gone).` : ""}`);

  // 9. body and habits
  const fit = pack.fitness || {}, body = fit.body, ses = fit.sessions || {}, steps = fit.steps || {};
  const nudge = num(ses.last7Days) === 0 && ses.daysSinceLast != null ? `No session in the last ${ses.daysSinceLast} day${ses.daysSinceLast === 1 ? "" : "s"}: one 30-minute ride or walk today restarts the streak.` : num(ses.last7Days) >= 3 ? "A strong week. Keep the rhythm." : "A little more each week adds up.";
  if (body || ses.last30Days != null) add(h2("Body & habits") + card(`${body ? `<div><b>${body.weightKg} kg</b>${body.weightChange && body.weightChange.vs90d != null ? ` (${body.weightChange.vs90d > 0 ? "+" : "−"}${Math.abs(body.weightChange.vs90d)} kg in 90 days)` : ""} · body fat <b>${body.bodyFatPct}%</b>${body.stale ? ` ${chip("measurements are old", "warn")}` : ""}</div>` : ""}<div style="margin-top:6px">${num(ses.last30Days)} session${num(ses.last30Days) === 1 ? "" : "s"} in 30 days (${num(ses.minutesLast30Days)} minutes), ${num(ses.last7Days)} this week.${steps.avgLast14Days ? ` Steps: about ${steps.avgLast14Days.toLocaleString("en-IN")} a day${steps.daysLogged < 7 ? ` (only ${steps.daysLogged} day${steps.daysLogged === 1 ? "" : "s"} logged)` : ""}.` : ""}</div>${fit.cyclingGoalKmPerWeek ? `<div style="font-size:13px;margin-top:8px">Cycling this week: ${num(fit.cyclingKmLast7Days)} of ${fit.cyclingGoalKmPerWeek} km</div>${bar((num(fit.cyclingKmLast7Days) / fit.cyclingGoalKmPerWeek) * 100, "info", 6)}` : ""}<div style="margin-top:8px;font-size:13px">${esc(nudge)}</div>`),
    `BODY & HABITS\n${body ? `${body.weightKg} kg, body fat ${body.bodyFatPct}%.\n` : ""}${num(ses.last30Days)} sessions in 30 days, ${num(ses.last7Days)} this week.${steps.avgLast14Days ? ` Steps about ${steps.avgLast14Days} a day.` : ""}\n${nudge}`);

  // 10. milestone
  const ms = pack.milestones;
  if (ms) add(h2("Milestone") + card(`<div><b>${compact(nw.netWorth)}</b> on the way to <b>${compact(ms.next)}</b></div>${bar(ms.progressToNextPct, "good")}${small(`${num(ms.progressToNextPct).toFixed(0)}% of the way from ${compact(ms.previous)}. ${inr(ms.toGo)} to go.`)}${notes.win ? `<div style="margin-top:10px;font-size:13px"><b>Win:</b> ${esc(notes.win)}</div>` : ""}${(pack.calendar || []).filter((c) => c.kind === "birthday" && c.inDays <= 7).map((c) => `<div style="margin-top:8px;font-size:13px">🎂 ${esc(c.what)}${c.inDays === 0 ? " today" : c.inDays === 1 ? " tomorrow" : ` on ${dateShort(c.date)}`}</div>`).join("")}`),
    `MILESTONE\n${inr(ms.toGo)} to go to ${compact(ms.next)} (${num(ms.progressToNextPct).toFixed(0)}% from ${compact(ms.previous)}).${notes.win ? `\nWin: ${notes.win}` : ""}${(pack.calendar || []).filter((c) => c.kind === "birthday" && c.inDays <= 7).map((c) => `\n${c.what}${c.inDays === 1 ? " tomorrow" : ""}`).join("")}`);

  // 11. weekly and month-end extras
  const dow = new Date(today + "T00:00:00Z").getUTCDay(), lastOfMonth = new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7), 0)).getUTCDate() === +today.slice(8, 10);
  const hist = (nw.history || []), weekAgo = hist.filter((h) => h.date <= new Date(Date.parse(today + "T00:00:00Z") - 7 * 864e5).toISOString().slice(0, 10)).pop();
  if (dow === 0 && weekAgo) add(h2("This week") + card(`Net worth ${num(nw.netWorth) - num(weekAgo.netWorth) >= 0 ? "up" : "down"} <b>${inr(Math.abs(num(nw.netWorth) - num(weekAgo.netWorth)))}</b> over 7 days. ${num(ses.last7Days)} session${num(ses.last7Days) === 1 ? "" : "s"} this week.`), `THIS WEEK\nNet worth ${num(nw.netWorth) - num(weekAgo.netWorth) >= 0 ? "up" : "down"} ${inr(Math.abs(num(nw.netWorth) - num(weekAgo.netWorth)))} over 7 days.`);
  if (lastOfMonth) add(card(`<b>Month-end.</b> Today's salary credit pays for next month's spending.`), "MONTH-END: today's salary credit pays for next month's spending.");

  // 12. idea
  if (notes.idea && notes.idea.text) add(h2("One idea") + card(`<div style="font-weight:700">${esc(notes.idea.title || "Today's idea")}</div><div style="margin-top:4px">${esc(notes.idea.text)}</div>`), `ONE IDEA: ${notes.idea.title ? notes.idea.title + ". " : ""}${notes.idea.text}`);

  // 13. what I need
  const need = [];
  for (const g of ((pack.tax || {}).dataGaps) || []) need.push(`${g.what}${/Indian stocks/.test(g.what) ? " (a broker tax P&L has them; tax on those shares is shown as a range until then)" : ""}`);
  if (((pack.taxPlan || {}).savings || {}).sideBusinessNeedsProfit) need.push("Your expected yearly profit from the side business (Tax → Savings), to see whose name saves the most tax");
  for (const a of ((pack.tax || {}).needFromYou) || []) if (need.length < 3 && !/NPS|Side business/.test(a.what)) need.push(a.what);
  if (need.length) add(h2("What I need from you") + card(need.slice(0, 3).map((n) => `<div style="margin:0 0 6px">• ${esc(n)}</div>`).join("")), `WHAT I NEED FROM YOU\n${need.slice(0, 3).map((n) => "- " + n).join("\n")}`);

  // footer: how the numbers are checked
  const sc = pack.selfCheck, hc = pack.holdingsCheck;
  const trust = [sc && sc.taxCases ? `Tax rules checked against ${sc.taxCases.total} official reference cases (${sc.taxCases.passed} agree)` : "", hc && hc.checkedOn ? `Holdings matched with INDmoney: ${hc.matched} of ${hc.total} on ${dateShort(hc.checkedOn)}` : ""].filter(Boolean);
  add(`<div style="font-size:11px;line-height:17px;color:${C.muted};margin:18px 2px 0">${trust.length ? `<div style="margin-bottom:6px">✓ ${esc(trust.join(" · "))}</div>` : ""}Planning estimates only. A CA should confirm before anything is filed or sold. This is not licensed investment or tax advice.</div>`, `${trust.length ? trust.join(". ") + ".\n" : ""}Planning estimates only. A CA should confirm before anything is filed or sold. Not licensed investment or tax advice.`);

  return { subject, html: sealed(wrap(H.join(""), today)), text: `LIFE LEDGER — ${dayName(today)} ${dateLong(today)}\n\n${T.join("\n\n")}`, kind: "brief" };
}

function wrap(inner, today, label) {
  return `<!doctype html><html><body style="margin:0;padding:0;background-color:${C.page}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page}"><tr><td align="center" style="padding:14px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${FONT};color:${C.ink}"><tr><td style="background-color:${C.head};color:#fff;border-radius:12px 12px 0 0;padding:12px 18px"><span style="font-size:15px;font-weight:800;letter-spacing:.02em">Life Ledger</span><span style="float:right;font-size:12px;color:#c4cbd6;line-height:22px">${esc(label || `${dayName(today)} ${dateShort(today)}`)}</span></td></tr><tr><td style="padding:12px 0 0">${inner}</td></tr></table></td></tr></table></body></html>`;
}

module.exports = { renderBrief: render, intact, goalNeed, todayActions, notices, status, inr, compact };
