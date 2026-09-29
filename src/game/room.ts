// ---- THE DRESSING ROOM AND THE OFFICE'S HARD CALLS (1.8.2) ----
//
// Owner's "mastery" brief: every major decision has a risk and a reward, the
// dressing room makes selection consequential, and nothing is shown as a
// number. This file puts four such calls on the office desk, each built on
// machinery the game already has:
//
//   THE SPLIT   Leave a popular senior or the captain out of a side you picked
//               and the room divides over it (bonds.ts voices and friendships):
//               the senior men unhappy, the young ones keeping out of it, the
//               vice-captain either backing you or not. Stand by the call, or
//               reverse it and he starts the next match. Standing by it leans
//               the club's hidden culture (culture.ts) towards a manager-led
//               room: firmer authority, more resentment. Reversing leans it
//               towards a player-led one: a happier room, softer authority,
//               more knocks at the door.
//   RENEWAL     A first-team man in the last year of his deal: renew now,
//               above his asking (ai.offerRenewalAt at the quoted figure), or
//               wait and keep the money, with the risk that a rival signs him
//               on a pre-contract from the new year.
//   THE RETURN  A regular with one week left on an injury that can be played
//               through (knock.ts): rest him, or bring him back now, short of a
//               full tank and at risk of it going again.
//   ACADEMY     The summer decision (acadcall.ts) gains a third answer: keep
//               him and send him out on loan for the season, minutes elsewhere
//               and out of your hands. The loan starts in the first week of
//               the new season, so it is a season served.
//
// Every answer is written to the manager's memory (memory.ts), and two of them
// come back: a man you waited on who signs elsewhere is a story that says so,
// and the culture's turn is told through the call that tipped it.
//
// RULES IT KEEPS. User club only. No shared stream: every gate is a hash of
// the seed, the man and the week. Questions take fractional press ids and
// stories are filed as held news (heldnews.ts), so neither spends the id
// counter the fixtures draw from. The split is only ever raised over a team
// sheet the manager picked himself (tactic.userPicked), so a sleepwalker is
// never asked about the assistant's choices. Effects are small, bounded and
// go through morale, squad trust and the bonds ledger; nothing reaches the
// match engine except by the morale and cohesion paths it already reads.
import type { Club, GameState, Player, PressItem, PressOption } from './model'
import { absWeek, fmtMoney, logDecision } from './model'
import { clamp, mulberry32 } from './rng'
import { tIn, type Vars } from './i18n'
import { OFFICE_OUTLET, rememberAsk } from './media'
import { bondOf, nudgeBond, seniorVoices, CLOSE } from './bonds'
import { recall, remember } from './memory'
import { canPlayThrough, inFinalWeek, playThrough } from './knock'
import { offerRenewalAt, renewalDemand } from './ai'
import { loanOut } from './loans'
import { fileHeldNews, type HeldStory } from './heldnews'
import { cultureLean } from './culture'

export interface RoomState {
  /** the club this ledger describes; a new job starts a new culture */
  club: string
  /** the culture, -100 player-led .. +100 manager-led. Never shown. */
  c: number
  /** the culture story last told: -1 players' room, 0 none, 1 manager's room */
  band: number
  /** the season the summer drift was last applied in */
  s: number
  /** renewals the manager chose to wait on, and the season he chose to */
  w: { p: number; s: number }[]
  /** academy lads kept on the understanding they go out on loan, and the
   *  season they go in */
  ln: { p: number; s: number }[]
  /** what has been asked this season: 's:pid' split, 'r:pid' renewal,
   *  'i:pid:until' injury */
  asked: string[]
  /** absolute week of the last split, and of the last renewal question */
  sp?: number
  rq?: number
}

/** How far one answered split moves the culture. Four in a row takes a
 *  neutral club past the point the room starts talking about it. */
export const DRIFT = 12
/** Where the culture is talked about, as a share of the full lean. */
export const TOLD_AT = 0.4
/** The weekly chance a rival agrees a pre-contract with a man you waited on,
 *  from the week the pre-contract window opens (on top of the market's own). */
