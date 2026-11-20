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
      r('Charles Ollivon', 53), r('Jefferson Poirot', 39), r('Karl Sorin', 0), r('Tom Staniforth', 3),
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
    // Scotland: 37 named by Scottish Rugby on 26 Oct 2026 (21 forwards, 16
    // backs), with the caps the union printed beside each name.
    SCO: [
      r('Ewan Ashman', 37), r('Josh Bayliss', 18), r('Gregor Brown', 19), r('Scott Cummings', 52),
      r('Alex Craig', 7), r('Rory Darge', 41), r('Jack Dempsey', 35), r('Matt Fagerson', 66),
      r('Zander Fagerson', 84), r('Jonny Gray', 83), r('Gregor Hiddleston', 3), r('Will Hurd', 11),
      r('Ollie Leatherbarrow', 0), r('Nathan McBeth', 8), r('Liam McConnell', 2), r('Elliot Millar Mills', 15),
      r('Jamie Ritchie', 63), r('Pierre Schoeman', 52), r('Rory Sutherland', 51), r('Seb Stephen', 1),
      r('Max Williamson', 15),
      r('Fergus Burke', 5), r('Jamie Dobie', 22), r('Darcy Graham', 57), r('George Horne', 47),
      r('Rory Hutchinson', 13), r('Huw Jones', 63), r('Tom Jordan', 20), r('Blair Kinghorn', 65),
      r('Stafford McDowall', 18), r('Kyle Rowe', 19), r('Finn Russell', 95), r('Ollie Smith', 13),
      r('Kyle Steyn', 35), r('Sione Tuipulotu', 41), r('Duhan van der Merwe', 54), r('Ben White', 38),
    ],
    // Wales: 39 named by the WRU on 20 Oct 2026 (Planet Rugby list). Caps as
    // of 18 July 2026 where the summer squad table has the man.
    WAL: [
      r('Rhys Barratt', 0), r('Taine Basham', null), r('Adam Beard', 68), r('Liam Belcher', null),
      r('James Botham', 24), r('Rhys Carré', 31), r('Ben Carter', 21), r('Ryan Elias', 51),
      r('Seb Davies', null), r('Tomas Francis', null), r('Archie Griffin', null), r('Kane James', 1),
      r('Dafydd Jenkins', null), r('Dewi Lake', 34), r('Dillon Lewis', 60), r('Alex Mann', 18),
      r('Jac Morgan', 27), r('Taine Plumtree', 15), r('Nicky Smith', 66), r('Gareth Thomas', 44),
      r('Aaron Wainwright', 70), r('Teddy Williams', 10),
      r('Josh Adams', 72), r('Sam Costelow', 22), r('Rio Dyer', null), r('Dan Edwards', 13),
      r('Gabe Hamer-Webb', null), r('Joe Hawkins', 14), r('Louie Hennessey', null), r('Che Hope', 0),
      r('Eddie James', 11), r('Max Llewellyn', 13), r('Ellis Mee', 11), r('Reuben Morgan-Williams', 3),
      r('Blair Murray', 19), r('Aneurin Owen', 0), r('Louis Rees-Zammit', 43), r('Tom Rogers', null),
      r('Tomos Williams', 75),
      // capped, not in the autumn squad
      r('Evan Lloyd', 8, false), r('Sam Wainwright', 4, false), r('Ben Warren', 3, false),
      r('Tommy Reffell', 30, false), r('Kieran Hardy', 32, false), r('Mason Grady', 17, false),
      r('Ben Thomas', 19, false),
    ],
    // Italy: 34 named by the FIR on 21 Oct 2026. Caps as of 21 Oct 2026, ahead
    // of the November Tests.
    ITA: [
      r('Tommaso Di Bartolomeo', 12), r('Gianmarco Lucchesi', 36), r('Giacomo Nicotera', 41), r('Simone Ferrari', 73),
      r('Danilo Fischetti', 66), r('Muhamed Hasa', 11), r('Ion Neculai', 4), r('Ivan Nemer', 16),
      r('Marco Riccioni', 39), r('Niccolò Cannone', 65), r('Mattia Midena', 0), r('Enoch Opoku-Gyamfi', 1),
      r('Federico Ruzza', 74), r('Lorenzo Cannone', 40), r('Samuele Locatelli', 0), r('Alessandro Ortombina', 2),
      r('Ross Vintcent', 22), r('Manuel Zuliani', 43),
      r('Alessandro Fusco', 27), r('Alessandro Garbisi', 25), r('Stephen Varney', 39), r('Tommaso Allan', 91),
      r('Paolo Garbisi', 57), r('Leonardo Marin', 25), r('Damiano Mazza', 0), r('Federico Mori', 17),
      r('Paolo Odogwu', 10), r('Mirko Belloni', 3), r('Monty Ioane', 49), r('Louis Lynagh', 16),
      r('Federico Zanandrea', 0), r('Ange Capuozzo', 32), r('Matt Gallagher', 3), r('Giovanni Montemauri', 0),
    ],
    // New Zealand: 36 named by NZR on 26 Oct 2026 (20 forwards, 16 backs),
    // with the Test caps the union printed beside each name.
    NZL: [
      r('Codie Taylor', 114), r('Asafo Aumua', 27), r('George Bell', 4), r('Ethan de Groot', 46),
      r('George Bower', 31), r('Xavier Numia', 6), r('Fletcher Newell', 43), r('Pasilio Tosi', 19),
      r("Saula Ma'u", 0), r('Scott Barrett', 91), r('Josh Lord', 18), r('Fabian Holland', 16),
      r('Jamie Hannah', 1), r("Tupou Vaa'i", 53), r('Anton Segner', 3), r("Leicester Fainga'anuku", 12),
      r('Ethan Blackadder', 15), r('Christian Lio-Willie', 3), r('Peter Lakai', 16), r('Wallace Sititi', 25),
      r('Cam Roigard', 26), r('Kyle Preston', 6), r('Cortez Ratima', 25), r("Richie Mo'unga", 57),
      r('Damian McKenzie', 83), r('Josh Jacomb', 0), r('Jordie Barrett', 86), r('Quinn Tupaea', 31),
      r('Timoci Tavatavanawai', 3), r('Anton Lienert-Brown', 94), r('Rieko Ioane', 91), r('Chay Fihaki', 1),
      r('Fehi Fineanganofo', 1), r('Josh Moorby', 7), r('Will Jordan', 63), r('Beauden Barrett', 147),
    ],
    // Australia: 33 named by Rugby Australia on 23 Oct 2026 (19 forwards, 14
    // backs), with the caps the union printed beside each name.
    AUS: [
      r('Allan Alaalatoa', 96), r('Miles Amatosero', 2), r('Angus Bell', 60), r('Josh Canham', 9),
      r('Massimo De Lutiis', 5), r('Tom Hooper', 25), r('Isaac Kailea', 9), r('Tom Lambert', 0),
      r('Fraser McReight', 49), r('Josh Nasser', 18), r('Brandon Paenga-Amosa', 32), r('Billy Pollard', 26),
      r('Lukhan Salakaia-Loto', 50), r('Lachlan Shaw', 6), r('Carlo Tizzano', 18), r('Taniela Tupou', 74),
      r('Rob Valetini', 71), r('Jeremy Williams', 35), r('Harry Wilson', 45),
      r('Filipo Daugunu', 25), r('Ben Donaldson', 27), r('Carter Gordon', 13), r('Isaac Henry', 6),
      r('Len Ikitau', 56), r('Max Jorgensen', 30), r('Ryan Lonergan', 15), r('Tate McDermott', 57),
      r('Declan Meredith', 5), r('Hunter Paisami', 39), r('Harry Potter', 18), r('Joseph-Aukuso Suaalii', 27),
      r('Teddy Wilson', 0), r('Tom Wright', 53),
    ],
    // South Africa: 37 named by SA Rugby on 28 Oct 2026 (rugby365 list). Caps
    // from the Nations Championship's own squad page, read 20 Nov 2026: that
    // is AFTER the Italy and France Tests, so a man who played both is two
    // too high. To be corrected from the two team sheets (research log).
    RSA: [
      r('Thomas du Toit', 37), r('Ox Nche', 53), r('Wilco Louw', 36), r('Ntuthuko Mchunu', 4),
      r('Zachary Porthen', 8), r('Gerhard Steenekamp', 23), r('Malcolm Marx', 94), r('Jan-Hendrik Wessels', 15),
      r('Lood de Jager', 78), r('Salmaan Moerat', null), r('Ruan Nortje', 24), r('Riley Norton', 0),
      r('Franco Mostert', 85), r('Paul de Villiers', 5), r('Siya Kolisi', 107), r('Cameron Hanekom', 6),
      r('Emmanuel Tshituka', 0), r('Jasper Wiese', 50), r('Pieter-Steph du Toit', 102), r('Marco van Staden', 38),
      r('Cobus Reinach', 57), r('Morne van den Berg', 11), r('Grant Williams', 31), r('Yaqeen Ahmed', 0),
      r('Sacha Feinberg-Mngomezulu', 25), r('Luan Giliomee', 0), r('Manie Libbok', 34), r('Damian de Allende', 103),
      r('Jesse Kriel', 94), r('Markus Muller', 0), r('Canan Moodie', 26), r('Sebastian de Klerk', 0),
      r('Aphelele Fassi', 19), r('Ethan Hooker', 14), r('Edwill van der Merwe', 8), r('Kurt-Lee Arendse', 35),
      r('Damian Willemse', 55),
      // capped, not in the 28 Oct squad
      r('Eben Etzebeth', 147, false), r('Cheslin Kolbe', 53, false), r('Handre Pollard', 88, false),
      r('Andre Esterhuizen', 36, false), r('Faf de Klerk', 60, false), r('Elrigh Louw', 16, false),
      r('Evan Roos', 9, false), r('Ben-Jason Dixon', 11, false), r('Johan Grobbelaar', 11, false),
      r('Boan Venter', 10, false), r('Herschel Jantjies', 26, false), r('Embrose Papier', 8, false),
      r('Cobus Wiese', 6, false), r('Quan Horn', 3, false),
    ],
    // Argentina: 33 named by the UAR on 30 Oct 2026. Caps as of 6 Nov 2026,
    // AFTER Ireland v Argentina: the 23 who played that night are one too
    // high and are to be corrected (see the research log).
    ARG: [
      r('Julián Montoya', 121), r('Leonel Oviedo', 4), r('Rodrigo Martínez', 4), r('Francisco Moreno', 4),
      r('Tomas Rapetti', 8), r('Joel Sclavi', 33), r('Mayco Vivas', 45), r('Boris Wenger', 12),
      r('Efraín Elías', 7), r('Tomás Lavanini', 94), r('Guido Petti', 105), r('Pedro Rubiolo', 32),
      r('Juan Martín González', 52), r('Facundo Isa', 53), r('Marcos Kremer', 84), r('Pablo Matera', 128),
      r('Joaquín Moro', 8), r('Juan Martín Scelzo', 3),
      r('Simón Benítez Cruz', 16), r('Gonzalo García', 20), r('Agustín Moyano', 11), r('Tomás Albornoz', 25),
      r('Gerónimo Prisciantelli', 7), r('Santiago Chocobares', 36), r('Lucio Cinti', 46), r('Justo Piccardo', 14),
      r('Faustino Sánchez Valarolo', 5), r('Mateo Carreras', 37), r('Bautista Delguy', 43), r('Rodrigo Isgró', 20),
      r('Ignacio Mendy', 8), r('Juan Cruz Mallía', 52), r('Mateo Soler', 1),
    ],
  },
  w: {},
}
