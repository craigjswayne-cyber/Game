# International squads and caps, autumn 2026

Research log for `src/data/intl2026.ts` (owner, 1.9.16). One section per
union. A figure goes in the data file only when a source here gives it.

## How to research a union (what works from this environment)

- Search first. A page can only be fetched when its exact address came back as
  a search result; a remembered address is refused.
- The union's own announcement is the squad. englandrugby.com news pages
  refuse the fetch, so the squad came from a news site quoting the RFU list
  and was cross-checked against a second one.
- Caps: the union's Wikipedia page has a "Current squad" table with caps and a
  "caps updated" date. Search "<Nation> national rugby union team" so the page
  comes back as a result, then fetch it. Wikipedia's "2026 Six Nations
  Championship squads" page gives caps for six unions as of 5 Feb 2026.
- Caps wanted: the count before the autumn 2026 Tests (the day a career
  starts). For England that is the table dated 18 July 2026.

## England (men) - done, 9 caps to confirm

- Squad: 36 named 2 Nov 2026, 20 forwards and 16 backs. Sources: rugby365
  ("Borthwick names 36-man England squad for Australia Test", 2 Nov 2026) and
  Planet Rugby (same day); the two lists agree name for name. Out from the
  October camp: Noah Caluori, Max Ojomoh, Kepu Tuipulotu, Alex Mitchell
  (injured), Archie McParland. One uncapped: Greg Fisilau.
- Caps: Wikipedia, England national rugby union team, "Caps updated 18 July
  2026 (after Argentina v England)".
- Still to confirm (null in the file): Fin Baxter, Ben Curry, Maro Itoje,
  Tom Pearson, Will Stuart, Fraser Dingwall, Will Joseph, Joe Marchant,
  Harry Randall. Known floors from Wikipedia's Six Nations page (5 Feb 2026):
  Itoje 97, Dingwall 7.

### Found for the player audit (not yet changed in the squad files)

- Vilikesa Sela is in the world as FIJ; England named him (uncapped) in 2026.
- Benhard Janse van Rensburg is in the world as RSA; he has 2 England caps.
- Noah Caluori (Saracens wing, 2 England caps) is not in the world.
- Club moves the 2 Nov squad list shows for 2026-27: George Furbank at
  Harlequins, George Martin at Saracens, Joe Marchant at Sale, Luke
  Cowan-Dickie at Sale. Check each against the squad files.
- Greg Fisilau (Exeter), Emmanuel Iyogun (Northampton), Arthur Clark and
  Will Joseph (Gloucester), Kepu Tuipulotu, Archie McParland: confirm present.

## France (men) - done, 3 caps to confirm

- Squad: 42 named 21 Oct 2026 (Reuters via The Star, 21 Oct 2026). Jeremy Ward
  is a training partner only (eligible 2027) and is left out: 41 in the file.
- Caps: Wikipedia, France national rugby union team, "Caps updated: 21 October
  2026 (ahead of November tests)".
- To confirm: Marko Gazzotti, Fabien Brau-Boirie, Antoine Hastoy.
- Injured and absent: Matthieu Jalibert, Thomas Ramos. Also absent: Thibaud
  Flament, Emmanuel Meafou, Pierre-Louis Barassi, Julien Marchand, Demba Bamba
  (caps for these still to add as `squad: false`).
- For the player audit: Tevita Tatafu is in the world as TGA (3 France caps);
  not in the world: Tyler Duguid (Montpellier), Karl Sorin, Thomas Staniforth
  (Castres; check "Tom Staniforth"), Axel Desperes (Pau).

## Ireland (men) - done

- Squad and caps: IRFU announcement of 21 Oct 2026 as carried by WLR FM, 36
  players, caps printed beside each name.
- For the player audit: Jamie Benson is in the world as ENG at Harlequins; he
  moved to Ulster and was named by Ireland (uncapped).

## Scotland (men) - done

