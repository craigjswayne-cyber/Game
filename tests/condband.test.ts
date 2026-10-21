/**
 * ---- THE COLOUR AGREES WITH THE FIGURE (1.9.4) ----
 *
 * The team sheet prints a man's condition as Math.round(cond)% and colours it
 * green from 85, gold from 68, red below. Conditions carry fractions (a
 * recovery week's +3.5, a gossip knock of 12 to 22), and the colour was read
 * off the raw value: 84.6 printed "85%" in gold, 67.5 printed "68%" in red.
 * The band is read off the figure on screen now.
 */
import { describe, expect, it } from 'vitest'
import { condBand } from '../src/game/condition'

describe('condition bands read the figure that is printed', () => {
  it('85% is fit and 84% is not, however the raw value rounds', () => {
    expect(condBand(85)).toBe('fit')
    expect(condBand(84.6)).toBe('fit')
    expect(condBand(84.5)).toBe('fit')
    expect(condBand(84.4)).toBe('knock')
    expect(condBand(84)).toBe('knock')
  })

  it('68% carries a knock and 67% is tired', () => {
    expect(condBand(68)).toBe('knock')
    expect(condBand(67.5)).toBe('knock')
    expect(condBand(67.4)).toBe('tired')
    expect(condBand(20)).toBe('tired')
    expect(condBand(100)).toBe('fit')
  })

  it('every printed figure from 0 to 100 has one band, the same for any raw value behind it', () => {
    for (let raw = 0; raw <= 100; raw += 0.1) {
      const shown = Math.round(raw)
      expect(condBand(raw)).toBe(condBand(shown))
    }
  })
})
