
## Women: Italy, Japan, South Africa, France (club audit, 21 Nov 2026)

Scope: the `w` block of src/data/intl2026.ts for ITA, JPN, RSA, FRA. Found in the world, before -> after:
France 35 -> 38 of 38, Italy 14 -> 20 of 38, South Africa 2 -> 3 of 30, Japan 2 -> 2 of 30.
Italy, Japan and South Africa stay THIN: their domestic competitions are not in W_LEAGUE_DEFS
(src/game/newgame.ts has six women's leagues: w:pwr, w:pac, w:e1, w:celt, w:champ, w:e2).

### Sources
- Italy 38 with clubs and caps: rugbypass.com/news/seven-potential-debutants-named-as-italy-look-to-expand-the-pool-of-players-at-wxv/ (2 Sep 2026).
  Second list, 32 with clubs: oasport.it/2026/09/rugby-femminile-le-convocate-dellitalia-per-la-sfida-al-giappone-32-azzurre-scelte-da-sciamanna/ (9 Sep).
  Italy 23 v Japan in shirt order: rugbypass.com/news/italy-opt-for-experience-ahead-of-sakura-fifteen-wxv-opener/ (18 Sep).
  Six Nations training squad with positions: admin.ultimaterugby.com/news/italy-women's-training-squad-for-six-nations-2026/664874 (20 Mar 2026).
- South Africa 30 with clubs and caps: rugbypass.com/news/springbok-women-unveil-wxv-squad-as-wider-plan-revealed/ and
  rugby365.com/countries/south-africa/springbok-women-hand-rising-star-chance-on-european-tour/ (both 11 Sep 2026).
  Cilliers: rugby365.com/countries/south-africas-female-pollard-seals-toulon-move (21 Jul 2026); en.wikipedia.org/wiki/Jakkie_Cilliers.
- France 38 with clubs: rugbypass.com/news/vernier-back-for-ratiers-france-but-feleu-will-miss-wxv-global-series/ (30 Jul 2026).
  Same 38 with age and caps: rugbypass.com/news/quatre-questions-autour-du-groupe-des-bleues-pour-le-women-xv-global-series/.
  23 v Canada with club and caps: rugbypass.com/news/composition-xv-france-canada-rugby/ (24 Sep). 23 v New Zealand:
  rugbypass.com/news/la-compo-des-bleues-contre-les-blacks-ferns-avec-trois-septistes/ and the sports.orange.fr piece of 10 Sep.
  23 v Australia: rugbypass.com/news/trois-nouveaux-visages-dans-les-23-bleues-choisies-pour-laustralie/ (17 Sep).
  dicodusport.fr prints caps for every 23 but refuses automated readers (robots), so it was not read.
- Japan team sheets (JRFU, club and caps before each match): en.rugby-japan.jp/?p=33233 (v Fiji, 4 Sep),
  /2026/09/19/sakura-fifteen-set-for-italian-job-in-pordenone/, /2026/09/26/sakura-fifteen-to-face-ireland-in-galway/,
  /2026/10/02/sakura-fifteen-set-for-ireland-rematch-in-cork/, /2026/10/23/sakura-fifteen-named-to-face-wales-in-historic-jrfu-centenary-clash/,
  and the spring sheets ?p=32708 (squad, 28 Apr), ?p=32719 (v Kazakhstan), ?p=32736 (v Hong Kong China, 5 May).

### Added (additions.ts, table W_AUDIT_ITA_JPN_RSA_FRA) - 8
| Player | Union | Club (game id) | Pos, age | q | Club source |
|---|---|---|---|---|---|
| Veronica Madia | ITA | Blagnac (w:blagnac) | FH, 31 | 77 | RugbyPass 2 Sep; Wikipedia (Blagnac 2025-); Ultimate Rugby 20 Mar |
| Emma Stevanin | ITA | Grenoble (w:grenoble) | FH, 24 | 74 | RugbyPass 2 Sep; OA Sport 9 Sep |
| Giada Corradini | ITA | Montpellier (w:montpellier) | CE, 24 | 66 | RugbyPass 2 Sep; OA Sport 9 Sep; Wikipedia |
| Francesca Andreoli | ITA | LOU (w:lyon) | LK, 22 | 62 | RugbyPass 2 Sep ONLY (Colorno on the 20 Mar list) |
| Rubina Grassi | ITA | Toulon (w:toulon) | WG/FB, 22* | 60 | RugbyPass 2 Sep; OA Sport 9 Sep; Ultimate Rugby 20 Mar |
| Sofia Catellani | ITA | Lons Section Paloise (w:lons, Division 2) | WG/FB, 22 | 62 | RugbyPass 2 Sep; OA Sport 9 Sep |
| Jakkie Cilliers | RSA | Toulon (w:toulon) | CE/WG/FH, 25 | 74 | rugby365 21 Jul (contract 1 Nov 2026 to 30 Jun 2027); both 11 Sep lists |
| Marine Kazmierczak | FRA | Stade Rochelais (w:larochelle) | LK, 19 | 64 | RugbyPass 30 Jul (both versions) |

Not sourced, assigned: every q; *Grassi's age (no page gives it); Catellani's primary shirt ("outside back" is all
RugbyPass says); Cilliers' primary shirt (sources say utility back, wing or centre, compared to a fly-half for her kicking).
Squad room was checked: the seven clubs stood at 30 to 39 seniors before these rows, limit 46.
Cilliers' Toulon contract starts on 1 Nov 2026; she is placed there from the start of the career.

### Spellings (changed in intl2026.ts, not in the league file)
- 'Amalia Bazola Allieres' -> 'Amalia Bazola', 'Yllana Brosseau' -> 'Yllana Justina Brosseau'. The league rows are keyed
  by those names in scripts/tools/womens-verified.json, and intl2026.ts rule 4 says names follow the squad files.
  The union prints "Amalia Bazola Allieres" and "Yllana Brosseau".

### Rows corrected in w_e1.ts
- Sara Tounesi (Toulon row): nat FRA -> ITA. Italy's RWC 2025 squad, 50 caps (rugbyworldcup.com/en/news/1002235/italy-name-squad-for-womens-rwc-2025).
  That page has her at Stade Bordelais in Aug 2025; her 2026-27 club was not checked.
- Teani Feleu: LK -> CE. Named among the backs (30 Jul) and at centre v New Zealand, Australia and Canada.
- Aura Muzzo: FH -> WG. Shirt 14 v Japan (18 Sep sheet, read in 15-to-1 order).
- Vittoria Zanette: HK -> TP. Shirt 3 v Japan (same sheet, same inference).

### Caps filled
France, 14 (count before New Zealand, 12 Sep): Berthoumieu 31, Brosseau 32, Champon 20, Escudero 37, Fall Raclot 50,
Khalfaoui 42, Lazarko 5, Riffonneau 25, Arbez 21, Boulard 41, Chambon 41, T. Feleu 21, Murie 11, Queyroi 31.
Method: the Canada sheet (caps before 26 Sep) less the New Zealand and Australia Tests, accepted where it equals the
30 Jul table or rests on two starts. Check: Bourdon Sansus 76 / 77 / 78 across the three sheets.
The 30 Jul table is NOT reliable alone: against the sheets it is short for Vernier (58 v 60), Escudero (35 v 37),
Champon (19 v 20), Arbey (10 v 11) and Deshaye (56 v 57 or 58).
France, still null (9), with the 30 Jul table's figure for whoever finds a second source: Bernadou 31, Correa 3,
Ikahehegi 8, Mwayembe 24, Soqeta 5, Bourgeois 18, Grando 5, Rousset 3; Deshaye 57 or 58 (59 before Canada, on the
bench v New Zealand and Australia).
Japan, 7 (count before Fiji, 4 Sep): Komaki 21, Imakugi 35, Yoshimura 34 (Italy sheet, 19 Sep), Nagata 32,
Yamamoto 43 (Ireland, 26 Sep), Nakamura 3, Nakashima 1 (Ireland, 3 Oct). None was in a 23 between 4 Sep and the
sheet used. Cross-check: Imakugi 34, Yoshimura 33 and Yamamoto 42 before Hong Kong China on 5 May, one more each after.
Japan, still null (1): Machida, 5 before Hong Kong China and on the bench that day, so 5 or 6; on no later sheet.
Italy and South Africa had no open caps.

### Club not in game (not placed)
Italy, 18. Valsugana Rugby Padova: Costantini, Duca, Giordano, Maris, Tonellotto, Aggio, Bitonci, Sillari, Zeni.
Arredissima Villorba: Cheli, Frangipani, Buso. Benetton Treviso: Fent, Jelic, Spinelli. Rugby Parma: Dosi.
Unione Rugby Capitolina: Errichiello. CUS Milano: Foscato.
South Africa, 27. Bulls Daisies: Hlatshwayo, Tose, Charlie, Ngxingolo, Ubisi, Noxeke. Western Province: Arries, Latsha,
Groenewald, Mokwai, Welman. Boland Dames: Samboya, Lamprecht, Hele. Border Ladies: Ngwevu, Mdliki. Golden Lions Women:
Khuzwayo, Jacobs. Sharks Women: Gwala. EP Queens: Minnaar. "SA Rugby contracted", no club printed: Dolf, Mokone,
Tshiremba, Malinga, Janse van Rensburg, Solontsi, Makua.
Japan, 28 (club from the JRFU sheets). Yokohama TKM: Fuji, Yoshida, Nagaoka, M. Nishimura, Havili Kagawa, Yamamoto,
Tsunokawa. Yokogawa Musashino Artemi-Stars: Kawamura, Asari, Tsukui, Hayashi, Kataoka, Nishi. Tokyo Sankyu Phoenix:
Komaki, Sato, Korai, Seo, Nakashima, Furuta. Arukas Queen Kumagaya: Kuge, Yoshimura, Imakugi. Mie Pearls: Nakamura,
S. Nishimura. Hokkaido Barbarians Diana: Nduka. Nanairo Prism Fukuoka: Hirotsu. Japan University of Economics:
Harada, Machida (28 Apr list; no later sheet).

### For verified.ts (not edited here): found in the world, at a club the 2026 sources do not give
- Wako Kitano: file Leicester (w:leicester); JRFU has her at Mie Pearls on every sheet from 3 Sep 2026 (club not in game).
- Nijiho Nagata: file Auckland (w:blues), LP, age 19; JRFU has Mie Pearls, born 6 Dec 2000, shirt 16 on three sheets.
- Beatrice Veronese: file Toulon; both September lists say Valsugana (club not in game).
- Alissa Ranuccini and Aura Muzzo: file Lyon; both lists say ASM Clermont (w:romagnat).
- Vittoria Zanette: file Lyon; both lists say Blagnac.
- Yllana Brosseau: file Romagnat; Stade Bordelais on 30 Jul and on the 24 Sep sheet.
- Assia Khalfaoui: file Montpellier; Stade Bordelais (30 Jul, 24 Sep).
- Alexandra Chambon: file Montpellier; ASM Romagnat (30 Jul, 24 Sep).
- Émilie Boulard: file Blagnac; AC Bobigny 93 (30 Jul, 24 Sep).
- Chloé Jacquet: two rows, 'Chloé Jacquet' SH at Montpellier and 'Chloe Jacquet' FB at Lyon. The 30 Jul list says LOU.
- Elodie Fernandez: file Romagnat, as on 30 Jul; the 24 Sep sheet prints Stade Toulousain. Conflict, left alone.
- 'Annaëlle Deshayes' (LK, 25, La Rochelle) sits one letter from France prop Annaëlle Deshaye (Bordeaux). Not checked.
Ages in w_e1.ts differ from the 30 Jul table for most of the France squad (Bazola 31 v 21, Brosseau 33 v 25,
Pedussaud 33 v 18, Riffonneau 33 v 22, Arbez 35 v 26, Boulard 19 v 26, T. Feleu 31 v 23). Not changed: out of scope.

### Unresolved
- Andreoli's club rests on one list. Grassi's age. Machida's and nine France caps (above).
- Whether any "SA Rugby contracted" player also holds a club contract abroad: no source says so.
- Called up after the squad was named, not in intl2026.ts and not added: Sana Lagrandeur (Grenoble, in w_e1.ts),
  Marion Latonnelle (Toulon), Julia Grosz (Blagnac), Khoudedia Cissokho, Isis Espuga, Valentine Lothoz (France);
  Beatrice Rigoni (Sale, in w_pwr.ts) is on Italy's 9 Sep list of 32 with 87 caps but not in the 38.

## Women: Wales, Canada, USA, Ireland (1.9.16 club audit, 21 Nov 2026)

Found in the world, of the named squad: Wales 30 -> 36 of 39, Ireland 33 -> 35 of 36, Canada 22 -> 25 of 36,
USA 12 -> 14 of 36. Ratings on every new row are a judgement against the internationals already at the club.

### Added (src/data/additions.ts, block "1.9.16 club audit, women: Wales, Canada, USA, Ireland")

| Player | Union | Club (game id) | Pos, age | Source for the club |
|---|---|---|---|---|
| Alisha Joyce | WAL | Brython Thunder (w:brython) | FL/LK, 29 | WRU extended squad (Aug 2026); RugbyPass 1 Sep and 16 Sep; WRU, June 2026 (left Bristol to play in Wales) |
| Jasmine Joyce | WAL | Brython Thunder (w:brython) | WG, 30 | same |
| Natalia John | WAL | Brython Thunder (w:brython) | LK, 30 | WRU extended squad (Aug 2026); RugbyPass 1 Sep |
| Jenna De Vera | WAL | Brython Thunder (w:brython) | CE, 22 | WRU (Aug); RugbyPass 1 Sep, 16 Sep, 24 Sep, 5 Oct, 29 Oct |
| Freya Bell | WAL | Gwalia Lightning (w:gwalia) | CE, 21 | WRU (Aug); Dragons RFC (Aug); RugbyPass 1 Sep to 22 Oct |
| Lisa Neumann | WAL | Leicester Tigers (w:leicester) | WG/FB, 32 | RugbyPass, 1 Sep 2026 (signed from Harlequins); thepwr.com Leicester list |
| Erin King | IRE | Wolfhounds (w:wolfhounds) | FL, 22 | IRFU squad, 24 Aug 2026 (Leinster/Wolfhounds) |
| Taylor McKnight | CAN | Stade Bordelais (w:bordeaux) | HK, 23 | RugbyPass squad list, 27 Aug 2026 |
| Emily Clark | CAN | Montpellier (w:montpellier) | LK, 24 | RugbyPass squad list, 27 Aug 2026 |
| Corinne Frechette | CAN | ASM Romagnat (w:romagnat) | SH, 24* | RugbyPass squad list, 27 Aug 2026 |

Dates of birth: Wikipedia, "2026 Women's Six Nations Championship squads" (Joyce x2, John, De Vera, Neumann, King) and
"Taylor McKnight". Bell 21 and Neumann 32: RugbyPass (23 Sep, 1 Sep). Clark 24: RugbyPass player page. *Frechette's age is
NOT sourced (24 is a placeholder); her position is from Université Laval's all-star note of Nov 2024 (demi de mêlée).
Squad room after the additions: Brython 37, Gwalia 30, Wolfhounds 31, Leicester 42 active, Bordeaux 41, Montpellier 32,
Romagnat 40. Lisa Neumann: w_champ.ts has a generated English wing of the same name aged 25; the builder treats the two as
different players (same shirt, seven years apart) and the data audit passes.

### Spellings and rows corrected

- USA `Keia Mae Sagapolu Sanele` -> `Mae Sagapolu` in intl2026.ts. She is the Loughborough prop already in w_pwr.ts;
  RugbyPass's 17 Sep team sheet prints "Mae Sagapolu". Changed the intl row (the file's rule 4: names as the squad files
  spell them).
