/**
 * ---- THE OTHER CLUBS WANT THEM TOO (1.8.5) ----
 *
 * Holds the rival bids on the manager's targets (src/game/rivalbids.ts):
 *
 *   1. RATE. Across fresh worlds, a sensible share of agreed fees is contested:
 *      not none (the feature is dead) and not most (every signing a fight).
 *   2. ONLY REAL COMPETITION. With no AI club able to pay, or for a man who
 *      would start nowhere, nothing contests. Every contest that does open
 *      comes from a club that can pay the fee and that he would start for.
 *   3. THE CHOICE FOLLOWS THE STATED REASONS. More wage never loses a man the
 *      manager had won; a promise never hurts; a man who would start for the
 *      rival and sit on the manager's bench goes to the rival for the minutes,
 *      and is told so.
 *   4. THE MANAGER SEES IT. The agreed-fee reply names the club and the wage;
 *      a losing offer is told why and can be improved within the week; when
 *      the week ends the rival signs him and the news names who, what and why.
 *   5. DETERMINISTIC AND STREAM-SAFE. Same world, same answer; no draws on the
 *      shared rng (a season with contests opened leaves every match score as
 *      it was in the same season without them, up to the week they settle).
 *   6. SAVE-SAFE. Junk in the new fields is cleaned by migrate.
 *   7. THE OTHER TWO DOORS. A title backs at most three rivals, by a bounded
 *      sum, and says so; a star left in the free-agent pool is signed by a
 *      club he would start for, not left for the manager alone.
 *
 * Run: npx vite-node scripts/rivalbidprobe.ts
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { agreeFee, askingPrice, floorPrice, personalTermsDemand, signOnTerms } from '../src/game/ai'
import { aiFreeAgents, backResponders, chooseBetween, liveRivalBid, minutesAt, respondersTo, rivalFor, type RivalBid } from '../src/game/rivalbids'
import { migrate } from '../src/game/save'
import { tIn } from '../src/game/i18n'
import type { GameState, Player } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const SEEDS = [11, 23, 37, 41, 59, 67, 73, 89]
const CLUBS = ['leicester', 'northampton', 'bristol', 'toulouse']

/** Men the manager might really go for: good enough to matter, not his own. */
function targets(g: GameState): Player[] {
  const user = g.clubs[g.userClubId]
  return Object.values(g.players).filter(p => p.clubId && p.clubId !== user.id && !p.acad && !p.onLoan &&
    !p.loanFrom && p.ca >= 70 && p.ca <= user.rep + 6 && askingPrice(g, p) <= 6_000_000)
    .sort((a, b) => a.id - b.id)
}

/** The walk-throughs test the contest, not the cap or the wage budget. */
function roomy(g: GameState) {
  const lg = g.clubs[g.userClubId].leagueId
  if (g.caps) delete g.caps[lg]
  g.clubs[g.userClubId].balance = 100_000_000
  g.clubs[g.userClubId].wageBudget = 10_000_000
}

// ---- 1 + 2. the rate, and only real competition ----
let agreed = 0, contested = 0, badNeed = 0, badMoney = 0
for (const seed of SEEDS) {
  const g = newGame(CLUBS[seed % CLUBS.length], 'Rival', seed)
  g.week = 2
  g.clubs[g.userClubId].budget = 30_000_000
  const pool = targets(g)
  for (let i = 0; i < pool.length && i < 400; i += 7) {
    const p = pool[i]
    const fee = Math.max(floorPrice(g, p), askingPrice(g, p))
    const r = agreeFee(g, p.id, fee)
    if (!r.ok) continue
    agreed++
    const rb = liveRivalBid(g, p.id)
    if (!rb) continue
    contested++
    const c = g.clubs[rb.clubId]
    if (minutesAt(g, c, p) < 2) badNeed++
    if (c.budget < fee * 0.85) badMoney++
    if (contested === 1) console.log(`  e.g. ${p.name} (${p.pos} ${p.ca}): ${r.msg}`)
  }
}
const rate = contested / Math.max(1, agreed)
console.log(`  ${contested} of ${agreed} agreed fees contested (${(rate * 100).toFixed(1)}%)`)
ok(agreed >= 100, `enough agreed fees to measure (${agreed})`)
ok(rate >= 0.08 && rate <= 0.45, `a sensible share is contested, not none and not most (${(rate * 100).toFixed(1)}%)`)
ok(badNeed === 0, `every contesting club is one he would start for (${badNeed} not)`)
ok(badMoney === 0, `and every one can pay the fee (${badMoney} not)`)

