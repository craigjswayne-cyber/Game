import { readMgrGender } from '../skins'
import { saveQueue } from '../saveQueue'
import { noteWhere, readWhere, sameSession } from '../nav'
import { tIn } from '../../game/i18n'
import { dreamState, dreamsFor } from '../../game/dream'
import { closeNatTenure, logDecision } from '../../game/model'
import { newGame } from '../../game/newgame'
import { applyForJob, resignJob, answerJobOffer } from '../../game/jobs'
import { answerPress } from '../../game/media'
import { nationNameIn } from '../../game/nations'
import { loadGame, putResume } from '../../game/save'
import { noteUse } from '../../game/usage'
import type { GetState, NavEntry, SetState, Store } from '../types'

export const careerSlice = (set: SetState, get: GetState) => ({
  game: null,
  tick: 0,
  saveSlot: 'slot1',

  saveFail: 0,
  saveFailMsg: null,
  noteSaveFail: (msg) => set(s => ({ saveFail: s.saveFail + 1, saveFailMsg: msg, tick: s.tick + 1 })),
  dismissSaveFail: () => set({ saveFail: 0, saveFailMsg: null }),

  weekFailed: 0,
  dismissWeekFailed: () => set({ weekFailed: 0 }),
  revertToDisk: async () => {
    const slot = get().saveSlot
    const g = await loadGame(slot).catch(() => null)
    if (!g) return false
    // what memory holds is what is being undone: none of it goes to disk
    saveQueue.discard()
    get().setGame(g, slot)
    return true
  },
  rollBack: async () => {
    const slot = get().saveSlot
    const g = await loadGame(slot).catch(() => null)
    if (!g) {
      // nothing on disk to go back to: keep the writer held so the half-settled
      // career in memory never overwrites anything, and say so
      set(s => ({ weekFailed: 2, tick: s.tick + 1 }))
      return
    }
    saveQueue.release()
    get().setGame(g, slot)
    set(s => ({ weekFailed: 1, tick: s.tick + 1 }))
  },

  start: (clubId, managerName, challengeId, origin, gender, mgrGender, seedIn) => {
    // the wizard may name the seed, so the aim it showed is the aim the board sets
    const seed = seedIn ?? ((Math.random() * 2 ** 31) | 0)
    const g = newGame(clubId, managerName, seed, challengeId, origin, gender ?? get().newGender, mgrGender ?? readMgrGender())
    // the Manager's License, chosen at creation and never after: the wizard
    // only offers the toggle to an owner, and this re-checks the receipt so
    // nothing else can set the flag (grantprobe holds that it never sets
    // itself)
    // the licensed start went with the Manager's License product (v1.1.6
    // swapped it for Support the game); old saves keep their stamp
    // the welcome dialog belongs to a career starting, not to a screen being
    // rendered: Home used to decide this from week 1 / season 0, which fired
    // again every time a brand-new save was re-opened on another device.
    let firstRun = false
    try { firstRun = localStorage.getItem('rm-tut') !== '1' } catch { /* private mode */ }
    noteWhere(get().saveSlot, [{ screen: 'home' }])
    // A NEW CAREER OWES NOTHING TO THE LAST ONE'S MATCH (1.6.3), and since
    // 1.6.3 resumeFits asks for the career's own seed and name, so the record
    // of whatever career last used this slot can never be matched against
    // this one (scripts/qa/crossrec.ts). It is NOT cleared here any more
    // (1.8.2): that record is the only thing holding the old career's match
    // in progress, and clearing it was a way to discard a losing match -
    // start a career over the slot, then import a backup of the old one.
    // The next kick-off in this slot writes over it.
    set({ game: g, nav: [{ screen: 'home' }], tick: get().tick + 1, tut: firstRun, matchRec: null, liveMatch: null, weekFailed: 0 })
    // a brand-new career goes to disk at once: there is nothing yet to lose, and
    // losing it is the one save failure a player would not understand
    void get().persistNow()
  },

  toggleShortlist: (playerId) => {
    const g = get().game
    if (!g) return
    g.shortlist = g.shortlist.includes(playerId)
      ? g.shortlist.filter(id => id !== playerId)
      : [...g.shortlist, playerId].slice(-25)
    set(s => ({ tick: s.tick + 1 }))
    // The audit asked for this to be decided rather than left ambiguous. The
    // shortlist is on GameState, it survives a rollover, and a manager who
    // starred six players and reloaded found none of them - so it is meant to
    // last, and now it is written like everything else that is.
    void get().persist()
  },

  setGame: (g, slot, _keepPlace = false) => {
    // EVERY LOAD LANDS ON HOME (round 5, owner: "When you load into the game
    // again it should always load into the Home page"). Continue used to
    // pass keepPlace and land on whatever screen the bookmark held; the
    // argument is still accepted so the callers need not change, and no
    // longer does anything. One entry, so Back has nowhere stale to go.
    const nav: NavEntry[] = [{ screen: 'home' }]
    noteWhere(slot, nav)
    // the career being replaced writes its last marks to its own slot first
    // (saveQueue.leaving, 1.9.4 audit)
    if (get().game && get().game !== g) saveQueue.leaving()
    // A MATCH KICKED OFF IS A MATCH TO FINISH (1.8.2, tester note 1.4). This
    // used to clear the live-match record, on the reasoning that loading from
    // the title never replays a match. That reasoning was the exploit: losing,
    // closing the game and pressing Continue threw the match away and offered
    // it again. Opening a career now looks for the match first, in this slot,
    // in any other slot the career was copied to, and inside the save itself.
    // another career is not the one a failed settle held (weekFailed)
    set({ game: g, saveSlot: slot, nav, tick: get().tick + 1, matchRec: null, liveMatch: null, resuming: true, weekFailed: 0 })
    void get().resumeLiveMatch().catch(() => false).finally(() => {
      if (get().game === g || get().liveMatch) set({ resuming: false })
    })
  },
  setSlot: (slot) => {
    // A MATCH SAVED INTO ANOTHER SLOT GOES WITH IT. The short record follows
    // saveSlot from here on, so the new slot needs the pre-match half too.
    const rec = get().matchRec
    if (rec && get().liveMatch && slot !== get().saveSlot) void putResume(slot, rec, true).catch(() => {})
    set({ saveSlot: slot })
  },

  /** Pick the career back up where the browser left it (user: "when you refresh
   *  the page it kicks you out to the main menu - dont have it do that, have it
   *  stay on the page"). Returns false when there is nothing to resume, which is
   *  the title screen's cue to behave as it always did. */
  resume: async () => {
    // A RELOAD should not cost the manager his place. STARTING THE GAME should
    // still start at the title screen, because that is where the three decisions
    // live: new career, load one, or carry on with this one. The bookmark used to
    // be honoured on both, so opening the app dropped you straight into a save
    // and the Continue tile built for exactly that choice never got a look.
    //
    // sessionStorage is the difference, and it is the only honest one available:
    // it survives a refresh of the same tab and is empty on a fresh launch. So a
    // refresh resumes in place, and opening the game asks.
    if (!sameSession()) return false
    const where = readWhere()
    if (!where) return false
    const g = await loadGame(where.slot).catch(() => null)
    if (!g) return false
    // ON HOME, like every other way in (round 5): the bookmark now only says
    // which career, not which screen
    const nav: NavEntry[] = [{ screen: 'home' }]
    noteWhere(where.slot, nav)
    set({ game: g, saveSlot: where.slot, nav, tick: get().tick + 1, resuming: true })
    // AND THE MATCH HE WAS WATCHING. A refresh mid-match used to drop the manager
    // back into the week with the game gone; the record written at kick-off lets it
    // be played back to the same minute (game/resume.ts).
    await get().resumeLiveMatch().catch(() => false)
    if (get().game === g || get().liveMatch) set({ resuming: false })
    return true
  },
  /** Re-render after a screen changed the career in place, AND mark it for
   *  saving (1.8.1). touch() used to be only the first half. Some forty screen
   *  actions (a tactic dial, a staff hire, a transfer reply, a retirement, the
   *  Annual's button) mutate the game and then call touch() to redraw, and
   *  none of them marked the save dirty, so pagehide's flush found nothing to
   *  write and a phone that killed the app before the next Continue lost the
   *  action. Every touch() in the tree follows a mutation, so the mark belongs
   *  here, once, rather than beside each of them where the next screen would
   *  forget it. It is the soft mark: a dial being dragged calls this on every
   *  step, and one write after the hand stops is the right cost for that. */
  touch: () => {
    set(s => ({ tick: s.tick + 1 }))
    if (get().game) saveQueue.mark(true)
  },

  answerPressOption: (pressId, optionIndex) => {
    const g = get().game
    if (!g) return
    answerPress(g, pressId, optionIndex)
    noteUse('press')
    set(s => ({ tick: s.tick + 1 }))
    // P1-01 from the external audit of 13 Sep 2026: this mutated persistent
    // career state - morale, board and fan standing, promises, relationships -
    // and bumped the tick without ever saving, so a reload before the next
    // autosave lost the manager's answer and the press room asked again.
    //
    // The reason it was left out is the reason the save queue exists: adding a
    // 5 MB write to every press answer was a real cost, and skipping it was a
    // real bug. A mark is neither.
    void get().persist()
  },

  refocusDream: (id: string) => {
    const g = get().game
    if (!g || g.unemployed || !g.dream) return false
    const cur = dreamState(g)
    // only a REALISED dream may be retired: an unachieved one never resets
    if (!cur?.progress.done) return false
    const club = g.clubs[g.userClubId]
    if (!club) return false
    const ctx = { clubId: g.userClubId, clubName: club.short ?? club.name, leagueId: club.leagueId, rep: club.rep }
    if (!dreamsFor(ctx).some(dd => dd.id === id)) return false
    if (id === g.dream.id || (g.dreamsDone ?? []).some(x => x.id === id)) return false
    // the honour is banked before the ambition moves on (rollover also does
    // this at the season's end; refocusing mid-season must not lose it)
    if (!(g.dreamsDone ?? []).some(x => x.id === g.dream!.id)) (g.dreamsDone ??= []).push({ ...g.dream })
    g.dream = { id, clubId: g.userClubId, season: g.season }
    const def = dreamsFor(ctx).find(dd => dd.id === id)!
    logDecision(g, 'dec.dreamRefocus', { dream_k: def.titleLowerK, ...(def.titleVars?.(ctx) ?? {}) }, true)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
    return true
  },

  answerJobOffer: (accept) => {
    const g = get().game
    if (!g) return 'No game.'
    const msg = answerJobOffer(g, accept)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
    return msg
  },

  applyJob: (clubId) => {
    const g = get().game
    if (!g) return 'No game.'
    const msg = applyForJob(g, clubId)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
    return msg
  },

  /** Turn a vacancy down, or change your mind about having turned it down. */
  passJob: (clubId, passed = true) => {
    const g = get().game
    if (!g) return
    const v = g.vacancies.find(x => x.clubId === clubId)
    // an application already lodged is not something to quietly un-say
    if (!v || v.applied) return
    v.passed = passed
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  resign: () => {
    const g = get().game
    if (!g || g.unemployed) return
    resignJob(g)
    set(s => ({ nav: [{ screen: 'home' }], tick: s.tick + 1 }))
    void get().persist()
  },

  answerNatOffer: (accept, keepClub = true) => {
    const g = get().game
    if (!g || !g.natOffer) return
    const nat = g.natOffer.nat
    g.natOffer = null
    if (accept) {
      g.natTeam = nat
      g.natConfidence = 60
      g.natRecord = { m: 0, w: 0, d: 0, l: 0 } // a new tenure starts at nought
      // filed as a key and its variables, with the English beside it: the
      // nation travels as its English name plus a code twin (nat_n), so the
      // reader's language names the country
      const k = keepClub && !g.unemployed ? 'news.natTaken' : 'news.natTakenSole'
      const v = { nat: nationNameIn('en', nat), nat_n: nat }
      g.news.push({
        id: g.nextId++, week: g.week, season: g.season, type: 'board', read: false,
        subject: tIn('en', `${k}Subj`, v), body: tIn('en', k, v), k, v,
      })
      // v1.1.5 (owner): taking a national job asks whether the club job is
      // kept. Declining it walks the same resignation the Profile button
      // walks - desk cleared on your own terms, vacancy opened, offers dying
      // with the job - with the national post already in hand.
      if (!keepClub && !g.unemployed) resignJob(g)
    }
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  /** THE ONLY QUESTION A BOUGHT APPOINTMENT LEAVES (v1.1.12). The job is
   *  already installed by applyPinnacle; this answers "and the club?".
   *  Keeping it is a no-op beyond clearing the question, which is why an
   *  unanswered question is safe to leave standing forever. */
  answerNatKeep: (keep: boolean) => {
    const g = get().game
    if (!g || !g.natKeepAsk) return
    g.natKeepAsk = null
    if (!keep && !g.unemployed) resignJob(g)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  resignNat: () => {
    const g = get().game
    if (!g || !g.natTeam) return
    const nat = g.natTeam
    closeNatTenure(g) // the record moves to the profile's history, not the bin
    const v = { nat: nationNameIn('en', nat), nat_n: nat }
    g.news.push({
      id: g.nextId++, week: g.week, season: g.season, type: 'board', read: false,
      subject: tIn('en', 'news.natResignedSubj', v), body: tIn('en', 'news.natResigned', v),
      k: 'news.natResigned', v,
    })
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  /** Never rejects. Every call site is `void get().persist()`, so a thrown
   *  write would have been an unhandled rejection and nothing more - the game
   *  carried on looking perfectly healthy while saving nothing. A failure now
   *  raises a banner instead, and a later success clears it. */
  persist: async () => {
    if (!get().game) return
    saveQueue.mark()
  },

  persistNow: async () => {
    if (!get().game) return false
    return saveQueue.flush()
  },
} satisfies Partial<Store>)
