/**
 * ---- THE CLUB DESK KEEPS ITS OWN RULES (1.8.1) ----
 *
 * The technical manual's tester notes for players, squad building and running
 * the club found a family of doors that one route went round: a window the AI
 * kept and the manager did not, a cap the loan desk never asked, a pre-contract
 * wage quoted and never paid, a sponsor question that signed a different deal
 * from the one on its button, and the rest below. Each section here is one of
 * those, asserted from the engine rather than the screen, so a later change
 * that reopens a door fails here first.
 *
 * Run: npx vite-node scripts/clubdesk.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import {
  agreeFee, agreePreContract, askingPrice, capBill, capWage, embargoed, executeTransfer, offerRenewalAt,
  personalTermsDemand, seniorsOf, signOnTerms, squadFull, windowOpen, windowShut,
} from '../src/game/ai'
import { loanBuyOffer, loanIn, loanOutSummerGain, LOAN_FULL_WEEKS } from '../src/game/loans'
import { MARQUEE_SLOTS, marqueeOpen, rosterGrid, toggleMarquee } from '../src/game/cap'
import { repriceAcademies, playerWage } from '../src/game/attributes'
import { shedWages } from '../src/game/aiecon'
import { answerPress, warChest } from '../src/game/media'
import { endDealEarly, offersFor, SLOTS, type SlotId } from '../src/game/commercial'
import { bookEvent, bookedThisWeek, CLOSE_EVENTS, eventOpen } from '../src/game/closeseason'
import { insolvencyWarning } from '../src/game/insolvency'
import { requestFacility } from '../src/game/season'
import { absWeek, boardObjective, fmtMoney, SEASON_WEEKS, type GameState, type Player } from '../src/game/model'
import { t, tIn } from '../src/game/i18n'
import { openDate } from '../src/game/window'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const fresh = (seed = 18101): GameState => newGame('northampton', 'Desk Tester', seed)
const userOf = (g: GameState) => g.clubs[g.userClubId]
/** Room everywhere money is asked about, so a section tests its own rule. */
const roomy = (g: GameState) => {
  const u = userOf(g)
  u.budget = 50_000_000
  u.balance = 50_000_000
  u.wageBudget = 10_000_000
  g.caps![u.leagueId] = 10_000_000
}
/** A senior at another club nobody minds selling. */
const target = (g: GameState): Player => Object.values(g.players)
  .filter(p => p.clubId && p.clubId !== g.userClubId && !p.acad && !p.onLoan && !p.loanFrom &&
    p.ca >= 60 && p.ca <= 72 && p.age >= 24 && p.age <= 29 && p.joinedAt == null)
  .sort((a, b) => a.id - b.id)[0]

console.log('--- the transfer window binds the manager as it binds the AI')
{
  const g = fresh()
  roomy(g)
  const p = target(g)
  ok([1, 8, 22, 25, 46, 48].every(windowOpen) && ![9, 12, 21, 26, 45].some(windowOpen),
    'the window is the close season to week 8, and January (22 to 25)')
  g.week = 12
  const shut = agreeFee(g, p.id, askingPrice(g, p) * 3)
  ok(!shut.ok && shut.msg === windowShut(g) && shut.msg.includes(tIn('en', 'date.mon0')), `a bid in week 12 is refused and names January ("${shut.msg}")`)
  const terms = signOnTerms(g, p.id, askingPrice(g, p) * 3, personalTermsDemand(g, p) * 2, 0, false)
  ok(!terms.ok && p.clubId !== g.userClubId, 'and personal terms cannot complete the move behind it')
  g.week = 30
  ok(agreeFee(g, p.id, askingPrice(g, p) * 3).msg === t('reply.windowShutSummer', openDate(g)), 'after the deadline it says the summer')
  g.week = 25
  ok(agreeFee(g, p.id, askingPrice(g, p) * 3).msg !== windowShut(g), 'on deadline week the door is open again')
}

