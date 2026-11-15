// The feedback report counts what the manager did (game/usage.ts). Two
// readings in player reports were the counter's fault, not the player's
// (1.9.13): Offers read as never opened by managers who answered twenty bids a
// season on it, because Continue opened it round the store's go(); and a
// slider drag counted every step as a tactics change (41 "changes" a match).
import { beforeAll, describe, expect, it } from 'vitest'

// the counters live on the device: give node one
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: k => mem.get(k) ?? null, setItem: (k, v) => { mem.set(k, String(v)) }, removeItem: k => { mem.delete(k) },
  clear: () => mem.clear(), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size },
} as Storage

import { useStore } from '../src/store'
import { newGame } from '../src/game/newgame'
import { readUsage } from '../src/game/usage'
import { beginMatch } from '../src/game/matchEngine'
import { mulberry32 } from '../src/game/rng'

const st = useStore

describe('what the feedback report counts', () => {
  beforeAll(() => {
    const g = newGame('northampton', 'Counts', 8)
    st.setState({ game: g, nav: [{ screen: 'home' }] })
  })

  it('Offers is counted when Continue opens it for a bid', () => {
    const g = st.getState().game!
    const p = g.clubs[g.userClubId].players.map(id => g.players[id]).find(q => q && !q.acad)!
    const buyer = Object.keys(g.clubs).find(id => id !== g.userClubId)!
    g.offers.push({ id: g.nextId++, playerId: p.id, fromClubId: buyer, fee: 500_000, week: g.week, forUser: true, status: 'pending' } as typeof g.offers[number])
    const before = readUsage().screens.offers ?? 0
    st.setState({ lastAdvanceAt: 0 })
    void st.getState().continueWeek()
    expect(st.getState().nav.at(-1)?.screen).toBe('offers')
    expect(readUsage().screens.offers ?? 0).toBe(before + 1)
  })

  it('a slider dragged through many steps in one stoppage is one tactics change', () => {
    const g = st.getState().game!
    const fx = g.fixtures.find(f => f.homeId === g.userClubId || f.awayId === g.userClubId)!
    const ctx = beginMatch(g, fx, mulberry32(3), true, g.userClubId)
    st.setState({ liveMatch: { ctx, fixture: fx, cursor: 12 } as unknown as ReturnType<typeof st.getState>['liveMatch'] })
    const count = () => readUsage().acts.liveTactics ?? 0
    const before = count()
    for (let v = 20; v <= 80; v += 2) { g.clubs[g.userClubId].tactic.tempo = v; st.getState().liveTactics() }
    expect(count()).toBe(before + 1)
    // the next stoppage is a new change
    st.setState({ liveMatch: { ...st.getState().liveMatch!, cursor: 30 } })
    st.getState().liveTactics()
    expect(count()).toBe(before + 2)
  })
})
