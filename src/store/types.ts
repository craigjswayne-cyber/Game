import type { StoreApi } from 'zustand'
import type { GameState, MatchEvent, Fixture, MgrOrigin } from '../game/model'
import type { Gender } from '../game/gender'
import type { Lang } from '../game/i18n'
import type { InjectTier } from '../game/grants'
import type { LiveCtx } from '../game/matchEngine'
import type { MatchCmdBody, MatchResume } from '../game/resume'
import type { Skin } from './skins'

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'inbox' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  // 'comp' was here too, with no case in App.tsx: a route to Home under
  // another name. Removed in 1.8.1; an old bookmark naming it still lands on
  // Home, through the same default every unknown screen takes.
  | 'press' | 'history' | 'nations' | 'legacy' | 'jobs'
  // 'feed' was The Rugby Wire, a second news browser over the same array. Merged
  // into 'inbox'; 'wire' stays as the between-weeks bulletin reader, not a screen
  // you navigate to.
  | 'medical' | 'report' | 'profile' | 'saves' | 'dreamteam' | 'results' | 'seasonreview' | 'agency' | 'wire' | 'infra' | 'handbook' | 'bug' | 'settings'
  | 'country'
  | 'offers' | 'academy' | 'day' | 'draw' | 'annual'
  // the two the store release added: what this is and who made it, and the one
  // till in the game (which has a door only where a store exists to open it)
  | 'about' | 'supporter'
  // the scouting department's own page, under Training and Staff (owner)
  | 'scouting'

export interface NavEntry {
  screen: Screen
  param?: string | number
}

export interface Store {
  game: GameState | null
  tick: number
  nav: NavEntry[]
  liveMatch: {
    ctx: LiveCtx
    fixture: Fixture
    events: MatchEvent[]
    cursor: number
    playing: boolean
    speed: number
    /** how the manager chose to watch this one (F5). 'highlights' runs the
     *  cursor straight to the next moment that matters. */
    mode: 'full' | 'highlights'
    done: boolean
    talkMsg: string | null
    preTalkMsg: string | null
    /** How many touchline calls the last Skip answered on the manager's
     *  behalf. The owner played four matches and asked whether the feature
     *  was still in the game; it was, and Skip had been taking every call at
     *  the posts without a word. Silence is what made it look missing. */
    skipTook?: number
    /** Brought back by a reload or a reopened save rather than played on
     *  from kick-off (1.8.2): the screen says so, once, above the match. */
    resumed?: boolean
  } | null
  saveSlot: string
  /** True while a career that has just been opened is being checked for a
   *  match in progress (1.8.2). Nothing may kick off, or turn the week, until
   *  that answer is in: the match already under way is the one to finish. */
  resuming: boolean
  /** the record that lets a live match survive a reload (game/resume.ts) */
  matchRec: MatchResume | null
  /** unread stories queued for the full-screen Wire flow after Continue */
  wireQueue: number[]
  night: boolean
  skin: Skin
  setSkin: (s: Skin) => void
  toggleNight: () => void
  /** 1, 1.15 or 1.3: a zoom on the document root, the game's answer to px-fixed
   *  type ignoring the OS text-size slider (release audit, Part 2.3). */
  textScale: number
  setTextScale: (v: number) => void
  /** He or she, in every line the press, the fans and the board write about the
   *  manager. Kept in the save (GameState.mgrGender) because it belongs to the
   *  person rather than the phone, and mirrored to the device so the next
   *  career starts as the last one ended rather than back at 'he'. */
  setMgrGender: (g: Gender) => void
  /** The interface language. It lives in the store as well as in i18n.ts for
   *  one reason: t() is a plain function, so nothing would re-render when the
   *  dictionary underneath it changed. App reads this field, so switching
   *  language re-renders the tree the same way any other state change does. */
  lang: Lang
  setLang: (l: Lang) => void
  /** Has this device supported the game (game/monetise.ts)?
   *
   *  In the store for the same reason `lang` is: hasSupporter() is a plain
   *  function over localStorage, so nothing would repaint when a purchase
   *  landed - the ad would stay on screen under the receipt. Written once at
   *  boot and again by claimSupporter(); never read from a save, and never
   *  written into one. */
  supporter: boolean
  /** A purchase or a restore has just succeeded: repaint on the strength of it. */
  claimSupporter: () => void
  /** The welcome dialog, hoisted out of Home so any screen can open it and the
   *  Manager menu can bring it back after it has been dismissed (blocker A2). */
  tut: boolean
  openTut: () => void
  /** the feedback report card is on screen (ui/FeedbackPrompt.tsx) */
  feedback: boolean
  openFeedback: () => void
  closeFeedback: () => void
  closeTut: () => void
  /** Consecutive failed writes to IndexedDB, and why the last one failed.
   *
   *  Every persist() call site is fire-and-forget, so a rejected write used to
   *  vanish into a void and the manager found out hours later that nothing had
   *  been saved. Counted here and shown on screen (blocker A4). */
  saveFail: number
  saveFailMsg: string | null
  /** For the one save that does not go through persist(): the manual
   *  save-to-slot on the Saves screen. */
  noteSaveFail: (msg: string) => void
  dismissSaveFail: () => void
  /** A week settle threw and the career was put back to its last save
   *  (settleWeek below). 0 when nothing has gone wrong; 2 when the reload
   *  itself failed and the career is held unsaved for a bug report. */
  weekFailed: 0 | 1 | 2
  dismissWeekFailed: () => void
  /** Put the career back to what is on disk after a failed settle. */
  rollBack: () => Promise<void>
  /** Reopen this slot's saved career in place of the one in memory, quietly.
   *  False if there is nothing readable to go back to. */
  revertToDisk: () => Promise<boolean>
  /** The message the inbox reader is showing (news id), or null for none.
   *
   *  The inbox reads one at a time (user: "tap the mail symbol it should open the
   *  unread message, tap again and it opens the next unread"), so which message
   *  is open has to live above the screen: the rail button advances it from
   *  outside the component. */
  inboxId: number | null
  /** Open the inbox on the oldest unread story, or advance to the next one if it
   *  is already open. This is what the mail icon does. */
  openInbox: () => void
  /** Step through the recall window: -1 older, +1 newer. */
  inboxStep: (dir: -1 | 1) => void
  /** File away everything already read. */
  clearRead: () => void

