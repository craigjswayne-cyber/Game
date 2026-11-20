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
import { createMachine, getInitialSnapshot, getNextSnapshot } from 'xstate'

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

const machine = createMachine({
  id: 'laws',
  initial: 'kickoff',
  states: {
    // waiting for a kick from halfway
    kickoff: { on: { KICKOFF: 'open', HALF: 'kickoff' } },
    // the ball is in play
    open: { on: {
      PLAY: 'open', KICK: 'open', TOUCH: 'touch', STOP: 'scrum', PENALTY: 'penalty', TRY: 'try',
      DROPGOAL: 'kickoff', DROPMISS: 'dropout', DEAD: 'dropout', HALF: 'kickoff',
    } },
    // in touch: only a lineout restarts it (a quick throw is a lineout here)
    touch: { on: { LINEOUT: 'open', HALF: 'kickoff' } },
    // stopped for a scrum
    scrum: { on: { SCRUM: 'open', PENALTY: 'penalty', HALF: 'kickoff' } },
    // a penalty or free kick has been given: kick at goal, kick to touch, tap, or take the scrum
    penalty: { on: {
      GOAL: 'kickoff', GOALMISS: 'dropout', TOUCH: 'touch', PLAY: 'open', KICK: 'open', SCRUM: 'open',
      PENALTY: 'penalty', TRY: 'try', DEAD: 'dropout', HALF: 'kickoff',
    } },
    // a try has been scored: the conversion, then a kick-off
    try: { on: { CON: 'kickoff', KICKOFF: 'open', HALF: 'kickoff' } },
    // waiting for a drop-out
    dropout: { on: { DROPOUT: 'open', HALF: 'kickoff' } },
  },
})

type Snap = ReturnType<typeof getInitialSnapshot<typeof machine>>

export class Laws {
  private snap: Snap = getInitialSnapshot(machine)
  get state(): LawState { return this.snap.value as LawState }
  can(e: LawEvent): boolean { return this.snap.can({ type: e }) }
  /** make the move; false, and nothing changes, when the laws do not allow it */
  go(e: LawEvent): boolean {
    if (!this.can(e)) return false
    this.snap = getNextSnapshot(machine, this.snap, { type: e })
    return true
  }
  /** THE MISSING STEPS: the shortest run of restarts and stoppages that makes
   *  `e` legal from here, or null when there is none within three steps. Only
   *  steps that put no score, card or penalty on the sheet may be supplied:
   *  those are the engine's alone. */
  bridge(e: LawEvent): LawEvent[] | null {
    if (this.can(e)) return []
    const FILL: LawEvent[] = ['KICKOFF', 'DROPOUT', 'LINEOUT', 'SCRUM', 'TOUCH', 'STOP', 'DEAD', 'CON']
    let frontier: { s: Snap; path: LawEvent[] }[] = [{ s: this.snap, path: [] }]
    for (let depth = 0; depth < 3; depth++) {
      const next: { s: Snap; path: LawEvent[] }[] = []
      for (const f of frontier) for (const b of FILL) {
        if (!f.s.can({ type: b })) continue
        const s = getNextSnapshot(machine, f.s, { type: b }), path = [...f.path, b]
        if (s.can({ type: e })) return path
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
      let s: Snap = getInitialSnapshot(machine)
      for (const b of path) s = getNextSnapshot(machine, s, { type: b })
      if (s.can({ type: e })) { this.snap = s; return }
    }
  }
}
