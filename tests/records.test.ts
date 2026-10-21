/**
 * ---- A SEASON'S TALLY IS ITS CLUB MATCHES (1.9.4 audit) ----
 *
 * finalize.ts gives an appearance only for a club's competitive match: a
 * friendly "banks rhythm, not records" and a Test is a cap. The tries and the
 * kicks were written to the season's stats from every match regardless, so a
 * pre-season run-out or a Test hat-trick went into the league's top scorer,
 * the league's "most points in a season" record (settleRecords) and the season
 * row of the man's career, against an appearance count that never saw them.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { matchRng } from '../src/game/season'
import type { Fixture, GameState } from '../src/game/model'

const tally = (g: GameState, ids: number[]) => ids.reduce((s, id) => {
  const st = g.players[id].stats
  return { tries: s.tries + st.tries, points: s.points + st.points, apps: s.apps + st.apps }
}, { tries: 0, points: 0, apps: 0 })

function play(g: GameState, fx: Fixture, ids: number[]) {
  g.fixtures.push(fx)
  const before = tally(g, ids)
  const ctx = beginMatch(g, fx, matchRng(g), true)
  playHalf(g, ctx)
  playHalf(g, ctx)
  const after = tally(g, ids)
  return { tries: after.tries - before.tries, points: after.points - before.points, apps: after.apps - before.apps }
}
const fixture = (g: GameState, compId: string, homeId: string, awayId: string): Fixture => ({
  id: g.nextId++, compId, round: 0, week: g.week, homeId, awayId, played: false,
  homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
})

describe('the season tally', () => {
  it('a friendly scores nothing into it', () => {
    const g = newGame('leicester', 'Tally', 5)
    const ids = [...g.clubs.leicester.players, ...g.clubs.bath.players]
    const fx = fixture(g, 'fr', 'leicester', 'bath')
    const d = play(g, fx, ids)
    expect(fx.homeScore + fx.awayScore).toBeGreaterThan(0)
    expect(d).toEqual({ tries: 0, points: 0, apps: 0 })
  })

  it('a Test scores nothing into it', () => {
    const g = newGame('leicester', 'Tally', 6)
    for (const nat of ['ENG', 'FRA']) {
      g.natSquads[nat] = Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.acad)
        .sort((a, b) => b.ca - a.ca).slice(0, 30).map(p => p.id)
    }
    const ids = [...g.natSquads.ENG, ...g.natSquads.FRA]
    const fx = fixture(g, 'sn', 'ENG', 'FRA')
    const d = play(g, fx, ids)
    expect(fx.homeScore + fx.awayScore).toBeGreaterThan(0)
    expect(d.tries).toBe(0)
    expect(d.points).toBe(0)
  })

  it('a league match scores every point into it', () => {
    const g = newGame('leicester', 'Tally', 7)
    const ids = [...g.clubs.leicester.players, ...g.clubs.bath.players]
    const fx = fixture(g, 'prem', 'leicester', 'bath')
    const d = play(g, fx, ids)
    expect(d.points).toBe(fx.homeScore + fx.awayScore)
    expect(d.tries).toBe(fx.homeTries + fx.awayTries)
    expect(d.apps).toBeGreaterThanOrEqual(30)
  })
})
