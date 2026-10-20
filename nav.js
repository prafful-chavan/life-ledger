/**
 * Life Ledger — navigation shell: ⌘K command bar (jump anywhere, run an action, or ask Hey Prafful),
 * the five-tab iPhone bar with a "More" sheet, and the topbar overflow menu.
 * It only drives the existing controls (.nav-item buttons, #themeToggle, #chatForm…), so nothing else changes.
 */
(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const Cmdk = () => window.LifeLedgerCmdk;

  const ICON = {
    search: '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm5-2 5 5"></path>',
    home: '<path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z"></path>',
    money: '<rect x="3" y="6" width="18" height="13" rx="2"></rect><path d="M16 12.5h2"></path>',
    advisor: '<circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z"></path>',
    health: '<path d="M3 12h4l2-6 4 12 2-6h6"></path>',
    more: '<circle cx="5" cy="12" r="1.3"></circle><circle cx="12" cy="12" r="1.3"></circle><circle cx="19" cy="12" r="1.3"></circle>',
    protection: '<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6z"></path>',
    tax: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6M9 12h6"></path>',
    goals: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
    career: '<rect x="3" y="7" width="18" height="13" rx="2"></rect><path d="M9 7V5h6v2"></path>',
    todo: '<path d="M9 6h11M9 12h11M9 18h11M4 6h1M4 12h1M4 18h1"></path>',
    habits: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
    ask: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>',
    settings: '<circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"></path>',
    theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path>',
  };
  const svg = (name, size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

  const PAGES = [
    { view: "dashboard", label: "Dashboard", keywords: ["home", "overview", "net worth", "command center"], icon: "home" },
    { view: "finance", label: "Finance", keywords: ["money", "expenses", "income", "salary", "liabilities", "loans", "net worth history"], icon: "money" },
    { view: "advisor", label: "Wealth Advisor", keywords: ["portfolio", "invest", "mutual funds", "stocks", "score", "health"], icon: "advisor" },
    { view: "protection", label: "Protection", keywords: ["insurance", "vehicle", "car", "bike", "policy", "premium", "term", "health cover", "birthday", "age"], icon: "protection" },
    { view: "tax", label: "Tax", keywords: ["income tax", "itr", "regime", "refund", "capital gains", "advance tax", "80c", "hra", "nps", "deadline", "return"], icon: "tax" },
    { view: "goals", label: "Goals", keywords: ["targets", "savings", "milestones"], icon: "goals" },
    { view: "exercise", label: "Exercise", keywords: ["steps", "cycling", "workout", "walk", "run", "fitness"], icon: "health" },
    { view: "habits", label: "Habits", keywords: ["streak", "routine", "daily"], icon: "habits" },
    { view: "career", label: "Career", keywords: ["roadmap", "interview", "study", "devops"], icon: "career" },
    { view: "todo", label: "To-Do List", keywords: ["tasks", "notes", "checklist", "reminders"], icon: "todo" },
    { view: "assistant", label: "Hey Prafful", keywords: ["ai", "chat", "assistant", "ask"], icon: "ask" },
  ];

  function goToView(view) {
    const btn = $(`.nav-item[data-view="${view}"]`);
    if (btn) btn.click();
    window.scrollTo(0, 0);
  }

  // ── ⌘K command bar ────────────────────────────────────────────────────────────
  let bar, input, list, shown = [], sel = 0, lastFocus = null;

  function actionItems() {
    const acts = [
      { id: "act:refresh", label: "Refresh all prices", keywords: ["live prices", "update", "nav", "stocks"], icon: "money", run: () => $("#topbarRefreshAllBtn")?.click() },
      { id: "act:theme", label: document.body.dataset.theme === "dark" ? "Switch to light mode" : "Switch to dark mode", keywords: ["theme", "appearance", "dark", "light"], icon: "theme", run: () => $("#themeToggle")?.click() },
      { id: "act:settings", label: "Open settings", keywords: ["preferences", "keys", "gemini", "dropbox", "spending import"], icon: "settings", run: () => $("#settingsButton")?.click() },
      { id: "act:health", label: "Data health check", keywords: ["audit", "verify", "numbers", "reconcile", "check data", "errors"], icon: "settings", run: () => $('[data-open-modal="dataHealthModal"]')?.click() },
      { id: "act:upload", label: "Upload a sheet", keywords: ["import", "excel", "csv", "xlsx"], icon: "money", run: () => $('[data-open-modal="importModal"]')?.click() },
      { id: "act:log", label: "Notifications log", keywords: ["sync log", "issues", "history"], icon: "settings", run: () => $('[data-open-modal="syncLogModal"]')?.click() },
    ];
    return acts.map((a) => ({ ...a, group: "Actions" }));
  }

  function baseItems() {
    return [
      ...PAGES.map((p) => ({ id: "page:" + p.view, label: p.label, hint: "Go to", keywords: p.keywords, icon: p.icon, group: "Pages", run: () => goToView(p.view) })),
      ...actionItems(),
    ];
  }

  function ask(question) {
    goToView("assistant");
    setTimeout(() => {
      const chatInput = $("#chatInput");
      const form = $("#chatForm");
      if (!chatInput || !form) return;
      chatInput.value = question;
      chatInput.dispatchEvent(new Event("input", { bubbles: true }));
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    }, 150);
  }

  function compute(query) {
    const q = String(query || "").trim();
    const matches = Cmdk().rank(q, baseItems());
    const out = matches.slice(0, 8);
    if (q.length >= 2) out.push({ id: "ask", label: `Ask Hey Prafful: “${q}”`, hint: "AI", icon: "ask", group: "Ask", run: () => ask(q) });
    // a question-shaped query goes to the assistant first
    if (q.length >= 2 && (/\?$/.test(q) || /^(how|what|why|when|where|which|who|can|should|is|am|do|does|show|tell|compare)\b/i.test(q))) out.unshift(out.pop());
    return out;
  }

  function render() {
    list.innerHTML = "";
    let group = null;
    shown.forEach((item, i) => {
      if (item.group !== group) {
        group = item.group;
        const g = document.createElement("div");
        g.className = "cmdk-group";
        g.setAttribute("role", "presentation");
        g.textContent = group;
        list.append(g);
      }
      const row = document.createElement("button");
      row.type = "button";
      row.className = "cmdk-item" + (i === sel ? " active" : "");
      row.id = "cmdk-opt-" + i;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(i === sel));
      row.innerHTML = `<span class="cmdk-ico">${svg(item.icon || "search", 18)}</span><span class="cmdk-label"></span><span class="cmdk-hint"></span>`;
      $(".cmdk-label", row).textContent = item.label;
      $(".cmdk-hint", row).textContent = item.hint || "";
      row.addEventListener("click", () => choose(i));
      row.addEventListener("pointermove", () => { if (sel !== i) { sel = i; mark(); } });
      list.append(row);
    });
    if (!shown.length) list.innerHTML = '<div class="cmdk-empty">Nothing matches — type a question and press Enter to ask Hey Prafful.</div>';
    input.setAttribute("aria-activedescendant", shown.length ? "cmdk-opt-" + sel : "");
  }

  function mark() {
    $$(".cmdk-item", list).forEach((el, i) => {
      el.classList.toggle("active", i === sel);
      el.setAttribute("aria-selected", String(i === sel));
    });
    $("#cmdk-opt-" + sel, list)?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", "cmdk-opt-" + sel);
  }

  function choose(i) {
    const item = shown[i];
    if (!item) return;
    close();
    setTimeout(() => item.run(), 30);
  }

  function openBar() {
    if (!bar) build();
    lastFocus = document.activeElement;
    closeMore();
    bar.hidden = false;
    document.body.classList.add("cmdk-open");
    input.value = "";
    shown = compute("");
    sel = 0;
    render();
    setTimeout(() => input.focus(), 0);
  }

  function close() {
    if (!bar || bar.hidden) return;
    bar.hidden = true;
    document.body.classList.remove("cmdk-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function build() {
    bar = document.createElement("div");
    bar.className = "cmdk";
    bar.id = "cmdk";
    bar.hidden = true;
    bar.innerHTML = `
      <div class="cmdk-backdrop" data-cmdk-close></div>
      <div class="cmdk-panel" role="dialog" aria-modal="true" aria-label="Search or ask Hey Prafful">
        <div class="cmdk-field">${svg("search", 18)}<input type="text" id="cmdkInput" role="combobox" aria-expanded="true" aria-controls="cmdkList" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Jump to a page, run an action, or ask a question…" /><kbd>esc</kbd></div>
        <div class="cmdk-list" id="cmdkList" role="listbox"></div>
        <div class="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span>Questions go to Hey Prafful</span></div>
      </div>`;
    document.body.append(bar);
    input = $("#cmdkInput", bar);
    list = $("#cmdkList", bar);
    bar.addEventListener("click", (e) => { if (e.target.closest("[data-cmdk-close]")) close(); });
    input.addEventListener("input", () => { shown = compute(input.value); sel = 0; render(); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); if (shown.length) { sel = (sel + 1) % shown.length; mark(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (shown.length) { sel = (sel - 1 + shown.length) % shown.length; mark(); } }
      else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    });
  }

  // ── iPhone tab bar + More sheet ───────────────────────────────────────────────
  let tabs, sheet;
  const TAB_VIEWS = {
    dashboard: ["dashboard"],
    finance: ["finance"],
    advisor: ["advisor"],
    exercise: ["exercise", "habits"],
  };

  function buildTabs() {
    tabs = document.createElement("nav");
    tabs.className = "mobile-tabs";
    tabs.setAttribute("aria-label", "Tabs");
    const defs = [
      { key: "dashboard", label: "Home", icon: "home", act: () => goToView("dashboard") },
      { key: "finance", label: "Money", icon: "money", act: () => goToView("finance") },
      { key: "advisor", label: "Advisor", icon: "advisor", act: () => goToView("advisor") },
      { key: "exercise", label: "Health", icon: "health", act: () => goToView("exercise") },
      { key: "more", label: "More", icon: "more", act: () => toggleMore() },
    ];
    defs.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mobile-tab";
      b.dataset.tab = d.key;
      b.innerHTML = `${svg(d.icon, 22)}<span>${d.label}</span>`;
      b.addEventListener("click", d.act);
      tabs.append(b);
    });
    document.body.append(tabs);

    sheet = document.createElement("div");
    sheet.className = "more-sheet";
    sheet.id = "moreSheet";
    sheet.hidden = true;
    sheet.innerHTML = `
      <div class="more-backdrop" data-more-close></div>
      <div class="more-panel" role="dialog" aria-modal="true" aria-label="More">
        <div class="more-grip" aria-hidden="true"></div>
        <div class="more-grid"></div>
      </div>`;
    document.body.append(sheet);
    const grid = $(".more-grid", sheet);
    const entries = [
      { label: "Goals", icon: "goals", run: () => goToView("goals") },
      { label: "Protection", icon: "protection", run: () => goToView("protection") },
      { label: "Tax", icon: "tax", run: () => goToView("tax") },
      { label: "Habits", icon: "habits", run: () => goToView("habits") },
      { label: "Career", icon: "career", run: () => goToView("career") },
      { label: "To-Do", icon: "todo", run: () => goToView("todo") },
      { label: "Hey Prafful", icon: "ask", run: () => goToView("assistant") },
      { label: "Search", icon: "search", run: () => openBar() },
      { label: "Settings", icon: "settings", run: () => $("#settingsButton")?.click() },
      { label: "Theme", icon: "theme", run: () => $("#themeToggle")?.click() },
    ];
    entries.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "more-item";
      b.innerHTML = `<span class="more-ico">${svg(e.icon, 22)}</span><span>${e.label}</span>`;
      b.addEventListener("click", () => { closeMore(); setTimeout(e.run, 30); });
      grid.append(b);
    });
    sheet.addEventListener("click", (e) => { if (e.target.closest("[data-more-close]")) closeMore(); });
    syncTabs();
    const navList = $(".nav-list");
    if (navList) new MutationObserver(syncTabs).observe(navList, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  function syncTabs() {
    if (!tabs) return;
    const active = $(".nav-item.active")?.dataset.view || "dashboard";
    let key = "more";
    for (const [k, views] of Object.entries(TAB_VIEWS)) if (views.includes(active)) key = k;
    $$(".mobile-tab", tabs).forEach((b) => {
      const on = b.dataset.tab === key;
      b.classList.toggle("active", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  function toggleMore() { if (sheet.hidden) { sheet.hidden = false; document.body.classList.add("more-open"); } else closeMore(); }
  function closeMore() { if (sheet && !sheet.hidden) { sheet.hidden = true; document.body.classList.remove("more-open"); } }

  // ── Topbar overflow menu: close on outside click / Escape / after choosing ───
  function bindMoreMenu() {
    const d = $("#topbarMore");
    if (!d) return;
    const menu = d.querySelector(".topbar-menu"), btn = d.querySelector("summary");
    if (!menu || !btn) return;
    document.addEventListener("click", (e) => { if (d.open && !d.contains(e.target) && !menu.contains(e.target)) d.open = false; });
    menu.addEventListener("click", (e) => { if (e.target.closest(".menu-item")) setTimeout(() => { d.open = false; }, 0); });
    // The menu is a dropdown of a row that scrolls sideways on a phone (that clipped it) and sits under the page's
    // own layers (Safari painted the page over it). So while it is open it lives at the top level of the page,
    // fixed under the ⋯ button, above everything; when it closes it goes back into place.
    const home = document.createComment("topbar-menu");
    d.insertBefore(home, menu);
    const place = () => {
      if (!d.open) {
        if (menu.parentNode !== d) { home.after(menu); }
        menu.removeAttribute("style");
        return;
      }
      if (menu.parentNode !== document.body) document.body.appendChild(menu);
      const r = btn.getBoundingClientRect();
      Object.assign(menu.style, {
        position: "fixed", zIndex: "3000", left: "auto", maxWidth: "calc(100vw - 16px)",
        top: Math.round(r.bottom + 8) + "px", right: Math.max(8, Math.round(window.innerWidth - r.right)) + "px",
      });
    };
    d.addEventListener("toggle", place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", () => { if (d.open) d.open = false; }, { passive: true });
  }

  // ── Finance: seventeen tabs become seven sections (+ a chip row for sections with several tabs) ──
  const FGROUPS = [
    { id: "overview", label: "Overview", tabs: ["overview"] },
    { id: "networth", label: "Net worth", tabs: ["networthhistory"] },
    { id: "salary", label: "Salary", tabs: ["income"] },
    { id: "expenses", label: "Expenses", tabs: ["expenses"] },
    { id: "invest", label: "Investments", tabs: ["mutualfunds", "stocks", "usstocks", "gold", "silver", "crypto", "bonds"] },
    { id: "savings", label: "Savings", tabs: ["fd", "epf", "ppf", "banksaving", "others"] },
    { id: "liab", label: "Liabilities", tabs: ["liabilities"] },
  ];

  function bindFinanceGroups() {
    const tabs = $("#finance .tabs");
    if (!tabs || $("#financeGroups")) return;
    const bar = document.createElement("div");
    bar.className = "fgroups";
    bar.id = "financeGroups";
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "Finance sections");
    const lastTab = {};
    FGROUPS.forEach((g) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "fgroup";
      b.dataset.group = g.id;
      b.textContent = g.label;
      b.addEventListener("click", () => {
        const target = lastTab[g.id] || g.tabs[0];
        $(`.tab-button[data-finance-tab="${target}"]`, tabs)?.click();
      });
      bar.append(b);
    });
    tabs.before(bar);
    tabs.classList.add("fsubtabs");

    const sync = () => {
      const active = $(".tab-button.active", tabs)?.dataset.financeTab || "overview";
      const group = FGROUPS.find((g) => g.tabs.includes(active)) || FGROUPS[0];
      lastTab[group.id] = active;
      $$(".fgroup", bar).forEach((b) => {
        const on = b.dataset.group === group.id;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", String(on));
      });
      $$(".tab-button", tabs).forEach((b) => {
        const i = group.tabs.indexOf(b.dataset.financeTab);
        b.hidden = i < 0;
        b.style.order = i < 0 ? "99" : String(i);
      });
      tabs.hidden = group.tabs.length < 2;
    };
    sync();
    new MutationObserver(sync).observe(tabs, { attributes: true, subtree: true, attributeFilter: ["class"] });
  }

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); bar && !bar.hidden ? close() : openBar(); }
    else if (e.key === "Escape") { closeMore(); const d = $("#topbarMore"); if (d && d.open) d.open = false; }
  });

  window.addEventListener("load", () => {
    $("#cmdkTrigger")?.addEventListener("click", openBar);
    buildTabs();
    bindMoreMenu();
    bindFinanceGroups();
  });

  window.LifeLedgerNav = { open: openBar, close, goToView };
})();
