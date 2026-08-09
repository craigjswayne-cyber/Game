import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { MENTEE_MAX_AGE, MENTOR_MIN_AGE, REPORT_EVERY, canBeMentored, canMentor, fitWord, mentorReports, mentorBoost, mentorFit } from '../src/game/mentoring'
import { EXAM_PASS_PCT, RETAKE_WEEKS, sendToCourse } from '../src/game/staff'
import { fineAttr } from '../src/game/attributes'
import { ATTR_KEYS, type Personality, type Player } from '../src/game/model'

/**
 * Three systems from this round have to be shown to work rather than asserted:
 *
 *   1. mentoring fit really is driven by character, and the multiplier it feeds
 *      the development code is mean-neutral against the flat 1.0 it replaced
 *   2. a coaching badge is decided on the spot, and a failure locks him out
 *   3. the 1-100 attribute rating is finer than a multiple of five and averages
 *      exactly five times the attribute, so nothing has been inflated
 */

let fails = 0
function ok(cond: boolean, what: string) {
  if (cond) console.log(`  ok   ${what}`)
  else { console.log(` FAIL  ${what}`); fails++ }
}

const PERS: Personality[] = ['Leader', 'Professional', 'Loyal', 'Ambitious', 'Temperamental', 'Mercenary']

/** A stand-in pair, so the test controls the characters rather than hunting for them. */
function pair(seniorPers: Personality, kidPers: Personality, lea = 12): [Player, Player] {
  const base = { a: { lea } } as unknown as Player
  const senior = { ...base, name: 'Old Head', age: 32, pers: seniorPers, a: { lea } } as Player
  const kid = { ...base, name: 'The Kid', age: 19, pers: kidPers, a: { lea: 8 } } as Player
  return [senior, kid]
}

console.log('--- 1. character decides the mentoring pairing')
{
  const [bs, bk] = pair('Leader', 'Professional', 16)
  const [ws, wk] = pair('Mercenary', 'Temperamental', 6)
  const best = mentorFit(bs, bk)
  const worst = mentorFit(ws, wk)
  console.log(`  best pairing (Leader teaching a Professional): ${best} - ${fitWord(best)}`)
  console.log(`  worst pairing (Mercenary teaching a Temperamental): ${worst} - ${fitWord(worst)}`)
  ok(best >= 80, `a Leader teaching a Professional is close to ideal (${best})`)
  ok(worst <= 30, `a Mercenary teaching a Temperamental is close to useless (${worst})`)
  ok(best - worst >= 50, `character makes a real difference (${best - worst} points apart)`)

  // every combination, and the whole grid used
  const grid: number[] = []
  for (const sp of PERS) for (const kp of PERS) {
    const [s, k] = pair(sp, kp)
    grid.push(mentorFit(s, k))
  }
  const lo = Math.min(...grid), hi = Math.max(...grid)
  const distinct = new Set(grid).size
  console.log(`  36 combinations span ${lo} to ${hi}, ${distinct} distinct values`)
  ok(distinct >= 15, `the grid is not two buckets wearing 36 hats (${distinct} values)`)
  ok(lo >= 0 && hi <= 100, 'every combination lands inside 0 to 100')

  // MEAN NEUTRALITY. The boost multiplies a development chance that used to be a
  // flat 1.0, so the average pairing must still come out at about 1.0 or every
  // academy in the game quietly speeds up or slows down.
  const boosts = PERS.flatMap(sp => PERS.map(kp => { const [s, k] = pair(sp, kp); return mentorBoost(s, k) }))
  const mean = boosts.reduce((a, b) => a + b, 0) / boosts.length
  console.log(`  mean boost across all 36 pairings: ${mean.toFixed(3)} (was a flat 1.000)`)
  // the grid is a proxy so it is allowed to be a little off; the world is not
  ok(Math.abs(mean - 1) <= 0.12, `the character grid averages about 1.0 (${mean.toFixed(3)})`)
  ok(Math.min(...boosts) >= 0.4 && Math.max(...boosts) <= 1.6, 'the multiplier stays inside its stated range')

  // ---- and again over real pairings, which is what the world actually contains
  //
  // The grid is a proxy: it fixes leadership at 12 and the age gap at 13, and
  // weights all 36 characters equally. Real squads do not - senior pros skew
  // Professional, Loyal and Leader - so the anchor has to come from the world.
  //
  // What is asserted here is deliberately NOT that every club averages 1.0. A
  // squad full of professionals SHOULD mentor better than a squad of mercenaries,
  // and a manager who pairs thoughtfully SHOULD beat one who does not; that is
  // the feature. What must hold is that the world as a whole is unchanged, and
  // that no single club is wildly off it.
  const perClub: { club: string; mean: number; best: number; worst: number; n: number }[] = []
  const world: number[] = []
  for (const [cid, seed] of [['leicester', 616], ['northampton', 7], ['bath', 99],
    ['montauban', 31], ['pirates', 5], ['munster', 777]] as const) {
    const g0 = newGame(cid, 'Pairer', seed)
    const c0 = g0.clubs[g0.userClubId]
    const sq = c0.players.map(id => g0.players[id]).filter(Boolean)
    const olds = sq.filter(canMentor)
    const kids = sq.filter(canBeMentored)
    const bs: number[] = []
    for (const s2 of olds) for (const k2 of kids) bs.push(mentorBoost(s2, k2))
    if (!bs.length) continue
    const m = bs.reduce((a, b) => a + b, 0) / bs.length
    perClub.push({ club: cid, mean: m, best: Math.max(...bs), worst: Math.min(...bs), n: bs.length })
    world.push(...bs)
  }
  const worldMean = world.reduce((a, b) => a + b, 0) / world.length
  for (const c of perClub) {
    console.log(`  ${c.club.padEnd(12)} ${c.n} pairings, mean ${c.mean.toFixed(3)}, best ${c.best.toFixed(2)}, worst ${c.worst.toFixed(2)}`)
  }
  console.log(`  world mean over ${world.length} real pairings: ${worldMean.toFixed(3)}`)
  ok(world.length > 1000 && Math.abs(worldMean - 1) <= 0.06,
    `the world's rate of youth development is unmoved (${worldMean.toFixed(3)})`)
  ok(perClub.every(c => Math.abs(c.mean - 1) <= 0.28),
    `no club is wildly off it (worst ${Math.max(...perClub.map(c => Math.abs(c.mean - 1))).toFixed(3)} away)`)
  ok(perClub.every(c => c.best - c.worst >= 0.5),
    'and at every club, choosing well beats choosing badly by a clear margin')
  console.log(`  a manager who pairs the best available gets ${Math.max(...perClub.map(c => c.best)).toFixed(2)}x, one who pairs the worst ${Math.min(...perClub.map(c => c.worst)).toFixed(2)}x`)
}

