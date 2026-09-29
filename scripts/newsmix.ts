/**
 * ---- WHAT THE INBOX ACTUALLY SAYS, SEASON AFTER SEASON ----
 *
 * Owner, 1.8.1: "we need to increase the variety of news stories to fill the
 * game out a bit, feels too samey at times." A measurement, not a gate: three
 * seasons in each world, every story the engine files, counted by its key, by
 * the week it lands in, and by how often the same key reads the same way twice
 * in one season. It prints the numbers the variety work is judged against.
 *
 * Run: npx vite-node scripts/newsmix.ts [seasons]
 */
import { newGame, LEAGUE_DEFS } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { tIn } from '../src/game/i18n'
import type { GameState, NewsItem } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 3)

interface Row { c: number; season: number; week: number; k: string; text: string }

let careerNo = 0
function collect(g: GameState): Row[] {
  const c = careerNo++
  const rows: Row[] = []
  let seen = Math.max(0, ...g.news.map(n => n.id))
  const target = g.season + SEASONS
  let guard = 0
  while (g.season < target && guard++ < 60 * SEASONS) {
    // the board is kept on side so the measurement is a manager's inbox for
    // every week of it: a sacking halves the stories and says nothing about
    // their variety
    const club = g.clubs[g.userClubId]
    if (!g.unemployed && club) club.boardConfidence = Math.max(club.boardConfidence, 60)
    processWeekAndAdvance(g)
    const fresh = g.news.filter((n: NewsItem) => n.id > seen)
    for (const n of fresh) {
      const k = n.k ?? '(no key)'
      let text = n.body
      try { if (n.k) text = tIn('en', n.k, n.v) } catch { /* the stored English stands */ }
      // a retelling (tellings.ts, `V2`, `V3`) is the same story told another
      // way, so it is counted under the story it retells
      rows.push({ c, season: n.season, week: n.week, k: k.replace(/V\d+$/, ''), text })
    }
    seen = Math.max(seen, ...fresh.map(n => n.id))
  }
  return rows
}

function report(label: string, rows: Row[], careers = 1) {
  console.log(`\n=== ${label}: ${rows.length} stories over ${SEASONS} seasons ===`)
  const perWeek = new Map<string, number>()
  for (const r of rows) perWeek.set(`${r.season}:${r.week}`, (perWeek.get(`${r.season}:${r.week}`) ?? 0) + 1)
  const weeks = SEASONS * 48
  const counts = [...Array(weeks).keys()].map(i => perWeek.get(`${Math.floor(i / 48) + 1 + (rows[0]?.season ?? 0) - 1}:${(i % 48) + 1}`) ?? 0)
  const mean = rows.length / (weeks * careers)
  const thin = counts.filter(c => c <= 1).length
  console.log(`per week: mean ${mean.toFixed(2)}${careers === 1 ? `, weeks with 0-1 stories ${thin} of ${weeks}` : ''}`)
  // which weeks of the season are thin, summed across seasons
  const byWeek = [...Array(48).keys()].map(w => rows.filter(r => r.week === w + 1).length / (SEASONS * careers))
  const thinWeeks = byWeek.map((n, i) => ({ w: i + 1, n })).filter(x => x.n < 1.5).map(x => `${x.w}(${x.n.toFixed(1)})`)
  console.log(`thin weeks of the season (under 1.5 a season): ${thinWeeks.join(' ') || 'none'}`)
  const byKey = new Map<string, number>()
  for (const r of rows) byKey.set(r.k, (byKey.get(r.k) ?? 0) + 1)
  console.log(`distinct stories: ${byKey.size}`)
  const top = [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
  console.log('most filed:')
  for (const [k, n] of top) {
    const texts = rows.filter(r => r.k === k).map(r => r.text)
    // how much of the story is the same words every time: the share of
    // tellings whose opening sentence another telling in the SAME season shares
    const openers = rows.filter(r => r.k === k).map(r => `${r.c}|${r.season}|${r.text.split(/[.!?]\s/)[0]}`)
    const dupe = openers.filter((o, i) => openers.indexOf(o) !== i).length
    console.log(`  ${String(n).padStart(4)}  ${k.padEnd(34)} ${(n / SEASONS / careers).toFixed(1)}/season  openers repeated in-season ${dupe}/${n}  distinct texts ${new Set(texts).size}`)
  }
  const sameOpen = [...byKey.keys()].reduce((s, k) => {
    const openers = rows.filter(r => r.k === k).map(r => `${r.c}|${r.season}|${r.text.split(/[.!?]\s/)[0]}`)
    return s + openers.filter((o, i) => openers.indexOf(o) !== i).length
  }, 0)
  console.log(`stories whose opening line already ran that season: ${sameOpen} of ${rows.length} (${(100 * sameOpen / Math.max(1, rows.length)).toFixed(1)}%)`)
}

const all: Row[] = []
for (const seed of [777, 4242]) {
  const m = collect(newGame('leicester', 'Mix', seed))
  const w = collect(newGame(LEAGUE_DEFS('w')[0].clubs[0].id, 'Mix', seed, undefined, 'coach', 'w'))
  report(`men, Leicester, seed ${seed}`, m)
  report(`women, first club, seed ${seed}`, w)
  all.push(...m, ...w)
}
report('all four careers together', all, 4)
