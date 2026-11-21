/** The money steppers never raise a figure on a minus (1.9.16, owner's bid bug). */
import { describe, expect, it } from 'vitest'
import { cleanFee, feeSteps, stepFee, stepLabel, wageDown, wageStep } from '../src/game/bidstep'

describe('fee stepper', () => {
  it('a 30k player steps in 5k and 25k, and minus goes DOWN', () => {
    const [s, b] = feeSteps(30_000)
    expect([s, b]).toEqual([5_000, 25_000])
    expect(stepFee(30_000, -b, 30_000)).toBe(5_000)
    expect(stepFee(30_000, -s, 30_000)).toBe(25_000)
  })
  it('no press of minus ever raises a bid, at any size', () => {
    for (const ref of [1_000, 4_000, 30_000, 240_000, 600_000, 3_000_000]) {
      for (const step of feeSteps(ref)) {
        let bid = ref
        for (let i = 0; i < 40; i++) {
          const next = stepFee(bid, -step, ref)
          expect(next).toBeLessThanOrEqual(bid)
          expect(next).toBeGreaterThan(0)
          bid = next
        }
      }
    }
  })
  it('big fees keep the old 100k and 500k steps', () => {
    expect(feeSteps(2_400_000)).toEqual([100_000, 500_000])
    expect(stepFee(2_400_000, 500_000, 2_400_000)).toBe(2_900_000)
  })
  it('labels read as money', () => {
    expect([5_000, 25_000, 100_000, 500_000, 1_000_000].map(stepLabel)).toEqual(['5k', '25k', '100k', '500k', '1m'])
  })
})

describe('wage stepper', () => {
  it('minus on a 300 a week wage goes down, not up to 500', () => {
    expect(wageDown(300)).toBe(250)
  })
  it('never raises and never reaches nothing', () => {
    for (const start of [30, 300, 1_000, 4_800, 5_000, 22_000]) {
      let w = start
      for (let i = 0; i < 200; i++) {
        const next = wageDown(w)
        expect(next).toBeLessThanOrEqual(w)
        expect(next).toBeGreaterThan(0)
        w = next
      }
    }
  })
  it('steps grow with the wage', () => {
    expect([400, 2_000, 9_000].map(wageStep)).toEqual([50, 250, 500])
  })
})

describe('cleanFee', () => {
  it('big fees round to 50k as they always did', () => {
    expect(cleanFee(1_847_300)).toBe(1_850_000)
    expect(cleanFee(520_000)).toBe(500_000)
  })
  it('a 30k fee stays 30k, not 50k', () => { expect(cleanFee(30_000)).toBe(30_000) })
  it('a small fee never rounds to nothing', () => {
    expect(cleanFee(20_000)).toBe(20_000)
    expect(cleanFee(300)).toBe(1_000)
    expect(cleanFee(0)).toBe(0)
  })
})
