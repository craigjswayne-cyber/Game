// Probe: a match that has kicked off cannot be played again, and a match left
// running is played out on the way back in (1.8.2, round 5).
//
// Tester note 1.4: losing a match, closing the game (or going back to the title
// and reopening the save) threw the match away and offered it again, so a
// result could be rerolled. The owner's decision: once the ball is kicked,
// reopening the game must never produce a different result.
//
// Round 5 changed what reopening DOES (owner: "When you load into the game
// again it should always load into the Home page. If it was during the match,
// the match needs to be completed."). A reopened match is no longer put back
// on screen: it is replayed to the minute it had reached, with every call the
// manager made, and the assistant plays it out from there (resume.ts playOut),
// the week turns once, and the career lands on Home. So this probe now holds:
//
//   every reopen lands on Home, alone on the stack, with no match live
//   the result is EXACTLY the record played out: computed here independently
//     (replay, then the assistant's own instant-result loop) and compared
//   reopened straight after pressing play, it is exactly the assistant's
//     instant result for the same talk, the same match the preview offered
//   reopened at full time, before Continue, it is the match played straight
//     through, to the last point and the last injury
//   the week turns ONCE: reopening again, or dying half way through the
//     play-out and reopening, changes nothing and plays nothing twice
//   and Kick Off and the assistant do not touch the fixture again
//
// It drives the REAL STORE through the real load path - the career slot and
// the live-match record written to the save database, the game wiped from
// memory, the slot read back with loadGame and opened with setGame exactly as
// the title screen's Continue does - at every point a player might pull the
// plug, and through the Game Status doors: a backup exported before kick-off
// and imported mid-match, a copy exported mid-match and opened with no other
// trace of the match on the device, and a save to another slot mid-match.
import { newGame } from '../src/game/newgame'
import { useStore } from '../src/store'
import { clearResume, loadGame, migrate, peekResumes, saveGame } from '../src/game/save'
import { processWeekAndAdvance, userMatchThisWeek } from '../src/game/season'
import { replayMatch, stampedRecord, type MatchResume } from '../src/game/resume'
import { applyPreTalk, beginMatch, playHalf, resolveDecision, stepTick } from '../src/game/matchEngine'
import { matchRng } from '../src/game/season'
import type { GameState } from '../src/game/model'

let fails = 0
const ok = (c: boolean, what: string) => {
  console.log(`${c ? '  ok  ' : 'FAIL  '}${what}`)
  if (!c) fails++
}

const st = useStore
const SLOT = 'slot1'
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 3)) }
const quiet = async () => { await settle(); await new Promise(r => setTimeout(r, 30)); await settle() }

type Point = 'kickoff' | 'mid1' | 'decision' | 'ht' | 'ft'
type Door = 'continue' | 'importBefore' | 'importStamped' | 'saveOther'

/** The match itself, as the fixture holds it: every line, both scores. */
function matchSig(g: GameState, fxId: number): string {
  const fx = g.fixtures.find(f => f.id === fxId)!
  const ev = (fx.events ?? []).map(e => `${e.min}|${e.type}|${e.teamId}|${e.playerId ?? ''}|${e.homeScore}-${e.awayScore}`).join(';')
  return `${fx.played}#${fx.homeScore}-${fx.awayScore}#${ev}`
}

/** And what it left on the squad, after the week turned. */
function resultSig(g: GameState, fxId: number, userSide: string): string {
  const squad = Object.values(g.players)
    .filter(p => p.clubId === userSide)
    .sort((a, b) => a.id - b.id)
    .map(p => `${p.id}:${p.stats.tries}/${p.stats.points}/${p.stats.yc}/${p.stats.rc}/${p.bans}/${p.injury?.weeks ?? 0}`)
    .join(',')
  return `${matchSig(g, fxId)}#${squad}#w${g.season}.${g.week}`
}

/**
 * The record played out, worked out HERE rather than by the store: the
 * replay, then the loop the assistant's instant result runs (playHalf, every
 * kickable penalty to the posts), with the assistant on the bench.
 */
function expectedPlayOut(rec: MatchResume): string {
  const base = migrate(JSON.parse(JSON.stringify(rec.pre)) as GameState)
  delete base.liveRec
  const out = replayMatch(base, rec)!
  const ctx = out.ctx
  ctx.assistantSubs = true
  let guard = 0
  while (ctx.seg < 3 && guard++ < 12) {
    ctx.awaiting = null
    for (;;) {
      if (ctx.decision) resolveDecision(base, ctx, 'posts')
      const r = stepTick(base, ctx)
      if (ctx.decision) resolveDecision(base, ctx, 'posts')
      if (r !== 'play') break
    }
  }
  if (ctx.decision) resolveDecision(base, ctx, 'posts')
  return matchSig(base, rec.fxId)
}

