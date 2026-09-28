// Real rugby rivalries. Derby matches: packed houses, tighter margins,
// hotter tempers, and results that echo louder in the boardroom.

const PAIRS: [string, string, string][] = [
  // Premier Division
  ['leicester', 'northampton', 'The East Midlands Derby'],
  ['bath', 'gloucester', 'The West Country Derby'],
  ['bath', 'bristol', 'The West Country Clash'],
  ['saracens', 'harlequins', 'The London Derby'],
  ['sale', 'newcastle', 'The Northern Derby'],
  // Elite 14
  ['toulouse', 'stade_francais', 'Le Classico'],
  ['racing92', 'stade_francais', 'The Paris Derby'],
  ['toulouse', 'castres', 'The Occitanie Derby'],
  ['bayonne', 'pau', 'The Derby de l\'Adour'],
  ['montpellier', 'perpignan', 'The Mediterranean Derby'],
  ['clermont', 'lyon', 'The Rhône Derby'],
  // UPC
  ['leinster', 'munster', 'The Irish Derby'],
  ['ulster', 'connacht', 'The North-West Derby'],
  ['glasgow', 'edinburgh', 'The Scottish Derby'],
  ['cardiff', 'scarlets', 'The Welsh Derby'],
  ['ospreys', 'scarlets', 'The West Wales Derby'],
  ['bulls', 'stormers', 'The North-South Derby'],
  ['sharks', 'lions', 'The Coastal Derby'],
  ['benetton', 'zebre', 'The Italian Derby'],
  // Championship
  ['richmond', 'lscottish', 'The Oldest Fixture - the Richmond Derby'],
  ['ealing', 'richmond', 'The West London Derby'],
  // Pacific Championship
  ['blues', 'chiefs', 'The North Island Derby'],
  ['crusaders', 'highlanders', 'The South Island Derby'],
  ['blues', 'moana', 'The Auckland Derby'],
  ['reds', 'waratahs', 'The Border Battle'],
  ['brumbies', 'waratahs', 'The Capital Clash'],
  // THE WOMEN'S GAME HAS DERBIES TOO. Its clubs carry the w: prefix, and this
  // list only held men's ids, so no women's match was ever a derby: no derby
  // week, no derby premium, no derby nerves, no boardroom swing. The pairs are
  // the ones the women's world actually holds, under the names the men's
  // fixtures use where the two cities are the same.
  ['w:saracens', 'w:quins', 'The London Derby'],
  ['w:trailfinders', 'w:quins', 'The West London Derby'],
  ['w:bristol', 'w:glosharty', 'The West Country Derby'],
  ['w:leicester', 'w:loughborough', 'The East Midlands Derby'],
  ['w:toulouse', 'w:blagnac', 'The Toulouse Derby'],
  ['w:montpellier', 'w:toulon', 'The Mediterranean Derby'],
  ['w:wolfhounds', 'w:clovers', 'The Irish Derby'],
  ['w:glasgow', 'w:edinburgh', 'The Scottish Derby'],
  ['w:gwalia', 'w:brython', 'The Welsh Derby'],
  ['w:blues', 'w:chiefs', 'The North Island Derby'],
  ['w:reds', 'w:waratahs', 'The Border Battle'],
  ['w:brumbies', 'w:waratahs', 'The Capital Clash'],
  ['w:sfparis', 'w:rcfrance', 'The Paris Derby'],
  ['w:bathw', 'w:nbristol', 'The West Country Clash'],
]

const KEY = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
const MAP = new Map(PAIRS.map(([a, b, name]) => [KEY(a, b), name]))

export function derbyName(a: string, b: string): string | null {
  return MAP.get(KEY(a, b)) ?? null
}

export const isDerby = (a: string, b: string) => MAP.has(KEY(a, b))

/** Every club this club shares a derby with. */
export function rivalsOf(clubId: string): string[] {
  return PAIRS.filter(([a, b]) => a === clubId || b === clubId)
    .map(([a, b]) => (a === clubId ? b : a))
}
