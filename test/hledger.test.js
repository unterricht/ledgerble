const { parseHLedgerVal } = require('../hledger');

describe('parse hledger', () => {
  it('should parse numbers with dot as decimal separator (123,456.78)', () => {
    expect(parseHLedgerVal('123')).toBe(123);
    expect(parseHLedgerVal('123.45')).toBe(123.45);
    expect(parseHLedgerVal('123,456.78')).toBe(123456.78);
  });

  it('should parse numbers with comma as decimal separator (123.456,78)', () => {
    expect(parseHLedgerVal('123')).toBe(123);
    expect(parseHLedgerVal('123,45')).toBe(123.45);
    expect(parseHLedgerVal('123.456,78')).toBe(123456.78);
  });
});