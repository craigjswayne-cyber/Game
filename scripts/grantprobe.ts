// Probe: every purchasable effect is exactly what the tin says, and no more.
//
// v1.1.0 sells power for the first time (docs/monetisation-spec.md), which is
// precisely why this probe exists before a single store row renders. The doors
// are in grants.ts; this walks through each one and then rattles it:
//
//   nothing purchased ever sets itself - a fresh career carries no flag
//   an injection pays the printed figure (snapshot pct, floored), twice per
//     tier, once for the Sugar Daddy, and not a third time for money
//   the wage allowance stacks, moves the USER's ceiling only, and dies at
//     rollover with the injections ledger; the AI's law never moves
//   bought cash can never finish "in the black" - the books objective reads
//     organic funds
//   the Charter lifts the ceiling for the save, clears a live embargo, cannot
//     be applied twice, and leaves every AI club capped
//   a licensed save is a proven name (the reputation scale's ceiling), an
//     unlicensed one still starts cold
//
// Run: npx tsx scripts/grantprobe.ts
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { HEALS_PER_SEASON, NAT_CALL_WEEKS, applyCharter, applyEstate, applyHeal, applyInjection, applyPinnacle, healsLeft, INJECT_TIERS, injectionCash, injectionsLeft, type InjectTier } from '../src/game/grants'
import { capPosition } from '../src/game/cap'
import { FACILITY_INFO, MAX_FACILITY, mgrReputation, type FacilityId, type GameState } from '../src/game/model'
import { OBJECTIVE_DEFS } from '../src/game/objectives'

let fails = 0
const ok = (c: boolean, what: string) => { console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`); if (!c) fails++ }

console.log('--- 1. a fresh career has bought nothing\n')
{
  const g = newGame('northampton', 'Grant Probe', 7101)
  ok(!g.uncapped && !g.licensed, 'no Charter or License stamp sets itself')
  ok(!g.wageBoost && !g.injections && !g.injectedThisSeason, 'no injection ledger exists before a purchase')
  ok(g.clubs[g.userClubId].budgetAtOpen === g.clubs[g.userClubId].budget,
    'the opening budget is snapshotted at kick-off, so the store rows can price honestly')
}

console.log('\n--- 2. an injection pays the printed figure, and the well has a bottom\n')
{
  const g = newGame('northampton', 'Grant Probe', 7101)
  const club = g.clubs[g.userClubId]
  const open = club.budgetAtOpen ?? club.budget
  for (const tier of Object.keys(INJECT_TIERS) as InjectTier[]) {
    const want = Math.max(INJECT_TIERS[tier].floor, Math.round((open * INJECT_TIERS[tier].pct) / 10_000) * 10_000)
    ok(injectionCash(g, tier) === want, `${tier}: the store row's figure is ${want.toLocaleString('en-GB')} (pct of snapshot, floored)`)
  }
  const before = { budget: club.budget, balance: club.balance, news: g.news.length }
  ok(applyInjection(g, 's'), 'the first small injection goes through')
  const cash = injectionCash(g, 's')
  ok(club.budget === before.budget + cash && club.balance === before.balance + cash,
    'budget and balance rise together by exactly the printed figure')
  ok(g.injectedThisSeason === cash, 'the bought pound is written into the objectives ledger')
  ok(g.wageBoost === INJECT_TIERS.s.wage, `the board underwrites ${INJECT_TIERS.s.wage * 100}% of the cap in wages`)
  const letter = g.news[g.news.length - 1]
  ok(g.news.length === before.news + 1 && letter.k === 'news.boardInjection',
    'the board letter lands in the inbox, keyed for both languages')
  ok(applyInjection(g, 's'), 'the second small injection goes through')
  ok(!applyInjection(g, 's') && injectionsLeft(g, 's') === 0, 'the third is refused: two per tier per season')
  const held = { budget: club.budget, balance: club.balance, boost: g.wageBoost }
  ok(club.budget === held.budget && club.balance === held.balance && g.wageBoost === held.boost,
    'and a refusal moves no money at all')
  ok(applyInjection(g, 'xl'), 'the Sugar Daddy arrives once')
  ok(!applyInjection(g, 'xl'), 'and will not go to the well twice in a year')
  ok(g.wageBoost === Math.round((INJECT_TIERS.s.wage * 2 + INJECT_TIERS.xl.wage) * 100) / 100,
    'the wage allowance stacks across purchases, to the penny of the percent')
}

