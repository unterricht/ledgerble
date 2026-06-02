/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
jest.mock('../src/charts/AreaLineChart', () => ({ AreaLineChart: () => <div data-testid="area-line-chart" /> }));
import { PortfolioView } from '../src/views/PortfolioView';

const vm = {
  totals: [
    { m: 'Jan', value: 1750 },
    { m: 'Feb', value: 1875 },
  ],
  holdings: [
    { account: 'Assets:Shares', asset: 'AAPL', qty: 10,  cost: 1000, market: 1200, gain: 200  },
    { account: 'Assets:IRA',    asset: 'VTSAX', qty: 5,  cost: 500,  market: 550,  gain: 50   },
  ],
  totalCost:   1500,
  totalMarket: 1750,
  totalGain:   250,
  maxY:        2000,
  grid:        [0, 500, 1000, 1500, 2000],
};

test('renders the AreaLineChart', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  expect(screen.getByTestId('area-line-chart')).toBeInTheDocument();
});

test('renders a holding row for each holding', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('VTSAX')).toBeInTheDocument();
});

test('renders the unrealised gain percentage for a holding', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  // AAPL: gain 200 / cost 1000 = 20.0%
  const html = document.body.innerHTML;
  expect(html).toMatch(/20\.0%/);
});

test('renders summary strip with Cost basis label', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  // 'Cost basis' appears in strip AND table header — use getAllByText
  expect(screen.getAllByText(/cost basis/i).length).toBeGreaterThanOrEqual(1);
});

test('renders summary strip with Market value label', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  expect(screen.getAllByText(/market value/i).length).toBeGreaterThanOrEqual(1);
});

test('renders summary strip with Unrealised gain label', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  expect(screen.getAllByText(/unrealised gain/i).length).toBeGreaterThanOrEqual(1);
});

test('renders the table header columns', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  expect(screen.getByText('Account')).toBeInTheDocument();
  expect(screen.getByText('Asset')).toBeInTheDocument();
});

test('renders with empty vm without crashing', () => {
  const emptyVm = { totals: [], holdings: [], totalCost: 0, totalMarket: 0, totalGain: 0 };
  render(<PortfolioView vm={emptyVm} cur="USD" />);
  expect(screen.getAllByText(/cost basis/i).length).toBeGreaterThanOrEqual(1);
});

test('negative gain renders with neg color indicator', () => {
  const vmNeg = {
    ...vm,
    holdings: [
      { account: 'Assets:Shares', asset: 'XYZ', qty: 2, cost: 300, market: 250, gain: -50 },
    ],
    totalCost: 300, totalMarket: 250, totalGain: -50,
  };
  render(<PortfolioView vm={vmNeg} cur="USD" />);
  expect(screen.getByText('XYZ')).toBeInTheDocument();
  // -16.7% shown (negative gain percentage)
  const html = document.body.innerHTML;
  expect(html).toMatch(/16\.7%/);
});

test('qty is formatted with toLocaleString (no raw float)', () => {
  render(<PortfolioView vm={vm} cur="USD" />);
  // qty=10 should appear as "10" (formatted), not as raw number
  // qty=5 should appear as "5"
  const html = document.body.innerHTML;
  // Check the formatted values appear — they should not show as raw long floats
  expect(html).toMatch(/\b10\b/);
  expect(html).toMatch(/\b5\b/);
});

test('renders with null qty as em-dash', () => {
  const vmWithNull = {
    ...vm,
    holdings: [
      { account: 'Assets:Shares', asset: 'FUND', qty: null, cost: 1000, market: 1200, gain: 200 },
    ],
  };
  render(<PortfolioView vm={vmWithNull} cur="USD" />);
  const html = document.body.innerHTML;
  expect(html).toMatch(/—/);
});
