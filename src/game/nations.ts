// International rugby nations, reputations, and regen name pools.

export interface Nation {
  code: string
  name: string
  flag: string
  rep: number // 1-100
  sixNations?: boolean
  trc?: boolean // Rugby Championship
}

export const NATIONS: Nation[] = [
  { code: 'RSA', name: 'South Africa', flag: '🇿🇦', rep: 96, trc: true },
  { code: 'NZL', name: 'New Zealand', flag: '🇳🇿', rep: 94, trc: true },
  { code: 'IRE', name: 'Ireland', flag: '🇮🇪', rep: 92, sixNations: true },
  { code: 'FRA', name: 'France', flag: '🇫🇷', rep: 92, sixNations: true },
  { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rep: 89, sixNations: true },
  { code: 'ARG', name: 'Argentina', flag: '🇦🇷', rep: 85, trc: true },
  { code: 'SCO', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', rep: 83, sixNations: true },
  { code: 'AUS', name: 'Australia', flag: '🇦🇺', rep: 83, trc: true },
  { code: 'FIJ', name: 'Fiji', flag: '🇫🇯', rep: 78 },
  { code: 'ITA', name: 'Italy', flag: '🇮🇹', rep: 76, sixNations: true },
  { code: 'WAL', name: 'Wales', flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', rep: 74, sixNations: true },
  { code: 'GEO', name: 'Georgia', flag: '🇬🇪', rep: 70 },
  { code: 'JPN', name: 'Japan', flag: '🇯🇵', rep: 70 },
  { code: 'SAM', name: 'Samoa', flag: '🇼🇸', rep: 67 },
  { code: 'TGA', name: 'Tonga', flag: '🇹🇴', rep: 64 },
  { code: 'USA', name: 'United States', flag: '🇺🇸', rep: 60 },
  { code: 'CAN', name: 'Canada', flag: '🇨🇦', rep: 52 },
  { code: 'URU', name: 'Uruguay', flag: '🇺🇾', rep: 60 },
  { code: 'POR', name: 'Portugal', flag: '🇵🇹', rep: 62 },
  { code: 'ESP', name: 'Spain', flag: '🇪🇸', rep: 57 },
  { code: 'ROU', name: 'Romania', flag: '🇷🇴', rep: 55 },
  { code: 'NAM', name: 'Namibia', flag: '🇳🇦', rep: 52 },
  { code: 'CHL', name: 'Chile', flag: '🇨🇱', rep: 54 },
  { code: 'LIO', name: 'British & Irish Lions', flag: '🦁', rep: 93 },
]

export const nationByCode = (c: string) => NATIONS.find(n => n.code === c)
export const flagOf = (c: string) => nationByCode(c)?.flag ?? '🏉'

/** Regen name pools per country: first names, then surnames.
 *
 *  These were twelve of each, which is 144 possible English names. The world
 *  holds well over three thousand generated players, so collisions were not bad
 *  luck, they were arithmetic: 484 names were shared, 117 generated men wore a
 *  real player's name - Gloucester's captain Tomos Williams among them - and
 *  seventeen were called Freddie Brown. scripts/namedup.ts measures it.
 *
 *  Thirty-six of each is about thirteen hundred combinations, roughly nine times
 *  the room, which is what makes the uniqueness guard in regenName able to
 *  actually find a free name instead of giving up after ten tries. The four
 *  smaller unions get twenty-eight each, which is the same ratio against far
 *  fewer generated players.
 *
 *  Names are chosen to read as they should for the country. None of them is a
 *  currently contracted professional: the point is that a generated man sounds
 *  like he could be from there, not that he shares a byline with someone real.
 *  Anyone added here should be checked against the real database for that reason -
 *  scripts/namedup.ts fails if a generated player ever takes a real man's name. */
const N: Record<string, [string[], string[]]> = {
  ENG: [['Tom', 'Harry', 'George', 'Jack', 'Ollie', 'Ben', 'Sam', 'Charlie', 'Freddie', 'Alfie', 'Archie', 'Max', 'Joe', 'Will', 'Dan', 'Luke', 'Toby', 'Reuben', 'Rufus', 'Digby', 'Monty', 'Barney', 'Wilf', 'Seb', 'Casper', 'Bertie', 'Rowan', 'Miles', 'Kit', 'Gus', 'Teddy', 'Hugo', 'Jasper', 'Felix', 'Arthur', 'Nathaniel'], ['Smith', 'Jones', 'Taylor', 'Brown', 'Cooper', 'Hill', 'Ward', 'Turner', 'Walker', 'Bell', 'Clark', 'Barnes', 'Whitfield', 'Ashby', 'Hollis', 'Brampton', 'Lindsey', 'Kerridge', 'Fenwick', 'Ollerton', 'Beckworth', 'Rainford', 'Selby', 'Thackeray', 'Mowbray', 'Hemsley', 'Ludgate', 'Cawthorne', 'Pemberton', 'Wraysbury', 'Ilkeston', 'Fairhurst', 'Grimsdale', 'Adlington', 'Netherwood', 'Sowerby']],
  FRA: [['Théo', 'Louis', 'Hugo', 'Jules', 'Mathis', 'Baptiste', 'Antoine', 'Romain', 'Paul', 'Léo', 'Nathan', 'Enzo', 'Clément', 'Corentin', 'Gaël', 'Maxime', 'Quentin', 'Sacha', 'Timéo', 'Yanis', 'Bastien', 'Aurélien', 'Florian', 'Lilian', 'Noé', 'Raphaël', 'Tristan', 'Valentin', 'Aymeric', 'Cédric', 'Damien', 'Ludovic', 'Océan', 'Rémi', 'Sylvain', 'Xavier'], ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Garcia', 'Roux', 'Fabre', 'Blanc', 'Marty', 'Cazes', 'Delmas', 'Vaillant', 'Ferrand', 'Lacombe', 'Peyrouse', 'Cassagne', 'Bousquet', 'Salvat', 'Larrieu', 'Baradat', 'Fontanel', 'Miquel', 'Sarrazin', 'Coulom', 'Estèbe', 'Puyol', 'Tarbouriech', 'Lassalle', 'Bergougnan', 'Cambon', 'Vialaret', 'Escande', 'Bonneval', 'Sourgens', 'Deltour']],
  IRE: [['Cian', 'Jack', 'Conor', 'Sean', 'Liam', 'Darragh', 'Fionn', 'Oisin', 'Rory', 'Eoin', 'Cathal', 'Tadhg', 'Ruairi', 'Padraig', 'Donncha', 'Killian', 'Niall', 'Ronan', 'Shane', 'Ciaran', 'Brendan', 'Fergal', 'Odhran', 'Senan', 'Barra', 'Colm', 'Diarmuid', 'Enda', 'Lorcan', 'Malachy', 'Peadar', 'Turlough', 'Aidan', 'Breandan', 'Feidhlim', 'Muiris'], ["O'Brien", 'Murphy', 'Kelly', 'Ryan', "O'Connor", 'Walsh', 'McCarthy', 'Byrne', "O'Sullivan", 'Doyle', 'Kennedy', 'Lynch', "O'Donovan", 'Mulcahy', 'Hanrahan', 'Devaney', 'Cregan', 'Moloney', 'Tierney', 'Fogarty', 'Naughton', 'Sheridan', 'Hartnett', 'Deasy', 'Corrigan', 'Larkin', 'Mescall', 'Rafferty', 'Twomey', 'Whelehan', 'Bourke', 'Cassidy', 'Grennan', 'Loughnane', 'Prendergast', 'Scanlon']],
  SCO: [['Angus', 'Callum', 'Fraser', 'Hamish', 'Ewan', 'Finlay', 'Gregor', 'Rory', 'Blair', 'Cameron', 'Duncan', 'Craig', 'Lachlan', 'Murdo', 'Kenneth', 'Alasdair', 'Struan', 'Torquil', 'Innes', 'Magnus', 'Dougal', 'Euan', 'Kieran', 'Malcolm', 'Niall', 'Ranald', 'Sorley', 'Tormod', 'Archie', 'Brodie', 'Crawford', 'Fingal', 'Kyle', 'Lorne', 'Rhuaridh', 'Wallace'], ['MacDonald', 'Campbell', 'Stewart', 'Robertson', 'Fraser', 'Grant', 'Ross', 'Munro', 'Ferguson', 'Bruce', 'Watson', 'Hogg', 'Kinloch', 'Dalgleish', 'Strachan', 'Buchanan', 'Nithsdale', 'Rutherglen', 'Balfour', 'Lauder', 'Whitelaw', 'Kilgour', 'Menteith', 'Crichton', 'Garrioch', 'Inverarity', 'Threshie', 'Ogilvie', 'Pentland', 'Rankine', 'Tulloch', 'Wardlaw', 'Blackadder', 'Carmichael', 'Drummond', 'Elphinstone']],
  WAL: [['Dylan', 'Rhys', 'Owen', 'Ieuan', 'Gareth', 'Dafydd', 'Tomos', 'Elis', 'Osian', 'Morgan', 'Iestyn', 'Llyr', 'Geraint', 'Emyr', 'Carwyn', 'Bleddyn', 'Cynog', 'Deiniol', 'Ellis', 'Gwilym', 'Huw', 'Idris', 'Lewys', 'Meirion', 'Rhodri', 'Sion', 'Trystan', 'Wyn', 'Aneurin', 'Cai', 'Eryl', 'Gwion', 'Hywel', 'Iwan', 'Marc', 'Padrig'], ['Williams', 'Davies', 'Evans', 'Thomas', 'Jones', 'Rees', 'Morgan', 'Owens', 'Price', 'Jenkins', 'Lloyd', 'Hughes', 'Pritchard', 'Meredith', 'Vaughan', 'Cadwallader', 'Trevethick', 'Bevan', 'Llewelyn', 'Gwynne', 'Prosser', 'Wigley', 'Merrick', 'Penry', 'Havard', 'Crowther', 'Bedwell', 'Tudur', 'Maddocks', 'Gethin', 'Rowlands', 'Pugsley', 'Beddoe', 'Cynwal', 'Hopkin', 'Nantcarrow']],
  ITA: [['Marco', 'Luca', 'Matteo', 'Alessandro', 'Federico', 'Giovanni', 'Lorenzo', 'Tommaso', 'Riccardo', 'Davide', 'Paolo', 'Nicolo', 'Andrea', 'Emanuele', 'Filippo', 'Gabriele', 'Leonardo', 'Massimo', 'Pietro', 'Simone', 'Stefano', 'Vittorio', 'Cristian', 'Dario', 'Enrico', 'Fabio', 'Giulio', 'Michele', 'Roberto', 'Samuele', 'Tiziano', 'Valerio', 'Alberto', 'Claudio', 'Ludovico', 'Sergio'], ['Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Ricci', 'Marino', 'Greco', 'Conti', 'Gallo', 'Lamaro', 'Fusco', 'Bergamini', 'Sartorello', 'Vicenzi', 'Zanardelli', 'Poggiali', 'Mandruzzato', 'Beltrame', 'Cavagnoli', 'Doglioni', 'Frizzarin', 'Guidolin', 'Melandri', 'Pasqualin', 'Rigoni', 'Salvadori', 'Tessaro', 'Vignolo', 'Bordignon', 'Cerutti', 'Fadalti', 'Lorenzin', 'Mattiuzzo', 'Peracchia', 'Toniolo']],
  NZL: [['Kahu', 'Rieko', 'Caleb', 'Ethan', 'Josh', 'Liam', 'Quinn', 'Ruben', 'Tamati', 'Nikora', 'Beau', 'Finn', 'Manaia', 'Tane', 'Ihaia', 'Rawiri', 'Wiremu', 'Anaru', 'Kauri', 'Matiu', 'Nikau', 'Piripi', 'Rangi', 'Tipene', 'Hemi', 'Koro', 'Marama', 'Paora', 'Reon', 'Taika', 'Ari', 'Corban', 'Deacon', 'Jarrod', 'Kalem', 'Zane'], ['Williams', 'Tuipulotu', 'Ioane', 'Taylor', 'Parata', 'Ngatai', 'Havili', 'Walker-Leawere', 'McKenzie', 'Christie', 'Ratima', 'Sititi', 'Whangapirita', 'Te Kanawa', 'Hurunui', 'Papuni', 'Rakuraku', 'Tainui', 'Waipara', 'Kaipara', 'Mataiti', 'Ngawaka', 'Pouwhare', 'Rewiti', 'Tamaki', 'Wharekura', 'Ahipene', 'Hemara', 'Kohere', 'Manukau', 'Ohia', 'Paretutanganui', 'Rongonui', 'Tautari', 'Waitoa', 'Whitiora']],
  AUS: [['Lachlan', 'Angus', 'Noah', 'Cooper', 'Hunter', 'Riley', 'Jack', 'Tom', 'Darcy', 'Fraser', 'Kalani', 'Taj', 'Bailey', 'Brayden', 'Corey', 'Declan', 'Flynn', 'Jarrah', 'Kobe', 'Lincoln', 'Mackenzie', 'Nash', 'Oliver', 'Paddy', 'Rylan', 'Sonny', 'Tyson', 'Xavier', 'Beau', 'Clancy', 'Digger', 'Hamish', 'Jed', 'Koa', 'Marlon', 'Zeke'], ['Wilson', 'Kellaway', 'Gordon', 'Bell', 'Robertson', 'McReight', 'Tupou', 'Faessler', 'Lonergan', 'Hooper', 'Daugunu', 'Nasser', 'Barrandale', 'Cundy', 'Ellsworth', 'Fitchett', 'Halloran', 'Jerrick', 'Kilminster', 'Lidcombe', 'Marchant', 'Nunnery', 'Oldfield', 'Prendiville', 'Quirk', 'Ranleigh', 'Stapylton', 'Trundle', 'Vellacott', 'Warrender', 'Braddock', 'Chittick', 'Dunmore', 'Gawler', 'Hackworth', 'Ingleby']],
  RSA: [['Jaco', 'Ruan', 'Johan', 'Pieter', 'Thabo', 'Sipho', 'Lukhanyo', 'Damian', 'Franco', 'Hendrik', 'Wandile', 'Kwagga', 'Marnus', 'Wian', 'Stefan', 'Coenie', 'Lizo', 'Mzwandile', 'Sibusiso', 'Tumelo', 'Aphiwe', 'Bongi', 'Ntokozo', 'Phepsi', 'Rynhardt', 'Schalk', 'Tiaan', 'Vincent', 'Werner', 'Zolani', 'Barend', 'Deon', 'Gerhard', 'Jurie', 'Kobus', 'Nardus'], ['van der Merwe', 'Botha', 'du Plessis', 'Nel', 'Mbeki', 'Steyn', 'Kriel', 'Venter', 'Mostert', 'Nkosi', 'Fourie', 'Marx', 'Oosthuizen', 'Grobbelaar', 'Swanepoel', 'Vermaak', 'Bezuidenhout', 'Nortje', 'Kleynhans', 'Labuschagne', 'Maritz', 'Odendaal', 'Pretorius', 'Radebe', 'Sithole', 'Terblanche', 'Uys', 'Viljoen', 'Zulu', 'Buthelezi', 'Dlamini', 'Erasmus', 'Gxoyiya', 'Hlongwane', 'Jantjies', 'Khumalo']],
  ARG: [['Santiago', 'Mateo', 'Joaquin', 'Tomas', 'Facundo', 'Bautista', 'Juan', 'Pedro', 'Gonzalo', 'Ignacio', 'Marcos', 'Lucio', 'Agustin', 'Benicio', 'Ciro', 'Dante', 'Emiliano', 'Franco', 'Gaspar', 'Ivan', 'Julian', 'Lautaro', 'Nahuel', 'Octavio', 'Ramiro', 'Simon', 'Thiago', 'Valentin', 'Alejo', 'Bruno', 'Cristobal', 'Dylan', 'Federico', 'Genaro', 'Lisandro', 'Nicanor'], ['Fernandez', 'Gonzalez', 'Rodriguez', 'Lopez', 'Martinez', 'Garcia', 'Sanchez', 'Moroni', 'Petti', 'Isa', 'Carreras', 'Mallia', 'Bordoy', 'Cavallero', 'Dellacqua', 'Echegaray', 'Ferrarotti', 'Gimenez', 'Ibarguren', 'Larrandart', 'Mendizabal', 'Nogues', 'Olivera', 'Pizzarello', 'Quaglia', 'Rubinstein', 'Solveyra', 'Tetaz', 'Ugalde', 'Vergallo', 'Ybarra', 'Zunino', 'Baravalle', 'Cordero', 'Deluca', 'Etchegoyen']],
  FIJ: [['Waisea', 'Semi', 'Josua', 'Viliame', 'Jiuta', 'Peni', 'Iosefo', 'Samu', 'Tevita', 'Ratu', 'Apisai', 'Eroni', 'Netani', 'Kalivati', 'Meli', 'Sireli', 'Taniela', 'Vuate', 'Amenoni', 'Bill', 'Ilaisa', 'Livai', 'Nemani', 'Rusiate', 'Saula', 'Tuidraki', 'Vilimoni', 'Aminiasi', 'Etonia', 'Isikeli', 'Manasa', 'Onisi', 'Salesi', 'Tomasi', 'Vueti', 'Wame'], ['Nayacalevu', 'Radradra', 'Tuisova', 'Mata', 'Ravouvou', 'Botitu', 'Masi', 'Kunavula', 'Tagitagivalu', 'Dolokoto', 'Ikanivere', 'Doge', 'Vosawai', 'Naikadawa', 'Cakaubalavu', 'Rabuli', 'Tikoduadua', 'Vunibaka', 'Bogileka', 'Delaibatiki', 'Kurimudu', 'Naivalurua', 'Qioniwasa', 'Ratulevu', 'Sereki', 'Tabualevu', 'Vakacegu', 'Waqanidrola', 'Bulivou', 'Cavubati', 'Mocevakaca', 'Rabaka', 'Senivutu', 'Tuinaceva', 'Vulaono', 'Yabaki']],
  SAM: [['Iosua', 'Malo', 'Sione', 'Tavita', 'Penieli', 'Faalelei', 'Manu', 'Alofa', 'Petelo', 'Lemi', 'Faasolo', 'Nofoaluma', 'Saveataugafa', 'Tuiletufuga', 'Vaea', 'Aiono', 'Fesuiaʻi', 'Levi', 'Muliaga', 'Peni', 'Saʻu', 'Tanielu', 'Uilisone', 'Vaiotu', 'Aleki', 'Fiso', 'Lauano', 'Netzler'], ['Tuilagi', 'Faleali’i', 'Leiua', 'Taefu', 'Malolo', 'Seuteni', 'Alaalatoa', 'Fidow', 'Lam', 'Motu', 'Tuiloma', 'Sagapolu', 'Faaleava', 'Pelesasa', 'Toomalatai', 'Vaifale', 'Aiolupotea', 'Faleolo', 'Mataʻafa', 'Papaliʻi', 'Salanoa', 'Tapelu', 'Uelese', 'Vailolo', 'Asiata', 'Fuimaono', 'Leaupepe', 'Nuʻuausala']],
  TGA: [['Sione', 'Taniela', 'Viliami', 'Malakai', 'Tevita', 'Fine', 'Halaleva', 'Kali', 'Semisi', 'Paula', 'Ata', 'Filipe', 'Lopeti', 'Manu', 'Nasi', 'Penisimani', 'Sitiveni', 'Uili', 'Vaea', 'Aisake', 'Feao', 'Latu', 'Mafi', 'Otumuli', 'Pita', 'Solomone', 'Tuʻipulotu', 'Vunipola'], ['Tupou', 'Fifita', 'Havili', 'Taumalolo', 'Fekitoa', 'Piutau', 'Vailanu', 'Takulua', 'Ahki', 'Kaho', 'Lokotui', 'Faletau', 'Halaifonua', 'Maʻafu', 'Ngauamo', 'Puafisi', 'Tameifuna', 'Vaipulu', 'Fosita', 'Hingano', 'Katoa', 'Moala', 'Pole', 'Taufa', 'Uhila', 'Vaʻenuku', 'Fusitua', 'Langi']],
  JPN: [['Kenta', 'Yuto', 'Daiki', 'Ryota', 'Shota', 'Takeshi', 'Haruto', 'Kaito', 'Sora', 'Ren', 'Yuma', 'Hayato', 'Kosei', 'Naoki', 'Riku', 'Shun', 'Tatsuya', 'Yusuke', 'Akira', 'Daichi', 'Fumiya', 'Hiroto', 'Keigo', 'Masaki', 'Rikuto', 'Souta', 'Tomoya', 'Yuki'], ['Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Saito', 'Matsuda', 'Inoue', 'Fujiwara', 'Hasegawa', 'Kawaguchi', 'Morishima', 'Okazaki', 'Sakamoto', 'Tsuchida', 'Yoshimura', 'Andou', 'Enomoto', 'Higuchi', 'Kadowaki', 'Miyashita', 'Nishimoto', 'Ochiai', 'Shibasaki', 'Uehara', 'Yanagida']],
  GEO: [['Giorgi', 'Levan', 'Davit', 'Luka', 'Nika', 'Irakli', 'Sandro', 'Beka', 'Vano', 'Tornike', 'Zurab', 'Aleksandre', 'Gela', 'Ilia', 'Mikheil', 'Otar', 'Rezo', 'Shalva', 'Vasil', 'Zviad', 'Akaki', 'Dachi', 'Guram', 'Konstantine', 'Merab', 'Paata', 'Saba', 'Temur'], ['Lomidze', 'Kvirikashvili', 'Gorgadze', 'Abuladze', 'Tabutsadze', 'Sharikadze', 'Nariashvili', 'Mamukashvili', 'Chkhaidze', 'Javakhia', 'Kutateladze', 'Beridze', 'Dzagnidze', 'Elizbarashvili', 'Gvaramadze', 'Iashvili', 'Kharaishvili', 'Lomtadze', 'Metreveli', 'Ninidze', 'Pirtskhalava', 'Rekhviashvili', 'Shubitidze', 'Tsiklauri', 'Ubilava', 'Vashadze', 'Zedginidze', 'Chelidze']],
}

/** Every name already spoken for in one world, lowercased.
 *
 *  Cached against the state object rather than threaded through twelve call sites,
 *  because several of them generate inside a loop and rebuilding a seven-thousand
 *  entry set per player would be the slowest thing in the game. A loaded save is a
 *  new object and gets a fresh registry, which is correct: the names it contains
 *  are exactly the ones in it.
 *
 *  Retirements never give a name back. That is deliberate - a Freddie Barnes who
 *  played two hundred games and hung up his boots should not be replaced by
 *  another Freddie Barnes the following August. */
const REGISTRY = new WeakMap<object, Set<string>>()

export function nameRegistry(world: object, existing: () => Iterable<string>): Set<string> {
  let set = REGISTRY.get(world)
  if (!set) {
    set = new Set<string>()
    for (const n of existing()) set.add(n.toLowerCase())
    REGISTRY.set(world, set)
  }
  return set
}

/** A name for a generated player. Pass the registry and it will be his alone.
 *
 *  Without the registry this drew blind, and a pool of 144 English names against
 *  three and a half thousand generated players made collisions certain rather than
 *  unlucky: 484 shared names, 117 of them a generated man wearing a real player's,
 *  seventeen Freddie Browns. The pools are nine times bigger now, which is what
 *  makes a guard worth having - thirty draws against thirteen hundred combinations
 *  finds a free name unless the country is nearly exhausted.
 *
 *  And if it is exhausted, a second surname rather than a repeat. Double-barrelled
 *  names are ordinary in rugby and it squares the space instead of giving up. */
export function regenName(rng: () => number, nat: string, taken?: Set<string>): string {
  const pool = N[nat] ?? N.ENG
  const first = () => pool[0][Math.floor(rng() * pool[0].length)]
  const last = () => pool[1][Math.floor(rng() * pool[1].length)]
  let name = `${first()} ${last()}`
  if (!taken) return name

  for (let i = 0; i < 30 && taken.has(name.toLowerCase()); i++) name = `${first()} ${last()}`
  if (taken.has(name.toLowerCase())) {
    for (let i = 0; i < 30; i++) {
      const a = last()
      const b = last()
      if (a === b) continue
      const alt = `${first()} ${a}-${b}`
      if (!taken.has(alt.toLowerCase())) { name = alt; break }
    }
  }
  taken.add(name.toLowerCase())
  return name
}

/** The name registry for one world.
 *
 *  Structurally typed rather than taking GameState, so nations.ts stays a leaf
 *  module with nothing above it to import. Every generator calls this and hands
 *  the result to regenName, which is what turns the guard from a good intention
 *  into something that actually holds. */
export function worldNames(state: { players: Record<number, { name: string }> }): Set<string> {
  return nameRegistry(state, () => Object.values(state.players).map(p => p.name))
}
