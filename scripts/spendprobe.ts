/**
 * ---- THE FOUR WAYS A CONSUME LOSES SOMEBODY'S MONEY ----
 *
 * moneyprobe holds the rules the till keeps. This holds the ones the SPEND
 * keeps, which is a different job: buying is reversible right up to the
 * moment the receipt is destroyed, and everything here happens after that
 * moment. Four faults were live in v1.5.8 and each has a case below.
 *
 *   1. AN ABANDONED CONSUME BANKED NOTHING. Every bridge call is raced
 *      against a twelve-second clock, and Promise.race does not cancel the
 *      loser - so a slow consume was given up on while it was still running,
 *      the receipt was read as "not spent yet", and the loop broke without
 *      crediting. The consume then landed. Paid, gone, never delivered.
 *   2. A LEDGER THAT COULD NOT WRITE WAS SPENT INTO ANYWAY. writeCredits
 *      swallowed its own failure, so a private-mode browser or a full disk
 *      destroyed the receipt and banked the proceeds into nothing.
 *   3. TWO SWEEPS AT ONCE PAID TWICE. The boot sweep and a tap on Buy can be
 *      in the air together, and interleaved they banked one receipt twice.
 *   4. AN UNCERTAIN OUTCOME WAS REPORTED AS A REFUSAL, on the platform whose
 *      answer is slowest, which invites a second payment for the same thing.
 *
 * Run: npx tsx scripts/spendprobe.ts
 */
import { readFileSync } from 'node:fs'

// ---- a localStorage that can be told to fail, because case 2 is entirely
// about what happens when it does ----
const store = new Map<string, string>()
let refuseWrites = false
/** Refuse the NEXT n writes and then behave. The two faults an external
 *  review found on 12 Sep are both about one write failing at one moment,
 *  which a blanket refusal cannot reproduce. */
let refuseNext = 0
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (refuseWrites) throw new Error('QuotaExceededError')
    if (refuseNext > 0) { refuseNext--; throw new Error('QuotaExceededError') }
    store.set(k, String(v))
  },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => { store.clear() },
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
} as Storage

const M = await import('../src/game/monetise')

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = globalThis as unknown as { rmBilling?: unknown }
const reset = () => { store.clear(); refuseWrites = false; refuseNext = 0; delete g.rmBilling }

const SKU = M.HEAL_SKU

/**
 * A bridge whose account and consume answer are both under the test's control.
 *
 * `answer` is what consume() resolves. `undefined` is the v1.5.8 shell, which
 * resolved nothing at all and is the case the mark exists for; `{}` is a
 * newer shell that cannot prove anything either. `spends` says whether the
 * receipt actually leaves the account while the call is being made.
 */
const fake = (o: {
  held: number
  answer?: { ok?: boolean } | undefined
  spends?: boolean
  /** Runs the instant the store has spent the receipt, which is the only
   *  place a test can stand to break the write that banks the proceeds. */
  onConsume?: () => void
}) => {
  const state = { held: o.held, consumes: 0 }
  const b = {
    buy: async () => 'owned' as const,
    owned: async () => Array.from({ length: state.held }, () => SKU),
    consume: async () => {
      state.consumes++
      if (o.spends) state.held = Math.max(0, state.held - 1)
      o.onConsume?.()
      return o.answer
    },
    state,
  }
  g.rmBilling = b
  return b
}

console.log('\n---- 1. the consume that was abandoned, and landed anyway ----')
{
  reset()
  // The shell answers nothing and the receipt is still on the account when
  // the follow-up read happens: exactly the shape of a watchdog giving up on
  // a call that has not finished. Nothing is proved, so nothing is banked.
  const b = fake({ held: 1, answer: undefined, spends: false })
  const left = await M.bankReceipts(SKU)
  ok(left === 1, 'a spend that proved nothing leaves the receipt reported as still held')
  ok(M.creditCount(SKU) === 0, 'and banks nothing on the strength of a guess')
  ok(await M.claimHeld(SKU) === 'stuck', "the shelf calls that PAID FOR, not 'none' - it must not sell a second one")

  // ...and now the native call lands, late, exactly as it did on the phone.
  b.state.held = 0
  const after = await M.bankReceipts(SKU)
  ok(after === 0, 'the receipt is gone from the account on the next pass')
  ok(M.creditCount(SKU) === 1, 'THE LATE LANDING IS BANKED: the mark turns it into the credit it paid for')
  ok(await M.claimHeld(SKU) === 'credit', 'and the career can collect it')
}

