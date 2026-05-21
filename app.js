const THEME_STORAGE_KEY = "lifeLedgerTheme:v1";
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const COLORS = ["#176b5b", "#d8913c", "#4774b8", "#bd4b4b", "#7a5aa6", "#578b47", "#c16b3f"];

const defaultData = {
  income: [],
  expenses: [],
  assets: [],
  liabilities: [],
  goals: [],
  tasks: [],
  studies: [],
  workouts: [],
  chat: [],
};

const demoData = {
  income: [
    {
      id: "inc-1",
      date: "2024-04-01",
      person: "Me",
      source: "Current company",
      amount: 145000,
      type: "Salary",
    },
    {
      id: "inc-2",
      date: "2024-04-01",
      person: "Wife",
      source: "Company",
      amount: 92000,
      type: "Salary",
    },
    {
      id: "inc-3",
      date: "2025-04-01",
      person: "Me",
      source: "Current company",
      amount: 168000,
      type: "Salary",
    },
    {
      id: "inc-4",
      date: "2025-04-01",
      person: "Wife",
      source: "Company",
      amount: 108000,
      type: "Salary",
    },
    {
      id: "inc-5",
      date: thisMonthDate(1),
      person: "Me",
      source: "Current company",
      amount: 188000,
      type: "Salary",
    },
    {
      id: "inc-6",
      date: thisMonthDate(1),
      person: "Wife",
      source: "Company",
      amount: 122000,
      type: "Salary",
    },
  ],
  expenses: [
    {
      id: "exp-1",
      date: thisMonthDate(2),
      category: "Rent / EMI",
      paidBy: "Me",
      amount: 52000,
      note: "Home",
    },
    {
      id: "exp-2",
      date: thisMonthDate(4),
      category: "Groceries",
      paidBy: "Wife",
      amount: 18500,
      note: "Monthly essentials",
    },
    {
      id: "exp-3",
      date: thisMonthDate(7),
      category: "Travel",
      paidBy: "Me",
      amount: 12500,
      note: "Office and local",
    },
    {
      id: "exp-4",
      date: thisMonthDate(9),
      category: "Dining",
      paidBy: "Both",
      amount: 9600,
      note: "Restaurants",
    },
    {
      id: "exp-5",
      date: thisMonthDate(13),
      category: "Health",
      paidBy: "Wife",
      amount: 7200,
      note: "Medicines and checkup",
    },
    {
      id: "exp-6",
      date: lastMonthDate(16),
      category: "Rent / EMI",
      paidBy: "Me",
      amount: 52000,
      note: "Home",
    },
    {
      id: "exp-7",
      date: lastMonthDate(19),
      category: "Shopping",
      paidBy: "Both",
      amount: 21000,
      note: "Clothes and home items",
    },
  ],
  assets: [
    { id: "asset-1", name: "Bank savings", category: "Cash", value: 420000, owner: "Both" },
    { id: "asset-2", name: "Mutual funds", category: "Investments", value: 960000, owner: "Me" },
    { id: "asset-3", name: "PF / retirement", category: "Retirement", value: 610000, owner: "Both" },
    { id: "asset-4", name: "Gold", category: "Gold", value: 260000, owner: "Wife" },
  ],
  liabilities: [
    { id: "liab-1", name: "Credit card", category: "Card", value: 24000, owner: "Me" },
    { id: "liab-2", name: "Personal loan", category: "Loan", value: 180000, owner: "Both" },
  ],
  goals: [
    {
      id: "goal-1",
      name: "Emergency fund",
      category: "Finance",
      target: 900000,
      saved: 420000,
      dueDate: "2026-12-31",
    },
    {
      id: "goal-2",
      name: "Switch to higher package",
      category: "Career",
      target: 100,
      saved: 46,
      dueDate: "2026-09-30",
    },
    {
      id: "goal-3",
      name: "Family trip fund",
      category: "Family",
      target: 250000,
      saved: 65000,
      dueDate: "2027-03-31",
    },
  ],
  tasks: [
    { id: "task-1", text: "Review this month's expenses", date: todayISO(), done: false, area: "Finance" },
    { id: "task-2", text: "Solve 2 DSA problems", date: todayISO(), done: false, area: "Career" },
    { id: "task-3", text: "30 minute walk", date: todayISO(), done: true, area: "Health" },
  ],
  studies: [
    { id: "study-1", topic: "DSA patterns", status: "In progress", confidence: 58, hours: 42, targetHours: 90 },
    { id: "study-2", topic: "System design", status: "In progress", confidence: 38, hours: 18, targetHours: 60 },
    { id: "study-3", topic: "Behavioral stories", status: "Not started", confidence: 20, hours: 4, targetHours: 20 },
    { id: "study-4", topic: "Resume projects", status: "In progress", confidence: 65, hours: 16, targetHours: 24 },
  ],
  workouts: [
    { id: "work-1", date: todayISO(), type: "Walk", minutes: 30, intensity: "Easy" },
    { id: "work-2", date: daysAgoISO(1), type: "Strength", minutes: 45, intensity: "Medium" },
    { id: "work-3", date: daysAgoISO(3), type: "Yoga", minutes: 25, intensity: "Easy" },
  ],
  chat: [],
};

let state = clone(defaultData);
let activeView = "dashboard";
let activeFinanceTab = "overview";
let quickAddKind = "expense";

const assistantWelcome =
  "I can analyze your local dashboard data. Ask me about savings rate, high expenses, salary growth, net worth, goals, study plan, or today's focus.";

const fieldsByKind = {
  income: [
    ["date", "Date", "date"],
    ["person", "Person", "text"],
    ["source", "Source / company", "text"],
    ["amount", "Amount", "number"],
    ["type", "Type", "text"],
  ],
  expense: [
    ["date", "Date", "date"],
    ["category", "Category", "text"],
    ["paidBy", "Paid by", "text"],
    ["amount", "Amount", "number"],
    ["note", "Note", "textarea"],
  ],
  asset: [
    ["name", "Asset name", "text"],
    ["category", "Category", "text"],
    ["owner", "Owner", "text"],
    ["value", "Current value", "number"],
  ],
  liability: [
    ["name", "Liability name", "text"],
    ["category", "Category", "text"],
    ["owner", "Owner", "text"],
    ["value", "Outstanding value", "number"],
  ],
  goal: [
    ["name", "Goal name", "text"],
    ["category", "Category", "text"],
    ["target", "Target amount or score", "number"],
    ["saved", "Current progress", "number"],
    ["dueDate", "Due date", "date"],
  ],
  task: [
    ["text", "Task", "text"],
    ["area", "Area", "text"],
    ["date", "Date", "date"],
    ["done", "Done", "checkbox"],
  ],
  study: [
    ["topic", "Topic", "text"],
    ["status", "Status", "text"],
    ["confidence", "Confidence %", "number"],
    ["hours", "Hours done", "number"],
    ["targetHours", "Target hours", "number"],
  ],
  workout: [
    ["date", "Date", "date"],
    ["type", "Workout type", "text"],
    ["minutes", "Minutes", "number"],
    ["intensity", "Intensity", "text"],
  ],
};

const resetScopes = {
  income: { label: "salary / income", keys: ["income"] },
  expenses: { label: "expenses", keys: ["expenses"] },
  networth: { label: "assets and liabilities", keys: ["assets", "liabilities"] },
  finance: { label: "all finance data", keys: ["income", "expenses", "assets", "liabilities"] },
  studies: { label: "interview prep", keys: ["studies"] },
  goals: { label: "future goals", keys: ["goals"] },
  tasks: { label: "daily to-do", keys: ["tasks"] },
  workouts: { label: "exercise logs", keys: ["workouts"] },
  chat: { label: "assistant chat", keys: ["chat"] },
  all: { label: "everything", keys: Object.keys(defaultData) },
};

