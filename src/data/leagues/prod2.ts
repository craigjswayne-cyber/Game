// The French second division - real clubs, grounds and colours.
// Squads generated deterministically in the 42-72 band: hardened
// journeymen, Espoirs graduates and the odd fallen Top 14 star.
//
// THE 2026-27 LEAGUE (research of 18 Oct 2026; the Pro D2 2026-27 tables):
// the real sixteen. Carcassonne (16th) and Mont-de-Marsan (15th, then beaten
// by Nice in the access match) went down; Narbonne (Nationale champions) and
// Nice came up; Aurillac and Soyaux-Angouleme, Pro D2 clubs the game never
// had, join. Sixteen clubs play thirty rounds, so the calendar gives this
// league two weeks the cup competitions use (calendar.ts, PROD2_EXTRA_WEEKS):
// no Pro D2 club plays in either cup.
//
// A club's REAL players are listed in REAL and each takes the shirt of a
// generated man in his position (withReal), so the generator fills only what
// the real men leave and every squad covers every position. Only names the research graded high or medium AND gave a position
// and an age are real here; the rest are left to the generator rather than
// given an invented age. More arrive through verified.ts and additions.ts.

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

// one name per man across the whole competition: a duplicate would cost the
// second club a real shirt, since the world builder keeps only the first
const usedNames = new Set<string>()

/** Real men at a club, by id (2026-27 research, see the header and
 *  withReal). */
