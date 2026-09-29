// ---- THE SQUAD AS A SOCIAL ECOSYSTEM (1.8.1, the Living Squad pillar) ----
//
// Owner's brief: players are characters with relationships - friendships,
// mentorships, rivalries for a shirt, cliques, a dressing-room hierarchy of
// senior voices - and those relationships have consequences. Build
// connections, not screens.
//
// So this file adds one small ledger and wires it into what already exists:
//
//   PAIRS      a sparse, capped list of [a, b, strength]: +100 inseparable,
//              -100 not speaking. Seeded from what the save already knows
//              (mentor pairings, compatriots abroad, one academy intake,
//              long-standing partnerships in state.chem) and moved by events:
//              playing together, one man dropped for the other, a friend sold,
//              the armband changing hands, the Wire's own feuds.
//   VOICES     two to four senior men (leadership, years at the club, caps,
//              the armband). Their mood spreads through their corner of the
//              room: an unhappy one drags it, a happy one steadies it.
//   CLIQUES    derived groups (the academy graduates, the senior pros, the
//              young players, a nationality abroad). If one of them is shut
//              out of the team sheets it closes ranks, and says so.
//
// Every consequence is small and bounded and goes through machinery that is
// already there: morale (and through it the game-time ledger's transfer
// requests), the office (a "you sold my mate" knock settled by talkback.ts),
// the Wire (gossip.ts feuds are read, never opened), and a tiny,
// symmetric cohesion term in the engine.
//
// DETERMINISM. Nothing here draws from the shared weekly stream: every gate is
// a hash of (seed, ids, week). The ledger is seeded lazily on the first weekly
// pass, never in newGame, so a fresh world, the fingerprint and every AI club
// are untouched. User club only, like the game-time ledger.
import type { Club, GameState, Player, PressItem, PressOption } from './model'
import { absWeek } from './model'
import { mentorStage, pairWeeks } from './mentoring'
import { clamp, mulberry32 } from './rng'
import { tIn, type Vars } from './i18n'
import { OFFICE_OUTLET, askedRecently, isBoardroom, rememberAsk } from './media'
import { activeFeuds } from './gossip'
import { remember, type MemoryKind } from './memory'
import { fileHeldNews, type HeldStory } from './heldnews'

/** [a, b, strength, flags] with a < b. flags: 1 = rift announced, 2 = bond noted. */
export type Pair = [number, number, number, number]

export interface BondState {
  /** the club this ledger describes; a new job starts a new one */
  club: string
  pairs: Pair[]
  /** every id on the books last week, academy included (departures/arrivals) */
  sq: number[]
  /** the starting XV of the last match played */
  xv: (number | null)[]
  /** the captain last week */
  cap: number | null
  /** active cliques: group key and the absolute week it formed */
  cl: { g: string; at: number }[]
  /** feud pairs (chemKey form) seen last week, so a peace can heal the rift */
  fe: string[]
  /** absolute week of the last story this file filed (one a week at most) */
  said?: number
  /** stories held through the settle, filed by flushBondNews (heldnews.ts) */
  held?: HeldStory[]
}

/** The cap on stored pairs. 48 four-number tuples is well under a kilobyte. */
export const MAX_PAIRS = 48
const MAX_SEED = 36
export const CLOSE = 50
export const RIFT = -40

/** What the last weekly pass did, for the probes (never saved): the largest
 *  total morale move it made to any one man, the stories it filed, and how
 *  long it took. */
export const bondsReport = { week: -1, maxDelta: 0, stories: 0, ms: 0, ids: 0 }

/** A hook for the career memory log (memory.ts, not on this branch). */
export interface BondNote { kind: string; playerId: number; clubId?: string; payload?: Record<string, unknown> }
/** Each ledger event, as the career memory log (memory.ts) names it, and how
 *  much it matters there. A lost shirt is only remembered for a senior voice:
 *  the ordinary weekly rotation would crowd the capped log out. */
