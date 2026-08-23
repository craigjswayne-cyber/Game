# IP rename map — clubs and grounds (DRAFT, under review)

Status: proposal only. Nothing in `src/data` has been changed yet. This file is
the working list for the fictionalisation pass flagged as the store blocker in
`release-readiness.md` §1.1. Player names and competition names are separate
passes and are not covered here.

Ground rules used for the proposals:

1. **Cities, colours, capacities, reputations, budgets and ids stay.** The ids
   (`bath`, `leinster`…) are internal keys, never shown to the player.
2. **Sponsor marks always go** (Mattioli Woods, cinch, StoneX, Suncorp, Allianz,
   DHL, Emirates, Vodacom, GIO, HBF, FMG, GGL, Matmut, Kingspan, Dexcom, Aviva,
   Hive, Volac, Trailfinders, Toshiba/Kubota/Canon/Toyota/Honda/Mitsubishi…).
3. **Club identities are invented but stay plausible**: same city, a new
   moniker rooted in real local flavour (geography, history, industry, wildlife).
4. **Grounds named after a person, a sponsor, or carrying an iconic club brand
   are renamed.** A ground whose name is just a street or district
   ("Goldington Road", "Park Lane", "Stade du Hameau") is generic and can be
   kept — marked *keep* below.
5. Descriptive amateur-club names ("Esher RFC", "Bishop's Stortford") are
   low-risk; marked *keep* but flagged for a decision on consistency.

## Gallagher Premiership (prem_a.ts, prem_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Bath Rugby | Bath Romans | The Recreation Ground | The Abbey Ground |
| Bristol Bears | Bristol Buccaneers | Ashton Gate | Harbour Gate |
| Exeter Chiefs | Exeter Centurions | Sandy Park | Haldon Park |
| Gloucester Rugby | Gloucester Griffins | Kingsholm | Bishopsholm |
| Harlequins | London Jesters | Twickenham Stoop | The Paddock |
| Leicester Tigers | Leicester Sabres | Mattioli Woods Welford Road | Braunstone Gate |
| Newcastle Red Bulls | Newcastle Kestrels | Kingston Park | Ouseburn Park |
| Northampton Saints | Northampton Templars | cinch Stadium at Franklin's Gardens | Abington Gardens |
| Sale Sharks | Sale Barracudas | Salford Community Stadium | Irwell Bank Stadium |
| Saracens | London Sentinels | StoneX Stadium | Copthall Park |

## Championship (champ.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Ealing Trailfinders | Ealing Pathfinders | Trailfinders Sports Ground | Castlebar Park |
| Doncaster Knights | Doncaster Barons | Castle Park | keep |
| Coventry Rugby | Coventry Spires | Butts Park Arena | Three Spires Arena |
| Bedford Blues | Bedford Swans | Goldington Road | keep |
| Cornish Pirates | Cornish Corsairs | Mennaye Field | Trelawny Field |
| Nottingham Rugby | Nottingham Archers | The Bay | Trentside |
| Hartpury University | Hartleigh College | Gillman's Ground | College Ground |
| London Scottish | London Caledonians | The Athletic Ground | keep |
| Richmond Rugby | Richmond Stags | The Athletic Ground | keep |
| Cambridge Rugby | Cambridge Dons | Volac Park | Fenside Park |
| Chinnor RFC | Chinnor Ridge | Kingsey Road | keep |
| Caldy RFC | Caldy Hill | Paton Field | Hilltop Field |

## National League One (natl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Rosslyn Park | Roehampton Park | The Rock | The Quarry |
| Sale FC | Sale Victorians | Heywood Road | keep |
| Rams RFC | Reading Abbots | Old Bath Road | keep |
| Cinderford RFC | Cinderford Foresters | Dockham Road | keep |
| Blackheath FC | Blackheath Common | Well Hall | keep |
| Plymouth Albion | Plymouth Mariners | Brickfields | keep |
| Birmingham Moseley | Birmingham Oaks | Billesley Common | keep |
| Darlington Mowden Park | Darlington Locomotives | The Darlington Arena | keep |
| Leeds Tykes | Leeds Griffins | Grammar School at Leeds | Weetwood Fields |
| Bishop's Stortford | keep (town name) | Silver Leys | keep |
| Sedgley Park | Whitefield Park | Park Lane | keep |
| Esher RFC | keep (town name) | Molesey Road | keep |

