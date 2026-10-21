// A penalty awarded at the end of the first half holds the whistle until the
// manager answers it (stepTick, heldWhistle). Answered with the corner or a
// tap, the lines it wrote were stamped 41' and 42', ahead of a 40' half-time
// line, because stepTick had already moved seg to 1 and the clock's ceiling
// read seg alone. Everything before half time is in the first half.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { beginMatch, resolveDecision, stepTick } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

describe('held half-time whistle', () => {
  for (const choice of ['corner', 'tap'] as const) {
    it(`a ${choice} answered at the held whistle reads before half time`, () => {
      let late = 0
      for (let s = 0; s < 12; s++) {
        const g = newGame('bath', 'Held', 40 + s)
        let fx = userFixtureThisWeek(g)
        while (!fx) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) }
        const ctx = beginMatch(g, fx, mulberry32(s), true, g.userClubId)
        while (ctx.tick < 9) {
          if (ctx.decision) resolveDecision(g, ctx, 'posts')
          stepTick(g, ctx)
          ctx.awaiting = null
        }
        if (ctx.decision) resolveDecision(g, ctx, 'posts')
        // the closing tick of the half, with a kickable penalty five metres out
        // still waiting for the manager when the clock reaches forty
        const home = ctx.home.teamId === g.userClubId
        ctx.decision = { kind: 'penalty', min: 40, fld: home ? 95 : 5 }
        stepTick(g, ctx)
        expect(ctx.heldWhistle).toBe('HT')
        expect(ctx.events.some(e => e.type === 'HT')).toBe(false)
        ctx.decision = { kind: 'penalty', min: 40, fld: home ? 95 : 5 }
        resolveDecision(g, ctx, choice)
        const ht = ctx.events.findIndex(e => e.type === 'HT')
        expect(ht).toBeGreaterThan(0)
        let prev = 0
        for (const e of ctx.events.slice(0, ht + 1)) {
          if (e.min > 40) late++
          expect(e.min).toBeGreaterThanOrEqual(prev)
          prev = e.min
        }
      }
      expect(late).toBe(0)
    })
  }
})
