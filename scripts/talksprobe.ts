// Probe: the negotiating table for commercial deals (1.8.0) and the sleeve.
//
// Owner: "Commercial deals should be gambles and risky, shirt sleeve sponsor
// should be a smaller deal. Deals should be negotiation with a challenge for
// the manager." A gamble is only fair if its odds are what they claim to be,
// and the economy is calibrated (econprobe holds a club "solvent by playing,
// and not richer than the world"), so this measures rather than eyeballs:
//
//   1. THE SLOTS: four shares still sum to exactly one, the sleeve is the
//      smallest, and a fully-sold club at market still earns the old formula.
//   2. THE WIRING: a talk opens, a push moves the fee or loses the sponsor, a
//      structure change is a move and never a walk-out, a handshake signs a deal
//      with the right terms, a walked sponsor cannot be reopened, the rolls are
//      the same on a copy of the save (no save-scumming), and last season's
//      talks do not survive the summer.
//   3. THE BONUSES PAY FROM THE SEASON: a real season is played with a bold deal
//      signed in week one; its bonuses are paid at the rollover, into the bank,
//      booked on the balance sheet, with a letter.
//   4. THE ODDS OF THE BONUS LINES are measured on every club in every league
//      over several simulated seasons, and the average payout multiple must sit
//      near 1 (the shortfall is paid back on an average season).
//   5. THE MONEY: thousands of negotiations per strategy, using the measured
//      bonus outcomes. A sensible manager must land close to what the same
//      manager earned before the table existed (take the best flat offer); the
//      bold must spread wide both ways; nobody may beat the market by a mile
//      on average, or it is a printer.
//   6. OLD SAVES: a save written before the sleeve loads with a sleeve slot open
//      and not one pound added to or taken from its commercial income.
//
// Run: npx vite-node scripts/talksprobe.ts [seasons=3]
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { sortTable } from '../src/game/schedule'
import { LEDGER_WEEKS, fmtMoney, type GameState } from '../src/game/model'
import {
  CARETAKER_RATE, SLOTS, commercialWeekly, marketRate, offersFor, seedDeals, type SlotId,
} from '../src/game/commercial'
import {
  BONUS_WEIGHTS, MAX_MOVES, STRUCTURES, acceptTalk, breakOff, moodOf, openTalk, pushTalk,
  respond, restructure, stretchTarget, talksOf, walkChance, type Structure, type Talk,
} from '../src/game/sponsortalks'
import { sheetOf } from '../src/game/books'

const SEASONS = Number(process.argv[2] ?? 3)
let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }
const pct = (x: number) => `${(x * 100).toFixed(1)}%`

// ---- 1. the slots -------------------------------------------------------
{
  const sum = SLOTS.reduce((s, x) => s + x.share, 0)
  console.log(`slots: ${SLOTS.map(s => `${s.id} ${pct(s.share)}`).join(', ')}`)
  ok(Math.abs(sum - 1) < 1e-9, `the four shares sum to ${pct(sum)}`)
  const sleeve = SLOTS.find(s => s.id === 'sleeve')!
  ok(SLOTS.every(s => s.id === 'sleeve' || s.share >= sleeve.share * 2.5), 'the sleeve is clearly the smallest deal (under 40% of any other slot)')
  let worst = 0
  for (let rep = 40; rep <= 95; rep++) {
    worst = Math.max(worst, Math.abs(SLOTS.reduce((s, x) => s + marketRate(rep, x.id), 0) - rep * 1800))
  }
  ok(worst <= 3, `a fully-sold club at market earns the old formula (worst gap ${fmtMoney(worst)} a week)`)
  const g = newGame('northampton', 'Talks', 4242)
  ok(SLOTS.every(s => !!g.deals?.[s.id]), 'a new career inherits all four slots sold')
}

