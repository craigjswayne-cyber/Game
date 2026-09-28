// ---- EVERY GAME PLAN OPTION DOES SOMETHING (1.8.0) ----
//
// Owner, 27 Sep 2026: "gameplay options are great - can you check they all
// have an impact on the games whichever you choose against the other[s]?"
//
// Every option on the Tactics screen, asked two things:
//
//   DOES IT DO SOMETHING? The engine's own numbers for the side at kick-off
//     (attack, defence, scrum, lineout, breakdown, kicking, tempo, penalty and
//     card risk, ruck security) are compared with the standard setting's, and
//     at least one must move. The zonal plan, the penalty call and the bench
//     act during play, so they are checked where they act: the plan the engine
//     reads in that zone, penalty goals taken, and who comes off the bench.
//     This is the honest test: 120 matches cannot tell a tenth of a try from
//     luck (about +-0.23 tries), but the engine's numbers are exact.
//   IS IT A META? Over 120 full matches (common random numbers: the same
//     fixture, state and dice, only the option differs, played the way the
//     Instant Result plays them), no option moves the average margin by more
//     than 4 points a match. If one did, every career would end up there.
//     The full outcome table is printed for anyone tuning.
//     HOW SURE THAT LINE IS. The margins are paired, but a plan that moves the
//     line changes every draw after it, so pairing buys less than it looks:
//     a zone plan's margin has a standard error of about 1.5 points on these
//     120 matches (sd of the paired difference about 16), 0.9 on 240. The line
//     is a verdict on the plan, not on the draw, so read one past it against
//     that before retuning: the long exit read +4.37 here and +3.7 to +4.2 on
//     reshuffled seeds (28 Sep 2026), which was a plan sitting ON the line
//     rather than a new fault. It was brought in (tactics.ts, own22 'long').
//
// And the matchups the Tactics text promises: a wide defence is worth more
// against a wide attack than a forward one, and a narrow defence the reverse.
//
// Run: npx vite-node scripts/optionsprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf, type SideCtx } from '../src/game/matchEngine'
import { refillBench } from '../src/game/bench'
import { playbookOf } from '../src/game/playbook'
import { mulberry32 } from '../src/game/rng'
import { DEF_SYSTEMS, PRESETS, zonePlan } from '../src/game/tactics'
import type { Fixture, GameState, Tactic } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!

type Stats = { margin: number; triesFor: number; triesAgainst: number; pensFor: number; cardsFor: number; pointsFor: number }

const pool: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47, 83, 101, 131, 157, 181, 211, 239, 263, 281, 307, 331, 353, 379, 401, 421, 443, 463, 487, 503, 521]) {
  for (const club of ['northampton', 'bath', 'exeter', 'sale', 'leicester']) {
    const g = newGame(club, 'Options', seed)
    pool.push({ g, fx: userFixture(g) })
  }
}

/** the user's side plays `set` (and the opponent `opp`) over the whole pool */
function play(set: Partial<Tactic>, opp: Partial<Tactic> = {}): Stats {
  const s: Stats = { margin: 0, triesFor: 0, triesAgainst: 0, pensFor: 0, cardsFor: 0, pointsFor: 0 }
  pool.forEach(({ g, fx }, i) => {
    const h = structuredClone(g)
    const me = h.userClubId
    const f = h.fixtures.find(x => x.id === fx.id)!
    const oppId = f.homeId === me ? f.awayId : f.homeId
    // the manager is not at the touchline in a simulated match: a penalty
    // call of 'ask' would otherwise wait for an answer
    Object.assign(h.clubs[me].tactic, { penaltyCall: 'posts' }, set)
    Object.assign(h.clubs[oppId].tactic, opp)
    // a new split reseats the bench, as it does when the manager picks one
    if (set.bench) refillBench(h, h.clubs[me])
    // a set-piece call is drilled over weeks before it pays (playbook.ts):
    // measure it as a side that has drilled it, not one calling it cold
    const pb = playbookOf(h.clubs[me])
    for (const id of [set.lineoutCall, set.scrumCall]) if (id) pb.drilled[id] = 100
    // played exactly as the Instant Result plays the manager's match: the
    // live engine, with the assistant making the changes
    const ctx = beginMatch(h, f, mulberry32(7000 + i * 13), true, me)
    ctx.assistantSubs = true
    playHalf(h, ctx); playHalf(h, ctx)
    const mine = ctx.home.teamId === me ? ctx.home : ctx.away
    const theirs = mine === ctx.home ? ctx.away : ctx.home
    s.margin += mine.score - theirs.score
    s.pointsFor += mine.score
    s.triesFor += mine.tries; s.triesAgainst += theirs.tries
    s.pensFor += mine.pens
    s.cardsFor += mine.yellowUntil.size + mine.sent
  })
  const n = pool.length
  return { margin: s.margin / n, triesFor: s.triesFor / n, triesAgainst: s.triesAgainst / n, pensFor: s.pensFor / n, cardsFor: s.cardsFor / n, pointsFor: s.pointsFor / n }
}

