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
let activeStockView = "holdings";
// ── Sortable Holdings State ──
let mfSortCol = 'currentValue', mfSortDir = 'desc';
let stockSortCol = 'currentValue', stockSortDir = 'desc';
let usStockSortCol = 'currentValue', usStockSortDir = 'desc';
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
    ["owner", "Owner (Me / Wife)", "select"],
    ["symbol", "Symbol / Ticker (e.g. RELIANCE)", "text"],
    ["company", "Company Name", "text"],
    ["exchange", "Exchange", "select"],
    ["category", "Category", "select"],
    ["quantity", "Quantity", "number"],
    ["avgPrice", "Avg Buy Price (₹)", "number"],
    ["invested", "Total Invested (₹)", "number"],
    ["purchaseDate", "Purchase Date", "date"],
    ["demat", "Broker / Demat", "text"],
    ["notes", "Notes", "textarea"],
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
    ["owner", "Owner (Me / Wife)", "select"],
    ["symbol", "Symbol / Ticker (e.g. AAPL, VOO)", "text"],
    ["company", "Company Name", "text"],
    ["exchange", "Exchange", "select"],
    ["category", "Category", "select"],
    ["quantity", "Quantity", "number"],
    ["avgPrice", "Avg Buy Price ($)", "number"],
    ["invested", "Total Invested ($)", "number"],
    ["purchaseDate", "Purchase Date", "date"],
    ["demat", "Broker / Platform", "text"],
    ["notes", "Notes", "textarea"],
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

if (typeof document !== "undefined") {
  applyTheme(loadTheme());
}

let isAppInitialized = false;

function bootstrapApp(initialState) {
  state = normalizeData(initialState || defaultData);
  if (!isAppInitialized) {
    bindTheme();
    bindNavigation();
    bindModals();
    bindFinanceTabs();
    initStockCSVImport();
    bindCareerTabs();
    bindImports();
    bindReset();
    bindChat();
    bindExport();
    bindAiSettings();
    bindDashboard();
    bindGoals();
    bindTodoAndKeepEvents();
    bindExerciseEvents();
    bindHabitsEvents();
    isAppInitialized = true;
  }
  renderAll();
  refreshMutualFundNAVs(false);
  refreshStockPrices(false);
  refreshUsStockPrices(false);

  // Load AI insights in background (non-blocking)
  setTimeout(() => loadAiInsights(), 1500);
}

if (typeof window !== "undefined") {
  window.LifeLedgerApp = {
    defaultData: () => clone(defaultData),
    bootstrap: bootstrapApp,
    saveData: saveData,
    flushSave: () => {
      if (saveDataTimer) {
        clearTimeout(saveDataTimer);
        saveDataTimer = null;
        return saveData(true);
      }
      return Promise.resolve();
    },
    getState: () => state,
    renderAll: renderAll,
  };
}

let saveDataTimer;
let isSaving = false;
let currentSavePromise = null;
let failedSaveRetryPending = false;

function saveData(immediate = false, kind = null) {
  if (!kind || kind === "expense" || kind === "expenses" || kind === "income") {
    invalidateExpenseCache();
  }
  if (!window.LifeLedgerAuth?.isUnlocked()) return Promise.resolve();
  clearTimeout(saveDataTimer);

  const saveAction = async () => {
    saveDataTimer = null;
    isSaving = true;
    try {
      await window.LifeLedgerAuth.saveAppData(state);
      failedSaveRetryPending = false;
    } catch (error) {
      console.warn(error);
      toast(error.message || "Could not save encrypted vault.");
      // Mark for retry on next visibility change or user interaction
      failedSaveRetryPending = true;
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
      }, 400); // 400ms debounce (was 700ms) — faster saves for mobile
    });
  }
}

// ─── Reliable save on page close / app switch ──────────────────────────────
if (typeof window !== "undefined") {
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

  window.addEventListener("pagehide", (event) => {
    if (saveDataTimer) {
      clearTimeout(saveDataTimer);
      saveDataTimer = null;
      saveData(true);
    }
  });
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (saveDataTimer) {
        console.log("[app.js] Page hidden — flushing pending save.");
        clearTimeout(saveDataTimer);
        saveDataTimer = null;
        saveData(true);
      }
      if (failedSaveRetryPending && window.LifeLedgerAuth?.isUnlocked()) {
        console.log("[app.js] Retrying failed save on visibility hide...");
        failedSaveRetryPending = false;
        saveData(true);
      }
    } else {
      if (failedSaveRetryPending && window.LifeLedgerAuth?.isUnlocked()) {
        console.log("[app.js] Tab re-focused — retrying failed save...");
        failedSaveRetryPending = false;
        saveData(true);
      }
    }
  });
}

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
  if (typeof document === "undefined" || !document.body) return;
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
    expenses: ensureIds(data.expenses || [], "exp").map(exp => {
      const amt = Math.abs(toNumber(exp.amount));
      if (exp.amount === amt) return exp;
      return { ...exp, amount: amt };
    }),
    assets: ensureIds(data.assets || [], "asset"),
    liabilities: ensureIds(data.liabilities || [], "liab"),
    mutualFunds: ensureIds(data.mutualFunds || [], "mf").map(t => ({
      ...t,
      transactionType: normalizeTransactionType(t.transactionType)
    })),
    stocks: (() => {
      const rawStocks = Array.isArray(data.stocks) ? data.stocks : [];
      const hasMe = rawStocks.some(s => (s.owner === 'Me' || !s.owner) && (s.symbol || s.company));
      const hasWife = rawStocks.some(s => s.owner === 'Wife' && (s.symbol || s.company));

      const defaultMe = defaultStockHoldings.filter(s => s.owner === 'Me');
      const defaultWife = defaultStockHoldings.filter(s => s.owner === 'Wife');

      const meList = hasMe ? rawStocks.filter(s => s.owner === 'Me' || !s.owner) : defaultMe;
      const wifeList = hasWife ? rawStocks.filter(s => s.owner === 'Wife') : defaultWife;
      const bothList = rawStocks.filter(s => s.owner === 'Both');

      return ensureIds([...meList, ...wifeList, ...bothList], "stk");
    })(),
    fd: ensureIds(data.fd || [], "fd"),
    epf: ensureIds(data.epf || [], "epf"),
    bonds: ensureIds(data.bonds || [], "bond"),
    ppf: ensureIds(data.ppf || [], "ppf"),
    gold: ensureIds(data.gold || [], "gold"),
    silver: ensureIds(data.silver || [], "slv"),
    crypto: ensureIds(data.crypto || [], "crp"),
    usstocks: (() => {
      const rawStocks = Array.isArray(data.usstocks) ? data.usstocks : [];
      const hasRich = rawStocks.some(s => s.symbol || s.company);
      const list = hasRich ? rawStocks : defaultUsStockHoldings;
      return ensureIds(list, "uss");
    })(),
    banksaving: ensureIds(data.banksaving || [], "sav"),
    others: ensureIds(data.others || [], "oth"),
    goals: ensureIds(data.goals || [], "goal").map(g => {
      if (g.owner === "Both" || g.owner) return g;
      return { ...g, owner: "Both" };
    }),
    tasks: ensureIds(data.tasks || [], "task"),
    studies: ensureIds(data.studies || [], "study").map(s => {
      if (s.owner === "Me" || s.owner) return s;
      return { ...s, owner: "Me" };
    }),
    workouts: ensureIds(data.workouts || [], "work"),
    bodyMetrics: (() => {
      const raw = Array.isArray(data.bodyMetrics) ? data.bodyMetrics : [];
      const hasRich = raw.some(b => b.weight || b.bmi);
      const list = hasRich ? raw : defaultBodyMetrics;
      return ensureIds(list, "bm");
    })(),
    habits: ensureIds(data.habits || [], "habit"),
    chat: ensureIds(data.chat || [], "chat"),
    mfMonthlyTarget: data.mfMonthlyTarget || { me: 100000, wife: 100000 },
    interviewPrep: data.interviewPrep || { mastered: [], flagged: [], customProjects: [] },
  };
}

function ensureIds(items, prefix) {
  let changed = false;
  const result = items.map((item) => {
    if (item.id) return item;
    changed = true;
    return { ...item, id: `${prefix}-${generateUUID()}` };
  });
  return result;
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

  document.getElementById("expenseSearchInput")?.addEventListener("input", debounce(() => {
    activeExpensePage = 0;
    renderExpenseExplorer(false);
  }, 150));

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
        renderExpensesOnly();
        toast("Salary entry deleted.");
        saveData(true, "income");
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
        renderExpensesOnly();
        toast("Mutual fund transaction deleted.");
        saveData(true, "mutualFund");
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
          if (kind === "expense" || kind === "income" || kind === "asset" || kind === "liability" || kind === "mutualFund" || kind === "stock" || kind === "fd" || kind === "epf" || kind === "bonds" || kind === "ppf" || kind === "gold" || kind === "silver" || kind === "crypto" || kind === "usstocks" || kind === "banksaving" || kind === "others") {
            renderExpensesOnly();
          } else if (kind === "task") {
            renderTodoOnly();
          } else if (kind === "goal") {
            renderGoalsOnly();
          } else if (kind === "workout") {
            renderExerciseOnly();
            renderDashboardOnly();
          } else if (kind === "habit") {
            renderHabitsOnly();
            renderDashboardOnly();
          } else if (kind === "study") {
            renderCareerOnly();
          } else {
            renderAll();
          }
          toast(`${kind.charAt(0).toUpperCase() + kind.slice(1)} entry deleted.`);
          saveData(true, kind);
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-stock-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm('stock', id);
      const modal = document.getElementById('quickAddModal');
      if (modal) modal.hidden = false;
    }
    const deleteBtn = e.target.closest('.delete-stock-btn');
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (confirm('Delete this stock entry?')) {
        state.stocks = state.stocks.filter(s => s.id !== id);
        saveData(true, 'stock');
        renderStockHoldingsPanel();
        toast('Stock entry deleted.');
      }
    }
  });

  document.getElementById("refreshMutualFundNAVsBtn")?.addEventListener("click", async () => {
    await refreshMutualFundNAVs(true);
  });

  document.getElementById("redeemFundBtn")?.addEventListener("click", () => {
    buildQuickAddForm("mutualFund");
    const txnTypeSelect = document.querySelector('#quickAddForm [name="transactionType"]');
    if (txnTypeSelect) {
      txnTypeSelect.value = "REDEMPTION";
      txnTypeSelect.dispatchEvent(new Event("change"));
    }
    openModal("quickAddModal");
  });

  document.getElementById('toggleStockViewHoldings')?.addEventListener('click', () => {
    activeStockView = 'holdings';
    document.getElementById('toggleStockViewHoldings')?.classList.add('active');
    document.getElementById('toggleStockViewTxns')?.classList.remove('active');
    renderStockHoldingsPanel();
  });
  document.getElementById('toggleStockViewTxns')?.addEventListener('click', () => {
    activeStockView = 'txns';
    document.getElementById('toggleStockViewTxns')?.classList.add('active');
    document.getElementById('toggleStockViewHoldings')?.classList.remove('active');
    renderStockHoldingsPanel();
  });
  document.getElementById('refreshStockPricesBtn')?.addEventListener('click', () => refreshStockPrices(true));

  document.querySelectorAll('[data-stock-broker]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-stock-broker]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeStockBroker = btn.dataset.stockBroker;
      renderStockHoldingsPanel();
    });
  });

  document.getElementById('restoreStockPortfolioBtn')?.addEventListener('click', async () => {
    if (confirm('Load your real Upstox (8 ETFs) + Zerodha (11 Stocks) holdings into Life Ledger?')) {
      state.stocks = clone(defaultStockHoldings);
      await saveData(true, 'stock');
      renderStockHoldingsPanel();
      renderAll();
      toast('✅ Real Upstox (8 ETFs) + Zerodha (11 Stocks) holdings loaded!');
    }
  });

  document.getElementById('toggleUsStockViewHoldings')?.addEventListener('click', () => {
    activeUsStockView = 'holdings';
    document.getElementById('toggleUsStockViewHoldings')?.classList.add('active');
    document.getElementById('toggleUsStockViewTxns')?.classList.remove('active');
    renderUsStockHoldingsPanel();
  });
  document.getElementById('toggleUsStockViewTxns')?.addEventListener('click', () => {
    activeUsStockView = 'txns';
    document.getElementById('toggleUsStockViewTxns')?.classList.add('active');
    document.getElementById('toggleUsStockViewHoldings')?.classList.remove('active');
    renderUsStockHoldingsPanel();
  });
  document.getElementById('refreshUsStockPricesBtn')?.addEventListener('click', () => refreshUsStockPrices(true));

  document.querySelectorAll('[data-us-broker]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-us-broker]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeUsStockBroker = btn.dataset.usBroker;
      renderUsStockHoldingsPanel();
    });
  });

  document.getElementById('restoreUsStockPortfolioBtn')?.addEventListener('click', async () => {
    if (confirm('Load real US portfolio (AAPL, T, VOO, META) into Life Ledger?')) {
      state.usstocks = clone(defaultUsStockHoldings);
      await saveData(true, 'usstocks');
      renderUsStockHoldingsPanel();
      renderAll();
      toast('✅ Real US stock holdings loaded into portfolio!');
    }
  });

  document.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-usstock-btn');
    if (editBtn) {
      const id = editBtn.dataset.id;
      buildQuickAddForm('usstocks', id);
      const modal = document.getElementById('quickAddModal');
      if (modal) modal.hidden = false;
      return;
    }
    const delBtn = e.target.closest('.delete-usstock-btn');
    if (delBtn) {
      const id = delBtn.dataset.id;
      if (confirm('Are you sure you want to delete this US stock entry?')) {
        state.usstocks = state.usstocks.filter(s => s.id !== id);
        saveData(true, 'usstocks');
        renderUsStockHoldingsPanel();
        toast('🗑️ US stock entry deleted.');
      }
    }
  });

  document.getElementById("syncExpensesFromDriveBtn")?.addEventListener("click", () => {
    syncExpensesFromDrive();
  });

  document.querySelectorAll(".sync-holdings-btn")?.forEach(btn => {
    btn.addEventListener("click", () => {
      syncHoldingsFromDrive();
    });
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
      
      const addBtn = document.getElementById("careerAddBtn");
      if (addBtn) {
        addBtn.style.display = activeCareerTab === "interview" ? "none" : "";
      }
      
      renderCareer();
    });
  });

  // Initialize prep controls and simulator once
  initInterviewControls();
  initSimulator();

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
  const input = document.getElementById("chatInput");

  // Helper: create a live streaming bubble
  function createStreamBubble() {
    const log = document.getElementById("chatLog");
    const bubble = document.createElement("div");
    bubble.className = "chat-message assistant streaming";
    bubble.innerHTML = `<span class="stream-cursor">▋</span>`;
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  }

  function updateStreamBubble(bubble, text) {
    bubble.innerHTML = formatChatMarkdown(text) + `<span class="stream-cursor">▋</span>`;
    const log = document.getElementById("chatLog");
    log.scrollTop = log.scrollHeight;
  }

  function finalizeStreamBubble(bubble, text) {
    bubble.classList.remove("streaming");
    bubble.innerHTML = formatChatMarkdown(text);
    const log = document.getElementById("chatLog");
    log.scrollTop = log.scrollHeight;
  }

  async function sendMessage(question) {
    if (!question) return;
    addChat("user", question);
    input.value = "";
    input.disabled = true;

    if (window.LifeLedgerAI?.isAiAvailable() && window.LifeLedgerAI?.streamAgent) {
      // ── Streaming path ──
      hideTypingIndicator();
      const streamBubble = createStreamBubble();
      const recentHistory = state.chat.filter(m => m.role === "user" || m.role === "assistant").slice(-10);
      const dataContext = window.LifeLedgerAI.buildDataContext(state);

      let isFinished = false;
      const watchdog = setTimeout(() => {
        if (isFinished) return;
        isFinished = true;
        console.warn("[AI Agent] Stream timed out after 60s");
        window.LifeLedgerAI?.cancelRequest?.();
        streamBubble.remove();
        const fallback = answerQuestion(question);
        addChat("assistant", fallback + "\n\n_⚠️ AI response timed out. Please check your API key or network connection._");
        input.disabled = false;
        input.focus();
      }, 60000);

      window.LifeLedgerAI.streamAgent(
        question,
        dataContext,
        recentHistory,
        // onChunk — called on every token batch
        (accumulatedText) => {
          if (isFinished) return;
          updateStreamBubble(streamBubble, accumulatedText);
        },
        // onDone — called when stream finishes
        (fullText) => {
          if (isFinished) return;
          isFinished = true;
          clearTimeout(watchdog);
          finalizeStreamBubble(streamBubble, fullText);
          state.chat.push({ id: `chat-${generateUUID()}`, role: "assistant", text: fullText, at: new Date().toISOString() });
          saveData();
          input.disabled = false;
          input.focus();
        },
        // onError — fallback to regex answer
        (err) => {
          if (isFinished) return;
          isFinished = true;
          clearTimeout(watchdog);
          console.warn("[AI Agent] Stream error:", err.message);
          streamBubble.remove();
          const fallback = answerQuestion(question);
          addChat("assistant", fallback + "\n\n_⚠️ AI error: " + err.message + "_");
          input.disabled = false;
          input.focus();
        }
      );
    } else if (window.LifeLedgerAI?.isAiAvailable()) {
      // ── Non-streaming fallback ──
      showTypingIndicator();
      try {
        const recentHistory = state.chat.filter(m => m.role === "user" || m.role === "assistant").slice(-10);
        const aiResponse = await window.LifeLedgerAI.askAgent(question, state, recentHistory);
        hideTypingIndicator();
        addChat("assistant", aiResponse);
      } catch (error) {
        hideTypingIndicator();
        addChat("assistant", answerQuestion(question) + "\n\n_⚠️ AI unavailable: " + error.message + "_");
      }
      input.disabled = false;
      input.focus();
    } else {
      // ── Offline regex fallback ──
      addChat("assistant", answerQuestion(question));
      input.disabled = false;
      input.focus();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    await sendMessage(question);
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", async () => {
      const question = button.dataset.prompt;
      await sendMessage(question);
    });
  });

  // Daily Briefing button
  document.getElementById("dailyBriefingBtn")?.addEventListener("click", async () => {
    if (!window.LifeLedgerAI?.isAiAvailable()) {
      toast("Set up your Gemini API key in Settings to use AI features.");
      return;
    }
    addChat("user", "📋 Generate my daily briefing");
    showTypingIndicator();
    try {
      const briefing = await window.LifeLedgerAI.generateDailyBriefing(state);
      hideTypingIndicator();
      addChat("assistant", briefing);
    } catch (error) {
      hideTypingIndicator();
      addChat("assistant", "Could not generate briefing: " + error.message);
    }
  });

  ensureAssistantWelcome(true);
  updateAiModeBadge();
}

function showTypingIndicator() {
  const log = document.getElementById("chatLog");
  let indicator = document.getElementById("aiTypingIndicator");
  if (!indicator) {
    indicator = document.createElement("div");
    indicator.id = "aiTypingIndicator";
    indicator.className = "chat-message assistant ai-typing";
    indicator.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div> <span class="typing-text">AI is thinking...</span>';
  }
  log.append(indicator);
  log.scrollTop = log.scrollHeight;
}

function hideTypingIndicator() {
  document.getElementById("aiTypingIndicator")?.remove();
}

function updateAiModeBadge() {
  const label = document.getElementById("aiModeLabel");
  const badge = document.getElementById("aiModeBadge");
  const dot = badge?.querySelector(".chat-online-dot");
  const settingsStatus = document.getElementById("settingsAiStatus");

  const isAvailable = window.LifeLedgerAI?.isAiAvailable();
  const model = window.LifeLedgerAI?.getModel() || "google/gemini-2.5-flash";
  const shortModel = model.split("/").pop() || model;

  if (isAvailable) {
    if (label) label.textContent = `🧠 AI Powered (${shortModel})`;
    if (dot) dot.style.background = "#10b981";
    if (settingsStatus) {
      settingsStatus.textContent = `✅ Connected (${model})`;
      settingsStatus.style.color = "#10b981";
    }
  } else {
    if (label) label.textContent = "Offline Mode";
    if (dot) dot.style.background = "#f59e0b";
    if (settingsStatus) {
      settingsStatus.textContent = "❌ No OpenRouter API key";
      settingsStatus.style.color = "#ef4444";
    }
  }
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

function bindAiSettings() {
  const keyInput = document.getElementById("settingsOpenRouterApiKey");
  const modelSelect = document.getElementById("settingsAiModelSelect");

  if (keyInput && window.LifeLedgerAI?.getApiKey) {
    keyInput.value = window.LifeLedgerAI.getApiKey();
  }

  if (modelSelect && window.LifeLedgerAI?.getModel) {
    modelSelect.value = window.LifeLedgerAI.getModel();
  }

  const stockProxyInput = document.getElementById('settingsStockProxyUrl');
  const stockProxySaveBtn = document.getElementById('settingsSaveStockProxy');
  if (stockProxyInput) stockProxyInput.value = localStorage.getItem(STOCK_PROXY_URL_KEY) || '';
  stockProxySaveBtn?.addEventListener('click', () => {
    const url = stockProxyInput?.value?.trim();
    if (url) {
      localStorage.setItem(STOCK_PROXY_URL_KEY, url);
      toast('✅ Stock price proxy URL saved.');
    } else {
      localStorage.removeItem(STOCK_PROXY_URL_KEY);
      toast('Stock proxy URL cleared.');
    }
  });

  modelSelect?.addEventListener("change", () => {
    const model = modelSelect.value;
    window.LifeLedgerAI?.setModel(model);
    updateAiModeBadge();
  });

  // Test AI Connection button
  document.getElementById("settingsTestAiBtn")?.addEventListener("click", async () => {
    const statusEl = document.getElementById("settingsAiStatus");
    const model = window.LifeLedgerAI?.getModel() || "google/gemini-2.5-flash";

    if (!window.LifeLedgerAI?.isAiAvailable()) {
      if (statusEl) {
        statusEl.textContent = "❌ Please enter an OpenRouter API key first.";
        statusEl.style.color = "#ef4444";
      }
      toast("⚠️ Please enter your OpenRouter API key first.");
      return;
    }

    if (statusEl) {
      statusEl.textContent = `⏳ Testing ${model}...`;
      statusEl.style.color = "var(--brand, #3b82f6)";
    }
    toast(`⏳ Testing OpenRouter connection (${model})...`);

    try {
      const response = await window.LifeLedgerAI.askAgent("Connection test. Reply 'Connected successfully!'", state, []);
      if (statusEl) {
        statusEl.textContent = `✅ Connected & Verified!`;
        statusEl.style.color = "#10b981";
      }
      toast(`✅ AI Verified! Response: "${response.slice(0, 60)}..."`);
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `❌ Test Failed: ${err.message.slice(0, 45)}`;
        statusEl.style.color = "#ef4444";
      }
      toast(`❌ Test Failed: ${err.message}`);
    }
  });

  // Save settings
  document.getElementById("settingsSaveApiKey")?.addEventListener("click", () => {
    const key = keyInput?.value?.trim();
    const model = modelSelect?.value;

    if (key !== undefined) window.LifeLedgerAI?.setApiKey(key);
    if (model) window.LifeLedgerAI?.setModel(model);

    if (!key) {
      toast("⚠️ Please enter your OpenRouter API key.");
    } else {
      toast(`✅ AI settings saved! Model: ${model}`);
    }

    updateAiModeBadge();
  });

  // Clear settings
  document.getElementById("settingsClearApiKey")?.addEventListener("click", () => {
    window.LifeLedgerAI?.setApiKey("");
    window.LifeLedgerAI?.setModel("google/gemini-2.5-flash");

    if (keyInput) keyInput.value = "";
    if (modelSelect) modelSelect.value = "google/gemini-2.5-flash";

    updateAiModeBadge();
    toast("API key cleared. AI agent disabled.");
  });

  // Dismiss insights banner
  document.getElementById("aiInsightsClose")?.addEventListener("click", () => {
    const banner = document.getElementById("aiInsightsBanner");
    if (banner) banner.style.display = "none";
  });

  updateAiModeBadge();
}

