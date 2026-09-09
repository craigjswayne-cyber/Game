// A ONE-FILE BUILD, for a link somebody can play without a web server.
//
// vite.config.ts is untouched and stays the real one: it splits chunks and
// lazy-loads the four non-English languages, which is right for a web server
// and impossible inside a single HTML document. Here everything - all five
// languages, the font and the title image - goes into one bundle, and
// scripts/onefile.mjs folds that bundle into the HTML.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __BUILD_TAG__: JSON.stringify(`v${version} · playable preview`) },
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 10_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
