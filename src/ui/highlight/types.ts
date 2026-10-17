// What a highlight clip is: its kind, its style, and the spec it is played from.

import type { AtkStyle, DefStyle } from '../clipPlays'

/** 'heldup' (1.9.1): a maul driven over the line and held up, no try */
export type ClipKind = 'try' | 'review' | 'notry' | 'kick' | 'attack' | 'heldup'
/** How the moment is played out, read off the engine's own commentary. */
export type ClipStyle = 'phases' | 'overlap' | 'maul' | 'intercept' | 'chip' | 'grubber' | 'crossfield' | 'charge' | 'move'

export interface ClipSpec {
  kind: ClipKind
  style: ClipStyle
  /** the attacking side runs towards x = 100 (home) or x = 0 (away) */
  attackHome: boolean
  /** ball positions of the build-up, in field metres (x 0..100 home line to away line, y 0..70) */
  beats: { x: number; y: number; line: number; carrier: number }[]
  /** where the moment ends: the grounding, or the kick spot */
  finish: { x: number; y: number; carrier: number }
  /** the event revealed as the moment lands */
  endLine: number
  /** a TMO review line: revealed as the ball goes down, before the verdict */
  reviewLine?: number
  reviewLabel?: string
  kickGood?: boolean
  /** a drop goal, made or missed (1.8.0): struck in open play with the
   *  defence rushing him, not a place kick with them behind the posts */
  drop?: boolean
  /** tacklers the finisher beats on his way (the commentary says how many) */
  misses: number
  /** how an attack that did not score ends */
  ending?: 'saved' | 'turnover'
  label: string
  sub?: string
  att: [string, string]
  def: [string, string]
  /** pace (1..20) by shirt, index 0 = No. 1 (1.8.0, E10): a quick wing pulls
   *  away from the cover and a slow prop is run down. Absent, everyone is 11. */
  attPace?: (number | undefined)[]
  defPace?: (number | undefined)[]
  /** the number printed on each man, by shirt index (1.8.16): absent, i + 1 */
  attNum?: number[]
  defNum?: number[]
  /** THE CALLED MOVE THAT MADE IT (1.8.1, game/moves.ts), read off the try
   *  line's move_k: a strike move is played from its set piece (style
   *  'move'), and a phase-play shape puts the forwards in its pods */
  move?: string
  launch?: 'lineout' | 'scrum' | 'open' | 'tap'
  /** THE STYLES (1.8.2): how the defending side defends and how the
   *  attacking side attacks, from their tactics (clipPlays.ts); absent is
   *  the standard line and plain phase play */
  defStyle?: DefStyle
  atkStyle?: AtkStyle
  /** the pod shape of a pod game ('1331', '242', 'nine'), off the tactic */
  podShape?: string
}

export interface ClipLabels {
  try: string; review: string; notry: string; good: string; wide: string
  turnover: string; saved: string; heldup: string
}
