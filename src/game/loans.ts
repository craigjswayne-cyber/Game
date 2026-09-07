// The loan-in market: borrow tomorrow's stars from the big clubs' benches.

import type { GameState, Player } from './model'
import {absWeek, SEASON_WEEKS, leagueTier } from './model'
import { autoSelect } from './matchEngine'
import { t, tIn } from './i18n'
import { clamp, mulberry32 } from './rng'
import { isDerby } from './rivalries'
import { askingPrice, executeTransfer } from './ai'

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

/**
 * ---- ASKING ABOUT A PLAYER WHO IS NOT FOR LOAN ----
 *
 * Owner, 7 Sep: "can you propose to loan players even if they dont have loan
 * available? So you can take younger players and develop them. Rival clubs
 * shouldn't accept this though."
 *
 * loanTargets() is the SHOP WINDOW - the kids a big club has already decided it
 * wants out getting rugby. This is the other conversation: you have watched a
 * nineteen-year-old at a club that never listed him, and you ring up anyway.
 *
 * It is a worse conversation on purpose. You are asking a club to give up a
 * player it had no plans to lose, so the odds start well under the shop window
 * and drop again if he is in their side. What makes it worth having is that the
 * shop window is picked by the game and this is picked by you.
 *
 * AND A RIVAL SIMPLY PUTS THE PHONE DOWN. Not a low chance - none. The game
 * already knows who your rivals are (rivalries.ts, the same map that names the
 * derbies), and no club strengthens the team it most wants to beat.
 */
export function loanApproachable(state: GameState, p: Player): boolean {
  const user = state.clubs[state.userClubId]
  if (!user || !p.clubId || p.clubId === user.id) return false
  if (p.onLoan || p.loanFrom || p.injury || p.natSquad) return false
  // a development loan, so it is a young player or it is nothing
  return p.age <= 23
}

/** Is this an unsolicited approach rather than a pick off the shop window? */
export function isApproach(state: GameState, playerId: number): boolean {
  return !loanTargets(state).some(t => t.id === playerId)
}

/** A rival never lends you anybody, at any price. */
export function loanRival(state: GameState, playerId: number): boolean {
  const p = state.players[playerId]
  if (!p?.clubId) return false
  return isDerby(state.userClubId, p.clubId)
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
    // ASKING ABOUT A MAN THEY NEVER OFFERED. Two separate costs: the approach
    // itself, and whether he is actually playing for them. A squad player they
    // had not thought about is a conversation; a starter is close to a no.
    + (isApproach(state, playerId)
        ? -0.30 - (parent.tactic.lineup.slice(0, 15).includes(p.id) ? 0.25 : 0)
        : 0)
}

export function loanTerms(state: GameState, playerId: number, length: LoanLength, share: number): LoanVerdict {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId || p.clubId === user.id) return { ok: false, k: 'reply.unavailable' }
  const parent = state.clubs[p.clubId]
  if (!parent) return { ok: false, k: 'reply.unavailable' }
  // NOT ON THE SHOP WINDOW IS NO LONGER A CLOSED DOOR (owner, 7 Sep). It is a
  // harder conversation, priced in loanScore - except with a rival, which is
  // not a conversation at all.
  if (isApproach(state, playerId)) {
    if (!loanApproachable(state, p)) return { ok: false, k: 'reply.parentWontLoan' }
    if (loanRival(state, playerId)) return { ok: false, k: 'reply.loanRivalNo', counter: undefined }
  }
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
  const now = absWeek(state.season, state.week)
  parent.players = parent.players.filter(id => id !== p.id)
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === p.id ? null : id))
  user.players.push(p.id)
  p.loanFrom = parent.id
  p.loanUntil = LOAN_LENGTH_WEEKS[length] ? now + LOAN_LENGTH_WEEKS[length] : undefined
  p.loanShare = share
  p.loanCa = p.ca   // what he was worth walking in: the buy option reads it
  // AND WHEN HE WALKED IN. Only executeTransfer stamped this, so a loan arrival
  // left it unset and the buy option's eight-week trial measured against week
  // zero of season zero - which is to say it was no gate at all. He did join
  // the club; the stamp is the truth as much for a loan as for a fee.
  p.joinedAt = now
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
  const now = absWeek(state.season, state.week)
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
  p.loanSince = absWeek(state.season, state.week)
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
  const served = (absWeek(state.season, state.week)) - (p.loanSince ?? 0)
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

