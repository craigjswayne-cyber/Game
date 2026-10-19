// A side in a match: its modifiers, its context and the evidence it gathers.
// Split out of matchEngine.ts, which re-exports the public parts.
import type { Contest } from '../contest'
import type { BenchSplit } from '../bench'
import type { SideStyle } from '../styles'
import type { Units } from './selection'
import type { MoveInPlay } from './commentary'
import type { DayUnit } from './day'
import type { LiveCtx } from './live'

/** In-match multipliers that must outlive a unit recompute. */
export interface SideMods {
  scrum: number; lineout: number; breakdown: number
  attack: number; defence: number; kicking: number
  tempo: number; card: number
}

export const freshMods = (): SideMods => ({
  scrum: 1, lineout: 1, breakdown: 1, attack: 1, defence: 1, kicking: 1, tempo: 1, card: 1,
})

/**
 * The kickable-penalty rate: how physical you are, priced by who is refereeing.
 *
 * ---- WHY THIS IS A FUNCTION AND NOT TWO LINES OF ARITHMETIC ----------------
 *
 * penRisk has to be computed twice. Once in the dial block, which runs before
 * the referee is known and again on every substitution, and once in beginMatch
 * the moment the whistle is appointed. Two copies of a formula is how the
 * refPenF bug happened in the first place, so there is one copy and both call
 * it.
 *
 * ---- WHY AGGRESSION READS THE REFEREE (release audit, Pass 2) --------------
 *
 * scripts/dialweight.ts measured all six tactical dials over four seeds and
 * found aggression worth 1.3 points of difference across a whole season - noise.
 * It was wired up and it did nothing, because the breakdown it bought and the
 * penalties it conceded cancelled almost exactly. That sounds like balance and
 * is actually the absence of a decision: there was no opponent, no scoreline and
 * no referee against which moving it was right.
 *
 * THE ONLY CHANGE HERE IS THE SLOPE. The gain (breakdown 0.06), the base penalty
 * coefficient (0.20) and the card risk (0.006) are exactly what they always were,
 * because the original measurement said that combination is mean-neutral and
 * nothing has been found wrong with it. What is new is that THE COST NOW SCALES
 * WITH THE WHISTLE, and the whistle is on the pre-match briefing:
 *
 *   average referee (rp 1.00)   coefficient 0.20
 *   fussy at the tackle (1.15)  coefficient 0.32 - physicality is expensive
 *   lets a lot go      (0.85)   coefficient 0.08 - physicality is cheap
 *
 * ---- WHY THE MAGNITUDES WERE PUT BACK -----------------------------------
 *
 * They were raised first (breakdown to 0.09, penalties to 0.30, cards to 0.009)
 * on the theory that a louder trade makes a sharper decision. Three measured
 * iterations later that theory had cost more than it bought:
 *
 *   0.30 measured +2.67 / -1.63 either side of the panel, which looked perfect -
 *   but was taken on a build where an assignment in the referee block was wiping
 *   the defensive line's own penalty cost. My bug, caught by splitprobe.
 *   With that restored, the same split read -2.29 / -4.29: never worth doing.
 *   0.20 then read +3.14 / +1.56: always worth doing. Neither straddles zero.
 *
 * And across those same three runs STYLE - which no edit touched - measured
 * +5.16, then +2.09, then -0.10. Sixteen observations an arm cannot pin a dial
 * to better than about two points a match, so all three of those calibrations
 * were chasing noise, and a fourth would have been too.
 *
 * So the magnitudes go back to the values whose mean-neutrality was already
 * measured, and only the slope - the genuinely new idea, and the one that does
 * not depend on the base being any particular size - stays. A smaller change
 * defended by the evidence that exists beats a larger one defended by three
 * readings that disagree with each other.
 *
 * So the same slider is right against one referee and wrong against another, and
 * the panel that has been on the briefing since F1 finally has something to say.
 *
 * MEAN-NEUTRAL ON BOTH COUNTS, which is why the world average cannot move: the
 * panel's tolerances mean exactly 1.0, so E[0.30 + 0.80 * (rp - 1)] is 0.30; and
 * philosophy.ts mirrors every dial pair about 50, so the world's mean aggression
 * is exactly neutral and E[aggF] is 0. Measured, not argued - see disttest.
 */
