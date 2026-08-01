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
