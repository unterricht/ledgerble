const { stripVirtual } = require('../stripVirtual');

describe('stripVirtual', () => {
  test('strips surrounding square brackets (balanced virtual posting)', () => {
    expect(stripVirtual('[Budget:A]')).toBe('Budget:A');
  });

  test('strips surrounding round brackets (unbalanced virtual posting)', () => {
    expect(stripVirtual('(Budget:A)')).toBe('Budget:A');
  });

  test('strips brackets around multi-segment accounts', () => {
    expect(stripVirtual('[Equity:Budget]')).toBe('Equity:Budget');
  });

  test('leaves real accounts unchanged', () => {
    expect(stripVirtual('Assets:Checking')).toBe('Assets:Checking');
  });

  test('does not touch brackets that are not surrounding the whole account', () => {
    expect(stripVirtual('Foo:(bar)')).toBe('Foo:(bar)');
    expect(stripVirtual('Assets:[escrow]:held')).toBe('Assets:[escrow]:held');
  });

  test('does not strip mismatched brackets', () => {
    expect(stripVirtual('[Budget:A)')).toBe('[Budget:A)');
    expect(stripVirtual('(Budget:A]')).toBe('(Budget:A]');
  });

  test('handles surrounding whitespace around a virtual account', () => {
    expect(stripVirtual(' [Budget:A] ')).toBe('Budget:A');
  });

  test('is a no-op for empty or non-string input', () => {
    expect(stripVirtual('')).toBe('');
    expect(stripVirtual(undefined)).toBe(undefined);
  });
});
