// Player report (1.9.12 feedback, in French): conversions and penalties
// attempted and made with the success rate, and tackles, per player and as
// league leaderboards. The engine already decided every kick and counted every
// tackle; nothing kept them on the season.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { kickRecord } from '../src/game/model'
import { migrate } from '../src/game/save'

function played(weeks = 8) {
  const g = newGame('northampton', 'Kicks', 31)
  for (let w = 0; w < weeks; w++) processWeekAndAdvance(g)
  return g
}

describe('kicks and tackles on the season', () => {
  const g = played()
  const all = Object.values(g.players)

  it('every kick made was a kick taken', () => {
    for (const p of all) {
      expect(p.stats.conA ?? 0).toBeGreaterThanOrEqual(p.stats.cons)
      expect(p.stats.penA ?? 0).toBeGreaterThanOrEqual(p.stats.pens)
    }
  })

  it('kicks are being taken and missed across the league', () => {
    const taken = all.reduce((s, p) => s + (p.stats.conA ?? 0) + (p.stats.penA ?? 0), 0)
    const made = all.reduce((s, p) => s + p.stats.cons + p.stats.pens, 0)
    expect(taken).toBeGreaterThan(100)
    // a league kicks somewhere between six and nine in ten
    expect(made / taken).toBeGreaterThan(0.5)
    expect(made / taken).toBeLessThan(0.95)
  })

  it('tackles are counted, for the men who played', () => {
    const tacklers = all.filter(p => (p.stats.tkl ?? 0) > 0)
    expect(tacklers.length).toBeGreaterThan(100)
    for (const p of tacklers) expect(p.stats.apps).toBeGreaterThan(0)
  })

  it('kickRecord gives the rate from what was counted', () => {
    const k = kickRecord({ ...all[0].stats, cons: 8, conA: 10, pens: 3, penA: 4, con0: 0, pen0: 0 })
    expect(k.con).toEqual({ made: 8, att: 10, pct: 80 })
    expect(k.pen).toEqual({ made: 3, att: 4, pct: 75 })
    expect(k.all).toEqual({ made: 11, att: 14, pct: 79 })
    expect(kickRecord({ ...all[0].stats, cons: 0, conA: 0, pens: 0, penA: 0 }).all).toBeNull()
  })
})

describe('a season under way from before 1.9.12', () => {
  it('sets aside what was made before attempts were counted', () => {
    const g = played(6)
    const kicker = Object.values(g.players).find(p => p.stats.cons > 0)!
    const made = kicker.stats.cons
    // as an old save has it: kicks made, nothing taken, no tackles
    for (const p of Object.values(g.players)) {
      delete p.stats.conA; delete p.stats.penA; delete p.stats.tkl
      delete p.stats.con0; delete p.stats.pen0
    }
    migrate(g)
    expect(kicker.stats.con0).toBe(made)
    expect(kicker.stats.conA).toBe(0)
    expect(kickRecord(kicker.stats).con).toBeNull()
    // and from then on the rate reads only the new kicks, never over 100%
    for (let w = 0; w < 4; w++) processWeekAndAdvance(g)
    for (const p of Object.values(g.players)) {
      const k = kickRecord(p.stats)
      if (k.all) expect(k.all.pct).toBeLessThanOrEqual(100)
    }
  })
})
