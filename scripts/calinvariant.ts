/**
 * CALENDAR INVARIANT (1.6.5): every rule in src/game/calendar.ts, on a built
 * season and again after every week of it, for both worlds and every kind of
 * season - an ordinary year, a World Championship year, an Isles tour year.
 * Knockout ties are drawn as the season goes, so a fresh season is not enough.
 *
 * A gate, not a reporter: any violation fails the suite.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { validateCalendar, windowSpan, type CalWorld } from '../src/game/calendar'
import { nationByCode } from '../src/game/nations'
import { genderOf } from '../src/game/gender'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => { console.log(`${cond ? '  ok ' : 'FAIL'}  ${what}`); if (!cond) fails++ }

function world(g: GameState): CalWorld {
  return {
    gender: genderOf(g),
    fixtures: g.fixtures,
    comps: g.comps as unknown as CalWorld['comps'],
    isClub: id => !!g.clubs[id],
    isNation: id => id === 'LIO' || !!nationByCode(id),
  }
}

function season(club: string, gender: 'm' | 'w', target: number, seed: number, label: string) {
  const g = gender === 'w' ? newGame(club, 'Cal', seed, undefined, 'coach', 'w', 'w') : newGame(club, 'Cal', seed)
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS * 20) processWeekAndAdvance(g)
  const seen = new Set<string>()
  const bad: string[] = []
  const check = (when: string) => {
    for (const v of validateCalendar(world(g))) {
      if (seen.has(v)) continue
      seen.add(v); bad.push(`${when}: ${v}`)
    }
  }
  check('built')
  const startSeason = g.season
  guard = 0
  let koPlayed = 0
  while (g.season === startSeason && guard++ < SEASON_WEEKS + 5) {
    processWeekAndAdvance(g)
    if (g.season !== startSeason) break
    check(`week ${g.week}`)
    // the fixture list is rebuilt at the rollover, so the bracket is counted as it is played
    koPlayed = Math.max(koPlayed, g.fixtures.filter(f => f.compId === 'wc' && !!f.stage && f.played).length)
  }
  ok(bad.length === 0, `${label} seed ${seed}: the calendar holds every rule (${bad.length} violations)`)
  // the owner's condition on the men's overlay (16 Sep 2026): the leagues may
  // play through the World Championship, but no semi-final or final of any
  // club competition may sit against it - stated by name, not only by rule 3
  if (g.comps['wc']) {
    const span = windowSpan('wc', genderOf(g))!
    const late = g.fixtures.filter(f => f.stage && g.comps[f.compId]?.type !== 'intl' && f.week >= span[0] && f.week <= span[1])
    const earliestKo = Math.min(...Object.values(g.comps).filter(c => c.type !== 'intl').flatMap(c => c.koWeeks ?? [99]))
    ok(late.length === 0 && earliestKo > span[1], `${label} seed ${seed}: no club semi-final or final sits against the World Championship (weeks ${span[0]}-${span[1]}; earliest knockout week ${earliestKo})`)
  }
  for (const b of bad.slice(0, 12)) console.log(`        ${b}`)
  // a World Championship, when there is one, is a complete tournament
  const hist = g.history.filter(h => h.season === startSeason && h.compId === 'wc')
  if (label.includes('World')) {
    ok(hist.length === 1 && !!hist[0].champion, `${label} seed ${seed}: a champion is recorded (${hist[0]?.champion ?? 'none'})`)
    ok(koPlayed === 7, `${label} seed ${seed}: the bracket is complete, 4 + 2 + 1 ties all played (${koPlayed})`)
  }
  return g
}

for (const seed of [7, 4242]) {
  season('leicester', 'm', 0, seed, 'men, ordinary year')
  season('leicester', 'm', 1, seed, 'men, World Championship year')
  season('leicester', 'm', 3, seed, 'men, Isles tour year')
  season('w:glosharty', 'w', 0, seed, 'women, ordinary year')
  season('w:glosharty', 'w', 3, seed, 'women, World Championship year')
  season('w:glosharty', 'w', 5, seed, 'women, Isles tour year')
}
console.log(fails ? `\nCALENDAR INVARIANT FAILED (${fails})` : '\nCALENDAR INVARIANT PASSED: no club or nation is double-booked, no knockout tie sits in a Test window, both worlds, every kind of year')
process.exit(fails ? 1 : 0)
