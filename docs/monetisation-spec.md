# Monetisation & Game Economy Specification — v1.1.0

**Status:** implemented through §6 step 5 (25 Aug): bridge v2 with the
SKU catalogue, `grants.ts` and its doors, the Boardroom / shelf / wizard /
rewarded surfaces, and the probes (`grantprobe`, `rewardedprobe`,
extended `moneyprobe`/`storeprobe`). Still open: §6 step 6 - the four-place
privacy flip, which lands in the same commit as the ad SDK in the Play
wrapper, deliberately not before - plus the wrapper work itself (Play
products, Digital Goods bridge, rewarded provider) and the in-game handbook
section on the stamps.
**Owner's brief:** balanced, non-predatory monetisation that maximises revenue
while keeping core simulation fans happy.
**Prime directive:** every purchasable thing is something the *club* does in
fiction — a board decision, a sponsor's favour, a specialist's fee — surfaced
where that club business already lives. Nothing is a pop-up, nothing
interrupts, and the simulation never plays differently for a paying manager's
opponents.

---

## 0. Ground rules the codebase already enforces

These are constraints the spec builds on, not aspirations:

* **The web bundle makes no network calls** (`scripts/netprobe.ts` fails the
  suite on any fetch/XHR/beacon/SDK). All billing and all ads live in the
  **native wrapper** behind `BillingBridge` / `AdBridge`
  (`src/game/monetise.ts`) — the game asks the shell, the shell talks to the
  store. The web build at craigjswayne-cyber.github.io stays free, complete,
  and till-less (`storeprobe` asserts exactly this).
* **Purchases never touch the rng stream.** Every effect below is
  deterministic. `fingerprint` must stay green with the store code in place.
* **The world's economy is probed** (`econprobe`, `capprobe`, `aiecon`):
  a hundred AI clubs with real books. Purchased money enters through defined
  doors (§3.4) so those probes keep meaning something.
* **One SKU already exists:** `phase.supporter` gates the two banner slots
  (`AD_PLACES = ['home-foot', 'results-foot']`). §1.1 absorbs it.

---

## 1. In-App Purchase catalogue

| # | SKU id | Product | Price | Type |
|---|--------|---------|-------|------|
| 1 | `phase.supporter` | Remove all ads | $1.99 | Non-consumable |
| 2 | `phase.inject.s` | Board Injection (Small) | $0.99 | Consumable |
| 3 | `phase.inject.m` | Board Injection (Medium) | $1.99 | Consumable |
| 4 | `phase.inject.l` | Board Injection (Large) | $3.99 | Consumable |
| 5 | `phase.inject.xl` | The Sugar Daddy | $7.99 | Consumable |
| 6 | `phase.license` | Manager's License | $2.99 | Non-consumable |
| 8 | `phase.uncapped` | The Owner's Charter | $9.99 | Non-consumable |
| 9 | `phase.heal` | Full Fitness | $0.99 | Consumable |
| 10 | `phase.estate` | The Estate | $19.99 | Non-consumable |
| 11 | `phase.pinnacle` | The International Stage | $4.99 | Non-consumable |

Ten products live in the catalogue (`NC_SKUS` + `CONSUMABLE_SKUS` in
`src/game/monetise.ts`); #7 (`phase.editor`) was removed in v1.1.3 and its
number is retired. `moneyprobe` asserts the catalogue count and the
consumable/non-consumable split, so this table and the code cannot drift
apart silently.

### 1.1 Remove Ads — $1.99, non-consumable

* Permanently hides the two banner slots. **The game ships zero
  interstitials and keeps it that way** — the premium feel is the product,
  and "Remove Ads" must never become "we added worse ads to sell the cure."
* Rewarded ads (§2) remain available after purchase: they are player-initiated
  favours, not ads in the resented sense, and removing them would punish the
  buyer.
* Reuses the existing `phase.supporter` entitlement so current supporters are
  grandfathered without migration.
