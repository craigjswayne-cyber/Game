# Pre-launch audit — PHASE: Rugby Manager v1.5.6 (Play code 27)

Audited 8 September 2026, against `claude/new-session-eapjfs` at commit `e4085d1`, with the
full 210-probe suite green. Six pillars, as briefed. Every finding carries a file reference, a
severity, and a fix. Where a check came back clean that is stated plainly rather than padded, and
where a claim could not be verified from this environment that is stated too.

**Method.** Most of this game's quality is already enforced mechanically: 210 probes, of which
~60 drive a real browser. This audit therefore does two things — it reports what the automation
already proves (with the probe that proves it, so a claim here can be re-run rather than believed),
and it hand-audits the areas no probe covers. New defects found by hand are fixed and named below.

---

## Verdict first

### **GO** for App Store and Play submission, with two Medium items to schedule.

Nothing found in this pass is a submission blocker. Two defects were found by hand and are already
fixed in this release. Two Medium items are design decisions the owner has made deliberately and
should go in with eyes open. The one item I would not ship another release without is **T-3** below,
because it is the only finding that can silently cost money.

| # | Pillar | Finding | Severity | Status |
|---|---|---|---|---|
| **T-1** | 3 | `comm.pen11` claimed rain and mud with no weather gate | Medium | **FIXED this release** |
| **T-2** | 2 | `Siosaia`, a male Tongan name, sat in the female forename bank | Medium | **FIXED this release** |
| **T-3** | 4 | iOS purchase bridge was never added to the Xcode target | **Critical** | **FIXED this release** |
| **T-4** | 4 | Adverts unverified on device; no fault found in code | High | Open — needs a device |
| **T-5** | 5 | No viewport below 360px wide was swept | Medium | **CLOSED — 320px added, passes** |
| **T-6** | 4 | Cash, healing and the wage cap are purchasable | Medium | Deliberate — see below |
| **T-7** | 2 | Three Pacific forenames need a native speaker's eye | Low | Open |
| **T-8** | 3 | Penalty range lines are gated on the boot, not on distance | Low | Accepted |

---

## 1. Language and AI copy polish

**AI jargon: clean.** All 6,389 English strings were scanned for the tell-tale register — *delve,
testament, unwavering, robust, tapestry, showcase, boasts, myriad, plethora, leverage, seamless,
elevate, embark, realm, landscape of, holistic, synergy, cutting-edge, meticulous, nuanced,
underscore, pivotal, paramount, resonate, foster, harness, dive into,* and the connective tics
(*furthermore, moreover, additionally, it is important to note*). **Zero hits.** The same scan on
French for sentence-initial *De plus / Par ailleurs / En effet / Il convient*: **zero hits**.
Spanish, Italian and Afrikaans came back clean on their equivalents.

That is not luck. `scripts/textlint.ts` and `scripts/englishprobe.ts` already police register and
plural correctness, and englishprobe exists specifically to catch English being flattened to make a
translation easy — its budget of flattened entries is zero and it is at zero.

**Clarity and brevity: verified mechanically.** `keyscreen.mjs` proves every label on every screen
renders as words and never a raw key, in five languages. `sidescroll.mjs` proves every table fits
the phone it is read on, in five languages. `densityaudit.mjs` proves no screen carries duplicate
titles. The difficulty copy was rewritten in plain words this release at the owner's request.

**Terminology: no defect found.** The commentary bank uses real register (*slots the penalty*, *makes
no mistake from the tee*, *bisects the uprights*, *from the pocket*). Law language is used correctly
where it appears — the uncontested-scrum work in 1.5.1 implements Law 3 and Law 3.35 by name, and
`scripts/scrumlaw.ts` holds it.

**Finding T-8 (Low, accepted).** `comm.pen4`, `comm.pen6` and `comm.pen9` claim range — *from
distance*, *from 45 metres*, *from halfway*. The engine does not model where a penalty is taken
from, so these are flavour, not a stat. They are already gated on the kicker having the boot for it
(`src/game/matchEngine.ts:1253`, `PEN_LONG`, requires `goa >= 12`), which was the 1.5.0 audit's fix.
Gating them on a real distance would mean giving the engine field position for kicks, which is a
much larger change than the payoff. **Recommendation: accept.**

---

## 2. Cultural sensitivity, names and genders

