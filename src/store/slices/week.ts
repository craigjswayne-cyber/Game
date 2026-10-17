import { isSettling, landOnNextWeek, settleWeek, settleWeekAsync, slicedSettles } from '../week'
import { openDay } from '../nav'
import { deskBlock, deskGates, inInbox, markRead, matchDayIndex, nextStep, pressBlock } from '../../game/days'
import { postWindowNotes } from '../../game/window'
import { natSquadHold } from '../../game/country'
import type { GetState, SetState, Store } from '../types'

/**
 * How close together two Continue taps have to be before the second is treated as
 * a slip rather than an instruction.
 *
 * 220ms is above the 120-200ms a double tap lands in and below the ~300ms at which
 * a deliberate second tap starts to feel ignored. Exported so tapprobe can test
 * both sides of it rather than sleeping.
 */
export const TAP_GUARD_MS = 220

export const weekSlice = (set: SetState, get: GetState) => ({
  lastAdvanceAt: 0,

  turning: false,
  /**
   * PAINT FIRST, THEN TURN THE WEEK (1.9.1).
   *
   * Settling a week runs every match in the world and takes 230 to 480 ms on a
   * desktop, so a second or more on a budget phone, all of it in the tap's own
   * handler. Nothing could paint until it finished: the button did not even
   * look pressed, and a player who tapped again had no way to know the first
   * tap had landed. When this tap is the one that turns the week, the button
   * shows that it is working and the settle runs on the frame after. Day steps
   * and match day stay immediate: they are cheap, and nothing waits for them.
   */
  continueTap: () => {
    const g = get().game
    if (!g || get().turning) return
    if (nextStep(g).kind !== 'week' || typeof requestAnimationFrame !== 'function') { get().continueWeek(); return }
    set({ turning: true })
    // AND THE DESK IS ON DISK FIRST (1.9.1 re-audit, N3). A failed settle puts
    // the career back to its save; a dial moved half a second before Continue
    // was still waiting on the idle timer and would have gone with it. The
    // pending write lands before the week starts to turn.
    requestAnimationFrame(() => setTimeout(() => {
      void get().persistNow().catch(() => false)
        .then(() => get().continueWeek())
        .finally(() => set({ turning: false }))
    }, 0))
  },

  /** CM-style Continue: play user's match if there is one, else process the week. */
  continueWeek: () => {
    const g = get().game
    if (!g) return
    // a week already turning in slices is the only thing happening
    if (isSettling()) return
    // A RETIRED MANAGER DOES NOT GET ANOTHER WEEK (career.ts). The save stays
    // readable forever - the record, the cabinet and the verdict are the whole
    // point of an ending - but the clock has stopped.
    if (g.retired) return
    // a match may be on its way back from disk (setGame): that match comes first
    if (get().resuming) return
    /**
     * ONE TAP IS ONE WEEK.
     *
     * A week settle measures 34ms median and 48ms at worst on a two-season save
     * and grows with the save, which is comfortably inside a human double tap. A
     * player who taps again because nothing has visibly happened yet was
     * advancing two days, or skipping a day bulletin, or going straight through a
     * matchday without seeing it.
     *
     * WHY THIS IS A TIMESTAMP AND NOT A BOOLEAN, which is the whole lesson: the
     * first attempt set an `advancing` flag on entry and cleared it on every exit
     * path, and rendered the button disabled while it was set. scripts/tapprobe.ts
     * failed it immediately. JavaScript is single threaded, so the handler runs to
     * completion - INCLUDING clearing the flag - before the queued second touch is
     * dispatched. A flag that is set and cleared inside one synchronous call
     * cannot block the next call, and the disabled attribute never renders because
     * the main thread is busy for the whole settle. Both defences were theatre.
     *
     * A debounce is the only thing that works, because the thing being defended
     * against is two events arriving faster than a human meant them.
     */
    const now = Date.now()
    if (now - get().lastAdvanceAt < TAP_GUARD_MS) return
    set(() => ({ lastAdvanceAt: now }))
    // THE ANNUAL GATE (25C). A season just closed and its page has not been
    // dismissed - wherever the manager has wandered, Continue leads back to
    // it, and only its button opens the new season. Forced, as asked
    // (user: "a forced page that says 'ready for a new season?'").
    if (g.annual) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'annual' ? s.nav : [...s.nav, { screen: 'annual' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // A bid for one of your players cannot be ignored (feedback 10E). Offers used
    // to sit in a tab and lapse in silence after two weeks, so the biggest
    // decision of a season could be answered for you by a timeout. The week stops
    // here until the desk is clear.
    if (!g.unemployed && g.offers.some(o => o.status === 'pending' && o.forUser)) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'offers' ? s.nav : [...s.nav, { screen: 'offers' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // ---- Continue walks the week a day at a time ----
    //
    // See game/days.ts for why. nextStep is the single decision point: the
    // masthead's label, this handler and the day bulletin all read it, so they
    // can never disagree about what day it is or what happens next.
    const step = nextStep(g)
    // the window's countdown for the day the week leaves on (a Friday-night
    // match is the Friday notice) is posted here, so the gate below has it
    // read before kick-off or the settle rather than after them (window.ts)
    if (deskGates(step)) postWindowNotes(g, step.kind === 'match' ? (matchDayIndex(g) ?? 5) : 5)
    // ---- THE DESK GATE (see game/days.ts deskBlock) ----
    //
    // Asked for twice: "when I click continue it doesnt just continue through
    // all unread message and force me to respond to press enquiries etc ...
    // everything should be answered, read between games."
    //
    // Only on the way OUT of the week - into the match or into the settle - so
    // the Monday-to-Friday walk is untouched and Tuesday still gets to introduce
    // the press question before anything insists on it. The button's label reads
    // the same predicate, so it says "Read (3)" rather than refusing in silence.
    // ---- THE PRESS HOLD APPLIES ON EVERY STEP, AND IT IS HARD ----
    //
    // Owner, v1.1.17: "press questions MUST be answered when they arrive - you
    // shouldn't be able to continue through the game."
    //
    // Two things changed. It holds on every step rather than only on the way
    // out of the week, so a question cannot be walked past on the following
    // day; and it no longer yields on the second tap.
    //
    // THE SECOND TAP IS WHY THIS WAS SOFT, and the history is worth keeping.
    // A hard hold shipped once and scripts/soakui.mjs found the consequence
    // inside one season: 60 taps without the week moving, stuck on the Press
    // Room at season 2 week 1. That was not the gate being wrong, it was the
    // gate being ILLEGIBLE - a manager who does not know a question is
    // required cannot tell a hold from a bricked save.
    //
    // What makes it safe now is that the refusal explains itself. The Continue
    // button reads the same predicate and relabels itself "Answer the press",
    // the first tap still carries you to the room, and every question that can
    // hold is one with options on it - a question with no options can never
    // hold, or the save really would lock. soakui answers the room instead of
    // tapping past it, which is what a player does.
    {
      const press = pressBlock(g)
      if (press) {
        // a board decision is answered on Finances > The Board, which opens on
        // that tab while one is waiting
        const where = press.kind === 'board' ? 'finances' as const : 'press' as const
        const onIt = get().nav[get().nav.length - 1]?.screen === where
        if (!onIt) {
          set(s => ({ nav: [...s.nav, { screen: where }], tick: s.tick + 1 }))
        }
        return
      }
    }
    // ---- AND THE COUNTRY WAITS FOR ITS SQUAD ----
    //
    // Owner, v1.1.17: "the game stopping and asking the international coach to
    // select his squad... It needs to be more obvious."
    //
    // The camp opens empty now, so this is what turns that from an oversight
    // into a job. Same shape as the press hold, same safety: it only holds when
    // there are enough callable men to clear it, and the first tap carries him
    // to the desk where the naming happens.
    {
      const sq = natSquadHold(g)
      if (sq) {
        const onDesk = get().nav[get().nav.length - 1]?.screen === 'country'
        if (!onDesk) {
          set(s => ({ nav: [...s.nav, { screen: 'country' as const }], tick: s.tick + 1 }))
        }
        return
      }
    }
    if (deskGates(step)) {
      const desk = deskBlock(g)
      if (desk?.kind === 'mail') {
        // ONE TAP, EVERY STORY (owner, v1.1.12: "pressing continue should go
        // through every news story before continuing").
        //
        // It used to serve ONE story per tap, and hold for at most six of them
        // before relenting - a budget rather than a promise, because insisting
        // on a fifty-four-story rollover pile one tap at a time is a fifty-four
        // tap summer, which scripts/soakui.mjs duly called frozen.
        //
        // The budget was the wrong shape of answer. The game already owns a
        // full-screen reader that walks a queue - the Wire, entered from
        // Continue, with "Next Story", a 3/9 counter and an explicit "Skip the
        // rest" - so the whole pile goes into it and ONE tap reads all of it.
        // Fifty-four stories is then fifty-four pages of a reader you can leave
        // whenever you like, not fifty-four refusals; and because leaving marks
        // the rest read, the gate always clears in a single pass. No budget, no
        // soft lock, and the owner's ask met literally.
        //
        // AND IT YIELDS FROM INSIDE THE READER, the same shape the press hold
        // takes and for the same reason: being made to LOOK is a gate, being
        // unable to leave is a bug. The first tap opens the pile; a tap from
        // inside it says "I have seen enough", marks the rest read and lets the
        // week go on. So the gate costs two taps at worst however deep the pile
        // is, while the reader's own Next Story still walks every word of it.
        const onWire = get().nav[get().nav.length - 1]?.screen === 'wire'
        const unread = g.news.filter(n => !n.read && !n.cleared && inInbox(g, n)).sort((a, b) => a.id - b.id)
        if (onWire) {
          for (const n of unread) markRead(g, n)
          // THE PRESS WAITED FOR THE MAIL, NOT FOR THE WEEK (1.8.4 career QA).
          // pressBlock stands aside while a story is unread, and this tap is
          // the one that reads the last of them - so without asking again
          // here, leaving the Wire turned the week with every question still
          // open, and a manager who only ever pressed Continue was never once
          // taken to the press room or the board in eighteen weeks. The mail
          // is read now: whatever it was holding back holds the week.
          const press = pressBlock(g)
          if (press) {
            const where = press.kind === 'board' ? 'finances' as const : 'press' as const
            set(s => ({ nav: [...s.nav, { screen: where }], tick: s.tick + 1 }))
            return
          }
        } else if (unread.length) {
          get().openWire(unread.map(n => n.id))
          return
        }
      }
      // The press room and the board hold the week at the top of
      // continueWeek (pressBlock, above), and only questions with options can
      // hold, so the hold always has a way out. Mail is gated here because the
      // gate does its own clearing: one tap hands the pile to the reader, and
      // leaving the reader marks the rest read, so it always terminates.
    }
    if (step.kind === 'match') {
      // stand the manager on the day the match actually falls, so the masthead
      // reads Friday for a Friday night game
      const md = matchDayIndex(g)
      if (md != null) g.day = md
      set(s => ({ nav: [...s.nav, { screen: 'matchday' }], tick: s.tick + 1 }))
      // the day moved, so a reload should come back to the match day rather
      // than the day before it
      void get().persist()
      return
    }
    if (step.kind === 'day') {
      g.day = step.day
      postWindowNotes(g)
      set(s => ({ nav: openDay(s.nav), tick: s.tick + 1 }))
      void get().persist()
      return
    }
    // the week is spent: settle it, then start the new Monday. The watermark is
    // what tells the bulletins which stories are new.
    g.newsFrom = g.nextId
    if (slicedSettles()) return settleWeekAsync(g, get).then(() => landOnNextWeek(g, set, get))
    settleWeek(g, get)
    landOnNextWeek(g, set, get)
  },
} satisfies Partial<Store>)
