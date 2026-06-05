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

  // Register prices — two dates so we can assert re-pricing between intervals:
  //   AAPL:  $120 on 2018-01-02, $130 on 2018-02-01
  //   VTSAX: $110 on 2018-01-02, $115 on 2018-02-01
  vs.parsePrices([
    { commodity: 'AAPL',  date: '2018-01-02', price: '120', priceCommodity: 'USD' },
    { commodity: 'VTSAX', date: '2018-01-02', price: '110', priceCommodity: 'USD' },
    { commodity: 'AAPL',  date: '2018-02-01', price: '130', priceCommodity: 'USD' },
    { commodity: 'VTSAX', date: '2018-02-01', price: '115', priceCommodity: 'USD' },
  ]);

  // Construct valResult.balances manually to match ValuationService shape:
  // balances[account][commodity][dateStr] = { quantity, costBasis, marketValue, unrealizedGain }
  // Snapshot marketValues use transaction-date prices (120/110), not interval-end prices.
  const balances = {
    'Assets:Shares': {
      AAPL: {
        '2018-01-02': { quantity: 10, costBasis: 1000, marketValue: 1200, unrealizedGain: 200, costCurrency: 'USD' },
      },
    },
    'Assets:IRA': {
      VTSAX: {
        '2018-01-02': { quantity: 5, costBasis: 500, marketValue: 550, unrealizedGain: 50, costCurrency: 'USD' },
      },
    },
    // A USD-denominated account — should be excluded from holdings (same as base currency)
    'Assets:Cash': {
      USD: {
        '2018-01-02': { quantity: 2000, costBasis: 2000, marketValue: 2000, unrealizedGain: 0, costCurrency: 'USD' },
      },
    },
  };

  const valResult = { balances, baseCurrency: 'USD' };

  const intervals = ['2018-01', '2018-02'];
  const intervalDates = [
    new Date('2018-01-31T00:00:00Z'),
    new Date('2018-02-28T00:00:00Z'),
  ];

  // Expose valuationService at model level (not valResult) — this is what buildPortfolio reads.
  return { valResult, valuationService: vs, intervals, intervalDates, currency: 'USD' };
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
  const lastTotal = vm.totals[vm.totals.length - 1].value;
  // intervalDate for '2018-02' = 2018-02-28.
  // Re-priced at interval-end via getAccountValueAtDate:
  //   AAPL:  qty=10, nearest prior price = $130 (2018-02-01) → 10 × 130 = 1300
  //   VTSAX: qty=5,  nearest prior price = $115 (2018-02-01) →  5 × 115 =  575
  //   total = 1875
  expect(lastTotal).toBe(1875);
});

test('totals first interval is re-priced at interval-end date', () => {
  const vm = buildPortfolio(makeModel());
  const firstTotal = vm.totals[0].value;
  // intervalDate for '2018-01' = 2018-01-31.
  // Re-priced at interval-end via getAccountValueAtDate:
  //   AAPL:  qty=10, nearest prior price = $120 (2018-01-02) → 10 × 120 = 1200
  //   VTSAX: qty=5,  nearest prior price = $110 (2018-01-02) →  5 × 110 =  550
  //   total = 1750
  expect(firstTotal).toBe(1750);
});

test('totals second interval reflects price movement (re-priced > first interval)', () => {
  const vm = buildPortfolio(makeModel());
  // Prices moved up from Jan to Feb: AAPL 120→130, VTSAX 110→115
  // So Feb total (1875) > Jan total (1750) even though no new transactions occurred.
  expect(vm.totals[1].value).toBeGreaterThan(vm.totals[0].value);
});

test('buildPortfolio returns maxY and grid for chart scale', () => {
  const vm = buildPortfolio(makeModel());
  expect(typeof vm.maxY).toBe('number');
  expect(vm.maxY).toBeGreaterThan(0);
  expect(Array.isArray(vm.grid)).toBe(true);
  expect(vm.grid.length).toBeGreaterThan(0);
  expect(vm.grid[0]).toBe(0);
});

test('sold-out position (quantity === 0) is excluded from holdings', () => {
  const model = makeModel();
  // Add a sold-out position to the balances
  model.valResult.balances['Assets:Old'] = {
    SOLD: {
      '2018-01-02': { quantity: 0, costBasis: 0, marketValue: 0, unrealizedGain: 0, costCurrency: 'USD' },
    },
  };
  const vm = buildPortfolio(model);
  const assets = vm.holdings.map(h => h.asset);
  expect(assets).not.toContain('SOLD');
  // The original holdings are still present
  expect(assets).toContain('AAPL');
  expect(assets).toContain('VTSAX');
});

// ── portfolioFirstKey and totals trimming ────────────────────────────────────

test('buildPortfolio returns portfolioFirstKey = null when model is empty', () => {
  const { portfolioFirstKey } = buildPortfolio(null);
  expect(portfolioFirstKey).toBeNull();
});

test('buildPortfolio trims totals to start at first non-zero value', () => {
  const vs = new ValuationService();
  vs.parsePrices([
    { commodity: 'AAPL', date: '2018-03-01', price: '100', priceCommodity: 'USD' },
  ]);
  const balances = {
    'Assets:Shares': {
      AAPL: {
        '2018-03-01': { quantity: 10, costBasis: 1000, marketValue: 1000, unrealizedGain: 0, costCurrency: 'USD' },
      },
    },
  };
  const model = {
    currency: 'USD',
    period: 'Monthly',
    intervals:     ['2018-01', '2018-02', '2018-03'],
    intervalDates: [
      new Date('2018-01-01T00:00:00Z'),
      new Date('2018-02-01T00:00:00Z'),
      new Date('2018-03-01T00:00:00Z'),
    ],
    valResult: { balances, baseCurrency: 'USD' },
    valuationService: vs,
  };

  const { totals, portfolioFirstKey } = buildPortfolio(model);

  expect(totals).toHaveLength(1);
  expect(totals[0].key).toBe('2018-03');
  expect(portfolioFirstKey).toBe('2018-03');
});

test('buildPortfolio sets portfolioFirstKey = first interval when all values > 0 from start', () => {
  const { totals, portfolioFirstKey } = buildPortfolio(makeModel());
  expect(portfolioFirstKey).toBe(totals[0].key);
  expect(totals).toHaveLength(2);
});