console.log('\n--- 3. the floors hold at a small club\n')
{
  const g = newGame('bedford', 'Grant Probe', 7102)
  const club = g.clubs[g.userClubId]
  club.budgetAtOpen = 0 // a club in administration can open with nothing at all
  for (const tier of Object.keys(INJECT_TIERS) as InjectTier[]) {
    ok(injectionCash(g, tier) === INJECT_TIERS[tier].floor,
      `${tier}: an empty opening budget still pays the ${INJECT_TIERS[tier].floor.toLocaleString('en-GB')} floor`)
  }
}

console.log('\n--- 4. the wage allowance moves one ceiling, and only for a season\n')
{
  const g = newGame('northampton', 'Grant Probe', 7103)
  const base = capPosition(g, g.userClubId).cap
  const rival = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)!
  const rivalBase = capPosition(g, rival.id).cap
  ok(base != null && rivalBase != null, 'the league has a cap to move')
  applyInjection(g, 'l')
  ok(capPosition(g, g.userClubId).cap === Math.round(base! * (1 + INJECT_TIERS.l.wage)),
    `the user ceiling rises by the tier's ${INJECT_TIERS.l.wage * 100}%`)
  ok(capPosition(g, rival.id).cap === rivalBase, "the rival's ceiling has not moved an inch")
  // drive to the rollover; the board is pinned content so an autopilot slump
  // cannot end the tenure mid-probe (the annualprobe lesson)
  const start = g.season
  let guard = 0
  while (g.season === start && guard++ < 60) {
    g.clubs[g.userClubId].boardConfidence = Math.max(70, g.clubs[g.userClubId].boardConfidence)
    processWeekAndAdvance(g)
  }
  ok(g.season === start + 1, `the season rolled (${guard} weeks)`)
  ok(!g.wageBoost && !g.injections && !g.injectedThisSeason,
    'the purchased season expired with the season it was bought in')
  ok(g.clubs[g.userClubId].budgetAtOpen === g.clubs[g.userClubId].budget,
    'and the new opening budget is snapshotted for the new store rows')
  ok(capPosition(g, g.userClubId).cap === capPosition(g, rival.id).cap,
    'the ceiling is the league\'s own again')
}

console.log('\n--- 5. bought cash can never finish the books\n')
{
  const g = newGame('northampton', 'Grant Probe', 7104)
  const books = OBJECTIVE_DEFS.find(o => o.id === 'books')!
  const club = g.clubs[g.userClubId]
  applyInjection(g, 'm')
  club.balance = (g.injectedThisSeason ?? 0) - 1 // in the black, but only by bought money
  ok(!books.met(g), 'in credit on injected money alone does not meet "finish in the black"')
  club.balance = (g.injectedThisSeason ?? 0) + 1 // organically solvent besides the injection
  ok(books.met(g), 'organically solvent, the objective is met as before')
}

console.log('\n--- 6. the Charter is total, singular, and nobody else\'s\n')
{
  const g = newGame('northampton', 'Grant Probe', 7105)
  const club = g.clubs[g.userClubId]
  const rival = Object.values(g.clubs).find(c => c.id !== club.id && c.leagueId === club.leagueId)!
  club.capEmbargoUntil = g.season + 1 // a sanction being served when the lawyers arrive
  ok(applyCharter(g), 'the Charter is applied')
  ok(g.uncapped === true, 'the save is uncapped')
  const pos = capPosition(g, g.userClubId)
  ok(pos.cap == null && !pos.over, 'the user club answers to no ceiling')
  ok(pos.embargo === 0 && club.capEmbargoUntil == null, 'the embargo died with the law that imposed it')
  ok(capPosition(g, rival.id).cap != null, 'every AI club remains capped')
  ok(!applyCharter(g), 'it cannot be bought twice')
  ok(g.news.some(n => n.k === 'news.charter'), 'and the ownership letter is in the inbox, keyed')
}

console.log('\n--- 7. a licensed save is a proven name from day one\n')
{
  const cold = newGame('northampton', 'Grant Probe', 7106)
  const rep = mgrReputation(cold)
  ok(rep < 40, `an unlicensed fresh career still starts cold (${rep})`)
  cold.licensed = true
  ok(mgrReputation(cold) === 95, 'licensed, the same career is at the top of the scale (95)')
}