export function aggPenRisk(aggF: number, rp: number): number {
  return 0.115 * rp * (1 + aggF * (0.20 + 0.80 * (rp - 1)))
}

/** Every part of the penalty price that reads the whistle: the aggression
 *  price above and the ruck contest's (the dial block's `1 + rk * 0.11 *
 *  refPenF`). The kick-off swaps for the referee and the crowd went through
 *  aggPenRisk alone, so the ruck term kept the referee-blind factor of 1
 *  until the side's first recompute, and a manager's penalty rate shifted a
 *  little the first time he made any change (1.8.1). rk is read back off
 *  ruckContest, which the same block sets to `1 + rk * 0.1`. */
export function refPenPrice(side: SideCtx, rp: number): number {
  const rk = ((side.ruckContest ?? 1) - 1) / 0.1
  return aggPenRisk(side.aggF, rp) * (1 + rk * 0.11 * rp)
}

/** Layer a multiplier on a side so that it survives the next substitution. */
export function layer(side: SideCtx, k: keyof SideMods, m: number) {
  if (m === 1) return
  side.mods[k] *= m
  if (k === 'tempo') side.tempoF *= m
  else if (k === 'card') side.cardRisk *= m
  else side.units[k] *= m
}

export interface SideCtx {
  teamId: string
  lineup: (number | null)[]
  units: Units
  score: number
  tries: number
  ratings: Map<number, number>
  /** the SETTLED marks, written once at full time.
   *
   *  `ratings` above is the raw in-match accumulator - a try here, a card
   *  there - and MatchDay's full-time panel used to render it straight, so the
   *  mark on screen was missing the result, the margin and the spread that
   *  finalizeMatch adds. A manager saw 6.0 while 6.6 went into the season
   *  average, his form and Player of the Month.
   *
   *  A SECOND MAP RATHER THAN OVERWRITING THE FIRST, deliberately: settling in
   *  place would make finalizeMatch destructive, and a second run over the same
   *  ctx would then feed a settled mark back through the formula and compound
   *  it. This way the operation is idempotent whatever the resume path does.
   *  Absent until full time, which is also what lets the panel show live marks
   *  at half time and settled ones after. */
  finalR?: Map<number, number>
  onPitch: Set<number>
  /** the minute each replacement came on (starters are absent: they have
   *  been on since the kick-off). Only the in-match player sheet reads it, to
   *  share a side's tackles by the minutes each man has been out there. */
  onAt?: Map<number, number>
  /** KICKS AT GOAL (1.8.0): conversions, penalties and drop goals taken and
   *  put over. Counted, never drawn, so they cannot move the stream; they are
   *  what lets a side that dominated and lost see that it missed five kicks. */
  kicksAt?: number
  kicksMade?: number
  /** KICKS FROM HAND (1.8.0, kicksFromHand): clearances, box kicks and kicks
   *  for territory this side put boot to, and how many of them were charged
   *  down. Absent on a match begun by an older build. */
  handKicks?: number
  chargedDown?: number
  /** TACKLES MADE AND MISSED, by player (1.8.0, countTackles). */
  tackles?: Map<number, number>
  missed?: Map<number, number>
  yellowUntil: Map<number, number>
  /** players currently sitting out a yellow - off the pitch, back in ten.
   *  Before this existed a sin-binned man stayed in onPitch and could score
   *  a try from inside the bin (audit 16D). */
  binned: Set<number>
  sent: number // players lost to RC
  /** players the side had to take off under Law 3.20 - a front-row card with
   *  nobody trained to cover costs a second player, so the uncontested scrum
   *  the card bought is never a free lunch. Charged like a sending-off in
   *  numF, but not a card in anybody's record. */
  short: number
  cardRisk: number
  /** per-tick chance of conceding a kickable penalty. Was a flat 0.115 for
   *  every side in the world, which made Physicality a free lunch: the dial
   *  bought breakdown and its only cost was the (6x smaller) card roll. Now
   *  aggression and the referee's tackle tolerance set the rate (audit 16D). */
  penRisk: number
  /** the referee's contribution to penRisk, locked in at kick-off so a unit
   *  recompute can rebuild the dial part without losing the whistle */
  refPenF?: number
  /** the breakdown dials (1.7.3): how much this side's commitment protects
   *  its own ball, and how hard its contest attacks the opponent's. 1 is none */
  ruckSecure?: number
  ruckContest?: number
  /** f(aggression), -1..1, stashed at build time. penRisk is now computed in two
   *  places - once before the referee is known and again once he is - and both
   *  need the dial. Storing the resolved figure is what stops the two copies of
   *  the formula drifting apart, which is the bug the refPenF comment above was
   *  itself written about. */
  aggF: number
  poss: number // accumulated momentum, for possession stats
  /**
   * ---- PRESSURE, 0 TO 100 (owner, v1.7.0) ----
   *
   * Competitor read: two bars beside the pitch saying who is on top right
   * now. It is the one thing a commentary ticker cannot do - a ticker tells
   * you what happened, and this tells you how the afternoon FEELS - and it
   * needs no animation, no art and no ball-by-ball simulation.
   *
   * Independent per side rather than a share of one bar, which is what makes
   * it honest: in a scrappy ten minutes where neither side can get out of
   * its own half, BOTH bars are low, and a single seesaw would have to claim
   * somebody was on top.
   *
   * It is DERIVED, never rolled: it reads the tick that just happened, so it
   * spends no rng and cannot move a result. A try is a spike, a penalty won
   * is a nudge, and it decays toward whatever the side's attacking threat
   * says it ought to be sitting at, so a spell of pressure builds and then
   * bleeds away when nothing comes of it.
   */
  pressure: number
  /** THE TRIES THIS SIDE'S RUGBY WAS WORTH (1.8.1): the sum of its try
   *  chance over the ticks, before the dice. Read by scripts/movesprobe.ts,
   *  which needs a measure of what a call did that the one roll a tick does
   *  not drown; nothing in the game reads it. */
  xTry?: number
  pens: number // penalty goals kicked
  /** penalties conceded - repeated infringements bring the bin into play */
  consPens: number
  /** per-player petrol tank, 0-100 - drains with minutes played */
  energy: Map<number, number>
  /** TEAM TALKS (teamtalk.ts): each man's match-day multiplier from how he
   *  took the talk, read by teamUnits on every rebuild; the reaction itself,
   *  carried into his morale at full time; and how far the pre-match talk
   *  moved him, which is still in him at the break. Absent on every side
   *  nobody spoke to. */
  talkF?: Map<number, number>
  talkR?: Map<number, number>
  talkShift?: Map<number, number>
  /** drain multiplier from tempo tactics */
  /** how far the style dial is from the squad's natural shape, as a unit cost (1.8.14) */
  styleMisfit?: number
  tempoF: number
  /** energy-drain multiplier from match preparation (fitness week) */
  drainF: number
  /** the AI coach's one in-match tactical shift has been made */
  shifted?: boolean
  /** repetition-fatigue petrol multiplier, set once at mkSide - survives the
   *  substitution rebuild because nothing ever reassigns it */
  repF?: number
  /** how many times a REACTIVE dugout has changed its picture (max 2) */
  reacted?: number
  /** an active Head Injury Assessment: who went off, who covers, verdict due */
  hia?: { pid: number; subId: number; failed: boolean; returnTick: number; upTo?: number; atTick?: number }
  /** THE LAST INJURY STOPPAGE, as the engine resolved it (owner, round 6):
   *  who went down, who the assistant sent on (null when nobody could go on)
   *  and where the stoppage's own lines end in ctx.events. The injury sheet
   *  reads the cover from here rather than guessing it from the next line of
   *  commentary, and the free override is judged against `upTo`, so a line
   *  written at the same stoppage (playing out of position, uncontested
   *  scrums) is not mistaken for the cover having played. Never read by the
   *  simulation, never a draw. */
  /** `atTick` (head assessments, 1.9.2): the ctx.tick the stoppage is
   *  answered at; once play has moved past it the cover is settled */
  lastInj?: { hurtId: number; coverId: number | null; upTo: number }
  /** goal-kicking bonus from the kicking coach */
  goalBonus: number
  /** players in this side facing a former club today - the old boys */
  exIds: Set<number>
  isUser: boolean

