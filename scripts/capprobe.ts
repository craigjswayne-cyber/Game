import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { offerRenewalAt, signOnTerms } from '../src/game/ai'
import { capPosition, capWord, refreshCaps, rosterGrid, rosterWarnings, MARQUEE_SLOTS } from '../src/game/cap'
import { SEASON_WEEKS, fmtMoney, type GameState } from '../src/game/model'
import { ok, checkWorld, failCount } from './worldcheck'

/**
 * ---- THE SALARY CAP AND THE ROSTER GRID (F6 + F10) ----
 *
 * A cap is only a rule if it binds, and only a fair rule if it binds evenly. The
 * ways this could be wrong are all quiet ones: a ceiling nobody is ever near, a
 * ceiling nobody can ever meet, a sanction that lands on the manager and not on
 * the AI, or a world that grinds to a halt because a fifth of the clubs are
 * frozen out of the market for ever. None of those would throw. So:
 *
 *   the cap is measured from each division, and every division has one
 *   the manager starts inside it, with his marquee slots already filed
 *   a deal that would breach it is refused, and refuses in plain words
 *   a marquee man does not count, which is what the allowance is for
 *   the AI trims to comply rather than paying a fine every summer for ever
 *   the ceiling rises with wages over a long career and never falls
 *   and the roster grid actually answers "who is still here in three years"
 */

const g: GameState = newGame('northampton', 'Cap Tester', 31337)
const club = g.clubs[g.userClubId]

console.log('--- the ceiling is measured from each division')
{
  const leagues = new Set(Object.values(g.clubs).map(c => c.leagueId).filter(Boolean) as string[])
  const capped = [...leagues].filter(lg => (g.caps?.[lg] ?? 0) > 0)
  ok(capped.length >= leagues.size - 1,
    `${capped.length} of ${leagues.size} divisions have a cap`)
  const pos = capPosition(g, club.id)
  ok(pos.cap != null && pos.cap > 0, `the Premiership cap is ${fmtMoney(pos.cap ?? NaN)}/wk`)
  ok(pos.bill > 0, `the club's countable bill is ${fmtMoney(pos.bill)}/wk`)
  ok(!pos.over, `and the manager starts inside it (${capWord(pos)})`)
  ok(pos.marquee.length === MARQUEE_SLOTS,
    `with ${pos.marquee.length} marquee men already filed, as an inherited squad would be`)
  // the cap has to be somewhere useful: a ceiling nobody can approach is not a
  // rule, and one nobody can meet is a punishment
  const bills = Object.values(g.clubs)
    .filter(c => c.leagueId === club.leagueId)
    .map(c => capPosition(g, c.id))
  const over = bills.filter(p => p.over).length
  ok(over >= 1 && over <= bills.length / 2,
    `${over} of ${bills.length} in the division are over it on day one, which is a rule with teeth and a rule that can be met`)
}

console.log('\n--- a deal that would breach it is refused')
{
  const pos = capPosition(g, club.id)
  const room = pos.headroom
  const target = Object.values(g.players).find(p => p.clubId && p.clubId !== club.id)!
  // a wage comfortably beyond the remaining room
  const r = signOnTerms(g, target.id, 0, room + 100_000, 0, false)
  ok(!r.ok, 'a signing that would break the cap is refused')
  ok(/salary cap/i.test(r.msg), `and it says why: ${r.msg.slice(0, 74)}`)
  ok(!club.players.includes(target.id), 'and he did not join anyway')
  ok(capPosition(g, club.id).bill === pos.bill, 'and the wage bill did not move')

  const mine = club.players.map(id => g.players[id]).filter(Boolean)
  const man = mine.find(p => !pos.marquee.includes(p.id))!
  const rr = offerRenewalAt(g, man.id, man.wage + room + 100_000)
  ok(!rr.ok, 'a renewal that would break the cap is refused too')
  ok(/salary cap/i.test(rr.msg), 'and for the stated reason')
  ok(g.players[man.id].wage === man.wage, 'and his wage is untouched')
}

