// Where a kick at goal is taken from (1.9.16, owner: "the placement seems too
// far back? It should be to get the best angle").
import { describe, expect, it } from 'vitest'
import { CON_FAR, CON_NEAR, POST_HALF, conversionBack, goalAngle, penaltyBack } from '../src/ui/highlight/goalkick'
import { buildClip } from '../src/ui/highlight/build'
import type { MatchEvent } from '../src/game/model'

describe('where a conversion is taken from', () => {
  it('under the posts: close in', () => {
    expect(conversionBack(0)).toBe(CON_NEAR)
    expect(conversionBack(POST_HALF)).toBe(CON_NEAR)
    expect(CON_NEAR).toBeGreaterThanOrEqual(10)
    expect(CON_NEAR).toBeLessThanOrEqual(15)
  })

  it('the wider the try, the further back, and never past the cap', () => {
    let last = 0
    for (let d = 0; d <= 35; d += 0.5) {
      const b = conversionBack(d)
      expect(b).toBeGreaterThanOrEqual(last)
      expect(b).toBeLessThanOrEqual(CON_FAR)
      last = b
    }
    // ten metres in from touch (25 m from the middle), and five in
    expect(conversionBack(25)).toBeCloseTo(Math.sqrt(25 * 25 - 2.8 * 2.8), 6)
    expect(conversionBack(25)).toBeCloseTo(24.84, 2)
    expect(conversionBack(30)).toBeCloseTo(29.87, 2)
    // on the touchline itself the best angle is 34.9 m back: he stops at the cap
    expect(conversionBack(35)).toBe(CON_FAR)
  })

  it('the same either side of the posts', () => {
    for (const d of [3, 12, 25, 33]) expect(conversionBack(-d)).toBe(conversionBack(d))
  })

  it('between the near mark and the cap it IS the widest angle on that line', () => {
    for (const d of [14, 18, 22, 25, 29]) {
      const b = conversionBack(d)
      expect(b).toBeGreaterThan(CON_NEAR)
      expect(b).toBeLessThan(CON_FAR)
      const here = goalAngle(d, b)
      for (const step of [-6, -3, -1, 1, 3, 6]) expect(here).toBeGreaterThan(goalAngle(d, b + step))
    }
  })

  it('and it beats the old fixed 15 m for every wide try', () => {
    for (const d of [20, 25, 30]) expect(goalAngle(d, conversionBack(d))).toBeGreaterThan(goalAngle(d, 15))
  })
})

describe('where a penalty at goal is taken from', () => {
  it('the mark, not walked back', () => {
    for (const m of [5, 9, 15, 22, 38, 47, 55]) expect(penaltyBack(m)).toBe(m)
  })
  it('a mark inside five metres comes out to the five-metre line, and the drawing stops at sixty', () => {
    expect(penaltyBack(2)).toBe(5)
    expect(penaltyBack(75)).toBe(60)
  })
})

describe('the kick clip uses them', () => {
  const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER', heldup: 'HELD UP' }
  const colours = { home: ['#c00', '#fff'] as [string, string], away: ['#00c', '#fff'] as [string, string] }
  const ev = (type: MatchEvent['type'], teamId: string, fld: number, k: string): MatchEvent =>
    ({ min: 10, type, teamId, fld, text: '', k, homeScore: 0, awayScore: 0 })
  const clip = (events: MatchEvent[], m: number) => buildClip(events, m, 'kick', 'h', () => 10, colours, labels, () => 'N')
  const tryY = (events: MatchEvent[], m: number) => buildClip(events, m, 'try', 'h', () => 10, colours, labels, () => 'N').finish.y

  it('a conversion, made or missed, is on the line of the try and back by the angle', () => {
    for (const teamId of ['h', 'a']) for (const [type, k] of [['CON', 'comm.con1'], ['SUB', 'comm.conWide']] as const) {
      for (let pad = 0; pad < 12; pad++) {
        // the try came from 40 m out: the old missed conversion was drawn from there
        const events = [...Array.from({ length: pad }, () => ev('SUB', 'x', 50, 'comm.pad')),
          ev('TRY', teamId, teamId === 'h' ? 60 : 40, 'comm.try1'), ev(type, teamId, teamId === 'h' ? 60 : 40, k)]
        const c = clip(events, pad + 1)
        const y = Math.max(5, Math.min(65, tryY(events, pad)))
        expect(c.finish.y).toBeCloseTo(y, 6)
        const out = teamId === 'h' ? 100 - c.finish.x : c.finish.x
        expect(out).toBeCloseTo(conversionBack(y - 35), 6)
        expect(c.kickGood).toBe(type === 'CON')
      }
    }
  })

  it('a penalty, made or missed, is at the mark', () => {
    for (const out of [7, 18, 33, 46]) {
      expect(100 - clip([ev('PEN', 'h', 100 - out, 'comm.pen1')], 0).finish.x).toBe(out)
      expect(clip([ev('SUB', 'a', out, 'comm.penWide')], 0).finish.x).toBe(out)
    }
  })
})
