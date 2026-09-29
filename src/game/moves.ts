// ---- THE ATTACKING MOVES (1.8.1, owner request #99) ----
//
// The owner watched rugby analysis (pods, line running, decoys, backline
// moves off set piece) and asked for the game's attack to have real, named,
// technical moves that a manager picks, drills and then sees in the match and
// in the highlight clips. This is that library, and it is built on the set
// piece playbook (playbook.ts) rather than beside it:
//
//   THE SAME DRILLING. A move is drilled over weeks exactly as a lineout call
//   is: what you call gets sharper, what you shelve rusts, calling never makes
//   it worse, an undrilled move MISFIRES (a loss, never a gain), and an AI
//   club's coach sits on the same 0-3 scale as the manager's. Drilled quality
//   and the analysts' familiarity live in the same Playbook record, under
//   `mv_` ids, so a new season wipes the tape on both.
//
//   FIT. A move is only as good as the men it is run by. A loop needs a 10 and
//   a 12 who can handle and run; a crash ball needs a 12 who hits hard. Fit is
//   read off the shirts on the pitch against the world's average man in that
//   shirt (measured, see REF), so it moves with injuries and replacements.
//
//   THE OPPONENT. Every move beats one kind of defence and is weak against
//   another, read off the other side's without-ball dials: line speed (rush
//   or drift) and width (narrow or wide). Across the ten moves each of the
//   four traits is beaten exactly as often as it beats, so the library has no
//   answer that is right against everyone.
//
//   A BAD FIT IS WORSE THAN NO CALL. Quality is signed: a drilled move with
//   the wrong men against the wrong defence costs you, where no call costs
//   nothing at all.
//
// WHERE IT BITES. The engine has no explicit phases; a tick is four minutes
// of rugby. So each side's tick is LAUNCHED from a lineout, a scrum or open
// play by a hash of the fixture, the tick and the side (launchOf) - no draw
// on the match dice, the same whether anybody is watching. A strike move acts
// only on ticks launched from its set piece, a shape only on open play, and
// in those ticks it goes through the levers the engine already has: the try
// chance (the line break), the penalty window (winning the gain line), the
// field position after it (a move that goes backwards is a turnover in all
// but name), and the side's energy (tempo, like a routine's).
//
// name/desc are i18n KEYS; English wording is under `moves` in en.json.

import type { Attrs, Club, GameState, Tactic } from './model'
import { playbookOf } from './playbook'
import { standing } from './authority'
import { clamp } from './rng'

export type MoveGroup = 'shape' | 'strike'
export type Launch = 'lineout' | 'scrum' | 'open'
export type DefTrait = 'rush' | 'drift' | 'narrow' | 'wide'

export interface MoveNeed {
  /** shirt numbers (1..15) whose men run this part of the move */
  shirts: number[]
  attrs: (keyof Attrs)[]
}

export interface Move {
  id: string
  group: MoveGroup
  /** the set pieces a strike move is run from; a shape is open play */
  from: Launch[]
  name: string
  desc: string
  /** the name as the commentary says it mid-sentence, lower case */
  say: string
  needs: MoveNeed[]
  beats: DefTrait[]
  weak: DefTrait[]
  /** the most it moves the try chance in the ticks it runs in, at full
   *  competence, full fit, against the defence it beats (0.2 = 20%) */
  peak: number
  /** how quickly analysts read it, as a routine's tell */
  tell: number
  /** energy, as a routine's: over 1 costs legs whether it works or not */
  tempo: number
  /** how much ground a misfire gives away: a loop that goes wrong is caught
   *  behind the gain line, a crash ball that goes wrong is a tackle */
  risk: number
}

