// Where the money actually goes. The 20-season soak ends with the manager's
// club on £179M against an AI median of £15M - twelve times richer, and by
// season eight the transfer market has stopped meaning anything. Before
// touching any coefficient, measure the weekly ledger for real.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { staffWageBill } from '../src/game/staff'
import { facLevel, FACILITY_INFO, operatingCost, weeklyCentral, type FacilityId } from '../src/game/model'
import { commercialWeekly } from '../src/game/commercial'
import { cashReserve, releaseBlock, releaseToBudget } from '../src/game/treasury'

const SEASONS = Number(process.argv[2] ?? 4)
const CLUB = process.argv[3] ?? 'northampton'

const g = newGame(CLUB, 'Econ Probe', 4242)
const uc = () => g.clubs[g.userClubId]

let wagesOut = 0, staffOut = 0, sponsorIn = 0, gateIn = 0, shopIn = 0, upkeepOut = 0, weeks = 0
let prevBal = uc().balance
const startBal = prevBal
const perSeason: number[] = []

for (let s = 0; s < SEASONS; s++) {
  const seasonStart = uc().balance
  while (g.season === s) {
    const club = uc()
    const wages = club.players.reduce((sum, id) => sum + (g.players[id]?.wage ?? 0), 0)
    const staff = staffWageBill(g)
    // the engine's own figures, not copies of them: a hand-rolled mirror here
    // drifted from weeklyFinance the moment the formula changed and made the
    // probe report a deficit that existed only in its own arithmetic.
    //
    // It happened AGAIN with F30, which is why both halves are named here now.
    // Sponsorship moved out of weeklyCentral into three signable deals, so
    // reading only the central money under-counted the ledger by about £150k a
    // week and this probe reported the economy as broken when nothing had
    // changed about it. If weeklyFinance gains another income line, it belongs
    // here the same day.
    const sponsor = weeklyCentral(club) + commercialWeekly(g)
    const shopLvl = facLevel(g, 'shop')
    const shop = shopLvl > 0 ? Math.round(shopLvl * 9_000 * (0.6 + (g.fanMood ?? 60) / 100)) : 0
    const upkeep = operatingCost(g)
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    processWeekAndAdvance(g)
    // the gate is the residual we cannot read before the fixture is played
    const home = g.fixtures.find(f => f.week === g.week - 1 && f.played && f.homeId === club.id && f.att)
    wagesOut += wages; staffOut += staff; sponsorIn += sponsor; shopIn += shop; upkeepOut += upkeep
    // F31: boxes lift the take per head, so the gate line has to as well
    if (home?.att) gateIn += Math.round(home.att * 30 * (1 + facLevel(g, 'hospitality') * 0.04))
    weeks++
    prevBal = club.balance
    if (g.season >= SEASONS) break
  }
  perSeason.push(uc().balance - seasonStart)
  if (g.season >= SEASONS) break
}

const club = uc()
const per = (n: number) => `£${Math.round(n / weeks / 1000)}k/wk`
console.log(`club ${club.name} rep ${club.rep} capacity ${club.capacity.toLocaleString()} squad ${club.players.length}`)
const estate = (Object.keys(FACILITY_INFO) as FacilityId[]).reduce((s, fid) => s + facLevel(g, fid), 0)
console.log(`estate ${estate}/${Object.keys(FACILITY_INFO).length * 5} after ${SEASONS} seasons`)
console.log(`weeks measured ${weeks}`)
console.log(`  in  commercial + central ${per(sponsorIn)}`)
console.log(`  in  gate receipts     ${per(gateIn)}`)
console.log(`  in  club shop         ${per(shopIn)}`)
console.log(`  out player wages      ${per(wagesOut)}`)
console.log(`  out staff wages       ${per(staffOut)}`)
console.log(`  out ground + estate   ${per(upkeepOut)}`)
const netWeekly = (sponsorIn + gateIn + shopIn - wagesOut - staffOut - upkeepOut) / weeks
console.log(`  net weekly (modelled) £${Math.round(netWeekly / 1000)}k/wk`)
console.log(`balance ${(startBal / 1e6).toFixed(1)}M -> ${(club.balance / 1e6).toFixed(1)}M`)
console.log(`per-season delta: ${perSeason.map(d => `${(d / 1e6).toFixed(1)}M`).join(' ')}`)
const aiBals = Object.values(g.clubs).filter(c => c.id !== g.userClubId).map(c => c.balance).sort((a, b) => a - b)
console.log(`AI median ${(aiBals[Math.floor(aiBals.length / 2)] / 1e6).toFixed(1)}M · ratio ${(club.balance / Math.max(1, aiBals[Math.floor(aiBals.length / 2)])).toFixed(1)}x`)

