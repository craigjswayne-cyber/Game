// ---- THE PLAYBOOK ARMS RACE (1.8.2, owner brief A) ----
//
// The manager's attacking calls are a playbook (moves.ts callsOf): a base
// shape for open play, a primary and a secondary strike off first-phase ball
// in the mix he sets, and a red-zone play for the opposition 22; the set-
// piece launch they come off is the lineout and scrum call (playbook.ts).
// This module is the race that playbook runs in, and it is built on what was
// already there rather than beside it:
//
//   FAMILIARITY. Every match a call is in the playbook is a rep, and a side
//   gets better at what it runs (moves.ts familiarityOf: 87% after fifteen
//   matches). A new call starts at nothing and pays 70% of what it will.
//
//   THE TAPE. Every first-phase possession the manager's side has, and the
//   strike it was run on, is counted from the fixture's own launch hashes
//   (launchOf, mixHash): the same possessions the engine plays, so the count
//   is exact and costs no draw. The count fades match by match, so what the
//   opposition's analysts hold is his recent rugby, and it halves over the
//   summer (playbook.resetFamiliarity).
//
//   THE ANSWER. An AI coach who reads tape sets his defence for the calls he
//   has seen: the matchup of a call is pulled towards the worst it can be
//   (moves.ts moveEdge, adapt), by how predictable the whole tape is (1.8.3:
//   the sum of the squared shares, so one strike on everything is 1, two
//   halves 0.5 and three thirds 0.33; nothing at 35%, all of it by 75%), how
//   much of the tape this call is (a call on two possessions in five is
//   planned for in full), how much tape there is, and what kind of coach he
//   is (oppcoach.ts archetypeOf: an analyst fully, a reactive coach most of
//   the way, a stubborn one barely). So a call run on two thirds of the ball
//   is blunted against the sharp dugouts, and the manager's dilemma is the
//   owner's: keep running it and take the blunting, or hide it behind the
//   secondary and develop something else, which costs familiarity while the
//   new call beds in. Until 1.8.3 the coach read each call's share alone, so
//   switching between two strikes match by match ran each on the smaller
//   share of a two-strike tape and was worth more than splitting the ball
//   between them in every match; a coach who reads the whole tape sees two
//   strikes either way.
//
//   THE WEAR. What the analysts have on a call (playbook.used, read by
//   moveEdge and routineEffect) is no longer kept until the summer (1.8.3):
//   a call left out fades by WEAR_FADE a match, a half-life of six, so one
//   left on the shelf for a month and a half comes back with most of its
//   surprise. A strike goes on it by its share of this match's first-phase
//   strikes and fades by the share it did not get, so one strike on all the
//   ball wears exactly as every call did before, and splitting the ball
//   between two wears each by half, as the tape does; every other call is
//   a whole one. This is the manager's alone: an AI club's wear is counted
//   in matchEngine as it always was.
//
// Deterministic throughout: no draw on any shared rng, and nothing here
// touches an AI club's rugby, so a world without a manager is the same world.

import type { Club, Fixture, GameState } from './model'
import { MIX_DEFAULT, MOVE_BY_ID, calledIds, callForTick, callsOf, launchOf, mixHash, type Launch } from './moves'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, playbookOf } from './playbook'
import { archetypeOf, type Archetype } from './oppcoach'
import { clamp } from './rng'

/** ticks in a match (matchEngine plays twenty of four minutes) */
export const MATCH_TICKS = 20
/** what is left of the tape on a strike after each further match */
export const TAPE_FADE = 0.8
/** how predictable the tape (the sum of its squared shares) can be before
 *  anybody sets up for it: three strikes in equal parts read as nothing */
export const ADAPT_FROM = 0.35
/** and the predictability past that at which a coach is fully set */
export const ADAPT_SPAN = 0.4
/** the share of the tape at which a call is planned for in full; below it,
 *  in proportion */
