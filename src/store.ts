import { create } from 'zustand'
import type { GameState, MatchEvent, Fixture } from './game/model'
import { newGame } from './game/newgame'
import { natFixtureThisWeek, processWeekAndAdvance, resolveKnockoutDraw, userFixtureThisWeek, weekRng } from './game/season'
import {
  applyPreTalk, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution, swapInjuryCover,
  playHalf, resolveDecision, stepTick, teamShort, type LiveCtx,
} from './game/matchEngine'
import { applyForJob, resignJob } from './game/jobs'
import { answerPress } from './game/media'
import { firstStepOfWeek, matchDayIndex, nextStep } from './game/days'
import { clearResume, getResume, loadGame, migrate, putResume, saveGame } from './game/save'
import { replayMatch, resumeFits, type MatchCmdBody, type MatchResume } from './game/resume'

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'inbox' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  | 'press' | 'comp' | 'history' | 'nations' | 'legacy' | 'jobs'
  | 'feed' | 'medical' | 'report' | 'profile' | 'saves' | 'dreamteam' | 'results' | 'seasonreview' | 'agency' | 'wire' | 'infra' | 'handbook'
  | 'offers' | 'academy' | 'day' | 'draw'

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
  } | null
  saveSlot: string
  /** the record that lets a live match survive a reload (game/resume.ts) */
  matchRec: MatchResume | null
  /** unread stories queued for the full-screen Wire flow after Continue */
  wireQueue: number[]
  night: boolean
  toggleNight: () => void
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

  start: (clubId: string, managerName: string, challengeId?: string) => void
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
  answerNatOffer: (accept: boolean) => void
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
  // `extra` goes on TOP: after your own final whistle the round-up is the screen
  // you want, and the new week's Monday sits underneath it, so backing out of the
  // round-up puts you at the start of the week rather than nowhere.
  set(s => ({
    nav: [{ screen: 'home' }, ...dayEntry, ...extra],
    tick: s.tick + 1,
  }))
  void get().persist()
}

export const useStore = create<Store>((set, get) => ({
  game: null,
  tick: 0,
  nav: [{ screen: 'menu' }],
  liveMatch: null,
  matchRec: null,
  wireQueue: [],
  saveSlot: 'slot1',
  inboxId: null,
  night: typeof localStorage !== 'undefined' && localStorage.getItem('rm-night') === '1',
  toggleNight: () => set(s => {
    const night = !s.night
    try { localStorage.setItem('rm-night', night ? '1' : '0') } catch { /* private mode */ }
    return { night }
  }),

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

  /** The inbox reader's recall window: the last 20 stories worth reading,
   *  newest first. Gossip lives in the Wire and cleared stories are filed. */
  openInbox: () => set(s => {
    const g = s.game
    if (!g) return {}
    const live = g.news.filter(n => n.type !== 'gossip' && !n.cleared)
    const unread = live.filter(n => !n.read).sort((a, b) => a.id - b.id)
    const onInbox = s.nav[s.nav.length - 1]?.screen === 'inbox'
    // oldest unread first: a queue is read front to back
    const next = unread[0]
    if (next) {
      next.read = true
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
    const live = g.news.filter(n => n.type !== 'gossip' && !n.cleared).sort((a, b) => b.id - a.id).slice(0, 20)
    if (!live.length) return {}
    const i = live.findIndex(n => n.id === s.inboxId)
    // dir -1 goes back in time, which is FORWARD through a newest-first list
    const j = Math.max(0, Math.min(live.length - 1, (i < 0 ? 0 : i) + (dir === -1 ? 1 : -1)))
    live[j].read = true
    return { inboxId: live[j].id, tick: s.tick + 1 }
  }),

  clearRead: () => set(s => {
    const g = s.game
    if (!g) return {}
    for (const n of g.news) if (n.read && n.type !== 'gossip') n.cleared = true
    const left = g.news.filter(n => n.type !== 'gossip' && !n.cleared)
    return { inboxId: left.length ? left.sort((a, b) => b.id - a.id)[0].id : null, tick: s.tick + 1 }
  }),

  start: (clubId, managerName, challengeId) => {
    const seed = (Math.random() * 2 ** 31) | 0
    const g = newGame(clubId, managerName, seed, challengeId)
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

  go: (screen, param) => set(s => { const nav = [...s.nav, { screen, param }]; noteWhere(s.saveSlot, nav); return { nav } }),
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
    const clubFx = g.unemployed ? undefined : userFixtureThisWeek(g)
    const fx = clubFx ?? natFixtureThisWeek(g)
    if (!fx) return
    const userTeamId = clubFx
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
    const clubFx = g.unemployed ? undefined : userFixtureThisWeek(g)
    const fx = clubFx ?? natFixtureThisWeek(g)
    if (!fx) return
    const userTeamId = clubFx
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
    const noted = (choice: 'posts') => { get().noteCmd({ kind: 'decide', choice }) }
    while (!ctx.awaiting && ctx.seg < 3) {
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      r = stepTick(game, ctx)
      if (ctx.decision) { noted('posts'); resolveDecision(game, ctx, 'posts') }
      if (r !== 'play') break
    }
    if (r === 'FT') settleKnockout(game, ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, cursor: ctx.events.length, playing: false, done: ctx.seg === 3 },
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
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return 'Play has resumed.'
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
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return 'Play has resumed.'
    get().noteCmd({ kind: 'cover', onId, inId })
    const msg = swapInjuryCover(game, liveMatch.ctx, onId, inId)
    set(s => ({ tick: s.tick + 1 }))
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
      liveMatch: s.liveMatch ? { ...s.liveMatch, playing: true, done: false } : null,
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

  answerNatOffer: (accept) => {
    const g = get().game
    if (!g || !g.natOffer) return
    const nat = g.natOffer.nat
    g.natOffer = null
    if (accept) {
      g.natTeam = nat
      g.natConfidence = 60
      g.news.push({
        id: g.nextId++, week: g.week, season: g.season, type: 'board', read: false,
        subject: `🌍 Appointed: national head coach of ${nat}`,
        body: `A proud day. You now coach ${nat} alongside your club duties. In Test windows, when your club has no fixture, you'll take charge of the national side on match day - and every championship they win goes in YOUR cabinet.`,
      })
    }
    set(s => ({ tick: s.tick + 1 }))
    void get().persist()
  },

  resignNat: () => {
    const g = get().game
    if (!g || !g.natTeam) return
    const nat = g.natTeam
    g.natTeam = null
    g.natConfidence = null
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
