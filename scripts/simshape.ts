// THE SHAPE OF A MATCH (2.0.0 stage 1). Plays N skeleton matches and holds the
// averages against the numbers in docs/match-sim-spec.md section 4 and the
// owner's decisions in section 8. Run: npx vite-node scripts/simshape.ts [N]
import { simSkeleton } from '../src/game/sim/skeleton'

const N = Number(process.argv[2] ?? 1000)
const sum: Record<string, number> = {}
const add = (k: string, v = 1) => { sum[k] = (sum[k] ?? 0) + v }
let homeWins = 0, draws = 0, errors = 0, maxPlays = 0
for (let i = 0; i < N; i++) {
  let r
  try { r = simSkeleton({ seed: 1000 + i }) } catch (e) { errors++; if (errors < 4) console.log('ILLEGAL', (e as Error).message); continue }
  maxPlays = Math.max(maxPlays, r.plays.length)
  for (const p of r.plays) {
    add('live', p.live)
    if (p.kind === 'ruck' || p.kind === 'maul') add('rucks')
    if (p.kind === 'kick') add('kicks')
    if (p.kind === 'scrum') add('scrums')
    if (p.kind === 'lineout') add('lineouts')
    if (p.kind === 'penalty' || p.kind === 'freeKick') add('pens')
    if (p.kind === 'try') add('tries')
    if (p.kind === 'penaltyGoal') { add('goalKicks'); if (p.good) add('penGoals') }
    if (p.kind === 'conversion' && p.good) add('cons')
    if (p.kind === 'yellowCard') add('yellows')
    if (p.kind === 'lineBreak') add('breaks')
    if (p.kind === 'knockOn' || p.kind === 'forwardPass') add('handling')
    if (p.kind === 'ruck' && p.result === 'turnover') add('turnovers')
    if (p.kind === 'lineout' && p.result === 'won') add('lineoutsWon')
    if (p.kind === 'carry') add('carries')
  }
  add('points', r.score[0] + r.score[1]); add('plays', r.plays.length)
  if (r.score[0] > r.score[1]) homeWins++; else if (r.score[0] === r.score[1]) draws++
}
const n = N - errors, a = (k: string) => (sum[k] ?? 0) / n
const rows: [string, number, number, number, string][] = [
  ['ball in play (min)', a('live') / 60, 33, 37, 'RWC 2019 35m44, RWC 2023 34m18'],
  ['rucks and mauls', a('rucks'), 160, 185, 'RWC 2019 174'],
  ['kicks from hand', a('kicks'), 40, 50, 'RWC 2019 45'],
  ['scrums', a('scrums'), 12, 16, 'RWC 2019 14, RWC 2023 15'],
  ['lineouts', a('lineouts'), 23, 28, 'RWC 2019 25, RWC 2023 27'],
  ['penalties and free kicks', a('pens'), 10.5, 12.5, 'owner: between 6 and 17'],
  ['tries', a('tries'), 6.0, 6.6, 'the game band'],
  ['points', a('points'), 48, 53, 'the game band'],
  ['lineout won on own throw %', 100 * a('lineoutsWon') / Math.max(1, a('lineouts')), 85, 91, 'RWC 2023 90%'],
]
let bad = 0
console.log(`${n} matches (${errors} threw an illegal sequence), up to ${maxPlays} entries a match\n`)
for (const [name, v, lo, hi, src] of rows) { const ok = v >= lo && v <= hi; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'OFF '} ${name.padEnd(28)} ${v.toFixed(1).padStart(6)}   target ${lo} to ${hi}   (${src})`) }
console.log(`\nalso: penalty goals ${a('penGoals').toFixed(1)} of ${a('goalKicks').toFixed(1)} kicks, conversions ${a('cons').toFixed(1)}, yellow cards ${a('yellows').toFixed(2)}, line breaks ${a('breaks').toFixed(1)}, knock-ons and forward passes ${a('handling').toFixed(1)}, ruck turnovers ${a('turnovers').toFixed(1)}, carries ${a('carries').toFixed(0)}, entries ${a('plays').toFixed(0)}`)
console.log(`even sides: home wins ${(100 * homeWins / n).toFixed(1)}%, draws ${(100 * draws / n).toFixed(1)}%`)
console.log(bad || errors ? `\nSHAPE OFF: ${bad} rows outside target, ${errors} illegal` : '\nSHAPE HOLDS: every row inside its target, no illegal sequence')
