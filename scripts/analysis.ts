// Deep analysis: star players, team values, rating distribution sanity.
import { newGame } from '../src/game/newgame'
import { starPlayerIds, squadValue } from '../src/game/analysis'
import { fmtMoney } from '../src/game/model'

const g = newGame('leicester', 'Analyst', 42)

// top 30 players in the world
const all = Object.values(g.players).sort((a, b) => b.ca - a.ca)
console.log('=== TOP 30 PLAYERS IN THE WORLD ===')
for (const p of all.slice(0, 30)) {
  console.log(`${String(p.ca).padStart(2)}  ${p.name.padEnd(26)} ${p.pos.padEnd(3)} ${p.nat}  ${(p.clubId ? g.clubs[p.clubId].short : 'FA').padEnd(12)} ${fmtMoney(p.value)}`)
}

// team values by league
console.log('\n=== SQUAD VALUES BY LEAGUE (top table) ===')
const clubs = Object.values(g.clubs)
  .map(c => ({ c, v: squadValue(g, c.id), stars: [...starPlayerIds(g, c.id)].map(id => g.players[id].name) }))
  .sort((a, b) => b.v - a.v)
for (const { c, v, stars } of clubs) {
  console.log(`${fmtMoney(v).padStart(7)}  ${c.short.padEnd(13)} (${c.leagueId.padEnd(5)}) rep ${c.rep}  ⭐ ${stars.join(', ')}`)
}

// rating distribution
const bands = [0, 0, 0, 0, 0, 0]
for (const p of all) {
  if (p.ca >= 90) bands[0]++
  else if (p.ca >= 85) bands[1]++
  else if (p.ca >= 80) bands[2]++
  else if (p.ca >= 70) bands[3]++
  else if (p.ca >= 60) bands[4]++
  else bands[5]++
}
console.log('\n=== ABILITY DISTRIBUTION ===')
console.log(`90+: ${bands[0]}  85-89: ${bands[1]}  80-84: ${bands[2]}  70-79: ${bands[3]}  60-69: ${bands[4]}  <60: ${bands[5]}  total ${all.length}`)
