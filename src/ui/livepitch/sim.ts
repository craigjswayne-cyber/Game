// The live pitch's legs (2.0.0, second pass).
//
// Owner, 16 Nov 2026, on the first pass: "The animation is incredibly jumpy,
// what i like about the example videos is how smooth the action feels." The
// first pass slid thirty men to a new shape once a line. This plays each line
// as a few seconds of real time instead: every man is a body with a top speed
// and an acceleration, steered towards his place, and the ball is passed,
// carried, kicked and put down by them. Nobody can move faster than a player
// runs, so the picture is smooth by construction (the highlight clips' rule,
// highlight/bake.ts).
//
// When the match itself jumps (four minutes on, thirty metres away) the
// picture CUTS, a short dip like a broadcast, with everybody already set. It
// never slides across the gap.
//
// Reads phases only; no rng, nothing written back.

import type { Phase, PhaseKind } from './phase'
import { shapeOf, type Pt } from './shapes'

export interface Body { x: number; y: number; vx: number; vy: number }

type Step =
  | { k: 'wait'; t: number }
  /** the man goes to the ball and picks it up */
  | { k: 'pick'; who: number }
  | { k: 'pass'; to: number; hang?: number }
  /** the anchor (and the man with the ball) moves to a point at v m/s */
  | { k: 'run'; to: Pt; v: number }
  | { k: 'kick'; to: Pt; hang: number }
  /** the ball goes to ground at the anchor */
  | { k: 'ground' }
  | { k: 'mode'; mode: PhaseKind; cIdx?: number | null; anchorOn?: number; clear?: boolean }

const V_FWD = 6.3, V_BACK = 8.2, ACC = 15, V_PASS = 17
/** off the ball a man jogs into shape; only the action, and a man a long
 *  way out of place, runs flat out (the reference clips' calm) */
const JOG_FWD = 3.9, JOG_BACK = 4.8
const hyp = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** a fixed offset per man, so a line is never a ruler and never reshuffles */
function jit(i: number, salt: number): number {
  let h = ((i + 1) * 374761393 + salt * 668265263) >>> 0
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0
  return ((h % 1000) / 1000 - 0.5)
}

export class PitchSim {
  b: Body[] = []
  ref: Body = { x: 50, y: 30, vx: 0, vy: 0 }
  ball = { x: 50, y: 35, lift: 0 }
  /** who has the ball: 0-14 home, 15-29 away, -1 nobody */
  holder = -1
  /** counts the cuts, so the screen can dissolve across each one */
  cuts = 0
  fade = 0
  /** the line's play has been acted out */
  done = true
  phase: Phase | null = null
  /** the moment the line is about has happened: the ball is down, the kick
   *  is over or wide. The banner waits for it. */
  landed = true

  private anchor: Pt = { x: 50, y: 35 }
  private mode: PhaseKind = 'break'
  private cIdx: number | null = null
  private steps: Step[] = []
  private si = 0
  private st = 0
  private entered = false
  private grounded = false
  private over = new Map<number, Pt>()
  /** seconds each man is still on the ground for (a tackle: the carrier and
   *  the man who brought him down) */
  down = new Float32Array(30)
  private flight: { from: Pt; to: Pt; toIdx: number; T: number; t: number; hang: number } | null = null
  private cut: { t: number; apply: () => void } | null = null
  private started = false

  constructor() {
    for (let i = 0; i < 30; i++) this.b.push({ x: 50 + (i < 15 ? -8 : 8), y: 6 + (i % 15) * 4, vx: 0, vy: 0 })
  }

