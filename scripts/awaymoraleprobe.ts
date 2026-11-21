/**
 * ---- AWAY IS NOT LEFT OUT (1.9.13) ----
 *
 * Player feedback: "Players get angry when your not playing them, but they
 * are often away inj or int duty". The game-time ledger (gametime.ts) already
 * billed only the weeks a man was available, but two other rules did not:
 *
 *   1. THE WEEKLY BENCH DRAG (season/training.ts) counted every week since his
 *      last game. A man back from eight weeks injured lost morale in his first
 *      week back. It now counts from the last week he could not be picked.
 *   2. 'PLANS' AND 'MINUTES' PROMISES (season.ts) were judged on games alone,
 *      so a man injured through the promise came back to a broken promise and
 *      a morale hit. A promise he was not available to collect is lifted.
 *
 * Both are checked against the same career played twice from one save: once
 * as it is, once with the fix's inputs taken away, so the world is the same.
 *
 * Run: npx vite-node scripts/awaymoraleprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { pledgeDue } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'
import { ok, done } from './lib/probe'

const base = newGame('leicester', 'Away Morale', 21)
// into the season: past the ledger's six-match grace, AND PAST THE AUTUMN
// TESTS (1.9.16). Week 14 is in the window (13 to 15): with every national
// squad now carrying a man for every shirt, enough of the club was in camp
// that nobody left behind could be left out, and the probe had no man to test
for (let i = 0; i < 70 && base.week < 17; i++) processWeekAndAdvance(base)
const club = base.clubs[base.userClubId]
// a fit senior man with a game or more, outside the 23 the side is named
// from (so he stays out without touching the sheet), not a key player
const sheet = new Set(club.tactic.lineup)
const candidates = club.players.map(id => base.players[id])
  .filter(p => p && !sheet.has(p.id) && !p.acad && !p.injury && !p.natSquad && p.bans === 0 && !p.onLoan && p.stats.apps >= 1 && p.status !== 'key')
  .sort((a, b) => a.id - b.id)
/** Two weeks of the scenario under test, on a copy of the world. */
const scenario = (id: number, injured: boolean, playedLastWeek = false) => {
  const g = structuredClone(base)
  const p = g.players[id]
  p.lastWk = playedLastWeek ? g.week - 1 : g.week - 9
  p.outWk = injured ? g.week - 1 : undefined
  if (injured) p.avail = Math.max(0, (p.avail ?? 0) - 8)
  p.morale = 7
  // the manager's own sheet (autopilotprobe's note): a sheet the game chose
  // is re-picked every week
  g.clubs[g.userClubId].tactic.userPicked = true
  const before = p.morale
  for (let w = 0; w < 2; w++) processWeekAndAdvance(g)
  return { drop: before - p.morale, stayedOut: (p.lastWk ?? -9) < g.week - 2 }
}
// THE MAN MUST REALLY BE LEFT OUT (1.9.15). Outside the 23 is not enough: a
// gap at kick-off sends the game to the squad for cover, and the man it found
// played both weeks, so the probe compared a man who played with a man who
// played. It now takes the first candidate who stays out in both versions.
const who = candidates.find(p => scenario(p.id, false).stayedOut && scenario(p.id, true).stayedOut) ?? candidates[0]
const pick = (_g: GameState): Player => who
console.log(`  week ${base.week}, ${who.name}: ${who.stats.apps} apps, available for ${who.avail}`)

