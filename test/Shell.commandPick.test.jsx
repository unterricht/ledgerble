/** @jest-environment jsdom */
import { render, act } from '@testing-library/react';
jest.mock('echarts', () => ({ init: () => ({ setOption(){}, resize(){}, dispose(){}, on(){} }) }));
import { Shell } from '../src/app/Shell';

function setup(settings) {
  const calls = [];
  window.api = {
    onParsed: () => {},
    parse: (cmd, hledger, file) => calls.push({ cmd, hledger, file }),
    settings: {
      getAll: async () => settings,
      get: async (k) => (k === 'files.list' ? ['/j.journal'] : []),
      set: () => {},
    },
    windowControls: { minimize(){}, maximize(){}, close(){} },
    platform: 'darwin',
  };
  return calls;
}

test('uses ledger command when hledger flag is off', async () => {
  const calls = setup({ 'options.ledger.command': '/p/ledger', 'options.hledger': false });
  await act(async () => { render(<Shell />); });
  await act(async () => {});
  expect(calls).toContainEqual({ cmd: '/p/ledger', hledger: false, file: '/j.journal' });
});

test('uses hledger command when hledger flag is on', async () => {
  const calls = setup({ 'options.hledger.command': '/p/hledger', 'options.hledger': true });
  await act(async () => { render(<Shell />); });
  await act(async () => {});
  expect(calls).toContainEqual({ cmd: '/p/hledger', hledger: true, file: '/j.journal' });
});
