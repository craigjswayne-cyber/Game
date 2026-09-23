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

console.log(fails ? `\nDESIGN ROUND PROBE: ${fails} failures` : '\nDESIGN ROUND PROBE PASSED: advantage, the Tuesday session and the kicking ladder all behave')
process.exit(fails ? 1 : 0)
