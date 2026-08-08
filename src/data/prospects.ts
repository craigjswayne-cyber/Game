// Five names hidden in five academies.
//
// At the user's request: one prospect planted in each of these clubs' academy
// squads, for the people who are playing the game to find themselves in it. They
// are ordinary academy men in every mechanical respect - the engine cannot tell
// them from the generated twenty-seven, they take an academy shirt rather than an
// extra one, and they are subject to the same development, the same A League and
// the same promotion decision as anybody else.
//
// They are given a little more in the tank than the academy average (acadQuality
// runs 28-44 plus a rep bonus), because a hidden name nobody would ever promote is
// not much of a find. Nothing else about them is asserted: no nationality claims
// beyond the club's own country, no invented history, no caps.
//
// One name per line, and the position has to be one ACAD_SHAPE actually asks for
// or the man will never be placed.
import type { Pos } from './types'

export interface Prospect {
  name: string
  pos: Pos
  age: number
  /** standing in the academy, not the world: 28-44 is the generated band */
  q: number
  /** goal kicker */
  gk?: boolean
}

export const ACADEMY_PROSPECTS: Record<string, Prospect[]> = {
  bath: [
    { name: 'Harry Logan', pos: 'FL', age: 18, q: 52 },
    { name: 'Alex Logan', pos: 'CE', age: 19, q: 50 },
  ],
  harlequins: [
    { name: 'Christian Kinchin', pos: 'FH', age: 18, q: 53, gk: true },
  ],
  northampton: [
    { name: 'James Fitchew', pos: 'N8', age: 19, q: 52 },
  ],
  saracens: [
    { name: 'Will Roberts', pos: 'SH', age: 18, q: 51 },
  ],
}

/** The prospects planted at a club, or an empty list. */
export function prospectsFor(clubId: string): Prospect[] {
  return ACADEMY_PROSPECTS[clubId] ?? []
}
