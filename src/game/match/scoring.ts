// Tries, the TMO and the penalty decisions. Split out of matchEngine.ts,
// which re-exports the public parts.
import type { GameState, Player } from '../model'
import { careerRows } from '../model'
import { t, tIn } from '../i18n'
import { clamp, wpick } from '../rng'
import { MOVE_BY_ID, moveHash } from '../moves'
import { clutchKick } from '../habits'
import { teamShort } from './selection'
import { refFor } from './referee'
import { TAP_PLAY_W, backTowards, colour, describeRestart, moveTryLine, penPlay, styleSalt, tryLine } from './commentary'
import { checkFrontRow } from './subs'
import { describeOffence, describeWarning } from './discipline'
import { blowFullTime, blowHalfTime } from './finalize'
import { fieldChanged, goalKicker } from './field'
import { type SideCtx, evPts, onRecord } from './side'
import { tryScorer } from './setup'
import { CON_LINES, TOUCHLINE_CON, TRY_LINES, TRY_LINES_DERBY, TRY_LINES_WET, UNDER_POSTS, fitTryLine } from './lines'
import { DEPICTS, type LiveCtx, binUntil, pushLine } from './live'
import { FW_POS } from './energy'
import { kickChance, noteKick, takePenaltyShot } from './kicking'

/** How often a try goes to the TMO, and how often a review chalks it off.
 *  Together about one try in twenty is disallowed (the four-seed balance in
 *  fingerprint.ts records what that did to the scoring). */
export const TMO_REVIEW = 0.16
export const TMO_OVERTURN = 0.33
/** A handled try with a forward pass in its build-up, for a side that handles
 *  as the world does (x side.fwdF), and the share of those the TMO rules out
 *  (owner: 90%; the other 10% stand as tight calls). See scoreTry. An
 *  object so scripts/fwdpassprobe.ts can switch it off and show that nothing
 *  else in a match moves; nothing in the game writes to it. */
export const FWD_PASS = { rate: 0.02, ruledOut: 0.9 }
/** how far back up the field the scrum is, where the pass was thrown */
const FWD_SCRUM_BACK = 8

/** Score a try (+ conversion attempt) for a side - shared by open play and set-piece strikes. */
/** `line`/`lineV` let a set-piece strike supply its own wording - a maul that
 *  rumbles over reads better than the generic bank - and it is a KEY, not a
 *  sentence, for the same reason everything else here is. */
