// WHO IS PLAYING (2.0.0 stage 2, docs/match-sim-spec.md section 3.3).
//
// The simulation asks the world two kinds of question: how strong is this
// side at this contest right now, and which player is doing it. Stage 1
// answered both with "an average side, nobody in particular" (evenWorld).
// Stage 2 answers them from the real team sheets (fromMatch.ts), so the
// manager's selection, tactics and bench are what decide the contests.
import type { Rng } from '../rng'

/** the contests a side's strength is asked for */
export type Contest =
  | 'carry'       // ball in hand going forward
  | 'tackle'      // stopping the carrier
  | 'breakdown'   // keeping or stealing the ball at the ruck
  | 'handling'    // passing and catching: fewer knock-ons
  | 'scrum'
  | 'lineout'
  | 'maul'
  | 'kicking'     // kicks from hand: distance and accuracy
  | 'aerial'      // under the high ball, chasing and catching
  | 'goal'        // kicks at goal
  | 'discipline'  // higher is cleaner: fewer penalties given away

/**
 * HOW A SIDE PLAYS (round 4, owner: "the games shouldn't feel repetitive").
 * Read by the simulation at every decision it makes for the side with the
 * ball (kick or run, tight or wide, drive the lineout, the corner or the
 * posts, tap or wait) and by the defence (line speed, width). 1 is the
 * average club everywhere; NEUTRAL_STYLE is a side with no club (the even
 * world). fromMatch.ts builds it from the old engine's own dials, styles,
 * zone plans and called moves.
 */
export interface PlayStyle {
  /** the attacking and defensive styles by name (styles.ts), for the record */
  atk: string
  def: string
  /** times the chance of kicking from hand, everywhere, and by zone: own 22, the middle, their 22 */
  kick: number
  kickZone: [number, number, number]
  /** times the weight of each kind of kick when a kick is chosen */
  kickMix: { box: number; long: number; touch: number; upAndUnder: number; grubber: number; crossField: number; chip: number; clearance: number }
  /** the chance a carry goes wide (0.30 is the average side) */
  width: number
  /** times the seconds a ruck takes (under 1 is quick ball) */
  tempo: number
  /** times the chance of an offload out of the tackle */
  offload: number
  /** times the chance of driving a lineout near their line, and of picking and going on it */
  maul: number
  pick: number
  /** the plan inside their 22 (the manager's zone plan): times the maul and the pick and go there,
   *  and times the chance a carry goes wide there. Only inside their 22, so not taken back off the
   *  side's carry elsewhere (COMP_*). Absent: 1 each. */
  in22?: { maul: number; pick: number; width: number }
  /** times a wide carry's edge and a tight one's (and a maul's): how the plan suits the squad. Absent: 1. */
  fit?: { wide: number; tight: number }
  /** 0..1: how often a kickable penalty in their 22 goes to the corner rather than the posts */
  corner: number
  /** times the chance of a quick tap or a quick lineout */
  quick: number
  /** the defence: -1 a drifting line .. 1 a blitz; -1 spread wide .. 1 narrow round the ruck */
  blitz: number
  narrow: number
  /** times the chance of a break off first-phase ball from a set piece, and the move called for it */
  launch: number
  launchMove?: string
  /** -2..2: this side's attack against the other side's defence (styles.ts MATCHUP) */
  matchup: number
  /** the old engine's own lean on this side's tries from its attack and the other side's defence (styles.ts) */
  tryF: number
  /** the same tick's lean on the penalties this side wins at the gain line, and on how often it is turned over */
  penF: number
  turnF: number
  /** how readily its men are carded (the aggression dial), 1 for the plain side */
  cards: number
  /** the captain on the field: -1 a poor leader .. 1 a fine one (his leadership rating), 0 for the plain side */
  lead: number
  /** how long the key partnerships have played together (9 and 10, the centres, the front row, the locks): -0.5 .. 0.5, 0 for the plain side */
  chem: number
  /** the defence style's own lean on the penalties it gives away (styles.ts DEF_FX penF: a blitz gives away more) */
  defPen: number
}

export const NEUTRAL_STYLE: PlayStyle = {
  atk: '', def: '', kick: 1, kickZone: [1, 1, 1],
  kickMix: { box: 1, long: 1, touch: 1, upAndUnder: 1, grubber: 1, crossField: 1, chip: 1, clearance: 1 },
  width: 0.30, tempo: 1, offload: 1, maul: 1, pick: 1, corner: 0.3, quick: 1, blitz: 0, narrow: 0, launch: 1, matchup: 0, tryF: 1, penF: 1, turnF: 1, cards: 1, lead: 0, chem: 0, defPen: 1,
}