export const WAIT_RISK = 0.04
/** Renew now costs this much over his asking. */
export const PREMIUM = 1.15

/** The ledger, made for this club if it is not. */
export function roomOf(state: GameState): RoomState {
  const r = state.room
  if (r && r.club === state.userClubId) return r
  return (state.room = { club: state.userClubId, c: 0, band: 0, s: state.season, w: [], ln: [], asked: [] })
}

const hash = (state: GameState, a: number, b: number, salt: number) =>
  mulberry32((state.seed ^ Math.imul(a + 3, 2654435761) ^ Math.imul(b + 11, 40503) ^ Math.imul(salt, 7919)) >>> 0)()

const nowOf = (state: GameState) => absWeek(state.season, state.week)

/** A press id that does not spend state.nextId (see bonds.ts mateKnock). */
function officeId(state: GameState): number {
  let id = state.nextId - 1 + 0.6
  while (state.press.some(q => q.id === id)) id += 0.001
  return id
}

function isRoom(q: PressItem): boolean {
  return q.options.some(o => o.room != null)
}

/** The kind of room question an item is. */
export function roomKind(q: PressItem): 'split' | 'renew' | 'injury' | null {
  const o = q.options.find(x => x.room != null)?.room
  if (!o) return null
  return o === 'stand' || o === 'reverse' ? 'split' : o === 'renew' || o === 'wait' ? 'renew' : 'injury'
}

function option(room: NonNullable<PressOption['room']>, lk: string, lv: Vars, extra: Partial<PressOption> = {}): PressOption {
  return { room, lk, lv, label: tIn('en', lk, lv), reaction: '', morale: 0, board: 0, ...extra }
}

function ask(state: GameState, p: Player, qk: string, qv: Vars, options: PressOption[]): PressItem {
  const item: PressItem = {
    id: officeId(state), week: state.week, season: state.season, outlet: OFFICE_OUTLET,
    question: tIn('en', qk, qv), qk, qv, playerId: p.id, options, answered: false,
  }
  state.press.push(item)
  if (state.press.length > 40) state.press = state.press.slice(-40)
  return item
}

function hold(state: GameState, k: string, v: Vars, playerId?: number): void {
  const s: HeldStory = {
    week: state.week, season: state.season, type: 'general', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v: v as Record<string, string | number>, playerId,
  }
  fileHeldNews(state, [s])
}

const mood = (p: Player, d: number) => { p.morale = clamp(p.morale + d, 1, 10) }
const trust = (state: GameState, d: number) => { state.mgrTrust = clamp((state.mgrTrust ?? 30) + d, 0, 100) }

// ------------------------------------------------------------------ the split

/** Is he someone the room would take sides over? The captain, a senior voice,
 *  or a man of twenty-seven or more with two close friends in the squad. */
export function popular(state: GameState, club: Club, p: Player): boolean {
  if (club.captain === p.id) return true
  if (seniorVoices(state, club.id).some(v => v.id === p.id)) return true
  if (p.age < 27) return false
  const bs = state.bonds
  if (!bs) return false
  return bs.pairs.filter(pr => (pr[0] === p.id || pr[1] === p.id) && pr[2] >= CLOSE).length >= 2
}

/** The man in the middle of it: the vice-captain, or the captain when it is
 *  the vice who has been left out. */
export function deputyOf(state: GameState, club: Club, droppedId: number): { p: Player; role: 'vice' | 'cap' } | null {
  const pick = (id: number | null | undefined) => {
    const p = id != null ? state.players[id] : undefined
    return p && p.clubId === club.id && p.id !== droppedId && !p.onLoan ? p : undefined
  }
  if (club.vice === droppedId) {
    const c = pick(club.captain)
    return c ? { p: c, role: 'cap' } : null
  }
  const v = pick(club.vice)
  return v ? { p: v, role: 'vice' } : null
}

const LEAN: Record<Player['pers'], number> = {
  Professional: 0.6, Leader: 0.4, Loyal: 0.2, Ambitious: 0, Mercenary: -0.2, Temperamental: -0.4,
}

