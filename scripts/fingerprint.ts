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
  // Rebaselined again: three more relocations (Nicky Smith to Leicester, Sheedy
  // to Cardiff, Rebbadj to Toulon) and the first hand-added player, La
  // Rochelle's second scrum-half. Every one changes how many men a club builds,
  // which shifts the world-creation stream and the fixture draw. A deliberate
  // data change, not a leak - the same reason as rounds GW and HC.
  'saracens 68-20 newcastle',
  'bristol 23-24 northampton',
  'exeter 22-10 bath',
  'harlequins 13-28 leicester',
  'sale 40-29 gloucester',
  'northampton 30-16 saracens',
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
