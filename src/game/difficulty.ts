// ---- DIFFICULTY, IN THREE LEVERS ----
//
// Owner, v1.2.7: the game had no difficulty setting beyond which club you
// chose and the four challenge starts. It has one now, chosen at career
// creation and never after, and it pulls exactly three levers, all of them
// on the MANAGER'S club only. The other hundred clubs play the same game they
// always did, which is what keeps the leagues, the market and every probe
// that measures them honest.
//
//   cash    - the starting balance (and the wage room the board offers)
//   board   - how far the summer's confidence attractor is pulled down
//   injury  - the base injury roll for the manager's side, per minute
//
// 'normal' is the game exactly as shipped: every factor 1, every offset 0. A
// save written before this existed has no field and reads as 'normal', so
// nothing anybody is already playing changes under them.
import type { GameState } from './model'

export type Difficulty = 'normal' | 'hard' | 'legend'

export interface DifficultyDef {
  id: Difficulty
  name: string
  desc: string
  icon: string
  /** starting balance and wage room, as a fraction of the club's own */
  cash: number
  /** taken off the board's summer confidence attractor */
  board: number
  /** multiplier on the manager's side's injury roll */
  injury: number
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'normal', name: 'difficulty.normal', desc: 'difficulty.normalDesc', icon: '🏉', cash: 1, board: 0, injury: 1 },
  { id: 'hard', name: 'difficulty.hard', desc: 'difficulty.hardDesc', icon: '🌧️', cash: 0.7, board: 6, injury: 1.2 },
  { id: 'legend', name: 'difficulty.legend', desc: 'difficulty.legendDesc', icon: '🏔️', cash: 0.45, board: 12, injury: 1.4 },
]

const NORMAL = DIFFICULTIES[0]

/** The career's difficulty, 'normal' for every save that never chose one. */
export function difficultyOf(state: { difficulty?: Difficulty } | GameState): DifficultyDef {
  return DIFFICULTIES.find(d => d.id === state.difficulty) ?? NORMAL
}
