// Owner's stats scan, 10 Nov 2026: Sarries women opened with 50 seniors
// against a registration limit of 46, so that job began unable to sign anyone.
// No club may open over the limit, and nobody is lost who need not be.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { SQUAD_LIMIT, seniorsOf } from '../src/game/transferRules'

describe('no club opens over the registration limit', () => {
  for (const [club, gender] of [['w:saracens', 'w'], ['northampton', 'm']] as const) {
    it(`${gender === 'w' ? "women's" : "men's"} world`, () => {
      const g = newGame(club, 'Limit', 5, undefined, 'coach', gender, 'm')
      for (const c of Object.values(g.clubs)) {
        expect(seniorsOf(g, c), c.name).toBeLessThanOrEqual(SQUAD_LIMIT)
        // a full XV and bench still picked, from players still at the club
        const xv = c.tactic.lineup.slice(0, 15)
        for (const id of xv) if (id != null) expect(c.players, c.name).toContain(id)
      }
    })
  }
  it('Sarries women keep everyone they can: the youngest go to the academy', () => {
    const g = newGame('w:saracens', 'Limit', 5, undefined, 'coach', 'w', 'm')
    const c = g.clubs['w:saracens']
    expect(seniorsOf(g, c)).toBe(SQUAD_LIMIT)
    expect(c.tactic.lineup.slice(0, 15).every(id => id != null)).toBe(true)
  })
})