const MEMORY: Record<string, [MemoryKind, number]> = {
  'bonds.seeded': ['bonds-seeded', 1],
  'bonds.friendLeft': ['mate-left', 2],
  'bonds.armband': ['armband-passed', 2],
  'bonds.shirtLost': ['senior-dropped', 2],
  'bonds.bondFormed': ['bond', 1],
  'bonds.riftFormed': ['rift', 2],
  'bonds.cliqueForms': ['clique-formed', 2],
  'bonds.cliqueEnds': ['clique-ended', 1],
}
function note(state: GameState, ev: BondNote): void {
  const m = MEMORY[ev.kind]
  if (!m) return
  let payload: Record<string, string | number> | undefined
  for (const [k, v] of Object.entries(ev.payload ?? {})) {
    const val = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v
      : Array.isArray(v) ? v.join(',') : null
    if (val != null) (payload ??= {})[k] = val
  }
  remember(state, { kind: m[0], playerId: ev.playerId >= 0 ? ev.playerId : undefined, clubId: ev.clubId, payload, sal: m[1] })
}

// ------------------------------------------------------------------ basics

const h = (seed: number, a: number, b: number, salt: number) =>
  mulberry32((seed ^ Math.imul(a + 1, 2654435761) ^ Math.imul(b + 7, 40503) ^ Math.imul(salt, 97)) >>> 0)()

const last = (n: string) => n.split(' ').slice(-1)[0]
const r1 = (x: number) => Math.round(x * 10) / 10

function find(bs: BondState, a: number, b: number): Pair | undefined {
  const [x, y] = a < b ? [a, b] : [b, a]
  return bs.pairs.find(p => p[0] === x && p[1] === y)
}

/** Strength between two men, 0 when nothing is recorded. */
export function bondOf(state: GameState, a: number, b: number): number {
  const bs = state.bonds
  return bs ? find(bs, a, b)?.[2] ?? 0 : 0
}

function shift(bs: BondState, a: number, b: number, delta: number, create = true): number {
  if (a === b) return 0
  const pr = find(bs, a, b)
  if (pr) { pr[2] = r1(clamp(pr[2] + delta, -100, 100)); return pr[2] }
  if (!create || Math.abs(delta) < 3) return 0
  const [x, y] = a < b ? [a, b] : [b, a]
  const s = r1(clamp(delta, -100, 100))
  bs.pairs.push([x, y, s, 0])
  return s
}

function seniors(state: GameState, club: Club): Player[] {
  return club.players.map(id => state.players[id]).filter((p): p is Player => !!p && !p.acad)
}

/** Appearances at this club, as far as the save knows: the pre-2025 estimate
 *  for a man who was already here, every season since, and this one. */
function clubApps(p: Player, clubId: string): number {
  let n = (p.exClub == null && p.joinedAt == null ? p.hist?.apps ?? 0 : 0) + p.stats.apps
  for (const r of p.career) if (r.clubId === clubId) n += r.apps
  return n
}

// ------------------------------------------------------------------ groups

/** The groups a man belongs to. Derived every time, never stored. */
export function groupsOf(club: Club, p: Player): string[] {
  const g: string[] = []
  if (p.nat && p.nat !== club.country) g.push(`nat:${p.nat}`)
  if (p.homegrown) g.push('home')
  if (p.age >= 30) g.push('vets')
  else if (p.age <= 22) g.push('young')
  return g
}

function groupVars(g: string): Vars {
  return g.startsWith('nat:') ? { group_k: 'bonds.gNat', nation_k: `nation.${g.slice(4)}` }
    : { group_k: g === 'home' ? 'bonds.gHome' : g === 'vets' ? 'bonds.gVets' : 'bonds.gYoung' }
}

// ------------------------------------------------------------------ voices

/**
 * The two to four men the dressing room listens to. Leadership first, then
 * years at the club, Test caps and the armband. Pure: the same room gives the
 * same answer every time it is asked.
 */
export function seniorVoices(state: GameState, clubId = state.userClubId): Player[] {
  const club = state.clubs[clubId]
  if (!club) return []
  const score = (p: Player) => p.a.lea * 2 + Math.min(8, clubApps(p, clubId) / 20) * 1.5
    + Math.min(40, p.caps ?? 0) / 5 + (p.age >= 28 ? 3 : 0) + (p.pers === 'Leader' ? 4 : 0)
    + (club.captain === p.id ? 12 : club.vice === p.id ? 6 : 0)
  const ranked = seniors(state, club).filter(p => !p.onLoan && p.age >= 24)
    .map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s || a.p.id - b.p.id)
  const out = ranked.slice(0, 2).map(x => x.p)
  for (const x of ranked.slice(2, 4)) {
    if (x.p.a.lea >= 14 || club.captain === x.p.id || club.vice === x.p.id) out.push(x.p)
  }
  return out
}

