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
/** "Support the game", 99p (v1.1.6). The Play id is permanent, so the SKU
 *  keeps the name it was born with - it sold as the Manager's License
 *  (proven-name start, £2.99) until the owner swapped it: same product id,
 *  renamed and repriced in Play Console, now a plain thank-you that changes
 *  nothing in the game. Anyone who bought the License owns this instead;
 *  their licensed SAVES keep the 🎓 stamp and the pinned reputation for
 *  good, but no new save can start licensed. */
export const SUPPORT_SKU = 'phase.license'
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
/**
 * v1.1.14: THE ESTATE, AT THE NEXT GROUND.
 *
 * ESTATE_SKU is a non-consumable and Play will only ever sell it once, which
 * was fine while the estate was one save-wide flag and fatal the moment it
 * became one build per club (grants.applyEstate). The owner's rule is "when
 * you move you have to purchase it again", and a product Play refuses to sell
 * twice cannot honour that, so the repeat is its own consumable.
 *
 * The first ground is covered by ESTATE_SKU - that is the purchase already
 * made. Every ground after it is one of these.
 *
 * PLAY CONSOLE: this must exist as a CONSUMABLE product at £9.99. A product
 * type cannot be changed after it is created, which is exactly why the repeat
 * could not simply reuse phase.estate.
 */
export const GROUND_SKU = 'phase.ground'

/** Owned once, restorable from the store for ever. */
export const NC_SKUS = [SUPPORTER_SKU, CHARTER_SKU, ESTATE_SKU, PINNACLE_SKU] as const
/** Bought, consumed, buyable again - the store forgets them, the career keeps
 *  what they did.
 *
 *  SUPPORT_SKU joined them in v1.1.12 (owner: "Support the game should be
 *  available more than once - it should be repeatable at any point"). It is
 *  the one product that grants NOTHING, so there is nothing to lose by
 *  spending the receipt, and everything to lose by not: a tip jar that
 *  accepts one coin and then greys out is not a tip jar. On Play a managed
 *  product is repeatable precisely because the app consumes it, so this is
 *  the whole change - no new product id, no Console edit.
 *
 *  Anyone who bought it as the Manager's License, or as the one-shot thank
 *  you, keeps that receipt in rm-ent; nothing reads it, and nothing ever
 *  did. */
export const CONSUMABLE_SKUS = [...Object.values(INJECT_SKUS), HEAL_SKU, SUPPORT_SKU, GROUND_SKU] as string[]

/**
 * CONSUMABLES THE BOOT SWEEP MAY SPEND WITHOUT ASKING ANYBODY.
 *
 * Spending a consumable is the only way Digital Goods 2.0 can acknowledge one,
 * and an unacknowledged purchase is refunded by Play after three days. So the
 * sweep has to spend - but spending a receipt whose grant has not yet landed in
 * a career would destroy the thing that was paid for, which is worse than the
 * refund.
 *
 * The split is simply whether there is anything left to collect:
 *
 *   the heal, the four injections   land IN a career, at a moment the manager
 *                                   picks. The Store surfaces them as pending
 *                                   until they do. The sweep acknowledges them
 *                                   where it can and never spends them.
 *   the tip jar                     lands nowhere. It buys a thank-you and a
 *                                   counter, both written the instant the sheet
 *                                   closes. There is nothing to lose by
 *                                   spending it, and - this is the one that
 *                                   cost real money - nothing else can save it.
 */
export const SPENDABLE_UNASKED: string[] = [SUPPORT_SKU]

export type Entitlement = 'free' | 'supporter'

/** How a purchase attempt ended, in the store's words rather than ours.
 *
 *  'pending' is the one people forget: on Play a purchase can sit unconfirmed
 *  for days (a parent's approval, a slow card), and treating that as a failure
 *  tells somebody who has paid that they have not. A pending consumable grants
 *  nothing until the bridge reports it owned. */
export type PurchaseOutcome = 'owned' | 'cancelled' | 'pending' | 'unavailable' | 'refused' | 'error'

/**
 * WHY THE LAST PURCHASE ENDED THE WAY IT DID.
 *
 * Play rejects a purchase sheet with an AbortError for a whole family of
 * reasons, and only one of them is "the customer pressed Back": an item that
 * is not active in the console, an account that is not a licensed tester, a
 * build older than the products, billing unavailable on the device. Mapping
 * them all to `cancelled` gave the same blameless "Nothing was charged." line
 * to a man who had changed his mind and to a store that had refused outright
 * - which is what the owner spent two evenings looking at.
 *
 * So the bridge leaves the reason here and the Store shows it. It is a
 * diagnostic, not a headline: one small grey line under the row.
 */
let lastReason: string | null = null
/** The LOOKUP's account of itself, kept apart from the PURCHASE's.
 *
 *  These shared one slot for exactly one afternoon, and it cost a round trip:
 *  the shelf's health check runs on mount and records why the catalogue came
 *  back empty, then the first tap on Buy overwrote it with the purchase
 *  error, so the screen showed the wrong half of the diagnosis to the person
 *  reading it. They answer different questions and they now have different
 *  slots. */
