import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MOVE_BY_ID } from '../game/moves'
import { FLIGHT, TRACKS, trackAt, type K } from './clipPlays'
import { MoveDiagram } from './tacticsArt'

/**
 * A MOVE, PLAYED ON A LOOP (1.8.2, owner: "Playbook - needs GIF/animated
 * previews of the moves when selected").
 *
 * The runs and passes are the highlight clip's own (clipPlays.ts TRACKS), so
 * what the preview shows is what the match clip plays, drawn from above with
 * the attack going up the screen: each man along his keyframed line, the ball
 * with its holder or in the air between two of them, and the man the move is
 * built to put through running on once he has it. A faint line of theirs
 * stands off the gain line for scale, and nothing more is modelled.
 *
 * It is a picture only. Time is the wall clock from the moment it mounted,
 * nothing here draws on the game's dice, and it reads no state but the id.
 * It stops when it is off the screen or unmounted, and under
 * prefers-reduced-motion it is the whiteboard diagram instead.
 */

type Pt = [number, number]

/** how long the finisher runs on after the break, and the holds either side */
const RUN_FOR = 1.3
const LEAD = 0.5
const TAIL = 1.2

interface Plan {
  roles: string[]
  at: (role: string, t: number) => Pt
  ball: (t: number) => { p: Pt; air: number }
  them: (t: number) => Pt[]
  finisher: string
  T: number
  view: [number, number, number, number]
  trails: { role: string; d: string }[]
  /** every pass as the loop draws it: who to whom, and where the ball
   *  leaves the passer's hands and reaches the catcher's (x up the field) */
  passes: { from: string; to: string; t0: number; t1: number; p0: Pt; p1: Pt }[]
}

/** everything the loop needs, worked out once per move: no draws, no clock */
export function planFor(id: string): Plan | null {
  const tr = TRACKS[id]?.[0]
  const mv = MOVE_BY_ID[id]
  if (!tr || !mv) return null
  const runs: Record<string, K[]> = { ...tr.runs }
  const first = tr.first ?? '9'
  if (!runs[first]) runs[first] = [[0, 0, 0]]
  const roles = Object.keys(runs)
  const tEnd = (r: string) => runs[r][runs[r].length - 1][0]
  const base = (r: string, t: number): Pt => trackAt(runs[r], t)

  const events = [...tr.ball].sort((a, b) => a[0] - b[0])
  const finisher = mv.kick ? (tr.chase ?? tr.strike) : tr.strike
  // the kick: off the last man to have it, when his run is done
  const kicker = events.length ? events[events.length - 1][1] : first
  const kickAt = mv.kick ? Math.max((events.length ? events[events.length - 1][0] : 0) + 0.35, tEnd(kicker)) : Infinity
  const kickFor = mv.kick === 'cross' ? 1.1 : 0.9
  // when the finisher has it: the last pass to him lands, or the kick comes down
  const lastTo = [...events].reverse().find(e => e[1] === finisher)
  const gets = mv.kick ? kickAt + kickFor : lastTo ? lastTo[0] + FLIGHT[lastTo[2] ?? 'pass'] : 0
  // he runs on at the pace of his last stride, straight up the field
  const fk = runs[finisher] ?? [[0, 0, 0]]
  const [a, b] = fk.length > 1 ? [fk[fk.length - 2], fk[fk.length - 1]] : [fk[0], fk[0]]
  const pace = Math.min(8, Math.max(2, Math.hypot(b[1] - a[1], b[2] - a[2]) / Math.max(0.05, b[0] - a[0])))
  const onFrom = mv.kick ? tEnd(finisher) : Math.max(tEnd(finisher), gets)
  const T = Math.max(onFrom, gets) + RUN_FOR

  const at = (r: string, t: number): Pt => {
    if (r === finisher && t > onFrom) {
      const [x, y] = base(r, onFrom)
      return [x + pace * Math.min(t - onFrom, T - onFrom), y]
    }
    return base(r, t)
  }
  const lerp = (p: Pt, q: Pt, u: number): Pt => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]
  const ball = (t: number): { p: Pt; air: number } => {
    let holder = first
    for (const [rel, to, kind] of events) {
      if (t < rel) break
      const dur = FLIGHT[kind ?? 'pass']
      if (t < rel + dur) return { p: lerp(at(holder, rel), at(to, rel + dur), (t - rel) / dur), air: 0 }
      holder = to
    }
    if (t >= kickAt) {
      if (t < kickAt + kickFor) {
        const u = (t - kickAt) / kickFor
        return { p: lerp(at(kicker, kickAt), at(finisher, kickAt + kickFor), u), air: mv.kick === 'cross' ? Math.sin(Math.PI * u) : 0 }
      }
      holder = finisher
    }
    const [x, y] = at(holder, t)
    return { p: [x + 0.7, y + 0.5], air: 0 }
  }

  // THEIRS: one man off each of ours (one per three metres across), standing
  // off the gain line and coming up for a second or so; a full-back
  // behind, away from the line
  const off = tr.set === 'ruck' ? 3 : tr.set === 'scrum' ? 5 : mv.red ? 4 : 8
  const ys: number[] = []
  for (const r of roles) {
    if (r === first) continue
    const y = runs[r][0][2] + 1.2
    if (ys.every(v => Math.abs(v - y) > 3)) ys.push(y)
  }
  const midY = ys.length ? ys.reduce((s, v) => s + v, 0) / ys.length : 0
  const them = (t: number): Pt[] => {
    const up = 2 * Math.min(Math.max(t, 0), 1.2)
    const line: Pt[] = ys.map(y => [off - up, y])
    if (!mv.red) line.push([off + 14 - up * 0.5, midY])
    return line
  }

  // the frame: everything that is ever on it, with a margin, at 16:9
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const take = ([x, y]: Pt) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  for (let t = 0; t <= T + 1e-6; t += 0.1) {
    for (const r of roles) take(at(r, t))
    take(ball(t).p)
    for (const p of them(t)) take(p)
  }
  const pad = 4
  // screen x is across the field (y), screen y is up the field (-x)
  let w = y1 - y0 + pad * 2, h = x1 - x0 + pad * 2
  const cx = (y0 + y1) / 2, cy = -(x0 + x1) / 2
  if (w / h < 16 / 9) w = h * 16 / 9; else h = w * 9 / 16
  const view: [number, number, number, number] = [cx - w / 2, cy - h / 2, w, h]

  const trails = roles.filter(r => r !== first || runs[r].length > 1).map(r => {
    const pts: string[] = []
    const stop = r === finisher ? T : tEnd(r)
    for (let t = 0; t <= stop + 1e-6; t += 0.1) { const [x, y] = at(r, t); pts.push(`${y.toFixed(2)},${(-x).toFixed(2)}`) }
    return { role: r, d: `M${pts.join(' L')}` }
  })

  const passes: Plan['passes'] = []
  let had = first
  for (const [rel, to, kind] of events) {
    const t1 = rel + FLIGHT[kind ?? 'pass']
    passes.push({ from: had, to, t0: rel, t1, p0: at(had, rel), p1: at(to, t1) })
    had = to
  }

  return { roles, at, ball, them, finisher, T, view, trails, passes }
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const st = (fill: string, stroke: string, w: number): CSSProperties => ({ fill, stroke, strokeWidth: w })

