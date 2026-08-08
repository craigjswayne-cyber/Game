// Probe: F23 coaching philosophies, and the mean-neutrality they depend on.
//
// The claim this makes or breaks: assigning 96 dugouts a philosophy leaves the
// WORLD average of every dial on 50, so a calibrated match engine does not have
// to be re-tuned. The pairs mirror about 50 by construction, but which member of
// a pair a club gets depends on its squad, and a world where every squad tilted
// the same way would quietly drift the averages. So this measures rather than
// trusting the arithmetic.
import { newGame } from '../src/game/newgame'
import { COUNTER, PHILOSOPHIES, PHILOSOPHY_BY_ID, newCoachPhilosophy, packTilt, pickPhilosophy, philosophyOf } from '../src/game/philosophy'
import type { GameState } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

// 1. every dugout but yours has an idea, and it is a real one
const g = newGame('northampton', 'Probe Gaffer', 4242)
let missing = 0
for (const c of Object.values(g.clubs)) {
  if (c.id === g.userClubId) {
    if (c.philosophy) bad('the club you manage was handed a philosophy of its own')
    continue
  }
  if (!c.philosophy) { missing++; continue }
  if (!PHILOSOPHY_BY_ID[c.philosophy]) bad(`${c.short} carries an unknown philosophy "${c.philosophy}"`)
  const ph = PHILOSOPHY_BY_ID[c.philosophy]
  if (ph && c.tactic.style !== ph.dials.style) bad(`${c.short} says ${ph.id} but its style dial reads ${c.tactic.style}`)
}
if (missing) bad(`${missing} clubs still sit on the flat middle with no idea at all`)

// 2. the dials, world-wide, still average 50 on all four axes
function means(state: GameState) {
  const ai = Object.values(state.clubs).filter(c => c.id !== state.userClubId)
  const sum = { style: 0, tempo: 0, kicking: 0, aggression: 0 }
  for (const c of ai) {
    sum.style += c.tactic.style; sum.tempo += c.tactic.tempo
    sum.kicking += c.tactic.kicking; sum.aggression += c.tactic.aggression
  }
  const n = ai.length || 1
  return { n, style: sum.style / n, tempo: sum.tempo / n, kicking: sum.kicking / n, aggression: sum.aggression / n }
}

// Averaged over ten worlds, because one world is one draw of the hash and a
// couple of points either way on a single seed means nothing.
const TOL = 2.5
const acc = { style: 0, tempo: 0, kicking: 0, aggression: 0 }
const counts: Record<string, number> = {}
const SEEDS = 10
for (let seed = 1; seed <= SEEDS; seed++) {
  const w = newGame('leicester', 'Probe', seed * 977)
  const m = means(w)
  acc.style += m.style; acc.tempo += m.tempo; acc.kicking += m.kicking; acc.aggression += m.aggression
  for (const c of Object.values(w.clubs)) {
    if (c.id === w.userClubId || !c.philosophy) continue
    counts[c.philosophy] = (counts[c.philosophy] ?? 0) + 1
  }
  if (seed === 1) console.log(`world size: ${m.n} AI clubs`)
}
for (const k of ['style', 'tempo', 'kicking', 'aggression'] as const) {
  const mean = acc[k] / SEEDS
  console.log(`${k.padEnd(11)} world mean ${mean.toFixed(2)} (target 50)`)
  if (Math.abs(mean - 50) > TOL) {
    bad(`${k} averages ${mean.toFixed(2)} across the world, which is not mean-neutral against flat 50s`)
  }
}

// 3. all eight are in use, and none of them runs away with it
const total = Object.values(counts).reduce((a, b) => a + b, 0)
console.log('spread over ' + SEEDS + ' worlds:')
for (const ph of PHILOSOPHIES) {
  const n = counts[ph.id] ?? 0
  const pct = (n / total) * 100
  console.log(`  ${ph.id.padEnd(10)} ${String(n).padStart(4)}  ${pct.toFixed(1)}%  ${ph.name}`)
  if (!n) bad(`${ph.id} is never chosen by anybody`)
  if (pct > 26) bad(`${ph.id} takes ${pct.toFixed(1)}% of all dugouts, which is not a spread`)
}

