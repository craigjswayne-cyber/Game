// Probe: personal training plans are earned coaching, not a stat printer.
//
// From the competitor assessment (Sweet Nitro's Rugby Manager): "advanced
// individual training" was the one mechanic that game had over this one. The
// version built here is a handful of individual programmes with real levers:
//
//   the assistant's badge is the department's bandwidth (2 + level plans)
//   the matching specialist coach and the paddock make a plan bite more often
//   younger men absorb more of a programme than thirty-somethings
//   a plan trains ITS attributes, not a general glow
//   and the cap is enforced at read time: assigning a sixth plan quietly
//     retires the oldest, same idiom as the development focus
import { newGame } from '../src/game/newgame'
import { activePlan, planCap, rollPlan } from '../src/game/season'
import { mulberry32 } from '../src/game/rng'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g: GameState = newGame('northampton', 'Plans', 33)
const club = g.clubs[g.userClubId]
const seniors = club.players.map(id => g.players[id]).filter(p => p && !p.acad)

// a measured rate: how often a plan bites over many rolled weeks
const rate = (p: Player, seed: number, weeks = 4000) => {
  const rng = mulberry32(seed)
  let hits = 0
  const before = { ...p.a }
  for (let i = 0; i < weeks; i++) if (rollPlan(g, p, rng)) hits++
  Object.assign(p.a, before) // put the attributes back
  return hits / weeks
}

// ---- the cap is the assistant's badge --------------------------------------
{
  g.staff.assistant = 0
  ok(planCap(g) === 2, `an unbadged assistant runs 2 plans (${planCap(g)})`)
  g.staff.assistant = 3
  ok(planCap(g) === 5, `a gold assistant runs 5 (${planCap(g)})`)

  g.plans = seniors.slice(0, 6).map(p => ({ id: p.id, plan: 'scrum' as const }))
  ok(activePlan(g, seniors[0].id) == null, 'a sixth assignment quietly retires the oldest')
  ok(activePlan(g, seniors[5].id) === 'scrum', 'and the newest five all hold')
}

// ---- the coach and the paddock are the ceiling ------------------------------
{
  const p = seniors.find(x => x.age <= 23) ?? seniors[0]
  g.plans = [{ id: p.id, plan: 'scrum' }]
  g.staff.scrumCoach = 0
  club.facilities.paddock = 0
  const bare = rate(p, 1)
  g.staff.scrumCoach = 3
  club.facilities.paddock = 5
  const gold = rate(p, 1)
  console.log(`  bite rate, bare vs gold coach + level-5 paddock: ${(bare * 100).toFixed(1)}% vs ${(gold * 100).toFixed(1)}% per week`)
  ok(gold > bare * 1.8, 'a gold specialist and a real paddock roughly double the programme')
}

// ---- age matters ------------------------------------------------------------
{
  const kid = seniors.find(x => x.age <= 23)!
  const vet = seniors.find(x => x.age >= 30)!
  g.plans = [{ id: kid.id, plan: 'defence' }, { id: vet.id, plan: 'defence' }]
  g.staff.assistant = 3
  const kr = rate(kid, 2)
  const vr = rate(vet, 2)
  console.log(`  ${kid.name} (${kid.age}) bites at ${(kr * 100).toFixed(1)}%, ${vet.name} (${vet.age}) at ${(vr * 100).toFixed(1)}%`)
  ok(kr > vr, 'a youngster absorbs more of a programme than a thirty-something')
}

// ---- a plan trains its own attributes, nothing else -------------------------
{
  const p = seniors.find(x => x.age <= 23) ?? seniors[0]
  g.plans = [{ id: p.id, plan: 'kicking' }]
  const before = { ...p.a }
  const rng = mulberry32(7)
  let bumped = false
  for (let i = 0; i < 500 && !bumped; i++) bumped = rollPlan(g, p, rng)
  ok(bumped, 'the programme eventually bites')
  const moved = (Object.keys(p.a) as (keyof Player['a'])[]).filter(k => p.a[k] !== before[k])
  ok(moved.every(k => k === 'kic' || k === 'goa'), `and it moved only the kicking attributes (${moved.join(', ')})`)
  ok(moved.length > 0, 'visibly')
}

// ---- no plan, no roll -------------------------------------------------------
{
  const p = seniors[8]
  g.plans = []
  ok(!rollPlan(g, p, mulberry32(9)), 'a man with no plan gets nothing from this system')
}

if (fails) { console.error(`\nPLAN PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPLAN PROBE PASSED: individual programmes with real levers')
