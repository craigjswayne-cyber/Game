/**
 * ---- THE SCOUT'S RECOMMENDATIONS, AND HOW FAR TO TRUST THEM ----
 *
 * Owner: "Scout reports need to come up in news for every player recommended
 * - a mixed bag of recommendations. It should be some success but not always."
 *
 * Until now the chief scout's verdict on a man (commission.ts) was graded off
 * the truth: his real ability and his real ceiling. Every "Bring him in" was a
 * man worth bringing in, which made the scout a cheat sheet rather than an
 * opinion. A verdict is now an ESTIMATE, built on what the club's file reads
 * (scout.ts fuzzedCa and scoutPa, which already carry the knowledge fog) plus
 * the scout's own judgement, which can be off. How far off depends on two
 * things the manager controls:
 *
 *   his badge        a better chief scout reads a man more truly
 *   time watched     a nine-month brief sees more than a month's postcard
 *
 * and scouts lean optimistic about their own finds, so a recommended man is a
 * little more likely to be oversold than undersold. Some of them turn out to
 * be what he said; some do not. The report remembers what he said, so once a
 * man is fully known (signed, or watched to the full file) the page can say
 * whether the call held up.
 *
 * Deterministic: the error is a hash of the man, the club and the week the
 * verdict was given, never a draw from the shared stream, so the fixed-seed
 * fingerprint cannot move.
 *
 * Every recommendation is news (scoutDesk below), but never a flood: at most
 * two scouting stories reach the inbox in a week, counting the postcards and
 * the final report, and when more names are waiting the extras go out
 * together in one story.
 */
import type { GameState, Player } from './model'
import { tIn } from './i18n'
import { subjectVar } from './gender'
import { clamp, hashString, mulberry32 } from './rng'
import { fuzzedCa, knowledge, scoutPa } from './scout'
import { noteFor, type NoteRef } from './commission'

export type RecSource = 'brief' | 'road' | 'meeting'

export interface ScoutRec {
  playerId: number
  /** the scout's verdict, 0 (a punt) to 3 (bring him in): an estimate */
  grade: number
  /** what he believed the man's present level was, on the ability scale */
  cur: number
  /** and his ceiling */
  pot: number
  note: NoteRef
  season: number
  week: number
  src: RecSource
  /** its story has gone to the inbox (or another story already carried it) */
  posted?: boolean
}

/** How many recommendations the Scouting page remembers. */
export const REC_CAP = 40

/** The same worth the scout has always ranked on (commission.ts), here read
 *  off his estimate rather than the truth. */
export const worthFrom = (cur: number, pot: number, age: number) =>
  (cur - 60) * 1.8 + (pot - cur) * 1.8 + (30 - age) * 0.8
export const gradeOf = (worth: number) => worth >= 52 ? 3 : worth >= 34 ? 2 : worth >= 16 ? 1 : 0

/**
 * How wide his judgement can miss, in ability points on the ceiling (the
 * present level misses by about half of it). A one-badge scout after a
 * month's look can be a dozen points out on a man's ceiling; a
 * three-badge scout after nine months is within three or so.
 */
export function judgementSpread(tier: number, weeksWatched: number): number {
  const eye = 17 - 4 * clamp(tier, 0, 3)
  const time = clamp(1.4 - weeksWatched / 30, 0.6, 1.4)
  return eye * time
}

const unit = (s: string) => mulberry32(hashString(s))() * 2 - 1

/** The scout's estimate of a man: present level, ceiling and verdict. Read
 *  AFTER his knowledge has been raised by the watching, so the file's own
 *  fog is part of it, and then his judgement on top. */
export function scoutVerdict(state: GameState, p: Player, weeksWatched: number): { cur: number; pot: number; grade: number } {
  const tier = state.staff?.scout ?? 0
  const spread = judgementSpread(tier, weeksWatched)
  const key = `verdict|${p.id}|${state.userClubId}|${state.season}|${state.week}`
  // a scout leans towards his own finds: the error is centred a little high
  const e1 = unit(`${key}|cur`) + 0.2
  const e2 = unit(`${key}|pot`) + 0.3
  const cur = clamp(Math.round(fuzzedCa(state, p) + e1 * spread * 0.5), 30, 99)
  const pot = clamp(Math.round(scoutPa(state, p) + e2 * spread), cur, 99)
  return { cur, pot, grade: gradeOf(worthFrom(cur, pot, p.age)) }
}

/** A recommendation with its own note, for the sources that do not draw one
 *  (the postcards and the recruitment meeting): the note's pick is a hash. */
export function makeRec(state: GameState, p: Player, weeksWatched: number, src: RecSource, posted: boolean): ScoutRec {
  const v = scoutVerdict(state, p, weeksWatched)
  const rng = mulberry32(hashString(`recnote|${p.id}|${state.season}|${state.week}`))
  return { playerId: p.id, ...v, note: noteFor(v.grade, v.pot - v.cur, rng), season: state.season, week: state.week, src, posted }
}