// ---- 1. back from injury: the first weeks back are not a grievance
{
  // the same man, the same nine weeks without a game: once because he was
  // injured for eight of them (just back), once because he was fit and left
  // out (the grievance the drag is for)
  const stayedOut: boolean[] = []
  const run = (injured: boolean) => { const r = scenario(who.id, injured); stayedOut.push(r.stayedOut); return r.drop }
  const back = run(true), leftOut = run(false)
  ok(stayedOut.every(Boolean), `the man under test really stayed out both weeks (${stayedOut.join(', ')})`)
  console.log(`  two weeks unpicked: just back from injury -${back.toFixed(2)}, fit and left out -${leftOut.toFixed(2)}`)
  ok(leftOut > back + 0.2, `a fit man left out for weeks still feels it (-${leftOut.toFixed(2)})`)
  // AGAINST THE WEEK'S OWN DRIFT, NOT AGAINST NOUGHT (1.9.16). "The ordinary
  // weekly drift only" was tested as a drop under 0.15, which is true in a
  // fortnight where nothing else happens to the squad. On 1.9.16's re-dealt
  // world these two weeks are ones in which the whole dressing room loses
  // ground, and the man read -0.46 with no grievance in it. The control is
  // the same man in the same fortnight with a game in his legs last week,
  // who has nothing to be aggrieved about: just back from injury must sit
  // within 0.15 of HIM.
  const drift = scenario(who.id, false, true).drop
  console.log(`  the same fortnight for the same man with a game last week: -${drift.toFixed(2)}`)
  ok(Math.abs(back - drift) < 0.15, `a man just back from injury does not (-${back.toFixed(2)} against -${drift.toFixed(2)} for the fortnight itself: the ordinary drift only)`)
}

// ---- 1b. the stamp: an injured man's weeks are marked as out
{
  const g = structuredClone(base)
  const p = g.players[who.id]
  p.injury = { desc: 'hamstring', until: g.week + 3, weeks: 3, seen: true }
  processWeekAndAdvance(g)
  ok(p.outWk != null && p.outWk >= g.week - 1, `an injured man's week is stamped as one he could not be picked (outWk ${p.outWk}, week ${g.week})`)
}

// ---- 2. a promise he could not collect is lifted, not broken
{
  const run = (fixed: boolean) => {
    const g = structuredClone(base)
    const p = g.players[who.id]
    p.morale = 7
    ;(g.pledges ??= []).push({ playerId: p.id, kind: 'plans', week: g.week, season: g.season,
      due: pledgeDue(g.week, 2), baseApps: p.stats.apps, ...(fixed ? { baseAvail: p.avail ?? 0 } : {}) })
    const ids0 = new Set(g.news.map(n => n.id))
    for (let w = 0; w < 4; w++) {
      // injured for the whole of it
      p.injury = { desc: 'knee', until: g.week + 4, weeks: 4, seen: true }
      processWeekAndAdvance(g)
    }
    const fresh = g.news.filter(n => !ids0.has(n.id) && n.playerId === p.id).map(n => n.k)
    return { lifted: fresh.includes('news.promiseVoid'), broke: fresh.includes('news.brokePlans'), left: (g.pledges ?? []).some(x => x.playerId === p.id) }
  }
  const now = run(true), old = run(false)
  console.log(`  promise to an injured man: lifted ${now.lifted}, broken ${now.broke} (before the fix: broken ${old.broke})`)
  ok(old.broke, 'before the fix the promise to a man injured throughout was broken (the bug, reproduced)')
  ok(now.lifted && !now.broke, 'now it is lifted, and nobody is told the manager broke his word')
  ok(!now.left, 'and it is settled, not left hanging')
}

// ---- 2b. a fit man left out still holds the manager to it
{
  const g = structuredClone(base)
  const p = g.players[who.id]
  ;(g.pledges ??= []).push({ playerId: p.id, kind: 'plans', week: g.week, season: g.season,
    due: pledgeDue(g.week, 2), baseApps: p.stats.apps, baseAvail: p.avail ?? 0 })
  const ids0 = new Set(g.news.map(n => n.id))
  for (let w = 0; w < 4; w++) {
    p.injury = null; p.natSquad = false; p.bans = 0
    processWeekAndAdvance(g)
  }
  const fresh = g.news.filter(n => !ids0.has(n.id) && n.playerId === p.id).map(n => n.k)
  ok(fresh.includes('news.brokePlans') || fresh.includes('news.keptPlans'), `a fit man's promise is still judged, kept or broken (${fresh.filter(k => /Plans|promiseVoid/.test(k ?? '')).join(', ') || 'nothing'})`)
  ok(!fresh.includes('news.promiseVoid'), 'and is not lifted for him')
}

done('AWAY MORALE PROBE', 'injury and Test duty no longer count as being left out')
