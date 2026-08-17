const fs = require('fs');
const path = require('path');
const NEW_KEYS = [
  'stat.income','stat.expenses','stat.net_saved','stat.savings_rate',
  'overview.largest_categories','overview.show_more','overview.collapse','overview.other',
  'breakdown.category','breakdown.share_of_total','breakdown.amount',
  'breakdown.not_itemised','breakdown.hint',
  'filter.date_range','filter.accounts','filter.all','filter.none','filter.showing_x_of_y','filter.filters',
  'nav.reports','nav.ledger','search.placeholder',
  'menu.file','menu.edit','menu.view','menu.window','menu.help',
  'file.open','file.reload','file.reveal','file.remove','file.print','file.print_pdf','file.open_ledger',
  'file.included_hint',
  'portfolio.cost_basis','portfolio.market_value','portfolio.unrealised_gain',
  // Assets & liabilities summary strip: gross assets, gross liabilities, net worth
  'assets.total_assets','assets.total_liabilities','balance.net_worth',
  'settings.category_table','settings.category_table.help',
  // i18n Phase 2: OptionsView section titles + subtitle strings
  'options.account_matching','options.general','options.locale_auto',
  'subtitle.preferences','subtitle.all_transactions','subtitle.period_range',
  'subtitle.as_of_empty','subtitle.as_of_last','subtitle.all_transactions_range',
  // Balance view section headings (stock vs. flow vs. unclassified)
  'balance.section.stocks','balance.section.flows','balance.section.unclassified',
  'balance.section.range',
];
const dir = path.join(__dirname, '..', 'locales');
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  test(`${f} has all redesign keys`, () => {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    for (const k of NEW_KEYS) expect(j[k]).toBeDefined();
  });
}
