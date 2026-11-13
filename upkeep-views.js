/**
 * Life Ledger — the markup of three Dashboard cards that keep the books true (pure: numbers in, HTML out; no DOM, no network).
 *
 *   stale(model, o)     — typed-in values that are out of date, each with a one-tap update
 *   sales(model, o)     — shares that left the book (waiting for a price), a form for a sale the sync never saw, and the sales on record
 *   breakdown(model, o) — the equity part split into buckets, the biggest holdings and sector, the year's gains against the tax-free limit
 *
 * All text that comes from the data (names, notes) is escaped here. The page puts the result in place and listens to `data-act`.
 * o = { fmt: { inr(n) whole rupees, pct(n, digits) }, names: { Me: "Prafful", … } }.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./dashboard-charts.js"));
  else root.LifeLedgerUpkeepViews = factory(root.LifeLedgerDashboardCharts);
})(typeof self !== "undefined" ? self : this, function (Ch) {
  const h = Ch.esc;
  const name = (names, key) => (names && names[key]) || key;
  const dateText = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "")); return m ? `${+m[3]} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m[2] - 1]} ${m[1]}` : "—"; };
  const signed = (n, fmt) => `${n < 0 ? "−" : n > 0 ? "+" : ""}${fmt.inr(Math.abs(n))}`;
  const cls = (n) => (n < 0 ? "bad" : n > 0 ? "good" : "flat");

  // ── out-of-date values ──────────────────────────────────────────────────────────────────────
  function stale(model, o) {
    const { fmt, names } = o, rows = (model && model.rows) || [];
    if (!rows.length) return "";
    const days = (r) => (r.undated ? "no date recorded" : `${r.ageDays} days old (updated ${dateText(r.asOf)})`);
    const body = rows.map((r) => `<tr data-coll="${h(r.coll)}" data-id="${h(r.id)}">
        <td data-label="Value"><strong>${h(r.kind)}</strong><br><small>${h(r.name)} · ${h(name(names, r.owner))}</small></td>
        <td data-label="Now">${h(fmt.inr(r.value))}</td>
        <td data-label="Age"><span class="dv-delta ${r.undated || r.ageDays > r.limit * 3 ? "bad" : "flat"}">${h(days(r))}</span><br><small>checked every ${r.limit} days</small></td>
        <td data-label="Update" class="up-actions"><input class="up-input" type="number" inputmode="decimal" min="0" step="any" value="${h(String(Math.round(r.value * 100) / 100))}" aria-label="New value for ${h(r.kind)} ${h(r.name)}" data-field="value">
          <button type="button" class="secondary-button up-btn" data-act="stale-save">Save new value</button>
          <button type="button" class="ghost-button up-btn" data-act="stale-ok">Still correct</button></td></tr>`).join("");
    return `<p class="dv-note"><strong>${rows.length}</strong> value${rows.length === 1 ? "" : "s"} you typed in ${rows.length === 1 ? "is" : "are"} older than the app trusts, and <strong>${h(fmt.inr(model.worth))}</strong> of your net worth rests on ${rows.length === 1 ? "it" : "them"}. ${model.fresh} other${model.fresh === 1 ? " is" : "s are"} up to date. Shares, funds and gold are priced by the app itself, so they are not here.</p>
      <div class="table-wrap"><table class="dv-table up-table"><thead><tr><th>Value</th><th>Now</th><th>Age</th><th>Update</th></tr></thead><tbody>${body}</tbody></table></div>
      <p class="dv-note">“Still correct” keeps the number and only moves its date to today. Bank, crypto, silver and bonds are checked every 30 days; FDs, EPF, PPF and other assets every 90, because they move slowly.</p>`;
  }

  // ── sales ───────────────────────────────────────────────────────────────────────────────────
  function pendingCard(c, o) {
    const { fmt, names } = o;
    const unknown = (c.lots || []).some((l) => l.buyDateKnown === false);
    return `<div class="up-card" data-cand="${h(c.id)}">
      <h4>${h(c.name || c.symbol)} · ${h(String(c.qty))} share${c.qty === 1 ? "" : "s"} left your holdings</h4>
      <p class="dv-note">${h(name(names, c.owner))}${c.demat ? " · " + h(c.demat) : ""}. The last sync no longer has ${c.whole ? "this share" : "these shares"}. They cost ${h(fmt.inr(c.cost))}${c.manual ? "" : ` (found on ${h(dateText(c.detectedOn))})`}. Did you sell them? Enter what you actually got; nothing is recorded until you press Record.</p>
      <div class="up-form">
        <label>Sold at (₹ per share)<input type="number" min="0" step="any" inputmode="decimal" data-field="price" value="${c.lastPrice > 0 ? h(String(c.lastPrice)) : ""}" placeholder="price per share"></label>
        <label>Date sold<input type="date" data-field="date" value="${h(o.today || "")}" max="${h(o.today || "")}"></label>
        <label>Charges (₹, optional)<input type="number" min="0" step="any" inputmode="decimal" data-field="charges" placeholder="brokerage + taxes"></label>
        ${unknown ? `<label>Bought on (if you know)<input type="date" data-field="buyDate"></label>` : ""}
      </div>
      ${c.lastPrice > 0 ? `<p class="dv-note">The price filled in is the last market price the app had (${h(fmt.inr(c.lastPrice))}), not what you sold at: replace it with your contract note price.</p>` : ""}
      ${unknown ? `<p class="dv-note">The sheet has only its import date for this share, so its short or long term is not known. Without a buy date the sale is recorded as “term unknown” and left out of the tax-free limit.</p>` : ""}
      <label class="up-check"><input type="checkbox" data-field="credit"> Add the money to ${h(name(names, c.owner))}'s bank balance (leave this off if the balance you entered already includes it)</label>
      <div class="up-actions"><button type="button" class="primary-button up-btn" data-act="sale-record">Record sale</button>
        <button type="button" class="ghost-button up-btn" data-act="sale-dismiss">Not a sale</button></div>
      <p class="up-error" role="alert" hidden></p></div>`;
  }

  function manualForm(o) {
    const { names } = o;
    return `<div class="up-card" data-cand="manual"><h4>Record a sale</h4>
      <p class="dv-note">For shares that were already gone before the sync could notice. The cost is what each share cost you on average (the Zerodha / Upstox holdings or P&amp;L report shows it).</p>
      <div class="up-form">
        <label>Share (symbol)<input type="text" data-field="symbol" placeholder="e.g. WIPRO" autocapitalize="characters"></label>
        <label>Name (optional)<input type="text" data-field="name" placeholder="e.g. Wipro Ltd"></label>
        <label>Whose<select data-field="owner"><option value="Me">${h(name(names, "Me"))}</option><option value="Wife">${h(name(names, "Wife"))}</option></select></label>
        <label>Broker (optional)<input type="text" data-field="demat" placeholder="e.g. Zerodha"></label>
        <label>Shares sold<input type="number" min="0" step="any" inputmode="decimal" data-field="qty"></label>
        <label>Average cost (₹ per share)<input type="number" min="0" step="any" inputmode="decimal" data-field="avgCost"></label>
        <label>Bought on (if you know)<input type="date" data-field="buyDate"></label>
        <label>Sold at (₹ per share)<input type="number" min="0" step="any" inputmode="decimal" data-field="price"></label>
        <label>Date sold<input type="date" data-field="date" value="${h(o.today || "")}" max="${h(o.today || "")}"></label>
        <label>Charges (₹, optional)<input type="number" min="0" step="any" inputmode="decimal" data-field="charges"></label>
      </div>
      <label class="up-check"><input type="checkbox" data-field="credit"> Add the money to the bank balance</label>
      <div class="up-actions"><button type="button" class="primary-button up-btn" data-act="sale-record">Record sale</button>
        <button type="button" class="ghost-button up-btn" data-act="sale-form">Cancel</button></div>
      <p class="up-error" role="alert" hidden></p></div>`;
  }

  const TERM = { long: "Long-term", short: "Short-term", mixed: "Part long, part short", unknown: "Term unknown" };
  function sales(model, o) {
    const { fmt, names } = o, m = model || {};
    const pending = m.pending || [], list = m.sales || [];
    const rows = list.map((s) => `<tr><td data-label="Sold">${h(dateText(s.soldOn))}</td><td data-label="Share"><strong>${h(s.name)}</strong><br><small>${h(name(names, s.owner))}${s.demat ? " · " + h(s.demat) : ""}</small></td>
        <td data-label="Shares">${h(String(s.qty))}</td><td data-label="Price">${h(fmt.inr(s.price))}</td><td data-label="Received">${h(fmt.inr(s.proceeds))}${s.charges ? `<br><small>after ${h(fmt.inr(s.charges))} charges</small>` : ""}</td>
        <td data-label="Cost">${h(fmt.inr(s.cost))}</td><td data-label="Gain / loss"><span class="dv-delta ${cls(s.gain)}">${h(signed(s.gain, fmt))}</span></td>
        <td data-label="Term">${h(TERM[s.term] || "—")}</td><td data-label=""><button type="button" class="pf-link" data-act="sale-del" data-id="${h(s.id)}">Remove</button></td></tr>`).join("");
    const table = list.length ? `<div class="table-wrap"><table class="dv-table up-table"><thead><tr><th>Sold</th><th>Share</th><th>Shares</th><th>Price</th><th>Received</th><th>Cost</th><th>Gain / loss</th><th>Term</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="dv-note">These sales feed the Tax page: the gain or loss counts toward this year's capital gains and the ₹1.25 lakh tax-free limit. Removing one does not take back money you added to a bank balance.</p>` : "";
    const intro = !pending.length && !list.length && !m.showForm ? `<p class="dv-note">When Sync Holdings finds shares that are no longer in your sheet, they appear here so you can say what you sold them for. Nothing is waiting right now.</p>` : "";
    return `${intro}${pending.map((c) => pendingCard(c, o)).join("")}${m.showForm ? manualForm(o) : `<p><button type="button" class="secondary-button up-btn" data-act="sale-form">Record a sale I made</button></p>`}${table}`;
  }

  // ── breakdown ───────────────────────────────────────────────────────────────────────────────
  const BUCKET_CLS = ["pf-c0", "pf-c1", "pf-c2", "pf-c3", "pf-c4", "pf-c5", "pf-c6", "pf-c7", "pf-c8", "pf-c9", "pf-c10", "pf-c11"];
  function breakdown(model, o) {
    const { fmt, names } = o, m = model || {}, bd = m.bd;
    if (!bd || !(bd.total > 0)) return `<div class="empty-state">No equity holdings yet.</div>`;
    const open = new Set(m.open || []);
    const parts = bd.buckets.map((b, i) => ({ label: b.label, value: b.value, cls: BUCKET_CLS[i % BUCKET_CLS.length] }));
    const rows = bd.buckets.map((b, i) => {
      const isOpen = open.has(b.key);
      let out = `<tr class="pf-main"><td data-label="Bucket"><button class="pf-toggle" type="button" data-act="bd-open" data-id="${h(b.key)}" aria-expanded="${isOpen}"><i class="pf-sw ${BUCKET_CLS[i % BUCKET_CLS.length]}"></i>${h(b.label)}<span class="pf-caret">${isOpen ? "▾" : "▸"}</span></button></td>
        <td data-label="Worth"><strong>${h(fmt.inr(b.value))}</strong></td><td data-label="Share of equity"><div class="dv-cellbar"><span>${h(fmt.pct(b.pct, 1))}</span>${Ch.bar({ pct: b.pct, label: `${b.label} ${fmt.pct(b.pct, 1)} of equity` })}</div></td><td data-label="Holdings">${b.holdings.length}</td></tr>`;
      if (isOpen) out += b.holdings.map((x) => `<tr class="pf-sub"><td data-label="Holding"><span class="pf-indent">${h(x.name)}</span> <small>${h(name(names, x.owner))}</small></td><td data-label="Worth">${h(fmt.inr(x.value))}</td><td data-label="Share of equity">${h(fmt.pct(x.pct, 1))}</td><td data-label=""></td></tr>`).join("");
      return out;
    }).join("");
    const top = bd.top.map((t) => `<li><span>${h(t.name)}</span><b>${h(fmt.pct(t.pct, 1))}</b><small>${h(fmt.inr(t.value))}</small></li>`).join("");
    const sectors = bd.sectors.length ? bd.sectors.map((s) => `<li><span>${h(s.label)}</span><b>${h(fmt.pct(s.pct, 1))}</b><small>${h(fmt.inr(s.value))}</small></li>`).join("") : `<li><span>No sector funds</span></li>`;

    const g = m.gains || [];
    const exemption = m.exemption;
    const gainRows = g.map((x) => `<tr><td data-label="Person"><strong>${h(name(names, x.owner))}</strong></td>
        <td data-label="Gains now">${h(fmt.inr(x.unrealisedGain))}</td>
        <td data-label="Losses now"><span class="dv-delta ${x.unrealisedLoss < 0 ? "bad" : "flat"}">${h(signed(x.unrealisedLoss, fmt))}</span>${x.biggestLosses.length ? `<br><small>${x.biggestLosses.map((l) => h(l.name) + " " + h(signed(l.gain, fmt))).join(" · ")}</small>` : ""}</td>
        <td data-label="Booked this year">${h(fmt.inr(x.realisedLong))} long-term<br><small>${h(fmt.inr(x.realisedShort))} short-term${x.realisedUnknownTerm ? ` · ${h(signed(x.realisedUnknownTerm, fmt))} term unknown` : ""}</small></td>
        <td data-label="Tax-free limit left">${x.exemptionLeft === null ? "—" : `<strong>${h(fmt.inr(x.exemptionLeft))}</strong><br><small>of ${h(fmt.inr(exemption))}; ${h(fmt.inr(x.exemptionUsed))} used</small>`}</td>
        <td data-label="Long-term gain in open lots">${h(fmt.inr(x.longEquityGainOpen))}${x.unknownTermLots ? `<br><small>${x.unknownTermLots} lot${x.unknownTermLots === 1 ? "" : "s"} with no real buy date not counted</small>` : ""}</td></tr>`).join("");
    const gains = g.length ? `<section class="dv-card pf-compare"><header class="dv-card-head"><div><h4>This year's gains and losses</h4><p>Open holdings valued today, and sales already booked this financial year, next to the tax-free long-term limit.</p></div></header>
      <div class="table-wrap"><table class="dv-table up-table"><thead><tr><th>Person</th><th>Gains now</th><th>Losses now</th><th>Booked this year</th><th>Tax-free limit left</th><th>Long-term gain in open lots</th></tr></thead><tbody>${gainRows}</tbody></table></div>
      <p class="dv-note">“Now” means if everything were sold today; nothing is sold by looking at this. The limit is the long-term equity gain that is tax-free in a financial year; where a buy date is missing the term cannot be told, so that lot is left out rather than guessed. For the tax on a sale, see the Tax page. Information from your records, not advice.</p></section>` : "";

    return `<div class="pf-bars"><div class="pf-bar-row"><span>Equity ${h(fmt.inr(bd.total))}</span>${Ch.stack(parts, "Equity split")}</div></div>
      <div class="table-wrap"><table class="dv-table pf-table up-bd"><thead><tr><th>Bucket</th><th>Worth</th><th>Share of equity</th><th>Holdings</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="up-two"><div><h5>Biggest holdings (share of equity)</h5><ul class="up-list">${top}</ul></div><div><h5>Sector and thematic funds</h5><ul class="up-list">${sectors}</ul></div></div>
      ${bd.notes.map((n) => `<p class="dv-note">${h(n)}</p>`).join("")}${gains}`;
  }

  return { stale, sales, breakdown, dateText };
});
