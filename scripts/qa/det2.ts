import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'
function week(g: GameState) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
let A = newGame('bath', 'Det', 777)
let B = newGame('bath', 'Det', 777)
for (let w = 0; w < 6; w++) {
  const ka = Object.keys(A.players).length, kb = Object.keys(B.players).length
  const ja = JSON.stringify(A).length, jb = JSON.stringify(B).length
  console.log(`step ${w}: players A ${ka} B ${kb}; json A ${ja} B ${jb}; nextId ${A.nextId}/${B.nextId}; natSquads ${Object.keys(A.natSquads).length}/${Object.keys(B.natSquads).length}`)
  // which ids in A but not B
  const missing = Object.keys(A.players).filter(k => !(k in B.players))
  if (missing.length) console.log('  in A not B:', missing.slice(0, 5), 'count', missing.length, 'sample', JSON.stringify(A.players[Number(missing[0])]).slice(0, 200))
  week(A); week(B)
  B = JSON.parse(JSON.stringify(B))
}
// migrate idempotency on a fresh game
const F = newGame('bath', 'Det', 777)
const m1 = migrate(JSON.parse(JSON.stringify(F)))
const m2 = migrate(JSON.parse(JSON.stringify(m1)))
const m3 = migrate(JSON.parse(JSON.stringify(m2)))
const wsum = (g: GameState) => Object.values(g.players).reduce((s, p) => s + p.wage, 0)
console.log('wage sum fresh', wsum(F), 'after migrate x1', wsum(m1), 'x2', wsum(m2), 'x3', wsum(m3))
console.log('stadium fresh', F.clubs.bath.stadium, '| m1', m1.clubs.bath.stadium, '| m2', m2.clubs.bath.stadium)
console.log('deals fresh', JSON.stringify(F.deals)?.slice(0, 200))
console.log('deals m1', JSON.stringify(m1.deals)?.slice(0, 200))
console.log('json m1==m2', JSON.stringify(m1) === JSON.stringify(m2), 'm2==m3', JSON.stringify(m2) === JSON.stringify(m3))
{
  const extra = Object.keys(B.players).filter(k => !(k in A.players))
  console.log('in B not A:', extra.slice(0, 8), 'count', extra.length, 'sample', JSON.stringify(B.players[Number(extra[0])]).slice(0, 160))
  const p = B.players[Number(extra[0])]
  console.log('B key type sample', typeof extra[0], 'p.id', p?.id, 'A has key of p.id?', p ? (String(p.id) in A.players) : '-')
}
