/**
 * The season plan (1.9.14, src/game/preseasonplan.ts): one card in pre-season
 * that writes the styles, the set-piece calls and the training focus where
 * their own screens read them. It adds no rule of its own.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { planDraft, planThisSeason, planWeeks, setPreseasonPlan } from '../src/game/preseasonplan'
import { stylesOf } from '../src/game/styles'

describe('the season plan', () => {
  it('is offered in pre-season and not once the season starts', () => {
    const g = newGame('leicester', 'Plan', 3)
    expect(planWeeks(g)).toBe(true)
    g.week = 10
    expect(planWeeks(g)).toBe(false)
    g.week = 1; g.unemployed = true
    expect(planWeeks(g)).toBe(false)
  })

  it('opens on the club as it stands', () => {
    const g = newGame('leicester', 'Plan', 3)
    const d = planDraft(g)
    const st = stylesOf(g, g.clubs[g.userClubId])!
    expect(d.atk).toBe(st.atk)
    expect(d.def).toBe(st.def)
    expect(d.focus).toBe(g.training)
  })

  it('writes each choice where its own screen reads it', () => {
    const g = newGame('leicester', 'Plan', 3)
    setPreseasonPlan(g, { atk: 'kick', def: 'choke', lineout: 'lo_back', scrum: 'sc_wheel', focus: 'kicking', setpiece: true })
    const tac = g.clubs[g.userClubId].tactic
    expect(tac.atkStyle).toBe('kick')
    expect(tac.defStyle).toBe('choke')
    expect(tac.lineoutCall).toBe('lo_back')
    expect(tac.scrumCall).toBe('sc_wheel')
    expect(g.training).toBe('kicking')
    expect(g.matchPrep).toBe('setpiece')
    expect(planThisSeason(g)?.season).toBe(g.season)
  })

  it('turns Set-Piece Work off again, and ignores a call of the wrong kind', () => {
    const g = newGame('leicester', 'Plan', 3)
    const tac = g.clubs[g.userClubId].tactic
    const lo = tac.lineoutCall
    setPreseasonPlan(g, { atk: 'direct', def: 'drift', lineout: 'sc_wheel', scrum: 'sc_wheel', focus: 'balanced', setpiece: true })
    expect(tac.lineoutCall).toBe(lo)
    setPreseasonPlan(g, { atk: 'direct', def: 'drift', lineout: 'lo_middle', scrum: 'sc_hold', focus: 'balanced', setpiece: false })
    expect(g.matchPrep).toBeUndefined()
  })

  it('belongs to one season', () => {
    const g = newGame('leicester', 'Plan', 3)
    setPreseasonPlan(g, planDraft(g))
    g.season += 1
    expect(planThisSeason(g)).toBeNull()
  })
})
