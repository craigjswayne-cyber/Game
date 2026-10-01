import type { GameState, Personality, Player } from './model'
import { bigMatchTemper } from './attributes'
import { mulberry32 } from './rng'

/**
 * ---- READING THE ROOM (owner, round 4) ----
 *
 * "The impact of a speech should be quite important. The manager needs to
 * judge the room and this should impact performance. Go too big against the
 * wrong team and the team misfires. But get it right and you can cause an
 * upset or deliver the win. It should be balanced and affect players' moods.
 * FM Mobile is the example I'd go with."
 *
 * Before this module a talk was a flat multiplier on the whole side, the same
 * for every man in the room, and two of the eight options rolled the shared
 * match dice to decide whether they landed. Now every man hears it.
 *
 * ONE AXIS, READ PER MAN: how he is carrying himself into this game, from
 * frozen (-1) through settled (0) to too comfortable or too wound up (+1).
 * What sets it is the game in front of him (are we favourites, at home, is it
 * a big day, and at half time the scoreline), his morale and form, and who he
 * is: the hidden big-match nerve, his age and his character. A man performs
 * best settled; the further from 0 he sits, the more of his game he leaves
 * in the dressing room.
 *
 * A TONE MOVES MEN ALONG THAT AXIS. Calm draws everybody a little towards
 * settled and never hurts. "No pressure" and faith lift belief: right for a
 * frightened underdog, wrong for favourites who already think it is won.
 * Demanding and criticising raise the stakes: right for a complacent room,
 * a collapse in belief for a nervous one. Firing them up is the biggest lift
 * and the riskiest: it wakes a flat side and tips a confident one over into
 * complacency and indiscipline. How far each man moves depends on who he is
 * (a Temperamental man swings, a Professional barely moves) and on how much
 * of the room is listening to the manager at all (trust and standing).
 *
 * WHAT IT IS WORTH. A man's reaction is how much closer to settled the talk
 * left him: positive if it helped, negative if it pushed him the wrong way.
 * It becomes a per-man multiplier on everything he does in the match (the
 * engine folds it into the same match-day factor as his hidden consistency),
 * capped at TALK_CAP either way, so a perfectly judged talk is worth a few
 * per cent across the side and never outweighs the squad. Men pushed past
 * the edge (too wound up, too comfortable) also give away cards.
 *
 * DETERMINISTIC AND DRAW-FREE. Nothing here touches the match rng. The only
 * per-man variation is a hash of (seed, fixture, man), so a resumed or
 * replayed match hears the same talk the same way, and the AI's matches are
 * byte-identical to the world before this module (the AI side's talk is the
 * engine's calibrated baseline, which is why it has no layer of its own).
 */

export type PreTone = 'calm' | 'faith' | 'underdog' | 'expect' | 'fire'
export type HtTone = 'calm' | 'faith' | 'praise' | 'demand' | 'criticise' | 'fire'
export type Tone = PreTone | HtTone

export const PRE_TONES: PreTone[] = ['calm', 'faith', 'underdog', 'expect', 'fire']
export const HT_TONES: HtTone[] = ['calm', 'faith', 'praise', 'demand', 'criticise', 'fire']

/** The game in front of the room, as the manager can read it too. */
export interface TalkSetting {
  /** -1 heavy underdogs .. +1 heavy favourites, home advantage included */
  exp: number
  home: boolean
  /** a final, a knockout stage or a derby */
  big: boolean
  /** half time only: our score minus theirs */
  margin?: number
}

/** Per-man multiplier ceiling, either way. */
export const TALK_CAP = 0.08
/** reaction -> multiplier slope: a reaction of +1 is worth +TALK_K_UP, one
 *  of -1 costs TALK_K_DOWN. The engine gives back less for a lift than it
 *  takes for a slump (measured, scripts/teamtalkprobe.ts), so the upside is
 *  set a little steeper to keep a well-judged talk worth having. */
const TALK_K_UP = 0.13
const TALK_K_DOWN = 0.1
/** how much of the pre-match reaction is still in the legs after the break */
export const PRE_CARRY = 0.5
/** where an unspoken-to room sits, below settled, before kick-off and at the break */
const PRE_FLAT = 0.3
const HT_FLAT = 0.15

