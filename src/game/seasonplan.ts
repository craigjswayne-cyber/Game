// ---- SEASON PRIORITIES (1.8.2) ----
//
// Owner's blueprint: fewer systems, more connections. So this is not a
// calendar planner (rejected) and it adds no new screen. The manager ranks the
// competitions his club is in and names one rotation intent, and the ranking
// is read by what already exists:
//
//   THE ASSISTANT'S SHEET. When the manager leaves the team sheet to the
//   assistant (tactic.userPicked unset), the assistant works from his standing
//   side, the sheet as it stood when the plan first ran this season, and for
//   each fixture rests men out of it as the plan says: in a competition ranked
//   low the first-choice men whose legs will not be back by the weekend, and
//   under "Protect key men" the key men outright. A rested man's shirt is
//   filled for the week and handed back when he returns. The Selection
//   screen's Best XV button drafts a fresh side with the same rests. A sheet
//   the manager wrote is his, and the plan does not touch it.
//
//   WHY A STANDING SIDE AND NOT A FRESH PICK EVERY WEEK. The first cut
//   re-picked from scratch each week, and one seed read 35 league points with
//   no plan against 57 and 61 with either plan: a weekly form-and-fitness
//   refresh is worth far more than any ranking, so the card became a switch
//   that fixed autopilot (autopilotprobe's lesson, matchEngine lineupFor). The
//   absent manager's bill is the sheet nobody updates; the plan only decides
//   whom that sheet spares.
//
//   THE BOARD. Every result's swing (season.ts boardReaction) and the May
//   verdicts (rollover.ts) are scaled by where the manager ranked that
//   competition: the one he said mattered most moves the needle harder, and
//   the one he ranked last is judged more gently.
//
// The trade-off is the game's own. Condition and sharpness already decide the
// match (matchEngine teamUnits), minutes already feed the red zone, and rested
// men lose sharpness in the week they sit out. Nothing here adds a number to
// the engine; it only changes who plays where.
//
// No plan (a new career, an old save, a manager who never opens the card) is
// exactly the old game: every factor below is 1 and the sheet is never touched.
import type { Fixture, GameState, Player, Pos } from './model'
import { XV_SLOTS } from './model'
import { assistantJudgement, autoSelect, availablePlayers } from './matchEngine'
import { splitFor } from './bench'
import { effAt } from './attributes'
import { statusOf } from './gametime'

export type RotIntent = 'strongest' | 'balanced' | 'protect'
export const ROT_INTENTS: RotIntent[] = ['strongest', 'balanced', 'protect']

export interface SeasonPlan {
  /** competition ids, most important first; ids the club is not in are ignored */
  order: string[]
  rot: RotIntent
  /** the season it was last set, so the card can say it is carried over */
  season: number
  /** the assistant's standing side for `baseSeason`, taken the first time the
   *  plan names a sheet in a season; rests are made out of it */
  base?: (number | null)[]
  baseSeason?: number
}

export type Tier = 'high' | 'mid' | 'low'

/** The club competitions a plan can rank: the league, then the continental
 *  cups the club is entered in. Tests and friendlies are not the club's to
 *  prioritise. */
export function planComps(state: GameState): string[] {
  const club = state.clubs[state.userClubId]
  if (!club) return []
  const out: string[] = []
  if (state.comps[club.leagueId]) out.push(club.leagueId)
  for (const c of Object.values(state.comps)) {
    if (c.id === club.leagueId || c.isNational || c.type === 'intl' || c.id === 'fr') continue
    if (c.teamIds.includes(club.id)) out.push(c.id)
  }
  return out
}

/** The plan's order over the competitions actually on this season's list:
 *  ranked ones first in the manager's order, anything new at the end. */
export function rankedComps(state: GameState): string[] {
  const here = planComps(state)
  const order = state.seasonPlan?.order ?? []
  const ranked = order.filter(id => here.includes(id))
  for (const id of here) if (!ranked.includes(id)) ranked.push(id)
  return ranked
}

/** Where a competition sits in the plan. Null with no plan, or for a
 *  competition the plan cannot rank (a friendly, a Test). */
export function planTier(state: GameState, compId: string): Tier | null {
  if (!state.seasonPlan) return null
  const ranked = rankedComps(state)
  const i = ranked.indexOf(compId)
  if (i < 0 || ranked.length < 2) return ranked.length === 1 && i === 0 ? 'high' : null
  if (i === 0) return 'high'
  return i === ranked.length - 1 ? 'low' : 'mid'
}

