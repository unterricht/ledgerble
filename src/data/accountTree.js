'use strict';

/**
 * Pure account-tree functions extracted from accountFilter.js.
 * No DOM, no jQuery — safe to require from both main and renderer contexts.
 */

function buildAccountTree(accounts) {
    const tree = {};
    for (const account of accounts) {
        const parts = account.split(':');
        let current = tree;
        for (const part of parts) {
            if (!current[part]) {
                current[part] = {};
            }
            current = current[part];
        }
    }
    return tree;
}

function isDeselected(account, deselected) {
    if (!deselected) return false;
    return deselected.has(account);
}

// Cascade-aware: an account is filtered out if it is deselected itself OR sits
// below a deselected ancestor (so unchecking a parent hides its whole subtree).
// The 'd + ":"' guard prevents sibling-prefix false positives
// (e.g. deselecting "expenses:Food" must not swallow "expenses:FoodCourt").
function isDeselectedDeep(account, deselected) {
    if (!deselected || deselected.size === 0) return false;
    for (const d of deselected) {
        if (account === d || account.startsWith(d + ':')) return true;
    }
    return false;
}

function filterPostings(postings, deselected) {
    if (!deselected || deselected.size === 0) {
        return postings;
    }
    return postings.filter(p => !isDeselectedDeep(p.accountsFmtd(), deselected));
}

module.exports = { buildAccountTree, isDeselected, filterPostings };
