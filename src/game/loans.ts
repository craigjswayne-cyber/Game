// The loan-in market: borrow tomorrow's stars from the big clubs' benches.

import type { GameState, Player } from './model'
import { SEASON_WEEKS, leagueTier } from './model'
import { autoSelect } from './matchEngine'
import { t, tIn } from './i18n'
import { clamp, mulberry32 } from './rng'

/** Young talent parked on big-club benches, available for a season's loan. */
export function loanTargets(state: GameState): Player[] {
  const user = state.clubs[state.userClubId]
  return Object.values(state.players)
    .filter(p => {
      if (!p.clubId || p.clubId === user.id || p.onLoan || p.loanFrom) return false
      const parent = state.clubs[p.clubId]
      if (!parent || parent.rep < user.rep + 4) return false
      if (p.age > 23 || p.ca < 60 || p.ca > 80) return false
      if (p.injury || p.natSquad) return false
      // LOAN GRAVITY (user, at Esher: "ive been able to loan some huge
      // players... unrealistic that they would take such a step down. the odd
      // few may for game time but realistically it would be more championship
      // players"). The reputation test alone let a third-tier club borrow off
      // Premier Division benches - at rep 38 EVERY club in the world passed it, and
      // the top-12-by-potential sort handed Esher the biggest wonderkids in
      // the game. A player steps down at most one division freely; two is the
      // odd few - 21 or under, desperate for game time, behind a per-player
      // deterministic gate so the same save always meets the same odd few.
      const drop = leagueTier(user.leagueId) - leagueTier(parent.leagueId)
      if (drop >= 2) {
        if (p.age > 21) return false
        if (mulberry32(state.seed + p.id * 13 + state.season * 31)() >= 0.25) return false
      }
      // he's behind the queue at home: not in the parent's best XV
      return !parent.tactic.lineup.slice(0, 15).includes(p.id)
    })
    .sort((a, b) => b.pa - a.pa)
    // "the odd few" is a count, not just a filter: the potential sort ranks
    // any surviving top-flight kid above every Championship name, so without
    // a cap the list was still eleven wonderkids and one honest borrow. Two
    // big-drop names at a time; the rest of the room is the division above.
    .reduce<Player[]>((out, p) => {
      if (out.length >= 12) return out
      const drop = leagueTier(user.leagueId) - leagueTier(state.clubs[p.clubId!].leagueId)
      if (drop >= 2 && out.filter(q =>
        leagueTier(user.leagueId) - leagueTier(state.clubs[q.clubId!].leagueId) >= 2).length >= 2) return out
      out.push(p)
      return out
    }, [])
}

/** Bring him in until the end of the season. Parent pays half the wage. */
/** How long a loan-in runs: a quarter, a half, or the rest of the season. */
export type LoanLength = 'short' | 'half' | 'season'
export const LOAN_LENGTHS: LoanLength[] = ['short', 'half', 'season']
export const LOAN_SHARES = [0.25, 0.5, 0.75, 1] as const
export const LOAN_LENGTH_WEEKS: Record<LoanLength, number> = { short: 13, half: 26, season: 0 }

/**
 * ---- A LOAN IS NEGOTIATED, NOT COLLECTED (owner, v1.2.8) ----
 *
 * "loan deals, you should have to negotiate. 3 months, 6 months or til the end
 * of the summer. How much of their wages will you pay. Variety on what would
 * be accepted."
 *
 * The parent club weighs three things: how much of the wage it is left paying,
 * how long it gets the man out of its own way, and how far above you it sits.
 * A season at full wages is nearly always yes; three months at a quarter of
 * the bill nearly always no; the middle is where the game is. One roll per
 * player per week, from the world's own seed, so asking the same question
 * twice in a week gets the same answer and a BETTER offer is what changes it.
 * A refusal names the lever that would have turned it.
 */
export interface LoanVerdict {
  ok: boolean
  /** the reply's key */
  k: string
  /** the lever the parent would have needed, on a refusal */
  counter?: { length?: LoanLength; share?: number }
}

export function loanScore(state: GameState, playerId: number, length: LoanLength, share: number): number {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  const parent = p?.clubId ? state.clubs[p.clubId] : null
  if (!p || !parent) return 0
  const gap = parent.rep - user.rep // the parent is always at least 4 above (loanTargets)
  return 0.32
    + (share - 0.5) * 0.9                                          // who pays: the biggest lever
    + (length === 'season' ? 0.16 : length === 'half' ? 0.04 : -0.14) // a long loan clears the wage bill longer
    + Math.min(0.12, Math.max(0, gap - 4) * 0.012)                  // a much bigger club farms out freely
    + (p.age <= 21 ? 0.05 : 0)                                      // a boy needs the rugby
}

