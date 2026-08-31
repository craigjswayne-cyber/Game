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
 * settles, no paid receipt is left unacknowledged, and no receipt whose grant
 * has still to land in a career has been spent.
 *
 * Run: npx vite-node scripts/tillprobe.ts
 */
import { CONSUMABLE_SKUS, SELLABLE_SKUS, SPENDABLE_UNASKED, HEAL_SKU, SUPPORT_SKU } from '../src/game/monetise'
import { playBridge } from '../src/game/playbilling'

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
  ok(SPENDABLE_UNASKED.every(s => CONSUMABLE_SKUS.includes(s)),
     'every sweep-spendable sku is a consumable')
  ok(!SPENDABLE_UNASKED.includes(HEAL_SKU),
     'the heal is NOT sweep-spendable - it lands in a career the manager picks')
  ok(SPENDABLE_UNASKED.includes(SUPPORT_SKU),
     'the tip jar IS sweep-spendable - there is nothing left to collect and nothing else can save it')
}

// ---- a purchase is acknowledged whatever the sheet calls the token ----
for (const spelling of ['token', 'purchaseToken', 'silent'] as Spelling[]) {
  for (const shape of ['ack', 'consume', 'both'] as Shape[]) {
    const play = stubPlay(shape, spelling)
    const b = await playBridge()
    if (!b) { ok(false, `a ${shape} service with a ${spelling} sheet built no bridge at all`); continue }
    for (const sku of SELLABLE_SKUS) await b.buy(sku)
    const left = play.unsettled()
    ok(left.length === 0,
       `${shape} service, sheet names the token as "${spelling}": every purchase acknowledged (${left.length} left: ${left.join(', ') || 'none'})`)
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

// ---- and it does not spend what a career has still to collect ----
{
  const play = stubPlay('consume', 'token', [
    { itemId: HEAL_SKU, purchaseToken: 'stale-heal' },
  ])
  await playBridge()
  await new Promise(r => setTimeout(r, 20))
  ok(!play.spent().includes(HEAL_SKU),
     'a paid heal the manager has not applied yet is NOT spent by the sweep')
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
  ? '\nTILL PROBE PASSED: every purchase is acknowledged, and nothing uncollected is spent'
  : `\nTILL PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
