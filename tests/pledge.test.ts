/**
 * ---- NO PROMISE FALLS DUE BEFORE IT IS MADE (1.9.2; the arithmetic of
 * scripts/pledgeprobe.ts, which still plays the summer window for real) ----
 *
 * Due weeks were Math.min(week + span, 44): a promise made in the summer
 * window (week 46) fell due in a week already gone and was judged broken with
 * no match played. model.pledgeDue and rollover.carryPledges now give the
 * full span in season, a capped one late on, a due week past the season after
 * that, and carry a late promise into the new season.
 */
import { describe, expect, it } from 'vitest'
import { carryPledges } from '../src/game/rollover'
import { LAST_PLEDGE_WEEK, SEASON_WEEKS, pledgeDue } from '../src/game/model'

describe('pledgeDue', () => {
  it('gives the full span in season', () => {
    expect(pledgeDue(10, 6)).toBe(16)
  })
  it('is due at the last playing week with three or more weeks to play', () => {
    expect(pledgeDue(40, 6)).toBe(LAST_PLEDGE_WEEK)
  })
  it('is due past the season with less than that to play', () => {
    expect(pledgeDue(43, 6)).toBeGreaterThan(LAST_PLEDGE_WEEK)
  })
  it.each([45, 46, 47, 48])('made in week %i, falls due after it', (w) => {
    expect(pledgeDue(w, 6)).toBeGreaterThan(w)
  })
  it('never falls due before it is made, whatever the week and span', () => {
    for (let w = 1; w <= SEASON_WEEKS; w++) for (const span of [1, 3, 6, 10]) {
      expect(pledgeDue(w, span), `week ${w}, span ${span}`).toBeGreaterThan(w)
    }
  })
})

describe('carryPledges', () => {
  const carried = carryPledges([
    { playerId: 1, kind: 'plans', week: 46, season: 2026, due: 52, baseApps: 9 },
    { playerId: 2, kind: 'plans', week: 30, season: 2026, due: 36, baseApps: 4 },
    { playerId: 3, kind: 'start', week: 47, season: 2026, due: 47, baseApps: 0 },
    { playerId: 4, kind: 'deal', week: 46, season: 2025, due: 54, baseApps: 0 },
  ], 2027)

  it('carries only the late promise from last season', () => {
    expect(carried.map(c => c.playerId)).toEqual([1])
  })
  it('moves it to the new season, appearances counted from zero', () => {
    expect(carried[0].season).toBe(2027)
    expect(carried[0].baseApps).toBe(0)
  })
  it('makes it due after pre-season, with the weeks still owed', () => {
    expect(carried[0].due).toBeGreaterThan(3)
    expect(carried[0].due).toBeLessThanOrEqual(3 + 6)
  })
  it('remembers when it was made', () => {
    expect(carried[0].week).toBe(46 - SEASON_WEEKS)
  })
})
