# Commercial Release Readiness Report - v1.0.1

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
