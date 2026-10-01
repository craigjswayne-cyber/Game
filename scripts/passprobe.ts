// Probe: EVERY PASS GOES BACKWARDS (owner, 1.8.2: "The biggest rule of rugby
// is all passes should go backwards; if it goes forward it's a forward pass
// and a scrum to the opposition", and then "check all plays").
//
// Every picture in the game that shows the ball going from hand to hand is
// held to the law here: at the moment it is let go and the moment it is
// caught, the catch is level with or behind the release, measured up the
// field in the direction the passing side is going. Kicks are let go (a
// cross-field kick, a grubber, a box kick go forward, as they should), and so
// is a throw-in at a lineout, which goes along the line of touch.
//
//   1. THE MOVE PREVIEWS (MovePreview.tsx): each Playbook move on its loop,
//      pass by pass, from the preview's own plan.
//   2. THE TRACKS (clipPlays.ts) as written: the passer's line at release
//      against the catcher's line at the catch, for every pass in every move,
//      across the whole range of flight times a clip gives a pass.
//   3. THE STATIC PICTURES (tacticsArt.tsx): the lineout and scrum calls, the
//      exits, the kicking game, the penalty calls, every move's whiteboard and
//      every attack and defence style. Every ball line there is tagged a pass,
//      a kick or a throw, and a dashed line that is none of them fails too.
//   4. THE HIGHLIGHT CLIPS (HighlightClip.tsx): every generator path (phase
//      play, overlaps, chips, grubbers, cross-field kicks, intercepts,
//      charge-downs, mauls, attacks held up and turned over, every strike
//      move off every set piece it is called from, every shape, every attack
//      and defence style), over many seeds, and the clips of real matches.
//      Read off the baked frames: the ball's position on the last frame the
//      passer has it and the first frame the catcher does.
//
// A pass further forward than TOL fails, and the worst of each part is
// reported. The previews and the tracks are also held to a margin (MARGIN):
// the catcher at least that far behind, so it reads as backwards on a phone.
//
// Run: npx vite-node scripts/passprobe.ts
import { writeFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MOVES, MOVE_BY_ID } from '../src/game/moves'
import { ROUTINES } from '../src/game/playbook'
import type { MatchEvent } from '../src/game/model'
import { FLIGHT, TRACKS, flightFor, trackAt } from '../src/ui/clipPlays'
import { planFor } from '../src/ui/MovePreview'
import {
  ExitDiagram, KickStyleDiagram, LineoutDiagram, MOVE_DIAGRAMS, MoveDiagram, PenaltyDiagram, STYLE_DIAGRAMS, ScrumDiagram, StyleDiagram,
} from '../src/ui/tacticsArt'
import { CLIP_MOVES, buildClip, clipLength, clipTimeline, frameAt, type ClipSpec } from '../src/ui/HighlightClip'
import { newGame } from '../src/game/newgame'
import { beginMatch, lineupFor, playHalf } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

