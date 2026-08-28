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
import { CONSUMABLE_SKUS } from './monetise'
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
    show(): Promise<{ details: { token?: string }; complete(status: string): Promise<void> }>
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
    try {
      const [d] = await svc.getDetails([sku])
      return d ? { sku, price: money(d.price.value, d.price.currency), title: d.title } : null
    } catch { return null }
  }

  const buy = async (sku: string): Promise<PurchaseOutcome> => {
    try {
      const req = new w.PaymentRequest!(
        [{ supportedMethods: PLAY, data: { sku } }],
        // Play fills in the real total from the SKU; this shape is required and
        // its numbers are ignored
        { total: { label: 'Total', amount: { currency: 'GBP', value: '0' } } },
      )
      const res = await req.show()
      const token = res.details?.token
      // ACKNOWLEDGE, OR PLAY REFUNDS IT. An unacknowledged purchase is
      // automatically refunded after three days, which looks to the customer
      // like the game took their money and then took the badge back.
      if (token && svc.acknowledge) {
        await svc.acknowledge(token, CONSUMABLE_SKUS.includes(sku) ? 'repeatable' : 'onetime')
      }
      await res.complete('success')
      return 'owned'
    } catch (e) {
      // a cancel arrives as an AbortError and is not a failure: telling somebody
      // who changed their mind that something went wrong is how a purchase flow
      // earns a one-star review
      return (e as Error)?.name === 'AbortError' ? 'cancelled' : 'error'
    }
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

  return { details, buy, owned, consume }
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
