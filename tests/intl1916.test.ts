/**
 * ---- THE SQUAD SHEET IS A DRAFT UNTIL IT IS NAMED (1.9.16) ----
 *
 * Owner: "I accidentally picked a wrong player when selecting my 32, you
 * should be able to remove anyone until you submit the 32 - only then does
 * the 23 minimum player rule kick in."
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { activeWindows } from '../src/game/season'
import type { GameState } from '../src/game/model'
import { NAT_SQUAD_FLOOR, natCallUp, natDrop } from '../src/game/country'
import { announceSquad, openNatWindow } from '../src/game/natwin'

function camp(seed: number, nat = 'ENG'): GameState {
  const g = newGame('leicester', 'Window', seed)
  g.natTeam = nat
  g.natConfidence = 60
  g.unemployed = true
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

describe('dropping from the draft sheet', () => {
  it('lets a man come off a short, unannounced sheet', () => {
    const g = camp(11)
    fill(g, 16)
    const squad = g.natSquads.ENG
    expect(squad.length).toBe(16)
    expect(natDrop(g, squad[squad.length - 1])).toBeNull()
    expect(squad.length).toBe(15)
  })

  it('a call and a drop before the announcement leaves him exactly as he was', () => {
    const g = camp(12)
    const p = Object.values(g.players).filter(q => q.nat === 'ENG' && q.clubId && !q.injury).sort((a, b) => b.ca - a.ca)[0]
    for (const start of [5, 9.8]) {
      p.morale = start
      expect(natCallUp(g, p.id)).toBeNull()
      expect(natDrop(g, p.id)).toBeNull()
      expect(p.morale).toBeCloseTo(start, 6)
      expect(p.natSquad).toBe(false)
      expect(g.natSent ?? []).not.toContain(p.id)
    }
  })

  it('an announced squad cannot be trimmed below 23', () => {
    const g = camp(13)
    fill(g, NAT_SQUAD_FLOOR + 1)
    announceSquad(g, [])
    const squad = g.natSquads.ENG
    expect(natDrop(g, squad[squad.length - 1])).toBeNull()
    expect(squad.length).toBe(NAT_SQUAD_FLOOR)
    const refusal = natDrop(g, squad[squad.length - 1])
    expect(refusal).toContain(String(NAT_SQUAD_FLOOR))
    expect(squad.length).toBe(NAT_SQUAD_FLOOR)
  })
})

/**
 * ---- THE BUST-UP (1.9.16) ----
 *
 * Owner: "the occasional bust up in a derby or intense rivalry - occasional
 * yellow cards and with a strict ref the odd red card from a fight. This
 * shouldn't be too often but should be part of the game."
 */
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { isDerby } from '../src/game/rivalries'
import type { Fixture } from '../src/game/model'

describe('the bust-up', () => {
  const play = (derby: boolean, n: number) => {
    const g = newGame('leicester', 'Heat', 5)
    const league = g.fixtures.filter(f => g.comps[f.compId]?.type === 'league' && isDerby(f.homeId, f.awayId) === derby)
    let bust = 0, games = 0
    for (let i = 0; i < n; i++) {
      const base = league[i % league.length]
      const fx = { ...base, id: 900000 + i, played: false } as Fixture
      const r = simMatch(g, fx, mulberry32(1000 + i), true)
      games++
      if (r.events.some(e => (e.k ?? '').startsWith('comm.bustUp') && !(e.k ?? '').endsWith('Warn'))) bust++
    }
    return { bust, games }
  }

  it('happens in a derby, and not often', () => {
    const { bust, games } = play(true, 120)
    expect(bust).toBeGreaterThan(0)
    expect(bust / games).toBeLessThan(0.5)
  })

  it('never happens in an ordinary league match with no bad blood', () => {
    const g = newGame('leicester', 'Heat', 5)
    const plain = g.fixtures.filter(f => g.comps[f.compId]?.type === 'league' && !isDerby(f.homeId, f.awayId)).slice(0, 60)
    let bust = 0
    plain.forEach((base, i) => {
      const fx = { ...base, id: 800000 + i, played: false } as Fixture
      const r = simMatch(g, fx, mulberry32(50 + i), true)
      // a grudge can still light one: only count matches the engine did not call heated
      if (!fx.derby && r.events.some(e => (e.k ?? '').startsWith('comm.bustUp')) && !(fx as { grudge?: boolean }).grudge) bust++
    })
    expect(bust).toBe(0)
  })

  it('the old Test rivalries are derbies', () => {
    expect(isDerby('ENG', 'SCO')).toBe(true)
    expect(isDerby('NZL', 'RSA')).toBe(true)
    expect(isDerby('ENG', 'JPN')).toBe(false)
  })
})

/**
 * ---- A CLOSE TEST FEELS CLOSE (1.9.16) ----
 *
 * Words and a marker only: the match itself must be the same match.
 */
import { tensionOf } from '../src/game/match/tension'
import { beginMatch } from '../src/game/matchEngine'

describe('the tension of a close Test', () => {
  const testFx = (g: GameState) => g.fixtures.find(f => g.comps[f.compId]?.isNational && !f.played)!

  it('is read off the score and the clock, in a Test only', () => {
    const g = newGame('leicester', 'Tense', 9)
    const ctx = beginMatch(g, { ...testFx(g), id: 700001 } as Fixture, mulberry32(3), true)
    ctx.home.score = 20; ctx.away.score = 16
    expect(tensionOf(g, ctx, 59)).toBeNull()
    expect(tensionOf(g, ctx, 60)).toBe('one')
    ctx.away.score = 20
    expect(tensionOf(g, ctx, 75)).toBe('level')
    ctx.away.score = 12
    expect(tensionOf(g, ctx, 75)).toBeNull()
    const league = g.fixtures.find(f => g.comps[f.compId]?.type === 'league')!
    const club = beginMatch(g, { ...league, id: 700002 } as Fixture, mulberry32(3), true)
    club.home.score = 20; club.away.score = 16
    expect(tensionOf(g, club, 75)).toBeNull()
  })

  it('never changes a result: a Test scores the same watched or silent', () => {
    const g = newGame('leicester', 'Tense', 9)
    const tests = g.fixtures.filter(f => g.comps[f.compId]?.isNational).slice(0, 12)
    let said = 0
    tests.forEach((base, i) => {
      const a = { ...base, id: 600000 + i, played: false } as Fixture
      const b = { ...base, id: 600000 + i, played: false } as Fixture
      const g2 = newGame('leicester', 'Tense', 9)
      const loud = simMatch(g, a, mulberry32(77 + i), true)
      simMatch(g2, b, mulberry32(77 + i), false)
      expect([a.homeScore, a.awayScore]).toEqual([b.homeScore, b.awayScore])
      if (loud.events.some(e => /^comm\.(tense|pressKick)/.test(e.k ?? ''))) said++
    })
    expect(said).toBeGreaterThan(0)
  })
})
