import { describe, expect, it } from 'vitest'
import { REVIEW_AFTER, parseReview, reviewDue } from '../src/game/reviewask'

describe('store review ask', () => {
  it('first asks after eight competitive matches', () => {
    expect(REVIEW_AFTER).toBe(8)
    expect(reviewDue(7, { n: 0, at: 0 })).toBe(false)
    expect(reviewDue(8, { n: 0, at: 0 })).toBe(true)
  })
  it('asks again 30 matches later, then 60 after that, then never', () => {
    expect(reviewDue(37, { n: 1, at: 8 })).toBe(false)
    expect(reviewDue(38, { n: 1, at: 8 })).toBe(true)
    expect(reviewDue(97, { n: 2, at: 38 })).toBe(false)
    expect(reviewDue(98, { n: 2, at: 38 })).toBe(true)
    expect(reviewDue(9999, { n: 3, at: 98 })).toBe(false)
  })
  it('reads the 1.9.3 flag as one ask at eight', () => {
    expect(parseReview('1')).toEqual({ n: 1, at: 8 })
    expect(parseReview(null)).toEqual({ n: 0, at: 0 })
    expect(parseReview('garbage')).toEqual({ n: 0, at: 0 })
  })
})
