// Real 2025-26 club captains (user feedback: "all club captains should be the
// 2025 captains"). Applied by name at world creation: if the man is not in that
// club's squad the entry silently does nothing and the armband falls to the
// senior leader instead, so a wrong guess can never corrupt a squad. The data
// audit turns that silence into a failure, which is what caught Montoya still
// leading Leicester after he had signed for Pau.
//
// STILL TO CHECK. A captaincy is the most visible fact about a club, so these
// are only changed against a clear source, and four came back with sources
// contradicting each other. Left as they are rather than guessed at:
//   saracens    Itoje here, and Farrell named club captain on his return
//
// THREE OF THE FOUR ARE NOW ANSWERED, by the league's own club-by-club
// captains article (supplied by the user; the site is blocked here):
//   exeter      Yeandle is club captain, Jenkins the on-field skipper - the
//               entry keeps Jenkins, who is the man wearing it on a Saturday
//   harlequins  Dombrandt, confirmed (he did succeed Lewies). He tore an ACL
//               in June, so the club may yet change it - Furbank, arriving
//               from Saints, is named as a candidate
//   sale        van Rhyn, confirmed, and corrected below
// The same article said Gloucester's captaincy was TBC after Tomos Williams
// left for Saracens. The club has since named Dewi Lake (see below).
export const CLUB_CAPTAINS: Record<string, string> = {
  // Gallagher Premiership
  bath: 'Ben Spencer',
  // Named club captain for 2025-26 alongside a long-term extension
  bristol: 'Fitz Harding',
  exeter: 'Dafydd Jenkins',
  // Tomos Williams captained Gloucester until the 2026-27 window took him to
  // Saracens. The club's own announcement names Lake captain for 2026-27,
  // with Seb Atkinson and Jac Morgan as his vice-captains (CLUB_VICES).
  gloucester: 'Dewi Lake',
  harlequins: 'Alex Dombrandt',
  // Montoya left for Pau at the end of 2024-25; Chessum leads Leicester now
  leicester: 'Ollie Chessum',
  northampton: 'Fraser Dingwall',
  // Van Rhyn took the armband from Ben Curry at the start of 2025-26 and
  // started every league game of it - the league's own club-by-club captains
  // piece settles the contradiction this file recorded above.
  sale: 'Ernst van Rhyn',
  // Christie named club captain for 2026-27 by the club (newcastleredbulls.com)
  newcastle: 'Tom Christie',
  saracens: 'Maro Itoje',

  // United Rugby Championship
  leinster: 'Caelan Doris',
  munster: 'Tadhg Beirne',
  ulster: 'Iain Henderson',
  connacht: 'Cian Prendergast',
  // Tuipulotu captained Glasgow in round 3 of 2026-27 (URC line-ups); he
  // co-captained with Steyn in 2025-26. Medium confidence, research of 18 Oct.
  glasgow: 'Sione Tuipulotu',
  edinburgh: 'Grant Gilchrist',
  // a third season as captain (cardiffrugby.wales, 2026-27)
  cardiff: 'Liam Belcher',
  // Jac Morgan captained the Ospreys until the same window took him to Gloucester.
  // No source names his replacement, so the armband is left to the game's
  // own leadership pick rather than to a guess - the same way 65 other clubs
  // choose theirs.
  scarlets: 'Josh Macleod',
  benetton: 'Michele Lamaro',
  // Moerat left for La Rochelle; Nel named captain in the 56-man 2026-27
  // squad announcement (stormers.co.za, 17 Sep 2026)
  stormers: 'Ruhan Nel',
  // Nortje left for Kubota Spears; Coetzee captained through 2025-26 and
  // leads the 2026-27 squad (SA Rugby Mag; medium confidence)
  bulls: 'Marcell Coetzee',
  // co-captains, Carter first (dragonsrfc.wales, Sep 2026); O'Brien is in
  // CLUB_VICES
  dragons: 'Ben Carter',
  sharks: 'Eben Etzebeth',

  // Top 14
  toulouse: 'Antoine Dupont',
  la_rochelle: 'Gregory Alldritt',
  toulon: 'Charles Ollivon',
  bordeaux: 'Maxime Lucu',
  // Fickou left for Toulon; Spring captained again in October 2026 (team
  // sheet v Perpignan; medium confidence)
  racing92: 'Max Spring',
  // captain on the J1 and J6 team sheets (usap-forum.com, x-tremlimit)
  perpignan: 'Mattéo Le Corvec',
  // captain at Perpignan on 10 Oct 2026 (LNR team sheet; medium)
  vannes: 'Francisco Gorrissen',
  lyon: 'Baptiste Couilloud',
  castres: 'Mathieu Babillot',

  // Super Rugby Pacific
  // Havili left for Toshiba Brave Lupus and no successor has been named
  // (crusaders.co.nz), so the armband is the game's own pick for now
  chiefs: 'Luke Jacobson',
  blues: 'Patrick Tuipulotu',
  hurricanes: "Du'Plessis Kirifi",
  brumbies: 'Allan Alaalatoa',
  waratahs: 'Jake Gordon',
  reds: 'Tate McDermott',

  // Major Rugby Competition (real squads from 18 Oct 2026, mrc.ts)
  chicago: 'Lucas Rumball',
  // stood in for while injured in 2026 (americasrugbynews; medium)
  newengland: 'Joe Johnston',
  seattle: 'Riekert Hattingh',
  washington: 'Robert Harley',

  // ---- the women's game (research of 18 Oct 2026; high-confidence only) ----
  // Applied in the women's world the same way: the ids carry the w: prefix,
  // so a men's world simply never finds these clubs.
  // succeeds the retired Jade Konkel (rugbypass, 'captaincy nod')
  'w:quins': 'Aoife Wafer',
  // retained for 2026-27 (rugbypass)
  'w:sale': 'Georgie Perris-Redding',
  // Super Rugby Aupiki and Super W, 2026 (club and rnz/rugby.com.au releases)
  'w:chiefs': 'Kennedy Tukuafu',
  'w:matatu': 'Grace Brooker',
  'w:hurricanes': 'Te Rauoriwa Gapper',
  'w:drua': 'Bitila Tawake',
  'w:force': 'Trilleen Pomare',
  'w:waratahs': 'Emily Chancellor',
  'w:reds': 'Jemma Bemrose',
  'w:brumbies': 'Siokapesi Palu-Sekona',
}

// Announced vice-captains, applied the same way as the captains above. The
// game has one vice-captain's armband, so the first name wears it; every name
// listed is given a leader's standing in the dressing room.
export const CLUB_VICES: Record<string, string[]> = {
  gloucester: ['Seb Atkinson', 'Jac Morgan'],
  // Dragons' co-captain (dragonsrfc.wales, Sep 2026)
  dragons: ["Angus O'Brien"],
  // the co-captains of the two co-captained women's sides (hurricanes.co.nz,
  // westernforce.rugby, 2026)
  'w:hurricanes': ['Samantha Taylor'],
  'w:force': ['Sammy Wood'],
}

/** Loose match: accents and punctuation differ between data files. */
export const sameName = (a: string, b: string) => {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, '').trim()
  return norm(a) === norm(b)
}
