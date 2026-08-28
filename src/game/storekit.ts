/**
 * ---- THE iOS HALF OF THE BRIDGE ----
 *
 * playbilling.ts explains why Android has to BUILD its bridge out of browser
 * APIs: a TWA injects nothing. iOS is the other case, and the easier one. The
 * app is a Capacitor shell around the same web build, and a Capacitor plugin
 * is exactly a native object the page can call - so the whole of the Apple
 * side is a Swift class (packaging/ios/PhaseBilling.swift) and this, which
 * dresses it in the shape monetise.ts already speaks.
 *
 * NOTHING IS IMPORTED TO DO IT. Reading `globalThis.Capacitor` defensively
 * costs the web build nothing at all - no dependency, no bundle weight, no
 * code path that could reach a network - which is the same reason
 * playbilling.ts reads its two browser APIs off the global rather than
 * importing a shim. scripts/netprobe.ts stays green and the privacy answer is
 * unchanged.
 *
 * THE CONSUMABLE CONTRACT IS THE WHOLE DESIGN, and StoreKit models it better
 * than anything else in this file:
 *
 *   a consumable is bought, and its transaction is deliberately left
 *   UNFINISHED until the career has kept what it bought. An unfinished
 *   transaction survives a crash, a force-quit and a reinstall, and StoreKit
 *   hands it back on the next launch - which is precisely the recovery path
 *   monetise.ts promises when it says a customer can lose a moment but never
 *   money. consume(sku) is what finally finishes it.
 *
 * So owned() answers with the permanent entitlements PLUS any consumable that
 * is paid for and not yet spent, and the game's existing pendingConsumables
 * recovery rows work on iOS without knowing iOS exists.
 */
import type { BillingBridge, Product, PurchaseOutcome } from './monetise'

/** What the Swift plugin promises. Capacitor hands every method an object and
 *  gets one back, so each of these is that shape and nothing cleverer. */
interface PhaseBillingPlugin {
  details(o: { skus: string[] }): Promise<{ products: { sku: string; price: string; title?: string }[] }>
  buy(o: { sku: string }): Promise<{ outcome: string }>
  owned(): Promise<{ skus: string[] }>
  consume(o: { sku: string }): Promise<Record<string, never>>
}

type WithCapacitor = {
  Capacitor?: {
    isNativePlatform?: () => boolean
    getPlatform?: () => string
    Plugins?: { PhaseBilling?: PhaseBillingPlugin }
  }
}

/** The five endings, as monetise.ts names them. Anything the native side does
 *  not recognise is an error rather than a silent success: a purchase flow
 *  that guesses in the customer's favour is how a game gives things away, and
 *  one that guesses against them is how it takes money for nothing. */
const asOutcome = (s: string): PurchaseOutcome =>
  s === 'owned' || s === 'cancelled' || s === 'pending' || s === 'unavailable' ? s : 'error'

/**
 * Build a bridge if - and only if - this is the iOS shell with the plugin in
 * it. Returns null in every browser, which is everywhere else.
 */
export function storeKitBridge(): BillingBridge | null {
  const cap = (globalThis as unknown as WithCapacitor).Capacitor
  const p = cap?.Plugins?.PhaseBilling
  if (!p || typeof p.buy !== 'function' || typeof p.owned !== 'function') return null

  const details = async (sku: string): Promise<Product | null> => {
    try {
      const { products } = await p.details({ skus: [sku] })
      const d = products?.[0]
      // displayPrice on the Swift side: StoreKit has already formatted it in
      // the customer's own storefront and currency, so it is passed through
      // untouched. A price this code assembled would be wrong in most of the
      // world - the same rule the Android side learned the hard way.
      return d ? { sku: d.sku, price: d.price, title: d.title } : null
    } catch { return null }
  }

  const buy = async (sku: string): Promise<PurchaseOutcome> => {
    try {
      const { outcome } = await p.buy({ sku })
      return asOutcome(outcome)
    } catch { return 'error' }
  }

  const owned = async (): Promise<string[]> => {
    try {
      const { skus } = await p.owned()
      return Array.isArray(skus) ? skus : []
    } catch { return [] }
  }

  /** Finish the held transaction, so StoreKit will sell it again. Without
   *  this method monetise.ts refuses to sell a consumable at all - which is
   *  exactly what shipped on Android in v1.1.6 and cost five products. */
  const consume = async (sku: string): Promise<void> => {
    if (typeof p.consume !== 'function') return
    try { await p.consume({ sku }) } catch { /* the receipt outlives the hiccup */ }
  }

  return { details, buy, owned, consume }
}

/**
 * Attach at boot, if there is anything to attach.
 *
 * Never overwrites a bridge that is already there: on a device only one of
 * the two can exist, but the rule costs nothing and means the order of the
 * calls in main.tsx is not load-bearing.
 */
export function attachStoreKit(): boolean {
  const g = globalThis as unknown as { rmBilling?: BillingBridge }
  if (g.rmBilling) return false
  const b = storeKitBridge()
  if (!b) return false
  g.rmBilling = b
  return true
}
