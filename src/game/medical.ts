// The physio room's two levers: buy a specialist opinion on a bad injury,
// or wrap a returning player in cotton wool for a week.

import type { GameState } from './model'
import { clamp, mulberry32 } from './rng'

export const SPECIALIST_FEE = 50_000

/** One-time paid consult per injury: always cuts a fifth off the remaining lay-off. */
export function specialistConsult(state: GameState, pid: number): string {
  const p = state.players[pid]
  const club = state.clubs[state.userClubId]
  if (!p?.injury) return 'He is not injured.'
  if (p.specialist) return 'He has already seen the specialist for this injury.'
  if (p.injury.until - state.week < 3) return 'He is too close to returning - a consult would change nothing.'
  if (club.balance < SPECIALIST_FEE) return 'The club cannot afford the consult right now.'
  club.balance -= SPECIALIST_FEE
  p.specialist = true
  // A PAID CONSULT DOES SOMETHING, EVERY TIME (user: "if you hit specialist
  // button it should speed up the recovery by 20%"). It was a 55% coin flip
  // for one or two weeks, which meant paying six figures for "no shortcuts on
  // this one" nearly half the time - a button that sometimes does nothing
  // teaches you not to press it. A fifth off the REMAINING lay-off, at least
  // a week, always.
  {
    const left = p.injury.until - state.week
    const cut = Math.max(1, Math.round(left * 0.2))
    p.injury.until = Math.max(state.week + 1, p.injury.until - cut)
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'injury', read: false,
      subject: `🩺 Specialist verdict: ${p.name} ahead of schedule`,
      body: `The consultant found a better rehab route for ${p.name}'s ${p.injury.desc}. He should be back ${cut} week${cut > 1 ? 's' : ''} earlier than feared.`,
      k: 'news.specialist', v: { player: p.name, injury_k: p.injury.dk ?? 'common.nothing', n: cut },
      playerId: p.id,
    })
    return `${p.name} responds brilliantly - back ${cut} week${cut > 1 ? 's' : ''} earlier.`
  }
}

/** One player per week can be rested through his rust safely. */
export function cottonWool(state: GameState, pid: number): string {
  const abs = state.season * 100 + state.week
  if (state.cottonWk === abs) return 'The physio room can only wrap one man per week.'
  const p = state.players[pid]
  if (!p || (p.rust ?? 0) <= 0) return 'He does not need wrapping.'
  state.cottonWk = abs
  p.rust = Math.max(0, (p.rust ?? 1) - 1)
  p.cond = clamp(p.cond + 12, 20, 100)
  return `${p.name} spends the week in cotton wool - ${(p.rust ?? 0) === 0 ? 'rust cleared, ' : ''}legs freshened.`
}
