/**
 * ---- DYNAMIC HIGHLIGHTS (1.8.0) ----
 *
 * The overnight report's second match-day gap against FM Mobile: FM26 shows
 * more highlights in a close game and fewer when a side is out of sight. The
 * ticker's Highlights mode used to stop on the same list whatever the score:
 * every score, card, injury and whistle, and nothing else.
 *
 * Now the margin decides:
 *
 *   always       tries, penalty goals and drop goals, cards, the TMO, the
 *                whistles (HT, the 60-minute break, FT)
 *   close        within a converted try (7), or within two scores (14) in the
 *                last twenty minutes: the BUILD-UP as well - the line before
 *                a try, every entry into the opposition 22, conversions and
 *                injuries
 *   in between   conversions and injuries, as before
 *   a rout       21 points or more: the scores, cards and whistles only
 *
 * The margin read is the one BEFORE the line, so the try that makes it a rout
 * is still shown in full. Reading only the lines already simulated keeps the
 * build-up rule honest: it looks one line ahead, and only when that line exists.
 */
import type { MatchEvent } from './model'

const ALWAYS = new Set<MatchEvent['type']>(['TRY', 'PEN', 'DG', 'YC', 'RC', 'HT', 'BRK', 'FT'])
const USUAL = new Set<MatchEvent['type']>(['CON', 'INJ'])

export type Tension = 'close' | 'normal' | 'rout'

/** How tight the game is going into line i. */
export function tensionAt(events: MatchEvent[], i: number): Tension {
  const prev = i > 0 ? events[i - 1] : null
  const margin = prev ? Math.abs(prev.homeScore - prev.awayScore) : 0
  const min = events[i]?.min ?? 0
  if (margin >= 21) return 'rout'
  if (margin <= 7 || (min >= 60 && margin <= 14)) return 'close'
  return 'normal'
}

/** Is line i worth stopping the Highlights ticker for? homeId says which way
 *  the field runs: fld 0 is the home side's own line, 100 the away side's. */
export function isHighlight(events: MatchEvent[], i: number, homeId: string): boolean {
  const e = events[i]
  if (!e) return false
  if (ALWAYS.has(e.type) || e.fx === 'TMO' || e.fx === 'NOTRY') return true
  const tension = tensionAt(events, i)
  if (tension === 'rout') return false
  if (USUAL.has(e.type)) return true
  if (tension !== 'close') return false
  // the build-up: the line before a try (a penalty goal's build-up is the
  // penalty itself, which is already a line of its own)...
  const next = events[i + 1]
  if (next && next.type === 'TRY') return true
  // ...and a side getting into the opposition 22 (the line before was not)
  if (e.fld != null && e.teamId) {
    const up = (f: number) => e.teamId === homeId ? f : 100 - f
    const prev = events[i - 1]
    if (up(e.fld) >= 78 && !(prev?.fld != null && prev.teamId === e.teamId && up(prev.fld) >= 78)) return true
  }
  return false
}
