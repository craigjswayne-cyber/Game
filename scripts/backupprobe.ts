// Probe: the game asks you to back up your career, once a season, forever.
//
// The save lives in one browser's IndexedDB. Clearing browsing data takes it,
// and on an iPhone WebKit's storage cap takes it after about a week away. The
// export has existed for months and nothing in the game had ever mentioned it,
// so a manager three seasons in had no reason to know it was there.
//
// Two ways to get this wrong, and they are opposite: file it once and a career
// that runs twenty seasons hears about backups in year one and never again, or
// file it eagerly and it becomes a weekly nag that gets ignored like every other
// weekly nag. So: exactly one per rollover, no more, no fewer, and it has to name
// the thing the manager actually has to tap.
//
// NOTE ON COUNTING, learned the hard way here: state.news is a 250-item ring
// buffer (NEWS_KEEP in season.ts), so a once-a-season story is not in the feed
// four seasons later. The first version of this probe counted survivors at the
// end, found one reminder for four rollovers, and read as a game bug. Anything
// checking a rare story over a long career has to collect as it goes.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS, type NewsItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEASONS = 4
const isNudge = (subject: string) => subject.includes('back it up')

for (const seed of [4242, 90210]) {
  const g = newGame('northampton', 'Backup Probe', seed)
  const nudges: NewsItem[] = []
  const seen = new Set<number>()
  for (let w = 0; w < SEASON_WEEKS * SEASONS + 6; w++) {
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (isNudge(n.subject) && !seen.has(n.id)) { seen.add(n.id); nudges.push(n) }
    }
  }

  const perSeason = new Map<number, number>()
  for (const n of nudges) perSeason.set(n.season, (perSeason.get(n.season) ?? 0) + 1)
  const seasonsReached = g.season
  console.log(`\nseed ${seed}: ${seasonsReached} rollovers, ${nudges.length} reminders`)
  for (const n of nudges) console.log(`  s${n.season} wk${n.week}  ${n.subject}`)

  ok(nudges.length === seasonsReached,
    `one reminder per rollover and no more (${nudges.length} for ${seasonsReached})`)
  ok([...perSeason.values()].every(c => c === 1), 'never twice in the same season')
  ok(nudges.every(n => /Export Career/.test(n.body)),
    'each one names the button, so it can be acted on without a hunt')
  ok(nudges.every(n => /Game Status/.test(n.body)), 'and the screen it lives on')
  // it must not be a gossip item: those never reach the inbox
  ok(nudges.every(n => n.type !== 'gossip'), 'filed where the manager will actually see it')
  // and the season it names is the one just finished, not the one starting
  ok(nudges.every(n => n.subject.includes(String(2025 + n.season - 1))),
    'the headline names the season that just finished')
}

console.log(fails ? `\nBACKUP PROBE FAILED (${fails})` : '\nBACKUP PROBE PASSED: once a season, and it says which button')
process.exit(fails ? 1 : 0)
