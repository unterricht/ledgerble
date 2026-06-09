/**
 * Guard against the packaged app crashing on launch with "Cannot find module".
 *
 * electron-builder's `build.files` is an explicit whitelist: only listed files
 * land in app.asar. `npm start` runs from the source tree (every file present),
 * so a module missing from the whitelist is invisible until someone installs
 * the dmg/AppImage — then main.js's `require('./x')` throws before the window
 * even opens. This test crawls the main-process require() graph from the entry
 * points and asserts every reachable local module is actually packaged.
 *
 * The renderer is bundled separately into dist/bundle.js, so we only follow the
 * CommonJS main-process graph here.
 */
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');

const ROOT = path.join(__dirname, '..');

// Returns the set of "<name>.js" local modules reachable from the entry points
// by following require('./name') edges (ignores node_modules and subpaths like
// require('./locales/..'), which are covered by the locales/** glob).
function reachableLocalModules(entryPoints) {
  const seen = new Set();
  const queue = [...entryPoints];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    const re = /require\(['"]\.\/([a-zA-Z0-9_]+)['"]\)/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      queue.push(`${m[1]}.js`);
    }
  }
  return seen;
}

test('every main-process module reachable from the entry points is in build.files', () => {
  const reachable = reachableLocalModules(['main.js', 'preload.js']);
  const packaged = new Set(pkg.build.files);
  const missing = [...reachable].filter((f) => !packaged.has(f)).sort();
  expect(missing).toEqual([]);
});
