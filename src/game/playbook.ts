// The set-piece playbook (F2).
//
// Rugby's set piece is not one number. A lineout is a called move with a shape,
// a target and a job, and a pack that has drilled the drive maul for six months
// is a different animal from one that has just been told to try it. That is the
// thing this game had no model of at all: two unit strengths, scrum and lineout,
// and a training emphasis that nudged them both by four percent.
//
// Three ideas, and all three matter or it is just another slider:
//
//   Drilled quality rises with coaching time and DECAYS when neglected. A routine
//   you stopped working on is a routine you have half lost.
//
//   Opponents' analysts learn your favourites. Calling the same lineout every
//   week is how it stops working, so the strongest routine is not automatically
//   the right call.
//
//   Each routine trades something. The drive maul is the best attacking lineout
//   in the game and the slowest, so it feeds a forward game and starves a wide
//   one. Off-the-top is the reverse.
//
// name/short/desc are i18n KEYS, not words - these tables are built once at
// module load and the language can change afterwards. English wording is in
// src/locales/en.json under `playbook`. The engine reads only the NUMBERS here.

import type { Club, GameState, Playbook } from './model'
import { standing } from './authority'
import { clamp } from './rng'

export interface Routine {
  id: string
  name: string
  kind: 'lineout' | 'scrum'
  /** one line the manager can act on */
  desc: string
  /** Nominal worth RELATIVE TO THE ORTHODOX CALL, which is 1.00.
   *
   *  Not an absolute multiplier. The first cut made these absolute (the orthodox
   *  lineout was 1.10) and every club in the world got a free 7.8% on both set
   *  pieces just for having a default, which pushed scoring to 53.4 against a
   *  53.2 ceiling. A routine has to earn its edge against the call you already
   *  know, so the safe options sit at or below 1.00 and only the ambitious ones
   *  go above it. */
  peak: number
  /** how quickly analysts read it: 0.6 hard to counter .. 1.4 obvious */
  tell: number
  /** what it costs elsewhere - a shape that eats time starves the backs */
  attack?: number
  tempo?: number
}

export const ROUTINES: Routine[] = [
  // ---- lineout -------------------------------------------------------------
  {
    id: 'lo_front', name: 'playbook.lo_front', kind: 'lineout',
    desc: 'playbook.lo_frontDesc',
    peak: 0.98, tell: 1.4, tempo: 1.02,
  },
  {
    id: 'lo_middle', name: 'playbook.lo_middle', kind: 'lineout',
    desc: 'playbook.lo_middleDesc',
    peak: 1.00, tell: 1.0,
  },
  {
    id: 'lo_back', name: 'playbook.lo_back', kind: 'lineout',
    desc: 'playbook.lo_backDesc',
    peak: 1.07, tell: 0.9, attack: 1.03,
  },
  {
    id: 'lo_dummy', name: 'playbook.lo_dummy', kind: 'lineout',
    desc: 'playbook.lo_dummyDesc',
    peak: 1.09, tell: 0.6,
  },
  {
    id: 'lo_maul', name: 'playbook.lo_maul', kind: 'lineout',
    desc: 'playbook.lo_maulDesc',
    peak: 1.11, tell: 1.1, attack: 1.04, tempo: 0.94,
  },
  {
    id: 'lo_top', name: 'playbook.lo_top', kind: 'lineout',
    desc: 'playbook.lo_topDesc',
    peak: 0.99, tell: 1.0, attack: 1.02, tempo: 1.06,
  },
  // ---- scrum ---------------------------------------------------------------
  {
    id: 'sc_channel1', name: 'playbook.sc_channel1', kind: 'scrum',
    desc: 'playbook.sc_channel1Desc',
    peak: 0.98, tell: 1.2, tempo: 1.05,
  },
  {
    id: 'sc_hold', name: 'playbook.sc_hold', kind: 'scrum',
    desc: 'playbook.sc_holdDesc',
    peak: 1.00, tell: 1.0,
  },
  {
    id: 'sc_shove', name: 'playbook.sc_shove', kind: 'scrum',
    desc: 'playbook.sc_shoveDesc',
    peak: 1.13, tell: 1.1, tempo: 0.96,
  },
  {
    id: 'sc_wheel', name: 'playbook.sc_wheel', kind: 'scrum',
    desc: 'playbook.sc_wheelDesc',
    peak: 1.06, tell: 0.7, attack: 1.02,
  },
]

