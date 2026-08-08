import type { GameState, Player } from './model'
import { addGrudge, fmtMoney } from './model'
import { ensureCaptains } from './analysis'
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

export function executeTransfer(state: GameState, p: Player, toClubId: string, fee: number) {
  // the last line of defence: this is what actually moves the money, and it is
  // reached from the AI paths too, so it refuses a nonsense fee outright rather
  // than trusting every caller to have checked
  if (!realMoney(fee)) return
  const from = p.clubId ? state.clubs[p.clubId] : null
  const to = state.clubs[toClubId]
  // losing a star you didn't want to sell leaves a mark on the fixture list
  if (from && p.ca >= 80 && !p.transferListed && fee > 0) {
    addGrudge(state, from.id, toClubId, `they came and took ${p.name}`)
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
  if (toClubId === state.userClubId) {
    state.mgr.signings += 1
    state.mgr.spent += fee
    p.sc = 100
  }
  p.wage = Math.max(p.wage, playerWage(p.ca, p.age))
  p.contractEnds = state.season + 2 + (p.age < 30 ? 1 : 0)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `${p.name} joins ${to.name}`,
    body: `${to.name} have completed the signing of ${p.name} from ${from?.name ?? 'free agency'} for a fee of ${fmtMoney(fee)}. The ${p.age}-year-old has agreed terms of ${fmtMoney(p.wage)}/week until ${2026 + p.contractEnds}.`,
    playerId: p.id,
  })
  ensureCaptains(state) // reappoint leaders wherever the move vacated an armband
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
    const targets = Object.values(state.players).filter(p =>
      p.clubId && p.clubId !== buyer.id && p.clubId !== state.userClubId &&
      p.pos === need && p.ca >= 70 && !p.onLoan && !p.loanFrom &&
      (state.clubs[p.clubId]?.rep ?? 99) <= buyer.rep + 6 &&
      askingPrice(state, p) <= buyer.budget)
      .sort((a, b) => b.ca - a.ca)
    const p = targets[0]
    if (p && rng() < 0.6) executeTransfer(state, p, buyer.id, askingPrice(state, p))
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
      ((p.wantsDeal ?? 0) > 0 && state.week - (p.wantsDeal ?? 0) >= 4 && rng() < 0.3) ||
      (p.ca >= 82 && rng() < (p.pers === 'Ambitious' || p.pers === 'Mercenary' ? 0.4 : 0.2)))
    if (!wanted.length) continue
    const p = pick(rng, wanted)
    if (state.offers.some(o => o.playerId === p.id && o.status === 'pending')) continue
    const bidders = clubs.filter(c => c.id !== user.id && c.rep >= user.rep - 15 && c.budget >= p.value * 0.8)
    if (!bidders.length) continue
    const bidder = pick(rng, bidders)
    const fee = Math.round((p.value * (p.transferListed ? 0.95 : 1.2 + rng() * 0.4) * (deadline ? 1.15 : 1)) / 10_000) * 10_000
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
  // counters land on clean £100k steps, and a bid within £50k of the
  // counter shakes hands - otherwise rounding lets the game say
  // "reject £1.7m, but they'd do business at £1.7m"
  const counterPrice = Math.min(ask, Math.ceil((ask * 0.97) / 100_000) * 100_000)
  if (fee >= Math.min(ask, counterPrice - 50_000)) {
    if (user.rep < seller.rep - 12 && p.morale > 5 && !p.transferListed) {
      return { ok: false, msg: `${seller.short} accepted your bid, but ${p.name} won't discuss terms - the club couldn't convince him.` }
    }
    return { ok: true, msg: `Fee agreed at ${fmtMoney(fee)}. Now agree personal terms with ${p.name}'s camp.` }
  }
  if (fee >= ask * 0.78) {
    return { ok: false, msg: `${seller.short} reject ${fmtMoney(fee)} - but they'd do business at ${fmtMoney(counterPrice)}.`, counter: counterPrice }
  }
  return { ok: false, msg: `${seller.short} reject the bid. They value ${p.name} at around ${fmtMoney(ask)}.` }
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
  if (fee + signOn > user.budget) return { ok: false, msg: 'Fee plus signing bonus exceeds your transfer budget.' }
  const demand = personalTermsDemand(state, p)
  const squadWages = capBill(state, user)
  if (squadWages + wage > user.wageBudget) {
    return { ok: false, msg: `Those wages (${fmtMoney(wage)}/wk) would break your wage budget.` }
  }
  const sweet = signOn >= demand * 8 ? 0.06 : signOn >= demand * 4 ? 0.03 : 0
  const floor = Math.round(demand * (1 - sweet - (promiseMinutes ? 0.05 : 0)))
  if (wage < floor) {
    return {
      ok: false,
      msg: `${p.name}'s camp shake their heads. They opened at £${demand.toLocaleString()}/wk${signOn > 0 || promiseMinutes ? ` and your extras only soften that so far - they need at least £${floor.toLocaleString()}/wk on this package` : ' - a signing bonus or a first-team promise would soften that'}.`,
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
  return { ok: true, msg: `${p.name} signs for ${user.name} - ${fmtMoney(fee)} fee, £${wage.toLocaleString()}/wk${signOn > 0 ? `, ${fmtMoney(signOn)} signing bonus` : ''}${promiseMinutes ? ', first-team rugby promised' : ''}.` }
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
  if (!o || o.status !== 'pending') return 'Offer no longer available.'
  // one round of haggling: the fee rises 18% on a 55% roll and the bid stays
  // pending, so an unlimited counter would be a money printer
  if (o.countered) return 'You have already been back to them once. Answer the offer.'
  o.countered = true
  const p = state.players[o.playerId]
  const bidder = state.clubs[o.fromClubId]
  if (!p || !bidder) { o.status = 'rejected'; return 'Offer withdrawn.' }
  const newFee = Math.round((o.fee * 1.18) / 10_000) * 10_000
  const rng = mulberry32(state.seed ^ (o.id * 17))
  if (newFee <= bidder.budget && rng() < 0.55) {
    o.fee = newFee
    return `${bidder.short} grumble... then agree to ${fmtMoney(newFee)}. Accept while it lasts.`
  }
  o.status = 'rejected'
  return `${bidder.short} walk away from the table. The offer is gone.`
}

export function respondToOffer(state: GameState, offerId: number, accept: boolean): string {
  const o = state.offers.find(x => x.id === offerId)
  if (!o || o.status !== 'pending') return 'Offer no longer available.'
  const p = state.players[o.playerId]
  const bidder = state.clubs[o.fromClubId]
  if (!p || !bidder) { o.status = 'rejected'; return 'Offer withdrawn.' }
  if (accept) {
    o.status = 'accepted'
    executeTransfer(state, p, bidder.id, o.fee)
    return `${p.name} sold to ${bidder.name} for ${fmtMoney(o.fee)}.`
  }
  o.status = 'rejected'
  const sulky = p.pers === 'Ambitious' || p.pers === 'Mercenary' || p.pers === 'Temperamental'
  if (p.morale <= 4 || (sulky && bidder.rep > (state.clubs[state.userClubId]?.rep ?? 0))) {
    p.morale = clamp(p.morale - (sulky ? 1.4 : 0.5), 1, 10)
    return `Bid rejected. ${p.name} (${p.pers.toLowerCase()}) is frustrated the move was blocked.`
  }
  return `Bid rejected. ${p.name} stays.`
}

// ------------------------------------------------------------------
// Contracts
// ------------------------------------------------------------------

/** FM-style one-to-one: praise a player's form or have a quiet word.
 *  Reaction depends on whether it's deserved and on his personality. */
export function talkToPlayer(state: GameState, playerId: number, kind: 'praise' | 'word'): string {
  const p = state.players[playerId]
  if (!p || p.clubId !== state.userClubId) return 'Not your player.'
  const now = state.season * 100 + state.week
  if (p.talkWk != null && now - p.talkWk < 3) return `You pulled him aside only recently - leave it a week or two, or the words lose their weight.`
  p.talkWk = now
  const rng = mulberry32(((state.season * 53 + state.week) * 7919) ^ (playerId * 2654435761))
  const first = p.name.split(' ')[0]
  const goodForm = p.form >= 6.5
  const bump = (d: number) => { p.morale = clamp(p.morale + d, 1, 10) }

  if (kind === 'praise') {
    if (goodForm) {
      bump(p.pers === 'Temperamental' ? 1.3 : 0.9)
      switch (p.pers) {
        case 'Leader': return `${first} nods once. "Standards, gaffer." He walks out an inch taller - the rest of the room noticed.`
        case 'Professional': return `A brief handshake and back to his stretches. He appreciated it - you can tell by the extra ten minutes he stays out kicking.`
        case 'Temperamental': return `${first} beams like you've handed him the captaincy. He'll play like a superstar this week - mind he doesn't try to do it all himself.`
        case 'Mercenary': return `"Good of you to notice." He's purring - and no doubt filing it away for the next contract chat.`
        default: return `${first} leaves your office with his chest out. The praise landed - morale is up.`
      }
    }
    if (p.pers === 'Professional' || p.pers === 'Leader') {
      bump(-0.4)
      return `${first} frowns. He knows his form has been poor, and empty flattery insults him. That one backfired.`
    }
    bump(0.35)
    return `He laps it up - though the coaches exchange a look. Praising poor form is a dangerous habit.`
  }

  // 'word' - the quiet (or not so quiet) chat about standards
  if (!goodForm) {
    if (p.pers === 'Professional' || p.pers === 'Leader' || p.pers === 'Loyal') {
      bump(0.55)
      return `${first} takes it on the chin. "You're right, gaffer. It's not good enough." He's first out to training the next morning.`
    }
    if (p.pers === 'Ambitious') {
      if (rng() < 0.5) { bump(0.65); return `${first} bristles, then burns. He wants the big time and knows this form won't get him there - expect a response.` }
      bump(-0.8)
      return `${first} folds his arms and stares at the floor. The message was fair; the reaction wasn't. He'll sulk for a while.`
    }
    bump(-1.1)
    if (rng() < 0.4) {
      state.news.push({
        id: state.nextId++, week: state.week, season: state.season, type: 'gossip', read: false,
        subject: `Dressing room whispers: ${p.name} unhappy after dressing-down`,
        body: `Word has leaked that ${p.name} was hauled in front of the coach over his recent form - and didn't take it well. Team-mates say he trained on his own on Tuesday.`,
        playerId: p.id,
      })
      return `${first} storms out and slams the door. By Thursday it's in the group chat. That could fester.`
    }
    return `${first} goes quiet and stares through you. The message may have landed, but the mood has soured.`
  }
  bump(p.pers === 'Temperamental' ? -1.5 : -0.8)
  return p.pers === 'Temperamental'
    ? `${first} explodes. "In MY form?!" He's got a point - hauling in your in-form players is how dressing rooms are lost.`
    : `${first} looks baffled - he's been one of your best players. An unjustified rocket dents trust.`
}

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
  if (capBill(state, user) + wage > user.wageBudget) {
    return { ok: false, msg: `His terms (${fmtMoney(wage)}/wk) would break the wage budget.` }
  }
  const seller = state.clubs[p.clubId]
  if (seller && user.rep < seller.rep - 12 && p.morale > 5) {
    return { ok: false, msg: `${p.name} thanks you for the interest, but he is holding out for a bigger stage.` }
  }
  state.preContracts.push({ playerId: p.id, toClubId: user.id, week: state.week })
  p.morale = clamp(p.morale + 0.5, 1, 10)
  if (seller && p.ca >= 80) addGrudge(state, seller.id, user.id, `they signed ${p.name} on a pre-contract under our noses`)
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `🖊 Pre-contract agreed: ${p.name}`,
    body: `${p.name} (${p.pos}, ${p.age}) has signed a pre-contract with ${user.name}. He sees the season out at ${seller?.name ?? 'his club'}, then joins on a free at terms of ${fmtMoney(wage)}/week. ${seller ? `${seller.short} found out from the press release.` : ''}`,
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} joins on a free this summer (${fmtMoney(wage)}/wk agreed).` }
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
    playerId: p.id,
  })
}

export function renewalDemand(p: Player): number {
  const persF = p.pers === 'Mercenary' ? 1.35 : p.pers === 'Loyal' ? 0.9 : p.pers === 'Ambitious' ? 1.15 : 1
  return Math.round((playerWage(p.ca, p.age) * 1.1 * persF) / 50) * 50
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
  const demand = renewalDemand(p)
  const marqueed = (user.marquee ?? []).includes(p.id)
  const squadWages = capBill(state, user)
  if (!marqueed && squadWages - ((user.marquee ?? []).includes(p.id) ? 0 : p.wage) + offer > user.wageBudget) {
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
  if (offer < demand) {
    const ratio = offer / demand
    if (ratio < 0.85) {
      if (p.pers === 'Mercenary' || p.pers === 'Temperamental') p.morale = clamp(p.morale - 0.6, 1, 10)
      return {
        ok: false,
        msg: p.pers === 'Mercenary'
          ? `The agent laughs down the phone. "${fmtMoney(offer)}? We'll speak when you're serious." ${p.name} has heard about the lowball.`
          : `${p.name}'s agent calls the offer "some way short" and ends the meeting. Come back with more.`,
      }
    }
    // close enough to talk: loyalty, mood and character decide
    const acceptP =
      (p.pers === 'Loyal' ? 0.6 : p.pers === 'Professional' ? 0.45 : p.pers === 'Mercenary' ? 0.12 : 0.3)
      + (p.morale >= 7.5 ? 0.15 : 0) + (ratio - 0.85) * 1.2
    if (rng() >= acceptP) {
      const counter = Math.round((demand * 0.97) / 50) * 50
      return { ok: false, msg: `${p.name}'s camp say no - but they'd sign today at ${fmtMoney(counter)}/wk.`, counter }
    }
  }
  wage = Math.min(offer, Math.round(demand * 1.3)) // no accidental silly money
  p.wage = wage
  p.contractEnds = state.season + (p.age >= 32 ? 1 : 2 + (p.age <= 26 ? 1 : 0))
  p.morale = clamp(p.morale + (wage >= demand * 1.12 ? 1.5 : 1), 1, 10) // generosity is remembered
  if ((p.wantsDeal ?? 0) > 0) { p.wantsDeal = 0; p.morale = clamp(p.morale + 0.5, 1, 10) } // demand settled
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'contract', read: false,
    subject: `${p.name} extends`,
    body: `${p.name} has signed a new deal at ${user.name} worth ${fmtMoney(wage)}/week, running until ${2026 + p.contractEnds}.`,
    playerId: p.id,
  })
  return { ok: true, msg: `${p.name} signs until ${2026 + p.contractEnds} (${fmtMoney(wage)}/wk).` }
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
