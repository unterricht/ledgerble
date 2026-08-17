/**
 * Tests for the i18n module.
 *
 * Run with: npm test
 *
 * Phase 1 (Red): All tests fail – i18n.js does not exist yet.
 * Phase 2 (Green): All tests pass after i18n.js is created.
 */

const path = require('path');
const fs = require('fs');

// We lazy-require so Jest doesn't cache a half-initialised module
let i18n;

beforeEach(() => {
    jest.resetModules();
    i18n = require('../i18n');
});

// ── Basic translation ────────────────────────────────────────

test('t() returns the English string by default', () => {
    i18n.loadLocale('en');
    expect(i18n.t('tab.income_expenses')).toBe('Income/Expenses');
});

test('t() returns the German string after loadLocale("de")', () => {
    i18n.loadLocale('de');
    expect(i18n.t('tab.income_expenses')).toBe('Einnahmen/Ausgaben');
});

test('t() returns the key itself for an unknown key (fallback of last resort)', () => {
    i18n.loadLocale('en');
    expect(i18n.t('this.key.does.not.exist')).toBe('this.key.does.not.exist');
});

// ── Fallback behaviour ───────────────────────────────────────

test('t() falls back to English when key is missing in the current locale', () => {
    // Manually inject a minimal locale with a missing key to test fallback
    i18n._injectLocale('test-incomplete', { 'tab.balance': 'Bilanz' });
    i18n.loadLocale('test-incomplete');
    // 'tab.income_expenses' is not in test-incomplete → should fall back to en
    expect(i18n.t('tab.income_expenses')).toBe('Income/Expenses');
    // 'tab.balance' IS in test-incomplete → should return it directly
    expect(i18n.t('tab.balance')).toBe('Bilanz');
});

// ── Locale management ────────────────────────────────────────

test('getCurrentLocale() returns the active locale code', () => {
    i18n.loadLocale('de');
    expect(i18n.getCurrentLocale()).toBe('de');
});

test('getCurrentLocale() defaults to "en"', () => {
    // freshly required module
    expect(i18n.getCurrentLocale()).toBe('en');
});

test('getAvailableLocales() includes "en" and "de"', () => {
    const locales = i18n.getAvailableLocales();
    expect(locales).toContain('en');
    expect(locales).toContain('de');
});

// ── Completeness Safeguard ────────────────────────────────────

test('all locale JSON files have exactly the same set of keys as en.json', () => {
    const localesDir = path.join(__dirname, '..', 'locales');
    const enPath = path.join(localesDir, 'en.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const enKeys = Object.keys(en).sort();

    const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

    for (const file of files) {
        if (file === 'en.json') continue;
        const filePath = path.join(localesDir, file);
        const locale = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const localeKeys = Object.keys(locale).sort();

        const missing = enKeys.filter(k => !localeKeys.includes(k));
        const extra   = localeKeys.filter(k => !enKeys.includes(k));

        expect({ file, missing }).toEqual({ file, missing: [] });
        expect({ file, extra }).toEqual({ file, extra: [] });
    }
});

// ── formatIntervalLabel ───────────────────────────────────────

test('formatIntervalLabel formats Monthly YYYY-MM as long month + year in English', () => {
    i18n.loadLocale('en');
    expect(i18n.formatIntervalLabel('2015-01', 'Monthly')).toBe('January 2015');
});

test('formatIntervalLabel formats Monthly YYYY-MM in German', () => {
    i18n.loadLocale('de');
    expect(i18n.formatIntervalLabel('2015-01', 'Monthly')).toBe('Januar 2015');
});

test('formatIntervalLabel formats April 2026 in English', () => {
    i18n.loadLocale('en');
    expect(i18n.formatIntervalLabel('2026-04', 'Monthly')).toBe('April 2026');
});

test('formatIntervalLabel returns Yearly YYYY label unchanged', () => {
    expect(i18n.formatIntervalLabel('2024', 'Yearly')).toBe('2024');
});

test('formatIntervalLabel returns Weekly label unchanged', () => {
    expect(i18n.formatIntervalLabel('2024-W03', 'Weekly')).toBe('2024-W03');
});

test('formatIntervalLabel returns Quarterly label unchanged', () => {
    expect(i18n.formatIntervalLabel('2024-Q1', 'Quarterly')).toBe('2024-Q1');
});

test('formatIntervalLabel formats Daily YYYY-MM-DD locale-aware in German', () => {
    i18n.loadLocale('de');
    const result = i18n.formatIntervalLabel('2015-01-15', 'Daily');
    expect(result).not.toBe('2015-01-15');
    expect(result).toContain('15');
    expect(result).toContain('2015');
});

// ── formatDate ────────────────────────────────────────────────

test('formatDate renders a UTC date in the German date format', () => {
    i18n.loadLocale('de');
    expect(i18n.formatDate(new Date('2026-01-17T00:00:00Z'))).toBe('17.1.2026');
});

test('formatDate renders the same instant in the US date format', () => {
    i18n.loadLocale('en');
    expect(i18n.formatDate(new Date('2026-01-17T00:00:00Z'))).toBe('1/17/2026');
});

test('formatDate does not shift the day in negative-offset timezones', () => {
    // A UTC midnight date formatted in local time would fall back to Jan 16 west
    // of Greenwich — the interval date must survive verbatim.
    i18n.loadLocale('de');
    expect(i18n.formatDate(new Date('2026-01-17T00:00:00Z'))).toContain('17');
});

test('formatDate returns an empty string for a missing date', () => {
    expect(i18n.formatDate(null)).toBe('');
});

test('en.json has no empty string values', () => {
    const enPath = path.join(__dirname, '..', 'locales', 'en.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const emptyKeys = Object.entries(en)
        .filter(([, v]) => typeof v !== 'string' || v.trim() === '')
        .map(([k]) => k);
    expect(emptyKeys).toEqual([]);
});

// ── Code-Scan Safeguard ───────────────────────────────────────
// This test scans all JS source files for t('key') calls and verifies
// every key exists in en.json. This catches "forgotten to add to JSON" errors.

test('all t("key") calls in source files have a corresponding entry in en.json', () => {
    const enPath = path.join(__dirname, '..', 'locales', 'en.json');
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const enKeys = new Set(Object.keys(en));

    const srcDir = path.join(__dirname, '..');
    const jsFiles = fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.js') && !f.endsWith('.test.js') && f !== 'esbuild.config.mjs')
        .map(f => path.join(srcDir, f));

    const missingKeys = [];
    const keyPattern = /\bt\(\s*['"]([^'"]+)['"]\s*\)/g;

    for (const file of jsFiles) {
        const src = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = keyPattern.exec(src)) !== null) {
            const key = match[1];
            if (!enKeys.has(key)) {
                missingKeys.push(`${path.basename(file)}: t('${key}')`);
            }
        }
    }

    expect(missingKeys).toEqual([]);
});