export const MOVES: Move[] = [
  // ---- phase-play shapes ---------------------------------------------------
  {
    id: 'mv_1331', group: 'shape', from: ['open'], name: 'moves.mv_1331', desc: 'moves.mv_1331Desc', say: 'moves.say.mv_1331',
    needs: [{ shirts: [1, 3, 4, 5], attrs: ['han', 'str'] }, { shirts: [9], attrs: ['pas'] }],
    beats: ['narrow'], weak: ['rush'], peak: 0.1, tell: 1.1, tempo: 1.04, risk: 0.8,
  },
  {
    id: 'mv_242', group: 'shape', from: ['open'], name: 'moves.mv_242', desc: 'moves.mv_242Desc', say: 'moves.say.mv_242',
    needs: [{ shirts: [6, 7, 8], attrs: ['pac', 'han'] }, { shirts: [10], attrs: ['pas'] }],
    beats: ['wide'], weak: ['drift'], peak: 0.11, tell: 1.0, tempo: 1.02, risk: 0.9,
  },
  {
    id: 'mv_backdoor', group: 'shape', from: ['open'], name: 'moves.mv_backdoor', desc: 'moves.mv_backdoorDesc', say: 'moves.say.mv_backdoor',
    needs: [{ shirts: [9], attrs: ['pas'] }, { shirts: [10, 12], attrs: ['dec', 'vis'] }],
    beats: ['rush'], weak: ['drift'], peak: 0.12, tell: 0.9, tempo: 1.03, risk: 1.1,
  },
  // ---- backline moves off set piece ------------------------------------------
  {
    id: 'mv_crash', group: 'strike', from: ['lineout', 'scrum'], name: 'moves.mv_crash', desc: 'moves.mv_crashDesc', say: 'moves.say.mv_crash',
    needs: [{ shirts: [12], attrs: ['str', 'han'] }, { shirts: [10], attrs: ['pas'] }],
    beats: ['wide'], weak: ['rush'], peak: 0.12, tell: 1.3, tempo: 0.98, risk: 0.6,
  },
  {
    id: 'mv_switch', group: 'strike', from: ['lineout', 'scrum'], name: 'moves.mv_switch', desc: 'moves.mv_switchDesc', say: 'moves.say.mv_switch',
    needs: [{ shirts: [10], attrs: ['han', 'dec'] }, { shirts: [13], attrs: ['agi', 'pac'] }],
    beats: ['drift'], weak: ['narrow'], peak: 0.16, tell: 0.9, tempo: 1.0, risk: 1.0,
  },
  {
    id: 'mv_loop', group: 'strike', from: ['lineout', 'scrum'], name: 'moves.mv_loop', desc: 'moves.mv_loopDesc', say: 'moves.say.mv_loop',
    needs: [{ shirts: [10, 12], attrs: ['han', 'pac'] }],
    beats: ['narrow'], weak: ['rush'], peak: 0.18, tell: 1.0, tempo: 1.02, risk: 1.2,
  },
  {
    id: 'mv_decoy', group: 'strike', from: ['lineout', 'scrum'], name: 'moves.mv_decoy', desc: 'moves.mv_decoyDesc', say: 'moves.say.mv_decoy',
    needs: [{ shirts: [10], attrs: ['pas', 'dec'] }, { shirts: [12], attrs: ['str'] }, { shirts: [13, 15], attrs: ['pac'] }],
    beats: ['rush'], weak: ['drift'], peak: 0.18, tell: 0.8, tempo: 1.0, risk: 1.1,
  },
  {
    id: 'mv_blind', group: 'strike', from: ['scrum'], name: 'moves.mv_blind', desc: 'moves.mv_blindDesc', say: 'moves.say.mv_blind',
    needs: [{ shirts: [9], attrs: ['pas', 'dec'] }, { shirts: [8], attrs: ['str'] }, { shirts: [14], attrs: ['pac'] }],
    beats: ['drift'], weak: ['wide'], peak: 0.16, tell: 0.8, tempo: 1.0, risk: 1.0,
  },
  {
    id: 'mv_inside', group: 'strike', from: ['lineout', 'scrum'], name: 'moves.mv_inside', desc: 'moves.mv_insideDesc', say: 'moves.say.mv_inside',
    needs: [{ shirts: [10], attrs: ['pas', 'vis'] }, { shirts: [12], attrs: ['agi', 'pac'] }],
    beats: ['drift'], weak: ['narrow'], peak: 0.15, tell: 0.9, tempo: 1.0, risk: 0.9,
  },
  {
    id: 'mv_strike13', group: 'strike', from: ['lineout'], name: 'moves.mv_strike13', desc: 'moves.mv_strike13Desc', say: 'moves.say.mv_strike13',
    needs: [{ shirts: [13], attrs: ['pac', 'agi'] }, { shirts: [10, 12], attrs: ['pas'] }],
    beats: ['rush'], weak: ['wide'], peak: 0.2, tell: 0.7, tempo: 1.0, risk: 1.3,
  },
]

