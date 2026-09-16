# PHASE: Rugby Manager, Final QA Fix and Runtime Release Report (v1.6.5)

Target 1.6.5, Play version code 34, branch `claude/rugby-manager-final-qa-8hbhrl`.
Brief: "PHASE Final QA Fix & Runtime Brief" (owner, 16 September 2026).
Tested commit: aceb07f. Node v22.22.2. Every result below is from a run on this tree; anything not run is listed in section 9 as NOT EXECUTED.

## 1. Verdict

**RELEASE.** Every mandatory fix in the brief is applied and re-proved by a probe that failed on the old code, the two false-green gates are closed and the suite reports a machine-readable result, and the post-fix runtime matrix (15 seasons on three seeds in both worlds, 10,000 detailed matches, the full engine and browser suites) is green on the shipping build. The one item the brief asked for that this release does not do is pausing the men's leagues for the World Championship, which does not fit a 48-week year with a 26-round Top 14 and is recorded as the owner's decision, not a defect.

## 2. Scores out of 10

| Area | 1.6.5 | What would move it to 10 |
|---|---|---|
| Gameplay stability | 9 | A playtest on real devices; nothing in this session ran on a phone |
| Simulation integrity | 9 | The real Super Rugby Pacific and Champions Cup formats (owner: unchanged) |
| Data integrity | 9 | Every real player and club placement verified against a source (about 80 men and 26 women were) |
| Save integrity | 9 | A corpus of saves from every shipped version loaded and settled through a season |
| Long-term stability | 9 | The 50-season soaks (`soakhealth`, `stresstest`), not run in this session |
| UI/UX | 8 | Finances (3.3 screenfuls) and the game plan (3.0) brought under two on a phone; a device run |
| Performance | 8 | The match screen's per-line resume write replaced by an incremental patch; the 8.8 MB save pruned |
| Rugby authenticity | 9 | The owner's decision on the 20-minute red card (RED-CARD-01) and the men's World Cup overlay |
| Content and data accuracy | 8 | Full-roster verification; ages for the women's Élite 1 and Pacific rows are inferred |
| Exploit resistance | 9 | A systematic out-of-order action fuzzer over every user action, beyond the eight hand-written exploit probes |
| **Overall** | **9** | The device run and the second reviewer |

## 3. Bug register

Severity: P0 crash or data loss, P1 integrity of the game as shipped, P2 wrong behaviour with a workaround, P3 rare or cosmetic, P4 nit. Every row was reproduced on the tree before the fix and re-run after it.

