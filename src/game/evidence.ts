/**
 * ---- WHY WE WON, WHY WE LOST (1.8.3, CausalEvidence) ----
 *
 * The full-time card used to explain a result with one sentence chosen from
 * the possession share, and the half-time word with a ratio of two scrum
 * units. Neither could name what had actually decided the match, because
 * nothing had counted it. The engine now does (matchEngine EvCount, on each
 * side): every point is put down to what made it (a called move, a turnover,
 * a line break, phase play, a penalty, the boot), and beside the points sit
 * the counts that explain them: the calls and the ground they won, the line
 * breaks, the ball won and lost by zone, the penalties given away, the set
 * piece as the stats panel has it, and what the opposition's tape took off
 * the manager's calls.
 *
 * This module turns those counts into four things:
 *
 *   THE RECORD. A CausalEvidence of a few hundred bytes for each of the
 *     manager's matches, filed beside the findings (state.tacLoop.evidence:
 *     the newest six, and before them the latest against each other side),
 *     which the next full time and the next report read back.
 *
 *   THE FOLLOW-UP (1.8.4). What hurt at half time, held against the second
 *     half alone; what hurt most last match, held against this one; and the
 *     touchline dial that answers a cause, where one does.
 *
 *   THE RANKING. significance() puts every cause in points, signed for us:
 *     the points the cause put on the board for each side, net, and a small
 *     price on the counts behind it (a set piece lost, a turnover, a
 *     penalty conceded, a minute in the other 22, the style matchup, the
 *     tape). The points carry it, so the line at the top is the cause that
 *     scored the margin, unless the counts say clearly that something else
 *     did more of the damage. scripts/evidenceprobe.ts measures how often
 *     the top line is the cause that put the most points on the board.
 *
 *   THE SHARED READS. The score at a minute, the points after it, the
 *     possession share and which side is the manager's, which coachfix,
 *     matchfindings and the half-time word each worked out for themselves.
 *
 * A reading of the match: no rng, nothing written into the engine, and the
 * same match always reads the same.
 */
import type { GameState } from './model'
import { EV_CAUSES, evOf, matchStats, type EvCause, type LiveCtx, type SideCtx } from './matchEngine'
import { sayKey } from './moves'
import { atkSay, defSay } from './styles'
import type { HalfSide } from './conditions'
import { noteDecider } from './turning'
import { noteMatchWork } from './arcbook'

// ---------------------------------------------------------------- shared reads

/** The manager's side and the other one, or null when he is not in it. */
export function sidesOf(ctx: LiveCtx): { mine: SideCtx; opp: SideCtx } | null {
  if (!ctx.userSideId) return null
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away.teamId === ctx.userSideId ? ctx.away : null
  if (!mine) return null
  return { mine, opp: mine === ctx.home ? ctx.away : ctx.home }
}

/** A side's share of the ball, as the stats panel rounds it. */
export function possPct(ctx: LiveCtx, side: SideCtx): number {
  return Math.round((side.poss / (ctx.home.poss + ctx.away.poss || 1)) * 100)
}

/** A side's score at a minute, read off the commentary: the last line
 *  stamped at or before it (the whistle lines are not scores). */
export function scoreAt(ctx: LiveCtx, min: number, side: SideCtx): number {
  let at: { homeScore: number; awayScore: number } | null = null
  for (const e of ctx.events) {
    if (e.type === 'FT') continue
    if (e.min <= min) at = e
  }
  if (!at) return 0
  return side === ctx.home ? at.homeScore : at.awayScore
}

/** The points a side scored after a minute. */
export function pointsAfter(ctx: LiveCtx, side: SideCtx, min: number): number {
  return Math.max(0, side.score - scoreAt(ctx, min, side))
}

// ---------------------------------------------------------------- the record

export interface EvSide {
  /** the moves worth naming (three of ours, two of theirs): [calls, metres
   *  won over the match, tries, calls the tape blunted, metres the tape cost] */
  calls: Record<string, number[]>
  /** points by cause, in EV_CAUSES order */
  pts: number[]
  breaks: number
  /** the tries the style matchup added (x100), and the two styles */
  styleEdge: number
  style?: [string, string]
  /** the try chance the opposition's tape took off the calls (x100) */
  blunted: number
  /** scrums and lineouts on its own feed, won and lost (the stats panel's) */
  setWon: [number, number]
  setLost: [number, number]
  /** turnovers won and lost, by zone from this side's view: own 22, the
   *  middle, the opposition 22 */
  turnWon: number[]
  turnLost: number[]
  /** penalties given away */
  pens: number
  /** ticks played in each zone */
  zone: number[]
}

