// Probe: F30 commercial deals and F31 hospitality.
//
// The claim these two rest on: splitting sponsorship into three signable slots
// does not change what a club earns. The economy is calibrated - econprobe holds
// a club to "solvent by playing, and not richer than the world" - and that was
// struck against a flat `rep * 1800 + 40_000`. If the three shares do not sum to
// exactly the old number, every career in the game is quietly richer or poorer
// than the balance sheet it was tuned against.
//
// So this checks the arithmetic AND the wiring: that a fully-sold club at market
// rate takes home what the formula paid, that an empty slot really costs money,
// that a clause can beat the market but only within a bound, and that a save
// written before any of this existed does not load into an empty department.
import { newGame } from '../src/game/newgame'
import { migrate } from '../src/game/save'
import { fmtMoney, weeklyCentral, operatingCost, type GameState } from '../src/game/model'
import {
  CARETAKER_RATE, CLAUSES, MAX_UPLIFT, SLOTS, commercialWeekly, dealWeekly,
  endDealEarly, expireDeals, marketRate, offersFor, seedDeals, signOffer,
} from '../src/game/commercial'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

// 1. the shares sum to exactly one, which is the whole neutrality claim
const shareSum = SLOTS.reduce((s, x) => s + x.share, 0)
console.log(`slot shares: ${SLOTS.map(s => `${s.id} ${(s.share * 100).toFixed(0)}%`).join(', ')} = ${(shareSum * 100).toFixed(2)}%`)
if (Math.abs(shareSum - 1) > 1e-9) bad(`the three slots share ${(shareSum * 100).toFixed(2)}% of the pot, not 100%`)

// 2. a fully-sold club at market rate earns exactly what the old flat formula
//    paid. This is checked as MONEY, over the reputation range the world holds,
//    because a rounding rule that drifts by a pound a week is 44 pounds a season
//    and would still be a real answer to "did anything change".
{
  const OLD = (rep: number) => rep * 1800 + 40_000
  let worst = 0
  for (let rep = 40; rep <= 95; rep++) {
    const sold = SLOTS.reduce((s, x) => s + marketRate(rep, x.id), 0)
    const now = sold + 40_000
    worst = Math.max(worst, Math.abs(now - OLD(rep)))
  }
  console.log(`fully sold at market vs the old formula: worst gap ${fmtMoney(worst)} a week across rep 40 to 95`)
  // Three roundings can each be half a pound out, so anything past a couple of
  // pounds is a real error rather than a rounding artefact.
  if (worst > 2) bad(`a fully-sold club is ${fmtMoney(worst)} a week away from the old formula`)
}

// 3. in a live world: the inherited department pays the old number
{
  const g = newGame('northampton', 'Deal Probe', 4242)
  const club = g.clubs[g.userClubId]
  if (!g.deals) bad('a new career started with no commercial deals at all')
  const filled = SLOTS.filter(s => g.deals?.[s.id]).length
  const paid = commercialWeekly(g) + weeklyCentral(club)
  const old = club.rep * 1800 + 40_000
  console.log(`${club.short} (rep ${club.rep}): ${filled}/3 slots inherited, commercial + central ${fmtMoney(paid)} a week`)
  console.log(`  the old flat formula would have paid ${fmtMoney(old)}`)
  if (filled !== 3) bad(`a new career should inherit all three slots sold, not ${filled}`)
  // weeklyCentral also carries the small-ground top-up, so paid can be HIGHER
  // than old for a big name in a small ground. It must never be lower.
  if (paid < old - 2) bad(`the department pays ${fmtMoney(old - paid)} a week less than the formula it replaced`)
  for (const s of SLOTS) {
    const d = g.deals?.[s.id]
    if (!d) continue
    if (d.weekly !== marketRate(club.rep, s.id)) bad(`${s.id} was inherited off market rate`)
    if (d.until < g.season) bad(`${s.id} was inherited already expired`)
  }
  // and they must not all fall due in the same summer, or the manager loses the
  // whole department at once through no decision of his own
  const ends = new Set(SLOTS.map(s => g.deals?.[s.id]?.until))
  if (ends.size < 2) bad('all three inherited deals expire in the same season')
}