**Gender/name matrix: audited in full, one real defect.** `src/game/nations.ts` holds 484 male
forenames and 539 female forenames across 18 unions, with surnames shared between the two banks
(correct — surnames are not gendered in any of these cultures). `regenName`
(`src/game/nations.ts:258`) draws the forename from the female bank when the world is women's and
the male bank otherwise, and the men's default is preserved byte-for-byte so existing saves do not
shift.

- **T-2 (Medium, FIXED).** `Siosaia` was in the Tongan **female** bank at `nations.ts:243`. It is
  the Tongan form of Josiah and is a male name — a Tongan king was baptised under it. Replaced with
  `Melenaite`. The array length is unchanged, so no seeded world moves.
- **Names in both banks** — Quinn, Bailey, Mackenzie, Riley, Rowan (USA/CAN) and Manaia (NZL) — were
  checked and are genuinely unisex in those cultures. **No action.**
- **T-7 (Low, open).** Three Pacific entries read to me like titles or surnames rather than everyday
  female forenames: `Maiava` and `Tuiloma` (SAM), and `Tupou`/`Fifita` (TGA) are chiefly or family
  names. I could not confirm this well enough to act on it, and getting it wrong in the other
  direction would be worse. **Recommendation: one pass by a Samoan or Tongan speaker before a
  Pacific marketing push.** Not a submission blocker.
- **`Sanele` (RSA, Low).** Unisex in Zulu, but predominantly male, and `Zanele` — unambiguously
  female — is already in the same list. **Recommendation: swap it if a native speaker agrees.**

**Hand-authored women's squads: clean.** Every forename in the women's league files was
cross-checked against the male bank. Five hits — Sam, Morgan, Charlie (ENG/FRA) and Taj, Akira
(Pacific) — all of which are real players carried over from real squad lists, and all of which are
attested women's forenames. **No action.**

**Cultural sensitivity: covered by a standing gate.** `scripts/sensitivityprobe.ts` and
`docs/sensitivity-audit.md` are the 1.5.1 deep-dive, which swept all six locales, the flavour banks
and the real-name risk. `scripts/ipprobe.mjs` checks 150 real marks and proves none of them ship.
`scripts/kitprobe.ts` proves no club wears anything belonging to anybody else. This pass added
nothing new: no team name, nationality pairing or event string in the current build reads as
geopolitically careless to me.

**Localisation pitfalls.** The idiom risk is handled structurally rather than by review: nothing in
the game is assembled from English fragments. `_k` fragment placeholders resolve in the reader's
language, `_l` handles lists, `_o` ordinals, and plural entries are `{one, other}` objects.
`langparity.ts` proves every gendered sibling matches its base's shape, `i18nprobe.ts` and
`commprobe` prove all 205 commentary keys exist in all six languages, and `frenchprobe` enforces
French typography down to the narrow no-break space. Afrikaans carries its own ordinal rule
(`_meta.ordRule`), added in 1.5.1, because the digit rule the other languages use is wrong for it.

---

## 3. Gameplay logic and commentary sync

**T-1 (Medium, FIXED).** `comm.pen11` — *"{player} wipes the mud off the ball, wipes the rain off
his face, and nails it"* — had no weather gate. The try bank has had `TRY_LINES_WET` since the
start (`matchEngine.ts:2018`), and flavour has `FLAVOR_WET` and `FLAVOR_WIND`
(`matchEngine.ts:2654`), but the penalty bank never got the equivalent, so a kicker could wipe rain
off his face under a clear sky. Fixed with `PEN_WET` (`matchEngine.ts:1254`), shaped exactly like
the existing `PEN_LONG`: the swap happens after the draw, so there is no extra call on the random
stream and every seeded match keeps its fingerprint. A full weather sweep of the commentary bank
found no other line making a claim about conditions.

**Commentary alignment: no mismatch found.** The bank is keyed, not concatenated, and every line is
pushed at the moment its event resolves, so a conversion line cannot fire on a miss — the miss has
its own key (`comm.penWideNamed` / `comm.penWide`). `scripts/coverswap.ts`, added in 1.5.5, holds
the one real case of a line naming the wrong player: overriding the assistant's injury replacement
used to leave the original name in the ticker, and the ticker is the saved match record, so the
error survived the match. `scripts/subline.mjs` and `commprobe` cover the rest.

