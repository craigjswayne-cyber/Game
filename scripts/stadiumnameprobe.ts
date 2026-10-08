/**
 * ---- THE GROUND KEEPS ITS NAME ACROSS A RELOAD (1.8.15) ----
 *
 * Found by a save/reload torture run: a new career at Gloucester kept its
 * traditional ground name, Kinshome, as seedDeals intends, and the first
 * reload renamed it "Ravensbank Stadium at Kinshome" - the load heal for
 * signed naming deals treated the inherited sponsor as signed. The same career
 * then read two grounds either side of a save, in the news and on every gate.
 *
 *   1. a traditional name survives a reload, and a second one
 *   2. a ground that ships with its sponsor keeps that sponsor
 *   3. a save from before the flag heals the same way
 *   4. a naming deal the manager actually signed still goes over the gates
 *      when an old save has them in disagreement (the heal's real job)
 *
 * Run: npx vite-node scripts/stadiumnameprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const reload = <T,>(g: T): T => migrate(structuredClone(g) as any) as T

// 1
const g = newGame('gloucester', 'Ground', 21)
const name = g.clubs.gloucester.stadium
const once = reload(g), twice = reload(once)
ok(once.clubs.gloucester.stadium === name && twice.clubs.gloucester.stadium === name, `Gloucester's ground is "${name}" before and after two reloads ("${twice.clubs.gloucester.stadium}")`)
ok(!!g.deals?.naming?.keepName, 'the inherited naming deal on a traditional name is marked to keep it')

// 2
const n = newGame('northampton', 'Ground', 22)
const nName = n.clubs.northampton.stadium
ok(reload(n).clubs.northampton.stadium === nName, `a ground that ships with its sponsor keeps it ("${nName}")`)

// 3
const legacy = structuredClone(g)
delete (legacy.deals!.naming as any).keepName
ok(reload(legacy).clubs.gloucester.stadium === name, 'a save from before the flag keeps the traditional name too')

// 4
const signed = structuredClone(g)
signed.deals!.naming = { ...signed.deals!.naming!, sponsor: 'Brightwater', keepName: undefined, from: 1, until: 3 }
signed.season = 1
const healed = reload(signed)
ok(healed.clubs.gloucester.stadium.startsWith('Brightwater'), `a signed naming deal still goes over the gates on load ("${healed.clubs.gloucester.stadium}")`)

console.log(fails ? `STADIUM NAME PROBE FAILED (${fails})` : 'STADIUM NAME PROBE PASSED: the ground is the same ground either side of a save')
process.exit(fails ? 1 : 0)
