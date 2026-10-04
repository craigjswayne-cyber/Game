/**
 * ---- WHAT DID I BUILD HERE? (1.8.4) ----
 *
 * The era summary (erastory.ts) told a job back as a sentence and ten rows of
 * numbers. This reads the same job as a manager remembers it: how long, how
 * it went, what was won, which way the club moved, the boys brought through
 * and the money spent, and the few moments that changed the club.
 *
 * TURNING POINTS, AND ONLY A FEW. A season gives at most one (TP_PER_SEASON)
 * and an era at most three (TP_PER_ERA), the heaviest kept and told in the
 * order they happened. Each is read from a record that already exists and
 * outlives the season:
 *
 *   a league title or a cup     state.mgr.trophies
 *   promotion or relegation     the annals line (history.ts historyYearEnd)
 *   a final or play-off turned  the annals line noteDecider writes below
 *   a long unbeaten run         the record book (records.ts offerRun)
 *   the low point, and the turn the era's worst defeat, when the season after
 *                               it finished higher, went up or won something
 *   the era's biggest fee       the era's own book (erastory.ts eraSigning)
 *
 * A sacking survived and a season in administration leave no record behind
 * them once the season turns, so they are not read here.
 *
 * THE MATCH THAT TURNED. A final or a promotion play-off whose lead changed
 * hands for the last time on the side that won it: the minute is in the
 * match's evidence (evidence.ts, `lead`), and noteDecider puts it into the
 * season's annals as a moment, which is the one thing this file writes. No
 * rng, and nothing that plays a match reads any of it.
 */
import type { Fixture, GameState } from './model'
import { fmtMoney, leagueTier } from './model'
import type { Vars } from './i18n'
import type { CausalEvidence } from './evidence'
import type { CurEra, Era } from './arcbook'
import { moment } from './histbook'
import { HIST_OFF } from './history'

export const TP_PER_SEASON = 1
export const TP_PER_ERA = 3
/** An unbeaten run worth a line. */
export const TP_RUN = 10

export type TpWhy = 'title' | 'cup' | 'up' | 'down' | 'final' | 'run' | 'low' | 'signing'
export interface TurningPoint { s: number; why: TpWhy; k: string; v: Vars; w: number }

/** The era's own facts a turning point may name: the worst defeat and the
 *  biggest fee, each with its season. */
type EraFacts = { wd?: { o: string; us: number; them: number; s?: number }; rs?: { n: string; fee: number; s?: number } }

/** The job at this club that the season belongs to: the one in progress, or
 *  the latest told era that spans it. */
function factsFor(state: GameState, clubId: string, season: number): EraFacts | null {
  const cur: CurEra | undefined = state.arc?.cur
  if (cur && cur.c === clubId && season >= cur.f) return cur
  const eras = (state.arc?.eras ?? []).filter(e => e.c === clubId && e.f <= season && season <= e.t)
  return eras[eras.length - 1] ?? null
}

/** Which club the manager finished a season with, if the record knows. */
function clubOfSeason(state: GameState, season: number): string | undefined {
  const f = state.mgr.finishes.find(x => x.season === season)
  if (f?.clubId) return f.clubId
  return season === state.season && !state.unemployed ? state.userClubId : undefined
}

const annalLines = (state: GameState, clubId: string, season: number) =>
  (state.hist?.annals ?? []).find(a => a.season === season && a.clubId === clubId)?.lines ?? []

/** The season after a low point was better: a higher finish in the same
 *  league tier by three places or more, promotion, or a trophy. */
function turnedAfter(state: GameState, clubId: string, season: number): boolean {
  const a = state.mgr.finishes.find(x => x.season === season && (x.clubId ?? clubId) === clubId)
  const b = state.mgr.finishes.find(x => x.season === season + 1 && (x.clubId ?? clubId) === clubId)
  if (state.mgr.trophies.some(x => x.season === season + 1 && x.clubId === clubId)) return true
  if (annalLines(state, clubId, season + 1).some(l => l.k === 'hist.anUp')) return true
  if (!a || !b || a.pos <= 0 || b.pos <= 0) return false
  return leagueTier(a.leagueId) === leagueTier(b.leagueId) && b.pos <= a.pos - 3
}

