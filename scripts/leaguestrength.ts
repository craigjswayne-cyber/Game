/**
 * ---- DOES THE WORLD DRAIN? (1.8.5, the market round) ----
 *
 * Player feedback about another manager game: "opposition teams got weaker,
 * they didn't evolve while my team got all the wonderkids". This measures
 * whether a long career here does the same, through the real weekly loop
 * (newGame, processWeekAndAdvance) with a manager who behaves sensibly:
 *
 *   - picks his strongest XV every week (autoSelect, as the Selection screen)
 *   - renews the men worth keeping when their deals run down
 *   - shops in both windows: the best young prospect he can afford, and the
 *     best man at his thinnest position, through agreeFee and signOnTerms
 *     exactly as the player page does (meet the counter, pay the demand)
 *
 * Per season it reads:
 *   top4 / top8    mean best-XV CA (top fifteen seniors) of each top flight's
 *                  four and eight strongest sides
 *   user           the manager's best XV, and its rank in his league
 *   u21            where the world's twenty best under-21s (by potential) are:
 *                  at his club, at AI clubs in his league, elsewhere
 *   titles         distinct champions per top flight so far
 *   contests       rival bids met (after 1.8.5) and how they went
 *
 * Run: npx vite-node scripts/leaguestrength.ts [seasons] [club] [seed] [shop=1]
 * Prints one JSON line per season (prefix "ROW ") and a summary.
 */
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance } from '../src/game/season'
import { autoSelect } from '../src/game/matchEngine'
import { answerPress } from '../src/game/media'
import { agreeFee, askingPrice, floorPrice, offerRenewal, offerRenewalAt, personalTermsDemand, signFreeAgent, signOnTerms, windowOpen } from '../src/game/ai'
import { SEASON_WEEKS, leagueTier } from '../src/game/model'
import type { GameState, Player } from '../src/game/model'

const SEASONS = Number(process.argv[2] ?? 15)
const CLUB = process.argv[3] ?? 'leicester'
const SEED = Number(process.argv[4] ?? 777)
const SHOP = (process.argv[5] ?? '1') !== '0'
/** 'skill': the manager also signs the best free agents in every window week
 *  (signFreeAgent, as the player page does), which is the cheapest way to
 *  build a super side when AI clubs leave stars lying in the pool */
const SKILL = process.argv[6] === 'skill'

const g: GameState = newGame(CLUB, 'Strength', SEED)
const TOP = ['prem', 'top14', 'urc']

const bestXV = (clubId: string): number => {
  const club = g.clubs[clubId]
  if (!club) return 0
  const top = club.players.map(id => g.players[id]).filter(p => p && !p.acad && !p.onLoan)
    .sort((a, b) => b.ca - a.ca).slice(0, 15)
  return top.length ? top.reduce((s, p) => s + p.ca, 0) / top.length : 0
}
const mean = (xs: number[]) => xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
const r1 = (x: number) => Math.round(x * 10) / 10

let bought = 0, boughtKids = 0, buyFails = 0
let lastFail = ''
const boughtIds = new Set<number>()
const startIds = new Set(Object.keys(g.players).map(Number))

function pickSide() {
  const club = g.clubs[g.userClubId]
  const pool = club.players.map(id => g.players[id])
    .filter((p): p is Player => !!p && !p.injury && p.bans === 0 && !p.onLoan && !p.natSquad)
  if (pool.length < 23) return
  club.tactic.lineup = autoSelect(g, pool, club.tactic?.split)
  club.tactic.userPicked = true
}

function renewals() {
  const club = g.clubs[g.userClubId]
  const squad = club.players.map(id => g.players[id]).filter(Boolean)
  const cas = squad.filter(p => !p.acad).map(p => p.ca).sort((a, b) => b - a)
  const keepAt = cas[29] ?? 60
  for (const p of squad) {
    if (p.contractEnds > g.season || p.retiring || p.loanFrom) continue
    if (!(p.ca >= keepAt || (p.age <= 22 && p.pa >= 80))) continue
    const r = offerRenewal(g, p.id)
    if (!r.ok) {
      const r2 = offerRenewalAt(g, p.id, Math.round(p.wage * 1.25))
      void r2
    }
  }
}