const organizationAliases = [
  ["tcs", "TCS"],
  ["jlr", "Jaguar Land Rover"],
  ["jaguar", "Jaguar Land Rover"],
  ["quantiphi", "Quantiphi"],
  ["hashedin", "HashedIn by Deloitte"],
  ["hashed", "HashedIn by Deloitte"],
  ["blazeclan", "Blazeclan"],
  ["ascent", "Ascent"],
];

const salaryComponentFields = [
  ["basicSalary", "Basic", ["basicsalary", "basic"]],
  ["hra", "HRA", ["hra", "houserentallowance"]],
  ["lta", "LTA", ["lta", "leavetravelallowance"]],
  ["specialAllowance", "Special allowance", ["specialallowance"]],
  ["personalAllowance", "Personal allowance", ["personalallowance", "personalallow"]],
  ["miscellaneous", "Miscellaneous", ["miscellaneous"]],
  ["cityAllowance", "City allowance", ["cityallowances", "cityallowance"]],
  ["performancePay", "Performance pay", ["performancepay", "performancebonus", "joiningandperformancebonus", "bonus"]],
  ["conveyanceAllowance", "Conveyance", ["conallowance", "conveyanceallowance", "vehiclefuelr"]],
  ["foodAllowance", "Food", ["foodallowance"]],
  ["medicalAllowance", "Medical", ["medicalallowance", "medicalbillsallowance"]],
  ["shiftAllowance", "Shift allowance", ["shiftallowance"]],
  ["phoneAllowance", "Phone/internet", ["phoneallowanceandinternet"]],
  ["professionalDevelopment", "Professional development", ["professionaldevelopment", "professionaldevelopmentallowance"]],
  ["pda", "PDA", ["pda"]],
];

const deductionFields = [
  ["taxTds", "Tax/TDS", ["incometaxtds", "incometax", "tds", "tax"]],
  ["professionalTax", "Professional tax", ["professionaltax", "professinaltax"]],
  ["pf", "PF", ["pf", "providentfund"]],
  ["healthInsurance", "Health insurance", ["healthinsurancededuction", "healthinsurance"]],
  ["grossDeductions", "Gross deductions", ["grossdeductions", "deduction", "deductions"]],
];

applyTheme(loadTheme());

function bootstrapApp(initialState) {
  state = normalizeData(initialState || defaultData);
  bindTheme();
  bindNavigation();
  bindModals();
  bindFinanceTabs();
  bindImports();
  bindReset();
  bindChat();
  bindExport();
  renderAll();
}

window.LifeLedgerApp = {
  defaultData: () => clone(defaultData),
  bootstrap: bootstrapApp,
};

let saveDataTimer;

function saveData() {
  if (!window.LifeLedgerAuth?.isUnlocked()) return;
  clearTimeout(saveDataTimer);
  saveDataTimer = setTimeout(() => {
    window.LifeLedgerAuth.saveAppData(state).catch((error) => {
      console.warn(error);
      toast(error.message || "Could not save encrypted vault.");
    });
  }, 700);
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "light";
  } catch (error) {
    return "light";
  }
}

function saveTheme(theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function applyTheme(theme) {
  const normalizedTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = normalizedTheme;
  const button = document.getElementById("themeToggle");
  if (button) {
    button.textContent = normalizedTheme === "dark" ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
  }
}

function normalizeData(data) {
  return {
    ...clone(defaultData),
    ...data,
    income: ensureIds(data.income || [], "inc"),
    expenses: ensureIds(data.expenses || [], "exp"),
    assets: ensureIds(data.assets || [], "asset"),
    liabilities: ensureIds(data.liabilities || [], "liab"),
    goals: ensureIds(data.goals || [], "goal"),
    tasks: ensureIds(data.tasks || [], "task"),
    studies: ensureIds(data.studies || [], "study"),
    workouts: ensureIds(data.workouts || [], "work"),
    chat: data.chat || [],
  };
}

function ensureIds(items, prefix) {
  return items.map((item) => ({ ...item, id: item.id || `${prefix}-${crypto.randomUUID()}` }));
}

function bindTheme() {
  const button = document.getElementById("themeToggle");
  if (!button) return;

  applyTheme(loadTheme());
  button.addEventListener("click", () => {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    saveTheme(nextTheme);
    renderCashflowChart();
  });
}

function bindNavigation() {
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.addEventListener("click", () => {
      activeView = button.dataset.view;
      document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      document.getElementById(activeView).classList.add("active");
      document.getElementById("todayTitle").textContent = viewTitle(activeView);
    });
  });
}

function bindModals() {
  document.querySelectorAll("[data-open-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.kind) {
        quickAddKind = button.dataset.kind;
        buildQuickAddForm(quickAddKind);
      }
      openModal(button.dataset.openModal);
    });
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.closest(".modal")));
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  document.getElementById("seedDemoButton").addEventListener("click", () => {
    state = normalizeData(demoData);
    saveData();
    renderAll();
    toast("Demo data loaded. Replace it anytime with your Excel or backup.");
  });
}

function bindFinanceTabs() {
  document.querySelectorAll("[data-finance-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeFinanceTab = button.dataset.financeTab;
      document.querySelectorAll("[data-finance-tab]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".finance-tab").forEach((tab) => tab.classList.remove("active"));
      document.getElementById(`finance-${activeFinanceTab}`).classList.add("active");
    });
  });
}

function bindImports() {
  document.getElementById("importFileButton").addEventListener("click", async () => {
    const file = document.getElementById("fileInput").files[0];
    const kind = document.getElementById("importKind").value;
    if (!file) {
      toast("Choose an Excel, CSV, or JSON file first.");
      return;
    }

    try {
      const imported = await parseImportFile(file, kind);
      mergeImportedData(imported);
      saveData();
      renderAll();
      document.getElementById("importStatus").textContent = importSummary(imported);
      toast("Imported successfully.");
    } catch (error) {
      document.getElementById("importStatus").textContent = error.message;
      toast(error.message);
    }
  });

  document.getElementById("importBackupButton").addEventListener("click", async () => {
    const file = document.getElementById("fileInput").files[0];
    if (!file) {
      toast("Choose a JSON backup file first.");
      return;
    }
    try {
      const text = await file.text();
      state = normalizeData(JSON.parse(text));
      saveData();
      renderAll();
      toast("Backup restored.");
      closeModal(document.getElementById("importModal"));
    } catch (error) {
      toast("That backup could not be imported.");
    }
  });
}

function bindReset() {
  document.querySelectorAll("[data-reset-scope]").forEach((button) => {
    button.addEventListener("click", () => resetData(button.dataset.resetScope));
  });
}

function bindChat() {
  const form = document.getElementById("chatForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const question = input.value.trim();
    if (!question) return;
    addChat("user", question);
    addChat("assistant", answerQuestion(question));
    input.value = "";
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.prompt;
      addChat("user", question);
      addChat("assistant", answerQuestion(question));
    });
  });

  ensureAssistantWelcome(true);
}

