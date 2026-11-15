// What the fans think, and why (owner, 1.9.13): fans.ts.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { FAN_CAUSES, moveFans, setFans } from '../src/game/fans'
import { migrate } from '../src/game/save'

describe('the fans\' ledger', () => {
  it('books every move under its cause, inside the bounds', () => {
    const g = newGame('northampton', 'Fans', 4)
    g.fanMood = 96
    expect(moveFans(g, 10, 'results')).toBeCloseTo(2)   // capped at 98
    expect(g.fanWhy?.results).toBeCloseTo(2)
    setFans(g, 50, 'manager')
    expect(g.fanMood).toBe(50)
    expect(g.fanWhy?.manager).toBeCloseTo(-48)
  })
  it('the four causes add up to how far the season moved them', () => {
    const g = newGame('northampton', 'Fans', 4)
    const start = g.fanMood ?? 60
    for (let w = 0; w < 20; w++) processWeekAndAdvance(g)
    const w = g.fanWhy!
    expect(w.season).toBe(g.season)
    const sum = FAN_CAUSES.reduce((s, c) => s + w[c], 0)
    expect(Math.abs(sum - ((g.fanMood ?? 60) - start))).toBeLessThan(0.5)
    expect(w.results).not.toBe(0)
  })
  it('a damaged ledger is dropped on load', () => {
    const g = newGame('northampton', 'Fans', 4)
    ;(g as unknown as Record<string, unknown>).fanWhy = { season: 0, results: 'x' }
    migrate(g)
    expect(g.fanWhy).toBeUndefined()
  })
})
