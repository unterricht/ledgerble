const { ValuationService } = require('./valuation');
const s = new ValuationService();
s.parsePrices([ { date: '2024-01-01', commodity: '"VWRD.L"', price: '100', priceCommodity: 'EUR' } ]);
const price = s.getHistoricalPrice('"VWRD.L"', '2024-01-01');
console.log(price);