export interface CausalEvidence {
  fxId: number
  season: number
  week: number
  oppId: string
  us: number
  them: number
  /** the minute it was read at: the half-time read is the same shape */
  min: number
  /** our share of the ball */
  poss: number
  /** ours, then theirs */
  side: [EvSide, EvSide]
  /** the biggest swings in the ball: [minute, change in our share in points
   *  of percentage over twelve minutes] */
  swings: [number, number][]
  /** the minutes the lead changed hands: plus when we took it, minus when they did */
  lead: number[]
  /** what the margin moved by after the hour (positive for us) */
  late: number
  /** set on a friendly: kept for the run of matches, never read as the
   *  last meeting (a friendly in an idle week wiped a rival's memory) */
  fr?: 1
}

/** THE NEWEST SIX, AND THE LAST TIME AGAINST EVERYBODY ELSE (1.8.4). The
 *  save kept the newest six and nothing more, but a league plays its return
 *  fixture nine or more rounds after the first, so the record of the side
 *  coming back to town had always gone by the time it came: the report's
 *  "last time we met", the lesson plan and the "why" of the last meeting
 *  never had anything to read. Now the newest RECENT are kept whoever they
 *  were against, and before them the latest against each other side, up to
 *  RECALL_CAP in all (a league's worth and a cup run). The findings keep
 *  the same shape (oppreport keepFindings). */
export const EVIDENCE_CAP = 6
export const RECALL_CAP = 24

/** The list as the save keeps it, oldest first, from a list in the order the
 *  matches were played. */
export function trimRecall<T extends { oppId: string; fr?: 1 }>(list: T[], recent = EVIDENCE_CAP, cap = RECALL_CAP): T[] {
  const keep = new Set<number>()
  const seen = new Set<string>()
  for (let i = list.length - 1; i >= 0 && keep.size < cap; i--) {
    if (i >= list.length - recent) keep.add(i)
    else if (!list[i].fr && !seen.has(list[i].oppId)) keep.add(i)
    // a friendly does not take the last-meeting slot
    if (!list[i].fr) seen.add(list[i].oppId)
  }
  return list.filter((_, i) => keep.has(i))
}

function evSide(ctx: LiveCtx, side: SideCtx, st: ReturnType<typeof matchStats>, keep: number): EvSide {
  const e = evOf(side)
  const i = side === ctx.home ? 0 : 1
  // the moves a line can name: the ones that scored, then the ones the tape
  // blunted, then the ones called most
  const top = Object.entries(e.calls).sort((a, b) => b[1][2] - a[1][2] || b[1][3] - a[1][3] || b[1][0] - a[1][0]).slice(0, keep)
  const calls: Record<string, number[]> = {}
  for (const [id, c] of top) {
    // (|| 0: a few centimetres lost rounds to -0, which read "-0m" on the card)
    calls[id] = [c[0], Math.round(c[1]) || 0, c[2], c[3], Math.round(c[4]) || 0]
  }
  return {
    calls,
    pts: [...e.pts],
    breaks: e.breaks,
    styleEdge: Math.round(e.styX * 100),
    ...(side.sty ? { style: [side.sty.atk, side.sty.def] as [string, string] } : {}),
    blunted: Math.round(e.bluntX * 100),
    setWon: [st.scrumsWon[i], st.lineoutsWon[i]],
    setLost: [st.scrumsLost[i], st.lineoutsLost[i]],
    turnWon: [...e.turnWon],
    turnLost: [...e.turnLost],
    pens: side.consPens,
    zone: [...e.zone],
  }
}

/** The swings: our share of the ball over twelve minutes against the twelve
 *  before, the two biggest that do not overlap. */
function swingsOf(ctx: LiveCtx, home: boolean): [number, number][] {
  const h = (ctx.momoHist ?? []).map(x => (home ? x : 1 - x))
  const roll = h.map((_, i) => (i < 2 ? null : (h[i] + h[i - 1] + h[i - 2]) / 3))
  const d: [number, number][] = []
  for (let i = 5; i < roll.length; i++) d.push([i, (roll[i]! - roll[i - 3]!) * 100])
  d.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const out: [number, number][] = []
  for (const [i, v] of d) {
    if (out.length >= 2 || Math.abs(v) < 8) break
    if (out.some(([j]) => Math.abs(j - i) < 3)) continue
    out.push([i, Math.round(v)])
  }
  return out.map(([i, v]) => [(i + 1) * 4, v])
}

