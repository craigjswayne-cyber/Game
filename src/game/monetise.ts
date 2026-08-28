/**
 * ---- WHAT THE GAME SELLS, AND WHAT IT PROMISES WHILE SELLING IT ----
 *
 * The game has never made a network call. Not one: no analytics, no SDK, no
 * beacon, no font fetch - `scripts/netprobe.ts` fails the build if one appears,
 * and the release audit's answers to both stores rest on it. Selling something
 * is the obvious way to lose that, because the usual way to take money on the
 * web is to load somebody else's script into the page.
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
 *   WHAT THE TILL CHANGES, IT CHANGES THROUGH ONE DOOR. Until v1.1.0 nothing
 *     behind the till touched the game at all. Now some of it does - board
 *     injections, the Owner's Charter, the License - and every one
 *     of those effects lives in `grants.ts`: deterministic, additive, outside
 *     the rng stream, bounded or stamped, and probed (`grantprobe`). This file
 *     still changes nothing itself; it rings the till and reports the sale.
 *     No result, no rating, no fixture, and never anything for the AI.
 *
 *   THE SAVE IS NOT A HOSTAGE. Entitlement lives in localStorage beside the
 *     night-mode flag, never in the career. Losing a receipt must not cost
 *     anybody a season, and a save must stay portable between a free phone and
 *     a paid one. (What a grant wrote INTO a career - cash landed, a Charter
 *     stamp - is part of that career's story and travels with it, exactly like
 *     a signing it paid for.)
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

/**
 * ---- THE CATALOGUE ----
 *
 * Ten products (docs/monetisation-spec.md §1). Five are owned once and for
 * ever; five are consumable resolutions whose effects grants.ts applies to
 * the one career that bought them. History: the In-Game Editor (phase.editor)
 * was removed on the owner's call (27 Aug, v1.1.3) before any store sold one;
 * the heal, the estate and the international stage joined in v1.1.4 on the
 * owner's overnight brief.
 */
export const SUPPORTER_SKU = 'phase.supporter'
export const LICENSE_SKU = 'phase.license'
export const CHARTER_SKU = 'phase.uncapped'
/** v1.1.4 (owner's overnight brief): every facility to its maximum, for a
 *  save that applies it. Charter-shaped: bought once, applied per save,
 *  stamped for good. */
export const ESTATE_SKU = 'phase.estate'
/** v1.1.4: the manager's name goes to the federations - an international
 *  job offer follows within weeks, in the career that makes the call. */
export const PINNACLE_SKU = 'phase.pinnacle'
export const INJECT_SKUS = {
  s: 'phase.inject.s',
  m: 'phase.inject.m',
  l: 'phase.inject.l',
  xl: 'phase.inject.xl',
} as const
/** v1.1.4: every injury healed and the whole squad fresh, once per purchase.
 *  Consumable like the injections: the store forgets it, the career keeps
 *  what it did. */
export const HEAL_SKU = 'phase.heal'

/** Owned once, restorable from the store for ever. */
export const NC_SKUS = [SUPPORTER_SKU, LICENSE_SKU, CHARTER_SKU, ESTATE_SKU, PINNACLE_SKU] as const
/** Bought, consumed, buyable again - the store forgets them, the career keeps
 *  what they did. */
export const CONSUMABLE_SKUS = [...Object.values(INJECT_SKUS), HEAL_SKU] as string[]

export type Entitlement = 'free' | 'supporter'

/** How a purchase attempt ended, in the store's words rather than ours.
 *
 *  'pending' is the one people forget: on Play a purchase can sit unconfirmed
 *  for days (a parent's approval, a slow card), and treating that as a failure
 *  tells somebody who has paid that they have not. A pending consumable grants
 *  nothing until the bridge reports it owned. */
export type PurchaseOutcome = 'owned' | 'cancelled' | 'pending' | 'unavailable' | 'error'

export interface Product {
  sku: string
  /** Formatted by the store, in the customer's own currency. Never computed
   *  here: a price this file made up would be wrong in most of the world. */
  price: string
  title?: string
}

/**
 * What a packaged shell has to provide. Deliberately small: anything bigger is
 * a surface for a wrapper to get wrong.
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
  /** What this account already owns. Restores a reinstall or a second device.
   *  For consumables, "owned" means bought-and-not-yet-consumed: a purchase
   *  the game crashed before consuming shows up here, which is the recovery
   *  path for a paid-but-not-granted injection. */
  owned(): Promise<string[]>
  /** Mark a consumable spent so the store will sell it again. A shell without
   *  this cannot honestly offer the consumable SKUs, and buyConsumable treats
   *  its absence as 'unavailable'. */
  consume?(sku: string): Promise<void>
}

const KEY = 'rm-ent'

/** The bridge, if a shell put one there. Read on every call rather than cached,
 *  because a wrapper may inject it after the first paint. */
export function bridge(): BillingBridge | null {
  const b = (globalThis as unknown as { rmBilling?: BillingBridge }).rmBilling
  return b && typeof b.buy === 'function' && typeof b.owned === 'function' ? b : null
}