**Contextual awareness: the risk does not exist here.** A scan of the entire bank for *winner, wins
it, snatches, last-gasp, steals it, dramatic, unbelievable, clinches, seals it, match-winning*
returned **nothing**. There is no "unbelievable last-gasp winner" line to fire at 30 points down,
because the game does not have one. Late drama is carried by the tension band instead, which is
gated on margin *and* minute together — `dramaprobe.mjs` proves there is no band in a blowout at
74', none at 20' however level, and that the band's three sentences match the three margins.

**Tactical realism.** The Law 3 work is the strongest evidence here: losing a front-rower mid-match
now goes to uncontested scrums, a replaced front-rower may return under Law 3.35, and both are held
by `scripts/scrumlaw.ts`. `invariants.ts` runs five seasons of weekly checks on the whole world,
and `extremes.ts` runs sixteen impossible worlds for two seasons each. `challengetest.ts` runs all
eight challenges for two seasons.

---

## 4. Monetisation, ads and revenue

**T-3 (Critical, FIXED).** The reported symptom was "the store on iPhone doesn't seem to be
working" on 1.3.2. The cause is packaging, not game code. `scaffold.sh` copied `PhaseBilling.swift`,
`PhaseBilling.m`, `App-Bridging-Header.h` and `Products.storekit` into `ios/App/App/` — but an Xcode
target compiles what `project.pbxproj` lists, and `cap add ios` generates that file from Capacitor's
template, which has never heard of those four. Unless somebody did the manual drag in Xcode, they
were never compiled, `NSClassFromString("PhaseBilling")` returned nil, and the game had no shop
**with no error anywhere**. Confirmed by scaffolding a real iOS project in this environment: no
`PhaseBilling` in Compile Sources, no `SWIFT_OBJC_BRIDGING_HEADER`.

Fixed by `packaging/ios/install-billing.mjs`, which writes the `PBXBuildFile`, `PBXFileReference`,
group and build-phase entries and sets the bridging header, checks the project still balances, is
idempotent, and runs from `scaffold.sh` after every scaffold. `moneyprobe.ts` now holds it in place.
**This was the single most expensive defect in the project and it had no test.**

**T-4 (High, open).** "Ads aren't showing" on 1.3.2. No fault found in code: the bridge, the live
AdMob IDs and the Info.plist keys were all present at that version. The likeliest causes are all
off-device-code — a brand-new ad unit with no fill, an AdMob app not yet linked to the store
listing, or an unanswered consent form. The real problem was that **none of them was visible on a
phone**: the bridge writes its reason to a console that needs a Mac to read. Two changes this
release: `about.bridgeAdsWhy` shows that reason on the About & legal screen, and the bridge now
records a banner the network refused rather than only logging it. **Recommendation: install this
build, open About & legal, and read the line back.** That turns an unfalsifiable report into a
diagnosis.

**Ad flow: not intrusive, and proven so.** Three banner placements only — `home-foot`,
`results-foot`, `match-foot` (`monetise.ts:733`). No interstitials anywhere in the codebase.
`matchad.mjs` proves the match banner appears in play only and never over a substitution, half time,
the hour or full time. `adsAllowed()` refuses any place not on that list, and refuses everything
for a player who owns Supporter. A banner that gets no fill is removed and the page takes its space
back, so a failed load leaves no grey box.

**Rewarded video: fair.** Four placements — medical, scouting, matchday, collection — each of which
**replaces a fee the game already charged** rather than inventing a power, capped at 10 spots per
real day in the bridge (`ads-bridge.js:144`) with per-placement limits inside the game on top. A
spot that neither rewards nor closes in five minutes resolves as unavailable, so a hung SDK cannot
lock the player out.

**Offline and failure states: safe.** `tillOpen()` is false with no billing bridge, so the store
row does not render rather than rendering a dead button. `rewardedAvailable()` is false with no ad
bridge, so rewarded buttons do not appear at all offline. Everything except a confirmed completion
is treated as a polite no. Non-consumables are granted once and restored from a local entitlement
set, so a re-install with no network does not lose a purchase.

**T-6 (Medium, deliberate).** The catalogue includes cash injections (`INJECT_SKUS`), an injury
heal (`HEAL_SKU`), a wage-cap removal (`CHARTER_SKU`, "Uncapped"), a ground (`GROUND_SKU`) and an
international job (`PINNACLE_SKU`). In a management game, buying cash and removing the wage cap
bypasses the central constraint of the design. This is not a store-compliance problem — the game is
single-player, has no leaderboards and no PvP, so nobody else is disadvantaged — and it is the
owner's stated design (`docs/monetisation-spec.md`). **Flagged so the decision is explicit, not
because it should change.** The one thing I would watch is review sentiment: "pay to remove the
salary cap" is the sort of line that shows up in a one-star review even when it harms nobody.

