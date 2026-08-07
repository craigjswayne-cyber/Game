// Merge the 2025/26 Premiership squad guide into the game's own data files.
//
// src/data/prem2526.ts is the guide: names, positions, and every self-conflict
// resolved. This adds what the game is missing, drops the men who have left, and
// keeps the researched age, nationality, rating, alternative positions, cap and
// goalkicker flags for the 214 players both agree on. Nothing already researched
// is thrown away and nothing is renamed.
//
// The 151 new men need an age, a nationality and a rating, and the guide carries
// none of those - it says so itself. They are written by hand below, on the same
// scale the files already use: a Premiership first-choice sits 72 to 84, a
// full international 78 to 88, a squad man 64 to 72, an academy graduate 58 to 64.
// Ages are 2025/26 season ages. Where a man's real rugby nation is not one the
// game knows (Zimbabwe has no entry) he takes the nation he plays his club rugby
// in, which is what the flag beside his name is for.
//
// Run: npx tsx scripts/premmerge.ts        (writes prem_a.ts and prem_b.ts)
//      npx tsx scripts/premmerge.ts --dry  (prints what it would do)
import { readFileSync, writeFileSync } from 'node:fs'
import { PREM_2526 } from '../src/data/prem2526'
import { PREM_A } from '../src/data/leagues/prem_a'
import { PREM_B } from '../src/data/leagues/prem_b'
import type { Pos } from '../src/game/model'

interface New { pos: Pos; alt?: Pos[]; age: number; nat: string; q: number; intl?: boolean; gk?: boolean }

