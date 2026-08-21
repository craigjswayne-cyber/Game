// The tendency window (four pillars, pillar 2).
//
// Five matches of the user's dial settings, written once per settled club
// match and read by opposing analysts. The window answers one question: is
// this manager PREDICTABLE? Being predictable is not having a style - it is
// having a style an analyst can set a training week by. A manager who lives
// at style 80 every week is readable; one who alternates 20 and 80 averages
// 50 and is not readable at all, so the spread has to cut the score or the
// metric lies.
//
// Nothing here draws rng. The window is empty in a fresh world, which keeps
// every calibrated harness (fingerprint, dialweight's canonical career at
// dials 50) reading the exact game it was calibrated on: the analyst only
// wakes when a real manager leans on the dials.
import type { GameState } from './model'
import { clamp } from './rng'

export type TendencyEntry = NonNullable<GameState['tendency']>[number]

const DIALS = ['style', 'tempo', 'kicking', 'aggression', 'defLine', 'defWidth'] as const

/** Record this week's dials, ring-buffered at five. Also walks the per-dial
 *  extremity streaks that price repetition fatigue: a dial held past 75 (or
 *  under 25) match after match is a habit the body pays for. */
export function recordTendency(state: GameState) {
  const t = state.clubs[state.userClubId]?.tactic
  if (!t) return
  const entry: TendencyEntry = {
    season: state.season, week: state.week,
    style: t.style, tempo: t.tempo, kicking: t.kicking, aggression: t.aggression,
    defLine: t.defLine ?? 50, defWidth: t.defWidth ?? 50,
  }
  state.tendency = [...(state.tendency ?? []), entry].slice(-5)

  const streak = (state.dialStreak ??= {})
  for (const k of DIALS) {
    const v = entry[k]
    const s = streak[k] ?? 0
    if (v >= 75) streak[k] = s > 0 ? s + 1 : 1
    else if (v <= 25) streak[k] = s < 0 ? s - 1 : -1
    else streak[k] = s > 0 ? Math.max(0, s - 1) : s < 0 ? Math.min(0, s + 1) : 0
  }
}

export interface TendencyProfile {
  dials: Record<(typeof DIALS)[number], number>
  /** 0 = unreadable, 1 = an analyst's dream */
  predictability: number
  /** the philosophy id the user's habit most resembles, for the COUNTER table */
  pattern: 'pack' | 'width' | 'tempo' | 'squeeze' | 'blitz' | 'counter' | 'chaos' | 'structure' | null
}

/** The analyst's read of the window, or null below three matches of tape. */
export function tendencyProfile(state: GameState): TendencyProfile | null {
  const w = state.tendency ?? []
  if (w.length < 3) return null
  const mean = (k: (typeof DIALS)[number]) => w.reduce((s, m) => s + m[k], 0) / w.length
  const sd = (k: (typeof DIALS)[number]) => {
    const m = mean(k)
    return Math.sqrt(w.reduce((s, x) => s + (x[k] - m) ** 2, 0) / w.length)
  }
  const dials = Object.fromEntries(DIALS.map(k => [k, mean(k)])) as TendencyProfile['dials']
  const extremity = Math.max(...DIALS.map(k => Math.abs(dials[k] - 50))) / 50
  const spread = Math.max(...DIALS.map(sd)) / 25
  const predictability = clamp(extremity * (1 - Math.min(1, spread)), 0, 1)

  // which habit is loudest, in the language the COUNTER table already speaks
  const d = (v: number) => v - 50
  const scores: [TendencyProfile['pattern'], number][] = [
    ['pack', -d(dials.style) + d(dials.aggression) * 0.5],
    ['width', d(dials.style)],
    ['tempo', d(dials.tempo)],
    ['squeeze', d(dials.kicking)],
    ['blitz', d(dials.defLine)],
    ['counter', -d(dials.kicking) * 0.6 + d(dials.tempo) * 0.4],
    ['chaos', d(dials.aggression)],
    ['structure', -d(dials.tempo) * 0.7 - d(dials.aggression) * 0.3],
  ]
  scores.sort((a, b) => b[1] - a[1])
  const pattern = scores[0][1] >= 12 ? scores[0][0] : null
  return { dials, predictability, pattern }
}