/** Everything owned, from the cache. The original format was the bare string
 *  'supporter'; the v1.1.0 format is a comma-joined list of SKU ids with that
 *  same legacy token grandfathered in, so nobody's receipt is re-litigated by
 *  an update. */
function ownedCache(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return new Set()
    const set = new Set(raw.split(','))
    if (set.delete('supporter')) set.add(SUPPORTER_SKU)
    return set
  } catch {
    // private mode, or storage disabled: not a reason to nag anybody
    return new Set()
  }
}

/** Write a receipt down. Only ever called with a real 'owned' from a store,
 *  or by the paid edition, which is its own receipt. Consumables are never
 *  cached - their receipt is what they did to the career. */
export function grant(sku: string) {
  if (!(NC_SKUS as readonly string[]).includes(sku)) return
  const set = ownedCache()
  set.add(sku)
  try { localStorage.setItem(KEY, [...set].join(',')) } catch { /* private mode */ }
}

/** Kept for the existing callers and probes; the till grew, the door for the
 *  original product did not move. */
export function grantSupporter() { grant(SUPPORTER_SKU) }

export function hasEntitlement(sku: string): boolean {
  return ownedCache().has(sku)
}

/** THE QUESTION THE REST OF THE GAME ASKS about advertising. */
export function hasSupporter(): boolean {
  return edition() === 'paid' || hasEntitlement(SUPPORTER_SKU)
}

/** Is there anywhere to buy this? False in the web build, which is why the web
 *  build shows no purchase door at all rather than a door that opens onto an
 *  apology. */
export function canBuy(): boolean {
  return edition() === 'free' && !!bridge() && !hasSupporter()
}

/** Is the shop open at all - for anything? The Boardroom and Game Status
 *  shelves render only behind this, so the web build reads as complete. */
export function tillOpen(): boolean {
  return edition() === 'free' && !!bridge()
}

/** Should the Supporter page be reachable?
 *
 *  Either because something can be bought, or because something already has
 *  been: a receipt somebody paid for is a thing they are entitled to look at. */
export function supporterDoor(): boolean {
  return canBuy() || (edition() === 'free' && hasEntitlement(SUPPORTER_SKU))
}

/**
 * Ask the store what this account owns, and grant on the strength of it.
 *
 * Returns whether anything changed, so a caller can repaint without repainting
 * on every boot. Swallows every failure by design: see the fail-open rule.
 * Consumables deliberately do not restore here - an unconsumed injection is
 * surfaced by the Boardroom's own recovery pass, which applies it to the
 * career in front of the customer rather than to whichever save happens to be
 * loaded at boot.
 */
export async function restore(): Promise<boolean> {
  const b = bridge()
  if (!b) return false
  try {
    const skus = await b.owned()
    if (!Array.isArray(skus)) return false
    let changed = false
    for (const sku of skus) {
      if ((NC_SKUS as readonly string[]).includes(sku) && !hasEntitlement(sku)) {
        grant(sku)
        changed = true
      }
    }
    return changed
  } catch { /* offline, or a wrapper mid-update: the cache stands */ }
  return false
}

/** Open the store's sheet for a non-consumable, and write the receipt if it
 *  closes with a sale. */
export async function buyOwnable(sku: string): Promise<PurchaseOutcome> {
  const b = bridge()
  if (!b || !(NC_SKUS as readonly string[]).includes(sku)) return 'unavailable'
  try {
    const out = await b.buy(sku)
    if (out === 'owned') grant(sku)
    return out
  } catch {
    return 'error'
  }
}

/** The original single-product door, kept so nothing that learned it moves. */
export async function buySupporter(): Promise<PurchaseOutcome> {
  return buyOwnable(SUPPORTER_SKU)
}

/**
 * Buy a consumable. Returns 'owned' ONLY once the store has confirmed the
 * sale; the caller then applies the effect through grants.ts and the consume
 * is sent so the store will sell it again. If the consume call fails (a crash,
 * a dropped process), the purchase stays "owned" at the store and the
 * recovery pass finds it - the customer can lose a moment, never money.
 */
export async function buyConsumable(sku: string): Promise<PurchaseOutcome> {
  const b = bridge()
  if (!b || typeof b.consume !== 'function' || !CONSUMABLE_SKUS.includes(sku)) return 'unavailable'
  try {
    const out = await b.buy(sku)
    return out
  } catch {
    return 'error'
  }
}

/** Mark a consumable spent, after its grant has been written into the career.
 *  Failure is swallowed: the store still thinks it is owned, and the recovery
 *  pass must therefore be idempotent about it (grants.ts seasonal limits make
 *  a double-apply visible, and the Boardroom asks before re-applying). */
export async function consume(sku: string): Promise<void> {
  const b = bridge()
  if (!b || typeof b.consume !== 'function') return
  try { await b.consume(sku) } catch { /* the receipt outlives the hiccup */ }
}

