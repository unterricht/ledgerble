function makeTypeExtractor(getSetting) {
  return (accountString) => {
    const tests = [
      ['options.expenses.regex', 'expenses'],
      ['options.income.regex', 'income'],
      ['options.assets.regex', 'assets'],
      ['options.liabilities.regex', 'liabilities'],
      ['options.equity.regex', 'equity'],
    ];
    for (const [key, type] of tests) {
      const rx = getSetting(key);
      if (rx && accountString.match(new RegExp(rx, 'i'))) return type;
    }
    return 'unknown';
  };
}
module.exports = { makeTypeExtractor };
