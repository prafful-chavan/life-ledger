/**
 * Life Ledger — Protection page UI: birthdays, insurance policies, vehicles, and starter goal suggestions.
 * Data lives in the vault (state.people / state.insurance / state.vehicles) and syncs like everything else.
 * Pure logic is in protection-core.js.
 */
(function () {
  "use strict";
  const P = () => window.LifeLedgerProtection;
  const App = () => window.LifeLedgerApp;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (v) => "₹" + Math.round(Number(v) || 0).toLocaleString("en-IN");
  const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const prettyDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return isNaN(d) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
  const uid = (p) => `${p}-${(crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2) + Date.now())}`;
  const NAMES = { Me: "Prafful", Wife: "Archana", Both: "Both of you" };

  const FORMS = {
    vehicle: {
      title: "Vehicle", key: "vehicles", prefix: "veh",
      fields: [
        ["name", "Name (e.g. Altroz)", "text"], ["type", "Type", "select", ["Car", "Bike", "Scooter", "Other"]], ["owner", "Owner", "select", ["Me", "Wife", "Both"]],
        ["purchaseDate", "Bought on", "date"], ["purchasePrice", "Bought for (₹)", "number"], ["value", "Approx. value today (₹)", "number"], ["note", "Note", "text"],
      ],
    },
    insurance: {
      title: "Insurance policy", key: "insurance", prefix: "ins",
      fields: [
        ["person", "Whose cover", "select", ["Me", "Wife", "Both"]], ["type", "Type", "select", ["Term life", "Health", "Car", "Bike", "Home", "Accident", "Other"]],
        ["employer", "Employer group cover (ends with the job)", "select", ["No", "Yes"]],
        ["insurer", "Insurer", "text"], ["policyName", "Policy name", "text"], ["cover", "Cover / sum assured (₹)", "number"], ["premium", "Premium (₹)", "number"],
        ["frequency", "Paid", "select", ["Yearly", "Half-yearly", "Quarterly", "Monthly"]], ["nextDue", "Next premium due", "date"], ["nominee", "Nominee", "text"], ["note", "Note", "text"],
      ],
    },
  };

  let editing = null;   // { kind, id|null }

  function state() { return App().getState(); }
  function save() { App().renderAll(); return App().saveData(true); }

  /** First visit: put the empty ₹0 rows in place so the page is ready to fill. */
  function seedOnce() {
    const s = state();
    if (s.protectionSeeded) return false;
    if (!s.vehicles.length) s.vehicles.push({ id: uid("veh"), name: "Altroz", type: "Car", owner: "Me", purchaseDate: "", purchasePrice: 0, value: 0, note: "" });
    if (!s.insurance.length) {
      [["Me", "Term life", ""], ["Wife", "Term life", ""], ["Both", "Health", ""], ["Me", "Car", "Altroz"]].forEach(([person, type, note]) => {
        s.insurance.push({ id: uid("ins"), person, type, insurer: "", policyName: "", cover: 0, premium: 0, frequency: "Yearly", nextDue: "", nominee: "", note });
      });
    }
    s.protectionSeeded = true;
    save();
    return true;
  }

  const chip = (cls, text) => `<span class="prot-chip ${cls}">${esc(text)}</span>`;
  const statusChip = (status, okText, lowText) => status === "ok" ? chip("good", okText) : status === "low" ? chip("warn", lowText) : status === "employer" ? chip("warn", "Only through the employer") : chip("muted", "Not added yet");
  // Own policies and employer group cover shown apart: the employer's cover stops when the job does.
  const coverSplit = (c) => c.employerCover > 0 ? `<div class="prot-sub">Your own policies ${inr(c.ownCover)} · employer group cover ${inr(c.employerCover)}${c.status === "employer" ? ": it ends if you leave or change jobs, so buy your own while it is active" : ""}</div>` : "";

  /** The rules of thumb as settings: change them here and Protection, the Tax page and the daily email all follow. */
  function guideEditor() {
    const g = P().guides(state()), D = P().DEFAULT_GUIDES, mine = state().ruleSettings || {};
    const f = (key, label, val, def, step, min, max) => `<label class="prot-guide"><span>${esc(label)}</span><input type="number" data-guide="${key}" min="${min}" max="${max}" step="${step}" value="${mine[key] != null ? esc(mine[key]) : ""}" placeholder="${esc(def)}" /><small class="prot-sub">now ${esc(val)}${mine[key] == null ? " (common default)" : ""}</small></label>`;
    return `<details class="prot-guides"><summary>Change these guides</summary>
      <p class="prot-sub">Term cover as a multiple of yearly income, and the family health-cover baseline. Leave a box empty for the common default. The emergency-fund target is set in Wealth Advisor → About me &amp; my goals.</p>
      <div class="prot-guide-row">${f("termMultipleMin", "Term cover: at least (× yearly income)", g.termMultipleMin, D.termMultipleMin, 1, 1, 50)}${f("termMultipleMax", "Term cover: up to (× yearly income)", g.termMultipleMax, D.termMultipleMax, 1, 1, 60)}${f("healthBaseline", "Family health cover: at least (₹)", g.healthBaseline, D.healthBaseline, 50000, 100000, 100000000)}</div></details>`;
  }

  function render() {
    const root = $("protectionBody");
    if (!root || !App() || !P()) return;
    const s = state(), t = today(), sum = P().summary(s, t);
    const people = s.people || {};
    const person = (key, label) => {
      const dob = (people[key] || {}).dob || "";
      const age = P().ageOn(dob, t), nb = P().nextBirthday(dob, t);
      return `<div class="prot-person">
        <div><div class="prot-person-name">${esc(label)}</div>
          <div class="prot-sub">${age == null ? "Add a birth date" : `${age} years old`}${nb ? ` · ${nb.days === 0 ? "birthday today 🎂" : `turns ${nb.turning} in ${nb.days} day${nb.days === 1 ? "" : "s"}`}` : ""}</div></div>
        <label class="prot-dob">Born <input type="date" data-dob="${key}" value="${esc(dob)}" /></label>
      </div>`;
    };
    const termRow = (c) => `<div class="prot-check"><div><b>Term life · ${esc(NAMES[c.who])}</b>
        <div class="prot-sub">${c.income > 0 ? `Common guide: ${c.multipleMin === c.multipleMax ? c.multipleMin : `${c.multipleMin}–${c.multipleMax}`} × yearly income = ${inr(c.min)} – ${inr(c.max)}` : "Add a salary to see a guide"}</div>${coverSplit(c)}</div>
        <div class="prot-check-right"><b>${c.cover > 0 ? inr(c.cover) : "—"}</b> ${statusChip(c.status, "In the guide", "Below the guide")}</div></div>`;
    const h = sum.health;
    const due = sum.dueSoon.length ? `<div class="prot-alert">${sum.dueSoon.map((x) => `<div>⏰ <b>${esc(x.p.type)}${x.p.insurer ? " · " + esc(x.p.insurer) : ""}</b> ${x.s.state === "overdue" ? `was due ${Math.abs(x.s.days)} day${Math.abs(x.s.days) === 1 ? "" : "s"} ago` : x.s.days === 0 ? "is due today" : `is due in ${x.s.days} day${x.s.days === 1 ? "" : "s"}`} (${prettyDate(x.p.nextDue)}) · ${inr(x.p.premium)}</div>`).join("")}</div>` : "";

    const policyCard = (p) => {
      const ds = P().dueStatus(p.nextDue, t);
      const dueText = ds.state === "none" ? "No due date" : `${prettyDate(p.nextDue)} · ${ds.state === "overdue" ? "overdue" : ds.days === 0 ? "today" : "in " + ds.days + " days"}`;
      const empty = !(Number(p.cover) > 0 || Number(p.premium) > 0 || p.insurer);
      return `<article class="prot-card ${empty ? "is-empty" : ""}">
        <div class="prot-card-top"><div><div class="prot-card-title">${esc(p.type)}${p.policyName ? " · " + esc(p.policyName) : ""}</div>
          <div class="prot-sub">${esc(NAMES[p.person] || p.person)}${P().isEmployer(p) ? " · Employer cover" : ""}${p.insurer ? " · " + esc(p.insurer) : ""}${p.note ? " · " + esc(p.note) : ""}</div></div>
          ${ds.state === "overdue" ? chip("bad", "Overdue") : ds.state === "soon" ? chip("warn", "Due soon") : empty ? chip("muted", "Fill in") : ""}</div>
        <div class="prot-nums"><div><span>Cover</span><b>${inr(p.cover)}</b></div><div><span>Premium</span><b>${inr(p.premium)}</b><small>${esc(p.frequency || "Yearly")}</small></div><div><span>Next due</span><b class="prot-small">${esc(dueText)}</b></div></div>
        <div class="prot-actions"><button type="button" class="secondary-button" data-act="edit" data-kind="insurance" data-id="${esc(p.id)}">Edit</button>
          ${p.nextDue ? `<button type="button" class="secondary-button" data-act="paid" data-id="${esc(p.id)}">Mark paid</button>` : ""}
          <button type="button" class="ghost-button" data-act="delete" data-kind="insurance" data-id="${esc(p.id)}">Delete</button></div></article>`;
    };
    const vehicleCard = (v) => `<article class="prot-card ${Number(v.value) > 0 ? "" : "is-empty"}">
        <div class="prot-card-top"><div><div class="prot-card-title">${esc(v.name || "Vehicle")}</div><div class="prot-sub">${esc(v.type || "")} · ${esc(NAMES[v.owner] || v.owner || "")}${v.note ? " · " + esc(v.note) : ""}</div></div>${Number(v.value) > 0 ? "" : chip("muted", "Fill in")}</div>
        <div class="prot-nums"><div><span>Worth now</span><b>${inr(v.value)}</b></div><div><span>Bought for</span><b>${Number(v.purchasePrice) > 0 ? inr(v.purchasePrice) : "—"}</b></div><div><span>Bought on</span><b class="prot-small">${esc(prettyDate(v.purchaseDate))}</b></div></div>
        <div class="prot-actions"><button type="button" class="secondary-button" data-act="edit" data-kind="vehicle" data-id="${esc(v.id)}">Edit</button><button type="button" class="ghost-button" data-act="delete" data-kind="vehicle" data-id="${esc(v.id)}">Delete</button></div></article>`;

    root.innerHTML = `
      <section class="panel"><div class="panel-header"><div><h3>The two of you</h3><p>Birth dates keep ages and birthdays right everywhere.</p></div></div>
        <div class="prot-people">${person("me", "Prafful")}${person("wife", "Archana")}</div></section>

      <div class="prot-summary">
        <div class="prot-stat"><span>Vehicles worth</span><b>${inr(sum.vehiclesValue)}</b></div>
        <div class="prot-stat"><span>Premiums a year</span><b>${inr(sum.yearlyPremium)}</b>${sum.premiumShareOfIncome != null ? `<small>${sum.premiumShareOfIncome.toFixed(1)}% of income</small>` : ""}</div>
        <div class="prot-stat"><span>Renewals soon</span><b>${sum.dueSoon.length}</b></div>
      </div>
      ${due}

      <section class="panel"><div class="panel-header"><div><h3>Is your cover enough?</h3><p>Common rules of thumb, only a guide, not advice.</p></div></div>
        ${sum.term.map(termRow).join("")}
        <div class="prot-check"><div><b>Health cover (family)</b><div class="prot-sub">Common guide: at least ${inr(h.baseline)} in total</div>${coverSplit(h)}</div>
          <div class="prot-check-right"><b>${h.cover > 0 ? inr(h.cover) : "—"}</b> ${statusChip(h.status, "In the guide", "Below the guide")}</div></div>
        ${guideEditor()}</section>

      <section class="panel"><div class="panel-header"><div><h3>Insurance policies</h3><p>Cover, premium and renewal date for each policy.</p></div>
        <button type="button" class="primary-button" data-act="add" data-kind="insurance">Add policy</button></div>
        <div class="prot-list">${s.insurance.length ? s.insurance.map(policyCard).join("") : `<p class="prot-empty">No policies yet.</p>`}</div></section>

      <section class="panel"><div class="panel-header"><div><h3>Vehicles</h3><p>Approximate values count in your net worth. If a vehicle is also listed under Finance → Others, remove it there so it is not counted twice.</p></div>
        <button type="button" class="primary-button" data-act="add" data-kind="vehicle">Add vehicle</button></div>
        <div class="prot-list">${s.vehicles.length ? s.vehicles.map(vehicleCard).join("") : `<p class="prot-empty">No vehicles yet.</p>`}</div></section>`;
  }

  // ── add / edit dialog ───────────────────────────────────────────────────────
  function openForm(kind, id) {
    const def = FORMS[kind]; if (!def) return;
    const rec = id ? state()[def.key].find((r) => r.id === id) : null;
    editing = { kind, id: rec ? rec.id : null };
    $("protectionModalEyebrow").textContent = rec ? "Edit" : "Add";
    $("protectionModalTitle").textContent = def.title;
    $("protectionForm").innerHTML = def.fields.map(([name, label, type, options]) => {
      const val = rec && rec[name] != null ? rec[name] : (type === "number" ? "" : "");
      const input = type === "select"
        ? `<select name="${name}">${options.map((o) => `<option value="${esc(o)}" ${val === o ? "selected" : ""}>${esc(NAMES[o] && (name === "owner" || name === "person") ? NAMES[o] : o)}</option>`).join("")}</select>`
        : `<input name="${name}" type="${type}" ${type === "number" ? 'step="any" inputmode="decimal"' : ""} value="${esc(val)}" />`;
      return `<label>${esc(label)}${input}</label>`;
    }).join("") + `<button type="submit" class="primary-button full-span">Save</button>`;
    $("protectionModal").hidden = false;
  }
  function closeForm() { $("protectionModal").hidden = true; editing = null; }

  function submitForm(e) {
    e.preventDefault();
    if (!editing) return;
    const def = FORMS[editing.kind], list = state()[def.key];
    const data = {};
    new FormData($("protectionForm")).forEach((v, k) => { data[k] = v; });
    ["cover", "premium", "value", "purchasePrice"].forEach((k) => { if (k in data) data[k] = Number(data[k]) || 0; });
    if (editing.id) { const i = list.findIndex((r) => r.id === editing.id); if (i >= 0) list[i] = { ...list[i], ...data }; }
    else list.push({ id: uid(def.prefix), ...data });
    closeForm(); save(); render();
  }

  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const kind = b.dataset.kind, id = b.dataset.id, s = state();
    if (b.dataset.act === "add") openForm(kind);
    else if (b.dataset.act === "edit") openForm(kind, id);
    else if (b.dataset.act === "delete") {
      const def = FORMS[kind];
      if (confirm(`Delete this ${def.title.toLowerCase()}?`)) { s[def.key] = s[def.key].filter((r) => r.id !== id); save(); render(); }
    } else if (b.dataset.act === "paid") {
      const p = s.insurance.find((r) => r.id === id);
      if (p) { p.nextDue = P().advanceDue(p.nextDue, p.frequency); save(); render(); }
    }
  }
  function onChange(e) {
    const gd = e.target.closest("[data-guide]");
    if (gd) {
      // The rules of thumb. An empty box goes back to the default; the guides are always kept sane (see protection-core guides())
      const s = state(), next = { ...(s.ruleSettings || {}) }, key = gd.dataset.guide;
      if (gd.value === "") delete next[key]; else next[key] = Number(gd.value);
      s.ruleSettings = next; save(); render(); return;
    }
    const d = e.target.closest("[data-dob]");
    if (!d) return;
    const s = state(); s.people = s.people || {};
    s.people[d.dataset.dob] = { ...(s.people[d.dataset.dob] || {}), dob: d.value };
    save(); render();
  }

  // ── goal suggestions on the Goals page ─────────────────────────────────────
  function renderGoalSuggestions() {
    const grid = $("goalsGrid"); if (!grid || !App() || !P()) return;
    let box = $("goalSuggest");
    if (!box) { box = document.createElement("section"); box.id = "goalSuggest"; box.className = "panel goal-suggest"; grid.parentNode.insertBefore(box, grid); }
    const list = P().suggestGoals(state(), today());
    box.hidden = !list.length;
    if (!list.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="panel-header"><div><h3>Suggested goals</h3><p>Worked out from your own spending and savings. Edit them after adding.</p></div></div>` +
      list.map((g) => `<div class="goal-suggest-row"><div><b>${esc(g.name)}</b> · ${inr(g.target)}${g.dueDate ? ` by ${esc(prettyDate(g.dueDate))}` : ""}<div class="prot-sub">${esc(g.why)}</div></div>
        <button type="button" class="secondary-button" data-suggest="${esc(g.key)}">Add goal</button></div>`).join("");
  }
  function onSuggestClick(e) {
    const b = e.target.closest("[data-suggest]"); if (!b) return;
    const g = P().suggestGoals(state(), today()).find((x) => x.key === b.dataset.suggest); if (!g) return;
    state().goals.push({ id: uid("goal"), name: g.name, category: g.category, owner: g.owner, target: g.target, saved: g.saved, track: g.track, dueDate: g.dueDate });
    save(); renderGoalSuggestions();
  }

  function init() {
    const body = $("protectionBody"); if (!body) return;
    body.addEventListener("click", onClick); body.addEventListener("change", onChange);
    $("protectionForm")?.addEventListener("submit", submitForm);
    document.querySelector("#protectionModal [data-close-modal]")?.addEventListener("click", closeForm);
    document.addEventListener("click", (e) => {
      if (e.target.closest('[data-view="protection"]')) setTimeout(() => { seedOnce(); render(); }, 60);
      if (e.target.closest('[data-view="goals"]')) setTimeout(renderGoalSuggestions, 80);
    });
    $("goals")?.addEventListener("click", onSuggestClick);
    window.addEventListener("ll:data-changed", () => { render(); renderGoalSuggestions(); });
    window.addEventListener("ll:prices-updated", renderGoalSuggestions);
    setTimeout(() => { if (App()?.getState) { render(); renderGoalSuggestions(); } }, 3000);
  }
  window.addEventListener("load", init);
  window.LifeLedgerProtectionUI = { render, renderGoalSuggestions, seedOnce };
})();
