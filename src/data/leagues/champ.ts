// The English second tier - real clubs, grounds and colours.
// Squads are generated deterministically: honest journeymen, hungry
// kids and the odd fallen star, all in the 40-70 quality band.
//
// THE 2026-27 LEAGUE (research of 18 Oct 2026; RugbyPass, May 2026, and the
// 2026-27 Champ Rugby season page): fourteen clubs. Worcester (the 2025-26
// champions, not promoted), Ampthill and Rotherham (National One champions)
// join, Blackheath comes up from National One, and Cambridge and London
// Scottish go down to it. A club's REAL players are listed in REAL below and
// each takes the shirt of a generated man in his position (withReal), so the
// generator fills only what the real men leave and every squad still covers
// every position. Real names here are only
// those the research tied to the club with a position AND an age - most Champ
// team sheets name men without either, and those are left to the generator
// rather than given an invented age. More real Champ players live in
// additions.ts (Ealing) and arrive through verified.ts (Coventry, Worcester).

import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'

const FIRST = [
  'Jack', 'Harry', 'George', 'Oliver', 'Charlie', 'Tom', 'Will', 'Ben', 'Sam', 'Joe',
  'Dan', 'Josh', 'Alex', 'Callum', 'Luke', 'Adam', 'Ryan', 'Lewis', 'Owen', 'Rhys',
  'Morgan', 'Dylan', 'Evan', 'Cameron', 'Fraser', 'Angus', 'Rory', 'Ewan', 'Archie', 'Freddie',
  'Ollie', 'Max', 'Theo', 'Nathan', 'Kieran', 'Connor', 'Liam', 'Aaron', 'Elliot', 'Jamie',
  'Toby', 'Henry', 'Ed', 'Hugo', 'Felix', 'Louis', 'Marcus', 'Reuben', 'Seb', 'Zach',
  'Gareth', 'Ieuan', 'Carwyn', 'Steffan', 'Dafydd', 'Finn', 'Hamish', 'Struan', 'Gregor', 'Blair',
]

const LAST = [
  'Smith', 'Jones', 'Williams', 'Taylor', 'Brown', 'Davies', 'Evans', 'Wilson', 'Thomas', 'Roberts',
  'Johnson', 'Lewis', 'Walker', 'Robinson', 'Wood', 'Thompson', 'White', 'Watson', 'Jackson', 'Wright',
  'Green', 'Harris', 'Cooper', 'King', 'Lee', 'Martin', 'Clarke', 'James', 'Morgan', 'Hughes',
  'Edwards', 'Hill', 'Moore', 'Clark', 'Harrison', 'Scott', 'Young', 'Morris', 'Hall', 'Ward',
  'Turner', 'Carter', 'Phillips', 'Mitchell', 'Patel', 'Adams', 'Campbell', 'Anderson', 'Allen', 'Cook',
  'Bailey', 'Parker', 'Miller', 'Price', 'Bell', 'Shaw', 'Kelly', 'Simpson', 'Marshall', 'Collins',
  'Bennett', 'Cox', 'Richardson', 'Fox', 'Gray', 'Rose', 'Chapman', 'Hunt', 'Barnes', 'Reid',
  'Owens', 'Pritchard', 'Llewellyn', 'Vaughan', 'Bevan', 'MacLeod', 'Ferguson', 'Douglas', 'Stewart', 'Munro',
]

/** Squad template: two-deep everywhere, three-deep in the engine room. */
const TEMPLATE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH', 'CE', 'CE', 'CE',
  'WG', 'WG', 'WG', 'FB', 'FB',
  'FL', 'CE', 'LP',
]

// one name per man across the whole competition: a duplicate would cost the
// second club a real shirt, since the world builder keeps only the first
const usedNames = new Set<string>()

/** Real men at a club, by id (2026-27 research, see the header and
 *  withReal). */
