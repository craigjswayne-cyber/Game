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
// THE WHOLE EIGHTY IS PLAYED, AND IT NEVER CUTS (third pass). Owner, 17 Nov
// 2026, on the second: "Its quite glitchy" and "The whole 80 mins should be
// played but sped up when there's nothing really happening". The second pass
// dissolved to a new picture some seventy times a match, wherever the engine
// had moved on. Now when the match jumps the men RUN there, in fast forward,
// and every play carries a rate: a ruck in midfield goes by at over twice
// real time, a move, a kick at goal or anything in the 22 at real time. The
// screen multiplies time by `rate`; the men's speeds in the model never
// change, so it is the same smooth picture, wound on.
//
// Reads phases only; no rng, nothing written back.

import type { Phase, PhaseKind } from './phase'
import { shapeOf, type Pt } from './shapes'
import { FLIGHT, TRACKS, trackAt, type Track } from '../clipPlays'
import { openPlayTargets, MID_TAC, type PitchTac } from './agents'

export interface Body { x: number; y: number; vx: number; vy: number }

type Step = ({ rate?: number }) & (
  | { k: 'wait'; t: number }
  /** the man goes to the ball and picks it up */
  | { k: 'pick'; who: number; max?: number; re?: boolean }
  /** everybody gets to his place (most of them), or `max` seconds pass */
  | { k: 'settle'; max: number }
  /** a called move: its men to their marks, then the move as it is drawn */
  | { k: 'trackset' }
  | { k: 'track' }
  | { k: 'pass'; to: number; hang?: number; thrown?: boolean }
  /** the anchor (and the man with the ball) moves to a point at v m/s */
  | { k: 'run'; to: Pt; v: number; straight?: boolean }
  | { k: 'kick'; to: Pt; hang: number; silent?: boolean }
  /** open play nobody wrote a line for: the side with the ball plays it up
   *  the field through phases until there is a ruck at `to` */
  | { k: 'advance'; to: Pt; n?: number; join?: number; kicked?: boolean; chase?: boolean; t0?: number }
  /** in the tackle the ball is slipped to the man on his shoulder, who goes on */
  | { k: 'offload'; thrown?: boolean }
  /** the ball on the floor is worked back (a scrum: hooked, to the 8's feet) */
  | { k: 'heel'; by: number }
  /** the ball goes to ground at the anchor */
  | { k: 'ground' }
  | { k: 'mode'; mode: PhaseKind; cIdx?: number | null; anchorOn?: number; at?: Pt; clear?: boolean }
)

/** fast forward across a gap in the match */
const FF = 7
/** how fast the open play between two lines is wound on */
const ADV = 6

const V_FWD = 6.3, V_BACK = 8.2, ACC = 15, V_PASS = 17
/** off the ball a man jogs into shape; only the action, and a man a long
 *  way out of place, runs flat out (the reference clips' calm) */
const JOG_FWD = 3.9, JOG_BACK = 4.8
const hyp = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** a fixed offset per man, so a line is never a ruler and never reshuffles */
/**
 * How long the ball is in a ruck before the 9 can play it. The measured
 * average from tackle to the ball leaving is about three seconds and more
 * than half are quicker (docs/match-authenticity-2.0.0.md, section 3); the
 * tackle and the 9's pick-up are played out either side of this wait.
 */
