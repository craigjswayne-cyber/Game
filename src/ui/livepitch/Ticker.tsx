// THE COMMENTARY TICKER (2.0.0 round 5, owner 24 Nov 2026: "a lot faster paced, a bit like the old
// Football Manager, where it's flicking through and then it flashes when there's a key [moment], a try or
// a penalty goal").
//
// A short stack: the line now and two older ones. Each line comes in at the viewing second the
// commentary's feed() gives it (never before its play is on the pitch, never after the next play has
// started) and flicks in from below: quickly in fast forward, at the clips' pace at normal speed. A try,
// a kick at goal that goes over, a drop goal and a card flash the whole bar: the scoring side's colour,
// or yellow or red with the card drawn, and hold long enough to read.
//
// Everything that moves is set from the feed's clock in the frame loop, straight on the elements, so the
// recorder (which freezes CSS animation) sees exactly what a player sees, and React only renders when a
// new line arrives: the canvas never waits on it.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { RecordFeed } from './fromRecord'
import './ticker.css'

export interface TickLine {
  n: number
  text: string
  /** viewing seconds the line comes in at, and how long it is the line now */
  at: number
  hold: number
  /** a line that flashes the bar */
  flash: 'try' | 'goal' | 'card' | 'key' | null
  /** whose moment: the bar takes their colour */
  side: 0 | 1 | null
  /** yellow or red, for a card */
  card?: 'y' | 'r'
  minute: number
}

const ROWS = 3
/** a row's height and gap: the stack moves up by this as a line comes in */
const STEP_PX = 34
/** the flick in, in viewing seconds: quick in fast forward, the clips' pace at normal speed */
const FLICK_FF = 0.12, FLICK_1X = 0.26
/** how long a flash holds at full strength (viewing seconds) */
const FLASH_S = 2

export function Ticker({ lines, feed, kits }: { lines: TickLine[]; feed: RecordFeed; kits: { home: [string, string]; away: [string, string] } }) {
  // the newest line in at the clock now (its index), kept in state so the rows render when it changes
  const [cur, setCur] = useState(-1)
  const curRef = useRef(-1)
  const rowEls = useRef<(HTMLDivElement | null)[]>([])
  const bar = useRef<HTMLDivElement>(null)
  const flashEl = useRef<HTMLDivElement>(null)
  const sorted = useMemo(() => [...lines].sort((a, b) => a.at - b.at), [lines])
  const flashFor = useRef(-1), flashAt = useRef(Infinity)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const v = feed.view
      // the newest line whose time has come (lines are in time order: walk on or back from the last)
      let i = curRef.current
      while (i + 1 < sorted.length && sorted[i + 1].at <= v) i++
      while (i >= 0 && sorted[i].at > v) i--
      if (i !== curRef.current) { curRef.current = i; setCur(i) }
      // the flick of the line now, and the flash
      const L = i >= 0 ? sorted[i] : null
      const age = L ? v - L.at : Infinity
      const dur = feed.speed >= 1.5 && !feed.buildUp ? FLICK_FF : FLICK_1X
      const k = Math.min(1, Math.max(0, age / dur)), e = 1 - (1 - k) * (1 - k) * (1 - k)
      const r0 = rowEls.current[0]
      const dy = ((1 - e) * STEP_PX).toFixed(1)
      if (r0) { r0.style.transform = `translateY(${dy}px)`; r0.style.opacity = (0.2 + 0.8 * e).toFixed(3) }
      for (let j = 1; j < ROWS; j++) { const r = rowEls.current[j]; if (r) r.style.transform = `translateY(${dy}px)` }
      // A STALE LINE (round 6): once the pitch has moved on past its play it dims at once, in fast forward
      // as at normal speed, so a line is never read as describing a play it is not
      const stale = L && (feed.n > L.n + 1 || (feed.n > L.n && (age > Math.min(L.hold, 1.2) || feed.ff)))
      if (r0) { r0.classList.toggle('stale', !!stale); if (stale && e >= 1) r0.style.opacity = '0.6' }
      // THE FLASH starts when the score lands on the pitch (the scoreboard ticks over on the same frame):
      // a sweep of the side's colour across the bar, held about two seconds, then eased off
      const fl = flashEl.current, b = bar.current
      if (fl && b) {
        if (L && L.flash && L.flash !== 'key' && flashFor.current !== i && (feed.n > L.n || (feed.n === L.n && feed.landed))) { flashFor.current = i; flashAt.current = v }
        if (flashAt.current > v) { flashFor.current = -1; flashAt.current = Infinity }
        const fa = flashFor.current === i ? v - flashAt.current : Infinity
        const on = fa < Infinity ? clampN(1 - (fa - FLASH_S) / 0.35, 0, 1) : 0
        const sweep = clampN(fa / 0.3, 0, 1), se = 1 - (1 - sweep) * (1 - sweep)
        fl.style.opacity = on.toFixed(3)
        fl.style.clipPath = `inset(0 ${((1 - se) * 100).toFixed(1)}% 0 0)`
        b.classList.toggle('flashing', on > 0.5)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [feed, sorted])

  const now = cur >= 0 ? sorted[cur] : null
  const rows = Array.from({ length: ROWS }, (_, j) => (cur - j >= 0 ? sorted[cur - j] : null))
  const kit = (side: 0 | 1 | null) => (side === 1 ? kits.away : kits.home)
  const flashBg = now?.flash === 'card' ? (now.card === 'r' ? '#c8102e' : '#f2c200') : now ? kit(now.side)[0] : 'transparent'
  const flashInk = now?.flash === 'card' && now.card !== 'r' ? '#111' : inkOn(flashBg)
  return <div className="lp-ticker" ref={bar} data-testid="lp-ticker">
    <div className="lp-tick-flash" ref={flashEl} style={{ background: flashBg, color: flashInk, opacity: 0 }}>
      {now?.flash === 'card' && <i className={`lp-tick-card ${now.card === 'r' ? 'r' : 'y'}`} />}
      <b>{now?.flash === 'try' ? 'TRY' : now?.flash === 'goal' ? 'GOAL' : now?.flash === 'card' ? (now.card === 'r' ? 'RED CARD' : 'YELLOW CARD') : ''}</b>
      <span>{now?.text}</span>
    </div>
    {rows.map((l, j) => <div key={j} ref={el => { rowEls.current[j] = el }} data-k={l ? `${l.n}:${l.at.toFixed(2)}` : ''}
      className={`lp-tick-row r${j}${l?.flash ? ' big' : ''}`} style={l && l.side != null ? { borderLeftColor: kit(l.side)[0] } : undefined}>
      {l && <><span className="min">{l.minute}'</span><span className="txt">{l.text}</span></>}
    </div>)}
  </div>
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
function inkOn(bg: string): string {
  const h = bg.replace('#', '')
  if (h.length < 6) return '#fff'
  const y = (parseInt(h.slice(0, 2), 16) * 299 + parseInt(h.slice(2, 4), 16) * 587 + parseInt(h.slice(4, 6), 16) * 114) / 1000
  return y > 150 ? '#111' : '#fff'
}
