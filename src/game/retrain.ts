import { absWeek, POS_ORDER, type GameState, type Player, type Pos, type TrainLoad } from './model'
import { attrWeight } from './attrtemplates'
import { effAt } from './attributes'
import { devHash } from './devproject'
import { tIn } from './i18n'
import { clamp } from './rng'
import { planCap } from './season/training'

/**
 * ---- LEARNING A NEW SHIRT ----
 *
 * Owner (1.9.9): "players can ask to retrain in positions occasionally or the
 * manager can advise this. But it isn't always successful. Forwards / backs
 * should rarely train in the opposite positions."
 *
 * Until now nothing in the game added a position to a man: the office knock
 * offered "work on it in training first" and that answer did nothing. A
 * retrain is a programme of so many weeks in one of the personal-plan places
 * (season/training.ts planCap), so it costs the department a man's plan, and
 * at the end it lands or it does not:
 *   near  his own family of positions (attributes.effAt's neighbours):
 *         likely, 8 weeks
 *   unit  further, but still a forward among forwards or a back among backs:
 *         about a third, 12 weeks
 *   cross a forward learning a back's shirt or the other way: rare, 16 weeks,
 *         and never better than one in eight whatever else is true
 * (the figures are BASE and CAP below)
 * moved by his age, how his attributes suit the shirt (the target's weights
 * against his own), the assistant's badge, and whether he asked. A success
 * puts the shirt in his list, where he plays at 92% (effAt); a failure costs
 * a little morale and that shirt cannot be tried again this season.
 *
 * The roll is a hash of the seed, the man and the week he started, not the
 * season's rng: the world's stream, and so every match, is the same with or
 * without a retrain running (scripts/fingerprint.ts).
 */

export const FORWARDS: ReadonlySet<Pos> = new Set<Pos>(['LP', 'HK', 'TP', 'LK', 'FL', 'N8'])
const SALT_RETRAIN = 71

export type Reach = 'near' | 'unit' | 'cross'

export function reachOf(p: Player, to: Pos): Reach {
  if (effAt(p, to) >= p.ca * 0.8) return 'near'
  return FORWARDS.has(p.pos) === FORWARDS.has(to) ? 'unit' : 'cross'
}

// tuned against a real squad (1.9.10): a 26-year-old who asked, with a
// one-badge assistant, reads about 0.6 / 0.3 / 0.05; young, keen and well
// coached is the best case, near 0.75 at a neighbour
const BASE: Record<Reach, number> = { near: 0.55, unit: 0.25, cross: 0.04 }
const CAP: Record<Reach, number> = { near: 0.85, unit: 0.6, cross: 0.12 }
const WEEKS: Record<Reach, number> = { near: 8, unit: 12, cross: 16 }

/** His attributes read with a position's weights, on the 1-20 scale. */
function fitAt(p: Player, pos: Pos): number {
  let num = 0, den = 0
  for (const k of Object.keys(p.a) as (keyof Player['a'])[]) {
    const w = attrWeight(pos, k)
    num += w * p.a[k]; den += w
  }
  return den ? num / den : 0
}

/** The chance a retrain to `to` lands, 0.02 to 0.9. */
export function retrainOdds(state: GameState, p: Player, to: Pos, asked: boolean): number {
  const reach = reachOf(p, to)
  const age = p.age <= 23 ? 0.08 : p.age >= 30 ? -0.12 : 0
  // the positions' weights overlap a great deal, so the gap is small: one
  // attribute point worse suited to the new shirt than to his own is about
  // an eighth off (a flanker at prop is a point down, a wing at prop nearly two)
  const fit = clamp((fitAt(p, to) - fitAt(p, p.pos)) * 0.12, -0.25, 0.1)
  const odds = BASE[reach] + age + fit + (state.staff?.assistant ?? 0) * 0.03 + (asked ? 0.05 : 0)
  return clamp(odds, 0.02, CAP[reach])
}

export function retrainWeeks(p: Player, to: Pos): number {
  return WEEKS[reachOf(p, to)]
}

/** The word for odds, for the screens: never the bare percentage, which reads
 *  as a promise. */
export function oddsWord(odds: number): string {
  return odds >= 0.6 ? 'training.retrainOddsLikely' : odds >= 0.35 ? 'training.retrainOddsEven' : odds >= 0.15 ? 'training.retrainOddsUnlikely' : 'training.retrainOddsLongShot'
}

const mine = (state: GameState, id: number) => state.players[id]?.clubId === state.userClubId

/** The retrains that count: men still at the club. */
export function activeRetrains(state: GameState): NonNullable<GameState['retrains']> {
  return (state.retrains ?? []).filter(r => mine(state, r.id))
}

export function retrainOf(state: GameState, id: number): NonNullable<GameState['retrains']>[number] | null {
  return activeRetrains(state).find(r => r.id === id) ?? null
}

/** Places the department has free: planCap less the plans and retrains it runs. */
export function freePlaces(state: GameState): number {
  const plans = (state.plans ?? []).filter(x => mine(state, x.id)).length
  return planCap(state) - plans - activeRetrains(state).length
}

/** The shirts he could start learning: not his own, not ones he already plays. */
export function retrainTargets(p: Player): Pos[] {
  return POS_ORDER.filter(pos => pos !== p.pos && !p.alt.includes(pos))
}

