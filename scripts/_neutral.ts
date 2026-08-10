// one-off: is the new growth mean-neutral, and what is the world facility mean?
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
const g0 = newGame('northampton', 'M', 7)
const clubs = Object.values(g0.clubs)
const fmean = clubs.reduce((s, c) => s + ((c.facilities?.paddock ?? 0) + (c.facilities?.gym ?? 0)) / 2, 0) / clubs.length
console.log('world mean (paddock+gym)/2 =', fmean.toFixed(2))
for (const seed of [7, 21]) {
  const g = newGame('northampton', 'M', seed)
  const before = new Map(Object.values(g.players).filter(p => p.age <= 22).map(p => [p.id, p.ca]))
  let weeks = 0
  const s0 = g.season
  while (g.season < s0 + 2 && weeks < 90) { processWeekAndAdvance(g); weeks++ }
  let sum = 0, n = 0
  for (const [id, ca0] of before) { const p = g.players[id]; if (p) { sum += p.ca - ca0; n++ } }
  console.log(`seed ${seed}: mean 2-season growth of starting u22s = ${(sum / n).toFixed(3)} over ${n} players`)
}
