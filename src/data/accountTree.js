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

// Cascade-aware check: hidden if account itself OR any ancestor is in desel.
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

// Navigate the tree object to the node at the given colon-separated path.
// Returns {} if the path doesn't exist.
function getNodeAtPath(tree, path) {
    if (!path) return tree;
    let node = tree;
    for (const segment of path.split(':')) {
        if (!node || typeof node !== 'object') return {};
        node = node[segment];
        if (!node) return {};
    }
    return node || {};
}

/**
 * toggleAccountInDesel(path, desel, accountTree) → new Set
 *
 * Smart toggle that respects ancestor cascade:
 *
 * - If `path` is currently VISIBLE (not blocked by self or ancestor):
 *     → Add it to desel (hide it, cascade hides children too).
 *
 * - If `path` is currently HIDDEN (explicitly or via ancestor):
 *     → Remove it from desel, remove all blocking ancestors from desel,
 *       and add sibling branches of those ancestors to desel so only the
 *       chosen path remains visible within each ancestor's scope.
 *
 * This means: after clicking a hidden node it becomes visible while its
 * siblings stay hidden — exactly like a tree-select "isolate this branch".
 */
function toggleAccountInDesel(path, desel, accountTree) {
    const n = new Set(desel);

    if (!isDeselectedDeep(path, n)) {
        // Currently visible → hide it
        n.add(path);
        return n;
    }

    // Currently hidden → make it visible
    n.delete(path);

    // Walk up the ancestor chain and for each blocking ancestor:
    // remove the ancestor from desel, add all its OTHER direct children to desel.
    const parts = path.split(':');
    for (let depth = 1; depth < parts.length; depth++) {
        const ancestor = parts.slice(0, depth).join(':');
        if (!n.has(ancestor)) continue;

        n.delete(ancestor);

        // Find the direct child of `ancestor` that is ON the path to `path`
        const nextSegment = parts[depth];

        // Get all direct children of `ancestor` in the tree
        const ancestorNode = getNodeAtPath(accountTree, ancestor);
        for (const sibling of Object.keys(ancestorNode)) {
            if (sibling !== nextSegment) {
                n.add(ancestor ? ancestor + ':' + sibling : sibling);
            }
        }
    }

    return n;
}

module.exports = { buildAccountTree, isDeselected, isDeselectedDeep, filterPostings, toggleAccountInDesel };
