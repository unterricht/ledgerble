'use strict';

const moment = require('moment');

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
  const { postings, intervals, currency } = model;

  // ── 1. Derive interval key from a posting date (Monthly: 'YYYY-MM') ────────
  // We auto-detect the key format from the first interval string length / shape,
  // then use moment.utc to format each posting date the same way.
  function intervalKeyFor(date) {
    if (!intervals || intervals.length === 0) return null;
    const sample = intervals[0];
    // Detect format: YYYY-MM (7 chars), YYYY-WW (7 chars with W), YYYY-MM-DD (10), YYYY-QN (7 with Q)
    if (/^\d{4}-W\d{2}$/.test(sample)) {
      return moment.utc(date).format('YYYY-WW');
    }
    if (/^\d{4}-Q\d$/.test(sample)) {
      const q = Math.ceil((date.getUTCMonth() + 1) / 3);
      return `${date.getUTCFullYear()}-Q${q}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(sample)) {
      return moment.utc(date).format('YYYY-MM-DD');
    }
    // Default: Monthly 'YYYY-MM'
    return moment.utc(date).format('YYYY-MM');
  }

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

  // Produce readable month label for Monthly keys ('2018-01' → 'Jan').
  // For other formats we fall back to the raw key as the label.
  function labelFor(key) {
    if (/^\d{4}-\d{2}$/.test(key)) {
      return moment.utc(key, 'YYYY-MM').format('MMM');
    }
    return key;
  }

  const monthly = intervals.map((key) => {
    const { inc, exp } = bucketMap.get(key);
    return { m: labelFor(key), inc, exp };
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

module.exports = { buildOverview };
