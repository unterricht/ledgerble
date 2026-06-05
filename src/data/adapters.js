'use strict';

const moment = require('moment');
const { T } = require('../ui/tokens');

// Produce a readable label from an interval key.
// Monthly 'YYYY-MM' → 'Jan'; other formats fall back to the raw key.
// NOTE: this period-agnostic fallback cannot distinguish Weekly 'YYYY-WW' from
// Monthly 'YYYY-MM' (both \d{4}-\d{2}); use buildLabels(intervals, period) when a
// period is known so weeks/years render correctly. Kept for callers without a period.
function labelFor(key) {
  if (/^\d{4}-\d{2}$/.test(key)) {
    return moment.utc(key, 'YYYY-MM').format('MMM');
  }
  return key;
}

// Compact two-digit year suffix, e.g. 2026 → "'26".
function yy(year4) {
  return "'" + String(year4).slice(2);
}

// Period-aware label for a single interval key.
// Shows the year on the first interval and at each year boundary so long axes
// stay legible (e.g. Monthly January → "Jan '26"); bare label otherwise.
function formatIntervalLabel(key, period, prevKey) {
  const year = key.slice(0, 4);
  const showYear = !prevKey || prevKey.slice(0, 4) !== year;
  switch (period) {
    case 'Yearly':
      return key; // 'YYYY'
    case 'Quarterly': {
      const q = key.slice(5); // 'Qn'
      return showYear ? `${q} ${yy(year)}` : q;
    }
    case 'Weekly': {
      const w = Number(key.slice(5)); // 'WW' → n
      return showYear ? `W${w} ${yy(year)}` : `W${w}`;
    }
    case 'Daily': {
      const lbl = moment.utc(key, 'YYYY-MM-DD').format('MMM D');
      return showYear ? `${lbl} ${yy(year)}` : lbl;
    }
    case 'Monthly':
    default: {
      const m = moment.utc(key, 'YYYY-MM').format('MMM');
      return showYear ? `${m} ${yy(year)}` : m;
    }
  }
}

// Build a label per interval. With a known period, uses year-boundary-aware
// labels; without one, falls back to the bare per-key labelFor.
function buildLabels(intervals, period) {
  if (!period) return intervals.map(labelFor);
  return intervals.map((k, i) => formatIntervalLabel(k, period, i > 0 ? intervals[i - 1] : null));
}

// Sparse, evenly-meaningful x-axis ticks for ANY period: the full year at each
// year start, "Qn" at each quarter start, '' everywhere else. Driven by the
// interval's real date so it is correct for Daily/Weekly/Monthly/Quarterly
// alike (Yearly naturally yields one year label per bucket). Charts feed these
// through axisLabel.formatter with interval:0 so ECharts can't drop the
// year-bearing labels (the cause of the "Q1 '15 · Q4 · Q3 …" jumble).
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Upper bound on labelled ticks across the visible window. The step ladder is
// chosen as the FINEST step whose tick count stays under this, so the axis is as
// dense as it can be without crowding — no sparse "3 ticks with gaping voids".
const TICK_MAX = 14;
// Finest calendar unit each period may resolve to (rank: day0<week1<month2<quarter3<year4).
const PERIOD_FINEST_RANK = { Yearly: 4, Quarterly: 3, Monthly: 2, Weekly: 1, Daily: 0 };
// Tick "steps" from finest→coarsest. Each yields a candidate set of boundary
// positions; intermediate strides (week×2, year×2/5/10) keep the density curve
// smooth so there is never a big jump from "every week" straight to "every month".
const STEP_LADDER = [
  { unit: 'day', n: 1, rank: 0 },
  { unit: 'week', n: 1, rank: 1 },
  { unit: 'week', n: 2, rank: 1 },
  { unit: 'month', n: 1, rank: 2 },
  { unit: 'quarter', n: 1, rank: 3 },
  { unit: 'half', n: 1, rank: 3 },
  { unit: 'year', n: 1, rank: 4 },
  { unit: 'year', n: 2, rank: 4 },
  { unit: 'year', n: 5, rank: 4 },
  { unit: 'year', n: 10, rank: 4 },
];

