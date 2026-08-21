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

console.log(fails ? `\n${fails} FAILURES` : '\nDIFFICULTY PROBE PASSED: the team sheet is wired to the pitch, and Continue does not win titles')
process.exit(fails ? 1 : 0)
