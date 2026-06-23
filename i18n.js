/**
 * i18n – Internationalization module for Ledgerble
 *
 * Works in both the Electron renderer (browser bundle via esbuild) and the
 * main process (Node.js). No fs/path usage – locale data is embedded via
 * require() so esbuild can inline it at bundle time.
 *
 * Usage:
 *   const { t, loadLocale, getCurrentLocale, getAvailableLocales } = require('./i18n');
 *   loadLocale('de');        // switch language
 *   t('tab.income_expenses') // → 'Einnahmen/Ausgaben'
 *
 * Fallback chain:  current locale  →  English  →  key itself
 *
 * Community translations:
 *   Place a JSON file matching the key schema into the locales/ directory
 *   (e.g. locales/fr.json) and inject it at runtime via _injectLocale().
 *   In the renderer, injection happens through IPC from the main process.
 */

// ── Built-in locales (inlined by esbuild at bundle time) ─────

const BUILT_IN = {
    de: require('./locales/de.json'),
    en: require('./locales/en.json'),
    es: require('./locales/es.json'),
    fr: require('./locales/fr.json'),
    it: require('./locales/it.json'),
    ja: require('./locales/ja.json'),
    ko: require('./locales/ko.json'),
    nl: require('./locales/nl.json'),
    pl: require('./locales/pl.json'),
    pt: require('./locales/pt.json'),
    ru: require('./locales/ru.json'),
    'zh-CN': require('./locales/zh-CN.json'),
};

// ── Module state ──────────────────────────────────────────────

let currentLocale   = 'en';
let currentStrings  = BUILT_IN['en'];

// Extra locales injected at runtime (tests, IPC-loaded community files)
const runtimeLocales = {};

// ── Public API ────────────────────────────────────────────────

/**
 * Translate a key.
 * Falls back through: current locale → English → key itself.
 *
 * @param {string} key
 * @returns {string}
 */
function t(key) {
    if (currentStrings && Object.prototype.hasOwnProperty.call(currentStrings, key)) {
        return currentStrings[key];
    }
    // Fallback to English
    if (BUILT_IN.en && Object.prototype.hasOwnProperty.call(BUILT_IN.en, key)) {
        return BUILT_IN.en[key];
    }
    // Last resort: return the key so the app never breaks
    return key;
}

/**
 * Switch the active locale.
 * Accepts built-in codes ('en', 'de') or runtime-injected codes.
 *
 * @param {string} localeCode  e.g. 'de', 'en', 'fr'
 */
function loadLocale(localeCode) {
    // 1. Built-in?
    if (BUILT_IN[localeCode]) {
        currentLocale  = localeCode;
        currentStrings = BUILT_IN[localeCode];
        return;
    }

    // 2. Runtime-injected (test helper or IPC-loaded community locale)?
    if (runtimeLocales[localeCode]) {
        currentLocale  = localeCode;
        currentStrings = runtimeLocales[localeCode];
        return;
    }

    console.warn(`[i18n] Unknown locale "${localeCode}", keeping current (${currentLocale}).`);
}

/**
 * Detect the best locale from an Electron app.getLocale() or navigator.language string.
 * Returns the first two characters (language code), validated against
 * available locales. Falls back to 'en'.
 *
 * @param {string} electronLocale  e.g. 'de-DE', 'en-US'
 * @returns {string}  e.g. 'de', 'en'
 */
function detectLocale(electronLocale) {
    if (!electronLocale) return 'en';
    const lang = electronLocale.split('-')[0].toLowerCase();
    const available = getAvailableLocales();
    return available.includes(lang) ? lang : 'en';
}

/**
 * @returns {string}  The active locale code, e.g. 'de'
 */
function getCurrentLocale() {
    return currentLocale;
}

/**
 * Returns all available locale codes (built-in + runtime-injected).
 * @returns {string[]}
 */
function getAvailableLocales() {
    const codes = new Set([
        ...Object.keys(BUILT_IN),
        ...Object.keys(runtimeLocales),
    ]);
    return Array.from(codes).sort();
}

// ── Test / IPC helper ─────────────────────────────────────────

/**
 * Inject a locale at runtime. Used by:
 * - Unit tests (simulate incomplete locale files without filesystem)
 * - Main process IPC (load community locale files and push to renderer)
 *
 * @param {string} code
 * @param {Object} strings
 */
function _injectLocale(code, strings) {
    runtimeLocales[code] = strings;
}

// ── Interval label formatting ─────────────────────────────────

/**
 * Format a compute-layer interval label string into a locale-aware display string.
 *
 * - Monthly "YYYY-MM"  → "January 2015" / "Januar 2015" using long month + year
 * - Daily   "YYYY-MM-DD" → locale short date (e.g. "1/15/2015" / "15.1.2015")
 * - All other formats (Yearly "YYYY", Weekly "YYYY-WXX", Quarterly "YYYY-QX") → unchanged
 *
 * @param {string} label   Interval string from compute(), e.g. "2015-01" or "2024-W03"
 * @param {string} period  Period type: 'Monthly'|'Daily'|'Weekly'|'Quarterly'|'Yearly'
 * @returns {string}
 */
function formatIntervalLabel(label, period) {
    if (period === 'Monthly') {
        const parts = label.split('-');
        if (parts.length === 2) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // 0-indexed
            const d = new Date(year, month, 1);
            return d.toLocaleString(currentLocale, { month: 'long', year: 'numeric' });
        }
    }
    if (period === 'Daily') {
        const parts = label.split('-');
        if (parts.length === 3) {
            const [y, m, dy] = parts.map(Number);
            const d = new Date(y, m - 1, dy);
            return d.toLocaleDateString(currentLocale);
        }
    }
    return label;
}

// ── Exports ───────────────────────────────────────────────────

module.exports = {
    t,
    loadLocale,
    detectLocale,
    getCurrentLocale,
    getAvailableLocales,
    formatIntervalLabel,
    _injectLocale,
};
