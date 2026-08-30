// Real kit patterns per club (home kits, approximated from club identity).
// Colours come from the club data; the pattern says how they're worn.

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

/**
 * ---- THE THIRD COLOUR ----
 *
 * Owner, with four photographs of this season's shirts: "adding a few prem team
 * kits for this season to replicate but not use anything official".
 *
 * Every club here carries exactly two colours, and the thing that makes a real
 * hooped shirt recognisable at a glance is usually the third: the gold line
 * either side of Northampton's hoops, the sky-blue pinstripe between Bristol's,
 * the white that separates Leicester's green from its red. Two colours gave a
 * generic hooped jersey; the trim is what makes it that club's hooped jersey.
 *
 * NOTHING OFFICIAL IS USED OR REPRODUCED. There is no badge, no sponsor, no
 * manufacturer mark and no licensed artwork anywhere in this file or in the SVG
 * that reads it - a crest is a generated shield with a three-letter code on it
 * (components.Crest). What is here is a club's colours and how it wears them,
 * which is the same thing a newspaper league table has always printed.
 *
 * Only clubs whose identity genuinely needs a third colour appear. Everyone
 * else gets undefined and draws exactly as before.
 */
const KIT_TRIM: Record<string, string> = {
  // Premier Division
  bath: '#000000',        // navy and white hoops, edged black
  bristol: '#29a8e0',     // sky pinstripes between the navy and white
  harlequins: '#7fd0f0',  // the light blue among the quarters
  leicester: '#ffffff',   // white between the green and the red
  northampton: '#f2c200', // the gold line at every hoop
  // Elite 14
  la_rochelle: '#ffffff',  // the white line between the yellow and the black
  toulon: '#c8102e',
  // UPC
  cardiff: '#009fdf',
  // Championship
  richmond: '#f2c200',    // old gold, red and black
}

export function kitTrim(clubId: string): string | undefined {
  return KIT_TRIM[clubId]
}
