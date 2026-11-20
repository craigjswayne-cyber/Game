// THE MATCH RECORD (2.0.0, docs/match-sim-spec.md section 2).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics." The engine wrote lines about a match it had not
// played, and the pitch acted them out. The new simulation plays the match
// and writes one entry for each thing that happens. The commentary, the
// plates, the stats and the pitch all read these entries and nothing else,
// so they cannot disagree.
//
// STAGE 1: the skeleton. Entries carry the side, the place, the clock and
// the result. The players (who, vs, with) arrive in stage 2.

export type PlayKind =
  // restarts
  | 'kickoff' | 'dropout22' | 'goalLineDropout' | 'scrum' | 'lineout' | 'tap'
  // open play
  | 'carry' | 'ruck' | 'maul' | 'lineBreak' | 'kick' | 'catch'
  // stoppages
  | 'knockOn' | 'forwardPass' | 'notStraight' | 'unplayable' | 'restartError' | 'intoTouch' | 'outOnFull' | 'deadBall' | 'heldUp' | 'penalty' | 'freeKick'
  // scores
  | 'try' | 'conversion' | 'penaltyGoal' | 'dropGoal'
  // officials
  | 'yellowCard' | 'redCard' | 'halfTime' | 'fullTime'

export type KickType = 'box' | 'upAndUnder' | 'grubber' | 'long' | 'clearance' | 'touch' | 'restart'

export interface Play {
  /** order in the match */
  n: number
  /** the match clock, in seconds of the eighty minutes (the clock stops for nothing in the skeleton) */
  t: number
  kind: PlayKind
  /** the side this entry is about: 0 home, 1 away */
  side: 0 | 1
  /** the side with the ball when it ends */
  ball: 0 | 1
  /** where it ends, in metres: x 0 at the home side's own line to 100, y 0 to 70 */
  x: number
  y: number
  /** what came of it, in one word the commentary and the pitch can switch on */
  result: string
  /** metres made up the field by the side with the ball */
  gain?: number
  /** the count of phases in this possession */
  phase?: number
  kick?: KickType
  /** a kick at goal or a conversion: over or not */
  good?: boolean
  /** seconds of ball in play this entry used, and seconds of dead time after it */
  live: number
  dead: number
  /** the score after it */
  score: [number, number]
}

export interface SimResult {
  plays: Play[]
  score: [number, number]
  tries: [number, number]
}
