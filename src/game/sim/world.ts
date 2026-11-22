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

/** THE MANAGER'S HAND (spec 1.2): what can change during a match. MatchSim.apply takes these. */
export type Decision =
  /** a different World from now on */
  | { kind: 'world'; world: World }
  /** one side stronger (factor above 1) or weaker from now on, at every contest or those named */
  | { kind: 'strength'; side: 0 | 1; factor: number; contests?: Contest[] }
  /** a standing penalty call for a side: 'ask' stops the match for the manager, 'auto' is the game's own */
  | { kind: 'penaltyCall'; side: 0 | 1; call: 'posts' | 'corner' | 'tap' | 'scrum' | 'ask' | 'auto' }
  /** a replacement (player ids as the World names them); made at the next dead ball */
  | { kind: 'substitution'; side: 0 | 1; off: string; on: string }
  /** the side's tactics changed: the fields given, as on the club's tactic */
  | { kind: 'tactics'; side: 0 | 1; set: Record<string, unknown> }
  /** a team talk (half-time tone, as the game's own talks) */
  | { kind: 'talk'; side: 0 | 1; tone: string }

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
  decide?(d: Decision, t: number): string
}

/** stage 1: two sides with no players, of the strengths given (1 is average) */
export function evenWorld(strength: [number, number] = [1, 1]): World {
  return {
    str: s => strength[s],
    carrier: () => '', tacklers: () => [], jackal: () => '', kicker: () => '', catcher: () => '',
    goalKicker: () => '', thrower: () => '', jumper: () => '', forward: () => '',
  }
}
