// Probe: the bidding war climbs, changes hands, and knows when to stop.
//
// From the competitor assessment: Sweet Nitro's "live bidding" is a
// monetisation loop, but the kernel - holding an offer while the price
// climbs - is real drama. The single-player version: a pending bid for one
// of the user's players can be topped by a rival before it is answered.
//
//   the raise is real: at least 8 percent on top, from a different club
//   the ousted bidder is ousted: the offer changes hands
//   a fresh bidder can be haggled once (countered resets)
//   and the war ENDS: three raises, then the market is done bidding -
//     without the cap an unanswered offer inflates forever
import { newGame } from '../src/game/newgame'
import { aiTransfers } from '../src/game/ai'
import { mulberry32 } from '../src/game/rng'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const g: GameState = newGame('northampton', 'Auction', 55)
const club = g.clubs[g.userClubId]
const star = club.players.map(id => g.players[id]).filter(p => p && !p.acad).sort((a, b) => b.ca - a.ca)[0]
const firstBidder = Object.values(g.clubs).find(c => c.id !== club.id && c.rep >= club.rep - 5)!

g.week = 3
g.offers.push({
  id: g.nextId++, playerId: star.id, fromClubId: firstBidder.id, toClubId: club.id,
  fee: Math.round(star.value * 1.1 / 10_000) * 10_000, week: 2, forUser: true, status: 'pending',
})
const opening = g.offers[0].fee
console.log(`staged: ${firstBidder.short} bid ${opening.toLocaleString()} for ${star.name} (value ${star.value.toLocaleString()})`)

// An offer gets one war roll before it goes stale (offers expire at two weeks;
// a raise renews the clock), so stage a fresh offer per attempt until one
// draws a rival - the 30 percent chance means a handful of tries at most.
let raised = 0
let lastBidder = firstBidder.id
for (let attempt = 0; attempt < 60 && raised === 0; attempt++) {
  g.offers = g.offers.filter(x => x.playerId !== star.id)
  g.week = 3
  g.offers.push({
    id: g.nextId++, playerId: star.id, fromClubId: firstBidder.id, toClubId: club.id,
    fee: opening, week: 2, forUser: true, status: 'pending',
  })
  aiTransfers(g, mulberry32(1000 + attempt))
  const o = g.offers.find(x => x.playerId === star.id && x.status === 'pending')
  if (o && (o.raises ?? 0) > 0) {
    raised = o.raises ?? 0
    ok(o.fee >= Math.round(opening * 1.08 / 10_000) * 10_000, `the raise is real: ${opening.toLocaleString()} to ${o.fee.toLocaleString()}`)
    ok(o.fromClubId !== lastBidder, `and the offer changed hands (${g.clubs[o.fromClubId]?.short} in)`)
    ok(o.countered === false, 'the fresh bidder can be haggled once')
    ok(g.news.some(n => n.subject.includes('Bidding war')), 'the war makes the news')
  }
}
ok(raised > 0, 'a pending offer eventually draws a rival')

// let it run long: the war must stop at three raises
{
  const o = g.offers.find(x => x.playerId === star.id && x.status === 'pending')
  if (o) {
    for (let wk = 0; wk < 80; wk++) {
      g.week += 1
      aiTransfers(g, mulberry32(9000 + wk))
      const cur = g.offers.find(x => x.playerId === star.id && x.status === 'pending')
      if (!cur) break
    }
    const cur = g.offers.find(x => x.playerId === star.id)
    ok((cur?.raises ?? 0) <= 3, `the market is done at three raises (${cur?.raises ?? 0})`)
  }
}

if (fails) { console.error(`\nAUCTION PROBE: ${fails} failures`); process.exit(1) }
console.log('\nAUCTION PROBE PASSED: hold your nerve and the price climbs, but not forever')
