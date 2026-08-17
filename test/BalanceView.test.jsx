/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BalanceView } from '../src/views/BalanceView';

const roots = [
  { id:'Assets', account:'Assets', balance:1000, type:'assets', children:[
    { id:'Assets:Bank', account:'Assets:Bank', balance:1000, type:'assets', children:[] } ] },
];
test('renders a parent row and expands to show children', async () => {
  render(<BalanceView roots={roots} netWorth={1000} cur="USD" />);
  expect(screen.getByText('Assets')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Assets'));
  expect(screen.getByText(/Bank/)).toBeInTheDocument();
});

test('shows net worth figure with formatted value', () => {
  const { container } = render(<BalanceView roots={roots} netWorth={1000} cur="USD" />);
  expect(screen.getByText('Net Worth')).toBeInTheDocument();
  // money(1000, { cur: 'USD' }) → '$1,000.00' — assert it appears in the tfoot row
  const tfoot = container.querySelector('tfoot');
  expect(within(tfoot).getByText(/1,000/)).toBeInTheDocument();
});

test('child row is not visible before expanding parent', () => {
  render(<BalanceView roots={roots} netWorth={1000} cur="USD" />);
  // Bank should not be visible (parent collapsed by default)
  expect(screen.queryByText('Bank')).not.toBeInTheDocument();
});

// ── Abschnittsüberschriften ─────────────────────────────────────────────────
// Stock figures are as-of the window end, flow figures cover the window range.
// Mixing both in one table without saying so is what made the old (buggy)
// numbers plausible, so the sections must be labelled.

const sections = [
  { id: 'stocks', roots: [
    { id:'Assets', account:'Assets', balance:2400, type:'assets', children:[] },
    { id:'Liabilities', account:'Liabilities', balance:-2000, type:'liabilities', children:[] } ] },
  { id: 'unclassified', roots: [
    { id:'Sonstiges', account:'Sonstiges', balance:50, type:'unknown', children:[] } ] },
  { id: 'flows', roots: [
    { id:'Expenses', account:'Expenses', balance:140, type:'expenses', children:[] } ] },
];

test('renders a heading per section', () => {
  render(<BalanceView sections={sections} netWorth={450} cur="USD" rangeLabel="Jun '26 – Jul '26" />);
  expect(screen.getByText('Balances')).toBeInTheDocument();
  expect(screen.getByText('Unclassified')).toBeInTheDocument();
  expect(screen.getByText('Income & expenses')).toBeInTheDocument();
});

test('the flow section heading carries the date range', () => {
  render(<BalanceView sections={sections} netWorth={450} cur="USD" rangeLabel="Jun '26 – Jul '26" />);
  expect(screen.getByText(/Jun '26 – Jul '26/)).toBeInTheDocument();
});

test('rows still render inside their sections', () => {
  render(<BalanceView sections={sections} netWorth={450} cur="USD" rangeLabel="x" />);
  expect(screen.getByText('Assets')).toBeInTheDocument();
  expect(screen.getByText('Sonstiges')).toBeInTheDocument();
  expect(screen.getByText('Expenses')).toBeInTheDocument();
});

test('falls back to a flat list when no sections are given', () => {
  render(<BalanceView roots={roots} netWorth={1000} cur="USD" />);
  expect(screen.getByText('Assets')).toBeInTheDocument();
  expect(screen.queryByText('Balances')).not.toBeInTheDocument();
});