export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map(m => [m.id, m]))
export const DEF_TRAITS: DefTrait[] = ['rush', 'drift', 'narrow', 'wide']

/** The three calls a side makes. Absent is no call, which is the engine as
 *  it was before moves existed. */
export interface MoveCalls { lineout?: string; scrum?: string; shape?: string }

/** What each head coach runs (AI clubs). Every philosophy has a set, and
 *  across the eight the four defensive traits are beaten about as often as
 *  they are weak, so the world as a whole plays no one answer. */
const PH_MOVES: Record<string, MoveCalls> = {
  pack: { lineout: 'mv_crash', scrum: 'mv_crash', shape: 'mv_1331' },
  width: { lineout: 'mv_loop', scrum: 'mv_switch', shape: 'mv_242' },
  tempo: { lineout: 'mv_decoy', scrum: 'mv_inside', shape: 'mv_backdoor' },
  squeeze: { lineout: 'mv_crash', scrum: 'mv_blind', shape: 'mv_1331' },
  blitz: { lineout: 'mv_strike13', scrum: 'mv_crash', shape: 'mv_242' },
  counter: { lineout: 'mv_inside', scrum: 'mv_loop', shape: 'mv_backdoor' },
  chaos: { lineout: 'mv_switch', scrum: 'mv_decoy', shape: 'mv_242' },
  structure: { lineout: 'mv_strike13', scrum: 'mv_blind', shape: 'mv_1331' },
}

const valid = (id: string | undefined, launch: Launch): string | undefined => {
  const m = id ? MOVE_BY_ID[id] : undefined
  return m && m.from.includes(launch) ? m.id : undefined
}

/** The calls this club makes. The manager's are his, on the tactic; every
 *  other club's are its head coach's, read off his philosophy, so a new coach
 *  brings new moves with him and nothing needs storing or migrating. */
export function callsOf(state: GameState, club: Club | undefined): MoveCalls {
  if (!club) return {}
  if (club.id === state.userClubId) {
    const tac = club.tactic
    return { lineout: valid(tac.moveLineout, 'lineout'), scrum: valid(tac.moveScrum, 'scrum'), shape: valid(tac.moveShape, 'open') }
  }
  const ph = club.philosophy ? PH_MOVES[club.philosophy] : undefined
  return ph ? { ...ph } : {}
}

export const callFor = (calls: MoveCalls, launch: Launch): string | undefined =>
  launch === 'lineout' ? calls.lineout : launch === 'scrum' ? calls.scrum : calls.shape

// ---------------------------------------------------------------- drilling

/** Where a move starts before anybody has worked on it. The manager's club
 *  knows none of them (the orthodox set-piece calls are the only thing a
 *  squad arrives knowing); an AI coach arrives with his own, as drilled as
 *  a club's default lineout. The clever ones take real work (tell <= 0.7). */
function startDrilled(state: GameState, club: Club, id: string): number {
  const m = MOVE_BY_ID[id]
  const base = 34 + Math.round(club.rep * 0.28)
  if (club.id !== state.userClubId) {
    const c = callsOf(state, club)
    if (c.lineout === id || c.scrum === id || c.shape === id) return Math.min(96, base + 22)
  }
  return m && m.tell <= 0.7 ? Math.max(8, base - 20) : base
}

export function drilledOf(state: GameState, club: Club, id: string): number {
  const pb = playbookOf(club)
  return pb.drilled[id] ?? startDrilled(state, club, id)
}

/**
 * The week's attacking practice, with playbook.drillWeek's rules exactly:
 * the moves called get sharper (an attack coach and an Attack week speed it
 * up, a room that outranks the manager slows it), everything else drifts
 * down, and a move drilled above this club's ceiling holds what it has when
 * it is called rather than falling to the ceiling. An AI club's attack coach
 * is on the manager's 0-3 scale.
 */
