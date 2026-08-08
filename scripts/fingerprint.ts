// Stream fingerprint: exact scores of fixed-seed matches. If this fails,
// something changed the sim's rng consumption - either a bug, or a deliberate
// mechanical change that must update EXPECTED below in the same commit.
// Commentary/flavour additions must NEVER move these numbers (EK/ER lessons).
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const g = newGame('leicester', 'Fingerprint', 424242)
const league = g.fixtures.filter(f => f.week >= 4 && f.week <= 8 && g.clubs[f.homeId] && g.clubs[f.awayId])
const picks = league.slice(0, 6)
const results: string[] = []
picks.forEach((fx, i) => {
  simMatch(g, fx, mulberry32(1000 + i), i < 3) // 3 detailed, 3 quick
  results.push(`${fx.homeId} ${fx.homeScore}-${fx.awayScore} ${fx.awayId}`)
})

const EXPECTED: string[] = [
  // Rebaselined: the bench economy (F4). Clubs now name a 5-3, 6-2 or 4-4 bench,
  // the closing quarter takes the shape the 23 was picked for once three
  // replacements are on, and a side forced to put a forward in a back's shirt
  // pays for it. All three are deliberate mechanical changes, so individual
  // results move.
  //
  // Balanced first, as always: the two alternative splits are mirror images, and
  // the cover charge had to be re-derived because the obvious-looking numbers
  // (attack 0.92, defence 0.96) cost the world 0.4 points a game. Neutrality
  // needs 0.55 * attackLoss == 0.7 * defenceLoss, because that is how the two
  // sides of the ratio are weighted. World scoring is 52.7 against a 52.8
  // baseline, tries and home advantage unmoved.
  //
  // Moved again by feedback 10C: five of the eight bench seats are now OPEN and
  // take whoever you put in them, so the engine reads the split the bench
  // ACTUALLY is rather than the one that was chosen. Verified across the world:
  // intent and reality agree on all 101 clubs (19 six-twos, 68 five-threes, 14
  // four-fours) and every bench covers the front row, so this closed a loophole
  // rather than changing the balance. 52.9 points a game against 52.8.
  //
  // Rebaselined by feedback 10G, the academy round. TWO deliberate changes to
  // world generation, neither of them in the match engine:
  //
  //   The academy is a 27-man squad rather than four named prospects, so newGame
  //   draws 27 players per club where it drew 4 - about 2,300 extra rng calls
  //   before the league draw is even made. That is why the FIXTURES here differ
  //   and not just the scores: the draw itself sees a different stream.
  //
  //   The senior filler now counts SENIOR positions when it looks for the thinnest
  //   shirt. Counting the whole squad meant 27 academy men made every position
  //   look three deep, so the fill spread at random instead of covering real gaps.
  //   Position choice gates a `rng() < 0.3` goal-kicker roll, so fixing it moves
  //   the stream again.
  //
  // Balance verified over four seeds before rebaselining, as always: 52.3 / 52.5 /
  // 52.6 / 52.9 points a game, 5.9-6.0 tries, 55-56% home, 2.2-2.4% draws, across
  // 11,110 league games each. The default seed sits 0.2 under the 52.5 band floor
  // and three of the four sit inside it, so that is seed spread, not a leak - and
  // reaching for a dial to buy back 0.2 points is how the balance gets broken.
  //
  // The A League has its own scoreline model and never enters this stream;
  // scripts/acadprobe.ts holds its distribution to the same band.
  //
  // REBASELINED for the 2025/26 Premiership squad merge. The whole stream depends
  // on who is in the ten Premiership squads, and this round rebuilt them from the
  // user's fact-checked guide: 151 men in, 80 out, and the fixture list itself
  // therefore falls differently. Nothing mechanical changed - no dial was touched
  // and the healthy band held at 52.4 points, 5.9 tries, 56% home, 2.1% draws.
  // A data change of this size cannot leave the fingerprint alone, and pretending
  // otherwise would mean keeping a baseline that no longer describes the game.
  // REBASELINED again, one round later, for the unique-name work. The name pools
  // went from twelve of each to thirty-six and regenName now retries against a
  // registry, so a generated player consumes a different number of rng draws than
  // he used to and every stream downstream of him shifts. Names only: no dial, no
  // rating, no rule. Band held at 52.7 points, 6.0 tries, 55% home, 2.4% draws.
  // NOT rebaselined in the full-audit round, and worth writing down why. That round
  // made two engine changes and this file did not move a digit, because neither of
  // them can reach this stream: the board's per-result swing is applied by
  // processWeekAndAdvance, which the fingerprint never calls, and the analyst payoff
  // needs state.matchPrep set, which it never sets. The two fixes were:
  //   - the board's per-result swing had no floor, so past 1.25 of reputation
  //     difference it changed sign: a big club LOST confidence for beating a
  //     minnow and a small one GAINED it for losing to a giant.
  //   - the analyst's read did nothing. matchPrep gave the same flat bonus
  //     whether the read was sound or nonsense, so a correctly-read weakness now
  //     pays a modest extra edge and a wrongly-read one still pays nothing.
  // Band held: 52.7 points, 6.0 tries, 55% home, 2.4% draws. A test that stays
  // still when you expected it to move is worth a second look, and this is what
  // the second look found.
  //
  // REBASELINED for F23, AI coaching philosophies. This is a deliberate
  // mechanical change: the 100 dugouts you are not sitting in no longer all
  // hold style 50, tempo 50, kicking 50, aggression 50. Each has a philosophy
  // that sets all four, so every side in this stream except Leicester (the user
  // club, whose dials stay yours) now plays to an instruction.
  //
  // ONE of the six results moved, which was worth checking rather than
  // accepting. The dials are genuinely in the stream: slam all eight
  // philosophies to the 0/100 extremes and four of the six results move. The
  // other five held at the real settings because a rugby score is coarse - a
  // few per cent on a unit rating often does not flip a discrete event.
  //
  // Mean-neutral, measured rather than argued. The eight philosophies are four
  // pairs that mirror exactly about 50 on all four dials, and which member of a
  // pair a club gets is decided by whether its squad leans to the pack compared
  // with the rest of the world (the world median, NOT zero - see philosophy.ts
  // for the 67%-pack-heavy measurement that made that necessary). Over nine
  // worlds of ten seasons each, about 100,000 league games a side:
  //   points  52.46 -> 52.54     tries   5.92 -> 5.93
  //   home    55.1% -> 55.2%     draws   2.33% -> 2.37%
  // Well inside the healthy band and inside seed-to-seed noise. The world-wide
  // dial averages come out at style 50.4, tempo 50.4, kicking 49.7,
  // aggression 50.1; scripts/philprobe.ts holds them there.
  'gloucester 70-31 newcastle',
  'bristol 23-24 sale',
  'leicester 20-16 northampton',
  'exeter 9-14 bath',
  'saracens 38-20 harlequins',
  'sale 30-16 gloucester',
]

if (EXPECTED[0] === '@@EXPECTED@@') {
  console.log('BASELINE (paste into EXPECTED):')
  for (const r of results) console.log(`  '${r}',`)
} else {
  let ok = true
  results.forEach((r, i) => {
    if (r !== EXPECTED[i]) { ok = false; console.log(`MISMATCH at ${i}: got '${r}', expected '${EXPECTED[i]}'`) }
  })
  console.log(ok ? 'FINGERPRINT PASSED: sim stream unchanged' : 'FINGERPRINT FAILED: the sim stream moved - deliberate mechanical change, or a leak?')
  if (!ok) process.exit(1)
}
