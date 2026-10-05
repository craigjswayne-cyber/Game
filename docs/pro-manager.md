# PRO MANAGER MONETISATION

PHASE: Rugby Manager is free to play, all of it. Pro Manager is one optional
purchase, and this file is everything the game does to sell it: what it is,
when the game mentions it, what it costs, and what happens to the money. The
rule over all of it is **premium, not pushy**: no energy, no timers, no
currency, no forced adverts, no fake scarcity, no countdowns, no guilt copy
and no modal spam.

Code: `src/game/profunnel.ts` (the cadence), `src/ui/ProPrompt.tsx` (the
card), `src/game/monetise.ts` (products, entitlement, prices),
`src/store.ts` (`countForPro`, the match counter). Probes:
`scripts/profunnelprobe.ts`, `scripts/proprompt.mjs`.

## 1. What Pro Manager is (the honest pitch)

* No adverts.
* Three skins only Pro managers get (Midnight, Heritage, Stealth).
* Backing an independent game.

Nothing else is promised, and nothing about the rugby changes: no match,
rating, fixture, finance or AI effect. Where a build has no advert provider
the copy does not promise ad removal (the Store row follows
`store.removeAdsLineSkins`, the cards follow `pro.reminderLineSkins` and drop
the "No adverts" line).

## 2. Products

| Product id | Type | Price | Where it is sold |
| --- | --- | --- | --- |
| `phase.supporter` | Non-consumable (Play: one-time product) | As configured in the consoles. docs/monetisation-spec.md sets **$1.99**. | The Store's Pro Manager row, the first card, reminders |
| `phase.supporter.intro` | Non-consumable (Play: one-time product) | About **25% below** Pro Manager, set by the owner in the consoles (e.g. $1.49 / £1.49 / €1.49 against 1.99) | Only the one-time offer card |

**The app holds no prices.** Every figure on a card is the store's own
formatted price, read live through the billing bridge (`proPrices()`), in
the customer's currency. If the store will not price Pro Manager, no card
opens (and none is spent).

**Owning either product is owning Pro Manager.** `hasEntitlement('phase.supporter')`
answers true for either receipt, so adverts, skins and the Store's "Yours"
chip all follow. Restore recognises both (`phase.supporter.intro` is in
`NC_SKUS`). The intro product is deliberately not in `SELLABLE_SKUS`, so the
Store shelf never lists it and the shelf's health line never complains that
it is missing.

**"25% OFF" is printed only when it is true.** `proDiscount()` compares the
two live prices (the stores' micro prices where the shell sends them, which
1.8.6 shells do: Play `priceAmountMicros`, StoreKit `Product.price`; otherwise
the two formatted strings, which come from one store in one currency). Only
when intro / normal is between 0.70 and 0.80 is a percentage printed, and it
is the real saving **rounded down**, so it can understate and never
overstate: 1.49 on 1.99 prints "25% OFF"; 1.55 would print "22% OFF"; 0.99
or 1.79 print no percentage at all, only the real intro price. "Usually
{price}" beside it is the live normal price.

**If the store does not return the intro product** (not created yet, not
approved, not in this storefront), the offer slot shows the normal product
at the normal price with no one-time or discount wording, and the one-time
offer is **not** spent: it is tried again ten competitive matches later.

## 3. When the game mentions it

All three cards appear only when:

* a real store bridge exists and Pro is not owned (`canBuy()`), **and** the
  Pro perks are actually locked on this build (`proLocked()`: a till, an
  advert bridge, not Pro). The website has no bridge and never sees a card;
  a shell without adverts has nothing locked behind Pro and sees none either;
* the screen is **Home or the day room**, which is where a manager lands
  after the full-time round-up is dismissed;
* nothing else is happening: no live match or match being resumed, no
  tutorial, celebration, sacking, Annual, opening titles, menu or modal open,
  no purchase in progress and none that ended in the last 30 seconds. A
  blocked card is deferred to the next safe moment, never lost;
* at most **one card per match flow** (`lastShownAt`).

