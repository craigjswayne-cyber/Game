/**
 * ---- A LOAN'S WAGE SHARE IS A SHARE (1.9.4 audit) ----
 *
 * loanIn took the share of the wage the borrowing club pays as given. The
 * Loans screen only offers its few steps (LOAN_SHARES), but the engine is the
 * rule, and a share below nought, above one or not a number at all went
 * straight onto the man: the weekly ledger then paid a negative wage (money
 * made every week from nothing), or a NaN that poisoned the balance. The
 * parent's yes is a dice roll clamped at four per cent, so a few of any
 * list of targets said yes to anything.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { loanIn, loanTargets } from '../src/game/loans'

describe('loanIn', () => {
  for (const share of [-2, 3, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`refuses a wage share of ${share}`, () => {
      const g = newGame('leicester', 'Lender', 81)
      const club = g.clubs[g.userClubId]
      const before = club.players.length
      // every man an AI club would lend, and every other young man in the
      // world, asked in turn: the four per cent floor finds a yes somewhere
      const asks = [...loanTargets(g), ...Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && p.age <= 23)]
      for (const p of asks.slice(0, 400)) loanIn(g, p.id, 'season', share)
      const borrowed = club.players.map(id => g.players[id]).filter(p => p.loanFrom)
      for (const p of borrowed) {
        expect(Number.isFinite(p.loanShare)).toBe(true)
        expect(p.loanShare!).toBeGreaterThanOrEqual(0)
        expect(p.loanShare!).toBeLessThanOrEqual(1)
      }
      expect(club.players.length).toBe(before + borrowed.length)
    })
  }
})