/** The lead changing hands, tick by tick, signed for us. */
function leadOf(ctx: LiveCtx, home: boolean): number[] {
  const out: number[] = []
  let held = 0
  ;(ctx.marginHist ?? []).forEach((m, i) => {
    const s = Math.sign(home ? m : -m)
    if (s !== 0 && s !== held) {
      if (held !== 0) out.push(s * (i + 1) * 4)
      held = s
    }
  })
  return out
}

/** The evidence for the manager's match as it stands: at full time, or at the
 *  break for the first forty. Null for a match he is not in. Pure. */
export function buildEvidence(state: GameState, ctx: LiveCtx): CausalEvidence | null {
  const s = sidesOf(ctx)
  if (!s) return null
  const { mine, opp } = s
  const home = mine === ctx.home
  const st = matchStats(ctx)
  const mh = ctx.marginHist ?? []
  const at60 = mh.length > 14 ? mh[14] : null
  const fin = mh.length ? mh[mh.length - 1] : 0
  return {
    fxId: ctx.fx.id, season: state.season, week: state.week, oppId: opp.teamId,
    us: mine.score, them: opp.score,
    min: Math.min(80, ctx.lastMin || 0),
    poss: possPct(ctx, mine),
    side: [evSide(ctx, mine, st, 3), evSide(ctx, opp, st, 2)],
    swings: swingsOf(ctx, home),
    lead: leadOf(ctx, home),
    late: at60 == null ? 0 : (home ? 1 : -1) * (fin - at60),
    ...(ctx.fx.compId === 'fr' ? { fr: 1 as const } : {}),
  }
}

/** File the evidence at full time, once per fixture (trimRecall keeps the
 *  newest six and the last against each other side). Called beside
 *  fileFindings wherever a match ends. */
export function fileEvidence(state: GameState, ctx: LiveCtx): CausalEvidence | null {
  if (ctx.seg !== 3) return null
  const ev = buildEvidence(state, ctx)
  if (!ev) return null
  const loop = (state.tacLoop ??= { findings: [] })
  const list = loop.evidence ?? []
  if (list.some(e => e.fxId === ev.fxId && e.season === ev.season)) return ev
  loop.evidence = trimRecall([...list, ev])
  noteDecider(state, ctx.fx, ev) // a final that turned goes into the annals (turning.ts)
  // the manager's own touchline work, for what he is known for (repute.ts):
  // a match he watched, not one the assistant took (store.ts instantResult)
  if (!ctx.assistantSubs && ctx.koDials) {
    const t = state.clubs[state.userClubId]?.tactic
    const now = t ? LEVER_DIALS.map(k => t[k]) : null
    const moved = !!now && now.some((v, i) => Math.abs(v - (ctx.koDials![i] ?? v)) >= 10)
    const half = halfFollow(ev, ctx.htEv)
    const answered = !!half && leverMoved(half.cause, ctx.htDials, ctx.shDials) === 'right'
    noteMatchWork(state, moved, answered, !!half && (half.trend === 'improved' || half.trend === 'partly'))
  }
  return ev
}

const numArr = (x: unknown, n: number) => Array.isArray(x) && x.length === n && x.every(v => typeof v === 'number' && Number.isFinite(v))

/** Heal what an older or damaged save carries: an absent list stays absent,
 *  anything unreadable in it is dropped, and the rest capped. */
export function migrateEvidence(s: GameState): void {
  const loop = s.tacLoop
  if (!loop || typeof loop !== 'object') return
  const raw = (loop as { evidence?: unknown }).evidence
  if (raw === undefined) return
  if (!Array.isArray(raw)) { delete loop.evidence; return }
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  const okSide = (x: unknown) => {
    const s = x as EvSide
    return !!s && typeof s === 'object'
      && numArr(s.pts, EV_CAUSES.length) && numArr(s.setWon, 2) && numArr(s.setLost, 2)
      && numArr(s.turnWon, 3) && numArr(s.turnLost, 3) && numArr(s.zone, 3)
      && num(s.breaks) && num(s.styleEdge) && num(s.blunted) && num(s.pens)
      && !!s.calls && typeof s.calls === 'object' && !Array.isArray(s.calls)
      && Object.values(s.calls).every(c => numArr(c, 5))
  }
  loop.evidence = (raw as CausalEvidence[]).filter(e => !!e && typeof e === 'object'
    && num(e.fxId) && typeof e.oppId === 'string' && num(e.us) && num(e.them) && num(e.poss) && num(e.late)
    && Array.isArray(e.side) && e.side.length === 2 && e.side.every(okSide)
    && Array.isArray(e.swings) && Array.isArray(e.lead))
  loop.evidence = trimRecall(loop.evidence)
}

