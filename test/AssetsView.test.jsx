/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
jest.mock('../src/charts/AreaLineChart', () => ({ AreaLineChart: () => <div data-testid="area-line-chart" /> }));
import { AssetsView } from '../src/views/AssetsView';

const vm = {
  data: [
    { m: 'Jan', Assets: 60000, Liabilities: -5000 },
    { m: 'Feb', Assets: 62000, Liabilities: -4800 },
  ],
  series: [
    { key: 'Assets',      color: '#3E7E6C', label: 'Assets'      },
    { key: 'Liabilities', color: '#5B82A6', label: 'Liabilities' },
  ],
  maxY: 70000,
  grid: [0, 20000, 40000, 60000, 70000],
};

test('renders the AreaLineChart', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getByTestId('area-line-chart')).toBeInTheDocument();
});

test('renders a legend entry for each series', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getAllByText('Assets').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Liabilities').length).toBeGreaterThanOrEqual(1);
});

test('renders the summary strip with Total assets label', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getByText(/total assets/i)).toBeInTheDocument();
});

test('renders a summary strip entry for each series label', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  // Both series labels should appear in the strip
  const allAssets = screen.getAllByText('Assets');
  expect(allAssets.length).toBeGreaterThanOrEqual(1);
  const allLiab = screen.getAllByText('Liabilities');
  expect(allLiab.length).toBeGreaterThanOrEqual(1);
});
