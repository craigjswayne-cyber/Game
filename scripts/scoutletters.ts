// Probe: the chief scout writes home once a month while he is on the road.
//
// Owner: "if you send a scout out on the road, there should be an update in
// news once a month for the period of time." Checks the cadence (one letter
// every four weeks, never two in a week, never in the report's week), that a
// brief which has run out of new names still writes, that the stamp survives a
// save and a load, and that every letter reads in all six languages.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { commissionScout, scoutPostcard, type SearchMonths } from '../src/game/commission'
import { appointStaff, staffCandidates, staffInterest } from '../src/game/staff'
import { migrate } from '../src/game/save'
import { ensureLang, tIn, type Lang } from '../src/game/i18n'
import { addWeeks100, stamp100, type GameState, type NewsItem, type Pos } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const LETTERS = new Set(['news.scoutMonthly', 'news.scoutMonthlyNone'])
const LANGS: Lang[] = ['en', 'fr', 'es', 'it', 'af', 'ja']
for (const l of LANGS) await ensureLang(l)

function withScout(seed: number) {
  const g = newGame('leicester', 'Scout Probe', seed)
  g.clubs[g.userClubId].balance = 20_000_000
  if (!g.staffPeople?.scout) {
    const i = staffCandidates(g, 'scout').findIndex(c => staffInterest(g, c) !== 'no')
    if (i >= 0) appointStaff(g, 'scout', i)
  }
  return g
}

const roundTrip = (g: GameState) => migrate(JSON.parse(JSON.stringify(g)) as GameState)

/** Run a brief to its end, a save and a load every few weeks; return the
 *  week (real, from the start) of each letter and the report. */
function runBrief(g: GameState, label: string, pos: Pos | 'any', months: SearchMonths, prep?: (g: GameState) => void) {
  const reply = commissionScout(g, pos, months)
  if (!g.commission) { bad(`${label}: brief not booked (${reply})`); return { g, letters: [] as NewsItem[] } }
  prep?.(g)
  const letters: NewsItem[] = []
  let reportAt = -1
  let lastId = g.nextId
  for (let w = 1; w <= months * 5 + 4 && reportAt < 0; w++) {
    processWeekAndAdvance(g)
    // the week is processed and gone: a second pass at the postcard for the
    // same week (a reload, a double call) must not write again
    const fresh = g.news.filter(n => n.id >= lastId && n.tag === 'scout')
    lastId = g.nextId
    const mine = fresh.filter(n => LETTERS.has(n.k ?? ''))
    if (mine.length > 1) bad(`${label}: ${mine.length} letters in one week (w${w})`)
    if (fresh.some(n => n.k === 'news.scoutReport')) {
      reportAt = w
      if (mine.length) bad(`${label}: a letter in the same week as the report (w${w})`)
    }
    for (const n of mine) letters.push({ ...n, week: w })
    if (w % 3 === 0) g = roundTrip(g)
  }
  if (reportAt < 0) bad(`${label}: the report never landed`)
  const weeks = letters.map(l => l.week)
  console.log(`${label.padEnd(22)} letters at weeks ${weeks.join(', ')}; report at ${reportAt}`)
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] - weeks[i - 1] !== 4) bad(`${label}: letters ${weeks[i - 1]} and ${weeks[i]} are not a month apart`)
  }
  // one a month for the trip (the first in week 5, four weeks after the week
  // he left), short of the final fortnight the report covers
  const expect = Math.floor((reportAt - 4) / 4)
  if (letters.length !== expect) bad(`${label}: ${letters.length} letters, expected ${expect}`)
  return { g, letters }
}

function checkText(label: string, n: NewsItem) {
  for (const lang of LANGS) {
    const subj = tIn(lang, n.k + 'Subj', n.v)
    const body = tIn(lang, n.k!, n.v)
    for (const s of [subj, body]) {
      if (/\{\w+\}/.test(s) || s.includes('news.') || s.includes('pos.')) bad(`${label} [${lang}] unfilled: ${s}`)
      if (s.includes('—')) bad(`${label} [${lang}] em dash: ${s}`)
    }
  }
}

// 1. a nine-month brief for anyone: a name a month, each one new, each linked
{
  const { letters } = runBrief(withScout(777), '9 months, anyone', 'any', 9)
  if (letters.length < 8) bad(`nine months and only ${letters.length} letters`)
  const ids = letters.map(l => l.playerId).filter((x): x is number => x != null)
  if (ids.length !== letters.length) bad('a letter with nobody new on a wide-open brief')
  if (new Set(ids).size !== ids.length) bad('the same name sent twice')
  letters.forEach((l, i) => {
    if (Number(l.v?.found) !== i + 1) bad(`letter ${i + 1} counts ${l.v?.found} names so far`)
    if (i > 0 && !(l.playerIds ?? []).length) bad(`letter ${i + 1} carries none of the earlier names`)
  })
  checkText('9 months, anyone', letters[0])
  console.log('  en :', tIn('en', letters[1].k + 'Subj', letters[1].v), '|', tIn('en', letters[1].k!, letters[1].v).replace(/\n+/g, ' '))
  console.log('  ja :', tIn('ja', letters[1].k!, letters[1].v).replace(/\n+/g, ' '))
}

// 2. a three-month brief: two letters and then the report
runBrief(withScout(4242), '3 months, fly-half', 'FH', 3)

// 3. a brief with nobody left to name still writes every month
{
  const { letters } = runBrief(withScout(31337), '6 months, run dry', 'HK', 6, g => {
    g.commission!.sent = Object.values(g.players).map(p => p.id)
  })
  if (letters.some(l => l.k !== 'news.scoutMonthlyNone' || l.playerId != null)) bad('a dry brief still named somebody')
  if (letters[0]) checkText('6 months, run dry', letters[0])
}

// 4. idempotent in the week: a letter due now is filed once, however many
// times the week is looked at, and a save and a load in between change nothing
{
  let g = withScout(99)
  commissionScout(g, 'any', 6)
  for (let i = 0; i < 6; i++) processWeekAndAdvance(g)
  g.commission!.lastWord = addWeeks100(stamp100(g), -4)
  const count = () => g.news.filter(n => LETTERS.has(n.k ?? '')).length
  const n0 = count()
  scoutPostcard(g)
  if (count() !== n0 + 1) bad('a letter that was due did not arrive')
  scoutPostcard(g)
  g = roundTrip(g)
  scoutPostcard(g)
  if (count() !== n0 + 1) bad(`the same week filed ${count() - n0} letters`)
  if (g.commission?.lastWord !== stamp100(g)) bad('the stamp did not survive the load')
}

// 5. the save: a junk stamp is dropped, a good one kept
{
  const g = withScout(5)
  commissionScout(g, 'any', 3)
  const a = JSON.parse(JSON.stringify(g)) as GameState
  ;(a.commission as unknown as Record<string, unknown>).lastWord = 'soon'
  if (migrate(a).commission?.lastWord !== undefined) bad('a junk lastWord survived the load')
  const b = JSON.parse(JSON.stringify(g)) as GameState
  b.commission!.lastWord = 105
  if (migrate(b).commission?.lastWord !== 105) bad('a good lastWord was lost on load')
}

console.log(fails ? `${fails} failure(s)` : 'PASS scout letters: one a month on the road, in six languages')
process.exit(fails ? 1 : 0)
