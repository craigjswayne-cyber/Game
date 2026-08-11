// The leadership group and the game-time ledger (F11, F18).
//
// Both are squad-room systems attached to numbers the match engine reads, which
// is the dangerous shape: morale feeds the starting XV's strength and unit
// multipliers feed everything. So each one has to be checked for the same
// property, that it is a decision rather than a difficulty setting.
//
// The ledger took four measurements to get right and every wrong version is
// recorded in the source comments. The short version: morale is the engine's own
// input, the starting XV is always the over-served group, and any accumulating
// drift eventually rots the reserve pool the XV is drawn from.
import { newGame } from '../src/game/newgame'
import { beginMatch, teamUnits } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import {
  STATUSES, STATUS_BY_ID, clubMatchesPlayed, defaultStatus, ledger, ledgerRow,
  settleGameTime, statusOf,
} from '../src/game/gametime'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'Human', 21)
const club = g.clubs[g.userClubId]

// ---- the statuses describe a satisfiable squad ----------------------------
{
  // If the default understandings demand more appearances than a season has to
  // give, every squad in the game is in revolt from September and the ledger is
  // just a slow poison.
  const squad = club.players.map(id => g.players[id]).filter(Boolean)
  const demand = squad.reduce((s, p) => s + STATUS_BY_ID[defaultStatus(g, club, p)].share, 0)
  console.log(`  ${squad.length} men, default understandings demand ${demand.toFixed(1)} of the 23 shirts a week`)
  ok(demand < 23, 'the default understandings can all be met at once')
  ok(demand > 10, 'and they are not so slack that nobody would ever complain')
}

// ---- every status has a share, and they are ordered ----------------------
{
  const shares = STATUSES.map(s => s.share)
  ok(shares.every((v, i) => i === 0 || v <= shares[i - 1]), 'the ladder descends: key, rotation, squad, prospect, none')
  ok(STATUS_BY_ID.fringe.share === 0, 'a man told he is not in the plans expects nothing')
}

// ---- a long-term injury is nobody's broken promise -----------------------
{
  const p = club.players.map(id => g.players[id]).filter(Boolean)[0]
  p.status = 'key'
  p.stats.apps = 0
  const fit = ledgerRow(g, club, p, 20)
  p.injury = { desc: 'knee', until: g.week + 12, weeks: 12 }
  const hurt = ledgerRow(g, club, p, 20)
  console.log(`  key man, no apps in 20 matches: due ${fit.expected} fit, ${hurt.expected} with a 12-week injury`)
  ok(hurt.expected < fit.expected, 'the weeks he could not have played come off what he was owed')
  delete p.injury
}

// ---- the drift settles rather than sinks ---------------------------------
{
  // The failure this replaces: a man frozen out slid to morale 1 and stayed
  // there, and because the reserves are the pool injuries draw from, the whole
  // squad rotted. A grievance has a floor.
  const gg = newGame('northampton', 'Human', 22)
  const c = gg.clubs[gg.userClubId]
  // freeze out a man who is nowhere near the 23 and tell him he is key
  const outside = c.players.map(id => gg.players[id]).filter(p => p && !c.tactic.lineup.includes(p.id))
  const victim = outside[0]
  victim.status = 'key'
  victim.stats.apps = 0
  victim.morale = 8
  // pretend a season has been played without him
  for (const fx of gg.fixtures) {
    if (fx.week <= 20 && (fx.homeId === c.id || fx.awayId === c.id)) fx.played = true
  }
  gg.week = 20
  const trace: number[] = []
  for (let w = 0; w < 60; w++) { settleGameTime(gg); trace.push(victim.morale) }
  const settled = trace[trace.length - 1]
  console.log(`  frozen-out key man: morale 8.0 -> ${trace[9].toFixed(1)} after 10 weeks -> ${settled.toFixed(1)} after 60`)
  ok(settled < 6, 'he is unmistakably unhappy about it')
  ok(settled > 1.5, 'and he settles at a grievance rather than sliding to the floor')
  ok(Math.abs(settled - trace[trace.length - 10]) < 0.15, 'the level is stable, not still falling')
}

// ---- a man in this week's 23 has nothing to raise this week --------------
{
  const gg = newGame('northampton', 'Human', 23)
  const c = gg.clubs[gg.userClubId]
  const picked = gg.players[c.tactic.lineup[0]!]
  picked.status = 'key'
  picked.stats.apps = 0
  picked.morale = 8
  for (const fx of gg.fixtures) {
    if (fx.week <= 20 && (fx.homeId === c.id || fx.awayId === c.id)) fx.played = true
  }
  gg.week = 20
  const before = picked.morale
  for (let w = 0; w < 20; w++) settleGameTime(gg)
  console.log(`  named in the 23, zero apps: morale ${before.toFixed(1)} -> ${picked.morale.toFixed(1)}`)
  ok(picked.morale === before, 'the ledger does not reach into the side you are actually fielding')
}

// ---- telling a man the truth costs nothing but the truth -----------------
{
  const gg = newGame('northampton', 'Human', 24)
  const c = gg.clubs[gg.userClubId]
  const outside = c.players.map(id => gg.players[id]).filter(p => p && !c.tactic.lineup.includes(p.id))
  const man = outside[0]
  for (const fx of gg.fixtures) {
    if (fx.week <= 20 && (fx.homeId === c.id || fx.awayId === c.id)) fx.played = true
  }
  gg.week = 20
  man.status = 'key'
  man.morale = 8
  for (let w = 0; w < 30; w++) settleGameTime(gg)
  const lied = man.morale
  man.status = 'fringe'
  man.morale = 8
  for (let w = 0; w < 30; w++) settleGameTime(gg)
  console.log(`  same man, 30 weeks out: told he is key ${lied.toFixed(1)}, told the truth ${man.morale.toFixed(1)}`)
  ok(man.morale > lied + 1, 'an honest understanding is worth real morale over a lie')
}

