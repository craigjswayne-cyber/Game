/**
 * ---- THE REWARDED FAVOURS (v1.1.0) ----
 *
 * Four placements (docs/monetisation-spec.md §2), every one player-asked and
 * opt-in, and every one a mechanic the game already has with the FEE replaced:
 * the physio's consult without the six figures, the agency sharing what paid
 * scouting learns, the analyst's full read of a matchup, and the supporters'
 * bucket at a small club in trouble. The spot never invents a power.
 *
 * The bridge holds the per-real-day cap (device-clock-proof, in the wrapper);
 * this file holds the per-save ledgers, timestamped in ABSOLUTE GAME-WEEKS so
 * an instant-result marathon cannot farm them, and reset with the season the
 * way everything seasonal is. monetise.showRewarded() is the only way a spot
 * plays; nothing here runs unless the provider confirmed a completed view.
 */
import { SEASON_WEEKS, fmtMoney, type GameState } from './model'
import { bumpKnowledge } from './scout'
import { clamp } from './rng'
import { t, tIn } from './i18n'

const abs = (state: GameState) => state.season * SEASON_WEEKS + state.week
const ledger = (state: GameState) => (state.rewarded ??= {})
const weekCount = (slot: [number, number] | undefined, now: number) =>
  slot && slot[0] === now ? slot[1] : 0

/** ---- the physio's favour: the sponsor covers the consultant ---- */
export function canPhysioFavour(state: GameState, pid: number): boolean {
  const p = state.players[pid]
  return !!p?.injury && !p.specialist && p.injury.until - state.week >= 3
    && weekCount(state.rewarded?.medical, abs(state)) < 2
}

/** A fifth off the remaining lay-off, at least a week, at most two - a shade
 *  under the paid consult on a long injury, because the sponsor's consultant
 *  is a favour and the club's own six-figure one is a commitment. */
export function physioFavour(state: GameState, pid: number): string | null {
  if (!canPhysioFavour(state, pid)) return null
  const l = ledger(state)
  l.medical = [abs(state), weekCount(l.medical, abs(state)) + 1]
  const p = state.players[pid]!
  p.specialist = true // one opinion per injury, favour or fee alike
  const left = p.injury!.until - state.week
  const cut = Math.min(2, Math.max(1, Math.round(left * 0.2)))
  p.injury!.until = Math.max(state.week + 1, p.injury!.until - cut)
  const v = { player: p.name, injury_k: p.injury!.dk ?? 'common.nothing', n: cut }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
    subject: tIn('en', 'news.physioFavourSubj', v),
    body: tIn('en', 'news.physioFavour', v),
    k: 'news.physioFavour', v, playerId: p.id,
  })
  return t('reply.favourWorked', { player: p.name, n: cut })
}

/** ---- the agency's file: weeks of scouting, shared ---- */
export function canAgencyFile(state: GameState, pid: number): boolean {
  const p = state.players[pid]
  if (!p || p.clubId === state.userClubId) return false
  if (state.rewarded?.scoutSeen?.[pid] === state.season) return false
  return weekCount(state.rewarded?.scout, abs(state)) < 3
}

export function agencyFile(state: GameState, pid: number): boolean {
  if (!canAgencyFile(state, pid)) return false
  const l = ledger(state)
  l.scout = [abs(state), weekCount(l.scout, abs(state)) + 1]
  ;(l.scoutSeen ??= {})[pid] = state.season
  bumpKnowledge(state.players[pid]!, 30)
  return true
}

/** ---- the analyst's all-nighter: the brief becomes the full read ---- */
export function analystArmed(state: GameState): boolean {
  return state.rewarded?.analyst === abs(state)
}

export function armAnalyst(state: GameState) {
  ledger(state).analyst = abs(state)
}

/** ---- the town's collection: the lower-tier lifeline ---- */
export function canTownCollection(state: GameState): boolean {
  if (state.unemployed) return false
  const club = state.clubs[state.userClubId]
  if (!club || club.rep >= 60) return false
  const wages = club.players.reduce((s, id) => s + (state.players[id]?.wage ?? 0), 0)
  if (club.balance >= wages * 8) return false // eight weeks of runway is not trouble
  if (weekCount(state.rewarded?.town, abs(state)) >= 1) return false
  return (state.rewarded?.townSeason ?? 0) < 3
}

export function townCollection(state: GameState): number | null {
  if (!canTownCollection(state)) return null
  const l = ledger(state)
  l.town = [abs(state), 1]
  l.townSeason = (l.townSeason ?? 0) + 1
  const club = state.clubs[state.userClubId]
  const amt = Math.round(clamp((club.budgetAtOpen ?? club.budget) * 0.02, 25_000, 75_000) / 1_000) * 1_000
  club.balance += amt // the bucket keeps the lights on; it buys nobody
  const v = { club: club.name, amount: fmtMoney(amt) }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.townCollectionSubj'),
    body: tIn('en', 'news.townCollection', v),
    k: 'news.townCollection', v,
  })
  return amt
}
