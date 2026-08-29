import type { GameState, Player } from './model'
import { t, tIn, type Vars } from './i18n'
import { clubIntent } from './living'
import { userCap, userWageBudget } from './grants'
import { offerSigning } from './records'
import { transferReaction } from './terraces'
import { SEASON_WEEKS, addGrudge, fmtMoney, fmtWage } from './model'
import { ensureCaptains } from './analysis'
import { rivalsOf } from './rivalries'
import { playerValue, playerWage } from './attributes'
import { clamp, mulberry32, pick, type Rng } from './rng'

// ------------------------------------------------------------------
// Transfer market
// ------------------------------------------------------------------

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
function realMoney(...vals: number[]): boolean {
  return vals.every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MONEY_CEILING)
}

/** The refusal a nonsense figure gets, in words a player can read. */
const NOT_A_FIGURE = { ok: false as const, msg: 'That is not a figure the club can put its name to.' }

/**
 * The division's weekly wage ceiling, or null where there is none.
 *
 * Read straight off the state rather than through game/cap.ts, because that
 * module reads capBill() from here and importing it back would be a cycle. The
 * ceiling itself is measured and stored there; this is only the lookup.
 */
function capOf(state: GameState, clubId: string): number | null {
  const lg = state.clubs[clubId]?.leagueId
  const cap = lg ? state.caps?.[lg] : null
  // userCap is the till's one adjustment (v1.1.0, grants.ts) - shared with
  // capPosition so the negotiating table and the Finances bar read the same
  // ceiling for a Charter or an injection's wage allowance, and the AI's own
  // law never moves
  return userCap(state, clubId, typeof cap === 'number' && Number.isFinite(cap) && cap > 0 ? cap : null)
}

/** Would this weekly wage break the cap? The sentence to show, or null. */
function capBreak(state: GameState, clubId: string, wage: number, replacing = 0): string | null {
  const cap = capOf(state, clubId)
  if (cap == null) return null
  const club = state.clubs[clubId]
  const after = capBill(state, club) - replacing + wage
  if (after <= cap) return null
  return t('reply.overCap', { over: fmtMoney(after - cap), cap: fmtMoney(cap) })
}

/** Is the club barred from signing anybody for a cap breach? */
function embargoed(state: GameState, clubId: string): boolean {
  const until = state.clubs[clubId]?.capEmbargoUntil
  return typeof until === 'number' && state.season <= until
}

/** Asking price for a player from his current club's perspective. */
export function askingPrice(state: GameState, p: Player): number {
  const club = p.clubId ? state.clubs[p.clubId] : null
  if (!club) return 0
  let f = 1.15
  if (p.transferListed) f = 0.8
  const squadCa = club.players.map(id => state.players[id]?.ca ?? 0).sort((a, b) => b - a)
  const isKey = p.ca >= (squadCa[7] ?? 70) // top-8 player at the club
  if (isKey && !p.transferListed) f = 1.7
  if (p.morale <= 3.5) f *= 0.85
  return Math.round((p.value * f) / 10_000) * 10_000
}

/**
 * How badly does his club want him off the wage bill, and why?
 *
 * Asked because of a live report: "trying to haggle with a team for a signing but
 * they keep saying asking price. Would they ever accept under?" They would not,
 * in any meaningful sense. The accept threshold was `counterPrice - 50_000` - a
 * FLAT fifty grand, whatever the size of the deal. That is 2.5% off a two-million
 * bid and 0.25% off a twenty-million one, so haggling was theatre.
 *
 * Circumstances did feed into the ASKING price already (transfer-listed knocked
 * 20% off, a miserable player 15%), but nothing fed into what a club would
 * SETTLE for. A man rotting in the reserves in the last year of his contract cost
 * the same to prise out as a happy first-choice starter.
 *
 * So: a discount a selling club will actually take, built from the things that
 * genuinely weaken a seller's hand, and REPORTED so haggling is informed rather
 * than a guessing game. The base case - a wanted man, playing, under contract, at
 * a solvent club - still gets you nothing off, which is what keeps the market and
 * the salary cap where they were calibrated.
 */
export interface Willingness {
  /** fraction off the asking price the club would accept, 0 to MAX_HAGGLE */
  discount: number
  /** fraction ON TOP of the asking price before they will even nod (owner,
   *  v1.1.3: "signing players from the same league should be tricky as its a
   *  competitive edge"). Selling abroad loses a player; selling inside your
   *  own league arms the club you meet twice a season, and a derby rival is
   *  the club whose fans you answer to. So a same-league buyer pays over the
   *  odds and a derby rival pays silly money - the discount reasons still
   *  apply (a club in the red is in the red whoever is asking), which is why
   *  this is a separate term rather than a clamp on the discount. */
  premium: number
  /** why, in the READER's language, most persuasive first: a key and the vars
   *  it needs, because the player profile renders these straight to the screen
   *  and an English string here is an English line on a French page */
  reasons: { k: string; v?: Vars }[]
}

/** The most any club will ever come down, however desperate. A club that would
 *  take a third off is a club giving players away, and the squad you could
 *  assemble on those terms is not the squad the cap was balanced against. */
export const MAX_HAGGLE = 0.3

