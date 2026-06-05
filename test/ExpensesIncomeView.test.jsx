/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { ExpensesIncomeView } from '../src/views/ExpensesIncomeView';

const tree = [ { name:'Food', label:'Food', value:300 }, { name:'Rent', label:'Rent', value:700 } ];
test('renders bar breakdown without toggle', () => {
  render(<ExpensesIncomeView tree={tree} total={1000} cur="USD" kind="expense" />);
  expect(screen.queryByText('Visual')).not.toBeInTheDocument();
  expect(screen.queryByText('Text')).not.toBeInTheDocument();
});
