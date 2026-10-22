// A knockout tie is settled once. The live screen settles a tie level at the
// whistle there and then (store/live.ts settleKnockout), and when extra time
// leaves it level the decider goes on the fixture with the score still level.
// The week's settle then tables the fixture and reached resolveKnockoutDraw a
// second time: another extra time, points on the record the ticker never
// showed, and a winner that could disagree with the decider.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, resolveKnockoutDraw } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'

describe('knockout extra time', () => {
  it('a tie already settled on tries or kicks is not played again', () => {
    const g = newGame('leicester', 'KO', 7)
    for (let s = 0; s < 200; s++) {
      const fx: Fixture = {
        id: 1, compId: 'prem', round: 99, week: 1, homeId: 'leicester', awayId: 'exeter', stage: 'SF',
        played: true, homeScore: 20, awayScore: 20, homeTries: 2, awayTries: 2,
      }
      resolveKnockoutDraw(g, fx, mulberry32(s))
      if (!fx.decider) continue
      const before = JSON.stringify(fx)
      for (let t = 0; t < 20; t++) {
        expect(resolveKnockoutDraw(g, fx, mulberry32(1000 + t))).toEqual([])
        expect(JSON.stringify(fx)).toBe(before)
      }
    }
  })

  it('the week settle leaves a watched tie as the screen settled it', () => {
    const g = newGame('leicester', 'KO', 7)
    const mine = () => g.fixtures.find(f => f.week === g.week && !f.played && !!g.comps[f.compId] &&
      (f.homeId === g.userClubId || f.awayId === g.userClubId))
    let fx = mine()
    while (!fx) { processWeekAndAdvance(g); fx = mine() }
    // the match as the MatchDay screen leaves it: played, not tabled, level
    // at full time and settled on tries after a scoreless extra time
    fx.stage = 'SF'
    fx.played = true
    fx.homeScore = 20; fx.awayScore = 20; fx.homeTries = 3; fx.awayTries = 2
    fx.decider = { by: 'tries', winner: fx.homeId }
    processWeekAndAdvance(g)
    expect([fx.homeScore, fx.awayScore, fx.homeTries, fx.awayTries]).toEqual([20, 20, 3, 2])
    expect(fx.aet).toBeUndefined()
    expect(fx.decider).toEqual({ by: 'tries', winner: fx.homeId })
    expect(fx.tableApplied).toBe(true)
  })
})
