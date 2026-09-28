// Probe: the match highlights are smooth and show tries properly (1.8.0).
//
// The old pitch drew from wherever the last line happened to put the ball, so
// it jumped. A clip is now a pure function of its spec and the clock
// (frameAt), which means smoothness can be measured instead of eyeballed:
// every clip built from real engine events is sampled at 60 frames a second,
// and nobody on it (ball, thirty players, camera) may move faster than a
// person or a ball really can between two frames.
//
// It also asserts the things the owner asked for by name: a try ends with the
// ball over the line, a review holds before its verdict, a kick flies to the
// posts, and each clip reveals its own commentary lines in order.
//
// Run: npx vite-node scripts/hlprobe.ts
import { newGame } from '../src/game/newgame'
import { beginMatch, playHalf } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'
import { buildClip, momentAt, lateAndClose, frameAt, clipLength, clipTimeline, refereeColour, type ClipSpec, type ClipKind, type ClipStyle } from '../src/ui/HighlightClip'
import type { MatchEvent } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const FPS = 60
// metres a second: a sprinting wing is about 10, so 13 leaves room for easing
// without letting anybody glide across the field
const PLAYER_MAX = 13
const BALL_MAX = 40        // a long pass or a kick in flight

const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE', turnover: 'TURNOVER', saved: 'TRY SAVER' }
const colours = { home: ['#c00', '#fff'] as [string, string], away: ['#00c', '#fff'] as [string, string] }

const specs: { spec: ClipSpec; kind: ClipKind }[] = []
// every way a try can be played, on real positions: a real try line with the
// engine's key for that kind of try (the rare ones, an intercept or a chip,
// turn up once in a few matches)
const STYLE_KEYS: [ClipStyle, string][] = [['maul', 'comm.tryMaulRumbles'], ['intercept', 'comm.try13'], ['chip', 'comm.try14'],
  ['grubber', 'comm.try8'], ['crossfield', 'comm.try2'], ['charge', 'comm.tryCharge1'], ['overlap', 'comm.try6'], ['phases', 'comm.try1'], ['phases', 'comm.try18']]
let late = 0
let real = 0
for (let seed = 1; seed <= 12 && real < 400; seed++) {
  const g = newGame('leicester', 'HL Probe', 5000 + seed)
  const fx = g.fixtures.find(f => f.week >= 2 + seed % 5 && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const ctx = beginMatch(g, fx, mulberry32(700 + seed), true)
  playHalf(g, ctx); playHalf(g, ctx)
  const ev = ctx.events
  for (let i = 0; i < ev.length; i++) {
    const kind = momentAt(ev, i, fx.homeId, 'extended')
    if (!kind) continue
    const spec = buildClip(ev, i, kind, fx.homeId, () => undefined, colours, labels, () => 'Name')
    specs.push({ spec, kind }); real++
    if (momentAt(ev, i, fx.homeId, 'key') && !momentAt(ev, i, fx.homeId, 'key')?.match(/try/) && lateAndClose(ev, i)) late++
    if (kind === 'try' && seed <= 6) for (const [, k] of STYLE_KEYS) {
      const copy: MatchEvent[] = ev.slice(0, i + 1).map((x, j) => j === i ? { ...x, k } : x)
      specs.push({ spec: buildClip(copy, i, kind, fx.homeId, () => undefined, colours, labels, () => 'Name'), kind })
    }
  }
}
const count = (k: ClipKind) => specs.filter(s => s.kind === k).length
console.log(`${real} clips from real matches and ${specs.length - real} replayed in every try style: ${count('try')} try, ${count('notry')} no try, ${count('kick')} kick, ${count('attack')} attack\n`)
ok(count('try') >= 20 && count('kick') >= 20 && count('attack') >= 10, 'enough of each kind to mean something')

console.log('\n--- smooth: nothing moves faster than it could\n')
let worst = { player: 0, ball: 0 }, worstAt = { player: '', ball: '' }
for (const { spec, kind } of specs) {
  const len = clipLength(spec)
  let prev = frameAt(spec, 0)
  for (let f = 1; f <= Math.ceil(len * FPS) + 30; f++) {
    const t = f / FPS
    const cur = frameAt(spec, t)
    const v = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) * FPS
    const bv = v(cur.ball, prev.ball)
    if (bv > worst.ball) { worst.ball = bv; worstAt.ball = `${kind}/${spec.style} line ${spec.endLine} t=${t.toFixed(2)}` }
    for (let i = 0; i < 15; i++) {
      for (const [side, a, b] of [['att', cur.att[i], prev.att[i]], ['def', cur.def[i], prev.def[i]]] as const) {
        const pv = v(a, b)
        if (pv > worst.player) { worst.player = pv; worstAt.player = `${kind}/${spec.style} line ${spec.endLine} ${side} ${i + 1} t=${t.toFixed(2)}` }
      }
    }
    const rv = v(cur.ref, prev.ref)
    if (rv > worst.player) { worst.player = rv; worstAt.player = `${kind}/${spec.style} line ${spec.endLine} referee t=${t.toFixed(2)}` }
    prev = cur
  }
}
ok(worst.player <= PLAYER_MAX, `fastest player ${worst.player.toFixed(1)} m/s (limit ${PLAYER_MAX}) ${worstAt.player}`)
ok(worst.ball <= BALL_MAX, `fastest ball ${worst.ball.toFixed(1)} m/s (limit ${BALL_MAX}) ${worstAt.ball}`)

