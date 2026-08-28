// Probe: the big occasions read true.
//
// Four pieces of live feedback from one champion season, all of them the
// game mis-narrating its own biggest moments:
//
//   "the final was at Twickenham so it shouldn't have been a record" - a
//   showpiece final names the user as nominal home with fx.venue set, and
//   80,941 through a neutral ground's turnstiles was announced as a record
//   gate at a 15,000-seat home ground.
//
//   "its saying its all mine but the playoffs are still to be played" - the
//   final-day spotlight said "Win and it is yours. Simple as that." in a
//   league whose title is settled by three knockout rounds.
//
//   "there is no announcement when you mathematically qualify" - clinching a
//   playoff place made no sound.
//
//   "day after winning both prem final and champs cup - no press questions
//   about success" - the press generator had no beat for a won final, so the
//   Monday after a double the room asked about a winger's form.
import { newGame } from '../src/game/newgame'
import { generatePress } from '../src/game/media'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { sortTable } from '../src/game/schedule'
import { SEASON_WEEKS } from '../src/game/model'
import type { Fixture, GameState } from '../src/game/model'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Mark the user's fixture this week as played with the given numbers, so the
 *  settle takes the MatchDay path over our result instead of simming one. */
const inject = (g: GameState, fx: Fixture, att: number, venue?: { name: string; city: string; capacity: number }) => {
  const home = fx.homeId === g.userClubId
  fx.played = true
  fx.homeScore = home ? 30 : 10
  fx.awayScore = home ? 10 : 30
  fx.homeTries = home ? 4 : 1
  fx.awayTries = home ? 1 : 4
  fx.att = att
  if (venue) fx.venue = venue
}

// ---- 1. a neutral final's crowd is not your gate record --------------------
{
  const g = newGame('northampton', 'Occasion', 7)
  const club = g.clubs[g.userClubId]
  const gates = [
    { att: 13_000, venue: undefined },
    { att: 80_941, venue: { name: 'Twickenham', city: 'London', capacity: 82_000 } },
    { att: 15_500, venue: undefined },
  ]
  let step = 0
  for (let i = 0; i < 40 && step < gates.length; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx && fx.homeId === g.userClubId && fx.compId === club.leagueId && !fx.stage) {
      inject(g, fx, gates[step].att, gates[step].venue)
      step++
    }
    processWeekAndAdvance(g)
    if (step === 2 && g.gateRecord && g.gateRecord.att !== 13_000) break
  }
  ok(step === gates.length, `three home league gates staged (${step})`)
  ok(g.gateRecord?.att === 15_500,
    `the record is the biggest crowd at YOUR ground (${g.gateRecord?.att?.toLocaleString()}), not the neutral final's 80,941`)
  const bogus = g.news.find(n => n.subject.includes('RECORD GATE') && n.subject.includes('80,941'))
  ok(!bogus, `no record-gate story for the neutral ground${bogus ? ` - "${bogus.subject}"` : ''}`)
  const real = g.news.find(n => n.subject.includes('RECORD GATE') && n.subject.includes('15,500'))
  ok(!!real && real.subject.includes(club.stadium), 'the real record story names the home ground')
}

// ---- 2 & 3. the last-round spotlight, and the clinch, in a playoff league --
{
  const g = newGame('northampton', 'Occasion', 9)
  const club = g.clubs[g.userClubId]
  const comp = g.comps[club.leagueId]
  ok((comp.playoffTeams ?? 0) > 0, `the Premiership settles its title in the playoffs (top ${comp.playoffTeams})`)
  // walk to the run-in, then doctor a table the user has already won: miles
  // clear on points, one league round left to play. The board is pinned
  // content on the way (the annualprobe lesson): an autopilot slump ended
  // the tenure before week 32 on this seed once the v1.1.6 squad re-deal
  // met the v1.1.4 morale rules, and an unemployed manager has no run-in.
  for (let i = 0; i < 60 && g.week < 32; i++) {
    g.clubs[g.userClubId].boardConfidence = Math.max(70, g.clubs[g.userClubId].boardConfidence)
    processWeekAndAdvance(g)
  }
  for (const r of comp.table) r.pts = r.teamId === club.id ? 90 : 40
  const mine = g.fixtures.filter(f =>
    f.compId === comp.id && !f.stage && !f.played &&
    (f.homeId === club.id || f.awayId === club.id))
    .sort((a, b) => a.week - b.week)
  // Keep the LATEST remaining round unplayed, not an arbitrary one: the week
  // about to be processed plays its own fixtures, and if the kept round is in
  // it, roundsLeft hits 0 mid-week and the whole run-in block skips. The
  // 2026-27 squad update re-dealt the calendar into exactly that shape.
  for (const f of mine.slice(0, -1)) { f.played = true; f.tableApplied = true }
  ok(mine.length >= 1, `a last league round exists to build the final-day story on (${mine.length} unplayed)`)
  processWeekAndAdvance(g)
  const spot = g.news.filter(n => n.subject.includes('FINAL DAY')).pop()
  ok(!!spot, 'the final-day spotlight ran')
  if (spot) {
    ok(spot.subject.includes('top seed') && !spot.body.includes('Win and it is yours'),
      `topping a playoff league promises the top seed, not the title ("${spot.subject}")`)
  }
  const clinch = g.news.find(n => n.subject.includes('PLAYOFFS SECURED'))
  ok(!!clinch, 'mathematical qualification got said out loud')
  ok(g.playoffClinch === g.season, 'and it is stamped, so it says it once')
  const before = g.news.filter(n => n.subject.includes('PLAYOFFS SECURED')).length
  processWeekAndAdvance(g)
  const after = g.news.filter(n => n.subject.includes('PLAYOFFS SECURED')).length
  ok(after === before, 'the following week does not announce it again')
}

// ---- 4. the room toasts the trophy, and a double as a double ---------------
{
  const g = newGame('northampton', 'Occasion', 11)
  // past the pre-season camp and launch questions, which fire first and
  // return - a real final lives in the forties anyway
  for (let i = 0; i < 4; i++) processWeekAndAdvance(g)
  const abs = () => g.season * SEASON_WEEKS + g.week
  const final = (compId: string, id: number): Fixture => ({
    id, compId, round: 99, week: g.week, homeId: g.userClubId, awayId: 'leicester',
    played: true, homeScore: 28, awayScore: 12, homeTries: 3, awayTries: 1,
    stage: 'F', att: 82_000, venue: { name: 'Twickenham', city: 'London', capacity: 82_000 },
  })
  g.fixtures.push(final('prem', 800_001), final('cc', 800_002))
  generatePress(g, mulberry32(5))
  const q = g.press.find(p => !p.answered && p.options.some(o => /earned every inch/.test(o.label)))
  ok(!!q, 'the morning after a double, the first question is about the double')
  if (q) {
    const prem = g.comps['prem']?.name ?? 'Premiership'
    const cc = g.comps['cc']?.name ?? 'Continental Cup'
    ok(q.question.includes(prem) && q.question.includes(cc),
      'both trophies are named in the question')
    ok(g.silverwareAsk === abs(), 'the toast is stamped to the newest final')
    // and the same weekend is toasted exactly once
    generatePress(g, mulberry32(6))
    const again = g.press.filter(p => p.options.some(o => /earned every inch/.test(o.label)))
    ok(again.length === 1, 'one toast per trophy weekend, not one per week')
  }
}

console.log(fails ? `\nOCCASION PROBE FAILED (${fails})` : '\nOCCASION PROBE PASSED: the big days read the way they felt')
process.exit(fails ? 1 : 0)