// Density-adaptive axis ticks. Finer marks (month/week/day) appear only once the
// visible (slider-windowed) range is narrow enough to fit them under TICK_MAX, so
// Daily over 10 years shows just years, but shrinking the slider reveals quarters,
// then months, then weeks, then days. Each tick is labelled by its COARSEST
// boundary (year > quarter > month > week > day) so the axis nests cleanly, and
// month/quarter/year boundaries are always overlaid for context even when the
// chosen step is weekly/daily. Charts feed these through axisLabel.formatter with
// interval:0 so ECharts can't drop the year-bearing labels.
function axisTicksFor(intervals, intervalDates, period) {
  const n = intervalDates.length;
  if (n === 0) return [];

  // Single-interval window: yStart(0) is always true so the normal path emits just
  // "2026" — useless without finer context. formatIntervalLabel always includes year.
  if (n === 1) return [formatIntervalLabel(intervals[0], period, null)];

  // Per-interval calendar attributes. Quarterly trusts its 'YYYY-Qn' key because
  // the legacy quarter buckets are uneven (the date can fall in another quarter).
  const attr = new Array(n);
  for (let i = 0; i < n; i++) {
    if (period === 'Quarterly') {
      const mq = /^(\d{4})-Q(\d)$/.exec(intervals[i]);
      const y = mq ? Number(mq[1]) : intervalDates[i].getUTCFullYear();
      const q = mq ? Number(mq[2]) : Math.floor(intervalDates[i].getUTCMonth() / 3) + 1;
      attr[i] = { y, q, mo: (q - 1) * 3, wk: 0, wy: y, dom: 1 };
    } else {
      const d = intervalDates[i];
      const mm = moment.utc(d);
      attr[i] = {
        y: d.getUTCFullYear(), q: Math.floor(d.getUTCMonth() / 3) + 1, mo: d.getUTCMonth(),
        wk: mm.isoWeek(), wy: mm.isoWeekYear(), dom: d.getUTCDate(),
      };
    }
  }

  const yStart = (i) => i === 0 || attr[i].y !== attr[i - 1].y;
  const qStart = (i) => yStart(i) || attr[i].q !== attr[i - 1].q;
  const mStart = (i) => yStart(i) || attr[i].mo !== attr[i - 1].mo;
  const wStart = (i) => i === 0 || attr[i].wy !== attr[i - 1].wy || attr[i].wk !== attr[i - 1].wk;

  const indicesWhere = (fn) => { const a = []; for (let i = 0; i < n; i++) if (fn(i)) a.push(i); return a; };
  const yearStarts = indicesWhere(yStart);
  const quarterStarts = indicesWhere(qStart);
  const monthStarts = indicesWhere(mStart);
  const weekStarts = indicesWhere(wStart);
  const halfStarts = monthStarts.filter((i) => attr[i].mo === 0 || attr[i].mo === 6);

  // How many ticks a step would produce (primary positions only — overlays add a few).
  const stepCount = (s) => {
    if (s.unit === 'day') return n;
    if (s.unit === 'week') return Math.ceil(weekStarts.length / s.n);
    if (s.unit === 'month') return monthStarts.length;
    if (s.unit === 'quarter') return quarterStarts.length;
    if (s.unit === 'half') return halfStarts.length;
    return Math.ceil(yearStarts.length / s.n); // year
  };

  // Finest step (no finer than the period) whose primary tick count fits the budget.
  const finestRank = PERIOD_FINEST_RANK[period] != null ? PERIOD_FINEST_RANK[period] : 2;
  let chosen = STEP_LADDER[STEP_LADDER.length - 1];
  for (let li = STEP_LADDER.length - 1; li >= 0; li--) {
    const s = STEP_LADDER[li];
    if (s.rank < finestRank) break;           // finer than the period allows
    if (stepCount(s) <= TICK_MAX) chosen = s;  // keep the finest that still fits
  }

  // Build the set of tick positions for the chosen step.
  const show = new Array(n).fill(false);
  const mark = (arr, stride) => { for (let k = 0; k < arr.length; k += stride) show[arr[k]] = true; };
  if (chosen.unit === 'day') { show.fill(true); }
  else if (chosen.unit === 'week') { mark(weekStarts, chosen.n); }
  else if (chosen.unit === 'month') { mark(monthStarts, 1); }
  else if (chosen.unit === 'quarter') { mark(quarterStarts, 1); }
  else if (chosen.unit === 'half') { mark(halfStarts, 1); }
  else { mark(yearStarts, chosen.n); }
  // Always overlay coarse boundaries for context when stepping by week/day.
  if (chosen.rank <= 1) { for (const i of monthStarts) show[i] = true; }

  const ticks = new Array(n).fill('');
  for (let i = 0; i < n; i++) {
    if (!show[i]) continue;
    if (yStart(i)) ticks[i] = String(attr[i].y);
    // Half-year mid-points read better as the month name ("Jul") than as "Q3".
    else if (chosen.unit === 'half') ticks[i] = MONTH_ABBR[attr[i].mo];
    else if (qStart(i)) ticks[i] = 'Q' + attr[i].q;
    else if (mStart(i)) ticks[i] = MONTH_ABBR[attr[i].mo];
    else if (wStart(i)) ticks[i] = 'W' + attr[i].wk;
    else ticks[i] = String(attr[i].dom);
  }
  return ticks;
}