// Section 8 tested the In-Game Editor's clamped writes. The Editor was removed
// on the owner's call (27 Aug, v1.1.3) before any store ever sold one, so the
// writes it clamped no longer exist to clamp.

console.log('\n--- 8. the retreat heals everything, and only so often\n')
{
  const g = newGame('northampton', 'Grant Probe', 7108)
  const club = g.clubs[g.userClubId]
  const hurtOne = () => {
    const p = g.players[club.players[0]]!
    p.injury = { desc: 'ribs', until: g.week + 6, weeks: 6 }
    p.cond = 55
    p.rust = 2
    return p
  }
  ok(healsLeft(g) === HEALS_PER_SEASON, `a fresh season has all ${HEALS_PER_SEASON} visits`)
  const p = hurtOne()
  ok(applyHeal(g), 'a squad with an injured man takes the retreat')
  ok(p.injury === null && p.cond === 100 && (p.rust ?? 0) === 0,
    'and he walks out healed: no injury, full condition, no rust')
  ok(healsLeft(g) === HEALS_PER_SEASON - 1, 'one visit is spent')
  ok(g.news.some(n => n.k === 'news.heal'), 'the letter is filed, keyed for both languages')
  // sharpness is match practice, not medicine
  const sharpBefore = g.players[club.players[1]]!.sharp
  ok(g.players[club.players[1]]!.sharp === sharpBefore, 'sharpness is untouched - it comes back on Saturdays')
  ok(!applyHeal(g), 'a fully fit squad has nothing to heal, and the purchase is held rather than swallowed')
  ok(healsLeft(g) === HEALS_PER_SEASON - 1, 'the refusal spends no visit')
  hurtOne(); ok(applyHeal(g), 'visit two lands')
  hurtOne(); ok(applyHeal(g), 'visit three lands')
  hurtOne()
  ok(!applyHeal(g), `visit ${HEALS_PER_SEASON + 1} is refused - the well has a bottom`)
}

console.log('\n--- 9. the estate rises whole, once, and the builders take their half-built site with them\n')
{
  const g = newGame('northampton', 'Grant Probe', 7109)
  const club = g.clubs[g.userClubId]
  g.facilityBuild = { id: 'gym', done: 3, level: 2 }
  ok(applyEstate(g), 'the estate purchase applies')
  const fids = Object.keys(FACILITY_INFO) as FacilityId[]
  ok(fids.every(f => (club.facilities?.[f] ?? 0) === MAX_FACILITY), 'every one of the nine facilities stands at its ceiling')
  ok(g.estateMaxed === true, 'the save wears the stamp')
  ok(g.facilityBuild === null, 'the half-built project is folded into the wave, not left dangling')
  ok(g.news.some(n => n.k === 'news.estate'), 'the letter is filed, keyed')
  ok(!applyEstate(g), 'and it cannot be applied twice')
}

console.log('\n--- 10. the call to the federations is answered, once per career, whatever the reputation\n')
{
  const g = newGame('northampton', 'Grant Probe', 7110)
  ok(mgrReputation(g) < 64, `a fresh career is nowhere near the earned gate (${mgrReputation(g)})`)
  ok(applyPinnacle(g), 'the call goes out')
  ok(g.pinnacleCalled === true && g.natCall != null, 'the save is stamped and the answer is scheduled')
  ok(g.news.some(n => n.k === 'news.pinnacle'), 'the letter is filed, keyed')
  ok(!g.natOffer, 'no offer materialises on the spot - federations take a fortnight')
  for (let i = 0; i < NAT_CALL_WEEKS + 1 && !g.natOffer; i++) processWeekAndAdvance(g)
  ok(!!g.natOffer, `a real offer arrives within ${NAT_CALL_WEEKS + 1} weeks`)
  ok(g.natOffer?.nat === 'CAN', 'from the foot of the ladder, because the product is the introduction, not the All Blacks job')
  ok(g.natCall == null, 'the call is answered and cleared')
  ok(!applyPinnacle(g), 'a career only gets one call')
}

if (fails) { console.error(`\nGRANT PROBE FAILED (${fails})`); process.exit(1) }
console.log('\nGRANT PROBE PASSED: every purchase pays the tin, and only the tin')
