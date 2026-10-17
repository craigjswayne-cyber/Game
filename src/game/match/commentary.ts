// The commentary: colour, the line memory, and the descriptions of play.
// Split out of matchEngine.ts.
import type { GameState, Player } from '../model'
import type { Contest } from '../contest'
import { clamp, hashString } from '../rng'
import { MOVE_BY_ID, MOVE_MAKER, RED_ZONE, anyCall, callForTick, callsOf, launchOf, mixHash, moveEdge, moveFit, moveHash, moveMatchup, sayKey, type Launch } from '../moves'
import { atkSay, defSay, moveAffinity } from '../styles'
import { teamShort } from './selection'
import type { SideCtx } from './side'
import { DEF_HIT, DEF_SET, LATE_CHASE, LATE_HOLD, LATE_LEVEL, PBP_DEEP, PBP_MID, PBP_PHASES, PBP_RED, PBP_RUCK, PBP_WET, RESTART, SP_LINEOUT, SP_SCRUM, SP_SCRUM_UNCONTESTED, TERR_CAMPED, TERR_MIDDLE } from './lines'
import { type LiveCtx, pushLine } from './live'

/**
 * A line of colour: written only when somebody is watching, and stamped at
 * the minute the clock has ALREADY reached. pushLine moves the clock in a
 * silent match as well (clockTo), so a line that exists only when watched must
 * never move it, or the sin bin (binUntil reads lastMin) would be timed
 * differently in the two. Stamped at lastMin it cannot.
 */
export function colour(
  state: GameState, ctx: LiveCtx, side: SideCtx | null, key: string,
  v?: Record<string, string | number>, playerId?: number,
) {
  if (!ctx.detail) return
  pushLine(state, ctx, ctx.lastMin, 'SUB', side, key, v, playerId)
}

/** one of a bank, on the commentary's dice
 *
 *  AND NOT ONE IT HAS JUST SAID (1.9.0). The pick was uniform with no memory,
 *  so a ten-line bank could say the same thing twice in five minutes, which
 *  is the first thing a player notices about generated commentary. Lines in
 *  the last twelve are left out while anything fresh is left; still exactly
 *  one draw on ctx.crng, so the commentary's own stream keeps its length and
 *  the simulation's is never touched. */
const RECENT_LINES = 12
function remember(ctx: LiveCtx, k: string) {
  const r = (ctx.recent ??= [])
  r.push(k)
  if (r.length > RECENT_LINES) r.shift()
}
export function said<T>(ctx: LiveCtx, xs: readonly T[]): T {
  const roll = ctx.crng()
  if (xs.length < 2 || typeof xs[0] !== 'string') return xs[Math.floor(roll * xs.length)]
  const recent = ctx.recent ?? []
  const fresh = xs.filter(x => !recent.includes(x as unknown as string))
  const pool = fresh.length ? fresh : xs
  const pick = pool[Math.floor(roll * pool.length)]
  remember(ctx, pick as unknown as string)
  return pick
}

/** TRY LINES THAT SUIT THE MAN (1.9.0). A signature trait (attributes.ts
 *  deriveTrait) had engine effects and no words: a Jackal scored like anybody
 *  else. These lines are three times as likely for the trait they describe.
 *  try1 and try6 are left out on purpose: they are the lines fitTryLine falls
 *  back to for any forward and any back, so they cannot single anybody out. */
const TRY_TRAIT: Record<string, readonly string[]> = {
  'The Step': ['comm.try5', 'comm.try19', 'comm.try21'],
  'Offload King': ['comm.try12', 'comm.try26'],
  'Enforcer': ['comm.try11', 'comm.try18'],
  'Jackal': ['comm.try13', 'comm.try24'],
}
/** and the moments that are bigger than the move: a late try for a side that
 *  was level or within seven, a try off the bench, a second for the same man */
const TRY_LATE = ['comm.tryLate1', 'comm.tryLate2', 'comm.tryLate3']
const TRY_BENCH = ['comm.tryBench1', 'comm.tryBench2']
const TRY_BRACE = ['comm.tryBrace1', 'comm.tryBrace2']

