// The memory log itself: its kinds, its entries, and the doors that write,
// read and prune it (remember, noteMemory, recall, pruneMemory). A leaf below
// memory.ts, so that histbook (which legends imports, which memory imports)
// can note into the log without importing memory back. memory.ts keeps the
// payoffs and the recording helpers and re-exports everything here; the
// consequence engine's narrative header stays at the top of memory.ts.
import type { GameState } from './model'
import { clamp } from './rng'


/** What the manager did, by name. Add a literal to add a kind. */
export type MemoryKind =
  | 'released'          // paid off and let go (release.ts)
  | 'sold'              // accepted a bid (ai.ts executeTransfer)
  | 'let-go'            // contract run down, academy lad not offered terms, pre-contract elsewhere
  | 'promise-kept'
  | 'promise-broken'
  | 'rushed-back'       // sent out to play through a knock (knock.ts)
  | 'academy-debut'     // first senior rugby of his life, in your side
  | 'request-refused'   // transfer request turned down (chats.ts)
  | 'request-granted'
  | 'staff-sacked'
  | 'staff-hired'
  | 'sponsor-ended'     // a commercial deal ended early (commercial.ts)
  | 'dropped-for-signing'
  | 'rift' | 'bond' | 'plan-followed' | 'plan-ignored' | 'former-player-met'
  // the club's history book (histbook.ts note): rivalries and the manager's jobs
  | 'rivalry-formed' | 'took-job' | 'left-sacked' | 'left-walked' | 'left-moved'
  // the dressing room's ledger (bonds.ts)
  | 'bonds-seeded' | 'mate-left' | 'armband-passed' | 'senior-dropped' | 'clique-formed' | 'clique-ended'
  // the club's identity (identity.ts): a label earned or lost
  | 'identity-formed' | 'identity-faded'
  // the office's risk-and-reward calls (room.ts, acadcall.ts)
  | 'room-stood' | 'room-reversed' | 'renew-early' | 'renew-waited' | 'rested'
  | 'acad-kept' | 'acad-loaned' | 'acad-let-go'
  | 'role-promised' | 'role-refused' | 'role-listed'

export interface MemoryEntry {
  id: number
  season: number
  week: number
  kind: MemoryKind
  playerId?: number
  clubId?: string
  /** small facts frozen at the time: a name, a fee, the caps he had */
  payload?: Record<string, string | number>
  /** 1 background, 2 notable, 3 the kind of call a career is judged on */
  sal: number
  /** payoffs already told about this entry, so each fires once */
  paid?: string[]
}

export interface MemoryLog {
  entries: MemoryEntry[]
  next: number
  /** absolute week of the last memory story, for pacing */
  last?: number
  /** stories told this season, and which season that count is for */
  told?: number
  toldS?: number
  /** stories waiting for an id (see tell()). Empty between weeks. */
  queue?: Omit<import('./model').NewsItem, 'id'>[]
}

/** Enough for several seasons of decisions; an entry is ~120 bytes in a save. */
export const MEMORY_CAP = 160
/** Most memory stories a season. The world remembers; it does not nag. */
export const STORIES_PER_SEASON = 7

export function memoryLog(state: GameState): MemoryLog {
  return (state.memory ??= { entries: [], next: 1 })
}

/** Write a decision into the manager's memory. Season and week are filled in. */
export function remember(
  state: GameState,
  e: { kind: MemoryKind; playerId?: number; clubId?: string; payload?: Record<string, string | number>; sal?: number },
): MemoryEntry {
  const log = memoryLog(state)
  const entry: MemoryEntry = {
    id: log.next++, season: state.season, week: state.week, kind: e.kind, sal: clamp(Math.round(e.sal ?? 1), 1, 3),
  }
  if (e.playerId != null) entry.playerId = e.playerId
  if (e.clubId != null) entry.clubId = e.clubId
  if (e.payload) entry.payload = e.payload
  log.entries.push(entry)
  if (log.entries.length > MEMORY_CAP) pruneMemory(state)
  return entry
}

/** Kinds other modules name in their own spelling, and what each is here. */
const ALIAS: Record<string, MemoryKind> = {
  plan_followed: 'plan-followed', plan_ignored: 'plan-ignored', 'rivalry-born': 'rivalry-formed',
}
/** How much each of the looser kinds matters. */
const NOTE_SAL: Partial<Record<MemoryKind, number>> = {
  'plan-followed': 1, 'plan-ignored': 1, 'rivalry-formed': 2, 'took-job': 3, 'left-sacked': 3, 'left-walked': 3, 'left-moved': 3,
}

/**
 * The door for modules that note things in their own words (matchfindings.ts,
 * histbook.ts): the kind is translated, the payload kept to what a save can
 * hold (numbers and strings; a flag becomes 1 or 0), and anything that is not
 * a known kind is left out rather than written as junk.
 */
export function noteMemory(
  state: GameState,
  e: { kind: string; clubId?: string; playerId?: number; payload?: Record<string, unknown> },
): MemoryEntry | null {
  const kind = (ALIAS[e.kind] ?? e.kind) as MemoryKind
  if (!(kind in NOTE_SAL)) return null
  let payload: Record<string, string | number> | undefined
  for (const [k, v] of Object.entries(e.payload ?? {})) {
    const val = typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v : null
    if (val != null) (payload ??= {})[k] = val
  }
  return remember(state, { kind, clubId: e.clubId, playerId: e.playerId, payload, sal: NOTE_SAL[kind] })
}

/** Everything remembered that matches, oldest first. */
export function recall(
  state: GameState,
  q: { kind?: MemoryKind | MemoryKind[]; playerId?: number; clubId?: string; sinceSeason?: number } = {},
): MemoryEntry[] {
  const kinds = q.kind == null ? null : Array.isArray(q.kind) ? q.kind : [q.kind]
  return (state.memory?.entries ?? []).filter(e =>
    (!kinds || kinds.includes(e.kind)) &&
    (q.playerId == null || e.playerId === q.playerId) &&
    (q.clubId == null || e.clubId === q.clubId) &&
    (q.sinceSeason == null || e.season >= q.sinceSeason))
}

/**
 * Keep the log under its cap. First the dead: entries older than eight seasons,
 * and low-salience ones whose player has left the world. Then, if it is still
 * too long, the least salient and oldest go first.
 */
export function pruneMemory(state: GameState): void {
  const log = state.memory
  if (!log) return
  let list = log.entries.filter(e =>
    state.season - e.season <= 8 &&
    !(e.sal <= 1 && e.playerId != null && !state.players[e.playerId] && state.season - e.season >= 1))
  if (list.length > MEMORY_CAP) {
    const keep = new Set([...list]
      .sort((a, b) => (b.sal - a.sal) || (b.id - a.id))
      .slice(0, MEMORY_CAP)
      .map(e => e.id))
    list = list.filter(e => keep.has(e.id))
  }
  log.entries = list
}
