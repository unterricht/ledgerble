const { buildAccountTree, filterPostings, isDeselected, isDeselectedDeep, toggleAccountInDesel } = require('../src/data/accountTree');

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

    describe('isDeselectedDeep', () => {
        it('returns true if account is explicitly in desel', () => {
            expect(isDeselectedDeep('Income:Gehalt', new Set(['Income:Gehalt']))).toBe(true);
        });

        it('returns true if an ancestor is in desel (cascade)', () => {
            expect(isDeselectedDeep('Income:Gehalt:Elterngeld', new Set(['Income']))).toBe(true);
            expect(isDeselectedDeep('Income:Gehalt:Elterngeld', new Set(['Income:Gehalt']))).toBe(true);
        });

        it('returns false if neither account nor any ancestor is in desel', () => {
            expect(isDeselectedDeep('Income:Gehalt:Elterngeld', new Set(['Expenses']))).toBe(false);
            expect(isDeselectedDeep('Income:Gehalt', new Set())).toBe(false);
        });

        it('does not trigger on sibling-prefix false positives', () => {
            expect(isDeselectedDeep('Income:Gehalt', new Set(['IncomeOther']))).toBe(false);
        });
    });

    describe('toggleAccountInDesel', () => {
        const tree = buildAccountTree([
            'Income',
            'Income:Gehalt',
            'Income:Gehalt:Elterngeld',
            'Income:Rente',
            'Expenses:Food',
        ]);

        it('selects (removes from desel) an explicitly deselected account', () => {
            const desel = new Set(['Income:Gehalt']);
            const result = toggleAccountInDesel('Income:Gehalt', desel, tree);
            expect(result.has('Income:Gehalt')).toBe(false);
        });

        it('deselects (adds to desel) a currently visible account', () => {
            const desel = new Set();
            const result = toggleAccountInDesel('Income:Gehalt', desel, tree);
            expect(result.has('Income:Gehalt')).toBe(true);
        });

        it('making a child visible removes blocking ancestor and hides siblings', () => {
            // "None"-Zustand: nur Roots in desel (Kaskade versteckt alles)
            const desel = new Set(['Income', 'Expenses:Food']);
            // Nutzer klickt "Income:Gehalt" → sollte sichtbar werden
            const result = toggleAccountInDesel('Income:Gehalt', desel, tree);

            // "Income" ist nicht mehr in desel (Vorfahre entfernt)
            expect(result.has('Income')).toBe(false);
            // "Income:Gehalt" ist nicht in desel
            expect(result.has('Income:Gehalt')).toBe(false);
            // Geschwister "Income:Rente" wird explizit deselektiert (Kaskade-Ersatz)
            expect(result.has('Income:Rente')).toBe(true);
            // Expenses:Food bleibt in desel
            expect(result.has('Expenses:Food')).toBe(true);
        });

        it('selecting a deep child removes all blocking ancestors and sibling-branches', () => {
            const desel = new Set(['Income']);
            const result = toggleAccountInDesel('Income:Gehalt:Elterngeld', desel, tree);

            expect(result.has('Income')).toBe(false);
            expect(result.has('Income:Gehalt')).toBe(false);
            expect(result.has('Income:Gehalt:Elterngeld')).toBe(false);
            // Geschwisterzweig "Income:Rente" wird deselektiert
            expect(result.has('Income:Rente')).toBe(true);
            // "Income:Gehalt:*" Geschwister — es gibt keine anderen Kinder im Testbaum
        });
    });
});
