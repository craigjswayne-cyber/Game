// THE OCCASION, FROM THE GAME (2.0.0 overnight run, 26 Nov): the plain facts the commentary may say
// before a ball is kicked and through the match, read off the game state for one fixture. Nothing here
// is invented: every field is a number or a name the game already holds, or it is left out. The
// commentary (commentary.ts) says only what is here and what the record says.
//
//   contextFromGame(state, fx, lineups?)  where lineups are the 23 ids each side kicked off with
//   (session.kickoffTeams); without them the clubs' selected XVs are read instead.
import type { Fixture, GameState, Player } from '../model'
import { careerRows, kickRecord } from '../model/players'
import { derbyName } from '../rivalries'
import { refFor } from '../match/referee'
import { matchConditions, surfaceOf } from '../conditions'
import { sortTable } from '../schedule'
import type { Context, ContextMan, ContextNews } from './commentary'

const MILESTONE_APPS = [50, 100, 150, 200, 250, 300]

/** a man's whole career so far: every season at every club, the estimate before the game began, and this season */
function careerOf(p: Player) {
  const rows = careerRows(p)
  return {
    apps: rows.reduce((a, c) => a + c.apps, 0) + p.stats.apps + (p.hist?.apps ?? 0),
    tries: rows.reduce((a, c) => a + c.tries, 0) + p.stats.tries + (p.hist?.tries ?? 0),
    points: rows.reduce((a, c) => a + c.points, 0) + p.stats.points + (p.hist?.points ?? 0),
  }
}

/** the last five results of a club before this fixture, oldest first: W, D or L */
function formOf(state: GameState, clubId: string, fx: Fixture): string {
  const played = state.fixtures.filter(f => f.played && f.id !== fx.id && f.week < fx.week && (f.homeId === clubId || f.awayId === clubId) && f.compId !== 'fr')
    .sort((a, b) => a.week - b.week)
  return played.slice(-5).map(f => {
    const us = f.homeId === clubId ? f.homeScore : f.awayScore, them = f.homeId === clubId ? f.awayScore : f.homeScore
    const won = f.decider ? f.decider.winner === clubId : us > them
    return us === them && !f.decider ? 'D' : won ? 'W' : 'L'
  }).join('')
}

