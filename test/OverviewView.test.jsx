/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
jest.mock('../src/charts/IncomeExpensesChart', () => ({ IncomeExpensesChart: () => <div data-testid="ie-chart" /> }));
import { OverviewView } from '../src/views/OverviewView';

const vm = {
  monthly: [{ m:'Jan', inc:1000, exp:200 }],
  income: [{ cat:'Income:Salary', avg:1000, max:1000, min:1000, total:1000 }],
  expenses: [ {cat:'Expenses:A',avg:1,max:1,min:1,total:600},{cat:'Expenses:B',avg:1,max:1,min:1,total:300},
              {cat:'Expenses:C',avg:1,max:1,min:1,total:60},{cat:'Expenses:D',avg:1,max:1,min:1,total:30},
              {cat:'Expenses:E',avg:1,max:1,min:1,total:10},{cat:'Expenses:F',avg:1,max:1,min:1,total:5} ],
  statStrip: { income:1000, expenses:905, net:95, savingsRate:10 }, categoryCount:6,
};

test('renders stat strip and chart', () => {
  render(<OverviewView vm={vm} cur="USD" netColor="#7A47C2" catRule="top5" />);
  expect(screen.getByTestId('ie-chart')).toBeInTheDocument();
  expect(screen.getByText(/Savings rate/i)).toBeInTheDocument();
});
test('big stat values carry the rd-stat-val class so print CSS can size them down', () => {
  const { container } = render(<OverviewView vm={vm} cur="USD" netColor="#7A47C2" catRule="top5" />);
  expect(container.querySelectorAll('.rd-stat-val').length).toBe(4);
});
test('top5 collapses the 6th category into an Other row that expands', async () => {
  render(<OverviewView vm={vm} cur="USD" netColor="#7A47C2" catRule="top5" />);
  expect(screen.getByText(/Other/)).toBeInTheDocument();
  await userEvent.click(screen.getByText(/show 1 more/i));
  expect(screen.getByText('Expenses:F')).toBeInTheDocument();
});
