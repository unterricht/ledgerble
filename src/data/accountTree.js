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

function filterPostings(postings, deselected) {
    if (!deselected || deselected.size === 0) {
        return postings;
    }
    return postings.filter(p => {
        const account = p.accountsFmtd();
        return !isDeselected(account, deselected);
    });
}

module.exports = { buildAccountTree, isDeselected, filterPostings };
