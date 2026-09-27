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
import { attrLevel } from '../src/game/ageing'
import { agePlayers } from '../src/game/rollover'
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
  // put him back after every week, so the rate is the programme's and not
  // how soon his position's ceiling stops it (1.8.0, ageing.ts trainPoint);
  // and measured on a man with room to grow, since a capped attribute bites
  // on nothing
  const room = { ...p.a }
  for (const k of Object.keys(room) as (keyof Player['a'])[]) room[k] = Math.min(room[k], 6)
  for (let i = 0; i < weeks; i++) { Object.assign(p.a, room); p.tdebt = 0; if (rollPlan(g, p, rng)) hits++ }
  Object.assign(p.a, before) // put the attributes back
  p.tdebt = 0
  return hits / weeks
}

// ---- the cap is the assistant's badge (and the manager's route, 18B) -------
{
  g.mgrOrigin = 'player'
  g.staff.assistant = 0
  ok(planCap(g) === 2, `an unbadged assistant runs 2 plans (${planCap(g)})`)
  g.staff.assistant = 3
  ok(planCap(g) === 5, `a gold assistant runs 5 (${planCap(g)})`)
  g.mgrOrigin = 'coach'
  ok(planCap(g) === 6, `and a coaching-route manager runs one more himself (${planCap(g)})`)

  g.mgrOrigin = 'player' // cap back to 5 so the overflow below has to bite
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
  const keys = Object.keys(p.a) as (keyof Player['a'])[]
  const up = keys.filter(k => p.a[k] > before[k]), down = keys.filter(k => p.a[k] < before[k])
  ok(up.length > 0 && up.every(k => k === 'kic' || k === 'goa'), `and what rose is the kicking (${up.join(', ')})`)
  // 1.8.0: training directs, it does not print. Anything that fell paid for
  // the rise, and the man's level against his rating barely moves
  ok(down.every(k => k !== 'kic' && k !== 'goa'), `what paid for it is elsewhere (${down.join(', ') || 'owed for now'})`)
  const lv = (a: Player['a']) => attrLevel({ pos: p.pos, a })
  ok(Math.abs(lv(p.a) - lv(before)) < 1.5, `and his level moved ${(lv(p.a) - lv(before)).toFixed(2)} rating points, not a stat printer`)
}

// ---- three seasons on a plan: a specialist, not a different player ----------
{
  // a loosehead on the Attack plan grew into a fly-half before 1.8.0:
  // handling, passing and vision to 20 paid for out of his scrummaging
  const prop = seniors.find(x => x.pos === 'LP' || x.pos === 'TP')!
  g.plans = [{ id: prop.id, plan: 'attack' }]
  g.staff.attack = 3
  const before = { ...prop.a }
  const rng = mulberry32(11)
  for (let w = 0; w < 120; w++) rollPlan(g, prop, rng)
  ok(prop.a.han > before.han || prop.a.pas > before.pas || prop.a.vis > before.vis, `the plan works on him (han ${before.han}->${prop.a.han}, pas ${before.pas}->${prop.a.pas}, vis ${before.vis}->${prop.a.vis})`)
  ok(prop.a.han <= 15 && prop.a.pas <= 15, 'but a prop does not become a fly-half (handling and passing stop near what his position plays at)')
  ok(prop.a.scr >= before.scr - 1 && prop.a.str >= before.str - 1, `and he is still a scrummager (scr ${before.scr}->${prop.a.scr}, str ${before.str}->${prop.a.str})`)
  Object.assign(prop.a, before)
}

// ---- the plan's own growth: one rating point a summer below potential -----
{
  // agePlayers runs every man in the world, so it runs on a copy; the same
  // copy twice, with and without the plan, and every roll the same
  const kid = seniors.find(x => x.age <= 23 && x.pa - x.ca >= 6)!
  const summer = (planned: boolean) => {
    const h = structuredClone(g)
    h.plans = planned ? [{ id: kid.id, plan: 'attack' }] : []
    agePlayers(h, mulberry32(77))
    return h.players[kid.id]?.ca ?? 0
  }
  const withPlan = summer(true), without = summer(false)
  ok(withPlan === without + 1, `a man on a plan below his potential gains one rating point more in the summer (${without} -> ${withPlan})`)
}

// ---- no plan, no roll -------------------------------------------------------
{
  const p = seniors[8]
  g.plans = []
  ok(!rollPlan(g, p, mulberry32(9)), 'a man with no plan gets nothing from this system')
}

if (fails) { console.error(`\nPLAN PROBE: ${fails} failures`); process.exit(1) }
console.log('\nPLAN PROBE PASSED: individual programmes with real levers')