export function sellerWillingness(state: GameState, p: Player): Willingness {
  const club = p.clubId ? state.clubs[p.clubId] : null
  if (!club) return { discount: 0, premium: 0, reasons: [] }
  let d = 0
  const reasons: { k: string; v?: Vars }[] = []

  // OUT OF CONTRACT is the strongest hand a buyer has: lose him in the summer
  // and they get nothing at all, so a fee now is a fee they nearly lost.
  const yearsLeft = (p.contractEnds ?? state.season) - state.season
  if (yearsLeft <= 0) { d += 0.18; reasons.push({ k: 'player.sellOutOfContract' }) }
  else if (yearsLeft === 1) { d += 0.07; reasons.push({ k: 'player.sellYearLeft' }) }

  // NOT PLAYING. Compared with the rest of the senior squad rather than an
  // absolute, because a bit-part player at Toulouse still plays more rugby than
  // a starter in the Championship.
  const mins = p.stats.mins ?? 0
  const squad = club.players.map(id => state.players[id]).filter(x => x && !x.youth)
  const played = squad.map(x => x!.stats.mins ?? 0).sort((a, b) => b - a)
  const median = played.length ? played[Math.floor(played.length / 2)] : 0
  if (median > 200 && mins < median * 0.4) {
    d += 0.09
    reasons.push({ k: 'player.sellBarelyPlayed' })
  }

  // HE WANTS OUT, or at least is not enjoying himself
  if (p.transferListed) { d += 0.06; reasons.push({ k: 'player.sellListed' }) }
  if (p.morale <= 3.5) { d += 0.06; reasons.push({ k: 'player.sellUnhappy' }) }

  // THE CLUB NEEDS THE MONEY. A club in the red will take a deal it would
  // otherwise refuse, which is the oldest transfer-market truth there is.
  if (club.balance < 0) { d += 0.08; reasons.push({ k: 'player.sellInRed', v: { club: club.short } }) }

  // THEY HAVE PLENTY MORE. Three better men in his position and he is surplus.
  const better = squad.filter(x => x!.id !== p.id && x!.pos === p.pos && x!.ca >= p.ca).length
  if (better >= 3) { d += 0.06; reasons.push({ k: 'player.sellStocked' }) }

  // AN AGEING ASSET is worth less to them next year than this year
  if (p.age >= 33) { d += 0.05; reasons.push({ k: 'player.sellAgeing' }) }

  // SELLING INSIDE THE LEAGUE ARMS A RIVAL. This is the buyer's problem, not
  // the seller's - the discounts above are about the seller's own position and
  // stand whoever is asking - so it is a premium on top rather than a smaller
  // discount: a club in the red still needs the money, it just wants more of
  // it from a club it has to beat in April. A derby rival dearer again,
  // because that sale is the one the fans never forgive.
  let premium = 0
  const buyer = state.clubs[state.userClubId]
  if (buyer && club.id !== buyer.id && club.leagueId === buyer.leagueId) {
    premium = rivalsOf(club.id).includes(buyer.id) ? 0.35 : 0.2
  }

  return { discount: Math.min(MAX_HAGGLE, d), premium, reasons }
}

/** The lowest fee his club would shake hands on. Can sit ABOVE the asking
 *  price: a same-league buyer pays the rival premium on top of whatever the
 *  seller's own weaknesses take off (v1.1.3). */
export function floorPrice(state: GameState, p: Player): number {
  const ask = askingPrice(state, p)
  const { discount, premium } = sellerWillingness(state, p)
  // still rounded to a clean figure, because a counter of £1,847,300 reads like
  // a spreadsheet rather than a negotiation
  return Math.round((ask * (1 + premium - discount)) / 50_000) * 50_000
}

export function executeTransfer(state: GameState, p: Player, toClubId: string, fee: number) {
  // the last line of defence: this is what actually moves the money, and it is
  // reached from the AI paths too, so it refuses a nonsense fee outright rather
  // than trusting every caller to have checked
  if (!realMoney(fee)) return
  const from = p.clubId ? state.clubs[p.clubId] : null
  const to = state.clubs[toClubId]
  // read before the move clears it: the terraces judge a departure partly on
  // whether the club had said out loud that he was for sale (terraces.ts)
  const wasListed = !!p.transferListed
  // losing a star you didn't want to sell leaves a mark on the fixture list
  if (from && p.ca >= 80 && !p.transferListed && fee > 0) {
    addGrudge(state, from.id, toClubId, 'news.grudgeTookHim', { player: p.name })
  }
  if (from) {
    from.players = from.players.filter(id => id !== p.id)
    from.balance += fee
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
  to.players.push(p.id)
  to.balance -= fee
  to.budget = Math.max(0, to.budget - fee)
  p.clubId = toClubId
  p.morale = clamp(p.morale + 1, 1, 10)
  p.transferListed = false
  p.debutPending = 'signing'
  // the arrival is stamped: the buy-back gate in agreeFee reads it, and the
  // game-time ledger's availability counter starts fresh at the new club
  p.joinedAt = state.season * SEASON_WEEKS + state.week
  p.avail = 0
  if (toClubId === state.userClubId) {
    state.mgr.signings += 1
    state.mgr.spent += fee
    // and the biggest cheque of the era goes in the book (records.ts)
    offerSigning(state, p.id, fee)
    p.sc = 100
  }
  p.wage = Math.max(p.wage, playerWage(p.ca, p.age))
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
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `${p.name} joins ${to.name}`,
    body: tIn('en', k, v),
    k, v,
    playerId: p.id,
  })
  ensureCaptains(state) // reappoint leaders wherever the move vacated an armband
  // THE TERRACES GET A SAY (terraces.ts). A transfer is the loudest thing a
  // club does between matches and the support had no voice in it at all:
  // selling a man they loved cost nothing, signing one bought nothing, and
  // the dressing room did not so much as look up. All three now move.
  transferReaction(state, p, from?.id ?? null, toClubId, fee, wasListed)
}