  /** the next line's play: plan it from where everything is now */
  start(p: Phase, carrierIdx: number | null) {
    const att0 = p.homeBall ? 0 : 15
    const dir = p.homeBall ? 1 : -1
    const E: Pt = { x: p.x, y: p.y }
    const B: Pt = { x: this.ball.x, y: this.ball.y }
    const d = hyp(E, B)
    const holderAtt = this.holder >= 0 && (this.holder < 15) === p.homeBall
    const steps: Step[] = []
    let cut = !this.started
    let mode: PhaseKind = p.kind, anchor: Pt = E, cIdx: number | null = carrierIdx
    /** set by a cut: who starts with the ball (-1: on the ground at the anchor) */
    let init = -1
    const need9 = () => { if (!holderAtt) steps.push({ k: 'pick', who: att0 + 8 }) }
    const open = (y: number) => (y < 35 ? 1 : -1)

    switch (p.kind) {
      case 'kickoff': case 'dropout':
        cut = true; init = att0 + 9; cIdx = null
        steps.push({ k: 'wait', t: 1.3 }, { k: 'kick', to: p.to ?? E, hang: p.hang ?? 14 }, { k: 'wait', t: 0.5 })
        break
      case 'con': case 'goal':
        cut = true; cIdx = carrierIdx ?? 9; init = att0 + cIdx
        steps.push({ k: 'wait', t: 1.5 }, { k: 'kick', to: p.to ?? E, hang: p.hang ?? 9 }, { k: 'wait', t: 1.1 })
        break
      case 'break':
        cut = true; steps.push({ k: 'wait', t: 2 })
        break
      case 'scrum':
        cut = cut || d > 10
        steps.push({ k: 'ground' }, { k: 'wait', t: cut ? 1.3 : 2.8 }, { k: 'run', to: { x: E.x + dir * 2.5, y: E.y }, v: 0.9 },
          { k: 'pick', who: att0 + 8 }, { k: 'wait', t: 0.3 })
        break
      case 'lineout':
        cut = cut || d > 10; init = att0 + 1
        if (!cut) steps.push({ k: 'pick', who: att0 + 1 })
        steps.push({ k: 'wait', t: cut ? 1.3 : 2.4 }, { k: 'pass', to: att0 + 3, hang: 4 }, { k: 'wait', t: 0.5 },
          { k: 'pass', to: att0 + 8 }, { k: 'wait', t: 0.3 })
        break
      case 'maul': {
        // a maul creeps: it is set where it is, it does not walk the field
        cut = cut || d > 6; init = att0 + 7
        anchor = cut ? { x: E.x - dir * 3, y: E.y } : B
        if (!cut && this.holder !== att0 + 7) steps.push({ k: 'pick', who: att0 + 7 })
        const to = hyp(anchor, E) > 1 ? E : { x: E.x + dir * 2.5, y: E.y }
        steps.push({ k: 'wait', t: 0.8 }, { k: 'run', to, v: 1.1 }, { k: 'wait', t: 0.5 })
        break
      }
      case 'ruck':
        cut = cut || d > 16
        if (cut) steps.push({ k: 'ground' }, { k: 'wait', t: 1.8 })
        else if (holderAtt) {
          // he carries it into contact, then it is a ruck
          mode = 'carry'; cIdx = this.holder - att0; anchor = B
          steps.push({ k: 'run', to: E, v: 6 }, { k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: 1.6 })
        } else {
          anchor = B
          steps.push({ k: 'ground' }, { k: 'run', to: E, v: 5 }, { k: 'wait', t: 1.6 })
        }
        break
      case 'penalty':
        cut = cut || d > 16; cIdx = null; init = att0 + 8
        if (!cut && !holderAtt) steps.push({ k: 'pick', who: att0 + 8 })
        steps.push({ k: 'wait', t: 2.2 })
        break
      case 'catch': {
        const c = carrierIdx ?? 14
        cut = cut || d > 16; cIdx = c; init = att0 + c
        if (!cut) steps.push({ k: 'pick', who: att0 + c })
        steps.push({ k: 'run', to: { x: clamp(E.x + dir * 4, 1, 99), y: E.y }, v: 6 })
        break
      }
      case 'kick': {
        const k = carrierIdx ?? 9
        cut = cut || d > 16
        if (cut) { mode = 'carry'; cIdx = k; init = att0 + k; steps.push({ k: 'wait', t: 0.8 }) }
        else {
          mode = this.mode; cIdx = this.cIdx; anchor = this.anchor
          if (this.holder !== att0 + k) {
            need9()
            this.over.set(att0 + k, { x: B.x - dir * 8, y: clamp(B.y + open(B.y) * 4, 3, 67) })
            steps.push({ k: 'wait', t: 0.4 }, { k: 'pass', to: att0 + k })
          }
          steps.push({ k: 'wait', t: 0.3 })
        }
        steps.push({ k: 'mode', mode: 'kick', anchorOn: att0 + k, clear: true },
          { k: 'kick', to: p.to ?? { x: E.x + dir * 30, y: E.y }, hang: p.hang ?? 12 }, { k: 'wait', t: 0.4 })
        break
      }
      case 'carry': case 'try': case 'heldup': {
        const c = carrierIdx ?? (p.kind === 'carry' ? 11 : 13)
        const scoring = p.kind !== 'carry'
        const v = p.kind === 'try' ? 8.6 : c < 8 ? 6.3 : 8
        // A GAP IN THE SAME ATTACK IS A BREAK, NOT A CUT: when the side that
        // had the ball still has it and the line is further up the field, the
        // man runs there. A long-range try is the run it was.
        const sameSide = this.phase != null && this.phase.homeBall === p.homeBall
        const gain = (E.x - B.x) * dir
        // a try from long range is the last forty metres of it; a held-up
        // drive is from close in
        const reach = p.kind === 'try' ? 42 : p.kind === 'heldup' ? 14 : 38
        cut = cut || (d > 16 && !(sameSide && gain > 0 && d <= reach))
        if (cut) {
          mode = 'carry'; cIdx = c; init = att0 + c
          anchor = { x: E.x - dir * (p.kind === 'try' ? (d > 42 ? 38 : 14) : p.kind === 'heldup' ? 7 : 6), y: E.y }
        } else if (this.holder === att0 + c) {
          mode = 'carry'; cIdx = c; anchor = B
        } else {
          // out from the ruck: to the fly-half first when it is going wide
          mode = this.mode; cIdx = this.cIdx; anchor = this.anchor
          need9()
          // where he takes the pass: just behind the ruck when he is close;
          // where he already is when he is a long way out (a wing does not
          // run thirty metres infield to be handed it, the ball goes to him)
          const me = this.b[att0 + c]
          const dy = E.y - B.y
          const sy = Math.abs(dy) < 4 ? open(B.y) * 5 : clamp(dy, -15, 15)
          const out = hyp(me, B) > 14
          const S: Pt = out
            ? { x: dir > 0 ? Math.min(me.x, B.x - 3) : Math.max(me.x, B.x + 3), y: me.y }
            : { x: B.x - dir * 6, y: clamp(B.y + sy, 3, 67) }
          const wide = S.y - B.y
          if (Math.abs(wide) > 14 && c !== 9 && c !== 8) {
            this.over.set(att0 + 9, { x: B.x - dir * 4.5, y: clamp(B.y + Math.sign(wide) * 6, 3, 67) })
            steps.push({ k: 'wait', t: 0.35 }, { k: 'pass', to: att0 + 9 })
          }
          if (c !== 8) {
            this.over.set(att0 + c, S)
            steps.push({ k: 'wait', t: 0.35 }, { k: 'pass', to: att0 + c })
          }
          steps.push({ k: 'mode', mode: 'carry', cIdx: c, anchorOn: att0 + c, clear: true })
        }
        steps.push({ k: 'run', to: E, v })
        if (scoring) steps.push({ k: 'mode', mode: p.kind }, { k: 'wait', t: p.kind === 'try' ? 2.4 : 1.6 })
        else steps.push({ k: 'wait', t: 0.2 })
        break
      }
      default:
        steps.push({ k: 'wait', t: 1 })
    }

    const begin = () => {
      this.landed = !(p.kind === 'try' || p.kind === 'heldup' || p.kind === 'con' || p.kind === 'goal')
      this.phase = p; this.steps = steps; this.si = 0; this.st = 0; this.entered = false; this.done = false
      this.mode = mode; this.anchor = { ...anchor }; this.cIdx = cIdx
    }
    if (cut) {
      this.over.clear()
      this.done = false
      this.cut = { t: 0, apply: () => {
        begin()
        this.cuts++
        this.flight = null; this.holder = init; this.grounded = init < 0
        this.down.fill(0)
        const T = this.targets()
        for (let i = 0; i < 30; i++) { this.b[i].x = T.pts[i].x; this.b[i].y = T.pts[i].y; this.b[i].vx = this.b[i].vy = 0 }
        this.ref.x = T.ref.x; this.ref.y = T.ref.y
        const at = init >= 0 ? this.b[init] : this.anchor
        this.ball.x = at.x; this.ball.y = at.y; this.ball.lift = 0
        this.fade = 1
      } }
      this.started = true
    } else begin()
  }

