/** Swapping a marquee player (1.9.14, src/game/cap.ts swapMarquee). */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { swapMarquee } from '../src/game/cap'

const setup = () => {
  const g = newGame('leicester', 'Marquee', 5)
  const c = g.clubs[g.userClubId]
  const other = c.players.map(id => g.players[id]).find(p => p && !p.acad && !(c.marquee ?? []).includes(p.id))!
  return { g, c, other }
}

describe('swapMarquee', () => {
  it('a new career starts with both slots taken', () => {
    expect(setup().c.marquee?.length).toBe(2)
  })
  it('moves the slot from one man to another, in the window', () => {
    const { g, c, other } = setup()
    const out = c.marquee![0]
    expect(swapMarquee(g, out, other.id)).toBe(true)
    expect(c.marquee).toContain(other.id)
    expect(c.marquee).not.toContain(out)
    expect(c.marquee!.length).toBe(2)
  })
  it('is locked outside the window', () => {
    const { g, c, other } = setup()
    g.week = 14
    expect(swapMarquee(g, c.marquee![0], other.id)).toBe(false)
  })
  it('will not swap in a man who is not ours, or out a man who has no slot', () => {
    const { g, c, other } = setup()
    const theirs = Object.values(g.players).find(p => p.clubId && p.clubId !== g.userClubId)!
    expect(swapMarquee(g, c.marquee![0], theirs.id)).toBe(false)
    expect(swapMarquee(g, other.id, c.marquee![0])).toBe(false)
  })
})
