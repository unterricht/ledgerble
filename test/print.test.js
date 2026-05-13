const { setupPrintHeader } = require('../print');

describe('Print Header Generation', () => {
    let state;
    let mockHeader;
    let mockDateRangeFrom;
    let mockDateRangeTo;
    let mockDateUnitsSelector;
    let listeners;

    beforeEach(() => {
        listeners = {};
        global.window = {
            addEventListener: (event, cb) => { listeners[event] = cb; },
            dispatchEvent: (event) => { if (listeners[event.type]) listeners[event.type](); }
        };
        global.Event = class Event { constructor(type) { this.type = type; } };

        mockHeader = { innerHTML: '' };
        mockDateRangeFrom = { value: '2023-01-01' };
        mockDateRangeTo = { value: '2023-12-31' };
        mockDateUnitsSelector = { value: 'Monthly' };

        global.document = {
            getElementById: jest.fn((id) => {
                if (id === 'printHeader') return mockHeader;
                if (id === 'dateRangeFrom') return mockDateRangeFrom;
                if (id === 'dateRangeTo') return mockDateRangeTo;
                if (id === 'dateUnitsSelector') return mockDateUnitsSelector;
                return null;
            })
        };
        
        state = {
            files: new Map([
                ['/path/to/ledger1.dat', {}],
                ['C:\\Users\\user\\ledger2.dat', {}]
            ]),
            deselectedAccounts: new Set(['Expenses:Dining', 'Expenses:Entertainment'])
        };

        // Ensure fake timers so Date returns a consistent value if we need to, 
        // but here we can just check if it contains the current date.
    });

    afterEach(() => {
        delete global.window;
        delete global.document;
        delete global.Event;
        jest.clearAllMocks();
    });

    it('should populate #printHeader on beforeprint event', () => {
        setupPrintHeader(state);

        // Dispatch beforeprint
        const event = new Event('beforeprint');
        global.window.dispatchEvent(event);
        
        // Check files are correctly formatted (basenames)
        expect(mockHeader.innerHTML).toContain('ledger1.dat, ledger2.dat');
        
        // Check current date is present
        const date = new Date().toLocaleDateString();
        expect(mockHeader.innerHTML).toContain(date);

        // Check filter values
        expect(mockHeader.innerHTML).toContain('2023-01-01 to 2023-12-31');
        expect(mockHeader.innerHTML).toContain('(Monthly)');
        expect(mockHeader.innerHTML).toContain('Deselected: Expenses:Dining, Expenses:Entertainment');
    });

    it('should show "All categories active" when no accounts are deselected', () => {
        state.deselectedAccounts = new Set();
        setupPrintHeader(state);

        global.window.dispatchEvent(new Event('beforeprint'));

        expect(mockHeader.innerHTML).toContain('All categories active');
    });

    it('should summarize deselected categories by showing only the highest completely deselected node', () => {
        state.deselectedAccounts = new Set([
            'Expenses:Home',
            'Expenses:Work',
            'Expenses:Work:travel',
            'Expenses:Work:suits',
            'Income:Salary:Bonus'
        ]);
        setupPrintHeader(state);

        global.window.dispatchEvent(new Event('beforeprint'));

        // Should contain Expenses:Home, Expenses:Work, and Income:Salary:Bonus
        // But should NOT contain :travel or :suits
        expect(mockHeader.innerHTML).toContain('Deselected: Expenses:Home, Expenses:Work, Income:Salary:Bonus');
        expect(mockHeader.innerHTML).not.toContain(':travel');
        expect(mockHeader.innerHTML).not.toContain(':suits');
    });
});
