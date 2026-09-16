import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS } from '../../src/game/model'
const g = newGame('leicester', 'Timing', 2026)
const out: string[] = []
for (let s = 0; s < 15; s++) {
  const t0 = Date.now(); const target = g.season + 1; let guard = 0; let maxWeek = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const w0 = Date.now()
    const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
    maxWeek = Math.max(maxWeek, Date.now() - w0)
  }
  const j0 = Date.now(); const bytes = JSON.stringify(g).length; const jms = Date.now() - j0
  out.push(`season ${g.season}: ${Date.now() - t0} ms, slowest week ${maxWeek} ms, JSON.stringify ${jms} ms for ${(bytes / 1e6).toFixed(2)} MB`)
}
console.log(out.join('\n'))
