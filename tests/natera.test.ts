/**
 * ---- THE APPOINTMENT, THE TEST LEDGER AND THE ERA (1.9.14) ----
 *   a tenure starts with the union's terms and an unveiling to show
 *   a Test opens and closes a ledger: score, ranking either side, caps
 *   the era keeps the best ranking, the debuts and a win over the top five
 *   the game plan at its middle is the engine as it was
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { startTenure, termLines } from '../src/game/natera'
import { closeTestLedger, eraOf, noteTestCap, openTestLedger, testConfDelta } from '../src/game/nattest'
import { natRankOrder } from '../src/game/natrank'
import { beginMatch } from '../src/game/matchEngine'
import { matchRng } from '../src/game/season'
import { natPlanOf } from '../src/game/natcamp'
import type { Fixture, GameState } from '../src/game/model'

const fx = (g: GameState, home: string, away: string, hs = 0, as = 0): Fixture => ({
  id: 910_000 + g.week, compId: 'aut', round: 0, week: g.week, homeId: home, awayId: away, played: true,
  homeScore: hs, awayScore: as, homeTries: 0, awayTries: 0,
})

describe('the appointment and the era', () => {
  it('a tenure starts with three terms and the unveiling', () => {
    const g = newGame('leicester', 'Era', 51)
    g.natTeam = 'ENG'
    startTenure(g)
    expect(g.natUnveil?.nat).toBe('ENG')
    const lines = termLines(g)
    expect(lines).toHaveLength(3)
    expect(lines[0].k).toMatch(/natera\.term(Rank|Top)/)
    expect(g.natTerm!.rank).toBeGreaterThanOrEqual(1)
  })

  it('a coach appointed before the terms existed gets them without an unveiling', () => {
    const g = newGame('leicester', 'Era', 52)
    g.natTeam = 'SCO'
    expect(termLines(g)).toHaveLength(3)
    expect(g.natUnveil ?? null).toBeNull()
  })

  it('a Test keeps a ledger: score, ranking either side, debuts and milestones', () => {
    const g = newGame('leicester', 'Era', 53)
    g.natTeam = 'ENG'
    const f = fx(g, 'ENG', 'NZL', 30, 10)
    openTestLedger(g, f)
    const before = natRankOrder(g).indexOf('ENG') + 1
    g.natRank!.ENG += 6
    closeTestLedger(g, f)
    const L = g.natLastTest!
    expect([L.us, L.them]).toEqual([30, 10])
    expect(L.rankBefore).toBe(before)
    expect(L.rankAfter).toBeLessThanOrEqual(before)
    noteTestCap(g, f.id, 'ENG', 101, 1)
    noteTestCap(g, f.id, 'ENG', 102, 50)
    noteTestCap(g, f.id, 'ENG', 103, 7)
    noteTestCap(g, f.id, 'NZL', 104, 1)
    expect(L.debuts).toEqual([101])
    expect(L.caps).toEqual([{ id: 102, n: 50 }])
    expect(eraOf(g)!.debuts).toEqual([101])
    // New Zealand go in ranked in the top five: a win over them counts
    expect(natRankOrder(g).indexOf('NZL')).toBeLessThan(5)
    expect(eraOf(g)!.topWin).toBe(true)
  })

  it('the union reaction is one rule, read by the card and the settle alike', () => {
    const g = newGame('leicester', 'Era', 54)
    g.natRank = { ...(g.natRank ?? {}), ITA: 60, NZL: 90 }
    expect(testConfDelta(g, 'ITA', 'NZL', 20, 10)).toBe(4)
    // 1.9.15: a defeat by a side five or more below is -7, a draw with a
    // weaker side -1; a draw with a better one still +0.5
    expect(testConfDelta(g, 'NZL', 'ITA', 10, 20)).toBe(-7)
    expect(testConfDelta(g, 'NZL', 'ITA', 10, 10)).toBe(-1)
    expect(testConfDelta(g, 'ITA', 'NZL', 10, 10)).toBe(0.5)
    g.natRank = { ...g.natRank, ITA: 87 }
    expect(testConfDelta(g, 'NZL', 'ITA', 10, 20)).toBe(-5.5)
  })

  it('a game plan left in the middle is the engine as it was; a captain lifts the side', () => {
    const mk = () => {
      const g = newGame('leicester', 'Era', 55)
      g.natTeam = 'ENG'
      for (const nat of ['ENG', 'FRA']) {
        g.natSquads[nat] = Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.acad).sort((a, b) => b.ca - a.ca).slice(0, 30).map(p => p.id)
      }
      return g
    }
    const test = (g: GameState): Fixture => ({ ...fx(g, 'ENG', 'FRA'), played: false, compId: 'sn' })
    const a = mk(), b = mk()
    natPlanOf(b)
    const ca = beginMatch(a, test(a), matchRng(a), false, 'ENG')
    const cb = beginMatch(b, test(b), matchRng(b), false, 'ENG')
    expect(cb.home.units).toEqual(ca.home.units)
    expect(cb.home.penRisk).toBe(ca.home.penRisk)
    // the side's best leader with the armband
    const c = mk()
    const plan = natPlanOf(c)!
    const xv = ca.home.lineup.slice(0, 15).filter((x): x is number => x != null)
    plan.captain = xv.sort((x, y) => c.players[y].a.lea - c.players[x].a.lea)[0]
    const cc = beginMatch(c, test(c), matchRng(c), false, 'ENG')
    if (c.players[plan.captain].a.lea >= 12) expect(cc.home.units.attack).toBeGreaterThan(ca.home.units.attack)
    // and a plan that runs it wide moves the attack
    const d = mk()
    natPlanOf(d)!.style = 90
    const cd = beginMatch(d, test(d), matchRng(d), false, 'ENG')
    expect(cd.home.units.attack).toBeGreaterThan(ca.home.units.attack)
    expect(cd.home.units.scrum).toBeLessThan(ca.home.units.scrum)
  })
})
