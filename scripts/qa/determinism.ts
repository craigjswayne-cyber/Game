// Engine-only determinism: does a JSON save/reload each week change the simulation?
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'
import { resetIds } from '../../src/game/attributes'

const WEEKS = Number(process.argv[2] ?? 60)
const SEED = Number(process.argv[3] ?? 777)
const MODE = process.argv[4] ?? 'migrate' // 'json' = plain roundtrip, 'migrate' = roundtrip + migrate
function week(g: GameState) {
  // Two careers in one process share the module-level id counter, and since
  // 1.6.4 the settle takes the HIGHER of the counter and the save's pidNext -
  // so A's minting pushed B's ids along and the two worlds drifted apart on
  // id alone. A real app runs one career per process; this puts each career
  // back on its own counter before its week, which is what a reload does.
  resetIds(g.pidNext ?? 1)
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
function sig(g: GameState): string {
  const fx = g.fixtures.filter(f => f.played).map(f => `${f.id}:${f.homeScore}-${f.awayScore}`).join(',')
  const bal = Object.values(g.clubs).map(c => `${c.id}:${c.balance}`).join(',')
  return fx + '|' + bal + '|' + g.nextId + '|' + Object.keys(g.players).length
}
// deep diff two objects, report first N differing paths
function diff(a: any, b: any, path = '', out: string[] = [], depth = 0): string[] {
  if (out.length > 25 || depth > 10) return out
  if (a === b) return out
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    const trivial = (x: any) => x === undefined || x === null || x === false || x === 0
    if (trivial(a) && trivial(b)) return out
    if (!(Number.isNaN(a) && Number.isNaN(b))) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 60)} vs ${JSON.stringify(b)?.slice(0, 60)}`)
    return out
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  // migrate backfills two record-keeping fields a freshly minted player does not
  // carry (ca0, hist); neither is read by the simulation, so they are not a
  // divergence, only noise that hides the real one
  for (const k of keys) { if (k === 'ca0' || k === 'hist') continue; diff(a[k], b[k], `${path}.${k}`, out, depth + 1) }
  return out
}
let A = newGame('bath', 'Det', SEED)
let B = newGame('bath', 'Det', SEED)
B.saveName = A.saveName; B.managerName = A.managerName
let firstDiv = -1
for (let w = 0; w < WEEKS; w++) {
  const preA = JSON.parse(JSON.stringify(A)); const preB = JSON.parse(JSON.stringify(B))
  week(A); week(B)
  const sA = sig(A), sB = sig(B)
  if (sA !== sB) {
    firstDiv = w
    console.log(`DIVERGED after step ${w} (season ${A.season} week ${A.week})`)
    const d = diff(preA, preB)
    console.log('pre-week state diffs (A vs B):'); for (const l of d) console.log('  ' + l)
    const d2 = diff(JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B)))
    console.log('post-week diffs:'); for (const l of d2.slice(0, 10)) console.log('  ' + l)
    break
  }
  // reload B
  const json = JSON.stringify(B)
  B = MODE === 'migrate' ? migrate(JSON.parse(json)) : JSON.parse(json)
}
console.log(firstDiv < 0 ? `DETERMINISTIC over ${WEEKS} weeks (${MODE})` : `NON-DETERMINISTIC at step ${firstDiv} (${MODE})`)
