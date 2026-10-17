// Probe: a promise is never due before it is made (1.9.1, model.pledgeDue).
//
// Promise due weeks were Math.min(week + span, 44) at both places a promise is
// made (a signing told he is in your plans, an office answer). The season runs
// to week 48 and the summer window opens in week 46, so a promise made in the
// window fell due in a week already gone, and the next settle judged it broken
// with no match played: morale down, a "Promise broken" story, a grudge in the
// world's memory. Late in the season a promise had one week to be kept.
//
// This holds:
//   pledgeDue gives the full span in season, a capped span with three weeks or
//     more to play, and a due week past the season otherwise
//   a promise made in week 46 survives the close-season settles untouched
//   rollover carries it into the new season, counted from fresh stats, and
//     due after pre-season
//   a promise from an earlier season is still wiped
//
// Run: npx vite-node scripts/pledgeprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { carryPledges } from '../src/game/rollover'
import { LAST_PLEDGE_WEEK, SEASON_WEEKS, pledgeDue, type GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}
const settle = (g: GameState) => {
  for (const q of g.press) if (!q.answered) q.answered = true
  g.annual = null
  // a probe career picks no team and talks to nobody: keep the board sweet,
  // because a sacked manager's promises are rightly voided
  g.clubs[g.userClubId].boardConfidence = 90
  processWeekAndAdvance(g)
}

// ---- the arithmetic ----
ok(pledgeDue(10, 6) === 16, `in season, six weeks is six weeks (${pledgeDue(10, 6)})`)
ok(pledgeDue(40, 6) === LAST_PLEDGE_WEEK, `with four weeks to play it is due at the last playing week (${pledgeDue(40, 6)})`)
ok(pledgeDue(43, 6) > LAST_PLEDGE_WEEK, `with one week to play it is due past the season (${pledgeDue(43, 6)})`)
for (const w of [45, 46, 47, 48]) ok(pledgeDue(w, 6) > w, `made in week ${w}, due after it (${pledgeDue(w, 6)})`)

// ---- the carry ----
{
  const carried = carryPledges([
    { playerId: 1, kind: 'plans', week: 46, season: 2026, due: 52, baseApps: 9 },
    { playerId: 2, kind: 'plans', week: 30, season: 2026, due: 36, baseApps: 4 },
    { playerId: 3, kind: 'start', week: 47, season: 2026, due: 47, baseApps: 0 },
    { playerId: 4, kind: 'deal', week: 46, season: 2025, due: 54, baseApps: 0 },
  ], 2027)
  ok(carried.length === 1 && carried[0].playerId === 1, `only the late promise from last season carries (${carried.map(c => c.playerId).join(',')})`)
  const c = carried[0]
  ok(c?.season === 2027 && c.baseApps === 0, 'it moves to the new season with appearances counted from zero')
  ok(c != null && c.due > 3 && c.due <= 3 + 6, `due after pre-season with the weeks still owed (week ${c?.due})`)
  ok(c != null && c.week === 46 - SEASON_WEEKS, `and it remembers when it was made (${c?.week}, ${c ? 4 - c.week : '?'} weeks before week 4)`)
}

// ---- a real career: a promise made in the summer window ----
{
  const g = newGame('leicester', 'Pledger', 11)
  const startSeason = g.season
  let guard = 0
  while (g.week < 46 && guard++ < 60) settle(g)
  ok(g.week === 46 && g.season === startSeason && !g.unemployed, `the career reaches week 46 in a job (week ${g.week})`)
  // a man under contract next season with no pre-contract elsewhere: the
  // ledger rightly voids a promise to anyone leaving
  const p = Object.values(g.players).find(x => x.clubId === g.userClubId && x.contractEnds > g.season + 1 &&
    !(g.preContracts ?? []).some(pc => pc.playerId === x.id) && !x.retiring)!
  g.pledges = [{ playerId: p.id, kind: 'plans', week: g.week, season: g.season, due: pledgeDue(g.week, 6), baseApps: p.stats.apps }]
  const morale = p.morale
  settle(g)
  const broken = g.news.some(n => n.k === 'news.brokePlans' && n.playerId === p.id)
  ok(!broken, 'the next settle does not call it broken')
  ok((g.pledges ?? []).some(pl => pl.playerId === p.id), 'and the promise is still on the books')
  ok(p.morale >= morale - 0.5, `nor has his morale been docked for it (${morale.toFixed(2)} to ${p.morale.toFixed(2)})`)
  guard = 0
  while (g.season === startSeason && guard++ < 10) settle(g)
  ok(g.season === startSeason + 1, `the season turns (season ${g.season}, week ${g.week})`)
  const carried = (g.pledges ?? []).find(pl => pl.playerId === p.id)
  ok(carried != null && carried.season === g.season && carried.due > g.week, `rollover carries it into the new season, still owed (due week ${carried?.due})`)
  ok(!g.news.some(n => n.k === 'news.brokePlans' && n.playerId === p.id), 'and it was never judged in the close season')
}

console.log(fails ? `\nPLEDGE PROBE FAILED (${fails})` : '\nPLEDGE PROBE PASSED: no promise falls due before it is made')
process.exit(fails ? 1 : 0)
