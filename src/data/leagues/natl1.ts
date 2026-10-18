// The English third tier - National League One. Real community clubs,
// real grounds. Semi-pro squads generated deterministically: plumbers
// with quick feet, students, and old pros winding down. Quality 32-58.
//
// THE 2026-27 LEAGUE (research of 18 Oct 2026, from the 2026-27 and 2025-26
// National League 1 season pages). Thirteen members are confirmed: the six
// clubs below that were already here, Cambridge and London Scottish down from
// the Championship, and five the game never had - Bury St Edmunds, Camborne
// and Sheffield (the three National Two champions), Dings Crusaders and
// Tonbridge Juddians. Blackheath went up; Darlington Mowden Park and Esher
// went down at the end of 2024-25 and Sedgley Park at the end of 2025-26.
// The fourteenth member could not be confirmed. Rosslyn Park (2024-25 runners-
// up, no relegation found) is kept as the likeliest; Cinderford, the other
// candidate, is not, because the double round robin needs an even field.
// The new clubs' grounds, capacities and colours are from general knowledge,
// not the research - check them; Bury St Edmunds reuses the women's club's.

import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'

const FIRST = [
  'Jack', 'Harry', 'George', 'Oliver', 'Charlie', 'Tom', 'Will', 'Ben', 'Sam', 'Joe',
  'Dan', 'Josh', 'Alex', 'Callum', 'Luke', 'Adam', 'Ryan', 'Lewis', 'Owen', 'Rhys',
  'Kyle', 'Brad', 'Ashley', 'Craig', 'Dave', 'Steve', 'Rob', 'Matt', 'Chris', 'Pete',
  'Ollie', 'Max', 'Theo', 'Nathan', 'Kieran', 'Connor', 'Liam', 'Aaron', 'Elliot', 'Jamie',
  'Toby', 'Henry', 'Ed', 'Stan', 'Albie', 'Louis', 'Marcus', 'Reuben', 'Seb', 'Zach',
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
  'Hancock', 'Tanner', 'Blythe', 'Cartwright', 'Osborne', 'Whittaker', 'Dunn', 'Ingram', 'Pargeter', 'Sowerby',
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

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0x9e37 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const out: RawPlayer[] = []
  let gkGiven = 0
  for (const pos of TEMPLATE) {
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)
    const age = 18 + Math.floor(rng() * 17)
    let q = Math.round(rep - 7 + rng() * 14)
    if (rng() < 0.07) q += 7 // the village legend who never got his shot
    q = Math.max(32, Math.min(58, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.55
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: 'ENG', q, gk })
  }
  return out
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'ENG', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const NATL1: RawClub[] = [
  club('rosslyn', 'Roehampton RFC', 'Roehampton', 'London', 'The Crag', 2000, ['#c02f3a', '#ffffff'], 44, 140_000),
  club('salefc', 'Sale FC', 'Sale FC', 'Sale', 'Heywood Road', 3000, ['#12295c', '#ffffff'], 43, 130_000),
  club('rams', 'Reading RFC', 'Reading', 'Reading', 'Old Bath Road', 2000, ['#0e0e0e', '#c9a227'], 43, 130_000),
  club('plymouth', 'Plymouth RFC', 'Plymouth', 'Plymouth', 'Brickfields', 3500, ['#0a3b2e', '#ffffff'], 41, 115_000),
  club('moseley', 'Birmingham RFC', 'Birmingham', 'Birmingham', 'Billesley Common', 3000, ['#c02f3a', '#0e0e0e'], 41, 110_000),
  club('leedstykes', 'Leeds RFC', 'Leeds', 'Leeds', 'Leeds College Ground', 1500, ['#1e5aa8', '#c9a227'], 40, 105_000),
  club('stortford', "Bishop's Stortford RFC", 'Stortford', "Bishop's Stortford", 'Silver Leys', 1800, ['#12295c', '#8fc1e3'], 39, 100_000),
  // down from the Championship for 2026-27, with their numbers unchanged
  club('lscottish', 'London Caledonians RFC', 'Caledonians', 'Richmond', 'The Athletic Ground', 4500, ['#12295c', '#c02f3a'], 50, 250_000),
  club('cambridge', 'Cambridge RFC', 'Cambridge', 'Cambridge', 'Camside Park', 3000, ['#7a1027', '#f0eadc'], 47, 200_000),
  // new for 2026-27. Place plus RFC; a ground named for a road or district
  // keeps its name, as the rest of this file does. Dings Crusaders take
  // their district, as the map does for clubs whose name is not a place
  // (Bristol already being Bristol RFC); Tonbridge Juddians their town.
  club('buryse', 'Bury St Edmunds RFC', 'Bury St Ed', 'Bury St Edmunds', 'Haberden Fields', 2500, ['#14663b', '#e0a80d'], 40, 105_000),
  club('camborne', 'Camborne RFC', 'Camborne', 'Camborne', 'The Recreation Ground', 3000, ['#8b1a2b', '#ffffff'], 39, 100_000),
  club('dings', 'Dings RFC', 'Dings', 'Bristol', 'Shaftesbury Fields', 2000, ['#0e0e0e', '#c02f3a'], 40, 105_000),
  club('sheffield', 'Sheffield RFC', 'Sheffield', 'Sheffield', 'Abbeydale Park', 2000, ['#12295c', '#c02f3a'], 39, 100_000),
  club('tonbridge', 'Tonbridge RFC', 'Tonbridge', 'Tonbridge', 'The Slade', 2000, ['#7a0c2e', '#ffffff'], 40, 105_000),
]
