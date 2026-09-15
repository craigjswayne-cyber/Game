# PHASE: Rugby Manager, Final Pre-Release QA (v1.6.2)

## 1.6.3: what was fixed, and how it was proved

Every register item and every data row below was addressed in 1.6.3, in the same branch, and re-proved with the probe that found it.

| ID | Fix | Proof |
|---|---|---|
| QA-01 | `W_CC_KO_WEEKS` moved to 26, 28, 31 (schedule.ts) | `scripts/qa/wclash.ts`: 0 double weeks, 0 stolen ties at four clubs; new suite probe `scripts/wclashprobe.ts` holds it for both worlds |
| QA-02 | Growth phase two is a coin toss for one point; decline starts at 29; heirs of retiring stars are rarer (82+, 60%) and born 0-12 below the man they replace; academy potential is capped by club reputation (`acadCeiling`, academy.ts); AI wonderkids one in fifty and capped near that ceiling; young players' headroom trimmed (attributes.ts); a club short of seniors picks a free agent of its own standing; AI buys of unhappy or listed players gated to `ca <= rep + 12` | `scripts/qa/worlddrift.ts` seed 777, ten seasons: 90+ players 20 to 66 (was 206), 85+ 92 to 215 (was 515), Premiership-to-National One best-XV gap 34 to 18 (was 6); women's world 90+ 2 to 22 (was 150). Three new bands in `releasesim` hold it |
| QA-03 | `releaseToBudget` raises the allowance and leaves the balance alone; what can be released is the cash the allowance does not already cover | `scripts/qa/p1_treasury.ts`: extra cash gone £0 |
| QA-04 | Injected cash is excluded from the summer sweep and carried into next season's transfer budget | `scripts/qa/p5_inject.ts`: 100% of the injection spendable next season, no sweep |
| QA-05 | The resume record carries `seed` and `saveName`; `resumeFits` requires both; `start()` and `setGame()` clear the record | `scripts/qa/crossrec.ts`: `resumeFits=false` for every other career |
| QA-06 | One accepted renewal per player per season (`renewedSeason`) | `scripts/qa/exploit.ts`: 12 of 96 accepted, morale 7.0 to 8.0 |
| QA-07 | Departed players drop out of `club.marquee` on sale, release and retirement, and the slot count reads the roster | `scripts/qa/exploit.ts`: slots left 2 after the sale |
| QA-08 | Release voids pending bids; `respondToOffer` refuses a player who is no longer yours | `scripts/qa/exploit.ts`: "Offer no longer available", bidder pays nothing |
| QA-09 | The pre-match state is written once under its own key at kick-off; every later write is the short record | save.ts `putResume(slot, rec, withPre)`; `resumeprobe`, `reloadprobe`, `savequeue` green |
| QA-11 | `addWeeks100` and `weeksBetween100` (model.ts) do the arithmetic in real weeks at every duration site; `courtedAt` no longer rebased by migrate | `scripts/qa/basis100.ts`: courting match true |
| QA-12 | Wins before points difference in `sortTable` | calendar probe |
| QA-13 | `roundRobin` balances venues (spread of one for an even field) | `scripts/qa/urcsplit.ts`; fingerprint rebaselined after `bandcheck` held every band |
| QA-14 | The whistle line and the full-time line take the score the pending kick left | `scripts/qa/whistle.ts`: 0 of 22 wrong, 0 of 27 wrong |
| QA-15 | A player out on loan is recalled before he is sold | `scripts/qa/p3_loans.ts` |
| QA-16 | 46 seniors is the registration limit for the user's signings too (`squadFull`) | `scripts/qa/p4_offers.ts` |
| QA-17 | Bourdon Sansus 30 and 88 with the international flag, Feleu 26 and 84, Sorensen-McGee 20, Brunt 23, Holmes 27, Tukuafu 30, Georgia Evans WAL | data rows corrected |
| QA-18 | `fmtMoney` prints a dash for a non-finite figure; `fmtWage` picks the unit after rounding | `scripts/qa/p8_fmt.ts` |
| QA-19 | A try under the posts is never followed by a touchline conversion | `scripts/qa/whistle.ts` |
| QA-21 | `makeSubstitution` refuses a man not on the bench, suspended, or away with his country | `scripts/qa/banned.ts`: 0 of 40 |
| Data | `RELEGATES` drops `prem`: the English top flight is ringfenced, no relegation playoff is scheduled and the pyramid swap skips it | rollover.ts, season.ts |
| Not changed | QA-10 (module-level id counter; no reuse was ever observed), QA-20 (a forfeit rule; unreachable above the 18-senior veto), the format simplifications (URC, Super Rugby Pacific, Champions Cup), the four suspected club placements, the women's World Cup cycle | recorded as post-launch |

Version 1.6.3, Play version code 32.

Results on the fixed build (commit after 12a0374): engine suite `suite.sh fast` 176 of 176 PASS (`wclashprobe` added; `barrageprobe`, `pyramidprobe`, `basisprobe`, `econprobe`, `chaosprobe`, `upkeepprobe`, `invariants`, `pressroom`, `round25b`, `varietyprobe` and `challengetest` updated for the new money model, the ringfenced Premiership, the real-week arithmetic, or an inbox-cap fragility in the probe itself); `fingerprint` rebaselined once after `bandcheck` held all five bands; `releasesim` 12 seasons PASS including the three new inflation bands (90+ 27 to 71, 85+ 147 to 233, tier gap 32.5 to 18.5); browser suite 57 of 57 PASS against the production build.

