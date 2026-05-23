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
  mutualFunds: [],
  stocks: [],
  goals: [],
  tasks: [],
  studies: [],
  workouts: [],
  chat: [],
};

const EXPENSE_PAGE_SIZE = 80;
const IMPORT_YIELD_EVERY = 400;

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
let activeHoldingsOwner = "Me";
let activeExpenseMonth = "";
let activeExpensePage = 0;
let expenseMonthIndexCache = null;
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
  mutualFund: [
    ["owner", "Owner (Me / Wife)", "text"],
    ["fundName", "Fund name", "text"],
    ["transactionType", "Transaction type (PURCHASE / REDEMPTION)", "text"],
    ["units", "Units", "number"],
    ["nav", "Purchase NAV", "number"],
    ["invested", "Amount invested", "number"],
    ["purchaseDate", "Purchase Date", "date"],
    ["folio", "Folio no.", "text"],
    ["platform", "Platform (Groww / Kuvera / etc.)", "text"],
    ["notes", "Notes", "textarea"],
  ],
  stock: [
    ["owner", "Owner (Me / Wife)", "text"],
    ["symbol", "Symbol", "text"],
    ["company", "Company name", "text"],
    ["exchange", "Exchange (NSE / BSE)", "text"],
    ["quantity", "Quantity", "number"],
    ["avgPrice", "Avg buy price", "number"],
    ["currentPrice", "Current price", "number"],
    ["invested", "Amount invested", "number"],
    ["sector", "Sector", "text"],
    ["demat", "Demat / broker", "text"],
    ["purchaseDate", "Purchase date", "date"],
    ["notes", "Notes", "textarea"],
  ],
};

const resetScopes = {
  income: { label: "salary / income", keys: ["income"] },
  expenses: { label: "expenses", keys: ["expenses"] },
  networth: { label: "assets and liabilities", keys: ["assets", "liabilities"] },
  holdings: { label: "mutual funds and stocks", keys: ["mutualFunds", "stocks"] },
  finance: {
    label: "all finance data",
    keys: ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks"],
  },
  mutualfunds: { label: "mutual funds", keys: ["mutualFunds"] },
  stocks: { label: "stocks", keys: ["stocks"] },
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
  refreshMutualFundNAVs(false);
}

window.LifeLedgerApp = {
  defaultData: () => clone(defaultData),
  bootstrap: bootstrapApp,
};

let saveDataTimer;
let isSaving = false;
let currentSavePromise = null;

function saveData(immediate = false) {
  invalidateExpenseCache();
  if (!window.LifeLedgerAuth?.isUnlocked()) return Promise.resolve();
  clearTimeout(saveDataTimer);

  const saveAction = async () => {
    saveDataTimer = null;
    isSaving = true;
    try {
      await window.LifeLedgerAuth.saveAppData(state);
    } catch (error) {
      console.warn(error);
      toast(error.message || "Could not save encrypted vault.");
    } finally {
      isSaving = false;
      currentSavePromise = null;
    }
  };

  if (immediate) {
    currentSavePromise = saveAction();
    return currentSavePromise;
  } else {
    return new Promise((resolve) => {
      saveDataTimer = setTimeout(() => {
        currentSavePromise = saveAction();
        currentSavePromise.then(resolve);
      }, 700);
    });
  }
}

window.addEventListener("beforeunload", (event) => {
  if (saveDataTimer || isSaving) {
    if (saveDataTimer) {
      clearTimeout(saveDataTimer);
      saveDataTimer = null;
      currentSavePromise = window.LifeLedgerAuth?.saveAppData(state).catch(console.warn);
    }
    event.preventDefault();
    event.returnValue = "Saving changes, please wait a moment...";
    return event.returnValue;
  }
});

function invalidateExpenseCache() {
  expenseMonthIndexCache = null;
}

function appendArray(target, source) {
  for (let i = 0; i < source.length; i += 1) target.push(source[i]);
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
    mutualFunds: ensureIds(data.mutualFunds || [], "mf"),
    stocks: ensureIds(data.stocks || [], "stk"),
    goals: ensureIds(data.goals || [], "goal"),
    tasks: ensureIds(data.tasks || [], "task"),
    studies: ensureIds(data.studies || [], "study"),
    workouts: ensureIds(data.workouts || [], "work"),
    chat: data.chat || [],
  };
}

function ensureIds(items, prefix) {
  return items.map((item) => ({ ...item, id: item.id || `${prefix}-${generateUUID()}` }));
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

  document.getElementById("seedDemoButton").addEventListener("click", async () => {
    state = normalizeData(demoData);
    await saveData(true);
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
      document.getElementById(`finance-${activeFinanceTab}`)?.classList.add("active");
      if (activeFinanceTab === "expenses") renderExpenseExplorer();
    });
  });

  document.getElementById("expenseMonthSelect")?.addEventListener("change", (event) => {
    activeExpenseMonth = event.target.value;
    activeExpensePage = 0;
    renderExpenseExplorer();
  });

  document.getElementById("expensePagePrev")?.addEventListener("click", () => {
    activeExpensePage = Math.max(0, activeExpensePage - 1);
    renderExpenseExplorer(false);
  });

  document.getElementById("expensePageNext")?.addEventListener("click", () => {
    activeExpensePage += 1;
    renderExpenseExplorer(false);
  });

  document.getElementById("toggleExpenseTableZoom")?.addEventListener("click", () => {
    const btn = document.getElementById("toggleExpenseTableZoom");
    const container = document.querySelector(".expense-split");
    if (container && btn) {
      const isZoomed = container.classList.toggle("table-zoomed");
      btn.textContent = isZoomed ? "🔍 Split view" : "🔍 Expand";
    }
  });

  document.getElementById("expenseTable")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-expense-btn");
    const deleteBtn = event.target.closest(".delete-expense-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm("expense", id);
      openModal("quickAddModal");
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (id) await deleteExpense(id);
    }
  });

  document.getElementById("incomeTable")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-income-btn");
    const deleteBtn = event.target.closest(".delete-income-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm("income", id);
      openModal("quickAddModal");
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (id && confirm("Are you sure you want to delete this salary entry?")) {
        state.income = state.income.filter(item => item.id !== id);
        await saveData(true);
        renderIncomeTable();
        toast("Salary entry deleted.");
      }
    }
  });

  document.getElementById("mutualFundTable")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-mutualFund-btn");
    const deleteBtn = event.target.closest(".delete-mutualFund-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm("mutualFund", id);
      openModal("quickAddModal");
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (id && confirm("Are you sure you want to delete this mutual fund transaction?")) {
        state.mutualFunds = state.mutualFunds.filter(item => item.id !== id);
        await saveData(true);
        renderMutualFundsPanel();
        toast("Mutual fund transaction deleted.");
      }
    }
  });

  document.getElementById("stockTable")?.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-stock-btn");
    const deleteBtn = event.target.closest(".delete-stock-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm("stock", id);
      openModal("quickAddModal");
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (id && confirm("Are you sure you want to delete this stock entry?")) {
        state.stocks = state.stocks.filter(item => item.id !== id);
        await saveData(true);
        renderStocksPanel();
        toast("Stock entry deleted.");
      }
    }
  });

  document.getElementById("refreshMutualFundNAVsBtn")?.addEventListener("click", async () => {
    await refreshMutualFundNAVs(true);
  });

  document.querySelectorAll("[data-holdings-owner]").forEach((button) => {
    button.addEventListener("click", () => {
      activeHoldingsOwner = button.dataset.holdingsOwner;
      document.querySelectorAll("[data-holdings-owner]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      renderHoldingsTabs();
    });
  });
}

