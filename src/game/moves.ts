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
//   or drift) and width (narrow or wide). Across the library each of the
//   four traits is beaten exactly as often as it beats, so there is no
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
// THE MANAGER'S PLAYBOOK (1.8.2, armsrace.ts). The manager's calls are no
// longer one per set piece but a playbook: a base shape for open play, a
// primary and a secondary strike run off first-phase ball in the mix he
// sets, and a red-zone play for the opposition 22 (the only place the maul
// switch and the tap penalty are called). An AI coach still calls one move
// per set piece off his philosophy, exactly as before.
//
// name/desc are i18n KEYS; English wording is under `moves` in en.json.

import type { Attrs, Club, GameState, Tactic } from './model'
import { playbookOf } from './playbook'
import { standing } from './authority'
import { clamp } from './rng'

export type MoveGroup = 'shape' | 'strike'
/** where a tick is launched from. 'tap' is never a launch of its own: it is
 *  the quick tap penalty a red-zone call takes in the opposition 22, on the
 *  ticks there that would otherwise be open play (callForTick). */
export type Launch = 'lineout' | 'scrum' | 'open' | 'tap'
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
  /** a red-zone play only (1.8.2): a maul or a tap penalty is what a side
   *  does five metres out, never from halfway, so it can be called only in
   *  the playbook's red-zone slot */
  red?: true
  /** a kick rather than a pass: the clip plays it as the kick through */
  kick?: 'cross' | 'grubber'
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

const mv = (id: string, group: MoveGroup, from: Launch[], rest: Omit<Move, 'id' | 'group' | 'from' | 'name' | 'desc' | 'say'>): Move =>
  ({ id, group, from, name: `moves.${id}`, desc: `moves.${id}Desc`, say: `moves.say.${id}`, ...rest })

