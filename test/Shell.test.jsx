/** @jest-environment jsdom */
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// ECharts needs a real canvas; stub it so loading data into the Shell doesn't crash jsdom.
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));

// Spy on loadLocale so we can verify Shell calls it when the locale setting changes.
// Spread jest.requireActual so t() and all other i18n functions keep working normally.
jest.mock('../i18n', () => {
  const actual = jest.requireActual('../i18n');
  return { ...actual, loadLocale: jest.fn() };
});
const { loadLocale } = require('../i18n');

import { Shell } from '../src/app/Shell';

beforeEach(() => {
  jest.clearAllMocks();
  window.api = { onParsed: () => {}, settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
                 windowControls: { minimize(){}, maximize(){}, close(){} }, platform: 'darwin' };
});

test('renders the source-list nav with all non-portfolio report items', async () => {
  await act(async () => { render(<Shell />); });
  const nav = screen.getByRole('navigation');
  ['Income & Expenses','Balance','Expenses','Income','Assets & Liabilities','Postings','Options']
    .forEach(l => expect(within(nav).getByText(l)).toBeInTheDocument());
});

test('Portfolio tab is hidden when no stock holdings are present', async () => {
  await act(async () => { render(<Shell />); });
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
  await act(async () => { render(<Shell />); });
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Balance'));
  expect(document.querySelector('[data-view="balance"]')).toBeInTheDocument();
});

test('macOS does not render custom window controls', async () => {
  await act(async () => { render(<Shell />); });
  expect(screen.queryByTestId('win-controls')).not.toBeInTheDocument();
});

test('Windows renders custom window controls', async () => {
  window.api.platform = 'win32';
  await act(async () => { render(<Shell />); });
  expect(screen.getByTestId('win-controls')).toBeInTheDocument();
});

test('typing in search switches to postings view', async () => {
  await act(async () => { render(<Shell />); });
  await userEvent.type(screen.getByPlaceholderText(/search/i), 'rent');
  expect(document.querySelector('[data-view="postings"]')).toBeInTheDocument();
});

// ── Platform-appropriate ledger command default ────────────────────────────

test('ledger command input shows /opt/homebrew/bin/ledger as default on macOS when no setting is persisted', async () => {
  window.api.platform = 'darwin';
  window.api.settings.getAll = async () => ({});
  await act(async () => { render(<Shell />); });
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Options'));
  expect(screen.getByTestId('input-ledger-command')).toHaveValue('/opt/homebrew/bin/ledger');
});

test('persisted ledger command path overrides platform default', async () => {
  window.api.platform = 'darwin';
  window.api.settings.getAll = async () => ({ 'options.ledger.command': '/custom/ledger' });
  await act(async () => { render(<Shell />); });
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Options'));
  expect(screen.getByTestId('input-ledger-command')).toHaveValue('/custom/ledger');
});

// ── Locale wiring ──────────────────────────────────────────────────────────

test('Shell calls loadLocale with persisted locale on mount', async () => {
  window.api.settings.getAll = async () => ({ 'options.locale': 'de' });
  await act(async () => { render(<Shell />); });
  expect(loadLocale).toHaveBeenCalledWith('de');
});

test('Shell resolves auto locale from navigator.language on mount', async () => {
  Object.defineProperty(navigator, 'language', { value: 'fr-FR', configurable: true });
  window.api.settings.getAll = async () => ({ 'options.locale': 'auto' });
  await act(async () => { render(<Shell />); });
  expect(loadLocale).toHaveBeenCalledWith('fr');
  Object.defineProperty(navigator, 'language', { value: '', configurable: true });
});

test('Shell calls loadLocale when locale is changed via OptionsView', async () => {
  await act(async () => { render(<Shell />); });
  // Navigate to options
  await userEvent.click(within(screen.getByRole('navigation')).getByText('Options'));
  // Change locale dropdown to 'de'
  const sel = screen.getByTestId('select-locale');
  fireEvent.change(sel, { target: { value: 'de' } });
  expect(loadLocale).toHaveBeenCalledWith('de');
});

test('Portfolio Inspector slider left handle is clamped to portfolioFirstKey index', async () => {
  // Provide postings: a plain EUR posting from 2024-01 and a stock holding from 2024-03.
  // Monthly bucketing produces fullIntervals ['2024-01','2024-02','2024-03'].
  // buildPortfolio should find portfolioFirstKey === '2024-03' (index 2).
  // After opening Portfolio tab + Inspector the range-from slider must show value 2.
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  render(<Shell />);

  const result = {
    postings: [
      // Plain cash posting in Jan — creates the 2024-01 and 2024-02 intervals
      { date: '2024-01-15', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
      // Stock purchase in March — portfolio value starts here
      { date: '2024-03-01', accounts: ['Assets', 'Depot'], amount: 2, currency: 'VWRD.L', commodity: 'VWRD.L', price: 100, priceCurrency: 'EUR' },
      { date: '2024-03-01', accounts: ['Assets', 'Bank'], amount: -200, currency: 'EUR' },
    ],
    postingsCost: [
      { date: '2024-01-15', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
      { date: '2024-03-01', accounts: ['Assets', 'Depot'], amount: 200, currency: 'EUR' },
      { date: '2024-03-01', accounts: ['Assets', 'Bank'], amount: -200, currency: 'EUR' },
    ],
    prices: [
      { commodity: 'VWRD.L', date: '2024-03-01', price: '100', priceCommodity: 'EUR' },
    ],
  };

  await act(async () => { parsedCb('stocks.ledger', result, null); });

  // Navigate to Portfolio tab. The Inspector is open by default (inspectorOpen starts true).
  const nav = screen.getByRole('navigation');
  await userEvent.click(within(nav).getByText('Portfolio'));

  // The range-from slider must be clamped to index >= 1 (portfolioFirstKey is not at index 0)
  const rangeFrom = screen.getByTestId('range-from');
  const clampedValue = Number(rangeFrom.value);
  expect(clampedValue).toBeGreaterThan(0);
});
