// Calendar dump: per week, which competitions have fixtures, for every season
// type in both worlds. A reporter, not a gate: the invariant is calinvariant.ts.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { SEASON_WEEKS } from '../../src/game/model'
import type { GameState } from '../../src/game/model'

function toSeason(g: GameState, season: number) {
  let guard = 0
  while (g.season < season && guard++ < SEASON_WEEKS * 10) processWeekAndAdvance(g)
}
function dump(label: string, g: GameState) {
  console.log(`\n=== ${label}: season ${g.season} (${2026 + g.season})`)
  const byWeek = new Map<number, Map<string, number>>()
  for (const f of g.fixtures) {
    const m = byWeek.get(f.week) ?? new Map(); byWeek.set(f.week, m)
    m.set(f.compId, (m.get(f.compId) ?? 0) + 1)
  }
  for (let w = 1; w <= SEASON_WEEKS; w++) {
    const m = byWeek.get(w)
    console.log(`${String(w).padStart(2)}  ${m ? [...m.entries()].map(([c, n]) => `${c}:${n}`).join(' ') : '-'}`)
  }
  // league round counts
  const comps = Object.values(g.comps).filter(c => c.type === 'league')
  console.log('leagues: ' + comps.map(c => `${c.id}(${c.teamIds.length} teams, ${c.rounds} rounds, weeks ${c.weeksByRound?.length})`).join('; '))
}
const arg = process.argv[2] ?? 'all'
const seasons = (process.argv[3] ?? '0,1,3,5').split(',').map(Number)
const run = (club: string, label: string) => {
  for (const n of seasons) {
    const g = club.startsWith('w:') ? newGame(club, 'Cal', 7, undefined, 'coach', 'w', 'w') : newGame(club, 'Cal', 7)
    if (n > 0) toSeason(g, n)
    dump(`${label}`, g)
  }
}
if (arg === 'all' || arg === 'm') run('leicester', 'men')
if (arg === 'all' || arg === 'w') run(process.argv[4] ?? 'w:bristol', 'women')