// 4. an empty slot costs exactly its share, which is what makes neglect a choice
{
  const g = newGame('leicester', 'Deal Probe', 777)
  const full = commercialWeekly(g)
  const lost = marketRate(g.clubs[g.userClubId].rep, 'shirt')
  delete g.deals!.shirt
  const without = commercialWeekly(g)
  console.log(`losing the shirt sponsor: ${fmtMoney(full)} becomes ${fmtMoney(without)} (share worth ${fmtMoney(lost)})`)
  if (Math.abs((full - without) - lost) > 2) {
    bad(`an empty shirt slot cost ${fmtMoney(full - without)} rather than its ${fmtMoney(lost)} share`)
  }
  if (without >= full) bad('leaving a slot empty cost nothing')
}

// 5. the offers are a choice, not a ranking: long pays under market, short over,
//    and the clause deal is cheap until it pays out
{
  const g = newGame('northampton', 'Deal Probe', 31337)
  for (const slot of SLOTS) {
    const offers = offersFor(g, slot.id)
    if (offers.length !== 3) { bad(`${slot.id} offered ${offers.length} deals, not 3`); continue }
    const [long, short, clause] = offers
    console.log(`${slot.id}: ${long.sponsor} ${long.years}yr ${(long.vsMarket * 100).toFixed(0)}% | ${short.sponsor} ${short.years}yr ${(short.vsMarket * 100).toFixed(0)}% | ${clause.sponsor} ${clause.years}yr ${(clause.vsMarket * 100).toFixed(0)}% + ${clause.clause}`)
    if (long.vsMarket >= 1) bad(`${slot.id}: the long deal is not below market`)
    // and every offer has to beat doing nothing, or the board is a trap
    for (const o of offers) {
      const best = o.vsMarket * (1 + CLAUSES[o.clause].bonus)
      if (best <= CARETAKER_RATE) bad(`${slot.id}: ${o.sponsor} cannot beat the caretaker rate even at its best (${best.toFixed(2)}x)`)
    }
    if (short.vsMarket <= 1) bad(`${slot.id}: the short deal is not above market`)
    if (long.years <= short.years) bad(`${slot.id}: the long deal is not longer than the short one`)
    if (clause.clause === 'none') bad(`${slot.id}: the third offer carries no clause`)
    if (clause.vsMarket >= 1) bad(`${slot.id}: a clause deal should start below market`)
    // the clause has to be worth taking if you can deliver it
    const withBonus = clause.vsMarket * (1 + CLAUSES[clause.clause].bonus)
    if (withBonus <= 1) bad(`${slot.id}: the clause deal cannot beat market even when it pays (${withBonus.toFixed(2)}x)`)
  }
}

// 6. deterministic: revisiting the screen must not reroll the market
{
  const g = newGame('bath', 'Deal Probe', 909)
  const a = JSON.stringify(SLOTS.map(s => offersFor(g, s.id)))
  const b = JSON.stringify(SLOTS.map(s => offersFor(g, s.id)))
  if (a !== b) bad('the offers on the table change between two reads')
}

// 7. signing: the slot fills, the money moves, and you cannot sell it twice
{
  const g = newGame('leicester', 'Deal Probe', 5150)
  delete g.deals!.naming
  const before = commercialWeekly(g)
  const offer = offersFor(g, 'naming')[1]      // the short, above-market one
  console.log('sign   :', signOffer(g, offer))
  const after = commercialWeekly(g)
  if (after <= before) bad('signing a naming-rights deal did not raise the weekly cheque')
  if (g.deals?.naming?.sponsor !== offer.sponsor) bad('the signed sponsor is not in the slot')
  if (g.deals?.naming?.until !== g.season + offer.years - 1) bad('the term was recorded wrong')
  const refusal = signOffer(g, offersFor(g, 'naming')[0])
  if (!/already under contract/i.test(refusal)) bad(`a sold slot was sold again: ${refusal}`)
  if (commercialWeekly(g) !== after) bad('a refused signing still changed the money')
  if (!g.news.some(n => n.subject.includes(offer.sponsor))) bad('signing a sponsor made no news')
}

