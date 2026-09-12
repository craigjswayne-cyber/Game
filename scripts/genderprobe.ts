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

/**
 * IDS THAT BELONG TO WHICHEVER WORLD IS RUNNING.
 *
 * The rule this file enforces is that a women's save contains women's ids and
 * nothing else, and the rule is right: a men's club id inside a women's world
 * is the failure the whole gender split exists to make impossible.
 *
 * Two ids are deliberately world-neutral, and both mean "this save's own".
 *
 *   'fr' is a friendly, which both worlds arrange.
 *   'cc' is the continental cup. Each world builds its own - sixteen men's
 *     clubs or sixteen women's clubs, on its own calendar - and a save is one
 *     world or the other and never both, so within any career 'cc' means "the
 *     continental cup of this game". Namespacing it would have meant teaching
 *     every dream, award and trophy-counting path a second name for one thing.
 *
 * Anything else is a stray, and the contents are checked below regardless: a
 * neutral id containing a men's club would still be caught by the club and
 * league checks it takes part in.
 */
const WORLD_NEUTRAL = new Set(['fr', 'cc'])

/** Every id a world exposes, with where it came from, so a failure names the
 *  offender rather than just the count. */
function strayIds(s: GameState, g: Gender): string[] {
  const want = g === 'w'
  const bad: string[] = []
  for (const id of Object.keys(s.clubs)) {
    if (isWomensId(id) !== want) bad.push(`club ${id}`)
  }
  for (const id of Object.keys(s.comps)) {
    if (!WORLD_NEUTRAL.has(id) && isWomensId(id) !== want) bad.push(`comp ${id}`)
  }
  for (const c of Object.values(s.clubs)) {
    if (c.leagueId && isWomensId(c.leagueId) !== want) bad.push(`${c.id} plays in ${c.leagueId}`)
  }
  for (const f of s.fixtures) {
    if (f.compId && !WORLD_NEUTRAL.has(f.compId) && isWomensId(f.compId) !== want) bad.push(`fixture in ${f.compId}`)
  }
  // and the neutral ids have to be filled with THIS world's clubs, which is
  // the thing the prefix was standing in for
  for (const [id, comp] of Object.entries(s.comps)) {
    if (!WORLD_NEUTRAL.has(id)) continue
    for (const row of comp.table ?? []) {
      if (isWomensId(row.teamId) !== want) bad.push(`${id} contains ${row.teamId}`)
    }
  }
  return bad
}

const report = (s: GameState, g: Gender, when: string) => {
  const bad = strayIds(s, g)
  ok(bad.length === 0, `${when}: every id belongs to the ${g === 'w' ? "women's" : "men's"} game${bad.length ? ` - found ${bad.length}: ${bad.slice(0, 4).join(', ')}` : ''}`)
}

console.log('=== the league tables are separate sets ===')
const M_DATA = LEAGUE_DEFS('m')
const mIds = new Set(M_DATA.flatMap(d => d.clubs.map(c => c.id)))
const wIds = new Set(LEAGUE_DEFS('w').flatMap(d => d.clubs.map(c => c.id)))
const shared = [...mIds].filter(id => wIds.has(id))
ok(shared.length === 0, `no club id is in both games (${mIds.size} men's, ${wIds.size} women's, ${shared.length} shared)`)
ok([...wIds].every(isWomensId), 'every women\'s club id carries the w: prefix')
ok(![...mIds].some(isWomensId), 'no men\'s club id carries it')
ok(LEAGUE_DEFS('w').length > 0, `the women's game has competitions (${LEAGUE_DEFS('w').length})`)

console.log('\n=== seam 1: a world built by newGame ===')
const wClub = LEAGUE_DEFS('w')[0].clubs[0].id
const w = newGame(wClub, 'Test', 4242, undefined, 'coach', 'w')
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

