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
            'Income:Gehalt:Bonus',
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
            // "Income:Gehalt:*" Geschwister ("Income:Gehalt:Bonus") wird ebenfalls
            // deselektiert — die Isolierung muss rekursiv auf JEDER Ebene des
            // Pfades greifen, nicht nur auf der obersten.
            expect(result.has('Income:Gehalt:Bonus')).toBe(true);
        });

        it('toggling a fully-visible parent with no hidden descendants just hides the parent', () => {
            // Voll angehakt (nichts versteckt) → Klick blendet den gesamten Teilbaum aus.
            // Da keine Nachfahren aktuell versteckt sind, reicht der Root-Eintrag.
            const desel = new Set();
            const result = toggleAccountInDesel('Income', desel, tree);

            expect(result.has('Income')).toBe(true);
            expect(result.size).toBe(1);
        });

        it('toggling a mixed/off parent whose own entry AND a descendant are both hidden switches everything on (bug report)', () => {
            // Reproduziert den gemeldeten Fehler: 'Income' selbst UND ein Kind
            // ('Income:Rente') stehen in desel (Zustand nach fehlerhaftem "aus"-Klick,
            // der die Nachfahren nicht geräumt hat). Erneuter Klick auf 'Income' MUSS
            // den gesamten Teilbaum wieder sichtbar machen — weder 'Income' noch
            // 'Income:Rente' dürfen im Ergebnis übrig bleiben.
            const desel = new Set(['Income', 'Income:Rente']);
            const result = toggleAccountInDesel('Income', desel, tree);

            expect(result.has('Income')).toBe(false);
            expect(result.has('Income:Rente')).toBe(false);
        });

        it('toggling a mixed (indeterminate) parent with one hidden child switches the whole subtree on', () => {
            // 'Income' selbst ist sichtbar, aber 'Income:Rente' ist versteckt →
            // Checkbox zeigt "gemischt" (indeterminate). Klick MUSS den gesamten
            // Income-Teilbaum einschalten, nicht 'Income' zusätzlich ausblenden.
            const desel = new Set(['Income:Rente']);
            const result = toggleAccountInDesel('Income', desel, tree);

            expect(result.has('Income')).toBe(false);
            expect(result.has('Income:Rente')).toBe(false);
        });

        it('toggling a parent that looks mixed only because of a hidden grandchild switches the whole subtree on', () => {
            // Nur ein tiefer Enkel ist versteckt ('Income:Gehalt:Elterngeld') →
            // 'Income' erscheint gemischt. Klick auf 'Income' muss auch diesen
            // tiefen Nachfahren wieder einschalten.
            const desel = new Set(['Income:Gehalt:Elterngeld']);
            const result = toggleAccountInDesel('Income', desel, tree);

            expect(result.has('Income')).toBe(false);
            expect(result.has('Income:Gehalt:Elterngeld')).toBe(false);
        });

        it('isolating a level-3 leaf hides its level-1 AND level-2 sibling branches (recursive isolate)', () => {
            // Ausgangszustand: gesamter 'Income'-Zweig aus. Klick auf den tiefen
            // Blattknoten 'Income:Gehalt:Elterngeld' muss ihn isolieren: alle
            // blockierenden Vorfahren räumen UND auf JEDER Ebene die jeweiligen
            // Geschwister ausblenden — sowohl Ebene 1 ('Income:Rente') als auch
            // Ebene 2 ('Income:Gehalt:Bonus').
            const desel = new Set(['Income']);
            const result = toggleAccountInDesel('Income:Gehalt:Elterngeld', desel, tree);

            expect(result.has('Income')).toBe(false);
            expect(result.has('Income:Gehalt')).toBe(false);
            expect(result.has('Income:Gehalt:Elterngeld')).toBe(false);
            expect(result.has('Income:Rente')).toBe(true);
            expect(result.has('Income:Gehalt:Bonus')).toBe(true);
        });
    });
});
