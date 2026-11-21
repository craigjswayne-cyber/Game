/**
 * ---- FIRE SALE, HARDER AND HONEST; THE CHALLENGE CARD AFTER THE TROPHY (1.9.16) ----
 * Owner's answers of 21 Nov 2026: reword "clears the debts" (no club starts in
 * debt), make Fire Sale harder, and show a challenge-complete card after the
 * trophy card.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { proCheck, startProChallenge } from '../src/game/prochallenge'
import { capBill } from '../src/game/cap'
import { userWageBudget } from '../src/game/grants'
import en from '../src/locales/en.json'

describe('Fire Sale', () => {
  const base = newGame('leicester', 'Fire', 91)
  const g = newGame('leicester', 'Fire', 91)
  startProChallenge(g, 'firesale')
  const uid = g.userClubId
  const room = (s: typeof g) => userWageBudget(s, s.clubs[uid]) - capBill(s, s.clubs[uid])
  it('five men are gone', () => { expect(base.clubs[uid].players.length - g.clubs[uid].players.length).toBe(5) })
  it('selling them opens no wage room: the room after is the room before', () => {
    expect(room(g)).toBeLessThanOrEqual(room(base) + 1)
    expect(room(g)).toBeGreaterThanOrEqual(0)
  })
  it('none of the fees is in the budget or the bank', () => {
    expect(g.clubs[uid].budget).toBe(base.clubs[uid].budget)
    expect(g.clubs[uid].balance).toBe(base.clubs[uid].balance)
  })
  it('the wording no longer talks about debts no club has', () => {
    const s = (en as unknown as { pro: Record<string, string> }).pro.firesaleDesc
    expect(s).not.toMatch(/debt/i)
    expect(s).toMatch(/owners keep/)
  })
})

describe('the challenge-complete card', () => {
  const done = () => {
    const g = newGame('leicester', 'Card', 92)
    startProChallenge(g, 'firesale')
    g.season = 1
    g.history.push({ season: 0, compId: g.clubs[g.userClubId].leagueId, champion: g.userClubId } as (typeof g.history)[number])
    return g
  }
  it('shows on its own when nothing else is waiting', () => {
    const g = done(); g.celebration = null
    proCheck(g)
    expect(g.proChallenge?.done).toBe(true)
    expect(g.celebration?.hk).toBe('cel.challenge')
    expect(g.celebrationNext ?? null).toBeNull()
  })
  it('waits behind a trophy card instead of being lost to it', () => {
    const g = done()
    g.celebration = { headline: 'Champions', sub: '', icon: 'trophy', hk: 'cel.champions' }
    proCheck(g)
    expect(g.celebration?.hk).toBe('cel.champions')
    expect(g.celebrationNext?.hk).toBe('cel.challenge')
  })
})
