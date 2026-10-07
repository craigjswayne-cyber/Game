/**
 * ---- THE OTHER CLUBS WANT THEM TOO (1.8.5, the market round) ----
 *
 * Player feedback about another manager game: "opposition teams got weaker,
 * they didn't evolve while my team got all the wonderkids". The AI market here
 * already buys and sells among itself, but it never stood in the manager's
 * way: every man he agreed a fee for was his for the asking, the best young
 * players in the world were a list only he shopped from, and winning the
 * league changed nothing in anybody else's boardroom. Three answers, all
 * built on what the market already has:
 *
 *   RIVAL BIDS. When the manager agrees a fee, an AI club that genuinely needs
 *   the position (he would start for them), can pay it and sits in his
 *   reputation range may agree the same fee. The player then chooses on what
 *   a player weighs: the size of the club, the wage, the minutes (how many
 *   better men are already in his position), a promise of first-team rugby,
 *   and his agent's dealings with the manager. The manager is told who came in
 *   and what they offer, and can improve his terms until the week is out; if
 *   he does not, the player goes. The news says who won and why.
 *
 *   THE YOUTH HUNT. Ambitious and rebuilding AI clubs go after the best young
 *   high-ceiling players in the world, within their budget and reputation, at
 *   most one a summer and never into a position they are already stocked in.
 *
 *   THE FREE-AGENT POOL. Measured first (scripts/leaguestrength.ts): AI
 *   boards that cannot afford a renewal let their best men walk, nothing in
 *   the AI market ever signed a free agent, and by season ten a hundred men
 *   rated 85 and over sat in the pool for the manager alone. That, not the
 *   wonderkids, was how the world drained. AI clubs now sign them too.
 *
 *   THE RESPONSE. A club that finished close behind the manager, a big club he
 *   finished well clear of, and the coach the career arc has made his rival,
 *   are backed by their boards the next summer: more to spend, and a position
 *   to spend it on (the one where his side outclassed theirs).
 *
 * DETERMINISM. Every decision here is a hash of the seed, the ids and the
 * season; nothing is drawn from the shared weekly rng, so the match stream and
 * the fingerprint are untouched. New state is optional and cleaned in migrate.
 */
import type { Club, GameState, Player, Pos } from './model'
import { XV_SLOTS, absWeek, careerRows, fmtMoney, fmtWage, isMyClub, leagueTier } from './model'
import { INK_WEEKS, askingPrice, freeDeal, capBill, embargoed, executeTransfer, seniorsOf, SQUAD_LIMIT, windowOpen } from './ai'
import { aiCanCarry, aiPayRate, aiWageRooms } from './aiecon'
import { playerWage } from './attributes'
import { clubIntent } from './living'
import { agentTone } from './recruit'
import { rivalsOf } from './rivalries'
import { rivalCoach } from './rivalcoach'
import { clamp, hashString, mulberry32 } from './rng'
import { tIn, type Vars } from './i18n'
import { JANUARY_OPEN, SUMMER_SHUT, nextWeek } from './window'

const rand = (s: string): number => mulberry32(hashString(s))()

/**
 * Can this AI club take on another wage? Most top-flight boards run at a
 * reduced pay rate by design (aiecon.ts aiPayRate: the 1.8.3 economy), so
 * the rate alone would rule out nearly every club the manager competes with.
 * A club in the black with a real reserve (ten weeks of its wage bill) can
 * still move; one that is short and paying under the scale cannot.
 */
export function canSpend(state: GameState, c: Club): boolean {
  if (c.admin || c.balance <= 0) return false
  const bill = c.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  return c.balance > 10 * bill || aiPayRate(state, c) >= 0.85
}

/** What the manager put on the table, as the player weighs it. */
export interface MyTerms { wage: number; signOn: number; promise: boolean }

/** An AI club that has agreed the same fee as the manager this week. */
export interface RivalBid {
  playerId: number
  clubId: string
  sellerId: string
  fee: number
  wage: number
  week: number
  season: number
  /** the manager's last terms, once he has put any */
  mine?: MyTerms
}

