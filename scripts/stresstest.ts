// Interactive-path fuzz: play many matches the way a chaotic user would —
// random pauses, talks, subs, tactic slams and penalty calls — and assert
// the engine's invariants hold every tick.
import { newGame } from '../src/game/newgame'
import { userFixtureThisWeek, weekRng, processWeekAndAdvance } from '../src/game/season'
import {
  applyPreTalk, applyTeamTalk, applyTacticsChange, beginMatch, makeSubstitution,
  resolveDecision, stepTick, sideEnergy, MAX_SUBS,
} from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const g = newGame('bath', 'Fuzzer', 424242)
const fuzz = mulberry32(99)
let bugs = 0
const fail = (m: string) => { console.error('INVARIANT FAIL:', m); bugs++ }

for (let match = 0; match < 60; match++) {
  const fx = userFixtureThisWeek(g)
  if (!fx) { processWeekAndAdvance(g); continue }
  const ctx = beginMatch(g, fx, weekRng(g), true)
  if (fuzz() < 0.7) applyPreTalk(g, ctx, (['calm', 'fire', 'underdog', 'expect', 'enjoy'] as const)[Math.floor(fuzz() * 5)])
  let guard = 0
  while (ctx.seg < 3 && guard++ < 500) {
    if (ctx.decision) {
      resolveDecision(g, ctx, (['posts', 'corner', 'tap'] as const)[Math.floor(fuzz() * 3)])
      continue
    }
    if (ctx.awaiting) {
      if (ctx.awaiting === 'HT' && fuzz() < 0.8) applyTeamTalk(g, ctx, (['fire', 'calm', 'praise', 'demand'] as const)[Math.floor(fuzz() * 4)])
      ctx.awaiting = null
    }
    // chaotic touchline behaviour
    if (fuzz() < 0.15) {
      const club = g.clubs[g.userClubId]
      club.tactic.tempo = Math.floor(fuzz() * 101)
      club.tactic.style = Math.floor(fuzz() * 101)
      applyTacticsChange(g, ctx)
    }
    if (fuzz() < 0.12) {
      const mine = ctx.home.teamId === g.userClubId ? ctx.home : ctx.away
      const outs = mine.lineup.slice(0, 15).filter(id => id != null && mine.onPitch.has(id!))
      const ins = mine.lineup.slice(15).filter(id => id != null && !mine.onPitch.has(id!) && !mine.ratings.has(id!) && !g.players[id!].injury)
      if (outs.length && ins.length) {
        makeSubstitution(g, ctx, outs[Math.floor(fuzz() * outs.length)]!, ins[Math.floor(fuzz() * ins.length)]!)
      }
    }
    stepTick(g, ctx)

    // ---- invariants every tick ----
    for (const side of [ctx.home, ctx.away]) {
      const xvOnPitch = side.lineup.slice(0, 15).filter(id => id != null && side.onPitch.has(id!)).length
      if (side.onPitch.size > 15) fail(`onPitch ${side.onPitch.size} > 15 (${side.teamId})`)
      if (xvOnPitch > 15) fail('xv overflow')
      if (side.score < 0 || side.score > 200) fail(`insane score ${side.score}`)
      const e = sideEnergy(side)
      if (e < 0 || e > 100) fail(`energy out of range ${e}`)
      // nobody plays for both teams
    }
    const both = [...ctx.home.onPitch].filter(id => ctx.away.onPitch.has(id))
    if (both.length) fail(`player on both teams: ${both.length}`)
    // against the engine's own cap, not a remembered number: this said `> 5`
    // after the bench grew to eight, and every sixth legal change was reported
    // as an invariant failure (round 22 found it, along with the exit-code bug
    // below that had kept the false alarm quiet)
    if (ctx.subsUsed > MAX_SUBS) fail(`subsUsed ${ctx.subsUsed}`)
    let lastMin = 0
    for (const e of ctx.events) {
      if (e.type !== 'HT' && e.type !== 'FT' && e.type !== 'BRK') {
        if (e.min < lastMin - 1) fail(`minute went backwards ${lastMin} -> ${e.min}`)
        lastMin = Math.max(lastMin, e.min)
      }
    }
  }
  if (ctx.seg !== 3) fail(`match never finished (guard blown)`)
  if (!fx.played) fail('fixture not marked played')
  if (fx.homeScore !== ctx.home.score || fx.awayScore !== ctx.away.score) fail('score mismatch fixture vs ctx')
  processWeekAndAdvance(g)
}
console.log(bugs === 0 ? `FUZZ CLEAN: 60 chaotic interactive matches, all invariants held` : `${bugs} INVARIANT FAILURES`)
// the verdict has to reach the exit code, or `suite.sh all` reads a red run as
// green: it did, for as long as the stale invariant above was firing
process.exit(bugs ? 1 : 0)