// ---------------------------------------------------------------- the ranking

/** what a "why" line can be about: a cause the points are put down to, or
 *  one the counts alone speak for */
export type WhyCause = EvCause | 'set' | 'style' | 'read'

/** the price on the counts, in points: a scrum or lineout lost on your own
 *  feed, a turnover, a penalty given away (the ground it costs, beyond the
 *  kicks at goal that are already points), a line break, a tick in their 22,
 *  and a metre of ground the tape took off a call (about what a metre of
 *  field position is worth to the try chance on both sides, for the few
 *  ticks before the line drifts back). Small beside a try on purpose: they
 *  explain a margin, they do not outvote it. */
const PRICE = { set: 0.7, turn: 0.6, pen: 0.4, break: 0.5, zone: 0.25, metre: 0.1 }
/** a try, for turning a try chance into points */
const TRY_PTS = 7

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
const ci = (c: EvCause) => EV_CAUSES.indexOf(c)
/** the points a cause put on the board for us, net */
export const netPts = (ev: CausalEvidence, c: EvCause) => ev.side[0].pts[ci(c)] - ev.side[1].pts[ci(c)]

/** Every cause in points, signed for us. */
export function significance(ev: CausalEvidence): Record<WhyCause, number> {
  const [u, o] = ev.side
  const lost = (s: EvSide) => s.setLost[0] + s.setLost[1]
  return {
    move: netPts(ev, 'move'),
    turn: netPts(ev, 'turn') + PRICE.turn * (sum(u.turnWon) - sum(u.turnLost)),
    break: netPts(ev, 'break') + PRICE.break * (u.breaks - o.breaks),
    phase: netPts(ev, 'phase') + PRICE.zone * (u.zone[2] - o.zone[2]),
    pen: netPts(ev, 'pen') + PRICE.pen * (o.pens - u.pens),
    kick: netPts(ev, 'kick'),
    set: PRICE.set * (lost(o) - lost(u)),
    style: u.style && o.style ? (TRY_PTS * (u.styleEdge - o.styleEdge)) / 100 : 0,
    read: -(TRY_PTS * u.blunted) / 100 - PRICE.metre * sum(Object.values(u.calls).map(c => c[4])),
  }
}

export interface WhyLine {
  cause: WhyCause
  /** points, signed for us */
  sig: number
  k: string
  v: Record<string, string | number>
}

/** the line has to be worth a mention */
export const WHY_MIN = 1.5

/** the move that did most for a side: tries, then calls */
export function bestMove(s: EvSide): [string, number[]] | null {
  const m = Object.entries(s.calls).sort((a, b) => b[1][2] - a[1][2] || b[1][0] - a[1][0])[0]
  return m && m[1][2] > 0 ? m : null
}

/** One sentence for a cause, with its number, or null when the cause has
 *  nothing honest to say. */
function lineFor(ev: CausalEvidence, cause: WhyCause, sig: number): WhyLine | null {
  const [u, o] = ev.side
  const us = sig > 0
  const p = (c: EvCause) => (us ? u : o).pts[ci(c)]
  const L = (k: string, v: Record<string, string | number>): WhyLine => ({ cause, sig, k: `matchday.${k}`, v })
  switch (cause) {
    case 'move': {
      const m = bestMove(us ? u : o)
      if (!m) return null
      const metres = Math.round(m[1][1] / m[1][0])
      if (!us) return L('whyMoveAgainst', { move_k: sayKey(m[0]), n: m[1][2] })
      // the ground a call won, when there was enough to speak of
      return metres >= 2
        ? L('whyMoveFor', { move_k: sayKey(m[0]), n: m[1][2], m: metres })
        : L('whyMoveForTries', { move_k: sayKey(m[0]), n: m[1][2] })
    }
    case 'read': {
      // the call the tape cost most: the ground it made over the match, and
      // what the same calls would have made with nobody waiting for them
      const m = Object.entries(u.calls).filter(([, c]) => c[3] >= 3).sort((a, b) => b[1][4] - a[1][4])[0]
      if (!m || m[1][4] < 1) return null
      const r = readVars(m[0], m[1])
      return L(r.k, r.v)
    }
    case 'set': {
      const lost = (s: EvSide) => s.setLost[0] + s.setLost[1]
      return L(us ? 'whySetFor' : 'whySetAgainst', { n: lost(us ? o : u), m: lost(us ? u : o) })
    }
    case 'pen': {
      const n = (us ? o : u).pens, pts = p('pen')
      return L(`whyPen${us ? 'For' : 'Against'}${pts ? '' : '0'}`, { n, p: pts })
    }
    case 'turn': {
      const n = us ? sum(u.turnWon) : sum(u.turnLost), pts = p('turn')
      if (!n && !pts) return null
      return L(`whyTurn${us ? 'For' : 'Against'}${pts && n ? '' : '0'}`, { n, p: pts })
    }
    case 'break': {
      const pts = p('break')
      return L(`whyBreak${us ? 'For' : 'Against'}${pts ? '' : '0'}`, { n: (us ? u : o).breaks, m: (us ? o : u).breaks, p: pts })
    }
    case 'phase': {
      const pts = p('phase')
      return L(`whyPhase${us ? 'For' : 'Against'}${pts ? '' : '0'}`, { mins: (us ? u : o).zone[2] * 4, p: pts })
    }
    case 'kick':
      return p('kick') ? L(us ? 'whyKickFor' : 'whyKickAgainst', { p: p('kick') }) : null
    case 'style': {
      const s = us ? u : o, d = us ? o : u
      if (!s.style || !d.style || Math.round(Math.abs(sig)) < 1) return null
      return L(us ? 'whyStyleFor' : 'whyStyleAgainst', {
        atk_k: atkSay(s.style[0] as never), def_k: defSay(d.style[1] as never), p: Math.round(Math.abs(sig)),
      })
    }
  }
}