function ruckLen(seed: number, tempo = 50): number {
  const r = jit(seed, 91) + 0.5
  const t = r < 0.55 ? 1.0 + r : r < 0.88 ? 1.8 + (r - 0.55) : 2.6 + (r - 0.88) * 3
  // a quick side plays it away sooner, a slow one sets itself first
  return t * (1.25 - 0.5 * tempo / 100)
}
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
  private flight: { from: Pt; to: Pt; toIdx: number; T: number; t: number; hang: number; silent?: boolean } | null = null
  private cut: { t: number; apply: () => void } | null = null
  private started = false
  /** how fast the screen should run this moment: 1 is real time */
  rate = 1
  private baseRate = 1
  private ruckers: number[] | undefined
  private tacklers: number[] | undefined
  private downMan: number | null = null
  /** seconds since the ball last went to ground in a ruck */
  private ruckT = 0
  /** how each club plays (home, away), from its own tactics */
  tac: [PitchTac, PitchTac] = [MID_TAC, MID_TAC]
  /** men off the field (sin bin, sent off, a slot the engine has emptied):
   *  they walk to the touchline and the fourteen play without them */
  off: boolean[] = new Array(30).fill(false)
  /** a called move being run: the track, where it is laid, and who is who */
  /** how many phases the pitch has played on its own since the last line */
  private idleN = 0
  /** where each man is heading, eased: when the play changes his mind is
   *  changed over a fifth of a second, not between two frames (owner, 17 Nov
   *  2026: "Looks glitchy again") */
  private tg: Pt[] = []
  /** the scrum ball has been hooked in this line's play */
  private heeled = false
  /** a kick has been struck in this line's play (latched: the chase does not un-happen) */
  private kicked = false
  /** the two defenders standing post at this ruck (side-relative), fixed when the ruck forms */
  private posts: number[] = []
  /** seconds since the mode last changed */
  private modeT = 0
  /** where the ball lies on the floor, in metres up the field from the anchor:
   *  at the back of a ruck, at the number 8's feet in a scrum */
  private spotOff = 0
  /** seconds of play since the match started */
  private clock = 0
  /** the man the lineout throw is going to */
  private jumper = -1
  private side: 1 | -1 = 1
  /** where the running man is going to be met */
  private meet: Pt | null = null
  private doneT = 0
  private trk: { tr: Track; O: Pt; dir: number; s: number; who: Record<string, number>; t: number; T: number; ev: number; att0: number } | null = null

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
    /**
     * THE BALL HAS TO BE IN THIS SIDE'S HANDS. When it already was theirs it
     * is the 9 at the base. When it was the other side's, this is a
     * TURNOVER and it is shown as one (docs/match-authenticity-2.0.0.md,
     * section 10): the man carrying is brought down and it is ripped from
     * him, or it is stolen off the floor at the ruck by the man over it, or
     * a pass is picked off in the air. Whoever wins it is the nearest man,
     * and his side plays from there at once.
     */
    const turned = this.phase != null && this.phase.homeBall !== p.homeBall && (this.mode === 'ruck' || this.mode === 'carry')
    const need9 = () => {
      if (holderAtt) return
      if (!turned) { steps.push({ k: 'pick', who: att0 + 8, max: 1.6 }); return }
      if (this.flight && this.flight.toIdx >= 0) {
        // an intercept: the nearest man steps into the pass
        const thief = this.nearest(att0, this.flight.to)
        this.flight.to = this.b[thief]; this.flight.toIdx = thief
        steps.push({ k: 'wait', t: 0.25 })
        return
      }
      if (this.holder >= 0) steps.push({ k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: 0.5 })
      steps.push({ k: 'pick', who: this.nearest(att0, B), max: 1.2 }, { k: 'wait', t: 0.15 })
    }
    // the men nearest this breakdown are the men at it
    this.mark(E, att0, this.holder)
    this.downMan = null
    this.heeled = false
    this.kicked = false
    this.idleN = 0
    this.trk = null
    // how fast it is worth watching: real time where it matters, wound on
    // where nothing much is happening
    const in22 = p.homeBall ? p.x > 76 : p.x < 24
    this.baseRate = p.move ? 1
      : p.kind === 'try' || p.kind === 'heldup' ? 1
      : p.kind === 'con' || p.kind === 'goal' ? 2.1
      : p.kind === 'kick' || p.kind === 'catch' || p.kind === 'kickoff' || p.kind === 'dropout' ? 2.2
      : p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'maul' ? (in22 ? 1.5 : 3)
      : p.kind === 'penalty' || p.kind === 'break' ? 4.5
      : in22 ? 1.25 : 3.2
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
        // the put-in, the hook, the ball worked back to the number 8's feet
        // while the pack goes forward, and the 9 away from the base
        steps.push({ k: 'ground' }, { k: 'wait', t: cut ? 1.3 : 2.8 }, { k: 'heel', by: -dir * 8.8 }, { k: 'run', to: { x: E.x + dir * 2.5, y: E.y }, v: 0.9 },
          { k: 'pick', who: att0 + 8 }, { k: 'wait', t: 0.3 })
        // one scrum in four the number 8 picks up from the base himself and feeds his 9 (the 8-9)
        if (p.at % 4 === 0) steps.splice(steps.length - 2, 2, { k: 'pick', who: att0 + 7 }, { k: 'wait', t: 0.5 }, { k: 'pass', to: att0 + 8, hang: 0.2 }, { k: 'wait', t: 0.2 })
        break
      case 'lineout':
        cut = cut || d > 10; init = att0 + 1
        if (!cut) steps.push({ k: 'pick', who: att0 + 1 })
        // front, middle or tail: a different jumper, lifted by the men either side of him
        this.jumper = att0 + [3, 4, 7][p.at % 3]
        steps.push({ k: 'wait', t: cut ? 1.3 : 2.4 }, { k: 'pass', to: this.jumper, hang: 4 }, { k: 'wait', t: 0.5 },
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
        if (cut) steps.push({ k: 'ground' }, { k: 'wait', t: ruckLen(p.at, this.tac[p.homeBall ? 0 : 1].tempo) })
        else if (holderAtt) {
          // he carries it into contact, then it is a ruck
          mode = 'carry'; cIdx = this.holder - att0; anchor = B
          steps.push({ k: 'run', to: E, v: 6 }, { k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: ruckLen(p.at, this.tac[p.homeBall ? 0 : 1].tempo) })
        } else {
          anchor = B
          steps.push({ k: 'ground' }, { k: 'run', to: E, v: 5 }, { k: 'wait', t: ruckLen(p.at, this.tac[p.homeBall ? 0 : 1].tempo) })
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
        // he has caught it with the chase still coming: he runs it back, infield, away from the touchline
        steps.push({ k: 'run', to: { x: clamp(E.x + dir * 9, 1, 99), y: clamp(E.y + (E.y < 35 ? 5 : -5), 4, 66) }, v: 7.6 })
        break
      }
      case 'kick': {
        // a box kick is the scrum-half's, off the base of the ruck
        const box = p.label === 'lp.boxKick'
        const k = box ? 8 : carrierIdx ?? 9
        cut = cut || d > 16
        if (cut) { mode = 'carry'; cIdx = k; init = att0 + k; steps.push({ k: 'wait', t: 0.8 }) }
        else {
          mode = this.mode; cIdx = this.cIdx; anchor = this.anchor
          if (this.holder !== att0 + k) {
            need9()
            if (!box) {
              // back to the kicker in the pocket, well behind the ruck
              this.over.set(att0 + k, { x: B.x - dir * 10, y: clamp(B.y + open(B.y) * 5, 3, 67) })
              steps.push({ k: 'wait', t: 0.4 }, { k: 'pass', to: att0 + k })
            }
          }
          steps.push({ k: 'wait', t: box ? 0.7 : 0.35 })
        }
        steps.push({ k: 'mode', mode: 'kick', anchorOn: att0 + k, clear: true },
          { k: 'kick', to: p.to ?? { x: E.x + dir * 30, y: E.y }, hang: p.hang ?? 12 }, { k: 'wait', t: 0.4 })
        break
      }
      case 'carry': case 'try': case 'heldup': {
        // (a quick tap is the scrum-half's: he taps it to himself and goes, the
        // defence still getting back its ten metres)
        const c = p.label === 'lp.quickTap' ? 8 : carrierIdx ?? (p.kind === 'carry' ? 11 : 13)
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
        // A CALLED MOVE IS RUN AS IT IS DRAWN (owner: "I didnt see any of the
        // moves"). The line names the move; the Playbook's own keyframes
        // (clipPlays TRACKS) are laid on the pitch from where the ball is.
        const mvId = p.move?.split('.').pop()
        const tr = mvId ? TRACKS[mvId]?.[0] : undefined
        if (tr) {
          // run from within reach of where the line ends: a move is twenty
          // metres of rugby, not sixty
          if (!cut && d > 26) { cut = true }
          if (cut) { mode = 'ruck'; cIdx = null; init = -1; anchor = { x: clamp(E.x - dir * 20, 4, 96), y: clamp(E.y, 12, 58) }; steps.push({ k: 'ground' }) }
          else { mode = this.mode; cIdx = this.cIdx; anchor = this.anchor }
          const strike = tr.strike
          // the scrum-half has it: handed to him if one of his own is carrying
          if (!cut && holderAtt && this.holder !== att0 + 8) steps.push({ k: 'pass', to: att0 + 8, rate: 2.5 })
          else steps.push({ k: 'pick', who: att0 + 8, rate: 2.5 })
          steps.push({ k: 'trackset', rate: 3 }, { k: 'track', rate: 0.95 },
            { k: 'mode', mode: 'carry', anchorOn: -1, clear: true })
          this.trk = { tr, O: { x: 0, y: 0 }, dir, s: 1, who: {}, t: 0, T: 0, ev: 0, att0 }
          void strike
          // he goes for the line from where the move put him, not across the field
          steps.push({ k: 'run', to: { ...E }, v, straight: true })
          if (scoring) steps.push({ k: 'mode', mode: p.kind }, { k: 'wait', t: p.kind === 'try' ? 2.6 : 1.2 })
          else steps.push({ k: 'wait', t: 0.2 })
          break
        }
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
          if (c !== 8) {
            this.over.set(att0 + c, S)
            steps.push({ k: 'wait', t: 0.12 })
            this.feed(steps, att0, dir, B, c, S.y, undefined, p.at)
          }
          steps.push({ k: 'mode', mode: 'carry', cIdx: c, anchorOn: att0 + c, clear: true })
        }
        steps.push({ k: 'run', to: E, v })
        if (scoring) steps.push({ k: 'mode', mode: p.kind }, { k: 'wait', t: p.kind === 'try' ? 2.8 : 1.6 })
        break
      }
      default:
        steps.push({ k: 'wait', t: 1 })
    }

    const begin = () => {
      this.landed = !(p.kind === 'try' || p.kind === 'heldup' || p.kind === 'con' || p.kind === 'goal')
      this.phase = p; this.steps = steps; this.si = 0; this.st = 0; this.entered = false; this.done = false
      if (this.mode !== mode) this.modeT = 0
      this.mode = mode; this.anchor = { ...anchor }; this.cIdx = cIdx
    }
    if (cut && !this.started) {
      // the very first picture is simply there
      this.over.clear()
      this.done = false
      this.cut = { t: 0, apply: () => {
        begin()
        this.cuts++
        this.tg = []
        this.flight = null; this.holder = init; this.grounded = init < 0
        this.down.fill(0)
        const T = this.targets()
        for (let i = 0; i < 30; i++) { this.b[i].x = T.pts[i].x; this.b[i].y = T.pts[i].y; this.b[i].vx = this.b[i].vy = 0 }
        this.ref.x = T.ref.x; this.ref.y = T.ref.y
        const at = init >= 0 ? this.b[init] : this.anchor
        this.ball.x = at.x; this.ball.y = at.y; this.ball.lift = 0
      } }
      this.started = true
    } else if (cut) {
      // THE MATCH HAS MOVED ON: nobody is teleported and the ball is never
      // left lying on the grass with thirty men walking (owner, 17 Nov 2026:
      // "Too stop start", "The resets are scrums, lineouts and tries").
      this.over.clear()
      this.flight = null; this.ball.lift = 0
      this.down.fill(0)
      const reset = p.kind === 'scrum' || p.kind === 'lineout' || p.kind === 'maul' || p.kind === 'kickoff' || p.kind === 'dropout'
        || p.kind === 'con' || p.kind === 'goal' || p.kind === 'break'
        // from one end to the other is not a passage of play: something restarted it
        || d > 70
      const gain = (anchor.x - B.x) * dir
      const pre: Step[] = []
      if (reset) {
        // A RESET: the nearest man gathers it and brings it with him while
        // both sides jog to the mark
        if (!holderAtt) { this.holder = -1; this.grounded = false; pre.push({ k: 'pick', who: this.nearest(att0, B), max: 1.5, rate: FF }) }
        pre.push({ k: 'settle', max: 6.5, rate: FF })
        if (init >= 0) pre.push({ k: 'pass', to: init, rate: 2.5 })
        steps.unshift(...pre)
        begin()
      } else if (gain < -8 || p.kind === 'catch') {
        // IT WENT BACK DOWN THE FIELD: it was kicked there
        this.holder = -1; this.grounded = false
        steps.unshift({ k: 'kick', to: { ...anchor }, hang: 9, silent: true, rate: 2.2 },
          { k: 'pick', who: init >= 0 ? init : att0 + 8, max: 2.5, rate: FF }, { k: 'settle', max: 3, rate: FF })
        begin()
      } else {
        // OPEN PLAY: it is played there. Carry, tackle, quick ball, the next
        // man on to it, until the ruck is where this line picks it up.
        if (!holderAtt) { this.holder = -1; this.grounded = false }
        pre.push({ k: 'advance', to: { ...anchor }, join: init >= 0 ? init : undefined, rate: ADV })
        if (init >= 0) pre.push({ k: 'pick', who: att0 + 8, max: 1.2, rate: ADV }, { k: 'pass', to: init, rate: ADV },
          { k: 'mode', mode, cIdx, anchorOn: init, clear: true })
        else pre.push({ k: 'mode', mode, cIdx, at: { ...anchor }, clear: true })
        steps.unshift(...pre)
        if (holderAtt) { mode = 'carry'; cIdx = this.holder - att0 } else { mode = 'ruck'; cIdx = null }
        anchor = B
        begin()
      }
    } else begin()
  }

  /**
   * THE BALL GOES THROUGH THE HANDS (owner, 17 Nov 2026: "the way they
   * pass"). The 9 does not throw it thirty metres to a wing. It goes to the
   * first receiver and along the line, each man giving it to the next man
   * out, who is deeper than he is and coming on to it.
   */
  private feed(steps: Step[], att0: number, dir: number, B: Pt, c: number, toY: number, rate?: number, seed = 0) {
    const want = toY - B.y, sgn = Math.sign(want) || 1, wide = Math.abs(want)
    // OUT THE BACK: when it is going wide it often goes to the middle man of
    // the first pod, who draws the defence and plays it behind him to the 10
    if (wide > 16 && c >= 8 && seed % 2 === 0) {
      const pod = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => this.down[att0 + k] <= 0 && !(this.ruckers ?? []).includes(k) && k !== this.downMan)
        .map(k => ({ k, v: (this.b[att0 + k].y - B.y) * sgn, u: (this.b[att0 + k].x - B.x) * dir })).filter(o => o.v > 5 && o.v < 14 && o.u < -1 && o.u > -8)
        .sort((a, b) => Math.abs(a.v - 9.5) - Math.abs(b.v - 9.5))[0]
      if (pod) steps.push({ k: 'pass', to: att0 + pod.k, rate }, { k: 'wait', t: 0.3, rate })
    }
    if (wide > 11) {
      const cand = [9, 11, 12, 14].filter(k => k !== c && this.down[att0 + k] <= 0 && !this.off[att0 + k] && (this.b[att0 + k].x - B.x) * dir < -1)
        .map(k => ({ k, v: (this.b[att0 + k].y - B.y) * sgn })).filter(o => o.v > 3 && o.v < wide - 4).sort((a, b) => a.v - b.v)
      let at = 0
      const used: number[] = []
      for (const o of cand) {
        if (o.v - at < 5 || wide - at <= 11) continue
        steps.push({ k: 'pass', to: att0 + o.k, rate }, { k: 'wait', t: 0.2, rate })
        at = o.v; used.push(o.k)
      }
      // still a long way to throw it: whoever is standing in between takes it on
      for (let guard = 0; guard < 3 && wide - at > 15; guard++) {
        const o = [...Array(15).keys()].filter(k => k !== c && k !== 8 && !used.includes(k) && this.down[att0 + k] <= 0 && !this.off[att0 + k]
          && !(this.ruckers ?? []).includes(k) && k !== this.downMan && (this.b[att0 + k].x - B.x) * dir < -1)
          .map(k => ({ k, v: (this.b[att0 + k].y - B.y) * sgn })).filter(q => q.v > at + 4 && q.v < wide - 4)
          .sort((a, b) => Math.abs(a.v - (at + 9)) - Math.abs(b.v - (at + 9)))[0]
        if (!o) break
        steps.push({ k: 'pass', to: att0 + o.k, rate }, { k: 'wait', t: 0.2, rate })
        at = o.v; used.push(o.k)
      }
    }
    steps.push({ k: 'pass', to: att0 + c, rate })
  }

  /** this side's nearest man on his feet to a point */
  private nearest(att0: number, at: Pt, skip: number[] = []) {
    let best = att0 + 8, bd = 1e9
    for (let k = 0; k < 15; k++) {
      if (skip.includes(k) || this.down[att0 + k] > 0 || this.off[att0 + k]) continue
      const d = hyp(this.b[att0 + k], at)
      if (d < bd) { bd = d; best = att0 + k }
    }
    return best
  }

  /** the men nearest a point: the attack's three forwards for the breakdown,
   *  the defence's two for the tackle */
  private mark(at: Pt, att0: number, skip: number) {
    const near = (from: number, pool: number[], n: number) => pool
      .filter(k => from + k !== skip && !this.off[from + k]).map(k => ({ k, d: hyp(this.b[from + k], at) })).sort((a, b) => a.d - b.d).slice(0, n).map(o => o.k)
    this.ruckers = near(att0, [0, 1, 2, 3, 4, 5, 6, 7], 3)
    this.tacklers = near(15 - att0, [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 12], 2)
    this.posts = near(15 - att0, [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !this.tacklers!.includes(k)), 2)
  }

  /** the lines being run on to the ball right now: who, and to where */
  runs(): { i: number; to: Pt }[] {
    const out: { i: number; to: Pt }[] = []
    if (this.trk && this.trk.T > 0) return out
    for (const [i, to] of this.over) if (i !== this.holder && Math.hypot(this.b[i].x - to.x, this.b[i].y - to.y) > 2) out.push({ i, to })
    return out
  }

  /** a called move's lines from now to their ends, for the screen to draw */
  trails(): Pt[][] {
    const k = this.trk
    if (!k || k.T <= 0) return []
    const out: Pt[][] = []
    for (const [role, ks] of Object.entries(k.tr.runs)) {
      const end = ks[ks.length - 1][0]
      if (k.t >= end - 0.05 || k.who[role] == null) continue
      const line: Pt[] = []
      for (let t = Math.max(k.t, 0); t <= end + 1e-6; t += 0.12) line.push(this.trackPt(ks, t))
      if (line.length > 1) out.push(line)
    }
    return out
  }

  private trackPt(ks: [number, number, number][], t: number): Pt {
    const k = this.trk!
    const [tx, ty] = trackAt(ks, t)
    return { x: clamp(k.O.x + k.dir * tx, -4, 104), y: clamp(k.O.y + k.s * ty, 1.5, 68.5) }
  }

  private targets(): { pts: Pt[]; ref: Pt } {
    const p = this.phase!
    // OPEN PLAY: every man works out his own place (agents.ts)
    if (this.mode === 'ruck' || this.mode === 'carry') {
      const att0 = p.homeBall ? 0 : 15
      const dir = p.homeBall ? 1 : -1
      const inRuck = this.mode === 'ruck'
      // the open side only changes once the ball is well across the middle
      if (this.anchor.y < 28) this.side = 1; else if (this.anchor.y > 42) this.side = -1
      const holderAtt = this.holder >= 0 && (this.holder < 15) === p.homeBall
      // the ball is "out" once it has left the base: a pass in the air, or a man running with it
      const out: Pt | null = this.flight && this.flight.toIdx >= 0 ? { x: this.ball.x, y: this.ball.y }
        : holderAtt && !(inRuck && this.holder === att0 + 8) ? this.b[this.holder] : null
      const pts = openPlayTargets({
        // (a kick nobody wrote a line for: both sides run to where it is coming down)
        b: this.b, att0, dir, ref: this.flight && this.flight.toIdx < 0 ? this.flight.to : this.anchor, ruck: inRuck && !(this.flight && this.flight.toIdx < 0), ruckAge: this.ruckT,
        out: inRuck && this.grounded ? null : out,
        ruckers: this.ruckers ?? [], tacklers: this.tacklers ?? [], posts: this.posts,
        carrier: inRuck ? null : (holderAtt ? this.holder - att0 : this.cIdx), downMan: this.downMan,
        att: this.tac[p.homeBall ? 0 : 1], def: this.tac[p.homeBall ? 1 : 0], gone: this.off,
        go: inRuck ? clamp((this.ruckT - 0.35) / 0.7, 0, 1) : 1,
        side: this.side, meet: inRuck ? null : this.meet,
      }).map((q, i) => ({ x: q.x + jit(i, 1) * 0.7, y: q.y + jit(i, 2) * 0.5 }))
      for (const [i, q] of this.over) pts[i] = q
      return { pts, ref: { x: this.anchor.x - dir * 3.5, y: clamp(this.anchor.y + (this.anchor.y < 35 ? 8 : -8), 3, 67) } }
    }
    const restartUp = (this.mode === 'kickoff' || this.mode === 'dropout') && this.kicked
    const S = shapeOf({ ...p, flying: restartUp, kind: this.mode, x: this.anchor.x, y: this.anchor.y, ruckers: this.ruckers, tacklers: this.tacklers, downMan: this.downMan }, this.cIdx)
    // open play is ragged; a set piece and a kick-off line are not
    const loose = this.mode === 'catch' || this.mode === 'penalty' || this.mode === 'con' || this.mode === 'goal' || this.mode === 'try' || this.mode === 'break'
    const pts = [...S.home, ...S.away].map((q, i) => ({ x: q.x + jit(i, 1) * (loose ? 2.4 : 0.7), y: q.y + jit(i, 2) * (loose ? 1.6 : 0.5) }))
    // THE BALL IS OUT OF THE SCRUM: the defending flankers and number 8 break
    // off their binds and go at the half-backs; the attack's flankers stay
    // bound a moment longer to hold them in
    if (this.mode === 'scrum' && this.holder >= 0 && this.heeled) {
      const d0 = p.homeBall ? 15 : 0, dr = p.homeBall ? 1 : -1
      const h = this.b[this.holder]
      pts[d0 + 5] = { x: this.anchor.x + dr * 2.2, y: clamp(this.anchor.y + 7, 2, 68) }
      pts[d0 + 6] = { x: this.anchor.x + dr * 2.2, y: clamp(this.anchor.y - 7, 2, 68) }
      pts[d0 + 7] = { x: h.x + dr * 3.5, y: h.y }
    }
    // A MAUL IS BUILT, NOT DROPPED IN: the catcher and his lifters first,
    // then the rest of the pack binding on one by one; the defence the same,
    // a moment behind
    if (this.mode === 'maul') {
      const a0 = p.homeBall ? 0 : 15, d0 = 15 - a0, dr = p.homeBall ? 1 : -1
      ;[3, 0, 2, 1, 4, 5, 6, 7].forEach((k, j) => { if (this.modeT < (j - 2) * 0.45) pts[a0 + k] = { x: pts[a0 + k].x - dr * 4.5, y: pts[a0 + k].y + (j % 2 ? 3 : -3) } })
      ;[3, 0, 2, 1, 4, 5, 6, 7].forEach((k, j) => { if (this.modeT < 0.4 + (j - 1) * 0.5) pts[d0 + k] = { x: pts[d0 + k].x + dr * 4.5, y: pts[d0 + k].y + (j % 2 ? -3 : 3) } })
    }
    // the lift: the men either side of the jumper step in under him
    if (this.mode === 'lineout' && this.jumper >= 0 && (this.flight?.toIdx === this.jumper || this.holder === this.jumper)) {
      const order = [0, 5, 3, 4, 7, 2, 6]
      for (const j0 of [this.jumper, this.jumper < 15 ? this.jumper + 15 : this.jumper - 15]) {
        const base = j0 < 15 ? 0 : 15, at = order.indexOf(j0 - base)
        const J = pts[j0]
        for (const [n, sgn] of [[order[at - 1], -1], [order[at + 1], 1]] as [number | undefined, number][]) {
          if (n == null) continue
          const side = Math.sign(pts[base + n].y - J.y) || sgn
          pts[base + n] = { x: J.x, y: J.y + side * 2.3 }
        }
      }
    }
    for (const [i, q] of this.over) pts[i] = q
    return { pts, ref: S.ref }
  }

  /**
   * THE BALL IS IN PLAY, SO THEY PLAY (owner, 17 Nov 2026: "Too stop start",
   * "it should be fluid, players should be moving as soon as the ball is in
   * play", "The resets are scrums, lineouts and tries"). A line's play used
   * to end with thirty men standing, waiting for the next line. In open play
   * the side with the ball now keeps it through phases of its own: tackle,
   * quick ruck, out to the next runner. They gain a metre or two and change
   * nothing the engine decided: no score, no kick, no turnover. The next
   * line picks the play up from wherever this has taken it.
   */
  private idle() {
    const p = this.phase!
    const att0 = p.homeBall ? 0 : 15, dir = p.homeBall ? 1 : -1
    const holderAtt = this.holder >= 0 && (this.holder < 15) === p.homeBall
    const steps: Step[] = []
    const B: Pt = { x: this.ball.x, y: this.ball.y }
    // never over a try line, never into touch: that is the engine's to say
    const safe = dir > 0 ? B.x < 90 : B.x > 10
    if (this.holder >= 0 && !holderAtt) return
    if (holderAtt && this.mode === 'carry') {
      // he is tackled where he is
      this.mark(B, att0, this.holder)
      steps.push({ k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: ruckLen(p.at + this.idleN, this.tac[p.homeBall ? 0 : 1].tempo) })
    } else if (this.mode === 'ruck' && safe) {
      const n = ++this.idleN
      const h = (k: number) => Math.abs(jit(n * 7 + p.at, k)) * 2
      const openS = B.y <= 35 ? 1 : -1
      // mostly a forward off the 9; every third phase it goes to the backs
      const wide = n % 3 === 0
      const pool = wide ? [9, 11, 12] : [0, 1, 2, 3, 4, 5, 6, 7].filter(k => !(this.ruckers ?? []).includes(k) && k !== this.downMan)
      const want: Pt = { x: B.x - dir * (wide ? 8 : 3.5), y: clamp(B.y + openS * (wide ? 14 : 8), 4, 66) }
      const c = pool.map(k => ({ k, d: hyp(this.b[att0 + k], want) })).sort((a, b) => a.d - b.d)[0]?.k
      if (c == null) return
      const E: Pt = { x: clamp(B.x + dir * (1 + h(3) * 3), 5, 95), y: clamp(B.y + openS * (wide ? 12 + h(4) * 8 : 5 + h(4) * 5), 5, 65) }
      this.anchor = { ...B }
      if (!(holderAtt && this.holder === att0 + 8)) steps.push({ k: 'pick', who: att0 + 8 })
      const me = this.b[att0 + c]
      this.over.set(att0 + c, { x: dir > 0 ? Math.min(me.x + 2, B.x - 2.5) : Math.max(me.x - 2, B.x + 2.5), y: me.y })
      steps.push({ k: 'wait', t: 0.1 })
      this.feed(steps, att0, dir, B, c, me.y)
      steps.push({ k: 'mode', mode: 'carry', cIdx: c, anchorOn: att0 + c, clear: true },
        { k: 'run', to: E, v: c < 8 ? 6 : 7.6 }, { k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: ruckLen(p.at + n, this.tac[p.homeBall ? 0 : 1].tempo) })
    } else return
    this.steps = steps; this.si = 0; this.st = 0; this.entered = false
  }

  /** the lineout jumper while he is in the air (drawn larger: he is up), and
   *  the man opposite him going up against the throw; -1 when nobody is */
  lifted(): [number, number] {
    if (this.mode !== 'lineout' || this.jumper < 0) return [-1, -1]
    const up = (this.flight != null && this.flight.toIdx === this.jumper && this.flight.t > this.flight.T * 0.35) || this.holder === this.jumper
    if (!up) return [-1, -1]
    const opp = this.jumper < 15 ? this.jumper + 15 : this.jumper - 15
    const contests = this.tac[this.jumper < 15 ? 1 : 0].contest >= 45
    return [this.jumper, contests && this.holder !== this.jumper ? opp : -1]
  }

  /** is this man bound into the ruck (drawn smaller, as one of a pile) */
  bound(i: number): boolean {
    if (this.mode !== 'ruck' || !this.phase || this.holder === i) return false
    const att0 = this.phase.homeBall ? 0 : 15
    const k = i % 15, mine = (i < 15) === this.phase.homeBall
    const inIt = mine ? (k === this.downMan || (this.ruckers ?? []).slice(0, 2).includes(k))
      : ((this.tacklers ?? []).includes(k) && this.ruckT < 1.3)
    void att0
    return inIt && hyp(this.b[i], this.anchor) < 3.2
  }

  /** advance by dt seconds (call with small steps) */
  step(dt: number) {
    if (this.cut) {
      this.cut.t -= dt
      if (this.cut.t <= 0) { const c = this.cut; this.cut = null; c.apply() }
      else { this.move(dt, null); return }
    } else if (this.fade > 0) this.fade = Math.max(0, this.fade - dt / 0.35)
    if (!this.phase) return
    // nothing left to act out and the ball still in play: keep playing
    this.doneT = this.done ? this.doneT + dt : 0
    if (this.done && this.doneT > 0.4 && this.si >= this.steps.length && (this.mode === 'ruck' || this.mode === 'carry') && (this.phase.kind === 'ruck' || this.phase.kind === 'carry')) this.idle()

    // the script: instant steps fall through, timed ones hold
    let runTo: Pt | null = null
    if (this.mode !== 'carry') this.meet = null
    this.rate = this.si < this.steps.length ? (this.steps[this.si].rate ?? this.baseRate) : 1
    for (let guard = 0; guard < 12 && this.si < this.steps.length; guard++) {
      const s = this.steps[this.si]
      const first = !this.entered
      this.entered = true
      let over = false
      switch (s.k) {
        case 'mode':
          if (this.mode !== s.mode) this.modeT = 0
          this.mode = s.mode
          if (s.mode === this.phase.kind) this.landed = true
          if (s.cIdx !== undefined) this.cIdx = s.cIdx
          if (s.anchorOn != null) {
            // -1: on whoever has the ball now (the man a move put through)
            const on = s.anchorOn >= 0 ? s.anchorOn : this.holder
            if (on >= 0) { this.anchor = { x: this.b[on].x, y: this.b[on].y }; if (s.anchorOn < 0) this.cIdx = on % 15 }
          }
          if (s.at) this.anchor = { ...s.at }
          // tackled: the men nearest him are the men at this breakdown
          if (s.mode === 'ruck' && this.holder >= 0 && this.phase) this.mark(this.b[this.holder], this.holder < 15 ? 0 : 15, this.holder)
          if (s.mode === 'carry' && this.trk) this.trk = null
          // a new man has it: the men nearest him are the ones who deal with him
          if (s.mode === 'carry' && this.phase) this.mark(this.anchor, this.phase.homeBall ? 0 : 15, this.holder)
          if (s.clear) this.over.clear()
          over = true; break
        case 'ground': {
          const was = this.holder
          if (was >= 0 && this.mode === 'ruck') {
            // he is tackled: he and the nearest defender go to ground
            this.down[was] = 1.5
            this.downMan = was % 15
            const d0 = was < 15 ? 15 : 0
            let best = -1, bd = 1e9
            for (let k = d0; k < d0 + 15; k++) { const dd = hyp(this.b[k], this.b[was]); if (dd < bd) { bd = dd; best = k } }
            if (best >= 0 && bd < 9) this.down[best] = 1.1
          }
          this.holder = -1; this.grounded = true; this.ruckT = 0; over = true
          // in a ruck it is presented back towards his own side, where the 9 can get at it
          this.spotOff = this.mode === 'ruck' ? (this.phase.homeBall ? -1.5 : 1.5) : 0
          break
        }
        case 'heel':
          this.spotOff = s.by; this.heeled = true; over = true; break
        case 'wait':
          this.st += dt; over = this.st >= s.t; break
        case 'pick': {
          if (this.holder === s.who) { over = true; break }
          this.over.set(s.who, { x: this.ball.x, y: this.ball.y })
          this.st += dt
          const gap = hyp(this.b[s.who], this.ball)
          if (gap < 1.6 && this.ball.lift < 0.5 && !this.flight) {
            this.over.delete(s.who); this.holder = s.who; this.grounded = false; over = true
          } else if (this.st > (s.max ?? 3) && !this.flight && !s.re && gap > 4) {
            // he is not getting there: the nearest man to it goes instead
            s.re = true; this.over.delete(s.who)
            s.who = this.nearest(s.who < 15 ? 0 : 15, this.ball); this.st = 0; s.max = 3
          } else if (this.st > (s.max ?? 3) && !this.flight) {
            // he has not got there: it is popped up to him. The ball is never
            // simply in a man's hands who was not at it.
            const from = { x: this.ball.x, y: this.ball.y }
            this.over.delete(s.who)
            this.flight = { from, to: this.b[s.who], toIdx: s.who, T: clamp(gap / V_PASS, 0.15, 0.9), t: 0, hang: 0.4 }
            this.holder = -1; this.grounded = false
          }
          break
        }
        case 'settle': {
          this.st += dt
          const T = this.targets()
          let there = 0
          for (let i = 0; i < 30; i++) if (hyp(this.b[i], T.pts[i]) < 5) there++
          over = there >= 25 || this.st >= s.max
          break
        }
        case 'trackset': {
          const k = this.trk
          if (!k) { over = true; break }
          if (first) {
            // laid from the gain line and the scrum-half, going to the wide side
            const nine = this.b[k.att0 + 8]
            k.O = { x: this.anchor.x, y: nine.y }
            k.s = nine.y <= 35 ? 1 : -1
            const home = k.att0 === 0
            const wingOn = (lowY: boolean) => k.att0 + ((home === lowY) ? 10 : 13)
            for (const role of Object.keys(k.tr.runs)) {
              k.who[role] = role === 'W' ? wingOn(k.s < 0) : role === 'FW' ? wingOn(k.s > 0) : k.att0 + clamp(parseInt(role, 10) - 1, 0, 14)
            }
            // the move is over when the man it is for has the ball in his hands
            k.T = Math.max(1.2, ...k.tr.ball.map(b => b[0] + 0.7))
            k.t = 0; k.ev = 0
          }
          let far = 0
          for (const [role, ks] of Object.entries(k.tr.runs)) {
            const q = this.trackPt(ks, 0)
            this.over.set(k.who[role], q)
            far = Math.max(far, hyp(this.b[k.who[role]], q))
          }
          this.st += dt
          over = far < 1.5 || this.st > 4
          break
        }
        case 'track': {
          const k = this.trk
          if (!k) { over = true; break }
          k.t += dt
          for (const [role, ks] of Object.entries(k.tr.runs)) this.over.set(k.who[role], this.trackPt(ks, k.t))
          // the passes, when the move says, to the man it says
          while (k.ev < k.tr.ball.length && k.t >= k.tr.ball[k.ev][0]) {
            const [, to, kind] = k.tr.ball[k.ev++]
            const idx = k.who[to] ?? k.att0 + clamp(parseInt(to, 10) - 1, 0, 14)
            const from = { x: this.ball.x, y: this.ball.y }
            const T = Math.max(FLIGHT[kind ?? 'pass'], hyp(from, this.b[idx]) / 20)
            this.flight = { from, to: this.b[idx], toIdx: idx, T, t: 0, hang: kind === 'miss' ? 1.2 : 0.4 }
            this.holder = -1; this.grounded = false
          }
          over = k.t >= k.T && !this.flight
          break
        }
        case 'pass':
          if (!s.thrown) {
            if (this.holder === s.to) { over = true; break }
            // NO FORWARD PASSES: if the man it is going to is in front of the
            // ball he drops back behind it first, and it is held until he has
            if (this.holder >= 0 && (this.holder < 15) === (s.to < 15) && (this.mode === 'ruck' || this.mode === 'carry')) {
              const d1 = s.to < 15 ? 1 : -1
              if ((this.b[s.to].x - this.ball.x) * d1 > -0.4 && this.st < 2.5) {
                this.over.set(s.to, { x: this.ball.x - d1 * 3, y: this.b[s.to].y })
                this.st += dt
                break
              }
            }
            const from = { x: this.ball.x, y: this.ball.y }
            const T = clamp(hyp(from, this.b[s.to]) / V_PASS, 0.22, 1.1)
            this.flight = { from, to: this.b[s.to], toIdx: s.to, T, t: 0, hang: s.hang ?? 0.5 }
            this.holder = -1; this.grounded = false
            s.thrown = true
          }
          over = !this.flight; break
        case 'offload':
          if (!s.thrown) {
            s.thrown = true
            const h = this.holder
            if (h < 0) { over = true; break }
            const a0 = h < 15 ? 0 : 15, d1 = h < 15 ? 1 : -1
            const mate = [...Array(15).keys()].filter(k => a0 + k !== h && k !== 8 && this.down[a0 + k] <= 0 && !this.off[a0 + k])
              .map(k => ({ k, d: hyp(this.b[a0 + k], this.b[h]), u: (this.b[a0 + k].x - this.b[h].x) * d1 })).filter(o => o.d < 6 && o.u < -0.3).sort((a, b) => a.d - b.d)[0]
            if (!mate) { over = true; break }
            const from = { x: this.ball.x, y: this.ball.y }
            this.flight = { from, to: this.b[a0 + mate.k], toIdx: a0 + mate.k, T: 0.22, t: 0, hang: 0.2 }
            // the man who gave it is the one who was tackled
            this.down[h] = 1.2
            this.holder = -1; this.grounded = false
          }
          over = !this.flight; break
        case 'kick':
          if (first) {
            this.kicked = true
            const from = { x: this.ball.x, y: this.ball.y }
            // a high ball hangs: that is what lets the chase get under it
            const T = clamp(Math.max(hyp(from, s.to) / 16, s.hang >= 14 && !s.silent ? 3.5 : 0), 1.1, 4)
            this.flight = { from, to: s.to, toIdx: -1, T, t: 0, hang: s.hang, silent: s.silent }
            this.holder = -1; this.grounded = false
          }
          over = !this.flight; break
        case 'advance': {
          const att0 = this.phase.homeBall ? 0 : 15, dir = this.phase.homeBall ? 1 : -1
          const B: Pt = { x: this.ball.x, y: this.ball.y }
          const rem = hyp(B, s.to)
          const mine = this.holder >= 0 && (this.holder < 15) === this.phase.homeBall
          const n = s.n = (s.n ?? 0) + 1
          const sub: Step[] = []
          const tackle: Step[] = [{ k: 'mode', mode: 'ruck' }, { k: 'ground' }, { k: 'wait', t: 0.7 }]
          // how far this carry goes: a few phases, however far it is
          // a forward makes a few metres, a back a few more: nobody runs the length of the field
          const carrierIsFwd = mine ? this.holder - att0 < 8 : true
          const len = carrierIsFwd ? clamp(rem / 3, 7, 10) : clamp(rem / 2.5, 9, 18)
          // it has gone on long enough: the next man goes all the way
          s.t0 ??= this.clock
          const late = this.clock - s.t0 > 12
          const P: Pt = late || rem - len < 4 ? { ...s.to } : { x: B.x + (s.to.x - B.x) / rem * len, y: clamp(B.y + (s.to.y - B.y) / rem * len, 4, 66) }
          if (n > 14) { over = true; break }
          // the man this line is about comes with the play: he is on the
          // shoulder of the last ruck when the ball gets there, not sixty
          // metres away waiting for a pass nobody could throw
          const join = s.join != null && s.join !== this.holder ? s.join : -1
          if (join >= 0) {
            const jy = this.b[join].y >= s.to.y ? 1 : -1
            this.over.set(join, { x: clamp(s.to.x - dir * 6, 1, 99), y: clamp(s.to.y + jy * 9, 3, 67) })
          }
          // a long way to go: it is kicked down there and chased
          if (rem > 38 && !s.kicked && (mine || this.grounded)) {
            s.kicked = true; s.chase = true
            const far = Math.min(45, rem - 9)
            this.steps.splice(this.si, 0, { k: 'kick', to: { x: B.x + (s.to.x - B.x) / rem * far, y: clamp(B.y + (s.to.y - B.y) / rem * far, 6, 64) }, hang: 11, silent: true, rate: s.rate })
            this.entered = false; this.st = 0
            continue
          }
          if (mine) {
            const c = this.holder - att0
            if (rem < 3) sub.push(...tackle)
            else sub.push({ k: 'mode', mode: 'carry', cIdx: c, anchorOn: this.holder }, { k: 'run', to: P, v: c < 8 ? 6.3 : 8 }, ...tackle)
          } else if (rem < 3.4 && this.grounded) { over = true; break }
          else if (!this.grounded) {
            // loose: the nearest man is on to it
            if (this.holder >= 0) this.holder = -1
            const who = this.nearest(att0, B)
            sub.push({ k: 'pick', who, max: clamp(hyp(this.b[who], B) / 7.5 + 0.3, 1, 4.5) }); s.chase = false
          } else {
            // quick ball: the 9 to a man coming on to it, forwards and backs in turn
            const side = Math.abs(s.to.y - B.y) > 4 ? Math.sign(s.to.y - B.y) : (B.y <= 35 ? 1 : -1)
            const st = this.tac[this.phase.homeBall ? 0 : 1].style
            const wide = st >= 60 ? n % 2 === 0 : st <= 40 ? n % 4 === 0 : n % 3 === 0
            const busy = [8, ...(this.ruckers ?? []), ...(this.downMan != null ? [this.downMan] : []), ...(join >= 0 ? [join - att0] : [])]
            const pool = (wide ? [9, 11, 12, 10, 13, 14] : [0, 1, 2, 3, 4, 5, 6, 7]).filter(k => !busy.includes(k))
            const W: Pt = { x: B.x - dir * (wide ? 7 : 3.5), y: clamp(B.y + side * (wide ? 12 : 6), 3, 67) }
            let c = this.nearest(att0, W, [...Array(15).keys()].filter(k => !pool.includes(k))) - att0
            // whoever is there: after a kick or a break the nearest support is the support
            if (hyp(this.b[att0 + c], W) > 12) c = this.nearest(att0, W, busy) - att0
            const me = this.b[att0 + c]
            this.anchor = { ...B }
            this.over.clear()
            if (hyp(me, B) > 16) {
              // nobody up with it yet: the first man there picks and goes
              const who = this.nearest(att0, B, this.downMan != null ? [this.downMan] : [])
              sub.push({ k: 'pick', who, max: clamp(hyp(this.b[who], B) / 7.5 + 0.3, 0.9, 3) })
            } else {
              this.over.set(att0 + c, { x: dir > 0 ? Math.min(me.x + 2, B.x - 2.5) : Math.max(me.x - 2, B.x + 2.5), y: me.y })
              sub.push({ k: 'pick', who: att0 + 8, max: 0.7 })
              this.feed(sub, att0, dir, B, c, me.y, undefined, n)
              // POD PLAY: the man who gets it from the 9 carries, or tips it
              // on to the man beside him, who hits the gap the first one made
              let run = c
              if (c < 8 && n % 3 === 1) {
                const mate = [0, 1, 2, 3, 4, 5, 6, 7].filter(k => k !== c && !busy.includes(k) && this.down[att0 + k] <= 0)
                  .map(k => ({ k, d: hyp(this.b[att0 + k], me) })).filter(o => o.d < 6.5).sort((a, b) => a.d - b.d)[0]
                if (mate) { run = mate.k; sub.push({ k: 'wait', t: 0.18 }, { k: 'pass', to: att0 + run, hang: 0.2 }) }
              }
              sub.push({ k: 'mode', mode: 'carry', cIdx: run, anchorOn: att0 + run })
              if (n % 4 === 2 && rem > 14) {
                // AN OFFLOAD: he is caught but gets it away, and the support man goes on
                const mid: Pt = { x: (B.x + P.x) / 2, y: (B.y + P.y) / 2 }
                sub.push({ k: 'run', to: mid, v: run < 8 ? 6.3 : 8 }, { k: 'offload' }, { k: 'mode', mode: 'carry', anchorOn: -1 }, { k: 'run', to: P, v: 7.4 }, ...tackle)
              } else sub.push({ k: 'run', to: P, v: run < 8 ? 6.3 : 8 }, ...tackle)
            }
          }
          this.steps.splice(this.si, 0, ...sub.map(x => ({ ...x, rate: s.rate })))
          this.entered = false; this.st = 0
          continue
        }
        case 'run': {
          if (first && s.straight) s.to.y = clamp(this.anchor.y, 4, 66)
          const dd = hyp(this.anchor, s.to)
          const mv = Math.min(dd, s.v * dt)
          if (dd > 1e-6) { this.anchor.x += (s.to.x - this.anchor.x) / dd * mv; this.anchor.y += (s.to.y - this.anchor.y) / dd * mv }
          runTo = this.anchor
          this.meet = s.to
          this.st += dt
          const tight = this.mode === 'scrum' || this.mode === 'maul'
          over = (dd < 0.05 && (tight || this.holder < 0 || hyp(this.b[this.holder], this.anchor) < 1.3)) || this.st > 9
          break
        }
      }
      if (!over) break
      this.si++; this.st = 0; this.entered = false
    }
    if (this.si >= this.steps.length) { this.done = true; this.rate = 1 }
    this.ruckT += dt
    this.modeT += dt
    this.clock += dt
    this.move(dt, runTo)
  }

  private move(dt: number, runTo: Pt | null) {
    if (!this.phase) return
    const T = this.targets()
    {
      const k = 1 - Math.exp(-dt / 0.2)
      if (this.tg.length !== 30) this.tg = T.pts.map(q => ({ ...q }))
      for (let i = 0; i < 30; i++) {
        // (a man told exactly where to stand for a pass or a move is not eased)
        if (this.over.has(i)) { this.tg[i].x = T.pts[i].x; this.tg[i].y = T.pts[i].y; continue }
        this.tg[i].x += (T.pts[i].x - this.tg[i].x) * k; this.tg[i].y += (T.pts[i].y - this.tg[i].y) * k
      }
    }
    const tight = this.mode === 'scrum' || this.mode === 'maul'
    const chase = (this.mode === 'kick' && this.phase.label !== 'lp.kickTouch') || this.mode === 'kickoff' || this.mode === 'dropout' || this.mode === 'try'
    const calm = this.mode === 'penalty' || this.mode === 'break' || this.mode === 'con' || this.mode === 'goal'
    for (let i = 0; i < 30; i++) {
      const bd = this.b[i]
      if (this.down[i] > 0) { this.down[i] -= dt; bd.vx *= 0.8; bd.vy *= 0.8; bd.x += bd.vx * dt; bd.y += bd.vy * dt; continue }
      let tx = this.tg[i].x, ty = this.tg[i].y
      if (this.off[i] && i !== this.holder) { tx = 50 + (i < 15 ? -9 : 9) - (i % 15) * 0.2; ty = -2.6 }
      // the man with the ball runs the line being run
      if (runTo && i === this.holder && !tight) { tx = runTo.x; ty = runTo.y }
      ty = clamp(ty, -0.5, 70.5)
      const dx = tx - bd.x, dy = ty - bd.y
      const dist = Math.hypot(dx, dy)
      const fwd = i % 15 < 8
      // a man in front of the ball is out of the game until he is back behind it: he hurries
      const ahead = (this.mode === 'ruck' || this.mode === 'carry') && this.phase != null && (i < 15) === this.phase.homeBall && (bd.x - this.ball.x) * (i < 15 ? 1 : -1) > 1
      const urgent = i === this.holder || this.over.has(i) || chase || dist > 9 || this.rate >= FF || ahead
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
      if (u >= 1) { if (f.toIdx < 0 && !f.silent) this.landed = true; this.flight = null; this.ball.lift = 0; this.holder = f.toIdx; this.grounded = false }
    } else if (this.holder >= 0) {
      this.ball.x = this.b[this.holder].x; this.ball.y = this.b[this.holder].y; this.ball.lift = 0
    } else if (this.grounded) {
      const dx = this.anchor.x + this.spotOff - this.ball.x, dy = this.anchor.y - this.ball.y, dist = Math.hypot(dx, dy)
      const mv = Math.min(dist, (this.mode === 'scrum' ? 4 : 7) * dt)
      if (dist > 1e-6) { this.ball.x += dx / dist * mv; this.ball.y += dy / dist * mv }
    }
  }
}