export const MOVES: Move[] = [
  // ---- phase-play shapes ---------------------------------------------------
  mv('mv_1331', 'shape', ['open'], {
    needs: [{ shirts: [1, 3, 4, 5], attrs: ['han', 'str'] }, { shirts: [9], attrs: ['pas'] }],
    beats: ['narrow'], weak: ['rush'], peak: 0.1, tell: 1.1, tempo: 1.04, risk: 0.8,
  }),
  mv('mv_242', 'shape', ['open'], {
    needs: [{ shirts: [6, 7, 8], attrs: ['pac', 'han'] }, { shirts: [10], attrs: ['pas'] }],
    beats: ['wide'], weak: ['drift'], peak: 0.11, tell: 1.0, tempo: 1.02, risk: 0.9,
  }),
  mv('mv_backdoor', 'shape', ['open'], {
    needs: [{ shirts: [9], attrs: ['pas'] }, { shirts: [10, 12], attrs: ['dec', 'vis'] }],
    beats: ['rush'], weak: ['drift'], peak: 0.12, tell: 0.9, tempo: 1.03, risk: 1.1,
  }),
  // ---- backline moves off set piece ------------------------------------------
  mv('mv_crash', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [12], attrs: ['str', 'han'] }, { shirts: [10], attrs: ['pas'] }],
    beats: ['wide'], weak: ['rush'], peak: 0.12, tell: 1.3, tempo: 0.98, risk: 0.6,
  }),
  mv('mv_switch', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10], attrs: ['han', 'dec'] }, { shirts: [13], attrs: ['agi', 'pac'] }],
    beats: ['drift'], weak: ['narrow'], peak: 0.16, tell: 0.9, tempo: 1.0, risk: 1.0,
  }),
  mv('mv_loop', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10, 12], attrs: ['han', 'pac'] }],
    beats: ['narrow'], weak: ['rush'], peak: 0.18, tell: 1.0, tempo: 1.02, risk: 1.2,
  }),
  mv('mv_decoy', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10], attrs: ['pas', 'dec'] }, { shirts: [12], attrs: ['str'] }, { shirts: [13, 15], attrs: ['pac'] }],
    beats: ['rush'], weak: ['drift'], peak: 0.18, tell: 0.8, tempo: 1.0, risk: 1.1,
  }),
  mv('mv_blind', 'strike', ['scrum'], {
    needs: [{ shirts: [9], attrs: ['pas', 'dec'] }, { shirts: [8], attrs: ['str'] }, { shirts: [14], attrs: ['pac'] }],
    beats: ['drift'], weak: ['wide'], peak: 0.16, tell: 0.8, tempo: 1.0, risk: 1.0,
  }),
  mv('mv_inside', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10], attrs: ['pas', 'vis'] }, { shirts: [12], attrs: ['agi', 'pac'] }],
    beats: ['drift'], weak: ['narrow'], peak: 0.15, tell: 0.9, tempo: 1.0, risk: 0.9,
  }),
  mv('mv_strike13', 'strike', ['lineout'], {
    needs: [{ shirts: [13], attrs: ['pac', 'agi'] }, { shirts: [10, 12], attrs: ['pas'] }],
    beats: ['rush'], weak: ['wide'], peak: 0.2, tell: 0.7, tempo: 1.0, risk: 1.3,
  }),
  // ---- THE NEW FAMILIES (1.8.2), from the coaching study ----------------------
  // The blind wing brought in-field: the man the defence does not count
  // arrives at pace in the 10-12 channel off a flat 10, the 12 a decoy. A
  // drifting or man-marking line leaves the seam; a flanker folding into
  // the 10 channel (a narrow line) shuts it.
  mv('mv_wingin', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10], attrs: ['pas', 'vis'] }, { shirts: [11, 14], attrs: ['pac', 'agi'] }, { shirts: [12], attrs: ['str'] }],
    beats: ['drift'], weak: ['narrow'], peak: 0.16, tell: 0.8, tempo: 1.0, risk: 1.0,
  }),
  // Width with the full-back: short flat passes along the line and the 15
  // into it from depth, the ball on to the far touch. Stretches a narrow
  // line; a rush on the 10 and 12 kills it before it gets there.
  mv('mv_width', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [10, 12, 13], attrs: ['pas'] }, { shirts: [15], attrs: ['pac'] }],
    beats: ['narrow'], weak: ['rush'], peak: 0.15, tell: 1.0, tempo: 1.02, risk: 1.1,
  }),
  // The lineout peel: the maul sets, the hooker comes round and takes it off
  // the back, and the blind wing cuts in on his shoulder in the seam the
  // maul's defenders leave. A defence crowding the maul pays for it; a wide
  // one keeps a back in that channel.
  mv('mv_peel', 'strike', ['lineout'], {
    needs: [{ shirts: [2], attrs: ['pas'] }, { shirts: [7], attrs: ['str'] }, { shirts: [11, 14], attrs: ['pac'] }],
    beats: ['rush'], weak: ['wide'], peak: 0.17, tell: 0.9, tempo: 0.98, risk: 0.8,
  }),
  // The maul switch, five metres out: the lineout splits into two pods,
  // they compete at the obvious one and the ball goes to the other, which
  // binds and drives up the touchline. Beats a spread defence; a narrow one
  // has the numbers to hold it up.
  mv('mv_maulswitch', 'strike', ['lineout'], {
    red: true,
    needs: [{ shirts: [2, 4, 5], attrs: ['lin'] }, { shirts: [1, 3, 6, 8], attrs: ['str'] }],
    beats: ['wide'], weak: ['narrow'], peak: 0.2, tell: 1.2, tempo: 0.97, risk: 0.6,
  }),
  // The tap penalty switch: the 9 taps, a pod shapes to drive, the ball goes
  // to the second pod and round the corner of it. Quick enough to catch a
  // line still drifting into place; a line already up on the mark smothers it.
  mv('mv_tap', 'strike', ['tap'], {
    red: true,
    needs: [{ shirts: [9], attrs: ['dec'] }, { shirts: [1, 2, 3, 4, 5], attrs: ['str'] }, { shirts: [10], attrs: ['pas'] }],
    beats: ['drift'], weak: ['rush'], peak: 0.18, tell: 1.1, tempo: 1.03, risk: 0.9,
  }),
  // Crash then swing: a flat crash ball with a back-rower on the shoulder
  // sucks the inside defence in, and off the quick ruck the ball goes back the
  // other way to the far edge. A line that bunches pays for it; a drift has
  // the men to slide across.
  mv('mv_crashswing', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [12, 6], attrs: ['str'] }, { shirts: [10, 13], attrs: ['pas'] }, { shirts: [15], attrs: ['pac'] }],
    beats: ['narrow'], weak: ['drift'], peak: 0.14, tell: 1.1, tempo: 1.03, risk: 0.8,
  }),
  // The loop by the 9: the 10 runs straight at the fringe and the scrum-half,
  // who followed his pass round the back, takes the tip outside him where
  // the fringe defender should be. A spread line leaves that space; a packed
  // fringe closes it.
  mv('mv_loop9', 'strike', ['lineout', 'scrum'], {
    needs: [{ shirts: [9], attrs: ['pac', 'pas'] }, { shirts: [10], attrs: ['han'] }],
    beats: ['wide'], weak: ['narrow'], peak: 0.15, tell: 0.9, tempo: 1.02, risk: 1.1,
  }),
  // The kicks. The cross-field kick: a flat line draws them up and the 10
  // puts it on the far wing, running onto it. A narrow line leaves that wing
  // alone; a wide one has a man under it.
  mv('mv_crosskick', 'strike', ['lineout', 'scrum'], {
    kick: 'cross',
    needs: [{ shirts: [10], attrs: ['kic', 'vis'] }, { shirts: [11, 14], attrs: ['pac', 'han'] }],
    beats: ['narrow'], weak: ['wide'], peak: 0.19, tell: 0.8, tempo: 1.0, risk: 1.4,
  }),
  // The grubber through: a line rushing up leaves grass behind it, and the
  // 10 rolls it through between two of them for the centres to chase. A
  // drift with depth behind it sweeps it up.
  mv('mv_grubber', 'strike', ['lineout', 'scrum'], {
    kick: 'grubber',
    needs: [{ shirts: [10], attrs: ['kic'] }, { shirts: [12, 13], attrs: ['pac', 'agi'] }],
    beats: ['rush'], weak: ['drift'], peak: 0.14, tell: 0.9, tempo: 1.0, risk: 1.2,
  }),
]