const REAL: Record<string, RawPlayer[]> = {
  // started at 10 v Richmond, 3 Oct 2026 (warriors.co.uk team news)
  worcester: [
    { name: 'Billy Twelvetrees', pos: 'FH', alt: ['CE'], age: 37, nat: 'ENG', q: 66, intl: true },
  ],
  // all.rugby Ampthill 2026/27 squad; the 2025-26 club captain
  ampthill: [
    { name: 'Fraser Strachan', pos: 'CE', age: 27, nat: 'ENG', q: 56 },
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
  const rng = mulberry32(0xc4a2 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const out: RawPlayer[] = []
  let gkGiven = 0
  for (const pos of TEMPLATE) {
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)
    const age = 19 + Math.floor(rng() * 15)
    let q = Math.round(rep - 7 + rng() * 14)
    if (rng() < 0.08) q += 6 // the local hero
    q = Math.max(40, Math.min(70, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.55
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: 'ENG', q, gk })
  }
  return withReal(out, REAL[clubId] ?? [])
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'ENG', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const CHAMP: RawClub[] = [
  club('ealing', 'Ealing RFC', 'Ealing', 'London', 'Ealing Sports Ground', 5000, ['#0a5c36', '#ffffff'], 62, 700_000),
  club('doncaster', 'Doncaster RFC', 'Doncaster', 'Doncaster', 'Castle Park', 5183, ['#1a3a5c', '#c9a227'], 58, 450_000),
  club('coventry', 'Coventry RFC', 'Coventry', 'Coventry', 'Butts Lane Arena', 4000, ['#1b2f9e', '#ffffff'], 57, 420_000),
  club('bedford', 'Bedford RFC', 'Bedford', 'Bedford', 'Goldington Road', 5000, ['#1e5aa8', '#ffffff'], 56, 400_000),
  club('pirates', 'Cornwall RFC', 'Cornwall', 'Penzance', 'Menhay Field', 4000, ['#111111', '#c9a227'], 55, 380_000),
  club('nottingham', 'Nottingham RFC', 'Nottingham', 'Nottingham', 'The Bay', 3500, ['#0a6b4f', '#ffffff'], 52, 300_000),
  club('hartpury', 'Hartpury RFC', 'Hartpury', 'Gloucester', "Gillmore's Ground", 2000, ['#7a0c2e', '#9aa5ad'], 51, 260_000),
  club('richmond', 'Richmond RFC', 'Richmond', 'Richmond', 'The Athletic Ground', 4500, ['#c9a227', '#c02f3a'], 50, 250_000),
  club('chinnor', 'Chinnor RFC', 'Chinnor', 'Chinnor', 'Kingsey Road', 2000, ['#0e0e0e', '#ffffff'], 46, 180_000),
  club('caldy', 'Caldy RFC', 'Caldy', 'Wirral', 'Payton Field', 2500, ['#123c6b', '#8fc1e3'], 44, 160_000),
  // ---- new for 2026-27 (owner, 18 Oct 2026: the Championship is the real
  // league). Names and grounds follow docs/ip-rename-map.md: the place plus
  // RFC, and a near-miss of each real ground (Sixways, Dillingham Park,
  // Clifton Lane). Capacities and colours are the research's; Ampthill's and
  // Rotherham's colours and Ampthill's capacity were from memory there and
  // are unverified. Reputations sit where the research placed each club.
  // the 2025-26 champions and the best-resourced side in the league
  club('worcester', 'Worcester RFC', 'Worcester', 'Worcester', 'Sixwell Stadium', 11499, ['#0d1e46', '#c9a227'], 64, 800_000),
  club('ampthill', 'Ampthill RFC', 'Ampthill', 'Ampthill', 'Dellingham Park', 3000, ['#6b1f2a', '#e8a317'], 48, 200_000),
  // National One champions 2025-26, promoted
  club('rotherham', 'Rotherham RFC', 'Rotherham', 'Rotherham', 'Clifton Road', 2500, ['#7a1f2b', '#5b9bd5'], 46, 180_000),
  // National One runners-up, promoted through the accession final against
  // London Scottish; the club and its numbers come across from natl1.ts
  club('blackheath', 'Blackheath RFC', 'Blackheath', 'London', 'Well Hall', 2500, ['#c02f3a', '#0e0e0e'], 42, 120_000),
]