// ---- 2. the wiring ------------------------------------------------------
const freeSlot = (g: GameState, slot: SlotId) => { g.deals![slot]!.until = g.season - 1 }
{
  // a seed where the first push lands, so the handshake path is exercised; the
  // walk-out path is exercised below and by the thousands in section 5
  let g = newGame('leicester', 'Talks', 5150)
  for (let seed = 5150; seed < 5200; seed++) {
    const h = newGame('leicester', 'Talks', seed)
    freeSlot(h, 'shirt')
    openTalk(h, 'shirt', 1)
    const probe = JSON.parse(JSON.stringify(h)) as GameState
    pushTalk(probe, 'shirt', 'ask')
    if (talksOf(probe).open.shirt) { g = newGame('leicester', 'Talks', seed); break }
  }
  freeSlot(g, 'shirt')
  const offers = offersFor(g, 'shirt')
  console.log(`  opens: ${openTalk(g, 'shirt', 1)}`)
  const talk = talksOf(g).open.shirt!
  ok(!!talk && talk.sponsor === offers[1].sponsor && talk.fee === offers[1].weekly, 'a talk opens on the sponsor\'s own opening offer')
  openTalk(g, 'shirt', 0)
  ok(talksOf(g).open.shirt?.sponsor === offers[1].sponsor, 'only one talk per slot: a second sponsor waits')
  // determinism: the same push on a copy meets the same answer
  const copy = JSON.parse(JSON.stringify(g)) as GameState
  const a = pushTalk(g, 'shirt', 'ask')
  const b = pushTalk(copy, 'shirt', 'ask')
  ok(a === b && JSON.stringify(g.talks) === JSON.stringify(copy.talks), 'the same push on a copy of the save gets the same answer (no save-scumming)')
  console.log(`  push : ${a}`)
  const after = talksOf(g).open.shirt
  if (after) {
    ok(after.fee > talk.opening || after.fee === talk.fee, 'a push that is not a walk-out never lowers the fee')
    const moves = after.moves
    const heat = after.heat
    restructure(g, 'shirt', 'bold')
    const t2 = talksOf(g).open.shirt!
    ok(!!t2 && t2.structure === 'bold' && t2.moves === moves + 1 && t2.heat > heat, 'a structure change costs a move and never the sponsor')
    const fee = t2.fee
    console.log(`  shake: ${acceptTalk(g, 'shirt')}`)
    const d = g.deals!.shirt!
    ok(!!d.perf && d.perf.structure === 'bold', 'the signed deal carries its performance terms')
    ok(Math.abs(d.weekly - fee * STRUCTURES.bold.guaranteed) <= 1, `only the guaranteed part is paid weekly (${fmtMoney(d.weekly)} of ${fmtMoney(fee)})`)
    ok(d.clause === 'none', 'a performance deal carries no old-style clause as well')
    ok(!talksOf(g).open.shirt, 'the talk closes on a handshake')
    ok(g.news.some(n => n.k === 'news.sponsorSignedPerf'), 'signing makes the news')
  } else {
    ok(talksOf(g).gone.shirt?.includes(talk.sponsor) ?? false, 'a walked sponsor is recorded as gone')
  }
  // break off and walk-outs cannot be reopened
  freeSlot(g, 'kit')
  const kitOffers = offersFor(g, 'kit')
  openTalk(g, 'kit', 0)
  breakOff(g, 'kit')
  ok(!talksOf(g).open.kit, 'breaking off closes the talk')
  const again = openTalk(g, 'kit', 0)
  ok(!talksOf(g).open.kit, `a sponsor walked out on cannot be reopened this season ("${again}")`)
  openTalk(g, 'kit', 1)
  const t3 = talksOf(g).open.kit
  ok(!!t3 && t3.opening < kitOffers[1].weekly, 'the market hears: after a walk-out the next sponsor opens lower')
  // a final offer
  if (t3) {
    for (let i = 0; i < MAX_MOVES && talksOf(g).open.kit; i++) restructure(g, 'kit', i % 2 ? 'flat' : 'mixed')
    const t4 = talksOf(g).open.kit
    ok(!!t4 && t4.moves === MAX_MOVES && /final/i.test(pushTalk(g, 'kit', 'ask')), 'after four moves the offer is final')
  }
  // a sold slot cannot be negotiated
  const g2 = newGame('bath', 'Talks', 77)
  openTalk(g2, 'naming', 0)
  ok(!talksOf(g2).open.naming, 'a slot under a real contract cannot be negotiated')
  // the season moves on
  g.season += 1
  ok(!talksOf(g).open.kit && !(talksOf(g).gone.kit?.length), 'last season\'s talks and walk-outs do not survive the summer')
}

