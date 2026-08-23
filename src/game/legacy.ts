// What the career is working towards.
//
// The Legacy screen was an obituary: career record, trophy cabinet, season by
// season, Hall of Fame. Every number on it had already happened, so there was
// nothing on the screen to play towards - which the audit called out as the reason
// a long save has no shape beyond the next fixture.
//
// The marks themselves were already in the engine and already celebrated. Your
// 250th win arrives with a salute in the corridor. But nothing anywhere had ever
// said that a 250th win was a thing, so the salute was a surprise rather than an
// arrival, and a surprise cannot be chased.
//
// This lives in the engine rather than inside the screen because it is arithmetic
// with edge cases at both ends - a first week, and a career past every mark on the
// list - and arithmetic inside JSX cannot be tested.
import { GAME_MARKS, WIN_MARKS } from './season'
import type { GameState } from './model'
import { ord, t } from './i18n'

export interface Horizon {
  label: string
  at: number
  goal: number
  /** the honest state of it, in a few words */
  note: string
}

/** The next mark above a count, or null once they are all behind you. */
const next = (marks: readonly number[], at: number): number | null =>
  marks.find(x => x > at) ?? null

/**
 * Up to four things this career is chasing, nearest first in spirit.
 *
 * Never empty and never wrong at the extremes: a manager one week into his first
 * job has four honest targets, and a manager past a thousand wins and twenty
 * seasons still has the next title. A screen that says "nothing left" to somebody
 * who is still playing is worse than no screen.
 */
export function horizon(state: GameState): Horizon[] {
  const m = state.mgr
  const rows: Horizon[] = []
  const nextWin = next(WIN_MARKS, m.w)
  const nextGame = next(GAME_MARKS, m.m)
  const seasons = m.finishes.length
  const titles = m.finishes.filter(f => f.pos === 1).length

  if (nextWin) {
    rows.push({ label: t('legacy.hzWins', { n: nextWin }), at: m.w, goal: nextWin, note: t('legacy.hzMore', { n: nextWin - m.w }) })
  }
  if (nextGame) {
    rows.push({ label: t('legacy.hzMatches', { n: nextGame }), at: m.m, goal: nextGame, note: t('legacy.hzMore', { n: nextGame - m.m }) })
  }
  // A title is always ahead of you: there is always another season.
  rows.push({
    label: titles === 0 ? t('legacy.hzFirstTitle') : t('legacy.hzNthTitle', { n: ord(titles + 1) }),
    at: titles,
    goal: titles + 1,
    note: titles === 0 ? t('legacy.hzNothingYet') : t('legacy.hzSoFar', { n: titles }),
  })
  // and so is the next decade of doing it
  const era = seasons < 10 ? 10 : seasons < 20 ? 20 : Math.ceil((seasons + 1) / 10) * 10
  rows.push({
    label: era === 10 ? t('legacy.hzDecade') : t('legacy.hzSeasonsInCharge', { n: era }),
    at: seasons,
    goal: era,
    note: t(seasons === 1 ? 'legacy.hzSeasonDone' : 'legacy.hzSeasonsDone', { n: seasons }),
  })
  return rows
}

/** How full a bar should be, 0-100, never past either end. */
export const horizonPct = (h: Horizon): number =>
  Math.max(0, Math.min(100, Math.round((h.at / Math.max(1, h.goal)) * 100)))
