/**
 * ---- THE STORY OF AN ERA ----
 *
 * When a manager leaves a club, and every fifth season he stays, the game
 * tells the era back to him: the seasons and the matches, won, drawn and
 * lost, the trophies, the academy players who went on to play Test rugby, the
 * record signing, the greatest player, the greatest win and the worst defeat,
 * the rival across the touchline, what the club became. And one sentence:
 * "You took Northampton from 9th in the Premiership to Continental Cup
 * winners in eleven seasons."
 *
 * THE JOB IN PROGRESS (CareerArc.cur) is opened when a job starts, or on first
 * touch for a career already running, and carries only what cannot be
 * recovered later: where the club stood on the day, the biggest win and worst
 * defeat, the record fee, the appearances (a season's stats are wiped every
 * summer) and the academy players given a debut.
 *
 * Told on the Legacy screen, where every era is kept, and as a news moment.
 * Nothing here is read by anything that plays a match.
 */
import type { Fixture, GameState } from './model'
import { leagueTier, seasonLabel } from './model'
import { leaguePos, sortTable } from './schedule'
import { genderOf } from './gender'
import { recall } from './memory'
import type { Vars } from './i18n'
import { ARC_CAPS, ARC_OFF, arcFile, arcOf, type CurEra, type Era } from './arcbook'
import { jobProfile } from './chairman'
import { rivalCoach } from './rivalcoach'
import { identityOf } from './identity'

/** Where the club stands today: its league place, or the pundits' tip, or its
 *  place by reputation before a ball is kicked. */
function standing(state: GameState, clubId: string): { pos: number; n: number } {
  const club = state.clubs[clubId]
  const table = state.comps[club?.leagueId ?? '']?.table ?? []
  const n = table.length
  if (table.some(r => r.p > 0)) return { pos: leaguePos(table, clubId), n }
  const tip = state.preds?.[clubId]
  if (tip) return { pos: tip, n }
  const peers = Object.values(state.clubs).filter(c => c.leagueId === club?.leagueId).sort((a, b) => b.rep - a.rep)
  return { pos: peers.findIndex(c => c.id === clubId) + 1, n: n || peers.length }
}

/** Open the job the manager holds now, if it is not open already. */
export function openEra(state: GameState): CurEra | null {
  if (ARC_OFF.on || state.unemployed) return null
  const club = state.clubs[state.userClubId]
  if (!club) return null
  const a = arcOf(state)
  if (a.cur && a.cur.c === club.id) return a.cur
  const st = standing(state, club.id)
  const prof = jobProfile(state, club.id)
  a.cur = {
    c: club.id, f: state.tenureStart ?? state.season,
    tier0: leagueTier(club.leagueId), pos0: st.pos, n0: st.n, lg0: club.leagueId, bal0: club.balance,
    m: 0, w: 0, d: 0, l: 0, top: {}, grads: [],
    prof,
    trouble: prof === 'troubled' || (st.n > 0 && st.pos > 0 && st.pos >= Math.ceil(st.n * 2 / 3)),
  }
  return a.cur
}

/** season.ts afterClubMatch: the job's record, best win and worst defeat. */
export function eraAfterMatch(state: GameState, fx: Fixture): void {
  const cur = openEra(state)
  if (!cur) return
  const uid = cur.c
  if (fx.homeId !== uid && fx.awayId !== uid) return
  const us = fx.homeId === uid ? fx.homeScore : fx.awayScore
  const them = fx.homeId === uid ? fx.awayScore : fx.homeScore
  const o = fx.homeId === uid ? fx.awayId : fx.homeId
  cur.m++
  if (us > them) cur.w++; else if (us < them) cur.l++; else cur.d++
  if (us > them && (!cur.gw || us - them > cur.gw.us - cur.gw.them)) cur.gw = { o, us, them, s: state.season }
  if (us < them && (!cur.wd || them - us > cur.wd.them - cur.wd.us)) cur.wd = { o, us, them, s: state.season }
}

/** records.ts offerSigning: the biggest fee of this job. */
export function eraSigning(state: GameState, playerId: number, fee: number): void {
  const cur = openEra(state)
  const p = state.players[playerId]
  if (!cur || !p || !(fee > 0)) return
  if (!cur.rs || fee > cur.rs.fee) cur.rs = { n: p.name, fee, s: state.season }
}

/** The year end: the season's appearances and debuts go into the job's book,
 *  and a club in trouble that has been turned round is counted. Returns true
 *  when this is a fifth season, so the caller tells the era so far. */
export function eraYearEnd(state: GameState): boolean {
  const cur = openEra(state)
  if (!cur) return false
  const club = state.clubs[cur.c]
  for (const id of club?.players ?? []) {
    const p = state.players[id]
    if (!p || p.acad || !p.stats.apps) continue
    const row = cur.top[p.id] ?? (cur.top[p.id] = { n: p.name, a: 0 })
    row.a += p.stats.apps
  }
  const keep = Object.entries(cur.top).sort((x, y) => y[1].a - x[1].a).slice(0, ARC_CAPS.top)
  cur.top = Object.fromEntries(keep)
  for (const e of recall(state, { kind: 'academy-debut', clubId: cur.c, sinceSeason: state.season })) {
    if (e.playerId != null && !cur.grads.includes(e.playerId)) cur.grads.push(e.playerId)
  }
  if (cur.grads.length > ARC_CAPS.grads) cur.grads.splice(0, cur.grads.length - ARC_CAPS.grads)
  cur.pats = []
  // a club taken over in trouble, turned round within this job
  const a = arcOf(state)
  if (cur.trouble && !a.turned.includes(cur.c) && club) {
    const comp = state.comps[club.leagueId]
    const pos = comp?.table?.length ? sortTable(comp.table).findIndex(r => r.teamId === club.id) + 1 : 0
    const tier = leagueTier(club.leagueId)
    const rose = tier < cur.tier0 || (tier === cur.tier0 && pos > 0 && pos <= cur.pos0 - 4)
    const mended = cur.bal0 < 0 && club.balance > 0
    if (rose || mended) a.turned.push(cur.c)
  }
  const seasons = state.season - cur.f + 1
  return seasons > 0 && seasons % 5 === 0
}

