/**
 * redundancy.js — path-free helpers for de-duplicating already-included files.
 *
 * Kept separate from `includes.js` (which uses Node's `path`) so the browser
 * renderer can import these without esbuild trying to bundle `path`.
 */
'use strict';

// Flatten an include tree (from collectIncludes) into a flat list of paths.
function flattenIncludePaths(tree) {
  const out = [];
  for (const node of tree || []) {
    out.push(node.path);
    out.push(...flattenIncludePaths(node.includes));
  }
  return out;
}

/**
 * Given the loaded top-level file paths and their include trees
 * ({ [path]: tree }), return the Set of paths that are already pulled in
 * (transitively) by another loaded file — i.e. redundant, and would
 * double-count if also merged on their own.
 *
 * Guard: if EVERY file would be redundant (e.g. two files that include each
 * other), nothing is dropped — better to show possibly-doubled data than an
 * empty app.
 */
function findRedundantFiles(paths, includesByFile) {
  const closures = new Map();
  for (const p of paths) {
    closures.set(p, new Set(flattenIncludePaths((includesByFile || {})[p])));
  }
  const redundant = new Set();
  for (const p of paths) {
    for (const q of paths) {
      if (q === p) continue;
      if (closures.get(q).has(p)) { redundant.add(p); break; }
    }
  }
  if (paths.length > 0 && redundant.size === paths.length) return new Set();
  return redundant;
}

module.exports = { flattenIncludePaths, findRedundantFiles };
