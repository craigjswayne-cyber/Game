/**
 * ---- ADMINISTRATION HAS TO BITE, AND HAS TO END ----
 *
 * The fifteen-season audit measured 41 clubs of 101 sitting permanently in the
 * red from season nine on, most of them parked on aiecon's hard floor, coping
 * forever with no consequence. insolvency.ts is the consequence.
 *
 * The two failure modes this guards are opposite, and both are easy to ship:
 *
 *   TOO SOFT: a deduction that exists only on the finance screen. Promotion,
 *   relegation, the playoff cut and every AI board's read of its own season come
 *   off comp.table, so a penalty that is painted on by the UI is not a penalty.
 *   Asserted by reading the table, not a label.
 *
 *   TOO HARD: a club that goes under, is docked, stays broke, and goes under
 *   again the next season, forever. That is why administration CLEARS the debt -
 *   and why this probe checks a club actually comes out the other side rather
 *   than just checking it went in.
 *
 * Run: npx vite-node scripts/insolvprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { ADMIN_PENALTY, adminPenalty, insolvencyRisk, settleInsolvency } from '../src/game/insolvency'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const wagesOf = (g: ReturnType<typeof newGame>, id: string) =>
  g.clubs[id].players.reduce((s, pid) => s + (g.players[pid]?.wage ?? 0), 0)

// ---- a solvent world does not punish anybody ----
{
  const g = newGame('leicester', 'Solvent', 4242)
  const before = Object.values(g.clubs).filter(c => c.admin).length
  settleInsolvency(g)
  ok(before === 0 && Object.values(g.clubs).filter(c => c.admin).length === 0,
    'a fresh world puts nobody into administration')
}

// ---- a club that cannot pay goes under, and it costs it points ----
{
  const g = newGame('leicester', 'Broke', 91)
  const victim = 'bath'
  const w = wagesOf(g, victim)
  g.clubs[victim].balance = -25 * w            // deep past the 18-week line
  ok(insolvencyRisk(g, g.clubs[victim]) === 'gone', 'a club 25 weeks under is reported as gone')
  const squadBefore = g.clubs[victim].players.length

  const gone = settleInsolvency(g)
  ok(gone.includes(victim), 'and settling the season puts it into administration')
  const admin = g.clubs[victim].admin
  ok(admin?.season === g.season + 1 && admin?.penalty === ADMIN_PENALTY,
    `the penalty lands on next season (${admin?.penalty} points, season ${admin?.season})`)
  ok(g.clubs[victim].balance > -5 * w,
    `the creditors take the haircut (${Math.round(g.clubs[victim].balance / w)} weeks of wages left, was -25)`)
  ok(g.clubs[victim].players.length < squadBefore,
    `and it costs players (${squadBefore} to ${g.clubs[victim].players.length})`)
  ok(g.news.some(n => n.subject.includes('administration')), 'the world is told')

  // it does not go under twice for the same collapse
  const again = settleInsolvency(g)
  ok(!again.includes(victim), 'a club already in administration is not punished a second time')
}

// ---- the deduction is IN THE TABLE, not painted on ----
{
  const g = newGame('bath', 'Docked', 77)
  const uid = g.userClubId
  g.clubs[uid].balance = -30 * wagesOf(g, uid)
  // run to the rollover so the penalty is stamped onto a real new-season table
  let guard = 0
  while (guard++ < SEASON_WEEKS + 6 && g.season === 0) processWeekAndAdvance(g)
  ok(g.season === 1, `the season rolled (now ${g.season})`)
  const admin = g.clubs[uid].admin
  ok(!!admin && admin.season === g.season, 'the manager\'s own club is not exempt')
  ok(adminPenalty(g.clubs[uid], g.season) === ADMIN_PENALTY, 'and the penalty is live this season')
  const row = g.comps[g.clubs[uid].leagueId]?.table?.find(r => r.teamId === uid)
  ok(!!row && row.pts <= -ADMIN_PENALTY + 4,
    `the league table itself starts him on the deduction (pts ${row?.pts})`)
  ok(g.news.some(n => n.subject.includes('administration')), 'and he was told in plain words')
}

// ---- and a club comes out the other side ----
{
  const g = newGame('leicester', 'Recover', 313)
  const victim = 'sale'
  g.clubs[victim].balance = -25 * wagesOf(g, victim)
  settleInsolvency(g)
  ok(!!g.clubs[victim].admin, 'in')
  const seasonIn = g.clubs[victim].admin!.season
  // two seasons later the punishment must be spent
  g.season = seasonIn
  settleInsolvency(g)
  ok(g.clubs[victim].admin?.season === seasonIn, 'the penalty stands through the season it applies to')
  g.season = seasonIn + 1
  settleInsolvency(g)
  ok(!g.clubs[victim].admin || g.clubs[victim].admin.season > seasonIn,
    'and it is spent once that season has been played, not carried forever')
}

console.log(fails ? `INSOLVENCY PROBE FAILED (${fails})` : 'INSOLVENCY PROBE PASSED: going broke costs points, and ends')
if (fails) process.exit(1)
