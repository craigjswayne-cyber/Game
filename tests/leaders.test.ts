// The Stats tab's boards (owner, 1.9.13): game/leaders.ts.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { MIN_KICKS, MIN_TACKLES, seasonBoards } from '../src/game/leaders'
import { tackleRecord } from '../src/game/model'
import { migrate } from '../src/game/save'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

describe('the season boards', () => {
  const g = newGame('northampton', 'Stats', 17)
  for (let w = 0; w < 14; w++) processWeekAndAdvance(g)
  const league = g.clubs[g.userClubId].leagueId
  const b = seasonBoards(g, league)
  const inLeague = (clubId?: string | null) => !!clubId && g.comps[league].teamIds.includes(clubId)

  it('fills the boards from a few weeks of rugby, from the league\'s clubs only', () => {
    expect(b.tries.length).toBeGreaterThan(0)
    expect(b.tackles.length).toBeGreaterThan(0)
    expect(b.teamTries.length).toBeGreaterThan(0)
    for (const r of [...b.tries, ...b.points, ...b.tackles, ...b.motm]) expect(inLeague(r.p.clubId)).toBe(true)
  })
  it('ranks each board from the top down, five at most', () => {
    for (const rows of [b.tries, b.points, b.tackles, b.motm, b.cards]) {
      expect(rows.length).toBeLessThanOrEqual(5)
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].n).toBeGreaterThanOrEqual(rows[i].n)
    }
  })
  it('rates kickers and tacklers only past their floors', () => {
    for (const r of b.kickers) expect(r.line!.att).toBeGreaterThanOrEqual(MIN_KICKS)
    for (const r of b.tackleRate) {
      expect(r.line!.att).toBeGreaterThanOrEqual(MIN_TACKLES)
      expect(r.n).toBeGreaterThan(0)
      expect(r.n).toBeLessThanOrEqual(100)
    }
  })
  it('counts missed tackles alongside the made ones', () => {
    const anyMissed = Object.values(g.players).some(p => (p.stats.tklM ?? 0) > 0)
    expect(anyMissed).toBe(true)
  })
  it('every club match now names its player of the match', () => {
    const played = g.fixtures.filter(f => f.played && f.compId === league)
    expect(played.length).toBeGreaterThan(0)
    expect(played.every(f => f.motm != null)).toBe(true)
  })
  it('keeps the manager\'s own season in the 22, and his opponents\'', () => {
    // the manager's matches are played with their lines written (the store's
    // watch and instant paths both do), which is what the visits are read from
    const h = newGame('northampton', 'In22', 23)
    const fx = h.fixtures.filter(f => f.compId !== 'fr' && (f.homeId === h.userClubId || f.awayId === h.userClubId))
      .sort((a, b) => a.week - b.week).slice(0, 2)
    fx.forEach((f, i) => simMatch(h, f, mulberry32(50 + i), true))
    const r = h.in22!
    expect(r).toBeDefined()
    expect(r.season).toBe(h.season)
    expect(r.m).toBe(2)
    expect(r.v + r.ov).toBeGreaterThan(0)
    // points from visits are points: never more than the side scored
    const scored = fx.reduce((s, f) => s + (f.homeId === h.userClubId ? f.homeScore : f.awayScore), 0)
    expect(r.p).toBeLessThanOrEqual(scored)
  })
  it('a season under way from before 1.9.13 rates tackles only from the day it loads', () => {
    const p = Object.values(g.players).find(q => (q.stats.tkl ?? 0) > 0)!
    delete p.stats.tklM
    delete p.stats.tkl0
    migrate(g)
    expect(p.stats.tklM).toBe(0)
    expect(p.stats.tkl0).toBe(p.stats.tkl)
    expect(tackleRecord(p.stats)).toBeNull()
  })
})
