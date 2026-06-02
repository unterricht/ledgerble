const { buildOverview } = require('../src/data/adapters');

// minimal compute-model stand-in
const model = {
  currency: 'USD',
  postings: [
    { accounts:['Income','Salary'], amount:-1000, type:'income', date:new Date('2018-01-15T00:00:00Z') },
    { accounts:['Expenses','Food'], amount:200, type:'expenses', date:new Date('2018-01-16T00:00:00Z') },
    { accounts:['Expenses','Food'], amount:300, type:'expenses', date:new Date('2018-02-16T00:00:00Z') },
    { accounts:['Income','Salary'], amount:-1000, type:'income', date:new Date('2018-02-15T00:00:00Z') },
  ],
  intervals: ['2018-01','2018-02'],
};

test('buildOverview produces monthly bars, totals and a stat strip', () => {
  const vm = buildOverview(model);
  expect(vm.monthly).toHaveLength(2);
  expect(vm.monthly[0]).toMatchObject({ m: expect.any(String), inc: 1000, exp: 200 });
  expect(vm.statStrip.income).toBe(2000);
  expect(vm.statStrip.expenses).toBe(500);
  expect(vm.statStrip.net).toBe(1500);
  expect(vm.statStrip.savingsRate).toBe(75); // round(1500/2000*100)
  // expense categories aggregated with avg/max/min/total
  const food = vm.expenses.find(e => e.cat.endsWith('Food'));
  expect(food.total).toBe(500);
});

test('buildOverview income category aggregation', () => {
  const vm = buildOverview(model);
  expect(vm.income.find(i => i.cat.endsWith('Salary')).total).toBe(2000);
});

test('buildOverview savingsRate is 0 when there is no income', () => {
  expect(buildOverview({ currency: 'USD', postings: [], intervals: [] }).statStrip.savingsRate).toBe(0);
});
