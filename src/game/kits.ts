// Real kit patterns per club (home kits, approximated from club identity).
// Colours come from the club data; the pattern says how they're worn.

export type KitPattern = 'solid' | 'hoops' | 'stripes' | 'quarters' | 'sash' | 'halves'

const KIT_PATTERNS: Record<string, KitPattern> = {
  // Premiership
  bath: 'hoops',          // blue, white & black hoops
  bristol: 'solid',
  exeter: 'solid',
  gloucester: 'solid',    // cherry & white
  harlequins: 'quarters', // the famous quarters
  leicester: 'hoops',     // green, white & red hoops
  newcastle: 'solid',
  northampton: 'hoops',   // black, green & gold hoops
  sale: 'solid',
  saracens: 'sash',
  // Top 14
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
  // URC
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
  // Super Rugby Pacific
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
}

export function kitPattern(clubId: string): KitPattern {
  return KIT_PATTERNS[clubId] ?? 'solid'
}
