// Pro Manager watches nothing (1.9.6). "No adverts, ever" is what Pro sells,
// and a Pro manager in France was played an advert by the agency's gold
// button. The favour is granted without the spot; a free player still watches.
import { beforeEach, describe, expect, it } from 'vitest'

const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
} as Storage

const M = await import('../src/game/monetise')
const g = globalThis as unknown as { rmAds?: unknown }
let shown: string[] = []
beforeEach(() => {
  store.clear(); shown = []
  g.rmAds = { mount: () => {}, showRewarded: async (p: string) => { shown.push(p); return 'completed' as const } }
})

describe('a rewarded favour', () => {
  it('plays the advert for a free player', async () => {
    expect(M.hasSupporter()).toBe(false)
    expect(await M.showRewarded('scouting')).toBe('completed')
    expect(shown).toEqual(['scouting'])
  })
  for (const sku of [M.SUPPORTER_SKU, M.PRO_INTRO_SKU]) {
    it(`is granted with no advert for a Pro manager (${sku})`, async () => {
      M.grant(sku)
      expect(M.hasSupporter()).toBe(true)
      for (const p of M.REWARDED_PLACES) expect(await M.showRewarded(p)).toBe('completed')
      expect(shown).toEqual([])
    })
  }
  it('stays offered to a Pro manager wherever a provider exists', () => {
    M.grant(M.SUPPORTER_SKU)
    for (const p of M.REWARDED_PLACES) expect(M.rewardedAvailable(p)).toBe(true)
  })
})
