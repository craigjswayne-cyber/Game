/**
 * ---- THE WAGE BUDGET MOVES WITH THE WAGES ----
 *
 * Player report, 1.9.6: "there is no wage room even if I join a different
 * club". The wage budget was set once, at the career's start, and never again,
 * so by season six 71 of 113 clubs had a bill at or over it. Five seasons on,
 * no club opens a season without room, and a manager who takes a new job
 * walks in to some.
 *
 * Run: npx vite-node scripts/wageroomprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { userWageBudget } from '../src/game/grants'
import { answerJobOffer } from '../src/game/jobs'
import type { GameState } from '../src/game/model'
import { ok, done } from './lib/probe'

const bill = (g: GameState, id: string) => g.clubs[id].players.reduce((s, p) => {
  const pl = g.players[p]
  return pl && !pl.acad ? s + pl.wage : s
}, 0)
const g = newGame('northampton', 'Probe', 7)
const s0 = g.season
let guard = 0
while (g.season < s0 + 5 && guard++ < 400) {
  const before = g.season
  processWeekAndAdvance(g)
  if (g.season !== before) {
    const ids = Object.keys(g.clubs)
    const over = ids.filter(id => bill(g, id) >= g.clubs[id].wageBudget)
    ok(over.length === 0, `season +${g.season - s0} opens with wage room at every club (${over.length}/${ids.length} without)`)
  }
}
// a move mid-season, to a club whose bill has run past its budget
for (let i = 0; i < 20; i++) processWeekAndAdvance(g)
const target = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
target.wageBudget = Math.round(bill(g, target.id) * 0.9)
g.vacancies.push({ clubId: target.id, week: g.week })
g.jobOffer = { clubId: target.id, week: g.week }
answerJobOffer(g, true)
ok(g.userClubId === target.id, `the staged offer at ${target.short} is taken`)
const u = g.clubs[g.userClubId]
ok(userWageBudget(g, u) > bill(g, u.id), `a manager walking in to ${u.short} has wage room (bill ${bill(g, u.id)}, budget ${userWageBudget(g, u)})`)
done()
