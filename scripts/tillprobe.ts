/**
 * ---- NOBODY PAYS AND GETS NOTHING ----
 *
 * On 30 Aug 2026 Google emailed the owner about order GPA.3318-1043-1618-76026:
 * a paid Support the game, £1.19, "cancelled because it was not acknowledged".
 * Play refunds an unacknowledged purchase after three days. The customer sees a
 * game that took their money and then quietly gave it back, and the developer
 * sees nothing at all - which is why this file exists rather than another
 * comment about being careful.
 *
 * Two faults put that order on the floor, and both are claimed here:
 *
 *   1. THE TOKEN HAS TWO SPELLINGS. Chrome's Digital Goods samples read the
 *      purchase token off details.token in some places and details.purchaseToken
 *      in others. Read the wrong one and you get undefined, skip acknowledgement
 *      in silence, and lose the sale seventy-two hours later.
 *   2. THE BOOT SWEEP SKIPPED EVERY CONSUMABLE. The sweep is the only thing that
 *      can rescue a receipt an older build left open. It walked past the one
 *      product that has no other way to be settled.
 *
 * The bridge is driven against a STUB Digital Goods service - one per shape the
 * real world hands out (1.0 with acknowledge, 2.0 with consume, a service whose
 * acknowledge throws) - and the claim is always the same: after the dust
 * settles, no paid receipt is left unacknowledged, and every spent consumable
 * has banked a CREDIT in the game's own ledger.
 *
 * (v1.1.18: the claim used to be that a receipt whose grant had not landed in
 * a career was never spent. The 31 Aug refund emails ended that: 2.0 has no
 * acknowledge(), so an unspent consumable receipt cannot be protected at all,
 * and Play refunded every held one on its clock. Held now means banked.)
 *
 * Run: npx vite-node scripts/tillprobe.ts
 */
import { CONSUMABLE_SKUS, SELLABLE_SKUS, HEAL_SKU, SUPPORT_SKU, creditCount } from '../src/game/monetise'
import { playBridge } from '../src/game/playbilling'

// the credit bank lives in localStorage; the probe provides one so banking
// is observable rather than silently swallowed by creditAdd's try/catch
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)) },
  removeItem: (k: string) => { mem.delete(k) },
  clear: () => { mem.clear() },
  key: () => null, length: 0,
} as unknown as Storage

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

type Shape = 'ack' | 'consume' | 'both' | 'ackThrows'
type Receipt = { itemId: string; purchaseToken: string }

/** How the purchase sheet names the token it hands back. */
type Spelling = 'token' | 'purchaseToken' | 'silent'

/** A stub Play, with a ledger of what was done to every receipt. */
function stubPlay(shape: Shape, spelling: Spelling, open: Receipt[] = []) {
  const purchases: Receipt[] = [...open]
  const acked = new Set<string>()
  const spent = new Set<string>()
  const completed = new Set<string>()
  let n = 0

  const svc = {
    getDetails: async (skus: string[]) => skus
      .filter(s => SELLABLE_SKUS.includes(s))
      .map(s => ({ itemId: s, title: s, price: { value: '0.99', currency: 'GBP' } })),
    listPurchases: async () => purchases.filter(p => !spent.has(p.purchaseToken)),
    ...(shape === 'ack' || shape === 'both' ? {
      acknowledge: async (token: string) => { acked.add(token) },
    } : {}),
    ...(shape === 'ackThrows' ? {
      acknowledge: async () => { throw new Error('service disconnected') },
    } : {}),
    ...(shape === 'consume' || shape === 'both' || shape === 'ackThrows' ? {
      consume: async (token: string) => { spent.add(token); acked.add(token) },
    } : {}),
  }

  const g = globalThis as unknown as Record<string, unknown>
  g.getDigitalGoodsService = async () => svc
  g.PaymentRequest = class {
    private sku: string
    constructor(methods: { data?: { sku?: string } }[]) { this.sku = methods[0]?.data?.sku ?? '' }
    async show() {
      const purchaseToken = `tok-${++n}`
      purchases.push({ itemId: this.sku, purchaseToken })
      const details = spelling === 'silent' ? {}
        : spelling === 'token' ? { token: purchaseToken }
        : { purchaseToken }
      return {
        details,
        // COMPLETING THE SHEET IS ITSELF AN ACKNOWLEDGEMENT - of a
        // NON-CONSUMABLE, and only on a 2.0 service, which is why 2.0 dropped
        // acknowledge() at all. This is not a detail the stub may skip: the
        // owner's FIRST refund (a paid Estate, 29 Aug 2026) happened because
        // the old bridge tried to acknowledge BEFORE complete() and inside the
        // same try, so a throw meant complete() never ran and the browser never
        // did the one thing that would have saved it. A consumable gets nothing
        // from complete(); it has to be spent.
        complete: async (status: string) => {
          const twoOh = typeof (svc as { acknowledge?: unknown }).acknowledge !== 'function'
          if (status === 'success' && twoOh && !CONSUMABLE_SKUS.includes(this.sku)) acked.add(purchaseToken)
          completed.add(purchaseToken)
        },
      }
    }
  }
  /** Receipts Play would still be counting down to a refund on. */
  const unsettled = () => purchases.filter(p => !acked.has(p.purchaseToken)).map(p => p.itemId)
  return {
    unsettled,
    spent: () => purchases.filter(p => spent.has(p.purchaseToken)).map(p => p.itemId),
    /** Sheets the bridge paid for and never closed. */
    hanging: () => purchases.filter(p => !completed.has(p.purchaseToken)).map(p => p.itemId),
  }
}

