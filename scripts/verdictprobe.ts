// Probe: the media verdict judges a club inside its own league.
//
// User, scanning National League One clubs: "they all say relegation zone."
// The old label read absolute reputation on a scale calibrated for the
// Premiership, so an entire lower division wore the same bottom tag - in a
// league that has no relegation and no playoffs, both words the label used
// were impossible. Four claims:
//
//   1. No league is a monoculture: every division hands out at least three
//      different verdicts, favourites at the top and doubters at the bottom.
//   2. A verdict never promises what the league does not have: 'Playoff
//      contenders' only where playoffTeams > 0, promotion talk only where
//      there are none, and relegation talk only in the leagues on RELEGATES.
//   3. National League One specifically - the screenshot league - never says
//      relegation and its best sides read as front-runners.
//   4. Exactly one club per league is the title favourite.
import { LEAGUE_DEFS } from '../src/game/newgame'
import { RELEGATES } from '../src/game/model'
// namespace lookup, not a named import: the export does not exist on the old
// code, and a missing named import would kill the run at load time instead of
// showing each claim red on its own line
import * as NG from '../src/game/newgame'
const mediaVerdict = (NG as {
  mediaVerdict?: (club: { id: string }, league: ReturnType<typeof LEAGUE_DEFS>[number]) => string
}).mediaVerdict

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

ok(typeof mediaVerdict === 'function', 'mediaVerdict exists - the verdict is a league rule, not a screen constant')
if (!mediaVerdict) {
  console.log('\nVERDICT PROBE FAILED (1)')
  process.exit(1)
}

for (const league of LEAGUE_DEFS()) {
  const verdicts = league.clubs.map(c => mediaVerdict(c, league))
  const distinct = new Set(verdicts)
  ok(distinct.size >= 3,
    `${league.short}: the press can tell its clubs apart (${distinct.size} verdicts across ${league.clubs.length} clubs)`)
  ok(verdicts.filter(v => v === 'Title favourites').length === 1,
    `${league.short}: exactly one title favourite`)
  const saysPlayoffs = verdicts.some(v => v.includes('Playoff'))
  const saysPromotion = verdicts.some(v => v.includes('Promotion'))
  const saysRelegation = verdicts.some(v => v.toLowerCase().includes('relegation'))
  ok(saysPlayoffs === (league.playoffTeams > 0),
    `${league.short}: playoff talk ${league.playoffTeams > 0 ? 'where playoffs exist' : 'NEVER - it has no playoffs'}`)
  ok(!saysPromotion || league.playoffTeams === 0,
    `${league.short}: promotion talk only where the ladder is the prize`)
  ok(saysRelegation === RELEGATES.includes(league.id),
    `${league.short}: relegation talk ${RELEGATES.includes(league.id) ? 'where the trapdoor exists' : 'NEVER - nobody goes down'}`)
}

// the screenshot league, held to its exact words
const natl1 = LEAGUE_DEFS().find(l => l.id === 'natl1')!
const natVerdicts = natl1.clubs.map(c => mediaVerdict(c, natl1))
ok(natVerdicts.every(v => !v.toLowerCase().includes('relegation')),
  'National 1 never threatens relegation - the league has none')
ok(natVerdicts.includes('Promotion chasers'),
  'National 1 top sides chase promotion, not playoffs it does not run')

console.log(fails ? `\nVERDICT PROBE FAILED (${fails})` : '\nVERDICT PROBE PASSED: every league is judged on its own terms')
process.exit(fails ? 1 : 0)
