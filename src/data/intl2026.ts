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
  },
  w: {},
}