export function scoreTry(
  state: GameState, ctx: LiveCtx, side: SideCtx, min: number,
  line?: string, forceScorer?: Player | null, lineV?: Record<string, string | number>,
  /** false for a try nobody would send upstairs (a charge-down fallen on) */
  review = true,
) {
  const { rng, goalPenalty } = ctx
  let scorer = forceScorer ?? tryScorer(state, side, rng)
  // a maul that goes over is grounded by the man at the back of it, the
  // hooker who runs it (1.8.2, the maul switch): the draw above is taken
  // either way, so only the name on the try moves
  const mvTry = !forceScorer && ctx.moveTry ? MOVE_BY_ID[ctx.moveTry.id] : undefined
  if (mvTry?.red && mvTry.from.includes('lineout') && ctx.moveTry?.maker != null) {
    const mk = state.players[ctx.moveTry.maker]
    if (mk && side.onPitch.has(mk.id)) scorer = mk
  }
  // ---- THE TMO (owner, 25 Sep 2026: "we need to be able to overturn a try
  // if the tmo finds it ... there is randomness to whether its a try or not").
  //
  // A MECHANICAL CHANGE, on the rng stream on purpose: two draws per try, the
  // second only when the first sends it upstairs, so fingerprint.ts is
  // rebaselined in the same commit. Every match takes it, AI and Instant
  // Result included, or the user's fixtures would score differently from the
  // rest of the league.
  //
  // What the review is ABOUT (grounding, knock-on, the last pass, the
  // touchline) is picked from the minute and the scorer, not drawn: which
  // question the referee asks is wording, and wording never moves the stream.
  // The question and the verdict agree - a try chalked off for a knock-on was
  // being checked for a knock-on.
  //
  // ---- THE FORWARD PASS IN THE BUILD-UP (owner, 30 Sep 2026: "There should
  // still be forward passes in the game, but IF a try happens then the TMO
  // should get involved with 90% ruled off. The other 10% should be left in
  // for debate and tight calls.") ----
  //
  // A handled try (not a maul, a pack drive, a red-zone play or a
  // charge-down fallen on) carries a forward pass in its build-up at
  // FWD_PASS.rate, scaled by the attacking side's handling error this tick:
  // the same turnover chance the styles, the wet ball and sure hands already
  // set (styleTick turnP over TURN_BASE, side.fwdF). The TMO always looks at
  // one, and FWD_PASS.ruledOut of them are chalked off; the rest stand as the
  // tight calls the replays will argue over.
  //
  // NO DRAW ON THE SHARED STREAM. Both decisions are a hash of the world, the
  // fixture, the side, the minute and how many tries this side has gone over
  // for (moveHash off styleSalt, as the style turnovers are). The ordinary
  // review's first draw is still taken for every reviewable try, and its
  // second is taken whenever it would have been, so a forward-pass try that
  // stands spends exactly the draws it always did (the one exception: a try
  // the ordinary review would have chalked off for something else now
  // stands). A try ruled out moves what follows (no conversion is kicked),
  // which is the point.
  const tryIdx = side.tryCalls = (side.tryCalls ?? 0) + 1
  const handled = review && !!scorer && !forceScorer && !mvTry?.red && line == null
  const fwdPass = handled
    && moveHash(styleSalt(state, ctx), min, side === ctx.home ? 1 : 2, tryIdx, 0x46574450) < FWD_PASS.rate * (side.fwdF ?? 1)
  const upstairs = review && rng() < TMO_REVIEW
  let fwdStands = false
  if (fwdPass) {
    if (upstairs) rng() // the ordinary review's verdict draw, taken and set aside
    const q = 1 + ((min + (scorer?.id ?? 0)) % 2)
    const team = { team: teamShort(state, side.teamId) }
    const oppSide = side === ctx.home ? ctx.away : ctx.home
    pushLine(state, ctx, min, 'SUB', side, `comm.tmoReviewFwd${q}`, team, scorer?.id)
    if (moveHash(styleSalt(state, ctx), min, side === ctx.home ? 1 : 2, tryIdx, 0x52554c45) < FWD_PASS.ruledOut) {
      // No points, no conversion, no credit. The scrum goes to the defending
      // side where the pass was thrown, a few metres back up the field, and
      // the attack's momentum goes with it.
      side.fwdRuledOut = (side.fwdRuledOut ?? 0) + 1
      pushLine(state, ctx, min, 'SUB', side, `comm.tmoNoTryFwd${q}`, team, scorer?.id)
      backTowards(ctx, side, FWD_SCRUM_BACK)
      side.pressure = clamp(side.pressure * 0.6, 0, 100)
      pushLine(state, ctx, min, 'SUB', oppSide, `comm.tmoFwdScrum${q}`, { team: teamShort(state, oppSide.teamId) })
      return
    }
    side.fwdStood = (side.fwdStood ?? 0) + 1
    fwdStands = true
  } else if (upstairs) {
    // what is being checked (1.8.16, items 40, 24, 58): grounding, knock-on,
    // the last pass and the touchline as before, and now offside at the kick
    // in the build-up, a blocker running interference, and the TMO going back
    // through the phases to an offside at the lineout. Picked, never drawn.
    const q = 1 + ((min + (scorer?.id ?? 0)) % 7)
    // the lines name the side, not the man: no pronoun to get wrong, and a
    // pack drive has no single scorer to name
    const team = { team: teamShort(state, side.teamId) }
    pushLine(state, ctx, min, 'SUB', side, `comm.tmoReview${q}`, team, scorer?.id)
    if (rng() < TMO_OVERTURN) {
      // No points, no conversion, no credit. The ball stays where it was, down
      // at the defending side's line: a scrum five metres out or a drop-out,
      // and the attack still has the field it had earned.
      pushLine(state, ctx, min, 'SUB', side, `comm.tmoNoTry${q}`, team, scorer?.id)
      // an offence by the attack is a penalty to the defence, kicked clear
      if (q >= 5) backTowards(ctx, side, 12)
      return
    }
  }
  // THE RESTART (v1.8.0). The position that won the try is given back: the
  // conceding side kicks off from halfway. A HARD set to 50 was tried and
  // measured first, and with eleven scores across twenty ticks it meant more
  // than half of all rugby was played from exactly halfway - the restart is
  // contested, somebody kicks long, and this leaves that in.
  ctx.field = ctx.field * 0.6 + 50 * 0.4
  side.score += 5
  side.tries += 1
  evPts(ctx, side, 5)
  // the hat-trick and the fastest try (records, 1.8.16)
  if (side.firstTryMin == null) { side.firstTryMin = min; side.firstTryBy = scorer?.id }
  if (scorer) (side.matchTries ??= new Map()).set(scorer.id, (side.matchTries.get(scorer.id) ?? 0) + 1)
  if (scorer) {
    // ---- A TRY IS SCORED BY FIFTEEN MEN ----
    //
    // Measured across four seasons: forwards averaged 5.50 and 12% rated 7+,
    // backs 5.68 and 15%, and the cause is directly here. Match ratings are
    // built almost entirely from try credit, and tryScorer weights a wing at
    // 5.0 against a tighthead at 0.7 - so the men who won the ball, held the
    // scrum and cleared the ruck earned nothing for any of it while the man who
    // finished the move took the whole 0.9.
    //
    // So the finisher's credit is now shared with the platform that made it.
    // A REDISTRIBUTION, NOT AN ADDITION: 0.62 to the scorer plus 0.035 to each
    // of the eight forwards on the pitch comes to exactly 0.90, the old flat
    // figure, so the league's mean mark does not move and the world does not
    // quietly drift towards eights. The scorer is still far and away the
    // biggest single beneficiary of his own try, as he should be.
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.62)
    for (const id of side.onPitch) {
      const f = state.players[id]
      if (f && FW_POS.has(f.pos)) side.ratings.set(id, (side.ratings.get(id) ?? 6) + 0.035)
    }
    if (onRecord(state, ctx, side)) {
      scorer.stats.tries += 1
      scorer.stats.points += 5
    }
  }
  const wetTry = (ctx.weather === 'Rain' || ctx.weather === 'Snow') && rng() < 0.25
  const derbyTry = ctx.derby && rng() < 0.3
  const tryPool = derbyTry ? TRY_LINES_DERBY : wetTry ? TRY_LINES_WET : TRY_LINES
  // `line` is a set-piece strike's own wording, already a key, and it wins
  // when the caller supplied one.
  let tryKey = line ?? 'comm.tryPackDrive'
  if (line) pushLine(state, ctx, min, 'TRY', side, line, lineV, scorer?.id)
  else if (scorer) {
    // the simulation's draw stays (the stream must not move); the words are
    // chosen on the commentary's dice by what the try meant (1.9.0, tryLine)
    rng()
    tryKey = tryLine(ctx, side, tryPool, scorer, min)
    // the called move that made it names itself (moves.ts); the pool's draw
    // above is taken either way, so naming it moves nothing
    const mt = ctx.moveTry ? moveTryLine(state, ctx.moveTry, scorer, min) : null
    if (mt) tryKey = mt.k
    // a try that came through a forward pass came through hands: a maul line
    // drawn for it is swapped after the draw, so the stream is untouched
    else if (fwdStands && DEPICTS[tryKey] === 'MAUL') tryKey = 'comm.try2'
    // THE WORDS FIT THE MAN (owner's screenshot, release QA after 1.8.16:
    // "Fin Smith powers over off the back of the maul"). The scorer is drawn
    // first and the line after, from one pool, so a fly-half could finish a
    // maul and a prop could "arc outside his man". A line that does not fit
    // his position is swapped after the draw, so the stream is untouched.
    else tryKey = fitTryLine(tryKey, scorer)
    pushLine(state, ctx, min, 'TRY', side, tryKey, mt ? mt.v : { player: scorer.name }, scorer.id)
    // three in an afternoon (1.8.16)
    if (side.matchTries?.get(scorer.id) === 3) colour(state, ctx, side, 'comm.hatTrick', { player: scorer.name, team: teamShort(state, side.teamId) }, scorer.id)
    // and the debate that follows a tight call
    if (fwdStands) pushLine(state, ctx, min, 'SUB', side, `comm.tmoFwdStands${1 + ((min + scorer.id) % 2)}`, { team: teamShort(state, side.teamId) }, scorer.id)
  }
  else pushLine(state, ctx, min, 'TRY', side, 'comm.tryPackDrive')
  const cTries = scorer ? careerRows(scorer).reduce((s, c) => s + c.tries, 0) + scorer.stats.tries + (scorer.hist?.tries ?? 0) : 0
  if (scorer && ctx.detail && [25, 50, 75, 100].includes(cTries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryCareerMilestone', { n: cTries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && [10, 15, 20, 25].includes(scorer.stats.tries)) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.trySeasonCount', { n: scorer.stats.tries, player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && scorer.id === ctx.fx.testimonial) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryAtTestimonial', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    // deterministic gates on all detail-only flavour: commentary must never
    // consume the shared rng stream (the EK/ER lesson, applied everywhere)
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryNoCelebration', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && scorer.retiring && (scorer.ca >= 72 || (scorer.caps ?? 0) >= 25) && (min + scorer.id) % 5 < 3) {
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryRetiringOvation', { player: scorer.name }, scorer.id)
  } else if (scorer && ctx.detail && (scorer.rust ?? 0) >= 2 && (min + scorer.id) % 10 < 7) {
    // gate is deterministic (minute + id), not an rng draw: commentary must
    // never move the sim stream - see the EK lesson
    pushLine(state, ctx, min + 1, 'SUB', side, 'comm.tryComeback', { player: scorer.name }, scorer.id)
  }
  // THE MARK DOES NOT DEPEND ON WHO WAS WATCHING (1.8.1). The testimonial
  // try and the old boy's try against his former club were worth a little
  // more only inside the watched-only commentary above, so the same match
  // gave different ratings, and so a different Player of the Match and form,
  // when it was simmed. The words stay with the watcher; the marks do not,
  // and they no longer wait on a milestone line not having been said first.
  if (scorer && scorer.id === ctx.fx.testimonial) {
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.3)
  } else if (scorer && side.exIds.has(scorer.id) && (min + scorer.id) % 4 < 3) {
    side.ratings.set(scorer.id, (side.ratings.get(scorer.id) ?? 6) + 0.2)
  }
  const kicker = goalKicker(state, side)
  const pCon = clamp(kickChance(state, kicker, 0.495, 54, goalPenalty, side)
    + clutchKick(state.seed, kicker, min, side.score - (side === ctx.home ? ctx.away : ctx.home).score), 0.3, 0.92)
  const conOver = rng() < pCon
  noteKick(ctx, side, conOver)
  if (conOver) {
    side.score += 2
    evPts(ctx, side, 2)
    if (kicker && onRecord(state, ctx, side)) { kicker.stats.cons += 1; kicker.stats.points += 2 }
    // A TRY UNDER THE POSTS IS NOT CONVERTED FROM THE TOUCHLINE (1.6.3). The
    // conversion line was drawn without looking at the try line, and thirteen
    // times in 224 matches "dives under the posts" was followed by "converts
    // from the touchline" (scripts/qa/whistle.ts). Same shape as PEN_WET: a
    // swap after the draw, so the stream and the fingerprint are untouched.
    let conKey = CON_LINES[Math.floor(rng() * CON_LINES.length)]
    if (UNDER_POSTS.has(tryKey) && TOUCHLINE_CON.has(conKey)) conKey = 'comm.con4'
    pushLine(state, ctx, min + 1, 'CON', side, conKey,
      { player: kicker?.name ?? tIn('en', 'comm.theKicker') }, kicker?.id)
  } else {
    pushLine(state, ctx, min + 1, 'SUB', side, ctx.detail && kicker && ctx.crng() < 0.12 ? 'comm.conPost' : 'comm.conWide',
      { player: kicker?.name ?? '' }, kicker?.id)
  }
  describeRestart(state, ctx, side)
}

