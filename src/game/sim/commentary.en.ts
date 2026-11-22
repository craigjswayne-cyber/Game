// THE COMMENTARY IN ENGLISH (2.0.0, docs/match-sim-spec.md sections 2 and 7).
//
// Every line commentary.ts writes is a key and its values. The words live
// here, one list per line, so a re-run picks the same wording (the choice is
// made from the play's index) and the other five languages can be added
// later, key for key. A key is 'sim.' + the base + the wording's number, in
// the style of the game's 'comm.pen1' lines: 'sim.kickTouch2'.
//
// Placeholders:
//   {team} the side the line is about, {opp} the other side
//   {player} {player2} men of {team}; {oppPlayer} a man of {opp}
//   {home} {away} {hs} {as} the score, home first, as the record has it
//   {m} metres, {d} metres from the line, {phase}, {pct}, {men}, {count}
//   {cause_k} what a penalty was for ('sim.causeSealingOff1': "sealing off"), from Play.cause
//   a placeholder ending in _k holds another key ('sim.zoneOppEnd1'), which is
//   put into words first.
// No pronouns for the players: the game has women's sides, and "he" or "she"
// would need a second key for each line ('_f' in the game's other files).
// A wording is only used when every man it names is named in the record, so
// each line has at least one wording with no player in it.

