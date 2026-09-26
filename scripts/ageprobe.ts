// ---- THE BODY AND THE CRAFT AGE DIFFERENTLY (1.7.3) ----
//
// Owner, 26 Sep 2026: "physical vs tactical aging. Although players technical
// abilities rise - so a scrimmage in the scrum is better, a kicker more
// accurate". ageing.ts carries the design; this holds it:
//
//   NO COMPOUNDING. A man whose rating does not move keeps attributes that
//   describe that rating, summer after summer. (The old rule multiplied every
//   attribute by rating against BIRTH rating every summer, without end.)
//   THE SHAPE MOVES NO RATING. Every summer's shift, read back as rating
//   points, sums to zero at every age and every position.
//   LEGS GO, CRAFT GROWS. From 26 to 34 on a flat rating a prop's scrum gets
//   better and his pace worse, a fly-half kicks better, a wing slows down.
//   OLD SAVES SETTLE. Attributes inflated by the old rule come back toward
//   the rating a quarter of the gap a summer.
//   THE SLIDE READS THE POSITION. Across a real summer, wings and full backs
//   aged 29-33 lose more rating than front-rowers and fly-halves.
//
// Run: npx vite-node scripts/ageprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { ageAttributes, ageShape, attrLevel, slope } from '../src/game/ageing'
import { SEASON_WEEKS, type GameState, type Player } from '../src/game/model'
import type { Pos } from '../src/data/types'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const POS: Pos[] = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']

console.log('--- the shape moves no rating')
{
  let worst = 0
  for (const pos of POS) for (let age = 18; age <= 38; age++) {
    const s = ageShape(age, pos)
    const sum = Object.entries(s).reduce((t, [k, v]) => t + v! / slope(pos, k as keyof Player['a']), 0)
    worst = Math.max(worst, Math.abs(sum))
  }
  ok(worst < 1e-9, `every age, every position: the shift sums to zero rating points (worst ${worst.toExponential(1)})`)
}

const g = newGame('leicester', 'Age', 7)
/** a man of this position, age and rating with textbook attributes */
const man = (pos: Pos, age: number, ca: number, id: number): Player => {
  const src = Object.values(g.players).find(p => p.pos === pos)!
  const p = structuredClone(src)
  p.id = id; p.age = age; p.ca = ca
  for (const k of Object.keys(p.a) as (keyof Player['a'])[]) p.a[k] = Math.max(1, Math.min(20, Math.round(ca * slope(pos, k))))
  return p
}
/** summers on a flat rating from `from` to `to` */
const live = (p: Player, to: number) => { while (p.age < to) { p.age++; g.season++; ageAttributes(g, p, p.ca) } return p }

console.log('--- no compounding')
{
  let worst = 0
  for (const pos of POS) for (const ca of [55, 70, 85]) {
    const p = live(man(pos, 22, ca, 900000 + ca), 34)
    worst = Math.max(worst, Math.abs(attrLevel(p) - ca))
  }
  ok(worst < 4, `twelve summers on a flat rating: attributes still describe it (worst gap ${worst.toFixed(1)} rating points)`)
  const grow = man('CE', 19, 50, 900100)
  for (let y = 0; y < 6; y++) { grow.age++; g.season++; const before = grow.ca; grow.ca += 3; ageAttributes(g, grow, before) }
  const fromHere = attrLevel(grow)
  live(grow, 31)
  ok(Math.abs(fromHere - 68) < 4 && Math.abs(attrLevel(grow) - 68) < 4,
    `a lad who grew 50 -> 68 and then stopped stays a 68 (${fromHere.toFixed(1)} at 25, ${attrLevel(grow).toFixed(1)} at 31)`)
}