/** Clubs whose boards backed them after finishing behind the manager. */
export interface RivalPush {
  season: number
  clubs: { id: string; pos: Pos; n: number; bid?: boolean }[]
}

// ---------------------------------------------------------------- depth ---

/** Starting shirts per position in the XV. */
const SHIRTS: Record<string, number> = {}
for (const s of XV_SLOTS) SHIRTS[s.pos] = (SHIRTS[s.pos] ?? 0) + 1

/** The noun a position is talked about by, as a fragment key. */
const POS_NOUN: Record<string, string> = {
  LP: 'posNoun.prop', TP: 'posNoun.prop', HK: 'posNoun.hooker', LK: 'posNoun.lock', FL: 'posNoun.flanker',
  N8: 'posNoun.number8', SH: 'posNoun.scrumHalf', FH: 'posNoun.flyHalf', CE: 'posNoun.centre',
  WG: 'posNoun.winger', FB: 'posNoun.fullBack',
}
export const posNounKey = (pos: string): string => POS_NOUN[pos] ?? 'posNoun.player'

/** How many men at this club are at least as good as him in his position. */
export function betterAt(state: GameState, club: Club, p: Player): number {
  let n = 0
  for (const id of club.players) {
    if (id === p.id) continue
    const q = state.players[id]
    if (q && !q.acad && !q.retiring && q.pos === p.pos && q.ca >= p.ca) n++
  }
  return n
}

/** Minutes he would expect there: 2 a starter, 1 rotation, 0 the bench. */
export function minutesAt(state: GameState, club: Club, p: Player): number {
  const shirts = SHIRTS[p.pos] ?? 1
  const ahead = betterAt(state, club, p)
  return ahead < shirts ? 2 : ahead < shirts * 2 ? 1 : 0
}

// ---------------------------------------------------------------- choice ---

type Why = 'minutes' | 'rep' | 'wage' | 'promise' | 'bond'

interface Weighed { total: number; parts: Record<Why, number> }

/** How a player weighs one offer. Character tilts the weights but is never
 *  named: what the manager is told is the reason that decided it. */
function weigh(state: GameState, p: Player, club: Club, wage: number, mine: MyTerms | null): Weighed {
  const base = Math.max(500, playerWage(p.ca, p.age))
  const repW = p.pers === 'Ambitious' ? 1.4 : 1
  const wageW = p.pers === 'Mercenary' ? 1.6 : p.pers === 'Loyal' ? 0.8 : 1
  const minsW = p.age <= 23 ? 1.3 : p.age >= 31 ? 0.8 : 1
  const mins = minutesAt(state, club, p)
  const parts: Record<Why, number> = {
    rep: (club.rep / 8) * repW,
    wage: (clamp(6 * Math.log(Math.max(1, wage) / base), -3, 3) + (mine ? Math.min(1.2, mine.signOn / (base * 15)) : 0)) * wageW,
    minutes: mins * 1.6 * minsW,
    // a promise is worth most to a man who would not otherwise start
    promise: mine?.promise && mins < 2 ? (2 - mins) * 0.4 * minsW : 0,
    bond: 0,
  }
  if (mine) {
    const tone = agentTone(state, p)
    parts.bond += tone === 'warm' ? 0.5 : tone === 'cool' ? -0.5 : 0
  }
  // a return to a club he has played for
  if (careerRows(p).some(r => r.clubId === club.id) || p.exClub === club.id) parts.bond += 0.6
  const total = parts.rep + parts.wage + parts.minutes + parts.promise + parts.bond
  return { total, parts }
}

export interface Choice {
  /** true when the manager's offer wins */
  mine: boolean
  /** why, as a fragment key and its vars */
  why: { k: string; v: Vars }
}

