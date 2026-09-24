import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    minify: false,
    sourcemap: true,
  },
  {
    // Standalone build for a plain <script> tag. Minified but not obfuscated:
    // the source is MIT and public, so hiding the bundle would only make it
    // harder for users to debug their own sites.
    entry: ['src/index.ts'],
    format: ['iife'],
    globalName: 'EditInPlaceLib',
    outDir: 'dist',
    minify: true,
    sourcemap: true,
    outExtension: () => ({ js: '.global.js' }),
  },
]);
