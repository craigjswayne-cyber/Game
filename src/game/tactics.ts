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

/**
 * ---- THE DEFENSIVE SYSTEM, BY NAME (owner, v1.7.0) ----
 *
 * Competitor read: their defence is a dropdown of rugby words - drift, man to
 * man, press, sit back - where ours is two numbered dials. The engine has had
 * the mechanics since 18D (line speed buys defence and costs penalties; width
 * is a matchup against an expansive attack or a forward one), and a coach does
 * not think "sixty-two and thirty-eight", he thinks "we're going man on man".
 *
 * So these are five named points in that same two-dial space. Nothing new in
 * the engine: picking one SETS the dials, and the dials still move freely
 * afterwards - the readout simply names whichever system they now sit nearest.
 * That keeps one mechanism rather than two, so a system can never mean
 * something the sliders do not.
 */
export interface DefSystem {
  id: string
  name: string
  desc: string
  /** where this system sits on the two without-ball dials */
  line: number
  width: number
}

export const DEF_SYSTEMS: DefSystem[] = [
  { id: 'sitback', name: 'tactics.defSitBack', desc: 'tactics.defSitBackDesc', line: 14, width: 46 },
  { id: 'drift', name: 'tactics.defDrift', desc: 'tactics.defDriftDesc', line: 30, width: 82 },
  { id: 'standard', name: 'tactics.defStandard', desc: 'tactics.defStandardDesc', line: 50, width: 50 },
  { id: 'man', name: 'tactics.defMan', desc: 'tactics.defManDesc', line: 60, width: 38 },
  { id: 'press', name: 'tactics.defPress', desc: 'tactics.defPressDesc', line: 88, width: 64 },
]

/**
 * Which system the dials currently describe: the nearest of the five, by
 * straight-line distance across the two. Always answers, because a manager
 * who has dragged a slider two notches off Drift is still playing a drift
 * defence and the screen should say so rather than going blank.
 */
export function defSystemOf(line: number, width: number): DefSystem {
  let best = DEF_SYSTEMS[2]
  let bestD = Infinity
  for (const sys of DEF_SYSTEMS) {
    const d = (sys.line - line) ** 2 + (sys.width - width) ** 2
    if (d < bestD) { bestD = d; best = sys }
  }
  return best
}

/** Plain-English readout of a without-ball dial, for the UI. */
export function defSliderReadout(key: DefSliderKey, v: number): string {
  const info = DEF_SLIDER_INFO.find(s => s.key === key)!
  if (v >= 66) return t(info.up)
  if (v <= 34) return t(info.down)
  return t('tactics.balancedReadout')
}

/**
 * ---- WHAT YOU DO WHERE (owner, v1.8.0) ----
 *
 * Competitor read: their tactics screen sets attack, discipline and defence
 * separately for your own 22, the middle, and the opposition 22. That is how
 * rugby is actually coached - nobody plays the same way on his own line as he
 * does on theirs - and it turns four whole-match dials into a game plan.
 *
 * It could not be built until v1.8.0 because there was nothing to refer to:
 * the match engine had no field position, so "in your own 22" named nothing.
 * ctx.field exists now, so these do.
 *
 * ONE CHOICE A ZONE, not four sliders a zone. Twelve sliders is a spreadsheet
 * on a phone, and the four dials already cover the whole-match plan; what a
 * zone wants is the one decision a coach actually makes there. Each plan is a
 * small, named, two-sided trade, and every one of them costs something.
 */
export type ZoneId = 'own22' | 'middle' | 'opp22'

