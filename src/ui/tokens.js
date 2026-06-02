// tokens.js — Quiet Ledger design tokens, ported verbatim from rd-base.jsx
// CommonJS module (no JSX, no React).

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

// ─────────────────────────────────────────────────────────────
// NUMBER FORMATTING
// ─────────────────────────────────────────────────────────────
const CUR = { USD: '$', EUR: '€', GBP: '£' };
function money(v, { cents = true, sign = false, cur = 'USD' } = {}) {
  const s = CUR[cur] || '$';
  const abs = Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
  const body = s + abs;
  if (v < 0) return sign ? '−' + body : '(' + body + ')';
  return sign ? '+' + body : body;
}
function kfmt(v, cur = 'USD') {
  const s = CUR[cur] || '$';
  if (Math.abs(v) >= 1000) return s + (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'k';
  return s + v;
}

module.exports = { T, money, kfmt };
