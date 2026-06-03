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

test('axis ticks: ~1 year of months stays month-level with year/quarter context', () => {
  const intervals = [], intervalDates = [];
  for (let i = 0; i < 13; i++) {
    const d = new Date(Date.UTC(2015, i, 1));
    intervalDates.push(d);
    intervals.push(d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'));
  }
  const vm = buildOverview({ currency: 'USD', period: 'Monthly', intervalKeyFn: KEYFN.Monthly, intervals, intervalDates, postings: [] });
  const ticks = vm.monthly.map(b => b.tick);
  // 13 months fits the density budget → every month labelled, coarsest-boundary-first
  expect(ticks).toEqual(['2015', 'Feb', 'Mar', 'Q2', 'May', 'Jun', 'Q3', 'Aug', 'Sep', 'Q4', 'Nov', 'Dec', '2016']);
  // category key is the unique interval key (so ECharts never collapses repeats like two "Aug")
  expect(vm.monthly[0].key).toBe('2015-01');
  expect(vm.monthly[12].key).toBe('2016-01');
});

test('axis ticks have a sensible minimum density: ~14 Weekly buckets show week ticks', () => {
  // Regression: previously 14 weeks fell back to month-level → only ~3 ticks
  // with gaping voids. We now want actual weekly ticks at this resolution.
  const intervals = [], intervalDates = [];
  let d = new Date(Date.UTC(2026, 0, 5)); // a Monday
  for (let i = 0; i < 14; i++) {
    intervalDates.push(new Date(d));
    const mm = require('moment').utc(d);
    intervals.push(mm.isoWeekYear() + '-' + String(mm.isoWeek()).padStart(2, '0'));
    d = new Date(d.getTime() + 7 * 86400000);
  }
  const vm = buildOverview({ currency: 'USD', period: 'Weekly', intervalKeyFn: (x) => require('moment').utc(x).format('YYYY-WW'), intervals, intervalDates, postings: [] });
  const ticks = vm.monthly.map(b => b.tick);
  const nonEmpty = ticks.filter(Boolean);
  // far more than the old 3 — at least ~8 labelled ticks across 14 weeks
  expect(nonEmpty.length).toBeGreaterThanOrEqual(8);
  // and they include actual week marks, not just month names
  expect(ticks.some(t => /^W\d+$/.test(t))).toBe(true);
});

test('axis ticks: every yearly bucket keeps its year (unchanged good behaviour)', () => {
  const intervals = ['2015', '2016', '2017'];
  const intervalDates = intervals.map(y => new Date(Date.UTC(Number(y), 0, 1)));
  const vm = buildOverview({ currency: 'USD', period: 'Yearly', intervalKeyFn: KEYFN.Yearly, intervals, intervalDates, postings: [] });
  expect(vm.monthly.map(b => b.tick)).toEqual(['2015', '2016', '2017']);
});

test('axis ticks for Quarterly read the quarter from the key (skewed legacy buckets)', () => {
  // compute's legacy Quarterly buckets are uneven, so the bucket date does not
  // align to a calendar quarter; the tick must come from the 'YYYY-Qn' key.
  const intervals = ['2015-Q1', '2015-Q2', '2015-Q3', '2015-Q4', '2016-Q1'];
  const intervalDates = [Date.UTC(2015, 0, 15), Date.UTC(2015, 1, 15), Date.UTC(2015, 5, 15), Date.UTC(2015, 9, 15), Date.UTC(2016, 0, 15)].map(t => new Date(t));
  const vm = buildOverview({ currency: 'USD', period: 'Quarterly', intervalKeyFn: KEYFN.Yearly, intervals, intervalDates, postings: [] });
  expect(vm.monthly.map(b => b.tick)).toEqual(['2015', 'Q2', 'Q3', 'Q4', '2016']);
});

test('axis ticks adapt: Daily over 10 years collapses to year-only marks', () => {
  const intervals = [], intervalDates = [];
  let d = new Date(Date.UTC(2015, 0, 1));
  const end = new Date(Date.UTC(2024, 11, 31));
  while (d <= end) { intervalDates.push(new Date(d)); intervals.push(d.toISOString().slice(0, 10)); d = new Date(d.getTime() + 86400000); }
  const vm = buildOverview({ currency: 'USD', period: 'Daily', intervalKeyFn: (x) => x.toISOString().slice(0, 10), intervals, intervalDates, postings: [] });
  const ticks = vm.monthly.map(b => b.tick);
  // ~10 year labels, and no finer (quarter/month) clutter over such a wide span
  expect(ticks.filter(t => /^\d{4}$/.test(t)).length).toBeGreaterThanOrEqual(10);
  expect(ticks.some(t => /^Q/.test(t))).toBe(false);
});

test('axis ticks adapt: Daily over ~10 days marks individual days', () => {
  const intervals = [], intervalDates = [];
  for (let day = 2; day <= 11; day++) {
    const dt = new Date(Date.UTC(2015, 2, day));
    intervalDates.push(dt); intervals.push(dt.toISOString().slice(0, 10));
  }
  const vm = buildOverview({ currency: 'USD', period: 'Daily', intervalKeyFn: (x) => x.toISOString().slice(0, 10), intervals, intervalDates, postings: [] });
  const ticks = vm.monthly.map(b => b.tick);
  // every day in a short window gets a label (fine detail when zoomed right in)
  expect(ticks.filter(Boolean).length).toBe(10);
});

test('axis ticks adapt: Monthly over a single year shows month names between quarters', () => {
  const intervals = [], intervalDates = [];
  for (let i = 0; i < 12; i++) {
    const dt = new Date(Date.UTC(2015, i, 1));
    intervalDates.push(dt); intervals.push('2015-' + String(i + 1).padStart(2, '0'));
  }
  const vm = buildOverview({ currency: 'USD', period: 'Monthly', intervalKeyFn: KEYFN.Monthly, intervals, intervalDates, postings: [] });
  const ticks = vm.monthly.map(b => b.tick);
  expect(ticks[0]).toBe('2015');
  expect(ticks).toContain('Feb');  // bare month between quarter marks
  expect(ticks).toContain('Q2');   // quarter start still labelled as the quarter
});

test('buildAssets carries unique keys and sparse year/quarter ticks', () => {
  const balances = new Map([[{ account: 'Assets:Bank', type: 'assets' }, [1, 2, 3, 4]]]);
  const intervalDates = [Date.UTC(2015, 0, 1), Date.UTC(2015, 3, 1), Date.UTC(2015, 6, 1), Date.UTC(2016, 0, 1)].map(t => new Date(t));
  const intervals = ['2015-01', '2015-04', '2015-07', '2016-01'];
  const vm = buildAssets({ period: 'Monthly', intervalKeyFn: KEYFN.Monthly, intervals, intervalDates, balances });
  expect(vm.data.map(d => d.tick)).toEqual(['2015', 'Q2', 'Q3', '2016']);
  expect(vm.data.map(d => d.key)).toEqual(intervals);
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
