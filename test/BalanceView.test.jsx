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
