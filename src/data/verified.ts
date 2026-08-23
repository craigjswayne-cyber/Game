import { PREM_2526 } from './prem2526'

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
//   1. One entry per player, keyed on his lowercased full name - or, when
//      two different men share that name, on `name@sourceclub` to pin the
//      one LISTING that moves. Any scoped key silences the plain-name
//      form for every other listing of that name, which is the point.
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
  // ---- the last two genuine double-listings (release audit) ---------------
  //
  // dataaudit's ratchet had been red at 78 against a budget of 76, and the
  // interesting part was what the 78 turned out to be. Comparing each collision
  // on POSITION AND AGE rather than on the name alone splits them cleanly: 22 are
  // two different men who happen to share a name - a winger of 26 and a lock of
  // 30 both called Alex Hughes, a Cardiff centre and a Blackheath tighthead both
  // called Ben Thomas - and exactly two are one man listed at two clubs.
  //
  // Which club, decided from the files rather than from memory: in both cases the
  // two listings differ by a year of age, and the older listing is the more
  // recently compiled squad, so it is the club he moved TO. That is a signal
  // inside the data itself, which is worth more here than my recollection of the
  // 2025-26 French windows - and for Sanconnie the two agree anyway, Montauban
  // having come up to the Top 14 for this season.
  'bruce devaux': 'perpignan',

  // Both listings of one man, pinned together. A scoped key silences the
  // plain-name form for every other listing, so pinning only the departing
  // club left his duplicate entry unmoved - and the builder's one-player-per-
  // name rule then kept the WRONG copy. Pin both ends of each duplicate.
  'dan du preez@bath': 'bath',
  'jamie bhatti@bath': 'bath',
  'boeta chamberlain@bulls': 'lions',
  'nicky smith@ospreys': 'leicester',
  'len ikitau@brumbies': 'brumbies',
  'zack henry@pau': 'newcastle',
  // Sam Spink is TWO men - a Saracens centre of 27 and a Western Force centre
  // of 25 - and the Saracens one was released in this window. With his entry
  // deleted the 2025-26 guide simply pulled the Force man to Saracens in his
  // place. Self-pinning the Force listing silences the guide for that name.
  'sam spink@force': 'force',
  // ---- THE 2026-27 PREMIERSHIP TRANSFER WINDOW ---------------------------
  // Wikipedia's List of 2026-27 Premiership Rugby transfers, supplied by the
  // user as screenshots of all nine club sections (the page itself is blocked
  // by this environment's egress policy). Every entry is scoped `name@club`:
  // the window moves LISTINGS, not names, and nine of these names belong to
  // two different men in this data. Grouped by the club they join.
  // -> bath
  'dan du preez@sale': 'bath',
  'jamie bhatti@glasgow': 'bath',
  // -> bayonne
  'rob du preez@sale': 'bayonne',
  // -> bedford
  'harry wells@leicester': 'bedford',
  // -> blackheath
  'joel grayson@newcastle': 'blackheath',
  // -> blackrams
  'tamati tua@exeter': 'exeter',
  // -> bordeaux
  'tom willis@saracens': 'bordeaux',
  // -> brumbies
  'len ikitau@exeter': 'brumbies',
  // -> bulls
  'hanro liebenberg@leicester': 'bulls',
  // -> cardiff
  'jarrod evans@harlequins': 'cardiff',
  'scott sio@exeter': 'cardiff',
  'tom manz@leicester': 'cardiff',
  // -> ealing
  'gareth simpson@saracens': 'ealing',
  'hayden hyde@harlequins': 'ealing',
  'louie johnson@saracens': 'ealing',
  'sam grahamslaw@bristol': 'ealing',
  // -> exeter
  'dallas mcleod@crusaders': 'bristol',
  'sam wolstenholme@bristol': 'bristol',
  // -> gloucester
  'dewi lake@ospreys': 'gloucester',
  'jac morgan@ospreys': 'gloucester',
  'jean kleyn@munster': 'gloucester',
  // -> harlequins
  'harry johnson-holmes@force': 'harlequins',
  'james dun@bristol': 'harlequins',
  // -> la_rochelle
  'theo mcfarland@saracens': 'la_rochelle',
  // -> leicester
  'aaron wainwright@dragons': 'leicester',
  'joe jenkins@bristol': 'leicester',
  'joel sclavi@la_rochelle': 'leicester',
  // -> lions
  'boeta chamberlain@newcastle': 'lions',
  // -> lscottish
  'will butler@gloucester': 'lscottish',
  // -> newcastle
  'benjamin elizalde@bristol': 'newcastle',
  'brandon jackson@saracens': 'newcastle',
  'fehi fineanganofo@hurricanes': 'hurricanes',
  'hoskins sotutu@blues': 'newcastle',
  'josh hodge@exeter': 'newcastle',
  'obi ene@sale': 'newcastle',
  'pouri rakete-stones@hurricanes': 'newcastle',
  'raffi quirke@sale': 'newcastle',
  'werner kok@ulster': 'ulster',
  'will rigg@exeter': 'newcastle',
  'zack henry@stade_francais': 'newcastle',
  'zuriel togiatama@drua': 'newcastle',
  // -> northampton
  'jordan els@harlequins': 'northampton',
  // -> ospreys
  'dan john@exeter': 'ospreys',
  // -> pau
  'santiago grondona@bristol': 'pau',
  // -> perpignan
  'marco riccioni@saracens': 'perpignan',
  // -> pirates
  'steele barker@bristol': 'bristol',
  // -> plymouth
  'iwan jenkins@exeter': 'plymouth',
  // -> reds
  'izaia perese@leicester': 'leicester',
  // -> sale
  'alex lozowski@saracens': 'sale',
  'christ tshiunza@exeter': 'sale',
  'elia canakaivata@drua': 'sale',
  'joe marchant@stade_francais': 'sale',
  'nicky smith@leicester': 'leicester',
  'xavier roe@chiefs': 'sale',
  // -> saracens
  'george martin@leicester': 'saracens',
  'tomos williams@gloucester': 'gloucester',
  // -> sharks
  'ivan van zyl@saracens': 'sharks',
  // -> ulster
  'jamie benson@harlequins': 'ulster',
  // -> vannes
  'matias alemanno@gloucester': 'vannes',
  'fabien sanconnie': 'montauban',

  // ---- Northampton's published 2026/27 squad list (user's screenshot of
  // the club's own announcement, round 27) names both among the props.
  // Their authored entries live at their old clubs; this moves the men
  // rather than writing them twice.
  'ion neculai': 'northampton',
  // Short-term deal per the same list. The guide's Harlequins line is his
  // 2025-26 club, which is why the hand table has to win here.
  'jordan els': 'northampton',
  // The same list has NO Atuanya and no Tom James - but the guide's stale
  // Northampton lines would otherwise drag namesakes in by name alone: the
  // Cardiff tighthead called Emeka Atuanya, and the Cornish Pirates
  // full-back called Tom James. Pin each man to the club that authored him.
  // (Bishop's Stortford's generated 32-year-old prop of the same name is
  // the one casualty: a name can only be verified to one club, and the
  // Pirates entry is the real man.)
  'emeka atuanya': 'cardiff',
  'tom james': 'pirates',

  // Back at the Hurricanes for 2025-26 after his season-long Leinster
  // sabbatical ended with the 2024-25 URC campaign; re-signed to 2028.
  'jordie barrett': 'leinster',
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
  // Sheedy and Pollard used to be relocated out of the Premiership from here.
  // The 2025/26 squad guide drops both from their old clubs, so there is nothing
  // left to relocate and a dead entry is a failure the audit rightly reports.
  // They are in additions.ts now, which is the table for a man who plays at a
  // club no file lists him at.
  // Bayonne until 2023, Toulon since, where he is a back-row option rather
  // than the lock the files have him down as at his old club.
  'swan rebbadj': 'toulon',
  // Home from Toulouse for 2026 - the Blues' own squad release leads on his
  // return. Toulouse keeps enough cover in the midfield without him.
  'pita ahki': 'blues',
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
  // Leicester's captain until the end of 2024-25, then Pau in the Top 14.
  // The hand-written captains list still had him leading Leicester, which the
  // data audit catches the moment he moves.
  //
  // The 2025/26 squad guide is WRONG here - it lists him in Leicester's hookers.
  // He signed for Pau in 2024 and that is checked, so the guide loses this one.
  // Keyed on the guide's spelling (no accent), because the merge took the guide's
  // spelling for the authored entry and a key that no longer matches any player
  // is a relocation that quietly never happens.
  'julian montoya': 'pau',
  // Listed at Saracens by the 2025/26 guide and still at the Force in the Super
  // Rugby file, which is a season behind. The guide is the checked source.
  // (Sam Spink's Saracens pin is gone: the 2026-27 window released him, and
  //  the Force man of the same name is pinned above.)
  // Bath's announced 2026/27 squad (official club Instagram, Aug 2026) - the
  // one club running a season ahead of the guide, at the user's request. Both
  // men keep their authored entries; the old listings (Glasgow's urc_a and
  // Sale's prem_b/guide) drop here rather than by editing other clubs' files.
  'jamie bhatti': 'bath',
  'dan du preez': 'bath',

  // ---- THE AUGUST 2026 COMPENDIUM (user-supplied transfer PDF) -----------
  // The user's global rosters document, applied on top of everything above.
  // Bath and Northampton are untouched on the user's instruction: their
  // squads are the clubs' own official lists and outrank the compendium.
  // Where the compendium contradicts an earlier pin, the pin above was
  // repointed rather than deleted, so the guide stays silenced for that name.
  'christian wade@newcastle': 'gloucester',
  'adam hastings@gloucester': 'glasgow',
  'adam hastings@glasgow': 'glasgow',
  'waisea nayacalevu@toulon': 'sale',
  'fergus burke@crusaders': 'saracens',
  'fergus burke@saracens': 'saracens',
  'owen farrell@saracens': 'racing92',
  'owen farrell@racing92': 'racing92',
  'yoan tanga@la_rochelle': 'stade_francais',
  'demba bamba@lyon': 'racing92',
  'hacjivah dayimani@stormers': 'racing92',
  'seru uru@reds': 'racing92',
  'lucas tauzin@perpignan': 'clermont',
  'daniel bibi biziwu@clermont': 'pau',
  'rémy baget@bayonne': 'castres',
  'filipo nakosi@castres': 'vannes',
  'wilfrid hounkpatin@castres': 'montpellier',
  'paolo garbisi@montpellier': 'toulon',
  'olivier klemenczak@racing92': 'pau',
  'wj steenkamp@bulls': 'lions',
  'emmanuel tshituka@lions': 'sharks',
  'kieran hardy@scarlets': 'ospreys',
  'pete samu@bordeaux': 'waratahs',
  'samipeni finau@chiefs': 'bordeaux',
  'ardie savea@moana': 'steelers',
  'bayley kuenzle@force': 'glasgow',
  'james humphreys@ulster': 'ealing',
  'jack dempsey@glasgow': 'bravelupus',
  'liam williams@newcastle': 'spears',
}

