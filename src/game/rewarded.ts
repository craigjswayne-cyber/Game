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
import {absWeek, SEASON_WEEKS, fmtMoney, type GameState } from './model'
import { bumpKnowledge, reportStage, secondOpinion, youthPaMargin } from './scout'
import { clamp } from './rng'
import { t, tIn } from './i18n'
import { insideWord, rivalTalk, talkSpell } from './recruit'
import { reportAccuracy, tapeRoom } from './oppreport'
import { tapeLine } from './armsrace'
import { roomKind, roomLive, teamNightOn } from './room'
import { answerPress } from './media'

const abs = (state: GameState) => absWeek(state.season, state.week)
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

/**
 * THE WHOLE FILE, not thirty points of it.
 *
 * This used to add 30 to whatever the scouts already had, which meant the
 * reward depended on how much attention the player had happened to receive
 * already: a man on 57% came back at 87%, still with ranges on every attribute
 * and his character still marked unknown, and a man on 20% came back at 50%
 * knowing almost nothing. Reported from a live save after watching the spot in
 * full: "when the ad is complete, the scouting profile should be 100%."
 *
 * He is right, and the copy already promised it. An agency file is a dossier,
 * not a weekend of tape. At 100 the margin is zero (scout.margin), so every
 * attribute reads as a number rather than a band, the star rating stops being
 * fuzzed, and reportStage reaches 3 - which is what puts his character on the
 * page. That is the thing the spot is worth watching for.
 *
 * The cost of it staying honest is the ledger, which is unchanged: once per
 * player per season, three a week, and never for a man already at the club.
 */
export function agencyFile(state: GameState, pid: number): boolean {
  if (!canAgencyFile(state, pid)) return false
  const l = ledger(state)
  l.scout = [abs(state), weekCount(l.scout, abs(state)) + 1]
  ;(l.scoutSeen ??= {})[pid] = state.season
  bumpKnowledge(state.players[pid]!, 100)
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
  const v = { club: club.name, amount: fmtMoney(amt), city: club.city }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.townCollectionSubj'),
    body: tIn('en', 'news.townCollection', v),
    k: 'news.townCollection', v,
  })
  return amt
}

/*
 * ---- THE 1.8.2 FAVOURS ----
 *
 * Four more, on the same terms as the four above (docs/monetisation-spec.md
 * §2): the player asks, the spot replaces a wait or a fee the fiction already
 * prices, nothing draws on the shared rng, nothing reaches an AI club, and a
 * manager who never watches one reads every screen complete. Each ledger is
 * stamped in absolute game-weeks.
 */

/** ---- the agent's inside word: the rumour, read as the full file reads it ---- */
export function canInsideWord(state: GameState, pid: number): boolean {
  const p = state.players[pid]
  if (!p || !p.clubId || p.clubId === state.userClubId) return false
  // the full file already hears it this way; so does a man already resolved
  if (reportStage(state, p) >= 3 || insideWord(state, p)) return false
  if (!rivalTalk(state, p)) return false // no line on the report, nothing to ask about
  return weekCount(state.rewarded?.inside, abs(state)) < 2
}

export function insideWordFavour(state: GameState, pid: number): boolean {
  if (!canInsideWord(state, pid)) return false
  const l = ledger(state)
  l.inside = [abs(state), weekCount(l.inside, abs(state)) + 1]
  ;(l.insideSeen ??= {})[pid] = talkSpell(state)
  return true
}

/** ---- a second opinion: one more step of sight on a youngster's ceiling ---- */
export function canSecondOpinion(state: GameState, pid: number): boolean {
  const p = state.players[pid]
  if (!p || p.clubId !== state.userClubId || p.age > 23) return false
  if (secondOpinion(state, p)) return false // once per player per season
  // one step narrower must still be a band: never the number, unless the
  // staff would already read it as one (from 24, and then there is no band)
  return youthPaMargin(state, p) > 1
}

export function secondOpinionFavour(state: GameState, pid: number): boolean {
  if (!canSecondOpinion(state, pid)) return false
  const l = ledger(state)
  ;(l.opinion ??= {})[pid] = state.season
  return true
}

/** ---- tape room night: this week's line on our calls, read by a top setup ---- */
export function canTapeRoom(state: GameState, oppId: string): boolean {
  if (!state.clubs[oppId] || oppId === state.userClubId || tapeRoom(state, oppId)) return false
  // only while the report cannot say: once it reads the coach there is nothing to buy
  // (the line itself, not the whole report: building the report files the
  // analyst's read of the week, and asking whether to offer a spot must not)
  return tapeLine(state, oppId, reportAccuracy(state, oppId))?.k === 'armsrace.tapeUnread'
}

export function tapeRoomFavour(state: GameState, oppId: string): boolean {
  if (!canTapeRoom(state, oppId)) return false
  ledger(state).tape = [abs(state), oppId] // one match: it goes with the week
  return true
}

/** ---- the sponsor's team night: standing by a selection call, half the sting ---- */
export const TEAM_NIGHT_WEEKS = 4

export function canTeamNight(state: GameState, pressId: number): boolean {
  const q = state.press.find(x => x.id === pressId)
  if (!q || q.answered || roomKind(q) !== 'split' || teamNightOn(state, pressId)) return false
  const stand = q.options.find(o => o.room === 'stand')
  if (!stand || !roomLive(state, q, stand)) return false
  const tn = state.rewarded?.teamNight
  return !Array.isArray(tn) || abs(state) - tn[0] >= TEAM_NIGHT_WEEKS
}

/** Stamp the ledger and answer the question with "stand by it", the one
 *  answer the team night is for. Returns false, changing nothing, when the
 *  ledger refuses. */
export function teamNightFavour(state: GameState, pressId: number): boolean {
  if (!canTeamNight(state, pressId)) return false
  const q = state.press.find(x => x.id === pressId)!
  const l = ledger(state)
  const before = l.teamNight
  l.teamNight = [abs(state), pressId]
  answerPress(state, pressId, q.options.findIndex(o => o.room === 'stand'))
  if (q.answered) return true
  l.teamNight = before // the question was withdrawn instead: nothing was spent
  return false
}
