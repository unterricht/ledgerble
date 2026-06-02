/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PostingsView } from '../src/views/PostingsView';
const rows = [
  { date:'2018-12-25', payee:'Rent Co', account:'Expenses:Rent', amount:700, type:'expense' },
  { date:'2018-12-26', payee:'Acme', account:'Income:Salary', amount:-1000, type:'income' },
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
