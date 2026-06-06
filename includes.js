/**
 * Parsing of ledger/hledger `include` directives.
 *
 * Pure logic (no fs) so it can be unit-tested directly; the caller injects a
 * `readFile(absPath) -> string` function. main.js wires it with fs.readFileSync.
 */
const path = require('path');

// Match `include <path>` and `!include <path>` (hledger), optionally quoted.
// Anything after the path on the same line is ignored.
const INCLUDE_RE = /^\s*!?include\s+(.+?)\s*$/;

function parseIncludeLines(content) {
  const out = [];
  for (const line of String(content).split(/\r?\n/)) {
    const m = line.match(INCLUDE_RE);
    if (m) out.push(m[1].replace(/^["']|["']$/g, ''));
  }
  return out;
}

/**
 * Build a nested include tree for the file at `rootPath`.
 * Returns an array of { path, includes: [...] } for the files included BY
 * rootPath (rootPath itself is not part of the result). Relative includes are
 * resolved against the including file's directory; cycles are guarded.
 */
function collectIncludes(rootPath, readFile, _seen) {
  const seen = _seen || new Set();
  const abs = path.resolve(rootPath);
  if (seen.has(abs)) return [];
  seen.add(abs);

  let content;
  try { content = readFile(abs); } catch { return []; }
  if (!content) return [];

  const dir = path.dirname(abs);
  const children = [];
  for (const rel of parseIncludeLines(content)) {
    const childAbs = path.isAbsolute(rel) ? rel : path.resolve(dir, rel);
    if (seen.has(childAbs)) continue;   // skip cycles and already-listed files
    children.push({ path: childAbs, includes: collectIncludes(childAbs, readFile, seen) });
  }
  return children;
}

// Path-free redundancy helpers live in src/data/redundancy.js so the browser
// renderer can import them without bundling Node's `path`; re-exported here for
// the main process and existing tests.
const { flattenIncludePaths, findRedundantFiles } = require('./src/data/redundancy');

module.exports = { parseIncludeLines, collectIncludes, flattenIncludePaths, findRedundantFiles };
