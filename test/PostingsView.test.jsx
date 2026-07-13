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
test('table is tagged rd-postings so print CSS can set per-column widths', () => {
  const { container } = render(<PostingsView rows={rows} query="" typeFilter="all" cur="USD" />);
  expect(container.querySelector('table.rd-postings')).not.toBeNull();
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

// typeFilter='assets' (Kontenbewegungen) is the raw journal view — shows all rows.
test('typeFilter="assets" (Kontenbewegungen) shows all rows as raw journal view', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="assets" cur="USD" />);
  expect(screen.getByText('Bank')).toBeInTheDocument();
  expect(screen.getByText('Supermarket')).toBeInTheDocument();
  expect(screen.getByText('Employer')).toBeInTheDocument();
});

// typeFilter='income' still works (plural and singular both equal 'income').
test('typeFilter="income" shows only income rows', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="income" cur="USD" />);
  expect(screen.getByText('Employer')).toBeInTheDocument();
  expect(screen.queryByText('Supermarket')).not.toBeInTheDocument();
  expect(screen.queryByText('Bank')).not.toBeInTheDocument();
});

test('shows note text below payee when note is non-empty', () => {
  const rowsWithNote = [
    { date: '2024-01-01', payee: 'Amazon', account: 'Expenses:Food', amount: 58.19, type: 'expenses', note: 'Bleistifte für Erste Klasse' },
  ];
  render(<PostingsView rows={rowsWithNote} query="" typeFilter="all" cur="EUR" />);
  expect(screen.getByText('Bleistifte für Erste Klasse')).toBeInTheDocument();
});

test('does not render note when note is empty string', () => {
  const rowsNoNote = [
    { date: '2024-01-01', payee: 'Amazon', account: 'Expenses:Food', amount: 10, type: 'expenses', note: '' },
  ];
  render(<PostingsView rows={rowsNoNote} query="" typeFilter="all" cur="EUR" />);
  expect(screen.queryByTestId('posting-note')).not.toBeInTheDocument();
});

// typeFilter='all' shows only expenses/income — assets/liabilities are counter-postings hidden from default view.
test('typeFilter="all" shows expenses and income but hides asset counter-postings', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="all" cur="USD" />);
  expect(screen.getByText('Supermarket')).toBeInTheDocument();
  expect(screen.getByText('Employer')).toBeInTheDocument();
  expect(screen.queryByText('Bank')).not.toBeInTheDocument();
});

// ── Gesamt-Zeile (total row of visible/filtered postings) ────────────────────
test('shows a total row summing the visible postings (income positive, expense negative)', () => {
  render(<PostingsView rows={rows} query="" typeFilter="all" cur="USD" />);
  // rows: expense 700 (-> -700) + income -1000 (-> +1000) = +300
  expect(screen.getByText('Total')).toBeInTheDocument();
  expect(screen.getByTestId('postings-total')).toHaveTextContent('+$300.00');
});

test('total row recomputes from the text-filtered subset, not all rows', () => {
  render(<PostingsView rows={rows} query="rent" typeFilter="all" cur="USD" />);
  // only the Rent Co expense row (700) is visible -> -700
  expect(screen.getByTestId('postings-total')).toHaveTextContent('−$700.00');
});

test('total row recomputes from the type-filtered subset', () => {
  render(<PostingsView rows={prodRows} query="" typeFilter="expenses" cur="USD" />);
  // only the Supermarket expenses row (50) is visible -> -50
  expect(screen.getByTestId('postings-total')).toHaveTextContent('−$50.00');
});

test('no total row is shown when the filtered result is empty', () => {
  render(<PostingsView rows={rows} query="nonexistent-payee" typeFilter="all" cur="USD" />);
  expect(screen.queryByText('Total')).not.toBeInTheDocument();
  expect(screen.queryByTestId('postings-total')).not.toBeInTheDocument();
});
