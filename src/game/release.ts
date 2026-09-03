// ---- RELEASING A PLAYER ----
//
// Owner, v1.2.7: "No way to release a player. You can transfer-list a
// dead-weight contract but never clear it." Every AI club could already do
// it - cap.ts and aiecon.ts cut men loose as free agents every summer - and
// the manager could not. He can now, and it costs what it costs in life:
// the contract is paid off, at half of what was left on it, and the man goes
// into the free-agent pool where anybody (including his old club, later) can
// pick him up.
//
// The one guard that matters is the squad floor. A club is never cut below a
// fieldable size, the same rule the AI's own release paths keep.
import { SEASON_WEEKS, fmtMoney, type GameState } from './model'

/** The senior bodies a club is never cut below by a release. */
export const RELEASE_FLOOR = 24

/** Half of what is left on the contract, week by week, to the end of it. */
export function releaseCost(state: GameState, playerId: number): number {
  const p = state.players[playerId]
  if (!p) return 0
  const weeksLeft = Math.max(1, (p.contractEnds - state.season) * SEASON_WEEKS + (SEASON_WEEKS - state.week))
  return Math.round(weeksLeft * p.wage * 0.5 / 1000) * 1000
}

export type ReleaseBlock = 'notYours' | 'onLoanIn' | 'awayOnLoan' | 'floor' | 'noMoney' | null

/** Why the release button would refuse, or null when it would go through.
 *  The screen reads this to grey the button honestly (the appointBlock rule). */
export function releaseBlock(state: GameState, playerId: number): ReleaseBlock {
  const p = state.players[playerId]
  const club = state.clubs[state.userClubId]
  if (!p || !club || p.clubId !== state.userClubId) return 'notYours'
  if (p.loanFrom) return 'onLoanIn'
  if (p.onLoan) return 'awayOnLoan'
  const seniors = club.players.filter(id => { const q = state.players[id]; return q && !q.acad })
  if (seniors.length <= RELEASE_FLOOR) return 'floor'
  if (club.balance < releaseCost(state, playerId)) return 'noMoney'
  return null
}

/** Pay him off and let him go. Returns the line the screen shows. */
export function releasePlayer(state: GameState, playerId: number): { ok: boolean; msg: string; k: string; v: Record<string, string | number> } {
  const p = state.players[playerId]
  const club = state.clubs[state.userClubId]
  const block = releaseBlock(state, playerId)
  if (block || !p || !club) {
    const k = `player.release${(block ?? 'notYours')[0].toUpperCase()}${(block ?? 'notYours').slice(1)}`
    return { ok: false, msg: k, k, v: { name: p?.name ?? '', n: RELEASE_FLOOR } }
  }
  const cost = releaseCost(state, playerId)
  club.balance -= cost
  club.players = club.players.filter(id => id !== p.id)
  club.tactic.lineup = club.tactic.lineup.map(id => (id === p.id ? null : id))
  if (club.captain === p.id) club.captain = null
  if (club.vice === p.id) club.vice = null
  if (state.devFocus) state.devFocus = state.devFocus.filter(id => id !== p.id)
  p.clubId = null
  p.transferListed = false
  // a released man settles for less, the same 30% the AI's releases take
  p.wage = Math.round(p.wage * 0.7)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `${p.name} released by ${club.name}`,
    body: `${club.name} have released ${p.name} (${p.pos}, ${p.age}) with immediate effect, paying off the remainder of his contract at a cost of ${fmtMoney(cost)}. He is a free agent.`,
    k: 'news.released',
    v: { name: p.name, club: club.name, pos: p.pos, age: p.age, cost: fmtMoney(cost) },
  })
  return { ok: true, msg: 'player.releasedMsg', k: 'player.releasedMsg', v: { name: p.name, cost: fmtMoney(cost) } }
}
