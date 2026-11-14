// An option to buy, or a move he earns (owner, 1.9.13: "the option to buy
// should be with only a few loan players, most should be on how many times
// they play and if the player is happy").
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import {
  LOAN_BUY_MIN_WEEKS, LOAN_EARN_APPS, LOAN_EARN_MORALE, LOAN_OPTION_SHARE,
  loanBuyOffer, loanHasOption, loanIn, loanMarket, loanOut,
} from '../src/game/loans'
import { absWeek, type GameState, type Player } from '../src/game/model'
import { migrate } from '../src/game/save'

function borrowed(seed = 21): { g: GameState; p: Player } {
  const g = newGame('northampton', 'Loans', seed)
  for (const cand of loanMarket(g)) {
    for (const share of [1, 0.75, 0.5]) {
      loanIn(g, cand.id, 'season', share)
      if (cand.loanFrom) return { g, p: cand }
    }
  }
  throw new Error('nobody would lend a player')
}

/** Past the eight weeks, in a window, with money and a club willing to sell:
 *  only the option rule is left to say yes or no. */
function readyToBuy(g: GameState, p: Player) {
  p.joinedAt = absWeek(g.season, g.week) - LOAN_BUY_MIN_WEEKS
  g.week = 1   // the summer window
  g.clubs[g.userClubId].budget = 1e9
  const parent = g.clubs[p.loanFrom!]
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === p.id ? null : id))
  p.loanCa = p.ca
}

describe('the option to buy', () => {
  it('comes with only a few loans', () => {
    const g = newGame('northampton', 'Loans', 5)
    // read across the world: which players carry it is a hash, so the share
    // over thousands is the rate, and the market today is a sample of them
    const pool = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId)
    const share = pool.filter(p => loanHasOption(g, p)).length / pool.length
    expect(pool.length).toBeGreaterThan(1000)
    expect(share).toBeGreaterThan(LOAN_OPTION_SHARE - 0.03)
    expect(share).toBeLessThan(LOAN_OPTION_SHARE + 0.03)
  })
  it('is written into the deal at signing, as the sheet said', () => {
    const { g, p } = borrowed()
    expect(typeof p.loanOpt).toBe('boolean')
    expect(loanHasOption(g, p)).toBe(p.loanOpt)
    expect(p.loanApps).toBe(0)
  })
  it('without it, he must have played and be happy before his club will talk', () => {
    const { g, p } = borrowed()
    p.loanOpt = false
    readyToBuy(g, p)
    p.morale = 9
    p.loanApps = LOAN_EARN_APPS - 1
    expect(loanBuyOffer(g, p.id)?.k).toBe('reply.loanBuyNotEarned')
    p.loanApps = LOAN_EARN_APPS
    p.morale = LOAN_EARN_MORALE - 0.5
    expect(loanBuyOffer(g, p.id)?.k).toBe('reply.loanBuyUnhappy')
    p.morale = LOAN_EARN_MORALE
    expect(loanBuyOffer(g, p.id)?.ok).toBe(true)
  })
  it('with it, the games and the mood do not matter', () => {
    const { g, p } = borrowed()
    p.loanOpt = true
    readyToBuy(g, p)
    p.loanApps = 0
    p.morale = 3
    expect(loanBuyOffer(g, p.id)?.ok).toBe(true)
  })
  it('a loan from before 1.9.13 keeps the option it was signed with', () => {
    const { g, p } = borrowed()
    delete p.loanOpt
    delete p.loanApps
    migrate(g)
    expect(loanHasOption(g, p)).toBe(true)
  })
  it('and a player on loan to you cannot be lent out again', () => {
    const { g, p } = borrowed()
    p.age = 20
    expect(loanOut(g, p.id).ok).toBe(false)
  })
})
