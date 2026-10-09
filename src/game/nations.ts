// International rugby nations, reputations, and regen name pools.
import { t, tIn, type Lang } from './i18n'
import type { Gender } from './gender'
import type { GameState, Player } from './model'

export interface Nation {
  code: string
  name: string
  rep: number // 1-100
  sixNations?: boolean
  trc?: boolean // Southern Championship
}

export const NATIONS: Nation[] = [
  { code: 'RSA', name: 'South Africa', rep: 96, trc: true },
  { code: 'NZL', name: 'New Zealand', rep: 94, trc: true },
  { code: 'IRE', name: 'Ireland', rep: 92, sixNations: true },
  { code: 'FRA', name: 'France', rep: 92, sixNations: true },
  { code: 'ENG', name: 'England', rep: 89, sixNations: true },
  { code: 'ARG', name: 'Argentina', rep: 85, trc: true },
  { code: 'SCO', name: 'Scotland', rep: 83, sixNations: true },
  { code: 'AUS', name: 'Australia', rep: 83, trc: true },
  { code: 'FIJ', name: 'Fiji', rep: 78 },
  { code: 'ITA', name: 'Italy', rep: 76, sixNations: true },
  { code: 'WAL', name: 'Wales', rep: 74, sixNations: true },
  { code: 'GEO', name: 'Georgia', rep: 70 },
  { code: 'JPN', name: 'Japan', rep: 70 },
  { code: 'SAM', name: 'Samoa', rep: 67 },
  { code: 'TGA', name: 'Tonga', rep: 64 },
  { code: 'USA', name: 'United States', rep: 60 },
  { code: 'CAN', name: 'Canada', rep: 52 },
  { code: 'URU', name: 'Uruguay', rep: 60 },
  { code: 'POR', name: 'Portugal', rep: 62 },
  { code: 'ESP', name: 'Spain', rep: 57 },
  { code: 'ROU', name: 'Romania', rep: 55 },
  { code: 'NAM', name: 'Namibia', rep: 52 },
  { code: 'CHL', name: 'Chile', rep: 54 },
  { code: 'LIO', name: 'British & Irish Isles XV', rep: 93 },
]

export const nationByCode = (c: string) => NATIONS.find(n => n.code === c)

/** The national-job ladder: which federations hire club managers, and the
 *  reputation each one wants before it calls on its own. One list (it was
 *  written out twice in season.ts, which is one drift away from two ladders),
 *  here because the season engine, the store grants and the store UI all
 *  need it and none of them may import each other. */
/**
 * The nations this WORLD actually plays Test rugby in.
 *
 * NAT_TIERS is the full list of sixteen and it is a men's list. A women's save
 * runs a six-nation Northern Championship and a four-nation Southern series -
 * ten unions - so six of the sixteen have no women's Test programme in the
 * game at all.
 *
 * That was a monetisation bug rather than a cosmetic one. "Become an
 * International Coach" is a paid product: before this, a buyer in a women's
 * career could pay for it, pick South Africa, Japan, Argentina, Fiji, Samoa or
 * Tonga, be appointed head coach, and then never be given a single match,
 * because no fixture in that world names his country. Somebody paying real
 * money for a job that does not exist is the worst class of defect in the
 * store.
 *
 * Reading the world's own competitions rather than keeping a second women's
 * list means a league added later is picked up for free, and the two can never
 * drift apart.
 */
export function testNationsIn(state: { comps: Record<string, { isNational?: boolean; teamIds: string[] }> }): string[] {
  const out = new Set<string>()
  for (const c of Object.values(state.comps)) {
    if (!c.isNational) continue
    for (const t of c.teamIds) out.add(t)
  }
  // the touring invitational is a squad, not a union - never a job
  out.delete('LIO')
  return [...out]
}

/** NAT_TIERS, less the unions this world has no Test programme for. */
export function pickableNations(state: { comps: Record<string, { isNational?: boolean; teamIds: string[] }> }): [string, number][] {
  const live = new Set(testNationsIn(state))
  const kept = NAT_TIERS.filter(([n]) => live.has(n))
  // never hand back an empty picker: a world with no national comps at all
  // (an early save, a future mode) keeps the old behaviour rather than
  // rendering a list with nothing in it
  return kept.length ? kept : [...NAT_TIERS]
}

