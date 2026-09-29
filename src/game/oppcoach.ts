// The opposing coach (four pillars, pillar 2): the anti-exploit engine.
//
// Until now every AI dugout played its philosophy every week, forever. That
// is the exploit: find the one plan that beats a static league and run it
// until May. This module gives some of those dugouts eyes.
//
// Three archetypes, assigned deterministically from the club id, so a given
// save always faces the same characters:
//   STUBBORN (~45%)  reads nothing. Plays its philosophy. The control group,
//                    and the reason varied play is a choice rather than a tax.
//   ANALYST  (~35%)  reads your last three to five matches and shifts its
//                    STARTING plan toward the counter to your habit.
//   REACTIVE (~20%)  reads the match in front of it and changes the picture
//                    from the touchline, at most twice.
//
// STREAM DISCIPLINE, the rule everything here obeys: not one rng draw. Every
// adjustment is a deterministic multiplier layered onto unit ratings via the
// same layer() the referee and the team talks use. In a fresh world the
// tendency window is empty and every dial sits at 50, so nothing here fires
// and the fingerprint reads the exact game it was calibrated on - the
// analyst only wakes when a real manager leans on the dials.
import { mgrReputation, type GameState } from './model'
import { lineupFor, teamUnits } from './matchEngine'
import { hashString, mulberry32 } from './rng'
import { tendencyProfile, type TendencyProfile } from './tendency'
import { COUNTER } from './philosophy'

export type Archetype = 'stubborn' | 'analyst' | 'reactive'

/**
 * How likely a dugout is to be each archetype, as a function of club stature.
 *
 * Design review, wave 2: "the best dugouts read you fastest" - the counter-
 * adaptation pillar already existed but every club drew from the same urn, so
 * a National One minnow was exactly as likely to field an analyst as Toulouse.
 * Tying the mix to reputation makes the climb up the leagues a climb into
 * sharper opposition, which is the difficulty curve the design review asked
 * for and the one this game never had: not bigger numbers, smarter minds.
 *
 * A straight line in rep between the two ends of the real club pool (measured
 * 38..93 across every league), clamped past either end. The endpoints are
 * chosen so they still sum to 1 with no renormalising:
 *   rep 38 (the weakest club in the game): 85% stubborn, 10% analyst, 5% reactive
 *   rep 93 (the strongest):                 8% stubborn, 46% analyst, 46% reactive
 * A rep-86 Premier Division giant sits at roughly 18/41/41 - the "almost
 * exclusively" a sharp dugout the review called for, without a discontinuity
 * anywhere the manager could feel as a cliff-edge.
 */
export function archetypeWeights(rep: number): { stubborn: number; analyst: number; reactive: number } {
  const t = Math.max(0, Math.min(1, (rep - 38) / (93 - 38)))
  const lerp = (a: number, b: number) => a + (b - a) * t
  return { stubborn: lerp(0.85, 0.08), analyst: lerp(0.10, 0.46), reactive: lerp(0.05, 0.46) }
}

/** Which kind of coach lives in this dugout. Hash of the club id: different
 *  across clubs, no rng consumed, and stable while the club's standing holds.
 *  Not for the whole save: `rep` weights the odds (archetypeWeights), so a
 *  club that climbs or falls far enough can find a different kind of coach in
 *  its dugout, which is what a club that has changed does. Pass the club's
 *  actual reputation; callers
 *  with no club record (a Test dugout) fall back to a strong-club default,
 *  because international rugby is the pinnacle and should be read sharply. */
export function archetypeOf(clubId: string, rep = 78): Archetype {
  const r = mulberry32(hashString(`${clubId}:dugout`))()
  const w = archetypeWeights(rep)
  return r < w.stubborn ? 'stubborn' : r < w.stubborn + w.analyst ? 'analyst' : 'reactive'
}

/** The dial-to-unit coefficient table. MUST MATCH applyModifiers in
 *  matchEngine.ts term for term - the analyst's shift is "move the dials
 *  toward the counter", expressed as the ratio between the shifted and the
 *  unshifted dial factor so it can be layered without touching the club's
 *  saved tactic. If applyModifiers gains or changes a term, change it here
 *  in the same commit. */