## Top 14 (top14_a.ts, top14_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Stade Toulousain | Toulouse Occitans | Stade Ernest-Wallon | Stade des Sept Deniers |
| Union Bordeaux Bègles | Bordeaux Atlantique | Stade Chaban-Delmas | Stade de la Garonne |
| Stade Rochelais | La Rochelle Maritime | Stade Marcel-Deflandre | Stade du Vieux-Port |
| ASM Clermont Auvergne | Clermont Volcans | Stade Marcel-Michelin | Stade des Puys |
| RC Toulon | Toulon Méditerranée | Stade Mayol | Stade de la Rade |
| Racing 92 | Nanterre 92 | Paris La Défense Arena | Nanterre Arena |
| Stade Français Paris | Paris Panthères | Stade Jean-Bouin | Stade d'Auteuil |
| Castres Olympique | Castres Tarnais | Stade Pierre-Fabre | Stade de l'Agout |
| Aviron Bayonnais | Bayonne Adour | Stade Jean-Dauger | Stade des Remparts |
| Lyon OU | Lyon Confluence | Matmut Stadium de Gerland | Stade de Gerland |
| Montpellier Hérault Rugby | Montpellier Languedoc | GGL Stadium | Stade de l'Ovalie |
| Section Paloise | Pau Béarn | Stade du Hameau | keep |
| USA Perpignan | Perpignan Roussillon | Stade Aimé-Giral | Stade Catalan |
| RC Vannes | Vannes Bretagne | Stade de la Rabine | keep |

## Pro D2 (prod2.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| US Montauban | Montauban Quercy | Stade Sapiac | keep |
| FC Grenoble Rugby | Grenoble Alpins | Stade des Alpes | keep |
| CA Brive | Brive Gaillards | Stade Amédée-Domenech | Stade de la Corrèze |
| AS Béziers Hérault | Béziers Biterrois | Stade Raoul-Barrière | Stade des Écluses |
| Provence Rugby | keep (descriptive) | Stade Maurice-David | Stade Sainte-Victoire |
| Oyonnax Rugby | Oyonnax Haut-Bugey | Stade Charles-Mathon | Stade du Plateau |
| Colomiers Rugby | Colomiers Colombes | Stade Michel-Bendichou | Stade de l'Aussonnelle |
| USON Nevers | Nevers Nivernais | Stade du Pré-Fleuri | keep |
| Stade Montois | Mont-de-Marsan Landais | Stade Guy-Boniface | Stade des Pins |
| Biarritz Olympique | Biarritz Océan | Parc des Sports Aguiléra | Parc de la Côte des Basques |
| SU Agen | Agen Lot-et-Garonne | Stade Armandie | Stade des Berges |
| Valence Romans Drôme | Valence Dauphiné | Stade Georges-Pompidou | Stade du Vercors |
| US Dax | Dax Chalosse | Stade Maurice-Boyau | Stade des Thermes |
| US Carcassonne | Carcassonne Cité | Stade Albert-Domec | Stade de l'Aude |

