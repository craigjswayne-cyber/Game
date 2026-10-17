import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }
const { version } = pkg

// This file compiles under tsconfig.node.json, which has no @types/node: the
// project has never needed them and one string is not a reason to start. So the
// stamp is built from plain JavaScript and one environment variable, declared
// here rather than pulled in wholesale.
declare const process: { env: Record<string, string | undefined> }

/**
 * A BUILD STAMP, so a phone can say which build it is running.
 *
 * Two people play this game on two different phones, and the only way to tell a
 * stale tab from a fresh deploy was to hunt for a feature and see whether it had
 * arrived. The title screen now carries the version and the build time in small
 * grey type at the foot of the page.
 *
 * UTC, and it says so. A time that means two different things on two phones is
 * worse than no time at all. The commit comes from GITHUB_SHA, which the deploy
 * runner always sets and a local build never does, so the deployed build - the
 * only one anybody plays - is the one that carries it.
 */
function buildTag(): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const when = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
    + ` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`
  const sha = (process.env.GITHUB_SHA ?? '').slice(0, 7)
  return `v${version} · ${when}${sha ? ` · ${sha}` : ''}`
}

/**
 * THE OFFLINE CACHE IS NAMED FOR THE BUILD (1.9.1). public/sw.js kept one
 * fixed cache name, so every build's hashed chunks piled up in the same cache
 * until somebody remembered to bump the name by hand. The copy in dist/ now
 * carries the build's own name, and the worker's activate step clears every
 * other cache when a new build takes over.
 */
function swCacheName() {
  let outDir = 'dist'
  return {
    name: 'sw-cache-name',
    apply: 'build' as const,
    configResolved(c: { root: string; build: { outDir: string } }) { outDir = `${c.root}/${c.build.outDir}` },
    async closeBundle() {
      // no @types/node in this project (see the note above), so the module is
      // named through a variable and typed by hand
      const fsName = 'node:fs/promises'
      const { readFile, writeFile } = await import(/* @vite-ignore */ fsName) as {
        readFile: (f: string, e: string) => Promise<string>
        writeFile: (f: string, d: string) => Promise<void>
      }
      const file = `${outDir}/sw.js`
      const src = await readFile(file, 'utf8').catch(() => null)
      if (src == null) return
      const name = `rugby-manager-${buildTag().replace(/[^\w.]+/g, '-')}`
      await writeFile(file, src.replace(/const CACHE = '[^']*'/, `const CACHE = '${name}'`))
    },
  }
}

export default defineConfig({
  plugins: [react(), swCacheName()],
  // the dictionaries are 700 to 840 KB each: shipped as a JSON.parse of one
  // string rather than a JavaScript object literal, which a phone parses
  // several times faster (1.9.1)
  json: { stringify: true, namedExports: false },
  base: './',
  define: { __BUILD_TAG__: JSON.stringify(buildTag()) },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // split the stable stuff out so routine updates only invalidate the
        // app chunk: vendor (react etc) and data (the squad database) change
        // far less often than game code
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          if (id.includes('/src/data/')) return 'data'
          // English is read by every career, including the engine's stored
          // English, so it loads at boot; its own chunk means a code-only
          // update does not make every phone download it again
          if (id.endsWith('/src/locales/en.json')) return 'lang-en'
        },
      },
    },
  },
})
