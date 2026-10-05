/**
 * ---- THE MEN IN THE OTHER DUGOUT ----
 *
 * Every AI club already had a named head coach with an idea of the game
 * (club.coach, club.philosophy), but the name was a label on a club: sacked,
 * he vanished, and the next man was a stranger with a new name. After ten
 * seasons a manager had met a hundred coaches and remembered none of them.
 *
 * Here a coach is a PERSON who lasts. The first time you meet his side he is
 * written down, and from then on the game keeps:
 *
 *   YOUR RECORD AGAINST HIM, whichever club he is at. The pre-match billing
 *   says it ("Your record against Monty Turner: won 4, lost 7").
 *   HIS IDEA OF RUGBY, which travels with him.
 *   HIS CLUBS: the sackings, the months out of work, and the return. A sacked
 *   coach joins a pool, and when a club appoints somebody whose idea of the
 *   game matches his, it may well be him - back in work, sometimes back at the
 *   club that sacked him.
 *   THE PLAYERS HE TAKES FROM YOU: a pre-contract signed with his club, a
 *   player sold to him.
 *
 * ONE OF THEM BECOMES YOUR RIVAL, ORGANICALLY. Heat builds from what the two
 * of you share: every meeting a little, a close one more, a knockout tie more
 * again, a final most; a title decided between your two clubs; players he
 * takes from you. Every summer it cools. The coach with the most heat, once
 * you have met him often enough, is your rival; another has to burn clearly
 * hotter to replace him, and a rival you stop meeting fades.
 *
 * STREAM DISCIPLINE. No rng is drawn and no story spends an id. The return of
 * an old coach swaps a NAME only, and only onto a club whose new philosophy
 * (already drawn by philosophy.ts) is his: so the world's dials, rosters and
 * results are exactly what they would have been with a stranger in the chair.
 * scripts/careerarcprobe.ts holds that.
 */
import type { Club, Fixture, GameState } from './model'
import { absWeek } from './model'
import { sortTable } from './schedule'
import { subjectVar } from './gender'
import { t, type Vars } from './i18n'
import { ARC_CAPS, ARC_OFF, arcFile, arcHash, arcOf, onceArc, type Coach } from './arcbook'
import { PHILOSOPHY_BY_ID } from './philosophy'

/** heat and meetings it takes to be a rival */
export const RIVAL_AT = 5
export const RIVAL_MEETINGS = 4
/** a rival fades below this */
export const RIVAL_FADE = 1.5
/** summer cooling */
const COOL = 0.7
/** share of appointments that go to a known coach out of work, when one fits */
const RETURN_PCT = 60

export const meetings = (c: Coach): number => c.w + c.d + c.l

export function notable(state: GameState, c: Coach): boolean {
  return state.arc?.rival === c.id || meetings(c) >= 4 || c.heat >= 3
}

/** The club a coach is employed at, and whether it is his seat now. */
function seatName(state: GameState, clubId: string): string | undefined {
  const club = state.clubs[clubId]
  if (!club) return undefined
  if (clubId === state.userClubId && !state.unemployed) return undefined
  return club.coach || undefined
}

function leave(state: GameState, c: Coach, x: 's' | 'l'): void {
  const st = c.st[c.st.length - 1]
  if (st && st.t == null) { st.t = state.season; st.x = x }
  delete c.at
  c.out = absWeek(state.season, state.week)
}

function join(state: GameState, c: Coach, club: Club): void {
  c.at = club.id
  c.ph = club.philosophy ?? c.ph
  delete c.out
  c.st.push({ c: club.id, f: state.season })
  if (c.st.length > ARC_CAPS.stints) c.st.splice(0, c.st.length - ARC_CAPS.stints)
}

/**
 * The coach in this club's dugout, kept in step with the club. A seat whose
 * name has changed since he was written down has lost its man (the job
 * market's hook says why when it knows). With `create`, a coach met for the
 * first time is written down.
 */