  // ---- the bench economy (F4) ----------------------------------------------
  /** Persistent multipliers layered on top of a freshly computed unit set.
   *
   *  recomputeSideUnits rebuilds units from the lineup and re-runs the tactic
   *  modifiers, so anything the match itself layered on gets wiped by the next
   *  substitution. Bench effects live here and applyModifiers puts them back. */
  mods: SideMods
  /** the split this side named its bench under */
  split: BenchSplit
  /** who was sitting on the bench at kick-off. The lineup array is mutated by
   *  every substitution, so this is the only reliable record of the plan. */
  benchIds: Set<number>
  /** bench seat (0-7) each replacement sat in, for looking up his brief */
  seatOf: Map<number, number>
  /** the last-quarter reshape has been applied */
  finisherDone?: boolean
  /** briefed replacements whose instructions have already taken effect */
  briefsUsed?: number
  /** a man is playing out of his depth after a forced positional switch */
  coverBlown?: boolean

  // ---- THE AFTERNOON ITSELF (1.8.16, see THE AFTERNOON'S INCIDENTS) ----------
  /** how each unit is going today: the lineout that will not fire, the scrum
   *  that is on top. Set once at kick-off, layered so a sub keeps it. */
  day?: Partial<Record<DayUnit, number>>
  /** the number each man wore at kick-off, by player id (1.8.16) */
  shirtNo?: Record<number, number>
  /** how well the side is executing its plan today: scales what its called
   *  moves and its zone plans are worth, never their sign */
  exec?: number
  /** scrum free kicks against this side, for the full-arm escalation */
  scrumFK?: number
  /** free kicks this side has won, and offences it has been named for */
  freeKicks?: number
  /** tries each man has scored in this match (the hat-trick and records) */
  matchTries?: Map<number, number>
  /** THE SET PIECE, COUNTED (1.9.0, setPieceTick): scrums and lineouts this
   *  side fed and kept or lost, as they happened. Absent on a match begun by
   *  an older build, which matchStats then estimates the old way. */
  sp?: { sw: number; sl: number; lw: number; ll: number; pen: number }
  /** this tick's set piece, read by the scoring roll and the drain: a try
   *  multiplier for the ball it gave, the penalties it won, and how many
   *  scrums the pack packed down (both feeds) */
  spTryF?: number
  spPens?: number
  spScrums?: number
  /** the minute of this side's first try, for the fastest-try record */
  firstTryMin?: number
  /** and who scored it */
  firstTryBy?: number
  /** the referee has had a word with this side's captain */
  warned?: number
  /** penalty tries awarded to this side */
  penTries?: number
  /** 50:22s this side has found */
  fifty22?: number

