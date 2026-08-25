# Commercial Release Readiness Report

First audited 2026-08-22 at commit 52fa566, against v1.0.1. Kept current since:
the IP rename landed in v1.0.3, the store surfaces in v1.0.4, and the language
work in v1.0.5 and shipped as v1.0.6 - see the addendum at the end, which is where anything newer
than the original audit is recorded rather than edited into it.

Audit date: 2026-08-22, at commit 52fa566. Conducted as a store-submission audit
against Apple App Store Review Guidelines and Google Play policy, on the standard
that every claim below is grounded in a grep, a probe run today, or a measured
simulation. Nothing here is assumed.

Evidence base, all run at this commit:

- `scripts/releasesim.ts` (new): 15 full seasons headless, seed 20260822,
  measuring save size, population, regen quality, ages, finances, corruption.
- Save-integrity battery, all green today: savefuzz, cloneprobe, replayprobe,
  resumeprobe, chaosprobe, backupprobe.
- UI battery at the built dist: devicematrix, geosweep, portraitqa, tapsize.
- Static sweeps: IP grep across src and public, permission/network grep,
  font-unit census, manifest and viewport inspection.

---

## Part 1: Store Blockers / Critical Risks

### 1.1 BLOCKER - Real-world IP throughout the shipped database (deliberate)

The measured inventory:

- ~1,600 unique real player names in `src/data` (1,569 in the league files
  alone, plus the verified 2025/26 Premiership squads and captains list).
- 50+ real club identities across the English, French and URC pyramids
  (Bath, Leicester, Toulouse, Leinster and the rest), with real-world
  reputations, cities and stadium identities.
- Real competition brands, player-facing: "Gallagher Premiership" (a sponsor
  mark on top of a league mark, `src/game/newgame.ts:91`), "Champions Cup",
  "Challenge Cup", "Top 14", "United Rugby Championship", "Six Nations",
  "The Rugby Championship", "Rugby World Cup". Six Nations and Rugby World Cup
  are among the most actively enforced marks in sport.
- The PWA manifest advertises it: `"description": "... real clubs, real
  players, deep seasons"`.
- The title screen carries the honest disclaimer: "A personal project - real
  names used for fun, not for sale."

This is a policy wall, not a bug. Apple 5.2.1/5.2.3 (intellectual property,
unauthorized use of third-party content) and Google Play's IP/impersonation
policy make takedown on report a near-certainty, and ~1,600 real athletes'
name/likeness rights sit on top of the trademark exposure. The disclaimer does
not cure it; a commercial listing would in fact contradict it.

The one thing already done right: **no real badges ship**. Club crests are
generated, and `public/logos/README.txt` establishes the drop-your-own-files
pattern, meaning user-supplied real assets stay on the user's side.

Remediation options, in order of realism:

1. **Fictionalise the shipped database, keep reality as an import.** Ship
   invented clubs/players/competition names; offer the real-name world as a
   user-side import file (the Saves screen already has a working import path,
   and the logos folder already models "your assets, your device"). This is
   the established genre solution.
2. **Name generator at new game**: scramble names at world creation, with the
   real data never shipping in the binary. Weaker (data still ships).
3. **Licensing**: not realistic for a solo project (league, union, and per-player
   image rights are separate negotiations).

Until one of these lands, this build must not be submitted to either store.
As a free personal web project with the disclaimer, it remains what it says
it is.

### 1.2 CRITICAL - The store package would force the wrong orientation

The game is designed, tuned and QA-gated for **portrait** (the portrait
harness fails the build on regression, `src/ui/App.tsx:69` documents it), yet:

- `public/manifest.webmanifest` declares `"orientation": "landscape"`, and
- `useOrientationLock()` (App.tsx:142, mounted at :195) still hard-locks
  installed apps to landscape where the platform allows it.

In a browser tab the lock silently fails, which is why nobody has seen it.
In exactly the packaged contexts a store release means (TWA on Play, wrapped
WKWebView on iOS, installed PWA), the manifest and the lock win, and the
store build opens sideways into the layout the project deliberately stopped
tuning. One-line fix each side (drop the lock, declare `portrait` or `any`),
but as shipped it is a day-one store defect.

