/**
 * ---- THE CLUB'S MEMORY, AS DATA ----
 *
 * Owner's design brief, pillar 4: "annals, records, legends, rivalries, former
 * players, managerial history. History must feed back into the game, not just
 * be displayed."
 *
 * This file is only the shape of that memory and the few helpers every part
 * of it shares. The parts live next door so each can be read on its own:
 *
 *   grudges.ts   rivalries that grow out of what happened, and fade
 *   legends.ts   the club's own greats, and the records they hold
 *   history.ts   the annals, the manager's former clubs, and the hooks the
 *                season, the rollover and the job market call
 *
 * ONE FIELD ON THE SAVE (GameState.hist), created on first touch, so a save
 * from before any of this simply grows one the first time it is played. Every
 * list in it is capped, because a thirty-season career must not carry thirty
 * seasons of bookkeeping into every autosave.
 *
 * NOTHING HERE DRAWS FROM AN RNG. The whole book is arithmetic on results that
 * have already happened, so it cannot move a single scoreline.
 */
import type { GameState } from './model'
import type { Vars } from './i18n'
import { tIn } from './i18n'

/** A sentence kept as a key and its values, so it reads in any language. */
export interface Line { k: string; v?: Vars }

/** A season's defining moment, waiting for the year end to judge it. */
export interface Moment extends Line { clubId: string; season: number; w: number }

export interface Rivalry {
  a: string
  b: string
  /** how hot it is. Forms at FORM_AT, cools below COOL_AT (grudges.ts) */
  heat: number
  /** a rivalry in its own right, rather than a couple of warm meetings */
  on?: boolean
  /** the season it became one */
  since?: number
  /** the last reasons, newest first, at most two */
  why: Line[]
}

export interface Legend {
  pid: number
  name: string
  clubId: string
  apps: number
  tries: number
  pts: number
  /** the season the club claimed him */
  season: number
  /** the season he stopped playing for the club, however he went */
  gone?: number
  retired?: boolean
  /** a retired legend who went into coaching, and where */
  staffAt?: string
}

/** One holder of one club record. season -1 means "from before your time". */
export interface ClubRec { name: string; pid?: number; val: number; season: number }
export type RecStat = 'apps' | 'tries' | 'pts'

export interface Tenure {
  clubId: string
  from: number
  to?: number
  w: number
  d: number
  l: number
  cups: number
  /** how it ended. Absent while it is still going. */
  exit?: 'sacked' | 'walked' | 'moved'
}

export interface HistBook {
  rivals: Rivalry[]
  annals: { season: number; clubId: string; lines: Line[] }[]
  moments: Moment[]
  legends: Legend[]
  recs: Record<string, Partial<Record<RecStat, ClubRec>>>
  tenures: Tenure[]
  /** once-only stamps: key -> season it was said. Pruned every summer. */
  said: Record<string, number>
  /** clubs whose legends and records have been read in quietly */
  seeded: string[]
  /** stories waiting for an id (see file()). Empty between weeks. */
  queue?: Omit<import('./model').NewsItem, 'id'>[]
}

export const CAPS = { rivals: 60, annals: 40, linesPerSeason: 3, legends: 40, tenures: 30, moments: 24 } as const

/** The book, created on first touch. */
export function book(state: GameState): HistBook {
  const h = (state.hist ??= {} as HistBook)
  h.rivals ??= []
  h.annals ??= []
  h.moments ??= []
  h.legends ??= []
  h.recs ??= {}
  h.tenures ??= []
  h.said ??= {}
  h.seeded ??= []
  return h
}

/** True the first time a thing is said this season, false after. */
export function once(state: GameState, key: string): boolean {
  const h = book(state)
  if (h.said[key] === state.season) return false
  h.said[key] = state.season
  return true
}

/** File a story by key, the way the rest of the game does. */
export function file(
  state: GameState, k: string, v: Vars,
  opts: { type?: 'general' | 'award' | 'gossip' | 'board'; playerId?: number; week?: number; season?: number } = {},
): void {
  // HELD, NOT FILED. News, players and fixtures share one id counter, and the
  // match engine seeds a fixture's dice from its id. A story filed in the
  // middle of the week settle (after the manager's match, or at the year
  // end) would push every cup tie drawn later in that same settle onto a
  // different id, and so onto different dice: the book would change AI
  // results without reading or writing anything they use. So the book's
  // stories wait in `queue` and take their ids in flushNews(), once the
  // week's fixtures exist. Same week and season stamps, same reader.
  ;(book(state).queue ??= []).push({
    week: opts.week ?? state.week,
    season: opts.season ?? state.season,
    type: opts.type ?? 'general',
    read: false,
    subject: tIn('en', `${k}Subj`, v),
    body: tIn('en', k, v),
    k, v, playerId: opts.playerId,
  })
}

/** The news log's ceiling (season.ts NEWS_KEEP, not imported: season.ts
 *  imports this book). */
const NEWS_CAP = 250

/** File the held stories. Called at the end of the week settle (after the
 *  advance, when no more fixtures are drawn this tick) and by the job hooks,
 *  which run outside it and should be read at once. */
export function flushNews(state: GameState): void {
  const q = state.hist?.queue
  if (!q?.length) return
  for (const n of q) state.news.push({ ...n, id: state.nextId++, k: n.k, v: n.v })
  state.hist!.queue = []
  if (state.news.length > NEWS_CAP) state.news = state.news.slice(-NEWS_CAP)
}

/** A candidate for this season's annals line. Kept to the heaviest few. */
export function moment(state: GameState, clubId: string, w: number, k: string, v: Vars = {}): void {
  const h = book(state)
  h.moments.push({ clubId, season: state.season, w, k, v })
  if (h.moments.length > CAPS.moments) {
    h.moments.sort((a, b) => b.w - a.w)
    h.moments.length = CAPS.moments
  }
}

/**
 * The consequence log's door. The memory module (memory.ts) records the
 * manager's decisions and what they led to; this book does not import it, so
 * the two can land in either order. Every place a decision of the manager's
 * becomes history calls this, and it does nothing until the two are joined.
 */
// TODO(memory): route to memory.ts record() once it lands
export function note(_state: GameState, _entry: { kind: string; clubId?: string; pid?: number; v?: Vars }): void {
  /* intentionally empty */
}

/** A stable small number from a string, for choices that must not use an rng. */
export function hashOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
