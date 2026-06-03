const moment = require('moment');
const { buildOverview, buildAssets } = require('../src/data/adapters');

// Interval-key functions mirroring compute.makeDateFormat for each period.
const KEYFN = {
  Yearly: (d) => String(d.getUTCFullYear()),
  Weekly: (d) => moment(d).utc().format('YYYY-WW'),
  Monthly: (d) => d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'),
};

function inc(date, amount) { return { accounts: ['Income', 'Salary'], amount: -amount, type: 'income', date: new Date(date + 'T00:00:00Z') }; }
function exp(date, amount) { return { accounts: ['Expenses', 'Food'], amount, type: 'expenses', date: new Date(date + 'T00:00:00Z') }; }

test('Yearly: postings are bucketed into yearly intervals (not all zero)', () => {
  const model = {
    currency: 'USD', period: 'Yearly', intervalKeyFn: KEYFN.Yearly,
    intervals: ['2018', '2019'],
    postings: [inc('2018-03-01', 1000), exp('2018-06-01', 200), inc('2019-03-01', 1200)],
  };
  const vm = buildOverview(model);
  expect(vm.monthly).toHaveLength(2);
  expect(vm.monthly[0]).toMatchObject({ inc: 1000, exp: 200 });
  expect(vm.monthly[1]).toMatchObject({ inc: 1200, exp: 0 });
  // The whole-period totals must be non-zero — the Yearly "everything is 0" regression.
  expect(vm.statStrip.income).toBe(2200);
});

test('Yearly: bar labels show the full year', () => {
  const model = {
    currency: 'USD', period: 'Yearly', intervalKeyFn: KEYFN.Yearly,
    intervals: ['2018', '2019'], postings: [inc('2018-03-01', 1000)],
  };
  const vm = buildOverview(model);
  expect(vm.monthly[0].m).toBe('2018');
});

test('Weekly: bar labels are valid (no "Invalid date")', () => {
  const model = {
    currency: 'USD', period: 'Weekly', intervalKeyFn: KEYFN.Weekly,
    intervals: ['2018-01', '2018-45'],
    postings: [inc('2018-01-03', 500), exp('2018-11-08', 100)],
  };
  const vm = buildOverview(model);
  expect(vm.monthly.every(b => !/invalid/i.test(b.m))).toBe(true);
  // Week 45 must read as a week, not month 45.
  expect(vm.monthly[1].m).toBe('W45');
  // First bucket carries the year for context.
  expect(vm.monthly[0].m).toBe("W1 '18");
});

test('Monthly: the year is shown at each year boundary (Jan)', () => {
  const model = {
    currency: 'USD', period: 'Monthly', intervalKeyFn: KEYFN.Monthly,
    intervals: ['2025-12', '2026-01', '2026-02'],
    postings: [exp('2025-12-10', 10), exp('2026-01-10', 20), exp('2026-02-10', 30)],
  };
  const vm = buildOverview(model);
  expect(vm.monthly[0].m).toBe("Dec '25"); // first bucket shows the year
  expect(vm.monthly[1].m).toBe("Jan '26"); // year boundary → year shown
  expect(vm.monthly[2].m).toBe('Feb');     // mid-year → bare month
});

test('buildAssets: Weekly labels are valid (no "Invalid date")', () => {
  const balances = new Map([
    [{ account: 'Assets:Bank', type: 'assets' }, [100, 200]],
  ]);
  const model = {
    period: 'Weekly', intervalKeyFn: KEYFN.Weekly,
    intervals: ['2018-01', '2018-45'], balances,
  };
  const vm = buildAssets(model);
  expect(vm.data.every(d => !/invalid/i.test(d.m))).toBe(true);
});
