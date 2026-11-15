/**
 * ---- THE PENALTY CALL WAITS FOR THE MANAGER (1.9.13) ----
 *
 * Player feedback: "During matches, improve timing for penalties so no play
 * happens till I decide the penalty". The engine always stopped for the call,
 * but the rest of the four-minute tick still played (for the dice), and its
 * lines were written AFTER "the captain looks to the touchline": in 6 asks out
 * of 6 the ticker showed scrums, lineouts, even a card or an injury before the
 * call buttons came up. The line is now held to the end of the tick.
 *
 *   1. Nothing is written between the ask and the manager's answer.
 *   2. The ask still comes, and the match still reaches full time.
 *   3. The dice are untouched: the same matches end with the same scores as
 *      a silent replay of them (the line is words only).
 *
 * Run: npx vite-node scripts/penaltywaitprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, stepTick, resolveDecision } from '../src/game/matchEngine'
import { ok, done } from './lib/probe'

let asks = 0, after = 0, full = 0, played = 0, same = 0
const samples: string[] = []
for (const seed of [11, 22, 33, 44, 55, 66, 77, 88, 99, 111]) {
  const base = newGame('leicester', 'Pen Wait', seed)
  let fx = null
  for (let w = 0; w < 12 && !fx; w++) { fx = userFixtureThisWeek(base); if (!fx) processWeekAndAdvance(base) }
  if (!fx) continue
  played++
  const scores: string[] = []
  for (const watched of [true, false]) {
    const g = structuredClone(base)
    const ctx = beginMatch(g, fx, weekRng(g, 'pw' + seed), watched)
    for (let guard = 0; guard < 600; guard++) {
      if (ctx.decision) {
        if (watched) {
          asks++
          const i = ctx.events.map(e => e.k).lastIndexOf('comm.penKickableAsk')
          const extra = ctx.events.slice(i + 1)
          if (i < 0 || extra.length) { after++; if (samples.length < 3) samples.push(extra.map(e => `${e.min}' ${e.k}`).join(' | ')) }
        }
        resolveDecision(g, ctx, 'posts'); continue
      }
      if (ctx.awaiting) { ctx.awaiting = null; continue }
      if (ctx.seg >= 3) break
      stepTick(g, ctx)
    }
    if (watched && ctx.seg >= 3) full++
    scores.push(`${ctx.home.score}-${ctx.away.score}`)
  }
  if (scores[0] === scores[1]) same++
}
console.log(`  ${played} matches, ${asks} calls asked, ${after} with lines after the ask`)
for (const s of samples) console.log('    ' + s)
ok(asks > 0, `the manager is still asked for the call (${asks} asks)`)
ok(after === 0, `nothing is said between the ask and the answer (${after} of ${asks} had lines after it)`)
ok(full === played, `every match reaches full time (${full}/${played})`)
ok(same === played, `watched and silent end with the same score: the held line draws nothing (${same}/${played})`)
done('PENALTY WAIT PROBE', 'the ticker stops at the call and nothing plays on until it is answered')
