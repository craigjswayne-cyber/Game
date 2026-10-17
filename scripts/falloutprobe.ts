/**
 * ---- WHAT THE ROOM MAKES OF A BID ANSWERED (fallout.ts) ----
 *
 * Owner: "If a player is unhappy and an offer comes in, if it's rejected it
 * should really cause issues to the player and squad. If a popular player is
 * sold that should also impact the squad morale." And, from a screenshot of a
 * bid story with nothing on it but the player's card: the story needs a way to
 * answer it. What this holds:
 *
 *   1. KEPT AGAINST HIS WILL. Turning down a bid for an unhappy man costs him
 *      at least a point of morale, files a story that says so, and, when the
 *      room follows him, lowers the squad's mood too.
 *   2. A REQUEST. An unhappy man with no request in hands one in, and it is
 *      answerable from the story; a man who had asked has his answer recorded.
 *   3. A CONTENT MAN is not punished: he hears he is wanted, and the room is
 *      untouched.
 *   4. SELLING THE CAPTAIN lowers the squad's mood by about a defeat's worth;
 *      selling a fringe man barely moves it; selling a captain who wanted out
 *      costs less than selling one who did not.
 *   5. AN AI SALE TOUCHES NOTHING: the world's balance is not this file's.
 *   6. NO DRAWS: Math.random is never called, and the same calls on the same
 *      save give the same squad, number for number.
 *   7. THE STORY'S BUTTON is there while the bid is open and gone once it has
 *      been answered.
 *
 * Run: npx vite-node scripts/falloutprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { executeTransfer, openBidFor, respondToOffer } from '../src/game/ai'
import { canAnswerRequest } from '../src/game/chats'
import { BLOCKED_HIT, SOLD_ROOM } from '../src/game/fallout'
import { seniorVoices } from '../src/game/bonds'
import type { GameState, NewsItem, Player } from '../src/game/model'
import { ok, done } from './lib/probe'

const seniors = (g: GameState, clubId = g.userClubId) =>
  g.clubs[clubId].players.map(id => g.players[id]).filter((p): p is Player => !!p && !p.acad && !p.onLoan)
/** The squad's mood without him: the average the room is left with. */
const mood = (g: GameState, without: number, clubId = g.userClubId) => {
  const xs = seniors(g, clubId).filter(p => p.id !== without)
  return xs.reduce((s, p) => s + p.morale, 0) / xs.length
}
const rival = (g: GameState) => Object.values(g.clubs).find(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)!
/** Everyone at a level mood, so a change is the change under test. */
const level = (g: GameState, m = 6.5) => { for (const p of seniors(g)) { p.morale = m; p.wantsOut = 0; p.reqAns = 0; p.transferListed = false } }
const bid = (g: GameState, p: Player) => {
  const id = g.nextId++
  g.offers.push({ id, playerId: p.id, fromClubId: rival(g).id, toClubId: g.userClubId, fee: Math.round(p.value * 1.1), week: g.week, forUser: true, status: 'pending' })
  return id
}
/** A man nobody follows: not an armband, not a voice, under 27. */
const ordinary = (g: GameState) => {
  const c = g.clubs[g.userClubId]
  const voices = seniorVoices(g).map(v => v.id)
  return seniors(g).find(p => p.id !== c.captain && p.id !== c.vice && p.age < 27 && !voices.includes(p.id))!
}
const filed = (g: GameState, k: string, pid: number) => g.news.some(n => n.k === k && n.playerId === pid)

// ---- 1 and 2. kept against his will ----
{
  const g = newGame('northampton', 'Fallout', 901)
  level(g)
  const c = g.clubs[g.userClubId]
  const cap = g.players[c.captain!]
  cap.morale = 3.5
  const before = mood(g, cap.id)
  const was = cap.morale
  const line = respondToOffer(g, bid(g, cap), false)
  ok(was - cap.morale >= 1, `an unhappy captain kept against his will loses at least a point (${was} -> ${cap.morale.toFixed(2)})`)
  const after = mood(g, cap.id)
  ok(after < before - 0.15, `and the room's mood falls with his (${before.toFixed(2)} -> ${after.toFixed(2)})`)
  ok(after > before - 0.5, `but by less than a defeat would (${(before - after).toFixed(2)})`)
  ok((cap.wantsOut ?? 0) > 0 && canAnswerRequest(g, cap), 'he hands in a transfer request, and it can be answered')
  ok(filed(g, 'news.bidBlockedRequestRoom', cap.id), 'the story says so, room and all')
  ok(/request/i.test(line), `the manager is told on the spot: "${line}"`)

  // an unhappy man nobody follows: his morale, not the room's
  const o = ordinary(g)
  level(g)
  o.morale = 4
  const b2 = mood(g, o.id)
  respondToOffer(g, bid(g, o), false)
  ok(o.morale <= 4 - BLOCKED_HIT * 0.8 + 1e-9, `an unhappy squad man takes the hit too (${o.morale.toFixed(2)})`)
  ok(Math.abs(mood(g, o.id) - b2) < 1e-9, 'and the room does not follow a man it does not follow')

  // a man who had already asked: the refusal is the answer
  const q = seniors(g).find(p => p.id !== o.id && p.id !== cap.id && p.id !== c.vice)!
  level(g)
  q.wantsOut = g.week
  respondToOffer(g, bid(g, q), false)
  ok((q.reqAns ?? 0) > 0 && !canAnswerRequest(g, q), 'turning down a bid for a man who asked to go answers his letter')
  ok(q.morale < 6.5 - 1, `and costs him (${q.morale.toFixed(2)})`)
}