- Ireland `Fiona Tuite O'Sullivan` -> `Fiona Tuite` in intl2026.ts, same reason: she is the Wolfhounds lock in w_celt.ts.
  The IRFU has printed "Tuite O'Sullivan" since August 2026 (it was "Fiona Tuite" in the Six Nations), so the squad file
  and scripts/tools/womens-verified.json could be renamed later; not done here.
- Abigail Paton (w_pac.ts, Matatū): NZL wing -> USA scrum-half. Born in Fort Collins, Colorado, a halfback, capped by the
  USA in the 2026 Pacific Four (Otago Daily Times, April 2026; eagles.rugby player pool, 30 Mar 2026: club Matatū). Wore 9
  for the USA v Ireland, Wales and England.

### Caps filled (count before the union's first autumn Test, as the rest of the women's table)

- Wales (before 18 Sep): Bethan Lewis 66, Nel Metcalfe 16, Carys Cox 26, Molly Reardon 17, Jasmine Joyce 57.
  RugbyPass's sheet v Japan (22 Oct) prints Lewis 66, Metcalfe 16, Cox 27, Reardon 18 before that Test; only South Africa
  and the USA came between. Lewis and Metcalfe were in neither 23. Cox started v the USA. Reardon was on the bench v the
  USA, and Wikipedia has her on 12 at 11 April with five Six Nations games to play, so 17 is the only figure that fits.
  Joyce: the WRU's June 2026 article gives 57 (53 on 11 April); she was in no autumn 23.
