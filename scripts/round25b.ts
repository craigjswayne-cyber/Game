// Round 25B probe: the live-feedback quick features, checked at engine level.
//
//   - mentoring: cap of four (five with a strong Centre of Excellence),
//     two-kid seniors at three-quarter speed, and pairings that end themselves
//     when the kid has nothing left to learn (user: "Mentoring should end if
//     the player has achieved everything they can. More than 3 mentoring slots
//     should be available.")
//   - fresh silverware moves a job application (user: "Ive just won the double
//     with Northampton - I shouldn't be a long shot for jobs like la rochelle")
//   - no pool rematch in the Champions Cup quarter-finals (user: "If you
//     qualify from the cup - you should not play a team from the group you
//     played next")
//   - a press question gets one week on the desk, then expires; an unread
//     story is filed by the secretary after three weeks
//   - international weeks produce a report on how your men got on
//   - the terrace pulse speaks once per streak, not weekly
//   - the recruitment meeting carries the scout tag for the Scout Reports pile
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { jobChance } from '../src/game/jobs'
import { MENTOR_MAX_KIDS, mentorCap, mentorGraduations, mentorLoad } from '../src/game/mentoring'
import type { GameState, PressItem } from '../src/game/model'
import { OFFICE_OUTLET } from '../src/game/media'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// ---- mentoring: cap, load, graduation ---------------------------------------
console.log('mentoring:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 77)
  // Northampton's real Centre of Excellence opens at level 3+, so pin both
  // sides of the gate explicitly rather than assuming the club data
  g.clubs[g.userClubId].facilities = { ...(g.clubs[g.userClubId].facilities ?? {}), academy: 2 }
  ok(mentorCap(g) === 4, `cap is four as standard (got ${mentorCap(g)})`)
  g.clubs[g.userClubId].facilities = { ...(g.clubs[g.userClubId].facilities ?? {}), academy: 3 }
  ok(mentorCap(g) === 5, `and five with a Centre of Excellence at level 3 (got ${mentorCap(g)})`)

  const squad = g.clubs[g.userClubId].players.map(id => g.players[id])
  const senior = squad.find(p => p.age >= 28 && !p.acad)!
  const kids = squad.filter(p => p.age <= 19)
  ok(kids.length >= 3, `enough kids to stage with (${kids.length})`)
  g.mentors = [{ senior: senior.id, kid: kids[0].id, pers0: kids[0].pers }]
  ok(mentorLoad(g, senior.id) === 1, 'one kid: full attention')
  g.mentors.push({ senior: senior.id, kid: kids[1].id, pers0: kids[1].pers })
  ok(mentorLoad(g, senior.id) === 0.75, 'two kids: three-quarter speed')
  ok(MENTOR_MAX_KIDS === 2, 'and two is the ceiling per senior')

  // graduation 1: the kid ages out of the mentee window
  kids[0].age = 21
  kids[0].acad = false
  // graduation setup 2: like teaches like from day one - must NOT graduate
  kids[1].pers = senior.pers
  g.mentors[1].pers0 = senior.pers
  const before = g.news.length
  mentorGraduations(g)
  ok((g.mentors ?? []).every(mp => mp.kid !== kids[0].id), 'the 21-year-old graduated out')
  ok((g.mentors ?? []).some(mp => mp.kid === kids[1].id), 'like-teaches-like did NOT end at birth')
  ok(g.news.slice(before).some(n => n.subject.includes('graduates')), 'and the graduation made the news')

  // graduation 3: the personality was adopted along the way
  const mp = (g.mentors ?? []).find(x => x.kid === kids[1].id)!
  mp.pers0 = senior.pers === 'Leader' ? 'Temperamental' : 'Leader'
  mentorGraduations(g)
  ok((g.mentors ?? []).every(x => x.kid !== kids[1].id), 'becoming your mentor completes the course')

  // graduation 4: nothing left in the tank
  const kid3 = kids[2]
  g.mentors = [{ senior: senior.id, kid: kid3.id, pers0: kid3.pers === senior.pers ? kid3.pers : kid3.pers }]
  if (kid3.pers === senior.pers) g.mentors[0].pers0 = kid3.pers // same cloth: only ceiling can end it
  kid3.ca = kid3.pa
  mentorGraduations(g)
  ok((g.mentors ?? []).length === 0, 'a kid at his ceiling graduates too')
}

