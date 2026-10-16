// The sim stream fingerprint under vitest. The baseline and the history of
// every rebaseline live in scripts/fingerprint.ts, which is still a probe in
// its own right (npx vite-node scripts/fingerprint.ts); this reads the same
// EXPECTED, so a rebaseline is made in one place.
import { describe, expect, it } from 'vitest'
import { EXPECTED, fingerprint } from '../scripts/fingerprint'

describe('fingerprint', () => {
  it('six fixed-seed matches score exactly as the baseline says', () => {
    expect(fingerprint()).toEqual(EXPECTED)
  })
})