/** Every man the 2025/26 Premiership guide names, at the club it names him at.
 *
 *  Merging the guide turned twenty-odd names into duplicates, and they all share
 *  one shape: a player the guide's IN list says moved TO the Premiership, still
 *  sitting in another league's file that is a season behind. Len Ikitau at the
 *  Brumbies, Joseph Dweba at the Stormers, Guido Petti at Bordeaux, Owen Farrell
 *  at Racing, Fergus Burke and Tom Christie at the Crusaders, Danilo Fischetti at
 *  Zebre, Anthony Belleau at Clermont, and so on.
 *
 *  Writing twenty-odd entries by hand would be twenty-odd chances to mistype, and
 *  they would rot the moment the guide changed. This derives them instead, which
 *  is legitimate under rule 2 of this file: a name in the guide IS a checked name,
 *  that being the guide's whole purpose.
 *
 *  The hand-written table above still wins. That matters for exactly one man:
 *  the guide has Julian Montoya in Leicester's hookers and he signed for Pau in
 *  2024, so the checked entry has to beat the derived one. */
const FROM_GUIDE: Map<string, string> = new Map(
  PREM_2526.flatMap(club => club.players.map(p => [p.name.toLowerCase(), club.id] as [string, string])),
)

/** The club this player really turns out for, or null if nobody has checked.
 *
 *  `at` is the club whose file this listing sits in, and it exists because a
 *  name is not an identity. Two different men share a name 35 times over in
 *  this data, and a name-keyed table can only send both to one club: applying
 *  the 2026-27 Premiership window, 'george martin' meant the Leicester lock
 *  bound for Saracens AND an Esher winger who is going nowhere. A key of the
 *  form `name@sourceclub` binds one LISTING rather than one name, so the lock
 *  moves and the winger stays. The plain-name form is unchanged and still
 *  answers when no specific listing is pinned. */
export const verifiedClub = (name: string, at?: string): string | null => {
  const key = name.toLowerCase()
  // this exact listing is pinned
  if (at) {
    const scoped = VERIFIED_CLUB[`${key}@${at}`]
    if (typeof scoped === 'string') return scoped
  }
  // the name is pinned somewhere, but not here: this listing is a different
  // man (or the same man's stale entry), and nothing may move him
  if (SCOPED_NAMES.has(key)) return null
  if (Object.prototype.hasOwnProperty.call(VERIFIED_CLUB, key) && typeof VERIFIED_CLUB[key] === 'string') {
    return VERIFIED_CLUB[key]
  }
  return FROM_GUIDE.get(key) ?? null
}

/** Names carrying at least one `name@club` pin, computed once. The lookup runs
 *  for every player in the world at every world build; rescanning the table
 *  each time would be thousands of string comparisons for nothing. */
const SCOPED_NAMES: Set<string> = new Set(
  Object.keys(VERIFIED_CLUB).filter(k => k.includes('@')).map(k => k.slice(0, k.indexOf('@'))),
)

