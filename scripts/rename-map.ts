/**
 * ---- THE v1.0.2 RENAME TABLE ----
 *
 * Real competition, club and ground names on the left; the names the game ships
 * on the right. Applied to src/data and src/game by scripts/rename-apply.ts.
 *
 * THIS FILE LIVES IN scripts/ AND THAT IS DELIBERATE. Vite bundles from src/
 * only, so nothing here reaches the built app - which is the whole point. The
 * real trademarks stay available to the tooling (so a future squad update from
 * a screenshot can still be matched to the right club) while never shipping in
 * the binary a player downloads.
 *
 * WHAT IS NOT IN HERE: player names. ~1,600 real players keep their names by
 * the owner's decision. The apply script never touches them, and the shape of
 * this table is ready for them if that decision ever changes.
 *
 * Decisions behind the competition names: leagues are generic-descriptive
 * rather than near-misses, because a deliberately confusable mark is a weaker
 * position than the original, not a stronger one. Clubs are the city they play
 * in. Thirteen clubs share a city with another club, so those take the locality
 * their ground actually sits in - still location-based, still unique. Grounds
 * follow the naming shape of their own rugby culture rather than one global
 * template, so France gets a Stade and New Zealand gets an Oval.
 */

export interface CompRename { id: string; was: string; wasShort: string; now: string; nowShort: string }
export interface ClubRename { id: string; was: string; now: string; wasGround: string; nowGround: string }

export const COMPS: CompRename[] = [
  { id: 'prem', was: 'English Premier Division', wasShort: 'Premiership', now: 'English Premier Division', nowShort: 'Premier Division' },
  { id: 'champ', was: 'English Championship', wasShort: 'Championship', now: 'English Second Division', nowShort: 'Second Division' },
  { id: 'natl1', was: 'National League One', wasShort: 'National 1', now: 'English National Division', nowShort: 'National Div' },
  { id: 'top14', was: 'Top 14', wasShort: 'Top 14', now: 'French Elite 14', nowShort: 'Elite 14' },
  { id: 'prod2', was: 'Pro D2', wasShort: 'Pro D2', now: 'French Division 2', nowShort: 'Division 2' },
  { id: 'urc', was: 'United Rugby Championship', wasShort: 'URC', now: 'Celtic & Africa Super League', nowShort: 'CASL' },
  { id: 'srp', was: 'Super Rugby Pacific', wasShort: 'Super Rugby', now: 'The Pacific Championship', nowShort: 'Pacific Champ.' },
  { id: 'jl1', was: 'Japan League One', wasShort: 'League One', now: 'Japan Elite League', nowShort: 'Japan Elite' },
  { id: 'cc', was: 'Champions Cup', wasShort: 'Champions Cup', now: 'European Club Cup', nowShort: 'Club Cup' },
  { id: 'chc', was: 'European Challenge Cup', wasShort: 'Challenge Cup', now: 'The Continental Shield', nowShort: 'Continental Shield' },
  { id: 'sn', was: 'Six Nations', wasShort: 'Six Nations', now: 'European Nations Championship', nowShort: 'Euro Nations' },
  { id: 'trc', was: 'The Rugby Championship', wasShort: 'Rugby Champ.', now: 'Southern Nations Championship', nowShort: 'Southern Nations' },
  { id: 'wc', was: 'Rugby World Cup', wasShort: 'World Cup', now: 'The World Championship', nowShort: 'World Champ.' },
  { id: 'pnc', was: 'Pacific Nations Cup', wasShort: 'Pacific Cup', now: 'The Islands Cup', nowShort: 'Islands Cup' },
]

