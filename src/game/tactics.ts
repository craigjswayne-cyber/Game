// Tactical vocabulary: what the sliders actually do, one-tap game plans,
// and the coaching philosophies you can bring to a club.

import type { Tactic } from './model'

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
    key: 'style', label: 'Style', lo: 'Forwards / pick-and-go', hi: 'Expansive / wide',
    up: 'Wide attacking rugby: backs see more ball (attack ↑), but you concede scrum solidity and some breakdown muscle.',
    down: 'Tight, forward-first rugby: stronger scrum and maul platform, fewer strike chances out wide.',
  },
  {
    key: 'tempo', label: 'Tempo', lo: 'Slow & structured', hi: 'High tempo',
    up: 'Quick taps and fast rucks: more attacking punch, but your players burn energy faster and the defence loosens.',
    down: 'Measured phase play: saves the legs and keeps defensive shape, at the cost of attacking spark.',
  },
  {
    key: 'kicking', label: 'Kicking', lo: 'Ball in hand', hi: 'Kick for territory',
    up: 'Territory game: contestable kicks and corner pins - your kicking unit matters more, great in bad weather.',
    down: 'Keep it in hand: more running threat, but you live in your own half if it goes wrong.',
  },
  {
    key: 'aggression', label: 'Physicality', lo: 'Stay clean', hi: 'Push the limits',
    up: 'Fly into rucks and dominate collisions: breakdown power ↑, but expect more yellow cards.',
    down: 'Discipline first: fewer penalties and cards, less breakdown menace.',
  },
]

/** A short plain-English readout of a current setting, for the UI. */
export function sliderReadout(key: SliderKey, v: number): string {
  const info = SLIDER_INFO.find(s => s.key === key)!
  if (v >= 66) return info.up
  if (v <= 34) return info.down
  return 'Balanced - no bonus, no cost.'
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
    id: 'allout', name: 'All-Out Attack', icon: '⚔️',
    desc: 'Everything wide and fast. Chasing a score - shape be damned.',
    values: { style: 82, tempo: 85, kicking: 18, aggression: 58 },
  },
  {
    id: 'shutup', name: 'Shut Up Shop', icon: '🧱',
    desc: 'Protect the lead. Slow it down, keep shape, kick the pressure away.',
    values: { style: 32, tempo: 22, kicking: 70, aggression: 42 },
  },
  {
    id: 'corners', name: 'Kick the Corners', icon: '🎯',
    desc: 'Territory war: pin them deep and squeeze penalties from their exits.',
    values: { style: 42, tempo: 45, kicking: 86, aggression: 52 },
  },
  {
    id: 'tight', name: 'Keep It Tight', icon: '🤜',
    desc: 'Ten-man rugby. Maul it, carry hard, strangle the game up front.',
    values: { style: 14, tempo: 34, kicking: 56, aggression: 68 },
  },
  {
    id: 'balanced', name: 'Balanced', icon: '⚖️',
    desc: 'Take what the defence gives you. No extremes.',
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
    id: 'balanced', name: 'Balanced',
    desc: 'Pragmatism above all - pick the right tool each week.',
    tactic: {},
  },
  {
    id: 'forwards', name: 'Forward Dominance',
    desc: 'Win the collisions, win the game. Scrum, maul, squeeze.',
    tactic: { style: 28, kicking: 60, aggression: 62 },
  },
  {
    id: 'expansive', name: 'Expansive',
    desc: 'Width, offloads and heads-up rugby in the Fiji tradition.',
    tactic: { style: 78, tempo: 66, kicking: 36 },
  },
  {
    id: 'territory', name: 'Territory & Pressure',
    desc: 'The classic ten-man kicking game: field position is everything.',
    tactic: { style: 40, tempo: 42, kicking: 82 },
  },
  {
    id: 'hightempo', name: 'High-Tempo Chaos',
    desc: 'Play at a pace nobody can live with - fitness is a weapon.',
    tactic: { style: 60, tempo: 88, kicking: 40 },
  },
  {
    id: 'defensive', name: 'Defensive Wall',
    desc: 'Blitz defence and discipline. Keep them to nil and nick it.',
    tactic: { style: 38, tempo: 38, kicking: 62, aggression: 46 },
  },
  {
    id: 'counter', name: 'Counter-Attack',
    desc: 'Soak pressure, strike from broken field. Turnover = try.',
    tactic: { style: 64, tempo: 58, kicking: 58 },
  },
  {
    id: 'offload', name: 'The Offloading Game',
    desc: 'Keep the ball alive through contact - high risk, box office.',
    tactic: { style: 72, tempo: 62, kicking: 30, aggression: 56 },
  },
]
