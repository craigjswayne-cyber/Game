import { create } from 'zustand'
import { noteScreen } from './game/bugreport'
import { getLang, initLang, setLang as applyLang, t, type Lang } from './game/i18n'
import { hasSupporter } from './game/monetise'
import { applyCharter, applyEstate, applyHeal, applyInjection, applyPinnacle, type InjectTier } from './game/grants'
import { agencyFile, armAnalyst, physioFavour, townCollection } from './game/rewarded'
import { dreamState, dreamsFor } from './game/dream'
import type { GameState, MatchEvent, Fixture, MgrOrigin } from './game/model'
import { closeNatTenure, logDecision } from './game/model'
import { newGame } from './game/newgame'
import { processWeekAndAdvance, resolveKnockoutDraw, userFixtureThisWeek, userMatchThisWeek, weekRng } from './game/season'
import {
  applyPreTalk, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution, swapInjuryCover, swapShirts, undoSubstitution,
  playHalf, resolveDecision, stepTick, teamShort, type LiveCtx,
} from './game/matchEngine'
import { applyForJob, resignJob } from './game/jobs'
import { answerPress } from './game/media'
import { deskBlock, deskGates, firstStepOfWeek, inInbox, markRead, matchDayIndex, nextStep } from './game/days'
import { clearResume, getResume, loadGame, migrate, putResume, saveGame } from './game/save'
import { replayMatch, resumeFits, type MatchCmdBody, type MatchResume } from './game/resume'

/**
 * How close together two Continue taps have to be before the second is treated as
 * a slip rather than an instruction.
 *
 * 220ms is above the 120-200ms a double tap lands in and below the ~300ms at which
 * a deliberate second tap starts to feel ignored. Exported so tapprobe can test
 * both sides of it rather than sleeping.
 */
export const TAP_GUARD_MS = 220

/**
 * How many stories the desk gate may insist on in one week before it relents.
 *
 * An ordinary week writes four or five (soakui measures 4.4 bulletins a week
 * over 218 weeks), so in the weeks the user was complaining about this is never
 * reached and the desk really is cleared before the match. A season rollover
 * writes fifty-four in one settle, and there the budget is what stops the game
 * asking for fifty-four taps. Exported so scripts/deskgate.mjs asserts against
 * the same number rather than a copy of it.
 */

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'inbox' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  | 'press' | 'comp' | 'history' | 'nations' | 'legacy' | 'jobs'
  // 'feed' was The Rugby Wire, a second news browser over the same array. Merged
  // into 'inbox'; 'wire' stays as the between-weeks bulletin reader, not a screen
  // you navigate to.
  | 'medical' | 'report' | 'profile' | 'saves' | 'dreamteam' | 'results' | 'seasonreview' | 'agency' | 'wire' | 'infra' | 'handbook' | 'bug'
  | 'country'
  | 'offers' | 'academy' | 'day' | 'draw' | 'annual'
  // the two the store release added: what this is and who made it, and the one
  // till in the game (which has a door only where a store exists to open it)
  | 'about' | 'supporter'

interface NavEntry {
  screen: Screen
  param?: string | number
}

