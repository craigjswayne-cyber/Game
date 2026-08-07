// Where the money actually goes. The 20-season soak ends with the manager's
// club on £179M against an AI median of £15M - twelve times richer, and by
// season eight the transfer market has stopped meaning anything. Before
// touching any coefficient, measure the weekly ledger for real.
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../src/game/season'
import { simMatch } from '../src/game/matchEngine'
import { staffWageBill } from '../src/game/staff'
import { facLevel, FACILITY_INFO, operatingCost, weeklyCentral, type FacilityId } from '../src/game/model'

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
    // the engine's own figure, not a copy of it: a hand-rolled mirror here
    // drifted from weeklyFinance the moment the formula changed and made the
    // probe report a deficit that existed only in its own arithmetic
    const sponsor = weeklyCentral(club)
    const shopLvl = facLevel(g, 'shop')
    const shop = shopLvl > 0 ? Math.round(shopLvl * 9_000 * (0.6 + (g.fanMood ?? 60) / 100)) : 0
    const upkeep = operatingCost(g)
    const fx = userFixtureThisWeek(g)
    if (fx) simMatch(g, fx, weekRng(g), true)
    processWeekAndAdvance(g)
    // the gate is the residual we cannot read before the fixture is played
    const home = g.fixtures.find(f => f.week === g.week - 1 && f.played && f.homeId === club.id && f.att)
    wagesOut += wages; staffOut += staff; sponsorIn += sponsor; shopIn += shop; upkeepOut += upkeep
    if (home?.att) gateIn += Math.round(home.att * 30)
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
console.log(`estate ${estate}/40 after ${SEASONS} seasons`)
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
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('ECON PROBE PASSED (solvent by playing, and not richer than the world)')
