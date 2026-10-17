// One tick of play (simTick) and the constants that tune it. Split out of
// matchEngine.ts.
import { brittleF } from '../formtraits'
import type { GameState } from '../model'
import { genderOf } from '../gender'
import { zoneAt, zonePlan } from '../tactics'
import { facLevel, inRedZone } from '../model'
import { resolveContest } from '../contest'
import { tIn } from '../i18n'
import { clamp, wpick } from '../rng'
import { moveHash } from '../moves'
import { styleTerr, styleTick, TURN_BASE, TURN_M } from '../styles'
import { injuryF, styleWx } from '../conditions'
import { teamShort } from './selection'
import { refFor } from './referee'
import { backTowards, describeDefence, describeMoveCall, describeMoveOutcome, describePlay, describeState, describeStyle, describeTurnover, moveInPlay, moveTryOf, said, styleSalt, upOf } from './commentary'
import { dropChance, dropGoalAttempt, kicksFromHand } from './kickplay'
import { aiPenaltyCall, concedePenalty, kickToCorner, resolveDecision, scoreTry, tapAndGo } from './scoring'
import { aiAutoSubs, applyFinishers, benchTank, checkFrontRow, frontRowCoverEnds, injuryCoverFor, liveFrontRowCover, pickBenchSub, sendOnForInjury } from './subs'
import { describeDay } from './day'
import { CARD_SHARE, MAN_DOWN, YC_REASONS } from './discipline'
import { SP_PEN_W, cynicalIncident, heldUpTick, interceptTick, reversedPenalty, scuffleTick, setPieceContest, setPieceTick, tmoFoulTick, waterBreak } from './incidents'
import { pickInjury } from './injuries'
import { TACKLE_LINES, cameOn, countTackles, fieldChanged } from './field'
import { BREAK_P, type SideCtx, evOf, evTick, layer, zoneIdx } from './side'
import { FLAVOR, FLAVOR_DERBY, FLAVOR_FUN, FLAVOR_GRASSROOTS, FLAVOR_PACIFIC, FLAVOR_WET, FLAVOR_WIND, SCRUM_CONTEST_FLAV, TIRED_LINES } from './lines'
import { type LiveCtx, binUntil, pushLine, styledKick } from './live'
import { drainEnergy, sideEnergy } from './energy'
import { takePenaltyShot } from './kicking'

/** Base try chance per tick at ratio 1. Was a flat 0.115 for the whole match;
 *  the last-quarter surge in simTick spends the difference, so the season's
 *  scoring totals stay on the measured band while the tries move later. */
/**
 * REBASED for territory (v1.8.0), from 0.108.
 *
 * pTry is TRY_BASE times a ratio raised to 2.6, and field position multiplies
 * that ratio - up for the side with the position, down for the side without.
 * Those two are exact reciprocals, so the RATIO's mean is untouched, but the
 * 2.6 is convex: g^2.6 and g^-2.6 average to more than one, and the league
 * measured 56.2 points a game against 50.6 before the line existed. Rebased
 * a second time, 0.096 to 0.088, when the line was widened so that a tenth of
 * all rugby is played inside each 22 - a wider line means a bigger convex
 * term, and the league had drifted back up to 55.0.
 *
 * Same lesson, and the same fix, as the last-quarter fatigue term above - the
 * mechanism stays at full strength and the constant underneath it comes down
 * so the season's totals stay on the band.
 *
 * And a third time the other way, 0.0832 to 0.0895, when the TMO started
 * chalking tries off (scoreTry): about one in eighteen is disallowed, so a few
 * more are scored in the first place and the season lands where it was
 * (fingerprint.ts has the before-and-after).
 *
 * And 0.0895 to 0.0945 in 1.7.3, when ageing began turning an older side's
 * pace into tackling and handling (ageing.ts): every veteran back is a little
 * slower and every veteran tackler a little surer, so fewer tries were
 * scored until the constant moved (bandcheck pooled, tries a game: 6.40
 * before ageing, 6.38 after it with this constant; points 50.2 -> 50.3).
 *
 * And 0.0930 to 0.0843 in 1.8.0, for the charge-downs (kicksFromHand): about
 * 0.4 tries a match now come off a blocked kick, whoever is the better side,
 * so the tries the scoring roll hands out come down to leave the season's
 * total where it was. See scripts/fingerprint.ts for the before and after.
 *
 * And 0.0843 to 0.0815 later in 1.8.0, with the two-layer contest (E12),
 * whose extra variance had thinned home advantage below its band.
 */
const TRY_BASE = 0.0815
/** late in a match: how much an empty tank costs the side defending, and the side attacking */
const TIRED_DEF = 0.8, TIRED_ATT = 0.3
/** the strength a side keeps on an empty tank from the 56th minute (0.78 before it).
 *  0.6, then 0.55 once AI replacements brought their own quality instead of
 *  the starters' (creditprobe): a sub became a real trade for the AI too, the
 *  side that never changed was punished less, and the manager's whole bench
 *  fell to +0.43 points (subvalueprobe). At 0.55 it reads +0.91, four fresh
 *  men +1.09, and bandcheck holds every band (49.1 pts, 52.7% home). */
const LATE_FLOOR = 0.55
/** how hard the penalty count leans toward the defending side's half (1.7.4) */
const PEN_LEAN = 1.7
/** how hard a zone plan moves the line (1.8.0, see simTick): at 1 the kicking
 *  and own-half penalty changes had shrunk the gap between plans (advprobe:
 *  long vs play 0.5, drive vs spread 0.2); at 2 the gaps are 1.3 and 0.6 */
const ZONE_PULL = 2
/** how hard a style's kicking game moves the line (1.8.2, styles.ts): the
 *  push is a constant a tick, and the line's decay multiplies a constant by
 *  about 28, so this is small on purpose (see ZonePlan.terr) */
const STYLE_PULL = 1