// ---- 3 + 4. real seasons: the bonus odds, and a real payout --------------
type Out = { league: boolean; title: boolean; final: boolean; tries: boolean; R: number }
const outcomes: Out[] = []
/** each league club's stature rank within its league, taken at a season's start */
const rankWorld = (g: GameState, ranks: Map<string, number>) => {
  ranks.clear()
  for (const c of Object.values(g.comps)) {
    if (c.type !== 'league') continue
    c.teamIds.filter(id => g.clubs[id]).sort((a, b) => g.clubs[b].rep - g.clubs[a].rep)
      .forEach((id, i) => ranks.set(`${c.id}|${id}`, i + 1))
  }
}
/** every league club's bonus lines as the table stands now */
const snapWorld = (g: GameState, ranks: Map<string, number>): Out[] => {
  const snap: Out[] = []
  for (const c of Object.values(g.comps)) {
    if (c.type !== 'league' || !c.table.length) continue
    const ord = sortTable(c.table).map(r => r.teamId)
    const tr = [...c.table].sort((a, b) => b.tf - a.tf || b.pf - a.pf).map(r => r.teamId)
    for (const id of ord) {
      const R = ranks.get(`${c.id}|${id}`)
      if (!R || !g.clubs[id]) continue
      const T = stretchTarget(R)
      snap.push({
        R, league: ord.indexOf(id) + 1 <= T, title: ord[0] === id || c.champion === id,
        final: g.fixtures.some(f => f.stage === 'F' && (f.homeId === id || f.awayId === id)),
        tries: tr.indexOf(id) + 1 <= T,
      })
    }
  }
  return snap
}
let paidSeen = 0, bookedSeen = 0, letterSeen = 0, seasonsWithBold = 0
{
  const g = newGame('northampton', 'Talks', 99)
  // a bold shirt deal signed in week one, pushed once
  freeSlot(g, 'shirt')
  openTalk(g, 'shirt', 0)
  restructure(g, 'shirt', 'bold')
  acceptTalk(g, 'shirt')
  const bold = g.deals!.shirt!
  ok(!!bold.perf, `the probe's own bold deal signed (${bold.sponsor}, target ${bold.perf?.target ?? '-'})`)
  const ranks = new Map<string, number>()
  const takeRanks = () => rankWorld(g, ranks)
  takeRanks()
  for (let s = 0; s < SEASONS; s++) {
    let snap: Out[] = []
    while (g.season === s) {
      if (g.week >= 40) snap = snapWorld(g, ranks)
      // the harness keeps the board sweet: this probe is about the sponsor's
      // cheque, and a sacking in season two would end the measurement
      g.clubs[g.userClubId].boardConfidence = 100
      const fx = userFixtureThisWeek(g)
      if (fx) simMatch(g, fx, weekRng(g), true)
      processWeekAndAdvance(g)
    }
    outcomes.push(...snap)
    takeRanks()
    if (g.deals?.shirt?.perf && g.deals.shirt.sponsor === bold.sponsor && bold.until >= s) {
      seasonsWithBold++
      const letter = g.news.find(n => (n.k === 'news.sponsorBonus' || n.k === 'news.sponsorBonusNone') && n.season === s)
      if (letter) letterSeen++
      const prev = g.booksPrev
      const booked = prev?.lines.bonus ?? 0
      if (letter?.k === 'news.sponsorBonus') { paidSeen++; if (booked > 0) bookedSeen++ }
      console.log(`  season ${s + 1}: ${letter ? (letter.k === 'news.sponsorBonus' ? `bonus paid ${letter.v?.amount} (${letter.v?.met} of ${letter.v?.n} targets)` : 'no targets met, nothing paid') : 'NO LETTER'}; booked ${fmtMoney(booked)}`)
    }
    // the season's books meet: opening + lines = closing
    const sh = sheetOf(g, 'prev')
    if (sh) ok(Math.abs(sh.opening + sh.totalIn - sh.totalOut - sh.closing) <= 1, `season ${s + 1} balance sheet adds up (${fmtMoney(sh.opening)} + ${fmtMoney(sh.totalIn)} - ${fmtMoney(sh.totalOut)} = ${fmtMoney(sh.closing)})`)
  }
  ok(seasonsWithBold > 0 && letterSeen === seasonsWithBold, `every season of the bold deal ended with a bonus letter (${letterSeen}/${seasonsWithBold})`)
  ok(bookedSeen === paidSeen, `every bonus paid was booked on the balance sheet (${bookedSeen}/${paidSeen})`)
}
// TWO MORE WORLDS FOR THE ODDS (28 Sep 2026). One world's three seasons
// give 54 club-seasons at stature rank 1-2, and that bucket's mean multiple
// read 0.90, 0.79, 0.97 and 0.83 on four shifted seed lists against a floor
// of 0.7: a standard error of about 0.08, so the floor stood under two of
// them. The odds are a property of the world's tables, not of the probe's
// bold deal, so two more worlds (board held, nothing signed) are walked for
// their tables alone: three times the club-seasons (162 at rank 1-2), a
// standard error near 0.045 and the same band, now over three of them away.
// Five worlds read 0.96 on the top bucket; each extra world costs about 20 s.
for (const seed of [101, 202]) {
  const g = newGame('northampton', 'Talks', seed)
  const ranks = new Map<string, number>()
  rankWorld(g, ranks)
  for (let s = 0; s < SEASONS; s++) {
    let snap: Out[] = []
    while (g.season === s) {
      if (g.week >= 40) snap = snapWorld(g, ranks)
      g.clubs[g.userClubId].boardConfidence = 100
      processWeekAndAdvance(g)
    }
    outcomes.push(...snap)
    rankWorld(g, ranks)
  }
}

