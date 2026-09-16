// World drift over N seasons: rating inflation, tier convergence, wages, squads.
// argv: gender seed seasons. The bands this must hold are in scripts/releasesim.ts.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS, type GameState } from '../../src/game/model'
const gender = (process.argv[2] ?? 'm') as 'm' | 'w'
const seed = Number(process.argv[3] ?? 777)
const SEASONS = Number(process.argv[4] ?? 10)
const g: GameState = newGame(gender === 'w' ? 'w:bristol' : 'leicester', 'Drift', seed, undefined, 'coach', gender, gender)
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
function report(tag: string) {
  const ps = Object.values(g.players)
  const ca90 = ps.filter(p => p.ca >= 90).length, ca85 = ps.filter(p => p.ca >= 85).length
  const band = (lo: number, hi: number) => { const b = ps.filter(p => p.age >= lo && p.age <= hi); return b.length ? (b.reduce((s, p) => s + p.ca, 0) / b.length).toFixed(1) : '-' }
  const best: string[] = []
  for (const c of Object.values(g.comps)) {
    if (c.type !== 'league') continue
    let sum = 0, n = 0
    for (const cid of c.teamIds) {
      const club = g.clubs[cid]; if (!club) continue
      const top = club.players.map(id => g.players[id]).filter(p => p && !p.acad).sort((a, b) => b.ca - a.ca).slice(0, 15)
      if (top.length) { sum += top.reduce((s, p) => s + p.ca, 0) / top.length; n++ }
    }
    best.push(`${c.id}:${n ? (sum / n).toFixed(1) : '-'}`)
  }
  const seniors = Object.values(g.clubs).map(c => c.players.filter(id => g.players[id] && !g.players[id].acad).length)
  const wages = ps.filter(p => p.clubId && !p.acad).map(p => p.wage)
  console.log(`${tag}: players ${ps.length} ca90 ${ca90} ca85 ${ca85} | bands 17-20 ${band(17, 20)} 21-24 ${band(21, 24)} 25-29 ${band(25, 29)} 30-33 ${band(30, 33)} 34+ ${band(34, 60)} | seniors med ${median(seniors)} | wage med ${median(wages)} | bestXV ${best.join(' ')}`)
}
report(`${gender}/${seed} S0`)
for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1; let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    const fx = userFixtureThisWeek(g); if (fx) simMatch(g, fx, weekRng(g), true)
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
  }
  report(`${gender}/${seed} S${g.season}`)
}