/** metres (or picture units) forward a pass may go before it fails */
const TOL = 0.05
/** how far behind the passer the catcher is in the previews and tracks */
const MARGIN = 0.3

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
type Worst = { fwd: number; what: string }
const worstOf = (xs: Worst[]) => xs.reduce<Worst>((a, b) => (b.fwd > a.fwd ? b : a), { fwd: -Infinity, what: '(none)' })
const f2 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`

// ------------------------------------------------------------------ 1
console.log('--- 1. the move previews (Playbook)\n')
{
  const all: Worst[] = []
  const bad: string[] = []
  let n = 0
  for (const m of MOVES) {
    const plan = planFor(m.id)
    if (!plan) { bad.push(`${m.id}: no preview`); continue }
    const mine: Worst[] = []
    for (const p of plan.passes) {
      n++
      const fwd = p.p1[0] - p.p0[0]
      mine.push({ fwd, what: `${m.id} ${p.from}->${p.to} at ${p.t0.toFixed(2)}s` })
    }
    const w = worstOf(mine)
    all.push(...mine)
    const wrong = mine.filter(x => x.fwd > -MARGIN)
    if (wrong.length) bad.push(...wrong.map(x => `${x.what} ${f2(x.fwd)} m`))
    console.log(`  ${m.id.padEnd(15)} ${String(mine.length).padStart(2)} passes, worst ${mine.length ? f2(w.fwd) + ' m' : '-'}`)
  }
  const w = worstOf(all)
  ok(bad.length === 0, `every pass in every preview goes backwards, by ${MARGIN} m at least (${n} passes; worst ${w.what} ${f2(w.fwd)} m)${bad.length ? '\n        ' + bad.join('\n        ') : ''}`)
}

// ------------------------------------------------------------------ 2
console.log('\n--- 2. the tracks, across the flight times a clip gives a pass\n')
{
  const all: Worst[] = []
  const bad: string[] = []
  for (const [id, trs] of Object.entries(TRACKS)) for (const tr of trs) {
    let had = tr.first ?? '9'
    const lineOf = (r: string) => tr.runs[r] ?? [[0, 0, 0] as [number, number, number]]
    for (const [rel, to, kind] of tr.ball) {
      // from the quickest pop a clip throws (0.2 s) to the longest flight
      // either the preview or a clip gives this pass (flightFor, off how far
      // it goes, and a quarter as far again for a clip's runner off his line)
      const [x0, y0] = trackAt(lineOf(had), rel), [xr, yr] = trackAt(lineOf(to), rel + 0.3)
      const hi = Math.max(FLIGHT[kind ?? 'pass'], flightFor(kind ?? 'pass', Math.hypot(xr - x0, yr - y0) * 1.25))
      let worst = -Infinity
      for (let dur = 0.2; dur <= hi + 1e-9; dur += 0.025) worst = Math.max(worst, trackAt(lineOf(to), rel + dur)[0] - x0)
      const w = { fwd: worst, what: `${id} ${had}->${to} (${kind ?? 'pass'}) at ${rel.toFixed(2)}s` }
      all.push(w)
      if (worst > -MARGIN) bad.push(`${w.what} ${f2(worst)} m`)
      had = to
    }
  }
  const w = worstOf(all)
  ok(bad.length === 0, `every pass in every track goes backwards, by ${MARGIN} m at least, however long it is in the air (${all.length} passes; worst ${w.what} ${f2(w.fwd)} m)${bad.length ? '\n        ' + bad.join('\n        ') : ''}`)
}

// ------------------------------------------------------------------ 3
console.log('\n--- 3. the static pictures\n')
{
  const pics: [string, ReturnType<typeof createElement>][] = [
    ...ROUTINES.filter(r => r.kind === 'lineout').map(r => [`lineout ${r.id}`, createElement(LineoutDiagram, { call: r.id })] as [string, ReturnType<typeof createElement>]),
    ...ROUTINES.filter(r => r.kind === 'scrum').map(r => [`scrum ${r.id}`, createElement(ScrumDiagram, { call: r.id })] as [string, ReturnType<typeof createElement>]),
    ...['box', 'long', 'counter', 'fifty22'].map(id => [`exit ${id}`, createElement(ExitDiagram, { id })] as [string, ReturnType<typeof createElement>]),
    ...['territory', 'contest', 'attack', 'balanced'].map(id => [`kicking ${id}`, createElement(KickStyleDiagram, { id })] as [string, ReturnType<typeof createElement>]),
    ...['ask', 'posts', 'corner', 'tap'].map(id => [`penalty ${id}`, createElement(PenaltyDiagram, { id })] as [string, ReturnType<typeof createElement>]),
    ...MOVE_DIAGRAMS.map(id => [`move ${id}`, createElement(MoveDiagram, { id })] as [string, ReturnType<typeof createElement>]),
    ...STYLE_DIAGRAMS.map(id => [`style ${id}`, createElement(StyleDiagram, { id })] as [string, ReturnType<typeof createElement>]),
  ]
  const all: Worst[] = []
  const bad: string[] = [], untagged: string[] = []
  let passes = 0, kicks = 0
  for (const [name, el] of pics) {
    const svg = renderToStaticMarkup(el)
    let mine = 0
    for (const g of svg.matchAll(/<g [^>]*>/g)) {
      const tag = g[0]
      const ball = /data-ball="([a-z]+)"/.exec(tag)?.[1]
      if (!ball) { if (/data-dash=/.test(tag)) untagged.push(name); continue }
      if (ball !== 'pass') { kicks++; continue }
      const [x1, , x2] = /data-line="([^"]+)"/.exec(tag)![1].split(' ').map(Number)
      passes++; mine++
      // (we always attack to the right in these pictures)
      const w = { fwd: x2 - x1, what: `${name} pass ${x1} -> ${x2}` }
      all.push(w)
      if (w.fwd > TOL) bad.push(`${w.what} (${f2(w.fwd)} units forward)`)
    }
    if (mine) console.log(`  ${name.padEnd(22)} ${mine} pass${mine > 1 ? 'es' : ''}`)
  }
  const w = worstOf(all)
  ok(untagged.length === 0, `every dashed ball line is a pass, a kick or a throw${untagged.length ? ': untagged in ' + [...new Set(untagged)].join(', ') : ''}`)
  ok(bad.length === 0 && passes > 20, `every pass drawn goes backwards (${pics.length} pictures, ${passes} passes, ${kicks} kicks and throws let go; worst ${w.what} ${f2(w.fwd)})${bad.length ? '\n        ' + bad.join('\n        ') : ''}`)
}

// ------------------------------------------------------------------ 4
console.log('\n--- 4. the highlight clips\n')

/** the probe's own dice (never the game's) */
const rnd = mulberry32(90210)
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER' }
const colours = { home: ['#c00', '#fff'] as [string, string], away: ['#00c', '#fff'] as [string, string] }
const DEFS = ['drift', 'blitz', 'pendulum', 'man', 'choke']
const ATKS = ['direct', 'pods', 'width', 'kick', 'offload']
const PODSH = [undefined, '1331', '242', 'nine']

interface Flight { from: number; to: number; t0: number; t1: number; fwd: number }
/** every time the ball goes from one man to another (or back to the same man
 *  after a spell out of his hands), read off the frames */
function flights(s: ClipSpec): Flight[] {
  const tl = clipTimeline(s)
  const d = s.attackHome ? 1 : -1
  const out: Flight[] = []
  let last = -1, lastBall = { x: 0, y: 0 }, lastT = 0, gap = false
  const L = clipLength(s)
  for (let t = 0; t <= L + 1e-9; t += 1 / 30) {
    const f = frameAt(s, t)
    const c = f.carrying.findIndex(x => x > 0.5)
    if (c < 0) { if (last >= 0) gap = true; continue }
    if (last >= 0 && (c !== last || gap)) {
      const kicked = tl.kicks.some(k => k >= lastT - 0.05 && k <= t + 0.02)
      // a turnover in the tackle is not a pass (the intercept's pass is:
      // theirs, and it has to be going backwards for them to have thrown it)
      const across = (last < 15) !== (c < 15)
      if (!kicked && (!across || s.style === 'intercept')) {
        const dir = last < 15 ? d : -d
        out.push({ from: last, to: c, t0: lastT, t1: t, fwd: (f.ball.x - lastBall.x) * dir })
      }
    }
    last = c; lastBall = { ...f.ball }; lastT = t; gap = false
  }
  return out
}

type Ev = MatchEvent
const ev = (o: Partial<Ev>): Ev => ({ min: 30, type: 'BRK', teamId: 'H', text: '', ...o } as Ev)
/** a try (or another moment) with a build-up of `n` lines by the same side */
function synth(kind: 'try' | 'review' | 'notry' | 'attack', key: string, home: boolean, pad: number, n: number, extra: Partial<Ev> = {}): { events: Ev[]; m: number } {
  const team = home ? 'H' : 'A'
  const events: Ev[] = []
  for (let i = 0; i < pad; i++) events.push(ev({ type: 'KO', teamId: '' }))
  const base = 40 + rnd() * 30
  for (let i = 0; i < n; i++) events.push(ev({ teamId: team, k: 'comm.pbpCarry1', fld: home ? base + i * 5 : 100 - base - i * 5, playerId: 1 + i }))
  if (kind === 'review') events.push(ev({ type: 'SUB', teamId: team, fx: 'TMO' } as Partial<Ev>))
  const fld = home ? 88 : 12
  events.push(ev({ type: kind === 'try' || kind === 'review' ? 'TRY' : 'BRK', teamId: team, k: key, fld, playerId: 99, ...(kind === 'notry' ? { fx: 'NOTRY' } : {}), ...extra } as Partial<Ev>))
  return { events, m: events.length - 1 }
}

const results: { name: string; f: Flight }[] = []
let clips = 0
const shirts = [10, 11, 12, 13, 14, 15, 2, 4, 6, 8, 9]
const specs = new Map<string, ClipSpec>()
const play = (name: string, s: ClipSpec) => { clips++; specs.set(name, s); for (const f of flights(s)) results.push({ name, f }) }

// (a) every commentary style of try, every kind of moment, both ways, every
// attack and defence style, many seeds
const TRY_KEYS = ['comm.try1', 'comm.try3', 'comm.try4', 'comm.try8', 'comm.try13', 'comm.try14', 'comm.try2', 'comm.tryCharge1', 'comm.tryWet2', 'comm.try18', 'comm.try11', 'comm.try7', 'comm.try5']
for (let seed = 0; seed < 70; seed++) {
  const key = TRY_KEYS[seed % TRY_KEYS.length]
  const kind = pick(['try', 'try', 'try', 'review', 'notry', 'attack'] as const)
  const home = rnd() < 0.5
  const { events, m } = synth(kind, key, home, Math.floor(rnd() * 40), 1 + Math.floor(rnd() * 3))
  const scorer = pick(shirts)
  const atk = pick(ATKS), def = pick(DEFS), pod = pick(PODSH)
  const tac = (h: boolean) => h === home ? { atkStyle: atk, podShape: pod } : { defStyle: def }
  const s = buildClip(events, m, kind, 'H', () => scorer, colours, labels, () => 'Name', () => 8 + Math.floor(rnd() * 12), tac)
  play(`${kind} ${s.style} ${atk}/${def}${pod ? '/' + pod : ''} ${home ? 'home' : 'away'} #${seed}`, s)
}
// (b) every strike move off every set piece it is called from, and every
// shape in open play, both ways, several seeds and defences
const LAUNCH_KEY: Record<string, string> = { lineout: 'comm.moveTryLo1', scrum: 'comm.moveTrySc1', tap: 'comm.moveTryTap1', open: 'comm.shapeTry1' }
for (const id of CLIP_MOVES) {
  const mv = MOVE_BY_ID[id]
  if (!mv) continue
  for (const from of mv.from) for (let seed = 0; seed < 6; seed++) {
    const home = seed % 2 === 0
    const kind = seed === 5 ? 'review' : 'try'
    const { events, m } = synth(kind, LAUNCH_KEY[from], home, seed * 7 + Math.floor(rnd() * 5), 1 + (seed % 3), { v: { move_k: mv.say } })
    const def = DEFS[seed % DEFS.length]
    const tac = (h: boolean) => h === home ? { atkStyle: pick(ATKS) } : { defStyle: def }
    // the move's own finisher, and now and then somebody else named
    const s = buildClip(events, m, kind, 'H', () => (seed === 3 ? pick(shirts) : undefined), colours, labels, () => 'Name', undefined, tac)
    play(`${id}/${from} ${def} ${home ? 'home' : 'away'} #${seed}`, s)
  }
}
// (c) real matches, every moment the extended highlights would show
{
  const BASE = newGame('leicester', 'Pass Probe', 4242)
  const ME = BASE.userClubId
  BASE.clubs[ME].tactic.lineup = lineupFor(BASE, ME)
  const FXS = BASE.fixtures.filter(f => (f.homeId === ME || f.awayId === ME) && BASE.clubs[f.homeId] && BASE.clubs[f.awayId]).slice(0, 6)
  for (let seed = 0; seed < 6; seed++) {
    const g = structuredClone(BASE)
    const fx = g.fixtures.find(f => f.id === FXS[seed % FXS.length].id)!
    const me = g.clubs[ME]
    me.tactic.moveMain = pick(['mv_loop', 'mv_switch', 'mv_crash', 'mv_decoy', 'mv_strike13', 'mv_width'])
    me.tactic.moveShape = pick(['mv_1331', 'mv_242', 'mv_backdoor'])
    const ctx = beginMatch(g, fx, mulberry32(51000 + seed), true)
    ctx.assistantSubs = true
    playHalf(g, ctx); playHalf(g, ctx)
    const evs = ctx.events
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i]
      if (!(e.type === 'TRY' || e.fx === 'NOTRY')) continue
      const s = buildClip(evs, i, 'try', fx.homeId, () => undefined, colours, labels, () => 'Name')
      play(`match ${seed} line ${i} ${s.style}${s.move ? ' ' + s.move : ''}`, s)
    }
  }
}
{
  const byPath = new Map<string, Worst>()
  for (const r of results) {
    const key = r.name.split(' ').slice(0, 2).join(' ')
    const w = byPath.get(key)
    if (!w || r.f.fwd > w.fwd) byPath.set(key, { fwd: r.f.fwd, what: r.name })
  }
  const bad = results.filter(r => r.f.fwd > TOL)
  const w = results.reduce((a, b) => (b.f.fwd > a.f.fwd ? b : a), results[0])
  const shirt = (i: number) => (i < 15 ? `${i + 1}` : `their ${i - 14}`)
  // the worst forward pass on each generator path that has one
  const pathOf = (name: string) => name.startsWith('match') ? 'match' : name.split(' ').slice(0, 2).join(' ')
  const worstBy = new Map<string, typeof results[number]>()
  for (const r of bad) { const k = pathOf(r.name), w = worstBy.get(k); if (!w || r.f.fwd > w.f.fwd) worstBy.set(k, r) }
  const tells = [...worstBy.values()].sort((a, b) => b.f.fwd - a.f.fwd).slice(0, 40)
    .map(r => `${r.name}: ${shirt(r.f.from)} to ${shirt(r.f.to)} at ${r.f.t0.toFixed(2)}s, ${f2(r.f.fwd)} m`)
  const paths = new Set(worstBy.keys())
  // (PASSPROBE_DUMP=file writes the clips with a forward pass, to replay)
  if (process.env.PASSPROBE_DUMP) writeFileSync(process.env.PASSPROBE_DUMP, JSON.stringify(Object.fromEntries([...new Set(bad.map(r => r.name))].map(n => [n, specs.get(n)]))))
  ok(clips > 250 && results.length > 600,
    `${clips} clips played, ${results.length} passes read off the frames`)
  // (the maul's hand-back from the jumper is inside the maul, not a pass
  // through the air; the passes proper are reported on their own)
  const air = results.filter(r => !/ maul /.test(` ${r.name} `))
  const wa = air.reduce((a, b) => (b.f.fwd > a.f.fwd ? b : a), air[0])
  console.log(`  the closest pass through the air: ${wa.name}, ${shirt(wa.f.from)} to ${shirt(wa.f.to)}, ${f2(wa.f.fwd)} m`)
  ok(bad.length === 0, `no pass in any clip goes forward (worst ${w.name}: ${shirt(w.f.from)} to ${shirt(w.f.to)} at ${w.f.t0.toFixed(2)}s, ${f2(w.f.fwd)} m)${bad.length ? `\n        ${bad.length} forward, on ${paths.size} paths; the worst on each:\n        ` + tells.join('\n        ') : ''}`)
}

console.log(fails ? `\nPASS PROBE FAILED (${fails})` : '\nPASS PROBE PASSED: every pass goes backwards')
process.exit(fails ? 1 : 0)
