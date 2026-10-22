// Condition (1.9.4): every man his own number, and a cost for tired legs.
// The shape of the two shifts in condition.ts and of the soft kick-off floor
// in setup.ts, held at their edges, and a career's worth of weeks held to the
// bounds every screen and the engine assume. Nothing here reads the match
// stream, so a retune of the numbers moves these only where a bound moves.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { migrate } from '../src/game/save'
import { resetIds } from '../src/game/attributes'
import { kickoffTank } from '../src/game/match/setup'
import { TANK_K } from '../src/game/match/selection'
import { matchToll, recoveryShift } from '../src/game/condition'
import type { GameState } from '../src/game/model'

const linear = (c: number) => 100 - (100 - c) * TANK_K
/** where the linear tank crosses the floor of 50 */
const EDGE = 100 - 50 / TANK_K

describe('kick-off tank', () => {
  it('is untouched at and above the edge, where it reaches 50', () => {
    for (let c = Math.ceil(EDGE * 10) / 10; c <= 100; c += 0.1) {
      expect(kickoffTank(c)).toBeCloseTo(linear(c), 9)
    }
    expect(kickoffTank(EDGE)).toBeCloseTo(50, 9)
  })
  it('keeps half the shortfall under it: 20% kicks off at 45, not 50', () => {
    expect(kickoffTank(20)).toBeCloseTo(45, 9)
    expect(kickoffTank(0)).toBeCloseTo(37.5, 9)
  })
  it('is continuous at the edge and never falls as condition rises', () => {
    expect(Math.abs(kickoffTank(EDGE - 1e-6) - kickoffTank(EDGE + 1e-6))).toBeLessThan(1e-5)
    let prev = -Infinity
    for (let c = 0; c <= 100; c += 0.05) {
      const t = kickoffTank(c)
      expect(Number.isFinite(t)).toBe(true)
      expect(t).toBeGreaterThanOrEqual(prev)
      expect(t).toBeLessThanOrEqual(100)
      prev = t
    }
  })
})

describe('the two shifts', () => {
  const g = newGame('bath', 'Cond', 4242)
  const men = Object.values(g.players)

  it('read nothing but the seed, the man and the week, and change nothing', () => {
    const before = JSON.stringify(g)
    const p = men[0]
    const a = [matchToll(g, p, 7.2), recoveryShift(g, p, true), recoveryShift(g, p, false)]
    const b = [matchToll(g, p, 7.2), recoveryShift(g, p, true), recoveryShift(g, p, false)]
    expect(b).toEqual(a)
    expect(JSON.stringify(g)).toBe(before)
  })

  it('stay inside the bounds condition.ts gives them, for every man in the world', () => {
    // matchToll: engine (sta 1-20) +-9, day +-4, knocks +-6, less the bias
    // recoveryShift: age -4..+2, engine +-4, body +-4, work -2.5..+1.5
    for (const p of men) {
      for (const r of [null, 1, 4, 6.1, 8, 10]) {
        const t = matchToll(g, p, r)
        expect(Number.isFinite(t)).toBe(true)
        expect(t).toBeGreaterThanOrEqual(-21)
        expect(t).toBeLessThanOrEqual(19)
      }
      for (const u of [true, false]) {
        const s = recoveryShift(g, p, u)
        expect(Number.isFinite(s)).toBe(true)
        expect(s).toBeGreaterThanOrEqual(-14.6)
        expect(s).toBeLessThanOrEqual(9.6)
        // the slowest week (rust: 16 back) still gives something back, so a
        // man who sits a week out is never left more tired by it
        expect(16 + s).toBeGreaterThan(0)
      }
    }
  })

  it('give each man his own number, not one per squad', () => {
    const tolls = new Set(men.slice(0, 200).map(p => Math.round(matchToll(g, p, 6.5) * 10)))
    const recs = new Set(men.slice(0, 200).map(p => Math.round(recoveryShift(g, p, false) * 10)))
    expect(tolls.size).toBeGreaterThan(50)
    expect(recs.size).toBeGreaterThan(50)
  })
})

function week(g: GameState) {
  resetIds(g.pidNext ?? 1)
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}

describe('a run of weeks', () => {
  it('keeps every squad man between 20 and 100, spread, and through a save exactly', () => {
    const g = newGame('northampton', 'Cond', 99)
    let spreadWeeks = 0, checked = 0
    for (let w = 0; w < 18; w++) {
      week(g)
      for (const club of Object.values(g.clubs)) {
        for (const id of club.players) {
          const c = g.players[id]?.cond
          if (c == null) continue
          checked++
          expect(Number.isFinite(c), `${id} week ${g.week}`).toBe(true)
          expect(c).toBeGreaterThanOrEqual(20)
          expect(c).toBeLessThanOrEqual(100)
        }
      }
      // the men who played this week: no longer one figure from 1 to 15
      const mine = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && p.lastWk === g.week - 1)
      if (mine.length >= 15 && new Set(mine.map(p => Math.round(p!.cond))).size >= 5) spreadWeeks++
      const back = migrate(JSON.parse(JSON.stringify(g)))
      for (const id of Object.keys(g.players)) {
        expect(back.players[id as unknown as number]?.cond).toBe(g.players[id as unknown as number].cond)
      }
    }
    expect(checked).toBeGreaterThan(5000)
    expect(spreadWeeks).toBeGreaterThan(5)
  }, 120_000)
})
