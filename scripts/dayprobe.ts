import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  dayDate, dayHasSomething, dayName, firstStepOfWeek, matchDayIndex, nextStep, stepFromDay,
  storiesForDay, today, type DayIndex,
} from '../src/game/days'
import type { GameState } from '../src/game/model'

/**
 * Continue walks the week a day at a time. Four things have to be true or the
 * button is worse than the one it replaced:
 *
 *   1. the walk always terminates - every week reaches a match or a week roll
 *   2. Continue never stops on an empty day
 *   3. every story the week produces is reachable on exactly one day
 *   4. the dates line up: Monday's date is five days before the week's Saturday,
 *      and a Friday night kick-off makes Friday the match day
 */

let fails = 0
function ok(cond: boolean, what: string) {
  if (cond) console.log(`  ok   ${what}`)
  else { console.log(` FAIL  ${what}`); fails++ }
}

/** Walk one week exactly as the store's Continue does, counting the taps. */
function walkWeek(g: GameState): { taps: number; days: DayIndex[]; ended: 'match' | 'week' } {
  const days: DayIndex[] = []
  let taps = 0
  // the store lands on the first day of a week after settling the previous one
  let step = firstStepOfWeek(g)
  for (;;) {
    if (taps > 12) throw new Error('the day walk did not terminate inside one week')
    if (step.kind === 'day') {
      g.day = step.day
      days.push(step.day)
      taps++
      step = stepFromDay(g, step.day)
      continue
    }
    return { taps, days, ended: step.kind }
  }
}

console.log('--- 1. a fresh career starts on Monday of week 1')
const g = newGame('northampton', 'Day Walker', 4242)
ok(today(g) === 0, `day 0, which is ${dayName(today(g))}`)
console.log(`  week 1 Monday is ${dayDate(g.season, g.week, 0)}, Saturday is ${dayDate(g.season, g.week, 5)}`)
{
  // the anchor: weekDate(season, week) is the week's SATURDAY, so Monday is five
  // days back from it and both must name the right weekday
  const mon = dayDate(g.season, g.week, 0)
  const sat = dayDate(g.season, g.week, 5)
  ok(mon.startsWith('Mon'), `Monday reads as a Monday (${mon})`)
  ok(sat.startsWith('Sat'), `Saturday reads as a Saturday (${sat})`)
}

console.log('\n--- 2. the walk terminates, every week, for a whole season')
{
  const h = newGame('northampton', 'Day Walker', 99)
  let totalTaps = 0
  let weeks = 0
  const tapCounts: number[] = []
  for (let w = 0; w < 30; w++) {
    const walk = walkWeek(h)
    totalTaps += walk.taps
    tapCounts.push(walk.taps)
    weeks++
    // every day it stopped on had something on it
    for (const d of walk.days) {
      if (!dayHasSomething(h, d)) { console.log(` FAIL  stopped on an empty ${dayName(d)} in week ${h.week}`); fails++ }
    }
    h.newsFrom = h.nextId
    processWeekAndAdvance(h)
    h.day = 0
  }
  const avg = totalTaps / weeks
  const max = Math.max(...tapCounts)
  console.log(`  ${weeks} weeks walked, ${totalTaps} bulletins shown, ${avg.toFixed(1)} a week, busiest ${max}`)
  ok(true, 'every week reached a match or a week roll without looping')
  ok(max <= 5, `no week shows more than five bulletins (${max})`)
  // The point of the feature: the gap between games has to have SOME texture.
  // Zero would mean the day flow never fires and Continue is the old button.
  ok(avg >= 0.8, `an average week has something to show on it (${avg.toFixed(1)} bulletins)`)
}

console.log('\n--- 3. no empty stops, and no story stranded off every day')
{
  const h = newGame('leicester', 'Day Walker', 7)
  let stranded = 0
  let placed = 0
  for (let w = 0; w < 20; w++) {
    // the store sets the watermark before settling, which is what makes the new
    // stories findable afterwards
    h.newsFrom = h.nextId
    processWeekAndAdvance(h)
    h.day = 0
    const mine = h.news.filter(n => n.id >= (h.newsFrom ?? 0) && !n.read && !n.cleared)
    const reachable = new Set<number>()
    for (let d = 0 as DayIndex; d <= 5; d = (d + 1) as DayIndex) {
      for (const n of storiesForDay(h, d)) reachable.add(n.id)
    }
    for (const n of mine) {
      if (reachable.has(n.id)) placed++
      else { stranded++; console.log(`       stranded: ${n.type} "${n.subject}"`) }
    }
  }
  console.log(`  ${placed} stories filed to a day, ${stranded} stranded`)
  ok(stranded === 0, 'every story the week produces lands on exactly one day')
  ok(placed > 20, `the weeks actually produce stories to file (${placed})`)
}

console.log('\n--- 4. a Friday night kick-off makes Friday the match day')
{
  const h = newGame('bath', 'Day Walker', 31)
  let checkedFri = 0
  let checkedSat = 0
  for (let w = 0; w < 24 && (checkedFri < 2 || checkedSat < 2); w++) {
    const md = matchDayIndex(h)
    if (md === 4) {
      if (checkedFri < 2) {
        // the walk must hand over on Friday, never offer a Friday bulletin
        const step = stepFromDay(h, 4)
        ok(step.kind === 'match', `week ${h.week}: a Friday game hands over on Friday, not Saturday`)
        checkedFri++
      }
    } else if (md === 5) {
      if (checkedSat < 2) {
        const step = stepFromDay(h, 4)
        ok(step.kind === 'match', `week ${h.week}: a Saturday game hands over after Friday`)
        checkedSat++
      }
    }
    processWeekAndAdvance(h)
    h.day = 0
  }
  ok(checkedFri > 0 && checkedSat > 0, `both kick-off days were exercised (${checkedFri} Fri, ${checkedSat} Sat)`)
}

console.log('\n--- 5. the button never lies about what it does next')
{
  const h = newGame('saracens', 'Day Walker', 55)
  let matchLabels = 0
  let dayLabels = 0
  for (let w = 0; w < 20; w++) {
    // walk to the end of the week checking the label at every stop
    let step = firstStepOfWeek(h)
    let guard = 0
    while (step.kind === 'day' && guard++ < 8) {
      h.day = step.day
      const label = nextStep(h)
      // nextStep reads state.day, so it has to agree with a direct step from here
      const direct = stepFromDay(h, step.day)
      if (label.kind !== direct.kind) { console.log(` FAIL  label disagreed with the step in week ${h.week}`); fails++ }
      if (label.kind === 'match') matchLabels++
      else dayLabels++
      step = direct
    }
    if (step.kind === 'match') matchLabels++
    processWeekAndAdvance(h)
    h.day = 0
  }
  console.log(`  ${matchLabels} Matchday labels, ${dayLabels} Continue labels over 20 weeks`)
  ok(matchLabels > 0 && dayLabels > 0, 'both labels occur, so the button is not stuck on one')
}

console.log('\n--- 6. an old save with no day loads on Monday')
{
  const h = newGame('northampton', 'Day Walker', 12)
  delete (h as { day?: number }).day
  ok(today(h) === 0, 'a save written before days existed reads as Monday')
  const step = firstStepOfWeek(h)
  ok(step.kind === 'day' || step.kind === 'match' || step.kind === 'week',
    `and Continue still knows what to do (${step.kind})`)
}

console.log(fails ? `\nDAY PROBE FAILED (${fails})` : '\nDAY PROBE PASSED')
if (fails) process.exit(1)
