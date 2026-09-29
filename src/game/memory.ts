// ---- THE CONSEQUENCE ENGINE: THE WORLD REMEMBERS WHAT YOU DID ----
//
// The owner's brief for this release: decisions should echo. Decision, effect,
// response, new state, future decision, story. The game already kept history
// (legacy.ts, records.ts, rivalries.ts, yearend.ts) but nothing ever read it
// back to make something happen, so a man you released in the summer could
// captain a rival by spring and nobody in the game would mention it.
//
// This is the manager's memory: a small, career-wide log of the decisions that
// have a subject - a player let go, a promise kept or broken, a knock played
// through, an academy debut given - and a handful of payoffs that read it back
// and file a story when the world closes the loop. "I caused that."
//
// RULES IT KEEPS
//
//   No rng. Nothing here draws on any stream, so a match or a transfer cannot
//   move because the log exists. The only state the payoffs touch is the news
//   list, and the two small consequences named below (a broken promise's
//   morale and trust, and the agents' premium in interest.ts).
//
//   Rare on purpose. One memory story a week at most, a handful a season, and
//   every payoff fires once per subject. A world that remembers everything out
//   loud is a nag, not a world with a memory.
//
//   Small on purpose. The log is capped (MEMORY_CAP) and pruned oldest and
//   least salient first, so a twenty-season save carries a few kilobytes of it.
//
// OTHER MODULES PLUG IN through remember() and recall(): a kind is a string
// literal in MemoryKind, and adding one is a one-word change.

import type { Fixture, GameState, Player } from './model'
import { absWeek, fmtMoney, seasonLabel, SEASON_WEEKS } from './model'
import { clamp } from './rng'
import { tIn, type Vars } from './i18n'

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
  // the club's identity (identity.ts): a label earned or lost
  | 'identity-formed' | 'identity-faded'

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
  /** the id base of the last flush and how many fractions it has used */
  fb?: number
  fs?: number
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

/** An old save has no memory, and a damaged one gets an empty one. */
export function migrateMemory(s: GameState): void {
  const m = s.memory as unknown
  if (!m || typeof m !== 'object' || Array.isArray(m)) { s.memory = { entries: [], next: 1 }; return }
  const log = m as MemoryLog
  log.entries = Array.isArray(log.entries)
    ? log.entries.filter(e => !!e && typeof e === 'object' && typeof e.kind === 'string' &&
        Number.isFinite(e.season) && Number.isFinite(e.week) && Number.isFinite(e.id))
    : []
  for (const e of log.entries) {
    e.sal = Number.isFinite(e.sal) ? clamp(e.sal, 1, 3) : 1
    if (e.paid != null && !Array.isArray(e.paid)) e.paid = []
  }
  // a held story is filed at the next settle's end; a damaged queue is dropped
  if (log.queue != null && !Array.isArray(log.queue)) log.queue = []
  if (log.queue) log.queue = log.queue.filter(n => !!n && typeof n === 'object' && typeof n.k === 'string')
  const top = log.entries.reduce((n, e) => Math.max(n, e.id), 0)
  log.next = Number.isFinite(log.next) && log.next > top ? log.next : top + 1
  if (log.entries.length > MEMORY_CAP) pruneMemory(s)
}

// ------------------------------------------------------------------
// Recording helpers, one line at each call site
// ------------------------------------------------------------------

/** How much a departure matters: a first-teamer more than a squad man, and a
 *  boy with a ceiling more than one without. */
function departureSal(p: Player): number {
  if (p.ca >= 72 || (p.caps ?? 0) >= 5) return 3
  if (p.ca >= 62 || p.pa >= 78) return 2
  return 1
}

/** A man leaves your club: released, sold or let go. `from` is the club he left. */
export function rememberDeparture(
  state: GameState, p: Player, kind: 'released' | 'sold' | 'let-go', from: string, to?: string | null, fee?: number,
): void {
  if (state.unemployed || from !== state.userClubId) return
  // one departure per man per season: a pre-contract and an expiry are the same exit
  if (recall(state, { kind: ['released', 'sold', 'let-go'], playerId: p.id, sinceSeason: state.season }).length) return
  const payload: Record<string, string | number> = { name: p.name, from, caps: p.caps ?? 0, ca: p.ca }
  if (to) { payload.to = to; payload.buyer = to }
  if (fee && fee > 0) payload.fee = fee
  if (p.homegrown || p.youth || p.acad) payload.acad = 1
  remember(state, { kind, playerId: p.id, clubId: from, payload, sal: departureSal(p) })
}

