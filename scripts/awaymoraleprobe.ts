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
// into the season: past the ledger's six-match grace
for (let i = 0; i < 70 && base.week < 14; i++) processWeekAndAdvance(base)
const club = base.clubs[base.userClubId]
// a fit senior man with a game or more, outside the 23 the side is named
// from (so he stays out without touching the sheet), not a key player
const sheet = new Set(club.tactic.lineup)
const pick = (g: GameState): Player => club.players.map(id => g.players[id])
  .filter(p => p && !sheet.has(p.id) && !p.acad && !p.injury && !p.natSquad && p.bans === 0 && !p.onLoan && p.stats.apps >= 1 && p.status !== 'key')
  .sort((a, b) => a.id - b.id)[0]
const who = pick(base)
console.log(`  week ${base.week}, ${who.name}: ${who.stats.apps} apps, available for ${who.avail}`)

// ---- 1. back from injury: the first weeks back are not a grievance
{
  // the same man, the same nine weeks without a game: once because he was
  // injured for eight of them (just back), once because he was fit and left
  // out (the grievance the drag is for)
  const run = (injured: boolean) => {
    const g = structuredClone(base)
    const p = g.players[who.id]
    p.lastWk = g.week - 9
    p.outWk = injured ? g.week - 1 : undefined
    if (injured) p.avail = Math.max(0, (p.avail ?? 0) - 8)
    p.morale = 7
    const before = p.morale
    for (let w = 0; w < 2; w++) processWeekAndAdvance(g)
    return before - p.morale
  }
  const back = run(true), leftOut = run(false)
  console.log(`  two weeks unpicked: just back from injury -${back.toFixed(2)}, fit and left out -${leftOut.toFixed(2)}`)
  ok(leftOut > back + 0.2, `a fit man left out for weeks still feels it (-${leftOut.toFixed(2)})`)
  ok(back < 0.15, `a man just back from injury does not (-${back.toFixed(2)}, the ordinary weekly drift only)`)
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