// Tick array aligned to intervals: real year/quarter ticks when interval dates
// are available, otherwise the plain labels (legacy callers without dates).
function buildTicks(intervals, intervalDates, period, labels) {
  if (intervalDates && intervalDates.length === intervals.length) {
    return axisTicksFor(intervals, intervalDates, period);
  }
  return labels;
}

/**
 * buildOverview(model) → OverviewViewModel
 *
 * Transforms the compute() model into the data the Overview tab needs:
 *  - monthly:      [{m, inc, exp}]  — one bar per interval, in interval order
 *  - income:       [{cat, avg, max, min, total}]  — income rows aggregated by full account path
 *  - expenses:     [{cat, avg, max, min, total}]  — expense rows aggregated by full account path
 *  - statStrip:    {income, expenses, net, savingsRate}
 *  - categoryCount: expenses.length
 *
 * avg/max/min are computed over the category's PER-INTERVAL sums:
 *   - Group the category's postings into the interval buckets they fall in.
 *   - avg = total / number-of-distinct-intervals-the-category-appears-in
 *   - max = largest per-interval sum for that category
 *   - min = smallest per-interval sum for that category
 * This matches how the overview table presents per-month figures.
 */
function buildOverview(model) {
  const { postings, intervals, currency, period } = model;

  // ── 1. Derive interval key from a posting date ────────────────────────────
  // Prefer the exact key function compute used (model.intervalKeyFn) so the
  // bucketing is guaranteed to match the interval keys for every period
  // (this is what fixes Weekly mis-bucketing and the Yearly "all zero" bug).
  // Falls back to a shape-based heuristic when no key fn is supplied (legacy tests).
  function heuristicKey(date) {
    if (!intervals || intervals.length === 0) return null;
    const sample = intervals[0];
    if (/^\d{4}-W\d{2}$/.test(sample)) return moment.utc(date).format('YYYY-WW');
    if (/^\d{4}-Q\d$/.test(sample)) {
      const q = Math.ceil((date.getUTCMonth() + 1) / 3);
      return `${date.getUTCFullYear()}-Q${q}`;
    }
    if (/^\d{4}$/.test(sample)) return String(date.getUTCFullYear());
    if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) return moment.utc(date).format('YYYY-MM-DD');
    return moment.utc(date).format('YYYY-MM');
  }
  const intervalKeyFor = typeof model.intervalKeyFn === 'function' ? model.intervalKeyFn : heuristicKey;

  // ── 2. Build monthly bars ────────────────────────────────────────────────────
  // Initialise one bucket per interval, preserving order.
  const bucketMap = new Map(); // intervalKey → { inc, exp }
  const intervalSet = new Set(intervals); // fast membership test, shared with category aggregation
  for (const key of intervals) {
    bucketMap.set(key, { inc: 0, exp: 0 });
  }

  for (const p of postings) {
    const key = intervalKeyFor(p.date);
    if (key == null || !bucketMap.has(key)) continue;
    const bucket = bucketMap.get(key);
    if (p.type === 'income') {
      bucket.inc += -p.amount; // income amounts are negative → flip sign
    } else if (p.type === 'expenses') {
      bucket.exp += p.amount;
    }
  }

  const labels = buildLabels(intervals, period);
  const ticks = buildTicks(intervals, model.intervalDates, period, labels);
  const monthly = intervals.map((key, i) => {
    const { inc, exp } = bucketMap.get(key);
    return { key, m: labels[i], tick: ticks[i], inc, exp };
  });

  // ── 3. Aggregate by category (full account path) ─────────────────────────────
  // For each category, collect per-interval sums, then derive avg/max/min/total.
  function aggregateByCategory(filteredPostings, amountFn) {
    // catKey → Map<intervalKey, sum>
    const catIntervalMap = new Map();

    for (const p of filteredPostings) {
      const cat = p.accounts.join(':');
      const key = intervalKeyFor(p.date);
      if (key == null || !intervalSet.has(key)) continue;
      if (!catIntervalMap.has(cat)) catIntervalMap.set(cat, new Map());
      const imap = catIntervalMap.get(cat);
      imap.set(key, (imap.get(key) || 0) + amountFn(p));
    }

    const rows = [];
    for (const [cat, imap] of catIntervalMap) {
      const perIntervalSums = Array.from(imap.values());
      const total = perIntervalSums.reduce((s, v) => s + v, 0);
      const avg = total / perIntervalSums.length;
      const max = Math.max(...perIntervalSums);
      const min = Math.min(...perIntervalSums);
      rows.push({ cat, avg, max, min, total });
    }

    // Sort descending by total (largest contributor first)
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }

  const expensePostings = postings.filter((p) => p.type === 'expenses');
  const incomePostings  = postings.filter((p) => p.type === 'income');

  const expenses = aggregateByCategory(expensePostings, (p) => p.amount);
  const income   = aggregateByCategory(incomePostings,  (p) => -p.amount);

  // ── 4. Stat strip ────────────────────────────────────────────────────────────
  const totalIncome   = incomePostings.reduce((s, p)  => s + -p.amount, 0);
  const totalExpenses = expensePostings.reduce((s, p) => s + p.amount, 0);
  const net = totalIncome - totalExpenses;
  const savingsRate = totalIncome ? Math.round((net / totalIncome) * 100) : 0;

  const statStrip = { income: totalIncome, expenses: totalExpenses, net, savingsRate };

  return {
    currency,
    monthly,
    income,
    expenses,
    statStrip,
    categoryCount: expenses.length,
  };
}

