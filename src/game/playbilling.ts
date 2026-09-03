/**
 * ---- THE ANDROID HALF OF THE BRIDGE ----
 *
 * monetise.ts says a packaged shell injects `globalThis.rmBilling`. That is how
 * an iOS wrapper works - a WKWebView can inject a script before the page runs -
 * and it is NOT how Android works, which is the kind of detail that only shows
 * up when somebody tries to ship.
 *
 * A Trusted Web Activity does not inject anything. It loads the same web app in
 * the browser's own container, and if the app is signed and verified and the TWA
 * declares Play Billing, the BROWSER hands the page a Digital Goods service. So
 * on Android the page has to build its own bridge out of two browser APIs:
 *
 *   getDigitalGoodsService()  - what this account owns, and what things cost
 *   PaymentRequest            - the store's own purchase sheet
 *
 * Both are browser APIs in the same family as navigator.share: they hand work to
 * something outside the page and return an answer. Nothing here opens a socket,
 * names a host or sends anything of the player's anywhere, which is why
 * scripts/netprobe.ts still passes with this file in the build and why the
 * privacy answer is unchanged.
 *
 * IT IS ALL FAILURE-FIRST. Every call is wrapped, because every one of them
 * rejects on a device that is signed out, offline, verifying, or simply a normal
 * browser tab - which is the case for everyone playing the web build. A rejected
 * handshake means no bridge, which means no purchase door, which is exactly what
 * the web build should look like.
 */
import { CONSUMABLE_SKUS, creditAdd, setBillingReason, setLookupReason } from './monetise'
import type { BillingBridge, Product, PurchaseOutcome } from './monetise'

/** Play's own identifier for its billing service. */
const PLAY = 'https://play.google.com/billing'

interface DigitalGoodsService {
  getDetails(skus: string[]): Promise<{ itemId: string; title?: string; price: { value: string; currency: string } }[]>
  listPurchases(): Promise<{ itemId: string; purchaseToken: string }[]>
  acknowledge?(token: string, type: string): Promise<void>
  consume?(token: string): Promise<void>
}

type WithDigitalGoods = {
  getDigitalGoodsService?: (method: string) => Promise<DigitalGoodsService>
  PaymentRequest?: new (methods: unknown[], details: unknown) => {
    abort(): Promise<void>
    show(): Promise<{ details: { token?: string; purchaseToken?: string }; complete(status: string): Promise<void> }>
  }
}

/**
 * Build a bridge if - and only if - this really is a billing-enabled TWA.
 *
 * Returns null everywhere else, silently. "Everywhere else" includes every
 * browser this game has ever run in.
 */
