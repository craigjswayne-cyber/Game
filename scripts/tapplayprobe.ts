// Probe: THE PENALTY SLOT (round 6, owner: "Penalty tap options should be a
// new slot on what to do in a penalty situation").
//
// The playbook's fifth slot holds the tap penalty play the side runs when it
// takes a quick tap. Whether it taps is still the kickable-penalty call. This
// holds the slot to five things:
//
//   1. THE PLAYS. Three tap plays, each beating a different defence, called
//      only from the penalty slot (never a strike, never the red zone), and
//      between them each defence is beaten as often as it beats.
//   2. THE TAP READS THE PLAY. At a kickable penalty tapped five metres out,
//      the chance the tap scores is measured directly (the one roll the tap
//      always had, bisected): the right play against the defence it beats is
//      better than no play, the wrong one worse, an undrilled one worse
//      still, and none of it outside the tap's own bounds.
//   3. NO NEW DRAWS. With a play in the slot or without, the tap takes the
//      dice exactly as often, scored or not, and a try it makes is named for
//      the play.
//   4. AND IN THEIR 22. A save whose tap play sat in the red-zone slot
//      before round 6 has it in the penalty slot after loading, and plays the
//      same match it did (the same ticks run it).
//   5. OVER A MATCH, with "always tap" standing: the right play against the
//      wrong one, paired seeds, and the AI world untouched (no AI club has a
//      penalty play).
//
// Run: npx vite-node scripts/tapplayprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, lineupFor, playHalf, resolveDecision } from '../src/game/matchEngine'
import { DEF_TRAITS, MOVES, MOVE_BY_ID, callsOf, isPenCall, isRedCall, isStrike, moveMatchup } from '../src/game/moves'
import { playbookOf } from '../src/game/playbook'
import { migratePlaybook } from '../src/game/armsrace'
import { mulberry32 } from '../src/game/rng'
import type { Club, GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

// ------------------------------------------------------------------ 1
console.log('--- 1. the plays\n')
const TAPS = MOVES.filter(m => m.from.includes('tap'))
ok(TAPS.length === 3 && TAPS.every(m => m.from.join() === 'tap'), `three tap plays (${TAPS.map(m => m.id).join(', ')})`)
ok(TAPS.every(m => isPenCall(m.id) && !isRedCall(m.id) && !isStrike(m.id)), 'each goes in the penalty slot and nowhere else')
ok(MOVES.filter(m => !m.from.includes('tap')).every(m => !isPenCall(m.id)), 'and nothing else goes in the penalty slot')
ok(new Set(TAPS.map(m => m.beats.join())).size === 3, `each beats a different defence (${TAPS.map(m => `${m.id.slice(3)} ${m.beats}`).join(', ')})`)
const tb = (tr: string) => TAPS.filter(m => m.beats.includes(tr as never)).length - TAPS.filter(m => m.weak.includes(tr as never)).length
console.log(`  beaten less beats, among the three: ${DEF_TRAITS.map(tr => `${tr} ${tb(tr)}`).join(', ')}`)

// ------------------------------------------------------------------ 2, 3
console.log('\n--- 2. the tap reads the play\n')
const BASE = newGame('leicester', 'Tap Probe', 606)
const ME = BASE.userClubId
BASE.clubs[ME].tactic.lineup = lineupFor(BASE, ME)
BASE.clubs[ME].tactic.userPicked = true
const FXS = BASE.fixtures.filter(f => (f.homeId === ME || f.awayId === ME) && BASE.clubs[f.homeId] && BASE.clubs[f.awayId]).slice(0, 8)
const DEF: Record<string, [number, number]> = { rush: [100, 50], drift: [0, 50], narrow: [50, 0], wide: [50, 100] }

type Arm = { pen?: string; drilled?: number; def: string }
function setUp(g: GameState, me: Club, opp: Club, a: Arm) {
  const [line, width] = DEF[a.def]
  opp.tactic.defLine = line; opp.tactic.defWidth = width
  me.tactic.movePen = a.pen
  me.tactic.penaltyCall = 'tap'
  if (a.pen) { const pb = playbookOf(me); pb.drilled[a.pen] = a.drilled ?? 90; pb.used[a.pen] = 0; pb.reps = { ...(pb.reps ?? {}), [a.pen]: 15 } }
}
/** a kickable penalty five metres out, tapped, with the tap's roll at `u`:
 *  did it score, and how many draws did the whole answer take */
function tapAt(fxi: number, a: Arm, u: number) {
  const g = structuredClone(BASE)
  const fx = g.fixtures.find(f => f.id === FXS[fxi].id)!
  const me = g.clubs[ME], opp = g.clubs[fx.homeId === ME ? fx.awayId : fx.homeId]
  setUp(g, me, opp, a)
  const base = mulberry32(5000 + fxi)
  let draws = 0, first = true
  const ctx = beginMatch(g, fx, () => base(), true)
  ctx.rng = () => { draws++; if (first) { first = false; return u } return base() }
  const home = ctx.home.teamId === ME
  const side = home ? ctx.home : ctx.away
  const fld = home ? 95 : 5
  ctx.field = fld
  ctx.decision = { kind: 'penalty', min: 30, fld }
  const before = side.score
  resolveDecision(g, ctx, 'tap')
  const tryLine = ctx.events.find(e => e.type === 'TRY')
  // the roll came off when the answer went on to the try (a missed tap takes
  // the one draw); read that way, a TMO that overturns it does not muddle it
  return { rolled: draws > 1, scored: side.score > before, draws, key: tryLine?.k ?? '', moveK: String(tryLine?.v?.move_k ?? '') }
}
/** the chance the tap's roll comes off, to a tenth of a per cent, bisected */
function pTap(fxi: number, a: Arm): number {
  let lo = 0, hi = 1
  for (let i = 0; i < 11; i++) { const m = (lo + hi) / 2; if (tapAt(fxi, a, m).rolled) lo = m; else hi = m }
  return (lo + hi) / 2
}
const N2 = 4
const rows: { def: string; none: number; plays: { id: string; match: number; p: number }[]; raw: number }[] = []
for (const def of ['rush', 'drift', 'narrow', 'wide']) {
  let none = 0, raw = 0
  const plays = TAPS.map(m => ({ id: m.id, match: moveMatchup(m, { defLine: DEF[def][0], defWidth: DEF[def][1] } as Club['tactic']), p: 0 }))
  const best = TAPS.find(m => m.beats.includes(def as never)) ?? TAPS[0]
  for (let i = 0; i < N2; i++) {
    none += pTap(i, { def }) / N2
    for (const pl of plays) pl.p += pTap(i, { def, pen: pl.id }) / N2
    raw += pTap(i, { def, pen: best.id, drilled: 30 }) / N2
  }
  rows.push({ def, none, plays, raw })
  console.log(`  against ${def.padEnd(6)} no play ${pct(none)}; ${plays.map(p => `${p.id.slice(3)} ${pct(p.p)} (${p.match > 0 ? 'beats it' : p.match < 0 ? 'weak to it' : 'neutral'})`).join(', ')}; ${best.id.slice(3)} undrilled ${pct(raw)}`)
}
const pos = rows.flatMap(r => r.plays.filter(p => p.match > 0).map(p => p.p - r.none))
const neg = rows.flatMap(r => r.plays.filter(p => p.match < 0).map(p => p.p - r.none))
ok(pos.length === 3 && pos.every(d => d > 0.03), `a play against the defence it beats makes the tap likelier than no play (${pos.map(d => `+${pct(d)}`).join(', ')})`)
ok(neg.length === 3 && neg.every(d => d < 0), `against the defence it is weak to, less likely (${neg.map(d => pct(d)).join(', ')})`)
ok(rows.every(r => r.raw < r.none), 'and an undrilled play misfires, whatever the matchup')
// (at TAP_PLAY_W 1.6 the right play was worth +17 to +21 points of the
// chance and pinned every strong side's tap to the 55% ceiling)
ok(pos.every(d => d < 0.15) && neg.every(d => d > -0.1), 'a read, not a cheat code: the right play drilled is worth under fifteen points of the chance, the wrong one under ten')
console.log(`  on average: the right play +${pct(mean(pos))}, the wrong one ${pct(mean(neg))} on the tap's chance`)

console.log('\n--- 3. no new draws\n')
{
  const out = [0.999, 0.001].map(u => ['', ...TAPS.map(m => m.id)].map(pen => tapAt(1, { def: 'rush', pen: pen || undefined }, u)))
  ok(out.every(row => row.every(x => x.draws === row[0].draws)), `the tap takes the dice as often with a play or without (missed: ${out[0].map(x => x.draws).join('/')} draws; scored: ${out[1].map(x => x.draws).join('/')})`)
  ok(out[1].every(x => x.scored), 'and a roll under the chance scores every way')
  const named = out[1].slice(1)
  ok(named.every((x, i) => x.key.startsWith('comm.moveTryTap') && x.moveK === MOVE_BY_ID[TAPS[i].id].say) && !out[1][0].key.startsWith('comm.moveTry'),
    `a try from the play is named for it (${named.map(x => x.key.replace('comm.', '')).join(', ')}); without one it is not`)
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. in their 22, and old saves\n')
{
  const g = structuredClone(BASE)
  const me = g.clubs[ME]
  me.tactic.moveRed = 'mv_tap'; me.tactic.movePen = undefined
  migratePlaybook(g)
  ok(me.tactic.movePen === 'mv_tap' && me.tactic.moveRed === undefined, 'an old save\'s tap in the red-zone slot moves to the penalty slot')
  me.tactic.moveRed = 'mv_maulswitch'
  migratePlaybook(g)
  ok(me.tactic.moveRed === 'mv_maulswitch' && me.tactic.movePen === 'mv_tap', 'the maul switch stays in the red zone')
  const c = callsOf(g, me)
  ok(c.pen === 'mv_tap' && c.red === 'mv_maulswitch', 'and both are called')
  me.tactic.movePen = 'mv_crash'
  ok(callsOf(g, me).pen === undefined, 'a strike move in the penalty slot is not called')
  // the same ticks run the tap as ran it from the red zone: compare a match
  // played with the play in the penalty slot against the same match run
  // through the pre-round-6 rule (the red slot's tap) by hand
  const run = (put: (t: Club['tactic']) => void) => {
    const h = structuredClone(BASE)
    const m2 = h.clubs[ME]
    put(m2.tactic)
    playbookOf(m2).drilled.mv_tap = 92
    const fx = h.fixtures.find(f => f.id === FXS[2].id)!
    const ctx = beginMatch(h, fx, mulberry32(77), true)
    playHalf(h, ctx); playHalf(h, ctx)
    return { s: `${ctx.home.score}-${ctx.away.score}`, taps: ctx.events.filter(e => e.v?.move_k === 'moves.say.mv_tap').length }
  }
  const a = run(t => { t.movePen = 'mv_tap' })
  const b = run(t => { t.moveRed = 'mv_tap'; migratePlaybookOn(t) })
  ok(a.s === b.s && a.taps === b.taps && a.taps > 0, `the play runs in their 22 (${a.taps} lines name it), and a migrated save plays the same match (${a.s} and ${b.s})`)
}
function migratePlaybookOn(t: Club['tactic']) {
  const g = { userClubId: 'x', clubs: { x: { tactic: t } } } as unknown as GameState
  migratePlaybook(g)
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. over a match, always tapping\n')
{
  const N = 120
  const right: Record<string, string> = {}, wrong: Record<string, string> = {}
  for (const m of TAPS) { right[m.beats[0]] = m.id; wrong[m.weak[0]] = m.id }
  const pts = { right: [] as number[], wrong: [] as number[], none: [] as number[] }
  for (let s = 0; s < N; s++) {
    const def = (['rush', 'drift', 'narrow', 'wide'] as const)[s % 4]
    if (!right[def] || !wrong[def]) continue
    for (const arm of ['none', 'right', 'wrong'] as const) {
      const g = structuredClone(BASE)
      const fx = g.fixtures.find(f => f.id === FXS[s % FXS.length].id)!
      const me = g.clubs[ME], opp = g.clubs[fx.homeId === ME ? fx.awayId : fx.homeId]
      setUp(g, me, opp, { def, pen: arm === 'none' ? undefined : arm === 'right' ? right[def] : wrong[def] })
      const ctx = beginMatch(g, fx, mulberry32(8800 + s), false)
      ctx.assistantSubs = true
      playHalf(g, ctx); playHalf(g, ctx)
      const side = ctx.home.teamId === ME ? ctx.home : ctx.away, them = side === ctx.home ? ctx.away : ctx.home
      pts[arm].push(side.score - them.score)
    }
  }
  const d1 = mean(pts.right) - mean(pts.none), d2 = mean(pts.wrong) - mean(pts.none)
  console.log(`  ${pts.none.length} paired matches: margin with no play ${mean(pts.none).toFixed(2)}, the right play ${d1 >= 0 ? '+' : ''}${d1.toFixed(2)}, the wrong one ${d2 >= 0 ? '+' : ''}${d2.toFixed(2)}`)
  ok(mean(pts.right) > mean(pts.wrong), 'the right play is worth more than the wrong one over a match')
  ok(Math.abs(d1) < 6 && Math.abs(d2) < 6, 'by points, not by a landslide')
  const g = structuredClone(BASE)
  ok(Object.values(g.clubs).filter(c => c.id !== ME).every(c => !callsOf(g, c).pen), 'no AI club has a penalty play: the world plays as it did')
}

console.log(fails ? `\nTAP PLAY PROBE FAILED (${fails})` : '\nTAP PLAY PROBE PASSED: the penalty slot picks the play, and the dice never notice')
process.exit(fails ? 1 : 0)
