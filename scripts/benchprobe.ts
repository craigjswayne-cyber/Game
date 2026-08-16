// The bench economy has to be a decision, not a tax (F4).
//
// Four properties the design rests on, and two of them were wrong first time:
//
//   The DEFAULT is exactly neutral. 5-3 is what most sides pick, so if it moves
//   anything at all it moves the whole world.
//
//   The alternatives are MIRROR IMAGES. 6-2 buys set piece and defence and pays
//   in attacking shape; 4-4 the reverse. Across a world picking both, the mean
//   does not drift.
//
//   The world actually picks them. The first cut read the split off tactic.style,
//   which sounded right and did nothing: all 101 AI clubs sit on style 50 and
//   nothing moves it, so every club chose 5-3 and the mechanic existed only for
//   the user. A dial the world never turns is a dial you cannot balance.
//
//   The cover charge is neutral in AGGREGATE. Charging attack 0.92 and defence
//   0.96 looks even-handed and is not: attack carries weight 0.55 in the
//   attacking ratio and defence carries 0.7 in the defending one, so that pairing
//   quietly cost the world 0.4 points a game. Neutrality needs
//   0.55 * attackLoss == 0.7 * defenceLoss.
import { newGame } from '../src/game/newgame'
import { beginMatch, makeSubstitution, stepTick } from '../src/game/matchEngine'
import { weekRng } from '../src/game/season'
import {
  BRIEFS, SPLITS, SPLIT_BY_ID, benchSeats, isForward, refillBench, seatsFor, splitFor,
} from '../src/game/bench'

