/**
 * Life Ledger — knowledge layer for the Hey Prafful agent (pure).
 *
 * Every list the app keeps in its state (expenses, workouts, habits, goals, holdings, …) is discovered
 * automatically: schema, date range, categories, and a query engine (filter / group / aggregate).
 * Nothing needs wiring per feature — build a new section that stores an array in the state and the
 * agent can already answer questions about it. For richer, hand-written summaries, register a module.
 *
 * All maths happens here, in code; the model only reads results.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerKnowledge = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const MAX_ROWS = 100;
  const MAX_GROUPS = 200;
  const MAX_CHARS = 24000;
  const DATE_FIELDS = ["date", "purchaseDate", "at", "timestamp", "createdAt", "startDate", "dueDate", "day"];
  const HIDDEN_KEYS = new Set(["spendingImport"]);           // internal bookkeeping, not knowledge
  const DESCRIPTIONS = {
    expenses: "Every expense (Spending-app imports and manual): date, category, paidBy (Me/Wife/Both), amount, note.",
    income: "Salary and other income entries per person and month.",
    liabilities: "Loans and dues with outstanding value, EMI, rate and EMI payment history.",
    mutualFunds: "Mutual-fund transactions (purchases and redemptions) with units, NAV and invested amount.",
    stocks: "Indian stock transactions and holdings by broker.",
    usstocks: "US stock transactions and holdings.",
    gold: "Physical / SGB gold holdings.",
    workouts: "Workout log entries.",
    activities: "Daily activity log: steps, runs, rides, workouts, calories.",
    habits: "Habits with streaks and completion history.",
    tasks: "To-do items with dates and status.",
    goals: "Financial and personal goals with targets, saved amount and due dates.",
    studies: "Learning topics with hours, confidence and status per person.",
    interviewTrackerEntries: "Interview pipeline: company, role, rounds, outcome, dates.",
    netWorthHistory: "Daily net worth records with per-asset-class values.",
    bodyMetrics: "Weight and body measurements over time.",
    chat: "Past conversations with Hey Prafful.",
  };

  const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
  const isoDate = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);

  // ── schema discovery ──────────────────────────────────────────────────────
  function typeOf(v) {
    if (v == null) return "null";
    if (Array.isArray(v)) return "array";
    if (typeof v === "number") return "number";
    if (typeof v === "boolean") return "boolean";
    if (typeof v === "string") return isoDate(v) && v.length <= 30 ? "date" : "string";
    return "object";
  }

  function collectionNames(state) {
    return Object.keys(state || {}).filter((k) => !HIDDEN_KEYS.has(k) && Array.isArray(state[k]) && state[k].some(isObj));
  }

  function objectNames(state) {
    return Object.keys(state || {}).filter((k) => !HIDDEN_KEYS.has(k) && isObj(state[k]));
  }

  function inferSchema(name, rows) {
    const fields = {};
    for (const r of rows) {
      if (!isObj(r)) continue;
      for (const [k, v] of Object.entries(r)) {
        const f = (fields[k] = fields[k] || { name: k, types: {}, distinct: new Set(), nonNull: 0 });
        const t = typeOf(v);
        f.types[t] = (f.types[t] || 0) + 1;
        if (t !== "null") f.nonNull++;
        if ((t === "string" || t === "number") && f.distinct.size <= 40) f.distinct.add(v);
      }
    }
    const out = Object.values(fields).map((f) => {
      const main = Object.entries(f.types).filter(([t]) => t !== "null").sort((a, b) => b[1] - a[1])[0];
      const type = main ? main[0] : "null";
      const rec = { name: f.name, type, filled: f.nonNull };
      if (type === "string" && f.distinct.size <= 25) rec.values = [...f.distinct].slice(0, 25);
      return rec;
    });
    const dateField = DATE_FIELDS.find((d) => out.some((f) => f.name === d && f.type === "date"));
    let range = null;
    if (dateField) {
      const ds = rows.map((r) => isoDate(r[dateField])).filter(Boolean).sort();
      if (ds.length) range = { from: ds[0], to: ds[ds.length - 1] };
    }
    return { name, rows: rows.length, dateField: dateField || null, range, description: DESCRIPTIONS[name] || "", fields: out };
  }

  const modules = new Map();
  function registerModule(m) {
    if (!m || !m.id || typeof m.build !== "function") throw new Error("A module needs an id and a build(state, args) function.");
    modules.set(m.id, { id: m.id, title: m.title || m.id, description: m.description || "", build: m.build });
  }
  function unregisterModule(id) { modules.delete(id); }

  function catalog(state) {
    return {
      collections: collectionNames(state).map((n) => inferSchema(n, state[n])),
      objects: objectNames(state).map((n) => ({ name: n, keys: Object.keys(state[n]).slice(0, 20) })),
      modules: [...modules.values()].map((m) => ({ id: m.id, title: m.title, description: m.description })),
    };
  }

  /** One-paragraph-per-source overview that fits in the system context. */
  function catalogText(state) {
    const c = catalog(state);
    const L = ["=== DATA SOURCES YOU CAN QUERY (use the tools; do not guess) ==="];
    c.collections.forEach((s) => {
      const cats = s.fields.filter((f) => f.values && f.values.length).slice(0, 4).map((f) => `${f.name}∈{${f.values.slice(0, 10).join(", ")}${f.values.length > 10 ? ", …" : ""}}`);
      L.push(`- ${s.name}: ${s.rows} rows${s.range ? `, ${s.dateField} from ${s.range.from} to ${s.range.to}` : ""}. ${s.description} Fields: ${s.fields.map((f) => `${f.name}(${f.type})`).join(", ")}.${cats.length ? " " + cats.join("; ") + "." : ""}`);
    });
    if (c.objects.length) L.push(`- single objects (use get_object): ${c.objects.map((o) => o.name).join(", ")}`);
    if (c.modules.length) L.push(`- special modules (use get_module): ${c.modules.map((m) => `${m.id} — ${m.description || m.title}`).join(" | ")}`);
    return L.join("\n");
  }

  // ── query engine ──────────────────────────────────────────────────────────
  const OPS = {
    "=": (a, b) => a === b, eq: (a, b) => a === b, "==": (a, b) => a === b,
    "!=": (a, b) => a !== b, ne: (a, b) => a !== b,
    ">": (a, b) => a > b, gt: (a, b) => a > b, ">=": (a, b) => a >= b, gte: (a, b) => a >= b,
    "<": (a, b) => a < b, lt: (a, b) => a < b, "<=": (a, b) => a <= b, lte: (a, b) => a <= b,
  };

  function coerce(rowVal, filterVal) {
    if (typeof rowVal === "number") return num(filterVal);
    return filterVal;
  }

  function passes(row, f) {
    const op = String(f.op || "=").toLowerCase();
    const raw = row[f.field];
    if (op === "contains") return raw != null && String(raw).toLowerCase().includes(String(f.value).toLowerCase());
    if (op === "in") return Array.isArray(f.value) && f.value.some((v) => String(v).toLowerCase() === String(raw).toLowerCase());
    if (op === "between") return Array.isArray(f.value) && f.value.length === 2 && raw >= coerce(raw, f.value[0]) && raw <= coerce(raw, f.value[1]);
    const fn = OPS[op];
    if (!fn) throw new Error(`Unknown filter operator "${f.op}".`);
    const a = typeof raw === "string" && typeof f.value === "string" ? raw.toLowerCase() : raw;
    const b = typeof raw === "string" && typeof f.value === "string" ? f.value.toLowerCase() : coerce(raw, f.value);
    if (a == null) return op === "!=" || op === "ne" ? b != null : false;
    return fn(a, b);
  }

  function bucket(row, unit, dateField) {
    const d = isoDate(row[dateField]);
    if (!d) return null;
    if (unit === "year") return d.slice(0, 4);
    if (unit === "month") return d.slice(0, 7);
    if (unit === "day") return d;
    if (unit === "quarter") return `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`;
    if (unit === "week") {
      const t = new Date(d + "T00:00:00Z");
      t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // Monday
      return t.toISOString().slice(0, 10);
    }
    return null;
  }

  const UNITS = new Set(["year", "quarter", "month", "week", "day"]);
  const round2 = (v) => Math.round(v * 100) / 100;

  function queryRows(rows, schema, args) {
    const dateField = args.date_field || schema.dateField;
    let list = rows.filter(isObj);
    if (args.date_from || args.date_to) {
      if (!dateField) throw new Error("This source has no date field to filter on.");
      list = list.filter((r) => { const d = isoDate(r[dateField]); return d && (!args.date_from || d >= args.date_from) && (!args.date_to || d <= args.date_to); });
    }
    for (const f of args.filters || []) {
      if (!f || !f.field) continue;
      list = list.filter((r) => passes(r, f));
    }
    const matched = list.length;
    const groupBy = Array.isArray(args.group_by) ? args.group_by : args.group_by ? [args.group_by] : [];
    const metrics = (args.metrics && args.metrics.length ? args.metrics : null);

    if (!groupBy.length && !metrics) {
      const fields = args.fields && args.fields.length ? args.fields : null;
      const sorted = dateField ? list.slice().sort((a, b) => String(b[dateField] || "").localeCompare(String(a[dateField] || ""))) : list;
      const limit = Math.min(MAX_ROWS, Math.max(1, Number(args.limit) || 25));
      const out = sorted.slice(0, limit).map((r) => {
        const o = {};
        for (const [k, v] of Object.entries(fields ? Object.fromEntries(fields.map((f) => [f, r[f]])) : r)) {
          if (v == null || typeof v === "object") { if (fields) o[k] = typeof v === "object" ? JSON.stringify(v).slice(0, 120) : v; continue; }
          o[k] = typeof v === "string" && v.length > 200 ? v.slice(0, 200) + "…" : v;
        }
        return o;
      });
      return { matched, returned: out.length, rows: out, truncated: matched > out.length };
    }

    // aggregate
    const defs = (metrics || [{ op: "count" }]).map((m) => ({ op: String(m.op || "count").toLowerCase(), field: m.field }));
    const groups = new Map();
    for (const r of list) {
      const keyParts = groupBy.map((g) => (UNITS.has(g) ? bucket(r, g, dateField) : r[g] == null ? "(none)" : r[g]));
      if (keyParts.some((k) => k == null)) continue;
      const key = JSON.stringify(keyParts);
      let g = groups.get(key);
      if (!g) { g = { keyParts, n: 0, acc: defs.map(() => ({ sum: 0, n: 0, min: Infinity, max: -Infinity, set: new Set() })) }; groups.set(key, g); }
      g.n++;
      defs.forEach((d, i) => {
        const a = g.acc[i];
        if (d.op === "count") return;
        const v = r[d.field];
        if (d.op === "distinct") { if (v != null) a.set.add(v); return; }
        const x = Number(v);
        if (!Number.isFinite(x)) return;
        a.sum += x; a.n++; a.min = Math.min(a.min, x); a.max = Math.max(a.max, x);
      });
    }
    const label = (d) => (d.op === "count" ? "count" : `${d.op}_${d.field}`);
    let out = [...groups.values()].map((g) => {
      const row = {};
      groupBy.forEach((name, i) => { row[name] = g.keyParts[i]; });
      defs.forEach((d, i) => {
        const a = g.acc[i];
        row[label(d)] = d.op === "count" ? g.n : d.op === "sum" ? round2(a.sum) : d.op === "avg" ? (a.n ? round2(a.sum / a.n) : null)
          : d.op === "min" ? (a.n ? a.min : null) : d.op === "max" ? (a.n ? a.max : null) : d.op === "distinct" ? a.set.size : null;
      });
      return row;
    });
    const isTime = groupBy.length && UNITS.has(groupBy[0]);
    const orderBy = args.order_by || (isTime ? groupBy[0] : "-" + label(defs[0]));
    const desc = orderBy.startsWith("-");
    const col = orderBy.replace(/^-/, "");
    out.sort((a, b) => {
      const x = a[col], y = b[col];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return desc ? -c : c;
    });
    const limit = Math.min(MAX_GROUPS, Math.max(1, Number(args.limit) || 60));
    return { matched, groups: out.length, returned: Math.min(out.length, limit), rows: out.slice(0, limit), truncated: out.length > limit };
  }

  function queryData(state, args) {
    const name = args && args.source;
    if (!name || !Array.isArray(state[name])) {
      const known = collectionNames(state).join(", ");
      throw new Error(`Unknown source "${name}". Available: ${known}.`);
    }
    const schema = inferSchema(name, state[name]);
    return { source: name, ...queryRows(state[name], schema, args) };
  }

  // ── safe calculator (so the model never does arithmetic itself) ───────────
  const FUNCS = {
    sqrt: Math.sqrt, pow: Math.pow, ln: Math.log, log10: Math.log10, exp: Math.exp, abs: Math.abs,
    min: Math.min, max: Math.max, round: Math.round, floor: Math.floor, ceil: Math.ceil,
    // finance helpers (rate is per period as a decimal)
    fv: (rate, nper, pmt, pv = 0) => (rate === 0 ? -(pv + pmt * nper) : -(pv * Math.pow(1 + rate, nper) + pmt * ((Math.pow(1 + rate, nper) - 1) / rate))),
    pmt: (rate, nper, pv) => (rate === 0 ? pv / nper : (pv * rate) / (1 - Math.pow(1 + rate, -nper))),
    cagr: (start, end, years) => (Math.pow(end / start, 1 / years) - 1),
  };
  const CONSTS = { pi: Math.PI, e: Math.E };

  function calculate(expression) {
    let src = String(expression || "").replace(/₹/g, "");
    // Commas are thousands separators (₹1,00,000) unless the expression calls a function, where they separate arguments.
    if (!/[A-Za-z_]\s*\(/.test(src)) src = src.replace(/,/g, "");
    if (!src.trim() || src.length > 300) throw new Error("Give a short arithmetic expression.");
    const tokens = src.match(/\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_][A-Za-z0-9_]*|[-+*/^%(),]/gi);
    if (!tokens || tokens.join("").length < src.replace(/\s+/g, "").length) throw new Error("Unsupported characters in the expression.");
    let pos = 0;
    const peek = () => tokens[pos];
    const next = () => tokens[pos++];
    function parseExpr() { let v = parseTerm(); while (peek() === "+" || peek() === "-") { const op = next(); const r = parseTerm(); v = op === "+" ? v + r : v - r; } return v; }
    function parseTerm() { let v = parsePow(); while (peek() === "*" || peek() === "/" || peek() === "%") { const op = next(); const r = parsePow(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; } return v; }
    function parsePow() { const b = parseUnary(); if (peek() === "^") { next(); return Math.pow(b, parsePow()); } return b; }
    function parseUnary() { if (peek() === "-") { next(); return -parseUnary(); } if (peek() === "+") { next(); return parseUnary(); } return parsePrimary(); }
    function parsePrimary() {
      const t = next();
      if (t == null) throw new Error("Unexpected end of expression.");
      if (t === "(") { const v = parseExpr(); if (next() !== ")") throw new Error("Missing )."); return v; }
      if (/^[\d.]/.test(t)) return Number(t);
      const key = t.toLowerCase();
      if (peek() === "(") {
        const fn = FUNCS[key];
        if (!fn) throw new Error(`Unknown function ${t}.`);
        next();
        const args = [];
        if (peek() !== ")") { args.push(parseExpr()); while (peek() === ",") { next(); args.push(parseExpr()); } }
        if (next() !== ")") throw new Error("Missing ).");
        return fn(...args);
      }
      if (key in CONSTS) return CONSTS[key];
      throw new Error(`Unknown name ${t}.`);
    }
    const v = parseExpr();
    if (pos < tokens.length) throw new Error("Could not parse the whole expression.");
    if (!Number.isFinite(v)) throw new Error("The result is not a finite number.");
    return Math.round(v * 1e6) / 1e6;
  }

  // ── tools exposed to the model ────────────────────────────────────────────
  const TOOL_SPECS = [
    { name: "list_sources", description: "List every data source in the app with row counts, date ranges, fields and category values, plus special modules. Call this first if unsure what exists.", parameters: { type: "object", properties: {} } },
    { name: "query_data", description: "Query any list in the app (expenses, income, workouts, activities, habits, tasks, goals, studies, interviewTrackerEntries, netWorthHistory, mutualFunds, stocks, liabilities, bodyMetrics, …). Filter, group (by field or year/quarter/month/week/day) and aggregate (count/sum/avg/min/max/distinct). All maths is done exactly in code across the FULL history.", parameters: { type: "object", properties: {
      source: { type: "string", description: "Collection name from list_sources." },
      date_from: { type: "string", description: "YYYY-MM-DD, inclusive." }, date_to: { type: "string", description: "YYYY-MM-DD, inclusive." },
      date_field: { type: "string", description: "Override the date field to filter/group on." },
      filters: { type: "array", description: "Row filters, all must match.", items: { type: "object", properties: { field: { type: "string" }, op: { type: "string", description: "=, !=, >, >=, <, <=, contains, in, between" }, value: { type: "string", description: "Value (for in/between pass a JSON array as text)." } }, required: ["field", "op", "value"] } },
      group_by: { type: "array", items: { type: "string" }, description: "Field names or year/quarter/month/week/day (uses the date field)." },
      metrics: { type: "array", items: { type: "object", properties: { op: { type: "string", description: "count, sum, avg, min, max, distinct" }, field: { type: "string" } }, required: ["op"] } },
      order_by: { type: "string", description: "Output column, prefix '-' for descending, e.g. -sum_amount." },
      fields: { type: "array", items: { type: "string" }, description: "For raw rows: which fields to return." },
      limit: { type: "integer", description: "Max rows/groups (default 25 rows / 60 groups; hard caps apply)." } }, required: ["source"] } },
    { name: "get_module", description: "Get a rich pre-computed briefing from a special module (e.g. portfolio analysis with signals, cash-flow history). See list_sources for ids.", parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
    { name: "get_object", description: "Read a single stored object such as goal targets, fitness goals, gold price or interview prep.", parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
    { name: "calculate", description: "Evaluate exact arithmetic. Supports + - * / ^ %, parentheses, sqrt, pow, ln, exp, min, max, round and finance helpers fv(rate,nper,pmt,pv), pmt(rate,nper,pv), cagr(start,end,years) with per-period decimal rates. Use this for every what-if instead of mental maths.", parameters: { type: "object", properties: { expression: { type: "string" } }, required: ["expression"] } },
  ];

  function parseMaybeJson(v) {
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (t.startsWith("[") || t.startsWith("{")) { try { return JSON.parse(t); } catch { return v; } }
    return v;
  }

  function normalizeArgs(args) {
    const a = { ...(args || {}) };
    if (Array.isArray(a.filters)) a.filters = a.filters.map((f) => ({ ...f, value: parseMaybeJson(f.value) }));
    return a;
  }

  function clip(result) {
    let s = JSON.stringify(result);
    if (s.length <= MAX_CHARS) return result;
    // shrink rows until it fits, and say so
    const r = { ...result };
    if (Array.isArray(r.rows)) {
      while (r.rows.length > 1 && JSON.stringify(r).length > MAX_CHARS) r.rows = r.rows.slice(0, Math.ceil(r.rows.length * 0.7));
      r.returned = r.rows.length; r.truncated = true; r.note = "Result was too large; narrow the filters or group the data.";
    }
    s = JSON.stringify(r);
    return s.length <= MAX_CHARS ? r : { ok: false, error: "Result too large — narrow the query." };
  }

  function runTool(name, args, state) {
    try {
      const a = normalizeArgs(args);
      switch (name) {
        case "list_sources": return clip({ ok: true, ...catalog(state) });
        case "query_data": return clip({ ok: true, ...queryData(state, a) });
        case "get_module": {
          const m = modules.get(a.id);
          if (!m) return { ok: false, error: `Unknown module "${a.id}". Available: ${[...modules.keys()].join(", ") || "none"}.` };
          const text = String(m.build(state, a.args || {}) || "");
          return { ok: true, id: m.id, text: text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n…(truncated)" : text };
        }
        case "get_object": {
          if (!isObj(state[a.name]) || HIDDEN_KEYS.has(a.name)) return { ok: false, error: `Unknown object "${a.name}". Available: ${objectNames(state).join(", ")}.` };
          return clip({ ok: true, name: a.name, value: state[a.name] });
        }
        case "calculate": return { ok: true, expression: a.expression, result: calculate(a.expression) };
        default: return { ok: false, error: `Unknown tool "${name}".` };
      }
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  return { catalog, catalogText, inferSchema, queryData, queryRows, calculate, runTool, registerModule, unregisterModule, TOOL_SPECS, collectionNames, objectNames };
});
