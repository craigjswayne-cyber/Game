/**
 * ---- WHAT THIS MATCH MEANS ----
 *
 * The billing line: one sentence before kick-off naming the loudest true thing
 * about the fixture. Everything it says was already in the save; nothing in the
 * game had ever said it at the moment it lands.
 *
 * The four properties that keep it from becoming wallpaper:
 *
 *   1. IT NEVER LIES. Staged tables are checked against the sentence produced.
 *      "Win and you go top" only when winning really would.
 *   2. IT KNOWS WHEN TO SHUT UP. A fixture with nothing interesting about it
 *      returns null. A billing on every match is a billing on none.
 *   3. IT PICKS THE LOUDEST. Given a relegation six-pointer AND a nice unbeaten
 *      run, it says the six-pointer.
 *   4. IT CHANGES NOTHING. Pure read - asserted by byte comparison of the save
 *      across a call, the same guard dreamState carries.
 *
 * Run: npx vite-node scripts/billprobe.ts
 */
import * as S from '../src/game/stakes'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { sortTable } from '../src/game/schedule'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

ok(typeof S.matchStakes === 'function', 'stakes.ts exports matchStakes')
ok(typeof S.seasonTentpoles === 'function', 'stakes.ts exports seasonTentpoles')

/** The user's next unplayed league fixture in a fresh world. */
const nextLeague = (g: GameState): Fixture => {
  const club = g.clubs[g.userClubId]
  return g.fixtures.find(f => !f.played && f.compId === club.leagueId &&
    (f.homeId === g.userClubId || f.awayId === g.userClubId))!
}

// ---- it knows when to shut up ----
{
  const g = newGame('northampton', 'Billing', 71)
  const fx = nextLeague(g)
  const line = S.matchStakes(g, fx)
  ok(line === null, `week one, nothing has happened, nothing to say (got ${JSON.stringify(line)})`)
}

// ---- a fixture that is not yours is not billed ----
{
  const g = newGame('northampton', 'Billing', 72)
  const other = g.fixtures.find(f => f.homeId !== g.userClubId && f.awayId !== g.userClubId)!
  ok(S.matchStakes(g, other) === null, 'a fixture the manager is not in gets no billing')
}

// ---- the table maths is real ----
{
  const g = newGame('northampton', 'Billing', 73)
  const uid = g.userClubId
  const club = g.clubs[uid]
  const comp = g.comps[club.leagueId]
  // stage a table where a win takes us top whatever else happens: the leader
  // is our opponent, on 18 to our 17, and at most takes two bonus points off
  // a defeat to us; everybody else is out of reach
  for (const r of comp.table) { r.pts = 5; r.p = 6 }
  const fx = nextLeague(g)
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  const leader = comp.table.find(r => r.teamId === oppId)!
  const me = comp.table.find(r => r.teamId === uid)!
  leader.pts = 18; me.pts = 17
  const line = S.matchStakes(g, fx)
  ok(!!line && line.includes('go top of the league'), `beat the leader and you are top, certain (got "${line}")`)
  // THE PROMISE HOLDS WHATEVER HAPPENS ELSEWHERE (owner, 1.8.12: "it said win
  // and we go top, we won convincingly but didnt go top"). A leader three
  // points up who plays somebody else the same weekend can win too: a win
  // makes top possible, not certain, and the line says so
  const other = comp.table.find(r => r.teamId !== uid && r.teamId !== oppId &&
    g.fixtures.some(f => !f.played && !f.stage && f.week === fx.week && f.compId === comp.id && (f.homeId === r.teamId || f.awayId === r.teamId)))!
  leader.pts = 5; other.pts = 20
  const maybe = S.matchStakes(g, fx)
  ok(!!maybe && !maybe.includes('go top of the league') && maybe.includes('could go top'), `a leader who also plays: "could", never "will" (got "${maybe}")`)
  // now put the leader out of reach of a single win: no top claim
  other.pts = 40
  const far = S.matchStakes(g, fx)
  ok(!far || !far.includes('go top'), `a 23-point gap does not claim the summit (got "${far}")`)
}

