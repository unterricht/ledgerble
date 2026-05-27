const assert = require('assert');
const { ValuationService } = require('../valuation');

describe('ValuationService - detectBaseCurrencies', () => {
    it('should detect currencies used in income/expenses', () => {
        const postings = [
            { currency: 'VWRD.L', type: 'assets' },
            { currency: 'EUR', type: 'expenses' },
            { currency: 'USD', type: 'income' }
        ];
        const val = new ValuationService();
        const base = val.detectBaseCurrencies(postings, []);
        assert.deepStrictEqual(Array.from(base).sort(), ['EUR', 'USD']);
    });

    it('should detect currencies used as priceCommodity', () => {
        const postings = [
            { currency: 'VWRD.L', type: 'assets' },
            { currency: 'EUR', type: 'assets' }
        ];
        const prices = [
            { commodity: 'VWRD.L', priceCommodity: 'EUR' }
        ];
        const val = new ValuationService();
        const base = val.detectBaseCurrencies(postings, prices);
        assert.deepStrictEqual(Array.from(base).sort(), ['EUR']);
    });

    it('should fallback to most frequent currency if no other heuristic matches', () => {
        const postings = [
            { currency: 'VWRD.L', type: 'assets' },
            { currency: 'EUR', type: 'assets' },
            { currency: 'EUR', type: 'assets' }
        ];
        const val = new ValuationService();
        const base = val.detectBaseCurrencies(postings, []);
        assert.deepStrictEqual(Array.from(base).sort(), ['EUR']);
    });
});
