/**
 * ---- THE MAJOR RUGBY COMPETITION (mrc.ts) ----
 *
 * Owner, 26 Sep 2026: "add USA MLR - call it Major Rugby Competition", six
 * clubs (Charlotte kept), spread over the season. This holds it:
 *
 *   1. six clubs, home and away (ten rounds each), spread from the first league
 *      weekend to the last, the top four into semi-finals and a final
 *   2. a career at an MRC club plays a whole season, with a champion crowned
 *   3. nobody in it goes up or down, and it is a top flight (tier one), so no
 *      MRC club is offered a promotion dream it can never win
 *   4. the names follow the rename rules: place plus RFC, no real mark, and
 *      Americans born into the world get American names
 *   5. every MRC ground is placed on the map, so travel is measured
 *
 * Run: npx vite-node scripts/mrcprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { LEAGUE_TIER, RELEGATES } from '../src/game/model'
import { venueOf } from '../src/game/geo'
import { MRC } from '../src/data/leagues/mrc'
import { regenName } from '../src/game/nations'
import { mulberry32 } from '../src/game/rng'
import { migrate } from '../src/game/save'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

console.log('--- 1. the league')
const g = newGame('freejacks', 'MRC Probe', 1776)
const comp = g.comps.mrc
ok(!!comp && comp.name === 'Major Rugby Competition' && comp.short === 'MRC', `the competition is there and named (${comp?.name})`)
const ids = Object.values(g.clubs).filter(c => c.leagueId === 'mrc').map(c => c.id).sort()
ok(ids.length === 6, `six clubs (${ids.join(', ')})`)
const league = g.fixtures.filter(f => f.compId === 'mrc')
const per = ids.map(id => league.filter(f => f.homeId === id || f.awayId === id))
ok(per.every(fs => fs.length === 10), `each plays ten (${per.map(fs => fs.length).join('/')})`)
ok(ids.every(id => league.filter(f => f.homeId === id).length === 5), 'five at home, five away')
const weeks = [...new Set(league.map(f => f.week))].sort((a, b) => a - b)
ok(weeks[0] <= 6 && weeks[weeks.length - 1] >= 35, `spread over the season, weeks ${weeks[0]} to ${weeks[weeks.length - 1]} (${weeks.join(', ')})`)

console.log('--- 2. a season at an MRC club')
// to the last week of the season, before the summer clears the fixtures
for (let i = 0; i < 60 && g.season === 0 && g.week < 46; i++) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), false)
  processWeekAndAdvance(g)
}
const ko = g.fixtures.filter(f => f.compId === 'mrc' && f.stage)
const sfs = ko.filter(f => f.stage === 'SF'), fin = ko.filter(f => f.stage === 'F')
ok(sfs.length === 2 && sfs.every(f => f.played), `two semi-finals, both played (${sfs.map(f => `${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`).join('; ')})`)
ok(fin.length === 1 && fin[0].played, `and a final (${fin.map(f => `${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId}`).join('')})`)
for (let i = 0; i < 20 && g.season === 0; i++) processWeekAndAdvance(g)
ok(g.season === 1 && !!g.comps.mrc && g.fixtures.some(f => f.compId === 'mrc'), 'the summer comes and the next MRC season is drawn')

console.log('--- 3. nothing to climb to')
ok(LEAGUE_TIER.mrc === 1, 'tier one, like Japan\'s')
ok(!RELEGATES.includes('mrc'), 'nobody is relegated from it')

console.log('--- 4. names')
ok(MRC.every(c => / RFC$/.test(c.name) && !/[A-Z][a-z]+ (Hounds|Legion|Seawolves|Free Jacks|Old Glory|Anthem)/.test(c.name)), 'every club is its place plus RFC')
const marks = /Free Jacks|Hounds|Seawolves|Legion Stadium|Old Glory|Anthem|SeatGeek|Starfire|Torero Stadium|SoccerPlex|Veterans Memorial Stadium|American Legion/
ok(MRC.every(c => !marks.test(c.name) && !marks.test(c.stadium)), 'no real club or ground mark')
const rng = mulberry32(7)
const us = Array.from({ length: 20 }, () => regenName(rng, 'USA', new Set(), 'm'))
const eng = Array.from({ length: 20 }, () => regenName(mulberry32(7), 'ENG', new Set(), 'm'))
ok(us.join() !== eng.join(), `an American regen is not given an English name (${us.slice(0, 3).join(', ')})`)

console.log('--- 5. on the map')
ok(MRC.every(c => !!venueOf(c.city, undefined)), `every ground is placed (${MRC.map(c => c.city).join(', ')})`)

console.log('--- 6. a career saved before 1.7.3')
{
  const old = newGame('leicester', 'Old Save', 4242)
  for (const c of Object.values(old.clubs)) {
    if (c.leagueId !== 'mrc') continue
    for (const id of c.players) delete old.players[id]
    delete old.clubs[c.id]
  }
  delete old.comps.mrc
  old.fixtures = old.fixtures.filter(f => f.compId !== 'mrc')
  const m = migrate(JSON.parse(JSON.stringify(old)))
  const got = Object.values(m.clubs).filter(c => c.leagueId === 'mrc')
  ok(got.length === 6 && got.every(c => c.players.length >= 28), `the six clubs arrive, with squads (${got.map(c => c.players.length).join('/')})`)
  for (let i = 0; i < 60 && m.season === 0; i++) processWeekAndAdvance(m)
  ok(!!m.comps.mrc && m.fixtures.some(f => f.compId === 'mrc'), 'and the league is drawn at the next summer')
}

console.log(fails ? `\nMRC PROBE FAILED (${fails})` : '\nMRC PROBE PASSED: six clubs, ten rounds each, a champion, and nothing real in the names')
process.exit(fails ? 1 : 0)
