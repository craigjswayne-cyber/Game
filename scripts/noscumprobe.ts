// Probe: a match that has kicked off cannot be played again (1.8.2).
//
// Tester note 1.4: losing a match, closing the game (or going back to the title
// and reopening the save) threw the match away and offered it again, so a
// result could be rerolled. The owner's decision: once the ball is kicked,
// reopening the game must never produce a different result from playing on.
//
// resumeprobe.ts proves the replay underneath is exact. This one drives the
// REAL STORE through the real load path - the career slot and the live-match
// record written to the save database, the game wiped from memory, the slot
// read back with loadGame and opened with setGame exactly as the title
// screen's Continue does - at every point a player might pull the plug:
//
//   straight after pressing play, before a minute has been simulated
//   in the middle of the first half, after a substitution
//   with a touchline call held and unanswered
//   at half-time, before the team talk
//   at full time, before Continue
//
// and through the Game Status doors: a backup exported before kick-off and
// imported mid-match, a copy exported mid-match and opened with no other trace
// of the match on the device, and a save to another slot mid-match. Every run
// makes the same calls the same way, and every run must end with exactly the
// result of the match played straight through. Every reopen must come back to
// the match, never to a fresh preview, and Kick Off and the assistant must
// refuse while it is there.
import { newGame } from '../src/game/newgame'
import { useStore } from '../src/store'
import { clearResume, loadGame, migrate, peekResumes, saveGame } from '../src/game/save'
import { processWeekAndAdvance, userMatchThisWeek } from '../src/game/season'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const st = useStore
const SLOT = 'slot1'
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 3)) }

type Point = 'kickoff' | 'mid1' | 'decision' | 'ht' | 'ft'
type Door = 'continue' | 'importBefore' | 'importStamped' | 'saveOther'

/** Everything about the result a player would notice. */
function resultSig(g: GameState, fxId: number, userSide: string): string {
  const fx = g.fixtures.find(f => f.id === fxId)!
  const ev = (fx.events ?? []).map(e => `${e.min}|${e.type}|${e.teamId}|${e.playerId ?? ''}|${e.homeScore}-${e.awayScore}`).join(';')
  const squad = Object.values(g.players)
    .filter(p => p.clubId === userSide)
    .sort((a, b) => a.id - b.id)
    .map(p => `${p.id}:${p.stats.tries}/${p.stats.points}/${p.stats.yc}/${p.stats.rc}/${p.bans}/${p.injury?.weeks ?? 0}`)
    .join(',')
  return `${fx.played}#${fx.homeScore}-${fx.awayScore}#${ev}#${squad}`
}

/** A fresh career, walked to its first match day, on disk in SLOT. */
async function fresh(seed: number): Promise<{ fxId: number; side: string }> {
  for (const k of ['slot1', 'slot2', 'imported']) await clearResume(k)
  const g = newGame('northampton', 'Noscum Probe', seed)
  let guard = 0
  while (!userMatchThisWeek(g) && guard++ < 10) processWeekAndAdvance(g)
  const fx = userMatchThisWeek(g)!
  st.setState({
    game: g, saveSlot: SLOT, nav: [{ screen: 'home' }, { screen: 'matchday' }],
    liveMatch: null, matchRec: null, resuming: false, lastAdvanceAt: 0,
  })
  await st.getState().persistNow()
  return { fxId: fx.id, side: g.userClubId }
}

/**
 * The manager's thumb. Every call is a function of the match as it stands, so
 * the same thumb after a reopen makes the same calls the match already has
 * recorded, and no others. Returns when `stop` says so, or at full time.
 */
