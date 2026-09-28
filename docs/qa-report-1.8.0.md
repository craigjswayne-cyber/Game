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

## Open findings, for your decision

1. **The engaged manager at a big club is sacked more since E5-E8.**
   - At Bath, a manager doing everything right hits board crisis in 5 of
     12 seasons and is sacked in 2. Before E5-E9 it was 0 crises.
   - AI respect (E9) is ruled out: switching it off changed nothing.
   - The cause is somewhere in growth by the gap, dearer high attributes,
     professionalism or scouted temperament.
   - Needs a proper look in 1.8.1. It isn't a crash, but a player doing
     everything right at a giant can lose the job about one season in six.
2. **The language review is not complete.** The agent stopped on the
   account's monthly spend limit. What it finished passes every check (key
   parity, placeholders, no emoji, no em dashes). Not reached:
   - its last batch of screens: till, store, settings, sack, isles, close
     and point;
   - the match commentary and highlight lines (the comm and hl sets).
3. **Japanese commentary keeps 63 double dashes (——).** This is normal
   Japanese punctuation, left alone.
4. **UI items the sweep found but left for a decision:**
   - Another club's page says "Club" in its header, not the club's name,
     and keeps the tab you last used.
   - World rankings: the movement column is mostly a lone dot.
   - Press Room: quotes inside quotes display wrongly, and unanswered
     questions show an empty "You:".
   - Finances: the "Season balance" chart has no axis and says little;
     "show the lines" is lower case.
   - French: Team of the Week shows English competition names, and the
     player summary starts with a lower-case letter.

## Areas that feel unfinished (most noticeable first)

1. Other clubs' pages: a generic title, a one-paragraph History tab and a
   bare squad list. Opening a rival should feel like scouting them.
2. The Finances "Season balance" chart.
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