export function simTick(state: GameState, ctx: LiveCtx, tick: number) {
  const { rng, detail, derby, home, away } = ctx
  const min = tick * 4 + Math.floor(rng() * 4) + 1
  // the clock reaches this tick whether or not anybody writes a line in it
  // (1.8.0): a silent match used to stop its clock at its last written line,
  // so its sheet counted fewer minutes of scrums than the same match watched
  ctx.lastMin = Math.max(ctx.lastMin, Math.min(min, ctx.seg === 0 ? 40 : 80))
  const poss0: [number, number] = [home.poss, away.poss]

  // the bin empties: ten minutes served and the man comes back on, unless he
  // was replaced while he sat (his shirt no longer names him) or broke down
  for (const s of [home, away]) {
    if (!s.binned.size) continue
    for (const id of [...s.binned]) {
      if ((s.yellowUntil.get(id) ?? 0) > min) continue
      s.binned.delete(id)
      // Law 3: back from the bin to a shirt a front-row replacement wore
      const covered = frontRowCoverEnds(state, ctx, s, id, min)
      const p = state.players[id]
      if (!covered && p && !p.injury && s.lineup.slice(0, 15).includes(id)) s.onPitch.add(id)
      // Law 3: the man who went off with a binned front-rower comes back with him
      if (s.lawOut && s.lawOut.binned === id) {
        const o = state.players[s.lawOut.id]
        if (o && !o.injury && s.lineup.slice(0, 15).includes(o.id)) { s.onPitch.add(o.id); s.short = Math.max(0, s.short - 1) }
        s.lawOut = null
      }
    }
    /**
     * HE SERVED HIS TEN AND DID NOT COME BACK.
     *
     * The two `else` cases above are silent: a man who broke down while he sat,
     * and a man whose shirt was given away while he sat to somebody who is not
     * on the pitch either. In both the side finishes a man light and NOTHING
     * was charging for it - binned no longer holds him, his yellowUntil has
     * expired so numF has stopped counting him, and short never heard of him.
     * Fourteen men, priced as fifteen, for the rest of the match.
     *
     * This is the same hole the uncovered-injury path had (the `side.short`
     * charge further down, and its comment), one door along, and it is found
     * the same way: journeyprobe reconciling heads on the pitch against the
     * men the card accounts for. It surfaced when TRY_BASE moved, which is all
     * a seeded probe can ever tell you - the bug was always there, and the
     * dice had simply not walked into it.
     *
     * Reconciled rather than special-cased, because `short` IS this number:
     * players the side had to do without, and not a card in anybody's record.
     */
    // `binned` IS the answer to "who is still sitting", and yellowUntil is not:
    // the loop above deletes a man from the set the moment his ten minutes are
    // up, so anyone left in it never came back. Reading the clock instead gets
    // the final whistle wrong in both directions.
    const accounted = 15 - s.sent - s.short - s.binned.size
    if (s.onPitch.size < accounted) s.short += accounted - s.onPitch.size
  }
  // the men back from the bin are timed from now, and the net for anything
  // else that changed since the last tick (see fieldChanged). The XV that
  // walks out for the first tick is the one that started, whatever the
  // manager did to the sheet before kick-off.
  for (const s of [home, away]) {
    s.starters ??= new Set(s.onPitch)
    fieldChanged(state, ctx, s, min)
    const acc = (s.setAcc ??= { scrum: 0, lineout: 0, breakdown: 0, n: 0 })
    acc.scrum += s.units.scrum; acc.lineout += s.units.lineout; acc.breakdown += s.units.breakdown; acc.n += 1
  }
  // a sin-binned front-rower is back and the cover with him: the scrum is a
  // contest again, the levelling his card ordered taken back off both packs
  if (ctx.uncontested && ctx.uncontestedUndo && liveFrontRowCover(state, home) && liveFrontRowCover(state, away)) {
    layer(home, 'scrum', 1 / ctx.uncontestedUndo.home)
    layer(away, 'scrum', 1 / ctx.uncontestedUndo.away)
    ctx.uncontested = false
    ctx.uncontestedUndo = null
    pushLine(state, ctx, min, 'SUB', null, 'comm.contestedAgain')
  }

  // The bench has been on since the hour mark: the closing quarter takes the
  // shape the 23 was picked for (F4).
  if (tick === 16) {
    applyFinishers(state, ctx, home, min)
    applyFinishers(state, ctx, away, min)
  }

  // the set piece first (1.9.0): what it gives this tick's scoring roll, and
  // the scrums the front rows packed down before they are tired by them
  setPieceContest(state, ctx, tick)
  drainEnergy(state, ctx, home)
  drainEnergy(state, ctx, away)

  // THE BENCH IS A TRAP, AND THIS BAND IS ONLY HALF THE REASON.
  //
  // An audit measured the inversion: over 77 paired fixtures one or two changes
  // gained about a point, three lost 0.6 and eight lost 2.5 - so the winning
  // play was to leave the bench sitting down, while aiAutoSubs empties it for
  // all 100 AI clubs. The cause is that freshness is capped at 22% of a unit's
  // score, which is less than the quality gap from a starter to a seventh
  // replacement, and MAX_SUBS went to eight without the reward widening.
  //
  // WIDENING THIS BAND WAS TRIED AND REVERTED. At 0.66 + 0.34 the Player of the
  // Month count fell from 18 to 11 across awardprobe's three careers and at
  // 0.72 + 0.28 to 14, against a floor of 15 - because the band changes who
  // survives cup rounds, which changes how many clubs clear the three-match
  // gate in a six-week window. A global multiplier on every unit in every match
  // is too blunt an instrument for a bench problem.
  //
  // THE TANK FLOOR IN mkSide WAS TRIED TOO, and reverted for its own reasons
  // (see there). So both levers that widen the freshness gap are known to break
  // something else that is measured, and NOTHING IN THE ENGINE IS CHANGED HERE:
  // the bench inversion is still real and still open.
  //
  // CLOSED IN 1.8.0 for the part that matters: the band is unchanged for the
  // first hour and steeper from the 56th minute (LATE_FLOOR, below), which
  // is where replacements come on. scripts/subvalueprobe.ts: four changes
  // +1.27 points over none, eight +1.32 (were about 0 and -0.4), and
  // awardprobe's Player of the Month floor holds.
  //
  // What was fixed is the part that was actively harmful - coachfix.ts was
  // telling managers to make all eight changes, which measures 2.5 points a
  // match worse than making none.
  //
  // The honest next step is not another multiplier. It is to make a
  // replacement's benefit LOCAL to the shirt he replaces - a fresh tighthead
  // against a spent one, priced on those two men - rather than a side-wide
  // average that every other system reads. Both attempts here failed because a
  // side-wide energy term is load-bearing for ratings, cup progression and the
  // board's read of a season, none of which a bench fix should be deciding.
  // THE LAST QUARTER IS THE BENCH'S (1.8.0, owner: "subs should be
  // important"). The side-wide band above stays as it was for the first
  // hour - widening it everywhere was tried and reverted, see the note - and
  // from the 56th minute, where every replacement actually comes on, an
  // empty tank costs more: LATE_FLOOR at zero instead of 0.78.
  const eF = (s: SideCtx) => tick >= 14
    ? LATE_FLOOR + (1 - LATE_FLOOR) * (sideEnergy(s) / 100)
    : 0.78 + 0.22 * (sideEnergy(s) / 100)

  /**
   * ---- THE LINE MOVES (v1.8.0) ----
   *
   * One draw a tick. The better kicking game walks the game up the pitch, and
   * everything leaks back toward halfway because restarts, turnovers and the
   * simple fact of eighty minutes all pull it there - without that pull a
   * side with a marginally better boot would end every match camped on the
   * opposition line, which is not a rugby match, it is a slow ratchet.
   *
   * The noise is deliberately larger than the edge. Territory in rugby swings
   * on a single clearance or a single counter, and a field position that
   * crept predictably would make the boot a certainty rather than a bet.
   */
  /**
   * THE GAME PLAN FOR WHERE WE ARE (v1.8.0). Each side is in its own zone -
   * home's own 22 IS away's opposition 22 - so both are read, and each side's
   * plan pushes the line away from its own posts. A side kicking its exits
   * long and a side running them both get what they asked for, in opposite
   * directions, and the net is the tug of war it should be.
   */
  const planOf = (s: SideCtx) => {
    const up = s === home ? ctx.field : 100 - ctx.field
    const z = zoneAt(up)
    return zonePlan(z, state.clubs[s.teamId]?.tactic.zones?.[z])
  }
  // what each side sets out to do, read from where it is standing NOW
  const kickEdge = Math.log(home.units.kicking / Math.max(1, away.units.kicking))
  // and the styles' kicking games (1.8.2): a box-kick-and-chase side walks
  // the line up the pitch, as far as the other side's defence lets it
  const windy = ctx.weather === 'Wind'
  const styPush = (styleTerr(home.sty, away.sty, windy) - styleTerr(away.sty, home.sty, windy)) * STYLE_PULL
  const push = kickEdge * 7 + (rng() - 0.5) * 86 + (planOf(home).terr - planOf(away).terr) * ZONE_PULL + styPush
  ctx.field = clamp(ctx.field * 0.965 + 50 * 0.035 + push, 4, 96)
  // AND READ AGAIN AFTER THE LINE HAS MOVED. The push above is what a side
  // does FROM where it was; the scoring roll below happens WHERE IT ENDED UP,
  // and the terr factor under it reads that same new position. Deriving the
  // plan once, before the move, meant an exit plan could be scoring tries
  // from the halfway line.
  const hp = planOf(home)
  const ap = planOf(away)
  // where the game is, in words (watched only, and no draw on rng)
  describeState(state, ctx, tick)
  // the day's form showing, a hot afternoon's water break, and a scuffle
  describeDay(state, ctx, tick)
  waterBreak(state, ctx, tick)
  scuffleTick(state, ctx, tick, min)

  for (const [side, opp, adv] of [[home, away, ctx.hfa], [away, home, 1]] as [SideCtx, SideCtx, number][]) {
    // THE SECOND LAYER (E12, contest.ts): this tick's phase is a contest
    // between men - a carrier into a tackler, a jackal at the ruck - drawn
    // from the main dice (four draws, always, watched or not) and centred
    // on the world's average collision, so it decides who wins the carries
    // the units have earned without moving the season's scoring
    const contest = resolveContest(side, opp, state.players, rng, side === home ? ctx.hfa : 1 / ctx.hfa)
    // the rugby this side plays in the tick, before what it comes to
    describePlay(state, ctx, side, opp, contest)
    // THE CALLED MOVE (1.8.1, moves.ts): what this tick was launched from,
    // and the move called for it. Null for a side with no call there, which
    // leaves every number below exactly as it was.
    const mv = moveInPlay(state, ctx, side, opp, tick)
    if (mv) describeMoveCall(state, ctx, side, opp, mv)
    const mvTry = mv ? 1 + mv.gain : 1
    const mvPen = mv ? 1 + mv.gain * 0.5 : 1
    // THE STYLES (1.8.2, styles.ts): this side's attack into their defence,
    // the line breaks it makes, the gain line it wins and the turnovers it
    // risks. Exactly neutral for a side without a club. No draw.
    const st = styleTick(side.sty, opp.sty, {
      attSet: side.units.scrum + side.units.lineout, defSet: opp.units.scrum + opp.units.lineout,
      attack: side.units.attack, defence: opp.units.defence,
    }, styleWx(ctx.weather, ctx.surface))
    // sure hands in the backs (habits.ts) hold on to more of it
    st.turnP *= side.handsF ?? 1
    side.fwdF = clamp(st.turnP / TURN_BASE, 0.5, 2)
    describeStyle(state, ctx, side, opp, st)
    const scores0 = side.score + opp.score
    // A MAN DOWN COSTS WHAT IT COSTS (1.8.16, coverage list item 35): at 7%
    // a man, a yellow card was worth 2.8 net points to the other side over
    // its ten minutes (incidentprobe), well short of the professional game's
    // figure of about five. MAN_DOWN is the share of the side's strength each
    // missing man takes.
    const numF = 1 - MAN_DOWN * ([...side.yellowUntil.values()].filter(u => u > min).length + side.sent + side.short)
    const oppNumF = 1 - MAN_DOWN * ([...opp.yellowUntil.values()].filter(u => u > min).length + opp.sent + opp.short)
    // the breakdown dials (1.7.3): your commitment protects your own ball, and
    // their contest attacks it - both exactly 1 when nobody has touched them
    const att = (side.units.attack * 0.55 + side.units.breakdown * 0.25 * (side.ruckSecure ?? 1) + side.units.scrum * 0.1 + side.units.lineout * 0.1) * eF(side)
    const def = (opp.units.defence * 0.7 + opp.units.breakdown * 0.3 * (opp.ruckContest ?? 1)) * eF(opp)
    /**
     * THE BOOT IS TERRITORY (audit 16D), AND TERRITORY IS NOW A PLACE (v1.8.0).
     *
     * This used to be the kicking ratio applied straight to the scoring
     * chance: a side with the better boot got a permanent invisible edge. It
     * is now the position that boot has WON - ctx.field above - and the
     * kicking ratio only moves the line.
     *
     * EXACTLY RECIPROCAL between the two sides, which is the property the
     * original was built around and the reason the world mean cannot move:
     * whatever this multiplies one side's chance by, it divides the other's
     * by the same. A line at halfway is 1.0 for both. At their 22 it is
     * about 1.29 for the side attacking and 0.78 for the side defending, and
     * camped on their line (the clamp at 96) 1.89 against 0.53, which through
     * the ratio's power of 2.6 is about five times the try chance before the
     * 0.42 cap: being pinned in your own 22 is not a small disadvantage, and
     * it was previously not a disadvantage at all.
     */
    const up = side === home ? ctx.field : 100 - ctx.field
    const terr = Math.pow(up / Math.max(1, 100 - up), 0.20)
    // what this side chose to do in the zone it is standing in
    const plan = side === home ? hp : ap
    /**
     * HOW WIDE THE PENALTY WINDOW IS, worked out ONCE (v1.8.0).
     *
     * The discipline a zone plan buys belongs to the side GIVING the penalty
     * away, which is the opposition here, so it reads their plan and not this
     * side's. And it is a `const` because the first cut scaled it inline in
     * the penalty branch and left the drop-goal branch below reading the raw
     * figure - which turned the gap between the two into drop-goal territory
     * and would have made a side playing for the corner kick five times as
     * many of them.
     */
    // WHERE PENALTIES ARE GIVEN AWAY (1.7.4). A side defending its own half
    // gives away more of them than one pressing in the other: that is where
    // the pressure is. Kicks at goal are now confined to the opposition half
    // (below), so the chance leans with territory - (up/50)^PEN_LEAN, 1 at
    // halfway - rather than sitting flat across the field.
    // THE SCRUM WINS PENALTIES (1.8.0, ladderprobe). A pack that goes
    // forward at the scrum is where a real side's penalties come from, and
    // here the scrum decided almost nothing: +4 scrummaging across a squad
    // was worth 0.06 points a match. So the side whose scrum is on top draws
    // more of them, bounded, and reciprocal between the two packs so the
    // world's count of penalties does not move.
    // 1.9.0: the scrum's penalties are the ones setPieceTick actually saw
    // given, won minus lost, so two equal packs are exactly neutral and the
    // side going forward draws the whistle. Replaces the old unit ratio.
    const scrumEdge = clamp(1 + SP_PEN_W * ((side.spPens ?? 0) - (opp.spPens ?? 0)), 0.65, 1.7)
    const penWindow = opp.penRisk * (side === home ? ap : hp).penF * Math.pow(up / 50, PEN_LEAN) * scrumEdge * (contest?.penF ?? 1) * mvPen * st.penF
    let ratio = ((att * adv * numF * terr) / Math.max(1, def * oppNumF))
    if (derby) ratio = Math.pow(ratio, 0.72) // form book out the window
    else if (ctx.grudge) ratio = Math.pow(ratio, 0.85) // needle levels the contest
    side.poss += ratio
    let pTry = clamp(TRY_BASE * Math.pow(ratio, 2.6) * (1 + (plan.tryF - 1) * (side.exec ?? 1)) * (contest?.tryF ?? 1) * mvTry * st.tryF * (side.spTryF ?? 1), 0.01, 0.42)
    // THE LAST QUARTER OPENS UP (audit 16D). Measured before this existed:
    // tries were dead flat across the 80 (11.6-14.0% per ten-minute bucket)
    // because both sides drain together and the mutual exhaustion cancels in
    // eF. Real rugby scores roughly a third of its tries after the hour -
    // tired defences miss first. So from tick 15 the shared fatigue itself
    // raises the try chance for BOTH sides; TRY_BASE is set below what the
    // old flat constant was so the season's totals stay on the band.
    if (tick >= 15) {
      /**
       * THE TIRED SIDE IS THE ONE DEFENDING (v1.8.0). This read the AVERAGE
       * of the two tanks, which quietly meant a side raised its own try
       * chance by exhausting itself - and the release audit's own words for
       * the mechanism are "tired defences miss first", not "tired attacks
       * score more". It survived because both sides drain together, so the
       * average and the opponent's figure are nearly the same number all
       * afternoon; it only parts company when the two diverge, which is
       * exactly the case 1.2d exists to test. Measured there: a side emptied
       * from the 68th minute outscored the same side rested, 36.1 to 35.0.
       *
       * In an ordinary match this changes almost nothing, for the same
       * reason it hid for so long.
       */
      const tired = 1 - sideEnergy(opp) / 100
      // AND A TIRED ATTACK GOES NOWHERE (1.8.0, owner: "if a team is tired
      // then they shouldn't score more they should be easier to score
      // against. Subs should be important"). Measured on the 1.2d scenario
      // over the last twelve minutes only, with the first 68 identical: an
      // emptied side already scored less (4.92 v 5.55) and conceded more
      // (3.86 v 3.13), but by too little to feel. The tired defence now
      // gives up to 80% more (was 50%) and a tired attack loses up to 30%,
      // so the bench is where a last quarter is won.
      const own = 1 - sideEnergy(side) / 100
      pTry = Math.min(0.42, pTry * (1 + Math.max(0, tired) * TIRED_DEF) * (1 - Math.max(0, own) * TIRED_ATT))
    }
    // GARBAGE TIME IS REAL (user, after a 106-3 win at a top club: "this would
    // be a tight game in real life - the scores feel well off at present").
    // Past five converted tries of lead nobody keeps the hammer down: the
    // fly-half kicks the corners, the bench gets its run, the skipper points
    // at the posts. The damp sits on the LEADING side's try chance only, so a
    // close game never feels it; the floor keeps a true mismatch a rout
    // rather than a cricket score. Same rng draws either way - the stream is
    // untouched, only the threshold the roll is compared against moves.
    // 1.8.0: the damp starts at 28 rather than 35 and bottoms lower. Territory
    // and the advantage law both add tries at the top of the range, and
    // blowprobe caught the result - two top clubs reached 63, past its stated
    // ceiling of 60 - while the median margin (15) and the 90th percentile
    // (31) had barely moved. A damp that only engages five converted tries in
    // is a damp that never sees the games it exists for.
    const lead = side.score - opp.score
    // 1.8.16: the damp steepens with the lead (power 1.4, floor 0.2). The
    // narrower execution factor made a strong side strong every week rather
    // than most weeks, and blowprobe's mismatch tail went from 34 to 49 in
    // 20,000 past 90. Below 28 up nothing changes; at 56 up the leading side
    // keeps 38% of its chance rather than 50%.
    if (lead > 28) pTry *= Math.max(0.2, Math.pow(28 / lead, 1.4))

    /**
     * PRESSURE (v1.7.0), read off this tick and never rolled for. It decays
     * toward the level this side's threat deserves - a team carving the
     * defence open sits high even between scores, a team pinned in its 22
     * sinks - and the things that actually happen below spike it on top. The
     * decay is what makes it read as MOMENTUM rather than as a stat: a spell
     * of pressure that comes to nothing bleeds away over the next few ticks,
     * the way it does when you are watching.
     */
    side.xTry = (side.xTry ?? 0) + pTry
    evTick(side, opp, pTry, up, mv, st, contest)
    const floor = clamp(pTry * 190, 4, 62)
    side.pressure = clamp(side.pressure * 0.72 + floor * 0.28, 0, 100)

    const r = rng()
    if (r < pTry) {
      side.pressure = clamp(side.pressure + 42, 0, 100)
      opp.pressure = clamp(opp.pressure * 0.55, 0, 100)
      ctx.moveTry = moveTryOf(state, ctx, side, mv, tick)
      // what the try is put down to (EV_CAUSES, in that order)
      ctx.evWhy = ctx.moveTry ? 'move' : evOf(side).lastTurn >= tick - 1 ? 'turn' : pTry >= BREAK_P ? 'break' : 'phase'
      const tries0 = side.tries
      scoreTry(state, ctx, side, min)
      if (ctx.moveTry && side.tries > tries0) {
        const c = evOf(side).calls[ctx.moveTry.id]
        if (c) c[2] += 1
      }
      ctx.moveTry = null
      ctx.evWhy = null
    } else if (r < pTry + penWindow) {
      // a penalty won is a side on the front foot, whatever it does with it
      side.pressure = clamp(side.pressure + 17, 0, 100)
      opp.pressure = clamp(opp.pressure * 0.86, 0, 100)
      // a kickable penalty: yours is a touchline decision, theirs is automatic.
      // THE REFEREE CAN CHANGE HIS MIND, AND A DEFENCE CAN KILL IT (1.8.16):
      // a reversed penalty is the other side's; a cynical one near the line
      // is a card, and within a few metres a penalty try. Either way the
      // advantage draw below is still taken, so the stream after it is where
      // it always was.
      const reversed = reversedPenalty(state, ctx, side, opp, min, tick)
      if (!reversed) concedePenalty(state, ctx, opp, min)
      const cyn = reversed ? null : cynicalIncident(state, ctx, side, opp, min, tick, up, pTry)
      /**
       * ---- ADVANTAGE (design review, v1.6.7) ----
       *
       * The arm goes out and the whistle stays down. Until now it did not:
       * a penalty was awarded and the game stopped dead, which is not how any
       * professional match is refereed and which quietly removed one of the
       * sport's most recognisable moments - the side that takes the space,
       * gets no reward, and hears "advantage over" with three points gone.
       *
       * Three outcomes, one draw:
       *
       *   a try under the advantage      the kick is irrelevant, they scored
       *   advantage over, nothing in it  ground was made, the penalty is gone
       *   back for the penalty           much the most common, and unchanged
       *
       * The try chance rides pTry, so a side already carving the defence open
       * is the side likeliest to make something of it, and the referee's own
       * `flow` governs how readily he waves it away: the same panel that makes
       * one afternoon a stop-start scrum-fest and another a loose one.
       *
       * The infringement still counts against the offending side whatever
       * happens next. Advantage does not pardon anything - the count climbs,
       * and if it has reached the referee's patience the card has already been
       * issued above, exactly as it would be at the next stoppage.
       */
      const advRoll = rng()
      // DELIBERATELY MODEST, because only KICKABLE penalties reach this code
      // (opp.penRisk is the kickable rate). Those are the ones a referee is
      // most careful to bring back, since three points are sitting there. At
      // a quarter of them the penalty mix collapsed from a fifth of the
      // world's points to a seventh; at an eighth it reads right, and the
      // moment is still on the ticker most weeks.
      const pAdvTry = Math.min(0.10, pTry * 0.42)
      const pAdvOver = 0.08 * refFor(ctx.fx.id).flow
      if (reversed || cyn === 'pt') {
        // nothing more to play for: the penalty went the other way, or the
        // seven points are already on the board
      } else if (advRoll < pAdvTry) {
        // they did not need the three: the arm was still out when they scored
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.advPlaying', { team: teamShort(state, side.teamId) })
        ctx.evWhy = 'pen'
        scoreTry(state, ctx, side, min)
        ctx.evWhy = null
      } else if (advRoll < pAdvTry + pAdvOver) {
        // ground made, nothing at the end of it, and the kick is gone with it
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.advOver', { team: teamShort(state, side.teamId) })
      } else if (up < 50) {
        // OUT OF RANGE: KICK FOR TOUCH (1.7.4, owner: "kicks at goal should be
        // limited to within the opposition teams halfway"). A penalty in your
        // own half is not a shot at goal, so nobody is asked and nobody lines
        // one up: the kicker finds touch and the lineout is further up the
        // field. How far is the boot's, with no draw on the stream.
        // the line first, so it is stamped where the penalty was given
        if (detail) pushLine(state, ctx, min, 'SUB', side, 'comm.penTouchOwnHalf', { team: teamShort(state, side.teamId) })
        // the throw is theirs: the next lineout line must not hand it to the
        // other side (owner's screenshot: Cape Town kicked to touch, and the
        // very next line had Northampton throwing in)
        ctx.touchThrow = { teamId: side.teamId, min }
        const gain = 14 + Math.min(12, side.units.kicking * 0.8)
        ctx.field = side === home ? clamp(ctx.field + gain, 4, 96) : clamp(ctx.field - gain, 4, 96)
      } else {
        // NO SCORE AND NO GROUND: he brings it back. This is the common case,
        // and from here the code below is exactly what it always was.
        //
        // A standing instruction answers the call for you (F3). Being asked
        // every time is the right default on a big screen and a nuisance on a
        // phone during a nine-penalty afternoon, so the choice is the manager's.
        const standing = state.clubs[side.teamId]?.tactic.penaltyCall ?? 'ask'
        if (side.isUser && !ctx.decision) {
          ctx.decision = { kind: 'penalty', min, fld: ctx.field }
          if (standing === 'ask') {
            // WATCHED OR NOT, THE CALL WAITS FOR THE END OF THE TICK (1.8.1).
            // A silent match used to kick at once while a watched one held
            // the call and let the rest of the tick draw first, so the same
            // match took its dice in a different order depending on whether
            // anybody was looking. Held here either way; with nobody to ask,
            // playSegment answers 'posts' where a skip would. Silent, the line
            // is not written but still moves the clock (pushLine).
            pushLine(state, ctx, min, 'SUB', side, 'comm.penKickableAsk', { team: teamShort(state, side.teamId) })
          } else {
            // resolveDecision reads ctx.decision and works out the side itself,
            // so the instruction goes through exactly the path a tap would take.
            // THE STANDING CALL HOLDS ON AN INSTANT RESULT TOO (1.8.0): found
            // by scripts/optionsprobe.ts, where corner and tap had changed
            // nothing in a match nobody watched.
            resolveDecision(state, ctx, standing)
          }
        } else if (!side.isUser) {
          // THE AI MAKES THE CALL TOO (owner, 1.8.16: "they should also go to
          // the corner"). It used to kick every penalty at goal.
          const call = aiPenaltyCall(state, ctx, side, opp, min)
          if (call === 'posts') takePenaltyShot(state, ctx, side, min)
          else {
            const was = ctx.evWhy
            ctx.evWhy = 'pen'
            if (call === 'corner') kickToCorner(state, ctx, side, opp, min)
            else tapAndGo(state, ctx, side, opp, min)
            ctx.evWhy = was
          }
        } else {
          takePenaltyShot(state, ctx, side, min)
        }
      }
    } else if (r < pTry + penWindow + dropChance(ctx, side, opp, up, tick)) {
      dropGoalAttempt(state, ctx, side, min, up)
    }

    // A MOVE THAT CAME TO NOTHING STILL MOVED THE BALL (moves.ts): one that
    // came off won the gain line and the ground with it; one that misfired
    // was caught behind it, and a risky one gives away more. No draw.
    if (mv && r >= pTry + penWindow && side.score + opp.score === scores0) {
      const m = mv.gain >= 0 ? mv.gain * 20 : mv.gain * 40 * mv.risk
      backTowards(ctx, side, -m)
      describeMoveOutcome(state, ctx, side, opp, mv)
    }

    // THE STYLE, WHEN THE TICK CAME TO NOTHING (1.8.2): a direct side still
    // won a little of the gain line, and any side can be turned over - an
    // offload that goes to ground, a flat pass picked off, a carrier held up
    // in the choke tackle. On a hash, never a draw, as the moves' ground is
    // (above): of the world, the fixture and the two sides as well as the
    // tick, because a fixture's id alone repeats from world to world (every
    // new career's first fixture is the same number) and the same ticks
    // would be turned over in all of them.
    if (r >= pTry + penWindow && side.score + opp.score === scores0 && side.sty && opp.sty) {
      if (st.ground) backTowards(ctx, side, -st.ground)
      if (moveHash(styleSalt(state, ctx), tick, side === home ? 3 : 4, 0x57) < st.turnP) {
        // where it was lost, for the evidence, before the line moves
        const z = zoneIdx(upOf(ctx, side))
        evOf(side).turnLost[z] += 1
        const eo = evOf(opp)
        eo.turnWon[2 - z] += 1
        eo.lastTurn = tick
        backTowards(ctx, side, TURN_M)
        opp.styTurnWon = (opp.styTurnWon ?? 0) + 1
        side.styTurnLost = (side.styTurnLost ?? 0) + 1
        describeTurnover(state, ctx, side, opp, st)
      }
    }

    // THE AFTERNOON'S INCIDENTS (1.8.16), each on its own dice: when the
    // tick came to nothing, held up over the line close in or a pass picked
    // off further out; and whatever the tick was, the set piece's short arm,
    // the throw that is not straight, and the TMO calling back foul play
    if (r >= pTry + penWindow && side.score + opp.score === scores0) {
      if (!heldUpTick(state, ctx, side, opp, min, tick, up)) interceptTick(state, ctx, side, opp, min, tick, up)
    }
    setPieceTick(state, ctx, side, opp, min, tick)
    tmoFoulTick(state, ctx, side, opp, min, tick)

    // the kicks from hand this side puts in, and any that are charged down
    kicksFromHand(state, ctx, side, opp, min, tick)
    // and when nothing came of the tick, a word for the side that stopped it
    if (side.score + opp.score === scores0) describeDefence(state, ctx, opp, side, contest)

    // atmosphere lines for the live ticker
    if (detail && ctx.crng() < 0.3) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = ps[Math.floor(ctx.crng() * ps.length)]
        const e = side.energy.get(p.id) ?? 70
        if (e < 22 && ctx.crng() < 0.5) {
          pushLine(state, ctx, min, 'SUB', side, TIRED_LINES[Math.floor(ctx.crng() * TIRED_LINES.length)], { player: p.name }, p.id)
        } else {
          const wet = ctx.weather === 'Rain' || ctx.weather === 'Snow'
          const pool = ctx.crng() < 0.035 ? FLAVOR_FUN
            : derby && ctx.crng() < 0.3 ? FLAVOR_DERBY
            : ctx.fx.compId === 'natl1' && ctx.crng() < 0.3 ? FLAVOR_GRASSROOTS
            : ctx.fx.compId === 'pnc' && ctx.crng() < 0.3 ? FLAVOR_PACIFIC
            : wet && ctx.crng() < 0.3 ? FLAVOR_WET
            : ctx.weather === 'Wind' && ctx.crng() < 0.25 ? FLAVOR_WIND
            : FLAVOR
          let key = styledKick(pool[Math.floor(ctx.crng() * pool.length)], state.clubs[side.teamId]?.tactic.kickStyle)
          if (ctx.uncontested && SCRUM_CONTEST_FLAV.has(key)) key = FLAVOR[0]
          // a line that names a man for a hit names one the tackle count
          // already has making hits: it describes the count, it does not add
          // to it (it used to add one, so a watched match's sheet had more
          // tackles than the same match played silently)
          let who = p
          if (TACKLE_LINES.has(key)) {
            const hitters = ps.filter(q => (side.tackles?.get(q.id) ?? 0) > 0)
            if (hitters.length) who = hitters[Math.floor(ctx.crng() * hitters.length)]
            else key = FLAVOR[0]
          }
          pushLine(state, ctx, min, 'SUB', side, key,
            { player: who.name, team: teamShort(state, side.teamId) }, who.id)
        }
      }
    }

    // discipline - tired sides give away more
    const tiredCards = sideEnergy(side) < 35 ? 1.25 : 1
    // CARD_SHARE (1.8.16): the professional foul, the TMO's foul-play call
    // and the scuffle now give their own cards for their own reasons, so the
    // card that comes from nowhere comes a little less often
    if (rng() < side.cardRisk * tiredCards * CARD_SHARE) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(Boolean)
      if (ps.length) {
        const p = wpick(rng, ps, ps.map(x => x.a.agg))
        // A RED CARD IS FOR THE MATCH (owner, 16 Sep 2026): the elite game is
        // trialling a twenty-minute replacement, and this engine keeps the
        // permanent sending-off by decision, not by omission (RED-CARD-01).
        if (rng() < 0.06) {
          side.sent += 1
          side.onPitch.delete(p.id)
          p.stats.rc += 1
          p.bans += 2 + Math.floor(rng() * 2)
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 2)
          pushLine(state, ctx, min, 'RC', side, 'comm.redCard', { player: p.name }, p.id)
          checkFrontRow(state, ctx, side, min, p, 'red')
        } else if (side.onPitch.size > 13 && !side.yellowUntil.has(p.id)) {
          // NEVER BELOW THIRTEEN FOR A YELLOW (1.8.3): the repeated-penalty
          // bin has always stopped at thirteen on the pitch (concedePenalty)
          // and this one did not, so a side already two down could lose a
          // third. Same floor here; the draws above are taken either way, so
          // the stream does not move, only the card that is no longer shown.
          side.yellowUntil.set(p.id, binUntil(ctx, min))
          // he SITS the ten minutes: off the pitch pools, so a man in the bin
          // cannot score a try, take another card or pull an injury while he
          // sits (audit 16D). numF still charges the missing man's strength.
          side.onPitch.delete(p.id)
          side.binned.add(p.id)
          p.stats.yc += 1
          side.ratings.set(p.id, (side.ratings.get(p.id) ?? 6) - 0.7)
          // and it says what it was for (item 26 among them), words only
          pushLine(state, ctx, min, 'YC', side, ctx.detail ? said(ctx, YC_REASONS) : 'comm.yellowCard', { player: p.name, team: teamShort(state, side.teamId) }, p.id)
          checkFrontRow(state, ctx, side, min, p, 'yellow')
        }
        fieldChanged(state, ctx, side, min)
      }
    }

    // injury - tired legs and rusty returners break down more.
    //
    // THE HOME SURFACE TERM IS GONE (v1.8.1). It read the pitch facility,
    // which is the TRAINING pitch now: a match is played at the ground, not
    // on the field the squad does its ruck work on, so a training pitch
    // cannot keep anybody on their feet on a Saturday. What it does keep
    // people on their feet through is TRAINING, and that is where the term
    // has moved to (season.ts, the Tuesday session).
    // CONTACT AND THE GROUND (conditions.ts injuryF): the carrying game and
    // the rush defence that meets it, on a hard pitch, take a bigger share of
    // the roll; centred on the world, so it shifts who is hurt more than how
    // many. The draw is the same draw; only what it is compared with moves.
    // (1.8.14: 0.043, from 0.036. Losing six first-choice men for nine weeks
    // moved the strongest club in France from 1.83rd to 2.0th: a big squad
    // shrugged off a crisis. A fifth more knocks makes depth a decision.
    // Same draw, a different threshold.)
    if (rng() < 0.043 * injuryF(side.sty, opp.sty, ctx.surface ?? 'hybrid')) {
      const ids = [...side.onPitch]
      const ps = ids.map(id => state.players[id]).filter(p => p && !p.injury)
      if (ps.length) {
        const w = ps.map(p => {
          const rustF = (p.rust ?? 0) > 0 ? 3.4 : 1
          const tiredF = (side.energy.get(p.id) ?? 70) < 25 ? 1.8 : 1
          const loadF = inRedZone(p) ? 1.5 : 1 // 1,300+ season minutes
          // a brittle man tired or rushed back is likelier to be the one
          // (formtraits.ts): it chooses who, the roll above decides how often
          return rustF * tiredF * loadF * brittleF(state.seed, p, tiredF > 1)
        })
        const p = wpick(rng, ps, w)
        const [dk, lo, hi] = pickInjury(rng, genderOf(state))
        let weeks = lo + Math.floor(rng() * (hi - lo + 1))
        if (weeks <= 1 && (p.rust ?? 0) === 0 && rng() < 0.55) {
          // a knock, not a casualty: he plays on with heavy legs
          side.energy.set(p.id, Math.max(5, (side.energy.get(p.id) ?? 70) - 28))
          pushLine(state, ctx, min, 'SUB', side, 'comm.heavyKnock', { player: p.name }, p.id)
        } else {
          if (p.clubId === state.userClubId) {
            // the physio and the recovery centre both shorten a lay-off
            const care = (state.staff?.physio ?? 0) * 0.12 + facLevel(state, 'recovery') * 0.03
            if (care > 0) weeks = Math.max(1, Math.round(weeks * (1 - care)))
          }
          p.injury = { desc: tIn('en', dk), dk, until: state.week + weeks, weeks }
          p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk, weeks }].slice(-20)
          side.onPitch.delete(p.id)
          pushLine(state, ctx, min, 'INJ', side, 'comm.injuryDown', {
            player: p.name, injury_k: dk,
            rush_k: (p.rust ?? 0) > 0 ? 'comm.injuryRushedBack' : 'common.nothing',
          }, p.id)
          // THE MANAGER PICKS (1.9.1). In a match he is watching, his own man
          // goes down and nobody comes on until he has chosen who (owner: "it
          // shouldnt be auto select - the player must select them ... the
          // game cant continue"). The engine used to send the assistant's
          // pick on at once and simulate the rest of the minute with him, so
          // the replacement was already running in the pitch animation
          // before the injury was ever on screen ("number 20 ... was already
          // in the animation before the notification"). Now the side plays
          // the rest of the tick a man short and the match waits (injWait)
          // for coverInjury. With nobody left who can come on, there is
          // nothing to choose and it goes on as it always has.
          if (ctx.manualInj && side.isUser && !ctx.assistantSubs && injuryCoverFor(state, side, p)) {
            side.short += 1
            ;(ctx.injWait ??= []).push({ home: side === ctx.home, hurtId: p.id, at: ctx.events.length - 1, min })
            fieldChanged(state, ctx, side, min)
            side.lastInj = { hurtId: p.id, coverId: null, upTo: ctx.events.length }
          } else {
            sendOnForInjury(state, ctx, side, p, min, null)
          }
        }
      }
    }

    // Head Injury Assessment: ~1 per 3 matches. Temporary sub while the
    // doctors work; 40% fail and the replacement becomes permanent.
    if (side.hia && ctx.tick >= side.hia.returnTick) {
      const { pid, subId, failed } = side.hia
      const p = state.players[pid]
      const sub = state.players[subId]
      if (p && sub) {
        if (failed) {
          const rtp = 2 + (((pid + ctx.tick) % 2)) // return-to-play: two or three weeks
          // desc + dk, like every other injury written in this file: desc is
          // the stored-English fallback, dk is what a French screen renders.
          // This line used to store the bare English string, so a failed HIA
          // was the one complaint on the Medical screen that ignored the
          // reader's language (release audit, 25 Aug).
          p.injury = { desc: tIn('en', 'injury.hiaFail'), dk: 'injury.hiaFail', until: state.week + rtp, weeks: rtp }
          p.injLog = [...(p.injLog ?? []), { s: state.season, w: state.week, dk: 'injury.hiaFail', weeks: rtp }].slice(-20)
          const slot = side.lineup.indexOf(pid)
          const bSlot = side.lineup.indexOf(subId)
          if (slot >= 0 && slot < 15) { side.lineup[slot] = subId; if (bSlot >= 0) side.lineup[bSlot] = pid }
          pushLine(state, ctx, min, 'INJ', side, 'comm.hiaFailed', { player: p.name, sub: sub.name }, pid)
          checkFrontRow(state, ctx, side, min, p, 'hia')
        } else if (side.onPitch.has(subId)) {
          side.onPitch.delete(subId)
          side.onPitch.add(pid)
          pushLine(state, ctx, min, 'SUB', side, 'comm.hiaPassed', { player: p.name }, pid)
        } else if (side.binned.has(subId)) {
          // THE STAND-IN IS IN THE BIN. The side is a man down for the card
          // whoever the man is: the assessed man takes the rest of the ten
          // minutes' place (he comes on when the bin ends) and the stand-in
          // goes back to the bench. Swapping him straight on made sixteen
          // when the bin emptied (journeyprobe: 15 on and 1 binned at FT).
          side.binned.delete(subId)
          side.binned.add(pid)
          side.yellowUntil.set(pid, side.yellowUntil.get(subId) ?? min)
          pushLine(state, ctx, min, 'SUB', side, 'comm.hiaPassed', { player: p.name }, pid)
        }
        // otherwise the stand-in has already gone (sent off, or hurt and
        // replaced himself): the place he held is spoken for, so the assessed
        // man stays on the bench rather than make a sixteenth
      }
      side.hia = undefined
      fieldChanged(state, ctx, side, min)
    }
    if (!side.hia && rng() < 0.0085) {
      const ids = [...side.onPitch].filter(id => state.players[id] && !state.players[id].injury)
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      const sub = p ? pickBenchSub(state, side, p.id) : null
      if (p && sub) {
        side.onPitch.delete(p.id)
        side.onPitch.add(sub.id)
        cameOn(side, sub.id, min)
        side.ratings.set(sub.id, 6)
        side.energy.set(sub.id, benchTank(sub))
        side.hia = { pid: p.id, subId: sub.id, failed: rng() < 0.4, returnTick: ctx.tick + 3 }
        // the smart mouthguard flags more of them than the eye does now
        // (item 56): which of the two lines is said is words only
        pushLine(state, ctx, min, 'INJ', side, ctx.detail && ctx.crng() < 0.4 ? 'comm.hiaMouthguard' : 'comm.hiaLedAway', { player: p.name, sub: sub.name }, p.id)
        fieldChanged(state, ctx, side, min)
      }
    }

    // stupid moments - rugby's comedy reel, momentum goes the other way
    if (rng() < 0.006) {
      const ids = [...side.onPitch]
      const p = ids.length ? state.players[ids[Math.floor(rng() * ids.length)]] : null
      if (p) {
        const lines = ['comm.howler1', 'comm.howler2', 'comm.howler3', 'comm.howler4', 'comm.howler5']
        pushLine(state, ctx, min, 'SUB', side, lines[Math.floor(rng() * lines.length)], { player: p.name }, p.id)
        side.ratings.set(p.id, clamp((side.ratings.get(p.id) ?? 6) - 0.5, 1, 10))
        ctx.momo = clamp(ctx.momo + (side === home ? -0.3 : 0.3), -1, 1)
      }
    }

    aiAutoSubs(state, ctx, side, min)
  }

  // momentum needle: who owned the last few minutes
  const dh = home.poss - poss0[0]
  const da = away.poss - poss0[1]
  countTackles(state, ctx, tick, dh, da)
  ctx.momo = clamp(ctx.momo * 0.62 + (dh - da) * 0.55, -1, 1)
  // rolling possession history: each entry is the home share of one tick,
  // so the live 'LAST 10 MINUTES' graphic can average the recent window
  ;(ctx.momoHist ??= []).push(dh + da > 0 ? dh / (dh + da) : 0.5)
  // and the scoreboard at the end of it, for the lead changes (evidence.ts)
  ;(ctx.marginHist ??= []).push(home.score - away.score)
}