/** The player's decision between the manager's terms and the rival's. */
export function chooseBetween(state: GameState, p: Player, rb: RivalBid, mine: MyTerms | null): Choice {
  const user = state.clubs[state.userClubId]
  const rival = state.clubs[rb.clubId]
  const u = mine ? weigh(state, p, user, mine.wage, mine) : null
  const r = weigh(state, p, rival, rb.wage, null)
  // no terms put to him at all: he goes where the offer is
  if (!u) return { mine: false, why: { k: 'news.rivalWhyNoTerms', v: {} } }
  const won = u.total >= r.total
  const [a, b] = won ? [u, r] : [r, u]
  let best: Why = 'rep'
  let gap = -Infinity
  for (const k of ['minutes', 'wage', 'rep', 'promise', 'bond'] as Why[]) {
    const d = a.parts[k] - b.parts[k]
    if (d > gap) { gap = d; best = k }
  }
  return { mine: won, why: whyOf(state, p, best, won, rival) }
}

function whyOf(state: GameState, p: Player, k: Why, mineWon: boolean, rival: Club): { k: string; v: Vars } {
  if (k === 'minutes') return { k: 'news.rivalWhyMinutes', v: { pos_k: posNounKey(p.pos) } }
  if (k === 'wage') return { k: 'news.rivalWhyWage', v: {} }
  if (k === 'promise') return { k: 'news.rivalWhyPromise', v: {} }
  if (k === 'bond') {
    const home = mineWon ? state.clubs[state.userClubId] : rival
    if (careerRows(p).some(r => r.clubId === home.id) || p.exClub === home.id) return { k: 'news.rivalWhyReturn', v: {} }
    return { k: mineWon ? 'news.rivalWhyAgentWarm' : 'news.rivalWhyAgentCool', v: {} }
  }
  return { k: 'news.rivalWhyRep', v: {} }
}

// ---------------------------------------------------------------- opening ---

/** The wage a rival club offers him: the scale at what it can pay, a little
 *  more from a club going for it, and never a cut on what he earns now. */
function rivalWage(state: GameState, p: Player, club: Club): number {
  const rate = clamp(aiPayRate(state, club), 0.75, 1)
  const lift = clubIntent(state, club) === 'allin' ? 1.1 : 1
  const jig = 0.97 + 0.08 * rand(`rbwage|${state.seed}|${p.id}|${club.id}|${state.season}`)
  const w = Math.max(p.wage, playerWage(p.ca, p.age) * rate * lift * jig)
  return Math.round(w / 50) * 50
}

/** The AI club that would genuinely contest this signing, or null. Pure. */
export function rivalFor(state: GameState, p: Player, fee: number): { club: Club; wage: number } | null {
  const user = state.clubs[state.userClubId]
  const seller = p.clubId ? state.clubs[p.clubId] : null
  if (!user || !seller || state.unemployed || p.ca < 66 || p.retiring || p.loanFrom || p.onLoan) return null
  const cands: { club: Club; keen: number; wage: number }[] = []
  for (const c of Object.values(state.clubs)) {
    if (isMyClub(state, c.id) || c.id === seller.id || c.admin) continue
    // reputation in range: a club he would consider, near the manager's level
    if (c.rep < user.rep - 10 || c.rep > user.rep + 12 || p.ca > c.rep + 8) continue
    const allin = clubIntent(state, c) === 'allin'
    if (c.budget < fee * (allin ? 0.85 : 1)) continue
    // real need: he would walk into their side
    if (minutesAt(state, c, p) < 2) continue
    if (embargoed(state, c.id) || seniorsOf(state, c) >= SQUAD_LIMIT) continue
    if (clubIntent(state, c) === 'breakup') continue
    if (!canSpend(state, c)) continue
    const wage = rivalWage(state, p, c)
    const cap = c.leagueId ? state.caps?.[c.leagueId] : null
    if (typeof cap === 'number' && cap > 0 && capBill(state, c) + wage > cap) continue
    const keen = (allin ? 1 : 0) + (clubIntent(state, c) === 'rebuild' && p.age <= 24 ? 0.6 : 0) -
      Math.abs(c.rep - user.rep) / 20 + rand(`rbkeen|${state.seed}|${p.id}|${c.id}|${state.season}`) * 0.5
    cands.push({ club: c, keen, wage })
  }
  if (!cands.length) return null
  cands.sort((a, b) => b.keen - a.keen || a.club.id.localeCompare(b.club.id))
  const top = cands[0]
  // not every signing is a fight: a star, a prized prospect and a club going
  // for it make one likelier
  const allin = clubIntent(state, top.club) === 'allin'
  const chance = 0.3 + (allin ? 0.15 : 0) + (p.ca >= 80 ? 0.1 : 0) + (p.age <= 21 && p.pa >= 84 ? 0.1 : 0) +
    Math.min(0.1, (cands.length - 1) * 0.03)
  if (rand(`rbgate|${state.seed}|${p.id}|${state.season}`) >= chance) return null
  return { club: top.club, wage: top.wage }
}

