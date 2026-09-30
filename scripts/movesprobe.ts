// Probe: the attacking moves (1.8.1, owner request #99, src/game/moves.ts).
//
// The owner asked for real, named, technical moves that a manager picks and
// drills and then sees in the match and in its highlight clips. This holds
// the library to that, end to end:
//
//   1. THE LIBRARY. Eight to twelve moves, phase-play shapes and strike moves
//      off set piece, each with what it needs, what it beats and what it is
//      weak against; the four defensive traits beaten exactly as often as
//      they beat; every move drawn, and in every language.
//   2. THE DRILLING follows playbook.ts to the letter: what is called gets
//      sharper, what is shelved rusts, calling never lowers it, an AI coach
//      is capped on the manager's 0-3 scale, an undrilled move misfires and a
//      misfire is always a loss.
//   3. FIT AND THE OPPONENT, measured on the pitch over paired seeds: the
//      right men make a move work and the wrong ones make it cost, a defence
//      it beats pays and one it is weak against costs, and a bad fit is
//      worse than no call. Read on the tries the side's rugby was worth
//      (SideCtx.xTry, the sum of its try chances) as well as on the ones it
//      scored, because one roll a tick drowns a few per cent in noise.
//   4. IN THE MATCH: the commentary names the move when it works and when it
//      misfires, a watched match and a silent one are the same match, and
//      the AI clubs call moves from their coach's philosophy.
//   5. IN THE CLIPS: a try from a strike move is played from its set piece,
//      the loop runner loops, the decoy runs his line without the ball, the
//      switch and the inside ball come back against the grain, and a shape's
//      forwards stand in their pods.
//   6. OLD SAVES: a club with no calls and no drilled moves plays as before.
//
// Run: npx vite-node scripts/movesprobe.ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { newGame } from '../src/game/newgame'
import { beginMatch, lineupFor, playHalf, resolveDecision, simMatch, stepTick } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import type { Club, GameState } from '../src/game/model'
import { tIn } from '../src/game/i18n'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import {
  DEF_TRAITS, MOVES, MOVE_BY_ID, callsOf, drillMovesWeek, drilledOf, launchOf, moveEdge, moveOfKey,
} from '../src/game/moves'
import { drillWeek, playbookOf, routineEffect } from '../src/game/playbook'
import { MOVE_DIAGRAMS, MoveDiagram } from '../src/ui/tacticsArt'
import { CLIP_MOVES, buildClip, clipLength, clipTimeline, frameAt, type ClipSpec } from '../src/ui/HighlightClip'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)

// ------------------------------------------------------------------ 1
console.log('--- 1. the library\n')
ok(MOVES.length >= 8 && MOVES.length <= 20, `${MOVES.length} moves (8 to 20; 1.8.2 added the study's new families)`)
const shapes = MOVES.filter(m => m.group === 'shape'), strikes = MOVES.filter(m => m.group === 'strike')
ok(shapes.length >= 3 && strikes.length >= 6, `${shapes.length} phase-play shapes and ${strikes.length} strike moves`)
ok(strikes.some(m => m.from.includes('lineout')) && strikes.some(m => m.from.includes('scrum')) && shapes.every(m => m.from.join() === 'open'),
  'strike moves are called off the lineout and the scrum, shapes in open play')
ok(MOVES.every(m => m.needs.length > 0 && m.needs.every(n => n.shirts.length && n.attrs.length) && m.beats.length && m.weak.length
  && m.peak > 0 && m.peak <= 0.25 && m.tempo > 0.9 && m.tempo < 1.1 && m.risk > 0),
  'every move says what it needs, what it beats, what it is weak against, and its tempo and risk')
const beatN = Object.fromEntries(DEF_TRAITS.map(tr => [tr, MOVES.filter(m => m.beats.includes(tr)).length]))
const weakN = Object.fromEntries(DEF_TRAITS.map(tr => [tr, MOVES.filter(m => m.weak.includes(tr)).length]))
ok(DEF_TRAITS.every(tr => beatN[tr] === weakN[tr] && beatN[tr] > 0),
  `no one answer: each defence is beaten as often as it beats (${DEF_TRAITS.map(tr => `${tr} ${beatN[tr]}/${weakN[tr]}`).join(', ')})`)
ok(MOVES.every(m => MOVE_DIAGRAMS.includes(m.id)) && MOVES.every(m => CLIP_MOVES.includes(m.id)),
  'every move has a whiteboard diagram and a way to be played in a clip')
