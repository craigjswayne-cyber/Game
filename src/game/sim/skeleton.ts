// THE SKELETON (2.0.0 stage 1, docs/match-sim-spec.md section 3.1).
//
// A whole match played one phase at a time, with no players in it yet: two
// sides, a ball, a place on the field, a clock and the laws. It decides no
// result in the game. Its job is to prove the SHAPE: that a match built this
// way has the rucks, kicks, scrums, lineouts, penalties, tries and minutes of
// ball in play that a real one has (scripts/simshape.ts holds it to the
// numbers in the spec, section 4), and that it never does anything the laws
// forbid: every move goes through the laws machine (law.ts) and an illegal
// one throws.
//
// Stage 2 puts the named players, their attributes and their fatigue into
// the contests below. The constants in K are what gets tuned.
import { mulberry32, type Rng } from '../rng'
import { Laws, type LawEvent } from './law'
import type { KickType, Play, PlayKind, SimResult } from './record'

export interface SkeletonOpts {
  seed: number
  /** each side's strength, 1 for an average side (stage 1 only: stage 2 replaces it with the team sheet) */
  strength?: [number, number]
}

/** every number the shape of a match hangs on, in one place */
export const K = {
  // seconds of ball in play
  CARRY_S: 3.3, RUCK_S: 4.9, KICK_S: 6.2, CATCH_S: 2.2, SCRUM_S: 6, LINEOUT_S: 4, MAUL_S: 9, RESTART_S: 6.5, BREAK_S: 5,
  // seconds of dead time before a restart
  SCRUM_DEAD: 58, SCRUM_RESET_DEAD: 28, LINEOUT_DEAD: 31, PENALTY_DEAD: 18, GOAL_DEAD: 55, TRY_DEAD: 48, CON_DEAD: 48, KICKOFF_DEAD: 22, DROPOUT_DEAD: 24,
  // the decision: how often the side with the ball kicks, by where it is
  KICK_OWN22: 0.45, KICK_OWNHALF: 0.245, KICK_OPPHALF: 0.085, KICK_OPP22: 0.02, KICK_PER_PHASE: 0.012, KICK_PHASE_FROM: 4,
  // the carry
  WIDE: 0.30, GAIN_TIGHT: 2.5, GAIN_TIGHT_SD: 2.4, GAIN_WIDE: 5.2, GAIN_WIDE_SD: 5.2,
  P_BREAK: 0.036, BREAK_MIN: 14, BREAK_SPAN: 40,
  P_KNOCK_ON: 0.042, P_FORWARD: 0.004, P_INTO_TOUCH: 0.011, P_HELD_UP: 0.15,
  // the ruck
  P_TURNOVER: 0.034, P_PEN_ATTACK: 0.028, P_PEN_DEFENCE: 0.017, P_UNPLAYABLE: 0.004,
  // kicks
  P_OUT_FULL: 0.03, P_FIFTY22: 0.012,
  // set pieces
  LINEOUT_WON: 0.87, LINEOUT_STOLEN: 0.07, LINEOUT_NOT_STRAIGHT: 0.025, LINEOUT_PEN: 0.035,
  MAUL_FROM: 30, P_MAUL: 0.45, MAUL_PEN: 0.10, MAUL_STOPPED: 0.07,
  SCRUM_PEN_FEED: 0.085, SCRUM_PEN_AGAINST: 0.045, SCRUM_FREE: 0.035, SCRUM_HEAD: 0.03, SCRUM_RESET: 0.22,
  // penalties
  GOAL_RANGE: 50, GOAL_TAKE: 0.66, PEN_TAP: 0.07, PEN_SCRUM: 0.05, FREE_TAP: 0.55, P_YELLOW_22: 0.13,
  CON_GOOD: 0.77,
  // cards: a man in the bin for ten minutes, and what being a man down costs each contest
  P_YELLOW: 0.05, P_RED: 0.006, BIN_S: 600, SHORT_COST: 0.09,
  // a drop at goal, taken from in range when a possession has gone a few phases; and a kick charged down
  DROP_RANGE: 36, DROP_PHASE: 3, P_DROP: 0.0045, DROP_GOOD: 0.45, P_CHARGE: 0.011,
} as const

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

type Next =
  | { k: 'kickoff'; by: 0 | 1 }
  | { k: 'dropout'; by: 0 | 1; goalLine: boolean }
  | { k: 'scrum'; to: 0 | 1 }
  | { k: 'lineout'; to: 0 | 1 }
  | { k: 'penalty'; to: 0 | 1; free: boolean }
  | { k: 'phase' }
  | { k: 'end' }

