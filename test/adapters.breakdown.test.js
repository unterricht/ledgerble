'use strict';

const { buildBreakdownTree } = require('../src/data/adapters');

const postings = [
  { accounts:['Expenses','School'], amount:999, type:'expenses' },          // direct on parent
  { accounts:['Expenses','School','Eraser'], amount:1, type:'expenses' },    // child
  { accounts:['Expenses','Food'], amount:200, type:'expenses' },
];

test('builds a tree with totals and a not-itemised remainder', () => {
  const tree = buildBreakdownTree(postings, 'expenses');
  const school = tree.find(n => n.label === 'School');
  expect(school.value).toBe(1000);                 // 999 direct + 1 child
  const eraser = school.children.find(c => c.label === 'Eraser');
  expect(eraser.value).toBe(1);
  // remainder is represented so 999 isn't a mystery box:
  const childSum = school.children.reduce((a,c)=>a+c.value,0);
  expect(school.value - childSum).toBe(999);
});
test('income kind flips sign (income amounts are negative)', () => {
  const inc = [{ accounts:['Income','Salary'], amount:-500, type:'income' }];
  const tree = buildBreakdownTree(inc, 'income');
  expect(tree.find(n => n.label === 'Salary').value).toBe(500);
});
