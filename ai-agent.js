/**
 * Life Ledger AI Agent — Powered by Google Gemini
 * Provides intelligent, data-aware conversation and proactive insights.
 *
 * Architecture:
 *   1. buildDataContext(state) → compact data summary for LLM context
 *   2. askAgent(question, state) → send question + context to Gemini
 *   3. generateInsights(state) → proactive dashboard insights
 *   4. generateDailyBriefing(state) → one-tap daily summary
 */
(function () {
  "use strict";

  const GEMINI_MODEL = "gemini-2.0-flash";
  const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const MAX_HISTORY_MESSAGES = 10; // last N chat messages sent as conversation context

  // ─── API Key Management ──────────────────────────────────────────────────────
  function getApiKey() {
    // Priority: localStorage > config.js
    return localStorage.getItem("lifeLedger_geminiApiKey") || window.LIFE_LEDGER_CONFIG?.GEMINI_API_KEY || "";
  }

  function setApiKey(key) {
    if (key) {
      localStorage.setItem("lifeLedger_geminiApiKey", key.trim());
    } else {
      localStorage.removeItem("lifeLedger_geminiApiKey");
    }
  }

  function isAiAvailable() {
    return Boolean(getApiKey());
  }

  // ─── Data Context Builder ────────────────────────────────────────────────────
  // Serializes the full state into a compact but rich context for the LLM.
  // Keeps it under ~4K tokens by summarizing arrays and showing recent items.

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

    // ── Investment totals ──
    const mfInvested = sumField(state.mutualFunds, "invested");
    const mfByFund = {};
    (state.mutualFunds || []).forEach(t => {
      const key = t.fundName || "Unknown";
      if (!mfByFund[key]) mfByFund[key] = { units: 0, latestNav: toNum(t.latestNav || t.nav) };
      mfByFund[key].units += toNum(t.units);
      if (t.latestNav) mfByFund[key].latestNav = toNum(t.latestNav);
    });
    const mfCurrent = Object.values(mfByFund).reduce((s, f) => s + f.units * f.latestNav, 0);

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

    // ── Workouts ──
    const recentWorkouts = recentItems(state.workouts, 7);
    const todayWorkedOut = (state.workouts || []).some(w => w.date === now.toISOString().split("T")[0]);
    const workoutsText = recentWorkouts.map(w =>
      `  - ${w.date}: ${w.type || "Workout"} — ${w.minutes || 0} min (${w.intensity || "—"})`
    ).join("\n") || "  No workouts logged.";

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

🏃 WORKOUTS (last 7)
  Today: ${todayWorkedOut ? "✅ exercised" : "❌ not yet"}
${workoutsText}

🚀 CAREER — PRAFFUL (SRE/DevOps, 8 years experience)
${studiesText("DevOps", myStudies)}

📊 CAREER — WIFE (ETL/Data Engineering)
${studiesText("ETL", wifeStudies)}

📊 ALL-TIME TOTALS
  Total income entries: ${state.income?.length || 0}, total: ${formatINR(totalIncome)}
  Total expense entries: ${state.expenses?.length || 0}, total: ${formatINR(totalExpenses)}
  Total workouts: ${state.workouts?.length || 0}
`.trim();
  }

  // ─── System Prompt ───────────────────────────────────────────────────────────
  const SYSTEM_PROMPT = `You are "Hey Prafful" — Prafful Chavan's AI personal life coach embedded inside his Life Ledger app. You have COMPLETE access to all his financial, career, health, and life data (provided below).

PERSONALITY & RULES:
• You are direct, motivational, data-driven, and hold Prafful accountable
• You speak like a trusted friend who genuinely wants Prafful to succeed
• Use Indian Rupee (₹) formatting with Indian number system (lakhs, crores)
• Be specific — cite exact numbers from the data, don't be vague
• When asked about goals, calculate projected completion dates based on current savings pace
• When asked about habits, celebrate streaks and call out breaks
• When asked about finances, compare month-over-month and identify trends
• Push Prafful to exercise if he hasn't today
• Push Prafful to maintain habit streaks
• Push Prafful to complete pending tasks
• Prafful is an 8-year experienced SRE/DevOps/MLOps engineer — understand this context
• His wife is learning ETL/Data Engineering
• Keep responses concise but insightful — use bullet points and bold for key numbers
• Use emojis sparingly but effectively
• If you don't have enough data to answer, say so honestly
• NEVER make up data — only use what's provided
• For investment advice, give general principles, add disclaimer you're not a financial advisor

CAPABILITIES:
• Answer any question about Prafful's finances, investments, goals, habits, workouts, career, tasks
• Predict goal completion dates (remaining ÷ monthly savings rate)
• Analyze spending trends (this month vs last month)
• Give motivational pushes based on current data
• Create action plans and daily briefings
• Compare Prafful vs wife's progress
• Identify financial anomalies or concerning patterns`;

  // ─── Gemini API Call ─────────────────────────────────────────────────────────
  let requestInFlight = false;

  async function callGemini(userMessage, dataContext, chatHistory = []) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("No Gemini API key configured.");

    if (requestInFlight) throw new Error("Please wait for the current response.");
    requestInFlight = true;

    try {
      // Build conversation history for context
      const historyContents = chatHistory.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }]
      }));

      const contents = [
        ...historyContents,
        {
          role: "user",
          parts: [{ text: userMessage }]
        }
      ];

      const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_PROMPT + "\n\n" + dataContext }]
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1500,
          },
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          ]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 429) {
          let extraMsg = "";
          try {
            const errObj = JSON.parse(errorBody);
            if (errObj?.error?.message) {
              extraMsg = " Details: " + errObj.error.message;
            }
          } catch (e) {}
          throw new Error("Rate limit reached. Please wait a moment and try again." + extraMsg);
        }
        if (response.status === 400 && errorBody.includes("API_KEY")) throw new Error("Invalid Gemini API key. Check Settings → AI Agent.");
        throw new Error(`Gemini API error (${response.status}): ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini.");
      return text.trim();
    } finally {
      requestInFlight = false;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  /**
   * Ask the AI agent a question with full data context.
   * @param {string} question - The user's question
   * @param {object} state - The full app state
   * @param {Array} chatHistory - Recent chat messages for conversation context
   * @returns {Promise<string>} - AI response text
   */
  async function askAgent(question, state, chatHistory = []) {
    const dataContext = buildDataContext(state);
    return callGemini(question, dataContext, chatHistory);
  }

  /**
   * Generate proactive insights for the dashboard.
   * Returns 2-4 concise insights about current data.
   */
  async function generateInsights(state) {
    const dataContext = buildDataContext(state);
    const prompt = `Based on Prafful's current data, generate exactly 3 brief, actionable insights (1-2 sentences each). Focus on:
1. Most urgent financial observation (spending trend, savings rate, goal at risk)
2. Most important habit/health observation (streak to protect, exercise gap)
3. Most impactful career/task action item

Format each as: emoji + bold title + brief insight. Be specific with numbers.
Example:
💸 **Spending Alert**: Your dining expenses are ₹8,500 this month — 40% higher than last month.
🔥 **Streak Warning**: Your meditation streak is at 15 days — don't break it today!
🎯 **Goal Update**: At current pace, your Emergency Fund will be complete by March 2027.`;

    return callGemini(prompt, dataContext);
  }

  /**
   * Generate a comprehensive daily briefing.
   */
  async function generateDailyBriefing(state) {
    const dataContext = buildDataContext(state);
    const prompt = `Generate Prafful's daily briefing for today. Include:
1. 💰 Quick financial snapshot (net worth, this month savings status)
2. ✅ Top 3 pending tasks to focus on
3. 🔥 Habits status — which ones done today, which pending
4. 🏃 Exercise status for today
5. 🎯 Goal closest to completion and one that needs attention  
6. 💪 One motivational push based on his current progress

Keep it concise, actionable, and energizing. Use bullet points.`;

    return callGemini(prompt, dataContext);
  }

  // ─── Expose module ───────────────────────────────────────────────────────────
  window.LifeLedgerAI = {
    askAgent,
    generateInsights,
    generateDailyBriefing,
    isAiAvailable,
    getApiKey,
    setApiKey,
    buildDataContext, // exposed for debugging
  };
})();
