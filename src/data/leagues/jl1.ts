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
  wildknights: [{ name: 'Damian de Allende', pos: 'CE', age: 33, nat: 'RSA', q: 88, intl: true }],
  spears: [{ name: 'Malcolm Marx', pos: 'HK', age: 31, nat: 'RSA', q: 91, intl: true }],
}

/** JAPAN'S REAL INTERNATIONALS (owner, 1.9.16: "use real names to fill teams
 *  if you have that data"). Only 4 of Japan's 54 Test players of 2026 were in
 *  the world, because these squads are generated. Every man here is on the
 *  Nations Championship's own Japan squad page (read 20 Nov 2026) with this
 *  club and age; three clubs come from Japan's 9 Sep 2026 squad table where
 *  the page gave none. Each takes the generated man's place in the same shirt,
 *  so squads stay the same size. A prop's side is not in either source: they
 *  are split loosehead and tighthead by turn and are to be checked. */
const REAL: Record<string, RawPlayer[]> = {
  spears: [{ name: 'Yota Kamimori', pos: 'LP', age: 27, nat: 'JPN', q: 74, intl: true }, { name: 'Izi Sword', pos: 'TP', age: 25, nat: 'JPN', q: 71, intl: true }, { name: 'Keijiro Tamefusa', pos: 'LP', age: 25, nat: 'JPN', q: 77, intl: true }, { name: 'Hayate Era', pos: 'HK', age: 25, nat: 'JPN', q: 74, intl: true }, { name: 'Shinobu Fujiwara', pos: 'SH', age: 27, nat: 'JPN', q: 77, intl: true }, { name: 'Yuya Hirose', pos: 'CE', age: 25, nat: 'JPN', q: 74, intl: true }, { name: 'Haruto Kida', pos: 'WG', age: 27, nat: 'JPN', q: 71, intl: true }],
  canon: [{ name: 'Takato Okabe', pos: 'LP', age: 31, nat: 'JPN', q: 74, intl: true }, { name: 'Kippei Ishida', pos: 'WG', age: 26, nat: 'JPN', q: 74, intl: true }],
  sungoliath: [{ name: 'Shuhei Takeuchi', pos: 'TP', age: 28, nat: 'JPN', q: 80, intl: true }, { name: 'Harry Hockings', pos: 'LK', age: 28, nat: 'JPN', q: 74, intl: true }, { name: 'Kanji Shimokawa', pos: 'FL', age: 27, nat: 'JPN', q: 80, intl: true }],
  wildknights: [{ name: 'Kenji Sato', pos: 'HK', age: 23, nat: 'JPN', q: 77, intl: true }, { name: 'Jack Cornelsen', pos: 'LK', age: 32, nat: 'JPN', q: 80, intl: true }, { name: 'Ben Gunter', pos: 'FL', age: 29, nat: 'JPN', q: 77, intl: true }, { name: 'Dylan Riley', pos: 'CE', age: 29, nat: 'JPN', q: 80, intl: true }, { name: 'Tomoki Osada', pos: 'CE', age: 26, nat: 'JPN', q: 77, intl: true }],
  bravelupus: [{ name: 'Mike Stolberg', pos: 'LK', age: 34, nat: 'JPN', q: 74, intl: true }, { name: 'Takuro Matsunaga', pos: 'FB', age: 28, nat: 'JPN', q: 74, intl: true }],
  steelers: [{ name: 'Tiennan Costley', pos: 'FL', age: 26, nat: 'JPN', q: 77, intl: true }, { name: 'Itsuki Kamimura', pos: 'SH', age: 23, nat: 'JPN', q: 71, intl: true }, { name: 'Inoke Burua', pos: 'WG', age: 27, nat: 'JPN', q: 74, intl: true }, { name: 'Kazuma Ueda', pos: 'WG', age: 23, nat: 'JPN', q: 74, intl: true }, { name: 'Shunsuke Uenobo', pos: 'FB', age: 23, nat: 'JPN', q: 71, intl: true }],
  bluerevs: [{ name: 'Sam Greene', pos: 'FH', age: 32, nat: 'JPN', q: 74, intl: true, gk: true }],
  verblitz: [{ name: 'Shinya Komura', pos: 'FH', age: 24, nat: 'JPN', q: 74, intl: true, gk: true }],
  blackrams: [{ name: 'Yuki Ikeda', pos: 'CE', age: 31, nat: 'JPN', q: 71, intl: true }, { name: 'Taira Main', pos: 'WG', age: 26, nat: 'JPN', q: 71, intl: true }],
  drocks: [{ name: 'Samisoni Tua', pos: 'CE', age: 31, nat: 'JPN', q: 74, intl: true }],
  hondaheat: [{ name: 'Kanato Hirano', pos: 'LP', age: 26, nat: 'JPN', q: 71, intl: true }, { name: 'Sena Kimura', pos: 'TP', age: 27, nat: 'JPN', q: 74, intl: true }],
}

