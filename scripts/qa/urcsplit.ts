import { newGame } from '../../src/game/newgame'
for (const [g, seed, lg] of [['m', 101, 'urc'], ['m', 202, 'urc'], ['w', 101, 'w:champ']] as const) {
  const s = newGame(g === 'w' ? 'w:bristol' : 'bath', 'x', seed, undefined, 'coach', g, g)
  const home: Record<string, number> = {}, away: Record<string, number> = {}
  for (const f of s.fixtures) if (f.compId === lg) { home[f.homeId] = (home[f.homeId] ?? 0) + 1; away[f.awayId] = (away[f.awayId] ?? 0) + 1 }
  const rows = Object.keys(home).map(id => `${id} ${home[id]}h/${away[id]}a`).filter(r => !/ (7|8)h\/(8|7)a| (9|10)h\/(10|9)a/.test(r))
  console.log(g, seed, lg, 'uneven clubs:', rows.join(', '))
}
