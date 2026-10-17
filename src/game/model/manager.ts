// The manager: his reputation, the dressing room's trust, the board's aim
// and patience, and the record of his decisions.
import { t, tIn } from '../i18n'
import { LEAGUE_TIER } from './competition'
import type { GameState } from './types'

/** Record a decision and its consequence. Newest first, last 40 kept.
 *
 *  The decision arrives as a key and its values rather than as a sentence,
 *  because the profile screen reads this history back for as long as the
 *  career lasts - a sentence recorded in English is English there for ever. */
export function logDecision(state: GameState, k: string, v?: Record<string, string | number>, good?: boolean) {
  state.decisions = [
    { abs: state.season * 100 + state.week, season: state.season, week: state.week, text: tIn('en', k, v), k, v, good },
    ...(state.decisions ?? []),
  ].slice(0, 40)
}

/** Managerial reputation earned from results and silverware, 30-95. */
/**
 * A name has to be made, not issued with the contract.
 *
 * This used to default an unplayed win rate to 0.4, so a manager who had never
 * taken a training session started on 34 + 18 = 52 out of 95: a mid-career
 * reputation before kick-off, and enough to be headhunted by two thirds of the
 * clubs in the game (user: "reputation if starting fresh should take time to
 * build"). Now nothing is assumed. An unknown starts at 22, and the win-rate
 * term fades IN as the sample grows, so one lucky afternoon does not make a
 * name and a bad month does not end one.
 *
 * Roughly: 22 cold, ~40 after a decent first season, ~50 after three, and the
 * seventies need trophies.
 */
/** What a win is worth to the manager's name, by the league his club is in:
 *  the top flights a full point, the second tier 0.6, the third 0.4. */
export function mgrWinWeight(state: GameState): number {
  const lg = state.clubs[state.userClubId]?.leagueId
  const tier = (lg && LEAGUE_TIER[lg]) || 1
  return tier >= 3 ? 0.4 : tier === 2 ? 0.6 : 1
}

export function mgrReputation(state: GameState): number {
  // the Manager's License (v1.1.0): a proven name from day one, chosen at
  // career creation and stamped on the save. It pays the scale's own ceiling
  // rather than a made-up number - everything in the game measures /95.
  if (state.licensed) return 95
  const m = state.mgr
  const games = m.m
  // REPUTATION IS EARNED FASTER AT THE TOP (owner, v1.2.8: "you grow slower
  // in the lower leagues"). The record's wins are weighted by the league
  // they came in, so a season of Championship wins builds a name more slowly
  // than the same season in the Premier Division.
  const winPct = games ? (m.ww ?? m.w) / games : 0
  // how much the record counts for: half weight at 20 games, most of it by 60
  const proven = games / (games + 20)
  // a former international's name opens doors before a single result (18B) -
  // worth six points of standing, forever, which a bad record soon dwarfs
  const name = state.mgrOrigin === 'player' ? 6 : 0
  return Math.min(95, Math.round(
    22 + name + winPct * 46 * proven + m.trophies.length * 7 + m.finishes.length * 1.5,
  ))
}

/**
 * What the dressing room makes of you, 0 to 100.
 *
 * A squad does not hand its belief to a stranger (user: "players take time to
 * trust you fully, need to build confidence through good management"). Trust
 * starts low for an unknown, a little higher for someone with a record, and
 * moves on results and on whether your word turns out to be worth anything. It
 * is not decoration: it scales how much of a team talk the room actually takes
 * in, so the same speech is worth more in year three than on day one.
 */
export function squadTrust(state: GameState): number {
  // no clamp import here on purpose: model.ts is a leaf that rng.ts must be
  // able to stay out of, and Math.min/max says the same thing
  return Math.max(0, Math.min(100, state.mgrTrust ?? 30))
}

/** Trust as a multiplier on a dressing-room effect: 0.45 cold, 1.0 fully bought in. */
export function trustFactor(state: GameState): number {
  return 0.45 + squadTrust(state) / 100 * 0.55
}