const W = BONUS_WEIGHTS
const multiples = outcomes.map(o => (o.league ? W.league : 0) + (o.title ? W.title : 0) + (o.final ? W.final : 0) + (o.tries ? W.tries : 0))
const meanM = multiples.reduce((a, b) => a + b, 0) / Math.max(1, multiples.length)
{
  const rate = (k: keyof Out) => pct(outcomes.filter(o => o[k]).length / Math.max(1, outcomes.length))
  console.log(`bonus lines over ${outcomes.length} club-seasons: league target ${rate('league')}, top of table ${rate('title')}, a final ${rate('final')}, tries target ${rate('tries')}`)
  console.log(`payout multiple of the shortfall: mean ${meanM.toFixed(2)}, nothing paid in ${pct(multiples.filter(m => m === 0).length / multiples.length)} of seasons, best ${Math.max(...multiples).toFixed(2)}`)
  for (const [lo, hi] of [[1, 2], [3, 6], [7, 20]]) {
    const sel = outcomes.map((o, i) => [o, multiples[i]] as const).filter(([o]) => o.R >= lo && o.R <= hi)
    const m = sel.reduce((a, [, x]) => a + x, 0) / Math.max(1, sel.length)
    console.log(`  stature rank ${lo}-${hi}: ${sel.length} seasons, mean multiple ${m.toFixed(2)}`)
    ok(m > 0.7 && m < 1.35, `stature rank ${lo}-${hi}: a bonus deal is a fair bet for this size of club (mean ${m.toFixed(2)})`)
  }
  ok(meanM > 0.85 && meanM < 1.15, `the average season pays back the shortfall (mean multiple ${meanM.toFixed(2)})`)
}

