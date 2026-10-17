// The analyst's skill, a pure reading of the club's setup. A leaf moved out of
// analyst.ts so temperament.ts can read it without an import cycle through
// analyst, the match units and formtraits; analyst.ts re-exports it.
import type { GameState } from './model'

/** How good his homework is: the analysis suite, the assistant, and knowing them. */
export function analystSkill(state: GameState): number {
  const club = state.clubs[state.userClubId]
  const suite = club?.facilities?.briefing ?? 0
  const assistant = state.staff.assistant ?? 0
  // (The cap is a guard: a level-5 suite and a level-3 assistant reach 0.75,
  // so today it never binds.)
  // Capped at 0.78, not 0.92. Measured over 20 seasons the analyst was right
  // 221 times against 50 wrong - 82% - which with a maxed briefing suite made
  // following him close to free. The feature exists to create a judgement
  // ("he helps, but he is not a given"), and a read you can trust four times
  // in five is not a judgement. A good setup now lands near three in four,
  // which is worth having and still worth doubting.
  return Math.min(0.78, 0.3 + suite * 0.06 + assistant * 0.05)
}
