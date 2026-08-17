'use strict';
const { buildAssets, buildAssetAccountTree } = require('../src/data/adapters');

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

// Account series only — the synthetic net-worth series is excluded.
const accountSeries = (vm) => vm.series.filter(s => s.type !== 'net');

test('series count equals number of distinct second-level asset/liability accounts', () => {
  const model = makeModel();
  const vm = buildAssets(model);
  // Assets:Savings, Assets:Shares, Liabilities:Loan (Assets:Savings:Sub rolls up)
  expect(accountSeries(vm).length).toBe(3);
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

test('asset series use green palette colors, liability series use red palette colors', () => {
  const { T } = require('../src/ui/tokens');
  const vm = buildAssets(makeModel());
  for (const s of accountSeries(vm)) {
    if (s.type === 'assets') {
      expect(T.chartAssets).toContain(s.color);
    } else {
      expect(T.chartLiabs).toContain(s.color);
    }
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

test('each account series entry has a type field matching assets or liabilities', () => {
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
  const keys = accountSeries(vm).map(s => s.key).sort();
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
  expect(accountSeries(vm)).toHaveLength(3);
});

// ── deep (sub-account) deselection ───────────────────────────────────────────

test('deselecting a deeper sub-account removes it from its second-level parent sum', () => {
  const vm = buildAssets(makeModel(), new Set(['Assets:Savings:Sub']));
  const keys = vm.series.map(s => s.key);
  expect(keys).toContain('Assets:Savings');
  // Savings(10000) alone — Savings:Sub(1000) is deselected
  expect(vm.data[0]['Assets:Savings']).toBe(10000);
});

// ── net-worth series ─────────────────────────────────────────────────────────

test('adds a net-worth series that sums assets and liabilities', () => {
  const vm = buildAssets(makeModel());
  const net = vm.series.find(s => s.type === 'net');
  expect(net).toBeDefined();
  // Savings(11000) + Shares(50000) + Loan(-5000) = 56000
  expect(vm.data[0][net.key]).toBe(56000);
  expect(vm.data[2][net.key]).toBe(11500 + 49000 - 4600);
});

test('net-worth series is flagged as emphasised and rendered last (on top)', () => {
  const vm = buildAssets(makeModel());
  const net = vm.series[vm.series.length - 1];
  expect(net.type).toBe('net');
  expect(net.emphasis).toBe(true);
});

test('net-worth series honours the account filter', () => {
  const vm = buildAssets(makeModel(), new Set(['Assets:Shares']));
  const net = vm.series.find(s => s.type === 'net');
  // Savings(11000) + Loan(-5000) = 6000 — Shares excluded
  expect(vm.data[0][net.key]).toBe(6000);
});

test('maxY covers the net-worth line, not just the largest account series', () => {
  const k = (account, type) => ({ account, type });
  const model = {
    intervals: ['2018-01'],
    balances: new Map([
      [k('Assets:A', 'assets'), [10000]],
      [k('Assets:B', 'assets'), [10000]],
    ]),
    currency: 'USD',
  };
  const vm = buildAssets(model);
  // net = 20000 — an axis scaled to the 10000 account maximum would clip it flat
  expect(vm.maxY).toBeGreaterThanOrEqual(20000);
});

test('minY covers a net worth more negative than any single account', () => {
  const k = (account, type) => ({ account, type });
  const model = {
    intervals: ['2018-01'],
    balances: new Map([
      [k('Liabilities:A', 'liabilities'), [-6000]],
      [k('Liabilities:B', 'liabilities'), [-6000]],
    ]),
    currency: 'USD',
  };
  const vm = buildAssets(model);
  expect(vm.minY).toBeLessThanOrEqual(-12000);
});

test('no net-worth series when there are no account series', () => {
  const vm = buildAssets({ intervals: [], balances: new Map(), currency: 'USD' });
  expect(vm.series).toEqual([]);
});

// ── asOf (as-of date of the totals) ──────────────────────────────────────────

const utc = (iso) => new Date(iso + 'T00:00:00Z');

test('asOf is the last posting date when the window ends at the last interval', () => {
  const vm = buildAssets(makeModel({
    period: 'Monthly',
    sliderValues: [0, 2],
    fullIntervalDates: [utc('2018-01-01'), utc('2018-02-01'), utc('2018-03-01')],
    rawPostings: [{ date: utc('2018-01-05') }, { date: utc('2018-03-17') }],
  }));
  expect(vm.asOf).toEqual(utc('2018-03-17'));
});

test('asOf is the day before the next interval when the window is truncated', () => {
  const vm = buildAssets(makeModel({
    intervals: ['2018-01', '2018-02'],
    period: 'Monthly',
    sliderValues: [0, 1],
    fullIntervalDates: [utc('2018-01-01'), utc('2018-02-01'), utc('2018-03-01')],
    rawPostings: [{ date: utc('2018-03-17') }],
  }));
  expect(vm.asOf).toEqual(utc('2018-02-28'));
});

test('asOf is null when the model carries no postings', () => {
  expect(buildAssets(makeModel()).asOf).toBeNull();
});

// ── stable colours ───────────────────────────────────────────────────────────

test('an account keeps its colour when a different account is deselected', () => {
  const colorOf = (vm, key) => vm.series.find(s => s.key === key).color;
  const full = buildAssets(makeModel());
  const filtered = buildAssets(makeModel(), new Set(['Assets:Savings']));
  // Hiding Savings must not repaint Shares — colour follows the account, not its rank
  expect(colorOf(filtered, 'Assets:Shares')).toBe(colorOf(full, 'Assets:Shares'));
});

// ── totals (summary strip) ───────────────────────────────────────────────────

test('returns totals of the last interval split into assets, liabilities and net', () => {
  const vm = buildAssets(makeModel());
  // last interval: Savings 10400 + Sub 1100 = 11500, Shares 49000, Loan -4600
  expect(vm.totals.assets).toBe(60500);
  expect(vm.totals.liabilities).toBe(-4600);
  expect(vm.totals.net).toBe(55900);
});

test('totals.net equals the last value of the net-worth series', () => {
  const vm = buildAssets(makeModel());
  const net = vm.series.find(s => s.type === 'net');
  expect(vm.totals.net).toBe(vm.data[vm.data.length - 1][net.key]);
});

test('totals follow the account filter', () => {
  const vm = buildAssets(makeModel(), new Set(['Assets:Shares', 'Assets:Savings:Sub']));
  expect(vm.totals.assets).toBe(10400);
  expect(vm.totals.liabilities).toBe(-4600);
  expect(vm.totals.net).toBe(5800);
});

test('totals are zero for empty balances', () => {
  const vm = buildAssets({ intervals: [], balances: new Map(), currency: 'USD' });
  expect(vm.totals).toEqual({ assets: 0, liabilities: 0, net: 0 });
});

// ── buildAssetAccountTree ─────────────────────────────────────────────────────

test('buildAssetAccountTree nests every level of the asset/liability accounts', () => {
  const { balances } = makeModel();
  const tree = buildAssetAccountTree(balances);
  expect(Object.keys(tree).sort()).toEqual(['Assets', 'Liabilities']);
  expect(Object.keys(tree.Assets).sort()).toEqual(['Savings', 'Shares']);
  expect(Object.keys(tree.Assets.Savings)).toEqual(['Sub']);
});

test('buildAssetAccountTree excludes income/expense accounts', () => {
  const { balances } = makeModel();
  const tree = buildAssetAccountTree(balances);
  expect(tree.Expenses).toBeUndefined();
  expect(tree.Income).toBeUndefined();
});

test('buildAssetAccountTree returns an empty object for empty balances', () => {
  expect(buildAssetAccountTree(new Map())).toEqual({});
});
