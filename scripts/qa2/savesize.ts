// What a fifteen-season save is made of: bytes by top-level key, and by field
// across the players, so pruning goes where the weight is. A reporter.
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { SEASON_WEEKS } from '../../src/game/model'
const seasons = Number(process.argv[2] ?? 15)
const g = newGame('leicester', 'Size', 20260916)
for (let s = 0; s < seasons; s++) { const t = g.season + 1; let guard = 0; while (g.season < t && guard++ < SEASON_WEEKS + 5) processWeekAndAdvance(g) }
const total = JSON.stringify(g).length
console.log(`season ${g.season}: ${(total / 1048576).toFixed(2)} MB total`)
const byKey = Object.entries(g).map(([k, v]) => [k, JSON.stringify(v)?.length ?? 0] as const).sort((a, b) => b[1] - a[1])
for (const [k, n] of byKey.slice(0, 12)) console.log(`  ${k.padEnd(16)} ${(n / 1048576).toFixed(2)} MB  ${(100 * n / total).toFixed(0)}%`)
const players = Object.values(g.players)
const fields = new Map<string, number>()
for (const p of players) for (const [k, v] of Object.entries(p)) fields.set(k, (fields.get(k) ?? 0) + (JSON.stringify(v)?.length ?? 0) + k.length + 3)
console.log(`players: ${players.length}, ${(JSON.stringify(g.players).length / 1048576).toFixed(2)} MB; by field:`)
for (const [k, n] of [...fields].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${k.padEnd(14)} ${(n / 1048576).toFixed(2)} MB`)
const fx = g.fixtures
console.log(`fixtures: ${fx.length}, ${(JSON.stringify(fx).length / 1048576).toFixed(2)} MB; with events: ${fx.filter(f => (f as any).events?.length).length}`)
console.log(`news: ${g.news.length}, ${(JSON.stringify(g.news).length / 1024).toFixed(0)} KB`)
