/**
 * Tests for include-directive parsing (ledger/hledger `include`).
 */
const path = require('path');
const { parseIncludeLines, collectIncludes, findRedundantFiles } = require('../includes');

describe('parseIncludeLines', () => {
  it('extracts a single include directive', () => {
    expect(parseIncludeLines('include accounts.ledger')).toEqual(['accounts.ledger']);
  });

  it('ignores postings, comments and blank lines', () => {
    const content = [
      '; a comment mentioning include foo',
      '',
      '2024-01-01 Groceries',
      '    Expenses:Food   10 EUR',
      'include 2024/january.journal',
    ].join('\n');
    expect(parseIncludeLines(content)).toEqual(['2024/january.journal']);
  });

  it('handles leading "!" (hledger) and quoted paths', () => {
    const content = '!include "my journals/2024.ledger"';
    expect(parseIncludeLines(content)).toEqual(['my journals/2024.ledger']);
  });

  it('collects several includes in order', () => {
    const content = 'include a.ledger\ninclude b.ledger';
    expect(parseIncludeLines(content)).toEqual(['a.ledger', 'b.ledger']);
  });
});

describe('collectIncludes', () => {
  it('resolves relative include paths against the parent directory', () => {
    // collectIncludes resolves paths with the OS-native `path` module, so build
    // the in-memory fixture/expectation the same way (raw POSIX strings would
    // not match path.resolve()'s output on Windows). Mirrors main.handlers.test.js.
    const main = path.resolve('/journals/main.ledger');
    const accounts = path.resolve(path.dirname(main), 'sub/accounts.ledger');
    const fs = {
      [main]: 'include sub/accounts.ledger',
      [accounts]: '',
    };
    const read = (p) => fs[p];
    expect(collectIncludes('/journals/main.ledger', read)).toEqual([
      { path: accounts, includes: [] },
    ]);
  });

  it('recurses into nested includes', () => {
    const main = path.resolve('/j/main.ledger');
    const dir = path.dirname(main);
    const a = path.resolve(dir, 'a.ledger');
    const b = path.resolve(dir, 'b.ledger');
    const fs = {
      [main]: 'include a.ledger',
      [a]: 'include b.ledger',
      [b]: '',
    };
    const read = (p) => fs[p];
    expect(collectIncludes('/j/main.ledger', read)).toEqual([
      { path: a, includes: [
        { path: b, includes: [] },
      ] },
    ]);
  });

  it('guards against include cycles', () => {
    const main = path.resolve('/j/main.ledger');
    const loop = path.resolve(path.dirname(main), 'loop.ledger');
    const fs = {
      [main]: 'include loop.ledger',
      [loop]: 'include main.ledger',
    };
    const read = (p) => fs[p];
    // main -> loop -> (main already seen, stops)
    expect(collectIncludes('/j/main.ledger', read)).toEqual([
      { path: loop, includes: [] },
    ]);
  });

  it('returns an empty list when a file cannot be read', () => {
    const read = () => { throw new Error('ENOENT'); };
    expect(collectIncludes('/nope.ledger', read)).toEqual([]);
  });
});

describe('findRedundantFiles', () => {
  it('marks a top-level file that is included by another loaded file as redundant', () => {
    const includesByFile = {
      '/j/main.ledger': [{ path: '/j/accounts.ledger', includes: [] }],
      '/j/accounts.ledger': [],
    };
    const redundant = findRedundantFiles(['/j/main.ledger', '/j/accounts.ledger'], includesByFile);
    expect([...redundant]).toEqual(['/j/accounts.ledger']);
  });

  it('marks deeply-nested includes as redundant too', () => {
    const includesByFile = {
      '/j/main.ledger': [{ path: '/j/a.ledger', includes: [{ path: '/j/b.ledger', includes: [] }] }],
      '/j/b.ledger': [],
    };
    const redundant = findRedundantFiles(['/j/main.ledger', '/j/b.ledger'], includesByFile);
    expect([...redundant]).toEqual(['/j/b.ledger']);
  });

  it('does not mark independent files as redundant', () => {
    const includesByFile = { '/j/a.ledger': [], '/j/b.ledger': [] };
    const redundant = findRedundantFiles(['/j/a.ledger', '/j/b.ledger'], includesByFile);
    expect(redundant.size).toBe(0);
  });

  it('keeps all files when every file would be redundant (mutual-include guard)', () => {
    const includesByFile = {
      '/j/a.ledger': [{ path: '/j/b.ledger', includes: [] }],
      '/j/b.ledger': [{ path: '/j/a.ledger', includes: [] }],
    };
    const redundant = findRedundantFiles(['/j/a.ledger', '/j/b.ledger'], includesByFile);
    expect(redundant.size).toBe(0);
  });
});