export const MOVE_BY_ID: Record<string, Move> = Object.fromEntries(MOVES.map(m => [m.id, m]))
export const DEF_TRAITS: DefTrait[] = ['rush', 'drift', 'narrow', 'wide']

/**
 * The calls a side makes. An AI coach calls one move per set piece and a
 * shape (lineout, scrum, shape), as since 1.8.1. The manager's are his
 * playbook (1.8.2): the base shape, a primary and a secondary strike off
 * first-phase ball (main, alt, with `mix` the primary's share where both can
 * run), and the red-zone play. Absent is no call, which is the engine as it
 * was before moves existed.
 */
export interface MoveCalls {
  lineout?: string; scrum?: string; shape?: string
  main?: string; alt?: string; mix?: number; red?: string
}

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

/** a move the manager may put in a strike slot: off a set piece, not a red-zone play */
export const isStrike = (id: string | undefined): id is string => {
  const m = id ? MOVE_BY_ID[id] : undefined
  return !!m && m.group === 'strike' && !m.red
}
/** a move the manager may put in the red-zone slot: any strike move or a red-zone play */
export const isRedCall = (id: string | undefined): id is string => {
  const m = id ? MOVE_BY_ID[id] : undefined
  return !!m && m.group === 'strike'
}
/** the primary strike's share of the first-phase ball both strikes can run
 *  off, in per cent: the manager's mix, 50 to 90, and two in three unset */
export const MIX_DEFAULT = 67
export const mixOf = (tac: Pick<Tactic, 'moveMix'>): number =>
  Number.isFinite(tac.moveMix) ? clamp(Math.round(tac.moveMix as number), 50, 90) : MIX_DEFAULT

/** The calls this club makes. The manager's are his playbook, on the tactic;
 *  every other club's are its head coach's, read off his philosophy, so a new
 *  coach brings new moves with him and nothing needs storing or migrating. */
export function callsOf(state: GameState, club: Club | undefined): MoveCalls {
  if (!club) return {}
  if (club.id === state.userClubId) {
    const tac = club.tactic
    const main = isStrike(tac.moveMain) ? tac.moveMain : undefined
    const alt = isStrike(tac.moveAlt) && tac.moveAlt !== main ? tac.moveAlt : undefined
    return {
      main, alt,
      mix: main && alt ? mixOf(tac) / 100 : undefined,
      shape: valid(tac.moveShape, 'open'),
      red: isRedCall(tac.moveRed) ? tac.moveRed : undefined,
    }
  }
  const ph = club.philosophy ? PH_MOVES[club.philosophy] : undefined
  return ph ? { ...ph } : {}
}

/** Every move a side has called, once each. */
export const calledIds = (c: MoveCalls): string[] =>
  [...new Set([c.lineout, c.scrum, c.shape, c.main, c.alt, c.red].filter((x): x is string => !!x))]

