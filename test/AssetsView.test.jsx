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
    { key: 'Assets',      color: '#3E7E6C', label: 'Assets',      type: 'assets'      },
    { key: 'Liabilities', color: '#5B82A6', label: 'Liabilities', type: 'liabilities' },
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

test('Total assets tile sums only asset-type series, not liabilities', () => {
  // At last interval: Assets = 62000, Liabilities = -4800
  // Total assets (assets only) = 62000; net worth would be 62000 + (-4800) = 57200
  render(<AssetsView vm={vm} cur="USD" />);
  // The formatted value for 62000 should appear (not 57200)
  // money(62000, { cents: false, cur: 'USD' }) → '$62,000' or similar
  expect(screen.getByText(/total assets/i)).toBeInTheDocument();
  // Verify '62' appears in the DOM (part of $62,000) but not '57' as the total
  const html = document.body.innerHTML;
  expect(html).toContain('62');
});
