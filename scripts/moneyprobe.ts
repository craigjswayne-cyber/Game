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
import { readdirSync, readFileSync } from 'node:fs'

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
// v1.1.17 (owner: "we need to not declare a cost on the game - let google play
// do that"): with no store to ask, there is NO PRICE. The catalogue used to
// hold a figure per product and hand it over here; it now holds only the list
// of products, because the game is sold in storefronts whose currency, tax and
// regional pricing it cannot know.
ok((await M.skuPriceFrom(M.SUPPORTER_SKU)).price === null,
  'with no store, the game names no price of its own - the row goes out wordless')
ok(!('skuPrice' in M) && !('supporterPrice' in M),
  'and there is no ungated way to ask for one: the price always arrives with its origin')

// v1.1.9: and the row now says WHOSE price it is. The fallback above was
// added so nothing stood blank, and it did something nobody asked for too -
// it made a dead store look alive, which is half of why the v1.1.6 billing
// fault took an evening to read.
{
  const from = await M.skuPriceFrom(M.SUPPORTER_SKU)
  ok(from.price === null && from.live === false,
    'nothing is priced, and it says so rather than looking priced')
  const health = await M.tillHealth()
  // Remove-all-ads is in the catalogue but in no store until a build ships
  // ads, so the shelf must not ask about it - or it could never report better
  // than 9 of 10 and would nag on a perfectly good till.
  const sellable = M.SELLABLE_SKUS.length - 1
  ok(health.live === 0 && health.asked === sellable,
    `with no store, nothing on the shelf is priced by one (0 of ${sellable})`)
  ok(!(await M.tillHealth()).asked || health.asked === sellable,
    'and Remove-all-ads is not counted, because this build sells no ads to remove')
}

// ---- 2. a packaged shell puts a bridge in -----------------------------------
console.log('\n--- 2. a bridge appears, as a TWA or a wrapper would inject one')
clear()
g.rmBilling = fakeStore({ price: '£3.49' })
ok(M.bridge() !== null, 'the bridge is found on globalThis')
ok(M.canBuy(), 'the purchase door opens')
ok(M.supporterDoor(), 'and the page becomes reachable')
ok((await M.skuPriceFrom(M.SUPPORTER_SKU)).price === '£3.49', "the price shown is the store's own, formatted by the store")
{
  const from = await M.skuPriceFrom(M.SUPPORTER_SKU)
  ok(from.live === true, "and it is marked as the store's own, so the shelf keeps quiet about its health")
  const health = await M.tillHealth()
  ok(health.live === health.asked, `every product on the shelf is priced by the store (${health.live}/${health.asked})`)
  // THE ONE THAT WOULD HAVE CAUGHT IT: a working till must report a CLEAN
  // sheet, or the Store draws its "not answering" line over a store that is
  // answering perfectly. Counting a product no store has cost exactly that.
  ok(health.asked === M.SELLABLE_SKUS.length - 1,
    `a good till reports no shortfall at all (${health.live}/${health.asked}, ads product excluded)`)
}
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
  ok((await M.skuPriceFrom(M.SUPPORTER_SKU)).price === null,
    'a throwing price lookup yields no price - the button says Buy and the sheet does the talking')
  ok((await M.skuPriceFrom(M.SUPPORTER_SKU)).live === false,
    'and says so - a store that throws is a store that has not priced anything')
  ok((await M.tillHealth()).live === 0,
    'so the whole shelf reports itself unpriced, which is what the Store screen tells the player')
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
// ten as of v1.1.4: the heal, the estate and the international stage joined
// on the owner's overnight brief
// v1.1.12: "Support the game" moved shelves. It grants nothing, so there is
// nothing to lose by spending the receipt - and a tip jar that takes one coin
// and greys out is not a tip jar (owner: "it should be repeatable at any
// point").
// v1.1.14: eleven. The Estate became one build per CLUB rather than one per
// save, and Play sells a non-consumable exactly once, so the repeat at a second
// ground had to be its own consumable (phase.ground). The first ground is still
// covered by phase.estate, which is why BOTH exist rather than one replacing
// the other.
ok(M.NC_SKUS.length === 4 && M.CONSUMABLE_SKUS.length === 7, 'eleven products: four owned for ever, seven repeatable')
ok(M.CONSUMABLE_SKUS.includes(M.SUPPORT_SKU), 'and the thank-you is one of the repeatable ones')
ok(M.CONSUMABLE_SKUS.includes(M.GROUND_SKU) && (M.NC_SKUS as readonly string[]).includes(M.ESTATE_SKU),
   'the Estate is owned for ever and its repeat at a new ground is repeatable - the pair the club-scoping needs')
ok(new Set([...M.NC_SKUS, ...M.CONSUMABLE_SKUS]).size === 11, 'and no sku sits on both shelves')
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
  M.grant(M.CHARTER_SKU)
  ok(M.hasSupporter() && M.hasEntitlement(M.CHARTER_SKU), 'and survives a new receipt joining it in the cache')
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