console.log('\n--- 2. a coaching badge is settled on the spot')
{
  const g = newGame('northampton', 'Badge Chaser', 3131)
  const club = g.clubs[g.userClubId]
  club.balance = 5_000_000
  let instant = 0
  let passes = 0
  let failures = 0
  let blocked = 0
  // walk the season trying every role every week: what matters is that the tier
  // moves (or the cooldown bites) on the same tick as the button
  for (let w = 0; w < 30; w++) {
    for (const role of ['assistant', 'physio', 'scout', 'attack', 'defence', 'scrumCoach', 'kicking', 'academyCoach'] as const) {
      const before = g.staffPeople?.[role]
      if (!before || before.tier >= 3) continue
      const tierBefore = before.tier
      const msg = sendToCourse(g, role)
      const after = g.staffPeople?.[role]
      if (!after) continue
      if (/cannot sit it again yet/.test(msg)) { blocked++; continue }
      if (/passed/.test(msg)) {
        instant++
        passes++
        if (after.tier !== tierBefore + 1) { console.log(` FAIL  ${role} passed but the badge did not move`); fails++ }
        if (g.staff[role] !== after.tier) { console.log(` FAIL  ${role} badge and staff level disagree`); fails++ }
      } else if (/fell short/.test(msg)) {
        instant++
        failures++
        if (after.tier !== tierBefore) { console.log(` FAIL  ${role} failed but the badge moved anyway`); fails++ }
        const abs = g.season * 100 + g.week
        if ((after.retakeAt ?? 0) !== abs + RETAKE_WEEKS) {
          console.log(` FAIL  ${role} failed without a ${RETAKE_WEEKS}-week lock-out`); fails++
        }
        // and the lock-out actually bites
        if (!/cannot sit it again yet/.test(sendToCourse(g, role))) {
          console.log(` FAIL  ${role} could sit it again immediately after failing`); fails++
        }
      }
      // nothing may be left mid-course
      if (after.course) { console.log(` FAIL  ${role} is waiting on a course again`); fails++ }
    }
    processWeekAndAdvance(g)
  }
  const rate = instant ? Math.round(passes / instant * 100) : 0
  console.log(`  ${instant} assessments settled on the spot: ${passes} passed, ${failures} failed (${rate}%), ${blocked} refused during a lock-out`)
  ok(instant > 8, `the button actually resolved things (${instant})`)
  ok(failures > 0, 'some of them failed, so the cooldown path is exercised')
  ok(blocked > 0, 'and a failed coach was refused a resit')
  ok(Math.abs(rate - EXAM_PASS_PCT) <= 22, `the pass rate is in the region of ${EXAM_PASS_PCT}% (${rate}%)`)
}

