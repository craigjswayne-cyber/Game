/**
 * ---- CAREER HISTORY THAT ACTS ----
 *
 * The hooks the rest of the game calls, and the two parts of the memory that
 * are about the manager rather than the clubs:
 *
 *   THE ANNALS. One to three lines per season for the manager's club, written
 *   at the year end from the moments the season collected (a title, the drop,
 *   a record win, a legend's farewell, a rivalry born), heaviest first. The
 *   Legacy screen's season-by-season table shows them under each year. Forty
 *   seasons kept, three lines each: a whole career fits in a few kilobytes.
 *
 *   FORMER CLUBS. Every job is a tenure with its record and how it ended:
 *   sacked, walked out, or moved to another club. A club remembers. Going back
 *   to its ground as the away manager is announced the week of the match, the
 *   crowd's welcome is decided by how you left, and the result is taken a
 *   little harder by your own board and supporters, because everyone knows
 *   what the afternoon means.
 *
 * Where each hook is called from, all of them one line at the call site:
 *   historyAfterMatch   season.ts afterClubMatch (competitive club matches)
 *   historyPreview      season.ts processWeekAndAdvance, after the advance
 *   historyYearEnd      rollover.ts rebuildSeason, before the season turns
 *   historyTakeJob / historyLeaveJob   jobs.ts
 *   historyWeight       season.ts boardReaction
 *   historyStakes       stakes.ts matchStakes
 *   migrateHistory      save.ts migrate
 */
import type { Fixture, GameState } from './model'
import { leagueTier, seasonLabel } from './model'
import { sortTable } from './schedule'
import { book, CAPS, file, moment, note, once, type Line, type Tenure } from './histbook'
import { legendsAfterMatch, legendsFacing, legendsYearEnd } from './legends'
import { rivalHeat, rivalryOf, rivalsManagerMoved, rivalsYearEnd, rivalWeight, rivalWhy } from './grudges'
import { t, type Vars } from './i18n'

/** A switch for scripts/historyprobe.ts ONLY: with it on, every hook is a
 *  no-op, so the probe can play the same world with and without this book
 *  and prove the AI's results never noticed. Nothing in the game sets it. */
export const HIST_OFF = { on: false }

// ---------------------------------------------------------------- tenures ---

/** The job the manager holds now, opened on first touch for a save from
 *  before this book (seeded from the tenure's own vsBook, which is exactly
 *  this job's record against everyone). */
function openTenure(state: GameState): Tenure | null {
  if (state.unemployed || !state.clubs[state.userClubId]) return null
  const h = book(state)
  let cur = h.tenures.find(x => x.clubId === state.userClubId && x.to == null)
  if (!cur) {
    let w = 0, d = 0, l = 0
    for (const r of Object.values(state.vsBook ?? {})) { w += r.w; d += r.d; l += r.l }
    cur = { clubId: state.userClubId, from: state.tenureStart ?? state.season, w, d, l, cups: 0 }
    h.tenures.push(cur)
    if (h.tenures.length > CAPS.tenures) h.tenures.splice(0, h.tenures.length - CAPS.tenures)
  }
  return cur
}

function closeTenure(state: GameState, cur: Tenure | null, exit: Tenure['exit']): void {
  if (!cur || cur.to != null) return
  cur.to = state.season
  cur.exit = exit
  cur.cups = state.mgr.trophies.filter(x => x.clubId === cur.clubId && x.season >= cur.from).length
  note(state, { kind: `left-${exit}`, clubId: cur.clubId })
}

/** How the old club will greet you, from how you left it. */
export type Welcome = 'hero' | 'warm' | 'cool' | 'hostile' | 'jeer'
export function welcomeOf(state: GameState, x: Tenure): Welcome {
  if ((state.legendOf ?? []).includes(x.clubId)) return 'hero'
  const m = x.w + x.d + x.l
  const good = x.cups > 0 || (m >= 20 && x.w / m >= 0.55)
  if (x.exit === 'moved') return 'hostile'
  if (x.exit === 'sacked') return good ? 'warm' : 'jeer'
  return good ? 'warm' : 'cool'
}

/** The most recent finished job at this club, if the manager ever had one. */
export function formerTenure(state: GameState, clubId: string): Tenure | null {
  if (clubId === state.userClubId) return null
  const all = (state.hist?.tenures ?? []).filter(x => x.clubId === clubId && x.to != null)
  return all[all.length - 1] ?? null
}

/**
 * jobs.ts takeJob, once the desk has changed hands. A job still open at the
 * old club means the manager walked straight from one to the other: that
 * tenure ends as a move, and the two clubs have a reason to dislike each
 * other. Out of work, the old tenure was closed by the sack or the
 * resignation already.
 */
