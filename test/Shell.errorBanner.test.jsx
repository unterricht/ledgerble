/** @jest-environment jsdom */
import { render, act, screen, fireEvent } from '@testing-library/react';
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));
import { Shell } from '../src/app/Shell';

let parsedCb;
beforeEach(() => {
  parsedCb = null;
  window.api = {
    onParsed: (cb) => { parsedCb = cb; },
    parse: () => {},
    settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
    windowControls: { minimize(){}, maximize(){}, close(){} },
    platform: 'darwin',
  };
});

test('shows a binary-not-found banner with the tool name', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'binary-not-found', tool: 'ledger', message: 'ENOENT' });
  });
  expect(screen.getByText('ledger was not found')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Options' })).toBeInTheDocument();
});

test('clicking the action opens the Options view', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'binary-not-found', tool: 'hledger', message: 'ENOENT' });
  });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Open Options' })); });
  // Options view subtitle proves we navigated there.
  expect(screen.getByText('Preferences')).toBeInTheDocument();
});

test('shows a parse-error banner with the message', async () => {
  await act(async () => { render(<Shell />); });
  await act(async () => {
    parsedCb('/j.journal', null, { type: 'parse-error', message: 'Too few fields' });
  });
  expect(screen.getByText(/Too few fields/)).toBeInTheDocument();
});