/**
 * The "why", most significant first, at most `n` lines.
 *
 * The first line is the cause that did most in the direction of the result:
 * the biggest reason we won, or the biggest reason we lost. The rest follow
 * by size either way, so a win can still carry its warning. A draw is ranked
 * by size alone. Nothing below WHY_MIN points is said.
 */
export function rankWhy(ev: CausalEvidence, n = 3): WhyLine[] {
  const sig = significance(ev)
  const d = Math.sign(ev.us - ev.them)
  const lines = (Object.keys(sig) as WhyCause[])
    .filter(c => Math.abs(sig[c]) >= WHY_MIN)
    .map(c => lineFor(ev, c, sig[c]))
    .filter((l): l is WhyLine => !!l)
    .sort((a, b) => Math.abs(b.sig) - Math.abs(a.sig))
  if (d !== 0) {
    const lead = lines.filter(l => l.sig * d > 0).sort((a, b) => b.sig * d - a.sig * d)[0]
    if (lead) {
      lines.splice(lines.indexOf(lead), 1)
      lines.unshift(lead)
    }
  }
  return lines.slice(0, n)
}

/**
 * THE CALL THEY WERE WAITING FOR, AFTER THE MATCH (1.8.5). The report and
 * the desk say before kick-off when this coach is set for one of the
 * manager's calls (armsrace.ts tapeLine, deskQuestion; rematch.ts memMove),
 * and the "why" names the read only when it cost a point and a half, which
 * a blunted strike almost never does on its own (scripts/onestoryprobe.ts: a
 * third of a point a match, at the most a coach adapts). So the warning was
 * never answered: did it matter? This is the answer, for the calls the
 * pre-match named (`ids`): the ground the read cost the one run most, or
 * that it made its ground regardless. Null when none was run three times.
 */
export function toldCalls(ctx: LiveCtx, worth: number): string[] {
  // the call the report and the desk named (the tape's top call, the most
  // set for), and the one the rematch line named
  const top = Object.entries(ctx.callAdapt ?? {}).filter(([, a]) => a >= worth)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
  const mem = ctx.rematch?.cause === 'move' ? ctx.rematch.move : undefined
  return [...new Set([top, mem].filter((x): x is string => !!x))]
}

/** WHAT THE TAPE COST A CALL, IN METRES THAT READ (1.8.5 trust audit). A
 *  read call that went backwards over the match quoted "-3m from 4 calls";
 *  it says it lost the ground now, and by how much more than unread. */
function readVars(id: string, c: readonly number[]): { k: string; v: Record<string, string | number> } {
  return c[1] >= 0
    ? { k: 'whyRead', v: { move_k: sayKey(id), n: c[0], m: c[1], m0: c[1] + c[4] } }
    : { k: 'whyReadLost', v: { move_k: sayKey(id), n: c[0], m: -c[1], d: c[4] } }
}