/** One signing attempt the way the player page makes it. */
function tryBuy(p: Player): boolean {
  const ask = askingPrice(g, p)
  let fee = Math.max(floorPrice(g, p), Math.round(ask * 0.9 / 50_000) * 50_000)
  let r = agreeFee(g, p.id, fee)
  if (!r.ok && r.counter) { fee = r.counter; r = agreeFee(g, p.id, fee) }
  if (!r.ok) { lastFail = r.msg; return false }
  const demand = personalTermsDemand(g, p)
  let s = signOnTerms(g, p.id, fee, demand, 0, false)
  // a contested signing: the sensible manager improves once, if he can
  if (!s.ok && (g.rivalBids ?? []).some(b => b.playerId === p.id && b.week === g.week)) {
    s = signOnTerms(g, p.id, fee, Math.round(demand * 1.15), 0, true)
  }
  if (!s.ok) lastFail = s.msg
  else boughtIds.add(p.id)
  return s.ok
}

function shop() {
  if (!SHOP || !windowOpen(g.week) || g.unemployed) return
  if (g.week !== 2 && g.week !== 26) return
  const user = g.clubs[g.userClubId]
  const mine = user.players.map(id => g.players[id]).filter(Boolean)
  // the best young prospect he can afford
  const kids = Object.values(g.players).filter(p => p.clubId && p.clubId !== user.id && p.age <= 21 &&
    !p.acad && !p.onLoan && !p.loanFrom && p.pa >= 84 && askingPrice(g, p) <= user.budget)
    .sort((a, b) => b.pa - a.pa || b.ca - a.ca).slice(0, 4)
  for (const p of kids) {
    if (tryBuy(p)) { bought++; boughtKids++; break } else buyFails++
  }
  // the best man at his thinnest position
  const NEED: Record<string, number> = { LP: 2, HK: 2, TP: 2, LK: 3, FL: 3, N8: 2, SH: 2, FH: 2, CE: 3, WG: 3, FB: 2 }
  const top = [...mine].filter(p => !p.acad).sort((a, b) => b.ca - a.ca)
  const line = top[14]?.ca ?? 70
  const counts: Record<string, number> = {}
  for (const p of mine) if (!p.acad && p.ca >= line - 2) counts[p.pos] = (counts[p.pos] ?? 0) + 1
  const thin = Object.keys(NEED).sort((a, b) => (counts[a] ?? 0) / NEED[a] - (counts[b] ?? 0) / NEED[b])[0]
  const cands = Object.values(g.players).filter(p => p.clubId && p.clubId !== user.id && p.pos === thin &&
    !p.acad && !p.onLoan && !p.loanFrom && p.age <= 30 && p.ca > line && askingPrice(g, p) <= user.budget * 0.8)
    .sort((a, b) => b.ca - a.ca).slice(0, 4)
  for (const p of cands) {
    if (tryBuy(p)) { bought++; break } else buyFails++
  }
}

let freeSigned = 0
/** The skilled manager raids the free-agent pool for anyone who walks into his XV. */
function raidPool() {
  // a free agent can be signed in any week: there is no registration to move
  if (!SKILL || g.unemployed) return
  const user = g.clubs[g.userClubId]
  for (let k = 0; k < 2; k++) {
    const mine = user.players.map(id => g.players[id]).filter(p => p && !p.acad).sort((a, b) => b.ca - a.ca)
    const line = mine[14]?.ca ?? 70
    const fa = Object.values(g.players).filter(p => !p.clubId && !p.retiring && p.age <= 31 && p.ca > line + 2)
      .sort((a, b) => b.ca - a.ca)[0]
    if (!fa) return
    // make room: the weakest senior over 30 goes, as a manager clearing a shirt would
    if (mine.length >= 44) {
      const out = mine.filter(p => !p.loanFrom).sort((a, b) => a.ca - b.ca)[0]
      if (out) { user.players = user.players.filter(id => id !== out.id); out.clubId = null; user.tactic.lineup = user.tactic.lineup.map(id => id === out.id ? null : id) }
    }
    if (signFreeAgent(g, fa.id).ok) freeSigned++
    else return
  }
}

const champs: Record<string, Set<string>> = Object.fromEntries(TOP.map(l => [l, new Set<string>()]))
const userLg = g.clubs[CLUB].leagueId
console.log(`leaguestrength: ${CLUB} (${userLg}) seed ${SEED}, ${SEASONS} seasons, shop ${SHOP}, skill ${SKILL}`)
const seen = { won: 0, lost: 0, backed: 0, push: 0 }
// counted by story, not by id order: a few stories carry ids from their own
// counters, so "newer than the last id seen" is not a test for new
const counted = new Set<unknown>()
const tally = () => {
  for (const n of g.news) {
    const key = `${n.k}|${n.id}|${n.season}|${n.week}|${n.playerId ?? ''}`
    if (counted.has(key)) continue
    counted.add(key)
    if (n.k === 'news.rivalBidWon') seen.won++
    else if (n.k === 'news.rivalBidLost') seen.lost++
    else if (n.k === 'news.rivalBacked' || n.k === 'news.rivalBackedBoard') seen.backed++
    else if (n.k === 'news.rivalPushBid') seen.push++
  }
}

