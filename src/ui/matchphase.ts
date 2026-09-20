/**
 * ---- THE MINUTES BETWEEN THE EVENTS (v1.7.0) ----
 *
 * Owner: "the in-game animation to be more realistic - it says minute by minute
 * at the minute in game but it skips huge chunks. The animation needs to be
 * more realistic so you can see the move."
 *
 * He is describing a real thing, and the settings sheet had been promising it
 * in so many words: the ticker's two modes are "Every minute" and "Highlights",
 * and Every Minute was not every minute. It could not be. The engine simulates
 * in four-minute ticks (matchEngine.ts, stepTick) and writes every line a tick
 * produces at ONE randomly chosen minute inside it, so the clock on the
 * scoreboard went 3' - 6' - 6' - 14' - 22' and the fifteen men on the pitch
 * stood in the same shape for the whole of it.
 *
 * ---- WHY THE ENGINE IS NOT THE PLACE TO FIX IT ----
 *
 * The obvious answer is to run the engine at one minute a tick instead of four.
 * It is the wrong one, and expensively so. Every probability in simTick is
 * priced per four minutes, and a quarter of them is not the same match: the
 * try rate, the card rate, the injury rate, the penalty count the referee's
 * patience is measured against, the hour-mark bench window, the tick indices
 * that HT, the 60' break and the finishers' quarter are pinned to. Twenty
 * seasons of scoreline distribution (disttest), award counts (awardprobe) and
 * board behaviour are calibrated on that clock. Nothing the owner asked for is
 * a change to the match; he asked to SEE the match.
 *
 * So the minutes are filled here, in the UI, and the engine is untouched. Not
 * one number in this file reaches the simulation: no rng of the match's stream
 * is drawn, no score, no possession, no rating moves. If every line below were
 * deleted the result of every fixture would be identical to the digit.
 *
 * ---- WHAT A PASSAGE OF PLAY IS ----
 *
 * Two facts are known at every quiet minute, and between them they are enough:
 * where the ball was at the last thing that happened, and where it will be at
 * the next one. A try at 22' is scored at 88% of the way up the pitch; if the
 * last event was a scrum at 40%, then the minutes from 19 to 22 are a side
 * working sixty metres of field, and that is a passage of play with a shape to
 * it. The ball is walked along that line with a wobble on it, possession
 * changes hands where it should, and the phases - a carry, a ruck, ball wide,
 * a kick, a set piece - are named from the position and the distance still to
 * go rather than picked at random.
 *
 * DETERMINISTIC, from the fixture and the minute. This is drawn many times per
 * minute (React re-renders on every store tick) and it has to be the same
 * picture each time or the ball would jitter on the spot; a save reloaded
 * mid-match has to come back to the same passage, and two players watching the
 * same fixture have to see the same game. A Math.random() here would have
 * failed all three.
 */
import type { MatchEvent } from '../game/model'

export type PhaseKind = 'carry' | 'ruck' | 'wide' | 'kick' | 'scrum' | 'lineout' | 'maul'

export interface Phase {
  /** Across the pitch, 0-100, in the FIXTURE's frame - the same scale and the
   *  same frame as MatchDay's ballLeft, so the pitch mirrors it for an away
   *  manager without knowing this file exists. */
  ball: number
  /** Which side has it, or null in the seconds a kick is in the air. */
  teamId: string | null
  kind: PhaseKind
  /** The commentary key for the strip. Generic by design: it names no player
   *  and claims no outcome, so it cannot contradict the engine's own account
   *  of the match. These lines are NOT events - they never enter the log, they
   *  are not in the full-time commentary, and they are not in the save. */
  line: string
}