// ---- the ledger reads the same way the table does ------------------------
{
  const rows = ledger(g, club)
  ok(rows.length === club.players.filter(id => g.players[id]).length, 'every man at the club appears once')
  ok(rows.every((r, i) => i === 0 || r.gap >= rows[i - 1].gap), 'sorted worst-served first, which is who you need to see')
  const played = clubMatchesPlayed(g, club.id)
  ok(played >= 0, `club matches played resolves (${played})`)
  ok(rows.every(r => STATUS_BY_ID[statusOf(g, club, r.p)] != null), 'every man resolves to a real status')
}

// ---- a portfolio concentrates, it does not add ---------------------------
{
  const measure = (leaders: typeof club.leaders) => {
    const gg = newGame('northampton', 'Human', 25)
    const c = gg.clubs[gg.userClubId]
    c.leaders = leaders
    const fx = gg.fixtures.find(f => gg.clubs[f.homeId] && gg.clubs[f.awayId] && f.homeId === c.id)!
    const ctx = beginMatch(gg, fx, weekRng(gg), false, c.id)
    const s = ctx.home.teamId === c.id ? ctx.home : ctx.away
    return s.units
  }
  const base = measure(undefined)
  // the most authoritative man in the XV takes the defensive portfolio
  const gg = newGame('northampton', 'Human', 25)
  const c = gg.clubs[gg.userClubId]
  const xv = c.tactic.lineup.slice(0, 15).map(id => gg.players[id!]).filter(Boolean)
  const boss = [...xv].sort((a, b) => b.a.lea - a.a.lea)[0]
  const withDef = measure({ defence: boss.id })
  console.log(`  ${boss.name} (Ldr ${boss.a.lea}) calls the line: defence ${base.defence.toFixed(3)} -> ${withDef.defence.toFixed(3)}, attack ${base.attack.toFixed(3)} -> ${withDef.attack.toFixed(3)}`)
  ok(withDef.defence > base.defence, 'the defensive portfolio makes the defence better')
  ok(withDef.attack < base.attack, 'and it is paid for out of attacking shape, not conjured')
  // and the overall strength barely moves: it is a redistribution
  const drift = Math.abs(withDef.overall / base.overall - 1)
  console.log(`  overall strength drift: ${(drift * 100).toFixed(2)}%`)
  ok(drift < 0.006, 'overall strength moves by well under a percent, so it is a choice not an upgrade')

  // a man without authority does not get to hold a portfolio
  const meek = [...xv].sort((a, b) => a.a.lea - b.a.lea)[0]
  if (meek.a.lea < 12) {
    const withMeek = measure({ defence: meek.id })
    ok(Math.abs(withMeek.defence - base.defence) < 0.0001,
      `a man on Ldr ${meek.a.lea} carries no portfolio: authority has to be earned`)
  } else {
    console.log('  (no low-authority man in this XV to test the threshold with)')
  }

  // and a man on the bench cannot lead the side he is not on
  const benchman = gg.players[c.tactic.lineup[15]!]
  if (benchman) {
    const withBench = measure({ defence: benchman.id })
    ok(Math.abs(withBench.defence - base.defence) < 0.0001, 'a replacement holds no portfolio while he is sitting down')
  }
}

// ---- the gap has a voice: the transfer request (17A) -----------------------
//
// User: "players request moves if they say they want more games and the coach
// doesnt give them game time." A key man badly short-changed and ground down
// does not just settle at a low morale: a formal request lands in the inbox,
// suitors treat him as gettable, and minutes actually given withdraw it.
{
  const gg = newGame('northampton', 'Human', 23)
  const c = gg.clubs[gg.userClubId]
  // enough season played for the ledger to bite, and a key man frozen out
  for (const fx of gg.fixtures) {
    if (fx.week <= 20 && (fx.homeId === c.id || fx.awayId === c.id) && fx.compId !== 'fr') fx.played = true
  }
  gg.week = 21
  const victim = c.players.map(id => gg.players[id])
    .find(p => p && !p.acad && !c.tactic.lineup.includes(p.id) && p.age <= 30)!
  victim.status = 'key'
  victim.stats.apps = 0
  victim.morale = 3.5
  const before = gg.news.length
  settleGameTime(gg)
  ok((victim.wantsOut ?? 0) > 0, `a frozen-out key man hands in a transfer request (morale ${victim.morale.toFixed(1)})`)
  const letter = gg.news.slice(before).find(n => n.subject.includes('transfer request'))
  ok(!!letter, `and the letter lands: "${letter?.subject ?? 'MISSING'}"`)

  // the road back: give him the minutes and the request is withdrawn
  victim.stats.apps = 9
  const before2 = gg.news.length
  settleGameTime(gg)
  ok((victim.wantsOut ?? 0) === 0, 'minutes actually given withdraw the request')
  ok(gg.news.slice(before2).some(n => n.subject.includes('withdraws')), 'and the withdrawal is announced, not silent')

  // a man who was told he is not in the plans does not get to demand a move
  const told = c.players.map(id => gg.players[id])
    .find(p => p && !p.acad && !c.tactic.lineup.includes(p.id) && p.id !== victim.id)!
  told.status = 'fringe'
  told.stats.apps = 0
  told.morale = 3
  settleGameTime(gg)
  ok(!(told.wantsOut ?? 0), 'a fringe man was told where he stands: no request from him')
}

console.log(fails ? `HUMAN PROBE FAILED (${fails})` : 'HUMAN PROBE PASSED')
process.exit(fails ? 1 : 0)
