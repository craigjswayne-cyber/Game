/**
 * ---- WHAT IS THE WHOLE TOOLBOX WORTH? ----
 *
 * The open question from the release audit, and the one the user asked
 * directly: is this game too easy for a manager who actually uses it?
 *
 * difficultyprobe already measures ONE lever - the team sheet - and reports the
 * gap between a manager who sleepwalks and one who picks his strongest side.
 * Every other lever has only ever been measured ALONE, which is the wrong
 * question. A manager does not choose between a training ground and a scout; he
 * has all of them, every week, for a decade, and they compound. Nobody had ever
 * measured them STACKED against the AI baseline, so nobody knew whether an
 * attentive manager was playing the same sport as the one the balance is tuned
 * for.
 *
 * Three arms, same club, same seeds, same fixtures:
 *
 *   SLEEPWALK - presses Continue. The floor.
 *   SHEET     - picks the strongest legal XV. One lever.
 *   STACK     - the sheet PLUS the levers a real manager pulls: facilities,
 *               ground expansion, a badged backroom, coaching courses, scouting
 *               commissions. Everything the Hub offers that runs headlessly.
 *
 * The number that matters is STACK minus SHEET: what the rest of the game is
 * worth once you are already picking your best team. If it is near zero the Hub
 * is decoration; if it is enormous the game is a solved problem for anyone who
 * reads a wiki.
 *
 * A REFERENCE FOR "ENORMOUS". A points gap means nothing on its own, so it is
 * reported against the spread of the league it was measured in: the distance
 * between the champions and the wooden spoon on the same seeds. A toolbox worth
 * more than that spread would let a manager out-coach the entire quality range
 * of the division, which is the definition of too easy.
 *
 * NOT A PASS/FAIL DIAL. Bands here are deliberately wide tripwires. Balance
 * changes get argued from the printed numbers across seeds, never from one run.
 *
 * Run: npx vite-node scripts/stackprobe.ts [seasons]
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, requestExpansion, requestFacility } from '../src/game/season'
import { autoSelect } from '../src/game/matchEngine'
import { SEASON_WEEKS, type FacilityId } from '../src/game/model'
import { sortTable } from '../src/game/schedule'
import { appointStaff, sendToCourse, staffCandidates, staffInterest, type StaffRole } from '../src/game/staff'
import { commissionScout } from '../src/game/commission'
import type { GameState, Player } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 3)
const SEEDS = [9, 777, 101]
const CLUB = 'sale' // mid-table on purpose: room to climb and room to fall

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

type Arm = 'sleepwalk' | 'sheet' | 'stack'

const FIDS: FacilityId[] = ['pitch', 'gym', 'recovery', 'paddock', 'kicking', 'briefing', 'academy', 'shop']
const ROLES: StaffRole[] = ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach']

/** The strongest legal XV, exactly as the Selection screen would leave it. */
function bestSheet(g: GameState): void {
  const club = g.clubs[g.userClubId]
  const pool = club.players.map(id => g.players[id])
    .filter((p): p is Player => !!p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad)
  if (pool.length < 23) return
  club.tactic.lineup = autoSelect(g, pool, club.tactic?.split)
  // userPicked is what the Selection screen sets the moment a human touches it.
  // Without it lineupFor judges the sheet stale and the auto-picker silently
  // replaces it - the harness bug difficultyprobe documents, and the reason all
  // three arms here would otherwise be the same manager in different hats.
  club.tactic.userPicked = true
}

/** Everything else the Hub offers, pulled on the cadence deepsave.ts uses. */
function pullLevers(g: GameState): void {
  if (g.unemployed) return
  const wk = g.week
  if (wk % 7 === 0) requestFacility(g, FIDS[Math.floor(wk / 7) % FIDS.length])
  if (wk % 11 === 0) requestExpansion(g)
  const role = ROLES[wk % ROLES.length]
  if (wk % 5 === 0) sendToCourse(g, role)
  if (wk % 17 === 0) {
    const cands = staffCandidates(g, role)
    const i = cands.findIndex(c => staffInterest(g, c) !== 'no')
    if (i >= 0) appointStaff(g, role, i)
  }
  if (wk % 21 === 0) commissionScout(g, 'any', 6)
}