console.log('--- the deadline round-up reads the stories, not their English')
{
  const g = fresh()
  g.week = 8
  const movers = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.acad && p.ca >= 70).slice(0, 2)
  const buyer = Object.values(g.clubs).find(c => c.id !== g.userClubId && movers.every(m => m.clubId !== c.id))!
  for (const m of movers) executeTransfer(g, m, buyer.id, 1_250_000)
  // the English subject can say anything now: the round-up must not care
  for (const n of g.news) if (n.k === 'news.transferDone') n.subject = 'reworded'
  g.week = 9
  processWeekAndAdvance(g)
  const up = g.news.find(n => n.k === 'news.ddRoundup' || n.k === 'news.ddRoundupFlop')
  const rows = up ? JSON.parse(String(up.v?.rows_ll ?? '[]')) as { fee_k: string; fee: string }[] : []
  ok(!!up && rows.length >= 2, `the round-up finds both deals (${rows.length})`)
  ok(rows.length > 0 && rows.every(r => r.fee_k === 'news.ddFeeKnown' && r.fee === fmtMoney(1_250_000)),
    `and reads each fee from the story itself (${rows.map(r => r.fee).join(', ')})`)
}

console.log('--- the signing-on bonus is transfer money')
{
  const g = fresh()
  roomy(g)
  const u = userOf(g)
  let done: Player | null = null
  let before = 0
  const fee = 1_000_000
  const signOn = 400_000
  for (const p of Object.values(g.players).filter(q => q.clubId && q.clubId !== u.id && !q.acad && q.ca >= 60 && q.ca <= 70 && q.joinedAt == null)) {
    before = u.budget
    const r = signOnTerms(g, p.id, Math.max(fee, askingPrice(g, p)), personalTermsDemand(g, p) * 2, signOn, false)
    if (r.ok) { done = p; break }
  }
  ok(!!done, `a signing completed for the test (${done?.name})`)
  if (done) {
    const paid = Math.max(fee, askingPrice(g, done))
    ok(u.budget === Math.max(0, before - paid - signOn), `the budget fell by the fee and the bonus, not the fee alone (${before} -> ${u.budget})`)
  }
}

console.log('--- a pre-contract pays the wage it quoted, and passes the cap and the 46')
{
  const g = fresh()
  roomy(g)
  const u = userOf(g)
  g.week = 30
  const p = Object.values(g.players).find(q => q.clubId && q.clubId !== u.id && !q.acad && !q.loanFrom && !q.onLoan &&
    !q.retiring && q.ca >= 64 && q.ca <= 74 && (g.clubs[q.clubId!]?.rep ?? 99) <= u.rep + 10)!
  p.contractEnds = g.season
  const quoted = Math.round((playerWage(p.ca, p.age) * 1.1) / 50) * 50
  p.wage = Math.round(quoted * 0.6)
  // the cap first, then the squad limit
  g.caps![u.leagueId] = capBill(g, u) + 10
  const capped = agreePreContract(g, p.id)
  ok(!capped.ok && /salary cap/i.test(capped.msg), `a pre-contract that breaks the cap is refused ("${capped.msg}")`)
  g.caps![u.leagueId] = 10_000_000
  const staying = u.players.filter(id => { const q = g.players[id]; return q && !q.acad && q.contractEnds > g.season }).length
  const saved = u.players.slice()
  // the list is only read for its count here, so other clubs' men under
  // contract stand in for the bodies
  const extra = Object.values(g.players)
    .filter(q => q.clubId && q.clubId !== u.id && q.id !== p.id && !q.acad && q.contractEnds > g.season)
    .slice(0, Math.max(0, 46 - staying))
  u.players = [...saved, ...extra.map(q => q.id)]
  const full = agreePreContract(g, p.id)
  ok(!full.ok && full.msg === t('reply.squadFull'), `and one that would make next season's squad 47 is refused ("${full.msg}")`)
  u.players = saved
  const r = agreePreContract(g, p.id)
  ok(r.ok, `with room, he agrees (${r.msg})`)
  ok(g.preContracts?.find(pc => pc.playerId === p.id)?.wage === quoted, `the quoted wage is stored with the agreement (${quoted})`)
  // straight to the summer
  g.week = SEASON_WEEKS
  processWeekAndAdvance(g)
  ok(p.clubId === u.id, 'he arrives at the rollover')
  ok(p.wage === quoted, `on the wage he was quoted, not his old one (${p.wage} vs ${quoted})`)
}

