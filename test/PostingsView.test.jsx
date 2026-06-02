/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostingsView } from '../src/views/PostingsView';
const rows = [
  { date:'2018-12-25', payee:'Rent Co', account:'Expenses:Rent', amount:700, type:'expense' },
  { date:'2018-12-26', payee:'Acme', account:'Income:Salary', amount:-1000, type:'income' },
];

// Production vocabulary rows — type strings as produced by typeExtractor (plural)
const prodRows = [
  { date:'2018-01-10', payee:'Supermarket', account:'Expenses:Food',    amount:50,    type:'expenses' },
  { date:'2018-01-11', payee:'Employer',    account:'Income:Salary',    amount:-3000, type:'income'   },
  { date:'2018-01-12', payee:'Bank',        account:'Assets:Checking',  amount:3000,  type:'assets'   },
];
test('filters by query prop', () => {
  render(<PostingsView rows={rows} query="rent" typeFilter="all" cur="USD" />);
  expect(screen.getByText('Rent Co')).toBeInTheDocument();
  expect(screen.queryByText('Acme')).not.toBeInTheDocument();
});
test('clicking a column header re-sorts', async () => {
  render(<PostingsView rows={rows} query="" typeFilter="all" cur="USD" />);
  await userEvent.click(screen.getByText(/Payee/i));
  const cells = screen.getAllByText(/Rent Co|Acme/);
  expect(cells[0]).toHaveTextContent('Acme'); // ascending by payee
});

// ── Regression: plural typeExtractor vocabulary ──────────────────────────────
// Ensures typeFilter values match real type strings produced by typeExtractor.
// typeFilter='expenses' must show only rows with type='expenses', hiding 'income' and 'assets'.
test('typeFilter="expenses" shows only plural expenses rows from typeExtractor', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="expenses" cur="USD" />);
  expect(screen.getByText('Supermarket')).toBeInTheDocument();
  expect(screen.queryByText('Employer')).not.toBeInTheDocument();
  expect(screen.queryByText('Bank')).not.toBeInTheDocument();
});

// typeFilter='assets' must show only rows with type='assets', hiding 'expenses' and 'income'.
test('typeFilter="assets" shows only plural assets rows from typeExtractor', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="assets" cur="USD" />);
  expect(screen.getByText('Bank')).toBeInTheDocument();
  expect(screen.queryByText('Supermarket')).not.toBeInTheDocument();
  expect(screen.queryByText('Employer')).not.toBeInTheDocument();
});

// typeFilter='income' still works (plural and singular both equal 'income').
test('typeFilter="income" shows only income rows', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="income" cur="USD" />);
  expect(screen.getByText('Employer')).toBeInTheDocument();
  expect(screen.queryByText('Supermarket')).not.toBeInTheDocument();
  expect(screen.queryByText('Bank')).not.toBeInTheDocument();
});

// typeFilter='all' shows all rows.
test('typeFilter="all" shows all rows regardless of plural type strings', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="all" cur="USD" />);
  expect(screen.getByText('Supermarket')).toBeInTheDocument();
  expect(screen.getByText('Employer')).toBeInTheDocument();
  expect(screen.getByText('Bank')).toBeInTheDocument();
});
