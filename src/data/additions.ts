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
}

/** Everyone hand-added to this club, or an empty list. */
export const extraPlayers = (clubId: string): RawPlayer[] =>
  Object.prototype.hasOwnProperty.call(EXTRA_PLAYERS, clubId) &&
  Array.isArray(EXTRA_PLAYERS[clubId])
    ? EXTRA_PLAYERS[clubId]
    : []
