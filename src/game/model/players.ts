// The player sheet's constants and helpers: attributes, season stats,
// partnership chemistry, the career table, positions and shirts.
import type { Pos } from '../../data/types'
import { t } from '../i18n'
import type { CareerRow, Player, SeasonStats } from './types'

export const ATTR_KEYS = [
  'tac', 'str', 'scr', 'lin', 'ruc', 'han', 'pas', 'kic', 'goa',
  'pac', 'sta', 'agi', 'vis', 'dec', 'pos', 'agg', 'lea', 'wor',
] as const

export const emptyStats = (): SeasonStats => ({
  apps: 0, starts: 0, tries: 0, points: 0, cons: 0, pens: 0, drops: 0,
  yc: 0, rc: 0, ratingSum: 0, motm: 0, mins: 0, mSum: 0, mApps: 0,
})

/** 1,300+ minutes (about sixteen full eighty-minute games) is the red zone:
 *  tired bodies break. Counted from the minutes each man was actually on the
 *  pitch (matchEngine finalizeMatch), not a flat figure per appearance. */
export const inRedZone = (p: { stats: { mins: number } }) => p.stats.mins >= 1300

/** Partnership chemistry: lineup slot pairs whose familiarity matters -
 *  LH-HK, HK-TH, the lock pairing, the halfbacks, the centres. */
export const CHEM_SLOTS: [number, number][] = [[0, 1], [1, 2], [3, 4], [8, 9], [11, 12]]
export const chemKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
export const chemTier = (g: number) =>
  t(g >= 50 ? 'common.chemTelepathic' : g >= 25 ? 'common.chemEstablished'
    : g >= 10 ? 'common.chemSettled' : g >= 5 ? 'common.chemSettlingIn' : 'common.chemBrandNew')

/** How many seasons Player.career lists before the oldest is folded away. */
export const CAREER_ROWS = 20

/** Every season of his club career this world has seen: the folded seasons
 *  (careerOld) and the table (career). What totals and club tallies read;
 *  career alone is the last CAREER_ROWS seasons and undercounts a long one. */
export function careerRows(p: { career: CareerRow[]; careerOld?: CareerRow[] }): CareerRow[] {
  return p.careerOld?.length ? [...p.careerOld, ...p.career] : p.career
}

/** Push this season's row and fold whatever the table no longer has room for
 *  into careerOld, one summed row per club (rollover.ts). */
export function archiveSeason(p: Pick<Player, 'career' | 'careerOld'>, row: CareerRow): void {
  p.career.push(row)
  foldCareer(p)
}

/** Fold the rows past CAREER_ROWS out of the table and into careerOld. */
export function foldCareer(p: Pick<Player, 'career' | 'careerOld'>): void {
  while (p.career.length > CAREER_ROWS) {
    const old = p.career.shift()!
    const into = (p.careerOld ??= []).find(r => r.clubId === old.clubId)
    if (into) {
      into.apps += old.apps; into.tries += old.tries; into.points += old.points
      into.season = Math.max(into.season, old.season)
    } else p.careerOld.push({ ...old })
  }
}

/** Appearances this player made for a club he has since left - 0 if he is
 *  still there. Fuels the old-boy storyline when the fixture list brings
 *  him back to a former home. */
export function oldBoyApps(p: Player, clubId: string): number {
  if (p.clubId === clubId) return 0
  let apps = p.exClub === clubId ? (p.exApps ?? 0) : 0
  for (const r of careerRows(p)) if (r.clubId === clubId) apps += r.apps
  return apps
}

export const POS_ORDER: Pos[] = ['LP', 'HK', 'TP', 'LK', 'FL', 'N8', 'SH', 'FH', 'CE', 'WG', 'FB']

export const POS_NAMES: Record<Pos, string> = {
  LP: 'Loosehead Prop', HK: 'Hooker', TP: 'Tighthead Prop', LK: 'Lock',
  FL: 'Flanker', N8: 'Number 8', SH: 'Scrum-Half', FH: 'Fly-Half',
  CE: 'Centre', WG: 'Wing', FB: 'Full-Back',
}

/** XV slot -> required position (index 0..14 = shirts 1..15) */
export const XV_SLOTS: { shirt: number; pos: Pos; label: string }[] = [
  { shirt: 1, pos: 'LP', label: 'LP' },
  { shirt: 2, pos: 'HK', label: 'HK' },
  { shirt: 3, pos: 'TP', label: 'TP' },
  { shirt: 4, pos: 'LK', label: 'LK' },
  { shirt: 5, pos: 'LK', label: 'LK' },
  { shirt: 6, pos: 'FL', label: 'BF' },
  { shirt: 7, pos: 'FL', label: 'OF' },
  { shirt: 8, pos: 'N8', label: 'N8' },
  { shirt: 9, pos: 'SH', label: 'SH' },
  { shirt: 10, pos: 'FH', label: 'FH' },
  { shirt: 11, pos: 'WG', label: 'LW' },
  { shirt: 12, pos: 'CE', label: 'IC' },
  { shirt: 13, pos: 'CE', label: 'OC' },
  { shirt: 14, pos: 'WG', label: 'RW' },
  { shirt: 15, pos: 'FB', label: 'FB' },
]

/** Bench slots 16-23: cover requirements */
export const BENCH_SLOTS: { shirt: number; pos: Pos[] }[] = [
  { shirt: 16, pos: ['HK'] },
  { shirt: 17, pos: ['LP', 'TP'] },
  { shirt: 18, pos: ['TP', 'LP'] },
  { shirt: 19, pos: ['LK', 'FL'] },
  { shirt: 20, pos: ['FL', 'N8', 'LK'] },
  { shirt: 21, pos: ['SH'] },
  { shirt: 22, pos: ['FH', 'CE'] },
  { shirt: 23, pos: ['CE', 'WG', 'FB', 'FH'] },
]
