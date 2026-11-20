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
import { activeWindows, processWeekAndAdvance } from '../src/game/season'
import { applyToTable, wcRoundOf16 } from '../src/game/season/tables'
import { NC_POOLS, buildInternationals, emptyRow, isLionsSeason, isWomensTourSeason } from '../src/game/schedule'
import { mulberry32 } from '../src/game/rng'
import { BASE_YEAR, type Competition, type Fixture, type GameState } from '../src/game/model'
import { deskNat, natCallUp, natDrop, natWindow } from '../src/game/country'
import { announceSquad, noteWindowResult, openNatWindow } from '../src/game/natwin'
import { startTenure } from '../src/game/natera'

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
  // 1.9.16: the sheet is a draft until it is named, so a man taken off it
  // before the announcement feels nothing then. He was in the last squad and
  // is not in this one: that is one reaction, at the announcement, not two.
  it('a man taken off the draft gets one reaction, at the announcement', () => {
    const g = camp(51)
    fill(g, 30)
    const id = g.natSquads.ENG[29]
    g.players[id].caps = 40
    g.natPrevSquad = [...g.natSquads.ENG]
    const called = g.players[id].morale
    expect(natDrop(g, id)).toBeNull()
    const after = g.players[id].morale
    expect(after).toBeLessThanOrEqual(called)
    expect(called - after).toBeLessThanOrEqual(0.5 + 1e-9)
    expect(g.natSent ?? []).not.toContain(id)
    const r = announceSquad(g, [])!
    expect(r.omitted).toContain(id)
    expect(g.players[id].morale).toBeLessThan(after)
    expect(after - g.players[id].morale).toBeLessThanOrEqual(1)
  })

  it('a player sent home after the announcement is not punished twice', () => {
    const g = camp(54)
    fill(g, 30)
    announceSquad(g, [])
    const id = g.natSquads.ENG[29]
    const before = g.players[id].morale
    expect(natDrop(g, id)).toBeNull()
    expect(g.natSent).toContain(id)
    expect(before - g.players[id].morale).toBeLessThanOrEqual(0.7 + 1.5)
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
    announceSquad(g, []) // the sting and its refund belong to a named squad (1.9.16)
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

describe('the World Championship, the real 2027 format', () => {
  it('twenty-four nations in the six pools that were drawn, three rounds each', () => {
    const g = newGame('leicester', 'WC', 61)
    g.season = 2027 - BASE_YEAR
    buildInternationals(mulberry32(61), g, true)
    const wc = g.comps['wc']
    expect(wc.teamIds.length).toBe(24)
    expect(wc.pools).toEqual([
      ['NZL', 'AUS', 'CHL', 'HKG'], ['RSA', 'ITA', 'GEO', 'ROU'], ['ARG', 'FIJ', 'ESP', 'CAN'],
      ['IRE', 'SCO', 'URU', 'POR'], ['FRA', 'JPN', 'USA', 'SAM'], ['ENG', 'WAL', 'TGA', 'ZIM'],
    ])
    expect(wc.playoffTeams).toBe(16)
    expect(g.fixtures.filter(f => f.compId === 'wc' && !f.stage).length).toBe(36)
  })

  it('the last sixteen: two from each pool and the four best thirds, no pool rematch', () => {
    const row = (teamId: string, pts: number) => ({ ...emptyRow(teamId), pts })
    const rows = [...Array(6).keys()].map(p => [0, 1, 2, 3].map(i => row(`P${p}T${i}`, 15 - i * 4 - p)))
    const ties = wcRoundOf16(rows)
    expect(ties.length).toBe(8)
    const teams = ties.flat()
    expect(new Set(teams).size).toBe(16)
    for (let p = 0; p < 6; p++) {
      expect(teams).toContain(`P${p}T0`)
      expect(teams).toContain(`P${p}T1`)
      expect(teams).not.toContain(`P${p}T3`)
    }
    expect(teams.filter(t => t.endsWith('T2')).length).toBe(4)
    expect(ties.every(([h, a]) => h.slice(0, 2) !== a.slice(0, 2))).toBe(true)
  })
})

describe('the Isles tour party is the coach\'s to pick', () => {
  it('on tour the desk is the four unions\' squad: drop and call up work on it', () => {
    const g = newGame('bath', 'Isles', 71)
    g.season = [...Array(20).keys()].find(s => isLionsSeason(s))!
    buildInternationals(mulberry32(71), g, false)
    g.natTeam = 'ENG'
    g.isles = { season: g.season, answer: 'yes' }
    g.unemployed = true // no two-jobs quota in this one
    const tour = activeWindows(g).find(w => w.nations.includes('LIO'))!
    g.week = tour.start
    const home4 = Object.values(g.players).filter(p => ['ENG', 'IRE', 'SCO', 'WAL'].includes(p.nat) && p.clubId && !p.injury)
      .sort((a, b) => b.ca - a.ca)
    g.natSquads['LIO'] = home4.slice(0, 32).map(p => { p.natSquad = true; return p.id })
    expect(deskNat(g)).toBe('LIO')
    expect(natWindow(g)).not.toBeNull()
    const out = g.natSquads['LIO'][31]
    expect(natDrop(g, out)).toBeNull()
    expect(g.natSquads['LIO']).not.toContain(out)
    expect(natCallUp(g, out)).toBeNull()
    expect(g.natSquads['LIO']).toContain(out)
    // and his own country is not the desk while he is away
    expect(g.natSquads['ENG'] ?? []).not.toContain(out)
  })
})

describe('appointed mid-window', () => {
  it('inherits the squad and the window\'s campaign', () => {
    const g = newGame('leicester', 'Mid', 81)
    const w = activeWindows(g).filter(x => x.nations.includes('ENG')).sort((a, b) => a.start - b.start)[0]
    g.week = w.start + 1
    g.natSquads.ENG = Object.values(g.players).filter(p => p.nat === 'ENG' && p.clubId).slice(0, 32).map(p => p.id)
    g.natTeam = 'ENG'
    startTenure(g)
    expect(g.natWin?.nat).toBe('ENG')
    expect(g.natWin?.start).toBe(w.start)
  })
})

describe('a men\'s World Cup squad is thirty-three', () => {
  it('the World Cup window names 33, every other window 32, and the desk holds 33', () => {
    const g = newGame('leicester', 'WC33', 62)
    g.season = 2027 - BASE_YEAR
    buildInternationals(mulberry32(62), g, true)
    const wins = activeWindows(g)
    const wc = wins.find(w => w.id === 'wc')!
    expect(wc.size).toBe(33)
    expect(wins.filter(w => w.id !== 'wc').every(w => w.size === 32)).toBe(true)
    // the coach's desk at the World Cup takes a 33rd man and no 34th
    g.natTeam = 'ENG'
    g.unemployed = true
    g.week = wc.start
    g.natSquads['ENG'] = []
    g.natSent = []
    const eng = Object.values(g.players).filter(p => p.nat === 'ENG' && p.clubId && !p.injury).sort((a, b) => b.ca - a.ca)
    for (const p of eng) { if (g.natSquads['ENG'].length >= 33) break; natCallUp(g, p.id) }
    expect(g.natSquads['ENG'].length).toBe(33)
    const next = eng.find(p => !g.natSquads['ENG'].includes(p.id))!
    expect(natCallUp(g, next.id)).not.toBeNull()
    expect(g.natSquads['ENG'].length).toBe(33)
  })
})

describe('the Nations Trophy: the tier-two nations play between World Championships', () => {
  const [A, B] = NC_POOLS
  it('twelve nations, the real pools, each meets the six of the other pool once', () => {
    const g = newGame('leicester', 'NT', 63)
    const nc = g.comps['nc']
    expect(nc).toBeDefined()
    expect(nc.pools).toEqual([A, B])
    const fx = g.fixtures.filter(f => f.compId === 'nc')
    expect(fx.length).toBe(36)
    for (const n of [...A, ...B]) {
      const mine = fx.filter(f => f.homeId === n || f.awayId === n)
      const opp = mine.map(f => (f.homeId === n ? f.awayId : f.homeId))
      const other = A.includes(n) ? B : A
      expect(new Set(opp)).toEqual(new Set(other))
      expect(new Set(mine.map(f => f.week)).size).toBe(6)
    }
    // November in Europe, Africa and Asia; July in the Americas and the Pacific
    expect(fx.filter(f => f.week <= 15).every(f => B.includes(f.homeId))).toBe(true)
    expect(fx.filter(f => f.week >= 44).every(f => A.includes(f.homeId))).toBe(true)
  })

  it('is away twice: the November window with its camp week, and July', () => {
    const g = newGame('leicester', 'NT', 64)
    const spans = activeWindows(g).filter(w => w.id === 'nc').map(w => [w.start, w.end])
    expect(spans).toEqual([[12, 15], [44, 46]])
  })

  it('is not played in a World Championship season', () => {
    const g = newGame('leicester', 'NT', 65)
    g.season = 2027 - BASE_YEAR
    g.fixtures = g.fixtures.filter(f => f.compId !== 'nc')
    delete g.comps['nc']
    buildInternationals(mulberry32(65), g, true)
    expect(g.comps['nc']).toBeUndefined()
  })

  it('a season played through crowns a champion in each pool', () => {
    const g = newGame('leicester', 'NT', 66)
    let guard = 0
    while (!g.history.filter(h => h.compId === 'nc').length && guard++ < 60) processWeekAndAdvance(g)
    const champs = g.history.filter(h => h.compId === 'nc').map(h => h.champion)
    expect(champs.length).toBe(2)
    expect(A.includes(champs[0]) !== A.includes(champs[1])).toBe(true)
  }, 120_000)
})