function drive(stop: (p: Point | null) => boolean): Point | null {
  let guard = 0
  const seen = new Set<Point>()
  const hit = (p: Point) => { if (seen.has(p)) return false; seen.add(p); return stop(p) }
  while (guard++ < 5000) {
    const s = st.getState()
    const lm = s.liveMatch
    if (!lm) return null
    if (lm.resumed) { s.ackResume(); continue }
    const c = lm.ctx
    if (lm.cursor < c.events.length) { s.matchCursor(c.events.length, true); continue }
    if (c.seg === 3 && !c.decision) { if (hit('ft')) return 'ft'; return null }
    if (c.tick >= 5 && c.tick < 10 && !c.decision) {
      // a change from the bench mid-half, the first time through only
      if (c.subsUsed === 0) {
        const mine = c.home.teamId === c.userSideId ? c.home : c.away
        const off = [...mine.onPitch][3]
        const on = [...mine.benchIds].find(id => !mine.onPitch.has(id) && !mine.ratings.has(id))
        if (off != null && on != null) { s.halfTimeSub(off, on); continue }
      }
      if (hit('mid1')) return 'mid1'
    }
    if (c.decision) {
      if (hit('decision')) return 'decision'
      s.decide(c.tick % 3 === 0 ? 'posts' : c.tick % 3 === 1 ? 'corner' : 'tap')
      continue
    }
    if (c.awaiting === 'HT') {
      if (hit('ht')) return 'ht'
      if (!c.talkUsed) { s.teamTalk('demand'); continue }
      s.startSecondHalf(); continue
    }
    if (c.awaiting === 'BRK') {
      const tac = s.game!.clubs[s.game!.userClubId].tactic
      if (tac.tempo !== 71) { Object.assign(tac, { style: 66, tempo: 71, kicking: 30, aggression: 58 }); s.liveTactics(); continue }
      s.startSecondHalf(); continue
    }
    if (!lm.playing) { s.matchCursor(lm.cursor, true); continue }
    s.advanceLive()
  }
  ok(false, 'the thumb ran out of taps')
  return null
}

/** Pull the plug and come back in through `door`. */
async function reopen(door: Door, before: string | null): Promise<boolean> {
  await settle()
  // what a mid-match copy would hold, taken the way the Game Status screen takes it
  const stamped = JSON.stringify(st.getState().saveCopy())
  if (door === 'saveOther') {
    await saveGame('slot2', JSON.parse(stamped) as GameState)
    st.getState().setSlot('slot2')
    await settle()
  }
  const slot = st.getState().saveSlot
  // the process dies: nothing in memory survives
  st.setState({ game: null, liveMatch: null, matchRec: null, nav: [{ screen: 'menu' }], resuming: false, lastAdvanceAt: 0 })
  let g: GameState | null
  let into = slot
  if (door === 'importBefore' || door === 'importStamped') {
    if (door === 'importStamped') {
      // another device: the only trace of the match is the file itself
      for (const k of ['slot1', 'slot2', 'imported']) await clearResume(k)
    }
    const raw = JSON.parse(door === 'importBefore' ? before! : stamped) as GameState
    g = migrate(raw)
    await saveGame('imported', g)
    into = 'imported'
  } else {
    g = await loadGame(slot)
  }
  if (!g) { ok(false, `${door}: the save would not load`); return false }
  st.getState().setGame(g, into, true)
  let guard = 0
  while (st.getState().resuming && guard++ < 200) await new Promise(r => setTimeout(r, 5))
  const back = !!st.getState().liveMatch
  // no path offers the match again
  const nav = st.getState().nav
  if (back) {
    const fxBefore = st.getState().liveMatch!.ctx
    st.getState().kickOff('fire', 'full')
    st.getState().instantResult('fire')
    ok(st.getState().liveMatch?.ctx === fxBefore && nav[nav.length - 1]?.screen === 'matchday',
      `${door}: Kick Off and the assistant refuse while the match is there`)
  }
  return back
}

