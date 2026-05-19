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

/**
 * Translate all DOM elements that have a [data-i18n] attribute.
 * Call this once after the DOM is ready and after loadLocale().
 *
 * Elements with data-i18n        → textContent
 * Elements with data-i18n-html   → innerHTML  (use with care)
 * Elements with data-i18n-placeholder → placeholder attribute
 */
function translatePage() {
    if (typeof document === 'undefined') return;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
    });
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

// ── Exports ───────────────────────────────────────────────────

module.exports = {
    t,
    loadLocale,
    detectLocale,
    getCurrentLocale,
    getAvailableLocales,
    translatePage,
    _injectLocale,
};
