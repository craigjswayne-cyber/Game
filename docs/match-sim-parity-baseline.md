# Match sim parity: the baseline

The first measurement of the new simulation (`src/game/sim/`) against the current engine, before any tuning. Spec: `docs/match-sim-spec.md` section 5.

Run: `npx vite-node scripts/paritycheck.ts` (40 pairings x 300 matches on each engine, 21 November 2026, about 5 minutes). Per-pairing numbers are in `scripts/tmp/parity.json`. The full run in the spec is `npx vite-node scripts/paritycheck.ts 200 2000` (about 3 hours on this machine).

## Verdict

**PARITY FAILED.** The two engines agree on which side is better (correlation 0.94) and on draws, but the new simulation turns every gap into a bigger one, gives the home side less, and scores about 3 points a game more.

| | Gap (mean of new minus old, ignoring sign) | Tolerance | Noise floor at 300 matches | Average lean (new minus old) |
|---|---|---|---|---|
| Home win % | 10.4 | 1.5 | 2.9 | -1.7 |
| Total points | 4.4 | 1.0 | 0.9 | +3.2 |
| Total tries | 0.54 | 0.2 | 0.14 | +0.12 |
| Draw % | 0.9 | - | - | 0.0 |
| Home margin | 5.4 | - | - | -1.2 |

Correlation of home win % across pairings: 0.944. Correlation of home margin: 0.954. Only 4 of 40 pairings are within 1.5 points on home win %, and only 17 are within what the dice alone would explain.

The noise floor is what two identical engines would still show at this sample size. Every gap above is well clear of it, so these are real differences, not dice.

## The sample

40 league fixtures from 4 games (Leicester, Toulouse, Northampton and Leinster as the user's club, each on its own seed), measured in the week they fall, spread over 8 leagues (prem, top14, prod2, champ, natl1, srp, jl1, mrc). By the old engine's home win %, 23 are close (within 15 of 50), 16 comfortable and only 1 a mismatch (old home win % ran from 13 to 83). League fixtures are mostly even, so the mismatch band is barely tested; the full run should add cup and cross-league fixtures to fill it.

## The three biggest problems

**1. The stronger side is rewarded far too much.** Fitting the new engine's mean home margin to the old one's across the 40 pairings gives `new = -2.1 + 1.58 x old`. A side that wins by 10 on average in the old engine wins by about 14 in the new one, and the average size of the margin goes from 7.3 to 12.2 points. The worst ten pairings all go the same way: a 45% home side becomes 19% (Ampthill v Nottingham), a 74% side becomes 92% (Nottingham v Rotherham). It is worst in the lower leagues (Championship, National One, Pro D2), where a side's units spread more widely around the league mean. Two things add to it: the strength map (`(unit / league mean) ^ GAMMA`, GAMMA 1.6 in `fromMatch.ts`) is steeper than what the old engine does with the same units, and the new match is less random inside itself (spread of margins 16.3 against 18.3), so the better side's edge shows through more often. Both push win rates away from 50.

**2. Home advantage is too small.** Home sides win 50.7% against 52.4%, and the mean home margin is 0.4 points against 1.6. The fit above says that where the old engine has the two sides level once home advantage is in (old margin 0), the new one has the away side about 2 points better. My reading: splitting the old engine's `hfa` as a square root on each side (`HFA_SHARE` 0.5) does not carry the whole edge through the new contests, and the home edge appears to be lost in the mapping, not in any one contest. This needs its own check on even sides before anyone tunes it.

**3. Too many points, and not from tries.** 52.0 points a game against 48.8, but tries are only 6.45 against 6.33. Points not from tries (conversions, penalty goals, drop goals) go from 17.1 to 19.8. The excess grows with the gap between the sides: +2.2 where the old margin is under 4 points, +4.6 where it is over 8. So it is goal kicking and penalties, and it is worst when one side is on top (more penalties won in the opponent's half, more shots at goal). The new engine also does not track which fixtures score heavily: the correlation of total points across pairings is only 0.38, so whatever makes one fixture high-scoring in the old engine (weather, styles of play, kicking) mostly does not reach the new one.

## What is fine

Draw rate is identical on average (1.82% both). Tries are close on average. Which side is better is almost always agreed.

## A note on the tolerances

At 300 matches a pairing, two engines that agreed exactly would still differ by about 2.9 points of home win % and 0.9 points of scoring, from the dice alone. That is above the 1.5 tolerance for home win %, so the default run can never pass that test, whatever the engines do. At the spec's 2,000 matches the floor is about 1.1, still close to 1.5. The default run is for finding the shape of a problem; passing needs the full run, and the home win % test may be fairer as "average lean within 1.5, gap within twice the noise floor".

## How it was measured

Old engine: `simMatch` on a fresh copy of the game for every match, so injuries, condition and chemistry never carry over. The copy clones every part of the state except the players table, which is cloned player by player as the match reads them. At start-up the script checks this copy gives exactly what a full `structuredClone` gives on the same dice, and that the real game is untouched.

New engine: `worldFromMatch` once per pairing, reused across matches. The world keeps a private map of carded players between matches; the script puts every carded player back on after each match. The start-up check holds that a reused world gives exactly the same results as a fresh one. Because the dice given to `worldFromMatch` move the crowd and so the referee's lean, four worlds are built per pairing on different dice and the matches rotate through them.

No tuning was done: `src/game/sim/skeleton.ts` and `fromMatch.ts` are unchanged.