/** The try's words, chosen on the commentary's dice from what the try meant. */
export function tryLine(ctx: LiveCtx, side: SideCtx, pool: readonly string[], scorer: Player, min: number): string {
  const opp = side === ctx.home ? ctx.away : ctx.home
  const before = side.score - 5 - opp.score // the try is already on the board
  const roll = ctx.crng()
  const recent = ctx.recent ?? []
  const fresh = (xs: readonly string[]) => xs.filter(k => !recent.includes(k))
  let moment: readonly string[] = []
  // late AND it matters: level or within a converted try. A consolation at
  // 5-48 is not 'what a time to find the line'
  if (min >= 68 && before <= 0 && before >= -7) moment = TRY_LATE
  else if (side.onAt?.has(scorer.id)) moment = TRY_BENCH
  else if (side.matchTries?.get(scorer.id) === 2) moment = TRY_BRACE
  const m = fresh(moment)
  // most of the time, not all of it: the move is still worth describing
  if (m.length && roll < 0.65) {
    const k = m[Math.floor((roll / 0.65) * m.length)]
    remember(ctx, k)
    return k
  }
  const liked = (scorer.trait && TRY_TRAIT[scorer.trait]) || []
  const unsaid = fresh(pool)
  const open = unsaid.length ? unsaid : pool
  const w = open.map(k => (liked.includes(k) ? 3 : 1))
  // the rest of the roll, rescaled to 0-1, so one draw still decides it all
  const u = m.length ? (roll - 0.65) / 0.35 : roll
  let r = u * w.reduce((a, b) => a + b, 0)
  let i = 0
  for (; i < open.length - 1; i++) { r -= w[i]; if (r < 0) break }
  remember(ctx, open[i])
  return open[i]
}

/** the men a side has on the pitch */
export function onField(state: GameState, side: SideCtx): Player[] {
  return [...side.onPitch].map(id => state.players[id]).filter((p): p is Player => !!p)
}

/** whoever wears shirt slot `i` (0-based) and is on the pitch, else null */
export function inShirt(state: GameState, side: SideCtx, i: number): Player | null {
  const id = side.lineup[i]
  return id != null && side.onPitch.has(id) ? state.players[id] ?? null : null
}

/** a man for a line, by shirt: the first of `slots` on the pitch, weighted by
 *  `w`, on the commentary's dice; anybody on the pitch if none of them is */
export function sayWho(state: GameState, ctx: LiveCtx, side: SideCtx, slots: number[], w?: number[]): Player | null {
  const men = slots.map(s => inShirt(state, side, s))
  const ok = men.map((p, i) => (p ? (w?.[i] ?? 1) : 0))
  const tot = ok.reduce((a, b) => a + b, 0)
  if (tot > 0) {
    let r = ctx.crng() * tot
    for (let i = 0; i < men.length; i++) { r -= ok[i]; if (r < 0 && men[i]) return men[i] }
  }
  const all = onField(state, side)
  return all.length ? all[Math.floor(ctx.crng() * all.length)] : null
}

/** how far up the pitch a side is, 0 its own line, 100 theirs */
export const upOf = (ctx: LiveCtx, side: SideCtx) => side === ctx.home ? ctx.field : 100 - ctx.field
/** move the line `m` metres towards a side's own posts */
export function backTowards(ctx: LiveCtx, side: SideCtx, m: number) {
  ctx.field = clamp(side === ctx.home ? ctx.field - m : ctx.field + m, 4, 96)
}

/**
 * THE RUGBY BETWEEN THE SCORES, called for a watched match (1.8.0). Read
 * before the tick's scoring roll, so a try that follows is preceded by the
 * carries that made it - the highlight clip plays those lines as its build-up
 * (HighlightClip.buildClip), and at most the last three of them.
 */