/** a side with any call at all */
export const anyCall = (c: MoveCalls) => !!(c.lineout || c.scrum || c.shape || c.main || c.alt || c.red)

/** The strike run off first-phase ball from this set piece, before the red
 *  zone has its say: an AI coach's call for the set piece, or the manager's
 *  primary and secondary, whichever can run from it, and where both can the
 *  primary on `mix` of them by a hash `u` (0..1) of the fixture and the tick. */
export function strikeFor(c: MoveCalls, launch: 'lineout' | 'scrum', u: number): string | undefined {
  if (c.main || c.alt) {
    const a = valid(c.main, launch), b = valid(c.alt, launch)
    if (a && b) return u < (c.mix ?? MIX_DEFAULT / 100) ? a : b
    return a ?? b
  }
  return launch === 'lineout' ? c.lineout : c.scrum
}

/** The move this tick runs, and what it is run from: in the opposition 22
 *  (`red`) the red-zone play when it can run from this launch (a tap penalty
 *  from what would be open play), otherwise the strike for the set piece or
 *  the shape in open play. */
export function callForTick(c: MoveCalls, launch: Launch, u: number, red: boolean): { id: string; launch: Launch } | null {
  if (red && c.red) {
    const m = MOVE_BY_ID[c.red]
    if (m?.from.includes(launch)) return { id: m.id, launch }
    if (m && launch === 'open' && m.from.includes('tap')) return { id: m.id, launch: 'tap' }
  }
  const id = launch === 'lineout' || launch === 'scrum' ? strikeFor(c, launch, u) : launch === 'open' ? c.shape : undefined
  return id ? { id, launch } : null
}

/** How far up the pitch the red zone starts: the opposition 22. */
export const RED_ZONE = 78

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
  const called = new Set(calledIds(callsOf(state, club)))
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
 *  measured over every club's first XV in three fresh worlds (the second
 *  block for the 1.8.2 families, measured the same way). Fit is read
 *  against this, so an average side is a fit of zero. */
