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
  'harlequins 30-55 bath',
  'sale 27-37 exeter',
  'gloucester 19-3 saracens',
  'leicester 44-38 bristol',
  'northampton 62-16 newcastle',
  'exeter 30-16 harlequins',
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
