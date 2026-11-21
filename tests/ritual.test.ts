// The challenge before a Test (1.9.16): every side that lays one down stands
// in its own shape, and the side facing it in a line on halfway.
import { describe, expect, it } from 'vitest'
import { FACING_FRONT, RITUAL_FRONT, RITUAL_SHAPES, RITUAL_WIDTH, facingLine, hasRitualShape, ritualFormation, type RitualSpot } from '../src/ui/ritual'
import { NAT_COLOURS } from '../src/data/natcolours'

/** the dot a man is drawn as is 2.3 m across: nobody inside anybody */
const DOT = 2.3
const nearest = (s: RitualSpot[]) => {
  let m = Infinity
  for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) m = Math.min(m, Math.hypot(s[i].x - s[j].x, s[i].back - s[j].back))
  return m
}

describe('the challenge formations', () => {
  it('every side in the game with a challenge has a shape of its own, and no other side has one', () => {
    const withOne = Object.keys(NAT_COLOURS).filter(c => NAT_COLOURS[c].challenge).sort()
    expect(withOne).toEqual([...RITUAL_SHAPES].sort())
    expect(hasRitualShape('ENG')).toBe(false)
  })

  for (const code of RITUAL_SHAPES) for (const n of [15, 23] as const) {
    it(`${code} x${n}: every man on the field, behind the ten-metre line, on a spot of his own`, () => {
      const s = ritualFormation(code, n)
      expect(s).toHaveLength(n)
      for (const p of s) {
        expect(p.x).toBeGreaterThanOrEqual(DOT / 2)
        expect(p.x).toBeLessThanOrEqual(RITUAL_WIDTH - DOT / 2)
        expect(p.back).toBeGreaterThanOrEqual(RITUAL_FRONT - 0.5)
        expect(p.back).toBeLessThanOrEqual(30)
      }
      expect(nearest(s)).toBeGreaterThanOrEqual(DOT)
      // centred on the middle of the field
      const mean = s.reduce((a, p) => a + p.x, 0) / n
      expect(Math.abs(mean - RITUAL_WIDTH / 2)).toBeLessThan(0.5)
    })
  }

  it('New Zealand: an arrowhead, the leader alone at its point', () => {
    for (const n of [15, 23] as const) {
      const s = ritualFormation('NZL', n)
      const [leader, ...rest] = s
      expect(leader.x).toBeCloseTo(RITUAL_WIDTH / 2)
      expect(leader.back).toBe(RITUAL_FRONT)
      for (const p of rest) expect(p.back).toBeGreaterThan(leader.back + 2)
      // each row behind is wider than the one in front of it
      const rows = new Map<number, number[]>()
      for (const p of s) rows.set(p.back, [...(rows.get(p.back) ?? []), p.x])
      const widths = [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, xs]) => Math.max(...xs) - Math.min(...xs))
      for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeGreaterThan(widths[i - 1])
    }
  })

  it('Samoa: the leader out in front of loose rows', () => {
    const [leader, ...rest] = ritualFormation('SAM')
    expect(leader.x).toBeCloseTo(RITUAL_WIDTH / 2)
    for (const p of rest) expect(p.back).toBeGreaterThan(leader.back + 2)
    // loose: the men of a row are not all on one line
    expect(new Set(rest.map(p => p.back.toFixed(2))).size).toBeGreaterThan(3)
  })

  it('Fiji and Tonga: blocks in straight rows, the leader in the middle of the front one; Fiji the tighter and deeper', () => {
    const rowsOf = (s: RitualSpot[]) => new Set(s.map(p => p.back)).size
    const width = (s: RitualSpot[]) => Math.max(...s.map(p => p.x)) - Math.min(...s.map(p => p.x))
    const fij = ritualFormation('FIJ'), tga = ritualFormation('TGA')
    expect(rowsOf(fij)).toBe(4)
    expect(rowsOf(tga)).toBe(3)
    expect(width(fij)).toBeLessThan(width(tga))
    expect(nearest(fij)).toBeLessThan(nearest(tga))
    for (const s of [fij, tga]) {
      expect(s[0].back).toBe(RITUAL_FRONT)
      expect(s[0].x).toBeCloseTo(RITUAL_WIDTH / 2)
    }
  })

  it('the four shapes are four different shapes', () => {
    const key = (c: string) => ritualFormation(c).map(p => `${p.x.toFixed(1)},${p.back.toFixed(1)}`).sort().join(' ')
    expect(new Set(RITUAL_SHAPES.map(key)).size).toBe(RITUAL_SHAPES.length)
  })

  it('the same shape every time (no dice in a drawing)', () => {
    for (const code of RITUAL_SHAPES) expect(ritualFormation(code)).toEqual(ritualFormation(code))
  })

  it('both sides performing: one may come up to halfway, and ten metres stay between them', () => {
    const up = ritualFormation('FIJ', 23, 1), held = ritualFormation('SAM', 23)
    const gap = Math.min(...up.map(p => p.back)) + Math.min(...held.map(p => p.back))
    expect(Math.min(...up.map(p => p.back))).toBeGreaterThan(0)
    expect(gap).toBeGreaterThanOrEqual(10)
  })

  it('the side facing it: one line behind halfway in a shallow arc, short of the challenge by ten metres', () => {
    for (const n of [15, 23] as const) {
      const s = facingLine(n)
      expect(s).toHaveLength(n)
      for (let k = 1; k < n; k++) expect(s[k].x).toBeGreaterThan(s[k - 1].x)
      for (const p of s) {
        expect(p.x).toBeGreaterThanOrEqual(DOT / 2)
        expect(p.x).toBeLessThanOrEqual(RITUAL_WIDTH - DOT / 2)
        expect(p.back).toBeGreaterThanOrEqual(FACING_FRONT)
        expect(p.back).toBeLessThanOrEqual(5)
      }
      expect(nearest(s)).toBeGreaterThanOrEqual(DOT)
      // the middle is the deepest, the two ends level
      expect(s[(n - 1) / 2].back).toBeGreaterThan(s[0].back)
      expect(s[0].back).toBeCloseTo(s[n - 1].back)
    }
  })
})