/** 1.9.16 CLUB AUDIT, MEN: JAPAN. The men of the 35 named for November 2026
 *  (RugbyPass, 26 Oct) whom the world still did not have, and two capped props
 *  outside that party. Same mechanism as REAL: each takes a generated man's
 *  shirt. Club and date of birth are the JRFU's own lists: the team sheets of
 *  23 Oct (v Fiji), 7 Nov (v Wales) and 14 Nov 2026 (v England) for Harada,
 *  Tokito, Botha, Ha'angana, Lawrence, Fukuda, Kitahara and Kihara; the 2026
 *  preliminary squad of 5 Feb 2026 for Iwaihara and Nezuka and the 11 Jun 2026
 *  squad note for Moriyama (no later club found for those three: assumed
 *  unmoved); Japan's 9 Sep 2026 squad table for Inaba. Positions and ages agree
 *  with the Nations Championship's Japan squad page (21 Nov 2026). A prop's
 *  side is in no source: Kihara wore 18 v Fiji so is a tighthead here, and
 *  Iwaihara and Inaba are to be checked. q is this audit's judgement on the
 *  scale REAL uses. Uncapped before the autumn: Kitahara, Tokito, Moriyama.
 *  Not here because their side is not in the game: Sojiro Otsuka (Kwansei
 *  Gakuin University) and Jisu Lee (Korea University).
 *  docs/research/club-audit-1916.md has the trail. */
const REAL_AUDIT: Record<string, RawPlayer[]> = {
  bravelupus: [{ name: 'Mamoru Harada', pos: 'HK', age: 27, nat: 'JPN', q: 77, intl: true }, { name: 'Riku Tokito', pos: 'WG', age: 23, nat: 'JPN', q: 71 }],
  spears: [{ name: 'Ruan Botha', pos: 'LK', age: 34, nat: 'JPN', q: 74, intl: true }, { name: 'Koga Nezuka', pos: 'WG', age: 28, nat: 'JPN', q: 71, intl: true }],
  canon: [{ name: 'Ryosuke Iwaihara', pos: 'TP', alt: ['LP'], age: 30, nat: 'JPN', q: 71, intl: true }],
  drocks: [{ name: "Esei Ha'angana", pos: 'LK', alt: ['FL'], age: 27, nat: 'JPN', q: 71, intl: true }, { name: 'Miu Austin Moriyama', pos: 'FL', age: 23, nat: 'JPN', q: 68 }],
  hondaheat: [{ name: 'Kenta Fukuda', pos: 'SH', age: 29, nat: 'JPN', q: 74, intl: true }, { name: 'Riku Kitahara', pos: 'FH', age: 27, nat: 'JPN', q: 71 }],
  dynaboars: [{ name: 'Charlie Lawrence', pos: 'CE', age: 28, nat: 'JPN', q: 74, intl: true }],
  sungoliath: [{ name: 'Sanshiro Kihara', pos: 'TP', alt: ['LP'], age: 23, nat: 'JPN', q: 68, intl: true }],
  bluerevs: [{ name: 'Takumi Inaba', pos: 'LP', alt: ['TP'], age: 24, nat: 'JPN', q: 71, intl: true }],
}

