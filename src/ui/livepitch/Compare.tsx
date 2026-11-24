// SIDE BY SIDE (round 5, lp-record.html?compare=1&rec=<seed>): a 1.9.16 highlight clip of a try above,
// the record's first try on the stadium pitch at normal speed below, both landing the ball at the same
// moment, so the lead can judge whether the pace and the feel match (owner, 24 Nov 2026).
//
// Both are driven from one clock that the recorder steps a sixtieth of a second at a time: the page's
// requestAnimationFrame and performance.now are replaced (installFakeClock) before anything mounts.
import { useEffect, useMemo, useRef } from 'react'
import { HighlightClip, buildClip, momentAt, clipTimeline, type ClipSpec } from '../HighlightClip'
import { newGame } from '../../game/newgame'
import { beginMatch, playHalf } from '../../game/matchEngine'
import { mulberry32 } from '../../game/rng'
import { LivePitch, type PitchSide } from './LivePitch'
import { CLIP_RATE, RecordFeed, schedule } from './fromRecord'
import type { Play } from '../../game/sim/record'

/** the page's clock, stepped by hand: window.__step(dt) moves it on and runs the frame callbacks */
export function installFakeClock() {
  let now = 0, id = 0
  let queue = new Map<number, FrameRequestCallback>()
  const w = window as unknown as Record<string, unknown>
  performance.now = () => now
  window.requestAnimationFrame = cb => { queue.set(++id, cb); return id }
  window.cancelAnimationFrame = h => { queue.delete(h) }
  w.__step = (dt: number) => { now += dt * 1000; const q = queue; queue = new Map(); for (const cb of q.values()) cb(now) }
}

/** the first try of an old-engine match, as Live.tsx would clip it on Key */
function oldTryClip(home: [string, string], away: [string, string]): ClipSpec {
  const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER', heldup: 'HELD UP' }
  for (let seed = 1; seed < 40; seed++) {
    const g = newGame('leicester', 'Compare', 5000 + seed)
    const fx = g.fixtures.find(f => f.week >= 2 + seed % 5 && g.clubs[f.homeId] && g.clubs[f.awayId])!
    const ctx = beginMatch(g, fx, mulberry32(700 + seed), true)
    playHalf(g, ctx); playHalf(g, ctx)
    const ev = ctx.events
    for (let i = 0; i < ev.length; i++) {
      if (momentAt(ev, i, fx.homeId, 'key') !== 'try') continue
      const spec = buildClip(ev, i, 'try', fx.homeId, () => undefined, { home, away }, labels, () => 'Name')
      if (spec.style === 'phases' || spec.style === 'overlap') return spec
    }
  }
  throw new Error('no try clip')
}

export function Compare({ plays, sides, ids, kits, names, homeSide, awaySide, teams, tr }: {
  plays: Play[]; sides: Parameters<typeof schedule>[1]; ids: [string, string]; kits: { home: [string, string]; away: [string, string] }
  names: (id: string) => string | undefined; homeSide: PitchSide; awaySide: PitchSide; teams: { home: string; away: string }
  tr: (k: string, v?: Record<string, string | number>) => string
}) {
  const spec = useMemo(() => oldTryClip(kits.home, kits.away), [kits])
  const feed = useMemo(() => new RecordFeed(plays, sides, ids, names), [plays, sides, ids, names])
  const t0 = useRef(0)
  useEffect(() => {
    const tl = clipTimeline(spec)
    // the clip's clock runs 1/0.9 of the viewer's on Normal: the ball is down at land * 0.9 viewing seconds
    const landView = tl.land / CLIP_RATE, endView = tl.end / CLIP_RATE
    const k = plays.findIndex(p => p.kind === 'try' || p.kind === 'penaltyTry')
    const sl = schedule(plays, sides)[k]
    const g = feed.bk.segs[k]
    // (our try is grounded at its mark: in viewing seconds from the slot's start, at clip pace)
    const ourLand = sl.start + (g.mark - g.a0) / CLIP_RATE
    t0.current = ourLand - landView
    feed.frozen = true
    feed.seek(t0.current)
    const w = window as unknown as Record<string, unknown>
    w.__cmp = { length: endView + 0.6, clipLand: landView, ourLand: ourLand - t0.current }
    w.__cmpT = (v: number) => { feed.seek(t0.current + v); feed.redraw(); (w.__step as (dt: number) => void)?.(1 / 60) }
  }, [spec, feed, plays, sides])
  const label: React.CSSProperties = { font: '800 12px system-ui, sans-serif', color: '#cfd6de', letterSpacing: '.5px', textTransform: 'uppercase', margin: '10px 12px 0' }
  return <div style={{ width: 390, height: 844, background: '#0b0f14', display: 'flex', flexDirection: 'column' }}>
    <div style={label}>1.9.16 highlight clip, Normal speed</div>
    <div><HighlightClip spec={spec} speed={0.9} onReveal={() => {}} onDone={() => {}} /></div>
    <div style={label}>2.0.0 pitch, normal speed (CLIP_RATE {CLIP_RATE.toFixed(3)}x life)</div>
    <div style={{ display: 'flex', flexDirection: 'column', height: 300, margin: '8px 0 0' }}>
      <LivePitch feed={feed} events={[]} cursor={0} homeId={ids[0]} speed={1} home={homeSide} away={awaySide}
        night={false} tr={tr} teams={teams} names={id => names(String(id))} />
    </div>
  </div>
}