/** Does the deputy back the manager? Who he is, how far the room trusts the
 *  manager, the culture, and how close he is to the man left out. Pure. */
export function deputyBacks(state: GameState, dep: Player, dropped: Player, replacement?: Player): boolean {
  if (replacement && replacement.id === dep.id) return true
  const score = LEAN[dep.pers] + ((state.mgrTrust ?? 30) - 40) / 40 + cultureLean(state) - bondOf(state, dep.id, dropped.id) / 50
  return score > 0
}

/** The senior men who side with him: the senior voices, the men of
 *  twenty-eight and over, and his close friends. The young ones (22 and under)
 *  keep out of it, and so does a deputy who backs the manager. */
export function seniorCamp(state: GameState, club: Club, dropped: Player, exclude: number[]): Player[] {
  const voices = new Set(seniorVoices(state, club.id).map(v => v.id))
  return club.players.map(id => state.players[id])
    .filter((m): m is Player => !!m && !m.acad && !m.onLoan && m.id !== dropped.id && !exclude.includes(m.id) && m.age > 22)
    .filter(m => voices.has(m.id) || m.age >= 28 || bondOf(state, m.id, dropped.id) >= 40)
    .sort((a, b) => bondOf(state, b.id, dropped.id) - bondOf(state, a.id, dropped.id) || b.age - a.age || a.id - b.id)
    .slice(0, 8)
}

function splitQuestion(state: GameState, club: Club): boolean {
  const bs = state.bonds
  if (!bs || bs.club !== club.id || bs.xv.length !== 15 || club.tactic.userPicked !== true) return false
  if (state.week < 3 || state.week > 44) return false
  const r = roomOf(state)
  const now = nowOf(state)
  if (r.sp != null && now - r.sp < 4) return false
  const fx = state.fixtures.find(f => f.played && f.week === state.week && (f.homeId === club.id || f.awayId === club.id))
  if (!fx) return false
  const xv = club.tactic.lineup.slice(0, 15)
  const inXv = new Set(xv.filter((x): x is number => x != null))
  const out = bs.xv
    .map((id, slot) => ({ p: id != null ? state.players[id] : undefined, slot }))
    .filter((x): x is { p: Player; slot: number } => !!x.p && !inXv.has(x.p.id))
    .filter(({ p }) => p.clubId === club.id && !p.acad && !p.injury && !(p.bans > 0) && !p.natSquad && !p.onLoan && !p.retiring)
    .filter(({ p }) => !r.asked.includes(`s:${p.id}`) && popular(state, club, p))
    .sort((a, b) => Number(club.captain === b.p.id) - Number(club.captain === a.p.id) || b.p.a.lea - a.p.a.lea || a.p.id - b.p.id)
  const hit = out[0]
  if (!hit) return false
  const D = hit.p
  const repId = xv[hit.slot]
  const rep = repId != null && repId !== D.id ? state.players[repId] : undefined
  const dep = deputyOf(state, club, D.id)
  const backs = dep ? deputyBacks(state, dep.p, D, rep) : false
  const camp = seniorCamp(state, club, D, [rep?.id ?? -1, ...(dep && backs ? [dep.p.id] : [])])
  // the room divides the week it happens: the senior men take it badly
  for (const m of camp) mood(m, -0.15)
  r.sp = now
  r.asked.push(`s:${D.id}`)
  // and he does not also knock about it himself (talkback.ts 'dropped')
  rememberAsk(state, D.id, 'dropped')
  const cap = club.captain === D.id
  const dep_k = !dep ? 'room.depNone' : `room.dep${backs ? 'Backs' : 'Against'}${dep.role === 'cap' ? 'Cap' : 'Vice'}`
  const qv: Vars = {
    player: D.name, deputy: dep?.p.name ?? '', dep_k,
    rid: rep?.id ?? -1, did: dep?.p.id ?? -1, db: backs ? 1 : 0, camp: camp.map(m => m.id).join(','),
  }
  ask(state, D, cap ? 'room.splitCapQ' : 'room.splitQ', qv, [
    option('stand', 'room.stand', { player: D.name }),
    option('reverse', 'room.reverse', { player: D.name }),
  ])
  return true
}

