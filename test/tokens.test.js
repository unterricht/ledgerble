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
