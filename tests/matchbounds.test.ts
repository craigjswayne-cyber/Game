// A side with eleven or more men missing (a squad of ten, then men lost that
// nobody can replace) had a negative strength factor (tick.ts numF), and a
// negative attacking ratio raised to a fractional power is NaN: possession and
// pressure went NaN for the rest of the match. The state is forced here, since
// reaching it naturally needs a run of injuries no seed is likely to give.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick, resolveDecision } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'

describe('match numbers stay numbers', () => {
  it('possession and pressure stay finite with most of a side missing', () => {
    const g = newGame('leicester', 'Bounds', 4242)
    for (let s = 0; s < 6; s++) {
      const fx: Fixture = {
        id: g.nextId++, compId: 'fr', round: 0, week: g.week, homeId: 'leicester', awayId: 'northampton',
        played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
      }
      g.fixtures.push(fx)
      const ctx = beginMatch(g, fx, mulberry32(s), false, null)
      ctx.home.short = 11
      ctx.derby = s % 2 === 0
      while (ctx.seg < 3) {
        stepTick(g, ctx)
        if (ctx.decision) resolveDecision(g, ctx, 'posts')
        ctx.awaiting = null
        for (const side of [ctx.home, ctx.away]) {
          expect(Number.isFinite(side.poss)).toBe(true)
          expect(Number.isFinite(side.pressure)).toBe(true)
        }
      }
      expect(Number.isInteger(fx.homeScore) && Number.isInteger(fx.awayScore)).toBe(true)
    }
  })
})
