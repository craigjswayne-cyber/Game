/**
 * OVERRIDE THE ASSISTANT AND THE RECORD SAYS SO.
 *
 * A man goes down, the assistant sends somebody on, and the manager changes it
 * before play resumes. Reported from a real match: "I overrode the suggestion
 * and chose someone else but the commentary still mentioned the original
 * player." It did, and worse than it sounds - the ticker is not a display list,
 * it is the match record saved with the fixture and read back on the report
 * screen, so a substitution that never happened was in the paperwork for ever.
 *
 * The assistant's man never plays a second, so from v1.5.5 the line that says
 * he came on is rewritten to name the man who actually did. This drives a real
 * match until an injury forces a change, overrides it, and reads the ticker.
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, playSegment, swapInjuryCover, autoSelect, availablePlayers, rosterOf } from '../src/game/matchEngine'
import type { LiveCtx } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`  ${c ? 'ok  ' : 'FAIL'}  ${what}`); if (!c) fails++ }

const g = newGame('leicester', 'Cover', 4242)
const me = g.userClubId
const oppId = Object.keys(g.clubs).find(id => id !== me && g.clubs[id].leagueId === g.clubs[me].leagueId)!

/** Play matches until the engine sends somebody on for an injury of ours. */
function findForcedSub(): { ctx: LiveCtx; onId: number; at: number } | null {
  for (let i = 0; i < 400; i++) {
    for (const cid of [me, oppId]) {
      const c = g.clubs[cid]
      for (const id of c.players) { const p = g.players[id]; if (p) { p.injury = null; p.bans = 0; p.cond = 100 } }
      c.tactic.lineup = autoSelect(g, availablePlayers(g, rosterOf(g, cid)))
    }
    const fx = { id: g.nextId++, compId: 'prem', round: 0, week: g.week, homeId: me, awayId: oppId, played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0 } as Fixture
    const ctx = beginMatch(g, fx, mulberry32(9000 + i), true)
    for (let k = 0; k < 6 && ctx.tick < 20; k++) {
      playSegment(g, ctx)
      const at = [...ctx.events].reverse().findIndex(e => e.k === 'comm.subComesOn' && e.teamId === me)
      if (at >= 0) {
        const idx = ctx.events.length - 1 - at
        const onId = ctx.events[idx].playerId
        // only an INJURY forces one, and only while he is still on the pitch
        const hurt = ctx.events.slice(0, idx).reverse().find(e => e.type === 'INJ')
        if (onId != null && hurt && ctx.home.onPitch.has(onId)) return { ctx, onId, at: idx }
      }
    }
  }
  return null
}

const found = findForcedSub()
if (!found) {
  console.log('  FAIL  no forced substitution in 400 matches - the probe found nothing to test')
  fails++
} else {
  const { ctx, onId, at } = found
  const mine = ctx.home
  const assistantsMan = g.players[onId]
  console.log(`\n  the assistant sent on ${assistantsMan.name} (line ${at}: "${ctx.events[at].text}")`)
  // A LIKE-FOR-LIKE OVERRIDE when the bench has one. The first free man used
  // to be taken whatever he played, and once the TMO moved the stream that
  // was a hooker for an injured centre - and the engine rightly said so
  // ("out of cover ... finishes the game at CE"), which is news about the man
  // who came on, not a line explaining the change. So the probe asks for the
  // swap it means to test, and only falls back to any free man if it must.
  const free = mine.lineup.slice(15)
    .map(id => (id != null ? g.players[id] : null))
    .filter(p => !!p && p.id !== onId && !p.injury && !mine.onPitch.has(p.id) && !mine.ratings.has(p.id))
  const other = free.find(p => p!.pos === assistantsMan.pos) ?? free[0]
  if (!other) {
    console.log('  FAIL  no second bench option to override with')
    fails++
  } else {
    const before = ctx.events.length
    // HAS HE DONE ANYTHING SINCE HE CAME ON? The probe used to assume not, and
    // rode its luck: it takes the LAST substitution in up to six segments of
    // rugby, which can be ten minutes old, and once the territory and
    // advantage work put more tries in those ten minutes the assistant's man
    // started scoring them. That is not a flake, it is the second half of the
    // feature - a cover who has played cannot be erased, because his try is in
    // the record - so the probe now tests whichever case it was handed.
    const played = ctx.events.slice(at + 1).some(e => e.playerId === onId)
    const msg = swapInjuryCover(g, ctx, onId, other.id)
    console.log(`  override: ${msg}`)
    if (played) {
      console.log(`  (${assistantsMan.name} had already played: the window is shut)`)
      ok(mine.onPitch.has(onId) && !mine.onPitch.has(other.id),
        `${assistantsMan.name} stays on - a man who has played cannot be taken back off`)
      ok(ctx.events[at].playerId === onId,
        'and the record still says it was him who came on')
      ok(ctx.events.length === before, 'and nothing was written about a change that did not happen')
    } else {
      ok(mine.onPitch.has(other.id) && !mine.onPitch.has(onId),
        `${other.name} is on and ${assistantsMan.name} is not`)
      ok(ctx.events[at].playerId === other.id,
        `the line that said somebody came on now names ${other.name}`)
      ok(ctx.events[at].text.includes(other.name) && !ctx.events[at].text.includes(assistantsMan.name),
        `and reads "${ctx.events[at].text}"`)
      const named = ctx.events.filter(e => (e.text ?? '').includes(assistantsMan.name))
      ok(named.length === 0,
        `the assistant's man is nowhere in the commentary (${named.length} line(s): ${named.map(e => e.text).join(' / ').slice(0, 120)})`)
      const added = ctx.events.slice(before).filter(e => e.k !== 'comm.outOfCover')
      ok(added.length === 0,
        'and no second line was added to explain a change the record no longer needs explaining')
    }
  }
}

console.log(fails ? `\nCOVER SWAP FAILED (${fails})` : '\nCOVER SWAP PASSED: the man who never came on is not in the record')
process.exit(fails ? 1 : 0)