- Ireland (before 20 Sep): Ruth Campbell 17, Béibhinn Parsons 36. From the squad for South Africa (rugby365 and RugbyPass,
  22 Oct): Campbell 17, in none of the three 23s before it; Parsons 38 after starting both Japan Tests.
- Canada (before 12 Sep): Mikiela Nelson 12, Gillian Boag 39 (RugbyPass sheet v England, 17 Sep), Taylor McKnight 2,
  Aurora Bowie 3 (v France, 24 Sep), Alysha Corrigan 26, Shoshanah Seumanutafa 28 (v England, 14 Oct). None was in an
  earlier 23 of the window.
- USA (before 20 Sep): Nina Mason 0 ("uncapped", RugbyPass 17 Sep), Lauryn Carlton 0 (debut v Italy, RugbyPass 22 Oct).

### Caps still open

- Wales: Katherine Baverstock (1 at 11 April), Donna Rose (37 at 11 April), Natalia John (48 at 11 April), Kayleigh
  Powell (28 at 11 April), Hannah Dallavalle (69 at 11 April), Nikita Prothero (0 at 11 April; bench v the USA). The 11
  April figures are five Tests old and were not used.
- Ireland: Grace Moore (30 before South Africa, bench v Japan twice: 28 to 30), Enya Breen (34 before South Africa, bench
  v Japan once: 33 or 34), Sam Monaghan, Ailish Quinn, Katie Whelan.
