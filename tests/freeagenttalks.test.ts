/**
 * ---- FREE-AGENT TALKS (1.9.14) ----
 *
 * Player feedback (Instagram, 16 Nov 2026): "You currently can't negotiate
 * with free agents on wages. Be good to add in!" offerFreeAgent takes a wage
 * and a length (1-3 seasons). What must hold:
 *   the one-tap door is unchanged       asking wage, two seasons
 *   each length has its own asking      his own choice is cheapest
 *   95% of the asking signs             at the offer, not the asking
 *   under 80% is a refusal              no counter, nothing signed
 *   between, a counter is a promise     meeting it always signs
 *   the same offer, same week           the same answer
 *   never under his last wage           a released man is not cheaper again
 *   the guards                          wage budget, no desk, silly figures
 *   the resale term                     never under two seasons
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { FREE_TERMS, freeAgentDemand, freeAgentTerm, offerFreeAgent, renewalDemand, signFreeAgent } from '../src/game/ai'
import type { GameState, Player } from '../src/game/model'

function freeAgent(g: GameState, pick: (q: Player) => boolean = () => true): Player {
  const p = Object.values(g.players).find(q => q.clubId && q.clubId !== g.userClubId && !q.acad && q.ca < 60 && pick(q))!
  g.clubs[p.clubId!].players = g.clubs[p.clubId!].players.filter(id => id !== p.id)
  p.clubId = null
  return p
}

describe('free-agent talks', () => {
  it('the one-tap door still signs at the asking wage for two seasons', () => {
    const g = newGame('bath', 'FA', 71)
    const p = freeAgent(g)
    const ask = renewalDemand(p)
    expect(freeAgentDemand(p, 2)).toBe(Math.max(Math.round(ask / 50) * 50, Math.round(p.wage / 50) * 50))
    const r = signFreeAgent(g, p.id)
    expect(r.ok).toBe(true)
    expect(p.clubId).toBe(g.userClubId)
    expect(p.contractEnds).toBe(g.season + 2)
    expect(p.freeUntil).toBe(g.season + 2)
  })

  it('his own choice of length is the cheapest', () => {
    const g = newGame('bath', 'FA', 72)
    for (const age of [21, 26, 31]) {
      const p = freeAgent(g, q => q.age === age) ?? freeAgent(g)
      const pref = freeAgentTerm(p)
      const asks = FREE_TERMS.map(y => freeAgentDemand(p, y))
      expect(Math.min(...asks)).toBe(freeAgentDemand(p, pref))
    }
  })

  it('95% of the asking signs, at the offer', () => {
    const g = newGame('leicester', 'FA', 73)
    const p = freeAgent(g)
    p.wage = 0 // a man with nothing to fall back on
    const ask = freeAgentDemand(p, 3)
    const offer = Math.round((ask * 0.95) / 50) * 50 + 50
    const r = offerFreeAgent(g, p.id, offer, 3)
    expect(r.ok).toBe(true)
    expect(p.wage).toBe(offer)
    expect(p.contractEnds).toBe(g.season + 3)
  })

  it('a one-season deal keeps the two-season resale term', () => {
    const g = newGame('leicester', 'FA', 74)
    const p = freeAgent(g)
    const r = offerFreeAgent(g, p.id, freeAgentDemand(p, 1), 1)
    expect(r.ok).toBe(true)
    expect(p.contractEnds).toBe(g.season + 1)
    expect(p.freeUntil).toBe(g.season + 2)
  })

  it('a lowball is refused with no counter and nothing signed', () => {
    const g = newGame('bath', 'FA', 75)
    const p = freeAgent(g)
    p.wage = 0
    const r = offerFreeAgent(g, p.id, Math.round(freeAgentDemand(p, 2) * 0.6), 2)
    expect(r.ok).toBe(false)
    expect(r.counter).toBeUndefined()
    expect(p.clubId).toBeNull()
  })

  it('in the close range a counter always signs when met, and the week repeats its answer', () => {
    let countered = 0
    for (let seed = 1; seed <= 40; seed++) {
      const g = newGame('bath', 'FA', 100 + seed)
      const p = freeAgent(g)
      p.wage = 0
      const offer = Math.round(freeAgentDemand(p, 2) * 0.82)
      const a = offerFreeAgent(g, p.id, offer, 2)
      if (a.ok) continue
      expect(a.counter).toBeGreaterThan(offer)
      const again = offerFreeAgent(g, p.id, offer, 2)
      expect(again.ok).toBe(false)
      expect(again.counter).toBe(a.counter)
      const met = offerFreeAgent(g, p.id, a.counter!, 2)
      expect(met.ok).toBe(true)
      expect(p.wage).toBe(a.counter)
      countered++
    }
    expect(countered).toBeGreaterThan(5)
  })

  it('never signs under the wage he last earned', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame('bath', 'FA', 200 + seed)
      const p = freeAgent(g)
      const earned = Math.round(p.wage / 50) * 50
      const r = offerFreeAgent(g, p.id, Math.round(earned * 0.9), 2)
      if (r.ok) expect(p.wage).toBeGreaterThanOrEqual(earned)
      else if (r.counter != null) expect(r.counter).toBeGreaterThanOrEqual(earned)
    }
  })

  it('keeps the guards: no desk, wage budget, silly figures', () => {
    const g = newGame('bath', 'FA', 76)
    const p = freeAgent(g)
    expect(offerFreeAgent(g, p.id, Number.NaN, 2).ok).toBe(false)
    expect(offerFreeAgent(g, p.id, -5, 2).ok).toBe(false)
    expect(offerFreeAgent(g, p.id, 1e12, 2).ok).toBe(false) // over the wage budget
    g.unemployed = true
    expect(offerFreeAgent(g, p.id, freeAgentDemand(p, 2), 2).ok).toBe(false)
    g.unemployed = false
    expect(p.clubId).toBeNull()
  })
})