/** An unconsumed consumable purchase - paid for, not yet landed in a career. */
export async function pendingConsumables(): Promise<string[]> {
  const b = bridge()
  if (!b) return []
  try {
    const skus = await b.owned()
    return Array.isArray(skus) ? skus.filter(s => CONSUMABLE_SKUS.includes(s)) : []
  } catch {
    return []
  }
}

/** The catalogue's reference prices, in the launch currency. The STORE'S
 *  answer always wins - regional pricing, sales, the owner repricing in
 *  Play Console all live there - but a row must never stand priceless
 *  (owner, v1.1.5: "prices should be displayed"), and until a product is
 *  created and activated in Play, details() has nothing to say. These are the
 *  prices of packaging/twa/README.md §4, and changing one there means
 *  changing it here. */
export const REFERENCE_PRICES: Record<string, string> = {
  [SUPPORTER_SKU]: '£1.99',
  [LICENSE_SKU]: '£2.99',
  [CHARTER_SKU]: '£9.99',
  [ESTATE_SKU]: '£9.99',
  [PINNACLE_SKU]: '£4.99',
  'phase.inject.s': '£0.99',
  'phase.inject.m': '£1.99',
  'phase.inject.l': '£3.99',
  'phase.inject.xl': '£7.99',
  [HEAL_SKU]: '£0.99',
}

/** The price to put on a button: the store's own figure when it will name
 *  one, the catalogue's reference price when it will not. */
export async function skuPrice(sku: string): Promise<string | null> {
  const b = bridge()
  if (b?.details) {
    try {
      const p = await b.details(sku)
      if (p?.price) return p.price
    } catch { /* fall through to the reference */ }
  }
  return REFERENCE_PRICES[sku] ?? null
}

export async function supporterPrice(): Promise<string | null> {
  return skuPrice(SUPPORTER_SKU)
}

/**
 * ---- ADVERTISING ----
 *
 * Same shape, same promise: an ad exists only where a shell has put a provider,
 * and the web build has none, so `AdSlot` renders nothing at all and no request
 * leaves the device. There is no house-ad fallback and no placeholder box - an
 * empty frame that says "ad" is worse than no frame.
 *
 * A supporter never sees a BANNER, which is the whole of what the purchase buys
 * besides the badge. Rewarded spots (below) are different in kind: the player
 * asks for one, by name, in exchange for a favour the fiction prices - so they
 * survive the Remove Ads purchase rather than punishing the buyer with their
 * absence.
 */
export interface AdBridge {
  /** Draw an ad into this element. The provider owns everything inside it. */
  mount(el: HTMLElement, place: string): void
  /** Take it down again on unmount, so a screen change cannot leak a frame. */
  unmount?(el: HTMLElement): void
  /** Play a rewarded spot the player explicitly asked for. Resolves
   *  'completed' only when the provider says the whole spot ran - that is the
   *  only outcome that earns the favour. A shell without this simply has no
   *  rewarded buttons anywhere in the game. */
  showRewarded?(place: string): Promise<'completed' | 'skipped' | 'unavailable'>
}

export function adBridge(): AdBridge | null {
  const a = (globalThis as unknown as { rmAds?: AdBridge }).rmAds
  return a && typeof a.mount === 'function' ? a : null
}

/** Where a banner may appear at all. Deliberately short, and deliberately
 *  nowhere near a decision: never during a match, never on a modal, never on
 *  the title screen, never between a tap and the thing the tap was for. */
export const AD_PLACES = ['home-foot', 'results-foot'] as const
export type AdPlace = typeof AD_PLACES[number]

export function adsAllowed(place: string): boolean {
  return !hasSupporter() && !!adBridge() && (AD_PLACES as readonly string[]).includes(place)
}

/** The four rewarded placements (docs/monetisation-spec.md §2), each mapping
 *  onto a mechanic the game already has - the spot replaces the FEE, never
 *  invents a power. Their per-day cap lives in the bridge; their per-save
 *  ledgers live beside the mechanics they touch. */
export const REWARDED_PLACES = ['medical', 'scouting', 'matchday', 'collection'] as const
export type RewardedPlace = typeof REWARDED_PLACES[number]

/** May this rewarded button render at all? Purely "is there a provider":
 *  eligibility (the right screen, the right club, the ledgers) belongs to the
 *  surface that draws the button. Note hasSupporter() is absent on purpose. */
export function rewardedAvailable(place: RewardedPlace): boolean {
  const a = adBridge()
  return !!a && typeof a.showRewarded === 'function' && (REWARDED_PLACES as readonly string[]).includes(place)
}

/** Run the spot. Everything except a confirmed completion is a polite no. */
export async function showRewarded(place: RewardedPlace): Promise<'completed' | 'skipped' | 'unavailable'> {
  const a = adBridge()
  if (!a || typeof a.showRewarded !== 'function') return 'unavailable'
  try {
    const out = await a.showRewarded(place)
    return out === 'completed' ? 'completed' : out === 'skipped' ? 'skipped' : 'unavailable'
  } catch {
    return 'unavailable'
  }
}
