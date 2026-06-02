/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExpensesIncomeView } from '../src/views/ExpensesIncomeView';

const tree = [ { name:'Food', label:'Food', value:300 }, { name:'Rent', label:'Rent', value:700 } ];
test('defaults to Visual, switches to Text with percentages', async () => {
  render(<ExpensesIncomeView tree={tree} total={1000} cur="USD" kind="expense" />);
  expect(screen.getByText('Visual')).toBeInTheDocument();
  await userEvent.click(screen.getByText('Text'));
  expect(screen.getByText('70%')).toBeInTheDocument(); // Rent 700/1000
});
