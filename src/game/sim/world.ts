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
}

/** stage 1: two sides with no players, of the strengths given (1 is average) */
export function evenWorld(strength: [number, number] = [1, 1]): World {
  return {
    str: s => strength[s],
    carrier: () => '', tacklers: () => [], jackal: () => '', kicker: () => '', catcher: () => '',
    goalKicker: () => '', thrower: () => '', jumper: () => '', forward: () => '',
  }
}
