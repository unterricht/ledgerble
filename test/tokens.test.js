const { T, money, kfmt } = require('../src/ui/tokens');

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
