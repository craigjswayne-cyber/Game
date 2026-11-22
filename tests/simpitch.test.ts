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
import { bake, bakeOf, BALL_PX, BUILD_MIN, CLOSE_FROM, CLOSE_MARGIN, CLOSE_RATE, expectedAt, FPS, MAN_PX, oddRuns, schedule, SCREEN_MAN, screenSmooth, TARGET_S, timeline, type Baked } from '../src/ui/livepitch/fromRecord'

function realMatch(seed: number): { plays: Play[]; sides: [SimSide, SimSide] } {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  if (!fx) throw new Error(`no fixture for seed ${seed}`)
  const { world, home, away } = worldFromMatch(g, fx, mulberry32(seed))
  return { plays: simSkeleton({ seed, world }).plays, sides: [home, away] }
}

interface Faults {
  smooth: ReturnType<typeof screenSmooth>; buildNotSlow: string[]; closeFast: string[]
  holderGap: number; manSpeed: number; ballSpeed: number; carryBack: number; screenSpeed: number
  keyNotShown: string[]; condensed: number
  marks: string[]; sides: string[]; view: number; where: Record<string, string>
}

/** every check over one baked match: the worst of each, and where it was */
function measure(bk: Baked): Faults {
  const P = bk.plays
  const f: Faults = { smooth: null as unknown as ReturnType<typeof screenSmooth>, buildNotSlow: [], closeFast: [], holderGap: 0, manSpeed: 0, ballSpeed: 0, carryBack: 0, screenSpeed: 0, keyNotShown: [], condensed: 0, marks: [], sides: [], view: 0, where: {} }
  const tl = timeline(bk)
  // (a dissolve the owner allows, before a lineout, a conversion, a kick at goal, after half-time, is the one place things move at once)
  const cut = new Set(bk.cuts)
  const at = (fr: number) => `frame ${fr}, play ${bk.seg[fr]} ${P[bk.seg[fr]].kind}/${P[bk.seg[fr]].result}`
  let spell = -1, best = 0
  for (let fr = 0; fr < bk.n; fr++) {
    const h = bk.holder[fr]
    if (h >= 0) {
      const gap = Math.hypot(bk.ball[fr * 3] - bk.pos[fr * 62 + h * 2], bk.ball[fr * 3 + 1] - bk.pos[fr * 62 + h * 2 + 1])
      if (gap > f.holderGap) { f.holderGap = gap; f.where.holderGap = at(fr) }
    }
    if (fr > 0 && !cut.has(fr)) {
      for (let i = 0; i < 31; i++) {
        const v = Math.hypot(bk.pos[fr * 62 + i * 2] - bk.pos[(fr - 1) * 62 + i * 2], bk.pos[fr * 62 + i * 2 + 1] - bk.pos[(fr - 1) * 62 + i * 2 + 1]) * FPS
        if (v > f.manSpeed) { f.manSpeed = v; f.where.manSpeed = `${at(fr)}, man ${i}` }
        // and as the screen shows him, wound on
        if (i < 30 && v * tl.rate[fr] > f.screenSpeed) { f.screenSpeed = v * tl.rate[fr]; f.where.screenSpeed = `${at(fr)}, man ${i}, ${tl.rate[fr].toFixed(2)}x` }
      }
      const bv = Math.hypot(bk.ball[fr * 3] - bk.ball[(fr - 1) * 3], bk.ball[fr * 3 + 1] - bk.ball[(fr - 1) * 3 + 1]) * FPS
      if (bv > f.ballSpeed) { f.ballSpeed = bv; f.where.ballSpeed = at(fr) }
    }
    // carrying in open play: the furthest forward he has been with it, and how far back from that he goes
    const g = bk.segs[bk.seg[fr]], p = P[g.n]
    // (a condensed passage is the ball carried along the record's path, forwards or back as the passage went)
    // (and not a restart or a set piece: until it is kicked, fed or thrown the ball is dead, and the man with it may walk it to his mark)
    const live = g.live && !g.condensed && fr / FPS < g.a0 + g.act && !['kickoff', 'dropout22', 'goalLineDropout', 'scrum', 'lineout'].includes(p.kind)
    if (!live || h < 0 || h !== spell) { spell = live ? h : -1; best = spell >= 0 ? bk.pos[fr * 62 + h * 2] : 0; continue }
    const dir = h < 15 ? 1 : -1, x = bk.pos[fr * 62 + h * 2]
    if ((x - best) * dir > 0) best = x
    const back = (best - x) * dir
    // (the record can say a carry went backwards: then so may he)
    if (back > f.carryBack && !((p.kind === 'carry' || p.kind === 'maul') && (p.gain ?? 0) < 0)) { f.carryBack = back; f.where.carryBack = at(fr) }
  }
  for (const g of bk.segs) {
    const p = P[g.n], e = expectedAt(p, P[g.n + 1])
    if (g.condensed) { f.condensed++; continue }
    // a key moment is shown in full, at life speed
    if (g.key === 2) {
      const a = Math.ceil(g.a0 * FPS), b = Math.floor((g.a0 + g.act) * FPS)
      for (let fr = a; fr < b; fr++) if (Math.abs(tl.rate[fr] - 1) > 1e-6) { f.keyNotShown.push(`play ${g.n} ${p.kind}/${p.result} at ${tl.rate[fr].toFixed(2)}x`); break }
    }
    if (e.tol === Infinity) continue
    // the frame at the mark, inside the play
    const fr = Math.max(Math.ceil(g.a0 * FPS - 1e-6), Math.min(bk.n - 1, Math.floor(g.mark * FPS + 1e-6)))
    const bx = bk.ball[fr * 3], by = bk.ball[fr * 3 + 1]
    const err = Math.max(e.x != null ? Math.abs(bx - e.x) : 0, e.y != null ? Math.abs(by - e.y) : 0)
    if (err > e.tol) f.marks.push(`play ${g.n} ${p.kind}/${p.result}: ball (${bx.toFixed(1)}, ${by.toFixed(1)}), record (${p.x}, ${p.y}), off by ${err.toFixed(1)} m`)
    const h = bk.holder[fr]
    if (bk.poss[fr] !== p.ball || (h >= 0 && (h < 15 ? 0 : 1) !== p.ball)) f.sides.push(`play ${g.n} ${p.kind}/${p.result}: shown with side ${bk.poss[fr]}, held by ${h}, record ball ${p.ball}`)
  }
  f.view = tl.total
  f.smooth = screenSmooth(bk, tl)
  // THE BUILD-UP TO A TRY AT LIFE SPEED: at least the last BUILD_MIN seconds of the passage before it
  // (the whole passage, up to 35 s, when the match has time for it)
  for (let n = 0; n < P.length; n++) {
    if (P[n].kind !== 'try') continue
    const g = bk.segs[n]
    let st = n
    while (st > 0 && P[st - 1].ball === P[n].side && !['try', 'penaltyTry', 'conversion', 'penaltyGoal', 'dropGoal', 'halfTime', 'kickoff', 'yellowCard', 'redCard'].includes(P[st - 1].kind)) st--
    const from = Math.max(bk.segs[st].a0, g.a0 - BUILD_MIN)
    for (let fr = Math.ceil(from * FPS) + 1; fr < Math.floor(g.a0 * FPS); fr++) if (Math.abs(tl.rate[fr] - 1) > 1e-6) { f.buildNotSlow.push(`try at play ${n}: ${tl.rate[fr].toFixed(2)}x ${((g.a0 - fr / FPS)).toFixed(1)} s before it`); break }
  }
  // A CLOSE GAME'S LAST FIVE MINUTES are slower: no faster than CLOSE_RATE
  const at75 = P.findIndex(p => (p.clock ?? p.t) >= CLOSE_FROM)
  if (at75 > 0 && Math.abs(P[at75 - 1].score[0] - P[at75 - 1].score[1]) <= CLOSE_MARGIN) {
    for (let fr = Math.ceil(bk.segs[at75].a0 * FPS) + Math.round(FPS * 2); fr < bk.n; fr++) if (tl.rate[fr] > CLOSE_RATE + 1e-6) { f.closeFast.push(`close finish at ${tl.rate[fr].toFixed(2)}x`); break }
  }
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
    // (every play is shown: nothing condensed, owner 22 Nov 2026 22:13; fades only where he allows them)
    for (const s of sch) { expect(s.condensed).toBe(false); expect(s.dur).toBeGreaterThan(0); if (s.fade) expect(['lineout', 'conversion', 'penaltyGoal', 'kickoff']).toContain(plays[s.n].kind) }
  })

  const seeds = [4242, ...Array.from({ length: 19 }, (_, i) => i + 1)]
  const results: { seed: number; f: Faults; plays: number }[] = []
  const all = () => {
    if (!results.length) for (const seed of seeds) { const m = realMatch(seed); results.push({ seed, plays: m.plays.length, f: measure(bakeOf(m.plays, m.sides)) }) }
    return results
  }

  it('over twenty real fixtures: ball in hand, no jumps, nobody too quick on screen, no running back with it, key moments in full, the record kept', () => {
    const worst = { holderGap: 0, manSpeed: 0, ballSpeed: 0, carryBack: 0, screenSpeed: 0 }
    const where: Record<string, string> = {}
    const marks: string[] = [], sides: string[] = [], keys: string[] = []
    let plays = 0, condensed = 0
    for (const { seed, f, plays: np } of all()) {
      plays += np; condensed += f.condensed
      for (const k of Object.keys(worst) as (keyof typeof worst)[]) if (f[k] > worst[k]) { worst[k] = f[k]; where[k] = `seed ${seed}, ${f.where[k]}` }
      marks.push(...f.marks.map(s => `seed ${seed} ${s}`))
      sides.push(...f.sides.map(s => `seed ${seed} ${s}`))
      keys.push(...f.keyNotShown.map(s => `seed ${seed} ${s}`))
    }
    console.log('simpitch:', JSON.stringify({ plays, condensed, worst, where, marks: marks.length, sides: sides.length, keys: keys.length }, null, 1))
    if (marks.length) console.log(marks.slice(0, 10).join('\n'))
    if (sides.length) console.log(sides.slice(0, 10).join('\n'))
    if (keys.length) console.log(keys.slice(0, 10).join('\n'))
    expect(worst.holderGap).toBeLessThanOrEqual(1.5)
    expect(worst.manSpeed).toBeLessThanOrEqual(9.5)
    expect(worst.ballSpeed).toBeLessThanOrEqual(40)
    // nobody on screen faster than two and a half times a sprint
    expect(worst.screenSpeed).toBeLessThanOrEqual(SCREEN_MAN + 0.05)
    expect(worst.carryBack).toBeLessThanOrEqual(2.5)
    expect(keys).toEqual([])
    expect(condensed).toBe(0)
    expect(marks).toEqual([])
    expect(sides).toEqual([])
  }, 300_000)

  // POSITIONAL PLAY (owner, 22 Nov 2026: "players just randomly travel a strange angle"). The measure is
  // scripts/tmp/oddruns.ts with the runs rugby has a reason for left out (fromRecord.ts oddRuns). On the
  // round 2 pitch (commit 7d97b361) it found 1,309 odd runs in seed 4242 and whole sides sliding 13.5 m
  // sideways in two seconds; the shape was centred on the ball across the field.
  it('men run for a reason: few odd runs, no side sliding across, wings on their touchlines, a flat defensive line', () => {
    const BEFORE = 1309
    const rows: string[] = []
    for (const seed of [4242, 1, 2]) {
      const m = realMatch(seed), bk = bakeOf(m.plays, m.sides), r = oddRuns(bk, m.sides)
      rows.push(`seed ${seed}: odd runs ${r.odd} of ${r.runs} long runs, worst side slide ${r.slide.toFixed(1)} m, wings off their lane ${(100 * r.wingShare).toFixed(1)}%, flat line at ${(100 * r.flat).toFixed(0)}% of rucks (median spread ${r.spreadMedian.toFixed(1)} m)`)
      if (seed === 4242) expect(r.odd).toBeLessThanOrEqual(BEFORE * 0.15)
      // (a side sliding across with no ball to go to: under 5 m in two seconds, the overseer's S03 limit. A side
      // going across towards a ball 5 m or more off its middle is following it, as round 4 asked after a switch,
      // and oddRuns leaves it out)
      expect(r.slide).toBeLessThan(5)
      expect(r.wingShare).toBeLessThan(0.1)
      expect(r.flat).toBeGreaterThan(0.8)
    }
    console.log('simpitch shape:\n' + rows.join('\n'))
  }, 300_000)

  it(`an Extended match takes 7 to 9 minutes to watch (TARGET_S ${TARGET_S} s), try build-ups at life speed, close finishes slower`, () => {
    const rows = all()
    console.log('simpitch minutes:', rows.map(r => (r.f.view / 60).toFixed(2)).join(' '))
    for (const r of rows) { expect(r.f.view).toBeGreaterThanOrEqual(420); expect(r.f.view).toBeLessThanOrEqual(540) }
    const build = rows.flatMap(r => r.f.buildNotSlow.map(x => `seed ${r.seed} ${x}`)), close = rows.flatMap(r => r.f.closeFast.map(x => `seed ${r.seed} ${x}`))
    if (build.length) console.log(build.slice(0, 8).join('\n'))
    if (close.length) console.log(close.slice(0, 8).join('\n'))
    expect(build).toEqual([])
    expect(close).toEqual([])
  }, 300_000)

  // SMOOTH ON SCREEN (owner, 22 Nov 2026 22:13: "I believe we can get there with smoothness"): at 60 frames a
  // second on the phone pitch, every man moves at most MAN_PX and the ball BALL_PX between frames, a man's
  // movement never jumps from one frame to the next, and the speed is never stepped
  it('is smooth on screen at 60 frames a second over twenty fixtures', () => {
    const rows = all().map(r => ({ seed: r.seed, ...r.f.smooth }))
    const w = (k: 'manMax' | 'ballMax' | 'jerkP999' | 'jerkMax' | 'rateStep' | 'jitterPerMin') => Math.max(...rows.map(r => r[k]))
    console.log('simpitch smooth:', JSON.stringify({ manMax: w('manMax'), ballMax: w('ballMax'), jerkMax: w('jerkMax'), jerkP999: w('jerkP999'), rateStep: w('rateStep'), jitterPerMin: w('jitterPerMin') }))
    expect(w('manMax')).toBeLessThanOrEqual(MAN_PX + 0.05)
    expect(w('ballMax')).toBeLessThanOrEqual(BALL_PX + 0.05)
    // (a change of more than 2 px in a man's step from one frame to the next is a pop)
    expect(w('jerkP999')).toBeLessThanOrEqual(2)
    // (no frame more than an eighth quicker or slower than the one before)
    expect(w('rateStep')).toBeLessThanOrEqual(0.125)
  }, 300_000)
})