// Load AI insights on dashboard (called after bootstrap)
async function loadAiInsights() {
  if (!window.LifeLedgerAI?.isAiAvailable()) return;
  const banner = document.getElementById("aiInsightsBanner");
  const content = document.getElementById("aiInsightsContent");
  if (!banner || !content) return;

  banner.style.display = "";
  content.innerHTML = '<span class="ai-insights-loading">Analyzing your data...</span>';

  try {
    const insights = await window.LifeLedgerAI.generateInsights(state);
    // Convert markdown-like formatting to HTML
    content.innerHTML = insights
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/_(.+?)_/g, "<em>$1</em>")
      .replace(/\n/g, "<br>");
  } catch (error) {
    console.warn("[AI Insights] Failed:", error.message);
    banner.style.display = "none";
  }
}

function openModal(target) {
  const el = typeof target === "string" ? document.getElementById(target) : target;
  if (el) el.hidden = false;
}

function closeModal(modal) {
  modal.hidden = true;
}

async function deleteExpense(id) {
  if (!id) return;
  if (!confirm("Are you sure you want to delete this expense entry?")) return;

  state.expenses = state.expenses.filter((exp) => exp.id !== id);
  renderExpensesOnly();
  toast("Expense deleted.");

  try {
    saveData(true, "expense");
  } catch (error) {
    console.error("Failed to delete expense:", error);
  }
}

