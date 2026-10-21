// swapInjuryCover is the free change of the man the assistant sent on for an
// injury. It checked that the man being taken off had not done anything since
// his own "comes on" line, and a starter has no such line, so any starter could
// be swapped off for free, outside the replacement count, with his mark wiped:
// and with no mark he could later come back on as a fresh replacement. The
// match screen only ever offers the injury's cover, so the rule is the engine's.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { beginMatch, makeSubstitution, stepTick, swapInjuryCover, resolveDecision } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

describe('injury cover swap', () => {
  it('only the injury cover can be swapped for free', () => {
    const g = newGame('bath', 'Cover', 99)
    let fx = userFixtureThisWeek(g)
    while (!fx) { processWeekAndAdvance(g); fx = userFixtureThisWeek(g) }
    const ctx = beginMatch(g, fx, mulberry32(3), true, g.userClubId)
    const mine = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
    for (let i = 0; i < 3; i++) { stepTick(g, ctx); if (ctx.decision) resolveDecision(g, ctx, 'posts') }
    const starter = mine.lineup.slice(0, 15).find(id => id != null && mine.onPitch.has(id) && id !== mine.lastInj?.coverId)!
    const benchMan = mine.lineup.slice(15).find(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id))!
    const used = ctx.subsUsed
    const msg = swapInjuryCover(g, ctx, starter, benchMan)
    expect(msg).not.toBe('')
    expect(mine.onPitch.has(starter)).toBe(true)
    expect(mine.onPitch.has(benchMan)).toBe(false)
    expect(mine.ratings.has(starter)).toBe(true)
    expect(ctx.subsUsed).toBe(used)
    // and a man taken off by a real substitution stays off
    const sub = makeSubstitution(g, ctx, starter, benchMan)
    expect(mine.onPitch.has(benchMan)).toBe(true)
    void sub
    const other = mine.lineup.slice(15).find(id => id != null && id !== starter && !mine.onPitch.has(id) && !mine.ratings.has(id))
    const back = mine.lineup.slice(0, 15).find(id => id != null && mine.onPitch.has(id) && id !== benchMan)!
    if (other != null) expect(swapInjuryCover(g, ctx, back, starter)).not.toBe('')
    expect(mine.onPitch.has(starter)).toBe(false)
  })
})
