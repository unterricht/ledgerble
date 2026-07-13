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
 * Tri-state checkbox toggle: a click does what the checkbox's visual state
 * promises.
 *
 * - Fully checked (visible, no hidden descendant) → click hides the WHOLE
 *   subtree (self + any stray descendant entries are cleared first, then
 *   `path` itself is added).
 *
 * - Empty or indeterminate/mixed (self hidden via itself/an ancestor, OR at
 *   least one descendant hidden) → click shows the WHOLE subtree: `path`
 *   and all its descendant entries are removed from desel, and if an
 *   ancestor is still blocking visibility, that ancestor (and every
 *   intermediate node down to `path`'s parent) is isolated by removing it
 *   from desel and hiding its sibling branches at each level — recursively,
 *   not just at the top level.
 */
function toggleAccountInDesel(path, desel, accountTree) {
    const n = new Set(desel);

    const off = isDeselectedDeep(path, n); // self or an ancestor hides it
    let hasHiddenDescendant = false;
    for (const d of n) {
        if (d.startsWith(path + ':')) { hasHiddenDescendant = true; break; }
    }

    // Fully checked → hide the whole subtree.
    if (!off && !hasHiddenDescendant) {
        for (const d of Array.from(n)) {
            if (d.startsWith(path + ':')) n.delete(d);
        }
        n.add(path);
        return n;
    }

    // Empty or mixed → show the whole subtree.
    n.delete(path);
    for (const d of Array.from(n)) {
        if (d.startsWith(path + ':')) n.delete(d);
    }

    const parts = path.split(':');

    // Find the topmost real ancestor still blocking visibility.
    let blockDepth = -1;
    for (let depth = 1; depth < parts.length; depth++) {
        const ancestor = parts.slice(0, depth).join(':');
        if (n.has(ancestor)) { blockDepth = depth; break; }
    }
    if (blockDepth === -1) return n;

    // Isolate `path` from blockDepth down to its parent: at each level,
    // remove the ancestor from desel and hide its sibling branches instead.
    for (let depth = blockDepth; depth < parts.length; depth++) {
        const ancestor = parts.slice(0, depth).join(':');
        n.delete(ancestor);

        const nextSegment = parts[depth];
        const ancestorNode = getNodeAtPath(accountTree, ancestor);
        for (const sibling of Object.keys(ancestorNode)) {
            if (sibling !== nextSegment) n.add(ancestor + ':' + sibling);
        }
    }

    return n;
}

module.exports = { buildAccountTree, isDeselected, isDeselectedDeep, filterPostings, toggleAccountInDesel };
