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
//   exeter      Yeandle and Robinson both described as captain in 2025-26
//   harlequins  Dombrandt in one place, Stephan Lewies named as new captain
//               in another
//   sale        Ben Curry here, Ernst van Rhyn reported elsewhere
//   saracens    Itoje here, and Farrell named club captain on his return
export const CLUB_CAPTAINS: Record<string, string> = {
  // Gallagher Premiership
  bath: 'Ben Spencer',
  // Named club captain for 2025-26 alongside a long-term extension
  bristol: 'Fitz Harding',
  exeter: 'Dafydd Jenkins',
  // Named club captain for 2025-26, with Clark and Atkinson as his vices
  gloucester: 'Tomos Williams',
  harlequins: 'Alex Dombrandt',
  // Montoya left for Pau at the end of 2024-25; Chessum leads Leicester now
  leicester: 'Ollie Chessum',
  northampton: 'Fraser Dingwall',
  sale: 'Ben Curry',
  saracens: 'Maro Itoje',

  // United Rugby Championship
  leinster: 'Caelan Doris',
  munster: 'Tadhg Beirne',
  ulster: 'Iain Henderson',
  connacht: 'Cian Prendergast',
  glasgow: 'Kyle Steyn',
  edinburgh: 'Grant Gilchrist',
  cardiff: 'Josh Adams',
  ospreys: 'Jac Morgan',
  scarlets: 'Josh Macleod',
  benetton: 'Michele Lamaro',
  stormers: 'Salmaan Moerat',
  bulls: 'Ruan Nortje',
  sharks: 'Eben Etzebeth',

  // Top 14
  toulouse: 'Antoine Dupont',
  la_rochelle: 'Gregory Alldritt',
  toulon: 'Charles Ollivon',
  bordeaux: 'Maxime Lucu',
  racing92: 'Gael Fickou',
  lyon: 'Baptiste Couilloud',
  castres: 'Mathieu Babillot',

  // Super Rugby Pacific
  crusaders: 'David Havili',
  chiefs: 'Luke Jacobson',
  blues: 'Patrick Tuipulotu',
  hurricanes: "Du'Plessis Kirifi",
  brumbies: 'Allan Alaalatoa',
  waratahs: 'Jake Gordon',
  reds: 'Tate McDermott',
}

/** Loose match: accents and punctuation differ between data files. */
export const sameName = (a: string, b: string) => {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z ]/g, '').trim()
  return norm(a) === norm(b)
}
