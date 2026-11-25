// THE LIVE MATCH STREAM (round 8): the new engine stepped a passage at a time, the pitch baked as it goes,
// the screen's clock on top. Continuity across every join and after a decision, and nothing already
// baked ever baked again.
import { describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import type { Fixture } from '../src/game/model'
import { FPS } from '../src/ui/livepitch/fromRecord'
import { fromSim2, standInSession, StreamFeed } from '../src/ui/livepitch/stream'
import { sim2Seed, startSim2 } from '../src/game/sim/toResult'

function setup(seed: number) {
  const g = newGame('leicester', 'T', seed)
  let fx: Fixture | null | undefined = null
  for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
  const session = standInSession(g, fx!, seed)
  return { g, fx: fx!, session, feed: new StreamFeed(session, [fx!.homeId, fx!.awayId]) }
}

/** the frame checks the whole-match bake has (simpitch.test.ts), over a streamed bake */
function jumps(feed: StreamFeed) {
  const bk = feed.baker.live(), cuts = new Set(bk.cuts)
  let man = 0, ball = 0, gap = 0
  for (let f = 1; f < bk.n; f++) {
    if (cuts.has(f)) continue
    for (let i = 0; i < 30; i++) man = Math.max(man, Math.hypot(bk.pos[f * 62 + i * 2] - bk.pos[(f - 1) * 62 + i * 2], bk.pos[f * 62 + i * 2 + 1] - bk.pos[(f - 1) * 62 + i * 2 + 1]) * FPS)
    ball = Math.max(ball, Math.hypot(bk.ball[f * 3] - bk.ball[(f - 1) * 3], bk.ball[f * 3 + 1] - bk.ball[(f - 1) * 3 + 1]) * FPS)
    const h = bk.holder[f]
    if (h >= 0) gap = Math.max(gap, Math.hypot(bk.pos[f * 62 + h * 2] - bk.ball[f * 3], bk.pos[f * 62 + h * 2 + 1] - bk.ball[f * 3 + 1]))
  }
  return { man, ball, gap }
}

/** play the stream as the screen would, answering each stop the way `on` says */
function watch(feed: StreamFeed, on: { pen?: () => void; ht?: () => void; at?: (feed: StreamFeed) => void } = {}) {
  let rateStep = 0, prev = -1
  for (let k = 0; k < 400000 && !feed.done; k++) {
    feed.pump(50)
    feed.step(1 / 60)
    on.at?.(feed)
    const fa = Math.floor(feed.a * FPS), r = feed.clock.rate[fa]
    if (prev > 0 && r > 0 && !feed.starved) rateStep = Math.max(rateStep, Math.abs(Math.log(r / prev)))
    if (r > 0) prev = r
    const w = feed.waiting
    if (w === 'penalty') { (on.pen ?? (() => feed.session.answer(null)))(); feed.baker.more() }
    if (w === 'halfTime') { on.ht?.(); feed.releaseHalfTime() }
    if (w === 'injury') { const inj = feed.session.pendingInjury!; feed.session.cover(inj.like); feed.baker.more() }
  }
  return { rateStep }
}

describe('the live match stream', () => {
  it('plays a whole managed match to the whistle, continuous across every join, eased between speeds', () => {
    const { feed, session } = setup(4242)
    const { rateStep } = watch(feed)
    expect(session.done).toBe(true)
    const j = jumps(feed)
    console.log('simstream joins:', JSON.stringify({ plays: session.plays.length, frames: feed.baker.frames, ...j, rateStep: +rateStep.toFixed(3) }))
    expect(j.man).toBeLessThanOrEqual(10.5)
    expect(j.ball).toBeLessThanOrEqual(40)
    expect(j.gap).toBeLessThanOrEqual(1.5)
    expect(rateStep).toBeLessThanOrEqual(0.125)
  }, 300_000)

  it('takes a decision mid-match at the next dead ball, and never re-bakes what was baked', () => {
    const { feed, session } = setup(1)
    const side = session.managed ?? 0
    let made = false, before: Float32Array | null = null, framesAt = 0, playsAt = 0
    watch(feed, {
      at: f => {
        if (made || f.a < 600) return
        made = true
        const lu = session.lineup(side)!
        const on = lu.bench.find(Boolean)!, off = lu.field[7]
        before = f.baker.live().pos.slice(); framesAt = f.baker.frames; playsAt = session.plays.length
        session.apply({ kind: 'substitution', side, off, on })
        session.apply({ kind: 'tactics', side, set: { tempo: 80 } })
      },
    })
    expect(made).toBe(true)
    // the frames baked before the decision are exactly as they were
    const after = feed.baker.live().pos
    let same = true
    for (let i = 0; i < framesAt * 62; i++) if (after[i] !== before![i]) { same = false; break }
    expect(same).toBe(true)
    // the change is made, at a dead ball after the moment it was asked for
    const sub = session.plays.findIndex((p, k) => k >= playsAt && p.kind === 'substitution' && p.side === side)
    expect(sub).toBeGreaterThanOrEqual(playsAt)
    expect(session.plays[sub].result).toBe('made')
    const j = jumps(feed)
    expect(j.man).toBeLessThanOrEqual(10.5)
    expect(j.gap).toBeLessThanOrEqual(1.5)
  }, 300_000)

  it("plays GAMEPLAY's real session (store kickOff's startSim2) through the screen's adapter to the game's full time", () => {
    const g = newGame('leicester', 'T', 7)
    let fx: Fixture | null | undefined = null
    for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
    const s2 = startSim2(g, fx!, sim2Seed(g, fx!), { userSideId: g.userClubId, preTalk: null })
    const session = fromSim2(s2, g)
    // the kick-off sides, named, in shirt order
    for (const sd of session.sides) { expect(sd.players.length).toBeGreaterThanOrEqual(15); expect(sd.players.every(p => p.name)).toBe(true) }
    const feed = new StreamFeed(session, [fx!.homeId, fx!.awayId])
    const me = session.managed!
    expect(me === 0 || me === 1).toBe(true)
    let subs = 0, talked = ''
    const { rateStep } = watch(feed, {
      at: f => {
        if (subs >= 2 || f.a < 900 + subs * 300 || session.pending || session.pendingInjury) return
        const lu = session.lineup(me)!
        const on = lu.bench.find(Boolean), off = lu.field[subs === 0 ? 0 : 9]
        if (on && off) { session.apply({ kind: 'substitution', side: me, off, on }); f.baker.more() }
        subs++
      },
      ht: () => { talked = s2.apply({ kind: 'talk', side: me, tone: 'calm' as never }) },
    })
    expect(session.done).toBe(true)
    const made = session.plays.filter(p => p.kind === 'substitution' && p.side === me && p.result === 'made' && !p.cause).length
    const j = jumps(feed)
    console.log('simstream real session:', JSON.stringify({ plays: session.plays.length, made, talked: !!talked, ...j, rateStep: +rateStep.toFixed(3) }))
    expect(made).toBeGreaterThanOrEqual(1)
    expect(j.man).toBeLessThanOrEqual(10.5)
    expect(j.gap).toBeLessThanOrEqual(1.5)
    expect(rateStep).toBeLessThanOrEqual(0.125)
    // the game's own full time, on the record watched
    const score = session.result().score
    s2.finish()
    expect(s2.ctx.seg).toBe(3)
    expect([s2.ctx.home.score, s2.ctx.away.score]).toEqual(score)
  }, 300_000)
})
