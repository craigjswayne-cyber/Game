// Tester, 1.9.12: "Zach Mercer does not play for Gloucester any more" and
// "Gloucester are a lot tougher this season". Mercer signed for Toulon for
// 2025-26; the squad files had him a season behind (verified.ts). Gloucester
// were top of the real table after four rounds of 2026-27 and seventh of ten
// in the game on their squad's ratings (prem_a.ts).
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'

const g = newGame('leicester', 'Squads', 11)
const at = (name: string) => Object.values(g.players).filter(p => p.name === name).map(p => p.clubId)

describe('the 2026-27 squads', () => {
  it('Zach Mercer is at Toulon, once', () => {
    expect(at('Zach Mercer')).toEqual(['toulon'])
  })
  it('Albert Tuisue has left Gloucester and James Venter has arrived', () => {
    expect(at('Albert Tuisue')).toEqual(['provence'])
    expect(at('James Venter')).toEqual(['gloucester'])
  })
  it('Gloucester keep the men who came for 2026-27', () => {
    for (const n of ['Jac Morgan', 'Dewi Lake', 'Jean Kleyn', 'Dan Robson']) expect(at(n), n).toEqual(['gloucester'])
  })
  it('Gloucester are in the top half of the league on their best 23', () => {
    const best23 = (id: string) => {
      const ca = g.clubs[id].players.map(i => g.players[i]).filter(p => !p.acad).map(p => p.ca).sort((a, b) => b - a).slice(0, 23)
      return ca.reduce((s, x) => s + x, 0) / ca.length
    }
    const league = Object.values(g.clubs).filter(c => c.leagueId === g.clubs.gloucester.leagueId).map(c => c.id)
    const better = league.filter(id => best23(id) > best23('gloucester')).length
    expect(better).toBeLessThanOrEqual(4)
    // and not the best side in it: Bath and Sarries are still the benchmark
    expect(better).toBeGreaterThanOrEqual(1)
  })
})