/** The live rival bid on this man, if there is one this week. */
export function liveRivalBid(state: GameState, playerId: number): RivalBid | null {
  const rb = (state.rivalBids ?? []).find(b => b.playerId === playerId && b.season === state.season && b.week === state.week)
  if (!rb) return null
  const p = state.players[playerId]
  if (!p || p.clubId !== rb.sellerId || !state.clubs[rb.clubId]) return null
  return rb
}

/** Called when the manager agrees a fee: does anybody else come in? */
export function openRivalBid(state: GameState, p: Player, fee: number): RivalBid | null {
  const live = liveRivalBid(state, p.id)
  if (live) return live
  if (!p.clubId) return null
  // one decision a man a season: walking away and coming back next week does
  // not re-roll it, and a club that lost him once does not return the same summer
  if ((state.rivalBids ?? []).some(b => b.playerId === p.id && b.season === state.season)) return null
  const r = rivalFor(state, p, fee)
  if (!r) return null
  const rb: RivalBid = { playerId: p.id, clubId: r.club.id, sellerId: p.clubId, fee, wage: r.wage, week: state.week, season: state.season }
  ;(state.rivalBids ??= []).push(rb)
  if (state.rivalBids.length > 20) state.rivalBids = state.rivalBids.slice(-20)
  return rb
}

/** The line the agreed-fee reply carries when a rival has matched it. */
export function rivalBidLine(state: GameState, rb: RivalBid): { k: string; v: Vars } {
  const c = state.clubs[rb.clubId]
  return { k: 'reply.rivalBidOpen', v: { club: c?.short ?? '', wage: fmtWage(rb.wage) } }
}

/** The manager's terms won: file the story and close the bid. */
export function rivalBidWon(state: GameState, p: Player, rb: RivalBid, why: { k: string; v: Vars }): void {
  const c = state.clubs[rb.clubId]
  rb.week = -1
  if (!c) return
  const v: Vars = { player: p.name, club: c.name, short: c.short, wage: fmtWage(rb.wage), why_k: why.k, ...why.v }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: tIn('en', 'news.rivalBidWonSubj', v), body: tIn('en', 'news.rivalBidWon', v),
    k: 'news.rivalBidWon', v, playerId: p.id,
  })
}

/**
 * The week is out: every rival bid the manager did not beat is settled, and
 * the rival signs the man. Run once a week before the AI market moves.
 */
export function settleRivalBids(state: GameState): void {
  const list = state.rivalBids ?? []
  if (!list.length) return
  for (const rb of list) {
    if (rb.season !== state.season || rb.week !== state.week) continue
    const p = state.players[rb.playerId]
    const club = state.clubs[rb.clubId]
    rb.week = -1
    if (!p || !club || p.clubId !== rb.sellerId || !windowOpen(state.week)) continue
    if (club.budget < rb.fee * 0.85 || embargoed(state, club.id) || seniorsOf(state, club) >= SQUAD_LIMIT) continue
    // terms he would have taken but never signed count as no terms at all
    const choice = chooseBetween(state, p, rb, rb.mine ?? null)
    if (choice.mine) choice.why = { k: 'news.rivalWhyNoTerms', v: {} }
    executeTransfer(state, p, club.id, rb.fee)
    p.wage = rb.wage
    const v: Vars = { player: p.name, club: club.name, short: club.short, wage: fmtWage(rb.wage), fee: fmtMoney(rb.fee), why_k: choice.why.k, ...choice.why.v }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: tIn('en', 'news.rivalBidLostSubj', v), body: tIn('en', 'news.rivalBidLost', v),
      k: 'news.rivalBidLost', v, playerId: p.id,
    })
  }
  // only this season's record is needed: it stops the same man being contested twice
  state.rivalBids = list.filter(b => b.season === state.season)
}

