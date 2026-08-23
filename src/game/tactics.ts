// Tactical vocabulary: what the sliders actually do, one-tap game plans,
// and the coaching philosophies you can bring to a club.
//
// Every string in here is an i18n KEY rather than the words themselves. These
// tables are built once at module load and the language can change afterwards,
// so a table of English would go stale the moment somebody used the picker; the
// screens call t() on whichever field they render. The English wording lives in
// src/locales/en.json under `tactics`.

import type { Tactic } from './model'
import { t } from './i18n'

export type SliderKey = 'style' | 'tempo' | 'kicking' | 'aggression'

export interface SliderInfo {
  key: SliderKey
  label: string
  lo: string
  hi: string
  /** what pushing the slider UP does */
  up: string
  /** what pulling it DOWN does */
  down: string
}

export const SLIDER_INFO: SliderInfo[] = [
  {
    key: 'style', label: 'tactics.sliderStyle', lo: 'tactics.sliderStyleLo', hi: 'tactics.sliderStyleHi',
    up: 'tactics.sliderStyleUp',
    down: 'tactics.sliderStyleDown',
  },
  {
    key: 'tempo', label: 'tactics.sliderTempo', lo: 'tactics.sliderTempoLo', hi: 'tactics.sliderTempoHi',
    up: 'tactics.sliderTempoUp',
    down: 'tactics.sliderTempoDown',
  },
  {
    // A DIAL WITH A HIDDEN PRICE IS NOT A DECISION. Both of these now name what
    // the setting costs as well as what it buys, because the release audit's
    // Pass 2 found kicking was a free lunch worth eleven league points a season
    // and the readout said nothing about giving anything up. The engine gives
    // the boot its territory and takes attacking continuity for it, so the words
    // have to say that or the player is being asked to choose blind.
    key: 'kicking', label: 'tactics.sliderKicking', lo: 'tactics.sliderKickingLo', hi: 'tactics.sliderKickingHi',
    up: 'tactics.sliderKickingUp',
    down: 'tactics.sliderKickingDown',
  },
  {
    // Physicality is the referee read (see aggPenRisk in matchEngine): worth
    // about two and a half points a match in front of a lenient whistle and
    // about a point and a half AGAINST you in front of a fussy one, measured by
    // scripts/dialweight.ts. The referee is named on the pre-match briefing, so
    // this line points at him rather than describing a wash.
    key: 'aggression', label: 'tactics.sliderAggression', lo: 'tactics.sliderAggressionLo', hi: 'tactics.sliderAggressionHi',
    up: 'tactics.sliderAggressionUp',
    down: 'tactics.sliderAggressionDown',
  },
]

/** A short plain-English readout of a current setting, for the UI. */
export function sliderReadout(key: SliderKey, v: number): string {
  const info = SLIDER_INFO.find(s => s.key === key)!
  if (v >= 66) return t(info.up)
  if (v <= 34) return t(info.down)
  return t('tactics.balancedReadout')
}

// ---- the without-ball system (18D) ----------------------------------------
// FM26 splits the tactic screen into with-ball and without-ball shapes; ours
// does the same with two dials that default to 50 (which the engine treats as
// literally absent, so old saves and the sim fingerprint are untouched).

export type DefSliderKey = 'defLine' | 'defWidth'

export const DEF_SLIDER_INFO: { key: DefSliderKey; label: string; lo: string; hi: string; up: string; down: string }[] = [
  {
    key: 'defLine', label: 'tactics.sliderDefLine', lo: 'tactics.sliderDefLineLo', hi: 'tactics.sliderDefLineHi',
    up: 'tactics.sliderDefLineUp',
    down: 'tactics.sliderDefLineDown',
  },
  {
    key: 'defWidth', label: 'tactics.sliderDefWidth', lo: 'tactics.sliderDefWidthLo', hi: 'tactics.sliderDefWidthHi',
    up: 'tactics.sliderDefWidthUp',
    down: 'tactics.sliderDefWidthDown',
  },
]

/** Plain-English readout of a without-ball dial, for the UI. */
export function defSliderReadout(key: DefSliderKey, v: number): string {
  const info = DEF_SLIDER_INFO.find(s => s.key === key)!
  if (v >= 66) return t(info.up)
  if (v <= 34) return t(info.down)
  return t('tactics.balancedReadout')
}

export interface Preset {
  id: string
  name: string
  icon: string
  desc: string
  values: Omit<Tactic, 'lineup'>
}

/** One-tap game plans, FM shout style. */
export const PRESETS: Preset[] = [
  {
    id: 'allout', name: 'tactics.presetAllout', icon: '⚔️',
    desc: 'tactics.presetAlloutDesc',
    values: { style: 82, tempo: 85, kicking: 18, aggression: 58 },
  },
  {
    id: 'shutup', name: 'tactics.presetShutup', icon: '🧱',
    desc: 'tactics.presetShutupDesc',
    values: { style: 32, tempo: 22, kicking: 70, aggression: 42 },
  },
  {
    id: 'corners', name: 'tactics.presetCorners', icon: '🎯',
    desc: 'tactics.presetCornersDesc',
    values: { style: 42, tempo: 45, kicking: 86, aggression: 52 },
  },
  {
    id: 'tight', name: 'tactics.presetTight', icon: '🤜',
    desc: 'tactics.presetTightDesc',
    values: { style: 14, tempo: 34, kicking: 56, aggression: 68 },
  },
  {
    id: 'balanced', name: 'tactics.presetBalanced', icon: '⚖️',
    desc: 'tactics.presetBalancedDesc',
    values: { style: 50, tempo: 50, kicking: 50, aggression: 50 },
  },
]

export interface CoachingStyle {
  id: string
  name: string
  desc: string
  /** applied to a fresh tactic when the career starts */
  tactic: Partial<Omit<Tactic, 'lineup'>>
}

/** Researched rugby philosophies for the New Career wizard. */
export const COACHING_STYLES: CoachingStyle[] = [
  {
    id: 'balanced', name: 'tactics.styleBalanced',
    desc: 'tactics.styleBalancedDesc',
    tactic: {},
  },
  {
    id: 'forwards', name: 'tactics.styleForwards',
    desc: 'tactics.styleForwardsDesc',
    tactic: { style: 28, kicking: 60, aggression: 62 },
  },
  {
    id: 'expansive', name: 'tactics.styleExpansive',
    desc: 'tactics.styleExpansiveDesc',
    tactic: { style: 78, tempo: 66, kicking: 36 },
  },
  {
    id: 'territory', name: 'tactics.styleTerritory',
    desc: 'tactics.styleTerritoryDesc',
    tactic: { style: 40, tempo: 42, kicking: 82 },
  },
  {
    id: 'hightempo', name: 'tactics.styleHightempo',
    desc: 'tactics.styleHightempoDesc',
    tactic: { style: 60, tempo: 88, kicking: 40 },
  },
  {
    id: 'defensive', name: 'tactics.styleDefensive',
    desc: 'tactics.styleDefensiveDesc',
    tactic: { style: 38, tempo: 38, kicking: 62, aggression: 46 },
  },
  {
    id: 'counter', name: 'tactics.styleCounter',
    desc: 'tactics.styleCounterDesc',
    tactic: { style: 64, tempo: 58, kicking: 58 },
  },
  {
    id: 'offload', name: 'tactics.styleOffload',
    desc: 'tactics.styleOffloadDesc',
    tactic: { style: 72, tempo: 62, kicking: 30, aggression: 56 },
  },
]
