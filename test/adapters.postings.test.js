const { buildPostings } = require('../src/data/adapters');

function makeModel(overrides) {
  return {
    postings: [{
      dateString: '2024-01-01',
      date: new Date('2024-01-01T00:00:00Z'),
      merchant: 'Amazon',
      accounts: ['Expenses', 'Food'],
      amount: 58.19,
      type: 'expenses',
      ...overrides,
    }],
  };
}

test('buildPostings passes note through when present', () => {
  const rows = buildPostings(makeModel({ note: 'Bleistifte für Erste Klasse' }));
  expect(rows[0].note).toBe('Bleistifte für Erste Klasse');
});

test('buildPostings note defaults to empty string when absent', () => {
  const rows = buildPostings(makeModel({}));
  expect(rows[0].note).toBe('');
});

test('buildPostings trims whitespace from note', () => {
  const rows = buildPostings(makeModel({ note: '  führender Leerraum  ' }));
  expect(rows[0].note).toBe('führender Leerraum');
});