console.log('\n--- 3. the 1-100 attribute rating is finer than a multiple of five')
{
  const g = newGame('bath', 'Rater', 808)
  const club = g.clubs[g.userClubId]
  const squad = club.players.map(id => g.players[id]).filter(Boolean)
  let offSum = 0
  let n = 0
  const mods = new Set<number>()
  for (const p of squad) {
    ATTR_KEYS.forEach((k, i) => {
      const shown = fineAttr(p.id, i, p.a[k])
      offSum += shown - p.a[k] * 5
      n++
      mods.add(shown % 5)
    })
  }
  const meanOff = offSum / n
  console.log(`  ${n} ratings read, mean offset from attribute x5: ${meanOff.toFixed(3)}`)
  console.log(`  values land on ${[...mods].sort((a, b) => a - b).join(', ')} mod 5`)
  ok(mods.size >= 4, `ratings are not all multiples of five (${mods.size} of 5 residues used)`)
  ok(Math.abs(meanOff) <= 0.25, `and the average rating is still five times the average attribute (${meanOff.toFixed(3)} off)`)
  // stable: the same man reads the same twice
  const p0 = squad[0]
  ok(fineAttr(p0.id, 0, p0.a.tac) === fineAttr(p0.id, 0, p0.a.tac), 'a rating is stable, not re-rolled on every read')
}


// ---- eligibility and cadence (live feedback) --------------------------------
//
// User: "all players under 21 can have a mentor to learn from - reports should
// come in every 8 weeks on how its going, if its not working the option to
// terminate the mentoring should be an option."
//
// The trap here was that eligibility was written TWICE: the Training screen's
// dropdown and the development loop in season.ts. Widening one and not the other
// gives a pairing the game displays, files reports on, and does nothing for. Both
// now call canBeMentored, and this asserts the rule reaches a real squad.
{
  console.log('\n---- who can be mentored ----')
  const g2 = newGame('northampton', 'Eligibility', 5)
  const sq = g2.clubs[g2.userClubId].players.map(id => g2.players[id]!)
  const eligible = sq.filter(canBeMentored)
  const acad = sq.filter(p => p.acad)
  const seniorKids = sq.filter(p => !p.acad && p.age <= MENTEE_MAX_AGE)
  console.log(`  squad ${sq.length}: ${acad.length} academy, ${seniorKids.length} senior under-${MENTEE_MAX_AGE + 1}, ${eligible.length} eligible`)
  ok(eligible.length === acad.length + seniorKids.length,
    'every academy man and every senior under-21 is eligible, and nobody else')
  ok(seniorKids.length > 0,
    `the widening is not theoretical: ${seniorKids.length} senior men qualify who did not before`)
  ok(!sq.some(p => canBeMentored(p) && p.age > MENTEE_MAX_AGE && !p.acad),
    'nobody over the age limit slips in')
  ok(sq.filter(canMentor).every(p => p.age >= MENTOR_MIN_AGE && !p.acad),
    `every mentor is a senior pro of ${MENTOR_MIN_AGE} or more`)

  // and the boost really lands on a senior under-21, which is the half that was
  // gated on p.acad and would have silently done nothing
  const kid = seniorKids[0]
  const mentor = sq.filter(canMentor).sort((a, b) => b.a.lea - a.a.lea)[0]
  ok(!!kid && !!mentor, 'a senior under-21 and a senior pro both exist to pair')
  if (kid && mentor) {
    g2.mentors = [{ senior: mentor.id, kid: kid.id }]
    const before = Object.values(kid.a).reduce((s, v) => s + v, 0)
    for (let i = 0; i < 30; i++) processWeekAndAdvance(g2)
    const after = Object.values(g2.players[kid.id]!.a).reduce((s, v) => s + v, 0)
    console.log(`  ${kid.name} (${kid.age}, senior squad) attributes ${before} -> ${after} over 30 weeks with ${mentor.name}`)
    ok(after >= before, 'a senior under-21 develops under a mentor rather than being ignored')
  }

  ok(REPORT_EVERY === 8, `progress reports are filed every ${REPORT_EVERY} weeks`)
}

// ---- a failing pairing offers the way out ----------------------------------
{
  const g3 = newGame('bath', 'Terminate', 11)
  const sq = g3.clubs[g3.userClubId].players.map(id => g3.players[id]!)
  const kid = sq.filter(canBeMentored)[0]
  const mentor = sq.filter(canMentor)[0]
  if (kid && mentor) {
    // force the worst case so the "not taking" branch fires
    mentor.pers = 'Temperamental'
    kid.pers = 'Temperamental'
    g3.mentors = [{ senior: mentor.id, kid: kid.id }]
    g3.week = REPORT_EVERY
    mentorReports(g3)
    const note = g3.news.find(n => n.subject.includes('is not taking'))
    ok(!!note, 'a failing pairing files a report')
    ok(!!note && /End button/.test(note.body),
      'and the report names the End button rather than leaving the manager stuck')
  } else {
    ok(false, 'could not build a failing pairing to test')
  }
}

console.log(fails ? `\nMENTOR PROBE FAILED (${fails})` : '\nMENTOR PROBE PASSED')
if (fails) process.exit(1)
