/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mock window.api ──────────────────────────────────────────────────────────
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockMenuRebuild = jest.fn();

beforeEach(() => {
  mockSet.mockClear();
  mockMenuRebuild.mockClear();
  global.window.api = {
    settings: {
      getAll: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue(undefined),
      set: mockSet,
    },
    menu: {
      rebuild: mockMenuRebuild,
    },
  };
});

// ── Mock i18n (getAvailableLocales returns locale codes) ─────────────────────
jest.mock('../i18n', () => ({
  getAvailableLocales: () => ['de', 'en', 'es', 'fr'],
  t: (key) => key, // minimal stub — returns key; tests don't assert on translated strings
}));

// ── Mock pickCats (RULE_LABEL) ───────────────────────────────────────────────
jest.mock('../src/data/pickCats', () => ({
  RULE_LABEL: { top3: 'Top 3', top5: 'Top 5', top8: 'Top 8', p75: '75% of spend', all: 'All' },
}));

import { OptionsView } from '../src/views/OptionsView';

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULTS = {
  'options.ledger.command': 'ledger',
  'options.hledger': false,
  'options.expenses.regex': '^expenses?(:|$)',
  'options.income.regex': '^(income|revenue)s?(:|$)',
  'options.assets.regex': '^assets?(:|$)',
  'options.liabilities.regex': '^(debts?|liabilit(y|ies))(:|$)',
  'options.equity.regex': '^equity(:|$)',
  'options.locale': 'auto',
  'options.overview.catRule': 'top5',
};

function makeSetting(overrides = {}) {
  const cache = { ...DEFAULTS, ...overrides };
  return key => (cache[key] !== undefined ? cache[key] : DEFAULTS[key]);
}

function makeSetSetting() {
  return jest.fn().mockImplementation((key, value) => {
    mockSet(key, value);
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('renders "Ledger command" group card', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  expect(screen.getByText(/ledger command/i)).toBeInTheDocument();
});

test('renders hledger toggle in OFF state by default', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  expect(screen.getByTestId('toggle-hledger')).toBeInTheDocument();
});

test('toggling hledger calls setSetting with real key "options.hledger" and true', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting({ 'options.hledger': false })} setSetting={setSetting} />);
  fireEvent.click(screen.getByTestId('toggle-hledger'));
  expect(setSetting).toHaveBeenCalledWith('options.hledger', true);
  expect(mockSet).toHaveBeenCalledWith('options.hledger', true);
});

test('toggling hledger when ON calls setSetting with false', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting({ 'options.hledger': true })} setSetting={setSetting} />);
  fireEvent.click(screen.getByTestId('toggle-hledger'));
  expect(setSetting).toHaveBeenCalledWith('options.hledger', false);
});

test('changing language calls window.api.menu.rebuild', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting()} setSetting={setSetting} />);
  const langSelect = screen.getByTestId('select-locale');
  fireEvent.change(langSelect, { target: { value: 'de' } });
  expect(mockMenuRebuild).toHaveBeenCalled();
  expect(setSetting).toHaveBeenCalledWith('options.locale', 'de');
});

test('catRule dropdown renders 5 options (top3/top5/top8/p75/all)', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  const catRuleSelect = screen.getByTestId('select-cat-rule');
  const opts = catRuleSelect.querySelectorAll('option');
  expect(opts.length).toBe(5);
  const values = Array.from(opts).map(o => o.value);
  expect(values).toEqual(expect.arrayContaining(['top3', 'top5', 'top8', 'p75', 'all']));
});

test('catRule dropdown change calls setSetting with options.overview.catRule', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting()} setSetting={setSetting} />);
  fireEvent.change(screen.getByTestId('select-cat-rule'), { target: { value: 'top3' } });
  expect(setSetting).toHaveBeenCalledWith('options.overview.catRule', 'top3');
});

test('renders 5 regex text inputs (expenses, income, assets, liabilities, equity)', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  const inputs = [
    screen.getByTestId('input-expenses-regex'),
    screen.getByTestId('input-income-regex'),
    screen.getByTestId('input-assets-regex'),
    screen.getByTestId('input-liabilities-regex'),
    screen.getByTestId('input-equity-regex'),
  ];
  inputs.forEach(input => expect(input).toBeInTheDocument());
});

test('clicking "Use default" for expenses regex restores default value', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting({ 'options.expenses.regex': 'custom' })} setSetting={setSetting} />);
  fireEvent.click(screen.getByTestId('btn-default-expenses-regex'));
  expect(setSetting).toHaveBeenCalledWith('options.expenses.regex', '^expenses?(:|$)');
});

test('language dropdown includes auto + locale codes from getAvailableLocales', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  const langSelect = screen.getByTestId('select-locale');
  const opts = Array.from(langSelect.querySelectorAll('option')).map(o => o.value);
  expect(opts).toContain('auto');
  expect(opts).toContain('de');
  expect(opts).toContain('en');
});
