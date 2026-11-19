// ---- "I'M THINKING OF LEAVING" (1.9.14) ----
//
// Owner: "Contracts ending should have reminders with players also able to
// announce they will be leaving at the end of the season if a contract has
// less than 3 months to go. If the money is good or the mood is sour in camp,
// they should let you know by message they are thinking of leaving as a
// warning - if nothing happens and the right offer is there then they can
// move."
//
// The reminders already run (season.ts CONTRACT_LADDER: six, three, one and
// half a month out). What was missing was the player's own voice: a rival
// could sign a man on a pre-contract with no word beforehand (ai.ts
// aiPreContractPoach). Now, in the last three months of a deal:
//
//   the warning   a man out of contract whose market wage is well above his
//                 own (the money is good) or whose morale is low (the mood is
//                 sour) tells you he is thinking of leaving, once a season
//   the move      three weeks after the warning, still unrenewed, with a
//                 club of his level to go to (the right offer), he announces
//                 he is leaving at the end of the season, on a pre-contract
//
// A renewal stops it at any point. The rivals' own pre-contract raid only
// takes a man who has warned first, so nobody leaves without a word. Nothing
// here draws from the world's random stream: the club he goes to is read off
// a hash of the man and the season.
import type { GameState, Player } from './model'
import { SEASON_WEEKS } from './model'
import { clamp } from './rng'
import { preContractWage } from './ai'
import { tIn } from './i18n'

/** Three months to go. */
export const LEAVE_FROM = SEASON_WEEKS - 13
/** Weeks between the warning and the announcement. */
export const LEAVE_AFTER = 3

export type LeaveWhy = 'money' | 'mood'

/** Why he would go, if he would: the money elsewhere, or the mood here. */
export function leaveReason(p: Player): LeaveWhy | null {
  const wage = Number.isFinite(p.wage) ? p.wage : 0
  if (preContractWage(p) >= wage * 1.15 + 200) return 'money'
  if (p.morale < 4.5) return 'mood'
  return null
}

const hash = (a: number, b: number, c: number) => {
  let h = (Math.imul(a ^ 0x9e3779b9, 2654435761) ^ Math.imul(b + 17, 40503) ^ Math.imul(c + 101, 69069)) >>> 0
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

/** Is he exposed: out of contract this summer, not renewed, not already gone? */
function exposed(state: GameState, p: Player): boolean {
  return p.contractEnds <= state.season && p.renewedSeason !== state.season && !p.loanFrom && !p.retiring && !p.acad && !p.joker &&
    !(state.preContracts ?? []).some(pc => pc.playerId === p.id)
}

/** Has he warned you this season? (the rivals' raid needs it) */
export function hasWarned(state: GameState, p: Player): boolean {
  return p.leaveWarn?.s === state.season
}

/** The week: warnings, then announcements. */
export function leavingWeek(state: GameState): void {
  if (state.unemployed || state.week < LEAVE_FROM || state.week >= SEASON_WEEKS) return
  const club = state.clubs[state.userClubId]
  if (!club) return
  for (const id of club.players) {
    const p = state.players[id]
    if (!p || !exposed(state, p)) continue
    const why = leaveReason(p)
    if (!why) continue
    if (!hasWarned(state, p)) {
      p.leaveWarn = { s: state.season, w: state.week, why }
      const v = { player: p.name, pos: p.pos, why_k: `news.leaveWhy_${why}` }
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
        subject: tIn('en', 'news.leaveWarnSubj', v), body: tIn('en', 'news.leaveWarn', v),
        k: 'news.leaveWarn', v, playerId: p.id,
      })
      continue
    }
    if (state.week - (p.leaveWarn!.w) < LEAVE_AFTER) continue
    // the right offer: a club of his level, read off the man and the season
    const suitors = Object.values(state.clubs)
      .filter(c => c.id !== club.id && c.rep >= club.rep - 12)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    if (!suitors.length) continue
    const to = suitors[Math.floor(hash(p.id, state.season, Math.abs(state.seed)) * suitors.length)]
    ;(state.preContracts ??= []).push({ playerId: p.id, toClubId: to.id, week: state.week })
    p.morale = clamp(p.morale + 0.3, 1, 10)
    const v = { player: p.name, pos: p.pos, club: to.name, short: to.short }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
      subject: tIn('en', 'news.leaveAnnounceSubj', v), body: tIn('en', 'news.leaveAnnounce', v),
      k: 'news.leaveAnnounce', v, playerId: p.id,
    })
  }
}
