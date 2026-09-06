/**
 * ---- PREMIERSHIP WOMEN'S RUGBY (England), 2025-26 ----
 *
 * The nine clubs, their real towns, their real grounds under the same renaming
 * rules the men's database follows (docs/ip-rename-map.md): the plain place name
 * plus RFC, sponsor marks stripped, grounds a near-miss of the real one. Quins
 * and Sarries keep the terrace short forms the owner restored in v1.0.3, because
 * the same club is the same club in either game.
 *
 * Ids carry the w: prefix from src/game/gender.ts. A women's world and a men's
 * world are never in memory together, so the prefix is not preventing a
 * collision - it is there so that if the separation is ever broken, the break is
 * legible instead of silent.
 *
 * ---- WHICH PLAYERS ARE REAL ----
 *
 * The owner asked for real players, as the men's database has. The men's 1,560
 * were compiled from sources. This session could not do the same: the
 * environment's network policy blocks Wikipedia and the rugby press, so squads
 * could not be read, only searched. Rather than invent 300 names and present
 * them as a real league, this file does what src/data/leagues/champ.ts and
 * natl1.ts already do for the English second and third tiers - it names the
 * players it can stand behind and generates honest depth around them.
 *
 * REAL, and verified this session against club and international sources:
 * the eleven internationals in REAL below, each at the club she played for in
 * 2025-26. Everyone else in this file is generated: a plausible squad from the
 * women's name pools in nations.ts, deterministic from the club id, in the
 * quality band the club deserves. No generated player takes a real player's
 * name - scripts/namedup.ts proves it for this league exactly as it does for
 * the men's.
 *
 * Filling in the other ~280 is a data pass, not an engineering one. It needs
 * either a network that can reach the sources or the owner's own list, and it
 * can be done a club at a time without touching a line of code.
 */
import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'
import { W } from '../../game/gender'

/**
 * Real players, by club id.
 *
 * Verified: name, position and club for the 2025-26 season. Quality is judged on
 * the same 1-100 scale the men's database uses, read WITHIN the women's game -
 * a 90 here is a world-class Test player, the same as a 90 there, because the
 * engine compares a squad only against the squads it actually plays.
 */
const REAL: Record<string, RawPlayer[]> = {
  saracens: [
    { name: 'Marlie Packer', pos: 'FL', age: 36, nat: 'ENG', q: 89, intl: true },
    { name: 'Jess Breach', pos: 'WG', age: 28, nat: 'ENG', q: 88, intl: true },
    { name: 'Kelsey Clifford', pos: 'LP', age: 23, nat: 'ENG', q: 82, intl: true },
    { name: 'May Campbell', pos: 'HK', age: 27, nat: 'ENG', q: 76, intl: true },
    { name: 'Jodie Verghese', pos: 'FL', alt: ['N8'], age: 25, nat: 'ENG', q: 71 },
  ],
  glosharty: [
    { name: 'Zoe Aldcroft', pos: 'LK', alt: ['FL'], age: 29, nat: 'ENG', q: 90, intl: true },
    { name: 'Alex Matthews', pos: 'N8', alt: ['FL'], age: 32, nat: 'ENG', q: 88, intl: true },
    { name: 'Maud Muir', pos: 'TP', age: 25, nat: 'ENG', q: 85, intl: true },
    { name: 'Mackenzie Carson', pos: 'LK', age: 29, nat: 'ENG', q: 80, intl: true },
  ],
  quins: [
    { name: 'Ellie Kildunne', pos: 'FB', age: 26, nat: 'ENG', q: 91, gk: true, intl: true },
    { name: 'Connie Powell', pos: 'HK', age: 26, nat: 'ENG', q: 79, intl: true },
  ],
}

/** A PWR matchday squad is smaller than a men's Premiership one, and the
 *  competition is semi-professional: thirty-two, two deep everywhere and three
 *  in the back row, which is where the injuries land. */
const TEMPLATE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH', 'CE', 'CE', 'CE',
  'WG', 'WG', 'WG', 'FB', 'FB',
  'LP', 'HK', 'LK', 'FL', 'CE', 'WG',
]

/** One name per player across the whole competition. The world builder keeps
 *  only the first of a duplicate, so a clash costs the second club a shirt. */
const usedNames = new Set<string>()