export async function playBridge(): Promise<BillingBridge | null> {
  const w = globalThis as unknown as WithDigitalGoods
  if (typeof w.getDigitalGoodsService !== 'function' || typeof w.PaymentRequest !== 'function') return null

  let svc: DigitalGoodsService
  try {
    svc = await w.getDigitalGoodsService(PLAY)
  } catch {
    // a normal tab, an unverified TWA, or a device with no Play services
    return null
  }

  /** Play hands back a value and a currency code; joining them raw prints
   *  "0.99 GBP" on the button. Intl renders the customer's own convention
   *  from the store's own numbers - nothing is assembled or converted here,
   *  and an unknown code falls back to the raw join. */
  const money = (value: string, currency: string): string => {
    const n = Number(value)
    if (!Number.isFinite(n)) return `${value} ${currency}`
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)
    } catch { return `${value} ${currency}` }
  }

  const details = async (sku: string): Promise<Product | null> => {
    // SAY WHICH KIND OF NOTHING THIS IS.
    //
    // A silent `return null` covers two completely different faults, and the
    // owner spent a morning between them: getDetails THROWING means the
    // Digital Goods service is not really talking to Play, while getDetails
    // ANSWERING WITH AN EMPTY LIST means Play is talking fine and does not
    // consider this product sellable to this app, on this account, right now.
    // Every console setting we could check came back correct, so the next
    // move is to stop guessing and read what Play actually said.
    try {
      const got = await svc.getDetails([sku])
      const [d] = got
      if (!d) {
        setLookupReason(`getDetails answered with ${Array.isArray(got) ? got.length : 'no'} items for ${sku} - Play is reachable and does not offer this product here`)
        return null
      }
      return { sku, price: money(d.price.value, d.price.currency), title: d.title }
    } catch (e) {
      const err = e as Error
      setLookupReason(`getDetails threw ${err?.name ?? 'Error'}: ${err?.message ?? 'no detail'} - the billing service is attached but not answering`)
      return null
    }
  }

  /** The whole shelf in one getDetails. Play accepts the array natively; a
   *  product it does not offer is simply absent from the answer, which is
   *  the same "not sellable here" the single-sku path reports as null. */
  const detailsMany = async (skus: string[]): Promise<Product[]> => {
    try {
      const got = await svc.getDetails(skus)
      const list = Array.isArray(got) ? got : []
      if (list.length < skus.length) {
        const missing = skus.filter(s => !list.some(d => d.itemId === s))
        setLookupReason(`getDetails answered for ${list.length} of ${skus.length} products - Play is reachable and does not offer ${missing.join(', ')} here`)
      }
      return list.map(d => ({ sku: d.itemId, price: money(d.price.value, d.price.currency), title: d.title }))
    } catch (e) {
      const err = e as Error
      setLookupReason(`getDetails threw ${err?.name ?? 'Error'}: ${err?.message ?? 'no detail'} - the billing service is attached but not answering`)
      throw err
    }
  }

  /**
   * THE RECEIPT, HOWEVER THIS BROWSER SPELLS IT.
   *
   * Chrome's own Digital Goods samples disagree with each other: some read the
   * purchase token off `paymentResponse.details.token`, some off
   * `.purchaseToken`. A build that reads the wrong one gets `undefined`, skips
   * acknowledgement, and Play refunds the customer three days later - which is
   * order GPA.3318-1043-1618-76026, a paid Support the game cancelled on the
   * morning of 30 Aug 2026 because nothing ever acknowledged it.
   *
   * So read both spellings, and if the sheet named neither, ask the account
   * what it has just bought. listPurchases is the authority on open receipts
   * and it has only one name for the token.
   */
  const tokenFor = async (sku: string, details: unknown): Promise<string | undefined> => {
    // Play's payment response is supposed to carry the purchase token in
    // details - but "supposed to" has already cost one evening of refunds, so
    // every shape it has been seen in is read: an object, a JSON string, and
    // absent entirely. The 31 Aug refund emails ("cancelled because it was
    // not acknowledged", on every test purchase of the night) are what an
    // undefined token here looks like from the outside: settle() has nothing
    // to consume with, says so only in billingReason, and Play takes the
    // money back on its clock.
    let d = details as { token?: string; purchaseToken?: string } | string | undefined
    if (typeof d === 'string') { try { d = JSON.parse(d) as { token?: string; purchaseToken?: string } } catch { d = undefined } }
    const named = d && typeof d === 'object' ? d.token ?? d.purchaseToken : undefined
    if (named) return named
    // No token in the response: ask the account. The receipt can lag the
    // sheet by a moment, so ask more than once before giving up - this runs
    // AFTER complete(), when the purchase is at least supposed to be filed.
    for (let tries = 0; tries < 4; tries++) {
      try {
        const t = (await bounded(svc.listPurchases(), 8_000))?.find(p => p.itemId === sku)?.purchaseToken
        if (t) return t
      } catch { /* offline blip: the retry is the point */ }
      await new Promise(r => setTimeout(r, 350 * (tries + 1)))
    }
    return undefined
  }

  /** A human cannot open Play's sheet, read it and dismiss it inside this
   *  many milliseconds. An AbortError that arrives faster than this is Play
   *  refusing to open the sheet at all - the item is not active, the account
   *  is not a licensed tester, the installed build predates the products -
   *  and calling that a cancellation is what made the fault invisible. */
  const HUMAN_MS = 1200

  /** THE SHEET THAT NEVER CAME (owner, v1.2.6: "buy option - holding on
   *  asking the store? No purchase completed").
   *
   *  PaymentRequest.show() settles when the customer pays or backs out of
   *  Play's sheet - and never, if Play never puts the sheet up. Nothing here
   *  bounded it, because a person reading a payment sheet cannot be put on a
   *  timer; so the one tap where Play went quiet left "Asking the store..."
   *  on the button until the app was killed.
   *
   *  The way out is the browser's own word on whether anybody is looking at a
   *  sheet: abort() REJECTS while a payment is genuinely in progress, and
   *  resolves when there is nothing to abort. So after SHEET_MS the request
   *  is asked to abort - a real customer mid-payment is untouched, because
   *  the abort is refused and the wait goes on; a sheet that never opened is
   *  closed, named, and the button comes back. Money never moves on this
   *  path: the sheet was not there. */
  // ninety seconds by default; a probe may shorten it through the window it
  // builds, because a test that waits a minute and a half for a sheet that
  // was never going to open is not a test anybody runs
  const SHEET_MS = (w as { __phaseSheetMs?: number }).__phaseSheetMs ?? 90_000
  /** A bridge call the customer is not looking at, with a ceiling. */
  const bounded = <T>(job: Promise<T>, ms: number): Promise<T | undefined> =>
    new Promise(resolve => {
      const timer = setTimeout(() => resolve(undefined), ms)
      job.then(v => { clearTimeout(timer); resolve(v) }, () => { clearTimeout(timer); resolve(undefined) })
    })

  const buy = async (sku: string): Promise<PurchaseOutcome> => {
    setBillingReason(null)
    const asked = Date.now()
    let res: Awaited<ReturnType<InstanceType<NonNullable<WithDigitalGoods['PaymentRequest']>>['show']>>
    try {
      const req = new w.PaymentRequest!(
        [{ supportedMethods: PLAY, data: { sku } }],
        // Play fills in the real total from the SKU; this shape is required and
        // its numbers are ignored
        { total: { label: 'Total', amount: { currency: 'GBP', value: '0' } } },
      )
      const shown = req.show()
      shown.catch(() => { /* answered below, or abandoned on purpose */ })
      const stall = new Promise<'stall'>(r => setTimeout(() => r('stall'), SHEET_MS))
      const first = await Promise.race([shown, stall])
      if (first === 'stall') {
        let closed = false
        try { await req.abort(); closed = true } catch { /* somebody is in the sheet: wait for them */ }
        if (closed) {
          setBillingReason(`Play did not open its payment sheet inside ${SHEET_MS / 1000} seconds`)
          return 'refused'
        }
        res = await shown
      } else {
        res = first
      }
    } catch (e) {
      const err = e as Error
      const quick = Date.now() - asked < HUMAN_MS
      // a cancel arrives as an AbortError and is not a failure: telling somebody
      // who changed their mind that something went wrong is how a purchase flow
      // earns a one-star review. But only a SLOW AbortError is a cancel.
      if (err?.name === 'AbortError' && !quick) return 'cancelled'
      // ---- ALREADY OWNED IS NOT A FAILURE. IT IS AN UNDELIVERED PURCHASE. ----
      //
      // Play refuses to open the sheet for a consumable the account already
      // holds, with its own dialog: "You already own this item." v1.1.16 fixed
      // the cause of those - consume() was never reached, so nothing was ever
      // given back to the shelf - but it did nothing for the receipts ALREADY
      // stuck on the owner's account when that build landed. He bought an
      // injection, got one, and every further tap answered "you already own
      // this item" (v1.1.17: "Ive clicked to add some cash - it did one, all
      // other cash injections are unavailable to click... Says i already this
      // item still").
      //
      // He is right, and reporting that as an error is the wrong answer twice
      // over: he has paid for something he has not received, and the game is
      // the only thing that can hand it to him. So the refusal is checked
      // against the account's open receipts, and a SKU sitting there is
      // reported as 'owned' - which is what it is. The caller then does what
      // it does after any successful purchase: writes the grant into the
      // career and sends the consume, which finally releases the shelf.
      //
      // No second charge happens on this path. Play never opened the sheet.
      try {
        const held = (await bounded(svc.listPurchases(), 8_000))?.find(p => p.itemId === sku)
        if (held) {
          setBillingReason(null)
          return 'owned'
        }
      } catch { /* the account cannot be asked; fall through and report */ }
      setBillingReason(`${err?.name ?? 'Error'}: ${err?.message ?? 'no detail'}`)
      return 'refused'
    }

    // PAID. From here the money may already be gone, so nothing below may
    // report a failure that would make the player try again.
    //
    // complete() comes FIRST. The token lookup falls back to listPurchases,
    // and a purchase is not reliably filed there until the payment response
    // is completed - looking before completing is how an evening of test
    // purchases went unacknowledged and were refunded on the five-minute
    // tester clock (31 Aug).
    try { await res.complete('success') } catch { /* the sheet closed itself */ }
    const token = await tokenFor(sku, res.details)
    // ACKNOWLEDGE, OR PLAY REFUNDS IT. An unacknowledged purchase is
    // automatically refunded after three days, which looks to the customer
    // like the game took their money and then took the badge back. It used to
    // run BEFORE complete() and inside the same try, so a failure here both
    // left the sheet hanging and reported 'error' on a purchase that had been
    // paid for. Now it cannot: the receipt stays in listPurchases and Restore
    // picks it up.
    // PAID. If it would not settle, keep after it - see chase() below.
    if (!(await settle(sku, token, 'buy'))) chase(sku)
    return 'owned'
  }

  /**
   * ACKNOWLEDGE, OR PLAY TAKES THE MONEY BACK.
   *
   * An unacknowledged Play purchase is refunded automatically after three
   * days. Google emailed the owner exactly that on 29 Aug 2026 - a paid
   * Estate, cancelled, "you should ensure that all purchases are
   * acknowledged" - and the reason it happened is visible above: the old code
   * ran `if (token && svc.acknowledge)`, so on a Digital Goods service that
   * has no acknowledge() the whole step was skipped IN SILENCE. Nothing was
   * logged, nothing was shown, and the customer simply lost the thing they
   * bought seventy-two hours later.
   *
   * Digital Goods 1.0 spells it acknowledge(token, type); 2.0 dropped that
   * and expects the browser to acknowledge a non-consumable when the payment
   * completes, keeping consume() for the repeatable ones. So both are tried,
   * in that order, and - this is the part that was missing - if NEITHER is
   * possible the fact is recorded rather than shrugged off, because a
   * purchase this code cannot acknowledge is a refund with a three-day fuse.
   */
  const settle = async (sku: string, token: string | undefined, why: 'buy' | 'sweep'): Promise<boolean> => {
    const consumable = CONSUMABLE_SKUS.includes(sku)
    if (!token) {
      if (why === 'buy') setBillingReason(`${sku} was paid for but Play returned no purchase token, so it cannot be acknowledged`)
      return false
    }
    // EVERY LEVER THIS SERVICE OWNS, IN TURN, UNTIL ONE LANDS - AND FOR A
    // CONSUMABLE, CONSUME IS THE ONE THAT MATTERS.
    //
    // Two bugs have now lived in these six lines, and they are opposites.
    // The first picked one lever and stopped, so an acknowledge() that THREW
    // took the purchase down with it. The fix for that built a list and tried
    // each in turn - but put acknowledge FIRST and returned on the first
    // success, which means consume() was still never reached on a consumable.
    //
    // Those are not interchangeable. Acknowledging stops Play refunding the
    // purchase in three days; only CONSUMING gives the product back to the
    // shelf. Acknowledge a consumable and it is paid for, kept, and owned
    // forever - so the next tap on that row is met with Play's own dialog,
    // "You already own this item", on a product whose entire point is that you
    // can buy it again (owner, v1.1.16: "Error message saying i already own
    // this message but this should be good to buy again and again").
    //
    // So the order is by KIND, not by convenience: a consumable spends first
    // and acknowledges only if spending fails; everything else acknowledges.
    // Both stay in the list, because either landing beats a refund.
    const levers: { name: string; run: () => Promise<void> }[] = []
    // EVERY consumable may be spent, at the till and by the sweep alike,
    // because spending now BANKS A CREDIT (monetise creditAdd): the value
    // lands in the game's own ledger instead of evaporating. The old rule -
    // the sweep spends only the tip jar, everything else waits as an open
    // receipt for a career to collect - left those receipts permanently
    // unacknowledgeable (2.0 has no acknowledge()), and Play refunded every
    // one of them on its clock. An open receipt is not a safe place to keep
    // anything.
    const maySpend = consumable && typeof svc.consume === 'function'
    if (maySpend) {
      levers.push({ name: 'consume', run: async () => { await svc.consume!(token); creditAdd(sku) } })
    }
    if (typeof svc.acknowledge === 'function') {
      levers.push({ name: 'acknowledge', run: () => svc.acknowledge!(token, consumable ? 'repeatable' : 'onetime') })
    }
    // AND EACH LEVER MORE THAN ONCE. Every attempt here used to be a single
    // shot: one throw from consume() and the purchase was left unacknowledged
    // until the next boot, which on a licence tester's FIVE-MINUTE refund
    // clock means the money goes back before the game is ever restarted. The
    // calls are local IPC to the Play app and fail transiently - a moment
    // after a payment sheet closes is exactly when they are busiest - so a
    // spend is attempted three times over about two seconds before the next
    // lever is tried at all.
    let last = 'this Digital Goods service offers neither acknowledge() nor consume()'
    for (const lever of levers) {
      for (let go = 0; go < 3; go++) {
        try {
          await lever.run()
          return true
        } catch (e) {
          const err = e as Error
          last = `${lever.name} threw ${err?.name ?? 'Error'}: ${err?.message ?? 'no detail'}`
        }
        if (go < 2) await new Promise(r => setTimeout(r, 400 * (go + 1)))
      }
    }
    // 2.0 acknowledges a non-consumable itself when the payment completes, so
    // having no lever for one is not a fault.
    if (!levers.length && !consumable) return true
    setBillingReason(`${sku} is PAID but could not be acknowledged (${last}) - Play refunds an unacknowledged purchase after three days`)
    return false
  }

  /**
   * AND IF IT STILL WILL NOT SETTLE, CHASE IT.
   *
   * settle() failing at the till is the worst state this file has: the money
   * is gone, the player has been thanked, and Play is holding a receipt it
   * will refund on a clock nobody in the game can see. Until now the only
   * thing that came back for it was the boot sweep - which helps a customer
   * on a three-day fuse and is useless to a LICENCE TESTER on a five-minute
   * one, because five minutes is shorter than a sitting. Order
   * GPA.3306-2919-4643-97851, paid at 19:03:45 on 1 Sept 2026 and refunded
   * "because it was not acknowledged" at 19:08, is what that looks like: the
   * game was never closed and reopened in between, so nothing ever tried
   * again.
   *
   * So a failed settle now retries inside the session, on a schedule that
   * fits inside the tester clock, and stops the moment the receipt is gone
   * from the account - which is the only proof that it landed. Each pass
   * re-reads the token rather than trusting the one that already failed.
   */
  const CHASE_MS = [4_000, 12_000, 30_000, 60_000, 120_000]
  const chasing = new Set<string>()
  const chase = (sku: string): void => {
    if (chasing.has(sku)) return // one chase per product; the passes are shared
    chasing.add(sku)
    let step = 0
    const again = (): void => {
      if (step >= CHASE_MS.length) { chasing.delete(sku); return }
      const wait = CHASE_MS[step++]
      setTimeout(() => { void (async () => {
        try {
          const held = (await svc.listPurchases()).find(p => p.itemId === sku)
          // gone from the account means consumed or acknowledged: done
          if (!held) { chasing.delete(sku); return }
          if (await settle(sku, held.purchaseToken, 'sweep')) { chasing.delete(sku); return }
        } catch { /* offline for this pass; the next one tries again */ }
        again()
      })() }, wait)
    }
    again()
  }

  /**
   * THE SWEEP. Every open receipt, settled again, at boot.
   *
   * Acknowledgement is idempotent, so this costs nothing when all is well and
   * rescues a purchase whose acknowledgement failed at the till - including
   * one made by an older build, which is the only thing that can save it
   * before the three days run out. It is the difference between a bug that
   * cost one customer one product and a bug that keeps costing.
   *
   * IT USED TO SKIP EVERY CONSUMABLE, which is how the tip jar was lost, and
   * then to spend only the tip jar, which is how a whole evening's test
   * injections were refunded. It spends everything now: a swept consumable
   * becomes a banked credit (see settle), and a credit cannot be taken back.
   */
  const sweep = async (): Promise<void> => {
    try {
      for (const p of await svc.listPurchases()) {
        if (!(await settle(p.itemId, p.purchaseToken, 'sweep'))) chase(p.itemId)
      }
    } catch { /* offline at boot: the next launch tries again */ }
  }

  const owned = async (): Promise<string[]> => {
    try {
      return (await svc.listPurchases()).map(p => p.itemId)
    } catch { return [] }
  }

  /**
   * SPEND THE RECEIPT SO PLAY WILL SELL IT AGAIN.
   *
   * This was missing until v1.1.7, and its absence was not quiet: monetise's
   * buyConsumable REFUSES a purchase outright when the bridge has no consume
   * (there is no honest way to sell a second Full Fitness you can never
   * clear), so every consumable in the shipped TWA - the heal and all four
   * board injections - answered "there is no store attached to this build"
   * with a perfectly good store attached. The owner found it the first
   * evening the Play products went live.
   *
   * monetise's contract is by SKU because that is what a career knows. Play
   * works in purchase TOKENS, so the token is looked up in the account's open
   * purchases - which is exactly what listPurchases is for, and the same call
   * owned() already makes. Digital Goods 2.0 exposes consume(); 1.0 spelled
   * the same thing acknowledge(token, 'repeatable'), so both are honoured.
   */
  const consume = async (sku: string): Promise<void> => {
    const hit = (await svc.listPurchases()).find(p => p.itemId === sku)
    if (!hit) return // already spent, or never owned: nothing to clear
    if (typeof svc.consume === 'function') await svc.consume(hit.purchaseToken)
    else if (typeof svc.acknowledge === 'function') await svc.acknowledge(hit.purchaseToken, 'repeatable')
  }

  void sweep()
  return { details, detailsMany, buy, owned, consume }
}

/**
 * Attach the bridge at boot, if there is one to attach.
 *
 * Never overwrites a bridge a wrapper has already injected: a native iOS shell
 * knows more about its own store than this does.
 */
export async function attachPlayBilling(): Promise<boolean> {
  const g = globalThis as unknown as { rmBilling?: BillingBridge }
  if (g.rmBilling) return false
  const b = await playBridge()
  if (!b) return false
  g.rmBilling = b
  return true
}
