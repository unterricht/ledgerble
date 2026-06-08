/** @jest-environment jsdom */
import { render, screen, act, fireEvent } from '@testing-library/react';
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

test('"Print to PDF…" file-menu item triggers window.api.printToPdf (not window.print)', async () => {
  window.api.platform = 'win32';
  window.api.printToPdf = jest.fn().mockResolvedValue({ canceled: true });

  await act(async () => { render(<Shell />); });

  // open the File menu (Windows chrome menu bar)
  fireEvent.click(screen.getByText('File'));
  fireEvent.click(screen.getByText('Print to PDF…'));

  expect(window.api.printToPdf).toHaveBeenCalled();
  // a smart default filename is passed: ends in .pdf and names the active tab
  const suggested = window.api.printToPdf.mock.calls[0][0];
  expect(typeof suggested).toBe('string');
  expect(suggested.endsWith('.pdf')).toBe(true);
  expect(suggested).toContain('Income & Expenses');
  expect(window.print).not.toHaveBeenCalled();
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

test('#printHeader shows the Ledgerble wordmark next to the gerbil logo', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  const header = container.querySelector('#printHeader');
  expect(header.textContent).toContain('Ledgerble');
  // wordmark sits in a brand row together with the logo
  const brand = container.querySelector('#printHeader .print-brand');
  expect(brand).not.toBeNull();
  expect(brand.querySelector('img.print-logo')).not.toBeNull();
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

test('does not render a print footer (removed — it carried no useful information)', async () => {
  let container;
  await act(async () => { ({ container } = render(<Shell />)); });

  expect(container.querySelector('.print-footer')).toBeNull();
});
