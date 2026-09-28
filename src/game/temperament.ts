// ---- WHAT THE SCOUTS LEARN ABOUT A MAN'S NERVE (1.8.0, E8) ----
//
// Hidden consistency and big-match temperament have shaped every match since
// 25D-2 (attributes.ts consistency / bigMatchTemper, read by teamUnits), and by
// design nothing ever showed them. The owner's call for 1.8.0: scouting hints
// at them. So the traits stay hidden numbers, and what the screen gets is a
// sentence in plain words, as sure as the knowledge behind it:
//
//   ANOTHER CLUB'S MAN. Nothing below a detailed report (scout.ts stage 2):
//   a weekend of tape tells you how he plays, not how he holds his nerve. A
//   detailed report gives a hedged read, and only where he leans clearly one
//   way; the full file (stage 3, the same point his character is verified)
//   gives the plain one.
//   YOUR OWN. Knowledge of his numbers is complete the day he signs, but his
//   nerve is learned by watching him play for you: a hedged read after
//   FAIR_APPS appearances for the club, the plain one after KNOWN_APPS. A good
//   analyst (analyst.ts analystSkill, the briefing suite and the assistant)
//   has done the homework on his tape and counts for matches of his own.
//
// Pure reads of (seed, id) and the save: nothing is stored, nothing rolled.
import type { GameState, Player } from './model'
import { benchDrag, bigMatchTemper, consistency } from './attributes'
import { analystSkill } from './analyst'
import { reportStage } from './scout'

export const KNOWN_APPS = 10
export const FAIR_APPS = 4

export type ReadLevel = 'none' | 'pending' | 'vague' | 'full'
export type ConsBand = 'steady' | 'mid' | 'erratic'
export type BigBand = 'thrive' | 'mid' | 'freeze'

/** The bands, on the hidden numbers. consistency runs 0.02-0.07 uniform, so
 *  each end is three players in ten; bigMatchTemper runs -1..1 uniform, same. */
export function consBand(seed: number, id: number): ConsBand {
  const c = consistency(seed, id)
  return c < 0.035 ? 'steady' : c > 0.055 ? 'erratic' : 'mid'
}
export function bigBand(seed: number, id: number): BigBand {
  const b = bigMatchTemper(seed, id)
  return b > 0.4 ? 'thrive' : b < -0.4 ? 'freeze' : 'mid'
}

/** Appearances for the manager's club: every past season there, and this one
 *  while he is still on the books. */
export function appsForUser(state: GameState, p: Player): number {
  let n = p.clubId === state.userClubId ? p.stats.apps : 0
  for (const r of p.career) if (r.clubId === state.userClubId) n += r.apps
  return n
}

/** Matches' worth of knowing him that the analyst's homework is worth. */
export function analystApps(state: GameState): number {
  const s = analystSkill(state)
  return s >= 0.6 ? KNOWN_APPS : s >= 0.48 ? FAIR_APPS : 0
}

/** How sure the club is about his temperament. */
export function readLevel(state: GameState, p: Player): ReadLevel {
  if (p.clubId && p.clubId === state.userClubId) {
    const n = appsForUser(state, p) + analystApps(state)
    return n >= KNOWN_APPS ? 'full' : n >= FAIR_APPS ? 'vague' : 'pending'
  }
  const st = reportStage(state, p)
  return st >= 3 ? 'full' : st >= 2 ? 'vague' : 'none'
}

export interface TemperRead {
  level: ReadLevel
  /** i18n keys, in the order the screen shows them (the player screen adds
   *  _f for a woman through its own gendered t) */
  lines: { k: string; v?: Record<string, number> }[]
}

/**
 * The lines for the player screen. At 'full' both traits are named plainly,
 * middle bands included. At 'vague' a trait is named, hedged, only when he
 * leans clearly one way; a middle band says there is no clear read yet. At
 * 'pending' (your own man, too few matches) one line says how far off it is;
 * at 'none' there is nothing at all.
 */
export function temperRead(state: GameState, p: Player): TemperRead {
  const level = readLevel(state, p)
  if (level === 'none') return { level, lines: [] }
  if (level === 'pending') {
    return { level, lines: [{ k: 'player.tempPending', v: { n: appsForUser(state, p), of: KNOWN_APPS } }] }
  }
  const c = consBand(state.seed, p.id)
  const b = bigBand(state.seed, p.id)
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1)
  const suffix = level === 'vague' ? 'V' : ''
  return {
    level,
    lines: [
      { k: `player.cons${cap(c)}${suffix}` },
      { k: `player.big${cap(b)}${suffix}` },
    ],
  }
}

/**
 * THE NO-MINUTES NOTE (E7). The summer growth roll docks a young senior who
 * made two starts or fewer (rollover.ts devFactor), and a professional loses
 * about half as much of it (attributes.ts benchDrag). Nothing ever said so, so
 * a manager could leave a prospect out for a season and never learn why he
 * did not grow. Shown on his page once the season is a dozen weeks old and he
 * is still short: age 22 or under, because the roll reads the age he turns in
 * the summer and stops at 23.
 */
export function benchNote(state: GameState, p: Player): { k: string; v: Record<string, number> } | null {
  if (p.clubId !== state.userClubId || p.acad || p.age > 22) return null
  if (state.week < 12 || p.stats.starts > 2) return null
  return { k: benchDrag(p) <= 0.8 ? 'player.benchNotePro' : 'player.benchNote', v: { n: p.stats.starts } }
}