Never during a match, team selection, tactics, the press room, the
boardroom, a crisis decision, a payment sheet, or on top of another modal.

### 3.1 First card (once ever, per device)

In the week of the player's first competitive (non-friendly) match, before
it. Title PRO MANAGER, one line, the benefits, the store's price, **Become
Pro** (opens the native purchase sheet) and **Continue Free** (same size,
same weight, one tap, no confirm). It says plainly that Pro can be bought
later from the Store. If that week passes with no safe moment, the first card
comes at the next one, and the offer waits one more match.

### 3.2 One-time offer (once ever, per device)

After the first completed competitive match, if still free and the first
card was seen. Labelled ONE-TIME OFFER, with the real intro price, "Usually
{normal}", and "25% OFF" only if true (section 2). Become Pro buys
`phase.supporter.intro`. Continue Free declines it for ever. It is marked
shown the moment it opens, so a restart mid-card or mid-purchase cannot show
it twice.

### 3.3 Reminder (every 10 competitive matches while free)

After the offer is resolved, a lighter card (title, one line, price, the two
buttons) after every ten competitive matches the manager plays while free:
11, 21, 31... counting from the first. Friendlies do not count, nor do weeks
without a match, nor anything played while Pro.

### 3.4 What is stored, and where

One localStorage key, `rm-pro`, beside the entitlement ledger `rm-ent`:

```
firstPromptShown, firstOfferShown, firstOfferAccepted, firstOfferDeclined,
played (competitive matches while free), offerDueAt, remindAt, lastShownAt,
seen (the last few match keys, so a match is never counted twice)
```

It is **device state, not career state**: never in a save, so no save format
change, and never reset by a new career, a club change, a language change, a
restart, a save loaded or imported, or a new season. It never leaves the
device: these are on-device counters for the cadence, not analytics (the game
makes no network calls; `scripts/netprobe.ts`). Per-product sales in the two
consoles answer the conversion questions.

If storage cannot be written (private mode, full disk) the card does not open
at all, because a device that cannot remember a card would show it on every
visit.

## 4. Purchase state

| State | What the player sees | What is granted |
| --- | --- | --- |
| FREE | The cards per section 3; the Store row with Buy | Nothing |
| PURCHASE IN PROGRESS | "Asking the store…" on the button; both buttons disabled; the store's own sheet | Nothing until the store says owned |
| PRO | "You are a Pro Manager…" with Continue; skins unlock and adverts go in the same frame (`claimSupporter`); the Store row reads Yours | `rm-ent` gains the product id |
| RESTORE | The Store's Restore button, and a silent restore at every boot | Whatever non-consumables the store account owns, either Pro id included |

The safeguards are the existing ones (`buyOwnable`, `grant`, `restore`):

* **Cancelled**: "Nothing was charged." on the card; nothing granted; the card
  stays so the player can choose again or Continue Free.
* **Failed / refused / unavailable**: the shared ending line (`ui/purchase.ts`);
  nothing granted.
* **Pending** (Ask to Buy, a slow card): the pending line; the player stays
  free until the store confirms. The confirmation lands through the store's
  update listener and the boot restore.
* **Duplicate callback**: the grant is idempotent and the button is disabled
  while a purchase is in flight.
* **Restart mid-purchase**: nothing is granted without an `owned` answer; the
  card was already marked shown; a purchase that completed while the app was
  away comes back through restore.

## 5. Restore, cancellation, reinstall, new careers

* **Restore**: boot and the Store's Restore button grant either Pro product.
* **Cancellation / refund**: the store's own business. A refunded
  non-consumable disappears from the store account; `rm-ent` is a cache that
  fails open (a supporter on a plane is still a supporter), so the device
  keeps the cached receipt until storage is cleared. This is the existing,
  documented behaviour for every non-consumable.
* **Reinstall**: the entitlement comes back from the store at boot. The
  card state is device-local, so **a reinstall clears it**: a free player who
  reinstalls can see the first card and the one-time offer again, unless the
  intro product is already owned (then they are Pro and see nothing). That is
  the honest cost of keeping the funnel off any server.