/** Weekly AI transfer activity + bids for user players. */
export function aiTransfers(state: GameState, rng: Rng) {
  const clubs = Object.values(state.clubs)

  // squad-building intent. Real moves are concentrated in the windows:
  // early season (weeks 1-4) and the mid-season deadline (23-24) are
  // busy; the rest of the season is a trickle - rumours do the talking.
  const deadline = state.week === 7 || state.week === 26 || state.week === 27
  const window = state.week <= 7 || deadline
  for (let k = 0; k < (deadline ? 5 : 2); k++) {
    if (rng() > (deadline ? 0.6 : window ? 0.35 : 0.1)) continue
    const buyer = pick(rng, clubs)
    if (buyer.id === state.userClubId || buyer.budget < 800_000) continue
    // find thinnest position by count of quality bodies
    const byPos: Record<string, number> = {}
    for (const id of buyer.players) {
      const p = state.players[id]
      if (p && p.ca >= 68) byPos[p.pos] = (byPos[p.pos] ?? 0) + 1
    }
    const NEED_MIN: Record<string, number> = { LP: 2, HK: 2, TP: 2, LK: 3, FL: 3, N8: 2, SH: 2, FH: 2, CE: 3, WG: 3, FB: 2 }
    const need = Object.entries(NEED_MIN).find(([pos, min]) => (byPos[pos] ?? 0) < min)?.[0]
    if (!need) continue
    // WHAT THIS CLUB IS ACTUALLY TRYING TO DO (living.ts). Without it a hundred
    // clubs behave like one club with a hundred names: thinnest position, best
    // body available, every time. A rebuilding side will not buy a thirty-year-
    // old and a side going for it will not settle for a squad man.
    const intent = clubIntent(state, buyer)
    if (intent === 'breakup') continue // they are selling, not shopping
    const targets = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== buyer.id && p.clubId !== state.userClubId &&
      p.pos === need && p.ca >= (intent === 'allin' ? 76 : 70) && !p.onLoan && !p.loanFrom &&
      (intent === 'rebuild' ? p.age <= 25 : true) &&
      (state.clubs[p.clubId]?.rep ?? 99) <= buyer.rep + 6 &&
      askingPrice(state, p) <= buyer.budget)
      // a rebuilding club buys for the future, everybody else buys the best now
      .sort((a, b) => intent === 'rebuild' ? (b.pa - a.pa) || (b.ca - a.ca) : b.ca - a.ca)
    const p = targets[0]
    if (p && rng() < (intent === 'allin' ? 0.75 : 0.6)) executeTransfer(state, p, buyer.id, askingPrice(state, p))
  }

  // unsettled/listed players move - mostly in the windows
  for (let k = 0; k < 2; k++) {
    if (rng() > (window ? 0.35 : 0.12)) continue
    const buyer = pick(rng, clubs)
    if (buyer.id === state.userClubId || buyer.budget < 200_000) continue
    const targets = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== buyer.id && p.clubId !== state.userClubId &&
      !p.loanFrom && !p.retiring && (p.transferListed || p.morale < 4 || p.contractEnds <= state.season) &&
      p.ca >= 62 && askingPrice(state, p) <= buyer.budget)
    if (!targets.length) continue
    const p = pick(rng, targets)
    const fee = askingPrice(state, p)
    const seller = state.clubs[p.clubId!]
    if (seller && rng() < 0.75) executeTransfer(state, p, buyer.id, fee)
  }

  // AI bids for user players: a trickle in normal weeks, a feeding frenzy
  // on deadline day - several bids can land at once, at panic premiums
  for (let k = 0; k < (deadline ? 3 : 1); k++) {
    if (rng() > (deadline ? 0.55 : 0.3)) continue
    const user = state.clubs[state.userClubId]
    const squad = user.players.map(id => state.players[id]).filter(Boolean)
    const wanted = squad.filter(p => !p.loanFrom).filter(p => p.transferListed || p.morale <= 4 ||
      // a handed-in transfer request is a flare over the training ground:
      // every agent in the league knows he is gettable (gametime.ts, 17A)
      (p.wantsOut ?? 0) > 0 ||
      ((p.wantsDeal ?? 0) > 0 && state.week - (p.wantsDeal ?? 0) >= 4 && rng() < 0.3) ||
      (p.ca >= 82 && rng() < (p.pers === 'Ambitious' || p.pers === 'Mercenary' ? 0.4 : 0.2)))
    if (!wanted.length) continue
    const p = pick(rng, wanted)
    if (state.offers.some(o => o.playerId === p.id && o.status === 'pending')) continue
    const bidders = clubs.filter(c => c.id !== user.id && c.rep >= user.rep - 15 && c.budget >= p.value * 0.8)
    if (!bidders.length) continue
    const bidder = pick(rng, bidders)
    // a transfer request costs the seller the premium: the buyer knows the
    // player wants it, so the bid comes in near value rather than over it
    const fee = Math.round((p.value * (p.transferListed ? 0.95 : (p.wantsOut ?? 0) > 0 ? 1.05 : 1.2 + rng() * 0.4) * (deadline ? 1.15 : 1)) / 10_000) * 10_000
    state.offers.push({
      id: state.nextId++, playerId: p.id, fromClubId: bidder.id, toClubId: user.id,
      fee, week: state.week, forUser: true, status: 'pending',
    })
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: deadline ? `🚨 Deadline-day bid: ${p.name}` : `Bid received: ${p.name}`,
      body: deadline
        ? `${bidder.name} have come in late for ${p.name} - ${fmtMoney(fee)}, and the panic premium is baked in. The window shuts within days: respond from the Transfers screen or the offer dies with it.`
        : `${bidder.name} have tabled a bid of ${fmtMoney(fee)} for ${p.name}. Respond via the Transfers screen - the offer will not stay open for long.`,
      k: deadline ? 'news.bidDeadline' : 'news.bidIn',
      v: { player: p.name, bidder: bidder.name, fee: fmtMoney(fee) },
      playerId: p.id,
    })
  }

  // THE BIDDING WAR (18C, from the competitor assessment: their live
  // bidding is a monetisation loop, but the kernel - watching the price
  // climb while you hold the ball - is real drama). A pending bid for one
  // of the user's players can be topped by a rival before it is answered:
  // the new club takes over the offer at 8 to 15 percent more, at most
  // three raises, and the ousted bidder can rejoin next week if the money
  // is still there. Selling becomes as dramatic as buying.
  for (const o of state.offers) {
    if (!o.forUser || o.status !== 'pending') continue
    if ((o.raises ?? 0) >= 3) continue
    if (state.week - o.week < 1) continue // the opening bid gets its week on the table
    if (rng() > 0.3) continue
    const p = state.players[o.playerId]
    const user = state.clubs[state.userClubId]
    if (!p || !user) continue
    // the budget test is deliberately soft: stated transfer budgets in this
    // economy sit well under marquee fees (the top budget in a fresh world is
    // 6.5m against 9m stars), and the original bid generator already prices
    // at 1.2 to 1.6 times value - a club that wants a war finds the money
    const rivals = clubs.filter(c => c.id !== user.id && c.id !== o.fromClubId &&
      c.rep >= user.rep - 15 && c.budget >= o.fee * 0.25)
    if (!rivals.length) continue
    const rival = pick(rng, rivals)
    const ousted = state.clubs[o.fromClubId]?.name ?? 'the first bidder'
    o.fromClubId = rival.id
    o.fee = Math.round((o.fee * (1.08 + rng() * 0.07)) / 10_000) * 10_000
    o.week = state.week
    o.raises = (o.raises ?? 0) + 1
    o.countered = false // a fresh bidder can still be haggled once
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
      subject: `💰 Bidding war: ${rival.short} top the offer for ${p.name}`,
      body: `${rival.name} have gazumped ${ousted}: the bid on your desk for ${p.name} now reads ${fmtMoney(o.fee)}${(o.raises ?? 0) >= 3 ? ', and that is the market done bidding - answer it' : '. Hold your nerve and the price may climb again; wait too long and the window does what windows do'}. Respond from the Transfers screen.`,
      k: 'news.biddingWar',
      v: {
        player: p.name, rival: rival.name, short: rival.short, ousted, fee: fmtMoney(o.fee),
        tail_k: (o.raises ?? 0) >= 3 ? 'news.bidDone' : 'news.bidMore',
      },
      playerId: p.id,
    })
  }

  // expire stale offers
  for (const o of state.offers) {
    if (o.status === 'pending' && state.week - o.week >= 2) o.status = 'rejected'
  }
  // the window slamming shut kills every open bid on your players
  if (state.week === 8 || state.week === 28) {
    const lapsed = state.offers.filter(o => o.status === 'pending' && o.forUser)
    for (const o of lapsed) o.status = 'rejected'
    if (lapsed.length) {
      const names = lapsed.map(o => state.players[o.playerId]?.name).filter(Boolean).join(', ')
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
        subject: `Window shut - ${lapsed.length === 1 ? 'an offer lapses' : `${lapsed.length} offers lapse`}`,
        body: `The transfer window has closed and every unanswered bid is void. Offers for ${names} are off the table until it reopens.`,
        k: 'news.offersLapse', v: { n: lapsed.length, names },
      })
    }
  }
  if (state.offers.length > 30) state.offers = state.offers.slice(-30)
}