export function historyTakeJob(state: GameState, oldClubId: string): void {
  if (HIST_OFF.on) return
  const h = book(state)
  const clubId = state.userClubId
  const left = h.tenures.find(x => x.clubId === oldClubId && x.to == null)
  if (left && oldClubId !== clubId) {
    closeTenure(state, left, 'moved')
    rivalsManagerMoved(state, oldClubId, clubId)
  }
  note(state, { kind: 'took-job', clubId })
  const cur = h.tenures.find(x => x.clubId === clubId && x.to == null)
  if (!cur) {
    h.tenures.push({ clubId, from: state.season, w: 0, d: 0, l: 0, cups: 0 })
    if (h.tenures.length > CAPS.tenures) h.tenures.splice(0, h.tenures.length - CAPS.tenures)
  }
  const back = h.tenures.filter(x => x.clubId === clubId).length > 1
  moment(state, clubId, back ? 45 : 35, back ? 'hist.anReturned' : 'hist.anArrived', {
    club: state.clubs[clubId]?.short ?? '',
  })
}

/** jobs.ts resignJob and sackManager, while the desk is still his. */
export function historyLeaveJob(state: GameState, exit: 'sacked' | 'walked'): void {
  if (HIST_OFF.on) return
  closeTenure(state, openTenure(state), exit)
}

// ---------------------------------------------------------------- matches ---

/** season.ts afterClubMatch: the tenure's ledger, the legends and the records. */
export function historyAfterMatch(state: GameState, fx: Fixture): void {
  if (HIST_OFF.on || fx.compId === 'fr' || state.unemployed) return
  const uid = state.userClubId
  if (fx.homeId !== uid && fx.awayId !== uid) return
  const cur = openTenure(state)
  const us = fx.homeId === uid ? fx.homeScore : fx.awayScore
  const them = fx.homeId === uid ? fx.awayScore : fx.homeScore
  if (cur) { if (us > them) cur.w++; else if (us < them) cur.l++; else cur.d++ }
  // a thumping is a moment; only the season's biggest is kept for the annals
  if (us - them >= 25) {
    const h = book(state)
    const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
    const prev = h.moments.find(m => m.k === 'hist.anBigWin' && m.clubId === uid && m.season === state.season)
    const w = 40 + Math.min(20, (us - them) / 3)
    if (!prev || w > prev.w) {
      if (prev) h.moments.splice(h.moments.indexOf(prev), 1)
      moment(state, uid, w, 'hist.anBigWin', { opp: state.clubs[oppId]?.short ?? oppId, us, them })
    }
  }
  legendsAfterMatch(state)
}

/**
 * season.ts, once the week has turned: the story before this week's match.
 * A former club, a legend on the other side, a rivalry at its hottest. One
 * story per subject per season, so a league double-header does not repeat it.
 */
export function historyPreview(state: GameState): void {
  if (HIST_OFF.on || state.unemployed) return
  const uid = state.userClubId
  const fx = state.fixtures.find(f => f.week === state.week && !f.played && (f.homeId === uid || f.awayId === uid))
  if (!fx || fx.compId === 'fr') return
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  if (!opp) return
  const away = fx.awayId === uid

  const x = formerTenure(state, oppId)
  if (x && once(state, `ret:${oppId}:${away ? 'a' : 'h'}`)) {
    const welcome = welcomeOf(state, x)
    file(state, away ? 'hist.returnAway' : 'hist.returnHome', {
      club: opp.short, stadium: opp.stadium, w: x.w, d: x.d, l: x.l, cups: x.cups,
      from: seasonLabel(x.from), to: seasonLabel(x.to ?? state.season),
      exit_k: `hist.exit_${x.exit ?? 'walked'}`, crowd_k: `hist.crowd_${welcome}`,
    })
  }
  for (const { l, as } of legendsFacing(state, oppId)) {
    if (!once(state, `lgb:${l.pid}:${oppId}`)) continue
    file(state, as === 'player' ? 'hist.legendBack' : 'hist.legendCoach',
      { player: l.name, club: opp.short, apps: l.apps, n: l.apps }, { playerId: as === 'player' ? l.pid : undefined })
  }
  const r = rivalryOf(state, uid, oppId)
  if (r?.on && r.heat >= 6 && once(state, `rv:${oppId}`)) {
    const why = rivalWhy(r)
    file(state, 'hist.rivalRenewed', { club: opp.short, why_k: why.k, ...(why.v ?? {}) })
  }
}

/**
 * season.ts boardReaction: how much louder this result lands, 1 to 1.3.
 * A formed rivalry, or a trip back to a club that remembers you. Never above
 * a derby's own weighting, which the caller keeps for derbies.
 */
