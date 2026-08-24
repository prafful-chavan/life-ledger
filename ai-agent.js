/**
 * Life Ledger AI Agent — Powered by OpenRouter
 * One API key → GPT-4o, Claude, Gemini, Llama, DeepSeek, and 200+ models.
 *
 * Architecture:
 *   1. buildDataContext(state) → compact data summary for LLM context
 *   2. callAI / streamAI → unified OpenRouter API caller
 *   3. askAgent(question, state) → non-streaming call
 *   4. streamAgent → streaming call (for chat)
 *   5. generateInsights / generateDailyBriefing → proactive features
 */
(function () {
  "use strict";

  const MAX_HISTORY_MESSAGES = 10;
  const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
  const APP_REFERER = "https://prafful-chavan.github.io/life-ledger/";
  const APP_TITLE = "Life Ledger - Hey Prafful";
  const DEFAULT_MODEL = "google/gemini-2.5-flash";

  // ─── API Key & Model Management (Simple — one key, one model) ───────────────
  function getApiKey() {
    return localStorage.getItem("lifeLedger_openrouterKey") || "";
  }

  function setApiKey(key) {
    if (key) localStorage.setItem("lifeLedger_openrouterKey", key.trim());
    else localStorage.removeItem("lifeLedger_openrouterKey");
  }

  function getModel() {
    return localStorage.getItem("lifeLedger_aiModel") || DEFAULT_MODEL;
  }

  function setModel(model) {
    if (model) localStorage.setItem("lifeLedger_aiModel", model.trim());
    else localStorage.removeItem("lifeLedger_aiModel");
  }

  function isAiAvailable() {
    return Boolean(getApiKey());
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

  // ─── OpenRouter API — Clean, Single Implementation ───────────────────────────

  // Active AbortController for cancellation (replaces requestInFlight boolean)
  let activeController = null;

  function buildMessages(userMessage, dataContext, chatHistory) {
    return [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n[CURRENT LIFE DATA CONTEXT]\n=========================================\n${dataContext}\n=========================================`
      },
      ...chatHistory.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
        role: msg.role === "assistant" ? "assistant" : "user",
        content: msg.text
      })),
      { role: "user", content: userMessage }
    ];
  }

  /**
   * Non-streaming call — used for insights, briefings, and test connection.
   */
  async function callAI(userMessage, dataContext, chatHistory = []) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("No OpenRouter API key. Please add your key in Settings.");

    // Cancel any active request
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_REFERER,
          "X-Title": APP_TITLE
        },
        body: JSON.stringify({
          model: getModel(),
          messages: buildMessages(userMessage, dataContext, chatHistory),
          temperature: 0.7,
          max_tokens: 16384
        }),
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

  /**
   * Streaming call — used for chat. Renders tokens as they arrive.
   */
  async function streamAI(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const apiKey = getApiKey();
    if (!apiKey) { onError(new Error("No OpenRouter API key. Please add your key in Settings.")); return; }

    // Cancel any active request (no deadlock!)
    if (activeController) {
      activeController.abort();
      activeController = null;
    }

    const controller = new AbortController();
    activeController = controller;

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": APP_REFERER,
          "X-Title": APP_TITLE
        },
        body: JSON.stringify({
          model: getModel(),
          messages: buildMessages(userMessage, dataContext, chatHistory),
          stream: true,
          temperature: 0.7,
          max_tokens: 16384
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (activeController === controller) activeController = null;

        if (response.status === 401) { onError(new Error("Invalid OpenRouter API key.")); return; }
        if (response.status === 402) { onError(new Error("OpenRouter credits exhausted.")); return; }
        if (response.status === 429) { onError(new Error("Rate limited. Wait a moment.")); return; }

        // Fallback to non-streaming
        console.warn("[AI Agent] Stream failed, falling back to non-streaming...");
        try {
          const fallbackText = await callAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
        return;
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

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
            // skip malformed SSE
          }
        }
      }

      if (activeController === controller) activeController = null;

      if (fullText) {
        onDone(fullText);
      } else {
        // Empty stream — fallback to non-streaming
        console.warn("[AI Agent] Stream empty, falling back to non-streaming...");
        try {
          const fallbackText = await callAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fbErr) {
          onError(fbErr);
        }
      }
    } catch (err) {
      if (activeController === controller) activeController = null;
      if (err.name === "AbortError") return; // silently ignore cancelled requests
      onError(err);
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
  window.LifeLedgerAI = {
    askAgent,
    streamAgent,
    generateInsights,
    generateDailyBriefing,
    isAiAvailable,
    getApiKey,
    setApiKey,
    getModel,
    setModel,
    cancelRequest,
    buildDataContext,
  };
})();