* **New career**: same device, same ledger. A Pro owner stays Pro; a free
  player does not see the first card or the offer again, and reminders carry
  on counting.

## 6. Localisation and layout

Copy is in `pro.*` in all six locales (en, fr, es, it, af, ja). English is
British, no em dashes, no guilt. French uses non-breaking spaces before
: ; ? ! and %. No manager-gendered wording is needed, so there are no `_f`
variants. English copy:

| Key | English |
| --- | --- |
| title | PRO MANAGER |
| firstLine | The whole game is free, and it stays free. Pro Manager is an optional extra. |
| benefitAds / benefitSkins / benefitBack | No adverts / Three skins only Pro managers get / Backs an independent game |
| buy / free | Become Pro / Continue Free |
| laterFine | Nothing about the rugby changes. You can become Pro later from the Store. |
| offerTag | ONE-TIME OFFER |
| offerLine | Pro Manager at a lower price, offered this once. Bought once, yours for good. |
| offerFine | This price is shown once. Continue Free keeps your game exactly as it is, and Pro stays in the Store at its usual price. |
| off / usually | {n}% OFF / Usually {price} |
| reminderLine | Enjoying the season? Pro Manager takes the adverts away and adds three skins, whenever you want it. |
| done | You are a Pro Manager. Thank you for backing the game. The three skins are waiting in Settings. |

Layout: a centred card, max 380px wide, 16px gutters, scrolls inside itself
on a short screen, clear of the safe areas and the advert inset. Both buttons
are full width and 44px tall. Checked at 320 to 412px (`proprompt.mjs`
screenshots at 360x800 and 412x915 in English and French; no sideways
scroll).

## 7. Store compliance

* **Native in-app purchase only**: Google Play Billing (Capacitor plugin
  `PhaseBilling.java`) and StoreKit 2 (`PhaseBilling.swift`). No external
  payment links, no web checkout, no payment form drawn by the game.
* **Real prices**: every figure is the store's own; the discount percentage
  is computed from the store's own two prices and only printed when true.
* **No dark patterns**: Continue Free is as large and as clear as Become Pro,
  one tap, no confirm, no follow-up; nothing in the free game is taken away
  or slowed down.
* **Restore** is on the Store screen (App Store guideline 3.1.1).

**Reviewer access.** The Store is Hub > Store (bottom bar, first group); the
Pro Manager row is first on the shelf with Restore under the list. The cards
appear on Home: start a career, close How to Play, and in the week of the
first competitive match (Premiership round 1) the first card opens on Home;
play that match (Matchday, then Instant Result or watch it) and
the one-time offer opens on Home after the round-up. A reviewer who has
already seen them can buy from the Store at any time.

**Review notes (paste into App Store Connect / Play Console):**

> PHASE: Rugby Manager is free to play in full. "Pro Manager" is a single
> optional non-consumable that removes adverts and unlocks three cosmetic
> skins; it changes nothing about gameplay. It is sold in two ways: the
> regular product (phase.supporter) on the in-game Store (Hub > Store), and
> a one-time lower-priced product (phase.supporter.intro) offered once, after
> the player's first competitive match. Owning either is the same Pro
> Manager. The game shows at most one short card per match, only on the home
> screen, each with an equal "Continue Free" button. All prices come from
> the store. Restore Purchases is on the Store screen. The game makes no
> network requests of its own.

## 8. Creating `phase.supporter.intro` (owner steps)

Do not change `phase.supporter` or its price.

### Google Play Console

1. Play Console > PHASE: Rugby Manager > Monetize with Play > Products >
   **One-time products** > **Create one-time product**.
2. Product ID: `phase.supporter.intro` (permanent; cannot be changed).
3. Name: `Pro Manager (one-time offer)`.
   Description: `Pro Manager at a one-time lower price: no adverts and three skins only Pro managers get. Nothing about the rugby changes.`
4. Purchase option: one **Buy** option, **not** a rental, and do not mark it
   consumable (the app never consumes it: it is acknowledged on purchase and
   stays owned, exactly like `phase.supporter`).