// ---- 3. a content man ----
{
  const g = newGame('northampton', 'Fallout', 902)
  level(g, 7)
  const p = ordinary(g)
  p.pers = 'Professional'
  const before = mood(g, p.id)
  const line = respondToOffer(g, bid(g, p), false)
  ok(p.morale >= 7, `a content man is not punished for being kept (${p.morale.toFixed(2)})`)
  ok(Math.abs(mood(g, p.id) - before) < 1e-9, 'and the room is untouched')
  ok(!g.news.some(n => n.k?.startsWith('news.bidBlocked')), 'and no story says he is unhappy')
  console.log(`        "${line}"`)
}

// ---- 4. sales ----
const sell = (seed: number, setup: (g: GameState) => Player) => {
  const g = newGame('northampton', 'Fallout', seed)
  level(g)
  const p = setup(g)
  const before = mood(g, p.id)
  executeTransfer(g, p, rival(g).id, p.value)
  return { g, p, drop: before - mood(g, p.id) }
}
{
  const cap = sell(903, g => g.players[g.clubs[g.userClubId].captain!])
  ok(cap.drop >= SOLD_ROOM * 0.9, `selling a content captain lowers the room by about a defeat (${cap.drop.toFixed(2)})`)
  ok(cap.drop <= SOLD_ROOM + 0.01, 'and no more')
  ok(cap.g.news.some(n => n.k === 'news.saleFeltCaptain'), 'the story says the room felt it')

  const fringe = sell(903, g => { const p = ordinary(g); p.status = 'fringe'; return p })
  ok(fringe.drop < 0.02, `selling a fringe man barely moves it (${fringe.drop.toFixed(3)})`)
  ok(!fringe.g.news.some(n => n.k?.startsWith('news.saleFelt')), 'and nothing is said')

  const plain = sell(903, g => ordinary(g))
  ok(plain.drop < 0.02, `selling a man nobody follows barely moves it (${plain.drop.toFixed(3)})`)

  const wanted = sell(903, g => { const p = g.players[g.clubs[g.userClubId].captain!]; p.morale = 3.5; return p })
  ok(wanted.drop > 0 && wanted.drop < cap.drop * 0.5, `a captain who wanted out costs less (${wanted.drop.toFixed(2)} against ${cap.drop.toFixed(2)})`)
  ok(wanted.g.news.some(n => n.k === 'news.saleFeltWanted'), 'and the story says the move was wanted')
}

// ---- 5. an AI sale ----
{
  const g = newGame('northampton', 'Fallout', 904)
  const ai = Object.values(g.clubs).filter(c => c.id !== g.userClubId && c.leagueId === g.clubs[g.userClubId].leagueId)
  const [a, b] = [ai[0], ai[1]]
  const cap = g.players[a.captain ?? a.players[0]]
  const snap = new Map(seniors(g, a.id).map(p => [p.id, p.morale]))
  executeTransfer(g, cap, b.id, cap.value)
  ok(seniors(g, a.id).every(p => snap.get(p.id) === p.morale), 'an AI club selling its captain leaves its own room as it was')
  ok(!g.news.some(n => n.k?.startsWith('news.saleFelt')), 'and files nothing in the manager\'s inbox')
}

// ---- 6. no draws ----
{
  const run = () => {
    const g = newGame('northampton', 'Fallout', 905)
    level(g)
    const c = g.clubs[g.userClubId]
    const cap = g.players[c.captain!]
    cap.morale = 3
    const real = Math.random
    let drawn = 0
    Math.random = () => { drawn++; return real() }
    try {
      respondToOffer(g, bid(g, cap), false)
      executeTransfer(g, cap, rival(g).id, cap.value)
    } finally { Math.random = real }
    return { drawn, squad: seniors(g).map(p => p.morale).join(',') }
  }
  const x = run(), y = run()
  ok(x.drawn === 0, 'no Math.random draws')
  ok(x.squad === y.squad, 'the same calls on the same save give the same squad')
}

// ---- 7. the story's button ----
{
  const g = newGame('northampton', 'Fallout', 906)
  const p = ordinary(g)
  const id = bid(g, p)
  const story: NewsItem = { id: g.nextId++, week: g.week, season: g.season, type: 'transfer', read: false, subject: '', body: '', k: 'news.huntBid', v: {}, playerId: p.id, offerId: id }
  const old: NewsItem = { ...story, k: 'news.bidIn_f', offerId: undefined }
  const other: NewsItem = { ...story, k: 'news.transferRequest' }
  ok(openBidFor(g, story)?.id === id, 'a bid story finds its open bid')
  ok(openBidFor(g, old)?.id === id, 'a story from an older save finds it by the player')
  ok(!openBidFor(g, other), 'a story that is not a bid has no button')
  respondToOffer(g, id, false)
  ok(!openBidFor(g, story) && !openBidFor(g, old), 'and once it is answered the button has gone')
  const id2 = bid(g, p)
  g.offers.find(o => o.id === id2)!.status = 'rejected' // lapsed (ai.ts expires stale bids this way)
  ok(!openBidFor(g, { ...story, offerId: id2 }), 'a lapsed bid has no button either')
}

done('FALLOUT PROBE', 'a bid answered is felt where it should be', { exit: true, blank: false })
