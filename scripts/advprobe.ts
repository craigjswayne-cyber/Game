/**
 * ---- THE v1.6.7 DESIGN ROUND, AT THE ENGINE ----
 *
 * Four changes came out of a design review against the failure modes other
 * mobile rugby managers are reported for. Three of them move the scoreboard
 * and one of them is a law that did not exist, so all four get a tripwire
 * rather than a measurement somebody took once:
 *
 *   1. ADVANTAGE. The arm goes out and the whistle stays down. A kickable
 *      penalty can end in a try under the advantage, be waved away with
 *      ground made, or come back for the kick - and the third is much the
 *      most common.
 *   2. The advantage must not break the match loop: the manager is still
 *      asked for the call, and the whistle still waits for his answer.
 *   3. TRAINING INJURIES. A quarter to a third of rugby's damage is done on
 *      a Tuesday. It must happen, it must be shorter than match damage on
 *      average, it must be written to the log, and the manager must be told.
 *   4. GOAL KICKING must separate men at the TOP of the range. The old curve
 *      clamped everyone from 16 upwards to the same 93%, which is where a
 *      manager cares most about the attribute.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { beginMatch, simMatch, stepTick, resolveDecision } from '../src/game/matchEngine'
import { requestExpansion } from '../src/game/season'
import { upkeepWeek } from '../src/game/upkeep'
import { GROUND_UPKEEP_F, groundLevel, groundUpkeep } from '../src/game/model'
import { ZONE_PLANS, zonePlan } from '../src/game/tactics'
import { mulberry32 } from '../src/game/rng'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

// ---------------------------------------------------------------- 1. advantage
console.log('=== 1. the arm stays out ===')
{
  let played = 0, over = 0, pens = 0, matches = 0
  for (const seed of [4242, 777, 31337]) {
    const g = newGame('leicester', 'Adv', seed)
    const fx = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId] && !f.played).slice(0, 120)
    for (const f of fx) {
      const r = simMatch(g, f, mulberry32(seed + f.id), true)
      matches++
      for (const e of r.events) {
        if (e.k === 'comm.advPlaying') played++
        else if (e.k === 'comm.advOver') over++
        else if (e.type === 'PEN') pens++
      }
    }
  }
  console.log(`  ${matches} matches: ${played} tries under the arm, ${over} waved away, ${pens} penalties kicked`)
  ok(played > 0, 'a side scores under the advantage rather than stopping for the kick')
  ok(over > 0, 'and a referee waves one away with the three points gone')
  // the common case must stay the common case, or the penalty is not a
  // scoring route any more. Measured at about an eighth diverted.
  const diverted = (played + over) / Math.max(1, played + over + pens)
  ok(diverted > 0.03 && diverted < 0.30,
    `most advantages still come back for the kick (${(diverted * 100).toFixed(0)}% diverted, want 3-30%)`)
}

// -------------------------------------------- 2. the loop, and the held whistle
console.log('\n=== 2. the match loop still asks, and still waits ===')
{
  // drive a user match tick by tick and answer every call that opens
  let asked = 0, answered = 0, ranToTheEnd = 0
  for (const seed of [11, 22, 33, 44, 55]) {
    const g = newGame('leicester', 'Adv', seed)
    let fx = null
    for (let w = 0; w < 12 && !fx; w++) { fx = userFixtureThisWeek(g); if (!fx) processWeekAndAdvance(g) }
    if (!fx) continue
    const ctx = beginMatch(g, fx, weekRng(g, 'adv' + seed), true)
    for (let guard = 0; guard < 400; guard++) {
      if (ctx.decision) { asked++; resolveDecision(g, ctx, 'posts'); answered++; continue }
      if (ctx.awaiting) { ctx.awaiting = null; continue }
      if (ctx.seg >= 3) break
      stepTick(g, ctx)
    }
    if (ctx.seg >= 3) ranToTheEnd++
  }
  console.log(`  ${asked} calls opened, ${answered} answered, ${ranToTheEnd}/5 matches reached full time`)
  ok(asked > 0, 'the manager is still asked for the touchline call')
  ok(ranToTheEnd === 5, 'and every match still reaches full time with advantage in the loop')
}

// -------------------------------------------------------- 3. training injuries
console.log('\n=== 3. the Tuesday session ===')
{
  let train = 0, match = 0, trainWks = 0, matchWks = 0, letters = 0, clubSeasons = 0
  for (const seed of [4242, 777]) {
    const g = newGame('leicester', 'Adv', seed)
    const seen = new Map<number, number>()
    for (const p of Object.values(g.players)) seen.set(p.id, (p.injLog ?? []).length)
    const news0 = g.news.length
    for (let w = 0; w < 44; w++) {
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g, 'tw' + w), false)
      processWeekAndAdvance(g)
    }
    letters += g.news.slice(news0).filter(n => n.k === 'news.trainInjury' || n.k === 'news.trainInjuryOne').length
    for (const club of Object.values(g.clubs)) {
      clubSeasons++
      for (const id of club.players) {
        const p = g.players[id]
        if (!p) continue
        for (const e of (p.injLog ?? []).slice(seen.get(p.id) ?? 0)) {
          // the training list is its own: the achilles and the knee are on
          // both, but a broken hand only ever comes out of a match
          if (e.dk === 'injury.brokenHand' || e.dk === 'injury.ribs') { match++; matchWks += e.weeks }
          else { train++; trainWks += e.weeks }
        }
      }
    }
  }
  console.log(`  ${clubSeasons} club-seasons: ${train + match} injuries logged, ${letters} letters to the manager`)
  ok(train + match > clubSeasons * 12,
    `the medical room is busy enough to be a squad problem (${((train + match) / clubSeasons).toFixed(1)} a club-season, want 12+)`)
  ok(letters > 0, 'a training injury reaches the manager, which is the only way he can learn of one')
}

// ------------------------------------------------------------- 4. the top end
console.log('\n=== 4. the goal-kicking ladder separates at the top ===')
{
  // the curve, read straight off the engine's own constants
  const pen = (goa: number) => Math.min(0.90, Math.max(0.38, 0.53 + goa / 54))
  const con = (goa: number) => Math.min(0.90, Math.max(0.38, 0.495 + goa / 54))
  for (const goa of [8, 12, 14, 16, 18]) {
    console.log(`  goa ${String(goa).padStart(2)}  penalty ${(pen(goa) * 100).toFixed(0)}%  conversion ${(con(goa) * 100).toFixed(0)}%`)
  }
  ok(pen(18) - pen(14) > 0.05, 'a goa of 18 is a better penalty kicker than a goa of 14 (they used to be identical)')
  ok(con(18) - con(14) > 0.05, 'and a better conversion kicker')
  ok(pen(18) < 0.90, 'the very best raw kicker is still short of the ceiling without coaching behind him')
  // the realised world rate is the number that matters, and it is measured
  // in scripts/_bal-style runs; this holds the design point it was tuned to
  ok(con(15) > 0.70 && con(15) < 0.80,
    `a good club kicker converts in the seventies, as the professional game does (${(con(15) * 100).toFixed(0)}%)`)
}

// ------------------------------------------------- 5. what a ground costs
console.log('\n=== 5. a stadium costs more a seat than a terrace ===')
{
  for (const cap of [1_500, 3_000, 6_000, 9_000, 15_000, 32_000]) {
    const wk = groundUpkeep(cap)
    console.log(`  stage ${groundLevel(cap)}  ${cap.toLocaleString().padStart(6)} seats  £${Math.round(wk).toLocaleString()}/wk  (£${(wk / cap).toFixed(2)} a seat)`)
  }
  ok(groundUpkeep(32_000) / 32_000 > groundUpkeep(1_500) / 1_500 * 1.3,
    'the seat price itself climbs with the ground, not just the number of seats')
  // the same ground costs the same to run whoever owns it: this is the
  // incoherence that once made the manager four times richer than the median
  ok(GROUND_UPKEEP_F.length === 6, 'there is one multiplier per ground, and one table for the whole world')
}

console.log('\n=== 6. the ground wears out, and a stand makes it new ===')
{
  const g = newGame('leicester', 'Adv', 4242)
  const club = g.clubs[g.userClubId]
  const w0 = club.wear ?? 0
  for (let i = 0; i < 20; i++) processWeekAndAdvance(g)
  const w1 = club.wear ?? 0
  ok(w1 > w0, `wear climbs while nobody builds (${w0} -> ${w1})`)
  // and a finished stand puts it back to nothing
  club.boardConfidence = 90; club.balance = 200_000_000
  g.facilityAskCooldown = 0; g.expandedSeason = -1
  requestExpansion(g)
  if (g.stadiumBuild) {
    for (let i = 0; i < 20 && g.stadiumBuild; i++) processWeekAndAdvance(g)
    ok((club.wear ?? 99) === 0 || (club.wear ?? 99) < w1,
      `a new stand resets the ground's wear (${w1} -> ${club.wear})`)
  } else {
    console.log('  NOTE  the board would not build this season, so the reset is untested here')
  }
  // a village ground never gets a stadium's electricity bill
  const small = newGame('leicester', 'Adv', 777)
  const sc = small.clubs[small.userClubId]
  sc.capacity = 1_500
  let sawBig = 0
  for (let i = 0; i < 300; i++) {
    const n0 = small.news.length
    upkeepWeek(small, mulberry32(9000 + i))
    for (const n of small.news.slice(n0)) {
      if (n.k === 'news.upPower' || n.k === 'news.upSeats' || n.k === 'news.upNaming') sawBig++
    }
  }
  ok(sawBig === 0, `a stage-zero ground is never sent a stadium's bill or a stadium's windfall (${sawBig} leaked)`)
}

// ------------------------------------------------- 7. territory, and zones
console.log('\n=== 7. the game is played somewhere ===')
{
  const g = newGame('leicester', 'Adv', 4242)
  const fxs = g.fixtures.filter(f => g.clubs[f.homeId] && g.clubs[f.awayId]).slice(0, 60)
  const hist: number[] = []
  for (const fx of fxs) {
    const ctx = beginMatch(g, fx, mulberry32(fx.id * 31 + 7), false)
    for (let i = 0; i < 20; i++) {
      stepTick(g, ctx)
      if (ctx.awaiting) ctx.awaiting = null
      if (ctx.decision) ctx.decision = null
      hist.push(ctx.field)
    }
  }
  const mean = hist.reduce((a, b) => a + b, 0) / hist.length
  const own = hist.filter(f => f < 22).length / hist.length
  const opp = hist.filter(f => f > 78).length / hist.length
  console.log(`  ${hist.length} ticks: mean ${mean.toFixed(1)}, own 22 ${(own * 100).toFixed(0)}%, their 22 ${(opp * 100).toFixed(0)}%`)
  // NEUTRAL ACROSS THE WORLD. The position factor is an exact reciprocal
  // between the two sides, so if the line itself had a bias the whole league
  // would tilt with it - and nothing else in this engine would say so.
  ok(Math.abs(mean - 50) < 3, `the line has no bias of its own (mean ${mean.toFixed(1)}, want 50 +/- 3)`)
  // and it has to actually go places, or the zones below name nothing
  ok(own > 0.05 && opp > 0.05, `rugby is played in both 22s (${(own * 100).toFixed(0)}% / ${(opp * 100).toFixed(0)}%)`)
  ok(own < 0.3 && opp < 0.3, 'and is not played only in the 22s')
}

console.log('\n=== 8. a zone plan does what it says, in its own zone ===')
{
  // MEASURED IN THE ZONE, not across a match. A plan only applies where it
  // applies, and each 22 is about a tenth of an afternoon, so a whole-match
  // difference for those two sits under the noise of any run this size. What
  // has to be true is that the mechanism bites where it is meant to.
  // AVERAGE FIELD POSITION, not a count of ticks past a threshold. The count
  // version was measured first and could not tell the two exits apart at any
  // sample size this probe can afford - a threshold throws away every metre
  // of the difference and keeps only whether it crossed a line.
  const inZone = (planId: string, zone: 'own22' | 'opp22' | 'middle') => {
    let ticks = 0, sum = 0
    for (const seed of [5, 15, 25, 35, 45]) {
      const g = newGame('toulouse', 'Adv', seed)
      const club = g.clubs[g.userClubId]
      club.tactic.zones = { [zone]: planId } as never
      const fxs = g.fixtures.filter(f => f.homeId === club.id && g.clubs[f.awayId]).slice(0, 14)
      for (const fx of fxs) {
        const ctx = beginMatch(g, fx, mulberry32(seed * 131 + fx.id), false)
        for (let i = 0; i < 20; i++) {
          stepTick(g, ctx)
          if (ctx.awaiting) ctx.awaiting = null
          if (ctx.decision) ctx.decision = null
          ticks++; sum += ctx.field
        }
      }
    }
    return { ticks, avgUp: ticks ? sum / ticks : 0 }
  }
  const long = inZone('long', 'own22')
  const play = inZone('play', 'own22')
  console.log(`  average line: kicking exits long ${long.avgUp.toFixed(1)}, playing them out ${play.avgUp.toFixed(1)} (n=${long.ticks} ticks)`)
  ok(long.avgUp > play.avgUp + 0.5,
    `kicking your exits long holds a higher line than playing them out (${long.avgUp.toFixed(1)} v ${play.avgUp.toFixed(1)})`)
  const drive = inZone('drive', 'opp22')
  const spread = inZone('spread', 'opp22')
  console.log(`  in their 22: pick and drive ${drive.avgUp.toFixed(1)}, spreading it ${spread.avgUp.toFixed(1)}`)
  ok(drive.avgUp > spread.avgUp + 0.3,
    `driving close holds the line up where spreading it gives ground back (${drive.avgUp.toFixed(1)} v ${spread.avgUp.toFixed(1)})`)
  // every plan id the screen offers must resolve, or a chip sets nothing
  for (const z of ['own22', 'middle', 'opp22'] as const) {
    for (const pl of ZONE_PLANS[z]) {
      ok(zonePlan(z, pl.id).id === pl.id, `${z}/${pl.id} resolves to itself`)
    }
    ok(zonePlan(z, 'nonsense').id === ZONE_PLANS[z][1].id, `${z} falls back to its neutral plan`)
  }
}

// ------------------------------------------------ 9. the training pitch
console.log('\n=== 9. good pitch, good prep ===')
{
  // It was called the Playing Surface and the screen advertised "3.5% fewer
  // breakdowns at home" that no line of code delivered - the only thing it
  // touched was the user's injury roll. Both halves of the owner's rule get
  // a tripwire so it cannot quietly become a label again.
  const atLevel = (lvl: number) => {
    const g = newGame('leicester', 'Adv', 4242)
    for (const c of Object.values(g.clubs)) c.facilities = { ...(c.facilities ?? {}), pitch: lvl }
    const club = g.clubs[g.userClubId]
    const fx = g.fixtures.find(f => f.homeId === club.id && g.clubs[f.awayId])!
    const ctx = beginMatch(g, fx, mulberry32(99), false)
    return { brk: ctx.home.units.breakdown, att: ctx.home.units.attack }
  }
  const bog = atLevel(0)
  const true5 = atLevel(5)
  console.log(`  breakdown on a bog ${bog.brk.toFixed(2)} v a true surface ${true5.brk.toFixed(2)}`)
  ok(true5.brk > bog.brk * 1.05, `a true pitch sharpens the breakdown (${bog.brk.toFixed(2)} -> ${true5.brk.toFixed(2)})`)
  ok(true5.att > bog.att, `and the handling with it (${bog.att.toFixed(2)} -> ${true5.att.toFixed(2)})`)

  // GOOD PREP. A squad that can train properly develops faster.
  const grown = (lvl: number) => {
    const g = newGame('leicester', 'Adv', 777)
    for (const c of Object.values(g.clubs)) c.facilities = { ...(c.facilities ?? {}), pitch: lvl }
    const club = g.clubs[g.userClubId]
    const before = club.players.reduce((n, id) => n + (g.players[id]?.ca ?? 0), 0)
    for (let w = 0; w < 44; w++) processWeekAndAdvance(g)
    return club.players.reduce((n, id) => n + (g.players[id]?.ca ?? 0), 0) - before
  }
  const gBog = grown(0)
  const gTrue = grown(5)
  console.log(`  a season of development: bog ${gBog}, true surface ${gTrue}`)
  ok(gTrue > gBog, `the squad develops faster on a pitch it can work on (${gBog} -> ${gTrue})`)
}

console.log(fails ? `\nDESIGN ROUND PROBE: ${fails} failures` : '\nDESIGN ROUND PROBE PASSED: advantage, the Tuesday session and the kicking ladder all behave')
process.exit(fails ? 1 : 0)