// 8. the ceiling bounds the CLAUSE UPLIFT and never the agreed base
//
// Both halves matter. Uncapped clause money on a rising market is a printer; but
// a cap applied to the total tears up a contract the manager signed, which is
// what the first cut did - a £100k deal paid £91k because the ceiling sat under
// it.
{
  const g = newGame('leicester', 'Deal Probe', 2020)
  const rep = g.clubs[g.userClubId].rep
  const mkt = marketRate(rep, 'shirt')
  g.mgr.trophies = [{ compId: 'prem', season: g.season }]
  // a market-rate deal with the biggest clause in the book: the uplift is bounded
  const normal = { slot: 'shirt' as const, sponsor: 'Fair Co', weekly: mkt, clause: 'silverware' as const, from: g.season, until: g.season + 3, repAt: rep }
  const paidNormal = dealWeekly(g, normal)
  const ceiling = Math.round(mkt * MAX_UPLIFT)
  console.log(`market deal + silverware clause pays ${fmtMoney(paidNormal)}, ceiling ${fmtMoney(ceiling)}`)
  if (paidNormal > ceiling) bad(`the ceiling did not hold: ${fmtMoney(paidNormal)} against ${fmtMoney(ceiling)}`)
  if (paidNormal <= mkt) bad('a clause that is paying out added nothing')
  // and a base ABOVE the ceiling is still honoured in full, because it is a
  // signed contract rather than a bonus
  const rich = { ...normal, sponsor: 'Overpay Ltd', weekly: mkt * 4, clause: 'none' as const }
  const paidRich = dealWeekly(g, rich)
  console.log(`a base of ${fmtMoney(mkt * 4)} pays ${fmtMoney(paidRich)}`)
  if (paidRich !== mkt * 4) bad(`an agreed base of ${fmtMoney(mkt * 4)} was cut to ${fmtMoney(paidRich)}`)
}

// 9. clauses do not pay before a ball is kicked
{
  const g = newGame('leicester', 'Deal Probe', 6060)
  // week 1, nothing played: an empty table must not read as "top four"
  const deal = {
    slot: 'shirt' as const, sponsor: 'Early Doors plc', weekly: 100_000,
    clause: 'top4' as const, from: g.season, until: g.season + 2, repAt: 80,
  }
  if (dealWeekly(g, deal) !== 100_000) {
    bad('a top-four clause paid out in week one, before anybody had played a game')
  }
}

// 10. expiry: a deal that has run its term goes, once, with a letter
{
  const g = newGame('northampton', 'Deal Probe', 4242)
  const kit = g.deals!.kit!
  const before = commercialWeekly(g)          // while it is still in term
  g.season = kit.until + 1
  expireDeals(g)
  const after = commercialWeekly(g)
  console.log(`kit deal expiring: ${fmtMoney(before)} becomes ${fmtMoney(after)}`)
  // The slot does NOT empty. econprobe proved that a passive manager who never
  // opens this screen would lose his whole commercial income and the club would
  // go structurally insolvent, which breaks "solvent by playing". So the
  // department takes a caretaker at a discount instead: neglect costs real money
  // every week without being a cliff.
  const care = g.deals!.kit
  if (!care) bad('an expired deal left the slot empty, which is the insolvency cliff again')
  if (care && !care.auto) bad('the replacement was not marked as a caretaker')
  if (care && care.weekly >= marketRate(g.clubs[g.userClubId].rep, 'kit')) {
    bad('the caretaker deal is not below the going rate, so neglect costs nothing')
  }
  if (after >= before) bad('an expired deal was replaced at no cost at all')
  // and a caretaker must be replaceable, or being stuck with it is the cliff in
  // slower motion
  const better = offersFor(g, 'kit')[1]
  const msg = signOffer(g, better)
  if (!/^Done/.test(msg)) bad(`a caretaker could not be replaced: ${msg}`)
  if (g.deals!.kit?.auto) bad('signing over a caretaker left it in place')
  // a REAL contract still cannot be sold twice
  const twice = signOffer(g, offersFor(g, 'kit')[0])
  if (!/already under contract/i.test(twice)) bad(`a signed contract was overwritten: ${twice}`)
  const letters = g.news.filter(n => n.subject.includes('deal expires')).length
  if (!letters) bad('a deal expired without telling the manager')
  expireDeals(g)
  if (g.news.filter(n => n.subject.includes('deal expires')).length !== letters) {
    bad('expiry wrote the same letter twice')
  }
}

