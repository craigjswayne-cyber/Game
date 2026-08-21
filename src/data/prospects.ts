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
  /**
   * A floor on potential, for a genuine prospect rather than a solid academy man.
   *
   * buildPlayer gives an 18-year-old q + 12 to 25, so a q of 52 lands somewhere in
   * the mid 60s to mid 70s depending on the name's own hash. That is a good
   * academy player. A rising star is a different claim, and the honest way to make
   * it is a high ceiling on a modest current ability rather than a high current
   * ability - a boy who is already the finished article is not rising.
   *
   * Applied as a floor, not an assignment, so a lucky roll is never taken away.
   */
  pa?: number
}

export const ACADEMY_PROSPECTS: Record<string, Prospect[]> = {
  bath: [
    { name: 'Harry Logan', pos: 'FL', age: 18, q: 52 },
    { name: 'Alex Logan', pos: 'CE', age: 19, q: 50 },
    // a 10 and a rising star: modest now, a ceiling worth clearing a shirt for
    { name: 'Mark Dunkley', pos: 'FH', age: 18, q: 54, gk: true, pa: 88 },
  ],
  harlequins: [
    { name: 'Christian Kinchin', pos: 'FH', age: 18, q: 53, gk: true },
  ],
  northampton: [
    { name: 'James Fitchew', pos: 'N8', age: 19, q: 52 },
    // ACAD_SHAPE asks for two N8s, so this one sits alongside Fitchew rather
    // than taking his place
    { name: 'Duncan Swayne', pos: 'N8', age: 18, q: 52 },
    // The Senior Academy from the club's own published 2026/27 squad list
    // (user's screenshot of the official announcement, round 27). Positions
    // are fitted to the shirts ACAD_SHAPE has open - both N8 shirts belong
    // to the two names above. Aidan Pugh is the one list name not here: the
    // shape holds two scrum-halves and the list carries three, so he takes
    // the third senior 9 shirt instead. Quality sits at the top of the
    // academy band - these are the names the club printed, not hidden finds.
    { name: 'Noah Buxton', pos: 'LP', age: 19, q: 50 },
    { name: 'Oliver Scola', pos: 'LP', age: 18, q: 49 },
    { name: 'Aiden Reid', pos: 'TP', age: 19, q: 50 },
    { name: 'Sonny Tonga\'uiha', pos: 'TP', age: 18, q: 50 },
    // an England age-grade name with a real ceiling: the honest claim is
    // potential, not a finished article
    { name: 'Aiden Ainsworth-Cave', pos: 'LK', age: 19, q: 53, pa: 80 },
    { name: 'George Tonga\'uiha', pos: 'LK', age: 18, q: 49 },
    { name: 'Jack Lewis', pos: 'FL', age: 19, q: 49 },
    { name: 'Alex Mead', pos: 'FL', age: 18, q: 49 },
    { name: 'Charlie Ulcoq', pos: 'FL', age: 19, q: 50 },
    { name: 'Sonny Goode', pos: 'SH', age: 18, q: 50 },
    { name: 'Jonny Weimann', pos: 'SH', age: 19, q: 49 },
    { name: 'Hugh Shields', pos: 'FH', age: 19, q: 51, gk: true },
    { name: 'Henry Lumley', pos: 'CE', age: 19, q: 50 },
    { name: 'Freddie St John', pos: 'CE', age: 18, q: 49 },
    { name: 'James Pater', pos: 'WG', age: 19, q: 49 },
    { name: 'Charlie Tamani', pos: 'WG', age: 18, q: 50 },
    { name: 'Thomas Rowe', pos: 'FB', age: 19, q: 50 },
  ],
  saracens: [
    { name: 'Will Roberts', pos: 'SH', age: 18, q: 51 },
    { name: 'Shaun Little', pos: 'WG', age: 19, q: 51 },
  ],
}

/** The prospects planted at a club, or an empty list. */
export function prospectsFor(clubId: string): Prospect[] {
  return ACADEMY_PROSPECTS[clubId] ?? []
}