interface Store {
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
  } | null
  saveSlot: string
  /** the record that lets a live match survive a reload (game/resume.ts) */
  matchRec: MatchResume | null
  /** unread stories queued for the full-screen Wire flow after Continue */
  wireQueue: number[]
  night: boolean
  toggleNight: () => void
  /** 1, 1.15 or 1.3: a zoom on the document root, the game's answer to px-fixed
   *  type ignoring the OS text-size slider (release audit, Part 2.3). */
  textScale: number
  setTextScale: (v: number) => void
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
  /** Record the two fixes a full-time verdict just gave, so the NEXT one can
   *  mark them (C2). Idempotent per fixture: the full-time card re-renders on
   *  every tick and a live match can be resumed from its log. */
  noteFixes: (fxId: number, tags: string[]) => void
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

  start: (clubId: string, managerName: string, challengeId?: string, origin?: MgrOrigin) => void
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
  toggleShortlist: (playerId: number) => void
  /** Put a loaded save in play. keepPlace is Continue: resume the bookmarked
   *  screen instead of Home. */
  setGame: (g: GameState, slot: string, keepPlace?: boolean) => void
  setSlot: (slot: string) => void
  go: (screen: Screen, param?: string | number) => void
  back: () => void
  home: () => void
  touch: () => void
  continueWeek: () => void
  kickOff: (preTalk?: 'calm' | 'fire' | 'underdog' | 'expect', mode?: 'full' | 'highlights') => void
  /** the assistant takes over: play the match out instantly with your team */
  instantResult: (preTalk?: 'calm' | 'fire' | 'underdog' | 'expect') => void
  advanceLive: () => void
  skipToBreak: () => void
  decide: (choice: 'posts' | 'corner' | 'tap') => string
  matchCursor: (cursor: number, playing: boolean) => void
  /** Change how the rest of this match is watched (F5). */
  matchMode: (mode: 'full' | 'highlights') => void
  finishMatch: () => void
  teamTalk: (kind: 'fire' | 'calm' | 'praise' | 'demand') => void
  halfTimeSub: (outId: number, inId: number) => string
  /** Override the assistant's injury replacement. Free, and only at the moment. */
  injuryCover: (onId: number, inId: number) => string
  /** Take back the last substitution, before play resumes (16B). */
  undoSub: () => string
  /** Swap two on-pitch men's shirts - a positional switch, free (16B). */
  swapPositions: (aId: number, bId: number) => string
  liveTactics: () => void
  noteCmd: (cmd: MatchCmdBody) => void
  noteProgress: () => void
  dropResume: () => void
  /** rebuild a match that was in progress when the page went away */
  resumeLiveMatch: () => Promise<boolean>
  startSecondHalf: () => void
  applyJob: (clubId: string) => string
  /** Say no to a vacancy so it stops asking. Pass false to undo it. */
  passJob: (clubId: string, passed?: boolean) => void
  resign: () => void
  answerNatOffer: (accept: boolean, keepClub?: boolean) => void
  resignNat: () => void
  answerPressOption: (pressId: number, optionIndex: number) => void
  persist: () => Promise<void>
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

/** The event types worth stopping the ticker for in highlights mode (F5).
 *
 *  'SUB' is deliberately not on the list: the engine uses it for substitutions
 *  but also for atmosphere lines, the half-time numbers and the penalty prompt,
 *  so treating it as a highlight would stop on almost everything. Touchline
 *  decisions and intervals still halt play through ctx.decision and ctx.awaiting,
 *  which is where those stops belong. */
const HIGHLIGHTS = new Set<MatchEvent['type']>(['TRY', 'CON', 'PEN', 'DG', 'YC', 'RC', 'INJ', 'HT', 'BRK', 'FT'])

/** The cursor position that reveals the next highlight, or the end of what has
 *  been simulated so far. Always advances by at least one so the ticker can
 *  never stall on a quiet passage. */
function nextHighlight(events: MatchEvent[], cursor: number): number {
  let c = cursor
  while (c < events.length && !HIGHLIGHTS.has(events[c].type)) c += 1
  return Math.min(events.length, Math.max(cursor + 1, c + 1))
}

/** After a tick hits FT: knockout ties are settled in sudden-death extra time. */
function settleKnockout(g: GameState, ctx: LiveCtx) {
  const fx = ctx.fx
  if (fx.stage && fx.homeScore === fx.awayScore) {
    resolveKnockoutDraw(g, fx, weekRng(g))
    ctx.events.push({
      min: 90, type: 'FT', teamId: '',
      text: `SUDDEN DEATH! ${teamShort(g, fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId)} snatch it in extra time - ${fx.homeScore}-${fx.awayScore}!`,
      homeScore: fx.homeScore, awayScore: fx.awayScore,
    })
    fx.events = ctx.events
  }
}

/** ---- where the manager was when the page went away ----
 *
 *  A reload used to drop you on the title screen with a Continue button, which
 *  is two taps to get back to a screen you never left, and on a phone the tab
 *  gets reloaded for you all the time. The save itself lives in IndexedDB and is
 *  already written every week; this is just the bookmark, so it is small enough
 *  for localStorage and losing it costs nothing.
 *
 *  Screens that only make sense mid-flow are not bookmarked. A live match is the
 *  important one: the ticker's state is in memory and is not saved, so resuming
 *  onto 'matchday' has to mean the pre-match hub, and resuming onto the Wire or a
 *  round-up would be a queue that no longer exists. */
const NO_RESUME = new Set<Screen>(['menu', 'newgame', 'wire', 'results', 'seasonreview'])
const WHERE_KEY = 'rm-where'