console.log('--- legs go, craft grows')
{
  const prop = man('TP', 26, 72, 900200), before = { ...prop.a }
  live(prop, 34)
  ok(prop.a.scr > before.scr && prop.a.pac < before.pac, `tighthead 26 -> 34: scrum ${before.scr} -> ${prop.a.scr}, pace ${before.pac} -> ${prop.a.pac}`)
  const fh = man('FH', 26, 72, 900300), fb = { ...fh.a }
  live(fh, 34)
  ok(fh.a.kic > fb.kic && fh.a.goa > fb.goa, `fly-half 26 -> 34: kicking ${fb.kic} -> ${fh.a.kic}, goal kicking ${fb.goa} -> ${fh.a.goa}`)
  const wg = man('WG', 26, 72, 900400), wb = { ...wg.a }
  live(wg, 34)
  ok(wg.a.pac <= wb.pac - 2, `wing 26 -> 34: pace ${wb.pac} -> ${wg.a.pac}`)
  const kid = man('WG', 18, 60, 900500), kb = { ...kid.a }
  live(kid, 23)
  ok(kid.a.pac >= kb.pac, `and a young wing's legs are still coming (${kb.pac} -> ${kid.a.pac} from 18 to 23)`)
}

console.log('--- old saves settle')
{
  const p = man('FL', 27, 68, 900600)
  for (const k of Object.keys(p.a) as (keyof Player['a'])[]) p.a[k] = Math.min(20, Math.round(95 * slope('FL', k)))
  const start = attrLevel(p)
  live(p, 35)
  ok(start - 68 > 20 && Math.abs(attrLevel(p) - 68) < 8, `a flanker inflated to ${start.toFixed(0)} on a 68 rating reads ${attrLevel(p).toFixed(0)} after eight summers`)
}

console.log('--- the slide reads the position, across a real summer')
{
  const w: GameState = newGame('leicester', 'Age', 31)
  const pre = new Map(Object.values(w.players).map(p => [p.id, { ca: p.ca, age: p.age, pos: p.pos }]))
  const target = w.season + 1
  for (let guard = 0; w.season < target && guard < SEASON_WEEKS + 5; guard++) {
    const fx = userFixtureThisWeek(w); if (fx) simMatch(w, fx, weekRng(w), false)
    for (const pi of w.press.filter(p => !p.answered)) answerPress(w, pi.id, 0)
    processWeekAndAdvance(w)
  }
  const drop = (set: string[]) => {
    const xs = Object.values(w.players).map(p => ({ p, b: pre.get(p.id) })).filter(({ p, b }) => b && set.includes(b.pos) && p.age >= 29 && p.age <= 33 && p.age === b.age + 1)
    return { n: xs.length, d: xs.reduce((s, { p, b }) => s + (p.ca - b!.ca), 0) / Math.max(1, xs.length) }
  }
  const fast = drop(['WG', 'FB']), craft = drop(['LP', 'TP', 'HK', 'FH'])
  ok(fast.n > 50 && craft.n > 50 && fast.d < craft.d - 0.3,
    `29-33: wings and full backs ${fast.d.toFixed(2)} a summer (n${fast.n}), front row and fly-halves ${craft.d.toFixed(2)} (n${craft.n})`)
  const old = Object.values(w.players).filter(p => p.age >= 31 && p.clubId), young = Object.values(w.players).filter(p => p.age >= 22 && p.age <= 25 && p.clubId)
  const rel = (ps: Player[], k: keyof Player['a']) => ps.reduce((s, p) => s + p.a[k] / slope(p.pos, k) - p.ca, 0) / ps.length
  ok(rel(old, 'pac') < rel(young, 'pac') - 5 && rel(old, 'scr') > rel(young, 'scr') + 3,
    `the world agrees: pace against rating ${rel(young, 'pac').toFixed(1)} at 22-25, ${rel(old, 'pac').toFixed(1)} at 31+; scrum ${rel(young, 'scr').toFixed(1)} -> ${rel(old, 'scr').toFixed(1)}`)
}

console.log(fails ? `\nAGE PROBE FAILED (${fails})` : '\nAGE PROBE PASSED: legs go, craft grows, and nobody inflates')
process.exit(fails ? 1 : 0)