// ---------------------------------------------------------------- youth hunt ---

const NEED_MIN: Record<string, number> = { LP: 2, HK: 2, TP: 2, LK: 3, FL: 3, N8: 2, SH: 2, FH: 2, CE: 3, WG: 3, FB: 2 }
const HUNT_WEEKS = [2, 4, 6, JANUARY_OPEN + 1]

/** Is this one of the best young prospects in the world? */
export const isProspect = (p: Player): boolean =>
  p.age <= 21 && p.pa >= 82 && p.pa >= p.ca + 5 && !p.retiring && !p.onLoan && !p.loanFrom

/** The prospect this AI club would go for this week, or null. Pure. */
export function youthTarget(state: GameState, club: Club, pool?: Player[]): Player | null {
  if (isMyClub(state, club.id) || club.admin || club.balance <= 0 || embargoed(state, club.id)) return null
  const intent = clubIntent(state, club)
  if (intent !== 'allin' && intent !== 'rebuild') return null
  if (leagueTier(club.leagueId) > 2) return null
  // one summer week a club, and not every club every summer
  const key = `${state.seed}|${club.id}|${state.season}`
  if (HUNT_WEEKS[hashString(`yhweek|${key}`) % HUNT_WEEKS.length] !== state.week) return null
  if (rand(`yhgate|${key}`) >= (intent === 'allin' ? 0.55 : 0.4)) return null
  if (seniorsOf(state, club) >= SQUAD_LIMIT) return null
  if (!canSpend(state, club)) return null
  const byPos: Record<string, number> = {}
  for (const id of club.players) {
    const q = state.players[id]
    if (q && !q.acad) byPos[q.pos] = (byPos[q.pos] ?? 0) + 1
  }
  const cands = (pool ?? Object.values(state.players).filter(isProspect)).filter(p => {
    if (!p.clubId || p.clubId === club.id || isMyClub(state, p.clubId) || p.acad) return false
    const seller = state.clubs[p.clubId]
    if (!seller || seller.rep > club.rep + 2) return false
    // squad balance: never into a position they already have plenty of
    if ((byPos[p.pos] ?? 0) >= (NEED_MIN[p.pos] ?? 2) + 3) return false
    if (p.joinedAt != null && absWeek(state.season, state.week) - p.joinedAt < INK_WEEKS) return false
    return askingPrice(state, p) <= club.budget
  })
  if (!cands.length) return null
  cands.sort((a, b) => b.pa - a.pa || b.ca - a.ca || a.id - b.id)
  return cands[0]
}

/** The week's youth hunt: at most one prospect a club a summer. */
export function aiYouthHunt(state: GameState): void {
  if (!windowOpen(state.week) || !HUNT_WEEKS.includes(state.week)) return
  const pool = Object.values(state.players).filter(isProspect)
  if (!pool.length) return
  const clubs = Object.values(state.clubs).sort((a, b) => b.rep - a.rep || a.id.localeCompare(b.id))
  for (const club of clubs) {
    const p = youthTarget(state, club, pool)
    if (!p) continue
    executeTransfer(state, p, club.id, askingPrice(state, p))
  }
}

// ---------------------------------------------------------------- free agents ---

