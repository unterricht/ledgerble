/**
 * Tests for include-directive parsing (ledger/hledger `include`).
 */
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
    const fs = {
      '/journals/main.ledger': 'include sub/accounts.ledger',
      '/journals/sub/accounts.ledger': '',
    };
    const read = (p) => fs[p];
    expect(collectIncludes('/journals/main.ledger', read)).toEqual([
      { path: '/journals/sub/accounts.ledger', includes: [] },
    ]);
  });

  it('recurses into nested includes', () => {
    const fs = {
      '/j/main.ledger': 'include a.ledger',
      '/j/a.ledger': 'include b.ledger',
      '/j/b.ledger': '',
    };
    const read = (p) => fs[p];
    expect(collectIncludes('/j/main.ledger', read)).toEqual([
      { path: '/j/a.ledger', includes: [
        { path: '/j/b.ledger', includes: [] },
      ] },
    ]);
  });

  it('guards against include cycles', () => {
    const fs = {
      '/j/main.ledger': 'include loop.ledger',
      '/j/loop.ledger': 'include main.ledger',
    };
    const read = (p) => fs[p];
    // main -> loop -> (main already seen, stops)
    expect(collectIncludes('/j/main.ledger', read)).toEqual([
      { path: '/j/loop.ledger', includes: [] },
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