function bindExport() {
  document.getElementById("exportDataButton").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `life-ledger-backup-${todayISO()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast("Backup exported.");
  });
}

function openModal(id) {
  document.getElementById(id).hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

function resetData(scope) {
  const config = resetScopes[scope];
  if (!config) return;

  const confirmed = window.confirm(
    `Clear ${config.label}? This removes the saved rows from this browser. Export a backup first if you may need to restore them.`
  );
  if (!confirmed) return;

  if (scope === "all") {
    state = normalizeData(defaultData);
  } else {
    config.keys.forEach((key) => {
      state[key] = [];
    });
  }

  ensureAssistantWelcome(false);
  saveData();
  renderAll();
  document.querySelectorAll(".modal").forEach((modal) => closeModal(modal));
  toast(`${capitalize(config.label)} cleared.`);
}

function ensureAssistantWelcome(shouldSave) {
  if (state.chat.length > 0) return;
  state.chat.push({ role: "assistant", text: assistantWelcome, at: new Date().toISOString() });
  if (shouldSave) saveData();
}

function buildQuickAddForm(kind) {
  const form = document.getElementById("quickAddForm");
  const title = document.getElementById("quickAddTitle");
  const labels = {
    income: "Add income",
    expense: "Add expense",
    asset: "Add asset",
    liability: "Add liability",
    goal: "Add goal",
    task: "Add task",
    study: "Add study topic",
    workout: "Log workout",
  };

  title.textContent = labels[kind] || "Add entry";
  const fields = fieldsByKind[kind] || fieldsByKind.expense;
  form.innerHTML = "";

  fields.forEach(([name, label, type]) => {
    const wrapper = document.createElement("label");
    if (type === "textarea") wrapper.classList.add("full-span");
    wrapper.textContent = label;

    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    input.type = type === "checkbox" ? "checkbox" : type;
    if (type === "date" && ["date", "dueDate"].includes(name)) input.value = todayISO();
    if (type === "number") input.inputMode = "decimal";
    wrapper.append(input);
    form.append(wrapper);
  });

  const actions = document.createElement("div");
  actions.className = "modal-actions full-span";
  actions.innerHTML = `
    <button class="secondary-button" type="button" data-close-current>Cancel</button>
    <button class="primary-button" type="submit">Save</button>
  `;
  form.append(actions);

  actions.querySelector("[data-close-current]").addEventListener("click", () => closeModal(form.closest(".modal")));
  form.onsubmit = (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const entry = { id: `${kind}-${crypto.randomUUID()}` };
    fields.forEach(([name, , type]) => {
      if (type === "checkbox") {
        entry[name] = form.querySelector(`[name="${name}"]`).checked;
      } else {
        entry[name] = type === "number" ? toNumber(formData.get(name)) : String(formData.get(name) || "").trim();
      }
    });

    if (kind === "expense") state.expenses.push(entry);
    if (kind === "income") state.income.push(entry);
    if (kind === "asset") state.assets.push(entry);
    if (kind === "liability") state.liabilities.push(entry);
    if (kind === "goal") state.goals.push(entry);
    if (kind === "task") state.tasks.push(entry);
    if (kind === "study") state.studies.push(entry);
    if (kind === "workout") state.workouts.push(entry);

    saveData();
    renderAll();
    closeModal(form.closest(".modal"));
    toast("Entry saved.");
  };
}

async function parseImportFile(file, selectedKind) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "json") {
    const parsed = JSON.parse(await file.text());
    return isFullBackup(parsed) ? parsed : rowsToData(Array.isArray(parsed) ? parsed : [parsed], selectedKind);
  }

  if (extension === "csv") {
    const rows = parseCSV(await file.text());
    return rowsToData(rows, selectedKind);
  }

  if (["xlsx", "xls"].includes(extension)) {
    if (!window.XLSX) {
      throw new Error("Excel support needs internet once to load the SheetJS parser. Export CSV from Excel if you are offline.");
    }
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
    const allRows = workbook.SheetNames.flatMap((sheetName) =>
      window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false }).map((row) => ({
        ...row,
        __sheet: sheetName,
      }))
    );
    return rowsToData(allRows, selectedKind);
  }

  throw new Error("Unsupported file type.");
}

function rowsToData(rows, selectedKind) {
  const output = clone(defaultData);
  rows.forEach((row) => {
    const normalized = normalizeRow(row);
    const kind = selectedKind === "auto" ? detectKind(normalized) : selectedKind;
    const item = mapRowToKind(normalized, kind);
    if (!item) return;

    if (kind === "income") output.income.push(item);
    if (kind === "expense") output.expenses.push(item);
    if (kind === "asset") output.assets.push(item);
    if (kind === "liability") output.liabilities.push(item);
    if (kind === "goal") output.goals.push(item);
    if (kind === "task") output.tasks.push(item);
    if (kind === "study") output.studies.push(item);
    if (kind === "workout") output.workouts.push(item);
  });
  return output;
}

function normalizeRow(row) {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    const cleanKey = key
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .trim();
    normalized[cleanKey] = typeof value === "string" ? value.trim() : value;
  });
  return normalized;
}

function detectKind(row) {
  const keys = Object.keys(row).join(" ");
  const sheet = String(row.sheet || row.__sheet || "").toLowerCase();
  if (/salary|income|ctc|company|source/.test(keys + sheet)) return "income";
  if (/expense|spend|merchant|paidby|category/.test(keys + sheet)) return "expense";
  if (/asset|investment|mutual|bank|gold/.test(keys + sheet)) return "asset";
  if (/liability|loan|debt|outstanding/.test(keys + sheet)) return "liability";
  if (/goal|target|saved|duedate/.test(keys + sheet)) return "goal";
  if (/topic|confidence|hours|study|interview/.test(keys + sheet)) return "study";
  if (/workout|exercise|minutes|intensity/.test(keys + sheet)) return "workout";
  if (/task|todo|done/.test(keys + sheet)) return "task";
  return "expense";
}

function mapRowToKind(row, kind) {
  if (kind === "income") {
    const dateValue = pick(row, ["date", "month", "salarydate", "crediteddate"]);
    if (/^total$/i.test(String(dateValue || "").trim())) return null;

    const sheetName = String(row.sheet || "");
    const grossEarnings = pickNumber(row, ["grossearnings", "grosssalary", "totalearnings", "gross", "ctc"]);
    const explicitNetSalary = pickNumber(row, ["netsalary", "netpay", "netinhand", "inhand", "takehome", "salary", "income", "monthlysalary"]);
    const genericAmount = pickNumber(row, ["amount"]);
    const hasSalarySignals =
      /salary|ctc|payroll/i.test(sheetName) ||
      Boolean(grossEarnings || explicitNetSalary || pick(row, ["basicsalary", "basic", "hra", "pf", "incometaxtds", "incometax"]));
    if (!hasSalarySignals && pick(row, ["category", "expensecategory", "note", "merchant"])) return null;

    const amount = explicitNetSalary || genericAmount || grossEarnings;
    if (!amount) return null;

    const organization = inferOrganization(sheetName, row);
    const person = inferPerson(sheetName, row);
    const components = collectSalaryParts(row, salaryComponentFields);
    const deductions = collectSalaryParts(row, deductionFields);

    return {
      id: `inc-${crypto.randomUUID()}`,
      date: pickDate(row, ["date", "month", "salarydate", "crediteddate"]),
      person,
      source: organization,
      organization,
      amount,
      netSalary: amount,
      grossEarnings,
      type: pick(row, ["type", "incometype"]) || "Salary",
      sheetName,
      ...components,
      ...deductions,
      components,
      deductions,
    };
  }

  if (kind === "expense") {
    const amount = pickNumber(row, ["amount", "expense", "spend", "cost", "debit"]);
    if (!amount) return null;
    return {
      id: `exp-${crypto.randomUUID()}`,
      date: pickDate(row, ["date", "month", "spentdate"]),
      category: pick(row, ["category", "expensecategory", "type"]) || "General",
      paidBy: pick(row, ["paidby", "person", "payer", "owner"]) || "Both",
      amount,
      note: pick(row, ["note", "description", "merchant", "remarks"]) || "",
    };
  }

  if (kind === "asset") {
    const value = pickNumber(row, ["value", "amount", "currentvalue", "balance"]);
    if (!value) return null;
    return {
      id: `asset-${crypto.randomUUID()}`,
      name: pick(row, ["name", "asset", "account", "investment"]) || "Asset",
      category: pick(row, ["category", "type"]) || "Asset",
      owner: pick(row, ["owner", "person"]) || "Both",
      value,
    };
  }

  if (kind === "liability") {
    const value = pickNumber(row, ["value", "amount", "outstanding", "balance", "debt"]);
    if (!value) return null;
    return {
      id: `liab-${crypto.randomUUID()}`,
      name: pick(row, ["name", "liability", "loan", "account"]) || "Liability",
      category: pick(row, ["category", "type"]) || "Liability",
      owner: pick(row, ["owner", "person"]) || "Both",
      value,
    };
  }

  if (kind === "goal") {
    const target = pickNumber(row, ["target", "targetamount", "goalamount"]) || 100;
    return {
      id: `goal-${crypto.randomUUID()}`,
      name: pick(row, ["name", "goal", "title"]) || "Goal",
      category: pick(row, ["category", "area"]) || "Personal",
      target,
      saved: pickNumber(row, ["saved", "current", "progress", "done"]) || 0,
      dueDate: pickDate(row, ["duedate", "date", "deadline"]),
    };
  }

  if (kind === "study") {
    return {
      id: `study-${crypto.randomUUID()}`,
      topic: pick(row, ["topic", "subject", "name"]) || "Study topic",
      status: pick(row, ["status", "stage"]) || "Planned",
      confidence: clamp(pickNumber(row, ["confidence", "confidencepercent", "progress"]) || 0, 0, 100),
      hours: pickNumber(row, ["hours", "hoursdone", "time"]) || 0,
      targetHours: pickNumber(row, ["targethours", "target", "plannedhours"]) || 20,
    };
  }

  if (kind === "task") {
    return {
      id: `task-${crypto.randomUUID()}`,
      text: pick(row, ["task", "todo", "text", "name"]) || "Task",
      area: pick(row, ["area", "category"]) || "Personal",
      date: pickDate(row, ["date", "day"]),
      done: /true|yes|done|complete/i.test(String(pick(row, ["done", "status"]) || "")),
    };
  }

  if (kind === "workout") {
    return {
      id: `work-${crypto.randomUUID()}`,
      date: pickDate(row, ["date", "day"]),
      type: pick(row, ["type", "workout", "exercise"]) || "Workout",
      minutes: pickNumber(row, ["minutes", "duration", "time"]) || 0,
      intensity: pick(row, ["intensity", "level"]) || "Medium",
    };
  }

  return null;
}

function mergeImportedData(imported) {
  const normalized = normalizeData(imported);
  state.income.push(...normalized.income);
  state.expenses.push(...normalized.expenses);
  state.assets.push(...normalized.assets);
  state.liabilities.push(...normalized.liabilities);
  state.goals.push(...normalized.goals);
  state.tasks.push(...normalized.tasks);
  state.studies.push(...normalized.studies);
  state.workouts.push(...normalized.workouts);
}

function inferOrganization(sheetName, row) {
  const explicit = pick(row, ["source", "company", "employer", "organization", "org"]);
  const text = `${explicit || ""} ${sheetName}`.toLowerCase();
  const match = organizationAliases.find(([needle]) => text.includes(needle));
  return match?.[1] || explicit || "Salary";
}

function inferPerson(sheetName, row) {
  const explicit = pick(row, ["person", "name", "owner", "employee"]);
  if (explicit) return explicit;
  return /wife|archana|ascent/i.test(sheetName) ? "Wife" : "Me";
}

function collectSalaryParts(row, fieldConfig) {
  return fieldConfig.reduce((parts, [key, , aliases]) => {
    parts[key] = pickNumber(row, aliases);
    return parts;
  }, {});
}

function isSalary(item) {
  return /salary/i.test(item.type || "salary") || item.grossEarnings || item.netSalary || item.basicSalary;
}

function isFullBackup(data) {
  return data && ["income", "expenses", "assets", "liabilities", "goals", "tasks", "studies", "workouts"].some((key) => Array.isArray(data[key]));
}

function importSummary(imported) {
  const parts = [
    ["income", imported.income?.length || 0],
    ["expenses", imported.expenses?.length || 0],
    ["assets", imported.assets?.length || 0],
    ["liabilities", imported.liabilities?.length || 0],
    ["goals", imported.goals?.length || 0],
    ["topics", imported.studies?.length || 0],
    ["tasks", imported.tasks?.length || 0],
    ["workouts", imported.workouts?.length || 0],
  ].filter(([, count]) => count > 0);
  return parts.length ? `Imported ${parts.map(([name, count]) => `${count} ${name}`).join(", ")}.` : "No rows matched the expected columns.";
}

function renderAll() {
  renderDate();
  renderMetrics();
  renderCashflowChart();
  renderExpenseMix();
  renderNetWorth();
  renderTodayFocus();
  renderFinance();
  renderCareer();
  renderGoals();
  renderChat();
}

function renderDate() {
  document.getElementById("currentMonthLabel").textContent = new Date().toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function renderMetrics() {
  const metrics = calculateMetrics();
  const metricGrid = document.getElementById("metricGrid");
  metricGrid.innerHTML = "";
  [
    {
      label: "Net worth",
      value: formatINR(metrics.netWorth),
      hint: `${formatINR(metrics.assets)} assets minus ${formatINR(metrics.liabilities)} liabilities`,
    },
    {
      label: "This month income",
      value: formatINR(metrics.monthIncome),
      hint: `${metrics.incomePeople} income owner${metrics.incomePeople === 1 ? "" : "s"} tracked`,
    },
    {
      label: "This month expenses",
      value: formatINR(metrics.monthExpenses),
      hint: `${metrics.topExpenseCategory || "No"} is the biggest category`,
    },
    {
      label: "Savings rate",
      value: `${metrics.savingsRate}%`,
      hint: `${formatINR(metrics.monthIncome - metrics.monthExpenses)} left this month`,
    },
  ].forEach((metric) => {
    const card = document.createElement("article");
    card.className = "metric-card";
    card.innerHTML = `
      <div class="label">${escapeHTML(metric.label)}</div>
      <div class="value">${escapeHTML(metric.value)}</div>
      <div class="hint">${escapeHTML(metric.hint)}</div>
    `;
    metricGrid.append(card);
  });

  const signal = document.getElementById("savingsSignal");
  signal.className = "status-dot";
  if (metrics.savingsRate >= 30) {
    signal.classList.add("good");
    signal.textContent = "Healthy";
  } else if (metrics.savingsRate >= 10) {
    signal.classList.add("warn");
    signal.textContent = "Watch";
  } else {
    signal.classList.add("danger");
    signal.textContent = "Tight";
  }
}

function renderCashflowChart() {
  const svg = document.getElementById("cashflowChart");
  const months = monthlyCashflow();
  const panelColor = cssVar("--panel");
  const lineColor = cssVar("--line");
  const mutedColor = cssVar("--muted");
  const inkColor = cssVar("--ink");
  const brandColor = cssVar("--brand");
  const accentColor = cssVar("--accent");
  const width = 760;
  const height = 280;
  const padding = { top: 18, right: 18, bottom: 36, left: 64 };
  const maxValue = Math.max(1, ...months.flatMap((month) => [month.income, month.expenses]));
  const xStep = (width - padding.left - padding.right) / Math.max(1, months.length - 1);
  const y = (value) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const x = (index) => padding.left + index * xStep;
  const incomePoints = months.map((month, index) => `${x(index)},${y(month.income)}`).join(" ");
  const expensePoints = months.map((month, index) => `${x(index)},${y(month.expenses)}`).join(" ");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect width="${width}" height="${height}" rx="8" fill="${panelColor}"></rect>
    ${[0, 0.25, 0.5, 0.75, 1]
      .map((tick) => {
        const yy = padding.top + tick * (height - padding.top - padding.bottom);
        const value = maxValue * (1 - tick);
        return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="${lineColor}" />
          <text x="10" y="${yy + 4}" fill="${mutedColor}" font-size="12">${compactINR(value)}</text>`;
      })
      .join("")}
    <polyline points="${expensePoints}" fill="none" stroke="${accentColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <polyline points="${incomePoints}" fill="none" stroke="${brandColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${months
      .map(
        (month, index) => `
          <circle cx="${x(index)}" cy="${y(month.income)}" r="4" fill="${brandColor}"></circle>
          <circle cx="${x(index)}" cy="${y(month.expenses)}" r="4" fill="${accentColor}"></circle>
          <text x="${x(index)}" y="${height - 12}" text-anchor="middle" fill="${mutedColor}" font-size="12">${month.label}</text>
        `
      )
      .join("")}
    <g transform="translate(${width - 208}, 18)">
      <circle cx="0" cy="0" r="5" fill="${brandColor}"></circle>
      <text x="10" y="4" fill="${inkColor}" font-size="13" font-weight="700">Income</text>
      <circle cx="90" cy="0" r="5" fill="${accentColor}"></circle>
      <text x="100" y="4" fill="${inkColor}" font-size="13" font-weight="700">Expenses</text>
    </g>
  `;
}

function renderSalaryProgressionChart(svg, rows) {
  const panelColor = cssVar("--panel");
  const lineColor = cssVar("--line");
  const mutedColor = cssVar("--muted");
  const inkColor = cssVar("--ink");
  const brandColor = cssVar("--brand");
  const accentColor = cssVar("--accent");
  const width = 900;
  const height = 320;
  const padding = { top: 22, right: 26, bottom: 44, left: 72 };
  const values = rows.flatMap((row) => [row.grossEarnings || 0, row.netSalary || row.amount || 0]);
  const maxValue = Math.max(1, ...values);
  const xStep = (width - padding.left - padding.right) / Math.max(1, rows.length - 1);
  const y = (value) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const x = (index) => padding.left + index * xStep;
  const grossPoints = rows.map((row, index) => `${x(index)},${y(row.grossEarnings || row.netSalary || row.amount || 0)}`).join(" ");
  const netPoints = rows.map((row, index) => `${x(index)},${y(row.netSalary || row.amount || 0)}`).join(" ");
  const yearLabels = rows
    .map((row, index) => ({ date: new Date(row.date), index }))
    .filter((item, index, list) => index === 0 || item.date.getFullYear() !== list[index - 1].date.getFullYear());

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect width="${width}" height="${height}" rx="8" fill="${panelColor}"></rect>
    ${[0, 0.25, 0.5, 0.75, 1]
      .map((tick) => {
        const yy = padding.top + tick * (height - padding.top - padding.bottom);
        const value = maxValue * (1 - tick);
        return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="${lineColor}" />
          <text x="10" y="${yy + 4}" fill="${mutedColor}" font-size="12">${compactINR(value)}</text>`;
      })
      .join("")}
    <polyline points="${grossPoints}" fill="none" stroke="${accentColor}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <polyline points="${netPoints}" fill="none" stroke="${brandColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${rows
      .filter((_, index) => index === 0 || index === rows.length - 1 || index % 6 === 0)
      .map((row) => {
        const index = rows.indexOf(row);
        return `<circle cx="${x(index)}" cy="${y(row.netSalary || row.amount || 0)}" r="3.5" fill="${brandColor}"></circle>`;
      })
      .join("")}
    ${yearLabels
      .map(
        ({ date, index }) => `
          <line x1="${x(index)}" y1="${padding.top}" x2="${x(index)}" y2="${height - padding.bottom}" stroke="${lineColor}" stroke-dasharray="4 6"></line>
          <text x="${x(index) + 4}" y="${height - 14}" fill="${mutedColor}" font-size="12">${date.getFullYear()}</text>
        `
      )
      .join("")}
    <g transform="translate(${width - 238}, 20)">
      <circle cx="0" cy="0" r="5" fill="${brandColor}"></circle>
      <text x="10" y="4" fill="${inkColor}" font-size="13" font-weight="700">Net in-hand</text>
      <circle cx="116" cy="0" r="5" fill="${accentColor}"></circle>
      <text x="126" y="4" fill="${inkColor}" font-size="13" font-weight="700">Gross</text>
    </g>
  `;
}

function renderExpenseMix() {
  const currentExpenses = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const byCategory = groupSum(currentExpenses, (expense) => expense.category || "General", "amount");
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const donut = document.getElementById("expenseDonut");
  const legend = document.getElementById("expenseLegend");

  if (total === 0) {
    donut.style.background = `conic-gradient(${cssVar("--line")} 0deg 360deg)`;
    legend.innerHTML = `<div class="empty-state">Upload expenses or add rows to see your category mix.</div>`;
    return;
  }

  let start = 0;
  const segments = entries.map(([category, value], index) => {
    const degrees = (value / total) * 360;
    const color = COLORS[index % COLORS.length];
    const segment = `${color} ${start}deg ${start + degrees}deg`;
    start += degrees;
    return segment;
  });
  donut.style.background = `conic-gradient(${segments.join(", ")})`;
  legend.innerHTML = "";
  entries.slice(0, 6).forEach(([category, value], index) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-name"><span style="background:${COLORS[index % COLORS.length]}"></span>${escapeHTML(category)}</span>
      <span class="amount">${formatINR(value)}</span>
    `;
    legend.append(row);
  });
}

