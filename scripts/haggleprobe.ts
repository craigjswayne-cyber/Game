// Probe: can you actually haggle, and only when you have earned the right to?
//
// Asked in live play: "trying to haggle with a team for a signing but they keep
// saying asking price. Would they ever accept under?" They would not. The accept
// threshold was `counterPrice - 50_000`: a FLAT fifty grand off any deal, so 2.5%
// off two million and 0.25% off twenty. A man rotting in the reserves in the last
// year of his contract cost the same to prise out as a happy first-choice starter.
//
// Two things have to be true now, and they pull against each other:
//   - a weakened seller really does come down, and says why
//   - a club with no reason to sell still gets its full asking price, because a
//     market where everything is negotiable is a market that no longer matches
//     the salary cap it was balanced against
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { MAX_HAGGLE, agreeFee, askingPrice, floorPrice, sellerWillingness, signFreeAgent } from '../src/game/ai'
import { fmtMoney } from '../src/game/model'

let fails = 0
const bad = (m: string) => { fails++; console.error('FAIL: ' + m) }

const g = newGame('northampton', 'Haggle Probe', 12345)
for (let i = 0; i < 20; i++) processWeekAndAdvance(g)
const user = g.clubs[g.userClubId]
user.budget = 400_000_000        // take money out of the equation

const all = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.youth)
let none = 0, some = 0, deep = 0, sum = 0
for (const p of all) {
  const w = sellerWillingness(g, p)
  if (w.discount > MAX_HAGGLE + 1e-9) bad(`${p.name} would go ${(w.discount * 100).toFixed(0)}% under, past the ${MAX_HAGGLE * 100}% ceiling`)
  if (w.discount > 0 && !w.reasons.length) bad(`${p.name} carries a discount with no reason attached`)
  if (w.discount === 0 && w.reasons.length) bad(`${p.name} has reasons but no discount`)
  if (w.discount === 0) none++
  else { some++; sum += w.discount; if (w.discount >= 0.2) deep++ }
}
console.log(`${all.length} players at other clubs`)
console.log(`  no discount at all: ${none} (${((none / all.length) * 100).toFixed(0)}%)`)
console.log(`  some give: ${some}, of which ${deep} at 20% or more`)
console.log(`  average where there is one: ${((sum / Math.max(1, some)) * 100).toFixed(1)}%`)

// The base case must dominate. If almost everybody is negotiable then the asking
// price has stopped meaning anything and the market has been quietly devalued.
const openShare = some / all.length
if (none < all.length * 0.25) bad(`only ${((none / all.length) * 100).toFixed(0)}% of players are held at full price, so the ask means little`)
if (openShare > 0.75) bad(`${(openShare * 100).toFixed(0)}% of the market is negotiable, which is too much`)
if (sum / Math.max(1, some) > 0.16) bad(`the average discount is ${((sum / some) * 100).toFixed(0)}%, which is a fire sale rather than a haggle`)

// ---- a wanted man is not for sale cheap ----
const wanted = all.filter(p => {
  const w = sellerWillingness(g, p)
  return w.discount === 0 && p.ca >= 78
})
console.log(`\n${wanted.length} sought-after men with no give in the price`)
if (!wanted.length) bad('every good player in the world is available at a discount')
for (const p of wanted.slice(0, 3)) {
  const ask = askingPrice(g, p)
  if (floorPrice(g, p) !== Math.round(ask / 50_000) * 50_000) {
    bad(`${p.name} has no reasons to sell but a floor under his ask`)
  }
  // and a bid under the ask must be refused
  const r = agreeFee(g, p.id, Math.round(ask * 0.85))
  if (r.ok) bad(`${p.name}'s club took 15% under the ask with no reason to`)
}

// ---- a weakened seller does come down, and the message says why ----
const soft = all
  .map(p => ({ p, w: sellerWillingness(g, p), ask: askingPrice(g, p), floor: floorPrice(g, p) }))
  .filter(d => d.w.discount >= 0.15 && d.ask > 500_000)
  .sort((a, b) => b.w.discount - a.w.discount)
console.log(`${soft.length} genuine bargains on the board`)
if (!soft.length) bad('nobody in the world can be bought under the asking price')
for (const d of soft.slice(0, 3)) {
  console.log(`  ${d.p.name} (ca ${d.p.ca}, ${g.clubs[d.p.clubId!]?.short}): ask ${fmtMoney(d.ask)} floor ${fmtMoney(d.floor)} - ${d.w.reasons[0]}`)
  const at = agreeFee(g, d.p.id, d.floor)
  if (!at.ok) bad(`${d.p.name} was refused at his own floor of ${fmtMoney(d.floor)}: ${at.msg}`)
  if (at.ok && d.floor < d.ask - 50_000 && !/under their asking price/.test(at.msg)) {
    bad(`a deal ${fmtMoney(d.ask - d.floor)} under the ask did not say so: ${at.msg}`)
  }
  // a pound under the floor is refused, and the refusal names a workable number
  const below = agreeFee(g, d.p.id, d.floor - 50_000)
  if (below.ok) bad(`${d.p.name} was sold under his own floor`)
  if (!below.ok && below.counter == null && d.floor - 50_000 >= d.floor * 0.8) {
    bad(`a near miss on ${d.p.name} offered no counter to work from`)
  }
  if (below.counter != null && below.counter < d.floor) {
    bad(`the counter for ${d.p.name} (${fmtMoney(below.counter)}) sits under his floor`)
  }
  if (!/open to less|would listen/.test(below.msg) && !/do business at/.test(below.msg)) {
    bad(`the rejection for ${d.p.name} explains nothing: ${below.msg}`)
  }
}

