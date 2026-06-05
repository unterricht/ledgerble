'use strict';
const { buildAssets, buildAssetAccountList } = require('../src/data/adapters');

// Minimal model with a few asset/liability accounts across 3 intervals
function makeModel(overrides = {}) {
  // BalanceKey objects: { account, type }
  const k = (account, type) => ({ account, type });

  const intervals = ['2018-01', '2018-02', '2018-03'];
  const balances = new Map([
    [k('Assets:Savings',     'assets'),      [10000, 10200, 10400]],
    [k('Assets:Shares',      'assets'),      [50000, 52000, 49000]],
    [k('Assets:Savings:Sub', 'assets'),      [1000,  1050,  1100]], // sub-account of Assets:Savings
    [k('Liabilities:Loan',   'liabilities'), [-5000, -4800, -4600]],
    [k('Expenses:Food',      'expenses'),    [200,   400,   600]], // should be ignored
    [k('Income:Salary',      'income'),      [-1200, -2400, -3600]], // should be ignored
  ]);
  return {
    intervals,
    balances,
    currency: 'USD',
    ...overrides,
  };
}

test('returns data array with length equal to interval count', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  expect(vm.data).toHaveLength(model.intervals.length);
});

test('data entries have m label and a key for each series', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  for (const d of vm.data) {
    expect(typeof d.m).toBe('string');
    for (const s of vm.series) {
      expect(typeof d[s.key]).toBe('number');
    }
  }
});

test('only includes assets and liabilities series, not expenses/income', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  const keys = vm.series.map(s => s.key);
  // Second-level accounts from assets/liabilities
  expect(keys).toContain('Assets:Savings');
  expect(keys).toContain('Assets:Shares');
  expect(keys).toContain('Liabilities:Loan');
  // Expenses and Income must be excluded
  expect(keys.every(k => !k.startsWith('Expenses') && !k.startsWith('Income'))).toBe(true);
});

test('series count equals number of distinct second-level asset/liability accounts', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // Assets:Savings, Assets:Shares, Liabilities:Loan (Assets:Savings:Sub rolls up)
  expect(vm.series.length).toBe(3);
});

test('aggregates sub-accounts into the second-level account series per interval', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // Assets:Savings at [0] = Savings(10000) + Savings:Sub(1000) = 11000
  const savingsEntry = vm.series.find(s => s.key === 'Assets:Savings');
  expect(savingsEntry).toBeDefined();
  expect(vm.data[0]['Assets:Savings']).toBe(10000 + 1000);
  // Assets:Shares at [0] = 50000 (its own series)
  expect(vm.data[0]['Assets:Shares']).toBe(50000);
});

test('liabilities series values are present', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  const liabEntry = vm.series.find(s => s.key === 'Liabilities:Loan');
  expect(liabEntry).toBeDefined();
  // At index 0: -5000
  expect(vm.data[0]['Liabilities:Loan']).toBe(-5000);
});

test('series entries have key, color, and label', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  for (const s of vm.series) {
    expect(typeof s.key).toBe('string');
    expect(typeof s.color).toBe('string');
    expect(typeof s.label).toBe('string');
  }
});

test('maxY is a positive number', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  expect(typeof vm.maxY).toBe('number');
  expect(vm.maxY).toBeGreaterThan(0);
});

test('minY is a non-positive number when liabilities exist', () => {
  const vm = buildAssets(makeModel());
  expect(typeof vm.minY).toBe('number');
  expect(vm.minY).toBeLessThanOrEqual(0);
  // must be <= the actual minimum value in the data (-5000)
  const actualMin = Math.min(...vm.data.map(d => d['Liabilities:Loan']));
  expect(vm.minY).toBeLessThanOrEqual(actualMin);
});

test('minY is 0 when no negative values exist', () => {
  const k = (account, type) => ({ account, type });
  const onlyAssets = {
    intervals: ['2018-01', '2018-02'],
    balances: new Map([[k('Assets:Cash', 'assets'), [1000, 2000]]]),
    currency: 'USD',
  };
  const vm = buildAssets(onlyAssets);
  expect(vm.minY).toBe(0);
});

test('grid is an array of numbers', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  expect(Array.isArray(vm.grid)).toBe(true);
  expect(vm.grid.length).toBeGreaterThan(0);
  vm.grid.forEach(v => expect(typeof v).toBe('number'));
});

test('empty balances returns empty data and series', () => {
  const vm = buildAssets({ intervals: [], balances: new Map(), currency: 'USD' });
  expect(vm.data).toEqual([]);
  expect(vm.series).toEqual([]);
});

