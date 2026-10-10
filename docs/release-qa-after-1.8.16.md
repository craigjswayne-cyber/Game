# Release readiness after 1.8.16 (9 October 2026)

Branch `claude/rugby-game-animation-ideas-qusfd5`, starting from main at
`2aed965` (1.8.16, Play version code 55). The version numbers have not been
moved: whether these fixes ship as a new 1.8.16 upload or as 1.8.17 / code 56
depends on whether code 55 has already gone to Play (see section 7).

## 1. Confirmed issues found

| # | Issue | Evidence | Severity |
|---|---|---|---|
| 1 | Main's CI red after the 1.8.16 merge: six browser harnesses failed | CI run 37929626766 on `2aed965`: subline, drawui, storeprobe, injurygate, resilience, proprompt | Release blocker (red gate) |
| 2 | Four of those were harnesses matching copy the voice pass reworded; root cause is that browser harnesses only run on main, never on a PR | storeprobe /could not be reached/, proprompt "Thank you", drawui /travel to/, resilience clicking the "Try again" sentence instead of the button | Process gap |
| 3 | A section subtitle wrapped to two lines at the largest text size (en, es) | subline: "the more games together, the better they click" | Minor UI |
| 4 | Terminology: one headline said "the wage law", every other line "salary cap" | news.charterSubj in en, fr, es, it, af | Minor copy |
| 5 | Privacy policy did not match the apps: "two screens" of adverts (code has seven), "never during a match" (one sits under live highlights), a "Remove all ads" product that is called Pro Manager, nothing on the bug/feedback reports, referee names not covered | `AD_PLACES` in src/game/monetise.ts; MatchDay.tsx `match-foot` | High (legal accuracy) |
| 6 | Store papers still carried "No ads / Data Not Collected" answers for Play and Apple | docs/store-listing.md, APP-STORE-WALKTHROUGH step 17 | High if copied into a console |
| 7 | iOS walkthrough step 17b ran a bare `cap sync`, which strips the advert bridge: an archive built that way has no adverts (the owner hit exactly this today) | install-ads.mjs writes into the synced page; cap sync overwrites it | High (lost revenue, silent) |
| 8 | iOS walkthrough 17d said iPhone only; the scaffold builds iPhone and iPad | packaging/ios/scaffold.sh | Medium (screenshots requirement) |
| 9 | Contract years printed with a thousands separator: "until 2,029" | {until} not exempt like {year} | Minor copy, every transfer story |
| 10 | "1 minutes" in the fastest-knockout-try record | news.koFastest | Minor copy |
| 11 | "The class of 1 is confirmed" in the Hall of Fame story (season counter, not a year) | rollover.ts | Minor copy |
| 12 | Japanese years without 年 ("2029まで"), and three plural-agreement/word-order slips in fr/es/it | ja.json, fr/es/it backInTraining, fr bossTight | Minor copy |
| 13 | Uncontested scrums: commentary went on describing shoves, wheels, resets, scrum penalties and "the scrum will creak" | sampled match, Bath at Saracens | Medium (credibility) |
| 14 | Front-row cover: 160 of 8,628 club team sheets and 173 of 432 Test team sheets (40%) could not cover the front row at kick-off, so uncontested scrums in a third of Tests | counted at kick-off over three seasons; clubs left fit academy props at home, federations picked by rating alone | Medium (realism, both sides lose the scrum) |
| 15 | From the owner's screenshots: the throw after a penalty kicked to touch could be given to the other side; a fly-half "powers over off the back of the maul"; long team names ran into "LIVE STATS"; the injury prompt said "Name his replacement" when the cover had already gone on | screenshots 9 Oct | Minor-medium |
| 16 | **Board patience: on 1.8.16 an engaged manager at a big club is treated the same as one who never opens a screen** | autopilotprobe on `2aed965`: Bath 36 seeds, crisis 10 v 11, min confidence 34.1 v 34.4, sacked 3 v 3. Three of its assertions fail. The probe is in the slow set and has not run in CI | **Open, needs a decision** |
| 17 | The engaged-manager edge in points has narrowed to about 5 a season (54 worlds: 5.2 on 1.8.16, 3.1 here, standard error about 1.7 each, so the two are not distinguishable) against 9-11 at 1.8.0. The probe's bar is 5 | autopilotprobe | Open, tied to 16 |

## 2. Fixes implemented and regression tests added

Commits on the branch, in order: `e6b3e89`, `a17947b`, `b247eb7`, `4996a40`, `0d02930`.

- Harness drift (1, 2): storeprobe, proprompt, drawui and resilience match the
  current wording or the element itself; reloadprobe follows the new injury note.