// ---- the catalogue is honest about what needs collecting ----
{
  ok(CONSUMABLE_SKUS.includes(HEAL_SKU) && CONSUMABLE_SKUS.includes(SUPPORT_SKU),
     'the heal and the tip jar are consumables - the products the credit bank exists for')
}

// ---- a purchase is acknowledged whatever the sheet calls the token ----
for (const spelling of ['token', 'purchaseToken', 'silent'] as Spelling[]) {
  for (const shape of ['ack', 'consume', 'both'] as Shape[]) {
    const play = stubPlay(shape, spelling)
    const b = await playBridge()
    if (!b) { ok(false, `a ${shape} service with a ${spelling} sheet built no bridge at all`); continue }
    mem.clear()
    for (const sku of SELLABLE_SKUS) await b.buy(sku)
    const left = play.unsettled()
    ok(left.length === 0,
       `${shape} service, sheet names the token as "${spelling}": every purchase acknowledged (${left.length} left: ${left.join(', ') || 'none'})`)
    if (shape !== 'ack') {
      // a service that can consume spends every consumable at the till, and
      // every spend banks exactly one credit - the value is in OUR ledger now
      const unbanked = CONSUMABLE_SKUS.filter(sku => SELLABLE_SKUS.includes(sku) && creditCount(sku) !== 1)
      ok(unbanked.length === 0,
         `${shape}/${spelling}: every consumable spent at the till banked one credit (${unbanked.join(', ') || 'all banked'})`)
    }
    const hung = play.hanging()
    ok(hung.length === 0,
       `${shape}/${spelling}: every paid sheet was completed (${hung.join(', ') || 'none'} left hanging)`)
  }
}

// ---- an acknowledge that throws does not take the sale with it ----
{
  const play = stubPlay('ackThrows', 'token')
  const b = await playBridge()
  if (!b) ok(false, 'no bridge for the throwing service')
  else {
    await b.buy(SUPPORT_SKU)
    ok(play.unsettled().length === 0,
       'acknowledge() threw, consume() settled it instead - one broken lever is not a refund')
  }
}

// ---- THE SWEEP. An older build left these open; the boot must rescue them ----
{
  const play = stubPlay('consume', 'token', [
    { itemId: SUPPORT_SKU, purchaseToken: 'stale-tip' },
  ])
  await playBridge()
  // the sweep is fired and forgotten by playBridge; let its promises drain
  await new Promise(r => setTimeout(r, 20))
  ok(play.unsettled().length === 0,
     'a tip left open by an older build is settled at boot - the fault that cost order GPA.3318-1043-1618-76026')
}

// ---- a stale heal is RESCUED INTO THE BANK, not left for the refund clock ----
{
  mem.clear()
  const play = stubPlay('consume', 'token', [
    { itemId: HEAL_SKU, purchaseToken: 'stale-heal' },
  ])
  await playBridge()
  await new Promise(r => setTimeout(r, 20))
  ok(play.spent().includes(HEAL_SKU),
     'a heal left open by an older build IS spent by the sweep - an open receipt is a refund waiting to happen')
  ok(creditCount(HEAL_SKU) === 1,
     'and the value landed in the bank: one heal credit, waiting for a career to collect it')
}

