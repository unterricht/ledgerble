/**
 * Tests for ledgerExec.js — the pure argument builders that feed execFile.
 *
 * The whole point of these builders is to keep the journal path and any other
 * user-controlled value as *separate argv elements* so they are passed to the
 * ledger/hledger binary literally, with no shell interpretation. That is what
 * closes the command-injection hole that the old string-concatenation +
 * `exec`/`execSync` path opened (a journal named `x".journal; rm -rf ~/"`).
 */
const { ledgerArgs, hledgerArgs } = require('../ledgerExec');

// A deliberately hostile filename: shell metacharacters, quotes, a chained
// command and a backtick. With argv arrays none of this is interpreted.
const EVIL = 'x".journal"; rm -rf ~ #`whoami`';

describe('ledgerArgs', () => {
  it('passes the journal path as one literal argv element after -f (no shell quoting)', () => {
    const args = ledgerArgs(EVIL, 'csv');
    const i = args.indexOf('-f');
    expect(i).toBeGreaterThanOrEqual(0);
    // the very next element must be the path, byte-for-byte, unquoted/unescaped
    expect(args[i + 1]).toBe(EVIL);
  });

  it('builds the market csv command', () => {
    expect(ledgerArgs('/j/main.ledger', 'csv')).toEqual(
      ['-f', '/j/main.ledger', 'csv', '--no-pager', '--no-color']
    );
  });

  it('builds the cost-basis csv command with -B', () => {
    expect(ledgerArgs('/j/main.ledger', 'csv-B')).toEqual(
      ['-f', '/j/main.ledger', 'csv', '-B', '--no-pager', '--no-color']
    );
  });

  it('builds the prices command', () => {
    expect(ledgerArgs('/j/main.ledger', 'prices')).toEqual(
      ['-f', '/j/main.ledger', 'prices', '--no-pager', '--no-color']
    );
  });

  it('rejects an unknown mode rather than emitting an unsafe command', () => {
    expect(() => ledgerArgs('/j/main.ledger', 'wat')).toThrow();
  });
});

describe('hledgerArgs', () => {
  it('passes the journal path as one literal argv element after -f', () => {
    const args = hledgerArgs(EVIL);
    const i = args.indexOf('-f');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(args[i + 1]).toBe(EVIL);
  });

  it('builds the register csv command', () => {
    expect(hledgerArgs('/j/main.ledger')).toEqual(
      ['-f', '/j/main.ledger', 'register', '-O', 'csv']
    );
  });
});
