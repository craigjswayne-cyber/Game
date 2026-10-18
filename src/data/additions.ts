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

const EARLIER: Record<string, RawPlayer[]> = {
  // La Rochelle's other scrum-half. Kerr-Barlow left for Stade Francais at the
  // end of 2024-25, which leaves Iribaren and Berjon sharing the nine shirt;
  // the files only had Berjon.
  // ---- the 2026-27 window, second instalment (owner's v1.1.6 list) --------
  exeter: [
    // 147th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Stephen Varney', pos: 'SH', age: 25, nat: 'ITA', q: 82, intl: true },
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
    { name: 'Davit Niniashvili', pos: 'FB', alt: ['WG'], age: 24, nat: 'GEO', q: 82, intl: true },
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
    { name: 'Handre Pollard', pos: 'FH', age: 31, nat: 'RSA', q: 88, gk: true, intl: true },
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
  // one. Hepburn, the long-serving Exeter and England loosehead, was here too
  // until he left for Edinburgh in 2026 (see the 2026-27 window below).
  scarlets: [
    { name: 'Gareth Anscombe', pos: 'FH', age: 35, nat: 'WAL', q: 76, gk: true, intl: true },
    { name: 'Tristan Davies', pos: 'FL', age: 23, nat: 'WAL', q: 63 },
  ],
  // From Moana Pasifika's own named 2026 squad, corroborated by Fine Inisi and
  // Danny Toala already being ours. Patafilo arrived from Kyuden Voltex.
  moana: [
    { name: 'Ngani Laumape', pos: 'CE', age: 33, nat: 'NZL', q: 74 },
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
    { name: 'Franco Molina', pos: 'LK', age: 29, nat: 'ARG', q: 81, intl: true },
    { name: 'James Harper', pos: 'SH', age: 23, nat: 'ENG', q: 64 },
    { name: 'Max Hicks', pos: 'FL', alt: ['LK'], age: 24, nat: 'ENG', q: 62 },
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
    // home from Bath for 2026-27 (Planet Rugby, "Springboks prop Thomas du
    // Toit to return to South Africa"; Daily News, 13 Oct 2025, Kings Park).
    // prem2526.ts already took him off Bath's list; he was nowhere after it.
    // 21st in the owner's PHASE Top 200 (68th in FloRugby's Top 100).
    { name: 'Thomas du Toit', pos: 'TP', alt: ['LP'], age: 31, nat: 'RSA', q: 90, intl: true },
  ],
  racing92: [
    // 66th in the owner's PHASE Top 200. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Taniela Tupou', pos: 'TP', age: 30, nat: 'AUS', q: 87, intl: true },
    { name: 'Sam James', pos: 'CE', age: 32, nat: 'ENG', q: 69 },
  ],
  toulon: [
    // 118th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Ben White', pos: 'SH', age: 28, nat: 'SCO', q: 84, intl: true },
    { name: 'Kyle Sinckler', pos: 'TP', age: 33, nat: 'ENG', q: 79, intl: true },
    { name: 'Lewis Ludlam', pos: 'FL', age: 30, nat: 'ENG', q: 77, intl: true },
    { name: 'Antoine Frisch', pos: 'CE', age: 30, nat: 'IRE', q: 74, intl: true },
  ],
  bordeaux: [
    // 132nd. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Jefferson Poirot', pos: 'LP', age: 33, nat: 'FRA', q: 83, intl: true },
    { name: 'Alex Moon', pos: 'LK', age: 29, nat: 'ENG', q: 69 },
    { name: 'Salesi Rayasi', pos: 'WG', age: 29, nat: 'FIJ', q: 80 },
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
    { name: 'Jonny Gray', pos: 'LK', age: 32, nat: 'SCO', q: 84, intl: true },
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
    { name: "Leicester Fainga'anuku", pos: 'WG', alt: ['CE'], age: 26, nat: 'NZL', q: 83, intl: true },
  ],
  chiefs: [
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
    { name: 'Pieter-Steph du Toit', pos: 'FL', age: 34, nat: 'RSA', q: 90, intl: true },
  ],
  wildknights: [
    { name: 'Lood de Jager', pos: 'LK', age: 33, nat: 'RSA', q: 79, intl: true },
  ],
  spears: [
    { name: 'Shaun Stevenson', pos: 'FB', alt: ['WG'], age: 28, nat: 'NZL', q: 80, intl: true },
  ],
  canon: [
    { name: 'Jesse Kriel', pos: 'CE', age: 32, nat: 'RSA', q: 86, intl: true },
  ],
  bluerevs: [
    { name: 'Kwagga Smith', pos: 'FL', age: 33, nat: 'RSA', q: 78, intl: true },
  ],
  blackrams: [
    { name: 'TJ Perenara', pos: 'SH', age: 34, nat: 'NZL', q: 76, intl: true },
  ],
  drocks: [
    { name: 'Steve Cummins', pos: 'LK', age: 31, nat: 'AUS', q: 60 },
    { name: 'Jasper Wiese', pos: 'N8', age: 30, nat: 'RSA', q: 86, intl: true },
  ],
  hondaheat: [
    // 106th; stayed at Honda for 2026-27. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Pablo Matera', pos: 'FL', alt: ['N8'], age: 33, nat: 'ARG', q: 85, intl: true },
    { name: 'Franco Mostert', pos: 'LK', age: 35, nat: 'RSA', q: 77, intl: true },
  ],
  dynaboars: [
    { name: 'Jackson Hemopo', pos: 'LK', age: 33, nat: 'NZL', q: 65 },
  ],
  ealing: [
    // a prop, not a lock (all.rugby; research of 18 Oct 2026)
    { name: 'Mikey Summerfield', pos: 'TP', age: 24, nat: 'ENG', q: 58 },
    // Jacob Morris, Gloucester's departing back-three man, used to be added
    // here. He is Jake Morris, already authored at Gloucester: the 2026-27
    // window block in verified.ts moves that listing to Ealing instead.
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
    { name: 'Matias Moroni', pos: 'CE', age: 35, nat: 'ARG', q: 81, intl: true },
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
    // 124th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Adam Beard', pos: 'LK', age: 30, nat: 'WAL', q: 84, intl: true },
    { name: 'Tom Banks', pos: 'FB', age: 32, nat: 'AUS', q: 70, intl: true },
  ],
  salefc: [
    { name: 'Will Addison', pos: 'FB', alt: ['CE'], age: 34, nat: 'IRE', q: 58, intl: true },
  ],
  cambridge: [
    { name: 'Ruaridh Dawson', pos: 'SH', age: 24, nat: 'SCO', q: 60 },
  ],
  dragons: [
    // 129th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Dillon Lewis', pos: 'TP', age: 30, nat: 'WAL', q: 83, intl: true },
  ],
  bayonne: [
    // 176th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Mateo Carreras', pos: 'WG', age: 26, nat: 'ARG', q: 80, intl: true },
  ],
  'w:trailfinders': [
    // 4th in the owner's Women's Top 100. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Megan Jones', pos: 'CE', age: 29, nat: 'ENG', q: 88, intl: true },
    // 16th. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Abby Dow', pos: 'WG', age: 28, nat: 'ENG', q: 86, intl: true },
    // 34th (the ranking sheet spelt her Alana Borland). Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Alana Bremner', pos: 'LK', alt: ['FL'], age: 29, nat: 'NZL', q: 84, intl: true },
    // 62nd; from Loughborough; born 18 Aug 2002 (Wikipedia). Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Bo Westcombe-Evans', pos: 'WG', alt: ['FB'], age: 24, nat: 'ENG', q: 81, intl: true },
    // 92nd. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Ruby Tui', pos: 'WG', age: 34, nat: 'NZL', q: 78, intl: true },
  ],
  'w:glosharty': [
    // 71st; born 14 Nov 1996 (Wikipedia). Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Hannah Jones', pos: 'CE', age: 29, nat: 'WAL', q: 80, intl: true },
  ],
  'w:bordeaux': [
    // Madoussou Fall (20th in the owner's list) was here; she is the w_e1.ts
    // row Madoussou Fall-Raclot, which now carries these figures, so she is
    // built once (research of 18 Oct 2026).
  ],
  'w:grenoble': [
    // 46th in the owner's Women's Top 100; Grenoble Amazones per the owner's
    // verified database (7 Oct 2026), which the owner confirmed over a search
    // result naming Valsugana. Born 6 Dec 2001 (Wikipedia).
    { name: 'Vittoria Ostuni Minuzzi', pos: 'FB', age: 24, nat: 'ITA', q: 82, intl: true },
  ],
  'w:rennes': [
    // 72nd; Stade Rennais. Source: owner's PHASE Verified Player Club Database 2026-27 (7 Oct 2026).
    { name: 'Jade Ulutule', pos: 'SH', alt: ['CE'], age: 33, nat: 'FRA', q: 80, intl: true },
  ],
}

// ---- THE 2026-27 WINDOW, research of 18 Oct 2026 ---------------------------
// Real players at their 2026-27 clubs (2026 squads plus confirmed 2027 moves
// for Super Rugby) whom no squad file lists anywhere. The companion block in
// verified.ts moves the men who ARE already in a file. Every name was tied to
// its club by a cited source (club announcements, league transfer tables,
// season previews, matchday team sheets - search summaries, since page fetches
// were blocked) and only entries graded high or medium were taken. A name with
// no position, no age or no nationality in the research was left out rather
// than guessed: inventing a real man's age is not a fix. Ages are start-of-
// season ages as the research gave them (1 Aug 2026 north, 1 Feb 2026 south);
// q is judged against the league each man plays in, using the club's existing
// ratings as the yardstick. Rule 4 above still holds: nobody here exists in
// a squad file, and the audit checks it.
const WINDOW_2627: Record<string, RawPlayer[]> = {
  // Bath: nothing added. RugbyPass's 2026/27 list names three more (Scott Kirk,
  // Will Roue, Max Pearce) and sixteen senior-academy men, but Bath's squad is
  // the club's own published list (see verified.ts) and already 45 seniors -
  // three more put it over the 46-man senior limit (transferRules.ts
  // SQUAD_LIMIT), which actionfuzz holds every squad to.
  bristol: [
    // Bristol Bears front-row update: homegrown loosehead, new contract...
    { name: 'Andrew Turner', pos: 'LP', age: 24, nat: 'ENG', q: 64 },
  ],
  gloucester: [
    // Samoa Observer 'Fepuleai signs with Gloucester'
    { name: "Marco Fepulea'i", pos: 'TP', age: 31, nat: 'SAM', q: 69, intl: true },
  ],
  harlequins: [
    // Ruck 'Harlequins announce signing of Springbok tighthead'
    { name: 'Sampie Swiegers', pos: 'TP', age: 27, nat: 'RSA', q: 68 },
  ],
  newcastle: [
    // newcastleredbulls.com 'Francisco Moreno adds to propping options'
    { name: 'Francisco Moreno', pos: 'TP', age: 24, nat: 'ARG', q: 66, intl: true },
  ],
  sale: [
    // RugbyPass 'Sale Sharks sign under the radar South African prop'
    { name: 'Cebo Dlamini', pos: 'TP', age: 24, nat: 'RSA', q: 68 },
  ],
  saracens: [
    // SA Rugby Magazine 'Saracens sign Stormers tighthead'
    // RugbyPass 'Saracens sign cross-code Tongan torpedo from Champ Rugby'
    { name: 'Corné Weilbach', pos: 'TP', age: 24, nat: 'RSA', q: 64 },
    { name: "Sione Va'enuku", pos: 'CE', age: 24, nat: 'TGA', q: 65 },
  ],
  benetton: [
    // Planet Rugby URC ins and outs 2026/27
    // Planet Rugby
    // Wikipedia 2026-27 Benetton season
    { name: 'Jean Smith', pos: 'LK', age: 27, nat: 'RSA', q: 68 },
    { name: 'Matias Medrano', pos: 'TP', age: 24, nat: 'ARG', q: 62 },
    { name: 'Gonzalo Hughes', pos: 'LP', age: 25, nat: 'ARG', q: 62 },
    { name: 'Ivan Nemer', pos: 'TP', alt: ['LP'], age: 28, nat: 'ITA', q: 69, intl: true },
    { name: 'Tiziano Pasquali', pos: 'TP', age: 32, nat: 'ITA', q: 65, intl: true },
    { name: 'Destiny Aminu', pos: 'LP', age: 22, nat: 'ITA', q: 61 },
    { name: 'Marcos Gallorini', pos: 'TP', age: 26, nat: 'ITA', q: 62 },
    { name: 'Nicholas Gasperini', pos: 'HK', age: 21, nat: 'ITA', q: 61 },
    { name: "So'otala Fa'aso'o", pos: 'N8', alt: ['FL'], age: 29, nat: 'SAM', q: 68, intl: true },
    { name: 'Onisi Ratave', pos: 'WG', age: 27, nat: 'FIJ', q: 67 },
  ],
  bulls: [
    // bullsrugby.co.za / YFM 2026-05-11
    // Rugby365 / Planet Rugby 2026-05-11 (from Sharks, ex-Junior Bok
    // SuperSport / Daily News 2026-05-11 (from Sharks, tighthead, 2-year...
    { name: 'Luan Giliomee', pos: 'FH', age: 20, nat: 'RSA', q: 64 },
    { name: 'Hakeem Kunene', pos: 'FB', age: 21, nat: 'RSA', q: 64 },
    { name: 'Mawande Mdanda', pos: 'TP', age: 21, nat: 'RSA', q: 63 },
    { name: 'Dylan Maart', pos: 'WG', age: 24, nat: 'RSA', q: 66 },
    { name: 'Sango Xamlashe', pos: 'CE', age: 26, nat: 'RSA', q: 67 },
  ],
  cardiff: [
    // cardiffrugby.wales 'Le Roux becomes first signing following flurry of...
    // cardiffrugby.wales 'Semisi Paea signs for Cardiff' (27, Tonga...
    { name: 'Le Roux Malan', pos: 'CE', alt: ['WG'], age: 27, nat: 'NAM', q: 70, intl: true },
    { name: 'Semisi Paea', pos: 'LK', alt: ['FL'], age: 27, nat: 'TGA', q: 71, intl: true },
  ],
  connacht: [
    // Rugby World Leinster 2026-27 preview
    // all.rugby transfers Connacht 2026/27
    // Wikipedia 'Billy Bohan'
    { name: 'Will Connors', pos: 'FL', age: 29, nat: 'IRE', q: 70, intl: true },
    { name: 'Jerry Cahir', pos: 'LP', age: 22, nat: 'IRE', q: 60 },
    { name: 'Francois van Wyk', pos: 'LP', age: 34, nat: 'RSA', q: 66 },
    { name: 'Billy Bohan', pos: 'TP', age: 20, nat: 'IRE', q: 66, intl: true },
    { name: 'Matthew Victory', pos: 'HK', age: 24, nat: 'IRE', q: 62 },
  ],
  dragons: [
    // dragonsrfc.wales co-captains article names him in the senior...
    // dragonsrfc.wales 2025-03 'Wales U20s captain Beddall to join Dragons'
    // dragonsrfc.wales 'Ten new Dragons and counting'
    { name: 'Matthew Screech', pos: 'LK', age: 34, nat: 'WAL', q: 69, intl: true },
    { name: 'Harry Beddall', pos: 'FL', alt: ['N8'], age: 21, nat: 'WAL', q: 66 },
    { name: 'Levi Douglas', pos: 'LK', age: 30, nat: 'ENG', q: 67 },
    { name: 'Robert Hunt', pos: 'TP', age: 29, nat: 'RSA', q: 66 },
    { name: 'Jac Lloyd', pos: 'FH', age: 22, nat: 'WAL', q: 61 },
    { name: 'David Richards', pos: 'CE', alt: ['FB'], age: 26, nat: 'WAL', q: 62 },
    { name: 'Terrell Peita', pos: 'FL', alt: ['N8'], age: 25, nat: 'NZL', q: 68 },
    { name: 'Caio Parry', pos: 'WG', age: 20, nat: 'WAL', q: 60 },
  ],
  edinburgh: [
    // Rugby World URC 2026-27 preview Edinburgh
    // Scotsman 'Edinburgh's best starting XV for 26/27'
    // URC round 1 2026-27 team news, via search summary
    { name: 'James Grayson', pos: 'FH', age: 27, nat: 'ENG', q: 72 },
    { name: 'Kienan Higgins', pos: 'CE', age: 28, nat: 'USA', q: 67 },
    { name: 'Louie Chapman', pos: 'SH', age: 25, nat: 'NZL', q: 67 },
    { name: 'Geordie Gwynn', pos: 'WG', age: 24, nat: 'SCO', q: 64 },
    { name: 'Paul Hill', pos: 'TP', age: 31, nat: 'ENG', q: 68, intl: true },
    { name: 'Hector Patterson', pos: 'SH', age: 22, nat: 'SCO', q: 63 },
    // his hand-added Scarlets entry moves with him (Rugby World URC 2026-27
    // Edinburgh preview: from Scarlets); a capped England loosehead
    { name: 'Alec Hepburn', pos: 'LP', age: 32, nat: 'ENG', q: 71, intl: true },
  ],
  glasgow: [
    // glasgowwarriors.org 'Glasgow Warriors sign van der Merwe'
    // Wikipedia 2026-27 Glasgow Warriors season
    // glasgowwarriors.org 'Duncan signs professional contract'
    { name: 'Ruwald van der Merwe', pos: 'FL', age: 26, nat: 'RSA', q: 68 },
    { name: 'Seb Stephen', pos: 'HK', age: 23, nat: 'SCO', q: 62 },
    { name: 'Angus Fraser', pos: 'HK', age: 24, nat: 'SCO', q: 61 },
    { name: 'Jare Oguntibeju', pos: 'LK', age: 22, nat: 'SCO', q: 61 },
    { name: 'Macenzzie Duncan', pos: 'FL', age: 21, nat: 'SCO', q: 60 },
    { name: 'Fergus Watson', pos: 'WG', age: 24, nat: 'SCO', q: 64 },
  ],
  leinster: [
    // RugbyPass 'URC 2026/2027 squads rated: Leinster'. Not a new signing
    // RugbyPass squads rated: Leinster
    { name: 'Harry Byrne', pos: 'FH', age: 27, nat: 'IRE', q: 72, intl: true },
    { name: 'Jordan Larmour', pos: 'WG', alt: ['FB'], age: 29, nat: 'IRE', q: 76, intl: true },
    { name: 'Cormac Foley', pos: 'SH', age: 25, nat: 'IRE', q: 67 },
    { name: 'Charlie Tector', pos: 'CE', age: 22, nat: 'IRE', q: 67 },
    { name: 'Hugh Cooney', pos: 'CE', age: 23, nat: 'IRE', q: 63 },
    { name: 'Diarmuid Mangan', pos: 'LK', alt: ['FL'], age: 24, nat: 'IRE', q: 64 },
    { name: "Conor O'Tighearnaigh", pos: 'LK', age: 21, nat: 'IRE', q: 61 },
    { name: 'Alex Soroka', pos: 'FL', age: 26, nat: 'IRE', q: 67 },
    { name: 'James Culhane', pos: 'FL', alt: ['N8'], age: 24, nat: 'IRE', q: 64 },
    { name: 'Alex Usanov', pos: 'LP', age: 23, nat: 'IRE', q: 62 },
    { name: 'Andrew Sparrow', pos: 'TP', age: 24, nat: 'IRE', q: 62 },
    { name: 'Joshua Kenny', pos: 'WG', age: 21, nat: 'IRE', q: 60 },
    { name: 'Andrew Osborne', pos: 'WG', alt: ['FB'], age: 26, nat: 'IRE', q: 62 },
  ],
  lions: [
    // URC 2026/27 Ins & Outs (via search summary
    { name: 'Asad Moos', pos: 'SH', age: 24, nat: 'RSA', q: 66 },
  ],
  munster: [
    // RugbyPass
    // Irish Times 24 Jun 2026
    // munsterrugby.ie Jan 2025
    { name: 'Kieran Brookes', pos: 'TP', age: 36, nat: 'ENG', q: 67, intl: true },
    { name: 'Will Harrison', pos: 'FH', alt: ['FB', 'CE'], age: 27, nat: 'AUS', q: 71 },
    { name: 'Michael Milne', pos: 'LP', age: 27, nat: 'IRE', q: 68, intl: true },
    { name: 'Josh Wycherley', pos: 'LP', age: 27, nat: 'IRE', q: 66 },
    { name: 'Brian Gleeson', pos: 'FL', alt: ['N8'], age: 23, nat: 'IRE', q: 68 },
    { name: 'Edwin Edogbo', pos: 'LK', alt: ['FL'], age: 24, nat: 'IRE', q: 69, intl: true },
    { name: 'Sean Edogbo', pos: 'FL', age: 21, nat: 'IRE', q: 60 },
    { name: 'Max Clein', pos: 'HK', age: 21, nat: 'IRE', q: 59 },
    { name: 'Ronan Foxe', pos: 'TP', age: 21, nat: 'IRE', q: 58 },
    { name: "Evan O'Connell", pos: 'LK', age: 22, nat: 'IRE', q: 61 },
    { name: 'Kieran Ryan', pos: 'TP', age: 22, nat: 'IRE', q: 60 },
  ],
  scarlets: [
    // scarlets.wales 'Scarlets strengthen engine room with signing of...
    // scarlets.wales loan article and pre-season article ('Welsh-qualified...
    // scarlets.wales 'Scarlets sign hooker John McKee from Leinster'
    { name: 'Alex Groves', pos: 'LK', age: 25, nat: 'RSA', q: 68 },
    { name: 'Harvey Cuckson', pos: 'LK', age: 22, nat: 'WAL', q: 63 },
    { name: 'John McKee', pos: 'HK', age: 25, nat: 'IRE', q: 66 },
    { name: 'George Roberts', pos: 'HK', age: 23, nat: 'WAL', q: 62 },
    { name: 'Isaac Murray-Macgregor', pos: 'FB', alt: ['WG'], age: 21, nat: 'WAL', q: 62 },
    { name: 'Tom Allen', pos: 'LK', age: 22, nat: 'NZL', q: 64 },
  ],
  sharks: [
    // Rugby World 'Hollywoodbets Sharks: URC 2026-27 season preview' (via...
    { name: 'Stephan Lewies', pos: 'LK', age: 34, nat: 'RSA', q: 76, intl: true },
  ],
  stormers: [
    // Stormers captain 2026-27
    // Stormers 56-man squad 2026-09-17
    // Stormers 56-man squad
    { name: 'Ruhan Nel', pos: 'CE', age: 35, nat: 'RSA', q: 77 },
    { name: 'Deon Fourie', pos: 'FL', alt: ['HK'], age: 39, nat: 'RSA', q: 74, intl: true },
    { name: 'Jean-Luc du Plessis', pos: 'FH', age: 31, nat: 'RSA', q: 72 },
    { name: 'Imad Khan', pos: 'SH', age: 24, nat: 'RSA', q: 66 },
    { name: 'Keke Morabe', pos: 'FL', age: 23, nat: 'RSA', q: 65 },
    { name: 'Zachary Porthen', pos: 'TP', age: 23, nat: 'RSA', q: 63 },
    { name: 'Gary Porter', pos: 'LK', age: 23, nat: 'RSA', q: 63 },
    { name: 'Louw Nel', pos: 'FL', age: 22, nat: 'RSA', q: 62 },
  ],
  ulster: [
    // News Letter 2026 'three new arrivals'
    // News Letter 2026
    // Wikipedia 2026-27 Ulster season / Rugby World / Planet Rugby - may be...
    { name: 'Eduardo Bello', pos: 'TP', age: 30, nat: 'ARG', q: 72, intl: true },
    { name: 'Keynan Knox', pos: 'TP', age: 29, nat: 'RSA', q: 66 },
    { name: 'Eli Snyman', pos: 'LK', age: 27, nat: 'RSA', q: 68 },
    { name: 'Ben Donnell', pos: 'FL', alt: ['LK'], age: 27, nat: 'IRE', q: 66 },
    { name: 'Bryn Ward', pos: 'FL', age: 21, nat: 'IRE', q: 60 },
  ],
  zebre: [
    // zebreparma.it 'Zebre Parma: ecco la rosa completa per la stagione...
    { name: 'Luca Franceschetto', pos: 'LP', age: 23, nat: 'ITA', q: 58 },
    { name: 'Sergio Pelliccioli', pos: 'LP', age: 24, nat: 'ITA', q: 58 },
    { name: 'Juan Pitinari', pos: 'TP', age: 27, nat: 'ITA', q: 61 },
    { name: 'Francisco Minervino', pos: 'HK', age: 24, nat: 'ARG', q: 59 },
    { name: 'Giovanni Quattrini', pos: 'HK', age: 25, nat: 'ITA', q: 59 },
    { name: 'Franco Carrera', pos: 'LK', age: 25, nat: 'ARG', q: 60 },
    { name: 'Alex Mattioli', pos: 'LK', age: 24, nat: 'ITA', q: 59 },
    { name: 'Pietro Turrisi', pos: 'LK', age: 22, nat: 'ITA', q: 58 },
    { name: 'Iacopo Botturi', pos: 'FL', age: 23, nat: 'ITA', q: 59 },
    { name: 'Samuele Locatelli', pos: 'FL', age: 22, nat: 'ITA', q: 60 },
    { name: 'Alessandro Ortombina', pos: 'FL', age: 24, nat: 'ITA', q: 60 },
    { name: 'Francesco Ruffolo', pos: 'FL', age: 22, nat: 'ITA', q: 58 },
    { name: 'Davide Ruggeri', pos: 'N8', age: 24, nat: 'ITA', q: 59 },
    { name: 'Patricio Baronio', pos: 'SH', age: 25, nat: 'ITA', q: 59 },
    { name: 'Lorenzo Citton', pos: 'SH', age: 23, nat: 'ITA', q: 59 },
    { name: 'Thomas Dominguez', pos: 'SH', age: 23, nat: 'ITA', q: 60 },
    { name: 'Mirko Belloni', pos: 'CE', age: 22, nat: 'ITA', q: 59 },
    { name: 'Damiano Mazza', pos: 'CE', age: 23, nat: 'ITA', q: 60 },
    { name: 'Leonardo Sodo Migliori', pos: 'WG', age: 23, nat: 'ITA', q: 59 },
  ],
  bayonne: [
    // started J1 v Toulon at 12
    // rugbypass.com/fr Bayonne 2026-27
    // started J1 v Toulon at 1
    { name: 'Federico Mori', pos: 'CE', age: 26, nat: 'ITA', q: 75, intl: true },
    { name: 'Matthieu Uhila', pos: 'FL', age: 22, nat: 'FRA', q: 64 },
    { name: 'Andy Bordelai', pos: 'LP', age: 25, nat: 'FRA', q: 64 },
    { name: 'Lucas Martin', pos: 'HK', age: 26, nat: 'FRA', q: 65 },
    { name: 'Lucas Paulos', pos: 'LK', age: 28, nat: 'FRA', q: 68 },
    { name: 'Yohan Orabé', pos: 'FB', age: 27, nat: 'FRA', q: 68 },
  ],
  castres: [
    // castres-olympique.com effectif
    // started J5 v Toulouse 2026-27 at 15
    // castres-olympique.com effectif 2026-27
    { name: 'Jack Goodhue', pos: 'CE', age: 31, nat: 'NZL', q: 75, intl: true },
    { name: 'Théo Chabouni', pos: 'FB', age: 22, nat: 'FRA', q: 66 },
    { name: 'Nicolas Corato', pos: 'TP', age: 28, nat: 'FRA', q: 67 },
    { name: 'Teddy Durand', pos: 'HK', age: 27, nat: 'FRA', q: 65 },
    { name: 'Pierre Colonna', pos: 'HK', age: 26, nat: 'FRA', q: 63 },
    { name: 'Levan Chilachava', pos: 'TP', age: 34, nat: 'GEO', q: 68, intl: true },
    { name: 'Lois Guérois-Galisson', pos: 'LP', age: 25, nat: 'FRA', q: 62 },
    { name: 'Gauthier Doubrère', pos: 'SH', age: 28, nat: 'FRA', q: 64 },
    { name: 'Alex Burin', pos: 'LP', age: 26, nat: 'FRA', q: 63 },
    { name: 'Chris Gabriel', pos: 'LK', age: 26, nat: 'FRA', q: 63 },
    { name: 'Taylor Gontineac', pos: 'CE', age: 27, nat: 'FRA', q: 64 },
    { name: 'Kyllian Ringuet', pos: 'FL', age: 24, nat: 'FRA', q: 66 },
    { name: 'Maël Turpin', pos: 'LP', age: 23, nat: 'FRA', q: 58 },
    { name: 'Théo Vidal', pos: 'FH', age: 23, nat: 'FRA', q: 60 },
  ],
  clermont: [
    // asm-rugby.com 30 Apr 2026
    { name: 'Justin Bouraux', pos: 'FH', alt: ['FB'], age: 24, nat: 'FRA', q: 67 },
  ],
  la_rochelle: [
    // fr.wikipedia Saison 2026-2027 du Stade rochelais
    // fr.wikipedia La Rochelle 2026-27
    // fr.wikipedia La Rochelle 2026-27: medical joker for four months...
    { name: 'Sione Ahio', pos: 'TP', alt: ['LP'], age: 25, nat: 'NZL', q: 72 },
    { name: 'Thomas Adélaïde', pos: 'LK', age: 23, nat: 'FRA', q: 66 },
    { name: 'Nathan Fraissenon', pos: 'LP', age: 23, nat: 'FRA', q: 65 },
    { name: 'Christophe Loustalot', pos: 'SH', age: 34, nat: 'FRA', q: 63 },
  ],
  lyon: [
    // rugbypass.com/fr/news/lou-rugby-top-14-2026-2027 (prop from Ku
    { name: 'Opeti Helu', pos: 'LP', age: 31, nat: 'TGA', q: 70, intl: true },
  ],
  pau: [
    // rugbypass.com/fr/news/section-paloise-top-14-2026-2027 (from Z
    // rugbypass.com/fr/news/section-paloise-top-14-2026-2027 (from C
    // ici.fr Section Paloise recrues 2026-27 (back-rower from Aurillac...
    { name: 'Gonzalo García', pos: 'SH', age: 32, nat: 'ITA', q: 70, intl: true },
    { name: 'Rodrigo Marta', pos: 'WG', age: 31, nat: 'POR', q: 70, intl: true },
    { name: 'Rémi Couty', pos: 'FL', age: 20, nat: 'FRA', q: 58 },
  ],
  perpignan: [
    // captain J1 and J6 team sheets
    // bench J1 and J6
    // starting centre J1 and J6
    { name: 'Mattéo Le Corvec', pos: 'FL', age: 25, nat: 'FRA', q: 74 },
    { name: 'Sama Malolo', pos: 'HK', age: 26, nat: 'SAM', q: 68, intl: true },
    { name: 'Eneriko Buliruarua', pos: 'WG', age: 27, nat: 'FIJ', q: 68 },
    { name: 'Maëlan Rabut', pos: 'CE', age: 23, nat: 'FRA', q: 66 },
    { name: 'Jake McIntyre', pos: 'FH', age: 32, nat: 'AUS', q: 68 },
    { name: 'Benjamin Urdapilleta', pos: 'FH', age: 40, nat: 'ARG', q: 62, intl: true },
    { name: 'Mathieu Tanguy', pos: 'LK', age: 29, nat: 'FRA', q: 68 },
    { name: 'José Madeira', pos: 'LK', age: 25, nat: 'POR', q: 66, intl: true },
    { name: 'Cedate Gomes Sa', pos: 'TP', age: 33, nat: 'FRA', q: 66, intl: true },
  ],
  racing92: [
    // racing92.fr release
    { name: 'Maxime Machenaud', pos: 'SH', age: 37, nat: 'FRA', q: 72, gk: true, intl: true },
  ],
  stade_francais: [
    // RugbyPass FR preview
    // RugbyPass FR
    // en.wikipedia 'Tomasi Maka'
    { name: 'Alivereti Duguivalu', pos: 'CE', age: 28, nat: 'FIJ', q: 73, intl: true },
    { name: 'Rufus McLean', pos: 'WG', age: 26, nat: 'SCO', q: 73, intl: true },
    { name: 'Tomasi Maka', pos: 'HK', age: 23, nat: 'AUS', q: 66 },
    { name: 'Petero Mailulu', pos: 'LK', age: 23, nat: 'FIJ', q: 66, intl: true },
    { name: 'Thomas Bué', pos: 'TP', age: 23, nat: 'FRA', q: 64 },
  ],
  toulon: [
    // Wikipedia 'Junior Kpoku'
    // rugbyscope.fr 'Apete Narogo débarque à l'aile'
    // RugbyPass FR Toulon preview
    { name: 'Junior Kpoku', pos: 'LK', alt: ['FL'], age: 25, nat: 'FRA', q: 70 },
    { name: 'Apete Narogo', pos: 'WG', age: 23, nat: 'FIJ', q: 66 },
    { name: 'Luciano Asevedo', pos: 'LK', age: 20, nat: 'ARG', q: 58 },
    { name: 'Luka Keletaona', pos: 'FH', age: 20, nat: 'FRA', q: 58 },
    { name: 'Tana Keletaona', pos: 'FL', age: 18, nat: 'FRA', q: 52 },
  ],
  toulouse: [
    // all.rugby Toulouse transfers 2026/27
    // Allrugby Top 14 2026 mutations list
    { name: 'Malachi Hawkes', pos: 'TP', age: 23, nat: 'AUS', q: 66 },
    { name: 'Valentin Delpy', pos: 'FH', age: 22, nat: 'FRA', q: 63 },
  ],
  blues: [
    // Wikipedia, List of 2026-27 Super Rugby transfers
    // Planet Rugby / blues.rugby, 2026 Super Rugby Pacific squads
    { name: 'Nic Shearer', pos: 'SH', age: 23, nat: 'NZL', q: 66 },
    { name: 'Ben Ake', pos: 'LP', age: 25, nat: 'NZL', q: 66 },
    { name: 'Flyn Yates', pos: 'LP', age: 22, nat: 'NZL', q: 62 },
    { name: 'James Mullan', pos: 'HK', age: 24, nat: 'NZL', q: 63 },
    { name: 'Tristyn Cook', pos: 'LK', age: 22, nat: 'NZL', q: 63 },
    { name: 'Cameron Christie', pos: 'FL', age: 24, nat: 'NZL', q: 67 },
    { name: 'Che Clark', pos: 'FL', age: 22, nat: 'NZL', q: 66 },
    { name: 'Malachi Wrampling', pos: 'FL', age: 22, nat: 'NZL', q: 64 },
    { name: 'Rico Simpson', pos: 'FH', age: 20, nat: 'NZL', q: 66 },
    { name: 'James Cameron', pos: 'CE', age: 23, nat: 'NZL', q: 64 },
    { name: 'Cody Vai', pos: 'WG', age: 22, nat: 'NZL', q: 64 },
    { name: 'Payton Spencer', pos: 'WG', age: 22, nat: 'NZL', q: 63 },
    { name: 'Zarn Sullivan', pos: 'FB', age: 25, nat: 'NZL', q: 72 },
  ],
  chiefs: [
    // chiefs.co.nz 'Experience, depth and fresh talent as Gallagher Chiefs...
    { name: 'Benet Kumeroa', pos: 'LP', age: 25, nat: 'NZL', q: 65 },
    { name: 'Brodie McAlister', pos: 'HK', age: 29, nat: 'NZL', q: 72 },
    { name: 'Taine Kolose', pos: 'HK', age: 22, nat: 'NZL', q: 62 },
    { name: 'Aisake Vakasiuola', pos: 'LK', age: 22, nat: 'NZL', q: 63 },
    { name: 'Fiti Sa', pos: 'LK', age: 22, nat: 'NZL', q: 63 },
    { name: 'Jayden Sa', pos: 'LK', age: 22, nat: 'NZL', q: 62 },
    { name: 'Te Toiroa Tahuriorangi', pos: 'SH', age: 30, nat: 'NZL', q: 70, intl: true },
    { name: 'Tepaea Cook-Savage', pos: 'FH', age: 22, nat: 'NZL', q: 63 },
    { name: 'Kyle Brown', pos: 'CE', age: 23, nat: 'NZL', q: 64 },
    { name: 'Isaac Hutchinson', pos: 'WG', age: 22, nat: 'NZL', q: 63 },
  ],
  crusaders: [
    // crusaders.co.nz '2026 Crusaders squad announced' + RugbyPass...
    { name: 'Finlay Brewis', pos: 'LP', age: 23, nat: 'NZL', q: 66 },
    { name: 'Kershawl Sykes-Martin', pos: 'TP', age: 22, nat: 'NZL', q: 63 },
    { name: 'Manumaua Letiu', pos: 'HK', age: 21, nat: 'NZL', q: 62 },
    { name: 'Tahlor Cahill', pos: 'LK', age: 23, nat: 'NZL', q: 67 },
    { name: 'Liam Jack', pos: 'LK', age: 21, nat: 'NZL', q: 62 },
    { name: 'Dominic Gardiner', pos: 'FL', age: 29, nat: 'NZL', q: 72 },
    { name: 'Xavier Saifoloi', pos: 'FL', age: 22, nat: 'NZL', q: 66 },
    { name: 'James White', pos: 'FH', age: 21, nat: 'NZL', q: 62 },
    { name: 'Toby Bell', pos: 'CE', age: 21, nat: 'NZL', q: 62 },
    { name: 'Maloni Kunawave', pos: 'WG', age: 21, nat: 'NZL', q: 63 },
  ],
  drua: [
    // Wikipedia, List of 2026-27 Super Rugby transfers (from
    { name: 'Ben Volavola', pos: 'FH', age: 35, nat: 'FIJ', q: 70, intl: true },
    { name: 'Isi Naisarani', pos: 'N8', age: 30, nat: 'AUS', q: 72, intl: true },
  ],
  highlanders: [
    // RugbyPass 'Highlanders bolster 2027 squad with two international...
    { name: 'Joseva Tamani', pos: 'LK', age: 25, nat: 'FIJ', q: 68, intl: true },
    { name: 'Tuna Tuitama', pos: 'WG', age: 25, nat: 'SAM', q: 66, intl: true },
  ],
  hurricanes: [
    // hurricanes.co.nz 'Hurricanes sign Rohan Wingham on multi-year deal'
    { name: 'Rohan Wingham', pos: 'LP', age: 24, nat: 'NZL', q: 64 },
  ],
  ealing: [
    // The Rugby Paper 'Ealing keep on building'
    { name: 'Rory Scannell', pos: 'CE', age: 32, nat: 'IRE', q: 70, intl: true },
  ],
  montauban: [
    // radiototem.net + search + J5 bench No 18
    // search: medical joker for Joe Powell
    { name: 'Youssouf Soucouna', pos: 'LK', age: 22, nat: 'FRA', q: 58 },
    { name: 'Jack Maunder', pos: 'SH', age: 29, nat: 'ENG', q: 64, intl: true },
  ],
  ospreys: [
    // from the Wild Knights (nation.cymru 'Ospreys swoop for Wallabies star
    // Marika Koroibete'); his hand-added entry moves with him
    { name: 'Marika Koroibete', pos: 'WG', age: 34, nat: 'AUS', q: 78, intl: true },
  ],
  oyonnax: [
    // left the Chiefs for Oyonnax (Wikipedia, List of 2026-27 Super Rugby
    // transfers); his hand-added entry moves with him
    { name: 'Liam Coombes-Fabling', pos: 'WG', age: 23, nat: 'NZL', q: 62 },
  ],
  narbonne: [
    // from Moana Pasifika (echo-des-tribunes, Narbonne's 2026/27 squad
    // presentation); his hand-added entry moves with him
    { name: 'Solomon Alaimalo', pos: 'FB', alt: ['WG'], age: 30, nat: 'SAM', q: 64 },
  ],
}

/** The two tables as one: a club's earlier additions first, then its 2026-27
 *  ones. Keyed tables cannot repeat a key, which is why the window is its own
 *  table rather than a second `leinster:` inside the first. */
export const EXTRA_PLAYERS: Record<string, RawPlayer[]> = (() => {
  const out: Record<string, RawPlayer[]> = {}
  for (const table of [EARLIER, WINDOW_2627]) {
    for (const [club, rows] of Object.entries(table)) out[club] = [...(out[club] ?? []), ...rows]
  }
  return out
})()

/** Everyone hand-added to this club, or an empty list. */
export const extraPlayers = (clubId: string): RawPlayer[] =>
  Object.prototype.hasOwnProperty.call(EXTRA_PLAYERS, clubId) &&
  Array.isArray(EXTRA_PLAYERS[clubId])
    ? EXTRA_PLAYERS[clubId]
    : []
