const { buildAccountTree, filterPostings, isDeselected } = require('../src/data/accountTree');

describe('accountTree', () => {
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

    it('cascades: deselecting a parent account hides all its children', () => {
        const postings = [
            { accountsFmtd: () => 'assets:income:work', amount: 100 },
            { accountsFmtd: () => 'assets:income:dividends', amount: 50 },
            { accountsFmtd: () => 'expenses:Amazon', amount: 10 }
        ];

        // Deselecting the parent 'assets:income' must remove BOTH leaf children.
        const deselected = new Set(['assets:income']);
        const filtered = filterPostings(postings, deselected);

        expect(filtered).toHaveLength(1);
        expect(filtered[0].amount).toBe(10);
    });

    it('cascade does not match sibling accounts sharing a name prefix', () => {
        const postings = [
            { accountsFmtd: () => 'expenses:Food', amount: 10 },
            { accountsFmtd: () => 'expenses:FoodCourt', amount: 20 },
        ];
        // Deselecting 'expenses:Food' must NOT swallow 'expenses:FoodCourt'.
        const filtered = filterPostings(postings, new Set(['expenses:Food']));
        expect(filtered).toHaveLength(1);
        expect(filtered[0].amount).toBe(20);
    });
});
