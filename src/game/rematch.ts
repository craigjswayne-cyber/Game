// ---- THE REMATCH: AN OPPONENT REMEMBERS (1.8.4) ----
//
// The arms race's tape is one tape, read by every dugout alike (armsrace.ts),
// and the analyst reads the manager's last five matches against anybody
// (oppcoach.ts analystShift). Neither knew whether this coach had met him
// before. Now a coach who lost to him remembers what beat him, and the next
// time they meet leans a little against it:
//
//   WHAT HE SAW. The evidence of the last meeting (evidence.ts lastEvidence),
//     the manager's own count of what decided it: the full-time card's top
//     line (rankWhy) when he won. Nothing hidden is read: not his ratings,
//     not his calls' drilling, not what he will pick this week. A coach who
//     won, drew, or lost to something he cannot plan against (penalties,
//     the boot, the style matchup) changes nothing.
//
//   WHAT HE DOES. One small thing, by what beat him:
//     a called move     his defence is set for it: an adapt on that call, as
//                       the tape's (moves.ts moveEdge), on top of the tape's
//                       and never past the tape's own ceiling (ADAPT_MAX)
//     line breaks, or   his defence works harder: a layer on its defence
//     time in his 22
//     his set piece     the unit that lost its ball: a layer on his scrum
//                       or his lineout
//     turnovers         more bodies at the breakdown: a layer on it
//
//   HOW MUCH. What it was worth on the day (a converted try's worth or more
//     is all of it), the kind of coach (armsrace.ts SHARP: an analyst fully,
//     a reactive coach most of the way, a stubborn one a quarter), and how
//     long ago (a meeting last season counts half, older nothing). A called
//     strike counts by its share of the manager's tape now, so one he has
//     since hidden among others is worth less planning for, and a call he
//     has put away none.
//     Capped at MEM_ADAPT on a call (under a fifth of the tape at full) and
//     MEM_UNIT on a unit.
//
//   NO RUNAWAY. It reads the last meeting alone, so it never builds: beat
//     him the same way twice and the third meeting is no harder than the
//     second; win another way and he answers the new one and forgets the
//     old; lose and he forgets. scripts/memoryloopprobe.ts holds the cap,
//     and a signature call against an analyst over a season of rematches.
//
//   NOTHING HIDDEN. Whatever this changes in the match is said before kick
//     off: on the opposition report's history (at any accuracy, as a plan
//     written against him already is), on the desk thread, and in the kick-
//     off commentary. The report reads the same function the engine does.
//
// No rng anywhere, and nothing for a world without a manager.
import type { GameState } from './model'
import { ADAPT_COVER, ADAPT_MAX, SHARP, tapeOf } from './armsrace'
import { bestMove, lastEvidence, rankWhy, type CausalEvidence } from './evidence'
import { calledIds, callsOf, isStrike, sayKey } from './moves'
import { archetypeOf } from './oppcoach'
import { clamp } from './rng'

/** the most a remembered call adds to the tape's adapt on it */
export const MEM_ADAPT = 0.1
/** the most a remembered unit is lifted by */
export const MEM_UNIT = 0.025
/** what the cause was worth on the day for the whole of it: a converted try */
export const MEM_FULL = 7
/** below this share of the whole a coach changes nothing worth saying */
export const MEM_MIN = 0.2

export type RematchCause = 'move' | 'break' | 'phase' | 'set' | 'turn'
export type RematchUnit = 'defence' | 'scrum' | 'lineout' | 'breakdown'

export interface Rematch {
  /** what beat him last time */
  cause: RematchCause
  /** the call, for a move */
  move?: string
  /** the unit he lifts (not for a move) */
  unit?: RematchUnit
  /** how much of the whole, 0..1 */
  w: number
  /** the adapt added on the call (a move) */
  adapt: number
  /** the layer on his unit (not a move): 1 + MEM_UNIT * w */
  layer: number
  /** the meeting he remembers */
  fxId: number
  season: number
}

/** The line that says so, as a key and its values. */
export function rematchLine(r: Rematch): { k: string; v: Record<string, string | number> } {
  if (r.cause === 'move') return { k: 'oppreport.memMove', v: { move_k: sayKey(r.move!) } }
  if (r.cause === 'set') return { k: 'oppreport.memSet', v: { unit_k: `oppreport.u_${r.unit}` } }
  return { k: r.cause === 'break' ? 'oppreport.memBreak' : r.cause === 'phase' ? 'oppreport.memPhase' : 'oppreport.memTurn', v: {} }
}

/** The cause a coach can plan against, from the top line of a meeting he
 *  lost, or null. */
export function rematchCause(ev: CausalEvidence): { cause: RematchCause; sig: number; move?: string; unit?: RematchUnit } | null {
  if (ev.us <= ev.them) return null
  const top = rankWhy(ev, 1)[0]
  if (!top || top.sig <= 0) return null
  switch (top.cause) {
    case 'move': {
      const m = bestMove(ev.side[0])
      return m ? { cause: 'move', sig: top.sig, move: m[0] } : null
    }
    case 'break':
    case 'phase':
      return { cause: top.cause, sig: top.sig, unit: 'defence' }
    case 'turn':
      return { cause: 'turn', sig: top.sig, unit: 'breakdown' }
    case 'set': {
      const o = ev.side[1]
      return { cause: 'set', sig: top.sig, unit: o.setLost[1] > o.setLost[0] ? 'lineout' : 'scrum' }
    }
    default:
      return null
  }
}

/** What this opponent's coach brings from the last meeting, or null. Pure:
 *  the engine reads it as the match begins (before this match is on the
 *  tape), and the report and the desk read the same. */
export function rematchOf(state: GameState, oppId: string | null | undefined): Rematch | null {
  if (!oppId || oppId === state.userClubId || state.unemployed) return null
  const opp = state.clubs[oppId]
  const me = state.clubs[state.userClubId]
  if (!opp || !me) return null
  const ev = lastEvidence(state, oppId)
  if (!ev) return null
  const age = ev.season === state.season ? 1 : ev.season === state.season - 1 ? 0.5 : 0
  if (!age) return null
  const c = rematchCause(ev)
  if (!c) return null
  let w = SHARP[archetypeOf(opp.id, opp.rep)] * clamp(c.sig / MEM_FULL, 0, 1) * age
  if (c.cause === 'move') {
    if (!calledIds(callsOf(state, me)).includes(c.move!)) return null
    // a strike by its share of the tape; the shape and the red-zone and
    // penalty plays are whole calls, as they wear (armsrace.ts THE WEAR)
    if (isStrike(c.move)) w *= clamp((tapeOf(me).share[c.move!] ?? 0) / ADAPT_COVER, 0, 1)
  }
  if (w < MEM_MIN) return null
  w = Math.round(w * 100) / 100
  return {
    cause: c.cause, ...(c.move ? { move: c.move } : {}), ...(c.unit ? { unit: c.unit } : {}),
    w, adapt: c.cause === 'move' ? MEM_ADAPT * w : 0, layer: c.cause === 'move' ? 1 : 1 + MEM_UNIT * w,
    fxId: ev.fxId, season: ev.season,
  }
}

/** The adapt on each call with the remembered one added, never past the
 *  tape's own ceiling (armsrace.ts ADAPT_MAX). */
export function withRematch(adapt: Record<string, number>, r: Rematch | null): Record<string, number> {
  if (!r || r.cause !== 'move' || !r.move) return adapt
  return { ...adapt, [r.move]: Math.min(ADAPT_MAX, (adapt[r.move] ?? 0) + r.adapt) }
}
