// The loan-in market: borrow tomorrow's stars from the big clubs' benches.

import type { GameState, Player } from './model'
import { SEASON_WEEKS, leagueTier } from './model'
import { autoSelect } from './matchEngine'
import { tIn } from './i18n'
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
export function loanIn(state: GameState, playerId: number): string {
  const p = state.players[playerId]
  const user = state.clubs[state.userClubId]
  if (!p || !p.clubId || p.clubId === user.id) return 'Unavailable.'
  const parent = state.clubs[p.clubId]
  if (!parent) return 'Unavailable.'
  // SENIORS, not the whole list, and a cap the world can actually live under
  // (audit 16D). Counting every id meant the 27 academy players pushed every
  // club past the old 40 the day the academy became a real squad - so this
  // line refused every loan the game has offered since, and the injury-crisis
  // letter was advertising players nobody could sign. A fresh world carries
  // 41 seniors; the AI summer cull tolerates 46, so 46 is the hoarding line.
  const seniors = user.players.filter(id => state.players[id] && !state.players[id].acad).length
  if (seniors >= 46) return 'Your senior squad is full.'
  if (!loanTargets(state).some(t => t.id === playerId)) return `${parent.short} won't loan him right now.`
  // sulky stars want a transfer, not a loan
  if (p.pers === 'Mercenary' && p.morale < 5) return `${p.name}'s agent wants a permanent move, not a loan.`
  parent.players = parent.players.filter(id => id !== p.id)
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === p.id ? null : id))
  user.players.push(p.id)
  p.loanFrom = parent.id
  p.clubId = user.id
  p.morale = clamp(p.morale + 1, 1, 10)
  p.sc = 100
  // the game-time ledger starts counting his availability from arrival, not
  // from the weeks he spent at his parent club
  p.avail = 0
  p.debutPending = 'signing'
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'transfer', read: false,
    subject: `Loan signing: ${p.name} arrives from ${parent.short}`,
    body: `${p.name} (${p.age}, ${p.pos}) joins on loan until the end of the season. ${parent.short} cover half his wage - they want him playing, so play him.`,
    k: 'news.loanIn', v: { player: p.name, age: p.age, pos: p.pos, parent: parent.short },
    playerId: p.id,
  })
  // keep the parent's lineup coherent
  parent.tactic.lineup = autoSelect(state, parent.players.map(id => state.players[id]).filter(Boolean))
  return `${p.name} joins on loan for the season.`
}

/**
 * Send one of your own young players out for the season.
 *
 * This lived inline in PlayerScreen, which meant the engine had no entry point
 * for it - so the 20-season soak could never loan anyone out, the loan-watch
 * postcard never fired in any long run, and the release audit read "loan watch
 * 0" over twenty years for a feature that works fine. A behaviour with no
 * callable seam has no test.
 */
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