---

## 5. UI/UX, screen adaptation and responsiveness

**Touch targets: proven, with documented exceptions.** `tapsize.mjs` holds a 44px minimum (Apple's
44pt, Android's 48dp) and passes. The exceptions are listed in the probe with a reason each —
`form-chip` and `chip` sit at 36px because fifteen chips on one half-pitch would overlap at 44px,
which would make taps *less* reliable, not more. That is the right trade and it is written down.

**Aspect ratio: strong for phones, one gap.** `geosweep.mjs` sweeps every screen at 360x740,
412x915 and 430x932 and proves each holds its shape. `subreach.mjs` adds 390x664 and 390x568, which
is where the reported "shirt 1 is out of shot when making subs" bug was chased (it does not
reproduce: the sheet opens at scrollTop 0 with shirt 1 on screen and tappable). `portraitqa`,
`overlapaudit`, `stickyaudit`, `scrollaudit` and `blockprobe` all pass. Notches and dynamic islands
are handled properly: `env(safe-area-inset-*)` is captured into tokens at `src/ui/theme.css:428`
and used for the header, the bottom nav, the ad inset and modals, rather than being assumed away.

- **T-5 (Medium, CLOSED).** Nothing below **360px wide** was swept, so the narrowest screen the
  game actually ships to — a 320dp budget Android device, or an original iPhone SE — had never been
  rendered. `320x568` is now the first entry in `geosweep.mjs`, and the sweep is **32 screens x 4
  geometries = 128 layouts, all passing**. No clipping, no overflow, no overlap at 320px. The gap
  was in the coverage, not in the layout.
- **Tablets and 4:3 are out of scope by design**, and correctly so: the iOS shell is set to
  `TARGETED_DEVICE_FAMILY = "1"` (iPhone only) in `scaffold.sh`, which also drops the Mac and Vision
  destinations that ride along with iPad. That is deliberate — claiming iPad forces a full set of
  iPad screenshots in App Store Connect for a layout nobody designed.

**Contrast and colour.** `nightcontrast` proves nothing on any screen in either theme falls below
2.2:1. `colourblind` proves no state is carried by hue alone. `tokenlint` proves colour appears in
`tokens.css` and nowhere else across 135 files.

---

## 6. Release readiness

### Verdict: **GO.**

The suite is green at 210 probes. Three defects were found by hand in this pass; all three are
fixed. A fourth item, the missing 320px sweep, was closed inside the audit itself: the coverage was added
and all 32 screens hold at that width. The remaining open items are one device check (T-4), one
naming question for a native speaker (T-7), and one design decision that is the owner's to make
(T-6). None of them stops a submission.

### Priority list before submission

| Priority | Item | Why now | Effort |
|---|---|---|---|
| 1 | **Rebuild the iOS shell from the fixed `scaffold.sh`** and confirm the shop appears | T-3's fix is worthless until a build carries it. About & legal will say on the device. | 20 min on a Mac |
| 2 | **Read About & legal on the device and report the adverts line** | The only way to close T-4. | 2 min |
| 3 | ~~Add a 320px viewport to `geosweep.mjs`~~ | **Done in this pass.** All 32 screens hold at 320x568. | — |
| 4 | Get a Samoan/Tongan speaker over the Pacific forename lists | Cultural accuracy, not a blocker. | one pass |
| 5 | Decide whether "Uncapped" stays in the catalogue | Review-sentiment risk, not a compliance one. | a decision |

### What is genuinely well covered, and worth saying

The automation here is not decoration. 210 probes, ~60 of them driving a real browser, gate every
push, and the deploy workflow refuses to publish a red build. Three separate probes in this release
had to be *corrected* because they had memorised answers the game had deliberately changed — which
is the sign of a suite that is actually load-bearing rather than one that passes because it asserts
nothing.

The gap this audit exposes is not in the game. It is that **the one defect that cost real money —
the iOS purchase bridge — lived entirely outside the code the suite could see**, in a generated
Xcode project that is gitignored. It is now covered. Everything else in `packaging/` should be
looked at with the same suspicion: it is the part of this product with the least test coverage and
the most expensive failure mode.
