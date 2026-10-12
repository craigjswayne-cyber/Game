/**
 * ---- WHAT THE STORE STILL AGREES TO (1.8.18) ----
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
 * matrix in tasks/todo.md (Checkpoint B) covers them.
 *
 * Run: npx vite-node scripts/refundprobe.ts
 */

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

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

type G = { rmBilling?: unknown; Capacitor?: unknown }
const g = globalThis as unknown as G
const reset = () => { store.clear(); delete g.rmBilling; delete g.Capacitor }

let answerOnce: { ok: boolean; skus: string[] } = { ok: false, skus: [] }
const PRO = M.SUPPORTER_SKU
const INTRO = M.PRO_INTRO_SKU
const CHARTER = M.CHARTER_SKU

/** A JS bridge whose answer is under the test's control. */
const bridge = (answer: () => Promise<{ ok: boolean; skus: string[] }> | { ok: boolean; skus: string[] }) => {
  const b = {
    buy: async () => 'owned' as const,
    owned: async () => (await answer()).skus,
    ownedState: async (_opts?: { sync?: boolean }) => answer(),
  }
  g.rmBilling = b
  return b
}

// ---------------------------------------------------------------- 1 ----
console.log('\n1. ownedState() tells an answer from a failure')
{
  const cases: [string, unknown, boolean][] = [
    ['ok:true with skus', { skus: [PRO], ok: true }, true],
    ['ok:true, owns nothing', { skus: [], ok: true }, true],
    ['an older shell (no ok)', { skus: [] }, false],
    ['ok:false', { skus: [], ok: false }, false],
    ['ok:"true" (not a boolean)', { skus: [], ok: 'true' }, false],
    ['skus missing', { ok: true }, false],
  ]
  for (const [label, reply, want] of cases) {
    reset()
    g.Capacitor = { Plugins: { PhaseBilling: {
      buy: async () => ({ outcome: 'owned' }),
      owned: async () => reply,
      consume: async () => ({ ok: true, count: 1 }),
      details: async () => ({ products: [] }),
    } } }
    const b = SK.storeKitBridge()!
    const st = await b.ownedState!()
    ok(st.ok === want, `${label}: ok=${st.ok}`)
  }
  reset()
  g.Capacitor = { Plugins: { PhaseBilling: {
    buy: async () => ({ outcome: 'owned' }),
    owned: async () => { throw new Error('plugin gone') },
    consume: async () => ({}),
    details: async () => ({ products: [] }),
  } } }
  const st = await SK.storeKitBridge()!.ownedState!()
  ok(st.ok === false && st.skus.length === 0, 'a thrown call is ok:false, owns nothing')
}

// ---------------------------------------------------------------- 2 ----
console.log('\n2. a refund is taken back slowly, and only on real answers')
{
  const T0 = 1_760_000_000_000
  const H = 60 * 60 * 1000
  // (a) the full path: bought, refunded, launches spread over a day
  reset()
  M.grant(PRO)
  ok(M.hasSupporter(), 'bought: Pro is on')
  ok(M.revokeMissing([], 'launch-1', T0) === false && M.hasSupporter(), 'first real miss: noted, Pro still on')
  ok(M.revokeMissing([], 'launch-1', T0 + 30 * H) === false && M.hasSupporter(), 'same launch, even a day later: still on')
  ok(M.revokeMissing([], 'launch-2', T0 + 1 * H) === false && M.hasSupporter(), 'a second launch an hour later (a crash reload): still on')
  ok(M.revokeMissing([], 'launch-3', T0 + 25 * H) === true && !M.hasSupporter(), 'a later launch a day on: taken back')
  ok(store.get('rm-ent-miss') === undefined, 'the note is cleared once acted on')

  // (a2) a wrong take-back mends itself on the next answer that lists it
  M.revokeMissing([PRO], 'launch-4', T0 + 26 * H)
  ok(!M.hasSupporter(), 'revokeMissing itself never grants')
  answerOnce = { ok: true, skus: [PRO] }
  bridge(() => answerOnce)
  ok(await M.restore() === true && M.hasSupporter(), 'the store lists it again: restore() grants it back')

  // (b) the store lists it again between misses: the note is wiped
  reset()
  M.grant(CHARTER)
  M.revokeMissing([], 'a', T0)
  M.revokeMissing([CHARTER], 'b', T0 + 25 * H)
  ok(M.revokeMissing([], 'c', T0 + 50 * H) === false && M.hasEntitlement(CHARTER), 'a miss, then listed, then a miss: still owned')

  // (c) either Pro product covers the other
  reset()
  M.grant(PRO)
  M.revokeMissing([INTRO], 'a', T0)
  ok(M.revokeMissing([INTRO], 'b', T0 + 25 * H) === false && M.hasSupporter(), 'Pro cached, store lists the intro offer: kept')
  reset()
  M.grant(INTRO)
  M.revokeMissing([PRO], 'a', T0)
  ok(M.revokeMissing([PRO], 'b', T0 + 25 * H) === false && M.hasSupporter(), 'intro cached, store lists Pro: kept')

  // (d) one product refunded, the others untouched
  reset()
  M.grant(PRO); M.grant(CHARTER)
  M.revokeMissing([PRO], 'a', T0)
  M.revokeMissing([PRO], 'b', T0 + 25 * H)
  ok(M.hasSupporter() && !M.hasEntitlement(CHARTER), 'only the refunded product goes')

  // (d2) a note left by an older build in another shape is ignored, not trusted
  reset()
  M.grant(PRO)
  store.set('rm-ent-miss', JSON.stringify({ [PRO]: 'launch-old' }))
  ok(M.revokeMissing([], 'x', T0) === false && M.hasSupporter(), 'a malformed note is treated as no note')

  // (e) restore() with failures in between never revokes
  reset()
  M.grant(PRO)
  let answer: { ok: boolean; skus: string[] } = { ok: false, skus: [] }
  bridge(() => answer)
  for (let i = 0; i < 5; i++) await M.restore()
  ok(M.hasSupporter() && store.get('rm-ent-miss') === undefined, 'five failed answers: nothing noted, nothing taken')

  // (f) an older shell (no ownedState) is never used to revoke
  reset()
  M.grant(PRO)
  g.rmBilling = { buy: async () => 'owned', owned: async () => [] as string[] }
  for (let i = 0; i < 3; i++) await M.restore()
  ok(M.hasSupporter() && store.get('rm-ent-miss') === undefined, 'an older shell answering []: nothing taken')

  // (g) a store that never answers in time cannot cost anything either
  reset()
  M.grant(PRO)
  bridge(() => new Promise(() => { /* never */ }))
  const raced = await Promise.race([M.restore(), new Promise(r => setTimeout(() => r('slow'), 50))])
  ok(raced === 'slow' && M.hasSupporter(), 'a hanging store: Pro still on while it hangs')

  // (h) restore() itself notes a real miss but does not act inside one launch
  reset()
  M.grant(PRO)
  answer = { ok: true, skus: [] }
  bridge(() => answer)
  await M.restore(); await M.restore(); await M.restore()
  ok(M.hasSupporter() && !!store.get('rm-ent-miss'), 'three real misses in ONE launch: noted, not acted on')
}