async function resetData(scope) {
  const config = {
    all: { label: "all data", keys: [] },
    income: { label: "income", keys: ["income"] },
    expenses: { label: "expenses", keys: ["expenses"] },
    investments: { label: "investments", keys: ["mutualFunds", "stocks", "usstocks"] },
    goals: { label: "goals", keys: ["goals"] },
    tasks: { label: "tasks", keys: ["tasks"] },
    studies: { label: "studies", keys: ["studies"] },
    workouts: { label: "workouts", keys: ["workouts"] },
    networth: { label: "assets and liabilities", keys: ["assets", "liabilities"] },
    holdings: { label: "mutual funds, stocks and US stocks", keys: ["mutualFunds", "stocks", "usstocks"] },
    mutualfunds: { label: "mutual funds", keys: ["mutualFunds"] },
    stocks: { label: "Indian stocks", keys: ["stocks"] },
    usstocks: { label: "USA stocks", keys: ["usstocks"] },
    simpleassets: { label: "FD, EPF, Gold, Bonds, etc.", keys: ["fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "banksaving", "others"] },
    finance: { label: "all finance data", keys: ["income", "expenses", "assets", "liabilities", "mutualFunds", "stocks", "usstocks", "fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "banksaving", "others"] },
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
  state.chat.push({ id: `chat-${generateUUID()}`, role: "assistant", text: assistantWelcome, at: new Date().toISOString() });
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
      } else if (name === "exchange") {
        options = kind === "usstocks" ? ["NASDAQ", "NYSE", "NYSEARCA"] : ["NSE", "BSE"];
      } else if (name === "category") {
        options = ["Stock", "ETF", "Bond"];
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
      input.rows = 2;
    } else {
      input = document.createElement("input");
      input.type = type;
      input.name = name;
      if (type === "number") input.step = "any";
    }

    if (existingEntry && existingEntry[name] !== undefined) {
      if (type === "checkbox") {
        input.checked = existingEntry[name];
      } else {
        input.value = existingEntry[name];
      }
    } else if (type === "date" && !existingEntry) {
      input.value = todayISO();
    }

    wrapper.append(input);
    form.append(wrapper);
  });

  if (kind === "mutualFund") {
    const txnTypeSelect = form.querySelector('[name="transactionType"]');
    const navInput = form.querySelector('[name="nav"]');
    const investedInput = form.querySelector('[name="invested"]');
    const unitsInput = form.querySelector('[name="units"]');
    const dateInput = form.querySelector('[name="purchaseDate"]');
    const fundNameInput = form.querySelector('[name="fundName"]');
    const ownerSelect = form.querySelector('[name="owner"]');

    const infoBanner = document.createElement("div");
    infoBanner.className = "full-span";
    infoBanner.style.cssText = "padding: 10px 14px; border-radius: 8px; font-size: 0.82rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); margin-top: 4px; display: none;";
    form.append(infoBanner);

    const updateMfFormUI = () => {
      const isRedeem = txnTypeSelect?.value === "REDEMPTION";

      // Dynamic field labels
      if (navInput?.parentElement) {
        navInput.parentElement.childNodes[0].textContent = isRedeem ? "Redemption NAV (₹)" : "Purchase NAV (₹)";
      }
      if (investedInput?.parentElement) {
        investedInput.parentElement.childNodes[0].textContent = isRedeem ? "Redemption Amount (₹)" : "Amount invested (₹)";
      }
      if (dateInput?.parentElement) {
        dateInput.parentElement.childNodes[0].textContent = isRedeem ? "Redemption Date" : "Purchase Date";
      }

      // Check current holding balance for selected owner & fund
      const fundName = (fundNameInput?.value || "").trim();
      const owner = (ownerSelect?.value || "Me").trim();

      if (fundName) {
        const matchingTxns = state.mutualFunds.filter(t =>
          (t.fundName || "").toLowerCase() === fundName.toLowerCase() &&
          matchHoldingsOwner(t.owner, owner)
        );
        const basis = calcMfCostBasis(matchingTxns);
        const heldUnits = basis.netUnits;
        let latestNav = 0;
        matchingTxns.forEach(t => {
          if (t.latestNav || t.nav) latestNav = toNumber(t.latestNav || t.nav);
        });

        if (heldUnits > 0 || isRedeem) {
          const estValue = heldUnits * latestNav;
          infoBanner.style.display = "block";
          const valText = estValue > 0 ? ` (₹${estValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })})` : '';
          const navText = latestNav > 0 ? ` · Latest NAV: ₹${latestNav}` : '';
          const costText = basis.invested > 0 ? ` · Cost basis: ₹${basis.invested.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '';
          infoBanner.innerHTML = `<strong>📊 Holding Info (${owner}):</strong> ${heldUnits.toFixed(3)} units held${valText}${navText}${costText}`;

          if (isRedeem && navInput && !navInput.value && latestNav > 0) {
            navInput.value = latestNav;
          }
        } else {
          infoBanner.style.display = "none";
        }
      } else {
        infoBanner.style.display = "none";
      }
    };

    const autoCalc = (e) => {
      const u = toNumber(unitsInput?.value);
      const n = toNumber(navInput?.value);
      const inv = toNumber(investedInput?.value);

      if (e.target === unitsInput || e.target === navInput) {
        if (u > 0 && n > 0) {
          investedInput.value = (u * n).toFixed(2);
        }
      } else if (e.target === investedInput) {
        if (inv > 0 && n > 0) {
          unitsInput.value = (inv / n).toFixed(3);
        }
      }
      updateMfFormUI();
    };

    txnTypeSelect?.addEventListener("change", updateMfFormUI);
    fundNameInput?.addEventListener("input", updateMfFormUI);
    ownerSelect?.addEventListener("change", updateMfFormUI);
    unitsInput?.addEventListener("input", autoCalc);
    navInput?.addEventListener("input", autoCalc);
    investedInput?.addEventListener("input", autoCalc);

    updateMfFormUI();
  }

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

    const isSimpleAsset = ["fd", "epf", "bonds", "ppf", "gold", "silver", "crypto", "banksaving", "others"].includes(kind);

    if (kind === "mutualFund") {
      entry.owner = normalizeOwner(entry.owner);
      entry.amc = inferAmc(entry.fundName);
      if (!entry.latestNav) entry.latestNav = entry.nav;
      if (!entry.currentValue) entry.currentValue = entry.invested;
    }
    if (kind === "stock" || kind === "usstocks") {
      entry.owner = normalizeOwner(entry.owner);
      if (!entry.currentPrice) entry.currentPrice = entry.avgPrice;
      if (!entry.invested && entry.quantity && entry.avgPrice) entry.invested = entry.quantity * entry.avgPrice;
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

    if (kind === "expense" || kind === "income" || kind === "asset" || kind === "liability" || kind === "mutualFund" || kind === "stock" || kind === "fd" || kind === "epf" || kind === "bonds" || kind === "ppf" || kind === "gold" || kind === "silver" || kind === "crypto" || kind === "usstocks" || kind === "banksaving" || kind === "others") {
      renderExpensesOnly();
      if (kind === "stock") renderStockHoldingsPanel();
      if (kind === "usstocks") renderUsStockHoldingsPanel();
      if (kind === "mutualFund") renderMutualFundsPanel();
    } else if (kind === "task") {
      renderTodoOnly();
    } else if (kind === "goal") {
      renderGoalsOnly();
    } else if (kind === "workout") {
      renderExerciseOnly();
      renderDashboardOnly();
    } else if (kind === "habit") {
      renderHabitsOnly();
      renderDashboardOnly();
    } else if (kind === "study") {
      renderCareerOnly();
    } else {
      renderAll();
    }
    closeModal(form.closest(".modal"));
    toast(existingEntry ? "Entry updated." : "Entry saved.");
    saveData(true, kind);
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
      renderExpensesOnly();
      await saveData(true, "expense");
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

function parseMasterHoldingsWorkbook(buffer) {
  if (typeof XLSX === "undefined") {
    throw new Error("SheetJS (XLSX) library is not loaded.");
  }

  const workbook = XLSX.read(buffer, { type: "array" });
  const parsedMutualFunds = [];
  const parsedStocks = [];
  const parsedUsStocks = [];

  function parseDateVal(val) {
    if (!val) return new Date().toISOString().split("T")[0];
    if (typeof val === "number") {
      try {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed) {
          const y = parsed.y;
          const m = String(parsed.m).padStart(2, "0");
          const d = String(parsed.d).padStart(2, "0");
          return `${y}-${m}-${d}`;
        }
      } catch(e) {}
    }
    const str = String(val).trim();
    if (!str) return new Date().toISOString().split("T")[0];

    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const d = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return new Date().toISOString().split("T")[0];
  }

  function parseNumVal(val) {
    if (val === null || val === undefined || val === "") return 0;
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    const clean = String(val).replace(/,/g, "").replace(/₹/g, "").replace(/\$/g, "").trim();
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  }

  (workbook.SheetNames || []).forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (!rows || !rows.length) return;

    const sheetNameLower = sheetName.toLowerCase();

    const isUS = sheetNameLower.includes("us") || sheetNameLower.includes("usa") || sheetNameLower.includes("america");
    const isMF = sheetNameLower.includes("mf") || sheetNameLower.includes("mutual") || sheetNameLower.includes("fund");

    const defaultOwner = (sheetNameLower.includes("wife") || sheetNameLower.includes("archana")) ? "Wife" : "Me";

    let defaultDemat = "Other";
    if (sheetNameLower.includes("groww")) defaultDemat = "Groww";
    else if (sheetNameLower.includes("upstox")) defaultDemat = "Upstox";
    else if (sheetNameLower.includes("indmoney") || sheetNameLower.includes("ind")) defaultDemat = "INDmoney";
    else if (sheetNameLower.includes("zerodha") || sheetNameLower.includes("kite")) defaultDemat = "Zerodha";

    rows.forEach(row => {
      const normRow = {};
      Object.keys(row).forEach(k => {
        const normKey = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
        normRow[normKey] = row[k];
      });

      const nameVal = normRow.schemename || normRow.fundname || normRow.scheme || normRow.fund ||
                      normRow.companyname || normRow.company || normRow.stockname || normRow.stock ||
                      normRow.symbol || normRow.instrument || normRow.scrip || normRow.name || normRow.ticker || "";

      if (!nameVal || String(nameVal).trim() === "" || String(nameVal).toLowerCase().startsWith("total")) return;

      const cleanName = String(nameVal).trim();

      let rowAsset = isUS ? "usstock" : (isMF ? "mutualFund" : "stock");
      if (normRow.schemename || normRow.purchasenav || normRow.nav) {
        rowAsset = "mutualFund";
      } else if (normRow.priceusd || normRow.amountusd || normRow.ticker || (isUS && (normRow.symbol || normRow.company))) {
        rowAsset = "usstock";
      }

      const rawType = String(normRow.transactiontype || normRow.type || normRow.txntype || normRow.action || normRow.buysell || "PURCHASE").toUpperCase();
      const isRed = rawType.includes("REDEEM") || rawType.includes("REDEMPTION") || rawType.includes("SELL");

      let ownerVal = normRow.owner || normRow.holder || normRow.ownermewife || defaultOwner;
      ownerVal = String(ownerVal).toLowerCase().includes("wife") || String(ownerVal).toLowerCase().includes("archana") ? "Wife" : "Me";

      const dateVal = parseDateVal(normRow.date || normRow.transactiondate || normRow.purchasedate || normRow.txndate || normRow.buydate || normRow.orderdate);

      const dematVal = String(normRow.broker || normRow.demat || normRow.platform || normRow.account || defaultDemat).trim();

      if (rowAsset === "mutualFund") {
        const units = parseNumVal(normRow.units || normRow.quantity || normRow.qty || normRow.shares);
        const nav = parseNumVal(normRow.nav || normRow.purchasenav || normRow.price || normRow.avgprice || normRow.rate);
        let invested = parseNumVal(normRow.amount || normRow.invested || normRow.totalamount || normRow.value || normRow.netamount);
        if (!invested && units && nav) invested = units * nav;

        parsedMutualFunds.push({
          id: `mf-${generateUUID()}`,
          fundName: cleanName,
          transactionType: isRed ? "REDEEM" : "PURCHASE",
          units: Math.abs(units),
          nav: nav,
          invested: Math.abs(invested),
          purchaseDate: dateVal,
          date: dateVal,
          owner: ownerVal,
          demat: dematVal
        });
      } else if (rowAsset === "usstock") {
        const qty = parseNumVal(normRow.quantity || normRow.qty || normRow.units || normRow.shares);
        const price = parseNumVal(normRow.price || normRow.avgprice || normRow.buyprice || normRow.priceusd || normRow.rate);
        let invested = parseNumVal(normRow.amount || normRow.invested || normRow.totalamount || normRow.amountusd || normRow.value);
        if (!invested && qty && price) invested = qty * price;

        parsedUsStocks.push({
          id: `uss-${generateUUID()}`,
          symbol: cleanName.toUpperCase(),
          company: cleanName,
          transactionType: isRed ? "SELL" : "BUY",
          quantity: Math.abs(qty),
          avgPrice: price,
          invested: Math.abs(invested),
          purchaseDate: dateVal,
          date: dateVal,
          owner: ownerVal,
          demat: dematVal || "INDmoney"
        });
      } else {
        const qty = parseNumVal(normRow.quantity || normRow.qty || normRow.units || normRow.shares);
        const price = parseNumVal(normRow.price || normRow.avgprice || normRow.buyprice || normRow.rate);
        let invested = parseNumVal(normRow.amount || normRow.invested || normRow.totalamount || normRow.amountinr || normRow.value);
        if (!invested && qty && price) invested = qty * price;

        parsedStocks.push({
          id: `stk-${generateUUID()}`,
          symbol: cleanName.toUpperCase().replace(/\s*-EQ$/i, "").trim(),
          company: cleanName,
          transactionType: isRed ? "SELL" : "BUY",
          quantity: Math.abs(qty),
          avgPrice: price,
          invested: Math.abs(invested),
          purchaseDate: dateVal,
          date: dateVal,
          owner: ownerVal,
          demat: dematVal
        });
      }
    });
  });

  return {
    mutualFunds: parsedMutualFunds,
    stocks: parsedStocks,
    usstocks: parsedUsStocks
  };
}

async function syncHoldingsFromDrive() {
  if (!window.LifeLedgerDrive || !window.LifeLedgerDrive.isConnected()) {
    toast("Please connect Google Drive in the settings panel first.");
    return;
  }

  const syncBtns = document.querySelectorAll(".sync-holdings-btn");
  syncBtns.forEach(btn => {
    btn.disabled = true;
    btn.textContent = "☁ Syncing...";
  });

  toast("🔍 Scanning Google Drive for 'My stocks and MF holdings for Life-Ledger'...");

  try {
    const fileData = await window.LifeLedgerDrive.downloadMasterHoldingsFile();
    if (!fileData || !fileData.buffer) {
      toast("⚠️ Could not find 'My stocks and MF holdings for Life-Ledger' on Google Drive.");
      return;
    }

    console.log(`[app.js] Found holdings workbook: "${fileData.filename}" (Modified: ${fileData.modifiedTime})`);
    toast(`📥 Parsing tabs from "${fileData.filename}"...`);

    const holdingsData = parseMasterHoldingsWorkbook(fileData.buffer);

    let mfCount = holdingsData.mutualFunds?.length || 0;
    let stockCount = holdingsData.stocks?.length || 0;
    let usStockCount = holdingsData.usstocks?.length || 0;

    if (mfCount === 0 && stockCount === 0 && usStockCount === 0) {
      toast("⚠️ Sheet downloaded, but 0 holdings were extracted. Check tab column headers.");
      return;
    }

    // Update state
    if (mfCount > 0) state.mutualFunds = holdingsData.mutualFunds;
    if (stockCount > 0) state.stocks = holdingsData.stocks;
    if (usStockCount > 0) state.usstocks = holdingsData.usstocks;

    toast(`🔄 Live syncing prices for ${mfCount} MF, ${stockCount} Stock, ${usStockCount} US Stock entries...`);

    // Live NAV & Price refresh
    try {
      if (mfCount > 0 && typeof refreshMutualFundNAVs === "function") {
        await refreshMutualFundNAVs(true);
      }
      if (stockCount > 0 && typeof refreshStockPrices === "function") {
        await refreshStockPrices(true);
      }
      if (usStockCount > 0 && typeof refreshUsStockPrices === "function") {
        await refreshUsStockPrices(true);
      }
    } catch (e) {
      console.warn("[app.js] Error updating live price/NAV after holdings sync:", e);
    }

    // Save vault & re-render
    renderAll();
    await saveData(true);

    toast(`✅ Synced! Loaded ${mfCount} MF, ${stockCount} Stock, and ${usStockCount} US Stock txns from Drive.`);
  } catch (err) {
    console.error("[app.js] Holdings sync error:", err);
    toast(`❌ Holdings Sync Failed: ${err.message}`);
  } finally {
    syncBtns.forEach(btn => {
      btn.disabled = false;
      btn.textContent = "☁ Sync Holdings";
    });
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
    const output = emptyImportBuckets();
    for (let i = 0; i < rows.length; i += 1) {
      ingestImportRow(output, rows[i], selectedKind);
      if (i > 0 && i % IMPORT_YIELD_EVERY === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    return output;
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

  if (Object.keys(normalized).some(k => k.startsWith("col"))) {
    const colKeys = Object.keys(normalized)
      .filter(k => k.startsWith("col"))
      .sort((a, b) => {
        const numA = parseInt(a.replace("col", ""), 10);
        const numB = parseInt(b.replace("col", ""), 10);
        return numA - numB;
      });

    const values = colKeys.map(k => normalized[k]);
    if (values.length === 4) {
      normalized.date = values[0];
      normalized.category = values[1];
      normalized.amount = values[2];
      normalized.note = values[3];
    } else {
      let dateFound = false;
      let amountFound = false;
      let noteFound = "";
      let categoryFound = "";

      values.forEach(val => {
        const str = String(val).trim();
        if (!str) return;

        if (!dateFound && (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(str) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(str))) {
          normalized.date = str;
          dateFound = true;
          return;
        }

        if (!amountFound && /^\-?\d+(\.\d+)?$/.test(str)) {
          normalized.amount = str;
          amountFound = true;
          return;
        }

        if (!categoryFound && str.length < 20 && /^[A-Za-z\s]+$/.test(str)) {
          normalized.category = str;
          categoryFound = true;
          return;
        }

        if (!noteFound) {
          noteFound = str;
        } else {
          noteFound += " " + str;
        }
      });

      if (noteFound) normalized.note = noteFound;
    }
  }

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
    const rawTxnType = pick(row, ["transactiontype", "transaction_type", "type", "txntype", "action", "ordertype", "order_type"]) || "PURCHASE";
    const transactionType = normalizeTransactionType(rawTxnType);
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
  
  // Create a pool of existing expenses map for O(1) matching.
  // Each key can map to an array of existing expenses to handle duplicate entries in the existing data.
  // When a match is found and consumed, we remove it from the array.
  const existingExpenses = state.expenses || [];
  const poolMap = new Map();
  
  existingExpenses.forEach(existing => {
    const key = `${existing.date}|${Math.round(toNumber(existing.amount) * 100)}|${(existing.note || "").trim().toLowerCase()}|${normalizeOwner(existing.paidBy)}`;
    if (!poolMap.has(key)) {
      poolMap.set(key, []);
    }
    poolMap.get(key).push(existing);
  });

  normalized.expenses.forEach(incoming => {
    const key = `${incoming.date}|${Math.round(toNumber(incoming.amount) * 100)}|${(incoming.note || "").trim().toLowerCase()}|${normalizeOwner(incoming.paidBy)}`;
    const matchArray = poolMap.get(key);
    if (matchArray && matchArray.length > 0) {
      // Consume one matched existing item
      matchArray.shift();
    } else {
      // No match left in the pool, this is a new transaction (even if it's identical to another)
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

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function renderExpensesOnly() {
  renderMetrics();
  renderFinance();
  renderDashboardAnalysis();
  renderCashflowChart();
  renderExpenseMix();
  renderNetWorth();
}

function renderTodoOnly() {
  renderTodoView();
  renderTodayFocus();
}

function renderGoalsOnly() {
  renderGoals();
}

function renderCareerOnly() {
  renderCareer();
}

function renderExerciseOnly() {
  renderExerciseView();
}

function renderHabitsOnly() {
  renderHabitsView();
}

function renderDashboardOnly() {
  renderTodayFocus();
  renderDashboardAnalysis();
}

function renderAll() {
  updateMutualFundsFromCache();
  updateStocksFromCache();
  updateUsStocksFromCache();
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
          renderHabitsOnly();
          renderDashboardOnly();
          toast(`Streaked! ${habit.name} streak is now ${habit.streak}. 🔥`);
          saveData(true, "habit");
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
  renderStockHoldingsPanel();
  renderUsStockHoldingsPanel();
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

  // Calculate invested/units with Average Cost Method (like Groww)
  // The 'invested' field on REDEMPTION = redemption proceeds, NOT cost basis.
  // So we compute avgCostPerUnit from purchases, then subtract cost of redeemed units.
  let invested = 0;
  const currentByFund = {};
  const fundGroups = {};
  rows.forEach(t => {
    const key = t.fundName || "Unknown";
    if (!fundGroups[key]) fundGroups[key] = [];
    fundGroups[key].push(t);
    if (!currentByFund[key]) currentByFund[key] = { units: 0, latestNav: t.latestNav || t.nav || 0 };
    if (t.latestNav) currentByFund[key].latestNav = toNumber(t.latestNav);
  });
  Object.entries(fundGroups).forEach(([key, txns]) => {
    const basis = calcMfCostBasis(txns);
    invested += basis.invested;
    currentByFund[key].units = basis.netUnits;
  });
  const current = Object.values(currentByFund).reduce((total, f) => total + f.units * f.latestNav, 0);
  const gain = current - invested;
  const roi = invested ? (gain / invested) * 100 : 0;

  // Calculate overall portfolio XIRR (redemptions are positive inflows)
  const portfolioFlows = rows.map(t => {
    const isRed = isRedemption(t);
    return {
      date: new Date(t.purchaseDate || t.date || Date.now()),
      amount: isRed ? +toNumber(t.invested) : -toNumber(t.invested)
    };
  });
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
      if (!byFundPrev[key]) byFundPrev[key] = { txns: [], latestNav: t.latestNav || t.nav || 0, prevNav: t.prevNav || null };
      byFundPrev[key].txns.push(t);
      if (t.latestNav) byFundPrev[key].latestNav = toNumber(t.latestNav);
      if (t.prevNav)  { byFundPrev[key].prevNav = toNumber(t.prevNav); oneDayHasPrev = true; }
    });
    Object.values(byFundPrev).forEach(f => {
      const netUnits = calcMfCostBasis(f.txns).netUnits;
      if (f.prevNav) oneDayChange += netUnits * (f.latestNav - f.prevNav);
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
    if (isRedemption(t)) return false;
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
      // Average Cost Method (like Groww) — per-fund aggregation
      const basis = calcMfCostBasis(txns);
      const totalUnits = basis.netUnits;
      const totalInvested = basis.invested;

      const latestNav = txns[0].latestNav || txns[0].nav;
      const prevNav = txns[0].prevNav || null;
      const currentValue = totalUnits * latestNav;
      const gain = currentValue - totalInvested;
      const roi = totalInvested ? (gain / totalInvested) * 100 : 0;
      const avgNav = basis.avgCost; // Average cost per unit from purchases

      // 1-Day change for this holding
      const dayChange = prevNav ? totalUnits * (latestNav - prevNav) : null;
      const dayChangePct = prevNav && latestNav ? ((latestNav - prevNav) / prevNav) * 100 : null;

      // XIRR: purchases are outflows (negative), redemptions are inflows (positive)
      const cashFlows = txns.map(t => {
        const isRed = isRedemption(t);
        return {
          date: new Date(t.purchaseDate || t.date || Date.now()),
          amount: isRed ? +toNumber(t.invested) : -toNumber(t.invested)
        };
      });
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
    });

    // Apply user-selected sort (default: currentValue desc)
    const sortedHoldings = sortHoldings(holdings, mfSortCol, mfSortDir);

    const mfColumns = [
      ['fundName', 'Fund'], ['totalUnits', 'Units'], ['avgNav', 'Avg. NAV'],
      ['totalInvested', 'Invested'], ['latestNav', 'Latest NAV'], ['lowestNav30d', '30D Lowest'],
      ['', 'Invest Signal'], ['currentValue', 'Current Value'], ['dayChange', '1-Day Change'],
      ['gain', 'Gain / Loss'], ['xirr', 'XIRR']
    ];

    if (targetThead) {
      targetThead.innerHTML = buildSortableThead(mfColumns, mfSortCol, mfSortDir);
      bindSortableHeaders(targetThead, (col) => {
        if (mfSortCol === col) { mfSortDir = mfSortDir === 'asc' ? 'desc' : 'asc'; }
        else { mfSortCol = col; mfSortDir = 'desc'; }
        renderMutualFundsPanel();
      });
    }

    renderRows(
      table,
      sortedHoldings,
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
      (item) => {
        const isRedeem = isRedemption(item);
        const badgeCls = isRedeem ? "txn-type-badge txn-type-redemption" : "txn-type-badge txn-type-purchase";
        return [
          formatDate(item.purchaseDate || item.date),
          item.fundName,
          `<span class="${badgeCls}">${isRedeem ? "REDEMPTION" : "PURCHASE"}</span>`,
          item.units ? (isRedeem ? `<span style="color:var(--negative,#ef4444);font-weight:600">-${Number(item.units).toFixed(3)}</span>` : Number(item.units).toFixed(3)) : "-",
          item.nav ? formatINR(item.nav) : "-",
          isRedeem ? `<span style="color:var(--negative,#ef4444);font-weight:600">-${formatINR(item.invested)}</span>` : formatINR(item.invested),
          item.latestNav ? formatINR(item.latestNav) : (item.nav ? formatINR(item.nav) : "-"),
          formatINR(item.currentValue || item.invested),
          (() => {
            const inv = toNumber(item.invested);
            const cur = toNumber(item.currentValue || item.invested);
            const g = isRedeem ? -inv : cur - inv;
            const pct = inv ? (g / inv) * 100 : 0;
            const color = g >= 0 ? "var(--good)" : "var(--danger)";
            return `<span style="color: ${color}; font-weight: 600;">${formatINR(g)} (${formatPercent(pct)})</span>`;
          })(),
          item.owner || "Me",
          `<div class="actions-wrapper">
            <button class="action-btn edit-btn edit-mutualFund-btn" data-id="${item.id}" title="Edit entry">✏️</button>
            <button class="action-btn delete-btn delete-mutualFund-btn" data-id="${item.id}" title="Delete entry">🗑️</button>
          </div>`
        ];
      },
      `No mutual funds for ${activeHoldingsOwner}. Add a transaction or import a sheet.`,
      11
    );
  }
}

// ═══════════════════════════════════════════════════════════════
//  STOCK HOLDINGS — CSV Parser, Price Refresh, Render Panel
// ═══════════════════════════════════════════════════════════════

const STOCK_PRICE_CACHE_KEY = 'lifeLedgerStockPriceCache:v1';
const STOCK_PROXY_URL_KEY = 'lifeLedgerStockProxyUrl';
let activeStockBroker = "All";

const defaultStockHoldings = [
  // ── Upstox Holdings (8 ETFs) ──
  { id: "stk-up-1", owner: "Me", symbol: "HDFCMID150", company: "HDFC Nifty Midcap 150 ETF", exchange: "NSE", category: "ETF", quantity: 1678, avgPrice: 21.12, currentPrice: 23.36, invested: 35439.36, currentValue: 39198.08, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox ETF" },
  { id: "stk-up-2", owner: "Me", symbol: "GOLD1", company: "Nippon India ETF Gold BeES", exchange: "NSE", category: "ETF", quantity: 1523, avgPrice: 80.21, currentPrice: 118.16, invested: 122159.83, currentValue: 179957.68, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Gold ETF" },
  { id: "stk-up-3", owner: "Me", symbol: "HDFCSML250", company: "HDFC Nifty Smallcap 250 ETF", exchange: "NSE", category: "ETF", quantity: 464, avgPrice: 170.49, currentPrice: 180.67, invested: 79107.36, currentValue: 83830.88, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Smallcap ETF" },
  { id: "stk-up-4", owner: "Me", symbol: "NIFTYBEES", company: "Nippon India ETF Nifty 50 BeES", exchange: "NSE", category: "ETF", quantity: 569, avgPrice: 264.94, currentPrice: 277.42, invested: 150750.86, currentValue: 157851.98, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Nifty 50 ETF" },
  { id: "stk-up-5", owner: "Me", symbol: "MID150BEES", company: "Nippon India ETF Nifty Midcap 150 BeES", exchange: "NSE", category: "ETF", quantity: 221, avgPrice: 217.54, currentPrice: 239.42, invested: 48076.34, currentValue: 52911.82, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Midcap ETF" },
  { id: "stk-up-6", owner: "Me", symbol: "MON100", company: "Motilal Oswal Nasdaq 100 ETF", exchange: "NSE", category: "ETF", quantity: 441, avgPrice: 193.28, currentPrice: 305.18, invested: 85236.48, currentValue: 134584.38, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Nasdaq 100 ETF" },
  { id: "stk-up-7", owner: "Me", symbol: "BANKBEES", company: "Nippon India ETF Bank BeES", exchange: "NSE", category: "ETF", quantity: 149, avgPrice: 543.48, currentPrice: 592.26, invested: 80978.52, currentValue: 88246.74, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox Bank ETF" },
  { id: "stk-up-8", owner: "Me", symbol: "ITBEES", company: "Nippon India ETF IT BeES", exchange: "NSE", category: "ETF", quantity: 3262, avgPrice: 39.45, currentPrice: 34.12, invested: 128685.90, currentValue: 111299.44, demat: "Upstox", purchaseDate: "2024-01-15", notes: "Upstox IT ETF" },

  // ── Zerodha Holdings (11 Stocks & Bonds) ──
  { id: "stk-ze-1", owner: "Me", symbol: "BLUESTARCO", company: "Blue Star Ltd", exchange: "NSE", category: "Stock", quantity: 19, avgPrice: 1534.29, currentPrice: 1681.00, invested: 29151.45, currentValue: 31939.00, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-2", owner: "Me", symbol: "FACT", company: "Fertilisers & Chemicals Travancore Ltd", exchange: "NSE", category: "Stock", quantity: 37, avgPrice: 855.23, currentPrice: 827.50, invested: 31643.55, currentValue: 30617.50, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-3", owner: "Me", symbol: "HAVELLS", company: "Havells India Ltd", exchange: "NSE", category: "Stock", quantity: 13, avgPrice: 1533.61, currentPrice: 1259.60, invested: 19936.95, currentValue: 16374.80, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-4", owner: "Me", symbol: "JINDALSTEL", company: "Jindal Steel & Power Ltd", exchange: "NSE", category: "Stock", quantity: 19, avgPrice: 753.02, currentPrice: 1102.40, invested: 14307.35, currentValue: 20945.60, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-5", owner: "Me", symbol: "M&M", company: "Mahindra & Mahindra Ltd", exchange: "NSE", category: "Stock", quantity: 11, avgPrice: 2441.30, currentPrice: 3398.50, invested: 26854.30, currentValue: 37383.50, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-6", owner: "Me", symbol: "PFC", company: "Power Finance Corporation Ltd", exchange: "NSE", category: "Stock", quantity: 60, avgPrice: 401.31, currentPrice: 424.45, invested: 24078.55, currentValue: 25467.00, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-7", owner: "Me", symbol: "PRESTIGE", company: "Prestige Estates Projects Ltd", exchange: "NSE", category: "Stock", quantity: 10, avgPrice: 1667.95, currentPrice: 1618.50, invested: 16679.50, currentValue: 16185.00, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-8", owner: "Me", symbol: "RECLTD", company: "REC Ltd", exchange: "NSE", category: "Stock", quantity: 70, avgPrice: 438.62, currentPrice: 373.10, invested: 30703.70, currentValue: 26117.00, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-9", owner: "Me", symbol: "SGBFEB32IV-GB", company: "Sovereign Gold Bond 2032 Series IV", exchange: "NSE", category: "Bond", quantity: 5, avgPrice: 6213.00, currentPrice: 14601.83, invested: 31065.00, currentValue: 73009.15, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Sovereign Gold Bond" },
  { id: "stk-ze-10", owner: "Me", symbol: "VBL", company: "Varun Beverages Ltd", exchange: "NSE", category: "Stock", quantity: 56, avgPrice: 506.77, currentPrice: 442.45, invested: 28379.25, currentValue: 24777.20, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },
  { id: "stk-ze-11", owner: "Me", symbol: "WIPRO", company: "Wipro Ltd", exchange: "NSE", category: "Stock", quantity: 93, avgPrice: 262.32, currentPrice: 183.65, invested: 24396.00, currentValue: 17079.45, demat: "Zerodha", purchaseDate: "2024-02-10", notes: "Zerodha Equity" },

  // ── Wife - Groww Holdings (14 Real Stocks & ETFs from Groww App) ──
  { id: "stk-gw-1", owner: "Wife", symbol: "GEVERNOVA", company: "GE Vernova T&D India", exchange: "NSE", category: "Stock", quantity: 3, avgPrice: 3250.73, currentPrice: 4406.50, invested: 9752.19, currentValue: 13219.50, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-2", owner: "Wife", symbol: "MCX", company: "Multi Commodity Exchange of India", exchange: "NSE", category: "Stock", quantity: 3, avgPrice: 3005.00, currentPrice: 2970.10, invested: 9015.00, currentValue: 8910.30, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-3", owner: "Wife", symbol: "RRKABEL", company: "RR Kabel Ltd", exchange: "NSE", category: "Stock", quantity: 3, avgPrice: 2392.00, currentPrice: 2789.60, invested: 7176.00, currentValue: 8368.80, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-4", owner: "Wife", symbol: "LAURUSLABS", company: "Laurus Labs Ltd", exchange: "NSE", category: "Stock", quantity: 3, avgPrice: 1400.90, currentPrice: 1850.00, invested: 4202.70, currentValue: 5550.00, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-5", owner: "Wife", symbol: "RATEGAIN", company: "RateGain Travel Technologies", exchange: "NSE", category: "Stock", quantity: 12, avgPrice: 969.95, currentPrice: 932.65, invested: 11639.40, currentValue: 11191.80, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-6", owner: "Wife", symbol: "GRANULES", company: "Granules India Ltd", exchange: "NSE", category: "Stock", quantity: 15, avgPrice: 885.57, currentPrice: 864.80, invested: 13283.55, currentValue: 12972.00, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-7", owner: "Wife", symbol: "ARVIND", company: "Arvind Ltd", exchange: "NSE", category: "Stock", quantity: 26, avgPrice: 510.37, currentPrice: 566.85, invested: 13269.62, currentValue: 14738.10, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-8", owner: "Wife", symbol: "BAJAJCORP", company: "Bajaj Consumer Care Ltd", exchange: "NSE", category: "Stock", quantity: 20, avgPrice: 546.95, currentPrice: 538.25, invested: 10939.00, currentValue: 10765.00, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-9", owner: "Wife", symbol: "HONASA", company: "Honasa Consumer Ltd (Mamaearth)", exchange: "NSE", category: "Stock", quantity: 36, avgPrice: 362.69, currentPrice: 467.40, invested: 13056.84, currentValue: 16826.40, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-10", owner: "Wife", symbol: "TRIL", company: "Transformers & Rectifiers India Ltd", exchange: "NSE", category: "Stock", quantity: 14, avgPrice: 534.42, currentPrice: 292.45, invested: 7481.88, currentValue: 4094.30, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Equity" },
  { id: "stk-gw-11", owner: "Wife", symbol: "NIFTYBEES", company: "Nippon India ETF Nifty 50 BeES", exchange: "NSE", category: "ETF", quantity: 490, avgPrice: 263.68, currentPrice: 278.32, invested: 129203.20, currentValue: 136376.80, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww ETF" },
  { id: "stk-gw-12", owner: "Wife", symbol: "MID150BEES", company: "Nippon India ETF Midcap 150 BeES", exchange: "NSE", category: "ETF", quantity: 18, avgPrice: 206.60, currentPrice: 242.77, invested: 3718.80, currentValue: 4369.86, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww ETF" },
  { id: "stk-gw-13", owner: "Wife", symbol: "SILVERBEES", company: "Nippon India ETF Silver BeES", exchange: "NSE", category: "ETF", quantity: 50, avgPrice: 240.24, currentPrice: 225.76, invested: 12012.00, currentValue: 11288.00, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Silver ETF" },
  { id: "stk-gw-14", owner: "Wife", symbol: "GOLDBEES", company: "Nippon India ETF Gold BeES", exchange: "NSE", category: "ETF", quantity: 840, avgPrice: 90.47, currentPrice: 126.45, invested: 75994.80, currentValue: 106218.00, demat: "Groww", purchaseDate: "2024-03-01", notes: "Groww Gold ETF" },

  // ── Wife - INDmoney Holdings (3 ETFs) ──
  { id: "stk-ind-1", owner: "Wife", symbol: "MON100", company: "Motilal Oswal Nasdaq 100 ETF", exchange: "NSE", category: "ETF", quantity: 200, avgPrice: 221.80, currentPrice: 305.18, invested: 44360.00, currentValue: 61036.00, demat: "INDmoney", purchaseDate: "2024-03-15", notes: "INDmoney Nasdaq 100 ETF" },
  { id: "stk-ind-2", owner: "Wife", symbol: "HDFCSML250", company: "HDFC Nifty Smallcap 250 ETF", exchange: "NSE", category: "ETF", quantity: 239, avgPrice: 166.38, currentPrice: 180.67, invested: 39764.82, currentValue: 43180.13, demat: "INDmoney", purchaseDate: "2024-03-15", notes: "INDmoney Smallcap ETF" },
  { id: "stk-ind-3", owner: "Wife", symbol: "ICICIB22", company: "ICICI Prudential Bharat 22 ETF", exchange: "NSE", category: "ETF", quantity: 311, avgPrice: 112.26, currentPrice: 115.79, invested: 34912.86, currentValue: 36010.69, demat: "INDmoney", purchaseDate: "2024-03-15", notes: "INDmoney Bharat 22 ETF" },
];

let activeUsStockView = "holdings";
let activeUsStockBroker = "All";

const defaultUsStockHoldings = [
  { id: "us-1", owner: "Me", symbol: "AAPL", company: "Apple Inc.", exchange: "NASDAQ", category: "Stock", quantity: 2.96888827, avgPrice: 223.75, currentPrice: 307.34, invested: 664.29, currentValue: 912.46, demat: "INDmoney", purchaseDate: "2024-01-15", notes: "Apple US Stock" },
  { id: "us-2", owner: "Me", symbol: "T", company: "AT&T Inc.", exchange: "NYSE", category: "Stock", quantity: 3.84444291, avgPrice: 18.19, currentPrice: 23.27, invested: 69.92, currentValue: 89.46, demat: "INDmoney", purchaseDate: "2024-01-15", notes: "AT&T US Stock" },
  { id: "us-3", owner: "Me", symbol: "VOO", company: "Vanguard S&P 500 ETF", exchange: "NYSEARCA", category: "ETF", quantity: 0.4502127, avgPrice: 688.92, currentPrice: 684.58, invested: 310.16, currentValue: 308.21, demat: "INDmoney", purchaseDate: "2024-01-15", notes: "Vanguard S&P 500 ETF" },
  { id: "us-4", owner: "Me", symbol: "META", company: "Meta Platforms Inc. Class A", exchange: "NASDAQ", category: "Stock", quantity: 0.1548297, avgPrice: 683.40, currentPrice: 553.51, invested: 105.81, currentValue: 85.70, demat: "INDmoney", purchaseDate: "2024-01-15", notes: "Meta US Stock" },
];

let activeExerciseYear = new Date().getFullYear();
let activeExerciseMonth = new Date().getMonth();

const defaultBodyMetrics = [
  { id: "bm-1",  date: "2026-08-01", time: "09:37", weight: 84.50, bmi: 29.2, bodyFat: 24.60, subcutaneousFat: 21.20, visceralFat: 11.8, bodyWater: 54.40, skeletalMuscle: 48.70, muscleMass: 60.50, boneMass: 3.20, protein: 17.20, bmr: 1745, bodyAge: 34 },
  { id: "bm-2",  date: "2026-07-31", time: "09:37", weight: 84.10, bmi: 29.1, bodyFat: 24.50, subcutaneousFat: 21.00, visceralFat: 11.7, bodyWater: 54.50, skeletalMuscle: 48.80, muscleMass: 60.30, boneMass: 3.20, protein: 17.20, bmr: 1741, bodyAge: 34 },
  { id: "bm-3",  date: "2026-07-31", time: "06:59", weight: 84.10, bmi: 29.2, bodyFat: 24.60, subcutaneousFat: 21.20, visceralFat: 11.8, bodyWater: 54.40, skeletalMuscle: 48.70, muscleMass: 60.40, boneMass: 3.20, protein: 17.20, bmr: 1742, bodyAge: 34 },
  { id: "bm-4",  date: "2026-07-20", time: "09:36", weight: 84.85, bmi: 29.4, bodyFat: 24.90, subcutaneousFat: 21.40, visceralFat: 12.0, bodyWater: 54.20, skeletalMuscle: 48.50, muscleMass: 60.50, boneMass: 3.20, protein: 17.10, bmr: 1745, bodyAge: 34 },
  { id: "bm-5",  date: "2026-07-16", time: "09:45", weight: 84.80, bmi: 29.3, bodyFat: 24.80, subcutaneousFat: 21.30, visceralFat: 11.9, bodyWater: 54.30, skeletalMuscle: 48.60, muscleMass: 60.60, boneMass: 3.20, protein: 17.10, bmr: 1747, bodyAge: 34 },
  { id: "bm-6",  date: "2026-07-15", time: "12:41", weight: 85.05, bmi: 29.4, bodyFat: 24.90, subcutaneousFat: 21.40, visceralFat: 12.0, bodyWater: 54.20, skeletalMuscle: 48.50, muscleMass: 60.60, boneMass: 3.20, protein: 17.10, bmr: 1748, bodyAge: 34 },
  { id: "bm-7",  date: "2026-07-15", time: "08:53", weight: 85.05, bmi: 29.4, bodyFat: 24.90, subcutaneousFat: 21.40, visceralFat: 12.0, bodyWater: 54.20, skeletalMuscle: 48.50, muscleMass: 60.70, boneMass: 3.20, protein: 17.10, bmr: 1749, bodyAge: 34 },
  { id: "bm-8",  date: "2026-07-14", time: "08:53", weight: 86.10, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 60.90, boneMass: 3.20, protein: 17.00, bmr: 1754, bodyAge: 34 },
  { id: "bm-9",  date: "2026-07-14", time: "08:57", weight: 86.10, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 60.90, boneMass: 3.20, protein: 17.00, bmr: 1754, bodyAge: 34 },
  { id: "bm-10", date: "2026-07-10", time: "19:14", weight: 86.25, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 61.00, boneMass: 3.20, protein: 17.00, bmr: 1757, bodyAge: 34 },
  { id: "bm-11", date: "2026-07-08", time: "09:40", weight: 86.45, bmi: 29.9, bodyFat: 25.70, subcutaneousFat: 22.10, visceralFat: 12.4, bodyWater: 53.60, skeletalMuscle: 48.00, muscleMass: 61.00, boneMass: 3.20, protein: 16.90, bmr: 1757, bodyAge: 34 },
  { id: "bm-12", date: "2026-07-08", time: "09:39", weight: 86.45, bmi: 29.9, bodyFat: 25.70, subcutaneousFat: 22.10, visceralFat: 12.4, bodyWater: 53.60, skeletalMuscle: 48.00, muscleMass: 61.00, boneMass: 3.20, protein: 16.90, bmr: 1757, bodyAge: 35 },
  { id: "bm-13", date: "2026-07-07", time: "10:12", weight: 87.05, bmi: 30.1, bodyFat: 26.00, subcutaneousFat: 22.30, visceralFat: 12.6, bodyWater: 53.40, skeletalMuscle: 47.80, muscleMass: 61.20, boneMass: 3.20, protein: 16.90, bmr: 1761, bodyAge: 35 },
  { id: "bm-14", date: "2026-07-06", time: "10:09", weight: 86.95, bmi: 30.1, bodyFat: 26.00, subcutaneousFat: 22.30, visceralFat: 12.6, bodyWater: 53.40, skeletalMuscle: 47.80, muscleMass: 61.10, boneMass: 3.20, protein: 16.90, bmr: 1759, bodyAge: 35 },
  { id: "bm-15", date: "2026-07-06", time: "10:08", weight: 86.95, bmi: 30.1, bodyFat: 26.00, subcutaneousFat: 22.30, visceralFat: 12.6, bodyWater: 53.40, skeletalMuscle: 47.80, muscleMass: 61.10, boneMass: 3.20, protein: 16.90, bmr: 1759, bodyAge: 35 },
  { id: "bm-16", date: "2026-07-05", time: "21:42", weight: 86.60, bmi: 30.0, bodyFat: 25.80, subcutaneousFat: 22.20, visceralFat: 12.5, bodyWater: 53.50, skeletalMuscle: 47.90, muscleMass: 61.00, boneMass: 3.20, protein: 16.90, bmr: 1757, bodyAge: 35 },
  { id: "bm-17", date: "2026-07-01", time: "08:32", weight: 87.40, bmi: 30.2, bodyFat: 26.20, subcutaneousFat: 22.40, visceralFat: 12.7, bodyWater: 53.30, skeletalMuscle: 47.70, muscleMass: 61.30, boneMass: 3.20, protein: 16.80, bmr: 1764, bodyAge: 35 },
  { id: "bm-18", date: "2026-05-17", time: "11:00", weight: 86.05, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 60.90, boneMass: 3.20, protein: 17.00, bmr: 1753, bodyAge: 34 },
  { id: "bm-19", date: "2026-03-31", time: "11:06", weight: 85.95, bmi: 29.7, bodyFat: 25.40, subcutaneousFat: 21.80, visceralFat: 12.2, bodyWater: 53.90, skeletalMuscle: 48.20, muscleMass: 60.90, boneMass: 3.20, protein: 17.00, bmr: 1755, bodyAge: 34 },
  { id: "bm-20", date: "2026-03-28", time: "10:38", weight: 86.25, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 61.00, boneMass: 3.20, protein: 17.00, bmr: 1757, bodyAge: 34 },
  { id: "bm-21", date: "2026-03-24", time: "17:42", weight: 86.20, bmi: 29.8, bodyFat: 25.60, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 61.00, boneMass: 3.20, protein: 17.00, bmr: 1756, bodyAge: 34 },
  { id: "bm-22", date: "2026-02-21", time: "12:40", weight: 86.25, bmi: 30.3, bodyFat: null,  subcutaneousFat: null, visceralFat: null, bodyWater: null, skeletalMuscle: null, muscleMass: null, boneMass: null, protein: null, bmr: null, bodyAge: null },
  { id: "bm-23", date: "2025-11-24", time: "11:37", weight: 86.05, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.10, muscleMass: 60.90, boneMass: 3.20, protein: 17.00, bmr: 1754, bodyAge: 34 },
  { id: "bm-24", date: "2025-11-13", time: "10:33", weight: 86.40, bmi: 29.9, bodyFat: 25.70, subcutaneousFat: 22.10, visceralFat: 12.4, bodyWater: 53.60, skeletalMuscle: 48.00, muscleMass: 61.00, boneMass: 3.20, protein: 16.90, bmr: 1756, bodyAge: 34 },
  { id: "bm-25", date: "2025-10-12", time: "10:39", weight: 85.55, bmi: 29.6, bodyFat: 25.10, subcutaneousFat: 21.60, visceralFat: 12.1, bodyWater: 54.00, skeletalMuscle: 48.40, muscleMass: 60.80, boneMass: 3.20, protein: 17.10, bmr: 1753, bodyAge: 33 },
  { id: "bm-26", date: "2025-10-06", time: "13:10", weight: 85.95, bmi: 29.7, bodyFat: 25.30, subcutaneousFat: 21.70, visceralFat: 12.2, bodyWater: 53.90, skeletalMuscle: 48.30, muscleMass: 61.00, boneMass: 3.20, protein: 17.00, bmr: 1756, bodyAge: 33 },
  { id: "bm-27", date: "2025-10-05", time: "13:05", weight: 85.95, bmi: 29.7, bodyFat: 25.30, subcutaneousFat: 21.70, visceralFat: 12.2, bodyWater: 53.90, skeletalMuscle: 48.30, muscleMass: 61.00, boneMass: 3.20, protein: 17.00, bmr: 1756, bodyAge: 33 },
  { id: "bm-28", date: "2025-10-05", time: "10:05", weight: 85.50, bmi: 29.6, bodyFat: 25.10, subcutaneousFat: 21.60, visceralFat: 12.1, bodyWater: 54.00, skeletalMuscle: 48.40, muscleMass: 60.80, boneMass: 3.20, protein: 17.10, bmr: 1752, bodyAge: 33 },
  { id: "bm-29", date: "2025-09-28", time: "12:38", weight: 86.50, bmi: 29.9, bodyFat: 25.60, subcutaneousFat: 22.00, visceralFat: 12.4, bodyWater: 53.70, skeletalMuscle: 48.10, muscleMass: 61.10, boneMass: 3.20, protein: 16.90, bmr: 1760, bodyAge: 33 },
  { id: "bm-30", date: "2025-09-28", time: "12:38", weight: 86.25, bmi: 29.8, bodyFat: 25.40, subcutaneousFat: 21.80, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.20, muscleMass: 61.10, boneMass: 3.20, protein: 17.00, bmr: 1759, bodyAge: 33 },
  { id: "bm-31", date: "2025-09-28", time: "12:38", weight: 86.25, bmi: 29.8, bodyFat: 25.50, subcutaneousFat: 21.90, visceralFat: 12.3, bodyWater: 53.80, skeletalMuscle: 48.20, muscleMass: 61.10, boneMass: 3.20, protein: 17.00, bmr: 1758, bodyAge: 33 },
];

function normalizeHeaderKey(str) {
  if (!str) return '';
  return String(str)
    .replace(/^\uFEFF/, '') // Strip UTF-8 BOM
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ') // Convert all punctuation, slashes, currency symbols to space
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

const STOCK_HEADER_ALIASES = {
  symbol: [
    "symbol ticker",
    "symbol/ticker",
    "trading symbol ticker",
    "trading symbol",
    "stock symbol",
    "symbol",
    "ticker",
    "instrument",
    "code",
    "scrip",
    "security"
  ],
  company: [
    "company name",
    "company",
    "security name",
    "stock name",
    "name",
    "description"
  ],
  quantity: [
    "quantity",
    "qty.",
    "qty",
    "net qty",
    "shares",
    "units",
    "no of shares",
    "number of shares"
  ],
  avgPrice: [
    "avg buy price",
    "average buy price",
    "avg price",
    "average price",
    "avg cost",
    "avg. cost",
    "average cost",
    "buy price",
    "purchase price",
    "cost price"
  ],
  currentPrice: [
    "current price",
    "cmp",
    "ltp",
    "last price",
    "market price",
    "closing price",
    "nav",
    "rate"
  ],
  invested: [
    "total invested",
    "investment amount",
    "buy value",
    "total cost",
    "purchase value",
    "invested"
  ],
  currentValue: [
    "current value",
    "cur val",
    "cur. val",
    "closing value",
    "market value"
  ],
  purchaseDate: [
    "purchase date",
    "buy date",
    "date",
    "trade date",
    "transaction date"
  ],
  exchange: [
    "exchange name",
    "exchange",
    "market name",
    "market type"
  ],
  category: [
    "category",
    "asset type",
    "type"
  ],
  demat: [
    "broker demat",
    "broker/demat",
    "broker",
    "demat",
    "platform",
    "source"
  ],
  owner: [
    "owner",
    "person",
    "paid by",
    "portfolio",
    "holder"
  ],
  notes: [
    "notes",
    "note",
    "remarks",
    "isin"
  ]
};

function pickFieldValue(row, headers, aliasList) {
  if (!row || !headers || !aliasList) return '';
  
  // 1. Exact match on normalized header
  for (const alias of aliasList) {
    const normAlias = normalizeHeaderKey(alias);
    for (const h of headers) {
      if (normalizeHeaderKey(h) === normAlias) {
        const val = row[h];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  
  // 2. Word boundary / Substring match for multi-word aliases
  for (const alias of aliasList) {
    const normAlias = normalizeHeaderKey(alias);
    if (!normAlias || normAlias.length <= 4 || !normAlias.includes(' ')) continue;
    for (const h of headers) {
      const normH = normalizeHeaderKey(h);
      if (normH.includes(normAlias)) {
        const val = row[h];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }
  
  return '';
}

function pickFieldNum(row, headers, aliasList) {
  const valStr = pickFieldValue(row, headers, aliasList);
  if (!valStr) return 0;
  return toNumber(valStr);
}

function parseCSVDate(dateStr) {
  if (!dateStr) return todayISO();
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  const match = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    let [, p1, p2, year] = match;
    p1 = p1.padStart(2, '0');
    p2 = p2.padStart(2, '0');
    if (year.length === 2) {
      year = (Number(year) > 50 ? '19' : '20') + year;
    }
    const day = Number(p1) > 12 || (Number(p1) <= 31 && Number(p2) <= 12) ? p1 : p2;
    const month = day === p1 ? p2 : p1;
    return `${year}-${month}-${day}`;
  }
  
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return todayISO();
}

function detectBrokerFromHeaders(headers) {
  const norm = headers.map(normalizeHeaderKey);
  
  if (norm.some(x => x.includes('net qty')) || (norm.some(x => x.includes('avg price')) && norm.some(x => x.includes('ltp')))) return 'Upstox';
  if (norm.some(x => x === 'instrument') && norm.some(x => x.includes('avg cost'))) return 'Zerodha';
  if (norm.some(x => x === 'isin') && norm.some(x => x.includes('average buy price'))) return 'Groww';
  if (norm.some(x => x.includes('market price')) && norm.some(x => x.includes('stock name'))) return 'INDmoney';
  if (norm.some(x => x.includes('symbol ticker')) || (norm.some(x => x.includes('company name')) && norm.some(x => x.includes('broker demat')))) return 'LifeLedger';
  return 'Generic';
}

function parseBrokerStockCSV(csvText, ownerOverride) {
  const parsed = parseCSV(csvText);
  if (!parsed || parsed.length === 0) return { broker: 'Unknown', entries: [], warnings: ['CSV file is empty or could not be parsed.'] };
  
  const headers = Object.keys(parsed[0]);
  const broker = detectBrokerFromHeaders(headers);
  
  console.log("[Stock Importer] Detected Broker Format:", broker);
  console.log("[Stock Importer] CSV Headers:", headers);
  
  const entries = [];
  const warnings = [];
  
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    console.log("[Stock Importer] CSV Row:", row);
    
    let rawOwner = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.owner);
    let symbol = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.symbol);
    let company = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.company);
    let qty = pickFieldNum(row, headers, STOCK_HEADER_ALIASES.quantity);
    let avgPrice = pickFieldNum(row, headers, STOCK_HEADER_ALIASES.avgPrice);
    let currentPrice = pickFieldNum(row, headers, STOCK_HEADER_ALIASES.currentPrice);
    let currentValue = pickFieldNum(row, headers, STOCK_HEADER_ALIASES.currentValue);
    let purchaseDateRaw = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.purchaseDate);
    let exchange = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.exchange) || 'NSE';
    let catRaw = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.category) || 'Stock';
    let demat = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.demat) || (broker !== 'Generic' && broker !== 'LifeLedger' ? broker : '');
    let notes = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.notes);
    let invested = 0;

    // Special check for INDmoney / formatted invested string like "10 × 170"
    const investedRaw = pickFieldValue(row, headers, STOCK_HEADER_ALIASES.invested);
    if (investedRaw && /[×x\*]/.test(investedRaw)) {
      const parts = investedRaw.split(/[×x\*]/).map(s => toNumber(s.trim()));
      if (parts[0] && parts[1]) {
        if (!qty) qty = parts[0];
        if (!avgPrice) avgPrice = parts[1];
        invested = parts[0] * parts[1];
      }
    } else if (investedRaw) {
      invested = toNumber(investedRaw);
    }
    
    // Fallbacks and derived values
    if (!symbol && company) {
      symbol = company.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
    }
    if (!company && symbol) {
      company = symbol;
    }
    
    // Clean symbol suffix like -EQ, -BE
    if (symbol) {
      symbol = symbol.toUpperCase().replace(/\s*-EQ$/i, '').replace(/\s*-BE$/i, '').replace(/[^A-Z0-9\&\.\-]/gi, '').trim();
    }
    
    // Validate minimum data requirement
    if (!symbol && !company && !qty && !invested) {
      console.warn(`[Stock Importer] Row ${i + 1} skipped: missing symbol, company, and quantity`, row);
      warnings.push(`Row ${i + 1}: Skipped due to missing stock name or quantity.`);
      continue;
    }

    if (!invested && qty && avgPrice) {
      invested = qty * avgPrice;
    }
    if (!avgPrice && qty && invested) {
      avgPrice = invested / qty;
    }
    if (!currentPrice) {
      currentPrice = avgPrice;
    }
    if (!currentValue) {
      currentValue = qty ? (qty * currentPrice) : invested;
    }

    const category = catRaw.toUpperCase().includes('ETF') ? 'ETF' : 'Stock';
    const owner = (rawOwner && ['Me', 'Wife', 'Both'].includes(normalizeOwner(rawOwner))) 
      ? normalizeOwner(rawOwner) 
      : (ownerOverride || 'Me');
    const purchaseDate = parseCSVDate(purchaseDateRaw);

    const entry = {
      id: `stk-${generateUUID()}`,
      owner,
      symbol: symbol || 'UNKNOWN',
      company: company || 'Stock',
      exchange: exchange.toUpperCase(),
      category,
      quantity: qty,
      avgPrice,
      currentPrice,
      invested,
      currentValue,
      demat: demat || (broker !== 'Generic' && broker !== 'LifeLedger' ? broker : 'Demat'),
      purchaseDate,
      notes,
    };

    console.log("[Stock Importer] Mapped Holding:", entry);
    entries.push(entry);
  }

  return { broker, entries, warnings };
}

function initStockCSVImport() {
  const importBtn = document.getElementById('importStockCSVBtn');
  const modal = document.getElementById('stockImportModal');
  const fileInput = document.getElementById('stockCSVFileInput');
  const ownerSelect = document.getElementById('stockCSVOwner');
  const brokerBadge = document.getElementById('stockCSVBrokerBadge');
  const preview = document.getElementById('stockCSVPreview');
  const importAllBtn = document.getElementById('stockCSVImportBtn');
  
  if (!importBtn || !modal) return;
  
  let pendingEntries = [];
  
  importBtn.addEventListener('click', () => {
    modal.hidden = false;
    fileInput.value = '';
    preview.innerHTML = '';
    brokerBadge.innerHTML = '';
    pendingEntries = [];
  });
  
  modal.querySelector('[data-close-modal]')?.addEventListener('click', () => {
    modal.hidden = true;
  });
  
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const owner = ownerSelect.value;
    const result = parseBrokerStockCSV(text, owner);
    pendingEntries = result.entries;
    
    const brokerColors = { Upstox: '#6b21a8', Zerodha: '#2563eb', Groww: '#16a34a', INDmoney: '#0d9488', Generic: '#6b7280' };
    brokerBadge.innerHTML = `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:${brokerColors[result.broker] || '#6b7280'};color:white;font-size:0.8rem;font-weight:600;">📊 Detected: ${result.broker}</span> <span style="opacity:0.6;font-size:0.8rem;margin-left:8px;">${result.entries.length} entries found</span>`;
    
    if (result.entries.length > 0) {
      let html = '<table style="width:100%;font-size:0.78rem;"><thead><tr><th>Symbol</th><th>Company</th><th>Qty</th><th>Avg Price</th><th>Invested</th><th>CMP</th><th>Current Value</th><th>P&L</th></tr></thead><tbody>';
      result.entries.forEach(e => {
        const pl = (e.currentValue || 0) - (e.invested || 0);
        const plColor = pl >= 0 ? '#22c55e' : '#ef4444';
        html += `<tr><td style="font-weight:600">${escapeHTML(e.symbol)}</td><td>${escapeHTML(e.company)}</td><td>${e.quantity}</td><td>${formatINR(e.avgPrice)}</td><td>${formatINR(e.invested)}</td><td>${formatINR(e.currentPrice)}</td><td>${formatINR(e.currentValue)}</td><td style="color:${plColor};font-weight:600">${formatINR(pl)}</td></tr>`;
      });
      html += '</tbody></table>';
      preview.innerHTML = html;
    } else {
      preview.innerHTML = '<p style="opacity:0.5;text-align:center;padding:20px;">No stock entries parsed. Check the file format.</p>';
    }
  });
  
  ownerSelect.addEventListener('change', () => {
    pendingEntries.forEach(e => e.owner = ownerSelect.value);
  });
  
  importAllBtn.addEventListener('click', async () => {
    if (pendingEntries.length === 0) { toast('No entries to import.'); return; }
    let addedCount = 0, updatedCount = 0;
    pendingEntries.forEach(newEntry => {
      const existingIdx = state.stocks.findIndex(s => 
        s.symbol && newEntry.symbol && 
        s.symbol.toUpperCase() === newEntry.symbol.toUpperCase() && 
        s.owner === newEntry.owner && s.demat === newEntry.demat
      );
      if (existingIdx !== -1) {
        const existing = state.stocks[existingIdx];
        existing.quantity = newEntry.quantity;
        existing.avgPrice = newEntry.avgPrice;
        existing.currentPrice = newEntry.currentPrice;
        existing.invested = newEntry.invested;
        existing.currentValue = newEntry.currentValue;
        existing.company = newEntry.company || existing.company;
        existing.category = newEntry.category || existing.category;
        updatedCount++;
      } else {
        state.stocks.push(newEntry);
        addedCount++;
      }
    });
    await saveData(true, 'stock');
    renderStockHoldingsPanel();
    renderAll();
    modal.hidden = true;
    toast(`✅ Stock import: ${addedCount} added, ${updatedCount} updated`);
  });
}

function getStockPriceCache() {
  try { return JSON.parse(localStorage.getItem(STOCK_PRICE_CACHE_KEY)) || {}; } catch { return {}; }
}
function saveStockPriceCache(cache) {
  localStorage.setItem(STOCK_PRICE_CACHE_KEY, JSON.stringify(cache));
}
function isStockPriceStale(cached) {
  if (!cached || !cached.timestamp) return true;
  const age = Date.now() - cached.timestamp;
  if (age > 4 * 60 * 60 * 1000) return true;
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  if (ist.getHours() >= 16 && ist.getHours() < 23) {
    const cacheDate = new Date(cached.timestamp);
    const cacheIST = new Date(cacheDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    if (cacheIST.getHours() < 16) return true;
  }
  return false;
}

async function refreshStockPrices(force = false) {
  const proxyUrl = localStorage.getItem(STOCK_PROXY_URL_KEY);
  if (!proxyUrl) {
    toast('⚠️ Stock price proxy not configured. Go to Settings → 📈 Stock Prices.');
    return;
  }
  const uniqueSymbols = [...new Set(state.stocks.filter(s => s.symbol).map(s => s.symbol.toUpperCase().replace(/\s*-EQ$/i, '').trim()))];
  if (uniqueSymbols.length === 0) { toast('No stock symbols to refresh.'); return; }
  const cache = getStockPriceCache();
  const needsFetch = force || uniqueSymbols.some(s => isStockPriceStale(cache[s]));
  if (!needsFetch) { toast('Stock prices are up to date.'); return; }
  toast('🔄 Refreshing stock prices…');
  try {
    const url = `${proxyUrl}?symbols=${encodeURIComponent(uniqueSymbols.join(','))}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
    const data = await response.json();
    const now = Date.now();
    let updatedCount = 0;
    for (const [symbol, priceData] of Object.entries(data)) {
      if (priceData.error) continue;
      cache[symbol.toUpperCase()] = {
        price: toNumber(priceData.price),
        prevClose: toNumber(priceData.prevClose),
        change: toNumber(priceData.change),
        changePct: toNumber(priceData.changePct),
        timestamp: now,
        date: priceData.date || new Date().toLocaleDateString('en-IN'),
      };
      updatedCount++;
    }
    if (updatedCount > 0) {
      saveStockPriceCache(cache);
      state.stocks.forEach(s => {
        if (!s.symbol) return;
        const sym = s.symbol.toUpperCase().replace(/\s*-EQ$/i, '').trim();
        const cached = cache[sym];
        if (cached && cached.price) {
          s.currentPrice = cached.price;
          s.prevClose = cached.prevClose;
          s.priceDate = cached.date;
          s.currentValue = toNumber(s.quantity) * cached.price;
        }
      });
      await saveData(true);
      renderStockHoldingsPanel();
      toast(`✅ Updated prices for ${updatedCount} stocks`);
    } else {
      toast('⚠️ No prices returned. Check proxy URL and symbols.');
    }
  } catch (err) {
    console.error('Stock price refresh failed:', err);
    toast(`❌ Price refresh failed: ${err.message}`);
  }
}

function updateStocksFromCache() {
  const cache = getStockPriceCache();
  if (Object.keys(cache).length === 0) return;
  state.stocks.forEach(s => {
    if (!s.symbol) return;
    const sym = s.symbol.toUpperCase().replace(/\s*-EQ$/i, '').trim();
    const cached = cache[sym];
    if (cached && cached.price) {
      s.currentPrice = cached.price;
      s.prevClose = cached.prevClose;
      s.priceDate = cached.date;
      s.currentValue = toNumber(s.quantity) * cached.price;
    }
  });
}

function renderStockHoldingsPanel() {
  const summary = document.getElementById("stocksOwnerSummary");
  const table = document.getElementById("stocksTable");
  if (!table) return;
  const tableEl = table.closest("table");
  const targetThead = tableEl ? tableEl.querySelector("thead") : null;

  const priceDateEl = document.getElementById("stockPriceDateLabel");
  if (priceDateEl) {
    const sampleWithDate = state.stocks.find(s => s.priceDate);
    priceDateEl.textContent = sampleWithDate?.priceDate ? `Prices: ${sampleWithDate.priceDate}` : '';
  }

  const allStocks = [...(state.stocks || [])];
  const rows = allStocks
    .filter(item => matchHoldingsOwner(item.owner || 'Me', activeHoldingsOwner))
    .filter(item => activeStockBroker === 'All' || (item.demat || '').toLowerCase() === activeStockBroker.toLowerCase())
    .sort((a, b) => new Date(b.purchaseDate || b.date || '1970-01-01') - new Date(a.purchaseDate || a.date || '1970-01-01'));

  const hasRichData = rows.some(s => s.symbol || s.company);

  const totalInvested = rows.reduce((s, item) => s + (toNumber(item.invested) || 0), 0);
  const totalCurrentValue = rows.reduce((s, item) => {
    const cv = toNumber(item.currentValue) || (toNumber(item.quantity) * toNumber(item.currentPrice || item.avgPrice));
    return s + (cv || toNumber(item.value) || 0);
  }, 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  let oneDayChange = 0, hasOneDayData = false;
  rows.forEach(s => {
    if (s.prevClose && s.currentPrice && s.quantity) {
      oneDayChange += toNumber(s.quantity) * (toNumber(s.currentPrice) - toNumber(s.prevClose));
      hasOneDayData = true;
    }
  });
  const oneDayPct = hasOneDayData && (totalCurrentValue - oneDayChange) > 0
    ? (oneDayChange / (totalCurrentValue - oneDayChange)) * 100 : 0;
  const uniqueSymbols = new Set(rows.filter(s => s.symbol).map(s => s.symbol)).size;

  if (summary) {
    const dayChangeColor = oneDayChange >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
    const dayChangeArrow = oneDayChange >= 0 ? '▲' : '▼';
    const gainColor = totalGain >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">💰 Invested (${activeHoldingsOwner})</div>
        <div class="value">${formatINR(totalInvested)}</div>
        <div class="hint">${rows.length} entries · ${uniqueSymbols} symbols</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">📈 Current Value</div>
        <div class="value">${formatINR(totalCurrentValue)}</div>
        <div class="hint">${hasRichData ? 'Live prices' : 'Manual values'}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">📊 Total P&L</div>
        <div class="value" style="color: ${gainColor}">${formatINR(totalGain)}</div>
        <div class="hint" style="color: ${gainColor}">${totalGain >= 0 ? '+' : ''}${totalGainPct.toFixed(2)}% overall</div>
      </article>
      <article class="metric-card compact-metric" style="border-left: 3px solid ${dayChangeColor}">
        <div class="label">📉 1-Day Change</div>
        <div class="value" style="color: ${dayChangeColor}">${hasOneDayData ? `${dayChangeArrow} ${formatINR(Math.abs(oneDayChange))}` : '—'}</div>
        <div class="hint">${hasOneDayData ? `${oneDayChange >= 0 ? '+' : ''}${oneDayPct.toFixed(2)}% today` : 'Refresh prices to see'}</div>
      </article>
    `;
  }

  if (activeStockView === "holdings" && hasRichData) {
    const groups = {};
    rows.forEach(s => {
      if (!s.symbol && !s.company) return;
      const key = (s.symbol || s.company || 'Unknown').toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    const holdings = Object.entries(groups).map(([symbol, txns]) => {
      const totalQty = txns.reduce((s, t) => s + toNumber(t.quantity), 0);
      const totalInv = txns.reduce((s, t) => s + (toNumber(t.invested) || toNumber(t.quantity) * toNumber(t.avgPrice)), 0);
      const avgPrice = totalQty > 0 ? totalInv / totalQty : 0;
      const currentPrice = toNumber(txns[0].currentPrice || txns[0].avgPrice);
      const prevClose = txns[0].prevClose ? toNumber(txns[0].prevClose) : null;
      const currentValue = totalQty * currentPrice;
      const gain = currentValue - totalInv;
      const gainPct = totalInv > 0 ? (gain / totalInv) * 100 : 0;
      const dayChange = prevClose ? totalQty * (currentPrice - prevClose) : null;
      const dayChangePct = prevClose && currentPrice ? ((currentPrice - prevClose) / prevClose) * 100 : null;
      const company = txns[0].company || symbol;
      const category = txns[0].category || 'Stock';
      const demat = txns[0].demat || '-';
      const exchange = txns[0].exchange || 'NSE';
      const cashFlows = txns.filter(t => t.purchaseDate && t.invested).map(t => ({ date: new Date(t.purchaseDate), amount: -toNumber(t.invested) }));
      if (totalQty > 0 && currentValue > 0) cashFlows.push({ date: new Date(), amount: currentValue });
      const xirr = cashFlows.length >= 2 ? calculateXIRR(cashFlows) : null;
      return { symbol, company, category, exchange, totalQty, avgPrice, totalInv, currentPrice, prevClose, currentValue, gain, gainPct, dayChange, dayChangePct, demat, xirr };
    });

    const sortedStockHoldings = sortHoldings(holdings, stockSortCol, stockSortDir);

    const stockColumns = [
      ['symbol', 'Symbol'], ['company', 'Company'], ['totalQty', 'Qty'],
      ['avgPrice', 'Avg Price'], ['totalInv', 'Invested'], ['currentPrice', 'CMP'],
      ['currentValue', 'Current Value'], ['dayChange', '1-Day Chg'],
      ['gain', 'P&L'], ['xirr', 'XIRR'], ['demat', 'Broker']
    ];

    if (targetThead) {
      targetThead.innerHTML = buildSortableThead(stockColumns, stockSortCol, stockSortDir);
      bindSortableHeaders(targetThead, (col) => {
        if (stockSortCol === col) { stockSortDir = stockSortDir === 'asc' ? 'desc' : 'asc'; }
        else { stockSortCol = col; stockSortDir = 'desc'; }
        renderStockHoldingsPanel();
      });
    }
    renderRows(table, sortedStockHoldings, (item) => [
      `<span style="font-weight:600">${escapeHTML(item.symbol)}</span> <small style="opacity:0.5">${escapeHTML(item.exchange)}</small>${item.category === 'ETF' ? ' <span style="background:var(--brand);color:white;padding:1px 5px;border-radius:4px;font-size:0.65rem;vertical-align:middle">ETF</span>' : ''}`,
      escapeHTML(item.company),
      item.totalQty.toFixed(item.totalQty % 1 === 0 ? 0 : 2),
      formatINR(item.avgPrice),
      formatINR(item.totalInv),
      formatINR(item.currentPrice),
      formatINR(item.currentValue),
      (() => {
        if (item.dayChange === null) return '<span style="opacity:0.4">—</span>';
        const color = item.dayChange >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        const arrow = item.dayChange >= 0 ? '▲' : '▼';
        return `<span style="color:${color};font-weight:600">${arrow} ${formatINR(Math.abs(item.dayChange))} <small>(${item.dayChange >= 0 ? '+' : ''}${item.dayChangePct.toFixed(2)}%)</small></span>`;
      })(),
      (() => {
        const color = item.gain >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        return `<span style="color:${color};font-weight:600">${formatINR(item.gain)} (${item.gain >= 0 ? '+' : ''}${item.gainPct.toFixed(2)}%)</span>`;
      })(),
      (() => {
        if (item.xirr === null) return '<span style="opacity:0.4">—</span>';
        const color = item.xirr >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        return `<span style="color:${color};font-weight:600">${item.xirr.toFixed(2)}%</span>`;
      })(),
      escapeHTML(item.demat)
    ], `No stock holdings for ${activeHoldingsOwner}. Import a CSV or add entries manually.`, 11);
  } else {
    if (targetThead) {
      targetThead.innerHTML = `<tr><th>Date</th><th>Symbol</th><th>Company</th><th>Qty</th><th>Avg Price</th><th>Invested</th><th>CMP</th><th>Current Value</th><th>P&L</th><th>Owner</th><th>Broker</th><th>Action</th></tr>`;
    }
    renderRows(table, rows, (item) => {
      if (!item.symbol && !item.company && item.value) {
        return [formatDate(item.date), '-', item.note || '-', '-', '-', '-', '-', formatINR(item.value), '-', item.owner || item.paidBy || 'Me', '-',
          `<div class="actions-wrapper"><button class="action-btn edit-btn edit-stock-btn" data-id="${item.id}" title="Edit">✏️</button><button class="action-btn delete-btn delete-stock-btn" data-id="${item.id}" title="Delete">🗑️</button></div>`];
      }
      const inv = toNumber(item.invested) || 0;
      const cur = toNumber(item.currentValue) || (toNumber(item.quantity) * toNumber(item.currentPrice || item.avgPrice)) || 0;
      const g = cur - inv;
      const pct = inv ? (g / inv) * 100 : 0;
      const plColor = g >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
      return [
        formatDate(item.purchaseDate || item.date),
        `<span style="font-weight:600">${escapeHTML(item.symbol || '-')}</span>`,
        escapeHTML(item.company || '-'),
        item.quantity ? Number(item.quantity).toFixed(item.quantity % 1 === 0 ? 0 : 2) : '-',
        item.avgPrice ? formatINR(item.avgPrice) : '-',
        formatINR(inv),
        item.currentPrice ? formatINR(item.currentPrice) : (item.avgPrice ? formatINR(item.avgPrice) : '-'),
        formatINR(cur),
        `<span style="color:${plColor};font-weight:600">${formatINR(g)} (${g >= 0 ? '+' : ''}${pct.toFixed(2)}%)</span>`,
        item.owner || 'Me',
        escapeHTML(item.demat || '-'),
        `<div class="actions-wrapper"><button class="action-btn edit-btn edit-stock-btn" data-id="${item.id}" title="Edit">✏️</button><button class="action-btn delete-btn delete-stock-btn" data-id="${item.id}" title="Delete">🗑️</button></div>`
      ];
    }, `No stock entries for ${activeHoldingsOwner}. Import a CSV or add entries manually.`, 12);
  }
}

function formatUSD(num) {
  const n = toNumber(num);
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function refreshUsStockPrices(force = false) {
  const proxyUrl = localStorage.getItem(STOCK_PROXY_URL_KEY);
  const allStocks = state.usstocks || [];
  const uniqueSymbols = [...new Set(allStocks.filter(s => s.symbol).map(s => s.symbol.toUpperCase().trim()))];
  if (uniqueSymbols.length === 0) {
    toast('No US stocks found to refresh.');
    return;
  }
  const cache = getStockPriceCache();
  const now = Date.now();

  // Skip if cache is fresh (< 1 hour) and not forced
  if (!force && uniqueSymbols.every(sym => cache[sym] && (now - cache[sym].timestamp < 3600000))) {
    updateUsStocksFromCache();
    renderUsStockHoldingsPanel();
    return;
  }

  // If force refresh, clear stale timestamps so we actually refetch
  if (force) {
    uniqueSymbols.forEach(sym => {
      if (cache[sym]) cache[sym].timestamp = 0;
    });
    saveStockPriceCache(cache);
  }

  toast('🔄 Refreshing US stock prices…');
  let updatedCount = 0;
  let failedSymbols = [...uniqueSymbols];

  // ─── Strategy 1: Google Apps Script proxy with market=US hint ───────────
  if (proxyUrl) {
    try {
      const url = `${proxyUrl}?symbols=${encodeURIComponent(uniqueSymbols.join(','))}&market=US`;
      console.log('[US Stocks] Fetching from proxy:', url);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
      const data = await response.json();
      console.log('[US Stocks] Proxy response:', JSON.stringify(data).slice(0, 1000));

      failedSymbols = [];
      for (const sym of uniqueSymbols) {
        const priceData = data[sym] || data[sym.toUpperCase()];
        if (!priceData || priceData.error || !priceData.price || toNumber(priceData.price) <= 0) {
          failedSymbols.push(sym);
          continue;
        }
        cache[sym] = {
          price: toNumber(priceData.price),
          prevClose: toNumber(priceData.prevClose) || toNumber(priceData.price),
          change: toNumber(priceData.change),
          changePct: toNumber(priceData.changePct),
          timestamp: now,
          date: priceData.date || new Date().toLocaleDateString('en-US'),
          source: priceData.source || 'proxy',
        };
        updatedCount++;
      }
    } catch (err) {
      console.warn('[US Stocks] Proxy failed:', err.message);
      // All symbols remain in failedSymbols for fallback
    }
  }

  // ─── Strategy 2: CORS proxy + Yahoo Finance for failed symbols ─────────
  if (failedSymbols.length > 0) {
    console.log(`[US Stocks] Trying CORS-proxy fallbacks for: ${failedSymbols.join(', ')}`);
    for (const sym of [...failedSymbols]) {
      try {
        const price = await fetchUsStockPriceFallback(sym);
        if (price && price.currentPrice > 0) {
          cache[sym] = {
            price: price.currentPrice,
            prevClose: price.prevClose || price.currentPrice,
            change: price.currentPrice - (price.prevClose || price.currentPrice),
            changePct: price.prevClose ? ((price.currentPrice - price.prevClose) / price.prevClose * 100) : 0,
            timestamp: now,
            date: new Date().toLocaleDateString('en-US'),
            source: price.source || 'fallback',
          };
          updatedCount++;
          failedSymbols = failedSymbols.filter(s => s !== sym);
          console.log(`[US Stocks] ✅ Fallback got ${sym}: $${price.currentPrice}`);
        }
      } catch (fallbackErr) {
        console.warn(`[US Stocks] All fallbacks failed for ${sym}:`, fallbackErr.message);
      }
    }
  }

  // ─── Apply to state ────────────────────────────────────────────────────
  if (updatedCount > 0) {
    saveStockPriceCache(cache);
    state.usstocks.forEach(s => {
      if (!s.symbol) return;
      const sym = s.symbol.toUpperCase().trim();
      const cached = cache[sym];
      if (cached && cached.price) {
        s.currentPrice = cached.price;
        s.prevClose = cached.prevClose;
        s.priceDate = cached.date;
        s.currentValue = toNumber(s.quantity) * cached.price;
      }
    });
    await saveData(true);
    renderUsStockHoldingsPanel();
    const priceDate = cache[uniqueSymbols[0]]?.date || 'now';
    const source = cache[uniqueSymbols[0]]?.source || 'proxy';
    const failMsg = failedSymbols.length > 0 ? ` (${failedSymbols.join(', ')} failed)` : '';
    toast(`✅ Updated ${updatedCount}/${uniqueSymbols.length} US stocks (${priceDate}, via ${source})${failMsg}`);
  } else {
    toast('⚠️ Could not fetch US stock prices. Check proxy URL in Settings or try again later.');
  }
}

/**
 * Multi-strategy fallback for fetching US stock prices from the browser.
 * Tries: (1) Yahoo via CORS proxies, (2) Yahoo direct, (3) Finnhub free tier.
 */
async function fetchUsStockPriceFallback(symbol) {
  const yahooUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  // ─── Strategy A: Yahoo Finance via CORS proxy services ─────────────────
  const corsProxies = [
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  ];

  for (const proxyFn of corsProxies) {
    try {
      const proxyUrl = proxyFn(yahooUrl);
      const resp = await fetch(proxyUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) continue;
      const text = await resp.text();
      // Some proxies wrap in HTML; try to find JSON
      const jsonStart = text.indexOf('{');
      if (jsonStart < 0) continue;
      const data = JSON.parse(text.slice(jsonStart));
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice > 0) {
        return {
          currentPrice: meta.regularMarketPrice,
          prevClose: meta.previousClose || meta.chartPreviousClose || 0,
          source: 'yahoo-cors-proxy',
        };
      }
    } catch (e) {
      continue;
    }
  }

  // ─── Strategy B: Yahoo Finance direct (might work if CORS is relaxed) ──
  const directEndpoints = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
  ];

  for (const url of directEndpoints) {
    try {
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const meta = data?.chart?.result?.[0]?.meta;
      if (meta && meta.regularMarketPrice > 0) {
        return {
          currentPrice: meta.regularMarketPrice,
          prevClose: meta.previousClose || meta.chartPreviousClose || 0,
          source: 'yahoo-direct',
        };
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

function updateUsStocksFromCache() {
  const cache = getStockPriceCache();
  if (Object.keys(cache).length === 0) return;
  state.usstocks.forEach(s => {
    if (!s.symbol) return;
    const sym = s.symbol.toUpperCase().trim();
    const cached = cache[sym];
    if (cached && cached.price) {
      s.currentPrice = cached.price;
      s.prevClose = cached.prevClose;
      s.priceDate = cached.date;
      s.currentValue = toNumber(s.quantity) * cached.price;
    }
  });
}

function renderUsStockHoldingsPanel() {
  const summary = document.getElementById("usstocksOwnerSummary");
  const table = document.getElementById("usstocksTable");
  if (!table) return;
  const tableEl = table.closest("table");
  const targetThead = tableEl ? tableEl.querySelector("thead") : null;

  const priceDateEl = document.getElementById("usStockPriceDateLabel");
  if (priceDateEl) {
    const sampleWithDate = (state.usstocks || []).find(s => s.priceDate);
    priceDateEl.textContent = sampleWithDate?.priceDate ? `Prices: ${sampleWithDate.priceDate}` : '';
  }

  const allStocks = [...(state.usstocks || [])];
  const rows = allStocks
    .filter(item => matchHoldingsOwner(item.owner || 'Me', activeHoldingsOwner))
    .filter(item => activeUsStockBroker === 'All' || (item.demat || '').toLowerCase() === activeUsStockBroker.toLowerCase())
    .sort((a, b) => new Date(b.purchaseDate || b.date || '1970-01-01') - new Date(a.purchaseDate || a.date || '1970-01-01'));

  const hasRichData = rows.some(s => s.symbol || s.company);

  const totalInvestedUSD = rows.reduce((s, item) => s + (toNumber(item.invested) || 0), 0);
  const totalCurrentValueUSD = rows.reduce((s, item) => {
    const cv = toNumber(item.currentValue) || (toNumber(item.quantity) * toNumber(item.currentPrice || item.avgPrice));
    return s + (cv || toNumber(item.value) || 0);
  }, 0);
  const totalGainUSD = totalCurrentValueUSD - totalInvestedUSD;
  const totalGainPct = totalInvestedUSD > 0 ? (totalGainUSD / totalInvestedUSD) * 100 : 0;

  let oneDayChangeUSD = 0, hasOneDayData = false;
  rows.forEach(s => {
    if (s.prevClose && s.currentPrice && s.quantity) {
      oneDayChangeUSD += toNumber(s.quantity) * (toNumber(s.currentPrice) - toNumber(s.prevClose));
      hasOneDayData = true;
    }
  });
  const oneDayPct = hasOneDayData && (totalCurrentValueUSD - oneDayChangeUSD) > 0
    ? (oneDayChangeUSD / (totalCurrentValueUSD - oneDayChangeUSD)) * 100 : 0;
  const uniqueSymbols = new Set(rows.filter(s => s.symbol).map(s => s.symbol)).size;

  if (summary) {
    const dayChangeColor = oneDayChangeUSD >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
    const dayChangeArrow = oneDayChangeUSD >= 0 ? '▲' : '▼';
    const gainColor = totalGainUSD >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
    summary.innerHTML = `
      <article class="metric-card compact-metric">
        <div class="label">💰 Invested (${activeHoldingsOwner})</div>
        <div class="value">${formatUSD(totalInvestedUSD)}</div>
        <div class="hint">${rows.length} entries · ${uniqueSymbols} symbols</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">📈 Current Value</div>
        <div class="value">${formatUSD(totalCurrentValueUSD)}</div>
        <div class="hint">${hasRichData ? 'Live USD prices' : 'Manual values'}</div>
      </article>
      <article class="metric-card compact-metric">
        <div class="label">📊 Total P&L</div>
        <div class="value" style="color: ${gainColor}">${formatUSD(totalGainUSD)}</div>
        <div class="hint" style="color: ${gainColor}">${totalGainUSD >= 0 ? '+' : ''}${totalGainPct.toFixed(2)}% overall</div>
      </article>
      <article class="metric-card compact-metric" style="border-left: 3px solid ${dayChangeColor}">
        <div class="label">📉 1-Day Change</div>
        <div class="value" style="color: ${dayChangeColor}">${hasOneDayData ? `${dayChangeArrow} ${formatUSD(Math.abs(oneDayChangeUSD))}` : '—'}</div>
        <div class="hint">${hasOneDayData ? `${oneDayChangeUSD >= 0 ? '+' : ''}${oneDayPct.toFixed(2)}% today` : 'Refresh prices to see'}</div>
      </article>
    `;
  }

  if (activeUsStockView === "holdings" && hasRichData) {
    const groups = {};
    rows.forEach(s => {
      if (!s.symbol && !s.company) return;
      const key = (s.symbol || s.company || 'Unknown').toUpperCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    const holdings = Object.entries(groups).map(([symbol, txns]) => {
      const totalQty = txns.reduce((s, t) => s + toNumber(t.quantity), 0);
      const totalInv = txns.reduce((s, t) => s + (toNumber(t.invested) || toNumber(t.quantity) * toNumber(t.avgPrice)), 0);
      const avgPrice = totalQty > 0 ? totalInv / totalQty : 0;
      const currentPrice = toNumber(txns[0].currentPrice || txns[0].avgPrice);
      const prevClose = txns[0].prevClose ? toNumber(txns[0].prevClose) : null;
      const currentValue = totalQty * currentPrice;
      const gain = currentValue - totalInv;
      const gainPct = totalInv > 0 ? (gain / totalInv) * 100 : 0;
      const dayChange = prevClose ? totalQty * (currentPrice - prevClose) : null;
      const dayChangePct = prevClose && currentPrice ? ((currentPrice - prevClose) / prevClose) * 100 : null;
      const company = txns[0].company || symbol;
      const category = txns[0].category || 'Stock';
      const demat = txns[0].demat || '-';
      const exchange = txns[0].exchange || 'NASDAQ';
      const cashFlows = txns.filter(t => t.purchaseDate && t.invested).map(t => ({ date: new Date(t.purchaseDate), amount: -toNumber(t.invested) }));
      if (totalQty > 0 && currentValue > 0) cashFlows.push({ date: new Date(), amount: currentValue });
      const xirr = cashFlows.length >= 2 ? calculateXIRR(cashFlows) : null;
      return { symbol, company, category, exchange, totalQty, avgPrice, totalInv, currentPrice, prevClose, currentValue, gain, gainPct, dayChange, dayChangePct, demat, xirr };
    });

    const sortedUsHoldings = sortHoldings(holdings, usStockSortCol, usStockSortDir);

    const usStockColumns = [
      ['symbol', 'Symbol'], ['company', 'Company'], ['totalQty', 'Qty'],
      ['avgPrice', 'Avg Price ($)'], ['totalInv', 'Invested ($)'], ['currentPrice', 'CMP ($)'],
      ['currentValue', 'Current Value ($)'], ['dayChange', '1-Day Chg'],
      ['gain', 'P&L'], ['xirr', 'XIRR'], ['demat', 'Broker']
    ];

    if (targetThead) {
      targetThead.innerHTML = buildSortableThead(usStockColumns, usStockSortCol, usStockSortDir);
      bindSortableHeaders(targetThead, (col) => {
        if (usStockSortCol === col) { usStockSortDir = usStockSortDir === 'asc' ? 'desc' : 'asc'; }
        else { usStockSortCol = col; usStockSortDir = 'desc'; }
        renderUsStockHoldingsPanel();
      });
    }
    renderRows(table, sortedUsHoldings, (item) => [
      `<span style="font-weight:600">${escapeHTML(item.symbol)}</span> <small style="opacity:0.5">${escapeHTML(item.exchange)}</small>${item.category === 'ETF' ? ' <span style="background:var(--brand);color:white;padding:1px 5px;border-radius:4px;font-size:0.65rem;vertical-align:middle">ETF</span>' : ''}`,
      escapeHTML(item.company),
      item.totalQty > 0 ? (item.totalQty < 1 ? item.totalQty.toFixed(6) : item.totalQty.toFixed(2)) : '-',
      formatUSD(item.avgPrice),
      formatUSD(item.totalInv),
      formatUSD(item.currentPrice),
      formatUSD(item.currentValue),
      (() => {
        if (item.dayChange === null) return '<span style="opacity:0.4">—</span>';
        const color = item.dayChange >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        const arrow = item.dayChange >= 0 ? '▲' : '▼';
        return `<span style="color:${color};font-weight:600">${arrow} ${formatUSD(Math.abs(item.dayChange))} <small>(${item.dayChange >= 0 ? '+' : ''}${item.dayChangePct.toFixed(2)}%)</small></span>`;
      })(),
      (() => {
        const color = item.gain >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        return `<span style="color:${color};font-weight:600">${formatUSD(item.gain)} (${item.gain >= 0 ? '+' : ''}${item.gainPct.toFixed(2)}%)</span>`;
      })(),
      (() => {
        if (item.xirr === null) return '<span style="opacity:0.4">—</span>';
        const color = item.xirr >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
        return `<span style="color:${color};font-weight:600">${item.xirr.toFixed(2)}%</span>`;
      })(),
      escapeHTML(item.demat)
    ], `No US stock holdings for ${activeHoldingsOwner}. Add entries manually or load sample portfolio.`, 11);
  } else {
    if (targetThead) {
      targetThead.innerHTML = `<tr><th>Date</th><th>Symbol</th><th>Company</th><th>Qty</th><th>Avg Price ($)</th><th>Invested ($)</th><th>CMP ($)</th><th>Current Value ($)</th><th>P&L</th><th>Owner</th><th>Broker</th><th>Action</th></tr>`;
    }
    renderRows(table, rows, (item) => {
      if (!item.symbol && !item.company && item.value) {
        return [formatDate(item.date), '-', item.note || '-', '-', '-', '-', '-', formatUSD(item.value), '-', item.owner || item.paidBy || 'Me', '-',
          `<div class="actions-wrapper"><button class="action-btn edit-btn edit-usstock-btn" data-id="${item.id}" title="Edit">✏️</button><button class="action-btn delete-btn delete-usstock-btn" data-id="${item.id}" title="Delete">🗑️</button></div>`];
      }
      const inv = toNumber(item.invested) || 0;
      const cur = toNumber(item.currentValue) || (toNumber(item.quantity) * toNumber(item.currentPrice || item.avgPrice)) || 0;
      const g = cur - inv;
      const pct = inv ? (g / inv) * 100 : 0;
      const plColor = g >= 0 ? 'var(--positive, #22c55e)' : 'var(--negative, #ef4444)';
      return [
        formatDate(item.purchaseDate || item.date),
        `<span style="font-weight:600">${escapeHTML(item.symbol || '-')}</span>`,
        escapeHTML(item.company || '-'),
        item.quantity ? (toNumber(item.quantity) < 1 ? toNumber(item.quantity).toFixed(6) : toNumber(item.quantity).toFixed(2)) : '-',
        item.avgPrice ? formatUSD(item.avgPrice) : '-',
        formatUSD(inv),
        item.currentPrice ? formatUSD(item.currentPrice) : (item.avgPrice ? formatUSD(item.avgPrice) : '-'),
        formatUSD(cur),
        `<span style="color:${plColor};font-weight:600">${formatUSD(g)} (${g >= 0 ? '+' : ''}${pct.toFixed(2)}%)</span>`,
        item.owner || 'Me',
        escapeHTML(item.demat || '-'),
        `<div class="actions-wrapper"><button class="action-btn edit-btn edit-usstock-btn" data-id="${item.id}" title="Edit">✏️</button><button class="action-btn delete-btn delete-usstock-btn" data-id="${item.id}" title="Delete">🗑️</button></div>`
      ];
    }, `No US stock entries for ${activeHoldingsOwner}. Add entries manually.`, 12);
  }
}

const SIMPLE_ASSET_TABS = [
  { kind: "fd", stateKey: "fd", summaryId: "fdOwnerSummary", tableId: "fdTable", label: "FD" },
  { kind: "epf", stateKey: "epf", summaryId: "epfOwnerSummary", tableId: "epfTable", label: "EPF" },
  { kind: "bonds", stateKey: "bonds", summaryId: "bondsOwnerSummary", tableId: "bondsTable", label: "Bond" },
  { kind: "ppf", stateKey: "ppf", summaryId: "ppfOwnerSummary", tableId: "ppfTable", label: "PPF" },
  { kind: "gold", stateKey: "gold", summaryId: "goldOwnerSummary", tableId: "goldTable", label: "Gold" },
  { kind: "silver", stateKey: "silver", summaryId: "silverOwnerSummary", tableId: "silverTable", label: "Silver" },
  { kind: "crypto", stateKey: "crypto", summaryId: "cryptoOwnerSummary", tableId: "cryptoTable", label: "Crypto" },
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
    if (!mfByFund[key]) mfByFund[key] = { txns: [], latestNav: t.latestNav || t.nav || 0 };
    mfByFund[key].txns.push(t);
    if (t.latestNav) mfByFund[key].latestNav = toNumber(t.latestNav);
  });
  const mutualFunds = Object.entries(mfByFund).reduce((total, [, fund]) => {
    const netUnits = calcMfCostBasis(fund.txns).netUnits;
    return total + netUnits * fund.latestNav;
  }, 0);

  const stocksTotal = (state.stocks || []).reduce((total, s) => {
    const cv = toNumber(s.currentValue) || (toNumber(s.quantity) * toNumber(s.currentPrice || s.avgPrice));
    return total + (cv || toNumber(s.value) || 0);
  }, 0);

  const simpleAssetsTotal = SIMPLE_ASSET_TABS.reduce((total, { stateKey }) => {
    return total + sum(state[stateKey] || [], "value");
  }, 0);
  return mutualFunds + stocksTotal + simpleAssetsTotal;
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
let activeInterviewDifficulty = "all";
let interviewSearchQuery = "";
let activeInterviewCategory = "all";
let activeInterviewPage = 0;
const INTERVIEW_PAGE_SIZE = 12;
let showAllAnswers = false;
let activeSimulatorSession = null;

function renderCareer() {
  const addBtn = document.getElementById("careerAddBtn");
  if (addBtn) {
    addBtn.style.display = activeCareerTab === "interview" ? "none" : "";
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
  } else if (activeCareerTab === "interview") {
    renderInterviewProgress();
    renderInterviewQuestions();
  }
}

function getFilteredQuestions() {
  if (!window.LifeLedgerInterviewQuestions) return [];
  return window.LifeLedgerInterviewQuestions.filter((q) => {
    const matchesSearch = !interviewSearchQuery || 
      q.question.toLowerCase().includes(interviewSearchQuery) || 
      q.answer.toLowerCase().includes(interviewSearchQuery) ||
      (q.tags || []).some(t => t.toLowerCase().includes(interviewSearchQuery));

    const matchesCategory = activeInterviewCategory === "all" || q.category === activeInterviewCategory;
    const matchesDifficulty = activeInterviewDifficulty === "all" || q.difficulty === activeInterviewDifficulty;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });
}

function renderInterviewProgress() {
  const prep = state.interviewPrep || { mastered: [], flagged: [], customProjects: [] };
  const masteredSet = new Set(prep.mastered || []);
  const total = window.LifeLedgerInterviewQuestions?.length || 1000;
  const masteredCount = masteredSet.size;

  const overallPercent = Math.round((masteredCount / total) * 100) || 0;

  const overallValEl = document.getElementById("interviewOverallProgressVal");
  const countEl = document.getElementById("interviewMasteredCount");
  const barEl = document.getElementById("interviewOverallProgressBar");

  if (overallValEl) overallValEl.textContent = `${overallPercent}%`;
  if (countEl) countEl.textContent = masteredCount;
  if (barEl) barEl.style.width = `${overallPercent}%`;

  // Render category progress lists
  const categoriesList = document.getElementById("interviewCategoryProgressList");
  if (categoriesList && window.LifeLedgerInterviewQuestions) {
    categoriesList.innerHTML = "";
    const cats = ["Kubernetes", "Docker", "AWS", "GCP", "Terraform", "GitLab", "MLOps", "Observability", "Security", "Linux", "Networking", "Troubleshooting", "System Design", "Scripting"];
    cats.forEach(cat => {
      const catQuestions = window.LifeLedgerInterviewQuestions.filter(q => q.category === cat);
      if (catQuestions.length === 0) return;
      const catMastered = catQuestions.filter(q => masteredSet.has(q.id)).length;
      const percent = Math.round((catMastered / catQuestions.length) * 100) || 0;
      
      const row = document.createElement("div");
      row.innerHTML = `
        <div class="progress-row">
          <span>${cat}</span>
          <strong>${catMastered}/${catQuestions.length} (${percent}%)</strong>
        </div>
        <div class="progress-row-bar-wrapper">
          <div class="progress-row-bar" style="width: ${percent}%;"></div>
        </div>
      `;
      categoriesList.appendChild(row);
    });
  }
}

function renderInterviewQuestions() {
  const grid = document.getElementById("interviewQuestionsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const filtered = getFilteredQuestions();
  const totalPages = Math.max(1, Math.ceil(filtered.length / INTERVIEW_PAGE_SIZE));
  if (activeInterviewPage >= totalPages) activeInterviewPage = totalPages - 1;
  if (activeInterviewPage < 0) activeInterviewPage = 0;

  const pageNumEl = document.getElementById("interviewPageNumber");
  if (pageNumEl) pageNumEl.textContent = `Page ${activeInterviewPage + 1} of ${totalPages}`;

  const prevBtn = document.getElementById("interviewPagePrev");
  const nextBtn = document.getElementById("interviewPageNext");
  if (prevBtn) prevBtn.disabled = activeInterviewPage === 0;
  if (nextBtn) nextBtn.disabled = activeInterviewPage === totalPages - 1;

  const startIndex = activeInterviewPage * INTERVIEW_PAGE_SIZE;
  const pageItems = filtered.slice(startIndex, startIndex + INTERVIEW_PAGE_SIZE);

  if (pageItems.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No questions matched your search criteria.</div>`;
    return;
  }

  const prep = state.interviewPrep || { mastered: [], flagged: [], customProjects: [] };
  const masteredSet = new Set(prep.mastered || []);
  const flaggedSet = new Set(prep.flagged || []);

  pageItems.forEach((q) => {
    const card = document.createElement("article");
    card.className = "interview-card";
    card.dataset.id = q.id;

    const diffClass = q.difficulty.toLowerCase();
    const isMastered = masteredSet.has(q.id);
    const isFlagged = flaggedSet.has(q.id);

    card.innerHTML = `
      <div class="interview-card-header">
        <span class="badge-difficulty ${diffClass}">${q.difficulty}</span>
        <span class="stack-meta" style="font-weight:700;">${escapeHTML(q.category)}</span>
      </div>
      <div class="interview-card-question">${escapeHTML(q.question)}</div>
      
      <div class="answer-box ${showAllAnswers ? "" : "hidden"}" id="ans-${q.id}">
        ${q.answer.replace(/\n/g, "<br>").replace(/`([^`]+)`/g, "<code>$1</code>").replace(/### (.+)/g, "<strong>$1</strong>")}
      </div>

      <div class="interview-card-actions">
        <button class="secondary-button toggle-ans-btn" type="button" style="padding: 4px 8px; font-size: 0.8rem;">
          ${showAllAnswers ? "🙈 Hide Answer" : "👁 Show Answer"}
        </button>
        
        <div class="interview-card-checkboxes" style="margin-left: auto;">
          <label>
            <input type="checkbox" class="cb-mastered" ${isMastered ? "checked" : ""} />
            <span style="color:${isMastered ? "var(--good)" : "inherit"}">Mastered</span>
          </label>
          <label>
            <input type="checkbox" class="cb-flagged" ${isFlagged ? "checked" : ""} />
            <span style="color:${isFlagged ? "var(--chart-expense)" : "inherit"}">Review</span>
          </label>
        </div>
      </div>
    `;

    // Bind Answer Toggle
    card.querySelector(".toggle-ans-btn").addEventListener("click", (e) => {
      const box = card.querySelector(".answer-box");
      const isHidden = box.classList.toggle("hidden");
      e.target.textContent = isHidden ? "👁 Show Answer" : "🙈 Hide Answer";
    });

    // Bind Mastered Toggle
    card.querySelector(".cb-mastered").addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      const prepState = state.interviewPrep || { mastered: [], flagged: [], customProjects: [] };
      if (!prepState.mastered) prepState.mastered = [];
      
      if (isChecked) {
        if (!prepState.mastered.includes(q.id)) prepState.mastered.push(q.id);
      } else {
        prepState.mastered = prepState.mastered.filter(id => id !== q.id);
      }
      state.interviewPrep = prepState;
      renderInterviewProgress();
      
      // Highlight label
      const labelText = e.target.nextElementSibling;
      labelText.style.color = isChecked ? "var(--good)" : "inherit";
      
      await saveData(true, "study");
    });

    // Bind Flagged Toggle
    card.querySelector(".cb-flagged").addEventListener("change", async (e) => {
      const isChecked = e.target.checked;
      const prepState = state.interviewPrep || { mastered: [], flagged: [], customProjects: [] };
      if (!prepState.flagged) prepState.flagged = [];

      if (isChecked) {
        if (!prepState.flagged.includes(q.id)) prepState.flagged.push(q.id);
      } else {
        prepState.flagged = prepState.flagged.filter(id => id !== q.id);
      }
      state.interviewPrep = prepState;
      
      // Highlight label
      const labelText = e.target.nextElementSibling;
      labelText.style.color = isChecked ? "var(--chart-expense)" : "inherit";

      await saveData(true, "study");
    });

    grid.appendChild(card);
  });
}

let isInterviewControlsInitialized = false;
function initInterviewControls() {
  if (isInterviewControlsInitialized) return;
  isInterviewControlsInitialized = true;

  const search = document.getElementById("interviewSearch");
  const catFilter = document.getElementById("interviewCategoryFilter");
  const diffBtns = document.querySelectorAll("[data-diff-btn]");
  const toggleAllBtn = document.getElementById("interviewToggleAllAnswersBtn");

  if (search) {
    search.addEventListener("input", debounce(() => {
      interviewSearchQuery = search.value.toLowerCase().trim();
      activeInterviewPage = 0;
      renderInterviewQuestions();
    }, 150));
  }

  if (catFilter) {
    catFilter.addEventListener("change", (e) => {
      activeInterviewCategory = e.target.value;
      activeInterviewPage = 0;
      renderInterviewQuestions();
    });
  }

  diffBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      diffBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeInterviewDifficulty = btn.dataset.diffBtn;
      activeInterviewPage = 0;
      renderInterviewQuestions();
    });
  });

  if (toggleAllBtn) {
    toggleAllBtn.addEventListener("click", () => {
      showAllAnswers = !showAllAnswers;
      toggleAllBtn.textContent = showAllAnswers ? "🙈 Hide all answers" : "👁 Show all answers";
      renderInterviewQuestions();
    });
  }

  document.getElementById("interviewPagePrev")?.addEventListener("click", () => {
    activeInterviewPage = Math.max(0, activeInterviewPage - 1);
    renderInterviewQuestions();
  });

  document.getElementById("interviewPageNext")?.addEventListener("click", () => {
    activeInterviewPage += 1;
    renderInterviewQuestions();
  });
}

function initSimulator() {
  const profileSelect = document.getElementById("simulatorProfileSelect");
  const customForm = document.getElementById("customProjectForm");
  const startBtn = document.getElementById("startSimulatorBtn");

  if (profileSelect) {
    profileSelect.addEventListener("change", (e) => {
      if (customForm) {
        customForm.style.display = e.target.value === "custom" ? "block" : "none";
      }
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      const profileVal = profileSelect.value;
      let title = "";
      let techStack = "";
      let challenges = "";
      let rounds = [];

      if (profileVal === "custom") {
        title = document.getElementById("customProjectTitle").value.trim() || "Custom Personal Project";
        techStack = document.getElementById("customProjectStack").value.trim() || "DevOps & Cloud Stack";
        challenges = document.getElementById("customProjectChallenges").value.trim() || "Scalability and reliability";

        if (!title || !techStack) {
          toast("Please enter a project title and tech stack.");
          return;
        }

        // Dynamically build 3 mock rounds based on their custom project input
        rounds = [
          {
            question: `Interviewer: Let's discuss your project: "${title}". Looking at your tech stack: "${techStack}", how do you design the Infrastructure as Code (IaC) to ensure it can be deployed consistently across dev, staging, and production environments?`,
            keywords: ["terraform", "workspace", "module", "variables", "state", "backend", "git", "ci/cd", "env"],
            modelAnswer: `For IaC in "${title}", we use Terraform modules to define reusable infrastructure components. Environment differences are handled via separate tfvars files (e.g. dev.tfvars, prod.tfvars) or Terraform workspaces. The state files are stored in a secure remote backend (like S3/GCS) with state locking enabled.`
          },
          {
            question: `Interviewer: You mentioned challenges: "${challenges}". In your architecture, if you experience sudden scaling bottlenecks or outages related to these challenges, what is your SRE incident response plan to mitigate them in real time?`,
            keywords: ["restart", "logs", "metrics", "prometheus", "grafana", "autoscaling", "rollback", "cpu", "memory", "replica"],
            modelAnswer: `First, I inspect Prometheus/Grafana dashboards for metric anomalies (CPU/Memory spikes, network drop) and view stdout logs. Immediate mitigations include scaling the deployment replicas horizontally, temporary cache introduction, or rollback to the last stable deployment if caused by a recent release.`
          },
          {
            question: `Interviewer: For SRE observability, what Service Level Indicators (SLIs) and Service Level Objectives (SLOs) would you define for this application to monitor user happiness?`,
            keywords: ["sli", "slo", "latency", "error rate", "availability", "prometheus", "99%", "p99", "p95", "uptime"],
            modelAnswer: `I would define two core SLIs: 1) Availability: % of HTTP requests returning 2xx/3xx over 30 days (SLO target: 99.9%). 2) Latency: % of successful requests completed in < 200ms (p95) over 30 days (SLO target: 99%). We track the error budget spend in Prometheus to track reliability.`
          }
        ];
      } else {
        const config = window.LifeLedgerSimulatorConfigs[profileVal];
        if (!config) return;
        title = config.title;
        techStack = config.techStack;
        challenges = config.challenges;
        rounds = config.rounds;
      }

      // Start session
      activeSimulatorSession = {
        title,
        techStack,
        challenges,
        rounds,
        currentRound: 0,
        history: []
      };

      // Switch view to console
      document.getElementById("interviewQAExplorer").style.display = "none";
      document.getElementById("interviewConsolePanel").style.display = "block";
      document.getElementById("interviewTabQA").classList.remove("active");
      
      const consoleTab = document.getElementById("interviewTabConsole");
      if (consoleTab) {
        consoleTab.disabled = false;
        consoleTab.classList.add("active");
      }
      
      const liveBadge = document.getElementById("simulatorLiveBadge");
      if (liveBadge) liveBadge.style.display = "inline";

      document.getElementById("simulatorCurrentTitle").textContent = title;
      document.getElementById("simulatorCurrentStack").textContent = techStack;

      // Reset terminal and start
      const terminal = document.getElementById("simulatorTerminal");
      terminal.innerHTML = "";

      addTerminalMessage("system", `Starting SRE Mock Interview Simulator for "${title}"...`);
      addTerminalMessage("interviewer", `Hello! Thanks for taking the time today. I see you've worked on "${title}". Let's start the technical evaluation. \n\n${rounds[0].question}`);
      
      updateSimulatorRoundIndicator();
      
      document.getElementById("simulatorUserAnswer").value = "";
      document.getElementById("simulatorEvaluationCard").style.display = "none";
    });
  }

  // Bind Console Tab buttons
  document.getElementById("interviewTabQA")?.addEventListener("click", () => {
    document.getElementById("interviewQAExplorer").style.display = "block";
    document.getElementById("interviewConsolePanel").style.display = "none";
    document.getElementById("interviewTabQA").classList.add("active");
    document.getElementById("interviewTabConsole").classList.remove("active");
  });

  document.getElementById("interviewTabConsole")?.addEventListener("click", () => {
    if (activeSimulatorSession) {
      document.getElementById("interviewQAExplorer").style.display = "none";
      document.getElementById("interviewConsolePanel").style.display = "block";
      document.getElementById("interviewTabQA").classList.remove("active");
      document.getElementById("interviewTabConsole").classList.add("active");
    }
  });

  document.getElementById("endSimulatorBtn")?.addEventListener("click", () => {
    if (confirm("Are you sure you want to end the mock interview? All progress in this session will be lost.")) {
      endSimulatorSession();
    }
  });

  document.getElementById("simulatorRevealModelBtn")?.addEventListener("click", () => {
    if (!activeSimulatorSession) return;
    const currentRound = activeSimulatorSession.rounds[activeSimulatorSession.currentRound];
    
    // Auto populate the answer field with the model answer or reveal it
    const textarea = document.getElementById("simulatorUserAnswer");
    textarea.value = `[Model Answer Draft]: ${currentRound.modelAnswer}`;
    toast("Model answer suggestion copied to input!");
  });

  document.getElementById("simulatorSubmitAnswerBtn")?.addEventListener("click", () => {
    submitSimulatorResponse();
  });
}

function endSimulatorSession() {
  activeSimulatorSession = null;
  document.getElementById("interviewQAExplorer").style.display = "block";
  document.getElementById("interviewConsolePanel").style.display = "none";
  document.getElementById("interviewTabQA").classList.add("active");
  
  const consoleTab = document.getElementById("interviewTabConsole");
  if (consoleTab) {
    consoleTab.disabled = true;
    consoleTab.classList.remove("active");
  }
  
  const liveBadge = document.getElementById("simulatorLiveBadge");
  if (liveBadge) liveBadge.style.display = "none";
  document.getElementById("simulatorEvaluationCard").style.display = "none";
}

function addTerminalMessage(sender, text) {
  const terminal = document.getElementById("simulatorTerminal");
  if (!terminal) return;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = text.replace(/\n/g, "<br>");
  terminal.appendChild(bubble);
  
  // Scroll to bottom
  terminal.scrollTop = terminal.scrollHeight;
}

function updateSimulatorRoundIndicator() {
  const indicator = document.getElementById("simulatorRoundIndicator");
  if (!indicator || !activeSimulatorSession) return;
  const current = activeSimulatorSession.currentRound + 1;
  const total = activeSimulatorSession.rounds.length;
  indicator.textContent = `Round ${current} of ${total}`;
}

function submitSimulatorResponse() {
  if (!activeSimulatorSession) return;
  const textarea = document.getElementById("simulatorUserAnswer");
  const text = textarea.value.trim();
  
  if (!text) {
    toast("Please enter your response before submitting.");
    return;
  }

  // Add user message to terminal
  addTerminalMessage("user", text);

  // Evaluate answer
  const roundIdx = activeSimulatorSession.currentRound;
  const round = activeSimulatorSession.rounds[roundIdx];
  
  // Keyword evaluation algorithm
  const textLower = text.toLowerCase();
  const matchedKeywords = round.keywords.filter((kw) => textLower.includes(kw));
  const totalKeywords = round.keywords.length;
  const scoreRatio = matchedKeywords.length / Math.max(1, totalKeywords);
  
  let grade = "Needs Improvement";
  let scorePercent = Math.round(scoreRatio * 100);
  
  if (scorePercent >= 80) grade = "Excellent SRE Knowledge!";
  else if (scorePercent >= 45) grade = "Good Conceptual Understanding";

  // Show Evaluation Card
  const evalCard = document.getElementById("simulatorEvaluationCard");
  const evalBody = document.getElementById("simulatorEvaluationBody");
  
  if (evalCard && evalBody) {
    evalCard.style.display = "block";
    evalBody.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-weight:700; font-size:1.1rem;">Score: <span style="color:var(--brand);">${scorePercent}%</span> (${grade})</span>
      </div>
      <div style="margin-bottom:12px;">
        <strong>SRE Keywords Analyzed:</strong><br>
        <div style="margin-top:6px;">
          ${round.keywords.map(kw => {
            const matched = matchedKeywords.includes(kw);
            return `<span class="keyword-badge ${matched ? 'matched' : ''}">${matched ? '✓' : '✗'} ${kw}</span>`;
          }).join("")}
        </div>
      </div>
      <div style="border-top:1px dashed var(--line); padding-top:12px; margin-top:12px;">
        <strong>Model Answer Suggestion:</strong>
        <p style="margin-top:6px; background:var(--panel-soft); padding:10px; border-radius:var(--radius-small); font-size:0.88rem; line-height:1.55;">
          ${round.modelAnswer}
        </p>
      </div>
    `;
    
    // Scroll evaluation card into view
    evalCard.scrollIntoView({ behavior: "smooth" });
  }

  // Advance session
  activeSimulatorSession.currentRound++;
  
  // Clear input
  textarea.value = "";

  if (activeSimulatorSession.currentRound < activeSimulatorSession.rounds.length) {
    // Post next question after a brief delay
    setTimeout(() => {
      addTerminalMessage("interviewer", `Moving on. \n\n${activeSimulatorSession.rounds[activeSimulatorSession.currentRound].question}`);
      updateSimulatorRoundIndicator();
    }, 1500);
  } else {
    // End of interview
    setTimeout(() => {
      addTerminalMessage("system", "Mock Interview Session Completed.");
      addTerminalMessage("interviewer", "Excellent work. We have completed the rounds. I'll pass my feedback to the SRE review panel. You can check the evaluation feedback on the dashboard!");
      
      // Keep evaluation visible, change submit button to Finish
      const submitBtn = document.getElementById("simulatorSubmitAnswerBtn");
      if (submitBtn) {
        submitBtn.textContent = "Finish & Return";
        submitBtn.onclick = () => {
          endSimulatorSession();
          submitBtn.textContent = "Submit Response";
          submitBtn.onclick = submitSimulatorResponse;
        };
      }
    }, 1500);
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
        renderGoalsOnly();
        toast(`Added ${formatINR(amount)} to "${goal.name}". Progress updated! 🎯`);
        saveData(true, "goal");
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
    renderTodoOnly();
    toast(editTaskId ? "Note updated." : "Note added.");
    await saveData(true, "todo");
  });

  // Search filter
  document.getElementById("todoSearch")?.addEventListener("input", debounce(() => {
    const el = document.getElementById("todoSearch");
    todoSearchQuery = el ? el.value.toLowerCase().trim() : "";
    renderTodoView();
  }, 150));

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
    renderExerciseOnly();
    renderDashboardOnly();
    toast(editWorkoutId ? "Workout updated." : "Workout logged successfully.");
    await saveData(true, "workout");
  });

  // Month navigation
  document.getElementById("prevExerciseMonthBtn")?.addEventListener("click", () => {
    activeExerciseMonth--;
    if (activeExerciseMonth < 0) { activeExerciseMonth = 11; activeExerciseYear--; }
    renderExerciseOnly();
  });
  document.getElementById("nextExerciseMonthBtn")?.addEventListener("click", () => {
    const now = new Date();
    if (activeExerciseYear > now.getFullYear() || (activeExerciseYear === now.getFullYear() && activeExerciseMonth >= now.getMonth())) return;
    activeExerciseMonth++;
    if (activeExerciseMonth > 11) { activeExerciseMonth = 0; activeExerciseYear++; }
    renderExerciseOnly();
  });

  // Log Body Metrics button → open modal
  document.getElementById("btnLogBodyMetrics")?.addEventListener("click", () => {
    const modal = document.getElementById("bodyMetricsModal");
    if (!modal) return;
    const dateField = document.getElementById("bmDate");
    const timeField = document.getElementById("bmTime");
    if (dateField) dateField.value = todayISO();
    if (timeField) timeField.value = new Date().toTimeString().slice(0, 5);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
  });

  // Close body metrics modal
  document.getElementById("bodyMetricsModalClose")?.addEventListener("click", () => {
    const modal = document.getElementById("bodyMetricsModal");
    if (modal) { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); }
  });

  // Body Metrics form submit
  document.getElementById("bodyMetricsForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const getVal = (id) => { const el = f.elements[id]; return el ? (toNumber(el.value) || null) : null; };
    const entry = {
      id: `bm-${generateUUID()}`,
      date: f.elements.bmDate?.value || todayISO(),
      time: f.elements.bmTime?.value || "",
      weight: getVal("bmWeight"),
      bmi: getVal("bmBmi"),
      bodyFat: getVal("bmBodyFat"),
      subcutaneousFat: getVal("bmSubcutFat"),
      visceralFat: getVal("bmVisceralFat"),
      bodyWater: getVal("bmBodyWater"),
      skeletalMuscle: getVal("bmSkeletalMuscle"),
      muscleMass: getVal("bmMuscleMass"),
      boneMass: getVal("bmBoneMass"),
      protein: getVal("bmProtein"),
      bmr: getVal("bmBmr"),
      bodyAge: getVal("bmBodyAge"),
    };
    state.bodyMetrics = state.bodyMetrics || [];
    state.bodyMetrics.push(entry);
    await saveData(true);
    renderBodyCompositionPanel();
    const modal = document.getElementById("bodyMetricsModal");
    if (modal) { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); }
    f.reset();
    toast("✅ Body metrics logged!");
  });

  // Import Body Metrics CSV
  document.getElementById("btnImportBodyMetricsCSV")?.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const imported = parseBodyMetricsCSV(text);
        if (!imported.length) { toast("⚠️ No body metrics found in CSV. Check the format."); return; }
        state.bodyMetrics = state.bodyMetrics || [];
        const existingKeys = new Set(state.bodyMetrics.map(b => `${b.date}|${b.time}`));
        let added = 0;
        imported.forEach(entry => {
          const key = `${entry.date}|${entry.time}`;
          if (!existingKeys.has(key)) {
            state.bodyMetrics.push({ ...entry, id: `bm-${generateUUID()}` });
            existingKeys.add(key);
            added++;
          }
        });
        await saveData(true);
        renderBodyCompositionPanel();
        toast(`✅ Imported ${added} body metric entries (${imported.length - added} duplicates skipped).`);
      } catch (err) {
        toast("❌ Failed to import CSV: " + err.message);
      }
    };
    input.click();
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
        renderTodoOnly();
        await saveData(false, "todo");
      });
    });

    card.querySelector(".btn-complete-card").addEventListener("change", async (e) => {
      task.done = e.target.checked;
      renderTodoOnly();
      await saveData(false, "todo");
    });

    card.querySelector(".btn-pin-card").addEventListener("click", async () => {
      task.pinned = !task.pinned;
      renderTodoOnly();
      await saveData(false, "todo");
    });

    card.querySelector(".btn-cycle-color").addEventListener("click", async () => {
      const colors = ["default", "red", "yellow", "blue", "green", "purple"];
      const currentIdx = colors.indexOf(task.color || "default");
      const nextIdx = (currentIdx + 1) % colors.length;
      task.color = colors[nextIdx];
      renderTodoOnly();
      await saveData(false, "todo");
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
        renderTodoOnly();
        toast("Card deleted.");
        await saveData(true, "todo");
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

  // Update month nav label
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const navLabel = document.getElementById("exerciseMonthNavLabel");
  if (navLabel) navLabel.textContent = `${MONTH_NAMES[activeExerciseMonth]} ${activeExerciseYear}`;

  const thisMonthWorkouts = state.workouts.filter((w) => {
    const wDate = parseCalendarDate(w.date);
    return wDate && wDate.getFullYear() === activeExerciseYear && wDate.getMonth() === activeExerciseMonth;
  });

  const totalSessions = thisMonthWorkouts.length;
  let totalMinutes = 0;
  thisMonthWorkouts.forEach((w) => { totalMinutes += w.minutes || 0; });

  if (sessionsEl) sessionsEl.textContent = totalSessions;
  if (minutesEl) minutesEl.textContent = `${totalMinutes} min`;
  if (avgEl) avgEl.textContent = totalSessions > 0 ? `${Math.round(totalMinutes / totalSessions)} min` : "0 min";

  renderStreakCalendar(activeExerciseYear, activeExerciseMonth);
  renderPersonalRecords();
  renderWorkoutConsistencyChart();
  renderBodyCompositionPanel();
  renderWorkoutYearHeatmap();

  historyFeed.innerHTML = "";
  // Show all workouts for the selected month
  const filteredWorkouts = [...state.workouts]
    .filter(w => {
      const wDate = parseCalendarDate(w.date);
      return wDate && wDate.getFullYear() === activeExerciseYear && wDate.getMonth() === activeExerciseMonth;
    })
    .sort(sortByDateDesc);

  if (filteredWorkouts.length === 0) {
    historyFeed.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--muted);">No workouts logged for ${MONTH_NAMES[activeExerciseMonth]} ${activeExerciseYear}. Log a session or navigate to another month!</div>`;
  } else {
    filteredWorkouts.forEach((workout) => {
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
          renderExerciseOnly();
          renderDashboardOnly();
          toast("Workout deleted.");
          await saveData(true, "workout");
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

function renderBodyCompositionPanel() {
  const panel = document.getElementById("bodyCompositionPanel");
  if (!panel) return;

  const metrics = [...(state.bodyMetrics || [])].sort((a, b) => new Date(b.date + "T" + (b.time || "00:00")) - new Date(a.date + "T" + (a.time || "00:00")));
  if (metrics.length === 0) {
    panel.innerHTML = `<div class="empty-state" style="text-align:center;padding:24px;color:var(--muted);">No body metrics logged yet. Click "Log Body Metrics" to start!</div>`;
    return;
  }

  const latest = metrics[0];
  const prev = metrics.length > 1 ? metrics[1] : null;
  const earliest = metrics[metrics.length - 1];

  const wChange = prev && prev.weight ? (latest.weight - prev.weight).toFixed(1) : null;
  const wChangeColor = wChange !== null ? (parseFloat(wChange) <= 0 ? 'var(--positive,#22c55e)' : 'var(--negative,#ef4444)') : 'var(--muted)';
  const wChangeSign = wChange !== null ? (parseFloat(wChange) <= 0 ? '▼' : '▲') : '';
  const totalWChange = (latest.weight - earliest.weight).toFixed(1);
  const totalWSign = parseFloat(totalWChange) <= 0 ? '▼' : '▲';
  const totalWColor = parseFloat(totalWChange) <= 0 ? 'var(--positive,#22c55e)' : 'var(--negative,#ef4444)';

  const fmt = (v, unit = '') => v != null ? `${v}${unit}` : '—';
  const fmtChg = (cur, prevVal, unit = '', lowerIsBetter = true) => {
    if (cur == null || prevVal == null) return '';
    const diff = cur - prevVal;
    const good = lowerIsBetter ? diff <= 0 : diff >= 0;
    const color = good ? 'var(--positive,#22c55e)' : 'var(--negative,#ef4444)';
    const sign = diff > 0 ? '+' : '';
    return `<span style="font-size:10px;color:${color};font-weight:600;display:block;"> ${sign}${diff.toFixed(1)}${unit} vs prev</span>`;
  };

  const bmiStatus = (bmi) => {
    if (!bmi) return '';
    if (bmi < 18.5) return '🟡 Underweight';
    if (bmi < 25) return '🟢 Normal';
    if (bmi < 30) return '🟡 Overweight';
    return '🔴 Obese';
  };

  panel.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:20px;">
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">⚖️ Weight</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.weight, 'kg')}</div>
        <div style="color:${wChangeColor};font-size:10px;font-weight:600;">${wChange !== null ? `${wChangeSign} ${Math.abs(wChange)}kg vs prev` : 'First entry'}</div>
        <div style="color:${totalWColor};font-size:9px;">${totalWSign} ${Math.abs(totalWChange)}kg total</div>
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">📊 BMI</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.bmi)}</div>
        <div style="font-size:9px;color:var(--muted);">${bmiStatus(latest.bmi)}</div>
        ${fmtChg(latest.bmi, prev?.bmi, '', true)}
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">🔥 Body Fat</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.bodyFat, '%')}</div>
        ${fmtChg(latest.bodyFat, prev?.bodyFat, '%', true)}
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">💧 Body Water</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.bodyWater, '%')}</div>
        ${fmtChg(latest.bodyWater, prev?.bodyWater, '%', false)}
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">🩺 Visceral Fat</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.visceralFat)}</div>
        ${fmtChg(latest.visceralFat, prev?.visceralFat, '', true)}
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">💪 Skeletal Muscle</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.skeletalMuscle, '%')}</div>
        ${fmtChg(latest.skeletalMuscle, prev?.skeletalMuscle, '%', false)}
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">🦴 Bone Mass</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.boneMass, 'kg')}</div>
        <div style="font-size:9px;color:var(--muted);">Stable</div>
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">🔋 BMR</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.bmr)}</div>
        <div style="font-size:9px;color:var(--muted);">kcal/day</div>
      </div>
      <div class="metric-card" style="text-align:center;padding:12px 8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:4px;">🧬 Body Age</div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--text);">${fmt(latest.bodyAge)}</div>
        ${fmtChg(latest.bodyAge, prev?.bodyAge, '', true)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
      <div class="panel" style="padding:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:10px;">⚖️ Weight Journey (kg)</div>
        <svg id="weightTrendChart" style="width:100%;height:110px;overflow:visible;"></svg>
      </div>
      <div class="panel" style="padding:14px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:10px;">🔥 Body Fat % &amp; 💪 Skeletal Muscle %</div>
        <svg id="bodyCompChart" style="width:100%;height:110px;overflow:visible;"></svg>
      </div>
    </div>
    <div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--muted);margin-bottom:10px;">📅 Recent Body Metrics Log</div>
      <div id="bodyMetricsFeed" style="display:flex;flex-direction:column;gap:6px;max-height:240px;overflow-y:auto;"></div>
    </div>
  `;

  // Render charts after DOM update
  setTimeout(() => {
    renderWeightTrendChart(metrics);
    renderBodyCompChart(metrics);
  }, 0);

  // Render body metrics feed
  const feed = document.getElementById("bodyMetricsFeed");
  if (feed) {
    const recent = metrics.slice(0, 25);
    if (recent.length === 0) {
      feed.innerHTML = `<div style="color:var(--muted);font-size:12px;font-style:italic;">No entries yet.</div>`;
    } else {
      recent.forEach(entry => {
        const row = document.createElement("div");
        row.className = "stack-row";
        row.style.cssText = "flex-direction:row;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:8px 12px;";
        row.innerHTML = `
          <div style="min-width:90px;">
            <div style="font-weight:700;font-size:12px;">${formatDate(entry.date)}</div>
            <div style="font-size:10px;color:var(--muted);">${entry.time || ''}</div>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;flex:1;">
            <span style="font-size:12px;font-weight:700;color:var(--primary);">⚖️ ${entry.weight}kg</span>
            ${entry.bmi != null ? `<span style="font-size:11px;color:var(--muted);">BMI ${entry.bmi}</span>` : ''}
            ${entry.bodyFat != null ? `<span style="font-size:11px;color:var(--negative,#ef4444);">🔥 ${entry.bodyFat}%</span>` : ''}
            ${entry.bodyWater != null ? `<span style="font-size:11px;color:var(--info,#3b82f6);">💧 ${entry.bodyWater}%</span>` : ''}
            ${entry.skeletalMuscle != null ? `<span style="font-size:11px;color:var(--positive,#22c55e);">💪 ${entry.skeletalMuscle}%</span>` : ''}
            ${entry.bmr != null ? `<span style="font-size:11px;color:var(--muted);">🔋 ${entry.bmr}kcal</span>` : ''}
          </div>
          <div class="actions-wrapper">
            <button class="action-btn delete-btn btn-delete-bodymetric" data-bmid="${entry.id}" title="Delete">🗑️</button>
          </div>
        `;
        row.querySelector(".btn-delete-bodymetric").addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.bmid;
          if (confirm("Delete this body metrics entry?")) {
            state.bodyMetrics = state.bodyMetrics.filter(b => b.id !== id);
            renderBodyCompositionPanel();
            toast("Body metric entry deleted.");
            await saveData(true);
          }
        });
        feed.append(row);
      });
    }
  }
}

function renderWeightTrendChart(metrics) {
  const svg = document.getElementById("weightTrendChart");
  if (!svg) return;
  svg.innerHTML = "";

  const data = metrics.filter(m => m.weight).slice().reverse(); // oldest first
  if (data.length < 2) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%"); text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle"); text.setAttribute("fill", "var(--muted)");
    text.setAttribute("font-size", "11px"); text.textContent = "Need 2+ readings for chart";
    svg.append(text);
    return;
  }

  const W = svg.clientWidth || 280;
  const H = svg.clientHeight || 110;
  const pl = 34, pr = 8, pt = 12, pb = 22;
  const cW = W - pl - pr;
  const cH = H - pt - pb;

  const weights = data.map(m => m.weight);
  const minW = Math.min(...weights) - 0.5;
  const maxW = Math.max(...weights) + 0.5;

  const xScale = (i) => pl + (i / (data.length - 1)) * cW;
  const yScale = (v) => pt + cH - ((v - minW) / (maxW - minW)) * cH;

  // Grid lines + Y labels
  const gridVals = [minW, (minW + maxW) / 2, maxW];
  gridVals.forEach(v => {
    const y = yScale(v);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", pl); line.setAttribute("x2", pl + cW);
    line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("stroke", "var(--line)"); line.setAttribute("stroke-width", "0.5");
    svg.append(line);
    const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lbl.setAttribute("x", pl - 3); lbl.setAttribute("y", y + 3);
    lbl.setAttribute("text-anchor", "end"); lbl.setAttribute("font-size", "8px");
    lbl.setAttribute("fill", "var(--muted)"); lbl.textContent = v.toFixed(0);
    svg.append(lbl);
  });

  // Gradient fill area
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
  grad.setAttribute("id", "weightGrad"); grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
  grad.setAttribute("x2", "0"); grad.setAttribute("y2", "1");
  const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s1.setAttribute("offset", "0%"); s1.setAttribute("stop-color", "var(--primary,#6366f1)"); s1.setAttribute("stop-opacity", "0.25");
  const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
  s2.setAttribute("offset", "100%"); s2.setAttribute("stop-color", "var(--primary,#6366f1)"); s2.setAttribute("stop-opacity", "0.02");
  grad.append(s1, s2); defs.append(grad); svg.append(defs);

  const areaPoints = data.map((m, i) => `${xScale(i)},${yScale(m.weight)}`).join(" L ");
  const area = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  area.setAttribute("points", `${pl},${yScale(minW)} L ${areaPoints} L ${xScale(data.length - 1)},${yScale(minW)}`);
  area.setAttribute("fill", "url(#weightGrad)");
  svg.append(area);

  // Line
  const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  path.setAttribute("points", data.map((m, i) => `${xScale(i)},${yScale(m.weight)}`).join(" L "));
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "var(--primary,#6366f1)");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);

  // Dots (only for first and last, and extremes)
  [0, data.length - 1].forEach(i => {
    const cx = xScale(i), cy = yScale(data[i].weight);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", cx); circle.setAttribute("cy", cy);
    circle.setAttribute("r", "3.5");
    circle.setAttribute("fill", "var(--primary,#6366f1)");
    circle.setAttribute("stroke", "var(--bg,white)"); circle.setAttribute("stroke-width", "1.5");
    svg.append(circle);
    // Label weight value
    const wLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    wLabel.setAttribute("x", cx); wLabel.setAttribute("y", cy - 6);
    wLabel.setAttribute("text-anchor", i === 0 ? "start" : "end"); wLabel.setAttribute("font-size", "9px");
    wLabel.setAttribute("font-weight", "700"); wLabel.setAttribute("fill", "var(--primary,#6366f1)");
    wLabel.textContent = `${data[i].weight}kg`;
    svg.append(wLabel);
  });

  // Date labels
  const startLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  startLbl.setAttribute("x", pl); startLbl.setAttribute("y", H - 4);
  startLbl.setAttribute("text-anchor", "start"); startLbl.setAttribute("font-size", "8px");
  startLbl.setAttribute("fill", "var(--muted)"); startLbl.textContent = data[0].date.slice(0, 7);
  svg.append(startLbl);
  const endLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
  endLbl.setAttribute("x", pl + cW); endLbl.setAttribute("y", H - 4);
  endLbl.setAttribute("text-anchor", "end"); endLbl.setAttribute("font-size", "8px");
  endLbl.setAttribute("fill", "var(--muted)"); endLbl.textContent = data[data.length - 1].date.slice(0, 7);
  svg.append(endLbl);
}

function renderBodyCompChart(metrics) {
  const svg = document.getElementById("bodyCompChart");
  if (!svg) return;
  svg.innerHTML = "";

  const data = metrics.filter(m => m.bodyFat != null && m.skeletalMuscle != null).slice().reverse();
  if (data.length < 2) {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", "50%"); text.setAttribute("y", "50%");
    text.setAttribute("text-anchor", "middle"); text.setAttribute("fill", "var(--muted)");
    text.setAttribute("font-size", "11px"); text.textContent = "Need 2+ readings for chart";
    svg.append(text);
    return;
  }

  const W = svg.clientWidth || 280;
  const H = svg.clientHeight || 110;
  const pl = 28, pr = 8, pt = 12, pb = 22;
  const cW = W - pl - pr;
  const cH = H - pt - pb;

  const fatVals = data.map(m => m.bodyFat);
  const muscleVals = data.map(m => m.skeletalMuscle);
  const allVals = [...fatVals, ...muscleVals];
  const minV = Math.min(...allVals) - 1;
  const maxV = Math.max(...allVals) + 1;

  const xScale = (i) => pl + (i / (data.length - 1)) * cW;
  const yScale = (v) => pt + cH - ((v - minV) / (maxV - minV)) * cH;

  // Grid
  [minV, (minV + maxV) / 2, maxV].forEach(v => {
    const y = yScale(v);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", pl); line.setAttribute("x2", pl + cW);
    line.setAttribute("y1", y); line.setAttribute("y2", y);
    line.setAttribute("stroke", "var(--line)"); line.setAttribute("stroke-width", "0.5");
    svg.append(line);
    const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lbl.setAttribute("x", pl - 3); lbl.setAttribute("y", y + 3);
    lbl.setAttribute("text-anchor", "end"); lbl.setAttribute("font-size", "8px");
    lbl.setAttribute("fill", "var(--muted)"); lbl.textContent = v.toFixed(0);
    svg.append(lbl);
  });

  const drawLine = (vals, color) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    path.setAttribute("points", vals.map((v, i) => `${xScale(i)},${yScale(v)}`).join(" L "));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linejoin", "round");
    svg.append(path);
    vals.forEach((v, i) => {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", xScale(i)); circle.setAttribute("cy", yScale(v));
      circle.setAttribute("r", "2.5");
      circle.setAttribute("fill", color);
      circle.setAttribute("stroke", "var(--bg,white)"); circle.setAttribute("stroke-width", "1");
      svg.append(circle);
    });
  };

  drawLine(fatVals, "#ef4444");
  drawLine(muscleVals, "#22c55e");

  // Legend
  const legend = [{ label: "Fat %", color: "#ef4444" }, { label: "Muscle %", color: "#22c55e" }];
  legend.forEach((l, i) => {
    const x = pl + i * 70;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x); rect.setAttribute("y", H - 14);
    rect.setAttribute("width", 8); rect.setAttribute("height", 8);
    rect.setAttribute("fill", l.color); rect.setAttribute("rx", "2");
    svg.append(rect);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x + 11); text.setAttribute("y", H - 7);
    text.setAttribute("font-size", "9px"); text.setAttribute("fill", "var(--muted)");
    text.textContent = l.label;
    svg.append(text);
  });
}

function renderWorkoutYearHeatmap() {
  const container = document.getElementById("workoutYearHeatmap");
  if (!container) return;

  const now = new Date();
  const weeks = 52;
  const days = weeks * 7;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);

  // Build workout day map
  const workoutDayMap = {};
  state.workouts.forEach(w => {
    const d = parseCalendarDate(w.date);
    if (!d) return;
    const key = dateToISODate(d);
    workoutDayMap[key] = (workoutDayMap[key] || 0) + 1;
  });

  let html = `<div class="heatmap-grid" style="display:flex;gap:3px;overflow-x:auto;padding-bottom:4px;">`;
  for (let w = 0; w < weeks; w++) {
    html += `<div style="display:flex;flex-direction:column;gap:3px;">`;
    for (let d = 0; d < 7; d++) {
      const dayOffset = w * 7 + d;
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + dayOffset);
      if (date > now) {
        html += `<div style="width:11px;height:11px;border-radius:2px;background:transparent;"></div>`;
        continue;
      }
      const key = dateToISODate(date);
      const count = workoutDayMap[key] || 0;
      const opacity = count === 0 ? '0.12' : count === 1 ? '0.45' : count === 2 ? '0.72' : '1';
      const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      const title = `${dateStr}: ${count > 0 ? count + ' workout' + (count > 1 ? 's' : '') : 'Rest day'}`;
      html += `<div title="${title}" style="width:11px;height:11px;border-radius:2px;background:var(--primary,#6366f1);opacity:${opacity};cursor:default;"></div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const totalWorkouts = state.workouts.length;
  const activeDays = Object.values(workoutDayMap).filter(v => v > 0).length;
  html += `<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:6px;">
    <span>${MONTH_NAMES[startDate.getMonth()]} ${startDate.getFullYear()}</span>
    <span style="font-weight:600;">${totalWorkouts} workouts · ${activeDays} active days</span>
    <span>${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}</span>
  </div>`;

  container.innerHTML = html;
}

function parseBodyMetricsCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const results = [];

  const findCol = (...keys) => {
    for (const key of keys) {
      const idx = header.findIndex(h => h.includes(key.toLowerCase()));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const dateIdx = findCol("date");
  const weightIdx = findCol("weight");
  const bmiIdx = findCol("bmi");
  const bodyFatIdx = findCol("body fat");
  const subcutIdx = findCol("subcutaneous");
  const visceralIdx = findCol("visceral");
  const bodyWaterIdx = findCol("body water");
  const skeletalIdx = findCol("skeletal muscle");
  const muscleMassIdx = findCol("muscle mass");
  const boneIdx = findCol("bone");
  const proteinIdx = findCol("protein");
  const bmrIdx = findCol("bmr");
  const bodyAgeIdx = findCol("body age");

  const parseVal = (str) => {
    if (!str || str.trim() === '--' || str.trim() === '') return null;
    const n = parseFloat(str.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? null : n;
  };

  const MONTH_MAP = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ''));
    if (!cols[dateIdx]) continue;

    let dateStr = cols[dateIdx] || '';
    let timeStr = '';
    // Format: "09:37 Aug.01 2026"
    const dtMatch = dateStr.match(/(\d{1,2}:\d{2})\s+([A-Za-z]+)\.(\d{2})\s+(\d{4})/);
    if (dtMatch) {
      timeStr = dtMatch[1];
      const month = MONTH_MAP[dtMatch[2].slice(0,3).toLowerCase()] || 1;
      dateStr = `${dtMatch[4]}-${String(month).padStart(2,'0')}-${dtMatch[3]}`;
    }

    results.push({
      date: dateStr,
      time: timeStr,
      weight: parseVal(cols[weightIdx]),
      bmi: parseVal(cols[bmiIdx]),
      bodyFat: parseVal(cols[bodyFatIdx]),
      subcutaneousFat: parseVal(cols[subcutIdx]),
      visceralFat: parseVal(cols[visceralIdx]),
      bodyWater: parseVal(cols[bodyWaterIdx]),
      skeletalMuscle: parseVal(cols[skeletalIdx]),
      muscleMass: parseVal(cols[muscleMassIdx]),
      boneMass: parseVal(cols[boneIdx]),
      protein: parseVal(cols[proteinIdx]),
      bmr: parseVal(cols[bmrIdx]),
      bodyAge: parseVal(cols[bodyAgeIdx]),
    });
  }
  return results;
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
          renderHabitsOnly();
          renderDashboardOnly();
          await saveData(true, "habit");
        });
      });

      card.querySelector(".btn-checkin-today").addEventListener("click", async () => {
        const todayStr = todayISO();
        if (habit.history.includes(todayStr)) {
          habit.history = habit.history.filter((h) => h !== todayStr);
        } else {
          habit.history.push(todayStr);
        }
        renderHabitsOnly();
        renderDashboardOnly();
        await saveData(true, "habit");
      });

      card.querySelector(".btn-edit-habit").addEventListener("click", () => {
        buildQuickAddForm("habit", habit.id);
        openModal("quickAddModal");
      });

      card.querySelector(".btn-delete-habit").addEventListener("click", async () => {
        if (confirm(`Delete habit "${habit.name}"?`)) {
          state.habits = state.habits.filter((h) => h.id !== habit.id);
          renderHabitsOnly();
          renderDashboardOnly();
          toast("Habit deleted.");
          await saveData(true, "habit");
        }
      });

      grid.append(card);
    });
  }
}

