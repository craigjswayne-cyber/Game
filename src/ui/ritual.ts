// WHERE THEY STAND FOR THE CHALLENGE (1.9.16).
//
// Owner: "when you face nz or a nation that does a pre match ritual they
// should be in the formations that set up in for it not just a straight
// line". The four sides in the game that lay one down (natcolours.ts: NZL,
// FIJ, SAM, TGA, the women's sides under the same codes) each get the shape
// they take, and the side facing it the shape a side facing it takes.
//
// The ground rules are World Rugby's own (the match commissioner's notes on
// cultural challenges): the side performing stays behind its own ten-metre
// line, the side receiving stays behind halfway, and where both perform one
// may come up to halfway while the other stays behind its ten, so there are
// always ten metres between them.
//
// A shape and nothing more: no words of any challenge are written anywhere,
// and each is named only by its name. Drawing only, no dice: the one bit of
// looseness (Samoa's rows) is a fixed pattern, the same every time.

/** a man's spot: metres across the field (0..70) and metres back from
 *  halfway into his own half */
export interface RitualSpot { x: number; back: number }

export const RITUAL_WIDTH = 70
/** the performing side's own ten-metre line */
export const RITUAL_FRONT = 10
/** how near halfway the facing line's ends stand */
export const FACING_FRONT = 1.5

/** the codes with a formation of their own */
export const RITUAL_SHAPES = ['NZL', 'FIJ', 'SAM', 'TGA'] as const
export type RitualShape = typeof RITUAL_SHAPES[number]
export const hasRitualShape = (code: string): code is RitualShape => (RITUAL_SHAPES as readonly string[]).includes(code)

interface Shape {
  /** men in each row, front row first, for 23 and for 15 */
  rows: { 23: number[]; 15: number[] }
  /** metres between men in a row, and between rows */
  dx: number; dy: number
  /** the leader stands alone in front (the first "row" is him) */
  lone?: boolean
  /** rows that do not line up: a fixed nudge, in metres */
  loose?: number
}

const SHAPES: Record<RitualShape, Shape> = {
  // the haka: an arrowhead, the leader at its point
  NZL: { rows: { 23: [1, 2, 3, 4, 6, 7], 15: [1, 2, 3, 4, 5] }, dx: 3, dy: 2.7, lone: true },
  // the Cibi: a tight block, row behind row
  FIJ: { rows: { 23: [5, 6, 6, 6], 15: [5, 5, 5] }, dx: 2.4, dy: 2.5 },
  // the Siva Tau: loose rows, the leader out in front
  SAM: { rows: { 23: [1, 7, 8, 7], 15: [1, 4, 5, 5] }, dx: 3.3, dy: 3.2, lone: true, loose: 0.35 },
  // the Sipi Tau: a broad block in rows
  TGA: { rows: { 23: [7, 8, 8], 15: [7, 8] }, dx: 2.8, dy: 3 },
}

/** a fixed -1..1 for a man, so a loose row is loose the same way every time */
const nudge = (i: number, salt: number) => { const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return (s - Math.floor(s)) * 2 - 1 }

/**
 * The side laying down the challenge. Index 0 is the leader: the point of the
 * arrowhead, the man out in front, or the middle of the front row. `front` is
 * how far back from halfway the front man stands (the ten-metre line, or just
 * short of halfway for the side that won the toss when both perform).
 */
export function ritualFormation(code: string, n: 15 | 23 = 23, front = RITUAL_FRONT): RitualSpot[] {
  const sh = hasRitualShape(code) ? SHAPES[code] : SHAPES.TGA
  const mid = RITUAL_WIDTH / 2
  const out: RitualSpot[] = []
  sh.rows[n].forEach((count, r) => {
    const row: RitualSpot[] = []
    for (let k = 0; k < count; k++) {
      const i = out.length + row.length
      const lone = !!sh.lone && r === 0
      row.push({
        x: mid + (k - (count - 1) / 2) * sh.dx + (sh.loose && !lone ? nudge(i, 1) * sh.loose : 0),
        back: front + r * sh.dy + (sh.loose && !lone ? nudge(i, 2) * sh.loose : 0),
      })
    }
    // the leader first: the middle man of the front row
    if (r === 0 && row.length > 1) row.unshift(...row.splice((row.length - 1) >> 1, 1))
    out.push(...row)
  })
  return out
}

/**
 * The side facing it: one line arm in arm just behind halfway, in a shallow
 * arc with the middle a pace or two deeper than the ends. Left to right, so
 * index k is the k-th man along the line.
 */
export function facingLine(n: 15 | 23 = 23, front = FACING_FRONT): RitualSpot[] {
  const dx = 2.6, half = (n - 1) / 2
  return Array.from({ length: n }, (_, k) => {
    const u = (k - half) / half
    return { x: RITUAL_WIDTH / 2 + (k - half) * dx, back: front + 2.4 * (1 - u * u) }
  })
}
