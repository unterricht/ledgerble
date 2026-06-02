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
