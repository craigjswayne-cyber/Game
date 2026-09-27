// ---- EVERY GAME PLAN OPTION DOES SOMETHING (1.8.0) ----
//
// Owner, 27 Sep 2026: "gameplay options are great - can you check they all
// have an impact on the games whichever you choose against the other[s]?"
//
// Every option on the Tactics screen, played over the same pool of full
// matches as the standard setting (common random numbers: the same fixture,
// state and dice, only the option differs), and three questions of each:
//
//   DOES IT CHANGE THE GAME? At least one of tries for, tries against,
//     penalty goals, cards or the margin moves by a real amount.
//   IS IT THE TRADE IT SAYS? Where the Tactics text names a direction (more
//     tries, fewer penalties, more cards), the numbers go that way.
//   IS IT A META? No option moves the average margin by more than 4 points a
//     match: if one did, every career would end up there.
//
// And the matchups the text promises: a wide defence pays against a wide
// attack and costs against a forward one, and a narrow defence the other way.
//
// Run: npx vite-node scripts/optionsprobe.ts
import { newGame } from '../src/game/newgame'
import { simMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { DEF_SYSTEMS, PRESETS } from '../src/game/tactics'
import type { Fixture, GameState, MatchEvent, Tactic } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const userFixture = (g: GameState) =>
  g.fixtures.find(f => f.week === g.week && (f.homeId === g.userClubId || f.awayId === g.userClubId))!

type Stats = { margin: number; triesFor: number; triesAgainst: number; pensFor: number; cardsFor: number; pointsFor: number }
const real = (e: MatchEvent) => e.fx !== 'TMO' && e.fx !== 'NOTRY'

const pool: { g: GameState; fx: Fixture }[] = []
for (const seed of [3, 11, 29, 47, 83, 101, 131, 157, 181, 211]) {
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
    const r = simMatch(h, f, mulberry32(7000 + i * 13), false)
    const mine = f.homeId === me
    s.margin += mine ? f.homeScore - f.awayScore : f.awayScore - f.homeScore
    s.pointsFor += mine ? f.homeScore : f.awayScore
    for (const e of r.events) {
      if (e.type === 'TRY' && real(e)) { if (e.teamId === me) s.triesFor++; else s.triesAgainst++ }
      if (e.type === 'PEN' && e.teamId === me) s.pensFor++
      if ((e.type === 'YC' || e.type === 'RC') && e.teamId === me) s.cardsFor++
    }
  })
  const n = pool.length
  return { margin: s.margin / n, triesFor: s.triesFor / n, triesAgainst: s.triesAgainst / n, pensFor: s.pensFor / n, cardsFor: s.cardsFor / n, pointsFor: s.pointsFor / n }
}

const fmt = (d: number) => `${d >= 0 ? '+' : ''}${d.toFixed(2)}`
const base = play({})
console.log(`standard setting over ${pool.length} matches: margin ${base.margin.toFixed(2)}, tries ${base.triesFor.toFixed(2)}-${base.triesAgainst.toFixed(2)}, pen goals ${base.pensFor.toFixed(2)}, cards ${base.cardsFor.toFixed(2)}`)

