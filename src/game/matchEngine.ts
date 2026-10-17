import type { Fixture, GameState } from './model'
import type { Rng } from './rng'
import type { SimResult } from './match/lines'
import { beginMatch } from './match/begin'
import { forfeitSide, settleForfeit } from './match/finalize'
import { playHalf } from './match/control'

// The engine lives in src/game/match/, split by phase out of this file (which
// was nearly eight thousand lines): selection and units, the referee, the
// injury tables, the side's context, kick-off, the commentary, kicking,
// scoring, substitutions, the day's form, discipline, the incidents, the tick,
// live control, the stats and the final whistle. simMatch stays here, and
// this file re-exports everything it used to export so no import changes.
export { MAX_SUBS, availablePlayers, assistantJudgement, autoSelect, repairSheet, teamUnits, paperOverall, SPEC_PROP, SPEC_HOOK_SCRUM, SPEC_HOOK_LINEOUT, SPEC_NINE_ATT, SPEC_NINE_KICK, specialistGaps, rosterOf, teamName, teamShort, FIT_W, TANK_K, lineupFor } from './match/selection'
export type { Units } from './match/selection'
export { refFor, homeCrowdLean, frontRowCover, refNotes } from './match/referee'
export type { RefStyle, Referee } from './match/referee'
export { pickTrainingInjury } from './match/injuries'
export { EV_CAUSES, BREAK_P, zoneIdx, evOf } from './match/side'
export type { SideMods, SideCtx, EvCause, EvCount } from './match/side'
export type { SimResult } from './match/lines'
export type { LiveCtx } from './match/live'
export { beginMatch, shirtNumber } from './match/begin'
export { teamRatingTerm, sideEnergy } from './match/energy'
export { CHARGE_RATE, CHARGE_TRY } from './match/kickplay'
export { TMO_REVIEW, TMO_OVERTURN, FWD_PASS, resolveDecision } from './match/scoring'
export { isFrontRower, needsFrontRower, liveFrontRowCover, checkFrontRow, assistantBench } from './match/subs'
export type { DayUnit } from './match/day'
export { FORFEIT_MIN, FORFEIT_SCORE, FORFEIT_TRIES, forfeitSide, settleForfeit } from './match/finalize'
export { coverInjury, stepTick, playSegment, playHalf, talkListen, applyPreTalk, openDressingRoom, applyTeamTalk, makeSubstitution, swapInjuryCover, undoSubstitution, swapShirts, applyTacticsChange } from './match/control'
export { recomputeSideUnits, minutesPlayed, goalKicker } from './match/field'
export { visitsTo22, matchStats } from './match/stats'

export function simMatch(state: GameState, fx: Fixture, rng: Rng, detail: boolean): SimResult {
  const forfeit = forfeitSide(state, fx)
  if (forfeit) return settleForfeit(state, fx, forfeit)
  const ctx = beginMatch(state, fx, rng, detail)
  // NOBODY IS ON THE TOUCHLINE (1.8.1). beginMatch marks the manager's club
  // as the user's side, and aiAutoSubs leaves a user's bench to the user, so
  // a week settled here (not played, not handed to the assistant, the way a
  // soak or a sleepwalking manager's weeks are) used no bench at all except
  // for injuries and HIAs. The assistant has the match, exactly as he does
  // on an instant result.
  if (ctx.isUser) ctx.assistantSubs = true
  playHalf(state, ctx)
  playHalf(state, ctx)
  return { events: ctx.events, motmId: ctx.motmId }
}