  // ---- who was out there, and for how long ----------------------------------
  /** the XV on the pitch when the first tick ran. The lineup array is
   *  rewritten by every substitution, so reading it at full time handed the
   *  start to whoever finished the match in the shirt. */
  starters?: Set<number>
  /** the minute each man now on the pitch began his current stint */
  since?: Map<number, number>
  /** minutes each man has banked from stints that have ended */
  played?: Map<number, number>
  /** the personnel the units were last built from (see fieldChanged) */
  unitsKey?: number | string
  /** THE STYLES THIS SIDE PLAYS (1.8.2, styles.ts) and how well the men on
   *  the pitch suit them, set with the units (applyModifiers), so a change of
   *  personnel or of style re-reads it. Absent for a side with no club (a
   *  Test side), which the style arithmetic reads as neutral. */
  sty?: SideStyle
  /** the style fits, kept against the shirts and styles they were scored on */
  styFit?: { k: string; atkFit: number; defFit: number }
  /** turnovers this side's defence won through its style, and how many of
   *  its own ticks it lost the ball in (styleprobe reads both) */
  styTurnWon?: number
  /** the ball this side lost in its own ticks that came to nothing (the
   *  half-time read counts it) */
  styTurnLost?: number
  /** its backs' sure hands (habits.ts): a multiplier on the chance a tick
   *  that comes to nothing is turned over, 1 for an average side */
  handsF?: number
  /** this tick's handling error against the world's (styleTick turnP over
   *  TURN_BASE): the forward pass in a try's build-up reads it (scoreTry) */
  fwdF?: number
  /** the tries this side has gone over for, stood or not, which keys the
   *  forward-pass hash; and how many the TMO ruled out or let stand for one */
  tryCalls?: number
  fwdRuledOut?: number
  fwdStood?: number
  /** a man taken off under Law 3 while a front-rower sits a yellow, back on
   *  when the binned man returns (checkFrontRow) */
  lawOut?: { id: number; binned: number } | null
  /** Law 3 with the cover on the bench (frontRowCardCover): a front-rower
   *  sits a yellow, a trained replacement wears his shirt (`shirt`) and
   *  `off` makes way for him. When the binned man's ten minutes end he takes
   *  his shirt back, the replacement goes to the bench and `off` returns.
   *  `swap` false once another man's return has settled the shirt: only
   *  `off` is owed his place back. */
  frCover?: { binned: number; on: number; off: number; shirt: number; swap: boolean }[]
  /** the men sent off who sit in a replacement's seat, because the
   *  replacement took the front-row shirt (frontRowCardCover): never cover */
  sentOff?: Set<number>
  /** the men already named in the commentary as out of a specialist shirt */
  specSaid?: Set<number>
  /** the three set-piece units summed over the ticks played, and how many.
   *  The coach's verdict reads the match's average from these: now that a
   *  side's units follow its replacements, the full-time figure is the pack
   *  that finished the game, not the one that contested most of it. */
  setAcc?: { scrum: number; lineout: number; breakdown: number; n: number }
  /** WHAT THE MATCH WAS MADE OF (1.8.3, evidence.ts): counts kept as the
   *  ticks run, from numbers each tick has already worked out, so the full
   *  time and half time reads can say why without guessing. Never drawn,
   *  never read by the simulation; absent on a match begun by an older build. */
  ev?: EvCount
}