export const ADAPT_COVER = 0.4
/** what is left of the wear on a call after each match (a half-life of six) */
export const WEAR_FADE = Math.pow(0.5, 1 / 6)
/** the furthest a defence moves: the matchup pulled 55% of the way to the worst */
export const ADAPT_MAX = 0.55
/** first-phase possessions of tape before a coach trusts what he has */
export const TAPE_FULL = 12
/** how far each kind of coach sets his defence for what he has seen */
export const SHARP: Record<Archetype, number> = { stubborn: 0.25, analyst: 1, reactive: 0.65 }

/** The strikes a side runs on its first-phase ball in one fixture: every
 *  tick launched from a set piece, and the call for it. The red zone is not
 *  counted: the tape is of the side's set moves, not its play in the 22. */
export function firstPhase(state: GameState, club: Club, fxId: number, home: boolean): { n: number; runs: Record<string, number> } {
  const c = callsOf(state, club)
  const runs: Record<string, number> = {}
  let n = 0
  for (let tick = 0; tick < MATCH_TICKS; tick++) {
    const launch: Launch = launchOf(fxId, tick, home)
    if (launch === 'open') continue
    n++
    const r = callForTick(c, launch, mixHash(fxId, tick, home), false)
    if (r) runs[r.id] = (runs[r.id] ?? 0) + 1
  }
  return { n, runs }
}

/**
 * The match's tape, filed as the manager's match kicks off (matchEngine
 * beginMatch): a rep for every call in the playbook, the wear on every call
 * faded and this match's calls on it, the tape of the ones that are not
 * fading, and this fixture's first-phase strikes on top. Once per fixture
 * however often it is begun.
 */
export function tallyCalls(state: GameState, fx: Fixture): void {
  const club = state.clubs[state.userClubId]
  if (!club || (fx.homeId !== club.id && fx.awayId !== club.id)) return
  const pb = playbookOf(club)
  const key = `${state.season}:${fx.id}`
  if (pb.tallied === key) return
  pb.tallied = key
  // the reps: a save from before they were kept starts from this season's calls
  if (!pb.reps || typeof pb.reps !== 'object') {
    pb.reps = {}
    for (const [id, n] of Object.entries(pb.used)) if (MOVE_BY_ID[id] && Number.isFinite(n)) pb.reps[id] = n
  }
  const reps = pb.reps
  const c = callsOf(state, club)
  const called = new Set(calledIds(c))
  for (const id of Object.keys(reps)) {
    if (called.has(id)) continue
    // a call left out of the playbook is slowly forgotten
    reps[id] = Number.isFinite(reps[id]) ? reps[id] * 0.97 : 0
    if (reps[id] < 0.05) delete reps[id]
  }
  for (const id of called) reps[id] = (Number.isFinite(reps[id]) ? reps[id] : 0) + 1
  const fp = firstPhase(state, club, fx.id, fx.homeId === club.id)
  // the wear: this match's share of each call (a strike its share of the
  // strikes run, so one strike on all of them is a whole call; the shape,
  // the red-zone and penalty plays and the set-piece routines a call each),
  // and each fades by the share it did not get
  const share: Record<string, number> = {}
  const struck = Object.values(fp.runs).reduce((a, b) => a + b, 0)
  const whole = new Set([c.shape, c.red, c.pen].filter((x): x is string => !!x))
  // (a fixture with no first-phase ball wears the strikes by the mix)
  const mix = c.main && c.alt ? (c.mix ?? MIX_DEFAULT / 100) : 1
  for (const id of called) {
    share[id] = whole.has(id) || (id !== c.main && id !== c.alt) ? 1
      : struck > 0 ? (fp.runs[id] ?? 0) / struck
      : id === c.main ? mix : 1 - mix
  }
  for (const id of [club.tactic.lineoutCall ?? DEFAULT_LINEOUT, club.tactic.scrumCall ?? DEFAULT_SCRUM]) share[id] = 1
  const used = (pb.used && typeof pb.used === 'object') ? pb.used : (pb.used = {})
  for (const id of new Set([...Object.keys(used), ...Object.keys(share)])) {
    const was = Number.isFinite(used[id]) && used[id] > 0 ? used[id] : 0
    const s = share[id] ?? 0
    used[id] = was * Math.pow(WEAR_FADE, 1 - s) + s
    if (used[id] < 0.05) delete used[id]
  }
  // the tape
  const faced = (pb.faced && typeof pb.faced === 'object') ? pb.faced : (pb.faced = {})
  for (const id of Object.keys(faced)) {
    faced[id] = Number.isFinite(faced[id]) ? faced[id] * TAPE_FADE : 0
    if (faced[id] < 0.05) delete faced[id]
  }
  for (const [id, n] of Object.entries(fp.runs)) faced[id] = (faced[id] ?? 0) + n
}

