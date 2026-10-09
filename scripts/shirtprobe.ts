/**
 * ---- THE NUMBER HE WALKED OUT IN ----
 *
 * Owner, 1.8.16: "when a sub comes on his number is the same as the official
 * person who started in that position. If they are number 23 on the bench they
 * should be 23 on the pitch." Plays AI matches through and checks that every
 * man wears, all match, the number the sheet gave him at kick-off: 1-15 the XV,
 * 16-23 the bench, whatever shirt slot he fills after a change.
 *
 * Run: npx vite-node scripts/shirtprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { beginMatch, stepTick, resolveDecision, shirtNumber } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const g = newGame('leicester', 'Shirts', 4040)
const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId] && f.homeId !== g.userClubId && f.awayId !== g.userClubId).slice(0, 60)
let subs = 0, wrong = 0, moved = 0
for (const [i, fx] of fxs.entries()) {
  const ctx = beginMatch(g, fx, mulberry32(500 + i), true, null)
  const at0 = [ctx.home, ctx.away].map(s => new Map(s.lineup.map((id, k) => [id, k + 1] as const).filter(([id, k]) => id != null && k <= 23)))
  while (ctx.tick < 20 || ctx.decision) {
    if (ctx.decision) { resolveDecision(g, ctx, 'posts'); continue }
    stepTick(g, ctx)
    ;[ctx.home, ctx.away].forEach((s, k) => {
      s.lineup.slice(0, 15).forEach((id, slot) => {
        if (id == null) return
        const want = at0[k].get(id)
        if (want == null) return
        const n = shirtNumber(s, id)
        if (n !== want) wrong++
        if (want > 15) { subs++; if (slot + 1 !== want) moved++ }
      })
    })
  }
}
ok(subs > 100, `replacements seen in a starting shirt (${subs} man-ticks)`)
ok(moved === subs, `and every one is in a shirt slot that is not his own number (${moved} of ${subs})`)
ok(wrong === 0, `every man wears the number he had at kick-off, all match (${wrong} wrong)`)
console.log(fails ? `SHIRT PROBE FAILED (${fails})` : 'SHIRT PROBE PASSED: 23 on the bench is 23 on the pitch')
process.exit(fails ? 1 : 0)