export const CLUBS: ClubRename[] = [
  { id: 'bath', was: 'Bath', now: 'Bath', wasGround: 'The Recreation Ground', nowGround: 'Bath Lane' },
  { id: 'bristol', was: 'Bristol Bears', now: 'Bristol', wasGround: 'Ashton Gate', nowGround: 'Bristol Road' },
  { id: 'exeter', was: 'Exeter Chiefs', now: 'Exeter', wasGround: 'Sandy Park', nowGround: 'Exeter Park' },
  { id: 'gloucester', was: 'Gloucester Rugby', now: 'Gloucester', wasGround: 'Kingsholm', nowGround: 'Gloucester Park' },
  { id: 'harlequins', was: 'Harlequins', now: 'Harlequins', wasGround: 'Twickenham Stoop', nowGround: 'Twickenham Road' },
  { id: 'leicester', was: 'Leicester', now: 'Leicester', wasGround: 'Mattioli Woods Welford Road', nowGround: 'Leicester Common' },
  { id: 'newcastle', was: 'Newcastle Red Bulls', now: 'Newcastle', wasGround: 'Kingston Park', nowGround: 'Newcastle Meadow' },
  { id: 'northampton', was: 'Northampton', now: 'Northampton', wasGround: 'cinch Stadium at Franklin\'s Gardens', nowGround: 'Northampton Park' },
  { id: 'sale', was: 'Sale', now: 'Sale', wasGround: 'Salford Community Stadium', nowGround: 'Salford Park' },
  { id: 'saracens', was: 'Saracens', now: 'Saracens', wasGround: 'StoneX Stadium', nowGround: 'Hendon Common' },
  { id: 'toulouse', was: 'Stade Toulousain', now: 'Toulouse', wasGround: 'Stade Ernest-Wallon', nowGround: 'Stade Municipal Toulouse' },
  { id: 'bordeaux', was: 'Union Bordeaux Bègles', now: 'Bordeaux', wasGround: 'Stade Chaban-Delmas', nowGround: 'Stade Municipal Bordeaux' },
  { id: 'la_rochelle', was: 'Stade Rochelais', now: 'La Rochelle', wasGround: 'Stade Marcel-Deflandre', nowGround: 'Stade La Rochelle' },
  { id: 'clermont', was: 'ASM Clermont Auvergne', now: 'Clermont-Ferrand', wasGround: 'Stade Marcel-Michelin', nowGround: 'Stade Municipal Clermont-Ferrand' },
  { id: 'toulon', was: 'RC Toulon', now: 'Toulon', wasGround: 'Stade Mayol', nowGround: 'Parc Toulon' },
  { id: 'racing92', was: 'Racing 92', now: 'Nanterre', wasGround: 'Paris La Défense Arena', nowGround: 'Parc des Sports Nanterre' },
  { id: 'stade_francais', was: 'Stade Français Paris', now: 'Paris', wasGround: 'Stade Jean-Bouin', nowGround: 'Parc des Sports Paris' },
  { id: 'castres', was: 'Castres Olympique', now: 'Castres', wasGround: 'Stade Pierre-Fabre', nowGround: 'Parc Castres' },
  { id: 'bayonne', was: 'Aviron Bayonnais', now: 'Bayonne', wasGround: 'Stade Jean-Dauger', nowGround: 'Stade Bayonne' },
  { id: 'lyon', was: 'Lyon OU', now: 'Lyon', wasGround: 'Matmut Stadium de Gerland', nowGround: 'Stade Lyon' },
  { id: 'montpellier', was: 'Montpellier Hérault Rugby', now: 'Montpellier', wasGround: 'GGL Stadium', nowGround: 'Parc Montpellier' },
  { id: 'pau', was: 'Section Paloise', now: 'Pau', wasGround: 'Stade du Hameau', nowGround: 'Stade Pau' },
  { id: 'perpignan', was: 'USA Perpignan', now: 'Perpignan', wasGround: 'Stade Aimé-Giral', nowGround: 'Stade Municipal Perpignan' },
  { id: 'vannes', was: 'RC Vannes', now: 'Vannes', wasGround: 'Stade de la Rabine', nowGround: 'Parc Vannes' },
  { id: 'leinster', was: 'Leinster Rugby', now: 'Dublin', wasGround: 'Aviva Stadium', nowGround: 'Dublin Park' },
  { id: 'munster', was: 'Munster Rugby', now: 'Limerick', wasGround: 'Thomond Park', nowGround: 'Limerick Park' },
  { id: 'ulster', was: 'Ulster Rugby', now: 'Belfast', wasGround: 'Kingspan Stadium', nowGround: 'Belfast Road' },
  { id: 'connacht', was: 'Connacht Rugby', now: 'Galway', wasGround: 'Dexcom Stadium', nowGround: 'Galway Green' },
  { id: 'glasgow', was: 'Glasgow Warriors', now: 'Glasgow', wasGround: 'Scotstoun Stadium', nowGround: 'Glasgow Park' },
  { id: 'edinburgh', was: 'Edinburgh Rugby', now: 'Edinburgh', wasGround: 'Hive Stadium', nowGround: 'Edinburgh Park' },
  { id: 'benetton', was: 'Benetton Rugby', now: 'Treviso', wasGround: 'Stadio Monigo', nowGround: 'Campo Treviso' },
  { id: 'zebre', was: 'Zebre Parma', now: 'Parma', wasGround: 'Stadio Sergio Lanfranchi', nowGround: 'Stadio Parma' },
  { id: 'bulls', was: 'Vodacom Bulls', now: 'Pretoria', wasGround: 'Loftus Versfeld', nowGround: 'Pretoria Park' },
  { id: 'stormers', was: 'DHL Stormers', now: 'Cape Town', wasGround: 'DHL Stadium', nowGround: 'Cape Town Oval' },
  { id: 'sharks', was: 'Hollywoodbets Sharks', now: 'Durban', wasGround: 'Kings Park', nowGround: 'Durban Grounds' },
  { id: 'lions', was: 'Emirates Lions', now: 'Johannesburg', wasGround: 'Emirates Airline Park', nowGround: 'Johannesburg Park' },
  { id: 'cardiff', was: 'Cardiff Rugby', now: 'Cardiff', wasGround: 'Cardiff Arms Park', nowGround: 'Cardiff Road' },
  { id: 'ospreys', was: 'Ospreys', now: 'Swansea', wasGround: 'St Helen\'s', nowGround: 'Swansea Road' },
  { id: 'scarlets', was: 'Scarlets', now: 'Llanelli', wasGround: 'Parc y Scarlets', nowGround: 'Llanelli Road' },
  { id: 'dragons', was: 'Dragons RFC', now: 'Newport', wasGround: 'Rodney Parade', nowGround: 'Newport Park' },
  { id: 'blues', was: 'Blues', now: 'Auckland', wasGround: 'Eden Park', nowGround: 'Auckland Grounds' },
  { id: 'chiefs', was: 'Chiefs', now: 'Hamilton', wasGround: 'FMG Stadium Waikato', nowGround: 'Hamilton Grounds' },
  { id: 'crusaders', was: 'Crusaders', now: 'Christchurch', wasGround: 'Apollo Projects Stadium', nowGround: 'Christchurch Oval' },
  { id: 'highlanders', was: 'Highlanders', now: 'Dunedin', wasGround: 'Forsyth Barr Stadium', nowGround: 'Dunedin Oval' },
  { id: 'hurricanes', was: 'Hurricanes', now: 'Wellington', wasGround: 'Sky Stadium', nowGround: 'Wellington Oval' },
  { id: 'moana', was: 'Moana Pasifika', now: 'Manukau', wasGround: 'North Harbour Stadium', nowGround: 'Manukau Grounds' },
  { id: 'brumbies', was: 'ACT Brumbies', now: 'Canberra', wasGround: 'GIO Stadium', nowGround: 'Canberra Park' },
  { id: 'reds', was: 'Queensland Reds', now: 'Brisbane', wasGround: 'Suncorp Stadium', nowGround: 'Brisbane Park' },
  { id: 'waratahs', was: 'NSW Waratahs', now: 'Sydney', wasGround: 'Allianz Stadium', nowGround: 'Sydney Park' },
  { id: 'force', was: 'Western Force', now: 'Perth', wasGround: 'HBF Park', nowGround: 'Perth Grounds' },
  { id: 'drua', was: 'Fijian Drua', now: 'Suva', wasGround: 'HFC Bank Stadium', nowGround: 'Suva Park' },
  { id: 'ealing', was: 'Ealing Trailfinders', now: 'Ealing', wasGround: 'Trailfinders Sports Ground', nowGround: 'Ealing Park' },
  { id: 'doncaster', was: 'Doncaster Knights', now: 'Doncaster', wasGround: 'Castle Park', nowGround: 'Doncaster Gardens' },
  { id: 'coventry', was: 'Coventry Rugby', now: 'Coventry', wasGround: 'Butts Park Arena', nowGround: 'Coventry Gardens' },
  { id: 'bedford', was: 'Bedford Blues', now: 'Bedford', wasGround: 'Goldington Road', nowGround: 'Bedford Road' },
  { id: 'pirates', was: 'Cornish Pirates', now: 'Penzance', wasGround: 'Mennaye Field', nowGround: 'Penzance Park' },
  { id: 'nottingham', was: 'Nottingham Rugby', now: 'Nottingham', wasGround: 'The Bay', nowGround: 'Nottingham Lane' },
  { id: 'hartpury', was: 'Hartpury University', now: 'Hartpury', wasGround: 'Gillman\'s Ground', nowGround: 'Hartpury Road' },
  { id: 'lscottish', was: 'London Scottish', now: 'Sheen', wasGround: 'The Athletic Ground', nowGround: 'Sheen Gardens' },
  { id: 'richmond', was: 'Richmond Rugby', now: 'Richmond', wasGround: 'The Athletic Ground', nowGround: 'Richmond Rise' },
  { id: 'cambridge', was: 'Cambridge Rugby', now: 'Cambridge', wasGround: 'Volac Park', nowGround: 'Cambridge Park' },
  { id: 'chinnor', was: 'Chinnor RFC', now: 'Chinnor', wasGround: 'Kingsey Road', nowGround: 'Chinnor Park' },
  { id: 'caldy', was: 'Caldy RFC', now: 'Wirral', wasGround: 'Paton Field', nowGround: 'Wirral Common' },
  { id: 'grenoble', was: 'FC Grenoble Rugby', now: 'Grenoble', wasGround: 'Stade des Alpes', nowGround: 'Stade Grenoble' },
  { id: 'montauban', was: 'US Montauban', now: 'Montauban', wasGround: 'Stade Sapiac', nowGround: 'Parc des Sports Montauban' },
  { id: 'brive', was: 'CA Brive', now: 'Brive-la-Gaillarde', wasGround: 'Stade Amédée-Domenech', nowGround: 'Stade Brive-la-Gaillarde' },
  { id: 'beziers', was: 'AS Béziers Hérault', now: 'Béziers', wasGround: 'Stade Raoul-Barrière', nowGround: 'Stade Béziers' },
  { id: 'provence', was: 'Provence Rugby', now: 'Aix-en-Provence', wasGround: 'Stade Maurice-David', nowGround: 'Stade Aix-en-Provence' },
  { id: 'oyonnax', was: 'Oyonnax Rugby', now: 'Oyonnax', wasGround: 'Stade Charles-Mathon', nowGround: 'Stade Oyonnax' },
  { id: 'colomiers', was: 'Colomiers Rugby', now: 'Colomiers', wasGround: 'Stade Michel-Bendichou', nowGround: 'Parc des Sports Colomiers' },
  { id: 'nevers', was: 'USON Nevers', now: 'Nevers', wasGround: 'Stade du Pré-Fleuri', nowGround: 'Parc des Sports Nevers' },
  { id: 'montdemarsan', was: 'Stade Montois', now: 'Mont-de-Marsan', wasGround: 'Stade Guy-Boniface', nowGround: 'Parc des Sports Mont-de-Marsan' },
  { id: 'biarritz', was: 'Biarritz Olympique', now: 'Biarritz', wasGround: 'Parc des Sports Aguiléra', nowGround: 'Parc Biarritz' },
  { id: 'agen', was: 'SU Agen', now: 'Agen', wasGround: 'Stade Armandie', nowGround: 'Parc des Sports Agen' },
  { id: 'valence', was: 'Valence Romans Drôme', now: 'Valence', wasGround: 'Stade Georges-Pompidou', nowGround: 'Stade Valence' },
  { id: 'dax', was: 'US Dax', now: 'Dax', wasGround: 'Stade Maurice-Boyau', nowGround: 'Parc des Sports Dax' },
  { id: 'carcassonne', was: 'US Carcassonne', now: 'Carcassonne', wasGround: 'Stade Albert-Domec', nowGround: 'Stade Carcassonne' },
  { id: 'wildknights', was: 'Saitama Wild Knights', now: 'Kumagaya', wasGround: 'Kumagaya Rugby Stadium', nowGround: 'Kumagaya Park' },
  { id: 'bravelupus', was: 'Toshiba Brave Lupus Tokyo', now: 'Fuchu', wasGround: 'Ajinomoto Stadium', nowGround: 'Fuchu Field' },
  { id: 'sungoliath', was: 'Tokyo Sungoliath', now: 'Chofu', wasGround: 'Chichibunomiya Stadium', nowGround: 'Chofu Field' },
  { id: 'spears', was: 'Kubota Spears Funabashi', now: 'Funabashi', wasGround: 'Kubota Spears Stadium', nowGround: 'Funabashi Field' },
  { id: 'canon', was: 'Yokohama Canon Eagles', now: 'Yokohama', wasGround: 'Nippatsu Mitsuzawa Stadium', nowGround: 'Yokohama Grounds' },
  { id: 'verblitz', was: 'Toyota Verblitz', now: 'Toyota', wasGround: 'Toyota Stadium', nowGround: 'Toyota Field' },
  { id: 'steelers', was: 'Kobelco Kobe Steelers', now: 'Kobe', wasGround: 'Noevir Stadium Kobe', nowGround: 'Kobe Grounds' },
  { id: 'bluerevs', was: 'Shizuoka Blue Revs', now: 'Iwata', wasGround: 'Yamaha Stadium', nowGround: 'Iwata Field' },
  { id: 'blackrams', was: 'Black Rams Tokyo', now: 'Setagaya', wasGround: 'Komazawa Stadium', nowGround: 'Setagaya Park' },
  { id: 'dynaboars', was: 'Mitsubishi Dynaboars', now: 'Sagamihara', wasGround: 'Sagamihara Gion Stadium', nowGround: 'Sagamihara Grounds' },
  { id: 'drocks', was: 'Urayasu D-Rocks', now: 'Urayasu', wasGround: 'Urayasu Stadium', nowGround: 'Urayasu Park' },
  { id: 'hondaheat', was: 'Mie Honda Heat', now: 'Suzuka', wasGround: 'Suzuka Sports Garden', nowGround: 'Suzuka Grounds' },
  { id: 'rosslyn', was: 'Rosslyn Park', now: 'Roehampton', wasGround: 'The Rock', nowGround: 'Roehampton Meadow' },
  { id: 'salefc', was: 'Sale FC', now: 'Sale FC', wasGround: 'Heywood Road', nowGround: 'Heywood Park' },
  { id: 'rams', was: 'Rams RFC', now: 'Reading', wasGround: 'Old Bath Road', nowGround: 'Reading Meadow' },
  { id: 'cinderford', was: 'Cinderford RFC', now: 'Cinderford', wasGround: 'Dockham Road', nowGround: 'Cinderford Lane' },
  { id: 'blackheath', was: 'Blackheath FC', now: 'Blackheath', wasGround: 'Well Hall', nowGround: 'Blackheath Rise' },
  { id: 'plymouth', was: 'Plymouth Albion', now: 'Plymouth', wasGround: 'Brickfields', nowGround: 'Plymouth Gardens' },
  { id: 'moseley', was: 'Birmingham Moseley', now: 'Birmingham', wasGround: 'Billesley Common', nowGround: 'Birmingham Gardens' },
  { id: 'darlington', was: 'Darlington Mowden Park', now: 'Darlington', wasGround: 'The Darlington Arena', nowGround: 'Darlington Meadow' },
  { id: 'leedstykes', was: 'Leeds Tykes', now: 'Leeds', wasGround: 'Grammar School at Leeds', nowGround: 'Leeds Rise' },
  { id: 'stortford', was: 'Bishop\'s Stortford', now: 'Bishop\'s Stortford', wasGround: 'Silver Leys', nowGround: 'Bishop\'s Stortford Park' },
  { id: 'sedgley', was: 'Sedgley Park', now: 'Manchester', wasGround: 'Park Lane', nowGround: 'Manchester Common' },
  { id: 'esher', was: 'Esher RFC', now: 'Esher', wasGround: 'Molesey Road', nowGround: 'Esher Meadow' },
]