- Squad and caps: Scottish Rugby, "Scotland squad named for Nations
  Championship home games", 26 Oct 2026. 37 players, caps beside each name.

## Wales (men) - done, 10 caps to confirm

- Squad: 39 named 20 Oct 2026 (Planet Rugby, 20 Oct 2026). Uncapped: Rhys
  Barratt (Cardiff), Che Hope and Aneurin Owen (Dragons).
- Caps: Wikipedia, Wales national rugby union team, "Caps updated: 18 July
  2026" (the summer squad table).
- To confirm: Taine Basham, Liam Belcher, Seb Davies, Tomas Francis, Archie
  Griffin, Dafydd Jenkins, Rio Dyer, Gabe Hamer-Webb, Louie Hennessey, Tom
  Rogers.

## Italy (men) - done

- Squad and caps: Wikipedia, Italy national rugby union team: "On 21 October,
  Italy named a 34-player squad", "Caps updated: 21 October 2026 (ahead of
  November tests)". Cross-check the 34 names against the FIR list when a
  fetchable copy turns up. Tommaso Menoncello is injured and absent.

## New Zealand (men) - done

- Squad and caps: allblacks.com, "All Blacks name squad for Nations
  Championship Northern Tour", 26 Oct 2026. 36 players, Test caps beside each.
- Injured and absent: Ardie Savea, Leroy Carter, Billy Proctor, Tyrel Lomax,
  Luke Jacobson (caps still to add as `squad: false`).

## Australia (men) - done

- Squad and caps: rugby.com.au, "Wilson, Lambert named in first Wallabies
  squads for Spring Tour", 23 Oct 2026. 33 players. Kurtley Beale, James Ramm
  and Kalani Thomas joined later (not in the file).

## South Africa (men) - squad done, 31 caps to find

- Squad: 37 named 28 Oct 2026 (rugby365). Uncapped: Yaqeen Ahmed, Sebastian
  de Klerk, Luan Giliomee, Markus Muller, Riley Norton, Emmanuel Tshituka.
- Injured and absent: Cheslin Kolbe, Eben Etzebeth (later recalled), Andre
  Esterhuizen, Handre Pollard.
