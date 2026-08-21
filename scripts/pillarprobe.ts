// Probe: the four pillars are load-bearing.
//
// The user approved the full challenge-mechanics design ("action everything
// above to make this game more challenging"): dressing-room authority, the
// opposing-coach anti-exploit engine, staged scouting reports and repetition
// fatigue. This probe holds each pillar to its claims, and holds the lot to
// the one meta-claim that made the design shippable at all: IN A FRESH WORLD
// AT NEUTRAL DIALS, NOTHING FIRES. The fingerprint proves the stream; this
// proves the mechanisms wake exactly when a real manager gives them reason.
import { newGame } from '../src/game/newgame'
import { applyResponse, disciplineWeek, incidentsOf, squadProfile, standing } from '../src/game/authority'
import { recordTendency, tendencyProfile } from '../src/game/tendency'
import { analystShift, archetypeOf, loudestDial, repetitionFatigue } from '../src/game/oppcoach'
import { persKnown, reportStage } from '../src/game/scout'
import { drillWeek, playbookOf, DEFAULT_LINEOUT } from '../src/game/playbook'
import { mulberry32, hashString } from '../src/game/rng'
import type { Fixture, GameState } from '../src/game/model'
import { beginMatch } from '../src/game/matchEngine'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

// ---------------------------------------------------------------------------
console.log('PILLAR 1: the room compares your name to its own\n')
const g = newGame('northampton', 'Pillars', 61)

const profNor = squadProfile(g, 'northampton')
const profEsh = squadProfile(g, 'esher')
ok(profNor > profEsh + 25, `a title squad outranks a National 1 one (${profNor} v ${profEsh})`)

const rookie = standing(g)
ok(rookie.gap < -20, `a rookie at a champion club is outranked (gap ${rookie.gap})`)
// bite ~0.41 verified by hand: gap -34 -> strain 0.56, times (1 - 0.26) for
// the trust a new manager starts with. Full bite needs a wider gap AND a
// colder room - an unemployed rookie walking into Toulouse, not Northampton.
ok(rookie.bite > 0.35, `and the room makes him feel it (bite ${rookie.bite.toFixed(2)})`)
ok(rookie.familiarity < 0.8 && rookie.familiarity >= 0.5, `patterns drill slower (x${rookie.familiarity.toFixed(2)})`)
ok(rookie.talk < 0.8, `team talks land lighter (x${rookie.talk.toFixed(2)})`)

// the way out is delivering: trust cancels three quarters of the strain
const trusted: GameState = structuredClone(g)
trusted.mgrTrust = 100
const earned = standing(trusted)
ok(earned.bite === 0, `a room fully won stops asking entirely (bite ${rookie.bite.toFixed(2)} -> ${earned.bite.toFixed(2)})`)

// and so does a name: a double-winner has no gap to bridge
const vet: GameState = structuredClone(g)
vet.mgr = { ...vet.mgr, m: 120, w: 90, d: 5, l: 25, trophies: [{ compId: 'prem', season: 1 }, { compId: 'cc', season: 2 }] as never }
const veteran = standing(vet)
ok(veteran.bite <= 0.05, `a proven name is not questioned (bite ${veteran.bite.toFixed(2)})`)

// the drilling tax is real: same week, same club, different manager
{
  const a: GameState = structuredClone(g)
  const b: GameState = structuredClone(vet)
  const beforeA = playbookOf(a.clubs.northampton).drilled[DEFAULT_LINEOUT]
  const beforeB = playbookOf(b.clubs.northampton).drilled[DEFAULT_LINEOUT]
  drillWeek(a, a.clubs.northampton, false)
  drillWeek(b, b.clubs.northampton, false)
  const gainA = playbookOf(a.clubs.northampton).drilled[DEFAULT_LINEOUT] - beforeA
  const gainB = playbookOf(b.clubs.northampton).drilled[DEFAULT_LINEOUT] - beforeB
  // the ratio IS the familiarity multiplier (0.77 at this bite) - the claim is
// that the tax exists and matches the standing, not that it is savage
ok(gainA < gainB * 0.85 && Math.abs(gainA / gainB - rookie.familiarity) < 0.03,
  `the rookie's week drills at his familiarity rate (${gainA.toFixed(2)} v ${gainB.toFixed(2)}, x${(gainA / gainB).toFixed(2)})`)
}

