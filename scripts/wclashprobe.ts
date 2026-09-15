/**
 * ---- NO CLUB PLAYS TWICE IN A WEEK, IN EITHER WORLD ----
 *
 * The 1.6.2 release gate found the women's Champions Cup quarter-final,
 * semi-final and final scheduled on league weekends (W_CC_KO_WEEKS were 24, 27
 * and 30, all league rounds): the manager's own cup ties were settled by the
 * AI path while the league game took the Saturday, including a final. The
 * men's calendar never had the clash, and scripts/invariants.ts only ever
 * built a men's world, so nothing was watching the women's one.
 *
 * Two seasons in each world, every club, every week: a club with two fixtures
 * in one week that is not a touring party's midweek game is a failure, and so
 * is any user fixture settled without events (the AI path took it).
 *
 * Run: npx vite-node scripts/wclashprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { SEASON_WEEKS } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

for (const [gender, club, seed] of [['w', 'w:saracens', 7], ['w', 'w:blues', 3], ['m', 'leicester', 7]] as const) {
  const g = newGame(club, 'Clash', seed, undefined, 'coach', gender, gender)
  const twice: string[] = []
  const stolen: string[] = []
  for (let s = 0; s < 2; s++) {
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      const byClub = new Map<string, number>()
      for (const f of g.fixtures) {
        if (f.week !== g.week || f.midweek || f.tourMatch) continue
        for (const id of [f.homeId, f.awayId]) {
          if (!g.clubs[id]) continue
          byClub.set(id, (byClub.get(id) ?? 0) + 1)
        }
      }
      for (const [id, n] of byClub) if (n > 1) twice.push(`s${g.season}w${g.week}:${id}`)
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), true)
      for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
      const wk = g.week
      processWeekAndAdvance(g)
      for (const f of g.fixtures) {
        if (f.week === wk && f.played && !f.events && (f.homeId === club || f.awayId === club)) {
          stolen.push(`s${g.season}w${wk}:${f.compId}/${f.stage ?? 'r' + f.round}`)
        }
      }
    }
  }
  ok(twice.length === 0, `${gender}/${club}: no club has two fixtures in one week (${twice.length}: ${twice.slice(0, 4).join(' ')})`)
  ok(stolen.length === 0, `${gender}/${club}: no user fixture is settled by the AI path (${stolen.length}: ${stolen.slice(0, 4).join(' ')})`)
}

console.log(fails ? `CLASH PROBE FAILED (${fails})` : 'CLASH PROBE PASSED: one match a week for everybody, in both worlds')
process.exit(fails ? 1 : 0)