const drawn = MOVES.map(m => ({ id: m.id, svg: renderToStaticMarkup(createElement(MoveDiagram, { id: m.id })) }))
ok(drawn.every(d => (d.svg.match(/--dg-move/g) ?? []).length >= 3) && new Set(drawn.map(d => d.svg)).size === MOVES.length,
  'every diagram draws its own runner lines (no two alike)')
const LANGS = ['en', 'fr', 'es', 'it', 'ja', 'af']
const dict = Object.fromEntries(LANGS.map(l => [l, JSON.parse(readFileSync(`src/locales/${l}.json`, 'utf8'))]))
const get = (l: string, k: string) => k.split('.').reduce((o: any, p) => o?.[p], dict[l])
const moveKeys = MOVES.flatMap(m => [m.name, m.desc, m.say])
ok(LANGS.every(l => moveKeys.every(k => typeof get(l, k) === 'string' && get(l, k).length > 1)), 'every move is named, explained and said in all six languages')
ok(LANGS.filter(l => l !== 'en').every(l => MOVES.every(m => get(l, m.desc) !== get('en', m.desc))), 'and the explanations are translated, not copied')
const commKeys = ['moveCallLo1', 'moveCallSc1', 'moveShape1', 'moveMisfire1', 'moveGain1', 'shapeMisfire1', 'moveTryLo1', 'moveTryLoSelf', 'moveTrySc1', 'moveTryScSelf', 'shapeTry1', 'shapeTrySelf', 'moveCallTap1', 'moveTryTap1', 'moveTryTapSelf']
ok(LANGS.every(l => commKeys.every(k => typeof get(l, `comm.${k}`) === 'string' && get(l, `comm.${k}`).includes('{move_k}'))), 'the move commentary is in every language and names the move')

