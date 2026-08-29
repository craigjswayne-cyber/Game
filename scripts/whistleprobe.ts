// Probe: nothing happens after the whistle.
//
// Owner, v1.1.12: "ive noticed a few times a penalty kick comes after the
// half-time whistle has blown... this should never happen should be
// everything within the time."
//
// He had read it exactly right, and it was two faults wearing one coat.
//
//   1. A tick is four minutes and draws its minute as tick*4 + rng(0..3) + 1,
//      so the last tick of a half can land ON the whistle - and the lines that
//      FOLLOW a score (the conversion, the celebration, a maul held up) are
//      deliberately stamped min+1 so they read a beat later than the try. On
//      the last tick that beat is past the whistle: 41' in a half that ends at
//      40, 81' in a match that ends at 80. Measured before the fix: 52 lines
//      in 360 matches, and the clock running backwards 53 times.
//
//   2. Worse, and exactly what he described: a kickable penalty stops the
//      clock for a touchline call, and the ANSWER - a tap, a standing
//      instruction, or the 'posts' default a skip or an instant result takes -
//      arrives after stepTick has already pushed the whistle. One real
//      sequence read: "PENALTY to Northampton - kickable range" ... "Full-time:
//      Auckland 27 - 37 Northampton" ... "Ice in the veins: Fin Smith silences
//      the whistlers."
//
// Three claims, over enough rugby that a rare tick has to show up.
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, resolveDecision, stepTick } from '../src/game/matchEngine'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

let matches = 0, past40 = 0, past80 = 0, backwards = 0, afterWhistle = 0
let sample = ''
for (let seed = 1; seed <= 40; seed++) {
  const g = newGame('northampton', 'Whistle', seed)
  for (let w = 0; w < 12; w++) {
    const fx = userFixtureThisWeek(g)
    if (fx) {
      const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
      playHalf(g, ctx)
      playHalf(g, ctx)
      matches++
      const ht = ctx.events.findIndex(e => e.type === 'HT')
      ctx.events.forEach((e, i) => {
        if (ht >= 0 && i < ht && e.min > 40) past40++
        if (e.min > 80) past80++
      })
      for (let i = 1; i < ctx.events.length; i++) {
        const a = ctx.events[i - 1], b = ctx.events[i]
        if (b.min < a.min) {
          backwards++
          if (!sample) sample = `${a.min}' ${a.type} then ${b.min}' ${b.type}`
        }
        // the fault as the owner met it: play narrated after a whistle line
        if ((a.type === 'HT' || a.type === 'FT') && b.type !== 'HT' && b.type !== 'FT' && b.type !== 'SUB') {
          afterWhistle++
          if (!sample) sample = `${a.type} then ${b.min}' ${b.type} "${b.text.slice(0, 50)}"`
        }
      }
    }
    processWeekAndAdvance(g)
  }
}
console.log(`--- ${matches} matches played out in full\n`)
ok(past40 === 0, `no first-half line is stamped past the 40th minute (${past40})`)
ok(past80 === 0, `and none anywhere is stamped past the 80th (${past80})`)
ok(backwards === 0, `the clock never runs backwards${sample ? ` (${sample})` : ''} (${backwards})`)
ok(afterWhistle === 0, `and no phase of play is narrated after a whistle (${afterWhistle})`)

console.log('\n--- the exact sequence he reported, built on purpose\n')
{
  // walk to the last tick of the first half, force a kickable penalty to be
  // outstanding when the whistle goes, then answer it the way a manager who
  // was looking at the screen would
  const g = newGame('northampton', 'Whistle', 61)
  let built = false
  for (let w = 0; w < 12 && !built; w++) {
    const fx = userFixtureThisWeek(g)
    if (fx) {
      const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
      while (ctx.tick < 9) { if (ctx.decision) resolveDecision(g, ctx, 'posts'); stepTick(g, ctx) }
      // the referee's arm goes up in the 40th minute
      ctx.decision = { kind: 'penalty', min: 40 }
      const r = stepTick(g, ctx) // this call blows for half time
      ok(r === 'HT', 'the clock reaches half time with the call unanswered')
      const kick = resolveDecision(g, ctx, 'posts')
      ok(kick.length > 0, 'and the manager still gets to make it - the choice is not taken away')
      const htAt = ctx.events.findIndex(e => e.type === 'HT')
      const after = ctx.events.slice(htAt + 1).filter(e => e.type === 'PEN' || e.type === 'TRY')
      ok(after.length === 0, `the kick is narrated BEFORE half time, not after it (${after.length} behind the whistle)`)
      ok(ctx.events.every(e => e.type === 'HT' || e.min <= 40), 'and every line of the half is inside the forty minutes')
      built = true
    }
    if (!built) processWeekAndAdvance(g)
  }
  ok(built, 'the sequence was reachable at all')
}

console.log(fails ? `\nWHISTLE PROBE FAILED (${fails})` : '\nWHISTLE PROBE PASSED: everything within the time')
process.exit(fails ? 1 : 0)
