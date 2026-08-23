# IP rename map — clubs and grounds (DRAFT, under review)

Status: proposal only. Nothing in `src/data` has been changed yet. This file is
the working list for the fictionalisation pass flagged as the store blocker in
`release-readiness.md` §1.1. Player names and competition names are separate
passes and are not covered here.

Ground rules:

1. **Cities, colours, capacities, reputations, budgets and ids stay.** The ids
   (`bath`, `leinster`…) are internal keys, never shown to the player.
2. **Sponsor marks always go.**
3. **Ground names follow the owner's convention** (set on the Premiership,
   2026-08-23): a near-miss soundalike of the real name (Ashton Gate →
   Ashford Gate, Kingsholm → Kinshome), a Road/Street style swap (Welford
   Road → Welford Street), the sponsor stripped to the generic core
   (cinch Stadium at Franklin's Gardens → The Gardens), or the real district
   plus a generic word (Kingston Park → Gosforth Centre). Grounds whose real
   name is already just a street or district are kept — marked *keep*.
4. Club identities: invented monikers rooted in local flavour (still open for
   the same treatment if wanted).

Rows marked **(owner)** were chosen by the owner and are locked.

## Gallagher Premiership (prem_a.ts, prem_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Bath Rugby | Bath Romans | The Recreation Ground | Recreational Sports Centre **(owner)** |
| Bristol Bears | Bristol Buccaneers | Ashton Gate | Ashford Gate **(owner)** |
| Exeter Chiefs | Exeter Centurions | Sandy Park | Beachy Park **(owner)** |
| Gloucester Rugby | Gloucester Griffins | Kingsholm | Kinshome **(owner)** |
| Harlequins | London Jesters | Twickenham Stoop | Little Twickenham **(owner)** |
| Leicester Tigers | Leicester Sabres | Mattioli Woods Welford Road | Welford Street **(owner)** |
| Newcastle Red Bulls | Newcastle Kestrels | Kingston Park | Gosforth Centre **(owner)** |
| Northampton Saints | Northampton Templars | cinch Stadium at Franklin's Gardens | The Gardens **(owner)** |
| Sale Sharks | Sale Barracudas | Salford Community Stadium | Salford City Stadium **(owner)** |
| Saracens | London Sentinels | StoneX Stadium | Hendon Park |

Note on Salford City Stadium: that was the ground's actual former real-world
name (pre-AJ Bell), and Salford City FC exists; "Salford Stadium" would be one
step safer if it ever matters.

## Championship (champ.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Ealing Trailfinders | Ealing Pathfinders | Trailfinders Sports Ground | Ealing Sports Ground |
| Doncaster Knights | Doncaster Barons | Castle Park | keep |
| Coventry Rugby | Coventry Spires | Butts Park Arena | Butts Lane Arena |
| Bedford Blues | Bedford Swans | Goldington Road | keep |
| Cornish Pirates | Cornish Corsairs | Mennaye Field | Menhay Field |
| Nottingham Rugby | Nottingham Archers | The Bay | keep |
| Hartpury University | Hartleigh College | Gillman's Ground | Gillmore's Ground |
| London Scottish | London Caledonians | The Athletic Ground | keep |
| Richmond Rugby | Richmond Stags | The Athletic Ground | keep |
| Cambridge Rugby | Cambridge Dons | Volac Park | Camside Park |
| Chinnor RFC | Chinnor Ridge | Kingsey Road | keep |
| Caldy RFC | Caldy Hill | Paton Field | Payton Field |

## National League One (natl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Rosslyn Park | Roehampton Park | The Rock | The Crag |
| Sale FC | Sale Victorians | Heywood Road | keep |
| Rams RFC | Reading Abbots | Old Bath Road | keep |
| Cinderford RFC | Cinderford Foresters | Dockham Road | keep |
| Blackheath FC | Blackheath Common | Well Hall | keep |
| Plymouth Albion | Plymouth Mariners | Brickfields | keep |
| Birmingham Moseley | Birmingham Oaks | Billesley Common | keep |
| Darlington Mowden Park | Darlington Locomotives | The Darlington Arena | keep |
| Leeds Tykes | Leeds Griffins | Grammar School at Leeds | Leeds College Ground |
| Bishop's Stortford | keep (town name) | Silver Leys | keep |
| Sedgley Park | Whitefield Park | Park Lane | keep |
| Esher RFC | keep (town name) | Molesey Road | keep |

## Top 14 (top14_a.ts, top14_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Stade Toulousain | Toulouse Occitans | Stade Ernest-Wallon | Stade Ernest-Vallon |
| Union Bordeaux Bègles | Bordeaux Atlantique | Stade Chaban-Delmas | Stade Chaban-Delmar |
| Stade Rochelais | La Rochelle Maritime | Stade Marcel-Deflandre | Stade Marcel-Deslandes |
| ASM Clermont Auvergne | Clermont Volcans | Stade Marcel-Michelin | Stade Marcel-Michelot |
| RC Toulon | Toulon Méditerranée | Stade Mayol | Stade Meyol |
| Racing 92 | Nanterre 92 | Paris La Défense Arena | Nanterre Arena |
| Stade Français Paris | Paris Panthères | Stade Jean-Bouin | Stade Jean-Baudin |
| Castres Olympique | Castres Tarnais | Stade Pierre-Fabre | Stade Pierre-Favre |
| Aviron Bayonnais | Bayonne Adour | Stade Jean-Dauger | Stade Jean-Daubert |
| Lyon OU | Lyon Confluence | Matmut Stadium de Gerland | Stade de Gerland |
| Montpellier Hérault Rugby | Montpellier Languedoc | GGL Stadium | Stade de l'Hérault |
| Section Paloise | Pau Béarn | Stade du Hameau | keep |
| USA Perpignan | Perpignan Roussillon | Stade Aimé-Giral | Stade Aimé-Giraud |
| RC Vannes | Vannes Bretagne | Stade de la Rabine | keep |

## Pro D2 (prod2.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| US Montauban | Montauban Quercy | Stade Sapiac | keep |
| FC Grenoble Rugby | Grenoble Alpins | Stade des Alpes | keep |
| CA Brive | Brive Gaillards | Stade Amédée-Domenech | Stade Amédée-Domergue |
| AS Béziers Hérault | Béziers Biterrois | Stade Raoul-Barrière | Stade Raoul-Berrière |
| Provence Rugby | keep (descriptive) | Stade Maurice-David | Stade Maurice-Davy |
| Oyonnax Rugby | Oyonnax Haut-Bugey | Stade Charles-Mathon | Stade Charles-Mathieu |
| Colomiers Rugby | Colomiers Colombes | Stade Michel-Bendichou | Stade Michel-Bendicourt |
| USON Nevers | Nevers Nivernais | Stade du Pré-Fleuri | keep |
| Stade Montois | Mont-de-Marsan Landais | Stade Guy-Boniface | Stade Guy-Bonifay |
| Biarritz Olympique | Biarritz Océan | Parc des Sports Aguiléra | Parc des Sports Aguillon |
| SU Agen | Agen Lot-et-Garonne | Stade Armandie | Stade Armandin |
| Valence Romans Drôme | Valence Dauphiné | Stade Georges-Pompidou | Stade Georges-Pontier |
| US Dax | Dax Chalosse | Stade Maurice-Boyau | Stade Maurice-Boyer |
| US Carcassonne | Carcassonne Cité | Stade Albert-Domec | Stade Albert-Daumec |

## United Rugby Championship (urc_a.ts, urc_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Leinster Rugby | Dublin Vikings | Aviva Stadium | Lansdowne Road |
| Munster Rugby | Limerick Treaty | Thomond Park | Thormond Park |
| Ulster Rugby | Belfast Ravens | Kingspan Stadium | Ravenhill |
| Connacht Rugby | Galway Tribes | Dexcom Stadium | The Sportsground |
| Glasgow Warriors | Glasgow Clyde | Scotstoun Stadium | keep |
| Edinburgh Rugby | Edinburgh Thistles | Hive Stadium | Roseburn Park |
| Benetton Rugby | Treviso Marca | Stadio Monigo | keep |
| Zebre Parma | Parma Ducali | Stadio Sergio Lanfranchi | Stadio Sergio Lanfranco |
| Vodacom Bulls | Pretoria Rhinos | Loftus Versfeld | Loftus Field |
| DHL Stormers | Cape Town Southeasters | DHL Stadium | Green Point Stadium |
| Hollywoodbets Sharks | Durban Makos | Kings Park | keep |
| Emirates Lions | Johannesburg Prospectors | Emirates Airline Park | Elliston Park |
| Cardiff Rugby | Cardiff Capitals | Cardiff Arms Park | Cardiff Arms Field |
| Ospreys | Swansea Herons | St Helen's | St Helena's |
| Scarlets | Llanelli Sospans | Parc y Scarlets | Parc y Sosban |
| Dragons RFC | Newport Wyverns | Rodney Parade | keep |

Note: Parc y Sosban follows the proposed club rename; if the Scarlets get a
different new identity the park should follow it.

## Super Rugby Pacific (srp_a.ts, srp_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Blues | Auckland Mariners | Eden Park | Edendale Park |
| Chiefs | Waikato Rivermen | FMG Stadium Waikato | Waikato Stadium |
| Crusaders | Canterbury Cavaliers | Apollo Projects Stadium | Addington Stadium |
| Highlanders | Dunedin Southerners | Forsyth Barr Stadium | Dunedin Dome |
| Hurricanes | Wellington Southerlies | Sky Stadium | Wellington Stadium |
| Moana Pasifika | Pacific Navigators | North Harbour Stadium | keep |
| ACT Brumbies | Canberra Colts | GIO Stadium | Bruce Stadium |
| Queensland Reds | Queensland Crimsons | Suncorp Stadium | Langton Park |
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

- **Club names**: the club column is still my earlier invented-moniker draft.
  If the owner wants clubs in the same near-miss style as the grounds
  (e.g. Leicester Tigers → a soundalike rather than "Leicester Sabres"),
  that's a straightforward second pass.
- **Irish provinces**: Leinster/Munster/Ulster/Connacht are geographic regions,
  but the rugby brands are IRFU marks; alternative is keeping the province
  word and changing only crest/short.
- **Short names**: every renamed club needs its `short` updated to match.
- **`seedDeals` in commercial.ts** parses real ground names for inherited
  naming-rights sponsors ("cinch Stadium at Franklin's Gardens"); once grounds
  are fictional that regex finds nothing and every club gets a fictional
  inherited sponsor — desired, but verify.
- Player names (~1,600) and competition names are separate passes.