function renderNetWorth() {
  const container = document.getElementById("networthStack");
  const assets = sum(state.assets, "value");
  const liabilities = sum(state.liabilities, "value");
  const netWorth = assets - liabilities;
  const maxValue = Math.max(assets, liabilities, Math.abs(netWorth), 1);
  container.innerHTML = "";
  [
    ["Assets", assets, "bar-fill"],
    ["Liabilities", liabilities, "bar-fill accent"],
    ["Net worth", netWorth, "bar-fill blue"],
  ].forEach(([label, value, klass]) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-row-top"><span>${escapeHTML(label)}</span><span>${formatINR(value)}</span></div>
      <div class="bar-track"><div class="${klass}" style="width:${Math.max(4, (Math.abs(value) / maxValue) * 100)}%"></div></div>
    `;
    container.append(row);
  });
}

function renderTodayFocus() {
  const container = document.getElementById("todayFocus");
  container.innerHTML = "";
  const pendingTasks = state.tasks.filter((task) => sameDay(task.date, todayISO()) && !task.done).slice(0, 3);
  const lowConfidence = [...state.studies].sort((a, b) => (a.confidence || 0) - (b.confidence || 0))[0];
  const workoutToday = state.workouts.some((workout) => sameDay(workout.date, todayISO()));
  const items = [
    ...pendingTasks.map((task) => ({ title: task.text, meta: task.area || "Task" })),
    lowConfidence
      ? { title: `Study ${lowConfidence.topic}`, meta: `${lowConfidence.confidence || 0}% confidence` }
      : null,
    { title: workoutToday ? "Workout logged today" : "Log one workout or walk", meta: "Health" },
  ].filter(Boolean);

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Add tasks, study topics, and workouts to build today's focus list.</div>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "focus-row";
    row.innerHTML = `
      <div>
        <div class="stack-title">${escapeHTML(item.title)}</div>
        <div class="stack-meta">${escapeHTML(item.meta)}</div>
      </div>
    `;
    container.append(row);
  });
}

function renderFinance() {
  renderSalaryCards();
  renderSalaryProgression();
  renderBudgetPulse();
  renderIncomeTable();
  renderExpenseTable();
  renderAssetLiabilityLists();
}

function renderSalaryCards() {
  const container = document.getElementById("salaryCards");
  const people = groupBy(state.income.filter(isSalary), (item) => item.person || "Me");
  container.innerHTML = "";

  if (Object.keys(people).length === 0) {
    container.innerHTML = `<div class="empty-state">Upload salary data or add income entries to compare growth.</div>`;
    return;
  }

  Object.entries(people).forEach(([person, entries]) => {
    const sorted = entries.sort((a, b) => new Date(a.date) - new Date(b.date));
    const first = sorted[0]?.netSalary || sorted[0]?.amount || 0;
    const latestRow = sorted.at(-1);
    const latest = latestRow?.netSalary || latestRow?.amount || 0;
    const growth = first ? ((latest - first) / first) * 100 : 0;
    const row = document.createElement("div");
    row.className = "stack-row";
    row.innerHTML = `
      <div>
        <div class="stack-title">${escapeHTML(person)}</div>
        <div class="stack-meta">${escapeHTML(latestRow?.source || "Salary")} • ${formatDate(latestRow?.date)} • ${formatPercent(growth)} tracked net growth</div>
      </div>
      <div class="stack-value">${formatINR(latest)}</div>
    `;
    container.append(row);
  });
}

function renderSalaryProgression() {
  const svg = document.getElementById("salaryProgressionChart");
  const insights = document.getElementById("salaryInsights");
  const badge = document.getElementById("latestSalaryBadge");
  if (!svg || !insights || !badge) return;

  const allRows = state.income.filter(isSalary).sort((a, b) => new Date(a.date) - new Date(b.date));
  const myRows = allRows.filter((row) => !/wife/i.test(row.person || ""));
  const rows = myRows.length ? myRows : allRows;

  if (rows.length === 0) {
    svg.innerHTML = "";
    insights.innerHTML = `<div class="empty-state">Upload your salary workbook to see the 2018-to-now progression chart.</div>`;
    badge.textContent = "No salary yet";
    return;
  }

  const latest = rows.at(-1);
  const first = rows[0];
  const highestNet = rows.reduce((best, row) => ((row.netSalary || row.amount || 0) > (best.netSalary || best.amount || 0) ? row : best), rows[0]);
  const orgs = [...new Set(rows.map((row) => row.source || row.organization || "Salary"))];
  const firstNet = first.netSalary || first.amount || 0;
  const latestNet = latest.netSalary || latest.amount || 0;
  const growth = firstNet ? ((latestNet - firstNet) / firstNet) * 100 : 0;

  badge.textContent = `${formatDate(latest.date)} • ${formatINR(latestNet)}`;
  renderSalaryProgressionChart(svg, rows);

  const chips = [
    { label: "Latest net in-hand", value: `${formatINR(latestNet)} (${latest.source || "Salary"})` },
    { label: "Latest gross", value: formatINR(latest.grossEarnings || latestNet) },
    { label: "Highest net month", value: `${formatINR(highestNet.netSalary || highestNet.amount)} (${formatDate(highestNet.date)})` },
    { label: "2018-to-now growth", value: formatPercent(growth) },
    { label: "Organizations", value: orgs.join(" → ") },
    { label: "Latest tax + PF", value: `${formatINR((latest.taxTds || 0) + (latest.pf || 0))}` },
    { label: "Latest basic + HRA", value: `${formatINR((latest.basicSalary || 0) + (latest.hra || 0))}` },
    { label: "Rows imported", value: `${rows.length} salary months` },
  ];

  insights.innerHTML = "";
  chips.forEach((chip) => {
    const element = document.createElement("div");
    element.className = "insight-chip";
    element.innerHTML = `
      <div class="label">${escapeHTML(chip.label)}</div>
      <div class="value">${escapeHTML(chip.value)}</div>
    `;
    insights.append(element);
  });
}

function renderBudgetPulse() {
  const container = document.getElementById("budgetPulse");
  const currentExpenses = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const categories = Object.entries(groupSum(currentExpenses, (expense) => expense.category || "General", "amount")).sort(
    (a, b) => b[1] - a[1]
  );
  container.innerHTML = "";

  if (categories.length === 0) {
    container.innerHTML = `<div class="empty-state">Your monthly category pulse will appear after expense import.</div>`;
    return;
  }

  categories.slice(0, 5).forEach(([category, value]) => {
    const row = document.createElement("div");
    row.className = "stack-row";
    row.innerHTML = `
      <div>
        <div class="stack-title">${escapeHTML(category)}</div>
        <div class="stack-meta">${Math.round((value / Math.max(1, sum(currentExpenses, "amount"))) * 100)}% of this month's spend</div>
      </div>
      <div class="stack-value">${formatINR(value)}</div>
    `;
    container.append(row);
  });
}

function renderIncomeTable() {
  const table = document.getElementById("incomeTable");
  renderRows(
    table,
    [...state.income].filter(isSalary).sort(sortByDateDesc).slice(0, 160),
    (item) => [
      formatMonth(item.date),
      item.person,
      item.source || item.organization,
      formatINR(item.grossEarnings || item.amount),
      formatINR(item.netSalary || item.amount),
      formatINR(item.taxTds || 0),
      formatINR(item.basicSalary || 0),
      formatINR(item.hra || 0),
      formatINR(item.pf || 0),
      componentSummary(item),
    ],
    "No salary data yet. Upload your salary workbook or add an income entry.",
    10
  );
}

function renderExpenseTable() {
  const table = document.getElementById("expenseTable");
  renderRows(
    table,
    [...state.expenses].sort(sortByDateDesc).slice(0, 120),
    (item) => [formatDate(item.date), item.category, item.paidBy, formatINR(item.amount), item.note],
    "No data yet. Upload a sheet or add an entry.",
    5
  );
}

function renderAssetLiabilityLists() {
  renderStackList(document.getElementById("assetList"), state.assets, (item) => ({
    title: item.name,
    meta: `${item.category || "Asset"} • ${item.owner || "Both"}`,
    value: formatINR(item.value),
  }));
  renderStackList(document.getElementById("liabilityList"), state.liabilities, (item) => ({
    title: item.name,
    meta: `${item.category || "Liability"} • ${item.owner || "Both"}`,
    value: formatINR(item.value),
  }));
}

function renderCareer() {
  const board = document.getElementById("studyBoard");
  board.innerHTML = "";

  if (state.studies.length === 0) {
    board.innerHTML = `<div class="empty-state">Add DSA, system design, projects, behavioral stories, and other study topics.</div>`;
  } else {
    state.studies
      .slice()
      .sort((a, b) => (a.confidence || 0) - (b.confidence || 0))
      .forEach((topic) => {
        const confidence = clamp(toNumber(topic.confidence), 0, 100);
        const hoursRatio = clamp(((topic.hours || 0) / Math.max(1, topic.targetHours || 20)) * 100, 0, 100);
        const card = document.createElement("article");
        card.className = "topic-card";
        card.innerHTML = `
          <div class="topic-card-top">
            <div>
              <h4>${escapeHTML(topic.topic)}</h4>
              <div class="stack-meta">${escapeHTML(topic.status || "Planned")} • ${topic.hours || 0}/${topic.targetHours || 20}h</div>
            </div>
            <strong>${confidence}%</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${confidence}%"></div></div>
          <div class="bar-track"><div class="bar-fill accent" style="width:${hoursRatio}%"></div></div>
        `;
        board.append(card);
      });
  }

  const readiness = calculateReadiness();
  renderStackList(document.getElementById("readinessList"), readiness, (item) => ({
    title: item.title,
    meta: item.meta,
    value: item.value,
  }));
}

function renderGoals() {
  renderStackList(document.getElementById("goalList"), state.goals, (goal) => {
    const progress = clamp(((goal.saved || 0) / Math.max(1, goal.target || 1)) * 100, 0, 100);
    return {
      title: goal.name,
      meta: `${goal.category || "Goal"} • ${Math.round(progress)}% • due ${formatDate(goal.dueDate)}`,
      value: `${formatINR(goal.saved || 0)} / ${formatINR(goal.target || 0)}`,
      progress,
    };
  });

  const taskContainer = document.getElementById("taskList");
  taskContainer.innerHTML = "";
  const tasks = [...state.tasks].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 12);
  if (tasks.length === 0) {
    taskContainer.innerHTML = `<div class="empty-state">Add a few daily tasks and this becomes your execution board.</div>`;
  } else {
    tasks.forEach((task) => {
      const row = document.createElement("label");
      row.className = `task-row ${task.done ? "done" : ""}`;
      row.innerHTML = `
        <input type="checkbox" ${task.done ? "checked" : ""} aria-label="Toggle task" />
        <span>
          <strong>${escapeHTML(task.text)}</strong>
          <span class="row-subtext">${escapeHTML(task.area || "Personal")} • ${formatDate(task.date)}</span>
        </span>
      `;
      row.querySelector("input").addEventListener("change", (event) => {
        task.done = event.target.checked;
        saveData();
        renderAll();
      });
      taskContainer.append(row);
    });
  }

  renderStackList(document.getElementById("workoutList"), [...state.workouts].sort(sortByDateDesc).slice(0, 8), (workout) => ({
    title: workout.type,
    meta: `${formatDate(workout.date)} • ${workout.intensity || "Medium"}`,
    value: `${workout.minutes || 0} min`,
  }));
}

function renderChat() {
  const log = document.getElementById("chatLog");
  log.innerHTML = "";
  state.chat.slice(-80).forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.role}`;
    bubble.textContent = message.text;
    log.append(bubble);
  });
  log.scrollTop = log.scrollHeight;
}

