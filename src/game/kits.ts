// Real kit patterns per club (home kits, approximated from club identity).
// Colours come from the club data; the pattern says how they're worn.

import { KIT_CYCLE, KIT_HOOPS, KIT_QUARTERS, KIT_SLEEVES, KIT_TRIM } from '../data/kittrim'
import { W } from './gender'

/** 'yoke' is a contrasting shoulder-and-chest panel over a plain body with
 *  side panels in the trim colour (Exeter, 2026-27). 'flank' is a plain body
 *  with side panels and sleeve edging in the second colour (Sale). Both came
 *  from the owner's photographs of this season's shirts, v1.2.5. */
export type KitPattern = 'solid' | 'hoops' | 'stripes' | 'quarters' | 'sash' | 'halves' | 'yoke' | 'flank'

const KIT_PATTERNS: Record<string, KitPattern> = {
  // Premier Division
  bath: 'hoops',          // blue, white & black hoops
  bristol: 'hoops',      // navy & white hoops, sky pinstripes
  exeter: 'yoke',        // white yoke on black, light-blue side panels
  gloucester: 'hoops',    // cherry & white hoops
  harlequins: 'quarters', // the famous quarters
  leicester: 'solid',     // green body, red sleeves, white cuff (2026-27)
  newcastle: 'solid',
  northampton: 'hoops',   // black, green & gold hoops
  sale: 'flank',          // navy, orange side panels and cuffs
  saracens: 'solid',       // all black, gold trim (owner, v1.2.6)
  // Elite 14
  toulouse: 'hoops',      // red & black
  bordeaux: 'sash',       // navy with claret
  la_rochelle: 'stripes', // yellow & black
  clermont: 'solid',      // yellow, blue trim
  toulon: 'halves',       // red & black
  racing92: 'hoops',      // sky & white hoops
  stade_francais: 'solid',// the pink
  castres: 'stripes',     // blue & white
  bayonne: 'solid',
  lyon: 'sash',
  montpellier: 'solid',
  pau: 'hoops',           // green & white
  perpignan: 'halves',    // sang et or
  montauban: 'sash',
  // UPC
  leinster: 'solid',
  munster: 'solid',
  ulster: 'solid',
  connacht: 'solid',
  glasgow: 'solid',
  edinburgh: 'sash',
  benetton: 'hoops',      // green & white
  zebre: 'stripes',
  bulls: 'solid',
  stormers: 'solid',
  sharks: 'solid',
  lions: 'solid',
  cardiff: 'hoops',       // blue & black hoops
  ospreys: 'solid',
  scarlets: 'solid',
  dragons: 'solid',
  // Pacific Championship
  blues: 'solid',
  chiefs: 'sash',         // black with yellow
  crusaders: 'hoops',     // red & black
  highlanders: 'sash',
  hurricanes: 'sash',
  moana: 'solid',
  brumbies: 'solid',
  reds: 'solid',
  waratahs: 'solid',
  force: 'sash',
  drua: 'solid',
  // Championship
  pirates: 'hoops',       // black & gold hoops
  coventry: 'hoops',      // blue & white hoops
  bedford: 'hoops',       // the Blues' hoops
  richmond: 'hoops',      // old gold, red & black
  lscottish: 'solid',
  ealing: 'solid',
  doncaster: 'solid',
  nottingham: 'solid',
  hartpury: 'solid',
  cambridge: 'solid',
  chinnor: 'solid',
  caldy: 'hoops',         // navy & sky
}

/**
 * ---- A CLUB WEARS THE SAME SHIRT IN BOTH GAMES ----
 *
 * Every table in kittrim.ts is keyed by the MEN'S club id, and the women's
 * world ids all carry the "w:" prefix - so women's Bristol had no sky
 * pinstripe, women's Quins had no quarters and women's Bath had no hoops. Same
 * clubs, same colours after this release, and until now three different shirts.
 * Owner: "quins, sarries, Bristol, Exeter, sale jerseys and badges should be
 * the same in the womens game as they are in the mens games."
 *
 * Stripping the prefix covers most of them. Three do not line up by name and
 * are listed: the women's side of Harlequins is `quins` where the men's is
 * `harlequins`, Gloucester-Hartpury is `glosharty`, and the Championship Bath
 * is `bathw` because plain `bath` was taken.
 *
 * A women's club with no men's twin - Ealing, Loughborough, every Championship
 * side - resolves to an id the tables do not hold, and gets exactly what it got
 * before: the default. That is the safe direction and needs no list.
 */
const WOMENS_TWIN: Record<string, string> = {
  quins: 'harlequins',
  glosharty: 'gloucester',
  bathw: 'bath',
}

function kitKey(clubId: string): string {
  if (!clubId.startsWith(W)) return clubId
  const bare = clubId.slice(W.length)
  return WOMENS_TWIN[bare] ?? bare
}

export function kitPattern(clubId: string): KitPattern {
  return KIT_PATTERNS[kitKey(clubId)] ?? 'solid'
}

/** The third colour, where a club's identity needs one - the gold line at
 *  Northampton's hoops, the sky pinstripe between Bristol's. It lives in
 *  src/data/kittrim.ts with the rest of the club colour data, because that is
 *  what it is; tokenlint holds every OTHER hex in src/ to the theme tokens. */
export function kitTrim(clubId: string): string | undefined {
  return KIT_TRIM[kitKey(clubId)]
}

/** The four colours a quartered club wears, where two were never enough to
 *  describe it. Undefined for everyone else, who quarter their own two. */
export function kitQuarters(clubId: string): [string, string, string, string] | undefined {
  return KIT_QUARTERS[kitKey(clubId)]
}

/** How a club wears its hoops: how many, and how thick. Three broad bands
 *  unless the club says otherwise - see KIT_HOOPS. */
export function kitHoops(clubId: string): { n: number; h: number } {
  return KIT_HOOPS[kitKey(clubId)] ?? { n: 3, h: 4 }
}

/** Whether this club states its own hoop geometry, rather than taking the
 *  default three. The crest drawing needs the question separately from the
 *  answer, and it must go through kitKey like everything else. */
export function hasHoopRow(clubId: string): boolean {
  return KIT_HOOPS[kitKey(clubId)] !== undefined
}

/** The bands of an all-hoop shirt, top to bottom, in rotation - Bath's white,
 *  blue and black. Undefined for a club whose shirt has a ground colour. */
export function kitCycle(clubId: string): string[] | undefined {
  return KIT_CYCLE[kitKey(clubId)]
}

/** Left and right sleeve, where a club's two do not match (Quins). */
export function kitSleeves(clubId: string): [string, string] | undefined {
  return KIT_SLEEVES[kitKey(clubId)]
}
