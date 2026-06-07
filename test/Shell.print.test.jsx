/** @jest-environment jsdom */
import { render, screen, act } from '@testing-library/react';
jest.mock('../src/charts/IncomeExpensesChart', () => ({ IncomeExpensesChart: () => <div data-testid="ie-chart" /> }));
import { Shell } from '../src/app/Shell';

let capturedOnParsed;

beforeEach(() => {
  capturedOnParsed = null;
  window.api = {
    onParsed(cb) { capturedOnParsed = cb; },
    settings: { getAll: async () => ({}), get: async () => [], set() {} },
    windowControls: { minimize() {}, maximize() {}, close() {} },
    platform: 'darwin',
  };
  window.print = jest.fn();
});

test('Cmd+P triggers window.print', async () => {
  await act(async () => { render(<Shell />); });
  const e = new KeyboardEvent('keydown', { key: 'p', metaKey: true });
  window.dispatchEvent(e);
  expect(window.print).toHaveBeenCalled();
});

test('#printHeader shows real file basename and no hardcoded cody.journal', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  // Emit a parsed file with a known path into the store
  await act(async () => {
    if (capturedOnParsed) {
      capturedOnParsed('/some/dir/myledger.journal', {
        postings: [
          { date: '2023-03-15', accounts: ['expenses:food'], amount: 50, currency: 'USD' },
          { date: '2023-06-20', accounts: ['expenses:rent'], amount: 1000, currency: 'USD' },
        ],
        postingsCost: [],
        prices: [],
      }, null);
    }
  });

  const header = container.querySelector('#printHeader');
  expect(header).not.toBeNull();

  // Should show the real basename
  expect(header.textContent).toContain('myledger.journal');

  // Must NOT contain the hardcoded placeholder
  expect(header.textContent).not.toContain('cody.journal');

  // Must NOT contain the static date string '1 Jun 2026'
  expect(header.textContent).not.toContain('1 Jun 2026');
});

test('#printHeader carries the gerbil logo for the letterhead', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  const logo = container.querySelector('#printHeader img.print-logo');
  expect(logo).not.toBeNull();
  expect(logo.getAttribute('src')).toContain('gerbil');
});

test('#printHeader uses localised Base + Printed labels (not a hardcoded "printed")', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  const header = container.querySelector('#printHeader');
  // en locale labels come from t('print.base') / t('print.printed')
  expect(header.textContent).toContain('Base');
  expect(header.textContent).toContain('Printed');
  // the old hardcoded lowercase "printed " literal must be gone
  expect(header.textContent).not.toContain('printed ');
});

test('#printHeader shows the detected base currency, not a hardcoded USD', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  await act(async () => {
    if (capturedOnParsed) {
      capturedOnParsed('/some/dir/euro.journal', {
        postings: [
          { date: '2023-03-15', accounts: ['expenses:food'], amount: 50, currency: 'EUR' },
          { date: '2023-06-20', accounts: ['expenses:rent'], amount: 1000, currency: 'EUR' },
        ],
        postingsCost: [],
        prices: [],
      }, null);
    }
  });

  const header = container.querySelector('#printHeader');
  expect(header.textContent).toContain('EUR');
  expect(header.textContent).not.toContain('USD');
});

test('renders a print-only running footer with the localised footer text', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  const footer = container.querySelector('.print-footer');
  expect(footer).not.toBeNull();
  expect(footer.textContent).toContain('generated from your journal');
});
