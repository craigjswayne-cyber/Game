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
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    if (refuseWrites) throw new Error('QuotaExceededError')
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
const reset = () => { store.clear(); refuseWrites = false; delete g.rmBilling }

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
}) => {
  const state = { held: o.held, consumes: 0 }
  const b = {
    buy: async () => 'owned' as const,
    owned: async () => Array.from({ length: state.held }, () => SKU),
    consume: async () => {
      state.consumes++
      if (o.spends) state.held = Math.max(0, state.held - 1)
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

console.log('\n---- 9. what the source has to keep saying ----')
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
}

console.log(fails ? `\nSPEND: ${fails} FAILED` : '\nSPEND: all good')
process.exit(fails ? 1 : 0)