/** User bids for a player: returns a result message; executes if accepted. */
/** The wage the player's camp opens personal terms at. */
export function personalTermsDemand(state: GameState, p: Player): number {
  const user = state.clubs[state.userClubId]
  const seller = p.clubId ? state.clubs[p.clubId] : null
  return Math.round(playerWage(p.ca, p.age) * (seller && user.rep < seller.rep ? 1.2 : 1))
}

/** Stage 1 of the 8D bid flow: agree the FEE only - nothing is signed
 *  until personal terms are done. */
export function agreeFee(state: GameState, playerId: number, fee: number): { ok: boolean; msg: string; counter?: number } {
  if (!realMoney(fee)) return NOT_A_FIGURE
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId) return { ok: false, msg: 'Player unavailable.' }
  if (p.clubId === user.id) return { ok: false, msg: 'Already your player.' }
  if (fee > user.budget) return { ok: false, msg: 'That bid exceeds your transfer budget.' }
  const ask = askingPrice(state, p)
  const seller = state.clubs[p.clubId]
  // THE INK IS STILL WET (user: "i just sold this player - i shouldn't
  // really be able to buy them back within 6 months... i can offer but it
  // should rarely be accepted as the club have invested in this player").
  // A club that just paid a fee and built plans around a man does not flip
  // him for his market price half a season later. While the arrival is fresh
  // the only door is an offer too big to argue with - double the ask - and
  // the refusal says so. joinedAt is stamped by the transfer executor;
  // players who moved before the stamp existed carry no gate.
  {
    const now = state.season * SEASON_WEEKS + state.week
    const weeksIn = p.joinedAt != null ? now - p.joinedAt : null
    if (weeksIn != null && weeksIn < 22 && fee < ask * 2) {
      const door = Math.round((ask * 2) / 50_000) * 50_000
      return {
        ok: false,
        msg: `${seller.short} end the call politely: ${p.name} arrived ${weeksIn < 2 ? 'days' : `${weeksIn} weeks`} ago and the club has invested in him. Until he has been theirs half a season, only an offer they cannot argue with - ${fmtMoney(door)} - reopens the conversation.`,
      }
    }
  }
  // WHAT WILL THEY ACTUALLY TAKE?
  //
  // This used to be `counterPrice - 50_000`, a flat fifty grand off whatever the
  // asking price was - 2.5% of a two-million deal and 0.25% of a twenty-million
  // one. Haggling could not work because there was nothing to haggle over, and a
  // man rotting in the reserves out of contract cost the same as a happy starter.
  //
  // Now the floor comes from the seller's actual position (sellerWillingness),
  // and the reasons are quoted back so a rejection teaches you something. A club
  // with no reason to sell still holds out for the full ask, which is what keeps
  // the market where the salary cap was calibrated against it.
  const { discount, premium, reasons } = sellerWillingness(state, p)
  const floor = floorPrice(state, p)
  // the counter sits between the floor and the ask: they will not open at their
  // own worst price, but they will not pretend the floor does not exist either
  const counterPrice = Math.max(floor, Math.round((floor + (ask - floor) * 0.45) / 50_000) * 50_000)
  if (fee >= floor) {
    if (user.rep < seller.rep - 12 && p.morale > 5 && !p.transferListed) {
      return { ok: false, msg: `${seller.short} accepted your bid, but ${p.name} won't discuss terms - the club couldn't convince him.` }
    }
    const under = ask - fee
    return {
      ok: true,
      msg: under >= 50_000
        ? `Fee agreed at ${fmtMoney(fee)}, ${fmtMoney(under)} under their asking price. Now agree personal terms with ${p.name}'s camp.`
        : `Fee agreed at ${fmtMoney(fee)}. Now agree personal terms with ${p.name}'s camp.`,
    }
  }
  // A near miss names the number that would do it, and says what is weakening
  // their hand, so the next bid is judgement rather than guesswork.
  // (reasons[0] is a {k, v} pair for the translator - interpolating it raw
  // printed "[object Object]" into real rejections until v1.1.3. Found while
  // adding the rival premium; the probe that catches it now lives in
  // haggleprobe.)
  const whyText = reasons.length ? t(reasons[0].k, reasons[0].v) : ''
  const why = whyText ? ` They are open to less than the ask: ${whyText}.` : ''
  // the rival premium is the one thing a rejection must always teach, because
  // the number it produces (a floor ABOVE the ask) reads as a bug until the
  // reason is on the page
  const rivalWhy = premium > 0
    ? ` ${t(premium >= 0.35 ? 'player.sellRival' : 'player.sellSameLeague', { club: seller.short })}`
    : ''
  if (fee >= floor * 0.8) {
    return {
      ok: false,
      msg: `${seller.short} reject ${fmtMoney(fee)} - but they'd do business at ${fmtMoney(counterPrice)}.${rivalWhy}${why}`,
      counter: counterPrice,
    }
  }
  return {
    ok: false,
    msg: discount > 0 && premium === 0
      ? `${seller.short} reject the bid out of hand. They want nearer ${fmtMoney(ask)}, though they would listen below it: ${whyText}.`
      : premium > 0
        ? `${seller.short} reject the bid out of hand.${rivalWhy} It would take ${fmtMoney(floor)} to move them.`
        : `${seller.short} reject the bid. They value ${p.name} at ${fmtMoney(ask)} and have no reason to take less.`,
  }
}

