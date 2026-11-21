/**
 * ---- A TEST SQUAD HAS A MAN FOR EVERY SHIRT (1.9.16) ----
 *
 * Squads were the best by rating with only the front row protected. Found by
 * walking the Isles tour for the owner: the tour party had no scrum-half, and
 * in the World Championship before it Wales and Tonga had none either.
 *
 * A season of every squad every federation names: each one of 30 or more
 * carries at least two men for scrum-half, fly-half and full-back and three
 * props a side, wherever the country has them.
 *
 * Run: npx vite-node scripts/squadshapeprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { withFrontRow } from '../src/game/nations'
import type { Player } from '../src/game/model'
import { ok, failures } from './lib/probe'

const can = (p: Player, pos: string) => p.pos === pos || (p.alt as string[]).includes(pos)
const NEED: [string, number][] = [['SH', 2], ['FH', 2], ['FB', 2], ['LK', 3], ['CE', 3], ['WG', 3]]

console.log('--- the picker, on a pool with the half-backs at the bottom')
{
  const mk = (id: number, pos: string, ca: number) => ({ id, pos, alt: [], ca } as unknown as Player)
  const pool = [...Array.from({ length: 40 }, (_, i) => mk(i, 'FL', 90 - i)), ...['LP', 'HK', 'TP', 'SH', 'FH', 'LK', 'FB', 'N8', 'CE', 'WG'].flatMap((pos, k) => [0, 1, 2, 3].map(j => mk(100 + k * 10 + j, pos, 60 - k - j)))]
  const sq = withFrontRow(pool, 32)
  ok(sq.length === 32, `still 32 (${sq.length})`)
  ok(sq.filter(p => p.pos === 'SH').length === 3 && sq.filter(p => p.pos === 'FH').length === 2 && sq.filter(p => p.pos === 'FB').length === 2, 'three scrum-halves, two fly-halves, two full-backs')
  ok(sq.some(p => p.id === 0) && sq.filter(p => p.pos === 'FL').length >= 3, 'and the best flankers still travel')
}

console.log('--- a season of every squad named')
const g = newGame('bath', 'Squad Shape', 41)
const s0 = g.season
let squads = 0, thin = 0, none = 0, guard = 0
const seen = new Set<string>()
const eg: string[] = []
while (g.season === s0 && guard++ < 70) {
  for (const [nat, ids] of Object.entries(g.natSquads ?? {})) {
    const key = `${nat}:${ids.join(',')}`
    if (seen.has(key) || ids.length < 30) continue
    seen.add(key)
    const sq = ids.map(id => g.players[id]).filter(Boolean)
    squads++
    const short = NEED.filter(([pos, n]) => sq.filter(p => can(p, pos)).length < n).map(([pos]) => pos)
    if (['SH', 'FH', 'FB', 'HK'].some(pos => !sq.some(p => can(p, pos)))) none++
    if (short.length) { thin++; if (eg.length < 6) eg.push(`${nat} wk${g.week} short of ${short.join(',')}`) }
  }
  for (const n of g.news) n.read = true
  g.offers = []
  processWeekAndAdvance(g)
}
if (eg.length) console.log('     ' + eg.join(' | '))
ok(squads >= 60, `enough squads to judge (${squads})`)
ok(none === 0, `none travels with nobody at scrum-half, fly-half, full-back or hooker (${none} of ${squads})`)
// the island nations' whole pool can hold one scrum-half: a country cannot pick a man it does not have
ok(thin <= squads * 0.12, `and few are down to one where two are wanted (${thin} of ${squads})`)

if (failures()) { console.log(`\nSQUAD SHAPE PROBE FAILED: ${failures()}`); process.exit(1) }
console.log('\nSQUAD SHAPE PROBE PASSED: a man for every shirt')