let fails = 0
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? '  ok' : 'FAIL'} ${what}`)
  if (!cond) fails++
}

const g = newGame('northampton', 'Bench', 9)
const club = g.clubs[g.userClubId]

// ---- the orthodox bench costs and gives nothing ---------------------------
{
  const d = SPLIT_BY_ID['5-3']
  ok(d.scrum === 1 && d.breakdown === 1 && d.defence === 1 && d.attack === 1,
    'five and three is exactly neutral on every dial')
}

// ---- the two arguments are mirror images ----------------------------------
{
  const a = SPLIT_BY_ID['6-2']
  const b = SPLIT_BY_ID['4-4']
  for (const k of ['scrum', 'breakdown', 'defence', 'attack'] as const) {
    const da = a[k] - 1
    const db = b[k] - 1
    ok(Math.sign(da) !== Math.sign(db) && Math.abs(Math.abs(da) - Math.abs(db)) < 0.02,
      `${k}: 6-2 ${da >= 0 ? '+' : ''}${(da * 100).toFixed(1)}% mirrors 4-4 ${db >= 0 ? '+' : ''}${(db * 100).toFixed(1)}%`)
  }
  // and the net effect on the attacking ratio is small in both directions, so
  // the split changes the shape of the last quarter rather than its scoreline
  const attDelta = (s: typeof a) =>
    0.55 * (s.attack - 1) + 0.25 * (s.breakdown - 1) + 0.10 * (s.scrum - 1)
  console.log(`  attacking-ratio shift: 6-2 ${(attDelta(a) * 100).toFixed(2)}%, 4-4 ${(attDelta(b) * 100).toFixed(2)}%`)
  ok(Math.abs(attDelta(a) + attDelta(b)) < 0.004, 'the two shifts cancel to within 0.4%')
}

// ---- every split names eight men, with a legal front row ------------------
for (const sp of SPLITS) {
  const seats = seatsFor(sp.id)
  ok(seats.length === 8, `${sp.name}: eight seats`)
  const fw = seats.filter(s => isForward(s.pos[0])).length
  ok(`${fw}-${8 - fw}` === sp.id, `${sp.name}: the shape matches its name (${fw}-${8 - fw})`)
  // Law 3 still has to be satisfiable from any bench
  const canHook = seats.some(s => s.pos.includes('HK'))
  const canLoose = seats.some(s => s.pos.includes('LP'))
  const canTight = seats.some(s => s.pos.includes('TP'))
  ok(canHook && canLoose && canTight, `${sp.name}: front-row cover at all three positions`)
  const hasSH = seats.some(s => s.pos.includes('SH'))
  const hasFH = seats.some(s => s.pos.includes('FH'))
  ok(hasSH && hasFH, `${sp.name}: a scrum-half and a ten on the bench`)
}

// ---- the world genuinely picks all three ----------------------------------
{
  const tally: Record<string, number> = {}
  for (const c of Object.values(g.clubs)) {
    const s = splitFor(c)
    tally[s] = (tally[s] ?? 0) + 1
  }
  console.log('  world adoption:', JSON.stringify(tally))
  ok(Object.keys(tally).length === 3, 'all three splits exist somewhere in the world')
  const n = Object.values(g.clubs).length
  ok((tally['5-3'] ?? 0) / n > 0.5, 'most of the world stays orthodox')
  ok((tally['6-2'] ?? 0) / n > 0.08 && (tally['4-4'] ?? 0) / n > 0.05,
    'both alternatives are common enough to measure')
}

// ---- choosing a split re-seats the bench ----------------------------------
{
  club.tactic.bench = '6-2'
  refillBench(g, club)
  const seats = benchSeats(club)
  const fwSeated = seats.filter((s, i) => {
    const id = club.tactic.lineup[15 + i]
    const p = id != null ? g.players[id] : null
    return p && isForward(p.pos)
  }).length
  console.log(`  after choosing 6-2: ${fwSeated} forwards actually seated`)
  ok(fwSeated >= 5, 'a six-two bench is filled with forwards, not relabelled')
  const ids = club.tactic.lineup.filter(x => x != null)
  ok(new Set(ids).size === ids.length, 'nobody is named twice after a re-seat')
  ok(club.tactic.lineup.slice(0, 15).every(x => x != null), 'the XV is left exactly as it was')

  club.tactic.bench = '4-4'
  refillBench(g, club)
  const bkSeated = benchSeats(club).filter((s, i) => {
    const id = club.tactic.lineup[15 + i]
    const p = id != null ? g.players[id] : null
    return p && !isForward(p.pos)
  }).length
  console.log(`  after choosing 4-4: ${bkSeated} backs actually seated`)
  ok(bkSeated >= 3, 'a four-four bench is filled with backs')
}

// ---- the split only pays once the bench is on -----------------------------
{
  const measure = (emptyBench: boolean, split: '6-2' | '5-3' = '6-2') => {
    const gg = newGame('northampton', 'Bench', 9)
    const c = gg.clubs[gg.userClubId]
    c.tactic.bench = split
    refillBench(gg, c)
    const fx = gg.fixtures.find(f => gg.clubs[f.homeId] && gg.clubs[f.awayId] && f.homeId === c.id)!
    const ctx = beginMatch(gg, fx, weekRng(gg), false, c.id)
    const mine = ctx.home.teamId === c.id ? ctx.home : ctx.away
    // mods is no longer a bench-only ledger: since audit 16D the referee's
    // dials (and any uncontested-scrum levelling) are layered into it at
    // kick-off so they survive substitutions. Measure the bench's own
    // contribution as a DELTA against the kick-off baseline.
    const base = mine.mods.scrum
    // run to the hour, then either empty the bench or leave it sitting
    while (ctx.tick < 15) { ctx.awaiting = null; stepTick(gg, ctx) }
    if (emptyBench) {
      let made = 0
      for (let slot = 0; slot < 15 && made < 3; slot++) {
        const outId = mine.lineup[slot]
        if (outId == null || !mine.onPitch.has(outId)) continue
        const inId = mine.lineup.slice(15).find(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id))
        if (inId == null) break
        if (makeSubstitution(gg, ctx, outId, inId).startsWith('That') === false) made++
      }
    }
    while (ctx.tick < 17) { ctx.awaiting = null; stepTick(gg, ctx) }
    // How many of the bench are ACTUALLY on, which is the quantity the payout is
    // proportional to - and not the same thing as how many this probe chose to
    // send on.
    const on = [...mine.onPitch].filter(id => mine.benchIds.has(id)).length
    return { mult: mine.mods.scrum / base, on }
  }
  const sitting = measure(false)
  const emptied = measure(true)
  // "SITTING" MEANT "I MADE NO SUBSTITUTIONS", WHICH IS NOT THE SAME THING.
  //
  // This asserted the 6-2's multiplier was exactly 1 whenever the probe sent
  // nobody on. It read 1.013 as soon as a card-rate change altered this seed, and
  // the reason is in applyFinishers: the payout is proportional to how many of
  // the bench are ON THE FIELD, however they got there. An injury in the first
  // fifteen ticks puts a replacement on, and a third of the bomb squad on the
  // field earns a third of the bonus. That is the design working exactly as its
  // own comment describes, and the probe was calling it a bug.
  //
  // So the assertion is now the rule itself - the multiplier matches the number
  // of bench men actually on - which holds whether they were sent on by the
  // manager, by an injury, or not at all.
  const expected = (on: number) => {
    const def = SPLIT_BY_ID['6-2']
    const k = Math.min(1, on / 3)
    return k <= 0 ? 1 : 1 + (def.scrum - 1) * k
  }
  console.log(`  6-2 scrum multiplier: ${sitting.on} of the bench on -> ${sitting.mult.toFixed(3)} (rule says ${expected(sitting.on).toFixed(3)}), ` +
    `emptied ${emptied.on} on -> ${emptied.mult.toFixed(3)} (rule says ${expected(emptied.on).toFixed(3)})`)
  ok(Math.abs(sitting.mult - expected(sitting.on)) < 0.002,
    `the bomb squad pays exactly in proportion to how much of it is on the field (${sitting.on} on)`)
  ok(emptied.on > sitting.on && emptied.mult > sitting.mult,
    'and emptying the bench pays more than leaving it alone')
  ok(emptied.mult > 1.02, 'a bomb squad that is used shows up in the scrum')
}

// ---- briefs: every one is a trade, none is free ---------------------------
{
  const gg = newGame('northampton', 'Bench', 11)
  const c = gg.clubs[gg.userClubId]
  for (const b of BRIEFS) {
    c.tactic.briefs = new Array(8).fill(b.id)
    const fx = gg.fixtures.find(f => gg.clubs[f.homeId] && gg.clubs[f.awayId] && f.homeId === c.id)!
    const ctx = beginMatch(gg, fx, weekRng(gg), false, c.id)
    const mine = ctx.home.teamId === c.id ? ctx.home : ctx.away
    // same baseline discipline as above: the referee lives in mods now,
    // so the briefs are judged by what they ADD to the kick-off state
    const base = { ...mine.mods }
    while (ctx.tick < 12) { ctx.awaiting = null; stepTick(gg, ctx) }
    let made = 0
    for (let slot = 0; slot < 15 && made < 5; slot++) {
      const outId = mine.lineup[slot]
      if (outId == null || !mine.onPitch.has(outId)) continue
      const inId = mine.lineup.slice(15).find(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id))
      if (inId == null) break
      makeSubstitution(gg, ctx, outId, inId)
      made++
    }
    const m = mine.mods
    const rel = (k: keyof typeof m) => m[k] / base[k]
    const up = (['scrum', 'breakdown', 'attack', 'defence', 'kicking'] as const).filter(k => rel(k) > 1.0005)
    const down = (['scrum', 'breakdown', 'attack', 'defence', 'kicking'] as const).filter(k => rel(k) < 0.9995)
    console.log(`  ${b.name}: up [${up.join(',')}] down [${down.join(',')}] tempo ${rel('tempo').toFixed(3)}`)
    if (b.id === 'orders') {
      ok(up.length === 0 && down.length === 0 && rel('tempo') === 1, 'following the shirt is exactly neutral')
    } else {
      ok(up.length > 0, `${b.name} does something`)
      ok(down.length > 0 || rel('tempo') !== 1, `${b.name} costs something`)
      // Capped: eight men cannot stack eight instructions. Three briefs at 3%
      // is the ceiling, which lands at 9.3% on the compounding kicking dial -
      // in the same range as the kicking slider's own 10%, and reached only by
      // giving three separate replacements the same job.
      const biggest = Math.max(...(['attack', 'defence', 'kicking'] as const).map(k => Math.abs(rel(k) - 1)))
      ok(biggest < 0.10, `${b.name} is capped at ${(biggest * 100).toFixed(1)}% however many come on`)
    }
  }
}

// ---- a brief survives the next substitution ------------------------------
{
  // recomputeSideUnits rebuilds units from the lineup, which used to wipe
  // anything the match had layered on. The mods bundle exists for this.
  const gg = newGame('northampton', 'Bench', 13)
  const c = gg.clubs[gg.userClubId]
  c.tactic.briefs = ['impact', null, null, null, null, null, null, null]
  const fx = gg.fixtures.find(f => gg.clubs[f.homeId] && gg.clubs[f.awayId] && f.homeId === c.id)!
  const ctx = beginMatch(gg, fx, weekRng(gg), false, c.id)
  const mine = ctx.home.teamId === c.id ? ctx.home : ctx.away
  const baseAtk = mine.mods.attack // the referee lives in mods since audit 16D
  while (ctx.tick < 12) { ctx.awaiting = null; stepTick(gg, ctx) }
  const seat0 = mine.lineup[15]!
  const hooker = mine.lineup[1]!
  makeSubstitution(gg, ctx, hooker, seat0)
  const afterFirst = mine.units.attack
  // any second change at all must not erase the first man's instruction
  const other = mine.lineup.slice(15).find(id => id != null && !mine.onPitch.has(id) && !mine.ratings.has(id))
  if (other != null) {
    const someone = mine.lineup.slice(0, 15).find(id => id != null && mine.onPitch.has(id))!
    makeSubstitution(gg, ctx, someone, other)
  }
  console.log(`  impact brief: mods.attack ${(mine.mods.attack / baseAtk).toFixed(4)} of baseline after two changes`)
  ok(mine.mods.attack / baseAtk > 1.02, 'the brief given to the 16 shirt survives the next substitution')
  ok(afterFirst > 0, 'units stayed sane through the change')
}

console.log(fails ? `BENCH PROBE FAILED (${fails})` : 'BENCH PROBE PASSED')
process.exit(fails ? 1 : 0)
