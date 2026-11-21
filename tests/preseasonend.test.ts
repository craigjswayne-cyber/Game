/**
 * ---- PRE-SEASON WORK ENDS WHEN PRE-SEASON DOES (1.9.16) ----
 * Owner, asked whether to rename it "Training focus": "No - it should only
 * be for pre-season".
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { endPreseasonWork, FOCUS_OF, setPreseasonPlan } from '../src/game/preseasonplan'
import { PRESEASON_CAMP } from '../src/game/season/training'
import { tIn } from '../src/game/i18n'
import type { GameState } from '../src/game/model'

const fresh = () => newGame('leicester', 'Plan', 31)
const leaguePlayed = (g: GameState) => g.fixtures.some(f => f.played && f.compId === g.clubs[g.userClubId].leagueId && (f.homeId === g.userClubId || f.awayId === g.userClubId))
const toFirstLeague = (g: GameState) => { let n = 0; while (!leaguePlayed(g) && n++ < 12) { for (const x of g.news) x.read = true; processWeekAndAdvance(g) } }

describe('pre-season work', () => {
  it('holds through pre-season and stands down after the first league match', () => {
    const g = fresh()
    g.training = 'kicking'
    setPreseasonPlan(g, 'balanced', 'fitness')
    expect([g.training, g.matchPrep]).toEqual(['fitness', 'fitness'])
    // still pre-season: nothing to stand down
    expect(endPreseasonWork(g)).toBe(false)
    expect(g.training).toBe('fitness')
    toFirstLeague(g)
    for (const x of g.news) x.read = true
    processWeekAndAdvance(g) // the week after: the hook has certainly run
    expect(g.training).toBe('kicking') // what he had before the plan
    expect(g.matchPrep).toBeUndefined()
    expect(g.preplan?.over).toBe(true)
    const note = g.news.find(n => n.k === 'news.preseasonOver')
    expect(note).toBeTruthy()
    expect(tIn('en', 'news.preseasonOver', note!.v)).toContain('Kicking')
  }, 120_000)
  it('the way of playing is the season\'s and stays', () => {
    const g = fresh()
    setPreseasonPlan(g, 'forwards', 'attack')
    const club = g.clubs[g.userClubId]
    toFirstLeague(g); processWeekAndAdvance(g)
    expect([club.tactic.atkStyle, club.tactic.defStyle]).toEqual(['direct', 'choke'])
  }, 120_000)
  it('changing the answer in pre-season does not lose what he had before', () => {
    const g = fresh()
    g.training = 'defence'
    setPreseasonPlan(g, 'balanced', 'fitness')
    setPreseasonPlan(g, 'balanced', 'setpiece')
    expect(g.preplan?.prev).toEqual({ training: 'defence', prep: undefined })
  })
  it('a focus the manager picked himself after the plan is left alone', () => {
    const g = fresh()
    setPreseasonPlan(g, 'balanced', 'fitness')
    g.training = 'lineout'; g.matchPrep = 'recovery'
    toFirstLeague(g); processWeekAndAdvance(g)
    expect([g.training, g.matchPrep]).toEqual(['lineout', 'recovery'])
    expect(g.news.some(n => n.k === 'news.preseasonOver')).toBe(false)
  }, 120_000)
  it('a plan saved before 1.9.16 goes back to a balanced week', () => {
    const g = fresh()
    setPreseasonPlan(g, 'balanced', 'attack')
    delete g.preplan!.prev
    toFirstLeague(g); processWeekAndAdvance(g)
    expect(g.training).toBe('balanced')
  }, 120_000)
  it('it acts once: the manager can choose the same focus again and keep it', () => {
    const g = fresh()
    setPreseasonPlan(g, 'balanced', 'fitness')
    toFirstLeague(g); processWeekAndAdvance(g)
    g.training = 'fitness'
    processWeekAndAdvance(g)
    expect(g.training).toBe('fitness')
  }, 120_000)
  it('the three weeks count: a squad on a plan gains more in its focus than one left alone', () => {
    const sum = (g: GameState, ks: string[]) => g.clubs[g.userClubId].players.reduce((a, id) => a + ks.reduce((b, k) => b + (g.players[id].a as Record<string, number>)[k], 0), 0)
    let better = 0
    for (const seed of [31, 32, 33, 34]) {
      const a = newGame('leicester', 'Plan', seed), b = newGame('leicester', 'Plan', seed)
      setPreseasonPlan(a, 'balanced', 'attack'); setPreseasonPlan(b, 'balanced', 'attack'); b.training = 'balanced'
      toFirstLeague(a); toFirstLeague(b)
      if (sum(a, ['han', 'pas', 'vis']) > sum(b, ['han', 'pas', 'vis'])) better++
    }
    expect(better).toBeGreaterThanOrEqual(3)
    expect(PRESEASON_CAMP).toBeGreaterThan(1)
    expect(FOCUS_OF).toEqual({ fitness: 'fitness', setpiece: 'scrum', attack: 'attack' })
  }, 240_000)
})
