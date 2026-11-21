// WHO IS PLAYING, PRINTED (2.0.0 stage 2): builds a game the way
// tests/livepitch.test.ts does, asks worldFromMatch (src/game/sim/fromMatch.ts)
// for the user's first fixture, and prints what the simulation will be told:
// each side's strength at every contest at the kick-off and late on, the two
// fifteens, and ten sample picks from every picker. It also holds the two
// promises the World makes: the game it was given is untouched, and a man
// who has been carded is never picked while he is off.
//
//   npx vite-node scripts/simworld.ts [seed]
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'
import { worldFromMatch, type SimSide } from '../src/game/sim/fromMatch'
import type { Contest } from '../src/game/sim/world'

const seed = Number(process.argv[2] ?? 4242)
const g = newGame('leicester', 'T', seed)
let fx: Fixture | null | undefined = null
for (let i = 0; i < 12 && !fx; i++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
if (!fx) throw new Error('no fixture for the user in the first twelve weeks')

const before = JSON.stringify(g)
const rng = mulberry32(seed)
const { world, home, away } = worldFromMatch(g, fx, rng)
const untouched = JSON.stringify(g) === before

const sides: [SimSide, SimSide] = [home, away]
const nameOf = (s: 0 | 1, id: string) => {
  const p = sides[s].players.find(q => q.id === id)
  return p ? `${p.shirt}.${p.name.split(' ').slice(-1)[0]}` : id === '' ? '(nobody)' : `?${id}`
}

console.log(`seed ${seed}: ${home.name} v ${away.name} (${fx.compId}, week ${fx.week})`)
console.log(`the game handed over is ${untouched ? 'untouched' : 'CHANGED'}\n`)

const CONTESTS: Contest[] = ['carry', 'tackle', 'breakdown', 'handling', 'scrum', 'lineout', 'maul', 'kicking', 'aerial', 'goal', 'discipline']
console.log('strength      ' + [0, 1].map(s => `${sides[s].name.slice(0, 14).padEnd(14)} t=0   t=4000`).join('   '))
let lo = Infinity, hi = -Infinity
for (const c of CONTESTS) {
  const cells = ([0, 1] as const).map(s => {
    const a = world.str(s, c, 0), b = world.str(s, c, 4000)
    lo = Math.min(lo, a); hi = Math.max(hi, a)
    return `${''.padEnd(14)} ${a.toFixed(3)} ${b.toFixed(3)}`
  })
  console.log(c.padEnd(14) + cells.join('   '))
}
console.log('ruck with/without the ball at t=0: ' + ([0, 1] as const).map(s => `${world.ruck(s, true, 0).toFixed(3)}/${world.ruck(s, false, 0).toFixed(3)}`).join('   '))
console.log(`range at kick-off: ${lo.toFixed(3)} to ${hi.toFixed(3)}\n`)

for (const s of [0, 1] as const) {
  console.log(`${sides[s].name}: ` + sides[s].players.filter(p => p.shirt <= 15).map(p => `${p.shirt}.${p.name}`).join(', '))
  console.log(`  bench: ` + sides[s].players.filter(p => p.shirt > 15).map(p => `${p.shirt}.${p.name}`).join(', '))
}

const ten = (f: () => string) => Array.from({ length: 10 }, f).join(' ')
world.setClock(0)
for (const s of [0, 1] as const) {
  console.log(`\n${sides[s].name}, ten picks each`)
  console.log('  carrier tight  ' + ten(() => nameOf(s, world.carrier(s, false, rng))))
  console.log('  carrier wide   ' + ten(() => nameOf(s, world.carrier(s, true, rng))))
  console.log('  tacklers tight ' + ten(() => world.tacklers(s, false, rng).map(id => nameOf(s, id)).join('+')))
  console.log('  tacklers wide  ' + ten(() => world.tacklers(s, true, rng).map(id => nameOf(s, id)).join('+')))
  console.log('  jackal         ' + ten(() => nameOf(s, world.jackal(s, rng))))
  console.log('  kicker open    ' + ten(() => nameOf(s, world.kicker(s, false, rng))))
  console.log('  kicker box     ' + ten(() => nameOf(s, world.kicker(s, true, rng))))
  console.log('  catcher        ' + ten(() => nameOf(s, world.catcher(s, rng))))
  console.log('  jumper         ' + ten(() => nameOf(s, world.jumper(s, rng))))
  console.log('  forward        ' + ten(() => nameOf(s, world.forward(s, rng))))
  console.log(`  goal kicker ${nameOf(s, world.goalKicker(s))}, thrower ${nameOf(s, world.thrower(s))}`)
}

// THE BIN: card the home 7, 10 and 2 at t=1000 for ten minutes. Nobody may
// pick them until 1600, the fixed jobs pass to somebody else, and they are
// back after it.
const pid = (shirt: number) => home.players.find(p => p.shirt === shirt)!.id
const binned = [pid(7), pid(10), pid(2)]
for (const id of binned) world.carded!(0, id, 1600)
const picksAt = (t: number) => {
  world.str(0, 'carry', t)
  const got = new Set<string>()
  for (let i = 0; i < 400; i++) {
    for (const id of [world.carrier(0, false, rng), world.carrier(0, true, rng), ...world.tacklers(0, false, rng), ...world.tacklers(0, true, rng),
      world.jackal(0, rng), world.kicker(0, false, rng), world.kicker(0, true, rng), world.catcher(0, rng), world.jumper(0, rng), world.forward(0, rng),
      world.goalKicker(0), world.thrower(0)]) got.add(id)
  }
  return got
}
const during = picksAt(1300), after = picksAt(1601)
const leaked = binned.filter(id => during.has(id))
const back = binned.filter(id => after.has(id))
world.str(0, 'carry', 1300)
console.log(`\nthe bin: home 7, 10 and 2 off from 1000 to 1600`)
console.log(`  picked while off: ${leaked.length ? leaked.map(id => nameOf(0, id)).join(', ') + '  FAILED' : 'nobody'}`)
console.log(`  while off the goal kicker is ${nameOf(0, world.goalKicker(0))}, the thrower ${nameOf(0, world.thrower(0))}, the open-play kicker ${nameOf(0, world.kicker(0, false, rng))}`)
console.log(`  picked again after 1600: ${back.map(id => nameOf(0, id)).join(', ')}`)
if (!untouched || leaked.length || back.length !== 3) { console.log('\nSIMWORLD FAILED'); process.exit(1) }
console.log('\nSIMWORLD PASSED')