/** Every candidate a season offers, heaviest first. */
export function seasonCandidates(state: GameState, clubId: string, season: number): TurningPoint[] {
  const out: TurningPoint[] = []
  const lines = annalLines(state, clubId, season)
  const turned = lines.filter(l => l.k === 'hist.anTurnWon' || l.k === 'hist.anTurnLost')
  const name = (id: string) => state.comps[id]?.short ?? id
  for (const x of state.mgr.trophies) {
    // the trophies the era counts (erastory.ts buildEra): won with this club
    if (x.season !== season || x.clubId !== clubId) continue
    const league = state.comps[x.compId]?.type === 'league'
    // the final that won it, told as the match turned, when it did
    const fin = turned.find(l => l.k === 'hist.anTurnWon' && l.v?.cid === x.compId)
    if (fin) out.push({ s: season, why: 'final', k: fin.k, v: { ...fin.v }, w: league ? 100 : 90 })
    else out.push({ s: season, why: league ? 'title' : 'cup', k: league ? 'hist.anTitle' : 'hist.anCup', v: { comp: name(x.compId) }, w: league ? 100 : 90 })
  }
  for (const l of lines) {
    if (l.k === 'hist.anUp') out.push({ s: season, why: 'up', k: 'hist.anUp', v: { comp: String(l.v?.comp ?? '') }, w: 95 })
    else if (l.k === 'hist.anDown') out.push({ s: season, why: 'down', k: 'hist.anDown', v: { comp: String(l.v?.comp ?? '') }, w: 95 })
    else if (l.k === 'hist.anTurnLost' || (l.k === 'hist.anTurnWon' && !out.some(o => o.k === l.k && o.v.cid === l.v?.cid))) {
      out.push({ s: season, why: 'final', k: l.k, v: { ...l.v }, w: l.k === 'hist.anTurnWon' ? 85 : 80 })
    }
  }
  const run = state.era?.longestUnbeaten
  if (run && run.season === season && run.n >= TP_RUN && clubOfSeason(state, season) === clubId) {
    out.push({ s: season, why: 'run', k: 'tp.run', v: { n: run.n }, w: 75 })
  }
  const facts = factsFor(state, clubId, season)
  if (facts?.wd && facts.wd.s === season && turnedAfter(state, clubId, season)) {
    out.push({ s: season, why: 'low', k: 'tp.low', v: { us: facts.wd.us, them: facts.wd.them, opp: name(facts.wd.o) }, w: 70 })
  }
  if (facts?.rs && facts.rs.s === season) {
    out.push({ s: season, why: 'signing', k: 'tp.signing', v: { player: facts.rs.n, fee: fmtMoney(facts.rs.fee) }, w: 60 })
  }
  return out.sort((a, b) => b.w - a.w)
}

/** The season's one turning point, or none. */
export function seasonTurn(state: GameState, clubId: string, season: number): TurningPoint | null {
  return seasonCandidates(state, clubId, season)[0] ?? null
}

/** An era's turning points: the heaviest TP_PER_ERA of its seasons' one each,
 *  in the order they happened. */
export function eraTurns(state: GameState, clubId: string, from: number, to: number): TurningPoint[] {
  const each: TurningPoint[] = []
  for (let s = from; s <= to; s++) {
    const tp = seasonTurn(state, clubId, s)
    if (tp) each.push(tp)
  }
  return each.sort((a, b) => b.w - a.w || a.s - b.s).slice(0, TP_PER_ERA).sort((a, b) => a.s - b.s)
}

/** What the era built, as numbers a manager can read at a glance. */
export interface Built {
  seasons: number
  w: number; d: number; l: number
  cups: number
  up: number
  down: number
  /** academy debuts given, and how many of those men have played Test rugby */
  grads?: number
  capped: number
  tps: TurningPoint[]
}

export function eraBuilt(state: GameState, e: Era): Built {
  let up = 0, down = 0
  for (let s = e.f; s <= e.t; s++) {
    for (const l of annalLines(state, e.c, s)) {
      if (l.k === 'hist.anUp') up++
      else if (l.k === 'hist.anDown') down++
    }
  }
  return {
    seasons: Math.max(1, e.t - e.f + 1), w: e.w, d: e.d, l: e.l, cups: e.tr.length,
    up, down, grads: e.gr, capped: e.intl,
    tps: eraTurns(state, e.c, e.f, e.t),
  }
}

/**
 * evidence.ts fileEvidence: a final or a promotion play-off of the manager's
 * whose lead changed hands for the last time on the side that won it. Held
 * as a moment for the season's annals (histbook.ts), which is what keeps it.
 */
export function noteDecider(state: GameState, fx: Fixture, ev: CausalEvidence): void {
  if (HIST_OFF.on || state.unemployed) return
  if (fx.stage !== 'F' && fx.stage !== 'BAR') return
  const uid = state.userClubId
  if (fx.homeId !== uid && fx.awayId !== uid) return
  const last = ev.lead[ev.lead.length - 1]
  if (last == null || ev.us === ev.them) return
  const won = ev.us > ev.them
  if (won !== last > 0) return
  moment(state, uid, won ? 85 : 80, won ? 'hist.anTurnWon' : 'hist.anTurnLost', {
    comp: state.comps[fx.compId]?.short ?? fx.compId, cid: fx.compId,
    stage_k: fx.stage === 'BAR' ? 'hist.stagePlayoff' : 'hist.stageFinal',
    min: Math.abs(last), us: ev.us, them: ev.them,
  })
}
