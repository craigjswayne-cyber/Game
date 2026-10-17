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
import { hex6, kitGap, kitInk, luma } from '../src/ui/kit'

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
})
