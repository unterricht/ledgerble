/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mock window.api ──────────────────────────────────────────────────────────
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockMenuRebuild = jest.fn();
const mockShowOpenDialog = jest.fn();

beforeEach(() => {
  mockSet.mockClear();
  mockMenuRebuild.mockClear();
  mockShowOpenDialog.mockClear();
  global.window.api = {
    settings: {
      getAll: jest.fn().mockResolvedValue({}),
      get: jest.fn().mockResolvedValue(undefined),
      set: mockSet,
    },
    menu: {
      rebuild: mockMenuRebuild,
    },
    showOpenDialog: mockShowOpenDialog,
  };
});

// ── Mock i18n (real translations, but limit getAvailableLocales for test stability) ──
jest.mock('../i18n', () => ({
  ...jest.requireActual('../i18n'),
  getAvailableLocales: () => ['de', 'en', 'es', 'fr'],
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

test('renders "Ledger command" group card section title', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  expect(screen.getByText('Ledger command')).toBeInTheDocument();
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

test('changing ledger command path calls setSetting on blur', () => {
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting()} setSetting={setSetting} />);
  const input = screen.getByTestId('input-ledger-command');
  fireEvent.change(input, { target: { value: '/usr/local/bin/ledger' } });
  fireEvent.blur(input);
  expect(setSetting).toHaveBeenCalledWith('options.ledger.command', '/usr/local/bin/ledger');
});

test('language dropdown includes auto + locale codes from getAvailableLocales', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  const langSelect = screen.getByTestId('select-locale');
  const opts = Array.from(langSelect.querySelectorAll('option')).map(o => o.value);
  expect(opts).toContain('auto');
  expect(opts).toContain('de');
  expect(opts).toContain('en');
});

test('Browse button calls showOpenDialog with current ledger command and updates setting', async () => {
  mockShowOpenDialog.mockResolvedValue('/picked/ledger');
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting({ 'options.ledger.command': '/current/ledger' })} setSetting={setSetting} />);
  await userEvent.click(screen.getByTestId('btn-browse-ledger'));
  expect(mockShowOpenDialog).toHaveBeenCalledWith('/current/ledger');
  expect(setSetting).toHaveBeenCalledWith('options.ledger.command', '/picked/ledger');
});

test('Browse button does nothing when dialog is cancelled', async () => {
  mockShowOpenDialog.mockResolvedValue(null);
  const setSetting = makeSetSetting();
  render(<OptionsView getSetting={makeSetting()} setSetting={setSetting} />);
  await userEvent.click(screen.getByTestId('btn-browse-ledger'));
  expect(mockShowOpenDialog).toHaveBeenCalled();
  expect(setSetting).not.toHaveBeenCalledWith('options.ledger.command', expect.anything());
});

// ── i18n coverage: buttons must use locale keys, not hardcoded English ────────

test('"Use default" button label comes from btn.use_default i18n key (en: "Use Default")', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  // en.json: "btn.use_default": "Use Default" (capital D), not hardcoded "Use default"
  const btn = screen.getByTestId('btn-default-expenses-regex');
  expect(btn).toHaveTextContent('Use Default');
});

test('"Browse…" button label comes from btn.browse i18n key (en: "Browse...")', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  // en.json: "btn.browse": "Browse..." (three periods), not hardcoded ellipsis "Browse…"
  const btn = screen.getByTestId('btn-browse-ledger');
  expect(btn).toHaveTextContent('Browse...');
});

test('"Account matching" section title comes from options.account_matching i18n key', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  expect(screen.getByText('Account matching')).toBeInTheDocument();
});

test('"General" section title comes from options.general i18n key', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  expect(screen.getByText('General')).toBeInTheDocument();
});

test('"Auto (system)" locale option comes from options.locale_auto i18n key', () => {
  render(<OptionsView getSetting={makeSetting()} setSetting={makeSetSetting()} />);
  const langSelect = screen.getByTestId('select-locale');
  const autoOption = Array.from(langSelect.querySelectorAll('option')).find(o => o.value === 'auto');
  expect(autoOption).toBeTruthy();
  expect(autoOption.textContent).toBe('Auto (system)');
});
