/** @jest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
jest.mock('../src/charts/AreaLineChart', () => ({ AreaLineChart: () => <div data-testid="area-line-chart" /> }));
import { AssetsView } from '../src/views/AssetsView';
const { t, getCurrentLocale } = require('../i18n');
const { money } = require('../src/ui/tokens');

const vm = {
  data: [
    { m: 'Jan', Assets: 60000, Liabilities: -5000, __net: 55000 },
    { m: 'Feb', Assets: 62000, Liabilities: -4800, __net: 57200 },
  ],
  series: [
    { key: 'Assets',      color: '#3E7E6C', label: 'Assets',      type: 'assets'      },
    { key: 'Liabilities', color: '#AE5645', label: 'Liabilities', type: 'liabilities' },
    { key: '__net',       color: '#4B45B8', label: 'Net Worth',   type: 'net', emphasis: true },
  ],
  totals: { assets: 62000, liabilities: -4800, net: 57200 },
  asOf: new Date('2018-02-28T00:00:00Z'),
  maxY: 70000,
  grid: [0, 20000, 40000, 60000, 70000],
};

test('renders the AreaLineChart', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getByTestId('area-line-chart')).toBeInTheDocument();
});

test('summary strip has exactly three tiles: net worth, assets, liabilities', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  const strip = screen.getByTestId('assets-strip');
  expect(strip.children).toHaveLength(3);
  // scoped to the strip — the series labels repeat in the legend below the chart
  expect(within(strip).getByText(t('balance.net_worth'))).toBeInTheDocument();
  expect(within(strip).getByText(t('assets.total_assets'))).toBeInTheDocument();
  expect(within(strip).getByText(t('assets.total_liabilities'))).toBeInTheDocument();
});

test('net worth tile reports assets minus liabilities, not gross assets', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  const tile = screen.getByTestId('tile-net');
  expect(tile).toHaveTextContent(money(57200, { cents: false, cur: 'USD' }));
});

test('assets tile reports the gross asset total', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getByTestId('tile-assets')).toHaveTextContent(money(62000, { cents: false, cur: 'USD' }));
});

test('liabilities tile shows the amount with a minus sign', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  expect(screen.getByTestId('tile-liabilities'))
    .toHaveTextContent(money(-4800, { cents: false, sign: true, cur: 'USD' }));
});

test('net worth tile names the as-of date in the platform date format', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  const expected = vm.asOf.toLocaleDateString(getCurrentLocale(), { timeZone: 'UTC' });
  expect(screen.getByTestId('tile-net')).toHaveTextContent(expected);
});

test('the as-of date is its own line, so the tile label cannot wrap and misalign the values', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  const tile = within(screen.getByTestId('tile-net'));
  // label element carries the label ALONE — the date lives in a separate element
  expect(tile.getByText(t('balance.net_worth'))).toBeInTheDocument();
  expect(tile.getByTestId('tile-net-asof')).toHaveTextContent(
    vm.asOf.toLocaleDateString(getCurrentLocale(), { timeZone: 'UTC' })
  );
});

test('legend lists every series with its current value, net worth first', () => {
  render(<AssetsView vm={vm} cur="USD" />);
  const legend = screen.getByTestId('assets-legend');
  expect(legend.children).toHaveLength(3);
  expect(legend.children[0]).toHaveTextContent('Net Worth');
  expect(legend).toHaveTextContent('Assets');
  expect(legend).toHaveTextContent(money(62000, { cents: false, cur: 'USD' }));
  expect(legend).toHaveTextContent(money(-4800, { cents: false, sign: true, cur: 'USD' }));
});

test('renders without totals or asOf (no journal loaded yet)', () => {
  render(<AssetsView vm={{ data: [], series: [], maxY: 0, grid: [0] }} cur="USD" />);
  expect(screen.getByTestId('assets-strip').children).toHaveLength(3);
  expect(screen.getByTestId('tile-net')).toHaveTextContent(money(0, { cents: false, cur: 'USD' }));
});
