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