export function contextFromGame(state: GameState, fx: Fixture, lineups?: [(string | number | null)[], (string | number | null)[]]): Context {
  const ids: [string, string] = [fx.homeId, fx.awayId]
  const clubs = ids.map(id => state.clubs[id])
  const comp = state.comps[fx.compId]
  const ctx: Context = {}
  // ---- the occasion
  ctx.weather = fx.weather ?? matchConditions(state, fx)
  ctx.surface = surfaceOf(state, fx)
  const derby = derbyName(fx.homeId, fx.awayId)
  if (derby || fx.derby) { ctx.derby = true; if (derby) ctx.derbyName = derby }
  if (comp) ctx.compName = comp.name
  if (comp?.type === 'league' && !fx.stage) {
    ctx.bonusPoints = true
    ctx.round = fx.round + 1
    ctx.rounds = comp.rounds
    const order = sortTable([...comp.table])
    if (comp.table.some(r => r.p > 0)) {
      const hp = order.findIndex(r => r.teamId === fx.homeId) + 1, ap = order.findIndex(r => r.teamId === fx.awayId) + 1
      if (hp > 0 && ap > 0) ctx.table = [hp, ap]
      ctx.standings = order.map(r => ({ id: r.teamId, pts: r.pts, w: r.w, pd: r.pf - r.pa, tf: r.tf, pf: r.pf, p: r.p }))
      ctx.clubIds = ids
    }
  } else if (comp && fx.compId !== 'fr') { ctx.cup = comp.name; if (fx.stage) ctx.stage = fx.stage }
  const firsts = ids.map(id => !state.fixtures.some(f => f.played && f.compId !== 'fr' && f.id !== fx.id && (f.homeId === id || f.awayId === id)))
  if (firsts[0] && firsts[1] && fx.compId !== 'fr') ctx.firstMatch = true
  const form = ids.map(id => formOf(state, id, fx)) as [string, string]
  if (form[0] || form[1]) ctx.form = form
  // the last time they met this season
  const met = state.fixtures.filter(f => f.played && f.id !== fx.id && ((f.homeId === fx.homeId && f.awayId === fx.awayId) || (f.homeId === fx.awayId && f.awayId === fx.homeId)))
    .sort((a, b) => b.week - a.week)[0]
  if (met) ctx.lastMet = { week: met.week, sameVenue: met.homeId === fx.homeId, homeScore: met.homeId === fx.homeId ? met.homeScore : met.awayScore, awayScore: met.homeId === fx.homeId ? met.awayScore : met.homeScore }
  // the referee and his reputation (match/referee.ts: the same panel the game shows on match day)
  const ref = refFor(fx.id)
  const traits: string[] = []
  if (ref.breakdown <= 0.95) traits.push('fussy')
  else if (ref.breakdown >= 1.05) traits.push('jackal')
  if (ref.scrum >= 1.08) traits.push('scrumTight')
  if (ref.patience <= 4) traits.push('shortFuse')
  if (ref.flow >= 1.03) traits.push('flow')
  else if (ref.flow <= 0.99) traits.push('stopStart')
  ctx.referee = { name: ref.name, traits }
  // the ground and the crowd (fx.att is set by the game's kick-off)
  const host = clubs[0]
  if (fx.venue) ctx.venue = fx.venue.name
  else if (host?.stadium) ctx.venue = host.stadium
  if (fx.att) ctx.attendance = fx.att
  const cap = fx.venue?.capacity ?? host?.capacity
  if (cap) ctx.capacity = cap
  // ---- the men: who is playing, their season and career, and the stories they bring
  const sheet = (s: 0 | 1): (string | number | null)[] => lineups?.[s] ?? (clubs[s]?.tactic.lineup ?? [])
  const men: Record<string, ContextMan> = {}
  const news: ContextNews[] = []
  for (const s of [0, 1] as const) {
    const opp = ids[s === 0 ? 1 : 0]
    sheet(s).slice(0, 23).forEach((raw, i) => {
      if (raw == null) return
      const p = state.players[Number(raw)]
      if (!p) return
      const id = String(p.id), c = careerOf(p), k = kickRecord(p.stats).all
      men[id] = { side: s, shirt: i + 1, apps: p.stats.apps, tries: p.stats.tries, points: p.stats.points, careerApps: c.apps, careerTries: c.tries, careerPoints: c.points,
        ...(k ? { kickMade: k.made, kickAtt: k.att } : {}) }
      const starts = i < 15
      if (c.apps === 0) news.push({ kind: 'debut', side: s, id, starts })
      else if (p.stats.apps === 0 && p.joinedAt != null && !careerRows(p).some(r => r.clubId === p.clubId && r.apps > 0)) news.push({ kind: 'clubDebut', side: s, id, starts })
      if (starts && MILESTONE_APPS.includes(c.apps + 1)) news.push({ kind: 'milestone', side: s, id, n: c.apps + 1 })
      if (p.exClub === opp || careerRows(p).some(r => r.clubId === opp && r.apps > 0)) news.push({ kind: 'oldClub', side: s, id })
      const inj = p.injLog?.[p.injLog.length - 1]
      if (inj && inj.s === state.season && p.outWk != null && p.outWk >= fx.week - 2 && inj.weeks >= 3) news.push({ kind: 'return', side: s, id, n: inj.weeks })
    })
    // a notable absentee: the club's best fit player not in the 23, injured or suspended
    const club = clubs[s]
    const in23 = new Set(sheet(s).slice(0, 23).map(x => Number(x)))
    const out = (club?.players ?? []).map(pid => state.players[pid]).filter(p => p && !in23.has(p.id) && (p.injury || p.bans > 0))
      .sort((a, b) => b.ca - a.ca)[0]
    const best = (club?.players ?? []).map(pid => state.players[pid]?.ca ?? 0).sort((a, b) => b - a)
    if (out && best.length >= 5 && out.ca >= best[4]) news.push({ kind: 'absent', side: s, name: out.name, why: out.injury ? 'injured' : 'suspended' })
  }
  ctx.men = men
  // the captains, when they start
  ctx.captains = [0, 1].map(s => { const c = clubs[s]?.captain; return c != null && sheet(s as 0 | 1).slice(0, 15).map(Number).includes(c) ? String(c) : undefined }) as [string | undefined, string | undefined]
  if (news.length) ctx.news = news
  // ---- what comes next for each side
  ctx.next = ids.map(id => {
    const f = state.fixtures.filter(x => !x.played && x.id !== fx.id && x.week > fx.week && (x.homeId === id || x.awayId === id)).sort((a, b) => a.week - b.week)[0]
    if (!f) return undefined
    const home = f.homeId === id
    return { opp: state.clubs[home ? f.awayId : f.homeId]?.name ?? (home ? f.awayId : f.homeId), home, week: f.week }
  }) as Context['next']
  return ctx
}
