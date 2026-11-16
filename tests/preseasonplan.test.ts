/**
 * The season plan (1.9.14, src/game/preseasonplan.ts): two questions on Home
 * in pre-season. How you play sets an attack and a defence style; the
 * pre-season work sets the training focus (and Set-Piece Work for set pieces).
 * It adds no rule of its own and leaves the set-piece calls alone.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { FOCUS_OF, STYLE_OF, planOpen, planSeason, planThisSeason, setPreseasonPlan } from '../src/game/preseasonplan'
import { processWeekAndAdvance } from '../src/game/season'

describe('the season plan', () => {
  it('is open in pre-season, and not for an unemployed manager', () => {
    const g = newGame('leicester', 'Plan', 3)
    expect(planOpen(g)).toBe(true)
    expect(planSeason(g)).toBe(g.season)
    g.unemployed = true
    expect(planOpen(g)).toBe(false)
  })

  it('closes at the first league match, opens after the last game for next season, and carries over', () => {
    const g = newGame('leicester', 'Plan', 3)
    const s0 = g.season
    const mine = () => g.fixtures.filter(f => (f.homeId === g.userClubId || f.awayId === g.userClubId) && f.compId !== 'fr')
    const leaguePlayed = () => mine().some(f => f.compId === g.clubs[g.userClubId].leagueId && f.played)
    // through the pre-season: open until the first league match is played
    let guard = 0
    while (!leaguePlayed() && guard++ < 30) { expect(planOpen(g)).toBe(true); processWeekAndAdvance(g) }
    expect(planOpen(g)).toBe(false)
    // in the season it stays shut while any competitive game is left
    while (g.season === s0 && mine().some(f => !f.played) && guard++ < 80) {
      expect(planOpen(g)).toBe(false)
      processWeekAndAdvance(g)
    }
    // the summer: open, for next season
    if (g.season === s0) {
      expect(planOpen(g)).toBe(true)
      expect(planSeason(g)).toBe(s0 + 1)
      setPreseasonPlan(g, 'backs', 'attack')
      while (g.season === s0 && guard++ < 120) { expect(planOpen(g)).toBe(true); processWeekAndAdvance(g) }
    }
    // the new pre-season: still open, and a summer plan counts for it
    expect(g.season).toBe(s0 + 1)
    expect(planOpen(g)).toBe(true)
    expect(planThisSeason(g)?.style).toBe('backs')
  }, 120_000)

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