/** The free agents AI boards look at: the stars, whose idling in the pool was
 *  the drain (scripts/leaguestrength.ts). Every free man signed is a wage the
 *  world did not pay before and a fee no selling club got: taking the 78-84s
 *  too put 45% of the lower leagues in the red at season fourteen against
 *  27% on stars alone (scripts/distressprobe.ts). */
const FREE_MIN_CA = 85
/** What a man out of contract takes on the club's rate for new deals. */
const FREE_CUT = 0.85

/**
 * A STAR LET GO IS NOT LEFT LYING THERE. Measured before this round
 * (scripts/leaguestrength.ts): AI clubs that could not afford a renewal let
 * their best men walk, nothing in the AI market ever signed a free agent,
 * and the pool sat full of 88-rated men for the manager alone. Now a club
 * that would start him and can pay his wage signs him: a star's chance of
 * going is a little over a third in a window week and about one in eight in
 * any other, so the manager can still beat them to him, but not at leisure.
 */
export function aiFreeAgents(state: GameState): void {
  // a free agent has no registration to move, so he can sign in any week;
  // boards do most of it in the windows, when they are looking anyway
  const chance = windowOpen(state.week) ? 0.35 : 0.12
  const pool = Object.values(state.players)
    .filter(p => !p.clubId && !p.retiring && !p.acad && p.ca >= FREE_MIN_CA && p.age <= 33)
    .sort((a, b) => b.ca - a.ca || a.id - b.id)
  const tries = pool.slice(0, 30).filter(p => rand(`fa|${state.seed}|${p.id}|${state.season}|${state.week}`) < chance)
  if (!tries.length) return
  const clubs = Object.values(state.clubs).filter(c => !isMyClub(state, c.id) && !embargoed(state, c.id) &&
    seniorsOf(state, c) < SQUAD_LIMIT && clubIntent(state, c) !== 'breakup')
  // the wage rooms are a pass over the world, so they are read once a week
  const rooms = aiWageRooms(state)
  const used = new Set<string>()
  for (const p of tries) {
    let best: Club | null = null, bestKeen = -Infinity, bestWage = 0
    for (const c of clubs) {
      if (used.has(c.id) || c.rep < p.ca - 10 || minutesAt(state, c, p) < 2) continue
      // He is offered the club's rate on new deals, less a little (a man out
      // of contract has nobody bidding against it), and the club signs him
      // only if its income carries the bill with him on it: a free man costs
      // no fee, so the wage is the whole decision, and every one signed is a
      // wage the world did not pay before. Measured (scripts/distressprobe.ts,
      // scripts/aiecon.ts): asking only whether a club could spend at all put
      // 42% of the lower leagues in the red at season fourteen, and letting
      // rich boards stretch for stars took the mean AI club's gain from
      // 0.25M to 0.21M a season; on income alone it holds.
      const room = rooms.get(c.id) ?? 0
      const wage = Math.round(playerWage(p.ca, p.age) * clamp(aiPayRate(state, c, room), 0.75, 1) * FREE_CUT / 50) * 50
      if (!aiCanCarry(state, c, wage, room)) continue
      const cap = c.leagueId ? state.caps?.[c.leagueId] : null
      if (typeof cap === 'number' && cap > 0 && capBill(state, c) + wage > cap) continue
      const keen = c.rep / 10 + (clubIntent(state, c) === 'allin' ? 1 : 0) + rand(`fakeen|${state.seed}|${p.id}|${c.id}|${state.season}`)
      if (keen > bestKeen) { bestKeen = keen; best = c; bestWage = wage }
    }
    if (!best) continue
    used.add(best.id)
    executeTransfer(state, p, best.id, 0)
    if (p.clubId === best.id) p.wage = bestWage
  }
}

// ---------------------------------------------------------------- the response ---

/** The share of a club's budget its board adds, and the ceiling on it. */
const BACK_SHARE = 0.4
const BACK_MAX = 4_000_000