{
  const g = newGame('leicester', 'Broke', 11)
  g.week = 2
  g.clubs[g.userClubId].budget = 30_000_000
  for (const c of Object.values(g.clubs)) if (c.id !== g.userClubId) c.budget = 0
  const n = targets(g).filter(p => rivalFor(g, p, askingPrice(g, p))).length
  ok(n === 0, `nobody contests when no club can pay (${n})`)
  const g2 = newGame('leicester', 'Bench', 11)
  g2.week = 2
  // a man who would start nowhere: the worst at his position everywhere
  const weak = Object.values(g2.players).filter(p => p.clubId && p.clubId !== g2.userClubId && !p.acad && p.ca < 66)
  const m = weak.filter(p => rivalFor(g2, p, askingPrice(g2, p))).length
  ok(m === 0, `nobody fights over a squad filler (${m} of ${weak.length})`)
}

// ---- 3. the choice follows the reasons ----
{
  let checked = 0, wageFlipBad = 0, promiseBad = 0, minutesCases = 0, minutesRight = 0
  for (const seed of SEEDS) {
    const g = newGame(CLUBS[seed % CLUBS.length], 'Choice', seed)
    g.week = 2
    g.clubs[g.userClubId].budget = 30_000_000
    for (const p of targets(g).slice(0, 300)) {
      const r = rivalFor(g, p, askingPrice(g, p))
      if (!r) continue
      const rb: RivalBid = { playerId: p.id, clubId: r.club.id, sellerId: p.clubId!, fee: 0, wage: r.wage, week: g.week, season: g.season }
      const base = personalTermsDemand(g, p)
      checked++
      // more money never loses a man already won
      let won = false
      for (const f of [0.8, 0.9, 1, 1.1, 1.25, 1.5, 2]) {
        const c = chooseBetween(g, p, rb, { wage: Math.round(base * f), signOn: 0, promise: false })
        if (won && !c.mine) wageFlipBad++
        won = won || c.mine
      }
      // a promise never hurts
      for (const f of [0.9, 1, 1.2]) {
        const a = chooseBetween(g, p, rb, { wage: Math.round(base * f), signOn: 0, promise: false })
        const b = chooseBetween(g, p, rb, { wage: Math.round(base * f), signOn: 0, promise: true })
        if (a.mine && !b.mine) promiseBad++
      }
      // he starts for them and would not at ours, the wage is level and the
      // clubs are close: the minutes decide it, and the reason says so
      const user = g.clubs[g.userClubId]
      if (minutesAt(g, user, p) < 2 && Math.abs(user.rep - r.club.rep) <= 4) {
        minutesCases++
        const c = chooseBetween(g, p, { ...rb, wage: base }, { wage: base, signOn: 0, promise: false })
        if (!c.mine && c.why.k === 'news.rivalWhyMinutes') minutesRight++
      }
    }
  }
  console.log(`  ${checked} contests weighed, ${minutesCases} where he would start for the rival and not for us`)
  ok(checked >= 30, `enough contests to judge the choice (${checked})`)
  ok(wageFlipBad === 0, `a better wage never loses a man already won (${wageFlipBad})`)
  ok(promiseBad === 0, `a promise of first-team rugby never hurts (${promiseBad})`)
  ok(minutesCases >= 10 && minutesRight >= minutesCases * 0.9,
    `no starting shirt here against one there loses him, and the reason is the minutes (${minutesRight}/${minutesCases})`)
}

