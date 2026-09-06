/**
 * ---- THE TWO GAMES NEVER MEET ----
 *
 * Owner, 6 Sep 2026: "THERE IS NO CROSS WITH ANY OF THE MENS TEAMS, THEY MUST
 * STAY SEPERATE IN THE GAME."
 *
 * src/game/gender.ts makes that a property of the save rather than a filter in
 * the engine: a save holds one world and a world has one gender, so the men's
 * clubs are not hidden from a women's career, they were never built. That is a
 * strong design and it has exactly three seams, all of them places that rebuild
 * a world from a save rather than from a new game:
 *
 *   1. newGame(..., gender)      - builds the world in the first place
 *   2. save.ts migrate()         - INJECTS any league the build knows and the
 *                                  save lacks, which is how a v1.1 career gained
 *                                  Japan. Without the gender argument it would
 *                                  pour all fifty-two men's clubs into a women's
 *                                  career the first time it was loaded.
 *   3. rollover.ts               - rebuilds every competition each August. Without
 *                                  the argument a women's career's leagues would
 *                                  be replaced by the men's ones in season two.
 *
 * Seams 2 and 3 are the dangerous ones because neither would throw. The save
 * would simply be wrong, on somebody's phone, unrepairable. So this probe does
 * not check that the code passes an argument - it checks the OUTCOME, by
 * driving all three and reading every id in the resulting world.
 *
 * The assertion is blunt on purpose: after each step, every club id, every
 * competition id and every club's leagueId in a women's save starts with 'w:',
 * and none in a men's save does.
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import { genderOf, isWomensId, type Gender } from '../src/game/gender'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

/** Every id a world exposes, with where it came from, so a failure names the
 *  offender rather than just the count. */
function strayIds(s: GameState, g: Gender): string[] {
  const want = g === 'w'
  const bad: string[] = []
  for (const id of Object.keys(s.clubs)) {
    if (isWomensId(id) !== want) bad.push(`club ${id}`)
  }
  for (const id of Object.keys(s.comps)) {
    if (isWomensId(id) !== want) bad.push(`comp ${id}`)
  }
  for (const c of Object.values(s.clubs)) {
    if (c.leagueId && isWomensId(c.leagueId) !== want) bad.push(`${c.id} plays in ${c.leagueId}`)
  }
  for (const f of s.fixtures) {
    if (f.compId && f.compId !== 'fr' && isWomensId(f.compId) !== want) bad.push(`fixture in ${f.compId}`)
  }
  return bad
}

const report = (s: GameState, g: Gender, when: string) => {
  const bad = strayIds(s, g)
  ok(bad.length === 0, `${when}: every id belongs to the ${g === 'w' ? "women's" : "men's"} game${bad.length ? ` - found ${bad.length}: ${bad.slice(0, 4).join(', ')}` : ''}`)
}

console.log('=== the league tables are separate sets ===')
const mIds = new Set(LEAGUE_DEFS('m').flatMap(d => d.clubs.map(c => c.id)))
const wIds = new Set(LEAGUE_DEFS('w').flatMap(d => d.clubs.map(c => c.id)))
const shared = [...mIds].filter(id => wIds.has(id))
ok(shared.length === 0, `no club id is in both games (${mIds.size} men's, ${wIds.size} women's, ${shared.length} shared)`)
ok([...wIds].every(isWomensId), 'every women\'s club id carries the w: prefix')
ok(![...mIds].some(isWomensId), 'no men\'s club id carries it')
ok(LEAGUE_DEFS('w').length > 0, `the women's game has competitions (${LEAGUE_DEFS('w').length})`)

console.log('\n=== seam 1: a world built by newGame ===')
const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const w = newGame(wClub, 'Test', 4242, undefined, 'coach', 'normal', 'w')
ok(genderOf(w) === 'w', 'the save says which game it is in')
ok(!!w.clubs[wClub], `the user's club is in the world (${w.clubs[wClub]?.name})`)
report(w, 'w', 'fresh women\'s world')
console.log(`  built ${Object.keys(w.clubs).length} clubs, ${Object.keys(w.players).length} players, ${Object.keys(w.comps).length} competitions`)

const m = newGame('bath', 'Test', 4242)
ok(genderOf(m) === 'm', 'a men\'s save defaults to the men\'s game')
report(m, 'm', 'fresh men\'s world')

console.log('\n=== seam 2: loading the save through migrate() ===')
// This is the one that would pour fifty-two men's clubs into a women's career.
const wBefore = Object.keys(w.clubs).length
const wLoaded = migrate(JSON.parse(JSON.stringify(w)) as GameState)
ok(Object.keys(wLoaded.clubs).length === wBefore,
  `loading a women's save adds no clubs (${wBefore} before, ${Object.keys(wLoaded.clubs).length} after)`)
report(wLoaded, 'w', 'women\'s save after migrate')

// and the same load must still heal a men's career, which is what it is FOR
const mLoaded = migrate(JSON.parse(JSON.stringify(m)) as GameState)
report(mLoaded, 'm', 'men\'s save after migrate')

console.log('\n=== a career started before v1.5 is a men\'s career ===')
const old = JSON.parse(JSON.stringify(m)) as GameState
delete (old as { gender?: unknown }).gender
ok(genderOf(old) === 'm', 'a save with no gender field reads as the men\'s game')
const oldLoaded = migrate(old)
report(oldLoaded, 'm', 'pre-v1.5 save after migrate')

console.log('\n=== seam 3: a season of play, then the August rebuild ===')
// A full season takes the women's world through the rollover, which is where
// the competitions are rebuilt from LEAGUE_DEFS.
for (let i = 0; i < SEASON_WEEKS + 2; i++) processWeekAndAdvance(wLoaded)
ok(wLoaded.season >= 1, `the season rolled over (now season ${wLoaded.season}, week ${wLoaded.week})`)
report(wLoaded, 'w', 'women\'s world after a full season and rollover')
ok(Object.keys(wLoaded.comps).length > 0, `it still has competitions (${Object.keys(wLoaded.comps).length})`)

console.log('\n=== no man ever appears in the women\'s game ===')
// The real test of the whole design: take every player name the men's world
// builds and check none of them is in the women's world. Not a filter that
// might be missed - a set intersection over two independently built worlds.
const menNames = new Set(Object.values(m.players).map(p => p.name.toLowerCase()))
const womenNames = Object.values(wLoaded.players).map(p => p.name)
const crossed = womenNames.filter(n => menNames.has(n.toLowerCase()))
ok(crossed.length === 0,
  `not one of the ${womenNames.length} players in the women's world is a man from the other one${crossed.length ? ` - found ${crossed.slice(0, 5).join(', ')}` : ''}`)

console.log('')
if (fails === 0) console.log('GENDER PROBE PASSED: the two games are built apart and stay apart')
else console.log(`GENDER PROBE FAILED (${fails})`)
process.exit(fails)
