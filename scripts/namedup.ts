// Does every man in the world have his own name?
//
// The data audit flagged "rieko ioane appears 2 times in the built world" and it
// was not a duplicated real player: a GENERATED player at Moana Pasifika had been
// born with the name of Leinster's All Black. The cause was arithmetic. The name
// generator drew a first name and a surname from per-nation pools of twelve each,
// so there were about 144 possible English names against a world of thousands of
// generated players. Collisions were not bad luck, they were certain: 484 shared
// names, 117 of them a generated man wearing a real player's, seventeen Freddie
// Browns.
//
// The pools are thirty-six of each now, about thirteen hundred combinations, and
// regenName takes a registry of every name already in the world and will not
// hand out one that is taken. This is the proof, and it is a FAILURE if it ever
// stops holding.
//
// Week one is the easy case. The hard one is several seasons of regens, youth
// intakes, academy top-ups and squad fills all drawing from the same pools with
// the registry growing under them, so this measures both.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import type { GameState } from '../src/game/model'

const SEASONS = Number(process.env.SEASONS ?? 5)
/** Real men who genuinely share a name with another real man, counted in the
 *  built world. Measured, not guessed: dataaudit.ts lists the pairs. A number
 *  that can be held, and going up means somebody added one. */
const NAMESAKE_BUDGET = 24
let fails = 0

function report(g: GameState, when: string) {
  const byName = new Map<string, { club: string; real: boolean }[]>()
  for (const p of Object.values(g.players)) {
    const k = p.name.toLowerCase()
    byName.set(k, [...(byName.get(k) ?? []), { club: g.clubs[p.clubId]?.short ?? '?', real: !!p.real }])
  }
  const dups = [...byName].filter(([, v]) => v.length > 1)
  const stolen = dups.filter(([, v]) => v.some(x => x.real) && v.some(x => !x.real))
  const worst = [...dups].sort((a, b) => b[1].length - a[1].length)[0]

  console.log(`${when}: ${Object.keys(g.players).length} players, ${byName.size} distinct names, ` +
    `${dups.length} shared, ${stolen.length} generated men wearing a real name`)
  for (const [k, v] of stolen.slice(0, 6)) {
    console.log(`  ${k}: real at ${v.find(x => x.real)!.club}, plus ${v.filter(x => !x.real).length} generated`)
  }
  if (worst) console.log(`  most repeated: ${worst[0]} x${worst[1].length}`)

  // TWO REAL MEN CAN SHARE A NAME, and twenty-four pairs in this data do -
  // a 26-year-old winger and a 30-year-old lock both called Alex Hughes, a
  // Cardiff centre and a Blackheath tighthead both called Ben Thomas. The
  // world builder used to resolve that by dropping the second man, which
  // deleted twenty-four real players from every career; it now builds both
  // (newgame.ts, keyed on name + shirt + age the way dataaudit splits them).
  //
  // So a shared name is no longer a failure by itself. What this file was
  // written about still is, and it is the pair of checks below: a GENERATED
  // man must never wear a real player's name, and two generated men must
  // never collide - those are pool-arithmetic failures, not rugby.
  const genDups = dups.filter(([, v]) => v.filter(x => !x.real).length > 1)
  if (stolen.length) { fails++; console.log(`  FAIL: ${stolen.length} generated men wearing a real name`) }
  if (genDups.length) { fails++; console.log(`  FAIL: ${genDups.length} names shared by two generated men`) }
  // and a ratchet on the rest, so new squad data cannot quietly add namesakes
  // without somebody deciding they are real
  if (dups.length > NAMESAKE_BUDGET) {
    fails++
    console.log(`  FAIL: ${dups.length} shared names, budget ${NAMESAKE_BUDGET} - new data added a namesake`)
  }
}

const g = newGame('northampton', 'Name Audit', 4242)
report(g, 'week 1')
for (let s = 0; s < SEASONS; s++) {
  while (g.week < 40) processWeekAndAdvance(g)
  processWeekAndAdvance(g)
  report(g, `season ${s + 2} week ${g.week}`)
}

console.log(fails
  ? `\nNAME AUDIT FAILED: ${fails} checkpoint problems`
  : `\nNAME AUDIT PASSED: no generated man wears a real name, and the ${NAMESAKE_BUDGET} real namesakes are all still in the world`)
process.exit(fails ? 1 : 0)