function campOf(state: GameState, item: PressItem): Player[] {
  const ids = String(item.qv?.camp ?? '').split(',').filter(Boolean).map(Number)
  return ids.map(id => state.players[id]).filter((m): m is Player => !!m && m.clubId === state.userClubId)
}

function bandKey(base: string, lean: number): string {
  return lean > 0.3 ? `${base}Led` : lean < -0.3 ? `${base}Players` : base
}

function resolveSplit(state: GameState, item: PressItem, opt: PressOption, D: Player): { rk: string; rv: Vars } {
  const club = state.clubs[state.userClubId]
  const r = roomOf(state)
  const lean = cultureLean(state)
  const backs = item.qv?.db === 1
  const dep = typeof item.qv?.did === 'number' ? state.players[item.qv.did as number] : undefined
  const rep = typeof item.qv?.rid === 'number' ? state.players[item.qv.rid as number] : undefined
  const camp = campOf(state, item)
  const dep_k = !dep ? 'common.nothing'
    : opt.room === 'stand' ? (backs ? 'room.withDeputy' : 'room.withoutDeputy')
    : (backs ? 'room.leftDeputy' : 'room.deputyWon')
  const rv: Vars = { player: D.name, deputy: dep?.name ?? '', dep_k }
  if (opt.room === 'stand') {
    // a room not used to hearing no takes it harder
    const hit = (backs ? 0.1 : 0.2) * (1 + Math.max(0, -lean) * 0.5)
    for (const m of camp) mood(m, -hit)
    mood(D, D.pers === 'Professional' || D.pers === 'Leader' ? -0.1
      : D.pers === 'Temperamental' || D.pers === 'Ambitious' || D.pers === 'Mercenary' ? -0.4 : -0.25)
    // authority: firmer the more the room is used to the manager's word
    trust(state, (backs ? 3 : 2) * (1 + lean * 0.5))
    if (backs && dep) nudgeBond(state, dep.id, D.id, -8)
    r.c = clamp(r.c + (backs ? DRIFT : DRIFT + 3), -100, 100)
    remember(state, { kind: 'room-stood', playerId: D.id, clubId: club.id, payload: { name: D.name, db: backs ? 1 : 0 }, sal: 2 })
    logDecision(state, 'room.decStand', { player: D.name }, true)
    return { rk: bandKey('room.standR', lean), rv }
  }
  // reverse: he starts the next match
  mood(D, 0.6)
  for (const m of camp) mood(m, 0.2)
  if (rep) mood(rep, -0.4)
  if (backs && dep) { mood(dep, -0.3); trust(state, -1) }
  trust(state, -2 * (1 + Math.max(0, -lean) * 0.5))
  r.c = clamp(r.c - DRIFT, -100, 100)
  const lu = club.tactic.lineup
  const xv = lu.slice(0, 15)
  if (!xv.includes(D.id)) {
    let at = rep ? xv.indexOf(rep.id) : -1
    if (at < 0) {
      let worst = Infinity
      xv.forEach((id, i) => {
        const q = id != null ? state.players[id] : null
        if (q && q.pos === D.pos && q.ca < worst) { worst = q.ca; at = i }
      })
    }
    if (at < 0) at = xv.findIndex(id => id == null)
    if (at >= 0) {
      const outId = lu[at]
      const benchAt = lu.indexOf(D.id)
      lu[at] = D.id
      if (benchAt >= 0) lu[benchAt] = outId
    }
  }
  remember(state, { kind: 'room-reversed', playerId: D.id, clubId: club.id, payload: { name: D.name, db: backs ? 1 : 0 }, sal: 2 })
  logDecision(state, 'room.decReverse', { player: D.name }, false)
  return { rk: bandKey('room.reverseR', lean), rv }
}

// ------------------------------------------------------------------ renewal

/** The figure the renew-now button quotes: his asking, and a premium on top. */
export function renewNowWage(p: Player): number {
  return Math.round((renewalDemand(p) * PREMIUM) / 50) * 50
}

