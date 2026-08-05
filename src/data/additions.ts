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
  la_rochelle: [
    { name: 'Teddy Iribaren', pos: 'SH', age: 34, nat: 'FRA', q: 74, gk: true },
  ],
  // Harlequins lost Joe Marler to retirement and Wyn Jones to the Dragons in
  // the same year, and signed the Argentina prop to cover it. Without him the
  // files leave Fin Baxter as the only loosehead at the club.
  harlequins: [
    { name: 'Boris Wenger', pos: 'LP', age: 22, nat: 'ARG', q: 65 },
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
    { name: 'Alec Hepburn', pos: 'LP', age: 32, nat: 'ENG', q: 71 },
    { name: 'Tristan Davies', pos: 'FL', age: 23, nat: 'WAL', q: 63 },
  ],
  // From Moana Pasifika's own named 2026 squad, corroborated by Fine Inisi and
  // Danny Toala already being ours. Patafilo arrived from Kyuden Voltex.
  moana: [
    { name: 'Pepesana Patafilo', pos: 'WG', age: 29, nat: 'FIJ', q: 68 },
  ],
  // The Force's outside backs for 2026 are Bridge, Beale, Grealy and Lancaster.
  // Beale and Grealy are already ours, which makes the list good; Bridge is the
  // former All Blacks winger, and the Force had two specialists without him.
  force: [
    { name: 'George Bridge', pos: 'WG', age: 30, nat: 'NZL', q: 71 },
  ],
}

/** Everyone hand-added to this club, or an empty list. */
export const extraPlayers = (clubId: string): RawPlayer[] =>
  Object.prototype.hasOwnProperty.call(EXTRA_PLAYERS, clubId) &&
  Array.isArray(EXTRA_PLAYERS[clubId])
    ? EXTRA_PLAYERS[clubId]
    : []