export function describePlay(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, contest?: Contest | null) {
  if (!ctx.detail) return
  // A BUSY AFTERNOON NEEDS LESS FILLER (1.8.16). The incidents have their own
  // lines, so a match full of them ran to 190 against the owner's 100-150:
  // past about two lines a minute, the carries and the phase counts go quiet
  // by half and the cards, the tries and the TMO keep the room.
  if (ctx.events.length > 2.0 * Math.max(8, ctx.lastMin) && ctx.crng() < 0.5) return
  const up = upOf(ctx, side)
  const team = teamShort(state, side.teamId), oppT = teamShort(state, opp.teamId)
  // the set piece now and then: the sheet derives about thirteen scrums and
  // twenty-five lineouts a match, and these name a few of them
  const sp = ctx.crng()
  // a penalty kicked to touch a moment ago: that lineout is the kicker's, so
  // the other side gets no lineout line until it has been taken
  const owed = ctx.touchThrow && ctx.lastMin - ctx.touchThrow.min <= 1 ? ctx.touchThrow : null
  if (sp < 0.13) {
    const p = sayWho(state, ctx, side, [3, 4, 5, 6, 7], [3, 3, 1, 2, 1])
    if (p && !(owed && owed.teamId !== side.teamId)) {
      colour(state, ctx, side, said(ctx, SP_LINEOUT), { team, opp: oppT, player: p.name }, p.id)
      if (owed) ctx.touchThrow = null
    }
  } else if (sp < 0.21) {
    colour(state, ctx, side, said(ctx, ctx.uncontested ? SP_SCRUM_UNCONTESTED : SP_SCRUM), { team, opp: oppT })
  }
  // the carry, where the ball is: forwards close in, backs in space
  // (0.45 to 0.38 in 1.8.16: the incidents' own lines took the room, and the
  // owner's 100-150 lines a match is a ceiling as well as a floor)
  if (ctx.crng() < 0.38) {
    const bank = up < 22 ? PBP_DEEP : up > 78 ? PBP_RED : PBP_MID
    // the man the contest put into contact, when there was one
    const real = contest && side.onPitch.has(contest.carrier) ? state.players[contest.carrier] : null
    const p = real ?? (up > 78
      ? sayWho(state, ctx, side, [0, 1, 2, 3, 4, 5, 6, 7, 11], [1, 2, 1, 2, 2, 2, 2, 3, 1])
      : up < 22
        ? sayWho(state, ctx, side, [8, 9, 14, 10, 13, 11], [2, 3, 3, 1, 1, 1])
        : sayWho(state, ctx, side, [3, 5, 6, 7, 9, 10, 11, 12, 13, 14], [1, 1, 1, 2, 2, 1, 2, 2, 1, 1]))
    if (p) colour(state, ctx, side, said(ctx, bank), { team, opp: oppT, player: p.name }, p.id)
  }
  // the breakdown, or the count of phases
  const bd = ctx.crng()
  if (bd < 0.15) {
    const p = sayWho(state, ctx, side, [0, 1, 2, 3, 4, 5, 6, 7, 8], [1, 1, 1, 1, 1, 2, 2, 1, 2])
    if (p) colour(state, ctx, side, said(ctx, PBP_RUCK), { team, opp: oppT, player: p.name }, p.id)
  } else if (bd < 0.21) {
    colour(state, ctx, side, said(ctx, PBP_PHASES), { team, opp: oppT, n: 3 + Math.floor(ctx.crng() * 9) })
  }
  if ((ctx.weather === 'Rain' || ctx.weather === 'Snow') && ctx.crng() < 0.07) {
    const p = sayWho(state, ctx, side, [8, 9, 11, 12, 13, 14])
    if (p) colour(state, ctx, side, said(ctx, PBP_WET), { team, opp: oppT, player: p.name }, p.id)
  }
}

// ---- THE CALLED MOVES, IN THE MATCH (1.8.1, moves.ts) ----------------------

export interface MoveInPlay {
  id: string
  launch: Launch
  /** the share it moves this tick's try chance by, signed */
  gain: number
  risk: number
  /** the man it is run through, if he is on the pitch */
  maker: Player | null
  /** what the gain would have been had the opponent not been set for it
   *  (armsrace.ts); present only on a call the tape blunted */
  gain0?: number
}

/** The move this side runs in this tick, or null: what the tick was launched
 *  from (a hash, no draw), the call for it, and what it is worth with these
 *  men against this defence. */
