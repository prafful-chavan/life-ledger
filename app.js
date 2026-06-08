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
  fd: [],
  epf: [],
  bonds: [],
  ppf: [],
  gold: [],
  silver: [],
  crypto: [],
  usstocks: [],
  banksaving: [],
  others: [],
  goals: [],
  tasks: [],
  studies: [],
  workouts: [],
  habits: [],
  chat: [],
  mfMonthlyTarget: { me: 100000, wife: 100000 },
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
      owner: "Both",
      target: 900000,
      saved: 420000,
      dueDate: "2026-12-31",
    },
    {
      id: "goal-2",
      name: "Wife tech certifications",
      category: "Career",
      owner: "Wife",
      target: 50000,
      saved: 15000,
      dueDate: "2026-09-30",
    },
    {
      id: "goal-3",
      name: "Family trip fund",
      category: "Family",
      owner: "Both",
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
    { id: "study-1", topic: "Kubernetes (K8s) Orchestration", status: "In progress", confidence: 75, hours: 30, targetHours: 50, owner: "Me" },
    { id: "study-2", topic: "Terraform & Infrastructure as Code", status: "In progress", confidence: 60, hours: 15, targetHours: 30, owner: "Me" },
    { id: "study-3", topic: "MLOps Pipelines (MLflow & DVC)", status: "Planned", confidence: 20, hours: 2, targetHours: 25, owner: "Me" },
    { id: "study-4", topic: "GitHub Actions & CI/CD automation", status: "Completed", confidence: 90, hours: 20, targetHours: 20, owner: "Me" },
    { id: "study-5", topic: "Apache Spark & PySpark Big Data", status: "In progress", confidence: 65, hours: 25, targetHours: 40, owner: "Wife" },
    { id: "study-6", topic: "Airflow Workflow Orchestration", status: "In progress", confidence: 50, hours: 12, targetHours: 24, owner: "Wife" },
    { id: "study-7", topic: "ETL Pipelines & DBT (Data Build Tool)", status: "Planned", confidence: 10, hours: 0, targetHours: 20, owner: "Wife" },
    { id: "study-8", topic: "SQL Optimization & Snowflake / BigQuery", status: "Completed", confidence: 85, hours: 15, targetHours: 15, owner: "Wife" },
  ],
  workouts: [
    { id: "work-1", date: todayISO(), type: "Walk", minutes: 30, intensity: "Easy" },
    { id: "work-2", date: daysAgoISO(1), type: "Strength", minutes: 45, intensity: "Medium" },
    { id: "work-3", date: daysAgoISO(3), type: "Yoga", minutes: 25, intensity: "Easy" },
  ],
  habits: [
    { id: "habit-1", name: "Read 10 pages", frequency: "Daily", owner: "Me", streak: 5 },
    { id: "habit-2", name: "Morning 30m Walk", frequency: "Daily", owner: "Wife", streak: 8 },
    { id: "habit-3", name: "Code & Track SRE roadmap", frequency: "Daily", owner: "Me", streak: 12 },
    { id: "habit-4", name: "ETL pipeline review", frequency: "Weekly", owner: "Wife", streak: 3 },
  ],
  chat: [],
};

let state = clone(defaultData);
let activeView = "dashboard";
let activeFinanceTab = "overview";
let activeHoldingsOwner = "Me";
let activeMfView = "holdings";
let activeExpenseMonth = "";
let activeExpensePage = 0;
let expenseMonthIndexCache = null;
let activeExpenseOwner = "Both";
let activeDashboardMonth = "";
let quickAddKind = "expense";

const assistantWelcome =
  "Hey Prafful! 👋 I'm your personal Life Ledger AI. I know everything about your finances, investments, career roadmap, habits, goals, and daily tasks — for both you and your wife.\n\nTry asking me things like:\n• How much did we save this month?\n• What's my net worth?\n• How is my gold and crypto doing?\n• How is my DevOps roadmap going?\n• What habits am I tracking?\n• What are my pending tasks?\n• How are our goals looking?";