export function loanTerms(state: GameState, playerId: number, length: LoanLength, share: number): LoanVerdict {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId || p.clubId === user.id) return { ok: false, k: 'reply.unavailable' }
  const parent = state.clubs[p.clubId]
  if (!parent) return { ok: false, k: 'reply.unavailable' }
  if (!loanTargets(state).some(t => t.id === playerId)) return { ok: false, k: 'reply.parentWontLoan' }
  if (p.pers === 'Mercenary' && p.morale < 5) return { ok: false, k: 'reply.agentWantsPermanent' }
  const score = clamp(loanScore(state, playerId, length, share), 0.04, 0.96)
  const roll = mulberry32(state.seed + p.id * 7 + state.season * 97 + state.week * 13)()
  if (roll < score) return { ok: true, k: 'reply.joinsOnLoan' }
  // which lever would have carried it? the cheapest one that clears the roll
  for (const s of LOAN_SHARES) if (s > share && clamp(loanScore(state, playerId, length, s), 0.04, 0.96) > roll) return { ok: false, k: 'reply.loanCounterShare', counter: { share: s } }
  for (const l of LOAN_LENGTHS) if (LOAN_LENGTH_WEEKS[l] === 0 || LOAN_LENGTH_WEEKS[l] > LOAN_LENGTH_WEEKS[length]) {
    if (l !== length && clamp(loanScore(state, playerId, l, share), 0.04, 0.96) > roll) return { ok: false, k: 'reply.loanCounterLength', counter: { length: l } }
  }
  return { ok: false, k: 'reply.loanRefused' }
}

export function loanIn(state: GameState, playerId: number, length: LoanLength = 'season', share = 0.5): string {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId || p.clubId === user.id) return t('reply.unavailable')
  const parent = state.clubs[p.clubId]
  if (!parent) return t('reply.unavailable')
  const seniors = user.players.filter(id => state.players[id] && !state.players[id].acad).length
  if (seniors >= 46) return t('reply.seniorSquadFull')
  const verdict = loanTerms(state, playerId, length, share)
  if (!verdict.ok) {
    return t(verdict.k, {
      club: parent.short, player: p.name,
      share: Math.round((verdict.counter?.share ?? share) * 100),
      len_k: `transfers.loanLen${cap1(verdict.counter?.length ?? length)}`,
    })
  }
  const now = state.season * SEASON_WEEKS + state.week
  parent.players = parent.players.filter(id => id !== p.id)
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === p.id ? null : id))
  user.players.push(p.id)
  p.loanFrom = parent.id
  p.loanUntil = LOAN_LENGTH_WEEKS[length] ? now + LOAN_LENGTH_WEEKS[length] : undefined
  p.loanShare = share
  p.clubId = user.id
  p.morale = clamp(p.morale + 1, 1, 10)
  p.sc = 100
  p.avail = 0
  p.debutPending = 'signing'
  const pct = Math.round((1 - share) * 100)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `Loan signing: ${p.name} arrives from ${parent.short}`,
    body: `${p.name} (${p.age}, ${p.pos}) joins on loan ${tIn('en', `transfers.loanLen${cap1(length)}`).toLowerCase()}. ${parent.short} cover ${pct}% of his wage - they want him playing, so play him.`,
    k: 'news.loanIn', v: { player: p.name, age: p.age, pos: p.pos, parent: parent.short, len_k: `transfers.loanLen${cap1(length)}`, share: pct },
    playerId: p.id,
  })
  parent.tactic.lineup = autoSelect(state, parent.players.map(id => state.players[id]).filter(Boolean))
  return t('reply.joinsOnLoan', { player: p.name, len_k: `transfers.loanLen${cap1(length)}`, share: Math.round(share * 100) })
}

const cap1 = (s: string) => s[0].toUpperCase() + s.slice(1)

/**
 * A loan-in goes home. Called at the rollover for every loan that ran to the
 * end of the season, and from the weekly settle for one struck to a date
 * (v1.2.8). The man grows a little from the rugby he got, and the inbox says
 * he has gone.
 */
export function returnLoanIn(state: GameState, p: Player, rng: () => number, week = state.week): void {
  if (!p.loanFrom || !state.clubs[p.loanFrom]) return
  const user = state.clubs[state.userClubId]
  user.players = user.players.filter(id => id !== p.id)
  user.tactic.lineup = user.tactic.lineup.map(id => (id === p.id ? null : id))
  if (user.captain === p.id) user.captain = null
  if (user.vice === p.id) user.vice = null
  state.clubs[p.loanFrom].players.push(p.id)
  p.clubId = p.loanFrom
  p.loanFrom = null
  p.loanUntil = undefined
  p.loanShare = undefined
  if (p.ca < p.pa) p.ca = clamp(p.ca + 1 + Math.floor(rng() * 3), 1, p.pa)
  state.news.push({
    id: state.nextId++, week, season: state.season, type: 'transfer', read: false,
    subject: `${p.name} returns to ${state.clubs[p.clubId]?.short} after his loan`,
    body: `The loan is over. ${p.name} heads back to his parent club having grown from the rugby you gave him.`,
    k: 'news.loanEnds', v: { player: p.name, club: state.clubs[p.clubId]?.short ?? '' },
    playerId: p.id,
  })
}

/** The loan-ins whose date has come. Run from the weekly settle. */
export function expireLoans(state: GameState, rng: () => number): void {
  const now = state.season * SEASON_WEEKS + state.week
  for (const p of Object.values(state.players)) {
    if (p.loanFrom && p.clubId === state.userClubId && p.loanUntil != null && now >= p.loanUntil) returnLoanIn(state, p, rng)
  }
}

