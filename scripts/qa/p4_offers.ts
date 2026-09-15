// Probe: offer integrity - double accept, release-then-accept, offer for a man no longer yours, war ceilings, negative balance buys
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance } from '../../src/game/season'
import { respondToOffer, counterIncomingOffer, agreeFee, signOnTerms, personalTermsDemand, askingPrice, signFreeAgent } from '../../src/game/ai'
import { releasePlayer, releaseBlock } from '../../src/game/release'
import { fmtMoney } from '../../src/game/model'

const mkOffer = (g: any, pid: number, fee: number) => {
  const uc = g.clubs[g.userClubId]
  const bidder = Object.values(g.clubs).find((c: any) => c.id !== g.userClubId && c.leagueId !== uc.leagueId) as any
  const o = { id: g.nextId++, playerId: pid, fromClubId: bidder.id, toClubId: uc.id, fee, week: g.week, forUser: true, status: 'pending' as const }
  g.offers.push(o)
  return { o, bidder }
}

// 1. double accept
{
  const g = newGame('leicester', 'Offers', 4242)
  const uc = g.clubs[g.userClubId]
  const p = uc.players.map(id => g.players[id]).filter(x => !x.acad).sort((a, b) => b.value - a.value)[3]
  const { o, bidder } = mkOffer(g, p.id, 2_000_000)
  const b0 = uc.balance, t0 = uc.budget, bb0 = bidder.balance
  console.log('1 accept #1:', respondToOffer(g, o.id, true))
  console.log('1 accept #2:', respondToOffer(g, o.id, true))
  console.log(`  balance +${fmtMoney(uc.balance - b0)} budget +${fmtMoney(uc.budget - t0)} bidder -${fmtMoney(bb0 - bidder.balance)}; rosters holding him: ${Object.values(g.clubs).filter(c => c.players.includes(p.id)).map(c => c.id)}`)
}

// 2. release the man while a bid is pending, then accept the bid
{
  const g = newGame('leicester', 'Offers', 4242)
  const uc = g.clubs[g.userClubId]
  uc.balance += 20_000_000
  const p = uc.players.map(id => g.players[id]).filter(x => !x.acad && !releaseBlock(g, x.id)).sort((a, b) => b.value - a.value)[5]
  const { o, bidder } = mkOffer(g, p.id, 3_000_000)
  const b0 = uc.balance, bb0 = bidder.balance, tb0 = bidder.budget
  const rel = releasePlayer(g, p.id)
  console.log(`2 release ${p.name}: ${rel.ok} cost ${rel.v.cost}; clubId now ${p.clubId}; pending offers for him still: ${g.offers.filter(x => x.playerId === p.id && x.status === 'pending').length}`)
  console.log('2 accept:', respondToOffer(g, o.id, true))
  console.log(`  user balance delta ${fmtMoney(uc.balance - b0)} (release cost then 'sale'); bidder balance delta ${fmtMoney(bidder.balance - bb0)} budget delta ${fmtMoney(bidder.budget - tb0)}; player clubId ${p.clubId}; money vanished from the world: ${fmtMoney(-(uc.balance - b0) - (bb0 - bidder.balance) - Number(String(rel.v.cost).replace(/[^0-9]/g, '')) * 0)}`)
}

// 3. counter then accept; max fee vs value from a war (measure over seasons of listing everyone)
{
  const g = newGame('leicester', 'Offers', 4242)
  let maxRatio = 0, maxDesc = ''
  let ratios: number[] = []
  for (let s = 0; s < 3; s++) {
    while (g.season === s) {
      for (const o of g.offers) {
        if (o.status !== 'pending' || !o.forUser) continue
        const p = g.players[o.playerId]
        if (!p) continue
        // hold every bid to the third raise, then demand more, then accept
        if ((o.raises ?? 0) < 3 && g.week - o.week < 2 && !(g.week === 7 || g.week === 27)) continue
        if (!o.countered) counterIncomingOffer(g, o.id)
        if (o.status !== 'pending') continue
        const ratio = o.fee / p.value
        ratios.push(ratio)
        if (ratio > maxRatio) { maxRatio = ratio; maxDesc = `${p.name} value ${fmtMoney(p.value)} fee ${fmtMoney(o.fee)} raises ${o.raises ?? 0} countered ${o.countered}` }
        respondToOffer(g, o.id, false) // keep the squad so bids keep coming
      }
      processWeekAndAdvance(g)
    }
  }
  ratios.sort((a, b) => a - b)
  console.log(`3 bids seen ${ratios.length}: median fee/value ${ratios[Math.floor(ratios.length / 2)]?.toFixed(2)}, p90 ${ratios[Math.floor(ratios.length * 0.9)]?.toFixed(2)}, max ${maxRatio.toFixed(2)} (${maxDesc})`)
}

// 4. buying with budget but no cash: does balance go negative with no floor?
{
  const g = newGame('bath', 'Offers', 4242)
  const uc = g.clubs[g.userClubId]
  uc.balance = 100_000
  uc.budget = 15_000_000
  const t = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.loanFrom && askingPrice(g, p) <= 6_000_000 && (g.players[p.id].joinedAt == null)).sort((a, b) => b.value - a.value)[0]
  const fee = askingPrice(g, t)
  const a = agreeFee(g, t.id, fee)
  const s = a.ok ? signOnTerms(g, t.id, fee, personalTermsDemand(g, t) * 2, 0, false) : { ok: false, msg: a.msg }
  console.log(`4 balance £100k, budget £15m, buy ${t.name} for ${fmtMoney(fee)}: agree=${a.ok} sign=${s.ok} -> balance ${fmtMoney(uc.balance)} budget ${fmtMoney(uc.budget)} | ${s.msg.slice(0, 80)}`)
  // sign-on bonus: charged where?
  const t2 = Object.values(g.players).filter(p => p.clubId && p.clubId !== g.userClubId && !p.loanFrom && askingPrice(g, p) <= 2_000_000 && p.joinedAt == null).sort((a, b) => b.value - a.value)[0]
  const fee2 = askingPrice(g, t2)
  const bal = uc.balance, bud = uc.budget
  const a2 = agreeFee(g, t2.id, fee2)
  const s2 = a2.ok ? signOnTerms(g, t2.id, fee2, personalTermsDemand(g, t2), 3_000_000, false) : { ok: false, msg: a2.msg }
  console.log(`4b sign-on £3m + fee ${fmtMoney(fee2)}: ok=${s2.ok}; balance delta ${fmtMoney(uc.balance - bal)} budget delta ${fmtMoney(uc.budget - bud)}`)
}

// 5. squad size ceiling on signings? sign every free agent in the world with the Charter on
{
  const g = newGame('leicester', 'Offers', 4242)
  g.uncapped = true
  const uc = g.clubs[g.userClubId]
  const n0 = uc.players.length
  const fas = Object.values(g.players).filter(p => !p.clubId)
  let signed = 0
  for (const p of fas) { if (signFreeAgent(g, p.id).ok) signed++ }
  console.log(`5 free agents in world ${fas.length}; signed ${signed}; squad ${n0} -> ${uc.players.length}; any retiring among signed? ${fas.filter(p => p.clubId === g.userClubId && p.retiring).length}; oldest signed ${Math.max(...fas.filter(p => p.clubId === g.userClubId).map(p => p.age))}`)
  processWeekAndAdvance(g)
  console.log(`   a week later: week ${g.week}, squad ${uc.players.length}, balance ${fmtMoney(uc.balance)}`)
}