/**
 * Resolve the user's touchline call on a kickable penalty.
 *
 * THE WHISTLE WAITS FOR THE KICK (owner: "ive noticed a few times a penalty
 * kick comes after the half-time whistle has blown... this should never
 * happen should be everything within the time").
 *
 * A penalty awarded in the last four minutes of a half stops the clock, and
 * the answer - a tap from the manager, a standing instruction, or the 'posts'
 * default a skip or an instant result takes - arrives after stepTick has
 * already pushed HALF TIME. Reproduced before the fix: index 42 "PENALTY to
 * Northampton - kickable range", index 44 "Full-time", index 45 the kick.
 *
 * The kick was awarded before time, so it belongs in front of that line. When
 * a whistle is standing on an unanswered call, everything this function
 * narrates is spliced in ahead of it - which fixes the live ticker, the skip
 * and the instant result in one place, and without taking the last decision
 * of a half away from the manager.
 */
export function resolveDecision(state: GameState, ctx: LiveCtx, choice: 'posts' | 'corner' | 'tap'): string {
  const d = ctx.decision
  if (!d) return ''
  ctx.decision = null
  const whistleAt = ctx.whistleAt
  const before = ctx.events.length
  // whatever the answer puts on the board is the penalty's (EvCount.pts)
  ctx.evWhy = 'pen'
  const msg = decide(state, ctx, d, choice)
  ctx.evWhy = null
  if (whistleAt != null && whistleAt <= before) {
    const moved = ctx.events.splice(before)
    // AND THEY TAKE THE WHISTLE'S CLOCK WITH THEM.
    //
    // Moving the lines was only half of it. They were narrated live, so they
    // carry the minute of the tick that resolved them - and the whistle line
    // they are being placed IN FRONT OF was stamped when the half ended, which
    // is earlier. A kick awarded at 40' and taken in injury time produced a
    // ticker reading 41' TRY, 42' CON, 40' Half-time: the timeline ran
    // backwards, and the half-time card claimed to have happened two minutes
    // before the score it was reporting.
    //
    // Everything spliced here happened BEFORE the whistle by definition - that
    // is the whole reason it is being moved - so it cannot be stamped later
    // than the whistle. Clamp, do not renumber: a kick genuinely taken at 41'
    // in a half that ran to 42' keeps its 41'.
    //
    // scripts/stresstest.ts had caught this all along and could not say so: its
    // timeline invariant exempts HT, FT and BRK, so the whistle line itself was
    // waved through, and only the half-time NUMBERS line beside it - typed SUB,
    // because there is no interval type and HT would blow the whistle twice in
    // ui/audio.ts - was ever checked. It went red the moment a change elsewhere
    // shifted the rng stream enough to make first halves run long.
    const whistleMin = ctx.events[whistleAt]?.min ?? d.min
    for (const e of moved) e.min = Math.min(e.min, whistleMin)
    ctx.events.splice(whistleAt, 0, ...moved)
    // AND THE WHISTLE LINE SAYS THE SCORE THE KICK LEFT (1.6.3). It was stamped
    // when the half ended, before the answer, so its snapshot - which is what
    // the scoreboard shows while the ticker rests on it - read three or seven
    // short in every late-penalty half (scripts/qa/whistle.ts: 26 of 26).
    const whistle = ctx.events[whistleAt + moved.length]
    if (whistle && (whistle.type === 'HT' || whistle.type === 'FT')) {
      whistle.homeScore = ctx.home.score
      whistle.awayScore = ctx.away.score
      if (whistle.k && whistle.v) {
        whistle.v = { ...whistle.v, hs: ctx.home.score, ascore: ctx.away.score }
        whistle.text = tIn('en', whistle.k, whistle.v)
      }
    }
  }
  // A KICK ANSWERED AFTER THE FINAL WHISTLE CHANGES THE RESULT.
  //
  // finalizeMatch runs inside the last tick, before the manager has answered,
  // and writes the fixture's score and the full-time line from the scoreboard
  // as it stood. The splice above put the kick in the right place on the
  // ticker; it did nothing about the record. Found by scripts/releaseaudit.ts,
  // which rigged a kickable penalty into the 80th minute 114 times: the ticker
  // read 72-13 and the fixture 69-13 in 105 of them - three points that were
  // on the screen and not in the table.
  //
  // The half-time case never had the problem: a kick taken at 41' lands on a
  // scoreboard that finalizeMatch reads forty minutes later. Only the final
  // whistle needs the record re-read, so only the final whistle does it.
  if (ctx.seg === 3) syncResult(ctx)
  // AND NOW THE WHISTLE GOES. The clock reached it while this call was open,
  // so it was held; the kick has been narrated above and belongs in front of
  // it, which is exactly the order the ticker now has without any splicing.
  if (ctx.heldWhistle === 'HT') blowHalfTime(state, ctx)
  else if (ctx.heldWhistle === 'FT') blowFullTime(state, ctx)
  return msg
}