const REAL: Record<string, RawPlayer[]> = {
  // Forwards from the allrugby / LNR effectif and the 2026-27 squad section of
  // fr.wikipedia (search summaries, Oct 2026); allrugby's ages, which can be a
  // year over for an August-October birthday. Burin (Castres) and Farrance
  // (also placed at Nice and Aurillac) are left out as conflicting; Ruffenach
  // too, whose listed age the research itself doubted.
  grenoble: [
    { name: 'Cody Thomas', pos: 'LP', age: 30, nat: 'RSA', q: 62 },
    { name: 'Éli Églaine', pos: 'LP', age: 26, nat: 'FRA', q: 58 },
    { name: 'Tommy Raynaud', pos: 'LP', age: 32, nat: 'FRA', q: 58 },
    { name: 'Sascha Mistrulli', pos: 'LP', age: 21, nat: 'FRA', q: 52 },
    { name: 'Bastien Soury', pos: 'HK', age: 31, nat: 'FRA', q: 60 },
    { name: 'Lilian Rossi', pos: 'HK', age: 28, nat: 'FRA', q: 58 },
    { name: 'Florent Guion', pos: 'HK', age: 33, nat: 'FRA', q: 57 },
    { name: 'Jérémy Toevalu', pos: 'HK', age: 21, nat: 'FRA', q: 53 },
    { name: 'Johannes Jonker', pos: 'TP', age: 32, nat: 'RSA', q: 62 },
    { name: 'Giorgi Pertaia', pos: 'TP', age: 29, nat: 'GEO', q: 60 },
    { name: 'Zack Gauthier', pos: 'TP', age: 26, nat: 'FRA', q: 56 },
    { name: 'Théo Lavoine', pos: 'TP', age: 23, nat: 'FRA', q: 54 },
    // from Oyonnax (allrugby Grenoble transfers 2026/27; info.fr)
    { name: 'Manuel Leindekar', pos: 'LK', age: 29, nat: 'URU', q: 64, intl: true },
    { name: 'Brandon Nansen', pos: 'LK', age: 32, nat: 'SAM', q: 63, intl: true },
    { name: 'Cameron Holt', pos: 'LK', age: 29, nat: 'AUS', q: 61 },
    { name: 'Hans Lombard-Buret', pos: 'LK', age: 25, nat: 'FRA', q: 57 },
  ],
  // the squad presented at Fontfroide in July 2026 (echo-des-tribunes) and
  // all.rugby's Pro D2 transfers; Dan Jooste and Solomon Alaimalo arrive from
  // other files. Berguet is left out: the sources disagree on his first name.
  narbonne: [
    { name: 'Abraham Pole', pos: 'LP', age: 27, nat: 'NZL', q: 60 },
    { name: 'Thomas Vernet', pos: 'LP', age: 31, nat: 'FRA', q: 57 },
    { name: 'Facundo Pomponio', pos: 'TP', age: 34, nat: 'ARG', q: 59 },
    { name: 'Clément Bitz', pos: 'LK', age: 31, nat: 'FRA', q: 60 },
    { name: 'Caleb Timu', pos: 'N8', alt: ['FL'], age: 32, nat: 'AUS', q: 66, intl: true },
    { name: 'Cameron Wright', pos: 'SH', age: 32, nat: 'RSA', q: 62 },
    { name: 'Aphiwe Dyantyi', pos: 'WG', age: 32, nat: 'RSA', q: 68, intl: true },
    { name: 'Victor Hannoun', pos: 'WG', age: 22, nat: 'FRA', q: 56 },
    { name: 'Axel Bévia', pos: 'WG', age: 24, nat: 'FRA', q: 57 },
  ],
  // allrugby/LNR roster via info.fr and rugbypass; Rouet, Falgoux and Joel
  // Kpoku arrive from other files
  nice: [
    { name: 'Clément Martinez', pos: 'HK', age: 31, nat: 'FRA', q: 57 },
    { name: 'Francis Saili', pos: 'CE', age: 35, nat: 'NZL', q: 63, intl: true },
  ],
  // a fan forum's list, so only the three names it shares with a second
  // source; Maël Perrin is left out (Montpellier report him back from loan)
  aurillac: [
    { name: "Mosa'ati Moala", pos: 'LK', age: 24, nat: 'TGA', q: 57 },
    { name: 'Lucas Oudard', pos: 'FL', age: 25, nat: 'FRA', q: 57 },
  ],
  // the club's current squad (en.wikipedia, search summary) and the 2026 Pro
  // D2 transfer lists
  angouleme: [
    { name: 'Élias Coulibaly', pos: 'LP', age: 25, nat: 'FRA', q: 55 },
    { name: 'Mathieu Bonnot', pos: 'HK', age: 31, nat: 'FRA', q: 57 },
    { name: 'Richie Arnold', pos: 'LK', age: 36, nat: 'AUS', q: 62, intl: true },
    { name: 'Giorgi Javakhia', pos: 'LK', age: 29, nat: 'GEO', q: 58 },
    { name: 'Emilio Branca', pos: 'FL', age: 18, nat: 'ITA', q: 50 },
    { name: 'Ben Botica', pos: 'FH', age: 37, nat: 'NZL', q: 62 },
    // from Benetton
    { name: 'François Carlo Mey', pos: 'CE', alt: ['FB'], age: 23, nat: 'ITA', q: 58 },
    { name: 'Matthys Gratien', pos: 'WG', age: 27, nat: 'FRA', q: 55 },
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
  const rng = mulberry32(0xd2f7 ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
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
    if (rng() < 0.08) q += 6 // the local legend
    q = Math.max(42, Math.min(72, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.55
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: 'FRA', q, gk })
  }
  return withReal(out, REAL[clubId] ?? [])
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'FRA', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const PROD2: RawClub[] = [
  club('grenoble', 'RC Grenoble', 'Grenoble', 'Grenoble', 'Stade des Alpes', 20068, ['#1a3a75', '#c02f3a'], 62, 900_000),
  {
    id: 'montauban', name: 'RC Montauban', short: 'Montauban',
    city: 'Montauban', country: 'FRA',
    stadium: 'Stade Sapiac', capacity: 12600,
    colors: ['#007749', '#000000'],
    rep: 63, budget: 600000,
    players: [
      { name: 'Malik Hamadache', pos: 'LP', age: 33, nat: 'FRA', q: 58 },
      { name: 'Vasil Kakovin', pos: 'LP', age: 34, nat: 'GEO', q: 56 },
      { name: 'Vincent Pélo', pos: 'LP', age: 34, nat: 'FRA', q: 56 },
      { name: 'Anthony Étrillard', pos: 'HK', age: 32, nat: 'FRA', q: 61 },
      { name: 'Mickaël Ivaldi', pos: 'HK', age: 35, nat: 'FRA', q: 57 },
      { name: 'Paea Fa\'anunu', pos: 'TP', age: 33, nat: 'TGA', q: 58 },
      { name: 'Sila Puafisi', pos: 'TP', age: 36, nat: 'TGA', q: 54 },
      { name: 'Beka Sheklashvili', pos: 'LK', age: 31, nat: 'GEO', q: 59 },
      { name: 'Piula Fa\'asalele', pos: 'LK', age: 34, nat: 'TGA', q: 57 },
      { name: 'Leva Fifita', pos: 'LK', age: 32, nat: 'TGA', q: 62, intl: true },
      { name: 'Thibault Lassalle', pos: 'LK', age: 34, nat: 'FRA', q: 55 },
      { name: 'Adrien Séguret', pos: 'N8', alt: ['FL'], age: 27, nat: 'FRA', q: 60 },
      { name: 'Fabien Sanconnie', pos: 'FL', alt: ['N8'], age: 31, nat: 'FRA', q: 61 },
      { name: 'Clément Ancely', pos: 'FL', alt: ['LK'], age: 29, nat: 'FRA', q: 60 },
      { name: 'Loïc Godener', pos: 'FL', age: 30, nat: 'FRA', q: 59 },
      { name: 'Wandrille Picault', pos: 'N8', age: 29, nat: 'FRA', q: 57 },
      { name: 'Théo Idjellidaine', pos: 'SH', age: 24, nat: 'FRA', q: 61 },
      { name: 'Enzo Sanga', pos: 'SH', age: 25, nat: 'FRA', q: 60 },
      { name: 'Jérôme Bosviel', pos: 'FH', alt: ['FB'], age: 34, nat: 'FRA', q: 64, gk: true },
      { name: 'Thomas Fortunel', pos: 'FH', age: 26, nat: 'FRA', q: 62, gk: true },
      { name: 'Julien Heriteau', pos: 'CE', age: 30, nat: 'FRA', q: 63 },
      { name: 'Pierre Fouyssac', pos: 'CE', age: 33, nat: 'FRA', q: 60 },
      { name: 'Florent Massip', pos: 'CE', alt: ['FB'], age: 29, nat: 'FRA', q: 60 },
      // Josaia Raisuqe was listed here; he died on 8 May 2025 (CNN). Removed by
      // the owner's instruction, 18 Oct 2026 - see DECEASED in verified.ts.
      { name: 'Eroni Sau', pos: 'WG', age: 35, nat: 'FIJ', q: 58 },
      { name: 'Yann Peysson', pos: 'WG', age: 27, nat: 'FRA', q: 57 },
      { name: 'Jérémy Sinzelle', pos: 'WG', alt: ['FB'], age: 34, nat: 'FRA', q: 56 },
      { name: 'Thomas Salles', pos: 'FB', age: 27, nat: 'FRA', q: 61 },
    ],
  },
  club('brive', 'RC Brive', 'Brive', 'Brive-la-Gaillarde', 'Stade Amédée-Domergue', 15000, ['#111111', '#ffffff'], 60, 800_000),
  club('beziers', 'RC Béziers', 'Béziers', 'Béziers', 'Stade Raoul-Berrière', 18555, ['#c02f3a', '#1a3a75'], 57, 600_000),
  club('provence', 'RC Provence', 'Provence', 'Aix-en-Provence', 'Stade Maurice-Davy', 5000, ['#0e0e0e', '#c9a227'], 56, 550_000),
  club('oyonnax', 'RC Oyonnax', 'Oyonnax', 'Oyonnax', 'Stade Charles-Mathieu', 11400, ['#c02f3a', '#0e0e0e'], 56, 550_000),
  club('colomiers', 'RC Colomiers', 'Colomiers', 'Colomiers', 'Stade Michel-Bendicourt', 11430, ['#1e5aa8', '#ffffff'], 53, 420_000),
  club('nevers', 'RC Nevers', 'Nevers', 'Nevers', 'Stade du Pré-Fleuri', 7000, ['#1a3a5c', '#c9a227'], 53, 420_000),
  club('biarritz', 'RC Biarritz', 'Biarritz', 'Biarritz', 'Parc des Sports Aguillon', 13400, ['#c02f3a', '#ffffff'], 50, 360_000),
  club('agen', 'RC Agen', 'Agen', 'Agen', 'Stade Armandin', 14000, ['#1a3a75', '#ffffff'], 49, 340_000),
  club('valence', 'RC Valence', 'Valence', 'Valence', 'Stade Georges-Pontier', 15000, ['#7a0c2e', '#c9a227'], 47, 300_000),
  club('dax', 'RC Dax', 'Dax', 'Dax', 'Stade Maurice-Boyer', 8000, ['#c02f3a', '#f0eadc'], 46, 280_000),
  // ---- new for 2026-27 (owner, 18 Oct 2026: the real sixteen). Names follow
  // the house style; Narbonne and Nice take AS rather than RC for the reason
  // Toulon and Vannes do in the Elite 14 - RC Narbonne is the real club's own
  // short name, and RC Nice the old Rugby Club Nice Cote d'Azur's. Grounds
  // named for a person take a near-miss (Marcel-Volot, Jean-Alric, Chanzy);
  // Narbonne's is a generic name and keeps. Figures are the research's:
  // Nice's capacity is approximate (a 3,000 ground with a temporary stand)
  // and its colours, like Narbonne's and Aurillac's, were from memory there.
  club('narbonne', 'AS Narbonne', 'Narbonne', 'Narbonne', "Parc des Sports et de l'Amitié", 12000, ['#f28c00', '#0e0e0e'], 50, 360_000),
  club('nice', 'AS Nice', 'Nice', 'Nice', 'Stade Marcel-Valot', 4400, ['#c8102e', '#0e0e0e'], 53, 450_000),
  club('aurillac', 'RC Aurillac', 'Aurillac', 'Aurillac', 'Stade Jean-Alaric', 9000, ['#c8102e', '#1a3a75'], 49, 340_000),
  // Soyaux-Angouleme XV: a two-town club, named for the larger town
  club('angouleme', 'RC Angoulême', 'Angoulême', 'Angoulême', 'Stade Chansy', 8000, ['#5b2a86', '#b39ddb'], 52, 400_000),
]
