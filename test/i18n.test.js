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

test('en.json and de.json have exactly the same set of keys', () => {
    const enPath = path.join(__dirname, '..', 'locales', 'en.json');
    const dePath = path.join(__dirname, '..', 'locales', 'de.json');

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const de = JSON.parse(fs.readFileSync(dePath, 'utf8'));

    const enKeys = Object.keys(en).sort();
    const deKeys = Object.keys(de).sort();

    const missingInDe = enKeys.filter(k => !deKeys.includes(k));
    const extraInDe   = deKeys.filter(k => !enKeys.includes(k));

    expect(missingInDe).toEqual([]);
    expect(extraInDe).toEqual([]);
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