function addChat(role, text) {
  state.chat.push({ role, text, at: new Date().toISOString() });
  saveData();
  renderChat();
}

function answerQuestion(question) {
  const q = question.toLowerCase();
  const metrics = calculateMetrics();
  const topCategories = Object.entries(
    groupSum(
      state.expenses.filter((expense) => isCurrentMonth(expense.date)),
      (expense) => expense.category || "General",
      "amount"
    )
  ).sort((a, b) => b[1] - a[1]);
  const weakestTopic = [...state.studies].sort((a, b) => (a.confidence || 0) - (b.confidence || 0))[0];
  const nextGoal = [...state.goals].sort((a, b) => new Date(a.dueDate || "2999-01-01") - new Date(b.dueDate || "2999-01-01"))[0];

  if (/saving|save|summary|finance|month/.test(q)) {
    return `This month income is ${formatINR(metrics.monthIncome)} and expenses are ${formatINR(metrics.monthExpenses)}, so your current surplus is ${formatINR(metrics.monthIncome - metrics.monthExpenses)} with a ${metrics.savingsRate}% savings rate. ${
      topCategories[0]
        ? `Biggest spend is ${topCategories[0][0]} at ${formatINR(topCategories[0][1])}.`
        : "Add expense data and I can highlight the biggest leak."
    }`;
  }

  if (/expense|spend|high|risk|leak/.test(q)) {
    if (!topCategories.length) return "I need expense rows first. Upload your expense sheet or add a few entries, then I can rank the biggest categories and spot leaks.";
    return `Your highest current-month categories are ${topCategories
      .slice(0, 3)
      .map(([name, value]) => `${name}: ${formatINR(value)}`)
      .join(", ")}. Start by setting review rules for the top category, because that is where one decision can change the month fastest.`;
  }

  if (/net worth|asset|liabil|wealth/.test(q)) {
    return `Your tracked net worth is ${formatINR(metrics.netWorth)}. Assets total ${formatINR(metrics.assets)} and liabilities total ${formatINR(metrics.liabilities)}. A strong next move is to update assets monthly and keep liabilities grouped by interest rate so repayment priority is obvious.`;
  }

  if (/salary|growth|wife|income/.test(q)) {
    const people = Object.entries(groupBy(state.income.filter(isSalary), (item) => item.person || "Me")).map(([person, rows]) => {
      const sorted = rows.sort((a, b) => new Date(a.date) - new Date(b.date));
      const first = sorted[0]?.netSalary || sorted[0]?.amount || 0;
      const latestRow = sorted.at(-1);
      const latest = latestRow?.netSalary || latestRow?.amount || 0;
      return `${person}: ${formatINR(latest)} latest net in-hand for ${formatMonth(latestRow?.date)} at ${latestRow?.source || "Salary"}, ${formatPercent(first ? ((latest - first) / first) * 100 : 0)} tracked growth`;
    });
    return people.length
      ? `Salary view: ${people.join("; ")}. The salary ledger now reads gross, net in-hand, tax/TDS, basic, HRA, PF, and allowance components from payslip-style sheets.`
      : "Upload salary history with Month, Gross Earnings, Net Salary, Basic, HRA, PF, and tax columns so I can calculate growth and component movement.";
  }

  if (/study|interview|switch|career|prep/.test(q)) {
    if (!weakestTopic) return "Add study topics like DSA, system design, resume projects, behavioral stories, and target companies. Then I will turn it into a weekly switch plan.";
    return `This week, focus on ${weakestTopic.topic}. It has ${weakestTopic.confidence || 0}% confidence and ${weakestTopic.hours || 0}/${weakestTopic.targetHours || 20} hours done. A practical plan: 4 focused sessions, one mock interview, and one revision note after every session.`;
  }

  if (/goal|future|target/.test(q)) {
    if (!nextGoal) return "Add future goals with target, saved/progress, and due date. I will calculate gaps and monthly run-rate.";
    const gap = Math.max(0, (nextGoal.target || 0) - (nextGoal.saved || 0));
    return `Nearest goal is ${nextGoal.name}, due ${formatDate(nextGoal.dueDate)}. Gap is ${formatINR(gap)}. If this is money-based, divide that gap by the months left to set the monthly contribution target.`;
  }

  if (/today|task|todo|routine|exercise|workout|health/.test(q)) {
    const pending = state.tasks.filter((task) => !task.done).slice(0, 3);
    const workoutToday = state.workouts.some((workout) => sameDay(workout.date, todayISO()));
    return `Today: ${pending.length ? pending.map((task) => task.text).join(", ") : "no pending tasks tracked"}. ${
      workoutToday ? "Workout is already logged." : "Add a 20-30 minute walk or workout to keep the health chain alive."
    }`;
  }

  return "I can help best when you ask around finance, salary growth, expenses, net worth, goals, interview prep, tasks, or exercise. Upload your sheets and my answers will become much sharper.";
}

