# QA report: 1.8.0, night of 27-28 Sep 2026

Branch `claude/rugby-game-animation-ideas-qusfd5`. Test build: the artifact,
version 12.

## What was done tonight

- **Two-layer match engine (E12).** Every phase is now a contest between
  individual players (carrier, tackler, jackal), with mental attributes
  gating technical ones. The contest decides which players win the
  collisions. It averages out across the league, so it does not add tries.
  The commentary names the players who actually won the collision.
- **Home advantage runs through the contest too.** A home-blind contest had
  flattened the effect of long away trips; the crowd and the trip now weigh
  on the collisions as well.
- **AI respect (E9)** is now read by the engine: the league sets up against
  a big-name manager, costing about 3.8 percentage points of wins.
- **Real pace in highlights (E10).** Quick finishers pull away from the
  cover and slow ones are run down. E11 (rewatching highlights) was
  scrapped, as you asked.
- **The analyst's advice pays again.** Following a sound read was worth
  nothing by tonight (from +78.7 points a season before E5-E9 to -0.3).
  The homework bonus went from 0.045 to 0.07: +44.4 points a season now,
  ahead in 14 of 24 seasons. It only applies to your club.
- **UI sweep: 21 layout fixes.** Every screen was checked at seven sizes
  and themes.
- **Language review** of the six languages (merged as far as it got; see
  below).

- **Money and targets moved to the board (your note, 28 Sep).** The
  pre-season camp, the season's expectations and sponsor slot deals are now
  asked on Finances > The Board, not in the Press Room. A waiting decision
  no longer blocks press questions or players knocking on your door.

## Balance (4,068 simulated games)

| | Before tonight | Now | Target |
|---|---|---|---|
| Points a game | 50.7 | 50.6 | 48-53 |
| Tries a game | 6.48 | 6.45 | 6.0-6.6 |
| Home wins | 52.7% | 52.1% | 51-57% |
| Draws | 1.6% | 1.6% | 1.4-3.0% |
| Blowouts | 8.1% | 8.0% | under 11% |

- Scoring is a touch down, as you wanted ("very attacking heavy"). The try
  base went from 0.0843 to 0.0815.
- Away trips still count: the hardest trips are 1.2 points of home wins
  harder than the easiest (1.8 before the contest).
- An engaged manager's edge over one who only presses Continue grew:
  - best side worth 10.9 points a season (9.1 before);
  - average finish 4.6th against 7.0th;
  - 8 titles against 3 over 54 seasons.

## Probes made sturdier (same limits, bigger samples)

Four checks were flipping on a handful of events. None of their limits
were loosened; each now reads a bigger sample:

- **venueprobe:** 36 worlds, not 9.
- **chargeprobe:** 100 seeds, not 30. Late drop goals had read 5.2x and
  then 0.6x on about ten events.
- **respectprobe:** 24 matches a fixture, not 8.
- **autopilotprobe:** 54 worlds, not 18. It now reads a title rate (two in
  eighteen, as before) and has moved to the slow set.

## Owner round, morning of 28 Sep: fixed