### 1.3 CRITICAL - Single-device saves on evictable browser storage

Careers live in IndexedDB (`rugby-manager` database) on one device. No
accounts, no cloud. Two consequences for a commercial release:

- WebKit can evict IndexedDB for web apps after about seven days of disuse
  (installed home-screen apps are exempt, browser-tab play is not). A paying
  iOS customer can lose a twenty-season career by going on holiday.
- Uninstall, browser data clear, or device change all take the career with
  them.

Mitigations already in place and verified today: manual Export/Import on the
Saves screen, a once-a-season in-game reminder that names the button
(backupprobe green), a visible save-failure banner instead of silent loss,
and a save that heals damaged fields on load (savefuzz green). That is a
strong posture for a free PWA and below the bar customers expect from a paid
store title. A store release needs either platform cloud saves (iCloud/Play
Games) or an automatic export nudge wired to the platform share sheet.

### 1.4 RISK - Distribution packaging does not exist yet

This is a GitHub Pages PWA. Google Play can take it as a TWA with modest
work. Apple has no PWA path: it needs a wrapped binary (Capacitor or bare
WKWebView) and then clears Apple 4.2 (minimum functionality) review, where
"repackaged website" rejections happen. The game's depth makes a 4.2 case
winnable, but the engineering and review risk exist and are unstarted.

---

## Part 2: Monetization & UX Defects

### 2.1 Monetization: nothing to audit, and that is verified

The IAP/ads/accounts audit legs are **N/A by measurement**, not by assumption:
a full-source grep finds no fetch/XHR/beacon/WebSocket call anywhere in the
app, no analytics, no SDKs, no ad surfaces, no purchase flows, no login. The
game is fully offline behind its service worker. Consequences worth having on
the record:

- Play Data Safety and Apple privacy nutrition labels are trivially "no data
  collected", which is a selling point.
- There are no IAP restore/interrupt/refund edge cases because there are no
  IAPs. If monetization is ever added, that entire audit reopens.
- A paid up-front listing is the only model the current build supports, and
  the title-screen "not for sale" line would have to go.

### 2.2 The store shell still wears the retired blue

`index.html` theme-color `#24478f` and manifest `background_color #08142c` /
`theme_color #24478f` are the pre-rebrand blues. The Android status bar and
the PWA splash screen flash a palette the game retired two deploys ago,
before charcoal-green loads. Cosmetic in a tab, prominent in an installed
app (the splash is the palette). These files sit outside `src/`, which is
why tokenlint never caught them.

### 2.3 Text scaling: the game opts out entirely

The census: all 199 `font-size` declarations in the UI are in `px`, and the
viewport meta pins `maximum-scale=1.0, user-scalable=no`. So OS-level text
scaling does nothing, and pinch-zoom is refused. The upside is measured
stability (no reflow bugs at any text scale, because there is no text
scale). The downside is a WCAG 1.4.4 miss and a genuine accessibility
defect for low-vision players on a phone screen. Games get more latitude
than apps here, but a commercial release should offer an in-game text-size
setting or stop suppressing zoom.

### 2.4 Long-run economy: two-fifths of the world runs at a loss

From the 15-season simulation: clubs in negative balance climb from 12 to
about 41 of 101 by season 9 and then hold there (41, 42, 41, 39, 41 across
the final seasons), while league-wide wealth grows £262m to £881m. The red
ink lives at the bottom: at season 15 it is 12 of 63 top-flight clubs, 18 of
26 in the second tiers, and 11 of 12 in National League One. The game's
top-flight economy works; the lower-league one runs on structural deficit. It is an equilibrium, not a collapse, and AI
clubs keep functioning; but there is no insolvency mechanic, so a player
who inspects rival finances sees two-fifths of the sport ignoring
bankruptcy forever. Acceptable for v1; worth an administration/points-
deduction mechanic (or tighter lower-league AI budgets) in a commercial
build.