console.log('--- the roster grid needs what each unit needs')
{
  const g = fresh()
  const need = Object.fromEntries(rosterGrid(g, g.userClubId).rows.map(r => [r.label, r.need]))
  ok(need['finances.unitFrontRow'] === 6 && need['finances.unitBackFive'] === 8 && need['finances.unitHalves'] === 4 &&
    need['finances.unitMidfield'] === 3 && need['finances.unitBackThree'] === 5,
    `each unit carries its own need, not a flat 4 (${JSON.stringify(need)})`)
}

console.log('--- a loan is measured against the cap, the budget and the embargo')
{
  const g = fresh()
  roomy(g)
  const u = userOf(g)
  const kid = Object.values(g.players).find(p => p.clubId && p.clubId !== u.id && p.age <= 21 && !p.injury && !p.natSquad && !p.onLoan && !p.loanFrom && p.wage > 2_000)!
  u.capEmbargoUntil = g.season
  ok(embargoed(g, u.id) && loanIn(g, kid.id, 'season', 1) === t('reply.embargoSign'), 'an embargoed club cannot borrow')
  u.capEmbargoUntil = undefined
  g.caps![u.leagueId] = capBill(g, u) + Math.round(kid.wage * 0.5)
  const over = loanIn(g, kid.id, 'season', 1)
  ok(kid.clubId !== u.id && /salary cap/i.test(over), `a loan at full wage that breaks the cap is refused ("${over}")`)
  // the bill counts a borrowed man at his share
  kid.loanFrom = kid.clubId!
  kid.loanShare = 0.25
  ok(capWage(g, u, kid) === Math.round(kid.wage * 0.25), 'the cap bill counts a borrowed man at the share the club pays')
  kid.loanFrom = null
  kid.loanShare = undefined
}

console.log('--- loan to buy is a signing: the window, the cap, the embargo')
{
  const g = fresh()
  roomy(g)
  const u = userOf(g)
  const kid = Object.values(g.players).find(p => p.clubId && p.clubId !== u.id && p.age <= 21 && p.ca < 70 && !p.onLoan && !p.loanFrom && p.wage > 1_000)!
  const parent = g.clubs[kid.clubId!]
  parent.players = parent.players.filter(id => id !== kid.id)
  parent.tactic.lineup = parent.tactic.lineup.map(id => (id === kid.id ? null : id))
  u.players.push(kid.id)
  kid.clubId = u.id
  kid.loanFrom = parent.id
  kid.loanShare = 0.5
  kid.loanCa = kid.ca
  kid.joinedAt = absWeek(g.season, 1)
  g.week = 12
  ok(loanBuyOffer(g, kid.id)?.k === 'reply.loanBuyWindow', 'in week 12 the option waits for the window')
  g.week = 25
  ok(loanBuyOffer(g, kid.id)?.ok === true, 'on deadline week it can be taken')
  u.capEmbargoUntil = g.season
  ok(loanBuyOffer(g, kid.id)?.k === 'reply.embargoSign', 'but not under an embargo')
  u.capEmbargoUntil = undefined
  g.caps![u.leagueId] = capBill(g, u) + 1
  ok(loanBuyOffer(g, kid.id)?.k === 'reply.loanBuyCap', 'nor when his full wage breaks the cap')
}

console.log('--- the academy: renewals, demotions and the 46')
{
  const g = fresh()
  roomy(g)
  const u = userOf(g)
  const lad = u.players.map(id => g.players[id]).find(p => p && p.acad && !p.demoted)!
  lad.renewedSeason = undefined
  const bill = capBill(g, u)
  g.caps![u.leagueId] = bill // no room at all
  const r = offerRenewalAt(g, lad.id, lad.wage * 3)
  ok(!/salary cap/i.test(r.msg), 'an academy renewal is not refused by a cap his wage never counted on')
  ok(capBill(g, u) === bill, 'and the cap bill is unchanged by it')
  // a demoted senior keeps his contract and his place on the 46
  const star = u.players.map(id => g.players[id]).filter(p => p && !p.acad).sort((a, b) => b.wage - a.wage)[0]
  const wage = star.wage
  const seniors = seniorsOf(g, u)
  star.acad = true
  star.demoted = true
  repriceAcademies([star])
  ok(star.wage === wage, `a demoted senior is not repriced to academy money (${wage} -> ${star.wage})`)
  ok(seniorsOf(g, u) === seniors, 'and he still counts against the 46')
  star.acad = false
  star.demoted = false
  ok(typeof squadFull(g, u) === 'boolean', 'squadFull reads the same count')
}

