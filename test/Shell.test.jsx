/** @jest-environment jsdom */
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// ECharts needs a real canvas; stub it so loading data into the Shell doesn't crash jsdom.
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));
import { Shell } from '../src/app/Shell';

beforeEach(() => {
  window.api = { onParsed: () => {}, settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
                 windowControls: { minimize(){}, maximize(){}, close(){} }, platform: 'darwin' };
});

test('renders the source-list nav with all non-portfolio report items', () => {
  render(<Shell />);
  const nav = screen.getByRole('navigation');
  ['Income & Expenses','Balance','Expenses','Income','Assets & Liabilities','Postings','Options']
    .forEach(l => expect(within(nav).getByText(l)).toBeInTheDocument());
});

test('Portfolio tab is hidden when no stock holdings are present', () => {
  render(<Shell />);
  const nav = screen.getByRole('navigation');
  expect(within(nav).queryByText('Portfolio')).not.toBeInTheDocument();
});

test('Portfolio tab appears once a journal with stock holdings is loaded', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  render(<Shell />);
  // deliver a parsed journal that buys a non-currency commodity (a stock)
  const result = {
    postings: [
      { date: '2024-01-01', accounts: ['Assets', 'Depot'], amount: 1, currency: 'VWRD.L', commodity: 'VWRD.L', price: 100, priceCurrency: 'EUR' },
      { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: -100, currency: 'EUR' },
    ],
    postingsCost: [
      { date: '2024-01-01', accounts: ['Assets', 'Depot'], amount: 100, currency: 'EUR' },
      { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: -100, currency: 'EUR' },
    ],
    prices: [{ commodity: 'VWRD.L', date: '2024-01-01', price: '100', priceCommodity: 'EUR' }],
  };
  await act(async () => { parsedCb('stocks.ledger', result, null); });
  const nav = screen.getByRole('navigation');
  expect(within(nav).getByText('Portfolio')).toBeInTheDocument();
});

test('clicking a nav item switches the active view', async () => {
  render(<Shell />);
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Balance'));
  expect(document.querySelector('[data-view="balance"]')).toBeInTheDocument();
});

test('macOS does not render custom window controls', () => {
  render(<Shell />);
  expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument();
});

test('Windows renders custom window controls', () => {
  window.api.platform = 'win32';
  render(<Shell />);
  expect(screen.getByTestId('win-controls')).toBeInTheDocument();
});

test('typing in search switches to postings view', async () => {
  render(<Shell />);
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'rent');
  expect(document.querySelector('[data-view="postings"]')).toBeInTheDocument();
});
