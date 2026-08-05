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
// which fails if the count ever rises and now prints only the ones nobody has
// checked yet, so the list is work to do rather than work already done.
//
// EVERY SENIOR DUPLICATE IS NOW RESOLVED. Danny Toala was the last one, and he
// held out for three rounds: Moana released fifteen players in June 2025 with
// him on the list, his career line went on to Oyonnax, and all.rugby had him as
// a Moana ARRIVAL from Oyonnax. Moana's own named 2026 squad settled it - he is
// in it, described as a centre who came from Oyonnax, so all three sources agree
// on the sequence and only the instant was ever in doubt.
//
// ONE CONFLICT IS STILL OPEN, and it is recorded here rather than acted on:
// Kyren Taumoefolau is below as a Chiefs player, on a two-year deal signed in
// August 2025 and eight starts for them in the 2026 season. Moana's 2026 squad
// release also lists him, "from Chiefs". Those cannot both be true. The Chiefs
// entry has the concrete appearance count behind it, so it stays until a better
// source turns up.
//
// A NOTE ON THE CALENDAR, since it caused most of the confusion above. The game
// opens in August 2025, so the northern clubs are on their 2025-26 squads and
// the southern ones on their 2026 Super Rugby squads - those two seasons overlap
// inside one save year. When a player moves between the hemispheres mid-window,
// which listing is "right" depends on the month, and the game has no way to show
// both. The rule used here: prefer the squad he was named in for the season the
// game will actually simulate.

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
  // At Harlequins since 2024-25. His Montpellier years ended in 2024.
  'titi lamositele': 'harlequins',
  // Joined the Sharks from Racing 92 for 2024-25 and is contracted there.
  'trevor nyakane': 'sharks',
  // One season at Racing 92 in 2022-23, back at the Stormers since, and
  // playing for them in 2025-26.
  'warrick gelant': 'stormers',
  // Left Montpellier after 147 games and signed a three-year deal with the
  // Bulls for 2025-26.
  'jan serfontein': 'bulls',

  // ---- second pass: the Top 14 and Pro D2 churn ----
  // Ten years at Clermont, then Castres from 2024 on a two-year deal, so
  // 2025-26 is his second season there.
  'paul jedrasiak': 'castres',
  // At Castres since 2023. The Bordeaux listing is the stale one.
  'nathanaël hulleu': 'castres',
  // Agreed a pre-contract with Bordeaux for summer 2025 and activated his
  // release clause, then changed his mind when Bayonne extended him to 2030.
  // Bayonne were fined over it. He stayed.
  'tevita tatafu': 'bayonne',
  // Clermont 2019-2023, Bayonne since, and extended there in October 2025.
  'cheikh tiberghien': 'bayonne',
  // Twelve years at Racing 92 ended when his contract was terminated in
  // January 2025. Joined Lyon as a free agent and has since extended.
  'camille chat': 'lyon',
  // Joined Clermont for 2024-25 and is their hooker in 2025-26.
  'barnabé massa': 'clermont',
  // Arrived at Montpellier from Toulon in spring 2024 as a medical joker and
  // has been extended twice since.
  'christopher tolofua': 'montpellier',
  // Montpellier 2022-2024, Stade Français since.
  'louis carbonel': 'stade_francais',
  // Montpellier 2019-2024, Stade Français since. Not to be confused with
  // Carbonel, who made the same move in the same summer.
  'louis foursans': 'stade_francais',
  // A Montpellier player at the start of 2025-26. He was loaned back to
  // Bordeaux mid-season and signed for Bayonne after that, neither of which
  // the game's season-start snapshot should show.
  'madosh tambwe': 'montpellier',
  // Nine years at Toulon, then Bayonne from summer 2025. Neither of the two
  // clubs the files list him at is right.
  'emerick setiano': 'bayonne',
  // On loan at Pau 2021-2023, back at Racing 92 since.
  'jordan joseph': 'racing92',
  // Pau 2021-2023, Stade Français since. His contract there runs to 2026.
  'zack henry': 'stade_francais',
  // Benetton 2020-2024, Toulon since, and extended to 2028.
  'gianmarco lucchesi': 'toulon',

  // ---- second pass: north-south moves ----
  // Left the Stormers for Exeter in August 2024, so 2025-26 is his second
  // Premiership season.
  'kwenzo blose': 'exeter',
  // Exeter to Cardiff for 2024-25, then a new long-term deal. He has since
  // made his Wales debut.
  'danny southworth': 'cardiff',
  // Released by Moana Pasifika in June 2025 and signed a two-year deal with
  // the Chiefs that August, so neither listing is right.
  'kyren taumoefolau': 'chiefs',
  // Left the Chiefs after the 2025 Super Rugby season for the Reds, on a
  // three-year deal to 2027.
  'aidan ross': 'reds',
  // Three seasons at Clermont to 2023, then home to the Waratahs, who
  // re-signed him ahead of 2025.
  'miles amatosero': 'waratahs',
  // Three seasons at Montpellier including the 2022 Top 14 title, then the
  // Western Force from 2025.
  'brandon paenga-amosa': 'force',

  // ---- third pass: the men behind the squad-shape warnings ----
  // The data audit flagged seven clubs short of specialist cover. Checking them
  // one at a time showed the same story as the duplicates: the player who fills
  // the shirt already exists in the files, at the club he left. Nothing needed
  // inventing.
  //
  // Left Ospreys for Leicester in 2023 and is their first-choice loosehead,
  // most minutes of any Tigers prop in the run to the final. Leicester had ONE
  // loosehead in the files because of this.
  'nicky smith': 'leicester',
  // Left Bristol for Cardiff and competes for the ten shirt there in 2025-26.
  // Cardiff had one specialist fly-half without him.
  'callum sheedy': 'cardiff',
  // Bayonne until 2023, Toulon since, where he is a back-row option rather
  // than the lock the files have him down as at his old club.
  'swan rebbadj': 'toulon',
  // A Clermont lock in 2025-26. The files list him at Perpignan AND Vannes,
  // which is neither. Perpignan keeps enough cover without him.
  'tevita ratuva': 'clermont',
  // Left Gloucester for Newcastle, whose other hookers' departure left them
  // with one in the files. Gloucester keeps enough cover without him.
  'george mcguigan': 'newcastle',
  // The one that was deliberately left alone. Moana Pasifika's named 2026 squad
  // has him in it as "a 26-year-old centre from Oyonnax", which finally makes
  // the three sources agree on the SEQUENCE - Moana to 2025, Oyonnax, then back
  // to Moana. The files list him at Pau, which no source supports at all, and
  // the tie-break was putting him there. Moana it is.
  'danny toala': 'moana',

  // These two are not duplicates at all - the files list them at one club
  // each, and it is the wrong one. Found while checking the list above, which
  // says something about how far the problem reaches.
  //
  // Three seasons at Leicester, then home to the Bulls on a two-year deal
  // from 1 July 2025. Leicester signed replacements; this leaves them a man
  // short until those are entered, which is the honest state of the data.
  'handré pollard': 'bulls',
  // Leicester's captain until the end of 2024-25, then Pau in the Top 14.
  // The hand-written captains list still had him leading Leicester, which the
  // data audit catches the moment he moves.
  'julián montoya': 'pau',
}

/** The club this player really turns out for, or null if nobody has checked. */
export const verifiedClub = (name: string): string | null => {
  const key = name.toLowerCase()
  return Object.prototype.hasOwnProperty.call(VERIFIED_CLUB, key) &&
    typeof VERIFIED_CLUB[key] === 'string'
    ? VERIFIED_CLUB[key]
    : null
}