export default function MovePreview({ id }: { id: string }) {
  const plan = useMemo(() => planFor(id), [id])
  const [reduce, setReduce] = useState(reducedMotion)
  const [t, setT] = useState(0)
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduce(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])

  // the loop: runs only while the picture is on the screen
  useEffect(() => {
    if (!plan || reduce) return
    const period = LEAD + plan.T + TAIL
    let raf = 0, visible = true, start = performance.now()
    const frame = (now: number) => {
      const ph = ((now - start) / 1000) % period
      setT(Math.min(plan.T, Math.max(0, ph - LEAD)))
      raf = requestAnimationFrame(frame)
    }
    const go = () => { if (!raf && visible) { start = performance.now(); raf = requestAnimationFrame(frame) } }
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0 }
    setT(0)
    go()
    const el = ref.current
    const io = el && typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(es => { visible = es.some(e => e.isIntersecting); if (visible) go(); else stop() })
      : null
    if (io && el) io.observe(el)
    return () => { stop(); io?.disconnect() }
  }, [plan, reduce])

  if (!plan || reduce) return <MoveDiagram id={id} />

  const [vx, vy, vw, vh] = plan.view
  const b = plan.ball(t)
  // sizes in hundredths of the frame's width, so a man is the same size on
  // the screen in a wide move and in a tight red-zone one
  const u = vw / 100
  const stripes: number[] = []
  for (let y = Math.floor(vy / 5) * 5; y < vy + vh; y += 5) stripes.push(y)
  return (
    <svg ref={ref} className="dg mv-anim" viewBox={`${vx} ${vy} ${vw} ${vh}`} aria-hidden="true" focusable="false"
      data-preview={id} data-t={t.toFixed(1)}>
      {stripes.map(y => (
        <rect key={y} x={vx} y={y} width={vw} height={5.05} style={{ fill: Math.round(y / 5) % 2 ? 'var(--hl-grass-b)' : 'var(--hl-grass-a)' }} />
      ))}
      {/* the gain line */}
      <line x1={vx} y1={0} x2={vx + vw} y2={0} style={{ stroke: 'var(--dg-chalk-soft)', strokeWidth: 0.35 * u, strokeDasharray: `${1.6 * u} ${1.6 * u}` }} />
      {plan.trails.map(({ role, d }) => (
        <path key={role} d={d} style={{
          fill: 'none', stroke: 'var(--dg-move)', strokeLinecap: 'round', strokeLinejoin: 'round',
          strokeWidth: (role === plan.finisher ? 0.8 : 0.4) * u, opacity: role === plan.finisher ? 0.75 : 0.35,
        }} />
      ))}
      {plan.them(t).map(([x, y], i) => <circle key={i} cx={y} cy={-x} r={2 * u} style={st('var(--dg-them)', 'var(--dg-them-edge)', 0.35 * u)} />)}
      {plan.roles.map(r => {
        const [x, y] = plan.at(r, t)
        return <g key={r}>
          <circle cx={y} cy={-x} r={2 * u} style={st('var(--dg-us)', 'var(--dg-us-edge)', 0.35 * u)} />
          {r === plan.finisher && <circle cx={y} cy={-x} r={3.3 * u} style={{ fill: 'none', stroke: 'var(--dg-move)', strokeWidth: 0.6 * u }} />}
        </g>
      })}
      <ellipse cx={b.p[1]} cy={-b.p[0]} rx={1.3 * u * (1 + b.air * 0.8)} ry={0.85 * u * (1 + b.air * 0.8)}
        style={st('var(--hl-ball)', 'var(--hl-ball-edge)', 0.3 * u)} />
    </svg>
  )
}
