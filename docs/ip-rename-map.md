# IP rename map — clubs and grounds (DRAFT, under review)

Status: proposal only. Nothing in `src/data` has been changed yet. This file is
the working list for the fictionalisation pass flagged as the store blocker in
`release-readiness.md` §1.1. Player names and competition names are separate
passes and are not covered here.

Ground rules:

1. **Cities, colours, capacities, reputations, budgets and ids stay.** The ids
   (`bath`, `leinster`…) are internal keys, never shown to the player.
2. **Sponsor marks always go.**
3. **Club names are location-based** (owner's rule, 2026-08-23): the plain
   place name, no nicknames — Northampton Saints is just "Northampton".
   Exceptions only where needed: clubs with no place in their real identity
   take their actual district/region (Harlequins → Twickenham, Saracens →
   Hendon, Blues → Auckland), and the odd flavour name survives where two
   clubs share a town (London Scottish → London Caledonians, since Richmond
   already takes "Richmond").
4. **Ground names follow the owner's near-miss convention** (set on the
   Premiership): a soundalike of the real name (Ashton Gate → Ashford Gate,
   Kingsholm → Kinshome), a street-type swap (Welford Road → Welford Street),
   the sponsor stripped to the generic core (The Gardens), or the real
   district/historic ground plus a generic word (Kingston Park → Gosforth
   Centre). Grounds already named for a plain street or district keep — marked
   *keep*.
5. `short` follows the new name (usually identical; abbreviated only where
   long, e.g. New South Wales → NSW).

Rows marked **(owner)** were chosen by the owner and are locked.

## Gallagher Premiership (prem_a.ts, prem_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Bath Rugby | Bath | The Recreation Ground | Recreational Sports Centre **(owner)** |
| Bristol Bears | Bristol | Ashton Gate | Ashford Gate **(owner)** |
| Exeter Chiefs | Exeter | Sandy Park | Beachy Park **(owner)** |
| Gloucester Rugby | Gloucester | Kingsholm | Kinshome **(owner)** |
| Harlequins | Twickenham | Twickenham Stoop | Little Twickenham **(owner)** |
| Leicester Tigers | Leicester | Mattioli Woods Welford Road | Welford Street **(owner)** |
| Newcastle Red Bulls | Newcastle | Kingston Park | Gosforth Centre **(owner)** |
| Northampton Saints | Northampton **(owner)** | cinch Stadium at Franklin's Gardens | The Gardens **(owner)** |
| Sale Sharks | Sale | Salford Community Stadium | Salford City Stadium **(owner)** |
| Saracens | Hendon | StoneX Stadium | Hendon Park |

Note on Salford City Stadium: that was the ground's actual former real-world
name (pre-AJ Bell), and Salford City FC exists; "Salford Stadium" would be one
step safer if it ever matters.

## Championship (champ.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Ealing Trailfinders | Ealing | Trailfinders Sports Ground | Ealing Sports Ground |
| Doncaster Knights | Doncaster | Castle Park | keep |
| Coventry Rugby | Coventry | Butts Park Arena | Butts Lane Arena |
| Bedford Blues | Bedford | Goldington Road | keep |
| Cornish Pirates | Cornwall | Mennaye Field | Menhay Field |
| Nottingham Rugby | Nottingham | The Bay | keep |
| Hartpury University | Hartpury | Gillman's Ground | Gillmore's Ground |
| London Scottish | London Caledonians | The Athletic Ground | keep |
| Richmond Rugby | Richmond | The Athletic Ground | keep |
| Cambridge Rugby | Cambridge | Volac Park | Camside Park |
| Chinnor RFC | Chinnor | Kingsey Road | keep |
| Caldy RFC | Caldy | Paton Field | Payton Field |