export const NAT_TIERS: [string, number][] = [
  ['CAN', 64], ['USA', 65], ['TGA', 66], ['SAM', 67], ['JPN', 69], ['FIJ', 71],
  ['ITA', 72], ['WAL', 74], ['SCO', 76], ['AUS', 78], ['ARG', 78],
  ['ENG', 84], ['FRA', 86], ['RSA', 87], ['IRE', 87], ['NZL', 88],
]

/**
 * A NATION'S NAME IS TRANSLATED. A CLUB'S IS NOT.
 *
 * Northampton is called Northampton in Paris, so club names are data and stay
 * as they are. Countries are not: a French reader expects Angleterre, and the
 * live probe found "England" on eleven French screens - a first cap, a Grand
 * Slam eve, a championship won, every Test scoreline.
 *
 * French also wants the article, and which article depends on the country, so
 * there are three forms rather than one:
 *
 *   nation      bare, for tables, scorelines and squad labels - "Angleterre"
 *   nationThe   mid-sentence with its article - "avec l'Angleterre"
 *   nationCap   the same, capitalised, for the start of a sentence
 *
 * English fills all three with the same word, which is the point: the English
 * templates go on saying {nation} and only the French ones reach for the rest.
 *
 * Prepositions: "à" and "de" contract with the article and the contraction
 * depends on the country ("au Japon", "d'Angleterre"), so the French templates
 * use prepositions that never contract - avec, pour, sans, contre, chez.
 */
export const nationName = (c: string) => (nationByCode(c) ? t(`nation.${c}`) : c)
export const nationNameIn = (lang: Lang, c: string) => (nationByCode(c) ? tIn(lang, `nation.${c}`) : c)

/** The three forms as news variables, so a story can be written in either
 *  language without the caller knowing which one will read it. */
export const nationVars = (c: string) => ({
  // English, as data: no dictionary renders {nation} (every one reads the _k
  // keys below), and a screen-language name here made the same career save
  // different bytes in French and English (1.8.5 save QA)
  nation: nationNameIn('en', c),
  nation_k: `nation.${c}`, nationThe_k: `nationThe.${c}`, nationCap_k: `nationCap.${c}`,
})

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
  // the MRC's own (1.7.3): without a pool an American academy boy or regen
  // took an English name
  USA: [['Tyler', 'Chase', 'Cole', 'Brock', 'Dillon', 'Gavin', 'Heath', 'Jace', 'Kellan', 'Levi', 'Mason', 'Parker', 'Ryder', 'Shane', 'Trent', 'Weston', 'Asher', 'Bryce', 'Cash', 'Dane', 'Ford', 'Gage', 'Holt', 'Jett', 'Lane', 'Nash', 'Rhett', 'Silas', 'Tate', 'Wade', 'Brooks', 'Crew', 'Duke', 'Hayes', 'Kade', 'Rowdy'], ['Anderson', 'Mitchell', 'Carter', 'Hayes', 'Sullivan', 'Reynolds', 'Brennan', 'Kowalski', 'Novak', 'Ortega', 'Pratt', 'Quinlan', 'Rasmussen', 'Stafford', 'Tolliver', 'Underhill', 'Vasquez', 'Wilder', 'Yates', 'Zimmer', 'Ashcroft', 'Bledsoe', 'Coburn', 'Dorsey', 'Ellison', 'Faircloth', 'Gentry', 'Harlan', 'Ingram', 'Jessup', 'Kilbride', 'Lomax', 'McCready', 'Northcutt', 'Pickering', 'Radcliffe']],
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
 *  Retirements do not give a name back for years. That is deliberate - a Freddie
 *  Barnes who played two hundred games and hung up his boots should not be
 *  replaced by another Freddie Barnes the following August. The memory is the
 *  newest RETIRED_NAMES_KEPT departures (about two summers of them), not every
 *  one there has ever been: kept whole it was 23,500 names and 447 KB of a
 *  twelve-season save (1.8.3, scripts/qa2/savesize.ts). */
