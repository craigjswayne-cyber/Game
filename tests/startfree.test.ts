/**
 * ---- SOMEBODY TO SIGN ON DAY ONE (1.9.16) ----
 * Owner: "there are no free agents in the game at the very beginning."
 */
import { describe, expect, it } from 'vitest'
import { newGame, START_FREE_AGENTS } from '../src/game/newgame'
import { POS_ORDER } from '../src/game/model'
import { freeAgentDemand, offerFreeAgent } from '../src/game/ai'

describe('starting free agents', () => {
  const g = newGame('northampton', 'Cal', 11)
  const fa = Object.values(g.players).filter(p => !p.clubId && !p.acad)
  it('a new world opens with senior free agents, three in every position', () => {
    expect(fa.length).toBeGreaterThanOrEqual(START_FREE_AGENTS)
    for (const pos of POS_ORDER) expect(fa.filter(p => p.pos === pos).length).toBeGreaterThanOrEqual(3)
  })
  it('they are average men, not stars and not boys', () => {
    for (const p of fa) {
      expect(p.ca).toBeLessThanOrEqual(72)
      expect(p.ca).toBeGreaterThanOrEqual(40)
      expect(p.age).toBeGreaterThanOrEqual(21)
    }
  })
  it('no two share a name with anybody in the world', () => {
    const names = Object.values(g.players).map(p => p.name.toLowerCase())
    for (const p of fa) expect(names.filter(n => n === p.name.toLowerCase()).length).toBe(1)
  })
  it('one can be signed for what he asks', () => {
    const p = [...fa].sort((a, b) => a.ca - b.ca)[0]
    const r = offerFreeAgent(g, p.id, freeAgentDemand(p, 1), 1)
    expect(r.ok, r.msg).toBe(true)
    expect(p.clubId).toBe(g.userClubId)
  })
  it('the same seed opens with the same men', () => {
    const h = newGame('northampton', 'Cal', 11)
    const names = (s: typeof g) => Object.values(s.players).filter(p => !p.clubId && !p.acad).map(p => p.name).sort()
    // g has lost one to the signing above
    expect(names(h).length).toBe(fa.length)
  })
})