export function moveInPlay(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, tick: number): MoveInPlay | null {
  const club = state.clubs[side.teamId]
  if (!club) return null
  const calls = callsOf(state, club)
  if (!anyCall(calls)) return null
  const home = side === ctx.home
  // in the opposition 22 the red-zone play has the ball when it can run
  const call = callForTick(calls, launchOf(ctx.fx.id, tick, home), mixHash(ctx.fx.id, tick, home), upOf(ctx, side) >= RED_ZONE)
  const m = call ? MOVE_BY_ID[call.id] : undefined
  if (!m || !call) return null
  // a move that belongs to the side's style is run better (styles.ts)
  const fit = clamp(moveFit(m, (s, a) => inShirt(state, side, s - 1)?.a[a] ?? null)
    + moveAffinity(side.sty?.atk, m.id, m.group === 'shape'), -1, 1)
  const match = moveMatchup(m, state.clubs[opp.teamId]?.tactic)
  // the manager's opponent set for his most-run calls (armsrace.ts)
  const adapt = club.id === state.userClubId ? (ctx.callAdapt?.[m.id] ?? 0) : 0
  const e = moveEdge(state, club, m.id, fit, match, adapt)
  // the same reckoning without the tape, for the evidence: a read, no draw
  const gain0 = adapt > 0 ? moveEdge(state, club, m.id, fit, match, 0).gain : undefined
  // and how the plan is clicking today (THE DAY, 1.8.16): the same call is
  // worth more on one Saturday than the next, in whichever direction it goes
  const ex = side.exec ?? 1
  return { id: m.id, launch: call.launch, gain: e.gain * ex, risk: m.risk, maker: inShirt(state, side, (MOVE_MAKER[m.id] ?? 10) - 1), gain0: gain0 != null ? gain0 * ex : undefined }
}

/** how far the penalty slot's play moves a quick tap's chance, per unit of
 *  its edge: the edge is a share of the try chance, and a tap is one go at
 *  the line, so it is added as it stands. At 1.6 the right play drilled
 *  took a strong side's tap five metres out to the 55% ceiling, a cheat
 *  code; at 1 the right play is worth about ten points of the chance, the
 *  wrong one costs about three, and an undrilled one about twelve
 *  (tapplayprobe). */
export const TAP_PLAY_W = 1.0

/** The penalty slot's play, as a kickable penalty tapped runs it: what it is
 *  worth with the men in the shirts against this defence, and who runs it.
 *  Null for a side with no play in the slot. No draw. */
export function penPlay(state: GameState, side: SideCtx, opp: SideCtx): MoveInPlay | null {
  const club = state.clubs[side.teamId]
  const id = club ? callsOf(state, club).pen : undefined
  const m = id ? MOVE_BY_ID[id] : undefined
  if (!club || !m) return null
  const fit = clamp(moveFit(m, (s, a) => inShirt(state, side, s - 1)?.a[a] ?? null)
    + moveAffinity(side.sty?.atk, m.id, false), -1, 1)
  const e = moveEdge(state, club, m.id, fit, moveMatchup(m, state.clubs[opp.teamId]?.tactic))
  return { id: m.id, launch: 'tap', gain: e.gain * (side.exec ?? 1), risk: m.risk, maker: inShirt(state, side, (MOVE_MAKER[m.id] ?? 9) - 1) }
}

/** Whether the try this tick scored is the move's, for its line and its
 *  clip: a strike move that came off usually is (it launched the tick), a
 *  shape now and then. Deterministic, so it never draws. */
export function moveTryOf(_state: GameState, ctx: LiveCtx, side: SideCtx, mv: MoveInPlay | null, tick: number): LiveCtx['moveTry'] {
  if (!mv || mv.gain <= 0) return null
  const h = moveHash(ctx.fx.id, tick, side === ctx.home ? 1 : 2)
  if (h >= (mv.launch === 'open' ? 0.3 : 0.6)) return null
  return { id: mv.id, launch: mv.launch, maker: mv.maker?.id ?? null }
}

const MOVE_CALL_LO = ['comm.moveCallLo1', 'comm.moveCallLo2', 'comm.moveCallLo3']
const MOVE_CALL_SC = ['comm.moveCallSc1', 'comm.moveCallSc2', 'comm.moveCallSc3']
const MOVE_CALL_TAP = ['comm.moveCallTap1', 'comm.moveCallTap2']
const MOVE_SHAPE = ['comm.moveShape1', 'comm.moveShape2', 'comm.moveShape3']
const MOVE_MISFIRE = ['comm.moveMisfire1', 'comm.moveMisfire2', 'comm.moveMisfire3', 'comm.moveMisfire4']
const MOVE_GAIN = ['comm.moveGain1', 'comm.moveGain2', 'comm.moveGain3']
const SHAPE_MISFIRE = ['comm.shapeMisfire1', 'comm.shapeMisfire2']