/**
 * buildBreakdownTree(postings, kind) → Node[]
 *
 * Builds a hierarchical category tree for the given kind ('expenses' or 'income').
 * Each node: { name, label, value, children }
 *   - name:     full path key below the type root, e.g. 'School' or 'School:Eraser'
 *   - label:    the last path segment, e.g. 'Eraser'
 *   - value:    sum of this node's own direct postings PLUS all descendant postings
 *               (so parent.value − Σchildren.value = "direct / not-itemised" remainder)
 *   - children: sorted sub-nodes (descending by value)
 *
 * Sign convention: income amounts are stored negative in the ledger → flip sign so
 * every returned value is a positive number. Expenses are already positive.
 *
 * Returns the root-level nodes (one level below the type segment), sorted
 * descending by value.
 *
 * NOTE: The "__direct" not-itemised remainder row is NOT added here — it is
 * computed at render time by the BarNode component (Task 4.2) as
 * value − Σchildren.value.
 */
function buildBreakdownTree(postings, kind) {
  const filtered = postings.filter((p) => p.type === kind);

  // Determine sign fn: income amounts are negative, flip them; expenses are positive.
  const amountFn = kind === 'income' ? (p) => -p.amount : (p) => p.amount;

  // nodeMap: full path key (e.g. 'School:Eraser') → node object
  const nodeMap = new Map();

  function getOrCreate(pathSegments) {
    const key = pathSegments.join(':');
    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        name: key,
        label: pathSegments[pathSegments.length - 1],
        value: 0,
        children: [],
        _parentKey: pathSegments.length > 1 ? pathSegments.slice(0, -1).join(':') : null,
      });
    }
    return nodeMap.get(key);
  }

  for (const p of filtered) {
    // Drop the leading type segment (e.g. 'Expenses' or 'Income')
    // accounts = ['Expenses', 'School', 'Eraser'] → path = ['School', 'Eraser']
    const path = p.accounts.slice(1);
    if (path.length === 0) continue; // posting directly on the root type — skip

    const amount = amountFn(p);

    // Accumulate the amount at EVERY ancestor level, including the leaf.
    // This ensures parent.value = own direct postings + all descendant postings.
    for (let depth = 1; depth <= path.length; depth++) {
      const node = getOrCreate(path.slice(0, depth));
      node.value += amount;
    }
  }

  // Wire up children relationships
  for (const [key, node] of nodeMap) {
    if (node._parentKey && nodeMap.has(node._parentKey)) {
      const parent = nodeMap.get(node._parentKey);
      if (!parent.children.includes(node)) {
        parent.children.push(node);
      }
    }
  }

  // Sort children arrays descending by value (recursive)
  function sortNode(node) {
    node.children.sort((a, b) => b.value - a.value);
    node.children.forEach(sortNode);
    return node;
  }

  // Collect root nodes (depth-1: no parent in the map)
  const roots = [];
  for (const [, node] of nodeMap) {
    if (node._parentKey === null) {
      roots.push(sortNode(node));
    }
  }

  // Sort roots descending by value
  roots.sort((a, b) => b.value - a.value);
  return roots;
}