const fieldsByKind = {
  income: [
    ["date", "Date", "date"],
    ["person", "Person", "select"],
    ["source", "Source / company", "text"],
    ["type", "Type", "text"],
    ["grossEarnings", "Gross salary", "number"],
    ["amount", "Net in-hand", "number"],
    ["taxTds", "Tax / TDS", "number"],
    ["basicSalary", "Basic salary", "number"],
    ["hra", "HRA", "number"],
    ["pf", "PF", "number"],
  ],
  expense: [
    ["date", "Date", "date"],
    ["category", "Category", "text"],
    ["paidBy", "Paid by", "select"],
    ["amount", "Amount", "number"],
    ["note", "Note", "textarea"],
  ],
  asset: [
    ["name", "Asset name", "text"],
    ["category", "Category", "text"],
    ["owner", "Owner", "select"],
    ["value", "Current value", "number"],
  ],
  liability: [
    ["name", "Liability name", "text"],
    ["category", "Category", "text"],
    ["owner", "Owner", "select"],
    ["value", "Outstanding value", "number"],
  ],
  goal: [
    ["name", "Goal name", "text"],
    ["category", "Category", "text"],
    ["owner", "Owner", "select"], // Me, Wife, Both
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
    ["status", "Status", "select"], // Planned, In progress, Completed
    ["owner", "Engineer", "select"], // Me (SRE/DevOps), Wife (ETL/Data Eng)
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
  habit: [
    ["name", "Habit name", "text"],
    ["frequency", "Frequency", "select"], // Daily, Weekly
    ["owner", "Person", "select"], // Me, Wife, Both
    ["streak", "Starting streak", "number"],
  ],
  mutualFund: [
    ["owner", "Owner (Me / Wife)", "select"],
    ["fundName", "Fund name", "text"],
    ["transactionType", "Transaction type (PURCHASE / REDEMPTION)", "select"],
    ["units", "Units", "number"],
    ["nav", "Purchase NAV", "number"],
    ["invested", "Amount invested", "number"],
    ["purchaseDate", "Purchase Date", "date"],
    ["folio", "Folio no.", "text"],
    ["platform", "Platform (Groww / Kuvera / etc.)", "text"],
    ["notes", "Notes", "textarea"],
  ],
  stock: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  fd: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  epf: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  bonds: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  ppf: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  gold: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  silver: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  crypto: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  usstocks: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  banksaving: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
  others: [
    ["date", "Date", "date"],
    ["owner", "Paid by", "select"],
    ["value", "Current value", "number"],
    ["note", "Note", "textarea"],
  ],
};

const resetScopes = {
  income: { label: "salary / income", keys: ["income"] },
  expenses: { label: "expenses", keys: ["expenses"] },
  networth: { label: "assets and liabilities", keys: ["assets", "liabilities"] },
  holdings: { label: "mutual funds, stocks and simple assets", keys: ["mutualFunds", "stocks", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others"] },
  finance: {
    label: "all finance data",
    keys: ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others"],
  },
  mutualfunds: { label: "mutual funds", keys: ["mutualFunds"] },
  stocks: { label: "stocks and simple assets", keys: ["stocks", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others"] },
  studies: { label: "interview prep", keys: ["studies"] },
  goals: { label: "future goals", keys: ["goals"] },
  tasks: { label: "daily to-do", keys: ["tasks"] },
  workouts: { label: "exercise logs", keys: ["workouts"] },
  habits: { label: "habit tracker", keys: ["habits"] },
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

let isAppInitialized = false;

function bootstrapApp(initialState) {
  state = normalizeData(initialState || defaultData);
  if (!isAppInitialized) {
    bindTheme();
    bindNavigation();
    bindModals();
    bindFinanceTabs();
    bindCareerTabs();
    bindImports();
    bindReset();
    bindChat();
    bindExport();
    bindDashboard();
    bindGoals();
    bindTodoAndKeepEvents();
    bindExerciseEvents();
    bindHabitsEvents();
    isAppInitialized = true;
  }
  renderAll();
  refreshMutualFundNAVs(false);
}

window.LifeLedgerApp = {
  defaultData: () => clone(defaultData),
  bootstrap: bootstrapApp,
  saveData: saveData,
  flushSave: () => {
    if (saveDataTimer) {
      return saveData(true);
    }
    return currentSavePromise || Promise.resolve();
  }
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
  const buttons = document.querySelectorAll("#themeToggle, #settingsThemeToggle");
  buttons.forEach(button => {
    button.textContent = normalizedTheme === "dark" ? "Light mode" : "Dark mode";
    button.setAttribute("aria-pressed", String(normalizedTheme === "dark"));
  });
}

function normalizeData(data) {
  return {
    ...clone(defaultData),
    ...data,
    income: ensureIds(data.income || [], "inc"),
    expenses: ensureIds(data.expenses || [], "exp").map(exp => ({ ...exp, amount: Math.abs(toNumber(exp.amount)) })),
    assets: ensureIds(data.assets || [], "asset"),
    liabilities: ensureIds(data.liabilities || [], "liab"),
    mutualFunds: ensureIds(data.mutualFunds || [], "mf"),
    stocks: ensureIds(data.stocks || [], "stk"),
    fd: ensureIds(data.fd || [], "fd"),
    epf: ensureIds(data.epf || [], "epf"),
    bonds: ensureIds(data.bonds || [], "bond"),
    ppf: ensureIds(data.ppf || [], "ppf"),
    gold: ensureIds(data.gold || [], "gold"),
    silver: ensureIds(data.silver || [], "slv"),
    crypto: ensureIds(data.crypto || [], "crp"),
    usstocks: ensureIds(data.usstocks || [], "uss"),
    banksaving: ensureIds(data.banksaving || [], "sav"),
    others: ensureIds(data.others || [], "oth"),
    goals: ensureIds(data.goals || [], "goal").map(g => ({ ...g, owner: g.owner || "Both" })),
    tasks: ensureIds(data.tasks || [], "task"),
    studies: ensureIds(data.studies || [], "study").map(s => ({ ...s, owner: s.owner || "Me" })),
    workouts: ensureIds(data.workouts || [], "work"),
    habits: ensureIds(data.habits || [], "habit"),
    chat: data.chat || [],
    mfMonthlyTarget: data.mfMonthlyTarget || { me: 100000, wife: 100000 },
  };
}

function ensureIds(items, prefix) {
  return items.map((item) => ({ ...item, id: item.id || `${prefix}-${generateUUID()}` }));
}

function bindTheme() {
  applyTheme(loadTheme());
  document.querySelectorAll("#themeToggle, #settingsThemeToggle").forEach(button => {
    button.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      saveTheme(nextTheme);
      renderCashflowChart();
    });
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

  document.getElementById("expenseSearchInput")?.addEventListener("input", () => {
    activeExpensePage = 0;
    renderExpenseExplorer(false);
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
        renderIncomeTable();
        toast("Salary entry deleted.");
        saveData(true);
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
        renderMutualFundsPanel();
        toast("Mutual fund transaction deleted.");
        saveData(true);
      }
    }
  });

  document.addEventListener("click", async (event) => {
    const editBtn = event.target.closest(".edit-btn");
    const deleteBtn = event.target.closest(".delete-btn");
    if (editBtn) {
      const id = editBtn.dataset.id;
      const kind = editBtn.dataset.kind;
      if (id && kind) {
        buildQuickAddForm(kind, id);
        openModal("quickAddModal");
      }
    } else if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      const kind = deleteBtn.dataset.kind;
      if (id && kind) {
        const stateKeys = {
          stock: "stocks",
          fd: "fd",
          epf: "epf",
          bonds: "bonds",
          ppf: "ppf",
          gold: "gold",
          silver: "silver",
          crypto: "crypto",
          usstocks: "usstocks",
          banksaving: "banksaving",
          others: "others",
          liability: "liabilities",
          goal: "goals",
          task: "tasks",
          workout: "workouts",
          study: "studies",
          habit: "habits"
        };
        const stateKey = stateKeys[kind];
        if (stateKey && confirm(`Are you sure you want to delete this ${kind} entry?`)) {
          state[stateKey] = (state[stateKey] || []).filter(item => item.id !== id);
          renderAll();
          toast(`${kind.charAt(0).toUpperCase() + kind.slice(1)} entry deleted.`);
          saveData(true);
        }
      }
    }
  });

  document.getElementById("refreshMutualFundNAVsBtn")?.addEventListener("click", async () => {
    await refreshMutualFundNAVs(true);
  });

  document.getElementById("syncExpensesFromDriveBtn")?.addEventListener("click", () => {
    syncExpensesFromDrive();
  });

  const mfHoldingsBtn = document.getElementById("toggleMfViewHoldings");
  const mfTxnsBtn = document.getElementById("toggleMfViewTxns");
  const mfInsightsBtn = document.getElementById("toggleMfViewInsights");
  
  mfHoldingsBtn?.addEventListener("click", () => {
    activeMfView = "holdings";
    mfHoldingsBtn.classList.add("active");
    mfTxnsBtn?.classList.remove("active");
    mfInsightsBtn?.classList.remove("active");
    const tableWrap = document.querySelector('#finance-mutualfunds .table-wrap');
    const insightsPanel = document.getElementById('mfInsightsPanel');
    if (tableWrap) tableWrap.style.display = '';
    if (insightsPanel) insightsPanel.style.display = 'none';
    renderMutualFundsPanel();
  });
  
  mfTxnsBtn?.addEventListener("click", () => {
    activeMfView = "txns";
    mfTxnsBtn.classList.add("active");
    mfHoldingsBtn?.classList.remove("active");
    mfInsightsBtn?.classList.remove("active");
    const tableWrap = document.querySelector('#finance-mutualfunds .table-wrap');
    const insightsPanel = document.getElementById('mfInsightsPanel');
    if (tableWrap) tableWrap.style.display = '';
    if (insightsPanel) insightsPanel.style.display = 'none';
    renderMutualFundsPanel();
  });

  mfInsightsBtn?.addEventListener("click", () => {
    activeMfView = "insights";
    mfInsightsBtn.classList.add("active");
    mfHoldingsBtn?.classList.remove("active");
    mfTxnsBtn?.classList.remove("active");
    const tableWrap = document.querySelector('#finance-mutualfunds .table-wrap');
    const insightsPanel = document.getElementById('mfInsightsPanel');
    if (tableWrap) tableWrap.style.display = 'none';
    if (insightsPanel) insightsPanel.style.display = '';
    renderMfInsightsPanel();
  });

  document.querySelectorAll("[data-holdings-owner]").forEach((button) => {
    button.addEventListener("click", () => {
      activeHoldingsOwner = button.dataset.holdingsOwner;
      document.querySelectorAll("[data-holdings-owner]").forEach((tab) => {
        if (tab.dataset.holdingsOwner === activeHoldingsOwner) {
          tab.classList.add("active");
        } else {
          tab.classList.remove("active");
        }
      });
      renderHoldingsTabs();
    });
  });

  document.querySelectorAll("[data-expense-owner]").forEach((button) => {
    button.addEventListener("click", () => {
      activeExpenseOwner = button.dataset.expenseOwner;
      document.querySelectorAll("[data-expense-owner]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      activeExpensePage = 0;
      renderExpenseExplorer(false);
    });
  });

  const toggleTrendSalary = document.getElementById("toggleTrendSalary");
  const toggleTrendExpenses = document.getElementById("toggleTrendExpenses");
  const salaryTrendContent = document.getElementById("salaryTrendContent");
  const expenseAnalysisArea = document.getElementById("expenseAnalysisArea");
  const trendSectionTitle = document.getElementById("trendSectionTitle");
  const trendSectionDesc = document.getElementById("trendSectionDesc");
  const latestSalaryBadge = document.getElementById("latestSalaryBadge");
  
  toggleTrendSalary?.addEventListener("click", () => {
    toggleTrendSalary.classList.add("active");
    toggleTrendExpenses?.classList.remove("active");
    if (salaryTrendContent) salaryTrendContent.style.display = "block";
    if (expenseAnalysisArea) expenseAnalysisArea.style.display = "none";
    if (trendSectionTitle) trendSectionTitle.textContent = "Salary progression";
    if (trendSectionDesc) trendSectionDesc.textContent = "Monthly gross and net in-hand salary across your organizations from 2018 onward.";
    if (latestSalaryBadge) latestSalaryBadge.style.display = "inline-flex";
  });
  
  toggleTrendExpenses?.addEventListener("click", () => {
    toggleTrendExpenses.classList.add("active");
    toggleTrendSalary?.classList.remove("active");
    if (salaryTrendContent) salaryTrendContent.style.display = "none";
    if (expenseAnalysisArea) expenseAnalysisArea.style.display = "block";
    if (trendSectionTitle) trendSectionTitle.textContent = "Expense Pro Analysis";
    if (trendSectionDesc) trendSectionDesc.textContent = "Detailed breakdown of all-time expenses, biggest purchases, and budget optimizations.";
    if (latestSalaryBadge) latestSalaryBadge.style.display = "none";
    renderExpensesAnalysis();
  });
}

function bindCareerTabs() {
  document.querySelectorAll("[data-career-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeCareerTab = button.dataset.careerTab;
      document.querySelectorAll("[data-career-tab]").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".career-tab").forEach((tab) => tab.classList.remove("active"));
      document.getElementById(`career-${activeCareerTab}`)?.classList.add("active");
      renderCareer();
    });
  });

  const careerAddBtn = document.getElementById("careerAddBtn");
  careerAddBtn?.addEventListener("click", () => {
    const kind = careerAddBtn.dataset.kind || "study";
    buildQuickAddForm(kind);
    openModal("quickAddModal");
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
  document.querySelectorAll("#exportDataButton, #settingsExportDataButton").forEach(btn => {
    btn.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `life-ledger-backup-${todayISO()}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast("Backup exported.");
    });
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
  renderAll();
  toast("Expense deleted.");

  try {
    saveData(true);
  } catch (error) {
    console.error("Failed to delete expense:", error);
  }
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
    fd: editId ? "Edit FD" : "Add FD",
    epf: editId ? "Edit EPF" : "Add EPF",
    bonds: editId ? "Edit bond" : "Add bond",
    ppf: editId ? "Edit PPF" : "Add PPF",
    gold: editId ? "Edit gold" : "Add gold",
    silver: editId ? "Edit silver" : "Add silver",
    crypto: editId ? "Edit crypto" : "Add crypto",
    usstocks: editId ? "Edit US Stock" : "Add US Stock",
    banksaving: editId ? "Edit Bank Saving" : "Add Bank Saving",
    others: editId ? "Edit other asset" : "Add other asset",
    goal: editId ? "Edit goal" : "Add goal",
    task: editId ? "Edit task" : "Add task",
    study: editId ? "Edit study topic" : "Add study topic",
    workout: editId ? "Edit workout" : "Log workout",
    habit: editId ? "Edit habit" : "Add habit",
  };

  title.textContent = labels[kind] || (editId ? "Edit entry" : "Add entry");
  const fields = fieldsByKind[kind] || fieldsByKind.expense;
  form.innerHTML = "";

  let existingEntry = null;
  let collection = [];
  if (editId) {
    const simpleAssetKeys = {
      stock: "stocks",
      fd: "fd",
      epf: "epf",
      bonds: "bonds",
      ppf: "ppf",
      gold: "gold",
      silver: "silver",
      crypto: "crypto",
      usstocks: "usstocks",
      banksaving: "banksaving",
      others: "others"
    };

    if (kind === "expense") collection = state.expenses;
    else if (kind === "income") collection = state.income;
    else if (kind === "asset") collection = state.assets;
    else if (kind === "liability") collection = state.liabilities;
    else if (kind === "mutualFund") collection = state.mutualFunds;
    else if (simpleAssetKeys[kind]) collection = state[simpleAssetKeys[kind]];
    else if (kind === "goal") collection = state.goals;
    else if (kind === "task") collection = state.tasks;
    else if (kind === "study") collection = state.studies;
    else if (kind === "workout") collection = state.workouts;
    else if (kind === "habit") collection = state.habits;

    if (collection) {
      existingEntry = collection.find(item => item.id === editId);
    }
  }

  fields.forEach(([name, label, type]) => {
    const wrapper = document.createElement("label");
    if (type === "textarea") wrapper.classList.add("full-span");
    wrapper.textContent = label;

    let input;
    if (type === "select") {
      input = document.createElement("select");
      input.name = name;
      let options = [];
      if (name === "person" || name === "owner" || name === "paidBy") {
        const needsBoth = (kind === "asset" || kind === "liability" || kind === "expense" || kind === "goal" || kind === "habit" || [
          "stock", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others"
        ].includes(kind));
        options = needsBoth ? ["Me", "Wife", "Both"] : ["Me", "Wife"];
      } else if (name === "transactionType") {
        options = ["PURCHASE", "REDEMPTION"];
      } else if (name === "status") {
        options = ["Planned", "In progress", "Completed"];
      } else if (name === "frequency") {
        options = ["Daily", "Weekly"];
      } else {
        options = ["Me", "Wife", "Both"];
      }
      options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        input.append(option);
      });
    } else if (type === "textarea") {
      input = document.createElement("textarea");
      input.name = name;
    } else {
      input = document.createElement("input");
      input.name = name;
      input.type = type === "checkbox" ? "checkbox" : type;
      if (type === "number") input.inputMode = "decimal";
    }

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

    const isSimpleAsset = ["stock", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "usstocks", "banksaving", "others"].includes(kind);

    if (kind === "mutualFund") {
      entry.owner = normalizeOwner(entry.owner);
      entry.amc = inferAmc(entry.fundName);
      if (!entry.latestNav) entry.latestNav = entry.nav;
      if (!entry.currentValue) entry.currentValue = entry.invested;
    }
    if (isSimpleAsset) {
      entry.owner = normalizeOwner(entry.owner || entry.paidBy);
    }
    if (kind === "expense") {
      entry.paidBy = normalizeOwner(entry.paidBy);
    }
    if (kind === "income") {
      entry.person = normalizeOwner(entry.person);
      entry.netSalary = entry.amount;
      entry.organization = entry.source;
      
      // Build components and deductions maps for complete consistency with Excel/CSV parsed records
      entry.components = {};
      salaryComponentFields.forEach(([key]) => {
        if (entry[key] !== undefined) {
          entry.components[key] = entry[key];
        }
      });
      entry.deductions = {};
      deductionFields.forEach(([key]) => {
        if (entry[key] !== undefined) {
          entry.deductions[key] = entry[key];
        }
      });
    }
    if (kind === "asset" || kind === "liability" || kind === "goal" || kind === "study") {
      entry.owner = normalizeOwner(entry.owner);
    }
    if (kind === "habit") {
      entry.owner = normalizeOwner(entry.owner);
      if (!entry.history) entry.history = [];
      if (entry.streak === undefined) entry.streak = 0;
      if (entry.bestStreak === undefined) entry.bestStreak = entry.streak;
    }

    if (existingEntry) {
      const idx = collection.findIndex(item => item.id === editId);
      if (idx !== -1) {
        collection[idx] = entry;
      }
    } else {
      if (kind === "expense") state.expenses.push(entry);
      else if (kind === "income") state.income.push(entry);
      else if (kind === "asset") state.assets.push(entry);
      else if (kind === "liability") state.liabilities.push(entry);
      else if (kind === "mutualFund") state.mutualFunds.push(entry);
      else if (kind === "goal") state.goals.push(entry);
      else if (kind === "task") state.tasks.push(entry);
      else if (kind === "study") state.studies.push(entry);
      else if (kind === "workout") state.workouts.push(entry);
      else if (kind === "habit") state.habits.push(entry);
      else {
        const simpleAssetKeys = {
          stock: "stocks",
          fd: "fd",
          epf: "epf",
          bonds: "bonds",
          ppf: "ppf",
          gold: "gold",
          silver: "silver",
          crypto: "crypto",
          usstocks: "usstocks",
          banksaving: "banksaving",
          others: "others"
        };
        const stateKey = simpleAssetKeys[kind];
        if (stateKey) {
          if (!state[stateKey]) state[stateKey] = [];
          state[stateKey].push(entry);
        }
      }
    }

    invalidateExpenseCache();
    renderAll();
    closeModal(form.closest(".modal"));
    toast(existingEntry ? "Entry updated." : "Entry saved.");
    saveData(true);
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

async function syncExpensesFromDrive() {
  if (!window.LifeLedgerDrive || !window.LifeLedgerDrive.isConnected()) {
    toast("Please connect Google Drive in the settings panel first.");
    return;
  }

  const btn = document.getElementById("syncExpensesFromDriveBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "☁ Syncing...";
  }

  toast("Scanning Google Drive for latest expense files...");

  const owners = ["Me", "Wife"];
  let filesFound = 0;
  let allNewExpenses = [];

  try {
    for (const owner of owners) {
      const fileData = await window.LifeLedgerDrive.downloadLatestExpenseFile(owner);
      if (fileData) {
        filesFound++;
        console.log(`[app.js] Found and downloaded latest file for ${owner}: "${fileData.filename}"`);
        
        const mockFile = {
          name: fileData.filename,
          text: async () => {
            const td = new TextDecoder();
            return td.decode(fileData.buffer);
          },
          arrayBuffer: () => Promise.resolve(fileData.buffer)
        };

        const imported = await parseImportFile(mockFile, "expense");
        console.log(`[app.js] Parsed file for ${owner}: ${imported?.expenses?.length ?? 0} expenses extracted`);
        if (imported && imported.expenses && imported.expenses.length > 0) {
          imported.expenses.forEach(exp => {
            exp.paidBy = owner;
            allNewExpenses.push(exp);
          });
        } else {
          // Log the raw CSV text headers for debugging
          try {
            const rawText = await mockFile.text();
            const firstLine = rawText.split('\n')[0];
            console.warn(`[app.js] WARNING: 0 expenses parsed for ${owner}. CSV headers: "${firstLine}"`);
          } catch(e) {}
        }
      }
    }

    if (filesFound === 0) {
      toast("No expense files matching 'Transactions*.csv/xlsx' found on Google Drive.");
    } else {
      state.expenses = allNewExpenses;
      invalidateExpenseCache();
      renderAll();
      await saveData(true);
      toast(`✓ Synced successfully! Loaded ${allNewExpenses.length} total expenses from ${filesFound} files.`);
    }
  } catch (error) {
    console.error("[app.js] Expense sync failed:", error);
    toast(`Sync failed: ${error.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "☁ Sync from Drive";
    }
  }
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
    habits: [],
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
    const amount = pickNumber(row, ["amount", "transactionamount", "totalamount", "expense", "spend", "cost", "debit", "price", "value", "money", "sum", "total", "payment"]);
    const date = pickDate(row, ["date", "month", "spentdate", "transactiondate", "createddate", "time", "datetime", "timestamp"]);
    if (!amount && !date) return null;
    return {
      id: `exp-${generateUUID()}`,
      date: date || todayISO(),
      category: pick(row, ["category", "expensecategory", "type", "tag", "group", "subcategory", "label"]) || "General",
      paidBy: normalizeOwner(pick(row, ["paidby", "person", "payer", "owner"]) || "Both"),
      amount: Math.abs(amount),
      note: pick(row, ["note", "description", "merchant", "remarks", "title", "name", "memo", "details", "particular", "narration", "payee", "vendor", "store", "shop", "item"]) || "",
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
  // Deduplicated merge for expenses
  const existingExpenses = state.expenses || [];
  const pool = [...existingExpenses];
  normalized.expenses.forEach(incoming => {
    const matchIndex = pool.findIndex(existing => 
      existing.date === incoming.date &&
      Math.abs(toNumber(existing.amount) - toNumber(incoming.amount)) < 0.01 &&
      (existing.note || "").trim().toLowerCase() === (incoming.note || "").trim().toLowerCase() &&
      normalizeOwner(existing.paidBy) === normalizeOwner(incoming.paidBy)
    );
    if (matchIndex >= 0) {
      pool.splice(matchIndex, 1);
    } else {
      existingExpenses.push(incoming);
    }
  });
  appendArray(state.assets, normalized.assets);
  appendArray(state.liabilities, normalized.liabilities);
  appendArray(state.mutualFunds, normalized.mutualFunds);
  appendArray(state.stocks, normalized.stocks);
  appendArray(state.goals, normalized.goals);
  appendArray(state.tasks, normalized.tasks);
  appendArray(state.studies, normalized.studies);
  appendArray(state.workouts, normalized.workouts);
  appendArray(state.habits, normalized.habits);
  
  // Merge simple asset types
  appendArray(state.fd, normalized.fd);
  appendArray(state.epf, normalized.epf);
  appendArray(state.bonds, normalized.bonds);
  appendArray(state.ppf, normalized.ppf);
  appendArray(state.gold, normalized.gold);
  appendArray(state.silver, normalized.silver);
  appendArray(state.crypto, normalized.crypto);
  appendArray(state.usstocks, normalized.usstocks);
  appendArray(state.banksaving, normalized.banksaving);
  appendArray(state.others, normalized.others);
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
  updateMutualFundsFromCache();
  renderDashboardPeriodSelector();
  renderMetrics();
  renderCashflowChart();
  renderExpenseMix();
  renderNetWorth();
  renderTodayFocus();
  renderFinance();
  renderCareer();
  renderGoals();
  renderTodoView();
  renderExerciseView();
  renderHabitsView();
  renderDashboardAnalysis();
  renderChat();
}

function renderMetrics() {
  const metrics = calculateMetrics();
  const metricGrid = document.getElementById("metricGrid");
  metricGrid.innerHTML = "";
  [
    {
      label: "Net worth",
      value: formatINR(metrics.netWorth),
      hint: `Investment holdings − liabilities`,
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
  const incomeColor = cssVar("--chart-income") || cssVar("--brand");
  const expenseColor = cssVar("--chart-expense") || cssVar("--accent");
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
    <polyline points="${expensePoints}" fill="none" stroke="${expenseColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    <polyline points="${incomePoints}" fill="none" stroke="${incomeColor}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
    ${months
      .map(
        (month, index) => `
          <circle cx="${x(index)}" cy="${y(month.income)}" r="4" fill="${incomeColor}"></circle>
          <circle cx="${x(index)}" cy="${y(month.expenses)}" r="4" fill="${expenseColor}"></circle>
          <text x="${x(index)}" y="${height - 12}" text-anchor="middle" fill="${mutedColor}" font-size="12">${month.label}</text>
        `
      )
      .join("")}
    <g transform="translate(${width - 208}, 18)">
      <circle cx="0" cy="0" r="5" fill="${incomeColor}"></circle>
      <text x="10" y="4" fill="${inkColor}" font-size="13" font-weight="700">Income</text>
      <circle cx="90" cy="0" r="5" fill="${expenseColor}"></circle>
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
  const currentExpenses = state.expenses.filter((expense) => isTargetDashboardMonth(expense.date));
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
  const holdings = investmentHoldingsTotal();
  const liabilities = sum(state.liabilities, "value");
  const netWorth = holdings - liabilities;
  const maxValue = Math.max(holdings, liabilities, Math.abs(netWorth), 1);
  container.innerHTML = "";
  [
    ["Investments", holdings, "bar-fill blue"],
    ["Liabilities", liabilities, "bar-fill red"],
    ["Net worth", netWorth, "bar-fill purple"],
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

function renderDashboardAnalysis() {
  // 1. Goal progression
  const goalContainer = document.getElementById("dashboardGoalAnalysis");
  if (goalContainer) {
    goalContainer.innerHTML = "";
    if (state.goals.length === 0) {
      goalContainer.innerHTML = `<div class="empty-state">No goals set yet.</div>`;
    } else {
      // Calculate overall progress stats
      let totalTarget = 0;
      let totalSaved = 0;
      state.goals.forEach(g => {
        totalTarget += (g.target || 0);
        totalSaved += (g.saved || 0);
      });
      const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

      // Stats banner inside the progression card
      const statsBanner = document.createElement("div");
      statsBanner.style.display = "flex";
      statsBanner.style.justifyContent = "space-between";
      statsBanner.style.background = "var(--input-bg)";
      statsBanner.style.padding = "8px 12px";
      statsBanner.style.borderRadius = "var(--radius)";
      statsBanner.style.marginBottom = "12px";
      statsBanner.style.fontSize = "12px";
      statsBanner.style.fontWeight = "700";
      statsBanner.style.border = "1px solid var(--line)";
      statsBanner.innerHTML = `
        <span style="color:var(--muted)">Saved: <strong style="color:var(--ink)">${formatINR(totalSaved)}</strong></span>
        <span style="color:var(--brand)">${overallPct}% complete</span>
      `;
      goalContainer.append(statsBanner);

      // List top 3 upcoming, active goals
      const activeGoals = state.goals
        .filter(g => (g.saved || 0) < (g.target || 1) || (g.target || 0) === 0)
        .sort((a, b) => new Date(a.dueDate || "2999-12-31") - new Date(b.dueDate || "2999-12-31"))
        .slice(0, 3);

      if (activeGoals.length === 0) {
        goalContainer.innerHTML += `<div class="empty-state">🎉 All goals completed!</div>`;
      } else {
        activeGoals.forEach((goal) => {
          const progress = clamp(((goal.saved || 0) / Math.max(1, goal.target || 1)) * 100, 0, 100);
          const timeInfo = calculateTimeRemaining(goal.dueDate);
          const catConfig = getGoalCategoryConfig(goal.category);
          
          const row = document.createElement("div");
          row.style.marginBottom = "12px";
          row.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:4px; font-weight:700;">
              <span style="color:var(--ink);">${catConfig.emoji} ${escapeHTML(goal.name)}</span>
              <span style="color:var(--muted); font-size:11px;">${Math.round(progress)}%</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; margin-bottom:6px; color:var(--muted);">
              <span>${formatINR(goal.saved)} / ${formatINR(goal.target)}</span>
              <span class="${timeInfo.class}" style="font-weight:600; padding:2px 6px; border-radius:4px; background:var(--bg); border:1px solid var(--line);">${timeInfo.text}</span>
            </div>
            <div class="goal-progress-bar-track" style="margin-bottom:0; height:6px;">
              <div class="goal-progress-bar-fill" style="width:${progress}%;"></div>
            </div>
          `;
          goalContainer.append(row);
        });
      }
    }
  }

  // 2. Habit streaks
  const habitContainer = document.getElementById("dashboardHabitAnalysis");
  if (habitContainer) {
    habitContainer.innerHTML = "";
    if (state.habits.length === 0) {
      habitContainer.innerHTML = `<div class="empty-state">No habits tracked yet.</div>`;
    } else {
      state.habits.slice(0, 3).forEach((habit) => {
        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";
        row.style.marginBottom = "8px";
        row.innerHTML = `
          <div style="font-size:12px;">
            <strong>${escapeHTML(habit.name)}</strong>
            <div class="stack-meta">${escapeHTML(habit.frequency)} · ${escapeHTML(habit.owner)}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; font-weight:700; color:#f59e0b;">🔥 ${habit.streak || 0}</span>
            <button class="log-habit-btn" type="button" style="padding:2px 8px; font-size:11px;" data-id="${habit.id}">+1</button>
          </div>
        `;
        row.querySelector(".log-habit-btn").addEventListener("click", async () => {
          habit.streak = (toNumber(habit.streak) || 0) + 1;
          renderAll();
          toast(`Streaked! ${habit.name} streak is now ${habit.streak}. 🔥`);
          saveData(true);
        });
        habitContainer.append(row);
      });
    }
  }

  // 3. Exercise consistency
  const workoutContainer = document.getElementById("dashboardWorkoutAnalysis");
  if (workoutContainer) {
    workoutContainer.innerHTML = "";
    const thisMonthWorkouts = state.workouts.filter(w => isTargetDashboardMonth(w.date));
    const totalMinutes = thisMonthWorkouts.reduce((sum, w) => sum + (toNumber(w.minutes) || 0), 0);
    const totalSessions = thisMonthWorkouts.length;

    const summary = document.createElement("div");
    summary.style.marginBottom = "12px";
    summary.innerHTML = `
      <div style="font-size:13px; margin-bottom:4px;"><strong>This Month:</strong> ${totalMinutes} mins over ${totalSessions} sessions</div>
    `;
    workoutContainer.append(summary);

    if (state.workouts.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No exercise logged yet.";
      workoutContainer.append(empty);
    } else {
      state.workouts.slice(0, 2).forEach((w) => {
        const row = document.createElement("div");
        row.className = "stack-row";
        row.style.padding = "6px 8px";
        row.style.fontSize = "12px";
        row.style.marginBottom = "4px";
        row.innerHTML = `
          <div style="display:flex; justify-content:space-between;">
            <span><strong>${escapeHTML(w.type)}</strong> (${escapeHTML(w.intensity)})</span>
            <span>${w.minutes} mins</span>
          </div>
          <div class="stack-meta" style="font-size:10px;">${formatDate(w.date)}</div>
        `;
        workoutContainer.append(row);
      });
    }
  }
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
  renderLiabilities();
  renderExpensesAnalysis();
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
  const allRows = bucket?.rows || [];

  const searchInput = document.getElementById("expenseSearchInput");
  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";

  const filteredRows = allRows.filter(item => {
    const norm = normalizeOwner(item.paidBy || "Both");
    if (activeExpenseOwner !== "Both" && norm !== activeExpenseOwner && norm !== "Both") return false;

    if (searchVal) {
      const category = String(item.category || "").toLowerCase();
      const note = String(item.note || "").toLowerCase();
      const paidBy = String(item.paidBy || "").toLowerCase();
      const amount = String(item.amount || "");
      const date = String(item.date || "");
      if (!category.includes(searchVal) && 
          !note.includes(searchVal) && 
          !paidBy.includes(searchVal) &&
          !amount.includes(searchVal) &&
          !date.includes(searchVal)) {
        return false;
      }
    }
    return true;
  });

  const total = sum(filteredRows, "amount");
  const categoryMap = {};
  filteredRows.forEach(item => {
    const cat = item.category || "General";
    categoryMap[cat] = (categoryMap[cat] || 0) + toNumber(item.amount);
  });
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);

  const rows = [...filteredRows].sort(sortByDateDesc);
  const totalPages = Math.max(1, Math.ceil(rows.length / EXPENSE_PAGE_SIZE));
  activeExpensePage = clamp(activeExpensePage, 0, totalPages - 1);
  const pageRows = rows.slice(activeExpensePage * EXPENSE_PAGE_SIZE, (activeExpensePage + 1) * EXPENSE_PAGE_SIZE);

  if (summary) {
    const txnCount = rows.length;
    const avg = txnCount ? total / txnCount : 0;
    const topCatName = categories[0]?.[0] || "-";
    const topCatVal = categories[0]?.[1] || 0;
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Month total (${activeExpenseOwner})</div>
        <div class="value">${formatINR(total)}</div>
        <div class="hint">${txnCount} transactions</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Avg per entry</div>
        <div class="value">${formatINR(avg)}</div>
        <div class="hint">${formatMonthKeyLabel(activeExpenseMonth)}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Top category</div>
        <div class="value">${escapeHTML(topCatName)}</div>
        <div class="hint">${formatINR(topCatVal)}</div>
      </article>
    `;
  }

  if (categoryList) {
    categoryList.innerHTML = "";
    const topCategories = categories.slice(0, 8);
    if (topCategories.length === 0) {
      categoryList.innerHTML = `<div class="empty-state">No categories this month.</div>`;
    } else {
      topCategories.forEach(([category, value]) => {
        const row = document.createElement("div");
        row.className = "stack-row";
        row.innerHTML = `
          <div>
            <div class="stack-title">${escapeHTML(category)}</div>
            <div class="stack-meta">${Math.round((value / Math.max(1, total)) * 100)}% of month</div>
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
  renderSimpleAssets();
  if (activeMfView === "insights") {
    renderMfInsightsPanel();
  }
}

function renderMutualFundsPanel() {
  const summary = document.getElementById("mfOwnerSummary");
  const table = document.getElementById("mutualFundTable");
  if (!table) return;
  const tableEl = table.closest("table");
  const targetThead = tableEl ? tableEl.querySelector("thead") : null;

  // Update the "NAV as of …" label in the panel header
  const navDateEl = document.getElementById("navDateLabel");
  if (navDateEl) {
    const sampleWithDate = state.mutualFunds.find(t => t.navDate);
    navDateEl.textContent = sampleWithDate?.navDate ? `NAV: ${sampleWithDate.navDate}` : '';
  }

  const rows = [...state.mutualFunds]
    .filter((item) => matchHoldingsOwner(item.owner, activeHoldingsOwner))
    .sort((a, b) => new Date(b.purchaseDate || b.date || '1970-01-01') - new Date(a.purchaseDate || a.date || '1970-01-01'));

  const invested = sum(rows, "invested");
  // Calculate current value from units × latestNav (same as fund summary table)
  const currentByFund = {};
  rows.forEach((t) => {
    const key = t.fundName || "Unknown";
    if (!currentByFund[key]) currentByFund[key] = { units: 0, latestNav: t.latestNav || t.nav || 0 };
    currentByFund[key].units += toNumber(t.units);
    if (t.latestNav) currentByFund[key].latestNav = toNumber(t.latestNav);
  });
  const current = Object.values(currentByFund).reduce((total, f) => total + f.units * f.latestNav, 0);
  const gain = current - invested;
  const roi = invested ? (gain / invested) * 100 : 0;

  // Calculate overall portfolio XIRR
  const portfolioFlows = rows.map(t => ({
    date: new Date(t.purchaseDate || t.date || Date.now()),
    amount: -toNumber(t.invested)
  }));
  if (current > 0) {
    portfolioFlows.push({
      date: new Date(),
      amount: current
    });
  }
  const portfolioXirr = calculateXIRR(portfolioFlows);

  // ── 1-Day change across the entire portfolio ──────────────────────────────
  // Sum (units × latestNav) - (units × prevNav) for all holdings with prevNav
  let oneDayChange = 0;
  let oneDayHasPrev = false;
  {
    const byFundPrev = {};
    rows.forEach(t => {
      const key = t.fundName || 'Unknown';
      if (!byFundPrev[key]) byFundPrev[key] = { units: 0, latestNav: t.latestNav || t.nav || 0, prevNav: t.prevNav || null };
      byFundPrev[key].units += toNumber(t.units);
      if (t.latestNav) byFundPrev[key].latestNav = toNumber(t.latestNav);
      if (t.prevNav)  { byFundPrev[key].prevNav = toNumber(t.prevNav); oneDayHasPrev = true; }
    });
    Object.values(byFundPrev).forEach(f => {
      if (f.prevNav) oneDayChange += f.units * (f.latestNav - f.prevNav);
    });
  }
  const oneDayPct = oneDayHasPrev && current > 0 ? (oneDayChange / (current - oneDayChange)) * 100 : 0;

  // ── Monthly SIP Budget ──────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthName = now.toLocaleString('en-IN', { month: 'long' });
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysRemaining = daysInMonth - now.getDate();
  
  // Calculate this month's investments by owner
  const thisMonthInvestments = state.mutualFunds.filter(t => {
    if (t.transactionType && t.transactionType.toUpperCase() === 'REDEMPTION') return false;
    const d = new Date(t.purchaseDate || t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  
  let sipInvestedThisMonth = 0;
  let sipTarget = 0;
  if (activeHoldingsOwner === 'Both') {
    sipInvestedThisMonth = thisMonthInvestments.reduce((s, t) => s + toNumber(t.invested), 0);
    sipTarget = toNumber(state.mfMonthlyTarget?.me || 100000) + toNumber(state.mfMonthlyTarget?.wife || 100000);
  } else if (activeHoldingsOwner === 'Wife') {
    sipInvestedThisMonth = thisMonthInvestments.filter(t => (t.owner || 'Me') === 'Wife').reduce((s, t) => s + toNumber(t.invested), 0);
    sipTarget = toNumber(state.mfMonthlyTarget?.wife || 100000);
  } else {
    sipInvestedThisMonth = thisMonthInvestments.filter(t => matchHoldingsOwner(t.owner, 'Me')).reduce((s, t) => s + toNumber(t.invested), 0);
    sipTarget = toNumber(state.mfMonthlyTarget?.me || 100000);
  }
  const sipRemaining = Math.max(0, sipTarget - sipInvestedThisMonth);
  const sipPct = sipTarget > 0 ? Math.min(100, (sipInvestedThisMonth / sipTarget) * 100) : 0;
  const dayPct = ((now.getDate()) / daysInMonth) * 100;
  const isBehind = sipPct < (dayPct - 15); // More than 15% behind pace
  const sipTargetKey = activeHoldingsOwner === 'Wife' ? 'wife' : 'me';

  if (summary) {
    const navDateLabel = (() => {
      const sampleNav = state.mutualFunds.find(t => t.navDate);
      return sampleNav?.navDate ? `NAV as of ${sampleNav.navDate}` : 'Live NAV';
    })();

    const dayChangeColor = oneDayChange >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
    const dayChangeArrow = oneDayChange >= 0 ? '▲' : '▼';

    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Invested (${activeHoldingsOwner})</div>
        <div class="value">${formatINR(invested)}</div>
        <div class="hint">${rows.length} transactions</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Current value</div>
        <div class="value">${formatINR(current)}</div>
        <div class="hint">${formatINR(gain)} ${gain >= 0 ? 'gain 📈' : 'loss 📉'} &nbsp;·&nbsp; <span style="font-size:0.75em;opacity:0.7">${navDateLabel}</span></div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">Portfolio XIRR</div>
        <div class="value" style="color: ${portfolioXirr >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)'}">${portfolioXirr.toFixed(2)}%</div>
        <div class="hint">Overall ROI: ${formatPercent(roi)}</div>
      </article>
      <article class="metric-card compact-metric" style="border-left: 3px solid ${dayChangeColor}">
        <div class="label">1-Day Change</div>
        <div class="value" style="color: ${dayChangeColor}">${oneDayHasPrev ? `${dayChangeArrow} ${formatINR(Math.abs(oneDayChange))}` : '—'}</div>
        <div class="hint">${oneDayHasPrev ? `${oneDayChange >= 0 ? '+' : ''}${oneDayPct.toFixed(2)}% today` : 'Refresh NAVs to see'}</div>
      </article>
      <article class="metric-card compact-metric" style="border-left: 3px solid var(--brand)">
        <div class="label">${monthName} Budget</div>
        <div class="value">${formatINR(sipInvestedThisMonth)} <span style="font-size:0.65em;opacity:0.6">/ ${formatINR(sipTarget)}</span></div>
        <div class="sip-budget-bar"><div class="sip-budget-bar-fill ${isBehind ? 'behind' : ''}" style="width:${sipPct.toFixed(1)}%"></div></div>
        <div class="hint">
          ${sipRemaining > 0 ? `${formatINR(sipRemaining)} remaining · ${daysRemaining}d left` : '✅ Target reached!'}
          ${isBehind ? ' · ⚠ Behind pace' : ''}
          ${activeHoldingsOwner === 'Both' ? ` · <span class="sip-edit-target" data-owner="me" style="cursor:pointer;text-decoration:underline;opacity:0.7">Edit Me</span> · <span class="sip-edit-target" data-owner="wife" style="cursor:pointer;text-decoration:underline;opacity:0.7">Edit Wife</span>` : ` · <span class="sip-edit-target" data-owner="${sipTargetKey}" style="cursor:pointer;text-decoration:underline;opacity:0.7" title="Click to edit target">Edit target</span>`}
        </div>
      </article>
    `;

    // SIP target edit handler
    summary.querySelectorAll('.sip-edit-target').forEach(el => {
      el.addEventListener('click', (e) => {
        const ownerKey = e.target.dataset.owner;
        const currentTarget = state.mfMonthlyTarget?.[ownerKey] || 100000;
        const newVal = prompt(`Set monthly MF investment target for ${ownerKey === 'wife' ? 'Wife' : 'Me'}:`, currentTarget);
        if (newVal !== null && !isNaN(Number(newVal)) && Number(newVal) > 0) {
          if (!state.mfMonthlyTarget) state.mfMonthlyTarget = { me: 100000, wife: 100000 };
          state.mfMonthlyTarget[ownerKey] = Number(newVal);
          saveData(true);
          renderMutualFundsPanel();
          toast(`✓ ${ownerKey === 'wife' ? 'Wife' : 'Me'} monthly target set to ${formatINR(Number(newVal))}`);
        }
      });
    });
  }

  if (activeMfView === "holdings") {
    const groups = groupBy(rows, item => item.fundName);
    const holdings = Object.entries(groups).map(([fundName, txns]) => {
      const totalInvested = sum(txns, 'invested');
      const totalUnits = sum(txns, 'units');
      const latestNav = txns[0].latestNav || txns[0].nav;
      const prevNav = txns[0].prevNav || null;
      const currentValue = totalUnits * latestNav;
      const gain = currentValue - totalInvested;
      const roi = totalInvested ? (gain / totalInvested) * 100 : 0;
      const avgNav = totalUnits ? (totalInvested / totalUnits) : 0;

      // 1-Day change for this holding
      const dayChange = prevNav ? totalUnits * (latestNav - prevNav) : null;
      const dayChangePct = prevNav && latestNav ? ((latestNav - prevNav) / prevNav) * 100 : null;

      const cashFlows = txns.map(t => ({
        date: new Date(t.purchaseDate || t.date || Date.now()),
        amount: -toNumber(t.invested)
      }));
      if (totalUnits > 0) {
        cashFlows.push({
          date: new Date(),
          amount: currentValue
        });
      }
      const xirr = calculateXIRR(cashFlows);

      const codesCache = getFundCodesCache();
      const codeObj = codesCache[fundName];
      let navVs30d = null;
      let lowestNav30d = null;
      if (codeObj?.schemeCode) {
        const historyCache = getMfHistoryCache();
        const cached = historyCache[codeObj.schemeCode];
        if (cached?.data && cached.data.length > 0) {
          const slice30 = cached.data.slice(-30);
          lowestNav30d = Math.min(...slice30.map(d => d.nav));
          if (cached.data.length >= 30) {
            navVs30d = computeNavVs30dAvg(cached.data);
          }
        }
      }

      return {
        fundName,
        totalUnits,
        avgNav,
        totalInvested,
        latestNav,
        prevNav,
        currentValue,
        gain,
        roi,
        xirr,
        dayChange,
        dayChangePct,
        navVs30d,
        lowestNav30d,
      };
    }).sort((a, b) => b.currentValue - a.currentValue);

    if (targetThead) {
      targetThead.innerHTML = `
        <tr>
          <th>Fund</th>
          <th>Units</th>
          <th>Avg. NAV</th>
          <th>Invested</th>
          <th>Latest NAV</th>
          <th>30D Lowest</th>
          <th>Invest Signal</th>
          <th>Current Value</th>
          <th>1-Day Change</th>
          <th>Gain / Loss</th>
          <th>XIRR</th>
        </tr>
      `;
    }

    renderRows(
      table,
      holdings,
      (item) => [
        `<span>${escapeHTML(item.fundName)}${getNavTimingBadgeHtml(item.navVs30d)}</span>`,
        item.totalUnits.toFixed(3),
        formatINR(item.avgNav),
        formatINR(item.totalInvested),
        formatINR(item.latestNav),
        item.lowestNav30d !== null ? formatINR(item.lowestNav30d) : '<span style="opacity:0.4">—</span>',
        (() => {
          if (item.latestNav === null || item.lowestNav30d === null) return '<span style="opacity:0.4">—</span>';
          const diffPct = ((item.latestNav - item.lowestNav30d) / item.lowestNav30d) * 100;
          if (item.latestNav <= item.lowestNav30d) {
            return '<span class="nav-timing-badge badge-low" style="margin:0;font-size:0.7rem;padding:2px 6px;">🔥 Invest Today (30D Low)</span>';
          } else if (diffPct <= 1.5) {
            return '<span class="nav-timing-badge badge-below" style="margin:0;font-size:0.7rem;padding:2px 6px;">▼ Buy (Near Low)</span>';
          } else if (diffPct <= 4) {
            return '<span class="nav-timing-badge badge-fair" style="margin:0;font-size:0.7rem;padding:2px 6px;">● Hold (Fair)</span>';
          } else {
            return '<span class="nav-timing-badge badge-high" style="margin:0;font-size:0.7rem;padding:2px 6px;">▲ Wait (High NAV)</span>';
          }
        })(),
        formatINR(item.currentValue),
        (() => {
          if (item.dayChange === null) return '<span style="opacity:0.4">—</span>';
          const color = item.dayChange >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
          const arrow = item.dayChange >= 0 ? '▲' : '▼';
          return `<span style="color:${color};font-weight:600">${arrow} ${formatINR(Math.abs(item.dayChange))} <small>(${item.dayChange >= 0 ? '+' : ''}${item.dayChangePct.toFixed(2)}%)</small></span>`;
        })(),
        (() => {
          const color = item.gain >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
          return `<span style="color: ${color}; font-weight: 600;">${formatINR(item.gain)} (${formatPercent(item.roi)})</span>`;
        })(),
        (() => {
          const color = item.xirr >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
          return `<span style="color: ${color}; font-weight: 600;">${item.xirr.toFixed(2)}%</span>`;
        })()
      ],
      `No mutual funds for ${activeHoldingsOwner}.`,
      11
    );
  } else {
    if (targetThead) {
      targetThead.innerHTML = `
        <tr>
          <th>Date</th>
          <th>Fund</th>
          <th>Type</th>
          <th>Units</th>
          <th>Purchase NAV</th>
          <th>Invested</th>
          <th>Latest NAV</th>
          <th>Current Value</th>
          <th>Gain / Loss</th>
          <th>Owner</th>
          <th>Action</th>
        </tr>
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
}

const SIMPLE_ASSET_TABS = [
  { kind: "stock", stateKey: "stocks", summaryId: "stocksOwnerSummary", tableId: "stocksTable", label: "Stock" },
  { kind: "fd", stateKey: "fd", summaryId: "fdOwnerSummary", tableId: "fdTable", label: "FD" },
  { kind: "epf", stateKey: "epf", summaryId: "epfOwnerSummary", tableId: "epfTable", label: "EPF" },
  { kind: "bonds", stateKey: "bonds", summaryId: "bondsOwnerSummary", tableId: "bondsTable", label: "Bond" },
  { kind: "ppf", stateKey: "ppf", summaryId: "ppfOwnerSummary", tableId: "ppfTable", label: "PPF" },
  { kind: "gold", stateKey: "gold", summaryId: "goldOwnerSummary", tableId: "goldTable", label: "Gold" },
  { kind: "silver", stateKey: "silver", summaryId: "silverOwnerSummary", tableId: "silverTable", label: "Silver" },
  { kind: "crypto", stateKey: "crypto", summaryId: "cryptoOwnerSummary", tableId: "cryptoTable", label: "Crypto" },
  { kind: "usstocks", stateKey: "usstocks", summaryId: "usstocksOwnerSummary", tableId: "usstocksTable", label: "US Stock" },
  { kind: "banksaving", stateKey: "banksaving", summaryId: "banksavingOwnerSummary", tableId: "banksavingTable", label: "Bank Saving" },
  { kind: "others", stateKey: "others", summaryId: "othersOwnerSummary", tableId: "othersTable", label: "Other Asset" },
];

function renderSimpleAssets() {
  SIMPLE_ASSET_TABS.forEach(({ kind, stateKey, summaryId, tableId, label }) => {
    const summary = document.getElementById(summaryId);
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = (state[stateKey] || [])
      .filter((item) => matchHoldingsOwner(item.owner || item.paidBy, activeHoldingsOwner))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalValue = rows.reduce((total, row) => total + toNumber(row.value), 0);

    if (summary) {
      summary.innerHTML = `
        <article class="metric-card compact-metric">
          <div class="label">Current value (${activeHoldingsOwner})</div>
          <div class="value">${formatINR(totalValue)}</div>
          <div class="hint">${rows.length} entry / entries</div>
        </article>
      `;
    }

    renderRows(
      table,
      rows,
      (item) => [
        item.date || "-",
        item.owner || item.paidBy || "Me",
        formatINR(item.value),
        item.note || "-",
        `<div class="actions-wrapper">
          <button class="action-btn edit-btn edit-simple-asset-btn" data-kind="${kind}" data-id="${item.id}" title="Edit entry">✏️</button>
          <button class="action-btn delete-btn delete-simple-asset-btn" data-kind="${kind}" data-id="${item.id}" title="Delete entry">🗑️</button>
        </div>`
      ],
      `No entries found for ${label}.`,
      5
    );
  });
}

function matchHoldingsOwner(owner, filter) {
  const normalized = normalizeOwner(owner || "Me");
  if (filter === "Both") return true;
  return normalized === filter || normalized === "Both";
}

function investmentHoldingsTotal() {
  // Calculate MF current value the SAME way as the fund summary:
  // Group by fund → sum units → multiply by latestNav (or purchaseNav fallback)
  // This avoids using the stale `currentValue` field that was initialized to `invested` on import.
  const mfByFund = {};
  state.mutualFunds.forEach((t) => {
    const key = t.fundName || "Unknown";
    if (!mfByFund[key]) mfByFund[key] = { units: 0, latestNav: t.latestNav || t.nav || 0 };
    mfByFund[key].units += toNumber(t.units);
    // Always take the latest NAV from any transaction in this fund
    if (t.latestNav) mfByFund[key].latestNav = toNumber(t.latestNav);
  });
  const mutualFunds = Object.values(mfByFund).reduce((total, fund) => {
    return total + fund.units * fund.latestNav;
  }, 0);

  const simpleAssetsTotal = SIMPLE_ASSET_TABS.reduce((total, { stateKey }) => {
    return total + sum(state[stateKey] || [], "value");
  }, 0);
  return mutualFunds + simpleAssetsTotal;
}

function renderLiabilities() {
  const summary = document.getElementById("liabilitiesOwnerSummary");
  const table = document.getElementById("liabilityTable");
  if (!table) return;

  const rows = state.liabilities
    .filter((item) => matchHoldingsOwner(item.owner || "Both", activeHoldingsOwner))
    .sort((a, b) => b.value - a.value);

  const totalValue = rows.reduce((total, row) => total + toNumber(row.value), 0);

  if (summary) {
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">Total Outstanding (${activeHoldingsOwner})</div>
        <div class="value">${formatINR(totalValue)}</div>
        <div class="hint">${rows.length} liability / liabilities</div>
      </article>
    `;
  }

  renderRows(
    table,
    rows,
    (item) => [
      item.name || "-",
      item.category || "-",
      item.owner || "Both",
      formatINR(item.value),
      `<div class="actions-wrapper">
        <button class="action-btn edit-btn edit-simple-asset-btn" data-kind="liability" data-id="${item.id}" title="Edit entry">✏️</button>
        <button class="action-btn delete-btn delete-simple-asset-btn" data-kind="liability" data-id="${item.id}" title="Delete entry">🗑️</button>
      </div>`
    ],
    `No liabilities found for ${activeHoldingsOwner}.`,
    5
  );
}

let activeCareerTab = "devops";

function renderCareer() {
  const addBtn = document.getElementById("careerAddBtn");
  if (addBtn) {
    if (activeCareerTab === "habits") {
      addBtn.textContent = "Add habit";
      addBtn.dataset.kind = "habit";
    } else {
      addBtn.textContent = "Add topic";
      addBtn.dataset.kind = "study";
    }
  }

  // Helper to render roadmap board for study topics
  const renderRoadmap = (boardId, readinessId, owner) => {
    const board = document.getElementById(boardId);
    if (!board) return;
    board.innerHTML = "";

    const list = state.studies
      .filter((topic) => (topic.owner || "Me") === owner)
      .sort((a, b) => (a.confidence || 0) - (b.confidence || 0));

    if (list.length === 0) {
      board.innerHTML = `<div class="empty-state">No study topics added yet. Click "Add topic" above.</div>`;
    } else {
      list.forEach((topic) => {
        const confidence = clamp(toNumber(topic.confidence), 0, 100);
        const hoursRatio = clamp(((topic.hours || 0) / Math.max(1, topic.targetHours || 20)) * 100, 0, 100);
        const card = document.createElement("article");
        card.className = "topic-card";
        card.innerHTML = `
          <div class="topic-card-top">
            <div style="flex: 1;">
              <h4 style="display: flex; align-items: center; justify-content: space-between;">
                <span>${escapeHTML(topic.topic)}</span>
                <span class="actions-wrapper" style="margin-left: 12px;">
                  <button class="action-btn edit-btn" type="button" data-kind="study" data-id="${topic.id}" title="Edit topic">✏️</button>
                  <button class="action-btn delete-btn" type="button" data-kind="study" data-id="${topic.id}" title="Delete topic">🗑️</button>
                </span>
              </h4>
              <div class="stack-meta" style="margin-top: 4px;">${escapeHTML(topic.status || "Planned")} • ${topic.hours || 0}/${topic.targetHours || 20}h</div>
            </div>
            <strong style="margin-left: 12px;">${confidence}%</strong>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${confidence}%"></div></div>
          <div class="bar-track"><div class="bar-fill accent" style="width:${hoursRatio}%"></div></div>
        `;
        board.append(card);
      });
    }

    const readiness = calculateReadiness(owner);
    renderStackList(document.getElementById(readinessId), readiness, (item) => ({
      title: item.title,
      meta: item.meta,
      value: item.value,
    }));
  };

  if (activeCareerTab === "devops") {
    renderRoadmap("devopsStudyBoard", "readinessList", "Me");
  } else if (activeCareerTab === "dataeng") {
    renderRoadmap("dataengStudyBoard", "wifeReadinessList", "Wife");
  }
}

function calculateTimeRemaining(dueDateStr) {
  if (!dueDateStr) return { text: "No due date", class: "" };
  const due = new Date(dueDateStr);
  if (isNaN(due.getTime())) return { text: "No due date", class: "" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffTime = due - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    if (days === 1) return { text: "⚠️ Overdue by 1 day", class: "overdue-tag urgent" };
    if (days < 30) return { text: `⚠️ Overdue by ${days} days`, class: "overdue-tag urgent" };
    const months = Math.floor(days / 30);
    if (months === 1) return { text: "⚠️ Overdue by 1 month", class: "overdue-tag urgent" };
    return { text: `⚠️ Overdue by ${months} months`, class: "overdue-tag urgent" };
  } else if (diffDays === 0) {
    return { text: "📅 Due Today", class: "urgent" };
  } else if (diffDays === 1) {
    return { text: "📅 Due Tomorrow", class: "urgent" };
  } else if (diffDays < 30) {
    return { text: `📅 ${diffDays} days left`, class: diffDays <= 7 ? "urgent" : "" };
  } else {
    const months = Math.floor(diffDays / 30);
    if (months < 12) {
      if (months === 1) return { text: `📅 1 month left`, class: "" };
      return { text: `📅 ${months} months left`, class: "" };
    } else {
      const years = (diffDays / 365).toFixed(1);
      return { text: `📅 ${years} years left`, class: "" };
    }
  }
}

function getGoalCategoryConfig(category) {
  const cat = String(category || "").trim().toLowerCase();
  if (cat.includes("finance") || cat.includes("money") || cat.includes("saving") || cat.includes("investment")) {
    return { emoji: "💰", class: "cat-finance" };
  }
  if (cat.includes("career") || cat.includes("job") || cat.includes("prep") || cat.includes("study") || cat.includes("work")) {
    return { emoji: "💼", class: "cat-career" };
  }
  if (cat.includes("travel") || cat.includes("trip") || cat.includes("vacation") || cat.includes("flight")) {
    return { emoji: "✈️", class: "cat-travel" };
  }
  if (cat.includes("health") || cat.includes("exercise") || cat.includes("medical") || cat.includes("fit")) {
    return { emoji: "🩺", class: "cat-health" };
  }
  if (cat.includes("personal") || cat.includes("family") || cat.includes("milestone") || cat.includes("life")) {
    return { emoji: "🎓", class: "cat-personal" };
  }
  return { emoji: "✨", class: "cat-other" };
}

function renderGoals() {
  const container = document.getElementById("goalsGrid");
  if (!container) return;
  container.innerHTML = "";

  const searchInput = document.getElementById("goalSearchInput");
  const categoryFilter = document.getElementById("goalCategoryFilter");
  const ownerFilter = document.getElementById("goalOwnerFilter");
  const statusFilter = document.getElementById("goalStatusFilter");
  const sortSelector = document.getElementById("goalSortSelector");

  const searchVal = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const categoryVal = categoryFilter ? categoryFilter.value : "All";
  const ownerVal = ownerFilter ? ownerFilter.value : "All";
  const statusVal = statusFilter ? statusFilter.value : "All";
  const sortVal = sortSelector ? sortSelector.value : "dueDate";

  // Calculate stats on ALL goals first (before filtering)
  let activeCount = 0;
  let completedCount = 0;
  let totalTarget = 0;
  let totalSaved = 0;

  state.goals.forEach(goal => {
    const isCompleted = (goal.saved || 0) >= (goal.target || 1) && (goal.target || 0) > 0;
    if (isCompleted) {
      completedCount++;
    } else {
      activeCount++;
    }
    totalTarget += (goal.target || 0);
    totalSaved += (goal.saved || 0);
  });

  const statActiveEl = document.getElementById("goalStatActive");
  const statCompletedEl = document.getElementById("goalStatCompleted");
  const statProgressEl = document.getElementById("goalStatProgress");
  const statProgressPercentEl = document.getElementById("goalStatProgressPercent");

  if (statActiveEl) statActiveEl.textContent = activeCount;
  if (statCompletedEl) statCompletedEl.textContent = completedCount;
  if (statProgressEl) statProgressEl.textContent = `${formatINR(totalSaved)} / ${formatINR(totalTarget)}`;
  if (statProgressPercentEl) {
    const pct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
    statProgressPercentEl.textContent = `${pct}% overall progress`;
  }

  // Now apply filtering
  let filtered = state.goals.filter(goal => {
    // Search
    if (searchVal) {
      const name = String(goal.name || "").toLowerCase();
      const category = String(goal.category || "").toLowerCase();
      if (!name.includes(searchVal) && !category.includes(searchVal)) return false;
    }
    // Category
    if (categoryVal !== "All") {
      const catConfig = getGoalCategoryConfig(goal.category);
      const normalizedCat = String(goal.category || "").toLowerCase();
      if (categoryVal.toLowerCase() === "finance" && !normalizedCat.includes("finance") && !normalizedCat.includes("money") && !normalizedCat.includes("saving") && !normalizedCat.includes("investment")) return false;
      if (categoryVal.toLowerCase() === "career" && !normalizedCat.includes("career") && !normalizedCat.includes("job") && !normalizedCat.includes("prep") && !normalizedCat.includes("study") && !normalizedCat.includes("work")) return false;
      if (categoryVal.toLowerCase() === "travel" && !normalizedCat.includes("travel") && !normalizedCat.includes("trip") && !normalizedCat.includes("vacation") && !normalizedCat.includes("flight")) return false;
      if (categoryVal.toLowerCase() === "health" && !normalizedCat.includes("health") && !normalizedCat.includes("exercise") && !normalizedCat.includes("medical") && !normalizedCat.includes("fit")) return false;
      if (categoryVal.toLowerCase() === "personal" && !normalizedCat.includes("personal") && !normalizedCat.includes("family") && !normalizedCat.includes("milestone") && !normalizedCat.includes("life")) return false;
      if (categoryVal.toLowerCase() === "other" && catConfig.class !== "cat-other") return false;
    }
    // Owner
    if (ownerVal !== "All" && goal.owner !== ownerVal) return false;
    // Status
    const isCompleted = (goal.saved || 0) >= (goal.target || 1) && (goal.target || 0) > 0;
    if (statusVal === "Completed" && !isCompleted) return false;
    if (statusVal === "Active" && isCompleted) return false;
    if (statusVal === "Overdue") {
      if (isCompleted) return false;
      const timeInfo = calculateTimeRemaining(goal.dueDate);
      if (!timeInfo.text.includes("Overdue")) return false;
    }
    return true;
  });

  // Apply sorting
  filtered.sort((a, b) => {
    if (sortVal === "dueDate") {
      return new Date(a.dueDate || "2999-12-31") - new Date(b.dueDate || "2999-12-31");
    }
    if (sortVal === "progressDesc") {
      const pctA = (a.saved || 0) / Math.max(1, a.target || 1);
      const pctB = (b.saved || 0) / Math.max(1, b.target || 1);
      return pctB - pctA;
    }
    if (sortVal === "progressAsc") {
      const pctA = (a.saved || 0) / Math.max(1, a.target || 1);
      const pctB = (b.saved || 0) / Math.max(1, b.target || 1);
      return pctA - pctB;
    }
    if (sortVal === "targetDesc") {
      return (b.target || 0) - (a.target || 0);
    }
    if (sortVal === "nameAsc") {
      return String(a.name || "").localeCompare(String(b.name || ""));
    }
    return 0;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No goals match the selected filters.</div>`;
    return;
  }

  filtered.forEach(goal => {
    const isCompleted = (goal.saved || 0) >= (goal.target || 1) && (goal.target || 0) > 0;
    const progress = clamp(((goal.saved || 0) / Math.max(1, goal.target || 1)) * 100, 0, 100);
    const catConfig = getGoalCategoryConfig(goal.category);
    const timeInfo = isCompleted ? { text: "✅ Completed!", class: "completed-tag" } : calculateTimeRemaining(goal.dueDate);

    const card = document.createElement("div");
    card.className = `goal-card ${isCompleted ? "completed-card" : ""} ${timeInfo.text.includes("Overdue") ? "overdue" : ""}`;
    card.innerHTML = `
      <div>
        <div class="goal-card-top">
          <div class="goal-badges">
            <span class="goal-badge ${catConfig.class}">${catConfig.emoji} ${escapeHTML(goal.category || "Goal")}</span>
            <span class="goal-badge owner-tag">${escapeHTML(goal.owner || "Both")}</span>
          </div>
          <div class="goal-card-actions actions-wrapper">
            <button class="action-btn edit-btn" type="button" data-kind="goal" data-id="${goal.id}" title="Edit goal">✏️</button>
            <button class="action-btn delete-btn" type="button" data-kind="goal" data-id="${goal.id}" title="Delete goal">🗑️</button>
          </div>
        </div>
        <h3 class="goal-card-title">${escapeHTML(goal.name)}</h3>
        <div class="goal-time-left ${timeInfo.class}">${timeInfo.text}</div>
        
        <div class="goal-progress-info">
          <span>${formatINR(goal.saved || 0)} saved</span>
          <span class="goal-progress-percent">${Math.round(progress)}%</span>
        </div>
        <div class="goal-progress-bar-track">
          <div class="goal-progress-bar-fill" style="width: ${progress}%"></div>
        </div>
        <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom: 14px;">
          Target: ${formatINR(goal.target || 0)} ${goal.dueDate ? `by ${formatDate(goal.dueDate)}` : ""}
        </div>
      </div>
      
      <div class="goal-quick-contribute">
        <span>Add progress:</span>
        <form class="quick-contribute-form" data-id="${goal.id}">
          <input type="number" class="quick-contribute-input" placeholder="Amount" required min="1" step="any" inputmode="decimal" />
          <button type="submit" class="quick-contribute-btn">+</button>
        </form>
      </div>
    `;

    // Bind quick contribute form
    const quickForm = card.querySelector(".quick-contribute-form");
    quickForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = quickForm.querySelector(".quick-contribute-input");
      const amount = toNumber(input.value);
      if (amount > 0) {
        goal.saved = (goal.saved || 0) + amount;
        renderAll();
        toast(`Added ${formatINR(amount)} to "${goal.name}". Progress updated! 🎯`);
        saveData(true);
      }
    });

    container.append(card);
  });
}

let todoFilter = "all";
let todoSearchQuery = "";
let currentCardColor = "default";
let isChecklistMode = false;
let editTaskId = null;
let editWorkoutId = null;

function bindTodoAndKeepEvents() {
  const collapsed = document.getElementById("keepAddCollapsed");
  const expanded = document.getElementById("keepAddExpanded");
  const btnChecklist = document.getElementById("btnChecklistMode");
  const btnTextNote = document.getElementById("btnTextNoteMode");
  const btnCancel = document.getElementById("btnCancelKeepAdd");
  const btnSave = document.getElementById("btnSaveKeepAdd");
  const btnAddChecklist = document.getElementById("btnAddChecklistItem");
  const colorPickerTrigger = document.getElementById("colorPickerTrigger");
  const colorPalette = document.getElementById("keepAddColorPalette");
  const pinBtn = document.getElementById("keepAddPin");
  
  if (!collapsed || !expanded) return;

  // Expand container on collapsed click
  collapsed.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    collapsed.classList.add("hidden");
    expanded.classList.remove("hidden");
    document.getElementById("keepAddTitle").focus();
  });

  // Cancel notes
  btnCancel.addEventListener("click", () => {
    resetKeepAddForm();
  });

  // Modes toggling
  btnChecklist.addEventListener("click", () => {
    collapsed.classList.add("hidden");
    expanded.classList.remove("hidden");
    setChecklistMode(true);
  });
  
  btnTextNote?.addEventListener("click", () => {
    collapsed.classList.add("hidden");
    expanded.classList.remove("hidden");
    setChecklistMode(false);
  });

  // Add checklist item
  btnAddChecklist.addEventListener("click", () => {
    addChecklistInputRow();
  });

  // Color picker popover toggling
  colorPickerTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    colorPalette.classList.toggle("hidden");
  });
  
  // Clicking outside color palette hides it
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".color-palette-wrapper") && colorPalette) {
      colorPalette.classList.add("hidden");
    }
  });

  // Selecting color dot
  colorPalette.querySelectorAll(".color-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      colorPalette.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
      dot.classList.add("active");
      currentCardColor = dot.dataset.color;
    });
  });

  // Pinned toggle
  let isPinned = false;
  pinBtn.addEventListener("click", () => {
    isPinned = !isPinned;
    pinBtn.textContent = isPinned ? "📌 Pinned" : "📌 Pin";
    pinBtn.classList.toggle("active", isPinned);
  });

  // Save Keep note card
  btnSave.addEventListener("click", async () => {
    const titleVal = document.getElementById("keepAddTitle").value.trim();
    const noteVal = document.getElementById("keepAddNote").value.trim();
    const priorityVal = document.getElementById("keepAddPriority").value;
    const categoryVal = document.getElementById("keepAddArea").value.trim() || "Personal";

    if (!titleVal && !noteVal && (!isChecklistMode || document.getElementById("keepAddChecklistItems").children.length === 0)) {
      toast("Note cannot be empty.");
      return;
    }

    // Collect checklist items
    const checklist = [];
    if (isChecklistMode) {
      document.querySelectorAll("#keepAddChecklistItems .checklist-item-editor").forEach((row) => {
        const itemText = row.querySelector('input[type="text"]').value.trim();
        const itemDone = row.querySelector('input[type="checkbox"]').checked;
        if (itemText) {
          checklist.push({ text: itemText, done: itemDone });
        }
      });
    }

    let task;
    if (editTaskId) {
      task = state.tasks.find((t) => t.id === editTaskId);
    }

    if (task) {
      task.text = titleVal || (isChecklistMode ? "Checklist" : "Note");
      task.note = noteVal;
      task.checklist = checklist.length > 0 ? checklist : undefined;
      task.priority = priorityVal;
      task.area = categoryVal;
      task.color = currentCardColor;
      task.pinned = isPinned;
    } else {
      const newTask = {
        id: `task-${generateUUID()}`,
        text: titleVal || (isChecklistMode ? "Checklist" : "Note"),
        note: noteVal,
        checklist: checklist.length > 0 ? checklist : undefined,
        done: false,
        pinned: isPinned,
        color: currentCardColor,
        priority: priorityVal,
        area: categoryVal,
        date: todayISO(),
      };
      state.tasks.push(newTask);
    }

    resetKeepAddForm();
    renderAll();
    toast(editTaskId ? "Note updated." : "Note added.");
    await saveData(true);
  });

  // Search filter
  document.getElementById("todoSearch")?.addEventListener("input", (e) => {
    todoSearchQuery = e.target.value.toLowerCase().trim();
    renderTodoView();
  });

  // Filter chips click
  document.querySelectorAll(".todo-filters .filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".todo-filters .filter-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      todoFilter = chip.dataset.filter;
      renderTodoView();
    });
  });

  function resetKeepAddForm() {
    document.getElementById("keepAddTitle").value = "";
    document.getElementById("keepAddNote").value = "";
    document.getElementById("keepAddChecklistItems").innerHTML = "";
    document.getElementById("keepAddArea").value = "";
    document.getElementById("keepAddPriority").value = "Medium";
    isPinned = false;
    pinBtn.textContent = "📌 Pin";
    pinBtn.classList.remove("active");
    currentCardColor = "default";
    colorPalette.querySelectorAll(".color-dot").forEach((d) => {
      d.classList.toggle("active", d.dataset.color === "default");
    });
    setChecklistMode(false);
    editTaskId = null;
    expanded.classList.add("hidden");
    collapsed.classList.remove("hidden");
  }

  function setChecklistMode(active) {
    isChecklistMode = active;
    const noteArea = document.getElementById("keepAddNote");
    const listArea = document.getElementById("keepAddChecklistContainer");
    if (active) {
      noteArea.classList.add("hidden");
      listArea.classList.remove("hidden");
      if (document.getElementById("keepAddChecklistItems").children.length === 0) {
        addChecklistInputRow();
      }
    } else {
      noteArea.classList.remove("hidden");
      listArea.classList.add("hidden");
    }
  }
}

function addChecklistInputRow(text = "", done = false) {
  const container = document.getElementById("keepAddChecklistItems");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "checklist-item-editor";
  row.innerHTML = `
    <input type="checkbox" ${done ? "checked" : ""} style="width: 16px; height: 16px; cursor: pointer; margin-right: 4px;" />
    <input type="text" placeholder="List item" value="${escapeHTML(text)}" style="flex: 1;" />
    <button type="button" class="icon-button btn-remove-item" style="padding: 2px 6px; font-weight:700;">×</button>
  `;
  row.querySelector(".btn-remove-item").addEventListener("click", () => row.remove());
  container.append(row);
  row.querySelector('input[type="text"]').focus();
}

function bindExerciseEvents() {
  const btnLogWorkout = document.getElementById("btnLogWorkoutManual");
  const btnTemplates = document.getElementById("btnWorkoutTemplates");
  const btnAddEx = document.getElementById("btnWorkoutAddExercise");
  const workoutForm = document.getElementById("workoutLoggerForm");
  
  if (!btnLogWorkout || !workoutForm) return;

  btnLogWorkout.addEventListener("click", () => {
    editWorkoutId = null;
    workoutForm.reset();
    document.getElementById("workoutLogDate").value = todayISO();
    document.getElementById("workoutLogExercisesContainer").innerHTML = "";
    addExerciseLogBlock();
    openModal("workoutLoggerModal");
  });

  btnTemplates.addEventListener("click", () => {
    openModal("workoutTemplatesModal");
  });

  document.querySelectorAll(".template-btn-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(document.getElementById("workoutTemplatesModal"));
      editWorkoutId = null;
      workoutForm.reset();
      document.getElementById("workoutLogDate").value = todayISO();
      
      const container = document.getElementById("workoutLogExercisesContainer");
      container.innerHTML = "";
      
      const template = btn.dataset.template;
      let type = "Strength Training";
      let minutes = 45;
      let notes = "";
      
      if (template === "push") {
        notes = "Push Day template (Chest, Shoulders, Triceps)";
        addExerciseLogBlock("Bench Press", [{ weight: 50, reps: 10 }, { weight: 60, reps: 8 }, { weight: 65, reps: 6 }]);
        addExerciseLogBlock("Overhead Press", [{ weight: 30, reps: 10 }, { weight: 35, reps: 8 }, { weight: 40, reps: 6 }]);
        addExerciseLogBlock("Tricep Pushdowns", [{ weight: 15, reps: 12 }, { weight: 20, reps: 10 }, { weight: 20, reps: 10 }]);
      } else if (template === "pull") {
        notes = "Pull Day template (Back, Biceps)";
        addExerciseLogBlock("Deadlift", [{ weight: 60, reps: 10 }, { weight: 80, reps: 8 }, { weight: 90, reps: 5 }]);
        addExerciseLogBlock("Pull-ups", [{ weight: 0, reps: 8 }, { weight: 0, reps: 8 }, { weight: 0, reps: 6 }]);
        addExerciseLogBlock("Bicep Curls", [{ weight: 10, reps: 12 }, { weight: 12, reps: 10 }, { weight: 12, reps: 10 }]);
      } else if (template === "legs") {
        notes = "Leg Day template (Quads, Hamstrings, Calves)";
        addExerciseLogBlock("Squats", [{ weight: 60, reps: 10 }, { weight: 70, reps: 8 }, { weight: 80, reps: 6 }]);
        addExerciseLogBlock("Leg Press", [{ weight: 100, reps: 12 }, { weight: 120, reps: 10 }, { weight: 140, reps: 10 }]);
        addExerciseLogBlock("Calf Raises", [{ weight: 20, reps: 15 }, { weight: 25, reps: 15 }, { weight: 30, reps: 12 }]);
      } else if (template === "cardio") {
        type = "Cardio / Running";
        minutes = 30;
        notes = "Cardio template (HIIT Run)";
        addExerciseLogBlock("Treadmill Run", [{ weight: 0, reps: 1 }]);
        addExerciseLogBlock("Burpees", [{ weight: 0, reps: 20 }]);
      } else if (template === "yoga") {
        type = "Yoga / Stretching";
        minutes = 40;
        notes = "Yoga template (Flexibility & Flow)";
        addExerciseLogBlock("Sun Salutation", [{ weight: 0, reps: 5 }]);
        addExerciseLogBlock("Hamstring Stretch", [{ weight: 0, reps: 3 }]);
      }
      
      document.getElementById("workoutLogType").value = type;
      document.getElementById("workoutLogMinutes").value = minutes;
      document.getElementById("workoutLogNotes").value = notes;
      
      openModal("workoutLoggerModal");
    });
  });

  btnAddEx.addEventListener("click", () => {
    addExerciseLogBlock();
  });

  workoutForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const dateVal = document.getElementById("workoutLogDate").value;
    const typeVal = document.getElementById("workoutLogType").value;
    const minutesVal = toNumber(document.getElementById("workoutLogMinutes").value);
    const intensityVal = document.getElementById("workoutLogIntensity").value;
    const notesVal = document.getElementById("workoutLogNotes").value.trim();
    
    const exercises = [];
    document.querySelectorAll("#workoutLogExercisesContainer .log-exercise-block").forEach((block) => {
      const exName = block.querySelector(".ex-name-input").value.trim();
      if (!exName) return;
      
      const sets = [];
      block.querySelectorAll(".log-set-row").forEach((row) => {
        const weight = toNumber(row.querySelector(".set-weight").value);
        const reps = toNumber(row.querySelector(".set-reps").value);
        sets.push({ weight, reps });
      });
      
      exercises.push({ name: exName, sets });
    });
    
    if (editWorkoutId) {
      const workout = state.workouts.find((w) => w.id === editWorkoutId);
      if (workout) {
        workout.date = dateVal;
        workout.type = typeVal;
        workout.minutes = minutesVal;
        workout.intensity = intensityVal;
        workout.notes = notesVal;
        workout.exercises = exercises.length > 0 ? exercises : undefined;
      }
    } else {
      const newWorkout = {
        id: `work-${generateUUID()}`,
        date: dateVal,
        type: typeVal,
        minutes: minutesVal,
        intensity: intensityVal,
        notes: notesVal,
        exercises: exercises.length > 0 ? exercises : undefined,
      };
      state.workouts.push(newWorkout);
    }
    
    closeModal(document.getElementById("workoutLoggerModal"));
    renderAll();
    toast(editWorkoutId ? "Workout updated." : "Workout logged successfully.");
    await saveData(true);
  });
}

function addExerciseLogBlock(name = "", sets = []) {
  const container = document.getElementById("workoutLogExercisesContainer");
  if (!container) return;
  
  const block = document.createElement("div");
  block.className = "log-exercise-block";
  block.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <input type="text" placeholder="Exercise (e.g. Bench Press)" class="ex-name-input" value="${escapeHTML(name)}" style="font-weight: 700; width: 70%; background: transparent; border: none; border-bottom: 1.5px dashed var(--line); font-size: 13px;" required />
      <button type="button" class="secondary-button btn-remove-ex" style="padding: 2px 6px; font-size: 10px;">Remove</button>
    </div>
    <div class="log-sets-container" style="display: flex; flex-direction: column; gap: 6px;"></div>
    <button type="button" class="secondary-button btn-add-set" style="padding: 4px 8px; font-size: 10px; align-self: flex-start; margin-top: 6px;">+ Add Set</button>
  `;

  const setsContainer = block.querySelector(".log-sets-container");
  const addSetBtn = block.querySelector(".btn-add-set");
  const removeExBtn = block.querySelector(".btn-remove-ex");

  removeExBtn.addEventListener("click", () => block.remove());

  const addSetRow = (weight = "", reps = "") => {
    const row = document.createElement("div");
    row.className = "log-set-row";
    const setNum = setsContainer.children.length + 1;
    row.innerHTML = `
      <span style="width: 45px; font-weight:700; color:var(--muted); font-size:11px;">Set ${setNum}</span>
      <input type="number" placeholder="kg" class="set-weight" min="0" step="any" inputmode="decimal" value="${weight}" style="width: 65px;" required />
      <span style="opacity: 0.6; font-size:11px;">kg</span>
      <input type="number" placeholder="reps" class="set-reps" min="1" inputmode="numeric" value="${reps}" style="width: 65px;" required />
      <span style="opacity: 0.6; font-size:11px;">reps</span>
      <button type="button" class="icon-button btn-remove-set" style="margin-left: auto;">×</button>
    `;
    row.querySelector(".btn-remove-set").addEventListener("click", () => {
      row.remove();
      const rows = setsContainer.querySelectorAll(".log-set-row");
      rows.forEach((r, idx) => {
        r.querySelector("span").textContent = `Set ${idx + 1}`;
      });
    });
    setsContainer.append(row);
  };

  addSetBtn.addEventListener("click", () => addSetRow());

  if (sets.length > 0) {
    sets.forEach((s) => addSetRow(s.weight, s.reps));
  } else {
    addSetRow();
  }

  container.append(block);
}

function renderTodoView() {
  const pinnedGrid = document.getElementById("pinnedNotesGrid");
  const otherGrid = document.getElementById("otherNotesGrid");
  const pinnedSection = document.getElementById("pinnedNotesSection");
  const otherTitle = document.getElementById("otherNotesTitle");

  if (!otherGrid) return;

  pinnedGrid.innerHTML = "";
  otherGrid.innerHTML = "";

  const filtered = state.tasks.filter((task) => {
    if (todoSearchQuery) {
      const matchText = (task.text || "").toLowerCase().includes(todoSearchQuery);
      const matchNote = (task.note || "").toLowerCase().includes(todoSearchQuery);
      const matchArea = (task.area || "").toLowerCase().includes(todoSearchQuery);
      const matchChecklist = task.checklist ? task.checklist.some((item) => (item.text || "").toLowerCase().includes(todoSearchQuery)) : false;
      if (!matchText && !matchNote && !matchArea && !matchChecklist) return false;
    }
    
    if (todoFilter === "High" || todoFilter === "Medium" || todoFilter === "Low") {
      if (task.priority !== todoFilter) return false;
    }
    
    if (todoFilter === "pinned") {
      if (!task.pinned) return false;
    }

    return true;
  });

  const pinnedTasks = filtered.filter((t) => t.pinned && !t.done);
  const otherTasks = filtered.filter((t) => !t.pinned && !t.done);
  const doneTasks = filtered.filter((t) => t.done);

  const mainOthersList = [...otherTasks, ...doneTasks];

  if (pinnedTasks.length > 0) {
    pinnedSection.classList.remove("hidden");
    if (otherTitle) otherTitle.style.display = "block";
    pinnedTasks.forEach((task) => pinnedGrid.append(createKeepCard(task)));
  } else {
    pinnedSection.classList.add("hidden");
    if (otherTitle) otherTitle.style.display = "none";
  }

  if (mainOthersList.length > 0) {
    mainOthersList.forEach((task) => otherGrid.append(createKeepCard(task)));
  } else {
    otherGrid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">No matching notes found. Take a note above!</div>`;
  }

  function createKeepCard(task) {
    const card = document.createElement("div");
    card.className = `keep-card ${task.color || "default"} ${task.done ? "done" : ""}`;
    if (task.done) card.style.opacity = "0.55";

    let checklistHtml = "";
    if (task.checklist && task.checklist.length > 0) {
      checklistHtml = `<div class="keep-card-checklist">`;
      task.checklist.forEach((item, idx) => {
        checklistHtml += `
          <label class="keep-checklist-row ${item.done ? "checked" : ""}">
            <input type="checkbox" ${item.done ? "checked" : ""} data-idx="${idx}" style="cursor:pointer;" />
            <span>${escapeHTML(item.text)}</span>
          </label>
        `;
      });
      checklistHtml += `</div>`;
    }

    card.innerHTML = `
      <div>
        <div class="keep-card-header">
          <h4 class="keep-card-title">${escapeHTML(task.text)}</h4>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="icon-button btn-pin-card" title="${task.pinned ? "Unpin note" : "Pin note"}" style="padding:2px 4px; font-size:13px; background:none; border:none; cursor:pointer;">
              📌
            </button>
            <button type="button" class="icon-button btn-edit-card" title="Edit note" style="padding:2px 4px; font-size:12px; background:none; border:none; cursor:pointer;">✏️</button>
            <button type="button" class="icon-button btn-delete-card" title="Delete note" style="padding:2px 4px; font-size:12px; background:none; border:none; cursor:pointer;">🗑️</button>
          </div>
        </div>
        
        ${task.note ? `<div class="keep-card-body" style="margin-top:8px;">${escapeHTML(task.note)}</div>` : ""}
        ${checklistHtml}
      </div>

      <div>
        <div class="keep-card-footer">
          <label style="display:flex; align-items:center; gap:6px; font-weight:700; color:var(--muted); cursor:pointer;">
            <input type="checkbox" class="btn-complete-card" ${task.done ? "checked" : ""} /> Done
          </label>
          
          <div class="keep-card-badges" style="display:flex; align-items:center;">
            <button type="button" class="icon-button btn-cycle-color" title="Change color" style="padding: 2px 4px; font-size: 11px; margin-right: 4px; background:none; border:none; cursor:pointer;">🎨</button>
            <span class="badge-priority ${task.priority ? task.priority.toLowerCase() : "medium"}">${task.priority || "Medium"}</span>
            ${task.area ? `<span class="badge-category" style="margin-left:4px;">${escapeHTML(task.area)}</span>` : ""}
          </div>
        </div>
      </div>
    `;

    card.querySelectorAll(".keep-checklist-row input").forEach((box) => {
      box.addEventListener("change", async (e) => {
        const idx = parseInt(box.dataset.idx);
        task.checklist[idx].done = e.target.checked;
        renderAll();
        await saveData();
      });
    });

    card.querySelector(".btn-complete-card").addEventListener("change", async (e) => {
      task.done = e.target.checked;
      renderAll();
      await saveData();
    });

    card.querySelector(".btn-pin-card").addEventListener("click", async () => {
      task.pinned = !task.pinned;
      renderAll();
      await saveData();
    });

    card.querySelector(".btn-cycle-color").addEventListener("click", async () => {
      const colors = ["default", "red", "yellow", "blue", "green", "purple"];
      const currentIdx = colors.indexOf(task.color || "default");
      const nextIdx = (currentIdx + 1) % colors.length;
      task.color = colors[nextIdx];
      renderAll();
      await saveData();
    });

    card.querySelector(".btn-edit-card").addEventListener("click", () => {
      editTaskId = task.id;
      document.getElementById("keepAddTitle").value = task.text || "";
      document.getElementById("keepAddNote").value = task.note || "";
      document.getElementById("keepAddArea").value = task.area || "";
      document.getElementById("keepAddPriority").value = task.priority || "Medium";
      
      const pinBtn = document.getElementById("keepAddPin");
      const isPinned = !!task.pinned;
      pinBtn.textContent = isPinned ? "📌 Pinned" : "📌 Pin";
      pinBtn.classList.toggle("active", isPinned);

      currentCardColor = task.color || "default";
      const palette = document.getElementById("keepAddColorPalette");
      palette.querySelectorAll(".color-dot").forEach((d) => {
        d.classList.toggle("active", d.dataset.color === currentCardColor);
      });

      const itemsContainer = document.getElementById("keepAddChecklistItems");
      itemsContainer.innerHTML = "";

      const noteArea = document.getElementById("keepAddNote");
      const listArea = document.getElementById("keepAddChecklistContainer");

      if (task.checklist && task.checklist.length > 0) {
        isChecklistMode = true;
        noteArea.classList.add("hidden");
        listArea.classList.remove("hidden");
        task.checklist.forEach((item) => addChecklistInputRow(item.text, item.done));
      } else {
        isChecklistMode = false;
        noteArea.classList.remove("hidden");
        listArea.classList.add("hidden");
      }

      document.getElementById("keepAddCollapsed").classList.add("hidden");
      document.getElementById("keepAddExpanded").classList.remove("hidden");
      document.getElementById("keepAddContainer").scrollIntoView({ behavior: "smooth" });
    });

    card.querySelector(".btn-delete-card").addEventListener("click", async () => {
      if (confirm("Delete this card?")) {
        state.tasks = state.tasks.filter((t) => t.id !== task.id);
        renderAll();
        toast("Card deleted.");
        await saveData(true);
      }
    });

    return card;
  }
}

function renderExerciseView() {
  const historyFeed = document.getElementById("exerciseHistoryFeed");
  const sessionsEl = document.getElementById("workoutTotalSessions");
  const minutesEl = document.getElementById("workoutTotalMinutes");
  const avgEl = document.getElementById("workoutAvgDuration");
  
  if (!historyFeed) return;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  
  const thisMonthWorkouts = state.workouts.filter((w) => {
    const wDate = parseCalendarDate(w.date);
    return wDate && wDate.getFullYear() === currentYear && wDate.getMonth() === currentMonth;
  });

  const totalSessions = thisMonthWorkouts.length;
  let totalMinutes = 0;
  
  thisMonthWorkouts.forEach((w) => {
    totalMinutes += w.minutes || 0;
  });
  
  sessionsEl.textContent = totalSessions;
  minutesEl.textContent = `${totalMinutes} min`;
  avgEl.textContent = totalSessions > 0 ? `${Math.round(totalMinutes / totalSessions)} min` : "0 min";
  
  renderStreakCalendar(currentYear, currentMonth);
  renderPersonalRecords();
  renderWorkoutConsistencyChart();

  historyFeed.innerHTML = "";
  const sortedWorkouts = [...state.workouts].sort(sortByDateDesc).slice(0, 30);
  
  if (sortedWorkouts.length === 0) {
    historyFeed.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--muted);">No workouts logged yet. Start by logging a session or using a template!</div>`;
  } else {
    sortedWorkouts.forEach((workout) => {
      const card = document.createElement("div");
      card.className = "stack-row";
      card.style.flexDirection = "column";
      card.style.alignItems = "stretch";
      card.style.gap = "8px";
      
      let exercisesHtml = "";
      if (workout.exercises && workout.exercises.length > 0) {
        exercisesHtml = `<div class="workout-history-details">`;
        workout.exercises.forEach((ex) => {
          const setsList = ex.sets ? ex.sets.map((s, idx) => `<span class="history-set-badge">S${idx + 1}: ${s.reps} × ${s.weight}kg</span>`).join("") : "";
          exercisesHtml += `
            <div class="history-exercise-row">
              <span class="history-exercise-name">${escapeHTML(ex.name)}</span>
              <div class="history-sets-list">${setsList}</div>
            </div>
          `;
        });
        exercisesHtml += `</div>`;
      }

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div>
            <div class="stack-title" style="font-weight: 700;">${escapeHTML(workout.type)}</div>
            <div class="stack-meta">${formatDate(workout.date)} • <span class="badge-priority ${workout.intensity === "High" ? "high" : workout.intensity === "Low" ? "low" : "medium"}" style="font-size: 8px; padding: 1px 4px; vertical-align: middle;">${workout.intensity || "Medium"}</span></div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="stack-value" style="font-weight: 700;">${workout.minutes || 0} min</div>
            <div class="actions-wrapper">
              <button class="action-btn edit-btn btn-edit-workout" type="button" title="Edit workout">✏️</button>
              <button class="action-btn delete-btn btn-delete-workout" type="button" title="Delete workout">🗑️</button>
            </div>
          </div>
        </div>
        ${workout.notes ? `<div style="font-size: 11.5px; opacity: 0.8; font-style: italic; color: var(--muted); margin-top: 2px;">Note: ${escapeHTML(workout.notes)}</div>` : ""}
        ${exercisesHtml}
      `;

      card.querySelector(".btn-edit-workout").addEventListener("click", () => {
        editWorkoutId = workout.id;
        document.getElementById("workoutLogDate").value = workout.date || todayISO();
        document.getElementById("workoutLogType").value = workout.type || "Strength Training";
        document.getElementById("workoutLogMinutes").value = workout.minutes || 30;
        document.getElementById("workoutLogIntensity").value = workout.intensity || "Medium";
        document.getElementById("workoutLogNotes").value = workout.notes || "";
        
        const container = document.getElementById("workoutLogExercisesContainer");
        container.innerHTML = "";
        
        if (workout.exercises && workout.exercises.length > 0) {
          workout.exercises.forEach((ex) => addExerciseLogBlock(ex.name, ex.sets));
        } else {
          addExerciseLogBlock();
        }
        
        openModal("workoutLoggerModal");
      });

      card.querySelector(".btn-delete-workout").addEventListener("click", async () => {
        if (confirm("Delete this workout entry?")) {
          state.workouts = state.workouts.filter((w) => w.id !== workout.id);
          renderAll();
          toast("Workout deleted.");
          await saveData(true);
        }
      });

      historyFeed.append(card);
    });
  }
}

function renderStreakCalendar(year, month) {
  const calHeader = document.getElementById("streakCalendarHeader");
  const calGrid = document.getElementById("streakCalendarGrid");
  if (!calHeader || !calGrid) return;
  
  calGrid.innerHTML = "";
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  calHeader.innerHTML = `
    <span>${monthNames[month]} ${year}</span>
    <span style="font-size:11px; opacity: 0.6;">Streak: ${calculateStreak()} days</span>
  `;
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement("div");
    calGrid.append(emptyCell);
  }
  
  const activeDays = new Set();
  state.workouts.forEach((w) => {
    const wDate = parseCalendarDate(w.date);
    if (wDate && wDate.getFullYear() === year && wDate.getMonth() === month) {
      activeDays.add(wDate.getDate());
    }
  });
  
  const today = new Date();
  
  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "streak-cal-day";
    cell.textContent = day;
    
    if (activeDays.has(day)) {
      cell.classList.add("active");
    }
    
    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
      cell.classList.add("today");
    }
    
    calGrid.append(cell);
  }
}

function calculateStreak() {
  if (state.workouts.length === 0) return 0;
  
  const dates = [...new Set(state.workouts.map((w) => calendarDateToISO(w.date)))]
    .filter(Boolean)
    .sort()
    .reverse();
    
  if (dates.length === 0) return 0;
  
  let streak = 0;
  let checkDate = new Date();
  
  const toISO = (d) => dateToISODate(d);
  
  const todayStr = toISO(checkDate);
  checkDate.setDate(checkDate.getDate() - 1);
  const yesterdayStr = toISO(checkDate);
  
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) {
    return 0;
  }
  
  let lastLoggedDate = parseCalendarDate(dates[0]);
  if (!lastLoggedDate) return 0;
  
  streak = 1;
  let curr = new Date(lastLoggedDate);
  
  for (let i = 1; i < dates.length; i++) {
    curr.setDate(curr.getDate() - 1);
    const expected = toISO(curr);
    if (dates[i] === expected) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}

function renderPersonalRecords() {
  const prListEl = document.getElementById("workoutPRList");
  if (!prListEl) return;
  
  prListEl.innerHTML = "";
  
  const prs = {};
  state.workouts.forEach((w) => {
    if (w.exercises) {
      w.exercises.forEach((ex) => {
        const name = (ex.name || "").trim();
        if (!name) return;
        
        let maxWeight = 0;
        if (ex.sets) {
          ex.sets.forEach((set) => {
            const wVal = toNumber(set.weight);
            if (wVal > maxWeight) maxWeight = wVal;
          });
        }
        
        if (maxWeight > 0) {
          if (!prs[name] || maxWeight > prs[name]) {
            prs[name] = maxWeight;
          }
        }
      });
    }
  });
  
  const prItems = Object.entries(prs).sort((a, b) => b[1] - a[1]).slice(0, 4);
  
  if (prItems.length === 0) {
    prListEl.innerHTML = `<div style="font-size:12px; opacity:0.6; font-style:italic; padding: 4px 0;">No strength weights logged yet.</div>`;
  } else {
    prItems.forEach(([name, weight]) => {
      const item = document.createElement("div");
      item.className = "pr-item";
      item.innerHTML = `
        <span class="pr-item-name">${escapeHTML(name)}</span>
        <span class="pr-item-value">${weight} kg</span>
      `;
      prListEl.append(item);
    });
  }
}

function renderWorkoutConsistencyChart() {
  const svg = document.getElementById("workoutConsistencyChart");
  if (!svg) return;
  svg.innerHTML = "";
  
  const weeks = Array(8).fill(0);
  const now = new Date();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  
  state.workouts.forEach((w) => {
    const wDate = parseCalendarDate(w.date);
    if (!wDate) return;
    const diffWeeks = Math.floor((now.getTime() - wDate.getTime()) / oneWeekMs);
    if (diffWeeks >= 0 && diffWeeks < 8) {
      weeks[7 - diffWeeks]++;
    }
  });
  
  const width = svg.clientWidth || 300;
  const height = svg.clientHeight || 120;
  const paddingLeft = 20;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 20;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  const maxVal = Math.max(...weeks, 3);
  const colWidth = chartWidth / 8;
  const barWidth = colWidth * 0.6;
  
  weeks.forEach((count, i) => {
    const x = paddingLeft + i * colWidth + (colWidth - barWidth) / 2;
    const barHeight = (count / maxVal) * chartHeight;
    const y = height - paddingBottom - barHeight;
    
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x);
    rect.setAttribute("y", y);
    rect.setAttribute("width", barWidth);
    rect.setAttribute("height", barHeight);
    rect.setAttribute("rx", 3);
    rect.setAttribute("fill", count > 0 ? "var(--primary)" : "var(--line)");
    rect.setAttribute("opacity", count > 0 ? "0.85" : "0.3");
    
    if (count > 0) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x + barWidth / 2);
      text.setAttribute("y", y - 4);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("fill", "var(--text)");
      text.setAttribute("font-size", "10px");
      text.setAttribute("font-weight", "700");
      text.textContent = count;
      svg.append(text);
    }
    
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x + barWidth / 2);
    label.setAttribute("y", height - 6);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", "var(--muted)");
    label.setAttribute("font-size", "9px");
    label.textContent = i === 7 ? "Now" : `Wk -${7 - i}`;
    
  });
}

function bindHabitsEvents() {
  const btnLog = document.getElementById("btnLogHabitManual");
  if (btnLog) {
    btnLog.addEventListener("click", () => {
      buildQuickAddForm("habit");
      openModal("quickAddModal");
    });
  }
}

function recalculateHabitStreaks(habit) {
  if (!habit.history) habit.history = [];
  const completions = [...new Set(habit.history)].sort().reverse();
  
  if (completions.length === 0) {
    habit.streak = 0;
    return;
  }
  
  let streak = 0;
  let checkDate = new Date();
  
  const toISO = (d) => dateToISODate(d);
  
  const todayStr = toISO(checkDate);
  checkDate.setDate(checkDate.getDate() - 1);
  const yesterdayStr = toISO(checkDate);
  
  if (completions[0] === todayStr || completions[0] === yesterdayStr) {
    streak = 1;
    let curr = new Date(parseCalendarDate(completions[0]));
    
    for (let i = 1; i < completions.length; i++) {
      curr.setDate(curr.getDate() - 1);
      const expected = toISO(curr);
      if (completions[i] === expected) {
        streak++;
      } else {
        break;
      }
    }
  } else {
    streak = 0;
  }
  
  habit.streak = streak;
  if (streak > (habit.bestStreak || 0)) {
    habit.bestStreak = streak;
  }
}

function renderHabitsView() {
  const grid = document.getElementById("habitsDashboardGrid");
  const rateEl = document.getElementById("habitCompletionRate");
  const countEl = document.getElementById("habitActiveCount");
  const bestEl = document.getElementById("habitBestStreak");
  const todayEl = document.getElementById("habitTodayProgress");

  if (!grid) return;

  grid.innerHTML = "";

  const habits = state.habits || [];
  countEl.textContent = habits.length;

  let totalBestStreak = 0;
  let totalCompletionsToday = 0;
  let totalCompletionsThisWeek = 0;

  const last7Days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    last7Days.push(d);
  }

  habits.forEach((habit) => {
    if (!habit.history) habit.history = [];
    recalculateHabitStreaks(habit);

    if (habit.bestStreak > totalBestStreak) totalBestStreak = habit.bestStreak;

    const todayStr = todayISO();
    if (habit.history.includes(todayStr)) totalCompletionsToday++;

    const weeklySet = new Set(habit.history);
    last7Days.forEach((d) => {
      if (weeklySet.has(dateToISODate(d))) totalCompletionsThisWeek++;
    });
  });

  bestEl.textContent = `${totalBestStreak} days`;
  todayEl.textContent = `${totalCompletionsToday} / ${habits.length}`;

  const weeklyPossible = habits.length * 7;
  const rate = weeklyPossible > 0 ? Math.round((totalCompletionsThisWeek / weeklyPossible) * 100) : 0;
  rateEl.textContent = `${rate}%`;

  if (habits.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--muted);">No habits tracked yet. Click "Add Habit" above!</div>`;
  } else {
    habits.forEach((habit) => {
      const card = document.createElement("div");
      card.className = `keep-card ${habit.color || "default"}`;

      let calendarHtml = `<div class="habit-calendar">`;
      last7Days.forEach((d) => {
        const dStr = dateToISODate(d);
        const isDone = habit.history.includes(dStr);
        const dayLetter = d.toLocaleDateString("en-US", { weekday: "narrow" });
        const isToday = dStr === todayISO();
        
        calendarHtml += `
          <div class="habit-day-col">
            <span class="habit-day-label">${dayLetter}</span>
            <div class="habit-day-circle ${isDone ? "active" : ""} ${isToday ? "today" : ""}" data-date="${dStr}" title="${formatDate(dStr)}">
              ${isDone ? "✓" : d.getDate()}
            </div>
          </div>
        `;
      });
      calendarHtml += `</div>`;

      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const thisMonthCompletions = habit.history.filter((h) => {
        const hDate = parseCalendarDate(h);
        return hDate && hDate.getFullYear() === now.getFullYear() && hDate.getMonth() === now.getMonth();
      }).length;
      
      const monthRate = Math.round((thisMonthCompletions / daysInMonth) * 100);
      const todayStr = todayISO();

      card.innerHTML = `
        <div>
          <div class="keep-card-header" style="margin-bottom: 8px;">
            <h4 class="keep-card-title">${escapeHTML(habit.name)}</h4>
            <div class="actions-wrapper">
              <button class="action-btn edit-btn btn-edit-habit" type="button" title="Edit habit">✏️</button>
              <button class="action-btn delete-btn btn-delete-habit" type="button" title="Delete habit">🗑️</button>
            </div>
          </div>
          <div style="font-size: 11px; color: var(--muted); margin-bottom: 12px; display:flex; gap:6px;">
            <span class="badge-category">${escapeHTML(habit.frequency || "Daily")}</span>
            <span class="badge-category">${escapeHTML(habit.owner || "Both")}</span>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-weight: 700; color: #f59e0b; font-size:13px;">🔥 ${habit.streak || 0} streak</span>
            <span style="font-weight: 700; color: #10b981; font-size:12px;">👑 Best: ${habit.bestStreak || 0}</span>
          </div>

          ${calendarHtml}
        </div>

        <div>
          <div style="margin-top: 10px; font-size: 11px;">
            <div style="display:flex; justify-content:space-between; color: var(--muted); font-weight:700;">
              <span>Monthly consistency</span>
              <span>${monthRate}%</span>
            </div>
            <div class="habit-progress-bar-wrapper">
              <div class="habit-progress-bar" style="width: ${monthRate}%;"></div>
            </div>
          </div>

          <div class="keep-card-footer" style="margin-top:12px;">
            <button type="button" class="secondary-button btn-checkin-today" style="width: 100%; padding: 6px; font-weight: 700; font-size: 12px;">
              ${habit.history.includes(todayStr) ? "✓ Done for Today" : "🔥 Log Today"}
            </button>
          </div>
        </div>
      `;

      card.querySelectorAll(".habit-day-circle").forEach((circle) => {
        circle.addEventListener("click", async () => {
          const clickedDate = circle.dataset.date;
          if (habit.history.includes(clickedDate)) {
            habit.history = habit.history.filter((h) => h !== clickedDate);
          } else {
            habit.history.push(clickedDate);
          }
          renderAll();
          await saveData(true);
        });
      });

      card.querySelector(".btn-checkin-today").addEventListener("click", async () => {
        const todayStr = todayISO();
        if (habit.history.includes(todayStr)) {
          habit.history = habit.history.filter((h) => h !== todayStr);
        } else {
          habit.history.push(todayStr);
        }
        renderAll();
        await saveData(true);
      });

      card.querySelector(".btn-edit-habit").addEventListener("click", () => {
        buildQuickAddForm("habit", habit.id);
        openModal("quickAddModal");
      });

      card.querySelector(".btn-delete-habit").addEventListener("click", async () => {
        if (confirm(`Delete habit "${habit.name}"?`)) {
          state.habits = state.habits.filter((h) => h.id !== habit.id);
          renderAll();
          toast("Habit deleted.");
          await saveData(true);
        }
      });

      grid.append(card);
    });
  }
}

function renderChat() {
  const log = document.getElementById("chatLog");
  log.innerHTML = "";
  state.chat.slice(-80).forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.role}`;
    // Convert markdown-like formatting to HTML for readable chat messages
    const formatted = message.text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\n(\d+)\. /g, "<br>$1. ")
      .replace(/\n•/g, "<br>•")
      .replace(/\n/g, "<br>");
    bubble.innerHTML = formatted;
    log.append(bubble);
  });
  log.scrollTop = log.scrollHeight;
  // Toggle suggestion chips visibility
  const suggestions = document.getElementById("chatSuggestions");
  if (suggestions) {
    suggestions.style.display = state.chat.length > 0 ? "none" : "";
  }
}

function addChat(role, text) {
  state.chat.push({ role, text, at: new Date().toISOString() });
  saveData();
  renderChat();
}

function answerQuestion(question) {
  const q = question.toLowerCase().trim();
  const metrics = calculateMetrics();

  // ─── DATA READERS (always fresh from state) ───────────────────────────────
  const monthExpenseRows = state.expenses.filter((e) => isTargetDashboardMonth(e.date));
  const topMonthExpenses = Object.entries(
    groupSum(monthExpenseRows, (e) => e.category || "General", "amount")
  ).sort((a, b) => b[1] - a[1]);

  const allExpenseCategories = Object.entries(
    groupSum(state.expenses, (e) => e.category || "General", "amount")
  ).sort((a, b) => b[1] - a[1]);

  const pendingTasks = state.tasks.filter((t) => !t.done);
  const doneTasks = state.tasks.filter((t) => t.done);
  const myStudies = state.studies.filter((s) => (s.owner || "Me") === "Me");
  const wifeStudies = state.studies.filter((s) => (s.owner || "Me") === "Wife");
  const myHabits = state.habits.filter((h) => (h.owner || "Me") === "Me" || h.owner === "Both");
  const wifeHabits = state.habits.filter((h) => h.owner === "Wife" || h.owner === "Both");
  const myGoals = state.goals.filter((g) => (g.owner || "Me") === "Me" || g.owner === "Both");
  const wifeGoals = state.goals.filter((g) => g.owner === "Wife" || g.owner === "Both");
  const sortedGoals = [...state.goals].sort((a, b) => new Date(a.dueDate || "2999-01-01") - new Date(b.dueDate || "2999-01-01"));
  const nextGoal = sortedGoals[0];
  const weakestMyTopic = [...myStudies].sort((a, b) => (a.confidence || 0) - (b.confidence || 0))[0];
  const weakestWifeTopic = [...wifeStudies].sort((a, b) => (a.confidence || 0) - (b.confidence || 0))[0];

  // Investment totals (pulled fresh every time)
  const mfInvested = sum(state.mutualFunds, "invested");
  // Calculate MF current value from units × latestNav (same as fund summary & net worth)
  const mfCurrentCalc = (() => {
    const byFund = {};
    state.mutualFunds.forEach((t) => {
      const key = t.fundName || "Unknown";
      if (!byFund[key]) byFund[key] = { units: 0, latestNav: t.latestNav || t.nav || 0 };
      byFund[key].units += toNumber(t.units);
      if (t.latestNav) byFund[key].latestNav = toNumber(t.latestNav);
    });
    return Object.values(byFund).reduce((total, f) => total + f.units * f.latestNav, 0);
  })();
  const mfCurrent = mfCurrentCalc;
  const stocksVal = sum(state.stocks, "value");
  const fdVal = sum(state.fd, "value");
  const epfVal = sum(state.epf, "value");
  const ppfVal = sum(state.ppf, "value");
  const bondsVal = sum(state.bonds, "value");
  const goldVal = sum(state.gold, "value");
  const silverVal = sum(state.silver, "value");
  const cryptoVal = sum(state.crypto, "value");
  const usStocksVal = sum(state.usstocks, "value");
  const bankSavingVal = sum(state.banksaving, "value");
  const othersVal = sum(state.others, "value");
  const registeredAssets = sum(state.assets, "value");
  const allHoldingsTotal = mfCurrent + stocksVal + fdVal + epfVal + ppfVal + bondsVal + goldVal + silverVal + cryptoVal + usStocksVal + bankSavingVal + othersVal;
  const totalLiabilities = sum(state.liabilities, "value");

  // income totals
  const totalAllIncome = sum(state.income, "amount");
  const totalAllExpenses = sum(state.expenses, "amount");

  // helper for formatting owner splits
  function ownerSplit(arr, valKey) {
    const mine = sum(arr.filter((r) => (r.owner || r.paidBy || "Me") === "Me"), valKey);
    const hers = sum(arr.filter((r) => (r.owner || r.paidBy) === "Wife"), valKey);
    const both = sum(arr.filter((r) => (r.owner || r.paidBy) === "Both"), valKey);
    return { mine, hers, both };
  }

  // ─── GREET / HELLO ──────────────────────────────────────────────────────────
  if (/^(hi|hello|hey|howdy|sup|yo|namaste|hola)\b/.test(q)) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    return `${greeting}, Prafful! 👋 Ready to help.\n\n• Net worth: **${formatINR(metrics.netWorth)}**\n• This month income: **${formatINR(metrics.monthIncome)}** | expenses: **${formatINR(metrics.monthExpenses)}**\n• Pending tasks: **${pendingTasks.length}** | Active habits: **${state.habits.length}**\n• Career topics: **${state.studies.length}** tracked\n\nWhat do you want to know?`;
  }

  // ─── HOW MUCH / TOTAL / COUNT questions ─────────────────────────────────────
  // "how much in gold", "total gold", "how many mutual funds"
  if (/how (?:much|many)|total|count|kitna|kitne/.test(q)) {
    if (/mutual fund|mf\b|sip/.test(q)) {
      const fundCount = new Set(state.mutualFunds.map((f) => f.fundName)).size;
      const gain = mfCurrent - mfInvested;
      return `**Mutual Fund Data** 📈\n• Unique funds: **${fundCount}**\n• Total entries: **${state.mutualFunds.length}**\n• Invested: **${formatINR(mfInvested)}**\n• Current value: **${formatINR(mfCurrent)}**\n• Gain/Loss: **${formatINR(gain)}** (${mfInvested ? ((gain / mfInvested) * 100).toFixed(1) : 0}%)`;
    }
    if (/stock/.test(q) && !/us stock/.test(q)) return `**Indian Stocks**: **${formatINR(stocksVal)}** across **${state.stocks.length}** entries.`;
    if (/us stock|foreign/.test(q)) return `**US Stocks**: **${formatINR(usStocksVal)}** across **${state.usstocks.length}** entries.`;
    if (/\bfd\b|fixed deposit/.test(q)) return `**FD total**: **${formatINR(fdVal)}** across **${state.fd.length}** entries.`;
    if (/\bepf\b|provident fund/.test(q)) return `**EPF total**: **${formatINR(epfVal)}** across **${state.epf.length}** entries.`;
    if (/\bppf\b/.test(q)) return `**PPF total**: **${formatINR(ppfVal)}** across **${state.ppf.length}** entries.`;
    if (/gold/.test(q)) return `**Gold total**: **${formatINR(goldVal)}** across **${state.gold.length}** entries.`;
    if (/silver/.test(q)) return `**Silver total**: **${formatINR(silverVal)}** across **${state.silver.length}** entries.`;
    if (/crypto|bitcoin/.test(q)) return `**Crypto total**: **${formatINR(cryptoVal)}** across **${state.crypto.length}** entries.`;
    if (/bond/.test(q)) return `**Bonds total**: **${formatINR(bondsVal)}** across **${state.bonds.length}** entries.`;
    if (/bank/.test(q)) return `**Bank Savings total**: **${formatINR(bankSavingVal)}** across **${state.banksaving.length}** entries.`;
    if (/income|salary|earn/.test(q)) return `**Total income entries**: **${state.income.length}** totalling **${formatINR(totalAllIncome)}** (all time). This month: **${formatINR(metrics.monthIncome)}**.`;
    if (/expense|spend|kharcha/.test(q)) return `**Total expense entries**: **${state.expenses.length}** totalling **${formatINR(totalAllExpenses)}** (all time). This month: **${formatINR(metrics.monthExpenses)}**.`;
    if (/goal/.test(q)) return `**Goals**: **${state.goals.length}** tracked. ${state.goals.filter((g) => toNumber(g.saved) >= toNumber(g.target) && toNumber(g.target) > 0).length} completed.`;
    if (/task|todo/.test(q)) return `**Tasks**: **${state.tasks.length}** total. **${pendingTasks.length}** pending, **${doneTasks.length}** done.`;
    if (/habit/.test(q)) return `**Habits**: **${state.habits.length}** tracked. Best streak: **${[...state.habits].sort((a, b) => (b.streak || 0) - (a.streak || 0))[0]?.name || "none"}**.`;
    if (/stud|topic|career|roadmap/.test(q)) return `**Career/Study topics**: **${state.studies.length}** total. DevOps: **${myStudies.length}**, ETL: **${wifeStudies.length}**.`;
    if (/workout|exercise/.test(q)) return `**Workouts**: **${state.workouts.length}** logged.`;
    if (/asset/.test(q)) return `**Registered assets**: **${formatINR(registeredAssets)}** across **${state.assets.length}** entries.\n**Investment holdings**: **${formatINR(allHoldingsTotal)}**.`;
    if (/liabilit|loan|debt/.test(q)) return `**Liabilities**: **${formatINR(totalLiabilities)}** across **${state.liabilities.length}** entries.`;
    if (/net worth|networth/.test(q)) return `**Net worth**: **${formatINR(metrics.netWorth)}** (investments ${formatINR(metrics.assets)} − liabilities ${formatINR(totalLiabilities)}).\n_Only investment holdings counted — salary not included._`;
    if (/invest|portfolio/.test(q)) return `**Total investment holdings**: **${formatINR(allHoldingsTotal)}** across MF, stocks, FD, EPF, PPF, bonds, gold, silver, crypto, US stocks, bank savings, and others.`;
  }

  // ─── FINANCE SUMMARY / SAVINGS ──────────────────────────────────────────────
  if (/saving|surplus|finance summ|month.* summary|this month|kitna bacha/.test(q)) {
    const surplus = metrics.monthIncome - metrics.monthExpenses;
    const topCat = topMonthExpenses[0];
    let fallbackNote = "";
    if (metrics.isFallbackIncome) {
      fallbackNote = `\n⚠️ No income found for current month — using latest available (${metrics.fallbackMonthLabel}).`;
    }
    return `**Monthly Finance Summary** 📊\n• Income: **${formatINR(metrics.monthIncome)}**\n• Expenses: **${formatINR(metrics.monthExpenses)}**\n• Surplus: **${formatINR(surplus)}**\n• Savings rate: **${metrics.savingsRate}%**${topCat ? `\n• Top expense: **${topCat[0]}** — ${formatINR(topCat[1])}` : ""}${fallbackNote}\n\n${surplus > 0 ? "👍 Great job saving this month!" : "⚠️ Spending exceeds income. Check your top categories."}`;
  }

  // ─── EXPENSES ───────────────────────────────────────────────────────────────
  if (/expense|spend|kharcha|kharche|where.*money|cost|bill|budget/.test(q)) {
    if (!topMonthExpenses.length && !allExpenseCategories.length) return "No expenses recorded yet. Add entries via the Expenses tab or import your sheet.";
    const isAllTime = /all time|overall|total|all expense|ever/.test(q);
    const data = isAllTime ? allExpenseCategories : topMonthExpenses;
    const label = isAllTime ? "All-Time" : "This Month";
    if (!data.length) return `No expenses found for ${label.toLowerCase()}. Try asking "all time expenses" or add this month's data.`;
    const total = data.reduce((s, [, v]) => s + v, 0);
    const lines = data.slice(0, 6).map(([name, val], i) => `${i + 1}. **${name}**: ${formatINR(val)} (${total ? Math.round((val / total) * 100) : 0}%)`).join("\n");
    return `**${label} Expense Breakdown** 💸\n${lines}\n\n• Total: **${formatINR(total)}**\n• Categories tracked: **${data.length}**`;
  }

  // ─── NET WORTH ───────────────────────────────────────────────────────────────
  if (/net\s*worth|networth|wealth|total\s*asset/.test(q)) {
    return `**Net Worth** 💼\n_Formula: Investment Holdings (current value) − Liabilities_\n\n**Investments (current value only)**\n• Mutual Funds (current): ${formatINR(mfCurrent)}\n• Stocks: ${formatINR(stocksVal)}\n• FD: ${formatINR(fdVal)}\n• EPF: ${formatINR(epfVal)}\n• PPF: ${formatINR(ppfVal)}\n• Gold: ${formatINR(goldVal)}\n• Silver: ${formatINR(silverVal)}\n• Crypto: ${formatINR(cryptoVal)}\n• US Stocks: ${formatINR(usStocksVal)}\n• Bonds: ${formatINR(bondsVal)}\n• Bank Savings: ${formatINR(bankSavingVal)}\n• Others: ${formatINR(othersVal)}\n• **Total investments: ${formatINR(metrics.assets)}**\n\n**Liabilities (what you owe)**\n${state.liabilities.length ? state.liabilities.slice(0, 5).map((l) => `• ${l.name || l.category}: ${formatINR(l.value)}`).join("\n") : "• No liabilities"}\n• **Total liabilities: ${formatINR(totalLiabilities)}**\n\n**Net Worth: ${formatINR(metrics.netWorth)}**\n_MF invested amount (${formatINR(mfInvested)}) is NOT counted — only current value._`;
  }

  // ─── SALARY / INCOME ────────────────────────────────────────────────────────
  if (/salary|income|earn|in.hand|payslip|ctc|pay\b|wage|kamai/.test(q)) {
    if (!state.income.length) return "No income data found. Import salary sheets or add entries via the Income tab.";
    const byPerson = groupBy(state.income, (i) => i.person || "Me");
    const lines = Object.entries(byPerson).map(([person, rows]) => {
      const sorted = rows.sort((a, b) => new Date(a.date) - new Date(b.date));
      const latest = sorted.at(-1);
      const latestVal = latest?.netSalary || latest?.amount || 0;
      const first = sorted[0]?.netSalary || sorted[0]?.amount || 0;
      const growth = first && first !== latestVal ? (((latestVal - first) / first) * 100).toFixed(1) : "0";
      return `• **${person}**: ${formatINR(latestVal)} latest (${latest?.source || "—"}, ${formatDate(latest?.date)}) — ${growth}% growth tracked over ${sorted.length} entries`;
    });
    return `**Income / Salary** 💰\n${lines.join("\n")}\n\n• Total income entries: **${state.income.length}**\n• All-time total: **${formatINR(totalAllIncome)}**\n• This month: **${formatINR(metrics.monthIncome)}**`;
  }

  // ─── MUTUAL FUNDS ──────────────────────────────────────────────────────────
  if (/mutual fund|mf portfolio|sip|kuvera|groww|nav\b/.test(q)) {
    if (!state.mutualFunds.length) return "No mutual fund data. Import your MF statement or add entries manually.";
    const gain = mfCurrent - mfInvested;
    const fundNames = [...new Set(state.mutualFunds.map((f) => f.fundName))];
    const { mine, hers } = ownerSplit(state.mutualFunds, "currentValue");
    const topFunds = Object.entries(groupSum(state.mutualFunds, (f) => f.fundName || "Unknown", "currentValue"))
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, val]) => `  • ${name}: ${formatINR(val)}`).join("\n");
    return `**Mutual Fund Portfolio** 📈\n• Funds: **${fundNames.length}** | Transactions: **${state.mutualFunds.length}**\n• Invested: **${formatINR(mfInvested)}**\n• Current: **${formatINR(mfCurrent)}**\n• Gain/Loss: **${formatINR(gain)}** (${mfInvested ? ((gain / mfInvested) * 100).toFixed(1) : 0}%)\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}\n\n**Top funds:**\n${topFunds}`;
  }

  // ─── INDIVIDUAL INVESTMENT TYPES ────────────────────────────────────────────
  if (/\bstock\b|equity|share\b|nse|bse/.test(q) && !/us stock|foreign/.test(q)) {
    const { mine, hers } = ownerSplit(state.stocks, "value");
    const latest = [...state.stocks].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentEntries = latest.slice(0, 3).map((s) => `  • ${formatDate(s.date)}: ${formatINR(s.value)} (${s.owner || "Me"})${s.note ? " — " + s.note : ""}`).join("\n");
    return `**Indian Stocks** 📊\n• Total: **${formatINR(stocksVal)}** across **${state.stocks.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}\n\n${recentEntries ? "**Recent:**\n" + recentEntries : ""}`;
  }

  if (/us stock|usstocks|foreign|s&p|nasdaq|dollar invest/.test(q)) {
    const { mine, hers } = ownerSplit(state.usstocks, "value");
    return `**US Stocks / Foreign** 🌐\n• Total: **${formatINR(usStocksVal)}** across **${state.usstocks.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/gold|silver|precious|sona|chandi/.test(q)) {
    const gSplit = ownerSplit(state.gold, "value");
    const sSplit = ownerSplit(state.silver, "value");
    return `**Precious Metals** 🥇\n• Gold: **${formatINR(goldVal)}** (${state.gold.length} entries) — Prafful: ${formatINR(gSplit.mine)}, Wife: ${formatINR(gSplit.hers)}\n• Silver: **${formatINR(silverVal)}** (${state.silver.length} entries) — Prafful: ${formatINR(sSplit.mine)}, Wife: ${formatINR(sSplit.hers)}\n• Combined: **${formatINR(goldVal + silverVal)}**`;
  }

  if (/crypto|bitcoin|btc|eth\b|ethereum|web3|coin/.test(q)) {
    const { mine, hers } = ownerSplit(state.crypto, "value");
    return `**Crypto** 🔐\n• Total: **${formatINR(cryptoVal)}** across **${state.crypto.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/\bfd\b|fixed deposit/.test(q)) {
    const { mine, hers } = ownerSplit(state.fd, "value");
    return `**Fixed Deposits** 🏛️\n• Total: **${formatINR(fdVal)}** across **${state.fd.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/\bepf\b|employee provident|pf balance/.test(q)) {
    const { mine, hers } = ownerSplit(state.epf, "value");
    return `**EPF / Provident Fund** 🏢\n• Total: **${formatINR(epfVal)}** across **${state.epf.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/\bppf\b|public provident/.test(q)) {
    const { mine, hers } = ownerSplit(state.ppf, "value");
    return `**PPF** 🏦\n• Total: **${formatINR(ppfVal)}** across **${state.ppf.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/\bbond|debenture|sgb|sovereign/.test(q)) {
    const { mine, hers } = ownerSplit(state.bonds, "value");
    return `**Bonds** 📜\n• Total: **${formatINR(bondsVal)}** across **${state.bonds.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  if (/bank\s*saving|savings?\s*account|current\s*account/.test(q)) {
    const { mine, hers } = ownerSplit(state.banksaving, "value");
    return `**Bank Savings** 🏦\n• Total: **${formatINR(bankSavingVal)}** across **${state.banksaving.length}** entries\n• Prafful: ${formatINR(mine)} | Wife: ${formatINR(hers)}`;
  }

  // ─── FULL PORTFOLIO ─────────────────────────────────────────────────────────
  if (/portfolio|all invest|breakdown|where.*invest|invest/.test(q)) {
    const items = [
      ["Mutual Funds (current)", mfCurrent], ["Stocks", stocksVal], ["FD", fdVal], ["EPF", epfVal],
      ["PPF", ppfVal], ["Gold", goldVal], ["Silver", silverVal], ["Crypto", cryptoVal],
      ["US Stocks", usStocksVal], ["Bank Savings", bankSavingVal], ["Bonds", bondsVal], ["Others", othersVal],
    ].filter(([, v]) => v > 0);
    const total = items.reduce((s, [, v]) => s + v, 0);
    const lines = items.map(([name, val]) => `• ${name}: **${formatINR(val)}** (${total ? Math.round((val / total) * 100) : 0}%)`).join("\n");
    return `**Investment Portfolio Breakdown** 💹\n${lines}\n\n• **Total investments: ${formatINR(total)}**\n• **Net worth: ${formatINR(metrics.netWorth)}**\n_MF shows current value only, not invested amount._`;
  }

  // ─── LIABILITIES ────────────────────────────────────────────────────────────
  if (/liabilit|loan|debt|emi\b|borrow|owe|outstanding/.test(q)) {
    if (!state.liabilities.length) return "No liabilities tracked. Add loans, credit cards, or EMIs via the Liabilities tab.";
    const sorted = [...state.liabilities].sort((a, b) => toNumber(b.value) - toNumber(a.value));
    const lines = sorted.map((l) => `• **${l.name || l.category || "—"}** (${l.owner || "Both"}): ${formatINR(l.value)}`).join("\n");
    return `**Liabilities / Loans** ⚠️\n${lines}\n\n• **Total outstanding: ${formatINR(totalLiabilities)}**\n• Entries: **${state.liabilities.length}**`;
  }

  // ─── GOALS ──────────────────────────────────────────────────────────────────
  if (/goal|target|dream|ambition|lakshya/.test(q)) {
    if (!state.goals.length) return "No goals tracked yet. Add goals like house, vacation, emergency fund with a target and due date.";
    const completed = state.goals.filter((g) => toNumber(g.saved) >= toNumber(g.target) && toNumber(g.target) > 0);
    const lines = sortedGoals.map((g) => {
      const pct = toNumber(g.target) > 0 ? Math.round((toNumber(g.saved) / toNumber(g.target)) * 100) : 0;
      return `• **${g.name}** (${g.owner || "Me"}): ${formatINR(toNumber(g.saved))} / ${formatINR(toNumber(g.target))} — **${pct}%** done, due ${formatDate(g.dueDate)}`;
    }).join("\n");
    return `**Goals Tracker** 🎯\n${lines}\n\n• Total: **${state.goals.length}** (${completed.length} completed)`;
  }

  // ─── TASKS / TO-DO ──────────────────────────────────────────────────────────
  if (/task|todo|to.do|pending|checklist|kaam/.test(q)) {
    if (!state.tasks.length) return "No tasks tracked. Add to-do items via the Tasks tab.";
    const pendingLines = pendingTasks.slice(0, 8).map((t) => `• ${t.done ? "✅" : "⬜"} ${t.text}${t.area ? " [" + t.area + "]" : ""}`).join("\n");
    return `**To-Do List** ✅\n• Pending: **${pendingTasks.length}** | Done: **${doneTasks.length}** | Total: **${state.tasks.length}**\n\n${pendingLines || "All tasks completed! 🎉"}`;
  }

  // ─── HABITS ─────────────────────────────────────────────────────────────────
  if (/habit|streak|routine|discipline/.test(q)) {
    if (!state.habits.length) return "No habits tracked yet. Add daily habits like reading, exercise, or learning to track streaks.";
    const sorted = [...state.habits].sort((a, b) => (b.streak || 0) - (a.streak || 0));
    const myLines = sorted.filter((h) => (h.owner || "Me") === "Me" || h.owner === "Both")
      .map((h) => `• ${h.name} — 🔥 **${h.streak || 0}** day streak (${h.frequency || "Daily"})`).join("\n");
    const wifeLines = sorted.filter((h) => h.owner === "Wife")
      .map((h) => `• ${h.name} — 🔥 **${h.streak || 0}** day streak (${h.frequency || "Daily"})`).join("\n");
    return `**Habit Tracker** 🔥\n\n**Prafful's habits:**\n${myLines || "• None yet"}\n\n**Wife's habits:**\n${wifeLines || "• None yet"}\n\nTotal: **${state.habits.length}** habits tracked`;
  }

  // ─── EXERCISE / WORKOUTS ────────────────────────────────────────────────────
  if (/exercise|workout|gym|walk\b|run\b|yoga|fitness|active|health/.test(q)) {
    if (!state.workouts.length) return "No workouts logged yet. Add exercises via the Exercise tab.";
    const sorted = [...state.workouts].sort((a, b) => new Date(b.date) - new Date(a.date));
    const recent = sorted.slice(0, 7);
    const totalMin = recent.reduce((s, w) => s + toNumber(w.minutes), 0);
    const todayWorked = state.workouts.some((w) => sameDay(w.date, todayISO()));
    const lines = recent.map((w) => `• ${formatDate(w.date)}: **${w.type || "Workout"}** — ${w.minutes || 0} min (${w.intensity || "—"})`).join("\n");
    return `**Exercise Log** 🏃\n${lines}\n\n• Last 7 sessions: **${totalMin} min** total\n• All-time workouts: **${state.workouts.length}**\n• Today: ${todayWorked ? "✅ Done" : "⚠️ Not yet — go for a walk!"}`;
  }

  // ─── DEVOPS / SRE ───────────────────────────────────────────────────────────
  if (/devops|sre|site reliab|kubernetes|k8s|cloud|aws|gcp|azure|terraform|jenkins|ci.cd|docker|monitoring|infra|mlops/.test(q)) {
    if (!myStudies.length) return "No DevOps/SRE roadmap topics added. Go to Career → DevOps/SRE tab to start.";
    const avgConf = Math.round(myStudies.reduce((s, t) => s + (t.confidence || 0), 0) / myStudies.length);
    const completed = myStudies.filter((t) => t.status === "Completed");
    const inProg = myStudies.filter((t) => t.status === "In progress");
    const planned = myStudies.filter((t) => t.status === "Planned");
    const lines = myStudies.sort((a, b) => (a.confidence || 0) - (b.confidence || 0))
      .map((t) => `• **${t.topic}**: ${t.confidence || 0}% confidence, ${t.hours || 0}/${t.targetHours || 20}h (${t.status || "Planned"})`).join("\n");
    return `**DevOps/SRE Roadmap (Prafful)** 🚀\n${lines}\n\n• Topics: **${myStudies.length}** (${completed.length} ✅, ${inProg.length} 🔄, ${planned.length} 📋)\n• Avg confidence: **${avgConf}%**\n• Focus on: **${weakestMyTopic?.topic || "—"}** (${weakestMyTopic?.confidence || 0}%)`;
  }

  // ─── ETL / DATA ENGINEER ────────────────────────────────────────────────────
  if (/etl|data engineer|airflow|spark|pipeline|dbt|warehouse|wife.*career|wife.*study|wife.*roadmap/.test(q)) {
    if (!wifeStudies.length) return "No ETL/Data Engineering topics added for wife. Go to Career → ETL/Data tab to start.";
    const avgConf = Math.round(wifeStudies.reduce((s, t) => s + (t.confidence || 0), 0) / wifeStudies.length);
    const completed = wifeStudies.filter((t) => t.status === "Completed");
    const inProg = wifeStudies.filter((t) => t.status === "In progress");
    const planned = wifeStudies.filter((t) => t.status === "Planned");
    const lines = wifeStudies.sort((a, b) => (a.confidence || 0) - (b.confidence || 0))
      .map((t) => `• **${t.topic}**: ${t.confidence || 0}% confidence, ${t.hours || 0}/${t.targetHours || 20}h (${t.status || "Planned"})`).join("\n");
    return `**ETL/Data Engineering Roadmap (Wife)** 📊\n${lines}\n\n• Topics: **${wifeStudies.length}** (${completed.length} ✅, ${inProg.length} 🔄, ${planned.length} 📋)\n• Avg confidence: **${avgConf}%**\n• Focus on: **${weakestWifeTopic?.topic || "—"}** (${weakestWifeTopic?.confidence || 0}%)`;
  }

  // ─── CAREER SUMMARY ─────────────────────────────────────────────────────────
  if (/career|study|roadmap|learn|skill|progress|interview|switch|prep/.test(q)) {
    const myAvg = myStudies.length ? Math.round(myStudies.reduce((s, t) => s + (t.confidence || 0), 0) / myStudies.length) : 0;
    const wifeAvg = wifeStudies.length ? Math.round(wifeStudies.reduce((s, t) => s + (t.confidence || 0), 0) / wifeStudies.length) : 0;
    return `**Career Roadmap** 🎓\n\n**Prafful (SRE/DevOps)**: ${myStudies.length} topics, ${myAvg}% avg\n• Focus: ${weakestMyTopic?.topic || "add topics"}\n\n**Wife (ETL/Data Eng)**: ${wifeStudies.length} topics, ${wifeAvg}% avg\n• Focus: ${weakestWifeTopic?.topic || "add topics"}\n\nTotal study hours: **${state.studies.reduce((s, t) => s + (t.hours || 0), 0)}h** logged`;
  }

  // ─── TODAY ──────────────────────────────────────────────────────────────────
  if (/today|daily plan|what.*do\b|morning|tonight|focus|aaj/.test(q)) {
    const todayTasks = pendingTasks.slice(0, 5);
    const worked = state.workouts.some((w) => sameDay(w.date, todayISO()));
    const topHabit = [...myHabits].sort((a, b) => (b.streak || 0) - (a.streak || 0))[0];
    return `**Today's Plan** 📅\n\n**Tasks:**\n${todayTasks.length ? todayTasks.map((t) => `• ⬜ ${t.text}`).join("\n") : "• All clear! ✨"}\n\n**Exercise:** ${worked ? "✅ Done today" : "⚠️ Not yet"}\n**Habit streak to protect:** ${topHabit ? `${topHabit.name} (🔥 ${topHabit.streak || 0} days)` : "Add habits"}\n**Study focus:** ${weakestMyTopic?.topic || "Add career topics"}`;
  }

  // ─── COMPARE ME VS WIFE ─────────────────────────────────────────────────────
  if (/compare|vs\b|versus|couple|family|husband|wife/.test(q)) {
    const myIncome = sum(state.income.filter((i) => (i.person || "Me") === "Me"), "amount");
    const wifeIncome = sum(state.income.filter((i) => i.person === "Wife"), "amount");
    const myMf = sum(state.mutualFunds.filter((f) => (f.owner || "Me") === "Me"), "currentValue");
    const wifeMf = sum(state.mutualFunds.filter((f) => f.owner === "Wife"), "currentValue");
    const myStocks = sum(state.stocks.filter((s) => (s.owner || "Me") === "Me"), "value");
    const wifeStocks = sum(state.stocks.filter((s) => s.owner === "Wife"), "value");
    return `**Prafful vs Wife** 👫\n\n| | Prafful | Wife |\n|---|---|---|\n| Total income | ${formatINR(myIncome)} | ${formatINR(wifeIncome)} |\n| Mutual funds | ${formatINR(myMf)} | ${formatINR(wifeMf)} |\n| Stocks | ${formatINR(myStocks)} | ${formatINR(wifeStocks)} |\n| Career topics | ${myStudies.length} | ${wifeStudies.length} |\n| Goals | ${myGoals.length} | ${wifeGoals.length} |\n| Habits | ${myHabits.length} | ${wifeHabits.filter((h) => h.owner === "Wife").length} |`;
  }

  // ─── OVERVIEW / HOW AM I DOING ──────────────────────────────────────────────
  if (/how.*doing|overview|status|snapshot|quick|all\b|everything|sab kuch/.test(q)) {
    return `**Life Ledger Overview** 🌟\n\n💰 **Net worth: ${formatINR(metrics.netWorth)}**\n• Investments: ${formatINR(metrics.assets)} | Liabilities: ${formatINR(totalLiabilities)}\n• Month income: ${formatINR(metrics.monthIncome)} | Expenses: ${formatINR(metrics.monthExpenses)} | Savings: ${metrics.savingsRate}%\n\n📈 **Investments: ${formatINR(allHoldingsTotal)}**\n• MF: ${formatINR(mfCurrent)} | Stocks: ${formatINR(stocksVal)} | Gold: ${formatINR(goldVal)} | Crypto: ${formatINR(cryptoVal)}\n\n🎯 **Life**: ${pendingTasks.length} tasks pending | ${state.habits.length} habits | ${state.goals.length} goals | ${state.studies.length} career topics\n\n🏃 Workouts: ${state.workouts.length} logged${state.workouts.some((w) => sameDay(w.date, todayISO())) ? " (✅ today)" : ""}`;
  }

  // ─── HELP / FALLBACK ────────────────────────────────────────────────────────
  return `I can answer questions about all your Life Ledger data 😊\n\nTry asking:\n• "How much in gold?" or "total mutual funds"\n• "This month saving"\n• "Net worth"\n• "Show expenses" or "all time expenses"\n• "Salary income"\n• "My DevOps roadmap" or "wife ETL progress"\n• "Habits and streaks"\n• "Pending tasks"\n• "Goals"\n• "Compare me and wife"\n• "Today's plan"\n• "Full portfolio breakdown"\n• "How am I doing?"`;
}

function calculateMetrics() {
  let monthIncomeRows = state.income.filter((income) => isTargetDashboardMonth(income.date));
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

  const monthExpenseRows = state.expenses.filter((expense) => isTargetDashboardMonth(expense.date));
  const monthIncome = sum(monthIncomeRows, "amount");
  const monthExpenses = sum(monthExpenseRows, "amount");
  const holdings = investmentHoldingsTotal();
  const liabilities = sum(state.liabilities, "value");
  const topExpenseCategory =
    Object.entries(groupSum(monthExpenseRows, (expense) => expense.category || "General", "amount")).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  return {
    monthIncome,
    monthExpenses,
    assets: holdings,
    liabilities,
    netWorth: holdings - liabilities,
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

function calculateReadiness(owner = "Me") {
  const list = state.studies.filter(topic => (topic.owner || "Me") === owner);
  const studyAverage = list.length
    ? Math.round(list.reduce((total, topic) => total + (topic.confidence || 0), 0) / list.length)
    : 0;
  const projectTopic = list.find((topic) => /resume|project|etl|ware/i.test(topic.topic || ""));
  const dsaTopic = list.find((topic) => /dsa|data|algo|spark|python/i.test(topic.topic || ""));
  const systemTopic = list.find((topic) => /system|design|airflow|pipeline/i.test(topic.topic || ""));
  return [
    { title: "Overall readiness", meta: "Average confidence across topics", value: `${studyAverage}%` },
    {
      title: owner === "Me" ? "DSA & Cloud signal" : "Spark & Python signal",
      meta: dsaTopic ? `${dsaTopic.hours || 0}/${dsaTopic.targetHours || 20}h completed` : "Add core programming topic",
      value: `${dsaTopic?.confidence || 0}%`,
    },
    {
      title: owner === "Me" ? "System Design signal" : "ETL & Airflow signal",
      meta: systemTopic ? `${systemTopic.hours || 0}/${systemTopic.targetHours || 20}h completed` : "Add system/workflow topic",
      value: `${systemTopic?.confidence || 0}%`,
    },
    {
      title: "Projects/Architecture",
      meta: projectTopic ? projectTopic.status || "In progress" : "Add project topic",
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
  // Auto-detect delimiter: check first line for tabs vs commas
  const firstLine = text.split(/\r?\n/)[0] || "";
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? "\t" : ",";

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
    } else if (char === delimiter && !inQuotes) {
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
  console.log(`[parseCSV] Detected delimiter: ${delimiter === "\t" ? "TAB" : "COMMA"}, Headers: [${headers.join(", ")}], Data rows: ${rows.length}`);
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
      career: "Career Roadmaps",
      goals: "Goals Tracker",
      todo: "To-Do List & Keep Notes",
      exercise: "Exercise & Workout Tracker",
      habits: "Habit Tracker & Streaks",
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

function getFundCodesCache() {
  try {
    const cache = localStorage.getItem("lifeLedgerFundCodes:v3");
    if (!cache) {
      // Clean up legacy caches
      localStorage.removeItem("lifeLedgerFundCodes");
      localStorage.removeItem("lifeLedgerFundCodes:v2");
      return {};
    }
    return JSON.parse(cache);
  } catch {
    return {};
  }
}

function saveFundCodesCache(cache) {
  try {
    localStorage.setItem("lifeLedgerFundCodes:v3", JSON.stringify(cache));
  } catch (e) {
    console.warn("Failed to write fund codes cache:", e);
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

  // Custom overrides for known difficult scheme codes
  const overrides = {
    "large & mid cap fund direct growth": {
      schemeCode: "152821",
      schemeName: "ITI Large & Midcap Fund - Direct Plan - Growth"
    },
    "large & midcap fund direct growth": {
      schemeCode: "152821",
      schemeName: "ITI Large & Midcap Fund - Direct Plan - Growth"
    },
    "large and mid cap fund direct growth": {
      schemeCode: "152821",
      schemeName: "ITI Large & Midcap Fund - Direct Plan - Growth"
    }
  };

  fundNames.forEach(name => {
    const norm = name.trim().toLowerCase().replace(/\s+/g, ' ');
    if (overrides[norm]) {
      cache[name] = overrides[norm];
    }
  });

  const missing = fundNames.filter(name => !cache[name]);
  
  if (missing.length === 0) {
    saveFundCodesCache(cache);
    return cache;
  }
  
  toast("Fetching mutual fund master list to resolve codes...");
  try {
    const response = await fetch("https://api.mfapi.in/mf");
    if (!response.ok) throw new Error("Failed to fetch mutual fund master list.");
    const allFunds = await response.json();
    
    // Normalize cap size terms to avoid midcap/mid cap issues
    function cleanAndNormalize(str) {
      if (!str) return "";
      let cleaned = str.toLowerCase().replace(/[^a-z0-9\s]+/g, ' ');
      return cleaned
        .replace(/mid\s+cap/g, 'midcap')
        .replace(/large\s+cap/g, 'largecap')
        .replace(/small\s+cap/g, 'smallcap')
        .replace(/multi\s+cap/g, 'multicap')
        .replace(/micro\s+cap/g, 'microcap');
    }
    
    missing.forEach(query => {
      const queryNorm = cleanAndNormalize(query);
      const queryWords = queryNorm.split(/\s+/).filter(w => w.length > 1);
      
      const noiseWords = new Set([
        "me", "wife", "sip", "lumpsum", "mutual", "fund", "funds", 
        "investment", "investments", "my", "our", "portfolio", "she", 
        "he", "both", "direct", "regular", "growth", "idcw", "dividend", 
        "payout", "reinvestment", "plan", "option"
      ]);
      
      const amcCandidates = queryWords.filter(w => !noiseWords.has(w));
      const amcWord = amcCandidates[0];
      let best = null;
      let bestScore = -Infinity;
      
      const isGrowthPreferred = !query.toLowerCase().includes('dividend') && !query.toLowerCase().includes('idcw');
      const isDirectPreferred = !query.toLowerCase().includes('regular');

      for (const scheme of allFunds) {
        const name = scheme.schemeName;
        const nameNorm = cleanAndNormalize(name);
        const schemeWords = nameNorm.split(/\s+/).filter(w => w.length > 1);
        
        if (amcWord && !schemeWords.includes(amcWord)) continue;
        
        const overlap = queryWords.filter(w => schemeWords.includes(w)).length;
        if (overlap === 0) continue;
        
        let score = (overlap * 100) - Math.abs(name.length - query.length);
        if (isGrowthPreferred && nameNorm.includes('growth')) score += 50;
        if (isDirectPreferred && nameNorm.includes('direct')) score += 20;

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
// NAVs refresh if: forced, or cache is older than 4 hours, or the stored NAV date differs from today
const MF_CACHE_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours (was 12 — reduced so same-day NAV updates are picked up)

function getTodayDateStr() {
  // Returns DD-MM-YYYY matching mfapi.in date format
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function isNavStale(cached) {
  if (!cached) return true;
  // Stale if older than MF_CACHE_EXPIRY
  if (Date.now() - (cached.timestamp || 0) > MF_CACHE_EXPIRY) return true;
  // Stale if today's date doesn't match cached nav date (new trading day)
  // NAVs are published after ~9 PM IST for that day's close
  const todayStr = getTodayDateStr();
  if (cached.date && cached.date !== todayStr) {
    // Only force-refresh after 9 PM IST (3:30 PM UTC)
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    if (nowIST.getHours() >= 21) return true; // After 9 PM IST, today's NAV is available
  }
  return false;
}

function updateMutualFundsFromCache() {
  const codesCache = getFundCodesCache();
  const navCache = getNavCache();

  state.mutualFunds.forEach(item => {
    const cachedCodeObj = codesCache[item.fundName];
    if (cachedCodeObj) {
      const cachedNavObj = navCache[cachedCodeObj.schemeCode];
      if (cachedNavObj) {
        item.latestNav = cachedNavObj.nav;
        item.navDate = cachedNavObj.date || null;
        item.prevNav = cachedNavObj.prevNav || null;
        item.currentValue = toNumber(item.units) * cachedNavObj.nav;
      }
    }
  });
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


async function refreshMutualFundNAVs(force = false) {
  const uniqueNames = [...new Set(state.mutualFunds.map(item => item.fundName).filter(Boolean))];
  if (uniqueNames.length === 0) return;

  try {
    const codesCache = await resolveSchemeCodes(uniqueNames);
    const schemeEntries = uniqueNames
      .map(name => ({ name, code: codesCache[name]?.schemeCode }))
      .filter(e => e.code);

    if (schemeEntries.length === 0) return;

    const navCache = getNavCache();
    const now = Date.now();
    let updatedCount = 0;

    // Show spinner only if we are going to actually fetch
    const needsFetch = force || schemeEntries.some(e => isNavStale(navCache[e.code]));
    if (needsFetch) toast('Refreshing mutual fund NAVs from mfapi.in…');

    for (const { name, code } of schemeEntries) {
      const cached = navCache[code];

      if (!force && !isNavStale(cached)) {
        continue; // cache is fresh — skip fetch
      }

      try {
        // Fetch full history — data[0] = latest, data[1] = previous trading day
        // This is needed for 1-day change calculation
        const response = await fetch(`https://api.mfapi.in/mf/${code}`);
        if (!response.ok) continue;
        const json = await response.json();

        if (json && json.status === 'SUCCESS' && Array.isArray(json.data) && json.data[0]) {
          const todayEntry = json.data[0];
          const prevEntry = json.data[1] || null;

          navCache[code] = {
            nav: toNumber(todayEntry.nav),
            date: todayEntry.date,
            prevNav: prevEntry ? toNumber(prevEntry.nav) : null,
            prevDate: prevEntry ? prevEntry.date : null,
            timestamp: now,
          };
          updatedCount += 1;

          // Asynchronously pre-fetch and cache full history for Smart Insights
          fetchHistoricalNAV(code).catch(() => {});
        }
        // Small delay to avoid hammering the API
        await new Promise(r => setTimeout(r, 80));
      } catch (e) {
        console.warn(`Failed to fetch NAV for ${code} (${name}):`, e);
      }
    }

    if (updatedCount > 0 || force) {
      saveNavCache(navCache);
      if (needsFetch) {
        toast(updatedCount > 0 ? `✓ Updated ${updatedCount} NAV${updatedCount > 1 ? 's' : ''} from mfapi.in` : 'NAVs are already up to date.');
      }

      // Push freshened NAVs into state
      state.mutualFunds.forEach(item => {
        const cachedCodeObj = codesCache[item.fundName];
        if (cachedCodeObj) {
          const cachedNavObj = navCache[cachedCodeObj.schemeCode];
          if (cachedNavObj) {
            item.latestNav = cachedNavObj.nav;
            item.navDate = cachedNavObj.date;
            item.prevNav = cachedNavObj.prevNav;
            item.currentValue = toNumber(item.units) * cachedNavObj.nav;
          }
        }
      });
      await saveData(true);
      renderMutualFundsPanel();
    }
  } catch (err) {
    console.error('Failed to refresh mutual fund NAVs:', err);
    toast('⚠ NAV refresh failed — showing cached values.');
  }
}

function calculateXIRR(cashFlows) {
  if (!cashFlows || cashFlows.length < 2) return 0;
  
  const cleaned = cashFlows
    .map(cf => ({
      date: new Date(cf.date),
      amount: Number(cf.amount)
    }))
    .filter(cf => !isNaN(cf.date.getTime()) && !isNaN(cf.amount) && cf.amount !== 0);
    
  if (cleaned.length < 2) return 0;
  
  cleaned.sort((a, b) => a.date - b.date);
  const d1 = cleaned[0].date;
  
  let hasPositive = false;
  let hasNegative = false;
  for (const cf of cleaned) {
    if (cf.amount > 0) hasPositive = true;
    if (cf.amount < 0) hasNegative = true;
  }
  if (!hasPositive || !hasNegative) return 0;
  
  const years = cleaned.map(cf => (cf.date - d1) / (1000 * 60 * 60 * 24 * 365));
  
  function f(r) {
    let sum = 0;
    for (let i = 0; i < cleaned.length; i++) {
      const cf = cleaned[i];
      const t = years[i];
      const divisor = Math.pow(Math.max(1e-4, 1 + r), t);
      sum += cf.amount / divisor;
    }
    return sum;
  }
  
  function df(r) {
    let sum = 0;
    for (let i = 0; i < cleaned.length; i++) {
      const cf = cleaned[i];
      const t = years[i];
      if (t === 0) continue;
      const divisor = Math.pow(Math.max(1e-4, 1 + r), t + 1);
      sum += -t * cf.amount / divisor;
    }
    return sum;
  }
  
  let r = 0.1;
  const maxIterations = 100;
  const tolerance = 1e-6;
  
  for (let i = 0; i < maxIterations; i++) {
    const val = f(r);
    const deriv = df(r);
    if (Math.abs(deriv) < 1e-12) break;
    
    const nextR = r - val / deriv;
    if (isNaN(nextR) || !isFinite(nextR)) break;
    
    if (Math.abs(nextR - r) < tolerance) {
      const result = nextR * 100;
      return isNaN(result) || !isFinite(result) ? 0 : result;
    }
    r = r + Math.max(-0.5, Math.min(0.5, nextR - r));
  }
  
  // Bisection fallback
  let low = -0.999;
  let high = 5.0;
  let valLow = f(low);
  let valHigh = f(high);
  
  if (valLow * valHigh > 0) {
    let found = false;
    for (let h = 5.0; h <= 100.0; h *= 2) {
      const val = f(h);
      if (val * valLow < 0) {
        high = h;
        valHigh = val;
        found = true;
        break;
      }
    }
    if (!found) {
      for (let l = -0.9; l > -0.999999; l = -1 + (1 + l) * 0.1) {
        const val = f(l);
        if (val * valHigh < 0) {
          low = l;
          valLow = val;
          found = true;
          break;
        }
      }
    }
  }
  
  if (f(low) * f(high) <= 0) {
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const valMid = f(mid);
      if (Math.abs(valMid) < tolerance || (high - low) < tolerance) {
        const result = mid * 100;
        return isNaN(result) || !isFinite(result) ? 0 : result;
      }
      if (valMid * f(low) < 0) {
        high = mid;
      } else {
        low = mid;
      }
    }
  }
  
  // Fallback to simple ROI
  const totalInvested = cleaned.reduce((sum, cf) => cf.amount < 0 ? sum - cf.amount : sum, 0);
  const totalReceived = cleaned.reduce((sum, cf) => cf.amount > 0 ? sum + cf.amount : sum, 0);
  if (totalInvested > 0) {
    const result = ((totalReceived - totalInvested) / totalInvested) * 100;
    return isNaN(result) || !isFinite(result) ? 0 : result;
  }
  return 0;
}

function isTargetDashboardMonth(dateValue) {
  const date = parseCalendarDate(dateValue);
  if (!date) return false;
  const key = monthKey(date);
  const targetKey = activeDashboardMonth || monthKey(new Date());
  return key === targetKey;
}

function listDashboardMonths() {
  const months = new Set();
  
  // Populate from income
  state.income.forEach((item) => {
    const key = toMonthKey(item.date);
    if (key) months.add(key);
  });
  
  // Populate from expenses
  state.expenses.forEach((item) => {
    const key = toMonthKey(item.date);
    if (key) months.add(key);
  });
  
  // Always ensure current month is in options as a fallback
  months.add(monthKey(new Date()));
  
  return [...months].sort().reverse();
}

function renderDashboardPeriodSelector() {
  const select = document.getElementById("dashboardMonthSelect");
  if (!select) return;
  
  const months = listDashboardMonths();
  select.innerHTML = "";
  
  months.forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    
    const [year, month] = key.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    option.textContent = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    select.append(option);
  });
  
  if (activeDashboardMonth && months.includes(activeDashboardMonth)) {
    select.value = activeDashboardMonth;
  } else {
    const currentKey = monthKey(new Date());
    if (months.includes(currentKey)) {
      activeDashboardMonth = currentKey;
    } else {
      activeDashboardMonth = months[0] || currentKey;
    }
    select.value = activeDashboardMonth;
  }
}

function bindDashboard() {
  document.getElementById("dashboardMonthSelect")?.addEventListener("change", (event) => {
    activeDashboardMonth = event.target.value;
    renderMetrics();
    renderExpenseMix();
  });
}

function renderExpensesAnalysis() {
  const metricsContainer = document.getElementById("expenseAnalysisMetrics");
  const biggestPurchasesContainer = document.getElementById("biggestPurchasesList");
  const budgetOptimizationContainer = document.getElementById("budgetOptimizationList");
  
  if (!metricsContainer || !biggestPurchasesContainer || !budgetOptimizationContainer) return;
  
  const allExpenses = [...state.expenses];
  if (allExpenses.length === 0) {
    metricsContainer.innerHTML = "";
    biggestPurchasesContainer.innerHTML = `<div class="empty-state">Upload expenses to see your pro analysis dashboard.</div>`;
    budgetOptimizationContainer.innerHTML = `<div class="empty-state">Upload expenses to see budget advice.</div>`;
    return;
  }
  
  const totalSpent = sum(allExpenses, "amount");
  
  // Calculate average per month based on unique months in expenses only
  const expenseMonths = new Set();
  allExpenses.forEach(e => {
    const key = toMonthKey(e.date);
    if (key) expenseMonths.add(key);
  });
  const monthsCount = Math.max(1, expenseMonths.size);
  const avgMonthlySpend = totalSpent / monthsCount;
  
  const sortedByAmount = [...allExpenses].sort((a, b) => toNumber(b.amount) - toNumber(a.amount));
  
  // Discretionary spend identification
  const discretionaryKeywords = /shop|dining|restaurant|food|swiggy|zomato|movie|entertainment|travel|uber|ola|cab|pub|party|gift|leisure/i;
  let discretionaryTotal = 0;
  allExpenses.forEach(e => {
    const cat = String(e.category || "").toLowerCase();
    const note = String(e.note || "").toLowerCase();
    if (discretionaryKeywords.test(cat) || discretionaryKeywords.test(note)) {
      discretionaryTotal += toNumber(e.amount);
    }
  });
  const discretionaryPct = Math.round((discretionaryTotal / totalSpent) * 100);
  
  metricsContainer.innerHTML = `
    <article class="metric-card compact-metric">
      <div class="label">Total Paid Till Now</div>
      <div class="value">${formatINR(totalSpent)}</div>
      <div class="hint">Across ${monthsCount} months</div>
    </article>
    <article class="metric-card compact-metric">
      <div class="label">Avg Monthly Spend</div>
      <div class="value">${formatINR(avgMonthlySpend)}</div>
      <div class="hint">All-time average</div>
    </article>
    <article class="metric-card compact-metric">
      <div class="label">Discretionary Spend</div>
      <div class="value">${formatINR(discretionaryTotal)}</div>
      <div class="hint">${discretionaryPct}% of all time spend</div>
    </article>
  `;
  
  biggestPurchasesContainer.innerHTML = "";
  sortedByAmount.slice(0, 5).forEach(item => {
    const row = document.createElement("div");
    row.className = "stack-row";
    row.innerHTML = `
      <div>
        <div class="stack-title">${escapeHTML(item.note || item.category || "Purchase")}</div>
        <div class="stack-meta">${formatDate(item.date)} • ${escapeHTML(item.category)} • Paid by ${escapeHTML(item.paidBy || "Both")}</div>
      </div>
      <div class="stack-value" style="color: var(--danger); font-weight:600;">${formatINR(item.amount)}</div>
    `;
    biggestPurchasesContainer.append(row);
  });
  
  const catSums = {};
  allExpenses.forEach(e => {
    const cat = e.category || "General";
    catSums[cat] = (catSums[cat] || 0) + toNumber(e.amount);
  });
  const sortedCategories = Object.entries(catSums).sort((a, b) => b[1] - a[1]);
  
  budgetOptimizationContainer.innerHTML = "";
  const optimizationTips = [];
  
  if (discretionaryPct > 40) {
    optimizationTips.push({
      title: "High Discretionary Spending ⚠️",
      desc: `Your discretionary spending (dining, shopping, cabs) represents ${discretionaryPct}% of total expenses. Target keeping this under 30% to boost savings.`,
      action: `Potential monthly savings: ${formatINR((discretionaryTotal * 0.2) / monthsCount)} (at 20% cut)`
    });
  } else {
    optimizationTips.push({
      title: "Balanced Discretionary Spending ✅",
      desc: `Your discretionary spending is at ${discretionaryPct}% of total expenses, which is within the healthy budget zone.`,
      action: "Keep tracking discretionary categories month-on-month."
    });
  }
  
  sortedCategories.slice(0, 3).forEach(([cat, val]) => {
    const monthlyVal = val / monthsCount;
    const potentialSaving = monthlyVal * 0.15;
    optimizationTips.push({
      title: `Optimize ${cat} Spend`,
      desc: `You spend an average of ${formatINR(monthlyVal)} per month on ${cat}.`,
      action: `Reducing this by 15% would save ${formatINR(potentialSaving)} monthly.`
    });
  });
  
  optimizationTips.forEach(tip => {
    const itemEl = document.createElement("div");
    itemEl.className = "stack-row";
    itemEl.style.flexDirection = "column";
    itemEl.style.alignItems = "stretch";
    itemEl.style.padding = "10px 0";
    itemEl.style.borderBottom = "1px solid var(--line)";
    itemEl.innerHTML = `
      <div style="font-weight: 700; color: var(--brand); font-size: 0.9rem; margin-bottom: 2px;">${escapeHTML(tip.title)}</div>
      <div style="font-size: 0.8rem; color: var(--muted); margin-bottom: 4px; line-height: 1.4;">${escapeHTML(tip.desc)}</div>
      <div style="font-size: 0.8rem; font-weight: 600; color: var(--ink);">${escapeHTML(tip.action)}</div>
    `;
    budgetOptimizationContainer.append(itemEl);
  });
}

function bindGoals() {
  const searchInput = document.getElementById("goalSearchInput");
  const categoryFilter = document.getElementById("goalCategoryFilter");
  const ownerFilter = document.getElementById("goalOwnerFilter");
  const statusFilter = document.getElementById("goalStatusFilter");
  const sortSelector = document.getElementById("goalSortSelector");

  const listener = () => renderGoals();

  searchInput?.addEventListener("input", listener);
  categoryFilter?.addEventListener("change", listener);
  ownerFilter?.addEventListener("change", listener);
  statusFilter?.addEventListener("change", listener);
  sortSelector?.addEventListener("change", listener);

  // Click handler to redirect dashboard link to goals panel
  document.getElementById("dashboardGoalPanel")?.addEventListener("click", () => {
    activeView = "goals";
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === "goals");
    });
    renderAll();
    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ═════════════════════════════════════════════════════════════════
// SMART INSIGHTS — Historical NAV analysis engine
// ═════════════════════════════════════════════════════════════════

const MF_HISTORY_CACHE_KEY = 'mfNavHistory:v1';
const MF_HISTORY_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getMfHistoryCache() {
  try { return JSON.parse(localStorage.getItem(MF_HISTORY_CACHE_KEY) || '{}'); }
  catch { return {}; }
}
function saveMfHistoryCache(cache) {
  try { localStorage.setItem(MF_HISTORY_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

async function fetchHistoricalNAV(schemeCode) {
  const cache = getMfHistoryCache();
  const cached = cache[schemeCode];
  if (cached && (Date.now() - cached.timestamp) < MF_HISTORY_TTL && cached.data?.length > 10) {
    return cached.data;
  }
  try {
    const res = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
    if (!res.ok) return cached?.data || [];
    const json = await res.json();
    if (json?.status === 'SUCCESS' && Array.isArray(json.data) && json.data.length > 0) {
      // Parse and sort oldest-first
      const parsed = json.data.map(d => ({
        date: parseNavDate(d.date),
        nav: parseFloat(d.nav)
      })).filter(d => d.date && !isNaN(d.nav)).reverse();
      cache[schemeCode] = { data: parsed, timestamp: Date.now() };
      saveMfHistoryCache(cache);
      return parsed;
    }
  } catch (e) { console.warn(`fetchHistoricalNAV(${schemeCode}) failed:`, e); }
  return cached?.data || [];
}

function parseNavDate(dateStr) {
  // DD-MM-YYYY to Date
  const [d, m, y] = dateStr.split('-').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

// ── Technical Indicators ────────────────────────────────────────

function computeSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((s, d) => s + d.nav, 0) / period;
}

function computeRSI(data, period = 14) {
  if (data.length < period + 1) return null;
  const recent = data.slice(-(period + 1));
  let gains = 0, losses = 0;
  for (let i = 1; i < recent.length; i++) {
    const change = recent[i].nav - recent[i - 1].nav;
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function computeCAGR(startNav, endNav, years) {
  if (!startNav || startNav <= 0 || !endNav || years <= 0) return null;
  return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
}

function computeMaxDrawdown(data) {
  if (data.length < 2) return 0;
  let peak = data[0].nav;
  let maxDd = 0;
  for (const d of data) {
    if (d.nav > peak) peak = d.nav;
    const dd = (peak - d.nav) / peak;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd * 100;
}

function computeVolatility(data, days = 30) {
  if (data.length < days + 1) return null;
  const recent = data.slice(-(days + 1));
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i].nav - recent[i - 1].nav) / recent[i - 1].nav);
  }
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized
}

function computeConsistency(data) {
  // % of rolling 1-year windows where return > 8%
  if (data.length < 252) return null;
  let good = 0, total = 0;
  for (let i = 252; i < data.length; i++) {
    const startNav = data[i - 252].nav;
    const endNav = data[i].nav;
    const ret = ((endNav - startNav) / startNav) * 100;
    if (ret > 8) good++;
    total++;
  }
  return total > 0 ? (good / total) * 100 : null;
}

function computeNavVs30dAvg(data) {
  if (data.length < 30) return null;
  const avg = data.slice(-30).reduce((s, d) => s + d.nav, 0) / 30;
  const current = data[data.length - 1].nav;
  return ((current - avg) / avg) * 100;
}

function computeFundInsights(navHistory) {
  const result = {
    cagr1y: null, cagr3y: null, cagr5y: null,
    maxDrawdown: 0,
    sma50: null, sma200: null,
    rsi14: null,
    volatility30d: null,
    consistencyScore: null,
    navVs30d: null,
    signalScore: 0,
    signal: 'hold',
    signalLabel: 'Hold · Continue SIP',
    reasons: []
  };
  if (!navHistory || navHistory.length < 30) {
    result.reasons.push('Insufficient data for analysis (need 30+ trading days)');
    return result;
  }

  const currentNav = navHistory[navHistory.length - 1].nav;
  const len = navHistory.length;
  let score = 0;
  const reasons = [];

  // CAGR
  if (len >= 252) {
    result.cagr1y = computeCAGR(navHistory[len - 252].nav, currentNav, 1);
    if (result.cagr1y !== null) {
      if (result.cagr1y > 15) { score += 1; reasons.push(`Strong 1-year return of ${result.cagr1y.toFixed(1)}%`); }
      else if (result.cagr1y < 0) { score -= 1; reasons.push(`Negative 1-year return of ${result.cagr1y.toFixed(1)}%`); }
    }
  }
  if (len >= 756) {
    result.cagr3y = computeCAGR(navHistory[len - 756].nav, currentNav, 3);
    if (result.cagr3y !== null) {
      if (result.cagr3y > 15) { score += 2; reasons.push(`Excellent 3-year CAGR of ${result.cagr3y.toFixed(1)}%`); }
      else if (result.cagr3y < 5) { score -= 2; reasons.push(`Weak 3-year CAGR of only ${result.cagr3y.toFixed(1)}%`); }
    }
  }
  if (len >= 1260) {
    result.cagr5y = computeCAGR(navHistory[len - 1260].nav, currentNav, 5);
  }

  // Max Drawdown
  result.maxDrawdown = computeMaxDrawdown(navHistory);
  if (result.maxDrawdown > 30) { score -= 1; reasons.push(`High max drawdown of ${result.maxDrawdown.toFixed(1)}%`); }

  // SMA Crossover
  result.sma50 = computeSMA(navHistory, 50);
  result.sma200 = computeSMA(navHistory, 200);
  if (result.sma50 && result.sma200) {
    if (currentNav > result.sma200) { score += 1; reasons.push('NAV is above 200-day moving average (uptrend)'); }
    else { score -= 1; reasons.push('NAV is below 200-day moving average (downtrend)'); }
    if (result.sma50 > result.sma200) { score += 1; reasons.push('Golden cross: 50-day SMA above 200-day SMA'); }
    else { score -= 1; reasons.push('Death cross: 50-day SMA below 200-day SMA'); }
  }

  // RSI
  result.rsi14 = computeRSI(navHistory);
  if (result.rsi14 !== null) {
    if (result.rsi14 < 30) { score += 2; reasons.push(`RSI at ${result.rsi14.toFixed(0)} — oversold territory (potential buy signal)`); }
    else if (result.rsi14 < 40) { score += 1; reasons.push(`RSI at ${result.rsi14.toFixed(0)} — approaching oversold`); }
    else if (result.rsi14 > 70) { score -= 1; reasons.push(`RSI at ${result.rsi14.toFixed(0)} — overbought territory`); }
  }

  // Volatility
  result.volatility30d = computeVolatility(navHistory, 30);
  if (result.volatility30d !== null && result.volatility30d > 25) {
    score -= 1;
    reasons.push(`High 30-day volatility at ${result.volatility30d.toFixed(1)}% annualized`);
  }

  // Consistency
  result.consistencyScore = computeConsistency(navHistory);
  if (result.consistencyScore !== null) {
    if (result.consistencyScore > 70) { score += 1; reasons.push(`${result.consistencyScore.toFixed(0)}% of 1-year periods delivered 8%+ returns`); }
    else if (result.consistencyScore < 40) { score -= 1; reasons.push(`Only ${result.consistencyScore.toFixed(0)}% of 1-year periods delivered 8%+ returns`); }
  }

  // NAV vs 30d average
  result.navVs30d = computeNavVs30dAvg(navHistory);
  if (result.navVs30d !== null) {
    if (result.navVs30d <= -5) { score += 2; reasons.push(`NAV is ${Math.abs(result.navVs30d).toFixed(1)}% below its 30-day average — potential entry point`); }
    else if (result.navVs30d <= -2) { score += 1; reasons.push(`NAV is ${Math.abs(result.navVs30d).toFixed(1)}% below its 30-day average`); }
    else if (result.navVs30d >= 5) { score -= 1; reasons.push(`NAV is ${result.navVs30d.toFixed(1)}% above its 30-day average — consider waiting for a dip`); }
  }

  // Final signal
  result.signalScore = score;
  if (score >= 4) { result.signal = 'invest'; result.signalLabel = 'Invest More'; }
  else if (score >= 1) { result.signal = 'hold'; result.signalLabel = 'Hold · Continue SIP'; }
  else if (score >= -1) { result.signal = 'caution'; result.signalLabel = 'Caution · Avoid Lump Sum'; }
  else { result.signal = 'exit'; result.signalLabel = 'Review · Consider Exit'; }

  result.reasons = reasons;
  return result;
}

// ── NAV Timing Badge HTML ───────────────────────────────────────
function getNavTimingBadgeHtml(navVs30d) {
  if (navVs30d === null) return '';
  if (navVs30d <= -5) return '<span class="nav-timing-badge badge-low">▼ Low · Invest</span>';
  if (navVs30d <= -2) return '<span class="nav-timing-badge badge-below">▼ Below Avg</span>';
  if (navVs30d <= 2)  return '<span class="nav-timing-badge badge-fair">● Fair</span>';
  if (navVs30d <= 5)  return '<span class="nav-timing-badge badge-above">▲ Above Avg</span>';
  return '<span class="nav-timing-badge badge-high">▲ High · Wait</span>';
}

// ── Sparkline Drawing ───────────────────────────────────────────
function drawSparkline(canvas, navData, sma50Arr, sma200Arr) {
  if (!canvas || !navData || navData.length < 2) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.offsetWidth;
  const h = canvas.offsetHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const allNavs = navData.map(d => d.nav);
  const min = Math.min(...allNavs) * 0.998;
  const max = Math.max(...allNavs) * 1.002;
  const range = max - min || 1;

  const toX = (i) => (i / (navData.length - 1)) * w;
  const toY = (v) => h - ((v - min) / range) * (h - 4) - 2;

  // Fill area under NAV line
  ctx.beginPath();
  ctx.moveTo(toX(0), h);
  navData.forEach((d, i) => ctx.lineTo(toX(i), toY(d.nav)));
  ctx.lineTo(toX(navData.length - 1), h);
  ctx.closePath();
  const isDark = document.body.dataset.theme === 'dark';
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isDark ? 'rgba(59,130,246,0.15)' : 'rgba(23,107,91,0.1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // NAV line
  ctx.beginPath();
  navData.forEach((d, i) => { i === 0 ? ctx.moveTo(toX(i), toY(d.nav)) : ctx.lineTo(toX(i), toY(d.nav)); });
  ctx.strokeStyle = isDark ? '#3b82f6' : '#176b5b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // SMA 50 line (yellow)
  if (sma50Arr && sma50Arr.length > 1) {
    const offset = navData.length - sma50Arr.length;
    ctx.beginPath();
    sma50Arr.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i + offset), toY(v)) : ctx.lineTo(toX(i + offset), toY(v)); });
    ctx.strokeStyle = 'rgba(234,179,8,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // SMA 200 line (cyan)
  if (sma200Arr && sma200Arr.length > 1) {
    const offset = navData.length - sma200Arr.length;
    ctx.beginPath();
    sma200Arr.forEach((v, i) => { i === 0 ? ctx.moveTo(toX(i + offset), toY(v)) : ctx.lineTo(toX(i + offset), toY(v)); });
    ctx.strokeStyle = 'rgba(6,182,212,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function computeSMAArray(data, period) {
  const arr = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j].nav;
    arr.push(sum / period);
  }
  return arr;
}

// ── Render Smart Insights Panel ─────────────────────────────────
async function renderMfInsightsPanel() {
  const panel = document.getElementById('mfInsightsPanel');
  if (!panel) return;

  // Show loading
  panel.innerHTML = `
    <div class="mf-insights-loading">
      <div class="spinner-dot"></div>
      <div class="spinner-dot"></div>
      <div class="spinner-dot"></div>
      <span>Analyzing fund performance…</span>
    </div>`;

  const uniqueNames = [...new Set(state.mutualFunds
    .filter(t => matchHoldingsOwner(t.owner, activeHoldingsOwner))
    .map(t => t.fundName)
    .filter(Boolean))];

  if (uniqueNames.length === 0) {
    panel.innerHTML = `<div style="padding:32px;text-align:center;color:var(--muted)">No mutual funds to analyze for ${activeHoldingsOwner}.</div>`;
    return;
  }

  const codesCache = getFundCodesCache();
  const cards = [];

  for (const fundName of uniqueNames) {
    const codeObj = codesCache[fundName];
    if (!codeObj?.schemeCode) {
      cards.push({ fundName, error: 'Scheme code not resolved' });
      continue;
    }

    try {
      const history = await fetchHistoricalNAV(codeObj.schemeCode);
      if (!history || history.length < 10) {
        cards.push({ fundName, error: 'Not enough historical data' });
        continue;
      }

      const insights = computeFundInsights(history);

      // Get 1-year slice for sparkline
      const oneYearData = history.slice(-252);
      const sma50 = computeSMAArray(oneYearData, 50);
      const sma200 = history.length >= 200 ? computeSMAArray(history.slice(-452), 200).slice(-oneYearData.length) : [];

      // Calculate fund's invested + current for the selected owner
      const fundTxns = state.mutualFunds.filter(t => t.fundName === fundName && matchHoldingsOwner(t.owner, activeHoldingsOwner));
      const totalInvested = fundTxns.reduce((s, t) => s + toNumber(t.invested), 0);
      const totalUnits = fundTxns.reduce((s, t) => s + toNumber(t.units), 0);
      const latestNav = history[history.length - 1].nav;
      const currentValue = totalUnits * latestNav;

      cards.push({
        fundName, insights, oneYearData, sma50, sma200,
        totalInvested, currentValue, totalUnits, latestNav
      });
    } catch (e) {
      cards.push({ fundName, error: e.message });
    }

    // Small delay between fetches
    await new Promise(r => setTimeout(r, 60));
  }

  // Sort by signal score descending (best signals first)
  cards.sort((a, b) => (b.insights?.signalScore || -99) - (a.insights?.signalScore || -99));

  let html = '<div class="insights-grid">';

  for (const card of cards) {
    if (card.error) {
      html += `
        <article class="insight-card" style="opacity: 0.7;">
          <div class="insight-card-header">
            <div class="fund-name" title="${escapeHTML(card.fundName)}">${escapeHTML(card.fundName)}</div>
            <span class="signal-badge signal-caution">No Data</span>
          </div>
          <div style="padding: 24px; text-align: center; color: var(--muted); font-size: 0.8rem;">
            ${escapeHTML(card.error)}
          </div>
        </article>
      `;
      continue;
    }

    const ins = card.insights;
    const signalClass = `signal-${ins.signal}`;
    const valueGainClass = (card.currentValue - card.totalInvested) >= 0 ? 'positive' : 'negative';

    html += `
      <article class="insight-card">
        <div class="insight-card-header">
          <div class="fund-name" title="${escapeHTML(card.fundName)}">${escapeHTML(card.fundName)}</div>
          <span class="signal-badge ${signalClass}">${ins.signalLabel}</span>
        </div>
        <div class="insight-sparkline">
          <canvas data-fund="${escapeHTML(card.fundName)}"></canvas>
        </div>
        <div class="insight-metrics">
          <div class="insight-metric-cell">
            <div class="metric-label">Invested / Value</div>
            <div class="metric-value">${formatINR(card.totalInvested)} / <span class="${valueGainClass}">${formatINR(card.currentValue)}</span></div>
          </div>
          <div class="insight-metric-cell">
            <div class="metric-label">Latest NAV</div>
            <div class="metric-value">${formatINR(card.latestNav)} <span style="font-size:0.7em;opacity:0.6">${ins.navVs30d !== null ? `${ins.navVs30d >= 0 ? '+' : ''}${ins.navVs30d.toFixed(1)}% vs 30d avg` : ''}</span></div>
          </div>
          <div class="insight-metric-cell">
            <div class="metric-label">1Y / 3Y CAGR</div>
            <div class="metric-value">${ins.cagr1y !== null ? `${ins.cagr1y.toFixed(1)}%` : '—'} / ${ins.cagr3y !== null ? `${ins.cagr3y.toFixed(1)}%` : '—'}</div>
          </div>
          <div class="insight-metric-cell">
            <div class="metric-label">RSI / Volatility</div>
            <div class="metric-value">${ins.rsi14 !== null ? ins.rsi14.toFixed(0) : '—'} / ${ins.volatility30d !== null ? `${ins.volatility30d.toFixed(1)}%` : '—'}</div>
          </div>
        </div>
        <div class="insight-reasons">
          <div class="insight-reasons-title">Key Indicators</div>
          <ul>
            ${ins.reasons.length > 0 
              ? ins.reasons.map(r => `<li>${escapeHTML(r)}</li>`).join('') 
              : '<li>Fund performing within normal historical ranges. Continue regular investing.</li>'}
          </ul>
        </div>
      </article>
    `;
  }

  html += '</div>';
  
  html += `
    <div class="insight-disclaimer">
      <strong>Disclaimer</strong>: Smart Insights are generated using quantitative indicators (SMA, RSI, CAGR, volatility) computed from historical NAV data.
      They do NOT constitute financial advice. Always consult a qualified financial advisor before making investment decisions.
      Past performance does not guarantee future returns.
    </div>
  `;

  panel.innerHTML = html;

  // Draw sparklines after DOM is updated
  requestAnimationFrame(() => {
    for (const card of cards) {
      if (card.error) continue;
      const canvas = panel.querySelector(`canvas[data-fund="${CSS.escape(card.fundName)}"]`);
      if (canvas) drawSparkline(canvas, card.oneYearData, card.sma50, card.sma200);
    }
  });
}