## National League One (natl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Rosslyn Park | Roehampton | The Rock | The Crag |
| Sale FC | Sale FC (distinguishes from Sale above) | Heywood Road | keep |
| Rams RFC | Reading | Old Bath Road | keep |
| Cinderford RFC | Cinderford | Dockham Road | keep |
| Blackheath FC | Blackheath | Well Hall | keep |
| Plymouth Albion | Plymouth | Brickfields | keep |
| Birmingham Moseley | Birmingham | Billesley Common | keep |
| Darlington Mowden Park | Darlington | The Darlington Arena | keep |
| Leeds Tykes | Leeds | Grammar School at Leeds | Leeds College Ground |
| Bishop's Stortford | keep (already a town name) | Silver Leys | keep |
| Sedgley Park | keep (already a place name) | Park Lane | keep |
| Esher RFC | Esher | Molesey Road | keep |

## Top 14 (top14_a.ts, top14_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Stade Toulousain | Toulouse | Stade Ernest-Wallon | Stade Ernest-Vallon |
| Union Bordeaux Bègles | Bordeaux | Stade Chaban-Delmas | Stade Chaban-Delmar |
| Stade Rochelais | La Rochelle | Stade Marcel-Deflandre | Stade Marcel-Deslandes |
| ASM Clermont Auvergne | Clermont | Stade Marcel-Michelin | Stade Marcel-Michelot |
| RC Toulon | Toulon | Stade Mayol | Stade Meyol |
| Racing 92 | Nanterre | Paris La Défense Arena | Nanterre Arena |
| Stade Français Paris | Paris | Stade Jean-Bouin | Stade Jean-Baudin |
| Castres Olympique | Castres | Stade Pierre-Fabre | Stade Pierre-Favre |
| Aviron Bayonnais | Bayonne | Stade Jean-Dauger | Stade Jean-Daubert |
| Lyon OU | Lyon | Matmut Stadium de Gerland | Stade de Gerland |
| Montpellier Hérault Rugby | Montpellier | GGL Stadium | Stade de l'Hérault |
| Section Paloise | Pau | Stade du Hameau | keep |
| USA Perpignan | Perpignan | Stade Aimé-Giral | Stade Aimé-Giraud |
| RC Vannes | Vannes | Stade de la Rabine | keep |

## Pro D2 (prod2.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| US Montauban | Montauban | Stade Sapiac | keep |
| FC Grenoble Rugby | Grenoble | Stade des Alpes | keep |
| CA Brive | Brive | Stade Amédée-Domenech | Stade Amédée-Domergue |
| AS Béziers Hérault | Béziers | Stade Raoul-Barrière | Stade Raoul-Berrière |
| Provence Rugby | Provence | Stade Maurice-David | Stade Maurice-Davy |
| Oyonnax Rugby | Oyonnax | Stade Charles-Mathon | Stade Charles-Mathieu |
| Colomiers Rugby | Colomiers | Stade Michel-Bendichou | Stade Michel-Bendicourt |
| USON Nevers | Nevers | Stade du Pré-Fleuri | keep |
| Stade Montois | Mont-de-Marsan | Stade Guy-Boniface | Stade Guy-Bonifay |
| Biarritz Olympique | Biarritz | Parc des Sports Aguiléra | Parc des Sports Aguillon |
| SU Agen | Agen | Stade Armandie | Stade Armandin |
| Valence Romans Drôme | Valence | Stade Georges-Pompidou | Stade Georges-Pontier |
| US Dax | Dax | Stade Maurice-Boyau | Stade Maurice-Boyer |
| US Carcassonne | Carcassonne | Stade Albert-Domec | Stade Albert-Daumec |

## United Rugby Championship (urc_a.ts, urc_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Leinster Rugby | Leinster | Aviva Stadium | Lansdowne Road |
| Munster Rugby | Munster | Thomond Park | Thormond Park |
| Ulster Rugby | Ulster | Kingspan Stadium | Ravenhill |
| Connacht Rugby | Connacht | Dexcom Stadium | The Sportsground |
| Glasgow Warriors | Glasgow | Scotstoun Stadium | keep |
| Edinburgh Rugby | Edinburgh | Hive Stadium | Roseburn Park |
| Benetton Rugby | Treviso | Stadio Monigo | keep |
| Zebre Parma | Parma | Stadio Sergio Lanfranchi | Stadio Sergio Lanfranco |
| Vodacom Bulls | Pretoria | Loftus Versfeld | Loftus Field |
| DHL Stormers | Cape Town | DHL Stadium | Green Point Stadium |
| Hollywoodbets Sharks | Durban | Kings Park | keep |
| Emirates Lions | Johannesburg | Emirates Airline Park | Elliston Park |
| Cardiff Rugby | Cardiff | Cardiff Arms Park | Cardiff Arms Field |
| Ospreys | Swansea | St Helen's | St Helena's |
| Scarlets | Llanelli | Parc y Scarlets | Stradley Park |
| Dragons RFC | Newport | Rodney Parade | keep |