- Canada: Fabiola Forteza (43 or 44), Cassandra Tuffnail, Maya Montiel, Corinne Frechette, Sarah-Maude Lachance (in no
  23 of the window).
- USA: the other 34. No USA team sheet or roster found prints caps (eagles.rugby, RugbyPass, The Rugby Breakdown, Goff
  Rugby Report, world.rugby all checked). Wikipedia's USA squad table is from 2024.
- Seen, not changed: RugbyPass prints Sisilia Tuipulotu on 34 before South Africa and 38 before the first Japan Test,
  with two Tests between. One of the two is wrong; the table keeps 34.

### Club not in game (not placed)

Canada (clubs as RugbyPass printed them, 27 Aug to 22 Oct 2026): Brittany Kassil (Guelph Goats), Emily Tuttosi (Calgary
Hornets; left Exeter), Faith Tilley (University of Victoria), Gillian Boag (Capilano), Lizzie Gibson (Queen's University /
Oakville Crusaders), Mikiela Nelson (Capilano), Sophie McDonald (University of Ottawa / Ottawa Rugby Club), Asia
Hogan-Rochester (Toronto Nomads / Westshore), Charity Williams (Markham Irish), Savannah Bauder (UBC Thunderbirds /
Capilano), Taylor Perry (Oakville Crusaders).

