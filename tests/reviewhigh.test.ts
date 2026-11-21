/**
 * ---- THE RATING CARD IS ASKED FOR ON A HIGH (1.9.16) ----
 * Owner: "a rate our game pop up to a high of winning a derby match or
 * something similar... Just once per game if they haven't already done it."
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { highDue, reviewHigh, HIGH_AFTER } from '../src/game/reviewask'
import { isDerby } from '../src/game/rivalries'
import type { GameState } from '../src/game/model'

const world = () => newGame('northampton', 'Cal', 5)
/** play a made-up result into the world for the user's club */
function result(g: GameState, opp: string, mine: number, theirs: number, o: { compId?: string; stage?: string; home?: boolean } = {}) {
  const home = o.home ?? true
  g.fixtures.push({
    id: 9_000_000 + g.fixtures.length, compId: o.compId ?? g.clubs[g.userClubId].leagueId, round: 0, week: g.week,
    homeId: home ? g.userClubId : opp, awayId: home ? opp : g.userClubId, played: true,
    homeScore: home ? mine : theirs, awayScore: home ? theirs : mine, homeTries: 0, awayTries: 0, stage: o.stage,
  })
}
const rival = (g: GameState) => Object.keys(g.clubs).find(c => c !== g.userClubId && isDerby(g.userClubId, c))!
const plain = (g: GameState) => Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId
  && !isDerby(g.userClubId, c.id) && Math.abs(c.rep - g.clubs[g.userClubId].rep) < 8)!.id

describe('reviewHigh', () => {
  it('Northampton have a derby to win', () => { expect(rival(world())).toBeTruthy() })
  it('a derby win is a high', () => { const g = world(); result(g, rival(g), 22, 19); expect(reviewHigh(g)).toBe('derby') })
  it('a derby defeat is not, and nor is a draw', () => {
    const g = world(); result(g, rival(g), 19, 22); expect(reviewHigh(g)).toBeNull()
    const h = world(); result(h, rival(h), 19, 19); expect(reviewHigh(h)).toBeNull()
  })
  it('a final won is a high, away from home too', () => {
    const g = world(); result(g, plain(g), 15, 12, { stage: 'F', home: false }); expect(reviewHigh(g)).toBe('final')
  })
  it('an ordinary narrow win is not', () => { const g = world(); result(g, plain(g), 20, 17); expect(reviewHigh(g)).toBeNull() })
  it('a win by twenty is', () => { const g = world(); result(g, plain(g), 41, 10); expect(reviewHigh(g)).toBe('big') })
  it('a friendly never is', () => { const g = world(); result(g, rival(g), 50, 0, { compId: 'fr' }); expect(reviewHigh(g)).toBeNull() })
  it('the moment passes: two weeks on it is gone', () => {
    const g = world(); result(g, rival(g), 22, 19); g.week += 1; expect(reviewHigh(g)).toBe('derby'); g.week += 1; expect(reviewHigh(g)).toBeNull()
  })
  it('a man between jobs is not asked', () => { const g = world(); result(g, rival(g), 22, 19); g.unemployed = true; expect(reviewHigh(g)).toBeNull() })
})

describe('highDue', () => {
  const none = { n: 0, at: 0 }
  it('asks after a derby win once the device has seen a few matches', () => {
    const g = world(); result(g, rival(g), 22, 19)
    expect(highDue(g, HIGH_AFTER - 1, none)).toBe(false)
    expect(highDue(g, HIGH_AFTER, none)).toBe(true)
  })
  it('once a career', () => { const g = world(); result(g, rival(g), 22, 19); g.rateAsked = true; expect(highDue(g, 40, none)).toBe(false) })
  it('not straight after the counted ask, and never after the third', () => {
    const g = world(); result(g, rival(g), 22, 19)
    expect(highDue(g, 12, { n: 1, at: 8 })).toBe(false)
    expect(highDue(g, 18, { n: 1, at: 8 })).toBe(true)
    expect(highDue(g, 500, { n: 3, at: 98 })).toBe(false)
  })
  it('no high, no ask', () => { const g = world(); result(g, plain(g), 20, 17); expect(highDue(g, 40, none)).toBe(false) })
})