/** The assistant's instant result for the same match and talk, on a copy. */
function instantFrom(pre: GameState, fxId: number, side: string, talk: 'calm'): string {
  const g = migrate(JSON.parse(JSON.stringify(pre)) as GameState)
  delete g.liveRec
  const fx = g.fixtures.find(f => f.id === fxId)!
  const ctx = beginMatch(g, fx, matchRng(g), true, side)
  ctx.assistantSubs = true
  // exactly store.instantResult: the assistant, then the talk, then two halves
  applyPreTalk(g, ctx, talk)
  playHalf(g, ctx)
  playHalf(g, ctx)
  return matchSig(g, fxId)
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
 * The manager's thumb. Every call is a function of the match as it stands.
 * Returns when `stop` says so, or at full time.
 */
function drive(stop: (p: Point | null) => boolean): Point | null {
  let guard = 0
  const seen = new Set<Point>()
  const hit = (p: Point) => { if (seen.has(p)) return false; seen.add(p); return stop(p) }
  while (guard++ < 5000) {
    const s = st.getState()
    const lm = s.liveMatch
    if (!lm) return null
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

/** Open a career the way the title screen does, and wait for the play-out. */
async function open(g: GameState, slot: string): Promise<void> {
  st.getState().setGame(g, slot, true)
  let guard = 0
  while (st.getState().resuming && guard++ < 400) await new Promise(r => setTimeout(r, 5))
  await quiet()
}

/** Pull the plug and come back in through `door`. Returns the record as it
 *  stood when the plug was pulled. */
async function reopen(door: Door, before: string | null): Promise<MatchResume> {
  await settle()
  // what a mid-match copy would hold, taken the way the Game Status screen takes it
  const stamped = JSON.stringify(st.getState().saveCopy())
  const rec = stampedRecord(JSON.parse(stamped) as GameState)!
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
  if (!g) { ok(false, `${door}: the save would not load`); return rec }
  await open(g, into)
  return rec
}

async function play(seed: number, plan: { at: Point; door: Door } | null): Promise<string> {
  const { fxId, side } = await fresh(seed)
  const before = JSON.stringify(st.getState().saveCopy())
  st.getState().kickOff('calm', 'full')
  ok(!!st.getState().liveMatch, 'the match kicked off')
  let rec: MatchResume | null = null
  if (plan?.at === 'kickoff') {
    rec = await reopen(plan.door, before)
    reached.kickoff++
  } else {
    const got = drive(p => p === plan?.at)
    if (plan && got === plan.at) { rec = await reopen(plan.door, before); reached[got]++ }
    else if (plan) console.log(`  (this match never reached "${plan.at}", so there was no reopen there)`)
  }
  if (!rec) {
    const lm = st.getState().liveMatch
    if (!lm || lm.ctx.seg !== 3) { ok(false, 'the match did not reach full time'); return 'UNFINISHED' }
    st.getState().finishMatch()
    await quiet()
  } else {
    const s = st.getState()
    ok(!s.liveMatch && !s.resuming, `reopened at ${plan!.at} (${plan!.door}): no match live, nothing still loading`)
    ok(s.nav.length === 1 && s.nav[0].screen === 'home', `...and it lands on Home, alone on the stack (${s.nav.map(n => n.screen).join(' > ')})`)
    const g = s.game!
    const fx = g.fixtures.find(f => f.id === fxId)!
    ok(!!fx.played, `...with the match played out, ${fx.homeScore}-${fx.awayScore}`)
    const exp = expectedPlayOut(rec)
    ok(matchSig(g, fxId) === exp, `...to exactly the record played out by the assistant from tick ${rec.tick}`)
    if (plan!.at === 'kickoff') {
      ok(matchSig(g, fxId) === instantFrom(rec.pre, fxId, side, 'calm'),
        '...which, reopened at the kick-off, is the assistant\'s instant result')
    }
    ok(g.news.filter(n => n.k === 'news.playedOut').length === 1, '...and the inbox says so, once')
  }
  const g = st.getState().game!
  const sig = resultSig(g, fxId, side)
  // and the finished match stays finished
  const recs = (await peekResumes<{ fxId: number }>()).filter(r => r.slot === st.getState().saveSlot)
  ok(recs.length === 0, 'once the finished career is written, the live record is gone')
  const disk = await loadGame(st.getState().saveSlot)
  ok(!!disk?.fixtures.find(f => f.id === fxId)?.played, 'and the career on disk has the match played')
  // OPENED AGAIN: nothing is played twice, the week does not turn twice
  if (disk) {
    st.setState({ game: null, liveMatch: null, matchRec: null, nav: [{ screen: 'menu' }], resuming: false, lastAdvanceAt: 0 })
    await open(disk, st.getState().saveSlot)
    const again = st.getState().game!
    ok(resultSig(again, fxId, side) === sig && again.news.filter(n => n.k === 'news.playedOut').length <= 1,
      'and opened again, it is the same career: nothing played twice, the week turned once')
    // Kick Off and the assistant never reach this fixture again
    const nextFx = userMatchThisWeek(again)
    ok(!nextFx || nextFx.id !== fxId, 'and the fixture is not on offer again')
  }
  return sig
}

/**
 * THE PLUG PULLED DURING THE PLAY-OUT. The career is written after the match
 * is played out; die before that write lands and the next open must find the
 * record still there and play the same match out to the same result.
 */
async function dieDuringPlayOut(seed: number): Promise<void> {
  const { fxId, side } = await fresh(seed)
  st.getState().kickOff('calm', 'full')
  drive(p => p === 'mid1')
  await settle()
  const slot = st.getState().saveSlot
  st.setState({ game: null, liveMatch: null, matchRec: null, nav: [{ screen: 'menu' }], resuming: false, lastAdvanceAt: 0 })
  // first open: played out in memory, then the process dies before the
  // career is written (nothing awaited, and the memory wiped at once)
  const g1 = (await loadGame(slot))!
  st.getState().setGame(g1, slot, true)
  let guard = 0
  while (st.getState().resuming && guard++ < 400) await new Promise(r => setTimeout(r, 1))
  const first = st.getState().game ? resultSig(st.getState().game!, fxId, side) : 'none'
  st.setState({ game: null, liveMatch: null, matchRec: null, nav: [{ screen: 'menu' }], resuming: false, lastAdvanceAt: 0 })
  await quiet()
  // second open, from whatever reached the disk
  const g2 = (await loadGame(slot))!
  await open(g2, slot)
  const second = resultSig(st.getState().game!, fxId, side)
  ok(first === second, `seed ${seed}: dying during the play-out and reopening gives the same result, the week turned once`)
}

const reached: Record<Point, number> = { kickoff: 0, mid1: 0, decision: 0, ht: 0, ft: 0 }

// 4242 has a touchline call in the first minutes, 34 has five of them
for (const seed of [4242, 34]) {
  console.log(`\nseed ${seed}: straight through, no interruptions`)
  const base = await play(seed, null)
  const again = await play(seed, null)
  ok(base === again, 'the same match played twice is the same match (the baseline is stable)')

  const plans: { name: string; plan: { at: Point; door: Door } }[] = [
    { name: 'reopen straight after pressing play', plan: { at: 'kickoff', door: 'continue' } },
    { name: 'reopen mid-first-half', plan: { at: 'mid1', door: 'continue' } },
    { name: 'reopen with a touchline call held', plan: { at: 'decision', door: 'continue' } },
    { name: 'reopen at half-time', plan: { at: 'ht', door: 'continue' } },
    { name: 'reopen at full time, before Continue', plan: { at: 'ft', door: 'continue' } },
    { name: 'import a backup exported before kick-off, mid-match', plan: { at: 'mid1', door: 'importBefore' } },
    { name: 'import a backup exported before kick-off, at full time', plan: { at: 'ft', door: 'importBefore' } },
    { name: 'a copy exported mid-match, opened with no other trace', plan: { at: 'ht', door: 'importStamped' } },
    { name: 'save to another slot mid-match, then reopen', plan: { at: 'mid1', door: 'saveOther' } },
  ]
  const sigs: Record<string, string> = {}
  for (const { name, plan } of plans) {
    console.log(`\nseed ${seed}: ${name}`)
    const sig = await play(seed, plan)
    sigs[`${plan.at}:${plan.door}`] = sig
    // at full time every call has been made: the result is the match played
    // straight through, to the last point and the last injury
    if (plan.at === 'ft') ok(sig === base, `the result is the result of playing straight through${sig === base ? '' : `\n      was ${base.split('#')[1]}, now ${sig.split('#')[1]}`}`)
    // the same reopen point through any door is the same result
    if (plan.at === 'mid1' && sigs['mid1:continue'] && plan.door !== 'continue') {
      ok(sig === sigs['mid1:continue'], `the same minute through another door is the same result (${plan.door})`)
    }
  }
  console.log(`\nseed ${seed}: the plug pulled during the play-out`)
  await dieDuringPlayOut(seed)
}

console.log('')
for (const [p, n] of Object.entries(reached)) ok(n > 0, `reopened at "${p}" ${n} times`)

if (fails) { console.error(`\nNOSCUM PROBE: ${fails} failures`); process.exit(1) }
console.log('\nNOSCUM PROBE PASSED: a match that has kicked off is finished once, never replayed')