// ---- the strongest hand of all: out of contract in the summer ----
{
  const t = all.find(p => p.ca >= 60 && (p.contractEnds ?? 0) > g.season)!
  const before = sellerWillingness(g, t).discount
  t.contractEnds = g.season                     // now expiring
  const after = sellerWillingness(g, t)
  console.log(`\n${t.name} with his contract running out: ${(before * 100).toFixed(0)}% becomes ${(after.discount * 100).toFixed(0)}%`)
  if (after.discount <= before) bad('an expiring contract did not weaken the selling club')
  if (!after.reasons.some(r => /out of contract/.test(r))) bad('an expiring contract was not given as a reason')
}

// ---- and a counter you accept is honoured ----
{
  const d = soft[0]
  if (d) {
    const r = agreeFee(g, d.p.id, d.floor - 50_000)
    if (r.counter != null) {
      const shake = agreeFee(g, d.p.id, r.counter)
      if (!shake.ok && !/won't discuss terms/.test(shake.msg)) {
        bad(`they countered at ${fmtMoney(r.counter)} and then refused it: ${shake.msg}`)
      }
    }
  }
}

// ---- THE INK IS STILL WET: no instant buy-backs ----------------------------
//
// (user: "i just sold this player - i shouldn't really be able to buy them
// back within 6 months... i can offer but it should rarely be accepted as
// the club have invested in this player"). A freshly-arrived man is behind a
// door only a can't-argue offer (double the ask) opens; once half a season
// has passed, the normal market applies again.
{
  const g = newGame('northampton', 'InkWet', 41)
  const SEASON_WEEKS = 45
  const target = Object.values(g.players).find(p =>
    p.clubId && p.clubId !== g.userClubId && g.clubs[p.clubId!] && !p.acad && p.ca >= 70)!
  const seller = g.clubs[target.clubId!]
  g.clubs[g.userClubId].budget = 100_000_000
  target.joinedAt = g.season * SEASON_WEEKS + g.week - 3 // three weeks into his move
  const ask = askingPrice(g, target)
  const polite = agreeFee(g, target.id, ask)
  if (polite.ok) bad(`three weeks after arriving, ${seller.short} sold ${target.name} at the mere asking price`)
  if (polite.ok || !/invested in him/.test(polite.msg)) bad(`the refusal does not say why: "${polite.msg}"`)
  const silly = agreeFee(g, target.id, Math.round((ask * 2) / 50_000) * 50_000 + 50_000)
  if (!silly.ok && !/won't discuss terms/.test(silly.msg)) {
    bad(`an offer past double the ask should force the door: "${silly.msg}"`)
  }
  target.joinedAt = g.season * SEASON_WEEKS + g.week - 30 // an old move
  const later = agreeFee(g, target.id, ask)
  if (!later.ok && /invested in him/.test(later.msg)) bad('the gate outlived its half season')
}

// ---- FREE AGENTS SIGN THROUGH THE ENGINE'S GUARDS --------------------------
//
// (user: "you should be able to search for free agents on the transfer
// centre"). The market's Free agents filter finds them; this is the signing
// path behind the button - which used to live inline in the UI and skipped
// the salary-cap and embargo checks entirely.
{
  const g = newGame('northampton', 'FreeAgent', 43)
  const user = g.clubs[g.userClubId]
  // a fresh world has no free agents yet - make one the way a contract
  // expiry does: off his club's roster, clubId null
  const fa = Object.values(g.players).find(p =>
    p.clubId && p.clubId !== g.userClubId && g.clubs[p.clubId!] && !p.acad && p.age <= 30)
  if (!fa) bad('nobody in the world could be released to test with')
  else {
    const donor = g.clubs[fa.clubId!]
    donor.players = donor.players.filter(id => id !== fa.id)
    fa.clubId = null
    const signings0 = g.mgr.signings
    const r = signFreeAgent(g, fa.id)
    if (!r.ok) bad(`a clubless man with affordable wages was refused: ${r.msg}`)
    if (fa.clubId !== user.id || !user.players.includes(fa.id)) bad('he signed but did not arrive')
    if (!fa.wage || fa.wage <= 0) bad('he signed for no wage at all')
    if (fa.joinedAt == null || fa.avail !== 0) bad('the arrival was not stamped (joinedAt/avail)')
    if (g.mgr.signings !== signings0 + 1) bad('the signing is missing from the manager record')
    const again = signFreeAgent(g, fa.id)
    if (again.ok) bad('signed the same man twice')
  }
}

if (fails) { console.error(`HAGGLE PROBE: ${fails} failures`); process.exit(1) }
console.log('\nHAGGLE PROBE PASSED')