### 2.5 Regen calibration: one visible step, then flat

The under-23 cohort's mean attribute steps from 7.9 (the real-data youth
the game ships with) to ~9.5 once the world's own regens fill the window,
then holds flat for nine straight measured seasons (9.6 to 9.4, a 2%
drift). So there is no compounding drift - season fifteen mints the same
class of player as season seven - but the game's own youth run about 13%
stronger than the imported real-world youth data. A player who starts a
career will feel academies get slightly better after the first few years,
once, permanently. Calibration note, not a defect.

### 2.6 Minor

- `apple-touch-icon` points at the 192px PNG; Apple's spec size is 180x180.
  Works, scales, but worth shipping the exact size.
- The disclaimer line and the manifest description both need rewriting for
  any store listing (see 1.1); they are correct for what the project is
  today.

---

## Part 3: Release Sign-Off Checklist

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | IP scrub: no real club/player/competition names | **FAIL** | ~1,600 real players, 50+ real clubs, 8 real competition marks (grep, Part 1.1). Deliberate design choice; blocks store submission as-is |
| 2 | Real badges/logos shipped | **PASS** | Generated crests only; `public/logos` ships a README, no images |
| 3 | User-content isolation (imports stay user-side) | **PASS** | Logo drop-in and save import are local files; nothing uploads |
| 4 | Device permissions | **PASS** | Zero permissions requested; no geolocation/camera/mic/notification API use (grep) |
| 5 | Network and data collection | **PASS** | No fetch/XHR/beacon/analytics anywhere; fully offline PWA |
| 6 | Force-close during save | **PASS** | IndexedDB transactional writes; savefuzz + cloneprobe green today |
| 7 | Mid-match interrupt/resume | **PASS** | Replay-based resume; resumeprobe compares interrupted vs uninterrupted event streams, green today |
| 8 | Corrupt/legacy save handling | **PASS** | migrate() heals missing fields; savefuzz deletes each field in turn, green |
| 9 | Save bloat over 15 seasons | **PASS** | 5.25MB new game to 8.15MB at season 15; second-half growth x1.07 (releasesim) |
| 10 | Long-sim stability, 15 seasons | **PASS** | Every season rolls, no NaN/Infinity, JSON round-trips every year (releasesim) |
| 11 | Population and retirement logic | **PASS** | 6,583 to 7,399 players, ages stay 17-37, retirements and regens every season |
| 12 | Regen attribute drift | **PASS** (with note) | Flat at equilibrium (9.6 vs 9.4 over 9 seasons); one-time +13% step over shipped youth data (Part 2.5) |
| 13 | Financial long-run balance | **PASS** (with note) | Stable equilibrium; ~41/101 clubs in persistent deficit, no insolvency mechanic (Part 2.4) |
| 14 | Multi-resolution layout | **PASS** | devicematrix across phone matrix green at this dist |
| 15 | Extreme aspect ratios | **PASS** | geosweep green at this dist |
| 16 | Portrait QA and tap targets | **PASS** | portraitqa + tapsize green at this dist |
| 17 | Notch/safe-area handling | **PASS** | env(safe-area-inset-*) on masthead, nav, sheets (10 sites in theme.css); devicematrix runs notched viewports |
| 18 | Max text scaling | **FAIL** | All 199 font-size decls px; user-scalable=no; OS text-size ignored (Part 2.3) |
| 19 | Orientation correctness in store package | **PASS** (remediated) | Landscape lock removed; manifest orientation "any"; shelllint.ts guards it |
| 20 | Store shell branding (splash/status bar) | **PASS** (remediated) | Splash and status bar wear the night ground #1a201e, read from tokens.css by shelllint.ts |
| 21 | IAP edge cases | **N/A** | No IAPs exist (verified, Part 2.1) |
| 22 | Ad implementation | **N/A** | No ads exist (verified) |
| 23 | Cloud save/state persistence across devices | **FAIL** | Single-device IndexedDB; manual export only (Part 1.3) |
| 24 | Offline behaviour | **PASS** | Service worker: network-first shell, cache-first hashed assets, stale-cache cleanup |
| 25 | Store packaging (TWA/wrapper) exists | **FAIL** | Web-only today (Part 1.4) |

