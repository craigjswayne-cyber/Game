// The opposing coach (four pillars, pillar 2): the anti-exploit engine.
//
// Until now every AI dugout played its philosophy every week, forever. That
// is the exploit: find the one plan that beats a static league and run it
// until May. This module gives some of those dugouts eyes.
//
// Three archetypes, assigned deterministically from the club id, so a given
// save always faces the same characters:
//   STUBBORN (~45%)  reads nothing. Plays its philosophy. The control group,
//                    and the reason varied play is a choice rather than a tax.
//   ANALYST  (~35%)  reads your last three to five matches and shifts its
//                    STARTING plan toward the counter to your habit.
//   REACTIVE (~20%)  reads the match in front of it and changes the picture
//                    from the touchline, at most twice.
//
// STREAM DISCIPLINE, the rule everything here obeys: not one rng draw. Every
// adjustment is a deterministic multiplier layered onto unit ratings via the
// same layer() the referee and the team talks use. In a fresh world the
// tendency window is empty and every dial sits at 50, so nothing here fires
// and the fingerprint reads the exact game it was calibrated on - the
// analyst only wakes when a real manager leans on the dials.
import type { GameState } from './model'
import { hashString, mulberry32 } from './rng'
import { tendencyProfile, type TendencyProfile } from './tendency'
import { COUNTER } from './philosophy'

export type Archetype = 'stubborn' | 'analyst' | 'reactive'

/**
 * How likely a dugout is to be each archetype, as a function of club stature.
 *
 * Design review, wave 2: "the best dugouts read you fastest" - the counter-
 * adaptation pillar already existed but every club drew from the same urn, so
 * a National One minnow was exactly as likely to field an analyst as Toulouse.
 * Tying the mix to reputation makes the climb up the leagues a climb into
 * sharper opposition, which is the difficulty curve the design review asked
 * for and the one this game never had: not bigger numbers, smarter minds.
 *
 * A straight line in rep between the two ends of the real club pool (measured
 * 38..93 across every league), clamped past either end. The endpoints are
 * chosen so they still sum to 1 with no renormalising:
 *   rep 38 (the weakest club in the game): 85% stubborn, 10% analyst, 5% reactive
 *   rep 93 (the strongest):                 8% stubborn, 46% analyst, 46% reactive
 * A rep-86 Premier Division giant sits at roughly 18/41/41 - the "almost
 * exclusively" a sharp dugout the review called for, without a discontinuity
 * anywhere the manager could feel as a cliff-edge.
 */
export function archetypeWeights(rep: number): { stubborn: number; analyst: number; reactive: number } {
  const t = Math.max(0, Math.min(1, (rep - 38) / (93 - 38)))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return { stubborn: lerp(0.85, 0.08), analyst: lerp(0.10, 0.46), reactive: lerp(0.05, 0.46) }
}

/** Which kind of coach lives in this dugout. Hash of the club id: stable for
 *  the life of a save, different across clubs, no rng consumed. `rep` weights
 *  the odds (archetypeWeights) - pass the club's actual reputation; callers
 *  with no club record (a Test dugout) fall back to a strong-club default,
 *  because international rugby is the pinnacle and should be read sharply. */
export function archetypeOf(clubId: string, rep = 78): Archetype {
  const r = mulberry32(hashString(`${clubId}:dugout`))()
  const w = archetypeWeights(rep)
  return r < w.stubborn ? 'stubborn' : r < w.stubborn + w.analyst ? 'analyst' : 'reactive'
}

/** The dial-to-unit coefficient table. MUST MATCH applyModifiers in
 *  matchEngine.ts term for term - the analyst's shift is "move the dials
 *  toward the counter", expressed as the ratio between the shifted and the
 *  unshifted dial factor so it can be layered without touching the club's
 *  saved tactic. If applyModifiers gains or changes a term, change it here
 *  in the same commit. */
