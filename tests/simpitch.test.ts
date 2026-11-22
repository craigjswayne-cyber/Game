// THE STADIUM PITCH PLAYS THE RECORD (2.0.0 rebuild, src/ui/livepitch/fromRecord.ts).
//
// Owner, 20 November 2026, on the pitch that guessed the play from the old
// engine's commentary: players near no ball knocking on, runs sideways and
// backwards, the ball flying back, things said that were never shown. The
// pitch now plays the new engine's record (Play[]) and nothing else. These
// checks run on the positions it bakes, frame by frame, for twenty real
// fixtures (a new game on each seed, the user's first match, real team
// sheets and named players, as scripts/simread.ts plays them):
//   - the ball is in the hands of the man holding it, never a stride away;
//   - nobody jumps: no man faster than 9.5 m/s from one frame to the next,
//     no ball faster than 40 m/s;
//   - a man carrying the ball in open play does not run backwards with it;
//   - at every play the ball is where the record says (expectedAt), and the
//     side shown with it is the record's;
//   - an Extended match takes 3.5 to 4.5 minutes to watch.
import { describe, expect, it } from 'vitest'
import { simSkeleton } from '../src/game/sim/skeleton'
import type { Play } from '../src/game/sim/record'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'
import { worldFromMatch, type SimSide } from '../src/game/sim/fromMatch'
import { bake, expectedAt, FPS, pieces, schedule, type Baked } from '../src/ui/livepitch/fromRecord'

function realMatch(seed: number): { plays: Play[]; sides: [SimSide, SimSide] } {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  if (!fx) throw new Error(`no fixture for seed ${seed}`)
  const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
  return { plays: simSkeleton({ seed, world }).plays, sides: [home, away] }
}

interface Faults {
  holderGap: number; manSpeed: number; ballSpeed: number; carryBack: number
  marks: string[]; sides: string[]; view: number; where: Record<string, string>
}

/** every check over one baked match: the worst of each, and where it was */
function measure(bk: Baked): Faults {
  const P = bk.plays
  const f: Faults = { holderGap: 0, manSpeed: 0, ballSpeed: 0, carryBack: 0, marks: [], sides: [], view: 0, where: {} }
  const at = (fr: number) => `frame ${fr}, play ${bk.seg[fr]} ${P[bk.seg[fr]].kind}/${P[bk.seg[fr]].result}`
  let spell = -1, best = 0
  for (let fr = 0; fr < bk.n; fr++) {
    const h = bk.holder[fr]
    if (h >= 0) {
      const gap = Math.hypot(bk.ball[fr * 3] - bk.pos[fr * 62 + h * 2], bk.ball[fr * 3 + 1] - bk.pos[fr * 62 + h * 2 + 1])
      if (gap > f.holderGap) { f.holderGap = gap; f.where.holderGap = at(fr) }
    }
    if (fr > 0) {
      for (let i = 0; i < 31; i++) {
        const v = Math.hypot(bk.pos[fr * 62 + i * 2] - bk.pos[(fr - 1) * 62 + i * 2], bk.pos[fr * 62 + i * 2 + 1] - bk.pos[(fr - 1) * 62 + i * 2 + 1]) * FPS
        if (v > f.manSpeed) { f.manSpeed = v; f.where.manSpeed = `${at(fr)}, man ${i}` }
      }
      const bv = Math.hypot(bk.ball[fr * 3] - bk.ball[(fr - 1) * 3], bk.ball[fr * 3 + 1] - bk.ball[(fr - 1) * 3 + 1]) * FPS
      if (bv > f.ballSpeed) { f.ballSpeed = bv; f.where.ballSpeed = at(fr) }
    }
    // carrying in open play: the furthest forward he has been with it, and how far back from that he goes
    const g = bk.segs[bk.seg[fr]], p = P[g.n]
    const live = g.live && fr / FPS < g.a0 + g.act
    if (!live || h < 0 || h !== spell) { spell = live ? h : -1; best = spell >= 0 ? bk.pos[fr * 62 + h * 2] : 0; continue }
    const dir = h < 15 ? 1 : -1, x = bk.pos[fr * 62 + h * 2]
    if ((x - best) * dir > 0) best = x
    const back = (best - x) * dir
    // (the record can say a carry went backwards: then so may he)
    if (back > f.carryBack && !((p.kind === 'carry' || p.kind === 'maul') && (p.gain ?? 0) < 0)) { f.carryBack = back; f.where.carryBack = at(fr) }
  }
  for (const g of bk.segs) {
    const p = P[g.n], e = expectedAt(p, P[g.n + 1])
    if (e.tol === Infinity) continue
    // the frame at the mark, inside the play
    const fr = Math.max(Math.ceil(g.a0 * FPS - 1e-6), Math.min(bk.n - 1, Math.floor(g.mark * FPS + 1e-6)))
    const bx = bk.ball[fr * 3], by = bk.ball[fr * 3 + 1]
    const err = Math.max(e.x != null ? Math.abs(bx - e.x) : 0, e.y != null ? Math.abs(by - e.y) : 0)
    if (err > e.tol) f.marks.push(`play ${g.n} ${p.kind}/${p.result}: ball (${bx.toFixed(1)}, ${by.toFixed(1)}), record (${p.x}, ${p.y}), off by ${err.toFixed(1)} m`)
    const h = bk.holder[fr]
    if (bk.poss[fr] !== p.ball || (h >= 0 && (h < 15 ? 0 : 1) !== p.ball)) f.sides.push(`play ${g.n} ${p.kind}/${p.result}: shown with side ${bk.poss[fr]}, held by ${h}, record ball ${p.ball}`)
  }
  const ps = pieces(bk)
  f.view = ps.length ? ps[ps.length - 1].v1 : 0
  return f
}