**Sign-off verdict at audit time: NOT READY for store submission.** Five fails were
engineering work measured in days (19, 20 same afternoon; 18, 23, 25 real but
bounded). One fail is the identity of the current build (1: the real-name
database), is deliberate, and is the actual decision the project owner has to
make - fictionalise and ship, or stay a personal project. The simulation core,
save integrity, permissions posture and layout discipline are already at or
above store standard, which is the part that usually is not.

---

## Remediation addendum

Shipped in the commit that carries this addendum, each fix behind a probe
demonstrated red on the pre-fix tree (828106c):

- **Orientation (1.2, line 19)**: the landscape hard-lock is gone from App.tsx
  and the manifest declares `"orientation": "any"` - portrait is the tuned
  orientation and landscape still works, so the shell now forces neither.
- **Store shell branding (2.2, line 20)**: index.html theme-color and the
  manifest splash colours now carry the night ground `#1a201e`. The new
  `scripts/shelllint.ts` reads that value out of tokens.css, so a future
  palette change fails the suite until the shell follows.
- **Manifest description (2.6)**: no longer advertises "real clubs, real
  players".
- **Apple touch icon (2.6)**: a true 180x180 PNG, generated from the 512 and
  verified byte-level by shelllint.
- **Text scaling (2.3, line 18)**: a Text Size setting on the title screen
  (1x / 1.15x / 1.3x), persisted like night mode and applied as a zoom on the
  document root. `scripts/textscale.mjs` holds it: the choice renders, it
  survives a reload, and the game is playable at 1.3 - wizard to Home, no
  sideways scroll, bottom nav inside the viewport.

The text-scale probe caught two real defects on the way in, which is the point
of building one: at 1.3 the welcome dialog's close button rendered off-screen
and could not be tapped (fixed: the veil scrolls and the box centres with auto
margins), and the whole app shell painted 30% taller than the screen because
zoom scales dvh lengths (fixed: the shell's dvh heights are divided by the
zoom factor).

Still failing, unchanged and deliberate: line 1 (the real-name database - the
project owner's identity decision), line 23 (cloud saves - needs a platform
backend), line 25 (store packaging - a separate project). The economy and
regen calibration notes (2.4, 2.5) remain open as balance work, since a
lower-league budget dial has to clear the paired-seed balance harness, not a
release checklist.

---

## Owner's decision on the store question (recorded)

Asked to choose between fictionalising the world and staying a free personal
project, the owner chose: **stay the free personal project.**

What that settles:

- Checklist line 1 (the real-name database) is **closed as accepted**, not
  outstanding. The game keeps its real clubs, players and competitions, and
  the title screen keeps saying what it is: a personal project, real names
  used for fun, not for sale.
- Lines 23 and 25 (cloud saves, store packaging) are **optional** rather than
  blocking, because there is no store submission to block. They stay on the
  list as quality-of-life work, not as release gates.
- The audit's remaining value is as an internal quality bar: everything it
  measured that is not about a storefront - save integrity, long-run
  stability, permissions, layout, accessibility - still applies, and the
  remediated items were fixed on that basis rather than for a reviewer.

This report therefore stands as a quality audit, not a submission checklist.
No part of it should be read as a plan to sell the game.

---

## Correction: the regen calibration finding (2.5) was wrong

Part 2.5 of this report claimed the game's academies mint youth about 13%
stronger than "the real-world youth data they replace". Asked to flatten that
step, the measurement was redone properly and the finding does not survive.
Two separate errors produced it:

1. **There is no shipped-youth population to be hotter than.** Every
   seventeen-year-old in a fresh world is academy-generated - the senior squad
   files contain zero of them (930 academy, 0 from the lists). The "real-world
   youth data" the claim compares against does not exist.