function calculateMetrics() {
  const monthIncomeRows = state.income.filter((income) => isCurrentMonth(income.date));
  const monthExpenseRows = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const monthIncome = sum(monthIncomeRows, "amount");
  const monthExpenses = sum(monthExpenseRows, "amount");
  const assets = sum(state.assets, "value");
  const liabilities = sum(state.liabilities, "value");
  const topExpenseCategory =
    Object.entries(groupSum(monthExpenseRows, (expense) => expense.category || "General", "amount")).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    monthIncome,
    monthExpenses,
    assets,
    liabilities,
    netWorth: assets - liabilities,
    incomePeople: new Set(monthIncomeRows.map((income) => income.person || "Me")).size,
    savingsRate: monthIncome ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0,
    topExpenseCategory,
  };
}

function monthlyCashflow() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    months.push({
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      income: sum(state.income.filter((item) => monthKey(new Date(item.date)) === key), "amount"),
      expenses: sum(state.expenses.filter((item) => monthKey(new Date(item.date)) === key), "amount"),
    });
  }
  return months;
}

function calculateReadiness() {
  const studyAverage = state.studies.length
    ? Math.round(state.studies.reduce((total, topic) => total + (topic.confidence || 0), 0) / state.studies.length)
    : 0;
  const projectTopic = state.studies.find((topic) => /resume|project/i.test(topic.topic || ""));
  const dsaTopic = state.studies.find((topic) => /dsa|data|algo/i.test(topic.topic || ""));
  const systemTopic = state.studies.find((topic) => /system|design/i.test(topic.topic || ""));
  return [
    { title: "Overall readiness", meta: "Average confidence across topics", value: `${studyAverage}%` },
    {
      title: "DSA signal",
      meta: dsaTopic ? `${dsaTopic.hours || 0}/${dsaTopic.targetHours || 20}h completed` : "Add DSA topic",
      value: `${dsaTopic?.confidence || 0}%`,
    },
    {
      title: "System design signal",
      meta: systemTopic ? `${systemTopic.hours || 0}/${systemTopic.targetHours || 20}h completed` : "Add system design topic",
      value: `${systemTopic?.confidence || 0}%`,
    },
    {
      title: "Resume/project signal",
      meta: projectTopic ? projectTopic.status || "In progress" : "Add resume project topic",
      value: `${projectTopic?.confidence || 0}%`,
    },
  ];
}

