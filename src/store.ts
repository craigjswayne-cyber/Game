import { create } from 'zustand'
import { noteScreen } from './game/bugreport'
import {
  effectiveSkin, MGR_GENDER_KEY, planSlots, proLocked, readMgrGender, readSkin, SKIN_KEY, SKINS, skinLocked, type Skin,
} from './store/skins'
import type { NavEntry, Screen, Store } from './store/types'
import { bindStore } from './store/api'
import { saveQueue, saveStats } from './store/saveQueue'
import { countForPro, nextHighlight, settleKnockout } from './store/live'
import { noteWhere, onMatchDay, openDay, readWhere, sameSession, WHERE_KEY } from './store/nav'

export { effectiveSkin, planSlots, proLocked, saveStats, SKINS, skinLocked }
export type { Screen, Skin }
import { getLang, initLang, onLangChange, setLang as applyLang, setManagerGender, setWorld, t, tIn, type Lang } from './game/i18n'
import { hasSupporter } from './game/monetise'
import { applyCharter, applyEstate, applyHeal, applyInjection, applyPinnacle } from './game/grants'
import {
  agencyFile, armAnalyst, insideWordFavour, physioFavour, secondOpinionFavour, tapeRoomFavour,
  teamNightFavour, townCollection,
} from './game/rewarded'
import { dreamState, dreamsFor } from './game/dream'
import type { GameState } from './game/model'
import { closeNatTenure, logDecision } from './game/model'
import { newGame } from './game/newgame'
import { genderOf, type Gender } from './game/gender'
import { matchRng, processWeekAndAdvance, processWeekAndAdvanceAsync, userMatchThisWeek } from './game/season'
import { resultsParam } from './game/schedule'
import {
  openDressingRoom, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution, swapInjuryCover, coverInjury, swapShirts, undoSubstitution,
  playHalf, resolveDecision, stepTick, teamName, forfeitSide, settleForfeit } from './game/matchEngine'
import { applyForJob, resignJob, answerJobOffer } from './game/jobs'
import { answerPress } from './game/media'
import { deskBlock, deskGates, firstStepOfWeek, inInbox, markRead, matchDayIndex, nextStep, pressBlock } from './game/days'
import { postWindowNotes } from './game/window'
import { natSquadHold } from './game/country'
import { nationNameIn } from './game/nations'
import { clearResume, getResume, loadGame, migrate, peekResumes, putResume } from './game/save'
import {
  notePlayedOut, playOut, recordReach, replayMatch, resumeFits, sameCareer, stampedRecord, stampedSave,
  type LiveStamp, type MatchCmdBody, type MatchResume,
} from './game/resume'
import { fileFindings } from './game/matchfindings'
import { fileEvidence } from './game/evidence'
import { countFinished, countScreen, countWeek, noteUse } from './game/usage'

/**
 * How close together two Continue taps have to be before the second is treated as
 * a slip rather than an instruction.
 *
 * 220ms is above the 120-200ms a double tap lands in and below the ~300ms at which
 * a deliberate second tap starts to feel ignored. Exported so tapprobe can test
 * both sides of it rather than sleeping.
 */
export const TAP_GUARD_MS = 220

/** THE WEEK TURNS ALL AT ONCE OR NOT AT ALL (1.9.1).
 *
 *  processWeekAndAdvance changes the career in place, step by step: wages,
 *  drills, knocks, the table, the calendar. A throw halfway left a career that
 *  was neither last week nor this one, the next mark wrote it to disk, and a
 *  second tap ran the steps that had already run. Now a throw holds the writer
 *  so the half-turned career is never saved, puts the career back to the copy
 *  on disk, and rethrows so the crash log still records it. The same week
 *  failing twice in a row stops there rather than reloading forever. */
let failedWeek: string | null = null
/** settleguardprobe plants a failure here, after the week has been changed in
 *  memory, to prove the change is never written. Nothing in the game sets it. */
export const settleFault: { after: ((g: GameState) => void) | null } = { after: null }
function settleWeek(g: GameState, get: () => Store): void {
  const key = `${g.seed}:${g.season}:${g.week}`
  try {
    processWeekAndAdvance(g)
    settleFault.after?.(g)
    failedWeek = null
  } catch (e) {
    saveQueue.hold(g)
    if (failedWeek === key) useStore.setState(s => ({ weekFailed: 2, tick: s.tick + 1 }))
    else { failedWeek = key; void get().rollBack() }
    throw e
  }
}

/** A week settle running in slices (settleWeekAsync): nothing else may turn
 *  a week, or change the career, until it is done. */
let settling = false
export const isSettling = (): boolean => settling

/** settleWeek, sliced so the screen keeps painting (season.weekSteps). The
 *  save queue is held for the career while the week is half-turned, the
 *  screen is covered so no tap reaches the career, and a throw takes exactly
 *  the path settleWeek's does. */
async function settleWeekAsync(g: GameState, get: () => Store): Promise<void> {
  const key = `${g.seed}:${g.season}:${g.week}`
  settling = true
  saveQueue.hold(g)
  useStore.setState({ turning: true })
  try {
    await processWeekAndAdvanceAsync(g)
    settleFault.after?.(g)
    failedWeek = null
    saveQueue.resume()
  } catch (e) {
    if (failedWeek === key) useStore.setState(s => ({ weekFailed: 2, tick: s.tick + 1 }))
    else { failedWeek = key; void get().rollBack() }
    throw e
  } finally {
    settling = false
    useStore.setState({ turning: false })
  }
}

/** The browser game settles in slices; the probes, which have no screen to
 *  keep painting, settle in one go. Set once by App on mount. */
let sliceSettles = false
export const settleInSlices = (on: boolean): void => { sliceSettles = on }