2. **The step was the age window filling.** A season-2 under-23 cohort is all
   freshly minted seventeen-year-olds; a season-8 cohort spans 17 to 23 and
   carries six years of development. Comparing them measures growing up, not
   minting.

An age-matched, mint-fresh comparison then showed rollover intake running a
few percent above world-build intake, and that has an honest cause too:
rollover intake is weighted toward higher-reputation clubs (measured mean club
reputation of 71.3 and 73.7 at intake against a world mean of 67.3), because
better academies churn faster - they promote and sell more men, so they refill
more shirts, and `acadQuality` scales with club reputation by design.

What the original measurement got right stands: the cohort is FLAT at
equilibrium, 9.6 at season 9 against 9.4 at season 15 across nine measured
seasons. There is no compounding drift, which was the question that mattered.

**No change shipped.** A recalibration was written, measured, and reverted
once the baseline turned out to be self-referential. Checklist line 12 stands
as a pass with the note removed rather than the code altered.

---

## The owner's decision, revised (23 August 2026)

The earlier decision recorded above - stay a free personal project - has been
reversed by the owner:

> "im aware the players arent licensed but im saying we continue on"

So the game is being prepared for sale, **with the real player names in it**.
What that changes, and what it does not:

* Checklist line 1 moves from "closed as accepted (not for sale)" to **accepted
  risk on a commercial release**, which is a materially different thing and is
  set out plainly below. It is the owner's call to make and it has been made;
  this report's job is to state the exposure accurately rather than to relitigate
  it.
* Everything else in the audit becomes live again: the listing, the packaging,
  the privacy surface and the questionnaires are now real deliverables rather
  than hypothetical ones. They are done - see the addendum below.

### What the real-name database actually exposes, at today's build

The picture is much better than it was at v1.0.1, because the club, competition,
venue and sponsor marks were removed in the v1.0.3 rename and `scripts/ipprobe.mjs`
now fails the deploy if one comes back. What ships today:

* **Fictional**: every club, ground, competition and sponsor. No badges, no kits,
  no logos.
* **Real**: about 1,600 player names, with attributes, ages, nationalities and
  positions.

The remaining exposure is therefore **name and likeness**, not trademark:

* Publicity/personality rights vary by jurisdiction - strongest in the United
  States, real in France and parts of the EU, weaker but not absent in the UK
  (passing off). Commercial use raises the stakes over private use, which is
  precisely the change being made.
* Both stores' IP complaint processes are takedown-first: a listing is suspended
  on a credible report and argued about afterwards. The practical risk is not a
  lawsuit, it is losing the listing.
* The mitigations that are in place - unofficial/unaffiliated statements on the
  title screen, in the About page, in the privacy policy and in the store
  listing, no official imagery, and a named contact who will remove anybody on
  request - are the standard ones and they help. They do not make the underlying
  use licensed.

**The cheap insurance, if it is ever wanted, already exists in the code**: the
game generates names for every regen it mints (`nations.ts`), so a
fictional-name edition is a build flag rather than a project. This report
recommends keeping that option open and does not treat it as a blocker, because
the decision has been made.

---

## Remediation addendum 2 - the store release (23 August 2026)

Shipped since the last addendum, each behind a probe that runs in the suite:

* **French.** The entire game, not the chrome: every screen, the day room and
  match day included, plus the engine's rendered-at-read prose (the analyst, the
  coach's verdict, the match billing, the referee's notes). The boundary is
  written down in `docs/i18n.md` - a screen follows the reader, a save keeps the
  language it was written in - and the match commentary is English by design
  because it is written into the report the save keeps. `i18nprobe` and
  `langprobe` hold it; langprobe walks a French career to a final whistle.
* **A monetisation layer that cannot reach the network** (`docs/monetisation.md`).
  The game never talks to a store; a packaged shell attaches a bridge and the web
  build has none, so it has no purchase door and no ad frame. One non-consumable
  Supporter unlock, restorable, fails open, and touches nothing in the
  simulation. `netprobe`, `moneyprobe` and `storeprobe`.
