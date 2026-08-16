// What tank does a replacement carry onto the pitch?
//
// User: "a player who had low energy before the game who was on the bench
// suddenly had 100% when coming on from the bench."
//
// He was right, and the cause was not the substitution. Five of the six sites
// that put a man on the pitch set his energy from his condition; the sixth was
// applyBrief, which ran a tick later and wrote a flat 100 for any seat briefed
// 'impact'. A 45% man came on full because of what his SEAT had been told.
//
// The half of it that a probe has to pin down is the direction: a flat 100 is
// not a bonus, it is a reset, and a reset REWARDS EXHAUSTION. The fresher the
// man, the less he gains. That is the assertion below that would have caught
// it - not "is he under 100", which a lucky sample could pass, but "does the
// tired man gain more than the fresh one".
import { newGame } from '../src/game/newgame'
import { beginMatch, makeSubstitution } from '../src/game/matchEngine'
import { userFixtureThisWeek, weekRng, processWeekAndAdvance } from '../src/game/season'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

/** Put a career on the road to a real fixture with a real bench. */
function atAMatch(seed: number) {
  const g = newGame('northampton', 'Bench Probe', seed)
  for (let i = 0; i < 40; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx && !fx.played) return { g, fx }
    processWeekAndAdvance(g)
  }
  throw new Error('no fixture found')
}

// ---- the measurement: run the SAME substitution twice ---------------------
//
// Once with the bench on its default brief and once with every seat briefed
// 'impact', and compare the tanks man for man. That pairing is what isolates
// the bug: the flat 100 lived in applyBrief, so the brief's CONTRIBUTION is
// the quantity to bound, and an absolute test would be measuring the 60 floor
// instead (a deliberate rule - an hour sitting down is worth something - which
// on its own gives a 40% man +20 and a 96% man nothing).
//
// On the broken build the contribution was 100 minus whatever he had, so it
// paid +40 to the exhausted and +4 to the fresh. It must now be the same small
// number for everybody, whatever shape they are in.
const TIRED = 40
const FRESH = 96

/** Empty a bench onto the pitch and report the tank each man carried on. */
function walkTheBench(seed: number, briefed: boolean) {
  const { g, fx } = atAMatch(seed)
  if (briefed) g.clubs[g.userClubId].tactic.briefs = Array(23).fill('impact')
  const ctx = beginMatch(g, fx, weekRng(g), true, g.userClubId)
  const mine = ctx.home.teamId === ctx.userSideId ? ctx.home : ctx.away
  const bench = mine.lineup.slice(15, 23).filter((id): id is number => id != null)
  // alternate tired and fresh so both shapes are represented on the same bench
  bench.forEach((id, i) => { const p = g.players[id]; if (p) p.cond = i % 2 === 0 ? TIRED : FRESH })
  const out: { id: number; name: string; cond: number; tank: number }[] = []
  for (const id of bench) {
    const p = g.players[id]
    if (!p) continue
    const outId = mine.lineup.slice(0, 15).find(x => x != null && mine.onPitch.has(x)) as number | undefined
    if (outId == null) break
    const cond = p.cond
    makeSubstitution(g, ctx, outId, id)
    const tank = mine.energy.get(id)
    if (tank != null) out.push({ id, name: p.name, cond, tank })
  }
  return out
}

{
  const plain = walkTheBench(4242, false)
  const brief = walkTheBench(4242, true)
  const byId = new Map(plain.map(r => [r.id, r]))

  console.log('\n  cond -> tank, unbriefed vs briefed')
  const paid: { cond: number; extra: number }[] = []
  for (const b of brief) {
    const p = byId.get(b.id)
    if (!p) continue
    const extra = b.tank - p.tank
    paid.push({ cond: b.cond, extra })
    console.log(`    ${b.name.padEnd(22)} cond ${String(b.cond).padStart(3)}   ${p.tank.toFixed(0).padStart(3)} -> ${b.tank.toFixed(0).padStart(3)}   brief paid +${extra.toFixed(0)}`)
  }

  ok(plain.length >= 4 && brief.length >= 4, `both benches emptied (${plain.length} / ${brief.length})`)
  ok(paid.length >= 4, `the same men were compared in both runs (${paid.length})`)

  // 1. A BRIEF TOPS UP, IT DOES NOT RESET. Nobody gains more than the stated
  //    top-up from being told to go through them.
  const worst = Math.max(0, ...paid.map(r => r.extra))
  ok(worst <= 8.001, `no brief is worth more than 8 points of tank (worst +${worst.toFixed(0)})`)

  // 2. AND IT DOES NOT PAY MORE TO THE EXHAUSTED, which is the shape of the
  //    bug rather than its size: a reset to full is worth +40 to a man on 60
  //    and +4 to a man on 96, so the optimal play was to brief your most
  //    knackered forward as the impact man.
  const t = paid.filter(r => r.cond === TIRED).map(r => r.extra)
  const f = paid.filter(r => r.cond === FRESH).map(r => r.extra)
  if (t.length && f.length) {
    const mt = Math.max(...t), mf = Math.max(...f)
    ok(mt <= mf + 4.001,
      `the brief does not pay more to the tired than the fresh (+${mt.toFixed(0)} vs +${mf.toFixed(0)})`)
  }

  // 3. And the absolute ceiling: floor 60 plus the top-up, never a full tank.
  const over = brief.filter(r => r.cond === TIRED && r.tank > 68.001)
  ok(over.length === 0,
    `a man who warmed up on ${TIRED}% never comes on above 68 (${over.length} did)`)
}

console.log(fails ? `\nBENCH TANK FAILED (${fails})` : '\nBENCH TANK PASSED: a replacement brings the legs he actually has')
process.exit(fails ? 1 : 0)