export function historyWeight(state: GameState, fx: Fixture): number {
  if (HIST_OFF.on || state.unemployed) return 1
  const uid = state.userClubId
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  let f = rivalWeight(state, uid, oppId)
  const x = formerTenure(state, oppId)
  if (x) {
    const w = welcomeOf(state, x)
    f = Math.max(f, w === 'hostile' || w === 'jeer' ? 1.2 : 1.1)
  }
  return f
}

/** stakes.ts: the billing lines history can offer for this fixture. */
export function historyStakes(state: GameState, fx: Fixture): { text: string; weight: number }[] {
  const out: { text: string; weight: number }[] = []
  if (HIST_OFF.on || state.unemployed) return out
  const uid = state.userClubId
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  const opp = state.clubs[oppId]
  if (!opp) return out
  const x = formerTenure(state, oppId)
  if (x) out.push({ text: t(`hist.stakeReturn_${welcomeOf(state, x)}`, { club: opp.short }), weight: 79 })
  const heat = rivalHeat(state, uid, oppId)
  if (heat) {
    const why = rivalWhy(rivalryOf(state, uid, oppId)!)
    out.push({ text: t('hist.stakeRival', { club: opp.short, why_k: why.k, ...(why.v ?? {}) }), weight: 74 + Math.min(6, heat / 2) })
  }
  return out
}

// ------------------------------------------------------------- year end ---

/**
 * rollover.ts, after promotion and relegation and before the season number
 * turns: rivalries cool and grow, legends are counted out, and the season's
 * annals line is written.
 */
export function historyYearEnd(state: GameState): void {
  if (HIST_OFF.on) return
  const h = book(state)
  rivalsYearEnd(state)
  legendsYearEnd(state)

  const uid = state.userClubId
  const club = state.clubs[uid]
  if (club && !state.unemployed) {
    const cur = openTenure(state)
    if (cur) cur.cups = state.mgr.trophies.filter(x => x.clubId === uid && x.season >= cur.from).length
    const lines: (Line & { w: number })[] = []
    for (const hx of state.history) {
      if (hx.season !== state.season || hx.champion !== uid) continue
      const comp = state.comps[hx.compId]
      const league = comp?.type === 'league'
      lines.push({ k: league ? 'hist.anTitle' : 'hist.anCup', v: { comp: comp?.short ?? hx.compId }, w: league ? 100 : 90 })
    }
    // up or down: the review holds the league the season was played in
    const played = state.review?.season === state.season ? state.review.league : null
    const nowLeague = state.comps[club.leagueId]
    const was = played ? Object.values(state.comps).find(c => c.type === 'league' && c.name === played.name) : null
    if (was && nowLeague && was.id !== nowLeague.id) {
      const up = leagueTier(nowLeague.id) < leagueTier(was.id)
      lines.push({ k: up ? 'hist.anUp' : 'hist.anDown', v: { comp: (up ? nowLeague : was).short }, w: 95 })
    }
    for (const m of h.moments) if (m.clubId === uid && m.season === state.season) lines.push(m)
    if (!lines.length) {
      const comp = was ?? nowLeague
      const pos = played?.pos || (comp ? sortTable(comp.table).findIndex(r => r.teamId === uid) + 1 : 0)
      if (comp && pos > 0) lines.push({ k: 'hist.anFinish', v: { pos_o: pos, comp: comp.short }, w: 10 })
    }
    lines.sort((a, b) => b.w - a.w)
    const keep = lines.slice(0, CAPS.linesPerSeason).map(({ k, v }) => ({ k, v }))
    if (keep.length) {
      h.annals = h.annals.filter(a => !(a.season === state.season && a.clubId === uid))
      h.annals.push({ season: state.season, clubId: uid, lines: keep })
      if (h.annals.length > CAPS.annals) h.annals.splice(0, h.annals.length - CAPS.annals)
    }
  }
  // the season is over: its moments are spent and last year's stamps can go
  h.moments = []
  for (const [k, s] of Object.entries(h.said)) if (s < state.season) delete h.said[k]
}

/** The annals lines for one season of the career, rendered. */
export function annalsFor(state: GameState, season: number, clubId?: string): string[] {
  const row = (state.hist?.annals ?? []).find(a => a.season === season && (!clubId || a.clubId === clubId))
  return row ? row.lines.map(l => t(l.k, l.v as Vars | undefined)) : []
}

/** save.ts: make the book whole on an older save. Nothing is invented; the
 *  current job is opened from the ledger it already keeps. */
export function migrateHistory(state: GameState): void {
  if (!state.hist) return // created on first touch, like on a new career
  book(state)
  openTenure(state)
}