console.log('\n---- 2. and is banked only once ----')
{
  reset()
  const b = fake({ held: 1, answer: undefined, spends: false })
  await M.bankReceipts(SKU)
  b.state.held = 0
  await M.bankReceipts(SKU)
  await M.bankReceipts(SKU)
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'three more sweeps over the same spend bank one credit, not four')
}

console.log('\n---- 3. a store that says outright that nothing landed ----')
{
  reset()
  const b = fake({ held: 1, answer: { ok: false }, spends: false })
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 0, 'a refused consume banks nothing')
  // the receipt now vanishes for a reason that is NOT this spend - a refund,
  // a second device, a chargeback. The mark was dropped when the store
  // answered, so this must not be mistaken for a late landing.
  b.state.held = 0
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 0, 'a receipt that vanished for some OTHER reason is not paid out as a spend')
}

console.log('\n---- 4. a store that proves it, on a read that is behind ----')
{
  reset()
  // consume() reports ok, but owned() has not caught up - which the Play
  // service's own cache makes ordinary. The proof is enough.
  const b = fake({ held: 1, answer: { ok: true }, spends: false })
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, "the bridge's own yes is banked without waiting for owned() to agree")
  b.state.held = 0
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'and the read catching up later does not bank it a second time')
}

console.log('\n---- 5. the ordinary case still works ----')
{
  reset()
  fake({ held: 2, answer: { ok: true }, spends: true })
  const left = await M.bankReceipts(SKU)
  ok(left === 0, 'two open receipts are both spent')
  ok(M.creditCount(SKU) === 2, 'and both are banked')
}

console.log('\n---- 6. nothing is spent into a ledger that cannot keep it ----')
{
  reset()
  const b = fake({ held: 1, answer: { ok: true }, spends: true })
  refuseWrites = true
  const left = await M.bankReceipts(SKU)
  ok(b.state.consumes === 0, 'A DEVICE THAT CANNOT BANK A CREDIT DOES NOT DESTROY THE RECEIPT')
  ok(left === 1, 'the receipt is still there, recoverable on any future launch')
  refuseWrites = false
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'and it is banked the moment storage works again')
}

console.log('\n---- 7. the ledger reports a write it could not make ----')
{
  reset()
  ok(M.creditAdd(SKU) === true, 'a credit that persisted says so')
  ok(M.creditTake(SKU) === true, 'and a draw that persisted says so')
  M.creditAdd(SKU)
  refuseWrites = true
  ok(M.creditAdd(SKU) === false, 'a credit that could not be written says so, rather than swallowing it')
  ok(M.creditTake(SKU) === false, 'and a draw that could not be written REFUSES, so the effect is not granted twice')
}

console.log('\n---- 8. two sweeps at once are one sweep ----')
{
  reset()
  const b = fake({ held: 1, answer: { ok: true }, spends: true })
  // the boot sweep and a tap on Buy, in the same tick
  const [a, c] = await Promise.all([M.bankReceipts(SKU), M.bankReceipts(SKU)])
  ok(b.state.consumes === 1, 'the store is asked to spend the receipt once, not twice')
  ok(M.creditCount(SKU) === 1, 'and one receipt banks one credit')
  ok(a === c, 'both callers read the same answer out of the same sweep')
}

console.log('\n---- 9. the ninth receipt is not lost, only deferred ----')
{
  reset()
  const b = fake({ held: 9, answer: { ok: true }, spends: true })
  const left = await M.bankReceipts(SKU)
  ok(b.state.consumes === 8, 'one sweep spends at most eight')
  ok(M.creditCount(SKU) === 8 && left === 1, 'eight are banked and the ninth is reported as still held')
  ok(await M.claimHeld(SKU) === 'credit', 'the career can collect what is banked')
  const after = await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 9 && after === 0, 'AND THE NINTH IS BANKED ON THE NEXT SWEEP - a throughput limit, not a ceiling')
}