// --------------------------------------------------------------- 2b ----
console.log('\n2b. only the Restore button asks the App Store to re-sync')
{
  reset()
  const asked: unknown[] = []
  g.Capacitor = { Plugins: { PhaseBilling: {
    buy: async () => ({ outcome: 'owned' }),
    owned: async (o?: unknown) => { asked.push(o); return { skus: [], ok: true } },
    consume: async () => ({ ok: true, count: 1 }),
    details: async () => ({ products: [] }),
  } } }
  g.rmBilling = SK.storeKitBridge()!
  await M.restore()
  await M.restore({ sync: true })
  ok(asked[0] === undefined, 'boot and foreground restores do not sync')
  ok(JSON.stringify(asked[1]) === '{"sync":true}', 'the Restore button does')
}

// ---------------------------------------------------------------- 3 ----
console.log('\n3. a purchase seen three ways is granted once')
{
  reset()
  let calls = 0
  bridge(() => { calls++; return { ok: true, skus: [PRO] } })
  const first = await M.restore()   // boot
  const second = await M.restore()  // the shell's purchasesUpdated
  const third = await M.restore()   // the player comes back to the app
  ok(first === true && second === false && third === false, 'only the first pass reports a change')
  ok(M.hasSupporter() && (store.get('rm-ent') ?? '').split(',').filter(s => s === PRO).length === 1,
    'one receipt in the cache, not three')
  ok(calls === 3, 'each door asked the store once')

  // the bridge's watch() is wired to the same restore
  reset()
  let fire: (() => void) | null = null
  g.Capacitor = { Plugins: { PhaseBilling: {
    buy: async () => ({ outcome: 'pending' }),
    owned: async () => ({ skus: [PRO], ok: true }),
    consume: async () => ({ ok: true, count: 1 }),
    details: async () => ({ products: [] }),
    addListener: (ev: string, cb: () => void) => { if (ev === 'purchasesUpdated') fire = cb },
  } } }
  const b = SK.storeKitBridge()!
  let heard = 0
  b.watch!(() => { heard++ })
  ok(typeof fire === 'function', 'watch() subscribes to purchasesUpdated')
  ;(fire as unknown as () => void)?.()
  ok(heard === 1, 'the shell event reaches the game')
}

// ---------------------------------------------------------------- 4 ----
console.log('\n4. two held purchases of one consumable bank two credits')
{
  reset()
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
  ok(M.creditCount(SKU) === 2, `two payments, ${M.creditCount(SKU)} credits`)
  ok(held === 0, 'both receipts spent')
}

// ---------------------------------------------------------------- 5 ----
console.log('\n5. the paid edition is its own receipt')
{
  reset()
  M.grant(PRO)
  // revokeMissing reads edition() itself; under the probes it is 'free', so
  // this checks the guard by reading the source rather than by faking Vite
  const src = (await import('node:fs')).readFileSync(new URL('../src/game/monetise.ts', import.meta.url), 'utf8')
  ok(/export function revokeMissing[\s\S]{0,200}if \(edition\(\) !== 'free'\) return false/.test(src),
    'revokeMissing returns early outside the free edition')
}

reset()
console.log(fails ? `\n${fails} FAILED` : '\nall refund checks passed')
process.exit(fails ? 1 : 0)