/** A small, fast, stable hash. Two integers in, a float in [0,1) out. */
function noise(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0
  h = (h ^ (h >>> 13)) * 1274126177 | 0
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const LINES: Record<PhaseKind, string> = {
  carry: 'comm.phCarry',
  ruck: 'comm.phRuck',
  wide: 'comm.phWide',
  kick: 'comm.phKick',
  scrum: 'comm.phScrum',
  lineout: 'comm.phLineout',
  maul: 'comm.phMaul',
}

/**
 * The passage of play at one minute of the clock.
 *
 * @param seed      the fixture id, so two matches in the same week differ
 * @param min       the minute the clock is showing
 * @param homeId    which side defends the left of the fixture frame
 * @param from      the last revealed event (where the ball was)
 * @param to        the next event waiting to be revealed (where it is going)
 * @param fromBall  that event's ball position, 0-100, fixture frame
 * @param toBall    the next event's, same scale
 */
export function phaseAt(
  seed: number, min: number, homeId: string,
  from: MatchEvent | undefined, to: MatchEvent | undefined,
  fromBall: number, toBall: number,
): Phase {
  const a = from?.min ?? 0
  const b = to?.min ?? a + 4
  // How far through the passage this minute is. A single-minute gap is already
  // at the far end: there is no passage to walk, only the arrival.
  const p = b > a ? Math.max(0, Math.min(1, (min - a) / (b - a))) : 1
  const r1 = noise(seed, min)
  const r2 = noise(seed + 977, min)

  /**
   * THE BALL DOES NOT TRAVEL IN A STRAIGHT LINE and it is worth saying why the
   * wobble is shaped the way it is rather than simply added. A rugby side
   * going sixty metres does it in fits: three carries for two metres, a kick
   * for thirty, a turnover back the other way. So the wobble is WIDEST IN THE
   * MIDDLE of the passage and closes to nothing at both ends - the ball has to
   * arrive exactly where the next event says it was, or the try is scored ten
   * metres from where the picture had the ball a second earlier, which is the
   * class of lie this whole file exists to stop telling.
   */
  const swing = Math.sin(p * Math.PI) // 0 at both ends, 1 in the middle
  const ball = Math.max(6, Math.min(94,
    fromBall + (toBall - fromBall) * p + (r1 - 0.5) * 26 * swing))

  /**
   * WHOSE BALL IT IS. Mostly the side that is about to do something - they are
   * building towards it - but not always, because a passage in which one team
   * keeps the ball for four straight minutes is not a rugby match. A third of
   * the quiet minutes go the other way: an exit kick, a turnover, a scrum
   * against the head. The share tightens as the passage nears its end, so the
   * side that scores has the ball in the moments before they score.
   */
  const owner = to?.teamId ?? from?.teamId ?? null
  const other = from?.teamId && from.teamId !== owner ? from.teamId : null
  const theirs = r2 < 0.34 * (1 - p * 0.8) && other != null
  const teamId = theirs ? other : owner

  /**
   * WHAT IS HAPPENING, read off the position rather than rolled for. Deep in
   * your own half you kick; inside the opposition 22 you keep it tight and
   * maul; in between you carry, ruck and move it. A set piece appears where
   * the ball has just changed hands, which is where one actually would.
   */
  // IN HIS OWN HALF, and it has to be asked of the FIXTURE, not of whoever
  // happened to be carrying at the last event. 0 is the home line in this
  // frame, so home is deep near 0 and away is deep near 100; reading it off
  // `from.teamId` instead had a side kicking for territory out of the
  // opposition 22 whenever the last event had belonged to the other lot.
  const deep = teamId === homeId ? ball < 30 : ball > 70
  const close = Math.abs(ball - 50) > 28
  const kind: PhaseKind =
    theirs ? (r1 < 0.45 ? 'scrum' : 'lineout')
      : deep && r1 < 0.5 ? 'kick'
      : close && r1 < 0.32 ? 'maul'
      : r1 < 0.30 ? 'wide'
      : r1 < 0.62 ? 'ruck'
      : 'carry'

  return { ball, teamId, kind, line: LINES[kind] }
}
