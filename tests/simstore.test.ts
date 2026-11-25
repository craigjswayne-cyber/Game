// A new-engine match driven through the store, as the match screen drives it (no UI): kick-off,
// the live heartbeat, a substitution, a tactics change, the half-time talk, a penalty answer, the
// final whistle and the week turned; then the same match resumed from a mid-match record.
import { beforeAll, describe, expect, it } from 'vitest'
import { newGame } from '../src/game/newgame'
import { processWeekAndAdvance, userFixtureThisWeek } from '../src/game/season'
import { useStore } from '../src/store'
import { loadGame, saveGame, putResume } from '../src/game/save'
import { replaySim2 } from '../src/game/sim/toResult'
import type { GameState } from '../src/game/model'
import type { MatchResume } from '../src/game/resume'

const SLOT = 'slot1'
const st = useStore
const quiet = () => new Promise(r => setTimeout(r, 600))

/** a career at its first league match: the weeks before it turned headless, then the matchday screen */
function atLeagueMatch(): GameState {
  const g = newGame('leicester', 'Store', 11)
  for (let i = 0; i < 40; i++) {
    const fx = userFixtureThisWeek(g)
    if (fx && g.comps[fx.compId]?.table?.length) return g
    processWeekAndAdvance(g)
  }
  throw new Error('no league match reached')
}

let pre: GameState
let midRec: MatchResume | null = null
const did = { sub: false, tactics: false, talk: false, call: '' as string, cover: false }

beforeAll(async () => {
  await saveGame(SLOT, atLeagueMatch())
  st.getState().setGame((await loadGame(SLOT))!, SLOT)
  await quiet()
  st.getState().game!.annual = null
  st.setState({ nav: [{ screen: 'home' }, { screen: 'matchday' }] })
  pre = structuredClone(st.getState().game!)
}, 120_000)