console.log('\n=== the women\'s Test game ===')
// The Test competitions are the owner's "INTERNATIONAL WITH PAID OPTION". They
// are worth their own check because they are the one part of the women's world
// whose teams are NOT w:-prefixed - national sides are nation codes in both
// games - and because activeWindows tests for competitions by id, so a women's
// career can play a full Test programme and never name a squad. It did exactly
// that until this probe caught it.
{
  const g = newGame(wClub, 'Test', 31337, undefined, 'coach', 'w')
  const intl = Object.values(g.comps).filter(c => c.type === 'intl')
  // FOUR SINCE 1.5.8, and it was two because the women's year had only the
  // Northern Championship and the Southern Four - both after the turn of the
  // year, so an international job taken in September had no fixture until
  // week 32. The autumn and summer Tests give it the men's three-window
  // shape on its own dates.
  ok(intl.length === 4, `the women's world has its four Test competitions (${intl.map(c => c.name).join(', ')})`)
  const fx = g.fixtures.filter(f => intl.some(c => c.id === f.compId))
  ok(fx.length > 0, `and a Test calendar to play (${fx.length} fixtures)`)
  // the men's windows must NOT be the women's: a Test in week 25 would mean the
  // women's game had been given the men's Six Nations slot
  const weeks = new Set(fx.map(f => f.week))
  ok(![25, 26, 27, 28, 29].some(w => weeks.has(w)),
    'and it is not played in the men\'s Six Nations window')

  let named = 0
  for (let i = 0; i < SEASON_WEEKS; i++) {
    processWeekAndAdvance(g)
    named = Math.max(named, Object.values(g.natSquads).filter(v => v.length > 0).length)
  }
  ok(named > 0, `a Test window actually names squads (${named} nations at its peak)`)
  ok(g.history.some(h => intl.some(c => c.id === h.compId)),
    'and the Championship is won by somebody')
}

console.log('\n=== no man ever appears in the women\'s game ===')
// A set intersection over two independently built worlds, against the men's
// REAL database rather than the whole men's world.
//
// The difference matters and is not a softening. What this guards against is a
// man from the men's database turning up in a women's career - that would be
// contamination, and it is exact, because those 1,560 are named people.
//
// What it deliberately does NOT fail on is a GENERATED man coinciding with a
// real woman. The generated pools contain unisex names on purpose - champ.ts
// draws 'Alex' and 'Stewart' for the English second tier, and Edinburgh's real
// Celtic Challenge squad contains Alex Stewart - so as more real women are
// added, coincidences are arithmetic rather than bad luck. Neither side can
// give way: changing a men's pool reshuffles every generated player in every
// existing career, and renaming a real player falsifies the data she came from.
// The two worlds are never in memory together, so a shared name between a
// generated man and a real woman is a coincidence and not a leak - which is why
// the ids, which ARE the leak, are asserted exactly above.
//
// "Real" means the four leagues whose squads were compiled from sources -
// prem, top14, urc and srp. The lower tiers do not qualify: champ.ts and
// natl1.ts BUILD their squads from name pools at import time, so their players
// sit in clubs[].players exactly like a compiled one and are indistinguishable
// from here, and prod2 and jl1 are mostly generated too. Asserting against
// those would be asserting that two independent random draws never collide,
// which is not a property anybody can hold.
const REAL_SQUAD_LEAGUES = ['prem', 'top14', 'urc', 'srp']
const realMen = new Set(
  M_DATA.filter(d => REAL_SQUAD_LEAGUES.includes(d.id))
    .flatMap(d => d.clubs).flatMap(c => c.players).map(p => p.name.toLowerCase()),
)
const womenNames = Object.values(wLoaded.players).map(p => p.name)
const crossed = womenNames.filter(n => realMen.has(n.toLowerCase()))
ok(crossed.length === 0,
  `not one of the ${womenNames.length} players in the women's world is one of the ${realMen.size} real men${crossed.length ? ` - found ${crossed.slice(0, 5).join(', ')}` : ''}`)

console.log('')
if (fails === 0) console.log('GENDER PROBE PASSED: the two games are built apart and stay apart')
else console.log(`GENDER PROBE FAILED (${fails})`)
process.exit(fails)