/** Best CA per position at a club, over its starting shirts. */
function posStrength(state: GameState, club: Club): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pos of Object.keys(SHIRTS)) {
    const xs = club.players.map(id => state.players[id]).filter(q => q && !q.acad && q.pos === pos)
      .map(q => q.ca).sort((a, b) => b - a).slice(0, SHIRTS[pos])
    out[pos] = xs.length ? xs.reduce((s, x) => s + x, 0) / SHIRTS[pos] : 0
  }
  return out
}

/** Where the manager's side outclassed theirs most: the position to buy. */
export function beatenAt(state: GameState, club: Club): Pos {
  const mine = posStrength(state, state.clubs[state.userClubId])
  const theirs = posStrength(state, club)
  let best = 'FL', gap = -Infinity
  for (const pos of Object.keys(SHIRTS)) {
    const d = (mine[pos] ?? 0) - (theirs[pos] ?? 0)
    if (d > gap) { gap = d; best = pos }
  }
  return best as Pos
}

/**
 * Called at the rollover while last season's table still stands: which clubs
 * will want to answer the manager. At most three: the clubs that finished
 * just behind him (all the top half when he took the title, wherever the
 * table had him), a club of his stature or bigger that he finished well
 * clear of, and the coach the career arc made his rival or a derby rival,
 * if they finished behind.
 */
export function respondersTo(state: GameState, order: string[], champion?: string): string[] {
  if (state.unemployed) return []
  const user = state.clubs[state.userClubId]
  const at = order.indexOf(state.userClubId)
  if (!user || at < 0) return []
  const won = champion === state.userClubId
  if (!won && at > Math.floor(order.length / 2)) return []
  const rivalClub = rivalCoach(state)?.at
  const derby = new Set(rivalsOf(user.id))
  const half = order.length / 2
  const scored: { id: string; s: number }[] = []
  order.forEach((id, i) => {
    if (i === at || (!won && i < at)) return
    const c = state.clubs[id]
    if (!c || isMyClub(state, id) || c.admin) return
    const close = i < half && (won || (at <= 3 && i <= at + 4))
    const humbled = i > at && c.rep >= user.rep && i - at >= 5
    const named = i > at && (id === rivalClub || derby.has(id))
    if (!close && !humbled && !named) return
    scored.push({ id, s: (id === rivalClub ? 3 : 0) + (derby.has(id) ? 1.5 : 0) + (close ? 2 - i * 0.3 : 0) + (humbled ? 1 : 0) })
  })
  return scored.sort((a, b) => b.s - a.s || a.id.localeCompare(b.id)).slice(0, 3).map(x => x.id)
}

/** After the summer budgets are set: the boards that answer him. */
export function backResponders(state: GameState, ids: string[]): void {
  state.rivalPush = undefined
  const clubs: RivalPush['clubs'] = []
  for (const id of ids) {
    const c = state.clubs[id]
    if (!c || isMyClub(state, id) || c.balance <= 0 || c.admin) continue
    const extra = Math.round(Math.min(c.budget * BACK_SHARE, c.balance * 0.3, BACK_MAX) / 50_000) * 50_000
    if (extra < 250_000) continue
    c.budget += extra
    const pos = beatenAt(state, c)
    clubs.push({ id, pos, n: 0 })
    const v: Vars = {
      club: c.name, short: c.short, coach: c.coach ?? '', amount: fmtMoney(extra), pos_k: posNounKey(pos),
    }
    const k = c.coach ? 'news.rivalBacked' : 'news.rivalBackedBoard'
    state.news.push({
      id: state.nextId++, week: 1, season: state.season, type: 'transfer', read: false,
      subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
    })
  }
  if (clubs.length) state.rivalPush = { season: state.season, clubs }
}

/** The backed clubs spend it: up to two men at the position that beat them,
 *  and one bid for the manager's own man there. Summer window only, and the
 *  bid only while the week it lands in is still a window week. */