/** Stage 2: personal terms. A signing bonus and a first-team promise both
 *  soften the wage his camp will take - the promise is a real pledge and
 *  he will hold you to it. */
export function signOnTerms(state: GameState, playerId: number, fee: number, wage: number, signOn: number, promiseMinutes: boolean): { ok: boolean; msg: string } {
  if (!realMoney(fee, wage, signOn)) return NOT_A_FIGURE
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId) return { ok: false, msg: 'Player unavailable.' }
  const seller = state.clubs[p.clubId]
  // THE INK IS STILL WET, CHECKED AGAIN (owner, v1.1.3: "if a club signs a
  // player and the player tries to buy for their club the bid should be
  // rejected as theyve just signed him"). agreeFee runs this gate at stage 1,
  // but stage 2 is a separate call and the world can move between them - and
  // the fuzz probes call signOnTerms directly, with no stage 1 at all. A man
  // who arrived at his club within the half-season is not completed on any
  // terms short of the same too-big-to-argue-with door stage 1 quotes; without
  // this, a transfer that would be refused at the fee stage completes cleanly
  // if you only ever ask about wages.
  {
    const now = state.season * SEASON_WEEKS + state.week
    const weeksIn = p.joinedAt != null ? now - p.joinedAt : null
    if (weeksIn != null && weeksIn < 22 && fee < askingPrice(state, p) * 2) {
      return { ok: false, msg: t('reply.inkWetTerms', { club: seller.short, name: p.name }) }
    }
  }
  if (fee + signOn > user.budget) return { ok: false, msg: 'Fee plus signing bonus exceeds your transfer budget.' }
  if (embargoed(state, user.id)) {
    return { ok: false, msg: 'The club is under a transfer embargo for breaching the salary cap. Nobody can be signed until it is served.' }
  }
  const capMsg = capBreak(state, user.id, wage)
  if (capMsg) return { ok: false, msg: capMsg }
  const demand = personalTermsDemand(state, p)
  const squadWages = capBill(state, user)
  if (squadWages + wage > userWageBudget(state, user)) {
    return { ok: false, msg: `Those wages (${fmtWage(wage)}/wk) would break your wage budget.` }
  }
  const sweet = signOn >= demand * 8 ? 0.06 : signOn >= demand * 4 ? 0.03 : 0
  const floor = Math.round(demand * (1 - sweet - (promiseMinutes ? 0.05 : 0)))
  if (wage < floor) {
    return {
      ok: false,
      msg: `${p.name}'s camp shake their heads. They opened at ${fmtWage(demand)}/wk${signOn > 0 || promiseMinutes ? ` and your extras only soften that so far - they need at least ${fmtWage(floor)}/wk on this package` : ' - a signing bonus or a first-team promise would soften that'}.`,
    }
  }
  executeTransfer(state, p, user.id, fee)
  p.wage = wage
  user.balance -= signOn
  if (promiseMinutes) {
    ;(state.pledges ??= []).push({
      playerId: p.id, kind: 'plans', week: state.week, season: state.season,
      due: Math.min(state.week + 6, 44), baseApps: p.stats.apps,
    })
  }
  return { ok: true, msg: `${p.name} signs for ${user.name} - ${fmtMoney(fee)} fee, ${fmtWage(wage)}/wk${signOn > 0 ? `, ${fmtMoney(signOn)} signing bonus` : ''}${promiseMinutes ? ', first-team rugby promised' : ''}.` }
}

/** Sign a clubless player: no fee, his wage demand, and the same guards a
 *  paid signing passes (user: "you should be able to search for free agents
 *  on the transfer centre"). This used to live inline in the player page's
 *  button, where it skipped the salary-cap and embargo checks entirely - an
 *  engine rule a screen can bypass is not a rule. One function now, called
 *  by the button, probed headlessly. */
export function signFreeAgent(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || p.clubId != null || !user) return { ok: false, msg: 'He is not a free agent.' }
  if (embargoed(state, user.id)) {
    return { ok: false, msg: 'The club is under a transfer embargo for breaching the salary cap. Nobody can be signed until it is served.' }
  }
  const wage = renewalDemand(p)
  const capMsg = capBreak(state, user.id, wage)
  if (capMsg) return { ok: false, msg: capMsg }
  if (capBill(state, user) + wage > userWageBudget(state, user)) {
    return { ok: false, msg: `His wage demands (${fmtWage(wage)}/wk) would exceed your wage budget.` }
  }
  executeTransfer(state, p, user.id, 0)
  p.wage = wage
  p.contractEnds = state.season + 2
  return { ok: true, msg: `${p.name} signs on a free transfer (${fmtWage(wage)}/wk).` }
}