// ---- 4. the manager sees it, and can answer ----
{
  let found = false
  for (const seed of SEEDS) {
    const g = newGame(CLUBS[seed % CLUBS.length], 'Flow', seed)
    g.week = 2
    g.clubs[g.userClubId].budget = 30_000_000
    roomy(g)
    for (const p of targets(g)) {
      const fee = Math.max(floorPrice(g, p), askingPrice(g, p))
      const r = agreeFee(g, p.id, fee)
      const rb = r.ok ? liveRivalBid(g, p.id) : null
      if (!rb) continue
      const rival = g.clubs[rb.clubId]
      ok(r.msg.includes(rival.short), `the agreed-fee reply names the rival (${rival.short})`)
      const demand = personalTermsDemand(g, p)
      // terms he will turn down: the reply says who and why, and nothing moves
      const low = chooseBetween(g, p, rb, { wage: demand, signOn: 0, promise: false })
      if (low.mine) continue
      const s = signOnTerms(g, p.id, fee, demand, 0, false)
      ok(!s.ok && s.msg.includes(rival.short), `a losing offer is told who he leans to: "${s.msg}"`)
      ok(p.clubId === rb.sellerId, 'and he has not moved yet')
      ok(liveRivalBid(g, p.id) != null, 'the bid stays open for the rest of the week')
      // the week ends without a better offer: the rival signs him
      const before = g.news.length
      processWeekAndAdvance(g)
      const story = g.news.slice(before).find(n => n.k === 'news.rivalBidLost' && n.playerId === p.id)
      ok(p.clubId === rival.id, `when the week is out he joins ${rival.short}`)
      ok(!!story, 'and the news says so')
      if (story) {
        const text = tIn('en', story.k!, story.v)
        console.log(`  "${text}"`)
        ok(text.includes(rival.name) && !text.includes('{'), 'naming the club, the offer and the reason, fully rendered')
        ok(['fr', 'es', 'it', 'af', 'ja'].every(l => !tIn(l as 'fr', story.k!, story.v).includes('{')), 'in every language')
      }
      found = true
      break
    }
    if (found) break
  }
  ok(found, 'a contested signing was found to walk through')

  // and the manager can win one by improving
  let won = false
  for (const seed of SEEDS) {
    const g = newGame(CLUBS[seed % CLUBS.length], 'Win', seed)
    g.week = 2
    g.clubs[g.userClubId].budget = 30_000_000
    roomy(g)
    for (const p of targets(g)) {
      const fee = Math.max(floorPrice(g, p), askingPrice(g, p))
      if (!agreeFee(g, p.id, fee).ok) continue
      const rb = liveRivalBid(g, p.id)
      if (!rb) continue
      const demand = personalTermsDemand(g, p)
      if (chooseBetween(g, p, rb, { wage: demand, signOn: 0, promise: false }).mine) continue
      const better = { wage: Math.round(demand * 1.3), signOn: 0, promise: true }
      if (!chooseBetween(g, p, rb, better).mine) continue
      g.clubs[g.userClubId].budget = 30_000_000
      const s = signOnTerms(g, p.id, fee, better.wage, 0, true)
      if (!s.ok) continue
      const story = g.news.find(n => n.k === 'news.rivalBidWon' && n.playerId === p.id)
      ok(p.clubId === g.userClubId, `improving the terms wins ${p.name}`)
      ok(!!story, 'and the news says who he turned down and why')
      if (story) console.log(`  "${tIn('en', story.k!, story.v)}"`)
      won = true
      break
    }
    if (won) break
  }
  ok(won, 'a contested signing can be won by improving the offer')
}

// ---- 5. deterministic and stream-safe ----
{
  const a = newGame('leicester', 'Det', 41)
  const b = newGame('leicester', 'Det', 41)
  a.week = b.week = 2
  a.clubs[a.userClubId].budget = b.clubs[b.userClubId].budget = 30_000_000
  const ra = targets(a).map(p => rivalFor(a, p, askingPrice(a, p))?.club.id ?? '-').join(',')
  const rbs = targets(b).map(p => rivalFor(b, p, askingPrice(b, p))?.club.id ?? '-').join(',')
  ok(ra === rbs, 'the same world gives the same contests')
  // opening contests (agreeing fees, no terms) moves no match result this week
  const c = newGame('leicester', 'Stream', 41)
  const d = newGame('leicester', 'Stream', 41)
  for (const p of targets(c).slice(0, 60)) agreeFee(c, p.id, askingPrice(c, p))
  processWeekAndAdvance(c)
  processWeekAndAdvance(d)
  const sc = (g: GameState) => g.fixtures.filter(f => f.played).map(f => `${f.homeScore}-${f.awayScore}`).join(',')
  ok(sc(c) === sc(d), 'opening rival bids draws nothing from the match stream')
}