Leinster/Munster/Ulster/Connacht are kept as plain province names under the
location rule — the same call as "Northampton": the place word itself, with
the "Rugby" suffix and crest identity dropped.

## Super Rugby Pacific (srp_a.ts, srp_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Blues | Auckland | Eden Park | Edendale Park |
| Chiefs | Waikato | FMG Stadium Waikato | Waikato Stadium |
| Crusaders | Canterbury | Apollo Projects Stadium | Addington Stadium |
| Highlanders | Otago | Forsyth Barr Stadium | Dunedin Dome |
| Hurricanes | Wellington | Sky Stadium | Wellington Stadium |
| Moana Pasifika | Pacific | North Harbour Stadium | keep |
| ACT Brumbies | Canberra | GIO Stadium | Bruce Stadium |
| Queensland Reds | Queensland | Suncorp Stadium | Langton Park |
| NSW Waratahs | New South Wales (short: NSW) | Allianz Stadium | Moore Park Stadium |
| Western Force | Perth | HBF Park | Perth Oval |
| Fijian Drua | Fiji | HFC Bank Stadium | Laucala Bay Stadium |

## Japan Rugby League One (jl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Saitama Wild Knights | Saitama | Kumagaya Rugby Stadium | keep |
| Toshiba Brave Lupus Tokyo | Fuchu | Ajinomoto Stadium | Fuchu Stadium |
| Tokyo Sungoliath | Tokyo | Chichibunomiya Stadium | Aoyama Rugby Ground |
| Kubota Spears Funabashi | Funabashi | Kubota Spears Stadium | Funabashi Stadium |
| Yokohama Canon Eagles | Yokohama | Nippatsu Mitsuzawa Stadium | Mitsuzawa Stadium |
| Toyota Verblitz | Mikawa | Toyota Stadium | Mikawa Stadium |
| Kobelco Kobe Steelers | Kobe | Noevir Stadium Kobe | Port Kobe Stadium |
| Shizuoka Blue Revs | Shizuoka | Yamaha Stadium | Iwata Stadium |
| Black Rams Tokyo | Setagaya | Komazawa Stadium | keep |
| Mitsubishi Dynaboars | Sagamihara | Sagamihara Gion Stadium | Sagamihara Stadium |
| Urayasu D-Rocks | Urayasu | Urayasu Stadium | keep |
| Mie Honda Heat | Suzuka | Suzuka Sports Garden | keep |

Japan notes: Brave Lupus and Sungoliath are both Tokyo clubs, so one takes
Fuchu (its actual home) and the other keeps Tokyo; Black Rams take their
Setagaya district; Verblitz can't be "Toyota" without reading as the company,
so it takes the Mikawa region.

## Open questions

- **The odd few / flavour check**: Twickenham, Hendon, London Caledonians,
  Cornwall, Pacific, Fiji, New South Wales — the rows where plain-city wasn't
  possible. Say the word if any should change.
- **Short names**: set to the new name; abbreviate only New South Wales → NSW
  and any that overflow the UI (current data caps around 11 chars, e.g.
  "Mont-de-M.").
- **`seedDeals` in commercial.ts** parses real ground names for inherited
  naming-rights sponsors ("cinch Stadium at Franklin's Gardens"); once grounds
  are fictional that regex finds nothing and every club gets a fictional
  inherited sponsor — desired, but verify.
- Player names (~1,600) and competition names are separate passes.
