// The English second tier - real clubs, grounds and colours.
// Squads are generated deterministically: honest journeymen, hungry
// kids and the odd fallen star, all in the 40-70 quality band.

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

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0xc4a2 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const used = new Set<string>()
  const out: RawPlayer[] = []
  let gkGiven = 0
  for (const pos of TEMPLATE) {
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
      if (!used.has(name)) break
    }
    used.add(name)
    const age = 19 + Math.floor(rng() * 15)
    let q = Math.round(rep - 7 + rng() * 14)
    if (rng() < 0.08) q += 6 // the local hero
    q = Math.max(40, Math.min(70, q))
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

export const CHAMP: RawClub[] = [
  club('ealing', 'Ealing Trailfinders', 'Ealing', 'London', 'Trailfinders Sports Ground', 5000, ['#0a5c36', '#ffffff'], 62, 700_000),
  club('doncaster', 'Doncaster Knights', 'Doncaster', 'Doncaster', 'Castle Park', 5183, ['#1a3a5c', '#c9a227'], 58, 450_000),
  club('coventry', 'Coventry Rugby', 'Coventry', 'Coventry', 'Butts Park Arena', 4000, ['#1b2f9e', '#ffffff'], 57, 420_000),
  club('bedford', 'Bedford Blues', 'Bedford', 'Bedford', 'Goldington Road', 5000, ['#1e5aa8', '#ffffff'], 56, 400_000),
  club('pirates', 'Cornish Pirates', 'Pirates', 'Penzance', 'Mennaye Field', 4000, ['#111111', '#c9a227'], 55, 380_000),
  club('nottingham', 'Nottingham Rugby', 'Nottingham', 'Nottingham', 'The Bay', 3500, ['#0a6b4f', '#ffffff'], 52, 300_000),
  club('hartpury', 'Hartpury University', 'Hartpury', 'Gloucester', "Gillman's Ground", 2000, ['#7a0c2e', '#9aa5ad'], 51, 260_000),
  club('lscottish', 'London Scottish', 'L. Scottish', 'Richmond', 'The Athletic Ground', 4500, ['#12295c', '#c02f3a'], 50, 250_000),
  club('richmond', 'Richmond Rugby', 'Richmond', 'Richmond', 'The Athletic Ground', 4500, ['#c9a227', '#c02f3a'], 50, 250_000),
  club('cambridge', 'Cambridge Rugby', 'Cambridge', 'Cambridge', 'Volac Park', 3000, ['#7a1027', '#f0eadc'], 47, 200_000),
  club('chinnor', 'Chinnor RFC', 'Chinnor', 'Chinnor', 'Kingsey Road', 2000, ['#0e0e0e', '#ffffff'], 46, 180_000),
  club('caldy', 'Caldy RFC', 'Caldy', 'Wirral', 'Paton Field', 2500, ['#123c6b', '#8fc1e3'], 44, 160_000),
]
