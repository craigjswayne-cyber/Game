// Goal kicking: the chance of a kick, its tally and the shot at goal. Split
// out of matchEngine.ts.
import type { GameState, Player } from '../model'
import { tIn } from '../i18n'
import { clamp } from '../rng'
import { clutchKick } from '../habits'
import { teamShort } from './selection'
import { describeRestart } from './commentary'
import { incRng } from './day'
import { goalKicker } from './field'
import { type SideCtx, evPts } from './side'
import { PEN_LINES, PEN_LONG, PEN_WET } from './lines'
import { type LiveCtx, pushLine } from './live'

/**
 * No kick at goal is a certainty: base skill, then form (a kicker in a purple
 * patch is a different animal), confidence (morale) and the day's conditions
 * all move the needle. Floor drops to 38% on a bad day.
 *
 * ---- THE CEILING USED TO EAT THE ATTRIBUTE (design review, v1.6.7) ----
 *
 * The curve was `base + goa/34` for a penalty against a hard clamp at 93%, and
 * the world's kickers run from 2 to 18. So everyone from 16 upwards kicked at
 * exactly 93%, the attribute stopped separating men precisely where a manager
 * cares most about it, and the measured world converted 83% of its tries -
 * well above the professional game, which lives nearer three in four.
 *
 * The slope is now less than half what it was, so the top of the range has
 * somewhere to go: a goa of 12 kicks a penalty at 75%, 14 at 79%, 16 at 83%
 * and 18 at 86%, where all four used to be 93% alike. The 90% ceiling is
 * reached only by a great kicker in form, backed by a kicking coach and
 * kicking off a level-five enclosure - the investment still buys the last few
 * points, it is simply no longer free with the attribute alone.
 *
 * Measured after: 72% of the world's tries converted, against 83% before and
 * about 73% in the professional club game.
 */
export function kickChance(_state: GameState, kicker: Player | null, base: number, div: number, goalPenalty: number, side: SideCtx): number {
  if (!kicker) return 0.5 - goalPenalty + side.goalBonus
  const skill = base + kicker.a.goa / div
  const formF = (kicker.form - 6) * 0.012      // ±5% across the form range
  const confF = (kicker.morale - 6.5) * 0.008  // nerves show from the tee
  const traitB = kicker.trait === 'Siege Gun' ? 0.03 : 0
  const floor = kicker.trait === 'Metronome' ? 0.45 : 0.38
  return clamp(skill + formF + confF - goalPenalty + side.goalBonus + traitB, floor, 0.90)
}

/** Count a kick at goal on the side, and log it against the commentary. */
export function noteKick(ctx: LiveCtx, side: SideCtx, made: boolean) {
  side.kicksAt = (side.kicksAt ?? 0) + 1
  if (made) side.kicksMade = (side.kicksMade ?? 0) + 1
  if (ctx.detail) (ctx.kickLog ??= []).push([ctx.events.length, side === ctx.home ? 0 : 1, made ? 1 : 0])
}

/** how often the shot clock beats a kicker (1.8.16) */
const SHOT_CLOCK_P = 0.006
/** Take the three points: roll the kick at goal. */
export function takePenaltyShot(state: GameState, ctx: LiveCtx, side: SideCtx, min: number) {
  const { rng, detail } = ctx
  const kicker = goalKicker(state, side)
  const other = side === ctx.home ? ctx.away : ctx.home
  // THE SHOT CLOCK (1.8.16, item 30): sixty seconds from the mark, and the
  // kick is lost when it runs out - a scrum to the other side where the
  // penalty was. Rare, on its own dice; the kick's draw is still taken.
  if (incRng(ctx, min, side, 0x5C10C)() < SHOT_CLOCK_P) {
    rng()
    pushLine(state, ctx, min, 'SUB', side, `comm.shotClock${1 + (min % 2)}`,
      { player: kicker?.name ?? teamShort(state, side.teamId), team: teamShort(state, side.teamId), opp: teamShort(state, other.teamId) }, kicker?.id)
    return
  }
  // the kicker's nerve with the match on the line (habits.ts): a threshold, never a draw
  const pPen = clamp(kickChance(state, kicker, 0.53, 54, ctx.goalPenalty ?? 0, side) + clutchKick(state.seed, kicker, min, side.score - other.score), 0.3, 0.92)
  const penOver = rng() < pPen
  noteKick(ctx, side, penOver)
  if (penOver) {
    side.score += 3
    side.pens += 1
    evPts(ctx, side, 3, 'pen')
    if (kicker) {
      kicker.stats.pens += 1; kicker.stats.points += 3
      side.ratings.set(kicker.id, (side.ratings.get(kicker.id) ?? 6) + 0.15)
    }
    // The banks hold keys now, and the draw is unchanged: one call to rng(),
    // the same index, the same line. Where a bank's line names the kicker and
    // there is no kicker to name, "The kicker" is a WORD and gets a key of its
    // own rather than being passed in as a variable.
    // A LINE THAT NAMES THE DISTANCE NEEDS THE BOOT FOR IT. "From halfway"
    // about a kicker with no range read as a wrong stat (release audit,
    // 1.5.0); such a line falls back to a plain one for him, with no extra
    // draw on the stream, so the fingerprint of every other match is intact.
    let line = PEN_LINES[Math.floor(rng() * PEN_LINES.length)]
    if ((!kicker || kicker.a.goa < 12) && PEN_LONG[line]) line = PEN_LONG[line]
    if (ctx.weather !== 'Rain' && ctx.weather !== 'Snow' && PEN_WET[line]) line = PEN_WET[line]
    pushLine(state, ctx, min, 'PEN', side, line,
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
    // restart, as after any score - AFTER the line, so the line is stamped
    // with where the kick was taken (MatchEvent.fld), not the halfway restart
    ctx.field = ctx.field * 0.6 + 50 * 0.4
    describeRestart(state, ctx, side)
  } else if (detail && ctx.crng() < 0.7) {
    // now and then it is the upright that says no (item 57), words only
    const post = !!kicker && ctx.crng() < 0.14
    pushLine(state, ctx, min, 'SUB', side, post ? `comm.penPost${1 + Math.floor(ctx.crng() * 2)}` : kicker ? 'comm.penWideNamed' : 'comm.penWide',
      { player: kicker?.name ?? '' }, kicker?.id)
  }
}
