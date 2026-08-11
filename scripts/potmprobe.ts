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
import type { GameState, NewsItem, Player } from '../src/game/model'

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
let ranked = 0
let awarded = 0
let windows = 0
let withMgr = 0
let withPlayer = 0
const seasons = 2
const seeds = [2024, 8181, 55555]

for (const seed of seeds) {
  const g: GameState = newGame('northampton', 'Awards Probe', seed)
  const win = new Map<number, { sum: number; apps: number }>()
  for (let s = 0; s < seasons; s++) {
    // walk a whole season a week at a time, reading the news each week
    const startSeason = g.season
    let guard = 0
    while (g.season === startSeason && guard++ < 60) {
      // BY ID, NOT BY INDEX. The settle trims the news array (slice(-NEWS_KEEP))
      // whenever it grows past the cap, so an index captured before the week is
      // meaningless after it: in a news-heavy world g.news.slice(before) missed
      // the very award it was looking for, the probe read "no award given", and
      // it accused the ceremony of withholding a trophy that is sitting right
      // there in the feed. Ids are monotonic and survive the trim.
      const beforeId = g.nextId
      // who could possibly deserve it, measured BEFORE the week is processed so
      // the window is the same one the award uses
      const wk = g.week
      // appearances before the week, so the tally below can tell a COMPETITIVE
      // match from a friendly. lastWk alone cannot: a friendly sets lastWk and
      // deliberately banks no apps, no minutes and no rating, so reading lastR
      // after one gives a stale number from whenever he last played properly.
      // That is what made the first run of this check accuse week 6 of crowning
      // the wrong man - four "games", two of them pre-season friendlies.
      const appsBefore = new Map<number, number>()
      for (const p of Object.values(g.players)) appsBefore.set(p.id, p.stats.apps)
      processWeekAndAdvance(g)
      const fresh = g.news.filter(n => n.id >= beforeId)
      const named = potmWinners(fresh)

      // MY OWN TALLY OF THE WINDOW, kept independently of the game's mSum/mApps.
      // Trusting the counter to check the award that reads the counter would prove
      // nothing; this reads lastR off every man who played this week and adds it up
      // in the probe. (One rating per player per week: a club plays once a week, so
      // a second match in the same week would be missed here, and that is the one
      // known limit of this measurement.)
      for (const p of Object.values(g.players)) {
        if (p.lastR == null) continue
        if (p.stats.apps <= (appsBefore.get(p.id) ?? 0)) continue
        const e = win.get(p.id) ?? { sum: 0, apps: 0 }
        e.sum += p.lastR; e.apps += 1
        win.set(p.id, e)
      }
      // who deserved it, by my numbers, using the game's own eligibility rules
      const leagueNow = g.clubs[g.userClubId]?.leagueId
      const compNow = leagueNow ? g.comps[leagueNow] : null
      const winFrom = wk - (AWARD_EVERY - 1)
      const pool = (compNow?.type === 'league' ? compNow.table : []).flatMap(r =>
        (g.clubs[r.teamId]?.players ?? []).map(id => g.players[id]))
        .filter((p): p is Player => !!p && !p.acad && (p.lastWk ?? -9) >= winFrom)
        .map(p => { const e = win.get(p.id); return { id: p.id, name: p.name, avg: e && e.apps ? e.sum / e.apps : 0, apps: e?.apps ?? 0 } })
        .filter(x => x.apps >= 2)
        .sort((a, b) => b.avg - a.avg || b.apps - a.apps)
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
        // AND HE HAS TO BE THE BEST MAN IN THE WINDOW BY THE WINDOW'S OWN NUMBERS.
        // Measured against the pool snapshotted before the counters were cleared:
        // nobody eligible may have had a better month than the winner.
        if (man && pool.length) {
          const mine = pool.find(x => x.id === man.id)
          const top = pool[0]
          if (!mine) {
            ranked++
            bad(`seed ${seed}, week ${wk}: ${man.name} won it but was not in the eligible pool at all`)
          } else if (mine.avg < top.avg - 1e-9) {
            ranked++
            bad(`seed ${seed}, week ${wk}: ${man.name} won on ${mine.avg.toFixed(2)} from ${mine.apps} games, ` +
              `but ${top.name} had ${top.avg.toFixed(2)} from ${top.apps}`)
          }
        }
      }
      if (wk % AWARD_EVERY === 0 && !g.unemployed) {
        windows++
        if (fresh.some(n => /^Manager of the Month: (?!not awarded)/m.test(n.body ?? ''))) withMgr++
        if (named.length) withPlayer++
      }
      if (wk % AWARD_EVERY === 0) win.clear()
      // AND AT THE SEASON BOUNDARY. The game wipes every player's stats at
      // rollover (rollover.ts, p.stats = emptyStats()), so its season-2 week-6
      // window is weeks 1-6 and nothing else. This ledger's last in-season
      // clear is week 42, which left the playoff and final ratings of weeks
      // 43-44 in the map across the rollover - and a finals star who then
      // played one friendly passed the lastWk filter carrying last season's
      // numbers. Two seeds' worth of stream shuffle (19C) put such a man on
      // top of the probe's polluted table and the probe accused a correct
      // ceremony. The game was right; the ledger now resets when it does.
      if (g.season !== startSeason) win.clear()
      // and the orphan case: the two awards must not depend on each other.
      // The probe's own window ledger (pool, built before the counters were
      // cleared) applies the game's exact eligibility - two window
      // appearances among the league clubs' senior men - so if it holds
      // anyone and no player award came, one was genuinely withheld. Earlier
      // drafts guessed eligibility from lastWk and season apps, and accused
      // the game over windows where nobody truly qualified: a summer window
      // puts lastWk on tourists whose only rugby was a Test, and a playoff
      // month can end with two league rounds and still no double-appearing
      // eligible man once the beaten sides go to the beach.
      if (wk % AWARD_EVERY === 0 && !g.unemployed && named.length === 0 && pool.length > 0) {
        orphaned++
        bad(`seed ${seed}, week ${wk}: ${pool[0].name} (${pool[0].avg.toFixed(2)} from ${pool[0].apps}) deserved Player of the Month and none was given`)
      }
    }
  }
}

console.log(`\n${seeds.length} careers, ${seasons} seasons each: ${awarded} Player of the Month awards given`)
console.log(`  weeks with more than one award: ${doubles}`)
console.log(`  awards to a man who did not play in the window: ${stale}`)
console.log(`  months where a worthy player lost his award to an unworthy dugout: ${orphaned}`)
console.log(`  awards to a man who was not the best in the window: ${ranked}`)
console.log(`\nfor scale: ${windows} award windows, ${withMgr} named a manager, ${withPlayer} named a player`)

if (fails) { console.error(`\nPOTM PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPOTM PROBE PASSED: one award a month, earned in the month, and his own')
