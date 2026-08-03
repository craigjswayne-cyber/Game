// The French second division — real clubs, grounds and colours.
// Squads generated deterministically in the 42-72 band: hardened
// journeymen, Espoirs graduates and the odd fallen Top 14 star.

import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'

const FIRST = [
  'Antoine', 'Thomas', 'Baptiste', 'Hugo', 'Théo', 'Lucas', 'Maxime', 'Romain', 'Julien', 'Clément',
  'Pierre', 'Louis', 'Paul', 'Alexandre', 'Nicolas', 'Quentin', 'Florian', 'Adrien', 'Mathieu', 'Benjamin',
  'Gaël', 'Yann', 'Damien', 'Fabien', 'Jérémy', 'Kévin', 'Ludovic', 'Sébastien', 'Vincent', 'Xavier',
  'Enzo', 'Léo', 'Mattéo', 'Nolan', 'Ethan', 'Timothé', 'Baptistin', 'Jean-Luc', 'Pierre-Louis', 'Anthony',
]

const LAST = [
  'Martin', 'Bernard', 'Dubois', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Fournier', 'Girard', 'Lambert',
  'Roux', 'Vincent', 'Muller', 'Faure', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'François',
  'Fabre', 'Bousquet', 'Delmas', 'Cabannes', 'Sallefranque', 'Etcheverry', 'Iribarren', 'Etchegaray', 'Larrouy', 'Cazenave',
  'Peyresblanques', 'Duprat', 'Lasserre', 'Barrère', 'Couzinet', 'Bergerac', 'Castaing', 'Soulé', 'Rey', 'Vidal',
  'Combes', 'Roussel', 'Serin', 'Prat', 'Bonnefond', 'Marchand', 'Costes', 'Verdier', 'Teulière', 'Albouy',
]

const TEMPLATE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH', 'CE', 'CE', 'CE',
  'WG', 'WG', 'WG', 'FB', 'FB',
  'FL', 'CE', 'LP',
]

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0xd2f7 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
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
    if (rng() < 0.08) q += 6 // the local legend
    q = Math.max(42, Math.min(72, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.55
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: 'FRA', q, gk })
  }
  return out
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'FRA', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const PROD2: RawClub[] = [
  club('grenoble', 'FC Grenoble Rugby', 'Grenoble', 'Grenoble', 'Stade des Alpes', 20068, ['#1a3a75', '#c02f3a'], 62, 900_000),
  club('vannes', 'RC Vannes', 'Vannes', 'Vannes', 'Stade de la Rabine', 11430, ['#12295c', '#f0eadc'], 61, 850_000),
  club('brive', 'CA Brive', 'Brive', 'Brive-la-Gaillarde', 'Stade Amédée-Domenech', 15000, ['#111111', '#ffffff'], 60, 800_000),
  club('beziers', 'AS Béziers Hérault', 'Béziers', 'Béziers', 'Stade Raoul-Barrière', 18555, ['#c02f3a', '#1a3a75'], 57, 600_000),
  club('provence', 'Provence Rugby', 'Provence', 'Aix-en-Provence', 'Stade Maurice-David', 5000, ['#0e0e0e', '#c9a227'], 56, 550_000),
  club('oyonnax', 'Oyonnax Rugby', 'Oyonnax', 'Oyonnax', 'Stade Charles-Mathon', 11400, ['#c02f3a', '#0e0e0e'], 56, 550_000),
  club('colomiers', 'Colomiers Rugby', 'Colomiers', 'Colomiers', 'Stade Michel-Bendichou', 11430, ['#1e5aa8', '#ffffff'], 53, 420_000),
  club('nevers', 'USON Nevers', 'Nevers', 'Nevers', 'Stade du Pré-Fleuri', 7000, ['#1a3a5c', '#c9a227'], 53, 420_000),
  club('montdemarsan', 'Stade Montois', 'Mont-de-M.', 'Mont-de-Marsan', 'Stade Guy-Boniface', 8000, ['#c9a227', '#0e0e0e'], 51, 380_000),
  club('biarritz', 'Biarritz Olympique', 'Biarritz', 'Biarritz', 'Parc des Sports Aguiléra', 13400, ['#c02f3a', '#ffffff'], 50, 360_000),
  club('agen', 'SU Agen', 'Agen', 'Agen', 'Stade Armandie', 14000, ['#1a3a75', '#ffffff'], 49, 340_000),
  club('valence', 'Valence Romans Drôme', 'Valence', 'Valence', 'Stade Georges-Pompidou', 15000, ['#7a0c2e', '#c9a227'], 47, 300_000),
  club('dax', 'US Dax', 'Dax', 'Dax', 'Stade Maurice-Boyau', 8000, ['#c02f3a', '#f0eadc'], 46, 280_000),
  club('carcassonne', 'US Carcassonne', 'Carcassonne', 'Carcassonne', 'Stade Albert-Domec', 12000, ['#c9a227', '#1a3a75'], 45, 260_000),
]