* **The legal surface**: an About & legal page in the game carrying the build,
  the unofficial statement, the contact address and the privacy policy;
  `public/privacy.html` shipped and precached so it opens offline; the
  title-screen disclaimer rewritten for a build that is for sale.
* **The listing**: `docs/store-listing.md` has every field for both consoles in
  English and French, within its character limit, plus the Data Safety, IARC,
  Apple privacy and export-compliance answers.
* **The packaging**: `packaging/twa/` has the Bubblewrap config, the asset-links
  template and the walk-through, including the GitHub Pages asset-links trap that
  otherwise leaves an address bar across the top of the app.
* **The artwork**: `scripts/storeart.mjs` produces both stores' screenshot sizes
  in both languages, the 1024x500 feature graphic and an opaque 1024 icon.
* **The backup that leaves the phone**: the Saves screen now offers the share
  sheet where the browser can take a file, so a career can go to a cloud drive or
  a chat in two taps rather than into Downloads on the same device it is backing
  up. `backupreach` checks that what is handed over is a real save.

### Sign-off checklist, at this build

| # | Check | Verdict | Evidence |
|---|-------|---------|----------|
| 1 | IP scrub: no real club/competition/venue/sponsor marks | **PASS** | All fictional since v1.0.3; `ipprobe` fails the deploy on a regression |
| 1b | Real player names | **ACCEPTED RISK** | ~1,600 real names ship. Owner's decision, recorded above; mitigations in place, use is unlicensed |
| 2 | Real badges/logos shipped | **PASS** | Generated crests only |
| 3 | User-content isolation | **PASS** | Local files only, nothing uploads |
| 4 | Device permissions | **PASS** | None requested; `netprobe` bans the APIs outright |
| 5 | Network and data collection | **PASS** | `netprobe` sweeps every shipped file for transports, SDKs, remote fonts and absolute URLs |
| 6 | Force-close during save | **PASS** | savefuzz, cloneprobe |
| 7 | Mid-match interrupt/resume | **PASS** | resumeprobe |
| 8 | Corrupt/legacy save handling | **PASS** | migrate() + savefuzz |
| 9 | Save bloat over 15 seasons | **PASS** | releasesim |
| 10 | Long-sim stability | **PASS** | releasesim, breakit |
| 11 | Population and retirement | **PASS** | releasesim |
| 12 | Regen attribute drift | **PASS** | Flat at equilibrium; the earlier "+13%" finding was withdrawn (correction above) |
| 13 | Financial long-run balance | **PASS** (with note) | Stable equilibrium; lower-league deficits remain a balance question, not a release gate |
| 14 | Multi-resolution layout | **PASS** | devicematrix |
| 15 | Extreme aspect ratios | **PASS** | geosweep |
| 16 | Portrait QA and tap targets | **PASS** | portraitqa, tapsize |
| 17 | Notch/safe-area handling | **PASS** | env(safe-area-inset-*), devicematrix |
| 18 | Max text scaling | **PASS** | Text Size on the title screen; textscale probe |
| 19 | Orientation in the store package | **PASS** | No lock; manifest "any"; shelllint |
| 20 | Store shell branding | **PASS** | Night ground read from tokens.css by shelllint |
| 20b | Home screen icon under a launcher mask | **PASS** | Maskable icon declared in the manifest; brandprobe walks the pixels outside the guaranteed middle 80% and the corners (fixed 24 Aug: the square icon put its ring at 86.6% and would have been clipped) |
| 21 | IAP edge cases | **PASS** | All five outcomes handled including pending; restore path; moneyprobe + storeprobe |
| 22 | Ad implementation | **PASS (none shipped)** | No provider, no frame, no SDK; the slot renders nothing without a bridge |
| 23 | Cross-device state | **MITIGATED** | Still single-device by design (no backend, no accounts). Share-sheet backup, export/import, once-a-season reminder, save-failure banner. Platform cloud saves would need a wrapper feature, not a web change |
| 24 | Offline behaviour | **PASS** | Service worker; privacy policy precached with the shell |
| 25 | Store packaging exists | **CONFIGURED, NOT BUILT** | `packaging/twa/` is ready to build; it needs the owner's domain, keystore and Play account. iOS needs a wrapper project that does not exist yet |
| 26 | Store listing and questionnaires | **PASS** | `docs/store-listing.md`, both languages, within limits |
| 27 | Privacy policy reachable | **PASS** | In-game and at `/privacy.html`; storeprobe checks both |
| 28 | Languages: content as well as interface | **PASS** (added 25 Aug) | English and French complete through the inbox, the commentary, the decision history and every reply; newsprobe, commprobe, proseprobe, englishprobe and i18nprobe all at budget zero. See the addendum |