// ---- 5. the money, by strategy -------------------------------------------
// Each trial: a fresh seed gives a fresh set of three opening offers, a
// leverage drawn across the range form produces, and dice from a seeded rng.
// Value is the season's income as a multiple of the market rate, with the
// performance part drawn from the measured outcomes above.
{
  let seed = 12345
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32 }
  type Strat = { name: string; structure: Structure; plan: (t: Talk, p: number, i: number) => 'ask' | 'demand' | 'accept' }
  const strategies: Strat[] = [
    { name: 'no talking: best opening flat', structure: 'flat', plan: () => 'accept' },
    { name: 'sensible: ask once while keen or interested', structure: 'flat', plan: (_t, p, i) => (i === 0 && p < 0.26 ? 'ask' : 'accept') },
    { name: 'pushy: ask until wary', structure: 'flat', plan: (_t, p) => (p < 0.26 ? 'ask' : 'accept') },
    { name: 'reckless: demand every move', structure: 'flat', plan: () => 'demand' },
    { name: 'mixed structure, sensible ask', structure: 'mixed', plan: (_t, p, i) => (i === 0 && p < 0.26 ? 'ask' : 'accept') },
    { name: 'bold structure, sensible ask', structure: 'bold', plan: (_t, p, i) => (i === 0 && p < 0.26 ? 'ask' : 'accept') },
    { name: 'bold structure, demand twice', structure: 'bold', plan: (_t, _p, i) => (i < 2 ? 'demand' : 'accept') },
  ]
  const base = newGame('northampton', 'Talks', 1)
  const rep = base.clubs[base.userClubId].rep
  const TRIALS = 4000
  const results: Record<string, number[]> = {}
  for (const st of strategies) results[st.name] = []
  for (let n = 0; n < TRIALS; n++) {
    base.seed = 1000 + n * 7919
    const slot: SlotId = (['shirt', 'naming', 'kit', 'sleeve'] as const)[n % 4]
    const market = marketRate(rep, slot)
    const offers = offersFor(base, slot)
    const lev = 0.98 + rng() * 0.3
    const m = multiples[Math.floor(rng() * multiples.length)] ?? 1
    const dice = Array.from({ length: 30 }, () => rng())
    for (const st of strategies) {
      let d = 0
      const byValue = [...offers].sort((a, b) => b.weekly - a.weekly)
      let value = CARETAKER_RATE   // if every sponsor walks, the stopgap
      for (let o = 0; o < byValue.length; o++) {
        const talk: Talk = {
          slot, sponsor: byValue[o].sponsor, years: 1, clause: 'none',
          opening: Math.round(byValue[o].weekly * (1 - 0.05 * o)), fee: Math.round(byValue[o].weekly * (1 - 0.05 * o)),
          structure: st.structure, pushes: 0, moves: st.structure === 'flat' ? 0 : 1, heat: st.structure === 'flat' ? 0 : 0.01,
        }
        let walked = false
        for (let i = 0; talk.moves < 4; i++) {
          const act = st.plan(talk, walkChance(talk, 'ask', market, lev), i)
          if (act === 'accept') break
          const r = respond(talk, act, market, lev, dice[d++ % 30], dice[d++ % 30])
          talk.moves++; talk.pushes++
          if (r.walked) { walked = true; break }
          talk.fee = r.fee; talk.heat += act === 'ask' ? 0.03 : 0.07
        }
        if (walked) continue
        const s = STRUCTURES[st.structure]
        value = (talk.fee * s.guaranteed + (1 - s.guaranteed) * talk.fee * s.premium * m) / market
        break
      }
      results[st.name].push(value)
    }
  }
  const stats = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    const mean = s.reduce((a, b) => a + b, 0) / s.length
    return { mean, p10: s[Math.floor(s.length * 0.1)], p90: s[Math.floor(s.length * 0.9)] }
  }
  const baseline = stats(results[strategies[0].name])
  console.log(`\nseason income from one slot as a multiple of market (${TRIALS} negotiations each; the old game's CARETAKER was ${CARETAKER_RATE}):`)
  for (const st of strategies) {
    const r = stats(results[st.name])
    console.log(`  ${st.name.padEnd(46)} mean ${r.mean.toFixed(3)}  p10 ${r.p10.toFixed(2)}  p90 ${r.p90.toFixed(2)}`)
  }
  const sens = stats(results[strategies[1].name])
  const reck = stats(results[strategies[3].name])
  const bold = stats(results[strategies[5].name])
  const boldHard = stats(results[strategies[6].name])
  ok(Math.abs(sens.mean - baseline.mean) / baseline.mean < 0.06, `a sensible manager lands within 6% of the old best-offer income (${sens.mean.toFixed(3)} vs ${baseline.mean.toFixed(3)})`)
  ok(sens.mean >= baseline.mean * 0.99, 'talking sensibly is not a loss against not talking at all')
  ok(reck.mean < sens.mean, `recklessness costs money on average (${reck.mean.toFixed(3)} vs ${sens.mean.toFixed(3)})`)
  ok(reck.p10 <= CARETAKER_RATE + 0.001, 'a reckless manager can lose every sponsor on the table')
  ok(bold.p90 - bold.p10 > (sens.p90 - sens.p10) * 3, `the bold structure is a real gamble: spread ${(bold.p90 - bold.p10).toFixed(2)} against ${(sens.p90 - sens.p10).toFixed(2)} for the flat fee`)
  ok(bold.mean > 0.9 && bold.mean < 1.25, `the bold structure pays near market on average (${bold.mean.toFixed(3)})`)
  ok(boldHard.p90 > 1.6, `a bold deal pushed hard pays big in a good season (p90 ${boldHard.p90.toFixed(2)}x market)`)
  const allMeans = strategies.map(s => stats(results[s.name]).mean)
  ok(Math.max(...allMeans) < 1.3, `no strategy is a printer (best mean ${Math.max(...allMeans).toFixed(3)}x market)`)
  // the moods cover the range, so the manager's reading is information
  const moods = new Set<string>()
  for (let f = 0.8; f <= 1.6; f += 0.05) moods.add(moodOf(walkChance({ fee: f * 1000, pushes: 0, heat: 0, structure: 'flat' }, 'ask', 1000, 1.08)))
  ok(moods.size === 4, `the sponsor's mood reads four different ways across a negotiation (${[...moods].join(', ')})`)
}