  /** When Continue was last honoured, for the double-tap guard. See
   *  continueWeek and TAP_GUARD_MS. */
  lastAdvanceAt: number

  start: (clubId: string, managerName: string, challengeId?: string, origin?: MgrOrigin, gender?: Gender, mgrGender?: Gender, seed?: number) => void
  /** Which game the NEXT new career is in, chosen on the menu before the wizard
   *  opens. Not part of a save - the save carries its own gender - just the
   *  answer to "which game" travelling from the menu to the first screen of the
   *  wizard, which is where the club list has to know. */
  newGender: Gender
  setNewGender: (g: Gender) => void
  /** A board injection bought at the till lands in this career (grants.ts).
   *  Returns false when the seasonal limit refuses it - the caller must then
   *  NOT consume the purchase, so the recovery pass keeps it. */
  boardInject: (tier: InjectTier) => boolean
  /** The Owner's Charter, applied to this save for good. */
  signCharter: () => boolean
  /** v1.1.4 grants (grants.ts): the medical retreat, the maxed estate, and
   *  the call to the federations. Same contract as the Charter: refused
   *  cleanly (false) when the save cannot honestly receive the effect. */
  healSquad: () => boolean
  buildEstate: () => boolean
  makeTheCall: (nat?: string) => boolean
  answerNatKeep: (keep: boolean) => void
  /** Name a new dream once the current one is realised (v1.1.5). */
  refocusDream: (id: string) => boolean
  /** Rewarded favours (game/rewarded.ts): called ONLY after the ad bridge
   *  reports a completed view. Each returns what the screen should say, or
   *  null/false when the ledger refuses. */
  rewardPhysio: (pid: number) => string | null
  rewardAgency: (pid: number) => boolean
  rewardAnalyst: () => void
  rewardTown: () => number | null
  /** The 1.8.2 favours, on the same terms: only after a completed view. */
  rewardInside: (pid: number) => boolean
  rewardOpinion: (pid: number) => boolean
  rewardTapeRoom: (oppId: string) => boolean
  rewardTeamNight: (pressId: number) => boolean
  toggleShortlist: (playerId: number) => void
  /** Put a loaded save in play. keepPlace is Continue: resume the bookmarked
   *  screen instead of Home. */
  setGame: (g: GameState, slot: string, keepPlace?: boolean) => void
  setSlot: (slot: string) => void
  go: (screen: Screen, param?: string | number) => void
  back: () => void
  home: () => void
  touch: () => void
  /** Resolves when the week has turned (the browser settles in slices). */
  continueWeek: () => void | Promise<void>
  /** What a Continue button calls: continueWeek, after one painted frame when
   *  the tap is going to turn the week (see below). */
  continueTap: () => void
  /** A week is being turned: the Continue buttons say so and ignore taps. */
  turning: boolean
  kickOff: (preTalk?: import('../game/teamtalk').PreTone, mode?: 'full' | 'highlights') => void
  /** the assistant takes over: play the match out instantly with your team */
  instantResult: (preTalk?: import('../game/teamtalk').PreTone, review?: boolean) => void | Promise<void>
  advanceLive: () => void
  /** Simulate the next stretch of the live match without revealing any of it,
   *  so the match screen can see a try coming and play its build-up (1.8.0). */
  simAhead: () => void
  skipToBreak: () => void
  decide: (choice: 'posts' | 'corner' | 'tap') => string
  matchCursor: (cursor: number, playing: boolean) => void
  /** Change how the rest of this match is watched (F5). */
  matchMode: (mode: 'full' | 'highlights') => void
  finishMatch: () => void | Promise<void>
  teamTalk: (kind: import('../game/teamtalk').HtTone) => void
  halfTimeSub: (outId: number, inId: number) => string
  /** Override the assistant's injury replacement. Free, and only at the moment. */
  injuryCover: (onId: number, inId: number) => string
  /** Send on the manager's choice for an injured man the match is waiting on
   *  (1.9.1, matchEngine coverInjury). inId null lets the assistant pick. */
  injuryPick: (hurtId: number, inId: number | null) => string
  /** Take back the last substitution, before play resumes (16B). */
  undoSub: () => string
  /** Swap two on-pitch men's shirts - a positional switch, free (16B). */
  swapPositions: (aId: number, bId: number) => string
  liveTactics: () => void
  noteCmd: (cmd: MatchCmdBody) => void
  noteProgress: () => void
  dropResume: () => void
  /** finish a match that was in progress when the page went away: replay it
   *  to the minute it reached, play it out, turn the week, land on Home */
  resumeLiveMatch: () => Promise<boolean>
  /** The manager has seen the "still going" line and pressed Resume. */
  ackResume: () => void
  /** The career as it should be written to a slot or a file right now. Mid-
   *  match that is the pre-match save with the match stamped inside it, never
   *  the half-played state (game/resume.ts stampedSave, 1.8.2). */
  saveCopy: () => GameState | null
  startSecondHalf: () => void
  applyJob: (clubId: string) => string
  /** Yes or no to the club that has offered you the job. */
  answerJobOffer: (accept: boolean) => string
  /** Say no to a vacancy so it stops asking. Pass false to undo it. */
  passJob: (clubId: string, passed?: boolean) => void
  resign: () => void
  answerNatOffer: (accept: boolean, keepClub?: boolean) => void
  resignNat: () => void
  answerPressOption: (pressId: number, optionIndex: number) => void
  persist: () => Promise<void>
  /** Write now and wait for it, for the few places that cannot afford to be
   *  coalesced. See the save queue above persist(). */
  persistNow: () => Promise<boolean>
  /** Reopen the last save on the screen it was left on. False if there is none. */
  resume: () => Promise<boolean>
  /** Back to the title screen on purpose, and forget the resume bookmark. */
  toTitle: () => void
  /** Read a set of stories full screen, starting on one of them. */
  openWire: (ids: number[], startId?: number) => void
  /** Watch the next ball come out of the bag (F19). */
  revealBall: () => void
  /** The draw is watched: put it away and carry on. */
  closeDraw: () => void
}

/** What create() hands each action slice (src/store/slices). */
export type SetState = StoreApi<Store>['setState']
export type GetState = () => Store
