// The physio's report (owner, 1.9.13, from FM27 Mobile): game/physio.ts.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { injuryRisk, physioReport } from '../src/game/physio'
import type { GameState, Player } from '../src/game/model'

function squad(): { g: GameState; ps: Player[] } {
  const g = newGame('northampton', 'Physio', 9)
  const ps = g.clubs[g.userClubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad)
  for (const p of ps) { p.cond = 95; p.rust = 0; p.age = 26; p.stats.mins = 0; p.injury = undefined }
  return { g, ps }
}

describe('injury risk', () => {
  it('is the engine\'s own factors, multiplied', () => {
    const { g, ps } = squad()
    const p = ps[0]
    expect(injuryRisk(g, p).tier).toBe('low')
    p.cond = 50
    p.stats.mins = 1400
    const r = injuryRisk(g, p)
    expect(r.why).toEqual(expect.arrayContaining(['tired', 'redZone']))
    expect(r.f).toBeGreaterThanOrEqual(1.7 * 1.5 - 1e-9)
    expect(r.tier).toBe('high')
  })
})

describe('the report', () => {
  it('a fresh squad can train hard', () => {
    const { g } = squad()
    const r = physioReport(g)
    expect(r.high).toBe(0)
    expect(r.recommend).toBe('hard')
  })
  it('a squad with several on the edge is told to ease off', () => {
    const { g, ps } = squad()
    for (const p of ps.slice(0, 4)) { p.cond = 50; p.rust = 2 }
    const r = physioReport(g)
    expect(r.high).toBeGreaterThanOrEqual(3)
    expect(r.recommend).toBe('light')
    expect(r.rows[0].tier).toBe('high')
  })
  it('the injured are in the treatment room, not on the risk list', () => {
    const { g, ps } = squad()
    ps[0].cond = 40
    ps[0].injury = { type: 'x', until: 99 } as unknown as Player['injury']
    expect(physioReport(g).rows.some(r => r.p.id === ps[0].id)).toBe(false)
  })
})
