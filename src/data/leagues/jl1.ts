// Japan Rugby League One, Division 1 - real clubs, grounds and colours.
// Squads are generated (Japanese core + southern-hemisphere imports),
// anchored by the marquee world stars who really play there.

import type { Pos, RawClub, RawPlayer } from '../types'
import { mulberry32 } from '../../game/rng'

const JP_FIRST = ['Kenta', 'Yuto', 'Daiki', 'Ryota', 'Shota', 'Takeshi', 'Haruto', 'Kaito', 'Sora', 'Ren', 'Kazuki', 'Naoto', 'Shun', 'Taiga', 'Hayato', 'Riku', 'Yudai', 'Keita', 'Atsushi', 'Kotaro']
const JP_LAST = ['Tanaka', 'Suzuki', 'Sato', 'Watanabe', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Saito', 'Matsuda', 'Inoue', 'Fukuoka', 'Matsushima', 'Himeno', 'Sakate', 'Naikabula', 'Ogawa', 'Takahashi', 'Yamada', 'Hoshino', 'Kimura']
const IMP_FIRST = ['Jed', 'Kurt', 'Shannon', 'Dylan', 'Brodie', 'Aidan', 'Marika', 'Tevita', 'Willem', 'Ruan', 'Sione', 'Josh']
const IMP_LAST = ['Brown', 'Coleman', 'Frizell', 'Riley', 'McAlister', 'Burger', 'Vunipola', 'Nadolo', 'Kruger', 'Havieta', 'Thompson', 'Fakatava']

const TEMPLATE: Pos[] = [
  'LP', 'LP', 'HK', 'HK', 'TP', 'TP',
  'LK', 'LK', 'LK', 'FL', 'FL', 'FL', 'N8', 'N8',
  'SH', 'SH', 'FH', 'FH', 'CE', 'CE', 'CE',
  'WG', 'WG', 'WG', 'FB', 'FB',
  'FL', 'CE', 'LP',
]

/** The marquee imports who genuinely play in League One. */
const STARS: Record<string, RawPlayer[]> = {
  bravelupus: [{ name: 'Richie Mo\'unga', pos: 'FH', age: 31, nat: 'NZL', q: 92, gk: true, intl: true }],
  canon: [{ name: 'Faf de Klerk', pos: 'SH', age: 33, nat: 'RSA', q: 87, intl: true }],
  sungoliath: [{ name: 'Cheslin Kolbe', pos: 'WG', age: 31, nat: 'RSA', q: 90, intl: true }],
  wildknights: [{ name: 'Damian de Allende', pos: 'CE', age: 33, nat: 'RSA', q: 87, intl: true }],
  spears: [{ name: 'Malcolm Marx', pos: 'HK', age: 31, nat: 'RSA', q: 91, intl: true }],
}

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0xa11e ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const used = new Set<string>()
  const out: RawPlayer[] = [...(STARS[clubId] ?? [])]
  for (const p of out) used.add(p.name)
  let gkGiven = out.some(p => p.gk) ? 1 : 0
  let imports = out.length
  for (const pos of TEMPLATE) {
    const isImport = imports < 6 && rng() < 0.2
    if (isImport) imports++
    const F = isImport ? IMP_FIRST : JP_FIRST
    const L = isImport ? IMP_LAST : JP_LAST
    let name = ''
    for (let tries = 0; tries < 20; tries++) {
      name = `${F[Math.floor(rng() * F.length)]} ${L[Math.floor(rng() * L.length)]}`
      if (!used.has(name)) break
    }
    used.add(name)
    const age = 20 + Math.floor(rng() * 13)
    let q = Math.round(rep - 8 + rng() * 15) + (isImport ? 5 : 0)
    q = Math.max(48, Math.min(84, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.5
    if (gk) gkGiven++
    out.push({ name, pos, age, nat: isImport ? (['NZL', 'AUS', 'RSA', 'TGA', 'FIJ'] as const)[Math.floor(rng() * 5)] : 'JPN', q, gk })
  }
  return out
}

const club = (
  id: string, name: string, short: string, city: string, stadium: string,
  capacity: number, colors: [string, string], rep: number, budget: number,
): RawClub => ({
  id, name, short, city, country: 'JPN', stadium, capacity, colors, rep, budget,
  players: genSquad(id, rep),
})

export const JL1: RawClub[] = [
  club('wildknights', 'Saitama Wild Knights', 'Wild Knights', 'Kumagaya', 'Kumagaya Rugby Stadium', 24000, ['#123a7a', '#f2c200'], 84, 3_200_000),
  club('bravelupus', 'Toshiba Brave Lupus Tokyo', 'Brave Lupus', 'Fuchu', 'Ajinomoto Stadium', 49970, ['#c0392f', '#0e0e0e'], 83, 3_000_000),
  club('sungoliath', 'Tokyo Sungoliath', 'Sungoliath', 'Fuchu', 'Chichibunomiya Stadium', 24871, ['#f2c200', '#0e0e0e'], 82, 3_000_000),
  club('spears', 'Kubota Spears Funabashi', 'Spears', 'Funabashi', 'Kubota Spears Stadium', 7000, ['#c02f3a', '#12295c'], 80, 2_600_000),
  club('canon', 'Yokohama Canon Eagles', 'Canon Eagles', 'Yokohama', 'Nippatsu Mitsuzawa Stadium', 15046, ['#c0392f', '#ffffff'], 78, 2_400_000),
  club('verblitz', 'Toyota Verblitz', 'Verblitz', 'Toyota', 'Toyota Stadium', 45000, ['#a31207', '#0e0e0e'], 77, 2_400_000),
  club('steelers', 'Kobelco Kobe Steelers', 'Steelers', 'Kobe', 'Noevir Stadium Kobe', 30132, ['#7a0c2e', '#0e0e0e'], 75, 2_000_000),
  club('bluerevs', 'Shizuoka Blue Revs', 'Blue Revs', 'Iwata', 'Yamaha Stadium', 15165, ['#1e5aa8', '#ffffff'], 72, 1_600_000),
  club('blackrams', 'Black Rams Tokyo', 'Black Rams', 'Setagaya', 'Komazawa Stadium', 20010, ['#0e0e0e', '#ffffff'], 71, 1_500_000),
  club('dynaboars', 'Mitsubishi Dynaboars', 'Dynaboars', 'Sagamihara', 'Sagamihara Gion Stadium', 15300, ['#7a1027', '#9aa5ad'], 70, 1_400_000),
  club('drocks', 'Urayasu D-Rocks', 'D-Rocks', 'Urayasu', 'Urayasu Stadium', 5000, ['#12295c', '#8fc1e3'], 69, 1_300_000),
  club('hondaheat', 'Mie Honda Heat', 'Honda Heat', 'Suzuka', 'Suzuka Sports Garden', 5600, ['#c0392f', '#f0eadc'], 68, 1_200_000),
]
