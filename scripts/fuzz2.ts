// Engine fuzz v2: hostile inputs against every hook added since the last pass
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const g = newGame('leicester', 'Fuzz Gaffer', 1337)
const rng = mulberry32(0xf00d)
const clubs = Object.values(g.clubs)
let bad = 0
const check = (label: string, cond: boolean) => { if (!cond) { bad++; console.log(`FUZZ FAIL: ${label}`) } }

for (let i = 0; i < 400; i++) {
  const home = clubs[Math.floor(rng() * clubs.length)]
  const away = clubs[Math.floor(rng() * clubs.length)]
  if (home.id === away.id) continue
  // mutilate lineups in various ways
  const mode = i % 5
  if (mode === 1) home.tactic.lineup = home.tactic.lineup.map((id, k) => (k % 3 === 0 ? null : id))
  if (mode === 2) home.tactic.lineup = home.tactic.lineup.slice(0, 15).concat(new Array(8).fill(null))
  if (mode === 3) away.tactic.lineup = new Array(23).fill(null).map((_, k) => away.tactic.lineup[k] ?? null)
  if (mode === 4) {
    // extreme abilities
    for (const id of home.players.slice(0, 10)) { const p = g.players[id]; if (p) p.ca = 99 }
    for (const id of away.players.slice(0, 10)) { const p = g.players[id]; if (p) p.ca = 30 }
  }
  const fx = {
    id: g.nextId++, compId: i % 7 === 0 ? 'fr' : 'prem', round: 0, week: g.week,
    homeId: home.id, awayId: away.id, played: false,
    homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
    stage: i % 11 === 0 ? 'F' as const : undefined,
    testimonial: i % 13 === 0 ? (g.players[home.players[0]]?.id) : undefined,
  }
  try {
    simMatch(g, fx as any, rng, i % 3 === 0)
  } catch (e) {
    bad++
    console.log(`FUZZ EXCEPTION at i=${i} mode=${mode}: ${(e as Error).message}`)
    continue
  }
  check(`score NaN i=${i}`, Number.isFinite(fx.homeScore) && Number.isFinite(fx.awayScore))
  check(`score negative i=${i}`, fx.homeScore >= 0 && fx.awayScore >= 0)
  check(`score absurd i=${i}`, fx.homeScore <= 200 && fx.awayScore <= 200)
  check(`tries absurd i=${i}`, fx.homeTries <= 30 && fx.awayTries <= 30)
  check(`played flag i=${i}`, (fx as any).played === true)
}
// natrank bounds after nation fuzz
import { updateNatRank, seedNatRank } from '../src/game/natrank'
seedNatRank(g)
for (let i = 0; i < 300; i++) {
  const codes = Object.keys(g.natRank!)
  const a = codes[Math.floor(rng() * codes.length)]
  const b = codes[Math.floor(rng() * codes.length)]
  if (a === b) continue
  updateNatRank(g, { id: 0, compId: i % 2 ? 'wc' : 'sn', round: 0, week: 1, homeId: a, awayId: b, played: true, homeScore: Math.floor(rng() * 80), awayScore: Math.floor(rng() * 80), homeTries: 0, awayTries: 0, stage: i % 3 === 0 ? 'F' : undefined } as any)
}
for (const [c, v] of Object.entries(g.natRank!)) check(`natrank bounds ${c}=${v}`, v >= 40 && v <= 100)
console.log(bad === 0 ? 'FUZZ v2 PASSED: 400 hostile matches + 300 rank exchanges clean' : `FUZZ v2: ${bad} failures`)
