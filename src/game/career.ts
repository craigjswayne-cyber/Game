/**
 * ---- THE CAREER HAS A LENGTH, AND AN ENDING ----
 *
 * Playbook wave 3. Wave 1 gave a save a REASON (the Dream, dream.ts); this
 * gives it a FINISH LINE, which is the other half of the same idea. A manager
 * game where the manager never ages has no third act: there is no last season,
 * so nothing is ever the last chance, and the Dream can always be chased next
 * year instead of this one. An ending is what makes the middle matter.
 *
 * Four rules, deliberately the same shape as the Dream's:
 *
 *   1. THE CLOCK IS VISIBLE AND HONEST. The manager has an age from the first
 *      week, it advances every summer, and the game says how long is left
 *      rather than springing the end on anybody.
 *   2. GOING IS A CHOICE UNTIL IT IS NOT. From 62 he may hang up the clipboard
 *      whenever he likes. At 70 the decision is made for him, because a career
 *      that can be extended forever is not a career.
 *   3. THE VERDICT IS COMPUTED, NEVER STORED, and it is honest when the answer
 *      is unflattering. A manager who won nothing is told he won nothing. A
 *      grade that flatters is a grade nobody believes - the same reason the
 *      Dream says "still in the Championship" rather than "1 of 2 complete".
 *   4. THE ENGINE NEVER READS IT. Age changes no simulated number: no decline,
 *      no wisdom bonus, nothing. It is a clock and a verdict, so it cannot move
 *      the fingerprint or the balance.
 */
import { LEAGUE_TIER, mgrReputation } from './model'
import type { GameState } from './model'
import { dreamState } from './dream'
import { t } from './i18n'

/** Youngest a manager may start; the wizard offers a spread around this. */
export const START_AGE = 42
/** From here the game offers him the door. */
export const RETIRE_OPEN = 62
/** Here it stops offering and opens it. */
export const RETIRE_FORCED = 70

/** His age now, defaulting for saves written before the clock existed. */
export const mgrAge = (state: GameState): number =>
  state.mgrAge ?? START_AGE + state.season

export type Stage = 'young' | 'established' | 'veteran' | 'twilight'

export function careerStage(state: GameState): Stage {
  const a = mgrAge(state)
  if (a < 50) return 'young'
  if (a < RETIRE_OPEN) return 'established'
  if (a < RETIRE_FORCED - 3) return 'veteran'
  return 'twilight'
}

/** Seasons left before the game makes the decision for him. */
export const seasonsLeft = (state: GameState): number =>
  Math.max(0, RETIRE_FORCED - mgrAge(state))

export const mayRetire = (state: GameState): boolean =>
  !state.retired && mgrAge(state) >= RETIRE_OPEN

/** What the clock should say on the manager's own screen. */
export function clockLine(state: GameState): string {
  if (state.retired) return t('legacy.cvRetired')
  const a = mgrAge(state)
  const left = seasonsLeft(state)
  if (a < 50) return t('legacy.cvYoungClock', { age: a })
  if (a < RETIRE_OPEN) return t('legacy.cvMiddleClock', { age: a })
  if (left > 4) return t('legacy.cvOpenClock', { age: a })
  if (left > 1) return t('legacy.cvSeasonsLeft', { age: a, n: left })
  return t('legacy.cvLastOne', { age: a })
}

export interface Verdict {
  /** A-F, and F is real */
  grade: string
  /** how the game of rugby will remember him, in one line */
  title: string
  /** the case for that verdict, in the manager's own numbers */
  lines: string[]
  /** 0-100, for a bar */
  score: number
}

/**
 * The final reckoning, computed from the record and nothing else.
 *
 * A PURE LENS. Reads state, draws no rng, writes nothing - so it can be shown
 * on a screen every week of a career without ever changing one.
 */
