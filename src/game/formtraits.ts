// ---- HIDDEN FORM TENDENCIES AND THE FORM TREND (1.8.2) ----
//
// Four tendencies some men carry, derived from (seed, id) exactly as
// attributes.ts derives consistency and big-match nerve: nothing stored,
// nothing drawn from the world's rng, the same save always the same men.
//
//   slow   takes a few matches to reach his level after a lay-off (read off
//          match sharpness, which a lay-off empties and each match refills)
//   iron   recovers condition faster, and a short turnaround does not
//          shorten his week's recovery (season.ts)
//   brit   more likely to be the one hurt when he is tired or rushed back
//          (the match and training injury rolls choose WHO, never how many)
//   conf   two poor marks in a row dent his next match, two good ones lift it
//
// OWNER RULE: these have no names on screen, in any language. What the club
// learns is a sentence in plain words, at the knowledge thresholds temperament.ts
// uses for nerve (readLevel): a hedged read, then a plain one. The internal
// keys above are deliberately terse and appear in no dictionary string
// (scripts/seasonplanprobe.ts renders every string to hold that).
import type { GameState, Player } from './model'
import { mulberry32 } from './rng'
import { readLevel } from './temperament'

export interface FormTraits { slow: boolean; iron: boolean; brit: boolean; conf: boolean }

const roll = (seed: number, id: number, salt: number) =>
  mulberry32((seed ^ Math.imul(id, salt)) >>> 0)()

/** Roughly one man in seven is a slow starter, one in eight an iron constitution,
 *  one in nine brittle (never both of the last two), one in six a confidence
 *  player. Salts differ from attributes.ts so no tendency tracks another. */
export function formTraits(seed: number, id: number): FormTraits {
  const brit = roll(seed, id, 0x27D4EB2F) < 0.11
  return {
    slow: roll(seed, id, 0x165667B1) < 0.14,
    iron: !brit && roll(seed, id, 0x9E3779B9) < 0.12,
    brit,
    conf: roll(seed, id, 0x61C88647) < 0.17,
  }
}

/** Match sharpness under which a slow starter is still finding his feet: a
 *  lay-off returns a man at 40, and each match adds 12, so it takes two. */
const SLOW_SHARP = 62
export const CONF_POOR = 5.0
export const CONF_GOOD = 7.2

/**
 * The match-day multiplier the tendencies add to a man's day (matchEngine
 * teamUnits, the hidden wobble): 1 for anybody without one in play.
 */
export function traitDayF(seed: number, p: Player): number {
  const tr = formTraits(seed, p.id)
  let f = 1
  if (tr.slow && (p.sharp ?? 70) < SLOW_SHARP) f -= 0.05 * Math.min(1, (SLOW_SHARP - (p.sharp ?? 70)) / 22)
  if (tr.conf) {
    const r = p.ratings ?? []
    if (r.length >= 2) {
      const [a, b] = r.slice(-2)
      if (a <= CONF_POOR && b <= CONF_POOR) f -= 0.03
      else if (a >= CONF_GOOD && b >= CONF_GOOD) f += 0.02
    }
  }
  return f
}

/** Extra weekly condition an iron man gets back (season.ts recovery). */
export const IRON_REC = 5

/** How much likelier a brittle man is to be the one hurt, when tired or rushed. */
export function brittleF(seed: number, p: Player, tired: boolean): number {
  if (!formTraits(seed, p.id).brit) return 1
  return tired || (p.rust ?? 0) > 0 || p.cond < 60 ? 2 : 1
}

/**
 * What the staff (your man) or the scouts (anybody else's) can say about his
 * tendencies: i18n keys, hedged at 'vague', plain at 'full', nothing below.
 */
export function traitHints(state: GameState, p: Player): string[] {
  const level = readLevel(state, p)
  if (level !== 'vague' && level !== 'full') return []
  const tr = formTraits(state.seed, p.id)
  const v = level === 'vague'
  const out: string[] = []
  if (tr.slow) out.push(v ? 'player.hintSlowV' : 'player.hintSlow')
  if (tr.iron) out.push(v ? 'player.hintIronV' : 'player.hintIron')
  if (tr.brit) out.push(v ? 'player.hintBritV' : 'player.hintBrit')
  if (tr.conf) out.push(v ? 'player.hintConfV' : 'player.hintConf')
  return out
}

export type FormTrend = 'up' | 'flat' | 'down'

/** Rising, steady or falling, off his last ten match marks (model.ts ratings):
 *  the least-squares slope, a tenth of a mark a match either way. Null under
 *  four marks, where a line through them says nothing. */
export function formTrend(p: Pick<Player, 'ratings'>): FormTrend | null {
  const r = p.ratings ?? []
  const n = r.length
  if (n < 4) return null
  const mx = (n - 1) / 2
  const my = r.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  r.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2 })
  const slope = num / den
  return slope >= 0.1 ? 'up' : slope <= -0.1 ? 'down' : 'flat'
}