function renderRows(table, rows, mapper, emptyText = "No data yet. Upload a sheet or add an entry.", colSpan = 5) {
  table.innerHTML = "";
  if (rows.length === 0) {
    table.innerHTML = `<tr><td colspan="${colSpan}">${escapeHTML(emptyText)}</td></tr>`;
    return;
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    mapper(row).forEach((cell) => {
      const td = document.createElement("td");
      td.textContent = cell || "-";
      tr.append(td);
    });
    table.append(tr);
  });
}

function renderStackList(container, rows, mapper) {
  container.innerHTML = "";
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">No data yet.</div>`;
    return;
  }

  rows.forEach((row) => {
    const item = mapper(row);
    const element = document.createElement("div");
    element.className = "stack-row";
    element.innerHTML = `
      <div>
        <div class="stack-title">${escapeHTML(item.title || "")}</div>
        <div class="stack-meta">${escapeHTML(item.meta || "")}</div>
        ${
          item.progress !== undefined
            ? `<div class="bar-track" style="margin-top:8px"><div class="bar-fill" style="width:${item.progress}%"></div></div>`
            : ""
        }
      </div>
      <div class="stack-value">${escapeHTML(item.value || "")}</div>
    `;
    container.append(element);
  });
}

function parseCSV(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current);
      rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current || row.length) {
    row.push(current);
    rows.push(row);
  }

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows
    .filter((cells) => cells.some((cell) => String(cell).trim()))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
}

