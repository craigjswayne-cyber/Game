// THE HANDSHAKE (owner: "if you say they will play... it should be a
// handshake agreement and if you dont play him next game he will put a
// transfer request in which cant be removed").
//
// "He'll start next week" in the press room is a 'start' pledge on the
// ledger. It falls due at the club's next competitive match actually played
// (friendlies and the development side do not count; a postponed or blank
// week simply waits). Started: kept, and cleared. Not started while fit to
// play: a transfer request that nothing withdraws - not minutes, not talks,
// not a refusal wearing off - and no new contract. It lapses only when he
// leaves the club, which is what reqLock being a club id means. Injured,
// banned or away on Test duty: the promise is void, no penalty.
//
// No rng anywhere: counts and flags read off the state.

import type { GameState, Player, Pledge } from './model'
import { tIn } from './i18n'
import { rememberPromise } from './memory'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Competitive matches the club has played, which is what "the next match"
 *  is counted against. */
export function clubGamesPlayed(state: GameState, clubId: string): number {
  let n = 0
  for (const f of state.fixtures) {
    if (f.played && f.compId !== 'fr' && !f.devSide && (f.homeId === clubId || f.awayId === clubId)) n++
  }
  return n
}

/** The live promise of a start made to this player, if any. */
export function startPromise(state: GameState, p: Player): Pledge | undefined {
  return (state.pledges ?? []).find(pl => pl.kind === 'start' && pl.playerId === p.id && pl.season === state.season)
}

/** A transfer request that cannot be withdrawn, at the club he made it at. */
export function requestLocked(p: Player): boolean {
  return !!p.reqLock && p.reqLock === p.clubId
}

function news(state: GameState, p: Player, k: string) {
  const v = { player: p.name }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v, playerId: p.id,
  })
}

/** Settle one 'start' pledge after the week's matches. True keeps it open. */
export function settleStartPledge(state: GameState, pl: Pledge, p: Player): boolean {
  if (p.onLoan) return false
  const played = clubGamesPlayed(state, state.userClubId) > (pl.baseGames ?? 0)
  const started = p.stats.starts > (pl.baseStarts ?? 0)
  const out = !!p.injury || p.bans > 0 || p.natSquad
  if (played && started) {
    p.morale = clamp(p.morale + 0.4, 1, 10)
    rememberPromise(state, p, true, 'start')
    news(state, p, 'news.startKept')
    return false
  }
  // unavailable and not on the pitch: nobody can hold that against anyone. A
  // man who got on from the bench was fit to start, injured since or not.
  if (out && p.stats.apps === pl.baseApps) {
    news(state, p, 'news.startVoid')
    return false
  }
  if (!played) return true
  p.morale = clamp(p.morale - 1.5, 1, 10)
  p.wantsOut = Math.max(1, state.week)
  p.reqAns = 0
  p.reqLock = p.clubId ?? undefined
  rememberPromise(state, p, false, 'start')
  news(state, p, 'news.startBroke')
  return false
}