/** The line itself, for the calls toldCalls names. */
export function readTold(ev: CausalEvidence, ids: readonly string[]): WhyLine | null {
  const u = ev.side[0]
  const m = ids.map(id => [id, u.calls[id]] as const).filter(([, c]) => c && c[0] >= 3)
    .sort((a, b) => b[1][0] - a[1][0] || (a[0] < b[0] ? -1 : 1))[0]
  if (!m) return null
  const [id, c] = m
  const sig = significance(ev).read
  if (c[4] >= 1) { const r = readVars(id, c); return { cause: 'read', sig, k: `matchday.${r.k}`, v: r.v } }
  // the tape cost it under a metre: it made its ground anyway, or it made
  // none and the tape was not why
  return { cause: 'read', sig, k: c[1] > 0 ? 'matchday.whyReadHeld' : 'matchday.whyReadNil', v: { move_k: sayKey(id), n: c[0], m: c[1] } }
}

/** The cause that put the most points on the board in the direction of the
 *  result (for a draw, the largest either way): what the evidence probe
 *  holds the top "why" line against. Null for a scoreless draw. */
export function marginLeader(ev: CausalEvidence): EvCause | null {
  const d = Math.sign(ev.us - ev.them)
  let best: EvCause | null = null, bv = 0
  for (const c of EV_CAUSES) {
    const v = d === 0 ? Math.abs(netPts(ev, c)) : netPts(ev, c) * d
    if (v > bv) { bv = v; best = c }
  }
  return best
}

// ---------------------------------------------------------------- half time

/** what an evidence line at half time is about, so the half-time word does
 *  not say the same thing twice (conditions.ts halfTimeHints) */
export const HT_ABOUT: Partial<Record<WhyCause, 'pens' | 'ball' | 'set'>> = { pen: 'pens', turn: 'ball', set: 'set' }

/** a first half's cause has to be this big to be called working or hurting */
export const HT_MIN = 5

export interface HtEvidence {
  k: string
  v: Record<string, string | number>
  /** weighed against the assistant's other half-time reads */
  w: number
  tag: 'work' | 'hurt'
  about?: 'pens' | 'ball' | 'set'
  /** what it is about, for the dial that answers it (LEVERS) */
  cause: WhyCause
}

/** The few numbers the half-time reads take (conditions.ts HalfSide), from
 *  the evidence rather than counted again: ours, then theirs. */
export function halfSides(ev: CausalEvidence): [HalfSide, HalfSide] {
  const one = (s: EvSide, score: number): HalfSide =>
    ({ consPens: s.pens, turnLost: sum(s.turnLost), turnWon: sum(s.turnWon), score })
  return [one(ev.side[0], ev.us), one(ev.side[1], ev.them)]
}

/** At most one thing that is working and one that is hurting, off the first
 *  forty, each with its number. */
export function htEvidence(ev: CausalEvidence | null): HtEvidence[] {
  if (!ev) return []
  const sig = significance(ev)
  const out: HtEvidence[] = []
  for (const tag of ['work', 'hurt'] as const) {
    const d = tag === 'work' ? 1 : -1
    const best = (Object.keys(sig) as WhyCause[])
      .filter(c => sig[c] * d >= HT_MIN)
      .map(c => lineFor(ev, c, sig[c]))
      .filter((l): l is WhyLine => !!l)
      .sort((a, b) => b.sig * d - a.sig * d)[0]
    if (best) out.push({ k: best.k, v: best.v, w: Math.min(6, 1.5 + Math.abs(best.sig) / 3), tag, about: HT_ABOUT[best.cause], cause: best.cause })
  }
  return out
}

// ---------------------------------------------------------------- the follow-up

/** The touchline dial that answers a cause, and which way: the four on the
 *  in-match panel, where one of them measurably moves the count behind it
 *  over a second half (scripts/loopprobe.ts). Penalties come down with
 *  Physicality, their line breaks with a slower Tempo (the defence is set
 *  more often), and their time in our 22 with more Kicking. The ball lost
 *  comes from the attacking style and the set piece from the men in the
 *  shirts, neither of which a dial at half time reaches, so they name none. */
export type LeverDial = 'style' | 'tempo' | 'kicking' | 'aggression'
export const LEVER_DIALS: readonly LeverDial[] = ['style', 'tempo', 'kicking', 'aggression']
export const LEVERS: Partial<Record<WhyCause, { dial: LeverDial; dir: 1 | -1 }>> = {
  pen: { dial: 'aggression', dir: -1 },
  break: { dial: 'tempo', dir: -1 },
  phase: { dial: 'kicking', dir: 1 },
}

/** The count behind a cause that is bad for us when it is high: what a
 *  follow-up holds one stretch of rugby against another with. The 22 is
 *  in minutes, four to a tick. Null where the record cannot honestly split
 *  it (the tape keeps only the moves worth naming). */
