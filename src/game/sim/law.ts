// THE LAWS, AS ONE MACHINE (2.0.0 rebuild, 20 Nov 2026).
//
// Owner, 20 Nov 2026: "commentary, graphics and animation are all doing
// different things - they need to be in harmony."
//
// The engine decides the match in four-minute ticks and writes lines about
// it. It does not keep the ball: a line can say "scrum" straight after a line
// break with nothing to say why, or go from a conversion to a lineout. Until
// now the pitch guessed the missing step in a dozen separate places, and the
// guesses disagreed with the words.
//
// This file is the one place that knows what may follow what. It holds the
// state of the ball under the laws of the game (in play, in touch, waiting
// for a scrum, a kick-off, a 22 drop-out, a conversion) and the only moves
// allowed from each. Everything the pitch plays goes through it, so a
// sequence the laws do not allow cannot be drawn, and when the engine's
// lines skip a step the missing step is named here, once, and both the
// picture and the words are made from it (script.ts).
//
// World Rugby laws referred to: 12 (kick-off and restarts), 11 (knock-on,
// forward pass: scrum), 18 (touch, lineout), 19 (scrum), 20 (penalty and
// free kick), 8 (scoring), 21 (in-goal, drop-outs).
import { createMachine } from 'xstate'

export type LawEvent =
  | 'KICKOFF'    // a place or drop kick from halfway (start, after a score, second half)
  | 'DROPOUT'    // a 22 or goal-line drop-out
  | 'PLAY'       // open play: a carry, a ruck, a maul, a catch
  | 'KICK'       // a kick that stays in the field of play
  | 'TOUCH'      // the ball goes into touch
  | 'LINEOUT'    // the throw
  | 'STOP'       // a knock-on, a forward pass, an unplayable ball: a scrum is coming
  | 'SCRUM'      // the scrum
  | 'PENALTY'    // a penalty or free kick is given
  | 'GOAL'       // a kick at goal from a penalty, over
  | 'GOALMISS'   // a kick at goal from a penalty, missed and dead
  | 'DROPGOAL'   // a drop goal in open play, over
  | 'DROPMISS'   // a drop goal in open play, missed and dead
  | 'TRY'
  | 'CON'        // the conversion, over or not
  | 'DEAD'       // the ball is made dead in in-goal by the defence, or held up over the line
  | 'HALF'       // the half-time whistle

export type LawState = 'kickoff' | 'open' | 'touch' | 'scrum' | 'penalty' | 'try' | 'dropout'

/** THE TABLE: from each state, the moves allowed and where each one leads.
 *  The XState machine below is built from it, and so is the fast lookup the
 *  simulation runs on (about 550 moves a match: XState's snapshots cost the
 *  simulation most of its time, 21 Nov). The two are the same rules. */
export const LAW_TABLE: Record<LawState, Partial<Record<LawEvent, LawState>>> = {
  // waiting for a kick from halfway
  kickoff: { KICKOFF: 'open', HALF: 'kickoff' },
  // the ball is in play
  open: {
    PLAY: 'open', KICK: 'open', TOUCH: 'touch', STOP: 'scrum', PENALTY: 'penalty', TRY: 'try',
    DROPGOAL: 'kickoff', DROPMISS: 'dropout', DEAD: 'dropout', HALF: 'kickoff',
  },
  // in touch: only a lineout restarts it (a quick throw is a lineout here)
  touch: { LINEOUT: 'open', HALF: 'kickoff' },
  // stopped for a scrum
  scrum: { SCRUM: 'open', PENALTY: 'penalty', HALF: 'kickoff' },
  // a penalty or free kick has been given: kick at goal, kick to touch, tap, or take the scrum
  penalty: {
    GOAL: 'kickoff', GOALMISS: 'dropout', TOUCH: 'touch', PLAY: 'open', KICK: 'open', SCRUM: 'open',
    PENALTY: 'penalty', TRY: 'try', DEAD: 'dropout', HALF: 'kickoff',
  },
  // a try has been scored: the conversion, then a kick-off
  try: { CON: 'kickoff', KICKOFF: 'open', HALF: 'kickoff' },
  // waiting for a drop-out
  dropout: { DROPOUT: 'open', HALF: 'kickoff' },
}

/** the same rules as an XState machine, for anything that wants one */
export const lawMachine = createMachine({
  id: 'laws',
  initial: 'kickoff',
  states: Object.fromEntries(Object.entries(LAW_TABLE).map(([k, on]) => [k, { on }])) as Record<LawState, { on: Partial<Record<LawEvent, LawState>> }>,
})

const FILL: LawEvent[] = ['KICKOFF', 'DROPOUT', 'LINEOUT', 'SCRUM', 'TOUCH', 'STOP', 'DEAD', 'CON']

export class Laws {
  private st: LawState = 'kickoff'
  /** start from a state (a match picked up where it was stopped) */
  constructor(from: LawState = 'kickoff') { this.st = from }
  get state(): LawState { return this.st }
  can(e: LawEvent): boolean { return LAW_TABLE[this.st][e] !== undefined }
  /** make the move; false, and nothing changes, when the laws do not allow it */
  go(e: LawEvent): boolean {
    const to = LAW_TABLE[this.st][e]
    if (to === undefined) return false
    this.st = to
    return true
  }
  /** THE MISSING STEPS: the shortest run of restarts and stoppages that makes
   *  `e` legal from here, or null when there is none within three steps. Only
   *  steps that put no score, card or penalty on the sheet may be supplied:
   *  those are the engine's alone. */
  bridge(e: LawEvent): LawEvent[] | null {
    if (this.can(e)) return []
    let frontier: { s: LawState; path: LawEvent[] }[] = [{ s: this.st, path: [] }]
    for (let depth = 0; depth < 3; depth++) {
      const next: { s: LawState; path: LawEvent[] }[] = []
      for (const f of frontier) for (const b of FILL) {
        const s = LAW_TABLE[f.s][b]
        if (s === undefined) continue
        const path = [...f.path, b]
        if (LAW_TABLE[s][e] !== undefined) return path
        next.push({ s, path })
      }
      frontier = next
    }
    return null
  }
  /** a line the laws cannot reach from here in three steps: start again from
   *  the nearest state that allows it. Counted by the test, which holds it at zero. */
  jump(e: LawEvent): void {
    for (const path of [['KICKOFF'], ['KICKOFF', 'TOUCH'], ['KICKOFF', 'STOP'], ['KICKOFF', 'PENALTY'], ['KICKOFF', 'TRY'], ['KICKOFF', 'DEAD'], []] as LawEvent[][]) {
      let s: LawState = 'kickoff'
      for (const b of path) s = LAW_TABLE[s][b] ?? s
      if (LAW_TABLE[s][e] !== undefined) { this.st = s; return }
    }
  }
}