/**
 * buildBalanceTree(balances, intervalIdx) → { roots, netWorth }
 *
 * Transforms the compute() `balances` Map (Map<BalanceKey, number[]>) into a
 * nested account tree for the Balance view, plus a net-worth figure.
 *
 * Net-worth rule — sourced from balance.js (the legacy renderer):
 *   balance.js aggregates ALL account types into the tree with no type filter.
 *   Net worth is computed as: sum of balances for account types 'assets' and
 *   'liabilities' only. This matches the mockup (rd-views.jsx BAL_DATA):
 *     Assets 255920 + Liabilities -28000 = Net Worth 227920.
 *   Income, Expenses, Equity are NOT included in net worth.
 *
 * @param {Map}    balances    — Map<BalanceKey, number[]> from compute()
 * @param {number} intervalIdx — which interval index to use as the snapshot
 *                               (model.sliderValues[1]); clamped to valid range.
 * @returns {{ roots: Node[], netWorth: number }}
 *   Node shape: { id, account, balance, type, children }
 *     - id:       unique string (the full account path, e.g. 'Assets:Bank')
 *     - account:  full account path at this node level
 *     - balance:  sum of this node + all descendants at intervalIdx
 *     - type:     account type string (from BalanceKey.type)
 *     - children: Node[] (empty for leaves)
 */
function buildBalanceTree(balances, intervalIdx) {
  if (!balances || balances.size === 0) {
    return { roots: [], netWorth: 0 };
  }

  // nodeMap: full account path → node object
  const nodeMap = new Map();

  function getOrCreate(pathSegments, type) {
    const fullPath = pathSegments.join(':');
    if (!nodeMap.has(fullPath)) {
      nodeMap.set(fullPath, {
        id: fullPath,
        account: fullPath,
        balance: 0,
        type,
        children: [],
        _parentKey: pathSegments.length > 1 ? pathSegments.slice(0, -1).join(':') : null,
      });
    }
    return nodeMap.get(fullPath);
  }

  for (const [key, arr] of balances) {
    if (!arr || arr.length === 0) continue;
    // Clamp intervalIdx to valid range
    const idx = Math.min(Math.max(0, intervalIdx), arr.length - 1);
    const value = arr[idx];
    if (value === 0) continue;

    const segments = key.account.split(':');

    // Accumulate value at EVERY ancestor level (same pattern as balance.js and buildBreakdownTree).
    // Ancestor nodes receive their .type from whichever leaf is iterated first ("first-writer-wins").
    // This is reliable because typeExtractor classifies accounts by top-level path-prefix regex
    // (e.g. /^assets?(:|$)/ → 'assets'), so every account under a given root shares that root's
    // type. Net-worth computation (assets + liabilities root nodes) depends on this invariant.
    for (let depth = 1; depth <= segments.length; depth++) {
      const node = getOrCreate(segments.slice(0, depth), key.type);
      node.balance += value;
    }
  }

  // Wire up children relationships
  for (const [, node] of nodeMap) {
    if (node._parentKey && nodeMap.has(node._parentKey)) {
      const parent = nodeMap.get(node._parentKey);
      if (!parent.children.includes(node)) {
        parent.children.push(node);
      }
    }
  }

  // Collect root nodes (no parent in the map)
  const roots = [];
  for (const [, node] of nodeMap) {
    if (node._parentKey === null) {
      roots.push(node);
    }
  }

  // Compute net worth: assets + liabilities only (see balance.js convention)
  let netWorth = 0;
  for (const node of roots) {
    if (node.type === 'assets' || node.type === 'liabilities') {
      netWorth += node.balance;
    }
  }

  return { roots, netWorth };
}