export function trustWord(v: number): string {
  return t(trustKey(v))
}

/** The key behind trustWord, for a screen that renders later (game/desk.ts). */
export function trustKey(v: number): string {
  return v >= 85 ? 'profile.trustWall'
    : v >= 68 ? 'profile.trustWithYou'
    : v >= 50 ? 'profile.trustWarming'
    : v >= 32 ? 'profile.trustUndecided'
    : v >= 16 ? 'profile.trustUnconvinced'
    : 'profile.trustDisbelief'
}

/** Close the current national tenure: the Test record moves to the profile's
 *  permanent history and the live fields clear. Called by BOTH doors out -
 *  stepping down and the union's annual-review sack - so neither can lose
 *  the ledger (user: "your international record still stays on your
 *  profile"). */
export function closeNatTenure(state: GameState) {
  if (state.natTeam && state.natRecord && state.natRecord.m > 0) {
    ;(state.natHistory ??= []).push({ nat: state.natTeam, ...state.natRecord })
  }
  state.natTeam = null
  state.natConfidence = null
  state.natRecord = null
  // AND THE QUESTION THAT ONLY EXISTS BECAUSE OF THE JOB (owner, v1.1.13: "im
  // no longer England coach and this is showing"). natKeepAsk asks whether you
  // carry on at the CLUB now that you have the country; it was set on
  // appointment and only ever cleared by answering it, so stepping down left a
  // card on the Manager Profile asking about a job that no longer exists.
  // This is the one door out of a tenure - both exits come through here - so
  // it is the one place the question can be retired for good.
  state.natKeepAsk = null
}

/** The board's stated aim for the season, from club stature. */
/** `text` is an i18n key: screens t() it, the board's letters tIn('en', …) it. */
/** The board's main aim, and the finish that meets it. `teams` is the size of
 *  the club's league. "Clear of the bottom two" is a place in a table, and it
 *  was written as 12, which is only true of a fourteen-club league: in a league
 *  of twelve, twelfth IS the bottom and still "met" the survival aim, and in a
 *  league of ten it could not be missed at all (1.8.1). Callers without a table
 *  get fourteen, which is the figure it always was. */
export function boardObjective(rep: number, teams = 14): { text: string; pos: number } {
  if (rep >= 87) return { text: 'objectives.boardTitle', pos: 1 }
  if (rep >= 80) return { text: 'objectives.boardPlayoffs', pos: 6 }
  if (rep >= 72) return { text: 'objectives.boardTopHalf', pos: 7 }
  return { text: 'objectives.boardSurvive', pos: Math.max(1, Math.round(teams) - 2) }
}

/**
 * How thin a boardroom's patience is, scaled by the club's own stature.
 *
 * Design review, wave 2: "board patience scales with stature - at a giant,
 * second place is a crisis, and an absent manager there is sacked by March;
 * at a minnow, survival buys years of goodwill." Before this every board
 * reacted to a swing the same way regardless of who they were, which is why
 * a title challenger sliding to 5th felt no different to the boardroom than
 * a relegation battler doing the same - both a comfortable mid-table finish
 * for one and a crisis for the other, on the SAME number.
 *
 * A straight line across the real club pool (rep 38..93, same anchors
 * archetypeWeights uses in oppcoach.ts, so "how sharp the opposition reads
 * you" and "how patient your own board is" move on the same real-world
 * scale): 0.55x at the weakest club in the game, 2.05x at the strongest.
 * Applied as a multiplier on the SWING, never on the floor or ceiling a
 * confidence value can reach - a giant's board still cannot be pushed past
 * 100, and a minnow's board still cannot be dragged below the sack line by
 * one bad afternoon it was always going to shrug off.
 */
export function boardPatience(rep: number): number {
  const t = Math.max(0, Math.min(1, (rep - 38) / (93 - 38)))
  return 0.55 + t * 1.50
}