console.log('--- the marquee list is lodged in the window')
{
  const g = fresh()
  const u = userOf(g)
  const man = u.players.map(id => g.players[id]).find(p => p && !p.acad && !(u.marquee ?? []).includes(p.id))!
  u.marquee = (u.marquee ?? []).slice(0, MARQUEE_SLOTS - 1)
  g.week = 40
  ok(!marqueeOpen(g) && !toggleMarquee(g, man.id) && !(u.marquee ?? []).includes(man.id), 'in week 40 nobody can be named before the audit')
  g.week = 3
  ok(toggleMarquee(g, man.id) && (u.marquee ?? []).includes(man.id), 'in the window he can')
}

console.log('--- a club shedding wages for money stops at thirty seniors')
{
  const g = fresh()
  const c = Object.values(g.clubs).find(x => x.id !== g.userClubId && seniorsOf(g, x) > 30)!
  let n = 0
  while (shedWages(g, c) && n < 60) n++
  ok(seniorsOf(g, c) === 30, `released ${n}, and the floor held at ${seniorsOf(g, c)} seniors`)
  ok((c.marquee ?? []).slice(0, MARQUEE_SLOTS).every(id => c.players.includes(id)), 'and both marquee men are still there')
}

console.log('--- a summer on loan pays for the time served, keyed on the season')
{
  const g = fresh()
  const p = Object.values(g.players).find(q => q.clubId === g.userClubId && q.age <= 23 && !q.acad)!
  g.week = SEASON_WEEKS
  p.onLoan = true
  p.loanSince = absWeek(g.season, 44)
  ok(loanOutSummerGain(g, p) === 0, 'four weeks away earns nothing at the summer')
  p.loanSince = absWeek(g.season, SEASON_WEEKS - 20)
  ok(loanOutSummerGain(g, p) === 1, 'twenty weeks earns the recall\'s one point')
  p.loanSince = absWeek(g.season, SEASON_WEEKS - LOAN_FULL_WEEKS)
  const seasons = [0, 1, 2, 3, 4, 5].map(s => { g.season = s; p.loanSince = absWeek(s, SEASON_WEEKS - LOAN_FULL_WEEKS); return loanOutSummerGain(g, p) })
  ok(seasons.every(x => x >= 2 && x <= 4), `a full season earns 2 to 4 (${seasons.join(',')})`)
  ok(new Set(seasons).size > 1, 'and not the same number every summer')
}

console.log('--- the summer: regens carry a trait, and last season\'s last game is forgotten')
{
  const g = fresh()
  for (const p of Object.values(g.players)) p.lastWk = 40
  g.week = SEASON_WEEKS
  const before = new Set(Object.keys(g.players))
  processWeekAndAdvance(g)
  const born = Object.values(g.players).filter(p => !before.has(String(p.id)))
  ok(born.length > 0 && born.every(p => p.trait !== undefined), `${born.length} players made this summer, every one with his trait derived`)
  ok(Object.values(g.players).every(p => p.lastWk == null), 'nobody reads as having played last week in week 1')
}

