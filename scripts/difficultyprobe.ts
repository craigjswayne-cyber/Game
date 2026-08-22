/**
 * ---- DOES MANAGING THIS TEAM MATTER? (release audit, Pass 1) ----
 *
 * The question a manager game lives or dies on, and until this probe there were
 * 107 harnesses and not one of them asked it. Everything else in the suite
 * checks that a system behaves as written. This checks that the systems are
 * worth opening at all.
 *
 * Three managers, the same club, the same seed, the same fixtures:
 *
 *   SLEEPWALKER - never opens a screen. Presses Continue, all season, and lets
 *                 the game pick his side.
 *   OPTIMISER   - picks the strongest legal XV every week.
 *   SABOTEUR    - picks the weakest legal XV every week.
 *
 * The gap between them IS the difficulty of the game, and all three failure
 * modes are release blockers that no unit test would ever show you:
 *
 *   optimiser == sleepwalker -> every screen in the game is decoration.
 *   saboteur  == sleepwalker -> the team sheet is not wired to the pitch.
 *   sleepwalker wins the title -> there is no game here, only a slideshow.
 *
 * A NOTE FOR WHOEVER EDITS THIS. The first version of this measurement said
 * the SABOTEUR won the league four times in five. That was not a bug in the
 * game, it was a bug in the harness: `lineupFor` treats a sheet the GAME chose
 * as re-pickable, so a deliberately terrible XV was judged stale on every shirt
 * and quietly replaced by the auto-picker on the way to the pitch. All three
 * managers were the same auto-picker wearing different hats. Setting
 * `userPicked` - which is what the Selection screen does the moment a human
 * touches it - is what makes the sheet real. Measure the thing you think you
 * are measuring.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { autoSelect } from '../src/game/matchEngine'
import { SEASON_WEEKS, XV_SLOTS } from '../src/game/model'
import { sortTable } from '../src/game/schedule'
import { effAt } from '../src/game/attributes'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEEDS = [9, 777, 101]
type Mode = 'sleepwalk' | 'optimise' | 'sabotage'

function pick(state: GameState, mode: Mode): (number | null)[] | null {
  const club = state.clubs[state.userClubId]
  const pool = club.players.map(id => state.players[id])
    .filter((p): p is Player => !!p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad)
  if (pool.length < 23) return null
  if (mode === 'optimise') return autoSelect(state, pool, club.tactic?.split)
  const used = new Set<number>()
  const lineup: (number | null)[] = new Array(23).fill(null)
  for (let i = 0; i < 15; i++) {
    const pos = XV_SLOTS[i].pos
    let worst: Player | null = null
    for (const p of pool) {
      if (used.has(p.id)) continue
      if (!worst || effAt(p, pos) < effAt(worst, pos)) worst = p
    }
    if (worst) { lineup[i] = worst.id; used.add(worst.id) }
  }
  for (let i = 15; i < 23; i++) {
    const spare = pool.find(p => !used.has(p.id))
    if (spare) { lineup[i] = spare.id; used.add(spare.id) }
  }
  return lineup
}

function season(seed: number, mode: Mode) {
  const g: GameState = newGame('northampton', 'Audit', seed)
  let guard = 0
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) {
    if (mode !== 'sleepwalk') {
      const lu = pick(g, mode)
      if (lu) {
        g.clubs[g.userClubId].tactic.lineup = lu
        g.clubs[g.userClubId].tactic.userPicked = true
      }
    }
    processWeekAndAdvance(g)
  }
  const table = sortTable(g.comps['prem'].table)
  const row = table.find(r => r.teamId === g.userClubId)
  return {
    pos: table.findIndex(r => r.teamId === g.userClubId) + 1,
    pts: row?.pts ?? 0,
    champion: table[0]?.teamId === g.userClubId,
  }
}

const rows: Record<Mode, ReturnType<typeof season>[]> = { sleepwalk: [], optimise: [], sabotage: [] }
for (const seed of SEEDS) {
  for (const mode of ['sleepwalk', 'optimise', 'sabotage'] as Mode[]) {
    rows[mode].push(season(seed, mode))
  }
}
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
const pts = (m: Mode) => mean(rows[m].map(r => r.pts))
const posn = (m: Mode) => mean(rows[m].map(r => r.pos))
for (const m of ['sabotage', 'sleepwalk', 'optimise'] as Mode[]) {
  console.log(`  ${m.padEnd(10)} mean ${posn(m).toFixed(2)} in the table on ${pts(m).toFixed(1)}pts, ${rows[m].filter(r => r.champion).length}/${SEEDS.length} titles`)
}

// THE THREE PROPERTIES. Wide bands on purpose: this is a tripwire for a system
// that has come unplugged, not a balance dial. If any of these trips, something
// structural has broken, and the number will not be marginal.
ok(pts('optimise') > pts('sleepwalk') + 5,
  `picking your best side is worth real points (${(pts('optimise') - pts('sleepwalk')).toFixed(1)} a season)`)
ok(pts('sabotage') < pts('sleepwalk') - 15,
  `and picking your worst side is punished (${(pts('sleepwalk') - pts('sabotage')).toFixed(1)} points lost)`)
// "Never wins the league" was the first draft of this claim, and at n=3 it was
// a coin toss wearing a principle's clothes: the 2026/27 Saints data flipped
// one seed and autopilot lifted a trophy the engaged manager lifted TOO, on
// the same seed with 11.7 more points. The slideshow failure this probe hunts
// is autopilot winning a title engagement would NOT have won - so pair the
// claim seed by seed, where CRN makes it sharp instead of lucky.
SEEDS.forEach((s, i) => console.log(
  `  seed ${String(s).padEnd(4)} sleepwalk ${rows.sleepwalk[i].pts}pts${rows.sleepwalk[i].champion ? ' CHAMPIONS' : ''} · optimise ${rows.optimise[i].pts}pts${rows.optimise[i].champion ? ' CHAMPIONS' : ''}`))
const stolen = SEEDS.filter((_, i) => rows.sleepwalk[i].champion && !rows.optimise[i].champion)
ok(stolen.length === 0,
  `autopilot never wins a title the engaged manager would have missed${stolen.length ? ` (seed ${stolen.join(', ')})` : ''}`)
ok(rows.sleepwalk.filter(r => r.champion).length < SEEDS.length,
  `and Continue is not a guaranteed trophy (${rows.sleepwalk.filter(r => r.champion).length}/${SEEDS.length} titles)`)
ok(posn('optimise') < posn('sleepwalk'),
  `and the engaged manager finishes higher than the absent one (${posn('optimise').toFixed(2)} v ${posn('sleepwalk').toFixed(2)})`)

// ---------------------------------------------------------------------------
// BOARD PATIENCE SCALES WITH STATURE (design review, wave 2)
//
// The three properties above establish that picking your own side matters at
// all. This establishes something the design review specifically asked for:
// that the SAME failure - never opening a screen - costs differently
// depending on who you manage it for. "At a giant, second place is a crisis
// ... at a minnow, survival buys years of goodwill" only means something if
// the identical sleepwalk performance produces a genuinely different fate.
//
// GIANT = Bath (rep 88, boardObjective "win the title") - the highest-rep
// club in the Premiership, so the effect lands exactly where the review's own
// example lives. MINNOW = Esher (rep 38, "stay clear of the bottom two") -
// the National League One club the loan-realism wave already used as its
// low-rep anchor.
//
// Six seeds, not three: this is a differential between two full boardroom
// curves (boardPatience, model.ts), not a single dial, and a real season's
// worth of match-level noise means any one seed can run kind or cruel - seed
// 4242 below is a giant that gets a soft season by chance and its board barely
// notices. The claim that has to hold is the SHAPE across seeds, not that
// every single one crosses the sack line by a fixed date.
const STATURE_SEEDS = [9, 777, 101, 55, 2024, 4242]

function statureRun(clubId: string, seed: number, mode: Mode) {
  const g: GameState = newGame(clubId, 'Stature', seed)
  let guard = 0
  let minConf = 100
  let sacked = false
  let sackWeek: number | null = null
  while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) {
    if (mode !== 'sleepwalk' && !g.unemployed) {
      const lu = pick(g, mode)
      if (lu) {
        g.clubs[g.userClubId].tactic.lineup = lu
        g.clubs[g.userClubId].tactic.userPicked = true
      }
    }
    processWeekAndAdvance(g)
    if (g.unemployed) { sacked = true; sackWeek = g.week; break }
    const c = g.clubs[clubId]
    if (c) minConf = Math.min(minConf, c.boardConfidence)
  }
  return { minConf: Math.round(minConf), sacked, sackWeek }
}

const giantSleep = STATURE_SEEDS.map(s => statureRun('bath', s, 'sleepwalk'))
const giantOpt = STATURE_SEEDS.map(s => statureRun('bath', s, 'optimise'))
const minnowSleep = STATURE_SEEDS.map(s => statureRun('esher', s, 'sleepwalk'))
const meanMin = (rows: { minConf: number }[]) => mean(rows.map(r => r.minConf))
const worstMin = (rows: { minConf: number }[]) => Math.min(...rows.map(r => r.minConf))

console.log('\nboard patience by stature (6 seeds each):')
console.log(`  bath rep88   sleepwalk  mean min-confidence ${meanMin(giantSleep).toFixed(1)}, ${giantSleep.filter(r => r.sacked).length}/${STATURE_SEEDS.length} sacked`
  + (giantSleep.some(r => r.sacked) ? ` (${giantSleep.filter(r => r.sacked).map(r => `wk${r.sackWeek}`).join(', ')})` : ''))
console.log(`  bath rep88   optimise   mean min-confidence ${meanMin(giantOpt).toFixed(1)}, ${giantOpt.filter(r => r.sacked).length}/${STATURE_SEEDS.length} sacked`)
console.log(`  esher rep38  sleepwalk  mean min-confidence ${meanMin(minnowSleep).toFixed(1)}, ${minnowSleep.filter(r => r.sacked).length}/${STATURE_SEEDS.length} sacked`)

ok(meanMin(giantSleep) < meanMin(giantOpt) - 25,
  `a giant's sleepwalk board sinks far lower than its engaged board (${meanMin(giantSleep).toFixed(1)} v ${meanMin(giantOpt).toFixed(1)})`)
ok(meanMin(giantSleep) < meanMin(minnowSleep) - 25,
  `the SAME sleepwalk season costs a giant's board far more than a minnow's (${meanMin(giantSleep).toFixed(1)} v ${meanMin(minnowSleep).toFixed(1)})`)
ok(giantSleep.filter(r => r.sacked).length >= 1,
  `sleepwalking at a genuine title favourite gets somebody sacked within the season (${giantSleep.filter(r => r.sacked).length}/${STATURE_SEEDS.length} seeds)`)
ok(giantOpt.filter(r => r.sacked).length === 0,
  `and engaged management at the same club never is (${giantOpt.filter(r => r.sacked).length}/${STATURE_SEEDS.length})`)
ok(minnowSleep.filter(r => r.sacked).length === 0,
  `a minnow's sleepwalk manager always survives the season - patience protects (${minnowSleep.filter(r => r.sacked).length}/${STATURE_SEEDS.length})`)
ok(worstMin(minnowSleep) >= 35,
  `and its board never gets anywhere near crisis range (worst seed bottomed at ${worstMin(minnowSleep)})`)

console.log(fails ? `\n${fails} FAILURES` : '\nDIFFICULTY PROBE PASSED: the team sheet is wired to the pitch, and Continue does not win titles')
process.exit(fails ? 1 : 0)