1. **Sacked while doing everything right.** Measured over 48 seasons of a
   best-XV Bath first. The sackings were genuine collapses (7th to 10th,
   records like 4-13), the same spread an AI-run Bath shows, and not caused
   by E5-E9 (the engine before them read 13 crises and 4 sackings in 48).
   The board was the unfair part:
   - a win over a weaker side earned about 2 confidence and a defeat cost
     about 7.5, so a big club had to win four in five to stand still. A win
     now earns at least 55% of what the same defeat costs;
   - a sacking needs the floor for three weeks running, not one reading;
   - a manager's first season at a club has a honeymoon with no results
     sacking (final warnings still go out). Its length follows the club's
     standing, as the owner asked ("it should be harder as the fans expect
     results"): until week 32 at reputation 50 or below, week 21 at 70,
     week 16 at 80 and week 12 at 88 or above.
   Result (autopilotprobe, 36 seasons each): engaged Bath sacked 4 of 36,
   every one of them 8th to 10th after week 28, a title favourite having a
   genuinely bad year; a Bath manager who only presses Continue is sacked
   in 17 of 36; a minnow's never.
2. **Tired sides.** From minute 68, an emptied side now scores 4.17
   against 4.71 rested and concedes 3.31 against 2.81 (the old audit
   compared different matches, which is why it read the other way). A
   tired defence gives up to 80% more (was 50%), a tired attack up to 30%
   less.
3. **Subs matter.** The bench used to cost points: four changes about
   level with none, eight 0.4 worse. From the 56th minute an empty tank now
   keeps 60% of a side's strength, not 78%. New subvalueprobe: four changes
   +1.27 points over none, eight +1.32, so the bench pays and emptying it
   is no better than choosing well.
4. **Language review finished** in all six languages: every namespace,
   plus the match commentary, highlights and celebrations. Competition
   names now show in the reader's language on 18 screens and in the news
   (French: Elite 14 and Elite 2). Sentences on the player card start with
   a capital. The trophy press question names its trophies in the reader's
   language.
5. **Press Room quotes.** One rule per language for the manager's words
   (English “ ” with ‘ ’ inside, French « » with “ ”, Japanese 「」 with
   『』), questions no longer wrapped, and "No answer given." instead of an
   empty "You:".
6. **Finances Season balance chart** rebuilt: zero line, gridlines, week
   marks, start and end values, red below zero, tap a week to read it.
7. **Board decisions** stay on Finances > The Board for the whole season,
   and Continue takes you there when one is waiting (it used to open an
   empty Press Room).

## Owner round, afternoon of 28 Sep: bugs found writing the manual

The technical manual was written from the code, and its authors listed
what looked wrong. The owner chose six to fix before release:

1. **Pressing the board after a written warning sacks you.** Not a bug: it
   is the owner's own rule from 1.1.4, and the warning says so. Kept as is.
2. **Sponsor shopping.** Ending a deal early cost nothing and rerolled the
   offers on wider bands, so signing and ending again let a manager shop a
   slot for the top of its band. Now one early exit per slot per season,
   with a line on the card saying so (dealprobe).
3. to 5. **Match engine** (AI sides after substitutions, a departed goal
   kicker, starts and minutes): see below.
6. **A new career overwrote the save you were playing.** The wizard now
   uses an empty slot and says which; with all four full it asks which
   career to replace, and Start Career waits for the answer (new browser
   probe slotprobe).

## Still open

1. **The strongest squad has a losing season about one year in six**, under
   the AI too. That is the league's randomness, not the board, and changing
   it is a balance decision.
2. **memoprobe and other thin tests**: a separate pass is making every test
   use samples large enough to be trusted (report to follow).
3. **Spaced hyphens used as dashes** (" - ") remain in about 740 English
   lines; it has been the house style. A sweep to replace them is possible.
4. **Japanese commentary keeps its double dashes (——)**, which is normal
   Japanese punctuation.
5. **Tablet portrait layout**: 1.8.1, as agreed.
6. **Still open from the UI sweep**:
   - another club's page says "Club" rather than its name;
   - the World rankings movement column is mostly a lone dot.

## Areas that feel unfinished (most noticeable first)

1. Other clubs' pages: a generic title, a one-paragraph History tab and a
   bare squad list. Opening a rival should feel like scouting them.
2. The Finances "Season balance" chart (done 28 Sep).
3. Roll of Honour and Trophy Cabinet in season one: one line on an empty
   page for a whole season.
4. Tablet portrait: a phone-width column with dark bars either side.
5. World rankings: a static list with no reason to come back.
6. The Press Room when it is quiet.
7. Manager Profile specialities: four locked tiles with no sense of
   progress.
8. The Board section on Finances reads as a stub next to the rest.

## Owner to do (morning)

- Store listing, playtest, screenshot sign-off.
- Update the signing certificate for the change of ownership before the
  store release.
