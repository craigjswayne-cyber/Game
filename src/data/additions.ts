// Real players missing from the squad files altogether.
//
// The relocation table in verified.ts fixes a man listed at the wrong club. It
// cannot fix a man the files never mention, and the data audit turned up cases
// of exactly that: La Rochelle had ONE specialist scrum-half, because the two
// they really field are Thomas Berjon and Teddy Iribaren and only Berjon was
// written down. A squad with one nine plays a centre at nine the first time he
// pulls a hamstring.
//
// So this is the other half of the same job: a short, hand-checked list of real
// players and the club they really turn out for, appended to that club's squad
// at world creation. It is deliberately small. Filling gaps with invented names
// is what the generator already does, and it does it better than a guess would.
//
// RULES FOR ADDING TO THIS TABLE
//   1. Only a player whose 2025-26 club you have actually checked, with the
//      source in the comment. The same rule as verified.ts, for the same
//      reason: two automated passes at squad data have damaged it before.
//   2. Only to close a gap the data audit is complaining about. This is not a
//      place to make squads bigger for its own sake - every entry is a shirt
//      that would otherwise be worn by a generated name.
//   3. Age, position and quality are judged the same way as the rest of the
//      files: q is his standing in the league he plays in, not a world rating.
//   4. Never add a name that already exists anywhere in the files. That is a
//      relocation, and it belongs in verified.ts. The audit fails on it.
//   5. CORROBORATE THE LIST. This environment cannot fetch pages - every direct
//      request is refused by the proxy - so the only source is a search engine's
//      summary of one, and a summary can hallucinate a name. The test that works:
//      if the squad list it quotes contains men ALREADY in our data at that club,
//      the list is really that club's squad and the other names in it can be
//      trusted. Scarlets' prop list named Henry Thomas and Archer Holz, both
//      already in our Scarlets squad, which is why Hepburn below is in.
import type { RawPlayer } from './types'