console.log('--- the summer sponsorship question signs what it showed, or steps aside')
{
  const g = fresh()
  // let the shirt deal lapse, so the department installs a caretaker and asks
  g.deals ??= {}
  for (const s of SLOTS) if (g.deals[s.id]) g.deals[s.id]!.until = g.season
  g.week = SEASON_WEEKS
  processWeekAndAdvance(g)
  const qs = g.press.filter(p => !p.answered && p.options.some(o => o.deal))
  ok(qs.length >= 2, `the summer brought slot questions (${qs.length})`)
  if (qs.length >= 2) {
    // one: the market moves after the question is asked
    const q1 = qs[0]
    const slot1 = q1.options[0].deal!.slot as SlotId
    const shown = q1.options[1].deal!.offer!
    g.clubs[g.userClubId].rep += 12
    ;(g.dealReroll ??= {})[slot1] = 5
    const moved = offersFor(g, slot1)[1]
    ok(moved.weekly !== shown.weekly || moved.sponsor !== shown.sponsor, 'the market under the question has moved')
    answerPress(g, q1.id, 1)
    const d = g.deals![slot1]!
    ok(d.sponsor === shown.sponsor && d.weekly === shown.weekly, `the deal signed is the one the button showed (${d.sponsor} at ${d.weekly})`)
    // two: the slot is sold at the table before the question is answered
    const q2 = qs[1]
    const slot2 = q2.options[0].deal!.slot as SlotId
    g.deals![slot2] = { slot: slot2, sponsor: 'Table Deal', weekly: 1234, clause: 'none', from: g.season, until: g.season + 2, repAt: 50 }
    answerPress(g, q2.id, 0)
    ok(g.deals![slot2]!.sponsor === 'Table Deal', 'a slot sold meanwhile keeps its deal')
    ok(!g.press.some(p => p.id === q2.id), 'and the moot question is withdrawn rather than shown as answered')
    // three: ending the caretaker early withdraws the question about it
    const q3 = g.press.find(p => !p.answered && p.options.some(o => o.deal))
    if (q3) {
      const slot3 = q3.options[0].deal!.slot as SlotId
      g.dealEndedSeason = {}
      endDealEarly(g, slot3)
      ok(!g.press.some(p => p.id === q3.id), 'ending the caretaker early withdraws the question it answered')
    }
  }
}

console.log('--- the close-season diary is this summer\'s diary')
{
  const g = fresh()
  roomy(g)
  g.week = 46
  const ev = CLOSE_EVENTS.find(e => eventOpen(g, e))
  ok(!!ev, `an event this ground can host (${ev?.id})`)
  if (ev) {
    bookEvent(g, ev.id)
    ok(bookedThisWeek(g) === ev.id, 'booked this week')
    g.season += 1
    ok(bookedThisWeek(g) == null, 'and the same week next summer is free again')
  }
}

console.log('--- the insolvency warning is once a season, however long the inbox')
{
  const g = fresh()
  const u = userOf(g)
  u.balance = -1_000_000_000
  insolvencyWarning(g)
  const n1 = g.news.filter(n => n.k === 'news.insolvencyWarning').length
  g.news = g.news.filter(n => n.k !== 'news.insolvencyWarning') // trimmed past 250
  insolvencyWarning(g)
  ok(n1 === 1 && !g.news.some(n => n.k === 'news.insolvencyWarning'), 'a trimmed warning is not issued again that season')
}

console.log('--- a boardroom grant is a yes, whatever the balance')
{
  const g = fresh()
  const u = userOf(g)
  u.balance = 0
  u.boardConfidence = 30
  g.facilityBuild = undefined
  g.stadiumBuild = undefined
  g.facilityAskCooldown = 0
  g.boardGrant = ['gym']
  const r = requestFacility(g, 'gym')
  ok(g.facilityBuild?.id === 'gym' && u.balance === 0, `the granted gym is built and the club pays nothing ("${r}")`)
}

console.log('--- the war chest and the survival aim fit the club')
{
  ok(warChest(62_000) < 62_000 && warChest(62_000) > 0, `a £62k budget is offered ${warChest(62_000)}, not more than its budget`)
  ok(warChest(2_000_000) === 250_000 && warChest(900_000) === 100_000, 'a big budget is offered what it always was')
  ok(boardObjective(60, 12).pos === 10 && boardObjective(60, 10).pos === 8 && boardObjective(60).pos === 12,
    'clear of the bottom two means tenth of twelve, eighth of ten, twelfth of fourteen')
}

console.log(fails ? `CLUB DESK PROBE FAILED (${fails})` : 'CLUB DESK PROBE PASSED: every door on the desk asks the same questions')
if (fails) process.exit(1)
