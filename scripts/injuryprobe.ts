// The injury replacement is the manager's call (feedback 9-3).
//
// The engine has to fill the hole itself the moment a man goes down: the same
// code runs for fourteen AI sides and for Instant Result. So swapInjuryCover
// exists to let the UI undo the assistant's pick, free of charge, at the moment
// of the injury. This checks the rules it has to obey, because "free" is exactly
// the kind of thing that quietly becomes "five free changes a match".
import { newGame } from '../src/game/newgame'
import { weekRng } from '../src/game/season'
import { beginMatch, makeSubstitution, stepTick, swapInjuryCover } from '../src/game/matchEngine'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'Probe', 1)
const fx = g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!
const ctx = beginMatch(g, fx, weekRng(g), true)
for (let i = 0; i < 4; i++) stepTick(g, ctx)

const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
const onPitch = [...mine.onPitch]
const bench = mine.lineup.slice(15).filter((id): id is number =>
  id != null && !g.players[id].injury && !mine.onPitch.has(id) && !mine.ratings.has(id))

// Stand in for the assistant's pick: send a bench man on for a starter, the way
// the injury branch does, then let the manager change his mind.
const hurt = onPitch[3]
const assistantPick = bench[0]
makeSubstitution(g, ctx, hurt, assistantPick)
const spentAfterFirst = ctx.subsUsed
ok(spentAfterFirst === 1, 'the assistant coming on counts as a change here (baseline)')

const preferred = bench[1]
const msg = swapInjuryCover(g, ctx, assistantPick, preferred)
console.log(`  "${msg}"`)
ok(ctx.subsUsed === spentAfterFirst, 'the swap is free: subsUsed did not move')
ok(mine.onPitch.has(preferred), 'the preferred man is on the pitch')
ok(!mine.onPitch.has(assistantPick), "the assistant's pick is off it")
ok(mine.lineup.slice(0, 15).includes(preferred), 'he holds a starting shirt')
ok(!mine.ratings.has(assistantPick), 'the man who never got on carries no rating')
ok(mine.lineup.filter(id => id === preferred).length === 1, 'nobody appears twice in the squad')
ok(new Set(mine.lineup.filter(x => x != null)).size === mine.lineup.filter(x => x != null).length,
  'the whole match-day squad is still 1 shirt per man')
ok(ctx.events.some(e => e.type === 'SUB' && e.text.includes('Change of plan')),
  'the change is on the commentary record')

// and the rules it must refuse
ok(swapInjuryCover(g, ctx, assistantPick, bench[2]) === 'He is not on the pitch.',
  'refuses to swap a man who is not on the pitch')
ok(swapInjuryCover(g, ctx, preferred, preferred).startsWith('He is not available'),
  'refuses to swap a man for himself')
ok(swapInjuryCover(g, ctx, preferred, onPitch[0]).startsWith('He is not available'),
  'refuses to bring on someone already playing')
const spentBefore = ctx.subsUsed
swapInjuryCover(g, ctx, preferred, -1)
ok(ctx.subsUsed === spentBefore, 'a nonexistent player changes nothing')

console.log(fails ? `\nINJURY PROBE FAILED (${fails})` : '\nINJURY PROBE PASSED')
process.exit(fails ? 1 : 0)