/** how far an option moved each number from the standard setting */
function delta(name: string, set: Partial<Tactic>, opp: Partial<Tactic> = {}) {
  const r = play(set, opp)
  const d = {
    margin: r.margin - base.margin, triesFor: r.triesFor - base.triesFor, triesAgainst: r.triesAgainst - base.triesAgainst,
    pensFor: r.pensFor - base.pensFor, cardsFor: r.cardsFor - base.cardsFor,
  }
  // "a real amount": a tenth of a try, a tenth of a penalty goal or card, or
  // a point of margin, per match, across fifty matches
  const moved = Math.abs(d.triesFor) >= 0.1 || Math.abs(d.triesAgainst) >= 0.1 || Math.abs(d.pensFor) >= 0.1
    || Math.abs(d.cardsFor) >= 0.05 || Math.abs(d.margin) >= 1
  console.log(`  ${name.padEnd(22)} margin ${fmt(d.margin)}  tries ${fmt(d.triesFor)}/${fmt(d.triesAgainst)}  pens ${fmt(d.pensFor)}  cards ${fmt(d.cardsFor)}`)
  ok(moved, `${name}: changes the match`)
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
ok(styleUp.triesFor > 0, 'wide style: more tries scored')
void tempoUp

console.log('\n--- the presets')
for (const p of PRESETS.filter(p => p.id !== 'balanced')) delta(`preset ${p.id}`, { ...p.values })

console.log('\n--- the defence systems')
for (const d of DEF_SYSTEMS.filter(d => d.id !== 'standard')) delta(`defence ${d.id}`, { defLine: d.line, defWidth: d.width })

console.log('\n--- the zonal plan')
const z = (zones: Tactic['zones']) => ({ zones })
delta('own 22: kick long', z({ own22: 'long' }))
const run22 = delta('own 22: run it', z({ own22: 'play' }))
delta('middle: territory', z({ middle: 'terr' }))
delta('middle: in hand', z({ middle: 'hand' }))
const drive = delta('their 22: drive', z({ opp22: 'drive' }))
const spread = delta('their 22: spread', z({ opp22: 'spread' }))
ok(spread.triesFor > drive.triesFor, "their 22: spreading it scores more tries than driving")
void run22

console.log('\n--- exits, kicking style, breakdown, penalties')
for (const exit of ['long', 'counter', 'fifty22'] as const) delta(`exit ${exit}`, { exit })
for (const kickStyle of ['territory', 'contest', 'attack'] as const) delta(`kick style ${kickStyle}`, { kickStyle, kicking: 60 })
delta('ruck commit many', { ruckCommit: 100 })
delta('ruck commit few', { ruckCommit: 0 })
delta('ruck contest hard', { ruckContest: 100 })
delta('ruck contest none', { ruckContest: 0 })
const corner = delta('penalties: corner', { penaltyCall: 'corner' })
const tap = delta('penalties: tap', { penaltyCall: 'tap' })
ok(corner.pensFor < 0 && tap.pensFor < 0, 'kicking to the corner or tapping means fewer penalty goals than going for the posts')

console.log('\n--- the set-piece calls')
for (const lineoutCall of ['lo_front', 'lo_back', 'lo_dummy', 'lo_maul', 'lo_top']) delta(`lineout ${lineoutCall}`, { lineoutCall })
for (const scrumCall of ['sc_channel1', 'sc_shove', 'sc_wheel']) delta(`scrum ${scrumCall}`, { scrumCall })

console.log('\n--- the bench')
for (const bench of ['6-2', '4-4'] as const) delta(`bench ${bench}`, { bench })

console.log('\n--- against the other side: the defence matchups')
{
  const wideAtt = { style: 88, tempo: 70 }, tightAtt = { style: 12, tempo: 35 }
  const vs = (def: Partial<Tactic>, opp: Partial<Tactic>) => play(def, opp).margin - play({}, opp).margin
  const wideVsWide = vs({ defWidth: 85 }, wideAtt), wideVsTight = vs({ defWidth: 85 }, tightAtt)
  const narrowVsWide = vs({ defWidth: 15 }, wideAtt), narrowVsTight = vs({ defWidth: 15 }, tightAtt)
  ok(wideVsWide > wideVsTight, `a wide defence pays more against a wide attack (${fmt(wideVsWide)}) than a forward one (${fmt(wideVsTight)})`)
  ok(narrowVsTight > narrowVsWide, `a narrow defence pays more against a forward attack (${fmt(narrowVsTight)}) than a wide one (${fmt(narrowVsWide)})`)
}

console.log(fails ? `\nOPTIONS PROBE FAILED (${fails})` : '\nOPTIONS PROBE PASSED: every option changes the match, the trades go the way the text says, and none is a meta')
process.exit(fails ? 1 : 0)