/** The call, as it is made: watched only, on the commentary's dice. */
export function describeMoveCall(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, mv: MoveInPlay) {
  if (!ctx.detail) return
  const strike = mv.launch !== 'open'
  if (ctx.crng() >= (strike ? 0.4 : 0.1)) return
  const bank = mv.launch === 'lineout' ? MOVE_CALL_LO : mv.launch === 'scrum' ? MOVE_CALL_SC : mv.launch === 'tap' ? MOVE_CALL_TAP : MOVE_SHAPE
  colour(state, ctx, side, said(ctx, bank),
    { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), move_k: sayKey(mv.id) })
}

/** A move that did not end in a score: the misfire named, and now and then
 *  the one that won the gain line. Watched only. */
export function describeMoveOutcome(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, mv: MoveInPlay) {
  if (!ctx.detail) return
  const v = { team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId), move_k: sayKey(mv.id) }
  if (mv.gain < 0 && ctx.crng() < 0.5) {
    if (mv.launch === 'open') colour(state, ctx, side, said(ctx, SHAPE_MISFIRE), v)
    else if (mv.maker) colour(state, ctx, side, said(ctx, MOVE_MISFIRE), { ...v, player: mv.maker.name }, mv.maker.id)
  } else if (mv.gain > 0.02 && mv.launch !== 'open' && mv.maker && ctx.crng() < 0.3) {
    colour(state, ctx, side, said(ctx, MOVE_GAIN), { ...v, player: mv.maker.name }, mv.maker.id)
  }
}

// ---- THE STYLES, IN WORDS (1.8.2, styles.ts) -----------------------------

/**
 * A line when a style TELLS: the attack's style finding the defence it
 * beats ("the width is stretching the drift"), or the defence's style
 * shutting down the attack it is built for ("the blitz catches them behind
 * the gain line"). Watched only and on the commentary's dice, so a silent
 * match is the same match. Every line carries both styles' ids (sa, sd) for
 * the highlight clip.
 */
export function describeStyle(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, st: { m: number }) {
  if (!ctx.detail || !side.sty || !opp.sty || st.m === 0) return
  if (ctx.crng() >= 0.05 * Math.abs(st.m)) return
  const v = {
    team: teamShort(state, side.teamId), opp: teamShort(state, opp.teamId),
    atk_k: atkSay(side.sty.atk), def_k: defSay(opp.sty.def), sa: side.sty.atk, sd: opp.sty.def,
  }
  const n = 1 + Math.floor(ctx.crng() * 2)
  if (st.m > 0) colour(state, ctx, side, `styles.cAtk_${side.sty.atk}${n}`, v)
  else colour(state, ctx, opp, `styles.cDef_${opp.sty.def}${n}`, { ...v, team: v.opp, opp: v.team })
}

/** the per-match salt of the style's turnover hash: the world, the season,
 *  the fixture and who is playing it, cached on the match */
export function styleSalt(state: GameState, ctx: LiveCtx): number {
  return (ctx.stySalt ??= hashString(`${state.seed}|${state.season}|${ctx.fx.id}|${ctx.fx.homeId}|${ctx.fx.awayId}`))
}

/** A turnover the style made, named for the defence that made it: watched only. */
export function describeTurnover(state: GameState, ctx: LiveCtx, side: SideCtx, opp: SideCtx, _st: { m: number }) {
  if (!ctx.detail || !side.sty || !opp.sty || ctx.crng() >= 0.35) return
  const p = sayWho(state, ctx, opp, [3, 4, 5, 6, 7, 11, 12], [2, 2, 3, 3, 2, 1, 1])
  if (!p) return
  colour(state, ctx, opp, `styles.cTurn_${opp.sty.def}`, {
    team: teamShort(state, opp.teamId), opp: teamShort(state, side.teamId), player: p.name,
    atk_k: atkSay(side.sty.atk), def_k: defSay(opp.sty.def), sa: side.sty.atk, sd: opp.sty.def,
  }, p.id)
}

/** The try line for a try the called move made: who ran it, who scored, and
 *  from where. The key says the launch, so the clip can draw the set piece. */