// ------------------------------------------------------------------ seeding

/**
 * The ledger's first page, from what the save already knows. Sparse on
 * purpose: most pairs of men in a squad are team-mates and nothing more.
 */
export function seedBonds(state: GameState): BondState {
  const club = state.clubs[state.userClubId]
  const bs: BondState = { club: state.userClubId, pairs: [], sq: [], xv: [], cap: club?.captain ?? null, cl: [], fe: [] }
  if (!club) return bs
  const men = seniors(state, club)
  const cand = new Map<string, number>()
  const put = (a: number, b: number, s: number) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    const was = cand.get(k)
    cand.set(k, was == null ? s : Math.sign(s) === Math.sign(was) ? (Math.abs(s) > Math.abs(was) ? s : was) : was + s)
  }
  // mentor pairs: the obvious friendships
  for (const mp of state.mentors ?? []) put(mp.senior, mp.kid, 55)
  const rifts: [number, number, number][] = []
  for (let i = 0; i < men.length; i++) {
    for (let j = i + 1; j < men.length; j++) {
      const a = men[i], b = men[j]
      const r = h(state.seed, a.id, b.id, 11)
      // compatriots a long way from home
      if (a.nat === b.nat && a.nat !== club.country) put(a.id, b.id, 30 + r * 15)
      // one academy intake
      if (a.homegrown && b.homegrown && Math.abs(a.age - b.age) <= 1) put(a.id, b.id, 35 + r * 10)
      // a partnership the engine has been counting
      const g = state.chem?.[a.id < b.id ? `${a.id}_${b.id}` : `${b.id}_${a.id}`] ?? 0
      if (g >= 25) put(a.id, b.id, 20 + Math.min(25, g / 2))
      // long-serving team-mates, a few of them close
      if (clubApps(a, club.id) >= 80 && clubApps(b, club.id) >= 80 && r < 0.22) put(a.id, b.id, 18 + r * 40)
      // two men after one shirt, and one of them does not take it well
      const prickly = (p: Player) => p.pers === 'Temperamental' || p.pers === 'Ambitious' || p.pers === 'Mercenary'
      if (a.pos === b.pos && Math.abs(a.ca - b.ca) <= 6 && (prickly(a) || prickly(b))) rifts.push([a.id, b.id, r])
    }
  }
  rifts.sort((x, y) => x[2] - y[2])
  for (const [a, b, r] of rifts.slice(0, 2)) if (r < 0.5) put(a, b, -30 - r * 20)
  const pairs: Pair[] = [...cand.entries()]
    .map(([k, s]) => { const [a, b] = k.split('_').map(Number); return [a, b, r1(clamp(s, -100, 100)), 0] as Pair })
    .filter(p => Math.abs(p[2]) >= 10)
    .sort((x, y) => Math.abs(y[2]) - Math.abs(x[2]) || x[0] - y[0] || x[1] - y[1])
    .slice(0, MAX_SEED)
  // what is already true is not news
  for (const p of pairs) p[3] = (p[2] <= RIFT ? 1 : 0) | (p[2] >= CLOSE ? 2 : 0)
  bs.pairs = pairs
  bs.sq = [...club.players]
  bs.xv = club.tactic.lineup.slice(0, 15)
  bs.fe = activeFeuds(state).map(f => keyOf(f.a, f.b))
  return bs
}

const keyOf = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)

// ------------------------------------------------------------------ stories

function canSpeak(state: GameState, bs: BondState): boolean {
  return bs.said !== absWeek(state.season, state.week)
}

function file(state: GameState, bs: BondState, k: string, v: Vars, type: 'gossip' | 'general', playerId?: number, playerIds?: number[]) {
  bs.said = absWeek(state.season, state.week)
  bondsReport.stories++
  // HELD, NOT FILED: news, players and fixtures share state.nextId and a
  // fixture's dice are seeded from its id, so a story that took an id here,
  // mid-settle, would move AI results. It waits in the ledger and
  // flushBondNews() files it at the end of the settle on a fractional id
  // that never advances the counter (heldnews.ts).
  ;(bs.held ??= []).push({
    week: state.week, season: state.season, type, read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v: v as Record<string, string | number>,
    playerId, playerIds,
  })
}