console.log('\n---- 10. the two faults an external review found (12 Sep 2026) ----')
{
  // (a) THE MARK COULD NOT BE WRITTEN. The whole recovery story rests on the
  // mark outliving a call the watchdog gave up on, so a mark that was
  // silently refused is worse than no mark: it reads as protection that is
  // not there. Nothing destructive may happen without one.
  reset()
  const b = fake({ held: 1, answer: { ok: true }, spends: true })
  refuseWrites = true
  const left = await M.bankReceipts(SKU)
  ok(b.state.consumes === 0, 'a mark that will not persist STOPS THE CONSUME - no destructive call without a recovery note')
  ok(left === 1, 'and the receipt is still there, recoverable on any future launch')
  refuseWrites = false
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'and it banks exactly one once storage works')
}
{
  // (b) THE MARK COULD NOT BE CLEARED after the credit was banked. When those
  // were two separate writes to two separate keys, this left credit 1 AND a
  // mark saying 1 owed - and the next sweep, seeing the receipt gone, banked
  // a second credit for the same payment. They are one write now.
  reset()
  // the mark is written and read back FIRST; the refusal is armed from inside
  // the store's own consume, so it lands on exactly the write that banks
  const b = fake({ held: 1, answer: { ok: true }, spends: true, onConsume: () => { refuseNext = 1 } })
  await M.bankReceipts(SKU)
  ok(b.state.consumes === 1, 'the receipt WAS spent at the store, so the money is owed')
  ok(M.creditCount(SKU) === 0, 'a refused bank writes nothing at all - no credit, and the mark still stands')
  const after = await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'THE NEXT SWEEP PAYS IT, ONCE')
  ok(after === 0, 'and nothing is left held')
  await M.bankReceipts(SKU)
  await M.bankReceipts(SKU)
  ok(M.creditCount(SKU) === 1, 'and two more sweeps do not pay it again - the mark went with the credit, in one write')
}

console.log('\n---- 11. what the source has to keep saying ----')
{
  const swift = readFileSync('src/game/storekit.ts', 'utf8')
  ok(!/inside 90 seconds'\); return 'refused'/.test(swift),
    "ninety seconds of silence is not a refusal - it must not tell a paying customer nothing was taken")
  ok(/inside 90 seconds'\); return 'pending'/.test(swift),
    "...it is 'pending', which is what supporter.pending already says truthfully")

  const java = readFileSync('packaging/android/PhaseBilling.java', 'utf8')
  const settle = java.slice(java.indexOf('private void settle('))
  ok(!/CONSUMABLES\.contains/.test(settle.slice(0, 400)),
    'settle() acknowledges EVERY purchase: an unacknowledged consumable is refunded by Play in three days')
  ok(/out\.put\("ok"/.test(java),
    'the Android consume reports an outcome, so the JS side does not have to infer one')

  const ios = readFileSync('packaging/ios/PhaseBilling.swift', 'utf8')
  ok(/"ok": finished > 0/.test(ios), 'and so does the iOS one')

  // EVERY DOOR BANKS BEFORE IT GRANTS. A closed sale leaves a RECEIPT; the
  // credit only exists once bankReceipts has spent that receipt at the store.
  // A door that grants straight off the sale calls creditTake on a bank that
  // is empty, does nothing, leaves the receipt open, and the next sweep banks
  // it - a second free grant. buyGround shipped exactly that in 1.5.8: one
  // £9.99 product, two estates.
  const shop = readFileSync('src/ui/screens/Supporter.tsx', 'utf8')
  for (const [door, sku] of [['buyGround', 'GROUND_SKU'], ['buySupport', 'SUPPORT_SKU']] as const) {
    const body = shop.slice(shop.indexOf(`const ${door} =`), shop.indexOf(`const ${door} =`) + 2200)
    ok(new RegExp(`bankReceipts\\(${sku}\\)[\\s\\S]*creditTake\\(${sku}\\)`).test(body),
      `${door} banks the receipt BEFORE it spends the credit`)
  }
  ok(/bankReceipts\(GROUND_SKU\)[\s\S]{0,300}creditCount\(GROUND_SKU\) < 1/.test(shop),
    'and the ground refuses to build when the bank is empty, rather than building on a receipt')
}

console.log(fails ? `\nSPEND: ${fails} FAILED` : '\nSPEND: all good')
process.exit(fails ? 1 : 0)