let lastLookup: string | null = null
export const setLookupReason = (why: string | null) => { lastLookup = why }
export const lookupReason = (): string | null => lastLookup
export const setBillingReason = (why: string | null) => { lastReason = why }
/** The bridge's own account of the last refusal wins where it has one: a
 *  native shell knows more about its store than this module does. The
 *  built-in Android and iOS bridges use setBillingReason above; a wrapper
 *  that injects its own rmBilling can implement reason() instead. */
export const billingReason = (): string | null => {
  const own = bridge()?.reason?.()
  return own ?? lastReason
}

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
  /** Optional: why the last buy() ended in 'refused', in the store's own
   *  words. Shown as a small diagnostic line, never as the headline. */
  reason?(): string | null
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

/** HOW MANY TIMES THIS DEVICE HAS PUT SOMETHING IN THE JAR.
 *
 *  Not an entitlement and not save state: the receipt is consumed the moment
 *  it lands, so the only record that a thank-you happened is this one. It
 *  buys nothing - it is there so the store can say thank you properly the
 *  fourth time as well as the first. A cleared browser forgets it, which
 *  costs the player exactly nothing. */
const TIPS_KEY = 'rm-tips'

export function supportCount(): number {
  try {
    const n = Number(globalThis.localStorage?.getItem(TIPS_KEY) ?? '0')
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch { return 0 }
}

export function recordSupport(): number {
  const n = supportCount() + 1
  try { globalThis.localStorage?.setItem(TIPS_KEY, String(n)) } catch { /* private mode: the thank-you is still real */ }
  return n
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

/** EVERYTHING THIS BUILD SELLS - AND NOT WHAT ANY OF IT COSTS.
 *
 *  This list used to be a price table. It carried a figure per product in
 *  pounds, and those figures reached buttons whenever a store would not name
 *  one of its own. Two faults came out of that, and the second is why the
 *  table is gone:
 *
 *   1. it made a DEAD STORE LOOK ALIVE - a build whose products were not yet
 *      activated still drew a full shelf at £0.99 and £9.99, and only on the
 *      tap said nothing had been charged (the v1.1.6 report);
 *   2. IT WAS ONLY EVER TRUE IN ONE COUNTRY. The game is sold everywhere Play
 *      and the App Store sell it, each storefront with its own currency, its
 *      own tax treatment and the owner's own regional pricing on top. A figure
 *      typed into this file is a guess about a shopper it will never meet.
 *      Owner, v1.1.17: "this is going to be sold across different placcs in
 *      the world - so we need to not declare a cost on the game - let google
 *      play do that."
 *
 *  So the game holds no prices at all. The store names the figure or nothing
 *  does, and its own sheet names it before a penny moves. What is still needed
 *  here is the CATALOGUE - which products exist - because the shelf has to
 *  know what to ask about and whether the till answered (tillHealth).
 *
 *  The prices themselves live in Play Console and App Store Connect, and are
 *  written down for whoever sets them in packaging/twa/README.md §4. */
export const SELLABLE_SKUS: readonly string[] = [
  SUPPORTER_SKU, SUPPORT_SKU, CHARTER_SKU, ESTATE_SKU, PINNACLE_SKU,
  'phase.inject.s', 'phase.inject.m', 'phase.inject.l', 'phase.inject.xl',
  HEAL_SKU, GROUND_SKU,
]

/** The price to put on a button, and WHERE IT CAME FROM.
 *
 *  There is only one possible source now: the store. `live` is true when the
 *  store named the figure, and when it is false the price is null - the game
 *  has nothing of its own to fall back on and must not pretend otherwise
 *  (see SELLABLE_SKUS above). Every caller renders the wordless label in that
 *  case, and the Store screen says the till is not answering.
 *
 *  The pair is kept rather than collapsed to `string | null` because the shelf
 *  asks a second question of the same call - how many products a store would
 *  price - and an unpriced row and a store that is not there read the same
 *  from a null alone. */
export async function skuPriceFrom(sku: string): Promise<{ price: string | null; live: boolean }> {
  const b = bridge()
  if (b?.details) {
    try {
      const p = await b.details(sku)
      if (p?.price) return { price: p.price, live: true }
    } catch { /* a store that throws has priced nothing */ }
  }
  return { price: null, live: false }
}

/** Can this build actually take money right now?
 *
 *  Asked of the whole shelf rather than one row, because one product left
 *  inactive in the console is a different fault from a store that is not
 *  answering at all, and the screen phrases them differently. Returns the
 *  count that answered and the count asked. */
export async function tillHealth(): Promise<{ live: number; asked: number }> {
  // ONLY THE PRODUCTS THIS BUILD ACTUALLY SELLS. Remove-all-ads is in the
  // catalogue but deliberately NOT in any store until a build ships ads
  // (packaging/twa/README.md 4; the Store hides its row on the same rule), so
  // asking about it guaranteed a shelf could never report better than 9 of 10
  // and the health line would have nagged forever on a perfectly good till.
  // Found by re-reading this against a real failure rather than a stub.
  const sellable = SELLABLE_SKUS
    .filter(s => s !== SUPPORTER_SKU || !!adBridge())
  const got = await Promise.all(sellable.map(s => skuPriceFrom(s).then(r => r.live).catch(() => false)))
  return { live: got.filter(Boolean).length, asked: sellable.length }
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
