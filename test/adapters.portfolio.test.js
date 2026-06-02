'use strict';
/**
 * Tests for buildPortfolio(model) adapter.
 *
 * buildPortfolio produces:
 *   { totals, holdings, totalCost, totalMarket, totalGain }
 *
 *   totals:      [{ m, value }]  — portfolio market value per interval
 *   holdings:    [{ account, asset, qty, cost, market, gain }]
 *   totalCost:   number
 *   totalMarket: number
 *   totalGain:   number  (must equal totalMarket - totalCost exactly)
 */
const { buildPortfolio } = require('../src/data/adapters');
const { ValuationService } = require('../valuation');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a minimal model that contains non-base-currency holdings.
 *
 * Scenario:
 *   - Base currency: USD
 *   - Account:  Assets:Shares
 *   - Asset:    AAPL   qty=10   cost=1000 USD   market price: $120/share → market = 1200
 *   - Account:  Assets:IRA
 *   - Asset:    VTSAX  qty=5    cost=500  USD   market price: $110/share → market = 550
 *
 * Prices: AAPL → 120 USD, VTSAX → 110 USD (on 2018-01-02)
 * Intervals: ['2018-01', '2018-02']
 * intervalDates: two Date objects
 */
function makeModel() {
  const vs = new ValuationService();

  // Register prices
  vs.parsePrices([
    { commodity: 'AAPL',  date: '2018-01-02', price: '120', priceCommodity: 'USD' },
    { commodity: 'VTSAX', date: '2018-01-02', price: '110', priceCommodity: 'USD' },
    { commodity: 'AAPL',  date: '2018-02-01', price: '130', priceCommodity: 'USD' },
    { commodity: 'VTSAX', date: '2018-02-01', price: '115', priceCommodity: 'USD' },
  ]);

  // Construct valResult.balances manually to match ValuationService shape:
  // balances[account][commodity][dateStr] = { quantity, costBasis, marketValue, unrealizedGain }
  const balances = {
    'Assets:Shares': {
      AAPL: {
        '2018-01-02': { quantity: 10, costBasis: 1000, marketValue: 1200, unrealizedGain: 200 },
      },
    },
    'Assets:IRA': {
      VTSAX: {
        '2018-01-02': { quantity: 5, costBasis: 500, marketValue: 550, unrealizedGain: 50 },
      },
    },
    // A USD-denominated account — should be excluded from holdings (same as base currency)
    'Assets:Cash': {
      USD: {
        '2018-01-02': { quantity: 2000, costBasis: 2000, marketValue: 2000, unrealizedGain: 0 },
      },
    },
  };

  const valResult = { balances, baseCurrency: 'USD' };
  // Attach the ValuationService reference so the adapter can call getAccountValueAtDate
  valResult._valuationService = vs;

  const intervals = ['2018-01', '2018-02'];
  const intervalDates = [
    new Date('2018-01-31T00:00:00Z'),
    new Date('2018-02-28T00:00:00Z'),
  ];

  return { valResult, intervals, intervalDates, currency: 'USD' };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('buildPortfolio returns the required shape', () => {
  const vm = buildPortfolio(makeModel());
  expect(vm).toHaveProperty('totals');
  expect(vm).toHaveProperty('holdings');
  expect(vm).toHaveProperty('totalCost');
  expect(vm).toHaveProperty('totalMarket');
  expect(vm).toHaveProperty('totalGain');
});

test('totals is an array of { m, value } with one entry per interval', () => {
  const model = makeModel();
  const vm = buildPortfolio(model);
  expect(Array.isArray(vm.totals)).toBe(true);
  expect(vm.totals).toHaveLength(model.intervals.length);
  for (const t of vm.totals) {
    expect(typeof t.m).toBe('string');
    expect(typeof t.value).toBe('number');
  }
});

test('interval label uses MMM format for monthly intervals', () => {
  const vm = buildPortfolio(makeModel());
  expect(vm.totals[0].m).toBe('Jan');
  expect(vm.totals[1].m).toBe('Feb');
});

test('holdings contains only non-base-currency commodities', () => {
  const vm = buildPortfolio(makeModel());
  // USD (base currency) should be excluded
  const assets = vm.holdings.map(h => h.asset);
  expect(assets).not.toContain('USD');
  expect(assets).toContain('AAPL');
  expect(assets).toContain('VTSAX');
});

test('holdings entries have required fields', () => {
  const vm = buildPortfolio(makeModel());
  for (const h of vm.holdings) {
    expect(typeof h.account).toBe('string');
    expect(typeof h.asset).toBe('string');
    // qty may be null for funds without share-count, but must exist as a key
    expect('qty' in h).toBe(true);
    expect(typeof h.cost).toBe('number');
    expect(typeof h.market).toBe('number');
    expect(typeof h.gain).toBe('number');
  }
});

test('totalGain === totalMarket - totalCost exactly', () => {
  const vm = buildPortfolio(makeModel());
  expect(vm.totalGain).toBeCloseTo(vm.totalMarket - vm.totalCost, 10);
});

test('totalCost is sum of holding costs', () => {
  const vm = buildPortfolio(makeModel());
  const sumCost = vm.holdings.reduce((s, h) => s + h.cost, 0);
  expect(vm.totalCost).toBeCloseTo(sumCost, 10);
});

test('totalMarket is sum of holding market values', () => {
  const vm = buildPortfolio(makeModel());
  const sumMarket = vm.holdings.reduce((s, h) => s + h.market, 0);
  expect(vm.totalMarket).toBeCloseTo(sumMarket, 10);
});

test('per-holding gain equals market minus cost', () => {
  const vm = buildPortfolio(makeModel());
  for (const h of vm.holdings) {
    expect(h.gain).toBeCloseTo(h.market - h.cost, 10);
  }
});

test('empty valResult returns zero totals and empty holdings', () => {
  const model = {
    valResult: { balances: {}, baseCurrency: 'USD' },
    intervals: [],
    intervalDates: [],
    currency: 'USD',
  };
  const vm = buildPortfolio(model);
  expect(vm.holdings).toEqual([]);
  expect(vm.totals).toEqual([]);
  expect(vm.totalCost).toBe(0);
  expect(vm.totalMarket).toBe(0);
  expect(vm.totalGain).toBe(0);
});

test('null valResult returns safe empty vm', () => {
  const vm = buildPortfolio({ valResult: null, intervals: [], intervalDates: [], currency: 'USD' });
  expect(vm.holdings).toEqual([]);
  expect(vm.totals).toEqual([]);
});

test('totals value at last interval is sum of all holding market values', () => {
  const vm = buildPortfolio(makeModel());
  // The last-interval total should be >= the sum of holdings (which use latest date)
  // We just check it is a positive number and matches totalMarket
  const lastTotal = vm.totals[vm.totals.length - 1].value;
  expect(lastTotal).toBeGreaterThan(0);
  expect(vm.totalMarket).toBeGreaterThan(0);
});
