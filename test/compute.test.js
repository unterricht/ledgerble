const { compute } = require('../src/data/compute');
const { makeTypeExtractor } = require('../src/data/typeExtractor');

const te = makeTypeExtractor((k) => ({
  'options.expenses.regex': '^expenses?(:|$)',
  'options.income.regex': '^(income|revenue)s?(:|$)',
  'options.assets.regex': '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex': '^equity(:|$)',
}[k]));

function p(date, accounts, amount, currency = 'USD') {
  return { date, accounts, amount, currency };
}
const postings = [
  p('2018-01-15', ['Income','Salary'], -1000),
  p('2018-01-15', ['Assets','Bank'], 1000),
  p('2018-02-10', ['Expenses','Food'], 200),
  p('2018-02-10', ['Assets','Bank'], -200),
];

test('compute returns typed, date-bucketed postings and a base currency', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.currency).toBe('USD');
  expect(m.postings.every(x => x.type)).toBe(true);
  expect(m.intervals.length).toBeGreaterThan(0);
  const food = m.postings.find(x => x.accounts.join(':') === 'Expenses:Food');
  expect(food.type).toBe('expenses');
});

test('compute returns correct intervals for Monthly period', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  // Jan and Feb 2018
  expect(m.intervals).toContain('2018-01');
  expect(m.intervals).toContain('2018-02');
  expect(m.intervalDates.length).toBe(m.intervals.length);
});

test('compute returns rawPostings (unfiltered by date) and postings (date-filtered)', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  // With dateRange: null both should be full set (all base-currency postings)
  expect(m.rawPostings.length).toBeGreaterThan(0);
  expect(m.postings.length).toBe(m.rawPostings.length);
});

test('compute dateRange filters postings correctly', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  // Restrict to only first interval (January = index 0)
  const restricted = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: [0, 0], typeExtractor: te });
  // Only January postings should be in postings (date-filtered)
  expect(restricted.postings.length).toBeGreaterThan(0);
  expect(restricted.postings.every(x => x.dateString.startsWith('2018-01'))).toBe(true);
  // The Feb 'Expenses:Food' posting must be absent from postings
  const food = restricted.postings.find(x => x.accounts.join(':') === 'Expenses:Food');
  expect(food).toBeUndefined();
  // rawPostings must still contain all 4 postings (unfiltered by date)
  expect(restricted.rawPostings.length).toBe(4);
});

test('compute returns balances map keyed by BalanceKey objects', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.balances).toBeInstanceOf(Map);
  expect(m.balances.size).toBeGreaterThan(0);
  // Each value should be a numeric array of length == intervals.length
  for (const [key, amounts] of m.balances) {
    expect(Array.isArray(amounts)).toBe(true);
    expect(amounts.length).toBe(m.intervals.length);
    expect(key.account).toBeDefined();
  }
});

test('compute returns currencies array and accountTree', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  // currencies must be an Array (not a Set) so downstream .map() calls work
  expect(Array.isArray(m.currencies)).toBe(true);
  expect(m.currencies).toContain('USD');
  expect(typeof m.accountTree).toBe('object');
  expect(m.valResult).toBeDefined();
  expect(m.sliderValues).toHaveLength(2);
  expect(m.sliderValues[0]).toBe(0);
  expect(m.sliderValues[1]).toBe(m.intervals.length - 1);
});

test('compute handles empty files map gracefully', () => {
  const files = new Map();
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.postings).toHaveLength(0);
  expect(m.intervals).toHaveLength(0);
  expect(m.balances.size).toBe(0);
});

test('compute decorates postings with accountsFmtd and dateFmtd', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  const first = m.postings[0];
  expect(typeof first.accountsFmtd).toBe('function');
  expect(typeof first.dateFmtd).toBe('function');
  expect(first.accountsFmtd()).toBe(first.accounts.join(':'));
});

test('compute balances: Assets:Bank cumulative array is 1000 after Jan, 800 after Feb', () => {
  // Income:Salary -1000 (Jan) → Assets:Bank +1000 (Jan)
  // Expenses:Food +200 (Feb) → Assets:Bank -200 (Feb)
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });

  // Locate the BalanceKey whose account is 'Assets:Bank'
  let bankAmounts = null;
  for (const [key, amounts] of m.balances) {
    if (key.account === 'Assets:Bank') {
      bankAmounts = amounts;
      break;
    }
  }
  expect(bankAmounts).not.toBeNull();
  // intervals should be ['2018-01', '2018-02']
  expect(m.intervals).toEqual(['2018-01', '2018-02']);
  // Cumulative: after Jan = 1000, after Feb = 1000 + (-200) = 800
  expect(bankAmounts[0]).toBe(1000);
  expect(bankAmounts[1]).toBe(800);
});

