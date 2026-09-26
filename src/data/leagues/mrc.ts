// The Major Rugby Competition - the American professional league (owner, 26
// Sep 2026: "add USA MLR - call it Major Rugby Competition").
//
// The six clubs that played the 2026 season, kept as six (owner's call): the
// Charlotte side folded at the end of that season when its development funding
// ended, which would leave five, too thin to be worth a career. Names follow
// docs/ip-rename-map.md: the place plus RFC, no nicknames, and a near-miss of
// each ground (the "MLR" section there lists every one). Capacities are the real
// grounds'. California's real side took its 2026 home games round five cities;
// here it keeps the San Diego ground it came from.
//
// Squads are generated (an American core with southern-hemisphere and European
// imports), like Japan's, and the names are drawn so that none of them can be a
// real man's: no marquee stars are named.

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
  return out
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'USA', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const MRC: RawClub[] = [
  club('freejacks', 'New England RFC', 'New England', 'Quincy', 'Quincy Veterans Field', 5000, ['#c02f3a', '#12295c'], 66, 1_100_000),
  club('hounds', 'Chicago RFC', 'Chicago', 'Bridgeview', 'Bridgeview Stadium', 20000, ['#1f6b3a', '#8fc1e3'], 65, 1_050_000),
  club('seawolves', 'Seattle RFC', 'Seattle', 'Tukwila', 'Starlight Stadium', 4500, ['#0e0e0e', '#9aa5ad'], 64, 950_000),
  club('legion', 'California RFC', 'California', 'San Diego', 'Toreador Stadium', 6000, ['#b3202a', '#f2c200'], 64, 950_000),
  club('oldglory', 'Washington RFC', 'Washington', 'Germantown', 'Germantown Park', 5000, ['#12295c', '#c02f3a'], 61, 800_000),
  club('anthem', 'Charlotte RFC', 'Charlotte', 'Charlotte', 'Legion Memorial Field', 10500, ['#1e5aa8', '#f2c200'], 58, 600_000),
]