const REF: Record<string, number> = {
  '1.han': 9.3, '1.str': 14.2, '3.han': 9.0, '3.str': 13.9, '4.han': 10.4, '4.str': 14.1, '5.han': 9.7, '5.str': 13.2,
  '6.pac': 9.2, '6.han': 11.2, '7.pac': 8.9, '7.han': 10.5, '8.pac': 9.7, '8.han': 12.0, '8.str': 14.1,
  '9.pas': 14.1, '9.dec': 12.2,
  '10.pas': 13.7, '10.han': 12.9, '10.dec': 13.0, '10.vis': 13.1, '10.pac': 9.7,
  '12.str': 12.5, '12.han': 13.2, '12.pac': 10.7, '12.agi': 10.2, '12.dec': 11.5, '12.vis': 11.1, '12.pas': 12.4,
  '13.agi': 9.8, '13.pac': 10.4, '14.pac': 11.6, '15.pac': 11.3,
  '2.pas': 8.9, '2.str': 13.7, '2.lin': 14.0, '4.lin': 14.3, '5.lin': 13.3, '6.str': 13.4, '7.str': 12.8,
  '9.pac': 10.1, '10.kic': 14.2, '11.pac': 12.2, '11.agi': 11.6, '11.han': 12.6, '13.pas': 11.6,
  '14.agi': 11.1, '14.han': 11.9,
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

// ---------------------------------------------------------------- familiarity

/**
 * THE SIDE'S OWN FAMILIARITY WITH A CALL (1.8.2). Drilling is the training
 * ground; this is the match: every match a call is in the playbook is a rep,
 * and a side that has run a move fifteen times runs it far better than one
 * running it for the first time (1 - e^(-reps/7.3): 13% after one match, 50%
 * after five, 87% after fifteen). It sharpens what a move gains when it comes
 * off; a misfire is the drilling's business and is not softened.
 *
 * An AI coach has run his philosophy's calls for years, so his side sits at
 * FAM_AI, which is exactly the move as it was before familiarity existed:
 * the world outside the manager's club plays the same rugby to the digit.
 */
export const FAM_K = 7.3
export const FAM_AI = 0.87

/** matches this club has run the call in: the playbook's reps, or on a save
 *  from before they were kept, this season's calls */
export function repsOf(club: Club, id: string): number {
  const pb = playbookOf(club)
  const v = pb.reps ? pb.reps[id] : pb.used[id]
  return Number.isFinite(v) ? Math.max(0, v as number) : 0
}

/** how familiar the side is with the call, 0..1 */
export function familiarityOf(state: GameState, club: Club, id: string): number {
  if (club.id !== state.userClubId) return FAM_AI
  return 1 - Math.exp(-repsOf(club, id) / FAM_K)
}

/** what familiarity does to a gain: 0.7 of it on the first run, all of it at
 *  the AI's familiarity, a shade more beyond */
export const famMult = (fam: number) => 0.7 + 0.3 * fam / FAM_AI

/** a drilled move with average men against a neutral defence is a small plus */
const Q_BASE = 0.15
const Q_FIT = 0.5
const Q_MATCH = 0.65

export interface MoveEdge {
  gain: number; q: number; quality: number; drilled: number; seen: number
  /** the side's familiarity with it, 0..1 */
  fam: number
  /** how far the opposition's defence has set itself for it, 0..1 */
  adapt: number
}

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
 *
 * Two more since 1.8.2 (armsrace.ts), both the manager's alone: `adapt`, how
 * far this week's opposition has set its defence for a call it has seen him
 * run on most of his first-phase ball (the matchup is pulled towards the
 * worst it can be), and the side's own familiarity with the call, which
 * scales a gain (famMult). An AI side's adapt is 0 and its familiarity
 * FAM_AI, and both leave its number exactly as it was.
 */
export function moveEdge(state: GameState, club: Club, id: string, fit: number, matchup: number, adapt = 0, famIn?: number): MoveEdge {
  const m = MOVE_BY_ID[id]
  if (!m) return { gain: 0, q: 0, quality: 0, drilled: 0, seen: 0, fam: 0, adapt: 0 }
  const drilled = drilledOf(state, club, id)
  const seen = playbookOf(club).used[id] ?? 0
  const familiar = Math.min(0.75, (seen / 20) * m.tell)
  const q = clamp((drilled - 60) / 40, -1, 1)
  const a = clamp(adapt, 0, 1)
  const mEff = a > 0 ? matchup * (1 - a) - a : matchup
  const quality = clamp(Q_BASE + Q_FIT * fit + Q_MATCH * mEff, -1, 1)
  let gain = q >= 0 ? m.peak * q * quality * (1 - familiar) : m.peak * q * (1 - familiar)
  const user = club.id === state.userClubId
  const fam = famIn ?? familiarityOf(state, club, id)
  if (user && gain > 0) gain *= famMult(fam)
  return { gain, q, quality, drilled, seen, fam, adapt: a }
}

/** The legs a club's moves cost, for the side's tempoF. The routine rule:
 *  a saving needs the competence, a cost is paid whether it comes off or not. */
export function moveTempoF(state: GameState, club: Club): number {
  const c = callsOf(state, club)
  let f = 1
  // a strike move is a share of the side's rugby, a shape most of it, and
  // a red-zone play a little of it
  const list: [string | undefined, number][] = c.main || c.alt || c.red
    ? [[c.main, 0.25], [c.alt, 0.25], [c.shape, 0.55], [c.red, 0.06]]
    : [[c.lineout, 0.25], [c.scrum, 0.25], [c.shape, 0.55]]
  for (const [id, sh] of list) {
    const m = id ? MOVE_BY_ID[id] : undefined
    if (!m || m.tempo === 1) continue
    const q = clamp((drilledOf(state, club, id!) - 60) / 40, -1, 1)
    const share = m.group === 'shape' ? 0.55 : sh
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

/** the hash that picks the primary or the secondary strike on a tick */
export const mixHash = (fxId: number, tick: number, home: boolean) => moveHash(fxId, tick, home ? 1 : 2, 0x6d6978)

/** The man a move is run through, by shirt, for the commentary: the loop is
 *  the 10's, the crash ball the 12's, the blindside wrap the 9's. */
export const MOVE_MAKER: Record<string, number> = {
  mv_1331: 9, mv_242: 10, mv_backdoor: 10, mv_crash: 12, mv_switch: 10, mv_loop: 10,
  mv_decoy: 10, mv_blind: 9, mv_inside: 10, mv_strike13: 13,
  mv_wingin: 10, mv_width: 10, mv_peel: 2, mv_maulswitch: 2, mv_tap: 9, mv_crashswing: 12,
  mv_loop9: 9, mv_crosskick: 10, mv_grubber: 10,
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
