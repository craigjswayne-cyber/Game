/**
 * ---- THE PRESS IS ANSWERED, NOT WALKED PAST ----
 *
 * Owner, v1.1.17: "press questions MUST be answered when they arrive - you
 * shouldn't be able to continue through the game."
 *
 * The hold used to be soft in two ways. It only applied on the way OUT of the
 * week, so a question introduced on the Tuesday could be strolled past on the
 * Wednesday; and it yielded on the second tap, so two presses of Continue got
 * you through it with the question left to expire on its own.
 *
 * It is hard now, on every step. THAT IS THE DANGEROUS VERSION AND THIS PROBE
 * EXISTS BECAUSE OF IT: a hard hold shipped once before and scripts/soakui.mjs
 * found the consequence inside one season - 60 taps without the week moving,
 * stuck on the Press Room. A gate that cannot be cleared is not a gate, it is a
 * bricked save, and this is the difference between the two:
 *
 *   1. every question that can HOLD the week can also be ANSWERED - it has
 *      options, and the Press Room shows every unanswered question rather than
 *      only this week's, so nothing can hold from off-screen;
 *   2. answering clears the hold;
 *   3. the room empties in a bounded number of answers, so a season opening
 *      that stacks two or three questions cannot become a wall.
 *
 * Run: npx vite-node scripts/pressgate.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { pressBlock, deskBlock } from '../src/game/days'
import { answerPress, generatePress } from '../src/game/media'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Put a real question in the room, however many rolls it takes. */
function askSomething(g: GameState): boolean {
  for (let seed = 1; seed <= 400; seed++) {
    generatePress(g, mulberry32(seed))
    if (g.press.some(p => !p.answered && (p.options?.length ?? 0) > 0)) return true
  }
  return false
}

console.log('\n--- 1. an open question holds the week, on any day\n')
{
  const g = newGame('leicester', 'Press Gate', 31)
  ok(pressBlock(g) == null, 'a quiet room holds nothing')
  ok(askSomething(g), 'the press ask something answerable')
  const open = g.press.filter(p => !p.answered && (p.options?.length ?? 0) > 0)
  ok(open.length > 0, `${open.length} question(s) open`)

  const held = pressBlock(g)
  ok(held != null, 'and the week is held')
  ok(held?.kind === 'press', `by the press, named as such (${held?.label ?? 'no label'})`)

  // THE DAY DOES NOT MATTER. This is the half that was missing: the old hold
  // only looked on the way out of the week, so Wednesday walked free.
  const days = []
  for (let d = 0; d < 7; d++) { g.day = d; days.push(pressBlock(g) != null) }
  ok(days.every(Boolean), `and on every day of the week, not just the way out (${days.filter(Boolean).length}/7)`)

  // and a question asked LAST week still holds, which it never used to
  g.press.forEach(p => { if (!p.answered) p.week = Math.max(0, g.week - 2) })
  ok(pressBlock(g) != null, 'a question left over from a fortnight ago holds too')
}

console.log('\n--- 2. and it can always be cleared\n')
{
  const g = newGame('leicester', 'Press Gate', 32)
  ok(askSomething(g), 'a question is put')

  // EVERY QUESTION THAT HOLDS CAN BE ANSWERED. A question with no options is
  // unanswerable, so it must never hold - that is the locked save.
  const holders = g.press.filter(p => !p.answered && (p.options?.length ?? 0) > 0)
  ok(holders.every(p => p.options.length > 0),
    `every question that holds the week has answers on it (${holders.length})`)

  // and it terminates: answer them and the hold lifts, in a bounded walk
  let turns = 0
  while (pressBlock(g) && turns++ < 20) {
    const q = g.press.find(p => !p.answered && (p.options?.length ?? 0) > 0)!
    answerPress(g, q.id, 0)
  }
  ok(pressBlock(g) == null, `answering clears the hold (${turns} answer(s))`)
  ok(turns < 20, 'in a bounded number of them - the room is not a wall')
  ok(deskBlock(g)?.kind !== 'press', 'and the desk agrees the press are done')
}

console.log('\n--- 3. a season of it, answered every time, and the clock still runs\n')
{
  // THE SOAK'S OWN FAILURE, IN MINIATURE. If a hard hold can strand the week
  // anywhere in a season, this is where it shows.
  const g = newGame('northampton', 'Press Gate', 33)
  let answered = 0
  let stuck = 0
  const startWeek = g.season * 100 + g.week
  for (let i = 0; i < 200; i++) {
    const q = g.press.find(p => !p.answered && (p.options?.length ?? 0) > 0)
    if (q) { answerPress(g, q.id, 0); answered++; continue }
    const before = g.season * 100 + g.week
    processWeekAndAdvance(g)
    if (g.season * 100 + g.week === before) stuck++
  }
  ok(stuck === 0, `the week never failed to move once the room was clear (${stuck} stalls)`)
  ok(answered > 0, `and the room was doing its job throughout (${answered} questions answered)`)
  ok(g.season * 100 + g.week > startWeek, 'the career actually advanced')
  ok(pressBlock(g) == null || g.press.some(p => !p.answered),
    'and the room is either clear or holding something answerable')
}

console.log(fails === 0
  ? '\nPRESS GATE PASSED: the week waits for an answer, and an answer always exists'
  : `\nPRESS GATE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