// ---------------------------------------------------------------------------
console.log('\nPILLAR 1b: an incident is a test of authority, not a morale event\n')
{
  const club = g.clubs.northampton
  const pid = club.players.map(id => g.players[id]).find(p => p && !p.acad)!.id
  // choose incident ids whose deterministic roll sits either side of the
  // rookie's bite, so both endings are staged rather than hoped for
  const bite = standing(g).bite
  let failId = -1, landId = -1
  for (let id = 1; id < 4000 && (failId < 0 || landId < 0); id++) {
    const roll = mulberry32((g.seed + id * 977) >>> 0)()
    if (roll <= bite && failId < 0) failId = id
    if (roll > bite && landId < 0) landId = id
  }
  ok(failId > 0 && landId > 0, `both endings stageable (ids ${failId}/${landId} against bite ${bite.toFixed(2)})`)

  const before = g.players[pid].morale
  const trustBefore = g.mgrTrust ?? 30
  incidentsOf(g).push({ id: failId, pid, kind: 'training', state: 'flagged', season: g.season, week: g.week })
  const line = applyResponse(g, incidentsOf(g).find(i => i.id === failId)!, 'fine')
  ok(incidentsOf(g).find(i => i.id === failId)!.state === 'challenged', 'a fine from an unproven manager blows up')
  ok(g.players[pid].morale < before - 0.5, `the player takes it badly (${before.toFixed(1)} -> ${g.players[pid].morale.toFixed(1)})`)
  ok((g.mgrTrust ?? 30) < trustBefore, `and the room takes his side (trust ${trustBefore} -> ${g.mgrTrust})`)
  ok(line.includes('bigger name'), 'the office says why, in words')

  // the same fine from the same manager, on a roll his standing survives
  incidentsOf(g).push({ id: landId, pid, kind: 'training', state: 'flagged', season: g.season, week: g.week })
  applyResponse(g, incidentsOf(g).find(i => i.id === landId)!, 'fine')
  ok(incidentsOf(g).find(i => i.id === landId)!.state === 'handled', 'a fine can still land when the roll favours him')

  // a quiet word always lands - the soft option is safe, not authoritative
  incidentsOf(g).push({ id: failId + 9000, pid, kind: 'rating', state: 'flagged', season: g.season, week: g.week })
  applyResponse(g, incidentsOf(g).find(i => i.id === failId + 9000)!, 'word')
  ok(incidentsOf(g).find(i => i.id === failId + 9000)!.state === 'handled', 'a quiet word ends it without a test')

  // two live grievances: the senior players knock, once, with a stamp
  incidentsOf(g).length = 0
  incidentsOf(g).push(
    { id: 7001, pid, kind: 'training', state: 'festering', season: g.season, week: g.week },
    { id: 7002, pid, kind: 'rating', state: 'challenged', season: g.season, week: g.week },
  )
  const newsBefore = g.news.length
  disciplineWeek(g)
  const meeting = g.news.slice(newsBefore).find(n => n.subject.includes('asks for a meeting'))
  ok(!!meeting, 'the senior players ask for a meeting')
  ok(g.challengeAt != null, 'stamped on state, not scanned from the news log')
  const newsBefore2 = g.news.length
  disciplineWeek(g)
  ok(!g.news.slice(newsBefore2).some(n => n.subject.includes('asks for a meeting')), 'and the cooldown holds the door')

  // an ignored incident festers on its own after two weeks - staged in a
  // world where two weeks have actually passed
  const g4 = newGame('northampton', 'Pillars', 61)
  g4.week = 5
  const pid4 = g4.clubs.northampton.players.map(id => g4.players[id]).find(p => p && !p.acad)!.id
  incidentsOf(g4).push({ id: 7003, pid: pid4, kind: 'training', state: 'flagged', season: g4.season, week: 1 })
  disciplineWeek(g4)
  ok(incidentsOf(g4).find(i => i.id === 7003)!.state === 'festering', 'silence is also an answer, and the squad hears it')
}