test('interval label uses MMM format for monthly intervals', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // '2018-01' → 'Jan', '2018-02' → 'Feb', '2018-03' → 'Mar'
  expect(vm.data[0].m).toBe('Jan');
  expect(vm.data[1].m).toBe('Feb');
  expect(vm.data[2].m).toBe('Mar');
});

test('each series entry has a type field matching assets or liabilities', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  const assetsSeries = vm.series.find(s => s.key === 'Assets:Savings');
  const liabSeries   = vm.series.find(s => s.key === 'Liabilities:Loan');
  expect(assetsSeries.type).toBe('assets');
  expect(liabSeries.type).toBe('liabilities');
});

// ── NEW: second-level aggregation ────────────────────────────────────────────

test('creates one series per second-level account segment', () => {
  const vm = buildAssets(makeModel());
  const keys = vm.series.map(s => s.key).sort();
  // Assets:Savings, Assets:Shares, Liabilities:Loan  (Assets:Savings:Sub rolls up)
  expect(keys).toEqual(['Assets:Savings', 'Assets:Shares', 'Liabilities:Loan']);
});

test('rolls sub-accounts deeper than second level into their second-level parent', () => {
  const vm = buildAssets(makeModel());
  const keys = vm.series.map(s => s.key);
  expect(keys).not.toContain('Assets:Savings:Sub');
  // Assets:Savings at index 0 = Savings(10000) + Savings:Sub(1000) = 11000
  expect(vm.data[0]['Assets:Savings']).toBe(11000);
});

test('series label is the last colon-separated segment of the key', () => {
  const vm = buildAssets(makeModel());
  const savingsSeries = vm.series.find(s => s.key === 'Assets:Savings');
  expect(savingsSeries.label).toBe('Savings');
  const loanSeries = vm.series.find(s => s.key === 'Liabilities:Loan');
  expect(loanSeries.label).toBe('Loan');
});

test('second-level liabilities series values are present', () => {
  const vm = buildAssets(makeModel());
  const liabEntry = vm.series.find(s => s.key === 'Liabilities:Loan');
  expect(liabEntry).toBeDefined();
  expect(vm.data[0]['Liabilities:Loan']).toBe(-5000);
});

// ── NEW: deselectedAssetAccounts filter ──────────────────────────────────────

test('excludes deselected accounts when deselectedAssetAccounts is passed', () => {
  const desel = new Set(['Assets:Shares']);
  const vm = buildAssets(makeModel(), desel);
  const keys = vm.series.map(s => s.key);
  expect(keys).not.toContain('Assets:Shares');
  expect(keys).toContain('Assets:Savings');
  expect(keys).toContain('Liabilities:Loan');
});

test('deselected account does not appear in data entries', () => {
  const desel = new Set(['Assets:Shares']);
  const vm = buildAssets(makeModel(), desel);
  for (const entry of vm.data) {
    expect(entry['Assets:Shares']).toBeUndefined();
  }
});

test('empty deselectedAssetAccounts shows all second-level series', () => {
  const vm = buildAssets(makeModel(), new Set());
  expect(vm.series).toHaveLength(3);
});

// ── NEW: buildAssetAccountList ────────────────────────────────────────────────

test('buildAssetAccountList returns one entry per second-level asset/liability account', () => {
  const { balances } = makeModel();
  const list = buildAssetAccountList(balances);
  const keys = list.map(a => a.key).sort();
  expect(keys).toEqual(['Assets:Savings', 'Assets:Shares', 'Liabilities:Loan']);
});

test('buildAssetAccountList each entry has key, type, and label', () => {
  const { balances } = makeModel();
  const list = buildAssetAccountList(balances);
  for (const a of list) {
    expect(typeof a.key).toBe('string');
    expect(['assets', 'liabilities']).toContain(a.type);
    expect(a.label).toBe(a.key.split(':').pop());
  }
});

test('buildAssetAccountList excludes income/expense accounts', () => {
  const { balances } = makeModel();
  const list = buildAssetAccountList(balances);
  expect(list.every(a => a.type === 'assets' || a.type === 'liabilities')).toBe(true);
});

test('buildAssetAccountList deduplicates (Assets:Savings:Sub rolls up to Assets:Savings)', () => {
  const { balances } = makeModel();
  const list = buildAssetAccountList(balances);
  const savingsCount = list.filter(a => a.key === 'Assets:Savings').length;
  expect(savingsCount).toBe(1);
});

test('buildAssetAccountList returns empty array for empty balances', () => {
  expect(buildAssetAccountList(new Map())).toEqual([]);
});