**Verdict: everything that can be done inside this repository is done.** What
remains is not code:

1. a domain (or the asset-links file in the `user.github.io` root repo), because
   a project-page URL cannot verify a TWA;
2. a Play developer account, a signing keystore backed up somewhere safe, and the
   `phase.supporter` product created and activated - or a decision to sell up
   front instead, which is `VITE_EDITION=paid` and no purchase UI at all;
3. an iOS wrapper project, if Apple is wanted: Capacitor or a bare WKWebView,
   plus the StoreKit half of the bridge (`docs/monetisation.md` has its shape);
4. the owner's eyes on the listing text and the screenshots in `storeart/`.

The one thing this report will not sign off is line 1b, because it is not an
engineering question. It is stated as accepted risk, with the cheap insurance
noted, and the decision belongs to the owner - who has made it.

### The step before all four: the work has to be on `main`

Found the hard way, 24 August 2026. The owner opened the game, looked at the
title screen and reported that there was no language choice on it - and there
was not, on the build they were looking at. Everything above had been written,
probed and pushed to a feature branch, and `.github/workflows/pages.yml`
deploys **only from `main`**. The live site was still v1.0.4: no French, no
About page, no Supporter door, no privacy policy at `/privacy.html`.

This is not a housekeeping detail, because of what a TWA is. The Play build
produced by `packaging/twa/` is a shell around the **hosted** URL - it ships no
web assets of its own. So whatever `main` has deployed is, literally, the app
Play users get, and it keeps being the app they get after every future deploy.
Uploading a TWA built against a stale site ships the stale site.

Two consequences worth keeping:

* **Merge before packaging, always.** The order is: land on `main`, wait for the
  Pages deploy, open the live URL and check the build stamp on the title screen
  reads the version you think you are shipping - *then* run Bubblewrap. The
  build stamp exists for exactly this and takes four seconds to read.
* **A green suite is not a shipped game.** Every probe in this repository runs
  against a local `npm run build`. They can all pass on a branch nobody has
  deployed, which is precisely what happened. Nothing automated can tell you
  the difference; only the live URL can.

The iOS wrapper does not share this trap, because `packaging/ios/` bundles
`dist/` on disk deliberately (see its README) - but it does share the other
half: it bundles whatever `npm run build` produced on the checkout you built
from, so build from the merged tree.

---

## Addendum, 2026-08-25: the game is in two languages, end to end

Recorded here rather than edited into the audit above, because the audit is a
measurement taken at a commit and rewriting it would destroy the thing that
makes it worth reading.

### What changed

At the time of the audit the game had a language picker, a translated shell and
a translated set of screens. What it did not have was translated CONTENT: the
inbox, the eighty minutes of match commentary, the manager's own decision
history and everything the game says back when a button is pressed were English
for every reader, in every language. The owner found it the way owners do -
switched to French, opened the inbox, and read English.

That is now finished. The mechanism is the same everywhere: a story, a
commentary line or a decision is FILED as a key plus its values and RENDERED in
the reader's language at the moment it is read. The English it was filed in is
kept beside the key and never shown, because the engine reads its own output
back - season.ts pulls a fee out of a transfer story with a regular expression -
and because a save written by an older build has to keep working for the life of
a career, which is years.

### The evidence, all at commit 57896b7

