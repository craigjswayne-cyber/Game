// The English third tier - National League One. Real community clubs,
// real grounds. Semi-pro squads generated deterministically: plumbers
// with quick feet, students, and old pros winding down. Quality 32-58.

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
  club('rosslyn', 'Roehampton', 'Roehampton', 'London', 'Roehampton Meadow', 2000, ['#c02f3a', '#ffffff'], 44, 140_000),
  club('salefc', 'Sale FC', 'Sale FC', 'Sale', 'Heywood Park', 3000, ['#12295c', '#ffffff'], 43, 130_000),
  club('rams', 'Reading', 'Reading', 'Reading', 'Reading Meadow', 2000, ['#0e0e0e', '#c9a227'], 43, 130_000),
  club('cinderford', 'Cinderford', 'Cinderford', 'Cinderford', 'Cinderford Lane', 2200, ['#0a5c36', '#c02f3a'], 42, 120_000),
  club('blackheath', 'Blackheath', 'Blackheath', 'London', 'Blackheath Rise', 2500, ['#c02f3a', '#0e0e0e'], 42, 120_000),
  club('plymouth', 'Plymouth', 'Plymouth', 'Plymouth', 'Plymouth Gardens', 3500, ['#0a3b2e', '#ffffff'], 41, 115_000),
  club('moseley', 'Birmingham', 'Birmingham', 'Birmingham', 'Birmingham Gardens', 3000, ['#c02f3a', '#0e0e0e'], 41, 110_000),
  club('darlington', 'Darlington', 'Darlington', 'Darlington', 'Darlington Meadow', 25000, ['#12295c', '#c9a227'], 40, 110_000),
  club('leedstykes', 'Leeds', 'Leeds', 'Leeds', 'Leeds Rise', 1500, ['#1e5aa8', '#c9a227'], 40, 105_000),
  club('stortford', "Bishop's Stortford", "Bishop's", "Bishop's Stortford", "Bishop's Stortford Park", 1800, ['#12295c', '#8fc1e3'], 39, 100_000),
  club('sedgley', 'Manchester', 'Manchester', 'Manchester', 'Manchester Common', 1500, ['#0a5c36', '#ffffff'], 38, 95_000),
  club('esher', 'Esher', 'Esher', 'Esher', 'Esher Meadow', 2700, ['#7a0c2e', '#ffffff'], 38, 95_000),
]
