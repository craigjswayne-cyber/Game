/**
 * ---- THE NATIONAL CAMP'S FOCUS (1.9.14) ----
 *
 * Player feedback: "Couldn't see training for my international team". The
 * camp focus (natcamp.ts, chosen through country.ts setCampFocus):
 *   only inside a window            no camp, no focus
 *   it lasts that window            and is gone the week after it closes
 *   it reaches the Test at kick-off the national side's units
 *   it is the club prep's trade     set pieces up, attack a little down
 *   a damaged save drops it         and never crashes the load
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { beginMatch } from '../src/game/matchEngine'
import { activeWindows, matchRng } from '../src/game/season'
import { campWindow, setCampFocus } from '../src/game/country'
import { campFocus } from '../src/game/natcamp'
import { migrate } from '../src/game/save'
import type { Fixture, GameState } from '../src/game/model'

function withEngland(seed: number): GameState {
  const g = newGame('leicester', 'Camp', seed)
  g.natTeam = 'ENG'
  return g
}
function intoWindow(g: GameState) {
  const w = activeWindows(g).find(w => w.nations.includes('ENG'))!
  g.week = w.start
  for (const nat of ['ENG', 'FRA']) {
    g.natSquads[nat] = Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.acad)
      .sort((a, b) => b.ca - a.ca).slice(0, 30).map(p => p.id)
  }
  return w
}
const test = (g: GameState): Fixture => ({
  id: 900_001, compId: 'sn', round: 0, week: g.week, homeId: 'ENG', awayId: 'FRA', played: false,
  homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
})

describe('the camp focus', () => {
  it('can only be chosen while a window is open', () => {
    const g = withEngland(31)
    g.week = 1
    if (!campWindow(g)) expect(setCampFocus(g, 'attack')).toBe(false)
    expect(campFocus(g)).toBeNull()
    intoWindow(g)
    expect(setCampFocus(g, 'attack')).toBe(true)
    expect(campFocus(g)).toBe('attack')
  })

  it('lasts the window and no longer', () => {
    const g = withEngland(32)
    const w = intoWindow(g)
    setCampFocus(g, 'fitness')
    g.week = w.end
    expect(campFocus(g)).toBe('fitness')
    g.week = w.end + 1
    expect(campFocus(g)).toBeNull()
    g.week = w.start
    g.season += 1
    expect(campFocus(g)).toBeNull()
  })

  it('belongs to the nation it was chosen for', () => {
    const g = withEngland(33)
    intoWindow(g)
    setCampFocus(g, 'setpiece')
    g.natTeam = 'FRA'
    expect(campFocus(g)).toBeNull()
  })

  it('reaches the Test at kick-off: set pieces up, attack down', () => {
    const a = withEngland(34); intoWindow(a)
    const b = withEngland(34); intoWindow(b)
    setCampFocus(b, 'setpiece')
    const ca = beginMatch(a, test(a), matchRng(a), false, 'ENG')
    const cb = beginMatch(b, test(b), matchRng(b), false, 'ENG')
    // 4% on the modifier; kick-off blends the set-piece units with what the
    // modifiers do not touch, so the unit itself moves by less (as the club's
    // own set-piece prep does)
    expect(cb.home.units.scrum / ca.home.units.scrum).toBeGreaterThan(1.01)
    expect(cb.home.units.lineout / ca.home.units.lineout).toBeGreaterThan(1.01)
    expect(cb.home.units.attack / ca.home.units.attack).toBeLessThan(1)
  })

  it('fitness makes the national side tire more slowly', () => {
    const a = withEngland(35); intoWindow(a)
    const b = withEngland(35); intoWindow(b)
    setCampFocus(b, 'fitness')
    const ca = beginMatch(a, test(a), matchRng(a), false, 'ENG')
    const cb = beginMatch(b, test(b), matchRng(b), false, 'ENG')
    expect(cb.home.drainF).toBeLessThan(ca.home.drainF)
  })

  it('a damaged one is dropped on load', () => {
    const g = withEngland(36)
    ;(g as unknown as { natCamp: unknown }).natCamp = { nat: 'ENG', season: 'x', start: 1, end: 2, focus: 'magic' }
    const s = migrate(JSON.parse(JSON.stringify(g)))
    expect(s.natCamp).toBeUndefined()
  })
})
