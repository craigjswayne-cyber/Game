// THE MATCH RECORD (2.0.0, docs/match-sim-spec.md section 2).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics." The engine wrote lines about a match it had not
// played, and the pitch acted them out. The new simulation plays the match
// and writes one entry for each thing that happens. The commentary, the
// plates, the stats and the pitch all read these entries and nothing else,
// so they cannot disagree.
//
// Entries carry the side, the place, the clock and the result, and, when the
// simulation is given real team sheets (fromMatch.ts), the players involved.

export type PlayKind =
  // restarts
  | 'kickoff' | 'dropout22' | 'goalLineDropout' | 'scrum' | 'lineout' | 'tap'
  // open play
  | 'carry' | 'offload' | 'ruck' | 'maul' | 'lineBreak' | 'kick' | 'catch'
  // stoppages
  | 'knockOn' | 'forwardPass' | 'notStraight' | 'unplayable' | 'restartError' | 'intoTouch' | 'outOnFull' | 'deadBall' | 'heldUp' | 'penalty' | 'freeKick'
  // scores
  | 'try' | 'penaltyTry' | 'conversion' | 'penaltyGoal' | 'dropGoal'
  // officials and the bench
  | 'yellowCard' | 'redCard' | 'halfTime' | 'fullTime' | 'substitution' | 'injury'

/** the manager's call at a penalty (and the game's own, which is the same choice) */
export type PenaltyCall = 'posts' | 'corner' | 'tap' | 'scrum'

export type KickType = 'box' | 'upAndUnder' | 'grubber' | 'long' | 'clearance' | 'touch' | 'restart' | 'crossField' | 'chip'

export interface Play {
  /** order in the match */
  n: number
  /** seconds since the kick-off when this entry ends. Always goes forward, through half-time too:
   *  it is what the pitch schedules on. (Before 21 Nov it went back to 2400 at half-time.) */
  t: number
  /** the referee's clock when it ends, in seconds: the second half starts at 2400 however long the
   *  first ran over. What a screen shows as the minute. Optional only for records made before it. */
  clock?: number
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
  /** the main player, by id: the carrier, the kicker, the thrower, the man carded ('' or absent when nobody is named) */
  who?: string
  /** the players against him: the tacklers, the man who stole it */
  vs?: string[]
  /** the players with him: the jumper, the man who took the pass */
  with?: string[]
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
  /** seconds of dead time BEFORE it (the sides walking to a scrum or a lineout, and every reset) */
  pre?: number
  /** a scrum: how many times it was reset before it went */
  resets?: number
  /** a pass or a run of passes before a carry: how many hands it went through (with[0] is the man who
   *  gave the last pass, when he is named) */
  passes?: number
  /** a kick: where it came down, [x, y] in metres (in touch, y is 0 or 70) */
  land?: [number, number]
  /** a penalty or free kick: what it was for (for example 'handsInRuck', 'offside', 'notRollingAway',
   *  'highTackle', 'holdingOn', 'sealingOff', 'obstruction', 'collapsing', 'standingUp', 'notBinding',
   *  'earlyEngagement', 'collapsingMaul', 'offsideAtLineout', 'closingTheGap', 'offsideAtKick',
   *  'notReleasing'); a refused substitution: why */
  cause?: string
  /** a penalty or free kick: the man who gave it away (of the other side) */
  offender?: string
  /** a yellow card: the second (Play.t) he comes back */
  until?: number
  /** a carry: the shape it was run in ('pickAndGo' on their line, 'launch' off first-phase set-piece
   *  ball, 'offload' the man who took an offload running on), and the called move it came from */
  shape?: string
  move?: string
  /** a carry run in a shape: the men the ball went through before him, in order (with[0] is the last of them) */
  via?: string[]
  /** a catch: the kick was chased and contested in the air */
  contested?: boolean
  /** WHERE THE BALL ENDED, TRULY OUT, on every boundary event (kick to touch, out on the full, into
   *  touch, dead ball): past the touchline (y below 0 or above 70) or past the dead-ball line (x below
   *  -8 or above 108; the in-goal is 8 m deep). A ball touched down in-goal has its in-goal spot here.
   *  The play's own x and y stay on the field's edge (0 to 100, 0 to 70), where the restart is taken from. */
  out?: [number, number]
  /** a ruck that is recycled: quick ball (under about three seconds) or slow */
  speed?: 'quick' | 'slow'
  /** a penalty: the referee has had the offending side's captain over: one more and a man goes
   *  (the side is one short of his limit for repeat offences, RefereeView.warnAt) */
  warning?: boolean
  /** a lineout: the call, where the throw went ('front', 'middle', 'tail') */
  option?: string
  /** a kick from hand or at goal in a real wind: with it at his back, or into it */
  wind?: 'with' | 'into'
  /** a line break: the defender he beat (a missed tackle) */
  beat?: string[]
  /** the play that carries out a penalty option (penaltyGoal, kick/penaltyToTouch, tap, scrum): the
   *  call made, and who made it ('manager' answering the prompt, 'standing' his standing order,
   *  'captain' the side's own call on a managed side). Absent on a side nobody manages: callBy.
   *  On a substitution for an injury, callBy 'manager' when he chose the man who came on. */
  call?: PenaltyCall
  callBy?: 'manager' | 'standing' | 'captain'
  /** the first play after a tactics change took effect: the fields set, and what they were */
  tactics?: { side: 0 | 1; set: Record<string, unknown>; was: Record<string, unknown> }
  /** the first play after a side nobody manages changed how it plays for the state of the game:
   *  mode 'exploitShort' (a man up: wide and quick), 'chase' (behind late: running, the corner),
   *  'protect' (ahead late: kicking, the posts), 'wet' (rain: tight, kicking); reason 'manUp',
   *  'chasing', 'protecting', 'wetBall'. Written once each time it changes. */
  coach?: { side: 0 | 1; mode: string; reason: string }
  /** a kick-off after a team talk: the tone (pre: the pre-match talk, on the first kick-off) */
  talk?: { side: 0 | 1; tone: string; pre?: boolean }
  /** the score after it */
  score: [number, number]
}

export interface SimResult {
  plays: Play[]
  score: [number, number]
  tries: [number, number]
  /** the side the user manages, when one is */
  managed?: 0 | 1
  /** the duels of the match, counted off the plays (skeleton.ts duelsOf) */
  duels?: import('./skeleton').Duels
  /** the day: the weather and the wind (strength 0 to 1, the end it blows towards in the first half,
   *  1 = towards x 100, behind the home side) */
  conditions?: { weather: string; wind: { strength: number; toward: 0 | 1 }; hot?: boolean }
  /** the referee and what he is hot on (world.ts RefereeView) */
  referee?: import('./world').RefereeView
}
