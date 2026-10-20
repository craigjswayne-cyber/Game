import { describe, expect, it } from 'vitest'
import { REVIEW_AFTER, reviewDue } from '../src/game/reviewask'

describe('store review ask', () => {
  it('waits for eight competitive matches', () => {
    expect(REVIEW_AFTER).toBe(8)
    expect(reviewDue(7, false)).toBe(false)
    expect(reviewDue(8, false)).toBe(true)
    expect(reviewDue(40, false)).toBe(true)
  })
  it('asks only once on a device', () => {
    expect(reviewDue(8, true)).toBe(false)
  })
})
