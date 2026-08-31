/**
 * ---- A SPECIALITY IS SOMETHING YOU ARE KNOWN FOR ----
 *
 * Owner, v1.1.17: "you shouldnt earn coaching specialities before 10 games -
 * with them being harder to get."
 *
 * Several of these read the WORLD rather than the manager's record - `manman`
 * takes the squad's average morale, `youth` counts academy men with an
 * appearance - and the world is already there when he arrives. Measured before
 * changing anything: no club in the game starts above the OLD thresholds
 * either, so this was not a live exploit. What was missing is a floor that
 * holds on purpose rather than by luck, and goes on holding when the world
 * drifts, a club is added, or a tenth speciality is written.
 *
 * Two claims, which are the two halves of what he asked for: nothing is earned
 * before ten games, and the cheap ones cost more than they did.
 *
 * Run: npx vite-node scripts/specprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SPECIALITIES, SPEC_MIN_GAMES } from '../src/ui/screens/Profile'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** what the screen shows: the gate, then the speciality's own test */
const shown = (g: GameState) =>
  SPECIALITIES.filter(s => g.mgr.m >= SPEC_MIN_GAMES && s.earned(g)).map(s => s.id)

console.log('\n--- 1. nothing is earned before ten games\n')
{
  ok(SPECIALITIES.length >= 8, `there are specialities to earn (${SPECIALITIES.length})`)
  ok(SPEC_MIN_GAMES === 10, `and the floor is the ten games the owner asked for (${SPEC_MIN_GAMES})`)

  // A BRAND NEW CAREER, before anything has happened at all. This is the case
  // that shipped wrong: the squad is somebody else's and its morale is high.
  const g = newGame('northampton', 'Spec', 41)
  ok(g.mgr.m === 0, 'a new career has played nothing')
  const raw = SPECIALITIES.filter(s => s.earned(g)).map(s => s.id)
  ok(shown(g).length === 0,
    `and shows no specialities at all (${shown(g).join(', ') || 'none'})`)
  // printed rather than asserted, and honestly: with the thresholds raised the
  // ungated set is empty here too, so this line is not evidence the gate is
  // load-bearing on THIS seed. The gate is there for the seeds and the future
  // clubs where it would be.
  console.log(`      (ungated, week one would show: ${raw.join(', ') || 'none'})`)

  // and it holds all the way to the ninth game, however well it goes
  let guard = 0
  while (g.mgr.m < SPEC_MIN_GAMES - 1 && guard++ < 60) processWeekAndAdvance(g)
  ok(g.mgr.m < SPEC_MIN_GAMES, `nine games in, still short of the floor (${g.mgr.m} played)`)
  ok(shown(g).length === 0, `and still nothing is claimed (${shown(g).join(', ') || 'none'})`)
}

console.log('\n--- 2. and they cost more than they did\n')
{
  // The old thresholds, kept here as the thing that must no longer be enough.
  // A speciality that a fortnight of ordinary management buys is a participation
  // medal, and the owner asked for the opposite.
  const g = newGame('northampton', 'Spec', 42)
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean)
  const morale = squad.reduce((s, p) => s + p!.morale, 0) / Math.max(1, squad.length)
  const manman = SPECIALITIES.find(s => s.id === 'manman')!
  ok(!manman.earned(g),
    `a squad you have not managed yet does not earn man-management (average morale ${morale.toFixed(2)})`)

  // the record-based ones are checked against a record, not against the world
  const rec = newGame('northampton', 'Spec', 43)
  rec.mgr.m = 25
  rec.mgr.w = 20                      // 80% of 25 - a fine record, and not enough
  const tactician = SPECIALITIES.find(s => s.id === 'tactician')!
  ok(!tactician.earned(rec),
    'twenty-five games at 80% is no longer a tactician - the bar is thirty games')
  rec.mgr.m = 30
  rec.mgr.w = 19                      // 63% of 30
  ok(tactician.earned(rec), 'thirty games at 63% is')

  const dealer = SPECIALITIES.find(s => s.id === 'dealer')!
  rec.mgr.signings = 8
  ok(!dealer.earned(rec), 'eight signings is no longer a dealer')
  rec.mgr.signings = 12
  ok(dealer.earned(rec), 'twelve is')
}

console.log(fails === 0
  ? '\nSPEC PROBE PASSED: nothing is worn on a badge before it is earned'
  : `\nSPEC PROBE FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