/** An academy lad's first senior rugby, in your side. */
export function rememberDebut(state: GameState, p: Player): void {
  if (recall(state, { kind: 'academy-debut', playerId: p.id }).length) return
  remember(state, {
    kind: 'academy-debut', playerId: p.id, clubId: p.clubId ?? undefined,
    payload: { name: p.name, caps: p.caps ?? 0 }, sal: p.pa >= 75 ? 3 : 2,
  })
}

/** A promise settled, either way. */
export function rememberPromise(state: GameState, p: Player, kept: boolean, what: string): void {
  remember(state, {
    kind: kept ? 'promise-kept' : 'promise-broken', playerId: p.id, clubId: state.userClubId,
    payload: { name: p.name, what }, sal: kept ? 1 : 2,
  })
}

// ------------------------------------------------------------------
// Payoffs
// ------------------------------------------------------------------

const DEPARTED: MemoryKind[] = ['released', 'sold', 'let-go']
const abs = (e: { season: number; week: number }) => absWeek(e.season, e.week)
const paid = (e: MemoryEntry, tag: string) => !!e.paid?.includes(tag)
const markPaid = (e: MemoryEntry, tag: string) => { (e.paid ??= []).push(tag) }

/** May another memory story be told now? */
function canTell(state: GameState, allowance = 0): boolean {
  const log = memoryLog(state)
  if (log.toldS !== state.season) { log.toldS = state.season; log.told = 0 }
  if ((log.told ?? 0) >= STORIES_PER_SEASON + allowance) return false
  return log.last !== absWeek(state.season, state.week) || allowance > 0
}

/**
 * HELD, NOT FILED. News, players and fixtures share state.nextId, and the match
 * engine seeds a fixture's dice from its id. A story filed mid-settle (after the
 * manager's match, or in the weekly read-back) would push every tie drawn later
 * in the same settle onto another id and so onto other dice: memory would move
 * AI results without reading anything they use. So stories wait in the log's
 * queue, stamped with the week they belong to, and take their ids in
 * flushMemoryNews() once the settle is over (the same rule histbook.ts keeps).
 */
function tell(state: GameState, k: string, v: Vars, playerId?: number): void {
  const log = memoryLog(state)
  log.last = absWeek(state.season, state.week)
  log.told = (log.told ?? 0) + 1
  ;(log.queue ??= []).push({
    week: state.week, season: state.season, type: 'gossip', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, playerId,
  })
}

/** The news log's ceiling (season.ts NEWS_KEEP; season.ts imports this file). */
const NEWS_CAP = 250

/**
 * File the held stories. season.ts calls it at the very end of the week settle,
 * after the advance, when no more fixtures are drawn this tick.
 *
 * AND WITHOUT SPENDING state.nextId. Holding a story to the end of the settle
 * is not enough on its own: an id taken now is an id the next cup draw does not
 * get, so every tie drawn weeks later sits one number higher and rolls other
 * dice (memoryprobe caught it: the knockout ties of week 33 moved from 1001800
 * to 1001807 with ten stories told). So a memory story takes a fraction above
 * the last id minted: base + 0.001, base + 0.002. It still sorts after
 * everything filed before it and before everything filed after (days.ts reads
 * `id >= newsFrom`), it is unique while fewer than a thousand stories are told
 * on the same base, and the counter the fixtures draw from never moves.
 * save.ts floors the highest id when it repairs nextId, so a fraction can never
 * leak into it.
 */
export function flushMemoryNews(state: GameState): void {
  const log = state.memory
  const q = log?.queue
  if (!log || !q?.length) return
  const base = state.nextId - 1
  if (log.fb !== base) { log.fb = base; log.fs = 0 }
  for (const n of q) {
    log.fs = (log.fs ?? 0) + 1
    // a thousand stories on one base is not a week that happens; if it ever
    // did, the story takes a whole id like anything else rather than collide
    const id = log.fs < 1000 ? base + log.fs / 1000 : state.nextId++
    state.news.push({ ...n, id, k: n.k, v: n.v })
  }
  log.queue = []
  if (state.news.length > NEWS_CAP) state.news = state.news.slice(-NEWS_CAP)
}

/** "You sold him to X in 2027 for £2M." The sentence the payoffs lead with. */
function howVars(state: GameState, e: MemoryEntry): Vars {
  const pl = e.payload ?? {}
  const how_k = e.kind === 'sold' ? 'mem.howSold' : e.kind === 'released' ? 'mem.howReleased' : 'mem.howLetGo'
  return {
    how_k, player: String(pl.name ?? state.players[e.playerId ?? -1]?.name ?? ''),
    season: seasonLabel(e.season),
    buyer: state.clubs[String(pl.buyer ?? pl.to ?? '')]?.name ?? '',
    fee: fmtMoney(Number(pl.fee ?? 0)),
    old: state.clubs[String(pl.from ?? '')]?.name ?? '',
  }
}

