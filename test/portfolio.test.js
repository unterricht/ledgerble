const { updatePortfolio } = require('../portfolio');

// Mock echarts
jest.mock('echarts', () => ({
    getInstanceByDom: jest.fn(() => null),
    init: jest.fn(() => ({
        setOption: jest.fn(),
        resize: jest.fn()
    }))
}));

// Mock jQuery ($) globally
global.$ = jest.fn(() => ({
    hide: jest.fn(),
    show: jest.fn(),
    html: jest.fn()
}));

describe('updatePortfolio', () => {
    const mockChartElement = { clientWidth: 800, clientHeight: 400 };
    const mockTableBody = {};
    const mockState = {
        formatter: val => `€${val.toFixed(2)}`
    };

    it('should return null if valResult is null', () => {
        const result = updatePortfolio(mockChartElement, mockTableBody, mockState, null, {}, 'EUR', ['2024-01-01']);
        expect(result).toBeNull();
    });

    it('should return null if valResult.balances is missing', () => {
        const result = updatePortfolio(mockChartElement, mockTableBody, mockState, {}, {}, 'EUR', ['2024-01-01']);
        expect(result).toBeNull();
    });

    it('should return null if intervals is empty', () => {
        const valResult = { balances: { 'Assets:Depot': { 'VWRD.L': {} } } };
        const result = updatePortfolio(mockChartElement, mockTableBody, mockState, valResult, {}, 'EUR', []);
        expect(result).toBeNull();
    });

    it('should return null if intervals is undefined', () => {
        const valResult = { balances: { 'Assets:Depot': { 'VWRD.L': {} } } };
        const result = updatePortfolio(mockChartElement, mockTableBody, mockState, valResult, {}, 'EUR', undefined);
        expect(result).toBeNull();
    });

    it('should return null (hide tab) if no non-base-currency assets exist', () => {
        const valResult = {
            balances: {
                'Assets:Bank': {
                    'EUR': { '2024-01-01': { quantity: 1000, costBasis: 1000, marketValue: 1000 } }
                }
            }
        };
        const result = updatePortfolio(mockChartElement, mockTableBody, mockState, valResult, {}, 'EUR', ['2024-01-01']);
        expect(result).toBeNull();
    });

    it('should return null when chart element is hidden (zero dimensions)', () => {
        const hiddenChartElement = { clientWidth: 0, clientHeight: 0 };
        const valuationService = {
            getAccountValueAtDate: jest.fn(() => ({ quantity: 2, marketValue: 220, costBasis: 200 }))
        };
        const valResult = {
            balances: {
                'Assets:Depot': {
                    'VWRD.L': { '2024-01-01': { quantity: 2, costBasis: 200, marketValue: 220 } }
                }
            }
        };
        const result = updatePortfolio(hiddenChartElement, mockTableBody, mockState, valResult, valuationService, 'EUR', ['2024-01-01']);
        expect(result).toBeNull();
    });

    it('should respect sliderValues to filter intervals and correctly aggregate data', () => {
        const valResult = {
            balances: {
                'Assets:Depot': {
                    'VWRD.L': { 
                        '2024-01-01': { quantity: 1, costBasis: 100, marketValue: 110 },
                        '2024-01-02': { quantity: 1, costBasis: 100, marketValue: 120 },
                        '2024-01-03': { quantity: 1, costBasis: 100, marketValue: 130 }
                    }
                }
            }
        };
        const valuationService = {
            getAccountValueAtDate: jest.fn((balances, curr, acc, comm, date) => {
                return valResult.balances[acc][comm][date];
            })
        };
        const intervals = ['2024-01-01', '2024-01-02', '2024-01-03'];
        const sliderValues = [0, 1]; // Only the first two intervals
        
        const chartElement = { clientWidth: 800, clientHeight: 400 };
        const chartMock = { setOption: jest.fn(), resize: jest.fn() };
        require('echarts').init.mockReturnValue(chartMock);
        require('echarts').getInstanceByDom.mockReturnValue(chartMock);

        const result = updatePortfolio(chartElement, mockTableBody, mockState, valResult, valuationService, 'EUR', intervals, intervals, sliderValues);
        
        expect(result).not.toBeNull();
        expect(chartMock.setOption).toHaveBeenCalled();
        const options = chartMock.setOption.mock.calls[0][0];
        
        // Should only have data for 2024-01-01 and 2024-01-02
        expect(options.xAxis[0].data).toEqual(['2024-01-01', '2024-01-02']);
        expect(options.series[0].data).toEqual([100, 100]); // Cost basis
        expect(options.series[1].data).toEqual([10, 20]); // Unrealized gains
        
        // The table should use the latest date in the slider range (2024-01-02)
        const htmlCalls = global.$.mock.results.map(r => r.value.html.mock.calls).flat();
        expect(htmlCalls.length).toBeGreaterThan(0);
        const html = htmlCalls[htmlCalls.length - 1][0];
        expect(html).toContain('€120.00'); // Market value for 2024-01-02
    });
});
