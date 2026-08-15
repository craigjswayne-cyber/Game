// Round 25C probe: the season-structure batch, checked at engine level.
//
//   - the European calendar (user: "European qtr finals are usually early
//     april. Semis early may and final end of may. The final of the
//     premiership is usually in june"): CC knockouts at weeks 34/38/41,
//     which the week-to-date anchor maps to 4 Apr / 2 May / 23 May, with the
//     Premiership final at week 43 (6 June) as it already was
//   - ages move exactly once a season, at rollover (user: "do ages change?
//     the players should be one year older at the start of each season")
//   - three board objectives a season, rotating, and a banked objective that
//     comes true mid-season makes the news exactly once (user: "is the
//     objectives system working... when achieved it should def be in the
//     news. Maybe a bit more variety in there")
//   - the summer sponsorship decision (user: "you should be able to choose
//     between deals... short term for lower amounts or bigger deals for
//     longer"): when a deal lapses, the office asks, and answering signs
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { answerPress } from '../src/game/media'
import { offersFor } from '../src/game/commercial'
import { OBJECTIVE_DEFS } from '../src/game/objectives'
import { weekDate } from '../src/game/model'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

console.log('the calendar:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 505)
  const cc = g.comps['cc']
  ok(JSON.stringify(cc?.koWeeks) === '[34,38,41]', `Champions Cup knockouts at weeks 34/38/41 (got ${JSON.stringify(cc?.koWeeks)})`)
  console.log(`  QF ${weekDate(0, 34)} · SF ${weekDate(0, 38)} · Final ${weekDate(0, 41)} · Prem final ${weekDate(0, 43)}`)
  ok(weekDate(0, 34).includes('Apr'), 'the quarters are an April date')
  ok(weekDate(0, 38).includes('May'), 'the semis are a May date')
  ok(weekDate(0, 41).includes('May'), 'the final is a May date')
  ok(weekDate(0, 43).includes('Jun'), 'and the league final is June')
  // no club may be asked to play twice in one week by the new layout
  const seen = new Map<string, Set<number>>()
  let doubled: string | null = null
  for (const f of g.fixtures) {
    for (const t of [f.homeId, f.awayId]) {
      const s = seen.get(t) ?? new Set()
      if (s.has(f.week)) doubled = `${t} twice in week ${f.week}`
      s.add(f.week)
      seen.set(t, s)
    }
  }
  ok(doubled === null, `no club plays twice in a week${doubled ? ` (${doubled})` : ''}`)
}

console.log('\nobjectives, ageing, and two full seasons watched:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 505)
  ok((g.objectives ?? []).length === 3, `three board objectives set (${(g.objectives ?? []).length})`)
  const firstObjectives = [...(g.objectives ?? [])].sort().join(',')
  const ages0 = new Map(Object.values(g.players).map(p => [p.id, p.age]))

  const achieved = new Map<string, number>() // subject -> times seen
  let start = g.season
  let guard = 0
  // season one
  while (g.season === start && guard++ < 60) {
    processWeekAndAdvance(g)
    for (const n of g.news) {
      if (n.subject.startsWith('✅ Board objective met')) {
        achieved.set(n.subject + '|' + n.id, 1)
      }
    }
  }
  // ---- ageing: every survivor is exactly one year older
  let ageDrift: string | null = null
  let checked = 0
  for (const p of Object.values(g.players)) {
    const a0 = ages0.get(p.id)
    if (a0 == null) continue // a regen born in the summer
    checked++
    if (p.age !== a0 + 1) ageDrift = `${p.name} went ${a0} -> ${p.age}`
  }
  ok(checked > 500 && ageDrift === null, `${checked} players aged exactly one year at rollover${ageDrift ? ` (${ageDrift})` : ''}`)

  // ---- the news heard about the banked objectives
  const uniqueAchievements = new Set([...achieved.keys()].map(k => k.split('|')[0]))
  console.log(`  achievement headlines seen in season one: ${uniqueAchievements.size ? [...uniqueAchievements].join(' / ') : 'none'}`)
  ok(uniqueAchievements.size > 0, 'at least one banked objective made the news')
  // once each: no objective may be celebrated twice (subjects are per-objective)
  const bySubject = new Map<string, number>()
  for (const k of achieved.keys()) {
    const subj = k.split('|')[0]
    bySubject.set(subj, (bySubject.get(subj) ?? 0) + 1)
  }
  const twice = [...bySubject.entries()].find(([, n]) => n > 1)
  ok(!twice, `no objective celebrated twice${twice ? ` (${twice[0]} x${twice[1]})` : ''}`)

  // ---- the board deals a different hand next season
  const secondObjectives = [...(g.objectives ?? [])].sort().join(',')
  ok((g.objectives ?? []).length === 3, 'three objectives again in season two')
  ok(secondObjectives !== firstObjectives, `and the hand rotates (${firstObjectives} -> ${secondObjectives})`)
  for (const id of g.objectives ?? []) {
    ok(!!OBJECTIVE_DEFS.find(o => o.id === id), `objective '${id}' is a real brief`)
  }

  // ---- the sponsorship decision: run to the summer a deal lapses
  start = g.season
  guard = 0
  let decision = g.press.find(p => p.options.some(o => o.deal))
  while (!decision && guard++ < 130) {
    processWeekAndAdvance(g)
    decision = g.press.find(p => p.options.some(o => o.deal))
  }
  ok(!!decision, `the office asks about a lapsed deal (${decision ? `season ${g.season}, "${decision.question.slice(0, 50)}..."` : 'never asked in 130 weeks'})`)
  if (decision) {
    ok(decision.options.length === 4, 'three offers and the stopgap on the table')
    const slot = decision.options[0].deal!.slot as 'shirt' | 'naming' | 'kit'
    const short = offersFor(g, slot)[1]
    answerPress(g, decision.id, 1) // take the short deal at a premium
    const d = g.deals?.[slot]
    ok(!!d && !d.auto && d.sponsor === short.sponsor && d.weekly === short.weekly,
      `answering signed the named deal (${d?.sponsor} at £${Math.round((d?.weekly ?? 0) / 100) / 10}k/wk)`)
  }
}