// 4. it suits the squad: a pack-heavy club gets the pack-side idea
let agree = 0, judged = 0
for (const c of Object.values(g.clubs)) {
  if (c.id === g.userClubId) continue
  const ph = philosophyOf(c)
  const tilt = packTilt(g, c)
  // Any tilt at all decides the pair member; the threshold only skips squads
  // sitting exactly on the world median, which are a coin toss by design.
  if (!ph || Math.abs(tilt) < 0.02) continue
  judged++
  if (ph.packSide === tilt > 0) agree++
}
const agreePct = (agree / Math.max(1, judged)) * 100
console.log(`the idea suits the squad in ${agree}/${judged} clear-tilt cases (${agreePct.toFixed(0)}%)`)
if (agreePct < 99) bad(`a clear squad tilt should always decide the pair member, and it did not (${agreePct.toFixed(0)}%)`)

// 5. deterministic: the same world twice gives every club the same idea
const a = newGame('bath', 'Probe', 31337)
const b = newGame('bath', 'Probe', 31337)
for (const c of Object.values(a.clubs)) {
  if (b.clubs[c.id]?.philosophy !== c.philosophy) bad(`${c.short} rerolled its philosophy between two identical worlds`)
}

// 6. a new man in the chair brings his own, and the club does not sit on one
//    idea forever through a run of appointments
const club = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
const seen = new Set<string>()
for (let gen = 0; gen <= 12; gen++) seen.add(pickPhilosophy(g, club, gen))
console.log(`${club.short} over thirteen appointments: ${seen.size} different ideas`)
if (seen.size < 3) bad(`${club.short} would keep hiring the same coach's ideas (${seen.size} in thirteen)`)

// 7. the briefing text is fit to print
for (const ph of PHILOSOPHIES) {
  if (!/[.!]$/.test(ph.blurb)) bad(`${ph.id} blurb does not end in a full stop`)
  if (!/[.!]$/.test(ph.soft)) bad(`${ph.id} soft spot does not end in a full stop`)
  if (ph.blurb.length > 130) bad(`${ph.id} blurb is ${ph.blurb.length} characters, too long for the card`)
  for (const d of Object.values(ph.dials)) {
    if (d < 0 || d > 100) bad(`${ph.id} has a dial outside 0-100`)
  }
}


// 8. a coach change moves the club's dials in a live world
//
// The badge on the club screen is written by seedPhilosophies at world build.
// This checks the OTHER path: refreshVacancies appoints a new man behind the
// scenes when a vacancy goes stale, and he is supposed to arrive with his own
// standing instruction rather than inherit the last man's.
{
  const w = newGame('leicester', 'Probe', 8181)
  const target = Object.values(w.clubs).find(c => c.id !== w.userClubId)!
  const before = target.philosophy
  const dials0 = { ...target.tactic }
  newCoachPhilosophy(w, target)
  console.log(`${target.short}: ${before} -> ${target.philosophy} (coachGen ${target.coachGen})`)
  if (target.coachGen !== 1) bad('the appointment counter did not move')
  if (!target.philosophy || !PHILOSOPHY_BY_ID[target.philosophy]) bad('a new coach arrived with no philosophy')
  const ph = PHILOSOPHY_BY_ID[target.philosophy!]
  if (target.tactic.style !== ph.dials.style || target.tactic.tempo !== ph.dials.tempo) {
    bad('the new philosophy was recorded but the dials were left on the old one')
  }
  // and if his ideas differ, the dials must actually have moved
  if (target.philosophy !== before &&
      target.tactic.style === dials0.style && target.tactic.tempo === dials0.tempo &&
      target.tactic.kicking === dials0.kicking && target.tactic.aggression === dials0.aggression) {
    bad('a different philosophy left all four dials exactly where they were')
  }
}

// 9. every philosophy has a counter, and the counter is fit to print
for (const ph of PHILOSOPHIES) {
  const c = COUNTER[ph.id]
  if (!c) { bad(`${ph.id} has no counter, so reading it is all you can do about it`); continue }
  if (!/[.!]$/.test(c.line)) bad(`${ph.id} counter line does not end in a full stop`)
  if (c.line.length > 130) bad(`${ph.id} counter line is ${c.line.length} characters, too long for the card`)
  for (const [k, v] of Object.entries(c.dials)) {
    if (v < 0 || v > 100) bad(`${ph.id} counter has ${k} outside 0-100`)
  }
}

if (fails) { console.error(`PHILOSOPHY PROBE: ${fails} failures`); process.exit(1) }
console.log('PHILOSOPHY PROBE PASSED')