/** The departures still worth following: the man is alive and not back with you. */
function departures(state: GameState): { e: MemoryEntry; p: Player }[] {
  const out: { e: MemoryEntry; p: Player }[] = []
  for (const e of state.memory?.entries ?? []) {
    if (!DEPARTED.includes(e.kind) || e.playerId == null) continue
    const p = state.players[e.playerId]
    if (!p || p.clubId === state.userClubId) continue
    out.push({ e, p })
  }
  return out
}

/**
 * After one of your matches: did somebody you let go come back and hurt you?
 * A try, or the match award. One story per match, the award outranking the try.
 */
export function memoryAfterMatch(state: GameState, fx: Fixture): void {
  if (!state.memory?.entries.length || state.unemployed) return
  const me = state.userClubId
  if (fx.homeId !== me && fx.awayId !== me) return
  const oppId = fx.homeId === me ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  if (!opp || !canTell(state)) return
  const tries = new Set((fx.events ?? []).filter(ev => ev.type === 'TRY' && ev.teamId === oppId && ev.playerId != null).map(ev => ev.playerId!))
  for (const { e, p } of departures(state)) {
    if (p.clubId !== oppId || state.season - e.season > 6) continue
    const motm = fx.motm === p.id
    // A match the manager watched keeps its events; one simmed around him does
    // not, so there the try is read off his season tally against the count
    // memoryWeek wrote down last week (he played this week, and it went up).
    const pl = e.payload ?? {}
    const scored = fx.events?.length ? tries.has(p.id)
      : p.lastWk === state.week && pl.ss === state.season && Number.isFinite(pl.st) && p.stats.tries > Number(pl.st)
    if (!motm && !scored) continue
    const tag = motm ? 'motm' : 'try'
    if (paid(e, 'motm') || paid(e, tag)) continue
    markPaid(e, tag)
    tell(state, motm ? 'mem.motmVs' : 'mem.tryVs', { ...howVars(state, e), club: opp.name }, p.id)
    return
  }
}

/**
 * The weekly read-back, after the Wire. Each payoff once per subject, one story
 * a week, and the season-end reviews allowed a little extra room.
 */