// This probe printed a verdict and asserted nothing, so it watched the club it
// was written to protect go from +2.4M to -7.3M and said "passed". It had been
// written against runaway wealth (+179M) and never learned the other tail.
// Both are now failures. Nobody should have to read the numbers to notice.
const bal = club.balance
const fails: string[] = []
// Insolvency has to be something the manager did, never something the fixture
// list did to him. A club that just plays its games must not go bust.
if (bal < -2_000_000) fails.push(`structurally insolvent: ${(bal / 1e6).toFixed(1)}M after ${SEASONS} seasons of simply playing the fixtures`)
if (netWeekly < -40_000) fails.push(`weekly ledger runs at ${Math.round(netWeekly / 1000)}k/wk before a single transfer`)
// And the other tail: once the manager's club is an order of magnitude richer
// than the league, the transfer market stops meaning anything.
const median = aiBals[Math.floor(aiBals.length / 2)]
if (median > 0 && bal / median > 6) fails.push(`runaway wealth: ${(bal / median).toFixed(1)}x the AI median`)
// ---- THE TREASURY: the whole balance moves, and the ledger still balances ---
//
// (user: "should be able to transfer balance into transfer money", and v1.1.13:
// "when moving money it doesnt let me transfer everything?").
//
// The rule USED to be "never below the board's reserve", and this block held it
// as a hard wall. It is a line now: a season of wages plus the float is where
// the readout changes its tone and the board start minding, not where the
// engine refuses. Measured at Northampton on day one, the wall version left a
// £17.0m reserve against a £2.4m balance - no travel at all, and a feature that
// read as broken from the first week of every career.
//
// What this still holds, and what actually matters here: every pound that
// leaves the balance arrives in the budget, whichever side of the line it came
// from.
{
  const t = newGame('northampton', 'Treasury', 3)
  const club = t.clubs[t.userClubId]
  club.balance = cashReserve(t) + 1_200_000
  const bal0 = club.balance, bud0 = club.budget
  const first = releaseToBudget(t)
  if (!first.ok) fails.push(`a club with surplus cash was refused: ${first.msg}`)
  if (club.balance !== bal0 - 500_000 || club.budget !== bud0 + 500_000) {
    fails.push(`the slice moved wrong: balance ${bal0} -> ${club.balance}, budget ${bud0} -> ${club.budget}`)
  }
  const second = releaseToBudget(t)
  if (!second.ok) fails.push('the second affordable slice was refused')
  // the third slice dips under the line, and is allowed - with the board's
  // disquiet as its price rather than a refusal
  const boardBefore = club.boardConfidence
  const third = releaseToBudget(t)
  if (!third.ok) fails.push('a slice below the reserve was refused - the wall was supposed to be a line')
  if (club.boardConfidence >= boardBefore) {
    fails.push(`dipping under the reserve cost the board nothing (${boardBefore} -> ${club.boardConfidence})`)
  }
  // and the pounds add up whichever side of the line they came from
  if (club.balance + club.budget !== bal0 + bud0) {
    fails.push(`the ledger does not balance: ${bal0 + bud0} in, ${club.balance + club.budget} out`)
  }
  // the one refusal left is having nothing to move
  club.balance = 100_000
  if (releaseBlock(t) == null) fails.push('an empty account still offers the bar')
  if (releaseToBudget(t).ok) fails.push('a club with nothing in the bank moved money anyway')
}

if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('ECON PROBE PASSED (solvent by playing, and not richer than the world)')
