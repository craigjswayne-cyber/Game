/**
 * ---- THE SQUAD SHEET IS A DRAFT UNTIL IT IS NAMED (1.9.16) ----
 *
 * Owner: "I accidentally picked a wrong player when selecting my 32, you
 * should be able to remove anyone until you submit the 32 - only then does
 * the 23 minimum player rule kick in."
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { activeWindows } from '../src/game/season'
import type { GameState } from '../src/game/model'
import { NAT_SQUAD_FLOOR, natCallUp, natDrop } from '../src/game/country'
import { announceSquad, openNatWindow } from '../src/game/natwin'

function camp(seed: number, nat = 'ENG'): GameState {
  const g = newGame('leicester', 'Window', seed)
  g.natTeam = nat
  g.natConfidence = 60
  g.unemployed = true
  const w = activeWindows(g).filter(x => x.nations.includes(nat)).sort((a, b) => a.start - b.start)
    .find(x => g.fixtures.some(f => (f.homeId === nat || f.awayId === nat) && f.week >= x.start && f.week <= x.end))!
  g.week = w.start
  g.natSquads[nat] = []
  g.natSent = []
  openNatWindow(g, w)
  return g
}
const fill = (g: GameState, n: number) => {
  const nat = g.natTeam!
  for (const p of Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.injury).sort((a, b) => b.ca - a.ca)) {
    if (g.natSquads[nat].length >= n) break
    natCallUp(g, p.id)
  }
}

describe('dropping from the draft sheet', () => {
  it('lets a man come off a short, unannounced sheet', () => {
    const g = camp(11)
    fill(g, 16)
    const squad = g.natSquads.ENG
    expect(squad.length).toBe(16)
    expect(natDrop(g, squad[squad.length - 1])).toBeNull()
    expect(squad.length).toBe(15)
  })

  it('a call and a drop before the announcement leaves him exactly as he was', () => {
    const g = camp(12)
    const p = Object.values(g.players).filter(q => q.nat === 'ENG' && q.clubId && !q.injury).sort((a, b) => b.ca - a.ca)[0]
    for (const start of [5, 9.8]) {
      p.morale = start
      expect(natCallUp(g, p.id)).toBeNull()
      expect(natDrop(g, p.id)).toBeNull()
      expect(p.morale).toBeCloseTo(start, 6)
      expect(p.natSquad).toBe(false)
      expect(g.natSent ?? []).not.toContain(p.id)
    }
  })

  it('an announced squad cannot be trimmed below 23', () => {
    const g = camp(13)
    fill(g, NAT_SQUAD_FLOOR + 1)
    announceSquad(g, [])
    const squad = g.natSquads.ENG
    expect(natDrop(g, squad[squad.length - 1])).toBeNull()
    expect(squad.length).toBe(NAT_SQUAD_FLOOR)
    const refusal = natDrop(g, squad[squad.length - 1])
    expect(refusal).toContain(String(NAT_SQUAD_FLOOR))
    expect(squad.length).toBe(NAT_SQUAD_FLOOR)
  })
})
