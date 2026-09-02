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
import { setBillingReason } from './monetise'
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
    /** What the NATIVE side says it has registered. Injected by Capacitor's
     *  own bridge before any page script runs, and the only honest answer to
     *  "is the Swift plugin really in this build". */
    PluginHeaders?: { name?: string }[]
    isPluginAvailable?: (name: string) => boolean
    registerPlugin?: <T>(name: string) => T
    Plugins?: Record<string, PhaseBillingPlugin | undefined>
  }
}

const PLUGIN = 'PhaseBilling'

/**
 * ---- HOW YOU ACTUALLY GET HOLD OF A CAPACITOR PLUGIN ----
 *
 * This used to read `Capacitor.Plugins.PhaseBilling` and stop there, and it
 * could never have worked on a real device. Reading @capacitor/core's own
 * source settles it: `Plugins[name]` is assigned in exactly one place, INSIDE
 * `registerPlugin`, and nothing else ever writes to that object. A native
 * plugin that no page script has registered is simply not in there.
 *
 * So the shipped iOS shell had a correctly compiled Swift plugin, a correctly
 * registered CAP_PLUGIN macro, and a page that looked for it in the one place
 * it was guaranteed not to be. The Store row is gated on a live bridge, so the
 * symptom was the shop silently not existing - no error, nothing in the log.
 *
 * The order below is the honest one:
 *
 *   1. If something already registered it, use that.
 *   2. Ask the NATIVE side whether the plugin exists, via PluginHeaders. This
 *      matters more than it looks: registerPlugin hands back a Proxy that
 *      answers to every property name, so `typeof p.buy === 'function'` is true
 *      even when there is no native plugin at all. Without this check a
 *      Capacitor web build would attach a bridge that fails every call, and
 *      the game would show a shop it cannot sell from.
 *   3. Only then register, which also fills Plugins for anybody after us.
 *
 * Still no import. registerPlugin and PluginHeaders are both on the global that
 * Capacitor injects, so the web build gains no dependency and netprobe stays
 * green - the same reason playbilling.ts reads its two browser APIs off the
 * global.
 */
function phaseBilling(cap: NonNullable<WithCapacitor['Capacitor']>): PhaseBillingPlugin | null {
  const already = cap.Plugins?.[PLUGIN]
  if (already) return already
  const native = cap.PluginHeaders
    ? cap.PluginHeaders.some(h => h?.name === PLUGIN)
    : cap.isPluginAvailable?.(PLUGIN) ?? false
  if (!native) return null
  try {
    return cap.registerPlugin?.<PhaseBillingPlugin>(PLUGIN) ?? null
  } catch {
    return null
  }
}

/** The five endings, as monetise.ts names them. Anything the native side does
 *  not recognise is an error rather than a silent success: a purchase flow
 *  that guesses in the customer's favour is how a game gives things away, and
 *  one that guesses against them is how it takes money for nothing. */
const asOutcome = (s: string): PurchaseOutcome =>
  s === 'owned' || s === 'cancelled' || s === 'pending' || s === 'unavailable' || s === 'refused'
    ? s : 'error'

/**
 * Build a bridge if - and only if - this is the iOS shell with the plugin in
 * it. Returns null in every browser, which is everywhere else.
 */
export function storeKitBridge(): BillingBridge | null {
  const cap = (globalThis as unknown as WithCapacitor).Capacitor
  if (!cap) return null
  const p = phaseBilling(cap)
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

  /** The Swift side already takes a list - the single-sku path above was
   *  always wrapping one sku in an array. This passes the shelf through. */
  const detailsMany = async (skus: string[]): Promise<Product[]> => {
    const { products } = await p.details({ skus })
    return (products ?? []).map(d => ({ sku: d.sku, price: d.price, title: d.title }))
  }

  const buy = async (sku: string): Promise<PurchaseOutcome> => {
    setBillingReason(null)
    try {
      const { outcome } = await p.buy({ sku })
      return asOutcome(outcome)
    } catch (e) {
      // the same rule the Android side learned: a store that would not sell
      // must say so in its own words, or the fault is invisible from inside
      // the game
      setBillingReason((e as Error)?.message ?? 'no detail')
      return 'refused'
    }
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

  return { details, detailsMany, buy, owned, consume }
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