// ---- 6. old saves -------------------------------------------------------
{
  const g = newGame('leicester', 'Talks', 1234)
  const old = JSON.parse(JSON.stringify(g)) as GameState
  // as a 1.7 build wrote it: three slots, the shirt at the old 46% share
  delete old.deals!.sleeve
  old.deals!.shirt!.weekly = Math.round(old.clubs[old.userClubId].rep * 1800 * 0.46)
  old.deals!.kit!.weekly = Math.round(old.clubs[old.userClubId].rep * 1800 * 0.30)
  delete (old as { talks?: unknown }).talks
  delete (old as { books?: unknown }).books
  const before = commercialWeekly(old)
  const loaded = migrate(JSON.parse(JSON.stringify(old)))
  const after = commercialWeekly(loaded)
  ok(!!loaded.deals?.sleeve, 'an old save loads with a sleeve slot')
  ok((loaded.deals?.sleeve?.until ?? 99) < loaded.season, 'the sleeve arrives open to offers, not pre-sold')
  ok(before === after, `an old save's commercial income is unchanged by the sleeve (${fmtMoney(before)} -> ${fmtMoney(after)})`)
  ok(!!offersFor(loaded, 'sleeve').length, 'the old save has sleeve offers to negotiate')
  const twice = migrate(JSON.parse(JSON.stringify(loaded)))
  ok(JSON.stringify(twice.deals) === JSON.stringify(loaded.deals), 'loading twice changes nothing')
  const fresh = { ...g, deals: undefined } as GameState
  seedDeals(fresh)
  ok(SLOTS.every(s => !!fresh.deals?.[s.id]), 'seedDeals still sells every slot for a world that never had any')
  // the week-one sheet of an old save opens on its current balance
  const sh = sheetOf(loaded)
  ok(!!sh && sh.opening === loaded.clubs[loaded.userClubId].balance && sh.totalIn === 0 && sh.totalOut === 0, 'an old save opens an empty balance sheet on its current balance')
  void LEDGER_WEEKS
}

if (fails) { console.error(`\nTALKS PROBE: ${fails} failures`); process.exit(1) }
console.log('\nTALKS PROBE PASSED')