function formatChatMarkdown(text) {
  return text
    // Escape HTML
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Code blocks ```...``` (multi-line)
    .replace(/```([\s\S]*?)```/g, (_, code) => `<pre style="background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:8px 0;overflow-x:auto;font-size:11.5px;line-height:1.6;">${code.trim()}</pre>`)
    // Inline code `...`
    .replace(/`([^`]+)`/g, `<code style="background:var(--card);border:1px solid var(--line);border-radius:4px;padding:1px 5px;font-size:11px;font-family:monospace;">$1</code>`)
    // ## headers
    .replace(/^## (.+)$/gm, `<h4 style="margin:14px 0 6px;font-size:13.5px;font-weight:700;color:var(--primary);">$1</h4>`)
    // ### subheaders
    .replace(/^### (.+)$/gm, `<h5 style="margin:10px 0 4px;font-size:12.5px;font-weight:700;color:var(--text);">$1</h5>`)
    // #### sub-subheaders
    .replace(/^#### (.+)$/gm, `<h6 style="margin:8px 0 3px;font-size:12px;font-weight:700;color:var(--text);">$1</h6>`)
    // Blockquote > ...
    .replace(/^&gt; (.+)$/gm, `<div style="border-left:3px solid var(--primary);padding:6px 12px;margin:6px 0;opacity:0.85;font-style:italic;">$1</div>`)
    // Horizontal rule ---
    .replace(/^---$/gm, `<hr style="border:none;border-top:1px solid var(--line);margin:12px 0;">`)
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic *text* (but not bullets)
    .replace(/(?<![\-\*])\*(?!\*)(.+?)\*(?!\*)/g, "<em>$1</em>")
    // Italic _text_
    .replace(/\_(.+?)\_/g, "<em>$1</em>")
    // Unordered bullets - or * at line start
    .replace(/^[\-\*] (.+)$/gm, `<div style="display:flex;gap:6px;padding:2px 0;">● <span>$1</span></div>`)
    // Numbered list 1. ...
    .replace(/^(\d+)\. (.+)$/gm, `<div style="display:flex;gap:6px;padding:2px 0;"><span style="font-weight:700;min-width:16px;color:var(--primary);">$1.</span><span>$2</span></div>`)
    // Remaining newlines to <br>
    .replace(/\n{2,}/g, "<br><br>")
    .replace(/\n/g, "<br>");
}

function renderChat() {
  const log = document.getElementById("chatLog");
  log.innerHTML = "";
  state.chat.slice(-80).forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message ${message.role}`;
    bubble.innerHTML = formatChatMarkdown(message.text);
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
  state.chat.push({ id: `chat-${generateUUID()}`, role, text, at: new Date().toISOString() });
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

  // Investment totals (pulled fresh every time) — Average Cost Method
  const mfPortfolioBasis = calcMfCostBasis(state.mutualFunds);
  const mfInvested = mfPortfolioBasis.invested;
  const mfCurrentCalc = (() => {
    const byFund = {};
    state.mutualFunds.forEach((t) => {
      const key = t.fundName || "Unknown";
      if (!byFund[key]) byFund[key] = { txns: [], latestNav: t.latestNav || t.nav || 0 };
      byFund[key].txns.push(t);
      if (t.latestNav) byFund[key].latestNav = toNumber(t.latestNav);
    });
    return Object.entries(byFund).reduce((total, [, f]) => {
      const netUnits = calcMfCostBasis(f.txns).netUnits;
      return total + netUnits * f.latestNav;
    }, 0);
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

// ═══════════════════════════════════════════════════════════════
//  SORTABLE HOLDINGS TABLE UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Sort an array of holding objects by a given column key.
 * Handles strings (localeCompare) and numbers.
 */
function sortHoldings(data, col, dir) {
  return [...data].sort((a, b) => {
    let va = a[col], vb = b[col];
    // Null-safe: push nulls to the end
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string' && typeof vb === 'string') {
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    va = Number(va) || 0;
    vb = Number(vb) || 0;
    return dir === 'asc' ? va - vb : vb - va;
  });
}

/**
 * Build a sortable <thead> row with clickable headers.
 * @param {Array} columns - Array of [dataKey, displayLabel] pairs
 * @param {string} currentSort - Currently active sort column key
 * @param {string} currentDir - 'asc' or 'desc'
 * @param {Function} onSort - Callback(columnKey) when header is clicked
 * @returns {string} HTML for <tr> inside <thead>
 */
function buildSortableThead(columns, currentSort, currentDir, onSort) {
  const ths = columns.map(([key, label]) => {
    if (!key) {
      // Non-sortable column (e.g. "Action", "Invest Signal")
      return `<th>${label}</th>`;
    }
    const isActive = currentSort === key;
    const arrow = isActive ? (currentDir === 'asc' ? '▲' : '▼') : '⇅';
    const cls = isActive ? 'sortable-th sort-active' : 'sortable-th';
    return `<th class="${cls}" data-sort-key="${key}">${label} <span class="sort-arrow">${arrow}</span></th>`;
  }).join('');
  return `<tr>${ths}</tr>`;
}

/**
 * Attach click listeners to sortable <th> elements inside a thead.
 * @param {HTMLElement} thead - The <thead> element
 * @param {Function} onSort - Callback(columnKey) when a header is clicked
 */
function bindSortableHeaders(thead, onSort) {
  if (!thead) return;
  thead.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.getAttribute('data-sort-key');
      if (key) onSort(key);
    });
  });
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

