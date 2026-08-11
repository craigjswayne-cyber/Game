// Probe: the form guide reads the calendar, not the array.
//
// Reported live with two screenshots: the Fixtures list showed a loss away at
// Sale inside the last five results, and the Home hub's FORM card said
// W W W W W over the caption "last 5 matches". Both were telling the truth
// about different questions. The fixtures ARRAY is built league-first at the
// season rollover, and every cup round and arranged friendly is APPENDED to
// the end as it is drawn - so once a knockout round has been played, a raw
// slice(-5) of played fixtures reads the array tail, which is not the last
// five Saturdays. A by-date result (the Sale loss) falls out and an
// out-of-window cup win takes its seat.
//
// The fix is formGuide() in model.ts: sort by week, THEN slice. This probe
// settles two full seasons for real and, every week, for every club, compares
// three answers about the last five results:
//
//   truth       the played fixtures sorted by week, last five
//   array order what the Home card used to compute (the old code, verbatim)
//   formGuide   what everything computes now
//
// formGuide must equal truth for every club in every week. And the probe also
// demands the DIVERGENCE is real: on a genuinely settled save the array-order
// answer must disagree with the calendar somewhere, otherwise this probe
// would pass against the old code and prove nothing.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { formGuide } from '../src/game/model'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g: GameState = newGame('northampton', 'Form Probe', 909)

const letters = (fs: Fixture[], clubId: string) => fs.map(f => {
  const us = f.homeId === clubId ? f.homeScore : f.awayScore
  const them = f.homeId === clubId ? f.awayScore : f.homeScore
  return us > them ? 'W' : us < them ? 'L' : 'D'
}).join(' ')

let checked = 0
let divergences = 0
let example = ''
let mismatches = 0
let sawLoss = false

for (let i = 0; i < 34 * 2; i++) {
  processWeekAndAdvance(g)
  for (const clubId of Object.keys(g.clubs)) {
    const mine = g.fixtures.filter(f => f.played && (f.homeId === clubId || f.awayId === clubId))
    if (mine.length < 5) continue
    checked++
    const truth = letters([...mine].sort((a, b) => a.week - b.week).slice(-5), clubId)
    const arrayOrder = letters(mine.slice(-5), clubId) // the old Home card, verbatim
    const guide = formGuide(g, clubId).join(' ')
    if (guide !== truth) {
      mismatches++
      if (mismatches <= 5) console.log(`FAIL  ${clubId} s${g.season}w${g.week}: formGuide "${guide}" but the calendar says "${truth}"`)
    }
    if (arrayOrder !== truth) {
      divergences++
      if (!example) example = `${clubId} s${g.season}w${g.week}: array order said "${arrayOrder}", the calendar says "${truth}"`
    }
    if (guide.includes('L')) sawLoss = true
  }
}

console.log(`\n${checked} club-weeks checked over two settled seasons\n`)
ok(checked >= 500, `enough club-weeks to judge (${checked})`)
ok(mismatches === 0, `formGuide matches the calendar in every one of them${mismatches ? ` (${mismatches} did not)` : ''}`)
ok(divergences > 0, `and the old array-order slice really was lying: ${divergences} club-weeks diverged`)
if (example) console.log(`      e.g. ${example}`)
ok(sawLoss, 'losses show up as L in somebody\'s guide, so the letters are live')

// The screenshot case, reconstructed exactly: a played league loss whose week
// sits INSIDE the last five Saturdays, with five later-appended, played cup
// wins sitting after it in the array. The old code showed five Ws.
{
  const s = {
    fixtures: [
      { homeId: 'sale', awayId: 'us', homeScore: 30, awayScore: 17, week: 25, played: true, compId: 'prem' },
      { homeId: 'us', awayId: 'a', homeScore: 20, awayScore: 10, week: 26, played: true, compId: 'prem' },
      { homeId: 'us', awayId: 'b', homeScore: 20, awayScore: 10, week: 22, played: true, compId: 'cup' },
      { homeId: 'us', awayId: 'c', homeScore: 20, awayScore: 10, week: 23, played: true, compId: 'cup' },
      { homeId: 'us', awayId: 'd', homeScore: 20, awayScore: 10, week: 24, played: true, compId: 'cup' },
      { homeId: 'us', awayId: 'e', homeScore: 20, awayScore: 10, week: 27, played: true, compId: 'cup' },
      { homeId: 'us', awayId: 'f', homeScore: 20, awayScore: 10, week: 28, played: true, compId: 'cup' },
    ],
  } as unknown as GameState
  const guide = formGuide(s, 'us').join(' ')
  const old = letters(s.fixtures.filter(f => f.played).slice(-5), 'us')
  ok(old === 'W W W W W', `the reconstructed screenshot: the old slice shows "${old}"`)
  ok(guide === 'W L W W W', `formGuide shows the loss: "${guide}"`)
}

if (fails) { console.error(`\nFORM PROBE: ${fails} failures`); process.exit(1) }
console.log('\nFORM PROBE PASSED: the last five means the last five Saturdays')
