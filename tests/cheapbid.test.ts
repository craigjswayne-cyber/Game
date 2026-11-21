/**
 * ---- A CHEAP MAN CAN BE BOUGHT FOR WHAT HE IS WORTH (1.9.16) ----
 * His club's lowest price was rounded to the nearest 50k, so a 30k man could
 * not be had for 30k and a 20k man's floor was nothing.
 */
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { agreeFee, floorPrice } from '../src/game/ai'
import { askingPrice } from '../src/game/transferRules'

describe('cheap bids', () => {
  const g = newGame('northampton', 'Cal', 11)
  const cheap = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.acad
    && askingPrice(g, p) > 0 && askingPrice(g, p) < 250_000)
  it('there are cheap men in the world to test with', () => { expect(cheap.length).toBeGreaterThan(20) })
  it('no cheap man has a floor of nothing, or one far above his ask without a rival premium', () => {
    for (const p of cheap) {
      const ask = askingPrice(g, p), floor = floorPrice(g, p)
      expect(floor).toBeGreaterThan(0)
      expect(floor).toBeLessThanOrEqual(Math.ceil(ask * 1.6))
    }
  })
  it('bidding the floor is never refused as too low', () => {
    let tried = 0
    for (const p of cheap.slice(0, 40)) {
      const floor = floorPrice(g, p)
      if (floor > g.clubs[g.userClubId].budget) continue
      const r = agreeFee(g, p.id, floor)
      if (r.counter != null) throw new Error(`${p.name}: floor ${floor} countered at ${r.counter}`)
      tried++
    }
    expect(tried).toBeGreaterThan(5)
  })
})
