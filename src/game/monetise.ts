/**
 * ---- WHAT THE GAME SELLS, AND WHAT IT PROMISES WHILE SELLING IT ----
 *
 * The game has never made a network call. Not one: no analytics, no SDK, no
 * beacon, no font fetch - `scripts/netprobe.ts` fails the build if one appears,
 * and the release audit's "no data collected" answer to both stores rests on it.
 * Selling something is the obvious way to lose that, because the usual way to
 * take money on the web is to load somebody else's script into the page.
 *
 * So the rule this file exists to keep:
 *
 *   THE GAME NEVER TALKS TO A STORE. THE SHELL AROUND IT DOES.
 *
 * A packaged build - a Play TWA, an iOS wrapper - injects a bridge on
 * `globalThis.rmBilling`, and everything here goes through it. The web build has
 * no bridge, so it has no purchase door, no ad slot and no code path that could
 * reach the network. Same source, same bundle, and the difference is entirely
 * what the container puts in front of it.
 *
 * Three more rules, each of which is somebody's bad day if it goes:
 *
 *   IT FAILS OPEN, ALWAYS. A bridge that is missing, broken, offline or slow
 *     must never take something away. The cached entitlement stands on its own:
 *     a supporter on a plane is still a supporter. The only thing a failed check
 *     can do is fail to ADD.
 *
 *   NOTHING BEHIND THE TILL CHANGES THE GAME. No result, no rating, no budget,
 *     no fixture. What is bought is the badge and the absence of advertising,
 *     which means a purchase can never be an advantage and the balance harness
 *     never has to know this file exists.
 *
 *   THE SAVE IS NOT A HOSTAGE. Entitlement lives in localStorage beside the
 *     night-mode flag, never in the career. Losing a receipt must not cost
 *     anybody a season, and a save must stay portable between a free phone and
 *     a paid one.
 */

/** Which build this is.
 *
 *  'free' - the web build and a free store listing: the Supporter door exists
 *    only when a store bridge is there to open it.
 *  'paid' - a premium listing where the customer paid before the download, so
 *    everybody who can run it is already a supporter and no purchase UI is
 *    shown at all.
 *
 *  Set at build time with VITE_EDITION; the default is the one this repository
 *  deploys, which is the free web build. */
export type Edition = 'free' | 'paid'

export function edition(): Edition {
  // import.meta.env exists under Vite and not under the probes' plain node, so
  // this is read defensively rather than destructured
  const env = (import.meta as unknown as { env?: Record<string, string> }).env
  return env?.VITE_EDITION === 'paid' ? 'paid' : 'free'
}

/** The one thing for sale. A single non-consumable: no tiers, no currency, no
 *  consumables, nothing that can be bought twice by accident. */
export const SUPPORTER_SKU = 'phase.supporter'

export type Entitlement = 'free' | 'supporter'

/** How a purchase attempt ended, in the store's words rather than ours.
 *
 *  'pending' is the one people forget: on Play a purchase can sit unconfirmed
 *  for days (a parent's approval, a slow card), and treating that as a failure
 *  tells somebody who has paid that they have not. */
export type PurchaseOutcome = 'owned' | 'cancelled' | 'pending' | 'unavailable' | 'error'

export interface Product {
  sku: string
  /** Formatted by the store, in the customer's own currency. Never computed
   *  here: a price this file made up would be wrong in most of the world. */
  price: string
  title?: string
}

/**
 * What a packaged shell has to provide. Deliberately three methods: anything
 * bigger is a surface for a wrapper to get wrong.
 *
 * The natural Android implementation is the Digital Goods API inside a TWA
 * (`getDigitalGoodsService`), and the natural iOS one is a StoreKit bridge over
 * the WKWebView message handler. docs/monetisation.md has both, written out.
 */
export interface BillingBridge {
  /** For display. Null when the store has no such product, which is a
   *  configuration mistake rather than a customer's problem. */
  details?(sku: string): Promise<Product | null>
  /** Open the store's own purchase sheet. Never our own UI: a payment form
   *  drawn by the game is the fastest rejection on either store. */
  buy(sku: string): Promise<PurchaseOutcome>
  /** What this account already owns. Restores a reinstall or a second device. */
  owned(): Promise<string[]>
}

