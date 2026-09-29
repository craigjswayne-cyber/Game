# QA report: 1.8.1, 29 Sep 2026

Branch `claude/rugby-game-animation-ideas-qusfd5`. Play version code 42.
1.8.1 folds in what was planned as 1.9. The headline: the world remembers
your decisions.

## What was done

- **The manager's memory** (`src/game/memory.ts`). A small, career-wide log
  of decisions that have a subject: a player released or sold, a promise
  kept or broken, a knock played through, an academy debut given. The world
  reads it back and files a Wire story when it closes the loop ("You
  released X in 2026-27..."):
  - a former player scores against you, or is player of the match;
  - the first time a notable former player lines up against you;
  - a player you sold wins a cap;
  - a player rushed back through a knock breaks down;
  - agents remember broken promises: wage demands rise 4% per broken
    promise in a year, capped at 12%.
  No rng is drawn, at most one memory story a week, and every payoff fires
  once per subject. Stories never spend the id counter.
- **Club identity that emerges** (`identity.ts`). Four slow axes read from
  how the club is run: Running rugby or Kicking game, Pack-first or
  Back-line flair, Academy club or Big spenders, Well run or Living beyond
  their means. Small effects on player interest, academy intake, sponsors,
  supporters and the board, and Wire stories when a label forms. One line
  on the Club screen.
- **Dressing-room bonds** (`bonds.ts`). Friendships and rifts between
  players, two to four senior voices whose mood spreads, cliques that close
  ranks when shut out of the team sheet, and a "you sold my mate" knock at
  the office. The player profile shows "Close to" and "Clashes with".
- **The opposition report, match plan and post-match findings**
  (`oppreport.ts`, `matchfindings.ts`) on the Tactics prep tab and the
  full-time review. A plan only sets levers the manager could set by hand,
  so it adds no engine modifier; findings are read from the finished match
  and carried into the next report against the same side.
- **Career history that acts** (`history.ts`, `grudges.ts`, `legends.ts`).
  Rivalries that grow from finals and close title races, legends claimed
  while still playing, club records that talk as a player closes on them,
  annals under each season on the Legacy screen, and returning to a former
  club as the away manager (the crowd's welcome depends on how you left).
- **Attacking moves library** (`moves.ts`). Ten drilled moves: 1-3-3-1
  pods, 2-4-2, pods with a back door, crash ball, switch, miss and loop,
  decoy out the back, blindside wrap, 10-12 inside ball and 13 through the
  middle. Drilled like lineout calls, fitted to the players on the pitch and
  to the opposition's defence (each move beats one kind and is weak against
  another), named in the commentary, drawn in the highlight clips, and
  chosen on the Set Piece tab.
- **Squad and club.** Transfer windows enforced (weeks 1-7, 26 and 27);
  loans respect the cap, the wage budget and an embargo; a pre-contract's
  agreed wage is honoured; a development focus for five players; a yearly
  academy sign-or-release decision in week 45; many tester-note fixes.
- **Career and the wider world.** More variety in the news (tellings in
  rotation, new stories); the unemployed national coach fixed; the team
  sheet kept over the summer; the women's Grand Slam and Wooden Spoon;
  women's derbies; AI clubs no longer left without a coach; a sacked
  manager's old club runs its own books.
- **Match engine and preparation.** Every try counts as a visit to the 22,
  which fixes the "0 visits" beside a score; the user's match has its own
  dice; the default bench briefs vary; defenders turn and chase back after a
  line break in the highlight clips; the penalty diagram is drawn to scale;
  many preparation and set-piece fixes.
- **Screens.** The Discord link moved from the title screen to the foot of
  Home and to the manager menu under Main Menu; "Every minute" is now "Full
  commentary"; goal kickers are a tidy sheet like leadership; the bug
  report's mail subject reads "PHASE: Rugby Manager"; tablet portrait fills
  the screen; small changes are saved properly; deleting a save asks for
  confirmation.

## Suite results

**Suite results: to be filled after the final run.** The full suite is
still running on this branch at the time of writing.

| Check | Result |
|---|---|
| Full suite, `all` mode (engine, browser and soaks) | _to be filled after the final run_ |
| GitHub gate on the PR head | _to be filled after the final run_ |
| bandcheck | _to be filled after the final run_ (the figures below are from the balance branch) |

## Balance

| | 1.8.0 final | 1.8.1 | Target |
|---|---|---|---|
| Points a game | 49.5 | about 49.6 | 48-53 |
| Tries a game | 6.30 | about 6.3 | 6.0-6.6 |
| Home wins | 52.4% | about 53.2% | 51-57% |
| Draws | 1.6% | about 1.8% | 1.4-3.0% |
| Blowouts | 8.1% | about 8.8% | under 11% |

Every band is inside.

### References re-measured (no limit loosened without a measurement)

- **releasesim, the 90+ line.** The floor moved from 90 to 110. It was
  re-referenced on sixteen 1.8.0 worlds, where the mean was 84.9 with a
  standard deviation of 11.4, so the old line of 90 sat inside the normal
  spread and could fail a healthy world.
- **releasesim, the distress line.** From 30% of clubs to 40%. Two intended
  1.8.1 fixes (AI clubs no longer left coachless, and a sacked manager's old
  club running its own books) raise the measured figure from 26.0 to 31.5,
  while the share of clubs actually in the red is unchanged. The line
  follows the fixes rather than the other way round.
- **aiecon references.** Re-measured at every 1.8.1 merge: median about
  £0.08M, mean about £0.39M, and the median is now held to a band. The fix
  to the stadium friendly moved about £0.05M a club a season into the
  stands.

### Probes made sturdier or rebaselined

- **analystprobe:** the sample doubled to 48 seasons. It passes narrowly:
  the analyst's advice is ahead in 25 of 48.
- **fingerprint:** rebaselined twice, each for an intended change to the
  match stream:
  - the match-engine fixes: Harlequins 38-8 Leicester became 31-27;
  - the attacking moves: Exeter-Gloucester 20-3 became 3-30.
- **perfprobe:** flaky under shared-machine load (the suite and other work
  on the same machine). It is a timing check; a failure under load is not a
  regression unless it repeats on a quiet machine.
- **memoryprobe:** judges the natural payoffs over five careers, not one
  seed.

## Known issues and owner decisions

1. **Save-scumming a match by reopening.** Closing the game mid-match and
   reopening lets a manager replay it. Whether to prevent that is a policy
   call for the owner.
2. **A national coach raiding club rivals.** Whether a manager who also
   holds a national job should be able to use it against his club's rivals
   is a design question: keep, limit or remove.
3. **The exploit plan against analyst prep alone.** Choosing the report's
   exploit plan reads -1.25 points against the analyst's prep on its own.
   That is within noise, but it is not yet a gain.
4. **The Set Piece tab is about five screens long on a phone** now that the
   moves library sits there. A layout pass (collapsed sections or a sub-tab)
   is suggested.
5. **Women's leagues are missing from `LEAGUE_TIER`.** Anything that reads
   a league's tier from that table has no entry for them.
6. **The tour calendar year**: the summer tour's year needs checking against
   the season it belongs to.

## Owner to do

- Check the highest accepted version code on the Play Console before the
  upload (42 is assumed free).
- Store listing ("What's new" for code 42 in six languages is in
  `docs/store-listing.md`), playtest and screenshot sign-off.
- The decisions under "Known issues and owner decisions" above.