USA, Women's Elite Rugby (rosters of 27 Apr 2026, The Rugby Breakdown): Lauryn Carlton and Malia Isaacs (Boston
Banshees), Sam Brackett (Twin Cities Gemini), Mona Lisa Topu (Bay Breakers; listed as Monalisa Tupou), Ina Bailey
(Denver Onyx; listed as Kapoina Bailey), Kennedy Feasby and Sadie Schier (Denver Onyx), Taina Tukuafu (Bay Breakers).
USA, college or the sevens programme (eagles.rugby pool, 30 Mar 2026, and the 3 Sep roster notes): Reece Woods (Sacred
Heart University), Freda Tafuna (Lindenwood University), Bella Vogel (Life University), Telesi Uhatafe (Southern Nazarene
University), Cassidy Bargell (Denver Onyx / USA 7s), Hann Humphreys, Erica Coulibaly, Kayla Canett, Tessa Hann, Karina
Gauto, Tahna Wilfley, Ashley Cowdrey (USA 7s).

### Unresolved

- Katherine Baverstock (Wales prop, born 17 Sep 2002): the WRU's August list and Dragons RFC say Gwalia Lightning;
  RugbyPass's 1 Sep list says Leicester Tigers, where she played to June 2026; she is not on Leicester's thepwr.com list.
  Not added to either.
- Crystal James (Wales prop, uncapped): WRU and Dragons RFC (August) say Gwalia Lightning; RugbyPass (1 Sep and 5 Oct)
  says Trailfinders Women; she is not on the Trailfinders thepwr.com list. Not added to either.
- Hanna Tudor (Wales back, uncapped): "Unattached" on the WRU and RugbyPass lists. No club found.
- Grace Moore (Ireland back row, born 21 May 1996): left Trailfinders for Munster in 2026 (Wikipedia; IRFU lists her as
  "Munster" alone). Munster's Celtic Challenge side is the Clovers, but no source puts her there yet. Not added.
- Chloe Hill-Huse and Kate Zackary (USA): no 2026-27 club found. Neither is on a WER roster or a PWR list read.
- USA clubs above are from March and April 2026; no autumn source was found for them.
- Not in the 1 Sep squad of 39 but capped for Wales this autumn: Sian Jones (Gloucester-Hartpury, bench v the USA).