function hasCSVHeader(firstRow) {
  if (!firstRow || firstRow.length === 0) return false;
  const headerWords = /date|amount|category|description|note|expense|spend|cost|debit|type|payer|paid/i;
  const hasWord = firstRow.some(cell => headerWords.test(String(cell).trim()));
  if (hasWord) return true;

  const hasDate = firstRow.some(cell => /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(String(cell).trim()) || /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(String(cell).trim()));
  const hasNumber = firstRow.some(cell => /^\-?\d+(\.\d+)?$/.test(String(cell).trim()));

  if (hasDate || hasNumber) {
    return false;
  }
  return true;
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

  const cleanRows = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
  if (cleanRows.length === 0) return [];

  const firstRow = cleanRows[0];
  let headers = [];
  let hasHeader = hasCSVHeader(firstRow);

  if (hasHeader) {
    headers = cleanRows.shift().map(h => h.trim());
  } else {
    headers = firstRow.map((_, i) => `col${i}`);
  }

  console.log(`[parseCSV] Detected delimiter: ${delimiter === "\t" ? "TAB" : "COMMA"}, HasHeader: ${hasHeader}, Headers: [${headers.join(", ")}], Data rows: ${cleanRows.length}`);
  return cleanRows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""])));
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

function normalizeTransactionType(raw) {
  if (!raw) return "PURCHASE";
  const s = String(raw).toUpperCase().trim();
  if (s === "REDEMPTION" || s.includes("REDEEM") || s.includes("SELL") || s.includes("WITHDRAW") || s.includes("SWITCH OUT") || s.includes("PAYOUT")) {
    return "REDEMPTION";
  }
  return "PURCHASE";
}

