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
import { saveGame } from './game/save'

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'inbox' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  | 'press' | 'comp' | 'history' | 'nations' | 'legacy' | 'jobs'
  | 'feed' | 'medical' | 'report' | 'profile' | 'saves' | 'dreamteam' | 'results' | 'seasonreview' | 'agency' | 'wire' | 'infra' | 'handbook'
  | 'offers'

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
  /** unread stories queued for the full-screen Wire flow after Continue */
  wireQueue: number[]
  night: boolean
  toggleNight: () => void
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
  setGame: (g: GameState, slot: string) => void
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
  startSecondHalf: () => void
  applyJob: (clubId: string) => string
  resign: () => void
  answerNatOffer: (accept: boolean) => void
  resignNat: () => void
  answerPressOption: (pressId: number, optionIndex: number) => void
  persist: () => Promise<void>
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

export const useStore = create<Store>((set, get) => ({
  game: null,
  tick: 0,
  nav: [{ screen: 'menu' }],
  liveMatch: null,
  wireQueue: [],
  saveSlot: 'slot1',
  inboxId: null,
  night: typeof localStorage !== 'undefined' && localStorage.getItem('rm-night') === '1',
  toggleNight: () => set(s => {
    const night = !s.night
    try { localStorage.setItem('rm-night', night ? '1' : '0') } catch { /* private mode */ }
    return { night }
  }),

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
    set({ game: g, nav: [{ screen: 'home' }], tick: get().tick + 1 })
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

  setGame: (g, slot) => set({ game: g, saveSlot: slot, nav: [{ screen: 'home' }], tick: get().tick + 1 }),
  setSlot: (slot) => set({ saveSlot: slot }),

  go: (screen, param) => set(s => ({ nav: [...s.nav, { screen, param }] })),
  back: () => set(s => ({ nav: s.nav.length > 1 ? s.nav.slice(0, -1) : s.nav })),
  home: () => set({ nav: [{ screen: 'home' }] }),
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
    const fx = (!g.unemployed && userFixtureThisWeek(g)) || natFixtureThisWeek(g)
    if (fx) {
      set(s => ({ nav: [...s.nav, { screen: 'matchday' }], tick: s.tick + 1 }))
      return
    }
    const sinceId = g.nextId
    processWeekAndAdvance(g)
    // the Wire takes over: this week's stories fill the screen one by one
    const wire = g.news.filter(n => !n.read && n.id >= sinceId).map(n => n.id)
    set(s => ({
      wireQueue: wire,
      nav: wire.length ? [...s.nav.filter(e => e.screen !== 'wire'), { screen: 'wire' as const }] : s.nav,
      tick: s.tick + 1,
    }))
    // autosave every advance: serialization is ~40ms even in deep saves,
    // and a phone tab eviction should never cost more than one week
    void get().persist()
  },

  /** From the MatchDay preview: take the field. The match simulates
   *  tick by tick as the ticker plays, so nothing is decided yet. */
  instantResult: (preTalk) => {
    const g = get().game
    if (!g) return
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
    const sinceId = g.nextId
    processWeekAndAdvance(g)
    const wire = g.news.filter(n => !n.read && n.id >= sinceId).map(n => n.id)
    set(s => ({
      liveMatch: null,
      wireQueue: wire,
      // results on top; backing out of them lands on the Wire stories
      nav: [{ screen: 'home' }, ...(wire.length ? [{ screen: 'wire' as const }] : []), { screen: 'results' as const, param: resultsKey }],
      tick: s.tick + 1,
    }))
    void get().persist()
  },

  kickOff: (preTalk, mode) => {
    const g = get().game
    if (!g) return
    const clubFx = g.unemployed ? undefined : userFixtureThisWeek(g)
    const fx = clubFx ?? natFixtureThisWeek(g)
    if (!fx) return
    const userTeamId = clubFx
      ? g.userClubId
      : (fx.homeId === g.natTeam || fx.awayId === g.natTeam) ? g.natTeam!
      : (fx.homeId === 'LIO' || fx.awayId === 'LIO') ? 'LIO'
      : g.userClubId
    const ctx = beginMatch(g, fx, weekRng(g), true, userTeamId)
    let preTalkMsg: string | null = null
    if (preTalk) preTalkMsg = applyPreTalk(g, ctx, preTalk)
    set(s => ({
      liveMatch: {
        ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1,
        mode: mode ?? 'full', done: false, talkMsg: null, preTalkMsg,
      },
      tick: s.tick + 1,
    }))
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
  },

  /** Fast-forward the rest of the current period (to HT, 60' or FT).
   *  Pending penalty calls default to taking the points. */
  skipToBreak: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx } = liveMatch
    let r: ReturnType<typeof stepTick> = 'play'
    while (!ctx.awaiting && ctx.seg < 3) {
      if (ctx.decision) resolveDecision(game, ctx, 'posts')
      r = stepTick(game, ctx)
      if (ctx.decision) resolveDecision(game, ctx, 'posts')
      if (r !== 'play') break
    }
    if (r === 'FT') settleKnockout(game, ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, cursor: ctx.events.length, playing: false, done: ctx.seg === 3 },
      tick: s.tick + 1,
    } : {})
  },

  /** The touchline call on a kickable penalty. */
  decide: (choice) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || !liveMatch.ctx.decision) return ''
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
    const msg = swapInjuryCover(game, liveMatch.ctx, onId, inId)
    set(s => ({ tick: s.tick + 1 }))
    return msg
  },

  /** Re-read the tactic sliders mid-match - allowed at any stoppage. */
  liveTactics: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
    if (liveMatch.ctx.userSideId !== game.userClubId) return // Test match: no club tactic board
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

  matchCursor: (cursor, playing) => set(s => s.liveMatch ? ({
    liveMatch: { ...s.liveMatch, cursor, playing },
  }) : {}),

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
    const sinceId = g.nextId
    processWeekAndAdvance(g)
    const wire = g.news.filter(n => !n.read && n.id >= sinceId).map(n => n.id)
    set(s => ({
      liveMatch: null,
      wireQueue: wire,
      nav: [{ screen: 'home' },
        ...(wire.length ? [{ screen: 'wire' as const }] : []),
        ...(resultsKey ? [{ screen: 'results' as const, param: resultsKey }] : [])],
      tick: s.tick + 1,
    }))
    void get().persist()
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

  persist: async () => {
    const { game, saveSlot } = get()
    if (game) await saveGame(saveSlot, game)
  },
}))
