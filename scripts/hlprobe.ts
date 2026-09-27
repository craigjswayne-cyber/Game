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
import { buildClip, momentAt, frameAt, cameraAt, clipLength, clipTimeline, type ClipSpec, type ClipKind } from '../src/ui/HighlightClip'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

const FPS = 60
// metres a second: a sprinting wing is about 10, so 13 leaves room for easing
// without letting anybody glide across the field
const PLAYER_MAX = 13
const BALL_MAX = 40        // a long pass or a kick in flight
const CAM_MAX = 16

const labels = { try: 'TRY', review: 'TMO', notry: 'NO TRY', good: 'GOOD', wide: 'WIDE' }
const colours = { home: ['#c00', '#fff'] as [string, string], away: ['#00c', '#fff'] as [string, string] }

const specs: { spec: ClipSpec; kind: ClipKind }[] = []
for (let seed = 1; seed <= 12 && specs.length < 400; seed++) {
  const g = newGame('leicester', 'HL Probe', 5000 + seed)
  const fx = g.fixtures.find(f => f.week >= 2 + seed % 5 && g.clubs[f.homeId] && g.clubs[f.awayId])!
  const ctx = beginMatch(g, fx, mulberry32(700 + seed), true)
  playHalf(g, ctx); playHalf(g, ctx)
  const ev = ctx.events
  for (let i = 0; i < ev.length; i++) {
    const kind = momentAt(ev, i, fx.homeId, 'extended')
    if (!kind) continue
    const spec = buildClip(ev, i, kind, fx.homeId, () => undefined, colours, labels, () => 'Name')
    specs.push({ spec, kind })
  }
}
const count = (k: ClipKind) => specs.filter(s => s.kind === k).length
console.log(`${specs.length} clips from real matches: ${count('try')} try, ${count('notry')} no try, ${count('kick')} kick, ${count('attack')} attack\n`)
ok(count('try') >= 20 && count('kick') >= 20 && count('attack') >= 10, 'enough of each kind to mean something')

console.log('\n--- smooth: nothing moves faster than it could\n')
let worst = { player: 0, ball: 0, cam: 0 }, worstAt = { player: '', ball: '', cam: '' }
for (const { spec, kind } of specs) {
  const len = clipLength(spec)
  let prev = frameAt(spec, 0), prevCam = cameraAt(spec, 0, 34)
  for (let f = 1; f <= Math.ceil(len * FPS) + 30; f++) {
    const t = f / FPS
    const cur = frameAt(spec, t), cam = cameraAt(spec, t, 34)
    const v = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) * FPS
    const bv = v(cur.ball, prev.ball)
    if (bv > worst.ball) { worst.ball = bv; worstAt.ball = `${kind} line ${spec.endLine} t=${t.toFixed(2)}` }
    for (let i = 0; i < 15; i++) {
      for (const [side, a, b] of [['att', cur.att[i], prev.att[i]], ['def', cur.def[i], prev.def[i]]] as const) {
        const pv = v(a, b)
        if (pv > worst.player) { worst.player = pv; worstAt.player = `${kind} line ${spec.endLine} ${side} ${i + 1} t=${t.toFixed(2)}` }
      }
    }
    const cv = v(cam, prevCam)
    if (cv > worst.cam) { worst.cam = cv; worstAt.cam = `${kind} line ${spec.endLine} t=${t.toFixed(2)}` }
    prev = cur; prevCam = cam
  }
}
ok(worst.player <= PLAYER_MAX, `fastest player ${worst.player.toFixed(1)} m/s (limit ${PLAYER_MAX}) ${worstAt.player}`)
ok(worst.ball <= BALL_MAX, `fastest ball ${worst.ball.toFixed(1)} m/s (limit ${BALL_MAX}) ${worstAt.ball}`)
ok(worst.cam <= CAM_MAX, `fastest camera ${worst.cam.toFixed(1)} m/s (limit ${CAM_MAX}) ${worstAt.cam}`)

console.log('\n--- tries shown properly\n')
const over = (s: ClipSpec) => { const b = frameAt(s, clipLength(s)).ball; return s.attackHome ? b.x >= 100 : b.x <= 0 }
const tries = specs.filter(s => s.kind === 'try' || s.kind === 'notry')
ok(tries.every(s => over(s.spec)), `every try ends with the ball grounded over the line (${tries.filter(s => over(s.spec)).length}/${tries.length})`)
ok(tries.every(s => s.spec.beats.length >= 2), 'every try has a build-up of at least two phases')
ok(tries.every(s => clipLength(s.spec) >= 4 && clipLength(s.spec) <= 16), 'a try clip runs between 4 and 16 seconds')
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

console.log('\n--- kicks and attacks\n')
const kicks = specs.filter(s => s.kind === 'kick').map(s => s.spec)
const atPosts = (s: ClipSpec) => { const b = frameAt(s, clipLength(s)).ball; return Math.abs(b.x - (s.attackHome ? 100 : 0)) < 0.5 }
ok(kicks.every(atPosts), 'every kick ends at the posts')
ok(kicks.every(s => { const b = frameAt(s, clipLength(s)).ball; return (Math.abs(b.y - 35) < 3) === !!s.kickGood }), 'a good kick goes between the posts and a wide one does not')
ok(kicks.every(s => { const m = frameAt(s, 1.65); return m.lift > 5 }), 'the ball is in the air mid-kick')
const attacks = specs.filter(s => s.kind === 'attack').map(s => s.spec)
ok(attacks.every(s => !over(s)), 'an attack that did not score does not cross the line')

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
    for (const p of [...f.att, ...f.def]) if (p.y < 0 || p.y > 70 || p.x < -7 || p.x > 107) return false
  }
  return true
})
ok(inField, 'all thirty are inside the touchlines and dead-ball lines throughout')
const oneCarrier = specs.every(({ spec }) => {
  for (let t = 0.6; t < clipLength(spec); t += 0.1) if (frameAt(spec, t).carrying.filter(c => c > 0.5).length > 1) return false
  return true
})
ok(oneCarrier, 'never two ball carriers at once')

console.log(fails ? `\nHL PROBE FAILED (${fails})` : '\nHL PROBE PASSED')
process.exit(fails ? 1 : 0)