function squad(clubId: string, rep: number): RawPlayer[] {
  const real = REAL[clubId] ?? []
  const out: RawPlayer[] = [...real]
  for (const p of real) usedNames.add(p.name)

  // the real players already fill some of the shirts; generate the rest
  const need = [...TEMPLATE]
  for (const p of real) {
    const i = need.indexOf(p.pos)
    if (i >= 0) need.splice(i, 1)
  }

  const rng = mulberry32(0x5715 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  let gkGiven = out.some(p => p.gk) ? 1 : 0
  for (const pos of need) {
    let name = ''
    for (let tries = 0; tries < 24; tries++) {
      name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)
    const age = 18 + Math.floor(rng() * 16)
    // PWR is a wide league: a title side carries internationals and students in
    // the same changing room, so the spread inside a club is deliberately broad.
    let q = Math.round(rep - 16 + rng() * 22)
    if (rng() < 0.08) q += 8 // the one nobody has called up yet
    q = Math.max(38, Math.min(84, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.55
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: 'ENG', q, gk })
  }
  return out
}

/** First names for generated English players. Surnames come from LAST below;
 *  both are checked by scripts/namedup.ts against the real database. */
const FIRST = [
  'Alice', 'Beatrice', 'Bryony', 'Cerys', 'Daisy', 'Edith', 'Eleanor', 'Esme',
  'Flora', 'Freya', 'Georgia', 'Harriet', 'Imogen', 'Isla', 'Jemima', 'Josie',
  'Kitty', 'Lottie', 'Maisie', 'Martha', 'Matilda', 'Nell', 'Nancy', 'Orla',
  'Phoebe', 'Primrose', 'Rosalind', 'Rowena', 'Saskia', 'Sybil', 'Tamsin', 'Thea',
  'Verity', 'Wilhelmina', 'Winnie', 'Bea', 'Clemmie', 'Delphine', 'Etta', 'Greta',
]

const LAST = [
  'Ashby', 'Barnes', 'Beckworth', 'Bell', 'Brampton', 'Cawthorne', 'Clark', 'Cooper',
  'Fairhurst', 'Fenwick', 'Grimsdale', 'Hemsley', 'Hill', 'Hollis', 'Ilkeston', 'Kerridge',
  'Lindsey', 'Ludgate', 'Mowbray', 'Netherwood', 'Ollerton', 'Pemberton', 'Rainford', 'Selby',
  'Smith', 'Sowerby', 'Taylor', 'Thackeray', 'Turner', 'Walker', 'Ward', 'Whitfield',
  'Adlington', 'Bramhall', 'Carsley', 'Doverdale', 'Elmswood', 'Farrington', 'Halstead', 'Ingoldsby',
]

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id: W + id, name, short, city, country: 'ENG', stadium, capacity, colors, rep, budget,
  players: squad(id, rep),
})

/**
 * Budgets are the women's game as it really is, not the men's numbers scaled.
 * PWR runs to a salary cap in the low hundreds of thousands and most of these
 * clubs are the women's arm of a men's professional club, funded by it. A
 * Premiership men's budget in this league would break the transfer market
 * inside one season.
 */
export const W_PWR: RawClub[] = [
  club('glosharty', 'Gloucester RFC', 'Gloucester', 'Gloucester', 'Gillmore’s Ground', 3000, ['#8b1a2b', '#0e1c3d'], 88, 380_000),
  club('saracens', 'Sarries RFC', 'Sarries', 'London', 'Hendon Park', 5000, ['#0e0e0e', '#c02f3a'], 87, 375_000),
  club('bristol', 'Bristol RFC', 'Bristol', 'Bristol', 'Shaftsbury Park', 2000, ['#0a2240', '#c02f3a'], 80, 300_000),
  club('quins', 'Quins Rugby', 'Quins', 'London', 'Little Twickenham', 5500, ['#0a1e3c', '#7b2d8e'], 79, 295_000),
  club('trailfinders', 'Ealing RFC', 'Ealing', 'London', 'Ealing Sports Ground', 2500, ['#0e5a3a', '#ffffff'], 76, 270_000),
  club('exeter', 'Exeter RFC', 'Exeter', 'Exeter', 'Beachy Park', 3500, ['#0e0e0e', '#c9a227'], 74, 255_000),
  club('loughborough', 'Loughborough RFC', 'Loughboro', 'Loughborough', 'Loughborough Park', 3000, ['#3b1d6e', '#c9a227'], 71, 230_000),
  club('leicester', 'Leicester RFC', 'Leicester', 'Leicester', 'Welford Street', 4000, ['#0a5c36', '#c02f3a'], 67, 200_000),
  club('sale', 'Sale RFC', 'Sale', 'Sale', 'Heywood Road', 2500, ['#12295c', '#ffffff'], 63, 180_000),
]
