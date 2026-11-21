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
    // The eight men that table does not have (1.9.16 club audit): the
    // championship's England squad page, read 21 Nov 2026, less one for each
    // of the Australia (8 Nov) and Japan (14 Nov) 23s a man was named in
    // (rugby.com.au and RugbyPass team sheets). Assumes every replacement
    // came on. Itoje's 102 also stands on his own page 'as of 22 Oct 2026'.
    // Harry Randall is not on the page and stays open.
    ENG: [
      r('Fin Baxter', 18), r('Ollie Chessum', 38), r('Arthur Clark', 1), r('Alex Coles', 22),
      r('Luke Cowan-Dickie', 61), r('Ben Curry', 14), r('Tom Curry', 71), r('Theo Dan', 20),
      r('Ben Earl', 54), r('Greg Fisilau', 0), r('Jamie George', 113), r('Ellis Genge', 83),
      r('Joe Heyes', 25), r('Maro Itoje', 102), r('Emmanuel Iyogun', 1), r('George Martin', 24),
      r('Asher Opoku-Fordjour', 8), r('Tom Pearson', 1), r('Henry Pollock', 13), r('Will Stuart', 53),
      r('Seb Atkinson', 7), r('Fraser Dingwall', 10), r('Immanuel Feyi-Waboso', 16), r('George Ford', 108),
      r('Tommy Freeman', 30), r('George Furbank', 14), r('Will Joseph', 1), r('Joe Marchant', 26),
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
    // Gazzotti, Brau-Boirie and Hastoy withdrew hurt on 26 Oct and played no
    // November Test, so the championship page's figure (read 21 Nov 2026) is
    // their figure before the autumn.
    FRA: [
      r('Grégory Alldritt', 58), r('Hugo Auradou', 14), r('Paul Boudehent', 21), r('Joshua Brennan', 3),
      r('Esteban Capilla', 0), r('Guillaume Cramont', 1), r('François Cros', 44), r('Tyler Duguid', 1),
      r('Sipili Falatea', 15), r('Alexandre Fischer', 3), r('Marko Gazzotti', 4), r('Jean-Baptiste Gros', 45),
      r('Mickaël Guillard', 19), r('Oscar Jégou', 15), r('Maxime Lamothe', 6), r('Peato Mauvaka', 48),
      r('Charles Ollivon', 53), r('Jefferson Poirot', 39), r('Karl Sorin', 0), r('Tom Staniforth', 3),
      r('Tevita Tatafu', 3), r('Reda Wardi', 18), r('Cameron Woki', 32),
      r('Théo Attissogbe', 16), r('Léo Barré', 9), r('Louis Bielle-Biarrey', 27), r('Fabien Brau-Boirie', 5),
      r('Axel Desperes', 0), r('Antoine Dupont', 64), r('Mathis Ferté', 0), r('Théo Forner', 0),
      r('Émilien Gailleton', 13), r('Kalvin Gourgues', 4), r('Aaron Grandidier-Nkanang', 2), r('Antoine Hastoy', 11),
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
    // of 18 July 2026 where the summer squad table has the man. The men it
    // does not have (1.9.16 club audit): the championship's Wales squad page,
    // read 21 Nov 2026, less one for each of the Japan (7 Nov) and New
    // Zealand (14 Nov) 23s a man was named in (rugby365 and RugbyPass team
    // sheets). Assumes every replacement came on. Rio Dyer is not on the
    // page and stays open. 'Gabriel Hamer-Webb' is the page's spelling and
    // the squad files' (the row said Gabe).
    WAL: [
      r('Rhys Barratt', 0), r('Taine Basham', 17), r('Adam Beard', 68), r('Liam Belcher', 5),
      r('James Botham', 24), r('Rhys Carré', 31), r('Ben Carter', 21), r('Ryan Elias', 51),
      r('Seb Davies', 17), r('Tomas Francis', 82), r('Archie Griffin', 16), r('Kane James', 1),
      r('Dafydd Jenkins', 31), r('Dewi Lake', 34), r('Dillon Lewis', 60), r('Alex Mann', 18),
      r('Jac Morgan', 27), r('Taine Plumtree', 15), r('Nicky Smith', 66), r('Gareth Thomas', 44),
      r('Aaron Wainwright', 70), r('Teddy Williams', 10),
      r('Josh Adams', 72), r('Sam Costelow', 22), r('Rio Dyer', null), r('Dan Edwards', 13),
      r('Gabriel Hamer-Webb', 1), r('Joe Hawkins', 14), r('Louie Hennessey', 0), r('Che Hope', 0),
      r('Eddie James', 11), r('Max Llewellyn', 13), r('Ellis Mee', 11), r('Reuben Morgan-Williams', 3),
      r('Blair Murray', 19), r('Aneurin Owen', 0), r('Louis Rees-Zammit', 43), r('Tom Rogers', 13),
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
    // from the Nations Championship's own squad page, read 20 Nov 2026, with
    // one cap taken off for each of the Italy (7 Nov) and France (13 Nov)
    // match-day 23s a man was named in (rugby365), so these are the caps
    // before the autumn. Assumes every replacement came on. Moerat: 11 going
    // into the Italy Test, his first of 2026 (Reuters via Flashscore).
    RSA: [
      r('Thomas du Toit', 35), r('Ox Nche', 51), r('Wilco Louw', 34), r('Ntuthuko Mchunu', 4),
      r('Zachary Porthen', 8), r('Gerhard Steenekamp', 21), r('Malcolm Marx', 92), r('Jan-Hendrik Wessels', 13),
      r('Lood de Jager', 76), r('Salmaan Moerat', 11), r('Ruan Nortje', 22), r('Riley Norton', 0),
      r('Franco Mostert', 84), r('Paul de Villiers', 3), r('Siya Kolisi', 105), r('Cameron Hanekom', 4),
      r('Emmanuel Tshituka', 0), r('Jasper Wiese', 48), r('Pieter-Steph du Toit', 100), r('Marco van Staden', 38),
      r('Cobus Reinach', 56), r('Morne van den Berg', 9), r('Grant Williams', 30), r('Yaqeen Ahmed', 0),
      r('Sacha Feinberg-Mngomezulu', 23), r('Luan Giliomee', 0), r('Manie Libbok', 32), r('Damian de Allende', 101),
      r('Jesse Kriel', 92), r('Markus Muller', 0), r('Canan Moodie', 26), r('Sebastian de Klerk', 0),
      r('Aphelele Fassi', 19), r('Ethan Hooker', 12), r('Edwill van der Merwe', 8), r('Kurt-Lee Arendse', 33),
      r('Damian Willemse', 53),
      // capped, not in the 28 Oct squad
      r('Eben Etzebeth', 147, false), r('Cheslin Kolbe', 53, false), r('Handre Pollard', 88, false),
      r('Andre Esterhuizen', 36, false), r('Faf de Klerk', 60, false), r('Elrigh Louw', 16, false),
      r('Evan Roos', 9, false), r('Ben-Jason Dixon', 11, false), r('Johan Grobbelaar', 11, false),
      r('Boan Venter', 10, false), r('Herschel Jantjies', 26, false), r('Embrose Papier', 8, false),
      r('Cobus Wiese', 6, false), r('Quan Horn', 3, false),
    ],
    // Argentina: 33 named by the UAR on 30 Oct 2026. Caps before the autumn
    // Tests: the table dated 6 Nov 2026 (after Ireland v Argentina) less one
    // for each of the 23 named that night (The 42's team sheet). It assumes
    // every replacement came on.
    ARG: [
      r('Julián Montoya', 120), r('Leonel Oviedo', 3), r('Rodrigo Martínez', 4), r('Francisco Moreno', 3),
      r('Tomas Rapetti', 8), r('Joel Sclavi', 32), r('Mayco Vivas', 44), r('Boris Wenger', 11),
      r('Efraín Elías', 6), r('Tomás Lavanini', 94), r('Guido Petti', 104), r('Pedro Rubiolo', 31),
      r('Juan Martín González', 51), r('Facundo Isa', 53), r('Marcos Kremer', 83), r('Pablo Matera', 127),
      r('Joaquín Moro', 8), r('Juan Martín Scelzo', 2),
      r('Simón Benítez Cruz', 15), r('Gonzalo García', 19), r('Agustín Moyano', 11), r('Tomás Albornoz', 24),
      r('Gerónimo Prisciantelli', 6), r('Santiago Chocobares', 35), r('Lucio Cinti', 45), r('Justo Piccardo', 13),
      r('Faustino Sánchez Valarolo', 5), r('Mateo Carreras', 36), r('Bautista Delguy', 42), r('Rodrigo Isgró', 20),
      r('Ignacio Mendy', 8), r('Juan Cruz Mallía', 51), r('Mateo Soler', 1),
    ],
    // Fiji: the 35 named for November (RugbyPass, 30 Oct 2026) are the squad;
    // the rest of the union's 2026 Nations Championship list are capped men
    // outside it. Caps from the championship's own squad page, read 20 Nov
    // 2026, with one cap taken off for each of the France (7 Nov, Lyon) and
    // Ireland (14 Nov, Dublin) match-day 23s a man was named in (rugby365 team
    // announcements), so these are the caps before the autumn. Assumes every
    // replacement came on. Check: the page had Nathan Hughes (first Fiji Test
    // v France) and Setareki Bituniyata (debut v Ireland) on 1; both are now 0.
    // 'Joe Tamani' and 'Ponipati Loganimasi' on the page are the Joseva Tamani
    // and Ponipate Loganimasi of the 30 Oct party and the Ireland 23 (one man
    // each: the page has one Tamani forward, and RugbyPass, Planet Rugby and
    // World Rugby all print Joseva and Ponipate). One row each, under the
    // spelling the squad files use, with the page's caps less the Ireland Test.
    // Iosefo Masi is not on the page and stays open.
    FIJ: [
      r('Mesake Doge', 30, false), r('Tim Hoyt', 3, false), r('Eroni Mawi', 50), r('Vilikesa Nairau', 1),
      r('Livai Natave', 6, false), r('Marika Parker', 0), r('Peni Ravai', 59), r('Inoke Ravuiwasa', 2),
      r('Luke Tagi', 17), r('Samu Tawake', 19, false), r('Meli Tuni', 4, false), r('Penaia Cakobau', 1, false),
      r('Tevita Ikanivere', 37), r('Sam Matavesi', 40, false), r('Peniami Narisia', 1), r('Kavaia Tagivetaua', 2, false),
      r('Zuriel Togiatama', 12), r('Temo Mayanavanua', 37, false), r('Vilive Miramira', 6, false), r('Peni Naruma', 1, false),
      r('Isoa Nasilasila', 33), r('Tevita Ratuva', 14, false), r('Setareki Turagacoke', 3), r('Mesake Vocevoce', 21),
      r('Levani Botia', 31, false), r('Elia Canakaivata', 23), r('Motikiai Murray', 8, false), r('Kitione Salawa', 17),
      r('Pita-Gus Sowakula', 6), r('Lekima Tagitagivalu', 13), r('Isoa Tuwai', 2, false),
      r('Aporosa Vuniyayawa', 1, false), r('Etonia Waqa', 4, false), r('Peceli Yato', 24), r('Nathan Hughes', 0),
      r('Simione Kuruvoli', 26), r('Frank Lomani', 47), r('Terio Tamani', 2), r('Sam Wye', 8, false),
      r('Isaiah Armstrong-Ravula', 23, false), r('Caleb Muntz', 26), r('Ben Volavola', 47), r('Iosefo Balewairiki', 11, false),
      r('Kavekini Boselawa', 1, false), r('Vilimoni Botitu', 18), r('Sireli Maqala', 16), r('Isikeli Rabitu', 3),
      r('Semi Radradra', 22, false), r('Isaac Ratumaitavuki-Kneepkens', 1, false), r('Kalaveti Ravouvou', 18, false), r('Tuidraki Samusamuvodre', 5, false),
      r('Seta Tamanivalu', 6, false), r('Josua Tuisova', 34), r('Virimi Vakatawa', 3, false), r('Setareki Bituniyata', 0),
      r('Nacani Boginisoko', 1, false), r('Vinaya Habosi', 11), r('Manasa Mataele', 5, false),
      r('Joji Nasova', 6, false), r('Selestino Ravutaumada', 12), r('Salesi Rayasi', 7), r('Jiuta Wainiqolo', 21),
      r('Vuate Karawalevu', 8, false),
      // in the 30 Oct party, not on the championship's squad page
      r('Joseva Tamani', 3), r('Iosefo Masi', null), r('Ponipate Loganimasi', 8),
    ],
    // Japan: the 35 named for November (RugbyPass, 26 Oct 2026) are the squad;
    // the rest of the union's 2026 list are capped men outside it. Caps from
    // the championship's own squad page, read 20 Nov 2026, with one cap taken
    // off for each of the Wales (7 Nov, Cardiff) and England (14 Nov,
    // Twickenham) match-day 23s a man was named in (JRFU team announcements),
    // so these are the caps before the autumn. Assumes every replacement came
    // on; the JRFU sheets print each man's caps before the Test, and all 23
    // named v Wales carry exactly the figure this sum gives.
    // 'Michael Stolberg' (JRFU, RugbyPass) and 'Mike Stolberg' (the page, the
    // squad files) are one man, born 27 Mar 1992, Brave Lupus lock: one row,
    // in the squad, 7 before Wales on the JRFU sheet. Moriyama likewise is
    // one man ('Miuaustin' on the page, 'Miu Austin' in the party list).
    // Opeti Helu (Lyon) was on both November benches for Japan, so he is
    // Japan's, not Tonga's; he was not in the 26 Oct party.
    JPN: [
      r('Opeti Helu', 2, false), r('Kanato Hirano', 1), r('Takumi Inaba', 3, false), r('Ryosuke Iwaihara', 5),
      r('Yota Kamimori', 3), r('Sanshiro Kihara', 1, false), r('Sena Kimura', 5), r('Takato Okabe', 14, false),
      r('Sojiro Otsuka', 9), r('Izi Sword', 2, false), r('Shuhei Takeuchi', 31), r('Keijiro Tamefusa', 25),
      r('Latu Taufa', 0, false), r('Hayate Era', 11, false), r('Mamoru Harada', 20), r('Kenji Sato', 13),
      r('Ruan Botha', 1), r('Jack Cornelsen', 38), r('Warner Dearns', 38), r("Esei Ha'angana", 5),
      r('Harry Hockings', 10), r('Mike Stolberg', 7), r('Tiennan Costley', 19), r('Ben Gunter', 26),
      r('Michael Leitch', 96, false), r('Faulua Makisi', 29, false), r('Miu Austin Moriyama', 0), r('Kanji Shimokawa', 30),
      r('Shinobu Fujiwara', 22), r('Kenta Fukuda', 9), r('Itsuki Kamimura', 3, false), r('Naoto Saito', 37),
      r('Sam Greene', 10, false), r('Ryunosuke Ito', 9, false), r('Riku Kitahara', 0), r('Shinya Komura', 3),
      r('Takuro Matsunaga', 12), r('Yuya Hirose', 10, false), r('Yuki Ikeda', 2), r('Charlie Lawrence', 10),
      r('Jisu Lee', 1), r('Tomoki Osada', 27, false), r('Dylan Riley', 46), r('Samisoni Tua', 9),
      r('Inoke Burua', 4), r('Kippei Ishida', 11), r('Haruto Kida', 4, false), r('Taira Main', 4, false),
      r('Jone Naikabula', 17, false), r('Koga Nezuka', 3), r('Riku Tokito', 0), r('Kazuma Ueda', 9),
      r('Yoshitaka Yazaki', 11, false), r('Shunsuke Uenobo', 3, false),
    ],
  },
  // THE WOMEN: the twelve unions of the 2026 WXV Global Series (September and
  // October 2026), which are the twelve Test unions of a women's world.
  w: {
    // England: 36 named by the RFU on 7 Sep 2026, with the caps RugbyPass
    // printed beside each name that day (Planet Rugby's list agrees on names).
    ENG: [
      r('Bryony Field', 0), r('Sarah Bern', 84), r('Hannah Botterman', 62), r('Delaney Burns', 6),
      r('Abi Burton', 9), r('May Campbell', 5), r('Mackenzie Carson', 28), r('Kelsey Clifford', 25),
      r('Amy Cokayne', 94), r('Maddie Feaunati', 27), r('Haidee Head', 1), r('Lilli Ives Campion', 8),
      r('Hayley Jones', 0), r('Sadia Kabeya', 32), r('Haineala Lutui', 4), r('Alex Matthews', 82),
      r('Sophie McQueen', 0), r('Maud Muir', 53), r('Marlie Packer', 116), r('Demelza Short', 4),
      r('Morwenna Talling', 29), r('Holly Aitchison', 49), r('Jess Breach', 57), r('Millie David', 1),
      r('Zoe Harrison', 70), r('Tatyana Heard', 36), r('Natasha Hunt', 89), r('Megan Jones', 38),
      r('Ellie Kildunne', 62), r('Claudia Moloney-MacDonald', 40), r('Lucy Packer', 44), r('Flo Robinson', 5),
      r('Helena Rowland', 51), r('Emma Sing', 17), r('Mia Venner', 4), r('Bo Westcombe-Evans', 2),
    ],
    // Scotland: 32 named by Scottish Rugby on 4 Aug 2026, caps beside each name.
    SCO: [
      r('Leah Bartlett', 54), r('Holland Bogan', 5), r('Sarah Bonar', 51), r('Hollie Cunningham', 7),
      r('Elliann Clarke', 29), r('Eva Donaldson', 26), r('Evie Gallagher', 40), r('Rachel Malcolm', 64),
      r('Elis Martin', 30), r('Rachel McLachlan', 59), r('Molly Poolman', 12), r('Imogen Spence', 0),
      r('Lana Skeldon', 87), r('Alex Stewart', 20), r('Aicha Sutcliffe', 2), r('Demi Swann', 5),
      r('Emma Wassell', 78), r('Anne Young', 22), r('Ceitidh Ainsworth', 0), r('Leia Brebner-Holden', 20),
      r('Katie Buchanan', 0), r('Shona Campbell', 14), r('Rhea Clarke', 4), r('Nicole Flynn', 0),
      r('Rhona Lloyd', 66), r('Helen Nelson', 80), r('Rachel Philipps', 4), r('Hannah Ramsay', 2),
      r('Chloe Rollie', 86), r('Lucia Scott', 12), r('Meryl Smith', 27), r('Evie Wills', 10),
    ],
    // Australia: 32 named by Rugby Australia on 28 Aug 2026, caps beside each name.
    AUS: [
      r('Jemma Bemrose', 0), r('Lily Bone', 4), r('Emily Chancellor', 38), r('Piper Duck', 27),
      r('Waiaria Ellis', 7), r('Piper Flynn', 0), r('Georgina Friedrichs', 42), r('Martha Fua', 4),
      r('Caitlyn Halse', 15), r('Tia Hinds', 11), r('Brianna Hoy', 14), r('Eva Karpani', 46),
      r('Kaitlan Leaney', 40), r('Michaela Leonard', 47), r('Hera-Barb Malcolm Heke', 3), r('Brittany Merlo', 4),
      r('Desiree Miller', 28), r('Tiarah Minns', 6), r('Faitala Moleka', 31), r('Tania Naden', 30),
      r("Bridie O'Gorman", 42), r('Siokapesi Palu Sekona', 28), r('Faliki Pohiva', 11), r('Ella Ryan', 1),
      r('Allana Sikimeti', 4), r('Piper Simons', 2), r('Cecilia Smith', 30), r('Pia Tapsell', 1),
      r('Tabua Tuinakauvadra', 22), r('Ava Wereta', 2), r('Amelia Whitaker', 0), r('Samantha Wood', 16),
    ],
    // South Africa: 30 named by SA Rugby on 11 Sep 2026 (RugbyPass list), caps beside each name.
    RSA: [
      r('Byrhandré Dolf', 30), r('Jakkie Cilliers', 26), r('Alichia Arries', 10), r('Maceala Samboya', 11),
      r('Aphiwe Ngwevu', 36), r('Shiniqwa Lamprecht', 3), r('Naima Hlatshwayo', 3), r('Patience Mokone', 5),
      r('Maria Tshiremba', 1), r('Ayanda Malinga', 20), r('Libbie Janse van Rensburg', 35), r('Unam Tose', 32),
      r('Anacadia Minnaar', 9), r('Xoliswa Khuzwayo', 14), r('Sanelisiwe Charlie', 33), r('Yonela Ngxingolo', 47),
      r('Nombuyekezo Mdliki', 16), r('Babalwa Latsha', 44), r('Lindelwa Gwala', 41), r('Anushka Groenewald', 11),
      r('Micke Gunter', 18), r('Danelle Lochner', 25), r('Vainah Ubisi', 27), r('Nomsa Mokwai', 20),
      r('Catha Jacobs', 31), r('Sizophila Solontsi', 36), r('Sinelitha Noxeke', 9), r('Lerato Makua', 20),
      r('Logan Welman', 6), r('Aseza Hele', 35),
    ],
    // USA: 36 named by USA Rugby on 3 Sep 2026 (eagles.rugby). No caps on
    // the page: every count is still to be checked.
    // 1.9.16 club audit: only the two uncapped before the first Test (v Ireland, 20 Sep) could be
    // sourced: Mason ("uncapped", RugbyPass 17 Sep) and Carlton (debut v Italy, RugbyPass 22 Oct).
    // No USA team sheet found prints caps. 'Mae Sagapolu' is the union's Keia Mae Sagapolu Sanele,
    // spelled as w_pwr.ts and RugbyPass's 17 Sep team sheet spell her (rule 4).
    USA: [
      r('Hope Rogers', null), r('Alivia Leatherman', null), r('Lauryn Carlton', 0), r('Kathryn Treder', null),
      r('Chloe Hill-Huse', null), r('Sam Brackett', null), r('Mae Sagapolu', null), r('Reece Woods', null),
      r('Mona Lisa Topu', null), r('Hallie Taufoou', null), r('Rachel Ehrecke', null), r('Erica Jarrell-Searcy', null),
      r('Malia Isaacs', null), r('Hann Humphreys', null), r('Georgie Perris-Redding', null), r('Ina Bailey', null),
      r('Freda Tafuna', null), r('Kennedy Feasby', null), r('Kate Zackary', null), r('Abigail Paton', null),
      r('Cassidy Bargell', null), r('Sadie Schier', null), r('Taina Tukuafu', null), r('Bella Vogel', null),
      r('Nina Mason', 0), r('Kayla Canett', null), r('Katana Howard', null), r('Alev Kelter', null),
      r('Emily Henrich', null), r('Tessa Hann', null), r('Telesi Uhatafe', null), r('Karina Gauto', null),
      r('Bulou Mataitoga', null), r('Erica Coulibaly', null), r('Tahna Wilfley', null), r('Ashley Cowdrey', null),
    ],
    // New Zealand: 31 named by NZR on 9 Aug 2026 for the rest of the year
    // (the WXV Global Series included), with Test caps beside each name.
    NZL: [
      r('Chryss Viliko', 22), r('Maddison Robinson', 3), r('Ngano Tavake', 0), r('Vici-Rose Green', 7),
      r('Atlanta Lolohea', 11), r('Georgia Ponsonby', 40), r('Veisinia Mahutariki-Fakalelu', 6), r("Mo'omo'oga Palu", 1),
      r('Santo Taumata', 7), r('Maiakawanakaulani Roos', 41), r('Laura Bayfield', 9), r("Maama Mo'onia Vaipulu", 10),
      r('Amarante Sititi', 0), r('Mia Anderson', 3), r("Liana Mikaele-Tu'u", 38), r('Kaipo Olsen-Baker', 19),
      r('Elinor-Plum King', 0), r('Layla Sae', 19), r('Maia Joseph', 19), r('Tara Turner', 3),
      r('Ruahei Demant', 54), r('Hannah King', 13), r('Sylvia Brunt', 32), r('Justine McGregor', 3),
      r('Amy Du Plessis', 25), r('Alena Saili', 5), r('Maia Davis', 0), r("Ayesha Leti-I'iga", 33),
      r('Mererangi Paul', 17), r('Braxton Sorensen-McGee', 9), r("Shyrah Tuliau-Tua'a", 0),
    ],
    // Ireland: 36 named by the IRFU on 24 Aug 2026. The page prints no caps:
    // the seven uncapped women are 0, the rest still to be checked.
    // Ireland, 36 (irishrugby.ie, 24 Aug 2026). Caps: the 23 named v USA, 20 Sep (RugbyPass), before that Test.
    // 1.9.16 club audit: 2 more, each the count before 20 Sep, from the squad for South Africa (rugby365
    // and RugbyPass, 22 Oct, caps before that Test): Campbell 17 (in none of the three 23s before it),
    // Parsons 38 less her two starts v Japan. Moore (30) and Breen (34) were only on the bench in
    // between, so their counts before 20 Sep are not known. 'Fiona Tuite' is the union's Fiona Tuite
    // O'Sullivan, spelled as w_celt.ts spells her (rule 4).
    IRE: [
      r('Jemima Adams-Verling', 0), r('Sophie Barrett', 0), r('Beth Buttimer', 0), r('Eilís Cahill', 4),
      r('Ruth Campbell', 17), r('Jane Clohessy', 1), r('Linda Djougang', 57), r('Brittany Hogan', 43),
      r('Neve Jones', 46), r('Kate Jordan', 0), r('Erin King', 12), r('Sadhbh McGrath', 22),
      r('Cliodhna Moloney-MacDonald', 54), r('Sam Monaghan', null), r('Grace Moore', null), r("Niamh O'Dowd", 23),
      r('Fiona Tuite', 25), r('Ailish Quinn', null), r('Aoife Wafer', 21), r('Dorothy Wall', 42),
      r('Enya Breen', null), r('Aoife Dalton', 33), r('Vicky Elmes Kinlan', 6), r('Caitríona Finn', 0),
      r('Stacey Flood', 29), r('Niamh Gallagher', 2), r('Eve Higgins', 37), r('Emily Lane', 25), r('Lucia Linn', 0),
      r('Anna McGann', 17), r('Alana McInerney', 0), r("Robyn O'Connor", 4), r("Dannah O'Brien", 35),
      r('Béibhinn Parsons', 36), r('Aoibheann Reilly', 19), r('Katie Whelan', null),
    ],
    // Wales, 39 (RugbyPass, 1 Sep 2026). Caps: the 23 named v South Africa, 18 Sep (RugbyPass), before that Test.
    // 1.9.16 club audit: 5 more, each the count before 18 Sep. From RugbyPass's sheet v Japan (22 Oct,
    // caps before that Test; only South Africa and the USA came between): Lewis 66 and Nel Metcalfe 16
    // (in neither 23), Cox 27 less her start v the USA, Reardon 18 less the USA Test (she was on that
    // bench, and 12 on 11 Apr plus five Six Nations games caps her at 17). Jasmine Joyce 57 is the
    // WRU's figure of June 2026, after the Six Nations; she was in no autumn 23.
    WAL: [
      r('Gwenllian Pyrs', 56), r('Maisie Davies', 17), r('Katherine Baverstock', null), r('Crystal James', 0),
      r('Shanelle Williams', 0), r('Molly Reardon', 17), r('Kelsey Jones', 57), r('Elan Jones', 0),
      r('Stella Orrin', 0), r('Donna Rose', null), r('Sisilia Tuipulotu', 34), r('Gwen Crabb', 42),
      r('Natalia John', null), r('Branwen Metcalfe', 6), r('Georgia Evans', 48), r('Alex Callender', 47),
      r('Bryonie King', 17), r('Bethan Lewis', 66), r('Alisha Joyce', 57), r('Kate Williams', 26),
      r('Jorja Aiono', 5), r('Keira Bevan', 83), r('Seren Lockwood', 9), r('Megan Davey', 0),
      r('Kayleigh Powell', null), r('Lleucu George', 40), r('Courtney Keight', 33), r('Freya Bell', 2),
      r('Jenna De Vera', 2), r('Hannah Dallavalle', null), r('Hanna Tudor', 0), r('Nikita Prothero', null),
      r('Jasmine Joyce', 57), r('Amy Williams', 0), r('Kelsie Webster', 0), r('Lisa Neumann', 52),
      r('Carys Cox', 26), r('Nel Metcalfe', 16), r('Seren Singleton', 4),
    ],
    // France, 38 (RugbyPass, 30 Jul 2026). Caps only where printed before the first Test (v New Zealand, 12 Sep).
    // 1.9.16 club audit: 14 more caps filled, each the count before 12 Sep. Method: the 23 named v Canada
    // (RugbyPass FR, 24 Sep, caps before that Test) less the New Zealand and Australia Tests she played,
    // kept only where it agrees with RugbyPass FR's squad table of 30 Jul or rests on two starts.
    // Escudero and Champon are from the sheet alone (the 30 Jul table is 2 and 1 short for them, as it
    // is for Vernier). Fall Raclot 50: the 30 Jul table and the New Zealand preview both print it.
    // Still null: the 30 Jul table is the only source and it is short for 5 of the 19 it can be
    // checked on; Deshaye is 57 or 58. See docs/research/club-audit-1916.md.
    // Bazola and Brosseau are spelled as w_e1.ts spells them (rule 4); the union prints
    // "Amalia Bazola Allieres" and "Yllana Brosseau".
    FRA: [
      r('Amalia Bazola', 0), r('Rose Bernadou', null), r('Axelle Berthoumieu', 31),
      r('Yllana Justina Brosseau', 32), r('Léa Champon', 20), r('Cloé Correa', null), r('Annaëlle Deshaye', null),
      r('Charlotte Escudero', 37), r('Madoussou Fall Raclot', 50), r('Hina Ikahehegi', null),
      r('Marine Kazmierczak', 0), r('Assia Khalfaoui', 42), r('Mathilde Lazarko', 5), r('Maïlys Mailagi', 0),
      r('Ambre Mwayembe', null), r('Elsa Peyras', 0), r('Elisa Riffonneau', 25), r('Lou Roboam', 0),
      r('Siobhan Soqeta', null), r('Mouna Touré', 0), r('Kelly Arbey', 11), r('Carla Arbez', 21),
      r('Émilie Boulard', 41), r('Pauline Bourdon Sansus', 76), r('Morgane Bourgeois', null),
      r('Alexandra Chambon', 41), r('Lili Dezou', 0), r('Teani Feleu', 21), r('Elodie Fernandez', 0),
      r('Alice Grandhomme', 0), r('Anaïs Grando', null), r('Marie Ibañez', 0), r('Chloé Jacquet', 22),
      r('Léa Murie', 11), r('Lylou Pedussaud', 0), r('Lina Queyroi', 31), r('Aubane Rousset', null),
      r('Gabrielle Vernier', 60),
    ],
    // Italy, 38, every cap as printed (RugbyPass, 2 Sep 2026).
    ITA: [
      r('Francesca Andreoli', 0), r('Giulia Cavina', 5), r('Chiara Cheli', 4), r('Elettra Costantini', 2),
      r('Gaia Dosi', 2), r('Giordana Duca', 65), r('Elena Errichiello', 1), r('Silvia Fent', 0),
      r('Laura Foscato', 0), r('Alessandra Frangipani', 16), r('Elisa Giordano', 83), r('Mascia Jelic', 0),
      r('Gaia Maris', 47), r('Alessia Pilani', 12), r('Alissa Ranuccini', 23), r('Francesca Sgorbini', 42),
      r('Desiree Spinelli', 5), r('Margherita Tonellotto', 1), r('Silvia Turani', 52), r('Vittoria Vecchini', 46),
      r('Beatrice Veronese', 35), r('Vittoria Zanette', 7), r('Natascia Aggio', 0), r('Alia Bitonci', 15),
      r('Gaia Buso', 6), r('Sofia Catellani', 3), r('Giada Corradini', 2), r("Alyssa D'Incà", 40),
      r('Francesca Granzotto', 28), r('Rubina Grassi', 0), r('Veronica Madia', 65), r('Sara Mannini', 17),
      r('Aura Muzzo', 63), r('Vittoria Ostuni Minuzzi', 49), r('Michela Sillari', 98), r('Sofia Stefan', 106),
      r('Emma Stevanin', 32), r('Vittoria Zeni', 0),
    ],
    // Canada, 36 (RugbyPass, 27 Aug 2026). Caps: the 23 named v Scotland, 12 Sep (RugbyPass), before that Test.
    // 1.9.16 club audit: 6 more, each the count before 12 Sep, from the first later RugbyPass team sheet
    // she is on (caps are printed before the match) with no earlier 23 behind her: Nelson 12 and Boag 39
    // v England 19 Sep; McKnight 2 and Bowie 3 v France 26 Sep; Corrigan 26 and Seumanutafa 28 v England
    // 16 Oct. Forteza is 43 or 44 (44 before France, on the bench v England a week earlier).
    CAN: [
      r('Brooke Rempel', 2), r('Brittany Kassil', 56), r('Cassandra Tuffnail', null), r('DaLeaka Menin', 72),
      r('Emily Clark', 0), r('Emily Tuttosi', 44), r('Fabiola Forteza', null), r('Faith Tilley', 0),
      r('Gabrielle Senft', 43), r('Gillian Boag', 39), r('Julia Omokhuale', 9), r('Kiki Idowu', 3),
      r('Laetitia Royer', 25), r('Lizzie Gibson', 2), r('Maya Montiel', null), r('Mikiela Nelson', 12),
      r('Pamphinette Buisa', 21), r('Rachel Smith', 7), r('Sophie de Goede', 44), r('Sophie McDonald', 0),
      r('Taylor McKnight', 2), r('Alysha Corrigan', 26), r('Alex Tessier', 68),
      r('Asia Hogan-Rochester', 11), r('Aurora Bowie', 3), r('Claire Gallagher', 22),
      r('Corinne Frechette', null), r('Charity Williams', 0), r('Fancy Bermudez', 19), r('Flo Symonds', 18),
      r('Justine Pelletier', 46), r('Olivia Apps', 25), r('Sarah-Maude Lachance', null), r('Savannah Bauder', 0),
      r('Shoshanah Seumanutafa', 28), r('Taylor Perry', 26),
    ],
    // Japan, 30 (RugbyPass, 14 Sep 2026). Caps: the 23 named v Fiji, 4 Sep (JRFU), before that Test.
    // 1.9.16 club audit: 7 more, each the count before 4 Sep, from the first later JRFU team sheet she is
    // on (caps are printed before the match): Komaki, Imakugi, Yoshimura v Italy 19 Sep; Nagata, Yamamoto
    // v Ireland 26 Sep; Nakamura, Nakashima v Ireland 3 Oct. None was in a 23 between 4 Sep and that sheet.
    // Machida stays null: 5 before Hong Kong China (5 May) on the bench, so 5 or 6.
    JPN: [
      r('Wako Kitano', 25), r('Hinata Komaki', 21), r('Juka Fuji', 2), r('Miharu Machida', null),
      r('Nami Yoshida', 4), r('Asuka Kuge', 26), r('Moe Nagaoka', 6), r('Nijiho Nagata', 32),
      r('Masami Kawamura', 25), r('Yuna Sato', 29), r('Saya Nakamura', 3), r('Otoka Yoshimura', 34),
      r('Nami Asari', 0), r('Sakurako Korai', 24), r('Mio Nishimura', 9), r('Mele Yua Havili Kagawa', 8),
      r('Jennifer Nduka', 19), r('Anan Seo', 3), r('Moe Tsukui', 47), r('Suzuka Nakashima', 1),
      r('Kanna Hayashi', 2), r('Sawa Harada', 2), r('Minori Yamamoto', 43), r('Uta Kataoka', 0),
      r('Haruka Hirotsu', 19), r('Mana Furuta', 41), r('Komachi Imakugi', 35), r('Honoka Tsunokawa', 0),
      r('Maiko Nishi', 0), r('Sora Nishimura', 26),
    ],
  },
}