- Copy (3, 4, 9-12): fixed in every affected language.
- Privacy and store papers (5-8): `public/privacy.html` (dated 9 October 2026,
  **needs the owner's approval before it is deployed**), store-listing.md,
  APP-STORE-WALKTHROUGH.md (17, 17b, 17d, upload step), STORE-DECLARATIONS.md
  (1.8.16, code 55, seven banner places, the iOS archive check).
- Uncontested scrums (13): scrum contest lines, scrum offences, early-engagement
  free kicks and the makeshift-prop line are skipped while the scrums are
  uncontested. Commentary stream only.
- Front-row cover (14): `autoSelect` brings in the best fit front-rower,
  academy included, for a bench man the cover does not need; AI Test squads
  carry three per front-row position where the pool allows (`withFrontRow`).
  Club shortages 160 -> 23, Test 173 -> 14.
- Screenshot items (15): the kicker keeps the throw; try lines are matched to
  the scorer's position after the draw; the live-stats title has its own row;
  the injury note says the cover is on and can be changed.
- New probes: `scripts/newsrenderprobe.ts` (a season of stories rendered in
  six languages: no unfilled placeholder, no undefined, no split year, no
  "1 minutes"); `scripts/frontrowsquadprobe.ts` (club auto-pick and Test
  squads cover the front row).
- `refprobe`: the "> 0.2% of matches are uncontested" floor measured bug 14
  and is removed; the rule's wiring is still forced and checked above it.

No fix moved the main simulation stream: the fingerprint is unchanged at every
step. The front-row change moves line-ups, so the world was re-measured:

| bandcheck, 8 worlds, 8,136 games | 1.8.16 | branch | band |
|---|---|---|---|
| points a game | 49.8 | 49.7 | 48-53 |
| tries a game | 6.51 | 6.49 | 6.0-6.6 |
| home wins | 53.8% | 54.0% | 51-57 |
| draws | 1.8% | 1.8% | 1.3-3.0 |
| blowouts | 9.0% | 8.8% | under 11 |

## 3. Test results

- Engine probes, CI (8 shards): `2aed965` green; `b247eb7` green; `4996a40`
  green except refprobe (item above, fixed in `0d02930`). `0d02930` running at
  the time of writing.
- Browser harnesses, local, full list on `a17947b`: 77 pass, 1 fail (tryflash,
  timed out waiting for a try; passes on rerun on `4996a40`). The six that
  failed on main pass. injurygate: 4 of 4 local passes; failed once on CI, so
  intermittent.
- Slow probes (not in CI), on the branch: releasesim 15 seasons PASS;
  soakhealth 20 seasons PASS (0 prose violations, 0 integrity faults);
  distressprobe PASS; deepsave PASS; autopilotprobe FAIL 2 (items 16-17;
  1.8.16 itself fails 3).
- Copy and language: voiceprobe, textlint, i18nprobe, langparity, frenchprobe,
  genderprobe, newsprobe, landingprobe, newsrenderprobe: all pass.
- Intermittent: injurygate (CI), tryflash (local, timing), nightcontrast
  (1.8.15 nightly, live scoreboard contrast 1.7 once; not reproduced).
- Not run this round: dialweight, stresstest, aiecon, stackprobe, optionsprobe
  (slow set) and the browser harnesses on the final commit.

## 4. Performance

Fresh-week mean over a season, interleaved runs on one quiet machine:

| build | ms (6 runs) |
|---|---|
| 1.8.15 `aa0ae85` | 160.1 / 161.5 |
| 1.8.16 before its speed fix `bc76370` | 179.8 |
| 1.8.16 `2aed965` | 163.5 / 162.4 |
| branch head | 163.7 |

The 245 ms reading was container load (the measurement ran beside a four-shard
suite). The real 1.8.16 regression was 12% and its own fix took it back; the
budget is 200 ms.

## 5. Store, privacy, rights, device QA

Verified from the repository: advert SDK and placements, consent (UMP) and ATT,
purchases (Play Billing, StoreKit), on-device data, the shipped privacy text,
the declarations checklist. Not verifiable from here, and not marked done:

- Play Console and App Store Connect answers (STORE-DECLARATIONS.md boxes).
- Privacy policy approval and deployment (it deploys with the next merge to main).
- Written Ruck permission: still verbal only (LAUNCH-PROGRAMME B7).
- Content-rights answer for real player and referee names: owner's decision.
- Device QA on the exact production builds: not done here. The owner's
  screenshots on 9 October show 1.8.15 wording, so that device is on an older
  build. An iOS archive made with a bare `cap sync` has no adverts.
- Asset dimensions and screenshots: not re-checked this round.

## 6. Remaining blockers and accepted risks

- **Board patience (16).** Engagement does not protect a manager at a big club
  on 1.8.16. This is a balance change in the board's judgement, not a bug fix,
  and needs the owner's call on how hard the board should be. Options: ship as
  1.8.16 plays now and fix next round; or a measured re-tune of the board's
  weighting of form against expectation, held by autopilotprobe, before release.
- **Process (2).** Run `scripts/suite.sh browser` before merging any change to
  `src/locales`, or let the browser job run on PRs that touch it.
- Minor known issue: French "la {comp}" does not elide or agree in gender for
  every competition ("la Elite 14").
- Intermittent harnesses as listed in section 3.

## 7. Recommendation

**NO-GO for a production store release today; GO for the website and an
internal-testing build.**

The code on this branch is in better shape than 1.8.16 on every measured
count, and nothing here is a crash or data-loss risk. What stops a production
release is outside the code: the privacy policy needs approval and deployment,
the console declarations need setting to the advert answers, device QA on the
exact builds has not happened, and Ruck's permission is not in writing. The
board-patience finding (16) is a design question to answer before or after
release, not a blocker on its own.

To reach GO: approve and merge this branch (privacy page deploys with it),
decide 1.8.16/code 55 versus 1.8.17/code 56, build both apps from the merge
with `./scaffold.sh` last, run the device checklist in PLAY-WALKTHROUGH step 9
and the TestFlight equivalent, tick STORE-DECLARATIONS, file the Ruck email.