// ---- 12b. THE CREDIT BANK (v1.1.18) ----------------------------------------
//
// Born of the 31 Aug refund emails: every held consumable receipt of the
// evening came back "cancelled because it was not acknowledged", because
// Digital Goods 2.0 has no acknowledge() and the old rules forbade spending
// a receipt whose grant had not landed. So the value moves at the till now -
// spend with the store, bank in the game's own ledger - and these are the
// bank's own rules.
console.log('\n--- 12b. the credit bank: spends are banked, banks are drawn')
{
  clear()
  localStorage.removeItem('rm-credits')
  ok(M.creditCount(M.HEAL_SKU) === 0, 'the bank opens empty')
  M.creditAdd(M.HEAL_SKU)
  ok(M.creditCount(M.HEAL_SKU) === 1, 'a spend banks one credit')
  ok(M.creditTake(M.HEAL_SKU) && M.creditCount(M.HEAL_SKU) === 0, 'a draw takes exactly one, and it is gone')
  ok(!M.creditTake(M.HEAL_SKU), 'an empty bank refuses the draw rather than going negative')

  // bankReceipts credits BY OBSERVATION: only a receipt that actually leaves
  // owned() is banked, so a consume that fails silently banks nothing and a
  // receipt can never be banked twice
  let receipts = [M.HEAL_SKU, M.HEAL_SKU]
  let broken = false
  g.rmBilling = {
    details: async (sku: string) => ({ sku, price: '£0.99' }),
    buy: async () => 'owned',
    owned: async () => [...receipts],
    consume: async (sku: string) => {
      if (broken) return // swallows its own failure, exactly like storekit.ts
      const i = receipts.indexOf(sku)
      if (i >= 0) receipts.splice(i, 1)
    },
  }
  await M.bankReceipts(M.HEAL_SKU)
  ok(M.creditCount(M.HEAL_SKU) === 2 && receipts.length === 0,
    'two stray receipts became exactly two credits, and the store shelf is clear')
  receipts = [M.HEAL_SKU]
  broken = true
  await M.bankReceipts(M.HEAL_SKU)
  ok(M.creditCount(M.HEAL_SKU) === 2 && receipts.length === 1,
    'a consume that fails silently banks NOTHING - no phantom credit, no double grant')
  localStorage.removeItem('rm-credits')
}

// ---- 12c. THE SUGAR DADDY'S DAY CLOCK (owner: "once a day. in real life") --
{
  localStorage.removeItem('rm-xl-at')
  ok(M.xlWaitMs() === 0, 'never bought: the Sugar Daddy answers at once')
  M.markXlBought(1_000_000)
  ok(M.xlWaitMs(1_000_000 + 3_600_000) > 0, 'an hour after buying, he is resting')
  ok(M.xlWaitMs(1_000_000 + 23 * 3_600_000) > 0, 'twenty-three hours in, still resting')
  ok(M.xlWaitMs(1_000_000 + 24 * 3_600_000) === 0, 'at twenty-four hours he calls again - a real day, not a game one')
  localStorage.removeItem('rm-xl-at')
  ok(M.xlWaitMs() === 0, 'and a cleared clock never blocks a first purchase')
}

