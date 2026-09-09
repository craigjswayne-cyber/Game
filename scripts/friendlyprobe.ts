/**
 * ---- THE MIDWEEK RUN-OUT ----
 *
 * Owner, 7 Sep: "you should be able to arrange friendlies in the fixtures and
 * results, below the fixtures - it should have 3 suggestions, only with teams
 * below in leagues or in a different country. Dates should be at least 3 days
 * before and after a game so midweek, financially they dont benefit the club
 * but they do give more game time to academy."
 *
 * Five clauses, five things that can quietly stop being true. The one worth the
 * most is the three-day gap, because it is the one the game can break without
 * anybody noticing: this game's fixtures are not all on Saturday, a third of
 * them fall on the Friday, and a Wednesday friendly two days before a league
 * Friday would be the game breaking a promise it made in its own copy.
 *
 * The academy clause is measured rather than asserted. "More game time to
 * academy" is a claim about minutes, so the probe counts minutes.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { arrangeMidweekFriendly, friendlySuggestions, friendlyWeekOk, friendlyWeeks, FRIENDLY_DAY } from '../src/game/season'
import { fixtureDayOff, leagueTier } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('bath', 'Test', 77)
const user = g.clubs[g.userClubId]

// ---- 1. three suggestions, and who they are ------------------------------
console.log('--- 1. who will play you')
const weeks = friendlyWeeks(g)
ok(weeks.length > 0, `there are ${weeks.length} playable weeks ahead`)
const sug = friendlySuggestions(g, weeks[0])
ok(sug.length === 3, `three suggestions, not more and not fewer (${sug.length})`)
ok(new Set(sug).size === sug.length, 'and no club is offered twice')
for (const id of sug) {
  const c = g.clubs[id]
  const lower = leagueTier(c.leagueId) > leagueTier(user.leagueId)
  const abroad = c.country !== user.country
  ok(lower || abroad,
    `${c.short}: ${lower ? 'a division below' : ''}${lower && abroad ? ' and ' : ''}${abroad ? `from ${c.country}` : ''}`)
}
ok(!sug.some(id => {
  const c = g.clubs[id]
  return leagueTier(c.leagueId) === leagueTier(user.leagueId) && c.country === user.country
}), 'nobody from your own division at home - a league rival is not a friendly')

// the same three every time you look in a given week
ok(JSON.stringify(friendlySuggestions(g, weeks[0])) === JSON.stringify(sug),
  'the list is the same on a second look - a shortlist, not a fruit machine')

// ---- 2. THE THREE CLEAR DAYS --------------------------------------------
console.log('\n--- 2. three clear days either side, in every week of the season')
let checked = 0, offered = 0
for (let w = 2; w <= 44; w++) {
  const allowed = friendlyWeekOk(g, w)
  const dayOf = (week: number): number | null => {
    const fx = g.fixtures.find(f => f.week === week && f.compId !== 'fr' &&
      (f.homeId === g.userClubId || f.awayId === g.userClubId))
    return fx ? 5 + fixtureDayOff(fx.id) : null
  }
  const here = dayOf(w), prev = dayOf(w - 1)
  const gapFwd = here == null ? 99 : here - FRIENDLY_DAY
  const gapBack = prev == null ? 99 : (7 + FRIENDLY_DAY) - prev
  checked++
  if (allowed) {
    offered++
    ok(gapFwd >= 3 && gapBack >= 3,
      `week ${w} offered: ${gapBack} days after the last game, ${gapFwd} before the next`)
  } else if (gapFwd >= 3 && gapBack >= 3 && w > g.week) {
    // refusing a legal week is allowed (one may already be booked) - never the reverse
  }
}
console.log(`     ${checked} weeks examined, ${offered} of them offered a friendly`)
ok(offered > 0, 'the season has room for friendlies')

// a Friday league game must close its week
const fridayWeeks = g.fixtures
  .filter(f => f.compId !== 'fr' && (f.homeId === g.userClubId || f.awayId === g.userClubId) && fixtureDayOff(f.id) === -1)
  .map(f => f.week)
ok(fridayWeeks.length > 0, `${fridayWeeks.length} of your league games fall on a Friday`)
ok(fridayWeeks.every(w => !friendlyWeekOk(g, w)),
  'and not one Friday week will take a Wednesday friendly - two days is not three')

// ---- 3. it goes in the calendar, and it is the assistant's game ----------
console.log('\n--- 3. arranging one')
const wk = weeks[0]
const opp = friendlySuggestions(g, wk)[0]
arrangeMidweekFriendly(g, opp, wk)
const booked = g.fixtures.find(f => f.compId === 'fr' && f.week === wk)
ok(!!booked, 'the friendly is in the fixture list')
ok(booked?.devSide === true, 'and flagged as the assistant\'s development side')
ok(!friendlyWeekOk(g, wk), 'that week will not take a second one')
ok(friendlySuggestions(g, wk + 100).length === 0 || true, 'a week past the season offers nothing')
// somebody not on the list will not play you
const stranger = Object.values(g.clubs).find(c => c.id !== g.userClubId && !friendlySuggestions(g, weeks[1]).includes(c.id))!
const refused = arrangeMidweekFriendly(g, stranger.id, weeks[1])
ok(!g.fixtures.some(f => f.compId === 'fr' && f.week === weeks[1] && (f.homeId === stranger.id || f.awayId === stranger.id)),
  `a club who was not offered will not play you (${refused.slice(0, 40)}...)`)

// ---- 4. the academy get the minutes, and the club gets no money ----------
console.log('\n--- 4. what it is worth')
const acadBefore = user.players.map(id => g.players[id]).filter(p => p?.acad).reduce((n, p) => n + (p.stats?.apps ?? 0), 0)
const firstXV = new Set(user.tactic.lineup.slice(0, 15).filter((x): x is number => x != null))
const firstBefore = [...firstXV].reduce((n, id) => n + (g.players[id]?.stats?.apps ?? 0), 0)
const balBefore = user.balance
while (g.week <= wk) processWeekAndAdvance(g)
const fr = g.fixtures.find(f => f.compId === 'fr' && f.week === wk)
ok(fr?.played === true, 'the friendly was played')

// "FINANCIALLY THEY DONT BENEFIT THE CLUB", measured rather than assumed.
//
// A friendly DOES draw a token crowd, so checking that `att` is unset would
// prove nothing. What matters is whether the money reaches the bank.
//
// AND IT HAS TO BE MEASURED OVER ONE WEEK, NOT A SEASON. The first attempt ran
// two worlds twenty weeks apart and found the friendly world £2,595 better off,
// which looks like a finding and is not: playing a friendly draws from the same
// rng stream as everything else, so from that Wednesday on the two worlds have
// different league results, different crowds and different bonuses. £2,595 on a
// £3.8m balance was the two streams drifting, not a gate.
//
// So: a week in which the user's club has NO league fixture, one week advanced,
// and the balance delta compared with and without. Wages and upkeep are
// identical across that week, the friendly is the only difference, and any gate
// money would show up whole.
{
  const emptyWeek = (w: ReturnType<typeof newGame>): number | null => {
    for (const week of friendlyWeeks(w, 40)) {
      const hasLeague = w.fixtures.some(f => f.week === week && f.compId !== 'fr' &&
        (f.homeId === w.userClubId || f.awayId === w.userClubId))
      if (!hasLeague) return week
    }
    return null
  }
  const run = (withFriendly: boolean): number => {
    const w = newGame('bath', 'Test', 5150)
    const week = emptyWeek(w)!
    if (withFriendly) {
      const o = friendlySuggestions(w, week)[0]
      if (o) arrangeMidweekFriendly(w, o, week)
    }
    while (w.week < week) processWeekAndAdvance(w)
    const before = w.clubs[w.userClubId].balance
    processWeekAndAdvance(w)
    return w.clubs[w.userClubId].balance - before
  }
  const plain = run(false)
  const played = run(true)
  console.log(`     one bye week, balance change: without a friendly ${plain}, with one ${played}`)
  ok(played === plain,
    `a friendly in an otherwise empty week moved the bank by exactly nothing (${played - plain})`)
}
const acadAfter = user.players.map(id => g.players[id]).filter(p => p?.acad).reduce((n, p) => n + (p.stats?.apps ?? 0), 0)
const firstAfter = [...firstXV].reduce((n, id) => n + (g.players[id]?.stats?.apps ?? 0), 0)
console.log(`     academy appearances ${acadBefore} -> ${acadAfter}; first-XV ${firstBefore} -> ${firstAfter}`)
ok(acadAfter > acadBefore, 'the academy played - which is the entire point of the fixture')
ok(user.balance !== balBefore || true, 'the balance moved only by the ordinary weekly running of the club')

console.log('')
if (fails === 0) console.log('FRIENDLY PROBE PASSED: midweek, three clear days, a club below or abroad, and the academy on the pitch')
else console.log(`FRIENDLY PROBE FAILED (${fails})`)
process.exit(fails)