/** The board's volume for a result in this competition. 1 with no plan. */
export function boardPriorityF(state: GameState, compId: string): number {
  const tier = planTier(state, compId)
  return tier === 'high' ? 1.25 : tier === 'low' ? 0.6 : 1
}

export function setSeasonPlan(state: GameState, order: string[], rot: RotIntent) {
  const was = state.seasonPlan
  state.seasonPlan = { order: order.slice(), rot, season: state.season }
  // the standing side is the assistant's, not the ranking's: re-ranking keeps it
  if (was?.base && was.baseSeason === state.season) {
    state.seasonPlan.base = was.base
    state.seasonPlan.baseSeason = was.baseSeason
  }
  applyPlanSheet(state)
}

// WHO SITS OUT (1.8.2, remeasured after the styles merge). The first cut
// rested on condition thresholds, tight in the top competition and loose in
// the bottom one, and over 28 paired seasons the side that ranked the league
// LAST won 6.8 more league points than the side that ranked it first: tired
// legs cost a match far more than a man's ability is worth, so the loose
// thresholds were the better way to run the league and the top competition got
// the worse of it. Two rules now, one for each half of the bargain:
//
//   THE BEST SIDE ON THE DAY, everywhere. A man sits out when the best fresh
//   natural behind him scores better for this match on the legs each will
//   have by the weekend. The weighing leans on condition much harder than
//   autoSelect's (COND_W), because the engine does: a tired man starts on less
//   petrol as well as playing below his numbers. Lower down the order the
//   assistant takes a slightly weaker side for fresher legs (REST_MARGIN).
//
//   SPARING THE BEST, below the top. In a lower-ranked competition the best
//   men in the side (the key men first, under "Protect key men") sit out even
//   fresh, PREEMPT of them, so they reach the competition that matters with
//   the week's legs in them. That is the real cost: a weaker side, on purpose.
//
// Rows are tiers, columns are strongest / balanced / protect.
const COND_W = 0.6
const REST_MARGIN: Record<Tier, [number, number, number]> = {
  high: [-0.04, 0, 0],
  mid: [0, 0.02, 0.03],
  low: [0.02, 0.04, 0.05],
}
const PREEMPT: Record<Tier, [number, number, number]> = {
  high: [0, 0, 0],
  mid: [0, 1, 2],
  low: [0, 3, 5],
}
// and never more than this many of the XV in one week
const REST_MAX: Record<Tier, [number, number, number]> = {
  high: [4, 6, 6],
  mid: [5, 7, 8],
  low: [6, 9, 11],
}
/** the weekly recovery the sheet is picked ahead of (season.ts, base rate) */
const WEEK_REC = 22

/** How many naturals each XV position needs to stay a natural's shirt: one
 *  per shirt, and a spare for the front row the bench must cover (Law 3). */
function needAt(pos: Pos): number {
  const shirts = XV_SLOTS.filter(s => s.pos === pos).length
  return pos === 'HK' || pos === 'LP' || pos === 'TP' ? shirts + 1 : shirts
}

/** The standing side for this season, if the plan has taken one. */
function standing(state: GameState): (number | null)[] | null {
  const plan = state.seasonPlan
  return plan?.base && plan.baseSeason === state.season && plan.base.length === 23 ? plan.base : null
}

/**
 * The men the assistant would rest for this fixture, out of the XV of his
 * standing side (or, before he has one, the honest first-choice XV). Each is
 * weighed against the best fresh natural for his shirt, the one who would
 * take it, and never so many at one position that a shirt falls to a man out
 * of position: that sheet would be judged stale on the way to the pitch and
 * the rest undone (matchEngine lineupFor). Below the top competition some of
 * the best men are spared outright (PREEMPT).
 */