export function drillMovesWeek(state: GameState, club: Club, emphasisAttack: boolean) {
  const pb = playbookOf(club)
  const user = club.id === state.userClubId
  const coach = user ? (state.staff?.attack ?? 0) : Math.min(3, Math.round(club.rep / 25))
  const c = callsOf(state, club)
  const called = new Set([c.lineout, c.scrum, c.shape].filter((x): x is string => !!x))
  const auth = user ? standing(state).familiarity : 1
  const up = ((emphasisAttack ? 2.2 : 1.0) + coach * 0.45) * auth
  for (const m of MOVES) {
    const cur = drilledOf(state, club, m.id)
    const ceiling = Math.min(98, 72 + coach * 6 + (emphasisAttack ? 8 : 0) - (m.tell <= 0.7 ? 6 : 0))
    pb.drilled[m.id] = called.has(m.id)
      ? Math.max(cur, Math.min(ceiling, cur + up))
      : Math.max(6, cur - 0.35)
  }
}

// ---------------------------------------------------------------- the fit

/** The world's average man in each shirt on each attribute a move reads,
 *  measured over every club's first XV in three fresh worlds. Fit is read
 *  against this, so an average side is a fit of zero. */
const REF: Record<string, number> = {
  '1.han': 9.3, '1.str': 14.2, '3.han': 9.0, '3.str': 13.9, '4.han': 10.4, '4.str': 14.1, '5.han': 9.7, '5.str': 13.2,
  '6.pac': 9.2, '6.han': 11.2, '7.pac': 8.9, '7.han': 10.5, '8.pac': 9.7, '8.han': 12.0, '8.str': 14.1,
  '9.pas': 14.1, '9.dec': 12.2,
  '10.pas': 13.7, '10.han': 12.9, '10.dec': 13.0, '10.vis': 13.1, '10.pac': 9.7,
  '12.str': 12.5, '12.han': 13.2, '12.pac': 10.7, '12.agi': 10.2, '12.dec': 11.5, '12.vis': 11.1, '12.pas': 12.4,
  '13.agi': 9.8, '13.pac': 10.4, '14.pac': 11.6, '15.pac': 11.3,
}
/** attribute points above the average man for a fit of +1 */
const FIT_SPAN = 4

/** How well the men in the named shirts suit the move, -1..1. `at` returns
 *  the man's attribute in that shirt, or null when nobody is there (a man in
 *  the bin): an empty shirt is read as a weak one. */
export function moveFit(m: Move, at: (shirt: number, a: keyof Attrs) => number | null): number {
  let sum = 0, n = 0
  for (const need of m.needs) for (const s of need.shirts) for (const a of need.attrs) {
    const v = at(s, a)
    sum += ((v ?? 6) - (REF[`${s}.${a}`] ?? 11)) / FIT_SPAN
    n++
  }
  return n ? clamp(sum / n, -1, 1) : 0
}

/** How strongly the opponent's defence shows each trait, 0..1. */
export function defTraits(tac: Tactic | undefined): Record<DefTrait, number> {
  const f = (v: number | undefined) => (Number.isFinite(v) ? clamp(((v as number) - 50) / 50, -1, 1) : 0)
  const line = f(tac?.defLine), width = f(tac?.defWidth)
  return { rush: Math.max(0, line), drift: Math.max(0, -line), narrow: Math.max(0, -width), wide: Math.max(0, width) }
}

/** The matchup, -1..1: plus when their defence is the kind this move beats. */
export function moveMatchup(m: Move, oppTac: Tactic | undefined): number {
  const d = defTraits(oppTac)
  let v = 0
  for (const b of m.beats) v += d[b]
  for (const w of m.weak) v -= d[w]
  return clamp(v * 1.6, -1, 1)
}

/** a drilled move with average men against a neutral defence is a small plus */
const Q_BASE = 0.15
const Q_FIT = 0.5
const Q_MATCH = 0.65

/**
 * What a called move is worth in a tick it runs in: the share it moves the
 * try chance by (negative is a cost), and the pieces it was made of.
 *
 * The playbook's rule, with fit and the matchup in it: competence q runs -1
 * to 1 about a drilled 60, and below 60 the move MISFIRES, costing as much as
 * it could have gained whatever the fit. Above it, the gain is the move's
 * peak times q times its quality, and quality is signed, so a drilled move
 * with the wrong men against the wrong defence costs you. Familiarity takes
 * the edge off both ways, as it does a lineout call.
 */
