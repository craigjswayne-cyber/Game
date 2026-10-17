/**
 * ---- WHAT THE STORE STILL AGREES TO (1.8.18; was scripts/refundprobe.ts) ----
 *
 * The 12 Oct 2026 review found four ways the till and the store could
 * disagree, each fixed in 1.8.18 and each held here:
 *
 *   1. owned() could not say whether the store had answered. [] meant both
 *      "owns nothing" and "could not ask", so nothing could ever safely be
 *      taken back. ownedState() now carries `ok`, and only an explicit
 *      `ok: true` from the native side counts.
 *   2. A refund was never taken back. Pro stayed unlocked for ever after a
 *      self-service refund. The rule now: two REAL answers that leave the
 *      product out, in two different launches, at least a day apart (a crash
 *      reload is a new launch seconds later). Errors, timeouts and older
 *      shells never move the count; a later answer that lists it again wipes
 *      the note. The paid edition is never touched.
 *   3. A purchase that landed while the game was open went unnoticed until
 *      the next launch. restore() now runs on a shell event and on returning
 *      to the app, so the same purchase can reach it three ways - it must be
 *      granted once.
 *   4. iOS listed two held purchases of one consumable as one, and finished
 *      both on one consume, so one payment banked nothing. The sweep must
 *      bank one credit per payment.
 *
 * The native halves (PhaseBilling.java / .swift) cannot run here; the device
 * record in docs/launch/LAUNCH-PROGRAMME.md (section 10) covers them.
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'

// monetise reads localStorage when it loads, so the stand-in goes in first
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
const SK = await import('../src/game/storekit')

type G = { rmBilling?: unknown; Capacitor?: unknown }
type Answer = { ok: boolean; skus: string[] }
const g = globalThis as unknown as G
const reset = () => { store.clear(); delete g.rmBilling; delete g.Capacitor }
beforeEach(reset)

const PRO = M.SUPPORTER_SKU
const INTRO = M.PRO_INTRO_SKU
const CHARTER = M.CHARTER_SKU
const T0 = 1_760_000_000_000
const H = 60 * 60 * 1000

const bridge = (answer: () => Promise<Answer> | Answer) => {
  g.rmBilling = {
    buy: async () => 'owned' as const,
    owned: async () => (await answer()).skus,
    ownedState: async (_opts?: { sync?: boolean }) => answer(),
  }
}
const plugin = (owned: (o?: unknown) => unknown, extra: Record<string, unknown> = {}) => {
  g.Capacitor = { Plugins: { PhaseBilling: {
    buy: async () => ({ outcome: 'owned' }),
    owned,
    consume: async () => ({ ok: true, count: 1 }),
    details: async () => ({ products: [] }),
    ...extra,
  } } }
}

describe('1. ownedState() tells an answer from a failure', () => {
  const cases: [string, unknown, boolean][] = [
    ['ok:true with skus', { skus: [PRO], ok: true }, true],
    ['ok:true, owns nothing', { skus: [], ok: true }, true],
    ['an older shell (no ok)', { skus: [] }, false],
    ['ok:false', { skus: [], ok: false }, false],
    ['ok:"true" (not a boolean)', { skus: [], ok: 'true' }, false],
    ['skus missing', { ok: true }, false],
  ]
  for (const [label, reply, want] of cases) {
    it(label, async () => {
      plugin(async () => reply)
      expect((await SK.storeKitBridge()!.ownedState!()).ok).toBe(want)
    })
  }
  it('a thrown call is ok:false, owns nothing', async () => {
    plugin(async () => { throw new Error('plugin gone') })
    const st = await SK.storeKitBridge()!.ownedState!()
    expect(st.ok).toBe(false)
    expect(st.skus.length).toBe(0)
  })
})

describe('2. a refund is taken back slowly, and only on real answers', () => {
  it('the full path: bought, refunded, launches spread over a day', () => {
    M.grant(PRO)
    expect(M.hasSupporter()).toBe(true)
    // first real miss: noted, Pro still on
    expect(M.revokeMissing([], 'launch-1', T0)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
    // same launch, even a day later: still on
    expect(M.revokeMissing([], 'launch-1', T0 + 30 * H)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
    // a second launch an hour later (a crash reload): still on
    expect(M.revokeMissing([], 'launch-2', T0 + 1 * H)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
    // a later launch a day on: taken back, and the note cleared
    expect(M.revokeMissing([], 'launch-3', T0 + 25 * H)).toBe(true)
    expect(M.hasSupporter()).toBe(false)
    expect(store.get('rm-ent-miss')).toBeUndefined()
  })

  it('a wrong take-back mends itself on the next answer that lists it', async () => {
    M.grant(PRO)
    M.revokeMissing([], 'launch-1', T0)
    M.revokeMissing([], 'launch-3', T0 + 25 * H)
    M.revokeMissing([PRO], 'launch-4', T0 + 26 * H)
    expect(M.hasSupporter(), 'revokeMissing itself never grants').toBe(false)
    bridge(() => ({ ok: true, skus: [PRO] }))
    expect(await M.restore()).toBe(true)
    expect(M.hasSupporter()).toBe(true)
  })

  it('a miss, then listed, then a miss: still owned', () => {
    M.grant(CHARTER)
    M.revokeMissing([], 'a', T0)
    M.revokeMissing([CHARTER], 'b', T0 + 25 * H)
    expect(M.revokeMissing([], 'c', T0 + 50 * H)).toBe(false)
    expect(M.hasEntitlement(CHARTER)).toBe(true)
  })

  it('either Pro product covers the other', () => {
    M.grant(PRO)
    M.revokeMissing([INTRO], 'a', T0)
    expect(M.revokeMissing([INTRO], 'b', T0 + 25 * H)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
    reset()
    M.grant(INTRO)
    M.revokeMissing([PRO], 'a', T0)
    expect(M.revokeMissing([PRO], 'b', T0 + 25 * H)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
  })

  it('one product refunded, the others untouched', () => {
    M.grant(PRO); M.grant(CHARTER)
    M.revokeMissing([PRO], 'a', T0)
    M.revokeMissing([PRO], 'b', T0 + 25 * H)
    expect(M.hasSupporter()).toBe(true)
    expect(M.hasEntitlement(CHARTER)).toBe(false)
  })

  it('a note left by an older build in another shape is treated as no note', () => {
    M.grant(PRO)
    store.set('rm-ent-miss', JSON.stringify({ [PRO]: 'launch-old' }))
    expect(M.revokeMissing([], 'x', T0)).toBe(false)
    expect(M.hasSupporter()).toBe(true)
  })

  it('five failed answers: nothing noted, nothing taken', async () => {
    M.grant(PRO)
    bridge(() => ({ ok: false, skus: [] }))
    for (let i = 0; i < 5; i++) await M.restore()
    expect(M.hasSupporter()).toBe(true)
    expect(store.get('rm-ent-miss')).toBeUndefined()
  })

  it('an older shell answering []: nothing taken', async () => {
    M.grant(PRO)
    g.rmBilling = { buy: async () => 'owned', owned: async () => [] as string[] }
    for (let i = 0; i < 3; i++) await M.restore()
    expect(M.hasSupporter()).toBe(true)
    expect(store.get('rm-ent-miss')).toBeUndefined()
  })

  it('a hanging store: Pro still on while it hangs', async () => {
    M.grant(PRO)
    bridge(() => new Promise(() => { /* never */ }))
    const raced = await Promise.race([M.restore(), new Promise(r => setTimeout(() => r('slow'), 50))])
    expect(raced).toBe('slow')
    expect(M.hasSupporter()).toBe(true)
  })

  it('three real misses in ONE launch: noted, not acted on', async () => {
    M.grant(PRO)
    bridge(() => ({ ok: true, skus: [] }))
    await M.restore(); await M.restore(); await M.restore()
    expect(M.hasSupporter()).toBe(true)
    expect(store.get('rm-ent-miss')).toBeTruthy()
  })
})