describe('a sim2 match through the store', () => {
  it('plays, takes his decisions, and turns the week on its record', async () => {
    st.getState().kickOff(undefined, 'full')
    const live0 = st.getState().liveMatch!
    expect(live0.sim2).toBeDefined()
    const s2 = live0.sim2!
    const us = s2.us!
    const usSide = () => (us === 0 ? s2.ctx.home : s2.ctx.away)
    for (let i = 0; i < 20000 && st.getState().liveMatch && !st.getState().liveMatch!.done; i++) {
      const lm = st.getState().liveMatch!
      const ctx = lm.ctx
      // the penalty call: his, through the store
      if (s2.pending && !did.call) { did.call = s2.pending.options.includes('corner') ? 'corner' : s2.pending.options[0]; st.getState().decide(did.call as never) }
      // an injury: his pick, the last man on the bench
      if (s2.pendingInjury && !did.cover) { did.cover = true; const pi = s2.pendingInjury; st.getState().injuryPick(Number(pi.who), Number(pi.options[pi.options.length - 1])) }
      const clock = s2.plays[s2.plays.length - 1]?.clock ?? 0
      if (!did.tactics && clock > 900) {
        did.tactics = true
        st.getState().game!.clubs[usSide().teamId].tactic.tempo = 85
        st.getState().liveTactics()
      }
      if (!did.sub && clock > 1500) {
        const side = usSide()
        const outId = side.lineup.slice(0, 15).find(id => id != null && side.onPitch.has(id) && st.getState().game!.players[id]!.pos === 'FL')!
        const inId = side.lineup.slice(15, 23).find(id => id != null && !side.ratings.has(id))!
        if (outId != null && inId != null) { st.getState().halfTimeSub(outId, inId); did.sub = true }
      }
      if (ctx.awaiting === 'HT') {
        if (!did.talk) { did.talk = true; st.getState().teamTalk('calm') }
        st.getState().startSecondHalf()
      }
      if (!midRec && clock > 3000) { await quiet(); midRec = structuredClone(st.getState().matchRec) }
      if (!lm.playing) st.setState({ liveMatch: { ...lm, playing: true } })
      st.getState().advanceLive()
    }
    expect(did.tactics && did.sub && did.talk).toBe(true)
    const P = s2.plays
    // the decisions are in the record
    expect(P.some(p => p.kind === 'substitution' && p.result === 'made' && p.side === us && !p.cause)).toBe(true)
    expect(P.some(p => p.tactics?.side === us && p.tactics.set.tempo === 85)).toBe(true)
    expect(P.some(p => p.talk?.side === us && p.talk.tone === 'calm')).toBe(true)
    if (did.call) expect(P.some(p => p.callBy === 'manager')).toBe(true)
    const fin = P[P.length - 1].score
    const g = st.getState().game!
    const fx = g.fixtures.find(f => f.id === s2.fx.id)!
    expect([fx.homeScore, fx.awayScore]).toEqual([fin[0], fin[1]])
    // the scorers' season tallies moved by what the record says
    const tries = new Map<number, number>()
    for (const p of P) if (p.kind === 'try' && p.who) tries.set(Number(p.who), (tries.get(Number(p.who)) ?? 0) + 1)
    for (const [id, n] of tries) expect(g.players[id].stats.tries - pre.players[id].stats.tries, `tries for ${id}`).toBe(n)
    const cons = new Map<number, number>()
    for (const p of P) if (p.kind === 'conversion' && p.good && p.who) cons.set(Number(p.who), (cons.get(Number(p.who)) ?? 0) + 1)
    for (const [id, n] of cons) expect(g.players[id].stats.cons - pre.players[id].stats.cons).toBe(n)
    // a carded man: the card on his season, and a red card's ban
    for (const p of P.filter(q => q.kind === 'yellowCard')) expect(g.players[Number(p.who)].stats.yc).toBeGreaterThan(pre.players[Number(p.who)].stats.yc)
    for (const p of P.filter(q => q.kind === 'redCard')) expect(g.players[Number(p.who)].bans).toBeGreaterThan(0)
    // the week turns on it
    const week = g.week
    st.getState().finishMatch()
    await quiet()
    expect(st.getState().game!.week).not.toBe(week)
    const row = st.getState().game!.comps[fx.compId].table.find(r => r.teamId === fx.homeId)!
    expect(row.p).toBeGreaterThan(0)
  }, 300_000)

  it('a mid-match record resumes to the same result as replaying it', async () => {
    expect(midRec?.sim2).toBeDefined()
    const rec = midRec!
    // what the resume should land on: the record played again, then the assistant has the rest
    const expectG = structuredClone(rec.pre)
    const r = replaySim2(expectG, rec.sim2!)!
    if (r.us != null) r.apply({ kind: 'bench', side: r.us, auto: true })
    r.finish()
    const want = [r.ctx.home.score, r.ctx.away.score]
    // the page went away mid-match: the career on disk is the pre-match one, with the record beside it
    // (after the first match's own clean-up has landed)
    await quiet(); await quiet()
    st.setState({ game: null, liveMatch: null, matchRec: null })
    await quiet()
    await saveGame(SLOT, structuredClone(rec.pre))
    await putResume(SLOT, rec, true)
    st.setState({ liveMatch: null, matchRec: null })
    const lg = (await loadGame(SLOT))!
    st.getState().setGame(lg, SLOT)
    await quiet()
    // opening the career finds the record and plays the match out itself (setGame); if it has not
    // yet, ask for it as the app does
    const played = () => st.getState().game!.fixtures.find(f => f.id === rec.fxId)!.played
    if (!played()) expect(await st.getState().resumeLiveMatch()).toBe(true)
    const g = st.getState().game!
    const fx = g.fixtures.find(f => f.id === rec.fxId)!
    expect(fx.played).toBe(true)
    expect([fx.homeScore, fx.awayScore]).toEqual(want)
  }, 300_000)
})
