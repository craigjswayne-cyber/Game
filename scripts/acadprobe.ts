// The academy is a team (feedback 10G). This is the tripwire for it.
//
// Five properties, and each one is a bug this round actually had:
//
//   THE SQUAD IS 27, IN SHAPE. Every club in the world, not just the user's, and in
//   ACAD_SHAPE rather than whatever the seniors happened to be thin in. A
//   thinnest-first academy is six locks and no scrum-half.
//
//   THE SENIORS ARE UNTOUCHED. Two rollover thresholds counted the whole registered
//   squad. A 27-man academy put all 101 clubs over both of them on day one, which
//   would have stripped every AI club to seventeen senior players while the academy
//   sat there, and switched squad replenishment off permanently.
//
//   IT SURVIVES THE DECADE. Graduation at 22 plus the AI's promote-when-ready rule
//   take five to nine men out of every academy a year against an intake of two to
//   four. Without the summer top-up the A League is eleven-a-side by season five.
//
//   EVERY SCHOLAR PLAYS. The first version picked the strongest XV every week and
//   gave the same fifteen men eighteen games and the other twelve none - the exact
//   failure an academy exists to prevent.
//
//   THE SCORELINES ARE RUGBY. Measured over 300,000 fixtures at real world
//   strengths, not over one 90-game season: the same dials read 51% home wins one
//   season and 64% the next, both noise around the same truth.
import { newGame } from '../src/game/newgame'
import { rebuildSeason } from '../src/game/rollover'
import { processWeekAndAdvance } from '../src/game/season'
import {
  ACADEMY_SIZE, ACAD_SHAPE, acadScoreline, acadStandings,
  academySquad, academyStrength, academyXV,
} from '../src/game/academy'
import { mulberry32 } from '../src/game/rng'
import type { Pos } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'Academy', 11)
const clubs = Object.values(g.clubs)

// ---- the squad is 27, in shape, everywhere ---------------------------------
{
  const sizes = clubs.map(c => academySquad(g, c).length)
  console.log(`academy sizes: ${Math.min(...sizes)}-${Math.max(...sizes)} across ${clubs.length} clubs`)
  ok(sizes.every(n => n === ACADEMY_SIZE), `every club carries exactly ${ACADEMY_SIZE} scholars`)

  const want: Partial<Record<Pos, number>> = {}
  for (const p of ACAD_SHAPE) want[p] = (want[p] ?? 0) + 1
  const wrong = clubs.filter(c => {
    const have: Partial<Record<Pos, number>> = {}
    for (const p of academySquad(g, c)) have[p.pos] = (have[p.pos] ?? 0) + 1
    return (Object.keys(want) as Pos[]).some(k => have[k] !== want[k])
  })
  ok(wrong.length === 0, `and in ACAD_SHAPE, not the seniors' gaps (${wrong.length} off-shape)`)
  ok(academyXV(g, g.clubs['northampton']).length === 15, 'which is enough to field a XV')
}

// ---- the seniors are untouched ---------------------------------------------
{
  const sen = clubs.map(c => c.players.filter(id => !g.players[id]?.acad).length)
  console.log(`senior squads: ${Math.min(...sen)}-${Math.max(...sen)}`)
  ok(Math.min(...sen) >= 38, 'senior squads are still 38 deep - the academy is on top, not instead')
}

// ---- a full season, then the summer ----------------------------------------
{
  for (let w = 0; w < 37; w++) processWeekAndAdvance(g)
  const l = g.academy!
  const done = l.fixtures.filter(f => f.played)
  ok(done.length === l.fixtures.length, `the whole A League card is played (${done.length}/${l.fixtures.length})`)
  ok(l.table.every(r => r.p === done.length * 2 / l.table.length), 'and every side has played the same number')

  const apps = academySquad(g, g.clubs['northampton']).map(p => p.stats.apps).sort((a, b) => b - a)
  const idle = apps.filter(a => a === 0).length
  console.log(`user academy apps: max ${apps[0]}, median ${apps[Math.floor(apps.length / 2)]}, none ${idle}`)
  ok(idle <= 2, 'the coach rotates: at most a couple of scholars go a season without a game')
  ok(apps[Math.floor(apps.length / 2)] >= 6, 'and the median scholar gets a proper run of games')
  ok(apps[0] > apps[apps.length - 1], 'while the better man still plays more - rotation, not a lottery')
}

// ---- it survives the decade ------------------------------------------------
{
  const deep = newGame('northampton', 'Decade', 12)
  for (let s = 0; s < 10; s++) {
    for (let w = 0; w < 37; w++) processWeekAndAdvance(deep)
    rebuildSeason(deep)
  }
  const dc = Object.values(deep.clubs)
  const sizes = dc.map(c => academySquad(deep, c).length)
  const sen = dc.map(c => c.players.filter(id => !deep.players[id]?.acad).length)
  console.log(`after 10 seasons: academies ${Math.min(...sizes)}-${Math.max(...sizes)}, seniors ${Math.min(...sen)}-${Math.max(...sen)}`)
  ok(Math.min(...sizes) >= ACADEMY_SIZE - 2, 'academies are still full a decade on - the summer top-up holds')
  ok(Math.min(...sen) >= 24, 'and senior squads did not get stripped by a whole-squad threshold')
  ok(Math.max(...sen) <= 52, 'nor did they bloat: the clear-out still counts the right men')
  ok((deep.academy?.fixtures.length ?? 0) > 0, 'and the A League is rebuilt every summer')
  ok(deep.academy?.season === deep.season, 'for the season the manager is actually in')
}

// ---- the scorelines are rugby ---------------------------------------------
{
  const prem = clubs.filter(c => c.leagueId === 'prem').map(c => academyStrength(g, c))
  const rng = mulberry32(4242)
  let hp = 0, ap = 0, ht = 0, at = 0, hw = 0, dr = 0
  const N = 300_000
  for (let i = 0; i < N; i++) {
    const r = acadScoreline(prem[Math.floor(rng() * prem.length)], prem[Math.floor(rng() * prem.length)], rng)
    hp += r.hp; ap += r.ap; ht += r.ht; at += r.at
    if (r.hp > r.ap) hw++
    else if (r.hp === r.ap) dr++
  }
  const pts = (hp + ap) / N, tries = (ht + at) / N, home = hw / N * 100, draws = dr / N * 100
  console.log(`${N} fixtures: ${pts.toFixed(2)} pts, ${tries.toFixed(3)} tries, ${home.toFixed(2)}% home, ${draws.toFixed(2)}% draws`)
  // the senior world's healthy band, which the A League deliberately shares
  ok(pts >= 52.0 && pts <= 53.6, 'combined points sit in the senior healthy band')
  ok(tries >= 5.8 && tries <= 6.2, 'combined tries sit in the senior healthy band')
  ok(home >= 54 && home <= 57, 'home advantage is a home advantage, not a home certainty')
  ok(draws >= 1.8 && draws <= 3.0, 'and draws are rare without being impossible')
}

console.log(fails ? `ACADEMY PROBE FAILED (${fails})` : 'ACADEMY PROBE PASSED')
process.exit(fails ? 1 : 0)