console.log('\nthe expectations decision and the annual stamp:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 606)
  processWeekAndAdvance(g)
  processWeekAndAdvance(g) // the launch decision is asked as week 2 settles
  const launch = g.press.find(p => p.options.some(o => o.stance))
  ok(!!launch, 'the office asks how to pitch the season')
  if (launch) {
    answerPress(g, launch.id, 0) // aim high
    ok(g.stance === 'high', `answering set the stance (${g.stance})`)
  }

  // the stance moves the boardroom needle: same world, same results, but the
  // aim-high manager swings harder. structuredClone forks the save; the weekly
  // rng derives from (seed, week), so both forks play identical fixtures.
  const base = structuredClone(g)
  base.stance = undefined
  base.press = base.press.map(p => ({ ...p, answered: true }))
  const hi = structuredClone(base)
  hi.stance = 'high'
  let compared = false
  for (let w = 0; w < 10 && !compared; w++) {
    processWeekAndAdvance(base)
    processWeekAndAdvance(hi)
    const club = base.clubs[base.userClubId]
    const clubHi = hi.clubs[hi.userClubId]
    const fx = base.fixtures.find(f => f.played && f.week === base.week - 1 &&
      (f.homeId === club.id || f.awayId === club.id))
    // skip friendlies: 'fr' results bank sharpness but never reach the
    // boardroom, so both forks read identically off one (surfaced when the
    // 25D-2 match-day wobble turned the week-3 friendly decisive)
    if (!fx || fx.homeScore === fx.awayScore || fx.compId === 'fr') continue
    const won = fx.homeId === club.id ? fx.homeScore > fx.awayScore : fx.awayScore > fx.homeScore
    compared = true
    if (won) ok(clubHi.boardConfidence > club.boardConfidence,
      `a win under aim-high earns more credit (${clubHi.boardConfidence.toFixed(1)} v ${club.boardConfidence.toFixed(1)})`)
    else ok(clubHi.boardConfidence < club.boardConfidence,
      `a defeat under aim-high costs more (${clubHi.boardConfidence.toFixed(1)} v ${club.boardConfidence.toFixed(1)})`)
  }
  ok(compared, 'a decisive result was found to compare the stances on')

  // ...and the annual stamp waits at the end of the season
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) processWeekAndAdvance(g)
  ok(g.annual?.season === start, `the rollover stamped the Annual for season ${start} (got ${JSON.stringify(g.annual)})`)
  ok(g.stance === undefined, 'and the stance died with the old season')
}

if (fails) { console.error(`\nROUND 25C PROBE: ${fails} failures`); process.exit(1) }
console.log('\nROUND 25C PROBE PASSED: the season has its real shape')