* **v1.1.4:** the store row renders only where an ad provider actually exists
  (`adBridge()` present) or the removal is already owned. Selling the absence
  of ads in a build that shows none would be dishonest, so the row appears the
  day a wrapper ships ads and not an hour before — and the Play product should
  be created on the same schedule.

### 1.2 Board Injections — consumable cash, four tiers

**Fiction:** the board votes through extraordinary funds. Lands as a board
letter in the inbox (`news.boardInjection`, both languages), and as a line in
the Finances ledger — the books stay honest.

**Effect:** `club.budget += X` and `club.balance += X` where
`X = tier% × the season's opening transfer budget`, snapshotted at rollover
as `club.budgetAtOpen`:

| Tier | % of opening budget | Floor | Cap-exempt wage allowance (this season) |
|------|--------------------:|-------|------------------------------------------|
| Small (+25%) | 25% | £100k | +5% of the cap |
| Medium (+65%) | 65% | £250k | +10% of the cap |
| Large (+150%) | 150% | £500k | +20% of the cap |
| Sugar Daddy (+350%) | 350% | £1.0m | +40% of the cap |

**The wage allowance (owner’s decision, 25 Aug):** each injection also
carries board-underwritten wages *outside* the cap — a percentage of the
league cap, exempt for the season it was bought in and expiring at rollover
like the cash fiction it is (`state.wageBoost`, cleared in `rebuildSeason`).
It stacks across purchases within the seasonal limits of §3.2, the store
row prints it in pounds per week, and `capBill()` reads it exactly the way it
already reads marquee exemptions.

* **Snapshot, not current balance** — otherwise buying early beats buying
  late and the product page can't honestly say what you get. The store row
  shows the exact figure before purchase ("+£1.2m to your transfer budget").
* **Floors** keep the SKU meaningful at a National 1 club or a club in
  administration (opening budget can be ~£0 after `ADMIN_PENALTY`).
* **What it never buys (§3.4):** marquee slots, objective completion, match
  outcomes, or anything for the AI. The wage allowance above is bounded,
  seasonal, and printed on the tin; permanent freedom from the cap is its own
  product (§1.5), bought with eyes open and stamped on the save.

### 1.3 Manager's License — $2.99, non-consumable

* **Fiction:** your career badge-work is done; the game world treats you as a
  proven name.
* **Effect:** a toggle offered **at career creation** (New Career wizard,
  final step): "Start as a proven name". Pins `mgrReputation` at the scale's own
  ceiling (95 — the game measures reputation /95 everywhere) for that save —
  top-flight vacancies apply-able from day one,
  federations call (the `natOffer` gate at rep ≥ 64 is instantly open).
* **Per-save opt-in, account-wide entitlement.** It never retro-edits an
  existing career — an honest save stays honest. A licensed save is stamped
  (`state.licensed = true`) and the Legacy screen shows a small 🎓 beside the
  career grade: visible, not shaming.

### 1.4 In-Game Editor — REMOVED (v1.1.3, 27 Aug 2026)

* Was: $4.99 non-consumable (`phase.editor`), an Editor section on Game
  Status, the permanent 🔧 stamp. Removed on the owner's call — "this isnt
  needed for this game" — before any store ever sold one, so nothing is
  grandfathered and no real save carries the stamp. The numbering below is
  kept so cross-references stay stable.

### 1.5 The Owner’s Charter — $9.99, non-consumable

* **Fiction:** new ownership arrives with lawyers; the wage law no longer
  applies to this club.
* **Effect:** applied per save from the Boardroom (or at career creation):
  `state.uncapped = true`, irreversible for that save. `capBill()` returns no
  ceiling, cap fines and embargoes (`capFine`/`capEmbargo`) never fire, and
  marquee designation goes moot and hides. AI clubs remain capped — their
  books were balanced against the law, and the law still applies to them.
