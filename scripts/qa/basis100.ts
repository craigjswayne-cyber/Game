// The season*100+week stamps across a season boundary, and the courtedAt rebase.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { migrate } from '../../src/game/save'
import { seedStaffPeople } from '../../src/game/staff'
import { SEARCH_WEEKS } from '../../src/game/commission'
import { WEEK_BASIS } from '../../src/game/model'
import type { GameState } from '../../src/game/model'

// 1. a 9-month scouting brief commissioned in week 30
{
  const g = newGame('leicester', 'B', 99)
  g.staff.scout = 2; seedStaffPeople(g)
  while (g.week < 30) processWeekAndAdvance(g)
  const abs = g.season * 100 + g.week
  g.commission = { pos: 'any', months: 9, done: abs + SEARCH_WEEKS[9], fee: 0, leagueId: null } as any
  console.log(`brief: commissioned s${g.season} w${g.week}, done stamp ${g.commission!.done}, promised ${SEARCH_WEEKS[9]} weeks -> expected s1 w${30 + 39 - 48}`)
  let weeks = 0
  while (g.commission && weeks < 80) { processWeekAndAdvance(g); weeks++ }
  console.log(`brief: report landed after ${weeks} weeks at s${g.season} w${g.week} (scoutFinds ${g.scoutFinds?.length ?? 0})`)
}
// 2. a facility build straddling the summer
{
  const g = newGame('leicester', 'B', 99)
  while (g.week < 44) processWeekAndAdvance(g)
  const abs = g.season * 100 + g.week
  g.facilityBuild = { id: 'gym', level: 2, done: abs + 10 } as any
  console.log(`build: set s${g.season} w${g.week} for 10 weeks, done stamp ${abs + 10} -> expected s1 w6`)
  let weeks = 0
  while (g.facilityBuild && weeks < 80) { processWeekAndAdvance(g); weeks++ }
  console.log(`build: opened after ${weeks} weeks at s${g.season} w${g.week}`)
}
// 3. loyalty vow at w45, job move at s1 w3
{
  const s = 0, w = 45
  const vowedAt = s * 100 + w
  const later = 1 * 100 + 3
  console.log(`vow: vowed s0 w45, moving s1 w3 (6 real weeks later): brokeVow = ${later - vowedAt <= 10} (diff ${later - vowedAt}, rule <=10)`)
  const c = 0 * 100 + 40
  console.log(`courting cooldown 12: courted s0 w40, s1 w1 (9 real weeks later): abs-courtedAt = ${101 - c} >= 12 -> ${101 - c >= 12}`)
}
// 4. courtedAt rebased as basis 45 though written on basis 100
{
  const g = newGame('leicester', 'B', 99)
  const copy = JSON.parse(JSON.stringify(g)) as GameState
  delete (copy as any).basis
  copy.season = 2; copy.week = 11
  ;(copy as any).courtedAt = 2 * 100 + 10   // courted last week, on the basis media.ts/jobs.ts use
  ;(copy as any).courtedBy = 'saracens'
  ;(copy as any).vowedAt = 2 * 100 + 10
  const m = migrate(copy)
  console.log(`courtedAt: stored ${210} (s2w10 on basis 100) -> after migrate ${m.courtedAt}; media.ts:250 wants ${m.season * 100 + m.week - 1}; match=${m.courtedAt === m.season * 100 + m.week - 1}; jobs cooldown expires at abs ${m.courtedAt! + 12} i.e. s${Math.floor((m.courtedAt! + 12) / 100)} w${(m.courtedAt! + 12) % 100}`)
  console.log(`vowedAt: stored 210 -> after migrate ${m.vowedAt} (not in rebase list, correct since basis 100)`)
  console.log(`WEEK_BASIS=${WEEK_BASIS}`)
}