/** Everything the era summary says, for the job in progress or a finished one. */
export function buildEra(state: GameState, why: Era['why']): Era | null {
  const cur = openEra(state)
  if (!cur) return null
  const club = state.clubs[cur.c]
  const a = arcOf(state)
  const tr = state.mgr.trophies.filter(x => x.clubId === cur.c && x.season >= cur.f).map(x => x.compId)
  const intl = cur.grads.map(id => state.players[id]).filter(p => p && (p.caps ?? 0) > 0).length
  const top = Object.values(cur.top).sort((x, y) => y.a - x.a)[0]
  const rival = rivalCoach(state)
  const labels = identityOf(state).labels
  const rep = a.repute && a.repute.c === cur.c ? a.repute.l : labels[0]
  const story = storyOf(state, cur, tr)
  return {
    c: cur.c, cn: club?.name ?? cur.c, f: cur.f, t: state.season,
    m: cur.m, w: cur.w, d: cur.d, l: cur.l, tr, intl,
    rs: cur.rs ? { n: cur.rs.n, fee: cur.rs.fee } : undefined,
    gp: top ? { n: top.n, a: top.a } : undefined,
    gw: cur.gw ? { o: cur.gw.o, us: cur.gw.us, them: cur.gw.them } : undefined,
    wd: cur.wd ? { o: cur.wd.o, us: cur.wd.us, them: cur.wd.them } : undefined,
    rv: rival?.n, id: rep ?? undefined,
    sk: story.k, sv: story.v, why, pf: cur.prof,
  }
}

/** The one sentence. */
function storyOf(state: GameState, cur: CurEra, tr: string[]): { k: string; v: Vars } {
  const club = state.clubs[cur.c]
  const n = state.season - cur.f + 1
  const lgNow = club?.leagueId ?? cur.lg0
  const name = (id: string) => state.comps[id]?.short ?? state.comps[id]?.name ?? id
  const v: Vars = {
    club: club?.short ?? cur.c, n, seasons_k: n === 1 ? 'count.seasonOne' : 'count.seasonMany',
    from_o: cur.pos0 || 1, league: name(cur.lg0), comp: name(lgNow), m: cur.m,
  }
  if (cur.m < 12 && n <= 1) return { k: 'arc.storyShort', v }
  if (tr.includes('cc')) return { k: 'arc.storyEurope', v: { ...v, cup_k: genderOf(state) === 'w' ? 'dream.cupWomen' : 'dream.cupMen' } }
  const leagueTitle = tr.find(id => state.comps[id]?.type === 'league')
  if (leagueTitle) return { k: 'arc.storyTitle', v: { ...v, comp: name(leagueTitle) } }
  const tierNow = leagueTier(lgNow)
  if (tierNow < cur.tier0) return { k: 'arc.storyUp', v }
  if (tr.length) return { k: 'arc.storyCups', v: { ...v, cups: tr.length, cups_k: tr.length === 1 ? 'count.trophyOne' : 'count.trophyMany' } }
  if (tierNow > cur.tier0) return { k: 'arc.storyDown', v }
  const rows = (state.arc?.conduct ?? []).filter(r => r.c === cur.c && r.s >= cur.f && r.pos > 0)
  const best = rows.length ? Math.min(...rows.map(r => r.pos)) : 0
  if (best > 0 && cur.pos0 > 0 && best <= cur.pos0 - 3) return { k: 'arc.storyRose', v: { ...v, to_o: best } }
  return { k: 'arc.storyHeld', v: { ...v, to_o: best || cur.pos0 || 1 } }
}

/** Tell an era: into the book, and into the news. */
export function tellEra(state: GameState, why: Era['why'], summer = false): Era | null {
  if (ARC_OFF.on) return null
  const e = buildEra(state, why)
  if (!e) return null
  const a = arcOf(state)
  a.eras.push(e)
  if (a.eras.length > ARC_CAPS.eras) a.eras.splice(0, a.eras.length - ARC_CAPS.eras)
  arcFile(state, why === '5' ? 'arc.eraFive' : 'arc.eraEnd', {
    story_k: e.sk, ...e.sv, cn: e.cn,
    w: e.w, d: e.d, l: e.l, cups: e.tr.length,
    from: seasonLabel(e.f), to: seasonLabel(e.t),
  }, { type: 'award', summer })
  return e
}

/** The job is over: tell it, and close the book on it. */
export function closeEra(state: GameState, why: 's' | 'w' | 'm'): void {
  if (ARC_OFF.on || state.unemployed) return
  const cur = openEra(state)
  if (!cur) return
  tellEra(state, why)
  delete arcOf(state).cur
}