/** Is the pre-match hub still the screen on top?
 *
 *  Kicking off and taking the assistant's instant result are both MatchDay
 *  buttons, and both settle the whole week before returning. A thumb that taps
 *  twice quickly can land the second tap after the first has already been
 *  honoured and the screen has moved on to the round-up - at which point the
 *  week has advanced, so the handler would happily find NEXT week's fixture and
 *  play it with no preview, no selection and no team talk. Refusing a call that
 *  arrives when MatchDay is no longer on top costs nothing and closes that. */
function onMatchDay(get: () => Store): boolean {
  const nav = get().nav
  return nav[nav.length - 1]?.screen === 'matchday'
}

function noteWhere(slot: string, nav: NavEntry[]) {
  const trail = nav.filter(e => !NO_RESUME.has(e.screen)).slice(-6)
  try {
    if (!trail.length) localStorage.removeItem(WHERE_KEY)
    else localStorage.setItem(WHERE_KEY, JSON.stringify({ slot, nav: trail }))
  } catch { /* private mode: the bookmark is a nicety, not a feature */ }
}

/** Has this tab already been running the game?
 *
 *  Marked on the first call, so the first call of a launch answers no and every
 *  call after a refresh answers yes. Private mode with storage disabled answers
 *  no for ever, which fails the safe way round: the title screen. */
const SESSION_KEY = 'rm-live'
function sameSession(): boolean {
  try {
    const seen = sessionStorage.getItem(SESSION_KEY) === '1'
    sessionStorage.setItem(SESSION_KEY, '1')
    return seen
  } catch { return false }
}