export function coachAt(state: GameState, clubId: string, create = false): Coach | null {
  if (ARC_OFF.on) return null
  const club = state.clubs[clubId]
  const a = arcOf(state)
  const name = seatName(state, clubId)
  let cur = a.coaches.find(c => c.at === clubId)
  if (cur && cur.n !== name) { leave(state, cur, 's'); cur = undefined }
  if (!name || !club) return null
  if (cur) return cur
  // a name out of work with the same idea of rugby is the same man
  const back = a.coaches.find(x => !x.at && x.n === name && (x.ph == null || x.ph === club.philosophy))
  if (back) { join(state, back, club); return back }
  if (!create) return null
  const c: Coach = {
    id: a.cn++, n: name, g: club.coachGender, ph: club.philosophy, at: clubId,
    st: [{ c: clubId, f: state.season }], w: 0, d: 0, l: 0, heat: 0, cl: 0, ko: 0, ti: 0, po: 0,
  }
  a.coaches.push(c)
  if (a.coaches.length > ARC_CAPS.coaches) pruneCoaches(state)
  return c
}

export function coachById(state: GameState, id: number | undefined): Coach | null {
  return id == null ? null : state.arc?.coaches.find(c => c.id === id) ?? null
}

export function rivalCoach(state: GameState): Coach | null {
  return coachById(state, state.arc?.rival)
}

/** Keep the book small: the men who matter to this career stay. */
function pruneCoaches(state: GameState): void {
  const a = arcOf(state)
  const score = (c: Coach) => (a.rival === c.id ? 1e6 : 0) + c.heat * 10 + meetings(c) + (c.at ? 5 : 0)
  a.coaches = a.coaches.filter(c => c.at || a.rival === c.id || meetings(c) >= 2 ||
    c.out == null || absWeek(state.season, state.week) - c.out < 100)
  if (a.coaches.length > ARC_CAPS.coaches) {
    const keep = new Set([...a.coaches].sort((x, y) => score(y) - score(x) || y.id - x.id).slice(0, ARC_CAPS.coaches).map(c => c.id))
    a.coaches = a.coaches.filter(c => keep.has(c.id))
  }
}

const clubShort = (state: GameState, id: string | undefined) => (id && state.clubs[id]?.short) || ''

/** The values every coach story carries. */
function coachVars(state: GameState, c: Coach): Vars {
  return {
    coach: c.n, club: clubShort(state, c.at), w: c.w, d: c.d, l: c.l,
    draws_k: c.d ? 'arc.drawsSome' : 'common.nothing', ...subjectVar(c.g),
  }
}

/** Why the two of you are rivals, as a fragment key. */
function whyOf(c: Coach): string {
  if (c.ti > 0) return 'arc.whyTitle'
  if (c.po >= 2) return 'arc.whyPoach'
  if (c.ko >= 2) return 'arc.whyKnockout'
  if (c.cl >= 3) return 'arc.whyClose'
  return 'arc.whyOften'
}

/** Name the rival, or keep the one there is. */
function pickRival(state: GameState, summer = false): void {
  const a = arcOf(state)
  const cur = coachById(state, a.rival)
  const best = a.coaches
    .filter(c => meetings(c) >= RIVAL_MEETINGS && c.heat >= RIVAL_AT)
    .sort((x, y) => y.heat - x.heat || x.id - y.id)[0]
  if (!best || best.id === cur?.id) return
  if (cur && best.heat <= cur.heat * 1.4 + 1) return
  a.rival = best.id
  a.rivalS = state.season
  arcFile(state, cur ? 'arc.rivalNew' : 'arc.rivalBorn',
    { ...coachVars(state, best), why_k: whyOf(best), old: cur?.n ?? '' }, { summer })
}

// ---------------------------------------------------------------- hooks ---