// ---- fresh silverware and the job market ------------------------------------
console.log('\nthe job market:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 77)
  // the reported scenario: a manager with a real record, fresh off a double,
  // reading Long shot on a giant's job card. Give him the record first - a
  // rookie at a rep-93 club is clamped to the 5% floor with or without pots,
  // which is exactly the regime where the first draft of this check learned
  // nothing. Stale-vs-fresh isolates the recency boost: both carry the same
  // reputation credit (trophies never stop counting there), only the fresh
  // pair gets the in-demand-today bump.
  g.mgr.m = 120; g.mgr.w = 74; g.mgr.d = 6; g.mgr.l = 40
  g.mgr.finishes.push(
    { season: g.season - 3, leagueId: 'prem', pos: 2 },
    { season: g.season - 2, leagueId: 'prem', pos: 1 },
    { season: g.season - 1, leagueId: 'prem', pos: 1 })
  const clubs = Object.values(g.clubs).sort((a, b) => b.rep - a.rep)
  g.mgr.trophies = [{ compId: 'prem', season: g.season - 5 }, { compId: 'cc', season: g.season - 5 }]
  const probeClub = clubs.find(c => { const v = jobChance(g, c.id); return v > 0.08 && v < 0.65 })!
  const stale = jobChance(g, probeClub.id)
  g.mgr.trophies = [{ compId: 'prem', season: g.season }, { compId: 'cc', season: g.season }]
  const hot = jobChance(g, probeClub.id)
  console.log(`  ${probeClub.name} (rep ${probeClub.rep}): stale double ${Math.round(stale * 100)}% -> fresh double ${Math.round(hot * 100)}%`)
  ok(hot > stale + 0.2, 'a fresh double is worth over twenty points of chance beyond the same silverware gone cold')
}

// ---- press expiry and the secretary's filing --------------------------------
console.log('\nthe desk clears itself:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 77)
  // walk to week 5 first: a story can only be three weeks old once the
  // calendar has three weeks behind it (the first draft staged at week 2,
  // clamped to week 1, and proved only that a one-week story survives)
  for (let i = 0; i < 4; i++) processWeekAndAdvance(g)
  const stale: PressItem = {
    id: g.nextId++, week: g.week - 1, season: g.season, outlet: 'The Rugby Paper',
    question: 'Probe: a question left on the desk?', options: [], answered: false,
  }
  const office: PressItem = {
    id: g.nextId++, week: g.week - 2, season: g.season, outlet: OFFICE_OUTLET,
    question: 'Probe: an internal decision?', options: [], answered: false,
  }
  g.press.push(stale, office)
  g.news.push({
    id: g.nextId++, week: Math.max(1, g.week - 3), season: g.season, type: 'general', read: false,
    subject: 'Probe: an old unread story', body: 'Three weeks unread.',
  })
  g.news.push({
    id: g.nextId++, week: g.week, season: g.season, type: 'general', read: false,
    subject: 'Probe: a fresh unread story', body: 'Landed this week.',
  })
  processWeekAndAdvance(g)
  const s2 = g.press.find(p => p.question.startsWith('Probe: a question'))!
  const o2 = g.press.find(p => p.question.startsWith('Probe: an internal'))
  ok(s2.answered && s2.answerLabel === 'No comment', 'the ignored press question expired as No comment')
  ok(!!o2 && !o2.answered, 'the internal office decision kept its own clock')
  // and nothing that was BORN in that settlement died in it
  const gagged = g.press.filter(p => p.answered && p.answerLabel === 'No comment' && p.week === g.week - 1 && p.season === g.season)
  ok(gagged.length === 0, 'no question expired in the same settlement that asked it')
  const oldStory = g.news.find(n => n.subject === 'Probe: an old unread story')!
  const freshStory = g.news.find(n => n.subject === 'Probe: a fresh unread story')!
  ok(oldStory.read === true && oldStory.cleared === true, 'the three-week unread story was filed')
  ok(!freshStory.read, 'the fresh story still waits to be read')
}