export const EXTRA_PLAYERS: Record<string, RawPlayer[]> = {
  // La Rochelle's other scrum-half. Kerr-Barlow left for Stade Francais at the
  // end of 2024-25, which leaves Iribaren and Berjon sharing the nine shirt;
  // the files only had Berjon.
  // ---- the 2026-27 window, second instalment (owner's v1.1.6 list) --------
  exeter: [
    // Bath's published 2026/27 squad dropped these two with nowhere to go
    // (see prem2526.ts's Bath note); the owner's list lands them at Exeter.
    { name: 'Will Butt', pos: 'CE', age: 26, nat: 'WAL', q: 70, intl: true },
    { name: 'Sam Harris', pos: 'CE', age: 21, nat: 'WAL', q: 62 },
    // Saracens' young wing, not the Reds number eight of the same name -
    // different shirt and age, so the dedup builds both.
    { name: 'Harry Wilson', pos: 'WG', age: 22, nat: 'ENG', q: 64 },
  ],
  saracens: [
    // Bath's squad list dropped Barbeary the same way; the owner's list says
    // Saracens.
    { name: 'Alfie Barbeary', pos: 'HK', alt: ['N8'], age: 26, nat: 'ENG', q: 76, intl: true },
    // The Northampton scrum-half. The note above about "one player per name"
    // predates the namesake-aware dedup: the Cornish Pirates full-back of
    // the same name is a different shirt and age, so both now build.
    { name: 'Tom James', pos: 'SH', age: 25, nat: 'ENG', q: 68 },
  ],
  la_rochelle: [
    { name: 'Davit Niniashvili', pos: 'FB', alt: ['WG'], age: 24, nat: 'GEO', q: 81, intl: true },
    { name: 'Teddy Iribaren', pos: 'SH', age: 34, nat: 'FRA', q: 74, gk: true },
  ],
  // Boris Wenger used to be added here to cover Harlequins' loosehead gap. The
  // 2025/26 squad guide names him in the squad, so the addition became a
  // duplicate and the guide's entry is the better one. Removed.
  //
  // Two men the guide takes OUT of the Premiership, who then belonged nowhere:
  // relocating them from a Premiership file stopped working once that file no
  // longer listed them, so they are added at their real clubs instead.
  cardiff: [
    { name: 'Iwan Stephens', pos: 'WG', age: 25, nat: 'WAL', q: 63 },
    // Left Bristol for Cardiff and competes for the ten shirt there in 2025-26.
    { name: 'Callum Sheedy', pos: 'FH', alt: ['FB'], age: 30, nat: 'WAL', q: 74, gk: true, intl: true },
  ],
  bulls: [
    { name: 'Corne Beets', pos: 'LK', age: 27, nat: 'RSA', q: 70 },
    { name: 'Curwin Bosch', pos: 'FH', alt: ['FB'], age: 29, nat: 'RSA', q: 73, gk: true },
    { name: 'Sintu Manjezi', pos: 'LK', age: 31, nat: 'RSA', q: 67 },
    { name: 'Nama Xaba', pos: 'FL', age: 28, nat: 'RSA', q: 70 },
    // Three seasons at Leicester, then home to the Bulls on a two-year deal
    // from 1 July 2025.
    { name: 'Handre Pollard', pos: 'FH', age: 31, nat: 'RSA', q: 87, gk: true, intl: true },
  ],
  // Clermont had NO recognised full-back in the files at all - the worst single
  // gap the audit found. Hamdaoui has been their arriere since 2024, after five
  // seasons and 120-odd games at Stade Francais, and covers the wing too.
  clermont: [
    { name: 'Kylan Hamdaoui', pos: 'FB', alt: ['WG'], age: 32, nat: 'FRA', q: 70 },
  ],
  // Scarlets had one loosehead and two and a half flankers. Both names come off
  // squad lists corroborated by men already in our Scarlets squad - Henry Thomas
  // and Archer Holz in the prop list, Josh Macleod and Dan Davis in the back-row
  // one. Hepburn is the long-serving Exeter and England loosehead.
  scarlets: [
    { name: 'Gareth Anscombe', pos: 'FH', age: 35, nat: 'WAL', q: 76, gk: true, intl: true },
    { name: 'Alec Hepburn', pos: 'LP', age: 32, nat: 'ENG', q: 71 },
    { name: 'Tristan Davies', pos: 'FL', age: 23, nat: 'WAL', q: 63 },
  ],
  // From Moana Pasifika's own named 2026 squad, corroborated by Fine Inisi and
  // Danny Toala already being ours. Patafilo arrived from Kyuden Voltex.
  moana: [
    { name: 'Ngani Laumape', pos: 'CE', age: 33, nat: 'NZL', q: 74 },
    { name: 'Solomon Alaimalo', pos: 'FB', alt: ['WG'], age: 30, nat: 'SAM', q: 64 },
    { name: 'Pepesana Patafilo', pos: 'WG', age: 29, nat: 'FIJ', q: 68 },
  ],
  // ---- the 2026-27 Premiership window: men Northampton let go, restored at
  // the clubs that signed them.
  //
  // Their entries were hand-authored at Northampton and were deleted when the
  // Saints published their 2026/27 list, which said they had left but not
  // where they went. The transfer list says: three to Newcastle, one to
  // Harlequins. Nothing here is invented - each is his original authored
  // entry, recovered from the commit that removed him, which is why this is
  // an addition rather than a guess.
  //
  // Tom James went the same way, to Saracens, and is deliberately NOT here:
  // the world builder allows one player per name, and taking him for Saracens
  // would delete the Cornish Pirates full-back of the same name. One signing
  // lost beats one real player destroyed.
  newcastle: [
    { name: 'George Turner', pos: 'HK', age: 33, nat: 'SCO', q: 74, intl: true },
    { name: 'Tom West', pos: 'LP', age: 29, nat: 'ENG', q: 74 },
    { name: 'Elliot Millar Mills', pos: 'TP', age: 33, nat: 'SCO', q: 72, intl: true },
    { name: 'Sam Graham', pos: 'FL', alt: ['N8'], age: 28, nat: 'ENG', q: 72 },
    // ---- the 2026-27 window, second instalment (owner's v1.1.6 list, 28
    // Aug). Same doctrine as the Northampton block above: the list is the
    // checked source for the MOVE; age, position and quality are judged the
    // way the rest of this file judges them. Only men whose position and age
    // this session could state with confidence are here - the rest of the
    // owner's arrivals (deep academy and overseas fringe names) are left to
    // the generator, which this file's own header says guesses better.
    { name: 'Chris Harris', pos: 'CE', age: 36, nat: 'SCO', q: 68, intl: true },
    // his hand-authored Force entry moves with him (hand-added men are exempt
    // from the relocation table, so the entry itself changes blocks)
    { name: 'Franco Molina', pos: 'LK', age: 29, nat: 'ARG', q: 70, intl: true },
    { name: 'James Harper', pos: 'SH', age: 23, nat: 'ENG', q: 64 },
    { name: 'Max Hicks', pos: 'FL', alt: ['LK'], age: 24, nat: 'ENG', q: 62 },
    { name: 'Rus Tuima', pos: 'LK', age: 21, nat: 'ENG', q: 63 },
  ],
  harlequins: [
    { name: 'George Furbank', pos: 'FB', alt: ['FH'], age: 29, nat: 'ENG', q: 82, intl: true },
  ],
  // Two shirts the 2026-27 window emptied, closed with the men the transfer
  // list itself names as arriving - the strongest source available, and the
  // only two of the thirteen new gaps the page actually covers.
  //
  // Leicester lost Nicky Smith to Sale and were left with ONE specialist
  // loosehead; Sale released WillGriff John and were left with one tighthead.
  // The page names Vunipola and Francis as their replacements. Ages and
  // quality are judged the way the rest of this file judges them: two
  // long-serving Test front-rowers in the late stage of their careers.
  leicester: [
    { name: 'Mako Vunipola', pos: 'LP', age: 35, nat: 'ENG', q: 72, intl: true },
    { name: 'Elliott Stooke', pos: 'LK', age: 33, nat: 'ENG', q: 70 },
    // 2026-27 second instalment (owner's v1.1.6 list): the hookers arriving
    // from Harlequins and Moana Pasifika.
    { name: 'Jack Doorey-Palmer', pos: 'HK', age: 23, nat: 'ENG', q: 62 },
    { name: 'Sam Moli', pos: 'HK', age: 27, nat: 'TGA', q: 66, intl: true },
  ],
  sale: [
    { name: 'Courtney Lawes', pos: 'LK', alt: ['FL'], age: 37, nat: 'ENG', q: 74, intl: true },
    { name: 'Tomas Francis', pos: 'TP', age: 34, nat: 'WAL', q: 70, intl: true },
    // 2026-27 second instalment (owner's v1.1.6 list): the Drua wing.
    { name: 'Ponepati Loganimasi', pos: 'WG', age: 24, nat: 'FIJ', q: 70, intl: true },
  ],
  // Ion Neculai's move to Northampton (the club's own published 2026/27
  // squad list, supplied by the user) left Zebre a single real tighthead in
  // Muhamed Hasa. Nocera is Zebre's own: an Italy U20 front-rower out of
  // their academy, in the senior rotation - judged against the league he
  // plays in, a squad man, which is what the shirt needs.
  zebre: [
    { name: 'Albert Batista', pos: 'FL', age: 24, nat: 'ITA', q: 58 },
    { name: 'Matteo Nocera', pos: 'TP', age: 21, nat: 'ITA', q: 58 },
  ],
  // The Force's outside backs for 2026 are Bridge, Beale, Grealy and Lancaster.
  // Beale and Grealy are already ours, which makes the list good; Bridge is the
  // former All Blacks winger, and the Force had two specialists without him.
  force: [
    { name: 'Sio Tomkinson', pos: 'CE', age: 29, nat: 'NZL', q: 71 },
    { name: 'James Ramm', pos: 'FB', alt: ['WG'], age: 28, nat: 'AUS', q: 67 },
    { name: 'George Bridge', pos: 'WG', age: 30, nat: 'NZL', q: 71 },
  ],

  // ---- THE AUGUST 2026 WINDOW, VERIFIED ONLINE ---------------------------
  // Men brought into the world for 2026/27. The user's transfer PDF first
  // suggested most of these names, but every entry below was then verified
  // against confirmed sources (official club announcements first) in August
  // 2026, and each man sits at his CONFIRMED club - the PDF's destination
  // where it was right, the real one where it was not. Ages are as of
  // August 2026; quality is judged the way the rest of this file judges it,
  // against the league each man arrives into. Bath and Northampton are
  // untouched: their squads are the clubs' own official lists.
  gloucester: [
    { name: 'Phil Cokanasiga', pos: 'WG', age: 24, nat: 'ENG', q: 66 },
    // 2026-27 second instalment (owner's v1.1.6 list): the experienced
    // half-back and lock the window brings in.
    { name: 'Dan Robson', pos: 'SH', age: 34, nat: 'ENG', q: 70 },
    { name: 'Joe Joyce', pos: 'LK', age: 31, nat: 'ENG', q: 67 },
  ],
  sharks: [
    { name: 'Andre Esterhuizen', pos: 'CE', age: 32, nat: 'RSA', q: 82, intl: true },
  ],
  racing92: [
    { name: 'Romain Taofifenua', pos: 'LK', age: 36, nat: 'FRA', q: 70, intl: true },
    { name: 'Sam James', pos: 'CE', age: 32, nat: 'ENG', q: 69 },
  ],
  toulon: [
    { name: 'Kyle Sinckler', pos: 'TP', age: 33, nat: 'ENG', q: 79, intl: true },
    { name: 'Lewis Ludlam', pos: 'FL', age: 30, nat: 'ENG', q: 77, intl: true },
    { name: 'Antoine Frisch', pos: 'CE', age: 30, nat: 'IRE', q: 74, intl: true },
  ],
  bordeaux: [
    { name: 'Alex Moon', pos: 'LK', age: 29, nat: 'ENG', q: 69 },
    { name: 'Salesi Rayasi', pos: 'WG', age: 29, nat: 'FIJ', q: 70 },
  ],
  stade_francais: [
    { name: 'Israel Leota', pos: 'LP', age: 27, nat: 'SAM', q: 62 },
  ],
  toulouse: [
    { name: 'Leo Banos', pos: 'FL', age: 24, nat: 'FRA', q: 70 },
  ],
  castres: [
    { name: 'Christian Ambadiang', pos: 'WG', age: 26, nat: 'FRA', q: 68 },
  ],
  vannes: [
    { name: 'Joe Jonas', pos: 'WG', age: 23, nat: 'RSA', q: 66 },
  ],
  perpignan: [
    { name: 'Jonny Gray', pos: 'LK', age: 32, nat: 'SCO', q: 77, intl: true },
    { name: 'Lachlan Swinton', pos: 'FL', age: 29, nat: 'AUS', q: 72, intl: true },
    { name: 'Antoine Aucagne', pos: 'FH', age: 24, nat: 'FRA', q: 63, gk: true },
  ],
  biarritz: [
    { name: 'Thomas Dolhagaray', pos: 'CE', age: 26, nat: 'FRA', q: 58 },
    { name: 'Kylian Jaminet', pos: 'FB', age: 27, nat: 'FRA', q: 65, gk: true },
  ],
  provence: [
    { name: 'Izack Rodda', pos: 'LK', age: 30, nat: 'AUS', q: 75, intl: true },
  ],
  munster: [
    { name: 'Diarmuid Kilgallen', pos: 'WG', age: 25, nat: 'IRE', q: 66 },
  ],
  stormers: [
    { name: 'Oli Kebble', pos: 'LP', age: 34, nat: 'SCO', q: 66 },
    { name: 'JD Schickerling', pos: 'LK', age: 31, nat: 'RSA', q: 69 },
  ],
  glasgow: [
    { name: 'Patrick Schickerling', pos: 'TP', age: 27, nat: 'ENG', q: 70 },
  ],
  steelers: [
    { name: 'Brodie Retallick', pos: 'LK', age: 35, nat: 'NZL', q: 80, intl: true },
  ],
  benetton: [
    { name: 'Matt Gallagher', pos: 'FB', age: 30, nat: 'ITA', q: 70 },
  ],
  crusaders: [
    { name: "Leicester Fainga'anuku", pos: 'WG', alt: ['CE'], age: 26, nat: 'NZL', q: 81, intl: true },
  ],
  chiefs: [
    { name: 'Liam Coombes-Fabling', pos: 'WG', age: 23, nat: 'NZL', q: 62 },
  ],
  highlanders: [
    { name: 'Shannon Frizell', pos: 'FL', age: 32, nat: 'NZL', q: 78, intl: true },
    { name: 'Lucas Casey', pos: 'N8', age: 23, nat: 'NZL', q: 60 },
  ],
  blues: [
    { name: 'Torian Barnes', pos: 'LK', age: 23, nat: 'NZL', q: 61 },
  ],
  drua: [
    { name: 'Virimi Vakatawa', pos: 'CE', age: 34, nat: 'FRA', q: 73, intl: true },
    { name: 'Manasa Mataele', pos: 'WG', age: 29, nat: 'FIJ', q: 68 },
  ],
  sungoliath: [
    { name: 'Sam Cane', pos: 'FL', age: 34, nat: 'NZL', q: 78, intl: true },
  ],
  verblitz: [
    { name: 'Aaron Smith', pos: 'SH', age: 37, nat: 'NZL', q: 74, intl: true },
    { name: 'Pieter-Steph du Toit', pos: 'FL', age: 34, nat: 'RSA', q: 84, intl: true },
  ],
  wildknights: [
    { name: 'Lood de Jager', pos: 'LK', age: 33, nat: 'RSA', q: 79, intl: true },
    { name: 'Marika Koroibete', pos: 'WG', age: 34, nat: 'AUS', q: 78, intl: true },
  ],
  spears: [
    { name: 'Shaun Stevenson', pos: 'FB', alt: ['WG'], age: 28, nat: 'NZL', q: 80, intl: true },
  ],
  canon: [
    { name: 'Jesse Kriel', pos: 'CE', age: 32, nat: 'RSA', q: 81, intl: true },
  ],
  bluerevs: [
    { name: 'Kwagga Smith', pos: 'FL', age: 33, nat: 'RSA', q: 78, intl: true },
  ],
  blackrams: [
    { name: 'TJ Perenara', pos: 'SH', age: 34, nat: 'NZL', q: 76, intl: true },
  ],
  drocks: [
    { name: 'Steve Cummins', pos: 'LK', age: 31, nat: 'AUS', q: 60 },
    { name: 'Jasper Wiese', pos: 'N8', age: 30, nat: 'RSA', q: 83, intl: true },
  ],
  hondaheat: [
    { name: 'Franco Mostert', pos: 'LK', age: 35, nat: 'RSA', q: 77, intl: true },
  ],
  dynaboars: [
    { name: 'Jackson Hemopo', pos: 'LK', age: 33, nat: 'NZL', q: 65 },
  ],
  ealing: [
    { name: 'Mikey Summerfield', pos: 'LK', age: 24, nat: 'ENG', q: 58 },
    // 2026-27 (owner's v1.1.6 list): Gloucester's departing back-three man.
    { name: 'Jacob Morris', pos: 'WG', alt: ['FB'], age: 24, nat: 'WAL', q: 60 },
  ],
  leinster: [
    { name: 'Joey Carbery', pos: 'FH', alt: ['FB'], age: 30, nat: 'IRE', q: 75, gk: true, intl: true },
  ],
  grenoble: [
    { name: 'Raffaele Storti', pos: 'WG', age: 27, nat: 'POR', q: 70, intl: true },
  ],
  nevers: [
    { name: 'Oskar Rixen', pos: 'CE', age: 24, nat: 'FRA', q: 63 },
  ],
  bristol: [
    { name: 'Matias Moroni', pos: 'CE', age: 35, nat: 'ARG', q: 68, intl: true },
    // ---- the 2026-27 window, second instalment (owner's v1.1.6 list, 28
    // Aug). Same doctrine as the Northampton block above: the list is the
    // checked source for the MOVE; age, position and quality are judged the
    // way the rest of this file judges them. Only men whose position and age
    // this session could state with confidence are here - the rest of the
    // owner's arrivals (deep academy and overseas fringe names) are left to
    // the generator, which this file's own header says guesses better.
    { name: 'Ethan Staddon', pos: 'N8', alt: ['FL'], age: 22, nat: 'ENG', q: 63 },
    { name: 'Josh Caulfield', pos: 'LK', age: 29, nat: 'ENG', q: 63 },
    // his Newcastle release and Bristol arrival are the same move; the only
    // Max Clark in the data is a generated namesake, so the real centre is
    // authored here (different shirt and age, so both build)
    { name: 'Max Clark', pos: 'CE', age: 31, nat: 'ENG', q: 66 },
  ],
  waratahs: [
    { name: 'Bernard Foley', pos: 'FH', age: 37, nat: 'AUS', q: 71, gk: true, intl: true },
  ],
  montpellier: [
    { name: 'Tom Banks', pos: 'FB', age: 32, nat: 'AUS', q: 70, intl: true },
  ],
  salefc: [
    { name: 'Will Addison', pos: 'FB', alt: ['CE'], age: 34, nat: 'IRE', q: 58, intl: true },
  ],
  cambridge: [
    { name: 'Ruaridh Dawson', pos: 'SH', age: 24, nat: 'SCO', q: 60 },
  ],
}

/** Everyone hand-added to this club, or an empty list. */
export const extraPlayers = (clubId: string): RawPlayer[] =>
  Object.prototype.hasOwnProperty.call(EXTRA_PLAYERS, clubId) &&
  Array.isArray(EXTRA_PLAYERS[clubId])
    ? EXTRA_PLAYERS[clubId]
    : []
