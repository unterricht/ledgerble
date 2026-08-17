const { buildBalanceTree } = require('../src/data/adapters');
// balances: Map<{account,type}, number[]> as compute() returns; use the last interval index.
test('builds a nested account tree with net worth', () => {
  const balances = new Map([
    [{ account:'Assets:Bank', type:'assets' }, [1000]],
    [{ account:'Expenses:Food', type:'expenses' }, [200]],
    [{ account:'Income:Salary', type:'income' }, [-1200]],
  ]);
  const { roots, netWorth } = buildBalanceTree(balances, 0);
  const assets = roots.find(r => r.account === 'Assets');
  expect(assets.balance).toBe(1000);
  expect(assets.children[0].account).toBe('Assets:Bank');
  expect(typeof netWorth).toBe('number');
});

test('net worth includes assets and liabilities only', () => {
  const balances = new Map([
    [{ account:'Assets:Bank', type:'assets' }, [5000]],
    [{ account:'Liabilities:Mortgage', type:'liabilities' }, [-2000]],
    [{ account:'Expenses:Food', type:'expenses' }, [300]],
    [{ account:'Income:Salary', type:'income' }, [-3000]],
    [{ account:'Equity:Opening', type:'equity' }, [-1000]],
  ]);
  const { netWorth } = buildBalanceTree(balances, 0);
  // net worth = assets + liabilities = 5000 + (-2000) = 3000
  expect(netWorth).toBe(3000);
});

test('clamps intervalIdx to last available index when out of range', () => {
  const balances = new Map([
    [{ account:'Assets:Bank', type:'assets' }, [100, 200]],
  ]);
  const { roots } = buildBalanceTree(balances, 99);
  // Should clamp to last index (index 1 = 200)
  expect(roots.find(r => r.account === 'Assets').balance).toBe(200);
});

test('parent node balance is sum of children', () => {
  const balances = new Map([
    [{ account:'Assets:Savings', type:'assets' }, [500]],
    [{ account:'Assets:Checking', type:'assets' }, [300]],
  ]);
  const { roots } = buildBalanceTree(balances, 0);
  const assets = roots.find(r => r.account === 'Assets');
  expect(assets.balance).toBe(800);
  expect(assets.children).toHaveLength(2);
});

test('returns empty roots and zero netWorth for empty balances', () => {
  const { roots, netWorth } = buildBalanceTree(new Map(), 0);
  expect(roots).toEqual([]);
  expect(netWorth).toBe(0);
});

// Pins the root-node type assumption:
// When two sibling leaves share the same top-level prefix (e.g. Assets:Bank and
// Assets:Cash), the ancestor node 'Assets' must have type 'assets' and its
// balance must equal the sum of both leaves. This relies on typeExtractor
// classifying by top-level path prefix, so all children share the root's type.
test('root node type is assets and balance is sum when both siblings are assets', () => {
  const balances = new Map([
    [{ account: 'Assets:Bank', type: 'assets' }, [600]],
    [{ account: 'Assets:Cash', type: 'assets' }, [400]],
  ]);
  const { roots } = buildBalanceTree(balances, 0);
  const assetsRoot = roots.find(r => r.account === 'Assets');
  expect(assetsRoot).toBeDefined();
  expect(assetsRoot.type).toBe('assets');
  expect(assetsRoot.balance).toBe(1000);
  expect(assetsRoot.children).toHaveLength(2);
});

// ── Bestands- vs. Erfolgskonten im Berichtszeitraum ─────────────────────────
// balances[] are CUMULATIVE running totals. For stock accounts (assets,
// liabilities, equity) the window-end value IS the balance sheet figure. For
// flow accounts (income, expenses) the all-time cumulative is wrong — only the
// movement inside the window belongs on the report, so the value carried into
// the window (openingBalances) must be subtracted.

test('flow accounts show only the movement inside the window', () => {
  const expKey = { account: 'Expenses:Alt', type: 'expenses' };
  const newKey = { account: 'Expenses:Neu', type: 'expenses' };
  // window covers 2 intervals; 500 was already spent before it started
  const balances = new Map([
    [expKey, [500, 500]],
    [newKey, [40, 140]],
  ]);
  const openingBalances = new Map([[expKey, 500], [newKey, 0]]);
  const { roots } = buildBalanceTree(balances, 1, { openingBalances });
  const expenses = roots.find(r => r.account === 'Expenses');
  // 640 cumulative − 500 carried in = 140 in-period
  expect(expenses.balance).toBe(140);
  // the untouched account drops out entirely (value 0)
  expect(expenses.children.map(c => c.account)).toEqual(['Expenses:Neu']);
});

test('flow movement inside the FIRST window interval is not lost', () => {
  // arr[0] already contains the first interval's own flow, so the delta can
  // never be arr[last] - arr[0] — it must use the pre-window opening value.
  const key = { account: 'Expenses:Neu', type: 'expenses' };
  const balances = new Map([[key, [40, 140]]]);
  const { roots } = buildBalanceTree(balances, 1, { openingBalances: new Map([[key, 0]]) });
  expect(roots.find(r => r.account === 'Expenses').balance).toBe(140);
});