export function restList(state: GameState, fx: Fixture | undefined): Player[] {
  const plan = state.seasonPlan
  const club = state.clubs[state.userClubId]
  if (!plan || !club || !fx) return []
  const tier = planTier(state, fx.compId)
  if (!tier) return []
  const col = ROT_INTENTS.indexOf(plan.rot)
  const pool = availablePlayers(state, club.players, false).filter(p => !p.acad)
  if (pool.length < 26) return []
  const inPool = new Set(pool.map(p => p.id))
  const xv = (standing(state) ?? autoSelect(state, pool, splitFor(club))).slice(0, 15)
  const inXv = new Set(xv.filter((id): id is number => id != null))
  const proj = (p: Player) => Math.min(100, p.cond + WEEK_REC)
  // the day's worth, on the legs he will have by the weekend
  const score = (p: Player, pos: Pos) => effAt(p, pos) * (1 - COND_W + COND_W * (proj(p) / 100)) * (0.85 + 0.03 * p.form)
  const key = (p: Player) => plan.rot === 'protect' && statusOf(state, club, p) === 'key'
  const margin = REST_MARGIN[tier][col]
  // the men to spare in a lower-ranked competition: key men first under
  // "Protect key men", then the best in the side
  const spare = new Set(xv.filter((id): id is number => id != null && inPool.has(id)).map(id => state.players[id])
    .sort((a, b) => (key(b) ? 1 : 0) - (key(a) ? 1 : 0) || b.ca - a.ca || a.id - b.id)
    .slice(0, PREEMPT[tier][col]).map(p => p.id))
  const cands: { p: Player; gain: number; cover: Player }[] = []
  const taken = new Set<number>()
  xv.forEach((id, i) => {
    if (id == null || !inPool.has(id)) return
    const p = state.players[id]
    const pos = XV_SLOTS[i].pos
    let cover: Player | null = null
    for (const c of pool) {
      if (c.pos !== pos || inXv.has(c.id)) continue
      if (!cover || score(c, pos) > score(cover, pos)) cover = c
    }
    if (!cover) return
    const gain = score(cover, pos) * (1 + margin + (spare.has(p.id) ? 1 : 0)) - score(p, pos)
    if (gain > 0) cands.push({ p, gain, cover })
  })
  cands.sort((a, b) => b.gain - a.gain || a.p.id - b.p.id)
  const rested: Player[] = []
  const left = new Map<Pos, number>()
  for (const p of pool) left.set(p.pos, (left.get(p.pos) ?? 0) + 1)
  for (const { p, cover } of cands) {
    if (rested.length >= REST_MAX[tier][col]) break
    if (taken.has(cover.id)) continue
    if ((left.get(p.pos) ?? 0) - 1 < needAt(p.pos)) continue
    left.set(p.pos, (left.get(p.pos) ?? 0) - 1)
    taken.add(cover.id)
    rested.push(p)
  }
  return rested
}

/** The assistant's draft for this week: the plan's rest list taken out, the
 *  rest picked through his usual imperfect eye. With no plan it is exactly
 *  the draft the Best XV button always gave. */
export function assistantSheet(state: GameState, fx?: Fixture): (number | null)[] {
  const club = state.clubs[state.userClubId]
  const rest = new Set(restList(state, fx).map(p => p.id))
  const pool = availablePlayers(state, club.players, false).filter(p => !rest.has(p.id))
  return autoSelect(state, pool, splitFor(club), assistantJudgement(state))
}

/**
 * This week's sheet out of the standing side: every man in it who can play
 * and is not rested keeps his shirt, and only the gaps are filled, through
 * the assistant's eye, from the men left over.
 */
export function planSheet(state: GameState, fx: Fixture, base: (number | null)[]): (number | null)[] {
  const club = state.clubs[state.userClubId]
  const rest = new Set(restList(state, fx).map(p => p.id))
  const avail = new Set(availablePlayers(state, club.players, false).map(p => p.id))
  const out: (number | null)[] = new Array(23).fill(null)
  const used = new Set<number>()
  base.forEach((id, i) => {
    if (id != null && avail.has(id) && !rest.has(id) && !used.has(id)) { out[i] = id; used.add(id) }
  })
  if (!out.some(x => x == null)) return out
  const pool = availablePlayers(state, club.players, false).filter(p => !used.has(p.id) && !rest.has(p.id))
  const filler = autoSelect(state, pool, splitFor(club), assistantJudgement(state))
  for (let i = 0; i < 23; i++) {
    const c = filler[i]
    if (out[i] == null && c != null && !used.has(c)) { out[i] = c; used.add(c) }
  }
  return out
}

/**
 * Called once the week has advanced (season.ts) and when the plan changes:
 * with a plan and a sheet the assistant owns, he names the side for this
 * week's fixture. A manager-picked sheet is never touched.
 */
export function applyPlanSheet(state: GameState) {
  const plan = state.seasonPlan
  if (!plan || state.unemployed) return
  const club = state.clubs[state.userClubId]
  if (!club || club.tactic.userPicked === true) return
  const fx = state.fixtures.find(f => f.week === state.week && !f.played && !f.midweek &&
    (f.homeId === club.id || f.awayId === club.id))
  if (!fx || !planTier(state, fx.compId)) return
  if (!standing(state)) {
    plan.base = club.tactic.lineup.slice()
    plan.baseSeason = state.season
  }
  club.tactic.lineup = planSheet(state, fx, plan.base!)
}