console.log('\n--- tries shown properly\n')
const over = (s: ClipSpec) => { const b = frameAt(s, clipLength(s)).ball; return s.attackHome ? b.x >= 100 : b.x <= 0 }
const tries = specs.filter(s => s.kind === 'try' || s.kind === 'notry')
const notOver = tries.filter(s => !over(s.spec))
ok(notOver.length === 0, `every try ends with the ball grounded over the line (${tries.length - notOver.length}/${tries.length})${notOver.length ? ' not: ' + [...new Set(notOver.map(s => s.spec.style))].join(', ') : ''}`)
ok(tries.every(s => s.spec.beats.length >= 2), 'every try has a build-up of at least two phases')
const lens = tries.map(s => clipLength(s.spec))
ok(lens.every(l => l >= 4 && l <= 16), `a try clip runs between 4 and 16 seconds (${Math.min(...lens).toFixed(1)} to ${Math.max(...lens).toFixed(1)})`)
const fwd = tries.every(({ spec }) => {
  const xs = [...spec.beats.map(b => b.x), spec.finish.x]
  return xs.every((x, i) => i === 0 || (spec.attackHome ? x >= xs[i - 1] : x <= xs[i - 1]))
})
ok(fwd, 'the build-up only ever goes forward')
const reviewed = tries.filter(s => s.spec.reviewLine != null)
ok(reviewed.length > 0, `some verdicts come after a TMO review (${reviewed.length})`)
ok(reviewed.every(s => clipLength(s.spec) - frameAtLand(s.spec) >= 3.5), 'a review holds at least 3.5 s after the ball goes down')
function frameAtLand(s: ClipSpec) {
  // the ball stops moving at the land: find it
  const len = clipLength(s)
  for (let t = 0; t < len; t += 1 / FPS) {
    const a = frameAt(s, t).ball, b = frameAt(s, len).ball
    if (Math.hypot(a.x - b.x, a.y - b.y) < 0.01) return t
  }
  return len
}

console.log('\n--- the try the commentary called\n')
const styles = new Set(tries.map(s => s.spec.style))
const want: ClipStyle[] = ['phases', 'overlap', 'maul', 'intercept', 'chip', 'grubber', 'crossfield', 'charge']
ok(want.every(w => styles.has(w)), `every kind of try is played: ${want.map(w => `${w} ${tries.filter(s => s.spec.style === w).length}`).join(', ')}`)
// an intercept is a long run from their half; a maul goes over at a walk
const runFrom = (s: ClipSpec) => { const tl = clipTimeline(s); const f = frameAt(s, tl.run ? tl.run[0] : 0).ball; return s.attackHome ? 100 - f.x : f.x }
ok(tries.filter(s => s.spec.style === 'intercept').every(s => runFrom(s.spec) >= 40), 'an intercept is run in from 40 m or more')
const maulPace = tries.filter(s => s.spec.style === 'maul').map(s => { const tl = clipTimeline(s.spec); const a = frameAt(s.spec, tl.land - 2).ball, b = frameAt(s.spec, tl.land - 1).ball; return Math.abs(a.x - b.x) })
ok(maulPace.every(v => v > 0.4 && v < 2), `a maul drives over at a walk (${maulPace.length ? Math.max(...maulPace).toFixed(2) : '-'} m/s at most)`)
// a backs move is passes: the ball changes hands at least three times after the last ruck
const passes = (s: ClipSpec) => { let n = 0, was = -1; const tl = clipTimeline(s); for (let t = 0; t < tl.land; t += 1 / 30) { const c = frameAt(s, t).carrying.findIndex(x => x > 0.5); if (c >= 0 && c !== was) { if (was >= 0) n++; was = c } } return n }
ok(tries.filter(s => s.spec.style === 'overlap').every(s => passes(s.spec) >= 3), 'a backs move is at least three passes')
// NOTHING IS WRITTEN OVER THE PITCH (owner, 1.8.0: the "Can they make it?"
// and maul captions came off), and the try is not called before the ball is down
ok(specs.every(({ spec }) => !('caption' in spec) && !('caption' in clipTimeline(spec))), 'no clip carries a caption over the pitch')
ok(tries.every(s => { const tl = clipTimeline(s.spec); return tl.land > 0 && tl.banner >= tl.land }), 'the try is only called once the ball is down')

