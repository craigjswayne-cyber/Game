// Find the FIRST week where a career that is saved and loaded every week
// stops matching the same career played straight through, starting from a
// save file. Prints the pre-week difference (what the load changed) and the
// post-week difference (what that did to the world).
//
//   npx vite-node scripts/qa/savedet.ts -- <save.json> [weeks=30]
import { readFileSync } from 'node:fs'
import { migrate } from '../../src/game/save'
import type { GameState } from '../../src/game/model'
import { peekPid, resetIds } from '../../src/game/attributes'
process.env.SAVEGEN_LIB = '1'
const { playWeek } = await import('./savegen')

/** JSON with every object's keys sorted: a property deleted and re-added in
 *  the same week moves to the end of its object, which is not a difference
 *  in the world. Maps whose ORDER the engine iterates would show up as a
 *  value difference a week later, so nothing real hides behind this. */
//  A field the engine leaves unset on a man it mints and migrate backfills
//  (onLoan false, rust 0, debutPending null) is read with ?? everywhere, so
//  absent and its default are the same world: dropped from both sides.
const TRIVIAL = (v: unknown) => v === undefined || v === null || v === false || v === 0
const canon = (x: unknown): string => JSON.stringify(x, (_k, v) =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().filter(k => !TRIVIAL(v[k])).map(k => [k, v[k]])) : v)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any
const args = process.argv.slice(2).filter(a => a !== '--')
const WEEKS = Number(args[1] ?? 30)
function diff(a: Any, b: Any, path = '', out: string[] = [], depth = 0): string[] {
  if (out.length >= 20 || depth > 14) return out
  if (a === b) return out
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (TRIVIAL(a) && TRIVIAL(b)) return out
    if (!(Number.isNaN(a) && Number.isNaN(b))) out.push(`${path}: ${JSON.stringify(a)?.slice(0, 100)} vs ${JSON.stringify(b)?.slice(0, 100)}`)
    return out
  }
  const ka = Object.keys(a), kb = Object.keys(b)
  if (!Array.isArray(a) && ka.join() !== kb.join() && new Set([...ka, ...kb]).size === ka.length && ka.length === kb.length) out.push(`${path}: key order ${ka.join(',').slice(0, 80)} vs ${kb.join(',').slice(0, 80)}`)
  for (const k of new Set([...ka, ...kb])) diff(a[k], b[k], `${path}.${k}`, out, depth + 1)
  return out
}
const raw = JSON.parse(readFileSync(args[0], 'utf8'))
const base = JSON.stringify(migrate(JSON.parse(JSON.stringify(raw.state ?? raw))))
let A = migrate(JSON.parse(base)) as GameState
let pidA = peekPid()
let B = migrate(JSON.parse(base)) as GameState
let pidB = peekPid()
for (let w = 0; w < WEEKS; w++) {
  const preA = JSON.stringify(A)
  const preB = JSON.stringify(B)
  resetIds(pidA); playWeek(A); pidA = peekPid()
  resetIds(pidB); playWeek(B); pidB = peekPid()
  const sa = JSON.stringify(A), sb = JSON.stringify(B)
  if (canon(A) !== canon(B)) {
    console.log(`DIVERGED in week ${w} (season ${A.season} week ${A.week}); pids ${pidA} vs ${pidB}`)
    console.log(`pre-week JSON identical: ${preA === preB} (canonical: ${canon(JSON.parse(preA)) === canon(JSON.parse(preB))})`)
    for (const l of diff(JSON.parse(preA), JSON.parse(preB))) console.log('  pre  ' + l)
    for (const l of diff(JSON.parse(sa), JSON.parse(sb))) console.log('  post ' + l)
    process.exit(1)
  }
  // B is saved and loaded; A carries on in memory
  B = migrate(JSON.parse(sb)) as GameState
  pidB = peekPid()
}
console.log(`IDENTICAL over ${WEEKS} weeks with a save/load every week`)