/** The side's numbers at kick-off, the way the engine will play them. */
function fingerprint(set: Partial<Tactic>, opp: Partial<Tactic> = {}) {
  const { g, fx } = pool[0]
  const h = structuredClone(g)
  const me = h.userClubId
  const f = h.fixtures.find(x => x.id === fx.id)!
  const oppId = f.homeId === me ? f.awayId : f.homeId
  Object.assign(h.clubs[me].tactic, { penaltyCall: 'posts' }, set)
  Object.assign(h.clubs[oppId].tactic, opp)
  const pb = playbookOf(h.clubs[me])
  for (const id of [set.lineoutCall, set.scrumCall]) if (id) pb.drilled[id] = 100
  const ctx = beginMatch(h, f, mulberry32(1), false, me)
  const side: SideCtx = ctx.home.teamId === me ? ctx.home : ctx.away
  const u = side.units
  return {
    attack: u.attack, defence: u.defence, scrum: u.scrum, lineout: u.lineout, breakdown: u.breakdown, kicking: u.kicking,
    tempo: side.tempoF, penRisk: side.penRisk, cardRisk: side.cardRisk, ruckSecure: side.ruckSecure ?? 1, ruckContest: side.ruckContest ?? 1,
  }
}
const baseFp = fingerprint({})
/** which of the side's numbers the option moved, and by how much */
function moved(set: Partial<Tactic>): string[] {
  const fp = fingerprint(set)
  return (Object.keys(fp) as (keyof typeof fp)[])
    .filter(k => Math.abs(fp[k] / (baseFp[k] || 1) - 1) > 0.001)
    .map(k => `${k} ${fp[k] > baseFp[k] ? '+' : ''}${((fp[k] / baseFp[k] - 1) * 100).toFixed(1)}%`)
}