export function moveEdge(state: GameState, club: Club, id: string, fit: number, matchup: number): { gain: number; q: number; quality: number; drilled: number; seen: number } {
  const m = MOVE_BY_ID[id]
  if (!m) return { gain: 0, q: 0, quality: 0, drilled: 0, seen: 0 }
  const drilled = drilledOf(state, club, id)
  const seen = playbookOf(club).used[id] ?? 0
  const familiar = Math.min(0.75, (seen / 20) * m.tell)
  const q = clamp((drilled - 60) / 40, -1, 1)
  const quality = clamp(Q_BASE + Q_FIT * fit + Q_MATCH * matchup, -1, 1)
  const gain = q >= 0 ? m.peak * q * quality * (1 - familiar) : m.peak * q * (1 - familiar)
  return { gain, q, quality, drilled, seen }
}

/** The legs a club's moves cost, for the side's tempoF. The routine rule:
 *  a saving needs the competence, a cost is paid whether it comes off or not. */
export function moveTempoF(state: GameState, club: Club): number {
  const c = callsOf(state, club)
  let f = 1
  for (const id of [c.lineout, c.scrum, c.shape]) {
    const m = id ? MOVE_BY_ID[id] : undefined
    if (!m || m.tempo === 1) continue
    const q = clamp((drilledOf(state, club, id!) - 60) / 40, -1, 1)
    // a strike move is a share of the side's rugby, a shape most of it
    const share = m.group === 'shape' ? 0.55 : 0.25
    f *= 1 + (m.tempo < 1 ? (m.tempo - 1) * Math.max(0, q) : m.tempo - 1) * share
  }
  return f
}

// ---------------------------------------------------------------- the launch

/** Share of a side's ticks launched from each set piece. The match sheet
 *  counts about twenty-five lineouts and thirteen scrums a match between the
 *  two sides; the rest is open play. */
export const LAUNCH_LINEOUT = 0.3
export const LAUNCH_SCRUM = 0.15

/** How this side's tick began: a hash of the fixture, the tick and the side,
 *  never a draw on the match dice, so a watched match and a silent one are
 *  launched the same way and a side with no calls plays exactly as before. */
export function launchOf(fxId: number, tick: number, home: boolean): Launch {
  let h = (Math.imul(fxId | 0, 0x9e3779b1) ^ Math.imul(tick + 1, 0x85ebca6b) ^ (home ? 0x27d4eb2f : 0x165667b1)) >>> 0
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0
  h ^= h >>> 15
  const u = (h >>> 0) / 4294967296
  return u < LAUNCH_LINEOUT ? 'lineout' : u < LAUNCH_LINEOUT + LAUNCH_SCRUM ? 'scrum' : 'open'
}

/** A stable 0..1 from a few integers, for choices that must not draw. */
export function moveHash(...ns: number[]): number {
  let h = 0x811c9dc5
  for (const n of ns) { h = Math.imul(h ^ (n | 0), 16777619) >>> 0; h ^= h >>> 13 }
  h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

/** The man a move is run through, by shirt, for the commentary: the loop is
 *  the 10's, the crash ball the 12's, the blindside wrap the 9's. */
export const MOVE_MAKER: Record<string, number> = {
  mv_1331: 9, mv_242: 10, mv_backdoor: 10, mv_crash: 12, mv_switch: 10, mv_loop: 10,
  mv_decoy: 10, mv_blind: 9, mv_inside: 10, mv_strike13: 13,
}

/** The move's name as the commentary says it, lower case mid-sentence
 *  ("the miss-and-loop"): a key, carried in a line's move_k. */
export const sayKey = (id: string) => MOVE_BY_ID[id]?.say ?? 'common.nothing'

/** The id of the move a line names in its move_k, or null (the clip reads this). */
export const moveOfKey = (moveK: unknown): string | null => {
  if (typeof moveK !== 'string' || !moveK.startsWith('moves.say.')) return null
  const id = moveK.slice(10)
  return MOVE_BY_ID[id] ? id : null
}
