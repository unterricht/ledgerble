// pick the expense rows to show given a rule: topN, or the smallest set that
// covers 75% of spend. Everything else collapses into one "Other" row.
function pickCats(rows, rule) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (rule === 'all') return { shown: sorted, rest: [] };
  if (rule === 'p75') {
    const tot = sorted.reduce((a, c) => a + c.total, 0);
    let acc = 0; const shown = [];
    for (const c of sorted) { shown.push(c); acc += c.total; if (acc >= tot * 0.75) break; }
    return { shown, rest: sorted.slice(shown.length) };
  }
  const n = rule === 'top3' ? 3 : rule === 'top8' ? 8 : 5;
  return { shown: sorted.slice(0, n), rest: sorted.slice(n) };
}

const RULE_LABEL = { top3: 'Top 3', top5: 'Top 5', top8: 'Top 8', p75: '75% of spend', all: 'All' };

module.exports = { pickCats, RULE_LABEL };