* **Stamped:** the save wears a small 🖋 in Legacy and
  the Annual. Records still count; the badge says how they were built.
* The whale product sold honestly: no drip of exemptions — one price,
  total freedom, permanent mark.

### 1.6 Full Fitness — $0.99, consumable (v1.1.4)

* **Fiction:** the medical department runs a full recovery camp.
* **Effect (`applyHeal`, `src/game/grants.ts`):** every player at the club is
  restored — injury cleared, condition to 100, rust to 0. Sharpness is left
  alone: match fitness is earned on the pitch and the product does not
  pretend otherwise.
* **Limit: 3 per season per save** (`HEALS_PER_SEASON`, ledgered in
  `state.injections.heal`, reset at rollover with the other consumables). A
  purchase that cannot land (squad already fit, limit spent, no career) is
  **held at the store, not swallowed** — same apply-then-consume recovery
  path the Boardroom injections use.
* Lands as a club letter (`news.heal`) and a Decisions line (`dec.heal`).

### 1.7 The Estate — $19.99, non-consumable (v1.1.4)

* **Fiction:** an anonymous benefactor rebuilds the club's entire estate.
* **Effect (`applyEstate`):** all nine facilities to `MAX_FACILITY` at once,
  any in-flight build folded in, `state.estateMaxed = true`. Applied per save
  from the store row behind a two-step confirm (it is the catalogue's most
  expensive product; one mistap must not spend it).
* **Once per save** — the stamp refuses a second application, and a save whose
  facilities are already all-max refuses too rather than burning the grant.
* **What it does not buy:** upkeep. Maxed facilities cost ~£63k/wk to run —
  the books still have to carry what the benefactor built. AI clubs are
  untouched.
* Lands as a board letter (`news.estate`) and a Decisions line (`dec.estate`).

### 1.8 The International Stage — $4.99, non-consumable (v1.1.4)

* **Fiction:** your name is put about at federation level; a call follows.
* **Effect (`applyPinnacle` + the answer block in `season.ts`):** an
  international job offer arrives within `NAT_CALL_WEEKS` (2) game-weeks of
  making the call — the offer is the **best federation the save's reputation
  honestly qualifies for**, floor Canada, via the existing `natOffer`
  machinery (same letter, same 3-week expiry, same accept path). The product
  guarantees the phone rings; it does not hand you New Zealand at rep 22.
