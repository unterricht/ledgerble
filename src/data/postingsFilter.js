// Filter and sort postings rows for the PostingsView table.
// Ported from rd-views.jsx lines 285-290 (filter predicate) + stable comparator.

// Types shown in the "Transaktionen" (all) segment — expenses and income only
const INCOME_EXPENSE_TYPES = new Set(['expenses', 'expense', 'income']);

/**
 * filterPostings(rows, query, typeFilter)
 * @param {object[]} rows       – array of posting objects
 * @param {string}   query      – case-insensitive substring; '' means no text filter
 * @param {string}   typeFilter – 'all' | 'income' | 'expenses' | 'assets'
 * @returns {object[]} filtered (new array, input not mutated)
 *
 * 'all'    → only expenses/income rows (Transaktionen — user-facing view)
 * 'assets' → all rows without type filter (Kontenbewegungen — raw journal view)
 */
function filterPostings(rows, query, typeFilter) {
  const q = (query || '').toLowerCase();
  return rows.filter(p => {
    let okT;
    if (typeFilter === 'all') {
      okT = INCOME_EXPENSE_TYPES.has(p.type);
    } else if (typeFilter === 'assets') {
      okT = true; // raw journal view: no type filter
    } else {
      okT = p.type === typeFilter;
    }
    const okQ = !q || p.payee.toLowerCase().includes(q) || p.account.toLowerCase().includes(q) || p.date.includes(q);
    return okT && okQ;
  });
}

/**
 * sortPostings(rows, key, dir)
 * @param {object[]} rows – array of posting objects
 * @param {string}   key  – 'date' | 'payee' | 'account' | 'amount'
 * @param {string}   dir  – 'asc' | 'desc'
 * @returns {object[]} sorted new array (input not mutated)
 */
function sortPostings(rows, key, dir) {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sign * (av - bv);
    }
    // string comparison (works for ISO date strings too)
    if (av < bv) return -sign;
    if (av > bv) return sign;
    return 0;
  });
}

module.exports = { filterPostings, sortPostings };