/**
 * buildAssets(model) → AssetsViewModel
 *
 * Transforms the compute() `balances` Map into a multi-series time-series view-model
 * for the Assets & Liabilities view (AreaLineChart).
 *
 * Aggregation: one series per top-level account segment (first ':'-separated part)
 * for accounts of type 'assets' or 'liabilities'. Sub-accounts all roll up into
 * their top-level segment's series.
 *
 * Returns:
 *   {
 *     data:   [{ m, <topLevelKey>: value, … }]  — one entry per interval
 *     series: [{ key, color, label }]            — one per top-level account
 *     maxY:   number                             — max abs value across data (for chart scale)
 *     grid:   number[]                           — suggested y-axis gridlines
 *   }
 */
function buildAssets(model) {
  const { balances, intervals, intervalDates } = model;

  if (!balances || balances.size === 0 || !intervals || intervals.length === 0) {
    return { data: [], series: [], maxY: 0, grid: [0] };
  }

  // ── 1. Collect top-level accounts of type assets/liabilities ──────────────
  // topKey → { type, sums: number[] (length = intervals.length, all zeros) }
  const topMap = new Map(); // key = top-level segment string → { type, sums }

  for (const [balKey, arr] of balances) {
    if (balKey.type !== 'assets' && balKey.type !== 'liabilities') continue;

    const topSegment = balKey.account.split(':')[0];

    if (!topMap.has(topSegment)) {
      topMap.set(topSegment, { type: balKey.type, sums: new Array(intervals.length).fill(0) });
    }

    const { sums } = topMap.get(topSegment);
    for (let i = 0; i < intervals.length; i++) {
      sums[i] += arr[i] || 0;
    }
  }

  if (topMap.size === 0) {
    return { data: [], series: [], maxY: 0, grid: [0] };
  }

  // ── 2. Build series array (one per top-level account, cycling T.chart) ────
  const topKeys = Array.from(topMap.keys()).sort();
  const series = topKeys.map((key, idx) => ({
    key,
    color: T.chart[idx % T.chart.length],
    label: key,
    type: topMap.get(key).type,
  }));

  // ── 3. Build data array ────────────────────────────────────────────────────
  const labels = buildLabels(intervals, model.period);
  const ticks = buildTicks(intervals, intervalDates, model.period, labels);
  const data = intervals.map((interval, i) => {
    const entry = { key: interval, m: labels[i], tick: ticks[i] };
    for (const key of topKeys) {
      entry[key] = topMap.get(key).sums[i];
    }
    return entry;
  });

  // ── 4. Compute maxY (max absolute value for chart scale) ──────────────────
  let absMax = 0;
  for (const entry of data) {
    for (const key of topKeys) {
      absMax = Math.max(absMax, Math.abs(entry[key]));
    }
  }
  const maxY = absMax || 1;

  // ── 5. Generate grid lines (5 evenly spaced from 0 to maxY) ───────────────
  const step = Math.pow(10, Math.floor(Math.log10(maxY)));
  const niceStep = step * (maxY / step <= 2 ? 0.5 : maxY / step <= 5 ? 1 : 2);
  const niceMax = Math.ceil(maxY / niceStep) * niceStep;
  const gridCount = 4;
  const grid = [];
  for (let g = 0; g <= gridCount; g++) {
    grid.push(Math.round((niceMax / gridCount) * g));
  }

  return { data, series, maxY: niceMax, grid };
}

