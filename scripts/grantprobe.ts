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
import { NAT_CALL_WEEKS, applyCharter, applyEstate, applyHeal, applyInjection, applyPinnacle, healReady, INJECT_TIERS, injectionCash, injectionsLeft, userCap, userWageBudget, type InjectTier } from '../src/game/grants'
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
  // v1.1.5: the owner's fixed figures - every club gets the number on the tin
  for (const tier of Object.keys(INJECT_TIERS) as InjectTier[]) {
    ok(injectionCash(g, tier) === INJECT_TIERS[tier].amount,
      `${tier}: the store row's figure is the fixed ${INJECT_TIERS[tier].amount.toLocaleString('en-GB')}`)
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

console.log('\n--- 3. the fixed figures hold at a small club too\n')
{
  // pricing used to be a percentage of the opening budget with a floor;
  // since v1.1.5 the figure is fixed, so a club fresh out of administration
  // is paid exactly what Toulouse would be - the tin is the tin
  const g = newGame('bedford', 'Grant Probe', 7102)
  const club = g.clubs[g.userClubId]
  club.budgetAtOpen = 0 // a club in administration can open with nothing at all
  for (const tier of Object.keys(INJECT_TIERS) as InjectTier[]) {
    ok(injectionCash(g, tier) === INJECT_TIERS[tier].amount,
      `${tier}: an empty opening budget still pays the full ${INJECT_TIERS[tier].amount.toLocaleString('en-GB')}`)
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
  // THE RIVAL IS PICKED AGAIN AFTER THE ROLLOVER, and it has to be.
  //
  // The claim is that the boost expires and the user's ceiling goes back to
  // being his LEAGUE's - so it must be compared against a club in whatever
  // league he is now in. Pinning the rival before the season meant the claim
  // quietly also asserted "and he does not get relegated": an unrelated
  // v1.1.12 change shifted the world, seed 7103's Northampton went down, the
  // two clubs ended up under different caps and a working expiry read as a
  // failure. Board confidence was already pinned here for the same shape of
  // reason (the annualprobe lesson); the league is the other half of it.
  const after = Object.values(g.clubs).find(c =>
    c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)!
  ok(capPosition(g, g.userClubId).cap === capPosition(g, after.id).cap,
    `the ceiling is the league's own again (${g.clubs[g.userClubId].leagueId}, against ${after.short})`)
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

console.log('\n--- 8. the retreat heals everything, but never twice without a game\n')
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
  ok(healReady(g), 'a fresh career can book the retreat')
  const p = hurtOne()
  ok(applyHeal(g), 'a squad with an injured man takes the retreat')
  ok(p.injury === null && p.cond === 100 && (p.rust ?? 0) === 0,
    'and he walks out healed: no injury, full condition, no rust')
  ok(g.news.some(n => n.k === 'news.heal'), 'the letter is filed, keyed for both languages')
  // sharpness is match practice, not medicine
  const sharpBefore = g.players[club.players[1]]!.sharp
  ok(g.players[club.players[1]]!.sharp === sharpBefore, 'sharpness is untouched - it comes back on Saturdays')
  // v1.1.5: no seasonal bottom, but never back-to-back - a game must be
  // played between visits, read off the manager's own record
  hurtOne()
  ok(!healReady(g) && !applyHeal(g), 'a second visit with no game played is refused')
  g.mgr.w += 1 // a match managed (any result would do)
  ok(healReady(g), 'one game later the retreat reopens')
  ok(applyHeal(g), 'and visit two lands')
  hurtOne()
  ok(!applyHeal(g), 'but not visit three in the same breath')
  g.mgr.l += 1
  ok(applyHeal(g), 'a defeat counts too - it is a game, not a result, that separates visits')
  const healedTwiceMore = g.injections?.heal
  ok(healedTwiceMore === 3, `the ledger still counts every visit (${healedTwiceMore})`)
  // a fully fit squad still holds the purchase rather than swallowing it
  g.mgr.w += 1
  ok(!applyHeal(g), 'a fully fit squad has nothing to heal, and the purchase is held rather than swallowed')
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

console.log('\n--- 10. the International Stage APPOINTS, once per career, to the nation the buyer picked\n')
{
  const g = newGame('northampton', 'Grant Probe', 7110)
  ok(mgrReputation(g) < 64, `a fresh career is nowhere near the earned gate (${mgrReputation(g)})`)
  // v1.1.5: the buyer picks the federation - any rung of the ladder,
  // reputation notwithstanding, because the choice is the product now
  ok(!applyPinnacle(g, 'ATLANTIS'), 'a federation that does not exist refuses the call, spending nothing')
  ok(!g.pinnacleCalled, 'and the career still has its call')
  ok(applyPinnacle(g, 'NZL'), 'the call goes out to the buyer\'s own pick')
  // v1.1.12 (owner): "it should be immediate and automatically installed - it
  // shouldnt even be an offer just an announcement with a question of will you
  // carry on at the club?" An offer could expire, and did: three weeks of play
  // without finding the letter and the purchase was gone.
  ok(g.natTeam === 'NZL', 'he IS the All Blacks head coach - installed, not offered')
  ok(!g.natOffer, 'nothing was left on a shelf that expires')
  ok(g.natConfidence === 60 && g.natRecord?.m === 0, 'the tenure opens at nought with the union believing in him')
  ok(g.news.some(n => n.k === 'news.natAppointed'), 'the announcement is filed, keyed')
  ok(g.natKeepAsk === 'NZL', 'and the one real question stands: does he carry on at the club?')
  ok(g.natCall == null && g.natCallNat == null, 'no two-week callback is scheduled - there is nothing left to wait for')
  ok(!applyPinnacle(g, 'CAN'), 'and a second call is refused while he holds the job')

  // a call with no pick still lands somewhere honest, immediately
  const h = newGame('northampton', 'Grant Probe', 7111)
  ok(applyPinnacle(h), 'a pickless call still goes out')
  ok(h.natTeam === 'CAN', 'and appoints at once to the best tier the reputation honestly qualifies for')

  // the OLD wait, kept for a save whose call was already in flight when the
  // wait was removed: the answer block in season.ts still delivers it
  const old = newGame('northampton', 'Grant Probe', 7113)
  const { SEASON_WEEKS } = await import('../src/game/model')
  old.pinnacleCalled = true
  old.natCall = old.season * SEASON_WEEKS + old.week + NAT_CALL_WEEKS
  old.natCallNat = 'FIJ'
  for (let i = 0; i < NAT_CALL_WEEKS + 1 && !old.natOffer; i++) processWeekAndAdvance(old)
  ok(old.natOffer?.nat === 'FIJ', 'an old save mid-call is still answered by the season engine')

  // the club question: both answers work, and an unanswered one costs nothing
  const { useStore } = await import('../src/store')
  useStore.setState({ game: h, persist: async () => {} })
  useStore.getState().answerNatKeep(true)
  ok(h.natTeam === 'CAN' && !h.unemployed && !h.natKeepAsk, 'keep both: national coach AND still at the club')

  const j = newGame('northampton', 'Grant Probe', 7112)
  ok(applyPinnacle(j, 'FIJ'), 'a second career takes Fiji')
  const oldClub = j.userClubId
  useStore.setState({ game: j, persist: async () => {} })
  useStore.getState().answerNatKeep(false)
  ok(j.natTeam === 'FIJ' && j.unemployed, 'resign the club: national coach, desk cleared')
  ok(j.vacancies.some(v => v.clubId === oldClub), 'and the old job is a real vacancy')
  ok(j.news.some(n => n.k === 'news.resigned'), 'with the resignation letter on file')
  ok(!j.natKeepAsk, 'and the question is closed either way')

  // AND HE CAN PICK AGAIN ONCE HE IS OUT OF IT (owner, v1.1.13: "take a job
  // and step down then you should then still have the pick a nation and take
  // offer available to you"). Once-per-career was a leftover from when this
  // placed a one-time OFFER; an appointment is a job, and resigning a job does
  // not use up the right to take another - least of all one already paid for.
  // This also retires the v1.1.12 migration that handed the call back to saves
  // stranded by an expired offer: there is no longer a flag to hand back.
  const { closeNatTenure } = await import('../src/game/model')
  g.natKeepAsk = g.natTeam
  closeNatTenure(g)
  ok(!g.natTeam, 'he steps down from the national job')
  // THE QUESTION GOES WITH THE JOB (owner, v1.1.13: "im no longer England
  // coach and this is showing"). natKeepAsk asks whether you carry on at the
  // club now that you have the country; it was only ever cleared by answering
  // it, so stepping down left the Manager Profile asking about a post that no
  // longer existed.
  ok(!g.natKeepAsk, 'and the club question goes with it, rather than outliving the job')
  ok(applyPinnacle(g, 'CAN'), 'and the federations are open to him again')
  ok(g.natTeam === 'CAN', `with a nation of his choosing (${g.natTeam})`)

  // being between CLUB jobs is no bar either - jobs.ts already treats a Test
  // post as standing that survives losing the club
  const jobless = newGame('northampton', 'Grant Probe', 7115)
  jobless.unemployed = true
  ok(applyPinnacle(jobless, 'FIJ'), 'a coach between club jobs can still take a Test job')
  ok(jobless.natTeam === 'FIJ' && !jobless.natKeepAsk,
    'and is asked nothing about a club he does not have')
}


// ---- THE CHARTER LIFTS BOTH CEILINGS ---------------------------------------
//
// A club has TWO wage limits: the league's salary cap and its own weekly wage
// budget. The Charter lifted the first and left the second standing, so an
// owner who paid 9.99 for "No salary cap, for the save that signs it" walked
// to the negotiating table and was told his WAGE BUDGET would break - true,
// and not what he bought. Reported 29 Aug 2026 with the screenshot.
{
  const g = newGame('northampton', 'Charter', 5)
  const club = g.clubs[g.userClubId]
  const cap = () => userCap(g, club.id, g.caps?.[club.leagueId] ?? null)
  ok(typeof cap() === 'number' && (cap() ?? 0) > 0, `a capped league starts capped (${cap()})`)
  ok(Number.isFinite(userWageBudget(g, club)), 'and the wage budget is a real number')
  g.uncapped = true
  ok(cap() === null, 'the Charter lifts the salary cap')
  ok(!Number.isFinite(userWageBudget(g, club)),
    'AND the wage budget, which is the ceiling the negotiating table actually quotes')
  const rival = Object.values(g.clubs).find(c => c.id !== g.userClubId)!
  ok(Number.isFinite(userWageBudget(g, rival)), 'while every other club keeps its budget')
}

if (fails) { console.error(`\nGRANT PROBE FAILED (${fails})`); process.exit(1) }
console.log('\nGRANT PROBE PASSED: every purchase pays the tin, and only the tin')
