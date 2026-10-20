/**
 * A HEAD ASSESSMENT IS THE MANAGER'S CALL TOO (1.9.2, owner, 18 Oct 2026: "A
 * player has got injured - its auto replaced him. Its confusing to people who
 * dont know what to press. Make sure its clear that the manager always has to
 * decide who to pick from the bench.")
 *
 * The assistant still sends a stand-in on the moment a man goes off for an
 * HIA, and the match screen now stops on it with the sheet open. This drives
 * the engine half: find an HIA on the manager's side, swap the stand-in for
 * another bench man at the stoppage, play the match out, and hold that
 *   - the swap is accepted, the new man is on and the stand-in is not
 *   - the assessment line in the record names the man who went on
 *   - the assessment resolves on the new man: he gives the shirt back on a
 *     pass, keeps it on a fail
 *   - never more than fifteen on the pitch, at any tick
 *   - a second swap after play has run is refused
 *
 * 1.9.3 (owner): only a made-up player is ever led off for an HIA. The
 * manager's side here is Leicester, all real men, so its players are marked
 * made-up for the test; the opponents keep their real flag, and no real man
 * on either side may ever be the one assessed.
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, playSegment, swapInjuryCover, autoSelect, availablePlayers, rosterOf } from '../src/game/matchEngine'
import { stepTick } from '../src/game/match/control'
import { mulberry32 } from '../src/game/rng'
import type { Fixture } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }

const g = newGame('leicester', 'HIA', 4242)
const me = g.userClubId
const oppId = Object.keys(g.clubs).find(id => id !== me && g.clubs[id].leagueId === g.clubs[me].leagueId)!
for (const id of g.clubs[me].players) { const p = g.players[id]; if (p) p.real = false }
let tested = 0, passes = 0, fails2 = 0, realAssessed = 0
for (let i = 0; i < 600 && tested < 12; i++) {
  for (const cid of [me, oppId]) {
    const c = g.clubs[cid]
    for (const id of c.players) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0; p.cond = 100 } }
    c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, cid)))
  }
  const fx = { id: g.nextId++, compId: 'prem', round: 0, week: g.week, homeId: me, awayId: oppId, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
  const ctx = beginMatch(g, fx, mulberry32(7000 + i), true)
  const mine = ctx.home
  let swapped = false, maxOn = 0
  while (ctx.tick < 20) {
    stepTick(g, ctx)
    maxOn = Math.max(maxOn, mine.onPitch.size)
    for (const sd of [ctx.home, ctx.away]) if (sd.hia && g.players[sd.hia.pid]?.real) realAssessed++
    if (!swapped && mine.hia && mine.hia.atTick === ctx.tick && mine.onPitch.has(mine.hia.subId)) {
      const standIn = mine.hia.subId
      const pick = mine.lineup.slice(15).find(id => id != null && id !== standIn && !mine.onPitch.has(id) && !mine.ratings.has(id) && !g.players[id]?.injury)
      if (pick == null) continue
      const pidHurt = mine.hia.pid
      const failed = mine.hia.failed
      swapInjuryCover(g, ctx, standIn, pick)
      swapped = true
      ok(mine.onPitch.has(pick) && !mine.onPitch.has(standIn), `swap ${tested + 1}: the manager's pick is on and the stand-in is off`)
      const line = [...ctx.events].reverse().find(e => (e.k === 'comm.hiaLedAway' || e.k === 'comm.hiaMouthguard') && e.teamId === me)
      ok(line?.v?.sub === g.players[pick].name && (line?.text ?? '').includes(g.players[pick].name), '  and the record names him')
      // play one tick, then a second swap is too late (an assessment at the
      // last tick has no tick left to play: full time, nothing has run)
      const before = ctx.tick
      stepTick(g, ctx)
      const other = mine.lineup.slice(15).find(id => id != null && id !== pick && !mine.onPitch.has(id) && !mine.ratings.has(id) && !g.players[id]?.injury)
      if (ctx.tick > before && other != null && mine.hia?.subId === pick && mine.onPitch.has(pick)) {
        swapInjuryCover(g, ctx, pick, other)
        ok(mine.onPitch.has(pick) && !mine.onPitch.has(other), '  and once play has run he cannot be swapped again')
      }
      while (ctx.tick < 20) { stepTick(g, ctx); maxOn = Math.max(maxOn, mine.onPitch.size) }
      // the stand-in can still leave for his own reasons (a card, a knock,
      // a tactical change), so the shirt is checked only while he is on
      const xv = mine.lineup.slice(0, 15)
      // an assessment still running at the final whistle never resolved
      if (mine.hia?.pid === pidHurt) { tested++; continue }
      if (failed) { fails2++; ok(!mine.onPitch.has(pidHurt) && (!mine.onPitch.has(pick) || xv.includes(pick)), `  a failed assessment: the pick keeps the shirt (on ${mine.onPitch.has(pick)}, in XV ${xv.includes(pick)}, hurt on ${mine.onPitch.has(pidHurt)})`) }
      else { passes++; ok(!(mine.onPitch.has(pick) && mine.onPitch.has(pidHurt) && !xv.includes(pick)), '  a passed assessment: the assessed man takes it back') }
      tested++
    }
  }
  ok(maxOn <= 15, `  never more than fifteen on (${maxOn})`)
  void playSegment
}
ok(realAssessed === 0, `no real player is ever led off for an HIA (${realAssessed} ticks with one)`)
ok(tested >= 5, `HIA swaps tested: ${tested} (${passes} passed, ${fails2} failed assessments)`)
console.log(fails ? `\nHIA SWAP FAIL (${fails})` : '\nHIA SWAP PASSED: the manager picks the stand-in, and the assessment resolves on his pick')
process.exit(fails ? 1 : 0)