const f = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) - 50 : 0) / 50
function dialFactor(unit: 'attack' | 'scrum' | 'breakdown' | 'kicking' | 'defence' | 'tempo',
  d: { style: number; tempo: number; kicking: number; aggression: number }): number {
  switch (unit) {
    case 'attack': return 1 + f(d.style) * 0.06 + f(d.tempo) * 0.05 - f(d.kicking) * 0.035
    case 'scrum': return 1 - f(d.style) * 0.05
    case 'breakdown': return 1 + f(d.aggression) * 0.06 - f(d.style) * 0.03 - f(d.kicking) * 0.02
    case 'kicking': return 1 + f(d.kicking) * 0.1
    case 'defence': return 1 - f(d.tempo) * 0.03
    case 'tempo': return 1 + f(d.tempo) * 0.22
  }
}

export interface AnalystShift {
  /** multiplier per unit, ready for layer() */
  layers: Partial<Record<'attack' | 'scrum' | 'breakdown' | 'kicking' | 'defence' | 'tempo', number>>
  /** how far toward the counter the plan moved, 0..0.45 */
  pull: number
  pattern: NonNullable<TendencyProfile['pattern']>
}

/** The analyst's homework: shift the AI side's starting plan toward the
 *  counter to the user's habit. Three things bound it, and all three matter:
 *  predictability (varied play is genuinely unreadable), the club's own
 *  analysis department (a National 1 dugout is not Toulouse's), and a hard
 *  ceiling - it can never fully mirror you. */
export function analystShift(state: GameState, clubId: string): AnalystShift | null {
  if (archetypeOf(clubId, state.clubs[clubId]?.rep ?? 78) !== 'analyst') return null
  const prof = tendencyProfile(state)
  if (!prof || !prof.pattern) return null
  const counter = COUNTER[prof.pattern]
  if (!counter) return null
  const club = state.clubs[clubId]
  if (!club) return null
  const skill = Math.max(0.5, Math.min(0.95, club.rep / 100))
  const pull = prof.predictability * skill * 0.45
  if (pull < 0.05) return null
  const own = club.tactic
  const shifted = {
    style: own.style + (counter.dials.style - own.style) * pull,
    tempo: own.tempo + (counter.dials.tempo - own.tempo) * pull,
    kicking: own.kicking + (counter.dials.kicking - own.kicking) * pull,
    aggression: own.aggression + (counter.dials.aggression - own.aggression) * pull,
  }
  const layers: AnalystShift['layers'] = {}
  for (const u of ['attack', 'scrum', 'breakdown', 'kicking', 'defence', 'tempo'] as const) {
    const ratio = dialFactor(u, shifted) / dialFactor(u, own)
    if (Math.abs(ratio - 1) > 0.0005) layers[u] = ratio
  }
  return Object.keys(layers).length ? { layers, pull, pattern: prof.pattern } : null
}

/** What the touchline sees when the analyst's plan is in effect. */
export const PATTERN_WORD: Record<NonNullable<TendencyProfile['pattern']>, string> = {
  pack: 'your forward game',
  width: 'your wide attack',
  tempo: 'your quick-ruck tempo',
  squeeze: 'your kicking game',
  blitz: 'your rush defence',
  counter: 'your counter-attack',
  chaos: 'your loose, physical game',
  structure: 'your structured phases',
}

/** The user's loudest current habit, for the reactive coach's live read. */
export function loudestDial(t: { style: number; tempo: number; kicking: number; aggression: number }): { dial: 'style' | 'tempo' | 'kicking' | 'aggression'; v: number } | null {
  const list = (['style', 'tempo', 'kicking', 'aggression'] as const)
    .map(dial => ({ dial, v: t[dial] }))
    .sort((a, b) => Math.abs(b.v - 50) - Math.abs(a.v - 50))
  return Math.abs(list[0].v - 50) >= 20 ? list[0] : null
}

/** Repetition fatigue (pillar 2's physical half): a high-intensity habit -
 *  tempo, physicality or a rush defence held past 75 match after match -
 *  costs three per cent extra petrol per consecutive match beyond the first,
 *  capped at twelve. Two matches of variety walk it back (the streaks decay
 *  in tendency.ts). User side only: an AI philosophy is a fixed identity,
 *  not a weekly choice, and taxing it would just shift the world's balance. */
export function repetitionFatigue(state: GameState): number {
  const s = state.dialStreak ?? {}
  const worst = Math.max(0,
    (s.tempo ?? 0) - 1, (s.aggression ?? 0) - 1, (s.defLine ?? 0) - 1)
  return 1 + Math.min(0.12, worst * 0.03)
}
