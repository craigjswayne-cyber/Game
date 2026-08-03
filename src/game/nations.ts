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

// Compact regen name pools per country (first names / surnames).
const N: Record<string, [string[], string[]]> = {
  ENG: [['Tom', 'Harry', 'George', 'Jack', 'Ollie', 'Ben', 'Sam', 'Charlie', 'Freddie', 'Alfie', 'Archie', 'Max'], ['Smith', 'Jones', 'Taylor', 'Brown', 'Cooper', 'Hill', 'Ward', 'Turner', 'Walker', 'Bell', 'Clark', 'Barnes']],
  FRA: [['Théo', 'Louis', 'Hugo', 'Jules', 'Mathis', 'Baptiste', 'Antoine', 'Romain', 'Paul', 'Léo', 'Nathan', 'Enzo'], ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Garcia', 'Roux', 'Fabre', 'Blanc', 'Marty', 'Cazes', 'Delmas']],
  IRE: [['Cian', 'Jack', 'Conor', 'Sean', 'Liam', 'Darragh', 'Fionn', 'Oisin', 'Rory', 'Eoin', 'Cathal', 'Tadhg'], ["O'Brien", 'Murphy', 'Kelly', 'Ryan', "O'Connor", 'Walsh', 'McCarthy', 'Byrne', "O'Sullivan", 'Doyle', 'Kennedy', 'Lynch']],
  SCO: [['Angus', 'Callum', 'Fraser', 'Hamish', 'Ewan', 'Finlay', 'Gregor', 'Rory', 'Blair', 'Cameron', 'Duncan', 'Craig'], ['MacDonald', 'Campbell', 'Stewart', 'Robertson', 'Fraser', 'Grant', 'Ross', 'Munro', 'Ferguson', 'Bruce', 'Watson', 'Hogg']],
  WAL: [['Dylan', 'Rhys', 'Owen', 'Ieuan', 'Gareth', 'Dafydd', 'Tomos', 'Elis', 'Osian', 'Morgan', 'Iestyn', 'Llyr'], ['Williams', 'Davies', 'Evans', 'Thomas', 'Jones', 'Rees', 'Morgan', 'Owens', 'Price', 'Jenkins', 'Lloyd', 'Hughes']],
  ITA: [['Marco', 'Luca', 'Matteo', 'Alessandro', 'Federico', 'Giovanni', 'Lorenzo', 'Tommaso', 'Riccardo', 'Davide', 'Paolo', 'Nicolo'], ['Rossi', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Ricci', 'Marino', 'Greco', 'Conti', 'Gallo', 'Lamaro', 'Fusco']],
  NZL: [['Kahu', 'Rieko', 'Caleb', 'Ethan', 'Josh', 'Liam', 'Quinn', 'Ruben', 'Tamati', 'Nikora', 'Beau', 'Finn'], ['Williams', 'Tuipulotu', 'Ioane', 'Taylor', 'Parata', 'Ngatai', 'Havili', 'Walker-Leawere', 'McKenzie', 'Christie', 'Ratima', 'Sititi']],
  AUS: [['Lachlan', 'Angus', 'Noah', 'Cooper', 'Hunter', 'Riley', 'Jack', 'Tom', 'Darcy', 'Fraser', 'Kalani', 'Taj'], ['Wilson', 'Kellaway', 'Gordon', 'Bell', 'Robertson', 'McReight', 'Tupou', 'Faessler', 'Lonergan', 'Hooper', 'Daugunu', 'Nasser']],
  RSA: [['Jaco', 'Ruan', 'Johan', 'Pieter', 'Thabo', 'Sipho', 'Lukhanyo', 'Damian', 'Franco', 'Hendrik', 'Wandile', 'Kwagga'], ['van der Merwe', 'Botha', 'du Plessis', 'Nel', 'Mbeki', 'Steyn', 'Kriel', 'Venter', 'Mostert', 'Nkosi', 'Fourie', 'Marx']],
  ARG: [['Santiago', 'Mateo', 'Joaquin', 'Tomas', 'Facundo', 'Bautista', 'Juan', 'Pedro', 'Gonzalo', 'Ignacio', 'Marcos', 'Lucio'], ['Fernandez', 'Gonzalez', 'Rodriguez', 'Lopez', 'Martinez', 'Garcia', 'Sanchez', 'Moroni', 'Petti', 'Isa', 'Carreras', 'Mallia']],
  FIJ: [['Waisea', 'Semi', 'Josua', 'Viliame', 'Jiuta', 'Peni', 'Iosefo', 'Samu', 'Tevita', 'Ratu', 'Apisai', 'Eroni'], ['Nayacalevu', 'Radradra', 'Tuisova', 'Mata', 'Ravouvou', 'Botitu', 'Masi', 'Kunavula', 'Tagitagivalu', 'Dolokoto', 'Ikanivere', 'Doge']],
  SAM: [['Iosua', 'Malo', 'Sione', 'Tavita', 'Penieli', 'Faalelei', 'Manu', 'Alofa', 'Petelo', 'Lemi'], ['Tuilagi', 'Faleali’i', 'Leiua', 'Taefu', 'Malolo', 'Seuteni', 'Alaalatoa', 'Fidow', 'Lam', 'Motu']],
  TGA: [['Sione', 'Taniela', 'Viliami', 'Malakai', 'Tevita', 'Fine', 'Halaleva', 'Kali', 'Semisi', 'Paula'], ['Tupou', 'Fifita', 'Havili', 'Taumalolo', 'Fekitoa', 'Piutau', 'Vailanu', 'Takulua', 'Ahki', 'Kaho']],
  JPN: [['Kenta', 'Yuto', 'Daiki', 'Ryota', 'Shota', 'Takeshi', 'Haruto', 'Kaito', 'Sora', 'Ren'], ['Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Saito', 'Matsuda', 'Inoue']],
  GEO: [['Giorgi', 'Levan', 'Davit', 'Luka', 'Nika', 'Irakli', 'Sandro', 'Beka', 'Vano', 'Tornike'], ['Lomidze', 'Kvirikashvili', 'Gorgadze', 'Abuladze', 'Tabutsadze', 'Sharikadze', 'Nariashvili', 'Mamukashvili', 'Chkhaidze', 'Javakhia']],
}

export function regenName(rng: () => number, nat: string): string {
  const pool = N[nat] ?? N.ENG
  const f = pool[0][Math.floor(rng() * pool[0].length)]
  const s = pool[1][Math.floor(rng() * pool[1].length)]
  return `${f} ${s}`
}
