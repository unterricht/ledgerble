'use strict';
const { buildAssets } = require('../src/data/adapters');

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
  // Top-level accounts from assets/liabilities: Assets, Liabilities
  expect(keys).toContain('Assets');
  expect(keys).toContain('Liabilities');
  // Expenses and Income must be excluded
  expect(keys).not.toContain('Expenses');
  expect(keys).not.toContain('Income');
});

test('series count equals number of distinct top-level asset/liability accounts', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // We have Assets and Liabilities as top-level types
  expect(vm.series.length).toBe(2);
});

test('aggregates sub-accounts into the top-level account series per interval', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // Assets top-level at interval 0:
  //   Assets:Savings = 10000, Assets:Savings:Sub = 1000 (but sub is under Savings, which is under Assets)
  //   Assets:Shares = 50000
  //   Top-level 'Assets' should be the sum of Assets:Savings + Assets:Savings:Sub + Assets:Shares
  //   Wait - we aggregate by TOP-LEVEL segment only, so both Assets:Savings and Assets:Shares belong to 'Assets'
  //   Sub-accounts (Assets:Savings:Sub) also have top-level 'Assets'
  //   So Assets total at [0] = 10000 + 50000 + 1000 = 61000
  const assetsEntry = vm.series.find(s => s.key === 'Assets');
  expect(assetsEntry).toBeDefined();
  const dataAt0 = vm.data[0]['Assets'];
  expect(dataAt0).toBe(10000 + 50000 + 1000);
});

test('liabilities series values are present', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  const liabEntry = vm.series.find(s => s.key === 'Liabilities');
  expect(liabEntry).toBeDefined();
  // At index 0: -5000
  expect(vm.data[0]['Liabilities']).toBe(-5000);
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
