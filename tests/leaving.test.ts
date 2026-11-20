/**
 * ---- 1.9.14: THE PLAYER'S OWN VOICE, AND THE CLUB MAN LEFT OUT ----
 *   leaving   money or mood -> a warning in the last three months; three
 *             weeks on, unrenewed, a pre-contract and an announcement; a
 *             renewal stops it; the rivals' raid needs a warning first
 *   left out  a national coach leaving out a man from his own club: the
 *             reaction follows his morale and his character, and a
 *             drop-then-recall is never a morale gain
 *   cover     the club writes when next season is light
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { LEAVE_AFTER, LEAVE_FROM, leaveReason, leavingWeek } from '../src/game/leaving'
import { aiPreContractPoach, preContractWage } from '../src/game/ai'
import { clubManLeftOut } from '../src/game/natwin'
import { lightNextSeason } from '../src/game/cap'
import { mulberry32 } from '../src/game/rng'
import type { GameState, Player } from '../src/game/model'

function expiring(g: GameState, why: 'money' | 'mood' | 'none'): Player {
  const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad && !q.loanFrom && !q.retiring)!
  p.contractEnds = g.season
  p.renewedSeason = undefined
  if (why === 'money') { p.wage = Math.round(preContractWage(p) * 0.5); p.morale = 7 }
  else if (why === 'mood') { p.wage = preContractWage(p) * 2; p.morale = 3 }
  else { p.wage = preContractWage(p) * 2; p.morale = 7 }
  return p
}

describe('thinking of leaving', () => {
  it('reads the money and the mood', () => {
    const g = newGame('leicester', 'Leave', 61)
    expect(leaveReason(expiring(g, 'money'))).toBe('money')
    const h = newGame('leicester', 'Leave', 62)
    expect(leaveReason(expiring(h, 'mood'))).toBe('mood')
    const k = newGame('leicester', 'Leave', 63)
    expect(leaveReason(expiring(k, 'none'))).toBeNull()
  })

  it('warns first, then announces a move three weeks on', () => {
    const g = newGame('leicester', 'Leave', 64)
    const p = expiring(g, 'money')
    g.week = LEAVE_FROM - 1
    leavingWeek(g)
    expect(p.leaveWarn).toBeUndefined()
    g.week = LEAVE_FROM
    leavingWeek(g)
    expect(p.leaveWarn).toMatchObject({ s: g.season, w: LEAVE_FROM, why: 'money' })
    expect(g.news.some(n => n.k === 'news.leaveWarn' && n.playerId === p.id)).toBe(true)
    expect((g.preContracts ?? []).some(pc => pc.playerId === p.id)).toBe(false)
    g.week = LEAVE_FROM + LEAVE_AFTER
    leavingWeek(g)
    expect((g.preContracts ?? []).some(pc => pc.playerId === p.id)).toBe(true)
    expect(g.news.some(n => n.k === 'news.leaveAnnounce' && n.playerId === p.id)).toBe(true)
  })

  it('a renewal stops it', () => {
    const g = newGame('leicester', 'Leave', 65)
    const p = expiring(g, 'mood')
    g.week = LEAVE_FROM
    leavingWeek(g)
    p.renewedSeason = g.season
    g.week = LEAVE_FROM + LEAVE_AFTER + 1
    leavingWeek(g)
    expect((g.preContracts ?? []).some(pc => pc.playerId === p.id)).toBe(false)
  })

  it('the rivals only raid a man who has warned', () => {
    let unwarned = 0
    for (let seed = 1; seed <= 60; seed++) {
      const g = newGame('leicester', 'Raid', 300 + seed)
      for (const id of g.clubs[g.userClubId].players) { const q = g.players[id]; if (q.ca >= 76) { q.contractEnds = g.season; q.leaveWarn = undefined } }
      g.week = 30
      aiPreContractPoach(g, mulberry32(seed))
      unwarned += (g.preContracts ?? []).length
    }
    expect(unwarned).toBe(0)
  })
})

describe('the club man left out by the country\'s coach', () => {
  const setup = (pers: Player['pers'], morale: number) => {
    const g = newGame('leicester', 'Drop', 71)
    g.natTeam = 'ENG'
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad)!
    p.pers = pers; p.morale = morale; p.wantsOut = 0
    return { g, p }
  }
  it('a happy professional takes it on the chin', () => {
    const { g, p } = setup('Professional', 8)
    expect(clubManLeftOut(g, p)).toBe('fine')
    expect(p.morale).toBeGreaterThan(7.7)
  })
  it('a loyal man in a middling mood is hurt', () => {
    const { g, p } = setup('Loyal', 6)
    expect(clubManLeftOut(g, p)).toBe('hurt')
  })
  it('an unhappy temperamental player is angry, but never asks to leave (1.9.15)', () => {
    const { g, p } = setup('Temperamental', 4)
    expect(clubManLeftOut(g, p)).toBe('angry')
    expect(p.wantsOut ?? 0).toBe(0)
    expect(p.morale).toBeLessThan(4)
    expect(g.news.some(n => n.k === 'news.natClubDrop')).toBe(true)
  })
  it('only for his own club, and only with a national job', () => {
    const { g, p } = setup('Ambitious', 4)
    g.natTeam = null
    expect(clubManLeftOut(g, p)).toBeNull()
  })
})

describe('next season\'s cover', () => {
  it('names a unit short next season', () => {
    const g = newGame('leicester', 'Cover', 81)
    for (const id of g.clubs.leicester.players) { const p = g.players[id]; if (p.pos === 'SH' || p.pos === 'FH') p.contractEnds = g.season }
    const short = lightNextSeason(g, 'leicester')
    expect(short.map(x => x.label)).toContain('finances.unitHalves')
  })
})
