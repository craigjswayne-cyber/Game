// Does the board actually watch the table?
//
// The release audit saw 90% board confidence and "bouncing" fans at a club
// sitting 11th, and flagged it as unverified rather than a bug - that reading
// was taken at week 2, when the position itself was the empty-table artefact
// (blocker B1). This measures the real thing: at every mid-season and
// end-of-season checkpoint, what is the board's confidence and the crowd's mood
// against where the club actually sits.
//
// A healthy coupling looks like: top of the table pairs with high confidence,
// bottom pairs with low, and the correlation is strongly negative (position 1 is
// good, position 12 is bad). If confidence sits at 90 regardless, the board is
// not watching and the sack race means nothing.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { leaguePos } from '../src/game/schedule'
import { SEASON_WEEKS } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 12)
const CLUB = process.argv[3] ?? 'northampton'
const g = newGame(CLUB, 'Board Probe', 5150)

interface Row { season: number; week: number; pos: number; of: number; conf: number; mood: number }
const rows: Row[] = []

while (g.season < SEASONS) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  processWeekAndAdvance(g)
  // sample at the half-term report and again in the run-in
  if (g.week === 24 || g.week === SEASON_WEEKS - 2) {
    const club = g.clubs[g.userClubId]
    const comp = g.comps[club.leagueId]
    const pos = leaguePos(comp?.table, club.id)
    if (pos > 0) {
      rows.push({
        season: g.season, week: g.week, pos, of: comp!.table.length,
        conf: Math.round(club.boardConfidence), mood: Math.round(g.fanMood ?? 60),
      })
    }
  }
}

const corr = (xs: number[], ys: number[]) => {
  const n = xs.length
  if (n < 3) return NaN
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return num / Math.sqrt(dx * dy)
}

console.log(`club ${g.clubs[g.userClubId].name} · ${rows.length} checkpoints over ${SEASONS} seasons`)
for (const r of rows) {
  console.log(`  s${r.season} w${r.week}: ${r.pos}/${r.of}  board ${String(r.conf).padStart(3)}%  fans ${String(r.mood).padStart(3)}`)
}
// share of the table, 0 = top, 1 = bottom. Confidence should fall as it rises.
const frac = rows.map(r => (r.pos - 1) / Math.max(1, r.of - 1))
const confs = rows.map(r => r.conf)
const moods = rows.map(r => r.mood)
console.log(`\nboard confidence: min ${Math.min(...confs)} max ${Math.max(...confs)} mean ${Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)}`)
console.log(`fan mood:         min ${Math.min(...moods)} max ${Math.max(...moods)} mean ${Math.round(moods.reduce((a, b) => a + b, 0) / moods.length)}`)
console.log(`correlation with table position (want strongly negative):`)
console.log(`  board vs position  r = ${corr(frac, confs).toFixed(2)}`)
console.log(`  fans  vs position  r = ${corr(frac, moods).toFixed(2)}`)

const bad = rows.filter(r => (r.pos - 1) / Math.max(1, r.of - 1) >= 0.7)
const good = rows.filter(r => (r.pos - 1) / Math.max(1, r.of - 1) <= 0.25)
const avg = (a: Row[], f: (r: Row) => number) => a.length ? Math.round(a.reduce((s, r) => s + f(r), 0) / a.length) : NaN
console.log(`\nbottom third of the table (${bad.length} checkpoints): board ${avg(bad, r => r.conf)}%, fans ${avg(bad, r => r.mood)}`)
console.log(`top quarter        (${good.length} checkpoints): board ${avg(good, r => r.conf)}%, fans ${avg(good, r => r.mood)}`)
if (bad.length >= 3 && avg(bad, r => r.conf) >= 70) {
  console.log('WARN: the board is comfortable while the club is in the bottom third - it is not watching the table')
}
if (corr(frac, confs) > -0.3) {
  console.log('WARN: board confidence barely tracks league position')
}