// one name per man across the whole competition: a duplicate would cost the
// second club a real shirt, since the world builder keeps only the first
// Real men added by hand elsewhere (additions.ts) are reserved too: the pools
// mix real surnames with common first names, and drew the real Wild Knights
// hooker's name for a 21-year-old Sungoliath prop (round 3, 19 Oct 2026).
const usedNames = new Set<string>(['Atsushi Sakate'])

function genSquad(clubId: string, rep: number): RawPlayer[] {
  const rng = mulberry32(0xa11e ^ clubId.split('').reduce((h, c) => (h * 33 + c.charCodeAt(0)) | 0, 5381))
  const real = [...(REAL[clubId] ?? []), ...(REAL_AUDIT[clubId] ?? [])]
  const out: RawPlayer[] = [...(STARS[clubId] ?? []), ...real]
  for (const p of out) usedNames.add(p.name)
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
      if (!usedNames.has(name)) break
    }
    usedNames.add(name)
    const age = 20 + Math.floor(rng() * 13)
    let q = Math.round(rep - 8 + rng() * 15) + (isImport ? 5 : 0)
    q = Math.max(48, Math.min(84, q))
    const gk = (pos === 'FH' || pos === 'FB') && gkGiven < 2 && rng() < 0.5
    if (gk) gkGiven++
    // a real international takes this shirt: the generated man is still
    // drawn (so every other name in the league stays as it was) and dropped
    const taken = real.findIndex(r => r.pos === pos)
    if (taken >= 0) { real.splice(taken, 1); continue }
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
  club('wildknights', 'Saitama RFC', 'Saitama', 'Kumagaya', 'Kumagaya Rugby Stadium', 24000, ['#123a7a', '#f2c200'], 84, 3_200_000),
  club('bravelupus', 'Fuchu RFC', 'Fuchu', 'Fuchu', 'Fuchu Stadium', 49970, ['#c0392f', '#0e0e0e'], 83, 3_000_000),
  club('sungoliath', 'Tokyo RFC', 'Tokyo', 'Fuchu', 'Aoyama Rugby Ground', 24871, ['#f2c200', '#0e0e0e'], 82, 3_000_000),
  club('spears', 'Funabashi RFC', 'Funabashi', 'Funabashi', 'Funabashi Stadium', 7000, ['#c02f3a', '#12295c'], 80, 2_600_000),
  club('canon', 'Yokohama RFC', 'Yokohama', 'Yokohama', 'Mitsuzawa Stadium', 15046, ['#c0392f', '#ffffff'], 78, 2_400_000),
  club('verblitz', 'Mikawa RFC', 'Mikawa', 'Toyota', 'Mikawa Stadium', 45000, ['#a31207', '#0e0e0e'], 77, 2_400_000),
  club('steelers', 'Kobe RFC', 'Kobe', 'Kobe', 'Port Kobe Stadium', 30132, ['#7a0c2e', '#0e0e0e'], 75, 2_000_000),
  club('bluerevs', 'Shizuoka RFC', 'Shizuoka', 'Iwata', 'Iwata Stadium', 15165, ['#1e5aa8', '#ffffff'], 72, 1_600_000),
  club('blackrams', 'Setagaya RFC', 'Setagaya', 'Setagaya', 'Komazawa Stadium', 20010, ['#0e0e0e', '#ffffff'], 71, 1_500_000),
  club('dynaboars', 'Sagamihara RFC', 'Sagamihara', 'Sagamihara', 'Sagamihara Stadium', 15300, ['#7a1027', '#9aa5ad'], 70, 1_400_000),
  club('drocks', 'Urayasu RFC', 'Urayasu', 'Urayasu', 'Urayasu Stadium', 5000, ['#12295c', '#8fc1e3'], 69, 1_300_000),
  // Tochigi Honda Heat from 2026-27: the club moved from Suzuka to Utsunomiya in
  // September 2026 (Honda, 18 Jun 2026) and plays at Tochigi Green Stadium
  club('hondaheat', 'Tochigi RFC', 'Tochigi', 'Utsunomiya', 'Tochigi Greenfield Stadium', 15500, ['#c0392f', '#f0eadc'], 68, 1_200_000),
]