test('stock accounts ignore openingBalances and keep the as-of balance', () => {
  const bank = { account: 'Assets:Bank', type: 'assets' };
  const loan = { account: 'Liabilities:Kredit', type: 'liabilities' };
  const eq   = { account: 'Equity:Starting Balance', type: 'equity' };
  const balances = new Map([[bank, [2400, 2400]], [loan, [-2000, -2000]], [eq, [-1000, -1000]]]);
  const openingBalances = new Map([[bank, 2440], [loan, -2000], [eq, -1000]]);
  const { roots, netWorth } = buildBalanceTree(balances, 1, { openingBalances });
  expect(roots.find(r => r.account === 'Assets').balance).toBe(2400);
  expect(roots.find(r => r.account === 'Liabilities').balance).toBe(-2000);
  expect(roots.find(r => r.account === 'Equity').balance).toBe(-1000);
  expect(netWorth).toBe(400);
});

test('window starting at the first interval subtracts nothing (no NaN)', () => {
  const key = { account: 'Expenses:Neu', type: 'expenses' };
  const balances = new Map([[key, [40, 140]]]);
  // lo === 0 → compute() supplies 0 for every key
  const { roots } = buildBalanceTree(balances, 1, { openingBalances: new Map([[key, 0]]) });
  const v = roots.find(r => r.account === 'Expenses').balance;
  expect(typeof v).toBe('number');
  expect(Number.isNaN(v)).toBe(false);
  expect(v).toBe(140);
});

test('a flow key missing from openingBalances is treated as zero carried in', () => {
  const key = { account: 'Income:Gehalt', type: 'income' };
  const balances = new Map([[key, [-300]]]);
  const { roots } = buildBalanceTree(balances, 0, { openingBalances: new Map() });
  expect(roots.find(r => r.account === 'Income').balance).toBe(-300);
});

test('net worth is identical with and without openingBalances', () => {
  const balances = new Map([
    [{ account: 'Assets:Bank', type: 'assets' }, [5000, 5000]],
    [{ account: 'Liabilities:Mortgage', type: 'liabilities' }, [-2000, -2000]],
    [{ account: 'Expenses:Food', type: 'expenses' }, [300, 900]],
    [{ account: 'Income:Salary', type: 'income' }, [-3000, -3000]],
  ]);
  const opening = new Map(Array.from(balances.keys()).map(k => [k, balances.get(k)[0]]));
  const a = buildBalanceTree(balances, 1).netWorth;
  const b = buildBalanceTree(balances, 1, { openingBalances: opening }).netWorth;
  expect(a).toBe(b);
  expect(a).toBe(3000);
});

// ── Nicht klassifizierte Konten ─────────────────────────────────────────────
// An account matching none of the five type regexes was rendered in the tree
// but silently omitted from net worth — a bank account whose name misses the
// assets regex made net worth too low with no visible hint.

test('unclassified accounts count towards net worth', () => {
  const balances = new Map([
    [{ account: 'Assets:Bank', type: 'assets' }, [1000]],
    [{ account: 'Liabilities:Kredit', type: 'liabilities' }, [-400]],
    [{ account: 'Sonstiges:Kram', type: 'unknown' }, [50]],
  ]);
  expect(buildBalanceTree(balances, 0).netWorth).toBe(650);
});

test('unclassified accounts stay in their own section, never in stocks', () => {
  const balances = new Map([
    [{ account: 'Assets:Bank', type: 'assets' }, [1000]],
    [{ account: 'Sonstiges:Kram', type: 'unknown' }, [50]],
  ]);
  const { sections } = buildBalanceTree(balances, 0);
  const byId = Object.fromEntries(sections.map(s => [s.id, s.roots.map(r => r.account)]));
  expect(byId.stocks).toEqual(['Assets']);
  expect(byId.unclassified).toEqual(['Sonstiges']);
});

test('an unexpected type falls into unclassified rather than being dropped', () => {
  const balances = new Map([
    [{ account: 'Weird:Thing', type: 'something-else' }, [7]],
  ]);
  const { sections, roots } = buildBalanceTree(balances, 0);
  expect(roots.map(r => r.account)).toEqual(['Weird']);
  const unclassified = sections.find(s => s.id === 'unclassified');
  expect(unclassified.roots.map(r => r.account)).toEqual(['Weird']);
});

// ── Sections ────────────────────────────────────────────────────────────────

test('sections group roots by stock / unclassified / flow in a fixed order', () => {
  const balances = new Map([
    [{ account: 'Expenses:Food', type: 'expenses' }, [300]],
    [{ account: 'Equity:Opening', type: 'equity' }, [-1000]],
    [{ account: 'Sonstiges:Kram', type: 'unknown' }, [50]],
    [{ account: 'Income:Salary', type: 'income' }, [-3000]],
    [{ account: 'Liabilities:Kredit', type: 'liabilities' }, [-400]],
    [{ account: 'Assets:Bank', type: 'assets' }, [1000]],
  ]);
  const { sections } = buildBalanceTree(balances, 0);
  expect(sections.map(s => s.id)).toEqual(['stocks', 'unclassified', 'flows']);
  expect(sections[0].roots.map(r => r.account)).toEqual(['Assets', 'Liabilities', 'Equity']);
  expect(sections[2].roots.map(r => r.account)).toEqual(['Income', 'Expenses']);
});

test('empty sections are omitted', () => {
  const balances = new Map([[{ account: 'Assets:Bank', type: 'assets' }, [1000]]]);
  const { sections } = buildBalanceTree(balances, 0);
  expect(sections.map(s => s.id)).toEqual(['stocks']);
});

test('empty balances yield no sections', () => {
  expect(buildBalanceTree(new Map(), 0).sections).toEqual([]);
});
