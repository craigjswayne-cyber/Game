# IP rename map — clubs and grounds (DRAFT, under review)

Status: proposal only. Nothing in `src/data` has been changed yet. This file is
the working list for the fictionalisation pass flagged as the store blocker in
`release-readiness.md` §1.1. Player names and competition names are separate
passes and are not covered here.

Ground rules:

1. **Cities, colours, capacities, reputations, budgets and ids stay.** The ids
   (`bath`, `leinster`…) are internal keys, never shown to the player.
2. **Sponsor marks always go.**
3. **Club names are location-based with an RFC suffix** (owner's rules,
   2026-08-23): the plain place name plus "RFC", no nicknames — Northampton
   Saints is "Northampton RFC". Exceptions only where needed: clubs with no
   place in their real identity take their actual district/region (Harlequins
   → Twickenham RFC, Saracens → Hendon RFC, Blues → Auckland RFC), and the odd
   flavour name survives where two clubs share a town (London Scottish →
   London Caledonians RFC, since Richmond takes "Richmond RFC"). Sale FC keeps
   "FC" to stay distinct from the Premiership's Sale RFC.
4. **Ground names follow the owner's near-miss convention** (set on the
   Premiership): a soundalike of the real name (Ashton Gate → Ashford Gate,
   Kingsholm → Kinshome), a street-type swap (Welford Road → Welford Street),
   the sponsor stripped to the generic core (The Gardens), or the real
   district/historic ground plus a generic word (Kingston Park → Gosforth
   Centre). Grounds already named for a plain street or district keep — marked
   *keep*.
5. **`short` is the bare place name without RFC** (Northampton RFC →
   "Northampton"); abbreviate only where long (New South Wales → NSW).

Rows marked **(owner)** were chosen by the owner and are locked.

## Gallagher Premiership (prem_a.ts, prem_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Bath Rugby | Bath RFC | The Recreation Ground | Recreational Sports Centre **(owner)** |
| Bristol Bears | Bristol RFC | Ashton Gate | Ashford Gate **(owner)** |
| Exeter Chiefs | Exeter RFC | Sandy Park | Beachy Park **(owner)** |
| Gloucester Rugby | Gloucester RFC | Kingsholm | Kinshome **(owner)** |
| Harlequins | Twickenham RFC | Twickenham Stoop | Little Twickenham **(owner)** |
| Leicester Tigers | Leicester RFC | Mattioli Woods Welford Road | Welford Street **(owner)** |
| Newcastle Red Bulls | Newcastle RFC | Kingston Park | Gosforth Centre **(owner)** |
| Northampton Saints | Northampton RFC **(owner)** | cinch Stadium at Franklin's Gardens | The Gardens **(owner)** |
| Sale Sharks | Sale RFC | Salford Community Stadium | Salford City Stadium **(owner)** |
| Saracens | Hendon RFC | StoneX Stadium | Hendon Park |

Note on Salford City Stadium: that was the ground's actual former real-world
name (pre-AJ Bell), and Salford City FC exists; "Salford Stadium" would be one
step safer if it ever matters.

## Championship (champ.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Ealing Trailfinders | Ealing RFC | Trailfinders Sports Ground | Ealing Sports Ground |
| Doncaster Knights | Doncaster RFC | Castle Park | keep |
| Coventry Rugby | Coventry RFC | Butts Park Arena | Butts Lane Arena |
| Bedford Blues | Bedford RFC | Goldington Road | keep |
| Cornish Pirates | Cornwall RFC | Mennaye Field | Menhay Field |
| Nottingham Rugby | Nottingham RFC | The Bay | keep |
| Hartpury University | Hartpury RFC | Gillman's Ground | Gillmore's Ground |
| London Scottish | London Caledonians RFC | The Athletic Ground | keep |
| Richmond Rugby | Richmond RFC | The Athletic Ground | keep |
| Cambridge Rugby | Cambridge RFC | Volac Park | Camside Park |
| Chinnor RFC | Chinnor RFC (unchanged) | Kingsey Road | keep |
| Caldy RFC | Caldy RFC (unchanged) | Paton Field | Payton Field |

