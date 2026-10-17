/**
 * ---- A SHORT COLOUR IS STILL A COLOUR (1.9.1) ----
 *
 * The build's CSS minifier writes #ffffff as #fff (Vite 8), and the match
 * screen reads its spare kit colours back from tokens.css. The kit measures
 * read six digits, so a white spare read short was taken for mid-grey and its
 * commentary line came out white on white (nightcontrast, CI). hex6 widens a
 * short colour before any measure sees it.
 */
import { describe, expect, it } from 'vitest'
import { hex6, kitColours, kitGap, kitInk, luma, type Spares } from '../src/ui/kit'

describe('kit colours read short hex as the colour it is', () => {
  it('widens #rgb and leaves everything else alone', () => {
    expect(hex6('#fff')).toBe('#ffffff')
    expect(hex6(' #a1b ')).toBe('#aa11bb')
    expect(hex6('#123456')).toBe('#123456')
    expect(hex6('var(--gold-fill)')).toBe('var(--gold-fill)')
  })

  it('measures #fff as white and #000 as black', () => {
    expect(luma('#fff')).toBe(luma('#ffffff'))
    expect(luma('#000')).toBe(0)
    expect(kitGap('#fff', '#ffffff')).toBe(0)
  })

  it('puts dark ink on a white fill however it is written', () => {
    expect(kitInk('#fff')).toEqual(kitInk('#ffffff'))
    expect(kitInk('#fff').ink).toBe('var(--prop-ink-dark)')
  })

  it('a side with no club colours wears the match kit, not a CSS name (a Test)', () => {
    const sp: Spares = { white: '#ffffff', slate: '#8c98a4', gold: '#e0b44a', ink: '#1d2733', home: '#2f8f55', away: '#b33a3a' }
    const k = kitColours(sp, undefined, undefined)
    expect(k.home[0]).toBe('#2f8f55')
    expect(k.away[0]).toBe('#b33a3a')
    expect(kitGap(k.home[0], k.away[0])).toBeGreaterThanOrEqual(150)
    // and every fill a line can wear is one a measure can read
    for (const f of [k.home[0], k.away[0]]) expect(kitInk(f).fill.startsWith('#') || kitInk(f).fill.startsWith('color-mix')).toBe(true)
    // a CSS name, if one ever arrives, counts as one of ours rather than NaN
    expect(luma('var(--gold-fill)')).toBe(128)
    expect(kitGap('var(--gold-fill)', '#ffffff')).toBe(765)
  })
})
