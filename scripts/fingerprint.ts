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
  // Rebaselined: the referee panel and Law 3. Each referee now carries four
  // separate opinions (scrum pedantry, jackal tolerance, patience, flow) instead
  // of one of three buckets, and a 23 without cover at all three front-row
  // positions gets uncontested scrums. Both change what the engine weighs, so the
  // scores move. A deliberate mechanical change - and note that the panel was
  // deliberately balanced mean-neutral first, so world scoring is unchanged at
  // 52.8 points a game even though every individual result differs.
  'northampton 33-19 sale',
  'bath 27-17 newcastle',
  'exeter 19-3 leicester',
  'harlequins 24-51 bristol',
  'gloucester 37-24 saracens',
  'newcastle 12-55 northampton',
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