/** The causes a point can be put down to (EvCount.pts), in this order of
 *  precedence for a try: a called move that made it, a turnover won in that
 *  tick or the one before, a line break (a tick whose try chance cleared
 *  BREAK_P), and phase play for the rest of open play. Then the other side's
 *  penalties (the kick, the corner, the tap and a try under advantage), and
 *  the boot (drop goals, and the try off a charge-down). A conversion goes
 *  with its try. */
export const EV_CAUSES = ['move', 'turn', 'break', 'phase', 'pen', 'kick'] as const
export type EvCause = typeof EV_CAUSES[number]

/** A LINE BREAK, as the engine sees one: a tick whose try chance, after
 *  everything (units, ground, plan, contest, move, style, the clock), is at
 *  least this. About five in a match for a side (evidenceprobe), more in a
 *  mismatch; the counter only names the ticks, it decides nothing. */
export const BREAK_P = 0.2

/** the zone a side is in, by its own distance up the pitch (tactics.zoneAt):
 *  0 its own 22, 1 the middle, 2 the opposition 22 */
export const zoneIdx = (up: number): 0 | 1 | 2 => up < 22 ? 0 : up > 78 ? 2 : 1

export interface EvCount {
  /** per move called: [calls, metres it won or lost (the line's own move),
   *  tries it made, calls the tape blunted, metres the blunting cost] */
  calls: Record<string, number[]>
  /** points by cause, in EV_CAUSES order; they sum to the side's score */
  pts: number[]
  /** line breaks, and ticks where this side won its carry (contest) */
  breaks: number
  carries: number
  /** the style matchup summed over this side's ticks (styles.ts m), and the
   *  tries the style added over the world's (the try chance it multiplied) */
  sty: number
  styX: number
  /** ticks this side played in each zone (its plan's zone), own 22 first */
  zone: number[]
  /** turnovers won and lost, by the zone (from this side's view) they
   *  happened in; and the tick of the last one won (for the try that follows) */
  turnWon: number[]
  turnLost: number[]
  lastTurn: number
  /** the try chance the tape took off this side's calls (armsrace.ts) */
  bluntX: number
}