/**
 * buildPortfolio(model) → PortfolioViewModel
 *
 * Transforms compute()'s `valResult` into a portfolio view-model with
 * per-holding market values, cost bases, unrealised gains, and a time-series
 * of total portfolio value across intervals.
 *
 * Input (from model):
 *   valResult          — { balances: { [account]: { [commodity]: { [dateStr]: { quantity, costBasis, marketValue } } } }, baseCurrency }
 *   valuationService   — ValuationService instance (from compute()); used to re-price each
 *                        holding at each interval-end date via getAccountValueAtDate(), matching
 *                        the legacy portfolio.js approach so the chart tracks market prices
 *                        between transactions (not just snapshot values from transaction dates).
 *   intervals          — string[] of interval keys (e.g. ['2018-01', '2018-02'])
 *   intervalDates      — Date[] aligned with intervals
 *   currency           — active display currency (= base currency)
 *
 * Output:
 *   {
 *     totals:      [{ m, value }]   — one entry per interval; re-priced at interval-end via
 *                                     ValuationService.getAccountValueAtDate(), so the chart
 *                                     reflects market-price movement between transactions.
 *     holdings:    [{ account, asset, qty, cost, market, gain }]
 *     totalCost:   number
 *     totalMarket: number
 *     totalGain:   number           — always equals totalMarket - totalCost
 *     maxY:        number           — suggested chart y-axis ceiling (nice-rounded)
 *     grid:        number[]         — suggested y-axis gridlines
 *   }
 *
 * Only non-base-currency commodities are included (i.e., actual portfolio
 * assets, not cash in the base currency). Replicates the math from portfolio.js
 * (repo root) so numbers stay identical to the legacy view.
 */