## United Rugby Championship (urc_a.ts, urc_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Leinster Rugby | Dublin Vikings | Aviva Stadium | Lansdowne Road |
| Munster Rugby | Limerick Treaty | Thomond Park | King's Island Park |
| Ulster Rugby | Belfast Ravens | Kingspan Stadium | Ravenhill |
| Connacht Rugby | Galway Tribes | Dexcom Stadium | The Sportsground |
| Glasgow Warriors | Glasgow Clyde | Scotstoun Stadium | keep |
| Edinburgh Rugby | Edinburgh Thistles | Hive Stadium | Inverleith |
| Benetton Rugby | Treviso Marca | Stadio Monigo | keep |
| Zebre Parma | Parma Ducali | Stadio Sergio Lanfranchi | Stadio del Ducato |
| Vodacom Bulls | Pretoria Rhinos | Loftus Versfeld | Highveld Park |
| DHL Stormers | Cape Town Southeasters | DHL Stadium | Green Point Stadium |
| Hollywoodbets Sharks | Durban Makos | Kings Park | Umgeni Park |
| Emirates Lions | Johannesburg Prospectors | Emirates Airline Park | Doornfontein Park |
| Cardiff Rugby | Cardiff Capitals | Cardiff Arms Park | Westgate Field |
| Ospreys | Swansea Herons | St Helen's | Mumbles Road |
| Scarlets | Llanelli Sospans | Parc y Scarlets | Parc y Sosban |
| Dragons RFC | Newport Wyverns | Rodney Parade | keep |

## Super Rugby Pacific (srp_a.ts, srp_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Blues | Auckland Mariners | Eden Park | Kingsland Park |
| Chiefs | Waikato Rivermen | FMG Stadium Waikato | Hamilton Stadium |
| Crusaders | Canterbury Cavaliers | Apollo Projects Stadium | Addington Oval |
| Highlanders | Dunedin Southerners | Forsyth Barr Stadium | Harbourview Stadium |
| Hurricanes | Wellington Southerlies | Sky Stadium | Waterfront Stadium |
| Moana Pasifika | Pacific Navigators | North Harbour Stadium | keep |
| ACT Brumbies | Canberra Colts | GIO Stadium | Bruce Stadium |
| Queensland Reds | Queensland Crimsons | Suncorp Stadium | Lang Park |
| NSW Waratahs | Sydney Currawongs | Allianz Stadium | Moore Park Stadium |
| Western Force | Western Gales | HBF Park | Perth Oval |
| Fijian Drua | Fiji Islanders | HFC Bank Stadium | Laucala Bay Stadium |

## Japan Rugby League One (jl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Saitama Wild Knights | Saitama Lancers | Kumagaya Rugby Stadium | keep |
| Toshiba Brave Lupus Tokyo | Tokyo Wolves | Ajinomoto Stadium | Fuchu Stadium |
| Tokyo Sungoliath | Tokyo Titans | Chichibunomiya Stadium | Aoyama Rugby Ground |
| Kubota Spears Funabashi | Funabashi Tridents | Kubota Spears Stadium | Funabashi Stadium |
| Yokohama Canon Eagles | Yokohama Eagles | Nippatsu Mitsuzawa Stadium | Mitsuzawa Stadium |
| Toyota Verblitz | Aichi Lightning | Toyota Stadium | Mikawa Stadium |
| Kobelco Kobe Steelers | Kobe Ironsides | Noevir Stadium Kobe | Port Kobe Stadium |
| Shizuoka Blue Revs | Shizuoka Tides | Yamaha Stadium | Iwata Stadium |
| Black Rams Tokyo | Tokyo Blackbirds | Komazawa Stadium | keep |
| Mitsubishi Dynaboars | Sagamihara Boars | Sagamihara Gion Stadium | Sagamihara Stadium |
| Urayasu D-Rocks | Urayasu Breakers | Urayasu Stadium | keep |
| Mie Honda Heat | Mie Blaze | Suzuka Sports Garden | keep |

## Open questions

- **Irish provinces**: Leinster/Munster/Ulster/Connacht are geographic regions,
  but the rugby brands are IRFU marks. The proposals above rename them to
  city-anchored identities; the alternative is keeping the province word and
  changing only crest/short ("Leinster XV").
- **Short names**: every renamed club needs its `short` updated to match
  (e.g. 'Harlequins' → 'Jesters').
- **`seedDeals` in commercial.ts** parses the real ground names for inherited
  naming-rights sponsors ("cinch Stadium at Franklin's Gardens"); once grounds
  are fictional that regex finds nothing and every club gets a fictional
  inherited sponsor, which is the desired behaviour — but verify.
- Player names (~1,600) and competition names (Premiership, Top 14, URC,
  Champions Cup, Six Nations…) are separate passes.
