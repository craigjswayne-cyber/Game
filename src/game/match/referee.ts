// The referee panel, the crowd's lean and the front-row count before kick-off.
// Split out of matchEngine.ts, which re-exports the public parts.
import type { Fixture, GameState } from '../model'
import { demandCeiling } from '../model'
import { isDerby } from '../rivalries'
import { t } from '../i18n'
import { clamp } from '../rng'

// ------------------------------------------------------------------
// Simulation
// ------------------------------------------------------------------

export type RefStyle = 'strict' | 'fair' | 'lenient'

/** A referee is four separate opinions, not one dial.
 *
 *  The old model was thirteen names and three buckets, and the only thing a
 *  bucket changed was card risk. So every referee in the game was interchangeable
 *  except for how often somebody got binned, and there was nothing to select
 *  around: you could not pick a jackal-heavy back row because the man with the
 *  whistle was permissive at the tackle, because he had no opinion about it.
 *
 *  Each dial is a multiplier on something the engine already weighs:
 *
 *    scrum      how much he lets the set piece decide things. A pedant rewards a
 *               dominant front row and punishes a weak one; a ref who waves it
 *               away makes your scrum coach's work worth less.
 *    breakdown  jackal tolerance. Permissive means a strong breakdown wins the
 *               ball; fussy means the same actions concede penalties instead.
 *    patience   how many infringements he takes before somebody goes to the bin.
 *    flow       advantage and materiality. High flow means fewer stoppages and
 *               more attacking ball for both sides.
 *
 *  Profiles are fixed per man, not per fixture, so a name means something after
 *  a season of watching him.  */
export interface Referee {
  name: string
  style: RefStyle
  /** 0.85 dismissive of the scrum .. 1.15 pedant */
  scrum: number
  /** 0.9 fussy at the tackle .. 1.1 lets the jackal work */
  breakdown: number
  /** penalties conceded before a bin */
  patience: number
  /** 0.98 stop-start .. 1.04 lets it flow */
  flow: number
  /** card risk multiplier */
  cards: number
}

/** The panel is deliberately MEAN-NEUTRAL on every dial.
 *
 *  The first cut was not, and it cost three and a half points a game: the card
 *  dial averaged 1.03 against the old three-bucket model's effective 1.018, and
 *  breakdown averaged 0.99, so simply adding variety quietly taxed every match in
 *  the world. Scoring came out at 48.9 against a healthy band of 52.5-53.2.
 *
 *  So each column averages to what the old model averaged. A referee should
 *  change WHICH side an afternoon suits, never how much rugby gets played. If you
 *  edit a number here, re-run simtest: the columns have to stay balanced.
 *
 *  As it stands (1.8.1, counted): breakdown averages exactly 1.000 and cards
 *  0.995, but flow averages 1.009, a small lift to scoring for everybody, and
 *  scrum 1.011. The bands were tuned with the panel as it is, so the drift is
 *  written down here rather than corrected on its own, which would move the
 *  world's scoring without a rebalance behind it. */
const REF_PANEL: Referee[] = [
  { name: 'L. Pearce', style: 'strict', scrum: 1.10, breakdown: 0.92, patience: 4, flow: 0.99, cards: 1.28 },
  { name: 'K. Dickson', style: 'fair', scrum: 1.00, breakdown: 1.06, patience: 5, flow: 1.03, cards: 1.00 },
  { name: 'M. Carley', style: 'fair', scrum: 1.08, breakdown: 0.98, patience: 5, flow: 1.00, cards: 1.05 },
  { name: 'C. Ridley', style: 'lenient', scrum: 0.90, breakdown: 1.10, patience: 7, flow: 1.04, cards: 0.60 },
  { name: 'A. Gardner', style: 'strict', scrum: 1.10, breakdown: 0.90, patience: 4, flow: 0.98, cards: 1.30 },
  { name: 'N. Amashukeli', style: 'fair', scrum: 1.08, breakdown: 1.00, patience: 5, flow: 1.01, cards: 1.02 },
  { name: 'A. Piardi', style: 'fair', scrum: 0.94, breakdown: 1.04, patience: 6, flow: 1.02, cards: 0.92 },
  { name: 'P. Williams', style: 'strict', scrum: 1.06, breakdown: 0.94, patience: 4, flow: 0.99, cards: 1.24 },
  { name: "B. O'Keeffe", style: 'lenient', scrum: 0.92, breakdown: 1.08, patience: 7, flow: 1.04, cards: 0.58 },
  { name: 'N. Berry', style: 'fair', scrum: 1.02, breakdown: 1.02, patience: 5, flow: 1.01, cards: 0.98 },
  { name: 'H. Davidson', style: 'fair', scrum: 0.96, breakdown: 0.96, patience: 6, flow: 1.00, cards: 1.06 },
  { name: 'A. Brace', style: 'lenient', scrum: 0.88, breakdown: 1.06, patience: 7, flow: 1.03, cards: 0.64 },
  { name: 'P. Brousset', style: 'strict', scrum: 1.10, breakdown: 0.94, patience: 4, flow: 0.98, cards: 1.26 },
]

/** The man (or woman) in the middle - fixed per fixture, big influence. */
export function refFor(fxId: number): Referee {
  const h = (fxId * 2654435761) >>> 0
  return REF_PANEL[h % REF_PANEL.length]
}