// 11. a save from before the department loads with it, not without it
{
  const g = newGame('leicester', 'Deal Probe', 1234)
  const old = JSON.parse(JSON.stringify(g)) as GameState
  delete (old as { deals?: unknown }).deals              // as an older build wrote it
  const loaded = migrate(old)
  if (!loaded.deals) bad('an old save loaded with no commercial department at all')
  const filled = SLOTS.filter(s => loaded.deals?.[s.id]).length
  const paid = commercialWeekly(loaded) + weeklyCentral(loaded.clubs[loaded.userClubId])
  const oldFormula = loaded.clubs[loaded.userClubId].rep * 1800 + 40_000
  console.log(`migrated save: ${filled}/3 slots, ${fmtMoney(paid)} a week against ${fmtMoney(oldFormula)} before`)
  if (filled !== 3) bad(`a migrated save has ${filled}/3 slots sold`)
  if (paid < oldFormula - 2) bad('a migrated save lost sponsorship income on load')
  // and it must be idempotent: loading twice must not resell anything
  const again = migrate(JSON.parse(JSON.stringify(loaded)))
  if (JSON.stringify(again.deals) !== JSON.stringify(loaded.deals)) {
    bad('loading a save twice rewrote the commercial deals')
  }
}

// 12. F31: hospitality lifts the gate and charges for the privilege
{
  const g = newGame('leicester', 'Deal Probe', 8080)
  const club = g.clubs[g.userClubId]
  club.facilities = { ...club.facilities, hospitality: 0 }
  const bare = operatingCost(g)
  club.facilities.hospitality = 5
  const maxed = operatingCost(g)
  const upkeep = maxed - bare
  // 4% a level, so a maxed block is a 20% better gate
  const att = 15_000
  const extra = Math.round(att * 30 * 0.2)
  console.log(`hospitality maxed: gate on a ${att.toLocaleString()} crowd gains ${fmtMoney(extra)}, upkeep costs ${fmtMoney(upkeep)} a week`)
  if (upkeep <= 0) bad('a maxed hospitality block costs nothing to run')
  // The decision has to be able to go either way. One home game every three
  // weeks, so the weekly-equivalent income at a 15,000 crowd should sit near the
  // upkeep: worth building for a big or growing club, a loss for a small one.
  const weekly = extra / 3
  const ratio = weekly / upkeep
  console.log(`  weekly-equivalent income / upkeep at ${att.toLocaleString()}: ${ratio.toFixed(2)}x`)
  // A guard on both tails. Too high is a printer; too low and nobody should ever
  // build it, which is how the first cut came out when econprobe measured it over
  // four real seasons rather than a hand estimate.
  if (ratio > 2.5) bad(`hospitality returns ${ratio.toFixed(2)}x its upkeep at an ordinary crowd, which is a printer rather than a decision`)
  if (ratio < 1.15) bad(`hospitality returns only ${ratio.toFixed(2)}x at an ordinary crowd, so building it is close to a mistake`)
  if (ratio < 0.5) bad(`hospitality returns only ${ratio.toFixed(2)}x its upkeep, so nobody would ever build it`)
}

// 13. and nothing here throws on a world it cannot read
{
  const g = newGame('leicester', 'Deal Probe', 4321)
  const broken = JSON.parse(JSON.stringify(g)) as GameState
  broken.deals = { shirt: { slot: 'shirt', sponsor: 'X', weekly: Number.NaN, clause: 'none', from: 0, until: 99, repAt: 0 } }
  const n = commercialWeekly(broken)
  if (Number.isFinite(n) === false) {
    // A NaN here would poison club.balance for the rest of the save, exactly as a
    // NaN dial once poisoned every squad's condition.
    bad('a damaged deal produced a non-finite weekly cheque, which would poison the balance for ever')
  }
  const empty = { ...g, deals: undefined } as GameState
  if (commercialWeekly(empty) !== 0) bad('a world with no deals object did not pay zero')
  seedDeals(empty)
  if (!empty.deals) bad('seedDeals did not fill an empty department')
}

