/**
 * i18n – Internationalization module for Ledgerble
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
 *   (e.g. locales/fr.json) and it will be discoverable via getAvailableLocales().
 */

const path = require('path');
const fs   = require('fs');

// ── Built-in locales (loaded synchronously – no IPC needed) ──

const BUILT_IN = {
    en: require('./locales/en.json'),
    de: require('./locales/de.json'),
};

// ── Module state ──────────────────────────────────────────────

let currentLocale   = 'en';
let currentStrings  = BUILT_IN['en'];

// Extra locales injected at runtime (used by tests and external files)
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
 * Accepts built-in codes ('en', 'de'), runtime-injected codes, or an absolute
 * path to a JSON file.
 *
 * @param {string} localeOrPath  e.g. 'de', 'fr', '/path/to/fr.json'
 */
function loadLocale(localeOrPath) {
    // 1. Built-in?
    if (BUILT_IN[localeOrPath]) {
        currentLocale  = localeOrPath;
        currentStrings = BUILT_IN[localeOrPath];
        return;
    }

    // 2. Runtime-injected (test helper)?
    if (runtimeLocales[localeOrPath]) {
        currentLocale  = localeOrPath;
        currentStrings = runtimeLocales[localeOrPath];
        return;
    }

    // 3. Absolute file path?
    if (path.isAbsolute(localeOrPath) || localeOrPath.endsWith('.json')) {
        try {
            const raw = fs.readFileSync(localeOrPath, 'utf8');
            const strings = JSON.parse(raw);
            const code = path.basename(localeOrPath, '.json');
            runtimeLocales[code] = strings;
            currentLocale  = code;
            currentStrings = strings;
            return;
        } catch (err) {
            console.warn(`[i18n] Could not load locale file "${localeOrPath}":`, err.message);
        }
    }

    // 4. Try locales/<code>.json next to this file
    const candidate = path.join(__dirname, 'locales', `${localeOrPath}.json`);
    if (fs.existsSync(candidate)) {
        try {
            const raw = fs.readFileSync(candidate, 'utf8');
            const strings = JSON.parse(raw);
            runtimeLocales[localeOrPath] = strings;
            currentLocale  = localeOrPath;
            currentStrings = strings;
            return;
        } catch (err) {
            console.warn(`[i18n] Could not load locale file "${candidate}":`, err.message);
        }
    }

    console.warn(`[i18n] Unknown locale "${localeOrPath}", keeping current (${currentLocale}).`);
}

/**
 * Detect the best locale from an Electron app.getLocale() string.
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
 * Returns all available locale codes (built-in + any JSON files in locales/).
 * @returns {string[]}
 */
function getAvailableLocales() {
    const codes = new Set(Object.keys(BUILT_IN));

    // Also scan the locales/ directory for community files
    const localesDir = path.join(__dirname, 'locales');
    try {
        for (const file of fs.readdirSync(localesDir)) {
            if (file.endsWith('.json')) {
                codes.add(path.basename(file, '.json'));
            }
        }
    } catch (_) {
        // locales/ might not exist in some environments – that's fine
    }

    return Array.from(codes).sort();
}

/**
 * Translate all DOM elements that have a [data-i18n] attribute.
 * Call this once after the DOM is ready and after loadLocale().
 *
 * Elements with data-i18n set their textContent.
 * Elements with data-i18n-placeholder set their placeholder attribute.
 * Elements with data-i18n-html set their innerHTML (use with care).
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

// ── Test helper (not for production use) ─────────────────────

/**
 * Inject a locale at runtime. Used by unit tests to simulate incomplete
 * locale files without touching the filesystem.
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