/** The 151. Keyed on the guide's spelling of the name. */
const NEW: Record<string, New> = {
  // ---- Bath
  'Dan Frost': { pos: 'HK', age: 30, nat: 'ENG', q: 73 },
  'Jasper Spandler': { pos: 'HK', age: 21, nat: 'ENG', q: 62 },
  'Mikey Summerfield': { pos: 'TP', alt: ['LP'], age: 22, nat: 'ENG', q: 63 },
  'Kieran Verden': { pos: 'LP', age: 24, nat: 'ENG', q: 65 },
  'Quinn Roux': { pos: 'LK', age: 34, nat: 'IRE', q: 72 },
  'Thompson Cowan': { pos: 'FL', age: 22, nat: 'ENG', q: 63 },
  'Ethan Staddon': { pos: 'FL', alt: ['N8'], age: 22, nat: 'ENG', q: 64 },
  'Neil Le Roux': { pos: 'SH', age: 24, nat: 'RSA', q: 66 },
  'Bernard van der Linde': { pos: 'SH', age: 25, nat: 'RSA', q: 68 },
  'Ciaran Donoghue': { pos: 'FH', alt: ['FB'], age: 24, nat: 'IRE', q: 68, gk: true },
  'Sam Harris': { pos: 'FH', age: 22, nat: 'ENG', q: 64, gk: true },
  'Chris Harris': { pos: 'CE', age: 35, nat: 'SCO', q: 78, intl: true },
  'Louie Hennessey': { pos: 'CE', alt: ['WG'], age: 22, nat: 'ENG', q: 68 },
  'Henry Arundell': { pos: 'WG', alt: ['FB'], age: 23, nat: 'ENG', q: 84, intl: true },
  'Santiago Carreras': { pos: 'FB', alt: ['FH', 'WG'], age: 27, nat: 'ARG', q: 82, intl: true, gk: true },
  'Austin Emens': { pos: 'WG', age: 21, nat: 'ENG', q: 62 },

  // ---- Bristol
  'Sam Grahamslaw': { pos: 'LP', alt: ['TP'], age: 27, nat: 'SCO', q: 68 },
  'Lovejoy Chawatama': { pos: 'TP', age: 38, nat: 'ENG', q: 68 },
  'Joe Owen': { pos: 'LK', age: 23, nat: 'WAL', q: 65 },
  'Steele Barker': { pos: 'LK', alt: ['FL'], age: 24, nat: 'ENG', q: 66 },
  'Pedro Rubiolo': { pos: 'LK', age: 25, nat: 'ARG', q: 77, intl: true },
  'Luka Ivanishvili': { pos: 'FL', alt: ['N8'], age: 24, nat: 'GEO', q: 70, intl: true },
  'Sam Wolstenholme': { pos: 'SH', age: 25, nat: 'ENG', q: 67 },
  'Max Pepper': { pos: 'SH', age: 22, nat: 'ENG', q: 63 },
  'Tom Jordan': { pos: 'FH', alt: ['CE', 'FB'], age: 27, nat: 'SCO', q: 80, intl: true, gk: true },
  'Joe Jenkins': { pos: 'CE', age: 24, nat: 'ENG', q: 66 },
  'Louis Rees-Zammit': { pos: 'WG', age: 24, nat: 'WAL', q: 84, intl: true },
  'Benjamin Elizalde': { pos: 'WG', alt: ['FB'], age: 23, nat: 'ARG', q: 68 },

  // ---- Exeter
  'Joe Bailey': { pos: 'LP', alt: ['TP'], age: 22, nat: 'ENG', q: 64 },
  'Will Goodrick-Clarke': { pos: 'TP', age: 26, nat: 'ENG', q: 70 },
  'Scott Sio': { pos: 'LP', age: 34, nat: 'AUS', q: 74, intl: true },
  'Khwezi Mona': { pos: 'TP', age: 26, nat: 'RSA', q: 70 },
  'Nika Abuladze': { pos: 'LP', alt: ['TP'], age: 25, nat: 'GEO', q: 72, intl: true },
  'Jack Yeandle': { pos: 'HK', age: 35, nat: 'ENG', q: 70 },
  'Lewis Pearson': { pos: 'LK', age: 24, nat: 'ENG', q: 68 },
  'Oscar Beckerleg': { pos: 'LK', age: 21, nat: 'ENG', q: 61 },
  'Tom Hooper': { pos: 'FL', alt: ['LK'], age: 25, nat: 'AUS', q: 78, intl: true },
  'Kane James': { pos: 'FL', alt: ['N8'], age: 23, nat: 'ENG', q: 68 },
  'Jimmy Roots': { pos: 'FL', age: 21, nat: 'ENG', q: 62 },
  'Will Becconsall': { pos: 'SH', age: 22, nat: 'ENG', q: 62 },
  'Iwan Jenkins': { pos: 'FH', age: 21, nat: 'WAL', q: 62, gk: true },
  'Len Ikitau': { pos: 'CE', age: 27, nat: 'AUS', q: 86, intl: true },
  'Zack Wimbush': { pos: 'CE', age: 22, nat: 'ENG', q: 63 },
  'Ben Hammersley': { pos: 'FB', alt: ['WG'], age: 28, nat: 'ENG', q: 71 },
  'Olly Woodburn': { pos: 'WG', age: 34, nat: 'ENG', q: 72 },
  'Dan John': { pos: 'WG', age: 23, nat: 'WAL', q: 65 },

  // ---- Gloucester
  'Dian Bleuler': { pos: 'LP', age: 27, nat: 'RSA', q: 69 },
  'Nepo Laulala': { pos: 'TP', age: 34, nat: 'NZL', q: 79, intl: true },
  'Joseph Dweba': { pos: 'HK', age: 30, nat: 'RSA', q: 76, intl: true },
  'Cameron Jordan': { pos: 'LK', age: 25, nat: 'ENG', q: 67 },
  'Danny Eite': { pos: 'LK', age: 23, nat: 'ENG', q: 65 },
  'Albert Tuisue': { pos: 'N8', alt: ['FL'], age: 31, nat: 'FIJ', q: 76, intl: true },
  'Josh Basham': { pos: 'FL', alt: ['N8'], age: 26, nat: 'ENG', q: 72 },
  'Charlie Chapman': { pos: 'SH', age: 24, nat: 'ENG', q: 66 },
  'Mike Austin': { pos: 'SH', age: 22, nat: 'ENG', q: 61 },
  'Ross Byrne': { pos: 'FH', age: 31, nat: 'IRE', q: 80, intl: true, gk: true },
  'Adam Hastings': { pos: 'FH', age: 29, nat: 'SCO', q: 78, intl: true, gk: true },
  'Will Butler': { pos: 'CE', age: 27, nat: 'ENG', q: 68 },
  'Will Joseph': { pos: 'CE', age: 23, nat: 'ENG', q: 72 },
  'Ben Loader': { pos: 'WG', alt: ['FB'], age: 26, nat: 'ENG', q: 74 },
  'Rob Russell': { pos: 'WG', alt: ['FB'], age: 25, nat: 'IRE', q: 70 },
  'Jake Morris': { pos: 'WG', age: 23, nat: 'ENG', q: 64 },
  'Ben Redshaw': { pos: 'WG', age: 22, nat: 'ENG', q: 62 },

  // ---- Harlequins
  'Jordan Els': { pos: 'TP', age: 26, nat: 'RSA', q: 68 },
  'Boris Wenger': { pos: 'LP', age: 24, nat: 'FRA', q: 69 },
  'Jack Musk': { pos: 'HK', age: 23, nat: 'ENG', q: 64 },
  'Guido Petti': { pos: 'LK', age: 31, nat: 'ARG', q: 82, intl: true },
  'Kieran Treadwell': { pos: 'LK', age: 30, nat: 'IRE', q: 76, intl: true },
  'Joe Jones': { pos: 'LK', age: 22, nat: 'ENG', q: 62 },
  'Archie White': { pos: 'FL', age: 22, nat: 'ENG', q: 63 },
  'Stu Townsend': { pos: 'SH', age: 30, nat: 'ENG', q: 74 },
  'Max Green': { pos: 'SH', age: 29, nat: 'ENG', q: 68 },
  'Jamie Benson': { pos: 'FH', age: 21, nat: 'ENG', q: 61, gk: true },
  'Bryn Bradley': { pos: 'CE', age: 22, nat: 'ENG', q: 63 },
  'Sean Kerr': { pos: 'CE', age: 22, nat: 'SCO', q: 63 },
  'Ben Waghorn': { pos: 'CE', age: 23, nat: 'ENG', q: 64 },
  'Hayden Hyde': { pos: 'WG', age: 22, nat: 'ENG', q: 63 },
  'Cameron Anderson': { pos: 'WG', alt: ['FB'], age: 23, nat: 'ENG', q: 65 },

  // ---- Leicester
  'Nicky Smith': { pos: 'LP', age: 32, nat: 'WAL', q: 77, intl: true },
  'Archie van der Flier': { pos: 'TP', age: 22, nat: 'IRE', q: 62 },
  'Tarek Haffar': { pos: 'TP', age: 23, nat: 'ENG', q: 64 },
  'Finn Theobald-Thomas': { pos: 'HK', age: 22, nat: 'ENG', q: 62 },
  'Lewis Chessum': { pos: 'LK', alt: ['FL'], age: 22, nat: 'ENG', q: 68 },
  'Tom Manz': { pos: 'LK', age: 22, nat: 'ENG', q: 62 },
  'James Thompson': { pos: 'LK', age: 21, nat: 'ENG', q: 60 },
  'Joshua Manz': { pos: 'FL', age: 21, nat: 'ENG', q: 61 },
  'Joaquin Moro': { pos: 'FL', alt: ['N8'], age: 24, nat: 'ARG', q: 68 },
  'Ollie Allan': { pos: 'SH', age: 22, nat: 'ENG', q: 62 },
  "James O'Connor": { pos: 'FH', alt: ['CE'], age: 35, nat: 'AUS', q: 79, intl: true, gk: true },
  'Billy Searle': { pos: 'FH', age: 30, nat: 'ENG', q: 71, gk: true },
  'Charlie Titcombe': { pos: 'FH', age: 21, nat: 'ENG', q: 60, gk: true },
  'Orlando Bailey': { pos: 'FH', alt: ['FB'], age: 24, nat: 'ENG', q: 76, gk: true },
  'Gabriel Hamer-Webb': { pos: 'WG', age: 25, nat: 'ENG', q: 68 },

  // ---- Newcastle
  'Pouri Rakete-Stones': { pos: 'TP', age: 31, nat: 'NZL', q: 70 },
  'James Kenny': { pos: 'LP', age: 24, nat: 'ENG', q: 63 },
  'Ollie Fletcher': { pos: 'HK', age: 22, nat: 'ENG', q: 61 },
  'Samson Adejimi': { pos: 'HK', age: 23, nat: 'ENG', q: 62 },
  'Jamie Hodgson': { pos: 'LK', age: 27, nat: 'ENG', q: 68 },
  'Seb de Chaves': { pos: 'LK', age: 31, nat: 'ENG', q: 69 },
  'Finn Baker': { pos: 'LK', age: 22, nat: 'ENG', q: 60 },
  'Tom Christie': { pos: 'FL', age: 27, nat: 'NZL', q: 76, intl: true },
  'Reuben Parsons': { pos: 'FL', alt: ['LK'], age: 24, nat: 'ENG', q: 66 },
  'James Elliott': { pos: 'SH', age: 23, nat: 'ENG', q: 62 },
  'Ethan Grayson': { pos: 'FH', age: 22, nat: 'ENG', q: 62, gk: true },
  'Sammy Arnold': { pos: 'CE', age: 30, nat: 'IRE', q: 69 },
  'Max Clark': { pos: 'CE', age: 29, nat: 'ENG', q: 70 },
  'Connor Doherty': { pos: 'CE', alt: ['WG'], age: 26, nat: 'ENG', q: 67 },
  'Oli Spencer': { pos: 'CE', age: 22, nat: 'ENG', q: 61 },
  'Liam Williams': { pos: 'FB', alt: ['WG'], age: 34, nat: 'WAL', q: 80, intl: true },
  'Christian Wade': { pos: 'WG', age: 34, nat: 'ENG', q: 74 },
  'Alex Hearle': { pos: 'WG', alt: ['FB'], age: 24, nat: 'ENG', q: 66 },
  'Nathan Greenwood': { pos: 'WG', age: 22, nat: 'ENG', q: 61 },
  'Joel Grayson': { pos: 'FB', alt: ['FH'], age: 21, nat: 'ENG', q: 60, gk: true },
  'Sam Waugh': { pos: 'WG', age: 22, nat: 'ENG', q: 60 },

  // ---- Northampton
  'Danilo Fischetti': { pos: 'LP', age: 27, nat: 'ITA', q: 76, intl: true },
  'Trevor Davison': { pos: 'TP', age: 31, nat: 'ENG', q: 70 },
  'Luke Green': { pos: 'LP', age: 22, nat: 'ENG', q: 62 },
  'Cleopas Kundiona': { pos: 'TP', age: 27, nat: 'ENG', q: 69 },
  'Robbie Smith': { pos: 'HK', age: 27, nat: 'ENG', q: 70 },
  'Tom Lockett': { pos: 'LK', age: 23, nat: 'ENG', q: 65 },
  'JJ van der Mescht': { pos: 'LK', age: 28, nat: 'RSA', q: 72 },
  'Emeka Atuanya': { pos: 'LK', age: 21, nat: 'ENG', q: 61 },
  'Ed Prowse': { pos: 'LK', age: 23, nat: 'ENG', q: 64 },
  'Sam Graham': { pos: 'FL', alt: ['N8'], age: 28, nat: 'ENG', q: 72 },
  'Callum Chick': { pos: 'N8', alt: ['FL'], age: 29, nat: 'ENG', q: 76 },
  'Archie Benson': { pos: 'FL', age: 21, nat: 'ENG', q: 61 },
  'Fyn Brown': { pos: 'FL', age: 21, nat: 'ENG', q: 60 },
  'Anthony Belleau': { pos: 'FH', age: 29, nat: 'FRA', q: 74, gk: true },
  'Toby Thame': { pos: 'CE', age: 22, nat: 'ENG', q: 62 },
  'Amena Caqusau': { pos: 'WG', age: 24, nat: 'FIJ', q: 68 },
  'James Martin': { pos: 'WG', age: 22, nat: 'ENG', q: 61 },

  // ---- Sale
  'Ethan Caine': { pos: 'HK', age: 22, nat: 'ENG', q: 62 },
  'James Leavasa': { pos: 'LK', age: 27, nat: 'NZL', q: 68 },
  'Jacques Vermeulen': { pos: 'FL', alt: ['N8'], age: 31, nat: 'RSA', q: 76 },
  'Tom Ellis': { pos: 'FL', age: 31, nat: 'ENG', q: 70 },
  'Nye Thomas': { pos: 'SH', age: 22, nat: 'WAL', q: 62 },
  'Joe Bedlow': { pos: 'CE', age: 21, nat: 'ENG', q: 61 },
  'Marius Louw': { pos: 'CE', age: 30, nat: 'RSA', q: 72 },
  'Alex Wills': { pos: 'WG', age: 23, nat: 'ENG', q: 63 },
  'Obi Ene': { pos: 'WG', age: 22, nat: 'ENG', q: 62 },

  // ---- Saracens
  'Ollie Hoskins': { pos: 'TP', age: 33, nat: 'AUS', q: 72 },
  'Kapeli Pifeleti': { pos: 'HK', age: 26, nat: 'AUS', q: 68 },
  'James Hadfield': { pos: 'HK', age: 22, nat: 'ENG', q: 61 },
  'Theo McFarland': { pos: 'FL', alt: ['LK'], age: 30, nat: 'SAM', q: 82, intl: true },
  'Gareth Simpson': { pos: 'SH', age: 29, nat: 'ENG', q: 68 },
  'Owen Farrell': { pos: 'FH', alt: ['CE'], age: 34, nat: 'ENG', q: 86, intl: true, gk: true },
  'Fergus Burke': { pos: 'FH', age: 26, nat: 'NZL', q: 76, gk: true },
  'Louie Johnson': { pos: 'FH', age: 22, nat: 'ENG', q: 61, gk: true },
  'Sam Spink': { pos: 'CE', age: 27, nat: 'ENG', q: 68 },
  'Max Malins': { pos: 'FB', alt: ['WG', 'FH'], age: 28, nat: 'ENG', q: 78, intl: true },
  'Brandon Jackson': { pos: 'WG', age: 22, nat: 'ENG', q: 62 },
}