interface Run { pts: number; pos: number; titles: number; spread: number }

function career(seed: number, arm: Arm): Run {
  const g: GameState = newGame(CLUB, 'Stack', seed)
  const league = g.clubs[g.userClubId].leagueId
  let pts = 0, pos = 0, titles = 0, spread = 0, counted = 0
  for (let s = 0; s < SEASONS; s++) {
    let guard = 0
    while (g.week < SEASON_WEEKS && guard++ < SEASON_WEEKS + 5) {
      if (arm !== 'sleepwalk') bestSheet(g)
      if (arm === 'stack') pullLevers(g)
      processWeekAndAdvance(g)
    }
    const comp = g.comps[g.clubs[g.userClubId]?.leagueId ?? league]
    if (comp?.table?.length) {
      const table = sortTable(comp.table)
      const idx = table.findIndex(r => r.teamId === g.userClubId)
      if (idx >= 0) {
        pts += table[idx].pts
        pos += idx + 1
        if (idx === 0) titles++
        spread += (table[0]?.pts ?? 0) - (table[table.length - 1]?.pts ?? 0)
        counted++
      }
    }
    // roll into the next season
    let g2 = 0
    while (g.week >= SEASON_WEEKS && g2++ < 8) processWeekAndAdvance(g)
  }
  const n = Math.max(1, counted)
  return { pts: pts / n, pos: pos / n, titles, spread: spread / n }
}

const out: Record<Arm, Run[]> = { sleepwalk: [], sheet: [], stack: [] }
for (const seed of SEEDS) {
  for (const arm of ['sleepwalk', 'sheet', 'stack'] as Arm[]) out[arm].push(career(seed, arm))
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const M = (a: Arm, k: keyof Run) => mean(out[a].map(r => r[k] as number))

console.log(`\n${SEASONS} seasons at ${CLUB}, ${SEEDS.length} seeds\n`)
console.log('arm         mean pts   mean pos   titles')
for (const a of ['sleepwalk', 'sheet', 'stack'] as Arm[]) {
  console.log(`${a.padEnd(11)} ${M(a, 'pts').toFixed(1).padStart(8)}   ${M(a, 'pos').toFixed(2).padStart(8)}   ${out[a].reduce((s, r) => s + r.titles, 0)}/${SEEDS.length * SEASONS}`)
}
const sheetEdge = M('sheet', 'pts') - M('sleepwalk', 'pts')
const stackEdge = M('stack', 'pts') - M('sheet', 'pts')
const total = M('stack', 'pts') - M('sleepwalk', 'pts')
const spread = M('stack', 'spread')
console.log(`\nthe team sheet is worth      ${sheetEdge >= 0 ? '+' : ''}${sheetEdge.toFixed(1)} pts a season`)
console.log(`everything else is worth     ${stackEdge >= 0 ? '+' : ''}${stackEdge.toFixed(1)} pts a season`)
console.log(`the whole toolbox is worth   ${total >= 0 ? '+' : ''}${total.toFixed(1)} pts a season`)
console.log(`for reference, champions to wooden spoon is ${spread.toFixed(1)} pts`)
console.log(`so an attentive manager moves ${(100 * total / Math.max(1, spread)).toFixed(0)}% of the league's whole quality range`)

// ---- the tripwires ----
ok(M('sheet', 'pts') > M('sleepwalk', 'pts'),
  `picking your side beats not picking it (${M('sheet', 'pts').toFixed(1)} vs ${M('sleepwalk', 'pts').toFixed(1)})`)
ok(total < spread,
  `the toolbox is worth less than the league's whole quality range (${total.toFixed(1)} vs ${spread.toFixed(1)} pts)`)
ok(out.sleepwalk.reduce((s, r) => s + r.titles, 0) <= SEEDS.length,
  `a manager who never opens a screen does not walk the league (${out.sleepwalk.reduce((s, r) => s + r.titles, 0)} titles)`)

console.log(fails ? `STACK PROBE FAILED (${fails})` : 'STACK PROBE PASSED: the toolbox is worth something, and not everything')
if (fails) process.exit(1)
