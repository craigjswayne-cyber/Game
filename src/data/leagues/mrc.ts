// The Major Rugby Competition - the American professional league (owner, 26
// Sep 2026: "add USA MLR - call it Major Rugby Competition").
//
// The six clubs that played the 2026 season, kept as six (owner's call): the
// Charlotte side folded at the end of that season when its development funding
// ended, which would leave five, too thin to be worth a career. Names follow
// docs/ip-rename-map.md: the place plus RFC, no nicknames, and a near-miss of
// each ground (the "MLR" section there lists every one). Capacities are the real
// grounds'. California's real side took its 2026 home games round three regions;
// here it keeps the San Diego ground it came from.
//
// SQUADS ARE REAL NOW (owner, 18 Oct 2026). They were generated - an American
// core with southern-hemisphere and European imports, drawn so that no name
// could be a real man's - until the owner decided the league uses real
// players like every other men's top flight. REAL below holds each club's 2026
// roster as the research of 18 Oct 2026 found it (club roster announcements,
// the 2026 season's squad lists, matchday team sheets; search summaries, since
// page fetches were blocked). 2027 rosters were not out yet: the league plays
// March to June. Only names graded high or medium with a position and an age
// are real here, and the ages are ESTIMATES the research made (age at 1 Feb
// 2026; no birth dates could be checked) - check them before shipping. Rufus
// McLean is not among Seattle's: he spends 2026-27 at Stade Français.
//
// Each real man takes the shirt of a generated man in his position
// (withReal), so the generator still fills what they leave and each squad
// covers every position, and CHARLOTTE STAYS ENTIRELY GENERATED: the real
// club folded after the 2026 season and its players were released, so it has
// no squad to be real about (owner's call to keep six clubs, as above).
//
// THE STANDARD IS THE CHAMPIONSHIP'S (reputations 52-60). The first cut sat at
// 58-66, which built squads better than English second-tier ones on revenue a
// little below it - five home gates a season, not eleven - and scripts/aiecon.ts
// caught the result: the American clubs sank, fire-sold their best men into the
// world, and the median club everywhere else banked a fraction of what it had.

import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'

const US_FIRST = ['Brady', 'Colton', 'Dalton', 'Garrett', 'Hunter', 'Jaxon', 'Landon', 'Maverick', 'Nolan', 'Paxton', 'Reid', 'Tanner', 'Wyatt', 'Cody', 'Easton', 'Grady', 'Hollis', 'Knox', 'Merrick', 'Porter', 'Beau', 'Cade', 'Deacon', 'Emmett']
const US_LAST = ['Abernathy', 'Beckett', 'Calloway', 'Dempsey', 'Everly', 'Fairbanks', 'Garrison', 'Holloway', 'Kincaid', 'Lockhart', 'Mercer', 'Pruitt', 'Ramsey', 'Sutter', 'Thornbury', 'Vance', 'Whitaker', 'Yancey', 'Brannigan', 'Okonkwo', 'Castellano', 'Delgado', 'Haverford', 'Strickland']
const IMP_FIRST = ['Manu', 'Tavita', 'Lachie', 'Ruan', 'Jaco', 'Semi', 'Viliami', 'Ilaisa', 'Thiago', 'Callum', 'Niko', 'Afa', 'Fergus', 'Tomasi', 'Kurtley', 'Pieter']
const IMP_LAST = ['Fonoti', 'Kolinisau', 'Leaupepe', 'Van Rooyen', 'Matagi', 'Ferreyra', 'Ashdown', 'Tuivasa', 'Koroisau', 'Faleafa', 'Blackadder', 'Swanepoel', 'Latu-Hale', 'Pemberton', 'Vakacegu', 'Oosthuis']
const IMP_NAT = ['NZL', 'AUS', 'RSA', 'TGA', 'SAM', 'FIJ', 'ARG', 'ENG'] as const

const TEMPLATE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH', 'CE', 'CE', 'CE',
  'WG', 'WG', 'WG', 'FB', 'FB',
  'FL', 'CE', 'LP',
]