export interface ZonePlan {
  id: string
  name: string
  desc: string
  /** multiplier on this side's try chance while play is in this zone */
  tryF: number
  /** multiplier on the penalties this side gives away here */
  penF: number
  /**
   * How hard this pushes the line away from your own posts.
   *
   * TINY ON PURPOSE, and the numbers look wrong until you see why. ctx.field
   * is an AR(1) that decays 0.965 a tick, so a CONSTANT push is multiplied by
   * about 28 at equilibrium: the first cut used whole metres and the middle
   * third alone measured a 15.8-point swing a match, against the 1.95 that
   * dialweight prices the aggression dial at. A zone choice worth eight
   * ordinary tactical decisions is not a decision, it is the only decision.
   *
   * The two end zones carry BIGGER numbers than the middle third, which looks
   * backwards and is not: a plan only pushes while play is in its own zone,
   * and the 22s are a tenth of the match each where the middle is four
   * fifths. The exit is self-limiting on top of that - kicking long out of
   * your own 22 is exactly the thing that stops you being in your own 22 -
   * so it has to be worth more per application to be worth anything at all.
   *
   * They also have to beat the noise. The line swings about 43 metres a tick
   * either way, because without that swing no rugby reaches either 22 at all,
   * and a push of two or three against that is invisible - measured, an exit
   * kicked long spent exactly as many ticks pinned as one played out. The
   * middle third stays small because it applies four fifths of the time and
   * the same numbers there were worth 15.8 points a match.
   */
  terr: number
}

export const ZONE_PLANS: Record<ZoneId, ZonePlan[]> = {
  // YOUR OWN 22: the exit. Every side has to get out, and how you get out is
  // the oldest trade in the game - distance against possession.
  own22: [
    { id: 'long', name: 'tactics.z22Long', desc: 'tactics.z22LongDesc', tryF: 0.85, penF: 0.90, terr: 8 },
    { id: 'box', name: 'tactics.z22Box', desc: 'tactics.z22BoxDesc', tryF: 1, penF: 1, terr: 0 },
    { id: 'play', name: 'tactics.z22Play', desc: 'tactics.z22PlayDesc', tryF: 1.20, penF: 1.16, terr: -6 },
  ],
  // THE MIDDLE THIRD: where a match is won slowly. Territory or possession.
  middle: [
    { id: 'terr', name: 'tactics.zMidTerr', desc: 'tactics.zMidTerrDesc', tryF: 0.9, penF: 0.95, terr: 0.45 },
    { id: 'balanced', name: 'tactics.zMidBalanced', desc: 'tactics.zMidBalancedDesc', tryF: 1, penF: 1, terr: 0 },
    { id: 'hand', name: 'tactics.zMidHand', desc: 'tactics.zMidHandDesc', tryF: 1.12, penF: 1.06, terr: -0.35 },
  ],
  // THEIR 22: the finish. You are there; the question is how you cash it.
  opp22: [
    { id: 'drive', name: 'tactics.zOppDrive', desc: 'tactics.zOppDriveDesc', tryF: 1.10, penF: 0.82, terr: 2 },
    { id: 'patient', name: 'tactics.zOppPatient', desc: 'tactics.zOppPatientDesc', tryF: 1, penF: 1, terr: 0 },
    { id: 'spread', name: 'tactics.zOppSpread', desc: 'tactics.zOppSpreadDesc', tryF: 1.30, penF: 1.06, terr: -3 },
  ],
}

/**
 * The plan a side is on in a zone.
 *
 * THE MIDDLE ENTRY OF EACH LIST IS EXACTLY NEUTRAL - 1, 1, 0 - and it is also
 * the fallback, which is the only way an untouched save can play the game it
 * played before zones existed. The first cut had `box` and `spread` sitting
 * in those slots with real multipliers on them, so every club in the world
 * was quietly running a game plan nobody had chosen, and the sim fingerprint
 * moved for a save that had never opened the tactics screen.
 */
export function zonePlan(zone: ZoneId, id: string | undefined): ZonePlan {
  const list = ZONE_PLANS[zone]
  return list.find(p => p.id === id) ?? list[1]
}

/** Which zone a side is attacking in, given how far up the pitch it is. */
export function zoneAt(up: number): ZoneId {
  return up < 22 ? 'own22' : up > 78 ? 'opp22' : 'middle'
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
