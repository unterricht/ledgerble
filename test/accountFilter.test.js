const { buildAccountTree, filterPostings, isDeselected } = require('../accountFilter');

describe('accountFilter', () => {
    it('builds account tree from array of account strings', () => {
        const accounts = [
            'assets:income:work',
            'assets:income:dividends',
            'expenses:Amazon'
        ];
        
        const tree = buildAccountTree(accounts);
        expect(tree).toEqual({
            assets: {
                income: {
                    work: {},
                    dividends: {}
                }
            },
            expenses: {
                Amazon: {}
            }
        });
    });

    it('identifies if an account is deselected exactly', () => {
        const deselected = new Set(['assets:income']);
        
        expect(isDeselected('assets:income', deselected)).toBe(true);
        expect(isDeselected('assets:income:work', deselected)).toBe(false);
        expect(isDeselected('assets', deselected)).toBe(false);
        expect(isDeselected('expenses:Amazon', deselected)).toBe(false);
    });

    it('filters postings based on exact deselected accounts', () => {
        const postings = [
            { accountsFmtd: () => 'assets:income:work', amount: 100 },
            { accountsFmtd: () => 'assets:income:dividends', amount: 50 },
            { accountsFmtd: () => 'expenses:Amazon', amount: 10 }
        ];

        const deselected = new Set(['assets:income:dividends']);
        const filtered = filterPostings(postings, deselected);

        expect(filtered).toHaveLength(2);
        expect(filtered[0].amount).toBe(100);
        expect(filtered[1].amount).toBe(10);
    });
});
