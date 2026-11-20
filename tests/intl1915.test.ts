/**
 * ---- THE INTERNATIONAL GAME, OVERNIGHT QA (1.9.15) ----
 *
 *   the Isles tour     decided on the three Tests, on the real years
 *   fair reactions     no penalty for a man the coach could not pick, no
 *                      double penalty for a drop, a recall gives back only
 *                      what the drop took
 *   the announcement   a squad that plays has been announced
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { activeWindows } from '../src/game/season'
import { applyToTable } from '../src/game/season/tables'
import { emptyRow, isLionsSeason, isWomensTourSeason } from '../src/game/schedule'
import { BASE_YEAR, type Competition, type Fixture, type GameState } from '../src/game/model'
import { natCallUp, natDrop } from '../src/game/country'
import { announceSquad, noteWindowResult, openNatWindow } from '../src/game/natwin'

function camp(seed: number, nat = 'ENG'): GameState {
  const g = newGame('leicester', 'Window', seed)
  g.natTeam = nat
  g.natConfidence = 60
  g.unemployed = true // a coach with no club: no two-jobs quota in these
  const w = activeWindows(g).filter(x => x.nations.includes(nat)).sort((a, b) => a.start - b.start)
    .find(x => g.fixtures.some(f => (f.homeId === nat || f.awayId === nat) && f.week >= x.start && f.week <= x.end))!
  g.week = w.start
  g.natSquads[nat] = []
  g.natSent = []
  openNatWindow(g, w)
  return g
}
const fill = (g: GameState, n: number) => {
  const nat = g.natTeam!
  for (const p of Object.values(g.players).filter(p => p.nat === nat && p.clubId && !p.injury).sort((a, b) => b.ca - a.ca)) {
    if (g.natSquads[nat].length >= n) break
    natCallUp(g, p.id)
  }
}

describe('the Isles XV tour', () => {
  it('counts the three Tests in the series table, not the provincial games', () => {
    const comp = { id: 'lions', table: ['LIO', 'NZL'].map(emptyRow) } as unknown as Competition
    const fx = (stage: string, h: number, a: number, extra: Partial<Fixture> = {}) => ({
      compId: 'lions', homeId: 'NZL', awayId: 'LIO', homeScore: h, awayScore: a, homeTries: 3, awayTries: 1, stage, ...extra,
    }) as Fixture
    applyToTable(comp, fx('Tour match 3', 10, 40, { homeId: 'blues', tourMatch: true }))
    for (const st of ['1st Test', '2nd Test', '3rd Test']) applyToTable(comp, fx(st, 30, 10))
    const nz = comp.table.find(r => r.teamId === 'NZL')!
    expect(nz.p).toBe(3)
    expect(nz.w).toBe(3)
  })

  it('tours on the real years: men 2029, 2033, 2037; women 2031, 2035, 2039', () => {
    const played = (f: (s: number) => boolean) => [...Array(16).keys()].filter(f).map(s => BASE_YEAR + s + 1)
    expect(played(isLionsSeason).slice(0, 3)).toEqual([2029, 2033, 2037])
    expect(played(isWomensTourSeason).slice(0, 3)).toEqual([2031, 2035, 2039])
  })
})

describe('fair reactions to selection', () => {
  it('a dropped player is not punished again at the announcement', () => {
    const g = camp(51)
    fill(g, 30)
    const id = g.natSquads.ENG[29]
    g.players[id].caps = 40
    g.natPrevSquad = [...g.natSquads.ENG]
    expect(natDrop(g, id)).toBeNull()
    const after = g.players[id].morale
    const r = announceSquad(g, [])!
    expect(r.omitted).not.toContain(id)
    expect(g.players[id].morale).toBe(after)
  })

  it('a player the coach could not pick (playing abroad) is not "left out"', () => {
    const g = camp(52)
    fill(g, 30)
    const abroad = Object.values(g.players).find(p => p.nat === 'ENG' && p.clubId && g.clubs[p.clubId]?.country !== 'ENG' && !p.natSquad)
    expect(abroad).toBeTruthy()
    abroad!.caps = 60
    g.natPrevSquad = [...g.natSquads.ENG, abroad!.id]
    const m = abroad!.morale
    const r = announceSquad(g, [])!
    expect(r.omitted).not.toContain(abroad!.id)
    expect(abroad!.morale).toBe(m)
  })

  it('a drop and a recall at the morale floor is not a gain', () => {
    const g = camp(53)
    fill(g, 30)
    const id = g.natSquads.ENG[29]
    g.players[id].morale = 1
    expect(natDrop(g, id)).toBeNull()
    expect(natCallUp(g, id)).toBeNull()
    expect(g.players[id].morale).toBe(1)
  })
})

describe('the announcement', () => {
  it('a squad that plays a Test has been announced', () => {
    const g = camp(54)
    fill(g, 30)
    expect(g.natWin!.announced).toBe(false)
    noteWindowResult(g, 20, 10)
    expect(g.natWin!.announced).toBe(true)
    expect(g.natWin!.w).toBe(1)
  })
})
