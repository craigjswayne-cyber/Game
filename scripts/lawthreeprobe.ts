// Probe: the uncontested-scrums warning is about the side that takes the field.
//
// Reported from a live game, from the Bath save: "my wife had props on the bench
// and a hooker but the game flashed up this message" - the red UNCONTESTED SCRUMS
// warning, saying her 23 could not cover tighthead, 1 of 2.
//
// She was right and the warning was wrong. Law 3 needs two men able to play each
// front-row shirt, and frontRowCover does not count a man who is injured. The
// warning used to read the team sheet EXACTLY AS SAVED, so a tighthead who picked
// up a knock during the week and was still sitting in the 3 shirt took the count
// from two to one - and the warning shouted about the scrum while a tighthead sat
// on the bench she was looking at.
//
// The engine never had the bug: beginMatch feeds frontRowCover the sheet AFTER
// repairSheet has swapped the injured man out, so the scrum was contested all
// along. Only the warning was wrong, which is the worst version of it: it told her
// to fix a side that needed no fixing.
//
// So this holds both directions, because a warning that never fires is as useless
// as one that always does:
//   - a knock to a named front-rower must NOT raise it while cover exists
//   - a squad that genuinely cannot cover a shirt MUST still raise it
import { readFileSync } from 'node:fs'
import { newGame } from '../src/game/newgame'
import { frontRowCover, repairSheet } from '../src/game/matchEngine'
import { splitFor } from '../src/game/bench'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** exactly what the pre-match warning now asks. */
function cover(g: GameState, clubId: string) {
  const club = g.clubs[clubId]
  return frontRowCover(g, repairSheet(g, club, club.tactic.lineup, splitFor(club)))
}
/** and what it used to ask: the sheet as the manager left it. */
function coverAsSaved(g: GameState, clubId: string) {
  return frontRowCover(g, g.clubs[clubId].tactic.lineup)
}

const knock = (p: Player) => { p.injury = { desc: 'knee ligament damage', weeks: 6 } }

console.log('a front-rower picks up a knock and is still named in the XV:\n')

for (const clubId of ['bath', 'northampton', 'saracens', 'leicester']) {
  const g: GameState = newGame(clubId, 'Law 3 Probe', 909)
  const club = g.clubs[clubId]
  // the manager picked this side himself, so nothing is allowed to re-pick it
  club.tactic.userPicked = true
  const before = cover(g, clubId)
  if (!before.legal) { bad(`${clubId}: the starting 23 is already illegal, so this seed proves nothing`); continue }

  // injure each of the three front-row shirts in turn, one save each
  for (const [slot, word] of [[0, 'loosehead'], [1, 'hooker'], [2, 'tighthead']] as const) {
    const h: GameState = JSON.parse(JSON.stringify(g))
    const id = h.clubs[clubId].tactic.lineup[slot]!
    const man = h.players[id]
    knock(man)
    const saved = coverAsSaved(h, clubId)
    const plays = cover(h, clubId)
    const named = h.clubs[clubId].tactic.lineup.slice(15, 23)
      .map(x => x != null ? h.players[x] : null)
      .filter((p): p is Player => !!p && !p.injury)
    const benchFR = named.filter(p => ['LP', 'HK', 'TP'].includes(p.pos)).length
    console.log(`  ${clubId}: ${man.name} (${man.pos}) hurt in the ${word} shirt, ` +
      `${benchFR} fit front-rowers on the bench`)
    console.log(`     as saved LP ${saved.LP} HK ${saved.HK} TP ${saved.TP} legal ${saved.legal}` +
      ` | as it will play LP ${plays.LP} HK ${plays.HK} TP ${plays.TP} legal ${plays.legal}`)
    ok(plays.legal, `${clubId}: the ${word} knock does not cost ${clubId} its scrum`)
  }
}

// ---- and the warning must still fire when it should ----
//
// Strip the club of every man who can play tighthead but one. That is a real
// shortage, not a stale sheet, and the referee is right to reach for it.
//
// THE ACADEMY COUNTS, and it took a failing run of this probe to notice. The first
// draft injured every SENIOR tighthead bar one and still could not raise the
// warning, because repairSheet fills a hole from availablePlayers and the academy
// is real cover - an academy tighthead gets named on the bench when the seniors
// run dry, which is exactly what a club does in a front-row crisis. So a genuine
// shortage means the whole building, age groups included.
console.log('\na squad that genuinely cannot cover a front-row shirt:\n')
{
  const g: GameState = newGame('bath', 'Law 3 Probe', 909)
  const club = g.clubs.bath
  club.tactic.userPicked = true
  const ths = club.players.map(id => g.players[id])
    .filter(p => p && (p.pos === 'TP' || p.alt.includes('TP')))
  console.log(`  Bath can field ${ths.length} tightheads including the academy; injuring all but one`)
  for (const p of ths.slice(1)) knock(p)
  const plays = cover(g, 'bath')
  console.log(`     as it will play LP ${plays.LP} HK ${plays.HK} TP ${plays.TP} legal ${plays.legal}`)
  ok(!plays.legal && plays.TP < 2, 'one tighthead in the building still raises the warning')
}

// ---- and an empty sheet is not quietly declared legal ----
{
  const g: GameState = newGame('bath', 'Law 3 Probe', 909)
  const club = g.clubs.bath
  club.tactic.userPicked = true
  club.tactic.lineup = Array.from({ length: 23 }, () => null)
  const plays = cover(g, 'bath')
  console.log(`\nan empty sheet, repaired: LP ${plays.LP} HK ${plays.HK} TP ${plays.TP} legal ${plays.legal}`)
  ok(plays.legal, 'an empty sheet is filled with a legal front row rather than shouted at')
}

// ---- and the screen has to be the thing asking ----
//
// Everything above proves the pair of helpers agree with Law 3. It does not prove
// the WARNING uses them, and the whole bug was one call site passing the raw sheet.
// So read the screen and check, because a probe that would pass through a revert of
// the fix is not guarding the fix.
{
  const src = readFileSync(new URL('../src/ui/screens/MatchDay.tsx', import.meta.url), 'utf8')
  const calls = [...src.matchAll(/frontRowCover\(([^)]*\)?[^)]*)\)/g)].map(m => m[1])
  console.log(`\nfrontRowCover call sites on the match screen: ${calls.length}`)
  for (const c of calls) console.log(`  frontRowCover(${c.replace(/\s+/g, ' ').slice(0, 70)})`)
  ok(calls.length > 0, 'the match screen still asks about the front row at all')
  ok(calls.every(c => c.includes('repairSheet')),
    'every call passes the repaired sheet, not the sheet as saved')
}

if (fails) { console.error(`\nLAW 3 PROBE: ${fails} failures`); process.exit(1) }
console.log('\nLAW 3 PROBE PASSED: the warning judges the side that plays')
