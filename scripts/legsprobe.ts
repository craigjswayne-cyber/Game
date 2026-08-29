// Probe: a friendly never wrecks the legs; a league match still can.
//
// Owner, 29 Aug, with a screenshot of his second matchday in a brand-new
// career: fifteen names flagged, most on exactly 44% fit. The path there: he
// watched his opening friendly live, made no substitutions, the league-match
// drain ran every starter to its floor (~22%), and one week of +22 recovery
// landed the whole XV on 44 - a wall of flagged names before the season had
// even started.
//
// The fix is in the friendly branch of finalizeMatch: a pre-season run-out
// banks rhythm and burns legs, but no coach lets it empty the tank, so a
// friendly's condition bottoms out at 64% - just above the 62% rotation flag.
// League rugby is untouched: an unrotated XV still pays for all eighty
// minutes, because the bench mattering is load-bearing design.
//
// Run: npx tsx scripts/legsprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick } from '../src/game/matchEngine'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** The owner's path: watch the match live, take every interval, never sub. */
const playLiveNoSubs = (g: ReturnType<typeof newGame>, seed: number) => {
  const fx = userFixtureThisWeek(g)!
  const ctx = beginMatch(g, fx, mulberry32(seed), true)
  for (let i = 0; i < 4000; i++) {
    const out = stepTick(g, ctx)
    if (out === 'HT' || out === 'BRK') { ctx.awaiting = null; continue }
    if (out === 'FT') break
  }
  const mine = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
  return { fx, xv: mine.lineup.slice(0, 15).filter((x): x is number => x != null) }
}

const g = newGame('northampton', 'Legs', 7)

// ---- 1. the opening friendly, watched, unrotated ---------------------------
{
  const { fx, xv } = playLiveNoSubs(g, 99)
  ok(fx.compId === 'fr', `week ${g.week} is a friendly`)
  const after = xv.map(id => g.players[id]!.cond)
  ok(Math.min(...after) >= 64,
    `no man leaves a friendly under 64% (${Math.round(Math.min(...after))})`)
  ok(Math.min(...after) < 100, 'but the run-out cost something - legs are real')
  processWeekAndAdvance(g)
  const next = xv.map(id => g.players[id]!.cond)
  ok(Math.min(...next) >= 80,
    `a week later the same XV is match-fit (${Math.round(Math.min(...next))}%)`)
  ok(xv.filter(id => g.players[id]!.cond < 62).length === 0,
    'and nobody is sitting under the rotation flag')
}

// ---- 2. league rugby still charges full price ------------------------------
{
  for (let i = 0; i < 10; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx && fx.compId !== 'fr') break
    processWeekAndAdvance(g)
  }
  const { fx, xv } = playLiveNoSubs(g, 77)
  ok(fx.compId !== 'fr', `week ${g.week} is real rugby (${fx.compId})`)
  const after = xv.map(id => g.players[id]!.cond)
  ok(Math.min(...after) < 64,
    `an unrotated league XV still pays for all eighty (${Math.round(Math.min(...after))}%) - the bench matters`)
}

console.log(fails ? `\nLEGS PROBE FAILED (${fails})` : '\nLEGS PROBE PASSED: friendlies build a season, they do not spend one')
if (fails) process.exit(1)
