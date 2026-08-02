import { create } from 'zustand'
import type { GameState, MatchEvent, Fixture } from './game/model'
import { newGame } from './game/newgame'
import { processWeekAndAdvance, resolveKnockoutDraw, userFixtureThisWeek, weekRng } from './game/season'
import { applyTeamTalk, beginMatch, makeSubstitution, playHalf, teamShort, type LiveCtx } from './game/matchEngine'
import { simMatch } from './game/matchEngine'
import { answerPress } from './game/media'
import { saveGame } from './game/save'

export type Screen =
  | 'menu' | 'newgame' | 'home' | 'squad' | 'player' | 'tactics' | 'fixtures'
  | 'tables' | 'transfers' | 'training' | 'finances' | 'club' | 'matchday'
  | 'press' | 'comp' | 'history' | 'nations' | 'legacy'

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
  } | null
  saveSlot: string
  night: boolean
  toggleNight: () => void

  start: (clubId: string, managerName: string, challengeId?: string) => void
  toggleShortlist: (playerId: number) => void
  hireStaff: (role: 'assistant' | 'physio' | 'scout') => void
  setGame: (g: GameState, slot: string) => void
  go: (screen: Screen, param?: string | number) => void
  back: () => void
  home: () => void
  touch: () => void
  continueWeek: () => void
  kickOff: () => void
  matchCursor: (cursor: number, playing: boolean) => void
  finishMatch: () => void
  teamTalk: (kind: 'fire' | 'calm' | 'praise' | 'demand') => void
  halfTimeSub: (outId: number, inId: number) => string
  startSecondHalf: () => void
  answerPressOption: (pressId: number, optionIndex: number) => void
  persist: () => Promise<void>
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
      body: `The club has upgraded its ${role} setup to level ${g.staff[role]}.`,
    })
    set(s => ({ tick: s.tick + 1 }))
  },

  setGame: (g, slot) => set({ game: g, saveSlot: slot, nav: [{ screen: 'home' }], tick: get().tick + 1 }),

  go: (screen, param) => set(s => ({ nav: [...s.nav, { screen, param }] })),
  back: () => set(s => ({ nav: s.nav.length > 1 ? s.nav.slice(0, -1) : s.nav })),
  home: () => set({ nav: [{ screen: 'home' }] }),
  touch: () => set(s => ({ tick: s.tick + 1 })),

  /** CM-style Continue: play user's match if there is one, else process the week. */
  continueWeek: () => {
    const g = get().game
    if (!g) return
    const fx = userFixtureThisWeek(g)
    if (fx) {
      set(s => ({ nav: [...s.nav, { screen: 'matchday' }], tick: s.tick + 1 }))
      return
    }
    processWeekAndAdvance(g)
    set(s => ({ tick: s.tick + 1 }))
    if (g.week % 4 === 0) void get().persist()
  },

  /** From the MatchDay preview: simulate the first half, start playback. */
  kickOff: () => {
    const g = get().game
    if (!g) return
    const fx = userFixtureThisWeek(g)
    if (!fx) return
    const ctx = beginMatch(g, fx, weekRng(g), true)
    playHalf(g, ctx) // first half
    set(s => ({
      liveMatch: { ctx, fixture: fx, events: ctx.events, cursor: 0, playing: true, speed: 1, done: false, talkMsg: null },
      tick: s.tick + 1,
    }))
  },

  teamTalk: (kind) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.half !== 1) return
    const msg = applyTeamTalk(game, liveMatch.ctx, kind)
    set(s => ({ liveMatch: s.liveMatch ? { ...s.liveMatch, talkMsg: msg } : null, tick: s.tick + 1 }))
  },

  halfTimeSub: (outId, inId) => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.half !== 1) return 'Not half-time.'
    const msg = makeSubstitution(game, liveMatch.ctx, outId, inId)
    set(s => ({ tick: s.tick + 1 }))
    return msg
  },

  /** Resume after the half-time interval. */
  startSecondHalf: () => {
    const { game, liveMatch } = get()
    if (!game || !liveMatch || liveMatch.ctx.half !== 1) return
    const ctx = liveMatch.ctx
    playHalf(game, ctx) // second half + finalisation
    const fx = ctx.fx
    // knockout ties are settled in sudden-death extra time
    if (fx.stage && fx.homeScore === fx.awayScore) {
      resolveKnockoutDraw(game, fx, weekRng(game))
      ctx.events.push({
        min: 90, type: 'FT', teamId: '',
        text: `SUDDEN DEATH! ${teamShort(game, fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId)} snatch it in extra time — ${fx.homeScore}-${fx.awayScore}!`,
        homeScore: fx.homeScore, awayScore: fx.awayScore,
      })
      fx.events = ctx.events
    }
    set(s => ({
      liveMatch: s.liveMatch ? { ...s.liveMatch, playing: true, done: false } : null,
      tick: s.tick + 1,
    }))
  },

  matchCursor: (cursor, playing) => set(s => s.liveMatch ? ({
    liveMatch: { ...s.liveMatch, cursor, playing, done: cursor >= s.liveMatch.events.length },
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

  persist: async () => {
    const { game, saveSlot } = get()
    if (game) await saveGame(saveSlot, game)
  },
}))