/** season.ts afterClubMatch, competitive club matches only. */
export function coachAfterMatch(state: GameState, fx: Fixture): void {
  if (ARC_OFF.on || state.unemployed || fx.compId === 'fr') return
  const uid = state.userClubId
  if (fx.homeId !== uid && fx.awayId !== uid) return
  const oppId = fx.homeId === uid ? fx.awayId : fx.homeId
  const c = coachAt(state, oppId, true)
  if (!c) return
  const us = fx.homeId === uid ? fx.homeScore : fx.awayScore
  const them = fx.homeId === uid ? fx.awayScore : fx.homeScore
  if (us > them) c.w++; else if (us < them) c.l++; else c.d++
  let h = 0.4
  if (Math.abs(us - them) <= 7) { h += 0.6; c.cl++ }
  if (fx.stage) { c.ko++; h += fx.stage === 'F' ? 2.5 : 1.2 }
  c.heat = Math.min(15, c.heat + h)
  c.last = state.season
  pickRival(state)
}

/** jobs.ts refreshVacancies, the moment a club parts with its coach. */
export function coachSacked(state: GameState, club: Club): void {
  if (ARC_OFF.on) return
  const c = arcOf(state).coaches.find(x => x.at === club.id)
  if (!c) return
  leave(state, c, 's')
  if (!state.unemployed && notable(state, c)) {
    const rival = state.arc?.rival === c.id
    arcFile(state, rival ? 'arc.rivalSacked' : 'arc.coachSacked', { ...coachVars(state, c), club: club.short })
  }
}

/**
 * jobs.ts refreshVacancies, once the new coach and his philosophy are drawn.
 * A known coach out of work whose idea of rugby is the one this club has just
 * chosen may take the job instead of the stranger: the same dials either way,
 * so only the name on the door changes.
 */
export function coachAppoint(state: GameState, club: Club): void {
  if (ARC_OFF.on || !club.philosophy) return
  const a = arcOf(state)
  const now = absWeek(state.season, state.week)
  const g = club.coachGender ?? 'm'
  const pool = a.coaches.filter(c => !c.at && c.out != null && now - c.out >= 4 && meetings(c) >= 1 &&
    c.ph === club.philosophy && (c.g ?? 'm') === g)
  if (!pool.length) return
  if (arcHash(`${state.seed}|${club.id}|${state.season}|${state.week}|appoint`) % 100 >= RETURN_PCT) return
  const c = pool.sort((x, y) => (y.heat + meetings(y) * 0.2) - (x.heat + meetings(x) * 0.2) || x.id - y.id)[0]
  const home = c.st.some(s => s.c === club.id)
  club.coach = c.n
  join(state, c, club)
  if (!state.unemployed && notable(state, c)) {
    arcFile(state, home ? 'arc.coachBackHome' : 'arc.coachBack', {
      ...coachVars(state, c), club: club.short,
      rival_k: state.arc?.rival === c.id ? 'arc.backRival' : 'common.nothing',
    })
  }
}

/**
 * season.ts, once the week has turned: seats kept in step, the players taken
 * from you counted, and the week of a meeting with your rival announced.
 */
export function coachWeek(state: GameState): void {
  if (ARC_OFF.on) return
  const a = arcOf(state)
  for (const c of [...a.coaches]) if (c.at) coachAt(state, c.at)
  if (state.unemployed) return
  // ---- the players they take from you ----
  for (const pc of state.preContracts ?? []) {
    if (a.pcSeen.includes(pc.playerId)) continue
    a.pcSeen.push(pc.playerId)
    if (a.pcSeen.length > 60) a.pcSeen.splice(0, a.pcSeen.length - 60)
    const p = state.players[pc.playerId]
    if (!p || state.clubs[pc.toClubId] == null) continue
    poached(state, pc.toClubId, p.name, 2, p.id)
  }
  for (const e of state.memory?.entries ?? []) {
    if (e.id <= a.memSeen) continue
    a.memSeen = Math.max(a.memSeen, e.id)
    if (e.kind !== 'sold' && e.kind !== 'let-go') continue
    if (e.playerId != null && a.pcSeen.includes(e.playerId)) continue
    const to = e.payload?.to
    if (typeof to !== 'string' || !state.clubs[to]) continue
    poached(state, to, String(e.payload?.name ?? ''), e.kind === 'sold' ? 1 : 1.6, e.playerId)
  }
  pickRival(state)
  // ---- the week you meet your rival ----
  const fx = state.fixtures.find(f => f.week === state.week && !f.played && f.compId !== 'fr' &&
    (f.homeId === state.userClubId || f.awayId === state.userClubId))
  const rival = rivalCoach(state)
  if (fx && rival?.at && (fx.homeId === rival.at || fx.awayId === rival.at) && onceArc(state, `rw:${fx.id}`)) {
    arcFile(state, 'arc.rivalWeek', coachVars(state, rival))
  }
}

