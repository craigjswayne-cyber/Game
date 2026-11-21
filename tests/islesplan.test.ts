/**
 * ---- ON TOUR THE PLAN IS THE TOUR'S (1.9.16) ----
 *
 * natcamp.ts was keyed on the coach's own country. On an Isles tour the Test
 * preview showed the dials, the captain and the camp focus, and the engine
 * read none of them for the tour side; the camp focus went to his country,
 * which his assistant had. The side he coaches this week owns all three, and
 * his country's plan is waiting for him when he is home.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { applyCamp, applyNatPlan, campFocus, coachedSide, natCaptain, natPlanOf } from '../src/game/natcamp'
import type { SideCtx } from '../src/game/match/side'

const side = (teamId: string) => ({ teamId, units: { attack: 100, defence: 100, scrum: 100, lineout: 100, breakdown: 100, kicking: 100 }, tempoF: 1, cardRisk: 0, drainF: 1 } as unknown as SideCtx)

describe('the Isles tour owns the plan', () => {
  it('dials, captain and camp focus reach the tour side and not his country', () => {
    const g = newGame('leicester', 'Tour', 9)
    g.natTeam = 'ENG'
    const home = natPlanOf(g)!
    home.kicking = 80; home.captain = 111
    expect(coachedSide(g)).toBe('ENG')
    // the tour: he said yes and the party is named
    g.isles = { season: g.season, answer: 'yes' }
    g.natSquads['LIO'] = [1, 2, 3]
    expect(coachedSide(g)).toBe('LIO')
    const tour = natPlanOf(g)!
    expect(tour.nat).toBe('LIO')
    expect(tour.kicking).toBe(50)
    tour.style = 100; tour.captain = 222
    expect(natCaptain(g, 'LIO')).toBe(222)
    expect(natCaptain(g, 'ENG')).toBeNull()
    const isles = side('LIO'), eng = side('ENG')
    applyNatPlan(g, isles); applyNatPlan(g, eng)
    expect(isles.units.attack).toBeGreaterThan(100)
    expect(eng.units.attack).toBe(100)
    g.natCamp = { nat: 'LIO', season: g.season, start: g.week, end: g.week, focus: 'setpiece' }
    expect(campFocus(g)).toBe('setpiece')
    const i2 = side('LIO'), e2 = side('ENG')
    applyCamp(g, i2); applyCamp(g, e2)
    expect(i2.units.scrum).toBeGreaterThan(100)
    expect(e2.units.scrum).toBe(100)
    // home again: the party is released and his country's plan comes back
    delete g.natSquads['LIO']
    expect(coachedSide(g)).toBe('ENG')
    const back = natPlanOf(g)!
    expect(back.nat).toBe('ENG')
    expect(back.kicking).toBe(80)
    expect(back.captain).toBe(111)
  })
})