export interface Tape {
  /** first-phase possessions of tape, faded */
  total: number
  /** each strike's share of them */
  share: Record<string, number>
  /** the one run most, if any */
  top: { id: string; share: number } | null
  /** how predictable it is, 0..1: the sum of the squared shares */
  predict: number
}

/** What the opposition's analysts have on the manager's strikes. */
export function tapeOf(club: Club | undefined): Tape {
  const faced = club?.playbook?.faced
  const share: Record<string, number> = {}
  let total = 0
  if (faced && typeof faced === 'object') {
    for (const [id, n] of Object.entries(faced)) if (MOVE_BY_ID[id] && Number.isFinite(n) && n > 0) total += n
    if (total > 0) for (const [id, n] of Object.entries(faced)) if (MOVE_BY_ID[id] && Number.isFinite(n) && n > 0) share[id] = n / total
  }
  let top: Tape['top'] = null, predict = 0
  for (const [id, s] of Object.entries(share)) {
    predict += s * s
    if (!top || s > top.share || (s === top.share && id < top.id)) top = { id, share: s }
  }
  return { total, share, top, predict }
}

/** How far this opponent's coach sets his defence for the manager's call,
 *  0..ADAPT_MAX. Nothing for a Test side, the manager's own club, a call that
 *  is not on the tape, or a tape too varied for anybody to plan on. */
export function adaptOf(state: GameState, oppId: string | null | undefined, id: string): number {
  if (!oppId || oppId === state.userClubId) return 0
  const opp = state.clubs[oppId]
  const me = state.clubs[state.userClubId]
  if (!opp || !me) return 0
  const tape = tapeOf(me)
  const s = tape.share[id] ?? 0
  if (s <= 0 || tape.predict <= ADAPT_FROM) return 0
  return SHARP[archetypeOf(opp.id, opp.rep)] * ADAPT_MAX
    * clamp((tape.predict - ADAPT_FROM) / ADAPT_SPAN, 0, 1) * clamp(s / ADAPT_COVER, 0, 1)
    * clamp(tape.total / TAPE_FULL, 0, 1)
}

/** The adapt for every call the manager has, against one opponent, taken
 *  as the match begins (so the match's own tape never counts against it). */
export function adaptMap(state: GameState, oppId: string): Record<string, number> {
  const me = state.clubs[state.userClubId]
  const out: Record<string, number> = {}
  if (!me) return out
  for (const id of calledIds(callsOf(state, me))) {
    const a = adaptOf(state, oppId, id)
    if (a > 0) out[id] = a
  }
  return out
}

/** below this the answer is not worth a word on the report or the desk */
export const ADAPT_WORTH = 0.12

/**
 * The opposition report's line on the manager's own calls (oppreport.ts):
 * the call their analysts have seen most and on what share of his
 * first-phase ball, and whether this coach sets up for it. The share is his
 * own count, so it is exact; whether they answer it is the coach's kind,
 * which only a report sharp enough to read the coach can say.
 */