/** File the stories held through the week settle. season.ts calls it after
 *  the advance, next to the memory and history-book flushes. */
export function flushBondNews(state: GameState): void {
  const q = state.bonds?.held
  if (!q?.length) return
  state.bonds!.held = []
  const id0 = state.nextId
  fileHeldNews(state, q)
  bondsReport.ids += state.nextId - id0
}

/** THE KNOCK: "you sold my mate", settled by talkback.ts like the other four. */
function mateKnock(state: GameState, p: Player, mate: Player): boolean {
  const open = state.press.filter(q => !q.answered && !isBoardroom(q))
  if (open.length >= 2 || open.some(q => q.outlet === OFFICE_OUTLET)) return false
  if (askedRecently(state, p.id, 'mate')) return false
  const v = { player: p.name, mate: mate.name }
  const opt = (tag: string): PressOption => {
    const Tag = tag[0].toUpperCase() + tag.slice(1)
    const lk = `talk.mate${Tag}`
    return {
      lk, lv: v, label: tIn('en', lk, v),
      rk: `${lk}Mixed`, rv: v, reaction: tIn('en', `${lk}Mixed`, v),
      morale: 0, board: 0, tb: tag,
    }
  }
  const qk = h(state.seed, p.id, mate.id, absWeek(state.season, state.week)) < 0.5 ? 'talk.mateQ1' : 'talk.mateQ2'
  // a fractional id for the same reason as the stories: the office item must
  // not advance the counter the fixtures draw from. It sits above every id
  // minted so far and below the next; press ids only need to be unique
  // among press items.
  const base = state.nextId - 1
  let id = base + 0.5
  while (state.press.some(q => q.id === id)) id += 0.001
  const item: PressItem = {
    id, week: state.week, season: state.season,
    outlet: OFFICE_OUTLET, question: tIn('en', qk, v), qk, qv: v,
    playerId: p.id, options: [opt('sorry'), opt('need'), opt('move')], answered: false, topic: 'mate',
  }
  state.press.push(item)
  rememberAsk(state, p.id, 'mate')
  if (state.press.length > 40) state.press = state.press.slice(-40)
  return true
}

// ------------------------------------------------------------------ the week

/** How hard a man takes a friend leaving, by character. */
const MISS: Record<Player['pers'], number> = {
  Loyal: 1.3, Temperamental: 1.2, Leader: 1, Ambitious: 0.8, Professional: 0.7, Mercenary: 0.4,
}

/**
 * The weekly pass, user club only. Called once a week from season.ts. Reads
 * the week that has just been played; draws nothing from the shared stream.
 */
/** A switch for the probes' twin-career comparison (bondsprobe 10). */
export const bondsSwitch = { on: true, cohesion: true }

export function bondsWeek(state: GameState): void {
  if (!bondsSwitch.on) return
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0
  bondsReport.week = absWeek(state.season, state.week)
  bondsReport.maxDelta = 0
  bondsReport.stories = 0
  moved.clear()
  const id0 = state.nextId
  weekly(state)
  bondsReport.ids = state.nextId - id0
  for (const d of moved.values()) bondsReport.maxDelta = Math.max(bondsReport.maxDelta, Math.abs(d))
  bondsReport.ms = typeof performance !== 'undefined' ? performance.now() - t0 : 0
}

const moved = new Map<number, number>()

