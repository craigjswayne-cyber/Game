// THE REAL TEST SQUADS AND CAPS THE WORLD STARTS WITH (owner, 1.9.16).
//
// "We need to research international teams - there are recent autumn
//  internationals - we should build our squads from the starting game from
//  that. Cap numbers should also be in there."
//
// Until now a man's caps were made up from his age and rating (deriveCaps),
// and the first Test squads of a career were simply the best-rated qualified
// men. This table is the real thing: who each union named for the autumn 2026
// window, and how many caps each man had going into it.
//
// RULES FOR THIS TABLE (the same law as verified.ts and additions.ts)
//   1. A squad is the one the union itself named for the November 2026 window.
//      The source and its date are in docs/research/intl-squads-2026.md.
//   2. Caps are the count BEFORE the autumn 2026 Tests, which is the day a
//      career starts. A figure that could not be checked is `null`, and the
//      man keeps his estimate: no number is ever guessed into this file.
//   3. `squad: false` is a capped man who was NOT in the autumn squad (hurt,
//      rested or left out). His caps are real; the federation is not told to
//      pick him.
//   4. Names are spelled as the squad files spell them. scripts/intlaudit.ts
//      lists every name here that the world cannot find, and fails on a
//      nation whose named squad is mostly missing.
export interface IntlRow {
  name: string
  /** caps before the autumn 2026 window; null when not yet checked */
  caps: number | null
  /** named in the union's autumn 2026 squad (default true) */
  squad?: boolean
}
const r = (name: string, caps: number | null, squad = true): IntlRow => (squad ? { name, caps } : { name, caps, squad })

export const INTL_2026: { m: Record<string, IntlRow[]>; w: Record<string, IntlRow[]> } = {
  m: {
    // England: 36 named by the RFU on 2 Nov 2026 (20 forwards, 16 backs).
    // Caps as of 18 July 2026, after Argentina v England.
    ENG: [
      r('Fin Baxter', null), r('Ollie Chessum', 38), r('Arthur Clark', 1), r('Alex Coles', 22),
      r('Luke Cowan-Dickie', 61), r('Ben Curry', null), r('Tom Curry', 71), r('Theo Dan', 20),
      r('Ben Earl', 54), r('Greg Fisilau', 0), r('Jamie George', 113), r('Ellis Genge', 83),
      r('Joe Heyes', 25), r('Maro Itoje', null), r('Emmanuel Iyogun', 1), r('George Martin', 24),
      r('Asher Opoku-Fordjour', 8), r('Tom Pearson', null), r('Henry Pollock', 13), r('Will Stuart', null),
      r('Seb Atkinson', 7), r('Fraser Dingwall', null), r('Immanuel Feyi-Waboso', 16), r('George Ford', 108),
      r('Tommy Freeman', 30), r('George Furbank', 14), r('Will Joseph', null), r('Joe Marchant', null),
      r('Cadan Murley', 7), r('Harry Randall', null), r('Henry Slade', 77), r('Fin Smith', 19),
      r('Marcus Smith', 53), r('Ben Spencer', 19), r('Freddie Steward', 44), r('Jack van Poortvliet', 27),
      // capped, not in the autumn squad
      r('Alex Mitchell', 32, false), r('Max Ojomoh', 2, false), r('Guy Pepper', 15, false),
      r('Ted Hill', 5, false), r('Charlie Ewels', 35, false), r('Beno Obano', 5, false),
      r('George Kloska', 2, false), r('Vilikesa Sela', 0, false), r('Benhard Janse van Rensburg', 2, false),
      r('Noah Caluori', 2, false),
    ],
    // France: 42 named by the FFR on 21 Oct 2026 (Reuters list). Caps as of
    // 21 Oct 2026, ahead of the November Tests. Jeremy Ward was named as a
    // training partner only (not eligible until 2027) and is left out.
    FRA: [
      r('Grégory Alldritt', 58), r('Hugo Auradou', 14), r('Paul Boudehent', 21), r('Joshua Brennan', 3),
      r('Esteban Capilla', 0), r('Guillaume Cramont', 1), r('François Cros', 44), r('Tyler Duguid', 1),
      r('Sipili Falatea', 15), r('Alexandre Fischer', 3), r('Marko Gazzotti', null), r('Jean-Baptiste Gros', 45),
      r('Mickaël Guillard', 19), r('Oscar Jégou', 15), r('Maxime Lamothe', 6), r('Peato Mauvaka', 48),
      r('Charles Ollivon', 53), r('Jefferson Poirot', 39), r('Karl Sorin', 0), r('Thomas Staniforth', 3),
      r('Tevita Tatafu', 3), r('Reda Wardi', 18), r('Cameron Woki', 32),
      r('Théo Attissogbe', 16), r('Léo Barré', 9), r('Louis Bielle-Biarrey', 27), r('Fabien Brau-Boirie', null),
      r('Axel Desperes', 0), r('Antoine Dupont', 64), r('Mathis Ferté', 0), r('Théo Forner', 0),
      r('Émilien Gailleton', 13), r('Kalvin Gourgues', 4), r('Aaron Grandidier-Nkanang', 2), r('Antoine Hastoy', null),
      r('Nolann Le Garrec', 16), r('Maxime Lucu', 33), r('Yoram Moefana', 42), r('Romain Ntamack', 45),
      r('Damian Penaud', 50), r('Tani Vili', 0),
      // capped, not in the 21 Oct squad (called in later, or hurt)
      r('Thomas Laclayat', 3, false), r('Anthony Jelonch', 39, false), r('Nicolas Depoortère', 9, false),
    ],
    // Ireland: 36 named by the IRFU on 21 Oct 2026 (19 forwards, 17 backs),
    // with the caps the union printed beside each name that day.
    IRE: [
      r('Ryan Baird', 33), r('Tadhg Beirne', 73), r('Billy Bohan', 1), r('Thomas Clarkson', 16),
      r('Tadhg Furlong', 88), r('Sam Illo', 1), r('Sean Jansen', 2), r('Rónan Kelleher', 51),
      r('Joe McCarthy', 26), r('James McNabney', 0), r('Darragh Murray', 3), r("Tom O'Toole", 24),
      r('Andrew Porter', 79), r('Cian Prendergast', 11), r('James Ryan', 83), r('Dan Sheehan', 41),
      r('Tom Stewart', 6), r('Nick Timoney', 14), r('Josh van der Flier', 81),
      r('Bundee Aki', 72), r('Rob Baloucoune', 9), r('Jamie Benson', 0), r('Craig Casey', 30),
      r('Nathan Doak', 2), r('Ciaran Frawley', 15), r('Jamison Gibson-Park', 53), r('Mack Hansen', 30),
      r('Robbie Henshaw', 85), r('Hugo Keenan', 48), r('Stuart McCloskey', 31), r("Jimmy O'Brien", 14),
      r("Tommy O'Brien", 9), r('Jamie Osborne', 17), r('Sam Prendergast', 17), r('Garry Ringrose', 76),
      r('Jacob Stockdale', 43),
    ],
  },
  w: {},
}
