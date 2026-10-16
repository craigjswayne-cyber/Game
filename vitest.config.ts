// vitest, adopted a project at a time (1.9.1). `unit` is the fast,
// deterministic set under tests/: no browser, no build, about a minute.
// The probes in scripts/ stay as they are; see docs/testing.md.
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          environment: 'node',
          testTimeout: 60_000,
        },
      },
    ],
  },
})