| ID | Sev | System | Bug | Reproduction | Expected | Actual | Root cause | Fix | Regression test |
|---|---|---|---|---|---|---|---|---|---|
| CAL-01 | P1 | Calendar | Women's World Championship pools landed on league rounds 4, 6 and 7; Southern Four camp (39-42) covered the league playoffs, so Pacific clubs' semi-finals lost every New Zealander and Australian | `scripts/qa2/caldump.ts w 0,3` on 1.6.4 | Domestic and Test fixtures apart | wc:8 on the same rows as w:pwr/w:pac at weeks 4, 6, 7; w:p4 at 40-42 with playoffs at 40/42/43 | Weeks chosen per competition by eye (schedule.ts constants), no shared model | `src/game/calendar.ts`: one table for both worlds; women's leagues on an explicit 18-week list that pauses for every window; WC weeks 1-6; Southern Four 46-48 after the finals, skipped in a tour year | `scripts/calinvariant.ts` (suite gate), `scripts/qa2/matrix.ts` |
| CAL-02 | P1 | Calendar | Women's Hemispheric Championship semi-final (31) and final (34) inside the Northern Championship camp (31-38): the manager's final without her internationals. Introduced by the 1.6.3 QA-01 fix, which only checked league weekends | schedule.ts header on 1.6.4 v `activeWindows` | Knockout ties outside every Test window | Both inside | Two systems assigned weeks independently | Knockouts at 28, 37, 38; Northern Championship rounds 32-36; invariant rule 1 | `scripts/calinvariant.ts` |
| CAL-03 | P1 | Calendar | Men's summer camps (summer Tests and the Isles tour) opened in week 43, the finals week: every finalist's internationals left the week before the final. Same for the women's summer Tests | `activeWindows` (season.ts) computed start as first fixture week minus one; summer fixtures start at 44 | Squads leave after the finals | Called up before them | The camp-week convention applied to the summer | Explicit spans in calendar.ts; summer windows have no camp week | `scripts/calinvariant.ts` rule 1 on the finals |
| CAL-04 | P2 | Calendar | Relegation playoff in week 44, inside the summer camp: both clubs played for their status without their internationals | Same as CAL-03 | Full-strength playoff | Camp week | Week chosen after the finals without a window check | Championship semi-finals to 40, final to 42, relegation playoff on finals day (43), `BARRAGE_WEEK` | `scripts/barrageprobe.ts`, `calinvariant.ts` |
| CAL-05 | P2 | Calendar | With the Championship semi-finals first moved to 41, a Championship club in the Shield final was drawn twice in week 41 (Exeter, Coventry, Richmond on three seeds) | `scripts/qa2/matrix.ts` on the interim tree | One fixture a week | Two | Two competitions sharing clubs with overlapping knockout weeks | Semi-finals to 40; invariant rule 7: competitions that share a club never share a knockout week (structural, seed-free) | `scripts/calinvariant.ts` |
| QA-GATE-01 | P1 | QA | Seven browser harnesses caught a failure and then `process.exit(0)` in `finally`; `e2enight` was genuinely failing (waiting for "Commissioned Search", a heading renamed "Scouting") and reporting green; `scrollaudit` printed WARN for a page three screenfuls deep and exited 0 | `node scripts/e2enight.mjs; echo $?` on 1.6.4 | Non-zero on failure | 0 | Cleanup overwrote the status | Failure and console errors set `process.exitCode`; `finally` exits with it; the stale locator fixed; scrollaudit fails on any new deep page or either known one reaching four | The harnesses themselves |
| QA-GATE-02 | P1 | QA | `simtest.ts` never exited non-zero: a stolen user fixture, a duplicate club id or a squad below a team sheet printed and returned 0 | `npx vite-node scripts/simtest.ts` | Non-zero | 0 | No exit code | Every invariant counts; exit code is the count; the data floor is 23 | Itself |
| SAVE-01 | P2 | Save | `s.shortlist ??= []` and twelve other list fields, plus three club lists, repaired null only; a string or object survived and threw on the first push | Craft a save with `"shortlist": "x"`, load | Array | Throw | `??=` | `list()` gate: anything not an array becomes an empty array | `scripts/qa/edge.ts` (existing), `migrate` |
| TRANSFER-01 | P2 | Transfers | `executeTransfer` removed the player from the seller and banked the fee before reading the destination; an unknown club id left the seller paid and the player nowhere | Call with a bad `toClubId` | Refused | Partial transaction | Destination read after the mutation | `if (!to \|\| to === from) return` before anything moves | `scripts/qa/p4_offers.ts` |
| TOUR-01 | P2 | Isles tour | season.ts 2165 and 3154 handed any home-union national coach the Isles fixture as "mine" on `natTeam` alone; a coach who declined the tour, or was never offered it, controlled the Test | Coach England, decline the tour, reach week 46 | The assistant's match | Yours | `['ENG','IRE','SCO','WAL'].includes(natTeam)` instead of `islesCoach(state)` | `islesCoach(state)` at both sites (line 705 already had it) | `scripts/tourprobe.ts` |
| AWARD-01 | P3 | Awards | A League games incremented `stats.apps` with no rating: an academy scholar reached the annual shortlists on 8 or 15 "appearances", and any senior who had played A League games had his season average diluted (rating sum unchanged, apps up) | `scripts/acadprobe.ts` apps line; rollover.ts 97, 156 | Senior stats are senior games | Mixed | `p.stats.apps++` in academy.ts | `stats.acadApps`, kept apart; the Academy screen shows both | `scripts/acadprobe.ts` |
| CAP-01 | P3 | Salary cap | The trim floor `club.players.length <= 30` counted the academy (27 strong), so it never fired; the only brake was three releases a summer. The brief's reading (it "can prevent trimming while over cap") was the opposite of the measured behaviour | cap.ts 222 | Floor on the senior squad | No floor | Wrong population | `seniorCount <= CAP_FLOOR (23)` on the men the bill counts | `scripts/capprobe.ts` (existing) |
| CAP-LOAN-01 | P3 | Salary cap | Trimming could release a player out on loan, who is off the bill already: nothing saved, one of the three releases spent, a man released while at another club | cap.ts 220 filter | Loanees excluded | Included | `!p.loanFrom` only | `!p.onLoan` too | `scripts/capprobe.ts` |
| DET-01 | P3 | Save | A reload changed the simulation in two ways: migrate repriced every academy scholar from his current ability (a lad whose ability had grown came back £50 a week dearer), and the name registry, cached on the live state, was rebuilt on load from the players only, so the names of retired men and of players named but not yet born (the week-30 intake class, a scout's finds) were free again and the next regen drew differently from the same seed | `scripts/qa/determinism.ts 60 777 {json,migrate}`: wages at step 1, a different regen at the first rollover | Reload is identity | Differences at steps 1 and 47 | `migrate` ran `playerWage` unconditionally; `nameRegistry` (nations.ts) kept names in a WeakMap the save never saw | Reprice only a wage outside the development band; `retiredNames` and `takenNames` in the save, the registry rebuilt from both | `scripts/qa/determinism.ts` (each career on its own id counter) |
| ECON-01 | P2 | Economy | The rollover minted the summer's academy recruits (the top-up, `academy.ts`) on first-team wages, £1,600 to £3,550 a week, and only a reload repriced them to £400 to £550: every club paid its new scholars a senior wage for a season in a running game and not in a reloaded one | `scripts/qa/determinism.ts 60 777 migrate` after DET-01: wages of the new intake differ at the first rollover | Scholars on development deals from the day they arrive | A season on senior money | `repriceAcademies` ran at newGame and in `migrate`, never at the rollover | The same sweep at the end of the rollover | `scripts/qa/determinism.ts` migrate mode |
| FR-01 | P3 | Friendlies | The midweek development friendly stood the first XV down and auto-picked from everyone else, and the auto-pick takes seniors before scholars, so the side the fixture exists for was the senior bench; the probe that claimed "the academy played" was counting the A League's appearance bump in the same week | `scripts/friendlyprobe.ts` on 1.6.4 with the A League count removed: man of the match a senior every time, 0 scholars stamped with the friendly's week | The academy XV | The reserves | `withDevelopmentSide` (season.ts) handed `autoSelect` the whole squad minus the XV | Scholars fill the sheet, senior reserves only make up the numbers below eighteen | `scripts/friendlyprobe.ts`: fifteen or more scholars carry the friendly's week stamp (16 on the probe seed) |
| SHEET-01 | P3 | Selection | A team sheet with the same player in two shirts passed every check in `lineupFor` and reached the pitch; `frontRowCover` counted him twice | `scripts/qa/banned.ts` | One man, one shirt | Duplicate survives | No duplicate check | Second shirt emptied, tidy-up fills it | `scripts/qa/banned.ts` |
| RED-CARD-01 | n/a | Laws | The engine sends a red-carded player off for good (matchEngine.ts 2708-2716, `side.sent`). The elite game plays the 20-minute red card under a World Rugby global law trial since 1 July 2025, with a decision on permanent adoption due in 2026 | Code read | Owner's decision | Permanent | Design predates the trial | Not changed, as the brief instructs. If adopted: after 20 minutes a replacement comes on for a non-deliberate red; deliberate stays permanent | To write with the decision |
| DECISION | n/a | Pyramid | Premiership relegation restored: `RELEGATES` is `['prem','champ','top14']` again, the relegation playoff and the pyramid swap follow it. 1.6.3 had ringfenced it on the real-world announcement; the brief says relegation is intentional design | | | | | model.ts 2033 | `scripts/barrageprobe.ts`, `scripts/pyramidprobe.ts` restored |

The men's World Championship (brief section 4) is internally coherent and is now checked by the invariant: 20 nations in four pools of five, five pool weeks, eight qualifiers, three knockout weeks, a complete 4 + 2 + 1 bracket and a recorded champion on every seed; no other international competition inside it; every fixture two valid teams; no nation twice in a week. The one bullet not met is "no domestic club fixtures should collide with the World Cup window": see section 6.

## 4. Data and factual errors

| Item | Finding | Source |
|---|---|---|
| Women's leagues and the Six Nations | The real PWR pauses for the Women's Six Nations (2025: 22 March to 27 April, PWR back on 30/31 May), which is what the women's calendar now does | [PWR fixtures 2025-26](https://www.ruck.co.uk/premiership-womens-rugby-fixtures-confirmed-for-2025-26-season-start-date-announced/), [2025 Women's Six Nations](https://en.wikipedia.org/wiki/2025_Women's_Six_Nations_Championship) |
| Men's leagues and the World Cup | The Top 14 2023-24 opened on 18 August 2023, three weeks before the World Cup; the Premiership opened on 13 October, inside it. The men's overlay in the game is the real calendar | [2023-24 Top 14](https://en.wikipedia.org/wiki/2023%E2%80%9324_Top_14_season), [2023-24 Premiership](https://en.wikipedia.org/wiki/2023%E2%80%9324_Premiership_Rugby) |
| 20-minute red card | Global law trial in all elite competitions from 1 July 2025; permanent adoption to be decided in 2026 | [World Rugby, 21 May 2025](https://www.world.rugby/news/1000186/world-rugby-council-moves-20-minute-red-card-to-global-law-trial), [World Rugby Passport](https://passport.world.rugby/laws-of-the-game/whats-new/2025-07-global-law-trial-20-minute-red-card-replacement/) |
| Premiership relegation | Owner's decision overrides the real-world ringfence recorded in the 1.6.2 audit | Brief, section 2 |

## 5. Leads not reproduced

- **CAP-01 as stated.** The brief says the 30-player condition "can prevent further trimming while still over cap". Measured: it never prevented anything, because the academy pushes every squad past 30. Fixed on the correct reading.
- **The injection carry at 18%** (`scripts/qa/p5_inject.ts`, Leicester buying at week 2). Not a sweep: the manager was sacked before the rollover (`unemployed true`), and the carry belongs to an employed manager. The cash stays in the club's balance, unswept. The probe now prints the employment so the line cannot mislead again.
- **Uncontested-scrum commentary in one match in four** (`engine10k`: 2,534 lines in 10,000 matches). A balance observation on front-row cover, not a rule failure: every side had legal cover or the engine said so. Left for tuning.
- **Persona A and B diverge on 9 of 25 results** (`scripts/qa/persona.ts`). They are different managers taking different decisions; the seed is shared, the inputs are not.

## 6. The five most dangerous remaining issues

1. **The men's leagues play through the World Championship** (design). The brief asked for no domestic fixtures in the window. A 26-round Top 14 uses 26 of the 28 league weeks; the eight the tournament takes cannot be found without a shorter league or a longer year. Both are the owner's call; the invariant records the overlay as allowed for the men's leagues only, and everything else (cups, knockouts, the women's leagues) is protected.
2. **The red card law** (RED-CARD-01). A product decision; the engine's permanent red is a defensible reading until the 2026 council decision.
3. **No physical device run.** Every browser result is headless Chromium at phone geometry (412x915 for the soak, the `devicematrix` set for layout). Touch, throttled CPUs and real keyboards are untested.
4. **Two dense pages** (finances 3.3 screenfuls, the game plan 3.0 on a 390-pixel phone). Carried as known debt in `scrollaudit`; a third would now fail the gate.
5. **Save size** reaches 8.8 MB by season 15 (stringify 120 ms) and the mid-match resume write still clones it once per revealed line.

## 7. Bug dependency map

- One calendar (`calendar.ts`) unblocks CAL-01 to CAL-05 together: every week comes from one table, so fixing one collision cannot create another unseen, and the invariant fails the suite if it does.
- CAL-04 depended on CAL-03: the relegation playoff could only move to finals day once the summer camps no longer opened on finals day.
- CAL-05 was created by CAL-04's first attempt and caught by the matrix; rule 7 of the invariant now catches the class.
- QA-GATE-01 hid a real failure (`e2enight`) for at least two releases; every browser claim in the 1.6.3 and 1.6.4 reports rested on it. Fixing the gate exposed and fixed the locator.
- DET-01 was masked until 1.6.4 moved the id counter into the save (QA-10): the probe's two careers then shared one process-wide counter, and the probe had to give each its own before the wage reprice was visible.
- AWARD-01 and the earlier Player-of-the-Month fix (season.ts 2989) are the same root: A League games in the senior count. The annual awards and the world award were the two readers left.
- ECON-01 was found by DET-01's probe once the wage reprice on load was narrowed: the reload had been hiding the rollover's senior-wage intake. FR-01 was found by AWARD-01: once A League games stopped counting as appearances, the friendly probe's proof that "the academy played" collapsed, and the fixture turned out to field the bench.
- Three probes and one soak encoded the old behaviour and failed on the fixed tree before being brought up to date (`friendlyprobe`, `insolvprobe`, `sheetprobe`, `wsoak`): each failure was traced to a 1.6.5 change doing what it should (a full-strength final winning a title, a duplicated shirt emptied, the Southern Four standing down).

## 8. Top 10 fixes, completed and remaining

Completed in 1.6.5: (1) one calendar with a hard invariant, both worlds, every season type; (2) women's leagues pause for Tests and the World Championship; (3) summer camps after the finals; (4) relegation playoff on finals day; (5) seven browser gates and simtest fail on failure, suite prints `SUITE-SUMMARY`; (6) list fields healed on load; (7) transfer destination validated first; (8) Isles ownership on `islesCoach`; (9) academy appearances kept apart; (10) cap floor on seniors, loanees excluded, reload keeps academy wages and the name registry, the rollover's scholars on development deals, duplicate shirts emptied, the development friendly fields the academy.

Remaining, in order: (1) owner's decision on the men's World Cup overlay; (2) owner's decision on the 20-minute red card; (3) real-device run; (4) finances and game plan density; (5) match-screen resume write as an incremental patch; (6) Super Rugby Pacific and Champions Cup real formats; (7) full-roster fact check; (8) 50-season soaks in CI on a schedule; (9) an out-of-order action fuzzer; (10) unused exports (65 exported names in `src/game` that nothing imports, listed in the run log; harmless, and each one is a maintenance question).

## 9. What was executed, and what was not

Commands, on commit aceb07f, Node v22.22.2:

| Group | Command | Result | Duration |
|---|---|---|---|
| Typecheck, prose, tokens and every engine probe (179 gates: `calinvariant` new, four reporters and seven soaks skipped by name) | `./scripts/suite.sh fast` on aceb07f | PASS 179 of 179, `SUITE-SUMMARY {"result":"PASS","passed":179,"failed":0}` | 45 min 40 s |
| The full suite, engine and browser, on the tree before the last two engine commits (f40a16b plus probes) | `./scripts/suite.sh` | 232 of 236: browser 57 of 57; four engine probes failed (`friendlyprobe`, `insolvprobe`, `sheetprobe`, `wsoak`), each a probe reading the old behaviour (FR-01, CAL-03's full-strength final, SHEET-01, the Southern Four's tour year), fixed and re-passed, then the clean 179 of 179 above | 65 min 45 s |
| Build and every browser harness again on aceb07f | `npm run build`, then each of the 57 `scripts/*.mjs` gates | {{BROWSER}} | {{BROWSER_T}} |
| Calendar invariant, both worlds, ordinary, World Championship and tour years, two seeds, every week | `npx vite-node scripts/calinvariant.ts` | PASS, 0 violations, complete brackets on every World Championship | 2 min |
| Runtime matrix: 15 seasons x 3 seeds x both worlds, every invariant every season, checkpoints 1/3/5/10/15 with a JSON round trip | `npx vite-node scripts/qa2/matrix.ts` | PASS: men 49-55 s per 15 seasons, women 27-31 s; save 6.4 MB at season 1, 8.0 MB at season 10; slowest week 302 ms | 4 min |
| 10,000 detailed matches | `npx vite-node scripts/qa2/engine10k.ts` | PASS: mean 54.1 points (sd 17), 6.22 tries, 0.673 yellow, 0.029 red, 1.09 injuries, 19.4 subs, HIA 0.277 per match (1,600 passed, 1,103 failed), 0 walkovers, whistle line equals the record in all 10,000, no unavailable player in any event | 40 s |
| Determinism across reload, 60 weeks, plain JSON and migrate | `npx vite-node scripts/qa/determinism.ts 60 777 {json,migrate}` | DETERMINISTIC over 60 weeks in both modes, through the first rollover (after DET-01 and ECON-01) | 6 min |
| Release simulation, 15 seasons | `npx vite-node scripts/releasesim.ts` | PASS, every band held: 90+ players 23 to 85, 85+ 142 to 284, top-to-bottom best-XV gap 32.7 to 17.9, 79 administrations, league-wide money on a human scale | |
| Economy and exploits | `scripts/qa/{exploit,p1_treasury,p2_renew,p3_loans,p4_offers,p5_inject}.ts` | As 1.6.3: one renewal a season, marquee slot freed, release-then-sell void, no double charge, injection carried when employed | 4 min |
| Personas | `scripts/qa/persona.ts` (stranger and devotee through the store), `scripts/qa/unemployed.ts` (sacked, a full season without a club, hired by Colomiers, a season there) | PASS | 3 min |
| Performance | `scripts/qa/timing.ts` (15 seasons) | 3.4 to 4.0 s a season at seasons 12-15, slowest week 364 ms, stringify 120 ms for 8.76 MB | 1 min |
| UI soak, one season on one page with the JS heap read | `SOAK_SEASONS=1 node scripts/soakui.mjs` | PASS: 757 interactions, 27 matches, 261 bulletins, 42 screen visits, 933 audits, one mid-season reload; JS heap 10.0 MB at start, 19.0 MB at the end of the season, 37.3 MB on the save screen after the reload | |
| Deep walkthrough | `node scripts/e2edeep.mjs` | {{E2EDEEP}} | |
| Static | `tsc`, `textlint`, `i18nprobe`, `newsprobe`, `keyscreen`; TODO/FIXME scan: 0; unused exports: 65 | PASS | |

Not executed:

- No physical device. Every browser harness ran on headless Chromium; the geometries are the harnesses' own (412x915 for the soak, the `devicematrix` device set, `textscale` at the OS large-text setting), not exactly the brief's 360x740 and 390x844.
- No live billing bridge (`storeprobe` injects a fake one).
- The 50-season soaks (`soakhealth`, `stresstest`, `deepsave`): the matrix stops at 15 seasons, as the brief specifies.
- "2,000 random taps": the UI soak is a hostile playthrough (about 550 interactions a season, every one audited), not a random tap generator.
- Memory after exactly ten matches: measured as the JS heap at the start and end of a season on one page (soak), not at the tenth match.
- WXV: not in this release, per the brief.

## 10. Comparison with docs/release-audit-v1.6.2.md, read last

Bugs this pass found that the 1.6.2 audit did not: CAL-02 (the audit's own QA-01 fix created it), CAL-03, CAL-04, CAL-05, QA-GATE-01 (the audit reported "browser 57 of 57" on a gate that could not fail), QA-GATE-02, SAVE-01, TRANSFER-01, TOUR-01, AWARD-01 (the audit saw the Player-of-the-Month half), CAP-01, CAP-LOAN-01, SHEET-01, ECON-01, FR-01, and the name-registry half of DET-01.

Old findings not reproduced on 1.6.5: none of the register's fixed items regressed; the five 1.6.2 P1s all re-pass their probes. QA-10's three parts are now all closed: the id counter (1.6.4), academy wages (DET-01), and the stadium rename did not appear in a 60-week reload diff.

Score disagreements of two or more points: none against the 1.6.4 scores. The 1.6.2 audit gave exploit resistance 5 and overall 6; both moved with the fixes rather than the scoring.

One correction to the 1.6.3 table in that document: its "Data" row records the Premiership ringfence as a data correction. It is reversed here on the owner's decision.