export function rivalPushWeek(state: GameState): void {
  const rp = state.rivalPush
  if (!rp) return
  if (rp.season !== state.season) { state.rivalPush = undefined; return }
  if (state.week > SUMMER_SHUT || !windowOpen(state.week)) return
  const user = state.clubs[state.userClubId]
  for (const e of rp.clubs) {
    const club = state.clubs[e.id]
    if (!club || isMyClub(state, e.id) || embargoed(state, e.id)) continue
    const key = `${state.seed}|${e.id}|${state.season}|${state.week}`
    // a bid for his man at that position, once, and only a real one
    if (!e.bid && user && !state.unemployed && windowOpen(nextWeek(state.week)) && rand(`rpbid|${key}`) < 0.35) {
      const his = user.players.map(id => state.players[id])
        .filter(p => p && !p.acad && !p.loanFrom && !p.retiring && p.pos === e.pos && p.ca >= 78 && !freeDeal(state, p))
        .sort((a, b) => b.ca - a.ca)[0]
      const dry = his && (his.joinedAt == null || absWeek(state.season, state.week) - his.joinedAt >= INK_WEEKS)
      if (his && dry && !state.offers.some(o => o.playerId === his.id && o.status === 'pending') && club.budget >= his.value) {
        e.bid = true
        const fee = Math.round((his.value * 1.3) / 10_000) * 10_000
        state.offers.push({
          id: state.nextId++, playerId: his.id, fromClubId: club.id, toClubId: user.id,
          fee, week: state.week, forUser: true, status: 'pending',
        })
        const v: Vars = { player: his.name, club: club.name, short: club.short, fee: fmtMoney(fee) }
        state.news.push({
          id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
          subject: tIn('en', 'news.rivalPushBidSubj', v), body: tIn('en', 'news.rivalPushBid', v),
          k: 'news.rivalPushBid', v, playerId: his.id,
        })
      }
    }
    if (e.n >= 2 || rand(`rpbuy|${key}`) >= 0.5) continue
    if (seniorsOf(state, club) >= SQUAD_LIMIT) continue
    const theirBest = posStrength(state, club)[e.pos] ?? 0
    const target = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== club.id && !isMyClub(state, p.clubId) && p.pos === e.pos && !p.acad &&
      !p.onLoan && !p.loanFrom && !p.retiring && p.ca >= 74 && p.ca > theirBest &&
      !(state.preContracts ?? []).some(pc => pc.playerId === p.id) && // (1.8.14) promised elsewhere
      (state.clubs[p.clubId]?.rep ?? 99) <= club.rep + 6 &&
      (p.joinedAt == null || absWeek(state.season, state.week) - p.joinedAt >= INK_WEEKS) &&
      askingPrice(state, p) <= club.budget)
      .sort((a, b) => b.ca - a.ca || a.id - b.id)[0]
    if (!target) continue
    e.n++
    executeTransfer(state, target, club.id, askingPrice(state, target))
  }
}

/** Migrate: keep only well-formed entries. */
export function migrateRivalBids(s: GameState): void {
  const ok = (b: unknown): b is RivalBid => {
    const x = b as RivalBid
    return !!x && typeof x === 'object' && Number.isFinite(x.playerId) && typeof x.clubId === 'string' &&
      typeof x.sellerId === 'string' && Number.isFinite(x.fee) && Number.isFinite(x.wage) &&
      Number.isFinite(x.week) && Number.isFinite(x.season)
  }
  if (s.rivalBids != null) {
    s.rivalBids = Array.isArray(s.rivalBids) ? s.rivalBids.filter(ok).slice(-20) : undefined
    if (s.rivalBids && !s.rivalBids.length) s.rivalBids = undefined
  }
  const rp = s.rivalPush as RivalPush | undefined
  if (rp != null) {
    const good = rp && typeof rp === 'object' && Number.isFinite(rp.season) && Array.isArray(rp.clubs)
    if (!good) s.rivalPush = undefined
    else {
      rp.clubs = rp.clubs.filter(c => c && typeof c.id === 'string' && typeof c.pos === 'string' && Number.isFinite(c.n)).slice(0, 3)
      if (!rp.clubs.length) s.rivalPush = undefined
    }
  }
}