describe('2b. only the Restore button asks the App Store to re-sync', () => {
  it('boot and foreground restores do not sync; the Restore button does', async () => {
    const asked: unknown[] = []
    plugin(async (o?: unknown) => { asked.push(o); return { skus: [], ok: true } })
    g.rmBilling = SK.storeKitBridge()!
    await M.restore()
    await M.restore({ sync: true })
    expect(asked[0]).toBeUndefined()
    expect(JSON.stringify(asked[1])).toBe('{"sync":true}')
  })
})

describe('3. a purchase seen three ways is granted once', () => {
  it('boot, the shell event and coming back to the app', async () => {
    let calls = 0
    bridge(() => { calls++; return { ok: true, skus: [PRO] } })
    expect(await M.restore()).toBe(true)    // boot
    expect(await M.restore()).toBe(false)   // the shell's purchasesUpdated
    expect(await M.restore()).toBe(false)   // the player comes back to the app
    expect(M.hasSupporter()).toBe(true)
    expect((store.get('rm-ent') ?? '').split(',').filter(s => s === PRO).length, 'one receipt in the cache, not three').toBe(1)
    expect(calls, 'each door asked the store once').toBe(3)
  })

  it("the bridge's watch() is wired to purchasesUpdated", () => {
    let fire: (() => void) | null = null
    plugin(async () => ({ skus: [PRO], ok: true }), {
      buy: async () => ({ outcome: 'pending' }),
      addListener: (ev: string, cb: () => void) => { if (ev === 'purchasesUpdated') fire = cb },
    })
    let heard = 0
    SK.storeKitBridge()!.watch!(() => { heard++ })
    expect(typeof fire).toBe('function')
    ;(fire as unknown as () => void)()
    expect(heard).toBe(1)
  })
})

describe('4. two held purchases of one consumable bank two credits', () => {
  it('one credit per payment', async () => {
    const SKU = M.HEAL_SKU
    // the iOS shell from 1.8.18: one owned() entry per unfinished transaction,
    // one finish per consume()
    let held = 2
    g.rmBilling = {
      buy: async () => 'owned',
      owned: async () => Array.from({ length: held }, () => SKU),
      consume: async () => { if (held > 0) { held--; return { ok: true } } return { ok: false } },
    }
    await M.bankReceipts(SKU)
    expect(M.creditCount(SKU)).toBe(2)
    expect(held, 'both receipts spent').toBe(0)
  })
})

describe('5. the paid edition is its own receipt', () => {
  // revokeMissing reads edition() itself, and under test it is 'free', so this
  // checks the guard by reading the source rather than by faking Vite
  it('revokeMissing returns early outside the free edition', () => {
    const src = readFileSync(new URL('../src/game/monetise.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/export function revokeMissing[\s\S]{0,200}if \(edition\(\) !== 'free'\) return false/)
  })
})