function groupSum(rows, keyFn, valueKey) {
  return rows.reduce((result, row) => {
    const key = keyFn(row);
    result[key] = (result[key] || 0) + toNumber(row[valueKey]);
    return result;
  }, {});
}

function groupBy(rows, keyFn) {
  return rows.reduce((result, row) => {
    const key = keyFn(row);
    result[key] ||= [];
    result[key].push(row);
    return result;
  }, {});
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + toNumber(row[key]), 0);
}

function pick(row, keys) {
  return keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function pickNumber(row, keys) {
  return toNumber(pick(row, keys));
}

function pickDate(row, keys) {
  const value = pick(row, keys);
  if (!value) return todayISO();
  if (value instanceof Date && !Number.isNaN(value.getTime())) return dateToISODate(value);
  if (typeof value === "number" && value > 25000 && value < 90000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    excelEpoch.setUTCDate(excelEpoch.getUTCDate() + value);
    return dateToISODate(excelEpoch);
  }
  const maybeMonth = String(value).match(/([a-zA-Z]+)[\s-]*(\d{4})/);
  if (maybeMonth) {
    const monthName = normalizeMonthName(maybeMonth[1]);
    const date = new Date(`${monthName} 1, ${maybeMonth[2]}`);
    if (!Number.isNaN(date.getTime())) return dateToISODate(date);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return dateToISODate(parsed);
  return todayISO();
}

function normalizeMonthName(value) {
  const month = String(value || "").toLowerCase();
  const aliases = {
    jan: "Jan",
    january: "Jan",
    feb: "Feb",
    fed: "Feb",
    february: "Feb",
    mar: "Mar",
    march: "Mar",
    apr: "Apr",
    april: "Apr",
    may: "May",
    jun: "Jun",
    june: "Jun",
    jul: "Jul",
    july: "Jul",
    aug: "Aug",
    august: "Aug",
    sep: "Sep",
    sept: "Sep",
    september: "Sep",
    oct: "Oct",
    october: "Oct",
    nov: "Nov",
    november: "Nov",
    dec: "Dec",
    december: "Dec",
  };
  return aliases[month] || value;
}

function toNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatINR(value) {
  return INR.format(toNumber(value));
}

function compactINR(value) {
  const number = toNumber(value);
  if (Math.abs(number) >= 10000000) return `₹${(number / 10000000).toFixed(1)}Cr`;
  if (Math.abs(number) >= 100000) return `₹${(number / 100000).toFixed(1)}L`;
  if (Math.abs(number) >= 1000) return `₹${Math.round(number / 1000)}k`;
  return `₹${Math.round(number)}`;
}

function formatPercent(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Math.round(value)}%`;
}

function formatDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonth(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function componentSummary(item) {
  const parts = salaryComponentFields
    .map(([key, label]) => ({ label, value: toNumber(item[key]) }))
    .filter((part) => part.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  return parts.length ? parts.map((part) => `${part.label}: ${formatINR(part.value)}`).join(", ") : "-";
}

function sortByDateDesc(a, b) {
  return new Date(b.date || b.dueDate || 0) - new Date(a.date || a.dueDate || 0);
}

function isCurrentMonth(dateValue) {
  const date = new Date(dateValue);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function sameDay(dateA, dateB) {
  const first = safeISODate(dateA);
  const second = safeISODate(dateB);
  return Boolean(first && second && first === second);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  return dateToISODate(new Date());
}

function safeISODate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateToISODate(date);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function daysAgoISO(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return dateToISODate(date);
}

function thisMonthDate(day) {
  const date = new Date();
  date.setDate(day);
  return dateToISODate(date);
}

function lastMonthDate(day) {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  date.setDate(day);
  return dateToISODate(date);
}

function dateToISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHTML(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cssVar(name) {
  return getComputedStyle(document.body).getPropertyValue(name).trim();
}

function capitalize(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function viewTitle(view) {
  return (
    {
      dashboard: "Your growth dashboard",
      finance: "Money, salary, and net worth",
      career: "Interview preparation and switch plan",
      goals: "Goals, routines, and health",
      assistant: "Ask your dashboard",
    }[view] || "Life Ledger"
  );
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => element.classList.remove("show"), 2600);
}
