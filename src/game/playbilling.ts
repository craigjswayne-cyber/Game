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

  const details = async (sku: string): Promise<Product | null> => {
    try {
      const [d] = await svc.getDetails([sku])
      // the store formats its own price; a price this code assembled would be
      // wrong in most of the world, so this is the store's two fields joined
      // and nothing more
      return d ? { sku, price: `${d.price.value} ${d.price.currency}`, title: d.title } : null
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
      if (token && svc.acknowledge) await svc.acknowledge(token, 'onetime')
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

  return { details, buy, owned }
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
