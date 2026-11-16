// ---- THE SEASON PLAN (1.9.14) ----
//
// Player feedback (Instagram, 15 Nov 2026): "Be good have a preseason focus
// choose how you will play that season & practice set play". Owner: "That
// sounds like a good update for 1.9.14".
//
// Everything asked for already existed, on four screens: the attack and
// defence styles (Tactics, styles.ts), the lineout and scrum calls the pack
// drills (the playbook, playbook.ts drillWeek), the training focus (Training)
// and Set-Piece Work (match prep, which drills the calls faster). The plan is
// one card on Home in the pre-season weeks that asks for all of them at once
// and writes them where those screens already read them. It adds no rule and
// draws nothing: a planned club and a club set up by hand the same way are
// the same club. Every choice can still be changed on its own screen later.
import type { GameState, MatchPrep, TrainingFocus } from './model'
import { preseasonWeeksFor } from './calendar'
import { applyAtkStyle, applyDefStyle, stylesOf, type AtkStyle, type DefStyle } from './styles'
import { DEFAULT_LINEOUT, DEFAULT_SCRUM, ROUTINE_BY_ID } from './playbook'
import { noteStep } from './firststeps'

export interface PreseasonPlan {
  season: number
  atk: AtkStyle
  def: DefStyle
  lineout: string
  scrum: string
  focus: TrainingFocus
  /** Set-Piece Work as the standing match prep */
  setpiece: boolean
}

/** The weeks the card is on Home: the pre-season, in work. */
export function planWeeks(state: GameState): boolean {
  if (state.unemployed || !state.clubs[state.userClubId]) return false
  return preseasonWeeksFor(state.gender ?? 'm').includes(state.week)
}

/** The plan this season, if one has been set. */
export function planThisSeason(state: GameState): PreseasonPlan | null {
  const p = state.preplan
  return p && p.season === state.season ? p : null
}

/** What the card opens on: the plan already set, or the club as it stands. */
export function planDraft(state: GameState): Omit<PreseasonPlan, 'season'> {
  const set = planThisSeason(state)
  if (set) return { atk: set.atk, def: set.def, lineout: set.lineout, scrum: set.scrum, focus: set.focus, setpiece: set.setpiece }
  const club = state.clubs[state.userClubId]
  const st = stylesOf(state, club)
  return {
    atk: st?.atk ?? 'direct',
    def: st?.def ?? 'drift',
    lineout: club?.tactic.lineoutCall ?? DEFAULT_LINEOUT,
    scrum: club?.tactic.scrumCall ?? DEFAULT_SCRUM,
    focus: state.training ?? 'balanced',
    setpiece: state.matchPrep === 'setpiece',
  }
}

/** Write the plan where the game already reads each part of it. */
export function setPreseasonPlan(state: GameState, plan: Omit<PreseasonPlan, 'season'>): void {
  const club = state.clubs[state.userClubId]
  if (!club) return
  const tac = club.tactic
  applyAtkStyle(tac, plan.atk)
  applyDefStyle(tac, plan.def)
  // only calls the playbook knows, of the right kind
  if (ROUTINE_BY_ID[plan.lineout]?.kind === 'lineout') tac.lineoutCall = plan.lineout
  if (ROUTINE_BY_ID[plan.scrum]?.kind === 'scrum') tac.scrumCall = plan.scrum
  state.training = plan.focus
  if (plan.setpiece) state.matchPrep = 'setpiece' as MatchPrep
  else if (state.matchPrep === 'setpiece') state.matchPrep = undefined
  state.preplan = { season: state.season, ...plan }
  // the plan IS the game plan: the first season's checklist ticks it
  noteStep(state, 'plan')
}