for (let s = 0; s < SEASONS; s++) {
  const target = g.season + 1
  let guard = 0
  while (g.season < target && guard++ < SEASON_WEEKS + 5) {
    pickSide()
    if (g.week === 20 || g.week === 30) renewals()
    shop()
    raidPool()
    for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
    processWeekAndAdvance(g)
    tally()
  }
  for (const h of g.history) if (champs[h.compId]) champs[h.compId].add(h.champion)
  const row: Record<string, unknown> = { season: g.season }
  for (const lg of TOP) {
    const ids = Object.values(g.clubs).filter(c => c.leagueId === lg).map(c => c.id)
    const xs = ids.map(id => ({ id, x: bestXV(id) })).sort((a, b) => b.x - a.x)
    row[lg] = {
      top4: r1(mean(xs.slice(0, 4).map(r => r.x))),
      top8: r1(mean(xs.slice(0, 8).map(r => r.x))),
      titles: champs[lg].size,
    }
  }
  const uLg = g.clubs[g.userClubId].leagueId
  const uIds = Object.values(g.clubs).filter(c => c.leagueId === uLg).map(c => ({ id: c.id, x: bestXV(c.id) })).sort((a, b) => b.x - a.x)
  const u = bestXV(g.userClubId)
  const xv = g.clubs[g.userClubId].players.map(id => g.players[id]).filter(p => p && !p.acad && !p.onLoan).sort((a, b) => b.ca - a.ca).slice(0, 15)
  row.xvFrom = { club: g.userClubId, bought: xv.filter(p => boughtIds.has(p.id)).length, regen: xv.filter(p => !startIds.has(p.id)).length, age: r1(mean(xv.map(p => p.age))), ca90: xv.filter(p => p.ca >= 90).length }
  row.user = { xv: r1(u), rank: uIds.findIndex(r => r.id === g.userClubId) + 1, gapTop4: r1(u - mean(uIds.filter(r => r.id !== g.userClubId).slice(0, 4).map(r => r.x))) }
  const u21 = Object.values(g.players).filter(p => p.clubId && p.age <= 20).sort((a, b) => b.pa - a.pa || b.ca - a.ca).slice(0, 20)
  row.u21 = {
    mine: u21.filter(p => p.clubId === g.userClubId).length,
    league: u21.filter(p => p.clubId !== g.userClubId && g.clubs[p.clubId!]?.leagueId === uLg).length,
    top: u21.filter(p => p.clubId !== g.userClubId && leagueTier(g.clubs[p.clubId!]?.leagueId) === 1).length,
    lower: u21.filter(p => leagueTier(g.clubs[p.clubId!]?.leagueId) > 1).length,
    clubs: new Set(u21.map(p => p.clubId)).size,
  }
  // the inbox is trimmed, so these are counted as they arrive (see the loop)
  row.contests = { won: seen.won, lost: seen.lost, backed: seen.backed, pushBids: seen.push }
  row.mgr = { freeSigned, bought, boughtKids, buyFails, lastFail: lastFail.slice(0, 60), titles: g.history.filter(h => h.champion === g.userClubId && TOP.includes(h.compId)).length }
  // where the world's best players are: the manager's club, AI clubs, or the
  // free-agent pool (a star an AI club let walk is a star nobody else can have)
  const stars = Object.values(g.players).filter(p => p.ca >= 88 && !p.retiring)
  row.stars = {
    mine: stars.filter(p => p.clubId === g.userClubId).length,
    ai: stars.filter(p => p.clubId && p.clubId !== g.userClubId).length,
    free: stars.filter(p => !p.clubId).length,
    fa85: Object.values(g.players).filter(p => !p.clubId && p.ca >= 85).length,
  }
  row.money = {
    topBal: r1(mean(Object.values(g.clubs).filter(c => c.id !== g.userClubId && leagueTier(c.leagueId) === 1).map(c => c.balance)) / 1e6),
    red: Object.values(g.clubs).filter(c => c.id !== g.userClubId && c.balance < 0).length,
  }
  console.log('ROW ' + JSON.stringify(row))
}
console.log(`titles: ${TOP.map(l => `${l} ${champs[l].size} (${[...champs[l]].join(',')})`).join(' | ')}`)