## 1.6.4: the remaining items, resolved

| Item | Change | Proof |
|---|---|---|
| URC format | `shieldRoundRobin` (schedule.ts): four regional shields home and away plus everyone else once, 18 rounds, 9 home games each, no double-booking | `scripts/qa/v164` check: rounds 18, games 18..18, home 9..9, 120 pairings of which 24 are derbies |
| Super Rugby Pacific and Champions Cup | Unchanged, as instructed | |
| Suspected club placements | Confirmed correct by the owner, unchanged | |
| Women's World Championship | `isWomensWorldCupSeason` (2029, 2033, ...), `buildWorldCup(rng, state, women)` with sixteen nations in four pools over weeks 2 to 7; autumn and summer Tests skipped that year; call-up window reads the competition's own knockout weeks; the world-title dream is winnable in the women's game | Women's season 3: 16 nations, 4x4 pools, 24 fixtures, champion recorded; season 4 has no tournament |
| Player id counter | `GameState.pidNext` stamped by newGame and by every week settle; migrate restores the higher of the counter and the highest live id | pidNext carried after a settle (6774) |
| Forfeit rule | `forfeitSide` / `settleForfeit` (matchEngine.ts): fewer than ten available players concedes 28-0 with four tries; both short is a scratched 0-0; nations never forfeit; the manager's own walkover goes through the assistant's path and the inbox | new suite probe `scripts/forfeitprobe.ts` |
| Women's squad reconciliation | Branch `claude/womens-squad-reconciliation-6ur7gh` (083774b) merged: `RawPlayer.gen` marks the 841 invented women, `p.real` reads it, maternity leave can now reach them; `scripts/genprobe.ts` pins 1,255 real and 841 generated | genprobe PASS after the merge |

Version 1.6.4, Play version code 33.