export function tapeLine(state: GameState, oppId: string, acc: number): { k: string; v: Record<string, string | number> } | null {
  const me = state.clubs[state.userClubId]
  const opp = state.clubs[oppId]
  if (!me || !opp) return null
  const tape = tapeOf(me)
  if (!tape.top || tape.total < 6) return null
  const pct = Math.round(tape.top.share * 100)
  const v = { move_k: MOVE_BY_ID[tape.top.id].say, pct }
  if (acc < 0.55) return { k: 'armsrace.tapeUnread', v }
  const a = adaptOf(state, oppId, tape.top.id)
  return { k: a >= ADAPT_WORTH ? 'armsrace.tapeSet' : 'armsrace.tapeCalm', v }
}

/**
 * An old save's calls, as a playbook: the lineout call becomes the primary
 * strike and the scrum call the secondary (the same move twice is one call),
 * and whatever a damaged save carries in the new fields is dropped rather
 * than half-read. Idempotent.
 */
export function migratePlaybook(s: GameState): void {
  const club = s.clubs?.[s.userClubId]
  if (!club) return
  const tac = club.tactic
  const ok = (id: unknown): id is string => typeof id === 'string' && !!MOVE_BY_ID[id]
  if (tac.moveMain === undefined && tac.moveAlt === undefined && (tac.moveLineout !== undefined || tac.moveScrum !== undefined)) {
    const a = ok(tac.moveLineout) && !MOVE_BY_ID[tac.moveLineout].red ? tac.moveLineout : undefined
    const b = ok(tac.moveScrum) && !MOVE_BY_ID[tac.moveScrum].red ? tac.moveScrum : undefined
    tac.moveMain = a ?? b
    tac.moveAlt = a && b && a !== b ? b : undefined
  }
  delete tac.moveLineout
  delete tac.moveScrum
  for (const k of ['moveMain', 'moveAlt', 'moveRed', 'moveShape', 'movePen'] as const) if (tac[k] !== undefined && !ok(tac[k])) delete tac[k]
  // the tap penalty play had the red-zone slot until round 6: it moves to the
  // penalty slot, so the side runs it on the same ticks it always did
  if (tac.moveRed !== undefined && MOVE_BY_ID[tac.moveRed].from.includes('tap')) {
    if (tac.movePen === undefined) tac.movePen = tac.moveRed
    delete tac.moveRed
  }
  if (tac.movePen !== undefined && !MOVE_BY_ID[tac.movePen].from.includes('tap')) delete tac.movePen
  if (tac.moveMix !== undefined && !Number.isFinite(tac.moveMix)) delete tac.moveMix
  const pb = club.playbook
  if (!pb || typeof pb !== 'object') return
  // the wear is a count per call, moves and set-piece routines alike
  if (!pb.used || typeof pb.used !== 'object' || Array.isArray(pb.used)) pb.used = {}
  for (const [id, v] of Object.entries(pb.used as Record<string, unknown>)) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) delete (pb.used as Record<string, unknown>)[id]
  }
  for (const k of ['reps', 'faced'] as const) {
    const m = pb[k] as unknown
    if (m === undefined) continue
    if (!m || typeof m !== 'object' || Array.isArray(m)) { delete pb[k]; continue }
    for (const [id, v] of Object.entries(m as Record<string, unknown>)) {
      if (!MOVE_BY_ID[id] || typeof v !== 'number' || !Number.isFinite(v) || v < 0) delete (m as Record<string, unknown>)[id]
    }
  }
  if (pb.tallied !== undefined && typeof pb.tallied !== 'string') delete pb.tallied
}

/** The desk's question when this week's opponent is set for the manager's
 *  most-run call: keep running it, or hide it? Null otherwise. */
export function deskQuestion(state: GameState, oppId: string): { move_k: string; pct: number } | null {
  const me = state.clubs[state.userClubId]
  if (!me || !state.clubs[oppId]) return null
  const tape = tapeOf(me)
  if (!tape.top || !calledIds(callsOf(state, me)).includes(tape.top.id)) return null
  if (adaptOf(state, oppId, tape.top.id) < ADAPT_WORTH) return null
  return { move_k: MOVE_BY_ID[tape.top.id].say, pct: Math.round(tape.top.share * 100) }
}