- Caps: nationschampionshiprugby.com/en/teams/rsa/squad (the owner's source),
  read 20 Nov 2026. It is the whole 2026 squad (52 names) with CURRENT caps,
  so after Italy (7 Nov) and France (13 Nov). TO CORRECT: take off the autumn
  appearances from those two team sheets. Salmaan Moerat is not on that page
  (still null). The same site has every one of the twelve unions at
  /en/teams/<arg|aus|eng|fij|fra|ire|ita|jpn|nzl|sco|rsa|wal>/squad: open the
  team page first so the squad address comes back as a link, then fetch it.
  Use it next for Fiji and Japan, the open caps in ENG/FRA/WAL, and a
  cross-check of the other unions.

## Argentina (men) - done, caps one Test late

- Squad and caps: Wikipedia, Argentina national rugby union team: "On 30
  October 2026, Argentina named a 33-player squad", "Caps updated: 6 November
  2026 (after Ireland v Argentina)". Santiago Carreras is injured and absent.
- CORRECTED 22:30: one cap taken off each of the 23 named against Ireland
  (The 42, "Contepomi names powerful Pumas side"). Assumes every replacement
  came on.

## Fiji and Japan (men) - season squads in, autumn party to narrow

- Source: nationschampionshiprugby.com/en/teams/fij/squad and /jpn/squad, read
  20 Nov 2026. These are each union's whole 2026 squad (Fiji 65, Japan 54)
  with CURRENT caps, so after the autumn Tests played so far.
- TO DO: mark only the November touring party as the squad (Fiji Rugby and
  en.rugby-japan.jp team announcements), and take off autumn appearances.

## To do, in this order

Men: Samoa, Tonga, USA, Canada; then the corrections listed above.
Women (owner, 22:12): every squad announced for WXV 1, 2 and 3 in 2026. Then the PWR club squads for 2026-27.
Women: England, France, Ireland, Scotland, Wales, Italy, New Zealand,
Australia, USA, Canada (check `testNationsIn` for the ten in a women's world).

## Women: the 2026 WXV Global Series (owner asked for "WXV 1, 2 and 3")

FACT CHECK: there is no WXV 1/2/3 in 2026. Those tiers ran in 2023 and 2024.
From 2026 it is the WXV Global Series: the top 12 unions play home and away in
a September to October window (World Rugby, Scottish Rugby). The game's
women's world already has exactly twelve Test unions: ENG FRA IRE ITA SCO WAL
NZL CAN USA AUS JPN RSA. So the job is those twelve squads, with caps.

The women's world holds real players for ENG 340, FRA 457, NZL 132, AUS 115,
WAL 76, SCO 75, IRE 71, FIJ 36, CAN 12, USA 11, ITA 5, ESP 5, JPN 4 and none
for RSA: Italy, Japan, South Africa, Canada and USA squads will mostly be
missing from the world and will report as thin.

Sources a search returned on 20 Nov 2026 (fetch these; all carry caps):
- Scotland: scottishrugby.org/news-and-features/scotland-womens-32-player-squad-announced-for-vodafone-scotland-wxv-series/ (4 Aug 2026)
- Australia: www.rugby.com.au/news/wallaroos-recall-stars-for-wxv-global-series-2026827 (32 players, caps)
- South Africa: www.rugbypass.com/news/springbok-women-unveil-wxv-squad-as-wider-plan-revealed/ (caps)
- USA: eagles.rugby/news/usa-womens-eagles-roster-named-for-wxv-global-series-with-usa-finale-202693
- England: www.planetrugby.com/news/red-roses-squad-25-world-cup-winners-included-in-extended-wxv-group-as-three-uncapped-players-named (36 players)
- All teams, opening weekend: www.world.rugby/wxv/en/news/1046220/wxv-global-series-squads-england-go-strong-on-opening-weekend-as-canada-rotate-and-france-turn-to-sevens-stars
- Wikipedia's "2026 Women's Six Nations Championship squads" gives caps for six unions as of spring 2026.
Still to find: France, Ireland, Wales, Italy, New Zealand, Canada, Japan.

## PWR club squads, 2026-27 (owner, 22:13)

Not started. The PWR clubs are in src/data/leagues/w_pwr.ts. Take each club's
own announced 2026-27 squad and compare it with the file (players in, players
out, positions, nationality).

### Women done so far (22:40)

- England: 36, all caps (RugbyPass, 7 Sep 2026: "John Mitchell names highly experienced Red Roses squad").
- Scotland: 32, all caps (Scottish Rugby, 4 Aug 2026). Australia: 32, all caps (rugby.com.au, 28 Aug 2026).
- South Africa: 30, all caps (RugbyPass, 11 Sep 2026); none of them are in the women's world except the two
  PWR players. USA: 36 named (eagles.rugby, 3 Sep 2026), no caps on the page; 8 in the world.
- Nationalities corrected: Hollie Cunningham, Eva Donaldson, Demi Swann, Katie Buchanan, Chloe Rollie (SCO);
  Micke Gunter, Danelle Lochner (RSA).
- Still to find: France, Ireland, Wales, Italy, New Zealand, Canada, Japan; USA caps.

### PWR check, first pass (22:40)

The 36 Red Roses, 14 Scotland and 2 South Africa internationals who play in the PWR were compared, club by club,
with the women's world (tool: /home/claude/tools/pwrclubs.ts, WANT env as JSON name->club). All 52 are at the
club the 2026-27 announcements give. So the PWR's international core is right for 2026-27. NOT yet checked:
each club's full announced squad (non-internationals, new signings, leavers).
- New Zealand women: 31, all caps (allblacks.com, "Black Ferns End of Year squad named", 9 Aug 2026).
- Ireland women: 36 named (irishrugby.ie, 24 Aug 2026), no caps on the page. RugbyPass's Ireland match-day
  articles print caps beside each name ("Scott Bemand names back-row debutant for Ireland's WXV opener").
- Still to find: France, Wales, Italy, Canada, Japan; caps for Ireland and USA.

### Women, second pass (23:33 UTC, 20 Nov)

- Wales 39 (RugbyPass, 1 Sep 2026). Caps for the 23 named v South Africa on 18 Sep, as printed before that Test; 11 open.
- France 38 (RugbyPass, 30 Jul 2026). Caps only for the four printed before the first Test (Bourdon Sansus 76, Vernier 60,
  Jacquet 22, Arbey 11) and the uncapped; 23 open. RugbyPass's v Canada team sheet (26 Sep) prints all 23 but two Tests in.
- Italy 38, every cap (RugbyPass, 2 Sep 2026). Canada 36 (RugbyPass, 27 Aug); caps for the 23 named v Scotland, 12 Sep; 11 open.
- Japan 30 (RugbyPass, 14 Sep); caps for the 23 named v Fiji on 4 Sep (JRFU); 8 open. Ireland: caps for the 23 named v USA, 20 Sep; 7 open.
- Wikipedia's 2026 Women's Six Nations squads page counts caps to 11 April 2026, five Tests before the autumn: not used.
- 34 nationalities corrected. The files held these squad players as English (PWR) or French (Elite 1):
  Wales: Maisie Davies, Donna Rose, Kate Williams, Jorja Aiono, Megan Davey, Kayleigh Powell, Courtney Keight, Hannah Dallavalle, Nel Metcalfe.
  Canada: Brooke Rempel, Cassandra Tuffnail, Gabrielle Senft, Julia Omokhuale, Rachel Smith, Claire Gallagher, Fancy Bermudez, Flo Symonds,
  Fabiola Forteza, Aurora Bowie, Sarah Maude Lachance. Italy: Cavina, Pilani, Ranuccini, Sgorbini, Veronese, Zanette, D'Inca, Muzzo, Stefan.
  USA: Rachel Ehrecke, Hallie Taufoou, Emily Henrich. Ireland: Niamh Gallagher.
- Six positions corrected from the shirt numbers on those team sheets: Flo Symonds CE, Nel Metcalfe FB, Hannah Dallavalle CE,
  Rachel Smith LK, Julia Omokhuale FL, Claire Gallagher FB.
- NOT changed, to check: Abigail Paton (file: New Zealand, capped; USA squad has the name), Lisa Neumann (the file's one is a
  generated Championship player; the real one, Leicester, is missing), men's Gonzalo Garcia / Virimi Vakatawa / Opeti Helu.
- Still missing from the club files (PWR and Elite 1 audit): Wales 9, Canada 17, Italy 25, Japan 28, South Africa 28, USA 25.
- All twelve WXV Global Series unions now have a squad in.

### Men, cap corrections (23:37 UTC, 20 Nov)

- South Africa: CORRECTED. One cap off for each of the Italy (7 Nov) and France (13 Nov) match-day 23s a man was in
  (rugby365 team announcements). 21 men two off, Grant Williams, Mostert and Reinach one off. Cross-check: the page had
  Etzebeth on 147 and EWN (17 Nov) says the Ireland Test takes him to 148; he played neither November Test. Assumes every
  replacement came on. Moerat still open.
- Fiji: the squad is now the 35 named for November (RugbyPass, 30 Oct 2026); the other 33 on the season list are capped
  players outside the squad. Japan: the 35 named for November (RugbyPass, 26 Oct 2026); the other 21 likewise.
- STILL TO DO for Fiji and Japan: take off the two November Tests played before 20 Nov (team sheets not yet read).