// THE CHARGE-DOWN, as the engine calls it (1.8.0): their kicker has the ball,
// it comes off the boot into the charger, bounces back over their line, and
// the side that charged it scores
const charges = tries.filter(s => s.spec.style === 'charge').map(s => s.spec)
const chargeOk = charges.every(s => {
  const tl = clipTimeline(s)
  const kickerHas = [0.9, 1.3].some(t => frameAt(s, t).carrying[15 + 9] > 0.5)
  const own = (x: number) => s.attackHome ? x : 100 - x
  // the moment it is blocked the ball is moving back towards their line
  const a = frameAt(s, 1.55).ball, b = frameAt(s, 1.95).ball
  const back = own(b.x) > own(a.x)
  const end = frameAt(s, clipLength(s))
  const scorer = end.carrying.findIndex(x => x > 0.5)
  const bounced = [1.7, 1.9, 2.1, 2.3].some(t => frameAt(s, t).lift > 0.3)
  return kickerHas && back && bounced && scorer >= 0 && scorer < 15 && tl.run != null
})
ok(charges.length > 0 && chargeOk, `a charge-down clip: their kicker has it, it is blocked and bounces back over their line, and the chargers score (${charges.length})`)
// and the block is the moment the charge-down line is read out
ok(charges.filter(s => s.beats.length > 1 && s.beats[s.beats.length - 1].line >= 0).every(s => {
  const last = s.beats[s.beats.length - 1].line
  const r = clipTimeline(s).reveals.find(x => x.line === last)
  return !!r && r.t >= 1.3
}), 'the charge-down line is read out as the kick is blocked, not before')

console.log('\n--- through the gap, not through people\n')
// on the finisher's run, nobody but the men who go for him (and miss, or
// make the tackle) comes within a metre of him
let through = 0, worstGap = '', missed = 0
for (const { spec } of specs) {
  const tl = clipTimeline(spec)
  if (!tl.run) continue
  for (let t = tl.run[0] + 0.3; t < tl.run[1] - 0.2; t += 1 / 30) {
    const f = frameAt(spec, t), who = f.carrying.findIndex(x => x > 0.5)
    if (who < 0 || who >= 15) continue
    const me = f.att[who]
    f.def.forEach((p, i) => { if (!tl.contact.includes(i) && Math.hypot(p.x - me.x, p.y - me.y) < 1.0) { through++; worstGap ||= `${spec.kind}/${spec.style} line ${spec.endLine} def ${i + 1} t=${t.toFixed(2)}` } })
    if (f.down.some(x => x > 0.5)) missed = Math.max(missed, 1)
  }
}
ok(through === 0, `nobody is run through on the way to the line${through ? ` (${through} frames, first ${worstGap})` : ''}`)
ok(tries.some(s => clipTimeline(s.spec).contact.length > 0) && missed > 0, 'men go for him and miss, and go to ground')
ok(specs.filter(s => s.kind !== 'kick').every(({ spec }) => { const f = frameAt(spec, clipTimeline(spec).land); return Math.hypot(f.ref.x - f.ball.x, f.ref.y - f.ball.y) < 30 }), 'the referee is on the pitch and near the ball')

console.log('\n--- kicks and attacks\n')
const kicks = specs.filter(s => s.kind === 'kick').map(s => s.spec)
const atPosts = (s: ClipSpec) => { const b = frameAt(s, clipLength(s)).ball; return Math.abs(b.x - (s.attackHome ? 100 : 0)) < 0.5 }
ok(kicks.every(atPosts), 'every kick ends at the posts')
ok(kicks.every(s => { const b = frameAt(s, clipLength(s)).ball; return (Math.abs(b.y - 35) < 3) === !!s.kickGood }), 'a good kick goes between the posts and a wide one does not')
ok(kicks.every(s => { const m = frameAt(s, 1.65); return m.lift > 5 }), 'the ball is in the air mid-kick')
const attacks = specs.filter(s => s.kind === 'attack').map(s => s.spec)
ok(attacks.every(s => !over(s)), 'an attack that did not score does not cross the line')
ok(attacks.every(s => s.ending === 'saved' || s.ending === 'turnover'), `an attack ends with a try-saving tackle or the ball lost (${attacks.filter(s => s.ending === 'saved').length} saved, ${attacks.filter(s => s.ending === 'turnover').length} turned over)`)
const saver = attacks.filter(s => s.ending === 'saved').every(s => { const tl = clipTimeline(s); const f = frameAt(s, tl.land + 0.4); const who = f.carrying.findIndex(x => x > 0.5); return who >= 0 && Math.hypot(f.def[14].x - f.att[who].x, f.def[14].y - f.att[who].y) < 2.5 })
ok(saver, 'the full-back makes the try-saving tackle')
ok(attacks.filter(s => s.ending === 'turnover').every(s => frameAt(s, clipLength(s) - 0.3).carrying.slice(15).some(x => x > 0.5)), 'a turnover ends with the other side on the ball')
ok(late > 0, `late in a close match, kicks and attacks come on in Key Moments too (${late})`)