* **Once per career** (`state.pinnacleCalled`); refused while a national job
  is already held or an offer is already on the table. In a live career the
  call goes out with the receipt ("an offer follows soon after purchase" —
  owner's brief); otherwise the store row offers "Make the call" when a
  career exists.
* **Price note (27 Aug 2026):** $4.99 chosen by Claude to sit between the
  License and the Charter — pending the owner's sign-off in the Play Console.

---

## 2. Rewarded video placements

All four are **player-driven, 30s, opt-in**, rendered as club fiction, and
each maps onto a mechanic the game already has — the ad replaces the *fee*,
never invents a new power.

| Placement | Surface | Fiction | Effect | Cost it replaces |
|-----------|---------|---------|--------|------------------|
| **Physio's favour** | Medical Centre, on an injured player's row (lay-off ≥ 3wk) | "The sponsor covers the consultant" | The existing `specialistConsult`: a fifth off the remaining lay-off, min 1 week, **capped at 2 weeks** | The six-figure consult fee |
| **The agency's file** | Player profile / Shortlist, on a scouted target | "The agency shares its file" | `bumpKnowledge(+30)` on that player — potential range narrows or resolves, exactly as paid scouting does | Weeks of scout attention |
| **Analyst's extra session** | Matchday, pre-kick-off card (only when a readable weakness exists) | "The analyst pulls an all-nighter" | The assistant's game-plan brief upgraded to the analyst's full read for this match (`analystEdge` quality bump) | Analyst staff level |
| **The town's collection** | Finances, only while `club.rep < 60` **and** balance < 8 weeks of wages | "The supporters' trust passes the bucket" | +2% of opening budget, min £25k, max £75k | Nothing — it is the lower-tier lifeline |

**Implementation surface:** one `AdBridge.showRewarded(placement) →
'completed' | 'skipped' | 'unavailable'` call. In the web build and any build
without an ad bridge, **the buttons do not render at all** — the game must
read as complete without them (same rule `storeprobe` applies to the till).

---

## 3. Economy balancing & anti-P2W guardrails

### 3.1 Caps and cooldowns (rewarded)

* **Per real day (bridge-enforced, device-clock-proof):** 5 rewarded views
  total, across all placements.
* **Per game concept (save-enforced, timestamped in game-weeks so instant-
  result marathons can't farm):**
  * Physio's favour: once per injury (`p.specialist` flag already enforces),
    max 2 per game-week.
  * Agency's file: max 3 per game-week, once per player per season.
  * Analyst's session: once per matchday.
  * Town's collection: once per game-week, max 3 per season, hard-stops the
    moment `rep ≥ 60`.
* Both ledgers are checked; the stricter one wins.

### 3.2 Purchase sanity rails (consumables)

* Injections: max **2 per tier per season** per save; the Sugar Daddy **once
  per season**. The board minutes say so in fiction: "the owners will not go
  to the well again this year."
* A purchase mid-checkout that the store reports `pending` grants nothing
  until the bridge confirms — the existing `PurchaseOutcome` flow.

### 3.3 Progression exploits, closed by name

* **Objectives:** injected cash is tracked (`state.injectedThisSeason`) and
  excluded from `objectives.books` ("finish in the black") and any future
  finance-shaped objective. You cannot buy a board objective.
* **War chest / stance:** the aim-high clawback (`rebuildSeason`) computes on
  organic funds only.
* **Insolvency:** an injection CAN save a club from administration — that is
  the product working as fiction — but the insolvency warning fires first, so
  it is a rescue, not a surprise bill.
* **Sell-on arbitrage:** none exists — injections change no player values,
  no AI willingness (`sellerWillingness` reads squad/contract state only).
* **Fingerprint:** all effects are additive writes outside the rng stream.

### 3.4 The organic path stays the game

* For a free player the wage cap binds exactly as today (`capprobe`), the AI
  economy is untouched (`aiecon`), and `difficultyprobe` continues to assert
  that an engaged free player outperforms a sleepwalker — those three
  probes are the regression net for "F2P can still reach the top."
* Paid wage room is bounded and seasonal (§1.2) or total, permanent and
  stamped (§1.5); `capprobe` gains an uncapped-save exemption plus a new
  assertion that the flag never sets itself.
* Nothing purchasable touches attributes, match outcomes, refs, draws, or
  opponents. (The In-Game Editor was the one exception, stamped for it —
  removed v1.1.3, so now nothing purchasable touches them at all.)

---

## 4. UX & store integration plan

**Where each thing lives (no pop-ups, no home-screen tiles, no badges):**

* **Boardroom (Finances screen):** a "Board" card lists the four injections
  as board resolutions with the exact figure each would add. The Sugar Daddy
  row is styled as the owners' letterhead, not a flashing offer.
* **Medical Centre:** the Physio's favour button sits beside the existing
  specialist-consult button on qualifying injuries only.
* **Transfers / player profile:** the agency's file sits with the scout
  actions on unscouted targets.
* **Matchday (pre-kick-off):** analyst's session appears on the briefing
  card only when there is a weakness to read.
* **Game Status:** Remove Ads, Manager's License, and **Restore
  purchases** — the quiet shelf, where the existing supporter unlock already
  lives.
* **New Career wizard:** the License toggle, only for owners.
* Store rows always show localised prices from the bridge
  (`supporterPrice()` pattern), in both languages — the till speaks French
  too, day one.

**Tone rule:** every purchase surface is written in the game's own voice
(both locales), never commerce-speak. The word "premium" appears nowhere.

---

## 5. App Store / Google Play listing copy

* **Remove Ads** — "Clear the touchline boards for good. One purchase, no
  banners, forever — and the game stays exactly the game."
* **Board Injection (Small)** — "The board approves a modest top-up: +25% of
  this season's transfer budget, straight to your war chest."
* **Board Injection (Medium)** — "A serious vote of confidence from
  upstairs: +65% of this season's transfer budget to spend in the market."
* **Board Injection (Large)** — "The owners open the vault: +150% of this
  season's transfer budget, with the wage room to match. Sign the men the
  project needs."
* **The Sugar Daddy** — "New money arrives at the club: +350% of this
  season's transfer budget, and the board underwrites the wages to match.
  The rest of the league just took note."
* **The Owner’s Charter** — "The wage law no longer applies to you. No cap, no
  fines, no embargoes — build the squad nobody else is allowed to pay."
* **Manager's License** — "Start any new career as a proven name: maximum
  reputation, top-flight vacancies open, federations already calling."

---

## 6. Engineering plan (build order)

1. **Bridge v2** (`monetise.ts`): product catalogue for 7 SKUs; consumable
   flow (`purchase → consume → grant`, idempotent via store receipt id);
   `AdBridge.showRewarded(placement)`; entitlement cache in localStorage
   with restore.
2. **Grant plumbing:** `applyInjection(tier)`, `licenseNewCareer`,
   `state.edited/licensed/injectedThisSeason`, board letter + ledger line
   (keys in both locales — `newsprobe`/`frenchprobe` extend automatically).
3. ~~Editor screen~~ (product removed, v1.1.3).
4. **Surfaces** (§4), hidden entirely when no bridge.
5. **Probes before ship:** extend `storeprobe` (no till/no ad buttons in web
   build; all 7 SKUs purchasable in a packaged mock), extend `moneyprobe`
   (fails open, grants once, caps hold), teach `econprobe` the
   injected-funds exemption, add `grantprobe` (every SKU's effect applied and
   bounded, seasonal caps enforced, objective exclusion holds).
6. **Docs:** privacy policy + store listing updates per §7's decision.

## 7. Decisions — resolved by the owner, 25 August

1. **Rewarded video ships in v1.1.0 and the privacy label changes with it.**
   The ad SDK lives in the Play wrapper only; the web bundle stays clean and
   `netprobe` stays green. The "collects nothing" claim lives in exactly four
   places, and they flip together in the same commit that lands the SDK —
   not before, because today's live build collects nothing and must keep
   saying so:
   * `docs/store-listing.md` — the Data Safety answers (currently "No");
     the v1.1.0 replacement table now sits alongside them in that file.
   * `public/privacy.html` — the shipped policy. New form: the game itself
     collects nothing; the Android app's ad provider uses the advertising
     identifier when the player chooses to watch a rewarded ad.
   * `handbook.a79` + `world.privacyBody`, both languages — the same
     statement in the game's own voice.
   * The `netprobe` header's store-form note, so the probe's documentation
     matches the listing it polices.
2. **Injections carry cap-exempt wage allowances** (§1.2) — bounded,
   seasonal, priced on the tin.
3. **The Owner's Charter exists** (§1.5) — total cap removal at $9.99,
   per-save, permanent, stamped.

The fairness line, restated once for the record: power is sold openly —
bounded where it is cheap, total where it is dear, and always stamped on the
save that used it. Single-player, the player's own world, the player's call.
The free game is untouched.

## 8. Measurement (wrapper-side only, nothing in the game bundle)

Store-console metrics only at launch: conversion per SKU, refund rate,
rewarded fill/completion (if v1.2 ships ads). No analytics SDK in the game —
that is the same promise the privacy label makes.
