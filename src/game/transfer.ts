// The move itself: executeTransfer, and the money guard it shares with the
// bid flow. Moved out of ai.ts because rivalbids (which ai.ts imports) closes
// its own deals through it; with it here rivalbids no longer imports ai, and
// ai.ts re-exports executeTransfer for every existing caller.
import type { GameState, Player } from './model'
import { absWeek, addGrudge, fmtMoney, isMyClub } from './model'
import { tIn } from './i18n'
import { offerSigning } from './records'
import { transferReaction } from './terraces'
import { aiPayRate } from './aiecon'
import { ensureCaptains } from './analysis'
import { playerWage } from './attributes'
import { clamp } from './rng'
import { book } from './books'
import { identitySigning } from './identity'
import { rememberDeparture } from './memory'
import { saleFelt } from './fallout'

/** Past any legitimate figure in the sport, and far short of losing precision. */
const MONEY_CEILING = 1_000_000_000_000

/**
 * Is this a figure the club can actually act on?
 *
 * Every guard in this file is a comparison, and every comparison with NaN is
 * false. A wage of NaN therefore walked straight through "exceeds your transfer
 * budget", "would break your wage budget" AND "below his demands", executed the
 * transfer, and left both the club balance and the player's wage as NaN for the
 * rest of the save - a save that can never recover, because NaN spreads through
 * every sum it touches. It also filed a signing story reading "£NaN/week".
 *
 * Found by scripts/marketfuzz.ts. The lesson is not "write the comparisons the
 * other way round" - there are a dozen of them and one will always get missed.
 * It is to refuse the figure at the door.
 */
export function realMoney(...vals: number[]): boolean {
  return vals.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MONEY_CEILING)
}

export function executeTransfer(state: GameState, p: Player, toClubId: string, fee: number) {
  // the last line of defence: this is what actually moves the money, and it is
  // reached from the AI paths too, so it refuses a nonsense fee outright rather
  // than trusting every caller to have checked
  if (!realMoney(fee)) return
  const from = p.clubId ? state.clubs[p.clubId] : null
  const to = state.clubs[toClubId]
  // TRANSFER-01 (1.6.5): a destination that does not exist, or is the seller,
  // used to be discovered at `to.players.push` - after the seller had lost the
  // player and banked the fee. Refuse before anything moves.
  if (!to || to === from) return
  if (from) rememberDeparture(state, p, 'sold', from.id, to.id, fee) // memory.ts: only ever the user's club
  p.reqLock = undefined // a request over a broken handshake leaves with him (handshake.ts)
  // read before the move clears it: the terraces judge a departure partly on
  // whether the club had said out loud that he was for sale (terraces.ts)
  const wasListed = !!p.transferListed
  // losing a star you didn't want to sell leaves a mark on the fixture list
  if (from && p.ca >= 80 && !p.transferListed && fee > 0) {
    addGrudge(state, from.id, toClubId, 'news.grudgeTookHim', { player: p.name })
  }
  // a man out on loan comes home before he is sold: the flag used to travel
  // with him to the buyer until the rollover (1.6.3, scripts/qa/p3_loans.ts)
  if (p.onLoan) { p.onLoan = false; p.loanClub = undefined; p.loanSince = undefined }
  // the dressing room's reaction, read while he is still one of them (fallout.ts)
  if (from) saleFelt(state, from, p)
  if (from) {
    from.players = from.players.filter(id => id !== p.id)
    if (from.marquee) from.marquee = from.marquee.filter(id => id !== p.id)
    from.balance += fee
    // the manager's balance sheet carries the fee as a line (books.ts)
    if (from.id === state.userClubId) book(state, 'sales', fee)
    from.budget += Math.round(fee * 0.7)
    from.tactic.lineup = from.tactic.lineup.map(id => (id === p.id ? null : id))
    // the armband doesn't travel: reappoint leaders if he wore it
    if (from.captain === p.id) from.captain = null
    if (from.vice === p.id) from.vice = null
  }
  // a mid-window move voids any pre-contract: the new employer takes over
  const pc = (state.preContracts ?? []).find(x => x.playerId === p.id)
  if (pc) {
    state.preContracts = state.preContracts!.filter(x => x.playerId !== p.id)
    if (pc.toClubId === state.userClubId) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `Pre-contract void: ${p.name}`,
        body: `${p.name} has been sold before his deal expired, and the move voids the pre-contract he signed with you. Your summer signing is off - the lawyers say there is nothing to be done.`,
        k: 'news.preVoid', v: { player: p.name },
        playerId: p.id,
      })
    }
  }
  // a medical joker who moves on is not covering anybody any more (joker.ts)
  p.joker = undefined
  to.players.push(p.id)
  to.balance -= fee
  if (to.id === state.userClubId) book(state, 'buys', -fee)
  to.budget = Math.max(0, to.budget - fee)
  p.clubId = toClubId
  p.morale = clamp(p.morale + 1, 1, 10)
  p.transferListed = false
  p.freeUntil = undefined
  p.debutPending = 'signing'
  // the arrival is stamped: the buy-back gate in agreeFee reads it, and the
  // game-time ledger's availability counter starts fresh at the new club
  p.joinedAt = absWeek(state.season, state.week)
  p.avail = 0
  if (toClubId === state.userClubId) {
    state.mgr.signings += 1
    state.mgr.spent += fee
    // and the biggest cheque of the era goes in the book (records.ts)
    offerSigning(state, p.id, fee)
    p.sc = 100
    identitySigning(state, p, fee) // an academy club's crowd has a view on a big fee (identity.ts)
  }
  // an AI buyer offers what it can pay (aiecon.ts aiPayRate), and a man
  // stepping down to a club that cannot match his wage takes the cut to play
  p.wage = isMyClub(state, toClubId)
    ? Math.max(p.wage, playerWage(p.ca, p.age))
    : Math.round(Math.max(p.wage, playerWage(p.ca, p.age)) * aiPayRate(state, to) / 50) * 50
  p.contractEnds = state.season + 2 + (p.age < 30 ? 1 : 0)
  // a free agent has no selling club, and 'free agency' is a phrase, not a
  // name: it cannot ride in through {from} or it reaches a French screen in
  // English. The clubless case gets its own sentence instead.
  const k = from ? 'news.transferDone' : 'news.transferDoneFree'
  const v: Record<string, string | number> = {
    player: p.name, to: to.name,
    fee: fmtMoney(fee), age: p.age, wage: fmtMoney(p.wage), until: 2026 + p.contractEnds,
  }
  if (from) v.from = from.name
  // SIGNINGS AROUND THE LEAGUE ARE RUCK'S (owner, 1.8.7): a move between two
  // other clubs, or another club signing a free agent, carries the byline. A
  // move the manager's club is party to keeps the neutral voice.
  const theirs = !isMyClub(state, to.id) && !isMyClub(state, from?.id)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `${p.name} joins ${to.name}`,
    body: tIn('en', k, v),
    k, v,
    playerId: p.id,
    ...(theirs ? { src: 'ruck' as const } : {}),
  })
  ensureCaptains(state) // reappoint leaders wherever the move vacated an armband
  // THE TERRACES GET A SAY (terraces.ts). A transfer is the loudest thing a
  // club does between matches and the support had no voice in it at all:
  // selling a man they loved cost nothing, signing one bought nothing, and
  // the dressing room did not so much as look up. All three now move.
  transferReaction(state, p, from?.id ?? null, toClubId, fee, wasListed)
}