function isRedemption(t) {
  if (!t) return false;
  const s = String(t.transactionType || t.type || '').toUpperCase().trim();
  return s === "REDEMPTION" || s.includes("REDEEM") || s.includes("SELL") || s.includes("WITHDRAW") || s.includes("SWITCH OUT") || s.includes("PAYOUT");
}

/**
 * Calculate invested cost basis for a list of MF transactions using FIFO (First-In, First-Out)
 * method as mandated by SEBI and used by Groww in India.
 *
 * How FIFO works:
 *   1. Purchase transactions create lots ordered by purchase date ascending.
 *   2. Redemption transactions consume units from the oldest available purchase lots first.
 *   3. The remaining invested cost basis is the exact sum of unconsumed cost basis of active lots.
 *
 * @param {Array} txns - Array of MF transaction objects
 * @returns {{ invested: number, netUnits: number, purchasedUnits: number, redeemedUnits: number, avgCost: number }}
 */
function calcMfCostBasis(txns) {
  if (!txns || !txns.length) {
    return { invested: 0, netUnits: 0, purchasedUnits: 0, redeemedUnits: 0, avgCost: 0 };
  }

  // 1. Sort transactions by purchase date ASCENDING so oldest buys come first
  const sortedTxns = [...txns].sort((a, b) => {
    const da = new Date(a.purchaseDate || a.date || '1970-01-01').getTime();
    const db = new Date(b.purchaseDate || b.date || '1970-01-01').getTime();
    return da - db;
  });

  // 2. Build purchase lots and accumulate totals
  const purchaseLots = [];
  let totalPurchasedUnits = 0;
  let totalPurchaseCost = 0;
  let totalRedeemedUnits = 0;

  sortedTxns.forEach(t => {
    const u = toNumber(t.units);
    const inv = toNumber(t.invested);
    if (isRedemption(t)) {
      totalRedeemedUnits += u;
    } else {
      if (u > 0) {
        const purchaseNav = t.nav ? toNumber(t.nav) : (inv / u);
        purchaseLots.push({
          units: u,
          remainingUnits: u,
          invested: inv,
          nav: purchaseNav
        });
        totalPurchasedUnits += u;
        totalPurchaseCost += inv;
      }
    }
  });

  // 3. Process redemptions in FIFO order (consuming oldest lots first)
  let unitsToRedeem = totalRedeemedUnits;
  for (let lot of purchaseLots) {
    if (unitsToRedeem <= 0) break;
    if (lot.remainingUnits > 0) {
      const take = Math.min(unitsToRedeem, lot.remainingUnits);
      lot.remainingUnits -= take;
      unitsToRedeem -= take;
    }
  }

  // 4. Calculate remaining cost basis and net units from remaining lots
  let remainingInvested = 0;
  let netUnits = 0;

  purchaseLots.forEach(lot => {
    if (lot.remainingUnits > 0) {
      netUnits += lot.remainingUnits;
      const lotCostBasis = (lot.remainingUnits / lot.units) * lot.invested;
      remainingInvested += lotCostBasis;
    }
  });

  remainingInvested = Math.max(0, remainingInvested);
  netUnits = Math.max(0, netUnits);
  const avgCost = netUnits > 0 ? (remainingInvested / netUnits) : (totalPurchasedUnits > 0 ? totalPurchaseCost / totalPurchasedUnits : 0);

  return {
    invested: remainingInvested,
    netUnits,
    purchasedUnits: totalPurchasedUnits,
    redeemedUnits: totalRedeemedUnits,
    avgCost
  };
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
  const goalSearchListener = debounce(() => renderGoals(), 150);

  searchInput?.addEventListener("input", goalSearchListener);
  categoryFilter?.addEventListener("change", listener);
  ownerFilter?.addEventListener("change", listener);
  statusFilter?.addEventListener("change", listener);
  sortSelector?.addEventListener("change", listener);

  // Click handler to redirect dashboard link to goals panel
  document.getElementById("dashboardGoalPanel")?.addEventListener("click", () => {
    document.querySelector('.nav-item[data-view="goals"]')?.click();
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseCSV,
    toNumber,
    generateUUID,
    todayISO,
    escapeHTML,
    normalizeOwner,
    normalizeHeaderKey,
    STOCK_HEADER_ALIASES,
    detectBrokerFromHeaders,
    parseBrokerStockCSV,
    parseCSVDate,
    defaultStockHoldings,
    defaultUsStockHoldings,
    formatUSD,
  };
}