  /** the lines being run on to the ball right now: who, and to where */
  runs(): { i: number; to: Pt }[] {
    const out: { i: number; to: Pt }[] = []
    for (const [i, to] of this.over) if (i !== this.holder && Math.hypot(this.b[i].x - to.x, this.b[i].y - to.y) > 2) out.push({ i, to })
    return out
  }

  private targets(): { pts: Pt[]; ref: Pt } {
    const p = this.phase!
    const S = shapeOf({ ...p, kind: this.mode, x: this.anchor.x, y: this.anchor.y }, this.cIdx)
    // open play is ragged; a set piece and a kick-off line are not
    const loose = this.mode === 'ruck' || this.mode === 'carry' || this.mode === 'catch' || this.mode === 'penalty' || this.mode === 'con' || this.mode === 'goal' || this.mode === 'try' || this.mode === 'break'
    const pts = [...S.home, ...S.away].map((q, i) => ({ x: q.x + jit(i, 1) * (loose ? 2.4 : 0.7), y: q.y + jit(i, 2) * (loose ? 1.6 : 0.5) }))
    for (const [i, q] of this.over) pts[i] = q
    return { pts, ref: S.ref }
  }

  /** advance by dt seconds (call with small steps) */
  step(dt: number) {
    if (this.cut) {
      this.cut.t -= dt
      if (this.cut.t <= 0) { const c = this.cut; this.cut = null; c.apply() }
      else { this.move(dt, null); return }
    } else if (this.fade > 0) this.fade = Math.max(0, this.fade - dt / 0.35)
    if (!this.phase) return

    // the script: instant steps fall through, timed ones hold
    let runTo: Pt | null = null
    for (let guard = 0; guard < 12 && this.si < this.steps.length; guard++) {
      const s = this.steps[this.si]
      const first = !this.entered
      this.entered = true
      let over = false
      switch (s.k) {
        case 'mode':
          this.mode = s.mode
          if (s.mode === this.phase.kind) this.landed = true
          if (s.cIdx !== undefined) this.cIdx = s.cIdx
          if (s.anchorOn != null) this.anchor = { x: this.b[s.anchorOn].x, y: this.b[s.anchorOn].y }
          if (s.clear) this.over.clear()
          over = true; break
        case 'ground': {
          const was = this.holder
          if (was >= 0 && this.mode === 'ruck') {
            // he is tackled: he and the nearest defender go to ground
            this.down[was] = 1.5
            const d0 = was < 15 ? 15 : 0
            let best = -1, bd = 1e9
            for (let k = d0; k < d0 + 15; k++) { const dd = hyp(this.b[k], this.b[was]); if (dd < bd) { bd = dd; best = k } }
            if (best >= 0 && bd < 9) this.down[best] = 1.1
          }
          this.holder = -1; this.grounded = true; over = true; break
        }
        case 'wait':
          this.st += dt; over = this.st >= s.t; break
        case 'pick': {
          if (this.holder === s.who) { over = true; break }
          this.over.set(s.who, { x: this.ball.x, y: this.ball.y })
          this.st += dt
          if ((hyp(this.b[s.who], this.ball) < 1.6 && this.ball.lift < 0.5 && !this.flight) || this.st > 3) {
            this.over.delete(s.who); this.holder = s.who; this.grounded = false; this.flight = null; over = true
          }
          break
        }
        case 'pass':
          if (first) {
            const from = { x: this.ball.x, y: this.ball.y }
            const T = clamp(hyp(from, this.b[s.to]) / V_PASS, 0.22, 1.1)
            this.flight = { from, to: this.b[s.to], toIdx: s.to, T, t: 0, hang: s.hang ?? 0.5 }
            this.holder = -1; this.grounded = false
          }
          over = !this.flight; break
        case 'kick':
          if (first) {
            const from = { x: this.ball.x, y: this.ball.y }
            const T = clamp(hyp(from, s.to) / 16, 1.1, 3.4)
            this.flight = { from, to: s.to, toIdx: -1, T, t: 0, hang: s.hang }
            this.holder = -1; this.grounded = false
          }
          over = !this.flight; break
        case 'run': {
          const dd = hyp(this.anchor, s.to)
          const mv = Math.min(dd, s.v * dt)
          if (dd > 1e-6) { this.anchor.x += (s.to.x - this.anchor.x) / dd * mv; this.anchor.y += (s.to.y - this.anchor.y) / dd * mv }
          runTo = this.anchor
          this.st += dt
          const tight = this.mode === 'scrum' || this.mode === 'maul'
          over = (dd < 0.05 && (tight || this.holder < 0 || hyp(this.b[this.holder], this.anchor) < 1.3)) || this.st > 9
          break
        }
      }
      if (!over) break
      this.si++; this.st = 0; this.entered = false
    }
    if (this.si >= this.steps.length) this.done = true
    this.move(dt, runTo)
  }

