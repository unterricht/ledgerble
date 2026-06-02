import { build } from 'esbuild';
import { readFileSync } from 'fs';

// Read package.json to get the list of dependencies that should NOT be bundled
// for the main process, but SHOULD be bundled for the renderer.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

await build({
  entryPoints: ['src/app/index.jsx'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'browser',
  format: 'iife',
  external: ['electron'],
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.jsx': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});

console.log('✅ Bundle built: dist/bundle.js');