const f = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(100, v)) - 50 : 0) / 50
function dialFactor(unit: 'attack' | 'scrum' | 'breakdown' | 'kicking' | 'defence' | 'tempo',
  d: { style: number; tempo: number; kicking: number; aggression: number }): number {
  switch (unit) {
    case 'attack': return 1 + f(d.style) * 0.06 + f(d.tempo) * 0.05 - f(d.kicking) * 0.035
    case 'scrum': return 1 - f(d.style) * 0.05
    case 'breakdown': return 1 + f(d.aggression) * 0.06 - f(d.style) * 0.03 - f(d.kicking) * 0.02
    case 'kicking': return 1 + f(d.kicking) * 0.1
    case 'defence': return 1 - f(d.tempo) * 0.03
    case 'tempo': return 1 + f(d.tempo) * 0.22
  }
}

export interface AnalystShift {
  /** multiplier per unit, ready for layer() */
  layers: Partial<Record<'attack' | 'scrum' | 'breakdown' | 'kicking' | 'defence' | 'tempo', number>>
  /** how far toward the counter the plan moved, 0..0.45 */
  pull: number
  pattern: NonNullable<TendencyProfile['pattern']>
}

/** The analyst's homework: shift the AI side's starting plan toward the
 *  counter to the user's habit. Three things bound it, and all three matter:
 *  predictability (varied play is genuinely unreadable), the club's own
 *  analysis department (a National 1 dugout is not Toulouse's), and a hard
 *  ceiling - it can never fully mirror you. */
export function analystShift(state: GameState, clubId: string): AnalystShift | null {
  if (archetypeOf(clubId, state.clubs[clubId]?.rep ?? 78) !== 'analyst') return null
  const prof = tendencyProfile(state)
  if (!prof || !prof.pattern) return null
  const counter = COUNTER[prof.pattern]
  if (!counter) return null
  const club = state.clubs[clubId]
  if (!club) return null
  const skill = Math.max(0.5, Math.min(0.95, club.rep / 100))
  const pull = prof.predictability * skill * 0.45
  if (pull < 0.05) return null
  const own = club.tactic
  const shifted = {
    style: own.style + (counter.dials.style - own.style) * pull,
    tempo: own.tempo + (counter.dials.tempo - own.tempo) * pull,
    kicking: own.kicking + (counter.dials.kicking - own.kicking) * pull,
    aggression: own.aggression + (counter.dials.aggression - own.aggression) * pull,
  }
  const layers: AnalystShift['layers'] = {}
  for (const u of ['attack', 'scrum', 'breakdown', 'kicking', 'defence', 'tempo'] as const) {
    const ratio = dialFactor(u, shifted) / dialFactor(u, own)
    if (Math.abs(ratio - 1) > 0.0005) layers[u] = ratio
  }
  return Object.keys(layers).length ? { layers, pull, pattern: prof.pattern } : null
}

/** The user's loudest current habit, for the reactive coach's live read. */
export function loudestDial(t: { style: number; tempo: number; kicking: number; aggression: number }): { dial: 'style' | 'tempo' | 'kicking' | 'aggression'; v: number } | null {
  const list = (['style', 'tempo', 'kicking', 'aggression'] as const)
    .map(dial => ({ dial, v: t[dial] }))
    .sort((a, b) => Math.abs(b.v - 50) - Math.abs(a.v - 50))
  return Math.abs(list[0].v - 50) >= 20 ? list[0] : null
}

/** Repetition fatigue (pillar 2's physical half): a high-intensity habit -
 *  tempo, physicality or a rush defence held past 75 match after match -
 *  costs three per cent extra petrol per consecutive match beyond the first,
 *  capped at twelve. Two matches of variety walk it back (the streaks decay
 *  in tendency.ts). User side only: an AI philosophy is a fixed identity,
 *  not a weekly choice, and taxing it would just shift the world's balance. */
