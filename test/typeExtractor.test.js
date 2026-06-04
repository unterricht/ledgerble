const { makeTypeExtractor } = require('../src/data/typeExtractor');
const settings = {
  'options.expenses.regex': '^expenses?(:|$)',
  'options.income.regex': '^(income|revenue)s?(:|$)',
  'options.assets.regex': '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex': '^equity(:|$)',
};
const te = makeTypeExtractor((k) => settings[k]);

test('classifies expenses/income/assets/liabilities/equity', () => {
  expect(te('Expenses:Groceries')).toBe('expenses');
  expect(te('Income:Salary')).toBe('income');
  expect(te('Assets:Savings')).toBe('assets');
  expect(te('Liabilities:Mortgage')).toBe('liabilities');
  expect(te('Equity:Opening')).toBe('equity');
});
test('unknown falls through', () => {
  expect(te('Foo:Bar')).toBe('unknown');
});

test('returns "unknown" instead of throwing when a stored regex is invalid', () => {
  const getSetting = (key) => key === 'options.expenses.regex' ? '^[invalid(' : null;
  const extractor = makeTypeExtractor(getSetting);
  expect(() => extractor('expenses:food')).not.toThrow();
  expect(extractor('expenses:food')).toBe('unknown');
});

test('still classifies correctly after skipping one invalid regex', () => {
  const getSetting = (key) => {
    if (key === 'options.expenses.regex') return '^[bad(';
    if (key === 'options.income.regex') return '^income';
    return null;
  };
  const extractor = makeTypeExtractor(getSetting);
  expect(extractor('income:salary')).toBe('income');
});
