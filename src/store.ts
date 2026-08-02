import { create } from 'zustand'
import type { GameState, MatchEvent, Fixture, StaffLevels } from './game/model'
import { newGame } from './game/newgame'
import { processWeekAndAdvance, resolveKnockoutDraw, userFixtureThisWeek, weekRng } from './game/season'
import {
  applyPreTalk, applyTacticsChange, applyTeamTalk, beginMatch, makeSubstitution,
  stepTick, teamShort, type LiveCtx,
} from './game/matchEngine'
import { applyForJob, resignJob } from './game/jobs'
import { answerPress } from './game/media'
import { saveGame } from './game/save'

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  | 'press' | 'comp' | 'history' | 'nations' | 'legacy' | 'jobs'
  | 'feed' | 'medical' | 'report' | 'profile' | 'saves'

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
    done: boolean
    talkMsg: string | null
    preTalkMsg: string | null
  } | null
  saveSlot: string
  night: boolean
  toggleNight: () => void

  start: (clubId: string, managerName: string, challengeId?: string) => void
  toggleShortlist: (playerId: number) => void
  hireStaff: (role: keyof StaffLevels) => void
  setGame: (g: GameState, slot: string) => void
  setSlot: (slot: string) => void
  go: (screen: Screen, param?: string | number) => void
  back: () => void
  home: () => void
  touch: () => void
  continueWeek: () => void
  kickOff: (preTalk?: 'calm' | 'fire' | 'underdog' | 'expect' | 'enjoy') => void
  advanceLive: () => void
  skipToBreak: () => void
  matchCursor: (cursor: number, playing: boolean) => void
  finishMatch: () => void
  teamTalk: (kind: 'fire' | 'calm' | 'praise' | 'demand') => void
  halfTimeSub: (outId: number, inId: number) => string
  liveTactics: () => void
  startSecondHalf: () => void
  applyJob: (clubId: string) => string
  resign: () => void
  answerPressOption: (pressId: number, optionIndex: number) => void
  persist: () => Promise<void>
}

/** After a tick hits FT: knockout ties are settled in sudden-death extra time. */
function settleKnockout(g: GameState, ctx: LiveCtx) {
  const fx = ctx.fx
  if (fx.stage && fx.homeScore === fx.awayScore) {
    resolveKnockoutDraw(g, fx, weekRng(g))
    ctx.events.push({
      min: 90, type: 'FT', teamId: '',
      text: `SUDDEN DEATH! ${teamShort(g, fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId)} snatch it in extra time — ${fx.homeScore}-${fx.awayScore}!`,
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
  saveSlot: 'slot1',
  night: typeof localStorage !== 'undefined' && localStorage.getItem('rm-night') === '1',
  toggleNight: () => set(s => {
    const night = !s.night
    try { localStorage.setItem('rm-night', night ? '1' : '0') } catch { /* private mode */ }
    return { night }
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

  hireStaff: (role) => {
    const g = get().game
    if (!g || g.staff[role] >= 3) return
    g.staff[role] += 1
    g.news.push({
      id: g.nextId++, week: g.week, season: g.season, type: 'general', read: true,
      subject: `Backroom appointment`,
      body: `The club has upgraded its coaching department: ${String(role)} setup now level ${g.staff[role]}.`,
    })
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
    const fx = userFixtureThisWeek(g)
    if (fx && !g.unemployed) {
      set(s => ({ nav: [...s.nav, { screen: 'matchday' }], tick: s.tick + 1 }))
      return
    }
    processWeekAndAdvance(g)
    set(s => ({ tick: s.tick + 1 }))
    if (g.week % 4 === 0) void get().persist()
  },

  /** From the MatchDay preview: take the field. The match simulates
   *  tick by tick as the ticker plays, so nothing is decided yet. */
  kickOff: (preTalk) => {
    const g = get().game
    if (!g) return
    const fx = userFixtureThisWeek(g)
    if (!fx) return
    const ctx = beginMatch(g, fx, weekRng(g), true)
    let preTalkMsg: string | null = null
    if (preTalk) preTalkMsg = applyPreTalk(g, ctx, preTalk)
    set(s => ({
      liveMatch: {
        ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1,
        done: false, talkMsg: null, preTalkMsg,
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
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor: cursor + 1 }, tick: s.tick + 1 } : {})
      return
    }
    if (ctx.awaiting || ctx.seg === 3) {
      set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, playing: false, done: ctx.seg === 3 } } : {})
      return
    }
    // simulate until something new happens or the clock hits a break
    let r: ReturnType<typeof stepTick> = 'play'
    while (ctx.events.length <= cursor && r === 'play') {
      r = stepTick(game, ctx)
    }
    if (r === 'FT') settleKnockout(game, ctx)
    if (ctx.events.length > cursor) cursor += 1
    set(s => s.liveMatch ? { liveMatch: { ...s.liveMatch, cursor }, tick: s.tick + 1 } : {})
  },

  /** Fast-forward the rest of the current period (to HT, 60' or FT). */
  skipToBreak: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch) return
    const { ctx } = liveMatch
    let r: ReturnType<typeof stepTick> = 'play'
    while (!ctx.awaiting && ctx.seg < 3 && (r = stepTick(game, ctx)) === 'play') { /* run the clock */ }
    if (r === 'FT') settleKnockout(game, ctx)
    set(s => s.liveMatch ? {
      liveMatch: { ...s.liveMatch, cursor: ctx.events.length, playing: false, done: ctx.seg === 3 },
      tick: s.tick + 1,
    } : {})
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
    const msg = makeSubstitution(game, liveMatch.ctx, outId, inId)
    set(s => ({ tick: s.tick + 1 }))
    return msg
  },

  /** Re-read the tactic sliders mid-match — allowed at any stoppage. */
  liveTactics: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.seg >= 3) return
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

  /** After FT: process the rest of the week and return home. */
  finishMatch: () => {
    const g = get().game
    if (!g) return
    processWeekAndAdvance(g)
    set(s => ({ liveMatch: null, nav: [{ screen: 'home' }], tick: s.tick + 1 }))
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

  persist: async () => {
    const { game, saveSlot } = get()
    if (game) await saveGame(saveSlot, game)
  },
}))