console.log('\n--- the commentary keeps time with the picture\n')
const inOrder = specs.every(({ spec }) => {
  const r = clipTimeline(spec).reveals
  return r.every((x, i) => i === 0 || (x.t >= r[i - 1].t && x.line > r[i - 1].line)) && r.every(x => x.line < spec.endLine)
})
ok(inOrder, 'each clip reveals its build-up lines in order, all before the verdict line')
ok(specs.every(({ spec }) => { const tl = clipTimeline(spec); return tl.banner >= tl.land - 0.2 && tl.end > tl.banner }), 'the banner comes as the ball goes down (or after the review), and before the clip ends')
const allBeats = specs.filter(s => s.kind !== 'kick').every(({ spec }) => {
  const want = spec.beats.filter(b => b.line >= 0).map(b => b.line)
  const got = new Set(clipTimeline(spec).reveals.map(r => r.line))
  return want.every(l => got.has(l))
})
ok(allBeats, 'every build-up line the clip shows is revealed during it')

console.log('\n--- players stay on the field\n')
const inField = specs.every(({ spec }) => {
  for (let t = 0; t < clipLength(spec); t += 0.25) {
    const f = frameAt(spec, t)
    for (const p of [...f.att, ...f.def, f.ref]) if (p.y < 0 || p.y > 70 || p.x < -7 || p.x > 107) return false
  }
  return true
})
ok(inField, 'all thirty and the referee are inside the touchlines and dead-ball lines throughout')
// IN-GOAL ONLY WHEN THE PLAY IS (owner, 1.8.0: the defending full-back stood
// past the dead-ball line). A defender behind his own line is allowed only
// with the ball within a dozen metres of it, and then only a few metres back
let behind = '', deepest = 0
for (const { spec, kind } of specs) {
  if (kind === 'kick' || spec.style === 'intercept' || spec.style === 'charge') continue
  const own = (x: number) => spec.attackHome ? x : 100 - x
  for (let t = 0; t < clipLength(spec); t += 0.1) {
    const f = frameAt(spec, t)
    f.def.forEach((p, i) => {
      const depth = own(p.x) - 100
      // (a maul driven over takes the men bound in it over with it)
      if (own(f.ball.x) < 100) deepest = Math.max(deepest, depth)
      if (depth > 1 && own(f.ball.x) < 88 && !behind) behind = `${kind}/${spec.style} line ${spec.endLine} def ${i + 1} t=${t.toFixed(1)} ${depth.toFixed(1)} m in-goal with the ball ${(100 - own(f.ball.x)).toFixed(0)} m out`
    })
  }
}
ok(!behind, `nobody defends from in-goal while the play is upfield${behind ? ` (${behind})` : ''}`)
ok(deepest <= 4.5, `and nobody stands more than a few metres behind his own line (deepest ${deepest.toFixed(1)} m)`)

console.log('\n--- the referee\n')
// pink; orange when a side wears pink; cyan when the kits are pink and
// orange; and never a colour either side is wearing
const REF: [string, string, string] = ['#ec4f9c', '#f28a1e', '#22c8dc']
ok(refereeColour(['#c00000', '#ffffff', '#0000c0', '#ffffff'], REF) === REF[0], 'pink against red and blue')
ok(refereeColour(['#e8559b', '#000000', '#0000c0', '#ffffff'], REF) === REF[1], 'orange when a side wears pink')
ok(refereeColour(['#1d1d1d', '#ff6fb0', '#0000c0', '#ffffff'], REF) === REF[1], 'orange when pink is only the second colour')
ok(refereeColour(['#e8559b', '#000000', '#f58220', '#ffffff'], REF) === REF[2], 'cyan when the kits are pink and orange')
ok(refereeColour(['#e8559b', '#f58220', '#20c4d8', '#ffffff'], REF) !== undefined, 'a colour even when a side wears all three')
const oneCarrier = specs.every(({ spec }) => {
  for (let t = 0.6; t < clipLength(spec); t += 0.1) if (frameAt(spec, t).carrying.filter(c => c > 0.5).length > 1) return false
  return true
})
ok(oneCarrier, 'never two ball carriers at once')

console.log(fails ? `\nHL PROBE FAILED (${fails})` : '\nHL PROBE PASSED')
process.exit(fails ? 1 : 0)