// ---- matching, shared with squaddiff --------------------------------------
const fold = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
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

const dry = process.argv.includes('--dry')
const POS_RANK = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']

function render(p: { name: string; pos: string; alt?: readonly string[]; age: number; nat: string; q: number; intl?: boolean; gk?: boolean }) {
  const parts = [`name: '${p.name.replace(/'/g, "\\'")}'`, `pos: '${p.pos}'`]
  if (p.alt?.length) parts.push(`alt: [${p.alt.map(a => `'${a}'`).join(', ')}]`)
  parts.push(`age: ${p.age}`, `nat: '${p.nat}'`, `q: ${p.q}`)
  if (p.gk) parts.push('gk: true')
  if (p.intl) parts.push('intl: true')
  return `      { ${parts.join(', ')} },`
}

let added = 0, dropped = 0, kept = 0, missing = 0
const out: Record<string, string> = {}

for (const g of PREM_2526) {
  const club = [...PREM_A, ...PREM_B].find(c => c.id === g.id)!
  const have = new Map(club.players.map(p => [key(p.name), p]))
  const merged: ReturnType<typeof render>[] = []
  const rows: { name: string; pos: string; alt?: readonly string[]; age: number; nat: string; q: number; intl?: boolean; gk?: boolean }[] = []

  for (const gp of g.players) {
    const old = have.get(key(gp.name))
    if (old) {
      // Keep every researched field. The guide's own spelling wins for the name,
      // and the guide's unit only overrides a position the game left as the
      // group default - a researched LP is not demoted to TP by a "Props" header.
      kept++
      rows.push({ ...old, name: gp.name })
    } else {
      const n = NEW[gp.name]
      if (!n) { missing++; console.error(`NO ATTRIBUTES for ${g.id} ${gp.name} [${gp.pos}]`); continue }
      added++
      rows.push({ name: gp.name, ...n })
    }
  }
  dropped += club.players.filter(p => !g.players.some(gp => key(gp.name) === key(p.name))).length

  rows.sort((a, b) => POS_RANK.indexOf(a.pos) - POS_RANK.indexOf(b.pos) || b.q - a.q)
  for (const r of rows) merged.push(render(r))
  out[g.id] = merged.join('\n')
  console.log(`${g.id}: ${rows.length} men (${rows.filter(r => NEW[r.name]).length} new)`)
}

console.log(`\nkept ${kept}, added ${added}, dropped ${dropped}, missing attributes ${missing}`)
if (missing) { console.error('refusing to write with missing attributes'); process.exit(1) }

// ---- splice the new arrays into the files ---------------------------------
for (const file of ['src/data/leagues/prem_a.ts', 'src/data/leagues/prem_b.ts']) {
  let src = readFileSync(file, 'utf8')
  for (const [id, body] of Object.entries(out)) {
    // find "id: '<club>'" then its players: [ ... ], and replace the inside
    const at = src.indexOf(`id: '${id}',`)
    if (at < 0) continue
    const pStart = src.indexOf('players: [', at)
    const pEnd = src.indexOf('\n    ],', pStart)
    if (pStart < 0 || pEnd < 0) { console.error(`could not find players array for ${id}`); process.exit(1) }
    src = src.slice(0, pStart) + 'players: [\n' + body + src.slice(pEnd)
  }
  if (dry) console.log(`(dry) would write ${file}, ${src.split('\n').length} lines`)
  else { writeFileSync(file, src); console.log(`wrote ${file}`) }
}
