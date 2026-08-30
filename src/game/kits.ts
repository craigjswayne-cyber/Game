// Real kit patterns per club (home kits, approximated from club identity).
// Colours come from the club data; the pattern says how they're worn.

import { KIT_QUARTERS, KIT_TRIM } from '../data/kittrim'

export type KitPattern = 'solid' | 'hoops' | 'stripes' | 'quarters' | 'sash' | 'halves'

const KIT_PATTERNS: Record<string, KitPattern> = {
  // Premier Division
  bath: 'hoops',          // blue, white & black hoops
  bristol: 'hoops',      // navy & white hoops, sky pinstripes
  exeter: 'solid',
  gloucester: 'solid',    // cherry & white
  harlequins: 'quarters', // the famous quarters
  leicester: 'hoops',     // green, white & red hoops
  newcastle: 'solid',
  northampton: 'hoops',   // black, green & gold hoops
  sale: 'solid',
  saracens: 'solid',       // 2025-26: black shirt, red accents
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

export function kitPattern(clubId: string): KitPattern {
  return KIT_PATTERNS[clubId] ?? 'solid'
}

/** The third colour, where a club's identity needs one - the gold line at
 *  Northampton's hoops, the sky pinstripe between Bristol's. It lives in
 *  src/data/kittrim.ts with the rest of the club colour data, because that is
 *  what it is; tokenlint holds every OTHER hex in src/ to the theme tokens. */
export function kitTrim(clubId: string): string | undefined {
  return KIT_TRIM[clubId]
}

/** The four colours a quartered club wears, where two were never enough to
 *  describe it. Undefined for everyone else, who quarter their own two. */
export function kitQuarters(clubId: string): [string, string, string, string] | undefined {
  return KIT_QUARTERS[clubId]
}
