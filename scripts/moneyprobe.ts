/**
 * ---- THE TILL, AND THE FOUR WAYS A TILL RUINS A GAME ----
 *
 * Money is the part of a game that has to work when everything else does not: a
 * flat battery mid-purchase, a store that is down, a reinstall on a new phone, a
 * refund, a parent's approval that lands two days later. Every one of those has
 * a right answer, and the wrong answers are all the same shape - the customer
 * paid and the game says no.
 *
 * So this holds the four rules src/game/monetise.ts exists to keep:
 *
 *   1. IT FAILS OPEN. A missing, broken or offline bridge never takes anything
 *      away. It can only fail to add.
 *   2. THE WEB BUILD HAS NO TILL. No bridge, no door, no ad slot, and no code
 *      path that could reach a store - so the "no data collected" answer on both
 *      store questionnaires stays true (scripts/netprobe.ts holds the other half).
 *   3. EVERY ENDING IS HANDLED. owned, cancelled, pending, unavailable, error -
 *      and only one of them grants anything.
 *   4. THE RECEIPT IS NOT IN THE SAVE. Entitlement lives beside night mode, so a
 *      career stays portable and losing a receipt cannot cost anybody a season.
 *
 * Run: npx vite-node scripts/moneyprobe.ts
 */
import { readFileSync } from 'node:fs'

// a localStorage that behaves like the real one, because the module under test
// is written to survive not having one at all and we want to test the path
// where it does
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
type Outcome = Awaited<ReturnType<typeof M.buySupporter>>

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = globalThis as unknown as { rmBilling?: unknown; rmAds?: unknown }
const clear = () => { store.clear(); delete g.rmBilling; delete g.rmAds }

/** A store bridge that answers however this test needs it to. */
const fakeStore = (opts: { outcome?: Outcome; owns?: string[]; throws?: boolean; price?: string } = {}) => ({
  details: async (sku: string) => {
    if (opts.throws) throw new Error('store unreachable')
    return { sku, price: opts.price ?? '£2.99' }
  },
  buy: async () => {
    if (opts.throws) throw new Error('store unreachable')
    return opts.outcome ?? 'owned'
  },
  owned: async () => {
    if (opts.throws) throw new Error('store unreachable')
    return opts.owns ?? []
  },
})

// ---- 1. the web build, which is what this repository deploys ---------------
console.log('--- 1. no bridge: the build people play today')
clear()
ok(M.edition() === 'free', 'the default edition is the free one')
ok(M.bridge() === null, 'there is no billing bridge')
ok(!M.hasSupporter(), 'nobody is a supporter by default')
ok(!M.canBuy(), 'and there is nothing to buy')
ok(!M.supporterDoor(), 'so the Supporter page has no door in the menu')
ok(!M.adsAllowed('home-foot'), 'no ad may be drawn anywhere')
ok(await M.buySupporter() === 'unavailable', 'a purchase attempt says so plainly rather than throwing')
ok(await M.restore() === false, 'and a restore is a no-op rather than an error')
ok(await M.supporterPrice() === null, 'no price is invented when there is no store to name one')

// ---- 2. a packaged shell puts a bridge in -----------------------------------
console.log('\n--- 2. a bridge appears, as a TWA or a wrapper would inject one')
clear()
g.rmBilling = fakeStore({ price: '£3.49' })
ok(M.bridge() !== null, 'the bridge is found on globalThis')
ok(M.canBuy(), 'the purchase door opens')
ok(M.supporterDoor(), 'and the page becomes reachable')
ok(await M.supporterPrice() === '£3.49', "the price shown is the store's own, formatted by the store")
ok(await M.buySupporter() === 'owned', 'a completed purchase reports owned')
ok(M.hasSupporter(), 'and the receipt is written down')
ok(!M.canBuy(), 'the same thing cannot be bought twice')
ok(M.supporterDoor(), 'but the page stays reachable, because a receipt is a thing you may look at')