/** Legacy one-shot bid: agree the fee and sign at his demanded wage. */
export function userBid(state: GameState, playerId: number, fee: number): { ok: boolean; msg: string; counter?: number } {
  const agreed = agreeFee(state, playerId, fee)
  if (!agreed.ok) return agreed
  const p = state.players[playerId]!
  return { ...signOnTerms(state, playerId, fee, personalTermsDemand(state, p), 0, false) }
}

/** Demand more for a player an AI club has bid on. They may pay up or walk. */
export function counterIncomingOffer(state: GameState, offerId: number): string {
  const o = state.offers.find(x => x.id === offerId)
  if (!o || o.status !== 'pending') return t('reply.offerGone')
  // one round of haggling: the fee rises 18% on a 55% roll and the bid stays
  // pending, so an unlimited counter would be a money printer
  if (o.countered) return t('reply.alreadyCountered')
  o.countered = true
  const p = state.players[o.playerId]
  const bidder = state.clubs[o.fromClubId]
  if (!p || !bidder) { o.status = 'rejected'; return t('reply.offerWithdrawn') }
  // THE RAISE IS ANCHORED TO THE PLAYER, NOT TO THE BID (user: "sometimes they
  // offer more... but it should be balanced so not crazy that it makes the game
  // easy"). A flat +18% rewarded holding out on a bid that was already generous
  // exactly as much as on a cheeky one. Now the further under his value they
  // opened, the more road they have: a lowball comes back up to 22% higher, a
  // full-price bid barely moves, and NOTHING goes past 140% of his value or
  // their budget. Selling well stays possible; printing money does not.
  const rich = o.fee / Math.max(1, p.value)
  const uplift = clamp(1.26 - rich * 0.16, 1.06, 1.22)
  const ceiling = Math.round((p.value * 1.4) / 10_000) * 10_000
  const newFee = Math.min(Math.round((o.fee * uplift) / 10_000) * 10_000, ceiling, bidder.budget)
  const rng = mulberry32(state.seed ^ (o.id * 17))
  if (newFee <= o.fee) {
    // BEST AND FINAL, NOT A FLOUNCE (25D, live feedback: "they always walk
    // away"). Spontaneous bids for stars open at 1.2 to 1.6x value, so most
    // of the offers worth haggling were already past the 1.4x ceiling - and
    // the old code walked them 100% of the time, without even rolling. A
    // club that tabled big money does not tear the cheque up because you
    // asked; it just stops moving. Greed now costs the raise, not the sale.
    return t('reply.bidderFinal', { club: bidder.short, fee: fmtMoney(o.fee) })
  }
  if (rng() < 0.55) {
    o.fee = newFee
    return t('reply.bidderRaises', { club: bidder.short, fee: fmtMoney(newFee), last: p.name.split(' ').slice(-1)[0] })
  }
  o.status = 'rejected'
  return t('reply.bidderWalks', { club: bidder.short })
}

export function respondToOffer(state: GameState, offerId: number, accept: boolean): string {
  const o = state.offers.find(x => x.id === offerId)
  if (!o || o.status !== 'pending') return t('reply.offerGone')
  const p = state.players[o.playerId]
  const bidder = state.clubs[o.fromClubId]
  if (!p || !bidder) { o.status = 'rejected'; return t('reply.offerWithdrawn') }
  if (accept) {
    // THE BOARD'S SQUAD FLOOR (chaos sweep finding). There is no release
    // button in this game, so accepting incoming bids is the one lever that
    // can drain a squad - and it had no floor at all: accept everything and
    // the club plays out its fixtures as a ghost XV of nulls, losing 43-8 to
    // sides that technically faced nobody. Selling half your squad is a legal,
    // stupid choice and stays one; selling past the point where a season can
    // physically be fulfilled is where a real board steps in. Eighteen
    // seniors is the floor: a full matchday 23 minus the five men a normal
    // week has in the physio room, i.e. still barely a club.
    const seniors = (state.clubs[state.userClubId]?.players ?? [])
      .map(id => state.players[id]).filter(x => x && !x.acad).length
    if (p.clubId === state.userClubId && !p.acad && seniors - 1 < 18) {
      o.status = 'rejected'
      return t('reply.boardVetoesSale', { n: seniors - 1 })
    }
    o.status = 'accepted'
    executeTransfer(state, p, bidder.id, o.fee)
    return t('reply.sold', { player: p.name, club: bidder.name, fee: fmtMoney(o.fee) })
  }
  o.status = 'rejected'
  const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
  // THE OTHER HALF OF THE HAGGLE. If you went back for more, got it, and then
  // turned the raised bid down anyway, the player knows a club valued him well
  // above his market price and his own manager used him to run up the number.
  // That is the dilemma the raise is meant to create: the money is real, and so
  // is the cost of refusing it.
  if (o.countered && o.fee >= p.value * 1.2) {
    p.morale = clamp(p.morale - (sulky ? 1.8 : 0.9), 1, 10)
    return t('reply.bidRejectedKnew', { player: p.name, club: bidder.short, mood_k: sulky ? 'reply.bidRejectedFurious' : 'reply.bidRejectedSoured' })
  }
  if (p.morale <= 4 || (sulky && bidder.rep > (state.clubs[state.userClubId]?.rep ?? 0))) {
    p.morale = clamp(p.morale - (sulky ? 1.4 : 0.5), 1, 10)
    return t('reply.bidRejectedFrustrated', { player: p.name, pers_k: `persLower.${p.pers}` })
  }
  return t('reply.bidRejectedStays', { player: p.name })
}

// ------------------------------------------------------------------
// Contracts
// ------------------------------------------------------------------

