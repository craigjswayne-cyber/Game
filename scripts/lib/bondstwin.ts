// One twin of bondsprobe's section 10: a career played for a season and a
// half with the bonds ledger on or off, writing every week's AI-v-AI results
// (fixture id and score) and, at the end, the AI fixture list.
//
//   npx vite-node scripts/lib/bondstwin.ts on|off <out.json>
//
// A separate process per twin ON PURPOSE: two careers played in one process
// do not stay identical even with the ledger off in both (some module-level
// state in the engine carries from one to the other, measured by
// bondsprobe's control twin), so the comparison has to start clean each time.
import { writeFileSync } from 'node:fs'
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { bondsSwitch } from '../../src/game/bonds'
import type { GameState } from '../../src/game/model'

const on = process.argv[2] === 'on'
const out = process.argv[3]
bondsSwitch.on = on
const g = newGame('leicester', 'Bonds Twin', 181)
const ai = (x: GameState) => x.fixtures.filter(f => f.homeId !== x.userClubId && f.awayId !== x.userClubId)
const weeks: string[] = []
const s0 = g.season
let n = 0
while ((g.season < s0 + 1 || g.week < 20) && n++ < 120) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
  for (const q of g.press) if (!q.answered && q.options.length) answerPress(g, q.id, 0)
  weeks.push(ai(g).filter(f => f.played).map(f => `${f.id}:${f.homeScore}-${f.awayScore}`).sort().join('|'))
}
writeFileSync(out, JSON.stringify({
  weeks,
  list: ai(g).map(f => f.id).sort((a, b) => a - b).join(','),
  pairs: g.bonds?.pairs.length ?? 0,
  stories: g.news.filter(x => x.k?.startsWith('news.bond')).length,
}))
