// Encourage (owner, 1.9.13, from FM27 Mobile): the safe word for a bad run.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { chatBudget, encouragePlayer, praisePlayer } from '../src/game/chats'
import type { Player } from '../src/game/model'

function setup(pers: Player['pers'], form: number) {
  const g = newGame('northampton', 'Chat', 3)
  const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad)!
  p.pers = pers
  p.form = form
  p.morale = 5
  return { g, p }
}

describe('encouraging a player', () => {
  it('lifts a man out of form, and costs one of the week\'s two chats', () => {
    const { g, p } = setup('Professional', 5.5)
    encouragePlayer(g, p)
    expect(p.morale).toBeCloseTo(5.6)
    expect(chatBudget(g)).toBe(1)
  })
  it('is what a struggling hothead needs, where praise reads as sarcasm', () => {
    const a = setup('Temperamental', 5.5)
    praisePlayer(a.g, a.p)
    expect(a.p.morale).toBeLessThan(5)
    const b = setup('Temperamental', 5.5)
    encouragePlayer(b.g, b.p)
    expect(b.p.morale).toBeCloseTo(5.8)
  })
  it('does a man in form no harm, and a mercenary little good', () => {
    const a = setup('Ambitious', 7.5)
    encouragePlayer(a.g, a.p)
    expect(a.p.morale).toBeCloseTo(5.2)
    const b = setup('Mercenary', 5.5)
    encouragePlayer(b.g, b.p)
    expect(b.p.morale).toBeCloseTo(5.2)
  })
})