export const SIM_EN: Record<string, string[]> = {
  // ---- where, from the side's own end ----
  zoneOwnEnd: ['in their own 22'],
  zoneOwnHalf: ['in their own half'],
  zoneOppHalf: ['in the {opp} half'],
  zoneOppEnd: ['inside the {opp} 22'],
  causeHandsInRuck: [
    'hands in the ruck',
  ],
  causeOffside: [
    'being offside',
  ],
  causeNotRollingAway: [
    'not rolling away',
  ],
  causeHighTackle: [
    'a high tackle',
  ],
  causeHoldingOn: [
    'holding on',
  ],
  causeSealingOff: [
    'sealing off',
  ],
  causeObstruction: [
    'obstruction',
  ],
  causeCollapsing: [
    'collapsing',
  ],
  causeStandingUp: [
    'standing up',
  ],
  causeNotBinding: [
    'not binding',
  ],
  causeEarlyEngagement: [
    'engaging early',
  ],
  causeCollapsingMaul: [
    'collapsing the maul',
  ],
  causeOffsideAtLineout: [
    'being offside at the lineout',
  ],
  causeClosingTheGap: [
    'closing the gap',
  ],
  causeOffsideAtKick: [
    'being offside at the kick',
  ],
  causeNotReleasing: [
    'not letting the ball go in the tackle',
  ],

  // ---- restarts ----
  koStart: [
    '{team} get the match under way.',
    '{player} kicks off for {team}, and we are under way.',
    'Under way: {player} gets the match started for {team}.',
  ],
  koSecond: [
    '{team} get the second half under way.',
    '{player} kicks off the second half for {team}.',
  ],
  koAfterScore: [
    '{team} restart from halfway.',
    '{player} restarts for {team}.',
    'Back to halfway: {player} kicks off for {team}.',
  ],
  restartNotTen: [
    'The {team} kick-off does not go ten metres.',
    '{team} kick off short: it does not make the ten metres.',
    'Short from {player}: the kick-off does not go ten metres.',
  ],
  restartOut: [
    'The {team} kick-off goes straight out on the full.',
    '{player} kicks off and it goes straight out, on the full.',
  ],
  dropDead: [
    '22 drop-out to {team}: the {opp} kick went dead.',
    'The {opp} kick ran dead, so {team} restart with a 22 drop-out.',
    'The {opp} kick ran dead. {player} takes the 22 drop-out for {team}.',
  ],
  dropPenMiss: [
    '22 drop-out to {team} after the missed penalty.',
    'The penalty missed, so {team} restart from their 22.',
    'The penalty missed. {player} restarts from the 22 for {team}.',
  ],
  dropDropMiss: [
    '22 drop-out to {team} after the missed drop goal.',
    '{player} takes the 22 drop-out for {team} after the missed drop goal.',
  ],
  dropOut: [
    '22 drop-out to {team}.',
    '{player} takes the 22 drop-out for {team}.',
  ],
  dropGlHeld: [
    'Goal-line drop-out to {team} after holding {opp} up.',
    '{team} held them up, so it is a goal-line drop-out to {team}.',
    '{team} held them up. {player} restarts from the goal line.',
  ],
  dropGlTouched: [
    'Goal-line drop-out to {team}, who touched the {opp} kick down in their in-goal.',
    '{team} touched the {opp} kick down, so {player} restarts from the goal line.',
  ],
  dropGl: [
    'Goal-line drop-out to {team}.',
    '{player} takes the goal-line drop-out for {team}.',
  ],

  // ---- catches ----
  catchKo: [
    '{team} gather the kick-off.',
    '{player} takes the kick-off for {team}.',
    'Safe hands from {player} under the kick-off.',
  ],
  regatherKo: [
    '{team} win their own kick-off back!',
    '{player} goes up and wins the kick-off back for {team}!',
  ],
  catchKick: [
    '{team} gather it.',
    '{player} fields it for {team}.',
    'Safe under it is {player}.',
    '{player} takes the kick.',
  ],
  regatherKick: [
    '{team} win the kick back!',
    '{player} wins it back in the air for {team}!',
    'Great chase: {player} takes it back for {team}.',
  ],
  catchDrop: [
    '{team} take the drop-out.',
    '{player} takes the drop-out for {team}.',
  ],
  regatherDrop: [
    '{team} win their own drop-out back!',
    '{player} regathers the drop-out for {team}!',
  ],
  chargeRegather: [
    '{team} are first to the loose ball.',
    '{player} is first to the loose ball for {team}.',
  ],

  // ---- open play ----
  carryBig: [
    '{team} make {m} metres with that carry.',
    '{player} makes {m} metres for {team}.',
    'Good carry from {player}: {m} metres.',
    '{player2} gives it to {player}, who makes {m} metres.',
    '{player} takes the pass from {player2} and makes {m} metres for {team}.',
  ],
  carryBack: [
    '{opp} drive {team} back in the tackle.',
    'Big hit! {oppPlayer} drives {player} back.',
    '{oppPlayer} wins that collision and puts {player} on the floor.',
  ],
  carryTouch: [
    '{team} are bundled into touch.',
    '{player} is bundled into touch by {oppPlayer}.',
    '{player} runs out of room and is put into touch.',
  ],
  intercepted: [
    'Intercepted! {opp} pick it off.',
    'Intercepted! {oppPlayer} picks off the pass meant for {player}.',
    '{oppPlayer} reads it and steps in front of {player}. Intercepted!',
  ],
  phases: [
    '{team} are through {phase} phases, {zone_k}.',
    '{phase} phases now for {team}, {zone_k}.',
    'Patient from {team}: {phase} phases, {zone_k}.',
  ],
  turnover: [
    'Turnover at the ruck! {opp} win it.',
    'Turnover! {oppPlayer} gets over the ball and wins it for {opp}.',
    '{oppPlayer} steals it at the ruck. {opp} have the ball.',
    'Brilliant from {oppPlayer}: turnover for {opp}.',
  ],
  breakClean: [
    '{team} are through! A clean break.',
    '{player} is through! A clean break for {team}.',
    'Line break! {player} is away for {team}.',
    'Line break! {player2} sends {player} through for {team}.',
  ],
  breakHauled: [
    '{team} break the line and make {m} metres before {opp} get back.',
    'Line break! {player} makes {m} metres before {oppPlayer} brings it down.',
    '{player} is through the line for {team}, {m} metres, and {oppPlayer} makes the tackle.',
    '{player2} puts {player} through the line! {m} metres before {oppPlayer} makes the tackle.',
  ],
  breakLastGasp: [
    'What a tackle! {team} break clear but {opp} stop it {d} metres short.',
    'Try-saver! {player} breaks clear and {oppPlayer} hauls it down {d} metres short.',
    '{player} is through, but {oppPlayer} gets back and stops it {d} metres from the line!',
  ],
  interceptRun: [
    '{team} are away with the interception!',
    '{player} is away with the interception!',
    '{player} has the interception and nobody will catch {team} now.',
  ],
  interceptHauled: [
    '{team} run the interception back before {opp} get across, {zone_k}.',
    '{player} runs the interception back before {oppPlayer} makes the tackle, {zone_k}.',
  ],
  forwardPass: [
    'Forward pass by {team}.',
    'The pass from {player} to {player2} is forward.',
    'Forward! {player} throws it forward to {player2}.',
  ],
  unplayableRuck: [
    'The ball will not come out of the {team} ruck. Scrum.',
    'Unplayable at the ruck: the referee calls a scrum.',
  ],
  unplayableMaul: [
    'The {team} maul has stopped and the ball will not come out. Scrum.',
  ],

  // ---- knock-ons ----
  koKnock: [
    '{team} knock on under the kick-off.',
    '{player} knocks on under the kick-off.',
  ],
  highKnock: [
    '{team} spill the high ball. Knock-on.',
    '{player} spills the high ball. Knock-on.',
    'Under pressure in the air, {player} knocks it on.',
  ],
  chaseKnock: [
    '{team} knock on chasing their own kick.',
    '{player} knocks on chasing the kick.',
  ],
  contactKnock: [
    'Knock-on by {team} in the tackle.',
    '{player} is tackled by {oppPlayer} and knocks on.',
    '{player} loses it in contact. Knock-on.',
  ],

  // ---- kicks from hand ----
  kickBox: [
    '{team} box kick.',
    '{player} puts up a box kick.',
    'Box kick from {player}.',
  ],
  kickLong: [
    '{team} kick long.',
    '{player} kicks long downfield, {m} metres.',
    'Long kick from {player}.',
  ],
  kickHigh: [
    '{team} put up a high ball.',
    '{player} hoists a high ball.',
    'Up and under from {player}.',
  ],
  kickGrubber: [
    '{team} roll a grubber in behind.',
    '{player} rolls a grubber in behind.',
  ],
  kickOther: [
    '{team} kick it downfield.',
    '{player} kicks it downfield.',
  ],
  kickTouch: [
    '{team} find touch, {m} metres.',
    '{player} finds touch, {m} metres up the field.',
    'Good kick from {player}: into touch, {m} metres on.',
  ],
  penTouch: [
    '{team} kick the penalty to touch, {m} metres.',
    '{player} kicks the penalty to touch, {m} metres on.',
    '{player} puts the penalty into touch, {zone_k}.',
  ],
  fiftyTwentyTwo: [
    '50:22! {team} kick from their own half and it bounces out inside the {opp} 22.',
    '50:22 from {player}! From their own half, it bounces out inside the {opp} 22.',
  ],
  outFull: [
    '{team} kick it out on the full.',
    'Out on the full from {player}.',
    '{player} kicks it straight out without a bounce.',
  ],
  kickDead: [
    '{team} kick it too far, into the in-goal.',
    '{player} kicks it through into the in-goal.',
  ],
  chargedDown: [
    'Charged down! {opp} get to the {team} kick.',
    '{player} kicks and {oppPlayer} charges it down!',
    'Charge-down! {oppPlayer} blocks the kick from {player}.',
  ],
  bouncedOut: [
    'The {team} kick bounces into touch.',
    'The kick from {player} bounces into touch.',
  ],
  ranDead: [
    'It runs over the dead-ball line.',
    'Too long: it runs dead.',
  ],
  touchedDown: [
    '{opp} touch it down in their in-goal.',
  ],
  freeKickKick: [
    '{team} kick the free kick.',
  ],

  // ---- set pieces ----
  scrumKnock: [
    'Scrum to {team} for the {opp} knock-on.',
    '{opp} knocked on, so it is a {team} put-in.',
  ],
  scrumForward: [
    'Scrum to {team} for the forward pass.',
    'Forward pass by {opp}: {team} put in.',
  ],
  scrumNotStraight: [
    'Scrum to {team}: the {opp} throw was not straight.',
  ],
  scrumUnplayable: [
    'Scrum to {team}, as the ball would not come out.',
  ],
  scrumRestart: [
    'Scrum on halfway to {team} after the poor {opp} restart.',
  ],
  scrumChoice: [
    '{team} choose a scrum from the penalty.',
    'From the penalty, {team} want a scrum.',
  ],
  scrum: ['Scrum to {team}.'],
  scrumAgainstHead: [
    'Against the head! {opp} shove {team} off their own ball.',
    '{opp} win it against the head!',
    'Against the head! {oppPlayer} and the {opp} pack shove {team} off their own ball.',
  ],
  scrumFree: [
    'The referee has seen something at the scrum: free kick.',
  ],
  loTouch: [
    'Lineout to {team}, after the {opp} kick to touch.',
    '{opp} kicked it out, so it is a {team} throw.',
  ],
  loPen: [
    '{team} throw in, after kicking the penalty to touch.',
    'Lineout to {team}: their throw, as it was a penalty kicked to touch.',
  ],
  loFifty: [
    '{team} throw in after the 50:22.',
    'The 50:22 gives {team} the throw.',
  ],
  loFull: [
    'Lineout to {team}, back where {opp} kicked it out on the full.',
    '{opp} kicked it out on the full, so {team} throw in from where it was kicked.',
  ],
  loBounced: [
    'Lineout to {team}: the {opp} kick bounced into touch.',
  ],
  loCarried: [
    'Lineout to {team}: {opp} were put into touch.',
    '{opp} were bundled out, so it is a {team} throw.',
  ],
  loFreeTouch: [
    'Lineout to {team}: {opp} kicked the free kick to touch.',
  ],
  lo: ['Lineout to {team}.'],
  loWon: [
    '{team} win their own ball.',
    '{player2} takes the throw from {player}.',
    '{player} finds {player2} at the lineout.',
  ],
  loStolen: [
    'Stolen! {opp} take the {team} throw.',
    'Stolen! {oppPlayer} picks off the throw from {player}.',
    '{oppPlayer} steals the {team} lineout!',
  ],
  loNotStraight: [
    'The {team} throw is not straight.',
    'Not straight from {player}.',
  ],
  loPenalty: [
    'The referee blows at the lineout.',
    '{player} throws in, and the referee blows.',
  ],
  maulOut: [
    '{team} drive the maul {m} metres and use it.',
    'The {team} maul rumbles on {m} metres.',
    '{team} drive the maul {m} metres, and {player} at the back uses it.',
  ],
  maulNoGain: [
    'The {team} maul goes nowhere, and they use the ball.',
    'The {team} maul goes nowhere, and {player} at the back uses it.',
  ],
  maulOver: [
    'The {team} maul is driven over the line!',
    '{team} drive the maul over the line!',
    '{team} drive the maul over the line, {player} at the back!',
  ],
  maulDown: [
    '{opp} pull the {team} maul down.',
    '{oppPlayer} pulls the {team} maul down.',
    '{oppPlayer} pulls down the {team} maul, with {player} at the back.',
  ],

  // ---- penalties and free kicks ----
  penRuckDef: [
    'Penalty to {team} at the breakdown, {zone_k}.',
    'Penalty to {team} at the breakdown, {zone_k}, for {cause_k}.',
    '{oppPlayer} is penalised at the breakdown for {cause_k}. Penalty to {team}, {zone_k}.',
    'Penalty to {team}, {zone_k}: {oppPlayer} is pinged for {cause_k} at the breakdown.',
  ],
  penRuckAtt: [
    'Penalty to {team} at the breakdown, {zone_k}.',
    'Penalty to {team} at the breakdown, {zone_k}, for {cause_k}.',
    '{player} gets over the ball and {oppPlayer} is penalised for {cause_k}. Penalty to {team}, {zone_k}.',
    'Penalty to {team} at the breakdown, {zone_k}: {oppPlayer} is penalised for {cause_k}.',
  ],
  penScrum: [
    'Penalty to {team} at the scrum, {zone_k}.',
    'Penalty to {team} at the scrum, {zone_k}, for {cause_k}.',
    '{oppPlayer} is penalised for {cause_k} at the scrum. Penalty to {team}, {zone_k}.',
    'Penalty to {team} at the scrum, {zone_k}: {oppPlayer}, {cause_k}.',
  ],
  penMaul: [
    'Penalty to {team}, {zone_k}: {opp} pulled the maul down.',
    'Penalty to {team}, {zone_k}: {oppPlayer} pulled the maul down.',
    'Penalty to {team}, {zone_k}: {oppPlayer} is penalised for {cause_k}.',
  ],
  penLineout: [
    'Penalty to {team} at the lineout, {zone_k}.',
    'Penalty to {team} at the lineout, {zone_k}, for {cause_k}.',
    'Penalty to {team} at the lineout, {zone_k}: {oppPlayer} is penalised for {cause_k}.',
  ],
  penKick: [
    'Penalty to {team} as the kick comes down, {zone_k}.',
    'Penalty to {team} after the kick, {zone_k}, for {cause_k}.',
    'Penalty to {team} after the kick, {zone_k}: {oppPlayer} is penalised for {cause_k}.',
    'As the kick comes down, {oppPlayer} is penalised for {cause_k}. Penalty to {team}, {zone_k}.',
  ],
  pen: [
    'Penalty to {team}, {zone_k}.',
    'Penalty to {team}, {zone_k}, for {cause_k}.',
    'Penalty to {team}, {zone_k}: {oppPlayer} is penalised for {cause_k}.',
  ],
  freeScrum: [
    'Free kick to {team} at the scrum.',
    'Free kick to {team} at the scrum, for {cause_k}.',
    'Free kick to {team} at the scrum: {oppPlayer} is penalised for {cause_k}.',
  ],
  freeLineout: [
    'Free kick to {team} at the lineout.',
    'Free kick to {team} at the lineout, for {cause_k}.',
    'Free kick to {team} at the lineout: {oppPlayer} is penalised for {cause_k}.',
  ],
  free: [
    'Free kick to {team}.',
    'Free kick to {team}, for {cause_k}.',
  ],
  tapPen: [
    '{team} tap the penalty and go!',
    'Quick tap from {team}!',
    '{player} taps the penalty and goes for {team}!',
    'Quick tap from {player}!',
  ],
  tapFree: [
    '{team} take the free kick quickly.',
    '{player} takes the free kick quickly for {team}.',
  ],

  // ---- cards ----
  yellowCynical: [
    'Yellow card for {team}: a cynical offence. Ten minutes in the bin, and {team} are down to {men}.',
    'Yellow card! {player} goes to the bin for ten minutes for a cynical offence. {team} down to {men}.',
  ],
  yellowFoul: [
    'Yellow card for {team} for foul play. Ten minutes in the bin, and {team} are down to {men}.',
    'Yellow card! {player} is sent to the bin for ten minutes for foul play. {team} down to {men}.',
  ],
  yellowPenTry: [
    'Yellow card for {team} for stopping a try illegally. Ten minutes in the bin, and {team} are down to {men}.',
    'Yellow card! {player} goes to the bin for ten minutes for stopping a try illegally. {team} down to {men}.',
  ],
  red: [
    'Red card for {team}! Sent off for foul play. {team} are down to {men} for the rest of the match.',
    'Red card! {player} is sent off for foul play. {team} down to {men} for the rest of the match.',
  ],
  binBack: [
    '{team} are back to {men}.',
    'The ten minutes are up: {team} are back to {men}.',
  ],
  subMade: [
    'Change for {team}: {player2} comes on for {player}.',
    '{team} make a change: {player} off, {player2} on.',
  ],
  subRefused: [
    '{team} want to bring {player2} on for {player}, but the change is not allowed.',
  ],

  // ---- scores ----
  tryClose: [
    'TRY! {team} go over from close range.',
    'TRY! {player} goes over from close range for {team}.',
    'TRY! {player} powers over for {team}.',
    'TRY! {player2} puts {player} over from close range for {team}.',
    'TRY! {player} takes the pass from {player2} and powers over for {team}.',
  ],
  tryWide: [
    'TRY! {team} finish it out wide.',
    'TRY! {player} finishes out wide for {team}.',
    'TRY! {player2} gives the scoring pass and {player} finishes out wide for {team}.',
    'TRY! {player} takes the pass from {player2} and finishes out wide for {team}.',
  ],
  tryBreak: [
    'TRY! {team} run it in.',
    'TRY! {player} runs it in for {team}.',
    'TRY! Nobody can catch {player}. Over for {team}.',
    'TRY! {player} takes the pass from {player2} and runs it in for {team}.',
  ],
  tryMaul: [
    'TRY! {team} touch down off the drive.',
    'TRY! {team} drive it over and {player} touches down.',
  ],
  tryCharge: [
    'TRY! {team} score off the charge-down.',
    'TRY! {player} scores off the charge-down for {team}.',
  ],
  tryInterception: [
    'TRY! {team} score from the interception.',
    'TRY! {player} runs in the interception for {team}.',
    'TRY! {player} goes the distance with the interception for {team}.',
  ],
  tryAgain: [
    'That is try number {count} for {player}.',
  ],
  penaltyTry: [
    'PENALTY TRY to {team}! Seven points, no conversion. {home} {hs}, {away} {as}.',
    'The referee runs under the posts: penalty try to {team}. {home} {hs}, {away} {as}.',
  ],
  heldUp: [
    'Held up! {team} are over the line but cannot get it down.',
    'Held up! {player} is over the line, but {opp} keep the ball off the ground.',
    '{player} goes over, but it is held up!',
  ],
  heldUpMaul: [
    'The {team} maul goes over, but it is held up!',
    'The {team} maul goes over, but {player} is held up!',
  ],
  conOver: [
    '{team} convert. {home} {hs}, {away} {as}.',
    '{player} converts. {home} {hs}, {away} {as}.',
    '{player} adds the extras. {home} {hs}, {away} {as}.',
  ],
  conWide: [
    '{team} miss the conversion. {home} {hs}, {away} {as}.',
    '{player} misses the conversion. {home} {hs}, {away} {as}.',
    'Wide from {player}. {home} {hs}, {away} {as}.',
  ],
  penAim: [
    '{team} go for the posts, {m} metres out.',
    '{team} point to the posts. {player} from {m} metres.',
    '{player} lines up the penalty for {team}, {m} metres out.',
  ],
  penOver: [
    'Over! {home} {hs}, {away} {as}.',
    '{player} kicks it. {home} {hs}, {away} {as}.',
    'Good kick from {player}. Three points. {home} {hs}, {away} {as}.',
  ],
  penWide: [
    'Wide. No points. {home} {hs}, {away} {as}.',
    '{player} pushes it wide. {home} {hs}, {away} {as}.',
  ],
  dropOver: [
    'DROP GOAL! {team} slot it over from {m} metres. {home} {hs}, {away} {as}.',
    'DROP GOAL! {player} slots it over from {m} metres for {team}. {home} {hs}, {away} {as}.',
  ],
  dropWide: [
    '{team} try a drop goal from {m} metres, but it goes wide.',
    '{player} tries a drop goal from {m} metres, but it goes wide.',
  ],
  run: [
    '{team} have scored {count} points without reply.',
    'That is {count} unanswered points for {team}.',
  ],

  // ---- the clock ----
  halfTime: [
    'Half-time. {home} {hs}, {away} {as}.',
    'The referee blows for half-time. {home} {hs}, {away} {as}.',
  ],
  fullTime: [
    'Full time. {home} {hs}, {away} {as}.',
    'The referee blows for full time. {home} {hs}, {away} {as}.',
  ],
  tries: [
    'Tries: {home} {ht}, {away} {at}.',
  ],
  possession: [
    'Possession so far: {home} {hp}%, {away} {ap}%.',
  ],
  winBy: [
    '{winner} win by {margin}.',
  ],
  draw: [
    'It ends all square.',
  ],

  // ---- summaries, worked out from the record so far ----
  territory: [
    '{team} have had {pct}% of the territory in the last ten minutes.',
    'Ten minutes of pressure: {team} have had {pct}% of the territory.',
  ],
}

/** the flat dictionary the game's locale files will hold: 'sim.kickTouch2' -> words */
export const EN_FLAT: Record<string, string> = Object.fromEntries(
  Object.entries(SIM_EN).flatMap(([base, list]) => list.map((s, i) => [`sim.${base}${i + 1}`, s])),
)
