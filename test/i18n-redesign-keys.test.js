const fs = require('fs');
const path = require('path');
const NEW_KEYS = [
  'stat.income','stat.expenses','stat.net_saved','stat.savings_rate',
  'overview.largest_categories','overview.show_more','overview.collapse','overview.other',
  'toggle.visual','toggle.text','breakdown.category','breakdown.share_of_total','breakdown.amount',
  'breakdown.not_itemised','breakdown.hint',
  'filter.date_range','filter.accounts','filter.all','filter.none','filter.showing_x_of_y','filter.filters',
  'nav.reports','nav.ledger','search.placeholder',
  'menu.file','menu.edit','menu.view','menu.window','menu.help',
  'file.open','file.reload','file.reveal','file.remove','file.print','file.print_pdf','file.open_ledger',
  'portfolio.cost_basis','portfolio.market_value','portfolio.unrealised_gain','assets.total_assets',
  'settings.category_table','settings.category_table.help',
];
const dir = path.join(__dirname, '..', 'locales');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all redesign keys`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of NEW_KEYS) expect(j[k]).toBeDefined();
  });
}
