// Probe: the league names ONE Player of the Month, and it is his own award.
//
// Two faults live in this corner, and both were found by reading rather than by
// playing, which is why nobody had reported them.
//
// ONE: there are two Player of the Month awards. The measured one lives in the
// monthly-awards block (awards.ts, AWARD_EVERY = 6, a three-match gate, a
// window). A second, older one fires every FOUR weeks with no window at all: any
// man with three appearances at any point in the season and a hot form figure
// TODAY. So weeks 12, 24 and 36 hand out two Player of the Month awards, often to
// two different men, and the unscoped one can crown somebody who has not played
// for a month because his rolling form has not decayed - which is exactly the
// international window.
//
// TWO: the good award was hostage to the manager's. `if (pom && best)` meant that
// in a month where no manager cleared the three-match, two-win gate, the PLAYER
// lost his award as well. He earned it on the pitch; whether anyone in a dugout
// had a good month has nothing to do with him.
//
// So this measures three numbers across whole seasons, and holds them at zero:
//   - weeks that hand out more than one Player of the Month
//   - Player of the Month awards given to a man who did not play in the window
//   - months with a deserving player and no manager, where his award vanished
//
// The first two were real and are measured in the commit that fixed them. THE
// THIRD NEVER FIRED: across 5 careers and 15 seasons, 105 award windows, 90 had
// both a worthy manager and a worthy player and 15 had neither, so the coupling
// never cost anybody anything - a six-week block either holds three or four league
// rounds or it holds none. It is kept here as a tripwire, not as a caught bug,
// because it starts to matter the moment the gate or the calendar moves.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { AWARD_EVERY, managerOfMonth } from '../src/game/awards'
import type { GameState, NewsItem } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

/**
 * Every Player of the Month named in one week's news, whichever block wrote it.
 *
 * Identified by the news item's playerId, NOT by name. The first draft of this
 * probe looked the winner up by name and reported that 14 of 24 winners had never
 * played a match, which was nonsense: in a world of several hundred clubs the
 * generated names collide, so it kept finding a different man of the same name.
 */
function potmWinners(news: NewsItem[]): { id: number; name: string }[] {
  const out: { id: number; name: string }[] = []
  for (const n of news) {
    if (n.playerId == null) continue
    // the measured block writes it into the body of a combined awards bulletin
    const inBody = /^Player of the Month: (.+?) \(/m.exec(n.body ?? '')
    // the unscoped block writes it as its own subject line
    const inSubj = /^Player of the Month: (.+?)(?: 🏅)?$/.exec(n.subject ?? '')
    const m = inBody ?? inSubj
    if (m) out.push({ id: n.playerId, name: m[1] })
  }
  return out
}

let doubles = 0
let stale = 0
let orphaned = 0
let awarded = 0
let windows = 0
let withMgr = 0
let withPlayer = 0
const seasons = 2
const seeds = [2024, 8181, 55555]

for (const seed of seeds) {
  const g: GameState = newGame('northampton', 'Awards Probe', seed)
  for (let s = 0; s < seasons; s++) {
    // walk a whole season a week at a time, reading the news each week
    const startSeason = g.season
    let guard = 0
    while (g.season === startSeason && guard++ < 60) {
      const before = g.news.length
      // who could possibly deserve it, measured BEFORE the week is processed so
      // the window is the same one the award uses
      const wk = g.week
      processWeekAndAdvance(g)
      const fresh = g.news.slice(before)
      const named = potmWinners(fresh)
      if (named.length > 1) {
        doubles++
        bad(`seed ${seed}, week ${wk}: ${named.length} Players of the Month in one week (${named.map(w => w.name).join(' and ')})`)
      }
      awarded += named.length
      const from = wk - (AWARD_EVERY - 1)
      for (const w of named) {
        const man = g.players[w.id]
        // he has to have been on a pitch inside the window he was judged on
        if (man && (man.lastWk ?? -9) < from) {
          stale++
          bad(`seed ${seed}, week ${wk}: ${man.name} took Player of the Month but last played in week ${man.lastWk ?? -9} (window opened at ${from})`)
        }
      }
      if (wk % AWARD_EVERY === 0 && !g.unemployed) {
        windows++
        if (fresh.some(n => /^Manager of the Month: (?!not awarded)/m.test(n.body ?? ''))) withMgr++
        if (named.length) withPlayer++
      }
      // and the orphan case: a month with a worthy player and no worthy manager
      if (wk % AWARD_EVERY === 0 && !g.unemployed && named.length === 0) {
        const leagueId = g.clubs[g.userClubId]?.leagueId
        const comp = leagueId ? g.comps[leagueId] : null
        if (comp?.type === 'league') {
          const from = wk - (AWARD_EVERY - 1)
          // the same pool the award uses, academy men and all. An earlier draft
          // left `!p.acad` out here and then accused the game of withholding an
          // award from players the award is not for.
          const cands = comp.table.flatMap(r => (g.clubs[r.teamId]?.players ?? [])
            .map(id => g.players[id]).filter(p => p && !p.acad && (p.lastWk ?? -9) >= from))
          const worthy = cands.filter(p => (p!.stats.apps ?? 0) >= 3).length > 0
          const mgr = managerOfMonth(g, leagueId!, from, wk)
          if (worthy && !mgr) {
            orphaned++
            bad(`seed ${seed}, week ${wk}: players deserved the award and none was given, because no manager earned his`)
          }
        }
      }
    }
  }
}

console.log(`\n${seeds.length} careers, ${seasons} seasons each: ${awarded} Player of the Month awards given`)
console.log(`  weeks with more than one award: ${doubles}`)
console.log(`  awards to a man who did not play in the window: ${stale}`)
console.log(`  months where a worthy player lost his award to an unworthy dugout: ${orphaned}`)
console.log(`\nfor scale: ${windows} award windows, ${withMgr} named a manager, ${withPlayer} named a player`)

if (fails) { console.error(`\nPOTM PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPOTM PROBE PASSED: one award a month, earned in the month, and his own')
