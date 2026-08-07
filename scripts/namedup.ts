// Does every man in the world have his own name?
//
// The data audit flagged "rieko ioane appears 2 times in the built world" and it
// was not a duplicated real player: a GENERATED player at Moana Pasifika had been
// born with the name of Leinster's All Black. The cause is arithmetic. The name
// generator draws a first name and a surname from per-nation pools of twelve
// each, so there are about 144 possible English names, and the world holds
// thousands of generated players. Collisions are not bad luck, they are certain.
//
// newgame does try: one call site retries up to ten times against the names it
// has already used. With 144 combinations and hundreds already taken, ten tries
// is not enough, and the academy and rollover generators do not try at all.
//
// This measures the damage rather than guessing at it. The number that matters is
// the last one: a generated player wearing a real man's name is the one a manager
// notices, because he can search for Tomos Williams and find two of him.
import { newGame } from '../src/game/newgame'

const g = newGame('northampton', 'Name Audit', 4242)
const byName = new Map<string, { club: string; real: boolean }[]>()
for (const p of Object.values(g.players)) {
  const k = p.name.toLowerCase()
  byName.set(k, [...(byName.get(k) ?? []), { club: g.clubs[p.clubId]?.short ?? '?', real: !!p.real }])
}
const dups = [...byName].filter(([, v]) => v.length > 1)
const stolen = dups.filter(([, v]) => v.some(x => x.real) && v.some(x => !x.real))
const worst = [...dups].sort((a, b) => b[1].length - a[1].length).slice(0, 5)

console.log(`${Object.keys(g.players).length} players, ${byName.size} distinct names`)
console.log(`names held by more than one man: ${dups.length}`)
console.log(`generated players wearing a real man's name: ${stolen.length}`)
for (const [k, v] of stolen.slice(0, 10)) {
  const real = v.find(x => x.real)!
  console.log(`  ${k}: real at ${real.club}, also ${v.filter(x => !x.real).length} generated`)
}
console.log('most repeated: ' + worst.map(([k, v]) => `${k} x${v.length}`).join(', '))
