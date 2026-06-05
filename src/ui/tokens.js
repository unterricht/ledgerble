// tokens.js — Quiet Ledger design tokens, ported verbatim from rd-base.jsx
// CommonJS module (no JSX, no React).
const { getCurrentLocale } = require('../../i18n');

// ─────────────────────────────────────────────────────────────
// TOKENS — calm graphite neutrals + one grounded pine accent
// ─────────────────────────────────────────────────────────────
const T = {
  // surfaces
  bg:        '#F4F5F7',
  surface:   '#FFFFFF',
  surface2:  '#F7F8FA',
  sink:      '#EDEFF2',
  sidebar:   '#F0F1F4',
  // hairlines
  line:      '#E6E8EC',
  line2:     '#D8DBE1',
  // ink (cool graphite)
  ink:       '#1E2026',
  ink2:      '#565B64',
  ink3:      '#888D96',
  ink4:      '#AFB3BB',
  // pine accent (calm, secure, money)
  pine:      '#2E6E5D',
  pineStrong:'#255849',
  pineSoft:  '#E9F1EE',
  pineRing:  'rgba(46,110,93,0.30)',
  // financial semantics — muted, serious, not alarming
  pos:       '#2E7D62',
  posSoft:   '#E9F2EE',
  neg:       '#AE5645',
  negSoft:   '#F6ECE8',
  steel:     '#4D7396',   // asset/neutral accent (kept for asset badges)
  steelSoft: '#EAF0F5',
  // NET — assertive indigo: reads clearly over green AND brown bars
  net:       '#4B45B8',
  netStrong: '#3A3597',
  netSoft:   '#ECECF8',
  // fonts — driven by CSS vars so the shell can swap SF Pro ↔ Segoe per platform
  sans: 'var(--rd-sans)',
  mono: 'var(--rd-mono)',
};

// calm, harmonious categorical palette (treemap / multi-series)
const T_CHART = ['#3E7E6C', '#5B82A6', '#8A8FA0', '#B5806C', '#7E9B72', '#9080A8', '#C2A86A', '#6E94A0'];
T.chart = T_CHART;

// semantic palettes for Assets & Liabilities chart
T.chartAssets = ['#2E7D62', '#3E9E7E', '#57B897', '#74CEAE', '#9ADCC5'];
T.chartLiabs  = ['#AE5645', '#C4705E', '#D98B7A', '#8B3D2E', '#E5A898'];

// ─────────────────────────────────────────────────────────────
// NUMBER FORMATTING
// ─────────────────────────────────────────────────────────────
// Known ISO codes and bare symbols map to a glyph; anything else (CHF, SEK, a
// stock ticker used as a display unit, …) is shown as a "CODE " prefix so the
// UI reflects the ledger's real commodity instead of silently falling back to "$".

// Map commodity string → ISO 4217 code (undefined = unknown/non-currency)
const CUR_ISO = { EUR: 'EUR', USD: 'USD', GBP: 'GBP', '€': 'EUR', '$': 'USD', '£': 'GBP' };
// Map ISO code → display symbol (for kfmt)
const ISO_SYM = { EUR: '€', USD: '$', GBP: '£' };

// Normalize Intl spaces (narrow no-break, non-breaking, thin) to regular space
function normSpaces(s) { return s.replace(/[   ]/g, ' '); }

// Probe whether the currency symbol comes after the number in the given locale
const _symbolAfterCache = {};
function symbolComesAfter(locale, iso) {
  const key = locale + ':' + iso;
  if (_symbolAfterCache[key] !== undefined) return _symbolAfterCache[key];
  const sample = normSpaces(
    new Intl.NumberFormat(locale, { style: 'currency', currency: iso, minimumFractionDigits: 0 }).format(0)
  );
  const after = sample.startsWith('0');
  _symbolAfterCache[key] = after;
  return after;
}

function money(v, { cents = true, sign = false, cur = 'USD' } = {}) {
  const locale = getCurrentLocale();
  const iso = CUR_ISO[cur];
  const abs = Math.abs(v);

  let formatted;
  if (iso) {
    formatted = normSpaces(
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: iso,
        minimumFractionDigits: cents ? 2 : 0,
        maximumFractionDigits: cents ? 2 : 0,
      }).format(abs)
    );
  } else {
    // Unknown commodity (CHF, stock tickers…): code prefix + English number
    const numStr = abs.toLocaleString('en-US', {
      minimumFractionDigits: cents ? 2 : 0,
      maximumFractionDigits: cents ? 2 : 0,
    });
    formatted = (cur || 'USD') + ' ' + numStr;
  }

  if (v < 0) return sign ? '−' + formatted : '(' + formatted + ')';
  return sign ? '+' + formatted : formatted;
}

function kfmt(v, cur = 'USD') {
  const locale = getCurrentLocale();
  const iso = CUR_ISO[cur];

  const abs = Math.abs(v);
  let numStr;
  if (abs >= 1000) {
    const kVal = v / 1000;
    const decimals = kVal % 1 === 0 ? 0 : 1;
    if (iso) {
      // Locale-aware decimal separator for known currencies
      numStr = kVal.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + 'k';
    } else {
      numStr = kVal.toFixed(decimals) + 'k';
    }
  } else {
    numStr = iso ? v.toLocaleString(locale) : String(v);
  }

  if (!iso) return (cur || 'USD') + ' ' + numStr;

  const sym = ISO_SYM[iso];
  if (symbolComesAfter(locale, iso)) return numStr + ' ' + sym;
  return sym + numStr;
}

module.exports = { T, money, kfmt };