function weekly(state: GameState): void {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  if (!state.bonds || state.bonds.club !== club.id) {
    state.bonds = seedBonds(state)
    note(state, { kind: 'bonds.seeded', playerId: -1, clubId: club.id, payload: { pairs: state.bonds.pairs.length } })
    return
  }
  const bs = state.bonds
  const now = absWeek(state.season, state.week)
  const here = new Set(club.players)
  const at = (id: number | null | undefined): Player | undefined => {
    if (id == null || !here.has(id)) return undefined
    const p = state.players[id]
    return p && !p.acad ? p : undefined
  }
  const nudge = (p: Player, d: number) => {
    const was = p.morale
    p.morale = clamp(p.morale + d, 1, 10)
    moved.set(p.id, (moved.get(p.id) ?? 0) + p.morale - was)
  }

  // ---- 1. who has gone, and who misses him
  const gone = bs.sq.filter(id => !here.has(id))
  for (const id of gone) {
    const p = state.players[id]
    const kind = !p ? 'retired' : p.retiring ? 'retired' : p.clubId && p.clubId !== club.id ? 'sold' : 'released'
    const friends = bs.pairs
      .filter(pr => (pr[0] === id || pr[1] === id) && pr[2] >= CLOSE)
      .map(pr => ({ f: at(pr[0] === id ? pr[1] : pr[0]), s: pr[2] }))
      .filter((x): x is { f: Player; s: number } => !!x.f)
      .sort((a, b) => b.s - a.s || a.f.id - b.f.id)
      .slice(0, 3)
    for (const { f, s } of friends) {
      const hit = Math.min(0.9, (0.25 + (s - CLOSE) * 0.012) * MISS[f.pers]) * (kind === 'retired' ? 0.2 : 1)
      nudge(f, -hit)
      note(state, { kind: 'bonds.friendLeft', playerId: f.id, clubId: club.id, payload: { mate: id, how: kind, s } })
    }
    const top = friends[0]
    if (p && top && kind !== 'retired' && canSpeak(state, bs)) {
      const gate = h(state.seed, top.f.id, id, now) < 0.7
      if (top.s >= 60 && gate && mateKnock(state, top.f, p)) {
        bs.said = now
        bondsReport.stories++
      } else {
        file(state, bs, 'news.bondMateGone',
          { player: top.f.name, mate: p.name, mateLast: last(p.name) }, 'general', top.f.id, [top.f.id, p.id])
      }
    }
    bs.pairs = bs.pairs.filter(pr => pr[0] !== id && pr[1] !== id)
  }

  // ---- 2. who has arrived: a compatriot or an intake-mate finds his people
  for (const id of club.players) {
    if (bs.sq.includes(id)) continue
    const p = at(id)
    if (!p) continue
    let made = 0
    for (const q of seniors(state, club)) {
      if (made >= 2 || q.id === p.id || bs.sq.indexOf(q.id) < 0) continue
      const compat = p.nat === q.nat && p.nat !== club.country
      const intake = p.homegrown && q.homegrown && Math.abs(p.age - q.age) <= 1
      if (compat || intake) { shift(bs, p.id, q.id, compat ? 22 : 30); made++ }
    }
  }

  // ---- 3. the Wire's feuds are rifts; a feud that ends heals the rift
  const feudNow = activeFeuds(state)
  const feudKeys = feudNow.map(f => keyOf(f.a, f.b))
  for (const f of feudNow) {
    const pr = find(bs, f.a, f.b)
    if (!pr) { shift(bs, f.a, f.b, -45); const n = find(bs, f.a, f.b); if (n) n[3] |= 1 }
    else if (pr[2] > -45) { pr[2] = -45; pr[3] |= 1 }
  }
  for (const k of bs.fe) {
    if (feudKeys.includes(k)) continue
    const [a, b] = k.split('_').map(Number)
    const pr = find(bs, a, b)
    if (pr && pr[2] < -15) pr[2] = -15
  }
  bs.fe = feudKeys

  // ---- 4. the armband changes hands
  if (club.captain !== bs.cap) {
    const old = at(bs.cap)
    const nu = at(club.captain)
    if (old && nu) {
      for (const pr of bs.pairs) {
        if ((pr[0] !== old.id && pr[1] !== old.id) || pr[2] < CLOSE) continue
        const f = at(pr[0] === old.id ? pr[1] : pr[0])
        if (f && f.id !== nu.id) nudge(f, -0.15)
      }
      if (old.pers === 'Leader' || old.pers === 'Temperamental') shift(bs, old.id, nu.id, -28)
      note(state, { kind: 'bonds.armband', playerId: nu.id, clubId: club.id, payload: { from: old.id } })
    }
  }

  // ---- 5. the match: shirts won and lost, and the men who played together
  const fx = state.fixtures.find(f => f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
  const voices = seniorVoices(state)
  const voiceIds = new Set(voices.map(v => v.id))
  if (fx) {
    const xv = club.tactic.lineup.slice(0, 15)
    const xvSet = new Set(xv.filter((x): x is number => x != null))
    const in23 = new Set(club.tactic.lineup.slice(0, 23).filter((x): x is number => x != null))
    const won = fx.homeId === club.id ? fx.homeScore > fx.awayScore : fx.awayScore > fx.homeScore
    if (bs.xv.length === 15) {
      for (let i = 0; i < 15; i++) {
        const A = at(bs.xv[i]), B = at(xv[i])
        if (!A || !B || A.id === B.id || xvSet.has(A.id)) continue
        if (A.injury || A.bans > 0 || A.natSquad || A.onLoan) continue
        // he was fit, and the shirt went to somebody else
        const sulks = A.pers === 'Temperamental' || A.pers === 'Mercenary' || A.pers === 'Ambitious'
        const drives = A.pers === 'Professional' || A.pers === 'Leader'
        const base = in23.has(A.id) ? 5 : 9
        shift(bs, A.id, B.id, -base * (sulks ? 1.3 : drives ? 0.5 : 0.8))
        // the sulk, or the extra session: which one depends on who he is
        nudge(A, sulks ? -0.3 : drives ? 0.1 : -0.1)
        // a senior voice left out: his corner of the room notices
        if (voiceIds.has(A.id)) {
          for (const pr of bs.pairs) {
            if ((pr[0] !== A.id && pr[1] !== A.id) || pr[2] < CLOSE) continue
            const f = at(pr[0] === A.id ? pr[1] : pr[0])
            if (f && f.id !== B.id) nudge(f, -0.1)
          }
        }
        if (voiceIds.has(A.id)) note(state, { kind: 'bonds.shirtLost', playerId: A.id, clubId: club.id, payload: { to: B.id, slot: i } })
      }
    }
    for (const pr of bs.pairs) {
      if (!xvSet.has(pr[0]) || !xvSet.has(pr[1])) continue
      // side by side: friends grow closer, and a win does more for a rift
      // than any meeting could
      pr[2] = r1(clamp(pr[2] + (pr[2] >= 0 ? 0.8 : won ? 2 : 0.5), -100, 100))
    }
    // a partnership that has just reached twenty matches is a friendship
    const ids = [...xvSet]
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        if ((state.chem?.[keyOf(ids[i], ids[j])] ?? 0) === 20 && !find(bs, ids[i], ids[j])) shift(bs, ids[i], ids[j], 30)
      }
    }
    bs.xv = xv
  }

  // ---- 6. a mentor pairing is a friendship in the making
  for (const mp of state.mentors ?? []) {
    if (!at(mp.senior) || !at(mp.kid)) continue
    // and it grows as the pairing does (mentoring.mentorStage, 1.8.2): a
    // flourishing pair becomes close friends, one that is not clicking
    // barely moves past acquaintance
    const s = state.players[mp.senior], k = state.players[mp.kid]
    const stage = s && k ? mentorStage(s, k, pairWeeks(state, mp)) : 'settled'
    const feed = stage === 'flourishing' ? 0.8 : stage === 'stalled' ? 0.1 : stage === 'early' ? 0.2 : 0.4
    if (!find(bs, mp.senior, mp.kid)) shift(bs, mp.senior, mp.kid, 25)
    else shift(bs, mp.senior, mp.kid, feed)
  }

  // ---- 7. what is not fed fades
  for (const pr of bs.pairs) pr[2] = r1(pr[2] > 0 ? Math.max(0, pr[2] - 0.1) : Math.min(0, pr[2] + 0.1))

  // ---- 8. the senior voices: their mood spreads through their corner
  const pull = new Map<number, number>()
  for (const v of voices) {
    const mine = groupsOf(club, v).filter(g => g !== 'young')
    for (const m of seniors(state, club)) {
      if (m.id === v.id || m.onLoan) continue
      const close = (find(bs, v.id, m.id)?.[2] ?? 0) >= 40
      if (!close && !groupsOf(club, m).some(g => mine.includes(g))) continue
      pull.set(m.id, (pull.get(m.id) ?? 0) + clamp((v.morale - m.morale) * 0.025, -0.05, 0.05))
    }
  }
  for (const [id, d] of pull) { const m = state.players[id]; if (m) nudge(m, clamp(d, -0.06, 0.06)) }

  // ---- 9. cliques: a group shut out of the team sheets closes ranks
  const named = new Set(club.tactic.lineup.slice(0, 23).filter((x): x is number => x != null))
  if (state.week % 6 === 0 && state.week >= 12 && state.week <= 42) cliqueCheck(state, bs, club)
  for (const c of bs.cl) {
    for (const m of seniors(state, club)) {
      if (named.has(m.id) || !groupsOf(club, m).includes(c.g)) continue
      if (m.morale > 5) nudge(m, -Math.min(0.05, (m.morale - 5) * 0.03))
    }
  }

  // ---- 10. a rift that has just formed is a story, and a feud
  for (const pr of bs.pairs) {
    if (pr[2] > -20) pr[3] &= ~1
    if (pr[2] < 30) pr[3] &= ~2
    if (pr[2] >= CLOSE && !(pr[3] & 2)) {
      pr[3] |= 2
      note(state, { kind: 'bonds.bondFormed', playerId: pr[0], clubId: club.id, payload: { with: pr[1], s: pr[2] } })
    }
    if (pr[2] <= RIFT && !(pr[3] & 1) && canSpeak(state, bs)) {
      const a = at(pr[0]), b = at(pr[1])
      if (!a || !b) continue
      pr[3] |= 1
      const cause = a.pos === b.pos ? 'bonds.causeShirt'
        : (club.captain === a.id || club.captain === b.id) ? 'bonds.causeArmband' : 'bonds.causeOld'
      file(state, bs, 'news.bondRift',
        { a: a.name, b: b.name, aLast: last(a.name), bLast: last(b.name), cause_k: cause }, 'gossip', a.id, [a.id, b.id])
      // NOT a gossip feud: gossip.ts settles its feuds on the shared weekly
      // stream, so opening one here would change the draws the AI market
      // makes after it. The rift lives in this ledger (and on the profile).
      note(state, { kind: 'bonds.riftFormed', playerId: a.id, clubId: club.id, payload: { with: b.id, s: pr[2] } })
    }
  }

  // ---- 11. keep it small
  bs.pairs = bs.pairs.filter(pr => Math.abs(pr[2]) >= 3 && here.has(pr[0]) && here.has(pr[1]))
  if (bs.pairs.length > MAX_PAIRS) {
    bs.pairs.sort((x, y) => Math.abs(y[2]) - Math.abs(x[2]) || x[0] - y[0] || x[1] - y[1])
    bs.pairs = bs.pairs.slice(0, MAX_PAIRS)
  }
  bs.sq = [...club.players]
  bs.cap = club.captain ?? null
}