// one name per man across the whole competition
const usedNames = new Set<string>()

/** Real men at a club, by id (see the header and withReal). q sits on the league's own 50-72 scale:
 *  capped tier-one internationals near the top, Eagles and foreign pros in
 *  the low sixties, depth and rookies in the fifties. */
const REAL: Record<string, RawPlayer[]> = {
  chicago: [
    { name: 'Jake Turnbull', pos: 'LP', age: 27, nat: 'USA', q: 58 },
    { name: 'Fakaosifolau Pifeleti', pos: 'LP', age: 29, nat: 'USA', q: 62, intl: true },
    { name: 'Charlie Abel', pos: 'TP', age: 27, nat: 'USA', q: 60 },
    { name: 'Koby Baker', pos: 'TP', age: 25, nat: 'USA', q: 55 },
    { name: 'Theo Fourie', pos: 'HK', age: 26, nat: 'RSA', q: 62 },
    { name: 'Jackson Zabierek', pos: 'HK', age: 25, nat: 'USA', q: 55 },
    { name: 'Nathan Den Hoedt', pos: 'LK', age: 26, nat: 'AUS', q: 64 },
    { name: 'Malcolm May', pos: 'LK', age: 27, nat: 'USA', q: 60 },
    { name: 'Luke White', pos: 'LK', age: 25, nat: 'USA', q: 55 },
    { name: 'Brandon Harvey', pos: 'LK', age: 23, nat: 'USA', q: 58, intl: true },
    { name: 'Tomas Casares', pos: 'FL', age: 27, nat: 'USA', q: 64, intl: true },
    { name: 'Mason Flesch', pos: 'FL', age: 27, nat: 'CAN', q: 64, intl: true },
    { name: 'Maclean Jones', pos: 'FL', age: 28, nat: 'NZL', q: 65 },
    { name: 'Lucas Rumball', pos: 'N8', age: 30, nat: 'CAN', q: 70, intl: true },
    { name: 'Jake Kinneeveauk', pos: 'FL', age: 23, nat: 'USA', q: 52 },
    { name: 'Ruben de Haas', pos: 'SH', age: 27, nat: 'RSA', q: 68 },
    { name: 'Michael Baska', pos: 'SH', age: 24, nat: 'USA', q: 52 },
    { name: 'Christopher Hilsenbeck', pos: 'FH', age: 29, nat: 'USA', q: 62, intl: true },
    { name: 'Ollie Devoto', pos: 'CE', age: 32, nat: 'ENG', q: 72, intl: true },
    { name: 'Tiaan Loots', pos: 'CE', age: 27, nat: 'RSA', q: 60 },
    { name: "Mark O'Keeffe", pos: 'WG', age: 28, nat: 'IRE', q: 60 },
    { name: 'Santiago Videla', pos: 'FB', age: 27, nat: 'ARG', q: 64 },
    { name: 'Brock Webster', pos: 'FB', age: 30, nat: 'CAN', q: 62, intl: true },
  ],
  newengland: [
    { name: 'Kyle Ciquera', pos: 'LP', age: 28, nat: 'USA', q: 60, intl: true },
    { name: 'Kaleb Geiger', pos: 'HK', age: 26, nat: 'USA', q: 56 },
    { name: 'Filipe Vakasiuola', pos: 'TP', age: 27, nat: 'NZL', q: 58 },
    { name: 'Sione Tupou', pos: 'HK', age: 26, nat: 'NZL', q: 58 },
    { name: 'Tayne Hemopo', pos: 'N8', age: 27, nat: 'NZL', q: 60 },
    { name: 'Joe Johnston', pos: 'FL', age: 30, nat: 'NZL', q: 64 },
    { name: 'Jacob Norris', pos: 'FL', age: 27, nat: 'NZL', q: 60 },
    { name: 'Joel Hodgson', pos: 'FH', age: 30, nat: 'ENG', q: 62 },
    { name: 'Ben LeSage', pos: 'CE', age: 30, nat: 'CAN', q: 66, intl: true },
    { name: 'Wayne van der Bank', pos: 'CE', age: 34, nat: 'RSA', q: 64 },
    { name: 'Mitch Wilson', pos: 'WG', age: 28, nat: 'USA', q: 62, intl: true },
  ],
  seattle: [
    { name: 'Dewald Donald', pos: 'TP', age: 29, nat: 'RSA', q: 60 },
    { name: 'Ezekiel Lindenmuth', pos: 'LP', age: 27, nat: 'USA', q: 56 },
    { name: 'Ignacio Péculo', pos: 'TP', age: 27, nat: 'ARG', q: 60 },
    { name: 'Charles Walsh', pos: 'LP', age: 26, nat: 'USA', q: 54 },
    { name: 'LaRome White', pos: 'TP', age: 28, nat: 'USA', q: 56 },
    { name: 'Rhyno Herbst', pos: 'LK', age: 27, nat: 'RSA', q: 64 },
    { name: 'Riekert Hattingh', pos: 'N8', age: 35, nat: 'USA', q: 66, intl: true },
    { name: 'Marno Redelinghuys', pos: 'FL', age: 30, nat: 'RSA', q: 62 },
    { name: 'Nick Boyer', pos: 'SH', age: 28, nat: 'USA', q: 58, intl: true },
    { name: 'André Warner', pos: 'SH', age: 32, nat: 'RSA', q: 66 },
    { name: 'Davy Coetzer', pos: 'FH', age: 27, nat: 'RSA', q: 60 },
    { name: 'Dorian Jones', pos: 'FH', age: 28, nat: 'WAL', q: 62 },
    { name: 'Mark Bennett', pos: 'CE', age: 32, nat: 'SCO', q: 70, intl: true },
    { name: 'Dan Kriel', pos: 'CE', age: 31, nat: 'RSA', q: 66 },
    { name: 'Duncan Matthews', pos: 'WG', age: 28, nat: 'RSA', q: 62 },
    { name: 'Divan Rossouw', pos: 'FB', age: 30, nat: 'RSA', q: 64 },
  ],
  california: [
    { name: "Ma'ake Muti", pos: 'LP', age: 26, nat: 'USA', q: 62, intl: true },
    { name: 'Tonga Kofe', pos: 'TP', age: 25, nat: 'USA', q: 60, intl: true },
    { name: "Joe Taufete'e", pos: 'HK', age: 33, nat: 'USA', q: 66, intl: true },
    { name: 'Jason Damm', pos: 'LK', age: 30, nat: 'USA', q: 66, intl: true },
    { name: 'Christian Poidevin', pos: 'FL', age: 28, nat: 'AUS', q: 64 },
    { name: 'Lance Williams', pos: 'N8', age: 27, nat: 'USA', q: 62, intl: true },
    { name: 'Gonzalo Bertranou', pos: 'SH', age: 32, nat: 'ARG', q: 72, intl: true },
    { name: 'Coby Miln', pos: 'FH', age: 27, nat: 'AUS', q: 62 },
    { name: 'Billy Meakes', pos: 'CE', age: 34, nat: 'AUS', q: 64 },
    { name: 'Cassh Maluia', pos: 'CE', age: 27, nat: 'USA', q: 66, intl: true },
    { name: 'Joe Mano', pos: 'WG', age: 26, nat: 'USA', q: 62, intl: true },
  ],
  washington: [
    { name: 'KoiKoi Neligan', pos: 'HK', age: 27, nat: 'USA', q: 56 },
    { name: 'Robert Harley', pos: 'LK', age: 35, nat: 'SCO', q: 68, intl: true },
    { name: 'Billy Whiteside', pos: 'LK', age: 28, nat: 'USA', q: 56 },
    { name: 'Benjamin Bonasso', pos: 'FL', age: 28, nat: 'ARG', q: 62 },
    { name: 'Collin Grosse', pos: 'FL', age: 27, nat: 'USA', q: 58 },
    { name: 'Jay Renton', pos: 'SH', age: 30, nat: 'NZL', q: 62 },
    { name: 'John LeFevre', pos: 'SH', age: 29, nat: 'USA', q: 58 },
    { name: 'Jason Robertson', pos: 'FH', age: 31, nat: 'USA', q: 64 },
    { name: 'Jordan Jackson-Hope', pos: 'CE', age: 29, nat: 'AUS', q: 64 },
    { name: 'Ross Depperschmidt', pos: 'CE', age: 29, nat: 'USA', q: 58 },
    { name: 'John Powers', pos: 'CE', age: 28, nat: 'USA', q: 56 },
    { name: 'Damien Hoyland', pos: 'FB', age: 32, nat: 'SCO', q: 66, intl: true },
    { name: 'John Rizzo', pos: 'WG', age: 27, nat: 'USA', q: 56 },
  ],
}

