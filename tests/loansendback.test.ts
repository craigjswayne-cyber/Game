// Player report (1.9.12 feedback, in French): a player on loan TO you could be
// put on the transfer list, which should not be possible, and a loan could not
// be ended early. A loanee now arrives off any list, and loanSendBack ends a
// loan after the four-week floor, with no development payoff.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { LOAN_SEND_BACK_MIN_WEEKS, loanIn, loanMarket, loanSendBack } from '../src/game/loans'
import { absWeek, type GameState, type Player } from '../src/game/model'
import { t } from '../src/game/i18n'

/** A career with one man borrowed, whatever the market will lend first. */
function borrowed(): { g: GameState; p: Player; parent: string } {
  const g = newGame('northampton', 'Loans', 21)
  for (const cand of loanMarket(g)) {
    const parent = cand.clubId!
    cand.transferListed = true   // his parent had him listed
    for (const share of [1, 0.75, 0.5]) {
      loanIn(g, cand.id, 'season', share)
      if (cand.loanFrom) return { g, p: cand, parent }
    }
    cand.transferListed = false
  }
  throw new Error('nobody would lend a player')
}

describe('a player on loan to you', () => {
  it('arrives off his parent club\'s transfer list', () => {
    const { p } = borrowed()
    expect(p.transferListed).toBe(false)
  })

  it('cannot be sent back inside the first four weeks', () => {
    const { g, p } = borrowed()
    const r = loanSendBack(g, p.id)
    expect(r.ok).toBe(false)
    expect(r.k).toBe('reply.sendBackTooSoon')
    expect(p.clubId).toBe(g.userClubId)
  })

  it('goes back to his parent club after that, with no development payoff', () => {
    const { g, p, parent } = borrowed()
    p.joinedAt = absWeek(g.season, g.week) - LOAN_SEND_BACK_MIN_WEEKS
    const ca = p.ca
    const r = loanSendBack(g, p.id)
    expect(r.ok, r.msg).toBe(true)
    expect(p.clubId).toBe(parent)
    expect(p.loanFrom).toBeNull()
    expect(g.clubs[g.userClubId].players).not.toContain(p.id)
    expect(g.clubs[parent].players).toContain(p.id)
    expect(g.clubs[g.userClubId].tactic.lineup).not.toContain(p.id)
    expect(p.ca).toBe(ca)
    const story = g.news[g.news.length - 1]
    expect(story.k).toBe('news.loanSentBack')
  })

  it('says why in words, not a key', () => {
    const { g, p } = borrowed()
    const msg = loanSendBack(g, p.id).msg
    expect(msg).not.toMatch(/^reply\./)
    expect(t('player.loanSendBack', { club: 'X' })).toBe('Send back to X')
  })

  it('is refused for a man who is not on loan to you', () => {
    const g = newGame('northampton', 'Loans', 21)
    const own = g.players[g.clubs[g.userClubId].players[0]]
    expect(loanSendBack(g, own.id).ok).toBe(false)
  })
})