/** Rate of appearances per match he was there for. */
function rate(p: Player, played: number): number {
  return p.stats.apps / Math.max(1, p.avail ?? played)
}

function cliqueCheck(state: GameState, bs: BondState, club: Club) {
  const men = seniors(state, club).filter(p => !p.onLoan)
  if (men.length < 12) return
  const played = state.fixtures.filter(f => f.played && (f.homeId === club.id || f.awayId === club.id)).length
  if (played < 6) return
  const byCa = [...men].sort((a, b) => b.ca - a.ca)
  const topHalf = new Set(byCa.slice(0, Math.ceil(men.length * 0.6)).map(p => p.id))
  const keys = new Set(men.flatMap(p => groupsOf(club, p)))
  const now = absWeek(state.season, state.week)
  for (const g of [...keys].sort()) {
    const inG = men.filter(p => groupsOf(club, p).includes(g))
    const rest = men.filter(p => !groupsOf(club, p).includes(g))
    const active = bs.cl.find(c => c.g === g)
    const mean = (xs: Player[]) => xs.reduce((s, p) => s + rate(p, played), 0) / Math.max(1, xs.length)
    const rg = mean(inG), rr = mean(rest)
    if (active) {
      if (inG.length < 3 || rg >= rr * 0.7) {
        bs.cl = bs.cl.filter(c => c !== active)
        if (canSpeak(state, bs)) file(state, bs, 'news.bondCliqueEnds', groupVars(g), 'gossip')
        note(state, { kind: 'bonds.cliqueEnds', playerId: -1, clubId: club.id, payload: { g } })
      }
      continue
    }
    // they have a case: at least two of them are good enough to play
    if (inG.length < 3 || rest.length < 3 || bs.cl.length >= 2) continue
    if (inG.filter(p => topHalf.has(p.id)).length < 2) continue
    if (rr < 0.2 || rg >= rr * 0.45) continue
    if (!canSpeak(state, bs)) continue
    bs.cl.push({ g, at: now })
    for (let i = 0; i < inG.length && i < 6; i++) {
      for (let j = i + 1; j < inG.length && j < 6; j++) shift(bs, inG[i].id, inG[j].id, 8, bs.pairs.length < MAX_PAIRS)
    }
    const names = inG.slice(0, 3).map(p => p.name)
    file(state, bs, 'news.bondClique', {
      ...groupVars(g), names_l: JSON.stringify(names.map(name => ({ k: 'bonds.name', name }))),
      n: inG.reduce((s, p) => s + p.stats.starts, 0),
    }, 'gossip', inG[0].id, inG.slice(0, 3).map(p => p.id))
    note(state, { kind: 'bonds.cliqueForms', playerId: inG[0].id, clubId: club.id, payload: { g, ids: inG.map(p => p.id) } })
  }
}