/** A first-team man in the last year of his deal, worth an office question. */
function renewCandidates(state: GameState, club: Club): Player[] {
  const committed = new Set((state.preContracts ?? []).map(pc => pc.playerId))
  const r = roomOf(state)
  const top = club.players.map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.acad)
    .sort((a, b) => b.ca - a.ca || a.id - b.id)
    .slice(0, 23)
  return top.filter(p => p.contractEnds <= state.season && p.renewedSeason !== state.season &&
    !committed.has(p.id) && !p.loanFrom && !p.onLoan && !p.retiring && p.age <= 31 &&
    !r.asked.includes(`r:${p.id}`))
}

function renewQuestion(state: GameState, club: Club): boolean {
  if (state.week < 12 || state.week > 30) return false
  const r = roomOf(state)
  const now = nowOf(state)
  if (r.rq != null && now - r.rq < 3) return false
  const p = renewCandidates(state, club)[0]
  if (!p) return false
  r.rq = now
  r.asked.push(`r:${p.id}`)
  const wage = renewNowWage(p)
  const hot = p.ca >= 76
  ask(state, p, hot ? 'room.renewQHot' : 'room.renewQ', { player: p.name, pos: p.pos, age: p.age }, [
    option('renew', 'room.renewNow', { wage: fmtMoney(wage) }, { roomWage: wage }),
    option('wait', 'room.renewWait', {}),
  ])
  return true
}

function resolveRenew(state: GameState, item: PressItem, opt: PressOption, p: Player): { rk: string; rv: Vars } {
  const r = roomOf(state)
  if (opt.room === 'renew') {
    const wage = opt.roomWage ?? renewNowWage(p)
    const res = offerRenewalAt(state, p.id, wage)
    if (!res.ok) return { rk: 'room.renewBlocked', rv: { player: p.name, why: res.msg } }
    remember(state, { kind: 'renew-early', playerId: p.id, clubId: state.userClubId, payload: { name: p.name, wage }, sal: 1 })
    logDecision(state, 'room.decRenew', { player: p.name, wage: fmtMoney(wage) }, true)
    return { rk: 'room.renewNowR', rv: { player: p.name, year: 2026 + p.contractEnds } }
  }
  mood(p, p.pers === 'Loyal' ? -0.3 : p.pers === 'Mercenary' ? 0 : -0.15)
  if (!r.w.some(x => x.p === p.id)) r.w.push({ p: p.id, s: state.season })
  remember(state, { kind: 'renew-waited', playerId: p.id, clubId: state.userClubId, payload: { name: p.name }, sal: 2 })
  logDecision(state, 'room.decWait', { player: p.name }, false)
  const hot = item.qk === 'room.renewQHot'
  return { rk: hot ? 'room.renewWaitRHot' : 'room.renewWaitR', rv: { player: p.name } }
}

/** The weeks a man you waited on is exposed, and what happens when he goes. */
function waitWeek(state: GameState, club: Club): void {
  const r = roomOf(state)
  if (!r.w.length) return
  const keep: RoomState['w'] = []
  for (const w of r.w) {
    const p = state.players[w.p]
    if (!p || w.s !== state.season || p.clubId !== club.id || p.renewedSeason === state.season || p.contractEnds > state.season) continue
    const pc = (state.preContracts ??= []).find(x => x.playerId === p.id)
    if (!pc && state.week >= 25 && state.week <= 38 && hash(state, p.id, w.s, nowOf(state)) < WAIT_RISK) {
      const suitors = Object.values(state.clubs)
        .filter(c => c.id !== club.id && c.rep >= club.rep - 10)
        .sort((a, b) => a.id.localeCompare(b.id))
      const to = suitors[Math.floor(hash(state, p.id, state.season, 71) * suitors.length)]
      if (to) {
        state.preContracts.push({ playerId: p.id, toClubId: to.id, week: state.week })
        mood(p, 0.5)
      }
    }
    const agreed = state.preContracts.find(x => x.playerId === p.id)
    if (agreed) {
      // the call comes back: the memory of waiting, told once
      const to = state.clubs[agreed.toClubId]
      const e = recall(state, { kind: 'renew-waited', playerId: p.id, sinceSeason: w.s }).slice(-1)[0]
      if (e && !e.paid?.includes('lost')) (e.paid ??= []).push('lost')
      hold(state, 'room.waitLost', { player: p.name, to: to?.name ?? '', short: to?.short ?? '' }, p.id)
      continue
    }
    keep.push(w)
  }
  r.w = keep
}