## National League One (natl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Rosslyn Park | Roehampton RFC | The Rock | The Crag |
| Sale FC | Sale FC (unchanged; distinguishes from Sale RFC) | Heywood Road | keep |
| Rams RFC | Reading RFC | Old Bath Road | keep |
| Cinderford RFC | Cinderford RFC (unchanged) | Dockham Road | keep |
| Blackheath FC | Blackheath RFC | Well Hall | keep |
| Plymouth Albion | Plymouth RFC | Brickfields | keep |
| Birmingham Moseley | Birmingham RFC | Billesley Common | keep |
| Darlington Mowden Park | Darlington RFC | The Darlington Arena | keep |
| Leeds Tykes | Leeds RFC | Grammar School at Leeds | Leeds College Ground |
| Bishop's Stortford | Bishop's Stortford RFC | Silver Leys | keep |
| Sedgley Park | Sedgley Park RFC | Park Lane | keep |
| Esher RFC | Esher RFC (unchanged) | Molesey Road | keep |

## Top 14 (top14_a.ts, top14_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Stade Toulousain | Toulouse RFC | Stade Ernest-Wallon | Stade Ernest-Vallon |
| Union Bordeaux Bègles | Bordeaux RFC | Stade Chaban-Delmas | Stade Chaban-Delmar |
| Stade Rochelais | La Rochelle RFC | Stade Marcel-Deflandre | Stade Marcel-Deslandes |
| ASM Clermont Auvergne | Clermont RFC | Stade Marcel-Michelin | Stade Marcel-Michelot |
| RC Toulon | Toulon RFC | Stade Mayol | Stade Meyol |
| Racing 92 | Nanterre RFC | Paris La Défense Arena | Nanterre Arena |
| Stade Français Paris | Paris RFC | Stade Jean-Bouin | Stade Jean-Baudin |
| Castres Olympique | Castres RFC | Stade Pierre-Fabre | Stade Pierre-Favre |
| Aviron Bayonnais | Bayonne RFC | Stade Jean-Dauger | Stade Jean-Daubert |
| Lyon OU | Lyon RFC | Matmut Stadium de Gerland | Stade de Gerland |
| Montpellier Hérault Rugby | Montpellier RFC | GGL Stadium | Stade de l'Hérault |
| Section Paloise | Pau RFC | Stade du Hameau | keep |
| USA Perpignan | Perpignan RFC | Stade Aimé-Giral | Stade Aimé-Giraud |
| RC Vannes | Vannes RFC | Stade de la Rabine | keep |

## Pro D2 (prod2.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| US Montauban | Montauban RFC | Stade Sapiac | keep |
| FC Grenoble Rugby | Grenoble RFC | Stade des Alpes | keep |
| CA Brive | Brive RFC | Stade Amédée-Domenech | Stade Amédée-Domergue |
| AS Béziers Hérault | Béziers RFC | Stade Raoul-Barrière | Stade Raoul-Berrière |
| Provence Rugby | Provence RFC | Stade Maurice-David | Stade Maurice-Davy |
| Oyonnax Rugby | Oyonnax RFC | Stade Charles-Mathon | Stade Charles-Mathieu |
| Colomiers Rugby | Colomiers RFC | Stade Michel-Bendichou | Stade Michel-Bendicourt |
| USON Nevers | Nevers RFC | Stade du Pré-Fleuri | keep |
| Stade Montois | Mont-de-Marsan RFC | Stade Guy-Boniface | Stade Guy-Bonifay |
| Biarritz Olympique | Biarritz RFC | Parc des Sports Aguiléra | Parc des Sports Aguillon |
| SU Agen | Agen RFC | Stade Armandie | Stade Armandin |
| Valence Romans Drôme | Valence RFC | Stade Georges-Pompidou | Stade Georges-Pontier |
| US Dax | Dax RFC | Stade Maurice-Boyau | Stade Maurice-Boyer |
| US Carcassonne | Carcassonne RFC | Stade Albert-Domec | Stade Albert-Daumec |

## United Rugby Championship (urc_a.ts, urc_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Leinster Rugby | Leinster RFC | Aviva Stadium | Lansdowne Road |
| Munster Rugby | Munster RFC | Thomond Park | Thormond Park |
| Ulster Rugby | Ulster RFC | Kingspan Stadium | Ravenhill |
| Connacht Rugby | Connacht RFC | Dexcom Stadium | The Sportsground |
| Glasgow Warriors | Glasgow RFC | Scotstoun Stadium | keep |
| Edinburgh Rugby | Edinburgh RFC | Hive Stadium | Roseburn Park |
| Benetton Rugby | Treviso RFC | Stadio Monigo | keep |
| Zebre Parma | Parma RFC | Stadio Sergio Lanfranchi | Stadio Sergio Lanfranco |
| Vodacom Bulls | Pretoria RFC | Loftus Versfeld | Loftus Field |
| DHL Stormers | Cape Town RFC | DHL Stadium | Green Point Stadium |
| Hollywoodbets Sharks | Durban RFC | Kings Park | keep |
| Emirates Lions | Johannesburg RFC | Emirates Airline Park | Elliston Park |
| Cardiff Rugby | Cardiff RFC | Cardiff Arms Park | Cardiff Arms Field |
| Ospreys | Swansea RFC | St Helen's | St Helena's |
| Scarlets | Llanelli RFC | Parc y Scarlets | Stradley Park |
| Dragons RFC | Newport RFC | Rodney Parade | keep |