// ---- 3. it fails open ------------------------------------------------------
console.log('\n--- 3. failing open: offline, broken, or gone')
{
  // still a supporter from the block above, deliberately
  delete g.rmBilling
  ok(M.hasSupporter(), 'a supporter with no bridge at all is still a supporter')
  g.rmBilling = fakeStore({ throws: true })
  ok(await M.restore() === false, 'a store that throws changes nothing')
  ok(M.hasSupporter(), 'and does not take the purchase away')
  ok(await M.buySupporter() === 'error', 'a throwing purchase reports an error rather than propagating one')
  ok(await M.supporterPrice() === null, 'and a throwing price lookup just has no price')
}

// ---- 4. every ending, and only one of them grants ---------------------------
console.log('\n--- 4. the five endings')
for (const outcome of ['cancelled', 'pending', 'unavailable', 'error'] as Outcome[]) {
  clear()
  g.rmBilling = fakeStore({ outcome })
  const got = await M.buySupporter()
  ok(got === outcome, `a ${outcome} purchase reports ${outcome}`)
  ok(!M.hasSupporter(), `and grants nothing`)
}
{
  clear()
  g.rmBilling = fakeStore({ outcome: 'owned' })
  ok(await M.buySupporter() === 'owned' && M.hasSupporter(), 'only owned grants')
}

// ---- 5. restore, which is the reinstall and the second phone ----------------
console.log('\n--- 5. restore')
clear()
g.rmBilling = fakeStore({ owns: [M.SUPPORTER_SKU] })
ok(!M.hasSupporter(), 'a fresh install starts with nothing')
ok(await M.restore() === true, 'restore finds the purchase on the account')
ok(M.hasSupporter(), 'and grants it')
ok(await M.restore() === false, 'a second restore reports no change rather than pretending')
clear()
g.rmBilling = fakeStore({ owns: ['something.else'] })
ok(await M.restore() === false && !M.hasSupporter(), 'and somebody else\'s product grants nothing')

// ---- 6. advertising -------------------------------------------------------
console.log('\n--- 6. where an ad may appear')
clear()
g.rmAds = { mount: () => {} }
ok(M.adsAllowed('home-foot'), 'with a provider attached, a declared place may draw one')
ok(!M.adsAllowed('match-live'), 'an undeclared place may not, whatever a caller passes')
for (const place of M.AD_PLACES) {
  ok(!/match|tunnel|modal|title/.test(place), `no declared place is inside a match or a modal (${place})`)
}
M.grantSupporter()
ok(!M.adsAllowed('home-foot'), 'and a supporter sees none, even with a provider attached')

// ---- 7. the paid edition ---------------------------------------------------
console.log('\n--- 7. a premium listing, where the customer paid before the download')
{
  // edition() reads import.meta.env, which vite-node populates: assert the
  // shape of the rule rather than re-reading the environment
  const src = readFileSync('src/game/monetise.ts', 'utf8')
  ok(/edition\(\) === 'paid' \|\| hasEntitlement\(SUPPORTER_SKU\)/.test(src),
    'the paid edition is a supporter without any purchase flow at all')
  ok(/canBuy[\s\S]{0,120}edition\(\) === 'free'/.test(src),
    'and shows no purchase UI, because there is nothing left to sell')
}

// ---- 8. the receipt is not in the save --------------------------------------
console.log('\n--- 8. the save is not a hostage')
{
  const src = readFileSync('src/game/monetise.ts', 'utf8')
  ok(!/from '\.\/(model|save)'/.test(src),
    'the billing layer imports neither the model nor the save file')
  ok(/localStorage/.test(src) && !/GameState/.test(src),
    'entitlement lives in localStorage, beside night mode, and never in a career')
  clear()
  M.grantSupporter()
  ok(store.size === 1 && [...store.keys()][0] === 'rm-ent',
    `it writes exactly one key, and that key is rm-ent (${[...store.keys()].join(', ')})`)
}

// ---- 9. the v1.1.0 catalogue: two shelves, and no sku on both ------------
console.log('\n--- 9. the catalogue')
clear()
// seven, not eight: the In-Game Editor was removed (owner, 27 Aug v1.1.3)
// before any store sold one
ok(M.NC_SKUS.length === 3 && M.CONSUMABLE_SKUS.length === 4, 'seven products: three owned for ever, four consumable')
ok(new Set([...M.NC_SKUS, ...M.CONSUMABLE_SKUS]).size === 7, 'and no sku sits on both shelves')
ok(![...M.NC_SKUS, ...M.CONSUMABLE_SKUS].includes('phase.editor'), 'and the Editor is not quietly back')