function buildPortfolio(model) {
  const empty = { totals: [], holdings: [], totalCost: 0, totalMarket: 0, totalGain: 0, maxY: 0, grid: [0] };

  if (!model || !model.valResult || !model.valResult.balances) return empty;

  const { valResult, valuationService, intervals, intervalDates, currency } = model;
  const { balances } = valResult;

  // The base currency to exclude from holdings (same as 'currentCurrency' in portfolio.js)
  const baseCurrency = currency || valResult.baseCurrency || 'EUR';

  if (!intervals || intervals.length === 0) return empty;

  // ── Helper: find the latest recorded snapshot on or before a given date ────
  // Used for holdings table (latest-value read only, no repricing needed there).
  function snapshotAtDate(accountComm, dateStr) {
    const sortedDates = Object.keys(accountComm).sort();
    let lastDate = null;
    for (const d of sortedDates) {
      if (d <= dateStr) {
        lastDate = d;
      } else {
        break;
      }
    }
    if (!lastDate) return null;
    return accountComm[lastDate];
  }

  // ── 1. Build holdings from latest available snapshot ─────────────────────
  // Use the last intervalDate as the "latest" cutoff, matching portfolio.js's
  // latestDate = displayIntervalDates[displayIntervalDates.length - 1].
  const latestDate = intervalDates[intervalDates.length - 1];
  const latestDateStr = latestDate instanceof Date
    ? latestDate.toISOString().split('T')[0]
    : latestDate;

  const holdings = [];

  for (const account of Object.keys(balances)) {
    for (const commodity of Object.keys(balances[account])) {
      if (commodity === baseCurrency) continue; // skip base-currency cash

      const snap = snapshotAtDate(balances[account][commodity], latestDateStr);
      if (!snap || snap.quantity === 0) continue;

      const market = snap.marketValue;
      const cost   = snap.costBasis;
      const gain   = market - cost;

      holdings.push({
        account,
        asset:  commodity,
        qty:    snap.quantity,
        cost,
        market,
        gain,
      });
    }
  }

  // ── 2. Compute per-interval total portfolio market value ──────────────────
  // Re-price each holding at each interval-end date using ValuationService
  // getAccountValueAtDate(), matching legacy portfolio.js (line 66-70):
  //   val = valuationService.getAccountValueAtDate(balances, currentCurrency, account, commodity, lookupDate)
  //   aggregatedCost[i] += val.costBasis
  //   aggregatedGain[i] += (val.marketValue - val.costBasis)
  // This means between-transaction price movement is reflected in the chart,
  // unlike the old snapshotAtDate approach which went flat between transactions.
  const labels = buildLabels(intervals, model.period);
  const ticks = buildTicks(intervals, intervalDates, model.period, labels);
  const totals = intervals.map((intervalKey, i) => {
    const date = intervalDates[i];

    let value = 0;
    for (const account of Object.keys(balances)) {
      for (const commodity of Object.keys(balances[account])) {
        if (commodity === baseCurrency) continue;

        if (valuationService) {
          // Re-price at interval-end date using historical prices (legacy portfolio.js approach)
          const val = valuationService.getAccountValueAtDate(
            balances, baseCurrency, account, commodity, date
          );
          value += val.marketValue;
        } else {
          // Fallback when no VS instance: read nearest-prior stored marketValue
          const dateStr = date instanceof Date ? date.toISOString().split('T')[0] : date;
          const snap = snapshotAtDate(balances[account][commodity], dateStr);
          if (snap) value += snap.marketValue;
        }
      }
    }

    return { key: intervalKey, m: labels[i], tick: ticks[i], value };
  });

  // ── 3. Aggregate totals ───────────────────────────────────────────────────
  const totalCost   = holdings.reduce((s, h) => s + h.cost,   0);
  const totalMarket = holdings.reduce((s, h) => s + h.market, 0);
  const totalGain   = totalMarket - totalCost; // guaranteed identity

  // ── 4. Compute maxY and grid for the totals chart (matching buildAssets pattern) ─
  const absMax = totals.reduce((m, t) => Math.max(m, Math.abs(t.value)), 0);
  const maxYRaw = absMax || 1;
  const step = Math.pow(10, Math.floor(Math.log10(maxYRaw)));
  const niceStep = step * (maxYRaw / step <= 2 ? 0.5 : maxYRaw / step <= 5 ? 1 : 2);
  const niceMax = Math.ceil(maxYRaw / niceStep) * niceStep;
  const gridCount = 4;
  const grid = [];
  for (let g = 0; g <= gridCount; g++) {
    grid.push(Math.round((niceMax / gridCount) * g));
  }

  return { totals, holdings, totalCost, totalMarket, totalGain, maxY: niceMax, grid };
}

/**
 * buildPostings(model) → [{date, payee, account, amount, type}]
 *
 * Maps model.postings (decorated postings from compute()) to flat row objects
 * suitable for PostingsView / filterPostings / sortPostings.
 *
 * Field guarantees (CONTRACT from Task 6.1 review):
 *   date    — non-null string 'YYYY-MM-DD'  (from dateString or formatted from Date)
 *   payee   — non-null string               (from merchant, or '' if absent)
 *   account — non-null string               (accounts.join(':'))
 *   amount  — number passthrough
 *   type    — string passthrough (real types from typeExtractor are plural: 'expenses'/'income')
 */
function buildPostings(model) {
  if (!model || !model.postings) return [];
  return model.postings.map((p) => {
    // date: prefer dateString (already YYYY-MM-DD), else format from Date
    let date = p.dateString || '';
    if (!date && p.date instanceof Date) {
      date =
        p.date.getUTCFullYear() +
        '-' +
        String(p.date.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(p.date.getUTCDate()).padStart(2, '0');
    }
    date = date || '';

    // payee: from merchant field; fall back to '' if absent
    const payee = typeof p.merchant === 'string' ? p.merchant : (p.payee != null ? String(p.payee) : '');

    // account: join accounts array; fall back to '' if absent
    const account = Array.isArray(p.accounts) ? p.accounts.join(':') : (p.account != null ? String(p.account) : '');

    return {
      date,
      payee,
      account,
      amount: p.amount,
      type: p.type,
    };
  });
}

module.exports = { buildOverview, buildBreakdownTree, buildBalanceTree, buildAssets, buildPortfolio, buildPostings };