async function play(seed: number, plan: { at: Point; door: Door }[]): Promise<string> {
  const { fxId, side } = await fresh(seed)
  const before = JSON.stringify(st.getState().saveCopy())
  st.getState().kickOff('calm', 'full')
  ok(!!st.getState().liveMatch, 'the match kicked off')
  const remaining = [...plan]
  if (remaining[0]?.at === 'kickoff') {
    const { door } = remaining.shift()!
    const back = await reopen(door, before)
    ok(back, `reopened straight after pressing play (${door}): the match is still there`)
    ok(!!st.getState().liveMatch?.resumed, '...and it says so')
    reached.kickoff++
  }
  for (;;) {
    // stop at whichever planned point this match reaches first: not every
    // match has a touchline call, and one can come before the 5th tick
    const got = drive(p => remaining.some(r => r.at === p))
    if (!got) break
    const idx = remaining.findIndex(r => r.at === got)
    const { door } = remaining.splice(idx, 1)[0]
    const back = await reopen(door, before)
    const lm = st.getState().liveMatch
    ok(back, `reopened at ${got} (${door}): the match came back${lm ? `, ${lm.ctx.home.score}-${lm.ctx.away.score} at tick ${lm.ctx.tick}` : ''}`)
    ok(!!lm?.resumed, `...and says "still going" rather than resuming silently`)
    if (got === 'decision') ok(!!lm?.ctx.decision, '...with the same call still waiting for an answer')
    if (got === 'ht') ok(lm?.ctx.awaiting === 'HT', '...at the half-time interval, talk still to give')
    if (!back) return 'LOST'
    reached[got]++
  }
  for (const r of remaining) console.log(`  (this match never reached "${r.at}", so there was no reopen there)`)
  const lm = st.getState().liveMatch
  if (!lm || lm.ctx.seg !== 3) { ok(false, 'the match did not reach full time'); return 'UNFINISHED' }
  st.getState().finishMatch()
  await settle(); await settle()
  const g = st.getState().game!
  const sig = resultSig(g, fxId, side)
  // and the finished match stays finished
  const recs = (await peekResumes<{ fxId: number }>()).filter(r => r.slot === st.getState().saveSlot)
  ok(recs.length === 0, 'once the finished career is written, the live record is gone')
  const disk = await loadGame(st.getState().saveSlot)
  ok(!!disk?.fixtures.find(f => f.id === fxId)?.played, 'and the career on disk has the match played')
  return sig
}

const reached: Record<Point, number> = { kickoff: 0, mid1: 0, decision: 0, ht: 0, ft: 0 }

// 4242 has a touchline call in the first minutes, 34 has five of them
for (const seed of [4242, 34]) {
  console.log(`\nseed ${seed}: straight through, no interruptions`)
  const base = await play(seed, [])
  const again = await play(seed, [])
  ok(base === again, 'the same match played twice is the same match (the baseline is stable)')

  const plans: { name: string; plan: { at: Point; door: Door }[] }[] = [
    { name: 'reopen straight after pressing play', plan: [{ at: 'kickoff', door: 'continue' }] },
    { name: 'reopen mid-first-half', plan: [{ at: 'mid1', door: 'continue' }] },
    { name: 'reopen with a touchline call held', plan: [{ at: 'decision', door: 'continue' }] },
    { name: 'reopen at half-time', plan: [{ at: 'ht', door: 'continue' }] },
    { name: 'reopen at full time, before Continue', plan: [{ at: 'ft', door: 'continue' }] },
    { name: 'reopen at every one of them in turn', plan: [
      { at: 'kickoff', door: 'continue' }, { at: 'mid1', door: 'continue' },
      { at: 'decision', door: 'continue' }, { at: 'ht', door: 'continue' }, { at: 'ft', door: 'continue' }] },
    { name: 'import a backup exported before kick-off, mid-match', plan: [{ at: 'mid1', door: 'importBefore' }] },
    { name: 'import a backup exported before kick-off, at full time', plan: [{ at: 'ft', door: 'importBefore' }] },
    { name: 'a copy exported mid-match, opened with no other trace', plan: [{ at: 'ht', door: 'importStamped' }] },
    { name: 'save to another slot mid-match, then reopen', plan: [{ at: 'mid1', door: 'saveOther' }, { at: 'ht', door: 'continue' }] },
  ]
  for (const { name, plan } of plans) {
    console.log(`\nseed ${seed}: ${name}`)
    const sig = await play(seed, plan)
    ok(sig === base, `the result is the result of playing straight through${sig === base ? '' : `\n      was ${base.split('#')[1]}, now ${sig.split('#')[1]}`}`)
  }
}

console.log('')
for (const [p, n] of Object.entries(reached)) ok(n > 0, `reopened at "${p}" ${n} times`)

if (fails) { console.error(`\nNOSCUM PROBE: ${fails} failures`); process.exit(1) }
console.log('\nNOSCUM PROBE PASSED: a match that has kicked off is finished, never replayed')
