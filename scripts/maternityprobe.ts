/**
 * ---- NOT ON A REAL WOMAN'S NAME ----
 *
 * The owner asked for maternity leave and fenced it in the same breath: "for
 * maternity this isnt something for everyone - make sure this is only on
 * fictional players."
 *
 * That fence is not a preference and it is not a balance decision. Every named
 * player in this game is a living person - 1,339 of them across the women's
 * leagues, off the owner's own squad sheets and club pages. A pregnancy the
 * game invented, printed in an inbox next to a real woman's name, is a private
 * life event invented about a real individual. No amount of simulation realism
 * buys that back.
 *
 * src/game/gender.ts puts the gate in one function. This is the proof that the
 * gate holds over ten seasons of play, which is the only version of the promise
 * worth making: a rule nothing checks is a rule until somebody edits the file.
 *
 * It also checks the parts that make the status worth having at all - that a
 * player on leave is unavailable, that her contract does not run down while she
 * is away, and that she comes back.
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { availablePlayers } from '../src/game/matchEngine'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEASONS = 10
const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const g = newGame(wClub, 'Test', 8191, undefined, 'coach', 'normal', 'w')

/** Every player who has ever been granted leave, and whether she is real. */
const granted = new Map<number, { name: string; real: boolean }>()
let everUnavailable = 0
let contractHeld = 0
let returned = 0
const contractAt = new Map<number, number>()

for (let s = 0; s < SEASONS; s++) {
  for (let i = 0; i < SEASON_WEEKS; i++) {
    processWeekAndAdvance(g)
    for (const p of Object.values(g.players)) {
      if (p.maternity) {
        if (!granted.has(p.id)) {
          granted.set(p.id, { name: p.name, real: !!p.real })
          contractAt.set(p.id, p.contractEnds)
        }
        // unavailable while away: she must not appear in a selectable pool
        const club = g.clubs[p.clubId ?? '']
        if (club && !availablePlayers(g, club.players).some(x => x.id === p.id)) everUnavailable++
      } else if (granted.has(p.id) && contractAt.has(p.id)) {
        returned++
        contractAt.delete(p.id)
      }
    }
  }
}

console.log(`\n${SEASONS} seasons of a women's world: ${granted.size} players took maternity leave`)

const real = [...granted.values()].filter(x => x.real)
ok(real.length === 0,
  `not one of them is a real player${real.length ? ` - found ${real.slice(0, 5).map(x => x.name).join(', ')}` : ''}`)
ok(granted.size > 0, 'and the status is actually reachable (it fires at all)')
ok(everUnavailable > 0, 'a player on leave is unavailable for selection')
ok(returned > 0, `and she comes back (${returned} returns)`)

// the contract clock: a season rolling over while she is away must push the
// deal out rather than spend a year she did not play
const m = newGame(wClub, 'Test', 4242, undefined, 'coach', 'normal', 'w')
const victim = Object.values(m.players).find(p => !p.real && p.clubId && p.age >= 23 && p.age <= 37)!
victim.maternity = { until: m.week + 200, from: m.week }
const before = victim.contractEnds
const beforeSeason = m.season
for (let i = 0; i < SEASON_WEEKS + 2; i++) processWeekAndAdvance(m)
const seasonsPassed = m.season - beforeSeason
ok(seasonsPassed >= 1, `a season rolled over while she was away (${seasonsPassed})`)
ok(victim.contractEnds >= before + seasonsPassed,
  `her contract was pushed out rather than run down (${before} -> ${victim.contractEnds}, ${seasonsPassed} season(s) missed)`)

// and none of this exists in the men's game
const men = newGame('bath', 'Test', 8191)
for (let i = 0; i < SEASON_WEEKS; i++) processWeekAndAdvance(men)
ok(!Object.values(men.players).some(p => p.maternity),
  'no player in the men\'s game is ever given the status')

console.log('')
if (fails === 0) console.log('MATERNITY PROBE PASSED: only invented players, and the leave behaves like leave')
else console.log(`MATERNITY PROBE FAILED (${fails})`)
process.exit(fails)