// ------------------------------------------------------------------ reads

/**
 * The tiny cohesion term (matchEngine). Close friends who both start lift a
 * side a touch; two men not speaking cost it the same. Symmetric and capped
 * at 0.6% either way, and 1 for any club without a ledger (every AI club,
 * and a new career until its first weekly pass).
 */
export function bondCohesion(state: GameState, clubId: string, lineup: (number | null)[]): number {
  const bs = state.bonds
  if (!bondsSwitch.cohesion || !bs || bs.club !== clubId || !bs.pairs.length) return 1
  const xv = new Set(lineup.slice(0, 15).filter((x): x is number => x != null))
  let n = 0
  for (const pr of bs.pairs) {
    if (!xv.has(pr[0]) || !xv.has(pr[1])) continue
    if (pr[2] >= CLOSE) n++
    else if (pr[2] <= RIFT) n--
  }
  return 1 + clamp(n, -4, 4) * 0.0015
}

/** For the player screen: who he is close to, who he clashes with, and
 *  whether the room listens to him. Your own men only. */
export function bondsLine(state: GameState, p: Player): { close: Player[]; clash: Player[]; voice: boolean } | null {
  const bs = state.bonds
  if (!bs || p.clubId !== bs.club || bs.club !== state.userClubId || state.unemployed) return null
  const other = (pr: Pair) => state.players[pr[0] === p.id ? pr[1] : pr[0]]
  const mine = bs.pairs.filter(pr => pr[0] === p.id || pr[1] === p.id)
  const close = mine.filter(pr => pr[2] >= CLOSE).sort((a, b) => b[2] - a[2]).map(other).filter(Boolean).slice(0, 2)
  const clash = mine.filter(pr => pr[2] <= RIFT).sort((a, b) => a[2] - b[2]).map(other).filter(Boolean).slice(0, 2)
  const voice = seniorVoices(state).some(v => v.id === p.id)
  if (!close.length && !clash.length && !voice) return null
  return { close, clash, voice }
}

