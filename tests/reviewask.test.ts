import { describe, expect, it, vi } from 'vitest'
import { REVIEW_AFTER, REVIEW_KEY, markReviewAsked, parseReview, readReview, reviewDue } from '../src/game/reviewask'

// the ask lives in localStorage, so a reload is a fresh read of the same store
const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
})

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
  it('walks the three asks through storage, as reloads would, and stops', () => {
    store.clear()
    const asked: number[] = []
    // one match at a time, re-reading storage at every step
    for (let m = 0; m <= 400; m++) {
      if (reviewDue(m, readReview())) { markReviewAsked(m); asked.push(m) }
    }
    expect(asked).toEqual([8, 38, 98])
    expect(JSON.parse(store.get(REVIEW_KEY)!)).toEqual({ n: 3, at: 98 })
  })
  it('a 1.9.3 player asked at eight and already far past it is asked once now, then after the last gap, then never', () => {
    store.clear()
    store.set(REVIEW_KEY, '1')
    const asked: number[] = []
    for (let m = 150; m <= 500; m++) {
      if (reviewDue(m, readReview())) { markReviewAsked(m); asked.push(m) }
    }
    expect(asked).toEqual([150, 210])
  })
})
