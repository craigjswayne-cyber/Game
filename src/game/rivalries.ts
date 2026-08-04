// Real rugby rivalries. Derby matches: packed houses, tighter margins,
// hotter tempers, and results that echo louder in the boardroom.

const PAIRS: [string, string, string][] = [
  // Premiership
  ['leicester', 'northampton', 'The East Midlands Derby'],
  ['bath', 'gloucester', 'The West Country Derby'],
  ['bath', 'bristol', 'The Heineken West Derby'],
  ['saracens', 'harlequins', 'The London Derby'],
  ['sale', 'newcastle', 'The Northern Derby'],
  // Top 14
  ['toulouse', 'stade_francais', 'Le Classico'],
  ['racing92', 'stade_francais', 'The Paris Derby'],
  ['toulouse', 'castres', 'The Occitanie Derby'],
  ['bayonne', 'pau', 'The Derby de l\'Adour'],
  ['montpellier', 'perpignan', 'The Mediterranean Derby'],
  ['clermont', 'lyon', 'The Rhône Derby'],
  // URC
  ['leinster', 'munster', 'The Irish Derby'],
  ['ulster', 'connacht', 'The North-West Derby'],
  ['glasgow', 'edinburgh', 'The 1872 Cup'],
  ['cardiff', 'scarlets', 'The Welsh Derby'],
  ['ospreys', 'scarlets', 'The West Wales Derby'],
  ['bulls', 'stormers', 'The North-South Derby'],
  ['sharks', 'lions', 'The Currie Cup Rivalry'],
  ['benetton', 'zebre', 'The Italian Derby'],
  // Championship
  ['richmond', 'lscottish', 'The Oldest Fixture - the Richmond Derby'],
  ['ealing', 'richmond', 'The West London Derby'],
  // Super Rugby Pacific
  ['blues', 'chiefs', 'The North Island Derby'],
  ['crusaders', 'highlanders', 'The South Island Derby'],
  ['blues', 'moana', 'The Auckland Derby'],
  ['reds', 'waratahs', 'The Border Battle'],
  ['brumbies', 'waratahs', 'The Capital Clash'],
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
