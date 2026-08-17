const { T, money, kfmt } = require('../src/ui/tokens');
const { loadLocale } = require('../i18n');

test('T exposes pine accent and net color', () => {
  expect(T.pine).toBe('#2E6E5D');
});
test('money formats positive USD with cents', () => {
  expect(money(1234.5, { cur: 'USD' })).toBe('$1,234.50');
});
test('money formats negative as parentheses by default', () => {
  expect(money(-50, { cur: 'USD' })).toBe('($50.00)');
});
test('money with sign uses minus glyph for negative', () => {
  expect(money(-50, { cur: 'USD', sign: true })).toBe('−$50.00');
});
test('kfmt abbreviates thousands', () => {
  expect(kfmt(7800, 'USD')).toBe('$7.8k');
  expect(kfmt(10000, 'USD')).toBe('$10k');
});

test('money renders the euro symbol commodity directly', () => {
  // ledger files using the "€" commodity (e.g. "€110.84") must not fall back to "$"
  expect(money(1234.5, { cur: '€' })).toBe('€1,234.50');
  expect(kfmt(7800, '€')).toBe('€7.8k');
});

test('money maps the EUR/GBP iso codes to their symbols', () => {
  expect(money(50, { cur: 'EUR' })).toBe('€50.00');
  expect(money(50, { cur: 'GBP' })).toBe('£50.00');
});

test('money shows unknown commodities as a code prefix instead of $', () => {
  // CHF / SEK / arbitrary commodities have no symbol → show the code, never "$"
  expect(money(1234.5, { cur: 'CHF' })).toBe('CHF 1,234.50');
  expect(kfmt(7800, 'CHF')).toBe('CHF 7.8k');
});

describe('money() with German locale', () => {
  afterEach(() => loadLocale('en'));

  test('formats EUR without cents using German thousands separator and symbol after', () => {
    loadLocale('de');
    expect(money(10604, { cents: false, cur: 'EUR' })).toBe('10.604 €');
  });

  test('formats EUR with cents using German decimal comma and symbol after', () => {
    loadLocale('de');
    expect(money(1234.5, { cur: 'EUR' })).toBe('1.234,50 €');
  });

  test('negative EUR in German locale keeps parentheses convention', () => {
    loadLocale('de');
    expect(money(-50, { cur: 'EUR' })).toBe('(50,00 €)');
  });

  test('negative EUR with sign flag in German locale', () => {
    loadLocale('de');
    expect(money(-50, { cur: 'EUR', sign: true })).toBe('−50,00 €');
  });
});

describe('kfmt() with German locale', () => {
  afterEach(() => loadLocale('en'));

  test('formats thousands EUR with German comma-decimal and symbol after', () => {
    loadLocale('de');
    expect(kfmt(7800, 'EUR')).toBe('7,8k €');
  });

  test('formats exact thousands EUR in German locale', () => {
    loadLocale('de');
    expect(kfmt(10000, 'EUR')).toBe('10k €');
  });
});

// ── chart palettes ────────────────────────────────────────────────────────────
// The Assets chart draws one line per account group. Two lines whose colours
// differ only in hue-at-the-same-lightness are indistinguishable in practice
// (and worse under colour-vision deficiency), so neighbouring palette steps must
// also differ in lightness. The floor below is a regression guard; the authoritative
// check is the dataviz palette validator (see the commit message).
describe('chart palettes are separable', () => {
  const { T } = require('../src/ui/tokens');

  const luminance = (hex) => {
    const ch = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  test('neighbouring asset colours differ in lightness, not only in hue', () => {
    for (let i = 1; i < T.chartAssets.length; i++) {
      expect(ratio(T.chartAssets[i - 1], T.chartAssets[i])).toBeGreaterThanOrEqual(1.3);
    }
  });

  test('neighbouring liability colours differ in lightness, not only in hue', () => {
    for (let i = 1; i < T.chartLiabs.length; i++) {
      expect(ratio(T.chartLiabs[i - 1], T.chartLiabs[i])).toBeGreaterThanOrEqual(1.3);
    }
  });

  test('the net-worth colour is not reused by any account series', () => {
    expect(T.chartAssets).not.toContain(T.net);
    expect(T.chartLiabs).not.toContain(T.net);
  });

  test('asset and liability palettes do not share a colour', () => {
    const overlap = T.chartAssets.filter((c) => T.chartLiabs.includes(c));
    expect(overlap).toEqual([]);
  });
});