export function memoryWeek(state: GameState): void {
  const log = state.memory
  if (!log?.entries.length || state.unemployed) return
  const user = state.clubs[state.userClubId]
  if (!user) return
  const now = absWeek(state.season, state.week)
  const inMyLeague = (clubId: string | null) => !!clubId && clubId !== user.id && state.clubs[clubId]?.leagueId === user.leagueId

  // ---- the departed ----
  for (const { e, p } of departures(state)) {
    const club = p.clubId ? state.clubs[p.clubId] : null
    // FOLLOW HIM. A released man is a free agent until somebody signs him
    // (rollover's replenishSquads, or any later move); his id is the thread,
    // and where it leads is written down the week it gets there.
    if (club && e.payload && e.payload.to !== club.id) {
      const first = e.payload.to == null
      e.payload.to = club.id
      e.payload.tw = now
      // he resurfaces in your league: the name you will see on a team sheet
      if (first && e.sal >= 2 && !paid(e, 'signed') && inMyLeague(club.id) && canTell(state)) {
        markPaid(e, 'signed')
        tell(state, 'mem.signedRival', { ...howVars(state, e), club: club.name }, p.id)
        continue
      }
    }
    if (!canTell(state)) break
    // named captain of a side in your league
    if (club && !paid(e, 'captain') && club.captain === p.id && inMyLeague(club.id)) {
      markPaid(e, 'captain')
      tell(state, 'mem.captainVs', { ...howVars(state, e), club: club.name }, p.id)
      continue
    }
    // an international since you let him go
    if (club && !paid(e, 'cap') && Number(e.payload?.caps ?? 0) === 0 && (p.caps ?? 0) > 0) {
      markPaid(e, 'cap')
      tell(state, 'mem.soldCap', { ...howVars(state, e), club: club.name, nat_k: `nation.${p.nat}` }, p.id)
      continue
    }
    // the world's best, after you sold him
    if (!paid(e, 'poty') && (state.potyRoll ?? []).some(r => r.playerId === p.id && r.season >= e.season)) {
      markPaid(e, 'poty')
      tell(state, 'mem.soldPoty', { ...howVars(state, e), club: club?.name ?? '' }, p.id)
      continue
    }
    // in the Team of the Year, filed on week one of the season after
    if (!paid(e, 'toty') && club && state.week === 1 && totyNames(state).has(`${p.name}|${club.short}`) && e.season < state.season) {
      markPaid(e, 'toty')
      tell(state, 'mem.soldToty', { ...howVars(state, e), club: club.name }, p.id)
      continue
    }
  }

  // ---- the academy debuts you gave ----
  for (const e of log.entries) {
    if (e.kind !== 'academy-debut' || e.playerId == null) continue
    const p = state.players[e.playerId]
    if (!p) continue
    const debutClub = state.clubs[e.clubId ?? '']?.name ?? ''
    const base = { player: p.name, season: seasonLabel(e.season), club: debutClub }
    if (!paid(e, 'intl') && (p.caps ?? 0) > Number(e.payload?.caps ?? 0) && canTell(state)) {
      markPaid(e, 'intl')
      tell(state, 'mem.acadIntl', { ...base, nat_k: `nation.${p.nat}` }, p.id)
      continue
    }
    // a regular: judged on the season's starts, the week before the summer wipe
    if (!paid(e, 'regular') && state.week === SEASON_WEEKS && e.season < state.season &&
        p.stats.starts >= 12 && canTell(state, 1)) {
      markPaid(e, 'regular')
      tell(state, 'mem.acadRegular', { ...base, n: p.stats.starts, now: state.clubs[p.clubId ?? '']?.name ?? debutClub }, p.id)
    }
  }

  // ---- the knock you sent him out on ----
  for (const e of log.entries) {
    if (e.kind !== 'rushed-back' || e.playerId == null || paid(e, 'again')) continue
    const p = state.players[e.playerId]
    const since = now - abs(e)
    if (!p || since > 40) { if (since > 40) markPaid(e, 'again'); continue }
    if (!p.injury || since < 3) continue
    const last = p.injLog?.[p.injLog.length - 1]
    if (!last || absWeek(last.s, last.w) - abs(e) < 3 || absWeek(last.s, last.w) !== now) continue
    if (!canTell(state)) break
    markPaid(e, 'again')
    tell(state, 'mem.knockAgain', {
      player: p.name, season: seasonLabel(e.season), w: e.week,
      n: Math.max(1, (p.injury.until ?? state.week) - state.week),
    }, p.id)
  }

  // ---- a broken promise is not forgotten ----
  for (const e of log.entries) {
    if (e.kind !== 'promise-broken' || e.playerId == null || paid(e, 'grudge')) continue
    const p = state.players[e.playerId]
    const since = now - abs(e)
    if (!p || p.clubId !== user.id || since > 20) { if (since > 20 || !p) markPaid(e, 'grudge'); continue }
    // it comes back when he is left out again, six weeks or more after
    if (since < 6 || (p.lastWk ?? 0) >= state.week - 1 || !canTell(state)) continue
    markPaid(e, 'grudge')
    p.morale = clamp(p.morale - 0.5, 1, 10)
    state.mgrTrust = clamp((state.mgrTrust ?? 30) - 1, 0, 100)
    tell(state, 'mem.grudge', { player: p.name, season: seasonLabel(e.season) }, p.id)
  }

  // ---- and the agents talk about it, once a window ----
  const window = state.week <= 7 || (state.week >= 24 && state.week <= 27)
  if (window && canTell(state)) {
    const broken = brokenPromises(state)
    const e = broken.find(x => !paid(x, `agents${state.season}`))
    if (e && !broken.some(x => paid(x, `agents${state.season}`))) {
      markPaid(e, `agents${state.season}`)
      tell(state, 'mem.agents', { player: String(e.payload?.name ?? ''), club: state.clubs[e.clubId ?? '']?.name ?? user.name })
    }
  }

  // the tally the next match is read against (memoryAfterMatch)
  for (const { e, p } of departures(state)) if (e.payload) { e.payload.st = p.stats.tries; e.payload.ss = state.season }

  if (log.entries.length > MEMORY_CAP) pruneMemory(state)
}

/** Promises broken in the last year, most recent first. */
function brokenPromises(state: GameState): MemoryEntry[] {
  const now = absWeek(state.season, state.week)
  return recall(state, { kind: 'promise-broken' }).filter(e => now - abs(e) <= SEASON_WEEKS).reverse()
}

/**
 * What agents add to a fee for a manager whose word has been broken lately.
 * Four per cent a broken promise in the last year, never more than twelve.
 * interest.ts multiplies it into the premium a club below the player pays.
 */
export function agentWariness(state: GameState): number {
  if (!state.memory?.entries.length) return 1
  return 1 + Math.min(0.12, brokenPromises(state).length * 0.04)
}

/** "name|club short" for every man in the Team of the Year just filed. */
function totyNames(state: GameState): Set<string> {
  const out = new Set<string>()
  for (const n of state.news) {
    if (n.k !== 'news.toty' || n.season !== state.season) continue
    try {
      const rows = JSON.parse(String(n.v?.rows_ll ?? '[]')) as { name?: string; club?: string }[]
      for (const r of rows) if (r?.name) out.add(`${r.name}|${r.club ?? ''}`)
    } catch { /* a damaged story is no story */ }
  }
  return out
}