function poached(state: GameState, clubId: string, player: string, h: number, playerId?: number): void {
  const c = coachAt(state, clubId, true)
  if (!c) return
  c.po++
  c.heat = Math.min(15, c.heat + h)
  if (notable(state, c) && player) {
    arcFile(state, 'arc.poach', {
      ...coachVars(state, c), player,
      again_k: c.po >= 2 ? 'arc.poachAgain' : 'common.nothing',
    }, { type: 'gossip', playerId })
  }
}

/** rollover.ts, before the tables are wiped: titles decided between you, the
 *  summer's cooling, and a rival you have stopped meeting fades. */
export function coachYearEnd(state: GameState): void {
  if (ARC_OFF.on) return
  const a = arcOf(state)
  if (!state.unemployed) {
    const club = state.clubs[state.userClubId]
    const comp = club ? state.comps[club.leagueId] : undefined
    if (comp?.table?.length) {
      const top = sortTable(comp.table).slice(0, 2).map(r => r.teamId)
      if (top.includes(state.userClubId)) {
        const other = top.find(id => id !== state.userClubId)
        const c = other ? coachAt(state, other, true) : null
        if (c) { c.ti++; c.heat = Math.min(15, c.heat + 2.5) }
      }
    }
  }
  pickRival(state, true)
  for (const c of a.coaches) c.heat = Math.round(c.heat * COOL * 100) / 100
  const rival = rivalCoach(state)
  if (rival && rival.heat < RIVAL_FADE) {
    delete a.rival
    delete a.rivalS
    if (!state.unemployed) arcFile(state, 'arc.rivalFades', coachVars(state, rival), { summer: true })
  }
  pruneCoaches(state)
}

/** The opposition report's line when your rival is in their dugout
 *  (oppreport.ts, 1.8.5): the billing's line, which the match preview gives
 *  only when nothing outranks it. Null otherwise. */
export function rivalAt(state: GameState, oppId: string): { k: string; v: Vars } | null {
  if (ARC_OFF.on || state.unemployed || !state.arc) return null
  const r = rivalCoach(state)
  if (!r || r.at !== oppId || r.n !== state.clubs[oppId]?.coach) return null
  return { k: 'arc.stakeRival', v: coachVars(state, r) }
}

/** stakes.ts: the billing line for the man in the other dugout. */
export function coachStakes(state: GameState, fx: Fixture): { text: string; weight: number }[] {
  if (ARC_OFF.on || state.unemployed || !state.arc) return []
  const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.homeId
  const c = state.arc.coaches.find(x => x.at === oppId && x.n === state.clubs[oppId]?.coach)
  if (!c || meetings(c) < 2) return []
  const v = coachVars(state, c)
  if (state.arc.rival === c.id) return [{ text: t('arc.stakeRival', v), weight: 77 }]
  return [{ text: t('arc.stakeRecord', v), weight: 57 + Math.min(10, meetings(c)) }]
}

/** The Legacy screen's rows: your rival first, then the men you have met most. */
export function coachRows(state: GameState): { c: Coach; rival: boolean; club: string; idea: string }[] {
  const a = state.arc
  if (!a) return []
  return a.coaches
    .filter(c => meetings(c) >= 2 || a.rival === c.id)
    .sort((x, y) => (a.rival === y.id ? 1 : 0) - (a.rival === x.id ? 1 : 0) || meetings(y) - meetings(x) || y.heat - x.heat)
    .slice(0, 6)
    .map(c => ({
      c, rival: a.rival === c.id,
      club: c.at ? clubShort(state, c.at) : '',
      idea: c.ph && PHILOSOPHY_BY_ID[c.ph] ? t(PHILOSOPHY_BY_ID[c.ph].name) : '',
    }))
}