Collision note: Cardiff RFC, Newport RFC, Swansea RFC and Llanelli RFC are the
exact names of real (semi-pro, historic) Welsh clubs distinct from the pro
sides they descend from. Low risk — plain descriptive names in a fictional
world — but flagged for the owner's awareness.

## Super Rugby Pacific (srp_a.ts, srp_b.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Blues | Auckland RFC | Eden Park | Edendale Park |
| Chiefs | Waikato RFC | FMG Stadium Waikato | Waikato Stadium |
| Crusaders | Canterbury RFC | Apollo Projects Stadium | Addington Stadium |
| Highlanders | Otago RFC | Forsyth Barr Stadium | Dunedin Dome |
| Hurricanes | Wellington RFC | Sky Stadium | Wellington Stadium |
| Moana Pasifika | Pacific RFC | North Harbour Stadium | keep |
| ACT Brumbies | Canberra RFC | GIO Stadium | Bruce Stadium |
| Queensland Reds | Queensland RFC | Suncorp Stadium | Langton Park |
| NSW Waratahs | New South Wales RFC (short: NSW) | Allianz Stadium | Moore Park Stadium |
| Western Force | Perth RFC | HBF Park | Perth Oval |
| Fijian Drua | Fiji RFC | HFC Bank Stadium | Laucala Bay Stadium |

## Japan Rugby League One (jl1.ts)

| Current club | Proposed | Current ground | Proposed |
|---|---|---|---|
| Saitama Wild Knights | Saitama RFC | Kumagaya Rugby Stadium | keep |
| Toshiba Brave Lupus Tokyo | Fuchu RFC | Ajinomoto Stadium | Fuchu Stadium |
| Tokyo Sungoliath | Tokyo RFC | Chichibunomiya Stadium | Aoyama Rugby Ground |
| Kubota Spears Funabashi | Funabashi RFC | Kubota Spears Stadium | Funabashi Stadium |
| Yokohama Canon Eagles | Yokohama RFC | Nippatsu Mitsuzawa Stadium | Mitsuzawa Stadium |
| Toyota Verblitz | Mikawa RFC | Toyota Stadium | Mikawa Stadium |
| Kobelco Kobe Steelers | Kobe RFC | Noevir Stadium Kobe | Port Kobe Stadium |
| Shizuoka Blue Revs | Shizuoka RFC | Yamaha Stadium | Iwata Stadium |
| Black Rams Tokyo | Setagaya RFC | Komazawa Stadium | keep |
| Mitsubishi Dynaboars | Sagamihara RFC | Sagamihara Gion Stadium | Sagamihara Stadium |
| Urayasu D-Rocks | Urayasu RFC | Urayasu Stadium | keep |
| Mie Honda Heat | Suzuka RFC | Suzuka Sports Garden | keep |

Japan notes: Brave Lupus and Sungoliath are both Tokyo clubs, so one takes
Fuchu (its actual home) and the other keeps Tokyo; Black Rams take their
Setagaya district; Verblitz can't be "Toyota" without reading as the company,
so it takes the Mikawa region.

## Open questions

- **French style**: "Toulouse RFC" is applied per the RFC rule; if the Top 14
  should read more French, "RC Toulouse" / "Stade Toulouse" variants are a
  one-word swap.
- **Welsh collisions**: see the URC note (Cardiff/Newport/Swansea/Llanelli RFC
  are real historic club names).
- **`seedDeals` in commercial.ts** parses real ground names for inherited
  naming-rights sponsors ("cinch Stadium at Franklin's Gardens"); once grounds
  are fictional that regex finds nothing and every club gets a fictional
  inherited sponsor — desired, but verify.
- Player names (~1,600) and competition names are separate passes.
