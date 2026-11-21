/**
 * ---- THE RACE FOR THE ISLES XV JOB (1.9.16) ----
 *
 * Owner, 21 Nov 2026: speculation and build-up through a tour season:
 * considered, final eight, final four, final two, then the letter or not.
 * "It should be a really specialist selection... not everybody should get
 * it", and it is a secret: a coach nowhere near it hears nothing.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { RACE_WEEKS, offerIsles, raceIsles, announceTourParty, announceTourStaff, setTourCoach, tourCoaches, closeTour, islesEligible } from '../src/game/isles'
import { isLionsSeason } from '../src/game/schedule'
import { buildInternationals } from '../src/game/schedule'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

function tourSeason(seed: number): GameState {
  const g = newGame('leicester', 'Racer', seed)
  while (!isLionsSeason(g.season)) g.season++
  buildInternationals(mulberry32(seed), g)
  g.natTeam = 'ENG'
  return g
}
const run = (g: GameState) => {
  const heard: string[] = []
  for (const wk of [...RACE_WEEKS, 36]) {
    g.week = wk
    const n0 = g.news.length
    raceIsles(g)
    if (wk === 36) offerIsles(g)
    heard.push(...g.news.slice(n0).map(n => n.k ?? ''))
  }
  return heard
}

describe('the race for the Isles XV job', () => {
  it('a coach who meets every bar is named at each cut and gets the letter', () => {
    const g = tourSeason(3)
    g.licensed = true
    g.mgr.trophies.push({ compId: 'sn', season: 1 } as never)
    const heard = run(g)
    expect(heard).toEqual(['news.islesRace1', 'news.islesRace2', 'news.islesRace3', 'news.islesRace4'])
    expect(g.islesRace).toMatchObject({ stage: 4 })
    expect(g.islesRace!.rivals.length).toBe(1)
    expect(g.isles).toEqual({ season: g.season, answer: 'open' })
  })
  it('a club trophy is not enough: he is the other name in the room', () => {
    const g = tourSeason(3)
    g.licensed = true
    g.mgr.trophies.push({ compId: 'prem', season: 1 } as never)
    const heard = run(g)
    expect(heard).toEqual(['news.islesRace1', 'news.islesRace2', 'news.islesRace3', 'news.islesRaceOut', 'news.islesRaceWinner'])
    expect(g.isles).toBeUndefined()
    expect(islesEligible(g).ok).toBe(false)
  })
  it('a coach nowhere near it hears nothing at all', () => {
    const g = tourSeason(3)
    const heard = run(g)
    expect(heard).toEqual([])
    expect(g.islesRace).toBeUndefined()
    expect(g.isles).toBeUndefined()
  })
  it('a coach of another country hears nothing', () => {
    const g = tourSeason(3)
    g.natTeam = 'FRA'; g.licensed = true
    g.mgr.trophies.push({ compId: 'sn', season: 1 } as never)
    expect(run(g)).toEqual([])
  })
  it('the office: three coaches, announced once; a poor tour is not asked back', () => {
    const g = tourSeason(3)
    g.licensed = true
    g.mgr.trophies.push({ compId: 'sn', season: 1 } as never)
    g.isles = { season: g.season, answer: 'yes' }
    const cs = tourCoaches(g)
    expect(cs.length).toBeGreaterThan(10)
    expect(announceTourStaff(g)).toBe(false)
    setTourCoach(g, 'fwd', cs[0].clubId); setTourCoach(g, 'atk', cs[0].clubId); setTourCoach(g, 'def', cs[2].clubId)
    expect(g.isles.staff!.fwd).toBeUndefined() // one man, one role
    setTourCoach(g, 'fwd', cs[1].clubId)
    expect(announceTourStaff(g)).toBe(true)
    expect(announceTourStaff(g)).toBe(false)
    expect(setTourCoach(g, 'fwd', cs[5].clubId)).toBe(false)
    expect(announceTourParty(g)).toBe(false) // nobody named yet
    // the series lost 3-0: filed, and the next tour does not ask
    const tour = g.comps['lions']
    for (const f of g.fixtures.filter(f => f.compId === 'lions')) { f.played = true; f.homeScore = 30; f.awayScore = 10 }
    tour.champion = tour.teamIds.find(id => id !== 'LIO')
    closeTour(g)
    expect(g.islesPast).toEqual([{ season: g.season, won: false, decider: false }])
    g.season += 4
    expect(isLionsSeason(g.season)).toBe(true)
    expect(islesEligible(g).why).toBe('isles.whyNotBack')
  })
})
