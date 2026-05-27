const { ValuationService } = require('../valuation.js');

describe('ValuationService', () => {
    let service;

    beforeEach(() => {
        service = new ValuationService();
    });

    describe('detectBaseCurrency', () => {
        it('should return the most frequent currency in postings', () => {
            const postings = [
                { commodity: 'EUR' },
                { commodity: 'EUR' },
                { commodity: 'USD' },
                { commodity: 'VWRD.L' }
            ];
            const baseCurrency = service.detectBaseCurrency(postings);
            expect(baseCurrency).toBe('EUR');
        });

        it('should default to EUR if no postings are provided', () => {
            expect(service.detectBaseCurrency([])).toBe('EUR');
        });
    });

    describe('parsePrices', () => {
        it('should parse prices correctly', () => {
            const rawPrices = [
                { date: '2024-01-01', commodity: 'VWRD.L', price: 100.5, priceCommodity: 'EUR' },
                { date: '2024-01-02', commodity: 'USD', price: 0.9, priceCommodity: 'EUR' }
            ];
            service.parsePrices(rawPrices);
            expect(service.prices['VWRD.L']).toBeDefined();
            expect(service.prices['VWRD.L']['2024-01-01']).toEqual({ price: 100.5, currency: 'EUR' });
            expect(service.prices['USD']['2024-01-02']).toEqual({ price: 0.9, currency: 'EUR' });
        });
    });

    describe('getHistoricalPrice', () => {
        it('should return exact price match for a date', () => {
            service.parsePrices([
                { date: '2024-01-01', commodity: 'VWRD.L', price: 100, priceCommodity: 'EUR' },
                { date: '2024-01-05', commodity: 'VWRD.L', price: 105, priceCommodity: 'EUR' }
            ]);
            const priceInfo = service.getHistoricalPrice('VWRD.L', '2024-01-05');
            expect(priceInfo).toEqual({ price: 105, currency: 'EUR' });
        });

        it('should carry forward the previous price if exact date is missing', () => {
            service.parsePrices([
                { date: '2024-01-01', commodity: 'VWRD.L', price: 100, priceCommodity: 'EUR' },
                { date: '2024-01-05', commodity: 'VWRD.L', price: 105, priceCommodity: 'EUR' }
            ]);
            const priceInfo = service.getHistoricalPrice('VWRD.L', '2024-01-03');
            expect(priceInfo).toEqual({ price: 100, currency: 'EUR' });
        });

        it('should fallback to mathematical calculation (Cost Basis / Quantity) if no prior price exists', () => {
            service.parsePrices([
                { date: '2024-01-05', commodity: 'VWRD.L', price: 105, priceCommodity: 'EUR' }
            ]);
            
            // Purchase was on 2024-01-01
            const fallbackPriceInfo = service.getHistoricalPrice('VWRD.L', '2024-01-02', {
                quantity: 2,
                costBasis: 220,
                costCurrency: 'EUR'
            });
            
            expect(fallbackPriceInfo).toEqual({ price: 110, currency: 'EUR' });
        });

        it('should return null if no price and no fallback info is available', () => {
            service.parsePrices([
                { date: '2024-01-05', commodity: 'VWRD.L', price: 105, priceCommodity: 'EUR' }
            ]);
            const priceInfo = service.getHistoricalPrice('VWRD.L', '2024-01-02');
            expect(priceInfo).toBeNull();
        });
    });

    describe('convertCurrency', () => {
        beforeEach(() => {
            service.parsePrices([
                { date: '2024-01-01', commodity: 'USD', price: 0.9, priceCommodity: 'EUR' }, // 1 USD = 0.9 EUR
                { date: '2024-01-05', commodity: 'CHF', price: 1.05, priceCommodity: 'EUR' } // 1 CHF = 1.05 EUR
            ]);
        });

        it('should return same amount if from and to currencies match', () => {
            expect(service.convertCurrency(100, 'EUR', 'EUR', '2024-01-03')).toBe(100);
        });

        it('should convert directly (from -> to rate exists)', () => {
            // Convert 100 USD to EUR on 2024-01-02. Rate should be 0.9 (from 2024-01-01).
            const amount = service.convertCurrency(100, 'USD', 'EUR', '2024-01-02');
            expect(amount).toBe(90);
        });

        it('should convert inversely (to -> from rate exists)', () => {
            // Convert 90 EUR to USD on 2024-01-02. Inverse rate: 1 EUR = 1 / 0.9 USD.
            const amount = service.convertCurrency(90, 'EUR', 'USD', '2024-01-02');
            expect(amount).toBeCloseTo(100, 5);
        });

        it('should return null if conversion rate cannot be found', () => {
            const amount = service.convertCurrency(100, 'GBP', 'EUR', '2024-01-02');
            expect(amount).toBeNull();
        });
    });

    describe('calculateRunningBalances', () => {
        it('should warn and use map-based matching when postings and postingsCost lengths differ', () => {
            const postings = [
                { date: '2024-01-01', account: 'Assets:Depot', quantity: 2, commodity: 'VWRD.L' }
            ];
            const postingsCost = [];

            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const result = service.calculateRunningBalances(postings, postingsCost, 'EUR');
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Ledger output mismatch')
            );
            // Should still produce a result (graceful degradation)
            expect(result.balances).toBeDefined();
            expect(result.baseCurrency).toBe('EUR');
            warnSpy.mockRestore();
        });

        it('should calculate running balances correctly', () => {
            service.parsePrices([
                { date: '2024-01-02', commodity: 'VWRD.L', price: 110, priceCommodity: 'EUR' },
                { date: '2024-01-04', commodity: 'VWRD.L', price: 115, priceCommodity: 'EUR' }
            ]);

            const postings = [
                // Buy 2 shares
                { date: '2024-01-01', account: 'Assets:Depot', quantity: 2, commodity: 'VWRD.L' },
                // Buy 1 share
                { date: '2024-01-03', account: 'Assets:Depot', quantity: 1, commodity: 'VWRD.L' }
            ];

            const postingsCost = [
                { quantity: 200, commodity: 'EUR' }, // Cost: 200 EUR (Lot price: 100)
                { quantity: 112, commodity: 'EUR' }  // Cost: 112 EUR (Lot price: 112)
            ];

            const { balances, baseCurrency } = service.calculateRunningBalances(postings, postingsCost, 'EUR');
            
            expect(baseCurrency).toBe('EUR');
            
            // On 2024-01-01: 2 shares, no price yet -> fallback lot price = 100.
            // Market value = 2 * 100 = 200. Cost basis = 200. Unrealized = 0.
            expect(balances['Assets:Depot']['VWRD.L']['2024-01-01']).toEqual({
                quantity: 2,
                costBasis: 200,
                marketValue: 200,
                unrealizedGain: 0
            });

            // On 2024-01-03: 3 shares, price carry forward from 2024-01-02 = 110.
            // Market value = 3 * 110 = 330.
            // Cumulative Cost basis = 200 + 112 = 312. Unrealized = 330 - 312 = 18.
            expect(balances['Assets:Depot']['VWRD.L']['2024-01-03']).toEqual({
                quantity: 3,
                costBasis: 312,
                marketValue: 330,
                unrealizedGain: 18
            });
        });
    });

    describe('_addDays edge cases', () => {
        it('should return null for undefined input', () => {
            expect(service._addDays(undefined, 1)).toBeNull();
        });

        it('should return null for null input', () => {
            expect(service._addDays(null, 1)).toBeNull();
        });

        it('should return null for non-string input', () => {
            expect(service._addDays(12345, 1)).toBeNull();
        });

        it('should return null for an invalid date string', () => {
            expect(service._addDays('not-a-date', 1)).toBeNull();
        });

        it('should correctly add days to a valid date string', () => {
            expect(service._addDays('2024-01-01', 1)).toBe('2024-01-02');
        });

        it('should correctly subtract days from a valid date string', () => {
            expect(service._addDays('2024-01-05', -3)).toBe('2024-01-02');
        });

        it('should handle month boundaries', () => {
            expect(service._addDays('2024-01-31', 1)).toBe('2024-02-01');
        });
    });

    describe('getHistoricalPrice with invalid dateStr', () => {
        it('should not throw for undefined dateStr and return fallback', () => {
            service.parsePrices([
                { date: '2024-01-01', commodity: 'VWRD.L', price: 100, priceCommodity: 'EUR' }
            ]);
            const result = service.getHistoricalPrice('VWRD.L', undefined, {
                quantity: 2, costBasis: 200, costCurrency: 'EUR'
            });
            // Should use fallback instead of crashing
            expect(result).toEqual({ price: 100, currency: 'EUR' });
        });

        it('should not throw for undefined dateStr with no fallback', () => {
            service.parsePrices([
                { date: '2024-01-01', commodity: 'VWRD.L', price: 100, priceCommodity: 'EUR' }
            ]);
            const result = service.getHistoricalPrice('VWRD.L', undefined);
            expect(result).toBeNull();
        });
    });

    describe('getAccountValueAtDate edge cases', () => {
        it('should return zeros for falsy dateStr', () => {
            const balances = { 'Assets:Depot': { 'VWRD.L': { '2024-01-01': { quantity: 2, costBasis: 200, marketValue: 220 } } } };
            const result = service.getAccountValueAtDate(balances, 'EUR', 'Assets:Depot', 'VWRD.L', undefined);
            expect(result).toEqual({ quantity: 0, marketValue: 0, costBasis: 0 });
        });

        it('should return zeros for empty string dateStr', () => {
            const balances = { 'Assets:Depot': { 'VWRD.L': { '2024-01-01': { quantity: 2, costBasis: 200, marketValue: 220 } } } };
            const result = service.getAccountValueAtDate(balances, 'EUR', 'Assets:Depot', 'VWRD.L', '');
            expect(result).toEqual({ quantity: 0, marketValue: 0, costBasis: 0 });
        });
    });
});