// ------------------------------------------------------------------ saves

/** The save gate: anything unreadable is dropped, and the next weekly pass
 *  seeds a fresh ledger. A save from before this file simply has none. */
export function migrateBonds(raw: unknown): BondState | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Partial<BondState>
  if (typeof r.club !== 'string') return undefined
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  const pairs = (Array.isArray(r.pairs) ? r.pairs : [])
    .filter((p): p is Pair => Array.isArray(p) && p.length >= 3 && num(p[0]) && num(p[1]) && num(p[2]) && p[0] !== p[1])
    .map(p => {
      const [a, b] = p[0] < p[1] ? [p[0], p[1]] : [p[1], p[0]]
      return [a, b, clamp(p[2], -100, 100), num(p[3]) ? p[3] & 3 : 0] as Pair
    })
    .slice(0, MAX_PAIRS)
  return {
    club: r.club,
    pairs,
    sq: (Array.isArray(r.sq) ? r.sq : []).filter(num),
    xv: (Array.isArray(r.xv) ? r.xv : []).map(x => (num(x) ? x : null)).slice(0, 15),
    cap: num(r.cap) ? r.cap as number : null,
    cl: (Array.isArray(r.cl) ? r.cl : []).filter(c => c && typeof c.g === 'string' && num(c.at)).slice(0, 2),
    fe: (Array.isArray(r.fe) ? r.fe : []).filter((k): k is string => typeof k === 'string').slice(0, 8),
    said: num(r.said) ? r.said : undefined,
    held: Array.isArray(r.held) ? r.held.filter(n => !!n && typeof n === 'object' && typeof n.k === 'string').slice(0, 8) : undefined,
  }
}
