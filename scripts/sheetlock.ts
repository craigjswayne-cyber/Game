// Probe: the saved team sheet survives the match that was played from it.
//
// User, with a screenshot of a winger standing in the flanker slot: "if you
// make subs in matches when it loads back to the first team page - the
// original starting team should be selected not changed to subs."
//
// The mechanism: lineupFor hands back club.tactic.lineup BY REFERENCE for the
// user's club, mkSide adopted that array as the live match sheet, and every
// substitution, injury cover and finisher writes side.lineup in place. So the
// afternoon's changes were being written into the saved sheet, and the Team
// screen greeted the manager with his finishing XV. AI clubs never showed it:
// their sheets come fresh from autoSelect every kick-off.
//
// The probe makes real substitutions in a live match and then asserts the
// SAVED sheet still reads exactly as the manager wrote it - while the LIVE
// sheet visibly changed, so a pass can never be vacuous.
import { newGame } from '../src/game/newgame'
import { beginMatch, makeSubstitution, stepTick } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('northampton', 'Sheet', 11)
const club = g.clubs[g.userClubId]
// the manager picked this sheet himself - the strongest possible claim to it
club.tactic.userPicked = true
const saved = club.tactic.lineup.slice()

const fx = g.fixtures.find(f =>
  !f.played && (f.homeId === club.id || f.awayId === club.id) &&
  g.clubs[f.homeId] && g.clubs[f.awayId])!
const ctx = beginMatch(g, fx, weekRng(g), false, club.id)
const mine = ctx.home.teamId === club.id ? ctx.home : ctx.away

// run to the hour, then send three men on
let guard = 0
while (ctx.tick < 15 && guard++ < 300) { ctx.awaiting = null; stepTick(g, ctx) }
let made = 0
for (let slot = 0; slot < 15 && made < 3; slot++) {
  const outId = mine.lineup[slot]
  if (outId == null || !mine.onPitch.has(outId)) continue
  const inId = mine.lineup.slice(15).find(id =>
    id != null && !mine.onPitch.has(id) && !mine.ratings.has(id))
  if (inId == null) break
  if (/will come on for/.test(makeSubstitution(g, ctx, outId, inId))) made++
}
ok(made >= 2, `made ${made} tactical substitutions (needs at least 2 to mean anything)`)

guard = 0
while (ctx.seg !== 3 && guard++ < 400) { ctx.awaiting = null; stepTick(g, ctx) }
ok(ctx.seg === 3, 'the match ran to full time')

// the live sheet shows the afternoon...
ok(mine.lineup.some((id, i) => id !== saved[i]), 'the live match sheet really did change')

// ...and the saved one does not
const diffs = club.tactic.lineup
  .map((id, i) => (id !== saved[i] ? i : -1))
  .filter(i => i >= 0)
ok(diffs.length === 0,
  `the saved team sheet is untouched by the afternoon${diffs.length ? ` - ${diffs.length} slots rewritten (first at slot ${diffs[0]})` : ''}`)

console.log(fails ? `\nSHEETLOCK FAILED (${fails})` : '\nSHEETLOCK PASSED')
process.exit(fails ? 1 : 0)