export function talkSetting(myOverall: number, oppOverall: number, home: boolean, big: boolean, margin?: number): TalkSetting {
  const ratio = oppOverall > 0 ? myOverall / oppOverall : 1
  const exp = Math.max(-1, Math.min(1, (ratio - 1) * 7 + (home ? 0.12 : -0.12)))
  return { exp, home, big, margin }
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** -1..1, fixed for this man and this fixture */
const wobble = (seed: number, fxId: number, pid: number, salt: number) =>
  mulberry32((seed ^ Math.imul(fxId + salt, 0x85EBCA6B) ^ Math.imul(pid, 0x27D4EB2F)) >>> 0)() * 2 - 1

/** How far a man's state amplifies away from settled, by character. */
const VOLATILITY: Record<Personality, number> = {
  Temperamental: 1.3, Ambitious: 1.05, Loyal: 1, Mercenary: 0.95, Leader: 0.8, Professional: 0.7,
}
/** How far a talk moves him, by character. */
const SENS: Record<Personality, number> = {
  Temperamental: 1.35, Ambitious: 1.05, Loyal: 1, Mercenary: 0.75, Leader: 0.85, Professional: 0.7,
}

/** Where a man sits before anyone speaks: -1 frozen .. 0 settled .. +1 too comfortable. */
export function baseState(state: GameState, p: Player, s: TalkSetting, fxId: number): number {
  const moraleT = clampN((p.morale - 6.5) / 2.5, -1.4, 1.2)
  const formT = clampN((p.form - 6.5) / 1.5, -1, 1)
  let c: number
  if (s.margin == null) {
    // before anyone speaks a room sits a little flat (PRE_FLAT): an even
    // game is one a talk can lift, favourites drift towards comfortable and
    // underdogs towards frozen
    c = 0.7 * s.exp + 0.28 * moraleT + 0.1 * formT - PRE_FLAT
  } else {
    // at the break the scoreline has the loudest voice: a side twenty up is
    // talking about the bus home, one fifteen down is looking at its boots
    const m = clampN(s.margin / 12, -1.3, 1.3)
    c = 0.3 * s.exp + 0.5 * m + 0.2 * moraleT - HT_FLAT
  }
  // the big day: the hidden nerve decides who freezes and who grows
  if (s.big) c += 0.22 * Math.min(0, bigMatchTemper(state.seed, p.id)) - 0.05
  // the young feel it; the old hands have seen it all
  if (p.age <= 21) c -= 0.08
  c *= VOLATILITY[p.pers] ?? 1
  if (p.age >= 31) c *= 0.85
  c += 0.24 * wobble(state.seed, fxId, p.id, s.margin == null ? 0 : 7)
  return clampN(c, -1.4, 1.4)
}

/** A stakes-raising tone's push: proportional pull back from comfortable,
 *  a fixed weight added below settled, heavier the lower he already is. */
const stakes = (c: number, pull: number, floor: number, weight: number) =>
  c > 0 ? -pull * c - floor : -weight + 0.4 * c

/** The raw push a tone gives a man at state c, before his character and the room's trust. */
function push(tone: Tone, c: number, s: TalkSetting, p: Player): { d: number; credibility: number } {
  const winning = (s.margin ?? 0) > 0
  switch (tone) {
    // settles everybody a little, both ways, and can never push past settled
    case 'calm': return { d: -0.42 * c, credibility: 0 }
    case 'faith': return { d: 0.36 * (p.pers === 'Loyal' ? 1.25 : p.pers === 'Mercenary' ? 0.6 : 1), credibility: 0 }
    // "nobody rates us": frees an underdog, and favourites know it is not true
    case 'underdog': return { d: 0.5, credibility: s.exp > 0.25 ? -0.12 * s.exp : 0 }
    case 'praise': return { d: winning ? 0.42 : 0.2, credibility: winning ? 0 : -0.18 }
    // raising the stakes: the cure for complacency, poison for nerves. The
    // further above settled a man sits the harder it pulls him back; below
    // settled it only adds weight (a driven man takes a demand better)
    case 'expect': return { d: stakes(c, 0.6, 0.1, 0.32) * (p.pers === 'Ambitious' || p.pers === 'Leader' ? 0.8 : 1), credibility: 0 }
    case 'demand': return { d: stakes(c, 0.55, 0.08, 0.26) * (p.pers === 'Ambitious' || p.pers === 'Leader' ? 0.8 : 1), credibility: 0 }
    case 'criticise': return { d: stakes(c, 0.85, 0.15, 0.6), credibility: 0 }
    // the biggest lift and the riskiest: it wakes a flat man, tips a
    // comfortable one over, and is too much for a frightened one
    case 'fire': {
      const d = 0.62 * (p.pers === 'Temperamental' ? 1.25 : 1)
      return c < -0.45 ? { d: d * 0.5, credibility: -0.12 } : { d, credibility: 0 }
    }
  }
}

export interface TalkRead {
  pid: number
  /** his state before the talk and after it */
  before: number
  after: number
  /** how much closer to settled it left him: + helped, - hurt */
  r: number
  /** what the manager sees: a plain-words reaction and which way it went */
  k: string
  tone: 'good' | 'ok' | 'low'
  dir: 1 | 0 | -1
  /** pushed over the edge: gives away penalties and cards */
  hot: boolean
}

/** A man's reaction in plain words. Never a number, never a trait name. */
function reactionKey(p: Player, before: number, after: number, r: number, tone: Tone): { k: string; tone: TalkRead['tone']; dir: TalkRead['dir'] } {
  if (r >= 0.12) {
    if (after > 0.3) return { k: 'tt.rMotivated', tone: 'good', dir: 1 }
    if (after < -0.3) return { k: 'tt.rSteadier', tone: 'ok', dir: 1 }
    if (r >= 0.3) return { k: 'tt.rDetermined', tone: 'good', dir: 1 }
    return { k: before < -0.25 ? 'tt.rBelieves' : 'tt.rFocused', tone: 'good', dir: 1 }
  }
  if (r > -0.12) {
    if (after > 0.65) return { k: 'tt.rComplacent', tone: 'low', dir: 0 }
    if (after < -0.65) return { k: p.morale < 5 ? 'tt.rNoBelief' : 'tt.rNervous', tone: 'low', dir: 0 }
    // a man already settled has nothing to be moved towards
    if (Math.abs(after) < 0.2) return { k: 'tt.rReady', tone: 'good', dir: 0 }
    return { k: 'tt.rUnmoved', tone: 'ok', dir: 0 }
  }
  if (after > 0.55) {
    return { k: tone === 'fire' || (p.pers === 'Temperamental' && after > before) ? 'tt.rWoundUp' : 'tt.rComplacent', tone: 'low', dir: -1 }
  }
  if (after < -0.55) return { k: p.morale < 5 || after < -1 ? 'tt.rNoBelief' : 'tt.rNervous', tone: 'low', dir: -1 }
  return { k: 'tt.rUnconvinced', tone: 'low', dir: -1 }
}

/**
 * Every man's reaction to one tone. `listen` is how much of the room hears
 * the manager (0..1, trust times standing); a rookie still moves them, just
 * less, which is why it is folded in as half fixed and half earned.
 */
export function talkReads(
  state: GameState, ids: (number | null)[], s: TalkSetting, tone: Tone, fxId: number, listen: number,
  carry?: Map<number, number>,
): TalkRead[] {
  const heard = 0.5 + 0.5 * clampN(listen, 0, 1)
  const out: TalkRead[] = []
  for (const id of ids) {
    if (id == null) continue
    const p = state.players[id]
    if (!p) continue
    // at the break, what the pre-match talk left in him is still there
    const before = clampN(baseState(state, p, s, fxId) + PRE_CARRY * (carry?.get(id) ?? 0), -1.5, 1.5)
    const { d, credibility } = push(tone, before, s, p)
    // and how much any manager's words get through to him at all: hidden,
    // fixed for the man, the thing a manager learns by watching him react
    let sens = (SENS[p.pers] ?? 1) * heard * (0.7 + 0.6 * (wobble(state.seed, 0, p.id, 0x3C6E) + 1) / 2)
    if (p.age <= 21) sens *= 1.15
    else if (p.age >= 31) sens *= 0.85
    const after = before + d * sens
    const r = clampN(Math.abs(before) - Math.abs(after) + credibility * heard, -1, 1)
    const hot = after > 0.75
    const rk = reactionKey(p, before, after, r, tone)
    out.push({ pid: id, before, after, r, hot, ...rk })
  }
  return out
}

/** The room before anyone speaks, in the same words the reactions use. */
export function roomMood(before: number, p: Player): { k: string; tone: 'good' | 'ok' | 'low' } {
  if (p.cond < 72) return { k: 'mood.leggy', tone: 'low' }
  if (before > 0.65) return { k: 'mood.tooComfortable', tone: 'low' }
  if (before > 0.3) return { k: 'mood.believes', tone: 'good' }
  if (before > -0.3) return { k: p.morale >= 6.8 ? 'mood.eager' : 'mood.balanced', tone: before > -0.1 ? 'good' : 'ok' }
  if (before > -0.65) return { k: 'mood.nervous', tone: 'low' }
  return { k: 'mood.lowConfidence', tone: 'low' }
}

/** A reaction as a match-day multiplier on the man, capped. */
export function talkFactor(r: number): number {
  return 1 + clampN(r * (r > 0 ? TALK_K_UP : TALK_K_DOWN), -TALK_CAP, TALK_CAP)
}

/** How the room took it, overall: what the summary line says. */
export function roomVerdict(reads: TalkRead[]): 'good' | 'mixed' | 'bad' {
  if (!reads.length) return 'mixed'
  const m = reads.reduce((a, x) => a + x.r, 0) / reads.length
  return m >= 0.12 ? 'good' : m <= -0.08 ? 'bad' : 'mixed'
}

/** The share of the room tipped over the edge. */
export function hotShare(reads: TalkRead[]): number {
  return reads.length ? reads.filter(x => x.hot).length / reads.length : 0
}

/** The tone a sensible manager picks for this room: the one that leaves the
 *  most men closest to settled. The probe's "best", the AI's choice. */
export function bestTone<T extends Tone>(tones: readonly T[], state: GameState, ids: (number | null)[], s: TalkSetting, fxId: number, listen: number, carry?: Map<number, number>): T {
  let best = tones[0], bv = -Infinity
  for (const tn of tones) {
    const v = talkReads(state, ids, s, tn, fxId, listen, carry).reduce((a, x) => a + x.r, 0)
    if (v > bv) { bv = v; best = tn }
  }
  return best
}

/** Morale a man takes home from how the talk landed (and how the day went). */
export function talkMorale(r: number, won: boolean): number {
  return clampN(r * (won ? 0.7 : 0.45), -0.4, 0.4)
}