// ---- and the table is played out for real ----
// Every club's billing is read before each league round (the line is a pure
// read, so it is asked as if each club were the manager's), the round is
// played, and every club that won is held to what it was told.
{
  let promises = 0, broken: string[] = []
  for (const seed of [81, 82, 83]) {
    const g = newGame('northampton', 'Billing', seed)
    const uid = g.userClubId
    for (let w = 0; w < 46; w++) {
      if (!g.unemployed) g.clubs[g.userClubId].boardConfidence = Math.max(g.clubs[g.userClubId].boardConfidence, 55)
      const said: { club: string; fx: Fixture; want: number; line: string }[] = []
      for (const fx of g.fixtures.filter(f => !f.played && !f.stage && f.week === g.week && g.comps[f.compId]?.type === 'league')) {
        for (const club of [fx.homeId, fx.awayId]) {
          if (!g.clubs[club]) continue
          g.userClubId = club
          const line = S.matchStakes(g, fx) ?? ''
          g.userClubId = uid
          const climb = line.match(/climb to (\d+)/)
          const want = line.includes('go top of the league') || line.includes('you stay there') ? 1 : climb ? Number(climb[1]) : 0
          if (want) said.push({ club, fx, want, line })
        }
      }
      g.userClubId = uid
      processWeekAndAdvance(g)
      for (const x of said) {
        const f = g.fixtures.find(y => y.id === x.fx.id)!
        if (!f.played) continue
        const won = f.homeId === x.club ? f.homeScore > f.awayScore : f.awayScore > f.homeScore
        if (!won) continue
        promises++
        const pos = sortTable(g.comps[f.compId].table).findIndex(r => r.teamId === x.club) + 1
        if (pos > x.want) broken.push(`${x.club} told "${x.line}", finished the round ${pos}`)
      }
    }
  }
  ok(promises >= 20 && broken.length === 0, `${promises} promises kept by winners across three played seasons${broken.length ? `; broken: ${broken.slice(0, 3).join(' | ')}` : ''}`)
}

// ---- the boardroom outshouts the table ----
{
  const g = newGame('northampton', 'Billing', 74)
  const club = g.clubs[g.userClubId]
  const comp = g.comps[club.leagueId]
  for (const r of comp.table) { r.pts = 5; r.p = 6 }
  const leader = comp.table.find(r => r.teamId !== g.userClubId)!
  const me = comp.table.find(r => r.teamId === g.userClubId)!
  leader.pts = 20; me.pts = 17
  club.boardConfidence = 8
  const line = S.matchStakes(g, nextLeague(g))
  ok(!!line && line.includes('board meets'),
    `a sacking-range boardroom is louder than a promotion to the summit (got "${line}")`)
}

// ---- a final is billed as a final ----
{
  const g = newGame('northampton', 'Billing', 75)
  const fx = nextLeague(g)
  const asFinal: Fixture = { ...fx, stage: 'F' }
  const line = S.matchStakes(g, asFinal)
  ok(!!line && line.toLowerCase().includes('final'), `a final says so (got "${line}")`)
}

// ---- a man on the edge of something ----
{
  const g = newGame('northampton', 'Billing', 76)
  const club = g.clubs[g.userClubId]
  const p = g.players[club.players[0]]
  p.stats.tries = 49
  const line = S.matchStakes(g, nextLeague(g))
  ok(!!line && line.includes(p.name) && line.includes('50'),
    `a man one try short of fifty gets his moment (got "${line}")`)
}

// ---- the loudest wins, and it is the right one ----
{
  const g = newGame('northampton', 'Billing', 77)
  const club = g.clubs[g.userClubId]
  // a nice unbeaten run AND a boardroom crisis: the crisis is the story
  const mine = g.fixtures.filter(f => (f.homeId === club.id || f.awayId === club.id) && f.compId === club.leagueId).slice(0, 8)
  for (const f of mine) {
    f.played = true
    const home = f.homeId === club.id
    f.homeScore = home ? 30 : 10
    f.awayScore = home ? 10 : 30
  }
  const runOnly = S.matchStakes(g, nextLeague(g))
  ok(!!runOnly && runOnly.includes('unbeaten'), `eight unbeaten is worth saying (got "${runOnly}")`)
  club.boardConfidence = 6
  const both = S.matchStakes(g, nextLeague(g))
  ok(!!both && both.includes('board meets'), `and a sacking-range board outranks it (got "${both}")`)
}

// ---- the lens mutates nothing ----
{
  const g = newGame('northampton', 'Billing', 78)
  g.clubs[g.userClubId].boardConfidence = 9
  const fx = nextLeague(g)
  const before = JSON.stringify(g)
  S.matchStakes(g, fx)
  S.matchStakes(g, fx)
  ok(JSON.stringify(g) === before, 'matchStakes is a pure read: the save is byte-identical after it')
}

// ---- the season calendar ----
{
  const g = newGame('northampton', 'Billing', 79)
  const poles = S.seasonTentpoles(g)
  ok(poles.length >= 4, `the season has landmarks to look forward to (${poles.length})`)
  ok(poles.every((t, i) => i === 0 || t.week >= poles[i - 1].week), 'listed in the order they arrive')
  ok(new Set(poles.map(t => t.week)).size === poles.length, 'one entry per week, never two on the same date')
  ok(poles.some(t => t.label.includes('Intake')), 'and intake day is on it')
  const before = JSON.stringify(g)
  S.seasonTentpoles(g)
  ok(JSON.stringify(g) === before, 'the calendar is a pure read too')
}

console.log(fails ? `BILLING PROBE FAILED (${fails})` : 'BILLING PROBE PASSED: every match knows what it is for')
if (fails) process.exit(1)