// ------------------------------------------------------------------ 2
console.log('\n--- 2. drilled like a set-piece call\n')
{
  const g = newGame('leicester', 'Moves Probe', 4242)
  const me = g.clubs[g.userClubId]
  g.staff.attack = 1; g.staff.scrumCoach = 1
  me.tactic.moveMain = 'mv_loop'
  const start = drilledOf(g, me, 'mv_loop')
  const shelved0 = drilledOf(g, me, 'mv_switch')
  const path = [start]
  for (let w = 0; w < 30; w++) { drillMovesWeek(g, me, false); path.push(drilledOf(g, me, 'mv_loop')) }
  ok(path.every((v, i) => i === 0 || v >= path[i - 1]) && path[8] > start + 5, `a called move gets sharper week by week (${start.toFixed(0)} -> ${path[8].toFixed(0)} in eight weeks -> ${path[30].toFixed(0)})`)
  ok(path[30] <= 72 + 6 + 0.001, `and stops at the ceiling the attack coach sets (${path[30].toFixed(1)}, ceiling 78)`)
  ok(Math.abs(drilledOf(g, me, 'mv_switch') - (shelved0 - 30 * 0.35)) < 0.01, `a shelved move rusts (${shelved0.toFixed(1)} -> ${drilledOf(g, me, 'mv_switch').toFixed(1)})`)
  // the same rule as playbook.drillWeek: from the same place, with the same
  // coach and the same emphasis, a called move and a called routine move alike
  const pb = playbookOf(me)
  pb.drilled.mv_loop = 40; pb.drilled.lo_back = 40
  me.tactic.lineoutCall = 'lo_back'
  drillMovesWeek(g, me, true); drillWeek(g, me, true)
  ok(Math.abs(pb.drilled.mv_loop - pb.drilled.lo_back) < 1e-9, `the same drilling rule as the set-piece playbook (${pb.drilled.mv_loop.toFixed(2)} and ${pb.drilled.lo_back.toFixed(2)})`)
  // calling never lowers competence, even above this club's ceiling
  pb.drilled.mv_loop = 97
  drillMovesWeek(g, me, false)
  ok(pb.drilled.mv_loop === 97, 'calling a move never makes it worse, even above the ceiling')
  // the AI drill coach is on the 0-3 scale: a rep-100 club tops out at 90
  const ai = Object.values(g.clubs).find(c => c.id !== me.id && callsOf(g, c).lineout)!
  ai.rep = 100
  const aiMove = callsOf(g, ai).lineout!
  for (let w = 0; w < 200; w++) drillMovesWeek(g, ai, false)
  ok(drilledOf(g, ai, aiMove) <= 90 + 1e-9 && drilledOf(g, ai, aiMove) > 85, `an AI coach is capped like the manager's (rep 100 tops out at ${drilledOf(g, ai, aiMove).toFixed(1)}, cap 90)`)
  // a misfire is a loss, whatever the fit and the matchup
  pb.drilled.mv_loop = 30; pb.used = {}
  const mis = moveEdge(g, me, 'mv_loop', 1, 1)
  ok(mis.gain < 0 && Math.abs(mis.gain - MOVE_BY_ID.mv_loop.peak * mis.q) < 1e-9, `an undrilled move misfires however good the fit (${(mis.gain * 100).toFixed(1)}%)`)
  pb.drilled.mv_loop = 95
  const good = moveEdge(g, me, 'mv_loop', 0.6, 0.6), bad = moveEdge(g, me, 'mv_loop', -0.9, -0.9), none = moveEdge(g, me, 'mv_loop', 0, 0)
  ok(good.gain > none.gain && none.gain > 0 && bad.gain < 0, `drilled, the fit and the matchup decide it: ${(good.gain * 100).toFixed(1)}% right, ${(none.gain * 100).toFixed(1)}% neutral, ${(bad.gain * 100).toFixed(1)}% wrong`)
  // the analysts learn it, as they learn a lineout call
  pb.used.mv_loop = 12
  ok(moveEdge(g, me, 'mv_loop', 0.6, 0.6).gain < good.gain, 'a move called week after week is read by the analysts')
  // the playbook's own misfire rule, for comparison: undrilled costs
  ok(routineEffect(me, 'lo_back').mult > 0, 'the playbook still answers (sanity)')
  // AI clubs call from their coach's philosophy
  const called = Object.values(g.clubs).filter(c => c.id !== me.id && c.philosophy)
  const withCalls = called.filter(c => { const k = callsOf(g, c); return k.lineout && k.scrum && k.shape })
  const byPh = new Map<string, string>()
  let consistent = true
  for (const c of withCalls) { const k = JSON.stringify(callsOf(g, c)); if (byPh.has(c.philosophy!) && byPh.get(c.philosophy!) !== k) consistent = false; byPh.set(c.philosophy!, k) }
  ok(withCalls.length === called.length && consistent && new Set(byPh.values()).size >= 6,
    `every AI club calls a lineout move, a scrum move and a shape, by its coach's philosophy (${withCalls.length} clubs, ${new Set(byPh.values()).size} different sets)`)
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. fit and the opponent, on the pitch\n')
const BASE = newGame('leicester', 'Moves Probe', 777)
const ME = BASE.userClubId
BASE.clubs[ME].tactic.lineup = lineupFor(BASE, ME)
BASE.clubs[ME].tactic.userPicked = true
const FXS = BASE.fixtures.filter(f => (f.homeId === ME || f.awayId === ME) && BASE.clubs[f.homeId] && BASE.clubs[f.awayId]).slice(0, 12)

type Setup = (g: GameState, me: Club, opp: Club) => void
function play(seed: number, setup: Setup, detail = false) {
  const g = structuredClone(BASE)
  const fx = g.fixtures.find(f => f.id === FXS[seed % FXS.length].id)!
  const me = g.clubs[ME], opp = g.clubs[fx.homeId === ME ? fx.awayId : fx.homeId]
  setup(g, me, opp)
  const ctx = beginMatch(g, fx, mulberry32(31000 + seed), detail)
  ctx.assistantSubs = true
  playHalf(g, ctx); playHalf(g, ctx)
  const side = ctx.home.teamId === ME ? ctx.home : ctx.away
  return { x: side.xTry ?? 0, tries: side.tries, pts: side.score, events: ctx.events, g }
}
/** the men in the named shirts of the manager's sheet, made to suit a move or not */
const shape = (g: GameState, me: Club, id: string, v: number) => {
  for (const n of MOVE_BY_ID[id].needs) for (const s of n.shirts) {
    const p = g.players[me.tactic.lineup[s - 1]!]
    for (const a of n.attrs) p.a[a] = v
  }
}
const call = (me: Club, id: string | null, drilled = 95) => {
  const m = id ? MOVE_BY_ID[id] : null
  // (1.8.2: the playbook's slots, and the side run in with the move to the
  // AI's own familiarity, so the move is worth here what it was in 1.8.1)
  me.tactic.moveMain = m && m.group === 'strike' && !m.red ? m.id : undefined
  me.tactic.moveAlt = undefined
  me.tactic.moveRed = m?.red ? m.id : undefined
  me.tactic.moveShape = m?.from.includes('open') ? m.id : undefined
  if (m) playbookOf(me).reps = { [m.id]: 15 }
  if (m) { playbookOf(me).drilled[m.id] = drilled; playbookOf(me).used[m.id] = 0 }
}
const defence = (opp: Club, line: number, width: number) => { opp.tactic.defLine = line; opp.tactic.defWidth = width }
const N = 48
/**
 * The same fixture on the same dice, once each way, a tick at a time. `x` is
 * the difference in the try chances the side's rugby was worth UP TO THE
 * FIRST TICK THE TWO MATCHES PART (a score, a kick or anything else that
 * spends the dice differently): past that point they are two different
 * matches and the difference is mostly the dice. `pts` and `tries` are the
 * whole eighty, reported for scale.
 */
function lockstep(seed: number, a: Setup, b: Setup) {
  const mk = (setup: Setup) => {
    const g = structuredClone(BASE)
    const fx = g.fixtures.find(f => f.id === FXS[seed % FXS.length].id)!
    const me = g.clubs[ME], opp = g.clubs[fx.homeId === ME ? fx.awayId : fx.homeId]
    setup(g, me, opp)
    const base = mulberry32(31000 + seed)
    const run = { g, draws: 0, ctx: null as unknown as ReturnType<typeof beginMatch>, x0: 0 }
    run.ctx = beginMatch(g, fx, () => { run.draws++; return base() }, false)
    run.ctx.assistantSubs = true
    return run
  }
  const A = mk(a), B = mk(b)
  const sideOf = (r: typeof A) => (r.ctx.home.teamId === ME ? r.ctx.home : r.ctx.away)
  let dx = 0, apart = false
  for (;;) {
    for (const r of [A, B]) {
      r.x0 = sideOf(r).xTry ?? 0
      if (r.ctx.decision) resolveDecision(r.g, r.ctx, 'posts')
      const st = stepTick(r.g, r.ctx)
      if (r.ctx.decision) resolveDecision(r.g, r.ctx, 'posts')
      if (st !== 'play') r.ctx.awaiting = null
    }
    if (!apart) dx += ((sideOf(A).xTry ?? 0) - A.x0) - ((sideOf(B).xTry ?? 0) - B.x0)
    if (A.draws !== B.draws || A.ctx.home.score !== B.ctx.home.score || A.ctx.away.score !== B.ctx.away.score) apart = true
    if (A.ctx.tick >= 20 && B.ctx.tick >= 20) break
  }
  const sa = sideOf(A), sb = sideOf(B)
  return { x: dx, tries: sa.tries - sb.tries, pts: sa.score - sb.score }
}
const pairs = (a: Setup, b: Setup) => {
  const d = { x: [] as number[], tries: [] as number[], pts: [] as number[] }
  for (let s = 0; s < N; s++) {
    const r = lockstep(s, a, b)
    d.x.push(r.x); d.tries.push(r.tries); d.pts.push(r.pts)
  }
  const se = Math.sqrt(mean(d.x.map(v => (v - mean(d.x)) ** 2)) / N)
  return { x: mean(d.x), tries: mean(d.tries), pts: mean(d.pts), se }
}
const fmt = (r: { x: number; tries: number; pts: number; se: number }) => `${r.x >= 0 ? '+' : ''}${r.x.toFixed(2)} (se ${r.se.toFixed(2)}) tries' worth before the dice part, ${r.tries >= 0 ? '+' : ''}${r.tries.toFixed(2)} scored, ${r.pts >= 0 ? '+' : ''}${r.pts.toFixed(1)} pts`
{
  // THE FIT: the loop with a 10 and 12 who can handle and run, and with two who cannot, each against no call with the same men
  const NEUTRAL = (opp: Club) => defence(opp, 50, 50)
  const goodFit = pairs((g, me, o) => { shape(g, me, 'mv_loop', 19); NEUTRAL(o); call(me, 'mv_loop') }, (g, me, o) => { shape(g, me, 'mv_loop', 19); NEUTRAL(o); call(me, null) })
  const badFit = pairs((g, me, o) => { shape(g, me, 'mv_loop', 4); NEUTRAL(o); call(me, 'mv_loop') }, (g, me, o) => { shape(g, me, 'mv_loop', 4); NEUTRAL(o); call(me, null) })
  console.log(`  the loop, drilled, neutral defence: the right men ${fmt(goodFit)}; the wrong men ${fmt(badFit)} (against no call, ${N} paired seeds)`)
  // (three standard errors either side of nothing, on the undivided part)
  const sure = (r: { x: number; se: number }, sign: 1 | -1) => r.x * sign > 3 * r.se
  ok(sure(goodFit, 1) && goodFit.x > badFit.x, 'the right men make a move pay')
  ok(sure(badFit, -1), 'a move run by the wrong men is worse than no call')
  // THE OPPONENT: the loop beats a narrow defence and is weak against a rush
  // (with average men in the shirts it names, so the defence is the only thing that differs)
  const vsNarrow = pairs((g, me, o) => { shape(g, me, 'mv_loop', 12); defence(o, 50, 12); call(me, 'mv_loop') }, (g, me, o) => { shape(g, me, 'mv_loop', 12); defence(o, 50, 12); call(me, null) })
  const vsRush = pairs((g, me, o) => { shape(g, me, 'mv_loop', 12); defence(o, 92, 50); call(me, 'mv_loop') }, (g, me, o) => { shape(g, me, 'mv_loop', 12); defence(o, 92, 50); call(me, null) })
  console.log(`  the loop against a narrow defence ${fmt(vsNarrow)}; against a rush ${fmt(vsRush)}`)
  ok(sure(vsNarrow, 1) && sure(vsRush, -1), 'a defence the move beats pays, one it is weak against costs (worse than no call)')
  // A SHAPE, the same way: 1-3-3-1 beats narrow, is weak against the rush
  const podNarrow = pairs((g, me, o) => { shape(g, me, 'mv_1331', 12); defence(o, 50, 12); call(me, 'mv_1331') }, (g, me, o) => { shape(g, me, 'mv_1331', 12); defence(o, 50, 12); call(me, null) })
  const podRush = pairs((g, me, o) => { shape(g, me, 'mv_1331', 12); defence(o, 92, 50); call(me, 'mv_1331') }, (g, me, o) => { shape(g, me, 'mv_1331', 12); defence(o, 92, 50); call(me, null) })
  console.log(`  1-3-3-1 pods against a narrow defence ${fmt(podNarrow)}; against a rush ${fmt(podRush)}`)
  ok(sure(podNarrow, 1) && sure(podRush, -1), 'and a phase-play shape likewise')
  // A MISFIRE: the loop undrilled, with the right men against the defence it beats
  const misfire = pairs((g, me, o) => { shape(g, me, 'mv_loop', 19); defence(o, 50, 12); call(me, 'mv_loop', 25) }, (g, me, o) => { shape(g, me, 'mv_loop', 19); defence(o, 50, 12); call(me, null) })
  console.log(`  the loop undrilled (25%), right men, right defence ${fmt(misfire)}`)
  ok(sure(misfire, -1), 'an undrilled move misfires on the pitch too, whatever else is right')
  // BOUNDED: the best case the library allows, all three calls drilled, right men, right defence
  const best = pairs((g, me, o) => {
    defence(o, 50, 12); shape(g, me, 'mv_loop', 19); shape(g, me, 'mv_1331', 19)
    call(me, 'mv_loop'); me.tactic.moveShape = 'mv_1331'; playbookOf(me).drilled.mv_1331 = 95
  }, (g, me, o) => { defence(o, 50, 12); shape(g, me, 'mv_loop', 19); shape(g, me, 'mv_1331', 19); call(me, null) })
  console.log(`  the best case (three calls, drilled, right men, right defence) ${fmt(best)}`)
  ok(sure(best, 1) && best.pts < 8, `and bounded: the best the moves can do is under a converted try a match (${best.pts.toFixed(1)} pts)`)
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. in the match\n')
{
  // watched, with the manager calling drilled moves and the world calling its own
  const named: string[] = [], misfires: string[] = [], calls: string[] = []
  let moveTries = 0, tries = 0, makerNamed = 0
  for (let s = 0; s < 16; s++) {
    const r = play(s, (g, me) => { call(me, 'mv_loop'); me.tactic.moveShape = 'mv_backdoor'; playbookOf(me).drilled.mv_backdoor = 95 }, true)
    for (const e of r.events) {
      if (e.type === 'TRY') { tries++; if (/^comm\.(moveTry|shapeTry)/.test(e.k ?? '')) { moveTries++; named.push(e.text); const id = moveOfKey(e.v?.move_k); if (id && e.text.includes(tIn('en', MOVE_BY_ID[id].say)) && (e.v?.maker == null || e.text.includes(String(e.v.maker)))) makerNamed++ } }
      if (/^comm\.(moveMisfire|shapeMisfire)/.test(e.k ?? '')) misfires.push(e.text)
      if (/^comm\.(moveCall|moveShape)/.test(e.k ?? '')) calls.push(e.text)
    }
  }
  console.log(`  e.g. "${named[0]}"`)
  ok(moveTries > 0 && makerNamed === moveTries, `a try a called move made names the move and who ran it (${moveTries} of ${tries} tries)`)
  ok(moveTries < tries * 0.5, 'and the rest are the tries they always were')
  ok(calls.length > 0, `the call is heard as it is made (${calls.length} lines, e.g. "${calls[0]}")`)
  const undrilled: string[] = []
  for (let s = 0; s < 10; s++) {
    const r = play(s, (g, me) => call(me, 'mv_strike13', 15), true)
    for (const e of r.events) if (/^comm\.moveMisfire/.test(e.k ?? '')) undrilled.push(e.text)
  }
  ok(undrilled.length > 0, `and so is the misfire (${undrilled.length} lines, e.g. "${undrilled[0]}")`)
  // one engine, watched or not
  let same = 0
  for (let s = 0; s < 8; s++) {
    const a = play(s, (g, me) => call(me, 'mv_decoy'), true), b = play(s, (g, me) => call(me, 'mv_decoy'), false)
    if (a.pts === b.pts && a.tries === b.tries) same++
  }
  ok(same === 8, `a watched match and a silent one are the same match with moves called (${same}/8)`)
  // launches are spread as the set piece is
  let lo = 0, sc = 0, op = 0
  for (let fx = 1; fx < 400; fx++) for (let t = 0; t < 20; t++) { const l = launchOf(fx, t, fx % 2 === 0); if (l === 'lineout') lo++; else if (l === 'scrum') sc++; else op++ }
  const n = lo + sc + op
  ok(Math.abs(lo / n - 0.3) < 0.02 && Math.abs(sc / n - 0.15) < 0.02, `ticks are launched from the lineout ${(lo / n * 100).toFixed(0)}%, the scrum ${(sc / n * 100).toFixed(0)}%, open play ${(op / n * 100).toFixed(0)}%`)
}

// ------------------------------------------------------------------ 5
console.log('\n--- 5. in the clips\n')
{
  const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER' }
  const colours = { home: ['#c00', '#fff'] as [string, string], away: ['#00c', '#fff'] as [string, string] }
  // real tries from a watched match, replayed as each move with a wing scoring
  const r = play(3, () => {}, true)
  const tryAt = r.events.map((e, i) => e.type === 'TRY' ? i : -1).filter(i => i >= 0).slice(0, 4)
  const homeId = FXS[3 % FXS.length].homeId
  const clip = (i: number, id: string, from: 'lineout' | 'scrum' | 'open' | 'tap', scorer = 14): ClipSpec => {
    const k = from === 'lineout' ? 'comm.moveTryLo1' : from === 'scrum' ? 'comm.moveTrySc1' : from === 'tap' ? 'comm.moveTryTap1' : 'comm.shapeTry1'
    const ev = r.events.slice(0, i + 1).map((x, j) => j === i ? { ...x, k, v: { ...(x.v ?? {}), move_k: MOVE_BY_ID[id].say } } : x)
    return buildClip(ev, i, 'try', homeId, () => scorer, colours, labels, () => 'Name')
  }
  /** who has the ball, in order, each man once per spell */
  const carriers = (s: ClipSpec) => { const out: number[] = []; for (let t = 0; t < clipLength(s); t += 1 / 60) { const c = frameAt(s, t).carrying.findIndex(x => x > 0.5); if (c >= 0 && c < 15 && out[out.length - 1] !== c + 1) out.push(c + 1) } return out }
  const subseq = (xs: number[], want: number[]) => { let j = 0; for (const x of xs) if (x === want[j]) j++; return j === want.length }
  const WANT: Record<string, number[]> = {
    mv_crash: [9, 10, 12, 14], mv_switch: [9, 10, 13, 14], mv_loop: [9, 10, 12, 10, 14], mv_decoy: [9, 10, 13, 14],
    // (the wrap goes to the blind wing, and the wrap's wing is the 14 the
    // move needs: 1.8.2 puts its short side on his side of the scrum)
    mv_blind: [8, 9, 14], mv_inside: [9, 10, 12, 14], mv_strike13: [9, 10, 12, 13, 14],
    // (1.8.2, the new families: the kicks are the 10's and then the chaser's;
    // the maul's ball stays in the maul, from the jumper to the hooker: the
    // hooker throws, and it never goes down to the 9, whose pop back up into
    // the maul was a forward pass)
    mv_wingin: [9, 10, 14], mv_width: [9, 10, 12, 13, 15, 14], mv_tap: [9, 4, 10, 13, 14], mv_peel: [9, 2, 14],
    mv_maulswitch: [2, 4, 2], mv_crashswing: [9, 10, 12, 9, 10, 13, 15, 14], mv_loop9: [9, 10, 9, 14],
    mv_crosskick: [9, 10, 14], mv_grubber: [9, 10, 14],
  }
  let played = 0
  const wrong: string[] = []
  for (const i of tryAt) for (const m of strikes) for (const from of m.from) {
    const s = clip(i, m.id, from as 'lineout' | 'scrum' | 'tap')
    played++
    const seq = carriers(s)
    const f0 = frameAt(s, 0.2)
    // (a lineout: the hooker on the touchline with it; a scrum (1.8.2): the
    // 9 with it at the mouth of the scrum, about to feed)
    const setOk = from === 'lineout' ? (f0.ball.y < 8 || f0.ball.y > 62) && f0.carrying[1] > 0.5
      : f0.carrying[8] > 0.5 && f0.carrying.filter(x => x > 0.5).length === 1 && Math.hypot(f0.att[8].x - s.beats[0].x, f0.att[8].y - s.beats[0].y) < 3.5
    if (s.style !== 'move' || !setOk || !subseq(seq, WANT[m.id])) wrong.push(`${m.id}/${from}: ${s.style} set ${setOk} ${seq.join('-')}`)
    if (m.id === 'mv_decoy' && seq.includes(12)) wrong.push('the decoy got the ball')
  }
  ok(wrong.length === 0 && played >= 40, `a strike move's try is played from its set piece, pass by pass as it is drawn (${played} clips)${wrong.length ? ': ' + wrong.slice(0, 3).join('; ') : ''}`)
  // the loop runner loops: while the 12 has it, the 10 goes round the back of him
  const i0 = tryAt[0]
  const loop = clip(i0, 'mv_loop', 'lineout')
  const d = loop.attackHome ? 1 : -1
  let behind = false, inside = false, outside = false
  const openS = Math.sign(loop.finish.y - loop.beats[0].y)
  // from the moment the 10 lets it go to the moment he has it again
  let spell = 0, had = false
  for (let t = 0; t < clipLength(loop); t += 1 / 30) {
    const f = frameAt(loop, t)
    const has = f.carrying[9] > 0.5
    if (had && !has) spell++
    had = has
    if (spell !== 1 || has) continue
    const across = (f.att[9].y - f.att[11].y) * openS, back = (f.att[11].x - f.att[9].x) * d
    if (across < 0) inside = true
    if (inside && across > 1) outside = true
    if (back > 0.5) behind = true
  }
  ok(inside && outside && behind, 'the loop: the 10 passes, goes round the back of the 12 and comes again outside him')
  // the decoy runs his line without the ball, and the pass goes out the back of him
  const dec = clip(i0, 'mv_decoy', 'lineout')
  let decoyRan = false, outTheBack = false
  for (let t = 1.6; t < clipLength(dec); t += 1 / 30) {
    const f = frameAt(dec, t), g = frameAt(dec, t + 1 / 30)
    if (f.carrying[9] > 0.5 && ((g.att[11].x - f.att[11].x) * 30 * (dec.attackHome ? 1 : -1)) > 7) decoyRan = true
    if (f.carrying[12] > 0.5 && !outTheBack) outTheBack = (f.att[11].x - f.att[12].x) * (dec.attackHome ? 1 : -1) > 1
  }
  ok(decoyRan && outTheBack, 'the decoy: the 12 runs a hard line at them, and the 13 takes it out the back of him')
  // the switch and the inside ball come back against the grain
  const against = (s: ClipSpec, who: number, from: number) => {
    const o = Math.sign(s.finish.y - s.beats[0].y)
    for (let t = 0; t < clipLength(s); t += 1 / 30) {
      const f = frameAt(s, t)
      if (f.carrying[who - 1] > 0.5) return (f.att[who - 1].y - f.att[from - 1].y) * o < 0.5
    }
    return false
  }
  ok(against(clip(i0, 'mv_switch', 'scrum'), 13, 10) && against(clip(i0, 'mv_inside', 'scrum'), 12, 10), 'the switch and the inside ball: the runner takes it inside the 10, against the grain')
  // a shape's forwards stand in their pods
  const pods = (s: ClipSpec) => {
    let best = 0
    for (let t = 0.3; t < clipTimeline(s).land - 1; t += 0.25) {
      const f = frameAt(s, t), fw = f.att.slice(0, 8)
      // groups of three forwards within four metres of each other
      let groups = 0
      const used = new Set<number>()
      for (let a = 0; a < 8; a++) {
        if (used.has(a)) continue
        const near = fw.map((p, b) => b).filter(b => !used.has(b) && Math.hypot(fw[b].x - fw[a].x, fw[b].y - fw[a].y) < 4)
        if (near.length >= 3) { groups++; near.slice(0, 3).forEach(b => used.add(b)) }
      }
      best = Math.max(best, groups)
    }
    return best
  }
  ok(tryAt.every(i => pods(clip(i, 'mv_1331', 'open')) >= 2), 'the 1-3-3-1 build-up is played in two pods of three')
  ok(tryAt.every(i => clip(i, 'mv_1331', 'open').move === 'mv_1331') && clip(i0, 'mv_backdoor', 'open').move === 'mv_backdoor', 'a shape try carries its shape into the clip')
  const bd = carriers(clip(i0, 'mv_backdoor', 'open'))
  ok(subseq(bd, [10, 14]), 'the back door: the 10 behind the pod has it before the finisher')
  // engine tries named as moves come out as move clips
  let fromEngine = 0, asMove = 0
  for (let s = 0; s < 6; s++) {
    const w = play(s, (g, me) => call(me, 'mv_strike13'), true)
    const fx = FXS[s % FXS.length]
    w.events.forEach((e, i) => {
      if (e.type !== 'TRY' || !/^comm\.moveTry/.test(e.k ?? '')) return
      fromEngine++
      if (buildClip(w.events, i, 'try', fx.homeId, () => 13, colours, labels, () => 'Name').style === 'move') asMove++
    })
  }
  ok(fromEngine > 0 && asMove === fromEngine, `a strike move's try from the engine is drawn as the move (${asMove}/${fromEngine})`)
}

// ------------------------------------------------------------------ 6
console.log('\n--- 6. old saves\n')
{
  // a club from before moves: no calls on the tactic, no moves in the playbook
  const g = structuredClone(BASE)
  const me = g.clubs[ME]
  delete me.tactic.moveMain; delete me.tactic.moveAlt; delete me.tactic.moveRed; delete me.tactic.moveShape
  for (const k of Object.keys(playbookOf(me).drilled)) if (k.startsWith('mv_')) delete playbookOf(me).drilled[k]
  ok(Object.values(callsOf(g, me)).every(v => v == null) && drilledOf(g, me, 'mv_loop') > 0, 'no calls on an old save, and its moves start from scratch')
  let threw = false
  try { const fx = g.fixtures.find(f => f.id === FXS[0].id)!; simMatch(g, fx, mulberry32(5), false) } catch { threw = true }
  ok(!threw, 'and it plays')
  // no calls is the engine as it was: the same fixture with neither side
  // calling (the opposition's coach given no philosophy moves) scores the
  // same with or without the moves module in the loop - checked by playing
  // it twice, once with a move called and drilled to exactly 60 (a gain of
  // nought), which must match no call at all, draw for draw
  let same = 0
  for (let s = 0; s < 10; s++) {
    const strip = (gg: GameState, o: Club) => { o.philosophy = undefined }
    const a = play(s, (gg, me2, o) => { strip(gg, o); call(me2, null) })
    const b = play(s, (gg, me2, o) => { strip(gg, o); call(me2, 'mv_crash', 60) })
    if (a.pts === b.pts && a.tries === b.tries && Math.abs(a.x - b.x) < 1e-9) same++
  }
  ok(same === 10, `a call worth nothing plays exactly as no call, draw for draw (${same}/10)`)
}

// ------------------------------------------------------------------ 7
console.log('\n--- 7. the league still plays rugby\n')
{
  // one of bandcheck's worlds, a season with every AI club calling moves:
  // the bands are bandcheck's own (it asserts them over four worlds pooled;
  // one world is noisier, so this is a tripwire, not the measurement)
  const g = newGame('toulouse', 'Moves Bands', 777)
  while (g.week < 36) {
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), false)
    processWeekAndAdvance(g)
  }
  const played = g.fixtures.filter(f => f.played && g.comps[f.compId]?.type === 'league')
  const n = played.length
  const pts = played.reduce((a, f) => a + f.homeScore + f.awayScore, 0) / n
  const tries = played.reduce((a, f) => a + f.homeTries + f.awayTries, 0) / n
  const home = played.filter(f => f.homeScore > f.awayScore).length / n
  const named = Object.values(g.clubs).filter(c => Object.keys(playbookOf(c).drilled).some(k => k.startsWith('mv_'))).length
  console.log(`  ${n} league games: ${pts.toFixed(1)} pts, ${tries.toFixed(2)} tries, ${(home * 100).toFixed(1)}% home wins; ${named} clubs drilled moves`)
  ok(pts >= 48 && pts <= 53 && tries >= 6.0 && tries <= 6.6 && home >= 0.51 && home <= 0.57, 'points, tries and home advantage inside bandcheck\'s bands')
}

console.log(fails ? `\nMOVES PROBE FAILED (${fails})` : '\nMOVES PROBE PASSED: the moves are drilled, fitted, matched, heard and drawn')
process.exit(fails ? 1 : 0)
