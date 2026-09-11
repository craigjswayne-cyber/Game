/**
 * ---- A PAID JOB THAT EXISTS ----
 *
 * "Become an International Coach" is a paid product. In a women's career the
 * game runs a six-nation Northern Championship and a four-nation Southern
 * series - ten unions - while the product's list of countries is the men's
 * sixteen. Six of them therefore had no women's Test programme at all, and a
 * buyer could pay, be appointed head coach of South Africa, and never be given
 * a match, because no fixture in that world names his country.
 *
 * That is the worst class of store defect: real money for nothing. This holds
 * the fix in both worlds.
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { applyPinnacle } from '../src/game/grants'
import { pickableNations, testNationsIn, NAT_TIERS } from '../src/game/nations'
import { processWeekAndAdvance } from '../src/game/season'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const worlds: [string, GameState][] = [
  ['men', newGame('bath', 'Test', 4242)],
  ['women', newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Test', 4242, undefined, 'coach', 'w')],
]

for (const [label, g] of worlds) {
  const live = new Set(testNationsIn(g))
  const offered = pickableNations(g).map(([n]) => n)
  const orphans = offered.filter(n => !live.has(n))
  console.log(`\n--- the ${label}'s game: ${live.size} Test nations, ${offered.length} offered`)
  ok(orphans.length === 0,
    `every country the product offers plays Test rugby in this world${orphans.length ? ` - orphans: ${orphans.join(', ')}` : ''}`)
  ok(offered.length > 0, 'and the picker is never empty')
  ok(!offered.includes('LIO'), 'the touring invitational is not offered as a national job')
}

// the women's world must have lost exactly the six with no programme
const wOffered = pickableNations(worlds[1][1]).map(([n]) => n)
const dropped = NAT_TIERS.map(([n]) => n).filter(n => !wOffered.includes(n))
console.log(`\nnot offered in a women's career: ${dropped.join(', ') || 'none'}`)
ok(dropped.length > 0, 'the women\'s list really is shorter than the men\'s')
// SOUTH AFRICA USED TO BE THE EXAMPLE HERE, and the assertion was that it must
// NOT be offered, because a women's world with only the Northern Championship
// and the Southern Four had no fixture for it - the job would have been a desk
// and no matches. 1.5.8 gave the women's year an autumn and a summer window, so
// the Springboks and Japan play five Tests apiece and the job is real.
//
// The specific name was always standing in for the rule, so the rule is what is
// checked now: nobody is offered a country whose calendar is empty. That cannot
// go stale the way a hard-coded 'RSA' just did.
const thinnest = wOffered
  .map(n => ({ n, tests: worlds[1][1].fixtures.filter(f =>
    worlds[1][1].comps[f.compId]?.isNational && (f.homeId === n || f.awayId === n)).length }))
  .sort((a, b) => a.tests - b.tests)[0]
ok(thinnest.tests >= 3,
  `every women's job offered has a real programme behind it - the thinnest is ${thinnest.n} with ${thinnest.tests} Tests`)

// ---- and the job you DO buy comes with matches ----
for (const [label, g] of worlds) {
  const took = applyPinnacle(g)
  ok(took, `${label}: the product appoints a coach`)
  const nat = g.natTeam
  ok(!!nat, `${label}: and a country with it (${nat})`)
  const fx = g.fixtures.filter(f => f.homeId === nat || f.awayId === nat)
  ok(fx.length > 0, `${label}: with ${fx.length} Test${fx.length === 1 ? '' : 's'} on the fixture list`)
  for (let i = 0; i < 44; i++) processWeekAndAdvance(g)
  const played = g.fixtures.filter(f => (f.homeId === nat || f.awayId === nat) && f.played)
  ok(played.length > 0, `${label}: and ${played.length} of them actually played inside a season`)
}

console.log('')
if (fails === 0) console.log('NAT JOB PROBE PASSED: the paid job exists in both worlds, and it comes with matches')
else console.log(`NAT JOB PROBE FAILED (${fails})`)
process.exit(fails)