// ---- 10. consumables: the store confirms, the career keeps ---------------
console.log('\n--- 10. the consumable flow')
{
  clear()
  g.rmBilling = fakeStore({ outcome: 'owned' })
  ok(await M.buyConsumable(M.INJECT_SKUS.s) === 'unavailable',
    'a shell that cannot consume cannot sell a consumable at all')
  const consumed: string[] = []
  g.rmBilling = { ...fakeStore({ outcome: 'owned' }), consume: async (sku: string) => { consumed.push(sku) } }
  ok(await M.buyConsumable(M.INJECT_SKUS.s) === 'owned', 'a completed purchase reports owned')
  ok(!M.hasEntitlement(M.INJECT_SKUS.s),
    'and is never cached as an entitlement - its receipt is what it did to the career')
  await M.consume(M.INJECT_SKUS.s)
  ok(consumed.includes(M.INJECT_SKUS.s), 'the consume is sent, so the store can sell it again')
  ok(await M.buyConsumable(M.SUPPORTER_SKU) === 'unavailable', 'the consumable door does not sell the ownables')
  g.rmBilling = { ...fakeStore({ owns: [M.INJECT_SKUS.m, M.SUPPORTER_SKU] }), consume: async () => {} }
  const pend = await M.pendingConsumables()
  ok(pend.length === 1 && pend[0] === M.INJECT_SKUS.m,
    'a paid-but-unconsumed purchase is found for the recovery pass, and ownables are not in the pile')
  g.rmBilling = { ...fakeStore({ outcome: 'pending' }), consume: async () => {} }
  ok(await M.buyConsumable(M.INJECT_SKUS.xl) === 'pending', "a parent's approval is pending, not failed, and grants nothing yet")
}

// ---- 11. restore covers the whole shelf, and the old receipt still stands --
console.log('\n--- 11. restore, v1.1.0')
{
  clear()
  g.rmBilling = fakeStore({ owns: [...M.NC_SKUS] })
  ok(await M.restore() === true, 'restore finds everything the account owns')
  ok(M.NC_SKUS.every(sku => M.hasEntitlement(sku)), 'and grants each of the three')
  clear()
  store.set('rm-ent', 'supporter')
  ok(M.hasSupporter(), 'a receipt written before v1.1.0 still stands, unre-litigated')
  M.grant(M.LICENSE_SKU)
  ok(M.hasSupporter() && M.hasEntitlement(M.LICENSE_SKU), 'and survives a new receipt joining it in the cache')
  ok(store.size === 1 && [...store.keys()][0] === 'rm-ent', 'still exactly one key beside night mode')
}

// ---- 12. rewarded spots: player-asked, provider-confirmed, never punished --
console.log('\n--- 12. the rewarded favours')
{
  clear()
  ok(!M.rewardedAvailable('medical'), 'no provider, no rewarded button anywhere in the game')
  g.rmAds = { mount: () => {} }
  ok(!M.rewardedAvailable('medical'), 'a banner-only provider still shows no rewarded button')
  g.rmAds = { mount: () => {}, showRewarded: async () => 'completed' as const }
  ok(M.rewardedAvailable('medical'), 'a full provider shows it')
  ok(await M.showRewarded('medical') === 'completed', 'and only a finished spot reports completed')
  g.rmAds = { mount: () => {}, showRewarded: async () => { throw new Error('provider died') } }
  ok(await M.showRewarded('medical') === 'unavailable', 'a throwing provider is a polite no, never an error screen')
  g.rmAds = { mount: () => {}, showRewarded: async () => 'completed' as const }
  M.grantSupporter()
  ok(M.rewardedAvailable('medical'), 'Remove Ads never removes the favours - they are asked for, not endured')
  ok(!M.adsAllowed('home-foot'), 'while the banners stay gone')
}

console.log(fails ? `\nMONEY PROBE FAILED (${fails})` : '\nMONEY PROBE PASSED: it fails open, it grants once, and the game is not for sale by the yard')
if (fails) process.exit(1)