/** File a recommendation: the newest verdict on a man replaces an older one. */
export function fileRec(state: GameState, rec: ScoutRec): void {
  const list = (state.scoutRecs ??= []).filter(r => r.playerId !== rec.playerId)
  list.push(rec)
  state.scoutRecs = list.slice(-REC_CAP)
}

/** Every man the department has a verdict on, newest first. A save from
 *  before the recommendations keeps its last report's names, read through the
 *  file as it stands. */
export function scoutList(state: GameState): ScoutRec[] {
  const out = [...(state.scoutRecs ?? [])].filter(r => state.players[r.playerId])
    .sort((a, b) => (b.season - a.season) || (b.week - a.week) || b.grade - a.grade)
  for (const f of state.scoutFinds ?? []) {
    const p = state.players[f.playerId]
    if (!p || out.some(r => r.playerId === f.playerId) || typeof f.note === 'string') continue
    const cur = Math.round(fuzzedCa(state, p))
    out.push({ playerId: p.id, grade: f.grade, cur, pot: Math.max(cur, Math.round(scoutPa(state, p))), note: f.note, season: state.season, week: state.week, src: 'brief', posted: true })
  }
  return out
}

export function recFor(state: GameState, playerId: number): ScoutRec | null {
  return scoutList(state).find(r => r.playerId === playerId) ?? null
}

/** In hindsight, once the man is fully known: did the call hold up? Read on
 *  the present level against what the scout said it was. */
export type Hindsight = 'better' | 'held' | 'worse'
export function hindsight(state: GameState, rec: ScoutRec): Hindsight | null {
  const p = state.players[rec.playerId]
  if (!p || knowledge(state, p) < 95) return null
  const d = p.ca - rec.cur
  return d >= 3 ? 'better' : d <= -3 ? 'worse' : 'held'
}

/** One man's line in a story, as a key and its variables. */
function recVars(state: GameState, rec: ScoutRec, p: Player) {
  const club = p.clubId ? state.clubs[p.clubId] : undefined
  return {
    player: p.name, age: p.age, pos_k: `pos.${p.pos}`,
    club: club?.name ?? '', at_k: club ? 'news.atClub' : p.clubId ? 'news.atClubAbroad' : 'news.atNoClub',
    grade_k: `news.grade${rec.grade}`,
  }
}

/**
 * Weekly, after the department's other mail: the verdicts waiting to be told.
 * Two scouting stories a week at most, the postcard and the final report
 * counted in. One verdict waiting is its own story; more than that with room
 * for one story goes out together; with room for two the first gets its own
 * story and the rest go together.
 */
export function scoutDesk(state: GameState): void {
  const recs = state.scoutRecs
  if (!recs?.length) return
  // a man who has since joined us, retired or left the game needs no verdict,
  // and a manager out of work has no department writing to him: what was
  // owed is not saved up for his next club
  for (const r of recs) {
    const p = state.players[r.playerId]
    if (!r.posted && (state.unemployed || !p || p.clubId === state.userClubId || p.retiring)) r.posted = true
  }
  const queue = recs.filter(r => !r.posted)
  if (!queue.length) return
  let slots = 2
  for (let i = state.news.length - 1; i >= 0 && slots > 0; i--) {
    const n = state.news[i]
    if (n.season !== state.season || n.week !== state.week) break
    if (n.tag === 'scout') slots--
  }
  if (slots <= 0) return
  const man = state.staffPeople?.scout
  const who = { ...subjectVar(man?.g), scout: man?.name ?? '', scout_k: man ? 'news.scoutNamed' : 'news.theChiefScout' }
  queue.sort((a, b) => b.grade - a.grade || a.playerId - b.playerId)
  const single = (rec: ScoutRec) => {
    const p = state.players[rec.playerId]
    rec.posted = true
    const v = { ...who, ...recVars(state, rec, p), note_k: rec.note.k, ...rec.note }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false, tag: 'scout',
      subject: tIn('en', 'news.scoutRecSubj', v), body: tIn('en', 'news.scoutRec', v),
      k: 'news.scoutRec', v, playerId: p.id,
    })
  }
  if (queue.length === 1 || slots >= 2) { single(queue.shift()!); slots-- }
  if (!queue.length || slots <= 0) return
  if (queue.length === 1) { single(queue[0]); return }
  const batch = queue.slice(0, 6)
  const rows = batch.map(rec => {
    rec.posted = true
    const p = state.players[rec.playerId]
    return { k: 'news.scoutRecRow', ...recVars(state, rec, p) }
  })
  const v = { ...who, n: batch.length, rows_ll: JSON.stringify(rows) }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false, tag: 'scout',
    subject: tIn('en', 'news.scoutRecsSubj', v), body: tIn('en', 'news.scoutRecs', v),
    k: 'news.scoutRecs', v, playerIds: batch.map(r => r.playerId),
  })
}
