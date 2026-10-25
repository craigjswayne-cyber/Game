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

import type { GameState, Player } from './model'
import { absWeek, fmtMoney, seasonLabel, SEASON_WEEKS } from './model'
import { clamp } from './rng'
import { tIn, type Vars } from './i18n'
import { fileHeldNews } from './heldnews'
import { service } from './legends'
import { windowOpen } from './window'
import { MEMORY_CAP, STORIES_PER_SEASON, memoryLog, pruneMemory, recall, remember, type MemoryEntry, type MemoryKind, type MemoryLog } from './memorylog'

// The log's types and its read/write doors live in memorylog.ts (a leaf), so
// histbook can note into it without an import cycle through legends.
export { MEMORY_CAP, STORIES_PER_SEASON, remember, noteMemory, recall, pruneMemory } from './memorylog'
export type { MemoryKind, MemoryLog } from './memorylog'

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
  // a0/t0: his season so far, which a move mid-season carries to the next
  // club's row; what he has done since is read past them (formerFacing)
  const payload: Record<string, string | number> = { name: p.name, from, caps: p.caps ?? 0, ca: p.ca, a0: p.stats.apps, t0: p.stats.tries }
  // ap: his games for the club as the book has them on the day he goes, the
  // years before the career opened included. service() can credit that lump
  // only while he is still there, so a one-club man sold in the first window
  // read "sold before a first-team game" (1.8.5 career QA, Freddie Steward)
  const ap = service(p, from).apps
  if (ap > 0) payload.ap = ap
  if (to) { payload.to = to; payload.buyer = to }
  if (fee && fee > 0) payload.fee = fee
  if (p.homegrown || p.youth || p.acad) payload.acad = 1
  // written either way (1.8.5): an entry without the mark is read on its
  // salience (notable()), so a squad man of no note left without it was
  // taken for a man of note whenever he was rated sixty-two or more
  payload.nb = notableDeparture(state, p, from) ? 1 : 0
  remember(state, { kind, playerId: p.id, clubId: from, payload, sal: departureSal(p) })
}

/**
 * A man whose return the dressing room would notice: ten or more games in your
 * shirt, rated at or above the median of the seniors he leaves behind, or a
 * graduate of your own academy. Read at the moment he goes, because a week
 * later he is somebody else's and the squad he was measured against has moved.
 */
function notableDeparture(state: GameState, p: Player, from: string): boolean {
  if (p.homegrown) return true
  // a boy with a ceiling, sold or let go before he was anything (1.8.5)
  if (p.age <= 22 && p.pa >= 78) return true
  // his games for the club as the book has them, the years before the
  // career opened included (legends.ts service)
  const apps = service(p, from).apps
  if (apps >= 10) return true
  const cas = (state.clubs[from]?.players ?? [])
    .map(id => state.players[id]).filter(x => x && x.id !== p.id && !x.acad).map(x => x.ca).sort((a, b) => a - b)
  return cas.length > 0 && p.ca >= cas[Math.floor(cas.length / 2)]
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

/** File the held stories: season.ts calls it at the very end of the week
 *  settle, after the advance. The ids do not spend state.nextId (heldnews.ts),
 *  so no fixture drawn later, this week or any other, moves onto other dice. */
export function flushMemoryNews(state: GameState): void {
  const log = state.memory
  if (!log?.queue?.length) return
  fileHeldNews(state, log.queue)
  log.queue = []
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
  const window = windowOpen(state.week)
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

