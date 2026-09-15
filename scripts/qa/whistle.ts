// Late-penalty presentation: HT/FT line score vs scoreboard; event score snapshot; try/conversion wording.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { beginMatch, stepTick, resolveDecision, simMatch } from '../../src/game/matchEngine'
import type { GameState } from '../../src/game/model'

const g = newGame('bath', 'QA', 99)
let n = 0, htWrong = 0, ftWrong = 0, ftSnapWrong = 0, htCases = 0, ftCases = 0, postsCon = 0, cornerCon = 0
const ex: string[] = []
for (let wk = 0; wk < 48 && n < 400; wk++) {
  const fx = userFixtureThisWeek(g)
  if (fx) {
    // several replays of the same fixture on clones with different choices
    for (let v = 0; v < 8; v++) {
      const c = JSON.parse(JSON.stringify(g)) as GameState
      const cfx = c.fixtures.find(f => f.id === fx.id)!
      const rng = weekRng(c)
      for (let i = 0; i < v; i++) rng()
      const ctx = beginMatch(c, cfx, rng, true, c.userClubId)
      let lastDecisionMin = -1
      let guard = 0
      while (ctx.seg < 3 && guard++ < 60) {
        if (ctx.decision) { lastDecisionMin = ctx.decision.min; resolveDecision(c, ctx, 'posts') }
        const r = stepTick(c, ctx)
        if (ctx.decision) {
          lastDecisionMin = ctx.decision.min
          if (r === 'HT') htCases++
          if (r === 'FT') ftCases++
          resolveDecision(c, ctx, 'posts')
        }
        if (r === 'FT') break
      }
      n++
      const ev = ctx.events
      let h = 0, a = 0
      for (let i = 0; i < ev.length; i++) {
        const e = ev[i]
        if (e.type === 'HT' && e.k === 'comm.halfTime') {
          if (e.v?.hs !== h || e.v?.ascore !== a) { htWrong++; if (ex.length < 6) ex.push(`HT line "${e.text}" but scoreboard before it ${h}-${a} (prev: ${ev[i - 1]?.min}' ${ev[i - 1]?.type} ${ev[i - 1]?.k} ${ev[i - 1]?.homeScore}-${ev[i - 1]?.awayScore})`) }
        }
        if (e.type === 'FT' && e.k === 'comm.fullTime') {
          if (e.v?.hs !== cfx.homeScore || e.v?.ascore !== cfx.awayScore) ftWrong++
          if (e.homeScore !== cfx.homeScore || e.awayScore !== cfx.awayScore) { ftSnapWrong++; if (ex.length < 6) ex.push(`FT event snapshot ${e.homeScore}-${e.awayScore} but fixture ${cfx.homeScore}-${cfx.awayScore} (text "${e.text}")`) }
        }
        h = Math.max(h, e.homeScore); a = Math.max(a, e.awayScore)
        // try under the posts followed by a touchline conversion
        if (e.type === 'CON' && (e.k === 'comm.con3' || e.k === 'comm.con8')) {
          const t = ev.slice(0, i).reverse().find(x => x.type === 'TRY')
          if (t && (t.k === 'comm.try5' || t.k === 'comm.try21')) { postsCon++; if (ex.length < 8) ex.push(`wording: "${t.text}" then "${e.text}"`) }
          if (t && (t.k === 'comm.try2' || t.k === 'comm.try26' || t.k === 'comm.tryWet3')) cornerCon++
        }
      }
    }
    simMatch(g, fx, weekRng(g), true)
  }
  processWeekAndAdvance(g)
}
console.log(`matches=${n} lateHTpenalties=${htCases} lateFTpenalties=${ftCases} HT-line-wrong=${htWrong} FT-line-wrong=${ftWrong} FT-event-snapshot-wrong=${ftSnapWrong}`)
console.log(`try-under-posts then touchline-conversion wording: ${postsCon}; corner try + touchline con (fine): ${cornerCon}`)
for (const e of ex) console.log('  ' + e)
