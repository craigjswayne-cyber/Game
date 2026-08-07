// What the 2025/26 squad guide says the Premiership is, versus what the game has.
//
// A permanent tripwire for task #208: a matchday XV should be fifteen real
// people. Run it after any Premiership data change to see exactly which names
// the guide has that the game does not, and which the game is still carrying
// after the man has left.
import { PREM_2526 } from '../src/data/prem2526'
import { PREM_A } from '../src/data/leagues/prem_a'
import { PREM_B } from '../src/data/leagues/prem_b'

const raw = new Map([...PREM_A, ...PREM_B].map(c => [c.id, c]))

/** Fold accents and punctuation: the game data was typed with them (Julián
 *  Montoya, Rhys Carré, Juan Martín González) and the guide without. Treating
 *  those as different men would throw away researched ratings and re-add the
 *  same player as a stranger. */
const fold = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Same man, different byline. Left is the guide's spelling, right the game's. */
const ALIAS: Record<string, string> = {
  'si mcintyre': 'simon mcintyre',
  'elliot millar mills': 'elliot millar-mills',
  'joseph woodward': 'joe woodward',
  'tommy wyatt': 'tom wyatt',
  'andy onyeama-christie': 'andy christie',
}

// The alias table is written with the hyphens people actually use, so fold its
// keys once here. Looking up a folded name in an unfolded table silently misses:
// "Andy Onyeama-Christie" folds to "andy onyeama christie" and never matches an
// "andy onyeama-christie" key.
const ALIAS_FOLDED = new Map(Object.entries(ALIAS).map(([k, v]) => [fold(k), fold(v)]))
const key = (n: string) => ALIAS_FOLDED.get(fold(n)) ?? fold(n)

let add = 0, drop = 0, matched = 0
const addRows: string[] = []
for (const g of PREM_2526) {
  const club = raw.get(g.id)
  if (!club) { console.log(`${g.id}: NO SUCH CLUB in the game data`); continue }
  const have = new Map(club.players.map(p => [key(p.name), p]))
  const want = new Map(g.players.map(p => [key(p.name), p]))
  const missing = g.players.filter(p => !have.has(key(p.name)))
  const extra = club.players.filter(p => !want.has(key(p.name)))
  add += missing.length; drop += extra.length
  matched += g.players.length - missing.length
  console.log(`\n${g.id}: guide ${g.players.length}, game ${club.players.length}, agreed ${g.players.length - missing.length}`)
  if (missing.length) console.log(`  ADD (${missing.length}): ` + missing.map(p => `${p.name} [${p.pos}]`).join(', '))
  if (extra.length) console.log(`  GONE (${extra.length}): ` + extra.map(p => `${p.name} [${p.pos}]`).join(', '))
  for (const p of missing) addRows.push(`${g.id}\t${p.pos}\t${p.name}`)
}
console.log(`\nguide names already in the game: ${matched}`)
console.log(`to add: ${add}    to remove: ${drop}`)