// ---- 6. save-safe ----
{
  const g = newGame('leicester', 'Save', 59)
  ;(g as unknown as Record<string, unknown>).rivalBids = [{ playerId: 'x' }, null, { playerId: 1, clubId: 'bath', sellerId: 'sale', fee: 1, wage: 1, week: 2, season: 0 }]
  ;(g as unknown as Record<string, unknown>).rivalPush = { season: 'no', clubs: 3 }
  const m = migrate(JSON.parse(JSON.stringify(g)))
  ok((m.rivalBids ?? []).length === 1, 'migrate keeps only well-formed rival bids')
  ok(m.rivalPush === undefined, 'and drops a malformed backed-rivals record')
  const h = newGame('leicester', 'Save', 60)
  const n = migrate(JSON.parse(JSON.stringify(h)))
  ok(n.rivalBids === undefined && n.rivalPush === undefined, 'an older save carries neither field')
}

// ---- 7. the response, and the pool ----
{
  const g = newGame('leicester', 'Champ', 67)
  const lg = g.clubs[g.userClubId].leagueId
  const order = Object.values(g.clubs).filter(c => c.leagueId === lg).map(c => c.id).filter(id => id !== g.userClubId)
  order.splice(3, 0, g.userClubId) // fourth in the table, champion through the play-offs
  const before = new Map(order.map(id => [id, g.clubs[id].budget]))
  const ids = respondersTo(g, order, g.userClubId)
  ok(ids.length >= 1 && ids.length <= 3, `a title is answered by one to three rival boards (${ids.join(', ')})`)
  const n0 = g.news.length
  backResponders(g, ids)
  const backed = g.rivalPush?.clubs ?? []
  ok(backed.length >= 1, `and at least one is backed (${backed.map(e => `${e.id} for a ${e.pos}`).join(', ')})`)
  ok(backed.every(e => { const d = g.clubs[e.id].budget - before.get(e.id)!; return d > 0 && d <= 4_000_000 && d <= before.get(e.id)! * 0.4 + 1 }),
    'each by a bounded sum: at most 40% of its budget and never over 4m')
  const story = g.news.slice(n0).find(n => n.k === 'news.rivalBacked' || n.k === 'news.rivalBackedBoard')
  if (story) console.log(`  "${tIn('en', story.k!, story.v)}"`)
  ok(!!story && ['en', 'fr', 'es', 'it', 'af', 'ja'].every(l => !tIn(l as 'en', story.k!, story.v).includes('{')), 'the news says who, how much and what for, in every language')
  const mid = order.filter(id => id !== g.userClubId)
  mid.splice(7, 0, g.userClubId)
  ok(respondersTo(g, mid).every(id => mid.indexOf(id) > 7), 'a mid-table finish backs nobody who finished above him')

  // a star dropped into the pool in a window week is gone within the window
  const h = newGame('leicester', 'Pool', 73)
  const star = Object.values(h.players).filter(p => p.clubId && p.clubId !== h.userClubId && !p.acad && p.ca >= 86 && p.age <= 29)
    .sort((a, b) => b.ca - a.ca)[0]
  const from = h.clubs[star.clubId!]
  from.players = from.players.filter(id => id !== star.id)
  star.clubId = null
  let week = 2
  while (!star.clubId && week <= 7) { h.week = week++; aiFreeAgents(h) }
  ok(!!star.clubId && star.clubId !== h.userClubId, `a free ${star.ca}-rated ${star.pos} is signed by an AI club within the window (${star.clubId ?? 'nobody'}, week ${week - 1})`)
}

console.log(fails ? `\nRIVAL BID PROBE FAILED: ${fails}` : '\nRIVAL BID PROBE PASSED')
if (fails) process.exit(1)
