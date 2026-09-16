/** Edge cases: thin squad, stale contracts at rollover, bloated squad at rollover. */
import { newGame } from '../../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek, weekRng } from '../../src/game/season'
import { simMatch } from '../../src/game/matchEngine'
import { answerPress } from '../../src/game/media'
import { SEASON_WEEKS } from '../../src/game/model'
import type { GameState } from '../../src/game/model'

const step = (g: GameState) => {
  const fx = userFixtureThisWeek(g)
  if (fx) simMatch(g, fx, weekRng(g), true)
  for (const pi of g.press.filter(p => !p.answered)) answerPress(g, pi.id, 0)
  processWeekAndAdvance(g)
}
const seniors = (g: GameState, cid: string) => g.clubs[cid].players.filter(id => g.players[id] && !g.players[id].acad).length
const total = (g: GameState, cid: string) => g.clubs[cid].players.length

// ---------- 1. squad below 15 ----------
for (const who of ['ai', 'user'] as const) {
  const g = newGame('leicester', 'Edge', 999)
  for (let i = 0; i < 6; i++) step(g) // into the league season
  const cid = who === 'user' ? g.userClubId : Object.values(g.clubs).find(c => c.leagueId === 'prem' && c.id !== g.userClubId)!.id
  const club = g.clubs[cid]
  // release everyone but 12 seniors AND all academy men, so the squad is really thin
  const keep = club.players.filter(id => !g.players[id].acad).slice(0, 12)
  for (const id of club.players) if (!keep.includes(id)) { g.players[id].clubId = null }
  club.players = keep
  club.tactic.lineup = club.tactic.lineup.map(id => (id && keep.includes(id) ? id : null))
  console.log(`\n[thin/${who}] ${cid}: squad now ${total(g, cid)} (seniors ${seniors(g, cid)}) at s${g.season}w${g.week}`)
  try {
    for (let i = 0; i < 6; i++) {
      const wk = g.week
      const fxs = g.fixtures.filter(f => f.week === wk && (f.homeId === cid || f.awayId === cid))
      step(g)
      for (const f of fxs) {
        const mine = f.homeId === cid
        console.log(`[thin/${who}]  w${wk} ${f.compId} ${f.homeId} ${f.homeScore}-${f.awayScore} ${f.awayId} played=${f.played} ${mine ? '(home)' : '(away)'} lineup non-null ${club.tactic.lineup.filter(Boolean).length} squad ${total(g, cid)} injured ${club.players.filter(id => g.players[id]?.injury).length}`)
      }
      if (!fxs.length) console.log(`[thin/${who}]  w${wk} no fixture; squad ${total(g, cid)}`)
    }
    const newsAbout = g.news.filter(n => n.week >= 6 && /short|thin|crisis|forfeit|emergency|board signing|walkover/i.test(n.subject + n.body)).map(n => `w${n.week}: ${n.subject}`)
    console.log(`[thin/${who}] related news: ${newsAbout.join(' | ') || 'none'}`)
    // any NaN in scores/table?
    const comp = g.comps[club.leagueId]
    const row = comp.table.find(r => r.teamId === cid)
    console.log(`[thin/${who}] table row: ${JSON.stringify(row)}`)
  } catch (e) {
    console.log(`[thin/${who}] CRASH: ${(e as Error).stack?.split('\n').slice(0, 4).join(' | ')}`)
  }
}

// ---------- 2. contractEnds in the past at rollover; 3. club with 45+ ----------
{
  const g = newGame('leicester', 'Edge', 999)
  while (g.week < SEASON_WEEKS - 1) step(g)
  // stale contracts: one user player, one AI player, contractEnds = season - 2
  const uc = g.clubs[g.userClubId]
  const ai = Object.values(g.clubs).find(c => c.leagueId === 'prem' && c.id !== g.userClubId)!
  const up = g.players[uc.players.find(id => !g.players[id].acad)!]
  const ap = g.players[ai.players.find(id => !g.players[id].acad)!]
  up.contractEnds = g.season - 2
  ap.contractEnds = g.season - 2
  // also a free agent with a stale contract
  const fa = Object.values(g.players).find(p => !p.clubId && p.age < 30)!
  fa.contractEnds = g.season - 3
  // bloat: give the AI club 50 seniors, and the user club 50 seniors, using free agents
  const fas = Object.values(g.players).filter(p => !p.clubId && p.id !== fa.id)
  let k = 0
  for (const c of [ai, uc]) {
    while (seniors(g, c.id) < 50 && k < fas.length) { const p = fas[k++]; p.clubId = c.id; c.players.push(p.id) }
  }
  console.log(`\n[roll] pre-rollover s${g.season}w${g.week}: ${ai.id} seniors ${seniors(g, ai.id)} total ${total(g, ai.id)}; user seniors ${seniors(g, uc.id)} total ${total(g, uc.id)}`)
  console.log(`[roll] stale: user ${up.name} ends ${up.contractEnds}, ai ${ap.name} ends ${ap.contractEnds}, FA ${fa.name} ends ${fa.contractEnds}`)
  const s0 = g.season
  try {
    let guard = 0
    while (g.season === s0 && guard++ < 5) step(g)
    console.log(`[roll] rolled to s${g.season}w${g.week}`)
    const show = (p: typeof up, label: string) => console.log(`[roll] ${label}: ${p ? `${p.name} club=${p.clubId} ends=${p.contractEnds} wage=${p.wage} listed=${p.transferListed}` : 'DELETED'}`)
    show(g.players[up.id], 'user stale')
    show(g.players[ap.id], 'ai stale')
    show(g.players[fa.id], 'FA stale')
    console.log(`[roll] ${ai.id} seniors ${seniors(g, ai.id)} total ${total(g, ai.id)}; user seniors ${seniors(g, uc.id)} total ${total(g, uc.id)}`)
    // any player left with contractEnds < season?
    const stale = Object.values(g.players).filter(p => p.clubId && p.contractEnds < g.season)
    console.log(`[roll] players with a club and contractEnds < season after rollover: ${stale.length} ${stale.slice(0, 5).map(p => `${p.name}(${p.clubId},${p.contractEnds})`).join(' ')}`)
    const news = g.news.filter(n => n.season === g.season && n.week === 1 && /contract|expired|rolling|release/i.test(n.subject)).map(n => n.subject)
    console.log(`[roll] contract news: ${news.join(' | ')}`)
    // play 3 weeks into the new season with the 50-man user squad
    for (let i = 0; i < 4; i++) step(g)
    console.log(`[roll] after 4 weeks: user seniors ${seniors(g, uc.id)} total ${total(g, uc.id)}; ai ${seniors(g, ai.id)}`)
    const capNews = g.news.filter(n => n.season === g.season && /cap|registr|squad size|too many/i.test(n.subject)).map(n => `w${n.week} ${n.subject}`)
    console.log(`[roll] cap/registration news: ${capNews.join(' | ') || 'none'}`)
  } catch (e) {
    console.log(`[roll] CRASH: ${(e as Error).stack?.split('\n').slice(0, 5).join(' | ')}`)
  }
}