/** The fixture and the full-time line say what the scoreboard says. Called
 *  when a kick is taken after finalizeMatch has already written both.
 *  Ratings were settled on the pre-kick margin and are left alone: three
 *  points of margin move teamRatingTerm by a fraction of a point across a
 *  side, and re-marking twenty-three men for one kick is more churn than the
 *  correction is worth. The result is what the table reads, so the result is
 *  what is fixed. */
function syncResult(ctx: LiveCtx) {
  const { fx, home, away } = ctx
  fx.homeScore = home.score
  fx.awayScore = away.score
  fx.homeTries = home.tries
  fx.awayTries = away.tries
  const ft = ctx.events.find(e => e.type === 'FT' && e.k === 'comm.fullTime')
  if (ft?.v) {
    ft.v = { ...ft.v, hs: home.score, ascore: away.score }
    ft.text = tIn('en', 'comm.fullTime', ft.v)
    // the snapshot the scoreboard reads at the last line, not only the words
    ft.homeScore = home.score
    ft.awayScore = away.score
  }
}

function decide(
  state: GameState, ctx: LiveCtx, d: { kind: 'penalty'; min: number; fld?: number },
  choice: 'posts' | 'corner' | 'tap',
): string {
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const opp = mine === ctx.home ? ctx.away : ctx.home
  // the kick belongs to the half the penalty was awarded in, and cannot run
  // past that half's whistle however late the answer arrives
  const min = Math.min(d.min <= 40 ? 40 : 79, d.min + 1)
  // AND IT BELONGS TO THE SPOT IT WAS AWARDED ON (1.8.0). The rest of the tick
  // plays on while the call waits, so an opposition kick to touch could move
  // the ball back into your half before the answer came, and a shot "at the
  // posts" went up from your own 43 (kickrangeprobe, 1 in 533). Absent on a
  // decision saved before 1.8.0, which keeps the old behaviour.
  if (d.fld != null) ctx.field = d.fld
  if (choice === 'posts') {
    takePenaltyShot(state, ctx, mine, min)
    return t('touch.pointsOnBoard')
  }
  if (choice === 'corner') return kickToCorner(state, ctx, mine, opp, min)
  return tapAndGo(state, ctx, mine, opp, min)
}