export function loanOut(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  if (!p) return { ok: false, msg: 'No such player.' }
  if (p.clubId !== state.userClubId) return { ok: false, msg: 'He is not yours to send anywhere.' }
  if (p.onLoan) return { ok: false, msg: `${p.name} is already out on loan.` }
  if (p.loanFrom) return { ok: false, msg: `${p.name} is here on loan himself.` }
  if (p.age > 23) return { ok: false, msg: `${p.name} is past the age where a loan teaches him anything.` }
  const club = state.clubs[state.userClubId]
  if (club?.tactic.lineup.slice(0, 15).includes(p.id)) {
    return { ok: false, msg: `${p.name} is in your starting XV. Drop him first if you mean it.` }
  }
  p.onLoan = true
  p.loanSince = state.season * SEASON_WEEKS + state.week
  // a NAMED feeder club (round 25, user: "say what club they are playing
  // for"): a real lower-tier side, picked deterministically per player, so
  // every postcard about him can say where he is. Cosmetic - he does not
  // appear in their fixtures - but a loan to Bedford reads like a loan.
  const feeders = Object.values(state.clubs)
    .filter(c => c.rep <= (club?.rep ?? 60) - 15 && c.id !== state.userClubId)
    .sort((a, b) => a.id.localeCompare(b.id))
  const feeder = feeders.length ? feeders[Math.floor(mulberry32(state.seed + p.id * 7)() * feeders.length)] : null
  p.loanClub = feeder?.id
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: true,
    subject: `${p.name} heads out on loan`,
    body: `${p.name} joins ${feeder ? feeder.name : 'a feeder club'} for the rest of the season. Regular first-team rugby should accelerate his development - expect him back sharper next summer.`,
    k: 'news.loanOut', v: { player: p.name, club: feeder?.name ?? tIn('en', 'news.aFeederClub') },
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} will spend the season on loan${feeder ? ` at ${feeder.name}` : ''}. He returns next summer, better for it.` }
}

/**
 * Bring a loaned-out player home early (16B, user: "they should also be able
 * to be recalled at any point").
 *
 * He comes back match-fit - he has been playing every week - but the education
 * is cut short: the full summer development bonus only pays for a full season
 * served. Half a season or more earns a single point of it now; less earns
 * nothing but the body. Deterministic, no rng.
 */
export function loanRecall(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  if (!p) return { ok: false, msg: 'No such player.' }
  if (p.clubId !== state.userClubId) return { ok: false, msg: 'He is not yours to recall.' }
  if (!p.onLoan) return { ok: false, msg: `${p.name} is not out on loan.` }
  // A LOAN IS WEEKS OF RUGBY, NOT A BUTTON.
  //
  // Out and straight back was a free reset of condition, sharpness and rust,
  // and past week 20 a free point of CA - with no cooldown and both buttons on
  // the same screen. Measured before this: 200 cycles took one under-23 from
  // 65 to his ceiling of 76, and cycling the under-23s in the 23 before every
  // match was worth +3.1 points a match and took the win rate from 49% to 62%.
  // It also bypassed the whole development pillar - academy, mentoring,
  // facilities, minutes - that the rest of the game is built on.
  //
  // So the recall now reads how long he was actually away.
  const served = (state.season * SEASON_WEEKS + state.week) - (p.loanSince ?? 0)
  if (served < 4) {
    const left = 4 - served
    return {
      ok: false,
      msg: `${p.name} has only just walked through their door. The feeder club expect him to play some rugby before you change your mind - give it ${left} more week${left === 1 ? '' : 's'}.`,
    }
  }
  p.onLoan = false
  p.loanClub = undefined
  p.loanSince = undefined
  // he comes back as fit as the rugby he played, not as fit as the tap
  const weeks = Math.min(20, served)
  p.cond = Math.max(p.cond, 60 + weeks * 1.5)
  p.sharp = Math.max(p.sharp ?? 60, 55 + weeks * 1.5)
  p.rust = Math.max(0, (p.rust ?? 0) - Math.floor(weeks / 4))
  // and the point of development needs most of a season served, not a date on
  // the calendar: week >= 20 paid a man sent out in week 19 for one week away
  const halfServed = served >= 18
  if (halfServed && p.ca < p.pa) p.ca += 1
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'youth', read: true,
    subject: `🧳 ${p.name} recalled from loan`,
    body: halfServed
      ? `${p.name} (${p.pos}, ${p.age}) is back in the building, match-fit from weekly rugby and visibly improved by the months away. The feeder club are sorry to lose him, which is the best reference there is.`
      : `${p.name} (${p.pos}, ${p.age}) is back in the building, match-fit from weekly rugby. The move home this early cuts the education short - the development the loan promised needed the season to pay in full.`,
    k: halfServed ? 'news.recalledFull' : 'news.recalledEarly',
    v: { player: p.name, pos: p.pos, age: p.age },
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} reports back to training in the morning.` }
}
