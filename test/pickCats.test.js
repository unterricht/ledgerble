const { pickCats } = require('../src/data/pickCats');
const rows = [
  { cat: 'A', total: 100 }, { cat: 'B', total: 50 }, { cat: 'C', total: 30 },
  { cat: 'D', total: 15 }, { cat: 'E', total: 5 },
];
test('top3 shows 3, rest in Other', () => {
  const { shown, rest } = pickCats(rows, 'top3');
  expect(shown.map(r => r.cat)).toEqual(['A','B','C']);
  expect(rest.map(r => r.cat)).toEqual(['D','E']);
});
test('all shows everything, no rest', () => {
  const { shown, rest } = pickCats(rows, 'all');
  expect(shown).toHaveLength(5); expect(rest).toHaveLength(0);
});
test('p75 shows the smallest set covering 75% of spend', () => {
  const { shown } = pickCats(rows, 'p75'); // total 200; A+B=150=75%
  expect(shown.map(r => r.cat)).toEqual(['A','B']);
});
