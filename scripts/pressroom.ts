/**
 * ---- RECENT COVERAGE MEANS RECENT ----
 *
 * The owner's screenshot of the Press Room was taken in week 8 of 2025-26 and
 * carried answers from 30 August and 23 August under a heading that says RECENT
 * COVERAGE. "tidy the press room up - remove anything older than 2 weeks".
 *
 * Two properties, and the second is the one worth writing a probe for:
 *
 *   1. An answered question older than a fortnight is gone from the save. Not
 *      hidden by the screen - gone, because a long career's press list is one
 *      of the largest things in it and nothing reads the old entries.
 *   2. AN UNANSWERED QUESTION IS NEVER SWEPT. The weekly settle auto-answers a
 *      question the manager let pass, and that costs board confidence and
 *      support. If the sweep ran first and deleted it instead, ignoring the
 *      press room would be free again - which is the exact hole the auto-answer
 *      was written to close. A tidy-up that quietly refunds a penalty is a
 *      balance change wearing a cosmetic hat.
 *
 * Run: npx vite-node scripts/pressroom.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { PRESS_KEEP_WEEKS } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState, PressItem } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${what}`)
  if (!c) fails++
}

const age = (g: GameState, q: PressItem) => g.season * SEASON_WEEKS + g.week - (q.season * SEASON_WEEKS + q.week)

const stub = (g: GameState, weeksAgo: number, answered: boolean): PressItem => {
  const abs = g.season * SEASON_WEEKS + g.week - weeksAgo
  return {
    id: g.nextId++,
    season: Math.floor(abs / SEASON_WEEKS),
    week: abs % SEASON_WEEKS,
    outlet: 'The Rugby Chronicle',
    question: 'A question from the archive.',
    qk: 'press.oppNamed',
    options: [],
    answered,
    ...(answered ? { answerLabel: 'No comment', reaction: 'The room moved on.' } : {}),
  } as PressItem
}

ok(PRESS_KEEP_WEEKS === 2, `the room keeps two weeks (keeps ${PRESS_KEEP_WEEKS})`)

// ---- the sweep, on a room stacked with history ----
{
  const g = newGame('northampton', 'Press', 401)
  for (let i = 0; i < 12; i++) g.week = Math.min(g.week + 1, 40)
  g.week = 20
  const ages = [0, 1, 2, 3, 6, 20]
  for (const a of ages) g.press.push(stub(g, a, true))
  const before = g.press.length
  processWeekAndAdvance(g)
  // the settle advanced a week, so what survived is measured against the NEW now
  const left = g.press.filter(q => q.answered)
  const tooOld = left.filter(q => age(g, q) > PRESS_KEEP_WEEKS)
  ok(before > left.length, `the room was swept at the settle (${before} in, ${left.length} answered still there)`)
  ok(tooOld.length === 0,
     `nothing answered is older than ${PRESS_KEEP_WEEKS} weeks (${tooOld.map(q => `${age(g, q)}w`).join(', ') || 'none'})`)
}

// ---- and it does not refund the price of ignoring the desk ----
{
  const g = newGame('northampton', 'Press', 402)
  g.week = 20
  const stale = stub(g, 5, false)   // asked five weeks ago, never answered
  g.press.push(stale)
  const board0 = g.clubs[g.userClubId].boardConfidence
  processWeekAndAdvance(g)
  const still = g.press.find(q => q.id === stale.id)
  ok(!!still, 'an unanswered question five weeks old was NOT deleted by the sweep')
  ok(!!still?.answered, 'it was auto-answered instead - the moment passed, on the record')
  ok(g.clubs[g.userClubId].boardConfidence <= board0,
     `and silence still cost something (board ${board0} -> ${g.clubs[g.userClubId].boardConfidence})`)
}

// ---- a fresh answer stays put ----
{
  const g = newGame('northampton', 'Press', 403)
  g.week = 20
  const fresh = stub(g, 0, true)
  g.press.push(fresh)
  processWeekAndAdvance(g)
  ok(!!g.press.find(q => q.id === fresh.id), "this week's answer is still in the room next week")
}

console.log(fails === 0
  ? '\nPRESS ROOM PASSED: two weeks of coverage, and silence still costs'
  : `\nPRESS ROOM FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
