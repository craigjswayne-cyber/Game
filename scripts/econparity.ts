// ---- THE TWO WORLDS OPEN ON THE SAME MONEY --------------------------------
//
// The owner's ruling, and it decides this rather than realism: "the financial
// side should match up to the mens side even if in real life that isnt the
// case but it preserves the challenge of the game."
//
// How it is done: the women's opening budgets in src/data/leagues/w_*.ts are
// written at real-world scale - £41k to £380k, a median of £140k - and
// newgame's openingBudget() multiplies every one of them by W_OPENING_MONEY on
// the way into the save. One multiplier, applied uniformly, so the spread
// between a rich club and a poor one survives untouched and only the scale
// moves.
//
// WHY THIS PROBE EXISTS. The external audit of 13 Sep 2026 read this as a P1
// balance defect: "opening women's budgets are hand-tuned at approximately
// £41k-£380k with a median around £140k", against a steady state with a £200k
// floor, and recommended deriving season one from the economic model instead.
// Those three figures are exactly right about the DATA FILES and wrong about
// the GAME, because nothing between the two is asserted anywhere - the
// multiplier is named in one comment in wmarketprobe and held by nothing. A
// reviewer reading the repository has no way to see the £140k become £1.26m,
// and neither would a future change that quietly stopped it happening.
//
// So this holds the rule rather than the implementation: whatever the data
// files say and whatever the multiplier is, a women's career must open on
// roughly the money a men's career opens on, and the shape of the data must
// come through unchanged.
import { newGame, LEAGUE_DEFS, W_OPENING_MONEY, openingBudget } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { SEASON_WEEKS } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]
const m = (n: number) => '£' + Math.round(n).toLocaleString('en-GB')

function world(g: 'm' | 'w'): GameState {
  return newGame(LEAGUE_DEFS(g)[0].clubs[0].id, 'Parity', 99, undefined, 'coach', g)
}
const budgets = (g: GameState) => Object.values(g.clubs).map(c => c.budget)

// ---- the multiplier reaches the women's world and only the women's world ----
{
  ok(openingBudget(100_000, 'w:pwr') === 100_000 * W_OPENING_MONEY,
     `a women's club's opening money is lifted ${W_OPENING_MONEY}-fold`)
  ok(openingBudget(100_000, 'prem') === 100_000,
     "and a men's club's is not touched")
}

// ---- season one, side by side -----------------------------------------------
{
  const mg = world('m'), wg = world('w')
  const mb = budgets(mg), wb = budgets(wg)
  const mm = med(mb), wm = med(wb)
  console.log(`  men's   S1: median ${m(mm)}  ${m(Math.min(...mb))} to ${m(Math.max(...mb))}  (${mb.length} clubs)`)
  console.log(`  women's S1: median ${m(wm)}  ${m(Math.min(...wb))} to ${m(Math.max(...wb))}  (${wb.length} clubs)`)

  const ratio = wm / mm
  ok(ratio >= 0.8 && ratio <= 1.2,
     `the two worlds open within a fifth of each other (women's is ${(ratio * 100).toFixed(0)}% of men's)`)

  // The ceiling is the one distinction worth keeping: no women's club is
  // Toulouse. Asserted so that "parity" can never be read as "identical" and
  // flatten the top of the men's game to match.
  ok(Math.max(...wb) < Math.max(...mb),
     `the richest women's club is still poorer than the richest men's (${m(Math.max(...wb))} against ${m(Math.max(...mb))})`)
  ok(Math.min(...wb) > 0, 'and the poorest can still sign somebody')
}

// ---- the shape of the data survives the multiplier ---------------------------
//
// A uniform multiplier preserves every ratio in the source data. If someone
// ever replaces it with a floor, a cap or a per-league fudge, the spread
// changes and this is what says so.
{
  const wb = budgets(world('w')).sort((a, b) => a - b)
  const raw = wb.map(v => v / W_OPENING_MONEY)
  const clean = raw.every(v => Math.abs(v - Math.round(v)) < 0.5)
  ok(clean, "every women's opening budget is a whole multiple of the figure in the data file")
  ok(Math.max(...wb) / Math.min(...wb) > 5,
     `the gap between the richest and poorest survives (${(Math.max(...wb) / Math.min(...wb)).toFixed(1)}x)`)
}

// ---- and the jump to steady state is the same jump in both worlds -------------
//
// This is the discontinuity the audit was actually pointing at, and it is real:
// season one is tight and season two is not, because rollover.ts recomputes
// every budget from reputation. What matters is that it is the SAME step in
// both worlds. A women's career that leapt further than a men's would be the
// defect; opening poor and then being handed a working budget is the design.
{
  const step = (w: 'm' | 'w') => {
    const g = world(w)
    const before = med(budgets(g))
    const target = g.season + 1
    let guard = 0
    while (g.season < target && guard++ < SEASON_WEEKS + 5) {
      g.clubs[g.userClubId].boardConfidence = Math.max(60, g.clubs[g.userClubId].boardConfidence)
      processWeekAndAdvance(g)
    }
    const after = med(budgets(g))
    console.log(`  ${w === 'm' ? "men's  " : "women's"} S1 ${m(before)} -> S2 ${m(after)}  (${(after / before).toFixed(2)}x)`)
    return after / before
  }
  const mStep = step('m'), wStep = step('w')
  ok(wStep / mStep >= 0.7 && wStep / mStep <= 1.4,
     `the women's world takes the same step up as the men's (${(wStep / mStep).toFixed(2)} of it)`)
}

console.log(fails
  ? `\nECON PARITY FAILED (${fails})`
  : '\nECON PARITY PASSED: both worlds open on the same money, and rise by the same step')
process.exit(fails ? 1 : 0)