// ---- 13. the ANDROID bridge the TWA actually builds ------------------------
//
// Sections 1-12 test monetise.ts against a hand-made bridge, and every one of
// them passed while the shipped Android bridge was missing a method the
// catalogue cannot sell without. playbilling.ts builds itself out of two
// browser APIs, so nothing in node had ever executed it - and on the evening
// the Play products went live, every consumable in the installed game
// answered "there is no store attached to this build" with a verified store
// attached: buyConsumable refuses outright when the bridge has no consume,
// and the bridge was returned as { details, buy, owned }.
//
// So the Digital Goods service is stubbed here and the REAL bridge is built
// on it. What this asserts is the contract monetise depends on, method by
// method - the check that was missing, not the bug that was found.
console.log('\n--- 13. the Play bridge, built on a stubbed Digital Goods service')
{
  clear()
  const calls: string[] = []
  let purchases = [
    { itemId: M.HEAL_SKU, purchaseToken: 'tok-heal' },
    { itemId: M.SUPPORT_SKU, purchaseToken: 'tok-support' },
  ]
  const gg = globalThis as unknown as Record<string, unknown>
  gg.getDigitalGoodsService = async () => ({
    getDetails: async (skus: string[]) =>
      skus.map(itemId => ({ itemId, title: 'A thing', price: { value: '0.99', currency: 'GBP' } })),
    listPurchases: async () => purchases,
    acknowledge: async (token: string, type: string) => { calls.push(`ack:${token}:${type}`) },
    consume: async (token: string) => {
      calls.push(`consume:${token}`)
      purchases = purchases.filter(p => p.purchaseToken !== token)
    },
  })
  gg.PaymentRequest = class {
    async show() { return { details: { token: 'tok-new' }, complete: async () => {} } }
  }

  const { playBridge } = await import('../src/game/playbilling')
  const b = await playBridge()
  ok(!!b, 'a billing-enabled container gets a bridge')
  // THE ONE THAT SHIPPED BROKEN. Named on its own, because "the bridge is
  // truthy" is what every other check would have said all along.
  ok(typeof b?.consume === 'function', 'and the bridge can CONSUME - without it the five consumables cannot be sold at all')
  ok(typeof b?.details === 'function' && typeof b?.buy === 'function' && typeof b?.owned === 'function',
    'alongside details, buy and owned')

  // the whole contract, driven through monetise the way the game does it
  g.rmBilling = b!
  ok(M.tillOpen(), 'the till opens on it')
  const price = (await M.skuPriceFrom(M.HEAL_SKU)).price
  ok(price === new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP' }).format(0.99),
    `the store's own figure is rendered as money, not "0.99 GBP" (${price})`)
  ok(await M.buyConsumable(M.HEAL_SKU) === 'owned', 'a consumable can be bought at all')

  // A CONSUMABLE IS SPENT, NOT MERELY ACKNOWLEDGED.
  //
  // These are not two names for the same call. Acknowledging stops Play
  // refunding the purchase after three days; only CONSUMING gives the product
  // back to the shelf. A consumable that is acknowledged and not consumed is
  // paid for, kept, and owned forever - and the next tap on that row gets
  // Play's own dialog, "You already own this item", on a product whose entire
  // point is that it can be bought again (owner, v1.1.16: "Error message
  // saying i already own this message but this should be good to buy again
  // and again").
  //
  // This probe used to assert the acknowledge and stop, which is why the fault
  // shipped: the assertion named the lever that leaves the customer stuck.
  ok(calls.includes('consume:tok-new'),
    `the purchase just made is SPENT, so the shelf gets it back (${calls.join(' ') || 'nothing called'})`)
  await M.consume(M.HEAL_SKU)
  ok(calls.includes('consume:tok-heal'), 'consuming by SKU finds the purchase TOKEN and spends it')
  ok(!(await b!.owned()).includes(M.HEAL_SKU), 'so Play will sell it again')
  ok(await M.buyOwnable(M.CHARTER_SKU) === 'owned', 'a non-consumable still buys')
  ok(calls.includes('ack:tok-new:onetime'), 'and is acknowledged as a one-time purchase')

  // ---- 13a1. "YOU ALREADY OWN THIS ITEM" IS A DELIVERY, NOT AN ERROR ------
  //
  // Owner, v1.1.17, on a build that already had the v1.1.16 consume fix in it:
  // "Ive clicked to add some cash - it did one, all other cash injections are
  // unavailable to click. You should be able to do it again and again. Says i
  // already this item still."
  //
  // v1.1.16 stopped NEW purchases getting stuck. It did nothing for the
  // receipts already stranded on his account when it landed - and Play will
  // not open a sheet for a consumable the account still holds. It refuses,
  // the refusal arrived here as 'refused', and the game told a man who had
  // paid for something that his purchase had failed.
  //
  // The account's open receipts are the authority. A SKU sitting in
  // listPurchases after a refusal is a purchase that was paid for and never
  // delivered, so it is reported as 'owned' and the caller does exactly what
  // it does after any sale: writes the grant, sends the consume, frees the
  // shelf. Nothing is charged twice - Play never opened the sheet.
  {
    const g3 = globalThis as unknown as Record<string, unknown>
    const stranded = [{ itemId: M.INJECT_SKUS.m, purchaseToken: 'tok-stuck' }]
    const spent: string[] = []
    g3.getDigitalGoodsService = async () => ({
      getDetails: async (skus: string[]) =>
        skus.map(itemId => ({ itemId, title: 'A thing', price: { value: '1.99', currency: 'GBP' } })),
      listPurchases: async () => stranded,
      acknowledge: async () => {},
      consume: async (token: string) => { spent.push(token) },
    })
    // Play's own refusal for an item the account already holds
    g3.PaymentRequest = class {
      async show(): Promise<never> {
        throw Object.assign(new Error('You already own this item.'), { name: 'NotAllowedError' })
      }
    }
    const b3 = await playBridge()
    g.rmBilling = b3!
    ok(await M.buyConsumable(M.INJECT_SKUS.m) === 'owned',
      'a refusal for a SKU the account already holds is reported as owned, not as a failure')
    ok(M.billingReason() == null,
      `and nothing is shown as an error, because nothing failed (${M.billingReason() ?? 'silent'})`)
    // the caller's half: the grant lands, then the receipt is spent
    await M.consume(M.INJECT_SKUS.m)
    ok(spent.includes('tok-stuck'), 'and spending it releases the stranded receipt')

    // a refusal with NO matching receipt is still a refusal - this must not
    // become a blanket "call everything owned"
    stranded.length = 0
    ok(await M.buyConsumable(M.INJECT_SKUS.l) === 'refused',
      'a refusal with nothing on the account is still reported as refused')
    ok((M.billingReason() ?? '').length > 0, 'with the reason kept for the shelf to show')
  }

  // ---- 13a2. WHICH KIND OF NOTHING ----------------------------------------
  //
  // Every console setting checked out - products active, backwards
  // compatible, 173 countries, licence tester, installed from Play, billing
  // in the bundle - and the shelf was still empty. A silent `return null`
  // from details() covers two faults that need opposite fixes, so it now
  // says which one it hit.
  {
    const g2 = globalThis as unknown as Record<string, unknown>
    const withDetails = (impl: () => Promise<unknown>) => {
      g2.getDigitalGoodsService = async () => ({
        getDetails: impl,
        listPurchases: async () => [],
        acknowledge: async () => {},
        consume: async () => {},
      })
    }
    // (a) Play answers, and has nothing for us
    withDetails(async () => [])
    let b2 = await playBridge()
    ok(await b2!.details(M.SUPPORT_SKU) === null, 'an empty answer is still no price')
    ok((M.lookupReason() ?? '').includes('does not offer this product here'),
      `and says Play answered with nothing ("${(M.lookupReason() ?? '').slice(0, 60)}...")`)
    // (b) the service is attached but broken
    withDetails(async () => { throw Object.assign(new Error('boom'), { name: 'OperationError' }) })
    b2 = await playBridge()
    ok(await b2!.details(M.SUPPORT_SKU) === null, 'a throw is no price either')
    ok((M.lookupReason() ?? '').includes('not answering'),
      'but it is named as a different fault, because it needs a different fix')
    // AND A TAP ON BUY MUST NOT ERASE IT. They shared one slot for an
    // afternoon, and the owner's screen showed the purchase error where the
    // lookup diagnosis should have been - so the one line we were waiting on
    // was overwritten by the act of testing it.
    M.setBillingReason('AbortError: Invalid state.')
    ok((M.lookupReason() ?? '').includes('not answering'),
      'and a failed purchase does not overwrite why the catalogue was empty')
  }

  // ---- 13a3. ACKNOWLEDGE, OR PLAY TAKES THE MONEY BACK --------------------
  //
  // Google emailed the owner on 29 Aug 2026: a paid Estate, cancelled and
  // refunded, "you should ensure that all purchases are acknowledged". The
  // old code read `if (token && svc.acknowledge)` - so a Digital Goods
  // service without acknowledge() skipped the step in total silence and the
  // customer lost the product three days later.
  {
    clear()
    const acks: string[] = []
    const gg3 = globalThis as unknown as Record<string, unknown>
    // (a) a 1.0 service: acknowledge() exists and must be called
    gg3.getDigitalGoodsService = async () => ({
      getDetails: async (skus: string[]) => skus.map(itemId => ({ itemId, title: 't', price: { value: '9.99', currency: 'GBP' } })),
      listPurchases: async () => [{ itemId: M.ESTATE_SKU, purchaseToken: 'tok-estate' }],
      acknowledge: async (t: string, kind: string) => { acks.push(`ack:${t}:${kind}`) },
      consume: async (t: string) => { acks.push(`consume:${t}`) },
    })
    gg3.PaymentRequest = class {
      async show() { return { details: { token: 'tok-new' }, complete: async () => {} } }
    }
    const b1 = await playBridge()
    g.rmBilling = b1!
    await M.buyOwnable(M.ESTATE_SKU)
    ok(acks.includes('ack:tok-new:onetime'),
      'a non-consumable is acknowledged as a one-time purchase')

    // (b) THE SWEEP: an open receipt is settled again at boot, which is the
    // only thing that can rescue a purchase an older build left hanging
    acks.length = 0
    await playBridge()
    await new Promise(r => setTimeout(r, 20))
    ok(acks.includes('ack:tok-estate:onetime'),
      'and every open receipt is re-acknowledged at boot, before the three days run out')

    // (c) a 2.0 service has NO acknowledge - the old code went silent here
    acks.length = 0
    gg3.getDigitalGoodsService = async () => ({
      getDetails: async (skus: string[]) => skus.map(itemId => ({ itemId, title: 't', price: { value: '0.99', currency: 'GBP' } })),
      listPurchases: async () => [{ itemId: M.HEAL_SKU, purchaseToken: 'tok-heal' }],
      consume: async (t: string) => { acks.push(`consume:${t}`) },
    })
    const b2 = await playBridge()
    clear()
    g.rmBilling = b2!
    await M.buyConsumable(M.HEAL_SKU)
    ok(acks.includes('consume:tok-new'),
      'on a 2.0 service a consumable is settled through consume(), which acknowledges it')

    // (d) and a token Play never returned is REPORTED, not shrugged off
    clear()
    gg3.PaymentRequest = class {
      async show() { return { details: {}, complete: async () => {} } }
    }
    const b3 = await playBridge()
    g.rmBilling = b3!
    await M.buyOwnable(M.ESTATE_SKU)
    ok((M.billingReason() ?? '').includes('cannot be acknowledged'),
      'a purchase with no token says so, because silence here is a refund with a three-day fuse')
    // leave a working service standing: the sections below build on it
    gg3.PaymentRequest = class {
      async show() { return { details: { token: 'tok-new' }, complete: async () => {} } }
    }
  }

  // ---- 13b. A REFUSAL IS NOT A CANCELLATION -------------------------------
  //
  // Owner, on v1.1.9: "all show products - nothing is charged is still coming
  // up". Play rejects show() with an AbortError for a whole family of reasons
  // and only one of them is a customer pressing Back - an inactive product, an
  // account that is not a licensed tester, a build older than the products.
  // Mapping them all to 'cancelled' gave "Nothing was charged." to a man who
  // had changed his mind AND to a store refusing outright, which is why the
  // fault could not be read from inside the game.
  //
  // The tell is the clock: nobody opens, reads and dismisses a payment sheet
  // in under 1.2 seconds.
  {
    const abort = (name: string) => class {
      async show(): Promise<never> {
        const e = new Error('the item is not available'); e.name = name; throw e
      }
    }
    // (a) an instant AbortError is Play refusing, and it says why
    gg.PaymentRequest = abort('AbortError')
    const refreshed = await playBridge()
    g.rmBilling = refreshed!
    ok(await M.buyOwnable(M.CHARTER_SKU) === 'refused',
      'an INSTANT AbortError is a refusal, not a cancellation')
    ok((M.billingReason() ?? '').includes('not available'),
      `and the store's own words are kept for the shelf to show ("${M.billingReason()}")`)

    // (b) a slow one really is somebody changing their mind, and says nothing
    gg.PaymentRequest = class {
      async show(): Promise<never> {
        await new Promise(r => setTimeout(r, 1300))
        const e = new Error('user closed the sheet'); e.name = 'AbortError'; throw e
      }
    }
    const slow = await playBridge()
    g.rmBilling = slow!
    ok(await M.buyOwnable(M.ESTATE_SKU) === 'cancelled',
      'a SLOW AbortError is a customer changing their mind, and is reported as one')
    ok(M.billingReason() === null, 'with nothing blamed on anybody')

    // (c) any other error names itself too
    gg.PaymentRequest = abort('NotSupportedError')
    const other = await playBridge()
    g.rmBilling = other!
    ok(await M.buyOwnable(M.ESTATE_SKU) === 'refused', 'and a non-abort failure is a refusal as well')
    ok((M.billingReason() ?? '').startsWith('NotSupportedError'), 'named by its own error')
  }

  // ---- 13c. MONEY TAKEN IS MONEY TAKEN ------------------------------------
  //
  // acknowledge() used to run BEFORE complete() and inside the same try, so a
  // failure there reported 'error' - "try again later" - on a purchase Play
  // had already charged for, and left the sheet hanging. The receipt is in
  // listPurchases either way, so the honest answer is 'owned'.
  {
    let completed = ''
    gg.PaymentRequest = class {
      async show() {
        return {
          details: { token: 'tok-paid' },
          complete: async (status: string) => { completed = status },
        }
      }
    }
    gg.getDigitalGoodsService = async () => ({
      getDetails: async (skus: string[]) =>
        skus.map(itemId => ({ itemId, title: 'A thing', price: { value: '0.99', currency: 'GBP' } })),
      listPurchases: async () => [{ itemId: M.ESTATE_SKU, purchaseToken: 'tok-paid' }],
      acknowledge: async () => { throw new Error('acknowledge failed') },
    })
    const paid = await playBridge()
    clear()                       // no receipt on file, so this is a fresh buy
    g.rmBilling = paid!
    ok(await M.buyOwnable(M.ESTATE_SKU) === 'owned',
      'a purchase whose acknowledgement fails is still OWNED - the money went')
    ok(completed === 'success', 'and the payment sheet is closed rather than left hanging')
    ok((await paid!.owned()).includes(M.ESTATE_SKU),
      'the receipt is still in the account, so Restore can acknowledge it later')
  }

  delete gg.getDigitalGoodsService
  delete gg.PaymentRequest
}