/**
 * ---- THE HOME CROWD (owner, 25 Sep 2026: "home-crowd referees") ----
 *
 * Some afternoons the fifty-fifty calls go the home side's way: a full,
 * loud ground, a derby, a knockout. This puts that in, as a tilt on who
 * concedes the penalties - fewer against the home side, as many more against
 * the visitors - of up to 7%.
 *
 * IT IS THE GROUND'S, NOT THE REFEREE'S. The panel above carries real
 * officials' names, and a trait that says a named referee favours home sides
 * is a claim about a real person's integrity. So the lean is read off the
 * occasion - the size of the ground, a derby, a knockout - and applies
 * whoever has the whistle; the briefing says it is the crowd.
 *
 * THE CROWD THAT IS THERE, NOT THE SEATS. The first cut read the stadium's
 * capacity, and pointsprobe caught it at once: a 60,000-seat ground a third
 * full leaned as hard as a sell-out, so a club with a vast empty bowl got
 * the referee's ear it had done nothing to earn. The match reads the counted
 * gate (fx.att, set in beginMatch after the draw for it); before kick-off,
 * for the briefing, it reads the seats the club can actually sell.
 *
 * Nothing at a neutral venue, in a friendly, or in front of a small crowd on
 * an ordinary Saturday. No draw.
 */
export function homeCrowdLean(state: GameState, fx: Fixture): number {
  if (fx.venue || fx.compId === 'fr') return 0
  const club = state.clubs[fx.homeId]
  const crowd = fx.att ?? (club ? Math.min(club.capacity, demandCeiling(club)) : 0)
  // a gate that is not a number (a damaged save) leans nobody's way (hostile171)
  if (!Number.isFinite(crowd)) return 0
  const size = clamp((crowd - 12000) / 18000, 0, 1)
  const occasion = (isDerby(fx.homeId, fx.awayId) ? 0.5 : 0) + (fx.stage ? 0.35 : 0)
  return 0.07 * Math.min(1, size + occasion)
}

/** Law 3: a 23 must be able to replace all three front-row positions.
 *
 *  Six suitably trained front-rowers, in practice two who can play each of
 *  loosehead, hooker and tighthead. Come up short and the referee orders
 *  uncontested scrums, which takes the set piece out of the game entirely: no
 *  shove, no scrum penalties, nothing for a dominant front row to win. That
 *  hurts whoever HAD the better scrum, which is why it is a genuine selection
 *  constraint and, in the real game, a genuine controversy - a side with a
 *  poor scrum has an incentive to be short. Comment kept rather than a
 *  sanction built: a front-row shortage already punishes itself when a
 *  tighthead limps off and the bench has no natural cover.
 *
 *  PLAYERS, NOT POSITIONS (1.8.3, Law 3.5). This used to count positions
 *  covered, a man counting once for every one he could play, so a prop who
 *  packs down on both sides was worth two and five men passed for six. The
 *  law counts men: six front-rowers in a 23, five in a squad of 19 to 22,
 *  four in 17 or 18 and three below that, each a different player, and the
 *  two-of-each test still stands on top so every position has its cover. The
 *  squad is the named men who are fit to play. No draw. */
export function frontRowCover(state: GameState, lineup: (number | null)[]): { LP: number; HK: number; TP: number; players: number; need: number; legal: boolean } {
  const need = ['LP', 'HK', 'TP'] as const
  const out = { LP: 0, HK: 0, TP: 0, players: 0, need: 6, legal: false }
  const seen = new Set<number>()
  for (const id of lineup.slice(0, 23)) {
    if (id == null || seen.has(id)) continue
    const p = state.players[id]
    if (!p || p.injury) continue
    seen.add(id)
    let fr = false
    for (const n of need) if (p.pos === n || p.alt.includes(n)) { out[n] += 1; fr = true }
    if (fr) out.players += 1
  }
  const squad = seen.size
  out.need = squad >= 23 ? 6 : squad >= 19 ? 5 : squad >= 17 ? 4 : 3
  out.legal = out.LP >= 2 && out.HK >= 2 && out.TP >= 2 && out.players >= out.need
  return out
}

/** His two loudest opinions, in words, for the pre-match briefing. A tendency
 *  the manager cannot read is a tendency he cannot select around. */
export function refNotes(r: Referee): string[] {
  const out: string[] = []
  // THE ONE PART OF THIS FILE THAT SPEAKS THE PLAYER'S LANGUAGE. Everything else
  // here is commentary, and commentary is written into the match report the save
  // keeps, so it stays English (docs/i18n.md). These notes are read off the
  // referee at render and stored nowhere.
  if (r.scrum >= 1.08) out.push(t('matchday.refScrumTight'))
  else if (r.scrum <= 0.94) out.push(t('matchday.refScrumLoose'))
  if (r.breakdown >= 1.05) out.push(t('matchday.refJackal'))
  else if (r.breakdown <= 0.95) out.push(t('matchday.refFussy'))
  if (r.patience <= 4) out.push(t('matchday.refShortFuse', { n: r.patience }))
  else if (r.patience >= 7) out.push(t('matchday.refPatient', { n: r.patience }))
  if (r.flow >= 1.03) out.push(t('matchday.refFlow'))
  else if (r.flow <= 0.99) out.push(t('matchday.refStopStart'))
  return out
}