const fmt = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`
const base = play({})
console.log(`standard setting over ${pool.length} matches: margin ${base.margin.toFixed(2)}, tries ${base.triesFor.toFixed(2)}-${base.triesAgainst.toFixed(2)}, pen goals ${base.pensFor.toFixed(2)}, cards ${base.cardsFor.toFixed(2)}`)

/** how far an option moved each number from the standard setting, and
 *  whether it does anything: by default the kick-off numbers must move; an
 *  option that acts during play passes its own check in `acts` */
function delta(name: string, set: Partial<Tactic>, acts?: () => [boolean, string]) {
  const r = play(set)
  const d = {
    margin: r.margin - base.margin, triesFor: r.triesFor - base.triesFor, triesAgainst: r.triesAgainst - base.triesAgainst,
    pensFor: r.pensFor - base.pensFor, cardsFor: r.cardsFor - base.cardsFor,
  }
  console.log(`  ${name.padEnd(22)} margin ${fmt(d.margin)}  tries ${fmt(d.triesFor)}/${fmt(d.triesAgainst)}  pens ${fmt(d.pensFor)}  cards ${fmt(d.cardsFor)}`)
  if (acts) {
    const [yes, how] = acts()
    ok(yes, `${name}: does something (${how})`)
  } else {
    const m = moved(set)
    ok(m.length > 0, `${name}: does something (${m.join(', ') || 'nothing moved at kick-off'})`)
  }
  ok(Math.abs(d.margin) <= 4, `${name}: not a meta (${fmt(d.margin)} points a match)`)
  return d
}

console.log('\n--- the four sliders, each end')
const up = (k: keyof Tactic) => ({ [k]: 90 }) as Partial<Tactic>
const down = (k: keyof Tactic) => ({ [k]: 10 }) as Partial<Tactic>
const styleUp = delta('style wide (90)', up('style'))
delta('style tight (10)', down('style'))
const tempoUp = delta('tempo fast (90)', up('tempo'))
delta('tempo slow (10)', down('tempo'))
delta('kicking heavy (90)', up('kicking'))
delta('kicking light (10)', down('kicking'))
const aggUp = delta('aggression high (90)', up('aggression'))
const aggDown = delta('aggression low (10)', down('aggression'))
ok(aggUp.cardsFor > 0 && aggDown.cardsFor < aggUp.cardsFor, 'aggression: more cards turned up, fewer turned down')
void styleUp
void tempoUp

console.log('\n--- the presets')
for (const p of PRESETS.filter(p => p.id !== 'balanced')) delta(`preset ${p.id}`, { ...p.values })

console.log('\n--- the defence systems')
for (const d of DEF_SYSTEMS.filter(d => d.id !== 'standard')) delta(`defence ${d.id}`, { defLine: d.line, defWidth: d.width })

console.log('\n--- the zonal plan')
// read by the engine every tick in the zone the ball is in (simTick: tryF,
// penF and territory), so the check is the plan the engine will read there
const zoned = (zone: 'own22' | 'middle' | 'opp22', id: string) => (): [boolean, string] => {
  const p = zonePlan(zone, id), n = zonePlan(zone, undefined)
  return [p.id === id && (p.tryF !== n.tryF || p.penF !== n.penF || p.terr !== n.terr),
    `try chance x${p.tryF}, penalty window x${p.penF}, territory ${p.terr >= 0 ? '+' : ''}${p.terr} in that zone`]
}
delta('own 22: kick long', { zones: { own22: 'long' } }, zoned('own22', 'long'))
delta('own 22: run it', { zones: { own22: 'play' } }, zoned('own22', 'play'))
delta('middle: territory', { zones: { middle: 'terr' } }, zoned('middle', 'terr'))
delta('middle: in hand', { zones: { middle: 'hand' } }, zoned('middle', 'hand'))
delta('their 22: drive', { zones: { opp22: 'drive' } }, zoned('opp22', 'drive'))
delta('their 22: spread', { zones: { opp22: 'spread' } }, zoned('opp22', 'spread'))

console.log('\n--- exits, kicking style, breakdown, penalties')
for (const exit of ['long', 'counter', 'fifty22'] as const) delta(`exit ${exit}`, { exit })
for (const kickStyle of ['territory', 'contest', 'attack'] as const) delta(`kick style ${kickStyle}`, { kickStyle, kicking: 60 })
delta('ruck commit many', { ruckCommit: 100 })
delta('ruck commit few', { ruckCommit: 0 })
delta('ruck contest hard', { ruckContest: 100 })
delta('ruck contest none', { ruckContest: 0 })
const fewerGoals = (call: 'corner' | 'tap') => (): [boolean, string] => {
  const r = play({ penaltyCall: call })
  return [r.pensFor < base.pensFor - 0.5, `${r.pensFor.toFixed(2)} penalty goals a match against ${base.pensFor.toFixed(2)} going for the posts`]
}
delta('penalties: corner', { penaltyCall: 'corner' }, fewerGoals('corner'))
delta('penalties: tap', { penaltyCall: 'tap' }, fewerGoals('tap'))

console.log('\n--- the set-piece calls')
for (const lineoutCall of ['lo_front', 'lo_back', 'lo_dummy', 'lo_maul', 'lo_top']) delta(`lineout ${lineoutCall}`, { lineoutCall })
for (const scrumCall of ['sc_channel1', 'sc_shove', 'sc_wheel']) delta(`scrum ${scrumCall}`, { scrumCall })

console.log('\n--- the bench')
// the split decides who is sitting there, so the check is who came on
const forwardsOn = (bench?: '5-3' | '6-2' | '4-4') => {
  let fwd = 0
  pool.slice(0, 20).forEach(({ g, fx }, i) => {
    const h = structuredClone(g)
    const me = h.userClubId
    if (bench) { h.clubs[me].tactic.bench = bench; refillBench(h, h.clubs[me]) }
    const f = h.fixtures.find(x => x.id === fx.id)!
    const ctx = beginMatch(h, f, mulberry32(7000 + i * 13), true, me)
    ctx.assistantSubs = true
    playHalf(h, ctx); playHalf(h, ctx)
    const side = ctx.home.teamId === me ? ctx.home : ctx.away
    for (const id of side.onAt?.keys() ?? []) if (['LP', 'HK', 'TP', 'LK', 'FL', 'N8'].includes(h.players[id]?.pos)) fwd++
  })
  return fwd / 20
}
const fwdBase = forwardsOn('5-3')
for (const bench of ['6-2', '4-4'] as const) delta(`bench ${bench}`, { bench }, () => {
  const f = forwardsOn(bench)
  return [bench === '6-2' ? f > fwdBase : f < fwdBase, `${f.toFixed(2)} forwards come on a match, against ${fwdBase.toFixed(2)} on a 5-3`]
})

console.log('\n--- against the other side: the defence matchups')
{
  // the width dial pays in proportion to how wide the opposition plays
  // (beginMatch), so it is read off the defence the engine will play with
  const wideAtt = { style: 88 }, tightAtt = { style: 12 }
  const gain = (defWidth: number, opp: Partial<Tactic>) => fingerprint({ defWidth }, opp).defence / fingerprint({}, opp).defence
  const wW = gain(85, wideAtt), wT = gain(85, tightAtt), nW = gain(15, wideAtt), nT = gain(15, tightAtt)
  ok(wW > wT, `a wide defence is worth more against a wide attack (x${wW.toFixed(3)}) than a forward one (x${wT.toFixed(3)})`)
  ok(nT > nW, `a narrow defence is worth more against a forward attack (x${nT.toFixed(3)}) than a wide one (x${nW.toFixed(3)})`)
}

console.log(fails ? `\nOPTIONS PROBE FAILED (${fails})` : '\nOPTIONS PROBE PASSED: every option does something, the matchups hold, and none is a meta')
process.exit(fails ? 1 : 0)