export const ROUTINE_BY_ID: Record<string, Routine> = Object.fromEntries(ROUTINES.map(r => [r.id, r]))

export const DEFAULT_LINEOUT = 'lo_middle'
export const DEFAULT_SCRUM = 'sc_hold'

/** Everyone starts knowing the orthodox calls and nothing exotic. */
export function freshPlaybook(rep: number): Playbook {
  const base = 34 + Math.round(rep * 0.28) // an Elite 14 pack starts better drilled
  const drilled: Record<string, number> = {}
  for (const r of ROUTINES) {
    drilled[r.id] = r.id === DEFAULT_LINEOUT || r.id === DEFAULT_SCRUM
      ? Math.min(96, base + 22)
      : r.tell <= 0.7 ? Math.max(8, base - 20) // the clever ones take real work
      : base
  }
  return { drilled, used: {} }
}

export function playbookOf(club: Club): Playbook {
  club.playbook ??= freshPlaybook(club.rep)
  return club.playbook
}

/** How much of a routine's peak you actually get today.
 *
 *  Drilled quality is most of it. Familiarity is the rest: analysts watch tape,
 *  so the eighth time you call the same move it is worth materially less than the
 *  first. Both are needed - drilled alone would mean picking the strongest
 *  routine once and never thinking again. */
export function routineEffect(club: Club, id: string): { mult: number; drilled: number; seen: number; q: number } {
  const r = ROUTINE_BY_ID[id]
  if (!r) return { mult: 1, drilled: 0, seen: 0, q: 0 }
  const pb = playbookOf(club)
  const drilled = pb.drilled[id] ?? 30
  const seen = pb.used[id] ?? 0
  // 20 calls at tell 1.0 is full familiarity; a deniable move takes far longer
  const familiar = Math.min(0.75, (seen / 20) * r.tell)
  // Competence runs from -1 to +1 around a threshold of 60, so a routine you have
  // not drilled MISFIRES rather than quietly working slightly less well. An
  // undrilled drive maul should be worse than the middle jump you know cold.
  const q = clamp((drilled - 60) / 40, -1, 1)
  const gain = (r.peak - 1) * (1 - familiar) * q
  return { mult: 1 + gain, drilled, seen, q }
}

/** The week's coaching: what you call gets sharper, what you shelve rusts.
 *
 *  Called once a week per club. The set-piece training emphasis and a forwards
 *  coach decide how fast the called routines improve; everything else drifts
 *  down, which is what stops a club from having ten world-class moves. */
export function drillWeek(state: GameState, club: Club, emphasisSetPiece: boolean) {
  const pb = playbookOf(club)
  const coach = club.id === state.userClubId ? (state.staff?.scrumCoach ?? 0) : Math.round(club.rep / 25)
  const called = new Set([club.tactic.lineoutCall ?? DEFAULT_LINEOUT, club.tactic.scrumCall ?? DEFAULT_SCRUM])
  // AUTHORITY GATES THE DRILLING (pillar 1): a room that outranks its
  // manager trains his patterns at half pace - not malice, re-examination.
  // Every rep is argued with. Earn the room and the tax disappears.
  const auth = club.id === state.userClubId ? standing(state).familiarity : 1
  const up = ((emphasisSetPiece ? 2.2 : 1.0) + coach * 0.45) * auth
  for (const r of ROUTINES) {
    const cur = pb.drilled[r.id] ?? 30
    // a hard routine has a lower ceiling without real coaching behind it
    const ceiling = Math.min(98, 72 + coach * 6 + (emphasisSetPiece ? 8 : 0) - (r.tell <= 0.7 ? 6 : 0))
    pb.drilled[r.id] = called.has(r.id)
      ? Math.min(ceiling, cur + up)
      : Math.max(6, cur - 0.35)
  }
}

/** A new season wipes the tape: last year's analysis is last year's. */
export function resetFamiliarity(club: Club) {
  playbookOf(club).used = {}
}