test('compute applies deselected accounts to the returned postings (not just balances)', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(['Expenses:Food']), dateRange: null, typeExtractor: te });
  // The deselected expense account must be filtered out of the postings used by the views.
  expect(m.postings.find(x => x.accounts.join(':') === 'Expenses:Food')).toBeUndefined();
  // Non-deselected postings remain.
  expect(m.postings.find(x => x.accounts.join(':') === 'Income:Salary')).toBeDefined();
});

test('compute keeps deselected accounts in the accountTree so their checkbox stays toggleable', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(['Expenses:Food']), dateRange: null, typeExtractor: te });
  // accountTree must still list the deselected account (built from the date-filtered, NOT account-filtered set).
  expect(m.accountTree.Expenses).toBeDefined();
  expect(m.accountTree.Expenses.Food).toBeDefined();
});

test('compute exposes period and an intervalKeyFn matching the interval keys', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Yearly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.period).toBe('Yearly');
  expect(typeof m.intervalKeyFn).toBe('function');
  // The key produced for a posting date must be a member of the intervals list.
  const key = m.intervalKeyFn(new Date('2018-02-10T00:00:00Z'));
  expect(m.intervals).toContain(key);
  expect(key).toBe('2018');
});

test('compute resolves the display currency to a real currency, never a stock ticker', () => {
  // Mirrors test-euro.ledger: a VWRD.L holding priced in € plus a € cash leg.
  // detectBaseCurrency() ties on frequency and may pick the ticker; the display
  // currency must still fall back to a real currency (€), not "VWRD.L".
  const euroPostings = [
    { date: '2024-01-25', accounts: ['Assets', 'Depot'], amount: 3.608, currency: 'VWRD.L', commodity: 'VWRD.L' },
    { date: '2024-01-25', accounts: ['Assets', 'Investment'], amount: -399.91, currency: '€' },
  ];
  const prices = [{ commodity: 'VWRD.L', date: '2024-01-25', price: '110.84', priceCommodity: '€' }];
  const files = new Map([['j', { postings: euroPostings, postingsCost: [], prices }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.currency).toBe('€');
  expect(m.currencies).toContain('€');
  expect(m.currencies).not.toContain('VWRD.L');
});

test('compute flags hasPortfolio when a non-currency commodity (stock) is held', () => {
  // VWRD.L bought for EUR → a stock holding exists → portfolio relevant.
  const stockPostings = [
    { date: '2024-01-01', accounts: ['Assets', 'Depot'], amount: 1, currency: 'VWRD.L', commodity: 'VWRD.L', price: 100, priceCurrency: 'EUR' },
    { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: -100, currency: 'EUR' },
  ];
  const stockCost = [
    { date: '2024-01-01', accounts: ['Assets', 'Depot'], amount: 100, currency: 'EUR' },
    { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: -100, currency: 'EUR' },
  ];
  const prices = [{ commodity: 'VWRD.L', date: '2024-01-01', price: '100', priceCommodity: 'EUR' }];
  const files = new Map([['j', { postings: stockPostings, postingsCost: stockCost, prices }]]);
  const m = compute({ files, currency: 'EUR', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.hasPortfolio).toBe(true);
});

test('compute clears hasPortfolio for a pure-cash ledger (no stocks)', () => {
  const files = new Map([['j', { postings, postingsCost: [], prices: [] }]]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });
  expect(m.hasPortfolio).toBe(false);
});

test('compute multi-file merge: postings from both files combined, balances correct', () => {
  // Split the synthetic journal across two files:
  //   file 'a': Income:Salary + Assets:Bank (Jan)
  //   file 'b': Expenses:Food + Assets:Bank (Feb)
  const postingsA = [
    p('2018-01-15', ['Income', 'Salary'], -1000),
    p('2018-01-15', ['Assets', 'Bank'], 1000),
  ];
  const postingsB = [
    p('2018-02-10', ['Expenses', 'Food'], 200),
    p('2018-02-10', ['Assets', 'Bank'], -200),
  ];
  const files = new Map([
    ['a', { postings: postingsA, postingsCost: [], prices: [] }],
    ['b', { postings: postingsB, postingsCost: [], prices: [] }],
  ]);
  const m = compute({ files, currency: 'USD', period: 'Monthly', deselectedAccounts: new Set(), dateRange: null, typeExtractor: te });

  // All 4 postings should be merged
  expect(m.rawPostings.length).toBe(4);

  // Assets:Bank cumulative balance must still be 1000 → 800
  let bankAmounts = null;
  for (const [key, amounts] of m.balances) {
    if (key.account === 'Assets:Bank') {
      bankAmounts = amounts;
      break;
    }
  }
  expect(bankAmounts).not.toBeNull();
  expect(bankAmounts[0]).toBe(1000);
  expect(bankAmounts[1]).toBe(800);
});
