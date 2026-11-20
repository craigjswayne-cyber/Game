// THE SKELETON OF THE NEW MATCH SIMULATION (2.0.0 stage 1).
//
// Owner, 20 November 2026: "There is still no connection with players,
// commentary & graphics... I want this doing proper." The new engine plays a
// match one phase at a time and writes a record of it. This holds the first
// stage: the same seed plays the same match, no match ever does anything the
// laws forbid (an illegal move throws inside the simulation), the record is
// continuous, and an average match has the shape of a real one. The full
// table against its sources is scripts/simshape.ts.
import { describe, expect, it } from 'vitest'
import { simSkeleton } from '../src/game/sim/skeleton'

describe('the match skeleton', () => {
  it('plays the same match from the same seed', () => {
    expect(JSON.stringify(simSkeleton({ seed: 7 }))).toBe(JSON.stringify(simSkeleton({ seed: 7 })))
    expect(JSON.stringify(simSkeleton({ seed: 7 }))).not.toBe(JSON.stringify(simSkeleton({ seed: 8 })))
  })

  it('keeps the laws, the clock and the score over 300 matches', () => {
    const N = 300
    let rucks = 0, scrums = 0, lineouts = 0, pens = 0, tries = 0, points = 0, live = 0, kicks = 0
    for (let i = 0; i < N; i++) {
      const r = simSkeleton({ seed: 5000 + i }) // an illegal sequence throws
      const last = r.plays[r.plays.length - 1]
      expect(last.kind).toBe('fullTime')
      expect(r.plays.filter(p => p.kind === 'halfTime').length).toBe(1)
      let s0 = 0, s1 = 0
      for (let k = 0; k < r.plays.length; k++) {
        const p = r.plays[k]
        expect(p.n).toBe(k)
        expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(100)
        // the score only ever goes up, and only on a score
        expect(p.score[0]).toBeGreaterThanOrEqual(s0); expect(p.score[1]).toBeGreaterThanOrEqual(s1)
        if (p.score[0] + p.score[1] > s0 + s1) expect(['try', 'conversion', 'penaltyGoal', 'dropGoal']).toContain(p.kind)
        s0 = p.score[0]; s1 = p.score[1]
        // a try is followed by its conversion, and a score by a kick-off (or the whistle)
        if (p.kind === 'try') expect(r.plays[k + 1].kind).toBe('conversion')
        if (p.kind === 'conversion' || (p.kind === 'penaltyGoal' && p.good)) expect(['kickoff', 'halfTime', 'fullTime']).toContain(r.plays[k + 1].kind)
        // a scrum has a reason before it
        if (p.kind === 'scrum') {
          let j = k - 1
          while (r.plays[j].kind === 'yellowCard' || r.plays[j].kind === 'redCard') j--
          expect(['knockOn', 'forwardPass', 'notStraight', 'unplayable', 'restartError', 'penalty', 'halfTime']).toContain(r.plays[j].kind)
        }
        live += p.live
        if (p.kind === 'ruck' || p.kind === 'maul') rucks++
        if (p.kind === 'scrum') scrums++
        if (p.kind === 'lineout') lineouts++
        if (p.kind === 'kick') kicks++
        if (p.kind === 'penalty' || p.kind === 'freeKick') pens++
        if (p.kind === 'try') tries++
      }
      expect(r.score).toEqual(last.score)
      points += r.score[0] + r.score[1]
    }
    // the shape of a real match (docs/match-sim-spec.md section 4), with room for 300 matches of noise
    expect(live / N / 60).toBeGreaterThan(32); expect(live / N / 60).toBeLessThan(38)
    expect(rucks / N).toBeGreaterThan(150); expect(rucks / N).toBeLessThan(190)
    expect(kicks / N).toBeGreaterThan(38); expect(kicks / N).toBeLessThan(52)
    expect(scrums / N).toBeGreaterThan(11); expect(scrums / N).toBeLessThan(17)
    expect(lineouts / N).toBeGreaterThan(22); expect(lineouts / N).toBeLessThan(29)
    expect(pens / N).toBeGreaterThan(9.5); expect(pens / N).toBeLessThan(13.5)
    expect(tries / N).toBeGreaterThan(5.6); expect(tries / N).toBeLessThan(7)
    expect(points / N).toBeGreaterThan(46); expect(points / N).toBeLessThan(55)
  })

  it('lets the stronger side win more often', () => {
    let strong = 0
    const N = 300
    for (let i = 0; i < N; i++) { const r = simSkeleton({ seed: 9000 + i, strength: [1.15, 1] }); if (r.score[0] > r.score[1]) strong++ }
    expect(strong / N).toBeGreaterThan(0.6)
  })
})
