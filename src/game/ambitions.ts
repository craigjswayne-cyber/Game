/**
 * ---- THE AMBITIONS A CAREER IS FOR ----
 *
 * dream.ts gave a career one reason to exist, named at the start and measured
 * every May. A long save needs more than one thread to pull, so the wizard now
 * lets a manager name ONE TO THREE, from the same book of dreams (which grew
 * the career ambitions: win the league, build a club from the bottom, become a
 * club's legend, rebuild a fallen giant, manage a national side).
 *
 * The first is still `state.dream`, so everything that reads the dream (the
 * Home card, the season review's May verdict, the refocus) is untouched. The
 * rest live in `state.ambitions` beside it.
 *
 * Progress is COMPUTED, never stored, exactly as dream.ts insists: each
 * ambition reads its own state out of the save. What is stored is only what
 * has been SAID: the milestones reached (a quarter of the way, half, three
 * quarters, done), each written into the ambition's log with its season and
 * told in the news once. The profile shows the percentage and the log.
 *
 * The engine never reads any of it.
 */
import type { GameState } from './model'
import type { Vars } from './i18n'
import { dreamById, dreamPct, type DreamContext, type DreamDef, type DreamProgress } from './dream'
import { ARC_OFF, arcFile, type Ambition } from './arcbook'

export const MAX_AMBITIONS = 3
const STEPS = [25, 50, 75, 100]

/** The ambitions of this career: the dream first, then the others, once each. */
export function ambitionsOf(state: GameState): Ambition[] {
  const out: Ambition[] = []
  const add = (x: Ambition | undefined | null) => {
    if (x && typeof x.id === 'string' && dreamById(x.id) && !out.some(o => o.id === x.id)) out.push(x)
  }
  if (state.dream) add((state.ambitions ?? []).find(a => a.id === state.dream!.id) ?? { ...state.dream })
  for (const a of state.ambitions ?? []) add(a)
  return out.slice(0, MAX_AMBITIONS + 1)
}

/** The context an ambition's wording is filled from. */
export function ambitionCtx(state: GameState, a: Ambition): DreamContext {
  const club = state.clubs[a.clubId]
  return { clubId: a.clubId, clubName: club?.short ?? club?.name ?? a.clubId, leagueId: club?.leagueId ?? 'prem', rep: club?.rep ?? 70 }
}

export function ambitionState(state: GameState, a: Ambition): { def: DreamDef; ctx: DreamContext; p: DreamProgress; pct: number } | null {
  const def = dreamById(a.id)
  if (!def) return null
  const p = def.progress(state, a.clubId)
  return { def, ctx: ambitionCtx(state, a), p, pct: dreamPct(p) }
}

/** The wizard: stamp the ambitions on a new career. The first is the dream. */
export function setAmbitions(state: GameState, ids: string[]): void {
  const list = [...new Set(ids)].filter(id => !!dreamById(id)).slice(0, MAX_AMBITIONS)
  if (!list.length) return
  state.dream = { id: list[0], clubId: state.userClubId, season: state.season }
  state.ambitions = list.map(id => ({ id, clubId: state.userClubId, season: state.season }))
  // the milestones start from where the career starts: an ambition already a
  // quarter done on day one is not news
  for (const a of state.ambitions) {
    const s = ambitionState(state, a)
    a.pct = s ? STEPS.filter(x => x <= s.pct).pop() ?? 0 : 0
  }
}

/**
 * Once a week (arc.ts): an ambition that has crossed a milestone since it was
 * last looked at has the milestone logged and told. A save from before
 * ambitions existed gets its dream written in as the first, from today.
 */
export function ambitionsWeek(state: GameState): void {
  if (ARC_OFF.on) return
  // an old save's dream, or a dream named afresh after one was realised, joins
  // the list from today: its milestones count from where it stands now
  if (state.dream && !(state.ambitions ?? []).some(a => a.id === state.dream!.id)) {
    const a: Ambition = { ...state.dream }
    const s = ambitionState(state, a)
    a.pct = s ? STEPS.filter(x => x <= s.pct).pop() ?? 0 : 0
    ;(state.ambitions ??= []).unshift(a)
    if (state.ambitions.length > MAX_AMBITIONS + 2) state.ambitions.length = MAX_AMBITIONS + 2
  }
  for (const a of state.ambitions ?? []) {
    const s = ambitionState(state, a)
    if (!s) continue
    const reached = STEPS.filter(x => x <= s.pct).pop() ?? 0
    if (reached <= (a.pct ?? 0)) continue
    a.pct = reached
    ;(a.log ??= []).push({ s: state.season, p: reached })
    if (a.log.length > STEPS.length) a.log.splice(0, a.log.length - STEPS.length)
    const v: Vars = {
      title_k: s.def.titleK, ...(s.def.titleVars?.(s.ctx) ?? {}),
      note_k: s.p.noteK, ...(s.p.noteV ?? {}), pct: reached,
    }
    arcFile(state, reached >= 100 ? 'arc.ambDone' : 'arc.ambStep', v, { type: 'award' })
  }
}
