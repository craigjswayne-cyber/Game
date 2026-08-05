// What lands in the inbox on the worst week of the year?
//
// The soak says news pressure averages 7.6 items a week with a p95 of 13 and a
// peak of 33. A 33-item week is a wall of unread mail on a phone: the manager
// scrolls past the things that matter to find the one that does. This finds the
// weeks that spike and breaks them down by type and subject, so the fix can be
// aimed at whichever beat fires in bulk rather than at the feed in general.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { SEASON_WEEKS } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 6)
const g = newGame(process.argv[3] ?? 'leicester', 'Press Officer', 4242)

interface Wk { season: number; week: number; n: number; types: Record<string, number>; subs: string[] }
const weeks: Wk[] = []
let seen = 0

while (g.season < SEASONS) {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  const season = g.season, week = g.week
  processWeekAndAdvance(g)
  const fresh = g.news.slice(seen >= g.news.length ? 0 : seen)
  // the feed is trimmed as it grows, so count what carries this week's stamp
  const mine = g.news.filter(n => n.season === season && n.week === week)
  seen = g.news.length
  void fresh
  const types: Record<string, number> = {}
  for (const n of mine) types[n.type] = (types[n.type] ?? 0) + 1
  weeks.push({ season, week, n: mine.length, types, subs: mine.map(n => n.subject) })
}

const counts = weeks.map(w => w.n).sort((a, b) => a - b)
const pct = (p: number) => counts[Math.min(counts.length - 1, Math.floor(counts.length * p))]
console.log(`${weeks.length} weeks over ${SEASONS} seasons · mean ${(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1)} · p50 ${pct(0.5)} · p95 ${pct(0.95)} · max ${counts[counts.length - 1]}`)

const worst = [...weeks].sort((a, b) => b.n - a.n).slice(0, 6)
for (const w of worst) {
  const t = Object.entries(w.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
  console.log(`\ns${w.season} w${w.week}: ${w.n} items  [${t}]`)
  const groups = new Map<string, number>()
  for (const s of w.subs) {
    // group by the shape of the subject, not the exact words
    const key = s.replace(/[A-Z][a-z]+(?: [A-Z][a-z']+)*/g, 'X').replace(/\d+/g, 'N').slice(0, 46)
    groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  for (const [k, v] of [...groups].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`   ${String(v).padStart(2)}x  ${k}`)
  }
}

// which week of the calendar is consistently heaviest
const byWeek = new Map<number, number[]>()
for (const w of weeks) {
  const arr = byWeek.get(w.week) ?? []
  arr.push(w.n)
  byWeek.set(w.week, arr)
}
const heavy = [...byWeek].map(([wk, arr]) => ({ wk, avg: arr.reduce((a, b) => a + b, 0) / arr.length }))
  .sort((a, b) => b.avg - a.avg).slice(0, 8)
console.log(`\nheaviest weeks of the calendar (avg items, of ${SEASON_WEEKS}):`)
for (const h of heavy) console.log(`   w${String(h.wk).padStart(2)}  ${h.avg.toFixed(1)}`)