  private move(dt: number, runTo: Pt | null) {
    if (!this.phase) return
    const T = this.targets()
    const tight = this.mode === 'scrum' || this.mode === 'maul'
    const chase = this.mode === 'kick' || this.mode === 'kickoff' || this.mode === 'dropout' || this.mode === 'try'
    const calm = this.mode === 'penalty' || this.mode === 'break' || this.mode === 'con' || this.mode === 'goal'
    for (let i = 0; i < 30; i++) {
      const bd = this.b[i]
      if (this.down[i] > 0) { this.down[i] -= dt; bd.vx *= 0.8; bd.vy *= 0.8; bd.x += bd.vx * dt; bd.y += bd.vy * dt; continue }
      let tx = T.pts[i].x, ty = T.pts[i].y
      // the man with the ball runs the line being run
      if (runTo && i === this.holder && !tight) { tx = runTo.x; ty = runTo.y }
      ty = clamp(ty, -0.5, 70.5)
      const dx = tx - bd.x, dy = ty - bd.y
      const dist = Math.hypot(dx, dy)
      const fwd = i % 15 < 8
      const urgent = i === this.holder || this.over.has(i) || chase || dist > 9
      const vmax = urgent ? (fwd ? V_FWD : V_BACK) * (i === this.holder ? 1.08 : 1) : (fwd ? JOG_FWD : JOG_BACK) * (calm ? 0.7 : 1)
      const want = Math.min(vmax, dist * 2.6)
      const wx = dist > 1e-6 ? dx / dist * want : 0, wy = dist > 1e-6 ? dy / dist * want : 0
      const ax = wx - bd.vx, ay = wy - bd.vy
      const a = Math.hypot(ax, ay), lim = ACC * dt
      const k = a > lim ? lim / a : 1
      bd.vx += ax * k; bd.vy += ay * k
      bd.x += bd.vx * dt; bd.y += bd.vy * dt
    }
    // the referee jogs after it
    {
      const dx = T.ref.x - this.ref.x, dy = T.ref.y - this.ref.y, dist = Math.hypot(dx, dy)
      const want = Math.min(6, dist * 2)
      this.ref.vx += ((dist > 1e-6 ? dx / dist * want : 0) - this.ref.vx) * Math.min(1, dt * 6)
      this.ref.vy += ((dist > 1e-6 ? dy / dist * want : 0) - this.ref.vy) * Math.min(1, dt * 6)
      this.ref.x += this.ref.vx * dt; this.ref.y += this.ref.vy * dt
    }
    // the ball
    const f = this.flight
    if (f) {
      f.t += dt
      const u = clamp(f.t / f.T, 0, 1)
      this.ball.x = f.from.x + (f.to.x - f.from.x) * u
      this.ball.y = f.from.y + (f.to.y - f.from.y) * u
      this.ball.lift = Math.sin(Math.PI * u) * f.hang
      if (u >= 1) { if (f.toIdx < 0) this.landed = true; this.flight = null; this.ball.lift = 0; this.holder = f.toIdx; this.grounded = false }
    } else if (this.holder >= 0) {
      this.ball.x = this.b[this.holder].x; this.ball.y = this.b[this.holder].y; this.ball.lift = 0
    } else if (this.grounded) {
      const dx = this.anchor.x - this.ball.x, dy = this.anchor.y - this.ball.y, dist = Math.hypot(dx, dy)
      const mv = Math.min(dist, 7 * dt)
      if (dist > 1e-6) { this.ball.x += dx / dist * mv; this.ball.y += dy / dist * mv }
    }
  }
}