export function hurtCount(ev: CausalEvidence, c: WhyCause): number | null {
  const [u, o] = ev.side
  switch (c) {
    case 'pen': return u.pens
    case 'turn': return sum(u.turnLost)
    case 'set': return u.setLost[0] + u.setLost[1]
    case 'break': return o.breaks
    case 'phase': return o.zone[2] * 4
    case 'move': return o.pts[ci('move')]
    case 'kick': return o.pts[ci('kick')]
    case 'style': return Math.max(0, Math.round(-significance(ev).style))
    case 'read': return null
  }
}

/** how the count moved: halved or better, down, about the same, or up */
export type Trend = 'improved' | 'partly' | 'unchanged' | 'worse'

/** `a` before, `b` after, both counts of something bad. A change smaller
 *  than one step (a tick is four minutes) or than a seventh of the count is
 *  no change. */
export function trendOf(a: number, b: number, step = 1): Trend {
  const tol = Math.max(step, a * 0.15)
  if (b - a >= tol) return 'worse'
  if (a - b < tol) return 'unchanged'
  return b <= a / 2 ? 'improved' : 'partly'
}

export interface Follow {
  cause: WhyCause
  /** the count before and after */
  a: number
  b: number
  trend: Trend
  /** a new weakness that has taken over (match to match only) */
  now?: WhyCause
}

/** The second half alone: the full-time record less the half-time one. The
 *  calls are kept for the moves both name. Only for the counts; the margin
 *  history and the swings are the full match's. */
export function secondHalf(full: CausalEvidence, ht: CausalEvidence): CausalEvidence {
  const d = (a: number[], b: number[]) => a.map((x, i) => x - (b[i] ?? 0))
  const side = (f: EvSide, h: EvSide): EvSide => {
    const calls: Record<string, number[]> = {}
    for (const [id, c] of Object.entries(f.calls)) if (h.calls[id]) calls[id] = d(c, h.calls[id])
    return {
      ...f, calls, pts: d(f.pts, h.pts), breaks: f.breaks - h.breaks,
      styleEdge: f.styleEdge - h.styleEdge, blunted: f.blunted - h.blunted,
      setWon: d(f.setWon, h.setWon) as [number, number], setLost: d(f.setLost, h.setLost) as [number, number],
      turnWon: d(f.turnWon, h.turnWon), turnLost: d(f.turnLost, h.turnLost),
      pens: f.pens - h.pens, zone: d(f.zone, h.zone),
    }
  }
  return {
    ...full, us: full.us - ht.us, them: full.them - ht.them, min: full.min - ht.min,
    side: [side(full.side[0], ht.side[0]), side(full.side[1], ht.side[1])],
  }
}

/** What was hurting at half time: the cause of the half-time word's hurting
 *  line (htEvidence), or null when nothing was. */
export function htHurt(ht: CausalEvidence | null | undefined): WhyCause | null {
  return htEvidence(ht ?? null).find(h => h.tag === 'hurt')?.cause ?? null
}

/** The step a count moves in */
const stepOf = (c: WhyCause) => (c === 'phase' ? 4 : 1)

/** WHAT HURT AT HALF TIME, AFTER IT. The half-time hurting cause held
 *  against the second half alone. Null when nothing hurt at the break, or
 *  the cause cannot be split. */
export function halfFollow(full: CausalEvidence, ht: CausalEvidence | null | undefined): Follow | null {
  const cause = htHurt(ht)
  if (!cause || !ht) return null
  const a = hurtCount(ht, cause), b = hurtCount(secondHalf(full, ht), cause)
  if (a == null || b == null) return null
  return { cause, a, b, trend: trendOf(a, b, stepOf(cause)) }
}

/** The cause that hurt most in a match: the most costly with a line to say,
 *  at least WHY_MIN, and one a count can follow. */
export function topProblem(ev: CausalEvidence): WhyCause | null {
  const sig = significance(ev)
  const c = (Object.keys(sig) as WhyCause[])
    .filter(k => sig[k] <= -WHY_MIN && hurtCount(ev, k) != null && lineFor(ev, k, sig[k]))
    .sort((a, b) => sig[a] - sig[b])[0]
  return c ?? null
}

/** LAST MATCH'S PROBLEM, THIS MATCH. What hurt most last time held against
 *  today, and the new problem when another cause hurt more today. */
export function matchFollow(prev: CausalEvidence, cur: CausalEvidence): Follow | null {
  const cause = topProblem(prev)
  if (!cause) return null
  const a = hurtCount(prev, cause), b = hurtCount(cur, cause)
  if (a == null || b == null) return null
  const now = topProblem(cur)
  return { cause, a, b, trend: trendOf(a, b, stepOf(cause)), ...(now && now !== cause ? { now } : {}) }
}

