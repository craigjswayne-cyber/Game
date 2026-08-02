import { create } from 'zustand'
import type { GameState, MatchEvent, Fixture } from './game/model'
import { newGame } from './game/newgame'
import { processWeekAndAdvance, resolveKnockoutDraw, userFixtureThisWeek, weekRng } from './game/season'
import { teamShort } from './game/matchEngine'
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
    fixture: Fixture
    events: MatchEvent[]
    cursor: number
    playing: boolean
    speed: number
    done: boolean
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

  /** From the MatchDay preview: run the detailed sim, start playback. */
  kickOff: () => {
    const g = get().game
    if (!g) return
    const fx = userFixtureThisWeek(g)
    if (!fx) return
    const { events } = simMatch(g, fx, weekRng(g), true)
    // knockout ties are settled in sudden-death extra time
    if (fx.stage && fx.homeScore === fx.awayScore) {
      resolveKnockoutDraw(g, fx, weekRng(g))
      events.push({
        min: 90, type: 'FT', teamId: '',
        text: `SUDDEN DEATH! ${teamShort(g, fx.homeScore > fx.awayScore ? fx.homeId : fx.awayId)} snatch it in extra time — ${fx.homeScore}-${fx.awayScore}!`,
        homeScore: fx.homeScore, awayScore: fx.awayScore,
      })
      fx.events = events
    }
    set(s => ({
      liveMatch: { fixture: fx, events, cursor: 0, playing: true, speed: 1, done: false },
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