const REGISTRY = new WeakMap<object, Set<string>>()

/** How many departed names the world remembers (GameState.retiredNames).
 *  Retirements and the free-agent cull let go of about two thousand a summer. */
export const RETIRED_NAMES_KEPT = 4000

/** The newest RETIRED_NAMES_KEPT names of a departures list, oldest first as
 *  it was written, each once. A list already inside the cap comes back as it
 *  was, so trimming twice is trimming once. */
export function keptRetiredNames(names: string[]): string[] {
  if (names.length <= RETIRED_NAMES_KEPT && new Set(names).size === names.length) return names
  const seen = new Set<string>()
  const kept: string[] = []
  for (let i = names.length - 1; i >= 0 && kept.length < RETIRED_NAMES_KEPT; i--) {
    const n = names[i]
    if (typeof n !== 'string' || seen.has(n)) continue
    seen.add(n)
    kept.push(n)
  }
  return kept.reverse()
}

export function nameRegistry(world: object, existing: () => Iterable<string>, onTake?: (name: string) => void): Set<string> {
  let set = REGISTRY.get(world)
  if (!set) {
    const s = new Set<string>()
    for (const n of existing()) s.add(n.toLowerCase())
    // every name handed out from here on is reported to the caller, so the
    // save can carry it and a reload rebuilds exactly this set (1.6.5)
    if (onTake) {
      const add = s.add.bind(s)
      s.add = (v: string) => { if (!s.has(v)) onTake(v); return add(v) }
    }
    set = s
    REGISTRY.set(world, set)
  }
  return set
}

/** Throw the cached registry away, so the next generator rebuilds it from the
 *  state. The rollover calls this after it trims the lists the registry is
 *  rebuilt from (rollover.ts pruneNames): a running game and a reloaded save
 *  must hold the same set, and a cache that still held the trimmed names
 *  would make the running game the odd one out. */
