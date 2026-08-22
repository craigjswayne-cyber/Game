/**
 * ---- A CAREER HAS A LENGTH, AND THE ENDING IS EARNED ----
 *
 * Playbook wave 3. Wave 1 gave the save a reason to exist; this gives it a last
 * season. What the probe holds:
 *
 *   1. THE CLOCK RUNS, once a summer, and never twice.
 *   2. NOBODY IS RETIRED BY SURPRISE. The door opens at 62 with a warning, and
 *      the hard stop at 70 arrives with the verdict attached.
 *   3. THE GRADE IS EARNED. An empty career grades near the floor and a decade
 *      of silverware grades near the ceiling - a scale where everybody gets a B
 *      is a scale nobody reads.
 *   4. IT IS HONEST WHEN THE ANSWER IS UNFLATTERING. A manager who won nothing
 *      is told he won nothing, in those words.
 *   5. THE VERDICT IS A PURE LENS. Reading it a hundred times leaves the save
 *      byte-identical, so it can sit on a screen without changing a career.
 *   6. RETIREMENT IS FINAL AND IDEMPOTENT. Retiring twice is not a thing, and
 *      the clock does not restart afterwards.
 *
 * Run: npx vite-node scripts/careerprobe.ts
 */
import { newGame } from '../src/game/newgame'
import * as C from '../src/game/career'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---- the module exists (red on any tree without the wave) ----
ok(typeof C.careerVerdict === 'function', 'career.ts exports a verdict')
ok(typeof C.retire === 'function' && typeof C.ageManager === 'function', 'and an ending')

// ---- 1. the clock ----
{
  const g = newGame('northampton', 'Clocker', 11)
  const start = C.mgrAge(g)
  ok(start === 42, `a new manager starts at a real age (${start})`)
  C.ageManager(g)
  ok(C.mgrAge(g) === start + 1, 'a summer makes him a year older')
  ok(C.seasonsLeft(g) === C.RETIRE_FORCED - (start + 1),
    `and the game can say how long is left (${C.seasonsLeft(g)} seasons)`)
  ok(!g.retired, 'and nobody has retired him at 43')
}

// ---- 2. the door opens, then closes ----
{
  const g = newGame('northampton', 'Elder', 12)
  g.mgrAge = C.RETIRE_OPEN - 1
  ok(!C.mayRetire(g), `at ${C.RETIRE_OPEN - 1} the door is not open yet`)
  C.ageManager(g)
  ok(C.mayRetire(g), `at ${C.RETIRE_OPEN} it is`)
  ok(g.news.some(n => n.subject.includes(String(C.RETIRE_OPEN))),
    'and he is told, rather than left to find the button')

  const g2 = newGame('northampton', 'Ancient', 13)
  g2.mgrAge = C.RETIRE_FORCED - 1
  C.ageManager(g2)
  ok(!!g2.retired, `at ${C.RETIRE_FORCED} the game makes the decision`)
  ok(g2.retired?.forced === true, 'and records that it was not his idea')
  ok(g2.news.some(n => n.subject.toLowerCase().includes('retire')), 'the world is told')
}

// ---- 3. the grade is earned ----
{
  const empty = newGame('northampton', 'Nobody', 14)
  const vEmpty = C.careerVerdict(empty)
  const great = newGame('northampton', 'Somebody', 15)
  const uid = great.userClubId
  great.mgr.m = 500; great.mgr.w = 360
  for (let i = 0; i < 12; i++) great.mgr.trophies.push({ compId: 'prem', season: i, clubId: uid })
  for (let i = 0; i < 16; i++) great.mgr.finishes.push({ season: i, leagueId: 'prem', pos: i < 8 ? 1 : 3, clubId: uid })
  great.legendOf = [uid]
  const vGreat = C.careerVerdict(great)
  console.log(`  empty: ${vEmpty.grade} (${vEmpty.score}) | great: ${vGreat.grade} (${vGreat.score})`)
  ok(vEmpty.score < 20, `a career that did nothing grades near the floor (${vEmpty.grade})`)
  ok(vGreat.score >= 88 && vGreat.grade.startsWith('A'), `and a decade of silverware near the ceiling (${vGreat.grade})`)
  ok(vEmpty.grade !== vGreat.grade, 'the scale actually separates them')
}

// ---- 4. honest when it is going badly ----
{
  const g = newGame('northampton', 'Trierbutfailed', 16)
  g.mgr.m = 200; g.mgr.w = 70
  for (let i = 0; i < 6; i++) g.mgr.finishes.push({ season: i, leagueId: 'prem', pos: 9, clubId: g.userClubId })
  const v = C.careerVerdict(g)
  ok(v.lines.some(l => l.toLowerCase().includes('no major trophy')),
    'a manager who won nothing is told so in those words')
  ok(!v.lines.some(l => l.includes('undefined') || l.includes('NaN')),
    'and no line of the verdict is broken prose')
}

// ---- 5. a pure lens ----
{
  const g = newGame('northampton', 'Lens', 17)
  const before = JSON.stringify(g)
  for (let i = 0; i < 50; i++) C.careerVerdict(g)
  C.clockLine(g); C.careerStage(g); C.seasonsLeft(g)
  ok(JSON.stringify(g) === before, 'reading the verdict fifty times leaves the save byte-identical')
}

// ---- 6. final and idempotent ----
{
  const g = newGame('northampton', 'Done', 18)
  g.mgrAge = 64
  const first = C.retire(g)
  ok(!!g.retired && first.length > 0, 'he can go when he chooses')
  const ageAt = g.retired!.age
  const second = C.retire(g)
  ok(second.includes('already'), 'and retiring twice is refused')
  C.ageManager(g)
  ok(g.retired!.age === ageAt && C.mgrAge(g) === ageAt,
    'the clock does not keep running on a retired manager')
  ok(g.retired!.forced === false, 'and going on his own terms is recorded as such')
}

console.log(fails ? `CAREER PROBE FAILED (${fails})` : 'CAREER PROBE PASSED: the clock runs, and the ending is earned')
if (fails) process.exit(1)