async function importBuiltInMasterSheet() {
  if (!window.XLSX) {
    throw new Error("Excel support needs internet once to load the SheetJS parser.");
  }

  let response;
  for (const path of MASTER_SHEET_PATHS) {
    const attempt = await fetch(path);
    if (attempt.ok) {
      response = attempt;
      break;
    }
  }
  if (!response) {
    throw new Error(
      "Master workbook not found. Copy your file to data/salary-and-expenses.xlsx or use Upload sheet."
    );
  }

  const buffer = await response.arrayBuffer();
  const file = new File([buffer], "salary-and-expenses.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return parseImportFile(file, "auto");
}

function bindImports() {
  document.getElementById("importMasterSheetButton")?.addEventListener("click", async () => {
    const ok = confirm(
      "Import salary and expenses from your master workbook?\n\nThis replaces current salary and expense rows (other data stays)."
    );
    if (!ok) return;

    try {
      await runImport(async () => {
        const imported = await importBuiltInMasterSheet();
        state.income = [];
        state.expenses = [];
        mergeImportedData(imported);
        return imported;
      });
      closeModal(document.getElementById("importModal"));
    } catch (error) {
      document.getElementById("importStatus").textContent = error.message;
      toast(error.message);
    }
  });

  document.getElementById("importFileButton").addEventListener("click", async () => {
    const file = document.getElementById("fileInput").files[0];
    const kind = document.getElementById("importKind").value;
    if (!file) {
      toast("Choose an Excel, CSV, or JSON file first.");
      return;
    }

    try {
      await runImport(async () => {
        const imported = await parseImportFile(file, kind);
        mergeImportedData(imported);
        return imported;
      });
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
      await saveData(true);
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

async function deleteExpense(id) {
  if (!id) return;
  if (!confirm("Are you sure you want to delete this expense entry?")) return;

  state.expenses = state.expenses.filter((exp) => exp.id !== id);
  invalidateExpenseCache();

  try {
    await saveData(true);
    toast("Expense deleted.");
  } catch (error) {
    console.error("Failed to delete expense:", error);
    toast("Failed to delete expense: " + error.message);
  }

  renderAll();
}

async function resetData(scope) {
  const config = {
    all: { label: "all data", keys: [] },
    income: { label: "income", keys: ["income"] },
    expenses: { label: "expenses", keys: ["expenses"] },
    investments: { label: "investments", keys: ["mutualFunds", "stocks"] },
    goals: { label: "goals", keys: ["goals"] },
    tasks: { label: "tasks", keys: ["tasks"] },
    studies: { label: "studies", keys: ["studies"] },
    workouts: { label: "workouts", keys: ["workouts"] },
    networth: { label: "assets and liabilities", keys: ["assets", "liabilities"] },
    holdings: { label: "mutual funds and stocks", keys: ["mutualFunds", "stocks"] },
    mutualfunds: { label: "mutual funds", keys: ["mutualFunds"] },
    stocks: { label: "stocks", keys: ["stocks"] },
    finance: { label: "all finance data", keys: ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks"] },
    chat: { label: "assistant chat", keys: ["chat"] },
  }[scope];

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
  await saveData(true);
  renderAll();
  document.querySelectorAll(".modal").forEach((modal) => closeModal(modal));
  toast(`${capitalize(config.label)} cleared.`);
}

function ensureAssistantWelcome(shouldSave) {
  if (state.chat.length > 0) return;
  state.chat.push({ role: "assistant", text: assistantWelcome, at: new Date().toISOString() });
  if (shouldSave) saveData();
}

function buildQuickAddForm(kind, editId = null) {
  const form = document.getElementById("quickAddForm");
  const title = document.getElementById("quickAddTitle");
  const labels = {
    income: editId ? "Edit income" : "Add income",
    expense: editId ? "Edit expense" : "Add expense",
    asset: editId ? "Edit asset" : "Add asset",
    liability: editId ? "Edit liability" : "Add liability",
    mutualFund: editId ? "Edit mutual fund" : "Add mutual fund",
    stock: editId ? "Edit stock" : "Add stock",
    goal: editId ? "Edit goal" : "Add goal",
    task: editId ? "Edit task" : "Add task",
    study: editId ? "Edit study topic" : "Add study topic",
    workout: editId ? "Edit workout" : "Log workout",
  };

  title.textContent = labels[kind] || (editId ? "Edit entry" : "Add entry");
  const fields = fieldsByKind[kind] || fieldsByKind.expense;
  form.innerHTML = "";

  let existingEntry = null;
  let collection = [];
  if (editId) {
    if (kind === "expense") collection = state.expenses;
    else if (kind === "income") collection = state.income;
    else if (kind === "asset") collection = collection = state.assets;
    else if (kind === "liability") collection = state.liabilities;
    else if (kind === "mutualFund") collection = state.mutualFunds;
    else if (kind === "stock") collection = state.stocks;
    else if (kind === "goal") collection = state.goals;
    else if (kind === "task") collection = state.tasks;
    else if (kind === "study") collection = state.studies;
    else if (kind === "workout") collection = state.workouts;

    existingEntry = collection.find(item => item.id === editId);
  }

  fields.forEach(([name, label, type]) => {
    const wrapper = document.createElement("label");
    if (type === "textarea") wrapper.classList.add("full-span");
    wrapper.textContent = label;

    const input = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.name = name;
    input.type = type === "checkbox" ? "checkbox" : type;
    if (type === "number") input.inputMode = "decimal";

    if (existingEntry) {
      if (type === "checkbox") {
        input.checked = !!existingEntry[name];
      } else {
        input.value = existingEntry[name] !== undefined ? existingEntry[name] : "";
      }
    } else {
      if (type === "date" && ["date", "dueDate", "purchaseDate"].includes(name)) input.value = todayISO();
    }

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
  form.onsubmit = async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const entry = existingEntry ? { ...existingEntry } : { id: `${kind}-${generateUUID()}` };
    fields.forEach(([name, , type]) => {
      if (type === "checkbox") {
        entry[name] = form.querySelector(`[name="${name}"]`).checked;
      } else {
        entry[name] = type === "number" ? toNumber(formData.get(name)) : String(formData.get(name) || "").trim();
      }
    });

    if (kind === "mutualFund") {
      entry.owner = normalizeOwner(entry.owner);
      entry.amc = inferAmc(entry.fundName);
      if (!entry.latestNav) entry.latestNav = entry.nav;
      if (!entry.currentValue) entry.currentValue = entry.invested;
    }
    if (kind === "stock") {
      entry.owner = normalizeOwner(entry.owner);
      if (!entry.invested) entry.invested = toNumber(entry.quantity) * toNumber(entry.avgPrice || entry.currentPrice);
    }

    if (existingEntry) {
      const idx = collection.findIndex(item => item.id === editId);
      if (idx !== -1) {
        collection[idx] = entry;
      }
    } else {
      if (kind === "expense") state.expenses.push(entry);
      if (kind === "income") state.income.push(entry);
      if (kind === "asset") state.assets.push(entry);
      if (kind === "liability") state.liabilities.push(entry);
      if (kind === "mutualFund") state.mutualFunds.push(entry);
      if (kind === "stock") state.stocks.push(entry);
      if (kind === "goal") state.goals.push(entry);
      if (kind === "task") state.tasks.push(entry);
      if (kind === "study") state.studies.push(entry);
      if (kind === "workout") state.workouts.push(entry);
    }

    invalidateExpenseCache();
    await saveData(true);
    renderAll();
    closeModal(form.closest(".modal"));
    toast(existingEntry ? "Entry updated." : "Entry saved.");
  };
}

async function runImport(importFn) {
  const status = document.getElementById("importStatus");
  if (status) status.textContent = "Importing… this may take a moment for large sheets.";
  toast("Importing…");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const result = await importFn();
  invalidateExpenseCache();
  await saveData(true);
  renderAll();
  refreshMutualFundNAVs(false);
  const summary = result && result.income ? importSummary(result) : importSummary(state);
  if (status) status.textContent = summary;
  toast(`Import complete. ${summary}`);
  return result;
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
    const output = emptyImportBuckets();
    let processed = 0;

    for (const sheetName of workbook.SheetNames) {
      if (selectedKind === "auto" && INCOME_SKIP_SHEETS.test(sheetName)) continue;
      const sheet = workbook.Sheets[sheetName];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true, dateNF: "yyyy-mm-dd" });
      for (let i = 0; i < rows.length; i += 1) {
        ingestImportRow(output, { ...rows[i], __sheet: sheetName }, selectedKind);
        processed += 1;
        if (processed % IMPORT_YIELD_EVERY === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return output;
  }

  throw new Error("Unsupported file type.");
}

function emptyImportBuckets() {
  return {
    income: [],
    expenses: [],
    assets: [],
    liabilities: [],
    mutualFunds: [],
    stocks: [],
    goals: [],
    tasks: [],
    studies: [],
    workouts: [],
    chat: [],
  };
}

function ingestImportRow(output, row, selectedKind) {
  const normalized = normalizeRow(row);
  const kind = selectedKind === "auto" ? detectKind(normalized) : selectedKind;
  if (kind === "income" && INCOME_SKIP_SHEETS.test(String(normalized.sheet || ""))) return;
  const item = mapRowToKind(normalized, kind);
  if (!item) return;
  if (kind === "income") output.income.push(item);
  if (kind === "expense") output.expenses.push(item);
  if (kind === "asset") output.assets.push(item);
  if (kind === "liability") output.liabilities.push(item);
  if (kind === "mutualFund") output.mutualFunds.push(item);
  if (kind === "stock") output.stocks.push(item);
  if (kind === "goal") output.goals.push(item);
  if (kind === "task") output.tasks.push(item);
  if (kind === "study") output.studies.push(item);
  if (kind === "workout") output.workouts.push(item);
}

const MASTER_SHEET_PATHS = [
  "data/salary-and-expenses.xlsx",
  "Salary and expensese sheet details  (1).xlsx",
];

const INCOME_SKIP_SHEETS = /breakup|_break|sal_break|our need/i;

function rowsToData(rows, selectedKind) {
  const output = emptyImportBuckets();
  rows.forEach((row) => ingestImportRow(output, row, selectedKind));
  return output;
}

function normalizeRow(row) {
  const normalized = {};
  if (row.__sheet) normalized.sheet = row.__sheet;
  Object.entries(row).forEach(([key, value]) => {
    if (key === "__sheet") return;
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
  if (/mutual|mf|sip|folio|amc/.test(keys + sheet) && !/stock|equity share/.test(keys + sheet)) return "mutualFund";
  if (/stock|equity|demat|nse|bse|share|symbol/.test(keys + sheet)) return "stock";
  if (/asset|investment|bank|gold/.test(keys + sheet)) return "asset";
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

    const sheetName = String(row.sheet || row.__sheet || "");
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
      id: `inc-${generateUUID()}`,
      date: pickDate(row, ["date", "month", "salarydate", "crediteddate"]) || todayISO(),
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
    const date = pickDate(row, ["date", "month", "spentdate", "transactiondate"]);
    if (!date) return null;
    return {
      id: `exp-${generateUUID()}`,
      date,
      category: pick(row, ["category", "expensecategory", "type"]) || "General",
      paidBy: pick(row, ["paidby", "person", "payer", "owner"]) || "Both",
      amount,
      note: pick(row, ["note", "description", "merchant", "remarks"]) || "",
    };
  }

  if (kind === "mutualFund") {
    const fundName = pick(row, ["schemename", "fundname", "name", "scheme", "fund"]) || "Mutual fund";
    const transactionType = pick(row, ["transactiontype", "type"]) || "PURCHASE";
    const units = pickNumber(row, ["units", "unit"]);
    const nav = pickNumber(row, ["nav", "purchasenav", "latestnav"]);
    const invested = pickNumber(row, ["amount", "invested", "investment", "cost", "principal"]);
    const date = pickDate(row, ["date", "purchasedate", "startdate"]);
    const owner = normalizeOwner(pick(row, ["owner", "ownermewife", "person", "holder"]) || inferPerson(String(row.sheet || ""), row));

    let purchaseNav = nav;
    if (!purchaseNav && units && invested) {
      purchaseNav = invested / units;
    }
    let amountInvested = invested;
    if (!amountInvested && units && purchaseNav) {
      amountInvested = units * purchaseNav;
    }
    let mfUnits = units;
    if (!mfUnits && amountInvested && purchaseNav) {
      mfUnits = amountInvested / purchaseNav;
    }

    if (!amountInvested && !mfUnits) return null;

    return {
      id: `mf-${generateUUID()}`,
      owner,
      fundName,
      transactionType,
      amc: pick(row, ["amc", "fundhouse"]) || inferAmc(fundName),
      category: pick(row, ["category", "assetclass"]) || "Equity",
      folio: pick(row, ["folio", "foliono", "folionumber"]) || "",
      invested: amountInvested,
      currentValue: amountInvested,
      units: mfUnits,
      nav: purchaseNav,
      latestNav: purchaseNav,
      platform: pick(row, ["platform", "app", "broker"]) || "",
      purchaseDate: date || todayISO(),
      notes: pick(row, ["notes", "note", "remarks"]) || "",
    };
  }

  if (kind === "stock") {
    const quantity = pickNumber(row, ["quantity", "qty", "shares", "units"]);
    const avgPrice = pickNumber(row, ["avgprice", "averageprice", "buyprice", "price"]);
    const currentPrice = pickNumber(row, ["currentprice", "cmp", "ltp", "marketprice"]);
    const invested = pickNumber(row, ["invested", "investment", "cost"]) || quantity * avgPrice;
    if (!quantity && !invested && !currentPrice) return null;
    const owner = normalizeOwner(pick(row, ["owner", "person", "holder"]) || inferPerson(String(row.sheet || ""), row));
    return {
      id: `stk-${generateUUID()}`,
      owner,
      symbol: pick(row, ["symbol", "ticker", "code"]) || "",
      company: pick(row, ["company", "name", "stock", "security"]) || "Stock",
      exchange: pick(row, ["exchange", "market"]) || "NSE",
      quantity,
      avgPrice,
      currentPrice: currentPrice || avgPrice,
      invested: invested || quantity * (avgPrice || currentPrice),
      sector: pick(row, ["sector", "industry"]) || "",
      demat: pick(row, ["demat", "broker", "platform"]) || "",
      purchaseDate: pickDate(row, ["purchasedate", "buydate", "date"]),
      notes: pick(row, ["notes", "note", "remarks"]) || "",
    };
  }

  if (kind === "asset") {
    const value = pickNumber(row, ["value", "amount", "currentvalue", "balance"]);
    if (!value) return null;
    return {
      id: `asset-${generateUUID()}`,
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
      id: `liab-${generateUUID()}`,
      name: pick(row, ["name", "liability", "loan", "account"]) || "Liability",
      category: pick(row, ["category", "type"]) || "Liability",
      owner: pick(row, ["owner", "person"]) || "Both",
      value,
    };
  }

  if (kind === "goal") {
    const target = pickNumber(row, ["target", "targetamount", "goalamount"]) || 100;
    return {
      id: `goal-${generateUUID()}`,
      name: pick(row, ["name", "goal", "title"]) || "Goal",
      category: pick(row, ["category", "area"]) || "Personal",
      target,
      saved: pickNumber(row, ["saved", "current", "progress", "done"]) || 0,
      dueDate: pickDate(row, ["duedate", "date", "deadline"]),
    };
  }

  if (kind === "study") {
    return {
      id: `study-${generateUUID()}`,
      topic: pick(row, ["topic", "subject", "name"]) || "Study topic",
      status: pick(row, ["status", "stage"]) || "Planned",
      confidence: clamp(pickNumber(row, ["confidence", "confidencepercent", "progress"]) || 0, 0, 100),
      hours: pickNumber(row, ["hours", "hoursdone", "time"]) || 0,
      targetHours: pickNumber(row, ["targethours", "target", "plannedhours"]) || 20,
    };
  }

  if (kind === "task") {
    return {
      id: `task-${generateUUID()}`,
      text: pick(row, ["task", "todo", "text", "name"]) || "Task",
      area: pick(row, ["area", "category"]) || "Personal",
      date: pickDate(row, ["date", "day"]),
      done: /true|yes|done|complete/i.test(String(pick(row, ["done", "status"]) || "")),
    };
  }

  if (kind === "workout") {
    return {
      id: `work-${generateUUID()}`,
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
  appendArray(state.income, normalized.income);
  appendArray(state.expenses, normalized.expenses);
  appendArray(state.assets, normalized.assets);
  appendArray(state.liabilities, normalized.liabilities);
  appendArray(state.mutualFunds, normalized.mutualFunds);
  appendArray(state.stocks, normalized.stocks);
  appendArray(state.goals, normalized.goals);
  appendArray(state.tasks, normalized.tasks);
  appendArray(state.studies, normalized.studies);
  appendArray(state.workouts, normalized.workouts);
}

function normalizeOwner(value) {
  const text = String(value || "").trim();
  if (/wife|archana|spouse/i.test(text)) return "Wife";
  if (/me|prafful|self/i.test(text)) return "Me";
  if (/both|joint/i.test(text)) return "Both";
  return text || "Me";
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
  return (
    data &&
    ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks", "goals", "tasks", "studies", "workouts"].some(
      (key) => Array.isArray(data[key])
    )
  );
}

function importSummary(imported) {
  const parts = [
    ["income", imported.income?.length || 0],
    ["expenses", imported.expenses?.length || 0],
    ["mutual funds", imported.mutualFunds?.length || 0],
    ["stocks", imported.stocks?.length || 0],
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
      label: metrics.isFallbackIncome ? `Income (${metrics.fallbackMonthLabel})` : "This month income",
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
      hint: metrics.isFallbackIncome
        ? `${formatINR(metrics.monthIncome - metrics.monthExpenses)} left (est. savings)`
        : `${formatINR(metrics.monthIncome - metrics.monthExpenses)} left this month`,
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
  const width = 900;
  const height = 320;
  const padding = { top: 38, right: 26, bottom: 44, left: 72 };

  const values = rows.flatMap((row) => [row.grossEarnings || 0, row.netSalary || row.amount || 0]);
  const maxValue = Math.max(1, ...values);
  const xStep = (width - padding.left - padding.right) / Math.max(1, rows.length - 1);
  const y = (value) => height - padding.bottom - (value / maxValue) * (height - padding.top - padding.bottom);
  const x = (index) => padding.left + index * xStep;

  // Modern company color list (theme variable fallbacks + high contrast trendy colors)
  const COMPANY_COLORS = [
    "var(--brand)",
    "var(--accent)",
    "var(--accent-2)",
    "var(--good)",
    "var(--danger)",
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#06b6d4"  // Cyan
  ];

  // Map organizations to colors
  const orgs = [...new Set(rows.map((row) => row.source || row.organization || "Salary"))];
  const companyColorMap = {};
  orgs.forEach((org, idx) => {
    companyColorMap[org] = COMPANY_COLORS[idx % COMPANY_COLORS.length];
  });

  // Build grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1]
    .map((tick) => {
      const yy = padding.top + tick * (height - padding.top - padding.bottom);
      const value = maxValue * (1 - tick);
      return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="${lineColor}" />
        <text x="10" y="${yy + 4}" fill="${mutedColor}" font-size="12">${compactINR(value)}</text>`;
    })
    .join("");

  // Build line segments for net and gross salary
  let chartLines = "";
  let transitions = "";

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const prevOrg = prev.source || prev.organization || "Salary";
    const currOrg = curr.source || curr.organization || "Salary";
    const color = companyColorMap[currOrg];

    const x1 = x(i - 1);
    const x2 = x(i);
    const yNet1 = y(prev.netSalary || prev.amount || 0);
    const yNet2 = y(curr.netSalary || curr.amount || 0);
    const yGross1 = y(prev.grossEarnings || prev.netSalary || prev.amount || 0);
    const yGross2 = y(curr.grossEarnings || curr.netSalary || curr.amount || 0);

    // Draw net segment
    chartLines += `<line x1="${x1}" y1="${yNet1}" x2="${x2}" y2="${yNet2}" stroke="${color}" stroke-width="4" stroke-linecap="round" />`;

    // Draw gross segment (dashed/opacity)
    chartLines += `<line x1="${x1}" y1="${yGross1}" x2="${x2}" y2="${yGross2}" stroke="${color}" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round" opacity="0.6" />`;

    // Check transition
    if (prevOrg !== currOrg) {
      transitions += `
        <line x1="${x2}" y1="${padding.top}" x2="${x2}" y2="${height - padding.bottom}" stroke="${lineColor}" stroke-dasharray="2 4" stroke-width="1.5"></line>
      `;
    }
  }

  // Fallback for single data point
  if (rows.length === 1) {
    const single = rows[0];
    const org = single.source || single.organization || "Salary";
    const color = companyColorMap[org];
    const xVal = padding.left + (width - padding.left - padding.right) / 2;
    chartLines += `
      <circle cx="${xVal}" cy="${y(single.netSalary || single.amount || 0)}" r="6" fill="${color}"></circle>
      <circle cx="${xVal}" cy="${y(single.grossEarnings || single.netSalary || single.amount || 0)}" r="4" fill="${color}" opacity="0.6"></circle>
    `;
  }

  // Add dots at intervals
  const dots = rows
    .filter((_, index) => index === 0 || index === rows.length - 1 || index % 6 === 0)
    .map((row) => {
      const index = rows.indexOf(row);
      const org = row.source || row.organization || "Salary";
      const color = companyColorMap[org];
      return `<circle cx="${x(index)}" cy="${y(row.netSalary || row.amount || 0)}" r="5.5" fill="${color}" stroke="${panelColor}" stroke-width="2"></circle>`;
    })
    .join("");

  // Build year vertical grid lines
  const yearLabels = rows
    .map((row, index) => ({ date: new Date(row.date), index }))
    .filter((item, index, list) => index === 0 || item.date.getFullYear() !== list[index - 1].date.getFullYear())
    .map(
      ({ date, index }) => `
        <line x1="${x(index)}" y1="${padding.top}" x2="${x(index)}" y2="${height - padding.bottom}" stroke="${lineColor}" stroke-dasharray="4 6"></line>
        <text x="${x(index) + 4}" y="${height - 14}" fill="${mutedColor}" font-size="12">${date.getFullYear()}</text>
      `
    )
    .join("");

  // Build Legend
  let legendHtml = `
    <g transform="translate(72, 20)">
      <line x1="0" y1="0" x2="16" y2="0" stroke="${inkColor}" stroke-width="3"></line>
      <text x="22" y="4" fill="${inkColor}" font-size="12" font-weight="700">Net</text>
      <line x1="60" y1="0" x2="76" y2="0" stroke="${inkColor}" stroke-width="2" stroke-dasharray="2 2" opacity="0.7"></line>
      <text x="82" y="4" fill="${inkColor}" font-size="12" font-weight="700">Gross</text>
    </g>
  `;

  // Draw company legend items
  let legendX = 240;
  const legendItems = orgs
    .map((org) => {
      const color = companyColorMap[org];
      const item = `
        <g transform="translate(${legendX}, 20)">
          <circle cx="0" cy="-1" r="5.5" fill="${color}"></circle>
          <text x="10" y="3" fill="${inkColor}" font-size="12" font-weight="700">${escapeHTML(org)}</text>
        </g>
      `;
      legendX += org.length * 6.5 + 32;
      return item;
    })
    .join("");

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.innerHTML = `
    <rect width="${width}" height="${height}" rx="8" fill="${panelColor}"></rect>
    ${gridLines}
    ${transitions}
    ${yearLabels}
    ${chartLines}
    ${dots}
    ${legendHtml}
    ${legendItems}
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
  const holdings = investmentHoldingsTotal();
  const liabilities = sum(state.liabilities, "value");
  const netWorth = assets + holdings - liabilities;
  const maxValue = Math.max(assets, holdings, liabilities, Math.abs(netWorth), 1);
  container.innerHTML = "";
  [
    ["Assets (other)", assets, "bar-fill"],
    ["MF + Stocks", holdings, "bar-fill blue"],
    ["Liabilities", liabilities, "bar-fill accent"],
    ["Net worth", netWorth, "bar-fill"],
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
  renderExpenseExplorer();
  renderHoldingsTabs();
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
  const salaryRows = [...state.income].filter(isSalary);

  // Calculate metrics
  let totalNet = 0;
  let totalTds = 0;
  let monthsCount = salaryRows.length;

  salaryRows.forEach((row) => {
    totalNet += Number(row.netSalary || row.amount || 0);
    totalTds += Number(row.taxTds || 0);
  });

  const avgNet = monthsCount > 0 ? (totalNet / monthsCount) : 0;

  // Set values in DOM
  const earnedEl = document.getElementById("salaryTotalEarned");
  const tdsEl = document.getElementById("salaryTotalTDS");
  const monthsEl = document.getElementById("salaryMonthsTracked");
  const avgEl = document.getElementById("salaryAvgInHand");

  if (earnedEl) earnedEl.textContent = formatINR(totalNet);
  if (tdsEl) tdsEl.textContent = formatINR(totalTds);
  if (monthsEl) monthsEl.textContent = String(monthsCount);
  if (avgEl) avgEl.textContent = formatINR(avgNet);

  renderRows(
    table,
    [...salaryRows].sort(sortByDateDesc).slice(0, 160),
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
      `<div class="actions-wrapper">
        <button class="action-btn edit-btn edit-income-btn" data-id="${item.id}" title="Edit entry">✏️</button>
        <button class="action-btn delete-btn delete-income-btn" data-id="${item.id}" title="Delete entry">🗑️</button>
      </div>`
    ],
    "No salary data yet. Upload your salary workbook or add an income entry.",
    11
  );
}

function getExpenseMonthIndex() {
  if (expenseMonthIndexCache) return expenseMonthIndexCache;
  const byMonth = new Map();
  state.expenses.forEach((expense) => {
    const key = toMonthKey(expense.date);
    if (!key) return;
    if (!byMonth.has(key)) byMonth.set(key, { total: 0, categories: {}, rows: [] });
    const bucket = byMonth.get(key);
    const amount = toNumber(expense.amount);
    bucket.total += amount;
    const category = expense.category || "General";
    bucket.categories[category] = (bucket.categories[category] || 0) + amount;
    bucket.rows.push(expense);
  });
  expenseMonthIndexCache = byMonth;
  return byMonth;
}

function listExpenseMonths() {
  return [...getExpenseMonthIndex().keys()].sort().reverse();
}

function renderExpenseExplorer(refreshMonthList = true) {
  const monthSelect = document.getElementById("expenseMonthSelect");
  const summary = document.getElementById("expenseMonthSummary");
  const categoryList = document.getElementById("expenseCategoryBreakdown");
  const table = document.getElementById("expenseTable");
  const pageInfo = document.getElementById("expensePageInfo");
  const months = listExpenseMonths();

  if (!monthSelect || !table) return;

  if (refreshMonthList) {
    monthSelect.innerHTML = "";
    if (months.length === 0) {
      monthSelect.innerHTML = `<option value="">No expenses yet</option>`;
      activeExpenseMonth = "";
    } else {
      months.forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = formatMonthKeyLabel(key);
        monthSelect.append(option);
      });
      if (!activeExpenseMonth || !months.includes(activeExpenseMonth)) {
        activeExpenseMonth = months[0];
      }
      monthSelect.value = activeExpenseMonth;
    }
  }

  if (!activeExpenseMonth) {
    if (summary) summary.innerHTML = `<div class="empty-state">Upload your expense sheet or add entries.</div>`;
    if (categoryList) categoryList.innerHTML = "";
    renderRows(table, [], () => [], "No expenses for this month.", 5);
    if (pageInfo) pageInfo.textContent = "";
    return;
  }

  const bucket = getExpenseMonthIndex().get(activeExpenseMonth);
  const rows = [...(bucket?.rows || [])].sort(sortByDateDesc);
  const totalPages = Math.max(1, Math.ceil(rows.length / EXPENSE_PAGE_SIZE));
  activeExpensePage = clamp(activeExpensePage, 0, totalPages - 1);
  const pageRows = rows.slice(activeExpensePage * EXPENSE_PAGE_SIZE, (activeExpensePage + 1) * EXPENSE_PAGE_SIZE);

  if (summary) {
    const txnCount = rows.length;
    const avg = txnCount ? bucket.total / txnCount : 0;
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Month total</div>
        <div class="value">${formatINR(bucket.total)}</div>
        <div class="hint">${txnCount} transactions</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Avg per entry</div>
        <div class="value">${formatINR(avg)}</div>
        <div class="hint">${formatMonthKeyLabel(activeExpenseMonth)}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Top category</div>
        <div class="value">${escapeHTML(topCategoryName(bucket.categories))}</div>
        <div class="hint">${formatINR(topCategoryAmount(bucket.categories))}</div>
      </article>
    `;
  }

  if (categoryList) {
    categoryList.innerHTML = "";
    const categories = Object.entries(bucket.categories || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    if (categories.length === 0) {
      categoryList.innerHTML = `<div class="empty-state">No categories this month.</div>`;
    } else {
      categories.forEach(([category, value]) => {
        const row = document.createElement("div");
        row.className = "stack-row";
        row.innerHTML = `
          <div>
            <div class="stack-title">${escapeHTML(category)}</div>
            <div class="stack-meta">${Math.round((value / Math.max(1, bucket.total)) * 100)}% of month</div>
          </div>
          <div class="stack-value">${formatINR(value)}</div>
        `;
        categoryList.append(row);
      });
    }
  }

  renderRows(
    table,
    pageRows,
    (item) => [
      formatDate(item.date),
      item.category,
      item.paidBy,
      formatINR(item.amount),
      item.note,
      `<div class="actions-wrapper">
        <button class="action-btn edit-btn edit-expense-btn" data-id="${item.id}" title="Edit entry">✏️</button>
        <button class="action-btn delete-btn delete-expense-btn" data-id="${item.id}" title="Delete entry">🗑️</button>
      </div>`
    ],
    "No expenses for this month.",
    6
  );

  if (pageInfo) {
    pageInfo.textContent = rows.length
      ? `Page ${activeExpensePage + 1} of ${totalPages} • showing ${pageRows.length} of ${rows.length}`
      : "";
  }
}

function topCategoryName(categories = {}) {
  const entry = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  return entry?.[0] || "-";
}

function topCategoryAmount(categories = {}) {
  const entry = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  return entry?.[1] || 0;
}

function formatMonthKeyLabel(key) {
  const [year, month] = String(key).split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function renderHoldingsTabs() {
  renderMutualFundsPanel();
  renderStocksPanel();
}

function renderMutualFundsPanel() {
  const summary = document.getElementById("mfOwnerSummary");
  const table = document.getElementById("mutualFundTable");
  if (!table) return;

  const rows = [...state.mutualFunds]
    .filter((item) => matchHoldingsOwner(item.owner, activeHoldingsOwner))
    .sort((a, b) => new Date(b.purchaseDate || b.date || '1970-01-01') - new Date(a.purchaseDate || a.date || '1970-01-01'));

  const invested = sum(rows, "invested");
  const current = sum(rows, "currentValue");
  const gain = current - invested;
  const roi = invested ? (gain / invested) * 100 : 0;

  if (summary) {
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Invested (${activeHoldingsOwner})</div>
        <div class="value">${formatINR(invested)}</div>
        <div class="hint">${rows.length} transactions</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Current value</div>
        <div class="value">${formatINR(current)}</div>
        <div class="hint">${formatINR(gain)} ${gain >= 0 ? "gain 📈" : "loss 📉"}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Total ROI</div>
        <div class="value" style="color: ${gain >= 0 ? "var(--good)" : "var(--danger)"};">${formatPercent(roi)}</div>
        <div class="hint">Overall portfolio returns</div>
      </article>
    `;
  }

  renderRows(
    table,
    rows,
    (item) => [
      formatDate(item.purchaseDate || item.date),
      item.fundName,
      item.transactionType || "PURCHASE",
      item.units ? Number(item.units).toFixed(3) : "-",
      item.nav ? formatINR(item.nav) : "-",
      formatINR(item.invested),
      item.latestNav ? formatINR(item.latestNav) : (item.nav ? formatINR(item.nav) : "-"),
      formatINR(item.currentValue || item.invested),
      (() => {
        const inv = toNumber(item.invested);
        const cur = toNumber(item.currentValue || item.invested);
        const g = cur - inv;
        const pct = inv ? (g / inv) * 100 : 0;
        const color = g >= 0 ? "var(--good)" : "var(--danger)";
        return `<span style="color: ${color}; font-weight: 600;">${formatINR(g)} (${formatPercent(pct)})</span>`;
      })(),
      item.owner || "Me",
      `<div class="actions-wrapper">
        <button class="action-btn edit-btn edit-mutualFund-btn" data-id="${item.id}" title="Edit entry">✏️</button>
        <button class="action-btn delete-btn delete-mutualFund-btn" data-id="${item.id}" title="Delete entry">🗑️</button>
      </div>`
    ],
    `No mutual funds for ${activeHoldingsOwner}. Add a transaction or import a sheet.`,
    11
  );
}

function renderStocksPanel() {
  const summary = document.getElementById("stockOwnerSummary");
  const table = document.getElementById("stockTable");
  if (!table) return;

  const rows = state.stocks
    .filter((item) => matchHoldingsOwner(item.owner, activeHoldingsOwner))
    .sort((a, b) => stockMarketValue(b) - stockMarketValue(a));

  const invested = rows.reduce((total, row) => total + toNumber(row.invested), 0);
  const current = rows.reduce((total, row) => total + stockMarketValue(row), 0);
  const gain = current - invested;

  if (summary) {
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Invested (${activeHoldingsOwner})</div>
        <div class="value">${formatINR(invested)}</div>
        <div class="hint">${rows.length} holdings</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Market value</div>
        <div class="value">${formatINR(current)}</div>
        <div class="hint">${formatINR(gain)} ${gain >= 0 ? "gain" : "loss"}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Holdings</div>
        <div class="value">${rows.reduce((t, r) => t + toNumber(r.quantity), 0)}</div>
        <div class="hint">Total quantity</div>
      </article>
    `;
  }

  renderRows(
    table,
    rows,
    (item) => [
      item.symbol || "-",
      item.company,
      item.exchange || "-",
      item.quantity || 0,
      formatINR(item.avgPrice),
      formatINR(item.currentPrice),
      formatINR(stockMarketValue(item)),
      item.sector || "-",
      item.demat || "-",
      `<div class="actions-wrapper">
        <button class="action-btn edit-btn edit-stock-btn" data-id="${item.id}" title="Edit entry">✏️</button>
        <button class="action-btn delete-btn delete-stock-btn" data-id="${item.id}" title="Delete entry">🗑️</button>
      </div>`
    ],
    `No stocks for ${activeHoldingsOwner}. Add a holding or import a sheet.`,
    10
  );
}

function matchHoldingsOwner(owner, filter) {
  const normalized = normalizeOwner(owner || "Me");
  if (filter === "Both") return true;
  return normalized === filter || normalized === "Both";
}

function stockMarketValue(item) {
  return toNumber(item.quantity) * toNumber(item.currentPrice || item.avgPrice);
}

function investmentHoldingsTotal() {
  const mutualFunds = sum(state.mutualFunds, "currentValue");
  const stocks = state.stocks.reduce((total, item) => total + stockMarketValue(item), 0);
  return mutualFunds + stocks;
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
  let monthIncomeRows = state.income.filter((income) => isCurrentMonth(income.date));
  let isFallbackIncome = false;
  let fallbackMonthLabel = "";

  if (monthIncomeRows.length === 0 && state.income.length > 0) {
    const incomesByMonth = {};
    state.income.forEach((inc) => {
      const key = toMonthKey(inc.date);
      if (!key) return;
      if (!incomesByMonth[key]) incomesByMonth[key] = [];
      incomesByMonth[key].push(inc);
    });

    const sortedMonthKeys = Object.keys(incomesByMonth).sort().reverse();
    if (sortedMonthKeys.length > 0) {
      const latestMonthKey = sortedMonthKeys[0];
      monthIncomeRows = incomesByMonth[latestMonthKey];
      isFallbackIncome = true;

      const [year, month] = latestMonthKey.split("-").map(Number);
      const tempDate = new Date(year, month - 1, 1);
      fallbackMonthLabel = tempDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }
  }

  const monthExpenseRows = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const monthIncome = sum(monthIncomeRows, "amount");
  const monthExpenses = sum(monthExpenseRows, "amount");
  const assets = sum(state.assets, "value");
  const holdings = investmentHoldingsTotal();
  const liabilities = sum(state.liabilities, "value");
  const topExpenseCategory =
    Object.entries(groupSum(monthExpenseRows, (expense) => expense.category || "General", "amount")).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    monthIncome,
    monthExpenses,
    assets: assets + holdings,
    liabilities,
    netWorth: assets + holdings - liabilities,
    incomePeople: new Set(monthIncomeRows.map((income) => income.person || "Me")).size,
    savingsRate: monthIncome ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0,
    topExpenseCategory,
    isFallbackIncome,
    fallbackMonthLabel,
  };
}

function monthlyCashflow() {
  const now = new Date();
  const incomeByMonth = new Map();
  const expenseByMonth = new Map();
  state.income.forEach((item) => {
    const key = toMonthKey(item.date);
    if (!key) return;
    incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + toNumber(item.amount));
  });
  state.expenses.forEach((item) => {
    const key = toMonthKey(item.date);
    if (!key) return;
    expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + toNumber(item.amount));
  });

  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(date);
    months.push({
      key,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
      income: incomeByMonth.get(key) || 0,
      expenses: expenseByMonth.get(key) || 0,
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
      if (cell instanceof HTMLElement) {
        td.appendChild(cell);
      } else if (typeof cell === "string" && cell.trim().startsWith("<") && cell.trim().endsWith(">")) {
        td.innerHTML = cell;
      } else {
        td.textContent = cell || "-";
      }
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
  return calendarDateToISO(value) || "";
}

function calendarDateToISO(value) {
  const date = parseCalendarDate(value);
  return date ? dateToISODate(date) : "";
}

function parseCalendarDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === "number" && value > 20000 && value < 70000) {
    const excelEpoch = new Date(1899, 10, 30);
    const converted = new Date(excelEpoch.getTime() + value * 86400000);
    return new Date(converted.getFullYear(), converted.getMonth(), converted.getDate());
  }
  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    let year = Number(dmy[3]);
    if (year < 100) year += 2000;
    const first = Number(dmy[1]);
    const second = Number(dmy[2]);
    if (first > 12) return new Date(year, second - 1, first);
    if (second > 12) return new Date(year, first - 1, second);
    return new Date(year, second - 1, first);
  }
  const maybeMonth = text.match(/([a-zA-Z]+)[\s-]*(\d{4})/);
  if (maybeMonth) {
    const monthName = normalizeMonthName(maybeMonth[1]);
    const date = new Date(`${monthName} 1, ${maybeMonth[2]}`);
    if (!Number.isNaN(date.getTime())) return new Date(date.getFullYear(), date.getMonth(), 1);
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  return null;
}

function toMonthKey(value) {
  const date = parseCalendarDate(value);
  return date ? monthKey(date) : "";
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
  const date = parseCalendarDate(dateValue);
  if (!date) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatMonth(dateValue) {
  const date = parseCalendarDate(dateValue);
  if (!date) return "-";
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
  const left = parseCalendarDate(b.date || b.dueDate)?.getTime() || 0;
  const right = parseCalendarDate(a.date || a.dueDate)?.getTime() || 0;
  return left - right;
}

function isCurrentMonth(dateValue) {
  const date = parseCalendarDate(dateValue);
  const now = new Date();
  return Boolean(date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth());
}

function sameDay(dateA, dateB) {
  const first = calendarDateToISO(dateA);
  const second = calendarDateToISO(dateB);
  return Boolean(first && second && first === second);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function todayISO() {
  return dateToISODate(new Date());
}

function safeISODate(value) {
  return calendarDateToISO(value);
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

function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);
    buffer[6] = (buffer[6] & 0x0f) | 0x40;
    buffer[8] = (buffer[8] & 0x3f) | 0x80;
    const hex = Array.from(buffer).map((b) => b.toString(16).padStart(2, "0"));
    return (
      hex.slice(0, 4).join("") +
      "-" +
      hex.slice(4, 6).join("") +
      "-" +
      hex.slice(6, 8).join("") +
      "-" +
      hex.slice(8, 10).join("") +
      "-" +
      hex.slice(10, 16).join("")
    );
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Mutual Fund API Cache & Resolver Utilities
const MF_CACHE_EXPIRY = 12 * 60 * 60 * 1000; // 12 hours

function getFundCodesCache() {
  try {
    return JSON.parse(localStorage.getItem("lifeLedgerFundCodes") || "{}");
  } catch {
    return {};
  }
}

function saveFundCodesCache(cache) {
  try {
    localStorage.setItem("lifeLedgerFundCodes", JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to write fund codes cache:", e);
  }
}

function getNavCache() {
  try {
    return JSON.parse(localStorage.getItem("lifeLedgerNavCache:v1") || "{}");
  } catch {
    return {};
  }
}

function saveNavCache(cache) {
  try {
    localStorage.setItem("lifeLedgerNavCache:v1", JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to write NAV cache:", e);
  }
}

function inferAmc(fundName) {
  if (!fundName) return "";
  const parts = fundName.split(/\s+/);
  return parts[0] || "";
}

async function resolveSchemeCodes(fundNames) {
  if (!fundNames || fundNames.length === 0) return getFundCodesCache();
  const cache = getFundCodesCache();
  const missing = fundNames.filter(name => !cache[name]);
  
  if (missing.length === 0) return cache;
  
  toast("Fetching mutual fund master list to resolve codes...");
  try {
    const response = await fetch("https://api.mfapi.in/mf");
    if (!response.ok) throw new Error("Failed to fetch mutual fund master list.");
    const allFunds = await response.json();
    
    missing.forEach(query => {
      const queryWords = query.toLowerCase().replace(/[^a-z0-9\s]+/g, '').split(/\s+/).filter(w => w.length > 1);
      const amcWord = queryWords[0];
      let best = null;
      let bestScore = -Infinity;
      
      const isGrowthPreferred = !query.toLowerCase().includes('dividend') && !query.toLowerCase().includes('idcw');
      const isDirectPreferred = !query.toLowerCase().includes('regular');

      for (const scheme of allFunds) {
        const name = scheme.schemeName;
        const nameLower = name.toLowerCase();
        const schemeWords = nameLower.replace(/[^a-z0-9\s]+/g, '').split(/\s+/).filter(w => w.length > 1);
        
        if (amcWord && !schemeWords.includes(amcWord)) continue;
        
        const overlap = queryWords.filter(w => schemeWords.includes(w)).length;
        if (overlap === 0) continue;
        
        let score = (overlap * 100) - Math.abs(name.length - query.length);
        if (isGrowthPreferred && nameLower.includes('growth')) score += 50;
        if (isDirectPreferred && nameLower.includes('direct')) score += 20;

        if (score > bestScore) {
          bestScore = score;
          best = scheme;
        }
      }
      
      if (best) {
        cache[query] = {
          schemeCode: best.schemeCode,
          schemeName: best.schemeName
        };
      }
    });
    
    saveFundCodesCache(cache);
  } catch (err) {
    console.error("Failed to resolve scheme codes:", err);
    toast("Failed to resolve mutual fund codes. Using cached details.");
  }
  return cache;
}

async function refreshMutualFundNAVs(force = false) {
  const uniqueNames = [...new Set(state.mutualFunds.map(item => item.fundName).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  try {
    const codesCache = await resolveSchemeCodes(uniqueNames);
    const schemeCodes = uniqueNames.map(name => codesCache[name]?.schemeCode).filter(Boolean);
    
    if (schemeCodes.length === 0) return;
    
    toast("Refreshing mutual fund Net Asset Values...");
    const navCache = getNavCache();
    const now = Date.now();
    let updatedCount = 0;
    
    for (const code of schemeCodes) {
      const cached = navCache[code];
      if (!force && cached && (now - cached.timestamp < MF_CACHE_EXPIRY)) {
        continue;
      }
      
      try {
        const response = await fetch(`https://api.mfapi.in/mf/${code}/latest`);
        if (!response.ok) continue;
        const json = await response.json();
        if (json && json.status === "SUCCESS" && json.data && json.data[0]) {
          navCache[code] = {
            nav: toNumber(json.data[0].nav),
            date: json.data[0].date,
            timestamp: now
          };
          updatedCount += 1;
        }
        await new Promise(r => setTimeout(r, 50));
      } catch (e) {
        console.warn(`Failed to fetch NAV for ${code}:`, e);
      }
    }
    
    if (updatedCount > 0 || force) {
      saveNavCache(navCache);
      toast(updatedCount > 0 ? `Refreshed ${updatedCount} NAVs.` : "NAVs are up to date.");
      
      state.mutualFunds.forEach(item => {
        const cachedCodeObj = codesCache[item.fundName];
        if (cachedCodeObj) {
          const cachedNavObj = navCache[cachedCodeObj.schemeCode];
          if (cachedNavObj) {
            item.latestNav = cachedNavObj.nav;
            item.currentValue = toNumber(item.units) * cachedNavObj.nav;
          }
        }
      });
      await saveData(true);
      renderMutualFundsPanel();
    }
  } catch (err) {
    console.error("Failed to refresh mutual fund NAVs:", err);
  }
}