export function dropNameRegistry(world: object): void {
  REGISTRY.delete(world)
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
/**
 *  ---- WOMEN'S FIRST NAMES, BY UNION (v1.5) ----
 *
 *  Surnames are not gendered and are not duplicated: a generated woman draws her
 *  surname from N[nat][1] like everybody else, so a Welsh player is a Prosser or
 *  a Gwynne either way, and adding a union here is half the work rather than all
 *  of it.
 *
 *  Sized to match the men's pools - thirty-six for the unions with a domestic
 *  league in the game, twenty-eight for the rest - because the arithmetic that
 *  produced seventeen Freddie Browns does not care which game it is in. Against
 *  the same 36-surname lists that is about thirteen hundred combinations per
 *  union, which is what lets regenName's uniqueness guard actually find a free
 *  name instead of giving up.
 *
 *  NO FIRST NAME APPEARS IN BOTH POOLS FOR THE SAME UNION. Nine did at first -
 *  Manaia, Marama, Nikau and Kahu in New Zealand, Jarrah in Australia, Alofa and
 *  Nofoaluma in Samoa, Latu and Manu in Tonga - because they are genuinely
 *  unisex names in those cultures. The result was a generated 'Manaia Kaipara'
 *  existing in the men's world AND in the women's one, which scripts/genderprobe
 *  caught on its second run. The two games are meant to have nothing in common
 *  and that includes the people in them, so the women's pool gives way. Safe to
 *  change because WF is new in v1.5 and no save has drawn from it; the men's
 *  pools are untouched, because moving one name there would reshuffle every
 *  generated man in every existing career.
 *
 *  Same rule as the men's pools and for the same reason: none of these is a
 *  currently contracted professional. scripts/namedup.ts proves the built world
 *  has no duplicate and no generated player wearing a real one's name, and it
 *  does not care which game it is reading. */
const WF: Record<string, string[]> = {
  ENG: ['Alice', 'Beatrice', 'Bryony', 'Cerys', 'Daisy', 'Edith', 'Eleanor', 'Esme', 'Flora', 'Freya', 'Georgia', 'Harriet', 'Imogen', 'Isla', 'Jemima', 'Josie', 'Kitty', 'Lottie', 'Maisie', 'Martha', 'Matilda', 'Nell', 'Nancy', 'Orla', 'Phoebe', 'Primrose', 'Rosalind', 'Rowena', 'Saskia', 'Sybil', 'Tamsin', 'Thea', 'Verity', 'Wilhelmina', 'Winnie', 'Bea'],
  FRA: ['Amandine', 'Anaïs', 'Ariane', 'Aurore', 'Bérénice', 'Blandine', 'Capucine', 'Célestine', 'Clarisse', 'Coralie', 'Delphine', 'Élodie', 'Fanny', 'Gwenaëlle', 'Hortense', 'Inès', 'Jeanne', 'Léonie', 'Lucile', 'Manon', 'Margaux', 'Marion', 'Mélusine', 'Noémie', 'Océane', 'Perrine', 'Roxane', 'Sidonie', 'Solène', 'Sylvie', 'Tiphaine', 'Violette', 'Yolande', 'Zélie', 'Apolline', 'Bastienne'],
  IRE: ['Aoibhinn', 'Aoife', 'Bláthnaid', 'Bríd', 'Caoimhe', 'Ciara', 'Clodagh', 'Dearbhla', 'Eabha', 'Eimear', 'Fionnuala', 'Grainne', 'Íde', 'Laoise', 'Maeve', 'Mairéad', 'Muireann', 'Neasa', 'Niamh', 'Nuala', 'Órla', 'Póilín', 'Réiltín', 'Roisin', 'Saoirse', 'Sinéad', 'Siobhán', 'Sorcha', 'Tara', 'Treasa', 'Úna', 'Aisling', 'Brona', 'Deirbhile', 'Fidelma', 'Meabh'],
  SCO: ['Ailsa', 'Aileen', 'Beathag', 'Bonnie', 'Catriona', 'Coira', 'Davina', 'Eilidh', 'Elspeth', 'Fenella', 'Fiona', 'Flora', 'Greer', 'Iona', 'Isobel', 'Jean', 'Kirsty', 'Lorna', 'Maisie', 'Mhairi', 'Moira', 'Morag', 'Muriel', 'Nessa', 'Nairne', 'Peigi', 'Rhona', 'Senga', 'Shona', 'Sileas', 'Tamsin', 'Torrance', 'Una', 'Vaila', 'Wilma', 'Ishbel'],
  WAL: ['Angharad', 'Arianwen', 'Bethan', 'Branwen', 'Carys', 'Ceri', 'Delyth', 'Eiluned', 'Elin', 'Enfys', 'Ffion', 'Gwenllian', 'Gwyneth', 'Haf', 'Heledd', 'Lowri', 'Mabli', 'Meinir', 'Meleri', 'Myfanwy', 'Nerys', 'Nia', 'Olwen', 'Rhiannon', 'Seren', 'Sian', 'Sioned', 'Tegan', 'Tegwen', 'Alaw', 'Bronwen', 'Catrin', 'Dwynwen', 'Eirlys', 'Glesni', 'Nesta'],
  ITA: ['Alessia', 'Arianna', 'Benedetta', 'Bianca', 'Camilla', 'Carlotta', 'Chiara', 'Cristiana', 'Daniela', 'Elisa', 'Federica', 'Flavia', 'Francesca', 'Gaia', 'Giorgia', 'Giulia', 'Ilaria', 'Isabella', 'Laura', 'Lucrezia', 'Manuela', 'Marta', 'Martina', 'Micaela', 'Nadia', 'Ornella', 'Paola', 'Rossella', 'Sabrina', 'Serena', 'Silvia', 'Simona', 'Valentina', 'Veronica', 'Vittoria', 'Alba'],
  NZL: ['Anahera', 'Aroha', 'Awhina', 'Hinewai', 'Huia', 'Kahurangi', 'Kaia', 'Kiri', 'Mahina', 'Maia', 'Hineata', 'Ariana', 'Mereana', 'Miriama', 'Moana', 'Ngaio', 'Kararaina', 'Parehuia', 'Pounamu', 'Rangimarie', 'Reremoana', 'Rima', 'Ripeka', 'Tamsyn', 'Tui', 'Waimarie', 'Whetu', 'Ataahua', 'Hana', 'Terina', 'Manawa', 'Ngahuia', 'Pania', 'Rawinia', 'Tiare', 'Wairua'],
  AUS: ['Amber', 'Bindi', 'Bronte', 'Caitlin', 'Chelsea', 'Darcie', 'Ebony', 'Elke', 'Georgie', 'Hayley', 'Indigo', 'Jaslyn', 'Jorja', 'Kalinda', 'Kirra', 'Lara', 'Lilee', 'Maddi', 'Marli', 'Nyah', 'Peta', 'Piper', 'Quinn', 'Rylee', 'Sienna', 'Skye', 'Tahlia', 'Talia', 'Tarni', 'Willa', 'Xanthe', 'Zali', 'Bridie', 'Charlee', 'Keeley', 'Shanae'],
  RSA: ['Anelisa', 'Ayanda', 'Babalwa', 'Chuma', 'Elmarie', 'Hanlie', 'Ilze', 'Jolandi', 'Kegomoditswe', 'Lerato', 'Lindiwe', 'Mandisa', 'Marlize', 'Nandi', 'Nokuthula', 'Nolwazi', 'Ntombi', 'Palesa', 'Refilwe', 'Rethabile', 'Sanele', 'Sindiswa', 'Thandeka', 'Thembi', 'Tshegofatso', 'Wilmien', 'Xoliswa', 'Zanele', 'Zinhle', 'Anneke', 'Bulelwa', 'Karabo', 'Mbali', 'Nomvula', 'Retha', 'Yolande'],
  ARG: ['Abril', 'Agustina', 'Aitana', 'Belen', 'Bianca', 'Camila', 'Candela', 'Catalina', 'Delfina', 'Emilia', 'Florencia', 'Guadalupe', 'Ines', 'Josefina', 'Julieta', 'Lucia', 'Malena', 'Micaela', 'Milagros', 'Morena', 'Nerina', 'Paulina', 'Pilar', 'Renata', 'Rocio', 'Sofia', 'Solana', 'Tamara', 'Valentina', 'Victoria', 'Ximena', 'Zoe', 'Antonella', 'Brisa', 'Constanza', 'Luciana'],
  FIJ: ['Adi', 'Ana', 'Asenaca', 'Bulou', 'Ilisapeci', 'Kalisi', 'Karalaini', 'Laisana', 'Litia', 'Losana', 'Luisa', 'Makareta', 'Merewalesi', 'Mereoni', 'Naomi', 'Raijieli', 'Roela', 'Salanieta', 'Sereima', 'Sesenieli', 'Talei', 'Tarusila', 'Timaima', 'Ulamila', 'Unaisi', 'Vasiti', 'Verenaisi', 'Wainikiti'],
  SAM: ['Sieni', 'Faafetai', 'Faaolataga', 'Fetu', 'Ioana', 'Leilani', 'Lupe', 'Maiava', 'Malia', 'Manaia', 'Mareta', 'Moana', 'Lalelei', 'Palepa', 'Pele', 'Salamasina', 'Sefina', 'Sina', 'Tala', 'Tausala', 'Teuila', 'Tiare', 'Tuiloma', 'Uila', 'Vaiola', 'Vaitiare', 'Fuatino', 'Lagi'],
  TGA: ['Ana', 'Elenoa', 'Fatafehi', 'Halaevalu', 'Heilala', 'Kalolaine', 'Lavinia', 'Lose', 'Mele', 'Meleane', 'Nanasi', 'Ofa', 'Salote', 'Sela', 'Sesilia', 'Sinaitakala', 'Melenaite', 'Talia', 'Tupou', 'Uinise', 'Vaha', 'Vika', 'Amelia', 'Fifita', 'Tuputupu', 'Loua', 'Fusi', 'Paea'],
  JPN: ['Ayaka', 'Ayumi', 'Chihiro', 'Emi', 'Hana', 'Haruka', 'Hinata', 'Kaede', 'Kanako', 'Kaori', 'Mai', 'Mana', 'Mao', 'Megumi', 'Misaki', 'Miyu', 'Nanami', 'Nao', 'Natsuki', 'Rin', 'Riko', 'Saki', 'Sakura', 'Shiori', 'Tomomi', 'Yui', 'Yuka', 'Yuzuki'],
  GEO: ['Ana', 'Barbare', 'Elene', 'Eter', 'Gvantsa', 'Ia', 'Ketevan', 'Khatia', 'Lali', 'Lika', 'Mariam', 'Maka', 'Nana', 'Natia', 'Nino', 'Nutsa', 'Salome', 'Sopio', 'Tamar', 'Tamta', 'Teona', 'Tinatin', 'Ana-Mariam', 'Dali', 'Eka', 'Manana', 'Rusudan', 'Shorena'],
  USA: ['Addison', 'Alexis', 'Ashlyn', 'Aubrey', 'Bailey', 'Brooke', 'Cassidy', 'Delaney', 'Emerson', 'Harper', 'Hayden', 'Jordan', 'Kelsey', 'Kendall', 'Logan', 'Mackenzie', 'Madison', 'Marlowe', 'Peyton', 'Quinn', 'Reagan', 'Riley', 'Rowan', 'Sawyer', 'Sydney', 'Taylor', 'Tegan', 'Whitney'],
  CAN: ['Alexa', 'Amelie', 'Brooklyn', 'Camryn', 'Chloe', 'Danika', 'Elowen', 'Emmeline', 'Genevieve', 'Greta', 'Harlow', 'Jaclyn', 'Kaia', 'Keira', 'Larissa', 'Maren', 'Marielle', 'Nadine', 'Noelle', 'Paige', 'Reese', 'Rowyn', 'Shae', 'Sloane', 'Tenille', 'Tessa', 'Willa', 'Wren'],
}

/**
 * A name for a generated player, in either game.
 *
 * `g` defaults to 'm' so every existing call site keeps its exact behaviour -
 * this is called from a dozen places across the engine and a men's career must
 * generate byte-identically to how it did before v1.5, or every seeded world
 * shifts under saves that already exist.
 */
export function regenName(rng: () => number, nat: string, taken?: Set<string>, g: Gender = 'm'): string {
  const pool = N[nat] ?? N.ENG
  const firsts = g === 'w' ? (WF[nat] ?? WF.ENG) : pool[0]
  const first = () => firsts[Math.floor(rng() * firsts.length)]
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
export function worldNames(state: { players: Record<number, { name: string }>; retiredNames?: string[]; takenNames?: string[] }): Set<string> {
  // A reload rebuilds this set, so it has to hold what the running game's set
  // held: the players, the men who have left (retiredNames), and every name
  // the registry ever handed out (takenNames) - the intake class named at
  // week 30 and a scout's finds are registered before they are players, and
  // a reload that forgot them drew different regens from the same seed
  // (scripts/qa/determinism.ts, 1.6.5).
  return nameRegistry(
    state,
    () => [...Object.values(state.players).map(p => p.name), ...(state.retiredNames ?? []), ...(state.takenNames ?? [])],
    name => { (state.takenNames ??= []).push(name) },
  )
}

/** THE SQUAD IS THIRTY-TWO (owner, v1.1.12: "squad should be 32").
 *
 *  It was 26 for most windows, 28 at a World Cup and 30 for a Lions tour -
 *  numbers picked window by window and never the same twice, so the coach
 *  never learned what a squad was. One number, every window, every nation:
 *  thirty-two men, of whom 23 dress on the day. */
export const NAT_SQUAD_SIZE = 32

/** The floor a Test squad can be trimmed to: a matchday 23 plus cover.
 *
 *  It lived in country.ts, which imports from season.ts - so season.ts could
 *  not read it back without a cycle, and season.ts needs it from v1.1.17: the
 *  coach names his own squad now, and the engine has to know what "named" is. */
export const NAT_SQUAD_FLOOR = 23

/**
 * How many players beyond the travelling squad a generated nation carries.
 *
 * A nation our club world cannot staff has its internationals generated. Fill
 * exactly the squad and there is nobody outside it: the country desk reads
 * "Nobody left standing outside camp", and dropping a man makes him instantly
 * the only alternative to himself. Twenty more is half a squad again with
 * slack for the treatment room - enough that every shirt has a challenger and
 * a dropped man has somewhere to fall to.
 */
export const NAT_DEPTH = 20

/** NATIONS THAT PICK ONLY FROM THEIR OWN LEAGUE.
 *
 *  Owner: "players who dont play in England should not be able to be selected
 *  for England." That is the real rule and only England and France hold it -
 *  the RFU and the FFR both require a home-based contract, while Ireland,
 *  Scotland, Wales, Italy, New Zealand, Australia and South Africa all pick
 *  abroad, and South Africa's whole first-choice pack plays in Europe. So the
 *  bar is applied where it is true and nowhere else: making it universal
 *  would empty the Pumas and the Springboks.
 *
 *  The Lions are a squad of home-nations players and never a domestic side,
 *  so the rule does not touch them. */
const HOME_BASED_ONLY = ['ENG', 'FRA']

/** Does this man's CLUB qualify him for this nation? True everywhere the rule
 *  above does not apply. */
export function homeBased(state: GameState, p: Player, nat: string): boolean {
  if (!HOME_BASED_ONLY.includes(nat)) return true
  const club = p.clubId ? state.clubs[p.clubId] : null
  return !!club && club.country === nat
}

// ---- ONE MAN, TWO JOBS, NO FAVOURS (owner decision, tester note 9.10) ----
//
// A manager may hold a Test job alongside a club job, and the owner's ruling is
// that the club side gets NO advantage from the national one. The squad was
// the lever: a man in a camp is unavailable to his club (availablePlayers), so a
// coach who picked freely could call up a league rival's best players, leave
// his own club's men of that nation at home, and weaken the rival for the window
// at no cost. He could also cap his own fringe men to lift their value.
//
// The fix measures him against the one selector who has no club to favour: the
// federation itself. federationPick is the list manageInternationals names for
// an AI nation (the best home-based, fit, unloaned men by ability), and while
// he holds both jobs:
//   - from any club that shares a club competition with his own, his camp may
//     hold no more men than the federation would take from it (he may pick a
//     different man from that club, never MORE of them);
//   - his own club's men on the federation's list go to camp and stay there,
//     so his club gives up exactly what an AI federation would ask of it.
// Clubs his side never meets are untouched, and a coach with no club job picks
// with no limit at all: the rule exists only where the conflict does.

const HOME4_Q = ['ENG', 'IRE', 'SCO', 'WAL']

/** Does this man's passport qualify him for this nation (the Lions draw on the
 *  four home unions)? */
export function natQualifies(p: Player, nat: string): boolean {
  return nat === 'LIO' ? HOME4_Q.includes(p.nat) : p.nat === nat
}

/** The squad an AI federation would name for this nation right now: the best
 *  `size` qualified, home-based, fit, unloaned club players by ability. Ties
 *  break on id, the order Object.values already walks, so this is the same
 *  list the season engine's stable sort produces. */
/**
 * ---- A TEST SQUAD TRAVELS WITH ITS FRONT ROW (release QA after 1.8.16) ----
 *
 * The AI federations named their squads as the best `size` men by rating and
 * nothing else, so a nation could fly out with one hooker, or none. Measured
 * at kick-off over three seasons: 173 of 432 Test team sheets (40%) could not
 * cover the front row under Law 3, and the referee ordered uncontested scrums
 * in more than a third of the international game. A real Test squad carries
 * six to eight front-rowers.
 *
 * So the squad is still the best by rating, except that it is made to hold at
 * least `min` men for each of loosehead, hooker and tighthead (a man who can
 * play two counts for both), each added in rating order from the rest of the
 * pool in place of the lowest-rated man who is not a front-rower. No draw.
 */
export function withFrontRow(pool: Player[], size: number, min = 3): Player[] {
  const squad = pool.slice(0, size)
  const FR = ['LP', 'HK', 'TP'] as const
  const can = (p: Player, pos: string) => p.pos === pos || (p.alt as string[]).includes(pos)
  for (const pos of FR) {
    let have = squad.filter(p => can(p, pos)).length
    while (have < min) {
      const add = pool.find(p => !squad.includes(p) && can(p, pos))
      if (!add) break
      let drop = -1
      for (let i = squad.length - 1; i >= 0; i--) if (!FR.some(f => can(squad[i], f))) { drop = i; break }
      if (drop < 0) break
      squad.splice(drop, 1)
      squad.push(add)
      have++
    }
  }
  return squad
}

export function federationPick(state: GameState, nat: string, size: number): Player[] {
  return withFrontRow(Object.values(state.players)
    .filter(p => natQualifies(p, nat) && !!p.clubId && homeBased(state, p, nat) && !p.injury && !p.onLoan)
    .sort((a, b) => b.ca - a.ca || a.id - b.id), size)
}

/** The federation's list for this window: the snapshot taken when the window
 *  opened (state.natFed), because an AI federation picks once and then lives
 *  with it. A man who is hurt or healed mid-window does not move the quota or
 *  the club's duty. Falls back to a live federationPick when no snapshot
 *  exists (a save from before 9.10, or a coach appointed mid-window). */
export function federationList(state: GameState, nat: string, size: number): Player[] {
  const snap = state.natFed
  if (snap && snap.nat === nat) return snap.ids.map(id => state.players[id]).filter((p): p is Player => !!p)
  return federationPick(state, nat, size)
}

/** The club a national selection could serve: the user's club while he holds a
 *  Test job AND a club job, otherwise null. */
export function conflictedClub(state: GameState): string | null {
  if (!state.natTeam || state.unemployed) return null
  return state.clubs[state.userClubId] ? state.userClubId : null
}

/** Does `other` meet `mine` in any club competition this season? These are
 *  the clubs a national selection could weaken to the user's club's gain. */
export function sharesClubComp(state: GameState, mine: string, other: string): boolean {
  if (mine === other) return true
  const a = state.clubs[mine], b = state.clubs[other]
  if (!a || !b) return false
  if (a.leagueId && a.leagueId === b.leagueId) return true
  return Object.values(state.comps).some(c =>
    !c.isNational && c.teamIds.includes(mine) && c.teamIds.includes(other))
}

/** How many more of `clubId`'s men this camp may take: Infinity when no
 *  conflict applies to that club. `fedList` lets a caller asking about many
 *  men compute the federation's list once. */
export function clubQuotaLeft(state: GameState, nat: string, size: number, squad: number[], clubId: string,
  fedList?: Player[]): number {
  const mine = conflictedClub(state)
  if (!mine || !sharesClubComp(state, mine, clubId)) return Infinity
  const fed = (fedList ?? federationList(state, nat, size)).filter(p => p.clubId === clubId).length
  const inCamp = squad.filter(id => state.players[id]?.clubId === clubId).length
  return Math.max(0, fed - inCamp)
}

/** The user's own club's men the federation would take and who are not yet in
 *  camp: the ones his club must release, exactly as it would to an AI
 *  federation. Empty when he holds only one job. */
export function clubDutyOwed(state: GameState, nat: string, size: number, squad: number[]): Player[] {
  const mine = conflictedClub(state)
  if (!mine) return []
  const inCamp = new Set(squad)
  return federationList(state, nat, size).filter(p => p.clubId === mine && !inCamp.has(p.id) && !p.natSquad && !p.injury)
}

/** Release the user's club's due men into his camp (see above). Called once,
 *  when the window opens, which is when an AI federation names its squad, so
 *  a coach cannot shelter them by simply never naming them. Returns how many
 *  went in. */
export function releaseClubDuty(state: GameState, nat: string, size: number): number {
  const squad = state.natSquads[nat]
  if (!squad) return 0
  let n = 0
  for (const p of clubDutyOwed(state, nat, size, squad)) {
    if (squad.length >= size) break
    squad.push(p.id)
    p.natSquad = true
    p.morale = Math.max(1, Math.min(10, p.morale + 0.5)) // the proudest phone call in rugby
    n++
  }
  if (n && state.natLineup?.team === nat) state.natLineup = null
  return n
}
