/**
 * Life Ledger AI Agent — Dual Provider Architecture
 * Supports:
 *   1. Google Gemini Direct API (via 100% free Google AI Studio keys)
 *   2. OpenRouter (Multi-model aggregator: GPT-4o, Claude, DeepSeek, Llama, etc.)
 *
 * Architecture:
 *   1. buildDataContext(state) → compact data summary for LLM context
 *   2. Provider management & storage → Gemini & OpenRouter keys & models
 *   3. callAI / streamAI → intelligent provider router with automatic fallback
 *   4. askAgent(question, state) → non-streaming call
 *   5. streamAgent → streaming call (for chat)
 *   6. generateInsights / generateDailyBriefing → proactive life & wealth features
 */
(function () {
  "use strict";

  const MAX_HISTORY_MESSAGES = 10;
  const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
  const APP_REFERER = "https://prafful-chavan.github.io/life-ledger/";
  const APP_TITLE = "Life Ledger - Hey Prafful";

  const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
  const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";

  // Active AbortController for in-flight requests (replaces deadlock flags)
  let activeController = null;

  // Safe storage helper (works in browser & Node.js unit tests)
  function getStorage() {
    if (typeof localStorage !== "undefined") return localStorage;
    if (typeof global !== "undefined" && global.localStorage) return global.localStorage;
    if (typeof global !== "undefined") {
      if (!global._memoryStorage) {
        global._memoryStorage = {
          _data: {},
          getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
          setItem(k, v) { this._data[k] = String(v); },
          removeItem(k) { delete this._data[k]; },
          clear() { this._data = {}; }
        };
      }
      return global._memoryStorage;
    }
    return {
      getItem() { return null; },
      setItem() {},
      removeItem() {},
      clear() {}
    };
  }

  // ─── Provider & Key Management ──────────────────────────────────────────────

  function getGeminiKey() {
    const store = getStorage();
    return (store.getItem("lifeLedger_geminiKey") || "").trim();
  }

  function setGeminiKey(key) {
    const store = getStorage();
    if (key && key.trim()) {
      store.setItem("lifeLedger_geminiKey", key.trim());
    } else {
      store.removeItem("lifeLedger_geminiKey");
    }
  }

  function getGeminiModel() {
    const store = getStorage();
    return store.getItem("lifeLedger_geminiModel") || DEFAULT_GEMINI_MODEL;
  }

  function setGeminiModel(model) {
    const store = getStorage();
    if (model && model.trim()) {
      store.setItem("lifeLedger_geminiModel", model.trim());
    } else {
      store.removeItem("lifeLedger_geminiModel");
    }
  }

  function getOpenRouterKey() {
    const store = getStorage();
    return (store.getItem("lifeLedger_openrouterKey") || "").trim();
  }

  function setOpenRouterKey(key) {
    const store = getStorage();
    if (key && key.trim()) {
      store.setItem("lifeLedger_openrouterKey", key.trim());
    } else {
      store.removeItem("lifeLedger_openrouterKey");
    }
  }

  function getOpenRouterModel() {
    const store = getStorage();
    return store.getItem("lifeLedger_openrouterModel") || store.getItem("lifeLedger_aiModel") || DEFAULT_OPENROUTER_MODEL;
  }

  function setOpenRouterModel(model) {
    const store = getStorage();
    if (model && model.trim()) {
      store.setItem("lifeLedger_openrouterModel", model.trim());
      store.setItem("lifeLedger_aiModel", model.trim()); // backward compatibility
    } else {
      store.removeItem("lifeLedger_openrouterModel");
      store.removeItem("lifeLedger_aiModel");
    }
  }

  /**
   * Returns active provider: "gemini" or "openrouter".
   * Auto-detects if user hasn't explicitly chosen one.
   */
  function getProvider() {
    const store = getStorage();
    const explicit = store.getItem("lifeLedger_aiProvider");
    if (explicit === "gemini" || explicit === "openrouter") {
      return explicit;
    }
    // Intelligent auto-detection based on configured keys
    const hasGemini = Boolean(getGeminiKey());
    const hasOpenRouter = Boolean(getOpenRouterKey());
    if (hasGemini && !hasOpenRouter) return "gemini";
    if (hasOpenRouter && !hasGemini) return "openrouter";
    return "gemini"; // default provider
  }

  function setProvider(provider) {
    const store = getStorage();
    const normalized = provider === "openrouter" ? "openrouter" : "gemini";
    store.setItem("lifeLedger_aiProvider", normalized);
  }

  function getActiveProvider() {
    return getProvider();
  }

  /**
   * Returns true if either Gemini or OpenRouter has an API key configured.
   */
  function isAiAvailable() {
    return Boolean(getGeminiKey() || getOpenRouterKey());
  }

  function isProviderAvailable(provider) {
    return provider === "gemini" ? Boolean(getGeminiKey()) : Boolean(getOpenRouterKey());
  }

  // Backward-compatibility aliases
  function getApiKey() {
    const provider = getProvider();
    if (provider === "gemini") {
      return getGeminiKey() || getOpenRouterKey();
    }
    return getOpenRouterKey() || getGeminiKey();
  }

  function setApiKey(key) {
    const provider = getProvider();
    if (provider === "gemini") {
      setGeminiKey(key);
    } else {
      setOpenRouterKey(key);
    }
  }

  function getModel() {
    const provider = getProvider();
    return provider === "gemini" ? getGeminiModel() : getOpenRouterModel();
  }

  function setModel(model) {
    const provider = getProvider();
    if (provider === "gemini") {
      setGeminiModel(model);
    } else {
      setOpenRouterModel(model);
    }
  }

  // ─── Data Context Builder ────────────────────────────────────────────────────
  function formatINR(n) {
    const num = Number(n) || 0;
    return "₹" + num.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  function toNum(v) { return Number(v) || 0; }

  function sumField(arr, field) {
    return (arr || []).reduce((s, item) => s + toNum(item[field]), 0);
  }

  function recentItems(arr, n = 5, dateField = "date") {
    return [...(arr || [])].sort((a, b) => new Date(b[dateField] || 0) - new Date(a[dateField] || 0)).slice(0, n);
  }

  function buildDataContext(state) {
    if (!state) return "No data available.";

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const isCurrentMonth = (d) => d && d.startsWith(currentMonth);

    // ── Income summary ──
    const monthIncome = state.income.filter(i => isCurrentMonth(i.date));
    const totalIncome = sumField(state.income, "amount");
    const monthIncomeTotal = sumField(monthIncome, "amount");

    // ── Expense summary ──
    const monthExpenses = state.expenses.filter(e => isCurrentMonth(e.date));
    const totalExpenses = sumField(state.expenses, "amount");
    const monthExpenseTotal = sumField(monthExpenses, "amount");
    const expenseByCategory = {};
    monthExpenses.forEach(e => {
      const cat = e.category || "General";
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + toNum(e.amount);
    });
    const topExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // ── Investment totals (FIFO Method - SEBI/Groww compliant) ──
    let mfInvested = 0;
    let mfCurrent = 0;
    const mfByFundGroup = {};
    const mfByFund = {};
    (state.mutualFunds || []).forEach(t => {
      const key = t.fundName || "Unknown";
      if (!mfByFundGroup[key]) mfByFundGroup[key] = [];
      mfByFundGroup[key].push(t);
    });

    Object.entries(mfByFundGroup).forEach(([key, txns]) => {
      const sorted = [...txns].sort((a, b) => new Date(a.purchaseDate || a.date || '1970-01-01') - new Date(b.purchaseDate || b.date || '1970-01-01'));
      const lots = [];
      let redeemed = 0;
      let latestNav = 0;

      sorted.forEach(t => {
        const u = toNum(t.units);
        const inv = toNum(t.invested);
        const isRed = (t.transactionType || '').toUpperCase().includes('REDEEM') || (t.transactionType || '').toUpperCase() === 'REDEMPTION' || (t.transactionType || '').toUpperCase().includes('SELL');
        if (t.latestNav || t.nav) latestNav = toNum(t.latestNav || t.nav);

        if (isRed) {
          redeemed += u;
        } else if (u > 0) {
          lots.push({ units: u, remUnits: u, invested: inv });
        }
      });

      let remToRedeem = redeemed;
      for (let l of lots) {
        if (remToRedeem <= 0) break;
        const take = Math.min(remToRedeem, l.remUnits);
        l.remUnits -= take;
        remToRedeem -= take;
      }

      let groupNetUnits = 0;
      let groupNetInvested = 0;
      lots.forEach(l => {
        if (l.remUnits > 0) {
          const invPart = (l.remUnits / l.units) * l.invested;
          mfInvested += invPart;
          mfCurrent += l.remUnits * latestNav;
          groupNetUnits += l.remUnits;
          groupNetInvested += invPart;
        }
      });

      if (groupNetUnits > 0) {
        mfByFund[key] = { units: groupNetUnits, latestNav, invested: groupNetInvested };
      }
    });

    const investments = {
      "Mutual Funds": { invested: mfInvested, current: mfCurrent, count: state.mutualFunds?.length || 0 },
      "Stocks": { value: sumField(state.stocks, "value"), count: state.stocks?.length || 0 },
      "FD": { value: sumField(state.fd, "value"), count: state.fd?.length || 0 },
      "EPF": { value: sumField(state.epf, "value"), count: state.epf?.length || 0 },
      "PPF": { value: sumField(state.ppf, "value"), count: state.ppf?.length || 0 },
      "Gold": { value: sumField(state.gold, "value"), count: state.gold?.length || 0 },
      "Silver": { value: sumField(state.silver, "value"), count: state.silver?.length || 0 },
      "Crypto": { value: sumField(state.crypto, "value"), count: state.crypto?.length || 0 },
      "US Stocks": { value: sumField(state.usstocks, "value"), count: state.usstocks?.length || 0 },
      "Bank Savings": { value: sumField(state.banksaving, "value"), count: state.banksaving?.length || 0 },
      "Bonds": { value: sumField(state.bonds, "value"), count: state.bonds?.length || 0 },
      "Others": { value: sumField(state.others, "value"), count: state.others?.length || 0 },
    };
    const totalHoldings = mfCurrent + Object.entries(investments).filter(([k]) => k !== "Mutual Funds").reduce((s, [, v]) => s + (v.value || 0), 0);
    const totalLiabilities = sumField(state.liabilities, "value");
    const netWorth = totalHoldings - totalLiabilities;

    // ── Goals ──
    const goalsText = (state.goals || []).map(g => {
      const pct = toNum(g.target) > 0 ? Math.round((toNum(g.saved) / toNum(g.target)) * 100) : 0;
      const remaining = toNum(g.target) - toNum(g.saved);
      return `  - ${g.name} (${g.owner || "Me"}): ${formatINR(g.saved)}/${formatINR(g.target)} = ${pct}% done, remaining ${formatINR(remaining)}, due: ${g.dueDate || "no date"}`;
    }).join("\n") || "  No goals set.";

    // ── Habits ──
    const habitsText = (state.habits || []).map(h => {
      const today = now.toISOString().split("T")[0];
      const doneToday = (h.history || []).includes(today);
      return `  - ${h.name} (${h.owner || "Me"}): 🔥 ${h.streak || 0}-day streak, best: ${h.bestStreak || 0}, frequency: ${h.frequency || "Daily"}, today: ${doneToday ? "✅ done" : "❌ not done"}`;
    }).join("\n") || "  No habits tracked.";

    // ── Tasks ──
    const pendingTasks = (state.tasks || []).filter(t => !t.done);
    const doneTasks = (state.tasks || []).filter(t => t.done);
    const tasksText = pendingTasks.slice(0, 10).map(t =>
      `  - ⬜ ${t.text}${t.area ? " [" + t.area + "]" : ""}`
    ).join("\n") || "  All tasks done!";

    // ── Career/Studies ──
    const myStudies = (state.studies || []).filter(s => (s.owner || "Me") === "Me");
    const wifeStudies = (state.studies || []).filter(s => (s.owner || "Me") === "Wife");
    const studiesText = (topic, arr) => arr.map(s =>
      `  - ${s.topic}: ${s.confidence || 0}% confidence, ${s.hours || 0}/${s.targetHours || 20}h, status: ${s.status || "Planned"}`
    ).join("\n") || "  No topics.";

    // ── Workouts & Activities (Steps, Cycling, Workouts) ──
    const allActs = [
      ...(state.activities || []).map(a => ({
        date: a.date,
        type: a.type,
        title: a.title || a.type,
        steps: a.steps,
        distanceKm: a.distanceKm,
        minutes: a.durationMin || a.minutes,
        calories: a.caloriesBurned,
        intensity: a.intensity
      })),
      ...(state.workouts || []).map(w => ({
        date: w.date,
        type: "workout",
        title: w.type || "Workout",
        minutes: w.minutes,
        intensity: w.intensity
      }))
    ].sort((a, b) => new Date(b.date || '1970-01-01') - new Date(a.date || '1970-01-01'));

    const recentWorkouts = allActs.slice(0, 10);
    const todayStr = now.toISOString().split("T")[0];
    const todayActs = allActs.filter(a => a.date === todayStr);
    const todaySteps = todayActs.reduce((s, a) => s + (toNum(a.steps) || 0), 0);
    const todayCal = todayActs.reduce((s, a) => s + (toNum(a.calories) || 0), 0);
    const todayMin = todayActs.reduce((s, a) => s + (toNum(a.minutes) || 0), 0);
    const goals = state.fitnessGoals || { dailySteps: 10000, activeCalories: 500, activeMinutes: 45, weeklyCyclingKm: 50 };

    const workoutsText = recentWorkouts.map(w => {
      let parts = [];
      if (w.steps) parts.push(`${toNum(w.steps).toLocaleString()} steps`);
      if (w.distanceKm) parts.push(`${w.distanceKm} km`);
      if (w.minutes) parts.push(`${w.minutes} min`);
      if (w.calories) parts.push(`${w.calories} kcal`);
      return `  - ${w.date}: [${(w.type || 'activity').toUpperCase()}] "${w.title}" (${parts.join(', ') || w.intensity || '—'})`;
    }).join("\n") || "  No activities logged.";

    // ── Liabilities ──
    const liabilitiesText = (state.liabilities || []).map(l =>
      `  - ${l.name || l.category || "—"} (${l.owner || "Both"}): ${formatINR(l.value)}`
    ).join("\n") || "  No liabilities.";

    // ── Recent transactions ──
    const recentExpenses = recentItems(state.expenses, 8);
    const recentExpensesText = recentExpenses.map(e =>
      `  - ${e.date}: ${e.category || "General"} — ${formatINR(e.amount)}${e.note ? " (" + e.note + ")" : ""}`
    ).join("\n");

    // ── Assets ──
    const assetsText = (state.assets || []).map(a =>
      `  - ${a.name} (${a.category || "—"}, ${a.owner || "Me"}): ${formatINR(a.value)}`
    ).join("\n") || "  No registered assets.";

    // ── Monthly savings rate ──
    const savingsRate = monthIncomeTotal > 0 ? Math.round(((monthIncomeTotal - monthExpenseTotal) / monthIncomeTotal) * 100) : 0;

    // ── Previous month comparison ──
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, "0")}`;
    const prevMonthExpenses = state.expenses.filter(e => e.date && e.date.startsWith(prevMonthKey));
    const prevMonthExpenseTotal = sumField(prevMonthExpenses, "amount");
    const prevMonthIncome = state.income.filter(i => i.date && i.date.startsWith(prevMonthKey));
    const prevMonthIncomeTotal = sumField(prevMonthIncome, "amount");

    // ── Investment breakdown text ──
    const investText = Object.entries(investments)
      .filter(([, v]) => (v.value || v.current || 0) > 0)
      .map(([name, v]) => {
        if (name === "Mutual Funds") {
          const gain = v.current - v.invested;
          return `  - ${name}: invested ${formatINR(v.invested)}, current ${formatINR(v.current)}, gain/loss ${formatINR(gain)} (${v.invested ? ((gain / v.invested) * 100).toFixed(1) : 0}%), ${v.count} transactions`;
        }
        return `  - ${name}: ${formatINR(v.value)} (${v.count} entries)`;
      }).join("\n");

    // ── MF fund-wise breakdown ──
    const mfFundText = Object.entries(mfByFund)
      .sort((a, b) => (b[1].units * b[1].latestNav) - (a[1].units * a[1].latestNav))
      .slice(0, 10)
      .map(([name, f]) => `  - ${name}: ${f.units.toFixed(3)} units × ₹${f.latestNav.toFixed(2)} = ${formatINR(f.units * f.latestNav)}`)
      .join("\n");

    return `
=== PRAFFUL'S COMPLETE LIFE DATA (as of ${now.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}) ===

📊 FINANCIAL SNAPSHOT
  Net Worth: ${formatINR(netWorth)}
  Total Investment Holdings: ${formatINR(totalHoldings)}
  Total Liabilities: ${formatINR(totalLiabilities)}

💰 THIS MONTH (${currentMonth})
  Income: ${formatINR(monthIncomeTotal)} (${monthIncome.length} entries)
  Expenses: ${formatINR(monthExpenseTotal)} (${monthExpenses.length} entries)
  Surplus/Deficit: ${formatINR(monthIncomeTotal - monthExpenseTotal)}
  Savings Rate: ${savingsRate}%
  
📅 LAST MONTH (${prevMonthKey})
  Income: ${formatINR(prevMonthIncomeTotal)}
  Expenses: ${formatINR(prevMonthExpenseTotal)}
  Expense change: ${prevMonthExpenseTotal > 0 ? ((monthExpenseTotal - prevMonthExpenseTotal) / prevMonthExpenseTotal * 100).toFixed(1) + "%" : "N/A"}

💸 TOP EXPENSE CATEGORIES (this month)
${topExpenses.map(([cat, amt]) => `  - ${cat}: ${formatINR(amt)}`).join("\n") || "  No expenses this month."}

📝 RECENT EXPENSES
${recentExpensesText || "  No recent expenses."}

📈 INVESTMENT PORTFOLIO
${investText || "  No investments."}

🏦 MUTUAL FUND BREAKDOWN (top 10 by value)
${mfFundText || "  No mutual fund data."}

🏠 REGISTERED ASSETS
${assetsText}

⚠️ LIABILITIES
${liabilitiesText}

🎯 GOALS
${goalsText}

✅ TASKS (${pendingTasks.length} pending, ${doneTasks.length} done)
${tasksText}

🔥 HABITS
${habitsText}

🏃 FITNESS, EXERCISE & ACTIVITIES (Recent)
  Today's Movement: ${todayActs.length > 0 ? "✅ active" : "❌ not logged yet"} (Steps: ${todaySteps.toLocaleString()}/${goals.dailySteps.toLocaleString()}, Calories: ${todayCal}/${goals.activeCalories} kcal, Time: ${todayMin}/${goals.activeMinutes} min)
  Goals: ${goals.dailySteps.toLocaleString()} steps/day • ${goals.activeCalories} kcal/day • ${goals.activeMinutes} min/day • ${goals.weeklyCyclingKm} km cycling/week
${workoutsText}

🚀 CAREER — PRAFFUL (SRE/DevOps, 8 years experience)
${studiesText("DevOps", myStudies)}

📊 CAREER — WIFE (ETL/Data Engineering)
${studiesText("ETL", wifeStudies)}

📊 ALL-TIME TOTALS
  Total income entries: ${state.income?.length || 0}, total: ${formatINR(totalIncome)}
  Total expense entries: ${state.expenses?.length || 0}, total: ${formatINR(totalExpenses)}
  Total activities & workouts: ${allActs.length}
`.trim();
  }

  // ─── System Prompt — Pro Banker + CA + Life Coach ────────────────────────────
  const SYSTEM_PROMPT = `You are "Hey Prafful" — Prafful Chavan's AI-powered personal life operating system. You are embedded inside his Life Ledger app and have COMPLETE access to all his financial, career, health, and life data.

YOU ARE THREE EXPERTS IN ONE:

🏦 EXPERT 1: PERSONAL FINANCE ADVISOR & CHARTERED ACCOUNTANT (CA)
• Analyze mutual fund performance — identify which funds are growing well, which are underperforming, which to EXIT
• Analyze stock portfolio — winners, losers, sector concentration risks
• Tax planning — ELSS, Section 80C, 80D, HRA, NPS, old vs new regime optimization
• SIP optimization — which SIPs to increase, decrease, or stop
• Debt management — prioritize loan repayments, interest rate optimization
• Emergency fund adequacy check (6 months of expenses)
• Insurance coverage gaps
• Goal-based investment allocation (which goal needs more funding)
• Net worth trend analysis and projections
• FD vs liquid fund vs savings account optimization
• Compare Prafful vs Wife's financial contributions and suggest balance

💪 EXPERT 2: STRICT ACCOUNTABILITY PARTNER & LIFE COACH
• Track and ENFORCE goal completion — calculate projected dates, call out delays
• Push for daily exercise — if not exercised today, be STERN about it
• Celebrate habit streaks and WARN about breaking them
• Review pending tasks and PRIORITIZE the top 3 for today
• Daily motivational push based on actual data, not generic advice
• Career guidance — study hours tracking, certification progress, skill gaps
• Compare Prafful's and wife's career progress, suggest actionable steps
• Weekly and monthly review summaries with specific action items

📊 EXPERT 3: DATA ANALYST & WEALTH STRATEGIST
• Month-over-month spending trend analysis with exact numbers
• Category-wise expense breakdown and anomaly detection
• Savings rate optimization — where can you save more?
• 5-year and 10-year wealth projections based on current pace
• Goal completion probability analysis
• Investment portfolio rebalancing suggestions
• Identify financial leaks (subscriptions, unnecessary spending)

PERSONALITY & RULES:
• You are direct, data-driven, and hold Prafful accountable like a strict mentor
• You speak like a trusted friend who genuinely wants Prafful and his wife to succeed
• Use Indian Rupee (₹) formatting with Indian number system (lakhs, crores)
• Be SPECIFIC — cite exact numbers from the data, never be vague
• For complex questions, provide EXHAUSTIVE multi-section analysis — NEVER truncate or cut short
• Include tables, calculations, step-by-step action items, and clear conclusions
• For simple questions (balance, today's habits), keep it brief and punchy
• Use proper markdown: **bold** for numbers, ## for section headers, - for bullets, > for callouts
• Use emojis sparingly but effectively
• If data is insufficient, say so honestly — NEVER fabricate numbers
• Add financial disclaimer when giving investment-specific advice
• Prafful is an 8-year experienced SRE/DevOps/MLOps engineer
• His wife is learning ETL/Data Engineering — support her growth too
• Treat the provided data as your bible — every number matters`;

  // ─── Gemini Payload & Content Formatter ─────────────────────────────────────

  /**
   * Google Gemini API requires role: 'user' | 'model' (never 'assistant').
   * It also requires alternating turns and the first turn must be 'user'.
   */
  function buildGeminiContents(userMessage, chatHistory = []) {
    const rawMessages = [];
    const recent = (chatHistory || []).slice(-MAX_HISTORY_MESSAGES);
    for (const msg of recent) {
      const role = (msg.role === "assistant" || msg.role === "model") ? "model" : "user";
      const text = (msg.text || "").trim();
      if (text) {
        rawMessages.push({ role, text });
      }
    }

    const currentPrompt = (userMessage || "").trim() || "Hello";
    rawMessages.push({ role: "user", text: currentPrompt });

    // Discard any leading 'model' turn so contents[0] is always 'user'
    while (rawMessages.length > 0 && rawMessages[0].role === "model") {
      rawMessages.shift();
    }

    // Consolidate consecutive turns of the same role
    const consolidated = [];
    for (const item of rawMessages) {
      if (consolidated.length > 0 && consolidated[consolidated.length - 1].role === item.role) {
        consolidated[consolidated.length - 1].parts[0].text += "\n\n" + item.text;
      } else {
        consolidated.push({
          role: item.role,
          parts: [{ text: item.text }]
        });
      }
    }

    if (consolidated.length === 0) {
      consolidated.push({ role: "user", parts: [{ text: currentPrompt }] });
    }

    return consolidated;
  }

  function buildGeminiPayload(userMessage, dataContext, chatHistory = []) {
    const systemText = `${SYSTEM_PROMPT}\n\n[CURRENT LIFE DATA CONTEXT]\n=========================================\n${dataContext}\n=========================================`;
    return {
      systemInstruction: {
        parts: [{ text: systemText }]
      },
      contents: buildGeminiContents(userMessage, chatHistory),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
    };
  }

  // ─── OpenRouter Payload Formatter ───────────────────────────────────────────

  function buildOpenRouterMessages(userMessage, dataContext, chatHistory = []) {
    return [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n[CURRENT LIFE DATA CONTEXT]\n=========================================\n${dataContext}\n=========================================`
      },
      ...(chatHistory || []).slice(-MAX_HISTORY_MESSAGES).map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.text || ""
      })),
      { role: "user", content: (userMessage || "").trim() || "Hello" }
    ];
  }

  function buildOpenRouterPayload(userMessage, dataContext, chatHistory = [], model = DEFAULT_OPENROUTER_MODEL, stream = false) {
    return {
      model: model,
      messages: buildOpenRouterMessages(userMessage, dataContext, chatHistory),
      temperature: 0.7,
      max_tokens: 16384,
      stream: Boolean(stream)
    };
  }

  // ─── Google Gemini API Handlers ─────────────────────────────────────────────

  async function callGeminiAI(userMessage, dataContext, chatHistory = []) {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error("No Google Gemini API key. Please add your key in Settings.");

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    const model = getGeminiModel();
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const payload = buildGeminiPayload(userMessage, dataContext, chatHistory);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedMessage = "";
        try {
          const parsed = JSON.parse(errorBody);
          parsedMessage = parsed.error?.message || "";
        } catch (e) {}

        if (response.status === 400) {
          throw new Error(`Gemini Bad Request: ${parsedMessage || "Invalid model name or parameter"}`);
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error(`Invalid Gemini API key. Verify your key at aistudio.google.com/app/apikey`);
        }
        if (response.status === 429) {
          throw new Error("Gemini rate limit exceeded. Please wait a few seconds and try again.");
        }
        throw new Error(`Gemini API error (${response.status}): ${parsedMessage || errorBody.slice(0, 160)}`);
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];
      if (!candidate) {
        if (data?.promptFeedback?.blockReason) {
          throw new Error(`Gemini safety block: ${data.promptFeedback.blockReason}`);
        }
        throw new Error("No response generated by Gemini. Try a different question.");
      }

      const text = (candidate.content?.parts || []).map(p => p.text || "").join("").trim();
      if (!text) throw new Error("Empty response from Gemini.");
      return text;
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  async function streamGeminiAI(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      onError(new Error("No Google Gemini API key. Please add your key in Settings."));
      return;
    }

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    const model = getGeminiModel();
    const url = `${GEMINI_API_BASE}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    const payload = buildGeminiPayload(userMessage, dataContext, chatHistory);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (activeController === controller) activeController = null;

        if (response.status === 401 || response.status === 403) {
          onError(new Error("Invalid Gemini API key. Get one at aistudio.google.com/app/apikey"));
          return;
        }
        if (response.status === 429) {
          onError(new Error("Gemini rate limit reached. Please wait a few moments."));
          return;
        }

        // Fallback to non-streaming
        console.warn("[AI Agent] Gemini stream failed, falling back to non-streaming...");
        try {
          const fallbackText = await callGeminiAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const partText = parsed.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
            if (partText) {
              fullText += partText;
              onChunk(fullText);
            }
          } catch (e) {
            // ignore unparseable line
          }
        }
      }

      if (activeController === controller) activeController = null;

      if (fullText) {
        onDone(fullText);
      } else {
        console.warn("[AI Agent] Gemini stream yielded empty text, falling back to non-streaming...");
        try {
          const fallbackText = await callGeminiAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
      }
    } catch (err) {
      if (activeController === controller) activeController = null;
      if (err.name === "AbortError") return;
      onError(err);
    }
  }

  // ─── OpenRouter API Handlers ────────────────────────────────────────────────

  async function callOpenRouterAI(userMessage, dataContext, chatHistory = []) {
    const apiKey = getOpenRouterKey();
    if (!apiKey) throw new Error("No OpenRouter API key. Please add your key in Settings.");

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    const model = getOpenRouterModel();
    const payload = buildOpenRouterPayload(userMessage, dataContext, chatHistory, model, false);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_REFERER,
          "X-Title": APP_TITLE
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 401) throw new Error("Invalid OpenRouter API key. Get one at openrouter.ai/keys");
        if (response.status === 402) throw new Error("OpenRouter credits exhausted. Add credits at openrouter.ai/credits");
        if (response.status === 429) throw new Error("Rate limited. Please wait a moment and try again.");
        if (response.status === 503) throw new Error("Model temporarily unavailable. Try switching models.");
        throw new Error(`API error (${response.status}): ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("Empty response. Try a different model.");
      return text.trim();
    } finally {
      if (activeController === controller) activeController = null;
    }
  }

  async function streamOpenRouterAI(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const apiKey = getOpenRouterKey();
    if (!apiKey) {
      onError(new Error("No OpenRouter API key. Please add your key in Settings."));
      return;
    }

    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    const model = getOpenRouterModel();
    const payload = buildOpenRouterPayload(userMessage, dataContext, chatHistory, model, true);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_REFERER,
          "X-Title": APP_TITLE
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (activeController === controller) activeController = null;

        if (response.status === 401) { onError(new Error("Invalid OpenRouter API key.")); return; }
        if (response.status === 402) { onError(new Error("OpenRouter credits exhausted.")); return; }
        if (response.status === 429) { onError(new Error("Rate limited. Wait a moment.")); return; }

        console.warn("[AI Agent] OpenRouter stream failed, falling back to non-streaming...");
        try {
          const fallbackText = await callOpenRouterAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed?.choices?.[0]?.delta?.content || "";
            if (chunk) {
              fullText += chunk;
              onChunk(fullText);
            }
          } catch (e) {
            // ignore malformed SSE
          }
        }
      }

      if (activeController === controller) activeController = null;

      if (fullText) {
        onDone(fullText);
      } else {
        console.warn("[AI Agent] OpenRouter stream empty, falling back to non-streaming...");
        try {
          const fallbackText = await callOpenRouterAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
      }
    } catch (err) {
      if (activeController === controller) activeController = null;
      if (err.name === "AbortError") return;
      onError(err);
    }
  }

  // ─── Dual-Provider Dispatchers ──────────────────────────────────────────────

  /**
   * Routes to the active provider, with automatic fallback if the other provider's key exists.
   */
  async function callAI(userMessage, dataContext, chatHistory = []) {
    const provider = getActiveProvider();
    const hasGemini = Boolean(getGeminiKey());
    const hasOpenRouter = Boolean(getOpenRouterKey());

    if (provider === "gemini") {
      if (hasGemini) {
        return callGeminiAI(userMessage, dataContext, chatHistory);
      }
      if (hasOpenRouter) {
        console.warn("[AI Agent] Gemini key missing, falling back to OpenRouter...");
        return callOpenRouterAI(userMessage, dataContext, chatHistory);
      }
      throw new Error("No Google Gemini API key. Please add your key in Settings.");
    } else {
      if (hasOpenRouter) {
        return callOpenRouterAI(userMessage, dataContext, chatHistory);
      }
      if (hasGemini) {
        console.warn("[AI Agent] OpenRouter key missing, falling back to Google Gemini...");
        return callGeminiAI(userMessage, dataContext, chatHistory);
      }
      throw new Error("No OpenRouter API key. Please add your key in Settings.");
    }
  }

  function streamAI(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const provider = getActiveProvider();
    const hasGemini = Boolean(getGeminiKey());
    const hasOpenRouter = Boolean(getOpenRouterKey());

    if (provider === "gemini") {
      if (hasGemini) {
        return streamGeminiAI(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
      }
      if (hasOpenRouter) {
        console.warn("[AI Agent] Gemini key missing, falling back to OpenRouter stream...");
        return streamOpenRouterAI(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
      }
      onError(new Error("No Google Gemini API key. Please add your key in Settings."));
    } else {
      if (hasOpenRouter) {
        return streamOpenRouterAI(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
      }
      if (hasGemini) {
        console.warn("[AI Agent] OpenRouter key missing, falling back to Google Gemini stream...");
        return streamGeminiAI(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
      }
      onError(new Error("No OpenRouter API key. Please add your key in Settings."));
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  async function askAgent(question, state, chatHistory = []) {
    const dataContext = buildDataContext(state);
    return callAI(question, dataContext, chatHistory);
  }

  function streamAgent(question, dataContext, chatHistory, onChunk, onDone, onError) {
    return streamAI(question, dataContext, chatHistory, onChunk, onDone, onError);
  }

  async function generateInsights(state) {
    const dataContext = buildDataContext(state);
    const prompt = `Based on Prafful's current data, generate exactly 3 brief, actionable insights (1-2 sentences each). Focus on:
1. Most urgent financial observation (spending trend, savings rate, MF performance, goal at risk)
2. Most important habit/health observation (streak to protect, exercise gap)
3. Most impactful career/task action item

Format each as: emoji + bold title + brief insight. Be specific with numbers.
Example:
💸 **Spending Alert**: Your dining expenses are ₹8,500 this month — 40% higher than last month.
🔥 **Streak Warning**: Your meditation streak is at 15 days — don't break it today!
🎯 **Goal Update**: At current pace, your Emergency Fund will be complete by March 2027.`;

    return callAI(prompt, dataContext);
  }

  async function generateDailyBriefing(state) {
    const dataContext = buildDataContext(state);
    const prompt = `Generate Prafful's daily briefing for today. Include:
1. 💰 Quick financial snapshot (net worth, this month savings status, MF performance)
2. ✅ Top 3 pending tasks to focus on TODAY
3. 🔥 Habits status — which ones done today, which pending (be STRICT)
4. 🏃 Exercise status — have you worked out? If not, PUSH HARD
5. 🎯 Goal closest to completion and one that needs urgent attention
6. 💪 One motivational push based on actual progress (not generic)
7. 📊 One quick financial tip or action item for today

Keep it concise, actionable, and energizing. Use bullet points.`;

    return callAI(prompt, dataContext);
  }

  function cancelRequest() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  // ─── Expose Module ───────────────────────────────────────────────────────────
  const LifeLedgerAI = {
    askAgent,
    streamAgent,
    generateInsights,
    generateDailyBriefing,
    isAiAvailable,
    isProviderAvailable,
    getProvider,
    setProvider,
    getActiveProvider,
    getGeminiKey,
    setGeminiKey,
    getGeminiModel,
    setGeminiModel,
    getOpenRouterKey,
    setOpenRouterKey,
    getOpenRouterModel,
    setOpenRouterModel,
    getApiKey,
    setApiKey,
    getModel,
    setModel,
    buildGeminiContents,
    buildGeminiPayload,
    buildOpenRouterPayload,
    buildOpenRouterMessages,
    cancelRequest,
    buildDataContext,
  };

  if (typeof window !== "undefined") {
    window.LifeLedgerAI = LifeLedgerAI;
  }
  if (typeof module !== "undefined" && module.exports) {
    module.exports = LifeLedgerAI;
  }
})();