const KEY = 'rm-ent'

/** The bridge, if a shell put one there. Read on every call rather than cached,
 *  because a wrapper may inject it after the first paint. */
export function bridge(): BillingBridge | null {
  const b = (globalThis as unknown as { rmBilling?: BillingBridge }).rmBilling
  return b && typeof b.buy === 'function' && typeof b.owned === 'function' ? b : null
}

function cached(): Entitlement {
  try {
    return localStorage.getItem(KEY) === 'supporter' ? 'supporter' : 'free'
  } catch {
    // private mode, or storage disabled: not a reason to nag anybody
    return 'free'
  }
}

/** Write the receipt down. Only ever called with a real 'owned' from a store,
 *  or by the paid edition, which is its own receipt. */
export function grantSupporter() {
  try { localStorage.setItem(KEY, 'supporter') } catch { /* private mode */ }
}

/** THE ONLY QUESTION THE REST OF THE GAME ASKS. */
export function hasSupporter(): boolean {
  return edition() === 'paid' || cached() === 'supporter'
}

/** Is there anywhere to buy this? False in the web build, which is why the web
 *  build shows no purchase door at all rather than a door that opens onto an
 *  apology. */
export function canBuy(): boolean {
  return edition() === 'free' && !!bridge() && !hasSupporter()
}

/** Should the Supporter page be reachable?
 *
 *  Either because something can be bought, or because something already has
 *  been: a receipt somebody paid for is a thing they are entitled to look at. */
export function supporterDoor(): boolean {
  return canBuy() || (edition() === 'free' && cached() === 'supporter')
}

/**
 * Ask the store what this account owns, and grant on the strength of it.
 *
 * Returns whether anything changed, so a caller can repaint without repainting
 * on every boot. Swallows every failure by design: see the fail-open rule.
 */
export async function restore(): Promise<boolean> {
  const b = bridge()
  if (!b) return false
  try {
    const skus = await b.owned()
    if (Array.isArray(skus) && skus.includes(SUPPORTER_SKU) && !hasSupporter()) {
      grantSupporter()
      return true
    }
  } catch { /* offline, or a wrapper mid-update: the cache stands */ }
  return false
}

/** Open the store's sheet, and write the receipt if it closes with a sale. */
export async function buySupporter(): Promise<PurchaseOutcome> {
  const b = bridge()
  if (!b) return 'unavailable'
  try {
    const out = await b.buy(SUPPORTER_SKU)
    if (out === 'owned') grantSupporter()
    return out
  } catch {
    return 'error'
  }
}

/** The price to put on the button, or null when we cannot honestly name one. */
export async function supporterPrice(): Promise<string | null> {
  const b = bridge()
  if (!b?.details) return null
  try {
    const p = await b.details(SUPPORTER_SKU)
    return p?.price ?? null
  } catch {
    return null
  }
}

/**
 * ---- ADVERTISING ----
 *
 * Same shape, same promise: an ad exists only where a shell has put a provider,
 * and the web build has none, so `AdSlot` renders nothing at all and no request
 * leaves the device. There is no house-ad fallback and no placeholder box - an
 * empty frame that says "ad" is worse than no frame.
 *
 * A supporter never sees one, which is the whole of what the purchase buys
 * besides the badge.
 */
export interface AdBridge {
  /** Draw an ad into this element. The provider owns everything inside it. */
  mount(el: HTMLElement, place: string): void
  /** Take it down again on unmount, so a screen change cannot leak a frame. */
  unmount?(el: HTMLElement): void
}

export function adBridge(): AdBridge | null {
  const a = (globalThis as unknown as { rmAds?: AdBridge }).rmAds
  return a && typeof a.mount === 'function' ? a : null
}

/** Where an ad may appear at all. Deliberately short, and deliberately nowhere
 *  near a decision: never during a match, never on a modal, never on the title
 *  screen, never between a tap and the thing the tap was for. */
export const AD_PLACES = ['home-foot', 'results-foot'] as const
export type AdPlace = typeof AD_PLACES[number]

export function adsAllowed(place: string): boolean {
  return !hasSupporter() && !!adBridge() && (AD_PLACES as readonly string[]).includes(place)
}