describe('the stadium pitch plays the record', () => {
  it('bakes the same frames from the same record, and the schedule covers every play in order', () => {
    const plays = simSkeleton({ seed: 11 }).plays
    const a = bake(plays), b = bake(plays)
    expect(a.n).toBe(b.n)
    expect(Buffer.from(a.pos.buffer).equals(Buffer.from(b.pos.buffer))).toBe(true)
    const sch = schedule(plays)
    expect(sch.map(s => s.n)).toEqual(plays.map(p => p.n))
    for (let k = 1; k < sch.length; k++) expect(sch[k].start).toBeGreaterThanOrEqual(sch[k - 1].start + sch[k - 1].dur - 1e-6)
    for (const s of sch) { expect(s.dur).toBeGreaterThan(0); expect(s.fade).toBe(false) }
  })

  it('over twenty real fixtures: ball in hand, no jumps, no running back with it, the record kept, about four minutes', () => {
    const seeds = [4242, ...Array.from({ length: 19 }, (_, i) => i + 1)]
    const worst = { holderGap: 0, manSpeed: 0, ballSpeed: 0, carryBack: 0 }
    const where: Record<string, string> = {}
    const marks: string[] = [], sides: string[] = [], views: number[] = []
    let plays = 0
    for (const seed of seeds) {
      const m = realMatch(seed)
      const f = measure(bake(m.plays, m.sides))
      plays += m.plays.length
      for (const k of Object.keys(worst) as (keyof typeof worst)[]) if (f[k] > worst[k]) { worst[k] = f[k]; where[k] = `seed ${seed}, ${f.where[k]}` }
      marks.push(...f.marks.map(s => `seed ${seed} ${s}`))
      sides.push(...f.sides.map(s => `seed ${seed} ${s}`))
      views.push(f.view)
    }
    const report = { plays, worst, where, marks: marks.length, sides: sides.length, minutes: [Math.min(...views) / 60, Math.max(...views) / 60].map(v => v.toFixed(2)) }
    console.log('simpitch:', JSON.stringify(report, null, 1))
    if (marks.length) console.log(marks.slice(0, 10).join('\n'))
    if (sides.length) console.log(sides.slice(0, 10).join('\n'))
    expect(worst.holderGap).toBeLessThanOrEqual(1.5)
    expect(worst.manSpeed).toBeLessThanOrEqual(9.5)
    expect(worst.ballSpeed).toBeLessThanOrEqual(40)
    expect(worst.carryBack).toBeLessThanOrEqual(2.5)
    expect(marks).toEqual([])
    expect(sides).toEqual([])
    for (const v of views) { expect(v).toBeGreaterThanOrEqual(210); expect(v).toBeLessThanOrEqual(270) }
  }, 240_000)
})
