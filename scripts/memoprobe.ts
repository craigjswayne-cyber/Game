// Probe: the board memo tells the truth, and says it once.
//
// User, with a screenshot: "mixed messages in this board review. needs to be
// clearer to read." Three of the four things wrong with it were not wording:
//
//   IT INVENTED THE LEAGUE POSITION. boardmemo carried its own leaguePos that did
//   findIndex on an UNSORTED table, so it printed the club's slot in storage. A
//   save top of the Premiership on 19 points from four straight wins was told it
//   was 8th - which is what made the memo read as self-contradictory. schedule.ts
//   had a correct leaguePos the whole time.
//
//   IT PRINTED A RAW FLOAT. squadTrust returns the stored figure, so the prose
//   read "the dressing room is not yet convinced (33.328/100)".
//
//   THE VERDICT REPEATED VERBATIM. pick() rotates by memo index so consecutive
//   memos step to the next line, but the caller salted it with board confidence,
//   which changes every memo - so the offset moved at the same time as the index
//   and the two cancelled. Three in a row read "Verdict: broadly happy".
//
// All three are things a reader notices and no test was watching, so they are
// pinned here: the position against a sorted table, every number an integer, and
// no two consecutive verdicts the same.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { sortTable } from '../src/game/schedule'
import type { GameState, NewsItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const memosOf = (g: GameState): NewsItem[] =>
  g.news.filter(n => n.subject.includes('Board review'))

/** The position the memo claims, or null if it did not print one. */
const claimed = (n: NewsItem): number | null => {
  const m = /^League: (\d+)(?:st|nd|rd|th) in the /m.exec(n.body)
  return m ? Number(m[1]) : null
}

// ---- the position matches the standings, checked week by week --------------
//
// Checked at the moment the memo is written rather than at the end of the run: the
// table keeps moving, so a position read forty weeks later proves nothing.
{
  let checked = 0
  let worst: string | null = null
  for (const seed of [3, 7, 11, 19]) {
    const g = newGame('northampton', 'Memo', seed)
    let seen = 0
    for (let w = 0; w < 40; w++) {
      processWeekAndAdvance(g)
      const memos = memosOf(g)
      if (memos.length === seen) continue
      seen = memos.length
      const memo = memos[memos.length - 1]
      const want = sortTable(g.comps[g.clubs['northampton'].leagueId].table)
        .findIndex(r => r.teamId === 'northampton') + 1
      const got = claimed(memo)
      if (got != null) {
        checked++
        if (got !== want && !worst) worst = `seed ${seed}: memo said ${got}, table says ${want}`
      }
    }
  }
  console.log(`  ${checked} memo positions checked across 4 saves`)
  ok(checked >= 12, `enough memos to be worth checking (${checked})`)
  ok(!worst, `every memo's league position matches the sorted table${worst ? ` - ${worst}` : ''}`)
}

// ---- every number in the prose is a whole number ---------------------------
{
  const g = newGame('northampton', 'Memo', 5)
  for (let w = 0; w < 40; w++) processWeekAndAdvance(g)
  const memos = memosOf(g)
  // a decimal anywhere in a memo body: /100 ratings, money is formatted elsewhere
  const floats = memos.flatMap(m => (m.body.match(/\d+\.\d+\/100/g) ?? []))
  ok(memos.length > 0, `the board wrote something to read (${memos.length} memos)`)
  ok(floats.length === 0, `no raw floats in the ratings${floats.length ? ` (${floats[0]})` : ''}`)
}

// ---- consecutive verdicts differ ------------------------------------------
//
// Within a save, not across seeds: the complaint was reading the same sentence in
// consecutive letters. Two saves are allowed to agree.
{
  let repeats: string | null = null
  let counted = 0
  for (const seed of [3, 7, 11, 19, 23]) {
    const g = newGame('northampton', 'Memo', seed)
    for (let w = 0; w < 60; w++) processWeekAndAdvance(g)
    const lines = memosOf(g).map(m => m.body.split('\n').filter(Boolean).slice(-1)[0])
    counted += lines.length
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === lines[i - 1] && !repeats) {
        repeats = `seed ${seed}, memo ${i + 1}: "${lines[i].slice(0, 46)}" twice running`
      }
    }
  }
  console.log(`  ${counted} verdicts read across 5 saves`)
  ok(counted >= 20, `enough verdicts to judge (${counted})`)
  ok(!repeats, `no verdict follows itself${repeats ? ` - ${repeats}` : ''}`)
}

// ---- one subject per line, each with its own label -------------------------
//
// The shape the rewrite is for: Form, League, Dressing room, Terraces, Finances,
// Verdict. If a heading goes missing the memo has quietly gone back to running two
// measures into one sentence.
{
  const g = newGame('northampton', 'Memo', 13)
  for (let w = 0; w < 40; w++) processWeekAndAdvance(g)
  const memo = memosOf(g)[1] ?? memosOf(g)[0]
  ok(!!memo, 'there is a memo to read')
  if (memo) {
    for (const label of ['Form:', 'Dressing room:', 'Terraces:', 'Finances:', 'Verdict:']) {
      ok(memo.body.includes(label), `the memo has a ${label.replace(':', '')} line`)
    }
    // the window is named once at the top so no line has to imply a timeframe
    ok(/covering the last \d+ weeks\./.test(memo.body), 'and it says up front what window it covers')
    // the old ambiguity: "points to the good" next to a league points column
    ok(!/points to the good|down on aggregate/.test(memo.body),
      'the scoring difference is not called "points" any more')
  }
}

console.log(fails ? `\nMEMO PROBE FAILED (${fails})` : '\nMEMO PROBE PASSED: the board reports the real table, in whole numbers, without repeating itself')
process.exit(fails ? 1 : 0)
