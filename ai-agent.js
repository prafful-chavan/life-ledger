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

  const MAX_HISTORY_MESSAGES = 10; // last N chat messages sent as conversation context

  // ─── API Key, Provider, and Model Management ────────────────────────────────
  function getGeminiApiKey() {
    return localStorage.getItem("lifeLedger_geminiApiKey") || window.LIFE_LEDGER_CONFIG?.GEMINI_API_KEY || "";
  }

  function setGeminiApiKey(key) {
    if (key) localStorage.setItem("lifeLedger_geminiApiKey", key.trim());
    else localStorage.removeItem("lifeLedger_geminiApiKey");
  }

  function getOpenAiApiKey() {
    return localStorage.getItem("lifeLedger_openaiApiKey") || window.LIFE_LEDGER_CONFIG?.OPENAI_API_KEY || "";
  }

  function setOpenAiApiKey(key) {
    if (key) localStorage.setItem("lifeLedger_openaiApiKey", key.trim());
    else localStorage.removeItem("lifeLedger_openaiApiKey");
  }

  function getProvider() {
    return localStorage.getItem("lifeLedger_aiProvider") || "gemini";
  }

  function setProvider(provider) {
    if (provider) localStorage.setItem("lifeLedger_aiProvider", provider);
    else localStorage.removeItem("lifeLedger_aiProvider");
  }

  function getModel() {
    const provider = getProvider();
    const savedModel = localStorage.getItem("lifeLedger_geminiModel");

    if (provider === "openai") {
      if (savedModel && (savedModel.startsWith("gpt-") || savedModel.startsWith("o3-") || savedModel.startsWith("o1-"))) {
        return savedModel;
      }
      return "gpt-4o-mini";
    } else {
      if (savedModel && savedModel.startsWith("gemini-")) {
        return savedModel;
      }
      return "gemini-2.5-flash";
    }
  }

  function setModel(model) {
    if (model) {
      const trimmed = model.trim();
      localStorage.setItem("lifeLedger_geminiModel", trimmed);
      if (trimmed.startsWith("gpt-") || trimmed.startsWith("o3-") || trimmed.startsWith("o1-")) {
        setProvider("openai");
      } else if (trimmed.startsWith("gemini-")) {
        setProvider("gemini");
      }
    } else {
      localStorage.removeItem("lifeLedger_geminiModel");
    }
  }

  function getApiKey(provider = null) {
    const p = provider || getProvider();
    if (p === "openai") return getOpenAiApiKey();
    return getGeminiApiKey();
  }

  function setApiKey(key, provider = null) {
    const p = provider || getProvider();
    if (p === "openai") setOpenAiApiKey(key);
    else setGeminiApiKey(key);
  }

  function isAiAvailable() {
    const provider = getProvider();
    return Boolean(getApiKey(provider));
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

    // ── Investment totals (FIFO Method - SEBI/Groww compliant) ──
    let mfInvested = 0;
    let mfCurrent = 0;
    const mfByFundGroup = {};
    (state.mutualFunds || []).forEach(t => {
      const key = t.fundName || "Unknown";
      if (!mfByFundGroup[key]) mfByFundGroup[key] = [];
      mfByFundGroup[key].push(t);
    });

    Object.entries(mfByFundGroup).forEach(([, txns]) => {
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

      lots.forEach(l => {
        if (l.remUnits > 0) {
          mfInvested += (l.remUnits / l.units) * l.invested;
          mfCurrent += l.remUnits * latestNav;
        }
      });
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
• Match response depth to the question — short for simple queries, VERY detailed and thorough for analysis/strategy questions
• For analysis questions (portfolio review, 5-year projections, what's missing, etc.) provide COMPLETE, structured deep-dives — do NOT cut short
• For simple questions (what's my balance, today's habits) keep it brief and punchy
• Use proper markdown: **bold** for numbers, ## for section headers, - for bullets, > for callouts
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

  // ─── Gemini API Helpers ───────────────────────────────────────────────────────
  let requestInFlight = false;

  function buildRequestBody(formattedUserMessage, historyContents) {
    return {
      contents: [
        ...historyContents,
        { role: "user", parts: [{ text: formattedUserMessage }] }
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 8192,  // ← was 1500, now 8192 for full analysis
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ]
    };
  }

  function buildFormattedMessage(userMessage, dataContext) {
    return `You are "Hey Prafful" — Prafful Chavan's AI personal life coach.

[SYSTEM INSTRUCTION & PERSONALITY RULES]
${SYSTEM_PROMPT}

[CURRENT LIFE DATA CONTEXT]
=========================================
${dataContext}
=========================================

User Question: ${userMessage}`;
  }

  function buildHistory(chatHistory) {
    return chatHistory.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.text }]
    }));
  }

  async function handleFallback(model, status, userMessage, dataContext, chatHistory) {
    const FALLBACK_CHAIN = {
      "gemini-2.5-pro":   "gemini-2.5-flash",
      "gemini-3.5-flash": "gemini-2.5-flash",
      "gemini-2.0-flash": "gemini-2.5-flash",
      "gemini-1.5-pro":   "gemini-1.5-flash",
    };
    const nextModel = FALLBACK_CHAIN[model] || "gemini-2.5-flash";
    if (nextModel === model) return null; // Avoid infinite loop on same model
    console.warn(`[AI Agent] ${model} failed (${status}). Falling back to ${nextModel}`);
    localStorage.setItem("lifeLedger_geminiModel", nextModel);
    const dropdown = document.getElementById("settingsGeminiModel");
    if (dropdown) dropdown.value = nextModel;
    return nextModel;
  }

  // ─── Non-streaming call (for insights/briefing) ───────────────────────────────
  async function callGemini(userMessage, dataContext, chatHistory = [], modelOverride = null) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("No Gemini API key configured.");

    const model = modelOverride || getModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    if (requestInFlight && !modelOverride) throw new Error("Please wait for the current response.");
    if (!modelOverride) requestInFlight = true;

    try {
      const body = JSON.stringify(buildRequestBody(
        buildFormattedMessage(userMessage, dataContext),
        buildHistory(chatHistory)
      ));

      let response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if ([400, 403, 404, 429, 503].includes(response.status)) {
          const nextModel = await handleFallback(model, response.status, userMessage, dataContext, chatHistory);
          if (nextModel) {
            requestInFlight = false;
            return callGemini(userMessage, dataContext, chatHistory, nextModel);
          }
        }
        if (response.status === 429) throw new Error("Rate limit reached. Please wait a moment.");
        if (response.status === 503) throw new Error("Gemini overloaded. Try again in a moment.");
        if (response.status === 400 && errorBody.includes("API_KEY")) throw new Error("Invalid Gemini API key.");
        throw new Error(`Gemini API error (${response.status}): ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from Gemini.");
      return text.trim();
    } finally {
      if (!modelOverride) requestInFlight = false;
    }
  }

  // ─── Streaming call (for chat — renders tokens as they arrive) ────────────────
  async function streamGemini(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const apiKey = getApiKey();
    if (!apiKey) { onError(new Error("No Gemini API key configured.")); return; }

    const model = getModel();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    if (requestInFlight) { onError(new Error("Please wait for the current response.")); return; }
    requestInFlight = true;

    try {
      const body = JSON.stringify(buildRequestBody(
        buildFormattedMessage(userMessage, dataContext),
        buildHistory(chatHistory)
      ));

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        requestInFlight = false;
        if (response.status === 429) { onError(new Error("Rate limit reached. Please wait a moment.")); return; }
        if (response.status === 503) { onError(new Error("Gemini overloaded. Try again in a moment.")); return; }
        if (response.status === 400 && errorBody.includes("API_KEY")) { onError(new Error("Invalid Gemini API key.")); return; }
        // Fallback to non-streaming if streaming endpoint fails
        console.warn("[AI Agent] Streaming failed, falling back to non-streaming...");
        try {
          const fallbackText = await callGemini(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fallbackErr) {
          onError(fallbackErr);
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
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (chunk) {
              fullText += chunk;
              onChunk(fullText); // pass accumulated text so far
            }
          } catch (e) {
            // skip malformed SSE lines
          }
        }
      }

      requestInFlight = false;
      if (fullText) {
        onDone(fullText);
      } else {
        onError(new Error("Empty response from Gemini."));
      }
    } catch (err) {
      requestInFlight = false;
      onError(err);
    }
  }

  // ─── OpenAI API Helpers ───────────────────────────────────────────────────────
  async function callOpenAI(userMessage, dataContext, chatHistory = [], modelOverride = null) {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) throw new Error("No OpenAI API key configured. Please enter your key in Settings.");

    const model = modelOverride || getModel();
    if (requestInFlight && !modelOverride) throw new Error("Please wait for the current response.");
    if (!modelOverride) requestInFlight = true;

    try {
      const isReasoning = model.startsWith("o1") || model.startsWith("o3");
      const systemContent = `You are "Hey Prafful" — Prafful Chavan's AI personal life coach.

[SYSTEM INSTRUCTION & PERSONALITY RULES]
${SYSTEM_PROMPT}

[CURRENT LIFE DATA CONTEXT]
=========================================
${dataContext}
=========================================`;

      const messages = [
        { role: "system", content: systemContent },
        ...chatHistory.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.text
        })),
        { role: "user", content: userMessage }
      ];

      const bodyObj = {
        model,
        messages,
        ...(isReasoning ? { max_completion_tokens: 4096 } : { temperature: 0.7, max_tokens: 4096 })
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyObj),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 401) throw new Error("Invalid OpenAI API key. Please check your key in Settings.");
        if (response.status === 429) throw new Error("OpenAI rate limit or quota exceeded.");
        throw new Error(`OpenAI API error (${response.status}): ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error("Empty response from OpenAI.");
      return text.trim();
    } finally {
      if (!modelOverride) requestInFlight = false;
    }
  }

  async function streamOpenAI(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    const apiKey = getOpenAiApiKey();
    if (!apiKey) { onError(new Error("No OpenAI API key configured. Please enter your key in Settings.")); return; }

    const model = getModel();
    if (requestInFlight) { onError(new Error("Please wait for the current response.")); return; }
    requestInFlight = true;

    try {
      const isReasoning = model.startsWith("o1") || model.startsWith("o3");
      const systemContent = `You are "Hey Prafful" — Prafful Chavan's AI personal life coach.

[SYSTEM INSTRUCTION & PERSONALITY RULES]
${SYSTEM_PROMPT}

[CURRENT LIFE DATA CONTEXT]
=========================================
${dataContext}
=========================================`;

      const messages = [
        { role: "system", content: systemContent },
        ...chatHistory.slice(-MAX_HISTORY_MESSAGES).map(msg => ({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.text
        })),
        { role: "user", content: userMessage }
      ];

      const bodyObj = {
        model,
        messages,
        stream: true,
        ...(isReasoning ? { max_completion_tokens: 4096 } : { temperature: 0.7, max_tokens: 4096 })
      };

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(bodyObj),
        signal: AbortSignal.timeout(20000)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        requestInFlight = false;
        if (response.status === 401) { onError(new Error("Invalid OpenAI API key.")); return; }
        if (response.status === 429) { onError(new Error("OpenAI rate limit or quota exceeded.")); return; }
        console.warn("[AI Agent] OpenAI streaming failed, falling back to non-streaming...");
        try {
          const fallbackText = await callOpenAI(userMessage, dataContext, chatHistory);
          onChunk(fallbackText);
          onDone(fallbackText);
        } catch (fallbackErr) {
          onError(fallbackErr);
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
          if (!trimmed.startsWith("data: ")) continue;
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
            // skip chunk
          }
        }
      }

      requestInFlight = false;
      if (fullText) {
        onDone(fullText);
      } else {
        onError(new Error("Empty response from OpenAI."));
      }
    } catch (err) {
      requestInFlight = false;
      onError(err);
    }
  }

  function resetRequestInFlight() {
    requestInFlight = false;
  }

  // ─── Unified AI Router ───────────────────────────────────────────────────────
  async function callAi(userMessage, dataContext, chatHistory = [], modelOverride = null) {
    const provider = getProvider();
    if (provider === "openai") {
      return callOpenAI(userMessage, dataContext, chatHistory, modelOverride);
    }
    return callGemini(userMessage, dataContext, chatHistory, modelOverride);
  }

  async function streamAi(userMessage, dataContext, chatHistory = [], onChunk, onDone, onError) {
    try {
      const provider = getProvider();
      if (provider === "openai") {
        return await streamOpenAI(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
      }
      return await streamGemini(userMessage, dataContext, chatHistory, onChunk, onDone, onError);
    } catch (err) {
      requestInFlight = false;
      onError(err);
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
    return callAi(question, dataContext, chatHistory);
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

    return callAi(prompt, dataContext);
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

    return callAi(prompt, dataContext);
  }

  // ─── Expose module ───────────────────────────────────────────────────────────
  window.LifeLedgerAI = {
    askAgent,
    streamAgent: streamAi,  // streaming for chat
    generateInsights,
    generateDailyBriefing,
    isAiAvailable,
    getApiKey,
    setApiKey,
    getGeminiApiKey,
    setGeminiApiKey,
    getOpenAiApiKey,
    setOpenAiApiKey,
    getProvider,
    setProvider,
    getModel,
    setModel,
    resetRequestInFlight,
    buildDataContext, // exposed for debugging
  };
})();