export function careerVerdict(state: GameState): Verdict {
  const m = state.mgr
  const games = m.m
  const winPct = games ? m.w / games : 0
  const trophies = m.trophies.length
  const titles = m.finishes.filter(f => f.pos === 1).length
  const topFlight = m.finishes.filter(f => LEAGUE_TIER[f.leagueId] === 1).length
  const seasons = m.finishes.length
  const legends = state.legendOf?.length ?? 0
  const d = dreamState(state)
  const dreamDone = !!d?.progress.done

  // the score. Trophies dominate, because they do; longevity and a good record
  // carry a career that never quite won one.
  const score = Math.min(100, Math.round(
    trophies * 9
    + titles * 4
    + topFlight * 1.2
    + seasons * 0.8
    + winPct * 26
    + legends * 4
    + (dreamDone ? 10 : 0),
  ))

  const grade = score >= 88 ? 'A+' : score >= 76 ? 'A' : score >= 64 ? 'B'
    : score >= 50 ? 'C' : score >= 34 ? 'D' : score >= 18 ? 'E' : 'F'

  const title = t(score >= 88 ? 'legacy.cvTitleGreat'
    : score >= 76 ? 'legacy.cvTitleBigger'
    : score >= 64 ? 'legacy.cvTitleSerious'
    : score >= 50 ? 'legacy.cvTitleGood'
    : score >= 34 ? 'legacy.cvTitleWorking'
    : score >= 18 ? 'legacy.cvTitleTried'
    : 'legacy.cvTitleNever')

  const lines: string[] = []
  lines.push(seasons
    ? t(seasons === 1 ? 'legacy.cvSeasonsOne' : 'legacy.cvSeasons', { n: seasons, games, pct: Math.round(winPct * 100) })
    : t('legacy.cvShort'))
  lines.push(trophies
    ? t(trophies === 1 ? 'legacy.cvTrophyOne' : 'legacy.cvTrophies', {
        n: trophies,
        titles: titles ? t(titles === 1 ? 'legacy.cvInclTitleOne' : 'legacy.cvInclTitles', { n: titles }) : '',
      })
    : t('legacy.cvNoTrophy'))
  if (topFlight) lines.push(t(topFlight === 1 ? 'legacy.cvTopFlightOne' : 'legacy.cvTopFlight', { n: topFlight }))
  if (legends) lines.push(t(legends === 1 ? 'legacy.cvLegendOne' : 'legacy.cvLegends', { n: legends }))
  if (d) {
    lines.push(dreamDone
      ? t('legacy.cvDreamDone', { dream: d.title.toLowerCase() })
      : t('legacy.cvDreamMissed', { dream: d.title.toLowerCase(), note: `${d.progress.note[0].toUpperCase()}${d.progress.note.slice(1)}` }))
  }
  lines.push(t('legacy.cvRepEnd', { rep: mgrReputation(state) }))

  return { grade, title, lines, score }
}

/**
 * Hang it up. Returns the sentence the screen should show.
 *
 * Deterministic and idempotent: retiring twice is not a thing.
 */
export function retire(state: GameState, forced = false): string {
  if (state.retired) return t('legacy.cvRetiredAlready')
  const v = careerVerdict(state)
  state.retired = { season: state.season, age: mgrAge(state), forced, grade: v.grade, score: v.score }
  state.news.push({
    id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
    subject: forced ? `The last whistle: ${state.managerName} retires` : `${state.managerName} hangs up the clipboard`,
    body: [
      forced
        ? `At ${mgrAge(state)}, the decision has been taken out of your hands. This is where the road ends.`
        : `You told them at the end of the season, and you meant it. At ${mgrAge(state)}, that is that.`,
      '',
      v.title + '.',
      '',
      ...v.lines,
    ].join('\n'),
  })
  return forced
    ? `Retired at ${mgrAge(state)}. ${v.title}.`
    : `You walk away at ${mgrAge(state)}. ${v.title}.`
}

/** Called once a summer from the rollover: the clock, and the hard stop. */
export function ageManager(state: GameState): void {
  if (state.retired) return
  state.mgrAge = mgrAge(state) + 1
  if (state.mgrAge >= RETIRE_FORCED) { retire(state, true); return }
  if (state.mgrAge === RETIRE_OPEN) {
    state.news.push({
      id: state.nextId++, week: state.week, season: state.season, type: 'board', read: false,
      subject: `${RETIRE_OPEN} not out`,
      body: [
        `You turned ${RETIRE_OPEN} this summer, which in this trade is the age people start asking the question in press conferences.`,
        '',
        `There is no hurry. You can take the next season, and the one after that, and nobody will think less of you - but the door is open from here whenever you want it, and it closes on its own at ${RETIRE_FORCED}.`,
        '',
        'Your legacy screen will tell you what the game would say about you if you stopped today.',
      ].join('\n'),
    })
  }
}
