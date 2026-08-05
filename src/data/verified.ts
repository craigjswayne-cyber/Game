// Where a player actually plays in 2025-26, when the squad files disagree.
//
// The data audit reports 64 players listed at two clubs at once. The world
// builder used to keep whichever file loaded first, which means the club a
// player appears for was decided by league order rather than by fact. Checking
// the first four by hand turned up something worse than a tie-break problem:
// three of them play for a THIRD club that neither file names, because parts of
// the squad data are a season behind on transfers.
//
//   Joe Hawkins   listed at Exeter and Ospreys, actually at Scarlets
//   Wyn Jones     listed at Scarlets and Harlequins, actually at Dragons
//   Jordie Barrett listed at Leinster, actually back at the Hurricanes
//
// So this is a relocation table, not a preference list. The builder takes the
// player's authored entry - his real age, position, nationality and quality,
// all already written by hand - and places it at the club named here, dropping
// every other listing of him. Nothing is renamed and nothing is invented,
// which matters: two earlier automated passes at the duplicate problem tried
// renaming players to break ties and damaged real data both times.
//
// RULES FOR ADDING TO THIS TABLE
//   1. One entry per player, keyed on his lowercased full name.
//   2. Only add a player whose 2025-26 club you have actually checked. An
//      unchecked player left out of here keeps today's behaviour, which is
//      merely arbitrary rather than wrong.
//   3. The comment says where the answer came from. A season-long sabbatical
//      counts as playing for the club he spends the season at.
//   4. The target club id must exist in the game. If it does not, the builder
//      leaves him alone rather than deleting him.
//
// The remaining duplicates are listed by `npx vite-node scripts/dataaudit.ts`,
// which fails if the count ever rises.

export const VERIFIED_CLUB: Record<string, string> = {
  // Back at the Hurricanes for 2025-26 after his season-long Leinster
  // sabbatical ended with the 2024-25 URC campaign; re-signed to 2028.
  'jordie barrett': 'hurricanes',
  // The reverse trip: contracted to the Blues to 2027, but taking the
  // sabbatical clause to spend 2025-26 at Leinster as Barrett's replacement.
  'rieko ioane': 'leinster',
  // Left Exeter for Scarlets for 2025-26, back to Wales to chase his caps.
  // Neither of the two clubs the files list him at is right.
  'joe hawkins': 'scarlets',
  // Left Harlequins for Dragons on a one-year deal for 2025-26, so neither
  // Scarlets (his old club) nor Harlequins is right either.
  'wyn jones': 'dragons',
  // Went back to Edinburgh in 2024 after two seasons at Bristol and extended
  // through 2025-26, where he is club captain.
  'magnus bradbury': 'edinburgh',
  // Left Northampton after four seasons and a title, and joined Ulster on a
  // three-year deal from 2025-26.
  'juarno augustus': 'ulster',
  // Re-signed with Leicester in December 2024 through 2025-26. His Moana
  // Pasifika season was 2022, three clubs ago.
  'solomone kata': 'leicester',
  // Left Northampton at the end of 2024-25 to go home to Fiji, so he is a
  // Fijian Drua player now and not a Lyon one either.
  'temo mayanavanua': 'drua',
}

/** The club this player really turns out for, or null if nobody has checked. */
export const verifiedClub = (name: string): string | null => {
  const key = name.toLowerCase()
  return Object.prototype.hasOwnProperty.call(VERIFIED_CLUB, key) &&
    typeof VERIFIED_CLUB[key] === 'string'
    ? VERIFIED_CLUB[key]
    : null
}
