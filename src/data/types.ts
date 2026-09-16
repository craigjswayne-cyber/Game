// ---------------------------------------------------------------
// Raw database schema. Data files under src/data/leagues/ contain
// real-world clubs, stadiums and 2025-26 squads in this shape.
// The engine expands RawPlayer.q (1-100 quality) into full
// CM-style 1-20 attribute sets deterministically at new-game time.
// ---------------------------------------------------------------

/** Position codes, front row to full back. */
export type Pos =
  | 'LP' // loosehead prop
  | 'HK' // hooker
  | 'TP' // tighthead prop
  | 'LK' // lock / second row
  | 'FL' // flanker
  | 'N8' // number 8
  | 'SH' // scrum-half
  | 'FH' // fly-half
  | 'CE' // centre
  | 'WG' // wing
  | 'FB' // full-back

export interface RawPlayer {
  /** Full real name */
  name: string
  /** Primary position */
  pos: Pos
  /** Secondary positions, if genuinely played */
  alt?: Pos[]
  /** Age at the start of the 2025-26 season (whole years) */
  age: number
  /** Nationality: 3-letter code (ENG, FRA, IRE, SCO, WAL, ITA, NZL, AUS, RSA, ARG, FIJ, SAM, TGA, JPN, GEO, USA, URU, ESP, POR, NAM, CHL, ROU) */
  nat: string
  /** Overall quality 1-100. 90+ world class, 80-89 international, 70-79 solid pro, 60-69 squad player, <60 fringe/academy */
  q: number
  /** Recognised first-choice goal kicker at the club */
  gk?: boolean
  /** Current or recent test international */
  intl?: boolean
  /**
   * TRUE IF THIS NAME IS INVENTED, absent if the name is a real player's.
   *
   * The real/generated split used to exist only as a sentence at the top of
   * each data file plus a convention that a club's real players come first.
   * Prose cannot be checked, so it drifted: w_champ.ts was born claiming ALL
   * 600 PLAYERS ARE GENERATED in its header while its own per-club comments
   * claimed 98 of them were real, and docs/womens-game.md carried a third set
   * of numbers again. Nothing could tell which was true because nothing in the
   * data said anything at all.
   *
   * So the claim now lives on the row it is about, and scripts/genprobe.ts
   * holds every league's counts against it. Absent means real, because a real
   * name is the normal case and the 1,255 of them stay untouched; the 841
   * invented ones carry the flag. A row that gains or loses one without the
   * probe's table being updated in the same commit fails the suite.
   */
  gen?: true
}

export interface RawClub {
  /** Stable slug id, e.g. 'leicester' */
  id: string
  /** Full club name */
  name: string
  /** Short display name, <= 12 chars */
  short: string
  /** Home city/town */
  city: string
  /** 3-letter country code */
  country: string
  /** Real home stadium name */
  stadium: string
  /** Real stadium capacity */
  capacity: number
  /** [primary, secondary] hex colours from club identity */
  colors: [string, string]
  /** Club reputation 1-100 within world rugby */
  rep: number
  /** Season transfer budget in pounds */
  budget: number
  /** Senior squad, 28-32 players covering all positions */
  players: RawPlayer[]
}

export interface RawLeague {
  id: string
  name: string
  short: string
  /** 3-letter country code, or 'EUR'/'INT' for cross-border */
  country: string
  /** League reputation 1-100 */
  rep: number
  clubs: RawClub[]
}
