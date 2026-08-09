import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { version } from './package.json'

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

export default defineConfig({
  plugins: [react()],
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
        },
      },
    },
  },
})
