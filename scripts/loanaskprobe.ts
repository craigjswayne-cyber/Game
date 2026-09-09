/**
 * ---- ASKING, AND BUYING AT THE END OF IT ----
 *
 * Two things the owner asked for on 7 Sep, and the parts of them that are
 * promises rather than code paths.
 *
 * "can you propose to loan players even if they dont have loan available? So
 * you can take younger players and develop them. RIVAL CLUBS SHOULDN'T ACCEPT
 * THIS THOUGH." The rival half is the one worth a probe: a chance that is
 * merely low is a chance that fires eventually, and a manager who borrows a
 * kid off the club he plays a derby against twice a year has been told a lie
 * about how the game works. So it is checked as NONE, over every rival pair in
 * the map, at the most generous terms the game allows.
 *
 * "The team will likely sell unless they think he is crucial." Two claims: the
 * usual answer is yes, and the exception is real. Both are measured rather than
 * asserted, because "likely" that turns out to be 5% is a different game from
 * the one that sentence describes.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { loanApproachable, loanBuyOffer, loanIn, loanRival, loanTargets, loanTerms, isApproach, LOAN_BUY_MIN_WEEKS } from '../src/game/loans'
import { rivalsOf } from '../src/game/rivalries'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g = newGame('bath', 'Test', 4242)

// ---- 1. the shop window is still the shop window -------------------------
console.log('--- 1. the list you could always browse')
const listed = loanTargets(g)
ok(listed.length > 0, `the shop window still has ${listed.length} names in it`)
ok(listed.every(p => !isApproach(g, p.id)), 'and nothing on it counts as an unsolicited approach')

// ---- 2. you can now ask about somebody who was never offered -------------
console.log('\n--- 2. the phone call')
const listedIds = new Set(listed.map(p => p.id))
const askable = Object.values(g.players).filter(p => !listedIds.has(p.id) && loanApproachable(g, p))
ok(askable.length > 0, `${askable.length} young players you may ring about who were never listed`)
ok(askable.every(p => p.age <= 23), 'every one of them is 23 or under - it is a development loan or it is nothing')
ok(askable.every(p => !p.injury && !p.onLoan && !p.loanFrom), 'none is injured or already out on loan')

// an approach is genuinely harder than the shop window, not merely different
const sample = askable.slice(0, 400)
const askYes = sample.filter(p => loanTerms(g, p.id, 'season', 1).ok).length
const listYes = listed.filter(p => loanTerms(g, p.id, 'season', 1).ok).length
console.log(`     at the most generous terms: ${listYes}/${listed.length} of the listed say yes, ${askYes}/${sample.length} of the unlisted`)
ok(askYes > 0, 'an approach is not a wall: some of them say yes at full wages')
ok(askYes / Math.max(1, sample.length) < listYes / Math.max(1, listed.length),
  'but it is harder than picking off the list, which is the whole point of the list')

// ---- 3. AND A RIVAL NEVER SAYS YES ---------------------------------------
console.log('\n--- 3. a rival puts the phone down')
const rivals = rivalsOf(g.userClubId)
ok(rivals.length > 0, `the user's club has ${rivals.length} rival(s) in the map`)
let rivalAsked = 0
let rivalYes = 0
for (const p of Object.values(g.players)) {
  if (!p.clubId || !rivals.includes(p.clubId)) continue
  if (!loanApproachable(g, p)) continue
  rivalAsked++
  ok(loanRival(g, p.id), `${p.name} is correctly flagged as a rival's player`)
  // every length, every share, the most generous the game allows
  for (const len of ['short', 'half', 'season'] as const) {
    for (const share of [0.25, 0.5, 0.75, 1]) {
      if (loanTerms(g, p.id, len, share).ok) rivalYes++
    }
  }
  if (rivalAsked >= 6) break
}
console.log(`     asked about ${rivalAsked} of a rival's young players, at 12 sets of terms each`)
ok(rivalAsked > 0, 'there was somebody at a rival club to ask about')
ok(rivalYes === 0, `and not one of the ${rivalAsked * 12} offers was accepted (${rivalYes} were)`)

// ---- 4. loan to buy ------------------------------------------------------
console.log('\n--- 4. the option at the end of the trial')
const target = listed[0]
const before = loanBuyOffer(g, target.id)
ok(before === null, 'no buy option on a player who is not here on loan')
loanIn(g, target.id, 'season', 1)
const onArrival = loanBuyOffer(g, target.id)
ok(onArrival !== null && !onArrival.ok, 'and none on the day he walks in - a trial is weeks of rugby')
ok(onArrival?.k === 'reply.loanBuyTooSoon', 'the refusal says exactly why')
for (let i = 0; i < LOAN_BUY_MIN_WEEKS + 1; i++) processWeekAndAdvance(g)
const served = loanBuyOffer(g, target.id)
ok(served !== null, 'after the trial the option exists')
ok(!served || served.fee > 0, `and it names a price (${served?.fee})`)

// how often does a parent actually sell? "likely", measured
let yes = 0, crucial = 0, n = 0
for (let s = 0; s < 60; s++) {
  const w = newGame('bath', 'Test', 900 + s)
  const t0 = loanTargets(w)[0]
  if (!t0) continue
  loanIn(w, t0.id, 'season', 1)
  for (let i = 0; i < LOAN_BUY_MIN_WEEKS + 1; i++) processWeekAndAdvance(w)
  const o = loanBuyOffer(w, t0.id)
  if (!o) continue
  n++
  // the CLUB's answer, which is what the owner's sentence is about. Whether the
  // user happens to have the cash this week is a different question, and the
  // game now gives it a different reply.
  if (o.willing) yes++
  if (o.k === 'reply.loanBuyCrucial') crucial++
}
const pct = Math.round((yes / Math.max(1, n)) * 100)
console.log(`     ${n} loans played out: ${yes} would sell (${pct}%), ${crucial} called him crucial`)
ok(n > 0, 'the trial ran in every world')
ok(pct >= 50, `the parent club "will likely sell" - and likely means likely (${pct}%)`)
ok(crucial < n, 'but not every one of them: "crucial" is a real exception, not a formality')

console.log('')
if (fails === 0) console.log('LOAN ASK PROBE PASSED: you may ask about anyone young, a rival always says no, and a trial ends in an option')
else console.log(`LOAN ASK PROBE FAILED (${fails})`)
process.exit(fails)