// ------------------------------------------------------------------ the return

function injuryQuestion(state: GameState, club: Club): boolean {
  const r = roomOf(state)
  const next = state.week + 1
  const plays = state.fixtures.some(f => !f.played && f.week === next && (f.homeId === club.id || f.awayId === club.id))
  if (!plays) return false
  const xv = new Set((state.bonds?.club === club.id ? state.bonds.xv : club.tactic.lineup.slice(0, 15)).filter((x): x is number => x != null))
  const p = club.players.map(id => state.players[id])
    .filter((q): q is Player => !!q && !q.acad && !!q.injury && q.injury.until === state.week + 2 && canPlayThrough(state, q))
    .filter(q => q.stats.starts >= 3 || q.status === 'key' || xv.has(q.id))
    .filter(q => !r.asked.includes(`i:${q.id}:${q.injury!.until}`))
    .sort((a, b) => b.ca - a.ca || a.id - b.id)[0]
  if (!p) return false
  r.asked.push(`i:${p.id}:${p.injury!.until}`)
  const v: Vars = { player: p.name, injury_k: p.injury!.dk ?? 'common.nothing' }
  ask(state, p, p.injury!.dk ? 'room.injQ' : 'room.injQPlain', v, [
    option('rest', 'room.injRest', {}),
    option('early', 'room.injEarly', { player: p.name }),
  ])
  return true
}

function resolveInjury(state: GameState, opt: PressOption, p: Player): { rk: string; rv: Vars } {
  if (opt.room === 'rest') {
    remember(state, { kind: 'rested', playerId: p.id, clubId: state.userClubId, payload: { name: p.name }, sal: 1 })
    logDecision(state, 'room.decRest', { player: p.name }, true)
    return { rk: 'room.injRestR', rv: { player: p.name } }
  }
  const res = playThrough(state, p.id)
  if (!res.ok) return { rk: 'room.injMoot', rv: { player: p.name } }
  logDecision(state, 'room.decEarly', { player: p.name }, false)
  return { rk: 'room.injEarlyR', rv: { player: p.name } }
}

// ------------------------------------------------------------------ academy

/** The summer decision's loan answer (acadcall.ts): he goes out in the first
 *  week of next season. */
export function planAcademyLoan(state: GameState, p: Player): void {
  const r = roomOf(state)
  r.ln = r.ln.filter(x => x.p !== p.id)
  r.ln.push({ p: p.id, s: state.season + 1 })
  remember(state, { kind: 'acad-loaned', playerId: p.id, clubId: state.userClubId, payload: { name: p.name }, sal: 1 })
}

function academyLoans(state: GameState, club: Club): void {
  const r = roomOf(state)
  if (!r.ln.length) return
  const due = r.ln.filter(x => x.s <= state.season)
  r.ln = r.ln.filter(x => x.s > state.season)
  for (const x of due) {
    const p = state.players[x.p]
    if (!p || p.clubId !== club.id || p.onLoan || x.s < state.season) continue
    // the decision was made in the summer: he is not in the team sheet now
    club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
    loanOut(state, p.id)
  }
}

// ------------------------------------------------------------------ the week

/** Unanswered room questions do not outlive their week. The office holds
 *  Continue until they are answered, so in a real career this never fires;
 *  a harness driving the engine directly would otherwise leave one on the
 *  desk for good, keeping every other knock from the door. */
export function roomTidy(state: GameState): void {
  const now = nowOf(state)
  state.press = state.press.filter(q => q.answered || !isRoom(q) || absWeek(q.season, q.week) >= now)
}