/** A club's real men take the shirts of the generated men drawn for them: the
 *  first generated player in each real man's position gives way to him, and a
 *  real man with no generated shirt left to take is simply added. The whole
 *  template is still drawn first, exactly as before REAL existed, so the same
 *  random numbers produce the same names for every OTHER club - adding real
 *  players to one squad does not rename another club's generated men. */
function withReal(generated: RawPlayer[], real: RawPlayer[]): RawPlayer[] {
  const out = [...generated]
  const taken = new Set<number>()
  const extra: RawPlayer[] = []
  for (const rp of real) {
    const i = out.findIndex((p, k) => !taken.has(k) && p.pos === rp.pos)
    if (i < 0) { extra.push(rp); continue }
    out[i] = rp
    taken.add(i)
  }
  // real men first, the convention every squad file keeps
  return [...[...taken].sort((a, b) => a - b).map(k => out[k]), ...extra, ...out.filter((_, k) => !taken.has(k))]
}

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0x05a ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const out: RawPlayer[] = []
  let gkGiven = 0
  let imports = 0
  for (const pos of TEMPLATE) {
    // MLR clubs lean on imports harder than Japan's: up to eight a squad
    const isImport = imports < 8 && rng() < 0.3
    if (isImport) imports++
    const F = isImport ? IMP_FIRST : US_FIRST
    const L = isImport ? IMP_LAST : US_LAST
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = `${F[Math.floor(rng() * F.length)]} ${L[Math.floor(rng() * L.length)]}`
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)
    const age = 20 + Math.floor(rng() * 13)
    let q = Math.round(rep - 8 + rng() * 15) + (isImport ? 5 : 0)
    q = Math.max(44, Math.min(78, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.5
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: isImport ? IMP_NAT[Math.floor(rng() * IMP_NAT.length)] : 'USA', q, gk })
  }
  return withReal(out, REAL[clubId] ?? [])
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'USA', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const MRC: RawClub[] = [
  club('newengland', 'New England RFC', 'New England', 'Quincy', 'Quincy Veterans Field', 5000, ['#c02f3a', '#12295c'], 60, 1_100_000),
  club('chicago', 'Chicago RFC', 'Chicago', 'Bridgeview', 'Bridgeview Stadium', 20000, ['#1f6b3a', '#8fc1e3'], 59, 1_050_000),
  club('seattle', 'Seattle RFC', 'Seattle', 'Tukwila', 'Starlight Stadium', 4500, ['#0e0e0e', '#9aa5ad'], 58, 950_000),
  club('california', 'California RFC', 'California', 'San Diego', 'Toreador Stadium', 6000, ['#b3202a', '#f2c200'], 58, 950_000),
  // Old Glory DC left the Maryland SoccerPlex for George Mason Stadium,
  // Fairfax, from 2026
  club('washington', 'Washington RFC', 'Washington', 'Fairfax', 'Mason Field', 5000, ['#12295c', '#c02f3a'], 55, 800_000),
  club('charlotte', 'Charlotte RFC', 'Charlotte', 'Charlotte', 'Legion Memorial Field', 10500, ['#1e5aa8', '#f2c200'], 52, 600_000),
]