5. Price: about 25% under Pro Manager in the default currency (for example
   1.49 against 1.99), then **Update exchange rates** and check each country
   lands between 70% and 80% of Pro Manager's local price, or the card will
   honestly show no percentage there.
6. Save and **Activate**. Licence testers can buy it once it is active.

### App Store Connect

1. App Store Connect > Apps > PHASE: Rugby Manager > Monetization > **In-App
   Purchases** > **+**.
2. Type: **Non-Consumable**. Reference name: `Pro Manager (one-time offer)`.
   Product ID: `phase.supporter.intro`.
3. Price schedule: the tier about 25% below Pro Manager (for example
   $1.49 against $1.99); check the per-storefront prices the same way.
4. Localisation (English (U.K.) and others as wished): display name
   `Pro Manager (one-time offer)`, description `No adverts and three skins
   only Pro managers get, at a one-time lower price.`
5. Review information: a screenshot of the offer card
   (`pro-offer-en-412x915.png`) and the review notes from section 7.
6. Add it to the next app version submission (a first IAP must be submitted
   with a build).

`packaging/ios/Products.storekit` already carries it for local StoreKit
testing (2.19 against the fixture's 2.99 for Pro Manager, so the local card
prints "26% OFF", which is the true figure for those two).

## 9. Test coverage

Automated:

* `scripts/profunnelprobe.ts` (engine, no browser): players A to H on the
  pure cadence, plus a missed safe moment, the intro product missing, a match
  reported twice, a corrupt ledger, and the discount rule across currencies.
* `scripts/proprompt.mjs` (browser, in suite.sh): A (first card, offer,
  reminders at exactly +10 and +20, friendlies not counted, 22 competitive
  matches played for real), B, C, E (cancel, then the 30-second deferral,
  then the offer), pending, F (reload), G (reinstall and restore of either
  product), H (second career, free and Pro), the intro product missing, the
  % rule on real cards, and no card on the match preview, during a live
  match, on the full-time round-up, over the tutorial or an open menu, on the
  web build, on a shell without adverts or for a Pro owner. It also takes the
  owner's screenshots when `SHOTS` is set.
* `scripts/moneyprobe.ts`: the catalogue count, restore of the intro
  product, intro = Pro everywhere, the discount maths, Products.storekit.
* `scripts/fingerprint.ts`: the simulation stream is unchanged.

Manual (on device, licence tester / sandbox account):

1. Fresh install, new career: the first card in the first competitive week;
   Continue Free; play it; the offer after the round-up, with the console's
   real prices; Continue Free.
2. Second install: take the offer; adverts gone and skins unlocked at once;
   reinstall; Pro back at boot.
3. Ask to Buy / slow card: pending line, still free; approve; Pro after the
   next launch.
4. Before `phase.supporter.intro` exists: the offer slot shows Pro Manager at
   the normal price with no "one-time" wording.

## 10. Issues

* **P0**: none known.
* **P1**: `phase.supporter.intro` does not exist in either console yet
  (section 8). Until it does, the offer slot falls back to the normal product,
  as designed.
* **P2**: a reinstall forgets the card state (section 5), so a free player
  can see the first card and the offer again. Accepted to keep everything
  on-device.
* **P2**: `proLocked()` only locks the skins where an advert bridge exists,
  so a store build without adverts sells Pro Manager on the Store row with
  "Three skins only Pro managers get" while those skins are free on that
  build. The cards do not appear there (nothing is locked), but the Store
  row's line is then not quite true. Pre-existing; worth a one-line fix.
* **P3**: the cards quote the store's price where the Store shelf
  deliberately does not (owner, v1.2.3: "just a buy button"). The brief for
  this work asks for the real price on the card; the shelf is unchanged.
* **P3**: `Products.storekit` describes Pro Manager with "six saved game
  plans instead of three", which stopped being true in 1.8.3. It is a local
  test fixture, never shipped; not changed here because the brief forbids
  touching the existing product.
* **P3**: a refund of either Pro product is not withdrawn from a device that
  has it cached (fail-open, by design for every non-consumable).