/** Land on the first day of a freshly settled week.
 *
 *  Monday first, because that is where the results and the treatment room are.
 *  If the whole week is somehow empty this falls through to the round-up screen,
 *  which is what a blank week used to show.
 *
 *  Split out of continueWeek because finishMatch needs exactly the same landing:
 *  a week that ended in a match and a week that ended in a blank Saturday should
 *  resume on the same footing. */
function landOnNextWeek(
  g: GameState,
  set: (fn: (s: Store) => Partial<Store>) => void,
  get: () => Store,
  extra: NavEntry[] = [],
  // a match played out on the way back into a career (resumeLiveMatch): Home
  // and nothing over it, as every load lands (round 5)
  homeOnly = false,
) {
  // the feedback report's week count (game/usage.ts): device state, keyed so
  // a week is counted once however it was reached
  countWeek(`${g.seed}:${g.season}:${g.week}`)
  // and the season it closed, when this Monday opens the end-of-season review:
  // the feedback card waits for a finished season (usage.feedbackDue)
  if (g.annual) countFinished(`${g.seed}:${g.annual.season}`)
  const step = firstStepOfWeek(g)
  g.day = step.kind === 'day' ? step.day : step.kind === 'match' ? (matchDayIndex(g) ?? 0) : 0
  // the window's countdown is posted as the walk reaches its day (window.ts)
  postWindowNotes(g)
  const dayEntry: NavEntry[] = step.kind === 'day' ? [{ screen: 'day' }] : []
  // THE ANNUAL GATE (25C): a rollover just happened, so before anything else
  // the manager gets the "ready for a new season?" page. It rides on TOP of
  // the normal landing, so its one button simply pops back into the new
  // season's Monday.
  const annualEntry: NavEntry[] = g.annual ? [{ screen: 'annual' }] : []
  // `extra` goes on TOP: after your own final whistle the round-up is the screen
  // you want, and the new week's Monday sits underneath it, so backing out of the
  // round-up puts you at the start of the week rather than nowhere.
  set(s => ({
    nav: homeOnly ? [{ screen: 'home' }] : [{ screen: 'home' }, ...dayEntry, ...extra, ...annualEntry],
    tick: s.tick + 1,
  }))
  void get().persist()
}

