// Which shirts are worn by made-up names, and who is already in them.
//
// The data audit says "clermont has 0 real FB, wants 1". That is the what; this
// is the working list. For every gap it prints the real men the club already
// has in that shirt, so a relocation can be chosen without guessing, and it
// prints the DONOR side too: a club that would drop below its own requirement if
// a man were taken from it. Moving somebody to fix one club and breaking another
// is the failure mode this exists to prevent - it has nearly happened twice.
//
// Usage:  npx vite-node scripts/gapreport.ts            every gap
//         npx vite-node scripts/gapreport.ts clermont   one club
//         npx vite-node scripts/gapreport.ts --donor Tevita Ratuva
//              what happens to the clubs that would lose him
import { LEAGUE_DEFS, newGame } from '../src/game/newgame'
import { POS_ORDER, type Player, type Pos } from '../src/game/model'

const NEED: [Pos, number][] = [
  ['LP', 2], ['HK', 2], ['TP', 2], ['LK', 3], ['FL', 3], ['N8', 1],
  ['SH', 2], ['FH', 2], ['CE', 3], ['WG', 3], ['FB', 1],
]

const defs = LEAGUE_DEFS()
const clubs = defs.flatMap(d => d.clubs.map(c => ({ ...c, league: d.short })))
const g = newGame('northampton', 'Gap Report', 4242)

// p.real is set at build time for every hand-written entry. Matching names
// against the files instead let a generated player with a colliding name count
// as real, and moved the totals at clubs nobody had edited.
const realSquad = (clubId: string): Player[] =>
  (g.clubs[clubId]?.players ?? [])
    .map(id => g.players[id])
    .filter((p): p is Player => !!p && !p.acad && !!p.real)

const coverOf = (players: Player[]) => {
  const by = new Map<string, number>()
  for (const p of players) {
    by.set(p.pos, (by.get(p.pos) ?? 0) + 1)
    for (const alt of p.alt ?? []) by.set(alt, (by.get(alt) ?? 0) + 0.5)
  }
  return by
}

const arg = process.argv.slice(2)
if (arg[0] === '--donor') {
  // Would taking this man leave his current club short?
  const name = arg.slice(1).join(' ').toLowerCase()
  const at = clubs.filter(c => c.players.some(p => p.name.toLowerCase() === name))
  if (!at.length) {
    console.log(`${name} is in no squad file - he would be an addition, not a relocation, and no club loses him`)
    process.exit(0)
  }
  for (const c of at) {
    const squad = realSquad(c.id)
    const him = squad.find(p => p.name.toLowerCase() === name)
    if (!him) { console.log(`${c.id} (${c.league}): lists him, but the builder placed him elsewhere already`); continue }
    const before = coverOf(squad)
    const after = coverOf(squad.filter(p => p !== him))
    const hurt: string[] = []
    for (const [pos, n] of NEED) {
      const a = after.get(pos) ?? 0
      if (a < n && (before.get(pos) ?? 0) >= n) hurt.push(`${pos} ${before.get(pos)} -> ${a} (wants ${n})`)
    }
    console.log(`${c.id} (${c.league}) loses ${him.name} [${him.pos}${him.alt?.length ? '/' + him.alt.join('/') : ''}]`)
    console.log(hurt.length ? `  OPENS A GAP: ${hurt.join(', ')}` : '  no new gap - safe to take him')
  }
  process.exit(0)
}

const only = arg[0]
let gaps = 0
for (const club of clubs) {
  if (only && club.id !== only) continue
  const squad = realSquad(club.id)
  const by = coverOf(squad)
  const short = NEED.filter(([pos, n]) => (by.get(pos) ?? 0) < n)
  if (!short.length) continue
  console.log(`\n${club.id} (${club.league}) - ${squad.length} real men of ${g.clubs[club.id]?.players.length ?? 0}`)
  for (const [pos, n] of short) {
    gaps++
    const have = squad.filter(p => p.pos === pos)
    const cov = squad.filter(p => (p.alt ?? []).includes(pos))
    console.log(`  ${pos}: ${by.get(pos) ?? 0} of ${n}`)
    for (const p of have) console.log(`     has  ${p.name} (${p.age}, ${p.nat}, ca ${p.ca})`)
    for (const p of cov) console.log(`     cover ${p.name} (${p.pos}, ${p.age})`)
  }
}
// where the shirt goes today, so the cost of leaving it is visible
console.log(`\n${gaps} gap${gaps === 1 ? '' : 's'} across ${clubs.filter(c => !only || c.id === only).length} clubs`)
if (!only) {
  const byLeague = new Map<string, number>()
  for (const club of clubs) {
    const by = coverOf(realSquad(club.id))
    const n = NEED.filter(([pos, need]) => (by.get(pos) ?? 0) < need).length
    if (n) byLeague.set(club.league, (byLeague.get(club.league) ?? 0) + n)
  }
  console.log('by league: ' + [...byLeague].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(', '))
  console.log(`(POS_ORDER is ${POS_ORDER.join('/')} - a .5 is a man whose second position covers the shirt)`)
}