// ---- 13c. THE GAME DECLARES NO COST --------------------------------------
//
// Owner, v1.1.17: "this is going to be sold across different placcs in the
// world - so we need to not declare a cost on the game - let google play do
// that." A figure typed into this repository is right in at most one
// storefront, and both times we tried to be helpful about it - the v1.1.5
// fallback, then the Charter desk reading the ungated call - it ended with a
// shelf that disagreed with the checkout in front of the owner.
//
// Asked of EVERY product rather than the one the sections above happen to use,
// because the way this comes back is somebody adding a product, finding
// details() silent on a dev build, and typing the number in to fill the button.
console.log('\n--- 13c. the game declares no cost: every figure comes from a store')
{
  clear()
  delete g.rmBilling
  const invented: string[] = []
  for (const sku of M.SELLABLE_SKUS) {
    const r = await M.skuPriceFrom(sku)
    if (r.price !== null || r.live) invented.push(`${sku} -> ${r.price}`)
  }
  ok(invented.length === 0,
    `with no store, not one of the ${M.SELLABLE_SKUS.length} products has a price of our own (${invented.join(', ') || 'none do'})`)
  ok(!('skuPrice' in M) && !('supporterPrice' in M) && !('REFERENCE_PRICES' in M),
    'and there is no ungated way to ask for one - a price always arrives with its origin')

  // nor may the module carry a figure to hand out later
  const money = readFileSync('src/game/monetise.ts', 'utf8')
    .split('\n')
    .filter(l => /['"`][^'"`]*[£$€]\s?\d/.test(l.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '')))
  ok(money.length === 0,
    `and monetise.ts holds no money literal at all (${money.join(' | ') || 'none'})`)

  // NO SCREEN ASKS FOR A PRICE AT ALL.
  //
  // This used to be the weaker check that every screen READING a price gated
  // it on `.live ?`, so that only a figure the store itself named could reach
  // a button. v1.2.3 went further at the owner's word - "we said we would
  // remove prices from being shown on the store and across the game - just a
  // buy button" - so the rule is now the absolute one: the UI layer does not
  // read skuPriceFrom, and no string in it renders a price.
  //
  // skuPriceFrom itself stays, and is still called from monetise.ts, because
  // asking the store for a price is how storeReachable() finds out whether
  // there is a store to ask. That is a health check, not a display.
  const priced: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = `${dir}/${e.name}`
      if (e.isDirectory()) { walk(f); continue }
      if (!/\.tsx?$/.test(e.name)) continue
      // comments are allowed to REMEMBER a price - three of them recount the
      // £0.99-vs-£1.19 mismatch that started all this - so the line is read
      // with its comment stripped off before it is judged.
      const src = readFileSync(f, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      if (src.includes('skuPriceFrom') || src.includes('till.buyFor')) priced.push(f)
    }
  }
  walk('src/ui')
  ok(priced.length === 0,
    `no screen in the game shows a price - the payment sheet is the only thing that quotes one (${priced.join(', ') || 'none do'})`)
  // and the string that used to print one is gone from every language
  const dicts = ['en', 'fr', 'es', 'it', 'ja']
    .filter(l => JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8')).till?.buyFor !== undefined)
  ok(dicts.length === 0, `no dictionary still carries a priced buy label (${dicts.join(', ') || 'none'})`)
}

// ---- 14. the iOS bridge, and the three files that have to agree ------------
//
// Section 13 exists because the Android bridge shipped without consume() and
// no probe had ever executed it. The iOS bridge is written from the same
// contract across THREE languages, so it has three more ways to rot quietly:
// the Swift can finish a consumable it should have held, the ObjC macro can
// forget to expose a method (a method not named there is invisible to the web
// view, however well it is written), and the StoreKit test config can drift
// from the catalogue. All four are checked here, in node, before a Mac is
// ever involved.
console.log('\n--- 14. the StoreKit bridge and the native files behind it')
{
  clear()
  const finished: string[] = []
  let held: string[] = []
  const owns: string[] = []
  const gg = globalThis as unknown as Record<string, unknown>
  // THE STUB HAS TO BEHAVE LIKE CAPACITOR, NOT LIKE THE ANSWER.
  //
  // This used to hand-build `Capacitor = { Plugins: { PhaseBilling } }` and
  // assert against that, which is a world @capacitor/core never produces:
  // reading its source, `Plugins[name]` is written in exactly ONE place, inside
  // registerPlugin, and nothing else touches that object. So the probe passed
  // for months while the shipped iOS bridge looked for the plugin in the one
  // place it was guaranteed not to be, and the owner's first real run on a Mac
  // had a perfectly compiled Swift plugin and no shop at all.
  //
  // So: PluginHeaders is what the native side injects, Plugins starts EMPTY,
  // and registerPlugin is the only thing that fills it. Same shape as the real
  // bridge, which is the only shape worth testing against.
  const plugin = {
    details: async ({ skus }: { skus: string[] }) => ({
      products: skus.map(sku => ({ sku, price: '£0.99', title: 'A thing' })),
    }),
    buy: async ({ sku }: { sku: string }) => {
      if (sku === 'phase.nosuch') return { outcome: 'unavailable' }
      // a consumable is left UNFINISHED until the career keeps it; a
      // non-consumable is finished at once and lives in the entitlements
      if (M.CONSUMABLE_SKUS.includes(sku)) held.push(sku)
      else { owns.push(sku); finished.push(sku) }
      return { outcome: 'owned' }
    },
    owned: async () => ({ skus: [...owns, ...held] }),
    consume: async ({ sku }: { sku: string }) => {
      held = held.filter(s => s !== sku)
      finished.push(sku)
      return {}
    },
  }
  const Plugins: Record<string, unknown> = {}
  const capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'ios',
    PluginHeaders: [{ name: 'PhaseBilling' }],
    Plugins,
    isPluginAvailable: (name: string) => name === 'PhaseBilling',
    registerPlugin: (name: string) => { Plugins[name] = plugin; return plugin },
  }
  gg.Capacitor = capacitor

  const { storeKitBridge } = await import('../src/game/storekit')
  ok(Object.keys(Plugins).length === 0,
    'Capacitor.Plugins starts empty, exactly as it does on a real device')
  const b = storeKitBridge()
  ok(!!b, 'the iOS shell gets a bridge - it REGISTERS the plugin rather than expecting to find it')
  ok(!!Plugins.PhaseBilling, 'and registering filled Plugins, for anybody who looks there after us')
  ok(typeof b?.consume === 'function', 'and it can CONSUME - the method whose absence cost Android five products')

  g.rmBilling = b!
  ok(M.tillOpen(), 'the till opens on it')
  ok((await M.skuPriceFrom(M.HEAL_SKU)).price === '£0.99', "StoreKit's own displayPrice is passed through untouched")
  ok(await M.buyConsumable(M.HEAL_SKU) === 'owned', 'a consumable buys')
  ok((await b!.owned()).includes(M.HEAL_SKU),
    'and STAYS owned before it is consumed - an interrupted purchase is recoverable, not lost')
  await M.consume(M.HEAL_SKU)
  ok(!(await b!.owned()).includes(M.HEAL_SKU), 'consuming finishes it, so the App Store will sell it again')
  ok(await M.buyOwnable(M.CHARTER_SKU) === 'owned', 'a non-consumable buys')
  ok(finished.includes(M.CHARTER_SKU), 'and is finished at once, because the entitlement is the record')
  ok(await M.buyOwnable('phase.nosuch') === 'unavailable', 'a SKU the store does not have is unavailable, not an error')

  // ---- AND NO BRIDGE WHERE THERE IS NO NATIVE PLUGIN ----
  //
  // The other half of the fix, and the one a careless version would break.
  // registerPlugin hands back a PROXY that answers to every property name, so
  // `typeof p.buy === 'function'` is true even when nothing native exists. A
  // bridge built on that would open the shop in a Capacitor WEB build and fail
  // every purchase in it. PluginHeaders - what the native side actually
  // injected - is the only honest gate.
  {
    const bare: Record<string, unknown> = {}
    gg.Capacitor = {
      isNativePlatform: () => false,
      getPlatform: () => 'web',
      PluginHeaders: [],
      Plugins: bare,
      isPluginAvailable: () => false,
      registerPlugin: (name: string) => { bare[name] = plugin; return plugin },
    }
    delete g.rmBilling
    ok(storeKitBridge() === null,
      'a Capacitor build with no native plugin gets NO bridge, however willingly registerPlugin would hand back a proxy')
    ok(Object.keys(bare).length === 0, 'and nothing was registered on the way to finding that out')
    ok(!M.tillOpen(), 'so the shop stays shut rather than opening onto a till that cannot sell')
  }

  // ---- the native files, read as text: three ways to disagree ------------
  const swift = readFileSync('packaging/ios/PhaseBilling.swift', 'utf8')
  const objc = readFileSync('packaging/ios/PhaseBilling.m', 'utf8')
  const kit = JSON.parse(readFileSync('packaging/ios/Products.storekit', 'utf8'))

  // (a) Swift's consumables list IS the catalogue's. Miss one and iOS
  //     finishes it at purchase, which kills the recovery path in silence.
  const swiftConsumables = new Set(
    (swift.match(/private static let consumables[\s\S]*?\]/)?.[0] ?? '')
      .match(/"([a-z0-9.]+)"/g)?.map(x => x.replaceAll('"', '')) ?? [],
  )
  ok(swiftConsumables.size === M.CONSUMABLE_SKUS.length &&
     M.CONSUMABLE_SKUS.every(s => swiftConsumables.has(s)),
    `PhaseBilling.swift knows the same five consumables as the catalogue (${[...swiftConsumables].length})`)

  // (b) every method the shim calls is exposed by the ObjC macro
  for (const m of ['details', 'buy', 'owned', 'consume']) {
    ok(new RegExp(`CAP_PLUGIN_METHOD\\(${m},`).test(objc),
      `PhaseBilling.m exposes ${m}() to the web view`)
  }

  // (c) the test config is the catalogue, with the right kinds
  const kitById = new Map<string, string>(kit.products.map((p: { productID: string; type: string }) => [p.productID, p.type]))
  const sellable = [...M.NC_SKUS, ...M.CONSUMABLE_SKUS].filter(s => s !== M.SUPPORTER_SKU)
  ok(sellable.every(s => kitById.has(s)),
    `Products.storekit carries every sellable product (${kitById.size} of ${sellable.length})`)
  ok(M.CONSUMABLE_SKUS.every(s => kitById.get(s) === 'Consumable'),
    'every consumable is typed Consumable there')
  ok(sellable.filter(s => !M.CONSUMABLE_SKUS.includes(s)).every(s => kitById.get(s) === 'NonConsumable'),
    'and the permanent ones NonConsumable')
  ok(!kitById.has(M.SUPPORTER_SKU),
    'Remove-all-ads is absent, exactly as it is absent from Play until a build ships ads')

  // (d) ONE PRICE, ONE CURRENCY, ON BOTH SIDES OF THE FENCE.
  //
  // Owner, v1.1.15: "there is a discrepancy in spend? apple says 99 cents,
  // whereas play is 1.19 pounds for the same thing. I want both scores to be
  // the same."
  //
  // Nine tenths of that is not Apple's number at all. This file is the LOCAL
  // StoreKit test configuration Xcode reads when there is no App Store behind
  // the build, and it carried bare decimals with no storefront named - so
  // Xcode fell back to its default storefront, the United States, and rendered
  // 0.99 as $0.99. Apple has never quoted a price for these products; they do
  // not exist in App Store Connect yet.
  //
  // So the storefront is named and every product carries a figure, because a
  // StoreKit test file with a blank price sells nothing on a Mac.
  //
  // WHAT IS NO LONGER CHECKED, DELIBERATELY: that those figures match the
  // game's. The game stopped holding prices in v1.1.17 - it sells in every
  // storefront Play and the App Store reach, and the real numbers live in the
  // two consoles. This file is a LOCAL TEST FIXTURE, never shipped and never
  // seen by a player, so its numbers only have to exist and be plausible.
  //
  // (An earlier note here blamed the owner's £0.99-vs-£1.19 gap on a
  // tax-exclusive Console setting. That was wrong - tax-inclusive pricing is
  // automatic and has no off switch. Left as a correction because this is
  // where anybody chasing the discrepancy will look.)
  ok(kit.settings?._storefront === 'GBR',
    `the test configuration names a British storefront, so its prices read in pounds (${kit.settings?._storefront ?? 'none'})`)
  const badPrice: string[] = []
  for (const p of kit.products as { productID: string; displayPrice: string }[]) {
    if (!M.SELLABLE_SKUS.includes(p.productID)) badPrice.push(`${p.productID} is in no catalogue`)
    else if (!/^\d+\.\d\d$/.test(p.displayPrice ?? '')) badPrice.push(`${p.productID} priced "${p.displayPrice}"`)
  }
  ok(badPrice.length === 0,
    `every product in it is one this build sells, at a figure Xcode can render (${badPrice.join(', ') || 'all sound'})`)

  // ---- 14b. THE SHELL CAN ACTUALLY BE BUILT --------------------------------
  //
  // The plugin files existed for two releases while the repository had no
  // Capacitor toolchain at all, so `npx cap add ios` could not run and the
  // README's own steps did not work. These are the four things that make the
  // difference between three source files and a shell somebody can build.
  const pkg = JSON.parse(readFileSync('packaging/ios/package.json', 'utf8'))
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  for (const need of ['@capacitor/core', '@capacitor/ios', '@capacitor/cli']) {
    ok(typeof deps[need] === 'string' && /^\d+\.\d+\.\d+$/.test(deps[need]),
      `${need} is a dependency of the shell, pinned exactly (${deps[need] ?? 'missing'})`)
  }
  // one Capacitor version across the three, or the CLI refuses the platform
  ok(new Set(['@capacitor/core', '@capacitor/ios', '@capacitor/cli'].map(k => deps[k])).size === 1,
    'and all three are the same Capacitor version')
  // the shell is its OWN npm project: a Capacitor dependency in the game's
  // package.json is a network-capable library one import away from the bundle
  // netprobe exists to keep clean
  const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const rootDeps = { ...rootPkg.dependencies, ...rootPkg.devDependencies }
  ok(!Object.keys(rootDeps).some(d => d.startsWith('@capacitor/')),
    'and the GAME depends on no part of Capacitor - storekit.ts reads globalThis instead')
  // the header without which PhaseBilling.m cannot compile. Capacitor 8's
  // template generates no bridging header; verified against a real scaffold.
  const bridge = readFileSync('packaging/ios/App-Bridging-Header.h', 'utf8')
  ok(/#import\s+<Capacitor\/Capacitor\.h>/.test(bridge),
    'the bridging header imports Capacitor, so the ObjC plugin stub compiles')
  const scaffold = readFileSync('packaging/ios/scaffold.sh', 'utf8')
  // ---- AND THE ONE LINE THAT DECIDES WHETHER ANY OF IT LOADS ----
  //
  // Capacitor 8 does not scan the Objective-C runtime for plugins. Its
  // registerPlugins() takes five built-ins and then reads packageClassList out
  // of the bundled capacitor.config.json - and nothing else, ever. The CLI
  // builds that list from npm plugin PACKAGES, and PhaseBilling is four files
  // in the app target rather than a package, so `cap sync` writes an empty list
  // and the plugin never comes into existence.
  //
  // Everything else can be perfect - Swift compiled, CAP_PLUGIN macro correct,
  // all four files in Compile Sources - and the game still has no shop, because
  // the Store row is gated on a live bridge. There is no error. The owner's
  // first run on a Mac lost an evening to exactly this.
  //
  // scaffold.sh patches the list after every sync, because the CLI rewrites
  // that file each time and anything in the SOURCE config is discarded.
  {
    const sh = readFileSync('packaging/ios/scaffold.sh', 'utf8')
    ok(/packageClassList/.test(sh),
      'scaffold.sh touches packageClassList - without it Capacitor never loads the plugin')
    ok(/PhaseBilling/.test(sh.slice(sh.indexOf('packageClassList'))),
      'and it is PhaseBilling that gets registered there')
    ok(/capacitor\.config\.json/.test(sh),
      'in the BUNDLED capacitor.config.json, which is the only list the bridge reads')
  }

  for (const f of ['PhaseBilling.swift', 'PhaseBilling.m', 'App-Bridging-Header.h', 'Products.storekit']) {
    ok(scaffold.includes(f), `scaffold.sh installs ${f} into the App target`)
  }
  ok(/appId["']?\s*:\s*["']com\.phaserugbymanager\.app/.test(
    readFileSync('packaging/ios/capacitor.config.json', 'utf8')),
    'and the shell carries the same bundle identity as the Android build')

  delete gg.Capacitor
}

console.log(fails ? `\nMONEY PROBE FAILED (${fails})` : '\nMONEY PROBE PASSED: it fails open, it grants once, and the game is not for sale by the yard')
if (fails) process.exit(1)
