// The week's dice and the manager's own match's dice, and the two small
// readers that write a team's name the way a save stores it. Split out of
// season.ts, which re-exports them.
import type { GameState } from '../model'
import { nationByCode, nationNameIn } from '../nations'
import { mulberry32, type Rng } from '../rng'

export function weekRng(state: GameState): Rng {
  return mulberry32(state.seed ^ (state.season * 131 + state.week * 7919))
}

/** THE MANAGER'S OWN MATCH HAS DICE OF ITS OWN (1.8.1). It was played on
 *  weekRng, and so is the week's fixture loop, which on most weeks draws
 *  nothing before its first match: that match started from the same state,
 *  so the first AI fixture of the week had the manager's weather and his
 *  match's dice (measured: 41 weeks in 44). A salt on the same week seed
 *  keeps it deterministic per week, so the forecast still predicts the day. */
/** A team's short name AS A SAVE STORES IT (1.8.5 save QA). A nation's name
 *  comes out of the dictionary, so teamShort wrote it in whatever language the
 *  screen was in that week - "Japon win the Pacific Islands Cup" sat in a
 *  career for good, a French word inside an English sentence, and the same
 *  career played in English saved different text. Stored in English here,
 *  with the code beside it (natTwin) so the reader's language names it. */
export function savedShort(state: GameState, id: string): string {
  return state.clubs[id]?.short ?? nationNameIn('en', id)
}
/** `{ champ_n: 'JPN' }` when the team is a nation: i18n fill() renders a
 *  {champ} that has a _n twin as that nation, in the reader's language. */
export function natTwin(state: GameState, name: string, id: string): Record<string, string> {
  return state.clubs[id] || !nationByCode(id) ? {} : { [`${name}_n`]: id }
}

export function matchRng(state: GameState): Rng {
  return mulberry32((state.seed ^ (state.season * 131 + state.week * 7919)) ^ 0x6d2b79f5)
}
