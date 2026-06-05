const { filterPostings, sortPostings } = require('../src/data/postingsFilter');

const rows = [
  { date: '2018-12-25', payee: 'Rent Co', account: 'Expenses:Rent', amount: 700, type: 'expense' },
  { date: '2018-12-26', payee: 'Acme', account: 'Income:Salary', amount: -1000, type: 'income' },
  { date: '2018-12-24', payee: 'Shop', account: 'Expenses:Food', amount: 50, type: 'expense' },
];

const rowsWithCounterpostings = [
  { date: '2018-12-25', payee: 'Rent Co', account: 'Expenses:Rent', amount: 700, type: 'expenses' },
  { date: '2018-12-25', payee: 'Rent Co', account: 'Assets:Banking:Girokonto', amount: -700, type: 'assets' },
  { date: '2018-12-26', payee: 'Acme', account: 'Income:Salary', amount: -1000, type: 'income' },
  { date: '2018-12-26', payee: 'Acme', account: 'Assets:Banking:Girokonto', amount: 1000, type: 'assets' },
  { date: '2019-01-10', payee: 'Card Co', account: 'Expenses:Food', amount: 50, type: 'expenses' },
  { date: '2019-01-10', payee: 'Card Co', account: 'Liabilities:CreditCard', amount: -50, type: 'liabilities' },
];

test('search matches payee, account, or date (case-insensitive)', () => {
  expect(filterPostings(rows, 'rent', 'all').map(r => r.payee)).toEqual(['Rent Co']);
  expect(filterPostings(rows, 'salary', 'all')).toHaveLength(1);
  expect(filterPostings(rows, '2018-12-24', 'all')).toHaveLength(1);
});

test('type filter narrows by type', () => {
  expect(filterPostings(rows, '', 'income')).toHaveLength(1);
});

test('sortPostings by date descending', () => {
  const out = sortPostings(rows, 'date', 'desc');
  expect(out.map(r => r.date)).toEqual(['2018-12-26', '2018-12-25', '2018-12-24']);
});

test('sortPostings by date ascending', () => {
  const out = sortPostings(rows, 'date', 'asc');
  expect(out.map(r => r.date)).toEqual(['2018-12-24', '2018-12-25', '2018-12-26']);
});

test('sortPostings by amount ascending (numeric)', () => {
  const out = sortPostings(rows, 'amount', 'asc');
  expect(out.map(r => r.amount)).toEqual([-1000, 50, 700]);
});

test('sortPostings by amount descending (numeric)', () => {
  const out = sortPostings(rows, 'amount', 'desc');
  expect(out.map(r => r.amount)).toEqual([700, 50, -1000]);
});

test('sortPostings by payee ascending', () => {
  const out = sortPostings(rows, 'payee', 'asc');
  expect(out.map(r => r.payee)).toEqual(['Acme', 'Rent Co', 'Shop']);
});

test('combined search and type filter', () => {
  // 'expenses' matches account for both expense rows; type=expense keeps expenses only
  const out = filterPostings(rows, 'expenses', 'expense');
  expect(out).toHaveLength(2);
  expect(out.every(r => r.type === 'expense')).toBe(true);
});

test('empty query with all type returns all rows', () => {
  expect(filterPostings(rows, '', 'all')).toHaveLength(3);
});

test('no match returns empty array', () => {
  expect(filterPostings(rows, 'zzznomatch', 'all')).toHaveLength(0);
});

test("'all' zeigt nur expenses/income — keine Gegenbuchungen (assets/liabilities)", () => {
  const result = filterPostings(rowsWithCounterpostings, '', 'all');
  expect(result.every(r => r.type === 'expenses' || r.type === 'income')).toBe(true);
  expect(result).toHaveLength(3);
});

test("'assets' (Kontenbewegungen) zeigt assets und liabilities, aber keine expenses/income", () => {
  const result = filterPostings(rowsWithCounterpostings, '', 'assets');
  expect(result.every(r => r.type === 'assets' || r.type === 'liabilities')).toBe(true);
  expect(result).toHaveLength(3);
});

test('sortPostings does not mutate input', () => {
  const original = rows.map(r => ({ ...r }));
  sortPostings(rows, 'date', 'desc');
  expect(rows.map(r => r.date)).toEqual(original.map(r => r.date));
});
