/**
 * ---- THE MANAGER NAMES WHO COVERS AN INJURY (1.9.1) ----
 *
 * Owner: "If a player is injured in game - it shouldnt be auto select - the
 * player must select them ... If they have no subs left then the game can
 * continue but they will be reduced in numbers", and "it said a player was
 * injured and needs to be replaced, number 20 was the player BUT he was
 * already in the animation before the notification of an injury".
 *
 *   1. in a match he is watching, his man goes down and NOBODY goes on: the
 *      shirt still holds the injured man, the side is a man short, and the
 *      match waits (injWait)
 *   2. the man he names goes on in that shirt, and the wait is over
 *   3. a man who is not on the bench is refused, and changes nothing
 *   4. a caller that steps on regardless gets the assistant's pick
 *   5. a match nobody is watching is played exactly as before
 *
 * Run: npx vite-node scripts/injpickprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, coverInjury, stepTick, type LiveCtx } from '../src/game/matchEngine'
import { userFixtureThisWeek, processWeekAndAdvance, matchRng } from '../src/game/season'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** play watched matches until one of his men is down and waiting */
function findWait(manual: boolean): { g: GameState; ctx: LiveCtx } | null {
  for (let seed = 1; seed < 400; seed++) {
    const g = newGame('leicester', 'Inj Probe', seed)
    for (let i = 0; i < 6 && !userFixtureThisWeek(g); i++) processWeekAndAdvance(g)
    const fx = userFixtureThisWeek(g)
    if (!fx) continue
    const ctx = beginMatch(g, fx, matchRng(g), true, g.userClubId)
    ctx.manualInj = manual
    while (ctx.seg < 3 && ctx.tick < 20) {
      if (ctx.awaiting) ctx.awaiting = null
      stepTick(g, ctx)
      if (ctx.injWait?.length) return { g, ctx }
    }
  }
  return null
}

console.log('--- 1. nobody goes on until he says')
const found = findWait(true)
ok(!!found, 'a watched match with one of his men down and waiting')
if (found) {
  const { g, ctx } = found
  const w = ctx.injWait![0]
  const side = w.home ? ctx.home : ctx.away
  const slot = side.lineup.indexOf(w.hurtId)
  ok(slot >= 0 && slot < 15, `his shirt still holds the injured man (slot ${slot + 1})`)
  const onNow = side.onPitch.size
  ok(!side.onPitch.has(w.hurtId) && side.short >= 1, `and the side is a man short (${onNow} on, short ${side.short})`)
  ok(ctx.events[w.at]?.type === 'INJ' && ctx.events[w.at]?.playerId === w.hurtId, 'the wait points at the injury line')
  ok(!ctx.events.slice(w.at).some(e => e.k === 'comm.subComesOn' && e.teamId === side.teamId), 'and no replacement line follows it')

  console.log('--- 3. a man who is not on the bench is refused')
  const starter = side.lineup.slice(0, 15).find(id => id != null && id !== w.hurtId)!
  ok(coverInjury(g, ctx, w.hurtId, starter) !== '' && ctx.injWait!.length > 0, 'a starter cannot be the replacement')

  console.log('--- 2. the man he names goes on')
  const bench = side.lineup.slice(15).filter((id): id is number => id != null && !side.ratings.has(id) && !g.players[id]?.injury)
  const hurt = g.players[w.hurtId]
  const frWant = ['LP', 'HK', 'TP'].includes(hurt.pos)
  // pick the LAST eligible man, so it is unlikely to be the assistant's choice
  const pick = [...bench].reverse().find(id => !frWant || ['LP', 'HK', 'TP'].some(p => g.players[id].pos === p || g.players[id].alt.includes(p as never)))
  ok(pick != null, 'there is somebody on the bench to send on')
  if (pick != null) {
    const msg = coverInjury(g, ctx, w.hurtId, pick)
    ok(msg === '', `accepted (${msg || 'no message'})`)
    ok(side.lineup[slot] === pick && side.onPitch.has(pick) && side.onPitch.size === onNow + 1, 'he takes the shirt, one more man on')
    ok(!ctx.injWait?.length, 'and the match waits no longer')
    stepTick(g, ctx)
    ok(ctx.tick > 0, 'play goes on')
  }
}

console.log('--- 4. stepping on regardless gets the assistant\'s pick')
const again = findWait(true)
if (again) {
  const { g, ctx } = again
  const w = ctx.injWait![0]
  const side = w.home ? ctx.home : ctx.away
  const slot = side.lineup.indexOf(w.hurtId)
  stepTick(g, ctx)
  ok(!ctx.injWait?.some(x => x.hurtId === w.hurtId) && side.lineup[slot] !== w.hurtId, 'the shirt is filled before the next minutes are played')
}

console.log('--- 5. nobody watching, nothing changes')
const auto = findWait(false)
ok(auto === null, 'a match without the flag never waits')

if (fails) { console.log(`\nINJURY PICK PROBE FAILED (${fails})`); process.exit(1) }
console.log('\nINJURY PICK PROBE PASSED: his man is hurt, his call who comes on')