/** Why he cannot start learning `to` now, as a locale key, or null. */
export function retrainBlock(state: GameState, p: Player, to: Pos): string | null {
  if (!mine(state, p.id) || p.acad) return 'training.retrainWhyNotSenior'
  if (to === p.pos || p.alt.includes(to)) return 'training.retrainWhyKnown'
  if (retrainOf(state, p.id)) return 'training.retrainWhyBusy'
  if ((state.retrainFails ?? []).some(f => f.id === p.id && f.to === to && f.season === state.season)) return 'training.retrainWhyFailed'
  // a man on a plan gives that place up for the retrain, so he needs none spare
  const onPlan = (state.plans ?? []).some(x => x.id === p.id)
  if (!onPlan && freePlaces(state) <= 0) return 'training.retrainWhyFull'
  return null
}

/** Start him on it. A man told to rather than asking takes it a little badly.
 *  His personal plan, if he had one, is what the retrain replaces. */
export function startRetrain(state: GameState, id: number, to: Pos, asked: boolean): boolean {
  const p = state.players[id]
  if (!p || retrainBlock(state, p, to)) return false
  state.plans = (state.plans ?? []).filter(x => x.id !== id)
  state.retrains = [...activeRetrains(state), {
    id, to, start: absWeek(state.season, state.week), weeks: retrainWeeks(p, to),
    odds: retrainOdds(state, p, to, asked), asked,
  }]
  if (!asked) p.morale = clamp(p.morale - 0.5, 1, 10)
  return true
}

export function stopRetrain(state: GameState, id: number): boolean {
  const had = !!retrainOf(state, id)
  state.retrains = activeRetrains(state).filter(r => r.id !== id)
  return had
}

/** Weeks done and weeks in all, for the progress line. */
export function retrainProgress(state: GameState, r: NonNullable<GameState['retrains']>[number]): { done: number; of: number } {
  return { done: clamp(absWeek(state.season, state.week) - r.start, 0, r.weeks), of: r.weeks }
}

/** Once a week, after training: a retrain whose weeks are up lands or fails,
 *  and the manager is told either way. */
export function settleRetrains(state: GameState): void {
  const now = absWeek(state.season, state.week)
  const keep: NonNullable<GameState['retrains']> = []
  for (const r of activeRetrains(state)) {
    const p = state.players[r.id]
    if (!p) continue
    if (now - r.start < r.weeks) { keep.push(r); continue }
    const v = { player: p.name, pos_k: `pos.${r.to}` }
    if (devHash(state.seed, r.id, SALT_RETRAIN, r.start) < r.odds) {
      if (!p.alt.includes(r.to) && p.pos !== r.to) p.alt = [...p.alt, r.to]
      p.morale = clamp(p.morale + 0.3, 1, 10)
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.retrainDoneSubj', v), body: tIn('en', 'news.retrainDone', v), k: 'news.retrainDone', v,
      })
    } else {
      p.morale = clamp(p.morale - 0.4, 1, 10)
      state.retrainFails = [...(state.retrainFails ?? []).filter(f => f.season === state.season), { id: r.id, to: r.to, season: state.season }]
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'general', read: false,
        subject: tIn('en', 'news.retrainFailSubj', v), body: tIn('en', 'news.retrainFail', v), k: 'news.retrainFail', v,
      })
    }
  }
  state.retrains = keep
}

/**
 * ---- THE TRAINING LOAD ----
 *
 * Owner (1.9.9): build on the training. The weekly focus was a free choice:
 * the same week whatever it cost. The load is the trade. Hard work lands more
 * attribute points and costs legs and the odd hamstring; a light week gives
 * the legs back and lands less. The manager's club only, and normal is the
 * week every save has always had, so the world and the AI clubs are as they
 * were. Each lever scales a roll that already happens (no new rng draw).
 *   grow  the squad session's and the personal plans' weekly chance
 *   inj   the training-ground injury roll
 *   rec   condition points back on top of the week's recovery
 */
export const LOAD: Record<TrainLoad, { grow: number; inj: number; rec: number }> = {
  light: { grow: 0.5, inj: 0.6, rec: 4 },
  normal: { grow: 1, inj: 1, rec: 0 },
  hard: { grow: 1.7, inj: 1.6, rec: -4 },
}

export function loadOf(state: GameState): TrainLoad {
  return state.trainLoad ?? 'normal'
}

/** A save from an older build has none of this; a damaged or hostile one may
 *  have anything (save.ts migrate, scripts/savefuzz.ts). Keep only entries
 *  the week loop can read, and a load it knows. */
export function healRetrains(s: GameState): void {
  const okPos = (x: unknown): x is Pos => typeof x === 'string' && (POS_ORDER as string[]).includes(x)
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  if (s.retrains !== undefined) {
    s.retrains = Array.isArray(s.retrains)
      ? s.retrains.filter(r => r && typeof r === 'object' && num(r.id) && okPos(r.to) && num(r.start) && num(r.weeks) && num(r.odds))
        .map(r => ({ id: r.id, to: r.to, start: r.start, weeks: clamp(Math.round(r.weeks), 1, 52), odds: clamp(r.odds, 0, 1), asked: !!r.asked }))
      : []
  }
  if (s.retrainFails !== undefined) {
    s.retrainFails = Array.isArray(s.retrainFails)
      ? s.retrainFails.filter(f => f && typeof f === 'object' && num(f.id) && okPos(f.to) && num(f.season))
      : []
  }
  if (s.trainLoad !== undefined && !(['light', 'normal', 'hard'] as unknown[]).includes(s.trainLoad)) s.trainLoad = undefined
  if (s.trainLog !== undefined && (!s.trainLog || typeof s.trainLog !== 'object' || !num(s.trainLog.pts) || !num(s.trainLog.inj)
    || !(['light', 'normal', 'hard'] as unknown[]).includes(s.trainLog.load))) s.trainLog = undefined
}
