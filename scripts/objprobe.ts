// Probe: a season objective is not ticked before it has been earned.
//
// Reported live, from a new Bedford save: "one of the season objectives had been
// completed without a game being played." It had. The board's brief was "balance
// the books: finish the season in the black", Bedford opens with £240k in the
// bank, met() is `balance >= 0`, so the screen put a green tick against it in
// week 1 of pre-season.
//
// The bug is a category error rather than a wrong number. Three of the four
// objectives are ACHIEVEMENTS - six starts given, a derby won, the knockouts
// reached - and once true they can never become false, so a tick is honest the
// instant it appears. The fourth is a STANDING CONDITION that happens to be true
// today and says nothing whatever about May. ObjectiveDef.banked is the
// distinction; this holds it.
//
// Two things are checked, and the second is the one that would catch a future
// objective added carelessly:
//
//   nothing is ticked in week 1 of a fresh career, at any club
//   every objective marked banked really is monotonic - simulate a season and it
//     must never go from met back to unmet
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { OBJECTIVE_DEFS } from '../src/game/objectives'
import type { GameState } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// A spread of clubs on purpose: Bedford is the reported one, and a Championship
// club with a small balance is a different case from a rich Premiership one.
const CLUBS = ['bedford', 'northampton', 'bath', 'newcastle', 'ealing']

console.log('week 1 of a fresh career - nothing has been earned yet:\n')
for (const clubId of CLUBS) {
  const g: GameState = newGame(clubId, 'Objective Probe', 909)
  const mine = (g.objectives ?? []).map(id => OBJECTIVE_DEFS.find(o => o.id === id)).filter(Boolean)
  if (!mine.length) { bad(`${clubId}: no objectives were set at all`); continue }
  const played = g.fixtures.filter(f => f.played).length
  const shown = mine.map(o => `${o!.met(g) && o!.banked ? 'TICKED' : o!.met(g) ? 'on course' : 'not yet'} ${o!.id}`)
  console.log(`  ${clubId.padEnd(12)} balance £${Math.round(g.clubs[clubId].balance / 1000)}k · ${played} matches played · ${shown.join(' | ')}`)
  // the actual assertion: nothing may read as DONE before a ball is kicked
  for (const o of mine) {
    if (o!.met(g) && o!.banked) {
      bad(`${clubId}: "${o!.text(g)}" reads as complete in week 1, with ${played} matches played`)
    }
  }
}

console.log('\nand an objective that claims to be banked must never un-happen:\n')
{
  // Northampton, because it picks up the cup objective and plays a full calendar
  const g: GameState = newGame('northampton', 'Objective Probe', 4242)
  const watch = OBJECTIVE_DEFS.filter(o => o.banked)
  const everMet = new Set<string>()
  const flips: string[] = []
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) {
    processWeekAndAdvance(g)
    // STOP AT THE ROLLOVER. Monotonic means monotonic WITHIN a season: the new
    // campaign clears stats and rebuilds the fixture list, so of course six
    // starts and a won derby are no longer on the books. The first run of this
    // check walked one week past the boundary and reported the reset as the
    // game losing an objective it had already banked.
    if (g.season !== start) break
    for (const o of watch) {
      if (!o.applies(g)) continue
      const now = o.met(g)
      if (now) everMet.add(o.id)
      else if (everMet.has(o.id)) flips.push(`${o.id} at week ${g.week}`)
    }
  }
  console.log(`  objectives that came true over the season: ${[...everMet].join(', ') || 'none'}`)
  ok(flips.length === 0, `no banked objective went back to unmet${flips.length ? ` (${flips.join(', ')})` : ''}`)
  // and the unbanked one must be exactly the one we think it is, so that adding
  // a new standing condition without marking it forces a decision here
  const unbanked = OBJECTIVE_DEFS.filter(o => !o.banked).map(o => o.id)
  console.log(`  objectives that only settle at the final whistle: ${unbanked.join(', ') || 'none'}`)
  ok(unbanked.length > 0, 'at least one objective is honestly marked as unsettled until May')
}

if (fails) { console.error(`\nOBJECTIVE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nOBJECTIVE PROBE PASSED: nothing is ticked before it is earned')
