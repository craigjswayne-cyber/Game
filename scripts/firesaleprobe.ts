// 1.9.16: how hard is Fire Sale? The same clubs and seeds on Continue (the
// assistant picks the side, nothing is bought), four seasons, and whether the
// league was won. Run: CLUBS=leicester,bath SEEDS=1,2,3 npx vite-node scripts/firesaleprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'

const clubs = (process.env.CLUBS ?? 'leicester,bath,saracens').split(',')
const seeds = (process.env.SEEDS ?? '1,2').split(',').map(Number)
let won = 0, runs = 0
for (const club of clubs) for (const seed of seeds) {
  const g = newGame(club, 'Fire', seed, 'firesale')
  const pos: number[] = []
  let guard = 0
  while (g.season < 4 && !g.proChallenge?.done && !g.careerOver && guard++ < 260) {
    const s = g.season
    for (const n of g.news) n.read = true
    g.offers = []
    processWeekAndAdvance(g)
    if (g.season !== s) pos.push(g.history?.seasons?.at(-1)?.pos ?? -1)
  }
  runs++
  if (g.proChallenge?.done) won++
  console.log(`${club} seed ${seed}: ${g.proChallenge?.done ? 'WON in season ' + (g.season) : 'not won'} | finishes ${pos.join(',')} | over=${!!g.careerOver}`)
}
console.log(`FIRE SALE on Continue: league won in ${won} of ${runs} careers`)