/** THE MANAGER'S HAND (spec 1.2): what can change during a match. MatchSim.apply takes these. */
export type Decision =
  /** a different World from now on */
  | { kind: 'world'; world: World }
  /** one side stronger (factor above 1) or weaker from now on, at every contest or those named */
  | { kind: 'strength'; side: 0 | 1; factor: number; contests?: Contest[] }
  /** a standing penalty call for a side: 'ask' stops the match for the manager, 'auto' is the game's own */
  | { kind: 'penaltyCall'; side: 0 | 1; call: 'posts' | 'corner' | 'tap' | 'scrum' | 'ask' | 'auto' }
  /** a replacement (player ids as the World names them); made at the next dead ball. `injury`:
   *  forced, for a man already taken off hurt. `auto`: the game's own bench, not the manager's. */
  | { kind: 'substitution'; side: 0 | 1; off: string; on: string; injury?: boolean; auto?: boolean }
  /** a man hurt in play: off the field now, replaced at the next dead ball if the bench allows */
  | { kind: 'injury'; side: 0 | 1; who: string }
  /** whether the game runs a side's bench (on by default for both; the manager's own side off when he does it) */
  | { kind: 'bench'; side: 0 | 1; auto: boolean }
  /** the side's tactics changed: the fields given, as on the club's tactic */
  | { kind: 'tactics'; side: 0 | 1; set: Record<string, unknown> }
  /** a team talk: the half-time tone (teamtalk.ts HtTone), or with `pre` the pre-match one (PreTone),
   *  given before the kick-off */
  | { kind: 'talk'; side: 0 | 1; tone: string; pre?: boolean }

export interface World {
  /** side s's strength at a contest at clock second t. 1 is an average side in this game; 1.1 is clearly better. */
  str(s: 0 | 1, c: Contest, t: number): number
  /** the man carrying: a forward for a tight carry, a back for a wide one. Player id, or '' when nobody is named. */
  carrier(s: 0 | 1, wide: boolean, rng: Rng): string
  /** the one or two men making the tackle */
  tacklers(s: 0 | 1, wide: boolean, rng: Rng): string[]
  /** the man over the ball at the ruck for the defending side */
  jackal(s: 0 | 1, rng: Rng): string
  /** the man kicking from hand (scrum-half for a box kick, fly-half or full-back otherwise) */
  kicker(s: 0 | 1, box: boolean, rng: Rng): string
  /** the man under a kick for the receiving side */
  catcher(s: 0 | 1, rng: Rng): string
  goalKicker(s: 0 | 1): string
  thrower(s: 0 | 1): string
  jumper(s: 0 | 1, rng: Rng): string
  /** a forward in the scrum or maul who is penalised or drives it over */
  forward(s: 0 | 1, rng: Rng): string
  /** told that a man has been carded, so he is off the field: until = the clock second he returns, Infinity for a red */
  carded?(s: 0 | 1, id: string, until: number): void
  /** THE KICKER'S OWN CHANCE, when the world knows him: side s's goal kicker
   *  now, from an average spot, for a conversion or a penalty. `lead` is the
   *  side's lead on the scoreboard (nerve late on). Without it the simulation
   *  works the chance out from str(s, 'goal'). */
  goalP?(s: 0 | 1, kind: 'con' | 'pen', t: number, lead: number): number
  /** a substitution, a tactics change or a team talk, made at clock second t on the World's own
   *  sides: '' when it is done, else why not. A World without it has no bench and no dials. */
  decide?(d: Decision, t: number, score?: [number, number]): string
  /** how each side plays (absent: NEUTRAL_STYLE) */
  style?(s: 0 | 1): PlayStyle
  /** the day's weather (model Weather: 'Dry' | 'Damp' | 'Rain' | 'Wind' | 'Snow') */
  weather?: string
  /** the men in shirts 1 to 15 ('' for an empty shirt), whether each is off the field now (bin,
   *  sent off, hurt), and the bench by shirt (16 up, '' when he has been used) */
  lineup?(s: 0 | 1): { field: string[]; off: boolean[]; bench: string[] }
  /** a new match on the same World: every man back in his kick-off shirt, the bin empty */
  newMatch?(): void
  /** the manager's own side, whose bench the game leaves to him (MatchSim starts with it off) */
  managed?: 0 | 1 | null
  /** ONE MAN AGAINST ANOTHER: the named man's own carrying, tackling, kicking, handling and rucking
   *  at clock second t, against his own side's average man (1), with his form, his condition and his
   *  legs (tired now, or fresh off the bench) in it. Absent: every man is his side. */
  man?(s: 0 | 1, id: string, t: number): ManForm
  /** the side's legs: the average tank of its fifteen now, 0 to 1 (absent: nobody tires) */
  legs?(s: 0 | 1, t: number): number
}

/** a man against his own side's average, at each thing he can be asked to do (1 is his side's average) */
export interface ManForm { carry: number; tackle: number; kick: number; hands: number; ruck: number; legs: number
}

/** stage 1: two sides with no players, of the strengths given (1 is average) */
export function evenWorld(strength: [number, number] = [1, 1]): World {
  return {
    str: s => strength[s],
    carrier: () => '', tacklers: () => [], jackal: () => '', kicker: () => '', catcher: () => '',
    goalKicker: () => '', thrower: () => '', jumper: () => '', forward: () => '',
  }
}