export const useStore = create<Store>((set, get) => ({
  game: null,
  tick: 0,
  lastAdvanceAt: 0,
  nav: [{ screen: 'menu' }],
  liveMatch: null,
  matchRec: null,
  resuming: false,
  wireQueue: [],
  saveSlot: 'slot1',
  inboxId: null,
  // NIGHT IS THE DEFAULT (design brief): a fresh install opens under the
  // floodlights, and only an explicit '0' - the player choosing daylight -
  // turns them off. The old default was day, which nobody who reported in
  // ever used.
  night: typeof localStorage === 'undefined' || localStorage.getItem('rm-night') !== '0',

  /* THE SKIN (v1.2.1). Read once at boot like the language and the type
     scale, so the first paint is already in the chosen colours rather than
     flashing the default and correcting itself. 'default' means the built-in
     pair - the floodlight toggle's night and day - and is what every save
     that has never opened Settings gets. */
  skin: readSkin(),
  setSkin: (skin: Skin) => {
    // Belt and braces behind the Settings UI: a locked skin never becomes the
    // choice, so no route into this setter can dress a free game in a paid
    // palette.
    if (skinLocked(skin)) return
    if (skin !== get().skin) noteUse('skin')
    try { localStorage.setItem(SKIN_KEY, skin) } catch { /* private mode */ }
    set({ skin })
  },

  // WRITTEN IN TWO PLACES, deliberately. The save owns it - it is a fact about
  // the manager and it travels with the career to another phone - and the
  // device remembers the last answer so a second career does not open as a man
  // again. i18n.ts is told directly rather than through the subscription above,
  // which only fires when the game OBJECT changes; this mutates the one that is
  // already open.
  setMgrGender: (g: Gender) => {
    try { localStorage.setItem(MGR_GENDER_KEY, g) } catch { /* private mode */ }
    const game = get().game
    if (game) game.mgrGender = g
    setManagerGender(g)
    set(st => ({ tick: st.tick + 1 }))
    // WRITTEN THROUGH, not left for the next week to carry. A career resumed
    // after a reload comes off the last save on disk, so a pronoun changed on
    // a Tuesday and never followed by an autosave came back as it was
    // (scripts/mgrgender.mjs, section 4).
    // NOT the queue: the comment above is a guarantee, and mgrgender.mjs
    // reloads to check it. A coalesced write would race the reload.
    if (game) void get().persistNow()
  },
  toggleNight: () => set(s => {
    const night = !s.night
    noteUse('night')
    try { localStorage.setItem('rm-night', night ? '1' : '0') } catch { /* private mode */ }
    return { night }
  }),

  // parsed defensively: a mangled value must read as the default, never as NaN
  // (NaN zoom would blank the whole app)
  textScale: (() => {
    if (typeof localStorage === 'undefined') return 1
    const v = Number(localStorage.getItem('rm-zoom'))
    return [1.15, 1.3].includes(v) ? v : 1
  })(),
  setTextScale: (v: number) => {
    const scale = [1.15, 1.3].includes(v) ? v : 1
    try { localStorage.setItem('rm-zoom', String(scale)) } catch { /* private mode */ }
    set({ textScale: scale })
  },

  // initLang reads the stored choice, or takes the device's hint the first
  // time. Doing it here rather than in a useEffect means the very first paint
  // is already in the right language: a French phone never flashes English.
  lang: initLang(),
  // applyLang may finish later: a dictionary that is a lazy chunk (v1.2.0)
  // only commits once it has loaded, so the store cannot read the answer
  // synchronously - the onLangChange subscription below carries the commit
  // into React whenever it lands, first tap or slow network alike.
  setLang: (l: Lang) => { if (l !== get().lang) noteUse('lang'); return applyLang(l) },

  supporter: hasSupporter(),
  claimSupporter: () => set(s => ({ supporter: hasSupporter(), tick: s.tick + 1 })),

  tut: false,
  openTut: () => set({ tut: true }),
  feedback: false,
  openFeedback: () => set({ feedback: true }),
  closeFeedback: () => set({ feedback: false }),
  closeTut: () => {
    try { localStorage.setItem('rm-tut', '1') } catch { /* private mode */ }
    set({ tut: false })
  },

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

  /** The news reader's recall window: everything unread, plus what you have read
   *  in the last five days. Gossip is in this list too now that the wire and the
   *  news are one screen, cleared stories are filed, and days.inInbox is the one
   *  place that decides. */
  // markRead and the cleared flag are career state (the desk gate and the
  // unread count read them), so each of these marks the save as well as
  // redrawing. They did not, and a story read before a reload came back unread.
  openInbox: () => { set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n))
    const unread = live.filter(n => !n.read).sort((a, b) => a.id - b.id)
    const onInbox = s.nav[s.nav.length - 1]?.screen === 'inbox'
    // the inbox opens here rather than through go(): count it as a visit
    if (!onInbox) countScreen('inbox')
    // oldest unread first: a queue is read front to back
    const next = unread[0]
    if (next) {
      markRead(g, next)
      return {
        inboxId: next.id,
        nav: onInbox ? s.nav : [...s.nav, { screen: 'inbox' as const }],
        tick: s.tick + 1,
      }
    }
    // nothing unread, and already reading: the button still moves (owner,
    // 1.8.11: "i should always be able to skip through the news"). It steps
    // one story older through the same 20-story window the arrows walk, and
    // from the oldest wraps back to the newest, so a tap is never a dead tap.
    const window20 = [...live].sort((a, b) => b.id - a.id).slice(0, 20)
    if (onInbox && window20.length > 1) {
      const i = window20.findIndex(n => n.id === s.inboxId)
      const nextOlder = window20[i < 0 || i >= window20.length - 1 ? 0 : i + 1]
      return { inboxId: nextOlder.id, tick: s.tick + 1 }
    }
    // nothing unread: open the newest story so the screen is never blank
    const newest = window20[0]
    return {
      inboxId: s.inboxId ?? newest?.id ?? null,
      nav: onInbox ? s.nav : [...s.nav, { screen: 'inbox' as const }],
      tick: s.tick + 1,
    }
  }); void get().persist() },

  inboxStep: (dir) => { set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n)).sort((a, b) => b.id - a.id).slice(0, 20)
    if (!live.length) return {}
    const i = live.findIndex(n => n.id === s.inboxId)
    // dir -1 goes back in time, which is FORWARD through a newest-first list
    const j = Math.max(0, Math.min(live.length - 1, (i < 0 ? 0 : i) + (dir === -1 ? 1 : -1)))
    markRead(g, live[j])
    return { inboxId: live[j].id, tick: s.tick + 1 }
  }); void get().persist() },

  clearRead: () => { set(s => {
    const g = s.game
    if (!g) return {}
    // gossip clears like everything else now that the wire and the news are one
    // list: exempting it meant Clear read left a screenful behind
    for (const n of g.news) if (n.read) n.cleared = true
    const left = g.news.filter(n => inInbox(g, n))
    return { inboxId: left.length ? left.sort((a, b) => b.id - a.id)[0].id : null, tick: s.tick + 1 }
  }); void get().persist() },

  newGender: 'm',
  setNewGender: (g) => set({ newGender: g }),

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

  go: (screen, param) => set(s => { const nav = [...s.nav, { screen, param }]; noteWhere(s.saveSlot, nav); noteScreen(screen, param); return { nav } }),
  back: () => set(s => {
    const nav = s.nav.length > 1 ? s.nav.slice(0, -1) : s.nav
    noteWhere(s.saveSlot, nav)
    return { nav }
  }),
  home: () => set(s => { noteWhere(s.saveSlot, [{ screen: 'home' as const }]); return { nav: [{ screen: 'home' }] } }),

  /** Pick the career back up where the browser left it (user: "when you refresh
   *  the page it kicks you out to the main menu - dont have it do that, have it
   *  stay on the page"). Returns false when there is nothing to resume, which is
   *  the title screen's cue to behave as it always did. */
  /**
   * Finish a match that was in progress when the page went away.
   *
   * Replays the recorded match on top of its own pre-match save, so the tries,
   * the cards and the injuries come back because they happen again. Returns true
   * if a match was found and played out (round 5: it is no longer put back
   * on screen; see the comment where it is played out).
   */
  resumeLiveMatch: async () => {
    const slot = get().saveSlot
    const g = get().game
    if (!g) return false
    // EVERY COPY OF THIS MATCH, WHEREVER IT IS (1.8.2). The record in this slot;
    // a record in any other slot the same career was saved into or imported
    // from; and the stamp inside the save itself, which is how a file exported
    // mid-match carries its match to another slot or another device.
    const peeks = await peekResumes<LiveStamp>().catch(() => [])
    if (get().game !== g) return false
    type Cand = { rec: LiveStamp; from: string | null; hasPre: boolean }
    const cands: Cand[] = []
    for (const p of peeks) {
      if (resumeFits(p.rec as MatchResume, g)) cands.push({ rec: p.rec, from: p.slot, hasPre: p.hasPre })
      // this career's own record for a match that has since been finished and
      // written: nothing left to hold. Another career's record is left alone,
      // unless it predates 1.6.3 and carries no career stamp, which can never
      // fit anything again.
      else if (p.slot === slot && (sameCareer(p.rec, g) || p.rec.seed == null)) void clearResume(slot).catch(() => {})
    }
    const stamped = stampedRecord(g)
    if (stamped && resumeFits(stamped, g)) cands.push({ rec: stamped, from: null, hasPre: true })
    delete g.liveRec
    if (!cands.length) return false
    // the copy that got furthest; this slot's own record wins a tie
    cands.sort((a, b) => recordReach(b.rec) - recordReach(a.rec)
      || Number(b.from === slot) - Number(a.from === slot))
    for (const c of cands) {
      let rec: MatchResume | null = c.from === null ? c.rec as MatchResume
        : c.hasPre ? await getResume<MatchResume>(c.from).catch(() => null) : null
      if (get().game !== g) return false
      // THE CALLS SURVIVED AND THE PRE-MATCH STATE DID NOT. Settle from the
      // career that was opened, which is the career as it stood before kick-off
      // (the career slot is never written mid-match), on the same dice and the
      // same recorded calls. Never a fresh match.
      if (!rec) rec = { ...(c.rec as LiveStamp), pre: structuredClone(g) }
      if (!resumeFits(rec, g)) continue
      const base = migrate(rec.pre)
      delete base.liveRec
      // kept untouched for a later copy to another slot or a file; the replay
      // below mutates `base`, exactly as the match mutated the career
      const clean = structuredClone(base)
      const out = replayMatch(base, rec)
      if (!out) continue
      const own: MatchResume = { ...rec, pre: clean }
      // THE RECORD GOES DOWN IN THIS SLOT BEFORE ANYTHING ELSE. If the
      // process dies between here and the finished career landing on disk,
      // the next open finds this record and plays the same match out to the
      // same whistle; nothing in between can be reopened as a fresh match.
      if (c.from !== slot) await putResume(slot, own, true).catch(() => {})
      if (get().game !== g) return false
      // PLAYED OUT, NOT PUT BACK ON SCREEN (round 5, owner: "When you load
      // into the game again it should always load into the Home page. If it
      // was during the match, the match needs to be completed."). The minute
      // it had reached is replayed above, with every call he made; from
      // there the assistant has it (resume.ts playOut). Then exactly what
      // finishMatch does, once: the findings, the week turned, the record
      // dropped only when the finished career is on disk.
      const fromMin = out.ctx.events[out.ctx.events.length - 1]?.min ?? 0
      playOut(base, out.ctx)
      // a tie level at the whistle is settled there, as the live match does
      settleKnockout(base, out.ctx)
      fileFindings(base, out.ctx)
      fileEvidence(base, out.ctx)
      notePlayedOut(base, out.fixture, fromMin)
      countForPro(base, out.fixture)
      base.newsFrom = base.nextId
      settleWeek(base, get)
      set(s => ({ game: base, matchRec: own, liveMatch: null, resuming: false, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(base, set, get, [], true)
      return true
    }
    return false
  },

  ackResume: () => {
    const lm = get().liveMatch
    if (!lm) return
    const c = lm.ctx
    const canPlay = lm.cursor < c.events.length || (!c.awaiting && !c.decision && c.seg < 3)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, resumed: false, playing: canPlay }, tick: s.tick + 1 } : {})
  },

  saveCopy: () => {
    const { game, liveMatch, matchRec } = get()
    if (!game) return null
    if (liveMatch && matchRec) {
      return stampedSave({ ...matchRec, tick: liveMatch.ctx.tick, cursor: liveMatch.cursor })
    }
    return game
  },

  toTitle: () => {
    try { localStorage.removeItem(WHERE_KEY) } catch { /* private mode */ }
    set(s => ({ nav: [{ screen: 'menu' as const }], tick: s.tick + 1 }))
  },

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
    if (settling) return
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
    if (sliceSettles) return settleWeekAsync(g, get).then(() => landOnNextWeek(g, set, get))
    settleWeek(g, get)
    landOnNextWeek(g, set, get)
  },

  /** After a week has been settled, show the first day of the new one.
   *
   *  Shared by Continue and finishMatch so a week that ends in a match and a week
   *  that ends in a blank Saturday both resume on the same footing. */
  openWire: (ids, startId) => {
    // a start that is not in the list reads from the top: indexOf's -1 used
    // to slice the queue down to its last story alone (1.9.1)
    const at = startId != null ? ids.indexOf(startId) : -1
    const queue = at > 0 ? [...ids.slice(at), ...ids.slice(0, at)] : ids
    set(s => ({ wireQueue: queue, nav: [...s.nav.filter(e => e.screen !== 'wire'), { screen: 'wire' as const }], tick: s.tick + 1 }))
  },

  revealBall: () => {
    const g = get().game
    if (!g?.draw) return
    g.draw.revealed = Math.min(g.draw.ties.length, (g.draw.revealed ?? 0) + 1)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  closeDraw: () => {
    const g = get().game
    if (!g) return
    // Watched and put away. The ties themselves live in the fixture list, so
    // clearing the ceremony loses nothing - and clearing it is what stops the
    // day bulletin offering the same draw every week for the rest of the season.
    g.draw = null
    set(s => ({ nav: s.nav.filter(e => e.screen !== 'draw'), tick: s.tick + 1 }))
    void get().persist()
  },

  /** From the MatchDay preview: take the field. The match simulates
   *  tick by tick as the ticker plays, so nothing is decided yet. */
  instantResult: (preTalk, review) => {
    if (settling) return
    const g = get().game
    if (!g) return
    // a match already kicked off is finished, never started again (1.8.2)
    if (get().resuming || get().liveMatch) return
    if (!onMatchDay(get)) return
    // the Annual gate, same as kickOff: the assistant cannot start a season
    // the manager has not
    if (g.annual) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'annual' ? s.nav : [...s.nav, { screen: 'annual' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // the Test outranks the club game - same decision point as the day walk
    const fx = userMatchThisWeek(g)
    if (!fx) return
    const isClub = fx.homeId === g.userClubId || fx.awayId === g.userClubId
    const userTeamId = isClub
      ? g.userClubId
      : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam!
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO'
      : g.userClubId
    // a side that cannot raise ten is a walkover, not a match (1.6.4)
    const forfeit = forfeitSide(g, fx)
    if (forfeit) settleForfeit(g, fx, forfeit)
    else {
      noteUse('instant')
      if (preTalk) noteUse('talk')
      const ctx = beginMatch(g, fx, matchRng(g), true, userTeamId)
      // the assistant has the match, so the assistant makes the changes
      ctx.assistantSubs = true
      const preTalkMsg = openDressingRoom(g, ctx, preTalk)
      playHalf(g, ctx)
      playHalf(g, ctx)
      // STRAIGHT TO THE WHISTLE, NOT PAST IT (1.8.15). From the match screen
      // the assistant's result used to turn the week at once and land on the
      // round-up, so a manager who never watched never saw why it went the
      // way it did: the three causes, the coach's two fixes and last week's
      // homework all live on the full-time card. Now the button stops there,
      // the same card a watched match ends on, and Continue to Results turns
      // the week through finishMatch (which files the findings and the
      // evidence, as below). Callers without review keep the one-step path.
      if (review) {
        set(s => ({
          liveMatch: {
            ctx, fixture: fx, events: ctx.events, cursor: ctx.events.length, playing: false, speed: 1,
            mode: 'full', done: true, talkMsg: null, preTalkMsg,
          },
          tick: s.tick + 1,
        }))
        return
      }
      // the tactical loop's findings, before the week turns (#181)
      fileFindings(g, ctx)
      fileEvidence(g, ctx)
    }
    countForPro(g, fx)
    const resultsKey = resultsParam(fx.compId, g.week)
    // Exactly what finishMatch does, and for the same reason. This used to set
    // its own watermark aside and then push every new story of the week into the
    // Wire in one go, which meant a week played through the assistant was
    // revealed all at once while the same week watched on the pitch was revealed
    // a day at a time. Measured over a season of instant results: 30 bulletins
    // across 36 weeks, because the Wire had already read and cleared the stories
    // Monday to Friday were meant to carry. The day walk is the reveal now, both
    // ways round; the round-up still comes first, with Monday under it.
    g.newsFrom = g.nextId
    const landed = () => {
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(g, set, get, [{ screen: 'results', param: resultsKey }])
    }
    if (sliceSettles) return settleWeekAsync(g, get).then(landed)
    settleWeek(g, get)
    landed()
  },

  kickOff: (preTalk, mode) => {
    if (settling) return
    const g = get().game
    if (!g) return
    if (get().resuming || get().liveMatch) return
    if (!onMatchDay(get)) return
    // THE ANNUAL GATE HOLDS HERE TOO (user: "i haven't pressed new season yet
    // but its restarted in the background"). Continue was gated, but a match
    // is its own door: the Team screen's MATCHDAY button reaches the new
    // season's friendly with the Annual still up, and finishMatch turns the
    // week - so three quick pre-season kick-offs played 2026-27 to week 4
    // behind a page whose whole promise is that nothing starts without the
    // button. Same reroute as Continue: the tap lands you on the Annual.
    if (g.annual) {
      set(s => ({
        nav: s.nav[s.nav.length - 1]?.screen === 'annual' ? s.nav : [...s.nav, { screen: 'annual' as const }],
        tick: s.tick + 1,
      }))
      return
    }
    // the Test outranks the club game - same decision point as the day walk
    const fx = userMatchThisWeek(g)
    if (!fx) return
    const isClub = fx.homeId === g.userClubId || fx.awayId === g.userClubId
    const userTeamId = isClub
      ? g.userClubId
      : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam!
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO'
      : g.userClubId
    // THE PRE-MATCH SAVE, TAKEN BEFORE THE ENGINE TOUCHES ANYTHING.
    //
    // beginMatch mutates: it may tidy a team sheet, and from the first tick the
    // engine writes tries, cards, bans and injuries onto the players. A resume
    // replays the match from here rather than trying to serialise it half-played
    // (see game/resume.ts). This is the one 7MB write per match; everything after
    // it is a short command list.
    // a side that cannot raise ten is a walkover, not a match to watch (1.6.4):
    // settle it and turn the week the way the assistant's result does
    const forfeit = forfeitSide(g, fx)
    if (forfeit) {
      settleForfeit(g, fx, forfeit)
      countForPro(g, fx)
      const resultsKey = resultsParam(fx.compId, g.week)
      g.newsFrom = g.nextId
      settleWeek(g, get)
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      landOnNextWeek(g, set, get, [{ screen: 'results', param: resultsKey }])
      return
    }
    noteUse('watched')
    if (preTalk) noteUse('talk')
    // structuredClone, not a JSON round trip (1.9.1): the same copy IndexedDB
    // would make, at a fraction of the main-thread time on a 7MB career
    const pre = structuredClone(g)
    const ctx = beginMatch(g, fx, matchRng(g), true, userTeamId)
    // he is watching, so his injuries wait for his pick (1.9.1)
    ctx.manualInj = true
    // spoken or not, the room is opened once (teamtalk.ts, SAYING NOTHING)
    const preTalkMsg = openDressingRoom(g, ctx, preTalk)
    const rec: MatchResume = {
      v: 1, pre, stream: 'match', inj: 'manual', fxId: fx.id, userSideId: userTeamId, preTalk: preTalk ?? null,
      mode: mode ?? 'full', tick: 0, cursor: 0, cmds: [],
      season: g.season, week: g.week, savedAt: Date.now(),
      seed: g.seed, saveName: g.saveName,
      opp: teamName(g, fx.homeId === userTeamId ? fx.awayId : fx.homeId),
    }
    set(s => ({
      liveMatch: {
        ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1,
        mode: mode ?? 'full', done: false, talkMsg: null, preTalkMsg,
      },
      matchRec: rec,
      tick: s.tick + 1,
    }))
    // the one write that carries the 7MB state; every later write is the
    // short record (save.ts putResume, 1.6.3)
    //
    // AFTER THE MATCH SCREEN HAS PAINTED (1.9.1 performance re-audit). put()
    // copies the whole career on the main thread, and in the kick-off tap it
    // sat between the button and the match appearing. One frame later the
    // screen is up; the record written then is the latest one, so a line the
    // ticker has already noted is not overwritten by the kick-off copy.
    const slot = get().saveSlot
    const writePre = () => { const latest = get().matchRec; if (latest) void putResume(slot, latest, true).catch(() => {}) }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(writePre, 0))
    else writePre()
  },

  /** Note a decision the manager made, against the tick he made it on, and put
   *  the short record back on disk. Never writes the 7MB half. */
  noteCmd: (cmd: MatchCmdBody) => {
    const { matchRec: resume, liveMatch, saveSlot } = get()
    if (!resume || !liveMatch) return
    const rec: MatchResume = {
      ...resume,
      tick: liveMatch.ctx.tick,
      cursor: liveMatch.cursor,
      cmds: [...resume.cmds, { ...cmd, at: liveMatch.ctx.tick }],
    }
    set({ matchRec: rec })
    void putResume(saveSlot, rec).catch(() => {})
  },

  /** How far the match has got. Called as the clock moves, so it writes only the
   *  small record and never more than once a tick. */
  noteProgress: () => {
    const { matchRec: resume, liveMatch, saveSlot } = get()
    if (!resume || !liveMatch) return
    if (resume.tick === liveMatch.ctx.tick && resume.cursor === liveMatch.cursor) return
    const rec: MatchResume = { ...resume, tick: liveMatch.ctx.tick, cursor: liveMatch.cursor }
    set({ matchRec: rec })
    void putResume(saveSlot, rec).catch(() => {})
  },

  /** The match is over: the record must not outlive it, and must not die
   *  before it either.
   *
   *  ONLY ONCE THE FINISHED CAREER IS ON DISK (1.8.2). This used to clear the
   *  record at once and leave the career itself to the save queue's idle timer,
   *  so for 600ms after Continue the disk held the pre-match save and no match
   *  in progress: close the game in that window and the match came back
   *  unplayed, to be kicked off again. Now the career is written first and the
   *  record goes only when that write has landed. A failed write keeps the
   *  record, and the next open replays the same match to the same whistle. */
  dropResume: () => {
    const slot = get().saveSlot
    set({ matchRec: null })
    if (!get().game) { void clearResume(slot).catch(() => {}); return }
    void (async () => {
      // after whatever set() the caller makes next, since the queue will not
      // write while a live match is in the store
      await Promise.resolve()
      // the record is the only copy of the match until the finished career is
      // on disk: a held or failed write keeps it (1.9.1 re-audit, N1)
      const wrote = await saveQueue.flush()
      const s = get()
      if (!wrote || s.liveMatch || s.saveFail || s.saveSlot !== slot) return
      await clearResume(slot)
    })().catch(() => {})
  },

  /** One heartbeat of the live match: reveal the next event, or simulate
   *  the next 4 minutes when the ticker has caught up. */
  advanceLive: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || !liveMatch.playing) return
    const { ctx } = liveMatch
    let cursor = liveMatch.cursor
    if (cursor < ctx.events.length) {
      // Highlights mode (F5): run straight to the next moment that matters
      // rather than reading out every ruck. The filler lines are still in the
      // log, so the full commentary is there at full-time for anyone who wants
      // it - this only changes what the ticker stops on.
      const step = liveMatch.mode === 'highlights'
        ? nextHighlight(ctx.events, cursor, liveMatch.fixture.homeId)
        : cursor + 1
      // NO TICK FOR A REVEAL (1.9.1). The line was simulated already, so the
      // career has not changed: only the screens that read liveMatch need to
      // draw, not the whole app shell under them, once per commentary line.
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor: step } } : {})
      // THE REVEAL IS PROGRESS TOO. This branch used to return without writing
      // the record, so while the ticker read out a simulation burst the screen
      // ran ahead of what was on disk - and a reload mid-reveal came back a
      // try and a minute short of what the manager was looking at (main run
      // 32856568841: reloadprobe, 33-25 on screen, 33-20 after the refresh).
      // The record is small and noteProgress already runs once per simulated
      // tick, so once per revealed event is the same accepted cost.
      get().noteProgress()
      return
    }
    // a man down and waiting for the manager's pick holds the clock too (1.9.1)
    if (ctx.awaiting || ctx.seg === 3 || ctx.decision || ctx.injWait?.length) {
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, playing: false, done: ctx.seg === 3 }, tick: s.tick + 1 } : {})
      return
    }
    // simulate until something new happens, a decision is needed, or a break
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play' && !ctx.decision && !ctx.injWait?.length) {
      r = stepTick(game, ctx)
    }
    // NOT WHILE A KICK IS STILL IN THE MANAGER'S HANDS. A cup tie level at
    // the whistle with a kickable penalty pending is not a draw yet: decide()
    // settles it once the answer is in (releaseaudit.ts, 1.2b).
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    if (ctx.events.length > cursor) cursor += 1
    // the match view follows liveMatch; the app shell around it shows nothing
    // a simulated minute changes, so it is not redrawn for one (1.9.1)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor } } : {})
    // where the match has got to, so a reload comes back to the same minute
    get().noteProgress()
  },

  simAhead: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx, cursor } = liveMatch
    if (cursor < ctx.events.length || ctx.awaiting || ctx.seg === 3 || ctx.decision || ctx.injWait?.length) return
    // the same loop advanceLive runs, stopping short of revealing the line
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play' && !ctx.decision && !ctx.injWait?.length) r = stepTick(game, ctx)
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch } } : {})
    get().noteProgress()
  },

  /** Fast-forward the rest of the current period (to HT, 60' or FT).
   *  Pending penalty calls default to taking the points. */
  skipToBreak: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx } = liveMatch
    let r: ReturnType<typeof stepTick> = 'play'
    // EVERY DECISION THIS TAKES ON THE MANAGER'S BEHALF IS STILL A DECISION, and a
    // resume has to make the same ones. Skipping ahead answers each kickable
    // penalty with 'posts'; if those went unrecorded the replay would stop at the
    // first one waiting for an answer that never came, and the match would drift.
    let took = 0
    const noted = (choice: 'posts') => { took++; get().noteCmd({ kind: 'decide', choice }) }
    while (!ctx.awaiting && ctx.seg < 3) {
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      r = stepTick(game, ctx)
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      if (r !== 'play') break
    }
    if (r === 'FT' && !ctx.decision) settleKnockout(game, ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, cursor: ctx.events.length, playing: false, done: ctx.seg === 3, skipTook: took },
      tick: s.tick + 1,
    } : {})
    get().noteProgress()
  },

  /** The touchline call on a kickable penalty. */
  decide: (choice) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || !liveMatch.ctx.decision) return ''
    get().noteCmd({ kind: 'decide', choice })
    const msg = resolveDecision(game, liveMatch.ctx, choice)
    // the last kick of the match has been taken: a tie can now be settled
    if (liveMatch.ctx.seg === 3) settleKnockout(game, liveMatch.ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, playing: true },
      tick: s.tick + 1,
    } : {})
    return msg
  },

  teamTalk: (kind) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.awaiting !== 'HT') return
    get().noteCmd({ kind: 'talk', talk: kind })
    noteUse('talk')
    const msg = applyTeamTalk(game, liveMatch.ctx, kind)
    set(s => ({ liveMatch: s.liveMatch ? { ...s.liveMatch, talkMsg: msg } : null, tick: s.tick + 1 }))
  },

  halfTimeSub: (outId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    // The cursor has to follow the new commentary line, or the panel you made
    // the change from disappears underneath you.
    //
    // makeSubstitution pushes a "change from the bench" event, and liveMatch.events
    // IS ctx.events - the same array. So the push made events.length one greater
    // than the cursor, MatchDay's `caughtUp` went false, and with it atHalfTime,
    // panelActive and the whole half-time panel: one sub and you were thrown back
    // to the pitch view with the interval over. That is the bug behind "the quick
    // sub doesn't work well" - it was never the dropdowns, it was that a second
    // change was impossible because the room closed after the first.
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'sub', outId, inId })
    noteUse('sub')
    const msg = makeSubstitution(game, liveMatch.ctx, outId, inId)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  injuryCover: (onId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    get().noteCmd({ kind: 'cover', onId, inId })
    const msg = swapInjuryCover(game, liveMatch.ctx, onId, inId)
    set(s => ({ tick: s.tick + 1 }))
    return msg
  },

  injuryPick: (hurtId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    const msg = coverInjury(game, liveMatch.ctx, hurtId, inId)
    // only a change that happened is a command: a refused tap replays as nothing
    if (!msg) get().noteCmd({ kind: 'inj', hurtId, inId })
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp && !msg
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  undoSub: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    // same cursor discipline as halfTimeSub: the undo pushes its own line
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'undo' })
    const msg = undoSubstitution(game, liveMatch.ctx)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  swapPositions: (aId, bId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return t('touch.playResumed')
    const wasCaughtUp = liveMatch.cursor >= liveMatch.ctx.events.length
    get().noteCmd({ kind: 'swap', aId, bId })
    const msg = swapShirts(game, liveMatch.ctx, aId, bId)
    set(s => ({
      liveMatch: s.liveMatch && wasCaughtUp
        ? { ...s.liveMatch, cursor: s.liveMatch.ctx.events.length }
        : s.liveMatch,
      tick: s.tick + 1,
    }))
    return msg
  },

  /** Re-read the tactic sliders mid-match - allowed at any stoppage. */
  liveTactics: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
    if (liveMatch.ctx.userSideId !== game.userClubId) return // Test match: no club tactic board
    // the dial VALUES, not the fact that he opened the board: the pre-match save
    // still holds whatever they were before he moved them
    const t = game.clubs[game.userClubId].tactic
    get().noteCmd({ kind: 'dials', style: t.style, tempo: t.tempo, kicking: t.kicking, aggression: t.aggression })
    noteUse('liveTactics')
    applyTacticsChange(game, liveMatch.ctx)
    set(s => ({ tick: s.tick + 1 }))
  },

  /** Resume after an interval: HT -> third quarter, 60' -> final quarter. */
  startSecondHalf: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
    liveMatch.ctx.awaiting = null
    set(s => ({
      liveMatch: s.liveMatch ? { ...s.liveMatch, playing: true, done: false, skipTook: 0 } : null,
      tick: s.tick + 1,
    }))
  },

  matchCursor: (cursor, playing) => {
    set(s => s.liveMatch ? ({ liveMatch: { ...s.liveMatch, cursor, playing } }) : {})
    // the ticker can move without the clock moving, and a reload should come back
    // to the line he had read, not just the minute
    get().noteProgress()
  },

  matchMode: (mode) => {
    const { game, liveMatch } = get()
    if (!liveMatch) return
    // remembered for the competition too, so switching mid-match is also a
    // standing answer for next week rather than a one-off. Written here, not
    // inside the set() updater, which must not change anything it is handed.
    if (game) game.viewPref = { ...(game.viewPref ?? {}), [liveMatch.fixture.compId]: mode }
    set(s => (s.liveMatch ? { liveMatch: { ...s.liveMatch, mode }, tick: s.tick + 1 } : {}))
    // viewPref is on GameState and is meant to be a STANDING answer - the
    // comment above says so - but nothing wrote it, so "remembered for the
    // competition" lasted until the next reload. Named by the external audit.
    void get().persist()
  },

  /** After FT: process the rest of the week and return home. */
  finishMatch: () => {
    if (settling) return
    const g = get().game
    const live = get().liveMatch
    // ONE TAP, ONE WEEK (1.8.15). Two taps landing in one frame on Continue to
    // Results each called this, and the second, with the match already gone,
    // turned a second week. Instant Result now ends on this button too.
    if (!g || !live) return
    const resultsKey = live ? resultsParam(live.fixture.compId, g.week) : null
    // the tactical loop's findings and the evidence, before the week turns (#181)
    if (live) {
      fileFindings(g, live.ctx)
      fileEvidence(g, live.ctx)
      countForPro(g, live.fixture)
    }
    g.newsFrom = g.nextId
    const landed = () => {
      set(s => ({ liveMatch: null, tick: s.tick + 1 }))
      get().dropResume()
      // The full-time round-up still comes first - that is the moment you want
      // straight after your own final whistle - and Monday's bulletin sits under
      // it, so backing out of the round-up puts you at the start of the new week
      // rather than nowhere.
      landOnNextWeek(g, set, get, resultsKey ? [{ screen: 'results', param: resultsKey }] : [])
    }
    if (sliceSettles) return settleWeekAsync(g, get).then(landed)
    settleWeek(g, get)
    landed()
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

  boardInject: (tier) => {
    const g = get().game
    if (!g) return false
    const done = applyInjection(g, tier)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  signCharter: () => {
    const g = get().game
    if (!g) return false
    const done = applyCharter(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  healSquad: () => {
    const g = get().game
    if (!g) return false
    const done = applyHeal(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  buildEstate: () => {
    const g = get().game
    if (!g) return false
    const done = applyEstate(g)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  makeTheCall: (nat?: string) => {
    const g = get().game
    if (!g) return false
    const done = applyPinnacle(g, nat)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
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

  rewardPhysio: (pid) => {
    const g = get().game
    if (!g) return null
    const out = physioFavour(g, pid)
    if (out != null) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return out
  },

  rewardAgency: (pid) => {
    const g = get().game
    if (!g) return false
    const done = agencyFile(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardAnalyst: () => {
    const g = get().game
    if (!g) return
    armAnalyst(g)
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  rewardTown: () => {
    const g = get().game
    if (!g) return null
    const amt = townCollection(g)
    if (amt != null) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return amt
  },

  rewardInside: (pid) => {
    const g = get().game
    if (!g) return false
    const done = insideWordFavour(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardOpinion: (pid) => {
    const g = get().game
    if (!g) return false
    const done = secondOpinionFavour(g, pid)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardTapeRoom: (oppId) => {
    const g = get().game
    if (!g) return false
    const done = tapeRoomFavour(g, oppId)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
  },

  rewardTeamNight: (pressId) => {
    const g = get().game
    if (!g) return false
    const done = teamNightFavour(g, pressId)
    if (done) { set(s => ({ tick: s.tick + 1 })); void get().persist() }
    return done
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
}))
// the save queue and the week settle reach the store through this, rather
// than importing this file back (src/store/api.ts)
bindStore(useStore)

// THE WAY OUT IS WHERE A PHONE KILLS A PROCESS. Not a crash - a home button, a
// task switch, a locked screen. pagehide fires for all three where visibility
// alone does not, and both are listened for because Safari and Chrome disagree
// about which arrives. Guarded for the probes, which import this file in node.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => saveQueue.flushSync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveQueue.flushSync()
  })
}

// The language lives in the i18n module; the store mirrors it so React
// re-renders on a change. The subscription, not setLang, is what moves the
// mirror: a lazily-fetched dictionary commits whenever its chunk arrives.
onLangChange(() => useStore.setState({ lang: getLang() }))

// THE WORLD FOLLOWS THE CAREER. i18n picks a feminine string in a women's save
// and the plain one otherwise, and it learns which from here rather than from
// the game object, because it is a leaf module the whole engine imports and
// must not import the store back. Subscribed rather than set at each of the
// five places a game is opened, so a sixth cannot forget.
useStore.subscribe((s, prev) => {
  if (s.game !== prev.game) {
    setWorld(s.game ? genderOf(s.game) : 'm')
    setManagerGender(s.game?.mgrGender === 'w' ? 'w' : 'm')
  }
})

// Browser probes stage the states a natural walk cannot reach on demand - an
// injured starter on match morning, a specific inbox backlog - through this
// handle. It is the same store the app runs on; nothing ships differently for
// it, and a player poking it in devtools can only cheat at their own save.
if (typeof window !== 'undefined') {
  ;(window as unknown as { rugbyStore?: typeof useStore }).rugbyStore = useStore
  // and the save queue's counters, so savequeue.mjs can prove that a burst of
  // mutations costs one write rather than inferring it from a stopwatch
  ;(window as unknown as { rugbySaveStats?: typeof saveStats }).rugbySaveStats = saveStats
}