export function simSkeleton(o: SkeletonOpts): SimResult {
  const rng: Rng = mulberry32(o.seed)
  const str = o.strength ?? [1, 1]
  const L = new Laws()
  const plays: Play[] = []
  const score: [number, number] = [0, 0], tries: [number, number] = [0, 0]
  let t = 0, half: 0 | 1 = 0
  let ball: 0 | 1 = 0, x = 50, y = 35, phase = 0
  const firstKO: 0 | 1 = rng() < 0.5 ? 0 : 1

  const other = (s: 0 | 1): 0 | 1 => (s === 0 ? 1 : 0)
  /** metres up the field for a side: side 0 plays towards x = 100 */
  const adv = (s: 0 | 1, from: number, m: number) => (s === 0 ? from + m : from - m)
  /** how far a side is from the line it is attacking */
  const toLine = (s: 0 | 1, at: number) => (s === 0 ? 100 - at : at)
  const gauss = (mean: number, sd: number) => {
    const u = Math.max(1e-9, rng()), v = rng()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  /** men in the bin (the clock second each comes back) and men sent off */
  const bin: [number[], number[]] = [[], []]
  const sentOff: [number, number] = [0, 0]
  const short = (s: 0 | 1) => bin[s].filter(u => u > t).length + sentOff[s]
  /** a side's strength now: a man down costs every contest */
  const eff = (s: 0 | 1) => str[s] * Math.max(0.55, 1 - K.SHORT_COST * short(s))
  /** how much stronger a side is than the other, as a small lean on its contests */
  const lean = (s: 0 | 1) => eff(s) / eff(other(s))

  const emit = (kind: PlayKind, side: 0 | 1, result: string, law: LawEvent | null, live: number, dead: number, more?: Partial<Play>) => {
    // (nobody is ever behind a dead-ball line: a man driven back over his own line is held on it)
    x = clamp(x, 0, 100); y = clamp(y, 0, 70)
    if (law && !L.go(law)) throw new Error(`the laws do not allow ${law} (${kind}/${result}) from "${L.state}" at play ${plays.length}`)
    t += live + dead
    plays.push({ n: plays.length, t: Math.round(t), kind, side, ball, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, result, live, dead, score: [score[0], score[1]], ...more })
  }

  /** half-time and full time are blown when the ball next goes dead */
  const whistle = (): Next | null => {
    if (half === 0 && t >= 2400) {
      emit('halfTime', 0, 'halfTime', 'HALF', 0, 0)
      t = 2400; half = 1
      return { k: 'kickoff', by: other(firstKO) }
    }
    if (half === 1 && t >= 4800) { emit('fullTime', 0, 'fullTime', null, 0, 0); return { k: 'end' } }
    return null
  }

  const scoreTry = (s: 0 | 1, how: string): Next => {
    x = s === 0 ? 100 : 0
    score[s] += 5; tries[s]++
    emit('try', s, how, 'TRY', 0, K.TRY_DEAD)
    // the conversion is from in line with where it was scored: out wide is harder
    const wide = Math.abs(y - 35) / 35
    const good = rng() < K.CON_GOOD + 0.16 - wide * 0.34
    if (good) score[s] += 2
    emit('conversion', s, good ? 'over' : 'wide', 'CON', 0, K.CON_DEAD, { good })
    return { k: 'kickoff', by: other(s) }
  }

  const kickoff = (by: 0 | 1): Next => {
    const w = whistle(); if (w) return w
    const rec = other(by)
    x = adv(by, 50, 17 + rng() * 14); y = 8 + rng() * 54; ball = by
    const u = rng()
    emit('kickoff', by, 'kicked', 'KICKOFF', K.RESTART_S, 0, { kick: 'restart' })
    if (u < 0.82) { ball = rec; phase = 1; emit('catch', rec, 'caught', 'PLAY', K.CATCH_S, 0); return { k: 'phase' } }
    if (u < 0.91) { ball = by; phase = 1; emit('catch', by, 'regathered', 'PLAY', K.CATCH_S, 0); return { k: 'phase' } }
    if (u < 0.96) { emit('knockOn', rec, 'underTheRestart', 'STOP', 0, 0); return { k: 'scrum', to: by } }
    // not ten metres, or straight out: a scrum on halfway to the side that did not kick
    x = 50; y = 35
    emit('restartError', by, 'scrumHalfway', 'STOP', 0, 0)
    return { k: 'scrum', to: rec }
  }

  const dropout = (by: 0 | 1, goalLine: boolean): Next => {
    const w = whistle(); if (w) return w
    const from = by === 0 ? (goalLine ? 0 : 22) : (goalLine ? 100 : 78)
    x = adv(by, from, 26 + rng() * 16); y = 8 + rng() * 54; ball = by
    emit(goalLine ? 'goalLineDropout' : 'dropout22', by, 'kicked', 'DROPOUT', K.RESTART_S, 0, { kick: 'restart' })
    // (the dead time is before it: the sides walking back)
    plays[plays.length - 1].dead = K.DROPOUT_DEAD; t += K.DROPOUT_DEAD
    if (rng() < 0.88) { ball = other(by); phase = 1; emit('catch', ball, 'caught', 'PLAY', K.CATCH_S, 0) }
    else { ball = by; phase = 1; emit('catch', by, 'regathered', 'PLAY', K.CATCH_S, 0) }
    return { k: 'phase' }
  }

  const scrum = (to: 0 | 1): Next => {
    const w = whistle(); if (w) return w
    x = clamp(x, 5, 95); y = clamp(y, 15, 55); ball = to
    let dead = K.SCRUM_DEAD
    while (rng() < K.SCRUM_RESET) dead += K.SCRUM_RESET_DEAD
    t += dead
    const u = rng(), feed = lean(to)
    const pf = K.SCRUM_PEN_FEED * feed, pa = K.SCRUM_PEN_AGAINST / feed
    if (u < pf) { emit('scrum', to, 'penaltyWon', 'SCRUM', K.SCRUM_S, 0); return { k: 'penalty', to, free: false } }
    if (u < pf + pa) { emit('scrum', to, 'penaltyLost', 'SCRUM', K.SCRUM_S, 0); return { k: 'penalty', to: other(to), free: false } }
    if (u < pf + pa + K.SCRUM_FREE) { emit('scrum', to, 'freeKick', 'SCRUM', K.SCRUM_S, 0); return { k: 'penalty', to: rng() < 0.5 ? to : other(to), free: true } }
    if (u < pf + pa + K.SCRUM_FREE + K.SCRUM_HEAD / feed) { ball = other(to); phase = 1; emit('scrum', to, 'againstTheHead', 'SCRUM', K.SCRUM_S, 0); return { k: 'phase' } }
    phase = 1
    emit('scrum', to, 'won', 'SCRUM', K.SCRUM_S, 0)
    return { k: 'phase' }
  }

  const lineout = (to: 0 | 1): Next => {
    const w = whistle(); if (w) return w
    x = clamp(x, 5, 95); y = y < 35 ? 0 : 70; ball = to
    t += K.LINEOUT_DEAD
    const u = rng()
    if (u < K.LINEOUT_NOT_STRAIGHT) {
      emit('lineout', to, 'notStraight', 'LINEOUT', K.LINEOUT_S, 0)
      y = y < 35 ? 15 : 55
      emit('notStraight', to, 'scrum', 'STOP', 0, 0)
      return { k: 'scrum', to: other(to) }
    }
    if (u < K.LINEOUT_NOT_STRAIGHT + K.LINEOUT_PEN) {
      emit('lineout', to, 'penalty', 'LINEOUT', K.LINEOUT_S, 0)
      y = y < 35 ? 6 : 64
      return { k: 'penalty', to: rng() < 0.5 ? to : other(to), free: rng() < 0.4 }
    }
    y = y < 35 ? 7 : 63
    if (u < K.LINEOUT_NOT_STRAIGHT + K.LINEOUT_PEN + K.LINEOUT_STOLEN / lean(to)) {
      ball = other(to); phase = 1
      emit('lineout', to, 'stolen', 'LINEOUT', K.LINEOUT_S, 0)
      return { k: 'phase' }
    }
    phase = 1
    emit('lineout', to, 'won', 'LINEOUT', K.LINEOUT_S, 0)
    // close to their line it is driven
    if (toLine(to, x) < K.MAUL_FROM && rng() < K.P_MAUL) {
      const gain = Math.max(0, gauss(5.5 * lean(to), 4))
      x = adv(to, x, gain)
      if (toLine(to, x) <= 0) {
        emit('maul', to, 'driven', 'PLAY', K.MAUL_S, 0, { gain })
        return rng() < K.P_HELD_UP ? heldUp(to) : scoreTry(to, 'maul')
      }
      const m = rng()
      if (m < K.MAUL_PEN) { emit('maul', to, 'pulledDown', 'PLAY', K.MAUL_S, 0, { gain }); return { k: 'penalty', to, free: false } }
      if (m < K.MAUL_PEN + K.MAUL_STOPPED) { emit('maul', to, 'stopped', 'PLAY', K.MAUL_S, 0, { gain }); emit('unplayable', to, 'scrum', 'STOP', 0, 0); return { k: 'scrum', to: other(to) } }
      emit('maul', to, 'ballOut', 'PLAY', K.MAUL_S, 0, { gain })
    }
    return { k: 'phase' }
  }

  const heldUp = (s: 0 | 1): Next => {
    x = s === 0 ? 100 : 0
    emit('heldUp', s, 'heldUp', 'DEAD', 0, 0)
    return { k: 'dropout', by: other(s), goalLine: true }
  }

  const penalty = (to: 0 | 1, free: boolean): Next => {
    const off = other(to)
    ball = to
    emit(free ? 'freeKick' : 'penalty', to, 'awarded', 'PENALTY', 0, K.PENALTY_DEAD)
    const d = toLine(to, x)
    if (!free) {
      const c = rng()
      if (c < K.P_RED) { sentOff[off]++; emit('redCard', off, 'foulPlay', null, 0, 20) }
      else if (c < K.P_RED + K.P_YELLOW + (d < 22 ? K.P_YELLOW_22 : 0)) { bin[off].push(t + K.BIN_S); emit('yellowCard', off, d < 22 ? 'cynical' : 'foulPlay', null, 0, 12) }
    }
    if (free) {
      phase = 1
      if (rng() < K.FREE_TAP) { emit('tap', to, 'tapped', 'PLAY', 2, 0); return { k: 'phase' } }
      return kick(true)
    }
    const u = rng()
    if (d <= K.GOAL_RANGE && u < K.GOAL_TAKE + (d < 30 ? 0.12 : 0)) {
      const wide = Math.abs(y - 35) / 35
      const good = rng() < clamp(0.95 - 0.008 * Math.max(0, d - 15) - wide * 0.16, 0.3, 0.97)
      if (good) { score[to] += 3; emit('penaltyGoal', to, 'over', 'GOAL', 0, K.GOAL_DEAD, { good }); return { k: 'kickoff', by: off } }
      emit('penaltyGoal', to, 'wide', 'GOALMISS', 0, K.GOAL_DEAD, { good })
      return { k: 'dropout', by: off, goalLine: false }
    }
    const v = rng()
    if (v < K.PEN_TAP) { phase = 1; emit('tap', to, 'tapped', 'PLAY', 2, 0); return { k: 'phase' } }
    if (v < K.PEN_TAP + K.PEN_SCRUM && d < 30) return { k: 'scrum', to }
    // to the corner or down the line: their own throw
    const gain = Math.min(d - 5, 22 + rng() * 16)
    x = adv(to, x, Math.max(2, gain)); y = y < 35 ? 0 : 70
    emit('kick', to, 'penaltyToTouch', 'TOUCH', K.KICK_S, 0, { kick: 'touch', gain })
    return { k: 'lineout', to }
  }

  /** a kick from hand by the side with the ball */
  const kick = (fromFree = false): Next => {
    const s = ball, o2 = other(s), d = toLine(s, x), from = x
    const own22 = d > 78
    let type: KickType
    const u = rng()
    if (own22) type = u < 0.68 ? 'clearance' : 'long'
    else if (d > 50) type = u < 0.42 ? 'box' : u < 0.74 ? 'long' : u < 0.90 ? 'upAndUnder' : 'touch'
    else type = u < 0.45 ? 'grubber' : u < 0.80 ? 'upAndUnder' : 'touch'
    const dist = type === 'clearance' ? 28 + rng() * 18 : type === 'long' ? 34 + rng() * 18 : type === 'touch' ? 22 + rng() * 16
      : type === 'grubber' ? 11 + rng() * 10 : 17 + rng() * 11
    // charged down: it comes off a defender's hands and they are on to it first
    if (!fromFree && type !== 'grubber' && rng() < K.P_CHARGE) {
      emit('kick', s, 'chargedDown', 'KICK', K.KICK_S * 0.4, 0, { kick: type })
      x = adv(s, from, -(3 + rng() * 8)); ball = o2; phase = 1
      if (toLine(o2, x) <= 0) return scoreTry(o2, 'chargeDown')
      emit('catch', o2, 'chargeDownRegathered', 'PLAY', K.CATCH_S, 0)
      return { k: 'phase' }
    }
    x = adv(s, from, dist); y = clamp(y + (rng() - 0.5) * 40, 2, 68)
    // over their goal line: dead, or touched down. A 22 drop-out from a long kick, a goal-line one when a short kick is made dead.
    if (toLine(s, x) <= 0) {
      x = s === 0 ? 100 : 0
      emit('kick', s, 'dead', 'KICK', K.KICK_S, 0, { kick: type, gain: dist })
      emit('deadBall', s, type === 'grubber' ? 'touchedDown' : 'ranDead', 'DEAD', 0, 0)
      return { k: 'dropout', by: o2, goalLine: type === 'grubber' }
    }
    const toTouch = type === 'clearance' || type === 'touch'
    if (toTouch) {
      // from outside the 22 it has to bounce: straight out is a lineout back where it was kicked
      if (!own22 && !fromFree && rng() < K.P_OUT_FULL * 4) { x = from; y = y < 35 ? 0 : 70; emit('kick', s, 'outOnFull', 'TOUCH', K.KICK_S, 0, { kick: type }); return { k: 'lineout', to: o2 } }
      y = y < 35 ? 0 : 70
      const fifty = !own22 && d > 50 && toLine(s, x) < 22 && rng() < K.P_FIFTY22 * 8
      emit('kick', s, fifty ? 'fiftyTwentyTwo' : 'touch', 'TOUCH', K.KICK_S, 0, { kick: type, gain: dist })
      return { k: 'lineout', to: fifty ? s : o2 }
    }
    emit('kick', s, 'inPlay', 'KICK', K.KICK_S, 0, { kick: type, gain: dist })
    const v = rng()
    const contest = type === 'box' || type === 'upAndUnder' || type === 'grubber'
    const pCaught = contest ? 0.60 : 0.74, pRegather = contest ? 0.17 * lean(s) : 0.04
    if (v < pCaught) { ball = o2; phase = 1; emit('catch', o2, 'caught', 'PLAY', K.CATCH_S, 0); return { k: 'phase' } }
    if (v < pCaught + pRegather) { ball = s; phase = 1; emit('catch', s, 'regathered', 'PLAY', K.CATCH_S, 0); return { k: 'phase' } }
    if (v < pCaught + pRegather + 0.07) { emit('knockOn', o2, 'underTheHighBall', 'STOP', 0, 0); return { k: 'scrum', to: s } }
    if (v < pCaught + pRegather + 0.11) { emit('knockOn', s, 'inTheChase', 'STOP', 0, 0); return { k: 'scrum', to: o2 } }
    if (v < pCaught + pRegather + 0.135) return { k: 'penalty', to: rng() < 0.6 ? o2 : s, free: false }
    // it bounces into touch
    y = y < 35 ? 0 : 70
    emit('intoTouch', s, 'bounced', 'TOUCH', 0, 0)
    return { k: 'lineout', to: o2 }
  }

  /** one phase of open play */
  const playPhase = (): Next => {
    const s = ball, o2 = other(s), d = toLine(s, x)
    const base = d > 78 ? K.KICK_OWN22 : d > 50 ? K.KICK_OWNHALF : d > 22 ? K.KICK_OPPHALF : K.KICK_OPP22
    if (d <= K.DROP_RANGE && d > 8 && phase >= K.DROP_PHASE && rng() < K.P_DROP) {
      const good = rng() < K.DROP_GOOD - Math.max(0, d - 22) * 0.012
      if (good) { score[s] += 3; emit('dropGoal', s, 'over', 'DROPGOAL', K.KICK_S, 30, { good }); return { k: 'kickoff', by: o2 } }
      emit('dropGoal', s, 'wide', 'DROPMISS', K.KICK_S, 0, { good })
      return { k: 'dropout', by: o2, goalLine: false }
    }
    // (nobody kicks it away on their line: inside ten metres they keep it in hand)
    if (d > 10 && rng() < base + K.KICK_PER_PHASE * Math.max(0, phase - K.KICK_PHASE_FROM)) return kick()
    const wide = rng() < K.WIDE
    let gain = wide ? gauss(K.GAIN_WIDE * lean(s), K.GAIN_WIDE_SD) : gauss(K.GAIN_TIGHT * lean(s), K.GAIN_TIGHT_SD)
    gain = clamp(gain, -5, 22)
    y = clamp(y + (wide ? (rng() < 0.5 ? -1 : 1) * (10 + rng() * 22) : (rng() - 0.5) * 9), wide ? -1 : 4, wide ? 71 : 66)
    const u = rng()
    // out over the touchline with it
    if (wide && (y <= 0 || y >= 70)) {
      if (rng() < 0.45) { x = adv(s, x, Math.max(0, gain)); y = y <= 0 ? 0 : 70; emit('carry', s, 'intoTouch', 'PLAY', K.CARRY_S, 0, { gain, phase }); emit('intoTouch', s, 'carried', 'TOUCH', 0, 0); return { k: 'lineout', to: o2 } }
      y = clamp(y, 3, 67)
    }
    if (u < K.P_KNOCK_ON / Math.sqrt(lean(s))) { emit('carry', s, 'knockedOn', 'PLAY', K.CARRY_S * 0.6, 0, { phase }); emit('knockOn', s, 'inContact', 'STOP', 0, 0); return { k: 'scrum', to: o2 } }
    if (u < K.P_KNOCK_ON + K.P_FORWARD) { emit('carry', s, 'forwardPass', 'PLAY', K.CARRY_S * 0.6, 0, { phase }); emit('forwardPass', s, 'forward', 'STOP', 0, 0); return { k: 'scrum', to: o2 } }
    if (u < K.P_KNOCK_ON + K.P_FORWARD + K.P_BREAK * lean(s)) {
      gain = K.BREAK_MIN + rng() * K.BREAK_SPAN
      x = adv(s, x, gain)
      if (toLine(s, x) <= 0) { emit('lineBreak', s, 'clean', 'PLAY', K.BREAK_S, 0, { gain, phase }); return scoreTry(s, 'break') }
      emit('lineBreak', s, 'hauledDown', 'PLAY', K.BREAK_S, 0, { gain, phase })
    } else {
      x = adv(s, x, gain)
      if (toLine(s, x) >= 99) x = s === 0 ? 1 : 99
      if (toLine(s, x) <= 0) {
        emit('carry', s, 'overTheLine', 'PLAY', K.CARRY_S, 0, { gain, phase })
        return rng() < K.P_HELD_UP ? heldUp(s) : scoreTry(s, wide ? 'wide' : 'close')
      }
      emit('carry', s, gain >= 1 ? 'gainLine' : 'held', 'PLAY', K.CARRY_S, 0, { gain, phase })
    }
    // the breakdown
    const r = rng(), def = 1 / lean(s)
    if (r < K.P_TURNOVER * def) { ball = o2; phase = 1; emit('ruck', s, 'turnover', 'PLAY', K.RUCK_S * 0.7, 0); return { k: 'phase' } }
    if (r < K.P_TURNOVER * def + K.P_PEN_ATTACK) { emit('ruck', s, 'penaltyWon', 'PLAY', K.RUCK_S * 0.7, 0); return { k: 'penalty', to: s, free: false } }
    if (r < K.P_TURNOVER * def + K.P_PEN_ATTACK + K.P_PEN_DEFENCE * def) { emit('ruck', s, 'penaltyLost', 'PLAY', K.RUCK_S * 0.7, 0); return { k: 'penalty', to: o2, free: false } }
    if (r < K.P_TURNOVER * def + K.P_PEN_ATTACK + K.P_PEN_DEFENCE * def + K.P_UNPLAYABLE) { emit('ruck', s, 'unplayable', 'PLAY', K.RUCK_S, 0); emit('unplayable', s, 'scrum', 'STOP', 0, 0); return { k: 'scrum', to: s } }
    emit('ruck', s, 'recycled', 'PLAY', K.RUCK_S, 0, { phase })
    phase++
    return { k: 'phase' }
  }

  let next: Next = { k: 'kickoff', by: firstKO }
  t += K.KICKOFF_DEAD
  for (let guard = 0; guard < 4000 && next.k !== 'end'; guard++) {
    switch (next.k) {
      case 'kickoff': next = kickoff(next.by); break
      case 'dropout': next = dropout(next.by, next.goalLine); break
      case 'scrum': next = scrum(next.to); break
      case 'lineout': next = lineout(next.to); break
      case 'penalty': next = penalty(next.to, next.free); break
      case 'phase': next = playPhase(); break
    }
  }
  return { plays, score, tries }
}