export function repetitionFatigue(state: GameState): number {
  const s = state.dialStreak ?? {}
  const worst = Math.max(0,
    (s.tempo ?? 0) - 1, (s.aggression ?? 0) - 1, (s.defLine ?? 0) - 1)
  return 1 + Math.min(0.12, worst * 0.03)
}

/**
 * ---- THEY RESPECT YOU NOW (1.8.0, E9) ----
 *
 * From the PDF the owner pulled this from: a promoted side's second season
 * should feel harder, and for a reason the manager can see. Until now an AI
 * dugout set up the same way against a title favourite as against the side
 * bottom of the table; the analyst and the reactive coach read the manager,
 * but both read his HABITS, never his standing.
 *
 * Now a coach who looks at the manager and sees a bigger name than his own
 * club changes his plan for that one match, through his dials like any other
 * tactic choice (the engine reads club.tactic as always, and the analyst's
 * shift is layered on top of it):
 *   CAUTION. A respectful underdog does not trade punches: it slows the game,
 *   keeps it tight, kicks for territory and spoils, with a line that comes up
 *   hard and a contest at every breakdown.
 *   HIS WEAK SPOT. It goes after the unit where the manager's side is weakest
 *   against its own: a poor scrum gets a tight game, a poor lineout a kick-to-
 *   touch game, a soft breakdown a contest, a shaky back three the high ball.
 * The plan is written the week of the match and taken off the week after, so
 * no other fixture ever sees it, and the pre-match report says so in words.
 *
 * STANDING is the average of his club's reputation and his own, plus what
 * last season's finish says: a top-four side in this league is marked, a top-
 * six one a little. So a promoted side is a curiosity its first season and a
 * known quantity the next, if it did well. RESPECT is how far that standing
 * sits above the opposing club's reputation, 0 at level and 1 at 15 clear.
 */
export function userStanding(state: GameState): number {
  const club = state.clubs[state.userClubId]
  if (!club) return 0
  let s = (club.rep + mgrReputation(state)) / 2
  const last = [...(state.mgr?.finishes ?? [])].reverse().find(f => f.clubId === club.id)
  if (last && last.season === state.season - 1 && last.leagueId === club.leagueId) {
    s += last.pos <= 4 ? 6 : last.pos <= 6 ? 3 : 0
  }
  return s
}

export function respectFor(state: GameState, clubId: string): number {
  const opp = state.clubs[clubId]
  if (!opp || clubId === state.userClubId) return 0
  return Math.max(0, Math.min(1, (userStanding(state) - opp.rep) / 15))
}

/**
 * THE EXTRA YARD, FOR THE ENGINE TO READ (lead's call, not wired here).
 * The dials alone are a shade (see setUpForUser). A side that has decided you
 * are the big game of its season also tackles and competes a little harder,
 * which is an effort term, not a tactic, so it can only live in the engine:
 * layered like analystShift, in beginMatch's analyst loop, on the AI side
 * facing the manager. 4% defence and 3% breakdown at full respect. Returns
 * null on every week without a plan, so a fresh world and every calibrated
 * harness are untouched.
 */
export function respectLayers(state: GameState, clubId: string): Partial<Record<'defence' | 'breakdown', number>> | null {
  const v = state.clubs[clubId]?.vsUser
  if (!v) return null
  return { defence: 1 + 0.04 * v.r, breakdown: 1 + 0.03 * v.r }
}

/** below this a coach does not change a thing */
export const RESPECT_MIN = 0.15

export type Weak = 'scrum' | 'lineout' | 'breakdown' | 'kicking' | 'defence'

/** The manager's weakest unit, measured against the side he is about to play. */
export function userWeakness(state: GameState, oppId: string): Weak | null {
  // his sheet as it stands, read and never written: lineupFor would tidy a
  // stale sheet on the way, a week before the match does
  const sheet = state.clubs[state.userClubId]?.tactic.lineup ?? []
  if (sheet.slice(0, 15).filter(id => id != null && state.players[id]).length < 15) return null
  const mine = teamUnits(state, sheet)
  const theirs = teamUnits(state, lineupFor(state, oppId))
  let worst: Weak | null = null, lo = Infinity
  for (const u of ['scrum', 'lineout', 'breakdown', 'kicking', 'defence'] as const) {
    const r = mine[u] / Math.max(1e-6, theirs[u])
    if (r < lo) { lo = r; worst = u }
  }
  return worst
}

