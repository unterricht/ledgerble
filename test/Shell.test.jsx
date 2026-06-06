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

test('right slider handle is clamped to portfolioMinIdx when it falls below it', async () => {
  // When model.sliderValues[1] (right/to handle) is below portfolioMinIdx,
  // inspectorSliderValues must clamp it up to portfolioMinIdx so the DateRangeSlider
  // receives a valid [portfolioMinIdx, portfolioMinIdx] pair rather than
  // [portfolioMinIdx, below-min] which would pass incorrect semantics downstream.
  // Concretely: on the Portfolio tab, range-to must be >= range-from at all times,
  // with the floor being portfolioMinIdx (not just whatever model.sliderValues[1] is).
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  render(<Shell />);

  const result = {
    postings: [
      { date: '2024-01-15', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
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

  const nav = screen.getByRole('navigation');
  await userEvent.click(within(nav).getByText('Portfolio'));

  // range-from (left handle) must be clamped to portfolioMinIdx > 0
  const rangeFrom = screen.getByTestId('range-from');
  const fromValue = Number(rangeFrom.value);
  expect(fromValue).toBeGreaterThan(0); // portfolioMinIdx is active

  // range-to (right handle) must be >= range-from.
  // The fix ensures inspectorSliderValues[1] is also clamped to portfolioMinIdx, so
  // the right handle is never below the floor even if model.sliderValues[1] was smaller.
  const rangeTo = screen.getByTestId('range-to');
  const toValue = Number(rangeTo.value);
  expect(toValue).toBeGreaterThanOrEqual(fromValue);
});

test('switching to Portfolio tab writes the clamped from-index into global sliderValues', async () => {
  // When the Portfolio tab becomes active and portfolioMinIdx > 0, the global dateRange
  // (and therefore model.sliderValues[0]) must be updated to portfolioMinIdx via onRangeChange.
  // We verify this by switching away from Portfolio to another tab and confirming the
  // Inspector's range-from slider still reflects the clamped value — proving dateRange
  // was persisted to global state, not just displayed via inspectorSliderValues.
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  render(<Shell />);

  const result = {
    postings: [
      { date: '2024-01-15', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
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

  const nav = screen.getByRole('navigation');

  // Navigate to Portfolio — the useEffect must fire and write portfolioMinIdx into dateRange.
  await userEvent.click(within(nav).getByText('Portfolio'));

  // Now switch to Assets tab (also shows the Inspector with the global sliderValues).
  await userEvent.click(within(nav).getByText('Assets & Liabilities'));

  // The range-from slider on the Assets tab must reflect the clamped value that was
  // written through to global state when Portfolio was active.
  const rangeFrom = screen.getByTestId('range-from');
  expect(Number(rangeFrom.value)).toBeGreaterThan(0);
});

// ── Journal file management (footer menu) ───────────────────────────────────

const STOCK_RESULT = {
  postings: [
    { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
  ],
  postingsCost: [
    { date: '2024-01-01', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
  ],
  prices: [],
};

test('empty-state open button triggers the journal picker and parses + persists the picked file', async () => {
  window.api.showOpenJournal = jest.fn().mockResolvedValue('/home/user/main.ledger');
  window.api.parse = jest.fn();
  window.api.settings.set = jest.fn();

  await act(async () => { render(<Shell />); });

  await act(async () => { await userEvent.click(screen.getByTestId('journal-open-empty')); });

  expect(window.api.showOpenJournal).toHaveBeenCalled();
  expect(window.api.parse).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/home/user/main.ledger');
  expect(window.api.settings.set).toHaveBeenCalledWith('files.list', ['/home/user/main.ledger']);
});

test('journal menu "open" item triggers the journal picker', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  window.api.showOpenJournal = jest.fn().mockResolvedValue(null);
  window.api.parse = jest.fn();
  render(<Shell />);
  await act(async () => { parsedCb('/home/user/a.ledger', STOCK_RESULT, null); });

  await userEvent.click(screen.getByTestId('journal-menu-trigger'));
  await act(async () => { await userEvent.click(screen.getByTestId('journal-open')); });

  expect(window.api.showOpenJournal).toHaveBeenCalled();
});

test('journal menu "reload" item re-parses the loaded files', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  window.api.parse = jest.fn();
  render(<Shell />);
  await act(async () => { parsedCb('/home/user/a.ledger', STOCK_RESULT, null); });

  window.api.parse.mockClear();
  await userEvent.click(screen.getByTestId('journal-menu-trigger'));
  await userEvent.click(screen.getByTestId('journal-reload'));

  expect(window.api.parse).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/home/user/a.ledger');
});

test('each file row has its own reveal action that reveals that file', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  window.api.revealFile = jest.fn();
  render(<Shell />);
  await act(async () => { parsedCb('/home/user/a.ledger', STOCK_RESULT, null); });
  await act(async () => { parsedCb('/home/user/b.ledger', STOCK_RESULT, null); });

  await userEvent.click(screen.getByTestId('journal-menu-trigger'));
  await userEvent.click(screen.getByTestId('reveal:/home/user/b.ledger'));

  expect(window.api.revealFile).toHaveBeenCalledWith('/home/user/b.ledger');
});

test('each file row is individually removable and persists the shortened list', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  window.api.settings.set = jest.fn();
  render(<Shell />);
  await act(async () => { parsedCb('/home/user/a.ledger', STOCK_RESULT, null); });
  await act(async () => { parsedCb('/home/user/b.ledger', STOCK_RESULT, null); });

  await userEvent.click(screen.getByTestId('journal-menu-trigger'));
  await act(async () => { await userEvent.click(screen.getByTestId('remove:/home/user/a.ledger')); });

  // only a.ledger is dropped; b.ledger survives
  expect(window.api.settings.set).toHaveBeenCalledWith('files.list', ['/home/user/b.ledger']);
  expect(screen.queryByTestId('remove:/home/user/a.ledger')).not.toBeInTheDocument();
  expect(screen.getByTestId('remove:/home/user/b.ledger')).toBeInTheDocument();
});

test('included files are listed (indented, read-only) under their parent and are revealable', async () => {
  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };
  window.api.revealFile = jest.fn();
  window.api.getIncludes = jest.fn().mockResolvedValue([
    { path: '/home/user/accounts.ledger', includes: [
      { path: '/home/user/2024.ledger', includes: [] },
    ] },
  ]);
  render(<Shell />);
  await act(async () => { parsedCb('/home/user/main.ledger', STOCK_RESULT, null); });

  await act(async () => { await userEvent.click(screen.getByTestId('journal-menu-trigger')); });

  expect(window.api.getIncludes).toHaveBeenCalledWith('/home/user/main.ledger');
  // both the direct and the nested include are shown
  expect(screen.getByText('accounts.ledger')).toBeInTheDocument();
  expect(screen.getByText('2024.ledger')).toBeInTheDocument();
  // included files are read-only (no remove), but can be revealed
  expect(screen.queryByTestId('remove:/home/user/accounts.ledger')).not.toBeInTheDocument();
  await userEvent.click(screen.getByTestId('reveal:/home/user/2024.ledger'));
  expect(window.api.revealFile).toHaveBeenCalledWith('/home/user/2024.ledger');
});

test('buildPortfolio is not called on non-portfolio tabs (portfolioVm is memoized)', async () => {
  // portfolioVm is wrapped in useMemo([view, s.files.size, model]).
  // When the user is NOT on the Portfolio tab, buildPortfolio must not be called.
  // This verifies the memoization guard: (view === 'portfolio' && s.files.size > 0) before computing.
  const adapters = require('../src/data/adapters');
  const spy = jest.spyOn(adapters, 'buildPortfolio');

  let parsedCb;
  window.api.onParsed = (cb) => { parsedCb = cb; };

  await act(async () => { render(<Shell />); });

  const result = {
    postings: [
      { date: '2024-01-15', accounts: ['Assets', 'Bank'], amount: 500, currency: 'EUR' },
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

  // On the overview tab (default), buildPortfolio must not be called
  spy.mockClear();
  const nav = screen.getByRole('navigation');
  await userEvent.click(within(nav).getByText('Income & Expenses'));
  expect(spy).not.toHaveBeenCalled();

  // Switching to Portfolio tab must call buildPortfolio (memoized — called when deps change)
  await userEvent.click(within(nav).getByText('Portfolio'));
  expect(spy).toHaveBeenCalled();

  spy.mockRestore();
});
