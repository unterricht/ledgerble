/**
 * compute.js — pure data-preparation seam for the React renderer.
 *
 * This is a faithful extraction of the data-prep portion of `update()` in
 * ui.js (lines ~229–378), stripped of all DOM/jQuery/chart side-effects.
 *
 * Responsibilities (mapped 1-to-1 to update() blocks):
 *   1. Merge postings/prices from all files (update() lines 231–241)
 *   2. Run ValuationService (update() lines 243–251)
 *   3. Detect + apply display currency (update() lines 253–270)
 *   4. Build rawPostings (base-currency only) (update() line 272)
 *   5. Build sorted date list + intervals (update() lines 274–305)
 *   6. calculateBalances (update() line 307–309)
 *   7. Market-value substitution (update() lines 311–333)
 *   8. Resolve sliderValues from dateRange param (replaces dateUpdate(state) DOM call)
 *   9. Date-filter rawPostings → postings (update() lines 354–364)
 *  10. Build accountTree (update() lines 366–373)
 */

'use strict';

const bs = require('binary-search');
const { ValuationService } = require('../../valuation');
const { buildAccountTree, filterPostings } = require('./accountTree');

// ── Period → dateFormat mapping ──────────────────────────────────────────────
// Ported from dateRangeSelector.js updateDateUnits().
// Using plain JS (not moment) to match existing Monthly/Quarterly/Yearly paths.
//
// NOTE — UTC bucketing is INTENTIONAL here.
// The legacy dateRangeSelector.js used local-time getters (getFullYear, getMonth, …).
// compute() deliberately uses UTC equivalents (getUTCFullYear, getUTCMonth, …) and
// moment(...).utc() for the Weekly path. This complies with the project's date policy
// (CLAUDE.md: "Dates are handled as UTC YYYY-MM-DD to dodge timezone drift. Keep new
// date code in UTC."). Consistent UTC bucketing ensures that interval boundaries and
// posting date-filtering produce the same results regardless of the host timezone.
function makeDateFormat(period) {
  switch (period) {
    case 'Daily':
      return (date) => {
        const y = date.getUTCFullYear();
        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
        const d = String(date.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };
    case 'Weekly': {
      // ISO week: YYYY-WW (uses moment to match the original)
      const moment = require('moment');
      return (date) => moment(date).utc().format('YYYY-WW');
    }
    case 'Monthly':
      return (date) =>
        date.getUTCFullYear() +
        '-' +
        String(date.getUTCMonth() + 1).padStart(2, '0');
    case 'Quarterly':
      // Original: date.getFullYear() + "-Q" + (1 + Math.round((date.getMonth() + 1) / 4))
      // Ported to UTC-safe version
      return (date) =>
        date.getUTCFullYear() +
        '-Q' +
        (1 + Math.round((date.getUTCMonth() + 1) / 4));
    case 'Yearly':
      return (date) => String(date.getUTCFullYear());
    default:
      throw new Error('compute: unrecognized period: ' + period);
  }
}

// ── BalanceKey — mirrors the class in ui.js ──────────────────────────────────
class BalanceKey {
  constructor(account, type) {
    this.account = account;
    this.type = type;
  }
  toString() {
    return this.account + '<****>' + this.type;
  }
}

// ── calculateBalances — ported verbatim from ui.js lines 452–493 ─────────────
function calculateBalances(rawPostings, intervals, dateFormat) {
  const keys = new Map();
  const amountsBucketed = new Map();

  for (const p of rawPostings) {
    let key = new BalanceKey(p.accounts.join(':'), p.type);
    if (keys.has(key.toString())) {
      key = keys.get(key.toString());
    } else {
      keys.set(key.toString(), key);
    }

    let amounts;
    if (amountsBucketed.has(key)) {
      amounts = amountsBucketed.get(key);
    } else {
      amounts = Array.from(intervals, () => 0);
      amountsBucketed.set(key, amounts);
    }

    const date = dateFormat(p.date);
    let index = bs(intervals, date, (x, y) => x.localeCompare(y));
    if (index < 0) {
      index = 0;
    }
    for (let i = index; i < amounts.length; i++) {
      amounts[i] = amounts[i] + p.amount;
    }
  }
  return amountsBucketed;
}

// ── accountsFmtd / dateFmtd — decoration helpers ─────────────────────────────
// Mirrored from ui.js lines 108–114 (bound as methods, matching the old pattern)
function accountsFmtd() {
  return this.accounts.join(':');
}

function dateFmtd() {
  return (
    this.date.getUTCFullYear() +
    '/' +
    (1 + this.date.getUTCMonth()) +
    '/' +
    this.date.getUTCDate()
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * compute({ files, currency, period, deselectedAccounts, dateRange, typeExtractor })
 *
 * @param {Map}    files               — Map<filename, { postings, postingsCost, prices }>
 *                                       Postings may arrive pre-decorated (date as Date) or
 *                                       raw (date as YYYY-MM-DD string) — both are handled.
 * @param {string} currency            — active display currency (e.g. 'USD')
 * @param {string} period              — 'Daily'|'Weekly'|'Monthly'|'Quarterly'|'Yearly'
 * @param {Set}    deselectedAccounts  — accounts to exclude from balances
 * @param {Array|null} dateRange       — [fromIdx, toIdx] into intervals, or null = full range
 * @param {Function}   typeExtractor   — accountString → type string
 *
 * @returns {{
 *   currency, currencies, postings, rawPostings,
 *   intervals, intervalDates, balances, valResult,
 *   accountTree, sliderValues
 * }}
 */
function compute({ files, currency, period, deselectedAccounts, dateRange, typeExtractor }) {
  // ── 1. Merge postings/prices across all files ──────────────────────────────
  // (update() lines 231–241)
  let allPostings = [];
  let allPostingsCost = [];
  let allPrices = [];

  for (const f of files.values()) {
    if (f && !f.error) {
      allPostings = allPostings.concat(f.postings || []);
      allPostingsCost = allPostingsCost.concat(f.postingsCost || []);
      allPrices = allPrices.concat(f.prices || []);
    }
  }

  // ── 1b. Decorate raw postings (date string → Date, type, helpers) ──────────
  // (update() / onParsed lines 185–191)
  // We do this on a copy so we don't mutate the FileState originals.
  allPostings = allPostings.map((t) => {
    // If date is already a Date object (pre-decorated in ui.js onParsed),
    // reuse it; if it's a string, convert to UTC midnight Date.
    const decorated = Object.assign({}, t);
    if (typeof decorated.date === 'string') {
      decorated.dateString = decorated.date;
      decorated.date = new Date(decorated.date + 'T00:00:00Z');
    } else if (!decorated.dateString) {
      // Already a Date — store the string form for reference
      const d = decorated.date;
      decorated.dateString =
        d.getUTCFullYear() +
        '-' +
        String(d.getUTCMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getUTCDate()).padStart(2, '0');
    }
    decorated.accountsFmtd = accountsFmtd;
    decorated.dateFmtd = dateFmtd;
    decorated.type = typeExtractor(decorated.accounts.join(':'));
    return decorated;
  });

  // ── 2. Run ValuationService ────────────────────────────────────────────────
  // (update() lines 243–251)
  const valuationService = new ValuationService();
  valuationService.parsePrices(allPrices);
  let valResult;
  try {
    valResult = valuationService.calculateRunningBalances(allPostings, allPostingsCost);
  } catch (e) {
    // Mirrors update()'s catch block
    valResult = { balances: {}, baseCurrency: 'EUR' };
  }

  // ── 3. Detect display currencies ───────────────────────────────────────────
  // (update() lines 253–270)
  // postingsBeforeCurrencySelected = all non-error postings (already in allPostings).
  // Keep the Set internally for O(1) .has() checks; the returned `currencies` field
  // is an Array so downstream callers (e.g. MenuSelect) can call .map() on it.
  const currenciesSet = valuationService.detectBaseCurrencies(allPostings, valuationService.prices);

  // Resolve the effective display currency:
  // If the caller passed a specific currency that exists in the set, use it.
  // Otherwise fall back to valResult.baseCurrency, then detectBaseCurrency.
  let currentCurrency = currency;
  if (!currentCurrency || !currenciesSet.has(currentCurrency)) {
    if (currenciesSet.has(valResult.baseCurrency)) {
      currentCurrency = valResult.baseCurrency;
    } else {
      currentCurrency = valuationService.detectBaseCurrency(allPostings);
    }
  }

  // ── 4. rawPostings — base-currency postings only ───────────────────────────
  // (update() line 272)
  const rawPostings = allPostings.filter((t) => t.currency === currentCurrency);

  // ── 5. Build date intervals ────────────────────────────────────────────────
  // (update() lines 274–305)
  const dateFormat = makeDateFormat(period);

  const dates = rawPostings.map((p) => p.date).sort((a, b) => a.getTime() - b.getTime());

  const intervals = [];
  const intervalDates = [];

  if (dates.length > 0) {
    const endStr = dateFormat(dates[dates.length - 1]);
    const current = new Date(dates[0].getTime());
    let currStr = dateFormat(current);
    intervals.push(currStr);
    intervalDates.push(new Date(current.getTime()));

    while (currStr < endStr) {
      current.setDate(current.getDate() + 1);
      const newCurrStr = dateFormat(current);
      if (newCurrStr !== currStr) {
        intervals.push(newCurrStr);
        intervalDates.push(new Date(current.getTime()));
        currStr = newCurrStr;
      }
    }
    if (endStr !== currStr) {
      intervals.push(endStr);
      intervalDates.push(new Date(current.getTime()));
    }
  }

  // ── 6. calculateBalances ───────────────────────────────────────────────────
  // (update() line 307–309)
  const balances = calculateBalances(
    filterPostings(rawPostings, deselectedAccounts),
    intervals,
    dateFormat
  );

  // ── 7. Market-value substitution ──────────────────────────────────────────
  // (update() lines 311–333)
  for (const [keyStr, amounts] of balances.entries()) {
    const accountMatches = Array.from(deselectedAccounts).some(
      (deselected) => keyStr.account && keyStr.account.startsWith(deselected)
    );
    if (accountMatches) continue;

    const accountName = keyStr.account;
    if (valResult.balances[accountName]) {
      for (let i = 0; i < intervals.length; i++) {
        let additionalValue = 0;
        for (const commodity of Object.keys(valResult.balances[accountName])) {
          if (commodity !== currentCurrency) {
            const val = valuationService.getAccountValueAtDate(
              valResult.balances,
              currentCurrency,
              accountName,
              commodity,
              intervalDates[i]
            );
            additionalValue += val.marketValue;
          }
        }
        amounts[i] += additionalValue;
      }
    }
  }

  // ── 8. Resolve sliderValues from dateRange param ───────────────────────────
  // (replaces DOM dateUpdate(state) call in update() line 336)
  // dateRange is [fromIdx, toIdx] or null (= full range).
  let sliderValues;
  if (dateRange !== null && Array.isArray(dateRange) && intervals.length > 0) {
    const from = Math.max(0, Math.min(dateRange[0], intervals.length - 1));
    const to = Math.max(from, Math.min(dateRange[1], intervals.length - 1));
    sliderValues = [from, to];
  } else {
    sliderValues = [0, Math.max(0, intervals.length - 1)];
  }

  // ── 9. Date-filter rawPostings → postings ──────────────────────────────────
  // (update() lines 354–364)
  const fromStr = intervals[sliderValues[0]];
  const toStr = intervals[sliderValues[1]];
  const postings =
    intervals.length === 0
      ? []
      : rawPostings.filter((p) => {
          const d = dateFormat(p.date);
          return d >= fromStr && d <= toStr;
        });

  // ── 10. Build accountTree from income/expense accounts ─────────────────────
  // (update() lines 366–373)
  const relevantAccounts = new Set();
  for (const p of postings) {
    if (p.type === 'income' || p.type === 'expenses') {
      relevantAccounts.add(p.accountsFmtd());
    }
  }
  const accountTree = buildAccountTree(Array.from(relevantAccounts));

  return {
    currency: currentCurrency,
    currencies: Array.from(currenciesSet),
    postings,
    rawPostings,
    intervals,
    intervalDates,
    balances,
    valResult,
    valuationService,
    accountTree,
    sliderValues,
  };
}

module.exports = { compute };