function readWhere(): { slot: string; nav: NavEntry[] } | null {
  try {
    const raw = localStorage.getItem(WHERE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { slot?: unknown; nav?: unknown }
    if (typeof v.slot !== 'string' || !Array.isArray(v.nav) || !v.nav.length) return null
    const nav = (v.nav as NavEntry[]).filter(e => e && typeof e.screen === 'string' && !NO_RESUME.has(e.screen))
    if (!nav.length) return null
    return { slot: v.slot, nav }
  } catch { return null }
}

/** Push the day bulletin, replacing one that is already open.
 *
 *  Continue is pressed from the bulletin itself, so without the filter the back
 *  stack would grow one entry per day and the back arrow would walk the manager
 *  backwards through a week that has already happened. */
function openDay(nav: NavEntry[]): NavEntry[] {
  return [...nav.filter(e => e.screen !== 'day' && e.screen !== 'wire'), { screen: 'day' as const }]
}

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
) {
  const step = firstStepOfWeek(g)
  g.day = step.kind === 'day' ? step.day : step.kind === 'match' ? (matchDayIndex(g) ?? 0) : 0
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
    nav: [{ screen: 'home' }, ...dayEntry, ...extra, ...annualEntry],
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
  wireQueue: [],
  saveSlot: 'slot1',
  inboxId: null,
  // NIGHT IS THE DEFAULT (design brief): a fresh install opens under the
  // floodlights, and only an explicit '0' - the player choosing daylight -
  // turns them off. The old default was day, which nobody who reported in
  // ever used.
  night: typeof localStorage === 'undefined' || localStorage.getItem('rm-night') !== '0',
  toggleNight: () => set(s => {
    const night = !s.night
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
  setLang: (l: Lang) => {
    applyLang(l)
    set({ lang: getLang() })
  },

  supporter: hasSupporter(),
  claimSupporter: () => set(s => ({ supporter: hasSupporter(), tick: s.tick + 1 })),

  tut: false,
  openTut: () => set({ tut: true }),
  closeTut: () => {
    try { localStorage.setItem('rm-tut', '1') } catch { /* private mode */ }
    set({ tut: false })
  },

  saveFail: 0,
  saveFailMsg: null,
  noteSaveFail: (msg) => set(s => ({ saveFail: s.saveFail + 1, saveFailMsg: msg, tick: s.tick + 1 })),
  dismissSaveFail: () => set({ saveFail: 0, saveFailMsg: null }),

  noteFixes: (fxId, tags) => {
    const g = get().game
    if (!g || g.fixHw?.fxId === fxId) return
    g.fixHw = { fxId, season: g.season, week: g.week, tags }
    // no touch(): nothing on screen reads this until the next full time, and a
    // re-render from inside a full-time effect would loop
  },

  /** The news reader's recall window: everything unread, plus what you have read
   *  in the last five days. Gossip is in this list too now that the wire and the
   *  news are one screen, cleared stories are filed, and days.inInbox is the one
   *  place that decides. */
  openInbox: () => set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n))
    const unread = live.filter(n => !n.read).sort((a, b) => a.id - b.id)
    const onInbox = s.nav[s.nav.length - 1]?.screen === 'inbox'
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
    // nothing unread: open the newest story so the screen is never blank
    const newest = [...live].sort((a, b) => b.id - a.id)[0]
    return {
      inboxId: s.inboxId ?? newest?.id ?? null,
      nav: onInbox ? s.nav : [...s.nav, { screen: 'inbox' as const }],
      tick: s.tick + 1,
    }
  }),

  inboxStep: (dir) => set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => inInbox(g, n)).sort((a, b) => b.id - a.id).slice(0, 20)
    if (!live.length) return {}
    const i = live.findIndex(n => n.id === s.inboxId)
    // dir -1 goes back in time, which is FORWARD through a newest-first list
    const j = Math.max(0, Math.min(live.length - 1, (i < 0 ? 0 : i) + (dir === -1 ? 1 : -1)))
    markRead(g, live[j])
    return { inboxId: live[j].id, tick: s.tick + 1 }
  }),

  clearRead: () => set(s => {
    const g = s.game
    if (!g) return {}
    // gossip clears like everything else now that the wire and the news are one
    // list: exempting it meant Clear read left a screenful behind
    for (const n of g.news) if (n.read) n.cleared = true
    const left = g.news.filter(n => inInbox(g, n))
    return { inboxId: left.length ? left.sort((a, b) => b.id - a.id)[0].id : null, tick: s.tick + 1 }
  }),

  start: (clubId, managerName, challengeId, origin) => {
    const seed = (Math.random() * 2 ** 31) | 0
    const g = newGame(clubId, managerName, seed, challengeId, origin)
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
    set({ game: g, nav: [{ screen: 'home' }], tick: get().tick + 1, tut: firstRun })
    void get().persist()
  },

  toggleShortlist: (playerId) => {
    const g = get().game
    if (!g) return
    g.shortlist = g.shortlist.includes(playerId)
      ? g.shortlist.filter(id => id !== playerId)
      : [...g.shortlist, playerId].slice(-25)
    set(s => ({ tick: s.tick + 1 }))
  },

  setGame: (g, slot, keepPlace = false) => {
    // Continue passes keepPlace, so tapping it lands on the screen the manager
    // was last on rather than dumping him on Home. Load Career deliberately does
    // not: picking a different save out of a list is a fresh start on that save.
    const where = keepPlace ? readWhere() : null
    const nav = where && where.slot === slot ? where.nav : [{ screen: 'home' as const }]
    noteWhere(slot, nav)
    set({ game: g, saveSlot: slot, nav, tick: get().tick + 1 })
  },
  setSlot: (slot) => set({ saveSlot: slot }),

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
   * Rebuild a match that was in progress when the page went away.
   *
   * Replays the recorded match on top of its own pre-match save, so the tries,
   * the cards and the injuries come back because they happen again. Returns true
   * if a match was restored.
   */
  resumeLiveMatch: async () => {
    const slot = get().saveSlot
    const rec = await getResume<MatchResume>(slot).catch(() => null)
    const g = get().game
    if (!rec || !g || !resumeFits(rec, g)) {
      if (rec) void clearResume(slot).catch(() => {})
      return false
    }
    const pre = migrate(rec.pre)
    const out = replayMatch(pre, rec)
    if (!out) { void clearResume(slot).catch(() => {}); return false }
    set(s => ({
      game: pre,
      matchRec: rec,
      liveMatch: {
        ctx: out.ctx, fixture: out.fixture, events: out.ctx.events,
        cursor: Math.max(0, Math.min(rec.cursor, out.ctx.events.length)),
        playing: false, speed: 1, mode: rec.mode,
        done: out.ctx.seg === 3, talkMsg: out.talkMsg, preTalkMsg: out.preTalkMsg,
      },
      nav: [{ screen: 'matchday' as const }],
      tick: s.tick + 1,
    }))
    return true
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
    set({ game: g, saveSlot: where.slot, nav: where.nav, tick: get().tick + 1 })
    // AND THE MATCH HE WAS WATCHING. A refresh mid-match used to drop the manager
    // back into the week with the game gone; the record written at kick-off lets it
    // be played back to the same minute (game/resume.ts).
    await get().resumeLiveMatch().catch(() => false)
    return true
  },
  touch: () => set(s => ({ tick: s.tick + 1 })),

  /** CM-style Continue: play user's match if there is one, else process the week. */
  continueWeek: () => {
    const g = get().game
    if (!g) return
    // A RETIRED MANAGER DOES NOT GET ANOTHER WEEK (career.ts). The save stays
    // readable forever - the record, the cabinet and the verdict are the whole
    // point of an ending - but the clock has stopped.
    if (g.retired) return
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
        } else if (unread.length) {
          get().openWire(unread.map(n => n.id))
          return
        }
      }
      // THE PRESS HOLD YIELDS ON THE SECOND TAP, AND IT HAS TO.
      //
      // The first draft held the week until every question was answered, and
      // scripts/soakui.mjs found the consequence within one season: 60 taps
      // without the week moving, stuck on the Press Room at season 2 week 1.
      // Season openings stack the room - the 25C expectations question and the
      // pre-season camp decision both live in state.press - and a manager who
      // does not realise a question is REQUIRED cannot tell a gate from a
      // bricked save. That is the same "control that does nothing" failure the
      // Annual shipped in Round 26, and it is worse here because it can happen
      // on any week rather than one.
      //
      // So: tap once and you are taken to the room, which is the part the user
      // actually asked for - the game stops walking you past it. Tap again from
      // inside the room and the week goes on, and the question expires the way
      // an unanswered question always has (season.ts, the desk-clears-itself
      // block). Being made to LOOK is a gate; being unable to leave is a bug.
      //
      // Mail keeps the hard gate, because there the gate itself does the
      // clearing: one tap hands the whole pile to the reader, and leaving the
      // reader marks the rest read, so it cannot fail to terminate.
      if (desk?.kind === 'press' && get().nav[get().nav.length - 1]?.screen !== 'press') {
        set(s => ({ nav: [...s.nav, { screen: 'press' as const }], tick: s.tick + 1 }))
        return
      }
    }
    if (step.kind === 'match') {
      // stand the manager on the day the match actually falls, so the masthead
      // reads Friday for a Friday night game
      const md = matchDayIndex(g)
      if (md != null) g.day = md
      set(s => ({ nav: [...s.nav, { screen: 'matchday' }], tick: s.tick + 1 }))
      return
    }
    if (step.kind === 'day') {
      g.day = step.day
      set(s => ({ nav: openDay(s.nav), tick: s.tick + 1 }))
      void get().persist()
      return
    }
    // the week is spent: settle it, then start the new Monday. The watermark is
    // what tells the bulletins which stories are new.
    g.newsFrom = g.nextId
    processWeekAndAdvance(g)
    landOnNextWeek(g, set, get)
  },

  /** After a week has been settled, show the first day of the new one.
   *
   *  Shared by Continue and finishMatch so a week that ends in a match and a week
   *  that ends in a blank Saturday both resume on the same footing. */
  openWire: (ids, startId) => {
    const queue = startId != null
      ? [...ids.slice(ids.indexOf(startId)), ...ids.slice(0, Math.max(0, ids.indexOf(startId)))]
      : ids
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
  instantResult: (preTalk) => {
    const g = get().game
    if (!g) return
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
    const ctx = beginMatch(g, fx, weekRng(g), true, userTeamId)
    if (preTalk) applyPreTalk(g, ctx, preTalk)
    playHalf(g, ctx)
    playHalf(g, ctx)
    const resultsKey = `${fx.compId}:${g.week}`
    // Exactly what finishMatch does, and for the same reason. This used to set
    // its own watermark aside and then push every new story of the week into the
    // Wire in one go, which meant a week played through the assistant was
    // revealed all at once while the same week watched on the pitch was revealed
    // a day at a time. Measured over a season of instant results: 30 bulletins
    // across 36 weeks, because the Wire had already read and cleared the stories
    // Monday to Friday were meant to carry. The day walk is the reveal now, both
    // ways round; the round-up still comes first, with Monday under it.
    g.newsFrom = g.nextId
    processWeekAndAdvance(g)
    get().dropResume()
    set(s => ({ liveMatch: null, tick: s.tick + 1 }))
    landOnNextWeek(g, set, get, [{ screen: 'results', param: resultsKey }])
  },

  kickOff: (preTalk, mode) => {
    const g = get().game
    if (!g) return
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
    const pre = JSON.parse(JSON.stringify(g)) as GameState
    const ctx = beginMatch(g, fx, weekRng(g), true, userTeamId)
    let preTalkMsg: string | null = null
    if (preTalk) preTalkMsg = applyPreTalk(g, ctx, preTalk)
    const rec: MatchResume = {
      v: 1, pre, fxId: fx.id, userSideId: userTeamId, preTalk: preTalk ?? null,
      mode: mode ?? 'full', tick: 0, cursor: 0, cmds: [],
      season: g.season, week: g.week, savedAt: Date.now(),
    }
    set(s => ({
      liveMatch: {
        ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1,
        mode: mode ?? 'full', done: false, talkMsg: null, preTalkMsg,
      },
      matchRec: rec,
      tick: s.tick + 1,
    }))
    void putResume(get().saveSlot, rec).catch(() => {})
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

  /** The match is over, or abandoned: the record must not outlive it. */
  dropResume: () => {
    const slot = get().saveSlot
    set({ matchRec: null })
    void clearResume(slot).catch(() => {})
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
        ? nextHighlight(ctx.events, cursor)
        : cursor + 1
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor: step }, tick: s.tick + 1 } : {})
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
    if (ctx.awaiting || ctx.seg === 3 || ctx.decision) {
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, playing: false, done: ctx.seg === 3 }, tick: s.tick + 1 } : {})
      return
    }
    // simulate until something new happens, a decision is needed, or a break
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play' && !ctx.decision) {
      r = stepTick(game, ctx)
    }
    if (r === 'FT') settleKnockout(game, ctx)
    if (ctx.events.length > cursor) cursor += 1
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor }, tick: s.tick + 1 } : {})
    // where the match has got to, so a reload comes back to the same minute
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
    if (r === 'FT') settleKnockout(game, ctx)
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

  matchMode: (mode) => set(s => {
    if (!s.liveMatch) return {}
    // remembered for the competition too, so switching mid-match is also a
    // standing answer for next week rather than a one-off
    if (s.game) s.game.viewPref = { ...(s.game.viewPref ?? {}), [s.liveMatch.fixture.compId]: mode }
    return { liveMatch: { ...s.liveMatch, mode }, tick: s.tick + 1 }
  }),

  /** After FT: process the rest of the week and return home. */
  finishMatch: () => {
    const g = get().game
    const live = get().liveMatch
    if (!g) return
    const resultsKey = live ? `${live.fixture.compId}:${g.week}` : null
    g.newsFrom = g.nextId
    processWeekAndAdvance(g)
    get().dropResume()
    set(s => ({ liveMatch: null, tick: s.tick + 1 }))
    // The full-time round-up still comes first - that is the moment you want
    // straight after your own final whistle - and Monday's bulletin sits under
    // it, so backing out of the round-up puts you at the start of the new week
    // rather than nowhere.
    landOnNextWeek(g, set, get, resultsKey ? [{ screen: 'results', param: resultsKey }] : [])
  },

  answerPressOption: (pressId, optionIndex) => {
    const g = get().game
    if (!g) return
    answerPress(g, pressId, optionIndex)
    set(s => ({ tick: s.tick + 1 }))
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
      g.news.push({
        id: g.nextId++, week: g.week, season: g.season, type: 'board', read: false,
        subject: `🌍 Appointed: national head coach of ${nat}`,
        body: keepClub && !g.unemployed
          ? `A proud day. You now coach ${nat} alongside your club duties. In Test windows, when your club has no fixture, you'll take charge of the national side on match day - and every championship they win goes in YOUR cabinet.`
          : `A proud day. ${nat} is your whole job now: Test windows, championship campaigns, and every trophy they win goes in YOUR cabinet.`,
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
    g.news.push({
      id: g.nextId++, week: g.week, season: g.season, type: 'board', read: false,
      subject: `You step down as ${nat} head coach`,
      body: `The union thanks you for your service. The door, they say, stays open.`,
    })
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  /** Never rejects. Every call site is `void get().persist()`, so a thrown
   *  write would have been an unhandled rejection and nothing more - the game
   *  carried on looking perfectly healthy while saving nothing. A failure now
   *  raises a banner instead, and a later success clears it. */
  persist: async () => {
    const { game, saveSlot } = get()
    if (!game) return
    try {
      await saveGame(saveSlot, game)
      if (get().saveFail) set({ saveFail: 0, saveFailMsg: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('save failed', e)
      set(s => ({ saveFail: s.saveFail + 1, saveFailMsg: msg, tick: s.tick + 1 }))
    }
  },
}))

// Browser probes stage the states a natural walk cannot reach on demand - an
// injured starter on match morning, a specific inbox backlog - through this
// handle. It is the same store the app runs on; nothing ships differently for
// it, and a player poking it in devtools can only cheat at their own save.
if (typeof window !== 'undefined') {
  ;(window as unknown as { rugbyStore?: typeof useStore }).rugbyStore = useStore
}
