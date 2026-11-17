// ---- PRO CHALLENGES (1.9.14) ----
//
// Owner, after a feedback report from a player four seasons deep, winning 80%
// of games with the club they started at: Pro should give that player a new
// goal, not a different engine. Three rules a Pro Manager can lay over a
// career at any club, in either game, each with a goal and a deadline:
//
//   Academy Only  no signings, loans, free agents or pre-contracts in.
//                 Win any trophy within five seasons.
//   Shoestring    the transfer budget halved every summer, and the wage
//                 budget held to the bill (no room to add wages). Meet the
//                 board's target three seasons running, within six.
//   Fire Sale     the five best players sold before day one, the fees to the
//                 bank (the debts), not the budget. Win the league in four.
//
// The match engine is not touched: these change what the manager has, not
// how the rugby is played. Miss the deadline and the board ends it (owner:
// "Career ends"): the manager is sacked and the career is over. Leave the
// club any other way (resign, sacked for results, another job) and the
// challenge is simply void. Nothing here draws from the world's random
// stream: the fire sale's buyers are the league's richest clubs, in order.
import type { GameState, Player } from './model'
import { tIn } from './i18n'
import { executeTransfer } from './transfer'
import { capBill } from './cap'
import { sackManager } from './jobs'

export type ProChallengeId = 'academy' | 'shoestring' | 'firesale'
export const PRO_CHALLENGE_IDS: ProChallengeId[] = ['academy', 'shoestring', 'firesale']
/** Seasons allowed, counting the first. */
export const PRO_SEASONS: Record<ProChallengeId, number> = { academy: 5, shoestring: 6, firesale: 4 }
/** Shoestring: board targets met in a row. */
export const SHOESTRING_RUN = 3
/** Fire Sale: how many of the best are sold. */
export const FIRESALE_COUNT = 5

type ProState = NonNullable<GameState['proChallenge']>

/** The challenge running at the manager's club, if any. */
export function proActive(state: GameState): ProState | null {
  const c = state.proChallenge
  return c && !c.done && !state.unemployed && c.clubId === state.userClubId ? c : null
}

/** Academy Only: no player comes in from outside. */
export function proBlocksSigning(state: GameState): boolean {
  return proActive(state)?.id === 'academy'
}

/** Shoestring and Fire Sale: the board's money (and the store's) is not
 *  this career's. Academy Only needs no money rule: nobody can be bought. */
export function proBlocksMoney(state: GameState): boolean {
  const c = proActive(state)
  return c?.id === 'shoestring' || c?.id === 'firesale'
}

/** Shoestring's purse: half the transfer budget, and wage room held to the
 *  wages already paid. Applied at the start and after every summer's reset. */
export function applyShoestring(state: GameState): void {
  if (proActive(state)?.id !== 'shoestring') return
  const club = state.clubs[state.userClubId]
  if (!club) return
  club.budget = Math.round(club.budget / 2 / 50_000) * 50_000
  club.wageBudget = Math.max(capBill(state, club), Math.round(club.wageBudget / 2))
}

/** Begin a Pro challenge on a career that has just been created. */
export function startProChallenge(state: GameState, id: ProChallengeId): void {
  const club = state.clubs[state.userClubId]
  if (!club || !PRO_CHALLENGE_IDS.includes(id)) return
  state.proChallenge = { id, clubId: club.id, since: state.season, streak: 0 }
  let sold: string[] = []
  if (id === 'firesale') {
    const best = club.players.map(pid => state.players[pid]).filter((p): p is Player => !!p && !p.acad && !p.loanFrom)
      .sort((a, b) => b.ca - a.ca || a.id - b.id).slice(0, FIRESALE_COUNT)
    const buyers = Object.values(state.clubs).filter(c => c.id !== club.id && c.leagueId === club.leagueId)
      .sort((a, b) => b.budget - a.budget || (a.id < b.id ? -1 : 1))
    best.forEach((p, i) => {
      const to = buyers[i % Math.max(1, buyers.length)]
      if (!to) return
      const fee = Math.round(p.value / 50_000) * 50_000
      executeTransfer(state, p, to.id, fee)
      // the fees clear the debts: they go to the bank, never to the budget
      club.budget = Math.max(0, club.budget - Math.round(fee * 0.7))
      sold.push(p.name)
    })
    if (club.captain != null && !club.players.includes(club.captain)) club.captain = null
    if (club.vice != null && !club.players.includes(club.vice)) club.vice = null
  }
  applyShoestring(state)
  const v = {
    title_k: `pro.${id}`, desc_k: `pro.${id}Desc`, n: PRO_SEASONS[id],
    sold: sold.join(', '),
  }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: tIn('en', 'news.proStartSubj', v), body: tIn('en', id === 'firesale' ? 'news.proStartSold' : 'news.proStart', v),
    k: id === 'firesale' ? 'news.proStartSold' : 'news.proStart', v,
  })
}

/** The board's verdict on a season, for Shoestring's run (rollover review). */
export function proSeasonVerdict(state: GameState, met: boolean): void {
  const c = proActive(state)
  if (c?.id !== 'shoestring') return
  c.streak = met ? c.streak + 1 : 0
}

/** Has the goal been reached? Read at the end of a season. */
export function proGoalMet(state: GameState, c: ProState): boolean {
  const club = state.clubs[c.clubId]
  if (!club) return false
  if (c.id === 'academy') return state.mgr.trophies.some(t => t.clubId === c.clubId && t.season >= c.since)
  if (c.id === 'shoestring') return c.streak >= SHOESTRING_RUN
  return state.history.some(h => h.champion === c.clubId && h.compId === club.leagueId && h.season >= c.since)
}

/** The summer: the goal met, the deadline passed, or the challenge void.
 *  Runs after the new season has been opened (rollover.ts). */
export function proCheck(state: GameState): void {
  const c = state.proChallenge
  if (!c || c.done || c.over) return
  // left the club some other way: the challenge goes with the job
  if (state.unemployed || c.clubId !== state.userClubId) { state.proChallenge = null; return }
  const played = state.season - c.since // seasons completed
  if (proGoalMet(state, c)) {
    c.done = true
    ;(state.challengesDone ??= []).push(`pro.${c.id}`)
    const v = { title_k: `pro.${c.id}`, n: played, manager: state.managerName }
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'award', read: false,
      subject: tIn('en', 'news.proDoneSubj', v), body: tIn('en', 'news.proDone', v), k: 'news.proDone', v,
    })
    state.celebration = {
      headline: tIn('en', 'cel.challenge'),
      sub: tIn('en', 'cel.challengeSub', { title_k: `pro.${c.id}`, manager: state.managerName }),
      icon: 'award', hk: 'cel.challenge', sk: 'cel.challengeSub', sv: { title_k: `pro.${c.id}`, manager: state.managerName },
    }
    return
  }
  if (played < PRO_SEASONS[c.id]) return
  // THE DEADLINE (owner: "Career ends"). The board sacks the manager, and
  // the career is over: the screen offers a new career or the main menu.
  c.over = true
  sackManager(state, 'news.proFailed', { title_k: `pro.${c.id}`, n: PRO_SEASONS[c.id] })
  state.sacked = null
  state.careerOver = { k: 'over.proFailed', v: { title_k: `pro.${c.id}`, n: PRO_SEASONS[c.id] } }
}
