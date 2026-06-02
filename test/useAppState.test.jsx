/** @jest-environment jsdom */
import { renderHook, act } from '@testing-library/react';
import { useAppState } from '../src/store/useAppState';

beforeEach(() => {
  global.window.api = {
    onParsed: (cb) => { global.__emitParsed = cb; },
    settings: { getAll: async () => ({}), get: async () => [], set: () => {} },
    platform: 'darwin',
  };
});

test('typing a query routes the view to postings', () => {
  const { result } = renderHook(() => useAppState());
  act(() => result.current.setQuery('rent'));
  expect(result.current.query).toBe('rent');
  expect(result.current.view).toBe('postings');
});

test('setQuery("") does not force postings view', () => {
  const { result } = renderHook(() => useAppState());
  act(() => { result.current.setView('balance'); result.current.setQuery(''); });
  expect(result.current.view).toBe('balance');
});

test('onParsed callback stores a file result', () => {
  const { result } = renderHook(() => useAppState());
  act(() => global.__emitParsed('cody.journal', { postings: [], postingsCost: [], prices: [] }, null));
  expect(result.current.files.has('cody.journal')).toBe(true);
});
