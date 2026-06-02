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
