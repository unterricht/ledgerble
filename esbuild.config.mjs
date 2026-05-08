import { build } from 'esbuild';
import { readFileSync } from 'fs';

// Read package.json to get the list of dependencies that should NOT be bundled
// for the main process, but SHOULD be bundled for the renderer.
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

await build({
  entryPoints: ['ui.js'],
  bundle: true,
  outfile: 'dist/bundle.js',
  platform: 'browser',
  format: 'iife',
  // Externalize electron – it's not available in the renderer anymore
  external: ['electron'],
  // Define globals that esbuild needs to handle
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  // Source maps for debugging
  sourcemap: true,
  // Keep readable for now
  minify: false,
  logLevel: 'info',
});

console.log('✅ Bundle built: dist/bundle.js');