Five probes, each with a budget that may only ever fall, and all five now at
zero:

| Probe | Guards | State |
|---|---|---|
| `newsprobe` | every inbox story carries a key, in both languages | 840 story keys, budget 0 |
| `commprobe` | every commentary line carries a key | 201 commentary keys, budget 0 |
| `proseprobe` | the decision log, the touchline replies, the press, and everything else the engine says back | four counters, all 0 |
| `englishprobe` | the ENGLISH did not get worse to make the French easy | plural budget 0; the two sentences flattened once are pinned |
| `i18nprobe` | both dictionaries answer every question the code asks | pass |

`langprobe` reads a live commentary line off the screen during a French match
and fails if it finds English in it. `./scripts/suite.sh fast` is green at 114
probes.

### Two bugs this found that were not about language

* The match-day pitch mock-up decided what to draw by matching the commentary's
  wording. Four lines matched a pattern they had nothing to do with - a coach
  promising to "slow every scrum reset" drew a scrum, and three lines containing
  the word "wide" rolled the missed-kick camera over a tactical note. Events now
  carry what they depict.
* The game-time inbox story fires the moment ONE player is short of what he was
  promised, and its headline read "1 men are not getting what they were told".
  Twenty-two sentences of that kind were found and fixed; thirty-eight more were
  checked and cannot be one, each with the reason written down.

### The one line for the owner

**Sign-off row 28 - Languages: PASS.** English and French, both complete
through the content as well as the interface, guarded by the five probes above.
The store listing may declare French support without qualification.

**The version: 1.0.6.** v1.0.5 was set before this work was done, and what
landed is a content release rather than a patch - the whole inbox, the whole
commentary, the decision history, plus the pitch and plural fixes. The owner
called it as 1.0.6 on 25 August, and package.json, the TWA manifest and the
service worker cache all say so. The title screen's build stamp is defined from
package.json in vite.config.ts, so it cannot drift from it.

`appVersionCode` stays at 1, because it counts UPLOADS rather than releases and
nothing has been uploaded yet. It becomes 2 on the second thing Play receives,
even if that is this same version rebuilt.

---

### v1.0.7 - 25 August, the same afternoon

**The version: 1.0.7.** package.json, the TWA manifest and the service worker
cache all say so; `appVersionCode` still counts uploads and still reads 1.

Row 28 was signed off as PASS on the strength of five dictionary probes, and
that sign-off was true about the DICTIONARY and wrong about the GAME. What the
probes could not see, in the order it was found:

* **The Press Room was English.** All of it: 28 items, every question voicing,
  93 button labels, 95 replies, plus the discipline conversation built in
  authority.ts. proseprobe reported zero because its regex looked for field
  names media.ts does not use, so a budget of zero read as "finished". It scans
  every file that pushes onto state.press now, and prints where.
* **Nations were English.** England, Ireland, New Zealand on eleven French
  screens - a first cap, a Grand Slam eve, every Test scoreline. Translated
  now, with the three article forms French needs.
* **"objectives.youth" was on the Home screen**, in BOTH languages, because a
  field documented as an i18n key was called `text` and printed raw. It is
  `textKey`, and keyprobe fails any screen that renders one without t().
* **Nine more English phrases reached French screens through CODE** rather than
  through the dictionary - a phrase poured into a slot that otherwise holds a
  name. That rule already existed; these were the places nothing enforced it.
* **French that was fluent and named the wrong thing.** The final quarter of an
  eighty-minute match was a "quart d'heure"; the back five (shirts 4-8) was
  called "les cinq de devant", which is the TIGHT five, 1-5. Every probe passed
  on both.

Two guards were added and two were repaired. frliveprobe now derives its
English word list from the dictionaries themselves rather than a hand-written
forty, reads the press room, and answers every question on its way past: 5,772
lines from ten French careers, eight seasons each. Old careers get their press
coverage back through a migration that matches a stored English sentence
against the template that produced it.

Row 28 stands, and now it is about the game rather than the dictionary.