const clampDial = (v: number) => Math.round(Math.max(0, Math.min(100, v)))

/** Put back any plan written for the manager. Every club, not just last
 *  week's opponent, so a sacking or a new job can never strand one. A club
 *  whose coach changed in the meantime keeps the new man's dials. */
export function restoreOpposition(state: GameState): void {
  for (const club of Object.values(state.clubs)) {
    const v = club.vsUser
    if (!v) continue
    if (club.philosophy === v.ph) Object.assign(club.tactic, v.base)
    delete club.vsUser
  }
}

/** The week's plan for the manager's opponent (season.ts calls this as the
 *  week turns, after last week's has been put back). `fx` is the manager's
 *  club fixture this week, if any. */
export function setUpForUser(state: GameState, fx: { homeId: string; awayId: string } | undefined): void {
  restoreOpposition(state)
  if (!fx || state.unemployed) return
  const oppId = fx.homeId === state.userClubId ? fx.awayId : fx.awayId === state.userClubId ? fx.homeId : null
  const club = oppId ? state.clubs[oppId] : null
  // an AI club with a coach's idea of the game; a Test side has no club record
  if (!club || !oppId || !club.philosophy) return
  const r = respectFor(state, oppId)
  if (r < RESPECT_MIN) return
  const tac = club.tactic
  const unit = userWeakness(state, oppId) ?? undefined
  club.vsUser = {
    ph: club.philosophy, r: Math.round(r * 100) / 100, unit,
    base: {
      style: tac.style, tempo: tac.tempo, kicking: tac.kicking, aggression: tac.aggression,
      defLine: tac.defLine, defWidth: tac.defWidth, kickStyle: tac.kickStyle, ruckContest: tac.ruckContest,
    },
  }
  // caution: slower and tighter, kicking for territory, and a game played
  // without the ball - a line that comes up hard and a contest at every
  // breakdown. MEASURED, not assumed (scripts/respectprobe.ts, and the dial
  // sweep behind it): the first cut was the textbook "sit off and kick" plan,
  // and against the same user fixtures it cost him nothing at all (47.5% wins
  // against 47.8%). Spoiling is what costs a better side, and even that is a
  // shade, not a wall, because every dial is neutral by design (philosophy.ts):
  // on one world it took 2.8 points off the manager's win rate, on another it
  // was lost in the noise, and pooled over two runs it sat within a point
  // either way. The measurable cost is the extra yard (respectLayers above),
  // which only the engine can apply: with it, 4.2 points of wins.
  let style = tac.style - 10 * r
  let aggression = tac.aggression + 5 * r, ruckContest = (tac.ruckContest ?? 50) + 14 * r
  const tempo = tac.tempo - 12 * r, defLine = (tac.defLine ?? 50) + 10 * r
  let kickStyle = r >= 0.4 ? 'territory' as const : tac.kickStyle
  // and his weak spot
  if (unit === 'scrum') style -= 6 * r
  // (touch-finding, not more kicking: a bigger kicking dial measured as a
  // gift to the manager, 47.8% wins against 46.0%)
  else if (unit === 'lineout') kickStyle = 'territory'
  else if (unit === 'breakdown') { aggression += 4 * r; ruckContest += 8 * r }
  else if (unit === 'kicking') { if (r >= 0.4) kickStyle = 'contest' }
  else if (unit === 'defence') style += 16 * r
  tac.style = clampDial(style)
  tac.tempo = clampDial(tempo)
  tac.aggression = clampDial(aggression)
  tac.defLine = clampDial(defLine)
  tac.ruckContest = clampDial(ruckContest)
  tac.kickStyle = kickStyle
}