// ---- THE SPONSOR'S NAME IS ACTUALLY OVER THE GATES -------------------------
//
// (user: "the naming rights for the stadium have been sold in game - why is
// it not updating in game?"). Three properties: a fresh world's gates agree
// with its inherited naming deal; signing the slot renames the ground with
// the traditional name kept; and a second sponsor replaces the first rather
// than stacking.
{
  const g = newGame('northampton', 'Gates', 47)
  const club = g.clubs[g.userClubId]
  const live = g.deals?.naming
  if (!live) bad('a fresh world has no inherited naming deal')
  else if (club.stadium.includes(' at ') && !club.stadium.startsWith(live.sponsor)) {
    bad(`the gates say "${club.stadium}" but the deal card says ${live.sponsor}`)
  }
  const before = club.stadium
  const base = before.includes(' at ') ? before.slice(before.indexOf(' at ') + 4) : before
  // run the inherited deal out so the slot can be sold
  if (live) live.until = g.season - 1
  const offer = offersFor(g, 'naming')[0]
  signOffer(g, offer)
  if (!club.stadium.startsWith(offer.sponsor)) bad(`signed ${offer.sponsor} and the gates still say "${club.stadium}"`)
  if (!club.stadium.endsWith(base)) bad(`the traditional name was lost: "${club.stadium}" should end "${base}"`)
  // a second sponsor replaces, never stacks
  g.deals!.naming!.until = g.season - 1
  const offer2 = offersFor(g, 'naming')[1]
  signOffer(g, offer2)
  if (!club.stadium.startsWith(offer2.sponsor) || !club.stadium.endsWith(base) ||
      (club.stadium.match(/ Stadium at /g) ?? []).length > 1) {
    bad(`the second sponsor stacked instead of replacing: "${club.stadium}"`)
  }
}

// ---- the early exit and its gamble (v1.1.5) --------------------------------
{
  const g: GameState = newGame('northampton', 'Probe', 4321)
  seedDeals(g)
  const club = g.clubs[g.userClubId]
  const before = offersFor(g, 'shirt')
  const live = g.deals!.shirt!
  const msg = endDealEarly(g, 'shirt')
  if (g.deals?.shirt) bad('the ended deal is still on the books')
  if (!g.news.some(n => n.k === 'news.sponsorEnded')) bad('no letter about the early release')
  if (!msg.includes(live.sponsor)) bad(`the reply does not name the departing sponsor: "${msg}"`)
  const after = offersFor(g, 'shirt')
  if (JSON.stringify(after) === JSON.stringify(before)) bad('ending a deal dealt the same three offers - no gamble at all')
  const again = offersFor(g, 'shirt')
  if (JSON.stringify(after) !== JSON.stringify(again)) bad('revisiting the screen rerolled the offers - the gamble must be one roll per exit')
  // the rerolled band is genuinely wider than the standard one in both
  // directions across seeds: checked here on shape, not on one seed's luck
  for (const o of after) {
    if (!Number.isFinite(o.weekly) || o.weekly <= 0) bad(`a rerolled offer pays nonsense (${o.weekly})`)
  }
  if (endDealEarly(g, 'shirt') === msg) bad('ending an empty slot pretended to end something')
  // the naming sponsor comes down off the gates
  const base = club.stadium.includes(' at ') ? club.stadium.slice(club.stadium.indexOf(' at ') + 4) : club.stadium
  if (g.deals?.naming) {
    endDealEarly(g, 'naming')
    if (club.stadiumBase && club.stadium !== club.stadiumBase) bad(`the departed naming sponsor still owns the gates: "${club.stadium}"`)
    void base
  }
}

if (fails) { console.error(`DEAL PROBE: ${fails} failures`); process.exit(1) }
console.log('DEAL PROBE PASSED')