// ---------------------------------------------------------------------------
console.log('\nPILLAR 2: the tendency window and the coaches who read it\n')
{
  const h = newGame('northampton', 'Pillars', 61)
  ok(tendencyProfile(h) === null, 'a fresh world has no tape (profile null)')
  ok(repetitionFatigue(h) === 1, 'and no repetition tax (exactly 1.0)')

  // five weeks of wide, expansive rugby, week in week out
  const t = h.clubs.northampton.tactic
  for (let i = 0; i < 5; i++) { t.style = 85; t.tempo = 60; h.week = i + 2; recordTendency(h) }
  const prof = tendencyProfile(h)!
  ok(prof.pattern === 'width', `five weeks of width reads as width (${prof.pattern})`)
  ok(prof.predictability > 0.4, `and the habit is readable (${prof.predictability.toFixed(2)})`)

  // a manager who alternates is not readable, whatever his average
  const h2 = newGame('northampton', 'Pillars', 61)
  const t2 = h2.clubs.northampton.tactic
  for (let i = 0; i < 5; i++) { t2.style = i % 2 === 0 ? 15 : 85; h2.week = i + 2; recordTendency(h2) }
  const prof2 = tendencyProfile(h2)
  ok((prof2?.predictability ?? 0) < 0.15, `alternating 15/85 is unreadable (${(prof2?.predictability ?? 0).toFixed(2)})`)

  // the analyst does his homework; the believer does not
  const clubs = Object.keys(h.clubs)
  const byArch = { stubborn: [] as string[], analyst: [] as string[], reactive: [] as string[] }
  for (const c of clubs) byArch[archetypeOf(c)].push(c)
  ok(byArch.stubborn.length > 0 && byArch.analyst.length > 0 && byArch.reactive.length > 0,
    `all three dugout characters exist (${byArch.stubborn.length}/${byArch.analyst.length}/${byArch.reactive.length} of ${clubs.length})`)
  ok(archetypeOf('saracens') === archetypeOf('saracens'), 'and a club keeps its character')

  const analystClub = byArch.analyst.find(c => h.clubs[c].leagueId === 'prem')!
  const shift = analystShift(h, analystClub)
  ok(shift !== null, `an analyst dugout counters the width habit (${analystClub}, pull ${shift?.pull.toFixed(2)})`)
  ok(!!shift && Object.values(shift.layers).every(m => Math.abs(m - 1) < 0.08),
    'the counter is an edge, not a mirror (every layer within 8%)')
  const stubbornClub = byArch.stubborn[0]
  ok(analystShift(h, stubbornClub) === null, 'a believer reads nothing')
  ok(analystShift(newGame('northampton', 'Pillars', 61), analystClub) === null, 'and nobody reads an empty window')

  // repetition fatigue: a habit is paid for in petrol, and variety walks it back
  const h3 = newGame('northampton', 'Pillars', 61)
  const t3 = h3.clubs.northampton.tactic
  for (let i = 0; i < 5; i++) { t3.tempo = 85; h3.week = i + 2; recordTendency(h3) }
  const taxed = repetitionFatigue(h3)
  ok(taxed > 1.1, `five weeks of full tempo costs petrol (x${taxed.toFixed(2)})`)
  t3.tempo = 50; h3.week += 1; recordTendency(h3)
  t3.tempo = 50; h3.week += 1; recordTendency(h3)
  ok(repetitionFatigue(h3) < taxed, `two weeks of variety walks it back (x${repetitionFatigue(h3).toFixed(2)})`)

  ok(loudestDial({ style: 88, tempo: 55, kicking: 45, aggression: 60 })?.dial === 'style', 'the live read finds the loudest habit')
  ok(loudestDial({ style: 55, tempo: 52, kicking: 48, aggression: 55 }) === null, 'and stays quiet about a balanced one')
}

// ---------------------------------------------------------------------------
console.log('\nPILLAR 3: who a man is takes the longest to scout\n')
{
  const h = newGame('northampton', 'Pillars', 61)
  const stranger = Object.values(h.players).find(p => p.clubId && p.clubId !== 'northampton' && (p.sc ?? 0) < 35)!
  const known = Object.values(h.players).find(p => p.clubId === 'northampton' && !p.acad)!
  ok(reportStage(h, stranger) === 0, `an unscouted man is a name on a team sheet (stage 0 at ${stranger.sc}%)`)
  ok(!persKnown(h, stranger), 'his character is hidden')
  stranger.sc = 60
  ok(reportStage(h, stranger) === 2 && !persKnown(h, stranger), 'a detailed report still leaves character unknown')
  stranger.sc = 95
  ok(persKnown(h, stranger), 'the full file reveals it')
  ok(persKnown(h, known), 'your own squad was never a mystery')
}

// ---------------------------------------------------------------------------
console.log('\nINTEGRATION: the homework reaches the pitch\n')
{
  const h = newGame('northampton', 'Pillars', 61)
  const t = h.clubs.northampton.tactic
  for (let i = 0; i < 5; i++) { t.style = 85; h.week = i + 2; recordTendency(h) }
  const analystClub = Object.keys(h.clubs).find(c =>
    h.clubs[c].leagueId === 'prem' && c !== 'northampton' && archetypeOf(c) === 'analyst' && analystShift(h, c))!
  const fx: Fixture = {
    id: 970_001, compId: 'prem', round: 1, week: h.week, homeId: 'northampton', awayId: analystClub,
    played: false, homeScore: 0, awayScore: 0, homeTries: 0, awayTries: 0,
  }
  h.fixtures.push(fx)
  const ctx = beginMatch(h, fx, mulberry32(424242), true)
  const homework = ctx.events.find(e => e.text.includes('done his homework'))
  ok(!!homework, `the analyst's plan is announced before kick-off (v ${analystClub})`)
  const oppSide = ctx.home.teamId === analystClub ? ctx.home : ctx.away
  ok(Object.values(oppSide.mods).some(m => m !== 1), 'and layered into the units, where a substitution cannot wash it off')
  // the same fixture in a fresh world: silence
  const h2 = newGame('northampton', 'Pillars', 61)
  h2.fixtures.push({ ...fx, id: 970_002 })
  const ctx2 = beginMatch(h2, h2.fixtures[h2.fixtures.length - 1], mulberry32(424242), true)
  ok(!ctx2.events.some(e => e.text.includes('done his homework')), 'a manager with no habit gets no homework done on him')
}

console.log(fails ? `\nPILLAR PROBE FAILED (${fails})` : '\nPILLAR PROBE PASSED: the game asks who you are before it hands you the room')
process.exit(fails ? 1 : 0)