export function moveTryLine(state: GameState, mt: NonNullable<LiveCtx['moveTry']>, scorer: Player, min: number): { k: string; v: Record<string, string | number> } {
  const maker = mt.maker != null ? state.players[mt.maker] : undefined
  const bank = MOVE_TRY[mt.launch]
  const move_k = sayKey(mt.id)
  if (!maker || maker.id === scorer.id) return { k: bank.self, v: { player: scorer.name, move_k } }
  return { k: bank.lines[(min + scorer.id) % bank.lines.length], v: { player: scorer.name, maker: maker.name, move_k } }
}
const MOVE_TRY: Record<Launch, { self: string; lines: string[] }> = {
  lineout: { self: 'comm.moveTryLoSelf', lines: ['comm.moveTryLo1', 'comm.moveTryLo2', 'comm.moveTryLo3'] },
  scrum: { self: 'comm.moveTryScSelf', lines: ['comm.moveTrySc1', 'comm.moveTrySc2', 'comm.moveTrySc3'] },
  tap: { self: 'comm.moveTryTapSelf', lines: ['comm.moveTryTap1', 'comm.moveTryTap2', 'comm.moveTryTap3'] },
  open: { self: 'comm.shapeTrySelf', lines: ['comm.shapeTry1', 'comm.shapeTry2', 'comm.shapeTry3'] },
}

/** The side without the ball, when the tick came to nothing for the side
 *  that had it: a line about the defence. A man named for a hit is one the
 *  tackle count already has making hits (TACKLE_LINES rule). */
export function describeDefence(state: GameState, ctx: LiveCtx, def: SideCtx, att: SideCtx, contest?: Contest | null) {
  if (!ctx.detail || ctx.crng() >= 0.21) return
  const team = teamShort(state, def.teamId), oppT = teamShort(state, att.teamId)
  const hitters = onField(state, def).filter(q => (def.tackles?.get(q.id) ?? 0) > 0)
  if (hitters.length && ctx.crng() < 0.45) {
    // the man who won this tick's collision, if the tackle count has him
    const won = contest && contest.dominance < 0.5 ? hitters.find(q => q.id === contest.tackler) : undefined
    const p = won ?? hitters[Math.floor(ctx.crng() * hitters.length)]
    colour(state, ctx, def, said(ctx, DEF_HIT), { team, opp: oppT, player: p.name }, p.id)
  } else {
    colour(state, ctx, def, said(ctx, DEF_SET), { team, opp: oppT })
  }
}

/** The kick-off after a score, by the side that conceded it. Not when a
 *  whistle is standing on the call that produced the score: that line goes
 *  in front of half time or full time, and nothing restarts after it. */
export function describeRestart(state: GameState, ctx: LiveCtx, scored: SideCtx) {
  if (!ctx.detail || ctx.heldWhistle || ctx.crng() >= 0.85) return
  const kickers = scored === ctx.home ? ctx.away : ctx.home
  const p = sayWho(state, ctx, kickers, [9, 11, 14], [6, 1, 1])
  if (!p) return
  colour(state, ctx, kickers, said(ctx, RESTART),
    { team: teamShort(state, kickers.teamId), opp: teamShort(state, scored.teamId), player: p.name }, p.id)
}

/** Where the game is, and in the last ten minutes what the scoreboard asks
 *  of each side: at most one line a tick, read off the score as it stands. */
export function describeState(state: GameState, ctx: LiveCtx, tick: number) {
  if (!ctx.detail) return
  const { home, away } = ctx
  const margin = home.score - away.score
  if (tick >= 17 && Math.abs(margin) <= 14 && ctx.crng() < 0.4) {
    if (margin === 0) {
      colour(state, ctx, null, said(ctx, LATE_LEVEL), { home: teamShort(state, home.teamId), away: teamShort(state, away.teamId) })
    } else {
      const lead = margin > 0 ? home : away, trail = lead === home ? away : home
      const chase = ctx.crng() < 0.5
      const s = chase ? trail : lead, o = chase ? lead : trail
      colour(state, ctx, s, said(ctx, chase ? LATE_CHASE : LATE_HOLD), { team: teamShort(state, s.teamId), opp: teamShort(state, o.teamId) })
    }
    return
  }
  if (ctx.crng() < 0.14) {
    if (ctx.field < 25 || ctx.field > 75) {
      const on = ctx.field > 75 ? home : away, off = on === home ? away : home
      colour(state, ctx, on, said(ctx, TERR_CAMPED), { team: teamShort(state, on.teamId), opp: teamShort(state, off.teamId) })
    } else {
      colour(state, ctx, null, said(ctx, TERR_MIDDLE), { home: teamShort(state, home.teamId), away: teamShort(state, away.teamId) })
    }
  }
}