// ---- A CONSUME THAT FAILS THE FIRST FEW TIMES STILL LANDS THE SALE ----
//
// Order GPA.3306-2919-4643-97851: paid at 19:03:45 on 1 Sept 2026, refunded at
// 19:08 "because it was not acknowledged". Every lever here used to get ONE
// attempt, and these calls are local IPC to the Play app that fail transiently
// - never busier than in the second after a payment sheet closes. One unlucky
// throw and the receipt sat open until the next boot, which on a licence
// tester's FIVE-MINUTE refund clock is far too late.
{
  mem.clear()
  let refusals = 2
  const purchases: { itemId: string; purchaseToken: string }[] = []
  const spent = new Set<string>()
  let n = 0
  const svc = {
    getDetails: async (skus: string[]) => skus.map(x => ({ itemId: x, title: x, price: { value: '0.99', currency: 'GBP' } })),
    listPurchases: async () => purchases.filter(p => !spent.has(p.purchaseToken)),
    consume: async (token: string) => {
      if (refusals-- > 0) throw new Error('service busy')
      spent.add(token)
    },
  }
  const g = globalThis as unknown as Record<string, unknown>
  g.getDigitalGoodsService = async () => svc
  g.PaymentRequest = class {
    private sku: string
    constructor(m: { data?: { sku?: string } }[]) { this.sku = m[0]?.data?.sku ?? '' }
    async show() {
      const purchaseToken = `flaky-${++n}`
      purchases.push({ itemId: this.sku, purchaseToken })
      return { details: { token: purchaseToken }, complete: async () => {} }
    }
  }
  const b = await playBridge()
  if (!b) ok(false, 'no bridge for the flaky service')
  else {
    await b.buy(SUPPORT_SKU)
    ok(spent.size === 1, 'a consume that threw twice is retried until it lands - no open receipt for Play to refund')
    ok(creditCount(SUPPORT_SKU) === 1, 'and the spend still banks exactly one credit, not one per attempt')
  }
}

// ---- AND IF IT WILL NOT LAND AT THE TILL, IT IS CHASED WITHIN THE SESSION ----
//
// The boot sweep is the only thing that ever came back for a failed settle,
// and a tester who does not close the game never gets one. A store that
// refuses every attempt at the till but recovers a moment later must still be
// settled without the game being restarted.
{
  mem.clear()
  let dead = true            // the store refuses everything at first
  const purchases: { itemId: string; purchaseToken: string }[] = []
  const spent = new Set<string>()
  let n = 0
  const svc = {
    getDetails: async (skus: string[]) => skus.map(x => ({ itemId: x, title: x, price: { value: '0.99', currency: 'GBP' } })),
    listPurchases: async () => purchases.filter(p => !spent.has(p.purchaseToken)),
    consume: async (token: string) => {
      if (dead) throw new Error('service disconnected')
      spent.add(token)
    },
  }
  const g = globalThis as unknown as Record<string, unknown>
  g.getDigitalGoodsService = async () => svc
  g.PaymentRequest = class {
    private sku: string
    constructor(m: { data?: { sku?: string } }[]) { this.sku = m[0]?.data?.sku ?? '' }
    async show() {
      const purchaseToken = `chase-${++n}`
      purchases.push({ itemId: this.sku, purchaseToken })
      return { details: { token: purchaseToken }, complete: async () => {} }
    }
  }
  const b = await playBridge()
  if (!b) ok(false, 'no bridge for the dead-then-recovering service')
  else {
    await b.buy(HEAL_SKU)
    ok(spent.size === 0, 'the till could not settle it: the receipt is open and the refund clock is running')
    dead = false // the store comes back, as a wedged one does
    // the first chase pass is at four seconds; give it that plus a breath
    await new Promise(r => setTimeout(r, 5_000))
    ok(spent.size === 1, 'the chase settled it inside the session - no restart, no refund')
    ok(creditCount(HEAL_SKU) === 1, 'and it banked the credit it was owed')
  }
}

// ---- a non-consumable is settled by the sweep, as it always was ----
{
  const play = stubPlay('ack', 'token', [
    { itemId: 'phase.estate', purchaseToken: 'stale-estate' },
  ])
  await playBridge()
  await new Promise(r => setTimeout(r, 20))
  ok(play.unsettled().length === 0, 'an open non-consumable receipt is acknowledged at boot')
}

console.log(fails === 0
  ? '\nTILL PROBE PASSED: every purchase is acknowledged, and every spend is banked'
  : `\nTILL PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