Results on the 1.6.4 build (commit 51c3421): full `suite.sh` run, engine 178 of 178 PASS (`forfeitprobe` and `genprobe` added; `fingerprint` rebaselined once more after `bandcheck` held every band, for the URC draw; `releaseaudit` 1.2c now tolerates a following HIA on a third player; `autopilotprobe`'s stature section counts crisis seasons instead of a mean that moved with the random stream; `newsprobe` needed `news.wcDrawWSubj`), browser 57 of 57 PASS against the production build; `releasesim` 15 seasons PASS on every band (90+ players 23 to 69, 85+ 139 to 291, top-to-bottom best-XV gap 32.4 to 20.7).

**Verdict for 1.6.4: 🟢 RELEASE.** Every register item is now fixed or confirmed, the two format simplifications that remain (Super Rugby Pacific, Champions Cup) are the owner's call and documented, and both suites are green on the build that ships.

**Verdict for 1.6.3: 🟡 RELEASE WITH CONDITIONS.** The four P1s and every P2 are fixed and re-proved. What remains is P3 and below: the documented format simplifications, four suspected club placements not web-verified, the women's World Cup cycle, the module-level id counter, and a forfeit rule for squads below fifteen.

---


Audited 2026-09-15 at commit 3994832 (branch claude/rugby-manager-final-qa-8hbhrl).
Every claim below is grounded in a probe run at this commit, a code path quoted by file and line, or a cited external source. Probes written for this audit live in `scripts/qa/` (run with `npx vite-node scripts/qa/<name>.ts`). Nothing in the game was changed.

Evidence base:

- The project's own engine suite: 128 of 128 probes PASS (`suite.sh fast`, run in two halves after a container restart).
- `scripts/releasesim.ts` 12 seasons, seed 20260915: PASS on all its bands.
- Browser harness list from `suite.sh` run against the production build: see the Browser section for the per-harness result.
- 15 new headless probes (persona walk through the store, determinism across reload, id reuse, rollover integrity in both worlds, women's fixture clashes, economy exploits, drift over 10 seasons for 3 seeds in each world, calendar, whistle-time scoreboard, resume record cost).
- Web checks for league structures and named players (sources listed under Data).

---

## EXECUTIVE SUMMARY

The engine is robust in the ways that usually kill a management game: nothing crashed, no save corrupted, no NaN leaked, no fixture was duplicated, no player was lost or doubled, every season rolled, every table reset, every champion was recorded once, and 12 seasons ran in a bounded 8.6 MB save. The existing probe suite is unusually thorough and it is green.

What it does not protect is the shape of the world over time and the money model:

1. **The women's game auto-plays the manager's own cup knockouts.** The women's Champions Cup quarter-final, semi-final and final fall on league weekends, and the engine settles one of the two matches by the AI path. Across four clubs and three seasons, 11 of the manager's cup ties, including a final, were played without them. The men's calendar has no such clash.
2. **The world inflates.** Over 10 seasons the number of players rated 90+ goes from about 30 to about 210 (three seeds, both worlds). The best XV in England's third tier goes from 48.5 to 78, closing a 32-point gap to the Premiership to 6. Wages rise 2.75x. A ten-season save is a different, flatter game.
3. **Cash is charged twice when a manager moves money into the transfer budget**, and the paid board injection is partly swept back by the board at the next rollover. A player who buys the largest injection at week 40 loses about a third of it within weeks and can only reach the rest by using the function that double-charges.
4. **A leftover mid-match resume record can replace one career with another** if a new career in the same slot reaches the same week and the tab is refreshed. Rare, but it is silent loss of a career.

Below those, a handful of P2 exploits (unlimited morale by re-signing players, a permanently lost marquee slot, selling a player you have already released) and a performance defect where every revealed commentary line rewrites the full 7 MB pre-match state to IndexedDB.

## RELEASE VERDICT

🔴 **NOT RELEASE READY**

No P0 was found. Four P1 issues threaten the integrity of the game as shipped: one breaks a headline feature of the women's game (the manager's own cup final is played without them), two devalue real-money and in-game money, and one can lose a career. With QA-01, QA-03 and QA-04 fixed, the men's game would sit at 🟡 with QA-02 (inflation) as the standing condition.

### RELEASE SCORE

| Area | Score |
|---|---|
| Gameplay stability | 8/10 |
| Simulation integrity | 6/10 |
| Data integrity | 7/10 |
| Save integrity | 7/10 |
| Long-term stability | 6/10 |
| UI/UX | 7/10 |
| Performance | 6/10 |
| Rugby authenticity | 8/10 |
| Content/data accuracy | 6/10 |
| Exploit resistance | 5/10 |
| **Overall release confidence** | **6/10** |

---

## CRITICAL FINDINGS

### QA-01 (P1) Women's world: the manager's cup knockout ties are simulated without them

- **System**: schedule (women's calendar), season loop.
- **Reproduction**: `scripts/qa/wclash.ts`. Start a women's career at any club that qualifies for the Champions Cup; reach week 24 with a league round and a cup quarter-final in the same week.
- **Expected**: one match per week for the user's club, or the cup tie takes precedence and the league round moves.
- **Actual**: both fixtures exist in the same week. `userFixtureThisWeek` picks one; `processWeekAndAdvance` settles the other by the AI path with no events, no team sheet and no manager. Output: `w:saracens/7: weeks with two fixtures 5; user matches simmed without the manager: 5 [s0w24 cc/QF, s0w27 cc/SF, s0w30 cc/F w:toulouse 20-23 w:saracens, ...]`. Bristol, Toulouse and Auckland show the same. `scripts/qa/clashprobe.ts` counts 13 club double-bookings in a women's season 0 and 0 in the men's.
- **Root cause**: `W_CC_KO_WEEKS = [24, 27, 30]` (schedule.ts:79) while every women's league round list includes weeks 24, 27 and 30 (rounds 11, 12 and 14). The men's `CC_KO_WEEKS = [34, 38, 41]` sit on free weekends.
- **Fix**: move the women's knockout weeks onto weekends no top-tier league uses (26, 28 and 31 are free for w:pwr, w:pac, w:e1 and w:celt), and add a generation-time assertion that no club has two fixtures in one week unless `midweek` is set.
- **Confidence**: high. Release-blocking: yes for the women's game.

### QA-02 (P1) Long-term rating and wage inflation flattens the pyramid

- **System**: rollover (`agePlayers`, rollover.ts:311-340), regen minting.
- **Reproduction**: `scripts/qa/drift.ts m 777 10` (and seeds 4242, 12345, both genders).
- **Evidence** (men, seed 777; seeds 4242 and 12345 agree within 15%):

| Measure | Season 1 | Season 10 |
|---|---|---|
| Players rated 90+ | 30 | 207 (236 and 240 on the other seeds) |
| Players rated 85+ | 158 | 515 |
| Mean rating, age 30-33 | 62.8 | 79.8 |
| Mean rating, age 25-29 | 65.1 | 73.9 |
| Best XV mean, National League One | 48.5 | 78.2 |
| Best XV mean, Premiership | 80.0 | 84.4 |
| Best XV mean, Championship | 58.8 | 78.5 |
| Median senior squad | 38 | 44 (the AI cull at 46 is the ceiling) |
| Median wage | £2,000 | £5,500 |

The women's world shows the same curve (w:champ best XV 58.4 to 79.1; players 90+ from 2 to 150).

- **Expected**: distributions stable within a band after the first summer; a third-tier side should not reach Premiership strength.
- **Root cause**: growth runs to 23 (or 25) at 2-4 a year and to 27 (or 29) at 1-2 a year, with the ceiling `pa` set 12-25 above `ca` at creation for anyone 20 or under; there is no decline at 28-30 and only 1-2 a year at 31-32; every retiring player rated 78+ is reborn as a newgen with `pa` in the same band (rollover.ts:499-513); the free-agent pool is culled to the best 120 by rating. The `releasesim` band checks only the under-23 mean, which is flat, so this was invisible to the existing gate.
- **Fix**: calibrate so that the count of 85+ and 90+ players and each league's best-XV mean stay within a band of season 1 (add those two lines to `releasesim`); start decline at 30; scale rebirth potential to the league tier; stop the cull from selecting by rating alone.
- **Confidence**: high. Release-blocking: yes for a game that advertises long-term play.

### QA-03 (P1) Moving cash into the transfer budget charges the club twice

- **System**: treasury, transfers.
- **Reproduction**: `scripts/qa/p1_treasury.ts`. Balance £2.1m, budget £3.5m. Buy a £1.0m player: balance £1.1m, budget £2.5m (correct: budget is an allowance, cash is charged once). Now `releaseToBudget` £1.0m and buy the same player: balance £0.1m. Output: `Cash cost of the same signing: no move £1.0m vs with a £1.0m move £2.0m; extra cash gone = £1.0m`. Moving the whole balance and spending the budget leaves the club at -£5.4m from +£2.1m.
- **Root cause**: `releaseToBudget` (treasury.ts:101-102) does `balance -= move; budget += move`, treating the budget as a pot, while `executeTransfer` (ai.ts:229-230) does `to.balance -= fee; to.budget -= fee`, treating the budget as an allowance inside cash. The two models cannot both be right; as shipped the manager's cash is spent twice.
- **Fix**: make `releaseToBudget` raise the allowance without touching the balance (keeping the reserve and board-confidence rules), or make `executeTransfer` charge cash only for the part not covered by the budget. Add a probe asserting cash moves once per fee.
- **Confidence**: high. Release-blocking: yes (it is the button every optimising player presses).

### QA-04 (P1) Paid board injections are partly swept back at the rollover

- **System**: grants (`applyInjection`), rollover (`boardReinvests`), monetisation.
- **Reproduction**: `scripts/qa/p5_inject.ts`. `phase.inject.xl` is a store consumable (monetise.ts:92-96). Buying it at week 40: balance £0.57m to £131m, budget £4.0m to £134m. After the rollover: balance £84m (the board "reinvests" £44m, rollover.ts:46-75, 40% of everything above a reserve), budget £17m. Bought at week 47 instead: no sweep, budget £23m. Bought at week 2 at Leicester: budget £24m the next season.
- **Expected**: a paid injection stays spendable on transfers, and the same product behaves the same whichever week it is bought.
- **Actual**: 11-18% of the injected sum is spendable as transfer budget the following season, up to 40% of it is spent by the board, and reaching the rest requires QA-03.
- **Fix**: exclude `injectedThisSeason` from the reinvestment sweep and carry the injected amount forward in the transfer budget; state on the purchase sheet exactly what carries over.
- **Confidence**: high. Release-blocking: yes (real money).

### QA-05 (P1) A stale mid-match resume record can replace a different career

- **System**: store (`start`, `resume`, `resumeLiveMatch`), resume.ts.
- **Reproduction**: `scripts/qa/crossrec.ts`. Career A kicks off a match (a `MatchResume` with the full pre-match state is written for the slot). Start a new career B in the same slot: `start()` (store.ts:607-626) never clears the record. Play B to the same season and week. `resumeFits` (resume.ts) checks only season, week, fixture id and an unplayed flag; fixture ids are minted from the same counter (`nextId: 1_000_000`) so B has an unplayed fixture with A's id in 3 of 3 tested careers. A refresh in that week (`resume()`, store.ts:703-724, same session) calls `resumeLiveMatch`, which sets `game = rec.pre`: the manager is back in career A, and the next autosave writes A over B's slot.
- **Fix**: clear the resume record in `start()` and `setGame()`; stamp the record with `state.seed` and `saveName` and require both to match in `resumeFits`.
- **Confidence**: high on the code path, medium on frequency (it needs a refresh in the matching week). Release-blocking: yes, because it is silent loss of a career.

---

## COMPLETE BUG REGISTER

| ID | Sev | System | Bug | Reproduction | Expected | Actual | Root cause | Fix |
|---|---|---|---|---|---|---|---|---|
| QA-01 | P1 | Women's schedule | Manager's cup QF/SF/F auto-simmed | `scripts/qa/wclash.ts` | One match a week | 11 ties incl. a final settled by the AI path | `W_CC_KO_WEEKS` overlap league weeks 24/27/30 | Move KO weeks to 26/28/31; assert no club double-booking |
| QA-02 | P1 | Development | Rating and wage inflation over 10 seasons | `scripts/qa/drift.ts` | Stable distribution | 90+ players x7, third tier reaches Premiership strength | Growth to 27-29, no decline until 31, rebirth regens keep high `pa` | Recalibrate curves, add band checks to releasesim |
| QA-03 | P1 | Treasury | Release-to-budget then buying charges cash twice | `scripts/qa/p1_treasury.ts` | Cash charged once per fee | Extra cash gone equals the amount moved | Pot model in treasury.ts:101 vs allowance model in ai.ts:229 | One model; probe it |
| QA-04 | P1 | Monetisation | Paid injection swept and reset at rollover | `scripts/qa/p5_inject.ts` | Injection stays spendable | 11-18% spendable next season; £44m reinvested by the board | `boardReinvests` ignores `injectedThisSeason`; budget recomputed | Exclude injections from the sweep; carry budget forward |
| QA-05 | P1 | Save/resume | Stale resume record replaces a different career | `scripts/qa/crossrec.ts` | Record belongs to one career | Other career's pre-match state loaded and autosaved | `start()` never clears; `resumeFits` keys on deterministic ids | Clear on new game/load; key on seed and save name |
| QA-06 | P2 | Contracts | Re-signing at his own demand is unlimited | `scripts/qa/exploit.ts` | One renewal per window | 96/96 accepted in one week, squad morale 7.0 to 10.0, 96 news items | `offerRenewalAt` adds +1 morale every call with no cooldown (ai.ts:842-916) | One renewal per player per season, or no morale bump when terms are unchanged |
| QA-07 | P2 | Salary cap | Sold or retired marquee player keeps his slot | `scripts/qa/exploit.ts`, `scripts/qa/dangle.ts` | Slot frees when he leaves | `club.marquee` keeps the id; slots left 1 for ever | Nothing in `executeTransfer`, retirement or release edits `marquee` | Filter `marquee` to current roster wherever it is read or on departure |
| QA-08 | P2 | Transfers | Accepting a bid for a player you released | `scripts/qa/exploit.ts` | Offer voided on release | "Tommy Reffell sold to Bath for £2.0m": user gets nothing, bidder pays, player moves | `releasePlayer` leaves `state.offers` untouched (release.ts:43-70) | Reject pending offers for the player on release; `respondToOffer` should require `p.clubId === userClubId` |
| QA-09 | P2 | Performance | Every revealed commentary line rewrites the 7 MB pre-match state | `scripts/qa/crossrec.ts` timing | Small record per tick | `noteProgress` spreads `matchRec` including `pre` and `putResume` does a JSON round trip plus IndexedDB clone: 290 ms + 523 ms per call on desktop | The record embeds `pre` and is rewritten whole (store.ts:1074-1082, save.ts:84-92) | Store `pre` once under its own key at kick-off; write only tick, cursor and cmds afterwards |
| QA-10 | P3 | Save | A reload changes the world | `scripts/qa/determinism.ts` | Reload is identity | Academy wages re-priced, stadium renamed on first load, id counter lives in a module variable | `migrate` re-runs `playerWage` for academy men (save.ts:658), stadium heal (save.ts:773), `idCounter` in attributes.ts:290 | Make migrate a pure migration; put the id counter in the save |
| QA-11 | P3 | Calendar arithmetic | Two week bases coexist (100 and 48) | `scripts/qa/basis100.ts` | Durations are weeks | Scouting brief promised 39 weeks landed after 20; a build set at w44 for 10 weeks opened after 6; the "going nowhere" vow rule never fires across a summer; `courtedAt` is rebased by migrate but media.ts:250 still compares on basis 100 | `season * 100 + week` in 14 places vs `absWeek` on basis 48 | Replace every `season * 100 + week` with `absWeek` |
| QA-12 | P3 | Tables | Tie-break order not the real one | `scripts/qa/seasonprobe.ts` calprobe section | Premiership and URC: wins before points difference | Points difference before wins | `sortTable` one order for all leagues | Per-competition comparator |
| QA-13 | P3 | Fixtures | Home/away imbalance | `scripts/qa/urcsplit.ts` | 7/8 or 8/7 in a 15-round single round robin | URC: four clubs 6 home 9 away; women's Championship: five clubs 8 home 11 away | Single round-robin generator does not balance venues | Balance by swapping venues in the generator |
| QA-14 | P3 | Match day | Half-time and full-time scoreboard wrong on whistle penalties | `scripts/qa/whistle.ts` | Scoreboard equals the score | 26 of 26 late half-time penalties: the HT line's snapshot is 3 or 7 short (e.g. 3-15 shown, 3-22 real); 24 full-time snapshots short | HT and FT events carry the score before the pending kick resolves; MatchDay reads `last.homeScore` | Stamp the event after the decision resolves |
| QA-15 | P3 | Loans | Selling a player who is out on loan | `scripts/qa/p3_loans.ts` (harvested) | Blocked, or recalled first | Moves to the buyer with `onLoan` still true until the rollover | `executeTransfer` ignores `onLoan` | Recall or refuse |
| QA-16 | P3 | Squad size | No ceiling on the user's squad | `scripts/qa/p4_offers.ts` | The 46-senior cull applies to everyone | Free agents signed until 73 in the squad; AI clubs are culled at 46 | Cull skips `userClubId` (rollover.ts:1511) | Apply the same registration limit with a warning |
| QA-17 | P3 | Data authenticity | Real players with invented ages and ratings (women's) | See Data section | Real facts or a visible "estimated" marker | Bourdon Sansus age 20 (real 30), Feleu 19 (real 26), Sorensen-McGee 28 (real 19) | Only 34 of 357 Élite 1 rows carry an age; Pacific sources give none | Fill from a source or mark as estimates |
| QA-18 | P4 | Formatting | `fmtMoney(NaN)` prints "£NaN", `Infinity` prints "£Infinitybn"; `fmtWage(999600)` prints "£1000k" | `scripts/qa/p8_fmt.ts` | A dash, and £1.0m | As stated | No guard in `fmtMoney`; rounding edge | Guard non-finite; round before choosing the unit |
| QA-19 | P4 | Commentary | "dives under the posts" followed by "converts from the touchline" | `scripts/qa/whistle.ts` | Conversion wording matches the try's position | 13 cases in 224 matches | Conversion line chosen independently of the try line | Carry the try position into the conversion |
| QA-20 | P4 | Engine (latent) | A team with 3 to 7 players still plays | `scripts/qa/edge.ts` | Forfeit or uncontested rules | 0-82 with three on the pitch | No minimum-players rule | Only reachable below the 18-senior board veto; add a forfeit rule |
| QA-21 | P4 | Engine (latent) | `makeSubstitution` does not check bench membership, bans or Test duty | `scripts/qa/banned.ts` | Refused | A suspended man comes on when the call names him | matchEngine.ts:3112-3142 checks injury and on-pitch only | Validate `slotIn >= 15` and availability; the UI currently prevents it |

Not defects, but recorded because they were tested: news items keep the ids of departed players (up to 26 of 250 after four seasons) and every screen that reads them guards the lookup (Inbox.tsx:62-91, PlayerScreen.tsx:67-68 shows "gone"); the module-level player-id counter is reset to max+1 on every load and a 6-season probe (`scripts/qa/idreuse.ts`) found no id reused because the summer mints always outrun the deletions; players appear in both a home-nation squad and the Isles XV in tour years, with no double-booking of a player on a day found.

## DATA / FACTUAL ERRORS

| Item | Current | Expected | Source/Reason | Severity |
|---|---|---|---|---|
| Premiership promotion and relegation | `RELEGATES = ['prem', 'champ', 'top14']` (model.ts:1963): bottom of the Premiership swaps with the Championship winner every season | From 2026-27 automatic promotion and relegation is scrapped in favour of a criteria-based model; the 10 clubs are fixed | [Sky Sports](https://www.skysports.com/rugby-union/news/12040/13512855/gallagher-prem-shake-up-promotion-and-relegation-to-be-scrapped-as-english-rugbys-top-tier-moves-towards-franchise-league), [RTÉ](https://www.rte.ie/sport/rugby/2026/0227/1560791-gallagher-prem-to-scrap-promotion-and-relegation/) | P2 |
| Premiership tie-break | Points difference before wins | Wins, then points difference, then points for | [Prem Rugby regulations](https://premrugby.com/about/governance/gallagher-premiership-league-table-regulations) | P3 |
| Pauline Bourdon Sansus (Toulouse, women) | Age 20, rating 66, no international flag | Born 4 Nov 1995 (age 30), 77 caps for France | [Wikipedia](https://en.wikipedia.org/wiki/Pauline_Bourdon_Sansus); w_e1.ts:68 | P2 |
| Manae Feleu (Grenoble, women) | Age 19, rating 56 | France captain, born 2000 (age 26) | w_e1.ts:308; file header says only 34 of 357 rows carry an age | P2 |
| Braxton Sorensen-McGee (Auckland, women) | Age 28 | Born 2006 (age 19-20) | w_pac.ts:65; header says the source gives no ages | P2 |
| Sylvia Brunt, Renee Holmes, Kennedy Tukuafu (women's Pacific) | Ages 26, 29, 24 | 23, 27, about 30 | w_pac.ts:55,189,95 | P3 |
| Georgia Evans (Saracens, women) | Nationality ENG | Wales international | w_pwr.ts:123 | P3 |
| Super Rugby Pacific format | 11 teams, full double round robin (20 games each, 22 rounds) | 11 teams, 14 games each, two byes | [Wikipedia 2026 SRP](https://en.wikipedia.org/wiki/2026_Super_Rugby_Pacific_season) | P3 (documented simplification) |
| URC format | 16 teams, single round robin, 15 rounds | 18 rounds | Known simplification; produces QA-13 | P3 |
| Champions Cup | 16 teams, four pools of four home and away, then QF | 24 teams, four pools of six, four pool games | Known simplification | P3 |
| Rieko Ioane | Leinster | The Leinster sabbatical ended June 2026; he is back at the Blues for 2026-27 | Not web-verified in this session | P3 (suspected) |
| Richie Mo'unga | Tokyo Brave Lupus | Announced return to the Crusaders for 2026 | Not web-verified in this session | P3 (suspected) |
| Jac Morgan | Gloucester | Ospreys as of the last verified season | Not web-verified in this session | P3 (suspected) |
| Meg Jones | Trailfinders | Leicester Tigers as of the last verified season | Not web-verified in this session | P3 (suspected) |
| Women's World Cup cycle | None (rollover.ts:1789 sets `wcYear` false for the women's world) | Women's RWC 2029 in Australia | Content gap, not an error | P3 |

Verified correct in the composed world (a fresh `newGame`): Owen Farrell at Saracens ([Saracens](https://saracens.com/owen-farrell-returns-to-saracens/)), Julián Montoya at Pau, Handré Pollard at the Bulls, Ardie Savea at Moana Pasifika, Jordie Barrett at the Hurricanes, Louis Rees-Zammit at Bristol, Blair Kinghorn at Toulouse, Cheslin Kolbe and Faf de Klerk in League One, Marlie Packer at Harlequins, Aoife Wafer at Harlequins, Holly Aitchison at Sale; Premiership Women's Rugby has nine clubs in 2026-27 ([Wikipedia](https://en.wikipedia.org/wiki/2026%E2%80%9327_Premiership_Women's_Rugby)) matching the game's nine; Super Rugby Pacific has the game's 11 clubs. Ben Youngs, Dan Cole, Joe Marler, Dan Biggar and Sam Whitelock are correctly absent. The rename table and `ipprobe` keep every real club, competition, sponsor and ground mark out of the shipped bundle.

Women's data provenance, as the files themselves declare it: PWR and the Pacific squads are REAL names; Élite 1 is 300 real of 357; the English Championship and Élite 2 are mostly GENERATED (881 of 979 invented players); ages are INFERRED for every Pacific row and for 323 of 357 Élite 1 rows; ratings are INFERRED everywhere. The game shows those inferred ages and ratings on real women's names with no marker.

## GAMEPLAY / SIMULATION ISSUES

QA-02 (inflation), QA-12 (tie-break), QA-13 (venue balance), QA-16 (squad ceiling), QA-20 and QA-21 (latent engine gaps). Competitive balance across 12 seasons: distinct champions in every league on every seed, no club won everything.

## SAVE / PERSISTENCE ISSUES

QA-05 (cross-career resume), QA-09 (7 MB write per line), QA-10 (reload is not identity). Verified: the save round-trips through JSON with no NaN or Infinity every season for 12 seasons; `savefuzz`, `migratetest`, `cloneprobe`, `replayprobe`, `resumeprobe`, `backupprobe`, `savequeue`, `reloadprobe` all PASS; a save grows from 5.0 MB to 8.6 MB over 12 seasons and plateaus (news capped at 250, fixtures purged each summer); importing a save with a missing club is refused by `isPlayable` rather than crashing.

## SEASON / LONG-TERM ISSUES

QA-02, QA-11. Verified over 8 to 12 seasons in both worlds: ages advance once, stats wipe to career, tables and champions reset, history records each champion once, contracts never expire in the past on a rostered player, weeks reset to 1, the manager ages and is retired at 70 (a career is capped at 28 seasons: design, note for the store copy), World Cup seasons land on 2027, 2031, 2035, Isles tours on 2029, 2033, 2037.

## MATCH ENGINE ISSUES

QA-14, QA-19, QA-20, QA-21. Verified: 16 impossible worlds for two seasons without an exception (`extremes`), 60 extreme lineups and slider values without a NaN or a crash (`scripts/qa/extremeLineups.ts`), band check inside tolerance on four worlds (53.4 points, 6.24 tries, 54.5% home, 1.7% draws, 6.5% blowouts), fingerprint unchanged, a drawn knockout is settled before the whistle line, no player scores after a red card, sin bins and cards resolve. Two rare oddities in 3,000 matches (a drop goal credited to an injured man, one to a sin-binned man) were logged by the harvested invariant run and are worth a guard.

## ECONOMY ISSUES

QA-03, QA-04, QA-06, QA-07, QA-08, QA-15, QA-16, QA-18. Verified: `aiecon`, `econprobe`, `debtprobe`, `insolvprobe`, `ledgerprobe`, `spendprobe`, `grantprobe`, `moneyprobe`, `rewardedprobe` PASS; a refused deal never moves money; the cap fines once per season; administration docks points once.

## PLAYER DEVELOPMENT ISSUES

QA-02. The under-23 cohort is stable (mean 56.5 to 56.8 across 10 seasons); the inflation is in the 21-33 bands. Bench-versus-starter growth for 19-22-year-olds is 4.00 versus 4.08 points a season, so the minutes-gated growth is weaker than the code comment promises.

## TRANSFER / CONTRACT ISSUES

QA-06, QA-07, QA-08, QA-15. Verified: double-accepting a bid is refused, a sale below 18 seniors is vetoed by the board, expired contracts release the player at the rollover, pre-contracts are voided on a sale, buy-back inside six months is refused.

## COMPETITION ISSUES

QA-01, QA-12, QA-13 and the format simplifications in the Data table. Verified: no duplicate fixture ids, no club plays itself, every league pairing meets the right number of times, cups run pools to a final every season, finals are announced before they are played, every knockout tie has a winner.

## UI / UX ISSUES

Browser harnesses from `suite.sh` against the production build (headless Chromium, phone geometry, both themes): 57 of 57 PASS, no failure: `e2e`, `e2enight` (no console errors), `backprobe`, `savequeue`, `resilience`, `reloadprobe`, `subsprobe`, `dramaprobe`, `jobsprobe`, `hubprobe`, `tapsize`, `motionprobe`, `drawui`, `portraitqa`, `densityaudit`, `stickyaudit`, `scrollaudit`, `overlapaudit`, `blockprobe`, `pickaudit`, `nightcontrast`, `contrastprobe`, `colouraudit`, `breaker`, `subreach`, `injurygate`, `unemployedprobe`, `stakesprobe`, `devicematrix`, `backlogprobe`, `annualprobe`, `geosweep`, `strangerpath`, `hireprobe`, `bidprobe`, `deskgate`, `textscale`, `langprobe`, `skinui`, `sackui`, `engageui`, `tillface`, `keyscreen`, `storeprobe`, `backupreach`, `replyreach`, `subline`, `testsheet`, `healrefresh`, `sidescroll`, `adsprobe`, `womensui`, `mgrgender`, `joboffer`, `matchad`, `ipprobe`, `chaosui`. No dictionary key, no "undefined", no console error, no tap target under 44px, no overflow at any of six geometries, no real-world mark in the bundle. From code: QA-14 (scoreboard at the whistle). The ErrorBoundary catches a render crash with three exits (title, reload, bug report) and never strands the save.

## NAMING / COPY ISSUES

QA-19. `textlint`, `newsprobe` (997 story keys in every language), `i18nprobe`, `keyscreen` PASS. The Isles XV naming is applied consistently in user-facing strings; the internal field `lions` never reaches the screen.

## PERFORMANCE ISSUES

QA-09 is the one that matters: with a 7 MB career the match screen performs a JSON round trip and a structured clone per revealed line. Headless timing over ten seasons (`scripts/qa/timing.ts`, seed 2026): a season settles in 2.4 s at season 1 and 2.8 s at season 10; the slowest single week grows from 123 ms to 150 ms; `JSON.stringify` of the save grows from 46 ms (6.8 MB) to 72 ms (8.4 MB). Degradation is gentle and bounded. The persist queue collapses a burst of taps to one write (verified by `savequeue`).

## SECURITY / EXPLOIT ISSUES

QA-06 (free morale), QA-07, QA-08. Match results cannot be re-rolled by reloading: the match RNG is seeded from `(seed, season, week)` and the pre-match save is taken before the engine runs; changing the team sheet changes the result, which is legitimate. Job applications and press answers are seeded the same way. No network calls ship (`netprobe`).

## TECHNICAL DEBT THAT MUST BE FIXED BEFORE RELEASE

- The two money models (QA-03) and the injection sweep (QA-04).
- The women's knockout calendar (QA-01) plus a generation-time double-booking assertion.
- The resume record's identity and lifetime (QA-05, QA-09).
- Growth calibration and a band in `releasesim` for 85+/90+ counts and per-league best XV (QA-02).

## TECHNICAL DEBT THAT CAN WAIT UNTIL POST-LAUNCH

- Replace every `season * 100 + week` with `absWeek` (QA-11).
- Move the player-id counter into the save (QA-10).
- Per-competition tie-breakers and venue balancing (QA-12, QA-13).
- Whistle-time event snapshots and conversion wording (QA-14, QA-19).
- A forfeit rule and bench validation in the engine (QA-20, QA-21).
- Women's World Cup cycle; sourced ages for the women's Élite 1 and Pacific rows.

## BUG DEPENDENCY MAP

- Growth curve too generous and rebirth regens keep high potential → rating inflation → wage inflation → every AI squad sits at the 46-senior cull → transfer values and fees drift → a 10-season save has no tiers (QA-02 is the root of all of it).
- Budget-as-pot in `releaseToBudget` versus budget-as-allowance in `executeTransfer` → cash charged twice (QA-03) → paid injections can only be reached through the double charge → the board sweep takes 40% of what is left (QA-04).
- `W_CC_KO_WEEKS` on league weekends → two fixtures a week → one settled by the AI path → cup results, board confidence, objectives and prize money decided without the manager (QA-01).
- Resume record keyed on deterministic fixture ids and never cleared on new game → wrong career restored → autosave overwrites the real one (QA-05).
- Mixed week bases → cooldowns, briefs, builds and vows mis-time across a summer, and a migrate rebase breaks one comparison (QA-11).

## THE FIVE MOST DANGEROUS BUGS

1. QA-01 Women's cup ties auto-simmed (P1, confidence high, blocking).
2. QA-04 with QA-03: paid money swept and cash double-charged (P1, confidence high, blocking).
3. QA-02 Rating inflation (P1, confidence high, blocking for the long-term promise).
4. QA-05 Cross-career resume (P1, confidence high on path, medium on frequency, blocking because it is silent).
5. QA-09 7 MB write per commentary line (P2, confidence high, the likeliest cause of the reported tap delay on match day).

## TOP 10 FIXES BEFORE RELEASE

1. Move `W_CC_KO_WEEKS` off league weekends and assert no double-booking at generation (QA-01).
2. Make `releaseToBudget` change the allowance only (QA-03).
3. Exclude injected cash from `boardReinvests` and carry it in the budget (QA-04).
4. Clear the resume record on `start()` and `setGame()`; key it on seed and save name (QA-05).
5. Store `pre` once at kick-off; write only the small record afterwards (QA-09).
6. Recalibrate growth and decline; add 85+/90+ and per-league best-XV bands to `releasesim` (QA-02).
7. One renewal per player per season, no morale bump for unchanged terms (QA-06).
8. Void pending offers on release and require ownership in `respondToOffer` (QA-08).
9. Drop departed players from `club.marquee` (QA-07).
10. Source or mark the women's inferred ages for named internationals; fix Georgia Evans's nationality (QA-17).

## WHAT WAS NOT EXECUTED

- No physical device run; the browser harnesses ran on headless Chromium at phone geometry.
- No store purchase flow against a live billing bridge (the `storeprobe` harness injects a fake bridge).
- The 50-season soaks (`soakhealth`, `stresstest`, `deepsave`, `e2edeep`) were not run in this session; 12 seasons was the longest full run.
- Only 26 named women's players and about 80 named men's players were checked against the composed world; four club placements are marked suspected rather than verified.
