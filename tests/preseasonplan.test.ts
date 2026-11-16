/**
 * The season plan (1.9.14, src/game/preseasonplan.ts): two questions on Home
 * in pre-season. How you play sets an attack and a defence style; the
 * pre-season work sets the training focus (and Set-Piece Work for set pieces).
 * It adds no rule of its own and leaves the set-piece calls alone.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { FOCUS_OF, STYLE_OF, planThisSeason, planWeeks, setPreseasonPlan } from '../src/game/preseasonplan'

describe('the season plan', () => {
  it('is offered in pre-season and not once the season starts', () => {
    const g = newGame('leicester', 'Plan', 3)
    expect(planWeeks(g)).toBe(true)
    g.week = 10
    expect(planWeeks(g)).toBe(false)
    g.week = 1; g.unemployed = true
    expect(planWeeks(g)).toBe(false)
  })

  it.each(['forwards', 'balanced', 'backs'] as const)('%s sets its attack and defence styles', style => {
    const g = newGame('leicester', 'Plan', 3)
    setPreseasonPlan(g, style, 'fitness')
    const tac = g.clubs[g.userClubId].tactic
    expect(tac.atkStyle).toBe(STYLE_OF[style].atk)
    expect(tac.defStyle).toBe(STYLE_OF[style].def)
  })

  it.each(['fitness', 'setpiece', 'attack'] as const)('%s sets the training focus', work => {
    const g = newGame('leicester', 'Plan', 3)
    setPreseasonPlan(g, 'balanced', work)
    expect(g.training).toBe(FOCUS_OF[work])
    expect(g.matchPrep === 'setpiece').toBe(work === 'setpiece')
  })

  it('leaves the set-piece calls alone, and ticks the checklist', () => {
    const g = newGame('leicester', 'Plan', 3)
    const tac = g.clubs[g.userClubId].tactic
    const lo = tac.lineoutCall, sc = tac.scrumCall
    setPreseasonPlan(g, 'forwards', 'setpiece')
    expect(tac.lineoutCall).toBe(lo)
    expect(tac.scrumCall).toBe(sc)
    expect(g.firstSteps?.seen).toContain('plan')
  })

  it('belongs to one season', () => {
    const g = newGame('leicester', 'Plan', 3)
    setPreseasonPlan(g, 'backs', 'attack')
    expect(planThisSeason(g)?.style).toBe('backs')
    g.season += 1
    expect(planThisSeason(g)).toBeNull()
  })
})
