const { ValuationService } = require('./valuation');
const s = new ValuationService();
const postings = [
  { dateString: '2024-01-01', accounts: ['Assets', 'Depot'], amount: 1, currency: '"VWRD.L"' },
  { dateString: '2024-01-01', accounts: ['Assets', 'Bank'], amount: -100, currency: 'EUR' }
];
const postingsCost = [
  { date: '2024-01-01', account: 'Assets:Depot', quantity: 100, commodity: 'EUR' },
  { date: '2024-01-01', account: 'Assets:Bank', quantity: -100, commodity: 'EUR' },
  { date: '2024-01-01', account: 'Assets:Bank:Fees', quantity: 5, commodity: 'EUR' }
];
s.calculateRunningBalances(postings, postingsCost, 'EUR');