/**
 * ---- LOAN TO BUY ----
 *
 * Owner, 7 Sep: "you should also do a loan to buy scheme where if things go
 * well you can offer to buy the player at the value. The team will likely sell
 * unless they think he is crucial to the team moving forward."
 *
 * The loan is the trial, and this is the option at the end of it. You have had
 * him in your building for months, you have seen him every week, and the fuzz
 * the scouting system puts over a stranger's rating is long gone - so the price
 * is his honest asking price rather than a negotiation. What you are buying is
 * the certainty, and you pay for it.
 *
 * THE PARENT USUALLY SAYS YES, because a club that lent a boy out for a season
 * has already told you what it thinks of him. It says no when he is CRUCIAL,
 * and crucial has to mean something specific or it means nothing:
 *
 *   - he is in their best fifteen, or
 *   - he has grown into a better player than the one they lent you, and is
 *     young enough that they would be selling their own future.
 *
 * "Grown" is measured against the rating he arrived with, which the loan
 * records. That is the honest version of the owner's "if things go well": a boy
 * who did nothing at your club is one they will happily cash in, and the one
 * who tore the league up is the one they suddenly remember they own.
 */
export const LOAN_BUY_MIN_WEEKS = 8

export interface LoanBuy {
  /** what it would take, whether or not they would take it */
  fee: number
  /** WOULD THEY SELL? The parent club's own answer, and nothing to do with
   *  whether you can pay. Kept apart from `ok` because "they will not sell him"
   *  and "you cannot afford him" are opposite problems - one you plan around,
   *  the other you save up for - and a single no told the manager neither. */
  willing: boolean
  /** would they sell AND can you pay AND has he been here long enough */
  ok: boolean
  k: string
}

export function loanBuyOffer(state: GameState, playerId: number): LoanBuy | null {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !user) return null
  if (!p.loanFrom || p.clubId !== user.id) return null
  const parent = state.clubs[p.loanFrom]
  if (!parent) return null
  const fee = askingPrice(state, p)
  // a trial is weeks of rugby, not a signature and a change of mind
  // CRUCIAL TO THEM, decided first and on its own. In the two ways that can be
  // checked rather than asserted: he is in their side, or the months here made
  // him into a player they would be selling their own future to let go.
  const inTheirXV = parent.tactic.lineup.slice(0, 15).includes(p.id)
  const outgrewThem = p.ca >= (p.loanCa ?? p.ca) + 4 && p.age <= 22 && p.pa >= 78
  const willing = !inTheirXV && !outgrewThem
  // an old save's loan carries no stamp, and the honest reading of "no record
  // of him arriving" is that the trial has not been served, not that it has
  if (p.joinedAt == null) return { fee, willing, ok: false, k: 'reply.loanBuyTooSoon' }
  const served = (absWeek(state.season, state.week)) - p.joinedAt
  if (served < LOAN_BUY_MIN_WEEKS) return { fee, willing, ok: false, k: 'reply.loanBuyTooSoon' }
  if (!willing) return { fee, willing, ok: false, k: 'reply.loanBuyCrucial' }
  // and only once they have said yes does the money become the question
  if (user.budget < fee) return { fee, willing, ok: false, k: 'reply.loanBuyNoFunds' }
  return { fee, willing, ok: true, k: 'reply.loanBuyAgreed' }
}

/** Take up the option. The loan ends the moment the fee clears. */
export function loanBuy(state: GameState, playerId: number): { ok: boolean; k: string; fee: number } {
  const p = state.players[playerId]
  const offer = loanBuyOffer(state, playerId)
  if (!p || !offer) return { ok: false, k: 'reply.unavailable', fee: 0 }
  if (!offer.ok) return { ok: false, k: offer.k, fee: offer.fee }
  const parent = state.clubs[p.loanFrom!]
  // he is ALREADY on the user's roster while on loan, so the parent has to be
  // put back on the deed before the transfer moves him properly - otherwise
  // executeTransfer takes him off a squad he is not in and the fee goes
  // nowhere. The loan is unwound first, then the sale happens for real.
  const user = state.clubs[state.userClubId]
  user.players = user.players.filter(id => id !== p.id)
  user.tactic.lineup = user.tactic.lineup.map(id => (id === p.id ? null : id))
  parent.players.push(p.id)
  p.clubId = parent.id
  p.loanFrom = null
  p.loanUntil = undefined
  p.loanShare = undefined
  p.loanCa = undefined
  executeTransfer(state, p, state.userClubId, offer.fee)
  return { ok: true, k: 'reply.loanBuyAgreed', fee: offer.fee }
}
