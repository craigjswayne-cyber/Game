/**
 * ---- A CONTRACT RUNNING DOWN IS A CLOCK, NOT A NOTICE ----
 *
 * Owner, v1.1.17: "contract talk should be in the inbox 6 months from players
 * contracts finishing with a reminder 3 months, 1 month, 2 weeks... once
 * contracts are done they can go on a rolling contract but most likely will
 * leave and pursue other opportunities."
 *
 * Two warnings used to go out, at weeks 20 and 31, in the same words - so the
 * first was easy to file and the second read as a repeat rather than as time
 * running out. And letting a deal lapse was very nearly free: seven in ten
 * settled men took a quiet one-year extension, which meant four warnings about
 * a thing that mostly did not happen.
 *
 * The claims are his: four reminders on a falling clock, each saying how long
 * is left, and a lapsed contract that usually costs you the player.
 *
 * Run: npx vite-node scripts/contractclock.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

console.log('\n--- 1. four reminders, and each says how long is left\n')
{
  const g = newGame('leicester', 'Contract Clock', 51)
  // put a handful of the squad into their final year so the clock has something
  // to count down to
  const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean) as Player[]
  for (const p of squad.slice(0, 4)) p.contractEnds = g.season

  // BY ID, NOT BY INDEX. state.news is pruned as the season runs, so
  // `news.slice(lengthBefore)` is a window into an array that has moved
  // underneath you - it reported one reminder where four had been filed, and
  // sent me looking for a bug in the engine that was in this loop.
  const seen: { week: number; when: string }[] = []
  const known = new Set<number>(g.news.map(n => n.id))
  for (let i = 0; i < SEASON_WEEKS + 2 && g.season === 0; i++) {
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (known.has(n.id)) continue
      known.add(n.id)
      if (n.k === 'news.expiring' || n.k === 'news.expiringMore') {
        seen.push({ week: n.week, when: String(n.v?.when_k ?? 'unnamed') })
      }
    }
  }

  ok(seen.length === 4, `all four rungs of the ladder fire in a season (${seen.length} reminders)`)
  const weeks = seen.map(s => s.week)
  const wanted = [SEASON_WEEKS - 26, SEASON_WEEKS - 13, SEASON_WEEKS - 4, SEASON_WEEKS - 2]
  ok(weeks.every(w => wanted.includes(w)),
    `every one lands on a rung of the ladder (weeks ${weeks.join(', ')} of ${wanted.join('/')})`)
  ok(new Set(weeks).size === weeks.length, 'and no rung fires twice')

  // THE POINT OF A REMINDER IS THE NUMBER ON IT. Four identical letters are one
  // letter sent four times, which is what this replaced.
  const named = seen.map(s => s.when)
  ok(named.every(w => w.startsWith('news.cx')), `each names how long is left (${named.join(', ')})`)
  ok(new Set(named).size === named.length, 'and no two of them say the same thing')
}

console.log('\n--- 2. a lapsed contract usually costs you the player\n')
{
  // ACROSS MANY CAREERS, because one rollover is one coin toss. The claim is
  // "most likely will leave", so the measurement is a rate, not a case.
  let left = 0, stayed = 0
  for (let seed = 1; seed <= 24; seed++) {
    const g: GameState = newGame('northampton', 'Contract Clock', 200 + seed)
    const squad = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(Boolean) as Player[]
    // settled men, unlisted, in their final year - the exact population that
    // used to be kept seven times in ten
    const watch = squad.filter(p => p.morale >= 4.5 && !p.transferListed).slice(0, 8)
    for (const p of watch) p.contractEnds = g.season
    const ids = watch.map(p => p.id)
    for (let i = 0; i < SEASON_WEEKS + 2 && g.season === 0; i++) processWeekAndAdvance(g)
    for (const id of ids) {
      const p = g.players[id]
      if (!p) continue
      if (p.clubId === g.userClubId) stayed++
      else left++
    }
  }
  const total = left + stayed
  const leaveRate = left / Math.max(1, total)
  ok(total > 50, `a real sample of expiring men (${total} across 24 careers)`)
  // BOUNDED BOTH WAYS, because both halves of his sentence are claims. "Most
  // likely will leave" is the majority; "they can go on a rolling contract" is
  // an outcome that has to actually happen. The first attempt at this ran at
  // 97% gone, which met the letter of the first half and made the second half
  // fiction - five men in twenty-four careers.
  ok(leaveRate > 0.55,
    `most of them leave (${Math.round(leaveRate * 100)}% gone)`)
  ok(leaveRate < 0.85,
    `but a rolling deal is a real outcome, not a rounding error (${stayed} of ${total} stayed on)`)
}

console.log(fails === 0
  ? '\nCONTRACT CLOCK PASSED: the clock counts down, and running it out costs you'
  : `\nCONTRACT CLOCK FAILED: ${fails}`)
process.exit(fails === 0 ? 0 : 1)
