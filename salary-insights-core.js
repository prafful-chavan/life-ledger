/**
 * Life Ledger — Salary dashboard logic (pure; no DOM, no network).
 *
 * Turns the salary rows into what the Salary dashboard draws: one entry per person per month (two payslips in one month are
 * added together), which months are one-offs (a bonus, a settlement, a part-month), the steady pay level with the one-offs
 * taken out, each job, every job change and in-job raise, financial-year summaries, milestones, the take-home breakdown,
 * the household's combined pay and growth in today's rupees.
 *
 * Nothing here is guessed: a figure that cannot be worked out exactly (no gross on the payslip, too few months) is null and
 * the screen says so.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LifeLedgerSalaryInsights = factory();
})(typeof self !== "undefined" ? self : this, function () {
  /** A month this far above (or below) the person's other months in the same job is a one-off. */
  const SPIKE_UP = 1.25;
  const SPIKE_DOWN = 0.75;
  /** How many months on each side are compared. */
  const WINDOW = 3;
  /** A step of at least this much in the steady level is a raise. */
  const RAISE_MIN = 0.03;
  /** Net take-home figures that count as milestones. */
  const MILESTONES = [25000, 50000, 100000, 150000, 200000];
  /** Default yearly price rise used for "in today's rupees"; the household can change it. */
  const DEFAULT_INFLATION_PCT = 5;

  const median = (list) => {
    if (!list.length) return null;
    const sorted = list.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const ymOf = (date) => String(date || "").slice(0, 7);
  const validYm = (ym) => /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
  const ymIndex = (ym) => Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  const monthsBetween = (a, b) => ymIndex(b) - ymIndex(a);
  const pct = (from, to) => (from ? ((to - from) / from) * 100 : null);

  /** Financial year (April–March) of a month, as "2025-26". */
  function fyOf(ym) {
    const year = Number(ym.slice(0, 4)), month = Number(ym.slice(5, 7));
    const start = month >= 4 ? year : year - 1;
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }

  /**
   * One entry per month for one person, oldest first. rows = that person's salary rows; num(value) → number.
   * Two payslips in one month (a job change) are added together and the month is marked `overlap`.
   * gross is null when any payslip of the month has no gross figure.
   */
  function monthsOf(rows, num) {
    const byMonth = new Map();
    for (const row of rows) {
      const ym = ymOf(row.date);
      if (!validYm(ym)) continue;
      if (!byMonth.has(ym)) byMonth.set(ym, []);
      byMonth.get(ym).push(row);
    }
    return [...byMonth.keys()].sort().map((ym) => {
      const slips = byMonth.get(ym);
      const net = slips.reduce((t, r) => t + num(r.netSalary || r.amount || 0), 0);
      const grossKnown = slips.every((r) => num(r.grossEarnings || 0) > 0);
      const gross = grossKnown ? slips.reduce((t, r) => t + num(r.grossEarnings), 0) : null;
      const tds = slips.reduce((t, r) => t + num(r.taxTds || 0), 0);
      const pf = slips.reduce((t, r) => t + num(r.pf || 0), 0);
      const sources = [];
      let primary = slips[0], primaryNet = -1;
      for (const r of slips) {
        const source = r.source || r.organization || "Salary";
        if (!sources.includes(source)) sources.push(source);
        const n = num(r.netSalary || r.amount || 0);
        if (n > primaryNet) { primary = r; primaryNet = n; }
      }
      return {
        ym, net, gross, tds, pf,
        other: gross === null ? null : Math.max(0, gross - net - tds - pf),
        source: primary.source || primary.organization || "Salary",
        sources, overlap: sources.length > 1,
      };
    });
  }

  /**
   * Marks each month as a one-off or regular. A month is a one-off when:
   *  - two payslips landed in it (a job change), or
   *  - it sits at least 25% above (or 75% below) the median of up to three other months on each side in the same job, and is
   *    higher (lower) than the months right beside it — so a step up to a new pay is never mistaken for a bonus, or
   *  - the household marked it.
   * marks = { "2024-03": "oneoff" | "regular" } for this person; a mark always wins.
   * Adds oneOff (boolean) and why: "overlap" | "high" | "low" | "marked" | "unmarked" | "" .
   */
  function flagOneOffs(months, marks) {
    const mk = marks || {};
    return months.map((m, i) => {
      let oneOff = false, why = "";
      if (m.overlap) { oneOff = true; why = "overlap"; }
      else {
        const sameJob = (j) => j !== i && j >= 0 && j < months.length && !months[j].overlap && months[j].source === m.source;
        const near = [];
        for (let j = Math.max(0, i - WINDOW); j <= Math.min(months.length - 1, i + WINDOW); j++) if (sameJob(j)) near.push(months[j].net);
        const prev = i > 0 && sameJob(i - 1) ? months[i - 1].net : null;
        const next = i < months.length - 1 && sameJob(i + 1) ? months[i + 1].net : null;
        const base = near.length >= 2 ? median(near) : null;
        if (base) {
          const sides = [prev, next].filter((v) => v !== null);
          if (sides.length && m.net >= base * SPIKE_UP && sides.every((v) => m.net > v)) { oneOff = true; why = "high"; }
          else if (sides.length === 2 && m.net <= base * SPIKE_DOWN && sides.every((v) => m.net < v)) { oneOff = true; why = "low"; }
        }
      }
      const mark = mk[m.ym];
      if (mark === "oneoff") { oneOff = true; why = "marked"; }
      else if (mark === "regular") { oneOff = false; why = "unmarked"; }
      return { ...m, oneOff, why };
    });
  }

  /**
   * The steady pay level of every month: the middle of three neighbouring regular months (so a single odd month does not
   * move it); a one-off month carries the level before it. Adds levelNet and levelGross (null when unknown).
   */
  function addLevels(months) {
    const out = months.map((m) => ({ ...m }));
    for (const key of ["net", "gross"]) {
      const levelKey = key === "net" ? "levelNet" : "levelGross";
      const regular = [];
      out.forEach((m, i) => { if (!m.oneOff && m[key] !== null) regular.push(i); });
      const smooth = new Map();
      regular.forEach((idx, p) => {
        const sameJob = (q) => q >= 0 && q < regular.length && out[regular[q]].source === out[idx].source;
        const group = [];
        for (const q of [p - 1, p, p + 1]) if (sameJob(q)) group.push(out[regular[q]][key]);
        smooth.set(idx, group.length === 3 ? median(group) : out[idx][key]);
      });
      let carried = null;
      out.forEach((m, i) => {
        if (smooth.has(i)) carried = smooth.get(i);
        m[levelKey] = carried;
      });
    }
    return out;
  }

  /** The jobs in order: consecutive months with the same main organisation. */
  function jobsOf(months) {
    const jobs = [];
    for (const m of months) {
      const last = jobs[jobs.length - 1];
      if (last && last.source === m.source) { last.to = m.ym; last.months.push(m); }
      else jobs.push({ source: m.source, from: m.ym, to: m.ym, months: [m] });
    }
    return jobs.map((job) => {
      const regular = job.months.filter((m) => !m.oneOff);
      const first3 = regular.slice(0, 3), last3 = regular.slice(-3);
      const pay = (list, key) => (list.length && list.every((m) => m[key] !== null) ? median(list.map((m) => m[key])) : null);
      return {
        source: job.source, from: job.from, to: job.to,
        monthCount: job.months.length, regularCount: regular.length,
        startNet: pay(first3, "net"), endNet: pay(last3, "net"),
        startGross: pay(first3, "gross"), endGross: pay(last3, "gross"),
      };
    });
  }

  /** The step from each job to the next: the steady pay at the end of one against the start of the next. */
  function jobChanges(jobs) {
    const changes = [];
    for (let i = 1; i < jobs.length; i++) {
      const a = jobs[i - 1], b = jobs[i];
      if (a.endNet === null || b.startNet === null) continue;
      changes.push({
        from: a.source, to: b.source, month: b.from,
        grossBefore: a.endGross, grossAfter: b.startGross,
        grossPct: a.endGross !== null && b.startGross !== null ? pct(a.endGross, b.startGross) : null,
        netBefore: a.endNet, netAfter: b.startNet,
        netPct: pct(a.endNet, b.startNet),
      });
    }
    return changes;
  }

  /** Raises inside a job: a step of at least 3% in the steady level. Uses gross when known (it is not shaken by tax), else net. */
  function raisesOf(months) {
    const raises = [];
    for (let i = 1; i < months.length; i++) {
      const prev = months[i - 1], cur = months[i];
      if (prev.source !== cur.source || prev.overlap || cur.overlap) continue;
      const useGross = cur.levelGross !== null && prev.levelGross !== null;
      const before = useGross ? prev.levelGross : prev.levelNet, after = useGross ? cur.levelGross : cur.levelNet;
      if (before && after && after >= before * (1 + RAISE_MIN)) {
        raises.push({ month: cur.ym, source: cur.source, basis: useGross ? "gross" : "net", before, after, pct: pct(before, after) });
      }
    }
    return raises;
  }

  /** Financial-year summaries, oldest first. A year is complete when all twelve months are present. */
  function fySummaries(months) {
    const years = new Map();
    for (const m of months) {
      const fy = fyOf(m.ym);
      if (!years.has(fy)) years.set(fy, []);
      years.get(fy).push(m);
    }
    const list = [...years.entries()].map(([fy, ms]) => {
      const regular = ms.filter((m) => !m.oneOff);
      const sum = (arr, key) => arr.reduce((t, m) => t + (m[key] || 0), 0);
      const grossKnown = ms.every((m) => m.gross !== null);
      const totalGross = grossKnown ? sum(ms, "gross") : null;
      return {
        fy, months: ms.length, complete: ms.length === 12,
        totalNet: sum(ms, "net"), totalGross, totalTds: sum(ms, "tds"), totalPf: sum(ms, "pf"),
        oneOffNet: sum(ms.filter((m) => m.oneOff), "net"), regularNet: sum(regular, "net"), oneOffMonths: ms.filter((m) => m.oneOff).length,
        avgRegularNet: regular.length ? sum(regular, "net") / regular.length : null,
        takeHomePct: totalGross ? (sum(ms, "net") / totalGross) * 100 : null,
      };
    });
    return list.map((y, i) => {
      const prev = list[i - 1];
      return {
        ...y,
        totalPct: prev && prev.complete && y.complete ? pct(prev.totalNet, y.totalNet) : null,
        levelPct: prev && prev.avgRegularNet && y.avgRegularNet ? pct(prev.avgRegularNet, y.avgRegularNet) : null,
      };
    });
  }

  /** The first month the steady take-home reached each milestone. */
  function milestonesOf(months) {
    return MILESTONES.map((amount) => {
      const hit = months.find((m) => !m.oneOff && m.levelNet !== null && m.levelNet >= amount);
      return { amount, month: hit ? hit.ym : null, source: hit ? hit.source : null };
    });
  }

  /** Price rise between two months at a yearly rate: how many rupees then equal one rupee now. */
  const growthFactor = (fromYm, toYm, inflationPct) => Math.pow(1 + inflationPct / 100, monthsBetween(fromYm, toYm) / 12);

  /**
   * Everything for one person. rows = their salary rows, marks = { ym: "oneoff"|"regular" }, asOf = "YYYY-MM" (the latest month
   * in the data when omitted). Returns null when there is no salary.
   */
  function personView(rows, num, o) {
    const opts = o || {};
    const inflationPct = Number.isFinite(opts.inflationPct) ? opts.inflationPct : DEFAULT_INFLATION_PCT;
    const raw = monthsOf(rows, num);
    if (!raw.length) return null;
    const months = addLevels(flagOneOffs(raw, opts.marks)).map((m) => ({ ...m }));
    const asOf = validYm(opts.asOf || "") ? opts.asOf : months[months.length - 1].ym;
    months.forEach((m) => {
      const f = growthFactor(m.ym, asOf, inflationPct);
      m.netToday = m.net * f;
      m.levelNetToday = m.levelNet === null ? null : m.levelNet * f;
    });
    const first = months[0], last = months[months.length - 1];
    const jobs = jobsOf(months);
    const years = Math.max(0, monthsBetween(first.ym, last.ym)) / 12;
    const multiple = first.net && last.levelNet !== null ? last.levelNet / first.net : null;
    const nominalCagr = multiple && years >= 1 ? (Math.pow(multiple, 1 / years) - 1) * 100 : null;
    const realMultiple = multiple ? multiple / growthFactor(first.ym, last.ym, inflationPct) : null;
    const realCagr = realMultiple && years >= 1 ? (Math.pow(realMultiple, 1 / years) - 1) * 100 : null;
    const highest = months.reduce((best, m) => (m.net > best.net ? m : best), months[0]);
    const latestRegular = months.slice().reverse().find((m) => !m.oneOff) || last;
    const yearAgo = months.find((m) => m.ym === shiftYm(last.ym, -12));
    const growth12 = yearAgo && yearAgo.levelNet && last.levelNet !== null
      ? { fromYm: yearAgo.ym, from: yearAgo.levelNet, to: last.levelNet, nominalPct: pct(yearAgo.levelNet, last.levelNet), realPct: pct(yearAgo.levelNet * growthFactor(yearAgo.ym, last.ym, inflationPct), last.levelNet) }
      : null;
    return {
      months, jobs, jobChanges: jobChanges(jobs), raises: raisesOf(months), years: fySummaries(months),
      milestones: milestonesOf(months),
      first, last, latestRegular, highest, inflationPct, asOf, growth12,
      gaps: gapsOf(months),
      growth: { years, multiple, nominalCagr, realMultiple, realCagr, firstNet: first.net, levelNet: last.levelNet },
      oneOffs: months.filter((m) => m.oneOff),
      breakdown: breakdownOf(latestRegular),
    };
  }

  /** Months missing between the first and the last payslip (a gap makes year totals and averages understate pay). */
  function gapsOf(months) {
    const have = new Set(months.map((m) => m.ym));
    const missing = [];
    for (let i = ymIndex(months[0].ym); i <= ymIndex(months[months.length - 1].ym); i++) {
      const ym = `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
      if (!have.has(ym)) missing.push(ym);
    }
    return missing;
  }

  /** Where one month's gross went: tax, PF, other deductions, and what reached the bank. null when the gross is not on the payslip. */
  function breakdownOf(month) {
    if (!month || month.gross === null || !month.gross) return null;
    const parts = [
      { key: "net", label: "In your account", value: month.net },
      { key: "tds", label: "Income tax (TDS)", value: month.tds },
      { key: "pf", label: "Provident fund", value: month.pf },
      { key: "other", label: "Other deductions", value: month.other },
    ];
    return { ym: month.ym, gross: month.gross, parts, takeHomePct: (month.net / month.gross) * 100 };
  }

  /**
   * The household: months joined across people. A month's household pay is every person's actual pay that month; its steady
   * level is the sum of their steady levels. growth12 compares the steady level now with twelve months earlier (nominal and in
   * today's rupees) and is null until the household has twelve months of history.
   * views = { person: personView } (null views skipped).
   */
  function householdView(views, o) {
    const opts = o || {};
    const inflationPct = Number.isFinite(opts.inflationPct) ? opts.inflationPct : DEFAULT_INFLATION_PCT;
    const people = Object.keys(views).filter((p) => views[p]);
    if (!people.length) return null;
    const all = new Set();
    people.forEach((p) => views[p].months.forEach((m) => all.add(m.ym)));
    const yms = [...all].sort();
    const lastYm = yms[yms.length - 1];
    const rows = [];
    const carried = {};
    for (const ym of yms) {
      const row = { ym, net: 0, level: 0, by: {} };
      for (const p of people) {
        const m = views[p].months.find((x) => x.ym === ym);
        if (m) { carried[p] = m.levelNet; row.net += m.net; row.by[p] = m.net; }
        row.level += carried[p] || 0;
      }
      rows.push(row);
    }
    const latest = rows[rows.length - 1];
    const prev = rows.find((r) => r.ym === shiftYm(lastYm, -12));
    const growth12 = prev && prev.level
      ? { nominalPct: pct(prev.level, latest.level), realPct: pct(prev.level * growthFactor(prev.ym, lastYm, inflationPct), latest.level), from: prev.level, to: latest.level }
      : null;
    const shares = people.map((p) => ({ person: p, level: views[p].last.levelNet, sharePct: latest.level ? (views[p].last.levelNet / latest.level) * 100 : 0 }));
    return { people, rows, latest, growth12, shares, inflationPct };
  }

  function shiftYm(ym, delta) {
    const i = ymIndex(ym) + delta;
    return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  }

  /**
   * The whole dashboard in one call. income = every income row; settings = { marks: { person: { ym: mark } }, inflationPct }.
   * Rows whose type is not salary are left out (isSalary(row) decides).
   */
  function analyze(income, num, isSalary, settings) {
    const s = settings || {};
    const inflationPct = Number.isFinite(Number(s.inflationPct)) && s.inflationPct !== "" && s.inflationPct !== null ? Number(s.inflationPct) : DEFAULT_INFLATION_PCT;
    const groups = new Map();
    for (const row of (income || []).filter(isSalary)) {
      const person = row.person || "Me";
      if (!groups.has(person)) groups.set(person, []);
      groups.get(person).push(row);
    }
    const views = {};
    for (const [person, rows] of groups) views[person] = personView(rows, num, { marks: (s.marks || {})[person], inflationPct });
    return { views, household: householdView(views, { inflationPct }), inflationPct };
  }

  return {
    SPIKE_UP, SPIKE_DOWN, WINDOW, RAISE_MIN, MILESTONES, DEFAULT_INFLATION_PCT,
    median, fyOf, shiftYm, monthsOf, flagOneOffs, addLevels, jobsOf, jobChanges, raisesOf, fySummaries, milestonesOf, gapsOf,
    breakdownOf, growthFactor, personView, householdView, analyze,
  };
});
