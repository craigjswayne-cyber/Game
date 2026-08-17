// Measurement: is "always aim high" a free lunch?
//
// The war chest hands the manager money at the season launch. The claw takes
// it back with interest when the promise is missed. Whether those cancel is
// not a matter of argument - it depends on how often a real career beats the
// pundits' number, and on how much the scaled morale bump moves results. So:
// paired careers, same seeds, one arm always answers 'Judge us in May' and
// the other always backs the board's targets, and the ledger decides.
//
// Spendable money is sampled at week 3 of every season - after the question
// is answered, so the sample sees the bump - and the claw shows up in the
// following season's refresh. If the high arm nets meaningfully more money
// per season than the board arm, the interest rate is too kind and the free
// lunch is back; meaningfully less and aiming high is a trap. Points and
// sackings are reported alongside so a money-neutral dial that quietly wins
// the league does not sneak past.
//
// Usage: npx tsx scripts/stancecheck.ts [seeds] [seasons]
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import type { GameState } from '../src/game/model'

const SEEDS = Number(process.argv[2] ?? 8)
const SEASONS = Number(process.argv[3] ?? 3)

type ArmResult = {
  moneySeen: number      // sum of week-3 budgets across seasons
  points: number         // league points accumulated (from finishes we can see)
  finishes: number[]
  sacked: boolean
  answered: number
  clawNews: number
  keptNews: number
}

function runArm(seed: number, stance: 'high' | 'board'): ArmResult {
  const g = newGame('northampton', 'Check', seed)
  const s0 = g.season
  const r: ArmResult = { moneySeen: 0, points: 0, finishes: [], sacked: false, answered: 0, clawNews: 0, keptNews: 0 }
  let sampledFor = -1
  // settlements are counted week by week against a seen-id set: the news log
  // is trimmed underneath a season-end read (the wireprobe lesson), so a
  // count taken once at the finish undercounts every earlier summer
  const seenNews = new Set<number>()
  for (let i = 0; i < (SEASONS * 50) && g.season < s0 + SEASONS; i++) {
    // answer the launch question the arm's way, the week it lands
    const q = g.press.find(p => !p.answered && p.options.some(o => o.stance))
    if (q) {
      const idx = q.options.findIndex(o => o.stance === stance)
      if (idx >= 0) { answerPress(g, q.id, idx); r.answered++ }
    }
    // sample spendable money once a season, after the launch decision
    if (g.week >= 3 && sampledFor !== g.season) {
      sampledFor = g.season
      r.moneySeen += g.clubs[g.userClubId].budget
    }
    if (g.unemployed) { r.sacked = true; break }
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (seenNews.has(n.id)) continue
      seenNews.add(n.id)
      if (n.subject.includes('recalls the war chest')) r.clawNews++
      if (n.subject.includes('war chest is yours to keep')) r.keptNews++
    }
  }
  for (const f of g.mgr.finishes) r.finishes.push(f.pos)
  return r
}

const rows: { seed: number; hi: ArmResult; bd: ArmResult }[] = []
for (let s = 0; s < SEEDS; s++) {
  const seed = 101 + s * 7
  const hi = runArm(seed, 'high')
  const bd = runArm(seed, 'board')
  rows.push({ seed, hi, bd })
  console.log(`seed ${seed}: money hi ${(hi.moneySeen / 1e6).toFixed(2)}m v bd ${(bd.moneySeen / 1e6).toFixed(2)}m | finishes hi [${hi.finishes}] bd [${bd.finishes}] | claws ${hi.clawNews}, kept ${hi.keptNews}${hi.sacked ? ' | SACKED(hi)' : ''}${bd.sacked ? ' | SACKED(bd)' : ''}`)
}

const seasonsSeen = rows.reduce((s, r) => s + Math.min(r.hi.finishes.length, SEASONS), 0)
const dMoney = rows.reduce((s, r) => s + (r.hi.moneySeen - r.bd.moneySeen), 0)
const claws = rows.reduce((s, r) => s + r.hi.clawNews, 0)
const kepts = rows.reduce((s, r) => s + r.hi.keptNews, 0)
const meanFin = (k: 'hi' | 'bd') => {
  const all = rows.flatMap(r => r[k].finishes)
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0
}
// paired per-seed money deltas, for a noise floor on the mean
const deltas = rows.map(r => (r.hi.moneySeen - r.bd.moneySeen) / 1e6)
const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length
const sd = Math.sqrt(deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, deltas.length - 1))
const sem = sd / Math.sqrt(deltas.length)

console.log(`\n${SEEDS} paired careers, ${SEASONS} seasons each (${seasonsSeen} arm-seasons scored)`)
console.log(`promise settled: ${claws} clawed, ${kepts} kept (${claws + kepts ? Math.round((100 * claws) / (claws + kepts)) : 0}% miss rate)`)
console.log(`money, high minus board: ${mean >= 0 ? '+' : ''}${mean.toFixed(2)}m per career (SEM ${sem.toFixed(2)}m) = ${(mean / SEASONS * 1000).toFixed(0)}k a season`)
console.log(`mean league finish: high ${meanFin('hi').toFixed(2)} v board ${meanFin('bd').toFixed(2)}`)
console.log(`sacked: high ${rows.filter(r => r.hi.sacked).length}, board ${rows.filter(r => r.bd.sacked).length}`)