// talkToPlayer used to live here: the ORIGINAL one-to-one, per-player
// cooldown, no weekly budget. It and game/chats.ts were two economies for
// the same conversation, and the uncapped one made squad-wide praise a free
// morale faucet. Retired v1.1.4 - the office (chats.ts: two a week,
// deterministic, real costs) is the one way to talk to a player.

/** The wage bill that counts against the cap - marquee men sit outside it. */
export function capBill(state: GameState, club: { players: number[]; marquee?: number[] }): number {
  const marquee = new Set((club.marquee ?? []).slice(0, 2))
  return club.players.reduce((s, id) => {
    if (marquee.has(id)) return s
    const p = state.players[id]
    // Academy men sit outside the senior cap, as they do in the real game: a
    // club is not punished for developing its own. It also matters mechanically
    // now the academy is 27 strong rather than four - counting them would have
    // put every club in the world over the cap overnight.
    if (!p || p.acad) return s
    return s + p.wage
  }, 0)
}

/** Agree a pre-contract with an out-of-contract player at another club:
 *  no fee, he arrives on a free when the season ends. Binding once signed. */
export function agreePreContract(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (embargoed(state, state.userClubId)) {
    return { ok: false, msg: 'The club is under a transfer embargo for breaching the salary cap. No pre-contracts either.' }
  }
  if (!p || !p.clubId || !user) return { ok: false, msg: 'Player unavailable.' }
  if (p.clubId === user.id) return { ok: false, msg: 'Already your player.' }
  if (p.contractEnds > state.season) return { ok: false, msg: 'He is under contract beyond this season.' }
  if (p.loanFrom || p.onLoan) return { ok: false, msg: 'He is on loan - his contract belongs to his parent club.' }
  if (p.retiring) return { ok: false, msg: `${p.name} is retiring in the summer. There is nothing to sign.` }
  if (state.week < 25) return { ok: false, msg: 'Pre-contract talks open from week 25.' }
  state.preContracts ??= []
  if (state.preContracts.some(pc => pc.playerId === p.id)) return { ok: false, msg: 'A pre-contract is already signed.' }
  if (state.preContracts.filter(pc => pc.toClubId === user.id).length >= 3) {
    return { ok: false, msg: 'Three pre-contracts already agreed - the board will not register more.' }
  }
  const wage = Math.round((playerWage(p.ca, p.age) * 1.1) / 50) * 50 // free-agent premium
  if (capBill(state, user) + wage > userWageBudget(state, user)) {
    return { ok: false, msg: `His terms (${fmtWage(wage)}/wk) would break the wage budget.` }
  }
  const seller = state.clubs[p.clubId]
  if (seller && user.rep < seller.rep - 12 && p.morale > 5) {
    return { ok: false, msg: `${p.name} thanks you for the interest, but he is holding out for a bigger stage.` }
  }
  state.preContracts.push({ playerId: p.id, toClubId: user.id, week: state.week })
  p.morale = clamp(p.morale + 0.5, 1, 10)
  if (seller && p.ca >= 80) addGrudge(state, seller.id, user.id, 'news.grudgePreContract', { player: p.name })
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `🖊 Pre-contract agreed: ${p.name}`,
    body: `${p.name} (${p.pos}, ${p.age}) has signed a pre-contract with ${user.name}. He sees the season out at ${seller?.name ?? 'his club'}, then joins on a free at terms of ${fmtMoney(wage)}/week. ${seller ? `${seller.short} found out from the press release.` : ''}`,
    k: 'news.preAgreed',
    v: {
      player: p.name, pos: p.pos, age: p.age, club: user.name,
      seller: seller?.name ?? tIn('en', 'news.hisClub'), wage: fmtMoney(wage),
      tail_k: seller ? 'news.preSellerFound' : 'common.nothing', sellerShort: seller?.short ?? '',
    },
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} joins on a free this summer (${fmtWage(wage)}/wk agreed).` }
}

/** From week 25, rivals circle the user's own expiring players: neglect a
 *  renewal long enough and someone signs him for nothing. */
export function aiPreContractPoach(state: GameState, rng: Rng) {
  if (state.week < 25 || state.week > 38 || rng() > 0.12) return
  const user = state.clubs[state.userClubId]
  if (!user) return
  state.preContracts ??= []
  const exposed = user.players
    .map(id => state.players[id])
    .filter(Boolean)
    .filter(p => p.contractEnds <= state.season && p.ca >= 76 && !p.loanFrom && !p.retiring &&
      !state.preContracts!.some(pc => pc.playerId === p.id))
  if (!exposed.length) return
  const p = pick(rng, exposed)
  const suitors = Object.values(state.clubs).filter(c =>
    c.id !== user.id && c.rep >= user.rep - 10 && rng() < 0.5)
  const to = suitors[0]
  if (!to) return
  state.preContracts.push({ playerId: p.id, toClubId: to.id, week: state.week })
  p.morale = clamp(p.morale + 0.5, 1, 10)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `💔 GAZUMPED: ${p.name} signs pre-contract with ${to.short}`,
    body: `You left his renewal on the desk too long. ${p.name} has agreed a pre-contract with ${to.name} and will walk for nothing when the season ends. The deal is binding - there is no fee, no negotiation, and no way back.`,
    k: 'news.gazumped', v: { player: p.name, to: to.name, short: to.short },
    playerId: p.id,
  })
}

export function renewalDemand(p: Player): number {
  const persF = p.pers === 'Mercenary' ? 1.35 : p.pers === 'Loyal' ? 0.9 : p.pers === 'Ambitious' ? 1.15 : 1
  const scale = Math.round((playerWage(p.ca, p.age) * 1.1 * persF) / 50) * 50
  // NO AGENT OPENS BY ASKING FOR LESS. The figure above is what the wage scale
  // says a man of his ability and age is worth, and for a loyal young player on
  // an early big contract, or anyone whose ability has slipped, it can land under
  // what he is already earning. The contract screen then printed "his camp wants
  // £9.2k/wk (he is on £9.3k)" and meeting that "demand" cut his pay, which he
  // cheerfully accepted. Found by scripts/renewprobe.ts.
  const floor = Math.round((Number.isFinite(p.wage) ? Math.max(0, p.wage) : 0) / 50) * 50
  return Math.max(scale, floor)
}

export function offerRenewal(state: GameState, playerId: number): { ok: boolean; msg: string } {
  const p = state.players[playerId]
  if (!p) return { ok: false, msg: 'Not your player.' }
  return offerRenewalAt(state, playerId, renewalDemand(p))
}

/** Haggled renewal: offer any wage; the agent accepts, counters or walks. */
export function offerRenewalAt(state: GameState, playerId: number, offer: number): { ok: boolean; msg: string; counter?: number } {
  if (!realMoney(offer)) return NOT_A_FIGURE
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || p.clubId !== user.id) return { ok: false, msg: 'Not your player.' }
  if (p.loanFrom) return { ok: false, msg: 'He is on loan - his contract belongs to his parent club.' }
  if (p.retiring) return { ok: false, msg: `${p.name} appreciates the gesture, but his mind is made up - he retires in the summer.` }
  if ((state.preContracts ?? []).some(pc => pc.playerId === p.id)) {
    return { ok: false, msg: `Too late - ${p.name} has already signed a pre-contract elsewhere. The deal is binding.` }
  }
  const capMsgR = (user.marquee ?? []).includes(p.id) ? null : capBreak(state, user.id, offer, p.wage)
  if (capMsgR) return { ok: false, msg: capMsgR }
  const demand = renewalDemand(p)
  const marqueed = (user.marquee ?? []).includes(p.id)
  const squadWages = capBill(state, user)
  if (!marqueed && squadWages - ((user.marquee ?? []).includes(p.id) ? 0 : p.wage) + offer > userWageBudget(state, user)) {
    return { ok: false, msg: 'Those terms would exceed the wage budget.' }
  }
  if (p.pers === 'Ambitious' && p.ca >= 84 && user.rep < 82 && p.morale < 8) {
    return { ok: false, msg: `${p.name}'s agent is blunt: his client is ambitious, and he wants to see the club matching that ambition before committing.` }
  }
  const rng = mulberry32(state.seed ^ (playerId * 31 + state.week * 7 + state.season * 101))
  if (p.morale < 3.5 && p.pers !== 'Loyal' && rng() < 0.5) {
    return { ok: false, msg: `${p.name} isn't interested in extending right now.` }
  }
  let wage = offer
  // A QUOTED NUMBER IS A PROMISE (user, offering MORE than the number on the
  // card: "im offering 8.6k but he isnt accepting but says he'll accept
  // 8k?"). The counter is demand * 0.97, but the accept roll ran for any
  // offer under the full demand - and the roll is seeded on the week, so
  // inside one week the same refusal repeated forever, re-quoting a number
  // it would never honour. Anything at or above the counter now signs
  // without a roll, which is what "they'd sign today at X" has to mean.
  // And a wage is formatted as a wage: fmtMoney printed the same 8,400 the
  // button showed as "£8.4k/wk" back at the manager as "£8k/wk".
  const counterAt = Math.round((demand * 0.97) / 50) * 50
  if (offer < counterAt) {
    const ratio = offer / demand
    if (ratio < 0.85) {
      if (p.pers === 'Mercenary' || p.pers === 'Temperamental') p.morale = clamp(p.morale - 0.6, 1, 10)
      return {
        ok: false,
        msg: p.pers === 'Mercenary'
          ? `The agent laughs down the phone. "${fmtWage(offer)} a week? We'll speak when you're serious." ${p.name} has heard about the lowball.`
          : `${p.name}'s agent calls the offer "some way short" and ends the meeting. Come back with more.`,
      }
    }
    // close enough to talk: loyalty, mood and character decide
    const acceptP =
      (p.pers === 'Loyal' ? 0.6 : p.pers === 'Professional' ? 0.45 : p.pers === 'Mercenary' ? 0.12 : 0.3)
      + (p.morale >= 7.5 ? 0.15 : 0) + (ratio - 0.85) * 1.2
    if (rng() >= acceptP) {
      return { ok: false, msg: `${p.name}'s camp say no - but they'd sign today at ${fmtWage(counterAt)}/wk.`, counter: counterAt }
    }
  }
  wage = Math.min(offer, Math.round(demand * 1.3)) // no accidental silly money
  p.wage = wage
  // A NEW DEAL IS NEVER SHORTER THAN THE OLD ONE. The term is counted from now,
  // so a 27-year-old with three years left was being handed a two-year extension
  // and losing a year for signing it. Nobody signs that. Found by
  // scripts/renewprobe.ts.
  const term = p.age >= 32 ? 1 : 2 + (p.age <= 26 ? 1 : 0)
  p.contractEnds = Math.max(p.contractEnds, state.season + term)
  p.morale = clamp(p.morale + (wage >= demand * 1.12 ? 1.5 : 1), 1, 10) // generosity is remembered
  if ((p.wantsDeal ?? 0) > 0) { p.wantsDeal = 0; p.morale = clamp(p.morale + 0.5, 1, 10) } // demand settled
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `${p.name} extends`,
    body: `${p.name} has signed a new deal at ${user.name} worth ${fmtMoney(wage)}/week, running until ${2026 + p.contractEnds}.`,
    k: 'news.extends',
    v: { player: p.name, club: user.name, wage: fmtMoney(wage), until: 2026 + p.contractEnds },
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} signs until ${2026 + p.contractEnds} (${fmtWage(wage)}/wk).` }
}

/** AI clubs renew their expiring key players (some slip through to free agency). */
export function aiRenewals(state: GameState, rng: Rng) {
  if (state.week !== 28 && state.week !== 36) return
  for (const club of Object.values(state.clubs)) {
    if (club.id === state.userClubId) continue
    for (const id of club.players) {
      const p = state.players[id]
      if (p && p.contractEnds <= state.season && rng() < 0.75 && !p.retiring &&
        !(state.preContracts ?? []).some(pc => pc.playerId === p.id)) {
        p.contractEnds = state.season + 1 + Math.floor(rng() * 2)
        p.wage = renewalDemand(p)
      }
    }
  }
}