/**
 * ---- POSTS, CORNER OR TAP: THE AI'S CALL (1.8.16) ----
 *
 * The broadcasts are full of it: "go to the corner and back the maul", three
 * points turned down because three are not enough. The AI kicked every
 * kickable penalty at goal. Now it reads what a captain reads: the clock and
 * the scoreboard first (late and more than a kick behind, it needs a try), then
 * how close the line is and whether its maul has the beating of their pack.
 * Each club has its own appetite for it, off a hash of its id, so some sides
 * go to the corner far more than others. No draw: the call is read, and the
 * dice that follow are the ones the manager's own call would have taken.
 */
export function aiPenaltyCall(_state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, min: number): 'posts' | 'corner' | 'tap' {
  const toLine = side === ctx.home ? 100 - ctx.field : ctx.field
  const behind = opp.score - side.score
  const drive = side.units.lineout * 0.6 + side.units.scrum * 0.4
  const stop = opp.units.defence * 0.5 + opp.units.breakdown * 0.5
  const maul = drive - stop
  const pace = side.units.attack - opp.units.defence
  let h = 0
  for (const ch of side.teamId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const appetite = (h % 1000) / 1000   // 0 = always the posts, 1 = loves the corner
  // the last ten minutes, more than a kick behind: three points will not do
  if (min >= 70 && behind > 3) return toLine <= 8 && pace > 1 ? 'tap' : 'corner'
  // ahead late, or level and the kick puts them in front: take the points
  if (min >= 60 && behind <= 0) return 'posts'
  // five metres out with backs who have the beating of them
  if (toLine <= 5 && pace > 3.5 - appetite) return 'tap'
  // close in with a pack that is on top: back the maul. Rarer than the
  // posts by a distance, as it is in the Premiership: the tries it makes were
  // measured against the bands (bandcheck), not added on top of them
  if (toLine <= 12 && maul > 3.8 - appetite * 2.4 && behind > -10) return 'corner'
  return 'posts'
}

/** The corner and the maul, for whichever side has the penalty (the manager's
 *  call through decide, the AI's through aiPenaltyCall). */
export function kickToCorner(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, min: number): string {
  const rng = ctx.rng
  {
    // THE MAUL IS A SET-PIECE CONTEST, so it reads the set piece: your lineout
    // AND your pack against their defence AND their breakdown. It used to read
    // one unit against a defensive average that barely moves on the 1-20 scale,
    // so the corner never climbed out of the low thirties and the boot was the
    // right answer at every club in the game - measured at +2.1 points a match
    // over the corner at a strong club and +4.5 at a weak one. A decision the
    // engine stops the clock for should not have one answer.
    const drive = mine.units.lineout * 0.6 + mine.units.scrum * 0.4
    const stop = opp.units.defence * 0.5 + opp.units.breakdown * 0.5
    const pTry = clamp(0.34 + (drive - stop) * 0.030, 0.15, 0.62)
    pushLine(state, ctx, min, 'SUB', mine, 'comm.maulToCorner')
    // HELD UP OVER THE LINE (1.9.1, owner: "occasionally it should be held up
    // and no try scored ... Especially in close games towards the end of the
    // match. This is when the player is most invested"). A drive now gets
    // over the line a little more often than it scores (pOver), and one in
    // ten of those is held up - so across a match the corner scores exactly
    // as often as it did and the posts-or-corner call is no different. In the
    // last quarter of a game within a score it is held up more than one in
    // four times: there the corner is a real gamble, which is the drama.
    const close = min >= 65 && Math.abs(mine.score - opp.score) <= 7
    const pOver = Math.min(0.95, pTry / 0.9)
    const r = rng()
    if (r >= pOver * (close ? 0.72 : 0.9) && r < pOver) {
      heldUpMaul(state, ctx, mine, opp, min + 1)
      return t('touch.gambleEmpty')
    }
    if (r < pOver) {
      const forwards = mine.lineup.slice(0, 8)
        .map(id => id != null ? state.players[id] : null)
        .filter((p): p is Player => !!p && mine.onPitch.has(p.id))
      const scorer = forwards.length ? forwards[Math.floor(rng() * forwards.length)] : null
      scoreTry(state, ctx, mine, min + 1, scorer ? 'comm.tryMaulRumbles' : undefined, scorer, scorer ? { player: scorer.name } : undefined)
      return t('touch.maulDelivers')
    }
    if (rng() < 0.5) {
      heldUpMaul(state, ctx, mine, opp, min + 1)
      return t('touch.gambleEmpty')
    }
    mine.poss += 1.2
    pushLine(state, ctx, min + 1, 'SUB', mine, 'comm.maulRepelledPenalty')
    // the line says they gave away another penalty, so the count has it
    concedePenalty(state, ctx, opp, min + 1, null)
    return t('touch.pinnedNoPoints')
  }
}

/** A maul driven over and held up: no try, and since 2022 the restart is the
 *  defenders' goal-line drop-out, which clears them up the field (the open
 *  play held-up does the same, heldUpTick). The line was "win the scrum",
 *  the law as it stood before. */
function heldUpMaul(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, min: number) {
  pushLine(state, ctx, min, 'SUB', opp, 'comm.maulHeldUp', { team: teamShort(state, opp.teamId) })
  backTowards(ctx, mine, 45)
  mine.pressure = clamp(mine.pressure * 0.6, 0, 100)
  opp.pressure = clamp(opp.pressure + 15, 0, 100)
}

/** The quick tap, for whichever side has the penalty. */
export function tapAndGo(state: GameState, ctx: LiveCtx, mine: SideCtx, opp: SideCtx, min: number): string {
  const rng = ctx.rng
  // TAP AND GO READS THE PLACE AND THE MATCHUP (1.8.0, optionsprobe). It
  // scored 17% of the time from anywhere against anyone, 1.01 points a call
  // from twenty metres against 2.47 for the posts, so "always tap" gave away
  // seven points a match. Close in with an attack that has the beating of
  // their defence it is now a real rival to the posts; from forty metres out
  // it is still a punt, which is rugby.
  //
  // AND IT IS RUN AS THE PLAYBOOK'S PENALTY PLAY (round 6). The play in the
  // penalty slot moves the chance by what it is worth with these men against
  // this defence (moveEdge, the same reckoning as any called move: drilled,
  // fitted, matched, and a misfire when undrilled), and a try it makes is
  // named for it. No play is the tap as it always was. Read off the side,
  // never a draw: the one roll below is the one there always was.
  mine.poss += 1.4
  const toLine = mine === ctx.home ? 100 - ctx.field : ctx.field
  const pen = penPlay(state, mine, opp)
  const pTap = clamp(0.42 - toLine * 0.006 + (mine.units.attack - opp.units.defence) * 0.03 + (pen ? pen.gain * TAP_PLAY_W : 0), 0.10, 0.55)
  if (rng() < pTap) {
    ctx.moveTry = pen ? { id: pen.id, launch: 'tap', maker: pen.maker?.id ?? null } : null
    scoreTry(state, ctx, mine, min, undefined)
    ctx.moveTry = null
    return t('touch.quickTapWorks')
  }
  pushLine(state, ctx, min, 'SUB', mine, 'comm.quickTapPhases', { team: teamShort(state, mine.teamId) })
  return t('touch.tempoLifted')
}

/** A penalty conceded: the count climbs, and when it reaches the referee's
 *  patience (and again at twice it) somebody takes ten in the bin for the
 *  team. One place for it, because the failed maul says "another penalty"
 *  too and used to leave the count, and so the warning and the bin, where
 *  they were (1.8.1). */
export function concedePenalty(state: GameState, ctx: LiveCtx, opp: SideCtx, min: number, name?: null) {
  opp.consPens += 1
  const binAt = refFor(ctx.fx.id).patience
  // WHAT IT WAS FOR, AND THE WORD WITH THE CAPTAIN (1.8.16): words only, on
  // crng. `null` from a caller whose own line already says what it was.
  if (name !== null) describeOffence(state, ctx, opp, opp === ctx.home ? ctx.away : ctx.home)
  describeWarning(state, ctx, opp, binAt)
  if ((opp.consPens === binAt || opp.consPens === binAt * 2) && opp.onPitch.size > 13) {
    // never the man already back from the bin (see giveYellow)
    const ps = [...opp.onPitch].map(id => state.players[id]).filter(x => x && !opp.yellowUntil.has(x.id))
    if (ps.length) {
      const p = wpick(ctx.rng, ps, ps.map(x => x.a.agg))
      opp.yellowUntil.set(p.id, binUntil(ctx, min))
      opp.onPitch.delete(p.id)
      opp.binned.add(p.id)
      p.stats.yc += 1
      opp.ratings.set(p.id, (opp.ratings.get(p.id) ?? 6) - 0.7)
      pushLine(state, ctx, min, 'YC', opp, 'comm.ycRepeated',
        { n: opp.consPens, team: teamShort(state, opp.teamId), player: p.name }, p.id)
      checkFrontRow(state, ctx, opp, min, p, 'yellow')
      fieldChanged(state, ctx, opp, min)
    }
  }
}
