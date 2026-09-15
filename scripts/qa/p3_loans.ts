// Probe: loans vs the salary cap, loan-out then sold, pre-contract + loan-in, loanee contract expiry
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { loanIn, loanTargets, loanOut, loanTerms } from '../../src/game/loans'
import { capPosition } from '../../src/game/cap'
import { agreePreContract, respondToOffer, capBill } from '../../src/game/ai'
import { fmtMoney, fmtWage, SEASON_WEEKS } from '../../src/game/model'

function run(seed: number) {
  const g = newGame('bath', 'Loans', seed)
  const uc = g.clubs[g.userClubId]
  const pos0 = capPosition(g, g.userClubId)
  console.log(`\nseed ${seed}: cap ${fmtWage(pos0.cap ?? 0)} bill ${fmtWage(pos0.bill)} headroom ${fmtWage(pos0.headroom)} balance ${fmtMoney(uc.balance)}`)
  // loan in as many as the shop window allows at full wages (parent nearly always says yes)
  let took = 0, wagesIn = 0
  for (let attempt = 0; attempt < 12; attempt++) {
    const t = loanTargets(g).find(p => loanTerms(g, p.id, 'season', 1).ok)
    if (!t) break
    const msg = loanIn(g, t.id, 'season', 1)
    if (msg.includes('joins') || g.players[t.id].clubId === g.userClubId) { took++; wagesIn += t.wage }
  }
  const pos1 = capPosition(g, g.userClubId)
  console.log(`  loaned in ${took} men (${fmtWage(wagesIn)}/wk): cap bill now ${fmtWage(pos1.bill)} vs cap ${fmtWage(pos1.cap ?? 0)} -> over? ${pos1.over} by ${fmtWage(-pos1.headroom)}`)
  // run to the end of the season and watch the audit
  const conf0 = uc.boardConfidence
  const bal0 = uc.balance
  while (g.season === 0) processWeekAndAdvance(g)
  const fine = g.news.find(n => n.k === 'news.capFine' || n.k === 'news.capEmbargo')
  console.log(`  season end: capBreaches=${uc.capBreaches ?? 0} embargoUntil=${uc.capEmbargoUntil} fine news: ${fine ? fine.subject + ' | ' + (fine.v?.fine ?? '') : 'none'}; board ${conf0.toFixed(0)}->${uc.boardConfidence.toFixed(0)}`)
  const stillLoan = uc.players.map(id => g.players[id]).filter(p => p?.loanFrom).length
  console.log(`  loanees still on roster after rollover: ${stillLoan}`)
  return g
}
run(4242)
run(777)

// ---- loan-out then accept a bid for him ----
{
  const g = newGame('leicester', 'LoanOut', 4242)
  const uc = g.clubs[g.userClubId]
  const kid = uc.players.map(id => g.players[id]).filter(p => p && !p.acad && p.age <= 23 && !uc.tactic.lineup.slice(0, 15).includes(p.id)).sort((a, b) => b.ca - a.ca)[0]
  console.log(`\nloan-out candidate ${kid.name} (${kid.age}, ca ${kid.ca})`)
  console.log('  loanOut:', loanOut(g, kid.id).ok)
  // an AI bid lands for him: mimic aiTransfers' offer shape exactly
  const bidder = Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId !== uc.leagueId)!
  g.offers.push({ id: g.nextId++, playerId: kid.id, fromClubId: bidder.id, toClubId: uc.id, fee: kid.value, week: g.week, forUser: true, status: 'pending' })
  console.log('  accept:', respondToOffer(g, g.offers[g.offers.length - 1].id, true))
  console.log(`  now clubId=${kid.clubId} onLoan=${kid.onLoan} loanClub=${kid.loanClub} inBidderRoster=${bidder.players.includes(kid.id)}`)
  // does the flag ever clear for him? run a season
  while (g.season === 0) processWeekAndAdvance(g)
  console.log(`  after rollover: clubId=${kid.clubId} onLoan=${kid.onLoan} apps this season so far ${kid.stats.apps}`)
  for (let i = 0; i < 20; i++) processWeekAndAdvance(g)
  console.log(`  20 weeks into season 2: onLoan=${kid.onLoan} apps=${kid.stats.apps} in ${bidder.short}'s XV? ${bidder.tactic.lineup.includes(kid.id)}`)
}

// ---- pre-contract, then loan the same man in ----
{
  const g = newGame('bath', 'PreLoan', 4242)
  while (g.week < 25) processWeekAndAdvance(g)
  const uc = g.clubs[g.userClubId]
  // a loan target whose deal expires this season
  const cand = loanTargets(g).find(p => p.contractEnds <= g.season && loanTerms(g, p.id, 'season', 1).ok)
  if (!cand) console.log('\npre+loan: no candidate this seed')
  else {
    console.log(`\npre+loan: ${cand.name} at ${cand.clubId}, ends ${cand.contractEnds} (season ${g.season})`)
    console.log('  agreePreContract:', agreePreContract(g, cand.id))
    console.log('  loanIn:', loanIn(g, cand.id, 'season', 1))
    console.log(`  preContracts has him: ${(g.preContracts ?? []).some(pc => pc.playerId === cand.id)}; clubId=${cand.clubId} loanFrom=${cand.loanFrom}`)
    while (g.season === 0) processWeekAndAdvance(g)
    console.log(`  after rollover: clubId=${cand.clubId} loanFrom=${cand.loanFrom} contractEnds=${cand.contractEnds} at user? ${uc.players.includes(cand.id)}; rosters holding him: ${Object.values(g.clubs).filter(c => c.players.includes(cand.id)).map(c => c.id).join(',')}`)
    console.log('  news about him:', g.news.filter(n => n.playerId === cand.id || (n.v && String(n.v.names ?? '').includes(cand.name))).map(n => n.subject).join(' | '))
  }
}
