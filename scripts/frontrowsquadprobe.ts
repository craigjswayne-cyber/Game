/**
 * ---- THE FRONT ROW IS PICKED, NOT LEFT TO CHANCE ----
 *
 * Release QA after 1.8.16 measured Law 3 at every kick-off over three seasons:
 * 160 of 8,628 club team sheets and 173 of 432 Test team sheets could not
 * cover the front row, so the referee ordered uncontested scrums. Two causes:
 *
 *   CLUBS: the auto-pick only looked at the academy when the seniors could not
 *   fill 23 shirts, so Saracens with one fit senior loosehead named a third
 *   tighthead and left two academy looseheads at home (autoSelect,
 *   coverFrontRow).
 *
 *   NATIONS: AI federations named the best men by rating and nothing else,
 *   and a squad could travel with one hooker (nations.withFrontRow).
 *
 * This holds both, on the selection functions themselves:
 *   1. every AI club's auto-picked 23, every week of a season, covers the
 *      front row whenever the club has the men to do it (academy included);
 *   2. every AI Test squad named in that season can name a legal 23 (two
 *      men for each front-row position). withFrontRow aims for three; the
 *      quality floor (rated 68+) can leave a small nation with two.
 *
 * Run: npx vite-node scripts/frontrowsquadprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { autoSelect, availablePlayers, frontRowCover, rosterOf } from '../src/game/matchEngine'
import { withFrontRow } from '../src/game/nations'
import { SEASON_WEEKS, type Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const FR = ['LP', 'HK', 'TP'] as const
const can = (p: Player, pos: string) => p.pos === pos || (p.alt as string[]).includes(pos)

console.log('--- withFrontRow, on a pool with the front row at the bottom')
{
  const mk = (id: number, pos: string, ca: number) => ({ id, pos, alt: [], ca } as unknown as Player)
  const pool = [...Array.from({ length: 40 }, (_, i) => mk(i, 'CE', 90 - i)), mk(100, 'LP', 50), mk(101, 'LP', 49), mk(102, 'LP', 48),
    mk(103, 'HK', 47), mk(104, 'HK', 46), mk(105, 'HK', 45), mk(106, 'TP', 44), mk(107, 'TP', 43), mk(108, 'TP', 42)]
  const sq = withFrontRow(pool, 33)
  ok(sq.length === 33, `the squad is still 33 (${sq.length})`)
  ok(FR.every(pos => sq.filter(p => can(p, pos)).length >= 3), 'and it carries three of each front-row position')
  ok(sq.filter(p => p.pos === 'CE').length === 24 && sq.some(p => p.id === 0) && !sq.some(p => p.id === 39),
    'the men left out for them are the lowest-rated of the rest')
}

console.log('--- a season of every AI club\'s auto-pick and every AI Test squad')
let sheets = 0, shortWithCover = 0, squads = 0, squadsShort = 0
const g = newGame('bath', 'Front Row', 77)
for (let w = 0; w < SEASON_WEEKS; w++) {
  for (const id of Object.keys(g.clubs)) {
    if (id === g.userClubId) continue
    const pool = availablePlayers(g, rosterOf(g, id))
    const lu = autoSelect(g, pool)
    sheets++
    if (!frontRowCover(g, lu).legal) {
      // short only counts against the picker when the men existed
      const has = FR.every(pos => pool.filter(p => can(p, pos)).length >= 2) && pool.filter(p => FR.some(f => can(p, f))).length >= 6
      if (has) { shortWithCover++; if (shortWithCover === 1) console.log('        e.g.', id, 'week', g.week, JSON.stringify(frontRowCover(g, lu)), lu.slice(15).map(i => i != null ? `${g.players[i].pos}[${g.players[i].alt.join(',')}]` : '-').join(' '), '| unnamed FR:', pool.filter(p => !lu.includes(p.id) && FR.some(f => can(p, f))).map(p => `${p.pos}[${p.alt.join(',')}] acad${!!p.acad}`).join(' '), '| XV FR-capable:', lu.slice(0, 15).map((i, k) => { const p = i != null ? g.players[i] : null; return p && FR.some(f => can(p, f)) ? `${k + 1}:${p.pos}` : '' }).filter(Boolean).join(' ')) }
    }
  }
  processWeekAndAdvance(g)
  for (const [nat, ids] of Object.entries(g.natSquads)) {
    if (nat === g.natTeam || !ids.length) continue
    squads++
    const sq = ids.map(i => g.players[i]).filter((p): p is Player => !!p)
    if (FR.some(pos => sq.filter(p => can(p, pos)).length < 2)) squadsShort++
  }
}
ok(sheets > 2000, `enough club sheets to judge (${sheets})`)
// at most one in a thousand: a man playing through a knock is picked but not
// counted by the law check (frontRowCover skips the injured)
ok(shortWithCover <= sheets / 1000, `an auto-picked 23 is almost never short of front-row cover while the club has it (${shortWithCover} of ${sheets})`)
ok(squads > 50, `enough Test squads to judge (${squads})`)
ok(squadsShort === 0, `every AI Test squad can name a legal 23: two of each front-row position (${squadsShort} of ${squads} short)`)
console.log(fails ? `\nFRONT ROW SQUAD PROBE FAILED: ${fails}` : '\nFRONT ROW SQUAD PROBE PASSED: the front row is picked, at club and Test level')
process.exit(fails ? 1 : 0)