/**
 * The weekly pass, user club only, called by season.ts before bondsWeek (it
 * reads the ledger's last XV, which bondsWeek then moves on). Draws nothing
 * from the shared stream.
 */
export function roomWeek(state: GameState): void {
  if (state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  const r = roomOf(state)
  // the summer settles some of it: a new season, a slightly cooler culture
  if (r.s !== state.season) {
    r.c = Math.round(r.c * 0.7)
    r.s = state.season
    r.asked = []
  }
  academyLoans(state, club)
  waitWeek(state, club)

  const lean = cultureLean(state)
  // a player-led room is a happier one
  if (lean < -0.2) {
    for (const id of club.players) {
      const p = state.players[id]
      if (p && !p.acad && p.morale < 6) mood(p, 0.03 * -lean)
    }
  }
  // and the culture is felt before it is ever said
  const band = lean >= TOLD_AT ? 1 : lean <= -TOLD_AT ? -1 : Math.abs(lean) < 0.2 ? 0 : r.band
  if (band !== r.band) {
    r.band = band
    if (band !== 0) {
      const e = recall(state, { kind: band > 0 ? 'room-stood' : 'room-reversed', clubId: club.id }).slice(-1)[0]
      const name = String(e?.payload?.name ?? '')
      hold(state, band > 0 ? 'room.cultureLed' : 'room.culturePlayers', { player: name, club: club.name })
    }
  }

  // one question a week at most, and none while one is still on the desk
  if (state.press.some(q => !q.answered && isRoom(q))) return
  if (splitQuestion(state, club)) return
  if (injuryQuestion(state, club)) return
  renewQuestion(state, club)
}

/** Is the question still about somebody it can act on? */
export function roomLive(state: GameState, item: PressItem, opt: PressOption): boolean {
  const p = item.playerId != null ? state.players[item.playerId] : undefined
  if (!p || p.clubId !== state.userClubId) return false
  const kind = roomKind(item)
  if (kind === 'renew') {
    return p.renewedSeason !== state.season && !(state.preContracts ?? []).some(pc => pc.playerId === p.id)
  }
  if (kind === 'injury') return opt.room === 'rest' ? !!p.injury : inFinalWeek(state, p)
  return true
}

/** Carry out the answer. Called from media.answerPress. */
export function resolveRoom(state: GameState, item: PressItem, opt: PressOption): void {
  const p = item.playerId != null ? state.players[item.playerId] : undefined
  if (!p || !opt.room) return
  const kind = roomKind(item)
  const out = kind === 'split' ? resolveSplit(state, item, opt, p)
    : kind === 'renew' ? resolveRenew(state, item, opt, p)
    : resolveInjury(state, opt, p)
  item.rk = out.rk
  item.rv = out.rv
  item.reaction = tIn('en', out.rk, out.rv)
}

// ------------------------------------------------------------------ saves

/** The save gate: an unreadable ledger is dropped, and the next weekly pass
 *  starts a fresh one. A save from before this file simply has none. */
export function migrateRoom(raw: unknown): RoomState | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const r = raw as Partial<RoomState>
  if (typeof r.club !== 'string') return undefined
  const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
  const pairs = (xs: unknown) => (Array.isArray(xs) ? xs : [])
    .filter((x): x is { p: number; s: number } => !!x && typeof x === 'object' && num((x as { p: unknown }).p) && num((x as { s: unknown }).s))
    .map(x => ({ p: x.p, s: x.s }))
    .slice(0, 40)
  return {
    club: r.club,
    c: num(r.c) ? clamp(r.c, -100, 100) : 0,
    band: num(r.band) ? clamp(Math.round(r.band), -1, 1) : 0,
    s: num(r.s) ? r.s : 0,
    w: pairs(r.w),
    ln: pairs(r.ln),
    asked: (Array.isArray(r.asked) ? r.asked : []).filter((k): k is string => typeof k === 'string').slice(-120),
    sp: num(r.sp) ? r.sp : undefined,
    rq: num(r.rq) ? r.rq : undefined,
  }
}

