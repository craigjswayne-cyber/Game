/**
 * ---- THE RANKINGS AGREE WITH THEMSELVES ----
 *
 * Reported live and never diagnosed: "world rankings are out of sync". The
 * cause was not a wrong sort. Both Agency tables are recomputed EVERY WEEK from
 * current standing, while the snapshot the movement arrows are measured against
 * only republishes every four (season.ts). So the screen showed today's order,
 * captioned it "updated monthly", and drew arrows against a list nobody had
 * ever been shown - three different notions of "the ranking" on one page.
 *
 * The fix is not to freeze the table. Current standing is what a ranking should
 * say, so the table stays live and the page now names the week its arrows are
 * measured from. What this probe holds:
 *
 *   1. EVERY LIST IS SORTED BY CURRENT STANDING, with no exceptions - seniors by
 *      current ability, wonderkids by ceiling, nations by live rating points.
 *   2. PUBLICATION IS STAMPED. Without agency.at the screen cannot say what it
 *      is comparing, which is the whole bug. Red on any tree without the fix.
 *   3. THE MOMENT AFTER PUBLICATION, NOTHING HAS MOVED. Snapshot and live order
 *      are identical, so every arrow reads flat. If this fails, the arrows are
 *      lying the instant they are drawn.
 *   4. THE STAMP ADVANCES when the list republishes, and only then.
 *   5. READING THE RANKINGS CHANGES NOTHING (a pure lens, like dream.ts).
 *
 * Run: npx vite-node scripts/rankprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { agencyKids, agencySeniors, updateAgency } from '../src/game/agency'
import { natRankOrder } from '../src/game/natrank'
import { processWeekAndAdvance } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('leicester', 'Ranker', 8811)

// ---- 1. sorted by current standing ----
{
  const sen = agencySeniors(g)
  const kids = agencyKids(g)
  const desc = (xs: number[]) => xs.every((v, i) => i === 0 || xs[i - 1] >= v)
  ok(sen.length > 0 && desc(sen.map(p => p.ca)),
    `senior rankings run by current ability, best first (${sen.length} men, top ${sen[0]?.ca})`)
  ok(kids.length > 0 && desc(kids.map(p => p.pa)),
    `wonderkids run by ceiling, best first (${kids.length} kids)`)
  ok(kids.every(p => p.age <= 21) && sen.every(p => p.age >= 22),
    'and neither list borrows the other\'s players')
  const order = natRankOrder(g)
  ok(order.length > 0 && desc(order.map(c => g.natRank![c])),
    `nations run by live rating points (${order.length} nations, leader ${order[0]})`)
}

// ---- 2 + 3. publication is stamped, and nothing has moved yet ----
{
  updateAgency(g)
  const at = g.agency?.at
  ok(!!at, `the published list carries its date (${at ? `season ${at.season}, week ${at.week}` : 'MISSING'})`)
  ok(at?.season === g.season && at?.week === g.week, 'and the date is this week, not a guess')

  const liveSen = agencySeniors(g).map(p => p.id)
  const liveNat = natRankOrder(g)
  ok(JSON.stringify(g.agency!.seniors) === JSON.stringify(liveSen),
    'the instant it publishes, the snapshot IS the live order (no senior arrow can point yet)')
  ok(JSON.stringify(g.natRankPrev) === JSON.stringify(liveNat),
    'and the same for the nations (no flag arrow can point yet)')
}

// ---- 4. the stamp advances only when the list republishes ----
{
  const first = { ...g.agency!.at! }
  let sawRepublish = false
  for (let i = 0; i < 9; i++) {
    const before = JSON.stringify(g.agency!.at)
    processWeekAndAdvance(g)
    const after = JSON.stringify(g.agency!.at)
    if (before !== after) sawRepublish = true
  }
  const now = g.agency!.at!
  ok(sawRepublish, 'the list republishes on its own cycle across nine weeks')
  ok(now.week !== first.week || now.season !== first.season,
    `and the stamp moved with it (week ${first.week} to week ${now.week})`)
}

// ---- 5. reading is a pure lens ----
{
  const before = JSON.stringify(g)
  agencySeniors(g); agencyKids(g); natRankOrder(g); natRankOrder(g)
  ok(JSON.stringify(g) === before, 'reading the rankings leaves the save byte-identical')
}

console.log(fails ? `RANK PROBE FAILED (${fails})` : 'RANK PROBE PASSED: one ranking, and it says which week it is')
if (fails) process.exit(1)