/** The record a follow-up reads for this match: the manager's last one
 *  before it, of the same kind (club or Test), within four weeks of the
 *  same season. Cup runs and Test windows put a gap between matches, so
 *  not just last week; beyond a month it is not the same side's problem. */
export function prevEvidence(state: GameState, cur: CausalEvidence): CausalEvidence | null {
  const list = state.tacLoop?.evidence ?? []
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i]
    if (e.fxId === cur.fxId && e.season === cur.season) continue
    if (e.season !== cur.season || cur.week - e.week > 4 || cur.week < e.week) return null
    return !!state.clubs[e.oppId] === !!state.clubs[cur.oppId] ? e : null
  }
  return null
}

/** The last record the save holds against a side: what the report's history
 *  says decided the last meeting. */
export function lastEvidence(state: GameState, oppId: string): CausalEvidence | null {
  const list = state.tacLoop?.evidence ?? []
  for (let i = list.length - 1; i >= 0; i--) if (list[i].oppId === oppId && !list[i].fr) return list[i]
  return null
}

/** Which way a touchline dial moved over the break, against the way that
 *  answers the cause: 'right', 'wrong', or 'none' under ten points. Null
 *  when the cause has no dial or the dials were not read (a Test). */
export function leverMoved(cause: WhyCause, before?: number[], after?: number[]): 'right' | 'wrong' | 'none' | null {
  const L = LEVERS[cause]
  if (!L || !before || !after) return null
  const i = LEVER_DIALS.indexOf(L.dial)
  const d = (after[i] - before[i]) * L.dir
  return d >= 10 ? 'right' : d <= -10 ? 'wrong' : 'none'
}

/** THE LEAD-IN for each full-time line, framed for the manager rather than
 *  the analyst: the line that did most in the direction of the result is
 *  "the biggest difference" in a win, else "what hurt you most" or "your
 *  strongest advantage" by its sign; after it, the first line of the other
 *  sign takes the other label once, and the rest go without. A label says
 *  which way a cause pulled, not that it alone decided anything. */
export function whyLeads(ev: CausalEvidence, lines: WhyLine[]): (string | null)[] {
  const won = ev.us > ev.them
  let plus = false, minus = false
  return lines.map((l, i) => {
    if (l.sig > 0 && !plus) {
      plus = true
      return i === 0 && won ? 'matchday.leadDiff' : 'matchday.leadEdge'
    }
    if (l.sig < 0 && !minus) {
      minus = true
      return 'matchday.leadHurt'
    }
    return null
  })
}

// ---------------------------------------------------------------- the plan

/**
 * Whether a plan's target was hit, read from the evidence rather than the
 * proxies the findings used to lean on (tries for an attack, possession for
 * a kicking game):
 *
 *   their scrum or lineout   they lost at least two more of their own feeds
 *                            there than we did of ours
 *   their defence            we broke their line two more times than they
 *                            broke ours, or made 19 points in open play
 *   their attack             they made 10 or fewer in open play, and no
 *                            more line breaks than we did
 *   their kicking            we spent longer in their 22 than they in ours
 *   their style (counter)    the style matchup came out our way
 *   the last twenty          we scored at least as many as they did after
 *                            the hour
 *   starve them of ball      52% of the ball or more, and 10 or fewer to
 *                            them in open play
 *
 * `half` reads a first forty (1.8.5: a plan carried to the break and
 * changed there is judged on the half it was played for): the counts and
 * the points above halved, the shares and the comparisons as they are.
 */
export function planExploited(target: string | null, ev: CausalEvidence, half = false): boolean {
  const [u, o] = ev.side
  const open = (s: EvSide) => s.pts[ci('move')] + s.pts[ci('break')] + s.pts[ci('phase')]
  const two = half ? 1 : 2, ten = half ? 5 : 10
  switch (target) {
    case 'scrum': return o.setLost[0] - u.setLost[0] >= two
    case 'lineout': return o.setLost[1] - u.setLost[1] >= two
    case 'defence': return u.breaks - o.breaks >= two || open(u) >= (half ? 10 : 19)
    case 'attack': return open(o) <= ten && o.breaks <= u.breaks
    case 'kicking': return u.zone[2] > o.zone[2]
    case 'style': return u.styleEdge >= o.styleEdge
    // the last twenty cannot be read off the first forty
    case 'late': return !half && ev.late >= 0
    case 'ball': return ev.poss >= 52 && open(o) <= ten
    default: return false
  }
}