/** the counters, made on first use, so an old match reads as empty */
export function evOf(side: SideCtx): EvCount {
  return (side.ev ??= {
    calls: {}, pts: [0, 0, 0, 0, 0, 0], breaks: 0, carries: 0, sty: 0, styX: 0,
    zone: [0, 0, 0], turnWon: [0, 0, 0], turnLost: [0, 0, 0], lastTurn: -9, bluntX: 0,
  })
}

/** Points on the board, put down to what made them: the cause the scoring
 *  path set on ctx.evWhy, else phase play (a penalty kick and a drop goal
 *  name their own). */
export function evPts(ctx: LiveCtx, side: SideCtx, n: number, cause?: EvCause) {
  const c = cause ?? ctx.evWhy ?? 'phase'
  evOf(side).pts[EV_CAUSES.indexOf(c)] += n
}

/** One tick's worth of evidence for the side with the ball, read off what
 *  simTick has just worked out for it: where it was, whether the tick was a
 *  line break, who won the carry, what the style matchup and the called move
 *  were worth, and what the tape took off the call. */
export function evTick(side: SideCtx, opp: SideCtx, pTry: number, up: number,
  mv: MoveInPlay | null, st: { m: number; tryF: number }, contest: Contest | null | undefined) {
  const ev = evOf(side)
  ev.zone[zoneIdx(up)] += 1
  if (pTry >= BREAK_P) ev.breaks += 1
  if (contest && contest.dominance > 0.5) ev.carries += 1
  if (side.sty && opp.sty) {
    ev.sty += st.m
    if (st.tryF > 0) ev.styX += pTry * (1 - 1 / st.tryF)
  }
  if (!mv) return
  // the ground the call moves the line by when the tick comes to nothing
  const metres = (g: number) => g >= 0 ? g * 20 : g * 40 * mv.risk
  const c = (ev.calls[mv.id] ??= [0, 0, 0, 0, 0])
  c[0] += 1
  c[1] += metres(mv.gain)
  if (mv.gain0 != null && mv.gain0 !== mv.gain) {
    c[3] += 1
    c[4] += metres(mv.gain0) - metres(mv.gain)
    ev.bluntX += pTry * ((1 + mv.gain0) / Math.max(0.05, 1 + mv.gain) - 1)
  }
}

/**
 * The shirts the units are built from. The lineup, except that a man off for
 * a head injury assessment is played by his stand-in: the HIA keeps the
 * assessed man's name on the shirt so that he can come back to it, and the
 * units used to go on reading his attributes for the ten minutes somebody
 * else was wearing it.
 *
 * A man in the bin or sent off keeps his place here on purpose. numF charges
 * the missing man, and building the units without him as well (teamUnits
 * reads an empty shirt as a 5 in everything) would charge him twice.
 */
export function fieldLineup(side: SideCtx): (number | null)[] {
  const h = side.hia
  if (!h || !side.onPitch.has(h.subId)) return side.lineup
  const i = side.lineup.indexOf(h.pid)
  if (i < 0 || i > 14) return side.lineup
  const out = side.lineup.slice()
  out[i] = h.subId
  return out
}

/** Everything a rebuild of the units reads that a match can change: the
 *  shirts (with an HIA stand-in in his) and who is on the pitch. */
export function personnelKey(side: SideCtx): number {
  // A number, not a string (1.8.0): this runs at the top of every tick for
  // both sides of every match in the world, and joining and sorting two lists
  // there cost a week about a third of its time (perfprobe, 99-126 ms to
  // 141-158 ms). The shirts are hashed in order, the men on the pitch by an
  // order-free mix, and a rebuild is all a collision could ever cost.
  const lu = fieldLineup(side)
  let h = 17
  for (let i = 0; i < 15; i++) h = (Math.imul(h, 31) + (lu[i] ?? -1)) | 0
  let set = side.onPitch.size
  for (const id of side.onPitch) set = (set + Math.imul(id ^ (id >>> 7), 0x9e3779b1)) | 0
  return (h ^ Math.imul(set, 0x85ebca6b)) | 0
}