// ---- a season watched for the cup draw, the Tests and the terraces ----------
console.log('\none full season, watched:\n')
{
  const g: GameState = newGame('northampton', 'Probe', 4242)
  const start = g.season
  let qfChecked = false
  let qfClash: string | null = null
  const pulseWeeks: { week: number; subject: string }[] = []
  let guard = 0
  while (g.season === start && guard++ < 60) {
    processWeekAndAdvance(g)
    if (g.season !== start) break
    // the Champions Cup quarters, the moment they exist
    if (!qfChecked) {
      const qf = g.fixtures.filter(f => f.compId === 'cc' && f.stage === 'QF')
      const pools = g.comps['cc']?.pools
      if (qf.length === 4 && pools) {
        qfChecked = true
        for (const f of qf) {
          const hp = pools.findIndex(p => p.includes(f.homeId))
          const ap = pools.findIndex(p => p.includes(f.awayId))
          if (hp >= 0 && hp === ap) qfClash = `${f.homeId} v ${f.awayId} are both pool ${hp + 1}`
        }
      }
    }
    for (const n of g.news) {
      if (n.season === g.season && n.subject.startsWith('Terrace pulse') &&
        !pulseWeeks.some(p => p.week === n.week && p.subject === n.subject)) {
        pulseWeeks.push({ week: n.week, subject: n.subject })
      }
    }
  }
  ok(qfChecked, 'the Champions Cup quarter-finals were drawn')
  ok(qfClash === null, `no quarter-final is a pool rematch${qfClash ? ` (${qfClash})` : ''}`)

  const intl = g.news.filter(n => n.subject.includes('how your men got on'))
  ok(intl.length > 0, `international weeks reported on your players (${intl.length} reports)`)
  for (const n of intl.slice(0, 2)) {
    ok(n.body.includes('**'), 'names are marked for bold in the reader')
    ok(n.body.split('\n').length <= 5, 'at most four men named plus the counted rest')
    ok(n.body.length <= 800, `under the brevity ceiling (${n.body.length} chars)`)
  }

  // one pulse per streak: the same flavour must never land in back-to-back weeks
  const sorted = [...pulseWeeks].sort((a, b) => a.week - b.week)
  const backToBack = sorted.find((p, i) => i > 0 && sorted[i - 1].subject === p.subject && p.week === sorted[i - 1].week + 1)
  ok(!backToBack, `the terrace speaks once per streak${backToBack ? ` (repeated in weeks ${backToBack.week - 1} and ${backToBack.week})` : ''}`)

  // the scouting department's mail carries its filing tag
  const meetings = g.news.filter(n => n.subject.includes('Recruitment meeting'))
  ok(meetings.length > 0 && meetings.every(n => n.tag === 'scout'), `recruitment meetings carry the scout tag (${meetings.length} seen)`)
}

// ---- the terrace cooldown, on a seed the old code provably failed -----------
// A scan of the pre-25B build found back-to-back pulses on seeds 2, 3, 5 and
// 21 (seed 2: believers in weeks 6 AND 7 of a five-win run). Seed 2 is the
// regression tripwire; the season above covers whatever its own seed brews.
console.log('\nthe terrace on seed 2 (old code repeated itself here):\n')
{
  const g: GameState = newGame('northampton', 'Probe', 2)
  const start = g.season
  const pulses: { week: number; subject: string }[] = []
  let guard = 0
  while (g.season === start && guard++ < 60) {
    processWeekAndAdvance(g)
    if (g.season !== start) break
    for (const n of g.news) {
      if (n.season === g.season && n.subject.startsWith('Terrace pulse') &&
        !pulses.some(p => p.week === n.week && p.subject === n.subject)) {
        pulses.push({ week: n.week, subject: n.subject })
      }
    }
  }
  const sorted = [...pulses].sort((a, b) => a.week - b.week)
  const b2b = sorted.find((p, i) => i > 0 && sorted[i - 1].subject === p.subject && p.week === sorted[i - 1].week + 1)
  ok(!b2b, `one pulse per streak on the seed that used to repeat${b2b ? ` (weeks ${b2b.week - 1}+${b2b.week})` : ` (${pulses.length} pulses, spaced)`}`)
  // and the beat is quieter, not dead: the first draft of the gate silenced
  // this seed's five-win run entirely
  ok(pulses.length >= 1, `the terraces still get their say (${pulses.length} pulses this season)`)
}

if (fails) { console.error(`\nROUND 25B PROBE: ${fails} failures`); process.exit(1) }
console.log('\nROUND 25B PROBE PASSED: the quick-feature batch holds')