console.log('\n--- a marquee man does not count')
{
  // Measured from an empty slate. The first cut of this check replaced two
  // existing designations with one and then complained the bill had gone UP,
  // which it had - two high earners came back into the count and one lower one
  // left. The harness was wrong, not the rule.
  const held = club.marquee ?? []
  club.marquee = []
  const bare = capPosition(g, club.id).bill
  const mine = club.players.map(id => g.players[id]).filter(Boolean)
  const star = [...mine].sort((a, b) => b.wage - a.wage)[0]
  club.marquee = [star.id]
  const withOne = capPosition(g, club.id).bill
  ok(withOne === bare - star.wage,
    `naming ${star.name} took exactly his ${fmtMoney(star.wage)}/wk off the countable bill`)
  ok(withOne < bare, 'so the allowance is worth using')
  // and a third name buys nothing: the allowance is two
  club.marquee = [...mine].sort((a, b) => b.wage - a.wage).slice(0, 3).map(p => p.id)
  const withThree = capPosition(g, club.id).bill
  club.marquee = [...mine].sort((a, b) => b.wage - a.wage).slice(0, 2).map(p => p.id)
  const withTwo = capPosition(g, club.id).bill
  ok(withThree === withTwo, `naming three men counts only ${MARQUEE_SLOTS}, as stated`)
  club.marquee = held
}

console.log('\n--- the ceiling rises with the sport and never falls')
{
  const g2 = newGame('northampton', 'Cap Tester', 4242)
  const lg = g2.clubs[g2.userClubId].leagueId!
  const opening = g2.caps![lg]
  let lowest = opening
  const seen: number[] = [opening]
  for (let s = 0; s < 6; s++) {
    for (let w = 0; w < SEASON_WEEKS; w++) { g2.newsFrom = g2.nextId; processWeekAndAdvance(g2) }
    const now = g2.caps![lg]
    lowest = Math.min(lowest, now)
    seen.push(now)
  }
  ok(lowest >= opening, `the cap never dropped below its opening figure (${seen.map(v => fmtMoney(v)).join(' -> ')})`)
  ok(seen[seen.length - 1] > opening, 'and it has risen with wages over six seasons')
  // and a second refresh in the same summer must not move it: the rule is stable
  const before = g2.caps![lg]
  refreshCaps(g2)
  ok(g2.caps![lg] === before, 'refreshing it twice in one summer changes nothing')
  checkWorld(g2, 'six seasons under the cap', true)
}

console.log('\n--- the AI trims to comply rather than being fined for ever')
{
  const g3 = newGame('northampton', 'Cap Tester', 5150)
  const overAt = () => Object.values(g3.clubs).filter(c => capPosition(g3, c.id).over).length
  const opening = overAt()
  for (let s = 0; s < 5; s++) {
    for (let w = 0; w < SEASON_WEEKS; w++) { g3.newsFrom = g3.nextId; processWeekAndAdvance(g3) }
  }
  const later = overAt()
  ok(opening > later, `clubs over the cap fell from ${opening} to ${later} as the AI trimmed`)
  const embargoed = Object.values(g3.clubs).filter(c => (c.capEmbargoUntil ?? -1) >= g3.season).length
  ok(embargoed <= Object.keys(g3.clubs).length / 8,
    `only ${embargoed} clubs are serving an embargo, so the market is not frozen`)
  const frees = Object.values(g3.players).filter(p => !p.clubId && !p.acad).length
  ok(frees > 0, `and the trimming put ${frees} senior players on the market`)
  // nobody may be trimmed below a fieldable squad
  const thinnest = Math.min(...Object.values(g3.clubs).map(c => c.players.length))
  ok(thinnest >= 23, `the smallest squad in the world is still ${thinnest}, which can field a matchday 23`)
  checkWorld(g3, 'five seasons of cap enforcement', true)
}

console.log('\n--- the roster grid answers the question it exists for')
{
  const grid = rosterGrid(g, club.id)
  ok(grid.seasons.length === 4, `it covers ${grid.seasons.length} seasons`)
  ok(grid.rows.length === 5, `and ${grid.rows.length} units of the team`)
  // cover can only fall as you look further out: a contract cannot start itself
  for (const row of grid.rows) {
    const counts = row.cells.map(c => c.count)
    const monotone = counts.every((v, i) => i === 0 || v <= counts[i - 1])
    ok(monotone, `${row.label} cover never rises with time (${counts.join(' ')})`)
  }
  const total = grid.rows[0].cells[0].count
  ok(total > 0, 'this season is populated')
  const warn = rosterWarnings(g, club.id)
  ok(Array.isArray(warn), `and it names ${warn.length} hole(s) worth planning for`)
}

console.log(failCount()
  ? `\nCAP PROBE FOUND ${failCount()} PROBLEM(S)`
  : '\nCAP PROBE PASSED: the cap binds, it binds evenly, and the grid plans three summers out')
if (failCount()) process.exit(1)
